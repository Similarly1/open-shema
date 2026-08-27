import sqlite3
import json

conn = sqlite3.connect('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/data/articles/articles.db')
c = conn.cursor()
c.execute("SELECT id, title, author, audio_url, url FROM articles WHERE title LIKE '%unite%' OR title LIKE '%Quentin%' OR author LIKE '%Polinari%' OR title LIKE '%Corinthiens%' ORDER BY id DESC LIMIT 10")
rows = c.fetchall()
for r in rows:
    print('ID:', r[0])
    print('Title:', r[1])
    print('Author:', r[2])
    print('Audio URL:', r[3])
    print('URL:', r[4])
    print('-'*50)
