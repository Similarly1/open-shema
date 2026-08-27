import sys, os
sys.path.insert(0, os.path.abspath('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app'))

from core.articles_manager import ArticlesManager

mgr = ArticlesManager.get_instance()
print("Sources in manager:", [s["name"] for s in mgr.get_sources()])
new_count = mgr.sync_source("e21", max_articles=15)
print(f"Synchronized {new_count} articles from Évangile 21")

articles = mgr.db.get_articles(source_id="e21", limit=5)
print(f"Total articles in DB for e21: {len(articles)}")
for a in articles:
    print(" -", a["title"], "| Author:", a["author"], "| Date:", a["published_at"])
