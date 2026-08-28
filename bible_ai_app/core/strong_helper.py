import logging
logger = logging.getLogger(__name__)
import os
import re
import json
from typing import Dict, List, Any, Optional

class StrongLexiconHelper:
    _lexicon_cache = None
    _base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    @classmethod
    def get_lexicon(cls) -> Dict[str, Any]:
        if cls._lexicon_cache is None:
            lex_path = os.path.join(cls._base_dir, "data", "strong_lexicon.json")
            if os.path.exists(lex_path):
                with open(lex_path, "r", encoding="utf-8") as f:
                    cls._lexicon_cache = json.load(f)
            else:
                cls._lexicon_cache = {}
        return cls._lexicon_cache
        
    @classmethod
    def get_verse_lexicon_block(cls, book_code: str, chapter: int, verse: int) -> Optional[Dict[str, Any]]:
        """
        Extrait les termes hébreux/grecs et leurs définitions Strong pour un verset donné.
        """
        lexicon = cls.get_lexicon()
        if not lexicon:
            return None
            
        # Trouver le fichier LSG correspondant au livre
        lsg_dir = os.path.join(cls._base_dir, "data", "bibles", "LSG")
        if not os.path.exists(lsg_dir):
            return None
            
        matching_file = None
        b_up = book_code.upper()
        for f in os.listdir(lsg_dir):
            if f.endswith(".json") and (f"_{b_up}_" in f.upper() or f"_{b_up}." in f.upper() or f.upper().startswith(f"{b_up}_")):
                matching_file = os.path.join(lsg_dir, f)
                break
                
        if not matching_file:
            return None
            
        try:
            with open(matching_file, "r", encoding="utf-8") as f:
                bible_data = json.load(f)
                
            ch_str = str(chapter)
            v_str = str(verse)
            
            raw_verse_text = bible_data.get("chapters", {}).get(ch_str, {}).get(v_str, "")
            if not raw_verse_text:
                return None
                
            # Extraire les balises <w strong="H4910">mot</w>
            pattern = r'<w strong="([^"]+)">([^<]*)</w>'
            matches = re.findall(pattern, raw_verse_text)
            
            if not matches:
                return None
                
            entries_found = []
            seen_strongs = set()
            
            for strong_code, french_word in matches:
                strong_code = strong_code.strip()
                if not strong_code or strong_code in seen_strongs:
                    continue
                seen_strongs.add(strong_code)
                
                # Chercher dans le lexique (essayer H4910, H04910, etc.)
                entry = lexicon.get(strong_code)
                if not entry and len(strong_code) > 1:
                    prefix = strong_code[0]
                    num = int(re.sub(r'\D', '', strong_code))
                    std_4d = f"{prefix}{num:04d}"
                    short_c = f"{prefix}{num}"
                    entry = lexicon.get(std_4d) or lexicon.get(short_c)
                    
                if entry:
                    lemma = entry.get("lemma", "")
                    definition = entry.get("definition", "")
                    lang = "Hébreu" if entry.get("lang") == "hebrew" or strong_code.startswith("H") else "Grec"
                    w_label = f"« {french_word} »" if french_word else ""
                    entries_found.append(f"• {w_label} ({strong_code} - {lemma}, {lang}) : {definition}")
                    
            if not entries_found:
                return None
                
            book_name = bible_data.get("name", book_code)
            full_text = f"=== LEXIQUE EXÉGÉTIQUE HÉBREU / GREC (STRONG) : {book_name} {chapter}:{verse} ===\n" + "\n".join(entries_found)
            
            return {
                "id": f"strong_lex_{book_code}_{chapter}_{verse}",
                "text": full_text,
                "metadata": {
                    "name": f"Lexique Strong ({book_name} {chapter}:{verse})",
                    "type": "Lexique / Dictionnaire",
                    "book": book_name,
                    "book_code": book_code,
                    "chapter": chapter,
                    "verse": verse,
                    "reference": f"{book_name} {chapter}:{verse} (Lexique Strong)"
                },
                "vector_score": 1.0
            }
        except Exception as e:
            logger.error(f"Erreur extraction lexique Strong : {e}")
            return None

if __name__ == "__main__":
    import sys
    sys.stdout.reconfigure(encoding='utf-8')
    res = StrongLexiconHelper.get_verse_lexicon_block("Gen", 1, 18)
    if res:
        logger.info("Success!\n")
        logger.info(res["text"])
    else:
        logger.error("Failed to get verse lexicon block.")