import sys, os
sys.path.insert(0, os.path.abspath('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app'))

from core.articles_manager import ArticlesManager

mgr = ArticlesManager.get_instance()
sources = mgr.get_sources(enabled_only=True)
print("Active sources returned by manager:")
for s in sources:
    print(f" - {s['id']}: {s['name']} (articles: {s['article_count']})")

all_sources = mgr.get_sources(enabled_only=False)
print("\nAll sources in DB:")
for s in all_sources:
    print(f" - {s['id']}: {s['name']} (articles: {s['article_count']}, is_enabled: {s['is_enabled']})")
