import sys
sys.path.insert(0, '.')
sys.stdout.reconfigure(encoding='utf-8')
from core.articles_db import ArticlesDB
from core.articles_manager import ArticlesManager
from core.bible_reference_detector import find_bible_references

db = ArticlesDB()
manager = ArticlesManager()
arts = db.get_articles(limit=500)
print(f"Total articles trouvés : {len(arts)}")

updated = 0
total_links = 0

with db._get_connection() as conn:
    cur = conn.cursor()
    for a in arts:
        full_md = manager.get_article_markdown(a['id']) or a.get('summary', '')
        combined = f"{a['title']}\n\n{full_md}"
        refs = find_bible_references(combined)
        unique_refs = []
        seen = set()
        for r in refs:
            k = (r.get('book_code'), r.get('chapter'), str(r.get('verse')))
            if k not in seen:
                seen.add(k)
                unique_refs.append(r)
        
        cur.execute("DELETE FROM article_scripture_links WHERE article_id = ?", (a['id'],))
        for r in unique_refs:
            cur.execute(
                "INSERT INTO article_scripture_links (article_id, book_code, chapter, verse, raw_ref) VALUES (?, ?, ?, ?, ?)",
                (a['id'], r['book_code'], r['chapter'], r.get('verse'), r['raw'])
            )
            total_links += 1
        updated += 1
    conn.commit()

print(f"Mise à jour réussie : {total_links} liaisons scripturaires créées pour {updated} articles !")
