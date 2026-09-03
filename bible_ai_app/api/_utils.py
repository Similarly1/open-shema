"""
api/_utils.py - Utilitaires partagés entre tous les Mixins de BibleAppApi.
Centralise les fonctions et constantes qui étaient dans webview_app.py pour
éviter les imports circulaires.
"""
import os
import re
import sys
import json
import base64
import logging
from typing import Dict, List, Any, Optional

logger = logging.getLogger(__name__)

# current_dir pointe vers bible_ai_app/
current_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


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

# ── Imports core ────────────────────────────────────────────────────────────
from core.bible_json_loader import BibleJsonLoader, extract_verse_text
from core.reference_parser import (
    get_french_book_name,
    resolve_book_input,
    parse_smart_book_input,
    BOOKS_OT, BOOKS_NT, BOOKS_DEUTERO, ALL_BOOKS, BOOK_MAPPING, strip_accents
)
from core.pericope_manager import PericopeManager
from core.commentary_loader import CommentaryLoader
from core.dictionary_manager import DictionaryManager
from core.original_languages_manager import OriginalLanguagesManager
from core.notes_manager import NotesManager
from core.config import (
    load_config, save_config,
    DEFAULT_NOTE_TITLE_SYSTEM_PROMPT, DEFAULT_NOTE_TAGS_SYSTEM_PROMPT
)
from core.sermons_manager import SermonsManager
from core.highlights_manager import HighlightsManager
from core.maps_manager import MapsManager
from gui.library_utils import load_books_metadata, save_books_metadata
from core.ai_session_manager import AISessionManager
from core.secrets_manager import migrate_secrets_from_config, load_secrets_into_config
from core.native_notifications import send_windows_toast

# ── Constantes ───────────────────────────────────────────────────────────────
BIBLES_REGISTRY_FILE = os.path.join(current_dir, "data", "bibles_registry.json")

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

# ── Fonctions utilitaires ─────────────────────────────────────────────────────

def strip_xml_tags(text: str) -> str:
    """Enlève toutes les balises XML/HTML et normalise les espaces."""
    if not text:
        return ""
    clean = re.sub(r'<note[^>]*>.*?</note>', '', text, flags=re.I)
    clean = re.sub(r'<[^>]+>', '', clean)
    clean = re.sub(r'\s+', ' ', clean).strip()
    return clean


def load_bibles_registry() -> Dict[str, Any]:
    """Charge le catalogue structuré des traductions bibliques (Bibliorama)."""
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

    if clean_upper in registry:
        return registry[clean_upper]

    for code, data in registry.items():
        if data.get("code", "").upper() == clean_upper:
            return data
        if (data.get("nom_officiel") or "").lower() == clean.lower():
            return data
        for alias in data.get("aliases", []):
            if alias.lower() == clean.lower() or alias.lower() == clean_norm:
                return data

    if len(clean_norm) >= 2:
        for code, data in registry.items():
            for alias in data.get("aliases", []):
                alias_norm = re.sub(r'[^\w\s]', '', alias.lower()).strip()
                if alias_norm == clean_norm:
                    return data

    return None


def get_cover_data_url(cover_path: Optional[str]) -> Optional[str]:
    """Convertit un chemin d'image de couverture local en Data URL Base64."""
    if not cover_path:
        return None
    sp = str(cover_path)
    if sp.startswith("data:image/") or sp.startswith("http://") or sp.startswith("https://"):
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
        ext = os.path.splitext(actual_path)[1].lower().replace('.', '')
        mime = 'image/jpeg' if ext in ['jpg', 'jpeg'] else (f'image/{ext}' if ext in ['png', 'webp', 'gif'] else 'image/jpeg')
        with open(actual_path, 'rb') as f:
            b64 = base64.b64encode(f.read()).decode('utf-8')
        return f"data:{mime};base64,{b64}"
    except Exception as e:
        logger.warning(f"Erreur encodage couverture data URL ({cover_path}): {e}")
        return None


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
        m = re.match(r'<w\s+strong="([^"]*)">\s*(.*?)\s*</w>', tok)
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
                parts = re.split(r'[\s\u00a0]*[-–—][\s\u00a0]*', raw_lem, maxsplit=1)
                if len(parts) > 1 and parts[1].strip():
                    lemmas.append(parts[0].strip())
                    translits.append(parts[1].strip())
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
                clean_w = w.strip(" ,;:.?!«»()\"''•—–")
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
