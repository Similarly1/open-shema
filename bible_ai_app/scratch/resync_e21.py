import sys, os
sys.path.insert(0, os.path.abspath('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app'))

from core.articles_manager import ArticlesManager

mgr = ArticlesManager.get_instance()
count = mgr.sync_source('e21', max_articles=15)
print(f"Re-synced {count} articles for Évangile 21")
