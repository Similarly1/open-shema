import sqlite3

conn = sqlite3.connect('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/data/articles/articles.db')
c = conn.cursor()
c.execute("SELECT id, title, audio_url, url FROM articles WHERE audio_url IS NOT NULL AND audio_url != ''")
rows = c.fetchall()
for r in rows:
    print(r[0], '|', r[2])
