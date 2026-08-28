"""
Unit test for EbookFinderManager in Open Shema
"""

import sys
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

from core.ebook_finder_manager import EbookFinderManager

def test_ebook_finder():
    finder = EbookFinderManager()
    
    # Test 1: Validation du filtre strict
    print("--- Test 1: Filtrage strict E-book ---")
    assert finder.is_strictly_ebook("La Bible NFC - Ebook", "/products/nfc-ebook") == True
    assert finder.is_strictly_ebook("La Bible NFC reliée cuir", "/products/nfc-cuir-relie") == False
    assert finder.is_strictly_ebook("Commentaire Romain (Format numérique)", "/products/romains") == True
    assert finder.is_strictly_ebook("Livre broché standard 500 pages", "/products/livre-broche") == False
    print("  ✅ Tests unitaires du filtre strict validés avec succès.")

    # Test 2: Nettoyage des titres
    print("\n--- Test 2: Nettoyage des titres ---")
    clean = finder.clean_ebook_title("Doux et humble de coeur (eBook)")
    print(f"  Brut: 'Doux et humble de coeur (eBook)' -> Nettoyé: '{clean}'")
    assert "eBook" not in clean
    print("  ✅ Nettoyage validé.")

    # Test 3: Recherche multi-plateforme en live
    print("\n--- Test 3: Recherche multi-plateformes en direct ---")
    res = finder.search_all_ebooks("Nouvelle Français Courant")
    print(f"  Résultats trouvés : {res['count']}")
    print(f"  Liens directs vers stores : {len(res['direct_links'])}")
    
    assert res['count'] > 0
    for r in res['results']:
        print(f"  • [{r['store_badge']}] {r['title']} - {r['price']} ({r['format']})")
        # Vérification qu'aucun livre papier n'est passé
        assert "cuir" not in r['title'].lower()
        assert "broché" not in r['title'].lower()

    print("\n  ✅ TOUS LES TESTS SONT PASSÉS AVEC SUCCÈS !")

if __name__ == "__main__":
    test_ebook_finder()
