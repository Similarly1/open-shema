import sys
sys.path.insert(0, '.')
sys.stdout.reconfigure(encoding='utf-8')
import os
from core.articles_db import ArticlesDB
from core.articles_manager import ArticlesManager
from core.articles_feed_scraper import ArticlesFeedScraper

db = ArticlesDB()
manager = ArticlesManager()
scraper = ArticlesFeedScraper()

arts = db.get_articles(limit=500)
print(f"Total articles: {len(arts)}")

updated_count = 0

for a in arts:
    # Si c'est l'article de Nancy Guthrie ou s'il a besoin d'être rafraîchi
    if 'prier-pour-protection-de-dieu' in a.get('url', '') or 'tpsg_70dd88f360e3' in a.get('id', ''):
        print(f"Mise à jour spécifique pour {a['title']} ({a['url']})...")
        raw_item = {
            'id': a['id'],
            'source_id': a['source_id'],
            'title': a['title'],
            'url': a['url'],
            'author': a.get('author', ''),
            'summary': a.get('summary', ''),
            'published_at': a.get('published_at', ''),
            'tags': a.get('tags_list', [])
        }
        processed = scraper.process_article(raw_item)
        
        # Enregistrer le nouveau markdown
        file_path = os.path.join(manager.base_dir, 'content', a['source_id'], f"{a['id']}.md")
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(processed['content_markdown'])
        
        print(f"Nouveau markdown écrit ({len(processed['content_markdown'])} caractères) !")
        updated_count += 1

print(f"Terminé ! {updated_count} article(s) mis à jour.")
