/**
 * AI Study View Controller
 * Gère l'assistant d'étude en mode plein écran (exégèse approfondie, préparation de sermon, etc.).
 */

const AIStudyView = {
  chatFlowEl: null,
  inputEl: null,
  passageRefEl: null,
  modeSelectEl: null,
  btnSendEl: null,

  MODES_INFO: {
    exegesis: {
      icon: '🔍',
      title: 'Exégèse approfondie',
      desc: 'Analyse structurelle et théologique verset par verset, syntaxe, chiasmes et cohérence biblique.',
      placeholder: "Ex: Analyse la structure de ce passage, les articulations syntaxiques et la portée théologique..."
    },
    historical: {
      icon: '🏛️',
      title: 'Contexte historique & culturel',
      desc: 'Arrière-plan historique, auteur, destinataires, coutumes du Proche-Orient / gréco-romaines et géographie.',
      placeholder: "Ex: Quel est le contexte politique, culturel et historique de la rédaction de ce texte ?"
    },
    sermon: {
      icon: '🎙️',
      title: 'Préparation de prédication / Message',
      desc: 'Plan homilétique complet avec idée maîtresse (Big Idea), 3 points de développement et applications concrètes.',
      placeholder: "Ex: Propose un plan de prédication percutant en 3 points avec illustrations et applications pour l'Église..."
    },
    lexical: {
      icon: '🔤',
      title: 'Analyse lexicale (Grec & Hébreu)',
      desc: 'Étude des racines hébraïques/grecques, codes Strong, nuances morphologiques et sens dans la Septante (LXX).',
      placeholder: "Ex: Analyse les termes clés en hébreu/grec dans ce verset, leurs racines et leurs nuances théologiques..."
    }
  },

  init() {
    this.chatFlowEl = document.getElementById('ai-study-chat-flow');
    this.inputEl = document.getElementById('ai-study-input');
    this.passageRefEl = document.getElementById('ai-passage-ref');
    this.modeSelectEl = document.getElementById('ai-study-mode');
    this.btnSendEl = document.getElementById('btn-send-study-ai');

    const btnInfo = document.getElementById('btn-ai-mode-info');
    const popover = document.getElementById('ai-mode-popover');
    const btnClose = document.getElementById('btn-close-ai-mode-info');

    const btnToggleOptions = document.getElementById('btn-toggle-ai-options');
    const optionsPanel = document.getElementById('ai-study-options-panel');
    const btnCloseOptions = document.getElementById('btn-close-ai-options');

    // Gestion de l'infobulle explicative
    btnInfo?.addEventListener('click', (e) => {
      e.stopPropagation();
      popover?.classList.toggle('hidden');
      optionsPanel?.classList.add('hidden');
    });

    btnClose?.addEventListener('click', () => {
      popover?.classList.add('hidden');
    });

    // Gestion du panneau des options RAG
    btnToggleOptions?.addEventListener('click', (e) => {
      e.stopPropagation();
      optionsPanel?.classList.toggle('hidden');
      popover?.classList.add('hidden');
    });

    btnCloseOptions?.addEventListener('click', () => {
      optionsPanel?.classList.add('hidden');
    });

    document.addEventListener('click', (e) => {
      if (popover && !popover.contains(e.target) && e.target !== btnInfo) {
        popover.classList.add('hidden');
      }
    });

    // Écouteurs sur les cases à cocher des sources pour mettre à jour les badges
    ['ai-opt-src-bibles', 'ai-opt-src-comms', 'ai-opt-src-dict', 'ai-opt-src-notes', 'ai-opt-reranking', 'ai-opt-curator'].forEach(id => {
      document.getElementById(id)?.addEventListener('change', () => {
        this.updateSourcesBadge();
      });
    });

    // Mise à jour dynamique du bandeau et du placeholder lors du changement de mode
    this.modeSelectEl?.addEventListener('change', () => {
      this.updateModeBanner();
    });

    this.btnSendEl?.addEventListener('click', () => this.sendMessage());
    this.inputEl?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    this.updateModeBanner();
    this.updateSourcesBadge();
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

  updateSourcesBadge() {
    const opts = this.getOptions();
    let count = 0;
    const activeNames = [];
    if (opts.sources.bibles) { count++; activeNames.push('Bibles'); }
    if (opts.sources.commentaries) { count++; activeNames.push('Commentaires'); }
    if (opts.sources.dictionaries) { count++; activeNames.push('Dictionnaires'); }
    if (opts.sources.notes) { count++; activeNames.push('Notes'); }

    const badgeCount = document.getElementById('ai-opt-badge-count');
    if (badgeCount) badgeCount.textContent = count;

    const chipsEl = document.getElementById('ai-mode-sources-chips');
    if (chipsEl) {
      let extra = [];
      if (opts.enable_reranking) extra.push('Rerank BGE');
      if (opts.enable_curator) extra.push('Curateur LLM');
      const extraStr = extra.length > 0 ? ` | 🔬 ${extra.join(', ')}` : '';
      chipsEl.innerHTML = `<span>📚 Sources : ${activeNames.join(', ') || 'Aucune'}${extraStr}</span>`;
    }
  },

  updateModeBanner() {
    const modeKey = this.modeSelectEl?.value || 'exegesis';
    const info = this.MODES_INFO[modeKey] || this.MODES_INFO.exegesis;

    const iconEl = document.getElementById('ai-mode-desc-icon');
    const textEl = document.getElementById('ai-mode-desc-text');

    if (iconEl) iconEl.textContent = info.icon;
    if (textEl) textEl.innerHTML = `<strong>${info.title} :</strong> ${info.desc}`;
    if (this.inputEl) this.inputEl.placeholder = info.placeholder;

    this.updateSourcesBadge();
  },

  async sendMessage() {
    const text = this.inputEl.value.trim();
    if (!text) return;

    const mode = this.modeSelectEl.value;
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
        <em>Génération de l'étude avec <strong>${options.model}</strong> (${options.enable_reranking ? 'Reranking CPU actif' : 'RAG standard'})...</em>
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
