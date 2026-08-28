/**
 * Settings View Controller
 * Gère les sous-onglets de réglages, la sauvegarde, les clés API, STEPBible et le backup ZIP.
 */

const SettingsView = {
  config: {},
  dictionaries: [],
  discoveredGeminiModels: [],
  ALL_MODELS_CATALOG: [
    // Google Gemini
    { id: 'gemini-2.5-flash', name: 'Google Gemini 2.5 Flash', desc: 'Recommandé — Équilibré & excellent raisonnement', provider: 'google' },
    { id: 'gemini-2.5-pro', name: 'Google Gemini 2.5 Pro', desc: 'Haute précision & profondeur exégétique', provider: 'google' },
    { id: 'gemini-2.0-flash', name: 'Google Gemini 2.0 Flash', desc: 'Génération standard rapide & stable', provider: 'google' },
    { id: 'gemini-2.0-flash-lite', name: 'Google Gemini 2.0 Flash Lite', desc: 'Ultra-rapide, économique pour titres & tags', provider: 'google' },
    { id: 'gemini-1.5-flash', name: 'Google Gemini 1.5 Flash', desc: 'Modèle rapide stable (1M tokens)', provider: 'google' },
    { id: 'gemini-1.5-pro', name: 'Google Gemini 1.5 Pro', desc: 'Grand contexte (2M tokens)', provider: 'google' },
    { id: 'gemini-1.5-flash-8b', name: 'Google Gemini 1.5 Flash 8B', desc: 'Modèle léger haute cadence', provider: 'google' },

    // Mistral AI
    { id: 'mistral-large-latest', name: 'Mistral Large', desc: 'Raisonnement approfondi & style souverain', provider: 'mistral' },
    { id: 'mistral-small-latest', name: 'Mistral Small', desc: 'Rapide, équilibré & concis', provider: 'mistral' },
    { id: 'open-mistral-nemo', name: 'Mistral Nemo (12B)', desc: 'Polyvalent & efficace', provider: 'mistral' },
    { id: 'codestral-latest', name: 'Mistral Codestral', desc: 'Structuration stricte & logique', provider: 'mistral' },

    // Infomaniak Swiss AI
    { id: 'mistralai/Ministral-3-14B-Instruct-2512', name: 'Infomaniak Ministral 14B', desc: 'Hébergement souverain suisse', provider: 'infomaniak' },
    { id: 'mistralai/Mistral-Small-4-119B-2603', name: 'Infomaniak Mistral 119B', desc: 'Modèle lourd haute capacité', provider: 'infomaniak' },
    { id: 'Qwen/Qwen3.5-397B-A17B-FP8', name: 'Infomaniak Qwen 3.5 397B', desc: 'Grand modèle polyglotte', provider: 'infomaniak' },
    { id: 'Qwen/Qwen3.5-122B-A10B-FP8', name: 'Infomaniak Qwen 3.5 122B', desc: 'Haute performance contextuelle', provider: 'infomaniak' },
    { id: 'swiss-ai/Apertus-v1.5-70B', name: 'Infomaniak Apertus 70B', desc: 'Modèle suisse open-weights', provider: 'infomaniak' },
    { id: 'google/gemma-4-31B-it', name: 'Infomaniak Gemma 31B', desc: 'Modèle compact Google hébergé en Suisse', provider: 'infomaniak' },
    { id: 'moonshotai/Kimi-K2.6', name: 'Infomaniak Kimi K2.6', desc: 'Grand modèle de raisonnement', provider: 'infomaniak' },
    { id: 'nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B-FP8', name: 'Infomaniak Nemotron 30B', desc: 'Optimisé inférence rapide', provider: 'infomaniak' }
  ],

  init() {
    this.bindTabs();
    this.bindSliders();
    this.bindActions();
    this.loadData();
  },

  bindTabs() {
    document.querySelectorAll('.settings-tab').forEach(tabBtn => {
      tabBtn.addEventListener('click', () => {
        const secId = tabBtn.dataset.sec;
        this.switchToSection(secId);
      });
    });

    const bar = document.getElementById('settings-nav-tabs-bar');
    const btnLeft = document.getElementById('btn-scroll-settings-tabs-left');
    const btnRight = document.getElementById('btn-scroll-settings-tabs-right');

    btnLeft?.addEventListener('click', () => {
      bar?.scrollBy({ left: -160, behavior: 'smooth' });
    });
    btnRight?.addEventListener('click', () => {
      bar?.scrollBy({ left: 160, behavior: 'smooth' });
    });
    bar?.addEventListener('scroll', () => {
      this.updateTabsScrollButtons();
    });

    window.addEventListener('resize', () => {
      this.updateTabsScrollButtons();
    });

    // Bouton de déclenchement synchro dans l'onglet paramètres Articles
    document.getElementById('btn-settings-trigger-sync')?.addEventListener('click', async () => {
      if (typeof ArticlesView !== 'undefined' && ArticlesView.syncArticles) {
        await ArticlesView.syncArticles(false);
        this.updateArticlesLastSyncLabel();
      }
    });

    setTimeout(() => this.updateTabsScrollButtons(), 200);
  },

  updateTabsScrollButtons() {
    const bar = document.getElementById('settings-nav-tabs-bar');
    const btnLeft = document.getElementById('btn-scroll-settings-tabs-left');
    const btnRight = document.getElementById('btn-scroll-settings-tabs-right');
    if (!bar || !btnLeft || !btnRight) return;

    const hasOverflow = bar.scrollWidth > bar.clientWidth + 4;
    if (!hasOverflow) {
      btnLeft.classList.add('hidden');
      btnRight.classList.add('hidden');
      return;
    }

    const atStart = bar.scrollLeft <= 6;
    const atEnd = bar.scrollLeft + bar.clientWidth >= bar.scrollWidth - 6;

    btnLeft.classList.toggle('hidden', atStart);
    btnRight.classList.toggle('hidden', atEnd);
  },

  updateArticlesLastSyncLabel() {
    const lbl = document.getElementById('settings-articles-last-sync-label');
    if (!lbl) return;
    const syncOpts = (typeof ArticlesView !== 'undefined' && ArticlesView.syncOpts) || null;
    if (!syncOpts || !syncOpts.lastSyncTimestamp) {
      lbl.textContent = 'Jamais synchronisé';
      return;
    }
    const d = new Date(syncOpts.lastSyncTimestamp);
    const day = String(d.getDate()).padStart(2, '0');
    const monthNames = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
    const month = monthNames[d.getMonth()];
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    lbl.textContent = `${day} ${month} ${year} à ${hours}:${mins}`;
  },

  switchToSection(secId, scrollTargetId = null) {
    document.querySelectorAll('.settings-tab').forEach(b => {
      b.classList.toggle('active', b.dataset.sec === secId);
    });
    document.querySelectorAll('.settings-section').forEach(s => {
      s.classList.toggle('active', s.id === `sec-${secId}`);
    });

    const activeTab = document.querySelector(`.settings-tab[data-sec="${secId}"]`);
    if (activeTab && activeTab.scrollIntoView) {
      activeTab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
    this.updateTabsScrollButtons();

    if (secId === 'articles') {
      this.updateArticlesLastSyncLabel();
    }

    if (scrollTargetId) {
      setTimeout(() => {
        const el = document.getElementById(scrollTargetId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.style.transition = 'box-shadow 0.3s ease, border-color 0.3s ease';
          el.style.borderColor = 'var(--accent-primary, #3b82f6)';
          el.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.4)';
          setTimeout(() => {
            el.style.boxShadow = '';
            el.style.borderColor = '';
          }, 1800);
        }
      }, 120);
    }
  },

  bindSliders() {
    const fontSizeSlider = document.getElementById('cfg-font-size');
    const fontSizeLbl = document.getElementById('lbl-font-size-val');
    fontSizeSlider.addEventListener('input', (e) => {
      fontSizeLbl.textContent = `${e.target.value} pt`;
      document.documentElement.style.setProperty('--bible-font-size-base', `${e.target.value}px`);
      const ws = document.getElementById('reader-workspace');
      if (ws) ws.style.setProperty('--bible-font-size-base', `${e.target.value}px`);
    });

    const lineSpacingSlider = document.getElementById('cfg-line-spacing');
    const lineSpacingLbl = document.getElementById('lbl-line-spacing-val');
    lineSpacingSlider.addEventListener('input', (e) => {
      lineSpacingLbl.textContent = `${e.target.value} px`;
    });

    const maxOrigSlider = document.getElementById('cfg-max-orig-verses');
    const maxOrigLbl = document.getElementById('lbl-max-orig-val');
    maxOrigSlider.addEventListener('input', (e) => {
      maxOrigLbl.textContent = `${e.target.value} vers.`;
    });

    const notifyVolSlider = document.getElementById('cfg-notify-ai-volume');
    const notifyVolLbl = document.getElementById('lbl-notify-ai-volume');
    notifyVolSlider?.addEventListener('input', (e) => {
      if (notifyVolLbl) notifyVolLbl.textContent = `${e.target.value}%`;
      if (typeof NotificationManager !== 'undefined') {
        NotificationManager.updateSettings({ volume: parseInt(e.target.value, 10) / 100 });
      }
    });
  },

  DEFAULT_SYNTH_PROMPT: `Vous êtes un éminent professeur de théologie et un exégète biblique chevronné.
Votre mission est de rédiger une SYNTHÈSE EXÉGÉTIQUE COMPARATIVE d'excellence à partir des extraits de commentaires fournis.

RÈGLES CRITIQUES DE RÉDACTION :
1. LANGUE : Rédigez TOUJOURS l'intégralité de la synthèse en FRANÇAIS impeccable, fluide et naturel, même si les commentaires ou sources fournis sont rédigés en anglais, en allemand ou dans une autre langue.
2. MENTION DES AUTEURS DANS LE TEXTE : Citez les auteurs naturellement en GRAS dans vos phrases (ex: « selon **Jean Calvin** », « **Matthew Henry** souligne que... », « **Albert Barnes** et **Scofield** précisent... »). NE METTEZ JAMAIS DE CROCHETS autour des noms d'auteurs.
3. CITATIONS DES SOURCES EN FIN D'AFFIRMATION : À la fin des points de doctrine ou des paragraphes de consensus, indiquez la ou les sources sous la forme \`{sources: NomAuteur1, NomAuteur2}\` (ex: \`{sources: Jean Calvin, Pulpit, Bible du sermon}\`).
4. FIDÉLITÉ STRICTE AUX SOURCES FOURNIES (ZÉRO HALLUCINATION) :
   - Basez votre analyse EXCLUSIVEMENT sur les extraits de commentaires fournis ci-dessous et sur le verset biblique affiché. N'inventez aucun commentaire, ne citez aucune source extérieure non fournie.
   - Si une source de la liste est une note d'étude (ex: « Notes d'étude Segond 21 » ou « Commentaire de la Bible d'étude de Genève »), citez-la expressément comme une note exégétique/d'étude et ne la confondez pas avec le texte biblique principal.
   - Ne comparez pas d'autres versions ou traductions bibliques non fournies : concentrez-vous à 100% sur l'exégèse comparative des commentaires théologiques fournis.
5. STRUCTURE IMPÉRATIVE (Markdown) :
   - ## 1. Consensus Exégétique & Thèmes Communs (Ce sur quoi les exégètes s'accordent, doctrine principale, sens direct du texte)
   - ## 2. Nuances, Divergences & Perspectives Particulières (Comparaison des points de vue, différences d'accentuation : typologie, dispensation, réformée, historique, analyse des mots originaux hébreux/grecs)
   - ## 3. Clés Textuelles & Applications Pastorales (Enseignements théologiques majeurs, implications pratiques et spirituelles pour la vie chrétienne)
   - ## 4. Synthèse des Sources Étudiées (Liste avec chaque auteur en gras suivi de deux-points et de son apport unique, ex: \`* **Jean Calvin** : Démontre la création ex nihilo...\`)`,

  DEFAULT_TRANS_PROMPT: `Vous êtes un traducteur exégétique et théologique de haute précision.
Votre mission est de traduire fidèlement, intégralement et précisément le texte biblique, commentaire ou notice de dictionnaire fourni vers le français.

RÈGLES STRICTES :
1. FIDÉLITÉ ABSOLUE : Traduisez l'intégralité du texte sans rien omettre, sans résumer, et sans inventer ni ajouter d'informations non présentes dans le texte original.
2. TERMINOLOGIE THÉOLOGIQUE : Respectez la terminologie biblique et théologique francophone établie.
3. FORMAT : Conservez la mise en forme originale (paragraphes, puces, références bibliques, codes Strong, termes hébreux/grecs).
4. NE JAMAIS dialoguer ni ajouter de préambule : Renvoyez UNIQUEMENT le texte traduit en français.`,

  DEFAULT_SUMMARY_PROMPT: `Tu es un professeur de théologie et un pédagogue chrétien chevronné.
Ton rôle est de produire un résumé synthétique, structuré, clair et fidèle du chapitre ou de l'ouvrage théologique fourni.

Directives de rédaction :
1. THÈSE & AXES PRINCIPAUX : Dégage la thèse centrale de l'auteur et les 3 à 5 idées maîtresses développées dans le texte.
2. ARGUMENTATION THÉOLOGIQUE : Explique avec rigueur les arguments doctrinaux et exégétiques clés avancés.
3. CITATIONS & ANCRAGE BIBLIQUE : Mentionne les références scripturaires majeures citées dans le chapitre.
4. FORMAT ET CLARTÉ : Structure le résumé avec des intertitres en gras, des puces synthétiques et une conclusion théologique en une phrase.
5. CONCISION : Respecte scrupuleusement la longueur cible demandée. Reste direct, sans préambule superflu.`,

  DEFAULT_NOTE_TITLE_PROMPT: `Tu es un assistant éditorial et théologique de haute précision.
Ta mission est de générer un titre court, élégant et précis (entre 3 et 7 mots maximum, en français) qui résume parfaitement l'idée maîtresse ou le sujet de la note fournie.

Règles impératives :
1. Renvoie UNIQUEMENT le titre, sans guillemets, sans point final, sans aucun préambule (ex: ne pas écrire "Titre :").
2. Capture l'essence théologique, spirituelle ou thématique du texte.`,

  DEFAULT_NOTE_TAGS_PROMPT: `Tu es un indexeur documentaire et théologique chevronné.
Ta mission est d'extraire entre 3 et 6 mots-clés ou tags thématiques pertinents pour la note fournie.

Règles impératives :
1. Renvoie UNIQUEMENT les tags séparés par des virgules (ex: Grâce, Sanctification, Romains, Vie chrétienne).
2. Privilégie les thèmes doctrinaux, les personnages, les livres bibliques ou les notions pratiques abordés.
3. N'inclus aucun préambule, ni puce, ni dièse (#).`,

  DEFAULT_PROMPT_EXEGESIS: `MODE D'ÉTUDE : EXÉGÈSE APPROFONDIE
- Analyse structurelle et théologique verset par verset (syntaxe, intertextualité, cohérence canonique).
- Fonde ton analyse sur les langues originales et la comparaison des versions bibliques.
- Rigueur académique, précision des termes et citations exégétiques fidèles.`,

  DEFAULT_PROMPT_HISTORICAL: `MODE D'ÉTUDE : CONTEXTE HISTORIQUE & CULTUREL
- Établis l'arrière-plan de rédaction, la datation, l'auteur et les destinataires du texte.
- Analyse le cadre socio-politique, géopolitique et religieux antique (monde gréco-romain, judaïsme du Second Temple : Pharisiens, Sadducéens, Zélotes, Esséniens).
- Mobilise les sources archéologiques et historiques issues du corpus documentaire.`,

  DEFAULT_PROMPT_SERMON: `MODE D'ÉTUDE : PRÉPARATION DE PRÉDICATION / HOMILÉTIQUE TEXTUELLE & EXPOSITIVE
Tu es un assistant IA expert en théologie biblique et homilétique, spécialisé dans la prédication textuelle (expositive) fidèle aux Écritures (méthode de David Helm, Haddon Robinson, Bryan Chapell, John Piper, John Stott).
Ton rôle est d'accompagner le prédicateur à chaque étape pour concevoir un message fidèle au sens originel, centré sur la grâce de l'Évangile et percutant pour l'auditoire.

MÉTHODOLOGIE HOMILÉTIQUE À APPLIQUER :
1. IDENTIFICATION DU SUJET & DE LA PROPOSITION CENTRALE (PC / Big Idea) :
   - Exégèse & Sens Originel : Détermine ce que le texte signifiait pour l'auteur et les destinataires d'origine (Proposition Herméneutique - hier et là-bas).
   - Formulation de la PC : Traduis cette vérité pour aujourd'hui (ici et maintenant) en UNE seule phrase claire, intense, mémorable et ancrée dans l'Évangile.
2. PLAN EXPOSITIF FIDÈLE (Découper, Décrire, Homogénéiser) :
   - Découpe le texte selon ses articulations logiques naturelles et transitions.
   - Formule entre 2 et 5 points simples (niveau 1) qui soutiennent directement la Proposition Centrale.
   - Homogénéise la formulation des points pour leur donner une même dynamique logique et fluide.
3. CONCEPTION D'ILLUSTRATIONS PERTINENTES :
   - Rôle : Illuminer l'abstrait, susciter une émotion légitime, ancrer la vérité dans la mémoire.
   - Types : Récits bibliques de l'AT, arrière-plans historiques ou biographiques, faits vécus sobres, analogies du quotidien.
   - Critères : Intégrité absolue, précision des faits, dosage sobre, pertinence stricte au service de la PC (sans humour futile ni manipulation).
4. FORMULATION DES APPLICATIONS PASTORALES CONCRÈTES (Viser le Cœur) :
   - Dépasser le simple moralisme en ciblant les 4 axes :
     * Le Cœur (Affections & Volonté) : Démanteler les idoles du cœur, susciter l'amour pour Dieu et la repentance.
     * La Pensée (Mind) : Réformer l'intelligence et la vision du monde par la théologie du texte.
     * L'Action (Vie pratique) : Pistes précises d'obéissance pour la semaine (« Comment faire ? »).
     * La Communauté : Vivre cette vérité dans l'Église locale (encouragement, amour mutuel, redevabilité).
   - Condition de grâce : Tout appel à l'obéissance découle de l'œuvre accomplie de Christ à la croix et de la force du Saint-Esprit (bannir le légalisme).
5. GARDE-FOUS & PIÈGES À ÉVITER :
   - Alerte le prédicateur contre la prédication moraliste/légaliste, la prédication impressionniste sans rigueur exégétique, ou le discours académique aride sans application.`,

  DEFAULT_PROMPT_THEOLOGY: `MODE D'ÉTUDE : SYNTHÈSE THÉOLOGIQUE & DOCTRINALE
- Analyse doctrinale systématique et biblique approfondie étayée par les traités et dictionnaires théologiques.
- Démonstration scripturaire rigoureuse (analogia scripturae) et définitions théologiques précises.
- Articulation claire des doctrines cardinales (salut par grâce, Trinité, alliances, christologie, eschatologie).`,

  DEFAULT_PROMPT_LEXICAL: `MODE D'ÉTUDE : ANALYSE LEXICALE (GREC & HÉBREU / STRONG)
- Étude détaillée des racines linguistiques hébraïques et grecques, des codes Strong et des champs sémantiques.
- Analyse des nuances morphologiques, de l'étymologie et du sens des termes dans la Septante (LXX) et le Nouveau Testament.
- Restitution claire des implications théologiques issues du sens originel des mots.`,

  DEFAULT_PROMPT_FREE_CHAT: `MODE D'ÉTUDE : DISCUSSION LIBRE & RÉFLEXION THÉOLOGIQUE
Tu es un pair intellectuel, un compagnon d'étude théologique et un sparring-partner biblique bienveillant.
OBJECTIFS & POSTURE DU DIALOGUE LIBRE :
- RÈGLE FONDAMENTALE SUR LES SALUTATIONS : Si l'utilisateur te salue (ex: 'salut', 'bonjour', 'hello', 'coucou'), réponds simplement, chaleureusement et brièvement en lui demandant quel sujet, texte ou réflexion il aimerait aborder aujourd'hui. Ne confonds JAMAIS une salutation d'usage ('salut !') avec une question sur la doctrine sotériologique du Salut !
- Réponds de manière vivante, fluide, naturelle et directe, avec une longueur proportionnée au message de l'utilisateur.
- Adopte une posture d'échange constructif : apporte des éclairages stimulants, partage des perspectives bibliques équilibrées, et termine si opportun par une question ouverte ou une relance pour nourrir la réflexion.
- Mobilise les Écritures avec naturel et précision (en citant les références) sans alourdir le propos.
- Si des documents du corpus documentaire sont pertinents pour la question, appuie-toi dessus avec simplicité.`,

  PROMPT_CONFIGS: {
    theological_profile: {
      title: 'System Prompt — Passeport Herméneutique (« Mon Église »)',
      defaultProp: null,
      fieldId: null,
      badgeId: 'badge-profile-status',
      label: 'Passeport Herméneutique'
    },
    mode_exegesis: {
      title: 'System Prompt — Mode Exégèse Approfondie (Chat)',
      defaultProp: 'DEFAULT_PROMPT_EXEGESIS',
      fieldId: 'cfg-prompt-exegesis',
      badgeId: 'badge-mode-exegesis-status',
      label: 'Exégèse Approfondie'
    },
    mode_historical: {
      title: 'System Prompt — Mode Contexte Historique & Culturel (Chat)',
      defaultProp: 'DEFAULT_PROMPT_HISTORICAL',
      fieldId: 'cfg-prompt-historical',
      badgeId: 'badge-mode-historical-status',
      label: 'Contexte Historique'
    },
    mode_sermon: {
      title: 'System Prompt — Mode Préparation de Prédication (Chat)',
      defaultProp: 'DEFAULT_PROMPT_SERMON',
      fieldId: 'cfg-prompt-sermon',
      badgeId: 'badge-mode-sermon-status',
      label: 'Préparation de Prédication'
    },
    mode_theology: {
      title: 'System Prompt — Mode Synthèse Théologique & Doctrinale (Chat)',
      defaultProp: 'DEFAULT_PROMPT_THEOLOGY',
      fieldId: 'cfg-prompt-theology',
      badgeId: 'badge-mode-theology-status',
      label: 'Synthèse Théologique'
    },
    mode_lexical: {
      title: 'System Prompt — Mode Analyse Lexicale Grec & Hébreu (Chat)',
      defaultProp: 'DEFAULT_PROMPT_LEXICAL',
      fieldId: 'cfg-prompt-lexical',
      badgeId: 'badge-mode-lexical-status',
      label: 'Analyse Lexicale'
    },
    mode_free_chat: {
      title: 'System Prompt — Mode Discussion Libre & Réflexion (Chat)',
      defaultProp: 'DEFAULT_PROMPT_FREE_CHAT',
      fieldId: 'cfg-prompt-free_chat',
      badgeId: 'badge-mode-free_chat-status',
      label: 'Discussion Libre'
    },
    synthesis: {
      title: 'System Prompt — Synthèse Exégétique IA (Versets)',
      defaultProp: 'DEFAULT_SYNTH_PROMPT',
      fieldId: 'cfg-synthesis-system-prompt',
      badgeId: 'badge-synth-status',
      label: 'Synthèse Exégétique'
    },
    translation: {
      title: 'System Prompt — Traduction Fidèle d\'Articles & Dictionnaires',
      defaultProp: 'DEFAULT_TRANS_PROMPT',
      fieldId: 'cfg-translation-system-prompt',
      badgeId: 'badge-trans-status',
      label: 'Traduction'
    },
    summary: {
      title: 'System Prompt — Résumé Théologique de Chapitre',
      defaultProp: 'DEFAULT_SUMMARY_PROMPT',
      fieldId: 'cfg-summary-system-prompt',
      badgeId: 'badge-summary-status',
      label: 'Résumé Théologique'
    },
    note_title: {
      title: 'System Prompt — Titre de Note IA',
      defaultProp: 'DEFAULT_NOTE_TITLE_PROMPT',
      fieldId: 'cfg-prompt-note-title',
      badgeId: 'badge-note-title-status',
      label: 'Titre de Note'
    },
    note_tags: {
      title: 'System Prompt — Tags de Note IA',
      defaultProp: 'DEFAULT_NOTE_TAGS_PROMPT',
      fieldId: 'cfg-prompt-note-tags',
      badgeId: 'badge-note-tags-status',
      label: 'Tags de Note'
    }
  },

  currentEditingPrompt: null,
  activeModalTab: 'preview',

  bindActions() {
    const triggerThemeUpdate = () => {
      const theme = document.getElementById('cfg-theme')?.value || 'dark';
      const palette = document.getElementById('cfg-theme-palette')?.value || 'dark-slate';
      const readingBg = document.getElementById('cfg-reading-bg')?.value || 'auto';
      App.applyTheme(theme, palette, readingBg);
    };

    // 1. Boutons Segmentés de Mode (Sombre / Clair / Système)
    document.querySelectorAll('.theme-mode-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.theme-mode-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const mode = btn.dataset.theme;
        const themeInput = document.getElementById('cfg-theme');
        if (themeInput) themeInput.value = mode;

        // Bascule de l'affichage des 3 pastilles selon le mode
        const darkGroup = document.getElementById('palette-selector-dark-group');
        const lightGroup = document.getElementById('palette-selector-light-group');
        const paletteInput = document.getElementById('cfg-theme-palette');

        if (mode === 'light') {
          darkGroup?.classList.add('hidden');
          lightGroup?.classList.remove('hidden');
          if (paletteInput && paletteInput.value.startsWith('dark')) {
            paletteInput.value = 'light-clean';
            this.updateActivePaletteCard('light-clean');
          }
        } else {
          // dark ou system
          lightGroup?.classList.add('hidden');
          darkGroup?.classList.remove('hidden');
          if (paletteInput && paletteInput.value.startsWith('light')) {
            paletteInput.value = 'dark-slate';
            this.updateActivePaletteCard('dark-slate');
          }
        }

        triggerThemeUpdate();
      });
    });

    // 2. Clic sur les pastilles bicolores de palette
    document.querySelectorAll('.palette-swatch-card').forEach(card => {
      card.addEventListener('click', () => {
        const palette = card.dataset.palette;
        const paletteInput = document.getElementById('cfg-theme-palette');
        if (paletteInput) paletteInput.value = palette;
        this.updateActivePaletteCard(palette);
        triggerThemeUpdate();
      });
    });

    // 3. Clic sur les tuiles de fond de lecture (Harmonisé, Blanc, Sépia, Sombre)
    document.querySelectorAll('.reading-bg-card').forEach(card => {
      card.addEventListener('click', () => {
        const bgVal = card.dataset.readingBg;
        const bgInput = document.getElementById('cfg-reading-bg');
        if (bgInput) bgInput.value = bgVal;
        this.updateActiveReadingBgCard(bgVal);
        triggerThemeUpdate();
      });
    });

    // 4. Commutateur Maître de Désactivation / Activation de l'IA
    const handleAIToggle = (e) => {
      const isEnabled = e.target.checked;
      App.applyAIEnabled(isEnabled, true);
      this.updateAIToggles(isEnabled);
      this.config.enable_ai = isEnabled;
      API.call('save_settings', { ...this.config, enable_ai: isEnabled });
      App.showToast(isEnabled ? 'Intelligence Artificielle activée' : 'Mode 100% Traditionnel sans IA activé');
    };

    document.getElementById('cfg-enable-ai')?.addEventListener('change', handleAIToggle);
    document.getElementById('cfg-enable-ai-tab')?.addEventListener('change', handleAIToggle);

    // 4b. Notifications de fin de génération IA
    document.getElementById('cfg-notify-ai-enabled')?.addEventListener('change', (e) => {
      const isEnabled = e.target.checked;
      if (typeof NotificationManager !== 'undefined') {
        NotificationManager.updateSettings({ enabled: isEnabled });
      }
      const container = document.getElementById('ai-notify-options-container');
      if (container) {
        container.style.opacity = isEnabled ? '1' : '0.45';
        container.style.pointerEvents = isEnabled ? 'auto' : 'none';
      }
    });

    document.getElementById('cfg-notify-ai-sound')?.addEventListener('change', (e) => {
      if (typeof NotificationManager !== 'undefined') {
        NotificationManager.updateSettings({ sound: e.target.checked });
      }
    });

    document.getElementById('cfg-notify-ai-windows')?.addEventListener('change', (e) => {
      if (typeof NotificationManager !== 'undefined') {
        NotificationManager.updateSettings({ windows: e.target.checked });
      }
    });

    document.getElementById('cfg-notify-ai-inapp')?.addEventListener('change', (e) => {
      if (typeof NotificationManager !== 'undefined') {
        NotificationManager.updateSettings({ inapp: e.target.checked });
      }
    });

    document.getElementById('btn-test-notify-sound')?.addEventListener('click', () => {
      const vol = (parseInt(document.getElementById('cfg-notify-ai-volume')?.value || '60', 10)) / 100;
      if (typeof NotificationManager !== 'undefined') {
        NotificationManager.playChime(vol);
      }
    });

    // Changement de police en direct
    document.getElementById('cfg-font-family')?.addEventListener('change', (e) => {
      App.applyFontFamily(e.target.value);
    });

    // Notes & Dossier Markdown
    document.getElementById('btn-browse-notes-dir')?.addEventListener('click', async () => {
      try {
        const res = await API.call('pick_notes_folder');
        if (res && res.success && res.path) {
          document.getElementById('cfg-notes-dir').value = res.path;
          App.showToast(`Dossier sélectionné : ${res.path}`);
        }
      } catch (e) {
        alert(`Erreur sélection dossier : ${e}`);
      }
    });

    document.getElementById('btn-open-notes-dir-cfg')?.addEventListener('click', async () => {
      try {
        const res = await API.call('open_notes_folder');
        if (res && res.success) {
          App.showToast(`Dossier ouvert : ${res.path}`);
        } else {
          alert(`Erreur : ${res?.error || 'Impossible d\'ouvrir le dossier'}`);
        }
      } catch (e) {
        alert(`Erreur : ${e}`);
      }
    });

    document.getElementById('btn-reset-notes-dir')?.addEventListener('click', () => {
      document.getElementById('cfg-notes-dir').value = '';
      App.showToast('Dossier réinitialisé par défaut (data/notes/)');
    });

    // Bibliothèque d'ebooks théologiques (EPUB)
    document.getElementById('btn-browse-ebooks-dir')?.addEventListener('click', async () => {
      try {
        const res = await API.call('pick_ebooks_folder');
        if (res && res.success && res.path) {
          document.getElementById('cfg-ebooks-dir').value = res.path;
          App.showToast(`📚 Dossier ebooks sélectionné : ${res.path}`);
        }
      } catch (e) {
        alert(`Erreur sélection dossier : ${e}`);
      }
    });

    document.getElementById('btn-open-ebooks-dir')?.addEventListener('click', async () => {
      try {
        const res = await API.call('open_ebooks_folder');
        if (res && res.success) {
          App.showToast(`📂 Dossier ouvert : ${res.path}`);
        } else {
          alert(`Erreur : ${res?.error || "Impossible d'ouvrir le dossier"}`);
        }
      } catch (e) {
        alert(`Erreur : ${e}`);
      }
    });

    document.getElementById('btn-reset-ebooks-dir')?.addEventListener('click', () => {
      document.getElementById('cfg-ebooks-dir').value = '';
      App.showToast('Dossier ebooks réinitialisé par défaut (data/ebooks/)');
    });

    // Stockage & Fichier des Surlignages
    document.getElementById('btn-browse-highlights-file')?.addEventListener('click', async () => {
      try {
        const res = await API.call('pick_highlights_file');
        if (res && res.success && res.path) {
          document.getElementById('cfg-highlights-file').value = res.path;
          App.showToast(`Fichier sélectionné : ${res.path}`);
        }
      } catch (e) {
        alert(`Erreur sélection fichier : ${e}`);
      }
    });

    document.getElementById('btn-open-highlights-dir')?.addEventListener('click', async () => {
      try {
        const res = await API.call('open_highlights_folder');
        if (res && res.success) {
          App.showToast(`Dossier ouvert : ${res.path}`);
        } else {
          alert(`Erreur : ${res?.error || 'Impossible d\'ouvrir le dossier'}`);
        }
      } catch (e) {
        alert(`Erreur : ${e}`);
      }
    });

    document.getElementById('btn-reset-highlights-file')?.addEventListener('click', () => {
      document.getElementById('cfg-highlights-file').value = '';
      App.showToast('Fichier réinitialisé par défaut (data/highlights.json)');
    });

    // Boutons Export / Import des Surlignages dans les Paramètres
    document.getElementById('btn-cfg-export-hl-json')?.addEventListener('click', async () => {
      try {
        const res = await API.exportHighlights('json');
        if (res && res.success) {
          App.showToast(`Surlignages exportés avec succès (JSON)`);
        } else if (res && !res.cancelled) {
          App.showToast(`Erreur export : ${res.error || 'inconnue'}`);
        }
      } catch (err) {
        console.error('Erreur export JSON', err);
      }
    });

    document.getElementById('btn-cfg-export-hl-md')?.addEventListener('click', async () => {
      try {
        const res = await API.exportHighlights('md');
        if (res && res.success) {
          App.showToast(`Surlignages exportés avec succès (Markdown)`);
        } else if (res && !res.cancelled) {
          App.showToast(`Erreur export : ${res.error || 'inconnue'}`);
        }
      } catch (err) {
        console.error('Erreur export MD', err);
      }
    });

    document.getElementById('btn-cfg-import-hl-json')?.addEventListener('click', async () => {
      try {
        const res = await API.importHighlights('merge');
        if (res && res.success) {
          App.showToast(`✓ ${res.imported_count} surlignage(s) importé(s) (${res.total_count} au total)`);
          if (typeof HighlighterManager !== 'undefined' && typeof BibleReader !== 'undefined') {
            HighlighterManager.renderChapterHighlights(BibleReader.currentBook, BibleReader.currentChapter);
          }
        } else if (res && !res.cancelled) {
          App.showToast(`Erreur import : ${res.error || 'inconnue'}`);
        }
      } catch (err) {
        console.error('Erreur import JSON', err);
      }
    });

    document.getElementById('cfg-include-notes-ai')?.addEventListener('change', (e) => {
      this.config.include_notes_in_ai = e.target.checked;
      if (typeof NotesView !== 'undefined') {
        NotesView.updateAiToggleVisibility();
        NotesView.renderList();
      }
      if (typeof DrawerNotes !== 'undefined' && DrawerNotes.renderList) {
        DrawerNotes.renderList();
      }
    });

    // Boutons des cartes de prompts système
    const promptBtnBindings = [
      { type: 'mode_exegesis', open: 'btn-open-modal-mode-exegesis-prompt', reset: 'btn-reset-mode-exegesis-prompt' },
      { type: 'mode_historical', open: 'btn-open-modal-mode-historical-prompt', reset: 'btn-reset-mode-historical-prompt' },
      { type: 'mode_sermon', open: 'btn-open-modal-mode-sermon-prompt', reset: 'btn-reset-mode-sermon-prompt' },
      { type: 'mode_theology', open: 'btn-open-modal-mode-theology-prompt', reset: 'btn-reset-mode-theology-prompt' },
      { type: 'mode_lexical', open: 'btn-open-modal-mode-lexical-prompt', reset: 'btn-reset-mode-lexical-prompt' },
      { type: 'mode_free_chat', open: 'btn-open-modal-mode-free_chat-prompt', reset: 'btn-reset-mode-free_chat-prompt' },
      { type: 'synthesis', open: 'btn-open-modal-synth-prompt', reset: 'btn-reset-synth-prompt' },
      { type: 'translation', open: 'btn-open-modal-trans-prompt', reset: 'btn-reset-trans-prompt' },
      { type: 'summary', open: 'btn-open-modal-summary-prompt', reset: 'btn-reset-summary-prompt' },
      { type: 'note_title', open: 'btn-open-modal-note-title-prompt', reset: 'btn-reset-note-title-prompt' },
      { type: 'note_tags', open: 'btn-open-modal-note-tags-prompt', reset: 'btn-reset-note-tags-prompt' }
    ];

    promptBtnBindings.forEach(item => {
      const cfg = this.PROMPT_CONFIGS[item.type];
      document.getElementById(item.open)?.addEventListener('click', () => {
        this.openPromptModal(item.type);
      });
      document.getElementById(item.reset)?.addEventListener('click', () => {
        if (!cfg || !cfg.defaultProp || !cfg.fieldId) return;
        const def = this[cfg.defaultProp];
        if (confirm(`Voulez-vous rétablir le prompt de « ${cfg.label} » par défaut ?`)) {
          const field = document.getElementById(cfg.fieldId);
          if (field) field.value = def;
          this.updateAllPromptStatusBadges();
          this.save();
          App.showToast(`Prompt de « ${cfg.label} » rétabli par défaut`);
        }
      });
    });

    document.getElementById('cfg-summary-word-count')?.addEventListener('input', (e) => {
      const lbl = document.getElementById('lbl-summary-word-count-val');
      if (lbl) lbl.textContent = `~${e.target.value} mots`;
    });

    // Gestionnaire de visibilité des modèles IA
    document.getElementById('btn-fetch-gemini-models')?.addEventListener('click', () => {
      this.fetchGeminiModels();
    });

    document.getElementById('btn-models-enable-all')?.addEventListener('click', () => {
      this.config.disabled_models = [];
      this.save();
      this.renderModelsVisibilityList();
      this.renderAllModelSelects();
      App.showToast('Tous les modèles IA ont été activés.');
    });

    document.getElementById('btn-models-enable-gemini')?.addEventListener('click', () => {
      const all = this.getAllAvailableModels();
      this.config.disabled_models = all.filter(m => m.provider !== 'google').map(m => m.id);
      this.save();
      this.renderModelsVisibilityList();
      this.renderAllModelSelects();
      App.showToast('Seuls les modèles Google Gemini sont activés.');
    });

    document.getElementById('btn-models-enable-mistral')?.addEventListener('click', () => {
      const all = this.getAllAvailableModels();
      this.config.disabled_models = all.filter(m => m.provider !== 'mistral').map(m => m.id);
      this.save();
      this.renderModelsVisibilityList();
      this.renderAllModelSelects();
      App.showToast('Seuls les modèles Mistral AI sont activés.');
    });

    document.getElementById('btn-models-enable-infomaniak')?.addEventListener('click', () => {
      const all = this.getAllAvailableModels();
      this.config.disabled_models = all.filter(m => m.provider !== 'infomaniak').map(m => m.id);
      this.save();
      this.renderModelsVisibilityList();
      this.renderAllModelSelects();
      App.showToast('Seuls les modèles Infomaniak sont activés.');
    });

    // Initialisation et liaison des paires de modèles (Principal / Fallback distincts)
    this.initModelSelectPairs();

    // Modale de Prompt Système
    document.getElementById('btn-close-prompt-modal')?.addEventListener('click', () => {
      this.closePromptModal();
    });

    document.getElementById('btn-modal-cancel-prompt')?.addEventListener('click', () => {
      this.closePromptModal();
    });

    document.getElementById('tab-prompt-edit')?.addEventListener('click', () => {
      this.switchPromptModalTab('edit');
    });

    document.getElementById('tab-prompt-preview')?.addEventListener('click', () => {
      this.switchPromptModalTab('preview');
    });

    document.getElementById('modal-prompt-textarea')?.addEventListener('input', () => {
      this.updatePromptModalStats();
      if (this.activeModalTab === 'preview') {
        this.renderPromptPreview();
      }
    });

    document.getElementById('btn-modal-reset-default')?.addEventListener('click', () => {
      this.resetPromptInModal();
    });

    document.getElementById('btn-modal-copy-prompt')?.addEventListener('click', () => {
      this.copyPromptInModal();
    });

    document.getElementById('btn-modal-save-prompt')?.addEventListener('click', () => {
      this.savePromptFromModal();
    });

    // Fermeture modale au clic sur le fond
    document.getElementById('modal-system-prompt')?.addEventListener('click', (e) => {
      if (e.target.id === 'modal-system-prompt') {
        this.closePromptModal();
      }
    });

    document.getElementById('btn-save-settings-top').addEventListener('click', () => {
      this.save();
    });

    // STEPBible
    document.getElementById('btn-reindex-stepbible').addEventListener('click', async () => {
      const btn = document.getElementById('btn-reindex-stepbible');
      btn.disabled = true;
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 14 14"></polyline>
        </svg>
        <span>Indexation en cours...</span>
      `;
      try {
        const ok = await API.call('reindex_stepbible');
        if (ok) {
          App.showToast('Base STEPBible mise à jour avec succès !');
          this.loadStepBibleStatus();
        } else {
          alert("Erreur lors de l'indexation STEPBible.");
        }
      } catch (e) {
        console.error(e);
      } finally {
        btn.disabled = false;
        btn.innerHTML = `
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" x2="12" y1="15" y2="3"></line>
          </svg>
          <span>Télécharger & Réindexer STEPBible</span>
        `;
      }
    });

    // Export ZIP
    document.getElementById('btn-export-zip').addEventListener('click', async () => {
      const statusEl = document.getElementById('backup-status-text');
      statusEl.textContent = 'Compression de vos données en cours...';
      try {
        const res = await API.call('export_backup_zip');
        if (res && res.success) {
          statusEl.textContent = `Sauvegarde réussie (${res.size_mb} Mo) : ${res.path}`;
          App.showToast('Sauvegarde complète exportée !');
        } else if (res && !res.cancelled) {
          statusEl.textContent = `Erreur : ${res.error}`;
        } else {
          statusEl.textContent = '';
        }
      } catch (e) {
        statusEl.textContent = `Erreur : ${e}`;
      }
    });

    // Import ZIP
    document.getElementById('btn-import-zip').addEventListener('click', async () => {
      const statusEl = document.getElementById('backup-status-text');
      if (confirm("Cette opération REMPLACERA vos données actuelles par celles du fichier ZIP.\n\nContinuer ?")) {
        statusEl.textContent = 'Restauration en cours...';
        try {
          const res = await API.call('import_backup_zip');
          if (res && res.success) {
            statusEl.textContent = 'Données restaurées avec succès !';
            App.showToast('Restauration terminée !');
          } else if (res && !res.cancelled) {
            statusEl.textContent = `Erreur : ${res.error}`;
          }
        } catch (e) {
          statusEl.textContent = `Erreur : ${e}`;
        }
      }
    });
    // Profil Théologique & Herméneutique
    document.getElementById('btn-open-theological-profile-modal')?.addEventListener('click', () => {
      if (typeof TheologicalProfileModal !== 'undefined') {
        TheologicalProfileModal.open();
      }
    });

    document.getElementById('btn-open-modal-profile-prompt')?.addEventListener('click', () => {
      this.openPromptModal('theological_profile');
    });

    document.getElementById('btn-regenerate-profile-prompt')?.addEventListener('click', async () => {
      const btn = document.getElementById('btn-regenerate-profile-prompt');
      if (btn) btn.innerHTML = '<span>Régénération...</span>';
      try {
        const res = await API.call('generate_theological_profile_summary');
        if (res && res.success) {
          this.loadTheologicalProfileCard();
          if (typeof AIStudyView !== 'undefined' && AIStudyView.loadTheologicalProfileBadge) {
            AIStudyView.loadTheologicalProfileBadge();
          }
          if (typeof App !== 'undefined' && App.showToast) {
            App.showToast("Passeport Herméneutique régénéré avec succès !");
          }
        }
      } catch (e) {
        alert("Erreur lors de la régénération : " + (e?.message || e));
      } finally {
        if (btn) btn.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path></svg><span>Régénérer</span>';
      }
    });
  },

  async loadTheologicalProfileCard() {
    try {
      const profile = await API.call('get_theological_profile') || {};
      
      const roleLabels = {
        "predication": "Prédication pastorale",
        "enseignement": "Enseignement & Groupes",
        "etude_perso": "Étude personnelle",
        "academique": "Recherche académique"
      };
      
      const levelLabels = {
        "debutant": "Débutant (Traductions)",
        "intermediaire": "Intermédiaire (Strong)",
        "avance": "Avancé (Syntaxe/LXX)"
      };

      const postureLabels = {
        "pastoral_sparring": "Pastoral & Sparring",
        "pastoral": "Pastoral & Équilibré",
        "academique": "Académique & Factuel",
        "pedagogique": "Pédagogique & Didactique"
      };

      const roleEl = document.getElementById('lbl-profile-role');
      if (roleEl) roleEl.textContent = roleLabels[profile.user_role] || profile.user_role || "Non défini";

      const levelEl = document.getElementById('lbl-profile-level');
      if (levelEl) levelEl.textContent = levelLabels[profile.greek_hebrew_level] || profile.greek_hebrew_level || "Non défini";

      const postureEl = document.getElementById('lbl-profile-posture');
      if (postureEl) postureEl.textContent = postureLabels[profile.ai_posture] || profile.ai_posture || "Non défini";

      const countryEl = document.getElementById('lbl-profile-country');
      if (countryEl) countryEl.textContent = profile.country_culture || "France";

      const badgeEl = document.getElementById('badge-profile-prompt-status');
      if (badgeEl) {
        const hasPrompt = profile.system_profile_prompt && profile.system_profile_prompt.trim().length > 0;
        badgeEl.textContent = hasPrompt ? 'Généré par IA' : 'À configurer';
        badgeEl.className = `prompt-status-badge ${hasPrompt ? 'is-custom' : 'is-default'}`;
      }
    } catch (e) {
      console.warn("Erreur chargement carte profil théologique :", e);
    }
  },

  updateActivePaletteCard(palette) {
    document.querySelectorAll('.palette-swatch-card').forEach(c => {
      c.classList.toggle('active', c.dataset.palette === palette);
    });
  },

  updateActiveReadingBgCard(bgVal) {
    document.querySelectorAll('.reading-bg-card').forEach(c => {
      c.classList.toggle('active', c.dataset.readingBg === bgVal);
    });
  },

  updateAIToggles(enabled) {
    const isEnabled = enabled !== false;
    const chk1 = document.getElementById('cfg-enable-ai');
    const chk2 = document.getElementById('cfg-enable-ai-tab');
    const banner1 = document.getElementById('ai-disabled-status-banner');
    const banner2 = document.getElementById('ai-disabled-status-banner-tab');
    const subConfig = document.getElementById('sec-ai-sub-config');

    if (chk1) chk1.checked = isEnabled;
    if (chk2) chk2.checked = isEnabled;

    if (banner1) banner1.classList.toggle('hidden', isEnabled);
    if (banner2) banner2.classList.toggle('hidden', isEnabled);
    if (subConfig) {
      subConfig.style.opacity = isEnabled ? '1' : '0.45';
      subConfig.style.pointerEvents = isEnabled ? 'auto' : 'none';
    }
  },

  async loadData() {
    try {
      this.config = await API.call('get_settings') || {};
      this.populateForm();
      this.loadTheologicalProfileCard();
      this.loadStepBibleStatus();
      this.loadDictionaries();
    } catch (e) {
      console.error('Erreur chargement paramètres:', e);
    }
  },

  populateForm() {
    const c = this.config;
    const theme = c.theme || 'dark';
    const palette = c.theme_palette || 'dark-slate';
    const readingBg = c.reading_bg || 'auto';

    // 0. État Maître de l'IA
    const isAIEnabled = c.enable_ai !== false;
    this.updateAIToggles(isAIEnabled);
    App.applyAIEnabled(isAIEnabled, false);

    document.getElementById('cfg-theme').value = theme;
    if (document.getElementById('cfg-theme-palette')) {
      document.getElementById('cfg-theme-palette').value = palette;
    }
    if (document.getElementById('cfg-reading-bg')) {
      document.getElementById('cfg-reading-bg').value = readingBg;
    }

    // Boutons segmentés de mode
    document.querySelectorAll('.theme-mode-pill').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === theme);
    });

    const darkGroup = document.getElementById('palette-selector-dark-group');
    const lightGroup = document.getElementById('palette-selector-light-group');
    if (theme === 'light') {
      darkGroup?.classList.add('hidden');
      lightGroup?.classList.remove('hidden');
    } else {
      lightGroup?.classList.add('hidden');
      darkGroup?.classList.remove('hidden');
    }

    this.updateActivePaletteCard(palette);
    this.updateActiveReadingBgCard(readingBg);

    App.applyTheme(theme, palette, readingBg);

    const font = c.font_family || 'EB Garamond';
    document.getElementById('cfg-font-family').value = font;
    App.applyFontFamily(font);
    
    if (c.font_size) {
      document.getElementById('cfg-font-size').value = c.font_size;
      document.getElementById('lbl-font-size-val').textContent = `${c.font_size} pt`;
      document.documentElement.style.setProperty('--bible-font-size-base', `${c.font_size}px`);
      const ws = document.getElementById('reader-workspace');
      if (ws) ws.style.setProperty('--bible-font-size-base', `${c.font_size}px`);
    }
    if (c.line_spacing !== undefined) {
      document.getElementById('cfg-line-spacing').value = c.line_spacing;
      document.getElementById('lbl-line-spacing-val').textContent = `${c.line_spacing} px`;
    }

    if (typeof VintageThemeManager !== 'undefined') {
      VintageThemeManager.init(c);
    }

    document.getElementById('cfg-diff-pct').checked = c.show_diff_percentage !== false;
    document.getElementById('cfg-diff-highlight').checked = c.show_diff_highlights !== false;
    if (document.getElementById('cfg-show-chap-dividers')) {
      document.getElementById('cfg-show-chap-dividers').checked = c.show_chapter_dividers !== false;
    }
    if (document.getElementById('cfg-full-width')) {
      document.getElementById('cfg-full-width').checked = c.full_width_reading === true;
    }
    if (document.getElementById('cfg-show-geo-pins')) {
      document.getElementById('cfg-show-geo-pins').checked = c.show_geo_pins !== false;
    }

    document.getElementById('cfg-inter-surface').checked = c.interlinear_show_surface !== false;
    document.getElementById('cfg-inter-lemma').checked = c.interlinear_show_lemma !== false;
    document.getElementById('cfg-inter-translit').checked = c.interlinear_show_translit !== false;
    document.getElementById('cfg-inter-strong').checked = c.interlinear_show_strong !== false;

    if (c.max_original_verses_for_llm) {
      document.getElementById('cfg-max-orig-verses').value = c.max_original_verses_for_llm;
      document.getElementById('lbl-max-orig-val').textContent = `${c.max_original_verses_for_llm} vers.`;
    }

    if (c.notes_directory !== undefined) {
      document.getElementById('cfg-notes-dir').value = c.notes_directory || '';
    }
    if (c.highlights_file !== undefined && document.getElementById('cfg-highlights-file')) {
      document.getElementById('cfg-highlights-file').value = c.highlights_file || '';
    }
    if (c.ebooks_dir !== undefined && document.getElementById('cfg-ebooks-dir')) {
      document.getElementById('cfg-ebooks-dir').value = c.ebooks_dir || '';
    }
    document.getElementById('cfg-include-notes-ai').checked = c.include_notes_in_ai !== false;

    if (typeof NotesView !== 'undefined') {
      NotesView.updateAiToggleVisibility();
      NotesView.renderList();
    }
    if (typeof DrawerNotes !== 'undefined' && DrawerNotes.renderList) {
      DrawerNotes.renderList();
    }

    this.config.disabled_models = Array.isArray(c.disabled_models) ? [...c.disabled_models] : [];
    this.renderModelsVisibilityList();
    this.renderAllModelSelects();

    if (c.chat_model && document.getElementById('cfg-chat-model') && this.isModelEnabled(c.chat_model)) {
      document.getElementById('cfg-chat-model').value = c.chat_model;
    }
    if (c.chat_fallback_model && document.getElementById('cfg-chat-fallback-model') && this.isModelEnabled(c.chat_fallback_model)) {
      document.getElementById('cfg-chat-fallback-model').value = c.chat_fallback_model;
    }
    if (c.synthesis_model && document.getElementById('cfg-synthesis-model') && this.isModelEnabled(c.synthesis_model)) {
      document.getElementById('cfg-synthesis-model').value = c.synthesis_model;
    }
    if (c.synthesis_fallback_model && document.getElementById('cfg-synthesis-fallback-model') && this.isModelEnabled(c.synthesis_fallback_model)) {
      document.getElementById('cfg-synthesis-fallback-model').value = c.synthesis_fallback_model;
    }
    if (c.synthesis_max_verses && document.getElementById('cfg-synthesis-max-verses')) {
      document.getElementById('cfg-synthesis-max-verses').value = c.synthesis_max_verses;
    }

    if (c.translation_model && document.getElementById('cfg-translation-model') && this.isModelEnabled(c.translation_model)) {
      document.getElementById('cfg-translation-model').value = c.translation_model;
    }
    if (c.translation_fallback_model && document.getElementById('cfg-translation-fallback-model') && this.isModelEnabled(c.translation_fallback_model)) {
      document.getElementById('cfg-translation-fallback-model').value = c.translation_fallback_model;
    }
    if (c.summary_model && document.getElementById('cfg-summary-model') && this.isModelEnabled(c.summary_model)) {
      document.getElementById('cfg-summary-model').value = c.summary_model;
    }
    if (c.summary_fallback_model && document.getElementById('cfg-summary-fallback-model') && this.isModelEnabled(c.summary_fallback_model)) {
      document.getElementById('cfg-summary-fallback-model').value = c.summary_fallback_model;
    }
    if (c.title_model && document.getElementById('cfg-title-model') && this.isModelEnabled(c.title_model)) {
      document.getElementById('cfg-title-model').value = c.title_model;
    }
    if (c.title_fallback_model && document.getElementById('cfg-title-fallback-model') && this.isModelEnabled(c.title_fallback_model)) {
      document.getElementById('cfg-title-fallback-model').value = c.title_fallback_model;
    }
    if (c.notes_ai_model && document.getElementById('cfg-notes-ai-model') && this.isModelEnabled(c.notes_ai_model)) {
      document.getElementById('cfg-notes-ai-model').value = c.notes_ai_model;
    }
    if (c.notes_ai_fallback_model && document.getElementById('cfg-notes-ai-fallback-model') && this.isModelEnabled(c.notes_ai_fallback_model)) {
      document.getElementById('cfg-notes-ai-fallback-model').value = c.notes_ai_fallback_model;
    }
    if (document.getElementById('cfg-summary-word-count')) {
      document.getElementById('cfg-summary-word-count').value = c.summary_word_count || 300;
      const lbl = document.getElementById('lbl-summary-word-count-val');
      if (lbl) lbl.textContent = `~${c.summary_word_count || 300} mots`;
    }

    if (document.getElementById('cfg-articles-vec-mode')) {
      document.getElementById('cfg-articles-vec-mode').value = c.articles_vectorization_mode || 'balanced';
    }

    if (document.getElementById('cfg-articles-sync-freq-select')) {
      const syncOpts = (typeof ArticlesView !== 'undefined' && ArticlesView.syncOpts) || { frequency: 'startup', intervalDays: 3 };
      const val = syncOpts.frequency === 'interval' ? String(syncOpts.intervalDays || 3) : (syncOpts.frequency || 'startup');
      document.getElementById('cfg-articles-sync-freq-select').value = val;
    }

    // Synchronisation et exclusion des doublons Principal / Fallback
    this.syncAllModelPairs(false);

    // Chargement des prompts système (Modes de chat & Outils dédiés)
    Object.values(this.PROMPT_CONFIGS).forEach(cfg => {
      if (cfg.fieldId && document.getElementById(cfg.fieldId)) {
        const configKey = cfg.fieldId.replace('cfg-', '').replace(/-/g, '_');
        document.getElementById(cfg.fieldId).value = c[configKey] || '';
      }
    });
    this.updateAllPromptStatusBadges();

    if (c.gemini_api_key) document.getElementById('cfg-gemini-key').value = c.gemini_api_key;
    if (c.mistral_api_key) document.getElementById('cfg-mistral-key').value = c.mistral_api_key;
    if (c.infomaniak_token) document.getElementById('cfg-infomaniak-token').value = c.infomaniak_token;
    if (c.infomaniak_product_id) document.getElementById('cfg-infomaniak-pid').value = c.infomaniak_product_id;

    // Chargement des préférences de notifications IA
    if (typeof NotificationManager !== 'undefined') {
      const nSettings = NotificationManager.settings;
      const chkNotify = document.getElementById('cfg-notify-ai-enabled');
      if (chkNotify) chkNotify.checked = nSettings.enabled !== false;
      const chkSound = document.getElementById('cfg-notify-ai-sound');
      if (chkSound) chkSound.checked = nSettings.sound !== false;
      const chkWin = document.getElementById('cfg-notify-ai-windows');
      if (chkWin) chkWin.checked = nSettings.windows !== false;
      const chkInApp = document.getElementById('cfg-notify-ai-inapp');
      if (chkInApp) chkInApp.checked = nSettings.inapp !== false;
      const vol = Math.round((nSettings.volume ?? 0.6) * 100);
      const volSlider = document.getElementById('cfg-notify-ai-volume');
      if (volSlider) volSlider.value = vol;
      const volLbl = document.getElementById('lbl-notify-ai-volume');
      if (volLbl) volLbl.textContent = `${vol}%`;

      const notifContainer = document.getElementById('ai-notify-options-container');
      if (notifContainer) {
        notifContainer.style.opacity = (nSettings.enabled !== false) ? '1' : '0.45';
        notifContainer.style.pointerEvents = (nSettings.enabled !== false) ? 'auto' : 'none';
      }
    }
  },

  getAllAvailableModels() {
    const list = [...this.ALL_MODELS_CATALOG];
    const existingIds = new Set(list.map(m => m.id));
    for (const dm of this.discoveredGeminiModels) {
      if (!existingIds.has(dm.id)) {
        list.push({
          id: dm.id,
          name: dm.name || dm.id,
          desc: dm.description ? dm.description.slice(0, 70) + '...' : 'Découvert via Google API',
          provider: 'google',
          isDiscovered: true
        });
        existingIds.add(dm.id);
      }
    }
    return list;
  },

  getDisabledModels() {
    return Array.isArray(this.config.disabled_models) ? this.config.disabled_models : [];
  },

  isModelEnabled(modelId) {
    return !this.getDisabledModels().includes(modelId);
  },

  renderModelsVisibilityList() {
    const models = this.getAllAvailableModels();
    const disabled = this.getDisabledModels();

    const geminiContainer = document.getElementById('models-list-gemini');
    const mistralContainer = document.getElementById('models-list-mistral');
    const infomaniakContainer = document.getElementById('models-list-infomaniak');

    if (!geminiContainer || !mistralContainer || !infomaniakContainer) return;

    let geminiHtml = '';
    let mistralHtml = '';
    let infomaniakHtml = '';

    let geminiActive = 0, geminiTotal = 0;
    let mistralActive = 0, mistralTotal = 0;
    let infomaniakActive = 0, infomaniakTotal = 0;

    models.forEach(m => {
      const isEnabled = !disabled.includes(m.id);
      const rowHtml = `
        <label class="model-check-item ${isEnabled ? '' : 'is-disabled-model'}" title="${m.id}">
          <input type="checkbox" class="model-visibility-cb" data-model-id="${m.id}" ${isEnabled ? 'checked' : ''}>
          <div style="flex: 1; min-width: 0;">
            <div class="model-check-title">
              <span>${m.name}</span>
              ${m.isDiscovered ? '<span class="prompt-status-badge" style="font-size: 9px; padding: 1px 4px; background: rgba(59,130,246,0.15); color: #60a5fa;">API Google</span>' : ''}
            </div>
            <div class="model-check-desc">${m.desc}</div>
          </div>
        </label>
      `;

      if (m.provider === 'google') {
        geminiHtml += rowHtml;
        geminiTotal++;
        if (isEnabled) geminiActive++;
      } else if (m.provider === 'mistral') {
        mistralHtml += rowHtml;
        mistralTotal++;
        if (isEnabled) mistralActive++;
      } else if (m.provider === 'infomaniak') {
        infomaniakHtml += rowHtml;
        infomaniakTotal++;
        if (isEnabled) infomaniakActive++;
      }
    });

    geminiContainer.innerHTML = geminiHtml;
    mistralContainer.innerHTML = mistralHtml;
    infomaniakContainer.innerHTML = infomaniakHtml;

    // Badges de compteur
    const badgeGemini = document.getElementById('badge-count-gemini');
    if (badgeGemini) badgeGemini.textContent = `${geminiActive}/${geminiTotal} actif${geminiActive > 1 ? 's' : ''}`;
    const badgeMistral = document.getElementById('badge-count-mistral');
    if (badgeMistral) badgeMistral.textContent = `${mistralActive}/${mistralTotal} actif${mistralActive > 1 ? 's' : ''}`;
    const badgeInfomaniak = document.getElementById('badge-count-infomaniak');
    if (badgeInfomaniak) badgeInfomaniak.textContent = `${infomaniakActive}/${infomaniakTotal} actif${infomaniakActive > 1 ? 's' : ''}`;

    const totalActive = geminiActive + mistralActive + infomaniakActive;
    const totalAll = geminiTotal + mistralTotal + infomaniakTotal;
    const countBadge = document.getElementById('models-visibility-count-badge');
    if (countBadge) {
      countBadge.textContent = `${totalActive}/${totalAll} modèle${totalActive > 1 ? 's' : ''} actif${totalActive > 1 ? 's' : ''}`;
    }

    // Écouteurs de changement sur les checkboxes
    document.querySelectorAll('.model-visibility-cb').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const modelId = e.target.dataset.modelId;
        const isChecked = e.target.checked;
        this.toggleModelVisibility(modelId, isChecked);
      });
    });
  },

  toggleModelVisibility(modelId, isChecked) {
    let disabled = this.getDisabledModels();
    if (isChecked) {
      disabled = disabled.filter(id => id !== modelId);
    } else {
      if (!disabled.includes(modelId)) {
        disabled.push(modelId);
      }
    }
    this.config.disabled_models = disabled;
    this.save();
    this.renderModelsVisibilityList();
    this.renderAllModelSelects();
  },

  renderAllModelSelects() {
    const selectIds = [
      'cfg-chat-model',
      'cfg-chat-fallback-model',
      'cfg-synthesis-model',
      'cfg-synthesis-fallback-model',
      'cfg-translation-model',
      'cfg-translation-fallback-model',
      'cfg-summary-model',
      'cfg-summary-fallback-model',
      'cfg-title-model',
      'cfg-title-fallback-model',
      'cfg-notes-ai-model',
      'cfg-notes-ai-fallback-model',
      'ai-opt-model'
    ];

    const allModels = this.getAllAvailableModels();
    const disabled = this.getDisabledModels();
    const enabledModels = allModels.filter(m => !disabled.includes(m.id));

    const googleEnabled = enabledModels.filter(m => m.provider === 'google');
    const mistralEnabled = enabledModels.filter(m => m.provider === 'mistral');
    const infomaniakEnabled = enabledModels.filter(m => m.provider === 'infomaniak');

    selectIds.forEach(id => {
      const selectEl = document.getElementById(id);
      if (!selectEl) return;

      const currentVal = selectEl.value;

      let html = '';
      if (googleEnabled.length > 0) {
        html += '<optgroup label="── Google Gemini ──">';
        googleEnabled.forEach(m => {
          html += `<option value="${m.id}">${m.name}</option>`;
        });
        html += '</optgroup>';
      }

      if (mistralEnabled.length > 0) {
        html += '<optgroup label="── Mistral AI ──">';
        mistralEnabled.forEach(m => {
          html += `<option value="${m.id}">${m.name}</option>`;
        });
        html += '</optgroup>';
      }

      if (infomaniakEnabled.length > 0) {
        html += '<optgroup label="── Infomaniak Swiss AI ──">';
        infomaniakEnabled.forEach(m => {
          html += `<option value="${m.id}">${m.name}</option>`;
        });
        html += '</optgroup>';
      }

      if (enabledModels.length === 0) {
        html = '<option value="" disabled>(Aucun modèle actif - activez-en dans la liste)</option>';
      }

      selectEl.innerHTML = html;

      // Restaurer la sélection si toujours disponible
      if (currentVal && enabledModels.some(m => m.id === currentVal)) {
        selectEl.value = currentVal;
      } else if (enabledModels.length > 0) {
        selectEl.value = enabledModels[0].id;
      }
    });

    this.syncAllModelPairs(false);
  },

  async fetchGeminiModels() {
    const btn = document.getElementById('btn-fetch-gemini-models');
    const icon = document.getElementById('svg-fetch-gemini-icon');
    const keyInput = document.getElementById('cfg-gemini-key');
    const apiKey = keyInput?.value?.trim() || this.config.gemini_api_key || '';

    if (!apiKey) {
      App.showToast('Veuillez renseigner votre clé API Google Gemini ci-dessus.');
      keyInput?.focus();
      return;
    }

    if (btn) btn.disabled = true;
    if (icon) icon.classList.add('spin-clockwise');

    try {
      const res = await API.call('fetch_gemini_models', { api_key: apiKey });
      if (res && res.success && Array.isArray(res.models)) {
        this.discoveredGeminiModels = res.models;
        this.renderModelsVisibilityList();
        this.renderAllModelSelects();
        App.showToast(`✓ ${res.models.length} modèles Gemini récupérés avec succès depuis Google !`);
      } else {
        App.showToast(`Erreur Google API : ${res?.error || 'Impossible de récupérer les modèles'}`);
      }
    } catch (e) {
      console.error('Erreur fetch_gemini_models', e);
      App.showToast(`Erreur de connexion : ${e}`);
    } finally {
      if (btn) btn.disabled = false;
      if (icon) icon.classList.remove('spin-clockwise');
    }
  },

  initModelSelectPairs() {
    const pairs = [
      { primary: 'cfg-chat-model', fallback: 'cfg-chat-fallback-model', label: 'Chat' },
      { primary: 'cfg-synthesis-model', fallback: 'cfg-synthesis-fallback-model', label: 'Synthèse' },
      { primary: 'cfg-translation-model', fallback: 'cfg-translation-fallback-model', label: 'Traduction' },
      { primary: 'cfg-summary-model', fallback: 'cfg-summary-fallback-model', label: 'Résumé' },
      { primary: 'cfg-title-model', fallback: 'cfg-title-fallback-model', label: 'Titres d\'historique' },
      { primary: 'cfg-notes-ai-model', fallback: 'cfg-notes-ai-fallback-model', label: 'Notes (Titres & Tags)' }
    ];

    pairs.forEach(({ primary, fallback, label }) => {
      const pEl = document.getElementById(primary);
      const fEl = document.getElementById(fallback);
      if (!pEl || !fEl) return;

      pEl.addEventListener('change', () => {
        this.syncModelPair(primary, fallback, label, true);
        this.save();
      });

      fEl.addEventListener('change', () => {
        if (fEl.value === pEl.value) {
          const alternate = this.getSmartFallbackModel(pEl.value, fEl);
          if (alternate) {
            fEl.value = alternate;
            App.showToast(`Le modèle de secours (${label}) doit être distinct du modèle principal.`);
          }
        }
        this.syncModelPair(primary, fallback, label, false);
        this.save();
      });
    });

    this.syncAllModelPairs(false);
  },

  syncAllModelPairs(isUserChange = false) {
    const pairs = [
      { primary: 'cfg-chat-model', fallback: 'cfg-chat-fallback-model', label: 'Chat' },
      { primary: 'cfg-synthesis-model', fallback: 'cfg-synthesis-fallback-model', label: 'Synthèse' },
      { primary: 'cfg-translation-model', fallback: 'cfg-translation-fallback-model', label: 'Traduction' },
      { primary: 'cfg-summary-model', fallback: 'cfg-summary-fallback-model', label: 'Résumé' },
      { primary: 'cfg-title-model', fallback: 'cfg-title-fallback-model', label: 'Titres d\'historique' },
      { primary: 'cfg-notes-ai-model', fallback: 'cfg-notes-ai-fallback-model', label: 'Notes (Titres & Tags)' }
    ];

    pairs.forEach(({ primary, fallback, label }) => {
      this.syncModelPair(primary, fallback, label, isUserChange);
    });
  },

  syncModelPair(primaryId, fallbackId, label, isUserChange = false) {
    const pEl = document.getElementById(primaryId);
    const fEl = document.getElementById(fallbackId);
    if (!pEl || !fEl) return;

    const pVal = pEl.value;
    const fVal = fEl.value;

    // Désactiver l'option identique dans le sélecteur de secours
    Array.from(fEl.options).forEach(opt => {
      if (opt.value === pVal) {
        opt.disabled = true;
        if (!opt.text.includes('(Indisponible en secours)')) {
          opt.dataset.origText = opt.text;
          opt.text = `${opt.text} (Indisponible en secours)`;
        }
      } else {
        opt.disabled = false;
        if (opt.dataset.origText) {
          opt.text = opt.dataset.origText;
          delete opt.dataset.origText;
        }
      }
    });

    // Si le fallback a la même valeur que le principal, basculer vers un modèle alternatif distinct
    if (fVal === pVal) {
      const alternate = this.getSmartFallbackModel(pVal, fEl);
      if (alternate) {
        fEl.value = alternate;
        if (isUserChange) {
          App.showToast(`Modèle de secours (${label}) ajusté : distinct du modèle principal.`);
        }
      }
    }
  },

  getSmartFallbackModel(primaryModel, fallbackSelectEl) {
    // Ordre de priorité intelligent pour le fallback
    const defaultsOrder = [
      'gemini-2.0-flash',
      'gemini-2.5-flash',
      'gemini-2.0-flash-lite',
      'gemini-1.5-flash',
      'gemini-2.5-pro',
      'gemini-1.5-pro',
      'mistral-small-latest',
      'mistral-large-latest',
      'mistralai/Ministral-3-14B-Instruct-2512',
      'mistralai/Mistral-Small-4-119B-2603',
      'Qwen/Qwen3.5-122B-A10B-FP8'
    ];

    for (const model of defaultsOrder) {
      if (model !== primaryModel && this.isModelEnabled(model)) {
        const opt = fallbackSelectEl.querySelector(`option[value="${model}"]`);
        if (opt && !opt.disabled) return model;
      }
    }

    // Premier choix valide disponible
    for (const opt of fallbackSelectEl.options) {
      if (opt.value && opt.value !== primaryModel && !opt.disabled) {
        return opt.value;
      }
    }
    return '';
  },

  async loadStepBibleStatus() {
    const textEl = document.getElementById('stepbible-status-text');
    const dotEl = document.getElementById('stepbible-status-dot');
    try {
      const stats = await API.call('get_stepbible_status');
      if (stats && stats.installed) {
        textEl.textContent = `Base installée : ${stats.total_words.toLocaleString()} mots (AT Hébreu : ${stats.ot_words.toLocaleString()}, NT Grec : ${stats.nt_words.toLocaleString()})`;
        dotEl.style.color = '#10B981';
      } else {
        textEl.textContent = 'Base de données originale non installée.';
        dotEl.style.color = '#F59E0B';
      }
    } catch (e) {
      textEl.textContent = 'État non disponible';
    }
  },

  async loadDictionaries() {
    const listEl = document.getElementById('dict-reorder-list');
    listEl.innerHTML = '';
    try {
      this.dictionaries = await API.call('get_dictionaries') || [];
      this.dictionaries.forEach((d, idx) => {
        const item = document.createElement('div');
        item.className = 'dict-item-row';
        item.innerHTML = `
          <span class="prio-tag">#${idx + 1}</span>
          <button class="btn-prio-move" data-dir="-1" ${idx === 0 ? 'disabled' : ''}>▲</button>
          <button class="btn-prio-move" data-dir="1" ${idx === this.dictionaries.length - 1 ? 'disabled' : ''}>▼</button>
          <label class="custom-checkbox" style="margin-left: 8px;">
            <input type="checkbox" ${d.enabled !== false ? 'checked' : ''} data-dict-id="${d.id}">
            <span>${d.name} ${d.count ? `(${d.count.toLocaleString()} articles)` : ''}</span>
          </label>
        `;

        item.querySelectorAll('.btn-prio-move').forEach(btn => {
          btn.addEventListener('click', () => {
            const dir = parseInt(btn.dataset.dir);
            this.moveDictionaryPriority(idx, dir);
          });
        });

        item.querySelector('input[type="checkbox"]').addEventListener('change', (e) => {
          d.enabled = e.target.checked;
          API.call('save_dictionaries', this.dictionaries);
        });

        listEl.appendChild(item);
      });
    } catch (e) {
      console.error('Erreur chargement dictionnaires:', e);
    }
  },

  moveDictionaryPriority(idx, direction) {
    const targetIdx = idx + direction;
    if (targetIdx >= 0 && targetIdx < this.dictionaries.length) {
      const temp = this.dictionaries[idx];
      this.dictionaries[idx] = this.dictionaries[targetIdx];
      this.dictionaries[targetIdx] = temp;
      API.call('save_dictionaries', this.dictionaries);
      this.loadDictionaries();
    }
  },

  async save() {
    const newCfg = { ...this.config };
    newCfg.enable_ai = document.getElementById('cfg-enable-ai')?.checked !== false;
    newCfg.theme = document.getElementById('cfg-theme').value;
    newCfg.theme_palette = document.getElementById('cfg-theme-palette')?.value || 'dark-slate';
    newCfg.reading_bg = document.getElementById('cfg-reading-bg')?.value || 'auto';
    newCfg.font_family = document.getElementById('cfg-font-family').value;
    newCfg.font_size = parseInt(document.getElementById('cfg-font-size').value);
    newCfg.line_spacing = parseInt(document.getElementById('cfg-line-spacing').value);

    // Options Mode Historique & Immersion Époque
    newCfg.vintage_mode = document.getElementById('cfg-vintage-mode')?.checked !== false;
    newCfg.vintage_scope = document.querySelector('input[name="cfg-vintage-scope"]:checked')?.value || 'auto';
    newCfg.vintage_intensity = document.querySelector('input[name="cfg-vintage-intensity"]:checked')?.value || 'subtle';
    if (typeof VintageThemeManager !== 'undefined') {
      VintageThemeManager.init(newCfg);
    }

    newCfg.show_diff_percentage = document.getElementById('cfg-diff-pct').checked;
    newCfg.show_diff_highlights = document.getElementById('cfg-diff-highlight').checked;
    if (document.getElementById('cfg-show-chap-dividers')) {
      newCfg.show_chapter_dividers = document.getElementById('cfg-show-chap-dividers').checked;
    }
    if (document.getElementById('cfg-show-geo-pins')) {
      newCfg.show_geo_pins = document.getElementById('cfg-show-geo-pins').checked;
      const ws = document.getElementById('reader-workspace');
      if (ws) ws.classList.toggle('hide-geo-pins', !newCfg.show_geo_pins);
      const chkGeo = document.getElementById('opt-show-geo-pins');
      if (chkGeo) chkGeo.checked = newCfg.show_geo_pins;
    }
    if (document.getElementById('cfg-full-width')) {
      newCfg.full_width_reading = document.getElementById('cfg-full-width').checked;
    }

    newCfg.interlinear_show_surface = document.getElementById('cfg-inter-surface').checked;
    newCfg.interlinear_show_lemma = document.getElementById('cfg-inter-lemma').checked;
    newCfg.interlinear_show_translit = document.getElementById('cfg-inter-translit').checked;
    newCfg.interlinear_show_strong = document.getElementById('cfg-inter-strong').checked;

    newCfg.max_original_verses_for_llm = parseInt(document.getElementById('cfg-max-orig-verses').value);
    newCfg.notes_directory = document.getElementById('cfg-notes-dir').value.trim();
    if (document.getElementById('cfg-highlights-file')) {
      newCfg.highlights_file = document.getElementById('cfg-highlights-file').value.trim();
    }
    if (document.getElementById('cfg-ebooks-dir')) {
      newCfg.ebooks_dir = document.getElementById('cfg-ebooks-dir').value.trim();
    }
    newCfg.include_notes_in_ai = document.getElementById('cfg-include-notes-ai').checked;

    newCfg.chat_model = document.getElementById('cfg-chat-model').value;
    if (document.getElementById('cfg-chat-fallback-model')) {
      let fb = document.getElementById('cfg-chat-fallback-model').value;
      if (fb === newCfg.chat_model) {
        fb = this.getSmartFallbackModel(newCfg.chat_model, document.getElementById('cfg-chat-fallback-model'));
        document.getElementById('cfg-chat-fallback-model').value = fb;
      }
      newCfg.chat_fallback_model = fb;
    }
    if (document.getElementById('cfg-synthesis-model')) {
      newCfg.synthesis_model = document.getElementById('cfg-synthesis-model').value;
    }
    if (document.getElementById('cfg-synthesis-fallback-model')) {
      let fb = document.getElementById('cfg-synthesis-fallback-model').value;
      if (fb === newCfg.synthesis_model) {
        fb = this.getSmartFallbackModel(newCfg.synthesis_model, document.getElementById('cfg-synthesis-fallback-model'));
        document.getElementById('cfg-synthesis-fallback-model').value = fb;
      }
      newCfg.synthesis_fallback_model = fb;
    }
    if (document.getElementById('cfg-synthesis-max-verses')) {
      newCfg.synthesis_max_verses = parseInt(document.getElementById('cfg-synthesis-max-verses').value) || 5;
    }
    if (document.getElementById('cfg-translation-model')) {
      newCfg.translation_model = document.getElementById('cfg-translation-model').value;
    }
    if (document.getElementById('cfg-translation-fallback-model')) {
      let fb = document.getElementById('cfg-translation-fallback-model').value;
      if (fb === newCfg.translation_model) {
        fb = this.getSmartFallbackModel(newCfg.translation_model, document.getElementById('cfg-translation-fallback-model'));
        document.getElementById('cfg-translation-fallback-model').value = fb;
      }
      newCfg.translation_fallback_model = fb;
    }
    if (document.getElementById('cfg-summary-model')) {
      newCfg.summary_model = document.getElementById('cfg-summary-model').value;
    }
    if (document.getElementById('cfg-summary-fallback-model')) {
      let fb = document.getElementById('cfg-summary-fallback-model').value;
      if (fb === newCfg.summary_model) {
        fb = this.getSmartFallbackModel(newCfg.summary_model, document.getElementById('cfg-summary-fallback-model'));
        document.getElementById('cfg-summary-fallback-model').value = fb;
      }
      newCfg.summary_fallback_model = fb;
    }
    if (document.getElementById('cfg-title-model')) {
      newCfg.title_model = document.getElementById('cfg-title-model').value;
    }
    if (document.getElementById('cfg-title-fallback-model')) {
      let fb = document.getElementById('cfg-title-fallback-model').value;
      if (fb === newCfg.title_model) {
        fb = this.getSmartFallbackModel(newCfg.title_model, document.getElementById('cfg-title-fallback-model'));
        document.getElementById('cfg-title-fallback-model').value = fb;
      }
      newCfg.title_fallback_model = fb;
    }
    if (document.getElementById('cfg-notes-ai-model')) {
      newCfg.notes_ai_model = document.getElementById('cfg-notes-ai-model').value;
    }
    if (document.getElementById('cfg-notes-ai-fallback-model')) {
      let fb = document.getElementById('cfg-notes-ai-fallback-model').value;
      if (fb === newCfg.notes_ai_model) {
        fb = this.getSmartFallbackModel(newCfg.notes_ai_model, document.getElementById('cfg-notes-ai-fallback-model'));
        document.getElementById('cfg-notes-ai-fallback-model').value = fb;
      }
      newCfg.notes_ai_fallback_model = fb;
    }
    if (document.getElementById('cfg-summary-word-count')) {
      newCfg.summary_word_count = parseInt(document.getElementById('cfg-summary-word-count').value) || 300;
    }
    if (document.getElementById('cfg-articles-vec-mode')) {
      newCfg.articles_vectorization_mode = document.getElementById('cfg-articles-vec-mode').value;
    }
    if (document.getElementById('cfg-articles-sync-freq-select') && typeof ArticlesView !== 'undefined') {
      const val = document.getElementById('cfg-articles-sync-freq-select').value;
      if (val === 'manual' || val === 'startup') {
        ArticlesView.saveSyncPreferences({ frequency: val });
      } else {
        ArticlesView.saveSyncPreferences({ frequency: 'interval', intervalDays: parseInt(val, 10) || 3 });
      }
    }
    // Sérialisation des prompts système
    Object.values(this.PROMPT_CONFIGS).forEach(cfg => {
      if (cfg.fieldId && document.getElementById(cfg.fieldId)) {
        const configKey = cfg.fieldId.replace('cfg-', '').replace(/-/g, '_');
        newCfg[configKey] = document.getElementById(cfg.fieldId).value;
      }
    });

    newCfg.gemini_api_key = document.getElementById('cfg-gemini-key').value.trim();
    newCfg.mistral_api_key = document.getElementById('cfg-mistral-key').value.trim();
    newCfg.infomaniak_token = document.getElementById('cfg-infomaniak-token').value.trim();
    newCfg.infomaniak_product_id = document.getElementById('cfg-infomaniak-pid').value.trim();
    newCfg.disabled_models = this.getDisabledModels();

    try {
      await API.call('save_settings', newCfg);
      this.config = newCfg;
      this.updateAllPromptStatusBadges();
      App.applyTheme(newCfg.theme, newCfg.theme_palette, newCfg.reading_bg);
      App.applyFontFamily(newCfg.font_family);
      if (typeof NotesView !== 'undefined') {
        NotesView.updateAiToggleVisibility();
        NotesView.renderList();
      }
      if (typeof DrawerNotes !== 'undefined' && DrawerNotes.renderList) {
        DrawerNotes.renderList();
      }
      App.showToast('Paramètres enregistrés avec succès !');
    } catch (e) {
      alert(`Erreur d'enregistrement : ${e}`);
    }
  },

  // =========================================================
  // GESTIONNAIRE DE MODALE DE PROMPT SYSTÈME DÉDIÉE
  // =========================================================
  async openPromptModal(type) {
    this.currentEditingPrompt = type;
    const cfg = this.PROMPT_CONFIGS[type];
    const titleEl = document.getElementById('system-prompt-modal-title');
    const textarea = document.getElementById('modal-prompt-textarea');
    const btnReset = document.getElementById('btn-modal-reset-default');

    if (titleEl && cfg) {
      titleEl.textContent = cfg.title;
    }

    if (btnReset) {
      btnReset.style.display = 'inline-flex';
      btnReset.style.alignItems = 'center';
      btnReset.style.gap = '6px';
      if (type === 'theological_profile') {
        btnReset.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path></svg><span>Régénérer via IA</span>';
      } else {
        btnReset.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg><span>Rétablir par défaut</span>';
      }
    }

    let currentVal = '';
    if (type === 'theological_profile') {
      const profile = await API.call('get_theological_profile') || {};
      currentVal = profile.system_profile_prompt || '';
    } else if (cfg && cfg.fieldId) {
      const def = cfg.defaultProp ? (this[cfg.defaultProp] || '') : '';
      currentVal = document.getElementById(cfg.fieldId)?.value || def;
    }

    if (textarea) {
      textarea.value = currentVal;
    }

    this.switchPromptModalTab('preview');
    this.updatePromptModalStats();

    const modal = document.getElementById('modal-system-prompt');
    if (modal) {
      modal.classList.remove('hidden');
    }
  },

  closePromptModal() {
    const modal = document.getElementById('modal-system-prompt');
    if (modal) {
      modal.classList.add('hidden');
    }
    this.currentEditingPrompt = null;
  },

  switchPromptModalTab(tab) {
    this.activeModalTab = tab;
    const tabEdit = document.getElementById('tab-prompt-edit');
    const tabPrev = document.getElementById('tab-prompt-preview');
    const paneEdit = document.getElementById('prompt-editor-pane');
    const panePrev = document.getElementById('prompt-preview-pane');

    if (tab === 'edit') {
      tabEdit?.classList.add('active');
      tabPrev?.classList.remove('active');
      paneEdit?.classList.remove('hidden');
      panePrev?.classList.add('hidden');
      const textarea = document.getElementById('modal-prompt-textarea');
      if (textarea) {
        setTimeout(() => textarea.focus(), 60);
      }
    } else {
      tabPrev?.classList.add('active');
      tabEdit?.classList.remove('active');
      panePrev?.classList.remove('hidden');
      paneEdit?.classList.add('hidden');
      this.renderPromptPreview();
    }
  },

  updatePromptModalStats() {
    const val = document.getElementById('modal-prompt-textarea')?.value || '';
    const charCount = val.length;
    const lineCount = val ? val.split('\n').length : 0;

    const charEl = document.getElementById('prompt-char-count');
    const lineEl = document.getElementById('prompt-line-count');
    const badgeEl = document.getElementById('modal-prompt-status-badge');

    if (charEl) charEl.textContent = `${charCount.toLocaleString()} caractères`;
    if (lineEl) lineEl.textContent = `${lineCount.toLocaleString()} lignes`;

    if (badgeEl && this.currentEditingPrompt) {
      const cfg = this.PROMPT_CONFIGS[this.currentEditingPrompt];
      if (this.currentEditingPrompt === 'theological_profile') {
        const isCustom = val.trim().length > 0;
        badgeEl.textContent = isCustom ? 'Généré par IA' : 'À configurer';
        badgeEl.className = `prompt-status-badge ${isCustom ? 'is-custom' : 'is-default'}`;
      } else if (cfg && cfg.defaultProp) {
        const def = (this[cfg.defaultProp] || '').trim();
        const isDef = val.trim() === def;
        badgeEl.textContent = isDef ? 'Par défaut' : 'Personnalisé';
        badgeEl.className = `prompt-status-badge ${isDef ? 'is-default' : 'is-custom'}`;
      }
    }
  },

  renderPromptPreview() {
    const val = document.getElementById('modal-prompt-textarea')?.value || '';
    const container = document.getElementById('modal-prompt-rendered');
    if (container) {
      container.innerHTML = this.renderPromptMarkdown(val);
    }
  },

  async savePromptFromModal() {
    if (!this.currentEditingPrompt) return;
    const cfg = this.PROMPT_CONFIGS[this.currentEditingPrompt];
    const val = document.getElementById('modal-prompt-textarea')?.value || '';

    if (this.currentEditingPrompt === 'theological_profile') {
      await API.call('save_theological_profile', { system_profile_prompt: val }, false);
      this.closePromptModal();
      this.loadTheologicalProfileCard();
      if (typeof AIStudyView !== 'undefined' && AIStudyView.loadTheologicalProfileBadge) {
        AIStudyView.loadTheologicalProfileBadge();
      }
      App.showToast('Passeport Herméneutique appliqué et enregistré !');
      return;
    }

    if (cfg && cfg.fieldId) {
      const field = document.getElementById(cfg.fieldId);
      if (field) {
        field.value = val;
      }
    }

    this.closePromptModal();
    this.updateAllPromptStatusBadges();
    await this.save();
    App.showToast('Prompt système appliqué et enregistré !');
  },

  async resetPromptInModal() {
    if (!this.currentEditingPrompt) return;
    const cfg = this.PROMPT_CONFIGS[this.currentEditingPrompt];

    if (this.currentEditingPrompt === 'theological_profile') {
      const btn = document.getElementById('btn-modal-reset-default');
      if (btn) btn.innerHTML = '<span>Régénération...</span>';
      try {
        const res = await API.call('generate_theological_profile_summary');
        if (res && res.success) {
          const textarea = document.getElementById('modal-prompt-textarea');
          if (textarea) textarea.value = res.summary || '';
          this.updatePromptModalStats();
          if (this.activeModalTab === 'preview') {
            this.renderPromptPreview();
          }
          this.loadTheologicalProfileCard();
          if (typeof AIStudyView !== 'undefined' && AIStudyView.loadTheologicalProfileBadge) {
            AIStudyView.loadTheologicalProfileBadge();
          }
          App.showToast('Passeport Herméneutique régénéré par l\'IA !');
        }
      } catch (e) {
        alert('Erreur régénération : ' + (e?.message || e));
      } finally {
        if (btn) btn.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path></svg><span>Régénérer via IA</span>';
      }
      return;
    }

    if (!cfg || !cfg.defaultProp) return;
    const def = this[cfg.defaultProp] || '';
    const label = cfg.label || 'ce mode';

    if (confirm(`Voulez-vous rétablir le prompt de « ${label} » par défaut ?`)) {
      const textarea = document.getElementById('modal-prompt-textarea');
      if (textarea) {
        textarea.value = def;
        this.updatePromptModalStats();
        if (this.activeModalTab === 'preview') {
          this.renderPromptPreview();
        }
      }
      App.showToast('Prompt réinitialisé au texte par défaut');
    }
  },

  async copyPromptInModal() {
    const val = document.getElementById('modal-prompt-textarea')?.value || '';
    try {
      await navigator.clipboard.writeText(val);
      App.showToast('Prompt copié dans le presse-papiers !');
    } catch (e) {
      App.showToast('Erreur lors de la copie');
    }
  },

  updateAllPromptStatusBadges() {
    Object.values(this.PROMPT_CONFIGS).forEach(cfg => {
      if (cfg.fieldId && cfg.badgeId && cfg.defaultProp) {
        const val = (document.getElementById(cfg.fieldId)?.value || '').trim();
        const def = (this[cfg.defaultProp] || '').trim();
        const badge = document.getElementById(cfg.badgeId);
        if (badge) {
          const isDef = !val || val === def;
          badge.textContent = isDef ? 'Par défaut' : 'Personnalisé';
          badge.className = `prompt-status-badge ${isDef ? 'is-default' : 'is-custom'}`;
        }
      }
    });
  },

  renderPromptMarkdown(text) {
    if (!text || !text.trim()) {
      return '<p style="color: var(--text-muted); font-style: italic;">Prompt vide.</p>';
    }

    let md = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // 1. Blocs de code
    md = md.replace(/```([\s\S]*?)```/g, (match, p1) => {
      return `<pre><code>${p1.trim()}</code></pre>\n\n`;
    });

    // 2. Titres
    md = md.replace(/^### (.*$)/gim, '<h3>$1</h3>\n');
    md = md.replace(/^## (.*$)/gim, '<h2>$1</h2>\n');
    md = md.replace(/^# (.*$)/gim, '<h1>$1</h1>\n');

    // 3. Citations
    md = md.replace(/^\&gt; (.*$)/gim, '<blockquote>$1</blockquote>\n');

    // 4. Listes à puces & numérotées
    md = md.replace(/^[\-\*] (.*$)/gim, '<ul><li>$1</li></ul>');
    md = md.replace(/^\d+\. (.*$)/gim, '<ol><li>$1</li></ol>');
    md = md.replace(/<\/ul>\s*<ul>/g, '').replace(/<\/ol>\s*<ol>/g, '');

    // 5. Ligne horizontale
    md = md.replace(/^---$/gim, '<hr>\n');

    // 6. Formatage en ligne
    md = md
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');

    // 7. Paragraphes
    const blocks = md.split(/\n\s*\n/);
    const htmlBlocks = blocks.map(block => {
      const b = block.trim();
      if (!b) return '';
      if (b.startsWith('<h1') || b.startsWith('<h2') || b.startsWith('<h3') || 
          b.startsWith('<pre') || b.startsWith('<blockquote') || 
          b.startsWith('<ul') || b.startsWith('<ol') || b.startsWith('<hr')) {
        return b;
      }
      return `<p>${b.replace(/\n/g, '<br>')}</p>`;
    });

    return htmlBlocks.filter(Boolean).join('\n') || '<p><br></p>';
  }
};
