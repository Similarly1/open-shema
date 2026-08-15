import chromadb
import time

c = chromadb.PersistentClient(path='./data/chroma_db')
col = c.get_collection('study_library')
t0 = time.time()
where = {'$and': [{'book': 'Gen'}, {'chapter': 1}, {'name': {'$in': ['Colombe', 'Chouraqui']}}]}
res = col.get(where=where, include=['metadatas', 'documents'])
t1 = time.time()
print(f'ChromaDB query time: {t1 - t0:.3f}s, Count: {len(res["ids"])}')
if res['metadatas']:
    print('Sample meta:', res['metadatas'][0])
