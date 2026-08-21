/**
 * AI Study View Controller — Open Shema (שְׁמַع)
 * Gère l'assistant d'étude biblique et théologique :
 * - Mode Automatique intelligent (Auto) et modes spécialisés (Exégèse, Histoire, Prédication, Lexique)
 * - Sélecteur visuel BookPicker (Passage 100% optionnel & déconnectable)
 * - Suggestions dynamiques rayonnantes (SmoothUI ai-suggestions)
 * - Écran de réflexion animé avec étapes séquentielles & chronomètre (SmoothUI ai-reasoning / ai-loader)
 * - Parseur Markdown complet avec tableaux stylisés, citations et code
 * - Badges de citations in-text cliquables dans chaque paragraphe
 * - Présentation interactive des sources avec pile d'icônes (SmoothUI ai-sources)
 * - Bouton copier animé (SmoothUI button-copy) & Export 1-clic vers les Notes (.md)
 */

const AIStudyView = {
  chatFlowEl: null,
  inputEl: null,
  btnSendEl: null,
  suggestionsBarEl: null,
  btnPassagePickerEl: null,
  passageLabelEl: null,
  btnClearPassageEl: null,
  btnSyncBibleEl: null,

  // État du passage d'étude (null = recherche générale / théologique)
  currentBookCode: null,
  currentChapter: null,
  currentVerse: null,

  // Mode actif (auto par défaut)
  currentMode: 'auto',

  MODES_INFO: {
    auto: {
      icon: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/></svg>',
      title: 'Détection Automatique',
      shortTitle: 'Auto',
      sourcesSummary: 'Bibles, Dictionnaires, Commentaires, Théologie, Notes',
      desc: "L'IA identifie l'intention doctrinale, exégétique, historique ou pastorale et mobilise les corpus les plus pertinents.",
      placeholder: "Posez votre question (ex: Vision de Calvin sur la prédestination, Exégèse de Rom 8, Sens du terme hébreu...)"
    },
    exegesis: {
      icon: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
      title: 'Exégèse approfondie',
      shortTitle: 'Exégèse',
      sourcesSummary: 'Bibles originales, Multi-traductions, Commentaires majeurs, Notes',
      desc: 'Analyse structurelle et théologique verset par verset, chiasmes, syntaxe et cohérence canonique.',
      placeholder: "Ex: Analyse la structure de ce passage, les articulations syntaxiques et la portée théologique..."
    },
    historical: {
      icon: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="2" y1="20" x2="22" y2="20"></line><line x1="6" y1="20" x2="6" y2="4"></line><line x1="18" y1="20" x2="18" y2="4"></line><line x1="2" y1="4" x2="22" y2="4"></line><line x1="10" y1="20" x2="10" y2="4"></line><line x1="14" y1="20" x2="14" y2="4"></line></svg>',
      title: 'Contexte historique & culturel',
      shortTitle: 'Histoire & Contexte',
      sourcesSummary: 'Dictionnaires bibliques (Dom Calmet, Vigouroux...), Archéologie, Notes',
      desc: 'Arrière-plan historique, auteur, destinataires, cadre socio-politique antique et géographie.',
      placeholder: "Ex: Quel est le contexte politique, culturel et historique de la rédaction de ce texte ?"
    },
    sermon: {
      icon: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>',
      title: 'Préparation de prédication / Message',
      shortTitle: 'Prédication',
      sourcesSummary: 'Commentaires pastoraux, Trésor de l\'Écriture (TSK), Illustrations, Notes',
      desc: 'Plan homilétique complet avec idée maîtresse (Big Idea), 3 points de développement et applications concrètes.',
      placeholder: "Ex: Propose un plan de prédication percutant en 3 points avec illustrations et applications pour l'Église..."
    },
    lexical: {
      icon: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/></svg>',
      title: 'Analyse lexicale (Grec & Hébreu)',
      shortTitle: 'Lexique Hébreu/Grec',
      sourcesSummary: 'Lexique Strong Hébreu/Grec, Dictionnaires de racines (Bailly, Gesenius), LXX',
      desc: 'Étude des racines hébraïques/grecques, codes Strong, nuances morphologiques et sens dans la Septante (LXX).',
      placeholder: "Ex: Analyse les termes clés en hébreu/grec dans ce verset, leurs racines et leurs nuances théologiques..."
    }
  },

  init() {
    this.chatFlowEl = document.getElementById('ai-study-chat-flow');
    this.inputEl = document.getElementById('ai-study-input');
    this.btnSendEl = document.getElementById('btn-send-study-ai');
    this.suggestionsBarEl = document.getElementById('ai-suggestions-bar');
    this.btnPassagePickerEl = document.getElementById('btn-ai-passage-picker');
    this.passageLabelEl = document.getElementById('ai-passage-pill-label');
    this.btnClearPassageEl = document.getElementById('btn-ai-clear-passage');
    this.btnSyncBibleEl = document.getElementById('btn-ai-sync-bible');

    const btnModeSelector = document.getElementById('btn-study-mode-selector');
    const modePopover = document.getElementById('ai-mode-dropdown-popover');
    const btnCloseModePopover = document.getElementById('btn-close-mode-popover');

    const btnToggleOptions = document.getElementById('btn-toggle-ai-options');
    const btnPopoverOptions = document.getElementById('btn-popover-open-options');
    const optionsPanel = document.getElementById('ai-study-options-panel');
    const btnCloseOptions = document.getElementById('btn-close-ai-options');

    // 1. Menu déroulant des modes en haut
    btnModeSelector?.addEventListener('click', (e) => {
      e.stopPropagation();
      modePopover?.classList.toggle('hidden');
      optionsPanel?.classList.add('hidden');
    });

    btnCloseModePopover?.addEventListener('click', () => {
      modePopover?.classList.add('hidden');
    });

    // Sélection d'un mode depuis le popover unifié
    document.querySelectorAll('.study-mode-card').forEach(card => {
      card.addEventListener('click', () => {
        const mode = card.getAttribute('data-mode');
        if (mode) this.setMode(mode);
      });
    });

    // 2. Panneau des options RAG
    btnToggleOptions?.addEventListener('click', (e) => {
      e.stopPropagation();
      optionsPanel?.classList.toggle('hidden');
      modePopover?.classList.add('hidden');
    });

    btnPopoverOptions?.addEventListener('click', (e) => {
      e.stopPropagation();
      modePopover?.classList.add('hidden');
      optionsPanel?.classList.remove('hidden');
    });

    btnCloseOptions?.addEventListener('click', () => {
      optionsPanel?.classList.add('hidden');
    });

    // Clic extérieur pour fermer les popovers
    document.addEventListener('click', (e) => {
      if (modePopover && !modePopover.contains(e.target) && e.target !== btnModeSelector) {
        modePopover.classList.add('hidden');
      }
      if (optionsPanel && !optionsPanel.contains(e.target) && e.target !== btnToggleOptions && e.target !== btnPopoverOptions) {
        optionsPanel.classList.add('hidden');
      }
    });

    // 3. Sélecteur de passage & BookPicker
    this.btnPassagePickerEl?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openPassagePicker();
    });

    this.btnClearPassageEl?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.clearPassage();
    });

    this.btnSyncBibleEl?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.syncFromBibleReader();
    });

    // 4. Auto-expansion du champ textarea
    this.inputEl?.addEventListener('input', () => {
      this.autoResizeTextarea();
    });

    // 5. Envoi du message
    this.btnSendEl?.addEventListener('click', () => this.sendMessage());
    this.inputEl?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // Initialisation du mode par défaut (auto)
    this.setMode('auto');
    this.updatePassageDisplay();
    this.renderSuggestions();
  },

  autoResizeTextarea() {
    if (!this.inputEl) return;
    this.inputEl.style.height = 'auto';
    const maxHeight = 160;
    const newHeight = Math.min(this.inputEl.scrollHeight, maxHeight);
    this.inputEl.style.height = `${Math.max(38, newHeight)}px`;
  },

  setMode(modeKey) {
    if (!this.MODES_INFO[modeKey]) modeKey = 'auto';
    this.currentMode = modeKey;
    const info = this.MODES_INFO[modeKey];

    // Mise à jour de l'affichage du bouton pill d'en-tête
    const pillIcon = document.getElementById('study-mode-pill-icon');
    const pillLabel = document.getElementById('study-mode-pill-label');
    if (pillIcon) pillIcon.innerHTML = info.icon;
    if (pillLabel) pillLabel.textContent = info.title;

    // Mise à jour du sous-titre de l'en-tête
    const subtitleEl = document.getElementById('ai-study-header-subtitle');
    if (subtitleEl) {
      subtitleEl.textContent = `${info.title} • ${info.sourcesSummary}`;
    }

    // Mise à jour des classes actives sur les cartes du popover
    document.querySelectorAll('.study-mode-card').forEach(card => {
      if (card.getAttribute('data-mode') === modeKey) {
        card.classList.add('active');
      } else {
        card.classList.remove('active');
      }
    });

    // Mise à jour du placeholder du champ de saisie
    if (this.inputEl) {
      this.inputEl.placeholder = info.placeholder;
    }

    // Fermer le popover
    document.getElementById('ai-mode-dropdown-popover')?.classList.add('hidden');

    // Rafraîchir les suggestions dynamiques
    this.renderSuggestions();
  },

  openPassagePicker() {
    if (typeof BookPicker !== 'undefined') {
      const book = this.currentBookCode || (typeof BibleReader !== 'undefined' ? BibleReader.currentBook : 'Gen');
      const ch = this.currentChapter || (typeof BibleReader !== 'undefined' ? BibleReader.currentChapter : 1);
      BookPicker.open(book, ch, (bCode, chNum, vNum = null) => {
        this.setPassage(bCode, chNum, vNum);
      });
    }
  },

  setPassage(bookCode, chapterNum, verseNum = null) {
    this.currentBookCode = bookCode;
    this.currentChapter = chapterNum || 1;
    this.currentVerse = verseNum || null;
    this.updatePassageDisplay();
    this.renderSuggestions();
  },

  clearPassage() {
    this.currentBookCode = null;
    this.currentChapter = null;
    this.currentVerse = null;
    this.updatePassageDisplay();
    this.renderSuggestions();
  },

  syncFromBibleReader() {
    if (typeof BibleReader !== 'undefined' && BibleReader.currentBook) {
      this.setPassage(BibleReader.currentBook, BibleReader.currentChapter, BibleReader.currentVerse || null);
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast(`Passage lié : ${this.getPassageLabel()}`);
      }
    }
  },

  getPassageLabel() {
    if (!this.currentBookCode) return null;
    let bName = this.currentBookCode;
    if (typeof BookPicker !== 'undefined' && BookPicker.booksData) {
      const bObj = BookPicker.booksData.find(b => b.code.toLowerCase() === this.currentBookCode.toLowerCase());
      if (bObj) bName = bObj.name;
    }
    let label = `${bName} ${this.currentChapter || 1}`;
    if (this.currentVerse) {
      label += `:${this.currentVerse}`;
    }
    return label;
  },

  updatePassageDisplay() {
    const label = this.getPassageLabel();
    if (label) {
      if (this.passageLabelEl) this.passageLabelEl.textContent = label;
      this.btnPassagePickerEl?.classList.add('has-passage');
      this.btnClearPassageEl?.classList.remove('hidden');
    } else {
      if (this.passageLabelEl) this.passageLabelEl.textContent = "Recherche générale";
      this.btnPassagePickerEl?.classList.remove('has-passage');
      this.btnClearPassageEl?.classList.add('hidden');
    }
  },

  // =========================================================================
  // MOTEUR DE SUGGESTIONS DYNAMIQUES (SmoothUI ai-suggestions)
  // =========================================================================

  renderSuggestions() {
    if (!this.suggestionsBarEl) return;
    this.suggestionsBarEl.innerHTML = '';

    const suggestions = this.getSuggestionsList();
    if (!suggestions || suggestions.length === 0) return;

    suggestions.forEach((sug, index) => {
      const chip = document.createElement('button');
      chip.className = 'ai-suggestion-chip';
      chip.style.animationDelay = `${index * 50}ms`;
      chip.innerHTML = `
        <span class="chip-icon">${sug.icon}</span>
        <span class="chip-label">${sug.label}</span>
      `;
      chip.setAttribute('title', sug.prompt);
      chip.addEventListener('click', () => {
        this.applySuggestion(sug);
      });
      this.suggestionsBarEl.appendChild(chip);
    });
  },

  getSuggestionsList() {
    const passageLabel = this.getPassageLabel();
    const hasPassage = !!passageLabel;
    const isNT = this.currentBookCode ? this.isNewTestament(this.currentBookCode) : true;
    const mode = this.currentMode;

    const list = [];

    if (!hasPassage) {
      // Suggestions pour Recherche Doctrinale / Thématique générale
      list.push({
        icon: '📚',
        label: 'Calvin & Prédestination',
        prompt: "Quelle est la vision de Jean Calvin sur la prédestination et l'élection souveraine de Dieu ?",
        targetMode: 'theology'
      });
      list.push({
        icon: '⚖️',
        label: 'Justification par la Foi',
        prompt: "Présente la doctrine de la justification par la foi selon l'apôtre Paul et la Réforme protestante.",
        targetMode: 'theology'
      });
      list.push({
        icon: '✨',
        label: 'Théologie des Alliances',
        prompt: "Comment s'articulent l'Ancienne et la Nouvelle Alliance dans la théologie biblique réformée ?",
        targetMode: 'theology'
      });
      list.push({
        icon: '📜',
        label: 'Arrière-plan des Évangiles',
        prompt: "Quel était le contexte religieux et politique juif (pharisiens, sadducéens, zélotes) au temps de Jésus ?",
        targetMode: 'historical'
      });
      list.push({
        icon: '🔍',
        label: 'Lexique : Grâce & Miséricorde',
        prompt: "Étudie les termes hébreux (Hesed, Rahamim) et grecs (Charis, Eleos) traduisant la grâce et la miséricorde.",
        targetMode: 'lexical'
      });
    } else {
      // Suggestions ciblées sur le passage actif
      const ref = passageLabel;
      
      // 1. Exégèse
      list.push({
        icon: '🏛️',
        label: `Structure de ${ref}`,
        prompt: `Analyse la structure littéraire, syntaxique et la progression théologique de ${ref}.`,
        targetMode: 'exegesis'
      });

      // 2. Lexique (Grec ou Hébreu selon le testament)
      if (isNT) {
        list.push({
          icon: '🔍',
          label: 'Mots-clés grecs & Strong',
          prompt: `Quels sont les termes grecs pivots et codes Strong majeurs dans ${ref}, avec leurs nuances théologiques ?`,
          targetMode: 'lexical'
        });
      } else {
        list.push({
          icon: '🔍',
          label: 'Racines hébraïques & Strong',
          prompt: `Analyse les racines hébraïques clés et nuances massorétiques dans ${ref}.`,
          targetMode: 'lexical'
        });
      }

      // 3. Commentaires & Auteurs de la Bibliothèque
      list.push({
        icon: '📚',
        label: `Avis de Calvin & Matthew Henry`,
        prompt: `Que disent les grands commentateurs (Jean Calvin, Matthew Henry) sur la portée de ${ref} ?`,
        targetMode: 'auto'
      });

      // 4. Prédication
      list.push({
        icon: '🎙️',
        label: 'Plan de prédication en 3 points',
        prompt: `Propose un plan de prédication percutant en 3 points avec Big Idea, illustrations et applications pastorales sur ${ref}.`,
        targetMode: 'sermon'
      });

      // 5. Contexte historique
      list.push({
        icon: '📜',
        label: 'Contexte de rédaction',
        prompt: `Quel est le contexte historique, culturel et la situation des premiers destinataires de ${ref} ?`,
        targetMode: 'historical'
      });
    }

    return list.slice(0, 5);
  },

  isNewTestament(bookCode) {
    if (typeof BookPicker !== 'undefined' && BookPicker.booksData) {
      const b = BookPicker.booksData.find(x => x.code.toLowerCase() === bookCode.toLowerCase());
      if (b) return b.testament === 'NT';
    }
    // Fallback liste codes NT
    const ntCodes = ['mat','mar','luk','joh','act','rom','1co','2co','gal','eph','phi','col','1th','2th','1ti','2ti','tit','phm','heb','jam','1pe','2pe','1jo','2jo','3jo','jud','rev'];
    return ntCodes.includes(bookCode.toLowerCase());
  },

  applySuggestion(sug) {
    if (sug.targetMode && sug.targetMode !== this.currentMode && sug.targetMode !== 'auto') {
      if (this.MODES_INFO[sug.targetMode]) {
        this.setMode(sug.targetMode);
      }
    }
    if (this.inputEl) {
      this.inputEl.value = sug.prompt;
      this.autoResizeTextarea();
      this.inputEl.focus();
    }
  },

  getOptions() {
    const model = document.getElementById('ai-opt-model')?.value || 'gemini-3.7-flash';
    const depth = document.getElementById('ai-opt-depth')?.value || 'academic';
    const enableReranking = document.getElementById('ai-opt-reranking')?.checked ?? true;
    const enableCurator = document.getElementById('ai-opt-curator')?.checked ?? false;

    const sources = {
      bibles: document.getElementById('ai-opt-src-bibles')?.checked ?? true,
      commentaries: document.getElementById('ai-opt-src-comms')?.checked ?? true,
      dictionaries: document.getElementById('ai-opt-src-dict')?.checked ?? true,
      notes: document.getElementById('ai-opt-src-notes')?.checked ?? true
    };

    return {
      model,
      depth,
      enable_reranking: enableReranking,
      enable_curator: enableCurator,
      sources
    };
  },

  // =========================================================================
  // ENVOI DE QUESTION & AFFICHAGE DU REASONING / LOADER
  // =========================================================================

  async sendMessage() {
    const text = this.inputEl?.value.trim();
    if (!text) return;

    const mode = this.currentMode || 'auto';
    const passage = this.getPassageLabel() || "";
    const options = this.getOptions();
    const nowTime = this.formatCurrentTime();

    // 1. Affichage du message utilisateur
    const userMsg = document.createElement('div');
    userMsg.className = 'chat-message user';
    
    let userHeaderHtml = '';
    if (passage) {
      userHeaderHtml = `<span class="msg-passage-tag" title="Passage lié"><span class="tag-icon">📖</span>${passage}</span> `;
    }

    userMsg.innerHTML = `
      <div class="msg-meta-header">
        <span class="msg-time">${nowTime}</span>
      </div>
      <div class="msg-content">
        ${userHeaderHtml}${this.escapeHtml(text)}
      </div>
    `;
    this.chatFlowEl.appendChild(userMsg);
    this.inputEl.value = '';
    this.autoResizeTextarea();
    this.chatFlowEl.scrollTop = this.chatFlowEl.scrollHeight;

    // 2. Création de la bulle assistant avec SmoothUI Reasoning Loader
    const assistantMsg = document.createElement('div');
    assistantMsg.className = 'chat-message assistant';
    
    const reasoningId = `reasoning-${Date.now()}`;
    const timerId = `timer-${Date.now()}`;
    
    assistantMsg.innerHTML = `
      <div class="msg-avatar">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/></svg>
      </div>
      <div class="msg-content">
        <!-- SmoothUI ai-reasoning component -->
        <div class="ai-reasoning-box active" id="${reasoningId}">
          <div class="ai-reasoning-header">
            <div class="ai-reasoning-title">
              <span class="ai-reasoning-orb"></span>
              <span>Réflexion en cours...</span>
              <span class="ai-reasoning-timer" id="${timerId}">0.0s</span>
            </div>
            <span class="ai-reasoning-toggle-icon">▾</span>
          </div>
          <div class="ai-reasoning-steps-list">
            <div class="reasoning-step step-1 active"><span class="step-icon">🔍</span><span>Analyse de l'intention et formulation des requêtes sémantiques...</span></div>
            <div class="reasoning-step step-2 pending"><span class="step-icon">📚</span><span>Exploration du corpus documentaire (Bibles, Commentaires, Dictionnaires, Notes)...</span></div>
            <div class="reasoning-step step-3 pending"><span class="step-icon">⚡</span><span>Reranking sémantique BGE-M3 des extraits théologiques...</span></div>
            <div class="reasoning-step step-4 pending"><span class="step-icon">✨</span><span>Synthèse et rédaction structurée avec <strong>${options.model}</strong>...</span></div>
          </div>
        </div>
        <div class="ai-answer-body"></div>
      </div>
    `;
    this.chatFlowEl.appendChild(assistantMsg);
    this.chatFlowEl.scrollTop = this.chatFlowEl.scrollHeight;

    // Lancement du chronomètre
    const startTime = performance.now();
    const timerEl = document.getElementById(timerId);
    const intervalTimer = setInterval(() => {
      const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
      if (timerEl) timerEl.textContent = `${elapsed}s`;
    }, 100);

    // Animation progressive des étapes
    const reasoningEl = document.getElementById(reasoningId);
    const stepTimeout1 = setTimeout(() => {
      reasoningEl?.querySelector('.step-1')?.classList.replace('active', 'done');
      reasoningEl?.querySelector('.step-2')?.classList.replace('pending', 'active');
    }, 600);

    const stepTimeout2 = setTimeout(() => {
      reasoningEl?.querySelector('.step-2')?.classList.replace('active', 'done');
      reasoningEl?.querySelector('.step-3')?.classList.replace('pending', 'active');
    }, 1200);

    const stepTimeout3 = setTimeout(() => {
      reasoningEl?.querySelector('.step-3')?.classList.replace('active', 'done');
      reasoningEl?.querySelector('.step-4')?.classList.replace('pending', 'active');
    }, 1800);

    try {
      const response = await API.call('ask_study_ai', text, mode, passage, options);
      clearInterval(intervalTimer);
      clearTimeout(stepTimeout1);
      clearTimeout(stepTimeout2);
      clearTimeout(stepTimeout3);

      const totalDuration = ((performance.now() - startTime) / 1000).toFixed(1);
      const answerText = response.answer || response;
      const sourcesUsed = response.sources_used || [];
      const detectedMode = response.detected_mode || (this.MODES_INFO[mode]?.title || "Synthèse");
      const modelUsed = response.model_used || options.model;
      const respTime = this.formatCurrentTime();

      // 1. Mise à jour du bloc de raisonnement (replié par défaut)
      if (reasoningEl) {
        reasoningEl.classList.remove('active');
        reasoningEl.classList.add('collapsed');
        
        reasoningEl.innerHTML = `
          <div class="ai-reasoning-header clickable" title="Cliquer pour afficher/masquer le processus de réflexion">
            <div class="ai-reasoning-title">
              <span class="ai-reasoning-check">✓</span>
              <span>Raisonnement terminé (${totalDuration}s) • Mode détecté : <strong>${this.escapeHtml(detectedMode)}</strong></span>
            </div>
            <span class="ai-reasoning-chevron">▸</span>
          </div>
          <div class="ai-reasoning-details hidden">
            <div class="reasoning-summary-item"><span class="step-icon">🎯</span><span>Intention : ${this.escapeHtml(detectedMode)}</span></div>
            <div class="reasoning-summary-item"><span class="step-icon">📚</span><span>Corpus : ${sourcesUsed.length} source(s) analysée(s)</span></div>
            <div class="reasoning-summary-item"><span class="step-icon">⚡</span><span>Pipeline : ${options.enable_reranking ? 'Reranking sémantique BGE-M3' : 'Standard'}</span></div>
          </div>
        `;

        reasoningEl.querySelector('.ai-reasoning-header')?.addEventListener('click', () => {
          const details = reasoningEl.querySelector('.ai-reasoning-details');
          const chevron = reasoningEl.querySelector('.ai-reasoning-chevron');
          if (details) {
            const isHidden = details.classList.toggle('hidden');
            if (chevron) chevron.textContent = isHidden ? '▸' : '▾';
          }
        });
      }

      // 2. SmoothUI ai-sources : Pile d'icônes interactive avec accordéon
      let sourcesComponentHtml = '';
      if (sourcesUsed && sourcesUsed.length > 0) {
        sourcesComponentHtml = this.buildSourcesComponentHtml(sourcesUsed);
      }

      // 3. Parseur Markdown intégral & Badges de citations interactifs
      const formattedMarkdown = this.renderRichMarkdown(answerText);

      // 4. Pied de message enrichi (SmoothUI button-copy, Enregistrer dans les notes, horodatage)
      const footerHtml = `
        <div class="ai-msg-footer">
          <div class="ai-footer-left">
            <!-- SmoothUI Button Copy -->
            <button class="smooth-btn-copy" title="Copier l'étude complète dans le presse-papier">
              <span class="copy-icon-wrap">
                <svg class="icon-copy" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                <svg class="icon-check" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </span>
              <span class="copy-label">Copier</span>
            </button>

            <!-- Export dans les Notes -->
            <button class="ai-footer-action-btn btn-export-notes" title="Créer une nouvelle note avec cette étude dans vos Notes (.md)">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
              <span>Enregistrer dans mes Notes</span>
            </button>
          </div>

          <div class="ai-footer-right">
            <span class="ai-mode-pill-badge" title="Mode d'analyse retenu">${this.escapeHtml(detectedMode)}</span>
            <span class="ai-model-tag">${this.escapeHtml(modelUsed)}</span>
            <span class="ai-footer-time">${respTime}</span>
          </div>
        </div>
      `;

      // Injection dans le corps du message
      const answerBodyEl = assistantMsg.querySelector('.ai-answer-body');
      if (answerBodyEl) {
        answerBodyEl.innerHTML = sourcesComponentHtml + `<div class="ai-markdown-content">${formattedMarkdown}</div>` + footerHtml;
      }

      // 5. Attachement des événements interactifs
      this.attachMessageActions(assistantMsg, answerText, passage, text);

    } catch (e) {
      clearInterval(intervalTimer);
      if (reasoningEl) {
        reasoningEl.innerHTML = `<div class="ai-reasoning-error">❌ Erreur lors de la génération de l'étude.</div>`;
      }
      const answerBodyEl = assistantMsg.querySelector('.ai-answer-body');
      if (answerBodyEl) {
        answerBodyEl.innerHTML = `<p style="color: var(--accent-red); margin-top: 8px;">Une erreur est survenue lors de l'appel à l'assistant IA (${this.escapeHtml(e?.message || e)}).</p>`;
      }
    }

    this.chatFlowEl.scrollTop = this.chatFlowEl.scrollHeight;
  },

  // =========================================================================
  // SmoothUI ai-sources : Composant de Sources Dépliables
  // =========================================================================

  buildSourcesComponentHtml(sourcesList) {
    const icons = {
      bible: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
      commentary: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M6 6h10"/><path d="M6 10h10"/></svg>',
      dict: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
      theology: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
      notes: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
      rerank: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>'
    };

    // Construire la pile d'icônes
    const stackItems = sourcesList.slice(0, 4).map((src, i) => {
      let icon = icons.commentary;
      let badgeClass = 'comm';
      if (src.toLowerCase().includes('bible')) { icon = icons.bible; badgeClass = 'bible'; }
      else if (src.toLowerCase().includes('dictionnaire')) { icon = icons.dict; badgeClass = 'dict'; }
      else if (src.toLowerCase().includes('note')) { icon = icons.notes; badgeClass = 'notes'; }
      else if (src.toLowerCase().includes('rerank')) { icon = icons.rerank; badgeClass = 'rerank'; }
      else if (src.toLowerCase().includes('ouvrage') || src.toLowerCase().includes('théologie')) { icon = icons.theology; badgeClass = 'theology'; }

      return `<span class="source-stack-avatar ${badgeClass}" style="z-index: ${5 - i};" title="${this.escapeHtml(src)}">${icon}</span>`;
    }).join('');

    return `
      <div class="ai-sources-component">
        <div class="ai-sources-header clickable">
          <div class="sources-stack-group">
            ${stackItems}
          </div>
          <span class="sources-count-label"><strong>${sourcesList.length} sources</strong> mobilisées</span>
          <span class="sources-toggle-chevron">▸</span>
        </div>
        <div class="ai-sources-dropdown hidden">
          <div class="sources-cards-grid">
            ${sourcesList.map(s => {
              let badgeType = 'Commentaire';
              let badgeClass = 'comm';
              if (s.toLowerCase().includes('bible')) { badgeType = 'Bible'; badgeClass = 'bible'; }
              else if (s.toLowerCase().includes('dictionnaire')) { badgeType = 'Dictionnaire'; badgeClass = 'dict'; }
              else if (s.toLowerCase().includes('note')) { badgeType = 'Note .md'; badgeClass = 'notes'; }
              else if (s.toLowerCase().includes('rerank')) { badgeType = 'RAG BGE-M3'; badgeClass = 'rerank'; }
              else if (s.toLowerCase().includes('ouvrage')) { badgeType = 'Théologie'; badgeClass = 'theology'; }

              return `
                <div class="source-detail-card ${badgeClass}">
                  <span class="source-type-pill ${badgeClass}">${badgeType}</span>
                  <span class="source-title-text">${this.escapeHtml(s)}</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;
  },

  // =========================================================================
  // PARSEUR MARKDOWN INTÉGRAL AVEC TABLEAUX & CITATIONS IN-TEXT CLIQUABLES
  // =========================================================================

  renderRichMarkdown(mdText) {
    if (!mdText) return '';
    let text = mdText;

    // 1. Protection des blocs de code
    const codeBlocks = [];
    text = text.replace(/```([\s\S]*?)```/g, (match, code) => {
      const id = `__CODE_BLOCK_${codeBlocks.length}__`;
      codeBlocks.push(`<pre class="ai-code-block"><code>${this.escapeHtml(code.trim())}</code></pre>`);
      return id;
    });

    // 2. Parseur de tableaux Markdown (| Col 1 | Col 2 |)
    text = text.replace(/(?:^|\n)(\|[^\n]+\|\r?\n\|[-:\s|]+\|\r?\n(?:\|[^\n]+\|\r?\n?)+)/g, (match, tableBlock) => {
      const lines = tableBlock.trim().split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) return match;

      const headers = lines[0].split('|').slice(1, -1).map(h => h.trim());
      const bodyLines = lines.slice(2);

      let tableHtml = '<div class="ai-table-responsive"><table class="ai-study-table"><thead><tr>';
      headers.forEach(h => {
        tableHtml += `<th>${this.formatInlineMarkdown(h)}</th>`;
      });
      tableHtml += '</tr></thead><tbody>';

      bodyLines.forEach(row => {
        const cells = row.split('|').slice(1, -1).map(c => c.trim());
        tableHtml += '<tr>';
        cells.forEach(cell => {
          tableHtml += `<td>${this.formatInlineMarkdown(cell)}</td>`;
        });
        tableHtml += '</tr>';
      });

      tableHtml += '</tbody></table></div>\n';
      return tableHtml;
    });

    // 3. Citations en retrait (> Citation)
    text = text.replace(/(?:^|\n)>[ ]?([^\n]+)/g, '\n<blockquote class="ai-quote">$1</blockquote>');

    // 4. Titres de section
    text = text.replace(/^#### (.*$)/gim, '<h4 class="ai-heading h4">$1</h4>');
    text = text.replace(/^### (.*$)/gim, '<h3 class="ai-heading h3">$1</h3>');
    text = text.replace(/^## (.*$)/gim, '<h2 class="ai-heading h2">$1</h2>');
    text = text.replace(/^# (.*$)/gim, '<h1 class="ai-heading h1">$1</h1>');

    // 5. Lignes horizontales
    text = text.replace(/^---$/gim, '<hr class="ai-divider">');

    // 6. Listes à puces et ordonnées
    text = text.replace(/^\s*[-*]\s+(.*)$/gim, '<li class="ai-bullet-item">$1</li>');
    text = text.replace(/(<li class="ai-bullet-item">[\s\S]*?<\/li>)/g, '<ul class="ai-bullet-list">$1</ul>');

    // 7. Formatage Inline (Gras, Italique, Badges in-text)
    text = this.formatInlineMarkdown(text);

    // 8. Rétablir les blocs de code
    codeBlocks.forEach((codeHtml, idx) => {
      text = text.replace(`__CODE_BLOCK_${idx}__`, codeHtml);
    });

    // 9. Paragraphes
    text = text.replace(/\n\n+/g, '</p><p class="ai-p">');
    text = `<p class="ai-p">${text}</p>`;
    text = text.replace(/<p class="ai-p">\s*<\/p>/g, '');

    return text;
  },

  formatInlineMarkdown(str) {
    if (!str) return '';
    let res = str;

    // Gras & Italique
    res = res.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
    res = res.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    res = res.replace(/\*(.*?)\*/g, '<em>$1</em>');
    res = res.replace(/`([^`]+)`/g, '<code class="ai-inline-code">$1</code>');

    // Citations in-text cliquables (Versets, Calvin, Strong, Dictionnaires)
    // [Jean 3:16], [Romains 8:1-4], [[Rom 8:28]]
    const scriptureRegex = /\[\[?([1-3]?\s?[A-Za-zÀ-ÿ]{3,15})\s+(\d{1,3}):(\d{1,3}(?:-\d{1,3})?)\]?\]/g;
    res = res.replace(scriptureRegex, (match, book, chap, verse) => {
      const fullRef = `${book} ${chap}:${verse}`;
      return `<button class="intext-source-badge scripture" data-ref="${fullRef}" title="Cliquer pour ouvrir ${fullRef} dans la Bible"><span class="badge-icon">📖</span><span class="badge-text">${fullRef}</span></button>`;
    });

    // Codes Strong [Strong: G2631], [G2631], [H7225]
    const strongRegex = /\[\[?(?:Strong:\s*)?([GH]\d{1,5})\]?\]/gi;
    res = res.replace(strongRegex, (match, code) => {
      return `<span class="intext-source-badge strong" title="Code Strong ${code.toUpperCase()}"><span class="badge-icon">🔍</span><span class="badge-text">${code.toUpperCase()}</span></span>`;
    });

    // Auteurs théologiques [Calvin: IRC], [Matthew Henry], [Dom Calmet]
    const authorRegex = /\[\[?(Calvin(?:[^\],]+)?|Matthew Henry|Augustin|Luther|Spurgeon|Dom Calmet|Vigouroux)\]?\]/gi;
    res = res.replace(authorRegex, (match, author) => {
      return `<span class="intext-source-badge author" title="Source : ${author}"><span class="badge-icon">📚</span><span class="badge-text">${author}</span></span>`;
    });

    return res;
  },

  // =========================================================================
  // ACTIONS DE MESSAGE (SmoothUI button-copy, Export Notes, Clics Versets)
  // =========================================================================

  attachMessageActions(messageEl, rawAnswer, passageRef, userQuestion) {
    // 1. Bouton Copier animé (SmoothUI button-copy)
    const copyBtn = messageEl.querySelector('.smooth-btn-copy');
    copyBtn?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(rawAnswer);
        copyBtn.classList.add('copied');
        const label = copyBtn.querySelector('.copy-label');
        if (label) label.textContent = 'Copié !';

        if (typeof App !== 'undefined' && App.showToast) {
          App.showToast('✓ Étude copiée dans le presse-papier !');
        }

        setTimeout(() => {
          copyBtn.classList.remove('copied');
          if (label) label.textContent = 'Copier';
        }, 2000);
      } catch (e) {
        alert('Erreur copie presse-papier');
      }
    });

    // 2. Bouton Enregistrer dans les Notes (.md)
    const exportNotesBtn = messageEl.querySelector('.btn-export-notes');
    exportNotesBtn?.addEventListener('click', async () => {
      const subject = passageRef || userQuestion.slice(0, 40);
      const noteTitle = `Étude IA — ${subject}`;
      const noteData = {
        title: noteTitle,
        reference: passageRef || '',
        tags: 'étude-ia, théologie, prédication',
        include_in_ai: true,
        content: `## ${noteTitle}\n*Générée le ${new Date().toLocaleDateString('fr-FR')} à ${this.formatCurrentTime()}*\n\n**Demande initiale :** ${userQuestion}\n\n---\n\n${rawAnswer}`
      };

      try {
        await API.call('save_note', noteData);
        if (typeof App !== 'undefined' && App.showToast) {
          App.showToast(`✓ Étude enregistrée dans vos Notes : « ${noteTitle} » !`);
        }
        if (typeof NotesView !== 'undefined' && NotesView.loadNotes) {
          NotesView.loadNotes();
        }
      } catch (e) {
        alert(`Erreur enregistrement note : ${e}`);
      }
    });

    // 3. Déplier / replier le composant SmoothUI ai-sources
    const sourcesHeader = messageEl.querySelector('.ai-sources-header');
    sourcesHeader?.addEventListener('click', () => {
      const dropdown = messageEl.querySelector('.ai-sources-dropdown');
      const chevron = messageEl.querySelector('.sources-toggle-chevron');
      if (dropdown) {
        const isHidden = dropdown.classList.toggle('hidden');
        if (chevron) chevron.textContent = isHidden ? '▸' : '▾';
      }
    });

    // 4. Clics sur les badges de versets in-text -> Ouvre le verset dans le lecteur Bible
    messageEl.querySelectorAll('.intext-source-badge.scripture').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const ref = btn.getAttribute('data-ref');
        if (ref && typeof BibleReader !== 'undefined' && typeof App !== 'undefined') {
          App.switchView('bible');
          BibleReader.navigateTo(ref);
        }
      });
    });
  },

  formatCurrentTime() {
    const d = new Date();
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  },

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
};

window.AIStudyView = AIStudyView;
