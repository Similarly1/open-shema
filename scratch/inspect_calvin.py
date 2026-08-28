import sqlite3
import os

conn = sqlite3.connect('bible_ai_app/data/commentaires/commentaires_master.db')
cur = conn.cursor()
cur.execute('SELECT book_code, book_name, chapter, verse_start, verse_end, reference, text FROM commentaries WHERE commentary_name LIKE "%Calvin%" LIMIT 3')
for r in cur.fetchall():
    print(f"Ref: {r[5]} ({r[0]} {r[2]}:{r[3]}-{r[4]}), Len: {len(r[6])}")
    print("Excerpt:", r[6][:150])
    print("-" * 50)
conn.close()
