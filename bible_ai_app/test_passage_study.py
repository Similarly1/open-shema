import sys
import os
import json

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8')

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from core.passage_study_manager import PassageStudyManager

def test_bounds_parsing():
    test_cases = [
        ("Philippiens 2:5-11", "Phi", 2, 5, 2, 11),
        ("Phil 2:5-11", "Phi", 2, 5, 2, 11),
        ("Genèse 22:1-19", "Gen", 22, 1, 22, 19),
        ("Romains 8:1-17", "Rom", 8, 1, 8, 17),
        ("Jean 3:16", "Joh", 3, 16, 3, 16),
        ("Psaume 23", "Psa", 23, 1, 23, 999),
        ("1 Co 13", "1Co", 13, 1, 13, 999),
        ("Genèse 1:1-2:3", "Gen", 1, 1, 2, 3),
    ]

    print("=== TEST PARSING REFERENCES ===")
    for raw, exp_b, exp_c1, exp_v1, exp_c2, exp_v2 in test_cases:
        res = PassageStudyManager.parse_passage_bounds(raw)
        assert res is not None, f"Échec parsing : {raw}"
        assert res["book_code"].upper() == exp_b.upper(), f"Livre incorrect pour {raw}: {res['book_code']} != {exp_b}"
        assert res["start_ch"] == exp_c1, f"start_ch incorrect pour {raw}"
        assert res["start_v"] == exp_v1, f"start_v incorrect pour {raw}"
        assert res["end_ch"] == exp_c2, f"end_ch incorrect pour {raw}"
        print(f"✓ {raw:20} -> {res['french_book']} ({res['book_code']}) {res['start_ch']}:{res['start_v']}–{res['end_ch']}:{res['end_v']}")

def test_nt_passage_data():
    print("\n=== TEST NT PASSAGE DATA (Philippiens 2:5-11) ===")
    data = PassageStudyManager.get_passage_study_data("Philippiens 2:5-11")
    assert data["success"] is True, f"Erreur: {data.get('error')}"
    print(f"Référence officielle : {data['reference']}")
    print(f"Péricope : {data['pericope']['title']}")
    print(f"Versets principaux ({data['scripture']['main_version']}) : {len(data['scripture']['verses'])} versets")
    
    orig = data["original_language"]
    print(f"Langue originale : {orig.get('language')}")
    print(f"Texte original disponible : {orig.get('available')}, RTL: {orig.get('is_rtl')}")
    print(f"Total mots originaux : {orig.get('total_words_count')}")
    print(f"Extrait continu : {orig.get('continuous_text')[:120]}...")
    print(f"Lemmes clés : {[l['lemma'] + ' (' + l['strong'] + ')' for l in orig.get('key_lemmas', [])[:5]]}")
    
    comms = data["commentaries"]
    print(f"Auteurs de commentaires ({comms['total_authors']}) : {comms['authors_list']}")
    
    syn = data["scripture"]["synoptic_matrix"]
    print(f"Matrice synoptique : {len(syn)} rangées, versions = {list(syn[0]['versions'].keys()) if syn else []}")

def test_ot_passage_data():
    print("\n=== TEST OT PASSAGE DATA (Psaume 23) ===")
    data = PassageStudyManager.get_passage_study_data("Psaume 23")
    assert data["success"] is True, f"Erreur: {data.get('error')}"
    print(f"Référence officielle : {data['reference']}")
    print(f"Péricope : {data['pericope']['title']}")
    print(f"Versets principaux ({data['scripture']['main_version']}) : {len(data['scripture']['verses'])} versets")
    
    orig = data["original_language"]
    print(f"Langue originale : {orig.get('language')}")
    print(f"Texte original disponible : {orig.get('available')}, RTL: {orig.get('is_rtl')}")
    print(f"Total mots originaux : {orig.get('total_words_count')}")
    print(f"Extrait continu : {orig.get('continuous_text')[:120]}...")
    print(f"Lemmes clés : {[l['lemma'] + ' (' + l['strong'] + ')' for l in orig.get('key_lemmas', [])[:5]]}")

if __name__ == "__main__":
    test_bounds_parsing()
    test_nt_passage_data()
    test_ot_passage_data()
    print("\n TOUS LES TESTS BACKEND SONT PASSES AVEC SUCCES !")
