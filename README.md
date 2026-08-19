# Open Shema (שְׁמַע)

> **« Écoute » (*Shema*)** — Une plateforme d'étude biblique ouverte, moderne et assistée par IA, pensée pour la recherche exégétique, linguistique et théologique.

**Open Shema** est un logiciel libre (*open source*) dédié à la lecture, l'analyse approfondie et l'exploration des textes sacrés. Son nom puise sa source dans le grand verset biblique du *Shema Israël* (Deutéronome 6:4 — שְׁמַע יִשְׂרָאֵל), où écouter, lire et méditer les Écritures ne font qu'un.

---

## 🌟 Points Forts & Fonctionnalités

- **📖 Lecteur Biblique Multi-Versions & Parallèle** :
  - Support natif d'une large bibliothèque de traductions (LSG 1910, Segond 21, BDS, Darby, Chouraqui, TOB, Parole Vivante, Sagesse Vivante, etc.).
  - Textes originaux massorétiques (Hébreu/Araméen) et grecs (SBLGNT / MorphGNT / Septante LXX).
  - Mode comparaison synoptique verset par verset avec surlignage des divergences et calcul de similarité textuelle.

- **🔤 Interlinéaire Inversé & Morphologie Originale** :
  - Analyse mot à mot : lemmes, racines, translittérations, codes Strong et étiquettes grammaticales complètes.
  - Dictionnaires intégrés avec consultation instantanée au survol et en volet latéral : Lexique Strong (Hébreu/Grec), Dictionnaire Bailly Grec-Français, Dictionnaire Historique et Critique de Dom Calmet (1728), Dictionnaires encyclopédiques.

- **💬 Bibliothèque de Commentaires & Navigation Persistante** :
  - Accès aux commentaires exégétiques et homilétiques de référence (Matthew Henry, Jean Calvin, Adam Clarke, Scofield, Gaebelein, etc.).
  - Mémorisation de l'auteur préféré avec suggestions bienveillantes en cas de verset non commenté.

- **📝 Prise de Notes en Markdown Clair (`.md`)** :
  - Stockage des notes en fichiers Markdown standard en clair dans le dossier de votre choix sur votre ordinateur.
  - Synchronisation automatique avec le passage biblique actif.
  - Métadonnées YAML intégrées et inclusion granulaire dans le contexte de l'IA.

- **🧠 Assistant d'Étude & RAG Documentaire (Gemini / Mistral)** :
  - 4 modes spécialisés : *🔍 Exégèse approfondie*, *🏛️ Contexte historique & culturel*, *🎙️ Préparation de prédication / Message*, *🔤 Analyse lexicale*.
  - RAG haute précision : **Reranking sémantique local (Cross-Encoder BGE-M3)** sur CPU et **LLM Curateur** pour éliminer le bruit.
  - Sélection granulaire des corpus documentaires (Bibles, Commentaires, Dicos, Notes).

---

## 🚀 Démarrage Rapide

### 1. Prérequis
- Python 3.10+
- Navigateur moderne (Edge WebView2 sous Windows)

### 2. Installation
```bash
git clone https://github.com/Similarly1/free-logos-ai.git
cd free-logos-ai/bible_ai_app

# Créer un environnement virtuel
python -m venv venv
venv\Scripts\activate  # Windows

# Installer les dépendances
pip install -r requirements.txt
```

### 3. Lancement
Double-cliquez sur `launch_webview.bat` ou lancez :
```bash
python webview_app.py
```

---

## 📜 Licence
Projet Open Source sous licence MIT. Open Shema est conçu pour la communauté d'étude biblique, les pasteurs, enseignants, théologiens et curieux du texte.
