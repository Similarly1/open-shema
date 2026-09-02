"""
BibleReaderMixin - Extracted from BibleAppApi.
"""
import os
import sys
import logging
import json
import sqlite3
import traceback
import asyncio
import webview
import threading
import time
import shutil
from typing import Dict, List, Any, Optional

logger = logging.getLogger(__name__)
from api._utils import (
    current_dir, BibleJsonLoader, extract_verse_text,
    get_french_book_name, resolve_book_input, parse_smart_book_input,
    BOOKS_OT, BOOKS_NT, BOOKS_DEUTERO, ALL_BOOKS, BOOK_MAPPING, strip_accents,
    PericopeManager, CommentaryLoader, DictionaryManager, OriginalLanguagesManager,
    NotesManager, load_config, save_config,
    DEFAULT_NOTE_TITLE_SYSTEM_PROMPT, DEFAULT_NOTE_TAGS_SYSTEM_PROMPT,
    SermonsManager, HighlightsManager, MapsManager,
    load_books_metadata, save_books_metadata, AISessionManager,
    migrate_secrets_from_config, load_secrets_into_config, send_windows_toast,
    BIBLES_REGISTRY_FILE, BIBLE_CANONICAL_INFO,
    strip_xml_tags, load_bibles_registry, find_bible_registry_entry,
    get_cover_data_url, parse_reverse_interlinear_verse,
    _BACKUP_MANIFEST_VERSION, _BACKUP_COMPONENTS
)
current_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))



class BibleReaderMixin:
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
            
            full_title = meta.get("title") or (reg_entry.get("nom_officiel") if reg_entry else None) or default_title
            code = meta.get("version_code") or (reg_entry.get("code") if reg_entry else None) or default_code
            
            avail = BibleJsonLoader.get_available_books(folder) or BibleJsonLoader.get_available_books(raw_name)
            first_b = avail[0] if avail else "Gen"

            year_val = (reg_entry.get("annee") if reg_entry else None) or meta.get("year") or meta.get("annee") or ""

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
                "annee": str(year_val) if year_val else "",
                "year": str(year_val) if year_val else "",
                "editeur": (reg_entry.get("editeur") if reg_entry else "") or meta.get("author", ""),
                "comparaisons_suggerees": reg_entry.get("comparaisons_suggerees", []) if reg_entry else [],
                "cover_url": (reg_entry.get("cover_url") if reg_entry else "") or meta.get("cover_url", ""),
                "available_books": avail,
                "first_book": first_b
            }

        seen_folders = set()
        for name, meta in list(registry.items()):
            if meta.get("type") == "Bible" and meta.get("active", True):
                folder = meta.get("folder_name", name)
                if folder in seen_folders:
                    continue
                
                # Auto-extraction de secours si format SQLite présent sans dossier JSON ou dossier incomplet
                bible_dir = BibleJsonLoader.find_bible_dir_by_name(folder) or BibleJsonLoader.find_bible_dir_by_name(name)
                is_empty_or_missing = not bible_dir or not os.path.exists(bible_dir) or len([f for f in os.listdir(bible_dir) if f.endswith('.json')]) == 0
                
                if is_empty_or_missing:
                    f_path = meta.get("file_path")
                    if not f_path or not os.path.exists(f_path):
                        cand_sqlite = os.path.join(current_dir, "data", "bibles", f"bible_{folder.lower()}.sqlite")
                        cand_sqlite_alt = os.path.join(current_dir, "data", "bibles", f"bible_{folder.lower()}1910.sqlite")
                        cand_json = os.path.join(current_dir, "data", "bibles", f"{name.lower()}.json")
                        cand_json_alt = os.path.join(current_dir, "data", "bibles", f"bible_{folder.lower()}.json")
                        cand_json_ost = os.path.join(current_dir, "data", "bibles", f"bible-ostervald-1877.json")
                        for cand in [cand_sqlite, cand_sqlite_alt, cand_json, cand_json_alt, cand_json_ost]:
                            if os.path.exists(cand):
                                f_path = cand
                                break
                    
                    if f_path and os.path.exists(f_path):
                        is_sqlite = f_path.endswith(".sqlite")
                        if not is_sqlite:
                            try:
                                with open(f_path, "rb") as bf:
                                    if bf.read(16).startswith(b"SQLite format 3"):
                                        is_sqlite = True
                                        new_sql = os.path.splitext(f_path)[0] + ".sqlite"
                                        if not os.path.exists(new_sql):
                                            os.rename(f_path, new_sql)
                                            f_path = new_sql
                            except Exception:
                                pass

                        if is_sqlite:
                            try:
                                self._extract_sqlite_bible_to_json(f_path, folder or name, meta.get("title", name))
                            except Exception as e:
                                logger.error(f"Erreur auto-extraction Bible SQLite {name}: {e}")

                if BibleJsonLoader.find_bible_dir_by_name(folder) or BibleJsonLoader.find_bible_dir_by_name(name):
                    seen_folders.add(folder)
                    bibles.append(enrich_item(name, meta))
        
        # Si vide, fallback direct sur les dossiers JSON
        if not bibles:
            installed = BibleJsonLoader.list_installed_bibles()
            for b in installed:
                bibles.append(enrich_item(b.replace("_", " "), {}))

        return bibles

    def _extract_sqlite_bible_to_json(self, sqlite_path: str, abbr: str, title: str):
        """Extrait les 66 livres d'une Bible SQLite vers des fichiers JSON modulaires (ultra-rapide en mémoire)."""
        import sqlite3
        import time
        dest_json_dir = os.path.join(current_dir, "data", "bibles", abbr)
        os.makedirs(dest_json_dir, exist_ok=True)
        
        # Retry connection to bypass temporary file locks from Antivirus (Windows Defender)
        max_retries = 10
        for attempt in range(max_retries):
            try:
                conn = sqlite3.connect(sqlite_path)
                cur = conn.cursor()
                cur.execute("PRAGMA table_info(books)")
                b_cols = [r[1] for r in cur.fetchall()]
                ch_col = "chapters_count" if "chapters_count" in b_cols else ("total_chapters" if "total_chapters" in b_cols else "chapters")
                cur.execute(f"SELECT id, code, name, {ch_col} FROM books ORDER BY id")
                books_rows = cur.fetchall()
                break
            except sqlite3.OperationalError as e:
                if conn:
                    try:
                        conn.close()
                    except:
                        pass
                if attempt < max_retries - 1:
                    logger.warning(f"SQLite lock detected (attempt {attempt+1}), retrying in 500ms...")
                    time.sleep(0.5)
                else:
                    raise RuntimeError(f"Le fichier de la Bible est verrouillé par un autre processus (ex: Antivirus). {e}")
        
        cur.execute("PRAGMA table_info(verses)")
        v_cols = [r[1] for r in cur.fetchall()]
        has_strong = "text_strong" in v_cols
        
        # Récupération de tous les versets en une seule requête ultra-rapide
        if has_strong:
            cur.execute("SELECT book_id, chapter, verse, text_strong, text FROM verses ORDER BY book_id, chapter, verse")
        else:
            cur.execute("SELECT book_id, chapter, verse, NULL, text FROM verses ORDER BY book_id, chapter, verse")
        all_verses = cur.fetchall()
        conn.close()

        # Groupement en mémoire par book_id
        book_verses_map = {}
        for b_id, ch_num, v_num, txt_str, txt_clean in all_verses:
            if b_id not in book_verses_map:
                book_verses_map[b_id] = {}
            c_k = str(ch_num)
            v_k = str(v_num)
            if c_k not in book_verses_map[b_id]:
                book_verses_map[b_id][c_k] = {}
            val = txt_str if txt_str else txt_clean
            if val:
                val = val.replace("<p>", "").replace("</p>", "").strip()
            book_verses_map[b_id][c_k][v_k] = val
        
        for b_id, b_code, b_name, ch_cnt in books_rows:
            ch_map = book_verses_map.get(b_id, {})
            b_obj = {
                "id": b_id,
                "code": b_code,
                "name": b_name,
                "version": abbr,
                "version_fullname": title,
                "total_chapters": ch_cnt,
                "chapters": ch_map
            }
            out_json = os.path.join(dest_json_dir, f"{b_id:02d}_{b_code}_{b_name}.json")
            with open(out_json, "w", encoding="utf-8") as jf:
                json.dump(b_obj, jf, ensure_ascii=False, separators=(',', ':'))
        
        BibleJsonLoader.clear_cache()

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

    def parse_reference(self, raw_input: str) -> Dict[str, Any]:
        """Décode une saisie libre de passage biblique (ex: 'rm 8.9', 'Romains 8:9', 'romains', 'Jn 3:16', '1 Co 13', 'Genèse intro')."""
        if not raw_input or not str(raw_input).strip():
            return {"book": "Gen", "book_french": "Genèse", "chapter": 1, "verse": None}
            
        raw = str(raw_input).strip()
        low = raw.lower()

        # 0. Détection explicite de l'Introduction (ex: "intro genèse", "genèse intro", "introduction à la genèse")
        if "intro" in low or "introduction" in low or " ch 0" in low or " 0:0" in low or " 0" in low.split():
            clean_book = re.sub(r'\b(introduction|intro|à|la|le|au|livre|du|de|d|ch|chapitre|0)\b', ' ', low, flags=re.I).strip()
            clean_book = re.sub(r'[\s:]+', ' ', clean_book).strip()
            if clean_book:
                resolved_code = BOOK_MAPPING.get(strip_accents(clean_book))
                if not resolved_code:
                    m_num = re.match(r'^([1-4])\s*([a-z]+)$', strip_accents(clean_book))
                    if m_num:
                        resolved_code = BOOK_MAPPING.get(f"{m_num.group(1)} {m_num.group(2)}")
                if resolved_code:
                    return {
                        "book": resolved_code,
                        "book_french": get_french_book_name(resolved_code),
                        "chapter": 0,
                        "verse": 0,
                        "raw_verse": "0"
                    }

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

    def get_quick_passage_preview(self, passage_ref: str, bible_name: str = "LSG") -> Dict[str, Any]:
        """Retourne rapidement le texte des versets pour une infobulle au survol (sub-10ms)."""
        try:
            import re
            from core.passage_study_manager import PassageStudyManager, BibleJsonLoader, extract_verse_text
            bounds = PassageStudyManager.parse_passage_bounds(passage_ref)
            if not bounds:
                return {"success": False, "error": "Référence inconnue"}
            
            book_code = bounds["book_code"]
            start_ch = bounds["start_ch"]
            start_v = bounds["start_v"]
            end_ch = bounds["end_ch"]
            end_v = bounds["end_v"]
            french_book = bounds["french_book"]

            installed = BibleJsonLoader.list_installed_bibles()
            target_bible = bible_name if bible_name in installed else (installed[0] if installed else "LSG")
            b_data = BibleJsonLoader.load_book(target_bible, book_code)
            if not b_data:
                return {"success": False, "error": "Texte biblique introuvable"}

            chapters_dict = b_data.get("chapters", {})
            verses = []
            for ch_num in range(start_ch, end_ch + 1):
                ch_str = str(ch_num)
                if ch_str not in chapters_dict:
                    continue
                v_dict = chapters_dict[ch_str]
                sorted_v_keys = sorted(v_dict.keys(), key=lambda x: int(x) if x.isdigit() else 999)
                for vk in sorted_v_keys:
                    v_int = int(vk) if vk.isdigit() else 0
                    if ch_num == start_ch and v_int < start_v:
                        continue
                    if ch_num == end_ch and v_int > end_v:
                        continue
                    clean_txt = extract_verse_text(v_dict[vk])
                    clean_txt = re.sub(r'<[^>]+>', '', clean_txt).strip()
                    verses.append({"chapter": ch_num, "verse": vk, "text": clean_txt})

            disp = f"{french_book} {start_ch}:{start_v}" if start_ch == end_ch and start_v == end_v else (f"{french_book} {start_ch}:{start_v}–{end_v}" if start_ch == end_ch else f"{french_book} {start_ch}:{start_v} – {end_ch}:{end_v}")
            return {
                "success": True,
                "reference": disp,
                "bible_name": target_bible,
                "verses": verses
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

