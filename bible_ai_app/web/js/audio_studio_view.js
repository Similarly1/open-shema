/**
 * audio_studio_view.js — Contrôleur Studio Audio & Podcasts pour Open Shema
 * Workflow linéaire par étapes (1: Sujet & Mode -> 2: Script & Voix -> 3: Écoute & Karaoké)
 * Zéro émoji — Interface sobre, typographie soignée et animations fluides.
 */

const AudioStudioView = {
  // État local
  currentPodcast: null,
  voices: [],
  config: null,
  format: 'dialogue',
  currentStep: 1,
  studyMode: 'auto',
  focalQuestions: [],
  isGenerating: false,
  isSynthesizing: false,
  playbackRates: [1.0, 1.25, 1.5, 1.75, 2.0],
  currentRateIdx: 0,
  activeKaraokeTurnIndex: -1,
  textMode: 'literary', // 'literary' (texte soigné & grec original) ou 'phonetic' (script vocal TTS)
  activeAudioEvents: [], // Liste explicite WYSIWYG des éléments sonores (intro, bruitages, fadeout, outro)

  // Éléments DOM
  elements: {},

  showErrorToast(msg, title = 'Studio Audio') {
    if (typeof NotificationManager !== 'undefined' && NotificationManager.showInAppToast) {
      NotificationManager.showInAppToast({
        title,
        snippet: msg,
        targetView: 'audio-studio',
        type: 'error',
        tag: 'Erreur'
      });
    } else if (typeof App !== 'undefined' && App.showToast) {
      App.showToast(msg, 'error');
    }
  },

  showSuccessToast(msg, title = 'Studio Audio') {
    if (typeof NotificationManager !== 'undefined' && NotificationManager.showInAppToast) {
      NotificationManager.showInAppToast({
        title,
        snippet: msg,
        targetView: 'audio-studio',
        type: 'success',
        tag: 'Succès'
      });
    } else if (typeof App !== 'undefined' && App.showToast) {
      App.showToast(msg, 'success');
    }
  },

  init() {
    this.cacheElements();
    this.bindEvents();
    this.initContextDepthSlider();
    this.initCustomDropdowns();
    this.loadConfiguration();
    this.loadVoices();
    this.loadSoundpack();
    this.loadHistory();
    this.setupTaskManagerListener();
    this.goToStep(1);
  },

  cacheElements() {
    this.elements = {
      // Stepper Navigation
      stepBtn1: document.getElementById('as-step-btn-1'),
      stepBtn2: document.getElementById('as-step-btn-2'),
      stepBtn3: document.getElementById('as-step-btn-3'),
      stepConn12: document.getElementById('as-conn-1-2'),
      stepConn23: document.getElementById('as-conn-2-3'),

      // Panneaux des étapes
      step1Pane: document.getElementById('as-step-1-pane'),
      step2Pane: document.getElementById('as-step-2-pane'),
      step3Pane: document.getElementById('as-step-3-pane'),

      // Étape 1 : Sujet, Modes, Focal questions
      subjectInput: document.getElementById('audio-studio-subject-input'),
      btnBookPicker: document.getElementById('btn-audio-studio-book-picker'),
      btnSyncBible: document.getElementById('btn-audio-studio-sync-bible'),
      btnSuggestAxes: document.getElementById('btn-as-suggest-axes'),
      focalContainer: document.getElementById('as-focal-container'),
      focalList: document.getElementById('as-focal-list'),
      btnAddFocalQuestion: document.getElementById('btn-as-add-focal-question'),
      modesGrid: document.getElementById('as-modes-grid'),
      btnFormatDialogue: document.getElementById('btn-audio-format-dialogue'),
      btnFormatSolo: document.getElementById('btn-audio-format-solo'),
      btnFormatStep2Dialogue: document.getElementById('btn-audio-step2-format-dialogue'),
      btnFormatStep2Solo: document.getElementById('btn-audio-step2-format-solo'),
      btnGenerate: document.getElementById('btn-audio-studio-generate'),
      step1Cards: document.getElementById('as-step1-cards'),
      step1ActiveSummary: document.getElementById('as-step1-active-summary'),
      step1Heading: document.querySelector('#as-step-1-pane .as-step1-heading'),
      step1Subheading: document.querySelector('#as-step-1-pane .as-step1-subheading'),
      step1ReasoningBox: document.getElementById('as-step1-reasoning-box'),
      reasoningTimer: document.getElementById('as-reasoning-timer'),
      reasoningStepsList: document.getElementById('as-reasoning-steps-list'),

      // Options RAG
      srcBibles: document.getElementById('as-opt-src-bibles'),
      srcComms: document.getElementById('as-opt-src-comms'),
      srcDict: document.getElementById('as-opt-src-dict'),
      srcArticles: document.getElementById('as-opt-src-articles'),
      srcNotes: document.getElementById('as-opt-src-notes'),
      srcUpvr: document.getElementById('as-opt-src-upvr'),
      srcTheology: document.getElementById('as-opt-src-theology'),
      optDepthSlider: document.getElementById('as-opt-context-depth'),
      optRerank: document.getElementById('as-opt-rerank'),
      optCurator: document.getElementById('as-opt-curator'),
      optProfile: document.getElementById('as-opt-profile'),
      ctxTokens: document.getElementById('as-ctx-depth-tokens'),
      ctxTime: document.getElementById('as-ctx-depth-time'),
      ctxDesc: document.getElementById('as-ctx-depth-desc'),

      // Étape 2 : Script & Voix
      scriptHeader: document.getElementById('audio-studio-script-header'),
      episodeTitleInput: document.getElementById('audio-studio-episode-title'),
      btnClearScript: document.getElementById('btn-audio-studio-clear-script'),
      metaFormat: document.getElementById('audio-studio-meta-format'),
      metaMode: document.getElementById('audio-studio-meta-mode'),
      metaTurns: document.getElementById('audio-studio-meta-turns'),
      metaDuration: document.getElementById('audio-studio-meta-duration'),
      sourcesPillsContainer: document.getElementById('audio-studio-script-sources-pills'),
      scriptList: document.getElementById('audio-studio-script-list'),
      addTurnContainer: document.getElementById('audio-studio-add-turn-container'),
      btnAddTurn: document.getElementById('btn-audio-studio-add-turn'),
      btnAddSound: document.getElementById('btn-audio-studio-add-sound'),
      btnNavToStep1: document.getElementById('btn-as-nav-to-step1'),
      btnNavToStep3: document.getElementById('btn-as-nav-to-step3'),

      // Synthèse & Voix
      engineBadge: document.getElementById('audio-studio-engine-badge'),
      engineBtnEdge: document.getElementById('as-engine-btn-edge'),
      engineBtnGemini: document.getElementById('as-engine-btn-gemini'),
      engineBtnVoxtral: document.getElementById('as-engine-btn-voxtral'),
      engineBtnMixed: document.getElementById('as-engine-btn-mixed'),
      voicesEdgeContainer: document.getElementById('as-voices-edge-container'),
      voicesGeminiContainer: document.getElementById('as-voices-gemini-container'),
      voicesVoxtralContainer: document.getElementById('as-voices-voxtral-container'),
      voicesMixedContainer: document.getElementById('as-voices-mixed-container'),
      selectGeminiModel: document.getElementById('as-select-gemini-model'),
      geminiDialogueVoices: document.getElementById('as-gemini-dialogue-voices'),
      geminiSoloVoices: document.getElementById('as-gemini-solo-voices'),
      selectGeminiHost: document.getElementById('as-select-gemini-host'),
      selectGeminiScholar: document.getElementById('as-select-gemini-scholar'),
      selectGeminiSolo: document.getElementById('as-select-gemini-solo'),
      geminiDuplicateAlert: document.getElementById('as-gemini-duplicate-alert'),
      btnAutoFixGeminiVoices: document.getElementById('btn-as-auto-fix-gemini-voices'),
      geminiWarning: document.getElementById('as-gemini-warning'),
      linkSettingsGemini: document.getElementById('as-link-settings-gemini'),
      geminiQuotaBadge: document.getElementById('as-gemini-quota-badge'),
      inputGeminiRpd: document.getElementById('as-input-gemini-rpd'),
      inputGeminiRpm: document.getElementById('as-input-gemini-rpm'),
      inputGeminiTpm: document.getElementById('as-input-gemini-tpm'),
      selectMixedEngineHost: document.getElementById('as-select-mixed-engine-host'),
      selectMixedVoiceHost: document.getElementById('as-select-mixed-voice-host'),
      selectMixedEngineScholar: document.getElementById('as-select-mixed-engine-scholar'),
      selectMixedVoiceScholar: document.getElementById('as-select-mixed-voice-scholar'),
      mixedSoloRow: document.getElementById('as-mixed-solo-row'),
      selectMixedEngineSolo: document.getElementById('as-select-mixed-engine-solo'),
      selectMixedVoiceSolo: document.getElementById('as-select-mixed-voice-solo'),
      edgeDialogueVoices: document.getElementById('as-edge-dialogue-voices'),
      edgeSoloVoices: document.getElementById('as-edge-solo-voices'),
      selectVoiceHost: document.getElementById('as-select-voice-host'),
      selectVoiceScholar: document.getElementById('as-select-voice-scholar'),
      selectVoiceSolo: document.getElementById('as-select-voice-solo'),
      voiceDuplicateAlert: document.getElementById('as-voice-duplicate-alert'),
      btnAutoFixVoices: document.getElementById('btn-as-auto-fix-voices'),
      voxtralDialogueVoices: document.getElementById('as-voxtral-dialogue-voices'),
      voxtralSoloVoices: document.getElementById('as-voxtral-solo-voices'),
      selectVoxtralHost: document.getElementById('as-select-voxtral-host'),
      selectVoxtralScholar: document.getElementById('as-select-voxtral-scholar'),
      selectVoxtralSolo: document.getElementById('as-select-voxtral-solo'),
      voxtralDuplicateAlert: document.getElementById('as-voxtral-duplicate-alert'),
      btnAutoFixVoxtralVoices: document.getElementById('btn-as-auto-fix-voxtral-voices'),
      checkVoxtralModulate: document.getElementById('as-check-voxtral-modulate'),
      voxtralWarning: document.getElementById('as-voxtral-warning'),
      linkSettingsMistral: document.getElementById('as-link-settings-mistral'),
      inputPauseMs: document.getElementById('as-input-pause-ms'),
      checkMastering: document.getElementById('as-check-mastering'),
      checkCalmProsody: document.getElementById('as-check-calm-prosody'),
      selectRate: document.getElementById('as-select-rate'),
      checkMusicJingle: document.getElementById('as-check-music-jingle'),
      selectMusicTiming: document.getElementById('as-select-music-timing'),
      checkSfxAuto: document.getElementById('as-check-sfx-auto'),
      checkDucking: document.getElementById('as-check-ducking'),
      step2CardTitle: document.getElementById('as-step2-card-title'),
      step2ActiveSummary: document.getElementById('as-step2-active-summary'),
      step2ConfigControls: document.getElementById('as-step2-config-controls'),
      btnSynthesize: document.getElementById('btn-audio-studio-synthesize'),
      progressBox: document.getElementById('audio-studio-progress-box'),
      progressTitle: document.getElementById('audio-studio-progress-title'),
      progressPct: document.getElementById('audio-studio-progress-pct'),
      progressBarFill: document.getElementById('audio-studio-progress-bar-fill'),
      progressMsg: document.getElementById('audio-studio-progress-msg'),

      // Switch de vue de texte (Littéraire vs Phonétique TTS)
      btnModeLiterary: document.getElementById('as-btn-mode-literary'),
      btnModePhonetic: document.getElementById('as-btn-mode-phonetic'),
      textModeHint: document.getElementById('as-text-mode-hint'),
      karaokeBtnModeLiterary: document.getElementById('as-karaoke-btn-mode-literary'),
      karaokeBtnModePhonetic: document.getElementById('as-karaoke-btn-mode-phonetic'),

      // Étape 3 : Karaoké & Lecteur
      karaokeEpisodeTitle: document.getElementById('as-karaoke-episode-title'),
      karaokeEpisodeSummary: document.getElementById('as-karaoke-episode-summary'),
      karaokeScriptFlow: document.getElementById('as-karaoke-script-flow'),
      btnStep3BackToStep2: document.getElementById('btn-as-step3-back-to-step2'),
      btnStep3NewEpisode: document.getElementById('btn-as-step3-new-episode'),
      html5Player: document.getElementById('audio-studio-html5-player'),
      playerStatus: document.getElementById('audio-studio-player-status'),
      seekbar: document.getElementById('audio-studio-seekbar'),
      timeCurrent: document.getElementById('audio-player-current-time'),
      timeDuration: document.getElementById('audio-player-duration'),
      btnPlay: document.getElementById('btn-audio-player-play'),
      iconPlay: document.getElementById('audio-player-icon-play'),
      iconPause: document.getElementById('audio-player-icon-pause'),
      btnSpeed: document.getElementById('btn-audio-player-speed'),
      btnSkip: document.getElementById('btn-audio-player-skip'),
      btnDownload: document.getElementById('btn-audio-player-download'),
      btnExportNote: document.getElementById('btn-audio-player-export-note'),

      // Tiroir Historique
      btnHistoryDrawer: document.getElementById('btn-as-history-drawer-toggle'),
      historyCounterBadge: document.getElementById('as-history-counter-badge'),
      historyBackdrop: document.getElementById('as-history-backdrop'),
      historyDrawer: document.getElementById('as-history-drawer'),
      btnCloseHistoryDrawer: document.getElementById('btn-as-history-drawer-close'),
      historyList: document.getElementById('audio-studio-history-list'),
      btnRefreshHistory: document.getElementById('btn-audio-studio-refresh-history')
    };
  },

  bindEvents() {
    const el = this.elements;

    // 0. Stepper navigation directe
    el.stepBtn1?.addEventListener('click', () => this.goToStep(1));
    el.stepBtn2?.addEventListener('click', () => this.goToStep(2));
    el.stepBtn3?.addEventListener('click', () => this.goToStep(3));

    // Boutons de navigation inter-étapes
    el.btnNavToStep1?.addEventListener('click', () => this.goToStep(1));
    el.btnNavToStep3?.addEventListener('click', () => this.goToStep(3));
    el.btnStep3BackToStep2?.addEventListener('click', () => this.goToStep(2));
    el.btnStep3NewEpisode?.addEventListener('click', () => this.newEpisode());

    // Tiroir Historique
    el.btnHistoryDrawer?.addEventListener('click', () => this.toggleHistoryDrawer(true));
    el.btnCloseHistoryDrawer?.addEventListener('click', () => this.toggleHistoryDrawer(false));
    el.historyBackdrop?.addEventListener('click', () => this.toggleHistoryDrawer(false));

    // Modes d'Étude
    const modeChips = el.modesGrid?.querySelectorAll('.as-mode-chip') || [];
    modeChips.forEach(chip => {
      chip.addEventListener('click', () => {
        const mode = chip.dataset.mode || 'auto';
        this.setStudyMode(mode);
      });
    });

    // Co-construction : Suggestion d'axes & questions clés
    el.btnSuggestAxes?.addEventListener('click', () => this.suggestFocusQuestions());
    el.btnAddFocalQuestion?.addEventListener('click', () => this.addCustomFocalQuestion());

    // 1. Sélecteur de format Dialogue / Solo (Étape 1 et Étape 2)
    el.btnFormatDialogue?.addEventListener('click', () => this.setFormat('dialogue'));
    el.btnFormatSolo?.addEventListener('click', () => this.setFormat('solo'));
    el.btnFormatStep2Dialogue?.addEventListener('click', () => this.setFormat('dialogue'));
    el.btnFormatStep2Solo?.addEventListener('click', () => this.setFormat('solo'));

    // 1a. Synchronisation dynamique des sources RAG avec persistance et réglages globaux
    const handleSourceChange = () => {
      const sources = this.collectSourcesOptions().sources;
      API.call('audio_studio_save_config', { sources });

      // Synchroniser avec SettingsView
      if (typeof SettingsView !== 'undefined' && SettingsView.config) {
        SettingsView.config.include_notes_in_ai = sources.notes;
        SettingsView.config.include_upvr_in_ai = sources.upvr;
      }
      const chkCfgNotes = document.getElementById('cfg-include-notes-ai');
      if (chkCfgNotes) chkCfgNotes.checked = sources.notes;
      const chkAiNotes = document.getElementById('ai-opt-src-notes');
      if (chkAiNotes) chkAiNotes.checked = sources.notes;

      const chkCfgUpvr = document.getElementById('cfg-include-upvr-ai');
      if (chkCfgUpvr) chkCfgUpvr.checked = sources.upvr;
      const chkAiUpvr = document.getElementById('ai-opt-src-upvr');
      if (chkAiUpvr) chkAiUpvr.checked = sources.upvr;
    };

    [el.srcBibles, el.srcComms, el.srcDict, el.srcArticles, el.srcNotes, el.srcUpvr, el.srcTheology].forEach(cb => {
      cb?.addEventListener('change', handleSourceChange);
    });

    el.optDepthSlider?.addEventListener('change', () => {
      API.call('audio_studio_save_config', { context_depth: parseInt(el.optDepthSlider.value, 10) });
    });
    el.optRerank?.addEventListener('change', () => {
      API.call('audio_studio_save_config', { enable_rerank: el.optRerank.checked });
    });
    el.optCurator?.addEventListener('change', () => {
      API.call('audio_studio_save_config', { enable_curator: el.optCurator.checked });
    });
    el.optProfile?.addEventListener('change', () => {
      API.call('audio_studio_save_config', { include_profile: el.optProfile.checked });
    });

    // 1b. Sélecteur de moteur audio interactif (Edge-TTS, Gemini, Voxtral, Mixed)
    el.engineBtnEdge?.addEventListener('click', () => this.setEngine('edge_tts'));
    el.engineBtnGemini?.addEventListener('click', () => this.setEngine('gemini_tts'));
    el.engineBtnVoxtral?.addEventListener('click', () => this.setEngine('voxtral'));
    el.engineBtnMixed?.addEventListener('click', () => this.setEngine('mixed'));

    // 1c. Changement direct des voix et synchronisation intelligente de la paire (Edge-TTS)
    el.selectVoiceHost?.addEventListener('change', () => {
      this.syncVoicePair(true, 'host');
    });
    el.selectVoiceScholar?.addEventListener('change', () => {
      this.syncVoicePair(true, 'scholar');
    });
    el.btnAutoFixVoices?.addEventListener('click', () => {
      this.syncVoicePair(true, 'host', true);
    });
    el.selectVoiceSolo?.addEventListener('change', (e) => {
      this.saveVoiceOption({ voice_solo: e.target.value });
      this.updateVoiceSummary();
      this.updateTurnCardsVoiceLabels();
    });

    // 1c bis. Changement des voix et synchronisation intelligente de la paire (Mistral Voxtral)
    el.selectVoxtralHost?.addEventListener('change', () => {
      this.syncVoxtralVoicePair(true, 'host');
    });
    el.selectVoxtralScholar?.addEventListener('change', () => {
      this.syncVoxtralVoicePair(true, 'scholar');
    });
    el.btnAutoFixVoxtralVoices?.addEventListener('click', () => {
      this.syncVoxtralVoicePair(true, 'host', true);
    });
    el.selectVoxtralSolo?.addEventListener('change', (e) => {
      this.saveVoiceOption({ voxtral_voice_solo: e.target.value });
      this.updateVoiceSummary();
      this.updateTurnCardsVoiceLabels();
    });
    el.checkVoxtralModulate?.addEventListener('change', (e) => {
      this.saveVoiceOption({ voxtral_modulate: e.target.checked });
    });

    // 1c ter. Voix Google Gemini Flash TTS
    el.selectGeminiModel?.addEventListener('change', (e) => {
      this.saveVoiceOption({ gemini_model: e.target.value });
    });
    el.selectGeminiHost?.addEventListener('change', () => {
      this.syncGeminiVoicePair(true, 'host');
    });
    el.selectGeminiScholar?.addEventListener('change', () => {
      this.syncGeminiVoicePair(true, 'scholar');
    });
    el.btnAutoFixGeminiVoices?.addEventListener('click', () => {
      this.syncGeminiVoicePair(true, 'host', true);
    });
    el.selectGeminiSolo?.addEventListener('change', (e) => {
      this.saveVoiceOption({ gemini_voice_solo: e.target.value });
      this.updateVoiceSummary();
      this.updateTurnCardsVoiceLabels();
    });
    el.inputGeminiRpd?.addEventListener('change', (e) => {
      const val = Math.max(0, parseInt(e.target.value, 10) || 0);
      e.target.value = val;
      API.call('audio_studio_save_gemini_quotas', { rpd: val });
    });
    el.inputGeminiRpm?.addEventListener('change', (e) => {
      const val = Math.max(0, parseInt(e.target.value, 10) || 0);
      e.target.value = val;
      API.call('audio_studio_save_gemini_quotas', { rpm: val });
    });
    el.inputGeminiTpm?.addEventListener('change', (e) => {
      const val = Math.max(0, parseInt(e.target.value, 10) || 0);
      e.target.value = val;
      API.call('audio_studio_save_gemini_quotas', { tpm: val });
    });

    // 1c quater. Voix en Mode Mix Multi-Moteurs
    el.selectMixedEngineHost?.addEventListener('change', (e) => {
      this.updateMixedEngineVoices('host', e.target.value);
      this.saveVoiceOption({ speaker_a_engine: e.target.value });
    });
    el.selectMixedVoiceHost?.addEventListener('change', (e) => {
      this.saveVoiceOption({ speaker_a_voice: e.target.value });
      this.updateVoiceSummary();
      this.updateTurnCardsVoiceLabels();
    });
    el.selectMixedEngineScholar?.addEventListener('change', (e) => {
      this.updateMixedEngineVoices('scholar', e.target.value);
      this.saveVoiceOption({ speaker_b_engine: e.target.value });
    });
    el.selectMixedVoiceScholar?.addEventListener('change', (e) => {
      this.saveVoiceOption({ speaker_b_voice: e.target.value });
      this.updateVoiceSummary();
      this.updateTurnCardsVoiceLabels();
    });
    el.selectMixedEngineSolo?.addEventListener('change', (e) => {
      this.updateMixedEngineVoices('solo', e.target.value);
      this.saveVoiceOption({ solo_engine: e.target.value });
    });
    el.selectMixedVoiceSolo?.addEventListener('change', (e) => {
      this.saveVoiceOption({ solo_voice: e.target.value });
      this.updateVoiceSummary();
      this.updateTurnCardsVoiceLabels();
    });

    // Liens vers paramètres
    el.linkSettingsGemini?.addEventListener('click', (e) => {
      e.preventDefault();
      if (typeof App !== 'undefined' && typeof SettingsView !== 'undefined') {
        App.showView('settings');
        SettingsView.openTab('ai');
      }
    });
    el.inputPauseMs?.addEventListener('change', (e) => {
      const ms = Math.max(100, Math.min(3000, parseInt(e.target.value, 10) || 350));
      e.target.value = ms;
      this.saveVoiceOption({ pause_ms: ms });
    });

    el.checkMastering?.addEventListener('change', (e) => {
      this.saveVoiceOption({ mastering_enabled: e.target.checked });
    });

    el.checkCalmProsody?.addEventListener('change', (e) => {
      this.saveVoiceOption({
        calm_prosody: e.target.checked,
        rate: e.target.checked ? '-6%' : '+0%',
        pitch: e.target.checked ? '-3Hz' : '+0Hz',
        inject_breaks: e.target.checked
      });
    });

    // 1d. Lien vers paramètres Mistral
    el.linkSettingsMistral?.addEventListener('click', (e) => {
      e.preventDefault();
      if (typeof App !== 'undefined' && typeof SettingsView !== 'undefined') {
        App.switchView('settings');
        SettingsView.switchToSection('ai');
      }
    });

    // 2. Sélecteur de passage biblique
    el.btnBookPicker?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openBookPicker();
    });

    // 3. Synchronisation avec le lecteur
    el.btnSyncBible?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.syncFromBibleReader();
    });

    // 4. Touche Entrée dans le champ sujet
    el.subjectInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.generateScript();
      }
    });

    // 5. Génération de script
    el.btnGenerate?.addEventListener('click', () => this.generateScript());

    // 6. Édition du titre
    el.episodeTitleInput?.addEventListener('input', (e) => {
      if (this.currentPodcast) {
        this.currentPodcast.title = e.target.value.trim() || 'Script audio';
      }
    });

    // 7. Réinitialiser le script (sans confirm bloquant)
    el.btnClearScript?.addEventListener('click', () => {
      if (this.currentPodcast) {
        this.clearScript();
        this.showSuccessToast('Script réinitialisé.');
      }
    });

    // 8. Ajouter une réplique manuelle
    el.btnAddTurn?.addEventListener('click', () => this.addManualTurn());

    // Switch de mode de texte (Littéraire vs Phonétique TTS)
    el.btnModeLiterary?.addEventListener('click', () => this.setTextMode('literary'));
    el.btnModePhonetic?.addEventListener('click', () => this.setTextMode('phonetic'));
    el.karaokeBtnModeLiterary?.addEventListener('click', () => this.setTextMode('literary'));
    el.karaokeBtnModePhonetic?.addEventListener('click', () => this.setTextMode('phonetic'));

    // 9. Synthèse audio & Habillage sonore (Soundpack)
    el.btnSynthesize?.addEventListener('click', () => this.startSynthesis());

    // Fermeture automatique des menus déroulants personnalisés au clic extérieur ou touche Échap
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.as-custom-select')) {
        this.closeAllCustomDropdowns();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeAllCustomDropdowns();
      }
    });

    // Synchronisation des labels des Custom Dropdowns lors des changements de sélection
    ['as-select-voice-host', 'as-select-voice-scholar', 'as-select-voice-solo',
     'as-select-voxtral-host', 'as-select-voxtral-scholar', 'as-select-voxtral-solo'].forEach(id => {
      document.getElementById(id)?.addEventListener('change', () => {
        this.refreshCustomDropdown(id);
      });
    });

    // Liaison dynamique des cases musique & bruitages avec la timeline sonore WYSIWYG
    el.checkMusicJingle?.addEventListener('change', () => {
      this.toggleMusicJingleEvents(el.checkMusicJingle.checked);
      if (el.checkDucking) {
        el.checkDucking.disabled = !el.checkMusicJingle.checked;
        if (el.checkDucking.parentElement) {
          el.checkDucking.parentElement.style.opacity = el.checkMusicJingle.checked ? '1' : '0.45';
        }
      }
    });

    el.checkSfxAuto?.addEventListener('change', () => {
      this.toggleSfxEvents(el.checkSfxAuto.checked);
    });

    // Ajout manuel d'un habillage sonore (jingle / bruitage)
    el.btnAddSound?.addEventListener('click', () => {
      this.addManualAudioEvent();
    });

    // 10. Lecteur Audio
    el.btnPlay?.addEventListener('click', () => this.togglePlay());
    el.btnSpeed?.addEventListener('click', () => this.cyclePlaybackSpeed());
    el.btnSkip?.addEventListener('click', () => this.skipForward(10));

    el.seekbar?.addEventListener('input', (e) => {
      if (el.html5Player && el.html5Player.duration) {
        const seekTo = (parseFloat(e.target.value) / 100) * el.html5Player.duration;
        el.html5Player.currentTime = seekTo;
      }
    });

    // Événements Audio HTML5
    if (el.html5Player) {
      el.html5Player.addEventListener('timeupdate', () => this.onAudioTimeUpdate());
      el.html5Player.addEventListener('loadedmetadata', () => this.onAudioMetadataLoaded());
      el.html5Player.addEventListener('ended', () => this.onAudioEnded());
      el.html5Player.addEventListener('play', () => this.updatePlayButtonState(true));
      el.html5Player.addEventListener('pause', () => this.updatePlayButtonState(false));
    }

    // 11. Télécharger & Exporter
    el.btnDownload?.addEventListener('click', () => this.downloadMp3());
    el.btnExportNote?.addEventListener('click', () => this.exportToNote());

    // 12. Actualiser Historique
    el.btnRefreshHistory?.addEventListener('click', () => this.loadHistory());
  },

  // =========================================================================
  // GESTION DU FORMAT (Dialogue / Solo)
  // =========================================================================

  setFormat(newFormat) {
    this.format = newFormat;
    const el = this.elements;
    const curEngine = this.config?.engine || 'edge_tts';

    if (newFormat === 'dialogue') {
      el.btnFormatDialogue?.classList.add('active');
      el.btnFormatSolo?.classList.remove('active');
      el.btnFormatStep2Dialogue?.classList.add('active');
      el.btnFormatStep2Solo?.classList.remove('active');
      if (el.metaFormat) el.metaFormat.textContent = 'Dialogue (2 voix)';

      // Edge-TTS
      if (el.edgeDialogueVoices) el.edgeDialogueVoices.style.display = 'flex';
      if (el.edgeSoloVoices) el.edgeSoloVoices.style.display = 'none';
      if (el.voiceDuplicateAlert) {
        el.voiceDuplicateAlert.style.display = (curEngine === 'edge_tts' && el.selectVoiceHost?.value === el.selectVoiceScholar?.value) ? 'block' : 'none';
      }
      this.syncVoicePair(false, 'host');

      // Gemini
      if (el.geminiDialogueVoices) el.geminiDialogueVoices.style.display = 'flex';
      if (el.geminiSoloVoices) el.geminiSoloVoices.style.display = 'none';
      if (el.geminiDuplicateAlert) {
        el.geminiDuplicateAlert.style.display = (curEngine === 'gemini_tts' && el.selectGeminiHost?.value === el.selectGeminiScholar?.value) ? 'block' : 'none';
      }
      this.syncGeminiVoicePair(false, 'host');

      // Voxtral
      if (el.voxtralDialogueVoices) el.voxtralDialogueVoices.style.display = 'flex';
      if (el.voxtralSoloVoices) el.voxtralSoloVoices.style.display = 'none';
      if (el.voxtralDuplicateAlert) {
        el.voxtralDuplicateAlert.style.display = (curEngine === 'voxtral' && el.selectVoxtralHost?.value === el.selectVoxtralScholar?.value) ? 'block' : 'none';
      }
      this.syncVoxtralVoicePair(false, 'host');

      // Mixed
      if (el.mixedSoloRow) el.mixedSoloRow.style.display = 'none';
    } else {
      el.btnFormatSolo?.classList.add('active');
      el.btnFormatDialogue?.classList.remove('active');
      el.btnFormatStep2Solo?.classList.add('active');
      el.btnFormatStep2Dialogue?.classList.remove('active');
      if (el.metaFormat) el.metaFormat.textContent = 'Chronique Solo';

      // Edge-TTS
      if (el.edgeDialogueVoices) el.edgeDialogueVoices.style.display = 'none';
      if (el.edgeSoloVoices) el.edgeSoloVoices.style.display = 'flex';
      if (el.voiceDuplicateAlert) el.voiceDuplicateAlert.style.display = 'none';

      // Gemini
      if (el.geminiDialogueVoices) el.geminiDialogueVoices.style.display = 'none';
      if (el.geminiSoloVoices) el.geminiSoloVoices.style.display = 'flex';
      if (el.geminiDuplicateAlert) el.geminiDuplicateAlert.style.display = 'none';

      // Voxtral
      if (el.voxtralDialogueVoices) el.voxtralDialogueVoices.style.display = 'none';
      if (el.voxtralSoloVoices) el.voxtralSoloVoices.style.display = 'flex';
      if (el.voxtralDuplicateAlert) el.voxtralDuplicateAlert.style.display = 'none';

      // Mixed
      if (el.mixedSoloRow) el.mixedSoloRow.style.display = 'flex';
    }
    this.updateVoiceSummary();
    this.updateTurnCardsVoiceLabels();
  },

  setEngine(engine, shouldSave = true) {
    if (!this.config) this.config = {};
    this.config.engine = engine;
    const el = this.elements;

    // Mise à jour visuelle des 4 boutons
    el.engineBtnEdge?.classList.toggle('active', engine === 'edge_tts');
    el.engineBtnGemini?.classList.toggle('active', engine === 'gemini_tts');
    el.engineBtnVoxtral?.classList.toggle('active', engine === 'voxtral');
    el.engineBtnMixed?.classList.toggle('active', engine === 'mixed');

    // Affichage du conteneur adéquat
    if (el.voicesEdgeContainer) el.voicesEdgeContainer.style.display = (engine === 'edge_tts') ? 'flex' : 'none';
    if (el.voicesGeminiContainer) el.voicesGeminiContainer.style.display = (engine === 'gemini_tts') ? 'flex' : 'none';
    if (el.voicesVoxtralContainer) el.voicesVoxtralContainer.style.display = (engine === 'voxtral') ? 'flex' : 'none';
    if (el.voicesMixedContainer) el.voicesMixedContainer.style.display = (engine === 'mixed') ? 'flex' : 'none';

    // Badge moteur
    if (el.engineBadge) {
      if (engine === 'gemini_tts') el.engineBadge.textContent = 'Google Gemini Flash';
      else if (engine === 'voxtral') el.engineBadge.textContent = 'Mistral Voxtral';
      else if (engine === 'mixed') el.engineBadge.textContent = 'Mix Multi-Moteurs';
      else el.engineBadge.textContent = 'Edge-TTS (Gratuit)';
    }

    // Avertissements clés API
    if (el.geminiWarning) {
      el.geminiWarning.style.display = (engine === 'gemini_tts' && !this.config.has_google_key) ? 'block' : 'none';
    }
    if (el.voxtralWarning) {
      el.voxtralWarning.style.display = (engine === 'voxtral' && !this.config.has_mistral_key) ? 'block' : 'none';
    }

    // Synchronisation de la paire selon le moteur actif
    if (engine === 'gemini_tts') {
      this.syncGeminiVoicePair(false, 'host');
    } else if (engine === 'voxtral') {
      this.syncVoxtralVoicePair(false, 'host');
    } else if (engine === 'mixed') {
      this.refreshMixedEngineViews();
    } else {
      this.syncVoicePair(false, 'host');
    }

    // Ré-appliquer le format actuel (dialogue vs solo) sur les nouveaux conteneurs
    if (this.format === 'solo') {
      if (el.edgeDialogueVoices) el.edgeDialogueVoices.style.display = 'none';
      if (el.edgeSoloVoices) el.edgeSoloVoices.style.display = 'flex';
      if (el.geminiDialogueVoices) el.geminiDialogueVoices.style.display = 'none';
      if (el.geminiSoloVoices) el.geminiSoloVoices.style.display = 'flex';
      if (el.voxtralDialogueVoices) el.voxtralDialogueVoices.style.display = 'none';
      if (el.voxtralSoloVoices) el.voxtralSoloVoices.style.display = 'flex';
      if (el.mixedSoloRow) el.mixedSoloRow.style.display = 'flex';
    } else {
      if (el.edgeDialogueVoices) el.edgeDialogueVoices.style.display = 'flex';
      if (el.edgeSoloVoices) el.edgeSoloVoices.style.display = 'none';
      if (el.geminiDialogueVoices) el.geminiDialogueVoices.style.display = 'flex';
      if (el.geminiSoloVoices) el.geminiSoloVoices.style.display = 'none';
      if (el.voxtralDialogueVoices) el.voxtralDialogueVoices.style.display = 'flex';
      if (el.voxtralSoloVoices) el.voxtralSoloVoices.style.display = 'none';
      if (el.mixedSoloRow) el.mixedSoloRow.style.display = 'none';
    }

    this.updateVoiceSummary();
    this.updateTurnCardsVoiceLabels();

    if (shouldSave) {
      API.call('audio_studio_save_config', { engine });
    }
  },

  async saveVoiceOption(settingsUpdate) {
    if (!this.config) this.config = {};
    Object.assign(this.config, settingsUpdate);
    this.updateVoiceSummary();
    try {
      await API.call('audio_studio_save_config', settingsUpdate);
    } catch (err) {
      console.warn('[AudioStudioView] Erreur sauvegarde option voix:', err);
    }
  },

  // =========================================================================
  // JAUGE DE PROFONDEUR DE CONTEXTE RAG (Zéro émoji)
  // =========================================================================

  initContextDepthSlider() {
    const slider = this.elements.optDepthSlider;
    if (!slider) return;

    slider.addEventListener('input', () => this.updateContextDepthUI());
    this.updateContextDepthUI();
  },

  updateContextDepthUI() {
    const slider = this.elements.optDepthSlider;
    const tokensEl = this.elements.ctxTokens;
    const timeEl = this.elements.ctxTime;
    const descEl = this.elements.ctxDesc;
    if (!slider) return;

    const levels = [
      {
        tokens: '~250 tokens / source',
        time: '≈ 15–25 s',
        desc: 'Synthèse rapide — extrait les passages clés essentiels.'
      },
      {
        tokens: '~600 tokens / source',
        time: '≈ 30–50 s',
        desc: 'Contexte équilibré — bon compromis rapidité et richesse doctrinale.'
      },
      {
        tokens: '~1 200 tokens / source',
        time: '≈ 60–120 s',
        desc: 'Étude détaillée — analyse fouillée des corpus et lexiques.'
      },
      {
        tokens: '~2 000 tokens / source',
        time: '≈ 2–4 min',
        desc: 'Corpus approfondi — mobilise les chapitres et traités complets.'
      }
    ];

    const v = isNaN(parseInt(slider.value, 10)) ? 1 : parseInt(slider.value, 10);
    const l = levels[Math.min(Math.max(v, 0), levels.length - 1)] || levels[1];
    if (l) {
      if (tokensEl) tokensEl.textContent = l.tokens;
      if (timeEl) timeEl.textContent = l.time;
      if (descEl) descEl.textContent = l.desc;
    }
  },

  // =========================================================================
  // CHARGEMENT DE LA CONFIGURATION ET DES VOIX
  // =========================================================================

  async loadConfiguration() {
    try {
      const res = await API.call('audio_studio_get_config');
      if (res && typeof res === 'object') {
        this.config = res;
        const el = this.elements;

        // Corpus
        if (res.sources) {
          const globalNotes = (typeof SettingsView !== 'undefined' && SettingsView.config && typeof SettingsView.config.include_notes_in_ai !== 'undefined')
            ? (SettingsView.config.include_notes_in_ai !== false)
            : (res.sources.notes !== false);
          const globalUpvr = (typeof SettingsView !== 'undefined' && SettingsView.config && typeof SettingsView.config.include_upvr_in_ai !== 'undefined')
            ? (SettingsView.config.include_upvr_in_ai !== false)
            : (res.sources.upvr !== false);

          if (el.srcBibles) el.srcBibles.checked = res.sources.bibles !== false;
          if (el.srcComms) el.srcComms.checked = res.sources.commentaries !== false;
          if (el.srcDict) el.srcDict.checked = res.sources.dictionaries !== false;
          if (el.srcArticles) el.srcArticles.checked = res.sources.articles !== false;
          if (el.srcNotes) el.srcNotes.checked = globalNotes;
          if (el.srcUpvr) el.srcUpvr.checked = globalUpvr;
          if (el.srcTheology) el.srcTheology.checked = res.sources.theology !== false;
        }

        // Profondeur & Options
        if (el.optDepthSlider && typeof res.context_depth !== 'undefined') {
          el.optDepthSlider.value = res.context_depth;
          this.updateContextDepthUI();
        }
        if (el.optRerank && typeof res.enable_rerank !== 'undefined') {
          el.optRerank.checked = res.enable_rerank !== false;
        }
        if (el.optCurator && typeof res.enable_curator !== 'undefined') {
          el.optCurator.checked = res.enable_curator === true;
        }
        if (el.optProfile && typeof res.include_profile !== 'undefined') {
          el.optProfile.checked = res.include_profile !== false;
        }

        // Moteur et Voix
        const engine = res.engine || 'edge_tts';
        this.setEngine(engine, false);

        if (el.selectVoiceHost && res.voice_speaker_a) el.selectVoiceHost.value = res.voice_speaker_a;
        if (el.selectVoiceScholar && res.voice_speaker_b) el.selectVoiceScholar.value = res.voice_speaker_b;
        if (el.selectVoiceSolo && res.voice_solo) el.selectVoiceSolo.value = res.voice_solo;

        if (el.selectVoxtralHost && res.voxtral_voice_speaker_a) el.selectVoxtralHost.value = res.voxtral_voice_speaker_a;
        if (el.selectVoxtralScholar && res.voxtral_voice_speaker_b) el.selectVoxtralScholar.value = res.voxtral_voice_speaker_b;
        if (el.selectVoxtralSolo && res.voxtral_voice_solo) el.selectVoxtralSolo.value = res.voxtral_voice_solo;

        if (el.checkVoxtralModulate) el.checkVoxtralModulate.checked = res.voxtral_modulate !== false;
        if (el.inputPauseMs && res.pause_ms) el.inputPauseMs.value = res.pause_ms;
        if (el.checkMastering && typeof res.mastering_enabled !== 'undefined') {
          el.checkMastering.checked = res.mastering_enabled !== false;
        }
        if (el.checkCalmProsody && typeof res.calm_prosody !== 'undefined') {
          el.checkCalmProsody.checked = res.calm_prosody !== false;
        }

        // Habillage sonore par défaut : voix pure sans musique ni bruitage tant que l'utilisateur ne coche pas explicitement
        if (el.checkMusicJingle) el.checkMusicJingle.checked = false;
        if (el.checkSfxAuto) el.checkSfxAuto.checked = false;
        if (el.checkDucking && typeof res.ducking_enabled !== 'undefined') {
          el.checkDucking.checked = res.ducking_enabled !== false;
        }

        // Mise à jour de l'affichage du format actuel
        this.setFormat(this.format);
        this.refreshAllCustomDropdowns();
        this.updateVoiceSummary();
      }
    } catch (err) {
      console.warn('[AudioStudioView] Erreur chargement configuration:', err);
    }
  },

  async loadVoices() {
    try {
      const res = await API.call('audio_studio_get_voices');
      if (res && (res.voices || res.edge_tts || res.voxtral)) {
        this.voices = res.voices || res.edge_tts || [];
        this.voxtralVoices = res.voxtral || [];
        this.populateVoiceSelects(res);
        this.updateVoiceSummary();
      }
    } catch (err) {
      console.warn('[AudioStudioView] Erreur chargement voix:', err);
    }
  },

  populateVoiceSelects(voicesData) {
    const el = this.elements;
    const voices = voicesData.voices || voicesData.edge_tts || [];

    if (voices && voices.length > 0) {
      this.voices = voices;

      // Regrouper par région géographique francophone
      const regions = ['France', 'Belgique', 'Suisse', 'Canada'];
      const grouped = {};
      regions.forEach(r => { grouped[r] = []; });

      voices.forEach(v => {
        let reg = v.region;
        if (!reg) {
          if (v.locale?.includes('BE')) reg = 'Belgique';
          else if (v.locale?.includes('CH')) reg = 'Suisse';
          else if (v.locale?.includes('CA')) reg = 'Canada';
          else reg = 'France';
        }
        if (!grouped[reg]) grouped[reg] = [];
        grouped[reg].push(v);
      });

      const buildGroupedOpts = () => {
        let html = '';
        regions.forEach(reg => {
          const list = grouped[reg] || [];
          if (list.length > 0) {
            html += `<optgroup label="${reg}">`;
            list.forEach(v => {
              html += `<option value="${v.id}">${this.escapeHtml(v.name)}</option>`;
            });
            html += `</optgroup>`;
          }
        });
        return html;
      };

      const optHtml = buildGroupedOpts();

      if (el.selectVoiceHost) {
        const cur = this.config?.voice_speaker_a || el.selectVoiceHost.value || 'fr-FR-VivienneMultilingualNeural';
        el.selectVoiceHost.innerHTML = optHtml;
        el.selectVoiceHost.value = cur;
      }

      if (el.selectVoiceScholar) {
        const cur = this.config?.voice_speaker_b || el.selectVoiceScholar.value || 'fr-CH-FabriceNeural';
        el.selectVoiceScholar.innerHTML = optHtml;
        el.selectVoiceScholar.value = cur;
      }

      if (el.selectVoiceSolo) {
        const cur = this.config?.voice_solo || el.selectVoiceSolo.value || 'fr-CH-FabriceNeural';
        el.selectVoiceSolo.innerHTML = optHtml;
        el.selectVoiceSolo.value = cur;
      }

      // Synchronisation mutuelle de la paire de voix
      this.syncVoicePair(false, 'host');
    }

    // Filtre strict : n'afficher que les voix Voxtral en français
    const isFrenchVoxtral = (v) => {
      if (!v) return false;
      const name = (v.name || '').toLowerCase();
      const id = (v.id || '').toLowerCase();
      if (name.includes('marie') || id.includes('marie')) return true;
      const langs = Array.isArray(v.languages) ? v.languages : (typeof v.languages === 'string' ? [v.languages] : []);
      return langs.some(lang => {
        const l = String(lang).toLowerCase().replace('-', '_').trim();
        return l === 'fr' || l.startsWith('fr_') || l.includes('french') || l.includes('francais') || l.includes('français');
      });
    };
    const voxtralVoices = (voicesData.voxtral || []).filter(isFrenchVoxtral);

    if (voxtralVoices && voxtralVoices.length > 0) {
      this.voxtralVoices = voxtralVoices;

      const vGrouped = {};
      const catOrder = [];
      voxtralVoices.forEach(v => {
        const cat = v.category || 'Intonations disponibles';
        if (!vGrouped[cat]) {
          vGrouped[cat] = [];
          catOrder.push(cat);
        }
        vGrouped[cat].push(v);
      });

      let voxtralOptHtml = '';
      catOrder.forEach(cat => {
        const list = vGrouped[cat] || [];
        if (list.length > 0) {
          voxtralOptHtml += `<optgroup label="${this.escapeHtml(cat)}">`;
          list.forEach(v => {
            voxtralOptHtml += `<option value="${this.escapeHtml(v.id)}">${this.escapeHtml(v.name)}</option>`;
          });
          voxtralOptHtml += `</optgroup>`;
        }
      });

      const defaultA = voxtralVoices.find(v => v.id === 'Marie - Happy' || v.name.toLowerCase().includes('joyeuse') || v.name.toLowerCase().includes('happy'))?.id || voxtralVoices[0]?.id || 'Marie - Happy';
      const defaultB = voxtralVoices.find(v => v.id === 'Marie - Neutral' || v.name.toLowerCase().includes('neutre') || v.name.toLowerCase().includes('neutral'))?.id || voxtralVoices[1]?.id || voxtralVoices[0]?.id || 'Marie - Neutral';
      const defaultSolo = defaultB;

      if (el.selectVoxtralHost) {
        const cur = this.config?.voxtral_voice_speaker_a || (el.selectVoxtralHost.value && !el.selectVoxtralHost.value.startsWith('voxtral-') ? el.selectVoxtralHost.value : defaultA);
        el.selectVoxtralHost.innerHTML = voxtralOptHtml;
        el.selectVoxtralHost.value = cur;
      }

      if (el.selectVoxtralScholar) {
        const cur = this.config?.voxtral_voice_speaker_b || (el.selectVoxtralScholar.value && !el.selectVoxtralScholar.value.startsWith('voxtral-') ? el.selectVoxtralScholar.value : defaultB);
        el.selectVoxtralScholar.innerHTML = voxtralOptHtml;
        el.selectVoxtralScholar.value = cur;
      }

      if (el.selectVoxtralSolo) {
        const cur = this.config?.voxtral_voice_solo || (el.selectVoxtralSolo.value && !el.selectVoxtralSolo.value.startsWith('voxtral-') ? el.selectVoxtralSolo.value : defaultSolo);
        el.selectVoxtralSolo.innerHTML = voxtralOptHtml;
        el.selectVoxtralSolo.value = cur;
      }

      this.syncVoxtralVoicePair(false, 'host');
    }

    // Google Gemini Flash TTS
    const geminiVoices = voicesData.gemini_tts || [];
    if (geminiVoices && geminiVoices.length > 0) {
      this.geminiVoices = geminiVoices;
      const gGrouped = {};
      const gCatOrder = [];
      geminiVoices.forEach(v => {
        const cat = v.category || 'Catalogue Google Flash';
        if (!gGrouped[cat]) {
          gGrouped[cat] = [];
          gCatOrder.push(cat);
        }
        gGrouped[cat].push(v);
      });
      let geminiOptHtml = '';
      gCatOrder.forEach(cat => {
        const list = gGrouped[cat] || [];
        if (list.length > 0) {
          geminiOptHtml += `<optgroup label="${this.escapeHtml(cat)}">`;
          list.forEach(v => {
            geminiOptHtml += `<option value="${this.escapeHtml(v.id)}">${this.escapeHtml(v.name)}</option>`;
          });
          geminiOptHtml += `</optgroup>`;
        }
      });

      const defaultGeminiA = this.config?.gemini_voice_speaker_a || 'Puck';
      const defaultGeminiB = this.config?.gemini_voice_speaker_b || 'Charon';
      const defaultGeminiSolo = this.config?.gemini_voice_solo || 'Puck';

      if (el.selectGeminiHost) {
        el.selectGeminiHost.innerHTML = geminiOptHtml;
        el.selectGeminiHost.value = defaultGeminiA;
      }
      if (el.selectGeminiScholar) {
        el.selectGeminiScholar.innerHTML = geminiOptHtml;
        el.selectGeminiScholar.value = defaultGeminiB;
      }
      if (el.selectGeminiSolo) {
        el.selectGeminiSolo.innerHTML = geminiOptHtml;
        el.selectGeminiSolo.value = defaultGeminiSolo;
      }
      this.syncGeminiVoicePair(false, 'host');
    }

    // Modèles Gemini TTS
    const geminiModels = voicesData.gemini_models || [];
    if (geminiModels.length > 0 && el.selectGeminiModel) {
      let mHtml = '';
      geminiModels.forEach(m => {
        mHtml += `<option value="${this.escapeHtml(m.id)}">${this.escapeHtml(m.name)}</option>`;
      });
      el.selectGeminiModel.innerHTML = mHtml;
      el.selectGeminiModel.value = this.config?.gemini_model || 'gemini-3.1-flash-tts-preview';
    }

    // Quotas Gemini Flash TTS
    if (voicesData.gemini_quota) {
      const q = voicesData.gemini_quota;
      if (el.geminiQuotaBadge) {
        const rpdStr = (q.rpd_limit > 0) ? `${q.rpd_limit}` : '∞';
        el.geminiQuotaBadge.textContent = `${q.requests_today} / ${rpdStr} requêtes ajd`;
      }
      if (el.inputGeminiRpd && typeof q.rpd_limit !== 'undefined') el.inputGeminiRpd.value = q.rpd_limit;
      if (el.inputGeminiRpm && typeof q.rpm_limit !== 'undefined') el.inputGeminiRpm.value = q.rpm_limit;
      if (el.inputGeminiTpm && typeof q.tpm_limit !== 'undefined') el.inputGeminiTpm.value = q.tpm_limit;
    }

    // Mode Mix Multi-Moteurs
    this.refreshMixedEngineViews();

    this.refreshAllCustomDropdowns();
    this.updateVoiceSummary();
    this.updateTurnCardsVoiceLabels();
  },

  syncGeminiVoicePair(isUserChange = false, changedSource = 'host', forceAutoFix = false) {
    const el = this.elements;
    const v1El = el.selectGeminiHost;
    const v2El = el.selectGeminiScholar;
    if (!v1El || !v2El) return;

    let v1Val = v1El.value;
    let v2Val = v2El.value;
    const alertEl = el.geminiDuplicateAlert;

    Array.from(v2El.options).forEach(opt => {
      opt.disabled = (opt.value === v1Val);
    });
    Array.from(v1El.options).forEach(opt => {
      opt.disabled = (opt.value === v2Val);
    });

    const isDuplicate = (v1Val === v2Val);
    if (isDuplicate || forceAutoFix) {
      if (changedSource === 'host' || forceAutoFix) {
        const alt = this.getSmartAlternateGeminiVoice(v1Val, 'scholar');
        if (alt) {
          v2El.value = alt;
          v2Val = alt;
          if (isUserChange || forceAutoFix) {
            if (typeof App !== 'undefined' && App.showToast) {
              App.showToast('Voix 2 Gemini ajustée : distincte de la Voix 1 pour le dialogue.');
            }
          }
        }
      } else {
        const alt = this.getSmartAlternateGeminiVoice(v2Val, 'host');
        if (alt) {
          v1El.value = alt;
          v1Val = alt;
          if (isUserChange) {
            if (typeof App !== 'undefined' && App.showToast) {
              App.showToast('Voix 1 Gemini ajustée : distincte de la Voix 2 pour le dialogue.');
            }
          }
        }
      }
    }

    const stillDuplicate = (v1El.value === v2El.value);
    if (alertEl) {
      alertEl.style.display = (this.config?.engine === 'gemini_tts' && stillDuplicate) ? 'block' : 'none';
    }

    if (isUserChange || forceAutoFix) {
      this.saveVoiceOption({
        gemini_voice_speaker_a: v1El.value,
        gemini_voice_speaker_b: v2El.value
      });
    }
    this.updateVoiceSummary();
    this.updateTurnCardsVoiceLabels();
  },

  getSmartAlternateGeminiVoice(currentVal, targetRole) {
    if (targetRole === 'scholar') {
      if (currentVal !== 'Charon') return 'Charon';
      if (currentVal !== 'Fenrir') return 'Fenrir';
      return 'Orpheus';
    } else {
      if (currentVal !== 'Aoede') return 'Aoede';
      if (currentVal !== 'Kore') return 'Kore';
      return 'Puck';
    }
  },

  updateMixedEngineVoices(targetRole, engineVal) {
    const el = this.elements;
    let selectEl = null;
    let curVal = '';
    if (targetRole === 'host') {
      selectEl = el.selectMixedVoiceHost;
      curVal = this.config?.speaker_a_voice || '';
    } else if (targetRole === 'scholar') {
      selectEl = el.selectMixedVoiceScholar;
      curVal = this.config?.speaker_b_voice || '';
    } else {
      selectEl = el.selectMixedVoiceSolo;
      curVal = this.config?.solo_voice || '';
    }
    if (!selectEl) return;

    let voicesList = [];
    if (engineVal === 'gemini_tts') {
      voicesList = this.geminiVoices || [];
    } else if (engineVal === 'voxtral') {
      voicesList = this.voxtralVoices || [];
    } else {
      voicesList = this.voices || [];
    }

    let html = '';
    voicesList.forEach(v => {
      const id = v.id || v.name;
      const name = v.name || v.id;
      html += `<option value="${this.escapeHtml(id)}">${this.escapeHtml(name)}</option>`;
    });
    selectEl.innerHTML = html;
    if (curVal && voicesList.some(v => (v.id || v.name) === curVal)) {
      selectEl.value = curVal;
    } else if (voicesList.length > 0) {
      selectEl.value = voicesList[0].id || voicesList[0].name;
    }
  },

  refreshMixedEngineViews() {
    const el = this.elements;
    const engA = this.config?.speaker_a_engine || el.selectMixedEngineHost?.value || 'gemini_tts';
    const engB = this.config?.speaker_b_engine || el.selectMixedEngineScholar?.value || 'edge_tts';
    const engSolo = this.config?.solo_engine || el.selectMixedEngineSolo?.value || 'gemini_tts';

    if (el.selectMixedEngineHost) el.selectMixedEngineHost.value = engA;
    if (el.selectMixedEngineScholar) el.selectMixedEngineScholar.value = engB;
    if (el.selectMixedEngineSolo) el.selectMixedEngineSolo.value = engSolo;

    this.updateMixedEngineVoices('host', engA);
    this.updateMixedEngineVoices('scholar', engB);
    this.updateMixedEngineVoices('solo', engSolo);
  },

  syncVoicePair(isUserChange = false, changedSource = 'host', forceAutoFix = false) {
    const el = this.elements;
    const v1El = el.selectVoiceHost;
    const v2El = el.selectVoiceScholar;
    if (!v1El || !v2El) return;

    let v1Val = v1El.value;
    let v2Val = v2El.value;

    const alertEl = el.voiceDuplicateAlert;

    // 1. Désactiver la voix opposée dans chaque liste pour éviter la sélection directe d'un doublon
    Array.from(v2El.options).forEach(opt => {
      if (opt.value === v1Val) {
        opt.disabled = true;
        if (!opt.text.includes('(Sélectionnée en Voix 1)')) {
          opt.dataset.origText = opt.dataset.origText || opt.text;
          opt.text = `${opt.dataset.origText} (Sélectionnée en Voix 1)`;
        }
      } else {
        opt.disabled = false;
        if (opt.dataset.origText) {
          opt.text = opt.dataset.origText;
        }
      }
    });

    Array.from(v1El.options).forEach(opt => {
      if (opt.value === v2Val) {
        opt.disabled = true;
        if (!opt.text.includes('(Sélectionnée en Voix 2)')) {
          opt.dataset.origText = opt.dataset.origText || opt.text;
          opt.text = `${opt.dataset.origText} (Sélectionnée en Voix 2)`;
        }
      } else {
        opt.disabled = false;
        if (opt.dataset.origText) {
          opt.text = opt.dataset.origText;
        }
      }
    });

    // 2. Détection et correction intelligente du doublon si les deux voix coïncident
    const isDuplicate = (v1Val === v2Val);

    if (isDuplicate || forceAutoFix) {
      if (changedSource === 'host' || forceAutoFix) {
        const alternate = this.getSmartAlternateVoice(v1Val, 'scholar');
        if (alternate) {
          v2El.value = alternate;
          v2Val = alternate;
          if (isUserChange || forceAutoFix) {
            if (typeof App !== 'undefined' && App.showToast) {
              App.showToast('Voix 2 ajustée : distincte de la Voix 1 pour un dialogue bivoix.');
            }
          }
        }
      } else {
        const alternate = this.getSmartAlternateVoice(v2Val, 'host');
        if (alternate) {
          v1El.value = alternate;
          v1Val = alternate;
          if (isUserChange) {
            if (typeof App !== 'undefined' && App.showToast) {
              App.showToast('Voix 1 ajustée : distincte de la Voix 2 pour un dialogue bivoix.');
            }
          }
        }
      }

      // Re-nettoyer les statuts disabled après bascule
      Array.from(v2El.options).forEach(opt => {
        opt.disabled = (opt.value === v1Val);
        if (opt.value === v1Val) {
          opt.dataset.origText = opt.dataset.origText || opt.text.replace(' (Sélectionnée en Voix 1)', '');
          opt.text = `${opt.dataset.origText} (Sélectionnée en Voix 1)`;
        } else if (opt.dataset.origText) {
          opt.text = opt.dataset.origText;
        }
      });
      Array.from(v1El.options).forEach(opt => {
        opt.disabled = (opt.value === v2Val);
        if (opt.value === v2Val) {
          opt.dataset.origText = opt.dataset.origText || opt.text.replace(' (Sélectionnée en Voix 2)', '');
          opt.text = `${opt.dataset.origText} (Sélectionnée en Voix 2)`;
        } else if (opt.dataset.origText) {
          opt.text = opt.dataset.origText;
        }
      });
    }

    // Afficher ou masquer le bandeau d'alerte visuel
    const finalDuplicate = (v1El.value === v2El.value);
    if (alertEl) {
      alertEl.style.display = (finalDuplicate && this.format === 'dialogue') ? 'block' : 'none';
    }

    // Sauvegarde automatique des voix choisies
    this.saveVoiceOption({
      voice_speaker_a: v1El.value,
      voice_speaker_b: v2El.value
    });

    this.refreshCustomDropdown('as-select-voice-host');
    this.refreshCustomDropdown('as-select-voice-scholar');
    this.updateVoiceSummary();
    this.updateTurnCardsVoiceLabels();
  },

  syncVoxtralVoicePair(isUserChange = false, changedSource = 'host', forceAutoFix = false) {
    const el = this.elements;
    const v1El = el.selectVoxtralHost;
    const v2El = el.selectVoxtralScholar;
    if (!v1El || !v2El) return;

    let v1Val = v1El.value;
    let v2Val = v2El.value;
    const alertEl = el.voxtralDuplicateAlert;

    // 1. Désactiver la voix opposée dans chaque liste
    Array.from(v2El.options).forEach(opt => {
      if (opt.value === v1Val) {
        opt.disabled = true;
        if (!opt.text.includes('(Sélectionnée en Voix 1)')) {
          opt.dataset.origText = opt.dataset.origText || opt.text;
          opt.text = `${opt.dataset.origText} (Sélectionnée en Voix 1)`;
        }
      } else {
        opt.disabled = false;
        if (opt.dataset.origText) {
          opt.text = opt.dataset.origText;
        }
      }
    });

    Array.from(v1El.options).forEach(opt => {
      if (opt.value === v2Val) {
        opt.disabled = true;
        if (!opt.text.includes('(Sélectionnée en Voix 2)')) {
          opt.dataset.origText = opt.dataset.origText || opt.text;
          opt.text = `${opt.dataset.origText} (Sélectionnée en Voix 2)`;
        }
      } else {
        opt.disabled = false;
        if (opt.dataset.origText) {
          opt.text = opt.dataset.origText;
        }
      }
    });

    // 2. Détection et correction intelligente du doublon
    const isDuplicate = (v1Val === v2Val);
    if (isDuplicate || forceAutoFix) {
      if (changedSource === 'host' || forceAutoFix) {
        const alternate = this.getSmartAlternateVoxtralVoice(v1Val, 'scholar');
        if (alternate) {
          v2El.value = alternate;
          v2Val = alternate;
          if (isUserChange || forceAutoFix) {
            if (typeof App !== 'undefined' && App.showToast) {
              App.showToast('Voix 2 Voxtral ajustée : distincte de la Voix 1 pour un dialogue bivoix.');
            }
          }
        }
      } else {
        const alternate = this.getSmartAlternateVoxtralVoice(v2Val, 'host');
        if (alternate) {
          v1El.value = alternate;
          v1Val = alternate;
          if (isUserChange) {
            if (typeof App !== 'undefined' && App.showToast) {
              App.showToast('Voix 1 Voxtral ajustée : distincte de la Voix 2 pour un dialogue bivoix.');
            }
          }
        }
      }

      Array.from(v2El.options).forEach(opt => {
        opt.disabled = (opt.value === v1Val);
        if (opt.value === v1Val) {
          opt.dataset.origText = opt.dataset.origText || opt.text.replace(' (Sélectionnée en Voix 1)', '');
          opt.text = `${opt.dataset.origText} (Sélectionnée en Voix 1)`;
        } else if (opt.dataset.origText) {
          opt.text = opt.dataset.origText;
        }
      });
      Array.from(v1El.options).forEach(opt => {
        opt.disabled = (opt.value === v2Val);
        if (opt.value === v2Val) {
          opt.dataset.origText = opt.dataset.origText || opt.text.replace(' (Sélectionnée en Voix 2)', '');
          opt.text = `${opt.dataset.origText} (Sélectionnée en Voix 2)`;
        } else if (opt.dataset.origText) {
          opt.text = opt.dataset.origText;
        }
      });
    }

    // Afficher ou masquer le bandeau d'alerte visuel
    const finalDuplicate = (v1El.value === v2El.value);
    if (alertEl) {
      alertEl.style.display = (finalDuplicate && this.format === 'dialogue') ? 'block' : 'none';
    }

    // Sauvegarde automatique des voix choisies
    this.saveVoiceOption({
      voxtral_voice_speaker_a: v1El.value,
      voxtral_voice_speaker_b: v2El.value
    });

    this.refreshCustomDropdown('as-select-voxtral-host');
    this.refreshCustomDropdown('as-select-voxtral-scholar');
    this.updateVoiceSummary();
    this.updateTurnCardsVoiceLabels();
  },

  getSmartAlternateVoice(currentVoiceId, targetRole = 'scholar') {
    const defaultHost = 'fr-FR-VivienneMultilingualNeural';
    const defaultScholar = 'fr-CH-FabriceNeural';

    if (targetRole === 'scholar') {
      if (currentVoiceId !== defaultScholar) return defaultScholar;
      return 'fr-FR-RemyMultilingualNeural';
    } else {
      if (currentVoiceId !== defaultHost) return defaultHost;
      return 'fr-FR-VivienneMultilingualNeural';
    }
  },

  getSmartAlternateVoxtralVoice(currentVoiceId, targetRole = 'scholar') {
    const list = this.voxtralVoices || [];
    if (targetRole === 'scholar') {
      const preferred = list.find(v => (v.id !== currentVoiceId) && (v.name.toLowerCase().includes('neutre') || v.name.toLowerCase().includes('neutral') || v.name.toLowerCase().includes('grave') || v.name.toLowerCase().includes('sad') || v.name.toLowerCase().includes('ferme') || v.name.toLowerCase().includes('angry')));
      if (preferred) return preferred.id;
    } else {
      const preferred = list.find(v => (v.id !== currentVoiceId) && (v.name.toLowerCase().includes('joyeuse') || v.name.toLowerCase().includes('happy') || v.name.toLowerCase().includes('enthousiaste') || v.name.toLowerCase().includes('excited') || v.name.toLowerCase().includes('curieuse') || v.name.toLowerCase().includes('curious')));
      if (preferred) return preferred.id;
    }
    const alternate = list.find(v => v.id !== currentVoiceId);
    return alternate ? alternate.id : currentVoiceId;
  },

  updateTurnCardsVoiceLabels() {
    const el = this.elements;
    const cards = el.scriptList?.querySelectorAll('.audio-studio-turn-card') || [];
    if (cards.length === 0) return;

    const isVoxtral = (this.config?.engine === 'voxtral');
    let hostName, scholarName, soloName;

    if (isVoxtral) {
      hostName = this.getVoiceShortName(el.selectVoxtralHost?.value || this.config?.voxtral_voice_speaker_a || 'Marie - Happy');
      scholarName = this.getVoiceShortName(el.selectVoxtralScholar?.value || this.config?.voxtral_voice_speaker_b || 'Marie - Neutral');
      soloName = this.getVoiceShortName(el.selectVoxtralSolo?.value || this.config?.voxtral_voice_solo || 'Marie - Neutral');
    } else {
      hostName = this.getVoiceShortName(el.selectVoiceHost?.value || this.config?.voice_speaker_a || 'fr-FR-VivienneMultilingualNeural');
      scholarName = this.getVoiceShortName(el.selectVoiceScholar?.value || this.config?.voice_speaker_b || 'fr-CH-FabriceNeural');
      soloName = this.getVoiceShortName(el.selectVoiceSolo?.value || this.config?.voice_solo || 'fr-CH-FabriceNeural');
    }

    cards.forEach(card => {
      const vRole = card.dataset.voiceRole;
      const badge = card.querySelector('.audio-studio-speaker-badge');
      if (!badge) return;

      if (this.format === 'solo' || vRole === 'solo') {
        badge.textContent = `Narrateur (${soloName})`;
        card.dataset.speakerName = `Narrateur (${soloName})`;
      } else if (vRole === 'B' || vRole === 'SCHOLAR') {
        badge.textContent = `Exégète (${scholarName})`;
        card.dataset.speakerName = `Exégète (${scholarName})`;
      } else {
        badge.textContent = `Animatrice (${hostName})`;
        card.dataset.speakerName = `Animatrice (${hostName})`;
      }
    });
  },

  getVoiceShortName(voiceId) {
    if (!voiceId) return 'Voix';
    const all = [...(this.voices || []), ...(this.voxtralVoices || [])];
    const match = all.find(v => v.id === voiceId);
    if (match && match.name) {
      return match.name.split('(')[0].trim();
    }
    const parts = voiceId.split('-');
    if (parts.length >= 3) {
      return parts[2].replace('Neural', '').replace('Multilingual', '');
    }
    return voiceId;
  },

  updateVoiceSummary() {
    const el = this.elements;
    if (!el.voiceSummary) return;

    const isVoxtral = (this.config?.engine === 'voxtral');

    if (isVoxtral) {
      const spkA = el.selectVoxtralHost?.value || this.config?.voxtral_voice_speaker_a || 'Marie - Happy';
      const spkB = el.selectVoxtralScholar?.value || this.config?.voxtral_voice_speaker_b || 'Marie - Neutral';
      const solo = el.selectVoxtralSolo?.value || this.config?.voxtral_voice_solo || 'Marie - Neutral';

      if (this.format === 'dialogue') {
        el.voiceSummary.innerHTML = `<strong>Voxtral Voix 1 (Animatrice) :</strong> ${this.escapeHtml(this.getVoiceLabel(spkA))} &bull; <strong>Voix 2 (Exégète) :</strong> ${this.escapeHtml(this.getVoiceLabel(spkB))}`;
      } else {
        el.voiceSummary.innerHTML = `<strong>Voxtral Voix Narrateur (Solo) :</strong> ${this.escapeHtml(this.getVoiceLabel(solo))}`;
      }
    } else {
      const spkA = el.selectVoiceHost?.value || this.config?.voice_speaker_a || 'fr-FR-VivienneMultilingualNeural';
      const spkB = el.selectVoiceScholar?.value || this.config?.voice_speaker_b || 'fr-CH-FabriceNeural';
      const solo = el.selectVoiceSolo?.value || this.config?.voice_solo || 'fr-CH-FabriceNeural';

      if (this.format === 'dialogue') {
        el.voiceSummary.innerHTML = `<strong>Voix 1 (Animatrice) :</strong> ${this.escapeHtml(this.getVoiceLabel(spkA))} &bull; <strong>Voix 2 (Exégète) :</strong> ${this.escapeHtml(this.getVoiceLabel(spkB))}`;
      } else {
        el.voiceSummary.innerHTML = `<strong>Voix Narrateur (Solo) :</strong> ${this.escapeHtml(this.getVoiceLabel(solo))}`;
      }
    }
  },

  getVoiceLabel(voiceId) {
    const all = [...(this.voices || []), ...(this.voxtralVoices || [])];
    const match = all.find(v => v.id === voiceId);
    if (match) return match.name;
    return voiceId || 'Standard';
  },

  // =========================================================================
  // GESTION DU SOUNDPACK (Musiques d'ambiance, Jingles & Ducking)
  // =========================================================================

  async loadSoundpack() {
    try {
      const res = await API.call('audio_studio_get_soundpack');
      if (res && res.success && res.soundpack) {
        this.soundpack = res.soundpack;
        this.populateSoundpackSelects(res.soundpack);
      }
    } catch (err) {
      console.warn('[AudioStudioView] Erreur chargement soundpack:', err);
    }
  },

  populateSoundpackSelects(soundpack) {
    const el = this.elements;
    const tracks = soundpack?.tracks || [];

    const musicTracks = tracks.filter(t => t.category === 'music');
    const jingleTracks = tracks.filter(t => t.category === 'jingle_intro' || t.category === 'jingles');
    const stingerTracks = tracks.filter(t => t.category === 'stinger');

    const formatDur = (sec) => {
      const s = Math.round(sec || 0);
      if (s >= 60) {
        const m = Math.floor(s / 60);
        const rem = (s % 60).toString().padStart(2, '0');
        return `${m}:${rem}`;
      }
      return `${s}s`;
    };

    // Les habillages sonores sont maintenant contrôlés par les 2 cases à cocher contextuelles automatiques
    if (el.checkMusicJingle && typeof this.config?.audio_studio_music_enabled !== 'undefined') {
      el.checkMusicJingle.checked = !!this.config.audio_studio_music_enabled;
    }
    if (el.checkSfxAuto && typeof this.config?.audio_studio_sfx_enabled !== 'undefined') {
      el.checkSfxAuto.checked = !!this.config.audio_studio_sfx_enabled;
    }
  },

  // =========================================================================
  // MENUS DÉROULANTS PERSONNALISÉS (StudioCustomDropdown) & PRÉÉCOUTES
  // =========================================================================

  initCustomDropdowns() {
    const dropdownIds = [
      'as-select-voice-host',
      'as-select-voice-scholar',
      'as-select-voice-solo',
      'as-select-voxtral-host',
      'as-select-voxtral-scholar',
      'as-select-voxtral-solo',
      'as-select-bg-music',
      'as-select-jingle-intro',
      'as-select-sfx'
    ];
    dropdownIds.forEach(id => this.setupCustomDropdown(id));
  },

  setupCustomDropdown(selectId) {
    const selectEl = document.getElementById(selectId);
    if (!selectEl) return;

    // Masquer le select natif tout en le gardant fonctionnel dans le DOM
    selectEl.style.display = 'none';

    let customEl = selectEl.parentNode.querySelector(`.as-custom-select[data-for="${selectId}"]`);
    if (!customEl) {
      customEl = document.createElement('div');
      customEl.className = 'as-custom-select';
      customEl.dataset.for = selectId;
      customEl.id = `${selectId}-custom`;
      customEl.innerHTML = `
        <button type="button" class="as-custom-trigger" aria-haspopup="listbox" aria-expanded="false">
          <span class="as-custom-trigger-label">Chargement...</span>
          <span class="as-custom-trigger-chevron">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
          </span>
        </button>
        <div class="as-custom-menu" role="listbox"></div>
      `;
      selectEl.parentNode.insertBefore(customEl, selectEl.nextSibling);

      const trigger = customEl.querySelector('.as-custom-trigger');
      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = customEl.classList.contains('is-open');
        this.closeAllCustomDropdowns();
        if (!isOpen) {
          customEl.classList.add('is-open');
          trigger.setAttribute('aria-expanded', 'true');
        }
      });
    }

    this.refreshCustomDropdown(selectId);
  },

  refreshCustomDropdown(selectId) {
    const selectEl = document.getElementById(selectId);
    if (!selectEl) return;
    const customEl = selectEl.parentNode.querySelector(`.as-custom-select[data-for="${selectId}"]`);
    if (!customEl) return;

    const triggerLabel = customEl.querySelector('.as-custom-trigger-label');
    const menuEl = customEl.querySelector('.as-custom-menu');
    if (!menuEl) return;

    const selectedOpt = selectEl.options[selectEl.selectedIndex];
    if (triggerLabel && selectedOpt) {
      let label = selectedOpt.text.replace(/\s*\(Sélectionnée en Voix [12]\)/, '').trim();
      triggerLabel.textContent = label;
      triggerLabel.title = label;
    }

    // Déterminer le type et les métadonnées de ce select
    const isVoxtral = selectId.includes('voxtral');
    const isSoundpack = selectId.includes('bg-music') || selectId.includes('jingle') || selectId.includes('sfx');
    const isVoice = !isSoundpack;
    const engine = isVoxtral ? 'voxtral' : 'edge';
    const role = selectId.includes('scholar') ? 'scholar' : (selectId.includes('host') ? 'host' : 'solo');

    menuEl.innerHTML = '';

    const renderOptionItem = (opt) => {
      const itemEl = document.createElement('div');
      itemEl.className = `as-custom-item ${opt.selected ? 'is-selected' : ''} ${opt.disabled ? 'is-disabled' : ''}`;
      itemEl.dataset.value = opt.value;

      let fullText = opt.text;
      let mainTitle = fullText;
      let subTitle = '';

      const parenIdx = fullText.indexOf('(');
      if (parenIdx > 0 && fullText.endsWith(')')) {
        mainTitle = fullText.slice(0, parenIdx).trim();
        subTitle = fullText.slice(parenIdx + 1, -1).trim();
      }

      const infoEl = document.createElement('div');
      infoEl.className = 'as-custom-item-info';

      const titleEl = document.createElement('span');
      titleEl.className = 'as-custom-item-title';
      titleEl.textContent = mainTitle;
      infoEl.appendChild(titleEl);

      if (subTitle) {
        const subEl = document.createElement('span');
        subEl.className = 'as-custom-item-sub';
        subEl.textContent = subTitle;
        infoEl.appendChild(subEl);
      }
      itemEl.appendChild(infoEl);

      // Bouton de préécoute individuel pour les éléments auditifs valides
      const canPreview = opt.value && opt.value !== 'none';
      if (canPreview) {
        const playBtn = document.createElement('button');
        playBtn.type = 'button';
        playBtn.className = 'as-custom-item-play';
        playBtn.title = 'Écouter un extrait';
        playBtn.dataset.previewId = opt.value;

        const isVoicePlaying = isVoice && this.currentPreviewVoiceId === `${engine}:${opt.value}` && this.previewAudio && !this.previewAudio.paused;
        const isTrackPlaying = isSoundpack && this.currentPreviewTrackId === opt.value && this.previewAudio && !this.previewAudio.paused;

        if (isVoicePlaying || isTrackPlaying) {
          playBtn.classList.add('is-playing');
          itemEl.classList.add('is-playing');
          playBtn.title = 'Arrêter la préécoute';
          playBtn.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>`;
        } else {
          playBtn.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"/></svg>`;
        }

        playBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (isVoice) {
            this.previewVoiceInItem(opt.value, engine, role, playBtn);
          } else {
            this.previewSoundpackTrackInItem(opt.value, playBtn);
          }
        });

        itemEl.appendChild(playBtn);
      }

      itemEl.addEventListener('click', () => {
        if (opt.disabled) return;
        selectEl.value = opt.value;
        selectEl.dispatchEvent(new Event('change'));
        this.closeAllCustomDropdowns();
      });

      return itemEl;
    };

    Array.from(selectEl.children).forEach(child => {
      if (child.tagName === 'OPTGROUP') {
        const groupHeader = document.createElement('div');
        groupHeader.className = 'as-custom-group-header';
        groupHeader.textContent = child.label;
        menuEl.appendChild(groupHeader);

        Array.from(child.children).forEach(opt => {
          menuEl.appendChild(renderOptionItem(opt));
        });
      } else if (child.tagName === 'OPTION') {
        menuEl.appendChild(renderOptionItem(child));
      }
    });
  },

  refreshAllCustomDropdowns() {
    const dropdownIds = [
      'as-select-voice-host',
      'as-select-voice-scholar',
      'as-select-voice-solo',
      'as-select-voxtral-host',
      'as-select-voxtral-scholar',
      'as-select-voxtral-solo'
    ];
    dropdownIds.forEach(id => this.refreshCustomDropdown(id));
  },

  closeAllCustomDropdowns() {
    document.querySelectorAll('.as-custom-select.is-open').forEach(el => {
      el.classList.remove('is-open');
      const trigger = el.querySelector('.as-custom-trigger');
      if (trigger) trigger.setAttribute('aria-expanded', 'false');
    });
  },

  resetAllItemPlayButtons() {
    document.querySelectorAll('.as-custom-item-play').forEach(btn => {
      btn.classList.remove('is-playing', 'is-loading');
      btn.title = 'Écouter un extrait';
      btn.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"/></svg>`;
    });
    document.querySelectorAll('.as-custom-item.is-playing').forEach(item => {
      item.classList.remove('is-playing');
    });
    this.resetAllCardPreviewIcons();
  },

  async previewVoiceInItem(voiceId, engine, role, btnEl) {
    if (!voiceId || voiceId === 'none') return;

    const previewKey = `${engine}:${voiceId}`;
    const isCurrentPlaying = (this.currentPreviewVoiceId === previewKey && this.previewAudio && !this.previewAudio.paused);

    if (this.previewAudio) {
      this.previewAudio.pause();
      this.previewAudio.currentTime = 0;
    }
    this.resetAllItemPlayButtons();

    if (isCurrentPlaying) {
      this.currentPreviewVoiceId = null;
      this.currentPreviewTrackId = null;
      return;
    }

    this.currentPreviewVoiceId = previewKey;
    this.currentPreviewTrackId = null;

    if (btnEl) {
      btnEl.classList.add('is-loading');
      btnEl.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" class="as-spin"><circle cx="12" cy="12" r="10" stroke-opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"/></svg>`;
    }

    try {
      const res = await API.call('audio_studio_get_voice_sample_url', voiceId, engine, role);
      if (btnEl) {
        btnEl.classList.remove('is-loading');
      }

      if (this.currentPreviewVoiceId !== previewKey) {
        return;
      }

      const sampleUrl = res?.sample_url || res?.audio_url;
      if (res && res.success && sampleUrl) {
        if (!this.previewAudio) {
          this.previewAudio = new Audio();
        }
        this.previewAudio.src = sampleUrl;
        this.previewAudio.volume = 0.9;
        await this.previewAudio.play();

        if (btnEl) {
          btnEl.classList.add('is-playing');
          btnEl.closest('.as-custom-item')?.classList.add('is-playing');
          btnEl.title = 'Arrêter la préécoute';
          btnEl.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>`;
        }

        this.previewAudio.onended = () => {
          this.resetAllItemPlayButtons();
          this.currentPreviewVoiceId = null;
        };
        this.previewAudio.onerror = () => {
          this.resetAllItemPlayButtons();
          this.currentPreviewVoiceId = null;
        };
      } else {
        this.resetAllItemPlayButtons();
        this.currentPreviewVoiceId = null;
        this.showErrorToast("Impossible de charger l'échantillon vocal.");
      }
    } catch (err) {
      this.resetAllItemPlayButtons();
      this.currentPreviewVoiceId = null;
      console.warn('[AudioStudioView] Erreur préécoute voix:', err);
    }
  },

  async previewSoundpackTrackInItem(trackId, btnEl) {
    if (!trackId || trackId === 'none') return;

    const isCurrentPlaying = (this.currentPreviewTrackId === trackId && this.previewAudio && !this.previewAudio.paused);

    if (this.previewAudio) {
      this.previewAudio.pause();
      this.previewAudio.currentTime = 0;
    }
    this.resetAllItemPlayButtons();

    if (isCurrentPlaying) {
      this.currentPreviewTrackId = null;
      this.currentPreviewVoiceId = null;
      return;
    }

    this.currentPreviewTrackId = trackId;
    this.currentPreviewVoiceId = null;

    if (btnEl) {
      btnEl.classList.add('is-loading');
      btnEl.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" class="as-spin"><circle cx="12" cy="12" r="10" stroke-opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"/></svg>`;
    }

    try {
      const res = await API.call('audio_studio_get_soundpack_track_url', trackId);
      if (btnEl) {
        btnEl.classList.remove('is-loading');
      }

      if (this.currentPreviewTrackId !== trackId) {
        return;
      }

      if (res && res.success && res.audio_url) {
        if (!this.previewAudio) {
          this.previewAudio = new Audio();
        }
        this.previewAudio.src = res.audio_url;
        this.previewAudio.volume = 0.6;
        await this.previewAudio.play();

        if (btnEl) {
          btnEl.classList.add('is-playing');
          btnEl.closest('.as-custom-item')?.classList.add('is-playing');
          btnEl.title = 'Arrêter la préécoute';
          btnEl.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>`;
        }

        this.previewAudio.onended = () => {
          this.resetAllItemPlayButtons();
          this.currentPreviewTrackId = null;
        };
        this.previewAudio.onerror = () => {
          this.resetAllItemPlayButtons();
          this.currentPreviewTrackId = null;
        };
      } else {
        this.resetAllItemPlayButtons();
        this.currentPreviewTrackId = null;
        this.showErrorToast("Impossible de charger l'extrait audio.");
      }
    } catch (err) {
      this.resetAllItemPlayButtons();
      this.currentPreviewTrackId = null;
      console.warn('[AudioStudioView] Erreur préécoute musique:', err);
    }
  },

  // Rétrocompatibilité
  async previewTrack(trackId, btnEl) {
    return this.previewSoundpackTrackInItem(trackId, btnEl);
  },

  async previewSoundpackTrackFromCard(trackId, iconBtn) {
    if (!trackId || trackId === 'none') {
      this.showErrorToast("Aucune piste audio n'est sélectionnée pour cet élément.");
      return;
    }

    const isCurrentPlaying = (this.currentPreviewTrackId === trackId && this.previewAudio && !this.previewAudio.paused);

    if (this.previewAudio) {
      this.previewAudio.pause();
      this.previewAudio.currentTime = 0;
    }
    this.resetAllCardPreviewIcons();
    this.resetAllItemPlayButtons();

    if (isCurrentPlaying) {
      this.currentPreviewTrackId = null;
      return;
    }

    this.currentPreviewTrackId = trackId;

    if (iconBtn) {
      iconBtn.classList.add('is-loading');
    }

    try {
      const res = await API.call('audio_studio_get_soundpack_track_url', trackId);
      if (iconBtn) iconBtn.classList.remove('is-loading');

      if (this.currentPreviewTrackId !== trackId) return;

      const audioUrl = res?.audio_url || res?.track_url || res?.url;
      if (res && res.success && audioUrl) {
        if (!this.previewAudio) {
          this.previewAudio = new Audio();
        }
        this.previewAudio.src = audioUrl;
        this.previewAudio.volume = 0.7;
        await this.previewAudio.play();

        if (iconBtn) {
          iconBtn.classList.add('is-playing');
          iconBtn.title = 'Arrêter la préécoute';
        }

        this.previewAudio.onended = () => {
          this.resetAllCardPreviewIcons();
          this.currentPreviewTrackId = null;
        };
        this.previewAudio.onerror = () => {
          this.resetAllCardPreviewIcons();
          this.currentPreviewTrackId = null;
        };
      } else {
        this.resetAllCardPreviewIcons();
        this.currentPreviewTrackId = null;
        this.showErrorToast("Impossible de charger la piste sonore.");
      }
    } catch (err) {
      this.resetAllCardPreviewIcons();
      this.currentPreviewTrackId = null;
      console.warn('[AudioStudioView] Erreur préécoute carte:', err);
    }
  },

  resetAllCardPreviewIcons() {
    document.querySelectorAll('.as-timeline-event-icon').forEach(icon => {
      icon.classList.remove('is-playing', 'is-loading');
      icon.title = 'Cliquer pour écouter cet extrait sonore';
    });
  },

  // =========================================================================
  // OUTILS DU PASSAGE BIBLIQUE (BookPicker & Sync)
  // =========================================================================

  openBookPicker() {
    if (typeof BookPicker !== 'undefined') {
      const initialBook = (typeof BibleReader !== 'undefined' && BibleReader.currentBook) ? BibleReader.currentBook : 'Gen';
      const initialCh = (typeof BibleReader !== 'undefined' && BibleReader.currentChapter) ? BibleReader.currentChapter : 1;

      BookPicker.open(initialBook, initialCh, (bookCode, chapterNum, verseNum = null) => {
        let bName = bookCode;
        if (BookPicker.booksData) {
          const bObj = BookPicker.booksData.find(b => b.code.toLowerCase() === (bookCode || '').toLowerCase());
          if (bObj) bName = bObj.name;
        }
        const refStr = verseNum ? `${bName} ${chapterNum}:${verseNum}` : `${bName} ${chapterNum}`;
        if (this.elements.subjectInput) {
          this.elements.subjectInput.value = refStr;
          this.elements.subjectInput.focus();
        }
      }, {
        anchor: this.elements.btnBookPicker
      });
    } else {
      const manual = prompt("Entrez la référence biblique (ex: Romains 8:28 ou Jean 3) :");
      if (manual && this.elements.subjectInput) {
        this.elements.subjectInput.value = manual.trim();
      }
    }
  },

  syncFromBibleReader() {
    let ref = null;
    if (typeof BibleReader !== 'undefined') {
      if (typeof BibleReader.getCurrentRef === 'function') {
        ref = BibleReader.getCurrentRef();
      } else if (BibleReader.currentBook) {
        ref = `${BibleReader.currentBook} ${BibleReader.currentChapter || 1}`;
      }
    }
    if (ref && this.elements.subjectInput) {
      this.elements.subjectInput.value = ref;
      this.elements.subjectInput.focus();
    }
  },

  // =========================================================================
  // GESTION DU WORKFLOW EN 3 ÉTAPES (STEPPER WIZARD)
  // =========================================================================

  goToStep(step) {
    if (step < 1 || step > 3) return;

    // Blocage logique si étapes préalables non franchies
    if (step === 2 && (!this.currentPodcast || !this.currentPodcast.script_dialogue || this.currentPodcast.script_dialogue.length === 0)) {
      this.showErrorToast("Veuillez d'abord rédiger un script à l'Étape 1.");
      return;
    }

    if (step === 3 && (!this.currentPodcast || (!this.currentPodcast.audio_file && !this.currentPodcast.audio_data_url))) {
      this.showErrorToast("L'audio MP3 n'a pas encore été généré. Cliquez sur « Générer l'audio MP3 » à l'Étape 2.");
      return;
    }

    this.currentStep = step;
    const el = this.elements;

    // Mise à jour visuelle du stepper
    [
      { btn: el.stepBtn1, num: 1 },
      { btn: el.stepBtn2, num: 2 },
      { btn: el.stepBtn3, num: 3 }
    ].forEach(({ btn, num }) => {
      if (!btn) return;
      btn.classList.remove('active', 'completed', 'disabled');
      if (num === step) {
        btn.classList.add('active');
      } else if (num < step) {
        btn.classList.add('completed');
      } else {
        const canAccess = (num === 2 && this.currentPodcast?.script_dialogue?.length > 0) ||
                          (num === 3 && (this.currentPodcast?.audio_file || this.currentPodcast?.audio_data_url));
        if (!canAccess) {
          btn.classList.add('disabled');
        }
      }
    });

    if (el.stepConn12) el.stepConn12.classList.toggle('active', step >= 2);
    if (el.stepConn23) el.stepConn23.classList.toggle('active', step >= 3);

    // Affichage des panneaux
    if (el.step1Pane) el.step1Pane.classList.toggle('is-active', step === 1);
    if (el.step2Pane) el.step2Pane.classList.toggle('is-active', step === 2);
    if (el.step3Pane) el.step3Pane.classList.toggle('is-active', step === 3);

    if (step === 1) {
      this.resetStep1InputState();
    } else if (el.step1ReasoningBox) {
      el.step1ReasoningBox.style.display = 'none';
    }

    // Ajustements d'étape
    if (step === 2) {
      if (!this.isSynthesizing) {
        this.resetStep2InputState();
      }
      if (el.btnNavToStep3) {
        el.btnNavToStep3.style.display = (this.currentPodcast?.audio_file || this.currentPodcast?.audio_data_url) ? 'inline-flex' : 'none';
      }
    } else if (step === 3) {
      this.resetStep2InputState();
      this.renderKaraokeView();
    }
  },

  resetStep1InputState() {
    const el = this.elements;
    el.step1Pane?.classList.remove('is-generating');
    if (el.step1Cards) el.step1Cards.style.display = '';
    if (el.step1ActiveSummary) el.step1ActiveSummary.style.display = 'none';
    if (el.step1Heading) el.step1Heading.textContent = 'Créer un nouvel épisode audio';
    if (el.step1Subheading) el.step1Subheading.textContent = 'Sélectionnez votre passage ou thème, choisissez l\'angle herméneutique et configurez votre émission.';
  },

  resetStep2InputState() {
    const el = this.elements;
    if (el.step2ConfigControls) el.step2ConfigControls.style.display = '';
    if (el.step2ActiveSummary) el.step2ActiveSummary.style.display = 'none';
    if (el.step2CardTitle) el.step2CardTitle.innerHTML = 'Moteur &amp; Voix Neuronales';
    if (el.btnSynthesize) {
      el.btnSynthesize.style.display = '';
      el.btnSynthesize.disabled = false;
      el.btnSynthesize.innerHTML = `
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
        <span>Générer l'audio MP3 (Étape 3)</span>
      `;
    }
  },

  // =========================================================================
  // GESTION DU MODE D'ÉTUDE & CO-CONSTRUCTION DES AXES
  // =========================================================================

  setStudyMode(modeKey) {
    this.studyMode = modeKey || 'auto';
    const chips = this.elements.modesGrid?.querySelectorAll('.as-mode-chip') || [];
    chips.forEach(c => {
      c.classList.toggle('active', c.dataset.mode === this.studyMode);
    });

    if (this.studyMode === 'immersion' || this.studyMode === 'narrative') {
      if (typeof this.setFormat === 'function') {
        this.setFormat('solo');
      }
    }

    const labels = {
      auto: 'Auto',
      exegesis: 'Exégèse',
      historical: 'Histoire',
      immersion: 'Immersion Narrative',
      narrative: 'Immersion Narrative',
      sermon: 'Prédication',
      theology: 'Théologie',
      lexical: 'Lexique'
    };
    if (this.elements.metaMode) {
      this.elements.metaMode.textContent = labels[this.studyMode] || this.studyMode;
    }
  },

  async suggestFocusQuestions() {
    const el = this.elements;
    const query = el.subjectInput?.value.trim();
    if (!query) {
      this.showErrorToast("Veuillez d'abord saisir un sujet ou un passage biblique.");
      el.subjectInput?.focus();
      return;
    }

    if (el.btnSuggestAxes) {
      el.btnSuggestAxes.disabled = true;
      el.btnSuggestAxes.innerHTML = `
        <span class="audio-studio-spinner"></span>
        <span>Analyse herméneutique...</span>
      `;
    }

    try {
      const res = await API.call('audio_studio_suggest_axes', {
        subject_or_ref: query,
        study_mode: this.studyMode
      });

      if (res && res.success && Array.isArray(res.questions) && res.questions.length > 0) {
        this.focalQuestions = res.questions.map(q => ({ text: q, selected: true }));
        this.renderFocalQuestions();
      } else {
        const err = res?.error || "Impossible de suggérer des axes pour ce sujet.";
        this.showErrorToast(err);
      }
    } catch (e) {
      console.warn("Erreur suggestFocusQuestions:", e);
      this.showErrorToast(`Erreur d'analyse : ${e.message || e}`);
    } finally {
      if (el.btnSuggestAxes) {
        el.btnSuggestAxes.disabled = false;
        el.btnSuggestAxes.innerHTML = `
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/></svg>
          <span>Suggérer des axes / questions clés</span>
        `;
      }
    }
  },

  renderFocalQuestions() {
    const el = this.elements;
    if (!el.focalList) return;
    el.focalList.innerHTML = '';

    if (this.focalQuestions.length === 0) {
      if (el.focalContainer) el.focalContainer.classList.add('hidden');
      return;
    }

    this.focalQuestions.forEach((item, idx) => {
      const row = document.createElement('div');
      row.className = 'as-focal-item';

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'as-focal-checkbox';
      cb.checked = !!item.selected;
      cb.addEventListener('change', () => {
        item.selected = cb.checked;
      });

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'as-focal-text-input';
      input.value = item.text || '';
      input.addEventListener('input', (e) => {
        item.text = e.target.value;
      });

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'as-focal-delete-btn';
      delBtn.title = 'Supprimer cet axe';
      delBtn.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
      delBtn.addEventListener('click', () => {
        this.focalQuestions.splice(idx, 1);
        this.renderFocalQuestions();
      });

      row.appendChild(cb);
      row.appendChild(input);
      row.appendChild(delBtn);
      el.focalList.appendChild(row);
    });

    if (el.focalContainer) el.focalContainer.classList.remove('hidden');
  },

  addCustomFocalQuestion() {
    this.focalQuestions.push({
      text: "Nouvel axe d'analyse...",
      selected: true
    });
    this.renderFocalQuestions();
    setTimeout(() => {
      const inputs = this.elements.focalList?.querySelectorAll('.as-focal-text-input');
      if (inputs && inputs.length > 0) {
        const last = inputs[inputs.length - 1];
        last.focus();
        last.select();
      }
    }, 50);
  },

  newEpisode() {
    this.currentPodcast = null;
    this.focalQuestions = [];
    if (this.elements.focalContainer) this.elements.focalContainer.classList.add('hidden');
    if (this.elements.focalList) this.elements.focalList.innerHTML = '';
    if (this.elements.subjectInput) {
      this.elements.subjectInput.value = '';
      this.elements.subjectInput.focus();
    }
    this.clearScript();
    this.finishScriptReasoning(false);
    this.goToStep(1);
    this.showSuccessToast("Nouvel épisode initialisé.");
  },

  toggleHistoryDrawer(open) {
    const el = this.elements;
    const shouldOpen = (open !== undefined) ? open : !el.historyDrawer?.classList.contains('is-open');
    if (shouldOpen) {
      el.historyDrawer?.classList.add('is-open');
      el.historyBackdrop?.classList.add('is-open');
    } else {
      el.historyDrawer?.classList.remove('is-open');
      el.historyBackdrop?.classList.remove('is-open');
    }
  },

  // =========================================================================
  // COLLECTE DES OPTIONS RAG
  // =========================================================================

  collectSourcesOptions() {
    const el = this.elements;
    return {
      sources: {
        bibles: el.srcBibles?.checked ?? true,
        commentaries: el.srcComms?.checked ?? true,
        dictionaries: el.srcDict?.checked ?? true,
        articles: el.srcArticles?.checked ?? true,
        notes: el.srcNotes?.checked ?? true,
        upvr: el.srcUpvr?.checked ?? true,
        theology: el.srcTheology?.checked ?? true
      },
      context_depth: el.optDepthSlider ? parseInt(el.optDepthSlider.value, 10) : 1,
      enable_rerank: el.optRerank?.checked ?? true,
      enable_curator: el.optCurator?.checked ?? false,
      include_profile: el.optProfile?.checked ?? true
    };
  },

  // =========================================================================
  // RÉDACTION DU SCRIPT (LLM + RAG) & PROGRESSION EN TEMPS RÉEL
  // =========================================================================

  // =========================================================================
  // GESTION DU RAISONNEMENT PROGRESSIF & DES ÉTAPES (STYLE ASSISTANT IA)
  // =========================================================================

  initScriptReasoningSteps(sourcesOpts) {
    const el = this.elements;
    if (!el.step1ReasoningBox || !el.reasoningStepsList) return;

    if (this.reasoningInterval) {
      clearInterval(this.reasoningInterval);
      this.reasoningInterval = null;
    }
    if (this.reasoningTimeouts) {
      this.reasoningTimeouts.forEach(t => clearTimeout(t));
    }
    this.reasoningTimeouts = [];

    const hasRerank = sourcesOpts?.enable_rerank !== false;
    const hasCurator = !!sourcesOpts?.enable_curator;

    this.reasoningStepsDef = [
      { id: 'step-intent', label: "Cadrage thématique & orientation méthodologique" },
      { id: 'step-corpus', label: "Exploration documentaire multi-sources" },
      ...(hasRerank ? [{ id: 'step-rerank', label: "Évaluation & pertinence croisée (Reranking BGE-M3)" }] : []),
      ...(hasCurator ? [{ id: 'step-curator', label: "Curation & structuration du corpus documentaire" }] : []),
      { id: 'step-llm', label: "Rédaction intégrale du script par l'IA" },
      { id: 'step-struct', label: "Validation et découpage des répliques" }
    ];

    this.currentReasoningStepIdx = 0;

    let html = '';
    this.reasoningStepsDef.forEach((step, idx) => {
      const state = idx === 0 ? 'active' : 'pending';
      html += `
        <div class="reasoning-step ${step.id} ${state}" data-step-idx="${idx}">
          <span class="step-bullet"></span>
          <span class="step-label">${step.label}</span>
        </div>
      `;
    });

    el.reasoningStepsList.innerHTML = html;
    el.step1ReasoningBox.style.display = 'block';

    // Chronomètre en direct
    const startTime = performance.now();
    if (el.reasoningTimer) el.reasoningTimer.textContent = '0.0s';
    this.reasoningInterval = setInterval(() => {
      const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
      if (el.reasoningTimer) el.reasoningTimer.textContent = `${elapsed}s`;
    }, 100);

    // Progression initiale douce
    const t1 = setTimeout(() => {
      if (this.currentReasoningStepIdx === 0) {
        this.setReasoningStepActive('step-corpus');
      }
    }, 600);
    this.reasoningTimeouts.push(t1);
  },

  setReasoningStepActive(stepIdOrIdx) {
    const el = this.elements;
    if (!this.reasoningStepsDef || !el.reasoningStepsList) return;

    let targetIdx = -1;
    if (typeof stepIdOrIdx === 'number') {
      targetIdx = stepIdOrIdx;
    } else {
      targetIdx = this.reasoningStepsDef.findIndex(s => s.id === stepIdOrIdx);
    }

    if (targetIdx < 0 || targetIdx >= this.reasoningStepsDef.length) return;
    if (targetIdx <= this.currentReasoningStepIdx && this.currentReasoningStepIdx > 0) return;

    this.currentReasoningStepIdx = targetIdx;

    const stepElements = el.reasoningStepsList.querySelectorAll('.reasoning-step');
    stepElements.forEach((stepEl, idx) => {
      stepEl.classList.remove('pending', 'active', 'done');
      if (idx < targetIdx) {
        stepEl.classList.add('done');
      } else if (idx === targetIdx) {
        stepEl.classList.add('active');
      } else {
        stepEl.classList.add('pending');
      }
    });
  },

  updateScriptProgress(pct, msg) {
    if (!this.isGenerating) return;
    const lowerMsg = (msg || '').toLowerCase();

    if (lowerMsg.includes('recherche') || lowerMsg.includes('lecture') || lowerMsg.includes('consultation') || lowerMsg.includes('notes') || lowerMsg.includes('chromadb')) {
      this.setReasoningStepActive('step-corpus');
    } else if (lowerMsg.includes('pertinence croisée') || lowerMsg.includes('rerank')) {
      this.setReasoningStepActive('step-rerank');
    } else if (lowerMsg.includes('curation') || lowerMsg.includes('structuration du corpus')) {
      this.setReasoningStepActive('step-curator');
    } else if (lowerMsg.includes('rédaction') || lowerMsg.includes('émission') || lowerMsg.includes('ia') || pct >= 75) {
      if (pct >= 92 || lowerMsg.includes('validation') || lowerMsg.includes('structuration du script')) {
        this.setReasoningStepActive('step-struct');
      } else {
        this.setReasoningStepActive('step-llm');
      }
    }
  },

  finishScriptReasoning(isSuccess = true) {
    if (this.reasoningInterval) {
      clearInterval(this.reasoningInterval);
      this.reasoningInterval = null;
    }
    if (this.reasoningTimeouts) {
      this.reasoningTimeouts.forEach(t => clearTimeout(t));
      this.reasoningTimeouts = [];
    }

    const el = this.elements;
    if (isSuccess && el.reasoningStepsList) {
      const stepElements = el.reasoningStepsList.querySelectorAll('.reasoning-step');
      stepElements.forEach(stepEl => {
        stepEl.classList.remove('pending', 'active');
        stepEl.classList.add('done');
      });
    } else if (!isSuccess && el.step1ReasoningBox) {
      el.step1ReasoningBox.style.display = 'none';
    }
  },

  updateSynthesisProgress(pct, msg) {
    const el = this.elements;
    const cleanPct = Math.max(0, Math.min(100, parseInt(pct, 10) || 0));
    this.targetSynthesisPct = Math.max(this.targetSynthesisPct || 0, cleanPct);
    if (msg) this.latestSynthesisMsg = msg;

    if (el.progressBox && el.progressBox.style.display !== 'flex') {
      el.progressBox.style.display = 'flex';
    }
    if (el.progressMsg && msg) {
      el.progressMsg.textContent = msg;
    }
    if (!this.synthesisAnimInterval) {
      if (el.progressPct) el.progressPct.textContent = `${cleanPct}%`;
      if (el.progressBarFill) el.progressBarFill.style.width = `${cleanPct}%`;
    }
  },

  async generateScript() {
    const el = this.elements;
    const query = el.subjectInput?.value.trim();

    if (!query) {
      this.showErrorToast('Veuillez saisir un sujet ou une référence biblique.');
      el.subjectInput?.focus();
      return;
    }

    if (this.isGenerating) return;
    this.isGenerating = true;

    // Masquer les éléments de saisie du haut pour focaliser sur l'avancement et empêcher toute modification
    el.step1Pane?.classList.add('is-generating');
    if (el.step1Cards) el.step1Cards.style.display = 'none';

    // Afficher le bandeau récapitulatif compact
    if (el.step1ActiveSummary) {
      const modeLabels = {
        auto: 'Auto',
        exegesis: 'Exégèse',
        historical: 'Histoire',
        immersion: 'Immersion Narrative',
        narrative: 'Immersion Narrative',
        sermon: 'Prédication',
        theology: 'Théologie',
        lexical: 'Lexique'
      };
      const modeName = modeLabels[this.studyMode] || this.studyMode || 'Auto';
      const fmtName = this.format === 'dialogue' ? 'Dialogue (2 voix)' : 'Chronique Solo';

      el.step1ActiveSummary.innerHTML = `
        <span class="as-step1-summary-pill">Sujet : <strong>${this.escapeHtml(query)}</strong></span>
        <span class="as-step1-summary-pill">Format : <strong>${fmtName}</strong></span>
        <span class="as-step1-summary-pill">Mode : <strong>${modeName}</strong></span>
      `;
      el.step1ActiveSummary.style.display = 'flex';
    }

    if (el.step1Heading) el.step1Heading.textContent = 'Génération du script en cours...';
    if (el.step1Subheading) el.step1Subheading.textContent = 'L\'IA analyse vos corpus documentaires et structure les répliques.';

    // Bouton en état de chargement sobre, sans mention de pourcentage
    if (el.btnGenerate) {
      el.btnGenerate.disabled = true;
      el.btnGenerate.innerHTML = `
        <span class="audio-studio-spinner"></span>
        <span>Rédaction du script en cours...</span>
      `;
    }

    if (typeof NotificationManager !== 'undefined') {
      NotificationManager.setWorkingState('audio-studio', true);
    }

    const activeQuestions = this.focalQuestions
      .filter(q => q.selected && q.text.trim())
      .map(q => q.text.trim());

    const sourcesOpts = this.collectSourcesOptions();
    sourcesOpts.study_mode = this.studyMode;
    sourcesOpts.focal_questions = activeQuestions;

    // Initialisation et affichage des étapes de réflexion (style Assistant IA)
    this.initScriptReasoningSteps(sourcesOpts);

    try {
      const res = await API.call('audio_studio_generate_script', {
        subject_or_ref: query,
        format_type: this.format,
        sources_options: sourcesOpts,
        study_mode: this.studyMode,
        focal_questions: activeQuestions
      });

      if (res && res.success && res.podcast) {
        this.finishScriptReasoning(true);
        this.currentPodcast = res.podcast;
        this.activeAudioEvents = [];
        if (el.checkMusicJingle) el.checkMusicJingle.checked = false;
        if (el.checkSfxAuto) el.checkSfxAuto.checked = false;
        this.renderScript();
        this.loadHistory();

        // Pause fluide de 400ms pour voir l'achèvement des étapes avant d'avancer
        setTimeout(() => {
          this.goToStep(2);
        }, 400);

        if (typeof NotificationManager !== 'undefined') {
          NotificationManager.notifyAICompletion({
            title: 'Script audio prêt',
            snippet: `« ${this.currentPodcast.title || query} » est rédigé. Vous pouvez modifier les répliques ou lancer la synthèse MP3.`,
            targetView: 'audio-studio',
            btnText: "Voir le script"
          });
        }
      } else {
        this.finishScriptReasoning(false);
        const errMsg = res?.error || 'Erreur lors de la génération du script';
        this.showErrorToast(errMsg);
      }
    } catch (err) {
      this.finishScriptReasoning(false);
      console.error('[AudioStudioView] Erreur generateScript:', err);
      this.showErrorToast(`Erreur technique : ${err.message || err}`);
    } finally {
      this.isGenerating = false;
      if (this.reasoningInterval) {
        clearInterval(this.reasoningInterval);
        this.reasoningInterval = null;
      }
      if (el.btnGenerate) {
        el.btnGenerate.disabled = false;
        el.btnGenerate.innerHTML = `
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3Z"></path>
          </svg>
          <span>Rédiger le script (Étape 2)</span>
        `;
      }
      // Si une erreur s'est produite et qu'on reste sur l'étape 1, réafficher les éléments de configuration
      if (this.currentStep === 1) {
        this.resetStep1InputState();
      }
      if (typeof NotificationManager !== 'undefined') {
        NotificationManager.setWorkingState('audio-studio', false);
      }
    }
  },

  // =========================================================================
  // GESTION DU MODE DE TEXTE (LITTÉRAIRE VS PHONÉTIQUE TTS)
  // =========================================================================

  toPhoneticScript(text) {
    if (!text) return '';
    let s = text;

    // 1. Remplacements et développements des références bibliques
    s = s.replace(/\b([1-3]?\s*[A-Za-zÀ-ÿ]+)\s+(\d+)[:\s]+(\d+)\s*[-–—]\s*(\d+)\b/g, '$1 chapitre $2, versets $3 à $4');
    s = s.replace(/\b([1-3]?\s*[A-Za-zÀ-ÿ]+)\s+(\d+):(\d+)\b/g, '$1 chapitre $2, verset $3');
    s = s.replace(/\b(\d+):(\d+)\b/g, 'chapitre $1, verset $2');
    s = s.replace(/\b1er\b/g, 'premier');
    s = s.replace(/\b1ère\b/g, 'première');
    s = s.replace(/\b[Vv]{2}\.\s*(\d+)/g, 'versets $1');
    s = s.replace(/\b[Vv]\.\s*(\d+)/g, 'verset $1');
    s = s.replace(/\b[Cc]h\.\s*(\d+)/g, 'chapitre $1');

    // 2. Équilibrage des énumérations de versets
    s = s.replace(/(versets?\s+\d+(?:,\s*\d+)*)\s+et\s+(\d+)/gi, '$1, et $2');
    s = s.replace(/(chapitres?\s+\d+(?:,\s*\d+)*)\s+et\s+(\d+)/gi, '$1, et $2');

    // 3. Termes grecs et hébreux translittérés avec phonétique explicite
    const terms = [
      [/\bkl[êe]t[oó]s\b/gi, 'klé-toss'],
      [/\bkal[eé][oô]\b/gi, 'ka-lé-o'],
      [/\bap[oó]stolos\b/gi, 'a-pos-to-loss'],
      [/\bmetanoia\b/gi, 'mé-ta-no-ï-a'],
      [/\bagap[eê]\b/gi, 'a-ga-pé'],
      [/\bkoinonia\b/gi, 'koï-no-ni-a'],
      [/\bcharis\b/gi, 'ka-riss'],
      [/\bpneumatos\b/gi, 'pneu-ma-toss'],
      [/\bpneuma\b/gi, 'pneu-ma'],
      [/\btheos\b/gi, 'té-oss'],
      [/\bkyrios\b/gi, 'kou-ri-oss'],
      [/\bsarx\b/gi, 'sarks'],
      [/\bdikaiosyn[eê]\b/gi, 'di-ka-ï-o-su-né'],
      [/\beir[eê]n[eê]\b/gi, 'è-ré-né'],
      [/\bekkl[eê]sia\b/gi, 'èk-klé-si-a'],
      [/\bparakl[eê]tos\b/gi, 'pa-ra-klé-toss'],
      [/\bhamartia\b/gi, 'ha-mar-ti-a'],
      [/\bchiasme\b/gi, 'kiasme'],
      [/\bgenesis\b/gi, 'gé-nè-siss'],
      [/\blogos\b/gi, 'lo-goss'],
      [/\bkosmos\b/gi, 'kos-moss'],
      [/\bnomos\b/gi, 'no-moss'],
      [/\bpistis\b/gi, 'pis-tiss'],
      [/\bhesed\b/gi, 'khè-sèd'],
      [/\bchesed\b/gi, 'khè-sèd'],
      [/\bberit\b/gi, 'bé-ritt'],
      [/\bruach\b/gi, 'rou-akh'],
      [/\bruah\b/gi, 'rou-akh'],
      [/\bshalom\b/gi, 'cha-lom'],
      [/\btorah\b/gi, 'to-ra'],
      [/\byahweh\b/gi, 'ya-vé'],
      [/\badonai\b/gi, 'a-do-na-ï'],
      [/\belohim\b/gi, 'é-lo-him']
    ];

    for (const [rePattern, phonetic] of terms) {
      s = s.replace(rePattern, phonetic);
    }

    // 4. Mots entre guillemets comportant des lettres grecques translittérées
    s = s.replace(/«\s*([a-zA-ZÀ-ÿ\^]{3,25})\s*»/g, (match, word) => {
      let p = word.toLowerCase();
      p = p.replace(/ê/g, 'é').replace(/ô/g, 'o').replace(/ó/g, 'o').replace(/á/g, 'a').replace(/í/g, 'i').replace(/ú/g, 'ou');
      p = p.replace(/ph/g, 'f').replace(/th/g, 't').replace(/ch/g, 'k');
      if (p.endsWith('os') && !p.endsWith('oss')) p = p.slice(0, -2) + 'oss';
      else if (p.endsWith('es') && !p.endsWith('ess')) p = p.slice(0, -2) + 'èss';
      else if (p.endsWith('is') && !p.endsWith('iss')) p = p.slice(0, -2) + 'iss';
      return `« ${p} »`;
    });

    // 5. Normalisation des respirations orales
    s = s.replace(/;\s*/g, ' — ');
    s = s.replace(/\s{2,}/g, ' ').trim();

    // 6. Correction des omissions d'accents des LLM
    s = s.replace(/\bcrpite\b/gi, 'crépite')
         .replace(/\bcrpitent\b/gi, 'crépitent')
         .replace(/\bcrpitement\b/gi, 'crépitement')
         .replace(/\bcrpitements\b/gi, 'crépitements')
         .replace(/\bcrpitant\b/gi, 'crépitant')
         .replace(/\bcrpitante\b/gi, 'crépitante');

    return s;
  },

  cleanScriptText(text) {
    if (!text) return '';
    return text
      .replace(/\bcrpite\b/gi, 'crépite')
      .replace(/\bcrpitent\b/gi, 'crépitent')
      .replace(/\bcrpitement\b/gi, 'crépitement')
      .replace(/\bcrpitements\b/gi, 'crépitements')
      .replace(/\bcrpitant\b/gi, 'crépitant')
      .replace(/\bcrpitante\b/gi, 'crépitante');
  },

  hasScriptVocalDivergence(script) {
    if (!Array.isArray(script) || script.length === 0) return false;
    return script.some(turn => {
      const lit = (this.cleanScriptText(turn.text) || '').trim();
      const sp = (this.cleanScriptText(turn.speech_text) || this.toPhoneticScript(lit)).trim();
      return lit !== sp;
    });
  },

  getPhoneticSpeechText(turn) {
    if (!turn) return '';
    if (turn.speech_text && turn.speech_text.trim() && turn.speech_text.trim() !== (turn.text || '').trim()) {
      return this.cleanScriptText(turn.speech_text);
    }
    return this.toPhoneticScript(this.cleanScriptText(turn.text || ''));
  },

  setTextMode(mode) {
    this.textMode = (mode === 'phonetic') ? 'phonetic' : 'literary';
    const isLit = (this.textMode === 'literary');
    const el = this.elements;

    // Mise à jour visuelle des boutons en Étape 2
    if (el.btnModeLiterary) {
      el.btnModeLiterary.style.background = isLit ? 'var(--accent-orange)' : 'transparent';
      el.btnModeLiterary.style.color = isLit ? '#fff' : 'var(--text-muted)';
      el.btnModeLiterary.classList.toggle('is-active', isLit);
    }
    if (el.btnModePhonetic) {
      el.btnModePhonetic.style.background = !isLit ? 'var(--accent-orange)' : 'transparent';
      el.btnModePhonetic.style.color = !isLit ? '#fff' : 'var(--text-muted)';
      el.btnModePhonetic.classList.toggle('is-active', !isLit);
    }
    if (el.textModeHint) {
      el.textModeHint.textContent = isLit
        ? 'Orthographe soignée & grec intact'
        : 'Script vocal optimisé pour le moteur TTS';
    }

    // Mise à jour visuelle des boutons en Étape 3 (Karaoké)
    if (el.karaokeBtnModeLiterary) {
      el.karaokeBtnModeLiterary.style.background = isLit ? 'var(--accent-orange)' : 'transparent';
      el.karaokeBtnModeLiterary.style.color = isLit ? '#fff' : 'var(--text-muted)';
      el.karaokeBtnModeLiterary.classList.toggle('is-active', isLit);
    }
    if (el.karaokeBtnModePhonetic) {
      el.karaokeBtnModePhonetic.style.background = !isLit ? 'var(--accent-orange)' : 'transparent';
      el.karaokeBtnModePhonetic.style.color = !isLit ? '#fff' : 'var(--text-muted)';
      el.karaokeBtnModePhonetic.classList.toggle('is-active', !isLit);
    }

    // Basculer les textes affichés dans les cartes du script (Étape 2)
    const script = (Array.isArray(this.currentPodcast?.script_dialogue) && this.currentPodcast.script_dialogue.length > 0)
      ? this.currentPodcast.script_dialogue
      : (Array.isArray(this.currentPodcast?.dialogue) ? this.currentPodcast.dialogue : []);

    const turnCards = el.scriptList?.querySelectorAll('.audio-studio-turn-card') || [];
    turnCards.forEach(card => {
      const idx = parseInt(card.dataset.turnIndex, 10);
      const turn = script[idx];
      if (!turn) return;
      const ta = card.querySelector('.audio-studio-turn-textarea');
      if (ta) {
        if (isLit) {
          ta.value = turn.text || '';
          ta.placeholder = "Texte littéraire (orthographe soignée, grec intact)...";
        } else {
          ta.value = this.getPhoneticSpeechText(turn);
          ta.placeholder = "Script vocal phonétique (lu par le moteur vocal TTS)...";
        }
        this.autoResizeTextarea(ta);
      }
    });

    // Basculer les textes affichés dans le Karaoké (Étape 3)
    const karaokeCards = el.karaokeScriptFlow?.querySelectorAll('.as-karaoke-card') || [];
    karaokeCards.forEach(card => {
      const idx = parseInt(card.dataset.turnIndex, 10);
      const turn = script[idx];
      if (!turn) return;
      const textEl = card.querySelector('.as-karaoke-text');
      if (textEl) {
        textEl.textContent = isLit ? (turn.text || '') : this.getPhoneticSpeechText(turn);
      }
    });
  },

  getAudioEventIconSvg(type) {
    switch (type) {
      case 'music':
        return `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`;
      case 'sfx':
        return `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2"/><path d="M9.6 4.6A2 2 0 1 1 11 8H2"/><path d="M12.6 19.4A2 2 0 1 0 14 16H2"/></svg>`;
      case 'fade_out':
        return `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`;
      case 'outro':
      default:
        return `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>`;
    }
  },

  deduplicateAudioEvents(events) {
    if (!Array.isArray(events)) return [];
    const result = [];
    for (const ev of events) {
      if (!ev) continue;
      const isDuplicate = result.some(existing => {
        // Même track_id à un moment très proche (moins de 6 secondes)
        if (existing.track_id && ev.track_id && existing.track_id === ev.track_id) {
          const diff = Math.abs((Number(existing.start_time) || 0) - (Number(ev.start_time) || 0));
          return diff < 6.0;
        }
        // Un seul jingle d'intro, un seul fade out, un seul outro
        if (ev.type === 'music' && existing.type === 'music') return true;
        if (ev.type === 'fade_out' && existing.type === 'fade_out') return true;
        if (ev.type === 'outro' && existing.type === 'outro') return true;
        return false;
      });
      if (!isDuplicate) {
        result.push(ev);
      }
    }
    return result;
  },

  getEpisodeAudioEvents(podcast) {
    if (!podcast) return [];
    let events = [];
    if (Array.isArray(this.activeAudioEvents) && this.activeAudioEvents.length > 0) {
      events = this.activeAudioEvents;
    } else if (Array.isArray(podcast.audio_events) && podcast.audio_events.length > 0) {
      events = [...podcast.audio_events];
    }
    this.activeAudioEvents = this.deduplicateAudioEvents(events);
    return this.activeAudioEvents;
  },

  toggleMusicJingleEvents(enable) {
    if (enable) {
      const hasMusic = this.activeAudioEvents.some(e => e.type === 'music' || e.type === 'intro_music' || e.type === 'fade_out' || e.type === 'outro' || e.type === 'outro_music');
      if (!hasMusic) {
        const dur = this.currentPodcast?.duration_seconds || 90.0;
        this.activeAudioEvents.push({
          id: 'event_intro_music',
          type: 'music',
          title: "Jingle d'ouverture",
          track_id: 'jingle_piano_solemn',
          start_time: 0.0,
          end_time: 10.0,
          description: "Jingle solo (10s), descente douce à 00:08 avant la voix"
        });
        this.activeAudioEvents.push({
          id: 'event_fade_out',
          type: 'fade_out',
          title: "Extinction musicale (Fade-out)",
          track_id: 'bed_cozy_jazz_study',
          start_time: 20.0,
          end_time: 24.0,
          description: "Silence musical complet pour laisser place à l'écoute de l'exégèse"
        });
        this.activeAudioEvents.push({
          id: 'event_outro_music',
          type: 'outro',
          title: "Conclusion & Outro musical",
          track_id: 'bed_cozy_jazz_study',
          start_time: Math.max(25.0, dur - 6.0),
          end_time: dur,
          description: "Remontée en crescendo de la nappe musicale et fondu final"
        });
      }
    } else {
      this.activeAudioEvents = this.activeAudioEvents.filter(e => e.type === 'sfx');
    }
    this.activeAudioEvents = this.deduplicateAudioEvents(this.activeAudioEvents);
    this.renderScript();
  },

  detectContextualSfxId() {
    const p = this.currentPodcast;
    const corpus = `${p?.subject || ''} ${p?.title || ''} ${p?.summary || ''}`.toLowerCase();
    const script = p?.script_dialogue || p?.dialogue || [];
    const textSample = script.slice(0, 8).map(d => d.text || '').join(' ').toLowerCase();
    const full = `${corpus} ${textSample}`;

    // 1. Chant du coq / Reniement de Pierre
    if (full.includes('coq') || full.includes('renie') || full.includes('pierre')) return 'sfx_rooster_crow';
    // 2. Désert / Jean-Baptiste / Jourdain
    if (full.includes('jean-baptiste') || full.includes('désert') || full.includes('desert') || full.includes('jourdain')) return 'sfx_desert_wind';
    // 3. Procès / Foule en colère / Pilate / Crucifixion
    if (full.includes('pilate') || full.includes('ponce pilate') || full.includes('crucifie') || full.includes('émeute') || full.includes('tribunal') || full.includes('condamne')) return 'sfx_angry_crowd';
    // 4. Temple / Siloé / Parvis / Jérusalem / Foule attentive
    if (full.includes('temple') || full.includes('parvis') || full.includes('synagogue') || full.includes('siloé') || full.includes('siloe') || full.includes('foule') || full.includes('assemblée') || full.includes('multitude')) return 'sfx_crowd_murmur';
    // 5. Marché / Ruelles / Ville
    if (full.includes('marché') || full.includes('marche ') || full.includes('ruelle') || full.includes('ville') || full.includes('jérusalem')) return 'sfx_ancient_marketplace';
    // 6. Mer / Lac / Barque / Tempête (exclut 'galilée' isolé)
    if (full.includes('mer de galilée') || full.includes('lac de galilée') || full.includes('mer') || full.includes('barque') || full.includes('tempête') || full.includes('ressac') || full.includes('rivage') || full.includes('filets')) return 'sfx_ocean_shore_waves';
    // 7. Feu de camp
    if (full.includes('feu') || full.includes('braise') || full.includes('camp') || full.includes('flamme')) return 'sfx_campfire_crackle';
    // 8. Brebis / Troupeau
    if (full.includes('brebis') || full.includes('berger') || full.includes('agneau') || full.includes('troupeau')) return 'sfx_sheep_flock_bells';
    // 9. Pas / Sentier d'Emmaüs
    if (full.includes('sentier') || full.includes('emmaüs') || full.includes('chemin')) return 'sfx_footsteps_trail';
    // 10. Nuit / Grillons / Gethsémané
    if (full.includes('nuit') || full.includes('grillon') || full.includes('gethsémané')) return 'sfx_night_crickets';
    return 'sfx_desert_wind';
  },

  toggleSfxEvents(enable) {
    if (enable) {
      const hasSfx = this.activeAudioEvents.some(e => e.type === 'sfx');
      if (!hasSfx) {
        const sfxId = this.detectContextualSfxId();
        const sfxTrack = (this.soundpack?.tracks || []).find(t => t.id === sfxId);
        const sfxName = sfxTrack?.name || 'Vent du Désert & Souffle';
        this.activeAudioEvents.push({
          id: 'event_sfx_ambient',
          type: 'sfx',
          title: `Bruitage contextuel : ${sfxName}`,
          track_id: sfxId,
          start_time: 0.5,
          end_time: 20.0,
          description: "Ambiance sonore contextuelle en amorce"
        });
      }
    } else {
      this.activeAudioEvents = this.activeAudioEvents.filter(e => e.type !== 'sfx');
    }
    this.activeAudioEvents = this.deduplicateAudioEvents(this.activeAudioEvents);
    this.renderScript();
  },

  deleteAudioEvent(eventId) {
    this.activeAudioEvents = this.activeAudioEvents.filter(e => (e.id || e.type) !== eventId);
    const hasMusic = this.activeAudioEvents.some(e => e.type === 'music' || e.type === 'intro_music' || e.type === 'fade_out' || e.type === 'outro' || e.type === 'outro_music');
    const hasSfx = this.activeAudioEvents.some(e => e.type === 'sfx');
    if (this.elements.checkMusicJingle) this.elements.checkMusicJingle.checked = hasMusic;
    if (this.elements.checkSfxAuto) this.elements.checkSfxAuto.checked = hasSfx;
    this.renderScript();
  },

  addManualAudioEvent() {
    if (!this.currentPodcast) return;
    const tracks = this.soundpack?.tracks || [];
    const usedTrackIds = new Set((this.activeAudioEvents || []).map(e => e.track_id));
    const sfxTracks = tracks.filter(t => t.category === 'sfx');

    let sfxId = this.detectContextualSfxId();
    // Si ce bruitage est déjà présent dans la timeline, proposer la prochaine ambiance
    if (usedTrackIds.has(sfxId)) {
      const alt = sfxTracks.find(t => !usedTrackIds.has(t.id));
      if (alt) sfxId = alt.id;
    }

    const tr = tracks.find(t => t.id === sfxId) || sfxTracks[0] || tracks[0];
    const trackName = tr?.name || 'Ambiance sonore';
    const isSfx = tr?.category === 'sfx';

    this.activeAudioEvents.push({
      id: `event_manual_${Date.now()}`,
      type: isSfx ? 'sfx' : 'music',
      title: `${isSfx ? 'Bruitage contextuel' : 'Musique & Jingle'} : ${trackName}`,
      track_id: tr?.id || sfxId,
      start_time: 0.5,
      end_time: 15.0,
      description: "Habillage sonore inséré manuellement dans le déroulé"
    });

    this.activeAudioEvents = this.deduplicateAudioEvents(this.activeAudioEvents);

    if (isSfx && this.elements.checkSfxAuto) this.elements.checkSfxAuto.checked = true;
    if (!isSfx && this.elements.checkMusicJingle) this.elements.checkMusicJingle.checked = true;
    this.renderScript();
  },

  createAudioEventCard(event, isKaraoke = false) {
    const card = document.createElement('div');
    card.className = 'as-timeline-event-card';
    const evType = (event.type === 'intro_music' ? 'music' : (event.type === 'outro_music' ? 'outro' : (event.type === 'fadeout' ? 'fade_out' : event.type)));
    card.dataset.eventType = evType || 'music';
    const eventId = event.id || `event_${event.type}`;
    card.dataset.eventId = eventId;
    if (typeof event.start_time === 'number') card.dataset.startTime = event.start_time;
    if (typeof event.end_time === 'number') card.dataset.endTime = event.end_time;

    const timeLabel = `${this.formatTime(event.start_time || 0)} – ${this.formatTime(event.end_time || 0)}`;
    const iconSvg = this.getAudioEventIconSvg(evType);

    // Construction du sélecteur de piste sonore personnalisée
    let trackOptionsHtml = '';
    const tracks = this.soundpack?.tracks || [];
    if (!isKaraoke && tracks.length > 0 && evType !== 'fade_out') {
      let filteredTracks = [];
      if (evType === 'sfx') {
        filteredTracks = tracks.filter(t => t.category === 'sfx');
      } else if (evType === 'music') {
        filteredTracks = tracks.filter(t => t.category === 'jingle_intro' || t.category === 'music');
      } else {
        filteredTracks = tracks.filter(t => t.category === 'music');
      }
      if (filteredTracks.length > 0) {
        trackOptionsHtml = `<select class="as-event-track-select" title="Changer la piste sonore">`;
        filteredTracks.forEach(tr => {
          const sel = (tr.id === event.track_id) ? 'selected' : '';
          trackOptionsHtml += `<option value="${tr.id}" ${sel}>${this.escapeHtml(tr.name)}</option>`;
        });
        trackOptionsHtml += `</select>`;
      }
    }

    const isFadeOut = (evType === 'fade_out');
    const effectiveTrackId = event.track_id || (evType === 'sfx' ? 'sfx_desert_wind' : (evType === 'fade_out' ? 'bed_cozy_jazz_study' : 'jingle_piano_solemn'));

    let iconHtml = '';
    if (isFadeOut) {
      iconHtml = `
        <div class="as-timeline-event-icon as-event-icon-static" title="Extinction musicale (Silence)">
          <span class="as-icon-default">${iconSvg}</span>
        </div>
      `;
    } else {
      iconHtml = `
        <button type="button" class="as-timeline-event-icon as-event-preview-btn" title="${isKaraoke ? 'Cliquer pour écouter à partir de ' + timeLabel : 'Écouter un extrait de ce son'}" data-track-id="${effectiveTrackId}">
          <span class="as-icon-default">${iconSvg}</span>
          <span class="as-icon-hover" title="Écouter un extrait">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"/></svg>
          </span>
          <span class="as-icon-playing" title="Arrêter la lecture">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>
          </span>
          <span class="as-icon-loading">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" class="as-spin"><circle cx="12" cy="12" r="10" stroke-opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"/></svg>
          </span>
        </button>
      `;
    }

    card.innerHTML = `
      ${iconHtml}
      <div class="as-timeline-event-body">
        <div class="as-timeline-event-header">
          <div class="as-timeline-event-title">${this.escapeHtml(event.title || 'Événement sonore')}</div>
          <div class="as-event-actions">
            ${trackOptionsHtml}
            <span class="as-timeline-event-badge">${timeLabel}</span>
            ${!isKaraoke ? `
              <button type="button" class="as-event-btn-delete" title="Supprimer cet élément sonore">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            ` : ''}
          </div>
        </div>
        <div class="as-timeline-event-desc">${this.escapeHtml(event.description || '')}</div>
      </div>
    `;

    // Événement préécoute sur l'icône
    const iconBtn = card.querySelector('.as-timeline-event-icon');
    if (iconBtn && !isKaraoke) {
      iconBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const trId = iconBtn.dataset.trackId || effectiveTrackId;
        this.previewSoundpackTrackFromCard(trId, iconBtn);
      });
    }

    // Événement changement de piste
    const trackSelect = card.querySelector('.as-event-track-select');
    if (trackSelect) {
      trackSelect.addEventListener('change', (e) => {
        event.track_id = e.target.value;
        if (iconBtn) iconBtn.dataset.trackId = e.target.value;
        const chosen = tracks.find(t => t.id === e.target.value);
        if (chosen) {
          if (evType === 'sfx') {
            event.title = `Bruitage contextuel : ${chosen.name}`;
          } else if (evType === 'music') {
            event.title = chosen.name;
          }
        }
        const titleEl = card.querySelector('.as-timeline-event-title');
        if (titleEl) titleEl.textContent = event.title;
      });
    }

    // Événement suppression
    const btnDelete = card.querySelector('.as-event-btn-delete');
    if (btnDelete) {
      btnDelete.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteAudioEvent(eventId);
      });
    }

    if (isKaraoke) {
      card.title = `Cliquer pour écouter à partir de ${this.formatTime(event.start_time || 0)}`;
      card.addEventListener('click', () => {
        const audio = this.elements.html5Player;
        if (audio && typeof event.start_time === 'number') {
          audio.currentTime = event.start_time;
          if (audio.paused) {
            audio.play().catch(e => console.warn('[AudioStudioView] Erreur audio play:', e));
          }
        }
      });
    }

    return card;
  },

  // =========================================================================
  // RENDU DU SCRIPT DANS LA COLONNE GAUCHE
  // =========================================================================

  renderScript() {
    const p = this.currentPodcast;
    const el = this.elements;
    if (!p) {
      this.clearScript();
      return;
    }

    // Header métadonnées et synchronisation du format
    if (el.episodeTitleInput) el.episodeTitleInput.value = p.title || 'Script audio';
    const fmt = p.format || p.format_type || this.format || 'dialogue';
    this.format = fmt;
    if (typeof this.setFormat === 'function') {
      this.setFormat(fmt);
    } else if (el.metaFormat) {
      el.metaFormat.textContent = fmt === 'dialogue' ? 'Dialogue (2 voix)' : 'Chronique Solo';
    }

    const script = (Array.isArray(p.script_dialogue) && p.script_dialogue.length > 0)
      ? p.script_dialogue
      : (Array.isArray(p.dialogue) ? p.dialogue : []);
    if (el.metaTurns) {
      el.metaTurns.textContent = `${script.length} réplique${script.length > 1 ? 's' : ''}`;
    }

    // Estimation durée
    const totalWords = script.reduce((acc, t) => acc + (t.text ? t.text.split(/\s+/).length : 0), 0);
    const estMin = Math.max(1, Math.round(totalWords / 140));
    if (el.metaDuration) {
      if (p.duration_seconds && p.duration_seconds > 0) {
        const m = Math.floor(p.duration_seconds / 60);
        const s = Math.round(p.duration_seconds % 60);
        el.metaDuration.textContent = `Durée réelle : ${m}m ${s < 10 ? '0' : ''}${s}s`;
      } else {
        el.metaDuration.textContent = `Durée estimée : ~${estMin} min`;
      }
    }

    // Sources interrogées
    if (el.sourcesPillsContainer) {
      el.sourcesPillsContainer.innerHTML = '';
      const srcUsed = p.sources_used || [];
      srcUsed.forEach(s => {
        const pill = document.createElement('span');
        pill.className = 'audio-studio-source-pill';
        pill.textContent = s;
        el.sourcesPillsContainer.appendChild(pill);
      });
    }

    // Affichage des répliques
    if (el.scriptEmptyState) el.scriptEmptyState.style.display = 'none';
    if (el.scriptList) el.scriptList.style.display = 'flex';
    if (el.addTurnContainer) el.addTurnContainer.style.display = 'flex';

    // Affichage conditionnel de la barre de choix [Texte littéraire] / [Script vocal TTS] :
    // Masquée si aucune divergence phonétique ou textuelle n'existe
    const hasDiff = this.hasScriptVocalDivergence(script);
    const modeBar = document.querySelector('.as-text-mode-bar');
    if (modeBar) {
      modeBar.style.display = hasDiff ? 'flex' : 'none';
    }

    if (el.scriptList) {
      el.scriptList.innerHTML = '';
      const audioEvents = this.getEpisodeAudioEvents(p);
      const introEvent = audioEvents.find(e => e.type === 'music' || e.type === 'intro_music');
      const sfxEvents = audioEvents.filter(e => e.type === 'sfx');
      const fadeEvent = audioEvents.find(e => e.type === 'fade_out' || e.type === 'fadeout');
      const outroEvent = audioEvents.find(e => e.type === 'outro' || e.type === 'outro_music');

      if (introEvent) {
        el.scriptList.appendChild(this.createAudioEventCard(introEvent, false));
      }
      sfxEvents.forEach(sfx => {
        el.scriptList.appendChild(this.createAudioEventCard(sfx, false));
      });

      script.forEach((turn, idx) => {
        const card = this.createTurnCard(turn, idx);
        el.scriptList.appendChild(card);

        if (fadeEvent && idx === 0) {
          el.scriptList.appendChild(this.createAudioEventCard(fadeEvent, false));
        }
      });

      if (outroEvent) {
        el.scriptList.appendChild(this.createAudioEventCard(outroEvent, false));
      }
    }

    // Mettre à jour l'état du lecteur si l'audio existe déjà
    if (p.audio_data_url || p.audio_file) {
      this.loadAudioInPlayer(p.audio_data_url);
      if (el.btnDownload) el.btnDownload.disabled = false;
      if (el.btnExportNote) el.btnExportNote.disabled = false;
    } else {
      if (el.btnDownload) el.btnDownload.disabled = true;
      if (el.btnExportNote) el.btnExportNote.disabled = true;
      if (el.playerStatus) el.playerStatus.textContent = 'En attente de synthèse';
    }
  },

  createTurnCard(turn, idx) {
    const card = document.createElement('div');
    card.className = 'audio-studio-turn-card';
    card.dataset.turnIndex = idx;
    if (typeof turn.start_time === 'number') card.dataset.startTime = turn.start_time;
    if (typeof turn.end_time === 'number') card.dataset.endTime = turn.end_time;

    // Nettoyage des coquilles de texte
    turn.text = this.cleanScriptText(turn.text);
    if (turn.speech_text) turn.speech_text = this.cleanScriptText(turn.speech_text);

    const isSolo = (this.format === 'solo');
    let voiceRole = turn.voice_role;
    if (!voiceRole) {
      if (isSolo) {
        voiceRole = 'solo';
      } else {
        const spkLower = (turn.speaker || '').toLowerCase();
        if (spkLower.includes('scholar') || spkLower.includes('théologien') || spkLower.includes('theologien') || spkLower.includes('exégète') || spkLower.includes('exegete') || spkLower.includes('chercheur') || spkLower.includes('henri') || spkLower === 'b') {
          voiceRole = 'B';
        } else if (spkLower.includes('host') || spkLower.includes('animateur') || spkLower.includes('animatrice') || spkLower.includes('denise') || spkLower === 'a') {
          voiceRole = 'A';
        } else {
          voiceRole = (idx % 2 === 0) ? 'A' : 'B';
        }
      }
    }
    card.dataset.voiceRole = voiceRole;

    const isVoxtral = (this.config?.engine === 'voxtral');
    let hostName, scholarName, soloName;
    if (isVoxtral) {
      hostName = this.getVoiceShortName(this.elements.selectVoxtralHost?.value || this.config?.voxtral_voice_speaker_a || 'Marie - Happy');
      scholarName = this.getVoiceShortName(this.elements.selectVoxtralScholar?.value || this.config?.voxtral_voice_speaker_b || 'Marie - Neutral');
      soloName = this.getVoiceShortName(this.elements.selectVoxtralSolo?.value || this.config?.voxtral_voice_solo || 'Marie - Neutral');
    } else {
      hostName = this.getVoiceShortName(this.elements.selectVoiceHost?.value || this.config?.voice_speaker_a || 'fr-FR-DeniseNeural');
      scholarName = this.getVoiceShortName(this.elements.selectVoiceScholar?.value || this.config?.voice_speaker_b || 'fr-FR-HenriNeural');
      soloName = this.getVoiceShortName(this.elements.selectVoiceSolo?.value || this.config?.voice_solo || 'fr-FR-HenriNeural');
    }

    let roleClass = 'role-host';
    let displaySpeaker = '';
    if (voiceRole === 'solo' || isSolo) {
      roleClass = 'role-solo';
      displaySpeaker = `Narrateur (${soloName})`;
    } else if (voiceRole === 'B' || voiceRole === 'SCHOLAR') {
      roleClass = 'role-scholar';
      displaySpeaker = `Exégète (${scholarName})`;
    } else {
      roleClass = 'role-host';
      displaySpeaker = `Animateur (${hostName})`;
    }
    card.dataset.speakerName = displaySpeaker;

    const timeLabel = (typeof turn.start_time === 'number')
      ? `${this.formatTime(turn.start_time)} – ${this.formatTime(turn.end_time || turn.start_time)}`
      : `#${idx + 1}`;

    const pauseMs = turn.pause_after_ms || 350;

    const isPhonetic = (this.textMode === 'phonetic');
    const displayVal = isPhonetic ? this.getPhoneticSpeechText(turn) : (turn.text || '');
    const placeholderVal = isPhonetic
      ? "Script vocal phonétique (lu par le moteur vocal TTS)..."
      : "Texte littéraire (orthographe soignée, grec intact)...";

    card.innerHTML = `
      <div class="audio-studio-turn-header">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span class="audio-studio-speaker-badge ${roleClass}">
            ${this.escapeHtml(displaySpeaker)}
          </span>
          <span class="audio-studio-turn-time">${timeLabel}</span>
        </div>
        <div class="audio-studio-turn-actions">
          <label class="audio-studio-pause-field" title="Pause silencieuse après cette réplique en millisecondes">
            <span>Pause :</span>
            <input type="number" class="turn-pause-input" value="${pauseMs}" min="100" max="2500" step="50">
            <span>ms</span>
          </label>
          <button type="button" class="as-turn-btn-action as-turn-btn-edit" title="Modifier le texte de cette partie du script">
            <span class="as-btn-icon-pencil">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </span>
            <span class="as-btn-icon-check" style="display: none;">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </span>
          </button>
          <button type="button" class="as-turn-btn-action as-turn-btn-delete" title="Supprimer cette partie du script">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      </div>
      <textarea class="audio-studio-turn-textarea" placeholder="${placeholderVal}">${this.escapeHtml(displayVal)}</textarea>
    `;

    // Événement auto-resize & synchronisation
    const textarea = card.querySelector('.audio-studio-turn-textarea');
    if (textarea) {
      this.autoResizeTextarea(textarea);
      textarea.addEventListener('input', () => {
        this.autoResizeTextarea(textarea);
        if (this.currentPodcast?.script_dialogue?.[idx]) {
          if (this.textMode === 'phonetic') {
            this.currentPodcast.script_dialogue[idx].speech_text = textarea.value;
          } else {
            this.currentPodcast.script_dialogue[idx].text = textarea.value;
            this.currentPodcast.script_dialogue[idx].speech_text = '';
          }
        }
      });
    }

    // Événement pause
    const pauseInput = card.querySelector('.turn-pause-input');
    pauseInput?.addEventListener('change', (e) => {
      const val = parseInt(e.target.value, 10) || 350;
      if (this.currentPodcast?.script_dialogue?.[idx]) {
        this.currentPodcast.script_dialogue[idx].pause_after_ms = val;
      }
    });

    // Événement édition (crayon / validation)
    const btnEdit = card.querySelector('.as-turn-btn-edit');
    const iconPencil = card.querySelector('.as-btn-icon-pencil');
    const iconCheck = card.querySelector('.as-btn-icon-check');
    if (btnEdit && textarea) {
      btnEdit.addEventListener('click', (e) => {
        e.stopPropagation();
        const isEditing = card.classList.contains('is-editing');
        if (!isEditing) {
          card.classList.add('is-editing');
          if (iconPencil) iconPencil.style.display = 'none';
          if (iconCheck) iconCheck.style.display = 'inline-flex';
          btnEdit.title = "Valider et terminer la modification";
          btnEdit.classList.add('active');
          textarea.focus();
          const len = textarea.value.length;
          textarea.setSelectionRange(len, len);
        } else {
          card.classList.remove('is-editing');
          if (iconPencil) iconPencil.style.display = 'inline-flex';
          if (iconCheck) iconCheck.style.display = 'none';
          btnEdit.title = "Modifier le texte de cette partie du script";
          btnEdit.classList.remove('active');
          textarea.blur();
          if (typeof App !== 'undefined' && typeof App.showToast === 'function') {
            App.showToast('Modification enregistrée');
          }
        }
      });

      textarea.addEventListener('focus', () => {
        card.classList.add('is-editing');
        if (iconPencil) iconPencil.style.display = 'none';
        if (iconCheck) iconCheck.style.display = 'inline-flex';
        btnEdit.title = "Valider et terminer la modification";
        btnEdit.classList.add('active');
      });

      textarea.addEventListener('blur', () => {
        card.classList.remove('is-editing');
        if (iconPencil) iconPencil.style.display = 'inline-flex';
        if (iconCheck) iconCheck.style.display = 'none';
        btnEdit.title = "Modifier le texte de cette partie du script";
        btnEdit.classList.remove('active');
      });
    }

    // Événement suppression
    const btnDelete = card.querySelector('.as-turn-btn-delete');
    btnDelete?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.deleteTurn(idx);
    });

    return card;
  },

  autoResizeTextarea(el) {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(60, el.scrollHeight + 4)}px`;
  },

  addManualTurn() {
    if (!this.currentPodcast) {
      this.currentPodcast = {
        id: `podcast_${Date.now()}`,
        title: this.elements.episodeTitleInput?.value || 'Nouvel épisode',
        format: this.format,
        created_at: new Date().toISOString(),
        script_dialogue: []
      };
    }
    if (!Array.isArray(this.currentPodcast.script_dialogue)) {
      this.currentPodcast.script_dialogue = [];
    }

    const turns = this.currentPodcast.script_dialogue;
    const isSolo = (this.format === 'solo');
    const voiceRole = isSolo ? 'solo' : (turns.length % 2 === 0 ? 'A' : 'B');
    const nextSpeaker = isSolo ? 'Narrateur' : (turns.length % 2 === 0 ? 'Animatrice' : 'Exégète');

    turns.push({
      speaker: nextSpeaker,
      speaker_name: nextSpeaker,
      voice_role: voiceRole,
      text: '',
      speech_text: '',
      pause_after_ms: 350,
      start_time: 0.0,
      end_time: 0.0
    });

    this.renderScript();

    setTimeout(() => {
      const cards = this.elements.scriptList?.querySelectorAll('.audio-studio-turn-card');
      const lastCard = cards?.[cards.length - 1];
      if (lastCard) {
        lastCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const ta = lastCard.querySelector('textarea');
        ta?.focus();
      }
    }, 50);
  },

  deleteTurn(idx) {
    if (!this.currentPodcast) return;
    const p = this.currentPodcast;
    const script = Array.isArray(p.script_dialogue)
      ? p.script_dialogue
      : (Array.isArray(p.dialogue) ? p.dialogue : null);

    if (!script || idx < 0 || idx >= script.length) return;

    script.splice(idx, 1);
    if (Array.isArray(p.dialogue) && p.dialogue !== script) {
      if (idx < p.dialogue.length) {
        p.dialogue.splice(idx, 1);
      }
    }
    p.script_dialogue = script;
    script.forEach((t, i) => { t.index = i; });

    if (p.id && typeof PodcastHistory !== 'undefined' && typeof PodcastHistory.upsert === 'function') {
      PodcastHistory.upsert(p);
    }

    this.renderScript();

    if (typeof App !== 'undefined' && typeof App.showToast === 'function') {
      App.showToast('Partie du script supprimée');
    }
  },

  clearScript() {
    this.currentPodcast = null;
    this.activeAudioEvents = [];
    const el = this.elements;
    if (el.checkMusicJingle) el.checkMusicJingle.checked = false;
    if (el.checkSfxAuto) el.checkSfxAuto.checked = false;
    if (el.episodeTitleInput) el.episodeTitleInput.value = 'Nouveau script audio';
    if (el.metaTurns) el.metaTurns.textContent = '0 réplique';
    if (el.metaDuration) el.metaDuration.textContent = 'Durée estimée : ~0 min';
    if (el.sourcesPillsContainer) el.sourcesPillsContainer.innerHTML = '';
    if (el.scriptList) {
      el.scriptList.innerHTML = '';
      el.scriptList.style.display = 'none';
    }
    if (el.addTurnContainer) el.addTurnContainer.style.display = 'none';
    if (el.scriptEmptyState) el.scriptEmptyState.style.display = 'flex';

    if (el.btnDownload) el.btnDownload.disabled = true;
    if (el.btnExportNote) el.btnExportNote.disabled = true;
    if (el.playerStatus) el.playerStatus.textContent = 'En attente';

    if (el.html5Player) {
      el.html5Player.pause();
      el.html5Player.src = '';
    }
    if (el.seekbar) el.seekbar.value = 0;
    if (el.timeCurrent) el.timeCurrent.textContent = '00:00';
    if (el.timeDuration) el.timeDuration.textContent = '00:00';
  },

  // =========================================================================
  // SYNTHÈSE VOCALE AUDIO (Edge-TTS & Voxtral)
  // =========================================================================

  collectCurrentScriptFromUI() {
    if (!this.currentPodcast) return [];
    const cards = this.elements.scriptList?.querySelectorAll('.audio-studio-turn-card') || [];
    if (cards.length === 0) {
      const fallback = (Array.isArray(this.currentPodcast.script_dialogue) && this.currentPodcast.script_dialogue.length > 0)
        ? this.currentPodcast.script_dialogue
        : (Array.isArray(this.currentPodcast.dialogue) ? this.currentPodcast.dialogue : []);
      return fallback;
    }
    const list = [];
    cards.forEach(card => {
      const idx = parseInt(card.dataset.turnIndex, 10);
      const textEl = card.querySelector('.audio-studio-turn-textarea');
      const pauseEl = card.querySelector('.turn-pause-input');
      // Lire le rôle depuis le dataset de la card (défini lors du rendu)
      const voiceRole = card.dataset.voiceRole || (idx % 2 === 0 ? 'A' : 'B');
      const isVoxtral = (this.config?.engine === 'voxtral');
      let hostName, scholarName, soloName;
      if (isVoxtral) {
        hostName = this.getVoiceShortName(this.elements.selectVoxtralHost?.value || this.config?.voxtral_voice_speaker_a || 'Marie - Happy');
        scholarName = this.getVoiceShortName(this.elements.selectVoxtralScholar?.value || this.config?.voxtral_voice_speaker_b || 'Marie - Neutral');
        soloName = this.getVoiceShortName(this.elements.selectVoxtralSolo?.value || this.config?.voxtral_voice_solo || 'Marie - Neutral');
      } else {
        hostName = this.getVoiceShortName(this.elements.selectVoiceHost?.value || this.config?.voice_speaker_a || 'fr-FR-DeniseNeural');
        scholarName = this.getVoiceShortName(this.elements.selectVoiceScholar?.value || this.config?.voice_speaker_b || 'fr-FR-HenriNeural');
        soloName = this.getVoiceShortName(this.elements.selectVoiceSolo?.value || this.config?.voice_solo || 'fr-FR-HenriNeural');
      }
      const fallbackSpeaker = (voiceRole === 'B') ? `Exégète (${scholarName})` : (voiceRole === 'solo' ? `Narrateur (${soloName})` : `Animateur (${hostName})`);
      const speakerName = card.dataset.speakerName || fallbackSpeaker;

      list.push({
        speaker: speakerName,
        speaker_name: speakerName,
        voice_role: voiceRole,
        text: textEl ? textEl.value.trim() : '',
        pause_after_ms: pauseEl ? parseInt(pauseEl.value, 10) : 350
      });
    });
    this.currentPodcast.script_dialogue = list;
    this.currentPodcast.dialogue = list;
    return list;
  },

  async startSynthesis() {
    if (!this.currentPodcast) {
      this.showErrorToast("Veuillez d'abord rédiger ou charger un script.");
      return;
    }

    const script = this.collectCurrentScriptFromUI();
    const nonEmptyTurns = script.filter(t => t.text && t.text.trim().length > 0);
    if (nonEmptyTurns.length === 0) {
      this.showErrorToast("Le script ne contient aucune réplique avec du texte.");
      return;
    }

    if (this.isSynthesizing) return;
    this.isSynthesizing = true;

    const el = this.elements;
    const isVoxtral = (this.config?.engine === 'voxtral');
    const hasMusic = this.activeAudioEvents.some(e => e.type === 'music' || e.type === 'intro_music' || e.type === 'fade_out' || e.type === 'outro' || e.type === 'outro_music');
    const hasSfx = this.activeAudioEvents.some(e => e.type === 'sfx');

    // Contrôle et ajustement automatique en cas de doublon en mode dialogue
    const activeEng = this.config?.engine || 'edge_tts';
    if (this.format === 'dialogue') {
      if (activeEng === 'gemini_tts') {
        const v1 = el.selectGeminiHost?.value;
        const v2 = el.selectGeminiScholar?.value;
        if (v1 && v2 && v1 === v2) {
          this.syncGeminiVoicePair(true, 'host', true);
        }
      } else if (activeEng === 'voxtral') {
        const v1 = el.selectVoxtralHost?.value;
        const v2 = el.selectVoxtralScholar?.value;
        if (v1 && v2 && v1 === v2) {
          this.syncVoxtralVoicePair(true, 'host', true);
        }
      } else if (activeEng === 'edge_tts') {
        const v1 = el.selectVoiceHost?.value;
        const v2 = el.selectVoiceScholar?.value;
        if (v1 && v2 && v1 === v2) {
          this.syncVoicePair(true, 'host', true);
        }
      }
    }

    // Cacher les éléments de configuration et afficher le récapitulatif compact
    if (el.step2ConfigControls) el.step2ConfigControls.style.display = 'none';
    if (el.btnSynthesize) el.btnSynthesize.style.display = 'none';
    if (el.step2CardTitle) {
      el.step2CardTitle.innerHTML = '<span class="as-pulse-dot"></span> Synthèse audio en cours...';
    }

    if (el.step2ActiveSummary) {
      const isDialogue = (this.format === 'dialogue');
      const fmtName = isDialogue ? 'Dialogue (2 voix)' : 'Chronique Solo';
      let engineLabel = 'Edge-TTS';
      if (activeEng === 'gemini_tts') engineLabel = 'Google Gemini Flash';
      else if (activeEng === 'voxtral') engineLabel = 'Mistral Voxtral';
      else if (activeEng === 'mixed') engineLabel = 'Mix Multi-Moteurs';

      const extractVoiceName = (sel, fallback) => {
        if (!sel) return fallback || '';
        const opt = sel.selectedOptions?.[0];
        if (!opt) return sel.value || fallback || '';
        const text = opt.text.trim();
        const parenIdx = text.indexOf('(');
        if (parenIdx > 0) return text.substring(0, parenIdx).trim();
        const dashIdx = text.indexOf(' - ');
        if (dashIdx > 0) return text.substring(0, dashIdx).trim();
        return text;
      };

      let voiceSummaryHtml = '';
      if (isDialogue) {
        let vA, vB;
        if (activeEng === 'gemini_tts') {
          vA = extractVoiceName(el.selectGeminiHost, 'Puck');
          vB = extractVoiceName(el.selectGeminiScholar, 'Charon');
        } else if (activeEng === 'voxtral') {
          vA = extractVoiceName(el.selectVoxtralHost, 'Marie');
          vB = extractVoiceName(el.selectVoxtralScholar, 'Jacques');
        } else if (activeEng === 'mixed') {
          const engA = el.selectMixedEngineHost?.value || 'gemini_tts';
          const engB = el.selectMixedEngineScholar?.value || 'edge_tts';
          vA = `${extractVoiceName(el.selectMixedVoiceHost, 'Puck')} (${engA})`;
          vB = `${extractVoiceName(el.selectMixedVoiceScholar, 'Henri')} (${engB})`;
        } else {
          vA = extractVoiceName(el.selectVoiceHost, 'Vivienne');
          vB = extractVoiceName(el.selectVoiceScholar, 'Fabrice');
        }
        voiceSummaryHtml = `<strong>${this.escapeHtml(vA)}</strong> (Animatrice) &amp; <strong>${this.escapeHtml(vB)}</strong> (Exégète)`;
      } else {
        let vSolo;
        if (activeEng === 'gemini_tts') {
          vSolo = extractVoiceName(el.selectGeminiSolo, 'Puck');
        } else if (activeEng === 'voxtral') {
          vSolo = extractVoiceName(el.selectVoxtralSolo, 'Marie');
        } else if (activeEng === 'mixed') {
          const engSolo = el.selectMixedEngineSolo?.value || 'gemini_tts';
          vSolo = `${extractVoiceName(el.selectMixedVoiceSolo, 'Puck')} (${engSolo})`;
        } else {
          vSolo = extractVoiceName(el.selectVoiceSolo, 'Fabrice');
        }
        voiceSummaryHtml = `<strong>${this.escapeHtml(vSolo)}</strong> (Chroniqueur)`;
      }

      let habillageTitle = '<span style="color: var(--text-muted);">Voix pure (Aucun habillage)</span>';
      if (hasMusic && hasSfx) {
        habillageTitle = '<strong>Musique &amp; Jingle</strong> + <strong>Bruitages contextuels</strong>';
      } else if (hasMusic) {
        habillageTitle = '<strong>Musique d\'ambiance &amp; Jingle</strong>';
      } else if (hasSfx) {
        habillageTitle = '<strong>Bruitages contextuels auto</strong>';
      }

      const dspPills = [];
      if (el.checkMastering?.checked) dspPills.push('Mastering Studio');
      if (el.checkCalmProsody?.checked) dspPills.push('Prosodie posée');
      if (el.selectRate?.value) {
        dspPills.push(`Cadence ${el.selectRate.value}`);
      } else if (el.checkCalmProsody?.checked) {
        dspPills.push('Cadence -14%');
      }
      if (hasMusic && el.checkDucking?.checked) dspPills.push('Ducking -30 dB');
      if (hasMusic) {
        const isIntro = (!el.selectMusicTiming || el.selectMusicTiming.value === 'intro_outro');
        dspPills.push(isIntro ? 'Intro (10s) / Outro' : 'Ambiance continue');
      }
      const pauseMs = parseInt(el.inputPauseMs?.value, 10) || 350;
      if (pauseMs !== 350) dspPills.push(`Pause ${pauseMs}ms`);

      el.step2ActiveSummary.innerHTML = `
        <div class="as-step2-summary-row">
          <span class="as-step2-summary-label">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg>
            Voix
          </span>
          <span class="as-step2-summary-val">${voiceSummaryHtml}</span>
        </div>
        <div class="as-step2-summary-row">
          <span class="as-step2-summary-label">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m10 15 5-3-5-3v6Z"/></svg>
            Format
          </span>
          <span class="as-step2-summary-val">${fmtName} &bull; <span style="color: var(--accent-orange); font-weight: 700;">${engineLabel}</span></span>
        </div>
        <div class="as-step2-summary-row">
          <span class="as-step2-summary-label">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
            Habillage
          </span>
          <span class="as-step2-summary-val">${habillageTitle}</span>
        </div>
        ${dspPills.length > 0 ? `
        <div class="as-step2-summary-row" style="margin-top: 2px;">
          <span class="as-step2-summary-label">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>
            Audio
          </span>
          <span class="as-step2-summary-tags">
            ${dspPills.map(p => `<span class="as-step2-summary-tag">${p}</span>`).join('')}
          </span>
        </div>` : ''}
      `;
      el.step2ActiveSummary.style.display = 'flex';
    }

    if (el.btnSynthesize) {
      el.btnSynthesize.disabled = true;
      el.btnSynthesize.innerHTML = `
        <span class="audio-studio-spinner"></span>
        <span>Synthèse audio en cours...</span>
      `;
    }

    this.currentSynthesisPct = 5;
    this.targetSynthesisPct = 8;
    this.latestSynthesisMsg = 'Préparation des voix et découpage phonétique...';

    if (el.progressBox) {
      el.progressBox.style.display = 'flex';
      if (el.progressPct) el.progressPct.textContent = '5%';
      if (el.progressBarFill) el.progressBarFill.style.width = '5%';
      if (el.progressMsg) el.progressMsg.textContent = this.latestSynthesisMsg;
    }

    // Intervalle d'animation fluide vers la valeur cible envoyée par le backend
    if (this.synthesisAnimInterval) clearInterval(this.synthesisAnimInterval);
    this.synthesisAnimInterval = setInterval(() => {
      if (this.currentSynthesisPct < this.targetSynthesisPct) {
        const step = Math.max(0.35, (this.targetSynthesisPct - this.currentSynthesisPct) * 0.12);
        this.currentSynthesisPct = Math.min(this.targetSynthesisPct, this.currentSynthesisPct + step);
        const displayPct = Math.round(this.currentSynthesisPct);
        if (el.progressPct) el.progressPct.textContent = `${displayPct}%`;
        if (el.progressBarFill) el.progressBarFill.style.width = `${displayPct}%`;
      }
      if (this.latestSynthesisMsg && el.progressMsg) {
        el.progressMsg.textContent = this.latestSynthesisMsg;
      }
    }, 50);

    if (typeof NotificationManager !== 'undefined') {
      NotificationManager.setWorkingState('audio-studio', true);
    }

    try {
      const activeEngine = this.config?.engine || 'edge_tts';
      let spkA, spkB, spkSolo;
      if (activeEngine === 'gemini_tts') {
        spkA = el.selectGeminiHost?.value || this.config?.gemini_voice_speaker_a || 'Puck';
        spkB = el.selectGeminiScholar?.value || this.config?.gemini_voice_speaker_b || 'Charon';
        spkSolo = el.selectGeminiSolo?.value || this.config?.gemini_voice_solo || 'Puck';
      } else if (activeEngine === 'voxtral') {
        spkA = el.selectVoxtralHost?.value || this.config?.voxtral_voice_speaker_a || 'Marie - Happy';
        spkB = el.selectVoxtralScholar?.value || this.config?.voxtral_voice_speaker_b || 'Marie - Neutral';
        spkSolo = el.selectVoxtralSolo?.value || this.config?.voxtral_voice_solo || 'Marie - Neutral';
      } else if (activeEngine === 'mixed') {
        spkA = el.selectMixedVoiceHost?.value || this.config?.speaker_a_voice || 'Puck';
        spkB = el.selectMixedVoiceScholar?.value || this.config?.speaker_b_voice || 'fr-CH-FabriceNeural';
        spkSolo = el.selectMixedVoiceSolo?.value || this.config?.solo_voice || 'Puck';
      } else {
        spkA = el.selectVoiceHost?.value || this.config?.voice_speaker_a || 'fr-FR-VivienneMultilingualNeural';
        spkB = el.selectVoiceScholar?.value || this.config?.voice_scholar || 'fr-CH-FabriceNeural';
        spkSolo = el.selectVoiceSolo?.value || this.config?.voice_solo || 'fr-CH-FabriceNeural';
      }

      const customOptions = {
        format_type: this.format,
        format: this.format,
        engine: activeEngine,
        engine_mode: (activeEngine === 'mixed') ? 'mixed' : 'single',
        voice_speaker_a: spkA,
        voice_speaker_b: spkB,
        voice_solo: spkSolo,
        gemini_model: el.selectGeminiModel?.value || this.config?.gemini_model || 'gemini-3.1-flash-tts-preview',
        gemini_voice_speaker_a: el.selectGeminiHost?.value || this.config?.gemini_voice_speaker_a || 'Puck',
        gemini_voice_speaker_b: el.selectGeminiScholar?.value || this.config?.gemini_voice_speaker_b || 'Charon',
        gemini_voice_solo: el.selectGeminiSolo?.value || this.config?.gemini_voice_solo || 'Puck',
        speaker_a_engine: el.selectMixedEngineHost?.value || this.config?.speaker_a_engine || 'gemini_tts',
        speaker_b_engine: el.selectMixedEngineScholar?.value || this.config?.speaker_b_engine || 'edge_tts',
        solo_engine: el.selectMixedEngineSolo?.value || this.config?.solo_engine || 'gemini_tts',
        voxtral_voice_speaker_a: el.selectVoxtralHost?.value || this.config?.voxtral_voice_speaker_a || 'Marie - Happy',
        voxtral_voice_scholar: el.selectVoxtralScholar?.value || this.config?.voxtral_voice_speaker_b || 'Marie - Neutral',
        voxtral_voice_solo: el.selectVoxtralSolo?.value || this.config?.voxtral_voice_solo || 'Marie - Neutral',
        voxtral_modulate: el.checkVoxtralModulate ? el.checkVoxtralModulate.checked : true,
        pause_ms: parseInt(el.inputPauseMs?.value, 10) || 350,
        mastering_enabled: el.checkMastering ? el.checkMastering.checked : true,
        calm_prosody: el.checkCalmProsody ? el.checkCalmProsody.checked : true,
        rate: el.selectRate?.value || (el.checkCalmProsody?.checked ? '-14%' : '+0%'),
        pitch: el.checkCalmProsody?.checked ? '-3Hz' : '+0Hz',
        inject_breaks: el.checkCalmProsody ? el.checkCalmProsody.checked : true,
        audio_events: this.activeAudioEvents,
        music_enabled: Boolean(this.activeAudioEvents.find(e => (e.type === 'fade_out' || e.type === 'outro') && e.track_id && !e.track_id.startsWith('jingle'))),
        jingle_enabled: Boolean(this.activeAudioEvents.find(e => (e.type === 'music' || e.type === 'intro_music') && e.track_id)),
        sfx_enabled: hasSfx,
        bg_music: this.activeAudioEvents.find(e => (e.type === 'fade_out' || e.type === 'outro') && e.track_id && !e.track_id.startsWith('jingle'))?.track_id || 'none',
        jingle_intro: this.activeAudioEvents.find(e => (e.type === 'music' || e.type === 'intro_music') && e.track_id)?.track_id || 'none',
        sfx_ambient: hasSfx ? (this.activeAudioEvents.find(e => e.type === 'sfx' && e.track_id)?.track_id || 'auto') : 'none',
        ducking_enabled: Boolean(this.activeAudioEvents.find(e => (e.type === 'fade_out' || e.type === 'outro'))) && (el.checkDucking ? el.checkDucking.checked : true),
        ducking_db: this.config?.ducking_db || -30.0,
        music_timing: el.selectMusicTiming?.value || 'intro_outro',
        music_intro_sec: 10.0
      };

      if (this.previewAudio && !this.previewAudio.paused) {
        this.previewAudio.pause();
        if (this.currentPreviewBtn) {
          this.currentPreviewBtn.classList.remove('active');
        }
      }

      const res = await API.call('audio_studio_synthesize', this.currentPodcast.id, script, activeEngine, customOptions);

      if (res && res.success && res.podcast) {
        if (this.synthesisAnimInterval) {
          clearInterval(this.synthesisAnimInterval);
          this.synthesisAnimInterval = null;
        }
        this.currentSynthesisPct = 100;
        this.targetSynthesisPct = 100;

        this.currentPodcast = res.podcast;
        this.renderScript();

        if (res.audio_url) {
          this.loadAudioInPlayer(res.audio_url);
        }

        if (el.progressPct) el.progressPct.textContent = '100%';
        if (el.progressBarFill) el.progressBarFill.style.width = '100%';
        if (el.progressMsg) el.progressMsg.textContent = 'Synthèse audio terminée avec succès !';

        setTimeout(() => {
          if (el.progressBox) el.progressBox.style.display = 'none';
        }, 2200);

        this.loadHistory();
        this.goToStep(3); // Aller automatiquement à l'étape 3 : Régie d'écoute & Karaoké !

        if (typeof NotificationManager !== 'undefined') {
          NotificationManager.notifyAICompletion({
            title: 'Épisode audio généré',
            snippet: `L'audio de « ${this.currentPodcast.title || 'Votre épisode'} » est prêt pour l'écoute ou le téléchargement.`,
            targetView: 'audio-studio',
            btnText: "Écouter l'épisode"
          });
        }
      } else {
        if (this.synthesisAnimInterval) {
          clearInterval(this.synthesisAnimInterval);
          this.synthesisAnimInterval = null;
        }
        this.resetStep2InputState();
        const errMsg = res?.error || 'Erreur lors de la synthèse vocale';
        this.showErrorToast(`Erreur de synthèse : ${errMsg}`);
        if (el.progressBox) el.progressBox.style.display = 'none';
      }
    } catch (err) {
      if (this.synthesisAnimInterval) {
        clearInterval(this.synthesisAnimInterval);
        this.synthesisAnimInterval = null;
      }
      this.resetStep2InputState();
      console.error('[AudioStudioView] Erreur startSynthesis:', err);
      this.showErrorToast(`Erreur de synthèse vocale : ${err.message || err}`);
      if (el.progressBox) el.progressBox.style.display = 'none';
    } finally {
      if (this.synthesisAnimInterval) {
        clearInterval(this.synthesisAnimInterval);
        this.synthesisAnimInterval = null;
      }
      this.isSynthesizing = false;
      if (typeof NotificationManager !== 'undefined') {
        NotificationManager.setWorkingState('audio-studio', false);
      }
    }
  },

  setupTaskManagerListener() {
    // Si TaskManager diffuse des notifications de progression
    if (typeof TaskManager !== 'undefined' && typeof TaskManager.addEventListener === 'function') {
      TaskManager.addEventListener('task_progress', (evt) => {
        const data = evt.detail || evt;
        if (data && data.task_id && data.task_id.startsWith('audio_synth_')) {
          const el = this.elements;
          if (el.progressBox) el.progressBox.style.display = 'flex';
          if (el.progressPct) el.progressPct.textContent = `${data.progress || 0}%`;
          if (el.progressBarFill) el.progressBarFill.style.width = `${data.progress || 0}%`;
          if (el.progressMsg) el.progressMsg.textContent = data.message || '';
        }
      });
    }
  },

  // =========================================================================
  // LECTEUR AUDIO HTML5 & SYNCHRONISATION KARAOKÉ
  // =========================================================================

  loadAudioInPlayer(audioUrl) {
    const el = this.elements;
    if (!el.html5Player || !audioUrl) return;

    el.html5Player.src = audioUrl;
    el.html5Player.load();
    if (el.playerStatus) el.playerStatus.textContent = 'Prêt à la lecture';
    if (el.btnDownload) el.btnDownload.disabled = false;
    if (el.btnExportNote) el.btnExportNote.disabled = false;
  },

  togglePlay() {
    const audio = this.elements.html5Player;
    if (!audio || !audio.src) {
      this.showErrorToast("Aucun fichier audio n'est chargé. Veuillez d'abord synthétiser le script.");
      return;
    }

    if (audio.paused) {
      audio.play().catch(err => {
        console.warn('[AudioStudioView] Erreur audio play:', err);
      });
    } else {
      audio.pause();
    }
  },

  updatePlayButtonState(isPlaying) {
    const el = this.elements;
    if (el.iconPlay && el.iconPause) {
      el.iconPlay.style.display = isPlaying ? 'none' : 'block';
      el.iconPause.style.display = isPlaying ? 'block' : 'none';
    }
    if (el.playerStatus) {
      el.playerStatus.textContent = isPlaying ? 'Lecture en cours' : 'En pause';
    }
  },

  cyclePlaybackSpeed() {
    this.currentRateIdx = (this.currentRateIdx + 1) % this.playbackRates.length;
    const rate = this.playbackRates[this.currentRateIdx];
    if (this.elements.html5Player) {
      this.elements.html5Player.playbackRate = rate;
    }
    if (this.elements.btnSpeed) {
      this.elements.btnSpeed.textContent = `${rate.toFixed(1)}x`;
    }
  },

  skipForward(seconds = 10) {
    const audio = this.elements.html5Player;
    if (audio && audio.duration) {
      audio.currentTime = Math.min(audio.duration, audio.currentTime + seconds);
    }
  },

  onAudioMetadataLoaded() {
    const audio = this.elements.html5Player;
    if (!audio) return;
    if (this.elements.timeDuration) {
      this.elements.timeDuration.textContent = this.formatTime(audio.duration);
    }
    if (this.elements.seekbar) {
      this.elements.seekbar.value = 0;
    }
  },

  onAudioEnded() {
    this.updatePlayButtonState(false);
    this.clearKaraokeHighlight();
    if (this.elements.seekbar) this.elements.seekbar.value = 0;
    if (this.elements.timeCurrent) this.elements.timeCurrent.textContent = '00:00';
  },

  onAudioTimeUpdate() {
    const audio = this.elements.html5Player;
    if (!audio || isNaN(audio.currentTime)) return;

    const current = audio.currentTime;
    const total = audio.duration || 1;

    // Mise à jour de la seekbar
    if (this.elements.seekbar) {
      this.elements.seekbar.value = ((current / total) * 100).toFixed(2);
    }
    if (this.elements.timeCurrent) {
      this.elements.timeCurrent.textContent = this.formatTime(current);
    }

    // Karaoké synchronisé : mettre en valeur la réplique correspondante
    this.highlightActiveTurn(current);
  },

  renderKaraokeView() {
    const p = this.currentPodcast;
    const el = this.elements;
    if (!p) return;

    if (el.karaokeEpisodeTitle) {
      el.karaokeEpisodeTitle.textContent = p.title || 'Script audio';
    }
    if (el.karaokeEpisodeSummary) {
      const modeLabels = {
        auto: 'Auto',
        exegesis: 'Exégèse',
        historical: 'Histoire',
        immersion: 'Immersion Narrative',
        narrative: 'Immersion Narrative',
        sermon: 'Prédication',
        theology: 'Théologie',
        lexical: 'Lexique'
      };
      const modeName = modeLabels[p.study_mode] || p.study_mode || 'Auto';
      const fmtName = p.format === 'dialogue' ? 'Dialogue (2 voix)' : 'Chronique Solo';
      const script = (Array.isArray(p.script_dialogue) && p.script_dialogue.length > 0)
        ? p.script_dialogue
        : (Array.isArray(p.dialogue) ? p.dialogue : []);
      el.karaokeEpisodeSummary.textContent = `${fmtName} • Mode ${modeName} • ${script.length} réplique${script.length > 1 ? 's' : ''}`;
    }

    if (!el.karaokeScriptFlow) return;
    el.karaokeScriptFlow.innerHTML = '';

    const script = (Array.isArray(p.script_dialogue) && p.script_dialogue.length > 0)
      ? p.script_dialogue
      : (Array.isArray(p.dialogue) ? p.dialogue : []);

    // Affichage conditionnel de la sous-barre [Texte littéraire] / [Script vocal TTS] en karaoké
    const hasDiff = this.hasScriptVocalDivergence(script);
    const karaokeModeBar = document.querySelector('.as-karaoke-text-mode-bar');
    if (karaokeModeBar) {
      karaokeModeBar.style.display = hasDiff ? 'flex' : 'none';
    }

    const audioEvents = this.getEpisodeAudioEvents(p);
    const introEvent = audioEvents.find(e => e.type === 'music' || e.type === 'intro_music');
    const sfxEvents = audioEvents.filter(e => e.type === 'sfx');
    const fadeEvent = audioEvents.find(e => e.type === 'fade_out' || e.type === 'fadeout');
    const outroEvent = audioEvents.find(e => e.type === 'outro' || e.type === 'outro_music');

    if (introEvent) {
      el.karaokeScriptFlow.appendChild(this.createAudioEventCard(introEvent, true));
    }
    sfxEvents.forEach(sfx => {
      el.karaokeScriptFlow.appendChild(this.createAudioEventCard(sfx, true));
    });

    script.forEach((turn, idx) => {
      const card = document.createElement('div');
      card.className = 'as-karaoke-card';
      card.dataset.turnIndex = idx;
      if (typeof turn.start_time === 'number') card.dataset.startTime = turn.start_time;
      if (typeof turn.end_time === 'number') card.dataset.endTime = turn.end_time;

      const speaker = turn.speaker || (idx % 2 === 0 ? 'Animateur' : 'Théologien');
      let roleColor = 'var(--accent-orange, #ea580c)';
      if (speaker.toLowerCase().includes('théologien') || speaker.toLowerCase().includes('exégète') || speaker.toLowerCase().includes('chercheur')) {
        roleColor = '#3b82f6';
      }

      const timeLabel = (typeof turn.start_time === 'number')
        ? `${this.formatTime(turn.start_time)} – ${this.formatTime(turn.end_time || turn.start_time)}`
        : `#${idx + 1}`;

      const isPhonetic = (this.textMode === 'phonetic');
      const cleanTurnText = this.cleanScriptText(turn.text || '');
      const textDisplay = isPhonetic ? this.getPhoneticSpeechText(turn) : cleanTurnText;

      card.innerHTML = `
        <div class="as-karaoke-speaker" style="color: ${roleColor};">
          ${this.escapeHtml(speaker)}
          <span style="font-weight: normal; opacity: 0.7; margin-left: 8px;">${timeLabel}</span>
        </div>
        <div class="as-karaoke-text">${this.escapeHtml(textDisplay)}</div>
      `;

      // Clic interactif pour sauter immédiatement à ce passage dans l'audio
      card.addEventListener('click', () => {
        if (typeof turn.start_time === 'number' && el.html5Player) {
          el.html5Player.currentTime = turn.start_time;
          if (el.html5Player.paused) {
            el.html5Player.play().catch(e => console.warn('[AudioStudioView] Erreur audio play:', e));
          }
        }
      });

      el.karaokeScriptFlow.appendChild(card);

      if (fadeEvent && idx === 0) {
        el.karaokeScriptFlow.appendChild(this.createAudioEventCard(fadeEvent, true));
      }
    });

    if (outroEvent) {
      el.karaokeScriptFlow.appendChild(this.createAudioEventCard(outroEvent, true));
    }
  },

  highlightActiveTurn(currentTime) {
    const scriptCards = this.elements.scriptList?.querySelectorAll('.audio-studio-turn-card') || [];
    const karaokeCards = this.elements.karaokeScriptFlow?.querySelectorAll('.as-karaoke-card') || [];
    let foundIdx = -1;

    const candidateCards = karaokeCards.length > 0 ? karaokeCards : scriptCards;
    candidateCards.forEach((card, idx) => {
      const start = parseFloat(card.dataset.startTime);
      const end = parseFloat(card.dataset.endTime);

      if (!isNaN(start) && !isNaN(end)) {
        if (currentTime >= start && currentTime <= end) {
          foundIdx = idx;
        }
      }
    });

    if (foundIdx !== this.activeKaraokeTurnIndex) {
      this.activeKaraokeTurnIndex = foundIdx;

      // Synchroniser les cartes de l'Étape 2 (Script)
      scriptCards.forEach((card, idx) => {
        if (idx === foundIdx) {
          card.classList.add('is-karaoke-active');
          if (this.currentStep === 2) card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
          card.classList.remove('is-karaoke-active');
        }
      });

      // Synchroniser les cartes de l'Étape 3 (Régie Karaoké)
      karaokeCards.forEach((card, idx) => {
        if (idx === foundIdx) {
          card.classList.add('active-karaoke');
          if (this.currentStep === 3) card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
          card.classList.remove('active-karaoke');
        }
      });
    }

    // Mise en valeur synchronisée des repères d'événements sonores (intro, fadeout, outro)
    const eventCards = (this.currentStep === 3)
      ? (this.elements.karaokeScriptFlow?.querySelectorAll('.as-timeline-event-card') || [])
      : (this.elements.scriptList?.querySelectorAll('.as-timeline-event-card') || []);

    eventCards.forEach(ec => {
      const start = parseFloat(ec.dataset.startTime);
      const end = parseFloat(ec.dataset.endTime);
      if (!isNaN(start) && !isNaN(end)) {
        const isActive = (currentTime >= start && currentTime <= end);
        ec.classList.toggle('active-karaoke', isActive);
      }
    });
  },

  clearKaraokeHighlight() {
    this.activeKaraokeTurnIndex = -1;
    const scriptCards = this.elements.scriptList?.querySelectorAll('.audio-studio-turn-card') || [];
    scriptCards.forEach(c => c.classList.remove('is-karaoke-active'));
    const karaokeCards = this.elements.karaokeScriptFlow?.querySelectorAll('.as-karaoke-card') || [];
    karaokeCards.forEach(c => c.classList.remove('active-karaoke'));
    const eventCards = document.querySelectorAll('.as-timeline-event-card');
    eventCards.forEach(c => c.classList.remove('active-karaoke'));
  },

  formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  },

  // =========================================================================
  // TÉLÉCHARGEMENT & EXPORT EN NOTE
  // =========================================================================

  downloadMp3() {
    const p = this.currentPodcast;
    if (!p) return;

    const dataUrl = p.audio_data_url;
    if (!dataUrl) {
      this.showErrorToast("L'audio n'est pas encore disponible pour le téléchargement.");
      return;
    }

    const cleanTitle = (p.title || 'episode_podcast')
      .replace(/[^a-zA-Z0-9_\u00C0-\u017F\s-]/g, '')
      .replace(/\s+/g, '_');

    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `${cleanTitle}.mp3`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  async exportToNote() {
    const p = this.currentPodcast;
    if (!p || !p.id) return;

    try {
      const res = await API.call('audio_studio_export_to_note', { podcast_id: p.id });
      if (res && res.success) {
        this.showSuccessToast(`L'épisode a été exporté dans vos notes : « ${res.note_title || p.title} »`);
      } else {
        this.showErrorToast(`Erreur lors de l'export en note : ${res?.error || 'Erreur inconnue'}`);
      }
    } catch (err) {
      console.error('[AudioStudioView] Erreur exportToNote:', err);
      this.showErrorToast(`Erreur technique lors de l'export : ${err.message || err}`);
    }
  },

  // =========================================================================
  // HISTORIQUE DES ÉPISODES
  // =========================================================================

  async loadHistory() {
    const el = this.elements;
    if (!el.historyList) return;

    try {
      const res = await API.call('audio_studio_get_history');
      const items = (res && Array.isArray(res.items)) ? res.items : [];

      if (el.historyCounterBadge) {
        el.historyCounterBadge.textContent = items.length;
      }

      if (items.length === 0) {
        el.historyList.innerHTML = `
          <div style="padding: 16px; text-align: center; font-size: 12px; color: var(--text-muted);">
            Aucun épisode enregistré
          </div>
        `;
        return;
      }

      el.historyList.innerHTML = '';
      items.forEach(it => {
        const itemEl = document.createElement('div');
        itemEl.className = 'audio-studio-history-item';
        if (this.currentPodcast && this.currentPodcast.id === it.id) {
          itemEl.classList.add('active');
        }

        const dateStr = it.created_at ? new Date(it.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
        const durStr = (it.duration_seconds && it.duration_seconds > 0) ? this.formatTime(it.duration_seconds) : `${it.turns_count || 0} répliques`;
        const hasAudio = Boolean(it.audio_file || it.audio_data_url);

        itemEl.innerHTML = `
          <div class="audio-studio-history-item-content" style="flex: 1; min-width: 0; cursor: pointer;">
            <div class="audio-studio-history-title" style="font-size: 12.5px; font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              ${this.escapeHtml(it.title || 'Épisode sans titre')}
            </div>
            <div class="audio-studio-history-meta" style="font-size: 11px; color: var(--text-muted); display: flex; align-items: center; gap: 8px; margin-top: 3px;">
              <span>${dateStr}</span>
              <span>&bull;</span>
              <span>${durStr}</span>
              ${hasAudio ? '<span class="audio-studio-source-pill" style="font-size: 9.5px; padding: 1px 5px;">MP3</span>' : ''}
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 4px;">
            <button type="button" class="btn-icon btn-sm btn-load-episode" title="Charger l'épisode" style="background: transparent; border: none; color: var(--text-secondary); cursor: pointer; padding: 4px;">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
            </button>
            <button type="button" class="btn-icon btn-sm btn-delete-episode" title="Supprimer cet épisode" style="background: transparent; border: none; color: var(--text-muted); cursor: pointer; padding: 4px;">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
        `;

        // Événement chargement
        itemEl.querySelector('.audio-studio-history-item-content')?.addEventListener('click', () => {
          this.loadEpisode(it.id);
        });
        itemEl.querySelector('.btn-load-episode')?.addEventListener('click', (e) => {
          e.stopPropagation();
          this.loadEpisode(it.id);
        });

        // Événement suppression (non-bloquant, sans confirm)
        itemEl.querySelector('.btn-delete-episode')?.addEventListener('click', (e) => {
          e.stopPropagation();
          this.deleteEpisode(it.id);
        });

        el.historyList.appendChild(itemEl);
      });
    } catch (err) {
      console.warn('[AudioStudioView] Erreur loadHistory:', err);
    }
  },

  async loadEpisode(podcastId) {
    try {
      const res = await API.call('audio_studio_get_podcast', { podcast_id: podcastId });
      if (res && res.success && res.podcast) {
        this.currentPodcast = res.podcast;
        this.setFormat(res.podcast.format || 'dialogue');
        if (res.podcast.study_mode) {
          this.setStudyMode(res.podcast.study_mode);
        }
        if (Array.isArray(res.podcast.audio_events) && res.podcast.audio_events.length > 0) {
          this.activeAudioEvents = [...res.podcast.audio_events];
        } else {
          this.activeAudioEvents = [];
        }
        const hasMusic = this.activeAudioEvents.some(e => e.type === 'music' || e.type === 'intro_music' || e.type === 'fade_out' || e.type === 'outro' || e.type === 'outro_music');
        const hasSfx = this.activeAudioEvents.some(e => e.type === 'sfx');
        if (this.elements.checkMusicJingle) this.elements.checkMusicJingle.checked = hasMusic;
        if (this.elements.checkSfxAuto) this.elements.checkSfxAuto.checked = hasSfx;
        this.renderScript();
        this.loadHistory();
        this.toggleHistoryDrawer(false);

        // Si l'audio existe, aller directement à l'étape 3, sinon aller à l'étape 2
        if (res.podcast.audio_file || res.podcast.audio_data_url) {
          this.goToStep(3);
        } else {
          this.goToStep(2);
        }
      }
    } catch (err) {
      console.error('[AudioStudioView] Erreur loadEpisode:', err);
      this.showErrorToast(`Erreur lors du chargement : ${err.message || err}`);
    }
  },

  async deleteEpisode(podcastId) {
    try {
      const res = await API.call('audio_studio_delete_podcast', { podcast_id: podcastId });
      if (res && res.success) {
        if (this.currentPodcast && this.currentPodcast.id === podcastId) {
          this.clearScript();
          this.goToStep(1);
        }
        this.loadHistory();
        this.showSuccessToast('Épisode supprimé de l\'historique.');
      }
    } catch (err) {
      console.error('[AudioStudioView] Erreur deleteEpisode:', err);
      this.showErrorToast(`Erreur lors de la suppression : ${err.message || err}`);
    }
  },

  // =========================================================================
  // UTILITAIRES
  // =========================================================================

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
};

// Exposition globale
window.AudioStudioView = AudioStudioView;
