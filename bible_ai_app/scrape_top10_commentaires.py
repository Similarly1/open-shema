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

TOP_10_COMMENTARIES = [
    {
        "id": "3",
        "short_name": "calvin",
        "folder": "03_calvin",
        "title": "Commentaire Biblique de Jean Calvin",
        "author": "Jean Calvin",
        "slug": "commentaire-biblique-de-jean-calvin"
    },
    {
        "id": "2",
        "short_name": "matthew_henry",
        "folder": "02_matthew_henry",
        "title": "Commentaire Biblique de Matthew Henry",
        "author": "Matthew Henry",
        "slug": "commentaire-biblique-de-matthew-henry"
    },
    {
        "id": "7",
        "short_name": "adam_clarke",
        "folder": "07_adam_clarke",
        "title": "Commentaire Biblique de Adam Clarke",
        "author": "Adam Clarke",
        "slug": "commentaire-biblique-de-adam-clarke"
    },
    {
        "id": "4",
        "short_name": "albert_barnes",
        "folder": "04_albert_barnes",
        "title": "Commentaire Biblique par Albert Barnes",
        "author": "Albert Barnes",
        "slug": "commentaire-biblique-par-albert-barnes"
    },
    {
        "id": "8",
        "short_name": "john_gill",
        "folder": "08_john_gill",
        "title": "Commentaire Biblique de John Gill",
        "author": "John Gill",
        "slug": "commentaire-biblique-de-john-gill"
    },
    {
        "id": "9",
        "short_name": "spurgeon",
        "folder": "09_spurgeon",
        "title": "Commentaire Biblique de Charles Spurgeon",
        "author": "Charles Spurgeon",
        "slug": "commentaire-biblique-de-charles-spurgeon"
    },
    {
        "id": "6",
        "short_name": "scofield",
        "folder": "06_scofield",
        "title": "Commentaire Biblique de Scofield",
        "author": "C. I. Scofield",
        "slug": "commentaire-biblique-de-scofield"
    },
    {
        "id": "1",
        "short_name": "jfb",
        "folder": "01_jfb",
        "title": "Commentaire critique et explicatif sur toute la Bible (JFB)",
        "author": "Jamieson, Fausset & Brown",
        "slug": "commentaire-critique-et-explicatif-sur-toute-la-bible"
    },
    {
        "id": "87",
        "short_name": "geneve_1560",
        "folder": "87_geneve_1560",
        "title": "Commentaire de la Bible d'étude de Genève (1560)",
        "author": "Réformateurs de Genève",
        "slug": "commentaire-de-la-bible-detude-de-geneve"
    },
    {
        "id": "201",
        "short_name": "tsk",
        "folder": "201_tsk",
        "title": "Trésor de la connaissance des Écritures (TSK)",
        "author": "R. A. Torrey",
        "slug": "tresor-de-la-connaissance-des-ecritures"
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
    adapter = HTTPAdapter(max_retries=retry, pool_connections=30, pool_maxsize=30)
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

def scrape_verse_page(url: str) -> Optional[Dict[str, Any]]:
    soup = get_soup(url)
    if not soup:
        return None
    article = soup.find('article')
    if not article:
        return None
    content_div = article.find('div', class_='content')
    if not content_div:
        return None
    
    paragraphs = []
    p_tags = content_div.find_all('p', recursive=False) or content_div.find_all('p')
    for p in p_tags:
        t = clean_paragraph_text(p)
        if t:
            paragraphs.append(t)
            
    return {
        "paragraphs": paragraphs,
        "text": "\n\n".join(paragraphs),
        "html": str(content_div)
    }

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
        (comm_meta["id"], book_data["book_code"])
    )
    
    rows = []
    for ch in book_data["chapters"]:
        chap_num = ch["chapter"]
        for v in ch["verses"]:
            rows.append((
                comm_meta["id"],
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
                v["url"]
            ))
            
    cur.executemany("""
        INSERT INTO commentaries (
            commentary_id, commentary_name, book_code, book_name,
            chapter, verse_start, verse_end, reference, text, paragraphs_json, html, source_url
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, rows)
    
    conn.commit()
    conn.close()

def scrape_single_book(comm_meta: Dict[str, Any], book_slug: str, max_workers: int = 10) -> Optional[Dict[str, Any]]:
    book_name, book_code = BOOK_CODE_MAP.get(book_slug, (book_slug.capitalize(), book_slug[:3].capitalize()))
    book_url = f"{BASE_URL}/fr/commentaries/{comm_meta['id']}/{comm_meta['slug']}/{book_slug}"
    
    soup_book = get_soup(book_url)
    if not soup_book:
        return None
        
    listbox = soup_book.find('ul', class_='listbox')
    chap_links = []
    if listbox:
        for a in listbox.find_all('a'):
            c_text = a.get_text(strip=True)
            if c_text.isdigit():
                chap_links.append((int(c_text), a.get('href')))
    chap_links.sort(key=lambda x: x[0])
    
    if not chap_links:
        return None
        
    book_data = {
        "book_name": book_name,
        "book_code": book_code,
        "slug": book_slug,
        "url": book_url,
        "chapters": []
    }
    
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
                
        verse_items.sort(key=lambda x: (x[0], x[1]))
        
        verses_data = []
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            future_map = {executor.submit(scrape_verse_page, item[3]): item for item in verse_items}
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
        book_data["chapters"].append({
            "chapter": chap_num,
            "url": chap_url,
            "verse_count": len(verses_data),
            "verses": verses_data
        })
        
    return book_data

def run_commentary_scraper(comm_meta: Dict[str, Any], base_dir: str, db_path: str, max_workers: int = 10):
    comm_dir = os.path.join(base_dir, comm_meta["folder"])
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
        
        if book_data:
            with open(book_file, "w", encoding="utf-8") as f:
                json.dump(book_data, f, ensure_ascii=False, indent=2)
                
            total_verses = sum(len(ch["verses"]) for ch in book_data["chapters"])
            all_books_data.append(book_data)
            
            for ch in book_data["chapters"]:
                for v in ch["verses"]:
                    for k in v.get("keys", []):
                        flat_index[k] = {
                            "book": book_name,
                            "book_code": book_code,
                            "chapter": ch["chapter"],
                            "verse_start": v["verse_start"],
                            "verse_end": v["verse_end"],
                            "reference": v["reference"],
                            "text": v["text"],
                            "paragraphs": v["paragraphs"]
                        }
                        
            save_book_to_sqlite(db_path, comm_meta, book_data)
            t1 = time.time()
            print(f" OK en {t1-t0:.1f}s ({len(book_data['chapters'])} ch., {total_verses} versets)")
        else:
            print(f" ⚠️ Aucun contenu trouvé pour {book_name}")
            
    # Save full compilation
    full_obj = {
        "id": comm_meta["id"],
        "title": comm_meta["title"],
        "author": comm_meta["author"],
        "language": "fr",
        "source": root_url,
        "books_count": len(all_books_data),
        "books": all_books_data
    }
    
    full_file = os.path.join(comm_dir, f"{comm_meta['short_name']}_complet.json")
    with open(full_file, "w", encoding="utf-8") as f:
        json.dump(full_obj, f, ensure_ascii=False, indent=2)
        
    index_file = os.path.join(comm_dir, f"{comm_meta['short_name']}_index.json")
    with open(index_file, "w", encoding="utf-8") as f:
        json.dump(flat_index, f, ensure_ascii=False, indent=2)
        
    print(f"✨ Compilation terminée pour {comm_meta['title']}")
    print(f"   -> JSON complet : {full_file}")
    print(f"   -> Index versets : {index_file} ({len(flat_index)} clés de versets)")

def run_all_top10(base_dir: str = None, commentary_id_filter: Optional[str] = None):
    if base_dir is None:
        base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "data", "commentaires"))
        
    os.makedirs(base_dir, exist_ok=True)
    db_path = os.path.join(base_dir, "commentaires_master.db")
    init_sqlite_db(db_path)
    
    print(f"📁 Répertoire de destination : {base_dir}")
    print(f"💾 Base de données SQLite : {db_path}\n")
    
    target_list = TOP_10_COMMENTARIES
    if commentary_id_filter:
        target_list = [c for c in TOP_10_COMMENTARIES if c["id"] == str(commentary_id_filter) or c["short_name"] == commentary_id_filter]
        
    for comm in target_list:
        run_commentary_scraper(comm, base_dir, db_path, max_workers=10)
        
    print("\n=======================================================")
    print("🎉 TOUT LE SCRAPING EST TERMINÉ AVEC SUCCÈS !")
    print("=======================================================")

if __name__ == "__main__":
    cid = sys.argv[1] if len(sys.argv) > 1 else None
    run_all_top10(commentary_id_filter=cid)
