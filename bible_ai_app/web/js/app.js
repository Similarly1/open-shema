/**
 * Main Application Orchestrator
 * Gère les onglets, la barre latérale, le chat IA et les raccourcis clavier.
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialiser le lecteur biblique
  BibleReader.init();

  // 2. Navigation Sidebar
  document.querySelectorAll('.sidebar-menu .nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sidebar-menu .nav-item').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const target = btn.dataset.nav;
      console.log('Navigation vers :', target);
    });
  });

  // 3. Onglets du panneau droit (Commentaires / IA / Lexique)
  document.querySelectorAll('.drawer-tab').forEach(tabBtn => {
    tabBtn.addEventListener('click', () => {
      document.querySelectorAll('.drawer-tab').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.drawer-content').forEach(c => c.classList.remove('active'));

      tabBtn.classList.add('active');
      const tabId = tabBtn.dataset.drawerTab;
      const contentEl = document.getElementById(`drawer-tab-${tabId}`);
      if (contentEl) {
        contentEl.classList.add('active');
      }
    });
  });

  // 4. Chat Assistant IA
  const chatInput = document.getElementById('chat-input');
  const btnSendChat = document.getElementById('btn-send-chat');
  const chatMessages = document.getElementById('chat-messages');

  const sendChatMessage = async () => {
    const text = chatInput.value.trim();
    if (!text) return;

    // Afficher message utilisateur
    const userMsg = document.createElement('div');
    userMsg.className = 'chat-message user';
    userMsg.innerHTML = `<div class="msg-content">${text}</div>`;
    chatMessages.appendChild(userMsg);
    chatInput.value = '';
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // Réponse assistant (chargement)
    const assistantMsg = document.createElement('div');
    assistantMsg.className = 'chat-message assistant';
    assistantMsg.innerHTML = `
      <div class="msg-avatar">🤖</div>
      <div class="msg-content">Réflexion en cours...</div>
    `;
    chatMessages.appendChild(assistantMsg);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    try {
      const response = await API.askAI(
        text,
        BibleReader.currentBook,
        BibleReader.currentChapter,
        BibleReader.selectedVerse || 1
      );
      assistantMsg.querySelector('.msg-content').textContent = response.answer || response;
    } catch (err) {
      assistantMsg.querySelector('.msg-content').textContent = "Désolé, une erreur est survenue lors de l'appel à l'assistant IA.";
    }
    chatMessages.scrollTop = chatMessages.scrollHeight;
  };

  btnSendChat.addEventListener('click', sendChatMessage);
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  });

  // 5. Raccourcis clavier globaux
  window.addEventListener('keydown', (e) => {
    // Ctrl+F : focus passage rapide
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      document.getElementById('quick-passage-input').focus();
    }
    // Alt + Gauche / Droite : Navigation chapitres
    if (e.altKey && e.key === 'ArrowLeft') {
      document.getElementById('btn-history-back').click();
    }
    if (e.altKey && e.key === 'ArrowRight') {
      document.getElementById('btn-history-forward').click();
    }
  });
});
