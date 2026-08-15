import sys
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

from core.database import VectorDB
from gui.library_utils import load_books_metadata

db = VectorDB()
reg = load_books_metadata()
active = [{'name': k, 'embedding_model': v.get('embedding_model', 'study_library')} for k, v in reg.items() if v.get('active', False)]
res = db.get_by_reference('Matthieu 1:1', active_sources=active)

for doc, meta in zip(res['documents'], res['metadatas']):
    name = meta.get('name')
    print(f"[{name}] -> {repr(doc)}")
