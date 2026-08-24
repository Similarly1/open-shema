import sys
from core.articles_manager import ArticlesManager

manager = ArticlesManager.get_instance()
manager.curated_sources = manager._load_curated_sources_config()
manager.db.sync_curated_sources(manager.curated_sources)

sources = manager.db.get_sources(enabled_only=True)
print("Sources actives :", [s["name"] for s in sources])

print("Synchronisation de Tout Pour Sa Gloire...")
new_count = manager.sync_source("tpsg", max_articles=10)
print(f"Nouveaux articles synchronisés : {new_count}")

articles = manager.get_articles(limit=10)
print(f"Total articles dans la base : {len(articles)}")
for a in articles:
    refs = [r["raw_ref"] for r in a.get("scripture_references", [])]
    out = f"- [{a['source_name']}] \"{a['title']}\" (Auteur: {a['author']}) | Date: {a['published_at'][:10]} | Refs: {refs}\n"
    sys.stdout.buffer.write(out.encode("utf-8"))
