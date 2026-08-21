/**
 * AI Study View Controller — Open Shema
 * Module d'interface pour l'étude théologique et biblique assistée par IA.
 * Version sobre, épurée, sans émojis, avec composants SmoothUI raffinés :
 * - Mode Automatique intelligent (Auto) & modes spécialisés
 * - Suggestions d'étude escamotables (affichées au début, masquées par défaut après envoi)
 * - Écran de raisonnement textuel épuré avec chronomètre et étapes séquentielles
 * - Parseur Markdown complet avec tableaux réactifs et citations de sources par paragraphe
 * - Infobulles détaillées au survol des sources (sans mention de reranking)
 * - Badges in-text cliquables sans émojis (ouvrent directement la Bible)
 * - Bouton copier SmoothUI animé & Export 1-clic vers les Notes (.md)
 */

const AIStudyView = {
  chatFlowEl: null,
  inputEl: null,
  btnSendEl: null,
  suggestionsContainerEl: null,
  suggestionsBarEl: null,
  btnToggleSuggestionsEl: null,
  sugToggleArrowEl: null,
  btnPassagePickerEl: null,
  passageLabelEl: null,
  btnClearPassageEl: null,
  btnSyncBibleEl: null,

  // État du passage d'étude (null = recherche générale / théologique)
  currentBookCode: null,
  currentChapter: null,
  currentVerse: null,

  // Mémoire et Session
  currentSessionId: null,
  currentMessages: [],

  // Mode actif (auto par défaut)
  currentMode: 'auto',
  suggestionsVisible: true,
  hasUserSentMessage: false,

  // Définition des modes d'étude
  MODES_INFO: {
    auto: {
      icon: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/></svg>',
      title: 'Détection Automatique',
      shortTitle: 'Auto',
      sourcesSummary: 'Bibles, Dictionnaires, Commentaires, Théologie, Notes',
      desc: "L'IA identifie l'intention doctrinale, exégétique, historique ou pastorale et mobilise les corpus les plus pertinents.",
      placeholder: "Posez votre question (ex: Vision de Calvin sur la prédestination, Exégèse de Rom 8...)"
    },
    exegesis: {
      icon: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
      title: 'Exégèse approfondie',
      shortTitle: 'Exégèse',
      sourcesSummary: 'Bibles originales, Multi-traductions, Commentaires majeurs, Notes',
      desc: 'Analyse structurelle et théologique verset par verset, chiasmes, syntaxe et cohérence canonique.',
      placeholder: "Ex: Analyse la structure de ce passage, les articulations syntaxiques et la portée théologique..."
    },
    historical: {
      icon: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="2" y1="20" x2="22" y2="20"></line><line x1="6" y1="20" x2="6" y2="4"></line><line x1="18" y1="20" x2="18" y2="4"></line><line x1="2" y1="4" x2="22" y2="4"></line><line x1="10" y1="20" x2="10" y2="4"></line><line x1="14" y1="20" x2="14" y2="4"></line></svg>',
      title: 'Contexte historique & culturel',
      shortTitle: 'Histoire & Contexte',
      sourcesSummary: 'Dictionnaires bibliques (Dom Calmet, Vigouroux...), Archéologie, Notes',
      desc: 'Arrière-plan historique, auteur, destinataires, cadre socio-politique antique et géographie.',
      placeholder: "Ex: Quel est le contexte politique, culturel et historique de la rédaction de ce texte ?"
    },
    sermon: {
      icon: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>',
      title: 'Préparation de prédication / Message',
      shortTitle: 'Prédication',
      sourcesSummary: 'Commentaires pastoraux, Trésor de l\'Écriture (TSK), Illustrations, Notes',
      desc: 'Plan homilétique complet avec idée maîtresse (Big Idea), 3 points de développement et applications concrètes.',
      placeholder: "Ex: Propose un plan de prédication percutant en 3 points avec illustrations et applications pour l'Église..."
    },
    lexical: {
      icon: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/></svg>',
      title: 'Analyse lexicale (Grec & Hébreu)',
      shortTitle: 'Lexique Hébreu/Grec',
      sourcesSummary: 'Lexique Strong Hébreu/Grec, Dictionnaires de racines (Bailly, Gesenius), LXX',
      desc: 'Étude des racines hébraïques/grecques, codes Strong, nuances morphologiques et sens dans la Septante (LXX).',
      placeholder: "Ex: Analyse les termes clés en hébreu/grec dans ce verset, leurs racines et leurs nuances théologiques..."
    }
  },

  // Icônes SVG sobres et universelles
  ICONS: {
    bible: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
    book: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M6 6h10"/><path d="M6 10h10"/></svg>',
    dict: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
    theology: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
    notes: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
    scales: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h18"/></svg>',
    sparkles: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/></svg>',
    scroll: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1 .4-1 1v7c0 .6.4 1 1 1h14Z"/><path d="M16 17v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/></svg>',
    search: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
    mic: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>',
    check: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
  },

  init() {
    this.chatFlowEl = document.getElementById('ai-study-chat-flow');
    this.inputEl = document.getElementById('ai-study-input');
    this.btnSendEl = document.getElementById('btn-send-study-ai');
    this.suggestionsContainerEl = document.getElementById('ai-suggestions-container');
    this.suggestionsBarEl = document.getElementById('ai-suggestions-bar');
    this.btnToggleSuggestionsEl = document.getElementById('btn-toggle-suggestions');
    this.sugToggleArrowEl = document.getElementById('sug-toggle-arrow');
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

    // 1. Menu déroulant des modes
    btnModeSelector?.addEventListener('click', (e) => {
      e.stopPropagation();
      modePopover?.classList.toggle('hidden');
      optionsPanel?.classList.add('hidden');
    });

    btnCloseModePopover?.addEventListener('click', () => {
      modePopover?.classList.add('hidden');
    });

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

    document.addEventListener('click', (e) => {
      if (modePopover && !modePopover.contains(e.target) && e.target !== btnModeSelector) {
        modePopover.classList.add('hidden');
      }
      if (optionsPanel && !optionsPanel.contains(e.target) && e.target !== btnToggleOptions && e.target !== btnPopoverOptions) {
        optionsPanel.classList.add('hidden');
      }
    });

    // 2.5 Sidebar Historique
    const btnToggleHistory = document.getElementById('btn-toggle-ai-history');
    const historySidebar = document.getElementById('ai-history-sidebar');
    const btnNewSession = document.getElementById('btn-new-ai-session');

    btnToggleHistory?.addEventListener('click', (e) => {
      e.stopPropagation();
      historySidebar?.classList.toggle('hidden');
      if (!historySidebar?.classList.contains('hidden')) {
        this.loadHistory();
      }
    });

    btnNewSession?.addEventListener('click', () => {
      this.startNewSession();
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

    // 4. Volet escamotable des suggestions
    this.btnToggleSuggestionsEl?.addEventListener('click', () => {
      this.toggleSuggestions();
    });

    // 5. Auto-expansion du champ textarea
    this.inputEl?.addEventListener('input', () => {
      this.autoResizeTextarea();
    });

    // 6. Envoi du message ou arrêt de génération
    this.btnSendEl?.addEventListener('click', () => {
      if (this.isGenerating) {
        this.stopGeneration();
      } else {
        this.sendMessage();
      }
    });

    this.inputEl?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!this.isGenerating) {
          this.sendMessage();
        }
      }
    });

    // Initialisation
    this.setMode('auto');
    this.updatePassageDisplay();
    this.renderSuggestions();
    this.initGlobalTooltip();
    this.initContextDepthSlider();
  },

  // =========================================================================
  // GESTION DES SESSIONS ET DE L'HISTORIQUE
  // =========================================================================

  async startNewSession() {
    this.currentSessionId = null;
    this.currentMessages = [];
    this.hasUserSentMessage = false;
    this.clearPassage();
    
    // Réinitialiser l'interface
    if (this.chatFlowEl) {
      this.chatFlowEl.innerHTML = `
        <div class="chat-message assistant welcome-message">
          <div class="msg-avatar">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/></svg>
          </div>
          <div class="msg-content">
            <div class="welcome-title">Nouvelle étude biblique</div>
            <p>Posez une question doctrinale, soumettez un passage pour exégèse ou demandez une comparaison théologique. L'assistant s'appuie directement sur vos textes bibliques, vos dictionnaires, vos commentaires et vos notes personnelles.</p>
          </div>
        </div>
      `;
    }
    
    if (!this.suggestionsVisible) {
      this.toggleSuggestions();
    }
    
    // Fermer la sidebar sur petit écran si besoin
    if (window.innerWidth < 768) {
      document.getElementById('ai-history-sidebar')?.classList.add('hidden');
    }
    
    this.loadHistory(); // Rafraîchir l'affichage (désélection)
    
    // Demander un nouvel ID au backend
    try {
      this.currentSessionId = await API.call('create_ai_session', { mode: this.currentMode });
    } catch (e) {
      console.error("Erreur création session:", e);
    }
  },

  async loadHistory() {
    const listEl = document.getElementById('ai-history-list');
    if (!listEl) return;
    
    try {
      const sessions = await API.call('get_ai_history');
      listEl.innerHTML = '';
      
      if (!sessions || sessions.length === 0) {
        listEl.innerHTML = `<div style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 12px;">Aucun historique récent</div>`;
        return;
      }
      
      sessions.forEach(session => {
        const itemEl = document.createElement('div');
        itemEl.className = 'ai-history-item';
        if (session.id === this.currentSessionId) {
          itemEl.classList.add('active');
        }
        
        const dateObj = new Date(session.updated_at);
        const dateStr = dateObj.toLocaleDateString() + ' à ' + dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        itemEl.innerHTML = `
          <div class="ai-history-item-title">${session.title || 'Nouvelle étude'}</div>
          <div class="ai-history-item-date">${dateStr}</div>
        `;
        
        itemEl.addEventListener('click', () => {
          this.switchSession(session.id);
        });
        
        listEl.appendChild(itemEl);
      });
    } catch (e) {
      console.error("Erreur chargement historique:", e);
      listEl.innerHTML = `<div style="padding: 20px; text-align: center; color: var(--accent-red); font-size: 12px;">Erreur de chargement</div>`;
    }
  },

  async switchSession(sessionId) {
    if (this.currentSessionId === sessionId) return;
    if (this.isGenerating) {
      console.warn("Impossible de changer de session pendant la génération.");
      return;
    }
    
    try {
      const sessionData = await API.call('get_ai_session', sessionId);
      if (!sessionData) return;
      
      this.currentSessionId = sessionId;
      this.currentMessages = sessionData.messages || [];
      this.hasUserSentMessage = this.currentMessages.length > 0;
      
      // Restaurer le passage si présent dans le contexte
      if (sessionData.context && sessionData.context.bookCode) {
        this.currentBookCode = sessionData.context.bookCode;
        this.currentChapter = sessionData.context.chapter;
        this.currentVerse = sessionData.context.verse;
        this.updatePassageDisplay();
      } else {
        this.clearPassage();
      }
      
      // Re-rendre les messages
      if (this.chatFlowEl) {
        this.chatFlowEl.innerHTML = '';
        if (this.currentMessages.length === 0) {
          this.startNewSession();
          return;
        }
        
        this.currentMessages.forEach(msg => {
          if (msg.role === 'user') {
            const wrap = document.createElement('div');
            wrap.className = 'chat-message user';
            wrap.innerHTML = `<div class="msg-content">${msg.content}</div>`;
            this.chatFlowEl.appendChild(wrap);
          } else {
            // Assistant message
            const assistantWrap = document.createElement('div');
            assistantWrap.className = 'chat-message assistant';
            assistantWrap.innerHTML = `
              <div class="msg-avatar">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/></svg>
              </div>
              <div class="msg-content markdown-body"></div>
              <div class="msg-actions"></div>
            `;
            const contentBox = assistantWrap.querySelector('.msg-content');
            // Simulation du parse markdown sans re-streaming
            contentBox.innerHTML = this.parseMarkdown(msg.content);
            
            // Reconnecter les actions (copier, pin)
            const actionsBox = assistantWrap.querySelector('.msg-actions');
            this.attachMessageActions(actionsBox, msg.content, msg.sources);
            
            this.chatFlowEl.appendChild(assistantWrap);
          }
        });
        
        this.scrollToBottom();
      }
      
      // Masquer les suggestions si l'historique a des messages
      if (this.hasUserSentMessage && this.suggestionsVisible) {
        this.toggleSuggestions();
      }
      
      // Fermer la sidebar sur mobile
      if (window.innerWidth < 768) {
        document.getElementById('ai-history-sidebar')?.classList.add('hidden');
      }
      
      this.loadHistory(); // Rafraîchir pour la sélection visuelle active
      
    } catch (e) {
      console.error("Erreur chargement session:", e);
    }
  },

  // =========================================================================
  // JAUGE DE PROFONDEUR DE CONTEXTE
  // =========================================================================

  initContextDepthSlider() {
    const slider   = document.getElementById('ai-opt-context-depth');
    const tokensEl = document.getElementById('ctx-depth-tokens');
    const timeEl   = document.getElementById('ctx-depth-time');
    const descEl   = document.getElementById('ctx-depth-desc');

    if (!slider) return;

    const levels = [
      {
        tokens: '~200 tokens / source',
        time: '≈ 15–30 s',
        desc: 'Synthèse ultra-rapide — extrait les passages clés essentiels.'
      },
      {
        tokens: '~600 tokens / source',
        time: '≈ 45–90 s',
        desc: 'Contexte équilibré — bon compromis vitesse / richesse doctrinale.'
      },
      {
        tokens: '~1 500 tokens / source',
        time: '≈ 2–4 min',
        desc: 'Étude détaillée — analyse fouillée des arguments et traités.'
      },
      {
        tokens: '~3 500 tokens / source',
        time: '≈ 4–8 min',
        desc: 'Texte intégral — mobilise la totalité des chapitres et articles.'
      }
    ];

    const update = () => {
      const v = parseInt(slider.value, 10);
      const l = levels[Math.min(v, levels.length - 1)];
      if (tokensEl) tokensEl.textContent = l.tokens;
      if (timeEl)   timeEl.textContent   = l.time;
      if (descEl)   descEl.textContent   = l.desc;
    };

    slider.addEventListener('input', update);
    update(); // État initial
  },

  // =========================================================================
  // TOOLTIP PORTAL GLOBAL — attaché au <body> pour éviter overflow:hidden
  // =========================================================================

  initGlobalTooltip() {
    // Créer le tooltip global unique s'il n'existe pas encore
    let tip = document.getElementById('ai-global-source-tooltip');
    if (!tip) {
      tip = document.createElement('div');
      tip.id = 'ai-global-source-tooltip';
      tip.className = 'intext-tooltip-portal';
      document.body.appendChild(tip);
    }

    let hideTimer = null;

    const showTooltip = (pill) => {
      clearTimeout(hideTimer);

      const typeClass  = pill.dataset.type    || 'comm';
      const title      = pill.dataset.title   || '';
      const author     = pill.dataset.author  || '';
      const label      = pill.dataset.label   || '';
      const preview    = pill.dataset.preview || '';
      const cover      = pill.dataset.cover   || '';

      const coverHtml = cover
        ? `<img class="intext-tooltip-cover-img" src="${cover}" alt="${this.escapeHtml(title)}" />`
        : `<div class="intext-tooltip-fallback ${typeClass}">${this.ICONS.book}</div>`;

      const authorHtml  = author  ? `<span class="intext-tooltip-author">${this.escapeHtml(author)}</span>` : '';
      const snippetHtml = preview ? `<div class="intext-tooltip-snippet">${preview}</div>` : '';

      tip.innerHTML = `
        <div class="intext-tooltip-cover-wrap">${coverHtml}</div>
        <div class="intext-tooltip-content">
          <div class="intext-tooltip-header">
            <span class="tooltip-badge ${typeClass}">${label}</span>
            ${authorHtml}
          </div>
          <strong class="intext-tooltip-title">${this.escapeHtml(title)}</strong>
          ${snippetHtml}
        </div>
      `;
      tip.classList.add('is-visible');
      this._repositionTooltip(tip, pill);
    };

    const hideTooltip = () => {
      hideTimer = setTimeout(() => {
        tip.classList.remove('is-visible');
      }, 120);
    };

    // Délégation d'événements sur le document (fonctionne avec les éléments dynamiques)
    document.addEventListener('mouseover', (e) => {
      const pill = e.target.closest('.intext-source-pill');
      if (pill) showTooltip(pill);
    });
    document.addEventListener('mouseout', (e) => {
      const pill = e.target.closest('.intext-source-pill');
      if (pill) hideTooltip();
    });
    tip.addEventListener('mouseover', () => clearTimeout(hideTimer));
    tip.addEventListener('mouseout', () => hideTooltip());

    // Repositionner au scroll/resize
    window.addEventListener('scroll', () => { if (tip.classList.contains('is-visible')) tip.classList.remove('is-visible'); }, true);
    window.addEventListener('resize', () => { if (tip.classList.contains('is-visible')) tip.classList.remove('is-visible'); });
  },

  _repositionTooltip(tip, anchor) {
    const rect = anchor.getBoundingClientRect();
    const tipW = 300;
    const tipH = 100; // estimation haute

    let left = rect.left + window.scrollX - 8;
    let top  = rect.top  + window.scrollY - tipH - 10;

    // Débordement à droite
    if (left + tipW > window.innerWidth + window.scrollX - 16) {
      left = window.innerWidth + window.scrollX - tipW - 16;
    }
    // Débordement en haut → afficher en dessous
    if (top < window.scrollY + 8) {
      top = rect.bottom + window.scrollY + 6;
    }

    tip.style.left = `${left}px`;
    tip.style.top  = `${top}px`;
  },

  stopGeneration() {
    if (!this.isGenerating) return;
    this.isGenerating = false;
    this.activeGenerationCancelled = true;

    if (this.activeInterval) clearInterval(this.activeInterval);
    if (this.activeTimeouts) {
      this.activeTimeouts.forEach(t => clearTimeout(t));
      this.activeTimeouts = [];
    }

    const reasoningEl = document.querySelector('.ai-reasoning-box.active');
    if (reasoningEl) {
      reasoningEl.classList.remove('active');
      reasoningEl.classList.add('collapsed');
      reasoningEl.innerHTML = `
        <div class="ai-reasoning-header">
          <div class="ai-reasoning-title" style="color: var(--accent-orange);">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
            <span>Génération interrompue</span>
          </div>
        </div>
      `;
    }

    this.resetInputState();
    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast('Génération interrompue.');
    }
  },

  resetInputState() {
    this.isGenerating = false;
    if (this.inputEl) {
      this.inputEl.disabled = false;
      this.inputEl.focus();
    }
    if (this.btnSendEl) {
      this.btnSendEl.innerHTML = `<span>Générer</span><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>`;
      this.btnSendEl.classList.remove('btn-stop');
      this.btnSendEl.title = "Générer l'étude (Entrée)";
    }
  },

  toggleSuggestions(forceState = null) {
    if (forceState !== null) {
      this.suggestionsVisible = forceState;
    } else {
      this.suggestionsVisible = !this.suggestionsVisible;
    }

    if (this.suggestionsBarEl) {
      this.suggestionsBarEl.classList.toggle('hidden', !this.suggestionsVisible);
    }
    if (this.sugToggleArrowEl) {
      this.sugToggleArrowEl.textContent = this.suggestionsVisible ? '▾' : '▸';
    }
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

    const pillIcon = document.getElementById('study-mode-pill-icon');
    const pillLabel = document.getElementById('study-mode-pill-label');
    if (pillIcon) pillIcon.innerHTML = info.icon;
    if (pillLabel) pillLabel.textContent = info.title;

    const subtitleEl = document.getElementById('ai-study-header-subtitle');
    if (subtitleEl) {
      subtitleEl.textContent = `${info.title} • ${info.sourcesSummary}`;
    }

    document.querySelectorAll('.study-mode-card').forEach(card => {
      if (card.getAttribute('data-mode') === modeKey) {
        card.classList.add('active');
      } else {
        card.classList.remove('active');
      }
    });

    if (this.inputEl) {
      this.inputEl.placeholder = info.placeholder;
    }

    document.getElementById('ai-mode-dropdown-popover')?.classList.add('hidden');
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

  onViewActivated() {
    this.renderSuggestions(true);
    this.loadHistory();
  },

  shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  },

  // =========================================================================
  // MOTEUR DE SUGGESTIONS (SmoothUI ai-suggestions - Dynamique & Renouvelé)
  // =========================================================================

  renderSuggestions(forceNew = false) {
    if (!this.suggestionsBarEl) return;
    this.suggestionsBarEl.innerHTML = '';

    const suggestions = this.getSuggestionsList();
    if (!suggestions || suggestions.length === 0) return;

    suggestions.forEach((sug, index) => {
      const chip = document.createElement('button');
      chip.className = 'ai-suggestion-chip';
      chip.style.animationDelay = `${index * 40}ms`;
      chip.innerHTML = `
        <span class="chip-icon">${sug.svg}</span>
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

    if (!hasPassage) {
      const generalPool = [
        {
          svg: this.ICONS.book,
          label: 'Calvin & Prédestination',
          prompt: "Quelle est la vision de Jean Calvin sur la prédestination et l'élection souveraine de Dieu ?",
          targetMode: 'theology'
        },
        {
          svg: this.ICONS.scales,
          label: 'Justification par la Foi',
          prompt: "Présente la doctrine de la justification par la foi selon l'apôtre Paul et la Réforme protestante.",
          targetMode: 'theology'
        },
        {
          svg: this.ICONS.sparkles,
          label: 'Théologie des Alliances',
          prompt: "Comment s'articulent l'Ancienne et la Nouvelle Alliance dans la théologie biblique réformée ?",
          targetMode: 'theology'
        },
        {
          svg: this.ICONS.scroll,
          label: 'Arrière-plan des Évangiles',
          prompt: "Quel était le contexte religieux et politique juif (pharisiens, sadducéens, zélotes) au temps de Jésus ?",
          targetMode: 'historical'
        },
        {
          svg: this.ICONS.search,
          label: 'Lexique : Grâce & Miséricorde',
          prompt: "Étudie les termes hébreux (Hesed, Rahamim) et grecs (Charis, Eleos) traduisant la grâce et la miséricorde.",
          targetMode: 'lexical'
        },
        {
          svg: this.ICONS.theology,
          label: 'Trinité & Conciles antiques',
          prompt: "Comment la doctrine de la Trinité a-t-elle été formulée face aux hérésies (Arianisme, Sabellianisme) ?",
          targetMode: 'theology'
        },
        {
          svg: this.ICONS.bible,
          label: 'Souveraineté & Responsabilité',
          prompt: "Comment concilier la souveraineté absolue de Dieu et la responsabilité morale de l'homme ?",
          targetMode: 'theology'
        },
        {
          svg: this.ICONS.notes,
          label: 'Prédication : Sainteté de Dieu',
          prompt: "Rédige un plan homilétique percutant sur la Sainteté de Dieu basé sur Ésaïe 6.",
          targetMode: 'sermon'
        },
        {
          svg: this.ICONS.search,
          label: 'Lexique : Rédemption & Propitiation',
          prompt: "Analyse le sens théologique de l'expiation, de la propitiation (hilasterion) et de la rédemption (apolutrosis).",
          targetMode: 'lexical'
        },
        {
          svg: this.ICONS.scroll,
          label: 'L\'Exil à Babylone & Identité juive',
          prompt: "Quel a été l'impact théologique et liturgique de l'exil babylonien sur le judaïsme du Second Temple ?",
          targetMode: 'historical'
        },
        {
          svg: this.ICONS.sparkles,
          label: 'Doctrine de la Régénération',
          prompt: "Quelle est la nature du 'nouvel homme' et de la régénération par le Saint-Esprit selon Jean 3 et Éphésiens 2 ?",
          targetMode: 'theology'
        },
        {
          svg: this.ICONS.scales,
          label: 'Loi morale & Cérémonielle',
          prompt: "Quelle est la distinction réformée entre loi morale, civile et cérémonielle, et leur application chrétienne ?",
          targetMode: 'theology'
        },
        {
          svg: this.ICONS.book,
          label: 'Augustin vs Pélage sur la Grâce',
          prompt: "Résume les enjeux théologiques fondamentaux de la controverse entre Augustin et Pélage sur la grâce.",
          targetMode: 'theology'
        },
        {
          svg: this.ICONS.bible,
          label: 'Christ dans les Psaumes messianiques',
          prompt: "Comment les Psaumes 22, 110 et 2 préfigurent-ils le ministère sacerdotal et royal du Messie ?",
          targetMode: 'theology'
        },
        {
          svg: this.ICONS.scroll,
          label: 'Origine et canon de l\'AT',
          prompt: "Comment s'est constitué le canon de l'Ancien Testament (TaNaKh) et sa transmission massorétique ?",
          targetMode: 'historical'
        }
      ];
      return this.shuffleArray(generalPool).slice(0, 5);
    } else {
      const ref = passageLabel;
      
      // Mode Prédication spécialisé avec les 5 piliers homilétiques
      if (this.currentMode === 'sermon') {
        return [
          {
            svg: this.ICONS.sparkles,
            label: `Proposition Centrale (PC) de ${ref}`,
            prompt: `Dégage le sujet précis et formule la Proposition Centrale (Big Idea / thèse homilétique) pour ${ref} en une phrase claire et percutante.`,
            targetMode: 'sermon'
          },
          {
            svg: this.ICONS.notes,
            label: `Plan Expositif de ${ref}`,
            prompt: `Construis un plan expositif fidèle en 2 à 4 points pour ${ref} selon la méthode découper-décrire-homogénéiser.`,
            targetMode: 'sermon'
          },
          {
            svg: this.ICONS.book,
            label: `Pistes d'Illustrations sur ${ref}`,
            prompt: `Propose 3 illustrations pertinentes (historiques, bibliques ou contemporaines) pour illuminer le message de ${ref}.`,
            targetMode: 'sermon'
          },
          {
            svg: this.ICONS.scales,
            label: `4 Axes d'Applications pour ${ref}`,
            prompt: `Formule des applications pastorales concrètes pour ${ref} selon les 4 axes : Cœur, Pensée, Action et Communauté, ancrées dans la grâce.`,
            targetMode: 'sermon'
          },
          {
            svg: this.ICONS.search,
            label: `Garde-fous & Pièges sur ${ref}`,
            prompt: `Quels sont les pièges homilétiques, le risque moraliste ou les fausses pistes à éviter lors de la prédication de ${ref} ?`,
            targetMode: 'sermon'
          }
        ];
      }

      const passagePool = [
        {
          svg: this.ICONS.bible,
          label: `Structure de ${ref}`,
          prompt: `Analyse la structure littéraire, syntaxique et la progression théologique de ${ref}.`,
          targetMode: 'exegesis'
        },
        {
          svg: this.ICONS.notes,
          label: `Plan de sermon sur ${ref}`,
          prompt: `Propose un plan d'enseignement détaillé et des applications pastorales concrètes pour ${ref}.`,
          targetMode: 'sermon'
        },
        {
          svg: this.ICONS.scales,
          label: `Doctrines clés dans ${ref}`,
          prompt: `Quelles sont les doctrines fondamentales énoncées ou sous-jacentes dans ${ref} ?`,
          targetMode: 'theology'
        },
        {
          svg: this.ICONS.scroll,
          label: `Contexte historique de ${ref}`,
          prompt: `Quel est le contexte historique, l'auteur et les destinataires originaux de ${ref} ?`,
          targetMode: 'historical'
        },
        {
          svg: this.ICONS.sparkles,
          label: `Liens canoniques avec ${ref}`,
          prompt: `Quels sont les renvois typologiques et citations intertextuelles liés à ${ref} dans tout le canon biblique ?`,
          targetMode: 'theology'
        },
        {
          svg: this.ICONS.book,
          label: `Calvin & Commentateurs sur ${ref}`,
          prompt: `Que disent les grands commentateurs (Jean Calvin, Matthew Henry) sur la portée de ${ref} ?`,
          targetMode: 'auto'
        }
      ];

      if (isNT) {
        passagePool.push({
          svg: this.ICONS.search,
          label: `Mots-clés grecs dans ${ref}`,
          prompt: `Quels sont les termes grecs pivots et codes Strong majeurs dans ${ref}, avec leurs nuances ?`,
          targetMode: 'lexical'
        });
      } else {
        passagePool.push({
          svg: this.ICONS.search,
          label: `Racines hébraïques dans ${ref}`,
          prompt: `Analyse les racines hébraïques clés et nuances massorétiques dans ${ref}.`,
          targetMode: 'lexical'
        });
      }

      return this.shuffleArray(passagePool).slice(0, 5);
    }
  },

  isNewTestament(bookCode) {
    if (typeof BookPicker !== 'undefined' && BookPicker.booksData) {
      const b = BookPicker.booksData.find(x => x.code.toLowerCase() === bookCode.toLowerCase());
      if (b) return b.testament === 'NT';
    }
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

    // Slider de profondeur de contexte (0=Éclair, 1=Rapide, 2=Approfondi, 3=Exhaustif)
    const depthLevels = [800, 2400, 6000, 14000]; // en caractères (~200 / 600 / 1500 / 3500 tokens)
    const ctxSlider = document.getElementById('ai-opt-context-depth');
    const ctxLevel = ctxSlider ? parseInt(ctxSlider.value, 10) : 1;
    const maxExcerptChars = depthLevels[Math.min(ctxLevel, depthLevels.length - 1)];

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
      max_excerpt_chars: maxExcerptChars,
      sources
    };
  },

  // =========================================================================
  // ENVOI DE QUESTION & AFFICHAGE DU REASONING / LOADER (Sobre & Sans émojis)
  // =========================================================================

  async sendMessage() {
    const text = this.inputEl?.value.trim();
    if (!text) return;

    // Masquer les suggestions dès qu'un message est envoyé
    this.hasUserSentMessage = true;
    this.toggleSuggestions(false);

    // Mémoriser le passage actuel dans le contexte de session s'il est lié
    const passage = this.getPassageLabel() || "";
    
    // Assurer qu'il y a une session active
    if (!this.currentSessionId) {
      const context = passage ? { bookCode: this.currentBookCode, chapter: this.currentChapter, verse: this.currentVerse } : null;
      try {
        this.currentSessionId = await API.call('create_ai_session', context);
      } catch (e) {
        console.error("Erreur création session:", e);
      }
    }

    // Ajouter le message utilisateur à l'historique
    this.currentMessages.push({ role: 'user', content: text });

    const mode = this.currentMode || 'auto';
    const options = this.getOptions();
    const nowTime = this.formatCurrentTime();

    // État de génération actif
    this.isGenerating = true;
    this.activeGenerationCancelled = false;
    if (this.inputEl) this.inputEl.disabled = true;
    if (this.btnSendEl) {
      this.btnSendEl.innerHTML = `<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="2"/></svg><span>Arrêter</span>`;
      this.btnSendEl.classList.add('btn-stop');
      this.btnSendEl.title = "Arrêter la génération";
    }

    // 1. Message utilisateur sobre (fond uni élégant)
    const userMsg = document.createElement('div');
    userMsg.className = 'chat-message user';
    
    let userHeaderHtml = '';
    if (passage) {
      userHeaderHtml = `<span class="msg-passage-tag" title="Passage lié"><span class="tag-icon">${this.ICONS.bible}</span>${passage}</span> `;
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

    // 2. Bulle assistant sobre avec SmoothUI Reasoning
    const assistantMsg = document.createElement('div');
    assistantMsg.className = 'chat-message assistant';
    
    const reasoningId = `reasoning-${Date.now()}`;
    const timerId = `timer-${Date.now()}`;
    
    assistantMsg.innerHTML = `
      <div class="msg-avatar">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/></svg>
      </div>
      <div class="msg-content">
        <!-- SmoothUI ai-reasoning (sobre & textuel) -->
        <div class="ai-reasoning-box active" id="${reasoningId}">
          <div class="ai-reasoning-header">
            <div class="ai-reasoning-title">
              <span class="ai-reasoning-orb"></span>
              <span>Réflexion en cours</span>
              <span class="ai-reasoning-timer" id="${timerId}">0.0s</span>
            </div>
            <span class="ai-reasoning-toggle-icon">▾</span>
          </div>
          <div class="ai-reasoning-steps-list">
            <div class="reasoning-step step-1 active"><span class="step-bullet"></span><span>Analyse de l'intention et du contexte</span></div>
            <div class="reasoning-step step-2 pending"><span class="step-bullet"></span><span>Exploration du corpus documentaire</span></div>
            <div class="reasoning-step step-3 pending"><span class="step-bullet"></span><span>Sélection et ordonnancement sémantique</span></div>
            <div class="reasoning-step step-4 pending">
              <span class="step-bullet"></span>
              <div class="step-text-container">
                <span class="step-label">Synthèse IA avec ${this.escapeHtml(options.model)}</span>
              </div>
            </div>
          </div>
        </div>
        <div class="ai-answer-body"></div>
        <div class="msg-actions"></div>
      </div>
    `;
    this.chatFlowEl.appendChild(assistantMsg);
    this.chatFlowEl.scrollTop = this.chatFlowEl.scrollHeight;

    // Chronomètre en direct
    const startTime = performance.now();
    const timerEl = document.getElementById(timerId);
    const intervalTimer = setInterval(() => {
      const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
      if (timerEl) timerEl.textContent = `${elapsed}s`;
    }, 100);
    this.activeInterval = intervalTimer;

    // Animation progressive des étapes textuelles
    const reasoningEl = document.getElementById(reasoningId);
    const stepTimeout1 = setTimeout(() => {
      reasoningEl?.querySelector('.step-1')?.classList.replace('active', 'done');
      reasoningEl?.querySelector('.step-2')?.classList.replace('pending', 'active');
    }, 500);
    const stepTimeout2 = setTimeout(() => {
      reasoningEl?.querySelector('.step-2')?.classList.replace('active', 'done');
      reasoningEl?.querySelector('.step-3')?.classList.replace('pending', 'active');
    }, 1200);
    const stepTimeout3 = setTimeout(() => {
      reasoningEl?.querySelector('.step-3')?.classList.replace('active', 'done');
      reasoningEl?.querySelector('.step-4')?.classList.replace('pending', 'active');
    }, 2000);
    
    this.activeTimeouts = [stepTimeout1, stepTimeout2, stepTimeout3];

    try {
      const response = await API.call('ask_study_ai', this.currentMessages, mode, passage, options);
      clearInterval(intervalTimer);
      if (this.activeRotatingTimer) clearInterval(this.activeRotatingTimer);
      clearTimeout(stepTimeout1);
      clearTimeout(stepTimeout2);
      clearTimeout(stepTimeout3);
      this.resetInputState();

      if (this.activeGenerationCancelled) return;

      const totalDuration = ((performance.now() - startTime) / 1000).toFixed(1);
      const answerText = response.answer || response;
      const sourcesUsed = response.sources_used || [];
      const sourcesDetails = response.sources_details || [];
      const detectedMode = response.detected_mode || (this.MODES_INFO[mode]?.title || "Synthèse");
      const modelUsed = response.model_used || options.model;
      const respTime = this.formatCurrentTime();

      // Renouveler les suggestions de questions dynamiquement après la réponse
      this.renderSuggestions(true);

      // 1. Bandeau de raisonnement terminé (sobre & replié)
      if (reasoningEl) {
        reasoningEl.classList.remove('active');
        reasoningEl.classList.add('collapsed');
        
        reasoningEl.innerHTML = `
          <div class="ai-reasoning-header clickable" title="Afficher ou masquer les détails du raisonnement">
            <div class="ai-reasoning-title">
              <span class="ai-reasoning-check-icon">${this.ICONS.check}</span>
              <span>Raisonnement terminé (${totalDuration}s) &bull; Mode : <strong>${this.escapeHtml(detectedMode)}</strong></span>
            </div>
            <span class="ai-reasoning-chevron">▸</span>
          </div>
          <div class="ai-reasoning-details hidden">
            <div class="reasoning-summary-item"><span>Intention détectée : ${this.escapeHtml(detectedMode)}</span></div>
            <div class="reasoning-summary-item"><span>Corpus mobilisé : ${sourcesUsed.length} source(s) analysée(s)</span></div>
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

      // 2. SmoothUI ai-sources : Pile de couvertures et cartes détaillées (masquées par défaut)
      let sourcesComponentHtml = '';
      if (sourcesDetails && sourcesDetails.length > 0) {
        sourcesComponentHtml = this.buildSourcesSmoothUiHtml(sourcesDetails);
      } else if (sourcesUsed && sourcesUsed.length > 0) {
        sourcesComponentHtml = this.buildSourcesSimpleHtml(sourcesUsed);
      }

      // 3. Rendu Markdown enrichi avec citations par paragraphe et versets avec infobulle
      const formattedMarkdown = this.renderRichMarkdown(answerText, sourcesDetails);

      // 4. Pied de message sobre
      const footerHtml = `
        <div class="ai-msg-footer">
          <div class="ai-footer-left">
            <button class="smooth-btn-copy" title="Copier l'étude dans le presse-papier">
              <span class="copy-icon-wrap">
                <svg class="icon-copy" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                <svg class="icon-check" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </span>
              <span class="copy-label">Copier</span>
            </button>

            <button class="ai-footer-action-btn btn-export-notes" title="Enregistrer dans vos Notes (.md)">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
              <span>Enregistrer</span>
            </button>
            
            <!-- Pin conclusion button -->
            <button class="ai-footer-action-btn btn-pin-conclusion tooltip" data-tooltip="Épingler dans la mémoire de l'assistant pour le long-terme">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
              <span>Épingler</span>
            </button>
          </div>

          <div class="ai-footer-right">
            <span class="ai-mode-pill-badge">${this.escapeHtml(detectedMode)}</span>
            <span class="ai-model-tag">${this.escapeHtml(modelUsed)}</span>
            <span class="ai-footer-time">${respTime}</span>
          </div>
        </div>
      `;

      const answerBodyEl = assistantMsg.querySelector('.ai-answer-body');
      if (answerBodyEl) {
        answerBodyEl.innerHTML = sourcesComponentHtml + `<div class="ai-markdown-content"></div>` + footerHtml;
        
        // Attacher l'accordéon des sources
        this.attachSourcesAccordion(answerBodyEl);

        // Enregistrer la réponse dans l'historique local & backend
        this.currentMessages.push({ role: 'assistant', content: answerText, sources: sourcesDetails });
        if (this.currentSessionId) {
          API.call('save_ai_messages', this.currentSessionId, this.currentMessages, text).then(() => {
            this.loadHistory(); // Rafraichir le titre
          });
        }

        // Streaming progressif du texte (SmoothUI ai-response)
        const markdownContentEl = answerBodyEl.querySelector('.ai-markdown-content');
        this.streamMarkdownResponse(markdownContentEl, formattedMarkdown, () => {
          this.attachMessageActions(assistantMsg, answerText, passage, text);
        });
      }

      // 5. Scroll automatique doux vers le DÉBUT de la réponse
      setTimeout(() => {
        assistantMsg.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);

    } catch (e) {
      clearInterval(intervalTimer);
      this.resetInputState();
      if (this.activeGenerationCancelled) return;

      if (reasoningEl) {
        reasoningEl.innerHTML = `<div class="ai-reasoning-error">Erreur lors de la génération de l'étude.</div>`;
      }
      const answerBodyEl = assistantMsg.querySelector('.ai-answer-body');
      if (answerBodyEl) {
        answerBodyEl.innerHTML = `<p style="color: var(--accent-red); margin-top: 8px;">Une erreur est survenue lors de l'appel à l'assistant IA (${this.escapeHtml(e?.message || e)}).</p>`;
      }
      setTimeout(() => {
        assistantMsg.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    }
  },

  // =========================================================================
  // SmoothUI ai-sources : Pile de couvertures et cartes dépliables
  // =========================================================================

  getSourceTypeClass(type) {
    const t = (type || '').toLowerCase();
    if (t.includes('bible')) return 'bible';
    if (t.includes('dict')) return 'dict';
    if (t.includes('comm')) return 'comm';
    if (t.includes('note')) return 'notes';
    return 'theology';
  },

  getSourceTypeLabel(type) {
    const t = (type || '').toLowerCase();
    if (t.includes('bible')) return 'Bible';
    if (t.includes('dict')) return 'Dictionnaire';
    if (t.includes('comm')) return 'Commentaire';
    if (t.includes('note')) return 'Notes';
    return 'Théologie';
  },

  getSourceIcon(type) {
    const t = (type || '').toLowerCase();
    if (t.includes('bible')) return this.ICONS.bible;
    if (t.includes('dict')) return this.ICONS.dict;
    if (t.includes('comm')) return this.ICONS.book;
    if (t.includes('note')) return this.ICONS.notes;
    return this.ICONS.book;
  },

  buildSourcesSmoothUiHtml(sourcesDetails) {
    const validSources = sourcesDetails.filter(s => !s.title.toLowerCase().includes('rerank') && !s.type.toLowerCase().includes('rerank'));
    if (validSources.length === 0) return '';

    // 1. Pile d'avatars de couvertures
    const avatarsHtml = validSources.slice(0, 7).map((s, idx) => {
      const title = this.escapeHtml(s.title);
      const coverUrl = s.cover_url;
      const typeClass = this.getSourceTypeClass(s.type);
      const icon = this.getSourceIcon(s.type);
      const zIndex = validSources.length - idx;

      if (coverUrl) {
        return `
          <div class="source-stack-avatar with-cover" style="z-index: ${zIndex};" title="${title}">
            <img class="source-stack-cover-img" src="${coverUrl}" alt="${title}" />
          </div>
        `;
      } else {
        return `
          <div class="source-stack-avatar monogram ${typeClass}" style="z-index: ${zIndex};" title="${title}">
            <span>${icon}</span>
          </div>
        `;
      }
    }).join('');

    const moreCount = validSources.length > 7 ? `<span class="source-stack-more">+${validSources.length - 7}</span>` : '';

    // 2. Grille détaillée de cartes de sources (accordéon fermé par défaut)
    const cardsHtml = validSources.map(s => {
      const title = this.escapeHtml(s.title);
      const typeClass = this.getSourceTypeClass(s.type);
      const typeLabel = this.getSourceTypeLabel(s.type);
      const coverUrl = s.cover_url;
      const preview = s.preview ? this.escapeHtml(s.preview) : 'Ouvrage et extraits analysés pour cette réponse.';
      const icon = this.getSourceIcon(s.type);

      const coverHtml = coverUrl
        ? `<img class="source-card-img" src="${coverUrl}" alt="${title}" />`
        : `<div class="source-card-fallback-cover ${typeClass}">${icon}</div>`;

      return `
        <div class="source-detail-card" tabindex="0" title="${title}">
          <div class="source-card-cover-wrap">
            ${coverHtml}
          </div>
          <div class="source-card-content">
            <div class="source-card-header">
              <span class="source-type-pill ${typeClass}">${typeLabel}</span>
              <strong class="source-card-title">${title}</strong>
            </div>
            <div class="source-card-snippet">${preview}</div>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="ai-sources-component">
        <div class="ai-sources-header" title="Cliquer pour afficher ou masquer les détails des sources">
          <div class="sources-stack-group">
            ${avatarsHtml}
            ${moreCount}
          </div>
          <span class="sources-count-label">Sources consultées (${validSources.length})</span>
          <span class="sources-toggle-chevron">▸</span>
        </div>
        <div class="ai-sources-dropdown hidden">
          <div class="sources-cards-grid">
            ${cardsHtml}
          </div>
        </div>
      </div>
    `;
  },

  attachSourcesAccordion(parentEl) {
    const comp = parentEl.querySelector('.ai-sources-component');
    if (!comp) return;
    const header = comp.querySelector('.ai-sources-header');
    const dropdown = comp.querySelector('.ai-sources-dropdown');
    const chevron = comp.querySelector('.sources-toggle-chevron');

    header?.addEventListener('click', () => {
      if (dropdown) {
        const isHidden = dropdown.classList.toggle('hidden');
        if (chevron) chevron.textContent = isHidden ? '▸' : '▾';
      }
    });
  },

  buildSourcesSimpleHtml(sourcesList) {
    const validSources = sourcesList.filter(s => !s.toLowerCase().includes('rerank'));
    if (validSources.length === 0) return '';

    return `
      <div class="ai-sources-compact-bar">
        <div class="sources-label">
          <span class="sources-icon">${this.ICONS.book}</span>
          <span>Sources consultées (${validSources.length}) :</span>
        </div>
        <div class="sources-pills-list">
          ${validSources.map(s => `<span class="source-hover-pill theology"><span class="pill-name">${this.escapeHtml(s)}</span></span>`).join('')}
        </div>
      </div>
    `;
  },

  // =========================================================================
  // SmoothUI ai-response : Streaming Blur-In Reveal par paquets de mots (Option 1)
  // =========================================================================

  wrapTextNodesIntoChunks(rootEl) {
    const walker = document.createTreeWalker(
      rootEl,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          if (node.parentElement?.closest('pre, code, .intext-source-pill, .theol-inline-scripture-ref, .intext-tooltip')) {
            return NodeFilter.FILTER_REJECT;
          }
          if (!node.textContent || !node.textContent.trim()) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    const textNodes = [];
    while (walker.nextNode()) {
      textNodes.push(walker.currentNode);
    }

    for (const textNode of textNodes) {
      const text = textNode.textContent;
      const words = text.split(/(\s+)/);
      const frag = document.createDocumentFragment();
      
      let currentChunk = '';
      let wordCount = 0;

      for (let i = 0; i < words.length; i++) {
        currentChunk += words[i];
        if (words[i].trim().length > 0) {
          wordCount++;
        }
        if (wordCount >= 3 || i === words.length - 1) {
          if (currentChunk.trim().length > 0) {
            const span = document.createElement('span');
            span.className = 'ai-stream-chunk';
            span.textContent = currentChunk;
            frag.appendChild(span);
          } else {
            frag.appendChild(document.createTextNode(currentChunk));
          }
          currentChunk = '';
          wordCount = 0;
        }
      }

      if (textNode.parentNode) {
        textNode.parentNode.replaceChild(frag, textNode);
      }
    }

    // Pastilles et badges interactifs inclus dans le défilement fluide
    rootEl.querySelectorAll('.theol-inline-scripture-ref, .intext-source-pill, .intext-source-badge').forEach(pill => {
      pill.classList.add('ai-stream-chunk');
    });

    // Blocs majeurs (tableaux, code, séparateurs)
    rootEl.querySelectorAll('.ai-table-responsive, .ai-code-block, .ai-divider').forEach(block => {
      block.classList.add('ai-stream-chunk-block');
    });
  },

  streamMarkdownResponse(containerEl, formattedMarkdown, onComplete) {
    if (!containerEl) return;
    
    containerEl.innerHTML = formattedMarkdown;
    this.wrapTextNodesIntoChunks(containerEl);

    const chunks = Array.from(containerEl.querySelectorAll('.ai-stream-chunk, .ai-stream-chunk-block'));

    if (chunks.length === 0) {
      if (onComplete) onComplete();
      return;
    }

    let currentIndex = 0;
    let isCompleted = false;

    // Calcul du rythme pour une durée totale fluide d'environ 2 à 2.5 secondes
    const totalDurationTargetMs = 2200;
    const intervalMs = 24;
    const totalSteps = Math.max(1, Math.floor(totalDurationTargetMs / intervalMs));
    const stepSize = Math.max(1, Math.ceil(chunks.length / totalSteps));

    const revealAll = () => {
      if (isCompleted) return;
      isCompleted = true;
      if (this.activeStreamTimer) {
        clearInterval(this.activeStreamTimer);
        this.activeStreamTimer = null;
      }
      for (const chunk of chunks) {
        chunk.classList.add('is-visible');
      }
      if (onComplete) onComplete();
    };

    // Possibilité de cliquer sur le texte pour tout afficher instantanément
    const clickHandler = () => {
      revealAll();
      containerEl.removeEventListener('click', clickHandler);
    };
    containerEl.addEventListener('click', clickHandler);

    this.activeStreamTimer = setInterval(() => {
      if (this.activeGenerationCancelled) {
        clearInterval(this.activeStreamTimer);
        this.activeStreamTimer = null;
        return;
      }

      for (let i = 0; i < stepSize && currentIndex < chunks.length; i++) {
        chunks[currentIndex].classList.add('is-visible');
        currentIndex++;
      }

      if (currentIndex >= chunks.length) {
        clearInterval(this.activeStreamTimer);
        this.activeStreamTimer = null;
        isCompleted = true;
        containerEl.removeEventListener('click', clickHandler);
        if (onComplete) onComplete();
      }
    }, intervalMs);
  },

  // =========================================================================
  // PARSEUR MARKDOWN AVEC TABLEAUX, CITATIONS REPLIÉES ET RÉFÉRENCES UNIVERSELLES
  // =========================================================================

  renderRichMarkdown(mdText, sourcesDetails = []) {
    if (!mdText) return '';
    let text = mdText;

    // 0. Nettoyage préliminaire : points seuls, lignes fantômes et sauts superflus
    text = text.replace(/^\s*\.\s*$/gm, '');
    text = text.replace(/\n\s*\.\s*\n/g, '\n\n');
    text = text.replace(/\]\s*\.\s*\n\s*\./g, '].');
    text = text.replace(/\]\s*\n\s*\./g, '].');

    // 1. Protection des blocs de code
    const codeBlocks = [];
    text = text.replace(/```([\s\S]*?)```/g, (match, code) => {
      const id = `__CODE_BLOCK_${codeBlocks.length}__`;
      codeBlocks.push(`<pre class="ai-code-block"><code>${this.escapeHtml(code.trim())}</code></pre>`);
      return id;
    });

    // 1.1 Nettoyage agressif des retours à la ligne autour des citations entre crochets
    // Tout crochet qui se trouve en début de ligne (après n'importe quel texte sauf ":") est remonté à la ligne précédente
    text = text.replace(/([^\n:>])\s*\n+\s*(\[[A-Za-zÀ-ÿ0-9\s:,'’\.\-–—\(\)\/]+\])/g, '$1 $2');
    
    // Tout crochet suivi d'un ou plusieurs retours à la ligne avant la suite du texte est rattaché à la suite
    text = text.replace(/(\[[A-Za-zÀ-ÿ0-9\s:,'’\.\-–—\(\)\/]+\])\s*\n+\s*([^\n<])/g, '$1 $2');

    // Éliminer les espaces mal placés avant la ponctuation : "[Source] . Texte" -> "[Source]. Texte"
    text = text.replace(/\]\s+\.\s/g, ']. ');
    text = text.replace(/\]\s+,\s/g, '], ');
    
    // Rapprocher les crochets consécutifs
    text = text.replace(/\]\s*\n+\s*\[/g, '] [');

    // 2. Parseur de tableaux Markdown (| Col 1 | Col 2 |)
    text = text.replace(/(?:^|\n)(\|[^\n]+\|\r?\n\|[-:\s|]+\|\r?\n(?:\|[^\n]+\|\r?\n?)+)/g, (match, tableBlock) => {
      const lines = tableBlock.trim().split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) return match;

      const headers = lines[0].split('|').slice(1, -1).map(h => h.trim());
      const bodyLines = lines.slice(2);

      let tableHtml = '<div class="ai-table-responsive"><table class="ai-study-table"><thead><tr>';
      headers.forEach(h => {
        tableHtml += `<th>${this.formatInlineMarkdown(h, sourcesDetails)}</th>`;
      });
      tableHtml += '</tr></thead><tbody>';

      bodyLines.forEach(row => {
        const cells = row.split('|').slice(1, -1).map(c => c.trim());
        tableHtml += '<tr>';
        cells.forEach(cell => {
          tableHtml += `<td>${this.formatInlineMarkdown(cell, sourcesDetails)}</td>`;
        });
        tableHtml += '</tr>';
      });

      tableHtml += '</tbody></table></div>\n';
      return tableHtml;
    });

    // 3. Citations en retrait (> Citation)
    text = text.replace(/(?:^|\n)>[ ]?([^\n]+)/g, '\n<blockquote class="ai-quote">$1</blockquote>');

    // 4. Titres hiérarchiques
    text = text.replace(/^#### (.*$)/gim, '<h4 class="ai-heading h4">$1</h4>');
    text = text.replace(/^### (.*$)/gim, '<h3 class="ai-heading h3">$1</h3>');
    text = text.replace(/^## (.*$)/gim, '<h2 class="ai-heading h2">$1</h2>');
    text = text.replace(/^# (.*$)/gim, '<h1 class="ai-heading h1">$1</h1>');

    // 5. Lignes de séparation
    text = text.replace(/^---$/gim, '<hr class="ai-divider">');

    // 6. Listes à puces
    text = text.replace(/^\s*[-*]\s+(.*)$/gim, '<li class="ai-bullet-item">$1</li>');
    text = text.replace(/(<li class="ai-bullet-item">[\s\S]*?<\/li>)/g, '<ul class="ai-bullet-list">$1</ul>');

    // 7. Formatage Inline & Badges in-text
    text = this.formatInlineMarkdown(text, sourcesDetails);

    // 8. Rétablir les blocs de code
    codeBlocks.forEach((codeHtml, idx) => {
      text = text.replace(`__CODE_BLOCK_${idx}__`, codeHtml);
    });

    // 8.5 Convertir les \n simples résiduels en espace pour éviter les points isolés en début de ligne
    // (les \n\n sont traités à l'étape 9, les \n simples au sein d'un paragraphe doivent devenir un espace)
    text = text.replace(/([^\n])\n([^\n])/g, '$1 $2');
    // Nettoyer les points flottants en début de phrase introduits par le LLM
    text = text.replace(/\s+\.\s+/g, '. ');
    text = text.replace(/^\s*\.\s*/gm, '');

    // 9. Paragraphes
    text = text.replace(/\n\n+/g, '</p><p class="ai-p">');
    text = `<p class="ai-p">${text}</p>`;
    // Nettoyer les paragraphes vides ou ne contenant qu'un point isolé
    text = text.replace(/<p class="ai-p">\s*<\/p>/g, '');
    text = text.replace(/<p class="ai-p">\s*[\.\s]*<\/p>/g, '');

    return text;
  },

  guessAuthor(name) {
    const n = (name || '').toLowerCase();
    if (n.includes('calvin')) return 'Jean Calvin';
    if (n.includes('vigouroux')) return 'F. Vigouroux';
    if (n.includes('calmet')) return 'Dom Augustin Calmet';
    if (n.includes('grudem') || n.includes('stgru')) return 'Wayne Grudem';
    if (n.includes('nouveau dictionnaire') || n.includes('emmaus')) return 'Éditions Emmaüs';
    if (n.includes('lire et comprendre') || n.includes('lirelabible')) return 'Société Biblique';
    if (n.includes('josèphe') || n.includes('josephe') || n.includes('josephus')) return 'Flavius Josèphe';
    if (n.includes('macarthur')) return 'John MacArthur';
    if (n.includes('spurgeon')) return 'C.H. Spurgeon';
    if (n.includes('henry')) return 'Matthew Henry';
    if (n.includes('augustin')) return 'Saint Augustin';
    if (n.includes('luther')) return 'Martin Luther';
    return '';
  },

  formatInlineMarkdown(str, sourcesDetails = []) {
    if (!str) return '';
    let res = str;

    // Gras & Italique
    res = res.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
    res = res.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    res = res.replace(/\*(.*?)\*/g, '<em>$1</em>');
    res = res.replace(/`([^`]+)`/g, '<code class="ai-inline-code">$1</code>');

    // 1. Codes Strong : [Strong: G2631], [G2631], [H7225]
    const strongRegex = /\[(?:Strong:\s*)?([GH]\d{1,5})\]/gi;
    res = res.replace(strongRegex, (match, code) => {
      return `<span class="intext-source-badge strong" title="Code Strong ${code.toUpperCase()}"><span class="badge-icon">${this.ICONS.search}</span><span class="badge-text">${code.toUpperCase()}</span></span>`;
    });

    // 2. Détection universelle de TOUTES les citations de sources documentaires entre crochets [Nom : Terme] ou [Nom (Ref)] ou [Nom]
    // Ne s'applique pas aux références bibliques pures entre crochets comme [Jn 3:16], [Romains 8:28], [Hb 3-4]
    const pureScriptureBracketRegex = /^\[\s*(?:[1-3]\s*)?[a-zA-ZÀ-ÿ]+\.?\s*\d+(?:\s*[:.,]\s*\d+(?:\s*[-–—]\s*\d+)?)?\s*\]$/;
    const universalDocSourceRegex = /\[([A-Za-zÀ-ÿ0-9\s:,'’\.\-–—\(\)\/]+)\]/gi;

    res = res.replace(universalDocSourceRegex, (match, rawDocName) => {
      const cleanContent = rawDocName.trim();
      
      // Ignorer si code Strong
      if (/^[GH]\d{1,5}$/i.test(cleanContent) || cleanContent.length < 2) return match;

      // Si c'est une référence biblique pure entre crochets comme [Jean 3:16] ou [Rom 8], laisser linkifyScriptureInText s'en charger
      if (pureScriptureBracketRegex.test(match) && !cleanContent.toLowerCase().includes('texte biblique') && !cleanContent.toLowerCase().includes('bible') && !cleanContent.includes(':')) {
        return match;
      }

      let bookName = cleanContent;
      let entryTerm = "";
      if (cleanContent.includes(':')) {
        const parts = cleanContent.split(':');
        bookName = parts[0].trim();
        entryTerm = parts.slice(1).join(':').trim();
      }

      // Normalisation des noms internes abrégés
      const cleanNameMap = {
        "lirelabibles": "Lire et comprendre la Bible",
        "lire/comprendre": "Lire et comprendre la Bible",
        "lire_comprendre": "Lire et comprendre la Bible",
        "stgru": "Théologie systématique",
        "niv cultural": "NIV Cultural Backgrounds Study Bible",
        "nivarchaeo": "NIV Archaeological Study Bible",
        "macarthur bc": "Commentaire Biblique MacArthur",
        "paradoxes": "Les Paradoxes de la foi",
        "tsm": "The Treasury of Scripture Knowledge"
      };
      const mappedBookName = cleanNameMap[bookName.toLowerCase()] || bookName;

      // Recherche de l'ouvrage dans sourcesDetails
      const matched = sourcesDetails.find(s => {
        const t = (s.title || '').toLowerCase();
        const b = mappedBookName.toLowerCase();
        const r = cleanContent.toLowerCase();
        return t.includes(b) || b.includes(t) || t.includes(r) || r.includes(t) || (entryTerm && t.includes(entryTerm.toLowerCase()));
      });

      const typeClass = matched ? this.getSourceTypeClass(matched.type) : this.getSourceTypeClass(mappedBookName);
      const typeLabel = matched ? this.getSourceTypeLabel(matched.type) : this.getSourceTypeLabel(mappedBookName);
      const author = matched?.author || this.guessAuthor(mappedBookName);
      const coverUrl = matched?.cover_url || null;

      const displayTitle = entryTerm ? `${mappedBookName} : ${entryTerm}` : mappedBookName;
      const preview = matched?.preview ? this.escapeHtml(matched.preview) : '';
      const coverData = coverUrl ? `data-cover="${coverUrl}"` : '';

      return `<span class="intext-source-pill" tabindex="0"
        data-type="${typeClass}"
        data-title="${this.escapeHtml(displayTitle)}"
        data-author="${this.escapeHtml(author)}"
        data-label="${typeLabel}"
        data-preview="${preview}"
        ${coverData}
      >${this.ICONS.book}</span>`;
    });

    // 3. Détection universelle de toutes les références bibliques résiduelles dans le texte
    res = this.linkifyScriptureInText(res);

    return res;
  },

  // =========================================================================
  // DÉTECTION UNIVERSELLE DES RÉFÉRENCES BIBLIQUES (Sans icône, pur texte)
  // =========================================================================

  linkifyScriptureInText(text) {
    const bookNames = [
      // Noms complets avec et sans accents
      'Genèse', 'Genese', 'Exode', 'Lévitique', 'Levitique', 'Nombres', 'Deutéronome', 'Deuteronome',
      'Josué', 'Josue', 'Juges', 'Ruth', '1 Samuel', '2 Samuel', '1 Rois', '2 Rois',
      '1 Chroniques', '2 Chroniques', 'Esdras', 'Néhémie', 'Nehemie', 'Esther', 'Job', 'Psaumes', 'Psaume',
      'Proverbes', 'Ecclésiaste', 'Ecclesiaste', 'Cantique des Cantiques', 'Cantique', 'Ésaïe', 'Esaie', 'Isaïe', 'Isaie',
      'Jérémie', 'Jeremie', 'Lamentations', 'Ézéchiel', 'Ezechiel', 'Daniel', 'Osée', 'Osee', 'Joël', 'Joel',
      'Amos', 'Abdias', 'Jonas', 'Michée', 'Michee', 'Nahum', 'Habacuc', 'Sophonie', 'Aggée', 'Aggee',
      'Zacharie', 'Malachie',
      'Matthieu', 'Marc', 'Luc', 'Jean', 'Actes', 'Romains', '1 Corinthiens', '2 Corinthiens',
      'Galates', 'Éphésiens', 'Ephesiens', 'Philippiens', 'Colossiens', '1 Thessaloniciens', '2 Thessaloniciens',
      '1 Timothée', '2 Timothée', '1 Timothee', '2 Timothee', 'Tite', 'Philémon', 'Philemon',
      'Hébreux', 'Hebreux', 'Jacques', '1 Pierre', '2 Pierre', '1 Jean', '2 Jean', '3 Jean',
      'Jude', 'Apocalypse',
      // Formes abrégées avec chiffres
      '1Sam', '2Sam', '1Rois', '2Rois', '1Chr', '2Chr', '1Cor', '2Cor', '1Thess', '2Thess',
      '1Thes', '2Thes', '1Th', '2Th', '1Tim', '2Tim', '1Tm', '2Tm', '1Pier', '2Pier', '1Pi', '2Pi', '1P', '2P',
      '1Jn', '2Jn', '3Jn', '1S', '2S', '1R', '2R', '1Ch', '2Ch', '1Co', '2Co',
      // Abréviations simples (AT & NT)
      'Gen', 'Gn', 'Ge', 'Exod', 'Exo', 'Ex', 'Lév', 'Lev', 'Lv', 'Nomb', 'Numb', 'Num', 'Nom', 'Nb', 'Deut', 'Dtn', 'Dt',
      'Josh', 'Jos', 'Judg', 'Jug', 'Jdg', 'Jg', 'Rut', 'Rth', 'Rt', 'Ezr', 'Esd', 'Néhem', 'Nehem', 'Néh', 'Neh', 'Né', 'Ne', 'Esth', 'Est',
      'Jb', 'Psa', 'Psm', 'Pss', 'Ps', 'Prov', 'Prv', 'Pr', 'Eccl', 'Ecc', 'Qoh', 'Ec', 'Cant', 'Ct',
      'Ésa', 'Esa', 'Isa', 'És', 'Es', 'Is', 'Jér', 'Jer', 'Jr', 'Lam', 'Lm', 'Ézéch', 'Ezech', 'Ezek', 'Ézé', 'Eze', 'Éz', 'Ez',
      'Dan', 'Da', 'Osé', 'Ose', 'Hos', 'Os', 'Joë', 'Joe', 'Jl', 'Amo', 'Am',
      'Obad', 'Abd', 'Oba', 'Ab', 'Jonah', 'Jon', 'Mich', 'Mic', 'Mi', 'Nah', 'Na', 'Habak', 'Hab', 'Ha', 'Hb',
      'Zeph', 'Soph', 'Zep', 'So', 'Hagg', 'Agg', 'Hag', 'Ag', 'Zech', 'Zach', 'Zec', 'Za', 'Mal', 'Ml',
      'Matt', 'Mat', 'Mt', 'Marc', 'Mark', 'Mar', 'Mc', 'Mk', 'Luk', 'Luc', 'Lc', 'Lk', 'Joh', 'Jn',
      'Acts', 'Act', 'Ac', 'Rom', 'Rm', 'Ro', 'Galat', 'Gal', 'Ga', 'Éphés', 'Ephes', 'Éph', 'Eph',
      'Philip', 'Phil', 'Php', 'Phi', 'Ph', 'Coloss', 'Col', 'Tit', 'Tt', 'Philem', 'Philém', 'Phm', 'Phl',
      'Hébr', 'Hebr', 'Héb', 'Heb', 'Jacq', 'Jam', 'Jac', 'Jas', 'Jc', 'Jud', 'Jd', 'Apoc', 'Rev', 'Apo', 'Ap'
    ];

    const bookPatternStr = bookNames.sort((a, b) => b.length - a.length).join('|');

    // 1. Détection des références bibliques entre crochets : [Jn 3], [Éph 2], [Hb 3-4], [1 Corinthiens 10:1-13], [Jn 3:16]
    const bracketScriptureRegex = new RegExp(
      `\\[((?:${bookPatternStr})\\.?)\\s*([0-9]{1,3})(?:\\s*[:.,]\\s*([0-9]{1,3}(?:\\s*[-–—\\u2013\\u2014]\\s*[0-9]{1,3})?)|\\s*[-–—\\u2013\\u2014]\\s*([0-9]{1,3}))?((?:\\s*[,;]\\s*[0-9]{1,3}(?:\\s*[:.,]\\s*[0-9]{1,3}(?:\\s*[-–—\\u2013\\u2014]\\s*[0-9]{1,3})?)?(?!\\s*[a-zA-ZÀ-ÿ]))*)\\]`,
      'gi'
    );

    text = text.replace(bracketScriptureRegex, (fullMatch, book, ch, vs, chRange, chained) => {
      const cleanBook = book.replace(/\.$/, '').trim();
      let label = `${book} ${ch}`;
      let firstRef = `${cleanBook} ${ch}:1`;
      if (vs) {
        const cleanVs = vs.replace(/[\u2013\u2014\u2212\u2010\u2011\u2012\u2015]/g, '-').replace(/\s+/g, '');
        firstRef = `${cleanBook} ${ch}:${cleanVs}`;
        label = `${book} ${ch}:${vs}`;
      } else if (chRange) {
        label = `${book} ${ch}-${chRange}`;
        firstRef = `${cleanBook} ${ch}:1`;
      }

      let result = `<button class="theol-inline-scripture-ref intext-source-badge scripture" data-ref="${this.escapeHtml(firstRef)}"><span class="badge-text">${label}</span></button>`;

      if (chained) {
        const subRegex = /([,;]\s*)([0-9]{1,3}(?:\s*[:.,]\s*[0-9]{1,3}(?:\s*[-–—\u2013\\u2014]\s*[0-9]{1,3})?)?)/g;
        const formattedChained = chained.replace(subRegex, (m, sep, subCv) => {
          const parts = subCv.split(/[:.,]/);
          const subCh = parts[0].trim();
          const subVs = parts[1] ? parts[1].replace(/[\u2013\u2014\u2212\u2010\u2011\u2012\u2015]/g, '-').replace(/\s+/g, '') : '';
          const subRef = subVs ? `${cleanBook} ${subCh}:${subVs}` : `${cleanBook} ${ch}:${subCh}`;
          return `${sep}<button class="theol-inline-scripture-ref intext-source-badge scripture" data-ref="${this.escapeHtml(subRef)}"><span class="badge-text">${subCv}</span></button>`;
        });
        result += formattedChained;
      }
      return result;
    });

    // 2. Détection des références bibliques libres (avec verset ou plage)
    const freeScriptureRegex = new RegExp(
      `(?<=^|[\\s\\(\\{;,-])((?:${bookPatternStr})\\.?)\\s*([0-9]{1,3})\\s*[:.,]\\s*([0-9]{1,3}(?:\\s*[-–—\\u2013\\u2014]\\s*[0-9]{1,3})?)((?:\\s*[,;]\\s*[0-9]{1,3}(?:\\s*[:.,]\\s*[0-9]{1,3}(?:\\s*[-–—\\u2013\\u2014]\\s*[0-9]{1,3})?)?(?!\\s*[a-zA-ZÀ-ÿ]))*)`,
      'gi'
    );

    text = text.replace(freeScriptureRegex, (fullMatch, book, ch, vs, chained) => {
      const cleanBook = book.replace(/\.$/, '').trim();
      const cleanVs = vs.replace(/[\u2013\u2014\u2212\u2010\u2011\u2012\u2015]/g, '-').replace(/\s+/g, '');
      const firstRef = `${cleanBook} ${ch}:${cleanVs}`;
      let result = `<button class="theol-inline-scripture-ref intext-source-badge scripture" data-ref="${this.escapeHtml(firstRef)}"><span class="badge-text">${book} ${ch}:${vs}</span></button>`;

      if (chained) {
        const subRegex = /([,;]\s*)([0-9]{1,3}(?:\s*[:.,]\s*[0-9]{1,3}(?:\s*[-–—\u2013\\u2014]\s*[0-9]{1,3})?)?)/g;
        const formattedChained = chained.replace(subRegex, (m, sep, subCv) => {
          const parts = subCv.split(/[:.,]/);
          const subCh = parts[0].trim();
          const subVs = parts[1] ? parts[1].replace(/[\u2013\u2014\u2212\u2010\u2011\u2012\u2015]/g, '-').replace(/\s+/g, '') : '';
          const subRef = subVs ? `${cleanBook} ${subCh}:${subVs}` : `${cleanBook} ${ch}:${subCh}`;
          return `${sep}<button class="theol-inline-scripture-ref intext-source-badge scripture" data-ref="${this.escapeHtml(subRef)}"><span class="badge-text">${subCv}</span></button>`;
        });
        result += formattedChained;
      }

      return result;
    });

    return text;
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
          App.showToast('Étude copiée dans le presse-papier.');
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
          App.showToast(`Étude enregistrée dans vos Notes : « ${noteTitle} »`);
        }
        if (typeof NotesView !== 'undefined' && NotesView.loadNotes) {
          NotesView.loadNotes();
        }
      } catch (e) {
        alert(`Erreur enregistrement note : ${e}`);
      }
    });

    // 2.5 Bouton Épingler Conclusion
    const pinConclusionBtn = messageEl.querySelector('.btn-pin-conclusion');
    pinConclusionBtn?.addEventListener('click', async () => {
      try {
        const result = await API.call('pin_ai_conclusion', this.currentSessionId, rawAnswer);
        if (result && result.success) {
          pinConclusionBtn.classList.add('saved');
          const lbl = pinConclusionBtn.querySelector('span');
          if(lbl) lbl.textContent = 'Épinglé';
          if (typeof App !== 'undefined' && App.showToast) {
            App.showToast('Conclusion mémorisée pour les prochaines études !');
          }
        }
      } catch (e) {
        console.error("Erreur pin conclusion", e);
      }
    });

    // 3. Liaison de l'infobulle biblique (ScriptureTooltip) & navigation
    if (typeof ScriptureTooltip !== 'undefined') {
      ScriptureTooltip.bindToElements(messageEl.querySelectorAll('.theol-inline-scripture-ref'));
    }

    messageEl.querySelectorAll('.theol-inline-scripture-ref').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const ref = btn.getAttribute('data-ref') || btn.textContent.trim();
        if (ref && typeof BibleReader !== 'undefined') {
          if (typeof ScriptureTooltip !== 'undefined') ScriptureTooltip.hide();
          if (typeof App !== 'undefined') App.switchView('bible');
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
