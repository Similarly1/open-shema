import re
from typing import List, Dict, Any, Tuple, Optional
from core.reference_parser import BOOK_MAPPING, strip_accents, REVERSE_BOOK_MAPPING
from core.bible_json_loader import BibleJsonLoader

# Construire la liste de toutes les formes et abréviations de livres connues (accentuées et non accentuées)
_book_forms = set()
for k in BOOK_MAPPING.keys():
    _book_forms.add(k)
    if k.startswith('e'):
        _book_forms.add('é' + k[1:])
        _book_forms.add('è' + k[1:])
    elif k.startswith('a'):
        _book_forms.add('à' + k[1:])
for v in REVERSE_BOOK_MAPPING.values():
    _book_forms.add(v)
    _book_forms.add(strip_accents(v))
    _book_forms.add(v.lower())
    _book_forms.add(strip_accents(v).lower())

# Trier par longueur décroissante pour matcher les formes les plus spécifiques en premier
_sorted_books = sorted(list(_book_forms), key=lambda x: -len(x))
_books_pattern = '|'.join(re.escape(b) for b in _sorted_books)

# Regex complète pour capturer les références bibliques
# Exemples : 'Genèse 1:26', 'Gn 1.1', '1 Samuel 4:8', 'Ésaïe 6', 'Osée 11:12', 'Ps. 119:105', 'Ép 2', 'Rm 8', etc.
BIBLE_REF_REGEX = re.compile(
    rf'\b({_books_pattern})\.?\s+(\d+)(?:[.:,](\d+(?:\s*-\s*\d+)?))?\b',
    re.IGNORECASE
)

def find_bible_references(text: str) -> List[Dict[str, Any]]:
    """
    Extrait toutes les références bibliques contenues dans un texte avec leurs positions exactes.
    Retourne une liste de dicts contenant:
    {
        'raw': 'Ésaïe 62:5',
        'book_name': 'Ésaïe',
        'book_code': 'Isa',
        'chapter': 62,
        'verse': '5',
        'start': 120,
        'end': 130
    }
    """
    if not text:
        return []
        
    results = []
    for m in BIBLE_REF_REGEX.finditer(text):
        book_raw = m.group(1).strip()
        ch_raw = m.group(2).strip()
        v_raw = m.group(3).strip() if m.group(3) else None
        
        book_clean = strip_accents(book_raw).rstrip('.')
        if book_clean in BOOK_MAPPING:
            code = BOOK_MAPPING[book_clean]
            fr_book = REVERSE_BOOK_MAPPING.get(code, code)
            start, end = m.span()
            results.append({
                "raw": m.group(0),
                "book_name": fr_book,
                "book_code": code,
                "chapter": int(ch_raw),
                "verse": v_raw,
                "start": start,
                "end": end
            })
            
    return results

def get_bible_passage_preview(bible_name: str, book_code: str, chapter: int, verse: Optional[str] = None) -> Tuple[str, str]:
    """
    Récupère instantanément l'aperçu du passage biblique pour l'info-bulle (tooltip) :
    - Si verset unique (ex: '5') : le verset complet.
    - Si plage de versets (ex: '4-8') : les versets de la plage formatés.
    - Si chapitre entier (verse=None) : les 3 premiers versets du chapitre suivis de '...'.
    """
    fr_book = REVERSE_BOOK_MAPPING.get(book_code, book_code)
    
    if verse:
        ref_title = f"{fr_book} {chapter}:{verse}"
    else:
        ref_title = f"{fr_book} {chapter}"
        
    # 1. Verset unique
    if verse and str(verse).isdigit():
        res = BibleJsonLoader.get_verses(bible_name, book_code, chapter, int(verse))
        if res and res.get("documents") and len(res["documents"]) > 0:
            return ref_title, res["documents"][0].strip()
            
    # 2. Plage de versets (ex: 4-8)
    elif verse and "-" in str(verse):
        parts = str(verse).split("-")
        if parts[0].strip().isdigit() and parts[1].strip().isdigit():
            v_start = int(parts[0].strip())
            v_end = int(parts[1].strip())
            res = BibleJsonLoader.get_verses(bible_name, book_code, chapter, None)
            if res and res.get("documents"):
                lines = []
                for doc, meta in zip(res["documents"], res["metadatas"]):
                    v_num = meta.get("verse", 0)
                    if isinstance(v_num, int) and v_start <= v_num <= v_end:
                        lines.append(f"[{v_num}] {doc.strip()}")
                if lines:
                    preview_lines = lines[:4]
                    if len(lines) > 4:
                        preview_lines.append("...")
                    return ref_title, "\n".join(preview_lines)
                    
    # 3. Chapitre entier (sans verset spécifique) : aperçu sur les 3 premiers versets
    else:
        res = BibleJsonLoader.get_verses(bible_name, book_code, chapter, None)
        if res and res.get("documents") and len(res["documents"]) > 0:
            lines = []
            for doc, meta in zip(res["documents"][:3], res["metadatas"][:3]):
                v_num = meta.get("verse", "")
                lines.append(f"[{v_num}] {doc.strip()}")
            if len(res["documents"]) > 3:
                lines.append("...")
            return ref_title, "\n".join(lines)
            
    return ref_title, "(Texte biblique indisponible pour cette référence)"
