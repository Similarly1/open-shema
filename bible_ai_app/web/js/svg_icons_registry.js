/**
 * SvgIconsRegistry - Système universel d'icônes vectorielles SVG (Notes & Mind Map)
 * 100% SVG purs, nobles, sans aucun émoji.
 * Compatible mode sombre et clair via currentColor.
 * Utilisable indifféremment au clavier et à la souris.
 * Répertoire étendu : 121 symboles vectoriels théologiques, bibliques et d'exégèse.
 */

const SvgIconsRegistry = {
  icons: [
      {
          "id": "croix",
          "label": "Croix",
          "category": "Théologie & Rédemption",
          "keywords": [
              "croix",
              "cross",
              "christ",
              "jesus",
              "salut",
              "foi",
              "redemption",
              "evangile",
              "sacrifice",
              "grace",
              "golgotha"
          ],
          "path": "<path d=\"M12 2v20M7 8h10\"/>"
      },
      {
          "id": "bible",
          "label": "Bible / Écritures",
          "category": "Théologie & Rédemption",
          "keywords": [
              "bible",
              "livre",
              "parole",
              "ecritures",
              "testament",
              "verset",
              "loi",
              "texte",
              "book",
              "canon"
          ],
          "path": "<path d=\"M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z\"/><path d=\"M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z\"/>"
      },
      {
          "id": "colombe",
          "label": "Esprit Saint / Colombe",
          "category": "Théologie & Rédemption",
          "keywords": [
              "colombe",
              "esprit",
              "saint-esprit",
              "paix",
              "bapteme",
              "consolateur",
              "dove",
              "spirit"
          ],
          "path": "<path d=\"M16 7h.01\"/><path d=\"M3.4 18c3.6 0 6.6-2 8.6-5.5.8-1.5 2.2-2.5 3.8-2.5H20a2 2 0 0 0 2-2c0-2.2-1.8-4-4-4-2.5 0-4.8 1.5-5.8 3.8L11 10C8.5 10 6 12 4.5 14L3.4 18z\"/><path d=\"m14 13 4 5-7 1\"/>"
      },
      {
          "id": "flamme",
          "label": "Flamme / Pentecôte",
          "category": "Théologie & Rédemption",
          "keywords": [
              "flamme",
              "feu",
              "pentecote",
              "saintete",
              "zele",
              "onction",
              "reveil",
              "purification",
              "fire"
          ],
          "path": "<path d=\"M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z\"/>"
      },
      {
          "id": "couronne",
          "label": "Couronne / Royauté",
          "category": "Théologie & Rédemption",
          "keywords": [
              "couronne",
              "roi",
              "royaume",
              "seigneur",
              "souverainete",
              "gloire",
              "victoire",
              "crown",
              "king"
          ],
          "path": "<path d=\"m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14\"/>"
      },
      {
          "id": "ichtus",
          "label": "Poisson / Ichthus",
          "category": "Théologie & Rédemption",
          "keywords": [
              "ichtus",
              "ichthus",
              "poisson",
              "chretiens",
              "pecheur",
              "homme",
              "temoignage",
              "fish"
          ],
          "path": "<path d=\"M2 12c4.5-6 13.5-6 18 0-4.5 6-13.5 6-18 0z\"/><path d=\"m16.5 6.5 5.5 11M16.5 17.5 22 6.5\"/><circle cx=\"6.5\" cy=\"11.5\" r=\".75\" fill=\"currentColor\"/>"
      },
      {
          "id": "calice",
          "label": "Calice / Cène",
          "category": "Théologie & Rédemption",
          "keywords": [
              "calice",
              "coupe",
              "cene",
              "communion",
              "alliance",
              "sang",
              "vin",
              "cup"
          ],
          "path": "<path d=\"M7 3h10v5a5 5 0 0 1-10 0V3z\"/><line x1=\"12\" y1=\"13\" x2=\"12\" y2=\"19\"/><line x1=\"8\" y1=\"21\" x2=\"16\" y2=\"21\"/>"
      },
      {
          "id": "pain",
          "label": "Pain de Vie / Communion",
          "category": "Théologie & Rédemption",
          "keywords": [
              "pain",
              "communion",
              "corps",
              "manne",
              "nourriture",
              "partage",
              "bread"
          ],
          "path": "<path d=\"M3 13c0-3.3 2.7-6 6-6 1.4 0 2.7.5 3.7 1.3C13.7 7.5 15 7 16.5 7 19.5 7 22 9.5 22 12.5c0 .2 0 .3 0 .5H3z\"/><path d=\"M3 13v2a4 4 0 0 0 4 4h10a4 4 0 0 0 4-4v-2\"/>"
      },
      {
          "id": "temple",
          "label": "Temple / Sanctuaire",
          "category": "Théologie & Rédemption",
          "keywords": [
              "temple",
              "eglise",
              "maison",
              "edifice",
              "assemblee",
              "corps",
              "sanctuaire",
              "church"
          ],
          "path": "<path d=\"M3 21h18M4 18h16M6 18v-7M10 18v-7M14 18v-7M18 18v-7M12 2l10 7H2l10-7z\"/>"
      },
      {
          "id": "menorah",
          "label": "Chandelier / Menorah",
          "category": "Théologie & Rédemption",
          "keywords": [
              "menorah",
              "chandelier",
              "lampe",
              "sanctuaire",
              "temple",
              "lumiere",
              "sept",
              "or"
          ],
          "path": "<path d=\"M12 3v18M12 21H7m10 0h-5M6 8a6 6 0 0 0 12 0M2 6a10 10 0 0 0 20 0\"/>"
      },
      {
          "id": "alliance",
          "label": "Alliance / Anneaux",
          "category": "Théologie & Rédemption",
          "keywords": [
              "alliance",
              "pacte",
              "fiancailles",
              "mariage",
              "union",
              "anneau",
              "bague",
              "covenant",
              "noces"
          ],
          "path": "<circle cx=\"9\" cy=\"12\" r=\"5\"/><circle cx=\"15\" cy=\"12\" r=\"5\"/>"
      },
      {
          "id": "trinite",
          "label": "Trinité / Triquetra",
          "category": "Théologie & Rédemption",
          "keywords": [
              "trinite",
              "pere",
              "fils",
              "esprit",
              "dieu",
              "triquetra",
              "unite",
              "divinite"
          ],
          "path": "<circle cx=\"12\" cy=\"8.5\" r=\"5\"/><circle cx=\"8\" cy=\"15\" r=\"5\"/><circle cx=\"16\" cy=\"15\" r=\"5\"/>"
      },
      {
          "id": "tombeau",
          "label": "Tombeau Ouvert / Résurrection",
          "category": "Théologie & Rédemption",
          "keywords": [
              "tombeau",
              "resurrection",
              "mort",
              "vie",
              "pierre",
              "paques",
              "ressuscite",
              "victoire"
          ],
          "path": "<path d=\"M3 20h18M4 20V10a8 8 0 0 1 16 0v10\"/><circle cx=\"12\" cy=\"14\" r=\"5\"/><path d=\"m14 14 6 6\"/>"
      },
      {
          "id": "agneau",
          "label": "Agneau de Dieu",
          "category": "Théologie & Rédemption",
          "keywords": [
              "agneau",
              "sacrifice",
              "paque",
              "expiation",
              "innocence",
              "sang",
              "immolation",
              "lamb"
          ],
          "path": "<circle cx=\"9\" cy=\"8\" r=\"2.5\"/><path d=\"M11.5 9c2 0 4 1 5 3l3-1v3c0 3-2 5-5 5h-6l-2 3H5l2-4c-1-1-1.5-2.5-1.5-4 0-3 2.5-5 6-5z\"/><path d=\"m16 4 3 6M17.5 7h3\"/>"
      },
      {
          "id": "lion-juda",
          "label": "Lion de Juda",
          "category": "Théologie & Rédemption",
          "keywords": [
              "lion",
              "juda",
              "force",
              "puissance",
              "regne",
              "messie",
              "tribu",
              "vainqueur"
          ],
          "path": "<circle cx=\"12\" cy=\"12\" r=\"6\"/><path d=\"M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83\"/><circle cx=\"10\" cy=\"11\" r=\".75\" fill=\"currentColor\"/><circle cx=\"14\" cy=\"11\" r=\".75\" fill=\"currentColor\"/><path d=\"m11 14 1 1 1-1\"/>"
      },
      {
          "id": "alpha-omega",
          "label": "Alpha & Oméga",
          "category": "Théologie & Rédemption",
          "keywords": [
              "alpha",
              "omega",
              "commencement",
              "fin",
              "premier",
              "dernier",
              "eternite",
              "apocalypse"
          ],
          "path": "<path d=\"m4 19 4-14 4 14M5.5 14h5M14 19h2a3 3 0 0 0 3-3c0-2-1.5-3-3-3s-3 1-3 3a3 3 0 0 0 3 3h2\"/>"
      },
      {
          "id": "arche-alliance",
          "label": "Arche de l'Alliance",
          "category": "Théologie & Rédemption",
          "keywords": [
              "arche",
              "alliance",
              "propitiatoire",
              "cherubins",
              "presence",
              "shekina",
              "gloire",
              "ark"
          ],
          "path": "<rect x=\"4\" y=\"10\" width=\"16\" height=\"10\" rx=\"1\"/><line x1=\"2\" y1=\"15\" x2=\"22\" y2=\"15\"/><path d=\"M6 10c0-3 2-6 6-6s6 3 6 6\"/><circle cx=\"9\" cy=\"4\" r=\"1.5\"/><circle cx=\"15\" cy=\"4\" r=\"1.5\"/>"
      },
      {
          "id": "grace",
          "label": "Grâce / Rayonnement",
          "category": "Théologie & Rédemption",
          "keywords": [
              "grace",
              "don",
              "faveur",
              "merite",
              "salut",
              "gratuit",
              "benediction",
              "rayon"
          ],
          "path": "<path d=\"M12 2v6M12 22v-6M2 12h6M22 12h-6\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/><path d=\"m4.93 4.93 4.24 4.24M19.07 19.07l-4.24-4.24M19.07 4.93l-4.24 4.24M4.93 19.07l4.24-4.24\"/>"
      },
      {
          "id": "buisson-ardent",
          "label": "Buisson Ardent",
          "category": "Histoire Sainte & Symboles",
          "keywords": [
              "buisson",
              "ardent",
              "feu",
              "moise",
              "vocation",
              "theophanie",
              "sinai",
              "saintete"
          ],
          "path": "<path d=\"M12 22v-8M9 22l2-5M15 22l-2-5\"/><path d=\"M6 15c-1.5-2 0-5 2-6 0-3 3-5 5-5 2 0 4 1.5 4 4 2 1 3 3 2 5-1 2-3 3-5 3-3 0-6-1-8-1z\"/>"
      },
      {
          "id": "tables-loi",
          "label": "Tables de la Loi / Décalogue",
          "category": "Histoire Sainte & Symboles",
          "keywords": [
              "tables",
              "loi",
              "commandements",
              "decalogue",
              "moise",
              "pierre",
              "sinai",
              "loi"
          ],
          "path": "<path d=\"M4 20h16M5 20V7a3 3 0 0 1 6 0v13M13 20V7a3 3 0 0 1 6 0v13M7 11h2M7 14h2M15 11h2M15 14h2\"/>"
      },
      {
          "id": "arche-noe",
          "label": "Arche de Noé",
          "category": "Histoire Sainte & Symboles",
          "keywords": [
              "arche",
              "noe",
              "deluge",
              "sauvetage",
              "animaux",
              "bateau",
              "preservation",
              "ark"
          ],
          "path": "<path d=\"M3 15c3 0 5 2 9 2s6-2 9-2v2c-3 0-5 2-9 2s-6-2-9-2v-2z\"/><path d=\"M4 15l2-6h12l2 6\"/><rect x=\"8\" y=\"5\" width=\"8\" height=\"4\"/><path d=\"M12 2v3\"/>"
      },
      {
          "id": "arc-en-ciel",
          "label": "Arc-en-ciel d'Alliance",
          "category": "Histoire Sainte & Symboles",
          "keywords": [
              "arc-en-ciel",
              "promesse",
              "noe",
              "alliance",
              "fidelite",
              "ciel",
              "rainbow"
          ],
          "path": "<path d=\"M22 17a10 10 0 0 0-20 0M19 17a7 7 0 0 0-14 0M16 17a4 4 0 0 0-8 0\"/>"
      },
      {
          "id": "serpent-airain",
          "label": "Serpent d'Airain",
          "category": "Histoire Sainte & Symboles",
          "keywords": [
              "serpent",
              "airain",
              "moise",
              "guerison",
              "desert",
              "regard",
              "salut",
              "typologie"
          ],
          "path": "<line x1=\"12\" y1=\"2\" x2=\"12\" y2=\"22\"/><line x1=\"8\" y1=\"5\" x2=\"16\" y2=\"5\"/><path d=\"M9 18c2 1 4-1 4-3s-2-3-2-5 2-3 3-2 1 2 0 3\"/>"
      },
      {
          "id": "corne-onction",
          "label": "Corne d'Onction",
          "category": "Histoire Sainte & Symboles",
          "keywords": [
              "corne",
              "onction",
              "huile",
              "david",
              "samuel",
              "sacre",
              "roi",
              "consecration"
          ],
          "path": "<path d=\"M6 5c3 0 12 1 12 11 0 4-3 6-6 6-5 0-6-4-6-6 0-4 1-9 0-11z\"/><path d=\"M6 5h4\"/>"
      },
      {
          "id": "shofar",
          "label": "Shofar / Corne",
          "category": "Histoire Sainte & Symboles",
          "keywords": [
              "shofar",
              "corne",
              "sonnerie",
              "jericho",
              "jubile",
              "reveil",
              "appel",
              "guerre"
          ],
          "path": "<path d=\"M5 19c2 0 14-2 14-10 0-3-2-5-5-5-2 0-3 1-3 3 0 3 2 4 1 7-1 2-4 3-7 5z\"/><circle cx=\"5\" cy=\"19\" r=\"1.5\"/>"
      },
      {
          "id": "couronne-epines",
          "label": "Couronne d'Épines",
          "category": "Histoire Sainte & Symboles",
          "keywords": [
              "epines",
              "passion",
              "christ",
              "souffrance",
              "roi",
              "derision",
              "calvaire",
              "croix"
          ],
          "path": "<circle cx=\"12\" cy=\"12\" r=\"8\"/><path d=\"m8 6 2 3M16 6l-2 3M6 14l3-1M18 14l-3-1M10 19l1-3M14 19l-1-3\"/>"
      },
      {
          "id": "trois-croix",
          "label": "Golgotha / Calvaire",
          "category": "Histoire Sainte & Symboles",
          "keywords": [
              "golgotha",
              "calvaire",
              "croix",
              "crucifixion",
              "larron",
              "salut",
              "passion"
          ],
          "path": "<path d=\"M12 3v18M8 8h8M4 10v9M2 13h4M20 10v9M18 13h4\"/>"
      },
      {
          "id": "voile-dechire",
          "label": "Voile Déchiré",
          "category": "Histoire Sainte & Symboles",
          "keywords": [
              "voile",
              "temple",
              "dechire",
              "acces",
              "pere",
              "saint des saints",
              "liberte"
          ],
          "path": "<rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"2\"/><path d=\"m12 3-2 4 4 4-3 4 3 6\"/>"
      },
      {
          "id": "puits",
          "label": "Puits de Jacob / Eau",
          "category": "Histoire Sainte & Symboles",
          "keywords": [
              "puits",
              "jacob",
              "samaritaine",
              "eau",
              "rencontre",
              "soif",
              "source"
          ],
          "path": "<ellipse cx=\"12\" cy=\"17\" rx=\"8\" ry=\"4\"/><path d=\"M4 17v-4a8 4 0 0 1 16 0v4M6 15V6l6-3 6 3v9M12 3v7\"/><circle cx=\"12\" cy=\"12\" r=\"2\"/>"
      },
      {
          "id": "filet",
          "label": "Filet de Pêche",
          "category": "Histoire Sainte & Symboles",
          "keywords": [
              "filet",
              "peche",
              "pecheurs",
              "hommes",
              "evangelisation",
              "barque",
              "disciples"
          ],
          "path": "<path d=\"M3 6h18M3 12h18M3 18h18M6 3v18M12 3v18M18 3v18\"/>"
      },
      {
          "id": "chariot-feu",
          "label": "Chariot de Feu / Élie",
          "category": "Histoire Sainte & Symboles",
          "keywords": [
              "chariot",
              "feu",
              "elie",
              "enlevement",
              "prophete",
              "puissance",
              "tourbillon"
          ],
          "path": "<circle cx=\"7\" cy=\"17\" r=\"3\"/><circle cx=\"17\" cy=\"17\" r=\"3\"/><path d=\"M4 17h16M6 14l3-7h6l3 7\"/><path d=\"m10 4 2-2 2 2-2 2z\"/>"
      },
      {
          "id": "fronde-david",
          "label": "Fronde & Pierres / David",
          "category": "Histoire Sainte & Symboles",
          "keywords": [
              "fronde",
              "david",
              "goliath",
              "pierres",
              "victoire",
              "combat",
              "foi",
              "geant"
          ],
          "path": "<path d=\"M5 5c0 4 2 8 7 8s7-4 7-8\"/><circle cx=\"12\" cy=\"17\" r=\"2\"/><circle cx=\"8\" cy=\"20\" r=\"1.5\"/><circle cx=\"16\" cy=\"20\" r=\"1.5\"/>"
      },
      {
          "id": "manteau-prophete",
          "label": "Manteau de Prophète",
          "category": "Histoire Sainte & Symboles",
          "keywords": [
              "manteau",
              "prophete",
              "elisee",
              "elie",
              "transmission",
              "onction",
              "double portion"
          ],
          "path": "<path d=\"M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14l-4-2-4 2-4-2-4 2V5z\"/><path d=\"m9 3 3 5 3-5\"/>"
      },
      {
          "id": "colonne-nuee",
          "label": "Nuée & Gloire",
          "category": "Histoire Sainte & Symboles",
          "keywords": [
              "nuee",
              "colonne",
              "feu",
              "guide",
              "desert",
              "presence",
              "shekina",
              "exode"
          ],
          "path": "<path d=\"M7 21h10M8 17h8M9 13h6\"/><path d=\"M6 9c-1-2 0-5 2-6 2-1 5-1 6 1 2 0 4 2 4 4 0 2-2 3-4 3H8c-1 0-2-1-2-2z\"/>"
      },
      {
          "id": "manne",
          "label": "Manne céleste / Vase",
          "category": "Histoire Sainte & Symboles",
          "keywords": [
              "manne",
              "desert",
              "nourriture",
              "ciel",
              "providence",
              "pain",
              "vase",
              "miracle"
          ],
          "path": "<path d=\"M7 9h10a4 4 0 0 1 4 4v5a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-5a4 4 0 0 1 4-4z\"/><circle cx=\"12\" cy=\"5\" r=\"2\"/><line x1=\"12\" y1=\"7\" x2=\"12\" y2=\"9\"/><circle cx=\"9\" cy=\"15\" r=\"1\"/><circle cx=\"15\" cy=\"15\" r=\"1\"/><circle cx=\"12\" cy=\"17\" r=\"1\"/>"
      },
      {
          "id": "tente",
          "label": "Tabernacle / Tente",
          "category": "Histoire Sainte & Symboles",
          "keywords": [
              "tente",
              "tabernacle",
              "desert",
              "demeure",
              "sanctuaire",
              "pelerin",
              "nomade"
          ],
          "path": "<path d=\"m12 3 9 17H3L12 3zM12 3v17M8 20l4-7 4 7\"/>"
      },
      {
          "id": "cite",
          "label": "Cité / Ville / Jérusalem",
          "category": "Histoire Sainte & Symboles",
          "keywords": [
              "cite",
              "ville",
              "jerusalem",
              "sion",
              "babylone",
              "cite celeste",
              "murailles",
              "remparts",
              "porte",
              "city",
              "town"
          ],
          "path": "<path d=\"M2 21h20M3 21V9l3-2 3 2v12M9 11h6V7l3-2 3 2v14M9 21v-5a3 3 0 0 1 6 0v5M6 13h.01M18 13h.01\"/>"
      },
      {
          "id": "cle",
          "label": "Clé d'interprétation",
          "category": "Étude & Exégèse",
          "keywords": [
              "cle",
              "key",
              "exegese",
              "hermeneutique",
              "comprehension",
              "mystere",
              "ouverture"
          ],
          "path": "<circle cx=\"7.5\" cy=\"15.5\" r=\"4.5\"/><path d=\"m21 3-9.5 9.5M15.5 8.5l3 3M18.5 5.5l3 3\"/>"
      },
      {
          "id": "loupe",
          "label": "Loupe / Analyse",
          "category": "Étude & Exégèse",
          "keywords": [
              "loupe",
              "recherche",
              "analyse",
              "etude",
              "scruter",
              "mot",
              "search",
              "find"
          ],
          "path": "<circle cx=\"11\" cy=\"11\" r=\"7\"/><line x1=\"21\" y1=\"21\" x2=\"16.65\" y2=\"16.65\"/>"
      },
      {
          "id": "ampoule",
          "label": "Idée / Révélation",
          "category": "Étude & Exégèse",
          "keywords": [
              "ampoule",
              "idee",
              "revelation",
              "inspiration",
              "intuition",
              "lumiere",
              "insight",
              "idea"
          ],
          "path": "<path d=\"M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5\"/><line x1=\"9\" y1=\"18\" x2=\"15\" y2=\"18\"/><line x1=\"10\" y1=\"22\" x2=\"14\" y2=\"22\"/>"
      },
      {
          "id": "parchemin",
          "label": "Parchemin / Rouleau",
          "category": "Étude & Exégèse",
          "keywords": [
              "parchemin",
              "rouleau",
              "manuscrit",
              "prophetie",
              "texte",
              "canon",
              "scroll"
          ],
          "path": "<path d=\"M8 21h12a2 2 0 0 0 2-2v-2H10v2a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v3h4\"/><path d=\"M19 17V5a2 2 0 0 0-2-2H4\"/>"
      },
      {
          "id": "plume",
          "label": "Plume / Rédaction",
          "category": "Étude & Exégèse",
          "keywords": [
              "plume",
              "ecriture",
              "auteur",
              "epitre",
              "redaction",
              "notes",
              "pen",
              "write"
          ],
          "path": "<path d=\"M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z\"/><line x1=\"16\" y1=\"8\" x2=\"2\" y2=\"22\"/><line x1=\"17.5\" y1=\"15\" x2=\"9\" y2=\"15\"/>"
      },
      {
          "id": "balance",
          "label": "Balance / Justice",
          "category": "Étude & Exégèse",
          "keywords": [
              "balance",
              "justice",
              "jugement",
              "equite",
              "droit",
              "peser",
              "verite",
              "scale"
          ],
          "path": "<path d=\"m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z\"/><path d=\"M2 16l3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z\"/><line x1=\"7\" y1=\"21\" x2=\"17\" y2=\"21\"/><line x1=\"12\" y1=\"3\" x2=\"12\" y2=\"21\"/><line x1=\"3\" y1=\"7\" x2=\"21\" y2=\"7\"/>"
      },
      {
          "id": "boussole",
          "label": "Boussole / Orientation",
          "category": "Étude & Exégèse",
          "keywords": [
              "boussole",
              "orientation",
              "sens",
              "discernement",
              "guide",
              "compass",
              "direction"
          ],
          "path": "<circle cx=\"12\" cy=\"12\" r=\"10\"/><polygon points=\"16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76\"/>"
      },
      {
          "id": "livre-ouvert",
          "label": "Livre Ouvert / Commentaire",
          "category": "Étude & Exégèse",
          "keywords": [
              "livre",
              "ouvert",
              "commentaire",
              "lecture",
              "etude",
              "page",
              "theologie"
          ],
          "path": "<path d=\"M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z\"/><path d=\"M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z\"/><line x1=\"6\" y1=\"8\" x2=\"9\" y2=\"8\"/><line x1=\"6\" y1=\"12\" x2=\"9\" y2=\"12\"/><line x1=\"15\" y1=\"8\" x2=\"18\" y2=\"8\"/><line x1=\"15\" y1=\"12\" x2=\"18\" y2=\"12\"/>"
      },
      {
          "id": "marque-page",
          "label": "Marque-Page / Référence",
          "category": "Étude & Exégèse",
          "keywords": [
              "marque-page",
              "signet",
              "repere",
              "memorisation",
              "verset",
              "favori",
              "bookmark"
          ],
          "path": "<path d=\"M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z\"/>"
      },
      {
          "id": "codex",
          "label": "Codex / Histoire",
          "category": "Étude & Exégèse",
          "keywords": [
              "codex",
              "histoire",
              "eglise",
              "patristique",
              "relie",
              "ancien",
              "manuscrit"
          ],
          "path": "<rect x=\"4\" y=\"3\" width=\"16\" height=\"18\" rx=\"2\"/><path d=\"M8 3v18\"/><line x1=\"11\" y1=\"7\" x2=\"16\" y2=\"7\"/><line x1=\"11\" y1=\"11\" x2=\"16\" y2=\"11\"/><line x1=\"11\" y1=\"15\" x2=\"14\" y2=\"15\"/>"
      },
      {
          "id": "langues",
          "label": "Hébreu & Grec / Langues",
          "category": "Étude & Exégèse",
          "keywords": [
              "hebreu",
              "grec",
              "langues",
              "original",
              "lexique",
              "grammaire",
              "arameen"
          ],
          "path": "<circle cx=\"12\" cy=\"12\" r=\"10\"/><line x1=\"2\" y1=\"12\" x2=\"22\" y2=\"12\"/><path d=\"M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z\"/>"
      },
      {
          "id": "lunettes",
          "label": "Lunettes / Regard critique",
          "category": "Étude & Exégèse",
          "keywords": [
              "lunettes",
              "observation",
              "perspective",
              "focus",
              "scruter",
              "regard",
              "analyse"
          ],
          "path": "<circle cx=\"6\" cy=\"14\" r=\"4\"/><circle cx=\"18\" cy=\"14\" r=\"4\"/><path d=\"M10 14h4M2 13l3-6M22 13l-3-6\"/>"
      },
      {
          "id": "sceau",
          "label": "Sceau / Autorité",
          "category": "Étude & Exégèse",
          "keywords": [
              "sceau",
              "cachet",
              "autorite",
              "authenticite",
              "canon",
              "ferme",
              "certifie"
          ],
          "path": "<circle cx=\"12\" cy=\"15\" r=\"6\"/><path d=\"m8.5 9.5 2-6.5h3l2 6.5M10 15h4\"/>"
      },
      {
          "id": "dossier",
          "label": "Dossier / Thématique",
          "category": "Étude & Exégèse",
          "keywords": [
              "dossier",
              "fiche",
              "classement",
              "sermon",
              "homiletique",
              "predication",
              "notes"
          ],
          "path": "<path d=\"M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z\"/>"
      },
      {
          "id": "citations",
          "label": "Citation / Verset",
          "category": "Étude & Exégèse",
          "keywords": [
              "citation",
              "verset",
              "texte",
              "guillemets",
              "passage",
              "auteur",
              "quote"
          ],
          "path": "<path d=\"M3 21c3 0 7-1 7-8V5H4v8h3c0 4-2 6-4 6v2zM14 21c3 0 7-1 7-8V5h-6v8h3c0 4-2 6-4 6v2z\"/>"
      },
      {
          "id": "comparaison",
          "label": "Parallèle / Colonnes",
          "category": "Étude & Exégèse",
          "keywords": [
              "parallele",
              "synoptique",
              "colonnes",
              "comparaison",
              "harmonie",
              "texte"
          ],
          "path": "<rect x=\"3\" y=\"4\" width=\"8\" height=\"16\" rx=\"1\"/><rect x=\"13\" y=\"4\" width=\"8\" height=\"16\" rx=\"1\"/><line x1=\"6\" y1=\"8\" x2=\"8\" y2=\"8\"/><line x1=\"16\" y1=\"8\" x2=\"18\" y2=\"8\"/>"
      },
      {
          "id": "arbre-racine",
          "label": "Étymologie / Racine",
          "category": "Étude & Exégèse",
          "keywords": [
              "etymologie",
              "racine",
              "origine",
              "sens",
              "definition",
              "mots",
              "racines"
          ],
          "path": "<path d=\"M12 3v10M8 8l4 5 4-5M7 21l5-5 5 5M12 16v5M4 13h16\"/>"
      },
      {
          "id": "priere",
          "label": "Prière / Intercession",
          "category": "Prière & Vie spirituelle",
          "keywords": [
              "priere",
              "mains",
              "intercession",
              "adoration",
              "supplication",
              "action de grace",
              "prayer"
          ],
          "path": "<path d=\"M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0\"/><path d=\"M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2\"/><path d=\"M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8\"/><path d=\"M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15\"/>"
      },
      {
          "id": "harpe",
          "label": "Harpe / Louange",
          "category": "Prière & Vie spirituelle",
          "keywords": [
              "harpe",
              "louange",
              "psaume",
              "musique",
              "culte",
              "chant",
              "adoration",
              "music"
          ],
          "path": "<path d=\"M9 18V5l12-2v13\"/><line x1=\"9\" y1=\"9\" x2=\"21\" y2=\"7\"/><circle cx=\"6\" cy=\"18\" r=\"3\"/><circle cx=\"18\" cy=\"16\" r=\"3\"/>"
      },
      {
          "id": "trompette",
          "label": "Trompette / Proclamation",
          "category": "Prière & Vie spirituelle",
          "keywords": [
              "trompette",
              "proclamation",
              "appel",
              "jubile",
              "annoncer",
              "shofar",
              "trumpet"
          ],
          "path": "<path d=\"m3 11 18-5v12L3 14v-3z\"/><path d=\"M11.6 16.8a3 3 0 1 1-5.8-1.6\"/>"
      },
      {
          "id": "autel",
          "label": "Autel d'adoration",
          "category": "Prière & Vie spirituelle",
          "keywords": [
              "autel",
              "consecration",
              "sacrifice",
              "offrande",
              "adoration",
              "don",
              "feu"
          ],
          "path": "<path d=\"M3 20h18M5 16h14M7 20v-4M17 20v-4M6 16V8h12v8M10 5l2-3 2 3\"/>"
      },
      {
          "id": "encens",
          "label": "Encens / Prières des saints",
          "category": "Prière & Vie spirituelle",
          "keywords": [
              "encens",
              "parfum",
              "odeur",
              "priere",
              "saints",
              "sanctuaire",
              "adoration"
          ],
          "path": "<path d=\"M6 16a6 6 0 0 0 12 0H6zM12 16v5M8 21h8\"/><path d=\"M10 10c-1-1-1-3 0-4s1-3 0-4M14 10c-1-1-1-3 0-4s1-3 0-4\"/>"
      },
      {
          "id": "lampe-huile",
          "label": "Lampe à Huile / Veille",
          "category": "Prière & Vie spirituelle",
          "keywords": [
              "lampe",
              "huile",
              "veille",
              "vigilance",
              "vierges",
              "sages",
              "lumiere",
              "attente"
          ],
          "path": "<path d=\"M3 15c0 4 4 6 9 6s9-2 9-6-4-4-9-4-9 0-9 4z\"/><path d=\"M19 13l2-5h-3\"/><path d=\"M12 11c-1-2 0-4 1-6 1 2 2 4 1 6z\"/>"
      },
      {
          "id": "cloche",
          "label": "Cloche / Culte",
          "category": "Prière & Vie spirituelle",
          "keywords": [
              "cloche",
              "culte",
              "rassemblement",
              "eglise",
              "fete",
              "convocation",
              "appel"
          ],
          "path": "<path d=\"M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9\"/><path d=\"M13.73 21a2 2 0 0 1-3.46 0\"/>"
      },
      {
          "id": "coeur",
          "label": "Amour / Agapé",
          "category": "Prière & Vie spirituelle",
          "keywords": [
              "coeur",
              "amour",
              "agape",
              "charite",
              "compassion",
              "coeur",
              "heart",
              "love"
          ],
          "path": "<path d=\"M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z\"/>"
      },
      {
          "id": "goutte-huile",
          "label": "Huile d'Onction",
          "category": "Prière & Vie spirituelle",
          "keywords": [
              "huile",
              "onction",
              "esprit",
              "guerison",
              "benediction",
              "consecration",
              "jacques"
          ],
          "path": "<path d=\"M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z\"/><circle cx=\"12\" cy=\"14\" r=\"3\"/>"
      },
      {
          "id": "genou",
          "label": "À Genoux / Humilité",
          "category": "Prière & Vie spirituelle",
          "keywords": [
              "genou",
              "humilite",
              "prosternation",
              "adoration",
              "soumission",
              "repentance"
          ],
          "path": "<circle cx=\"10\" cy=\"5\" r=\"2.5\"/><path d=\"M8 10h4l3 6 4 1M12 16l-3 5H4\"/>"
      },
      {
          "id": "offrande",
          "label": "Corbeille d'Offrande",
          "category": "Prière & Vie spirituelle",
          "keywords": [
              "offrande",
              "dime",
              "generosite",
              "don",
              "partage",
              "eglise",
              "culte"
          ],
          "path": "<path d=\"M3 8h18l-2 11H5L3 8zM2 8l4-5h12l4 5M12 3v5\"/>"
      },
      {
          "id": "recueillement",
          "label": "Bougie / Méditation",
          "category": "Prière & Vie spirituelle",
          "keywords": [
              "bougie",
              "veille",
              "recueillement",
              "silence",
              "meditation",
              "paix",
              "calme"
          ],
          "path": "<path d=\"M8 21h8M10 21V9a2 2 0 0 1 4 0v12\"/><path d=\"M12 3c-1 1-1 2 0 3s1 2 0 3\"/>"
      },
      {
          "id": "choeur",
          "label": "Chœur / Cantique",
          "category": "Prière & Vie spirituelle",
          "keywords": [
              "choeur",
              "cantique",
              "chant",
              "assemblee",
              "voix",
              "chorale",
              "communion"
          ],
          "path": "<path d=\"M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2\"/><circle cx=\"10\" cy=\"7\" r=\"4\"/><path d=\"M22 21v-2a4 4 0 0 0-3-3.87\"/><path d=\"M16 3.13a4 4 0 0 1 0 7.75\"/>"
      },
      {
          "id": "ciel-ouvert",
          "label": "Ciel Ouvert / Gloire",
          "category": "Prière & Vie spirituelle",
          "keywords": [
              "ciel",
              "ouvert",
              "gloire",
              "presence",
              "vision",
              "etienne",
              "lumiere"
          ],
          "path": "<path d=\"M3 12c0-5 4-9 9-9s9 4 9 9\"/><path d=\"m12 8 3 4h-2v5h-2v-5H9l3-4z\"/>"
      },
      {
          "id": "repos-sabbat",
          "label": "Repos / Sabbat",
          "category": "Prière & Vie spirituelle",
          "keywords": [
              "repos",
              "sabbat",
              "paix",
              "cessation",
              "fardeau",
              "nuit",
              "lune"
          ],
          "path": "<path d=\"M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26 5.403 5.403 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1z\"/>"
      },
      {
          "id": "benediction",
          "label": "Mains de Bénédiction",
          "category": "Prière & Vie spirituelle",
          "keywords": [
              "benediction",
              "imposition",
              "mains",
              "paix",
              "envoi",
              "aaron",
              "grace"
          ],
          "path": "<path d=\"M6 14v-4a2 2 0 0 1 4 0v4M10 12v-5a2 2 0 0 1 4 0v5M14 13V8a2 2 0 0 1 4 0v6\"/><path d=\"M6 14a6 6 0 0 0 12 0v-2\"/>"
      },
      {
          "id": "epee",
          "label": "Épée de la Parole",
          "category": "Marche & Combat",
          "keywords": [
              "epee",
              "combat",
              "parole",
              "verite",
              "esprit",
              "tranchante",
              "armure",
              "sword"
          ],
          "path": "<polyline points=\"14.5 17.5 3 6 3 3 6 3 17.5 14.5\"/><line x1=\"13\" y1=\"19\" x2=\"19\" y2=\"13\"/><line x1=\"16\" y1=\"16\" x2=\"20\" y2=\"20\"/><line x1=\"19\" y1=\"21\" x2=\"21\" y2=\"19\"/>"
      },
      {
          "id": "bouclier",
          "label": "Bouclier de la Foi",
          "category": "Marche & Combat",
          "keywords": [
              "bouclier",
              "protection",
              "foi",
              "defense",
              "garde",
              "securite",
              "shield"
          ],
          "path": "<path d=\"M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z\"/>"
      },
      {
          "id": "casque",
          "label": "Casque du Salut",
          "category": "Marche & Combat",
          "keywords": [
              "casque",
              "salut",
              "pensees",
              "intelligence",
              "armure",
              "combat",
              "helmet"
          ],
          "path": "<path d=\"M4 14a8 8 0 0 1 16 0v4H4v-4zM9 18v3M15 18v3M2 14h20\"/>"
      },
      {
          "id": "cuirasse",
          "label": "Cuirasse de Justice",
          "category": "Marche & Combat",
          "keywords": [
              "cuirasse",
              "justice",
              "coeur",
              "protection",
              "integrite",
              "armure"
          ],
          "path": "<path d=\"M6 4h12l2 6-3 10H7L4 10l2-6zM10 4v6M14 4v6M8 14h8\"/>"
      },
      {
          "id": "ceinture",
          "label": "Ceinture de Vérité",
          "category": "Marche & Combat",
          "keywords": [
              "ceinture",
              "verite",
              "service",
              "tenue",
              "sincerite",
              "ceindre",
              "reins"
          ],
          "path": "<rect x=\"2\" y=\"8\" width=\"20\" height=\"8\" rx=\"2\"/><rect x=\"9\" y=\"7\" width=\"6\" height=\"10\" rx=\"1\"/><line x1=\"12\" y1=\"10\" x2=\"12\" y2=\"14\"/>"
      },
      {
          "id": "sandales",
          "label": "Sandales du Zèle",
          "category": "Marche & Combat",
          "keywords": [
              "sandales",
              "zele",
              "evangile",
              "paix",
              "marche",
              "chaussures",
              "messager"
          ],
          "path": "<path d=\"M6 19c0-2 2-4 6-4s6 2 6 4v1H6v-1zM8 15l4-7 4 7M4 20h16\"/>"
      },
      {
          "id": "ancre",
          "label": "Ancre d'Espérance",
          "category": "Marche & Combat",
          "keywords": [
              "ancre",
              "esperance",
              "fermete",
              "refuge",
              "assurance",
              "ame",
              "anchor",
              "hope"
          ],
          "path": "<circle cx=\"12\" cy=\"5\" r=\"3\"/><line x1=\"12\" y1=\"22\" x2=\"12\" y2=\"8\"/><path d=\"M5 12H2a10 10 0 0 0 20 0h-3\"/><line x1=\"9\" y1=\"12\" x2=\"15\" y2=\"12\"/>"
      },
      {
          "id": "berger",
          "label": "Bâton de Berger",
          "category": "Marche & Combat",
          "keywords": [
              "berger",
              "pasteur",
              "brebis",
              "conduite",
              "houlette",
              "baton",
              "shepherd"
          ],
          "path": "<path d=\"M10 21V9a4 4 0 1 1 8 0v2\"/><line x1=\"8\" y1=\"21\" x2=\"12\" y2=\"21\"/>"
      },
      {
          "id": "chemin",
          "label": "Chemin / Sentier étroit",
          "category": "Marche & Combat",
          "keywords": [
              "chemin",
              "sentier",
              "etroit",
              "marche",
              "voie",
              "route",
              "suivre",
              "direction"
          ],
          "path": "<path d=\"M4 21 9 3M20 21l-5-18M10 8h4M9 13h6M8 18h8\"/>"
      },
      {
          "id": "montagne",
          "label": "Montagne / Sommet",
          "category": "Marche & Combat",
          "keywords": [
              "montagne",
              "sommet",
              "ascension",
              "epreuve",
              "transfiguration",
              "hauteur",
              "mountain"
          ],
          "path": "<path d=\"m8 3 4 8 5-5 5 15H2L8 3z\"/>"
      },
      {
          "id": "echelle",
          "label": "Échelle de Jacob",
          "category": "Marche & Combat",
          "keywords": [
              "echelle",
              "jacob",
              "progression",
              "croissance",
              "anges",
              "ciel",
              "montee"
          ],
          "path": "<line x1=\"7\" y1=\"3\" x2=\"7\" y2=\"21\"/><line x1=\"17\" y1=\"3\" x2=\"17\" y2=\"21\"/><line x1=\"7\" y1=\"6\" x2=\"17\" y2=\"6\"/><line x1=\"7\" y1=\"10\" x2=\"17\" y2=\"10\"/><line x1=\"7\" y1=\"14\" x2=\"17\" y2=\"14\"/><line x1=\"7\" y1=\"18\" x2=\"17\" y2=\"18\"/>"
      },
      {
          "id": "phare",
          "label": "Phare / Guide",
          "category": "Marche & Combat",
          "keywords": [
              "phare",
              "guide",
              "lumiere",
              "nuit",
              "mer",
              "tempete",
              "temoin",
              "securite"
          ],
          "path": "<path d=\"M8 21h8M9 21V9l2-5h2l2 5v12M9 12h6M9 16h6\"/><circle cx=\"12\" cy=\"7\" r=\"1.5\"/><line x1=\"3\" y1=\"7\" x2=\"6\" y2=\"7\"/><line x1=\"18\" y1=\"7\" x2=\"21\" y2=\"7\"/>"
      },
      {
          "id": "joug",
          "label": "Joug Doux du Christ",
          "category": "Marche & Combat",
          "keywords": [
              "joug",
              "doux",
              "fardeau",
              "leger",
              "discipulat",
              "apprendre",
              "charrue"
          ],
          "path": "<path d=\"M4 10c2-3 6-3 8 0 2-3 6-3 8 0v3c-2-1-4-1-6 0-3 1-5 1-8 0-2-1-4-1-6 0v-3zM7 13v5M17 13v5\"/>"
      },
      {
          "id": "chaines-brisees",
          "label": "Chaînes Brisées / Délivrance",
          "category": "Marche & Combat",
          "keywords": [
              "chaines",
              "brisees",
              "delivrance",
              "liberte",
              "affranchi",
              "captif",
              "salut"
          ],
          "path": "<path d=\"M9 12a4 4 0 0 1-4-4V6a4 4 0 0 1 8 0\"/><path d=\"M15 12a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0\"/><line x1=\"7\" y1=\"17\" x2=\"11\" y2=\"13\"/>"
      },
      {
          "id": "vetement-blanc",
          "label": "Robe Blanche / Pureté",
          "category": "Marche & Combat",
          "keywords": [
              "vetement",
              "robe",
              "blanche",
              "purete",
              "justice",
              "saints",
              "noces",
              "nouvelle creation"
          ],
          "path": "<path d=\"M6 3h12l3 5-3 2v11H6V10L3 8l3-5zM9 3a3 3 0 0 0 6 0\"/>"
      },
      {
          "id": "miroir",
          "label": "Miroir de la Parole",
          "category": "Marche & Combat",
          "keywords": [
              "miroir",
              "parole",
              "jacques",
              "examen",
              "verite",
              "soi-meme",
              "sanctification"
          ],
          "path": "<circle cx=\"12\" cy=\"9\" r=\"6\"/><path d=\"M12 15v6M9 19h6M9 8c.5-1.5 2-2.5 3.5-2.5\"/>"
      },
      {
          "id": "perle",
          "label": "Perle de Grand Prix",
          "category": "Marche & Combat",
          "keywords": [
              "perle",
              "tresor",
              "royaume",
              "valeur",
              "parabole",
              "inestimable",
              "achat"
          ],
          "path": "<circle cx=\"12\" cy=\"12\" r=\"8\"/><circle cx=\"9\" cy=\"9\" r=\"2\" fill=\"currentColor\"/>"
      },
      {
          "id": "tour",
          "label": "Tour Forte / Citadelle",
          "category": "Marche & Combat",
          "keywords": [
              "tour",
              "citadelle",
              "forteresse",
              "refuge",
              "rempart",
              "haute retraite",
              "protection",
              "securite",
              "tour forte",
              "chateau"
          ],
          "path": "<path d=\"M6 21h12M7 21V7l1-1h1v2h2V6h2v2h2V6h1l1 1v14M10 11h4M10 15h4M10 21v-3a2 2 0 0 1 4 0v3\"/>"
      },
      {
          "id": "lumiere",
          "label": "Lumière / Soleil",
          "category": "Création & Paraboles",
          "keywords": [
              "lumiere",
              "soleil",
              "clarté",
              "jour",
              "rayon",
              "briller",
              "sun",
              "light"
          ],
          "path": "<circle cx=\"12\" cy=\"12\" r=\"4\"/><line x1=\"12\" y1=\"2\" x2=\"12\" y2=\"4\"/><line x1=\"12\" y1=\"20\" x2=\"12\" y2=\"22\"/><line x1=\"4.93\" y1=\"4.93\" x2=\"6.34\" y2=\"6.34\"/><line x1=\"17.66\" y1=\"17.66\" x2=\"19.07\" y2=\"19.07\"/><line x1=\"2\" y1=\"12\" x2=\"4\" y2=\"12\"/><line x1=\"20\" y1=\"12\" x2=\"22\" y2=\"12\"/><line x1=\"4.93\" y1=\"19.07\" x2=\"6.34\" y2=\"17.66\"/><line x1=\"17.66\" y1=\"6.34\" x2=\"19.07\" y2=\"4.93\"/>"
      },
      {
          "id": "etoile",
          "label": "Étoile / Promesse",
          "category": "Création & Paraboles",
          "keywords": [
              "etoile",
              "promesse",
              "guide",
              "bethleem",
              "direction",
              "esperance",
              "star"
          ],
          "path": "<polygon points=\"12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2\"/>"
      },
      {
          "id": "arbre",
          "label": "Arbre de Vie / Fruit",
          "category": "Création & Paraboles",
          "keywords": [
              "arbre",
              "fruit",
              "vie",
              "racines",
              "croissance",
              "juste",
              "plante",
              "tree"
          ],
          "path": "<path d=\"M12 19v3\"/><path d=\"M12 19a7 7 0 0 1-7-7c0-3.5 2.5-6.5 6-7 .5-2 2.5-3 4-3s3.5 1 4 3c3.5.5 6 3.5 6 7a7 7 0 0 1-7 7z\"/>"
      },
      {
          "id": "eau",
          "label": "Source / Eau vive",
          "category": "Création & Paraboles",
          "keywords": [
              "eau",
              "source",
              "fleuve",
              "bapteme",
              "goutte",
              "vie",
              "water"
          ],
          "path": "<path d=\"M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z\"/>"
      },
      {
          "id": "vigne",
          "label": "Vigne & Sarments",
          "category": "Création & Paraboles",
          "keywords": [
              "vigne",
              "sarment",
              "raisin",
              "vin",
              "porter du fruit",
              "cep",
              "demeurer"
          ],
          "path": "<circle cx=\"12\" cy=\"11\" r=\"2.5\"/><circle cx=\"8\" cy=\"14\" r=\"2.5\"/><circle cx=\"16\" cy=\"14\" r=\"2.5\"/><circle cx=\"10\" cy=\"18\" r=\"2.5\"/><circle cx=\"14\" cy=\"18\" r=\"2.5\"/><circle cx=\"12\" cy=\"21\" r=\"2\"/><path d=\"M12 8V3c3 0 5 2 5 4M12 5c-3 0-5 2-5 4\"/>"
      },
      {
          "id": "olivier",
          "label": "Olivier / Rameau",
          "category": "Création & Paraboles",
          "keywords": [
              "olivier",
              "huile",
              "paix",
              "israel",
              "rameau",
              "onction",
              "arbre"
          ],
          "path": "<path d=\"M12 21v-7M12 14c-4 0-6-3-6-7 4 0 6 3 6 7zM12 14c4 0 6-3 6-7-4 0-6 3-6 7z\"/><circle cx=\"12\" cy=\"9\" r=\"1.5\" fill=\"currentColor\"/>"
      },
      {
          "id": "figuier",
          "label": "Figuier / Parabole",
          "category": "Création & Paraboles",
          "keywords": [
              "figuier",
              "figue",
              "fruit",
              "feuille",
              "parabole",
              "temps",
              "saison"
          ],
          "path": "<path d=\"M12 22v-6M12 16c-3-1-5-4-5-8 4 0 5 3 5 8zM12 16c3-1 5-4 5-8-4 0-5 3-5 8z\"/><path d=\"M12 10c0-4 2-7 5-7 0 4-2 7-5 7z\"/>"
      },
      {
          "id": "ble",
          "label": "Épi de Blé / Moisson",
          "category": "Création & Paraboles",
          "keywords": [
              "ble",
              "epi",
              "moisson",
              "pain",
              "champ",
              "recolte",
              "froment",
              "grain"
          ],
          "path": "<line x1=\"12\" y1=\"22\" x2=\"12\" y2=\"4\"/><path d=\"M12 4c2 2 3 5 0 7-3-2-2-5 0-7zM12 9c-2 2-3 5 0 7 3-2 2-5 0-7zM12 14c2 2 3 5 0 7-3-2-2-5 0-7z\"/>"
      },
      {
          "id": "semence",
          "label": "Graine de Sénevé",
          "category": "Création & Paraboles",
          "keywords": [
              "semence",
              "graine",
              "seneve",
              "foi",
              "petit",
              "croissance",
              "parabole"
          ],
          "path": "<ellipse cx=\"12\" cy=\"17\" rx=\"6\" ry=\"4\"/><path d=\"M12 13V6M9 9l3-3 3 3\"/>"
      },
      {
          "id": "lys",
          "label": "Lys des Champs",
          "category": "Création & Paraboles",
          "keywords": [
              "lys",
              "fleur",
              "champs",
              "providence",
              "beaute",
              "salomon",
              "vetir"
          ],
          "path": "<path d=\"M12 21v-8M12 13c-3-2-5-6-4-10 3 2 4 6 4 10zM12 13c3-2 5-6 4-10-3 2-4 6-4 10zM7 11c-2-2-3-5-1-8 2 1 3 4 1 8zM17 11c2-2 3-5 1-8-2 1-3 4-1 8z\"/>"
      },
      {
          "id": "rocher",
          "label": "Rocher des Siècles",
          "category": "Création & Paraboles",
          "keywords": [
              "rocher",
              "pierre",
              "fondement",
              "roc",
              "maison",
              "refuge",
              "solidite"
          ],
          "path": "<path d=\"m3 20 4-10 6-4 8 7-3 7zM7 10l5 4 4-2\"/>"
      },
      {
          "id": "colombe-rameau",
          "label": "Rameau d'Olivier / Paix",
          "category": "Création & Paraboles",
          "keywords": [
              "colombe",
              "rameau",
              "paix",
              "noe",
              "fin",
              "deluge",
              "reconciliation"
          ],
          "path": "<path d=\"M3 17c3 0 6-2 8-5 1-1.5 2.5-2.5 4-2.5H19a2 2 0 0 0 2-2c0-2-1.5-3.5-3.5-3.5-2 0-4 1.5-5 3.5L10 10C8 10 5.5 11.5 4 13.5L3 17z\"/><path d=\"m14 12 3 4-5 1M20 5l-4 2M21 8l-3-1\"/>"
      },
      {
          "id": "sel",
          "label": "Sel de la Terre",
          "category": "Création & Paraboles",
          "keywords": [
              "sel",
              "terre",
              "saveur",
              "preservation",
              "temoignage",
              "purete",
              "sel"
          ],
          "path": "<path d=\"M8 8h8v12a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V8z\"/><path d=\"M9 8V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v3\"/><circle cx=\"12\" cy=\"14\" r=\".75\" fill=\"currentColor\"/><circle cx=\"10\" cy=\"16\" r=\".75\" fill=\"currentColor\"/><circle cx=\"14\" cy=\"16\" r=\".75\" fill=\"currentColor\"/>"
      },
      {
          "id": "levain",
          "label": "Levain / Pâte",
          "category": "Création & Paraboles",
          "keywords": [
              "levain",
              "pate",
              "royaume",
              "influence",
              "croissance",
              "invisible",
              "ferment"
          ],
          "path": "<circle cx=\"12\" cy=\"14\" r=\"7\"/><path d=\"M8 9c0-3 2-5 4-5s4 2 4 5M10 14h.01M14 14h.01M12 17h.01\"/>"
      },
      {
          "id": "aigle",
          "label": "Aigle / Renouveau",
          "category": "Création & Paraboles",
          "keywords": [
              "aigle",
              "force",
              "renouveau",
              "ailes",
              "envol",
              "jeunesse",
              "esaie"
          ],
          "path": "<path d=\"M12 3c3 3 7 5 9 6-2 3-5 5-9 5s-7-2-9-5c2-1 6-3 9-6zM12 14v7M9 18l3 3 3-3\"/>"
      },
      {
          "id": "cerf",
          "label": "Cerf / Soif de Dieu",
          "category": "Création & Paraboles",
          "keywords": [
              "cerf",
              "biche",
              "soif",
              "eau",
              "psaume 42",
              "ame",
              "desir de dieu"
          ],
          "path": "<path d=\"M12 16a4 4 0 0 1-4-4V7a4 4 0 1 1 8 0v5a4 4 0 0 1-4 4z\"/><path d=\"M6 3l2 4M18 3l-2 4M3 5l5 2M21 5l-5 2M10 21v-3M14 21v-3\"/>"
      },
      {
          "id": "arc-orage",
          "label": "Tempête Apaisée",
          "category": "Création & Paraboles",
          "keywords": [
              "tempete",
              "orage",
              "calme",
              "paix",
              "mer",
              "vent",
              "foi",
              "peur"
          ],
          "path": "<path d=\"M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z\"/><path d=\"m11 13-2 4h4l-2 4\"/>"
      },
      {
          "id": "famille",
          "label": "Famille / Foyer",
          "category": "Communauté & Organisation",
          "keywords": [
              "famille",
              "foyer",
              "parents",
              "enfants",
              "maison",
              "couple",
              "education"
          ],
          "path": "<path d=\"M3 21v-2a4 4 0 0 1 4-4h2a4 4 0 0 1 4 4v2\"/><circle cx=\"8\" cy=\"7\" r=\"3\"/><path d=\"M15 21v-2a3 3 0 0 0-2-2.8\"/><path d=\"M17 11a2.5 2.5 0 1 0 0-5\"/>"
      },
      {
          "id": "fraternite",
          "label": "Fraternité / Koinonia",
          "category": "Communauté & Organisation",
          "keywords": [
              "fraternite",
              "koinonia",
              "communion",
              "accueil",
              "main",
              "poignee",
              "freres"
          ],
          "path": "<path d=\"m11 15 2 2 6-6M4 11l4-4 4 4-2 2M2 13l5 5 4-4\"/>"
      },
      {
          "id": "porte",
          "label": "Porte Ouverte / Mission",
          "category": "Communauté & Organisation",
          "keywords": [
              "porte",
              "ouverte",
              "entree",
              "mission",
              "occasion",
              "evangelisation",
              "acces"
          ],
          "path": "<path d=\"M4 21h16M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17M14 12v.01\"/>"
      },
      {
          "id": "globe",
          "label": "Nations / Monde entier",
          "category": "Communauté & Organisation",
          "keywords": [
              "globe",
              "monde",
              "nations",
              "terre",
              "mission",
              "ordre supreme",
              "peuples"
          ],
          "path": "<circle cx=\"12\" cy=\"12\" r=\"10\"/><line x1=\"2\" y1=\"12\" x2=\"22\" y2=\"12\"/><path d=\"M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z\"/>"
      },
      {
          "id": "visite",
          "label": "Hospitalité / Visite",
          "category": "Communauté & Organisation",
          "keywords": [
              "hospitalite",
              "visite",
              "pastorale",
              "maison",
              "coeur",
              "amour",
              "soin"
          ],
          "path": "<path d=\"m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z\"/><path d=\"M9 22V12h6v10\"/><path d=\"M12 7v2\"/>"
      },
      {
          "id": "village",
          "label": "Village / Bourgade",
          "category": "Communauté & Organisation",
          "keywords": [
              "village",
              "bourg",
              "bourgade",
              "campagne",
              "hameau",
              "maisons",
              "communaute",
              "localite",
              "villageois"
          ],
          "path": "<path d=\"M2 20h20M3 20v-7l4-4 4 4v7M11 20v-5l3-3 3 3v5M17 20v-7l2.5-2.5 2.5 2.5v7M7 14h.01M14 15h.01\"/>"
      },
      {
          "id": "chariot-ble",
          "label": "Gerbe / Récolte",
          "category": "Communauté & Organisation",
          "keywords": [
              "gerbe",
              "recolte",
              "moisson",
              "ouvriers",
              "champs",
              "joie",
              "fete"
          ],
          "path": "<rect x=\"3\" y=\"10\" width=\"14\" height=\"6\" rx=\"1\"/><circle cx=\"6\" cy=\"18\" r=\"2\"/><circle cx=\"14\" cy=\"18\" r=\"2\"/><line x1=\"17\" y1=\"13\" x2=\"21\" y2=\"13\"/><path d=\"M6 10V6l3 4 3-4v4\"/>"
      },
      {
          "id": "aumone",
          "label": "Entraide / Diaconie",
          "category": "Communauté & Organisation",
          "keywords": [
              "aumone",
              "diaconie",
              "pauvres",
              "entraide",
              "don",
              "secours",
              "amour"
          ],
          "path": "<path d=\"M12 3v12M8 11l4 4 4-4\"/><path d=\"M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2\"/>"
      },
      {
          "id": "check",
          "label": "Validé / Fait",
          "category": "Communauté & Organisation",
          "keywords": [
              "check",
              "valide",
              "fait",
              "oui",
              "accompli",
              "succes",
              "vrai"
          ],
          "path": "<polyline points=\"20 6 9 17 4 12\"/>"
      },
      {
          "id": "cible",
          "label": "Cible / Vocation",
          "category": "Communauté & Organisation",
          "keywords": [
              "cible",
              "but",
              "objectif",
              "vocation",
              "direction",
              "target"
          ],
          "path": "<circle cx=\"12\" cy=\"12\" r=\"10\"/><circle cx=\"12\" cy=\"12\" r=\"6\"/><circle cx=\"12\" cy=\"12\" r=\"2\"/>"
      },
      {
          "id": "epingle",
          "label": "Épinglé / Point Clé",
          "category": "Communauté & Organisation",
          "keywords": [
              "epingle",
              "important",
              "retenir",
              "fixer",
              "priorite",
              "pin"
          ],
          "path": "<line x1=\"12\" y1=\"17\" x2=\"12\" y2=\"22\"/><path d=\"M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z\"/>"
      },
      {
          "id": "avertissement",
          "label": "Vigilance / Attention",
          "category": "Communauté & Organisation",
          "keywords": [
              "avertissement",
              "attention",
              "danger",
              "vigilance",
              "mise en garde",
              "triangle",
              "warning"
          ],
          "path": "<path d=\"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z\"/><line x1=\"12\" y1=\"9\" x2=\"12\" y2=\"13\"/><line x1=\"12\" y1=\"17\" x2=\"12.01\" y2=\"17\"/>"
      },
      {
          "id": "question",
          "label": "Question / Énigme",
          "category": "Communauté & Organisation",
          "keywords": [
              "question",
              "interrogation",
              "pourquoi",
              "enigme",
              "doute",
              "probleme",
              "help"
          ],
          "path": "<circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3\"/><line x1=\"12\" y1=\"17\" x2=\"12.01\" y2=\"17\"/>"
      },
      {
          "id": "tag",
          "label": "Étiquette / Thème",
          "category": "Communauté & Organisation",
          "keywords": [
              "tag",
              "etiquette",
              "theme",
              "categorie",
              "mot-cle",
              "label"
          ],
          "path": "<path d=\"M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z\"/><circle cx=\"7\" cy=\"7\" r=\".5\" fill=\"currentColor\"/>"
      },
      {
          "id": "coffre",
          "label": "Trésor dans le Ciel",
          "category": "Communauté & Organisation",
          "keywords": [
              "coffre",
              "tresor",
              "ciel",
              "richesse",
              "coeur",
              "heritage",
              "or"
          ],
          "path": "<rect x=\"3\" y=\"8\" width=\"18\" height=\"13\" rx=\"2\"/><path d=\"M3 12h18M12 11v3\"/><path d=\"M6 8V6a3 3 0 0 1 6 0v2M12 6a3 3 0 0 1 6 0v2\"/>"
      },
      {
          "id": "couronne-etoiles",
          "label": "Victoire / 12 Étoiles",
          "category": "Communauté & Organisation",
          "keywords": [
              "couronne",
              "etoiles",
              "apocalypse",
              "victoire",
              "vainqueur",
              "gloire",
              "douze"
          ],
          "path": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><circle cx=\"12\" cy=\"5\" r=\"1\" fill=\"currentColor\"/><circle cx=\"15.5\" cy=\"6\" r=\"1\" fill=\"currentColor\"/><circle cx=\"18\" cy=\"8.5\" r=\"1\" fill=\"currentColor\"/><circle cx=\"19\" cy=\"12\" r=\"1\" fill=\"currentColor\"/><circle cx=\"18\" cy=\"15.5\" r=\"1\" fill=\"currentColor\"/><circle cx=\"15.5\" cy=\"18\" r=\"1\" fill=\"currentColor\"/><circle cx=\"12\" cy=\"19\" r=\"1\" fill=\"currentColor\"/><circle cx=\"8.5\" cy=\"18\" r=\"1\" fill=\"currentColor\"/><circle cx=\"6\" cy=\"15.5\" r=\"1\" fill=\"currentColor\"/><circle cx=\"5\" cy=\"12\" r=\"1\" fill=\"currentColor\"/><circle cx=\"6\" cy=\"8.5\" r=\"1\" fill=\"currentColor\"/><circle cx=\"8.5\" cy=\"6\" r=\"1\" fill=\"currentColor\"/>"
      }
  ],

  // =========================================================================
  // THÉSAURUS SÉMANTIQUE & EXÉGÉTIQUE (100% LOCAL, SANS LLM, LATENCE ZÉRO)
  // Associe de façon intelligente et instantanée les mots-clés aux icônes
  // =========================================================================

  THESAURUS: {
      "genese": [
          "lumiere",
          "arbre",
          "etoile",
          "parchemin"
      ],
      "gen": [
          "lumiere",
          "arbre",
          "etoile"
      ],
      "exode": [
          "buisson-ardent",
          "tables-loi",
          "colonne-nuee",
          "flamme"
      ],
      "ex": [
          "buisson-ardent",
          "tables-loi",
          "colonne-nuee"
      ],
      "levitique": [
          "autel",
          "calice",
          "temple",
          "encens"
      ],
      "lev": [
          "autel",
          "calice",
          "temple"
      ],
      "nombres": [
          "boussole",
          "serpent-airain",
          "colonne-nuee",
          "montagne"
      ],
      "nom": [
          "boussole",
          "serpent-airain"
      ],
      "deuteronome": [
          "tables-loi",
          "parchemin",
          "balance",
          "coeur"
      ],
      "deut": [
          "tables-loi",
          "parchemin",
          "balance"
      ],
      "josue": [
          "shofar",
          "epee",
          "arche-alliance",
          "bouclier"
      ],
      "jos": [
          "shofar",
          "epee",
          "arche-alliance"
      ],
      "juges": [
          "fronde-david",
          "epee",
          "trompette",
          "balance"
      ],
      "jug": [
          "fronde-david",
          "epee",
          "balance"
      ],
      "ruth": [
          "ble",
          "chariot-ble",
          "alliance",
          "coeur"
      ],
      "1 samuel": [
          "corne-onction",
          "fronde-david",
          "couronne",
          "priere"
      ],
      "2 samuel": [
          "couronne",
          "corne-onction",
          "temple",
          "lion-juda"
      ],
      "samuel": [
          "corne-onction",
          "fronde-david",
          "couronne"
      ],
      "1sam": [
          "corne-onction",
          "fronde-david"
      ],
      "2sam": [
          "couronne",
          "corne-onction"
      ],
      "1 rois": [
          "temple",
          "couronne",
          "menorah",
          "chariot-feu"
      ],
      "2 rois": [
          "chariot-feu",
          "manteau-prophete",
          "couronne",
          "temple"
      ],
      "rois": [
          "couronne",
          "temple",
          "chariot-feu"
      ],
      "1rois": [
          "temple",
          "couronne"
      ],
      "2rois": [
          "chariot-feu",
          "manteau-prophete"
      ],
      "1 chroniques": [
          "temple",
          "arche-alliance",
          "harpe",
          "couronne"
      ],
      "2 chroniques": [
          "temple",
          "arche-alliance",
          "autel",
          "priere"
      ],
      "chroniques": [
          "temple",
          "arche-alliance",
          "harpe"
      ],
      "1chr": [
          "temple",
          "arche-alliance"
      ],
      "2chr": [
          "temple",
          "autel"
      ],
      "esdras": [
          "parchemin",
          "temple",
          "plume",
          "autel"
      ],
      "esd": [
          "parchemin",
          "temple"
      ],
      "nehemie": [
          "temple",
          "epee",
          "priere",
          "porte"
      ],
      "neh": [
          "temple",
          "epee",
          "porte"
      ],
      "esther": [
          "couronne",
          "priere",
          "etoile",
          "balance"
      ],
      "esth": [
          "couronne",
          "priere"
      ],
      "job": [
          "recueillement",
          "montagne",
          "priere",
          "rocher"
      ],
      "psaumes": [
          "harpe",
          "priere",
          "bouclier",
          "berger",
          "rocher"
      ],
      "psaume": [
          "harpe",
          "priere",
          "bouclier",
          "berger"
      ],
      "ps": [
          "harpe",
          "priere",
          "bouclier"
      ],
      "proverbes": [
          "cle",
          "balance",
          "ampoule",
          "arbre-racine"
      ],
      "prov": [
          "cle",
          "balance",
          "ampoule"
      ],
      "ecclesiaste": [
          "balance",
          "question",
          "repos-sabbat",
          "lumiere"
      ],
      "eccl": [
          "balance",
          "question"
      ],
      "cantique": [
          "coeur",
          "alliance",
          "vigne",
          "lys"
      ],
      "cantique des cantiques": [
          "coeur",
          "alliance",
          "vigne",
          "lys"
      ],
      "ct": [
          "coeur",
          "alliance"
      ],
      "esaie": [
          "aigle",
          "couronne",
          "flamme",
          "serpent-airain",
          "lumiere"
      ],
      "es": [
          "aigle",
          "couronne",
          "flamme"
      ],
      "jeremie": [
          "parchemin",
          "coeur",
          "arbre",
          "puits"
      ],
      "jer": [
          "parchemin",
          "coeur"
      ],
      "lamentations": [
          "recueillement",
          "priere",
          "coeur",
          "ancre"
      ],
      "lam": [
          "recueillement",
          "priere"
      ],
      "ezechiel": [
          "temple",
          "eau",
          "chariot-feu",
          "flamme"
      ],
      "ez": [
          "temple",
          "eau",
          "flamme"
      ],
      "daniel": [
          "lion-juda",
          "couronne",
          "etoile",
          "priere"
      ],
      "dan": [
          "lion-juda",
          "couronne",
          "etoile"
      ],
      "osee": [
          "alliance",
          "coeur",
          "vigne"
      ],
      "os": [
          "alliance",
          "coeur"
      ],
      "joel": [
          "flamme",
          "colombe",
          "trompette",
          "ble"
      ],
      "amos": [
          "balance",
          "lion-juda",
          "chariot-ble"
      ],
      "am": [
          "balance",
          "lion-juda"
      ],
      "abdias": [
          "montagne",
          "aigle",
          "couronne"
      ],
      "jonas": [
          "ichtus",
          "arc-orage",
          "priere",
          "colombe"
      ],
      "jon": [
          "ichtus",
          "arc-orage"
      ],
      "michee": [
          "chemin",
          "berger",
          "balance",
          "etoile"
      ],
      "mic": [
          "chemin",
          "berger"
      ],
      "nahum": [
          "montagne",
          "trompette",
          "arc-orage"
      ],
      "habacuc": [
          "phare",
          "cerf",
          "priere",
          "rocher"
      ],
      "hab": [
          "phare",
          "cerf"
      ],
      "sophonie": [
          "lampe-huile",
          "trompette",
          "recueillement"
      ],
      "aggee": [
          "temple",
          "autel",
          "ble"
      ],
      "zacharie": [
          "menorah",
          "olivier",
          "couronne",
          "shofar"
      ],
      "zac": [
          "menorah",
          "olivier"
      ],
      "malachie": [
          "lumiere",
          "autel",
          "alliance",
          "balance"
      ],
      "mal": [
          "lumiere",
          "alliance"
      ],
      "matthieu": [
          "couronne",
          "lion-juda",
          "bible",
          "ichtus"
      ],
      "mat": [
          "couronne",
          "lion-juda",
          "bible"
      ],
      "marc": [
          "berger",
          "sandales",
          "croix",
          "ichtus"
      ],
      "mc": [
          "berger",
          "sandales",
          "croix"
      ],
      "luc": [
          "coeur",
          "priere",
          "visite",
          "calice"
      ],
      "lc": [
          "coeur",
          "priere",
          "visite"
      ],
      "jean": [
          "aigle",
          "lumiere",
          "pain",
          "eau",
          "croix",
          "vigne"
      ],
      "jn": [
          "aigle",
          "lumiere",
          "pain",
          "eau"
      ],
      "actes": [
          "flamme",
          "colombe",
          "trompette",
          "globe",
          "porte"
      ],
      "act": [
          "flamme",
          "colombe",
          "trompette"
      ],
      "romains": [
          "croix",
          "bible",
          "balance",
          "plume",
          "parchemin"
      ],
      "rom": [
          "croix",
          "bible",
          "balance"
      ],
      "1 corinthiens": [
          "temple",
          "coeur",
          "croix",
          "pain",
          "calice"
      ],
      "2 corinthiens": [
          "temple",
          "grace",
          "plume",
          "coffre"
      ],
      "corinthiens": [
          "temple",
          "coeur",
          "croix",
          "pain"
      ],
      "1cor": [
          "temple",
          "coeur",
          "croix"
      ],
      "2cor": [
          "temple",
          "grace",
          "plume"
      ],
      "galates": [
          "croix",
          "chaines-brisees",
          "balance",
          "vetement-blanc"
      ],
      "gal": [
          "croix",
          "chaines-brisees",
          "balance"
      ],
      "ephesiens": [
          "epee",
          "bouclier",
          "casque",
          "cuirasse",
          "temple"
      ],
      "eph": [
          "epee",
          "bouclier",
          "casque"
      ],
      "philippiens": [
          "coeur",
          "couronne",
          "etoile",
          "perle"
      ],
      "phil": [
          "coeur",
          "couronne",
          "etoile"
      ],
      "colossiens": [
          "couronne",
          "croix",
          "alpha-omega",
          "plume"
      ],
      "col": [
          "couronne",
          "croix",
          "alpha-omega"
      ],
      "1 thessaloniciens": [
          "trompette",
          "couronne",
          "etoile",
          "lampe-huile"
      ],
      "2 thessaloniciens": [
          "couronne",
          "trompette",
          "avertissement"
      ],
      "thessaloniciens": [
          "trompette",
          "couronne",
          "etoile"
      ],
      "1thess": [
          "trompette",
          "couronne",
          "etoile"
      ],
      "2thess": [
          "couronne",
          "trompette"
      ],
      "1 timothee": [
          "berger",
          "epee",
          "parchemin",
          "couronne"
      ],
      "2 timothee": [
          "epee",
          "couronne",
          "parchemin",
          "flamme"
      ],
      "timothee": [
          "berger",
          "epee",
          "parchemin"
      ],
      "1tim": [
          "berger",
          "epee"
      ],
      "2tim": [
          "epee",
          "couronne"
      ],
      "tite": [
          "berger",
          "temple",
          "ancre",
          "plume"
      ],
      "tit": [
          "berger",
          "temple"
      ],
      "philemon": [
          "chaines-brisees",
          "coeur",
          "fraternite",
          "croix"
      ],
      "phm": [
          "chaines-brisees",
          "coeur"
      ],
      "hebreux": [
          "ancre",
          "arche-alliance",
          "calice",
          "voile-dechire",
          "croix"
      ],
      "heb": [
          "ancre",
          "arche-alliance",
          "calice",
          "voile-dechire"
      ],
      "jacques": [
          "miroir",
          "balance",
          "arbre",
          "goutte-huile"
      ],
      "jac": [
          "miroir",
          "balance",
          "arbre"
      ],
      "1 pierre": [
          "berger",
          "rocher",
          "bouclier",
          "ancre"
      ],
      "2 pierre": [
          "etoile",
          "avertissement",
          "ancre",
          "parchemin"
      ],
      "pierre": [
          "berger",
          "rocher",
          "bouclier",
          "ancre"
      ],
      "1pi": [
          "berger",
          "rocher"
      ],
      "2pi": [
          "etoile",
          "avertissement"
      ],
      "1 jean": [
          "coeur",
          "lumiere",
          "fraternite",
          "croix"
      ],
      "2 jean": [
          "coeur",
          "bible",
          "porte"
      ],
      "3 jean": [
          "visite",
          "fraternite",
          "coeur"
      ],
      "1jn": [
          "coeur",
          "lumiere",
          "fraternite"
      ],
      "2jn": [
          "coeur",
          "bible"
      ],
      "3jn": [
          "visite",
          "coeur"
      ],
      "jude": [
          "avertissement",
          "epee",
          "etoile",
          "ancre"
      ],
      "jud": [
          "avertissement",
          "epee"
      ],
      "apocalypse": [
          "alpha-omega",
          "agneau",
          "lion-juda",
          "couronne-etoiles",
          "trompette"
      ],
      "apoc": [
          "alpha-omega",
          "agneau",
          "lion-juda",
          "couronne-etoiles"
      ],
      "ancien testament": [
          "bible",
          "tables-loi",
          "arche-alliance",
          "menorah"
      ],
      "nouveau testament": [
          "bible",
          "croix",
          "calice",
          "colombe"
      ],
      "evangile": [
          "croix",
          "bible",
          "lumiere",
          "trompette"
      ],
      "evangiles": [
          "croix",
          "bible",
          "ichtus",
          "pain"
      ],
      "epitre": [
          "parchemin",
          "plume",
          "bible"
      ],
      "epitres": [
          "parchemin",
          "plume",
          "bible"
      ],
      "loi": [
          "tables-loi",
          "balance",
          "parchemin"
      ],
      "torah": [
          "tables-loi",
          "parchemin",
          "arche-alliance"
      ],
      "prophetes": [
          "shofar",
          "trompette",
          "manteau-prophete",
          "flamme"
      ],
      "pentateuque": [
          "tables-loi",
          "buisson-ardent",
          "parchemin"
      ],
      "justification": [
          "balance",
          "croix",
          "vetement-blanc",
          "check"
      ],
      "justice": [
          "balance",
          "cuirasse",
          "bible"
      ],
      "grace": [
          "grace",
          "croix",
          "coeur",
          "calice"
      ],
      "salut": [
          "croix",
          "casque",
          "ancre",
          "calice"
      ],
      "redemption": [
          "croix",
          "chaines-brisees",
          "agneau",
          "calice"
      ],
      "foi": [
          "bouclier",
          "ancre",
          "semence",
          "croix"
      ],
      "esperance": [
          "ancre",
          "etoile",
          "phare",
          "lumiere"
      ],
      "amour": [
          "coeur",
          "croix",
          "fraternite"
      ],
      "agape": [
          "coeur",
          "croix",
          "calice"
      ],
      "charite": [
          "coeur",
          "aumone",
          "visite"
      ],
      "sanctification": [
          "flamme",
          "eau",
          "vetement-blanc",
          "colombe"
      ],
      "saintete": [
          "flamme",
          "colombe",
          "temple",
          "buisson-ardent"
      ],
      "purete": [
          "vetement-blanc",
          "eau",
          "colombe",
          "lys"
      ],
      "resurrection": [
          "tombeau",
          "lumiere",
          "couronne",
          "arbre"
      ],
      "vie eternelle": [
          "arbre",
          "couronne",
          "eau",
          "alpha-omega"
      ],
      "trinite": [
          "trinite",
          "colombe",
          "couronne"
      ],
      "dieu le pere": [
          "couronne",
          "ciel-ouvert",
          "temple"
      ],
      "jesus": [
          "croix",
          "agneau",
          "lion-juda",
          "berger"
      ],
      "christ": [
          "croix",
          "couronne",
          "agneau",
          "calice"
      ],
      "saint-esprit": [
          "colombe",
          "flamme",
          "eau",
          "goutte-huile"
      ],
      "esprit": [
          "colombe",
          "flamme",
          "eau"
      ],
      "pentecote": [
          "flamme",
          "colombe",
          "trompette",
          "langues"
      ],
      "alliance": [
          "alliance",
          "arc-en-ciel",
          "arche-alliance",
          "calice"
      ],
      "pardon": [
          "colombe",
          "croix",
          "coeur",
          "chaines-brisees"
      ],
      "reconciliation": [
          "colombe",
          "coeur",
          "alliance",
          "croix"
      ],
      "expiation": [
          "agneau",
          "autel",
          "croix",
          "calice"
      ],
      "sacrifice": [
          "agneau",
          "autel",
          "croix",
          "calice"
      ],
      "communion": [
          "calice",
          "pain",
          "fraternite",
          "alliance"
      ],
      "cene": [
          "calice",
          "pain",
          "croix",
          "alliance"
      ],
      "sainte cene": [
          "calice",
          "pain",
          "croix"
      ],
      "bapteme": [
          "eau",
          "colombe",
          "croix",
          "tombeau"
      ],
      "nouvelle naissance": [
          "eau",
          "colombe",
          "arbre",
          "lumiere"
      ],
      "creation": [
          "lumiere",
          "arbre",
          "eau",
          "etoile"
      ],
      "incarnation": [
          "etoile",
          "coeur",
          "croix"
      ],
      "ascension": [
          "ciel-ouvert",
          "colonne-nuee",
          "couronne"
      ],
      "retour de christ": [
          "trompette",
          "couronne",
          "etoile",
          "alpha-omega"
      ],
      "parousie": [
          "trompette",
          "couronne-etoiles",
          "ciel-ouvert"
      ],
      "jugement": [
          "balance",
          "couronne",
          "avertissement"
      ],
      "priere": [
          "priere",
          "encens",
          "recueillement",
          "coeur"
      ],
      "intercession": [
          "priere",
          "encens",
          "bouclier"
      ],
      "adoration": [
          "priere",
          "harpe",
          "autel",
          "genou"
      ],
      "louange": [
          "harpe",
          "trompette",
          "choeur",
          "priere"
      ],
      "culte": [
          "temple",
          "harpe",
          "cloche",
          "autel"
      ],
      "jeune": [
          "recueillement",
          "priere",
          "genou"
      ],
      "meditation": [
          "recueillement",
          "parchemin",
          "bible",
          "miroir"
      ],
      "sabbat": [
          "repos-sabbat",
          "temple",
          "colombe-rameau"
      ],
      "repos": [
          "repos-sabbat",
          "eau",
          "arbre"
      ],
      "paix": [
          "colombe-rameau",
          "colombe",
          "repos-sabbat",
          "arc-en-ciel"
      ],
      "joie": [
          "harpe",
          "etoile",
          "couronne",
          "choeur"
      ],
      "benediction": [
          "benediction",
          "goutte-huile",
          "grace"
      ],
      "onction": [
          "corne-onction",
          "goutte-huile",
          "flamme",
          "colombe"
      ],
      "guerison": [
          "goutte-huile",
          "puits",
          "serpent-airain"
      ],
      "humilite": [
          "genou",
          "sandales",
          "joug"
      ],
      "obeissance": [
          "joug",
          "chemin",
          "tables-loi"
      ],
      "fidelite": [
          "ancre",
          "alliance",
          "bouclier",
          "check"
      ],
      "zele": [
          "flamme",
          "sandales",
          "cible"
      ],
      "combat": [
          "epee",
          "bouclier",
          "casque",
          "cuirasse"
      ],
      "combat spirituel": [
          "epee",
          "bouclier",
          "casque",
          "cuirasse"
      ],
      "armure": [
          "bouclier",
          "epee",
          "casque",
          "cuirasse",
          "ceinture"
      ],
      "victoire": [
          "couronne",
          "couronne-etoiles",
          "epee",
          "check"
      ],
      "triomphe": [
          "couronne",
          "trompette",
          "lion-juda"
      ],
      "delivrance": [
          "chaines-brisees",
          "croix",
          "bouclier"
      ],
      "liberte": [
          "chaines-brisees",
          "colombe",
          "croix"
      ],
      "protection": [
          "bouclier",
          "rocher",
          "phare",
          "temple"
      ],
      "refuge": [
          "rocher",
          "bouclier",
          "temple",
          "ancre"
      ],
      "mission": [
          "globe",
          "porte",
          "sandales",
          "trompette"
      ],
      "evangelisation": [
          "trompette",
          "globe",
          "porte",
          "filet",
          "semence"
      ],
      "temoignage": [
          "lumiere",
          "phare",
          "sel",
          "trompette"
      ],
      "predication": [
          "trompette",
          "bible",
          "livre-ouvert",
          "plume"
      ],
      "sermon": [
          "dossier",
          "livre-ouvert",
          "bible",
          "trompette"
      ],
      "disciple": [
          "joug",
          "sandales",
          "chemin",
          "berger"
      ],
      "discipulat": [
          "joug",
          "sandales",
          "chemin",
          "livre-ouvert"
      ],
      "marche": [
          "chemin",
          "sandales",
          "montagne",
          "boussole"
      ],
      "chemin": [
          "chemin",
          "lumiere",
          "boussole"
      ],
      "etude": [
          "livre-ouvert",
          "loupe",
          "parchemin",
          "cle"
      ],
      "exegese": [
          "loupe",
          "cle",
          "langues",
          "arbre-racine"
      ],
      "hermeneutique": [
          "cle",
          "boussole",
          "miroir",
          "loupe"
      ],
      "analyse": [
          "loupe",
          "cle",
          "comparaison"
      ],
      "recherche": [
          "loupe",
          "livre-ouvert",
          "dossier"
      ],
      "contexte": [
          "boussole",
          "comparaison",
          "parchemin"
      ],
      "theologie": [
          "bible",
          "cle",
          "codex",
          "croix"
      ],
      "doctrine": [
          "bouclier",
          "balance",
          "ancre",
          "tables-loi"
      ],
      "redaction": [
          "plume",
          "parchemin",
          "livre-ouvert"
      ],
      "ecriture": [
          "plume",
          "bible",
          "parchemin"
      ],
      "verset": [
          "citations",
          "marque-page",
          "bible"
      ],
      "citation": [
          "citations",
          "marque-page"
      ],
      "parallèle": [
          "comparaison",
          "livre-ouvert"
      ],
      "synoptique": [
          "comparaison",
          "bible"
      ],
      "etymologie": [
          "arbre-racine",
          "langues",
          "cle"
      ],
      "grec": [
          "langues",
          "parchemin",
          "bible"
      ],
      "hebreu": [
          "langues",
          "parchemin",
          "tables-loi"
      ],
      "canon": [
          "sceau",
          "bible",
          "parchemin"
      ],
      "inspiration": [
          "ampoule",
          "colombe",
          "plume",
          "flamme"
      ],
      "revelation": [
          "ampoule",
          "ciel-ouvert",
          "lumiere"
      ],
      "eglise": [
          "temple",
          "berger",
          "croix",
          "fraternite"
      ],
      "assemblee": [
          "temple",
          "fraternite",
          "choeur"
      ],
      "communaute": [
          "fraternite",
          "temple",
          "famille",
          "pain"
      ],
      "fraternite": [
          "fraternite",
          "coeur",
          "visite"
      ],
      "koinonia": [
          "fraternite",
          "calice",
          "pain"
      ],
      "pasteur": [
          "berger",
          "bible",
          "visite",
          "temple"
      ],
      "berger": [
          "berger",
          "coeur",
          "chemin"
      ],
      "brebis": [
          "berger",
          "coeur"
      ],
      "ancien": [
          "berger",
          "cle",
          "visite"
      ],
      "diacre": [
          "aumone",
          "pain",
          "visite"
      ],
      "diaconie": [
          "aumone",
          "visite",
          "coeur"
      ],
      "famille": [
          "famille",
          "visite",
          "coeur"
      ],
      "foyer": [
          "famille",
          "visite",
          "coeur"
      ],
      "mariage": [
          "alliance",
          "coeur",
          "famille"
      ],
      "hospitalite": [
          "visite",
          "porte",
          "pain"
      ],
      "pauvres": [
          "aumone",
          "coeur",
          "pain"
      ],
      "entraide": [
          "aumone",
          "fraternite",
          "visite"
      ],
      "pain de vie": [
          "pain",
          "calice",
          "croix"
      ],
      "eau vive": [
          "eau",
          "puits",
          "goutte-huile"
      ],
      "lumiere du monde": [
          "lumiere",
          "phare",
          "lampe-huile"
      ],
      "sel de la terre": [
          "sel",
          "lumiere",
          "trompette"
      ],
      "vigne": [
          "vigne",
          "calice",
          "arbre"
      ],
      "sarments": [
          "vigne",
          "arbre",
          "semence"
      ],
      "olivier": [
          "olivier",
          "colombe-rameau",
          "goutte-huile"
      ],
      "figuier": [
          "figuier",
          "arbre",
          "semence"
      ],
      "ble": [
          "ble",
          "chariot-ble",
          "pain"
      ],
      "moisson": [
          "ble",
          "chariot-ble",
          "filet"
      ],
      "seneve": [
          "semence",
          "arbre",
          "bouclier"
      ],
      "graine": [
          "semence",
          "arbre",
          "ble"
      ],
      "lys": [
          "lys",
          "vetement-blanc",
          "grace"
      ],
      "perle": [
          "perle",
          "coffre",
          "couronne"
      ],
      "tresor": [
          "coffre",
          "perle",
          "couronne"
      ],
      "aigle": [
          "aigle",
          "ciel-ouvert",
          "montagne"
      ],
      "lion": [
          "lion-juda",
          "couronne",
          "montagne"
      ],
      "agneau": [
          "agneau",
          "croix",
          "autel"
      ],
      "bergerie": [
          "berger",
          "temple",
          "porte"
      ],
      "porte etroite": [
          "porte",
          "chemin",
          "cle"
      ],
      "rocher": [
          "rocher",
          "ancre",
          "temple"
      ],
      "tempete": [
          "arc-orage",
          "ancre",
          "phare"
      ],
      "arc-en-ciel": [
          "arc-en-ciel",
          "alliance",
          "ancre"
      ],
      "shofar": [
          "shofar",
          "trompette",
          "corne-onction"
      ],
      "epines": [
          "couronne-epines",
          "croix",
          "calice"
      ],
      "manne": [
          "manne",
          "pain",
          "colonne-nuee"
      ],
      "tabernacle": [
          "tente",
          "arche-alliance",
          "menorah"
      ],
      "voile": [
          "voile-dechire",
          "temple",
          "ciel-ouvert"
      ],
      "cite": [
          "cite",
          "tour",
          "temple"
      ],
      "cité": [
          "cite",
          "tour",
          "temple"
      ],
      "ville": [
          "cite",
          "temple",
          "tour"
      ],
      "village": [
          "village",
          "cite",
          "famille"
      ],
      "campagne": [
          "village",
          "arbre",
          "semence"
      ],
      "jerusalem": [
          "cite",
          "temple",
          "montagne"
      ],
      "sion": [
          "cite",
          "montagne",
          "temple"
      ],
      "citadelle": [
          "tour",
          "cite",
          "bouclier"
      ],
      "forteresse": [
          "tour",
          "bouclier",
          "rocher"
      ],
      "rempart": [
          "tour",
          "cite",
          "bouclier"
      ],
      "murailles": [
          "cite",
          "tour",
          "bouclier"
      ],
      "tour": [
          "tour",
          "phare",
          "bouclier"
      ],
      "tour forte": [
          "tour",
          "bouclier",
          "rocher"
      ]
  },

  normalizeText(str = '') {
    return String(str || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  },

  escapeHtml(str = '') {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },

  /**
   * Moteur de suggestions automatiques d'icônes SVG (100% local, sans LLM)
   * Analyse le texte, pondère les correspondances sémantiques et retourne
   * les meilleures icônes par ordre de pertinence.
   */
  suggestIconsForText(text = '', maxResults = 4) {
    if (!text) return [];
    this._initMap();

    const normalized = this.normalizeText(text);
    if (!normalized) return [];

    const scores = new Map(); // iconId -> score

    const addScore = (iconId, pts) => {
      const id = String(iconId).toLowerCase();
      if (!this.has(id)) return;
      scores.set(id, (scores.get(id) || 0) + pts);
    };

    // 1. Correspondance directe sur la phrase complète
    if (this.THESAURUS[normalized]) {
      this.THESAURUS[normalized].forEach((id, idx) => addScore(id, 28 - idx * 3));
    }

    // 2. Découpage en mots signifiants
    const stopWords = new Set([
      'de', 'la', 'le', 'les', 'des', 'un', 'une', 'du', 'et', 'en', 'dans', 'sur', 'par',
      'pour', 'avec', 'aux', 'au', 'ce', 'cet', 'cette', 'ces', 'mon', 'ton', 'son', 'notre',
      'votre', 'leur', 'qui', 'que', 'quoi', 'est', 'sont', 'a', 'ont', 'd', 'l', 'qu', 'ses'
    ]);
    const words = normalized.split(/\s+/).filter(w => w.length >= 2 && !stopWords.has(w));

    words.forEach(word => {
      // 2a. Match direct dans le thésaurus
      if (this.THESAURUS[word]) {
        this.THESAURUS[word].forEach((id, idx) => addScore(id, 20 - idx * 2));
      }

      // 2b. Match partiel / préfixe dans le thésaurus (mot >= 4 caractères)
      if (word.length >= 4) {
        for (const [key, iconIds] of Object.entries(this.THESAURUS)) {
          if (key !== word && (key.startsWith(word) || (key.length >= 4 && word.startsWith(key)))) {
            iconIds.forEach((id, idx) => addScore(id, 12 - idx));
          }
        }
      }

      // 2c. Match avec les métadonnées intrinsèques des icônes
      this.icons.forEach(ic => {
        const icNormId = this.normalizeText(ic.id);
        const icNormLabel = this.normalizeText(ic.label);
        const labelWords = icNormLabel.split(/\s+/);

        if (icNormId === word) {
          addScore(ic.id, 24);
        } else if (labelWords.includes(word)) {
          addScore(ic.id, 16);
        } else if (word.length >= 4 && labelWords.some(lw => lw.startsWith(word))) {
          addScore(ic.id, 10);
        }

        ic.keywords.forEach(kw => {
          const normKw = this.normalizeText(kw);
          const kwWords = normKw.split(/\s+/);
          if (kwWords.includes(word)) {
            addScore(ic.id, 16);
          } else if (word.length >= 4 && kwWords.some(kwToken => kwToken.startsWith(word))) {
            addScore(ic.id, 8);
          }
        });
      });
    });

    // 3. Trier par score décroissant et dédupliquer
    const sorted = Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .map(entry => this.get(entry[0]))
      .filter(Boolean);

    return sorted.slice(0, maxResults);
  },

  // Cache des icônes par identifiant pour recherche O(1)
  _map: null,

  _initMap() {
    if (!this._map) {
      this._map = new Map();
      this.icons.forEach(ic => {
        this._map.set(ic.id.toLowerCase(), ic);
      });
    }
  },

  has(id) {
    if (!id) return false;
    this._initMap();
    return this._map.has(String(id).toLowerCase());
  },

  get(id) {
    if (!id) return null;
    this._initMap();
    return this._map.get(String(id).toLowerCase()) || null;
  },

  search(query = '') {
    const q = String(query || '').trim();
    if (!q) return this.icons;
    const normQ = this.normalizeText(q);
    if (!normQ) return this.icons;

    const matches = [];
    this.icons.forEach(ic => {
      const normId = this.normalizeText(ic.id);
      const normLabel = this.normalizeText(ic.label);
      const labelWords = normLabel.split(/\s+/);
      const normKws = ic.keywords.map(k => this.normalizeText(k));

      let score = 0;
      if (normId === normQ) score += 50;
      else if (normId.startsWith(normQ)) score += 30;
      else if (normId.includes(normQ)) score += 10;

      if (labelWords.includes(normQ)) score += 40;
      else if (labelWords.some(w => w.startsWith(normQ))) score += 25;
      else if (normLabel.includes(normQ)) score += 12;

      if (normKws.includes(normQ)) score += 35;
      else if (normKws.some(k => k.startsWith(normQ))) score += 20;
      else if (normKws.some(k => k.includes(normQ))) score += 5;

      const normCat = this.normalizeText(ic.category);
      if (normCat.includes(normQ)) score += 8;

      if (score > 0) {
        matches.push({ ic, score });
      }
    });

    matches.sort((a, b) => b.score - a.score);
    return matches.map(m => m.ic);
  },

  /**
   * Retourne la balise SVG complète (pure, sans emoji, stroke=currentColor)
   */
  getSvg(id, size = 16, extraClasses = '') {
    const icon = this.get(id);
    if (!icon) return '';
    const cls = extraClasses ? ` ${extraClasses}` : '';
    return `<svg class="noble-svg-icon${cls}" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icon.path}</svg>`;
  },

  /**
   * Retourne le fragment HTML inline pour l'éditeur de notes
   */
  renderInlineHtml(id) {
    const icon = this.get(id);
    if (!icon) return '';
    return `<span class="note-svg-icon" data-icon="${icon.id}" contenteditable="false" title="${icon.label}">${this.getSvg(icon.id, 16)}</span>`;
  },

  // =========================================================================
  // PALETTE MODALE COMMUNE (MIND MAP & NOTES)
  // Support total Clavier (Flèches, Entrée, Échap) & Souris (Clic, Défilement)
  // =========================================================================

  activeModal: null,
  activeCallback: null,
  selectedIndex: 0,
  filteredIcons: [],

  openPicker({ anchorRect = null, title = 'Choisir une icône SVG', currentText = '', currentValue = null, onSelect = null, onRemove = null }) {
    this.closePicker();
    this.activeCallback = onSelect;

    const suggestions = currentText ? this.suggestIconsForText(currentText, 4) : [];
    const hasSuggestions = suggestions.length > 0;

    const modal = document.createElement('div');
    modal.id = 'universal-svg-icon-picker';
    modal.className = 'svg-picker-popover';

    const hasRemove = typeof onRemove === 'function' && currentValue;

    modal.innerHTML = `
      <div class="svg-picker-header">
        <div class="svg-picker-title">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m10 15 5-3-5-3v6Z"/></svg>
          <span>${title}</span>
        </div>
        <button type="button" class="svg-picker-close-btn" title="Fermer (Échap)">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="svg-picker-search-bar">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="text" id="svg-picker-input" placeholder="Rechercher : croix, bible, feu, coeur..." autocomplete="off" spellcheck="false" />
        <span class="svg-picker-hint"><kbd>↑</kbd><kbd>↓</kbd> Naviguer <kbd>↵</kbd> Choisir</span>
      </div>
      ${hasSuggestions ? `
        <div class="svg-picker-suggestions-section" id="svg-picker-suggestions">
          <div class="svg-picker-suggestions-header">
            <span class="svg-picker-suggestions-badge">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3Z"/><path d="M5 3v4"/><path d="M19 17v4"/></svg>
              Suggestions pour « ${this.escapeHtml(currentText)} »
            </span>
          </div>
          <div class="svg-picker-suggestions-chips">
            ${suggestions.map(ic => `
              <button type="button" class="svg-picker-suggestion-chip" data-id="${ic.id}" title="${this.escapeHtml(ic.label)} (${this.escapeHtml(ic.category)})">
                <div class="svg-picker-suggestion-chip-icon">${this.getSvg(ic.id, 16)}</div>
                <span class="svg-picker-suggestion-chip-label">${this.escapeHtml(ic.label)}</span>
              </button>
            `).join('')}
          </div>
        </div>
      ` : ''}
      <div class="svg-picker-body" id="svg-picker-results"></div>
      ${hasRemove ? `
        <div class="svg-picker-footer">
          <button type="button" class="svg-picker-remove-btn" id="svg-picker-remove">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            <span>Retirer l'icône</span>
          </button>
        </div>
      ` : ''}
    `;

    document.body.appendChild(modal);
    this.activeModal = modal;

    const input = modal.querySelector('#svg-picker-input');
    const resultsEl = modal.querySelector('#svg-picker-results');
    const closeBtn = modal.querySelector('.svg-picker-close-btn');
    const removeBtn = modal.querySelector('#svg-picker-remove');
    const suggestionsSection = modal.querySelector('#svg-picker-suggestions');

    // Clic sur une suggestion
    if (suggestionsSection) {
      suggestionsSection.querySelectorAll('.svg-picker-suggestion-chip').forEach(chip => {
        chip.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = chip.dataset.id;
          if (id) {
            this.confirmSelection(id);
          }
        });
      });
    }

    // Positionnement intelligent près de l'ancre ou centré
    const isValidAnchor = anchorRect && (
      (anchorRect.width > 0 || anchorRect.height > 0) ||
      (anchorRect.left > 0 || anchorRect.top > 0)
    );

    if (isValidAnchor) {
      const modalW = 390;
      const modalH = hasSuggestions ? 460 : 400;
      const vpW = window.innerWidth;
      const vpH = window.innerHeight;

      const aLeft = anchorRect.left || 0;
      const aWidth = anchorRect.width || 0;
      const aTop = anchorRect.top || 0;
      const aBottom = (anchorRect.bottom !== undefined) ? anchorRect.bottom : (aTop + (anchorRect.height || 0));

      let left = aLeft + (aWidth / 2) - (modalW / 2);
      if (left + modalW > vpW - 16) left = vpW - modalW - 16;
      if (left < 16) left = 16;

      let top = aBottom + 8;
      if (top + modalH > vpH - 16) {
        top = Math.max(16, aTop - modalH - 8);
      }

      modal.style.left = `${Math.round(left)}px`;
      modal.style.top = `${Math.round(top)}px`;
    } else {
      modal.classList.add('centered');
    }

    const renderResults = (query = '') => {
      const items = this.search(query);
      this.filteredIcons = items;
      this.selectedIndex = 0;

      if (!items.length) {
        resultsEl.innerHTML = `
          <div class="svg-picker-empty">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
            <div>Aucun symbole correspondant</div>
          </div>
        `;
        return;
      }

      // Grouper par catégorie ordonnée
      const categories = {};
      items.forEach(ic => {
        if (!categories[ic.category]) categories[ic.category] = [];
        categories[ic.category].push(ic);
      });

      let html = '';
      let flatIndex = 0;

      for (const [catName, catIcons] of Object.entries(categories)) {
        html += `<div class="svg-picker-category-title">${catName}</div>`;
        html += `<div class="svg-picker-grid">`;
        catIcons.forEach(ic => {
          const isSelected = flatIndex === this.selectedIndex;
          const isCurrent = currentValue && ic.id === currentValue;
          html += `
            <button type="button" class="svg-picker-item ${isSelected ? 'selected' : ''} ${isCurrent ? 'active' : ''}" data-id="${ic.id}" data-index="${flatIndex}" title="${ic.label}">
              <div class="svg-picker-item-icon">${this.getSvg(ic.id, 20)}</div>
              <span class="svg-picker-item-label">${ic.label}</span>
            </button>
          `;
          flatIndex++;
        });
        html += `</div>`;
      }

      resultsEl.innerHTML = html;

      // Écoute des clics souris sur les items
      resultsEl.querySelectorAll('.svg-picker-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = btn.dataset.id;
          this.confirmSelection(id);
        });
      });
    };

    const updateSelectionHighlight = () => {
      resultsEl.querySelectorAll('.svg-picker-item').forEach(btn => {
        const idx = parseInt(btn.dataset.index, 10);
        const isActive = idx === this.selectedIndex;
        btn.classList.toggle('selected', isActive);
        if (isActive) {
          btn.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      });
    };

    renderResults('');

    // Saisie clavier pour recherche (masque les suggestions quand on recherche pour plein écran)
    input?.addEventListener('input', (e) => {
      const q = e.target.value.trim();
      if (suggestionsSection) {
        suggestionsSection.style.display = q ? 'none' : 'block';
      }
      renderResults(q);
    });

    // Navigation clavier fluide
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        this.closePicker();
        return;
      }

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (this.filteredIcons.length > 0) {
          this.selectedIndex = (this.selectedIndex + 1) % this.filteredIcons.length;
          updateSelectionHighlight();
        }
        return;
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (this.filteredIcons.length > 0) {
          this.selectedIndex = (this.selectedIndex - 1 + this.filteredIcons.length) % this.filteredIcons.length;
          updateSelectionHighlight();
        }
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (this.filteredIcons.length > 0) {
          // Saut de 3 colonnes
          this.selectedIndex = Math.min(this.filteredIcons.length - 1, this.selectedIndex + 3);
          updateSelectionHighlight();
        }
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (this.filteredIcons.length > 0) {
          this.selectedIndex = Math.max(0, this.selectedIndex - 3);
          updateSelectionHighlight();
        }
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        if (this.filteredIcons.length > 0 && this.filteredIcons[this.selectedIndex]) {
          this.confirmSelection(this.filteredIcons[this.selectedIndex].id);
        }
        return;
      }
    };

    input?.addEventListener('keydown', handleKeyDown);

    // Clics boutons
    closeBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closePicker();
    });

    removeBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closePicker();
      if (onRemove) onRemove();
    });

    // Fermeture si clic à l'extérieur
    const handleOutsideClick = (e) => {
      if (this.activeModal && !this.activeModal.contains(e.target)) {
        this.closePicker();
      }
    };
    setTimeout(() => {
      window.addEventListener('mousedown', handleOutsideClick);
      this._outsideClickHandler = handleOutsideClick;
    }, 50);

    // Focus automatique
    setTimeout(() => {
      input?.focus();
    }, 30);
  },

  confirmSelection(iconId) {
    const cb = this.activeCallback;
    this.closePicker();
    if (cb) {
      cb(iconId);
    }
  },

  closePicker() {
    if (this._outsideClickHandler) {
      window.removeEventListener('mousedown', this._outsideClickHandler);
      this._outsideClickHandler = null;
    }
    if (this.activeModal) {
      this.activeModal.remove();
      this.activeModal = null;
    }
    this.activeCallback = null;
  }
};

if (typeof window !== 'undefined') {
  window.SvgIconsRegistry = SvgIconsRegistry;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SvgIconsRegistry;
}
