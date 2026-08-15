import time
import sys

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

from core.database import VectorDB
from core.bible_json_loader import BibleJsonLoader
from gui.library_utils import load_books_metadata

def test_tob_integration():
    print("========================================")
    print("TEST: TOB 2010 Integration (82 Livres)")
    print("========================================")
    
    # Test 1: Direct access on Genèse 1:1
    t0 = time.perf_counter()
    gen1 = BibleJsonLoader.get_verses("TOB", "Gen", 1, 1)
    t1 = time.perf_counter()
    print(f"  [TOB] Genèse 1:1 chargé en {(t1-t0)*1000:.3f} ms.")
    assert len(gen1['documents']) == 1
    print(f"  TOB Genèse 1:1 = {gen1['documents'][0]}")

    # Test 2: Direct access on Jean 3:16
    j316 = BibleJsonLoader.get_verses("TOB", "Joh", 3, 16)
    assert len(j316['documents']) == 1
    print(f"  TOB Jean 3:16 = {j316['documents'][0]}")

    # Test 3: Direct access on Tobie 1:1
    tob1_1 = BibleJsonLoader.get_verses("TOB", "Tob", 1, 1)
    assert len(tob1_1['documents']) == 1
    print(f"  TOB Tobie 1:1 = {tob1_1['documents'][0]}")

    # Test 4: Unified VectorDB search on Jean 3:16
    db = VectorDB()
    registry = load_books_metadata()
    active_sources = [{"name": name, "embedding_model": meta.get("embedding_model", "study_library")} 
                      for name, meta in registry.items() if meta.get("active", False)]
    
    res = db.get_by_reference("Jean 3:16", active_sources=active_sources)
    sources = [m['name'] for m in res['metadatas']]
    print(f"\n  Sources trouvées pour Jean 3:16 ({len(sources)}): {sources}")
    assert "TOB" in sources
    
    for doc, meta in zip(res['documents'], res['metadatas']):
        if meta['name'] in ["TOB", "Segond 21", "PV", "BDS", "Colombe"]:
            print(f"    [{meta['name']}] {doc.strip()}")
            
    print("\n========================================")
    print("TOUS LES TESTS TOB SONT OK ! 🎉")
    print("========================================")

if __name__ == '__main__':
    test_tob_integration()
