import time
import sys

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

from core.database import VectorDB
from core.bible_json_loader import BibleJsonLoader
from gui.library_utils import load_books_metadata

def test_sagesse_vivante():
    print("========================================")
    print("TEST: Sagesse Vivante (SV) Integration")
    print("========================================")
    
    # Test 1: Direct BibleJsonLoader access on Proverbes 1
    t0 = time.perf_counter()
    pro1 = BibleJsonLoader.get_verses("SV", "Pro", 1)
    t1 = time.perf_counter()
    print(f"  [SV] Proverbes 1 chargé en {(t1-t0)*1000:.3f} ms ({len(pro1['documents'])} versets).")
    assert len(pro1['documents']) == 33
    print(f"  SV Proverbes 1:7 = {pro1['documents'][6]}")

    # Test 2: Direct access on Job 1:1
    job1_1 = BibleJsonLoader.get_verses("SV", "Job", 1, 1)
    assert len(job1_1['documents']) == 1
    print(f"  SV Job 1:1 = {job1_1['documents'][0]}")

    # Test 3: Direct access on Cantique 1:2
    sol1_2 = BibleJsonLoader.get_verses("SV", "Sol", 1, 2)
    assert len(sol1_2['documents']) == 1
    print(f"  SV Cantique 1:2 = {sol1_2['documents'][0]}")

    # Test 4: Unified VectorDB search on Proverbes 1:7
    db = VectorDB()
    registry = load_books_metadata()
    active_sources = [{"name": name, "embedding_model": meta.get("embedding_model", "study_library")} 
                      for name, meta in registry.items() if meta.get("active", False)]
    
    res = db.get_by_reference("Proverbes 1:7", active_sources=active_sources)
    sources = [m['name'] for m in res['metadatas']]
    print(f"\n  Sources trouvées pour Proverbes 1:7 ({len(sources)}): {sources}")
    assert "SV" in sources
    
    for doc, meta in zip(res['documents'], res['metadatas']):
        if meta['name'] in ["SV", "Segond 21", "Colombe", "BDS"]:
            print(f"    [{meta['name']}] {doc.strip()}")
            
    print("\n========================================")
    print("TOUS LES TESTS SAGESSE VIVANTE SONT OK ! 🎉")
    print("========================================")

if __name__ == '__main__':
    test_sagesse_vivante()
