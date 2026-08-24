import os
import sys
import json

sys.stdout.reconfigure(encoding='utf-8')

from core.passage_study_manager import PassageStudyManager
from core.synoptic_manager import SynopticManager

def run_tests():
    print("=== TEST 1: Passage MAT 9:1-8 (Triple/Quadruple Tradition) ===")
    data_mat = PassageStudyManager.get_passage_study_data("Matthieu 9:1-8", "LSG")
    assert data_mat["success"], "Failed to load MAT 9:1-8"
    g_syn = data_mat.get("gospel_synopsis")
    assert g_syn is not None, "Missing gospel_synopsis"
    assert g_syn.get("has_synoptic"), "Should have synoptic"
    print(f"Péricopes trouvées : {len(g_syn['pericopes'])}")
    for p in g_syn['pericopes']:
        print(f"  #{p['id']} [{p['tradition_type']}]: {p['title_fr']} (Évangiles: {p['active_gospels']})")
    print(f"Versets avec parallèles inline : {len(g_syn['verse_parallels'])}")
    sample_vk = next(iter(g_syn['verse_parallels']))
    print(f"  Exemple pour verset {sample_vk}: {g_syn['verse_parallels'][sample_vk]['badges_str']}")
    
    mat = g_syn.get("synopsis_matrix")
    assert mat is not None, "Missing synopsis_matrix"
    print(f"Colonnes synoptiques: {[c['book'] for c in mat['columns']]}")
    print(f"Lignes alignées: {len(mat['rows'])}")

    print("\n=== TEST 2: Passage LUC 10:25-37 (Sondergut Lucanien - Bon Samaritain) ===")
    data_luc = PassageStudyManager.get_passage_study_data("Luc 10:25-37", "LSG")
    assert data_luc["success"], "Failed to load Luc 10"
    g_syn_luc = data_luc.get("gospel_synopsis")
    assert g_syn_luc.get("has_synoptic"), "Should have synoptic for Luc 10"
    print(f"Péricopes trouvées pour Luc 10: {len(g_syn_luc['pericopes'])}")
    for p in g_syn_luc['pericopes']:
        print(f"  #{p['id']} [{p['tradition_type']}]: {p['title_fr']}")

    print("\n=== TEST 3: Passage hors Évangiles (Romains 8:1-11) ===")
    data_rom = PassageStudyManager.get_passage_study_data("Romains 8:1-11", "LSG")
    assert data_rom["success"], "Failed to load Rom 8"
    g_syn_rom = data_rom.get("gospel_synopsis")
    assert not g_syn_rom.get("has_synoptic"), "Romains 8 should not have gospel synoptic"
    print("Succès: Romains 8 n'a pas de synopse évangélique.")

    print("\n=== TEST 4: Pivot switch (Harmonie #43 pivoté sur Marc) ===")
    harm_mrk = PassageStudyManager.get_synoptic_harmony(43, "LSG", "MRK")
    assert harm_mrk["success"], "Failed to load harmony 43"
    cols = [c["book"] for c in harm_mrk["matrix"]["columns"]]
    print(f"Colonnes après pivot Marc: {cols} (Premier: {cols[0]})")
    assert cols[0] == "MRK", "MRK should be first column"

    print("\n=== TEST 5: Texte grec original SBLGNT ===")
    first_row_cells = harm_mrk["matrix"]["rows"][0]["cells"]
    for b_code, c in first_row_cells.items():
        if not c.get("is_empty"):
            print(f"  {b_code} [FR]: {c['text_fr'][:45]}...")
            print(f"  {b_code} [GR]: {c['text_gr'][:45]}...")

    print("\n[TOUS LES TESTS SONT PASSÉS AVEC SUCCÈS !]")

if __name__ == "__main__":
    run_tests()
