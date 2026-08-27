import sqlite3, os

conn = sqlite3.connect('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/data/articles/articles.db')
cursor = conn.cursor()

cursor.execute("SELECT id, title, content_path FROM articles WHERE source_id = 'e21' LIMIT 5")
for r in cursor.fetchall():
    print(r[0], r[1], "Path:", r[2], "Exists:", os.path.exists(r[2]) if r[2] else False)
    if r[2] and os.path.exists(r[2]):
        with open(r[2], 'r', encoding='utf-8') as f:
            content = f.read()
            print("Content length:", len(content))
            for line in content.split('\n'):
                if '[[' in line or 'fn' in line or 'Tripp' in line:
                    print("-->", repr(line))

conn.close()
