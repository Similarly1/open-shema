# -*- coding: utf-8 -*-
"""
Script de test de validation pour le pipeline BibleProject (FR)
Vérifie le chargement des données, le filtrage par chapitre, et l'intégration dans l'Aperçu 360°.
"""

import os
import sys

# Ajouter le répertoire racine de l'app au PYTHONPATH
sys.path.insert(0, os.path.dirname(__file__))

from core.passage_study_manager import PassageStudyManager

def run_tests():
    print("=== TEST 1: Chargement direct des médias BibleProject ===")
    
    # Test Genèse ch. 1
    gen1 = PassageStudyManager.get_bibleproject_media("GEN", 1)
    assert gen1["success"] is True, "Échec chargement GEN 1"
    assert gen1["book_code"] == "GEN", "Code livre incorrect"
    assert len(gen1["current_videos"]) >= 1, "Aucune vidéo pour Genèse 1"
    assert gen1["current_videos"][0]["title"] == "Genèse 1-11 — Panorama"
    assert len(gen1["current_posters"]) >= 1, "Aucun poster pour Genèse 1"
    print(f" [PASS] GEN 1: {len(gen1['current_videos'])} vidéo(s), {len(gen1['current_posters'])} poster(s)")

    # Test Genèse ch. 20 (Partie 2: 12-50)
    gen20 = PassageStudyManager.get_bibleproject_media("GEN", 20)
    assert gen20["current_videos"][0]["title"] == "Genèse 12-50 — Panorama"
    print(f" [PASS] GEN 20: Vidéo adaptée sélectionnée ({gen20['current_videos'][0]['title']})")

    # Test Matthieu ch. 1
    mat1 = PassageStudyManager.get_bibleproject_media("MAT", 1)
    assert len(mat1["current_videos"]) >= 1
    print(f" [PASS] MAT 1: {len(mat1['current_videos'])} vidéo(s), {len(mat1['current_posters'])} poster(s)")

    # Test Apocalypse ch. 15
    rev15 = PassageStudyManager.get_bibleproject_media("REV", 15)
    assert len(rev15["current_videos"]) >= 1
    assert "Apocalypse 12-22" in rev15["current_videos"][0]["title"]
    print(f" [PASS] REV 15: {rev15['current_videos'][0]['title']}")

    print("\n=== TEST 2: Intégration dans le Bundle Aperçu 360° ===")
    bundle = PassageStudyManager.get_passage_overview_bundle("GEN", 1, 1, "LSG")
    assert bundle["success"] is True, "Échec bundle Aperçu 360°"
    assert "bibleproject" in bundle, "Clé bibleproject manquante dans le bundle"
    assert bundle["stats"]["bibleproject_videos_count"] >= 1
    assert bundle["stats"]["bibleproject_posters_count"] >= 1
    print(f" [PASS] Bundle GEN 1:1 contient {bundle['stats']['bibleproject_videos_count']} vidéos et {bundle['stats']['bibleproject_posters_count']} posters")

    print("\n=== TOUS LES TESTS SONT VALIDES AVEC SUCCÈS ===")

if __name__ == "__main__":
    run_tests()
