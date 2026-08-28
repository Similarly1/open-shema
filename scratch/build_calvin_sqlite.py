import sqlite3
import os

source_db = r"c:\Users\adrie\Documents\antigravity\peaceful-mendeleev\bible_ai_app\data\commentaires\commentaires_master.db"
dest_dir = r"c:\Users\adrie\Documents\antigravity\peaceful-mendeleev\scratch\open-shema-data\data\commentaires"
os.makedirs(dest_dir, exist_ok=True)
dest_db = os.path.join(dest_dir, "comm_calvin.sqlite")

if os.path.exists(dest_db):
    os.remove(dest_db)

src_conn = sqlite3.connect(source_db)
src_cur = src_conn.cursor()

dest_conn = sqlite3.connect(dest_db)
dest_cur = dest_conn.cursor()

# 1. Metadata table
dest_cur.execute("""
CREATE TABLE metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
""")

meta_entries = [
    ("id", "comm-calvin"),
    ("type", "commentary"),
    ("category", "commentaries"),
    ("abbreviation", "CBJC"),
    ("title", "Commentaire Biblique de Jean Calvin"),
    ("author", "Jean Calvin (Éd. Ch. Meyrueis / Dom. Public)"),
    ("year", "1854"),
    ("language", "fr"),
    ("description", "Ensemble des commentaires exégétiques et doctrinaux de Jean Calvin sur le Nouveau et l'Ancien Testament (12 175 passages indexés sur 48 livres). Texte intégral du domaine public restauré, modernisé et structuré en Markdown thématique avec mise en valeur des citations et références scripturaires."),
    ("total_passages", "12175"),
    ("total_books", "48"),
    ("license", "Public Domain")
]
dest_cur.executemany("INSERT INTO metadata (key, value) VALUES (?, ?)", meta_entries)

# 2. Commentary table
dest_cur.execute("""
CREATE TABLE commentaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    commentary_id TEXT DEFAULT '3',
    commentary_name TEXT DEFAULT 'Commentaire Biblique de Jean Calvin',
    book_code TEXT NOT NULL,
    book_name TEXT NOT NULL,
    chapter INTEGER NOT NULL,
    verse_start INTEGER NOT NULL,
    verse_end INTEGER NOT NULL,
    reference TEXT NOT NULL,
    text TEXT NOT NULL,
    paragraphs_json TEXT,
    html TEXT,
    source_url TEXT
);
""")

dest_cur.execute("""
CREATE TABLE comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    book_code TEXT NOT NULL,
    book_name TEXT NOT NULL,
    chapter_start INTEGER NOT NULL,
    verse_start INTEGER NOT NULL,
    chapter_end INTEGER NOT NULL,
    verse_end INTEGER NOT NULL,
    reference TEXT NOT NULL,
    title TEXT,
    content TEXT NOT NULL
);
""")

print("Extraction des commentaires de Calvin...")
src_cur.execute("""
SELECT commentary_id, commentary_name, book_code, book_name, chapter, verse_start, verse_end, reference, text, paragraphs_json, html, source_url
FROM commentaries
WHERE commentary_name LIKE '%Calvin%' OR commentary_id = '3'
ORDER BY id
""")

rows = src_cur.fetchall()
print(f"{len(rows)} passages trouvés pour Calvin.")

dest_cur.executemany("""
INSERT INTO commentaries (commentary_id, commentary_name, book_code, book_name, chapter, verse_start, verse_end, reference, text, paragraphs_json, html, source_url)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
""", rows)

comments_rows = []
for r in rows:
    cid, cname, b_code, b_name, ch, vs, ve, ref, txt, p_json, html_txt, src_url = r
    comments_rows.append((b_code, b_name, ch, vs, ch, ve, ref, ref, txt))

dest_cur.executemany("""
INSERT INTO comments (book_code, book_name, chapter_start, verse_start, chapter_end, verse_end, reference, title, content)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
""", comments_rows)

# Indexes
dest_cur.execute("CREATE INDEX idx_commentaries_lookup ON commentaries(book_code, chapter, verse_start, verse_end);")
dest_cur.execute("CREATE INDEX idx_comments_lookup ON comments(book_code, chapter_start, verse_start, verse_end);")

dest_conn.commit()

# Vacuum & optimize
dest_cur.execute("VACUUM;")
dest_conn.commit()

dest_size = os.path.getsize(dest_db)
print(f"Base de données générée avec succès : {dest_db} ({dest_size / (1024*1024):.2f} Mo)")

src_conn.close()
dest_conn.close()
