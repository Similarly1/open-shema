<p align="center">
  <img src="assets/img/logo-transparent.svg" alt="Open Shema Logo" width="160">
</p>

<h1 align="center">Open Shema</h1>

<p align="center">
  <strong>« Écoute » (<em>Shema</em>) — La suite d'étude biblique, d'exégèse et d'homilétique ouverte, moderne et augmentée par IA.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Licence-MIT-blue.svg" alt="License MIT">
  <img src="https://img.shields.io/badge/Python-3.10%2B-blue?logo=python&logoColor=white" alt="Python 3.10+">
  <img src="https://img.shields.io/badge/Interface-PyWebView%20%2F%20Edge%20WebView2-informational" alt="WebView2">
  <img src="https://img.shields.io/badge/RAG-Local%20BGE--M3%20Reranker-success" alt="BGE-M3 RAG">
  <img src="https://img.shields.io/badge/IA%20Souveraine-Gemini%20%7C%20Mistral%20%7C%20Infomaniak-orange" alt="IA Providers">
  <img src="https://img.shields.io/badge/Vie%20Privée-100%25%20Local%20%26%20Markdown-brightgreen" alt="100% Local Markdown">
  <a href="https://github.com/Similarly1/open-shema-data"><img src="https://img.shields.io/badge/Ressources-open--shema--data-purple.svg" alt="Ressources open-shema-data"></a>
</p>

---

## 📜 La Genèse & Philosophie d'Open Shema

Pour de nombreux pasteurs, enseignants, théologiens et étudiants de la Bible, le quotidien de la recherche est souvent bloqué par un dilemme frustrant :
1. **L'enfermement dans des logiciels propriétaires lourds et coûteux (comme Logos Bible Software)**, où l'on accumule des documents Word formatés pour un écosystème fermé, difficiles à valoriser ou à croiser librement.
2. **Des dizaines d'ouvrages théologiques au format EPUB ou PDF** stockés sur disque dur, dont le seul usage numérique se résumait jusqu'ici à des interrogations RAG basiques via des chatbots généralistes ou NotebookLM, sans ancrage exégétique rigoureux ni liens directs vers les versets.

> **Open Shema est né d'une volonté simple : briser ces silos et libérer votre bibliothèque théologique.**

L'objectif d'Open Shema est d'**exploiter au maximum tous vos ouvrages et ressources** (Word/DOCX avec balisage biblique, livres EPUB, PDF, bases SQLite, modules libres), grâce à :
- Une **reconnaissance universelle et instantanée des références scripturaires** dans n'importe quel texte.
- Une **détection et structuration automatique** des chapitres, sections, péricopes et titres de parties.
- Un **moteur RAG (Retrieval-Augmented Generation) ultra-affiné** avec reranking sémantique local (**Cross-Encoder BGE-M3** sur CPU) pour éliminer le bruit et garantir l'absence d'hallucination.
- Le **choix délibéré et transparent du LLM** parmi trois fournisseurs d'excellence (Gemini, Mistral, Infomaniak) avec **prompts système 100% visibles, modifiables et débridables**.
- Des **données 100% locales en Markdown clair (`.md`)** : tout ce que vous créez (notes, prédications, surlignages) reste interopérable et immédiatement exploitable par vos propres **IA agentiques locales** ou logiciels favoris (Obsidian, VS Code).

> 📦 **Ressources, Bibles, Dictionnaires et Commentaires** :  
> Open Shema sépare rigoureusement le moteur applicatif des corpus de textes. Pour explorer, télécharger et installer les modules de ressources libres, consultez le dépôt dédié :  
> 👉 **[https://github.com/Similarly1/open-shema-data](https://github.com/Similarly1/open-shema-data)**

Son nom s'inspire du grand commandement biblique du *Shema Israël* (Deutéronome 6:4 — שְׁמַע יִשְׂרָאֵל) : écouter, lire, analyser et méditer les Écritures avec profondeur et clarté.

---

## 📑 Sommaire

1. [🌟 Fonctionnalités Principales](#-fonctionnalités-principales)
   - [📖 1. Lecteur Biblique, Langues Originales & Synopse](#-1-lecteur-biblique-langues-originales--synopse)
   - [📚 2. Dictionnaires Historiques & Lexiques Originaux](#-2-dictionnaires-historiques--lexiques-originaux)
   - [💬 3. Bibliothèque de Commentaires & Multi-Fenêtrage](#-3-bibliothèque-de-commentaires--multi-fenêtrage)
   - [🔬 4. Atelier de Passage, Péricopes & Cartographie](#-4-atelier-de-passage-péricopes--cartographie)
   - [🎙️ 5. Studio de Prédication & Banque d'Illustrations](#-5-studio-de-prédication--banque-dillustrations)
   - [📖 6. Espace Théologie & Flux d'Articles](#-6-espace-théologie--flux-darticles)
   - [🎨 7. Ressources Visuelles & BibleProject](#-7-ressources-visuelles--bibleproject)
   - [🧠 8. Assistant IA Exégétique & RAG Haute Précision](#-8-assistant-ia-exégétique--rag-haute-précision)
2. [📦 Accès aux Ressources & Modules (`open-shema-data`)](#-accès-aux-ressources--modules-open-shema-data)
3. [🗃️ Formats Ouverts, Interopérabilité & Écosystème Agentique](#️-formats-ouverts-interopérabilité--écosystème-agentique)
4. [🛠️ Architecture & Confidentialité](#️-architecture--confidentialité)
5. [🚀 Démarrage Rapide](#-démarrage-rapide)
6. [⚙️ Configuration de l'IA](#️-configuration-de-lia)
7. [📜 Licence](#-licence)

---

## 🌟 Fonctionnalités Principales

### 📖 1. Lecteur Biblique, Langues Originales & Synopse

* **Multi-Versions & Affichage Parallèle** : Comparez côte à côte plusieurs traductions contemporaines et historiques en lecture synchronisée.
* **Textes Sources Originaux** :
  * Textes massorétiques hébreux et araméens avec vocalisation et cantillation.
  * Textes grecs du Nouveau Testament et version grecque de la Septante (LXX).
* **Interlinéaire Inversé Complet** :
  * Analyse mot à mot interactive : racine, lemme, code Strong, translittération phonétique et analyse morphosyntaxique intégrale (temps, voix, mode, cas, genre, nombre).
* **Comparaison Synoptique Avancée** :
  * Affichage synoptique automatique verset par verset avec calcul de similarité lexicale et surlignage des variantes de formulation.
* **Surlignage Multicolore & Marqueurs** : Balisez vos textes selon vos propres thématiques avec mémorisation instantanée.

---

### 📚 2. Dictionnaires Historiques & Lexiques Originaux

* **Lexiques Originaux Hébreu & Grec** : Définitions enrichies, lemmes, racines et concordances d'occurrences.
* **Dictionnaires Historiques & Érudition Ancienne** : Exploration de grands dictionnaires bibliques, historiques et critiques numérisés.
* **Recherche Lexicale Transversale** : Retrouvez instantanément toutes les occurrences d'une racine ou d'un lemme à travers l'ensemble des Écritures.
* **Consultation Instantanée** au survol d'un mot ou via un volet latéral contextuel.

---

### 💬 3. Bibliothèque de Commentaires & Multi-Fenêtrage

* **Corpus Exégétique et Homilétique** :
  * Navigation structurée à travers des commentaires historiques, pastoraux et contemporains verset par verset.
* **Multi-Fenêtrage Synchronisé en Direct** :
  * Détachez la fenêtre de commentaires sur un second écran : elle suit automatiquement et en temps réel le chapitre et le verset sélectionnés sur votre fenêtre principale.
* **Synthèses Comparatives IA (Sans Hallucination)** :
  * **Synthèse de passage** : Cartographie comparative instantanée découpée en 4 volets : *Consensus exégétique*, *Nuances & Débats doctrinaux*, *Apports spécifiques par auteur*, et *Pistes d'arbitrage herméneutique*.
  * **Synthèse d'introduction au livre** : Auteur, date, destinataires, plan littéraire d'ensemble et thèmes doctrinaux majeurs croisés depuis toutes les sources.

---

### 🔬 4. Atelier de Passage, Péricopes & Cartographie

* **Découpage Littéraire en Péricopes** : Visualisez d'un coup d'œil les articulations logiques et les grandes unités de texte.
* **Cartographie Biblique Interactive (Leaflet)** :
  * Détection automatique des toponymes bibliques cités dans le passage.
  * Visualisation immédiate sur carte dynamique : frontières antiques, trajets apostoliques, cités et reliefs du Proche-Orient biblique.
* **Liens Intertextuels & Références Croisées** : Réseau de correspondances textuelles entre Ancien et Nouveau Testament.
* **Garde-fous Herméneutiques (D.A. Carson)** : L'IA est rigoureusement bridée contre les pièges exégétiques classiques (*sophisme de la racine, anachronisme sémantique, transfert indu de totalité, faux aoriste ponctuel*).

---

### 🎙️ 5. Studio de Prédication & Banque d'Illustrations

* **Atelier Homilétique Dédié** :
  * Rédigez vos messages avec un canevas éprouvé : *Titre, Passage source, Thème, Proposition Centrale du Texte (PCT), Plan structuré en points, Applications concrètes*.
* **Banque d'Illustrations Enrichie** :
  * Base de données d'illustrations de prédication classées par thématiques et directement connectées aux passages scripturaires.
* **Gestionnaire d'Archives Pastorales** :
  * Classez, retrouvez et réexploitez facilement vos séries de sermons et messages passés.

---

### 📖 6. Espace Théologie & Flux d'Articles

* **Lecteur d'Ouvrages Théologiques (EPUB / PDF)** :
  * Lisez vos livres, monographies et traités de théologie directement dans Open Shema.
* **Détection Intelligente & Clics Scripturaires Universels** :
  * Toute référence biblique présente dans un texte — quelle que soit sa graphie (abréviations comme *Rm 8.28*, *Ep 2:8-10* ou noms complets comme *Romains 8:28*) — est automatiquement reconnue et cliquable pour l'ouvrir instantanément dans le lecteur biblique.
* **Résumés Théologiques par Chapitre** :
  * Génération automatique de la thèse de l'auteur, des arguments doctrinaux clés et du réseau de versets d'ancrage.
* **Hub d'Articles & Veille Théologique** :
  * Agrégateur intégré d'articles chrétiens de fond (*ToutPourSaGloire / TPSG* et *Évangile 21 / E21*) avec lecture hors-ligne et recherche plein texte.

---

### 🎨 7. Ressources Visuelles & BibleProject

* **Intégration BibleProject** : Accédez directement aux affiches d'architecture littéraire, synthèses visuelles et vidéos explicatives pour chaque livre de la Bible.

---

### 🧠 8. Assistant IA Exégétique & RAG Haute Précision

Open Shema refuse les boîtes noires fermées et place le contrôle absolu de l'IA entre les mains de l'utilisateur.

#### 🎯 Le Choix Délibéré de 3 Fournisseurs d'Excellence
L'utilisateur est libre de choisir le fournisseur et le modèle de son choix au sein de leur catalogue :
* **⚡ Google Gemini** : Pour la **puissance brute**, la rapidité foudroyante, la précision documentaire et les fenêtres de contexte monumentales.
* **🇫🇷 Mistral AI** : Pour disposer d'une solution **européenne de pointe**, nativement francophone, d'une grande finesse littéraire et stylistique dans la rédaction en français.
* **🇨🇭 Infomaniak AI** : Pour le **choix éthique et souverain**, garantissant la sécurité des données et le respect de la vie privée au sein de centres de données écologiques basés en Suisse.

#### 🔓 Transparence Totale & Prompts Système Débridables
Contrairement aux logiciels opaques, **tous les prompts système sont visibles, entièrement modifiables et débridables** dans les paramètres :
- Instructions d'exégèse historico-grammaticale (méthode Fee/Stuart/Osborne/Carson).
- Canevas d'analyse d'arrière-plan historique et Second Temple.
- Formats de synthèses comparatives de commentaires et d'introductions de livres.
- Prompts de traduction théologique fidèle et de résumés d'ouvrages.

#### ⚙️ RAG Hybride & Reranking Sémantique Local
* Vos documents sont indexés localement. Lors d'une requête, un modèle **Cross-Encoder BGE-M3** s'exécute **en local sur votre CPU** pour réordonner les fragments documentaires les plus pertinents avant filtrage par un LLM curateur. Résultat : zéro bruit, fidélité totale aux textes sources.
* **4 Modes d'Étude Préréglés** : *Exégèse approfondie*, *Contexte historique*, *Préparation de prédication*, *Analyse morphologique/lexicale*.
* **Profils Théologiques Configurables** : Calibrez l'orientation d'étude (*Neutre / Universitaire*, *Réformé / Évangélique*, *Catholique*, etc.).

---

## 📦 Accès aux Ressources & Modules (`open-shema-data`)

L'application **Open Shema** est un moteur applicatif indépendant. L'ensemble des modules de ressources (Bibles en langues originales et modernes, dictionnaires historiques, commentaires exégétiques et jeux de données documentaires) sont hébergés et maintenus sur le dépôt :

👉 **[https://github.com/Similarly1/open-shema-data](https://github.com/Similarly1/open-shema-data)**

Vous y trouverez :
- Les paquets de Bibles, dictionnaires et commentaires prêts à l'emploi.
- Les instructions pour ajouter vos propres modules ou synchroniser de nouveaux corpus.
- Les crédits détaillés, attributions et licences des sources textuelles du domaine public.

---

## 🗃️ Formats Ouverts, Interopérabilité & Écosystème Agentique

Open Shema a été pensé pour que **l'utilisateur ne soit jamais prisonnier de son outil** :

* **Stockage 100% Transparent en Markdown (`.md`)** :
  * Tout ce que vous créez — notes d'étude, manuscrits de prédications, canevas homilétiques, surlignages, synthèses — est sauvegardé **sur votre disque dur au format Markdown standard** avec en-têtes YAML structurés.
* **Prêt pour l'IA Agentique Locale** :
  * Parce que vos données sont en clair (`.md`), vous pouvez brancher n'importe quel **agent d'IA local** (Antigravity, Claude Desktop, Cursor, scripts d'automatisation) pour analyser, indexer, enrichir ou réorganiser vos travaux sans aucune barrière technique.
* **Interopérabilité Totale** :
  * Ouvrez, éditez et synchronisez instantanément vos notes et sermons avec **Obsidian**, **VS Code**, **Logseq**, **Typora** ou n'importe quel éditeur de votre choix.
* **Importateur Universel Multi-Formats** :
  * **Documents Word (`.docx`)** : Reconnaissance et conversion des styles et balisages bibliques.
  * **Livres numériques (`.epub`, `.pdf`)** : Découpage intelligent par chapitres, extraction des métadonnées et détection automatique des références bibliques.
  * **Bases de données & Modules libres** : Prise en charge des formats SQLite, JSON et XML.
* **Open Shema Store Intégré** :
  * Téléchargez en 1 clic les modules disponibles directement depuis l'application via le catalogue connecté.

---

## 🛠️ Architecture & Confidentialité

```
┌────────────────────────────────────────────────────────┐
│                   Open Shema Desktop                   │
│         PyWebView + HTML5 / Modern CSS / Vanilla JS    │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                    Python API Layer                    │
│   Bible Reader • Commentary • Study • Sermons • Store  │
└───────┬───────────────────┬───────────────────┬────────┘
        │                   │                   │
┌───────▼────────┐  ┌───────▼────────┐  ┌───────▼────────┐
│  Bases Locales │  │  RAG Pipeline  │  │   LLM Client   │
│  SQLite + JSON │  │ BGE-M3 Rerank  │  │ Infomaniak     │
│  Notes (.md)   │  │   (Local CPU)  │  │ Mistral        │
│  EPUB / DOCX   │  │ Chunk Curator  │  │ Gemini         │
└────────────────┘  └────────────────┘  └────────────────┘
```

- **Données 100% Locales & Portables** : Votre bibliothèque, vos notes, vos surlignages et vos sermons restent sur votre machine.
- **Sécurité des clés API** : Vos clés d'API (Gemini, Mistral, Infomaniak) sont stockées localement dans votre fichier de configuration sécurisé et ne transitent par aucun serveur tiers.

---

## 🚀 Démarrage Rapide

### Prérequis
- Windows 10/11 (avec runtime Microsoft Edge WebView2, présent par défaut)
- Python 3.10 ou supérieur

### Installation depuis les sources

```bash
# 1. Cloner le dépôt
git clone https://github.com/Similarly1/open-shema.git
cd open-shema/bible_ai_app

# 2. Créer et activer un environnement virtuel
python -m venv venv
venv\Scripts\activate      # Sur Windows
# source venv/bin/activate # Sur Linux / macOS

# 3. Installer les dépendances
pip install -r requirements.txt

# 4. Lancer l'application
python webview_app.py
```

> **Astuce Windows** : Vous pouvez également double-cliquer directement sur `launch_webview.bat` pour démarrer l'application.

---

## ⚙️ Configuration de l'IA

Au premier lancement (ou via le panneau **Paramètres ⚙️**), renseignez simplement la clé API du fournisseur de votre choix :

| Fournisseur | Atouts majeurs |
| :--- | :--- |
| **Infomaniak AI** | 🇨🇭 Hébergement suisse souverain, respect absolu de la vie privée et centres de données écologiques |
| **Mistral AI** | 🇫🇷 Modèles européens de pointe, excellence stylistique et rédactionnelle en français |
| **Google Gemini** | ⚡ Puissance brute, rapidité remarquable et fenêtres de contexte massives |

---

## 📜 Licence

Ce projet est distribué sous **Licence MIT**. Vous êtes libre de l'utiliser, l'étudier, le modifier et le partager.

Open Shema est conçu avec passion pour servir la communauté des étudiants de la Bible, des pasteurs, des enseignants et de tous ceux qui aiment approfondir le Texte.

