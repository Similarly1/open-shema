import sys, os
sys.path.insert(0, os.path.abspath('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app'))

from core.articles_db import ArticlesDB
from core.bible_reference_detector import find_bible_references
from core.reference_parser import parse_reference, BOOK_MAPPING, normalize_book_name

test_queries = [
    "rm 4",
    "Rm 4",
    "romains 4",
    "Romains 4",
    "rm",
    "romains",
    "1co 13",
    "1 corinthiens 13",
    "1 co 13",
    "1co",
    "ps 23",
    "psaumes 23",
    "psaume 23",
    "he 13",
    "hebreux 13",
    "hbreux 13",
    "2 tm 2",
    "2 timothee 2"
]

print("=== TESTING REFERENCE DETECTOR & PARSER ===")
for q in test_queries:
    det = find_bible_references(q)
    par = parse_reference(q)
    print(f"Query: {q:20} -> Detector: {det} | Parser: {par}")

print("\n=== TESTING DB SEARCH ===")
db = ArticlesDB()
for q in ["rm 4", "romains 4", "rm", "romains", "1co 1", "1 co 1", "1 corinthiens 1"]:
    results = db.get_articles(search_query=q)
    print(f"Search '{q}': found {len(results)} articles")
    for r in results[:2]:
        refs = [x['raw_ref'] for x in r.get('scripture_references', [])]
        print(f"   - [{r['id']}] {r['title'][:40]} | Refs: {refs}")
