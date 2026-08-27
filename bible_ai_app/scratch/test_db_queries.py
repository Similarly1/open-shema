import sys, os
sys.path.insert(0, os.path.abspath('.'))

from core.articles_db import ArticlesDB

db = ArticlesDB()

queries = [
    "rm 4",
    "Rm 4",
    "romains 4",
    "Romains 4",
    "rm4",
    "ro 4",
    "1co 1",
    "1 co 1",
    "1 corinthiens 1",
    "1co1",
    "2 timothee 2",
    "2 tm 2",
    "2ti 2",
    "ps 23",
    "psaume 23",
    "psaumes 23",
    "he 13",
    "hebreux 13",
    "hébreux 13",
    "rm",
    "romains"
]

print(f"{'QUERY':20} | {'ARTICLES FOUND':15} | {'SAMPLE RESULTS'}")
print("-" * 80)

for q in queries:
    res = db.get_articles(search_query=q)
    cnt = db.get_articles_count(search_query=q)
    sample_titles = [r['title'][:30] for r in res[:2]]
    print(f"{q:20} | {len(res)} (count={cnt:2})   | {', '.join(sample_titles)}")
