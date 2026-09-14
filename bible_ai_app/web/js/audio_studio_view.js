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
      btnNavToStep1: document.getElementById('btn-as-nav-to-step1'),
      btnNavToStep3: document.getElementById('btn-as-nav-to-step3'),

      // Synthèse & Voix
      engineBadge: document.getElementById('audio-studio-engine-badge'),
      engineBtnEdge: document.getElementById('as-engine-btn-edge'),
      engineBtnVoxtral: document.getElementById('as-engine-btn-voxtral'),
      voicesEdgeContainer: document.getElementById('as-voices-edge-container'),
      voicesVoxtralContainer: document.getElementById('as-voices-voxtral-container'),
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
      selectBgMusic: document.getElementById('as-select-bg-music'),
      btnPreviewBgMusic: document.getElementById('btn-as-preview-bg-music'),
      selectJingleIntro: document.getElementById('as-select-jingle-intro'),
      btnPreviewJingleIntro: document.getElementById('btn-as-preview-jingle-intro'),
      checkDucking: document.getElementById('as-check-ducking'),
      btnSynthesize: document.getElementById('btn-audio-studio-synthesize'),
      progressBox: document.getElementById('audio-studio-progress-box'),
      progressTitle: document.getElementById('audio-studio-progress-title'),
      progressPct: document.getElementById('audio-studio-progress-pct'),
      progressBarFill: document.getElementById('audio-studio-progress-bar-fill'),
      progressMsg: document.getElementById('audio-studio-progress-msg'),

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

    // 1b. Sélecteur de moteur audio interactif (Edge-TTS vs Voxtral)
    el.engineBtnEdge?.addEventListener('click', () => this.setEngine('edge_tts'));
    el.engineBtnVoxtral?.addEventListener('click', () => this.setEngine('voxtral'));

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

    // 9. Synthèse audio & Habillage sonore (Soundpack)
    el.btnSynthesize?.addEventListener('click', () => this.startSynthesis());

    el.btnPreviewBgMusic?.addEventListener('click', () => {
      const trId = el.selectBgMusic?.value;
      this.previewTrack(trId, el.btnPreviewBgMusic);
    });

    el.btnPreviewJingleIntro?.addEventListener('click', () => {
      const trId = el.selectJingleIntro?.value;
      this.previewTrack(trId, el.btnPreviewJingleIntro);
    });

    el.selectBgMusic?.addEventListener('change', () => {
      if (this.previewAudio && !this.previewAudio.paused && this.currentPreviewBtn === el.btnPreviewBgMusic) {
        this.previewAudio.pause();
        el.btnPreviewBgMusic.classList.remove('active');
      }
    });

    el.selectJingleIntro?.addEventListener('change', () => {
      if (this.previewAudio && !this.previewAudio.paused && this.currentPreviewBtn === el.btnPreviewJingleIntro) {
        this.previewAudio.pause();
        el.btnPreviewJingleIntro.classList.remove('active');
      }
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
    const isVoxtral = (this.config?.engine === 'voxtral');

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
        el.voiceDuplicateAlert.style.display = (!isVoxtral && el.selectVoiceHost?.value === el.selectVoiceScholar?.value) ? 'block' : 'none';
      }
      this.syncVoicePair(false, 'host');

      // Voxtral
      if (el.voxtralDialogueVoices) el.voxtralDialogueVoices.style.display = 'flex';
      if (el.voxtralSoloVoices) el.voxtralSoloVoices.style.display = 'none';
      if (el.voxtralDuplicateAlert) {
        el.voxtralDuplicateAlert.style.display = (isVoxtral && el.selectVoxtralHost?.value === el.selectVoxtralScholar?.value) ? 'block' : 'none';
      }
      this.syncVoxtralVoicePair(false, 'host');
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

      // Voxtral
      if (el.voxtralDialogueVoices) el.voxtralDialogueVoices.style.display = 'none';
      if (el.voxtralSoloVoices) el.voxtralSoloVoices.style.display = 'flex';
      if (el.voxtralDuplicateAlert) el.voxtralDuplicateAlert.style.display = 'none';
    }
    this.updateVoiceSummary();
    this.updateTurnCardsVoiceLabels();
  },

  setEngine(engine, shouldSave = true) {
    if (!this.config) this.config = {};
    this.config.engine = engine;
    const el = this.elements;

    if (engine === 'voxtral') {
      el.engineBtnVoxtral?.classList.add('active');
      el.engineBtnEdge?.classList.remove('active');
      if (el.voicesVoxtralContainer) el.voicesVoxtralContainer.style.display = 'flex';
      if (el.voicesEdgeContainer) el.voicesEdgeContainer.style.display = 'none';
      if (el.engineBadge) el.engineBadge.textContent = 'Mistral Voxtral';
      if (el.voxtralWarning) {
        el.voxtralWarning.style.display = this.config.has_mistral_key ? 'none' : 'block';
      }
      this.syncVoxtralVoicePair(false, 'host');
    } else {
      el.engineBtnEdge?.classList.add('active');
      el.engineBtnVoxtral?.classList.remove('active');
      if (el.voicesEdgeContainer) el.voicesEdgeContainer.style.display = 'flex';
      if (el.voicesVoxtralContainer) el.voicesVoxtralContainer.style.display = 'none';
      if (el.engineBadge) el.engineBadge.textContent = 'Edge-TTS (Gratuit)';
      if (el.voxtralWarning) el.voxtralWarning.style.display = 'none';
      this.syncVoicePair(false, 'host');
    }

    // Ré-appliquer le format actuel (dialogue vs solo) sur les nouveaux conteneurs
    if (this.format === 'solo') {
      if (el.edgeDialogueVoices) el.edgeDialogueVoices.style.display = 'none';
      if (el.edgeSoloVoices) el.edgeSoloVoices.style.display = 'flex';
      if (el.voxtralDialogueVoices) el.voxtralDialogueVoices.style.display = 'none';
      if (el.voxtralSoloVoices) el.voxtralSoloVoices.style.display = 'flex';
    } else {
      if (el.edgeDialogueVoices) el.edgeDialogueVoices.style.display = 'flex';
      if (el.edgeSoloVoices) el.edgeSoloVoices.style.display = 'none';
      if (el.voxtralDialogueVoices) el.voxtralDialogueVoices.style.display = 'flex';
      if (el.voxtralSoloVoices) el.voxtralSoloVoices.style.display = 'none';
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

        if (el.selectBgMusic && res.bg_music) {
          el.selectBgMusic.value = res.bg_music;
        }
        if (el.selectJingleIntro && res.jingle_intro) {
          el.selectJingleIntro.value = res.jingle_intro;
        }
        if (el.checkDucking && typeof res.ducking_enabled !== 'undefined') {
          el.checkDucking.checked = res.ducking_enabled !== false;
        }

        // Mise à jour de l'affichage du format actuel
        this.setFormat(this.format);
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
        const cur = this.config?.voice_speaker_a || el.selectVoiceHost.value || 'fr-FR-DeniseNeural';
        el.selectVoiceHost.innerHTML = optHtml;
        el.selectVoiceHost.value = cur;
      }

      if (el.selectVoiceScholar) {
        const cur = this.config?.voice_speaker_b || el.selectVoiceScholar.value || 'fr-FR-HenriNeural';
        el.selectVoiceScholar.innerHTML = optHtml;
        el.selectVoiceScholar.value = cur;
      }

      if (el.selectVoiceSolo) {
        const cur = this.config?.voice_solo || el.selectVoiceSolo.value || 'fr-FR-HenriNeural';
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

    this.updateVoiceSummary();
    this.updateTurnCardsVoiceLabels();
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

    this.updateVoiceSummary();
    this.updateTurnCardsVoiceLabels();
  },

  getSmartAlternateVoice(currentVoiceId, targetRole = 'scholar') {
    const defaultHost = 'fr-FR-DeniseNeural';
    const defaultScholar = 'fr-FR-HenriNeural';

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
      hostName = this.getVoiceShortName(el.selectVoiceHost?.value || this.config?.voice_speaker_a || 'fr-FR-DeniseNeural');
      scholarName = this.getVoiceShortName(el.selectVoiceScholar?.value || this.config?.voice_speaker_b || 'fr-FR-HenriNeural');
      soloName = this.getVoiceShortName(el.selectVoiceSolo?.value || this.config?.voice_solo || 'fr-FR-HenriNeural');
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
      const spkA = el.selectVoiceHost?.value || this.config?.voice_speaker_a || 'fr-FR-DeniseNeural';
      const spkB = el.selectVoiceScholar?.value || this.config?.voice_speaker_b || 'fr-FR-HenriNeural';
      const solo = el.selectVoiceSolo?.value || this.config?.voice_solo || 'fr-FR-HenriNeural';

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

    if (el.selectBgMusic) {
      let html = '<option value="bed_cozy_jazz_study">Étude &amp; Méditation (Nappe Jazz Douce — Recommandé)</option>';
      musicTracks.forEach(t => {
        if (t.id !== 'bed_cozy_jazz_study') {
          const tName = t.name || t.title || t.id;
          const tDur = formatDur(t.duration || t.duration_sec);
          html += `<option value="${t.id}">${this.escapeHtml(tName)} (${tDur})</option>`;
        }
      });
      const otherThemes = [...jingleTracks, ...stingerTracks];
      if (otherThemes.length > 0) {
        html += '<optgroup label="Thèmes courts &amp; interludes">';
        otherThemes.forEach(t => {
          const tName = t.name || t.title || t.id;
          const tDur = formatDur(t.duration || t.duration_sec);
          html += `<option value="${t.id}">${this.escapeHtml(tName)} (${tDur})</option>`;
        });
        html += '</optgroup>';
      }
      html += '<option value="none">Aucune musique (Voix pure)</option>';
      el.selectBgMusic.innerHTML = html;

      const curMusic = this.config?.bg_music || 'bed_cozy_jazz_study';
      if (el.selectBgMusic.querySelector(`option[value="${curMusic}"]`)) {
        el.selectBgMusic.value = curMusic;
      }
    }

    if (el.selectJingleIntro) {
      let html = '<option value="jingle_piano_solemn">Piano Recueilli (Intro Solennelle — Recommandé)</option>';
      const allIntros = [...jingleTracks, ...stingerTracks];
      allIntros.forEach(t => {
        if (t.id !== 'jingle_piano_solemn') {
          const tName = t.name || t.title || t.id;
          const tDur = formatDur(t.duration || t.duration_sec);
          html += `<option value="${t.id}">${this.escapeHtml(tName)} (${tDur})</option>`;
        }
      });
      html += '<option value="none">Aucun jingle (Démarrage direct)</option>';
      el.selectJingleIntro.innerHTML = html;

      const curJingle = this.config?.jingle_intro || 'jingle_piano_solemn';
      if (el.selectJingleIntro.querySelector(`option[value="${curJingle}"]`)) {
        el.selectJingleIntro.value = curJingle;
      }
    }
  },

  async previewTrack(trackId, btnEl) {
    if (!trackId || trackId === 'none') {
      this.showInfoToast("Sélectionnez d'abord un morceau pour l'écouter.");
      return;
    }

    if (this.previewAudio && !this.previewAudio.paused) {
      this.previewAudio.pause();
      this.previewAudio.currentTime = 0;
      if (this.currentPreviewBtn) {
        this.currentPreviewBtn.classList.remove('active');
        this.currentPreviewBtn.title = 'Écouter un extrait';
      }
      if (this.currentPreviewTrackId === trackId) {
        this.currentPreviewTrackId = null;
        this.currentPreviewBtn = null;
        return;
      }
    }

    try {
      if (btnEl) btnEl.classList.add('loading');
      const res = await API.call('audio_studio_get_soundpack_track_url', trackId);
      if (btnEl) btnEl.classList.remove('loading');

      if (res && res.success && res.audio_url) {
        if (!this.previewAudio) {
          this.previewAudio = new Audio();
        }
        this.previewAudio.src = res.audio_url;
        this.previewAudio.volume = 0.55;
        this.previewAudio.play();
        this.currentPreviewTrackId = trackId;
        this.currentPreviewBtn = btnEl;
        if (btnEl) {
          btnEl.classList.add('active');
          btnEl.title = 'Arrêter la préécoute';
        }
        this.previewAudio.onended = () => {
          if (btnEl) {
            btnEl.classList.remove('active');
            btnEl.title = 'Écouter un extrait';
          }
          this.currentPreviewTrackId = null;
          this.currentPreviewBtn = null;
        };
      } else {
        this.showErrorToast("Impossible de charger l'extrait audio.");
      }
    } catch (err) {
      if (btnEl) btnEl.classList.remove('loading');
      console.warn('[AudioStudioView] Erreur préécoute track:', err);
    }
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

    if (step !== 1 && el.step1ReasoningBox) {
      el.step1ReasoningBox.style.display = 'none';
    }

    // Ajustements d'étape
    if (step === 2) {
      if (el.btnNavToStep3) {
        el.btnNavToStep3.style.display = (this.currentPodcast?.audio_file || this.currentPodcast?.audio_data_url) ? 'inline-flex' : 'none';
      }
    } else if (step === 3) {
      this.renderKaraokeView();
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

    const labels = {
      auto: 'Auto',
      exegesis: 'Exégèse',
      historical: 'Histoire',
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
            <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"></path>
          </svg>
          <span>Rédiger le script (Étape 2)</span>
        `;
      }
      if (typeof NotificationManager !== 'undefined') {
        NotificationManager.setWorkingState('audio-studio', false);
      }
    }
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
    if (el.addTurnContainer) el.addTurnContainer.style.display = 'block';

    if (el.scriptList) {
      el.scriptList.innerHTML = '';
      script.forEach((turn, idx) => {
        const card = this.createTurnCard(turn, idx);
        el.scriptList.appendChild(card);
      });
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
          <button type="button" class="btn-icon btn-sm btn-delete-turn" title="Supprimer cette réplique" style="background: transparent; border: none; color: var(--text-muted); cursor: pointer;">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      </div>
      <textarea class="audio-studio-turn-textarea" placeholder="Texte de la réplique...">${this.escapeHtml(turn.text || '')}</textarea>
    `;

    // Événement auto-resize & synchronisation
    const textarea = card.querySelector('.audio-studio-turn-textarea');
    if (textarea) {
      this.autoResizeTextarea(textarea);
      textarea.addEventListener('input', () => {
        this.autoResizeTextarea(textarea);
        if (this.currentPodcast?.script_dialogue?.[idx]) {
          this.currentPodcast.script_dialogue[idx].text = textarea.value;
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

    // Événement suppression
    const btnDelete = card.querySelector('.btn-delete-turn');
    btnDelete?.addEventListener('click', () => {
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
      pause_after_ms: 350
    });

    this.renderScript();

    // Focus sur la nouvelle réplique
    setTimeout(() => {
      const cards = this.elements.scriptList?.querySelectorAll('.audio-studio-turn-card');
      if (cards && cards.length > 0) {
        const lastCard = cards[cards.length - 1];
        lastCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const ta = lastCard.querySelector('textarea');
        ta?.focus();
      }
    }, 50);
  },

  deleteTurn(idx) {
    if (this.currentPodcast?.script_dialogue?.[idx]) {
      this.currentPodcast.script_dialogue.splice(idx, 1);
      this.renderScript();
    }
  },

  clearScript() {
    this.currentPodcast = null;
    const el = this.elements;
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

    // Contrôle et ajustement automatique en cas de doublon en mode dialogue
    if (this.format === 'dialogue') {
      if (isVoxtral) {
        const v1 = el.selectVoxtralHost?.value;
        const v2 = el.selectVoxtralScholar?.value;
        if (v1 && v2 && v1 === v2) {
          this.syncVoxtralVoicePair(true, 'host', true);
        }
      } else {
        const v1 = el.selectVoiceHost?.value;
        const v2 = el.selectVoiceScholar?.value;
        if (v1 && v2 && v1 === v2) {
          this.syncVoicePair(true, 'host', true);
        }
      }
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
      const activeEngine = isVoxtral ? 'voxtral' : 'edge_tts';
      let spkA, spkB, spkSolo;
      if (isVoxtral) {
        spkA = el.selectVoxtralHost?.value || this.config?.voxtral_voice_speaker_a || 'Marie - Happy';
        spkB = el.selectVoxtralScholar?.value || this.config?.voxtral_voice_speaker_b || 'Marie - Neutral';
        spkSolo = el.selectVoxtralSolo?.value || this.config?.voxtral_voice_solo || 'Marie - Neutral';
      } else {
        spkA = el.selectVoiceHost?.value || this.config?.voice_speaker_a || 'fr-FR-DeniseNeural';
        spkB = el.selectVoiceScholar?.value || this.config?.voice_speaker_b || 'fr-FR-HenriNeural';
        spkSolo = el.selectVoiceSolo?.value || this.config?.voice_solo || 'fr-FR-HenriNeural';
      }

      const customOptions = {
        format_type: this.format,
        format: this.format,
        engine: activeEngine,
        voice_speaker_a: spkA,
        voice_speaker_b: spkB,
        voice_solo: spkSolo,
        voxtral_voice_speaker_a: el.selectVoxtralHost?.value || this.config?.voxtral_voice_speaker_a || 'Marie - Happy',
        voxtral_voice_speaker_b: el.selectVoxtralScholar?.value || this.config?.voxtral_voice_speaker_b || 'Marie - Neutral',
        voxtral_voice_solo: el.selectVoxtralSolo?.value || this.config?.voxtral_voice_solo || 'Marie - Neutral',
        voxtral_modulate: el.checkVoxtralModulate ? el.checkVoxtralModulate.checked : true,
        pause_ms: parseInt(el.inputPauseMs?.value, 10) || 350,
        mastering_enabled: el.checkMastering ? el.checkMastering.checked : true,
        calm_prosody: el.checkCalmProsody ? el.checkCalmProsody.checked : true,
        rate: el.checkCalmProsody?.checked ? '-6%' : '+0%',
        pitch: el.checkCalmProsody?.checked ? '-3Hz' : '+0Hz',
        inject_breaks: el.checkCalmProsody ? el.checkCalmProsody.checked : true,
        bg_music: el.selectBgMusic ? el.selectBgMusic.value : (this.config?.bg_music || 'bed_cozy_jazz_study'),
        jingle_intro: el.selectJingleIntro ? el.selectJingleIntro.value : (this.config?.jingle_intro || 'jingle_piano_solemn'),
        ducking_enabled: el.checkDucking ? el.checkDucking.checked : true,
        ducking_db: this.config?.ducking_db || -16.0
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
        const errMsg = res?.error || 'Erreur lors de la synthèse vocale';
        this.showErrorToast(`Erreur de synthèse : ${errMsg}`);
        if (el.progressBox) el.progressBox.style.display = 'none';
      }
    } catch (err) {
      if (this.synthesisAnimInterval) {
        clearInterval(this.synthesisAnimInterval);
        this.synthesisAnimInterval = null;
      }
      console.error('[AudioStudioView] Erreur startSynthesis:', err);
      this.showErrorToast(`Erreur de synthèse vocale : ${err.message || err}`);
      if (el.progressBox) el.progressBox.style.display = 'none';
    } finally {
      if (this.synthesisAnimInterval) {
        clearInterval(this.synthesisAnimInterval);
        this.synthesisAnimInterval = null;
      }
      this.isSynthesizing = false;
      if (el.btnSynthesize) {
        el.btnSynthesize.disabled = false;
        el.btnSynthesize.innerHTML = `
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
          <span>Générer l'audio MP3</span>
        `;
      }
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

      card.innerHTML = `
        <div class="as-karaoke-speaker" style="color: ${roleColor};">
          ${this.escapeHtml(speaker)}
          <span style="font-weight: normal; opacity: 0.7; margin-left: 8px;">${timeLabel}</span>
        </div>
        <div class="as-karaoke-text">${this.escapeHtml(turn.text || '')}</div>
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
    });
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
  },

  clearKaraokeHighlight() {
    this.activeKaraokeTurnIndex = -1;
    const scriptCards = this.elements.scriptList?.querySelectorAll('.audio-studio-turn-card') || [];
    scriptCards.forEach(c => c.classList.remove('is-karaoke-active'));
    const karaokeCards = this.elements.karaokeScriptFlow?.querySelectorAll('.as-karaoke-card') || [];
    karaokeCards.forEach(c => c.classList.remove('active-karaoke'));
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
