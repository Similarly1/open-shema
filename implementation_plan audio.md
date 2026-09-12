# Plan d'implémentation — Studio Audio (Podcasts & Chroniques Théologiques)

Ce plan décrit l'intégration complète de la fonctionnalité **Studio Audio** dans Open Shema. Il permet de générer des dialogues d'exégèse (Animateur / Exégète) ou des chroniques méditatives (Solo) ancrés strictement sur le corpus biblique et théologique local, avec synthèse vocale par **Microsoft Edge-TTS** (gratuit illimité) ou **Mistral Voxtral** (expressif).

L'ensemble respecte scrupuleusement les consignes : **zéro émoji** (icônes vectorielles SVG sobres uniquement), **paramétrage intégral** visualisable et éditable dans les Paramètres généraux (onglet IA), et **options de filtrage de sources / curation RAG identiques à l'Assistant IA**.

---

## Directives et Principes d'Architecture

- **Zéro émoji** : Toute l'interface (boutons, badges, notifications, sélecteurs, jauges) emploie exclusivement des icônes SVG fines conformes à la charte existante d'Open Shema.
- **Transcript-First** : La génération du script textuel est découplée de la synthèse vocale. L'utilisateur peut inspecter, relire et corriger chaque réplique avant de lancer le rendu audio.
- **Maîtrise totale des sources & RAG (Identique à l'Assistant IA)** :
  - Sélection granulaire des corpus actifs par cases à cocher : Bibles, Commentaires, Dictionnaires, Articles, Notes personnelles (.md), Textes UPVR, Traités de théologie.
  - Jauge / Sélecteur du nombre de tokens alloués par extrait de source (Éclair ~250 tokens, Équilibré ~600 tokens, Approfondi ~1200 tokens, Exhaustif).
  - Reranking sémantique local (Cross-Encoder BGE-M3).
  - LLM Curateur intermédiaire activable (filtre, condense et élimine le bruit documentaire avant la scénarisation).
  - Prise en compte optionnelle du Passeport Herméneutique (« Mon Église »).
- **Architecture par Mixin & Tâches asynchrones** : Le backend étend `BibleAppApi` via un nouveau `AudioStudioMixin`, et informe l'UI de la progression via `TaskManager`.

---

## Changements Proposés

### 1. Configuration & System Prompts (`core/config.py`)

#### [MODIFY] [core/config.py](file:///c:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/core/config.py)
- Définition de `DEFAULT_AUDIO_STUDIO_DIALOGUE_PROMPT` :
  - Rôle du Locuteur A (Animateur curieux et pédagogue) et du Locuteur B (Exégète rigoureux).
  - Règle de citation stricte des sources textuelles sans extrapolation.
  - Sortie en JSON strict : tableau de répliques `[{"speaker": "host"|"scholar", "voice_role": "A"|"B", "text": "...", "pause_after_ms": 350}]`.
- Définition de `DEFAULT_AUDIO_STUDIO_SOLO_PROMPT` :
  - Rôle de l'enseignant théologien pour une chronique continue, rythmée et méditative.
- Ajout de la section `audio_studio` dans la configuration par défaut :
  ```python
  "audio_studio": {
      "engine": "edge_tts",                  # "edge_tts" | "voxtral"
      "edge_voice_speaker_a": "fr-FR-DeniseNeural",
      "edge_voice_speaker_b": "fr-FR-HenriNeural",
      "edge_voice_solo": "fr-FR-HenriNeural",
      "pause_between_turns_ms": 350,
      "voxtral_modulate_intonation": True,
      "voxtral_voice": "default",
      "default_sources": {
          "bibles": True,
          "commentaries": True,
          "dictionaries": True,
          "articles": True,
          "notes": True,
          "upvr": True,
          "theology": True
      },
      "default_context_depth": 1,            # 0: Éclair, 1: Équilibré (600 tokens), 2: Approfondi, 3: Exhaustif
      "enable_reranking": True,
      "enable_curator": False,
      "include_theological_profile": True,
      "custom_system_prompt_dialogue": None,
      "custom_system_prompt_solo": None
  }
  ```

---

### 2. Moteur Métier, RAG & Synthèse Audio (`core/podcast_manager.py`)

#### [NEW] [core/podcast_manager.py](file:///c:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/core/podcast_manager.py)
- **Pipeline RAG & Curation dédié au Studio Audio :**
  - Utilise `RAGPipeline` pour interroger ChromaDB sur les corpus activés (`active_sources`).
  - Applique le reranking BGE-M3 si activé.
  - Déclenche la passe de curation théologique (`curate_context`) avec le modèle curateur si la case est cochée.
  - Formate les extraits en respectant le budget de tokens par source configuré.
  - Injecte le Passeport Herméneutique (« Mon Église ») si actif.
- **`generate_script(query_or_ref, sources_options, format_type, provider, model)`** :
  - Assemble le prompt système et le contexte sourcé issu du RAG.
  - Appelle `LLMClient` (Gemini Flash ou Mistral).
  - Parse et valide la structure JSON des répliques.
- **`synthesize_podcast(script_data, engine, options, progress_callback)`** :
  - **Provider Edge-TTS** :
    - Génération asynchrone des fichiers audio de chaque réplique via `edge-tts`.
    - Application des voix sélectionnées (`DeniseNeural` / `HenriNeural`).
  - **Provider Mistral Voxtral** :
    - Appel à l'API Mistral Audio / Voxtral pour chaque tour de parole avec prompt d'intonation adapté.
  - **Assemblage audio & pauses** :
    - Concaténation propre des segments MP3 avec insertion des temps de silence configurés.
    - Écriture du fichier MP3 final dans le dossier `%LOCALAPPDATA%/OpenShema/podcasts/` (ou dossier portable via `paths.py`).
- **Gestionnaire d'Historique (`PodcastHistory`)** :
  - Stocke les métadonnées (titre, sujet, date, durée, chemin MP3, script JSON) pour réécoute instantanée sans régénération.

#### [MODIFY] [bible_ai_app/requirements.txt](file:///c:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/requirements.txt)
- Ajout de `edge-tts>=6.1.12`.

---

### 3. API Bridge PyWebView (`api/audio_studio.py` & `webview_app.py`)

#### [NEW] [api/audio_studio.py](file:///c:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/api/audio_studio.py)
- Création de `AudioStudioMixin` exposant les méthodes suivantes au JavaScript :
  - `audio_studio_generate_script(source_ref, topic, format_type, rag_options)` :
    - `rag_options` contient : `sources` (dictionnaire booléen bibles/comms/dict/articles/notes/upvr/theology), `context_depth` (niveau de tokens), `enable_reranking`, `enable_curator`, `include_profile`.
  - `audio_studio_synthesize(script_id, script_data, engine)`
  - `audio_studio_get_history()`
  - `audio_studio_get_podcast(podcast_id)`
  - `audio_studio_delete_podcast(podcast_id)`
  - `audio_studio_export_script_to_notes(podcast_id_or_script)`
  - `audio_studio_get_available_voices()`

#### [MODIFY] [bible_ai_app/webview_app.py](file:///c:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/webview_app.py)
- Import de `AudioStudioMixin` et ajout dans la classe `BibleAppApi(..., AudioStudioMixin)`.

---

### 4. Paramètres Généraux — Onglet IA (`settings_view.js` & `index.html`)

#### [MODIFY] [web/js/settings_view.js](file:///c:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/web/js/settings_view.js)
- Enregistrement des deux prompts dans `PROMPT_CONFIGS` :
  - `audio_studio_dialogue` : *Studio Audio — Format Dialogue (Animateur & Exégète)*
  - `audio_studio_solo` : *Studio Audio — Format Chronique / Méditation Solo*
- Ajout de la section de configuration du Studio Audio dans l'onglet IA :
  - Choix du moteur par défaut (Edge-TTS / Mistral Voxtral).
  - Sélecteurs de voix (Locuteur A, Locuteur B, Chronique Solo).
  - Réglage de la pause inter-répliques (en ms).
  - Options Voxtral (modulation d'intonation, voix personnalisée).
  - Options RAG par défaut pour le Studio Audio (corpus par défaut, tokens par source, statut par défaut du LLM curateur).
- Gestion de la sauvegarde et du rechargement des valeurs.

#### [MODIFY] [web/index.html](file:///c:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/web/index.html)
- Ajout du bloc HTML sobre « Studio Audio & Podcast » dans le conteneur des paramètres IA (`#settings-tab-ai`).

---

### 5. Interface Utilisateur — Vue Dédiée « Studio Audio »

#### [NEW] [web/js/audio_studio_view.js](file:///c:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/web/js/audio_studio_view.js)
- Contrôleur complet `AudioStudioView` :
  - **Barre supérieure de session :**
    - Saisie du sujet ou sélection de passage biblique (BookPicker).
    - Commutateur de format : *Dialogue (2 voix)* vs *Chronique Solo (1 voix)*.
    - Bouton sobre **« Options de sources & RAG »** ouvrant un panneau escamotable (Flyout) :
      - Cases à cocher des corpus : *Bibles, Commentaires, Dictionnaires, Articles, Notes (.md), Textes UPVR, Théologie*.
      - Curseur de profondeur de contexte par source (*Éclair, Équilibré ~600 tokens, Approfondi ~1200 tokens, Exhaustif*).
      - Cases à cocher *Reranking BGE-M3* et *LLM Curateur intermédiaire*.
      - Case *Profil Herméneutique (« Mon Église »)*.
  - **Éditeur de Script (Transcript-First) :**
    - Affiche le dialogue carte par carte avec étiquettes locuteurs sobres.
    - Chaque réplique est éditable inline avec ajustement dynamique des pauses.
    - Bouton pour ajouter ou supprimer une réplique manuellement.
  - **Lecteur Audio & Synthèse :**
    - Déclenchement de la synthèse vocale avec progression via `TaskManager`.
    - Lecteur intégré : Play/Pause, timeline, vitesse de lecture (1x, 1.25x, 1.5x), volume.
    - **Synchronisation Karaoké** : la réplique en cours de prononciation est mise en surbrillance dans le script.
    - Boutons d'export : *Télécharger le MP3* et *Enregistrer dans les Notes (.md)*.
  - **Bibliothèque / Historique des Épisodes :**
    - Tiroir ou onglet latéral affichant les podcasts générés antérieurement, avec réécoute instantanée sans régénération.

#### [NEW] [web/css/audio_studio.css](file:///c:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/web/css/audio_studio.css)
- Styles sobres et raffinés respectant la palette et les variables de thèmes d'Open Shema (`var(--bg-card)`, `var(--border-color)`, `var(--accent-orange)`, etc.).
- Mise en page responsive à 2 colonnes (Script interactif à gauche, Lecteur & Paramètres de session à droite).
- Zéro émoji : toutes les icônes en SVG vectoriel.

#### [MODIFY] [web/index.html](file:///c:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/web/index.html)
- Ajout de la vue principale `<div id="view-audio-studio" class="app-view">...</div>`.
- Ajout du bouton dans la barre latérale gauche (avec icône SVG d'ondes audio sobres).
- Inclusion de `<link rel="stylesheet" href="css/audio_studio.css">` et `<script src="js/audio_studio_view.js"></script>`.

#### [MODIFY] [web/js/app.js](file:///c:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/web/js/app.js)
- Ajout de `{ id: 'audio-studio', visible: true }` dans `getDefaultSidebarConfig()`.
- Initialisation du module dans le pipeline d'amorçage : `{ name: 'AudioStudioView', init: () => AudioStudioView.init() }`.

---

## Plan de Vérification & Tests

### 1. Options RAG & Sources (Conformité Assistant IA)
- Ouvrir le panneau « Options de sources & RAG » dans le Studio Audio.
- Tester le décochage/cochage de sources (ex: Bibles + Commentaires uniquement).
- Tester la variation de profondeur de contexte (Éclair vs Approfondi).
- Activer l'option « LLM Curateur intermédiaire » et vérifier que le curateur traite bien les extraits en amont de la rédaction du script.

### 2. Paramètres IA
- Ouvrir *Paramètres > IA > Studio Audio & Podcast*.
- Vérifier la visualisation et la modification des deux system prompts (Dialogue & Solo), ainsi que la restauration par défaut.
- Modifier les voix et la durée des pauses, sauvegarder et vérifier la persistance dans `config.json`.

### 3. Génération & Édition de Script
- Ouvrir la vue *Studio Audio*.
- Sélectionner un passage (ex: *Romains 5:1-11*).
- Générer un script en mode *Dialogue* : valider la structure en deux locuteurs, l'ancrage strict sur les sources retenues et l'affichage sous forme de répliques modifiables.
- Tester l'édition manuelle d'une phrase.

### 4. Synthèse Vocale Edge-TTS & Voxtral
- Lancer la synthèse avec Edge-TTS : vérifier l'alternance fluide entre les voix sélectionnées avec pauses inter-répliques.
- Contrôler que le fichier MP3 est bien produit et sauvegardé dans le dossier podcasts.

### 5. Lecteur Audio & Karaoké
- Lancer la lecture : vérifier la netteté du son, le fonctionnement de la barre de progression, et la surbrillance synchronisée de la réplique correspondante.
- Tester le changement de vitesse (1.25x).
- Tester le bouton *Télécharger le MP3*.

### 6. Mode Solo (Chronique Théologique)
- Tester la génération d'une chronique à une voix et vérifier le rendu.

### 7. Contrôle Qualité & Charte
- Contrôler l'absence totale d'émojis dans tous les nouveaux fichiers.
- Vérifier la compatibilité des thèmes sombre et clair.
