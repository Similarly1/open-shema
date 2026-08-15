import time
import sys

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

from core.database import VectorDB
from core.bible_json_loader import BibleJsonLoader
from gui.library_utils import load_books_metadata

def test_jxlfr_integration():
    print("========================================")
    print("TEST: JXLFR (Juxtalinéaire Grec-Français 2026)")
    print("========================================")
    
    # Test 1: Direct access on Marc 1:1
    t0 = time.perf_counter()
    mrk1 = BibleJsonLoader.get_verses("JXLFR", "Mar", 1, 1)
    t1 = time.perf_counter()
    print(f"  [JXLFR] Marc 1:1 chargé en {(t1-t0)*1000:.3f} ms.")
    assert len(mrk1['documents']) == 1
    print(f"  JXLFR Marc 1:1:\n{mrk1['documents'][0]}")

    # Test 2: Direct access on Galates 1:8
    gal1_8 = BibleJsonLoader.get_verses("JXLFR", "Gal", 1, 8)
    assert len(gal1_8['documents']) == 1
    print(f"\n  JXLFR Galates 1:8:\n{gal1_8['documents'][0]}")

    # Test 3: Unified VectorDB search on Marc 1:1
    db = VectorDB()
    registry = load_books_metadata()
    active_sources = [{"name": name, "embedding_model": meta.get("embedding_model", "study_library")} 
                      for name, meta in registry.items() if meta.get("active", False)]
    
    res = db.get_by_reference("Marc 1:1", active_sources=active_sources)
    sources = [m['name'] for m in res['metadatas']]
    print(f"\n  Sources trouvées pour Marc 1:1 ({len(sources)}): {sources}")
    assert "JXLFR" in sources
    
    print("\n  Comparaison sur Marc 1:1 :")
    for doc, meta in zip(res['documents'], res['metadatas']):
        if meta['name'] in ["JXLFR", "Segond 21", "TOB", "PV", "Colombe"]:
            print(f"    [{meta['name']}] {doc.strip()}")
            
    print("\n========================================")
    print("TOUS LES TESTS JXLFR SONT OK ! 🎉")
    print("========================================")

if __name__ == '__main__':
    test_jxlfr_integration()
