import sys
import os
import json
import time
import re
import sqlite3
from typing import Dict, List, Any, Optional, Tuple
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from bs4 import BeautifulSoup
from concurrent.futures import ThreadPoolExecutor, as_completed

sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = "https://www.bibliaplus.org"

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
}

BOOK_CODE_MAP = {
    "genese": ("Genèse", "Gen"), "exode": ("Exode", "Exo"), "levitique": ("Lévitique", "Lev"),
    "nombres": ("Nombres", "Num"), "deuteronome": ("Deutéronome", "Deu"), "josue": ("Josué", "Jos"),
    "juges": ("Juges", "Jdg"), "ruth": ("Ruth", "Rut"), "1-samuel": ("1 Samuel", "1Sa"),
    "2-samuel": ("2 Samuel", "2Sa"), "1-rois": ("1 Rois", "1Ki"), "2-rois": ("2 Rois", "2Ki"),
    "1-chroniques": ("1 Chroniques", "1Ch"), "2-chroniques": ("2 Chroniques", "2Ch"),
    "esdras": ("Esdras", "Ezr"), "nehemie": ("Néhémie", "Neh"), "esther": ("Esther", "Est"),
    "job": ("Job", "Job"), "psaume": ("Psaumes", "Psa"), "proverbes": ("Proverbes", "Pro"),
    "ecclesiaste": ("Ecclésiaste", "Ecc"), "cantique-des-cantiqu": ("Cantique des Cantiques", "Sol"),
    "esaie": ("Ésaïe", "Isa"), "jeremie": ("Jérémie", "Jer"), "lamentations": ("Lamentations", "Lam"),
    "ezechiel": ("Ézéchiel", "Eze"), "daniel": ("Daniel", "Dan"), "osee": ("Osée", "Hos"),
    "joel": ("Joël", "Joe"), "amos": ("Amos", "Amo"), "abdias": ("Abdias", "Oba"),
    "jonas": ("Jonas", "Jon"), "michee": ("Michée", "Mic"), "nahum": ("Nahum", "Nah"),
    "habacuc": ("Habacuc", "Hab"), "sophonie": ("Sophonie", "Zep"), "aggee": ("Aggée", "Hag"),
    "zacharie": ("Zacharie", "Zec"), "malachie": ("Malachie", "Mal"),
    "matthieu": ("Matthieu", "Mat"), "marc": ("Marc", "Mar"), "luc": ("Luc", "Luk"),
    "jean": ("Jean", "Joh"), "actes": ("Actes", "Act"), "romains": ("Romains", "Rom"),
    "1-corinthiens": ("1 Corinthiens", "1Co"), "2-corinthiens": ("2 Corinthiens", "2Co"),
    "galates": ("Galates", "Gal"), "ephesiens": ("Éphésiens", "Eph"), "philippiens": ("Philippiens", "Phi"),
    "colossiens": ("Colossiens", "Col"), "1-thesaloniciens": ("1 Thessaloniciens", "1Th"),
    "2-thesaloniciens": ("2 Thessaloniciens", "2Th"), "1-timothee": ("1 Timothée", "1Ti"),
    "2-timothee": ("2 Timothée", "2Ti"), "tite": ("Tite", "Tit"), "philemon": ("Philémon", "Phm"),
    "hebreux": ("Hébreux", "Heb"), "jaques": ("Jacques", "Jam"), "1-pierre": ("1 Pierre", "1Pe"),
    "2-pierre": ("2 Pierre", "2Pe"), "1-jean": ("1 Jean", "1Jo"), "2-jean": ("2 Jean", "2Jo"),
    "3-jean": ("3 Jean", "3Jo"), "jude": ("Jude", "Jud"), "apocalypse": ("Apocalypse", "Rev")
}

NEXT_10_COMMENTARIES = [
    {
        "id": "81",
        "short_name": "gaebelein",
        "folder": "81_gaebelein",
        "title": "Bible annotée par A.C. Gaebelein",
        "author": "A.C. Gaebelein",
        "slug": "bible-annotee-par-ac-gabelein"
    },
    {
        "id": "75",
        "short_name": "nicoll_expositor",
        "folder": "75_nicoll_expositor",
        "title": "Commentaire biblique de l'exposant (Nicoll)",
        "author": "W. Robertson Nicoll",
        "slug": "commentaire-biblique-de-lexposant-nicoll"
    },
    {
        "id": "5",
        "short_name": "pulpit",
        "folder": "05_pulpit",
        "title": "Commentaire Biblique de la chaire (Pulpit)",
        "author": "The Pulpit Commentary",
        "slug": "commentaire-biblique-de-la-chaire"
    },
    {
        "id": "195",
        "short_name": "john_trapp",
        "folder": "195_john_trapp",
        "title": "Commentaire complet de John Trapp",
        "author": "John Trapp",
        "slug": "commentaire-complet-de-john-trapp"
    },
    {
        "id": "147",
        "short_name": "arthur_peake",
        "folder": "147_arthur_peake",
        "title": "Commentaire d'Arthur Peake sur la Bible",
        "author": "Arthur Peake",
        "slug": "commentaire-darthur-peake-sur-la-bible"
    },
    {
        "id": "65",
        "short_name": "thomas_coke",
        "folder": "65_thomas_coke",
        "title": "Commentaire de Coke sur la Sainte Bible",
        "author": "Thomas Coke",
        "slug": "commentaire-de-coke-sur-la-sainte-bible"
    },
    {
        "id": "56",
        "short_name": "dummelow",
        "folder": "56_dummelow",
        "title": "Commentaire de Dummelow sur la Bible",
        "author": "J.R. Dummelow",
        "slug": "commentaire-de-dummelow-sur-la-bible"
    },
    {
        "id": "123",
        "short_name": "fb_meyer",
        "folder": "123_fb_meyer",
        "title": "Commentaire de Frederick Brotherton Meyer",
        "author": "F.B. Meyer",
        "slug": "commentaire-de-frederick-brotherton-meyer"
    },
    {
        "id": "59",
        "short_name": "joseph_benson",
        "folder": "59_joseph_benson",
        "title": "Commentaire de Joseph Benson (AT & NT)",
        "author": "Joseph Benson",
        "slug": "commentaire-de-joseph-benson-sur-lancien-et-le-nouveau-testament"
    },
    {
        "id": "165",
        "short_name": "sermon_bible",
        "folder": "165_sermon_bible",
        "title": "Commentaire de la Bible du sermon",
        "author": "The Sermon Bible",
        "slug": "commentaire-de-la-bible-du-sermon"
    }
]

def create_session() -> requests.Session:
    sess = requests.Session()
    sess.headers.update(HEADERS)
    retry = Retry(
        total=5,
        backoff_factor=0.3,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["GET"]
    )
    adapter = HTTPAdapter(max_retries=retry, pool_connections=35, pool_maxsize=35)
    sess.mount("http://", adapter)
    sess.mount("https://", adapter)
    return sess

session = create_session()

def get_soup(url: str, retries: int = 3, delay: float = 0.3) -> Optional[BeautifulSoup]:
    for attempt in range(retries):
        try:
            resp = session.get(url, timeout=12)
            if resp.status_code == 200:
                return BeautifulSoup(resp.content, 'html.parser')
            elif resp.status_code == 404:
                return None
        except Exception:
            if attempt < retries - 1:
                time.sleep(delay * (attempt + 1))
    return None

def clean_paragraph_text(p_tag) -> str:
    text = p_tag.get_text(separator=' ', strip=True)
    return re.sub(r'[ \t]+', ' ', text).strip()

def parse_verse_str(v_str: str) -> Tuple[int, int]:
    if '-' in v_str:
        parts = v_str.split('-')
        try:
            return int(parts[0]), int(parts[1])
        except ValueError:
            return 1, 1
    else:
        try:
            v = int(v_str)
            return v, v
        except ValueError:
            return 1, 1

def extract_article_content(soup: BeautifulSoup) -> Optional[Dict[str, Any]]:
    if not soup:
        return None
    article = soup.find('article')
    if not article:
        return None
    content_div = article.find('div', class_='content')
    if not content_div:
        return None
        
    paragraphs = []
    # Process structured blocks
    for elem in content_div.find_all(['p', 'h2', 'h3', 'h4', 'h5', 'blockquote']):
        txt = clean_paragraph_text(elem)
        if txt and len(txt) > 2:
            paragraphs.append(txt)
            
    # Fallback to direct strings if no p tags found
    if not paragraphs:
        for block in content_div.stripped_strings:
            cleaned = re.sub(r'[ \t]+', ' ', block).strip()
            if cleaned and len(cleaned) > 2:
                paragraphs.append(cleaned)
                
    if not paragraphs:
        return None
        
    return {
        "paragraphs": paragraphs,
        "text": "\n\n".join(paragraphs),
        "html": str(content_div)
    }

def scrape_content_page(url: str) -> Optional[Dict[str, Any]]:
    soup = get_soup(url)
    return extract_article_content(soup)

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

def save_book_to_sqlite(db_path: str, comm_meta: Dict[str, Any], book_data: Dict[str, Any]):
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    
    cur.execute(
        "DELETE FROM commentaries WHERE commentary_id = ? AND book_code = ?",
        (str(comm_meta["id"]), book_data["book_code"])
    )
    
    rows = []
    for ch in book_data["chapters"]:
        chap_num = ch["chapter"]
        for v in ch["verses"]:
            rows.append((
                str(comm_meta["id"]),
                comm_meta["title"],
                book_data["book_code"],
                book_data["book_name"],
                chap_num,
                v["verse_start"],
                v["verse_end"],
                v["reference"],
                v["text"],
                json.dumps(v["paragraphs"], ensure_ascii=False),
                v["html"],
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

def scrape_single_book(comm_meta: Dict[str, Any], book_slug: str, max_workers: int = 15) -> Optional[Dict[str, Any]]:
    book_name, book_code = BOOK_CODE_MAP.get(book_slug, (book_slug.capitalize(), book_slug[:3].capitalize()))
    book_url = f"{BASE_URL}/fr/commentaries/{comm_meta['id']}/{comm_meta['slug']}/{book_slug}"
    
    soup_book = get_soup(book_url)
    if not soup_book:
        return None
        
    listbox = soup_book.find('ul', class_='listbox')
    chap_links = []
    has_intro_in_listbox = False
    
    if listbox:
        for a in listbox.find_all('a'):
            href = a.get('href', '')
            c_text = a.get_text(strip=True)
            if 'intro' in href.lower() or 'intro' in c_text.lower():
                has_intro_in_listbox = True
            elif c_text.isdigit():
                chap_links.append((int(c_text), href))
                
    chap_links.sort(key=lambda x: x[0])
    
    book_data = {
        "book_name": book_name,
        "book_code": book_code,
        "slug": book_slug,
        "url": book_url,
        "chapters": []
    }
    
    # 1. Scrape Introduction if available
    intro_url = f"{book_url}/introduction"
    intro_res = scrape_content_page(intro_url)
    if intro_res:
        book_data["chapters"].append({
            "chapter": 0,
            "url": intro_url,
            "verse_count": 1,
            "verses": [{
                "verse_start": 0,
                "verse_end": 0,
                "reference": f"{book_name} - Introduction",
                "keys": [f"{book_code}.0.0", f"{book_code}.intro"],
                "url": intro_url,
                "paragraphs": intro_res["paragraphs"],
                "text": intro_res["text"],
                "html": intro_res["html"]
            }]
        })
    
    # 2. Scrape each chapter
    for chap_num, chap_url in chap_links:
        chap_soup = get_soup(chap_url)
        if not chap_soup:
            continue
            
        verse_items = []
        for a in chap_soup.find_all('a', class_='list-group-item-title-link'):
            href = a.get('href', '')
            match = re.search(r'/([^/]+)$', href.rstrip('/'))
            if match:
                v_str = match.group(1)
                v_start, v_end = parse_verse_str(v_str)
                ref_label = a.get_text(strip=True)
                verse_items.append((v_start, v_end, ref_label, href))
                
        verses_data = []
        
        if verse_items:
            # Mode A: Verse-level commentary
            verse_items.sort(key=lambda x: (x[0], x[1]))
            with ThreadPoolExecutor(max_workers=max_workers) as executor:
                future_map = {executor.submit(scrape_content_page, item[3]): item for item in verse_items}
                for future in as_completed(future_map):
                    v_start, v_end, ref_label, v_url = future_map[future]
                    res = future.result()
                    if res:
                        keys = [f"{book_code}.{chap_num}.{vn}" for vn in range(v_start, v_end + 1)]
                        verses_data.append({
                            "verse_start": v_start,
                            "verse_end": v_end,
                            "reference": ref_label if ref_label else (f"{book_name} {chap_num}:{v_start}" if v_start == v_end else f"{book_name} {chap_num}:{v_start}-{v_end}"),
                            "keys": keys,
                            "url": v_url,
                            "paragraphs": res["paragraphs"],
                            "text": res["text"],
                            "html": res["html"]
                        })
            verses_data.sort(key=lambda x: (x["verse_start"], x["verse_end"]))
        else:
            # Mode B: Chapter-level commentary directly on chapter page
            chap_res = extract_article_content(chap_soup)
            if chap_res and len(chap_res["text"]) > 40:
                verses_data.append({
                    "verse_start": 1,
                    "verse_end": 999,
                    "reference": f"{book_name} {chap_num}",
                    "keys": [f"{book_code}.{chap_num}"],
                    "url": chap_url,
                    "paragraphs": chap_res["paragraphs"],
                    "text": chap_res["text"],
                    "html": chap_res["html"]
                })
                
        if verses_data:
            book_data["chapters"].append({
                "chapter": chap_num,
                "url": chap_url,
                "verse_count": len(verses_data),
                "verses": verses_data
            })
            
    return book_data

def update_library_registration(comm_meta: Dict[str, Any], total_passages: int, base_dir: str):
    lib_path = os.path.join(base_dir, "data", "library.json")
    if not os.path.exists(lib_path):
        return
    try:
        with open(lib_path, "r", encoding="utf-8") as f:
            lib = json.load(f)
        
        # Check if already exists
        exists = any(item.get("name") == comm_meta["title"] for item in lib)
        if not exists:
            lib.append({
                "name": comm_meta["title"],
                "author": comm_meta["author"],
                "type": "Commentaire",
                "chunks_count": total_passages,
                "active": True
            })
            with open(lib_path, "w", encoding="utf-8") as f:
                json.dump(lib, f, ensure_ascii=False, indent=2)
            print(f"📖 Enregistré dans library.json: {comm_meta['title']}")
    except Exception as e:
        print(f"Erreur mise à jour library.json: {e}")

def run_commentary_scraper(comm_meta: Dict[str, Any], base_dir: str, db_path: str, max_workers: int = 15):
    comm_dir = os.path.join(base_dir, "data", "commentaires", comm_meta["folder"])
    books_dir = os.path.join(comm_dir, "livres")
    os.makedirs(books_dir, exist_ok=True)
    
    root_url = f"{BASE_URL}/fr/commentaries/{comm_meta['id']}/{comm_meta['slug']}"
    print(f"\n=======================================================")
    print(f"📖 [{comm_meta['id']}] {comm_meta['title']}")
    print(f"URL: {root_url}")
    print(f"=======================================================")
    
    soup_root = get_soup(root_url)
    if not soup_root:
        print(f"❌ Impossible d'accéder à {root_url}")
        return
        
    sec_books = soup_root.find('section', class_='bible_books')
    book_slugs = []
    if sec_books:
        for a in sec_books.find_all('a'):
            slug = a.get('href', '').rstrip('/').split('/')[-1]
            if slug and slug not in book_slugs:
                book_slugs.append(slug)
                
    print(f"📚 {len(book_slugs)} livres trouvés dans ce commentaire.\n")
    
    all_books_data = []
    flat_index = {}
    
    for idx, b_slug in enumerate(book_slugs, 1):
        book_name, book_code = BOOK_CODE_MAP.get(b_slug, (b_slug.capitalize(), b_slug[:3].capitalize()))
        book_file = os.path.join(books_dir, f"{book_code}.json")
        
        # Check cache
        if os.path.exists(book_file) and os.path.getsize(book_file) > 100:
            try:
                with open(book_file, "r", encoding="utf-8") as f:
                    book_data = json.load(f)
                total_verses = sum(len(ch["verses"]) for ch in book_data["chapters"])
                print(f"[{idx:2d}/{len(book_slugs)}] ✔ {book_name} ({book_code}) déjà en cache ({total_verses} passages).")
                all_books_data.append(book_data)
                for ch in book_data["chapters"]:
                    for v in ch["verses"]:
                        for k in v.get("keys", [f"{book_code}.{ch['chapter']}.{v.get('verse_start', 1)}"]):
                            flat_index[k] = {
                                "book": book_name,
                                "book_code": book_code,
                                "chapter": ch["chapter"],
                                "verse_start": v.get("verse_start", 1),
                                "verse_end": v.get("verse_end", 1),
                                "reference": v["reference"],
                                "text": v["text"],
                                "paragraphs": v["paragraphs"]
                            }
                save_book_to_sqlite(db_path, comm_meta, book_data)
                continue
            except Exception as e:
                print(f"Erreur lecture cache {book_code}: {e}, re-téléchargement...")
                
        print(f"[{idx:2d}/{len(book_slugs)}] ⏳ Scraping de {book_name} ({book_code})...", end="", flush=True)
        t0 = time.time()
        book_data = scrape_single_book(comm_meta, b_slug, max_workers=max_workers)
        t1 = time.time()
        
        if book_data and book_data["chapters"]:
            total_verses = sum(len(ch["verses"]) for ch in book_data["chapters"])
            intros_count = sum(1 for ch in book_data["chapters"] if ch["chapter"] == 0)
            print(f" ✔ {len(book_data['chapters'])} chapitres, {total_verses} passages ({intros_count} intro) en {t1-t0:.1f}s.")
            
            with open(book_file, "w", encoding="utf-8") as f:
                json.dump(book_data, f, ensure_ascii=False, indent=2)
                
            all_books_data.append(book_data)
            for ch in book_data["chapters"]:
                for v in ch["verses"]:
                    for k in v.get("keys", [f"{book_code}.{ch['chapter']}.{v.get('verse_start', 1)}"]):
                        flat_index[k] = {
                            "book": book_name,
                            "book_code": book_code,
                            "chapter": ch["chapter"],
                            "verse_start": v.get("verse_start", 1),
                            "verse_end": v.get("verse_end", 1),
                            "reference": v["reference"],
                            "text": v["text"],
                            "paragraphs": v["paragraphs"]
                        }
            save_book_to_sqlite(db_path, comm_meta, book_data)
        else:
            print(" ⚠️ Aucun contenu trouvé.")
            
    # Save global files
    full_json_path = os.path.join(comm_dir, f"{comm_meta['short_name']}_full.json")
    with open(full_json_path, "w", encoding="utf-8") as f:
        json.dump({
            "metadata": comm_meta,
            "books_count": len(all_books_data),
            "books": all_books_data
        }, f, ensure_ascii=False, indent=2)
        
    flat_json_path = os.path.join(comm_dir, f"{comm_meta['short_name']}_flat_index.json")
    with open(flat_json_path, "w", encoding="utf-8") as f:
        json.dump(flat_index, f, ensure_ascii=False, indent=2)
        
    print(f"\n✅ {comm_meta['title']} terminé : {len(flat_index)} passages indexés.")
    update_library_registration(comm_meta, len(flat_index), base_dir)

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    db_path = os.path.join(base_dir, "data", "commentaires", "commentaires_master.db")
    init_sqlite_db(db_path)
    
    print("=" * 60)
    print(f"🚀 LANCEMENT DU SCRAPER PROPRE - 10 PROCHAINS COMMENTAIRES")
    print(f"Base SQLite: {db_path}")
    print(f"Commentaires à traiter: {len(NEXT_10_COMMENTARIES)}")
    print("=" * 60)
    
    total_start = time.time()
    for idx, comm in enumerate(NEXT_10_COMMENTARIES, 1):
        print(f"\n>>> [{idx}/{len(NEXT_10_COMMENTARIES)}] Début du scraping de : {comm['title']}")
        run_commentary_scraper(comm, base_dir, db_path, max_workers=20)
        
    print("\n" + "=" * 60)
    print(f"🎉 TOUS LES 10 COMMENTAIRES ONT ÉTÉ SCRAPÉS ET INDEXÉS EN {time.time() - total_start:.1f}s !")
    print("=" * 60)

if __name__ == "__main__":
    main()
