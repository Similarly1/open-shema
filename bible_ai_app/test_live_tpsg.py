import sys
from core.articles_manager import ArticlesManager

manager = ArticlesManager.get_instance()
manager.sync_source("tpsg", max_articles=10)

articles = manager.get_articles(limit=5)
for a in articles:
    tags = a.get("tags_list", [])
    out = f"Titre : {a['title']}\n  -> Badges : {tags[:5]}\n"
    sys.stdout.buffer.write(out.encode("utf-8"))
