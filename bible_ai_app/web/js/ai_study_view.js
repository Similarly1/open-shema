/**
 * AI Study View Controller
 * Gère l'assistant d'étude en mode plein écran (exégèse approfondie, préparation de sermon, etc.)
 * Interface unifiée, sobre et épurée.
 */

const AIStudyView = {
  chatFlowEl: null,
  inputEl: null,
  passageRefEl: null,
  btnSendEl: null,
  currentMode: 'exegesis',

  MODES_INFO: {
    exegesis: {
      icon: '🔍',
      title: 'Exégèse approfondie',
      shortTitle: 'Exégèse',
      sourcesSummary: 'Bibles originales, Commentaires, Strong, Notes',
      desc: 'Analyse structurelle et théologique verset par verset, chiasmes, syntaxe et cohérence canonique.',
      placeholder: "Ex: Analyse la structure de ce passage, les articulations syntaxiques et la portée théologique..."
    },
    historical: {
      icon: '🏛️',
      title: 'Contexte historique & culturel',
      shortTitle: 'Histoire & Contexte',
      sourcesSummary: 'Dictionnaires (Dom Calmet, Vigouroux...), Archéologie, Notes',
      desc: 'Arrière-plan historique, auteur, destinataires, coutumes du Proche-Orient / gréco-romaines et géographie.',
      placeholder: "Ex: Quel est le contexte politique, culturel et historique de la rédaction de ce texte ?"
    },
    sermon: {
      icon: '🎙️',
      title: 'Préparation de prédication / Message',
      shortTitle: 'Prédication',
      sourcesSummary: 'Commentaires pastoraux, TSK, Illustrations, Notes',
      desc: 'Plan homilétique complet avec idée maîtresse (Big Idea), 3 points de développement et applications concrètes.',
      placeholder: "Ex: Propose un plan de prédication percutant en 3 points avec illustrations et applications pour l'Église..."
    },
    lexical: {
      icon: '🔤',
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
    this.passageRefEl = document.getElementById('ai-passage-ref');
    this.btnSendEl = document.getElementById('btn-send-study-ai');

    const btnModeSelector = document.getElementById('btn-study-mode-selector');
    const modePopover = document.getElementById('ai-mode-dropdown-popover');
    const btnCloseModePopover = document.getElementById('btn-close-mode-popover');

    const btnToggleOptions = document.getElementById('btn-toggle-ai-options');
    const btnPopoverOptions = document.getElementById('btn-popover-open-options');
    const optionsPanel = document.getElementById('ai-study-options-panel');
    const btnCloseOptions = document.getElementById('btn-close-ai-options');

    // Ouverture/fermeture du menu des modes
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

    // Ouverture du panneau des options RAG
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

    // Envoi de message
    this.btnSendEl?.addEventListener('click', () => this.sendMessage());
    this.inputEl?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    this.setMode('exegesis');
  },

  setMode(modeKey) {
    if (!this.MODES_INFO[modeKey]) return;
    this.currentMode = modeKey;
    const info = this.MODES_INFO[modeKey];

    // Mise à jour de l'affichage du bouton pill
    const pillIcon = document.getElementById('study-mode-pill-icon');
    const pillLabel = document.getElementById('study-mode-pill-label');
    if (pillIcon) pillIcon.textContent = info.icon;
    if (pillLabel) pillLabel.textContent = info.title;

    // Mise à jour du sous-titre de l'en-tête (sobre et discret)
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

  async sendMessage() {
    const text = this.inputEl.value.trim();
    if (!text) return;

    const mode = this.currentMode || 'exegesis';
    const passage = this.passageRefEl.value.trim() || `${BibleReader.currentBook} ${BibleReader.currentChapter}`;
    const options = this.getOptions();

    // Afficher message utilisateur
    const userMsg = document.createElement('div');
    userMsg.className = 'chat-message user';
    userMsg.innerHTML = `<div class="msg-content"><strong>[${passage}]</strong> ${text}</div>`;
    this.chatFlowEl.appendChild(userMsg);
    this.inputEl.value = '';
    this.chatFlowEl.scrollTop = this.chatFlowEl.scrollHeight;

    // Message assistant
    const assistantMsg = document.createElement('div');
    assistantMsg.className = 'chat-message assistant';
    assistantMsg.innerHTML = `
      <div class="msg-avatar">🤖</div>
      <div class="msg-content">
        <em>Génération de l'étude avec <strong>${options.model}</strong> (${options.enable_reranking ? 'Reranking BGE actif' : 'RAG standard'})...</em>
      </div>
    `;
    this.chatFlowEl.appendChild(assistantMsg);
    this.chatFlowEl.scrollTop = this.chatFlowEl.scrollHeight;

    try {
      const response = await API.call('ask_study_ai', text, mode, passage, options);
      const answerText = response.answer || response;
      const sourcesUsed = response.sources_used || [];

      const formatted = answerText
        .replace(/### (.*)/g, '<h3 style="margin: 12px 0 6px 0; color: var(--accent-blue); font-size: 15px;">$1</h3>')
        .replace(/## (.*)/g, '<h2 style="margin: 14px 0 8px 0; color: var(--accent-blue); font-size: 17px;">$1</h2>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n\n/g, '<br><br>');

      let sourcesBadgeHtml = '';
      if (sourcesUsed && sourcesUsed.length > 0) {
        sourcesBadgeHtml = `
          <div style="margin-top: 14px; padding-top: 10px; border-top: 1px dashed var(--border-color); font-size: 11px; color: var(--text-secondary); display: flex; flex-wrap: wrap; align-items: center; gap: 6px;">
            <span style="font-weight: 700; color: var(--accent-blue);">📚 Corpus exploité :</span>
            ${sourcesUsed.map(s => `<span style="background: var(--bg-subtle); border: 1px solid var(--border-color); border-radius: 4px; padding: 2px 6px;">${s}</span>`).join('')}
            <span style="opacity: 0.7; margin-left: auto;">Modèle: ${options.model}</span>
          </div>
        `;
      }

      assistantMsg.querySelector('.msg-content').innerHTML = formatted + sourcesBadgeHtml;
    } catch (e) {
      assistantMsg.querySelector('.msg-content').textContent = "Une erreur est survenue lors de l'appel à l'assistant IA.";
    }
    this.chatFlowEl.scrollTop = this.chatFlowEl.scrollHeight;
  }
};
