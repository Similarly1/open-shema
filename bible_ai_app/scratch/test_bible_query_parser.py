import sys, os
sys.path.insert(0, os.path.abspath('.'))
import re
from core.reference_parser import BOOK_MAPPING, strip_accents, get_french_book_name

def parse_bible_search_query(query: str):
    """
    Analyse une requête utilisateur et extrait les critères bibliques (code livre, chapitre, verset).
    Gère toutes les syntaxes:
    - 'rm 4', 'Rm 4', 'rm4', 'romains 4', 'Romains 4'
    - '1co 13', '1 co 13', '1 corinthiens 13', '1cor 13'
    - '2 timothee 2', '2 tm 2', '2ti 2', '2 tim 2'
    - 'psaume 23', 'ps 23', 'psaumes 23', 'ps23'
    - 'jean 3:16', 'jn 3.16', 'Jn 3 16', 'jean 3 16'
    - 'rm', 'romains', '1co', '1 corinthiens', 'psaumes'
    """
    if not query:
        return []
    
    q = query.strip()
    norm_q = strip_accents(q).lower()
    
    matches = []

    # 1. Tester Livre + Chapitre (+ Verset optionnel)
    # Regex captant: [1-4]? [lettres/espaces] [chiffres] [optionnel :. verset]
    # Gère aussi "rm4", "1co13", "ps23"
    m = re.match(r'^([1-4]?\s*[a-zà-ÿ]+(?:\s+[a-zà-ÿ]+)*)\s*(\d+)(?:[\s.:,](\d+))?$', norm_q)
    if m:
        raw_book = m.group(1).strip()
        chapter = int(m.group(2))
        verse = int(m.group(3)) if m.group(3) else None
        
        # Trouver le code livre
        book_key = re.sub(r'\s+', ' ', raw_book)
        book_code = BOOK_MAPPING.get(book_key)
        if not book_code:
            # Essayer sans espace (ex: "1corinthiens" -> "1 corinthiens")
            m_num = re.match(r'^([1-4])([a-z]+)$', book_key)
            if m_num:
                book_code = BOOK_MAPPING.get(f"{m_num.group(1)} {m_num.group(2)}")
                
        if book_code:
            matches.append({
                "book_code": book_code,
                "chapter": chapter,
                "verse": verse,
                "french_name": get_french_book_name(book_code)
            })

    # 2. Tester Livre collé au chiffre (ex: "rm4", "1co13", "ps23", "gen1")
    if not matches:
        m2 = re.match(r'^([1-4]?[a-z]+)(\d+)(?:[\s.:,](\d+))?$', norm_q)
        if m2:
            raw_b = m2.group(1)
            ch = int(m2.group(2))
            v = int(m2.group(3)) if m2.group(3) else None
            b_code = BOOK_MAPPING.get(raw_b)
            if not b_code:
                m_num = re.match(r'^([1-4])([a-z]+)$', raw_b)
                if m_num:
                    b_code = BOOK_MAPPING.get(f"{m_num.group(1)} {m_num.group(2)}")
            if b_code:
                matches.append({
                    "book_code": b_code,
                    "chapter": ch,
                    "verse": v,
                    "french_name": get_french_book_name(b_code)
                })

    # 3. Tester Nom ou abréviation de Livre seul (ex: "rm", "romains", "1co", "1 corinthiens")
    book_key = re.sub(r'\s+', ' ', norm_q)
    b_code = BOOK_MAPPING.get(book_key)
    if not b_code:
        m_num = re.match(r'^([1-4])([a-z]+)$', book_key)
        if m_num:
            b_code = BOOK_MAPPING.get(f"{m_num.group(1)} {m_num.group(2)}")
    if b_code and not any(m['book_code'] == b_code and m.get('chapter') is None for m in matches):
        matches.append({
            "book_code": b_code,
            "chapter": None,
            "verse": None,
            "french_name": get_french_book_name(b_code)
        })

    return matches

test_cases = [
    "rm 4", "Rm 4", "rm4", "romains 4", "Romains 4", "ro 4", "rom 4",
    "1co 13", "1 co 13", "1cor 13", "1 corinthiens 13", "1co13",
    "2 timothee 2", "2 tm 2", "2ti 2", "2 tim 2", "2ti2",
    "ps 23", "psaumes 23", "psaume 23", "ps23",
    "jean 3:16", "jn 3.16", "Jn 3 16", "jean 3 16", "jn3.16",
    "he 13", "hebreux 13", "hébreux 13", "heb 13",
    "ep 2", "eph 2", "ephesiens 2", "éphésiens 2",
    "gen 1", "genese 1", "genèse 1",
    "rm", "romains", "1co", "1 corinthiens", "psaumes"
]

for tc in test_cases:
    res = parse_bible_search_query(tc)
    print(f"Query: {tc:20} -> {res}")
