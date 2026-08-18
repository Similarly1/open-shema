/**
 * Main Application Orchestrator
 * Gère les vues principales (Bible, Bibliothèque, Paramètres), les onglets, la barre latérale, le chat IA et les toasts.
 */

const App = {
  activeView: 'bible',

  init() {
    // 1. Initialiser tous les sous-systèmes de manière résiliente
    const modules = [
      { name: 'BibleReader', init: () => BibleReader.init() },
      { name: 'ImportModal', init: () => ImportModal.init() },
      { name: 'LibraryView', init: () => LibraryView.init() },
      { name: 'SettingsView', init: () => SettingsView.init() },
      { name: 'SearchView', init: () => SearchView.init() },
      { name: 'AIStudyView', init: () => AIStudyView.init() },
      { name: 'NotesView', init: () => NotesView.init() },
      { name: 'DictView', init: () => DictView.init() }
    ];

    modules.forEach(m => {
      try {
        m.init();
      } catch (err) {
        console.error(`Erreur d'initialisation du module [${m.name}]:`, err);
      }
    });

    // 2. Navigation latérale (Changement de vue)
    document.querySelectorAll('.sidebar-menu .nav-item, .sidebar-footer .nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const viewId = btn.dataset.view;
        if (!viewId) return;

        document.querySelectorAll('.sidebar-menu .nav-item, .sidebar-footer .nav-item').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        this.switchView(viewId);
      });
    });

    // Raccourcis accès rapides
    document.getElementById('quick-commentary')?.addEventListener('click', () => {
      this.switchView('bible');
      const drawer = document.getElementById('right-drawer');
      drawer.classList.remove('collapsed');
      document.querySelector('.drawer-tab[data-drawer-tab="commentaries"]')?.click();
    });

    document.getElementById('quick-compare')?.addEventListener('click', () => {
      this.switchView('bible');
      BibleReader.toggleSplitView(true);
    });

    document.getElementById('quick-dict')?.addEventListener('click', () => {
      this.switchView('dict');
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
    this.bindChat();

    // 5. Raccourcis clavier globaux
    this.bindKeyboardShortcuts();

    // 6. Masquage fluide du Splash Loader dès que l'API est initialisée (avec timeout de sécurité)
    API.onReady(() => {
      setTimeout(() => {
        this.hideSplash();
      }, 500);
    });

    // Sécurité absolue : quoi qu'il arrive, enlever le splash après 1.5s max
    setTimeout(() => {
      this.hideSplash();
    }, 1500);
  },

  hideSplash() {
    const splash = document.getElementById('app-splash-loader');
    if (splash && !splash.classList.contains('fade-out')) {
      splash.classList.add('fade-out');
      setTimeout(() => {
        splash.style.display = 'none';
      }, 400);
    }
  },

  switchView(viewName) {
    this.activeView = viewName;
    document.querySelectorAll('.app-view').forEach(v => v.classList.remove('active'));

    const targetEl = document.getElementById(`view-${viewName}`);
    if (targetEl) {
      targetEl.classList.add('active');
    }

    const drawerEl = document.getElementById('right-drawer');

    if (viewName === 'library') {
      if (drawerEl) drawerEl.classList.add('collapsed');
      LibraryView.loadBooks();
    } else if (viewName === 'settings') {
      if (drawerEl) drawerEl.classList.add('collapsed');
      SettingsView.loadData();
    } else if (viewName === 'notes') {
      if (drawerEl) drawerEl.classList.add('collapsed');
      NotesView.loadNotes();
    } else if (viewName === 'search' || viewName === 'ai' || viewName === 'dict') {
      if (drawerEl) drawerEl.classList.add('collapsed');
    }
  },

  showToast(message, duration = 3000) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.remove('hidden');
    toast.classList.add('visible');

    if (this._toastTimer) clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => toast.classList.add('hidden'), 300);
    }, duration);
  },

  bindChat() {
    const chatInput = document.getElementById('chat-input');
    const btnSendChat = document.getElementById('btn-send-chat');
    const chatMessages = document.getElementById('chat-messages');

    const sendChatMessage = async () => {
      const text = chatInput.value.trim();
      if (!text) return;

      const userMsg = document.createElement('div');
      userMsg.className = 'chat-message user';
      userMsg.innerHTML = `<div class="msg-content">${text}</div>`;
      chatMessages.appendChild(userMsg);
      chatInput.value = '';
      chatMessages.scrollTop = chatMessages.scrollHeight;

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
  },

  bindKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      const tag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      const isInput = tag === 'input' || tag === 'textarea' || tag === 'select' || (document.activeElement && document.activeElement.isContentEditable);
      
      // Ne pas intercepter si l'utilisateur saisit du texte
      if (isInput) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        document.getElementById('quick-passage-input')?.focus();
        return;
      }

      // Raccourcis navigation en mode Bible
      if (this.activeView === 'bible') {
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          BibleReader.goToNextChapter();
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          BibleReader.goToPrevChapter();
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          BibleReader.selectNextVerse();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          BibleReader.selectPrevVerse();
        }
      }
    });
  }
};

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
