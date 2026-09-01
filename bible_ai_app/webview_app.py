import os
os.environ["ANONYMIZED_TELEMETRY"] = "False"
import sys
import re
import html
import json
import shutil
import zipfile
import datetime
import threading
import logging
import requests

logger = logging.getLogger("webview_app")

try:
    import webview
except ImportError:
    webview = None
from typing import Dict, List, Any, Optional

# Ajouter le répertoire racine au PYTHONPATH
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

# Purge préventive des .pyc périmés (évite les crashs sur bytecode obsolète après modifications sources)
def _purge_stale_pyc_caches(root: str):
    import glob
    for pyc_path in glob.glob(os.path.join(root, "**", "__pycache__", "*.pyc"), recursive=True):
        cache_dir = os.path.dirname(pyc_path)
        pkg_dir = os.path.dirname(cache_dir)
        basename = os.path.basename(pyc_path).split(".")[0]
        py_path = os.path.join(pkg_dir, basename + ".py")
        if os.path.exists(py_path) and os.path.getmtime(py_path) > os.path.getmtime(pyc_path):
            try:
                os.remove(pyc_path)
            except OSError:
                pass

_purge_stale_pyc_caches(current_dir)

from core.bible_json_loader import BibleJsonLoader, extract_verse_text
from core.reference_parser import (
    get_french_book_name,
    resolve_book_input,
    parse_smart_book_input,
    BOOKS_OT,
    BOOKS_NT,
    BOOKS_DEUTERO,
    ALL_BOOKS,
    BOOK_MAPPING,
    strip_accents
)
from core.pericope_manager import PericopeManager
from core.commentary_loader import CommentaryLoader
from core.dictionary_manager import DictionaryManager
from core.original_languages_manager import OriginalLanguagesManager
from core.notes_manager import NotesManager
from core.config import (
    load_config,
    save_config,
    DEFAULT_NOTE_TITLE_SYSTEM_PROMPT,
    DEFAULT_NOTE_TAGS_SYSTEM_PROMPT
)
from core.sermons_manager import SermonsManager
from core.highlights_manager import HighlightsManager
from core.maps_manager import MapsManager
from gui.library_utils import load_books_metadata, save_books_metadata
from core.ai_session_manager import AISessionManager
from core.secrets_manager import migrate_secrets_from_config, load_secrets_into_config
from core.native_notifications import send_windows_toast

# Composants inclus dans la sauvegarde complète
_BACKUP_MANIFEST_VERSION = "1.0"
_BACKUP_COMPONENTS = [
    ("chroma_db",      "📦 Vecteurs ChromaDB"),
    ("commentaires",   "📝 Commentaires bibliques"),
    ("bibles",         "📖 Bibles JSON"),
    ("covers",         "🖼️ Couvertures"),
    ("dictionaries",   "📚 Dictionnaires"),
    ("library.json",   "🗂️ Registre (library.json)"),
    ("config.json",    "⚙️ Paramètres (config.json)"),
]


# Fenêtre native globale (stockée en dehors de la classe API pour éviter les récursions COM/.NET)
_GLOBAL_WINDOW = None
_IS_MAXIMIZED = True
_IS_FULLSCREEN = False
_RESTORE_BOUNDS = (100, 100, 1200, 800)

def get_active_window():
    global _GLOBAL_WINDOW
    return _GLOBAL_WINDOW


def strip_xml_tags(text: str) -> str:
    """Enlève toutes les balises XML/HTML (comme <w>, <note>, <p>, <divineName>, etc.) et normalise les espaces."""
    if not text:
        return ""
    clean = re.sub(r'<note[^>]*>.*?</note>', '', text, flags=re.I)
    clean = re.sub(r'<[^>]+>', '', clean)
    clean = re.sub(r'\s+', ' ', clean).strip()
    return clean


def parse_reverse_interlinear_verse(v_raw: str) -> List[Dict[str, Any]]:
    """
    Parse un verset français balisé avec des codes Strong (<w strong="Hxxxx">mot</w>)
    pour produire les blocs de l'interlinéaire inversé français (Logos style).
    """
    from core.strong_lexicon import StrongLexicon
    StrongLexicon.load_lexicon()
    
    tokens = re.split(r'(<w\s+strong="[^"]*">.*?</w>)', v_raw)
    words_data = []
    
    for tok in tokens:
        if not tok:
            continue
        m = re.match(r'<w\s+strong="([^"]*)">(.*?)</w>', tok)
        if m:
            s_codes = m.group(1).strip()
            surface = m.group(2).strip()
            surface = re.sub(r'<[^>]+>', '', surface).strip()
            if not surface:
                continue
            entries = StrongLexicon.get_multiple(s_codes)
            lemmas, translits = [], []
            for e in entries:
                raw_lem = e.get('lemma', '')
                if ' - ' in raw_lem:
                    p = raw_lem.split(' - ')
                    lemmas.append(p[0].strip())
                    translits.append(p[1].strip())
                else:
                    lemmas.append(raw_lem.strip())
                    if e.get('translit'):
                        translits.append(e.get('translit').strip())
            
            words_data.append({
                "surface": surface,
                "orig": " ".join(lemmas),
                "translit": " ".join([t for t in translits if t]),
                "lemma": " ".join(lemmas),
                "strong": s_codes,
                "morph": "",
                "lang": "hebrew" if s_codes.startswith("H") else "greek"
            })
        else:
            clean_t = re.sub(r'<note[^>]*>.*?</note>', '', tok, flags=re.I)
            clean_t = re.sub(r'<[^>]+>', '', clean_t).strip()
            for w in clean_t.split():
                clean_w = w.strip(" ,;:.?!«»()\"'’•—–")
                if clean_w:
                    words_data.append({
                        "surface": w,
                        "orig": "",
                        "translit": "",
                        "lemma": "",
                        "strong": "",
                        "morph": "",
                        "lang": "fr"
                    })
    return words_data


BIBLES_REGISTRY_FILE = os.path.join(current_dir, "data", "bibles_registry.json")

def load_bibles_registry() -> Dict[str, Any]:
    """Charge le catalogue structuré des traductions bibliques (Typologie Bibliorama)."""
    try:
        if os.path.exists(BIBLES_REGISTRY_FILE):
            with open(BIBLES_REGISTRY_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
    except Exception as e:
        logger.warning(f"Erreur lecture bibles_registry.json: {e}")
    return {}

def find_bible_registry_entry(name_or_code: str, registry: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
    """Trouve la fiche de référence exacte d'une Bible par nom, sigle ou alias."""
    if not name_or_code:
        return None
    if registry is None:
        registry = load_bibles_registry()
    
    clean = str(name_or_code).strip()
    clean_upper = clean.upper()
    clean_norm = re.sub(r'[^\w\s]', '', clean.lower()).strip()
    
    # 1. Clé exacte de code (S21, LSG, BDS, TOB, etc.)
    if clean_upper in registry:
        return registry[clean_upper]
    
    # 2. Correspondance stricte sur code ou nom officiel
    for code, data in registry.items():
        if data.get("code", "").upper() == clean_upper:
            return data
        if (data.get("nom_officiel") or "").lower() == clean.lower():
            return data
        for alias in data.get("aliases", []):
            if alias.lower() == clean.lower() or alias.lower() == clean_norm:
                return data
            
    # 3. Correspondance stricte sur alias normalisé
    if len(clean_norm) >= 2:
        for code, data in registry.items():
            for alias in data.get("aliases", []):
                alias_norm = re.sub(r'[^\w\s]', '', alias.lower()).strip()
                if alias_norm == clean_norm:
                    return data
                    
    return None

BIBLE_CANONICAL_INFO = {
    "Colombe":   ("Bible à la Colombe (1978)", "COL"),
    "Chouraqui": ("Traduction André Chouraqui (1985)", "CHOU"),
    "Segond 21": ("Bible Segond 21 (2007)", "S21"),
    "BDS":       ("Bible du Semeur (2015)", "BDS"),
    "NBS":       ("Nouvelle Bible Segond (2002)", "NBS"),
    "NFC":       ("Nouvelle Français Courant (2019)", "NFC"),
    "PDV2017":   ("Parole de Vie (2017)", "PDV"),
    "NEG79":     ("Nouvelle Édition de Genève (1979)", "NEG"),
    "PV":        ("Parole Vivante (Alfred Kuen)", "PV"),
    "NCL":       ("Néo-Crampon Libre", "NCL"),
    "SV":        ("Sagesse Vivante", "SV"),
    "BENFS":     ("Bible en Français Simple", "BFS"),
    "JXLFR":     ("Juxtalinéaire Grec-Français (Xenizo)", "JXL"),
    "APEE":      ("Bible de l'Épée (King James Française)", "APEE"),
    "OST":       ("Bible J.F. Ostervald (1877/1996)", "OST"),
    "LSG":       ("Louis Segond 1910 (Codes Strong)", "LSG"),
    "DARBY":     ("Bible J.N. Darby (Codes Strong)", "DARBY"),
    "TOB":       ("Traduction Œcuménique de la Bible (2010)", "TOB"),
    "BDJ":       ("Bible de Jérusalem", "BDJ"),
}


def get_cover_data_url(cover_path: Optional[str]) -> Optional[str]:
    """Convertit un chemin d'image de couverture local en Data URL Base64 universelle."""
    if not cover_path:
        return None
    if str(cover_path).startswith("data:image/") or str(cover_path).startswith("http://") or str(cover_path).startswith("https://"):
        return cover_path
        
    actual_path = cover_path
    if not os.path.exists(actual_path):
        base_name = os.path.basename(cover_path)
        cand = os.path.join(current_dir, "data", "covers", base_name)
        if os.path.exists(cand):
            actual_path = cand
        else:
            return None

    try:
        import base64
        ext = os.path.splitext(actual_path)[1].lower().replace('.', '')
        mime = 'image/jpeg' if ext in ['jpg', 'jpeg'] else (f'image/{ext}' if ext in ['png', 'webp', 'gif'] else 'image/jpeg')
        with open(actual_path, 'rb') as f:
            b64 = base64.b64encode(f.read()).decode('utf-8')
        return f"data:{mime};base64,{b64}"
    except Exception as e:
        logger.warning(f"Erreur encodage couverture data URL ({cover_path}): {e}")
        return None

# Mixin imports
from api.bible_reader import BibleReaderMixin
from api.commentary import CommentaryMixin
from api.study import StudyMixin
from api.ai import AiMixin
from api.library import LibraryMixin
from api.import_mgr import ImportMixin
from api.settings import SettingsMixin
from api.window import WindowMixin
from api.content import ContentMixin


class BibleAppApi(BibleReaderMixin, CommentaryMixin, StudyMixin, AiMixin,
                  LibraryMixin, ImportMixin, SettingsMixin, WindowMixin, ContentMixin):
    """
    API Bridge exposée au Frontend Webview JavaScript.
    Chaque méthode publique est directement invocable via window.pywebview.api.<nom_methode>(...).
    """

    def __init__(self):
        raw_config = load_config()
        raw_config = migrate_secrets_from_config(raw_config)
        self.config = load_secrets_into_config(raw_config)


import ctypes
from ctypes import wintypes

user32 = ctypes.windll.user32

class RECT(ctypes.Structure):
    _fields_ = [
        ('left', wintypes.LONG),
        ('top', wintypes.LONG),
        ('right', wintypes.LONG),
        ('bottom', wintypes.LONG)
    ]

def get_work_area():
    try:
        rect = RECT()
        user32.SystemParametersInfoW(0x0030, 0, ctypes.byref(rect), 0)
        w = rect.right - rect.left
        h = rect.bottom - rect.top
        return rect.left, rect.top, (w if w > 600 else 1440), (h if h > 400 else 850)
    except Exception:
        return 0, 0, 1440, 850

class MONITORINFO(ctypes.Structure):
    _fields_ = [
        ('cbSize', wintypes.DWORD),
        ('rcMonitor', RECT),
        ('rcWork', RECT),
        ('dwFlags', wintypes.DWORD)
    ]

def get_fullscreen_bounds(hwnd=None):
    """Renvoie les coordonnées (x, y, w, h) du moniteur complet (plein écran total couvrant la barre des tâches)."""
    try:
        if hwnd:
            MONITOR_DEFAULTTONEAREST = 2
            hmonitor = user32.MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST)
            mi = MONITORINFO()
            mi.cbSize = ctypes.sizeof(MONITORINFO)
            if user32.GetMonitorInfoW(hmonitor, ctypes.byref(mi)):
                rc = mi.rcMonitor
                w = int(rc.right - rc.left)
                h = int(rc.bottom - rc.top)
                return int(rc.left), int(rc.top), (w if w > 600 else 1920), (h if h > 400 else 1080)
    except Exception as e:
        logger.debug(f"get_fullscreen_bounds hwnd error: {e}")
    try:
        w = user32.GetSystemMetrics(0)
        h = user32.GetSystemMetrics(1)
        return 0, 0, (w if w > 600 else 1920), (h if h > 400 else 1080)
    except Exception:
        return 0, 0, 1920, 1080

def get_monitors_layout():
    """Renvoie la liste des zones de travail de tous les écrans connectés."""
    monitors = []
    
    def _enum_proc(hMonitor, hdcMonitor, lprcMonitor, dwData):
        try:
            mi = MONITORINFO()
            mi.cbSize = ctypes.sizeof(MONITORINFO)
            if user32.GetMonitorInfoW(hMonitor, ctypes.byref(mi)):
                rc = mi.rcWork
                is_primary = bool(mi.dwFlags & 1)
                monitors.append({
                    "x": int(rc.left),
                    "y": int(rc.top),
                    "width": int(rc.right - rc.left),
                    "height": int(rc.bottom - rc.top),
                    "is_primary": is_primary
                })
        except Exception as e:
            logger.warning(f"Erreur GetMonitorInfoW: {e}")
        return True

    try:
        EnumDisplayMonitorsProc = ctypes.WINFUNCTYPE(
            wintypes.BOOL,
            wintypes.HMONITOR,
            wintypes.HDC,
            ctypes.POINTER(RECT),
            wintypes.LPARAM
        )
        user32.EnumDisplayMonitors(None, None, EnumDisplayMonitorsProc(_enum_proc), 0)
    except Exception as e:
        logger.warning(f"Erreur EnumDisplayMonitors: {e}")

    if not monitors:
        wx, wy, ww, wh = get_work_area()
        monitors.append({"x": wx, "y": wy, "width": ww, "height": wh, "is_primary": True})

    return monitors

_IS_MAXIMIZED = True
_RESTORE_BOUNDS = (80, 50, 1280, 800)

_COMMENTARY_WINDOW = None
_COMMENTARY_IS_MAXIMIZED = False
_COMMENTARY_RESTORE_BOUNDS = (100, 60, 1100, 750)
_COMMENTARY_TARGET_BOUNDS = (0, 0, 1200, 800)
_LAST_ACTIVE_PASSAGE = ("Gen", 1, 1)



def on_window_shown(*args, **kwargs):
    global _GLOBAL_WINDOW, _IS_MAXIMIZED
    try:
        if hasattr(_GLOBAL_WINDOW, 'native') and _GLOBAL_WINDOW.native:
            hwnd = _GLOBAL_WINDOW.native.Handle.ToInt32()
            wx, wy, ww, wh = get_work_area()
            user32.SetWindowPos(hwnd, 0, wx, wy, ww, wh, 0x0040)
            _IS_MAXIMIZED = True
        
        # Sécurité : neutraliser le déplacement si la fenêtre est agrandie
        if hasattr(_GLOBAL_WINDOW, 'move'):
            orig_move = _GLOBAL_WINDOW.move
            def safe_move(x, y):
                global _IS_MAXIMIZED, _IS_FULLSCREEN
                if _IS_MAXIMIZED or _IS_FULLSCREEN:
                    return
                try:
                    orig_move(x, y)
                except Exception as _silent_e:
                    logger.debug("Erreur ignoree : %s", _silent_e)
            _GLOBAL_WINDOW.move = safe_move
    except Exception as e:
        logger.warning(f"Erreur initialisation agrandissement: {e}")


def on_commentary_shown(*args, **kwargs):
    global _COMMENTARY_WINDOW, _COMMENTARY_IS_MAXIMIZED, _COMMENTARY_TARGET_BOUNDS, _LAST_ACTIVE_PASSAGE
    try:
        if hasattr(_COMMENTARY_WINDOW, 'native') and _COMMENTARY_WINDOW.native:
            hwnd = _COMMENTARY_WINDOW.native.Handle.ToInt32()
            
            # Activer les poignées de redimensionnement natives sur les 4 bords et 4 coins
            GWL_STYLE = -16
            WS_THICKFRAME = 0x00040000
            current_style = user32.GetWindowLongW(hwnd, GWL_STYLE)
            user32.SetWindowLongW(hwnd, GWL_STYLE, current_style | WS_THICKFRAME)

            wx, wy, ww, wh = _COMMENTARY_TARGET_BOUNDS
            user32.SetWindowPos(hwnd, 0, wx, wy, ww, wh, 0x0040 | 0x0020)
            
            # Neutraliser le déplacement souris si la fenêtre est maximisée / plein écran
            if hasattr(_COMMENTARY_WINDOW, 'move'):
                orig_comm_move = _COMMENTARY_WINDOW.move
                def safe_comm_move(x, y):
                    global _COMMENTARY_IS_MAXIMIZED
                    if _COMMENTARY_IS_MAXIMIZED:
                        return
                    try:
                        orig_comm_move(x, y)
                    except Exception as _silent_e:
                        logger.debug("Erreur ignoree : %s", _silent_e)
                _COMMENTARY_WINDOW.move = safe_comm_move

            # Préparation et envoi asynchrone des données pour ne jamais bloquer le thread d'affichage natif
            def async_push_data():
                try:
                    b, ch, v = _LAST_ACTIVE_PASSAGE
                    api = BibleAppApi()
                    data = api.get_chapter_commentaries_grouped(b, ch)
                    json_str = json.dumps(data)
                    import base64
                    b64_str = base64.b64encode(json_str.encode('utf-8')).decode('utf-8')
                    for delay in (0.05, 0.25, 0.75):
                        time.sleep(delay)
                        if _COMMENTARY_WINDOW:
                            try:
                                _COMMENTARY_WINDOW.evaluate_js(
                                    f"window.CommentaryWindow && window.CommentaryWindow.receiveChapterDataB64('{b64_str}', {v})"
                                )
                            except Exception as _silent_e:
                                logger.debug("Erreur ignoree : %s", _silent_e)
                except Exception as ex:
                    logger.debug(f"async_push_data error: {ex}")

            threading.Thread(target=async_push_data, daemon=True).start()
    except Exception as e:
        logger.warning(f"Erreur on_commentary_shown: {e}")



def push_task_update(event_type: str, task_data: dict):
    global _GLOBAL_WINDOW
    try:
        if _GLOBAL_WINDOW:
            json_str = json.dumps(task_data)
            _GLOBAL_WINDOW.evaluate_js(f"window.TaskManager && window.TaskManager.handleTaskEvent('{event_type}', {json_str})")
    except Exception as e:
        logger.debug(f"push_task_update error: {e}")


def main():
    global _GLOBAL_WINDOW
    from core.task_manager import TaskManager
    TaskManager.set_window_callback(push_task_update)

    api = BibleAppApi()
    
    html_path = os.path.join(current_dir, "web", "index.html")
    wx, wy, ww, wh = get_work_area()
    
    _GLOBAL_WINDOW = webview.create_window(
        title="Open Shema — Lecteur & Assistant d'Étude Biblique",
        url=html_path,
        js_api=api,
        x=wx,
        y=wy,
        width=ww,
        height=wh,
        min_size=(1050, 680),
        frameless=True,
        easy_drag=False,
        background_color="#0F172A"
    )
    _GLOBAL_WINDOW.events.shown += on_window_shown
    
    # Lancement avec Edge WebView2
    webview.start(debug=False)


if __name__ == "__main__":
    main()

