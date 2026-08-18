import os
import json
from typing import Optional, Dict, Any, List, Tuple
from core.bible_json_loader import BibleJsonLoader, extract_verse_text, STD_TO_USFM, USFM_TO_STD
from core.reference_parser import get_french_book_name

class PericopeManager:
    """
    Gestionnaire haute performance pour l'interrogation et la contextualisation
    des péricopes et titres de sections bibliques.
    """
    
    @classmethod
    def get_section_title(cls, bible_name: str, std_book_code: str, chapter: int, verse: int) -> Optional[str]:
        """
        Retourne le titre de section authentique si le verset (chapter, verse)
        marque le début d'une péricope dans la version spécifiée.
        """
        book_data = BibleJsonLoader.load_book(bible_name, std_book_code)
        if not book_data:
            return None
            
        sections = book_data.get("sections", {})
        if not sections:
            return None
            
        key = f"{chapter}:{verse}"
        return sections.get(key)

    @classmethod
    def get_sections_for_book(cls, bible_name: str, std_book_code: str) -> Dict[str, str]:
        """Retourne l'ensemble du dictionnaire des sections {'ch:v': 'Titre'} pour un livre."""
        book_data = BibleJsonLoader.load_book(bible_name, std_book_code)
        if not book_data:
            return {}
        return book_data.get("sections", {})

    @classmethod
    def is_paragraph_start(cls, bible_name: str, std_book_code: str, chapter: int, verse: int) -> bool:
        """
        Détermine si le verset (chapter, verse) marque le début d'un paragraphe authentique
        dans la version demandée (ou si c'est un début de section).
        """
        book_data = BibleJsonLoader.load_book(bible_name, std_book_code)
        if not book_data:
            return int(verse) == 1
            
        key = f"{chapter}:{verse}"
        
        # 1. Vérification dans la liste dédiée des paragraphes extraits de l'EPUB
        paragraphs = book_data.get("paragraphs")
        if paragraphs:
            return key in paragraphs
            
        # 2. Fallback sur les débuts de sections / péricopes
        sections = book_data.get("sections", {})
        if key in sections:
            return True
            
        # 3. Le premier verset d'un chapitre marque toujours un début de paragraphe
        return int(verse) == 1

    @classmethod
    def get_pericope_context(cls, bible_name: str, std_book_code: str, chapter: int, verse: int) -> Dict[str, Any]:
        """
        Calcule la péricope active contenant (chapter, verse), ainsi que la péricope
        précédente et suivante pour enrichir le contexte exégétique de l'IA.
        """
        book_data = BibleJsonLoader.load_book(bible_name, std_book_code)
        fr_book = get_french_book_name(std_book_code)
        
        default_res = {
            "has_pericope": False,
            "bible_name": bible_name,
            "book": std_book_code,
            "french_book": fr_book,
            "current": None,
            "prev": None,
            "next": None
        }
        
        if not book_data:
            return default_res
            
        pericopes = book_data.get("pericopes", [])
        if not pericopes:
            return default_res
            
        # Trouver la péricope active qui contient (chapter, verse)
        target_idx = -1
        target_ch = int(chapter)
        target_v = int(verse) if str(verse).isdigit() else 1
        
        for idx, p in enumerate(pericopes):
            s_ch, s_v = p.get("start_ch", 1), p.get("start_v", 1)
            e_ch, e_v = p.get("end_ch", 1), p.get("end_v", 999)
            
            # Vérifier si (target_ch, target_v) est dans [ (s_ch, s_v), (e_ch, e_v) ]
            is_after_start = (target_ch > s_ch) or (target_ch == s_ch and target_v >= s_v)
            is_before_end = (target_ch < e_ch) or (target_ch == e_ch and target_v <= e_v)
            
            if is_after_start and is_before_end:
                target_idx = idx
                break
                
        if target_idx == -1:
            # Si non trouvé exactement, prendre la dernière péricope commencée avant
            for idx, p in enumerate(pericopes):
                s_ch, s_v = p.get("start_ch", 1), p.get("start_v", 1)
                if (target_ch > s_ch) or (target_ch == s_ch and target_v >= s_v):
                    target_idx = idx
                else:
                    break
                    
        if target_idx == -1 and pericopes:
            target_idx = 0
            
        if target_idx == -1:
            return default_res
            
        cur_p = pericopes[target_idx]
        prev_p = pericopes[target_idx - 1] if target_idx > 0 else None
        next_p = pericopes[target_idx + 1] if target_idx + 1 < len(pericopes) else None
        
        # Formater la référence de la péricope courante
        s_ch, s_v = cur_p.get("start_ch", 1), cur_p.get("start_v", 1)
        e_ch, e_v = cur_p.get("end_ch", 1), cur_p.get("end_v", 1)
        
        if s_ch == e_ch:
            ref_range = f"{fr_book} {s_ch}:{s_v}–{e_v}" if s_v != e_v else f"{fr_book} {s_ch}:{s_v}"
        else:
            ref_range = f"{fr_book} {s_ch}:{s_v} – {e_ch}:{e_v}"
            
        # Extraire le texte complet des versets de la péricope active
        chapters_dict = book_data.get("chapters", {})
        pericope_verses = []
        for ch_num in range(s_ch, e_ch + 1):
            ch_str = str(ch_num)
            if ch_str in chapters_dict:
                v_dict = chapters_dict[ch_str]
                sorted_v_keys = sorted(v_dict.keys(), key=lambda x: int(x) if x.isdigit() else 999)
                for vk in sorted_v_keys:
                    v_int = int(vk) if vk.isdigit() else 0
                    if ch_num == s_ch and v_int < s_v:
                        continue
                    if ch_num == e_ch and v_int > e_v:
                        continue
                    txt = extract_verse_text(v_dict[vk])
                    pericope_verses.append(f"{ch_num}:{vk} {txt}")
                    
        full_pericope_text = "\n".join(pericope_verses)
        
        # Formater prev & next
        prev_data = None
        if prev_p:
            ps_ch, ps_v = prev_p.get("start_ch", 1), prev_p.get("start_v", 1)
            pe_ch, pe_v = prev_p.get("end_ch", 1), prev_p.get("end_v", 1)
            p_ref = f"{fr_book} {ps_ch}:{ps_v}–{pe_v}" if ps_ch == pe_ch else f"{fr_book} {ps_ch}:{ps_v} – {pe_ch}:{pe_v}"
            prev_data = {
                "title": prev_p.get("title", ""),
                "ref_range": p_ref,
                "start_ch": ps_ch, "start_v": ps_v,
                "end_ch": pe_ch, "end_v": pe_v
            }
            
        next_data = None
        if next_p:
            ns_ch, ns_v = next_p.get("start_ch", 1), next_p.get("start_v", 1)
            ne_ch, ne_v = next_p.get("end_ch", 1), next_p.get("end_v", 1)
            n_ref = f"{fr_book} {ns_ch}:{ns_v}–{ne_v}" if ns_ch == ne_ch else f"{fr_book} {ns_ch}:{ns_v} – {ne_ch}:{ne_v}"
            next_data = {
                "title": next_p.get("title", ""),
                "ref_range": n_ref,
                "start_ch": ns_ch, "start_v": ns_v,
                "end_ch": ne_ch, "end_v": ne_v
            }
            
        return {
            "has_pericope": True,
            "bible_name": bible_name,
            "book": std_book_code,
            "french_book": fr_book,
            "current": {
                "title": cur_p.get("title", ""),
                "ref_range": ref_range,
                "start_ch": s_ch, "start_v": s_v,
                "end_ch": e_ch, "end_v": e_v,
                "text": full_pericope_text,
                "verses_count": len(pericope_verses)
            },
            "prev": prev_data,
            "next": next_data
        }
