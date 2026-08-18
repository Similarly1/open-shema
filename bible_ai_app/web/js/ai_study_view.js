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

  init() {
    this.chatFlowEl = document.getElementById('ai-study-chat-flow');
    this.inputEl = document.getElementById('ai-study-input');
    this.passageRefEl = document.getElementById('ai-passage-ref');
    this.modeSelectEl = document.getElementById('ai-study-mode');
    this.btnSendEl = document.getElementById('btn-send-study-ai');

    this.btnSendEl.addEventListener('click', () => this.sendMessage());
    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });
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
