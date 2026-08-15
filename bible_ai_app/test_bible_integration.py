import time
import json
import sys

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

from core.database import VectorDB
from core.reference_parser import normalize_reference, get_french_book_name
from core.bible_json_loader import BibleJsonLoader
from gui.library_utils import load_books_metadata, recover_books_metadata

def test_json_bible_integration():
    print("========================================")
    print("TEST 1: Normalisation des références")
    print("========================================")
    test_refs = [
        ("Jean 3:16", "Joh 3:16"),
        ("Jn 3.16", "Joh 3:16"),
        ("JHN 3:16", "Joh 3:16"),
        ("Genèse 1", "Gen 1"),
        ("GEN 1:1", "Gen 1:1"),
        ("Cantique des cantiques 1:2", "Sol 1:2"),
        ("SNG 1:2", "Sol 1:2"),
        ("Ézéchiel 36:26", "Eze 36:26"),
        ("EZK 36:26", "Eze 36:26"),
        ("Joël 2:28", "Joe 2:28"),
        ("Éphésiens 2:8", "Eph 2:8"),
        ("1 Timothée 3:16", "1Ti 3:16"),
        ("1ti 3:16", "1Ti 3:16"),
        ("Apocalypse 22:21", "Rev 22:21"),
        ("REV 22:21", "Rev 22:21"),
    ]
    for inp, expected in test_refs:
        norm = normalize_reference(inp)
        assert norm == expected, f"Erreur normalisation pour '{inp}': obtenu '{norm}', attendu '{expected}'"
        print(f"  ✓ '{inp}' -> '{norm}'")
    print("Normalisation : 100% OK !\n")

    print("========================================")
    print("TEST 2: Accès direct BibleJsonLoader (Segond 21 & Parole Vivante)")
    print("========================================")
    t0 = time.perf_counter()
    gen1 = BibleJsonLoader.get_verses("Segond 21", "Gen", 1)
    t1 = time.perf_counter()
    print(f"  [Segond 21] Genèse 1 chargé en {(t1-t0)*1000:.3f} ms ({len(gen1['documents'])} versets).")
    assert len(gen1['documents']) == 31

    t0 = time.perf_counter()
    pv_j316 = BibleJsonLoader.get_verses("Parole Vivante", "Joh", 3, 16)
    t1 = time.perf_counter()
    print(f"  [Parole Vivante] Jean 3:16 chargé en {(t1-t0)*1000:.3f} ms.")
    assert len(pv_j316['documents']) == 1
    print(f"  PV Jean 3:16 = {pv_j316['documents'][0]}")

    t0 = time.perf_counter()
    pv_eph2 = BibleJsonLoader.get_verses("Parole Vivante", "Eph", 2, 8)
    t1 = time.perf_counter()
    print(f"  [Parole Vivante] Éphésiens 2:8 chargé en {(t1-t0)*1000:.3f} ms.")
    assert len(pv_eph2['documents']) == 1
    print(f"  PV Éphésiens 2:8 = {pv_eph2['documents'][0]}")
    print("BibleJsonLoader : 100% OK !\n")

    print("========================================")
    print("TEST 3: VectorDB.get_by_reference (Unifié 4 Bibles)")
    print("========================================")
    db = VectorDB()
    registry = load_books_metadata()
    active_sources = [{"name": name, "embedding_model": meta.get("embedding_model", "study_library")} 
                      for name, meta in registry.items() if meta.get("active", False)]
    print(f"  Sources actives ({len(active_sources)}): {[s['name'] for s in active_sources]}")

    # Test Jean 3:16 multi-bibles
    t0 = time.perf_counter()
    res_j316 = db.get_by_reference("Jean 3:16", active_sources=active_sources)
    t1 = time.perf_counter()
    print(f"  Recherche 'Jean 3:16' effectuée en {(t1-t0)*1000:.2f} ms")
    assert res_j316 is not None and len(res_j316['documents']) > 0

    sources_found = set(m['name'] for m in res_j316['metadatas'])
    print(f"  Bibles trouvées dans 'Jean 3:16': {sources_found}")
    assert "Segond 21" in sources_found
    assert "PV" in sources_found

    for doc, meta in zip(res_j316['documents'], res_j316['metadatas']):
        print(f"    [{meta['name']}] {doc.strip()}")
    print("VectorDB unifié : 100% OK !\n")

    print("========================================")
    print("TEST 4: Comparaison et Diff multi-bibles")
    print("========================================")
    import difflib
    docs_by_name = {m['name']: d for d, m in zip(res_j316['documents'], res_j316['metadatas'])}
    
    if "Segond 21" in docs_by_name and "PV" in docs_by_name:
        s21 = docs_by_name["Segond 21"]
        pv = docs_by_name["PV"]
        matcher = difflib.SequenceMatcher(None, s21, pv)
        diff_pct = int((1.0 - matcher.ratio()) * 100)
        print(f"  Différence entre S21 et PV pour Jn 3:16: {diff_pct}%")
        print(f"    S21: {s21.strip()}")
        print(f"    PV : {pv.strip()}")

    print("========================================")
    print("TOUS LES TESTS ONT RÉUSSI AVEC SUCCÈS ! 🎉")
    print("========================================")

if __name__ == '__main__':
    test_json_bible_integration()
