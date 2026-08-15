# Free Logos AI

Une application moderne et complète d'étude biblique assistée par IA (PyQt6 / Python), inspirée des fonctionnalités avancées de logiciels comme Logos Bible Software.

## Fonctionnalités Principales

- **Lecteur & Étude Biblique Multi-versions** : Support de nombreuses traductions françaises et sources originales (BDS, Segond 1910, SBLGNT/MorphGNT, Chouraqui, TOB, Sagesse Vivante, Parole Vivante, etc.).
- **Interlinéaire Inversé Complet** : Analyse mot à mot (Hébreu/Grec), lemmes, translittérations, codes Strong, analyse morphologique et dictionnaires intégrés (Strong Hébreu/Grec, Bailly, Dictionnaire Calmet).
- **Mode Comparaison & Calcul de Différence Textuelle** : Comparaison verset par verset avec surlignage des divergences et calcul du pourcentage de similarité lexicale.
- **Assistant IA Théologique & RAG** : Recherche sémantique locale / vectorielle avec ChromaDB, intégration Gemini et Mistral AI, citations exactes de passages et de commentaires.
- **Interface Graphique Moderne (PyQt6)** : Thème sombre/clair personnalisable, gestion de la typographie, taille de police, espacement interlinéaire et inter-mots.

## Installation

1. Cloner le dépôt :
```bash
git clone https://github.com/Similarly1/free-logos-ai.git
cd free-logos-ai/bible_ai_app
```

2. Créer un environnement virtuel et installer les dépendances :
```bash
python -m venv venv
# Sur Windows :
venv\Scripts\activate
# Sur Linux/macOS :
source venv/bin/activate

pip install -r requirements.txt
```

3. Configuration :
Copier `data/config.example.json` vers `data/config.json` et renseigner vos clés API si vous souhaitez utiliser l'IA Gemini ou Mistral.

4. Lancer l'application :
```bash
python main.py
```
ou exécuter `launch.bat` (Windows).
