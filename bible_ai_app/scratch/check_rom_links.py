import sys, os
sys.path.insert(0, os.path.abspath('.'))

from core.articles_db import ArticlesDB

db = ArticlesDB()
with db._get_connection() as conn:
    c = conn.cursor()
    c.execute("SELECT DISTINCT book_code, chapter, COUNT(*) as cnt FROM article_scripture_links WHERE book_code = 'Rom' GROUP BY book_code, chapter")
    for r in c.fetchall():
        print(f"Rom chapter {r['chapter']}: {r['cnt']} references")

    c.execute("SELECT DISTINCT book_code, COUNT(*) as cnt FROM article_scripture_links GROUP BY book_code ORDER BY cnt DESC LIMIT 10")
    for r in c.fetchall():
        print(f"Book {r['book_code']:5}: {r['cnt']} references")
