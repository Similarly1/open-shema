import os
import sys
import re
import html
import json
import shutil
import zipfile
import datetime
import threading
import logging

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

from core.bible_json_loader import BibleJsonLoader, extract_verse_text
from core.reference_parser import (
    get_french_book_name,
    resolve_book_input,
    parse_smart_book_input,
    BOOKS_OT,
    BOOKS_NT,
    BOOKS_DEUTERO,
    ALL_BOOKS
)
from core.pericope_manager import PericopeManager
from core.commentary_loader import CommentaryLoader
from core.dictionary_manager import DictionaryManager
from core.original_languages_manager import OriginalLanguagesManager
from core.config import load_config, save_config
from core.notes_manager import NotesManager
from core.maps_manager import MapsManager
from gui.library_utils import load_books_metadata, save_books_metadata


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
                clean_w = w.strip(" ,;:.?!«»()\"'’")
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
            
    # 3. Correspondance partielle souple
    for code, data in registry.items():
        for alias in data.get("aliases", []):
            if alias.lower() in clean_norm or clean_norm in alias.lower():
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


class BibleAppApi:
    """
    API Bridge exposée au Frontend Webview JavaScript.
    Chaque méthode publique est directement invocable via window.pywebview.api.<nom_methode>(...).
    """

    def __init__(self):
        self.config = load_config()

    # =========================================================================
    # 1. LECTEUR BIBLIQUE
    # =========================================================================

    def get_installed_bibles(self) -> List[Dict[str, Any]]:
        """Retourne la liste des Bibles installées enrichie de la typologie Bibliorama (Familles & Suggestions)."""
        registry = load_books_metadata()
        bibles_ref = load_bibles_registry()
        bibles = []

        def enrich_item(raw_name: str, meta: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
            meta = meta or {}
            folder = meta.get("folder_name", raw_name)
            reg_entry = find_bible_registry_entry(raw_name, bibles_ref) or find_bible_registry_entry(folder, bibles_ref)
            
            default_title, default_code = BIBLE_CANONICAL_INFO.get(raw_name, (meta.get("title", raw_name), meta.get("version_code", raw_name)))
            
            full_title = (reg_entry.get("nom_officiel") if reg_entry else None) or (meta.get("title") if meta.get("title") and meta.get("title") != raw_name else default_title)
            code = (reg_entry.get("code") if reg_entry else None) or meta.get("version_code") or default_code
            
            return {
                "id": folder,
                "name": raw_name,
                "title": full_title,
                "author": meta.get("author", "") or (reg_entry.get("editeur") if reg_entry else ""),
                "version_code": code,
                "famille": reg_entry.get("famille", "Protestante") if reg_entry else "Famille Segond",
                "famille_badge_color": reg_entry.get("famille_badge_color", "#2563EB") if reg_entry else "#2563EB",
                "philosophie": reg_entry.get("philosophie", "") if reg_entry else "",
                "texte_base_at": reg_entry.get("texte_base_at", "") if reg_entry else "",
                "texte_base_nt": reg_entry.get("texte_base_nt", "") if reg_entry else "",
                "canon": reg_entry.get("canon", "") if reg_entry else "",
                "annee": reg_entry.get("annee", "") if reg_entry else "",
                "editeur": reg_entry.get("editeur", "") if reg_entry else "",
                "comparaisons_suggerees": reg_entry.get("comparaisons_suggerees", []) if reg_entry else [],
                "cover_url": (reg_entry.get("cover_url") if reg_entry else "") or meta.get("cover_url", "")
            }

        for name, meta in registry.items():
            if meta.get("type") == "Bible" and meta.get("active", True):
                folder = meta.get("folder_name", name)
                if BibleJsonLoader.find_bible_dir_by_name(folder) or BibleJsonLoader.find_bible_dir_by_name(name):
                    bibles.append(enrich_item(name, meta))
        
        # Si vide, fallback direct sur les dossiers JSON
        if not bibles:
            installed = BibleJsonLoader.list_installed_bibles()
            for b in installed:
                bibles.append(enrich_item(b.replace("_", " "), {}))

        return bibles

    def get_bible_registry(self) -> Dict[str, Any]:
        """Retourne le référentiel complet de classification des Bibles (Bibliorama)."""
        return load_bibles_registry()

    def get_comparative_suggestion(self, current_bible_name: str) -> Optional[Dict[str, Any]]:
        """Calcule automatiquement la meilleure version complémentaire installée pour la comparaison en double colonne."""
        installed = self.get_installed_bibles()
        if not installed or len(installed) < 2:
            return None
        
        reg = load_bibles_registry()
        current_entry = find_bible_registry_entry(current_bible_name, reg)
        current_famille = current_entry.get("famille", "") if current_entry else ""
        suggestions_codes = current_entry.get("comparaisons_suggerees", []) if current_entry else []
        
        installed_codes_map = {b.get("version_code", "").upper(): b for b in installed}
        
        # 1. Vérifier si l'une des versions explicitement suggérées est installée
        for code in suggestions_codes:
            code_up = code.upper()
            if code_up in installed_codes_map and installed_codes_map[code_up]["name"] != current_bible_name:
                return installed_codes_map[code_up]
        
        # 2. Sinon, trouver la première version installée d'une famille théologique différente
        for b in installed:
            if b["name"] != current_bible_name:
                b_fam = b.get("famille", "")
                if b_fam and b_fam != current_famille:
                    return b
        
        # 3. Fallback sur n'importe quelle autre version installée
        for b in installed:
            if b["name"] != current_bible_name:
                return b
                
        return None

    def get_books_list(self) -> List[Dict[str, Any]]:
        """Retourne la liste complète des livres bibliques."""
        books = []
        for name, code, ch_count in BOOKS_OT:
            books.append({
                "code": code,
                "name": name,
                "chapters": ch_count,
                "testament": "OT"
            })
        for name, code, ch_count in BOOKS_NT:
            books.append({
                "code": code,
                "name": name,
                "chapters": ch_count,
                "testament": "NT"
            })
        for name, code, ch_count in BOOKS_DEUTERO:
            books.append({
                "code": code,
                "name": name,
                "chapters": ch_count,
                "testament": "DEUTERO"
            })
        return books

    def get_chapter_data(self, bible_name: str, book_code: str, chapter: int, interlinear_version: str = "LSG") -> Dict[str, Any]:
        """Récupère les versets d'un chapitre, titre de péricope et enrichissement interlinéaire."""
        ch_int = int(chapter)
        book_data = BibleJsonLoader.load_book(bible_name, book_code)
        french_name = get_french_book_name(book_code)

        if not book_data or "chapters" not in book_data:
            bibles = BibleJsonLoader.list_installed_bibles()
            if bibles:
                bible_name = bibles[0]
                book_data = BibleJsonLoader.load_book(bible_name, book_code)

        if not book_data:
            return {
                "bible": bible_name,
                "book": book_code,
                "book_french": french_name,
                "chapter": ch_int,
                "pericope": f"CHAPITRE {ch_int}",
                "verses": []
            }

        chapters_dict = book_data.get("chapters", {})
        verses_dict = chapters_dict.get(str(ch_int), {})

        # Péricope
        sections = book_data.get("sections", {})
        pericope_title = sections.get(f"{ch_int}:1") or sections.get(f"{ch_int}") or f"CHAPITRE {ch_int}"

        verses_list = []
        sorted_verses = sorted(verses_dict.keys(), key=lambda x: int(x) if x.isdigit() else 999)
        
        # Pré-chargement de la version d'interlinéaire inversé
        interlinear_book_data = None
        target_inter = interlinear_version or "LSG"
        if target_inter != bible_name:
            interlinear_book_data = BibleJsonLoader.load_book(target_inter, book_code)
            if not interlinear_book_data and target_inter != "LSG":
                interlinear_book_data = BibleJsonLoader.load_book("LSG", book_code)
            if not interlinear_book_data and target_inter != "DARBY":
                interlinear_book_data = BibleJsonLoader.load_book("DARBY", book_code)

        # Pré-chargement des lieux géographiques mentionnés dans ce chapitre
        geo_places_by_verse = {}
        try:
            ch_places = MapsManager.get_places_for_chapter(book_code, ch_int)
            for p in ch_places:
                v_str_list = p.get("verses_in_chapter", "")
                if v_str_list:
                    for v_item in str(v_str_list).split(','):
                        v_item = v_item.strip()
                        if v_item.isdigit():
                            vn = int(v_item)
                            if vn not in geo_places_by_verse:
                                geo_places_by_verse[vn] = []
                            if not any(x["place_id"] == p["place_id"] for x in geo_places_by_verse[vn]):
                                geo_places_by_verse[vn].append({
                                    "place_id": p["place_id"],
                                    "name_fr": p["name_fr"],
                                    "place_type": p.get("place_type", "city"),
                                    "latitude": p["latitude"],
                                    "longitude": p["longitude"]
                                })
        except Exception as e:
            logger.warning(f"Erreur enrichissement géo pour {book_code} {ch_int}: {e}")

        for v_str in sorted_verses:
            v_raw = verses_dict[v_str]
            v_text = strip_xml_tags(extract_verse_text(v_raw))
            v_num = int(v_str) if v_str.isdigit() else v_str

            words_data = []

            # 1. Si la version courante est déjà balisée en Strongs (ex: LSG ou DARBY)
            if '<w' in v_raw and 'strong=' in v_raw:
                words_data = parse_reverse_interlinear_verse(v_raw)
            
            # 2. Sinon, récupérer le verset balisé depuis la version d'interlinéaire inversé (LSG ou DARBY)
            elif interlinear_book_data:
                inter_v_raw = interlinear_book_data.get("chapters", {}).get(str(ch_int), {}).get(str(v_str), "")
                if '<w' in inter_v_raw and 'strong=' in inter_v_raw:
                    words_data = parse_reverse_interlinear_verse(inter_v_raw)

            # 3. Fallback de découpage en tokens simples
            if not words_data:
                for token in v_text.split():
                    clean_tok = token.strip(" ,;:.?!«»()\"'’")
                    if clean_tok:
                        words_data.append({
                            "surface": token,
                            "orig": clean_tok,
                            "translit": "",
                            "lemma": clean_tok,
                            "strong": "",
                            "morph": "",
                            "lang": "fr"
                        })

            verses_list.append({
                "verse": v_num,
                "text": v_text,
                "words": words_data,
                "geo_places": geo_places_by_verse.get(v_num, [])
            })

        return {
            "bible": bible_name,
            "book": book_code,
            "book_french": french_name,
            "chapter": ch_int,
            "pericope": pericope_title,
            "verses": verses_list,
            "geo_places_count": len(geo_places_by_verse)
        }

    def get_commentaries(self, book_code: str, chapter: int, verse: int) -> List[Dict[str, Any]]:
        """Récupère instantanément tous les commentaires pour un verset donné en regroupant les sections par ouvrage."""
        ch_int = int(chapter)
        v_int = int(verse)
        res = CommentaryLoader.get_all_comments_for_passage(book_code, ch_int, v_int)
        
        grouped = {}
        for i, text in enumerate(res.get("documents", [])):
            meta = res["metadatas"][i] if i < len(res.get("metadatas", [])) else {}
            cid = meta.get("commentary_id", meta.get("name", "Commentaire"))
            cname = meta.get("name", "Commentaire")
            ref = meta.get("reference", f"{book_code} {ch_int}:{v_int}")
            
            if cid not in grouped:
                grouped[cid] = {
                    "author": cname,
                    "source": cname,
                    "reference": ref,
                    "texts": [text]
                }
            else:
                grouped[cid]["texts"].append(text)
                if ref not in grouped[cid]["reference"]:
                    grouped[cid]["reference"] += f" / {ref}"

        comments = []
        for cid, data in grouped.items():
            comments.append({
                "author": data["author"],
                "source": data["source"],
                "reference": data["reference"],
                "text": "\n\n---\n\n".join(data["texts"])
            })
        return comments

    def parse_reference(self, raw_input: str) -> Dict[str, Any]:
        """Décode une saisie libre de passage biblique (ex: 'rm 8.9', 'Romains 8:9', 'romains', 'Jn 3:16', '1 Co 13')."""
        if not raw_input or not str(raw_input).strip():
            return {"book": "Gen", "book_french": "Genèse", "chapter": 1, "verse": None}
            
        raw = str(raw_input).strip()
        parsed = parse_smart_book_input(raw)
        if parsed and parsed.get("code"):
            code = parsed["code"]
            french = parsed.get("book") or get_french_book_name(code)
            ch = int(parsed["chapter"]) if parsed.get("chapter") and str(parsed["chapter"]).isdigit() else 1
            verse_raw = str(parsed.get("verse")) if parsed.get("verse") else None
            verse = None
            if verse_raw:
                if verse_raw.isdigit():
                    verse = int(verse_raw)
                elif "-" in verse_raw and verse_raw.split("-")[0].isdigit():
                    verse = int(verse_raw.split("-")[0])
            return {
                "book": code,
                "book_french": french,
                "chapter": max(1, ch),
                "verse": verse,
                "raw_verse": verse_raw
            }
            
        resolved = resolve_book_input(raw)
        if resolved:
            code = "Rom" if resolved == "Romains" else resolved[:3]
            for c, fr in [(b[1], b[0]) for b in ALL_BOOKS]:
                if fr.lower() == resolved.lower() or c.lower() == resolved.lower():
                    code = c
                    french = fr
                    break
            else:
                french = resolved
            return {
                "book": code,
                "book_french": french,
                "chapter": 1,
                "verse": None
            }

        return {"book": "Gen", "book_french": "Genèse", "chapter": 1, "verse": None}

    def get_verse_preview(self, raw_reference: str, bible_name: str = None) -> Dict[str, Any]:
        """Extrait rapidement le texte d'un verset ou groupe de versets pour l'infobulle de survol."""
        if not raw_reference or not str(raw_reference).strip():
            return {"success": False, "error": "Référence vide"}

        try:
            parsed = self.parse_reference(raw_reference)
            if not parsed or not parsed.get("book"):
                return {"success": False, "error": "Référence non reconnue"}

            book_code = parsed["book"]
            book_french = parsed.get("book_french", get_french_book_name(book_code))
            chapter = parsed.get("chapter", 1)
            target_verse = parsed.get("verse")

            installed = BibleJsonLoader.list_installed_bibles()
            if not installed:
                return {"success": False, "error": "Aucune Bible installée"}

            # Priorité de sélection de version :
            # 1. Version demandée explicitement
            # 2. Segond 21 / Segond_21
            # 3. LSG, NBS, BDS
            # 4. Première installée
            chosen_bible = None
            if bible_name:
                candidates = [bible_name, bible_name.replace(' ', '_'), bible_name.replace('_', ' ')]
                for c in candidates:
                    if c in installed:
                        chosen_bible = c
                        break

            if not chosen_bible:
                for pref in ['Segond_21', 'Segond 21', 'LSG', 'NBS', 'BDS', 'SG21']:
                    if pref in installed:
                        chosen_bible = pref
                        break

            if not chosen_bible and installed:
                chosen_bible = installed[0]

            book_data = BibleJsonLoader.load_book(chosen_bible, book_code)
            if not book_data and installed:
                for b in installed:
                    book_data = BibleJsonLoader.load_book(b, book_code)
                    if book_data:
                        chosen_bible = b
                        break

            display_bible = chosen_bible.replace('_', ' ') if chosen_bible else 'Segond 21'

            if not book_data:
                return {"success": False, "error": "Livre non trouvé"}

            chapters_dict = book_data.get("chapters", {})
            verses_dict = chapters_dict.get(str(chapter), {})

            # Si un verset spécifique ou une plage est demandée
            if target_verse is not None:
                # Vérifier si c'est une plage (ex: 15-16 ou 6-7)
                m_range = re.search(r'[:.,\s](\d+)-(\d+)', str(raw_reference))
                if m_range:
                    start_v, end_v = int(m_range.group(1)), int(m_range.group(2))
                    range_texts = []
                    for v_idx in range(start_v, min(end_v + 1, start_v + 8)):
                        if str(v_idx) in verses_dict:
                            txt = strip_xml_tags(extract_verse_text(verses_dict[str(v_idx)]))
                            range_texts.append(f"<sup>{v_idx}</sup> {txt}")
                    if range_texts:
                        return {
                            "success": True,
                            "reference": f"{book_french} {chapter}:{start_v}-{end_v}",
                            "book": book_code,
                            "book_french": book_french,
                            "chapter": chapter,
                            "verse": f"{start_v}-{end_v}",
                            "text": " ".join(range_texts),
                            "bible": display_bible
                        }

                v_key = str(target_verse)
                if v_key in verses_dict:
                    v_raw = verses_dict[v_key]
                    v_text = strip_xml_tags(extract_verse_text(v_raw))
                    return {
                        "success": True,
                        "reference": f"{book_french} {chapter}:{target_verse}",
                        "book": book_code,
                        "book_french": book_french,
                        "chapter": chapter,
                        "verse": target_verse,
                        "text": v_text,
                        "bible": display_bible
                    }
                else:
                    first_k = next(iter(sorted(verses_dict.keys(), key=lambda x: int(x) if x.isdigit() else 999)), None)
                    if first_k:
                        v_raw = verses_dict[first_k]
                        v_text = strip_xml_tags(extract_verse_text(v_raw))
                        return {
                            "success": True,
                            "reference": f"{book_french} {chapter}:{first_k}",
                            "book": book_code,
                            "book_french": book_french,
                            "chapter": chapter,
                            "verse": int(first_k) if first_k.isdigit() else 1,
                            "text": v_text,
                            "bible": display_bible
                        }
            else:
                sorted_keys = sorted(verses_dict.keys(), key=lambda x: int(x) if x.isdigit() else 999)[:3]
                snippets = []
                for k in sorted_keys:
                    v_raw = verses_dict[k]
                    snippets.append(f"<sup>{k}</sup> {strip_xml_tags(extract_verse_text(v_raw))}")
                return {
                    "success": True,
                    "reference": f"{book_french} {chapter}",
                    "book": book_code,
                    "book_french": book_french,
                    "chapter": chapter,
                    "verse": 1,
                    "text": " ".join(snippets),
                    "bible": display_bible
                }

        except Exception as e:
            logger.exception(f"Erreur get_verse_preview pour {raw_reference}: {e}")
            return {"success": False, "error": str(e)}

    def ask_ai(self, question: str, book: str, chapter: int, verse: int) -> Dict[str, Any]:
        """Interroge l'assistant IA en injectant le contexte biblique, les commentaires et les notes personnelles."""
        self.config = load_config()
        french = get_french_book_name(book)
        ref = f"{french} {chapter}:{verse}"
        comms = self.get_commentaries(book, chapter, verse)
        comm_context = "\n".join([f"- [{c['author']}] {c['text'][:200]}..." for c in comms[:2]])
        
        # Contexte des notes personnelles
        notes_context = NotesManager.build_ai_notes_context(passage_ref=ref, question=question, config=self.config)
        
        prompt = (
            f"Passage d'étude : **{ref}**\n\n"
            f"Question de l'utilisateur : {question}\n\n"
            f"Contexte des commentaires disponibles :\n{comm_context or 'Aucun commentaire textuel direct.'}\n"
            f"{notes_context}"
            f"\nAnalyse exégétique synthétique :"
        )

        try:
            from ai.llm_client import LLMClient
            api_key = self.config.get("gemini_api_key", "")
            if api_key:
                client = LLMClient(api_key=api_key, model=self.config.get("chat_model", "gemini-3.7-flash"), provider="gemini")
                answer = client.ask_question(context=f"{comm_context}\n{notes_context}", question=question)
                return {"answer": answer}
            else:
                return {
                    "answer": f"**[Analyse pour {ref}]**\n\nCe passage souligne la structure théologique du texte. Vous pouvez consulter les commentaires de la barre latérale pour des détails verset par verset (Configurez votre clé API dans les Paramètres pour activer les réponses IA dynamiques)."
                }
        except Exception as e:
            return {
                "answer": f"**[Analyse pour {ref}]**\n\nCe passage souligne la structure théologique du texte. Vous pouvez consulter les commentaires de la barre latérale pour des détails verset par verset."
            }

    def synthesize_commentaries(self, book_code: str, chapter: int, verse_start: int, verse_end: Optional[int] = None, model: Optional[str] = None, *args, **kwargs) -> Dict[str, Any]:
        """Génère une synthèse exégétique comparative par IA de tous les commentaires d'une plage de versets."""
        from core.commentary_synthesizer import CommentarySynthesizer
        return CommentarySynthesizer.synthesize(
            book_code=book_code,
            chapter=chapter,
            verse_start=verse_start,
            verse_end=verse_end,
            model=model
        )

    def detect_language(self, text: str, meta_lang: Optional[str] = None) -> Dict[str, Any]:
        """Détecte la langue d'un extrait textuel."""
        from core.translation_manager import TranslationManager
        lang = TranslationManager.detect_language(text, meta_lang)
        return {"language": lang, "is_french": lang == "fr"}

    def get_cached_translation(self, item_type: str, item_id: str) -> Optional[Dict[str, Any]]:
        """Récupère une traduction déjà en cache SQLite si elle existe."""
        from core.translation_manager import TranslationManager
        return TranslationManager.get_translation(item_type=item_type, item_id=item_id, target_lang="fr")

    def translate_text(self, text: str, item_type: str = "", item_id: str = "", model: Optional[str] = None) -> Dict[str, Any]:
        """Traduit un texte spécifique (commentaire, dictionnaire) en français via LLM sans synthétiser."""
        from core.translation_manager import TranslationManager
        from core.config import load_config
        config = load_config()
        try:
            # Vérifier si déjà en cache
            if item_type and item_id:
                cached = TranslationManager.get_translation(item_type=item_type, item_id=item_id, target_lang="fr")
                if cached and cached.get("translated_text"):
                    return {
                        "success": True,
                        "translated_text": cached["translated_text"],
                        "cached": True,
                        "model_used": cached.get("model_used", "Cache")
                    }

            clean_model = model or config.get("translation_model") or "gemini-3.5-flash-lite"
            translated = TranslationManager.translate_text(
                text=text,
                model=clean_model,
                config=config,
                item_type=item_type,
                item_id=item_id
            )
            return {
                "success": True,
                "translated_text": translated,
                "cached": False,
                "model_used": clean_model
            }
        except Exception as e:
            logger.error("Erreur traduction: %s", e)
    def translate_theology_toc(self, book_name: str, titles: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Traduit en français l'ensemble des titres de la table des matières d'un livre de théologie."""
        from core.translation_manager import TranslationManager
        from core.config import load_config
        config = load_config()

        if not titles:
            return {"success": False, "error": "Aucun titre fourni", "translated_titles": {}}

        cache_id = f"toc_{book_name}"
        cached = TranslationManager.get_translation(item_type="theology_toc", item_id=cache_id, target_lang="fr")
        if cached and cached.get("translated_text"):
            try:
                import json
                data = json.loads(cached["translated_text"])
                return {"success": True, "translated_titles": data, "cached": True}
            except Exception:
                pass

        try:
            lines = []
            for item in titles:
                cid = str(item.get("chapter_id", ""))
                title = str(item.get("title", "")).strip()
                if cid and title:
                    lines.append(f"{cid}::: {title}")

            prompt_text = (
                "Tu es un traducteur théologique expert. Traduis fidèlement chaque titre de chapitre ou de section en français soigné.\n"
                "Conserve impérativement le préfixe identifiant exact (ex: '1::: ' ou 'intro::: ') au tout début de chaque ligne.\n"
                "Renvoyez UNIQUEMENT la liste traduite ligne par ligne sans aucun commentaire ni bloc markdown :\n\n"
                + "\n".join(lines)
            )

            clean_model = config.get("translation_model") or "gemini-3.5-flash-lite"
            from ai.llm_client import LLMClient
            models_to_try = [clean_model]
            fallback_model = config.get("translation_fallback_model")
            if fallback_model and fallback_model != clean_model:
                models_to_try.append(fallback_model)

            res_text = None
            for cur_model in models_to_try:
                lower_m = cur_model.lower()
                if "/" in lower_m or "infomaniak" in lower_m or lower_m.startswith("qwen"):
                    token = config.get("infomaniak_token", "")
                    pid = config.get("infomaniak_product_id", "251")
                    client = LLMClient(api_key=token, model=cur_model, provider="infomaniak", product_id=pid)
                elif lower_m.startswith("mistral-") or lower_m.startswith("open-mistral-"):
                    api_key = config.get("mistral_api_key", "")
                    client = LLMClient(api_key=api_key, model=cur_model, provider="mistral")
                else:
                    api_key = config.get("gemini_api_key", "")
                    client = LLMClient(api_key=api_key, model=cur_model, provider="gemini")

                try:
                    out = client.chat(messages=[{"role": "user", "content": prompt_text}], system_prompt="Traducteur de titres théologiques.")
                    if out and not str(out).startswith("Erreur"):
                        res_text = out
                        break
                except Exception as e:
                    logger.warning("Échec traduction TOC avec %s: %s", cur_model, e)

            if not res_text:
                raise Exception("Échec de la traduction des titres par le modèle IA.")

            result_map = {}
            for line in res_text.splitlines():
                line = line.strip()
                if ":::" in line:
                    parts = line.split(":::", 1)
                    k = parts[0].strip().replace("-", "").replace("*", "").strip()
                    val = parts[1].strip()
                    if k and val:
                        result_map[k] = val

            import json
            TranslationManager.save_translation(
                item_type="theology_toc",
                item_id=cache_id,
                translated_text=json.dumps(result_map, ensure_ascii=False),
                model_used=clean_model,
                source_lang="auto",
                target_lang="fr",
                original_text="\n".join(lines)
            )

            return {"success": True, "translated_titles": result_map, "cached": False}
        except Exception as e:
            logger.error("Erreur translate_theology_toc: %s", e)
            return {"success": False, "error": str(e), "translated_titles": {}}

    def summarize_theology_chapter(self, book_name: str, chapter_id: str, chapter_title: str, text: str, word_count: Optional[int] = None, model: Optional[str] = None) -> Dict[str, Any]:
        """Génère un résumé synthétique, structuré et clair d'un chapitre de théologie via LLM."""
        from core.translation_manager import TranslationManager
        from core.config import load_config, DEFAULT_SUMMARY_SYSTEM_PROMPT
        config = load_config()

        cache_id = f"summary_{book_name}_{chapter_id}"
        cached = TranslationManager.get_translation(item_type="theology_summary", item_id=cache_id, target_lang="fr")
        if cached and cached.get("translated_text"):
            return {
                "success": True,
                "summary_markdown": cached["translated_text"],
                "cached": True,
                "model_used": cached.get("model_used", "Cache")
            }

        try:
            target_words = word_count or config.get("summary_word_count") or 300
            sys_prompt = config.get("summary_system_prompt") or DEFAULT_SUMMARY_SYSTEM_PROMPT
            clean_model = model or config.get("summary_model") or "gemini-3.7-flash"

            user_prompt = (
                f"Rédige un résumé structuré et soigné d'environ {target_words} mots du chapitre théologique suivant :\n\n"
                f"Ouvrage : {book_name}\n"
                f"Chapitre : {chapter_title} (ID: {chapter_id})\n\n"
                f"--- TEXTE DU CHAPITRE ---\n{text[:16000]}"
            )

            from ai.llm_client import LLMClient
            models_to_try = [clean_model]
            fallback_model = config.get("summary_fallback_model")
            if fallback_model and fallback_model != clean_model:
                models_to_try.append(fallback_model)

            summary_text = None
            used_model = clean_model
            last_err = None

            for cur_model in models_to_try:
                lower_m = cur_model.lower()
                if "/" in lower_m or "infomaniak" in lower_m or lower_m.startswith("qwen"):
                    token = config.get("infomaniak_token", "")
                    pid = config.get("infomaniak_product_id", "251")
                    client = LLMClient(api_key=token, model=cur_model, provider="infomaniak", product_id=pid)
                elif lower_m.startswith("mistral-") or lower_m.startswith("open-mistral-"):
                    api_key = config.get("mistral_api_key", "")
                    client = LLMClient(api_key=api_key, model=cur_model, provider="mistral")
                else:
                    api_key = config.get("gemini_api_key", "")
                    client = LLMClient(api_key=api_key, model=cur_model, provider="gemini")

                try:
                    out = client.chat(messages=[{"role": "user", "content": user_prompt}], system_prompt=sys_prompt)
                    if out and not str(out).startswith("Erreur"):
                        summary_text = out.strip()
                        used_model = cur_model
                        break
                    else:
                        last_err = out
                except Exception as e:
                    last_err = str(e)
                    logger.warning("Échec résumé chapitre avec %s: %s", cur_model, e)

            if not summary_text:
                raise Exception(f"Échec de la génération du résumé ({used_model}) : {last_err}")

            if summary_text.startswith("```markdown") and summary_text.endswith("```"):
                summary_text = summary_text[11:-3].strip()
            elif summary_text.startswith("```") and summary_text.endswith("```"):
                summary_text = summary_text[3:-3].strip()

            TranslationManager.save_translation(
                item_type="theology_summary",
                item_id=cache_id,
                translated_text=summary_text,
                model_used=used_model,
                source_lang="auto",
                target_lang="fr",
                original_text=text[:1000]
            )

            return {
                "success": True,
                "summary_markdown": summary_text,
                "cached": False,
                "model_used": used_model
            }
        except Exception as e:
            logger.error("Erreur summarize_theology_chapter: %s", e)
            return {
                "success": False,
                "error": str(e),
                "summary_markdown": None
            }

    # =========================================================================
    # RECHERCHE GLOBALE
    # =========================================================================

    def search_all(self, query: str, corpus: str = "ALL", match_mode: str = "ALL_WORDS", source_type: str = "Tous") -> Dict[str, Any]:
        """Recherche plein-texte haute performance dans les Bibles et commentaires."""
        from core.search_engine import SearchEngine
        engine = SearchEngine.get_instance()
        
        results = []
        if source_type in ["Tous", "Bibles", "Bible"]:
            bible_res = engine.search_bibles(query, corpus=corpus, match_mode=match_mode, limit=150)
            for r in bible_res:
                r["type"] = "Bible"
                results.append(r)
                
        if source_type in ["Tous", "Commentaires", "Commentaire"]:
            comm_res = engine.search_commentaries(query, match_mode=match_mode, limit=80)
            for r in comm_res:
                r["type"] = "Commentaire"
                results.append(r)
                
        return {"count": len(results), "results": results[:150]}

    # =========================================================================
    # DICTIONNAIRES & LEXIQUE
    # =========================================================================

    def lookup_dictionary(self, word: str, strong_code: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Recherche une entrée dans les dictionnaires actifs."""
        return DictionaryManager.lookup(word, strong_code)

    def get_wikipedia_summary(self, query: str, exact_title: Optional[str] = None) -> Dict[str, Any]:
        """Récupère le résumé et les métadonnées Wikipédia pour un terme."""
        from core.wikipedia_client import WikipediaClient
        return WikipediaClient.get_summary(query, exact_title=exact_title)

    def get_wikipedia_extended(self, title: str) -> Dict[str, Any]:
        """Récupère le contenu détaillé étendu (5 à 10 paragraphes structurés) d'un article Wikipédia."""
        from core.wikipedia_client import WikipediaClient
        return WikipediaClient.get_extended_content(title)

    def polish_dictionary_article(self, dict_id: str, title: str, raw_text: str, model: Optional[str] = None, slug: Optional[str] = None) -> Dict[str, Any]:
        """Améliore et restructure une notice de dictionnaire ancien avec l'IA (Mistral 14B / Infomaniak)."""
        from core.dictionary_polisher import DictionaryPolisher
        target_model = model or self.config.get("infomaniak_polish_model") or "mistralai/Ministral-3-14B-Instruct-2512"
        success, result = DictionaryPolisher.polish_article(raw_text, title=title, model=target_model, config=self.config)
        if success:
            DictionaryPolisher.set_polished_entry(dict_id, slug or title, title, result, target_model, slug=slug)
            return {"success": True, "text": result, "model": target_model}
        else:
            return {"success": False, "error": result}

    # =========================================================================
    # GESTION DES NOTES PERSONNELLES (Markdown .md)
    # =========================================================================

    def get_notes_list(self) -> List[Dict[str, Any]]:
        """Charge toutes les notes personnelles sous forme de fichiers Markdown (.md)."""
        self.config = load_config()
        return NotesManager.list_notes(self.config)

    def save_note(self, *args, **kwargs) -> Dict[str, Any]:
        """Enregistre ou met à jour une note au format Markdown (.md)."""
        self.config = load_config()
        target_dir = NotesManager.get_notes_directory(self.config)
        note = {}
        if args and isinstance(args[0], dict):
            note = args[0]
        elif len(args) >= 2:
            note = {
                "title": args[0],
                "content": args[1],
                "reference": args[2] if len(args) > 2 else "",
                "tags": args[3] if len(args) > 3 else [],
                "id": args[4] if len(args) > 4 else None
            }
        elif kwargs:
            note = kwargs
        return NotesManager.save_note_file(note, target_dir)

    def delete_note(self, note_id: str) -> bool:
        """Supprime le fichier Markdown (.md) d'une note."""
        self.config = load_config()
        target_dir = NotesManager.get_notes_directory(self.config)
        return NotesManager.delete_note_file(note_id, target_dir)

    def get_notes_for_passage(self, book: str, chapter: int, verse: Optional[int] = None) -> List[Dict[str, Any]]:
        """Retourne les notes personnelles associées à un passage biblique."""
        self.config = load_config()
        french = get_french_book_name(book)
        return NotesManager.get_notes_for_passage(french, chapter, verse, config=self.config)

    def pick_notes_folder(self) -> Dict[str, Any]:
        """Ouvre un dialogue natif Windows pour choisir le dossier des notes Markdown."""
        win = get_active_window()
        if not win:
            return {"success": False, "error": "Fenêtre introuvable"}
        result = win.create_file_dialog(webview.FOLDER_DIALOG)
        if not result or len(result) == 0:
            return {"cancelled": True}
        folder_path = result[0]
        return {"success": True, "path": folder_path}

    def open_notes_folder(self) -> Dict[str, Any]:
        """Ouvre le dossier des notes dans l'explorateur de fichiers de l'ordinateur."""
        self.config = load_config()
        notes_dir = NotesManager.get_notes_directory(self.config)
        try:
            if os.name == 'nt':
                os.startfile(notes_dir)
            elif sys.platform == 'darwin':
                import subprocess
                subprocess.Popen(['open', notes_dir])
            else:
                import subprocess
                subprocess.Popen(['xdg-open', notes_dir])
            return {"success": True, "path": notes_dir}
        except Exception as e:
            return {"success": False, "error": str(e)}

    # =========================================================================
    # ASSISTANT D'ÉTUDE AVANCÉ
    # =========================================================================

    def ask_study_ai(self, question: str, mode: str = "exegesis", passage_ref: str = "", options: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Génère une étude théologique ou exégétique complète avec extraction multi-sources (Bibles, Commentaires, Dicos, Notes),
        options de modèle LLM, et pipeline RAG (Reranking Cross-Encoder CPU / LLM Curateur).
        """
        self.config = load_config()
        opts = options or {}
        
        selected_model = opts.get("model") or self.config.get("chat_model", "gemini-3.7-flash")
        depth_style = opts.get("depth", "academic")
        enable_rerank = opts.get("enable_reranking", True)
        enable_curator = opts.get("enable_curator", False)
        sources_cfg = opts.get("sources", {
            "bibles": True,
            "commentaries": True,
            "dictionaries": True,
            "notes": True
        })
        
        sources_used = []
        context_chunks = []
        
        # 1. Résolution et extraction du texte biblique (Bibles & Interlinéaire)
        if sources_cfg.get("bibles", True) and passage_ref:
            try:
                parsed = self.parse_reference(passage_ref)
                if parsed and parsed.get("book"):
                    b_code = parsed["book"]
                    ch_num = parsed.get("chapter") or 1
                    ch_data = self.get_chapter_data("LSG", b_code, ch_num)
                    if ch_data and ch_data.get("verses"):
                        v_target = parsed.get("verse")
                        v_end = parsed.get("verse_end") or v_target
                        verses_subset = ch_data["verses"]
                        if v_target:
                            verses_subset = [v for v in ch_data["verses"] if v["verse"] >= v_target and (not v_end or v["verse"] <= v_end)]
                            if not verses_subset:
                                verses_subset = ch_data["verses"][:5]
                        
                        v_lines = []
                        for v in verses_subset[:12]:
                            v_lines.append(f"v.{v['verse']} : {v.get('text', '')}")
                        
                        bible_text = "\n".join(v_lines)
                        context_chunks.append({
                            "id": f"bible_{passage_ref}",
                            "text": f"### Texte Biblique ({ch_data.get('book_french', b_code)} {ch_num}) :\n{bible_text}",
                            "metadata": {"type": "Bible", "name": "Bibles (LSG / Texte de base)", "ref": passage_ref}
                        })
                        sources_used.append(f"Bibles ({ch_data.get('book_french', b_code)} {ch_num})")
            except Exception as e:
                print(f"[ask_study_ai] Erreur extraction biblique : {e}")

        # 2. Extraction des commentaires bibliques
        if sources_cfg.get("commentaries", True) and passage_ref:
            try:
                parsed = self.parse_reference(passage_ref)
                if parsed and parsed.get("book"):
                    b_code = parsed["book"]
                    ch_num = parsed.get("chapter") or 1
                    v_num = parsed.get("verse") or 1
                    comms = self.get_commentaries(b_code, ch_num, v_num)
                    if comms:
                        comm_names = []
                        for c in comms[:4]:
                            author = c.get("author") or c.get("source") or "Commentaire"
                            comm_names.append(author)
                            context_chunks.append({
                                "id": f"comm_{author}",
                                "text": f"### Commentaire [{author}] sur {passage_ref} :\n{c.get('text', '')[:1000]}",
                                "metadata": {"type": "Commentaire", "name": author}
                            })
                        if comm_names:
                            sources_used.append(f"Commentaires ({', '.join(set(comm_names[:3]))})")
            except Exception as e:
                print(f"[ask_study_ai] Erreur extraction commentaires : {e}")

        # 3. Extraction des Dictionnaires & Lexique Strong
        if sources_cfg.get("dictionaries", True):
            try:
                from core.strong_lexicon import StrongLexicon
                from core.dictionary_manager import DictionaryManager
                
                # Chercher dans la question ou le passage des mots clés significatifs (>4 lettres)
                words = re.findall(r'[a-zA-ZÀ-ÿ]{4,}', question)
                dict_found = []
                for w in words[:3]:
                    res = DictionaryManager.lookup(w)
                    if res and res.get("matches"):
                        top_m = res["matches"][0]
                        dict_name = top_m.get("dict_name", "Dictionnaire")
                        dict_found.append(dict_name)
                        context_chunks.append({
                            "id": f"dict_{w}",
                            "text": f"### Entrée de Dictionnaire [{dict_name} : {res.get('title', w)}] :\n{top_m.get('preview', '')[:800]}",
                            "metadata": {"type": "Dictionnaire", "name": dict_name}
                        })
                if dict_found:
                    sources_used.append(f"Dictionnaires ({', '.join(set(dict_found))})")
            except Exception as e:
                print(f"[ask_study_ai] Erreur extraction dictionnaires : {e}")

        # 4. Extraction des notes personnelles (.md)
        if sources_cfg.get("notes", True):
            try:
                notes_text = NotesManager.build_ai_notes_context(passage_ref=passage_ref, question=question, config=self.config)
                if notes_text and notes_text.strip():
                    context_chunks.append({
                        "id": "user_notes",
                        "text": notes_text,
                        "metadata": {"type": "Notes", "name": "Notes personnelles (.md)"}
                    })
                    sources_used.append("Notes personnelles (.md)")
            except Exception as e:
                print(f"[ask_study_ai] Erreur extraction notes : {e}")

        # 5. Pipeline RAG : Reranking sémantique & Curation
        if enable_rerank and len(context_chunks) > 1:
            try:
                from core.reranker import LocalReranker
                reranker = LocalReranker.get_instance()
                context_chunks = reranker.rerank(query=f"{passage_ref} {question}", documents=context_chunks, top_k=6)
                sources_used.append("Reranking (BGE-M3)")
            except Exception as e:
                print(f"[ask_study_ai] Reranking bypass : {e}")

        # Assemblage du texte de contexte
        formatted_context_sections = []
        for chunk in context_chunks:
            t = chunk.get("text") if isinstance(chunk, dict) else str(chunk)
            if t:
                formatted_context_sections.append(t)
        
        assembled_context = "\n\n".join(formatted_context_sections)

        # Instructions du mode d'étude
        mode_instructions = {
            "exegesis": (
                "MODE D'ÉTUDE : EXÉGÈSE APPROFONDIE\n"
                "- Analyse structurelle et théologique verset par verset (chiasmes, parallélismes, syntaxe).\n"
                "- Théologie biblique, intertextualité (accomplissement christocentrique, Alliances) et cohérence canonique.\n"
                "- Rigueur académique, citations précises des termes et références."
            ),
            "historical": (
                "MODE D'ÉTUDE : CONTEXTE HISTORIQUE & CULTUREL\n"
                "- Auteur, destinataires, date et occasion de rédaction dans l'Antiquité.\n"
                "- Cadre socio-politique, coutumes du Proche-Orient ancien ou monde gréco-romain, données géographiques et archéologiques."
            ),
            "sermon": (
                "MODE D'ÉTUDE : PRÉPARATION DE PRÉDICATION / MESSAGE HOMILÉTIQUE\n"
                "- Titre accrocheur et Idée Maîtresse (Big Idea en une seule phrase forte).\n"
                "- Plan structuré en 2 ou 3 points d'exposition bien délimités avec illustrations contemporaines adaptées.\n"
                "- Applications concrètes et pastorales pour la foi et la vie quotidienne, suivies d'une conclusion/appel."
            ),
            "lexical": (
                "MODE D'ÉTUDE : ANALYSE LEXICALE (GREC & HÉBREU / STRONG)\n"
                "- Étude détaillée des termes pivots dans les langues originales (racines hébraïques/grecques, codes Strong, translittérations).\n"
                "- Étymologie, champ sémantique, occurrences majeures, usage dans la Septante (LXX) ou le Nouveau Testament et portée théologique."
            )
        }

        depth_instructions = {
            "academic": "STYLE : Académique, exhaustif, rigoureux, avec développement théologique soutenu.",
            "pastoral": "STYLE : Pastoral, équilibré, chaleureux, orienté vers la transmission, la prédication et l'édification.",
            "concise": "STYLE : Synthétique, direct, concis, sous forme de points clés et tableaux récapitulatifs."
        }

        specific_instruction = mode_instructions.get(mode, mode_instructions["exegesis"])
        specific_depth = depth_instructions.get(depth_style, depth_instructions["academic"])

        prompt = (
            f"Rôle : Assistant exégétique et théologique expert Logos.\n"
            f"{specific_instruction}\n"
            f"{specific_depth}\n\n"
            f"Passage ou sujet : **{passage_ref or 'Étude biblique générale'}**\n"
            f"Question / Demande : {question}\n\n"
            f"--- CORPUS DOCUMENTAIRE DISPONIBLE ---\n"
            f"{assembled_context or 'Aucun document textuel spécifique extrait.'}\n"
            f"--------------------------------------\n\n"
            f"Consignes de rédaction :\n"
            f"1. Utilise des titres de section Markdown clairs (### Titre).\n"
            f"2. Cite explicitement les documents et versets sources (**[Jean 1:1]**, **[Matthew Henry]**, etc.).\n"
            f"3. Rédige en français avec haute précision et clarté pédagogique."
        )

        try:
            from ai.llm_client import LLMClient
            # Résoudre le bon provider selon le modèle
            if "mistral" in selected_model.lower():
                provider = "mistral"
                api_key = self.config.get("mistral_api_key", "")
                product_id = None
            elif "infomaniak" in selected_model.lower() or "ministral" in selected_model.lower():
                provider = "infomaniak"
                api_key = self.config.get("infomaniak_token", "")
                product_id = self.config.get("infomaniak_product_id", "251")
            else:
                provider = "gemini"
                api_key = self.config.get("gemini_api_key", "")
                product_id = None

            if api_key:
                client = LLMClient(api_key=api_key, model=selected_model, provider=provider, product_id=product_id)
                answer = client.ask_question(context=assembled_context, question=question, system_prompt=f"{specific_instruction}\n{specific_depth}")
            else:
                # Fallback sur GeminiClient par défaut si disponible
                from ai.gemini_client import GeminiClient
                g_client = GeminiClient()
                answer = g_client.generate_response(prompt)

            return {
                "answer": answer,
                "sources_used": sources_used or ["Corpus biblique général"],
                "model_used": selected_model
            }
        except Exception as e:
            print(f"[ask_study_ai] Erreur LLM : {e}")
            return {
                "answer": f"### Analyse ({mode.capitalize()}) pour {passage_ref or 'votre étude'}\n\n**1. Synthèse du passage :**\nCe texte met en évidence la cohérence de l'alliance divine et la portée spirituelle du message biblique.\n\n**2. Éléments d'étude approfondie :**\nL'analyse des structures et des termes clés renforce la compréhension du dessein divin.\n\n**3. Application pratique :**\nUne lecture attentive permet d'en dégager des enseignements solides pour la méditation et l'enseignement.",
                "sources_used": sources_used or ["Corpus biblique général"],
                "model_used": selected_model
            }


    # =========================================================================
    # 2. GESTION DE LA BIBLIOTHÈQUE
    # =========================================================================

    def get_library_books(self) -> List[Dict[str, Any]]:
        """Retourne tous les ouvrages de la bibliothèque (Bibles, Théologie, Dictionnaires) avec leurs couvertures."""
        registry = load_books_metadata()
        books = []
        registered_dict_ids = set()

        for name, meta in registry.items():
            b = meta.copy()
            b["name"] = name
            cov_p = b.get("cover_path")
            data_url = get_cover_data_url(cov_p)
            b["cover_data_url"] = data_url
            if data_url:
                b["cover_url"] = data_url
            if b.get("type") == "Dictionnaire" or b.get("dict_id"):
                registered_dict_ids.add(b.get("dict_id") or b.get("name"))
            books.append(b)

        # Intégrer également tous les dictionnaires enregistrés dans DictionaryManager
        dict_registry = DictionaryManager.get_all_dictionaries()
        covers_dir = os.path.join(current_dir, "data", "covers")
        
        for d in dict_registry:
            d_id = d.get("id")
            d_name = d.get("name")
            
            # Vérifier si déjà présent dans books
            matched_book = next((b for b in books if b.get("dict_id") == d_id or b.get("name") == d_name or b.get("title") == d_name), None)
            if matched_book:
                matched_book["dict_id"] = d_id
                matched_book["type"] = "Dictionnaire"
                matched_book["articles_count"] = d.get("count", 0)
                matched_book["active"] = d.get("enabled", True)
            else:
                # Chercher une couverture automatique dans data/covers/
                cov_path = None
                if os.path.exists(covers_dir):
                    for fn in os.listdir(covers_dir):
                        fn_l = fn.lower()
                        if (d_id in fn_l) or ("calmet" in d_id and "calmet" in fn_l) or ("vigo" in d_id and "vigo" in fn_l) or ("nouveau" in d_id and "nouveau" in fn_l):
                            cov_path = os.path.join(covers_dir, fn)
                            break
                
                author_name = "Dom Calmet" if d_id == "calmet" else ("F. Vigouroux" if d_id == "vigouroux" else ("Anatole Bailly" if d_id == "bailly" else ("James Strong" if d_id == "strong" else "Collectif")))
                
                books.append({
                    "name": d_name,
                    "title": d_name,
                    "dict_id": d_id,
                    "author": author_name,
                    "type": "Dictionnaire",
                    "description": f"Dictionnaire biblique comprenant {d.get('count', 0):,} articles et définitions.".replace(",", " "),
                    "chapters_count": 0,
                    "articles_count": d.get("count", 0),
                    "active": d.get("enabled", True),
                    "cover_path": cov_path,
                    "cover_data_url": get_cover_data_url(cov_path) if cov_path else None,
                    "format": "dict"
                })

        return books

    def get_cover_image_data(self, cover_path: str) -> Dict[str, Any]:
        """Retourne la Data URL Base64 d'une couverture pour le frontend."""
        data_url = get_cover_data_url(cover_path)
        return {"success": bool(data_url), "data_url": data_url}

    def toggle_book(self, book_name: str, active: bool) -> bool:
        """Active ou désactive un ouvrage ou dictionnaire."""
        # 1. Vérifier si c'est un dictionnaire dans DictionaryManager
        dict_reg = DictionaryManager.load_registry()
        for d in dict_reg:
            if d.get("name") == book_name or d.get("id") == book_name:
                d["enabled"] = bool(active)
                DictionaryManager.save_registry(dict_reg)
                break

        registry = load_books_metadata()
        if book_name in registry:
            registry[book_name]["active"] = bool(active)
            save_books_metadata(registry)
            return True
        return True

    def delete_book(self, book_name: str) -> bool:
        """Supprime définitivement un ouvrage."""
        registry = load_books_metadata()
        if book_name in registry:
            info = registry[book_name]
            folder_name = info.get("folder_name", book_name.replace(" ", "_"))
            json_dir = os.path.join(current_dir, "data", "bibles", folder_name)
            if os.path.exists(json_dir):
                try:
                    shutil.rmtree(json_dir)
                except Exception:
                    pass
            BibleJsonLoader.clear_cache()
            del registry[book_name]
            save_books_metadata(registry)
            return True
        return False

    def update_book_metadata(self, book_name: str, new_meta: Dict[str, Any]) -> bool:
        """Met à jour les métadonnées d'un livre."""
        registry = load_books_metadata()
        if book_name in registry:
            registry[book_name].update(new_meta)
            save_books_metadata(registry)
            return True
        return False

    # =========================================================================
    # LECTEUR D'OUVRAGES DE THÉOLOGIE & ÉTUDES
    # =========================================================================

    def get_theology_books(self) -> List[Dict[str, Any]]:
        """Retourne tous les ouvrages de théologie indexés avec leurs métadonnées et couvertures."""
        import importlib
        import core.theology_reader_manager
        importlib.reload(core.theology_reader_manager)
        from core.theology_reader_manager import TheologyReaderManager
        return TheologyReaderManager.get_all_theology_books()

    def get_theology_book_toc(self, book_name: str) -> Dict[str, Any]:
        """Récupère la table des matières ordonnée d'un ouvrage de théologie."""
        import importlib
        import core.theology_reader_manager
        importlib.reload(core.theology_reader_manager)
        from core.theology_reader_manager import TheologyReaderManager
        return TheologyReaderManager.get_book_toc(book_name)

    def get_theology_chapter_content(self, book_name: str, chapter_id: int) -> Dict[str, Any]:
        """Récupère le contenu intégral d'un chapitre d'ouvrage de théologie."""
        import importlib
        import core.epub_loader
        import core.theology_reader_manager
        importlib.reload(core.epub_loader)
        importlib.reload(core.theology_reader_manager)
        from core.theology_reader_manager import TheologyReaderManager
        return TheologyReaderManager.get_chapter_content(book_name, chapter_id)

    def synthesize_theology_chapter(self, book_name: str, chapter_id: int, model: Optional[str] = None) -> Dict[str, Any]:
        """Génère une synthèse exégétique et théologique IA d'un chapitre."""
        import importlib
        import core.theology_reader_manager
        importlib.reload(core.theology_reader_manager)
        from core.theology_reader_manager import TheologyReaderManager
        self.config = load_config()
        return TheologyReaderManager.synthesize_chapter(book_name, chapter_id, model=model, config=self.config)

    def search_theology_books(self, query: str, book_name: Optional[str] = None) -> List[Dict[str, Any]]:
        """Recherche plein-texte dans les ouvrages de théologie."""
        import importlib
        import core.theology_reader_manager
        importlib.reload(core.theology_reader_manager)
        from core.theology_reader_manager import TheologyReaderManager
    def open_external_url(self, url: str) -> bool:
        """Ouvre une URL externe dans le navigateur par défaut du système."""
        import webbrowser
        try:
            if url and (url.startswith('http://') or url.startswith('https://') or url.startswith('mailto:')):
                webbrowser.open(url)
                return True
        except Exception as e:
            logger.error(f"[API] Erreur ouverture URL externe : {e}")
        return False

    def pick_import_file(self) -> Dict[str, Any]:
        """Ouvre une boîte de dialogue native pour sélectionner un fichier d'importation."""
        win = get_active_window()
        if not win:
            return {"success": False, "error": "Fenêtre introuvable"}
            
        file_types = ('Ouvrages supportés (*.epub;*.json;*.docx;*.md;*.txt;*.csv)', 'Tous les fichiers (*.*)')
        result = win.create_file_dialog(webview.OPEN_DIALOG, allow_multiple=False, file_types=file_types)
        
        if not result or len(result) == 0:
            return {"cancelled": True}
            
        file_path = result[0]
        return self.inspect_import_source(file_path)

    def pick_cover_image(self) -> Dict[str, Any]:
        """Ouvre une boîte de dialogue native pour sélectionner une image de couverture et la stocke de manière permanente."""
        win = get_active_window()
        if not win:
            return {"success": False, "error": "Fenêtre introuvable"}
            
        file_types = ('Images (*.jpg;*.jpeg;*.png;*.webp)', 'Tous les fichiers (*.*)')
        result = win.create_file_dialog(webview.OPEN_DIALOG, allow_multiple=False, file_types=file_types)
        
        if not result or len(result) == 0:
            return {"cancelled": True}
            
        src_path = result[0]
        try:
            import time, uuid
            covers_dir = os.path.join(current_dir, "data", "covers")
            os.makedirs(covers_dir, exist_ok=True)
            clean_base = re.sub(r'[^a-zA-Z0-9._-]', '_', os.path.basename(src_path))
            dest_filename = f"user_{uuid.uuid4().hex[:6]}_{clean_base}"
            dest_path = os.path.join(covers_dir, dest_filename)
            shutil.copy2(src_path, dest_path)
            data_url = get_cover_data_url(dest_path)
            return {"success": True, "cover_path": dest_path, "cover_data_url": data_url}
        except Exception as e:
            return {"success": False, "error": f"Erreur de copie de couverture : {e}"}

    def save_clipboard_cover(self, data_url: str, book_id: str = "cover") -> Dict[str, Any]:
        """Enregistre une image base64 collée depuis le presse-papier."""
        try:
            import base64, uuid, re
            if not data_url or not str(data_url).startswith("data:image/"):
                return {"success": False, "error": "Données d'image invalides"}
            
            header, encoded = data_url.split(",", 1)
            ext_match = re.search(r'data:image/([a-zA-Z0-9]+);', header)
            ext = ext_match.group(1).lower() if ext_match else "png"
            if ext == "jpeg": ext = "jpg"

            img_bytes = base64.b64decode(encoded)
            covers_dir = os.path.join(current_dir, "data", "covers")
            os.makedirs(covers_dir, exist_ok=True)
            clean_id = re.sub(r'[^a-zA-Z0-9._-]', '_', book_id or 'cover')
            dest_filename = f"clip_{uuid.uuid4().hex[:6]}_{clean_id}.{ext}"
            dest_path = os.path.join(covers_dir, dest_filename)

            with open(dest_path, "wb") as f:
                f.write(img_bytes)

            data_url_out = get_cover_data_url(dest_path)
            return {"success": True, "cover_path": dest_path, "cover_data_url": data_url_out}
        except Exception as e:
            return {"success": False, "error": f"Erreur enregistrement image collée : {e}"}

    def search_google_books_metadata(self, query: str, author: str = "", title: str = "", isbn: str = "") -> List[Dict[str, Any]]:
        """Recherche des métadonnées bibliographiques via Google Books et Open Library."""
        from core.book_metadata_client import BookMetadataClient
        api_key = self.config.get("google_books_api_key")
        return BookMetadataClient.search_books(query=query, author=author, title=title, isbn=isbn, api_key=api_key)

    def download_book_cover(self, cover_url: str, book_id: str) -> Optional[str]:
        """Télécharge une couverture depuis une URL et l'enregistre en local."""
        from core.book_metadata_client import BookMetadataClient
        return BookMetadataClient.download_cover(cover_url, book_id)

    def auto_classify_document_metadata(self, title: str, description: str, model: str = "gemini-2.5-flash-lite") -> Dict[str, Any]:
        """Classifie automatiquement l'ouvrage pour le RAG Tri-Flux via l'IA."""
        from core.book_classifier import BookClassifier
        return BookClassifier.classify_metadata(title, description, self.config, model=model)

    def inspect_import_source(self, file_path: str) -> Dict[str, Any]:
        """Inspecte un fichier d'importation et extrait les métadonnées et chapitres."""
        if not os.path.exists(file_path):
            return {"success": False, "error": "Fichier introuvable"}
            
        ext = os.path.splitext(file_path)[1].lower()
        file_size = os.path.getsize(file_path)
        file_name = os.path.basename(file_path)
        file_base = os.path.splitext(file_name)[0]
        
        info = {}
        if ext == '.epub':
            from core.epub_loader import EpubLoader
            try:
                info = EpubLoader.inspect_epub(file_path)
                if info.get("cover_path"):
                    info["cover_data_url"] = get_cover_data_url(info["cover_path"])
            except Exception as e:
                return {"success": False, "error": f"Erreur inspection EPUB : {e}"}
                
        elif ext in ['.md', '.txt']:
            try:
                with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
                    lines = [l.strip() for l in f.readlines() if l.strip()]
                
                title = file_base
                author = ""
                chapters = []
                current_ch_title = ""
                current_ch_lines = []

                for l in lines:
                    if l.startswith('# '):
                        if not title or title == file_base:
                            title = l.lstrip('# ').strip()
                        else:
                            if current_ch_title:
                                chapters.append({"title": current_ch_title, "include": True, "size": len(" ".join(current_ch_lines))})
                            current_ch_title = l.lstrip('# ').strip()
                            current_ch_lines = []
                    elif l.startswith('## '):
                        if current_ch_title:
                            chapters.append({"title": current_ch_title, "include": True, "size": len(" ".join(current_ch_lines))})
                        current_ch_title = l.lstrip('# ').strip()
                        current_ch_lines = []
                    elif l.lower().startswith('auteur:') or l.lower().startswith('par '):
                        author = l.split(':', 1)[-1].strip() if ':' in l else l[4:].strip()
                    else:
                        current_ch_lines.append(l)

                if current_ch_title:
                    chapters.append({"title": current_ch_title, "include": True, "size": len(" ".join(current_ch_lines))})
                elif not chapters:
                    chapters.append({"title": title or "Document", "include": True, "size": len(" ".join(lines))})

                info = {"title": title, "author": author, "chapters": chapters}
            except Exception as e:
                info = {"title": file_base, "chapters": [{"title": file_base, "include": True, "size": 0}]}

        elif ext == '.docx':
            info = {"title": file_base, "chapters": [{"title": file_base, "include": True, "size": 0}]}
            
        elif ext in ['.json', '.csv']:
            info = {"title": file_base, "chapters": []}
        else:
            info = {"title": file_base, "chapters": []}

        # Détection automatique de Bible et enrichissement depuis bibles_registry.json
        raw_title = info.get("title", "")
        reg_bibles = load_bibles_registry()
        reg_match = (
            find_bible_registry_entry(raw_title, reg_bibles) or 
            find_bible_registry_entry(file_base, reg_bibles) or 
            find_bible_registry_entry(file_name, reg_bibles)
        )
        
        is_bible_kw = (
            any(kw in raw_title.lower() for kw in ["bible", "sainte bible", "ancien testament", "nouveau testament", "evangile"]) or 
            any(kw in file_base.lower() for kw in ["bible", "sainte bible", "nt_", "at_"])
        )
        biblical_chapters_count = sum(1 for c in info.get("chapters", []) if c.get("book_code") is not None)
        is_bible_struct = len(info.get("chapters", [])) >= 20 and biblical_chapters_count >= 15
        
        is_bible = reg_match is not None or is_bible_kw or is_bible_struct

        if is_bible:
            info["type"] = "Bible"
            info["is_bible"] = True
            
            # Pas de vectorisation RAG pour les Bibles
            for c in info.get("chapters", []):
                c["include"] = False
                
            if reg_match:
                info["short_id"] = reg_match.get("code") or file_base.upper()[:6]
                info["title"] = reg_match.get("nom_officiel") or info.get("title")
                info["author"] = reg_match.get("editeur") or reg_match.get("auteur") or info.get("author")
                info["year"] = str(reg_match.get("annee", "")) or str(info.get("year", ""))
                info["description"] = reg_match.get("description") or info.get("description")
                info["famille"] = reg_match.get("famille")
                info["famille_badge_color"] = reg_match.get("famille_badge_color")
                if not info.get("cover_data_url") and reg_match.get("cover_url"):
                    info["cover_data_url"] = reg_match.get("cover_url")
                    info["cover_url"] = reg_match.get("cover_url")
            else:
                clean_id = re.sub(r'[^a-zA-Z0-9]', '', file_base).upper()[:8]
                if "BIBLE" in clean_id and len(clean_id) > 5:
                    clean_id = clean_id.replace("BIBLE", "")
                info["short_id"] = clean_id or file_base.upper()[:6]

        return {
            "success": True,
            "format": ext.lstrip('.'),
            "file_path": file_path,
            "file_name": file_name,
            "file_size": file_size,
            "info": info
        }

    def execute_document_import(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Exécute l'importation complète et l'indexation RAG d'un ouvrage (ou conversion directe de Bible)."""
        name = payload.get("name", "").strip()
        if not name:
            return {"success": False, "error": "Identifiant obligatoire."}
            
        edit_mode = payload.get("edit_mode", False)
        old_name = payload.get("old_name", name)
        
        raw_cover = payload.get("cover_path")
        final_cover_path = raw_cover

        # Traitement de la couverture : enregistrement permanent
        if raw_cover and str(raw_cover).startswith("data:image/"):
            try:
                import base64
                header, b64_data = raw_cover.split(",", 1)
                img_data = base64.b64decode(b64_data)
                covers_dir = os.path.join(current_dir, "data", "covers")
                os.makedirs(covers_dir, exist_ok=True)
                slug_name = re.sub(r'[^a-zA-Z0-9_-]', '_', name).strip('_')
                dest_path = os.path.join(covers_dir, f"{slug_name}.png")
                with open(dest_path, "wb") as f:
                    f.write(img_data)
                final_cover_path = dest_path
            except Exception as e:
                logger.warning(f"Erreur enregistrement Smart Cover: {e}")
        elif raw_cover and os.path.exists(raw_cover):
            covers_dir = os.path.abspath(os.path.join(current_dir, "data", "covers"))
            os.makedirs(covers_dir, exist_ok=True)
            if not os.path.abspath(raw_cover).startswith(covers_dir):
                slug_name = re.sub(r'[^a-zA-Z0-9_-]', '_', name).strip('_')
                ext = os.path.splitext(raw_cover)[1] or ".jpg"
                dest_path = os.path.join(covers_dir, f"{slug_name}{ext}")
                try:
                    shutil.copy2(raw_cover, dest_path)
                    final_cover_path = dest_path
                except Exception:
                    final_cover_path = raw_cover

        metadata = {
            "name": name,
            "title": payload.get("title", name),
            "author": payload.get("author", ""),
            "description": payload.get("description", ""),
            "year": payload.get("year", ""),
            "cover_path": final_cover_path,
            "type": payload.get("type", "Théologie"),
            "corpus_scope": payload.get("corpus_scope", "GLOBAL"),
            "source_type": payload.get("source_type", "general"),
            "book_code": payload.get("book_code"),
            "embedding_model": payload.get("embedding_model", "bge_multilingual_gemma2 (Infomaniak)"),
            "active": True
        }
        
        registry = load_books_metadata()
        
        if edit_mode:
            if old_name != name and old_name in registry:
                del registry[old_name]
            if name in registry:
                registry[name].update(metadata)
            else:
                registry[name] = metadata
            save_books_metadata(registry)
            return {"success": True, "edited": True, "name": name}
            
        file_path = payload.get("file_path", "")
        if not file_path or not os.path.exists(file_path):
            registry[name] = metadata
            save_books_metadata(registry)
            return {"success": True, "name": name, "chunks_count": 0}
            
        ext = os.path.splitext(file_path)[1].lower()
        
        # Cas 1 : Importation de Bible (Pas de vectorisation RAG !)
        if metadata.get("type") == "Bible":
            if ext == '.epub':
                from core.bible_epub_importer import BibleEpubImporter
                try:
                    b_name, b_meta = BibleEpubImporter.import_bible_epub(
                        file_path, 
                        custom_name=name, 
                        custom_metadata=metadata
                    )
                    return {"success": True, "name": b_name, "is_bible": True, "books_count": b_meta.get("total_books", 0), "chunks_count": 0}
                except Exception as e:
                    logger.error(f"Erreur importation Bible EPUB : {e}", exc_info=True)
                    return {"success": False, "error": f"Erreur importation Bible EPUB : {e}"}
            elif ext == '.json':
                try:
                    b_name, b_meta = BibleJsonLoader.import_single_bible_json(
                        file_path,
                        custom_name=name,
                        custom_metadata=metadata
                    )
                    return {"success": True, "name": b_name, "is_bible": True, "books_count": b_meta.get("total_books", 0), "chunks_count": 0}
                except Exception as e:
                    logger.error(f"Erreur importation Bible JSON : {e}", exc_info=True)
                    return {"success": False, "error": f"Erreur importation Bible JSON : {e}"}
            elif ext in ['.csv', '.tsv']:
                try:
                    b_name, b_meta = BibleJsonLoader.import_bible_csv(
                        file_path,
                        custom_name=name,
                        custom_metadata=metadata
                    )
                    return {"success": True, "name": b_name, "is_bible": True, "books_count": b_meta.get("total_books", 0), "chunks_count": 0}
                except Exception as e:
                    logger.error(f"Erreur importation Bible CSV : {e}", exc_info=True)
                    return {"success": False, "error": f"Erreur importation Bible CSV : {e}"}

        # Cas 2 : EPUB Standard Théologie / Commentaires / Ouvrages d'étude (Vectorisation RAG)
        if ext == '.epub':
            from core.epub_loader import EpubLoader
            from core.theology_reader_manager import TheologyReaderManager
            from core.task_manager import TaskManager
            import threading
            
            selected_chapters = payload.get("chapters", [])
            chunks = EpubLoader.extract_chapters_and_chunks(
                epub_path=file_path,
                selected_chapters=selected_chapters,
                custom_name=name,
                metadata=metadata
            )
            
            metadata["chapters_count"] = len([c for c in selected_chapters if c.get("include", True)])
            metadata["chunks_count"] = len(chunks)
            metadata["file_path"] = file_path
            registry[name] = metadata
            save_books_metadata(registry)
            TheologyReaderManager.invalidate_cache()
            
            enable_ai = self.config.get("enable_ai", True)
            if chunks and enable_ai:
                task_id = f"import_{name}"
                TaskManager.start_task(
                    task_id=task_id, 
                    title=metadata.get("title", name), 
                    task_type="rag_indexing",
                    total=len(chunks),
                    detail=f"Indexation vectorielle de {len(chunks)} fragments..."
                )
                
                def _async_index_worker():
                    try:
                        from core.database import VectorDB
                        db = VectorDB(api_keys=self.config)
                        def p_cb(pct, cur=0, tot=0):
                            TaskManager.update_progress(task_id, pct, current=cur, total=tot)
                        db.add_chunks(
                            chunks, 
                            embedding_model=metadata.get("embedding_model", "bge_multilingual_gemma2 (Infomaniak)"),
                            progress_callback=p_cb
                        )
                        TaskManager.complete_task(task_id, message=f"Indexation terminée ({len(chunks)} fragments)")
                        TheologyReaderManager.invalidate_cache()
                    except Exception as e:
                        logger.error(f"Erreur indexation vectorielle arrière-plan pour {name}: {e}", exc_info=True)
                        TaskManager.fail_task(task_id, str(e))

                threading.Thread(target=_async_index_worker, daemon=True).start()
                return {"success": True, "name": name, "chunks_count": len(chunks), "background_indexing": True, "task_id": task_id}

            return {"success": True, "name": name, "chunks_count": len(chunks), "background_indexing": False}

        # Cas 3 : Markdown (.md) et Fichiers Texte (.txt)
        elif ext in ['.md', '.txt']:
            from core.theology_reader_manager import TheologyReaderManager
            from core.task_manager import TaskManager
            import threading
            
            selected_chapters = payload.get("chapters", [])
            chunks = []
            try:
                with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
                    content = f.read()

                # Découpage basique en paragraphes / blocs pour RAG
                paragraphs = [p.strip() for p in content.split('\n\n') if p.strip()]
                for i, p in enumerate(paragraphs):
                    chunks.append({
                        "text": p,
                        "metadata": {
                            "book_name": name,
                            "title": metadata.get("title", name),
                            "author": metadata.get("author", ""),
                            "chunk_id": f"{name}_ch_{i}",
                            "type": metadata.get("type", "Théologie"),
                            "corpus_scope": metadata.get("corpus_scope", "GLOBAL"),
                            "source_type": metadata.get("source_type", "general")
                        }
                    })
            except Exception as e:
                logger.error(f"Erreur lecture MD/TXT: {e}")

            metadata["chapters_count"] = len(selected_chapters) or 1
            metadata["chunks_count"] = len(chunks)
            metadata["file_path"] = file_path
            registry[name] = metadata
            save_books_metadata(registry)
            TheologyReaderManager.invalidate_cache()

            enable_ai = self.config.get("enable_ai", True)
            if chunks and enable_ai:
                task_id = f"import_{name}"
                TaskManager.start_task(
                    task_id=task_id, 
                    title=metadata.get("title", name), 
                    task_type="rag_indexing",
                    total=len(chunks),
                    detail=f"Indexation vectorielle de {len(chunks)} fragments..."
                )
                
                def _async_index_md_worker():
                    try:
                        from core.database import VectorDB
                        db = VectorDB(api_keys=self.config)
                        def p_cb(pct, cur=0, tot=0):
                            TaskManager.update_progress(task_id, pct, current=cur, total=tot)
                        db.add_chunks(
                            chunks, 
                            embedding_model=metadata.get("embedding_model", "bge_multilingual_gemma2 (Infomaniak)"),
                            progress_callback=p_cb
                        )
                        TaskManager.complete_task(task_id, message=f"Indexation terminée ({len(chunks)} fragments)")
                        TheologyReaderManager.invalidate_cache()
                    except Exception as e:
                        logger.error(f"Erreur indexation vectorielle arrière-plan pour {name}: {e}", exc_info=True)
                        TaskManager.fail_task(task_id, str(e))

                threading.Thread(target=_async_index_md_worker, daemon=True).start()
                return {"success": True, "name": name, "chunks_count": len(chunks), "background_indexing": True, "task_id": task_id}

            return {"success": True, "name": name, "chunks_count": len(chunks), "background_indexing": False}
            
        # Cas 4 : Dictionnaire / Docx / CSV
        elif ext in ['.docx', '.csv']:
            res = DictionaryManager.import_dictionary(file_path)
            registry[name] = metadata
            save_books_metadata(registry)
            return {"success": True, "name": name, "dict_res": res}
            
        registry[name] = metadata
        save_books_metadata(registry)
        return {"success": True, "name": name}

    def get_background_tasks(self) -> List[Dict[str, Any]]:
        """Récupère la liste des tâches actives en arrière-plan."""
        from core.task_manager import TaskManager
        return TaskManager.get_all_tasks()

    def dismiss_background_task(self, task_id: str) -> Dict[str, Any]:
        """Supprime une tâche terminée ou fermée."""
        from core.task_manager import TaskManager
        TaskManager.dismiss_task(task_id)
        return {"success": True}

    # =========================================================================
    # 3. GESTION DES PARAMÈTRES
    # =========================================================================

    def get_settings(self) -> Dict[str, Any]:
        return load_config()

    def save_settings(self, new_config: Dict[str, Any]) -> bool:
        save_config(new_config)
        self.config = load_config()
        return True

    # =========================================================================
    # 4. STEPBIBLE & DICTIONNAIRES
    # =========================================================================

    def get_stepbible_status(self) -> Dict[str, Any]:
        return OriginalLanguagesManager.get_instance().get_stats()

    def reindex_stepbible(self) -> bool:
        mgr = OriginalLanguagesManager.get_instance()
        return mgr.download_and_import()

    def get_dictionaries(self) -> List[Dict[str, Any]]:
        dicts = DictionaryManager.get_all_dictionaries()
        covers_dir = os.path.join(current_dir, "data", "covers")
        for d in dicts:
            d_id = d.get("id", "").lower()
            d_name = d.get("name", "").lower()
            cov_path = None
            if os.path.exists(covers_dir):
                for fn in os.listdir(covers_dir):
                    fn_l = fn.lower()
                    if (d_id and d_id in fn_l) or ("nouveau" in d_id and "nouveau" in fn_l) or ("calmet" in d_id and "calmet" in fn_l) or ("vigo" in d_id and "vigo" in fn_l) or ("strong" in d_id and "strong" in fn_l) or ("bailly" in d_id and "bailly" in fn_l):
                        cov_path = os.path.join(covers_dir, fn)
                        break
            if cov_path:
                data_url = get_cover_data_url(cov_path)
                d["cover_path"] = cov_path
                d["cover_data_url"] = data_url
                d["cover_url"] = data_url
        return dicts

    def get_dictionary_headwords(self, dict_id: str, letter: Optional[str] = None, query: Optional[str] = None, limit: int = 300, offset: int = 0) -> Dict[str, Any]:
        return DictionaryManager.get_headwords(dict_id, letter=letter, query=query, limit=limit, offset=offset)

    def get_dictionary_entry(self, dict_id: str, slug: str, strong_code: Optional[str] = None) -> Dict[str, Any]:
        return DictionaryManager.get_entry_content(dict_id, slug, strong_code=strong_code)

    def save_dictionaries(self, dict_list: List[Dict[str, Any]]) -> bool:
        DictionaryManager.save_registry(dict_list)
        return True

    # =========================================================================
    # 5. SAUVEGARDE & RESTAURATION COMPLÈTE (ZIP)
    # =========================================================================

    def export_backup_zip(self) -> Dict[str, Any]:
        """Exporte l'ensemble des données dans un fichier ZIP sélectionné."""
        win = get_active_window()
        if not win:
            return {"success": False, "error": "Fenêtre introuvable"}
            
        now_str = datetime.datetime.now().strftime('%Y%m%d_%H%M')
        default_name = f"backup_bible_ai_{now_str}.zip"
        
        save_path = win.create_file_dialog(
            webview.SAVE_FILENAME_DIALOG,
            save_filename=default_name,
            file_types=('Archives ZIP (*.zip)', 'Tous les fichiers (*.*)')
        )
        if not save_path:
            return {"cancelled": True}
            
        if isinstance(save_path, (list, tuple)):
            save_path = save_path[0]

        data_dir = os.path.join(current_dir, "data")
        tmp_zip = save_path + ".tmp"

        try:
            manifest = {
                "version": _BACKUP_MANIFEST_VERSION,
                "created_at": datetime.datetime.now().isoformat(),
                "components": []
            }

            with zipfile.ZipFile(tmp_zip, "w", compression=zipfile.ZIP_DEFLATED, allowZip64=True) as zf:
                for folder_or_file, label in _BACKUP_COMPONENTS:
                    src = os.path.join(data_dir, folder_or_file)
                    if not os.path.exists(src):
                        continue

                    if os.path.isfile(src):
                        arcname = os.path.join("data", folder_or_file)
                        zf.write(src, arcname)
                        manifest["components"].append(folder_or_file)
                    else:
                        for root, _, files in os.walk(src):
                            for fname in files:
                                full = os.path.join(root, fname)
                                rel = os.path.relpath(full, data_dir)
                                zf.write(full, os.path.join("data", rel))
                        manifest["components"].append(folder_or_file)

                zf.writestr("backup_manifest.json", json.dumps(manifest, ensure_ascii=False, indent=2))

            if os.path.exists(save_path):
                os.remove(save_path)
            os.rename(tmp_zip, save_path)

            size_mb = os.path.getsize(save_path) / (1024 * 1024)
            return {"success": True, "path": save_path, "size_mb": round(size_mb, 1)}
        except Exception as e:
            if os.path.exists(tmp_zip):
                try: os.remove(tmp_zip)
                except OSError: pass
            return {"success": False, "error": str(e)}

    def import_backup_zip(self) -> Dict[str, Any]:
        """Restaure les données depuis un fichier ZIP."""
        win = get_active_window()
        if not win:
            return {"success": False, "error": "Fenêtre introuvable"}
            
        pick = win.create_file_dialog(
            webview.OPEN_DIALOG,
            allow_multiple=False,
            file_types=('Archives ZIP (*.zip)', 'Tous les fichiers (*.*)')
        )
        if not pick or len(pick) == 0:
            return {"cancelled": True}
            
        zip_path = pick[0]
        data_dir = os.path.join(current_dir, "data")

        try:
            with zipfile.ZipFile(zip_path, "r") as zf:
                if "backup_manifest.json" not in zf.namelist():
                    return {"success": False, "error": "Archive invalide (manifeste manquant)."}

                manifest = json.loads(zf.read("backup_manifest.json"))
                components = manifest.get("components", [])

                for component in components:
                    dest = os.path.join(data_dir, component)
                    if os.path.isdir(dest):
                        shutil.rmtree(dest, ignore_errors=True)
                    elif os.path.isfile(dest):
                        os.remove(dest)

                    prefix = f"data/{component}"
                    entries = [n for n in zf.namelist() if n.startswith(prefix)]
                    for entry in entries:
                        target = os.path.join(data_dir, os.path.relpath(entry, "data"))
                        if entry.endswith("/"):
                            os.makedirs(target, exist_ok=True)
                        else:
                            os.makedirs(os.path.dirname(target), exist_ok=True)
                            with zf.open(entry) as src_f, open(target, "wb") as dst_f:
                                shutil.copyfileobj(src_f, dst_f)

            return {"success": True}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def get_window_state(self):
        global _IS_MAXIMIZED
        return {"is_maximized": _IS_MAXIMIZED}

    def minimize_window(self):
        global _GLOBAL_WINDOW
        if _GLOBAL_WINDOW:
            try:
                _GLOBAL_WINDOW.minimize()
            except Exception as e:
                logger.warning(f"Erreur minimize: {e}")
        return {"success": True}

    def maximize_window(self):
        global _GLOBAL_WINDOW, _IS_MAXIMIZED, _RESTORE_BOUNDS
        if not _GLOBAL_WINDOW:
            return {"success": False}

        hwnd = None
        try:
            if hasattr(_GLOBAL_WINDOW, 'native') and _GLOBAL_WINDOW.native:
                hwnd = _GLOBAL_WINDOW.native.Handle.ToInt32()
        except Exception:
            pass

        if _IS_MAXIMIZED:
            # Restaurer à la taille fenêtrée
            _IS_MAXIMIZED = False
            rx, ry, rw, rh = _RESTORE_BOUNDS
            if hwnd:
                user32.SetWindowPos(hwnd, 0, rx, ry, rw, rh, 0x0040)
            else:
                try:
                    _GLOBAL_WINDOW.move(rx, ry)
                    _GLOBAL_WINDOW.resize(rw, rh)
                except Exception:
                    pass
        else:
            # Sauvegarder les dimensions actuelles avant agrandissement
            if hwnd:
                try:
                    curr_rect = RECT()
                    user32.GetWindowRect(hwnd, ctypes.byref(curr_rect))
                    w = curr_rect.right - curr_rect.left
                    h = curr_rect.bottom - curr_rect.top
                    if w > 600 and h > 400:
                        _RESTORE_BOUNDS = (curr_rect.left, curr_rect.top, w, h)
                except Exception:
                    pass

            # Agrandir pour occuper tout l'espace de travail (barre des tâches visible)
            wx, wy, ww, wh = get_work_area()
            _IS_MAXIMIZED = True
            if hwnd:
                user32.SetWindowPos(hwnd, 0, wx, wy, ww, wh, 0x0040)
            else:
                try:
                    _GLOBAL_WINDOW.move(wx, wy)
                    _GLOBAL_WINDOW.resize(ww, wh)
                except Exception:
                    pass
        return {"success": True, "is_maximized": _IS_MAXIMIZED}

    def toggle_fullscreen(self):
        global _GLOBAL_WINDOW
        if _GLOBAL_WINDOW:
            try:
                _GLOBAL_WINDOW.toggle_fullscreen()
            except Exception as e:
                logger.warning(f"Erreur toggle_fullscreen: {e}")
        return {"success": True}

    def close_window(self):
        global _GLOBAL_WINDOW
        if _GLOBAL_WINDOW:
            try:
                _GLOBAL_WINDOW.destroy()
            except Exception as e:
                logger.warning(f"Erreur à la fermeture: {e}")
        return {"success": True}

    # =========================================================================
    # 7. CARTES BIBLIQUES & GÉOGRAPHIE
    # =========================================================================

    def get_biblical_places(self, query: str = "", place_type: Optional[str] = None, limit: int = 150) -> List[Dict[str, Any]]:
        """Recherche des lieux bibliques avec filtre optionnel par type."""
        try:
            return MapsManager.search_places(query=query, place_type=place_type, limit=limit)
        except Exception as e:
            logger.error(f"Erreur API get_biblical_places: {e}")
            return []

    def get_chapter_places(self, book_code: str = "", chapter_num: int = 1) -> List[Dict[str, Any]]:
        """Retourne les lieux mentionnés dans un chapitre biblique."""
        try:
            return MapsManager.get_places_for_chapter(book_code=book_code, chapter_num=chapter_num)
        except Exception as e:
            logger.error(f"Erreur API get_chapter_places: {e}")
            return []

    def get_biblical_place_details(self, place_id: str = "") -> Optional[Dict[str, Any]]:
        """Détails complets d'un lieu avec ses versets."""
        try:
            return MapsManager.get_place_details(place_id=place_id)
        except Exception as e:
            logger.error(f"Erreur API get_biblical_place_details: {e}")
            return None

    def get_biblical_itineraries(self) -> List[Dict[str, Any]]:
        """Retourne les grands itinéraires bibliques enregistrés."""
        try:
            return MapsManager.get_all_itineraries()
        except Exception as e:
            logger.error(f"Erreur API get_biblical_itineraries: {e}")
            return []



# Helpers Win32 pour gestion fluide de l'espace de travail (WorkArea) sans bordure
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

_IS_MAXIMIZED = True
_RESTORE_BOUNDS = (80, 50, 1280, 800)


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
                global _IS_MAXIMIZED
                if _IS_MAXIMIZED:
                    return
                try:
                    orig_move(x, y)
                except Exception:
                    pass
            _GLOBAL_WINDOW.move = safe_move
    except Exception as e:
        logger.warning(f"Erreur initialisation agrandissement: {e}")


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

