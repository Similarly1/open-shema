import sys
import os
import json
import time
import re
import sqlite3
from typing import Dict, List, Any, Optional, Tuple
from concurrent.futures import ThreadPoolExecutor, as_completed
import requests
from bs4 import BeautifulSoup

sys.stdout.reconfigure(encoding='utf-8')

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
    'Referer': 'https://www.levangile.com/'
}

BIBLE_BOOKS_CONFIG = [
    # Ancien Testament
    {"slug": "genese", "name": "Genèse", "code": "Gen", "chapters": 50},
    {"slug": "exode", "name": "Exode", "code": "Exo", "chapters": 40},
    {"slug": "levitique", "name": "Lévitique", "code": "Lev", "chapters": 27},
    {"slug": "nombres", "name": "Nombres", "code": "Num", "chapters": 36},
    {"slug": "deuteronome", "name": "Deutéronome", "code": "Deu", "chapters": 34},
    {"slug": "josue", "name": "Josué", "code": "Jos", "chapters": 24},
    {"slug": "juges", "name": "Juges", "code": "Jdg", "chapters": 21},
    {"slug": "ruth", "name": "Ruth", "code": "Rut", "chapters": 4},
    {"slug": "1samuel", "name": "1 Samuel", "code": "1Sa", "chapters": 31},
    {"slug": "2samuel", "name": "2 Samuel", "code": "2Sa", "chapters": 24},
    {"slug": "1rois", "name": "1 Rois", "code": "1Ki", "chapters": 22},
    {"slug": "2rois", "name": "2 Rois", "code": "2Ki", "chapters": 25},
    {"slug": "1chroniques", "name": "1 Chroniques", "code": "1Ch", "chapters": 29},
    {"slug": "2chroniques", "name": "2 Chroniques", "code": "2Ch", "chapters": 36},
    {"slug": "esdras", "name": "Esdras", "code": "Ezr", "chapters": 10},
    {"slug": "nehemie", "name": "Néhémie", "code": "Neh", "chapters": 13},
    {"slug": "esther", "name": "Esther", "code": "Est", "chapters": 10},
    {"slug": "job", "name": "Job", "code": "Job", "chapters": 42},
    {"slug": "psaumes", "name": "Psaumes", "code": "Psa", "chapters": 150},
    {"slug": "proverbes", "name": "Proverbes", "code": "Pro", "chapters": 31},
    {"slug": "ecclesiaste", "name": "Ecclésiaste", "code": "Ecc", "chapters": 12},
    {"slug": "cantique", "name": "Cantique des Cantiques", "code": "Sol", "chapters": 8},
    {"slug": "esaie", "name": "Ésaïe", "code": "Isa", "chapters": 66},
    {"slug": "jeremie", "name": "Jérémie", "code": "Jer", "chapters": 52},
    {"slug": "lamentations", "name": "Lamentations", "code": "Lam", "chapters": 5},
    {"slug": "ezechiel", "name": "Ézéchiel", "code": "Eze", "chapters": 48},
    {"slug": "daniel", "name": "Daniel", "code": "Dan", "chapters": 12},
    {"slug": "osee", "name": "Osée", "code": "Hos", "chapters": 14},
    {"slug": "joel", "name": "Joël", "code": "Joe", "chapters": 3},
    {"slug": "amos", "name": "Amos", "code": "Amo", "chapters": 9},
    {"slug": "abdias", "name": "Abdias", "code": "Oba", "chapters": 1},
    {"slug": "jonas", "name": "Jonas", "code": "Jon", "chapters": 4},
    {"slug": "michee", "name": "Michée", "code": "Mic", "chapters": 7},
    {"slug": "nahum", "name": "Nahum", "code": "Nah", "chapters": 3},
    {"slug": "habakuk", "name": "Habakuk", "code": "Hab", "chapters": 3},
    {"slug": "sophonie", "name": "Sophonie", "code": "Zep", "chapters": 3},
    {"slug": "aggee", "name": "Aggée", "code": "Hag", "chapters": 2},
    {"slug": "zacharie", "name": "Zacharie", "code": "Zec", "chapters": 14},
    {"slug": "malachie", "name": "Malachie", "code": "Mal", "chapters": 4},

    # Nouveau Testament
    {"slug": "matthieu", "name": "Matthieu", "code": "Mat", "chapters": 28},
    {"slug": "marc", "name": "Marc", "code": "Mar", "chapters": 16},
    {"slug": "luc", "name": "Luc", "code": "Luk", "chapters": 24},
    {"slug": "jean", "name": "Jean", "code": "Joh", "chapters": 21},
    {"slug": "actes", "name": "Actes", "code": "Act", "chapters": 28},
    {"slug": "romains", "name": "Romains", "code": "Rom", "chapters": 16},
    {"slug": "1corinthiens", "name": "1 Corinthiens", "code": "1Co", "chapters": 16},
    {"slug": "2corinthiens", "name": "2 Corinthiens", "code": "2Co", "chapters": 13},
    {"slug": "galates", "name": "Galates", "code": "Gal", "chapters": 6},
    {"slug": "ephesiens", "name": "Éphésiens", "code": "Eph", "chapters": 6},
    {"slug": "philippiens", "name": "Philippiens", "code": "Phi", "chapters": 4},
    {"slug": "colossiens", "name": "Colossiens", "code": "Col", "chapters": 4},
    {"slug": "1thessaloniciens", "name": "1 Thessaloniciens", "code": "1Th", "chapters": 5},
    {"slug": "2thessaloniciens", "name": "2 Thessaloniciens", "code": "2Th", "chapters": 3},
    {"slug": "1timothee", "name": "1 Timothée", "code": "1Ti", "chapters": 6},
    {"slug": "2timothee", "name": "2 Timothée", "code": "2Ti", "chapters": 4},
    {"slug": "tite", "name": "Tite", "code": "Tit", "chapters": 3},
    {"slug": "philemon", "name": "Philémon", "code": "Phm", "chapters": 1},
    {"slug": "hebreux", "name": "Hébreux", "code": "Heb", "chapters": 13},
    {"slug": "jacques", "name": "Jacques", "code": "Jam", "chapters": 5},
    {"slug": "1pierre", "name": "1 Pierre", "code": "1Pe", "chapters": 5},
    {"slug": "2pierre", "name": "2 Pierre", "code": "2Pe", "chapters": 3},
    {"slug": "1jean", "name": "1 Jean", "code": "1Jo", "chapters": 5},
    {"slug": "2jean", "name": "2 Jean", "code": "2Jo", "chapters": 1},
    {"slug": "3jean", "name": "3 Jean", "code": "3Jo", "chapters": 1},
    {"slug": "jude", "name": "Jude", "code": "Jud", "chapters": 1},
    {"slug": "apocalypse", "name": "Apocalypse", "code": "Rev", "chapters": 22}
]

def clean_inline_tags(node):
    """Transforme les balises inline en Markdown riche."""
    for strong in node.find_all(['strong', 'b']):
        s_text = strong.get_text(strip=True)
        if s_text:
            strong.replace_with(f" **{s_text}** ")

    for em in node.find_all(['em', 'i']):
        e_text = em.get_text(strip=True)
        if e_text:
            em.replace_with(f" *{e_text}* ")

    for span in node.find_all('span', class_='quick_pick'):
        sp_text = span.get_text(strip=True)
        span.replace_with(f" [{sp_text}] ")

def node_to_markdown(div) -> Tuple[str, List[str]]:
    """Convertit un div de note HTML en Markdown riche et structuré avec titres et lemmes."""
    div_clone = BeautifulSoup(str(div), 'html.parser').find(div.name)
    if not div_clone:
        return "", []
        
    clean_inline_tags(div_clone)
    
    blocks = []
    
    for child in div_clone.children:
        if not child.name:
            t = child.string.strip() if child.string else ''
            if t:
                blocks.append(t)
            continue
            
        if child.name in ['h1', 'h2', 'h3', 'h4']:
            h_text = child.get_text(separator=' ', strip=True)
            h_text = re.sub(r'[ \t]+', ' ', h_text).strip()
            if h_text:
                blocks.append(f"## {h_text}")
        elif child.name in ['p', 'div', 'blockquote']:
            p_text = child.get_text(separator=' ', strip=True)
            p_text = re.sub(r'[ \t]+', ' ', p_text)
            p_text = re.sub(r' \.', '.', p_text)
            p_text = re.sub(r' \,', ',', p_text)
            p_text = re.sub(r' \;', ';', p_text)
            p_text = re.sub(r' \:', ' :', p_text)
            p_text = re.sub(r' \)', ')', p_text)
            p_text = re.sub(r'\( ', '(', p_text)
            p_text = re.sub(r'\[ ', '[', p_text)
            p_text = re.sub(r' \]', ']', p_text)
            p_text = re.sub(r'\* \*', ' ', p_text)
            p_text = re.sub(r'\*\*\s+\*\*', ' ', p_text)
            # Mettre en valeur les lemmes commentés en début de phrase : *La terre* . -> **La terre.**
            p_text = re.sub(r'^\s*\*([^\*]+)\*\s*(\.|\:)', r'**\1\2**', p_text)
            p_text = re.sub(r'(\n|\.\s+)\*([^\*]+)\*\s*(\.|\:)', r'\1**\2\3**', p_text)
            if p_text.strip():
                blocks.append(p_text.strip())

    full_text = "\n\n".join(blocks)
    return full_text, blocks

def scrape_chapter_notes(slug: str, chapter: int, session: requests.Session) -> List[Dict[str, Any]]:
    url = f"https://www.levangile.com/bible-annotee-double-colonne-{slug}-{chapter}"
    try:
        resp = session.get(url, timeout=15)
        if resp.status_code != 200:
            return []
    except Exception as e:
        print(f"    ⚠️ Erreur sur {url}: {e}")
        return []

    soup = BeautifulSoup(resp.content, 'html.parser')
    verses_data = []

    for div in soup.find_all('div', id=True):
        div_id = div['id']
        m = re.match(r'^note_(\d+)$', div_id)
        if m:
            v_num = int(m.group(1))
            full_text, paragraphs = node_to_markdown(div)

            if paragraphs or full_text:
                verses_data.append({
                    "verse_start": v_num,
                    "verse_end": v_num,
                    "paragraphs": paragraphs,
                    "text": full_text
                })

    verses_data.sort(key=lambda x: x["verse_start"])
    return verses_data

def scrape_single_book(book_config: Dict[str, Any], session: requests.Session, books_dir: str, delay: float = 0.2, force: bool = False) -> Dict[str, Any]:
    book_file = os.path.join(books_dir, f"{book_config['code']}.json")
    
    # Vérifier cache si non forcé
    if not force and os.path.exists(book_file) and os.path.getsize(book_file) > 1000:
        try:
            with open(book_file, "r", encoding="utf-8") as f:
                cached = json.load(f)
            # Vérifier si les titres '##' sont présents dans le cache
            if len(cached.get("chapters", [])) == book_config["chapters"]:
                has_md = any("##" in v.get("text", "") for ch in cached["chapters"] for v in ch.get("verses", []))
                if has_md:
                    total_v = sum(c["verse_count"] for c in cached["chapters"])
                    print(f"✔ {book_config['name']} ({book_config['code']}) chargé depuis le cache ({len(cached['chapters'])} ch., {total_v} notes enrichies).")
                    return cached
        except Exception:
            pass

    print(f"⏳ Scraping enrichi de {book_config['name']} ({book_config['code']}) - {book_config['chapters']} chapitres...")
    t0 = time.time()
    
    chapters_list = []
    total_notes = 0

    for ch in range(1, book_config["chapters"] + 1):
        verses = scrape_chapter_notes(book_config["slug"], ch, session)
        
        formatted_verses = []
        for v in verses:
            v_start = v["verse_start"]
            v_end = v["verse_end"]
            formatted_verses.append({
                "verse_start": v_start,
                "verse_end": v_end,
                "reference": f"{book_config['name']} {ch}:{v_start}" if v_start == v_end else f"{book_config['name']} {ch}:{v_start}-{v_end}",
                "keys": [f"{book_config['code']}.{ch}.{vn}" for vn in range(v_start, v_end + 1)],
                "paragraphs": v["paragraphs"],
                "text": v["text"]
            })

        chapters_list.append({
            "chapter": ch,
            "verse_count": len(formatted_verses),
            "verses": formatted_verses
        })
        total_notes += len(formatted_verses)
        
        if delay > 0:
            time.sleep(delay)

    book_obj = {
        "book_name": book_config["name"],
        "book_code": book_config["code"],
        "slug": book_config["slug"],
        "author": "Frédéric Godet et collaborateurs (Neuchâtel)",
        "title": f"Bible annotée - {book_config['name']}",
        "total_chapters": len(chapters_list),
        "total_notes": total_notes,
        "chapters": chapters_list
    }

    with open(book_file, "w", encoding="utf-8") as f:
        json.dump(book_obj, f, ensure_ascii=False, indent=2)

    t1 = time.time()
    print(f"   ✔ Terminé en {t1-t0:.1f}s ({len(chapters_list)} chapitres, {total_notes} notes de versets).")
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
                v["reference"],
                v["text"],
                json.dumps(v["paragraphs"], ensure_ascii=False),
                "",
                f"https://www.levangile.com/bible-annotee-commentaire-{book_data['slug']}-{chap_num}"
            ))
            
    cur.executemany("""
        INSERT INTO commentaries (
            commentary_id, commentary_name, book_code, book_name,
            chapter, verse_start, verse_end, reference, text, paragraphs_json, html, source_url
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, rows)
    
    conn.commit()
    conn.close()

def run_godet_scraping(delay_seconds: float = 0.2, force: bool = True):
    base_dir = os.path.dirname(os.path.abspath(__file__))
    while not os.path.exists(os.path.join(base_dir, "core")):
        base_dir = os.path.dirname(base_dir)

    comm_dir = os.path.join(base_dir, "data", "commentaires", "bible_annotee_godet")
    books_dir = os.path.join(comm_dir, "livres")
    os.makedirs(books_dir, exist_ok=True)

    db_path = os.path.join(base_dir, "data", "commentaires", "commentaires_master.db")
    init_sqlite_db(db_path)

    lib_path = os.path.join(base_dir, "data", "library.json")

    print("\n" + "=" * 70)
    print("📖 SCRAPING ENRICHI DE LA BIBLE ANNOTÉE (FRÉDÉRIC GODET & NEUCHÂTEL)")
    print(f"🌐 66 livres / 1 189 chapitres | Extraction complète des titres et lemmes")
    print(f"📁 Destination JSON: {comm_dir}")
    print(f"💾 Base SQLite: {db_path}")
    print("=" * 70 + "\n")

    session = requests.Session()
    session.headers.update(HEADERS)

    comm_id = "godet_ba"
    comm_unified_name = "Bible annotée (Frédéric Godet)"

    all_books_data = []
    flat_index = {}
    total_notes_all = 0

    t_start = time.time()

    for idx, b_cfg in enumerate(BIBLE_BOOKS_CONFIG, 1):
        print(f"[{idx:2d}/{len(BIBLE_BOOKS_CONFIG)}] {b_cfg['name']} ({b_cfg['code']}) : ", end="", flush=True)
        book_data = scrape_single_book(b_cfg, session, books_dir, delay=delay_seconds, force=force)

        if book_data:
            all_books_data.append(book_data)
            total_notes_all += book_data.get("total_notes", 0)

            # Enregistrer dans SQLite
            save_book_to_sqlite(db_path, comm_id, comm_unified_name, book_data)

            # Flat index
            for ch in book_data["chapters"]:
                for v in ch["verses"]:
                    for k in v.get("keys", []):
                        flat_index[k] = {
                            "book": book_data["book_name"],
                            "book_code": book_data["book_code"],
                            "chapter": ch["chapter"],
                            "verse_start": v["verse_start"],
                            "verse_end": v["verse_end"],
                            "reference": v["reference"],
                            "text": v["text"]
                        }

    # Sauvegarde de la compilation globale
    compilation = {
        "id": comm_id,
        "title": "Bible annotée (Frédéric Godet et collaborateurs)",
        "author": "Frédéric Godet, Louis Bonnet, Félix Bovet (Société Biblique de Neuchâtel)",
        "language": "fr",
        "source": "https://www.levangile.com/Bible-Annotee.php",
        "total_books": len(all_books_data),
        "total_notes": total_notes_all,
        "books": all_books_data
    }

    comp_file = os.path.join(comm_dir, "bible_annotee_complet.json")
    with open(comp_file, "w", encoding="utf-8") as f:
        json.dump(compilation, f, ensure_ascii=False, indent=2)

    index_file = os.path.join(comm_dir, "bible_annotee_index.json")
    with open(index_file, "w", encoding="utf-8") as f:
        json.dump(flat_index, f, ensure_ascii=False, indent=2)

    t_end = time.time()
    print("\n" + "=" * 70)
    print("🎉 SCRAPING ENRICHI DE LA BIBLE ANNOTÉE TERMINÉ AVEC SUCCÈS !")
    print(f"⏱️ Durée totale : {(t_end - t_start)/60:.1f} minutes")
    print(f"📚 {len(all_books_data)} livres sauvegardés ({total_notes_all} notes exégétiques au total).")
    print(f"📁 JSON complet : {comp_file}")
    print(f"📁 Index versets : {index_file} ({len(flat_index)} clés de versets)")
    print("=" * 70)

    # Inscription dans library.json
    if os.path.exists(lib_path):
        try:
            with open(lib_path, "r", encoding="utf-8") as f:
                lib = json.load(f)

            lib[comm_unified_name] = {
                "title": "Bible annotée (Frédéric Godet & Neuchâtel)",
                "author": "Frédéric Godet, Louis Bonnet, Félix Bovet",
                "description": f"Monumental commentaire exégétique et théologique réformé francophone du XIXe siècle ({total_notes_all} notes verset par verset sur toute la Bible).",
                "year": "1899-1900",
                "cover_path": None,
                "type": "Commentaire",
                "format": "sqlite",
                "commentary_id": comm_id,
                "chunks_count": total_notes_all,
                "embedding_model": "study_library",
                "active": True
            }

            with open(lib_path, "w", encoding="utf-8") as f:
                json.dump(lib, f, ensure_ascii=False, indent=2)
            print(f"✔ Entrée ajoutée à library.json : '{comm_unified_name}'")
        except Exception as e:
            print(f"⚠️ Erreur mise à jour library.json: {e}")

if __name__ == "__main__":
    delay = float(sys.argv[1]) if len(sys.argv) > 1 else 0.2
    run_godet_scraping(delay_seconds=delay, force=True)
