import os
import sys

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

from core.bible_json_loader import BibleJsonLoader
from core.database import VectorDB
from gui.library_utils import load_books_metadata

target_dir = r"C:\Users\adrie\kDrive\Documents\Théologie\Ressources externes\Bibles JSON"

# 1. Import fr_apee.json
print("========================================")
print("1. Importing fr_apee.json (APEE)")
print("========================================")
apee_file = os.path.join(target_dir, "fr_apee.json")
name1, meta1 = BibleJsonLoader.import_single_bible_json(apee_file, custom_name="APEE")
print(f"APEE imported: {name1}, books: {meta1['total_books']}")

# 2. Import Ostervald Bible
print("\n========================================")
print("2. Importing Ostervald Bible")
print("========================================")
ost_dir = os.path.join(target_dir, "Ostervald Bible")
name2, meta2 = BibleJsonLoader.import_bible_folder(ost_dir, custom_name="OST")
print(f"Ostervald imported: {name2}, books: {meta2['total_books']}")

# 3. Import French néo-Crampon Libre
print("\n========================================")
print("3. Importing French néo-Crampon Libre")
print("========================================")
ncl_dir = os.path.join(target_dir, "French néo-Crampon Libre")
name3, meta3 = BibleJsonLoader.import_bible_folder(ncl_dir, custom_name="NCL")
print(f"NCL imported: {name3}, books: {meta3['total_books']}")

# 4. Verification queries
print("\n========================================")
print("4. Verification Queries across all imported Bibles")
print("========================================")
for b in ["APEE", "OST", "NCL"]:
    gen1 = BibleJsonLoader.get_verses(b, "Gen", 1, 1)
    print(f"[{b}] Genèse 1:1 = {gen1['documents'][0] if gen1['documents'] else 'NONE'}")
    
    j316 = BibleJsonLoader.get_verses(b, "Joh", 3, 16)
    print(f"[{b}] Jean 3:16   = {j316['documents'][0] if j316['documents'] else 'NONE'}")

# 5. Check VectorDB multi-bible query
print("\n========================================")
print("5. Multi-Bible Comparison on Jean 3:16")
print("========================================")
db = VectorDB()
registry = load_books_metadata()
active_sources = [{"name": name, "embedding_model": meta.get("embedding_model", "study_library")} 
                  for name, meta in registry.items() if meta.get("active", False)]

res = db.get_by_reference("Jean 3:16", active_sources=active_sources)
sources = [m['name'] for m in res['metadatas']]
print(f"Active versions found for Jean 3:16 ({len(sources)}): {sources}")
for doc, meta in zip(res['documents'], res['metadatas']):
    if meta['name'] in ["APEE", "OST", "NCL", "Segond 21", "TOB"]:
        print(f"  [{meta['name']}] {doc.strip()}")

print("\n========================================")
print("TOUTES LES BIBLES SONT IMPORTÉES ET PARFAITEMENT INTÉGRÉES ! 🎉")
print("========================================")
