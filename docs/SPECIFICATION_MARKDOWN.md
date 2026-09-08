# Spécification Technique des Fichiers Markdown Enrichis — Open Shema

Ce document définit les spécifications officielles de stockage et d'encodage des fichiers Markdown (`.md`) au sein de l'écosystème Open Shema.

L'ensemble des documents créés par l'utilisateur (notes d'étude, cartes mentales, manuscrits de prédications, réservoir d'illustrations, exports de surlignages) est stocké en clair sur le disque local dans des fichiers standards lisibles par n'importe quel éditeur de texte.

---

## 1. Principes Directeurs

1. **Souveraineté et durabilité des données** : Aucun format propriétaire, binaire opaque ou base de données verrouillée. Vos données restent lisibles et exploitables dans plusieurs décennies.
2. **Compatibilité ascendante Obsidian / CommonMark** : Tout fichier produit par Open Shema s'affiche proprement dans **Obsidian**, **Logseq**, **VS Code**, **MarkText**, **Typora** ou sur **GitHub**.
3. **Interopérabilité pour l'IA agentique locale** : La structure des fichiers permet à des agents d'IA locaux ou scripts d'automatisation de lire, indexer, générer ou modifier directement les contenus sur disque sans passer par une interface graphique.
4. **En-têtes Frontmatter YAML normalisés** : Les métadonnées administratives et sémantiques sont consignées en tête de fichier entre deux délimiteurs `---`.

---

## 2. Emplacements des Dossiers sur le Disque

Par défaut, les fichiers sont enregistrés dans le répertoire applicatif de l'installation. Chaque emplacement peut être personnalisé via l'onglet **Paramètres** :

| Type de ressource | Emplacement par défaut | Option de configuration dans `config.json` |
| :--- | :--- | :--- |
| **Notes & Cartes Mentales** | `data/notes/*.md` | `"notes_directory"` |
| **Prédications & Sermons** | `data/sermons/*.md` | `"sermons_directory"` |
| **Illustrations Homilétiques** | `data/illustrations/*.md` | `"illustrations_directory"` |
| **Surlignages Bibliques** | `data/highlights.json` | `"highlights_file"` |

---

## 3. Les Notes Textuelles Enrichies

### 3.1 Structure du Fichier

Une note textuelle est enregistrée sous le format :  
`[titre-slugifie]-[id-court].md` (exemple : `la-foi-qui-sauve-151711.md`).

```markdown
---
id: note_20260908_120000
title: "La justification par la foi"
reference: "Romains 3:21-26"
tags:
  - théologie
  - salut
  - foi
type: text
icon: ""
palette: nature
include_in_ai: true
updated_at: "08/09/2026 12:30"
---

# La justification par la foi

Contenu de la note en Markdown enrichi...
```

### 3.2 Spécification du Frontmatter YAML

* **`id`** *(chaîne, requis)* : Identifiant unique de la note (exemple : `note_20260908_120000`).
* **`title`** *(chaîne, requis)* : Titre de la note. S'il est absent, le parseur extrait le premier titre `# Titre` du corps du fichier.
* **`reference`** *(chaîne, optionnel)* : Référence scripturaire associée (exemple : `Romains 3:21-26`). Permet le rattachement automatique lors de la lecture du passage dans la Bible.
* **`tags`** *(liste de chaînes ou chaîne séparée par virgules)* : Étiquettes thématiques.
* **`type`** *(chaîne)* : Doit valoir `text` (ou être omis) pour une note textuelle standard.
* **`icon`** *(chaîne, optionnel)* : Identifiant d'icône vectorielle.
* **`palette`** *(chaîne)* : Palette de couleurs appliquée (`nature`, `ocean`, `automne`, `royal`).
* **`include_in_ai`** *(booléen)* : `true` pour que l'assistant IA intègre cette note dans ses contextes d'analyse RAG ; `false` pour l'exclure.
* **`updated_at`** *(chaîne)* : Horodatage de dernière modification (`JJ/MM/AAAA HH:MM`).

### 3.3 Syntaxe Enrichie Supportée

#### Titres Hiérarchiques
```markdown
# Titre Principal (H1)
## Section Majeure (H2)
### Sous-section Exégétique (H3)
```

#### Encarts Spéciaux (Callouts style Obsidian)
```markdown
> [!NOTE] Remarque importante
> Ce texte est encapsulé dans un encart informatif élégant.
```
Types supportés : `[!NOTE]`, `[!TIP]`, `[!WARNING]`, `[!CAUTION]`, `[!IMPORTANT]`.

#### Références Scripturaires Interactives
Tout passage biblique encadré de crochets, ou écrit sous forme canonique, est transformé en lien interactif ouvrant directement le verset dans le lecteur :
```markdown
Voir le texte de base en [Jean 3:16] ou [Romains 8:28-30].
```

#### Formatage en Ligne
* **Gras** : `**texte en gras**`
* *Italique* : `*texte en italique*`
* ~~Barré~~ : `~~texte barré~~`
* ==Surligné== : `==texte avec fond surligné==`
* Code en ligne : `` `code` ``
* Exposant : `^exposant^`
* Indice : `~indice~`

#### Listes de Tâches Interactives
```markdown
- [ ] Analyser le terme dikaiosyne dans le texte grec
- [x] Vérifier les occurrences dans la Septante
```

#### Tableaux Markdown
```markdown
| Référence | Terme Hébreu | Traduction LSG |
| :--- | :--- | :--- |
| Genèse 1:1 | Bereshit | Au commencement |
| Genèse 1:2 | Elohim | Dieu |
```

#### Blocs de Code
```markdown
```python
# Exemple de script de traitement
def get_verse():
    return "Jean 1:1"
```
```

#### Citations et Lignes de Séparation
```markdown
> « Car c'est par la grâce que vous êtes sauvés, par le moyen de la foi. » (Éphésiens 2:8)

---
```

---

## 4. Les Cartes Mentales Radiantes (Mind Maps)

Open Shema intègre un moteur de Mind Mapping organique SVG basé sur les principes de la pensée radiante (lois de Tony Buzan) combiné à l'ergonomie visuelle moderne (style XMind / Heptabase). La source de vérité d'une carte mentale est **100% stockée en Markdown standard**.

### 4.1 Différence Fondamentale : `type: mindmap`

Pour qu'un fichier Markdown soit ouvert comme une carte mentale interactive dans Open Shema, son Frontmatter doit comporter la métadonnée :
```yaml
type: mindmap
```
Vous pouvez également définir la palette chromatique active (`nature`, `ocean`, `automne`, `royal`) :
```yaml
palette: ocean
```

### 4.2 Structure Complète d'un Fichier Mind Map

```markdown
---
id: note_20260908_151711
title: "DOCTRINE DE LA FOI"
reference: "Romains 3:21-31"
tags:
  - mindmap
  - théologie
type: mindmap
icon: brain
palette: ocean
include_in_ai: true
updated_at: "08/09/2026 12:30"
---

# DOCTRINE DE LA FOI

<!-- mindmap-layout: radiant -->
<!-- mindmap-connector: curve -->
<!-- mindmap-node-shape: underline -->

- DÉFINITION [Hébreux 11:1] <!-- marker: 1 -->
  - ASSURANCE
    - DES CHOSES ESPÉRÉES
  - DÉMONSTRATION
    - DE CELLES QU'ON NE VOIT PAS
- SOURCE [Romains 10:17] <!-- marker: p1 --> <!-- note: La foi naît de ce qu'on entend, et ce qu'on entend vient de la parole du Christ -->
  - PAROLE DE DIEU <!-- marker: star -->
  - PRÉDICATION
- FRUITS [Galates 5:6] <!-- marker: done -->
  - AGISSANTE PAR L'AMOUR
  - PERSÉVÉRANCE

<!-- mindmap-pos: DÉFINITION | x: -20 | y: -10 -->
<!-- mindmap-pos: SOURCE | x: 30 | y: 15 -->

<!-- mindmap-boundary: DÉFINITION | label: FONDEMENT BIBLIQUE | color: #0284c7 -->
<!-- mindmap-rel: DÉFINITION -> FRUITS | label: ABOUTISSEMENT | color: #059669 | cx: 280 | cy: 40 -->

<!-- mindmap-floating-start: QUESTIONS EXÉGÉTIQUES | marker: p2 | x: 340 | y: 160 | color: #7c3aed -->
  - NATURE DE L'ASSURANCE
  - FOI ACTIVE OU PASSIVE
<!-- mindmap-floating-end -->

<!-- mindmap-floating: THÈME MAJEUR : LA GRÂCE DIVINE | marker: star | x: -350 | y: -140 | color: #d97706 -->
```

### 4.3 Directives de Mise en Page (Commentaires HTML)

Placées en tête du corps de texte, ces directives pilotent le moteur de rendu SVG sans altérer la compatibilité avec les lecteurs Markdown externes :

1. **Squelette de disposition** (`Alt+S`) :
   * `<!-- mindmap-layout: radiant -->` : Pensée radiante bilatérale (équilibrée gauche/droite, par défaut).
   * `<!-- mindmap-layout: right-tree -->` : Arbre logique avec racine à gauche et arborescence à droite.
   * `<!-- mindmap-layout: top-down -->` : Organigramme descendant hiérarchique (généalogies, divisions).

2. **Style des connecteurs / branches** (`Alt+T`) :
   * `<!-- mindmap-connector: curve -->` : Courbes de Bézier cubiques dégressives (par défaut).
   * `<!-- mindmap-connector: orthogonal -->` : Lignes en équerre à angle droit avec coudes arrondis.
   * `<!-- mindmap-connector: straight -->` : Lignes droites directes.

3. **Forme des nœuds** (`Alt+T`) :
   * `<!-- mindmap-node-shape: underline -->` : Texte souligné posé sur la branche (style épuré Buzan, par défaut).
   * `<!-- mindmap-node-shape: rounded-rect -->` : Rectangle aux coins arrondis.
   * `<!-- mindmap-node-shape: pill -->` : Capsule / Pilule.

### 4.4 Arborescence des Branches et Mots-Clés

* **Indentation stricte** : Chaque niveau de sous-branche est décalé de 2 espaces :
  ```markdown
  - BRANCHE PRINCIPALE (BOI)
    - SOUS-BRANCHE NIVEAU 2
      - SOUS-BRANCHE NIVEAU 3
  ```
* **Mots-clés** : Selon les règles de Buzan, les mots-clés sont écrits de préférence en lettres capitales (`MAJUSCULES`).
* **Références bibliques liées** : Positionnées entre crochets : `[Jean 3:16]`. Open Shema affiche un badge interactif ouvrant directement le passage dans la Bible.
* **Notes de branche** : Ajoutées à la fin de la ligne avec le commentaire `<!-- note: mon texte d'explication -->` (raccourci `F4` ou `Alt+N`). Au survol ou au clic sur la branche, une infobulle déplie ce texte.

### 4.5 Marqueurs, Numérotation et Priorités

Open Shema supporte la numérotation ordonnée, les priorités d'urgence et les statuts visuels sous deux syntaxes équivalentes :

1. **Directive de fin de ligne** :
   * Chiffres ordonnés (Touches `1` à `9`) : `<!-- marker: 1 -->` à `<!-- marker: 9 -->`
   * Priorités majeures : `<!-- marker: p1 -->`, `<!-- marker: p2 -->`, `<!-- marker: p3 -->`, `<!-- marker: p4 -->`
   * Statuts & symboles : `<!-- marker: done -->` (✓), `<!-- marker: progress -->` (◐), `<!-- marker: star -->` (★), `<!-- marker: alert -->` (!)
2. **Préfixe compatible Obsidian en début de libellé** :
   * `- [1] MON MOT-CLÉ` ou `- (1) MON MOT-CLÉ`
   * `- [P1] MON MOT-CLÉ` ou `- [P2] MON MOT-CLÉ`
3. **Raccourcis Clavier** : Touches `1` à `9` pour affecter immédiatement un marqueur au nœud sélectionné, touche `0` pour effacer le marqueur, ou touche `M` pour ouvrir la palette des marqueurs.

### 4.6 Clôtures & Enclos Sémantiques (Boundaries style XMind)

Un enclos regroupe graphiquement une sous-branche et l'ensemble de ses sous-niveaux dans un périmètre pointillé teinté, surmonté d'une étiquette d'intitulé :
```markdown
<!-- mindmap-boundary: MOT-CLÉ_RACINE | label: TITRE DE L'ENCLOS | color: #0284c7 -->
```
* **Raccourci de création** : `Ctrl+B` sur la branche sélectionnée (ou via le menu contextuel clic droit).
* **Édition** : Clic sur le badge de l'enclos pour renommer ou modifier la couleur. Touche `Suppr` pour supprimer l'enclos.

### 4.7 Sujets Flottants Autonomes (Floating Topics)

Les sujets flottants sont des idées indépendantes de l'arborescence centrale, positionnées librement sur le canevas SVG :

1. **Sujet flottant simple (une seule ligne)** :
   ```markdown
   <!-- mindmap-floating: TITRE DU SUJET | marker: star | x: 250 | y: 120 | color: #d97706 -->
   ```
2. **Sujet flottant arborescent (avec sous-branches hiérarchiques)** :
   ```markdown
   <!-- mindmap-floating-start: CONTEXTE HISTORIQUE | marker: p1 | x: 320 | y: 180 | color: #7c3aed -->
     - AUTEUR ET DESTINATAIRES
     - DATE DE RÉDACTION [Actes 18:2]
   <!-- mindmap-floating-end -->
   ```
* **Création** : `Alt+F` ou **Double-clic** sur le fond du canevas.

### 4.8 Liaisons Transversales (Relations style XMind)

Pour relier deux branches non directement parentes, Open Shema trace une flèche orientée personnalisable :
```markdown
<!-- mindmap-rel: BRANCHE_SOURCE -> BRANCHE_CIBLE | label: VOIR AUSSI | color: #059669 | cx: 320 | cy: -95 -->
```
* `label:` Intitulé affiché au milieu de la flèche.
* `color:` Couleur hexadécimale de la liaison.
* `cx:` / `cy:` Décalage de la poignée de contrôle de Bézier (ajustable à la souris pour courber la flèche).
* **Création** : `Ctrl+L` ou bouton "Relier" du dock flottant.

### 4.9 Déplacement Spatial Libre (Free Positioning)

Lorsque l'utilisateur réorganise visuellement une branche à la souris, Open Shema enregistre le décalage spatial à la fin du fichier sans rompre l'arbre logique :
```markdown
<!-- mindmap-pos: MOT-CLÉ | x: 45 | y: -20 -->
```
* **Raccourci de réalignement automatique** : `Alt+R` rééquilibre harmonieusement l'ensemble de la carte.

### 4.10 Mode Plan Outliner Synchrone (`Alt+P`)

Open Shema permet de basculer instantanément entre :
1. **La Vue Carte Graphique SVG** (vision spatiale, rayonnante, dynamique).
2. **La Vue Plan Outliner** (mode liste textuel structuré, pliable/dépliable, avec marqueurs et notes synchronisés en temps réel).
* **Raccourci de bascule** : `Alt+P` ou le bouton d'en-tête "Vue Plan".

### 4.11 Tableau des Raccourcis Clavier

| Raccourci | Action |
| :--- | :--- |
| <kbd>Tab</kbd> | Ajouter une sous-branche (enfant) |
| <kbd>Entrée</kbd> | Ajouter une branche voisine (frère / sœur) |
| <kbd>Espace</kbd> ou Double-clic | Modifier le texte du mot-clé en ligne |
| <kbd>Suppr</kbd> / <kbd>Retour</kbd> | Supprimer le nœud, l'enclos ou la liaison sélectionné(e) |
| <kbd>Alt+P</kbd> | Basculer entre Vue Carte et Vue Plan Outliner |
| <kbd>Ctrl+L</kbd> | Créer une liaison transversale entre branches |
| <kbd>Ctrl+B</kbd> | Créer ou éditer un enclos sémantique (Boundary) |
| <kbd>Alt+F</kbd> ou Double-clic fond | Créer un sujet flottant indépendant |
| <kbd>1</kbd> à <kbd>9</kbd> | Affecter un numéro / marqueur de priorité |
| <kbd>0</kbd> | Effacer le marqueur de la branche |
| <kbd>M</kbd> | Ouvrir le panneau des marqueurs et priorités |
| <kbd>F4</kbd> ou <kbd>Alt+N</kbd> | Ajouter ou modifier la note de branche |
| <kbd>Alt+S</kbd> | Changer le squelette (Radiant, Arbre droit, Organigramme) |
| <kbd>Alt+T</kbd> | Ouvrir les styles de connecteurs et formes de nœuds |
| <kbd>Alt+R</kbd> | Réorganiser automatiquement la carte |
| <kbd>Ctrl+C</kbd> / <kbd>Ctrl+V</kbd> | Copier / Coller une branche et son sous-arbre |
| <kbd>Ctrl+Z</kbd> / <kbd>Ctrl+Y</kbd> | Annuler / Rétablir (50 niveaux d'historique) |
| <kbd>R</kbd> | Recentrer et ajuster la carte à l'écran |
| <kbd>?</kbd> | Afficher le tiroir d'aide complet |

---

## 5. Les Surlignages Bibliques

### 5.1 Fichier Central JSON

Les surlignages effectués dans le lecteur biblique sont stockés dans `data/highlights.json` :

```json
[
  {
    "id": "hl_20260908120000_a1b2c3d4",
    "book": "jean",
    "chapter": 3,
    "verse_start": 16,
    "verse_end": 16,
    "version": "lsg",
    "color": "yellow",
    "selected_text": "Car Dieu a tant aimé le monde qu'il a donné son Fils unique...",
    "note_id": "note_20260908_120000",
    "created_at": "2026-09-08T10:00:00.000000",
    "updated_at": "2026-09-08T10:00:00.000000"
  }
]
```

* **`color`** : Codes de couleurs gérés : `yellow`, `green`, `blue`, `amber`, `purple`, `rose`.
* **`note_id`** : Identifiant optionnel d'une note Markdown liée à ce surlignage précis.

### 5.2 Export Structuré en Fichier Markdown (`.md`)

Accessible depuis les Paramètres (*Exporter en Markdown*), il génère une vue d'étude prête pour l'impression ou l'archivage dans Obsidian :

```markdown
# Mes Surlignages Bibliques
*Exporté le 08/09/2026 à 12:30 — 2 surlignage(s)*

---

## Jean 3

- **Jean 3:16** *(LSG • Jaune Solaire)*
  > « Car Dieu a tant aimé le monde qu'il a donné son Fils unique... »

- **Jean 3:36** *(LSG • Vert Sauge)*
  > « Celui qui croit au Fils a la vie éternelle... »
```

---

## 6. Les Manuscrits de Prédications & Sermons

Les prédications sont enregistrées dans le répertoire `data/sermons/*.md`.

### 6.1 Structure du Fichier

```markdown
---
id: sermon-1725790000
title: "La grâce transformatrice"
type: sermon
status: draft
church: "Église Protestante Évangélique"
event_occasion: "Culte dominical"
date_planned: "2026-03-22"
series:
  title: "Vivre selon l'Esprit"
passage:
  reference: "Éphésiens 2:1-10"
big_idea: "Par grâce nous sommes sauvés, par le moyen de la foi"
pmt: "La grâce divine est la cause unique et suffisante du salut"
pms: "La vie chrétienne authentique est le fruit reconnaissant de cette grâce"
contemporary_tension: "La tendance humaine à vouloir mériter ou négocier l'approbation de Dieu"
redemptive_era: "christ"
goal: "Conduire l'auditeur à renoncer à ses mérites pour s'abandonner pleinement au Christ"
theme_tags:
  - grâce
  - salut
  - foi
timing:
  target_duration_min: 35
  words_per_minute: 135
created_at: "2026-03-22T09:00:00"
---

# Introduction

> [!cue] Projeter diapositive 1 (Titre)

Accroche et contexte contemporain...

# 1. Le constat universel : Notre incapacité radicale

> [!cue] Projeter texte Éphésiens 2:1-3

Développement théologique...

# Conclusion

Appel et application personnelle...
```

### 6.2 Repères Scéniques et Vidéoprojection (Cues)

Les indications destinées à l'équipe technique de culte ou à l'orateur sont encodées de deux manières :
* Format verbeux standard : `> [!cue] Projeter verset 4`
* Format raccourci supporté à l'import : `[_]` (automatiquement converti lors de l'édition).

---

## 7. Le Réservoir d'Illustrations Homilétiques

Les fiches d'illustrations réutilisables sont stockées dans `data/illustrations/*.md`.

```markdown
---
id: ill_20260908_142010
title: "Le phare dans la tempête"
category: "Foi / Épreuve"
tags:
  - confiance
  - persévérance
  - secours
source: "Récit maritime historique"
created_at: "08/09/2026 14:20"
---

Dans la tourmente hivernale de 1872, un phare de la côte bretonne...
```

---

## 8. Guide d'Utilisation avec Obsidian, Logseq et VS Code

Pour utiliser simultanément Open Shema et votre éditeur Markdown externe préféré :

1. **Pointez le dossier de notes d'Open Shema sur votre coffre (Vault) Obsidian** :
   * Dans Open Shema, ouvrez **Paramètres** > **Notes & Surlignages**.
   * Cliquez sur **Parcourir...** et sélectionnez votre dossier de coffre Obsidian.
2. **Création depuis Obsidian** :
   * Pour une note textuelle : Créez un fichier `.md` standard avec le Frontmatter YAML décrit en section 3.
   * Pour une carte mentale : Ajoutez simplement `type: mindmap` dans le Frontmatter et organisez votre texte sous forme de liste à puces. Dès que vous ouvrirez Open Shema, la carte apparaîtra en vue graphique interactive.
3. **Synchronisation automatique** :
   * Open Shema relit les fichiers à chaque chargement et n'écrase jamais les métadonnées ou sections personnalisées ajoutées en externe.
