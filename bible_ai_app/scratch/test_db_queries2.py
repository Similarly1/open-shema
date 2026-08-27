import sys, os
sys.path.insert(0, os.path.abspath('.'))

from core.articles_db import ArticlesDB

db = ArticlesDB()

queries = [
    "rm 8",
    "Rm 8",
    "romains 8",
    "Romains 8",
    "rm8",
    "ro 8",
    "rom 8",
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
    "rm",
    "romains"
]

print(f"{'QUERY':20} | {'FOUND':5} | {'COUNT':5} | {'TITLES'}")
print("-" * 75)

for q in queries:
    res = db.get_articles(search_query=q)
    cnt = db.get_articles_count(search_query=q)
    titles = [r['title'][:25] for r in res[:2]]
    print(f"{q:20} | {len(res):5} | {cnt:5} | {', '.join(titles)}")
