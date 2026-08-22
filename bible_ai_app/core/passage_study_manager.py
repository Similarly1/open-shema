import os
import re
import json
import logging
import sqlite3
from typing import Dict, List, Any, Optional, Tuple

from core.reference_parser import (
    normalize_reference,
    get_standard_book_code,
    get_french_book_name,
    REVERSE_BOOK_MAPPING,
    BOOK_MAPPING
)
from core.pericope_manager import PericopeManager
from core.bible_json_loader import BibleJsonLoader, extract_verse_text, STD_TO_USFM
from core.original_languages_manager import OriginalLanguagesManager
from core.commentary_loader import CommentaryLoader
from core.commentary_synthesizer import CommentarySynthesizer
from core.dictionary_manager import DictionaryManager
from core.maps_manager import MapsManager
from core.notes_manager import NotesManager
from core.highlights_manager import HighlightsManager
from core.config import load_config
from ai.llm_client import LLMClient

logger = logging.getLogger(__name__)

class PassageStudyManager:
    """
    Gestionnaire central d'étude biblique pour un passage (Péricope ou plage de versets).
    Agrège les textes multi-traductions, le texte original intégral (Hébreu/Grec),
    l'analyse morphologique mot-à-mot, les commentaires historiques, le contexte
    encyclopédique, les lieux cartographiques et les synthèses exégétiques par IA.
    """

    @classmethod
    def parse_passage_bounds(cls, raw_input: str) -> Optional[Dict[str, Any]]:
        """
        Parse une référence biblique quelconque (ex: 'Ph 2:5-11', 'Romains 8:1-17', 'Genèse 22', 'Jean 3:16')
        et retourne un dictionnaire avec le livre standard, nom français, chapitres et versets de début et fin.
        """
        if not raw_input or not raw_input.strip():
            return None

        raw = raw_input.strip()

        # Nettoyage
        raw_clean = re.sub(r'–|—', '-', raw)

        # Motifs courants:
        # 1. Livre ch:v-v (ex: "Phil 2:5-11", "1 Co 13:1-13", "Genèse 1:1-31")
        # 2. Livre ch:v-ch:v (ex: "Genèse 1:1-2:3")
        # 3. Livre ch-ch (ex: "Romains 1-3")
        # 4. Livre ch:v (ex: "Jean 3:16")
        # 5. Livre ch (ex: "Psaume 23", "Romains 8")

        # Cas 2: Livre ch:v-ch:v
        m_cross = re.match(r'^([1-4]?\s*[^\W\d_]+(?:\s+[^\W\d_]+)*)\s*(\d+)[:.](\d+)\s*-\s*(\d+)[:.](\d+)$', raw_clean)
        if m_cross:
            b_raw, c1, v1, c2, v2 = m_cross.groups()
            b_code = get_standard_book_code(b_raw)
            return {
                "book_code": b_code,
                "french_book": get_french_book_name(b_code),
                "start_ch": int(c1),
                "start_v": int(v1),
                "end_ch": int(c2),
                "end_v": int(v2),
                "is_range": True,
                "raw_reference": raw
            }

        # Cas 1: Livre ch:v-v
        m_range = re.match(r'^([1-4]?\s*[^\W\d_]+(?:\s+[^\W\d_]+)*)\s*(\d+)[:.](\d+)\s*-\s*(\d+)$', raw_clean)
        if m_range:
            b_raw, c, v1, v2 = m_range.groups()
            b_code = get_standard_book_code(b_raw)
            return {
                "book_code": b_code,
                "french_book": get_french_book_name(b_code),
                "start_ch": int(c),
                "start_v": int(v1),
                "end_ch": int(c),
                "end_v": int(v2),
                "is_range": True,
                "raw_reference": raw
            }

        # Cas 3: Livre ch-ch
        m_ch_range = re.match(r'^([1-4]?\s*[^\W\d_]+(?:\s+[^\W\d_]+)*)\s*(\d+)\s*-\s*(\d+)$', raw_clean)
        if m_ch_range:
            b_raw, c1, c2 = m_ch_range.groups()
            b_code = get_standard_book_code(b_raw)
            return {
                "book_code": b_code,
                "french_book": get_french_book_name(b_code),
                "start_ch": int(c1),
                "start_v": 1,
                "end_ch": int(c2),
                "end_v": 999,
                "is_range": True,
                "raw_reference": raw
            }

        # Cas 4: Livre ch:v
        m_single_v = re.match(r'^([1-4]?\s*[^\W\d_]+(?:\s+[^\W\d_]+)*)\s*(\d+)[:.](\d+)$', raw_clean)
        if m_single_v:
            b_raw, c, v = m_single_v.groups()
            b_code = get_standard_book_code(b_raw)
            return {
                "book_code": b_code,
                "french_book": get_french_book_name(b_code),
                "start_ch": int(c),
                "start_v": int(v),
                "end_ch": int(c),
                "end_v": int(v),
                "is_range": False,
                "raw_reference": raw
            }

        # Cas 5: Livre ch
        m_ch = re.match(r'^([1-4]?\s*[^\W\d_]+(?:\s+[^\W\d_]+)*)\s*(\d+)$', raw_clean)
        if m_ch:
            b_raw, c = m_ch.groups()
            b_code = get_standard_book_code(b_raw)
            return {
                "book_code": b_code,
                "french_book": get_french_book_name(b_code),
                "start_ch": int(c),
                "start_v": 1,
                "end_ch": int(c),
                "end_v": 999,
                "is_range": True,
                "raw_reference": raw
            }

        # Fallback normalisation standard
        norm = normalize_reference(raw_clean)
        if norm and " " in norm:
            parts = norm.split(" ", 1)
            b_code = parts[0]
            ch_v = parts[1]
            if ":" in ch_v:
                cv_parts = ch_v.split(":")
                ch = int(cv_parts[0]) if cv_parts[0].isdigit() else 1
                v_part = cv_parts[1]
                if "-" in v_part:
                    v_sub = v_part.split("-")
                    v1 = int(v_sub[0]) if v_sub[0].isdigit() else 1
                    v2 = int(v_sub[1]) if len(v_sub) > 1 and v_sub[1].isdigit() else v1
                else:
                    v1 = int(v_part) if v_part.isdigit() else 1
                    v2 = v1
                return {
                    "book_code": b_code,
                    "french_book": get_french_book_name(b_code),
                    "start_ch": ch,
                    "start_v": v1,
                    "end_ch": ch,
                    "end_v": v2,
                    "is_range": (v1 != v2),
                    "raw_reference": raw
                }
            elif ch_v.isdigit():
                ch = int(ch_v)
                return {
                    "book_code": b_code,
                    "french_book": get_french_book_name(b_code),
                    "start_ch": ch,
                    "start_v": 1,
                    "end_ch": ch,
                    "end_v": 999,
                    "is_range": True,
                    "raw_reference": raw
                }

        return None

    @classmethod
    def get_passage_study_data(cls, passage_ref: str, bible_name: str = "LSG") -> Dict[str, Any]:
        """
        Génère l'ensemble complet des données d'étude pour un passage donné.
        """
        bounds = cls.parse_passage_bounds(passage_ref)
        if not bounds:
            return {
                "success": False,
                "error": f"Impossible d'analyser la référence biblique : '{passage_ref}'"
            }

        book_code = bounds["book_code"]
        start_ch = bounds["start_ch"]
        start_v = bounds["start_v"]
        end_ch = bounds["end_ch"]
        end_v = bounds["end_v"]
        french_book = bounds["french_book"]

        # 1. Résolution des informations de péricope
        pericope_info = PericopeManager.get_pericope_context(bible_name, book_code, start_ch, start_v)
        pericope_title = ""
        prev_pericope = None
        next_pericope = None

        if pericope_info:
            cur = pericope_info.get("current") or {}
            pericope_title = cur.get("title", "")
            prev_pericope = pericope_info.get("prev")
            next_pericope = pericope_info.get("next")
            # Si l'utilisateur a juste tapé un chapitre entier (v=1..999) et qu'une péricope commence au début, ajuster
            if start_v == 1 and end_v == 999 and cur.get("end_v"):
                end_ch = cur.get("end_ch", start_ch)
                end_v = cur.get("end_v", end_v)

        if not prev_pericope and start_ch > 1:
            prev_pericope = {
                "title": f"Chapitre {start_ch - 1}",
                "ref_range": f"{french_book} {start_ch - 1}"
            }
        if not next_pericope:
            next_pericope = {
                "title": f"Chapitre {end_ch + 1}",
                "ref_range": f"{french_book} {end_ch + 1}"
            }

        # Formater la référence officielle d'affichage
        if start_ch == end_ch:
            if start_v == end_v:
                display_ref = f"{french_book} {start_ch}:{start_v}"
            elif end_v >= 999:
                display_ref = f"{french_book} {start_ch}"
            else:
                display_ref = f"{french_book} {start_ch}:{start_v}–{end_v}"
        else:
            display_ref = f"{french_book} {start_ch}:{start_v} – {end_ch}:{end_v}"

        # 2. Textes bibliques multi-versions
        installed_bibles = BibleJsonLoader.list_installed_bibles()
        if bible_name not in installed_bibles and installed_bibles:
            main_bible = installed_bibles[0]
        else:
            main_bible = bible_name

        scripture_by_version = {}
        verse_keys = []

        for b_name in installed_bibles:
            b_data = BibleJsonLoader.load_book(b_name, book_code)
            if not b_data:
                continue

            chapters_dict = b_data.get("chapters", {})
            v_list = []

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

                    raw_txt = v_dict[vk]
                    clean_txt = extract_verse_text(raw_txt)
                    clean_txt = re.sub(r'<[^>]+>', '', clean_txt).strip()

                    v_key = f"{ch_num}:{vk}"
                    if v_key not in verse_keys:
                        verse_keys.append(v_key)

                    v_list.append({
                        "chapter": ch_num,
                        "verse": v_int if v_int > 0 else vk,
                        "key": v_key,
                        "text": clean_txt
                    })

            if v_list:
                scripture_by_version[b_name] = v_list

        main_verses = scripture_by_version.get(main_bible, [])
        if not main_verses and scripture_by_version:
            main_verses = next(iter(scripture_by_version.values()))

        # Corriger la limite max réelle si end_v était 999
        if main_verses and end_v == 999:
            last_v = main_verses[-1]["verse"]
            if isinstance(last_v, int):
                end_v = last_v
                if start_ch == end_ch:
                    display_ref = f"{french_book} {start_ch}:{start_v}–{end_v}" if start_v != end_v else f"{french_book} {start_ch}:{start_v}"

        # Matrice synoptique verset par verset
        synoptic_matrix = []
        for vk in verse_keys:
            ch_num, v_num = vk.split(":")
            row = {
                "key": vk,
                "chapter": int(ch_num),
                "verse": int(v_num) if v_num.isdigit() else v_num,
                "versions": {}
            }
            for b_name, v_entries in scripture_by_version.items():
                match = next((x["text"] for x in v_entries if x["key"] == vk), "")
                row["versions"][b_name] = match
            synoptic_matrix.append(row)

        # 3. TEXTE ORIGINAL INTÉGRAL (Hébreu Massorétique WLC ou Grec NA28/SBLGNT)
        orig_mgr = OriginalLanguagesManager.get_instance()
        original_data = cls._extract_full_original_passage(
            orig_mgr, book_code, start_ch, start_v, end_ch, end_v, main_verses
        )

        # 4. Commentaires exégétiques pour toute la plage
        commentaries_data = cls._extract_passage_commentaries(
            book_code, start_ch, start_v, end_ch, end_v, verse_keys
        )

        # 5. Dictionnaires, Lieux et Contexte Historique
        encyclopedia_data = cls._extract_encyclopedia_and_maps(
            book_code, start_ch, start_v, end_ch, end_v, main_verses, original_data.get("key_lemmas", [])
        )

        # 6. Notes et surlignages de l'utilisateur
        user_notes = cls._extract_user_notes(book_code, start_ch, start_v, end_ch, end_v)
        user_highlights = cls._extract_user_highlights(book_code, start_ch, start_v, end_ch, end_v, main_bible)

        return {
            "success": True,
            "reference": display_ref,
            "raw_reference": passage_ref,
            "book_code": book_code,
            "french_book": french_book,
            "start_ch": start_ch,
            "start_v": start_v,
            "end_ch": end_ch,
            "end_v": end_v,
            "pericope": {
                "title": pericope_title,
                "prev": prev_pericope,
                "next": next_pericope
            },
            "scripture": {
                "main_version": main_bible,
                "verses": main_verses,
                "available_versions": list(scripture_by_version.keys()),
                "by_version": scripture_by_version,
                "synoptic_matrix": synoptic_matrix
            },
            "original_language": original_data,
            "commentaries": commentaries_data,
            "encyclopedia": encyclopedia_data,
            "user_data": {
                "notes": user_notes,
                "highlights": user_highlights
            }
        }

    @classmethod
    def _extract_full_original_passage(
        cls,
        orig_mgr: OriginalLanguagesManager,
        book_code: str,
        start_ch: int,
        start_v: int,
        end_ch: int,
        end_v: int,
        main_verses: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Extrait l'intégralité du texte original (mot-à-mot avec morphologie et continu)
        sur l'ensemble de la plage de versets.
        """
        if not orig_mgr.is_installed():
            return {
                "available": False,
                "reason": "Base des langues originales non initialisée.",
                "language": "",
                "is_rtl": False,
                "continuous_text": "",
                "verses": [],
                "key_lemmas": []
            }

        b_usfm = STD_TO_USFM.get(book_code, book_code).upper()
        lexicon = orig_mgr._get_strong_lexicon()

        words_by_verse = []
        all_words = []
        lang_detected = "greek"
        is_rtl = False

        with sqlite3.connect(orig_mgr.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cur = conn.cursor()

            for ch_num in range(start_ch, end_ch + 1):
                # Trouver les versets correspondants
                cur.execute("""
                    SELECT DISTINCT verse FROM original_words
                    WHERE book_code = ? AND chapter = ?
                    ORDER BY verse ASC;
                """, (b_usfm, ch_num))
                v_rows = cur.fetchall()

                for vr in v_rows:
                    v_int = vr["verse"]
                    if ch_num == start_ch and v_int < start_v:
                        continue
                    if ch_num == end_ch and v_int > end_v:
                        continue

                    cur.execute("""
                        SELECT * FROM original_words
                        WHERE book_code = ? AND chapter = ? AND verse = ?
                        ORDER BY word_idx ASC;
                    """, (b_usfm, ch_num, v_int))
                    w_rows = cur.fetchall()

                    v_words = []
                    for r in w_rows:
                        strong = r["strong_code"] or ""
                        strong_entry = lexicon.get(strong)
                        if not strong_entry and len(strong) > 1:
                            prefix = strong[0]
                            num_match = re.search(r'\d+', strong)
                            if num_match:
                                num = int(num_match.group())
                                strong_entry = lexicon.get(f"{prefix}{num:04d}") or lexicon.get(f"{prefix}{num}")

                        strong_def = strong_entry.get("definition", "") if strong_entry else ""
                        lemma = r["lemma"] or ""
                        if (not lemma or len(lemma) <= 1) and strong_entry:
                            lemma = strong_entry.get("lemma", "") or lemma

                        r_lang = r["lang"] or "greek"
                        lang_detected = r_lang
                        if r_lang == "hebrew":
                            is_rtl = True

                        w_obj = {
                            "index": r["word_idx"],
                            "text": r["original_text"],
                            "transliteration": r["transliteration"],
                            "lemma": lemma,
                            "strong": strong,
                            "strong_def_fr": strong_def,
                            "morph_code": r["morph_code"],
                            "morph_desc_fr": r["morph_desc_fr"],
                            "gloss": r["gloss"],
                            "lang": r_lang
                        }
                        v_words.append(w_obj)
                        all_words.append(w_obj)

                    # Texte continu pour le verset
                    v_clean_text = " ".join([w["text"] for w in v_words])
                    v_translit = " ".join([w["transliteration"] for w in v_words if w["transliteration"]])

                    # Récupérer texte français de référence pour comparaison
                    fr_match = next((mv["text"] for mv in main_verses if mv.get("chapter") == ch_num and mv.get("verse") == v_int), "")

                    words_by_verse.append({
                        "chapter": ch_num,
                        "verse": v_int,
                        "key": f"{ch_num}:{v_int}",
                        "original_text": v_clean_text,
                        "transliteration": v_translit,
                        "french_text": fr_match,
                        "words": v_words
                    })

        # Assembler le texte continu complet du passage
        continuous_paragraphs = []
        for vv in words_by_verse:
            continuous_paragraphs.append(f"({vv['verse']}) {vv['original_text']}")
        full_continuous_text = " ".join(continuous_paragraphs)

        # Calcul des lemmes pivots / les plus fréquents du passage (hors particules ultra-courantes)
        stop_lemmas_greek = {"ὁ", "καί", "δέ", "ἐν", "εἰς", "αὐτός", "σύ", "ἐγώ", "ὅς", "οὐ", "μή", "γάρ", "ὅτι", "πρός", "διά", "ἐκ", "ἐπί"}
        stop_lemmas_hebrew = {"הַ", "וְ", "אֶת", "בְּ", "לְ", "מִן", "עַל", "אֲשֶׁר", "כִּי", "הוּא", "אֲנִי", "אַתָּה"}

        lemma_counts = {}
        for w in all_words:
            lem = w.get("lemma", "").strip()
            if not lem or len(lem) <= 1:
                continue
            if lem in stop_lemmas_greek or lem in stop_lemmas_hebrew:
                continue

            if lem not in lemma_counts:
                lemma_counts[lem] = {
                    "lemma": lem,
                    "strong": w.get("strong", ""),
                    "strong_def_fr": w.get("strong_def_fr", ""),
                    "transliteration": w.get("transliteration", ""),
                    "gloss": w.get("gloss", ""),
                    "count": 0,
                    "occurrences": []
                }
            lemma_counts[lem]["count"] += 1
            if len(lemma_counts[lem]["occurrences"]) < 5:
                lemma_counts[lem]["occurrences"].append(w.get("text", ""))

        sorted_lemmas = sorted(lemma_counts.values(), key=lambda x: x["count"], reverse=True)[:15]

        lang_name = "Hébreu biblique (Ancien Testament — WLC)" if lang_detected == "hebrew" else "Grec koinè (Nouveau Testament — NA28 / SBLGNT)"

        return {
            "available": True,
            "language": lang_name,
            "lang_code": lang_detected,
            "is_rtl": is_rtl,
            "continuous_text": full_continuous_text,
            "total_words_count": len(all_words),
            "verses": words_by_verse,
            "key_lemmas": sorted_lemmas
        }

    @classmethod
    def _extract_passage_commentaries(
        cls,
        book_code: str,
        start_ch: int,
        start_v: int,
        end_ch: int,
        end_v: int,
        verse_keys: List[str]
    ) -> Dict[str, Any]:
        """
        Extrait et structure l'ensemble des commentaires disponibles pour le passage.
        """
        all_authors = {}
        verses_comments = []

        for vk in verse_keys:
            ch_num, v_num = vk.split(":")
            ch_i = int(ch_num)
            v_i = int(v_num) if v_num.isdigit() else 1

            raw_res = CommentaryLoader.get_all_comments_for_passage(book_code, ch_i, v_i)
            v_entry = {
                "key": vk,
                "chapter": ch_i,
                "verse": v_i,
                "comments": []
            }

            for idx, text in enumerate(raw_res.get("documents", [])):
                meta = raw_res["metadatas"][idx] if idx < len(raw_res.get("metadatas", [])) else {}
                auth = meta.get("name", "Commentaire")
                cid = meta.get("commentary_id", auth)

                if auth not in all_authors:
                    all_authors[auth] = {
                        "author": auth,
                        "id": cid,
                        "source": auth,
                        "comments_by_verse": {}
                    }

                comm_item = {
                    "author": auth,
                    "source": auth,
                    "text": text,
                    "reference": meta.get("reference", f"{ch_i}:{v_i}")
                }
                v_entry["comments"].append(comm_item)
                all_authors[auth]["comments_by_verse"][vk] = text

            if v_entry["comments"]:
                verses_comments.append(v_entry)

        # Générer pour chaque auteur son flux de texte continu sur tout le passage
        author_summaries = []
        for auth_name, auth_data in all_authors.items():
            author_paragraphs = []
            for vk in verse_keys:
                if vk in auth_data["comments_by_verse"]:
                    txt = auth_data["comments_by_verse"][vk]
                    author_paragraphs.append(f"**Verset {vk}** : {txt}")

            full_author_text = "\n\n".join(author_paragraphs)
            author_summaries.append({
                "author": auth_name,
                "source": auth_data["source"],
                "verses_covered": len(auth_data["comments_by_verse"]),
                "full_text": full_author_text
            })

        return {
            "total_authors": len(all_authors),
            "authors_list": list(all_authors.keys()),
            "by_author": author_summaries,
            "by_verse": verses_comments
        }

    @classmethod
    def _extract_encyclopedia_and_maps(
        cls,
        book_code: str,
        start_ch: int,
        start_v: int,
        end_ch: int,
        end_v: int,
        main_verses: List[Dict[str, Any]],
        key_lemmas: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Détecte les entités historiques, géographiques et dictionnaires associés au passage.
        """
        full_fr_text = " ".join([v.get("text", "") for v in main_verses])

        # 1. Détection des lieux géographiques
        detected_places = []
        try:
            for ch_i in range(start_ch, end_ch + 1):
                ch_places = MapsManager.get_places_for_chapter(book_code, ch_i)
                for p in ch_places:
                    # Vérifier si le lieu est dans la plage de versets
                    p_verses = p.get("verses_in_chapter", "")
                    if not any(dp["place_id"] == p["place_id"] for dp in detected_places):
                        detected_places.append({
                            "place_id": p.get("place_id"),
                            "name": p.get("name_fr") or p.get("name_en"),
                            "latitude": p.get("latitude"),
                            "longitude": p.get("longitude"),
                            "place_type": p.get("place_type"),
                            "comment": p.get("comment", ""),
                            "found_in_chapter": ch_i
                        })
        except Exception as e:
            logger.warning("Erreur détection géographique : %s", e)

        # 2. Détection des entrées dictionnaires Vigouroux / Dom Calmet / Bailly
        dict_entries = []
        try:
            candidate_terms = []
            for lem in key_lemmas[:6]:
                gloss = lem.get("gloss", "")
                if gloss and len(gloss) > 3:
                    clean_gloss = gloss.split(";")[0].split(",")[0].strip()
                    if clean_gloss and clean_gloss not in candidate_terms:
                        candidate_terms.append(clean_gloss)

            # Extraire des noms propres du texte français (mots avec majuscules)
            words = full_fr_text.split()
            for w in words:
                clean_w = re.sub(r'[^\w\u00C0-\u017F]', '', w)
                if len(clean_w) > 3 and clean_w[0].isupper() and clean_w.lower() not in {"dans", "avec", "pour", "cette", "alors", "mais", "pourquoi", "ainsi", "comme"}:
                    if clean_w not in candidate_terms:
                        candidate_terms.append(clean_w)

            # Interroger le dictionnaire pour les candidats
            for term in candidate_terms[:6]:
                res = DictionaryManager.lookup(term)
                if res and res.get("matches"):
                    first_match = res["matches"][0]
                    content_str = first_match.get("content", "")
                    clean_snippet = re.sub(r'<[^>]+>', '', content_str)[:280].strip()
                    dict_entries.append({
                        "term": term,
                        "dictionary": first_match.get("dict_name", "Dictionnaire"),
                        "title": first_match.get("title", term),
                        "snippet": clean_snippet
                    })
        except Exception as e:
            logger.warning("Erreur recherche dictionnaires : %s", e)

        return {
            "places": detected_places,
            "dict_entries": dict_entries
        }

    @classmethod
    def _extract_user_notes(cls, book_code: str, start_ch: int, start_v: int, end_ch: int, end_v: int) -> List[Dict[str, Any]]:
        """Récupère les notes de l'utilisateur existantes sur le passage."""
        notes = []
        try:
            for ch in range(start_ch, end_ch + 1):
                ch_notes = NotesManager.get_notes_for_passage(book_code, ch)
                for n in ch_notes:
                    n_v = n.get("verse")
                    if n_v is not None:
                        if ch == start_ch and n_v < start_v:
                            continue
                        if ch == end_ch and n_v > end_v:
                            continue
                    notes.append(n)
        except Exception as e:
            logger.warning("Erreur extraction notes : %s", e)
        return notes

    @classmethod
    def _extract_user_highlights(cls, book_code: str, start_ch: int, start_v: int, end_ch: int, end_v: int, version: str) -> List[Dict[str, Any]]:
        """Récupère les surlignages actifs de l'utilisateur."""
        highlights = []
        try:
            for ch in range(start_ch, end_ch + 1):
                ch_hl = HighlightsManager.get_highlights_for_chapter(book_code, ch, version)
                for h in ch_hl:
                    v_start = h.get("verse_start", 0)
                    v_end = h.get("verse_end", v_start)
                    if ch == start_ch and v_end < start_v:
                        continue
                    if ch == end_ch and v_start > end_v:
                        continue
                    highlights.append(h)
        except Exception as e:
            logger.warning("Erreur extraction surlignages : %s", e)
        return highlights

    # =========================================================================
    # GÉNÉRATION D'INSIGHTS EXÉGÉTIQUES ET HOMILÉTIQUES PAR IA (SANS ÉMOJIS)
    # =========================================================================

    @classmethod
    def generate_passage_ai_insight(
        cls,
        passage_ref: str,
        insight_type: str,
        model: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Génère une analyse ciblée par IA pour le passage :
        - 'structure' : Structure littéraire, chiasmes, mouvements du texte
        - 'big_idea' : Thèse centrale, enjeu doctrinal et théologique
        - 'sermon_outline' : Plan homilétique en 3 points avec illustrations et applications
        - 'study_questions' : Questions inductives pour étude en groupe ou personnelle
        - 'synthesis' : Synthèse exégétique complète multi-commentateurs
        """
        study_data = cls.get_passage_study_data(passage_ref)
        if not study_data.get("success"):
            return study_data

        ref_str = study_data["reference"]
        main_verses = study_data["scripture"]["verses"]
        main_text_lines = [f"{v['chapter']}:{v['verse']} {v['text']}" for v in main_verses]
        main_text = "\n".join(main_text_lines)

        orig_info = study_data.get("original_language", {})
        orig_lang_name = orig_info.get("language", "")
        key_lemmas = orig_info.get("key_lemmas", [])
        lemmas_summary = ", ".join([f"{l['lemma']} ({l['strong']} : {l['gloss']})" for l in key_lemmas[:8]])

        comm_info = study_data.get("commentaries", {})
        comm_authors = comm_info.get("authors_list", [])
        comm_excerpts = []
        for a_sum in comm_info.get("by_author", [])[:3]:
            comm_excerpts.append(f"--- Commentaire de {a_sum['author']} ---\n{a_sum['full_text'][:1200]}")
        comms_text = "\n\n".join(comm_excerpts)

        # Prompts spécialisés selon le type d'insight demandé (aucun emoji dans les consignes ni dans la sortie)
        prompts = {
            "structure": f"""Vous êtes un érudit en analyse littéraire et exégèse biblique.
Analysez la structure littéraire formelle du passage biblique suivant : {ref_str}.

TEXTE DU PASSAGE :
{main_text}

LANGUE ORIGINALE : {orig_lang_name}
TERMES CLÉS : {lemmas_summary}

CONSIGNES STRICTES :
- N'utilisez AUCUN émoji dans votre réponse.
- Rédigez en français académique, clair et rigoureux.
- Identifiez les mouvements littéraires, parallélismes, chiasmes, inclusions et pivots logiques (conjonctions grecques/hébraïques).
- Présentez un découpage textuel verset par verset avec sous-titres descriptifs.
- Mettez en valeur la progression de la pensée de l'auteur biblique.""",

            "big_idea": f"""Vous êtes un professeur de théologie biblique et d'exégèse.
Dégagez l'idée maîtresse (Big Idea) et les enjeux doctrinaux fondamentaux du passage biblique suivant : {ref_str}.

TEXTE DU PASSAGE :
{main_text}

CONSIGNES STRICTES :
- N'utilisez AUCUN émoji dans votre réponse.
- Rédigez en français sobre et percutant.
- Formulez en UNE SEULE phrase directrice l'idée maîtresse du passage (la proposition théologique centrale que l'auteur communique).
- Développez ensuite en 2 ou 3 paragraphes denses :
  1. Le fondement textuel et la logique doctrinale.
  2. La portée canonique et christologique (comment ce texte s'articule avec l'ensemble des Écritures).
  3. L'enjeu existentiel et spirituel pour l'Église.""",

            "sermon_outline": f"""Vous êtes un pasteur et enseignant de théologie homilétique.
Élaborez un plan de prédication / enseignement rigoureux et captivant sur le passage biblique : {ref_str}.

TEXTE DU PASSAGE :
{main_text}

EXTRAITS DE COMMENTAIRES DE RÉFÉRENCE :
{comms_text}

CONSIGNES STRICTES :
- N'utilisez AUCUN émoji dans votre réponse.
- Proposez un titre fort et fidèle au texte.
- Présentez une Idée Maîtresse claire (Big Idea).
- Construisez un plan homilétique équilibré en 3 points majeurs, chacun ancré dans des versets précis du passage.
- Pour chaque point :
  * Explication du texte (ce que le texte dit).
  * Illustration contemporaine ou analogie pertinente.
  * Application concrète pour la vie chrétienne aujourd'hui.
- Concluez par un appel ou une conclusion pastorale mémorable.""",

            "study_questions": f"""Vous êtes un formateur d'étude biblique inductive.
Concevez une série de questions d'étude biblique progressives pour le passage suivant : {ref_str}.

TEXTE DU PASSAGE :
{main_text}

CONSIGNES STRICTES :
- N'utilisez AUCUN émoji dans votre réponse.
- Rédigez en français clair et stimulant.
- Structurez vos questions selon la méthode inductive classique :
  1. Questions d'Observation (Qu'est-ce que le texte dit ? structure, répétitions, personnages, contrastes).
  2. Questions d'Interprétation (Que signifie ce texte ? sens des mots-clés, intention de l'auteur, doctrine).
  3. Questions d'Application personnelle et communautaire (En quoi cela transforme-t-il notre marche et nos relations ?)."""
        }

        user_prompt = prompts.get(insight_type, prompts["structure"])

        cfg = load_config()
        active_model = model or cfg.get("chat_model", "gemini-3.7-flash")

        # Résolution du provider et de la clé API
        if "mistral" in active_model.lower():
            provider = "mistral"
            api_key = cfg.get("mistral_api_key", "")
            product_id = None
        elif "infomaniak" in active_model.lower() or "ministral" in active_model.lower():
            provider = "infomaniak"
            api_key = cfg.get("infomaniak_token", "")
            product_id = cfg.get("infomaniak_product_id", "251")
        else:
            provider = "gemini"
            api_key = cfg.get("gemini_api_key", "")
            product_id = None

        if not api_key:
            if cfg.get("gemini_api_key"):
                provider = "gemini"
                api_key = cfg.get("gemini_api_key")
                active_model = "gemini-3.7-flash"
            elif cfg.get("mistral_api_key"):
                provider = "mistral"
                api_key = cfg.get("mistral_api_key")
                active_model = "mistral-large-latest"
            elif cfg.get("infomaniak_token"):
                provider = "infomaniak"
                api_key = cfg.get("infomaniak_token")
                product_id = cfg.get("infomaniak_product_id", "251")

        if not api_key:
            return {
                "success": False,
                "error": "Aucune clé API configurée. Veuillez renseigner votre clé API dans les Paramètres (Gemini, Mistral ou Infomaniak)."
            }

        try:
            client = LLMClient(api_key=api_key, model=active_model, provider=provider, product_id=product_id)
            system_prompt = (
                "Vous êtes un assistant académique d'étude biblique et d'exégèse pour la plateforme Open Shema. "
                "Vous fournissez des analyses d'une grande rigueur textuelle, historique et théologique. "
                "Ne mettez jamais aucun émoji dans votre réponse."
            )
            response = client.ask_question(
                context="",
                question=user_prompt,
                system_prompt=system_prompt
            )

            return {
                "success": True,
                "reference": ref_str,
                "insight_type": insight_type,
                "model_used": active_model,
                "content": response
            }
        except Exception as e:
            logger.error("Erreur génération insight IA : %s", e)
            return {
                "success": False,
                "error": f"Erreur lors de la génération de l'analyse : {str(e)}"
            }

    @classmethod
    def export_passage_study_to_note(cls, passage_ref: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Exporte l'étude du passage sous forme de fichier Markdown (.md) bien formaté
        dans le dossier de notes de l'utilisateur.
        """
        try:
            study_data = cls.get_passage_study_data(passage_ref)
            if not study_data.get("success"):
                return {"success": False, "error": study_data.get("error")}

            ref_str = study_data["reference"]
            french_book = study_data["french_book"]
            book_code = study_data["book_code"]
            start_ch = study_data["start_ch"]
            start_v = study_data["start_v"]
            pericope_title = study_data["pericope"]["title"]

            title = f"Étude — {ref_str}"
            if pericope_title:
                title += f" : {pericope_title}"

            sections = [
                f"# {title}\n",
                f"> **Référence** : {ref_str}  ",
                f"> **Péricope** : {pericope_title if pericope_title else 'Section continue'}  ",
                f"> **Date d'étude** : Document généré par Open Shema\n",
                "---\n",
                "## 1. Texte Biblique\n"
            ]

            # Texte biblique principal
            main_v = study_data["scripture"]["verses"]
            for v in main_v:
                sections.append(f"**{v['chapter']}:{v['verse']}** {v['text']}\n")

            # Texte original
            orig = study_data.get("original_language", {})
            if orig.get("available"):
                sections.append("\n## 2. Texte Original & Lexique\n")
                sections.append(f"*{orig.get('language')}*\n")
                sections.append(f"> {orig.get('continuous_text')}\n\n")

                key_lemmas = orig.get("key_lemmas", [])
                if key_lemmas:
                    sections.append("| Lemme | Strong | Translittération | Définition / Glose |")
                    sections.append("| :--- | :--- | :--- | :--- |")
                    for l in key_lemmas[:10]:
                        sections.append(f"| {l['lemma']} | {l['strong']} | *{l['transliteration']}* | {l['gloss']} |")
                    sections.append("\n")

            # Insights IA si fournis
            ai_insights = payload.get("ai_insights", {})
            if ai_insights:
                sections.append("## 3. Analyse & Synthèse Exégétique\n")
                for itype, icontent in ai_insights.items():
                    type_titles = {
                        "structure": "Structure Littéraire & Mouvements",
                        "big_idea": "Idée Maîtresse & Théologie",
                        "sermon_outline": "Plan Homilétique & Prédication",
                        "study_questions": "Questions d'Étude Inductive"
                    }
                    t_name = type_titles.get(itype, itype.capitalize())
                    sections.append(f"### {t_name}\n\n{icontent}\n\n")

            # Commentaires
            by_author = study_data.get("commentaries", {}).get("by_author", [])
            if by_author:
                sections.append("## 4. Commentaires Historiques\n")
                for a_sum in by_author[:3]:
                    sections.append(f"### {a_sum['author']}\n\n{a_sum['full_text']}\n\n")

            # Notes personnelles
            user_notes_text = payload.get("user_notes", "")
            if user_notes_text:
                sections.append("## 5. Notes & Réflexions Personnelles\n\n" + user_notes_text + "\n\n")

            full_markdown = "\n".join(sections)

            # Sauvegarder via NotesManager
            note_res = NotesManager.save_note(
                title=title,
                content=full_markdown,
                book_code=book_code,
                chapter=start_ch,
                verse=start_v,
                tags=["Guide de Passage", french_book, "Exégèse"]
            )

            return {
                "success": True,
                "note": note_res,
                "message": f"Étude de passage enregistrée dans vos notes avec succès ({ref_str})."
            }
        except Exception as e:
            logger.error("Erreur export note étude passage : %s", e)
            return {
                "success": False,
                "error": f"Erreur lors de l'export dans les notes : {str(e)}"
            }
