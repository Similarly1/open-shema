import os
import json
import sqlite3

ost_json_dir = r"c:\Users\adrie\Documents\antigravity\peaceful-mendeleev\bible_ai_app\data\bibles\OST"
dest_dir = r"c:\Users\adrie\Documents\antigravity\peaceful-mendeleev\scratch\open-shema-data\data\bibles"
os.makedirs(dest_dir, exist_ok=True)
dest_db = os.path.join(dest_dir, "bible_ostervald.sqlite")

if os.path.exists(dest_db):
    os.remove(dest_db)

conn = sqlite3.connect(dest_db)
cur = conn.cursor()

# 1. Metadata table
cur.execute("""
CREATE TABLE metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
""")

metadata_entries = [
    ("id", "bible-ostervald-1877"),
    ("type", "bible"),
    ("category", "bibles"),
    ("abbreviation", "OST"),
    ("title", "Bible J.F. Ostervald (1877)"),
    ("author", "Jean-Frédéric Ostervald"),
    ("year", "1877"),
    ("language", "fr"),
    ("description", "Grande révision neuchâteloise du texte biblique français au style noble et majestueux, basée sur le Texte Massorétique et le Textus Receptus, pilier historique du protestantisme réformé francophone."),
    ("license", "Public Domain"),
    ("total_books", "66"),
    ("has_strong", "0"),
    ("has_notes", "0")
]
cur.executemany("INSERT INTO metadata (key, value) VALUES (?, ?)", metadata_entries)

# 2. Books table
cur.execute("""
CREATE TABLE books (
    id INTEGER PRIMARY KEY,
    testament TEXT NOT NULL CHECK (testament IN ('OT', 'NT', 'APO', 'DC')),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    short_name TEXT NOT NULL,
    chapters_count INTEGER NOT NULL,
    order_index INTEGER NOT NULL
);
""")

# 3. Verses table
cur.execute("""
CREATE TABLE verses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id INTEGER NOT NULL,
    chapter INTEGER NOT NULL,
    verse INTEGER NOT NULL,
    text TEXT NOT NULL,
    text_strong TEXT,
    notes TEXT,
    FOREIGN KEY (book_id) REFERENCES books(id)
);
""")

json_files = sorted([f for f in os.listdir(ost_json_dir) if f.endswith('.json')])
print(f"Trouvé {len(json_files)} fichiers JSON pour Ostervald.")

books_data = []
verses_data = []

order_idx = 1
for fname in json_files:
    fpath = os.path.join(ost_json_dir, fname)
    with open(fpath, "r", encoding="utf-8") as jf:
        data = json.load(jf)

    b_id = data.get("id", order_idx)
    b_code = data.get("code", "").upper()
    b_name = data.get("name", "")
    ch_count = data.get("total_chapters", len(data.get("chapters", {})))
    
    testament = "OT" if b_id <= 39 else ("NT" if b_id <= 66 else "DC")
    short_name = b_code.capitalize()
    books_data.append((b_id, testament, b_code, b_name, short_name, ch_count, order_idx))
    order_idx += 1

    chapters = data.get("chapters", {})
    sorted_ch_keys = sorted(chapters.keys(), key=lambda x: int(x) if x.isdigit() else 999)
    for ch_k in sorted_ch_keys:
        ch_num = int(ch_k)
        v_dict = chapters[ch_k]
        sorted_v_keys = sorted(v_dict.keys(), key=lambda x: int(x) if x.isdigit() else 999)
        for v_k in sorted_v_keys:
            v_num = int(v_k)
            v_text = str(v_dict[v_k]).strip()
            verses_data.append((b_id, ch_num, v_num, v_text, None, None))

print(f"Insertion de {len(books_data)} livres et {len(verses_data)} versets...")
cur.executemany("INSERT INTO books (id, testament, code, name, short_name, chapters_count, order_index) VALUES (?, ?, ?, ?, ?, ?, ?)", books_data)
cur.executemany("INSERT INTO verses (book_id, chapter, verse, text, text_strong, notes) VALUES (?, ?, ?, ?, ?, ?)", verses_data)

# Indexes
cur.execute("CREATE INDEX idx_verses_bcv ON verses(book_id, chapter, verse);")
cur.execute("CREATE INDEX idx_verses_lookup ON verses(book_id, chapter);")

conn.commit()
cur.execute("VACUUM;")
conn.commit()

size_mb = os.path.getsize(dest_db) / (1024 * 1024)
print(f"Base SQLite Ostervald générée avec succès : {dest_db} ({size_mb:.2f} Mo, {len(verses_data)} versets)")
conn.close()
