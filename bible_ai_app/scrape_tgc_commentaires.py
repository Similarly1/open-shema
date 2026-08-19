import sys
import os
import json
import time
import re
import sqlite3
from typing import Dict, List, Any, Optional, Tuple
import requests
from bs4 import BeautifulSoup

sys.stdout.reconfigure(encoding='utf-8')

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
    'Referer': 'https://evangile21.thegospelcoalition.org/'
}

FRENCH_TGC_BOOKS = [
    {
        "slug": "ruth",
        "book_name": "Ruth",
        "book_code": "Rut",
        "author": "John Currid",
        "title": "Commentaire de Ruth (John Currid)",
        "url": "https://evangile21.thegospelcoalition.org/commentary/ruth/"
    },
    {
        "slug": "matthieu",
        "book_name": "Matthieu",
        "book_code": "Mat",
        "author": "Douglas Sean O'Donnell",
        "title": "Commentaire de Matthieu (Douglas Sean O'Donnell)",
        "url": "https://evangile21.thegospelcoalition.org/commentary/matthieu/"
    },
    {
        "slug": "proverbes",
        "book_name": "Proverbes",
        "book_code": "Pro",
        "author": "Kathleen Nielson",
        "title": "Commentaire des Proverbes (Kathleen Nielson)",
        "url": "https://evangile21.thegospelcoalition.org/commentary/proverbes/"
    },
    {
        "slug": "daniel",
        "book_name": "Daniel",
        "book_code": "Dan",
        "author": "Mitchell L. Chase",
        "title": "Commentaire de Daniel (Mitchell L. Chase)",
        "url": "https://evangile21.thegospelcoalition.org/commentary/daniel/"
    },
    {
        "slug": "habakkuk",
        "book_name": "Habakuk",
        "book_code": "Hab",
        "author": "David G. Firth",
        "title": "Commentaire d'Habakuk (David G. Firth)",
        "url": "https://evangile21.thegospelcoalition.org/commentary/habakkuk/"
    },
    {
        "slug": "malachie",
        "book_name": "Malachie",
        "book_code": "Mal",
        "author": "Matthew P. Harmon",
        "title": "Commentaire de Malachie (Matthew P. Harmon)",
        "url": "https://evangile21.thegospelcoalition.org/commentary/malachie/"
    },
    {
        "slug": "ephesiens",
        "book_name": "Éphésiens",
        "book_code": "Eph",
        "author": "S. M. Baugh",
        "title": "Commentaire aux Éphésiens (S. M. Baugh)",
        "url": "https://evangile21.thegospelcoalition.org/commentary/ephesiens/"
    },
    {
        "slug": "philippiens",
        "book_name": "Philippiens",
        "book_code": "Phi",
        "author": "Mark Keown",
        "title": "Commentaire aux Philippiens (Mark Keown)",
        "url": "https://evangile21.thegospelcoalition.org/commentary/philippiens/"
    },
    {
        "slug": "jacques",
        "book_name": "Jacques",
        "book_code": "Jam",
        "author": "Dan Doriani",
        "title": "Commentaire de Jacques (Dan Doriani)",
        "url": "https://evangile21.thegospelcoalition.org/commentary/jacques/"
    }
]

FRENCH_NUMBERS = {
    'un': 1, 'premier': 1, 'premiere': 1, 'première': 1,
    'deux': 2, 'deuxieme': 2, 'deuxième': 2,
    'trois': 3, 'troisieme': 3, 'troisième': 3,
    'quatre': 4, 'quatrieme': 4, 'quatrième': 4,
    'cinq': 5, 'cinquieme': 5, 'cinquième': 5,
    'six': 6, 'sixieme': 6, 'sixième': 6,
    'sept': 7, 'septieme': 7, 'septième': 7,
    'huit': 8, 'huitieme': 8, 'huitième': 8,
    'neuf': 9, 'neuvieme': 9, 'neuvième': 9,
    'dix': 10, 'dixieme': 10, 'dixième': 10,
    'onze': 11, 'douze': 12, 'treize': 13, 'quatorze': 14, 'quinze': 15,
    'seize': 16, 'dix-sept': 17, 'dix-huit': 18, 'dix-neuf': 19, 'vingt': 20,
    'vingt et un': 21, 'vingt-deux': 22, 'vingt-trois': 23, 'vingt-quatre': 24,
    'vingt-cinq': 25, 'vingt-six': 26, 'vingt-sept': 27, 'vingt-huit': 28,
    'vingt-neuf': 29, 'trente': 30, 'trente et un': 31
}

def clean_text(text: str) -> str:
    if not text:
        return ""
    text = text.replace('\xa0', ' ').replace('\u200b', '').replace('\ufeff', '')
    text = re.sub(r'[ \t]+', ' ', text)
    return text.strip()

def parse_ref_string(text: str, current_chapter: int = 1) -> Optional[Tuple[int, int, int, int, str]]:
    cleaned = text.strip()

    # Détection "Chapitre X"
    m_chap = re.search(r'\b(?:Chapitre|Chapter)\s+([a-zA-Z0-9\-éèê]+)', cleaned, re.IGNORECASE)
    if m_chap:
        raw_val = m_chap.group(1).lower()
        if raw_val.isdigit():
            ch = int(raw_val)
        elif raw_val in FRENCH_NUMBERS:
            ch = FRENCH_NUMBERS[raw_val]
        else:
            ch = None
        if ch is not None:
            return ch, 1, ch, 999, f"Chapitre {ch}"

    # Détection C:V–C:V ou C:V–V ou C.V-V
    pattern = r'(?:[\(\[]\s*)?(\d+)\s*[:：.]\s*(\d+)(?:[a-zA-Z])?(?:\s*[-–—]\s*(?:(\d+)\s*[:：.]\s*)?(\d+)(?:[a-zA-Z])?)?(?:\s*[\)\]])?'
    m = re.search(pattern, cleaned)
    if m:
        c1 = int(m.group(1))
        v1 = int(m.group(2))
        c2 = int(m.group(3)) if m.group(3) else c1
        v2 = int(m.group(4)) if m.group(4) else v1
        matched_str = m.group(0).strip('()[] ')
        return c1, v1, c2, v2, matched_str

    # Détection verset seul dans le chapitre courant si préfixé (ex: "v. 12" ou "vv. 12-15")
    m_v = re.search(r'\bv{1,2}\.?\s*(\d+)(?:\s*[-–—]\s*(\d+))?', cleaned, re.IGNORECASE)
    if m_v:
        v1 = int(m_v.group(1))
        v2 = int(m_v.group(2)) if m_v.group(2) else v1
        return current_chapter, v1, current_chapter, v2, f"{current_chapter}:{v1}" if v1 == v2 else f"{current_chapter}:{v1}-{v2}"

    return None

def scrape_single_tgc_book(book_meta: Dict[str, Any], session: requests.Session, books_dir: str) -> Optional[Dict[str, Any]]:
    book_file = os.path.join(books_dir, f"{book_meta['book_code']}.json")
    
    url = book_meta["url"]
    print(f"   📥 Traitement de {book_meta['book_name']} ({url})...", end="", flush=True)
    t0 = time.time()
    
    try:
        resp = session.get(url, timeout=20)
        if resp.status_code != 200:
            print(f" ❌ Erreur HTTP {resp.status_code}")
            return None
    except Exception as e:
        print(f" ❌ Erreur connexion: {e}")
        return None

    soup = BeautifulSoup(resp.content, 'html.parser')
    col = soup.find('div', class_='commentary_column') or soup.find('div', class_='entry-content')
    if not col:
        print(f" ❌ Contenu non trouvé")
        return None

    elements = col.find_all(['h1', 'h2', 'h3', 'h4', 'h5', 'p'], recursive=True)
    
    raw_chunks = []
    current_c1 = 1
    current_v1 = 1
    current_c2 = 1
    current_v2 = 1
    current_title = "Éléments d'introduction"
    current_ref_label = ""
    current_paragraphs = []
    is_intro = True

    for e in elements:
        t = clean_text(e.get_text())
        if not t:
            continue

        if e.name.startswith('h'):
            ref_info = parse_ref_string(t, current_chapter=current_c1)
            if ref_info:
                if current_paragraphs:
                    raw_chunks.append({
                        "c1": current_c1, "v1": current_v1,
                        "c2": current_c2, "v2": current_v2,
                        "title": current_title,
                        "reference_label": current_ref_label or f"{book_meta['book_name']} {current_c1}:{current_v1}-{current_v2}",
                        "paragraphs": current_paragraphs,
                        "text": "\n\n".join(current_paragraphs)
                    })
                    current_paragraphs = []
                c1, v1, c2, v2, ref_str = ref_info
                current_c1, current_v1, current_c2, current_v2 = c1, v1, c2, v2
                current_title = t
                current_ref_label = f"{book_meta['book_name']} {ref_str}"
                is_intro = False
            else:
                if current_paragraphs and is_intro:
                    current_paragraphs.append(f"### {t}")
                elif current_paragraphs:
                    current_paragraphs.append(f"#### {t}")
                else:
                    current_title = t

        elif e.name == 'p':
            strong = e.find(['strong', 'b'])
            strong_text = clean_text(strong.get_text()) if strong else ""
            ref_info = parse_ref_string(strong_text, current_chapter=current_c1) if (strong_text and len(strong_text) < 40) else None
            
            if ref_info:
                if current_paragraphs:
                    raw_chunks.append({
                        "c1": current_c1, "v1": current_v1,
                        "c2": current_c2, "v2": current_v2,
                        "title": current_title,
                        "reference_label": current_ref_label or f"{book_meta['book_name']} {current_c1}:{current_v1}-{current_v2}",
                        "paragraphs": current_paragraphs,
                        "text": "\n\n".join(current_paragraphs)
                    })
                    current_paragraphs = []
                c1, v1, c2, v2, ref_str = ref_info
                current_c1, current_v1, current_c2, current_v2 = c1, v1, c2, v2
                current_title = f"{book_meta['book_name']} {ref_str}"
                current_ref_label = f"{book_meta['book_name']} {ref_str}"
                is_intro = False
                current_paragraphs.append(t)
            else:
                current_paragraphs.append(t)

    if current_paragraphs:
        raw_chunks.append({
            "c1": current_c1, "v1": current_v1,
            "c2": current_c2, "v2": current_v2,
            "title": current_title,
            "reference_label": current_ref_label or f"{book_meta['book_name']} {current_c1}:{current_v1}-{current_v2}",
            "paragraphs": current_paragraphs,
            "text": "\n\n".join(current_paragraphs)
        })

    # Expansion multi-chapitres et regroupement
    chapters_dict = {}
    total_expanded_chunks = 0

    for c in raw_chunks:
        c1, v1, c2, v2 = c["c1"], c["v1"], c["c2"], c["v2"]
        
        # Découpage si trans-chapitres (ex: 2:17 à 3:4 ou 5:1 à 7:29)
        for ch in range(c1, c2 + 1):
            if ch not in chapters_dict:
                chapters_dict[ch] = []
            
            if c1 == c2:
                eff_v_start = v1
                eff_v_end = v2
            elif ch == c1:
                eff_v_start = v1
                eff_v_end = 999
            elif ch == c2:
                eff_v_start = 1
                eff_v_end = v2
            else:
                eff_v_start = 1
                eff_v_end = 999
            
            # Génération des clés de versets
            max_v = min(eff_v_end, eff_v_start + 45) if eff_v_end < 900 else (eff_v_start + 35)
            keys = [f"{book_meta['book_code']}.{ch}.{vn}" for vn in range(eff_v_start, max_v + 1)]

            chapters_dict[ch].append({
                "chapter": ch,
                "verse_start": eff_v_start,
                "verse_end": eff_v_end,
                "title": c["title"],
                "reference": c["reference_label"],
                "keys": keys,
                "paragraphs": c["paragraphs"],
                "text": c["text"],
                "url": url
            })
            total_expanded_chunks += 1

    chapters_list = []
    for ch_num in sorted(chapters_dict.keys()):
        chapters_list.append({
            "chapter": ch_num,
            "verse_count": len(chapters_dict[ch_num]),
            "verses": chapters_dict[ch_num]
        })

    book_obj = {
        "book_name": book_meta["book_name"],
        "book_code": book_meta["book_code"],
        "slug": book_meta["slug"],
        "author": book_meta["author"],
        "title": book_meta["title"],
        "url": url,
        "total_chunks": total_expanded_chunks,
        "chapters": chapters_list
    }

    with open(book_file, "w", encoding="utf-8") as f:
        json.dump(book_obj, f, ensure_ascii=False, indent=2)

    t1 = time.time()
    print(f" OK en {t1-t0:.1f}s ({len(chapters_list)} chapitres, {total_expanded_chunks} passages indexés)")

    return book_obj

def init_sqlite_db(db_path: str):
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS commentaries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            commentary_id TEXT,
            commentary_name TEXT,
            book_code TEXT,
            book_name TEXT,
            chapter INTEGER,
            verse_start INTEGER,
            verse_end INTEGER,
            reference TEXT,
            text TEXT,
            paragraphs_json TEXT,
            html TEXT,
            source_url TEXT
        )
    """)
    cur.execute("CREATE INDEX IF NOT EXISTS idx_comm_book_chap ON commentaries (commentary_id, book_code, chapter, verse_start)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_book_chap_verse ON commentaries (book_code, chapter, verse_start)")
    conn.commit()
    conn.close()

def save_book_to_sqlite(db_path: str, comm_id: str, comm_name: str, book_data: Dict[str, Any]):
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    
    cur.execute(
        "DELETE FROM commentaries WHERE commentary_id = ? AND book_code = ?",
        (comm_id, book_data["book_code"])
    )
    
    rows = []
    for ch in book_data["chapters"]:
        chap_num = ch["chapter"]
        for v in ch["verses"]:
            rows.append((
                comm_id,
                comm_name,
                book_data["book_code"],
                book_data["book_name"],
                chap_num,
                v["verse_start"],
                v["verse_end"],
                f"{v['reference']} ({book_data['author']})",
                v["text"],
                json.dumps(v["paragraphs"], ensure_ascii=False),
                "",
                v.get("url", "")
            ))
            
    cur.executemany("""
        INSERT INTO commentaries (
            commentary_id, commentary_name, book_code, book_name,
            chapter, verse_start, verse_end, reference, text, paragraphs_json, html, source_url
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, rows)
    
    conn.commit()
    conn.close()

def run_tgc_scraping(delay_seconds: float = 2.0):
    base_dir = os.path.dirname(os.path.abspath(__file__))
    while not os.path.exists(os.path.join(base_dir, "core")):
        base_dir = os.path.dirname(base_dir)

    comm_dir = os.path.join(base_dir, "data", "commentaires", "tgc_evangile21")
    books_dir = os.path.join(comm_dir, "livres")
    os.makedirs(books_dir, exist_ok=True)

    db_path = os.path.join(base_dir, "data", "commentaires", "commentaires_master.db")
    init_sqlite_db(db_path)

    lib_path = os.path.join(base_dir, "data", "library.json")

    print("\n" + "=" * 65)
    print("📖 ENREGISTREMENT DES COMMENTAIRES ÉVANGILE 21 / THE GOSPEL COALITION")
    print(f"🌐 9 livres traduits en français | Pause: {delay_seconds}s")
    print(f"📁 Destination JSON: {comm_dir}")
    print(f"💾 Base SQLite: {db_path}")
    print("=" * 65 + "\n")

    session = requests.Session()
    session.headers.update(HEADERS)

    all_books_data = []
    flat_index = {}
    total_passages_all = 0
    comm_unified_name = "Commentaires Évangile 21 (TGC)"

    for idx, book_meta in enumerate(FRENCH_TGC_BOOKS, 1):
        print(f"[{idx}/{len(FRENCH_TGC_BOOKS)}] Livre: {book_meta['book_name']} ({book_meta['book_code']}) - Auteur: {book_meta['author']}")
        
        book_data = scrape_single_tgc_book(book_meta, session, books_dir)

        if book_data:
            all_books_data.append(book_data)
            total_passages_all += book_data["total_chunks"]

            # Save in SQLite with unified name
            save_book_to_sqlite(db_path, "tgc_evangile21", comm_unified_name, book_data)

            # Flat index
            for ch in book_data["chapters"]:
                for v in ch["verses"]:
                    for k in v.get("keys", []):
                        flat_index[k] = {
                            "book": book_data["book_name"],
                            "book_code": book_data["book_code"],
                            "author": book_data["author"],
                            "chapter": ch["chapter"],
                            "verse_start": v["verse_start"],
                            "verse_end": v["verse_end"],
                            "reference": v["reference"],
                            "text": v["text"]
                        }

        # Polite rate-limiting pause
        if idx < len(FRENCH_TGC_BOOKS):
            print(f"   ⏳ Pause de {delay_seconds}s...")
            time.sleep(delay_seconds)

    # Sauvegarde de la compilation globale
    compilation = {
        "id": "tgc_evangile21",
        "title": "Commentaires Bibliques Évangile 21 / The Gospel Coalition",
        "author": "Évangile 21 / The Gospel Coalition",
        "language": "fr",
        "source": "https://evangile21.thegospelcoalition.org/commentaires/",
        "total_books": len(all_books_data),
        "total_passages": total_passages_all,
        "books": all_books_data
    }

    comp_file = os.path.join(comm_dir, "tgc_evangile21_complet.json")
    with open(comp_file, "w", encoding="utf-8") as f:
        json.dump(compilation, f, ensure_ascii=False, indent=2)

    index_file = os.path.join(comm_dir, "tgc_evangile21_index.json")
    with open(index_file, "w", encoding="utf-8") as f:
        json.dump(flat_index, f, ensure_ascii=False, indent=2)

    print("\n" + "=" * 65)
    print("🎉 OPÉRATION TERMINÉE AVEC SUCCÈS !")
    print(f"📚 {len(all_books_data)} livres sauvegardés ({total_passages_all} passages au total).")
    print(f"📁 JSON complet : {comp_file}")
    print(f"📁 Index versets : {index_file} ({len(flat_index)} clés de versets)")
    print("=" * 65)

    # Inscription dans library.json
    if os.path.exists(lib_path):
        try:
            with open(lib_path, "r", encoding="utf-8") as f:
                lib = json.load(f)

            lib[comm_unified_name] = {
                "title": "Commentaires Bibliques Évangile 21 (The Gospel Coalition)",
                "author": "Évangile 21 / TGC (O'Donnell, Currid, Doriani, Nielson, etc.)",
                "description": f"Commentaires bibliques contemporains (9 livres en français, {total_passages_all} passages exégétiques).",
                "year": "2021-2024",
                "cover_path": None,
                "type": "Commentaire",
                "format": "sqlite",
                "commentary_id": "tgc_evangile21",
                "chunks_count": total_passages_all,
                "embedding_model": "study_library",
                "active": True
            }

            with open(lib_path, "w", encoding="utf-8") as f:
                json.dump(lib, f, ensure_ascii=False, indent=2)
            print(f"✔ Entrée ajoutée à library.json : '{comm_unified_name}'")
        except Exception as e:
            print(f"⚠️ Erreur mise à jour library.json: {e}")

if __name__ == "__main__":
    delay = float(sys.argv[1]) if len(sys.argv) > 1 else 2.0
    run_tgc_scraping(delay_seconds=delay)
