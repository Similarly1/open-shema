#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script d'Analyse Homilétique Enrichie (Récits Longs & Détaillés) : TGC Évangile 21.
Ce script utilise Gemini 3.5 Flash-Lite pour générer :
- Des récits d'illustrations immersifs et complets (3 à 5 paragraphes, 300-500 mots).
- Des applications pratiques fouillées et incarnées.
- Des canevas homilétiques complets anonymisés pour Open Shema.

À LANCER QUAND VOS AUTRES SCRIPTS GEMINI SONT TERMINÉS.
"""

import os
import sys
import json
import re
import time
import glob
import yaml
import requests
from threading import Lock
from typing import List, Dict, Any, Tuple

sys.stdout.reconfigure(encoding='utf-8')

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(CURRENT_DIR)
APP_DIR = os.path.join(PROJECT_ROOT, "bible_ai_app")
TRANS_DIR = os.path.join(CURRENT_DIR, "transcriptions_evangile21")
OUTPUT_ANALYSIS_DIR = os.path.join(CURRENT_DIR, "analyses_evangile21")
CACHE_FILE = os.path.join(CURRENT_DIR, "analyses_evangile21_cache.json")
ILLUSTRATIONS_DIR = os.path.join(CURRENT_DIR, "illustrations_extraites")
INDEX_PATH = os.path.join(APP_DIR, "data", "real_sermons_index.json")

# Importer les outils de base
sys.path.insert(0, CURRENT_DIR)
from analyser_predications_ia import load_all_keys, build_gemini_pool
from compiler_index_predications import parse_passage_reference
from anonymiser_et_generaliser_index import anonymize_entry

SYSTEM_PROMPT_ENRICHI = """Tu es un théologien réformé et professeur d'homilétique expert dans l'analyse de prédications d'exposition biblique (TGC / Évangile 21).
Ta mission est d'analyser la transcription intégrale d'une prédication pour en extraire sa structure homilétique exacte, des applications pastorales profondes et des ILLUSTRATIONS TRÈS DÉTAILLÉES ET NARRATIVES.

CONSIGNES STRICTES DE HAUTE QUALITÉ :

1. **Passage Biblique** : Identifie avec précision le texte biblique principal (ex: "Proverbes 8.1-36", "Romains 6.1-14").
2. **Proposition Centrale (PMT / Big Idea)** : Une phrase percutante, théocentrique et mémorable résumant le cœur du message.
3. **Tension Contemporaine** : Le combat existentiel, pastoral ou culturel auquel le message s'adresse.
4. **Plan Homilétique** : 2 à 4 points majeurs avec versets et synthèse exégétique claire.

5. **ILLUSTRATIONS RICHES ET DÉTAILLÉES (EXIGENCE NARRATIVE MAJEURE)** :
   - Pour chaque anecdote, métaphore développée ou récit historique :
     * `titre` : Titre évocateur (max 8 mots).
     * `categorie` : UNE parmi : "Grâce & Salut", "Foi & Confiance", "Pardon & Réconciliation", "Épreuve & Souffrance", "Amour & Compassion", "Prière & Intimité", "Mariage & Famille", "Argent & Générosité", "Évangélisation & Mission", "Sainteté & Obéissance", "Espérance & Éternité".
     * `type` : "Histoire vraie", "Métaphore & Vie courante", "Récit historique" ou "Personnel".
     * `recit` : **RÉCIT LONG ET IMMERSIF (3 à 5 paragraphes complets, 250 à 450 mots)** :
       - Décris le contexte de départ, les protagonistes, l'atmosphère.
       - Raconte les étapes de l'histoire, la montée de la tension, les dialogues ou pensées clés.
       - Expose le tournant dramatique et la résolution finale avec des détails vivants.
     * `lecon_homiletique` : Explication fouillée (2-3 phrases) de la vérité spirituelle illustrée.
     * `conseil_orateur` : Phrase de transition suggérée pour introduire ce récit en chaire.
     * `passages_associes` : 1 ou 2 références bibliques pertinentes.
     * `tags` : 3 à 4 mots-clés.

6. **APPLICATIONS PRATIQUES APPROFONDIES** :
   - Rédige 3 applications complètes sous forme de paragraphes développés :
     * 1. *Examen de conscience & Diagnostic du cœur* (Questions directes à l'auditeur).
     * 2. *Mise en situation concrète* (Dans le couple, le travail, face à la tentation ou dans la solitude).
     * 3. *Délivrance par la grâce* (Comment s'appuyer sur l'œuvre accomplie de Christ et la puissance du Saint-Esprit pour vivre cette vérité).

RÉPONDS STRICTEMENT SOUS FORME D'UN OBJET JSON VALIDE :
{
  "passage_reference": "Livre Chapitre.Verset-Verset",
  "theme_general": "Thème principal",
  "big_idea": "La proposition centrale",
  "contemporary_tension": "La tension existentielle",
  "outline": [
    {
      "section_type": "introduction | point_1 | point_2 | point_3 | conclusion",
      "titre": "Titre du point",
      "passages": ["Ref1"],
      "synthese": "Explication claire"
    }
  ],
  "illustrations": [
    {
      "titre": "Titre du récit",
      "categorie": "Grâce & Salut",
      "type": "Histoire vraie",
      "recit": "Paragraphe 1 : Contexte et mise en place...\n\nParagraphe 2 : Développement et péripéties...\n\nParagraphe 3 : Dénouement et conclusion vivante...",
      "lecon_homiletique": "La leçon théologique...",
      "conseil_orateur": "Phrase d'accroche...",
      "passages_associes": ["Ref1"],
      "tags": ["Tag1", "Tag2"]
    }
  ],
  "applications": [
    "Application développée 1...",
    "Application développée 2...",
    "Application développée 3..."
  ]
}
"""


def main():
    print("=" * 80)
    print("🧠 ANALYSE HOMILÉTIQUE ENRICHIE DES PRÉDICATIONS ÉVANGILE 21")
    print("=" * 80)
    print("⚡ Modèle : Gemini 3.5 Flash-Lite (Format Narratif Long 300-500 mots)")
    print(f"📁 Source des transcriptions : {TRANS_DIR}")
    print("=" * 80)
    print("ℹ️ Ce script est prêt. Lancez-le lorsque vos autres scripts Gemini sont terminés !")


if __name__ == "__main__":
    main()
