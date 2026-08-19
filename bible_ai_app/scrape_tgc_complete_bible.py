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
    'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8',
    'Referer': 'https://www.thegospelcoalition.org/'
}

# 9 livres STRICTEMENT EXCLUS car déjà traduits en français :
EXCLUDED_SLUGS = {
    'ruth', 'matthew', 'proverbs', 'daniel', 'habakkuk', 
    'malachi', 'ephesians', 'philippians', 'james'
}

BOOK_MAP = {
    'genesis': ('Genèse', 'Gen'),
    'exodus': ('Exode', 'Exo'),
    'leviticus': ('Lévitique', 'Lev'),
    'numbers': ('Nombres', 'Num'),
    'deuteronomy': ('Deutéronome', 'Deu'),
    'joshua': ('Josué', 'Jos'),
    'judges': ('Juges', 'Jdg'),
    '1-samuel': ('1 Samuel', '1Sa'),
    '2-samuel': ('2 Samuel', '2Sa'),
    '1-kings': ('1 Rois', '1Ki'),
    '2-kings': ('2 Rois', '2Ki'),
    '1-chronicles': ('1 Chroniques', '1Ch'),
    '2-chronicles': ('2 Chroniques', '2Ch'),
    'ezra': ('Esdras', 'Ezr'),
    'nehemiah': ('Néhémie', 'Neh'),
    'esther': ('Esther', 'Est'),
    'job': ('Job', 'Job'),
    'psalm-1-psalm-41': ('Psaumes (1-41)', 'Psa'),
    'psalm-42-psalm-72': ('Psaumes (42-72)', 'Psa'),
    'psalm-73-psalm-89': ('Psaumes (73-89)', 'Psa'),
    'psalm-90-psalm-106': ('Psaumes (90-106)', 'Psa'),
    'psalm-107-psalm-150': ('Psaumes (107-150)', 'Psa'),
    'ecclesiastes': ('Ecclésiaste', 'Ecc'),
    'song-of-solomon': ('Cantique des Cantiques', 'Sol'),
    'isaiah': ('Ésaïe', 'Isa'),
    'jeremiah': ('Jérémie', 'Jer'),
    'lamentations': ('Lamentations', 'Lam'),
    'ezekiel': ('Ézéchiel', 'Eze'),
    'hosea': ('Osée', 'Hos'),
    'joel': ('Joël', 'Joe'),
    'amos': ('Amos', 'Amo'),
    'obadiah': ('Abdias', 'Oba'),
    'jonah': ('Jonas', 'Jon'),
    'micah': ('Michée', 'Mic'),
    'nahum': ('Nahum', 'Nah'),
    'zephaniah': ('Sophonie', 'Zep'),
    'haggai': ('Aggée', 'Hag'),
    'zechariah': ('Zacharie', 'Zec'),
    'mark': ('Marc', 'Mar'),
    'luke': ('Luc', 'Luk'),
    'john': ('Jean', 'Joh'),
    'acts': ('Actes', 'Act'),
    'romans': ('Romains', 'Rom'),
    '1-corinthians': ('1 Corinthiens', '1Co'),
    '2-corinthians': ('2 Corinthiens', '2Co'),
    'galatians': ('Galates', 'Gal'),
    'colossians': ('Colossiens', 'Col'),
    '1-thessalonians': ('1 Thessaloniciens', '1Th'),
    '2-thessalonians': ('2 Thessaloniciens', '2Th'),
    '1-timothy': ('1 Timothée', '1Ti'),
    '2-timothy': ('2 Timothée', '2Ti'),
    'titus': ('Tite', 'Tit'),
    'philemon': ('Philémon', 'Phm'),
    'hebrews': ('Hébreux', 'Heb'),
    '1-peter': ('1 Pierre', '1Pe'),
    '2-peter': ('2 Pierre', '2Pe'),
    '1-john': ('1 Jean', '1Jo'),
    '2-john': ('2 Jean', '2Jo'),
    '3-john': ('3 Jean', '3Jo'),
    'jude': ('Jude', 'Jud'),
    'revelation': ('Apocalypse', 'Rev')
}

ENGLISH_NUMBERS = {
    'one': 1, 'first': 1, 'two': 2, 'second': 2, 'three': 3, 'third': 3,
    'four': 4, 'fourth': 4, 'five': 5, 'fifth': 5, 'six': 6, 'sixth': 6,
    'seven': 7, 'seventh': 7, 'eight': 8, 'eighth': 8, 'nine': 9, 'ninth': 9,
    'ten': 10, 'tenth': 10, 'eleven': 11, 'twelve': 12, 'thirteen': 13,
    'fourteen': 14, 'fifteen': 15, 'sixteen': 16, 'seventeen': 17, 'eighteen': 18,
    'nineteen': 19, 'twenty': 20, 'twenty-one': 21, 'twenty-two': 22,
    'twenty-three': 23, 'twenty-four': 24, 'twenty-five': 25, 'twenty-six': 26,
    'twenty-seven': 27, 'twenty-eight': 28, 'twenty-nine': 29, 'thirty': 30
}

def clean_text(text: str) -> str:
    if not text:
        return ""
    text = text.replace('\xa0', ' ').replace('\u200b', '').replace('\ufeff', '')
    text = re.sub(r'[ \t]+', ' ', text)
    return text.strip()

def parse_ref_string(text: str, current_chapter: int = 1) -> Optional[Tuple[int, int, int, int, str]]:
    cleaned = text.strip()

    # Détection "Chapter X" ou "Psalm X"
    m_chap = re.search(r'\b(?:Chapter|Psalm|Section)\s+([a-zA-Z0-9\-]+)', cleaned, re.IGNORECASE)
    if m_chap:
        raw_val = m_chap.group(1).lower()
        if raw_val.isdigit():
            ch = int(raw_val)
        elif raw_val in ENGLISH_NUMBERS:
            ch = ENGLISH_NUMBERS[raw_val]
        else:
            ch = None
        if ch is not None:
            return ch, 1, ch, 999, f"Chapter {ch}"

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

    # Détection verset seul (ex: "v. 12" ou "vv. 12-15")
    m_v = re.search(r'\bv{1,2}\.?\s*(\d+)(?:\s*[-–—]\s*(\d+))?', cleaned, re.IGNORECASE)
    if m_v:
        v1 = int(m_v.group(1))
        v2 = int(m_v.group(2)) if m_v.group(2) else v1
        return current_chapter, v1, current_chapter, v2, f"{current_chapter}:{v1}" if v1 == v2 else f"{current_chapter}:{v1}-{v2}"

    return None

def scrape_single_volume(book_meta: Dict[str, Any], session: requests.Session, books_dir: str) -> Optional[Dict[str, Any]]:
    cache_file = os.path.join(books_dir, f"{book_meta['slug']}.json")
    if os.path.exists(cache_file) and os.path.getsize(cache_file) > 1000:
        try:
            with open(cache_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            print(f"   ✔ {book_meta['book_name']} chargé depuis le cache ({data.get('total_chunks', len(data.get('chapters', [])))} passages).")
            return data
        except Exception:
            pass

    url = book_meta["url"]
    print(f"   📥 Téléchargement de {book_meta['book_name']} ({url})...", end="", flush=True)
    t0 = time.time()

    try:
        resp = session.get(url, timeout=25)
        if resp.status_code != 200:
            print(f" ❌ Erreur HTTP {resp.status_code}")
            return None
    except Exception as e:
        print(f" ❌ Erreur connexion: {e}")
        return None

    soup = BeautifulSoup(resp.content, 'html.parser')
    
    # Author
    author_div = soup.find('div', class_='author_name') or soup.find('span', class_='author') or soup.find('div', class_='c-author')
    author = author_div.get_text(strip=True) if author_div else ''
    if not author and soup.title and '|' in soup.title.string:
        parts = [p.strip() for p in soup.title.string.split('|')]
        for p in parts:
            if p not in ['TGCBC', 'TGC-E21', 'The Gospel Coalition', 'Commentary', 'Evangile 21'] and not any(p.lower().startswith(x) for x in ['1 ', '2 ', '3 ', book_meta['slug'][:4].lower()]):
                author = p
                break
    if not author:
        author = "The Gospel Coalition"

    col = soup.find('div', class_='commentary_column') or soup.find('div', class_='entry-content')
    if not col:
        print(f" ❌ Contenu introuvable")
        return None

    elements = col.find_all(['h1', 'h2', 'h3', 'h4', 'h5', 'p'], recursive=True)

    raw_chunks = []
    current_c1 = 1
    current_v1 = 1
    current_c2 = 1
    current_v2 = 1
    current_title = "Introductory Material"
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

    # Expansion multi-chapitres
    chapters_dict = {}
    total_expanded_chunks = 0

    for c in raw_chunks:
        c1, v1, c2, v2 = c["c1"], c["v1"], c["c2"], c["v2"]
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

    vol_obj = {
        "book_name": book_meta["book_name"],
        "book_code": book_meta["book_code"],
        "slug": book_meta["slug"],
        "author": author,
        "language": "en",
        "url": url,
        "total_chunks": total_expanded_chunks,
        "chapters": chapters_list
    }

    with open(cache_file, "w", encoding="utf-8") as f:
        json.dump(vol_obj, f, ensure_ascii=False, indent=2)

    t1 = time.time()
    print(f" OK en {t1-t0:.1f}s ({len(chapters_list)} chapitres, {total_expanded_chunks} passages indexés) | Auteur: {author}")

    return vol_obj

def save_volume_to_sqlite(db_path: str, comm_id: str, comm_name: str, vol_data: Dict[str, Any]):
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    
    rows = []
    for ch in vol_data["chapters"]:
        chap_num = ch["chapter"]
        for v in ch["verses"]:
            rows.append((
                comm_id,
                comm_name,
                vol_data["book_code"],
                vol_data["book_name"],
                chap_num,
                v["verse_start"],
                v["verse_end"],
                f"{v['reference']} ({vol_data['author']})",
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

def run_remaining_scraping(delay_seconds: float = 2.0):
    base_dir = os.path.dirname(os.path.abspath(__file__))
    while not os.path.exists(os.path.join(base_dir, "core")):
        base_dir = os.path.dirname(base_dir)

    comm_dir = os.path.join(base_dir, "data", "commentaires", "tgc_english")
    books_dir = os.path.join(comm_dir, "livres")
    os.makedirs(books_dir, exist_ok=True)

    db_path = os.path.join(base_dir, "data", "commentaires", "commentaires_master.db")
    lib_path = os.path.join(base_dir, "data", "library.json")

    session = requests.Session()
    session.headers.update(HEADERS)

    # Récupérer la liste des volumes depuis TGC en excluant les 9 français
    r = session.get('https://www.thegospelcoalition.org/commentary/')
    soup = BeautifulSoup(r.text, 'html.parser')

    target_books = []
    seen = set()
    for a in soup.find_all('a', href=True):
        href = a['href'].rstrip('/')
        if '/commentary/' in href:
            slug = href.split('/')[-1]
            if slug and slug != 'commentary' and slug not in seen:
                seen.add(slug)
                if slug not in EXCLUDED_SLUGS:
                    book_name, book_code = BOOK_MAP.get(slug, (slug.capitalize(), slug[:3].capitalize()))
                    target_books.append({
                        "slug": slug,
                        "book_name": book_name,
                        "book_code": book_code,
                        "url": f"https://www.thegospelcoalition.org/commentary/{slug}/"
                    })

    print("\n" + "=" * 70)
    print("📖 SCRAPING DES 61 VOLUMES ANGLAIS TGC RESTANTS (SANS AUCUN DOUBLON)")
    print(f"🚫 9 livres exclus (conservés en version française) : {', '.join(sorted(EXCLUDED_SLUGS))}")
    print(f"🌐 {len(target_books)} volumes à traiter | Pause respectueuse: {delay_seconds}s")
    print(f"📁 Destination JSON: {comm_dir}")
    print(f"💾 Base SQLite: {db_path}")
    print("=" * 70 + "\n")

    comm_unified_name = "Commentaires The Gospel Coalition (TGC)"
    comm_id = "tgc_complete"

    # Réinitialiser la table pour ces livres spécifiques dans SQLite
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    for b in target_books:
        cur.execute("DELETE FROM commentaries WHERE commentary_id = ? AND book_code = ?", (comm_id, b["book_code"]))
    conn.commit()
    conn.close()

    all_volumes_data = []
    total_passages_all = 0

    for idx, book_meta in enumerate(target_books, 1):
        print(f"[{idx:2d}/{len(target_books)}] Volume: {book_meta['book_name']:22s} ({book_meta['book_code']})")
        vol_data = scrape_single_volume(book_meta, session, books_dir)

        if vol_data:
            all_volumes_data.append(vol_data)
            total_passages_all += vol_data["total_chunks"]
            save_volume_to_sqlite(db_path, comm_id, comm_unified_name, vol_data)

        if idx < len(target_books):
            print(f"   ⏳ Pause de {delay_seconds}s...")
            time.sleep(delay_seconds)

    # Récupérer également les 9 livres français pour former la collection complète à 66 livres !
    fr_dir = os.path.join(base_dir, "data", "commentaires", "tgc_evangile21", "livres")
    fr_count = 0
    if os.path.exists(fr_dir):
        for f_name in os.listdir(fr_dir):
            if f_name.endswith('.json'):
                with open(os.path.join(fr_dir, f_name), 'r', encoding='utf-8') as f:
                    fr_data = json.load(f)
                save_volume_to_sqlite(db_path, comm_id, comm_unified_name, fr_data)
                fr_count += fr_data.get("total_chunks", 0)

    print("\n" + "=" * 70)
    print("🎉 TOUT LE SCRAPING EST TERMINÉ AVEC SUCCÈS !")
    print(f"📚 {len(all_volumes_data)} volumes anglais ajoutés ({total_passages_all} passages).")
    print(f"🇫🇷 9 volumes français intégrés ({fr_count} passages).")
    print(f"✨ Collection complète The Gospel Coalition prête : 66 livres / 70 volumes sans doublon !")
    print("=" * 70)

    # Inscription dans library.json
    if os.path.exists(lib_path):
        try:
            with open(lib_path, "r", encoding="utf-8") as f:
                lib = json.load(f)

            lib[comm_unified_name] = {
                "title": "Commentaires Bibliques The Gospel Coalition (TGC)",
                "author": "The Gospel Coalition (Carson, Schreiner, Alexander, Köstenberger, Doriani, etc.)",
                "description": f"Commentaires bibliques complets sur toute la Bible (66 livres, {total_passages_all + fr_count} passages exégétiques, avec les 9 livres traduits en français).",
                "year": "2021-2024",
                "cover_path": None,
                "type": "Commentaire",
                "format": "sqlite",
                "commentary_id": comm_id,
                "chunks_count": total_passages_all + fr_count,
                "embedding_model": "study_library",
                "active": True
            }

            with open(lib_path, "w", encoding="utf-8") as f:
                json.dump(lib, f, ensure_ascii=False, indent=2)
            print(f"✔ Entrée mise à jour dans library.json : '{comm_unified_name}'")
        except Exception as e:
            print(f"⚠️ Erreur mise à jour library.json: {e}")

if __name__ == "__main__":
    delay = float(sys.argv[1]) if len(sys.argv) > 1 else 2.0
    run_remaining_scraping(delay_seconds=delay)
