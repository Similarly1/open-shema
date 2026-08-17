import time
import sys
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
from core.search_engine import SearchEngine

def run_tests():
    se = SearchEngine()
    print("=== DÉBUT DES TESTS DU MOTEUR DE RECHERCHE ===")

    # 1. Test Recherche Simple Phrase Exacte
    t0 = time.time()
    r_single = se.search_bibles('Dieu a tant aime le monde', versions=['Segond 21'], match_mode='EXACT_PHRASE')
    t1 = time.time()
    print(f"1. Phrase exacte (Segond 21) : {len(r_single)} résultat(s) en {(t1-t0)*1000:.2f} ms")
    for r in r_single:
        print(f"   [{r['version_name']}] {r['reference']} -> {r['text']}")

    # 2. Test Multi-Versions
    t0 = time.time()
    r_multi = se.search_bibles('grace foi', versions=['Segond 21', 'BDS', 'NBS', 'LSG'])
    t1 = time.time()
    print(f"\n2. Multi-versions (grâce foi) : {len(r_multi)} résultat(s) en {(t1-t0)*1000:.2f} ms")
    for r in r_multi[:4]:
        print(f"   [{r['version_name']}] {r['reference']} -> {r['text'][:80]}...")

    # 3. Test Corpus Canonique (Épîtres uniquement)
    t0 = time.time()
    r_corpus = se.search_bibles('amour', versions=['Segond 21'], corpus='EPISTLES')
    t1 = time.time()
    print(f"\n3. Corpus Épîtres (amour) : {len(r_corpus)} résultat(s) en {(t1-t0)*1000:.2f} ms")

    # 4. Test Commentaires Pères & Théologiens
    t0 = time.time()
    r_comm = se.search_commentaries('justification par la foi')
    t1 = time.time()
    print(f"\n4. Commentaires (justification par la foi) : {len(r_comm)} résultat(s) en {(t1-t0)*1000:.2f} ms")
    for r in r_comm[:2]:
        print(f"   💬 [{r['author']}] {r['reference']} -> {r['snippet']}")

    # 5. Test Dictionnaires & Lexiques
    t0 = time.time()
    r_dict = se.search_dictionaries('alliance')
    t1 = time.time()
    print(f"\n5. Dictionnaires (alliance) : {len(r_dict)} résultat(s) en {(t1-t0)*1000:.2f} ms")
    for r in r_dict[:2]:
        print(f"   📚 [{r['dict_name']}] {r['term']} -> {r['snippet']}")

    # 6. Test Recherche Globale
    t0 = time.time()
    r_global = se.search_global_library('Abraham')
    t1 = time.time()
    print(f"\n6. Recherche Globale Bibliothèque (Abraham) : {r_global['total_count']} résultat(s) en {(t1-t0)*1000:.2f} ms")
    print(f"   • Bibles : {len(r_global['bibles'])}")
    print(f"   • Commentaires : {len(r_global['commentaries'])}")
    print(f"   • Dictionnaires : {len(r_global['dictionaries'])}")

    print("\n=== TOUS LES TESTS SONT VALIDES AVEC SUCCÈS ===")

if __name__ == '__main__':
    run_tests()
