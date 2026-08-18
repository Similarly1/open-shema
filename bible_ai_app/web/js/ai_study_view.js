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

    // Gestion de l'infobulle explicative
    btnInfo?.addEventListener('click', (e) => {
      e.stopPropagation();
      popover?.classList.toggle('hidden');
    });

    btnClose?.addEventListener('click', () => {
      popover?.classList.add('hidden');
    });

    document.addEventListener('click', (e) => {
      if (popover && !popover.contains(e.target) && e.target !== btnInfo) {
        popover.classList.add('hidden');
      }
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
  },

  updateModeBanner() {
    const modeKey = this.modeSelectEl?.value || 'exegesis';
    const info = this.MODES_INFO[modeKey] || this.MODES_INFO.exegesis;

    const iconEl = document.getElementById('ai-mode-desc-icon');
    const textEl = document.getElementById('ai-mode-desc-text');

    if (iconEl) iconEl.textContent = info.icon;
    if (textEl) textEl.innerHTML = `<strong>${info.title} :</strong> ${info.desc}`;
    if (this.inputEl) this.inputEl.placeholder = info.placeholder;
  },

  async sendMessage() {
    const text = this.inputEl.value.trim();
    if (!text) return;

    const mode = this.modeSelectEl.value;
    const passage = this.passageRefEl.value.trim() || `${BibleReader.currentBook} ${BibleReader.currentChapter}`;

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
      <div class="msg-content">Génération de l'étude exégétique en cours...</div>
    `;
    this.chatFlowEl.appendChild(assistantMsg);
    this.chatFlowEl.scrollTop = this.chatFlowEl.scrollHeight;

    try {
      const response = await API.call('ask_study_ai', text, mode, passage);
      const formatted = (response.answer || response)
        .replace(/### (.*)/g, '<h3 style="margin: 8px 0; color: var(--accent-blue);">$1</h3>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n\n/g, '<br><br>');

      assistantMsg.querySelector('.msg-content').innerHTML = formatted;
    } catch (e) {
      assistantMsg.querySelector('.msg-content').textContent = "Une erreur est survenue lors de l'appel à l'assistant IA.";
    }
    this.chatFlowEl.scrollTop = this.chatFlowEl.scrollHeight;
  }
};
