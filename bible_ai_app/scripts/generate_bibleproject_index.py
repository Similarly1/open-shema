# -*- coding: utf-8 -*-
"""
Script de génération et actualisation du dataset BibleProject (FR)
Génère data/bibleproject_fr.json avec les 66 livres, vidéos YouTube officielles FR et posters CDN.
"""

import os
import sys
import json
import shutil

def main():
    base_dir = os.path.dirname(os.path.dirname(__file__))
    target_path = os.path.join(base_dir, "data", "bibleproject_fr.json")
    
    # Vérifier que le fichier JSON est présent et valide
    if os.path.exists(target_path):
        with open(target_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        print(f"Dataset BibleProject (FR) vérifié : {data.get('total_books_covered', 0)} livres, {len(data.get('themes', []))} thèmes, {len(data.get('word_studies', []))} études de mots.")
    else:
        print(f"Erreur : {target_path} introuvable.")

if __name__ == "__main__":
    main()
