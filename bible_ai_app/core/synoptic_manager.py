import os
import re
import json
import logging
from typing import Dict, List, Any, Optional, Tuple

from core.bible_json_loader import BibleJsonLoader, extract_verse_text, USFM_TO_STD
from core.reference_parser import get_french_book_name
from core.original_languages_manager import OriginalLanguagesManager

logger = logging.getLogger(__name__)

GOSPEL_BOOKS = ["MAT", "MRK", "LUK", "JHN"]
GOSPEL_ORDER = {"MAT": 1, "MRK": 2, "LUK": 3, "JHN": 4}
GOSPEL_ABBR = {
    "MAT": "Mt",
    "MRK": "Mc",
    "LUK": "Lc",
    "JHN": "Jn"
}

def normalize_gospel_code(b_code: Optional[str]) -> Optional[str]:
    """Normalise n'importe quel code de livre (USFM, standard interne ou français) vers MAT, MRK, LUK ou JHN."""
    if not b_code or not isinstance(b_code, str):
        return None
    clean = b_code.strip().upper()
    if clean in GOSPEL_BOOKS:
        return clean
    from core.bible_json_loader import STD_TO_USFM
    usfm = STD_TO_USFM.get(b_code) or STD_TO_USFM.get(b_code.capitalize())
    if usfm and usfm.upper() in GOSPEL_BOOKS:
        return usfm.upper()
    mapping = {
        "MAT": "MAT", "MRK": "MRK", "MAR": "MRK", "LUK": "LUK", "LUC": "LUK", "JHN": "JHN", "JOH": "JHN", "JEAN": "JHN",
        "MATTHIEU": "MAT", "MARC": "MRK"
    }
    return mapping.get(clean)

def clean_plain_text(raw_val: Any) -> str:
    """Nettoie le texte d'un verset de toutes balises XML/HTML (<w strong="...">) et espaces superflus."""
    if not raw_val:
        return ""
    txt = extract_verse_text(raw_val) if isinstance(raw_val, (dict, list, str)) else str(raw_val)
    txt = re.sub(r'<[^>]+>', '', txt)
    txt = re.sub(r'\s+', ' ', txt).strip()
    return txt

class SynopticManager:
    """
    Gestionnaire centralisé pour l'Harmonie des Évangiles et la Synopse comparative.
    S'appuie sur le catalogue des 367 péricopes d'Aland/Throckmorton et les bases de données locales.
    """
    _instance = None
    _dataset_cache = None
    _verse_index = None

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = SynopticManager()
        return cls._instance

    def __init__(self):
        self.base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        self.json_path = os.path.join(self.base_dir, "data", "gospel_parallels.json")
        self.pericopes: List[Dict[str, Any]] = []
        self.pericopes_by_id: Dict[int, Dict[str, Any]] = {}
        self.verse_index: Dict[str, List[int]] = {}
        self._load_data()

    def _load_data(self):
        if not os.path.exists(self.json_path):
            logger.warning(f"Fichier gospel_parallels.json introuvable : {self.json_path}")
            return

        try:
            with open(self.json_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                self.pericopes = data.get("pericopes", [])
                
            self.pericopes_by_id = {p["id"]: p for p in self.pericopes}
            self.verse_index = {}

            for p in self.pericopes:
                p_id = p["id"]
                for b_code in GOSPEL_BOOKS:
                    g_data = p.get(b_code)
                    if not g_data:
                        continue
                    
                    # Indexer par versets précis
                    v_keys = g_data.get("verse_keys", [])
                    for vk in v_keys:
                        full_key = f"{b_code}:{vk}"
                        if full_key not in self.verse_index:
                            self.verse_index[full_key] = []
                        if p_id not in self.verse_index[full_key]:
                            self.verse_index[full_key].append(p_id)

                    # Indexer également par plages de chapitres
                    ranges = g_data.get("ranges", [])
                    for r in ranges:
                        s_ch, s_v = r["start_ch"], r["start_v"]
                        e_ch, e_v = r["end_ch"], r["end_v"]
                        for ch in range(s_ch, e_ch + 1):
                            ch_key = f"{b_code}:{ch}"
                            if ch_key not in self.verse_index:
                                self.verse_index[ch_key] = []
                            if p_id not in self.verse_index[ch_key]:
                                self.verse_index[ch_key].append(p_id)

            logger.info(f"SynopticManager initialisé avec {len(self.pericopes)} péricopes synoptiques.")
        except Exception as e:
            logger.error(f"Erreur lors du chargement des données synoptiques : {e}")

    def get_pericope_by_id(self, pericope_id: int) -> Optional[Dict[str, Any]]:
        return self.pericopes_by_id.get(pericope_id)

    def get_parallels_for_verse(self, book_code: str, chapter: int, verse: int) -> List[Dict[str, Any]]:
        """
        Retourne la liste des parallèles pour un verset donné (ex: MAT, 9, 2).
        """
        g_code = normalize_gospel_code(book_code)
        if not g_code:
            return []
        book_code = g_code

        v_key = f"{book_code}:{chapter}:{verse}"
        p_ids = self.verse_index.get(v_key, [])
        if not p_ids:
            # Fallback sur le chapitre
            ch_key = f"{book_code}:{chapter}"
            p_ids = self.verse_index.get(ch_key, [])

        results = []
        for pid in p_ids:
            p = self.pericopes_by_id.get(pid)
            if not p:
                continue

            parallels = []
            for other_b in GOSPEL_BOOKS:
                if other_b == book_code:
                    continue
                other_data = p.get(other_b)
                if other_data:
                    short_badge = f"{GOSPEL_ABBR.get(other_b, other_b)} {other_data['start_ch']}"
                    if other_data['start_ch'] == other_data['end_ch']:
                        if other_data['start_v'] == other_data['end_v']:
                            short_badge += f":{other_data['start_v']}"
                        else:
                            short_badge += f":{other_data['start_v']}-{other_data['end_v']}"
                    parallels.append({
                        "book": other_b,
                        "french_book": get_french_book_name(other_b),
                        "abbr": GOSPEL_ABBR.get(other_b, other_b),
                        "ref": other_data["ref"],
                        "primary_ref": other_data.get("primary_ref", other_data["ref"]),
                        "short_badge": short_badge,
                        "start_ch": other_data["start_ch"],
                        "start_v": other_data["start_v"],
                        "end_ch": other_data["end_ch"],
                        "end_v": other_data["end_v"]
                    })

            if parallels:
                results.append({
                    "pericope_id": p["id"],
                    "title_fr": p["title_fr"],
                    "title_en": p["title_en"],
                    "tradition_type": p.get("tradition_type", "synoptic"),
                    "gospels_count": p.get("gospels_count", len(parallels) + 1),
                    "parallels": parallels
                })

        return results

    def get_synoptic_context_for_passage(
        self,
        book_code: str,
        start_ch: int,
        start_v: int,
        end_ch: int,
        end_v: int,
        bible_name: str = "LSG"
    ) -> Dict[str, Any]:
        """
        Agrège toutes les données synoptiques pour une plage de versets d'un passage.
        Génère les badges inline pour chaque verset + la matrice synoptique de la péricope principale.
        """
        g_code = normalize_gospel_code(book_code)
        if not g_code:
            return {"has_synoptic": False, "reason": "Le livre n'est pas un Évangile."}
        book_code = g_code

        # 1. Identifier toutes les péricopes intersectant la plage
        matched_pericope_ids = []
        verse_parallels_map = {}

        for ch in range(start_ch, end_ch + 1):
            sv = start_v if ch == start_ch else 1
            ev = end_v if ch == end_ch else 99
            for v in range(sv, ev + 1):
                vk = f"{ch}:{v}"
                v_full = f"{book_code}:{ch}:{v}"
                p_ids = self.verse_index.get(v_full, [])
                for pid in p_ids:
                    if pid not in matched_pericope_ids:
                        matched_pericope_ids.append(pid)

                # Parallèles spécifiques à ce verset
                par_list = self.get_parallels_for_verse(book_code, ch, v)
                if par_list:
                    primary_p = par_list[0]
                    badges = [p["short_badge"] for p in primary_p["parallels"]]
                    
                    # Extraire le texte de chaque parallèle pour le tiroir accordéon inline
                    drawer_items = []
                    for par_item in primary_p["parallels"]:
                        b_par = par_item["book"]
                        s_c, s_vr = par_item["start_ch"], par_item["start_v"]
                        e_c, e_vr = par_item["end_ch"], par_item["end_v"]
                        
                        # Extraire le texte court pour le tiroir
                        par_text = self._get_short_passage_text(b_par, s_c, s_vr, e_c, e_vr, bible_name)
                        drawer_items.append({
                            **par_item,
                            "text": par_text
                        })

                    verse_parallels_map[vk] = {
                        "pericope_id": primary_p["pericope_id"],
                        "title_fr": primary_p["title_fr"],
                        "tradition_type": primary_p["tradition_type"],
                        "badges_str": " · ".join(badges),
                        "items": drawer_items
                    }

        if not matched_pericope_ids:
            return {
                "has_synoptic": True,
                "book": book_code,
                "pericopes": [],
                "verse_parallels": {},
                "synopsis_matrix": None
            }

        # 2. Péricope principale
        primary_pid = matched_pericope_ids[0]
        synopsis_matrix = self.build_full_synopsis_matrix(primary_pid, bible_name=bible_name, pivot_book=book_code)

        pericopes_meta = []
        for pid in matched_pericope_ids:
            p = self.pericopes_by_id.get(pid)
            if p:
                pericopes_meta.append({
                    "id": p["id"],
                    "title_fr": p["title_fr"],
                    "tradition_type": p["tradition_type"],
                    "active_gospels": p["active_gospels"],
                    "gospels_count": p["gospels_count"],
                    "is_primary": (pid == primary_pid)
                })

        return {
            "has_synoptic": True,
            "book": book_code,
            "primary_pericope_id": primary_pid,
            "pericopes": pericopes_meta,
            "verse_parallels": verse_parallels_map,
            "synopsis_matrix": synopsis_matrix
        }

    def _get_short_passage_text(
        self,
        book_code: str,
        start_ch: int,
        start_v: int,
        end_ch: int,
        end_v: int,
        bible_name: str = "LSG"
    ) -> str:
        """Extrait le texte brut concaténé d'une courte plage de versets pour les tiroirs accordéons."""
        std_code = USFM_TO_STD.get(book_code, book_code)
        book_obj = BibleJsonLoader.load_book(bible_name, std_code)
        if not book_obj:
            book_obj = BibleJsonLoader.load_book("LSG", std_code) or {}
            
        chapters_data = book_obj.get("chapters", {})
        lines = []

        for ch in range(start_ch, end_ch + 1):
            sv = start_v if ch == start_ch else 1
            ev = end_v if ch == end_ch else 99
            ch_verses = chapters_data.get(str(ch), {})
            for v_num in sorted([int(k) for k in ch_verses.keys() if str(k).isdigit()]):
                if sv <= v_num <= ev:
                    t = clean_plain_text(ch_verses.get(str(v_num), ""))
                    if t:
                        lines.append(f"{v_num}. {t}")

        return " ".join(lines)

    def build_full_synopsis_matrix(
        self,
        pericope_id: int,
        bible_name: str = "LSG",
        pivot_book: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Construit le tableau synoptique complet (texte FR et grec original SBLGNT)
        pour une péricope avec alignement narratif horizontal.
        """
        pericope = self.pericopes_by_id.get(pericope_id)
        if not pericope:
            return None

        pivot = normalize_gospel_code(pivot_book) or "MAT"
        active_books = pericope.get("active_gospels", [])

        # Réordonner les colonnes : pivot en premier, puis ordre canonique des autres
        ordered_books = [pivot] if pivot in active_books else []
        for b in GOSPEL_BOOKS:
            if b in active_books and b not in ordered_books:
                ordered_books.append(b)

        # 1. Extraire les versets pour chaque évangile concerné
        verses_by_gospel: Dict[str, List[Dict[str, Any]]] = {}
        orig_mgr = OriginalLanguagesManager.get_instance()

        for b_code in ordered_books:
            g_data = pericope.get(b_code)
            if not g_data:
                continue

            std_code = USFM_TO_STD.get(b_code, b_code)
            book_obj = BibleJsonLoader.load_book(bible_name, std_code)
            if not book_obj:
                book_obj = BibleJsonLoader.load_book("LSG", std_code) or {}
            
            chapters_data = book_obj.get("chapters", {}) if book_obj else {}

            b_list = []
            ranges = g_data.get("ranges", [])
            for r in ranges:
                s_ch, s_v = r["start_ch"], r["start_v"]
                e_ch, e_v = r["end_ch"], r["end_v"]
                
                for ch in range(s_ch, e_ch + 1):
                    v_start = s_v if ch == s_ch else 1
                    v_end = e_v if ch == e_ch else 99
                    
                    ch_verses = chapters_data.get(str(ch), {})

                    for v_num in sorted([int(k) for k in ch_verses.keys() if str(k).isdigit()]):
                        if v_start <= v_num <= v_end:
                            raw_t = ch_verses.get(str(v_num), "")
                            clean_t = clean_plain_text(raw_t)
                            
                            # Extraire le texte grec original pour ce verset
                            greek_words = orig_mgr.get_verse_original_words(b_code, ch, v_num) if orig_mgr.is_installed() else []
                            greek_txt = " ".join([w.get("text", "") for w in greek_words])

                            b_list.append({
                                "book": b_code,
                                "chapter": ch,
                                "verse": v_num,
                                "key": f"{ch}:{v_num}",
                                "text_fr": clean_t,
                                "text_gr": greek_txt,
                                "words_gr": greek_words
                            })
            verses_by_gospel[b_code] = b_list

        # 2. Construction des lignes de la matrice avec alignement narratif
        max_rows = max([len(vlist) for vlist in verses_by_gospel.values()]) if verses_by_gospel else 0
        aligned_rows = []

        for row_idx in range(max_rows):
            row_cells = {}
            for b_code in ordered_books:
                vlist = verses_by_gospel.get(b_code, [])
                if row_idx < len(vlist):
                    v_item = vlist[row_idx]
                    row_cells[b_code] = {
                        "is_empty": False,
                        "ref": f"{GOSPEL_ABBR[b_code]} {v_item['key']}",
                        "chapter": v_item["chapter"],
                        "verse": v_item["verse"],
                        "text_fr": v_item["text_fr"],
                        "text_gr": v_item["text_gr"]
                    }
                else:
                    row_cells[b_code] = {
                        "is_empty": True,
                        "ref": "—",
                        "text_fr": "",
                        "text_gr": ""
                    }
            aligned_rows.append({
                "row_index": row_idx,
                "cells": row_cells
            })

        # Métadonnées des colonnes pour le rendu d'en-tête
        columns_meta = []
        for b_code in ordered_books:
            g_ref = pericope.get(b_code, {}).get("ref", "")
            columns_meta.append({
                "book": b_code,
                "french_name": get_french_book_name(b_code),
                "abbr": GOSPEL_ABBR.get(b_code, b_code),
                "ref": g_ref,
                "is_pivot": (b_code == pivot)
            })

        return {
            "pericope_id": pericope["id"],
            "title_fr": pericope["title_fr"],
            "title_en": pericope["title_en"],
            "tradition_type": pericope["tradition_type"],
            "pivot_book": pivot,
            "bible_version": bible_name,
            "columns": columns_meta,
            "rows": aligned_rows
        }
