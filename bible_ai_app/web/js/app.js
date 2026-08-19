/**
 * Main Application Orchestrator
 * Gère les vues principales (Bible, Bibliothèque, Paramètres), les onglets, la barre latérale, le chat IA et les toasts.
 */

const App = {
  activeView: 'bible',

  init() {
    // 0. Initialisation immédiate du thème et de la typographie
    this.initThemeAndFont();

    // 1. Initialiser tous les sous-systèmes de manière résiliente
    const modules = [
      { name: 'BibleReader', init: () => BibleReader.init() },
      { name: 'ImportModal', init: () => ImportModal.init() },
      { name: 'LibraryView', init: () => LibraryView.init() },
      { name: 'SettingsView', init: () => SettingsView.init() },
      { name: 'SearchView', init: () => SearchView.init() },
      { name: 'AIStudyView', init: () => AIStudyView.init() },
      { name: 'NotesView', init: () => NotesView.init() },
      { name: 'DictView', init: () => DictView.init() },
      { name: 'MapsView', init: () => MapsView.init() },
      { name: 'CommentariesView', init: () => CommentariesView.init() }
    ];

    modules.forEach(m => {
      try {
        m.init();
      } catch (err) {
        console.error(`Erreur d'initialisation du module [${m.name}]:`, err);
      }
    });

    // 2. Initialiser la gestion de la barre latérale pliable et du volet droit redimensionnable
    this.initSidebarAndDrawerLayout();

    // 2a. Initialiser le gestionnaire d'erreurs et modale de détails
    this.bindErrorHandling();

    // 2b. Navigation latérale (Changement de vue)
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
      document.querySelectorAll('.sidebar-menu .nav-item, .sidebar-footer .nav-item').forEach(b => b.classList.remove('active'));
      document.getElementById('nav-commentaries')?.classList.add('active');
      if (typeof CommentariesView !== 'undefined') {
        CommentariesView.openWithCurrentState();
      } else {
        this.switchView('commentaries');
      }
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

    // 5b. Contrôles de Fenêtre Personnalisés (Barre sans bordure Windows)
    document.getElementById('win-btn-min')?.addEventListener('click', (e) => {
      e.stopPropagation();
      API.call('minimize_window');
    });
    document.getElementById('win-btn-max')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      const res = await API.call('maximize_window');
      if (res && typeof res.is_maximized === 'boolean') {
        this.updateWindowState(res.is_maximized);
      }
    });
    document.getElementById('win-btn-fs')?.addEventListener('click', (e) => {
      e.stopPropagation();
      API.call('toggle_fullscreen');
    });
    document.getElementById('win-btn-close')?.addEventListener('click', (e) => {
      e.stopPropagation();
      API.call('close_window');
    });

    // Double clic sur la barre de titre pour Agrandir / Restaurer
    const titlebar = document.getElementById('app-window-titlebar');
    titlebar?.addEventListener('dblclick', async (e) => {
      if (e.target.closest('button, .win-control-btn')) return;
      const res = await API.call('maximize_window');
      if (res && typeof res.is_maximized === 'boolean') {
        this.updateWindowState(res.is_maximized);
      }
    });

    // Capture mousedown sur la barre de titre : bloquer tout déplacement par glisser si la fenêtre est agrandie
    titlebar?.addEventListener('mousedown', (e) => {
      if (this.isWindowMaximized || document.body.classList.contains('window-maximized')) {
        if (!e.target.closest('button, .win-control-btn')) {
          e.stopPropagation();
        }
      }
    }, true);

    // Initialiser l'état d'agrandissement de la fenêtre auprès du backend
    API.onReady(async () => {
      try {
        const state = await API.call('get_window_state');
        if (state && typeof state.is_maximized === 'boolean') {
          this.updateWindowState(state.is_maximized);
        }
      } catch (e) {}
    });

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

  initThemeAndFont() {
    API.onReady(async () => {
      try {
        const cfg = await API.getSettings();
        if (cfg) {
          this.applyTheme(cfg.theme || 'dark', cfg.theme_palette, cfg.reading_bg);
          if (cfg.font_family) this.applyFontFamily(cfg.font_family);
          if (cfg.font_size) {
            document.documentElement.style.setProperty('--bible-font-size-base', `${cfg.font_size}px`);
          }
        }
      } catch (e) {
        console.warn('Impossible de charger les paramètres au démarrage:', e);
      }
    });

    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        const themeVal = document.getElementById('cfg-theme')?.value;
        const paletteVal = document.getElementById('cfg-theme-palette')?.value;
        const readingBgVal = document.getElementById('cfg-reading-bg')?.value;
        if (themeVal === 'system') {
          this.applyTheme('system', paletteVal, readingBgVal);
        }
      });
    }
  },

  applyTheme(theme, palette, readingBg) {
    const body = document.body;
    body.classList.remove('theme-light', 'theme-dark');
    body.classList.remove(
      'palette-dark-slate', 'palette-dark-oled', 'palette-dark-warm',
      'palette-light-clean', 'palette-light-warm', 'palette-light-nordic'
    );
    body.classList.remove('reading-bg-white', 'reading-bg-sepia', 'reading-bg-dark');

    let effective = theme || 'dark';
    if (effective === 'system') {
      effective = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
    }

    if (effective === 'dark') {
      body.classList.add('theme-dark');
    } else {
      body.classList.add('theme-light');
    }

    // Palette active
    if (palette) {
      body.classList.add(palette.startsWith('palette-') ? palette : `palette-${palette}`);
    } else {
      body.classList.add(effective === 'dark' ? 'palette-dark-slate' : 'palette-light-clean');
    }

    // Teinte indépendante du canevas de lecture
    if (readingBg && readingBg !== 'auto') {
      body.classList.add(`reading-bg-${readingBg}`);
    }
  },

  applyFontFamily(fontFamily) {
    if (!fontFamily) fontFamily = 'EB Garamond';
    let fontStack = `'${fontFamily}', serif`;
    if (fontFamily === 'Inter') {
      fontStack = `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
    } else if (fontFamily === 'Georgia') {
      fontStack = `Georgia, 'Times New Roman', serif`;
    } else {
      fontStack = `'${fontFamily}', 'EB Garamond', 'Lora', 'Georgia', serif`;
    }

    document.documentElement.style.setProperty('--font-bible', fontStack);
    const selectEl = document.getElementById('cfg-font-family');
    if (selectEl) {
      selectEl.style.fontFamily = fontStack;
    }
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
    } else if (viewName === 'maps') {
      if (drawerEl) drawerEl.classList.add('collapsed');
      MapsView.onViewActivated();
    } else if (viewName === 'commentaries') {
      if (drawerEl) drawerEl.classList.add('collapsed');
      if (typeof CommentariesView !== 'undefined') {
        // Si les commentaires n'ont pas encore été chargés ou si on veut s'assurer de l'alignement
        if (!CommentariesView.currentComments || CommentariesView.currentComments.length === 0) {
          CommentariesView.openWithCurrentState();
        }
      }
    } else if (viewName === 'search' || viewName === 'ai' || viewName === 'dict') {
      if (drawerEl) drawerEl.classList.add('collapsed');
    }
  },

  showToast(message, duration = 3000) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove('hidden');
    toast.classList.add('visible');

    if (this._toastTimer) clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => toast.classList.add('hidden'), 300);
    }, duration);
  },

  // Gestionnaire d'Avertissements & Erreurs avec Détails et Copie
  currentErrorDetails: null,

  bindErrorHandling() {
    document.getElementById('btn-error-toast-details')?.addEventListener('click', () => {
      this.showErrorModal();
    });

    document.getElementById('btn-error-toast-close')?.addEventListener('click', () => {
      this.hideErrorToast();
    });

    document.getElementById('btn-close-error-modal')?.addEventListener('click', () => {
      this.closeErrorModal();
    });

    document.getElementById('btn-dismiss-error-modal')?.addEventListener('click', () => {
      this.closeErrorModal();
    });

    document.getElementById('btn-copy-error')?.addEventListener('click', () => {
      this.copyErrorToClipboard();
    });

    // Capture des erreurs JS non gérées
    window.addEventListener('error', (event) => {
      // Ignorer les erreurs d'images 404 courantes pour ne pas polluer l'UI
      if (event.target && (event.target.tagName === 'IMG' || event.target.tagName === 'SCRIPT')) {
        return;
      }
      console.error('[Global JS Error]:', event.error || event.message);
      this.showError('Erreur Interface', event.message || 'Une exception non interceptée est survenue', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error ? event.error.stack : null
      });
    });

    // Capture des promesses asynchrones rejetées
    window.addEventListener('unhandledrejection', (event) => {
      console.error('[Unhandled Promise Rejection]:', event.reason);
      const reason = event.reason;
      const msg = (reason && reason.message) || String(reason);
      this.showError('Erreur Asynchrone', msg, {
        message: msg,
        stack: (reason && reason.stack) ? reason.stack : String(reason)
      });
    });
  },

  showError(title, shortMsg, fullDetails = null) {
    const errorToast = document.getElementById('error-toast');
    const titleEl = document.getElementById('error-toast-title');
    const msgEl = document.getElementById('error-toast-msg');

    if (!errorToast || !titleEl || !msgEl) return;

    titleEl.textContent = title || 'Erreur';
    msgEl.textContent = shortMsg || 'Une erreur inattendue est survenue.';

    this.currentErrorDetails = {
      title: title || 'Erreur',
      message: shortMsg || 'Une erreur inattendue est survenue.',
      details: fullDetails || shortMsg || 'Aucun détail technique supplémentaire disponible.',
      timestamp: new Date().toLocaleTimeString('fr-FR')
    };

    errorToast.classList.remove('hidden');
    requestAnimationFrame(() => {
      errorToast.classList.add('visible');
    });

    if (this._errorToastTimer) clearTimeout(this._errorToastTimer);
    this._errorToastTimer = setTimeout(() => {
      this.hideErrorToast();
    }, 7000);
  },

  hideErrorToast() {
    const errorToast = document.getElementById('error-toast');
    if (!errorToast) return;
    errorToast.classList.remove('visible');
    setTimeout(() => errorToast.classList.add('hidden'), 250);
  },

  showErrorModal() {
    if (!this.currentErrorDetails) return;
    const modal = document.getElementById('error-details-modal');
    const titleEl = document.getElementById('error-modal-title');
    const sumEl = document.getElementById('error-modal-summary');
    const stackEl = document.getElementById('error-modal-stack');

    if (!modal) return;

    if (titleEl) titleEl.textContent = `${this.currentErrorDetails.title} (${this.currentErrorDetails.timestamp})`;
    if (sumEl) sumEl.textContent = this.currentErrorDetails.message;
    if (stackEl) {
      stackEl.textContent = typeof this.currentErrorDetails.details === 'object'
        ? JSON.stringify(this.currentErrorDetails.details, null, 2)
        : String(this.currentErrorDetails.details);
    }

    modal.classList.remove('hidden');
  },

  closeErrorModal() {
    document.getElementById('error-details-modal')?.classList.add('hidden');
  },

  copyErrorToClipboard() {
    if (!this.currentErrorDetails) return;
    const formattedDetails = typeof this.currentErrorDetails.details === 'object'
      ? JSON.stringify(this.currentErrorDetails.details, null, 2)
      : String(this.currentErrorDetails.details);

    const textToCopy = `=== RAPPORT D'ERREUR OPEN SHEMA ===\nDate: ${new Date().toISOString()}\nTitre: ${this.currentErrorDetails.title}\nMessage: ${this.currentErrorDetails.message}\n\nDétails techniques:\n${formattedDetails}`;

    navigator.clipboard.writeText(textToCopy).then(() => {
      const btnText = document.getElementById('btn-copy-error-text');
      if (btnText) btnText.textContent = 'Copié !';
      setTimeout(() => {
        if (btnText) btnText.textContent = "Copier l'erreur";
      }, 2000);
    }).catch(err => {
      console.error('Erreur copie presse-papier:', err);
    });
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
        <div class="msg-avatar"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/></svg></div>
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

  sidebarAutoCollapsed: false,

  initSidebarAndDrawerLayout() {
    const sidebar = document.getElementById('sidebar');
    const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
    const drawer = document.getElementById('right-drawer');
    const resizer = document.getElementById('drawer-resizer');

    // 1. Restaurer la largeur personnalisée du volet droit
    try {
      const savedDrawerWidth = localStorage.getItem('bible_drawer_width');
      if (savedDrawerWidth) {
        const widthVal = parseInt(savedDrawerWidth, 10);
        if (widthVal >= 280 && widthVal <= 1000) {
          document.documentElement.style.setProperty('--drawer-width', `${widthVal}px`);
        }
      }
    } catch (e) {}

    // 2. Restaurer l'état plié/déplié de la barre latérale gauche
    try {
      const savedSidebarState = localStorage.getItem('bible_sidebar_collapsed');
      if (savedSidebarState === 'true') {
        this.setSidebarCollapsed(true, false);
      }
    } catch (e) {}

    // 3. Gestionnaire du bouton de bascule de la sidebar
    btnToggleSidebar?.addEventListener('click', (e) => {
      e.stopPropagation();
      const isCurrentlyCollapsed = sidebar?.classList.contains('collapsed');
      this.setSidebarCollapsed(!isCurrentlyCollapsed, false);
    });

    // 4. Redimensionnement fluide par glisser-déposer du volet droit
    if (resizer && drawer) {
      let isDragging = false;
      let startX = 0;
      let startWidth = 420;

      resizer.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        isDragging = true;
        startX = e.clientX;
        
        const styleWidth = getComputedStyle(document.documentElement).getPropertyValue('--drawer-width').trim();
        startWidth = parseInt(styleWidth, 10) || drawer.offsetWidth || 420;

        drawer.classList.add('resizing');
        resizer.classList.add('resizing');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';

        const onMouseMove = (moveEvent) => {
          if (!isDragging) return;
          const deltaX = startX - moveEvent.clientX;
          let newWidth = startWidth + deltaX;

          // Limiter la largeur entre 280px et (largeur écran - 320px)
          const minWidth = 280;
          const maxWidth = Math.max(minWidth, window.innerWidth - 320);
          newWidth = Math.min(Math.max(minWidth, newWidth), maxWidth);

          document.documentElement.style.setProperty('--drawer-width', `${newWidth}px`);

          // Vérifier si le texte biblique a assez de place pour une lecture confortable
          const sidebarWidth = sidebar && !sidebar.classList.contains('collapsed') ? 220 : 58;
          const remainingReaderWidth = window.innerWidth - newWidth - sidebarWidth;

          if (remainingReaderWidth < 540) {
            // Réduire automatiquement le menu gauche pour préserver la lisibilité du texte biblique
            this.setSidebarCollapsed(true, true);
          } else if (remainingReaderWidth >= 660 && this.sidebarAutoCollapsed) {
            // Rétablir le menu gauche s'il avait été réduit automatiquement
            this.setSidebarCollapsed(false, true);
          }
        };

        const onMouseUp = () => {
          if (!isDragging) return;
          isDragging = false;
          drawer.classList.remove('resizing');
          resizer.classList.remove('resizing');
          document.body.style.cursor = '';
          document.body.style.userSelect = '';

          window.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('mouseup', onMouseUp);

          const finalWidth = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--drawer-width').trim(), 10);
          if (finalWidth) {
            try {
              localStorage.setItem('bible_drawer_width', finalWidth);
            } catch (e) {}
          }
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
      });
    }

    // 5. Ajustement automatique lors du redimensionnement global de la fenêtre
    window.addEventListener('resize', () => {
      this.checkAutoSidebarCollapse();
    });
  },

  setSidebarCollapsed(collapsed, isAuto = false) {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    sidebar.classList.toggle('collapsed', collapsed);
    document.body.classList.toggle('sidebar-is-collapsed', collapsed);

    if (isAuto) {
      this.sidebarAutoCollapsed = collapsed;
    } else {
      this.sidebarAutoCollapsed = false;
      try {
        localStorage.setItem('bible_sidebar_collapsed', collapsed ? 'true' : 'false');
      } catch (e) {}
    }
  },

  checkAutoSidebarCollapse() {
    const drawer = document.getElementById('right-drawer');
    const isDrawerOpen = drawer && !drawer.classList.contains('collapsed');
    if (!isDrawerOpen) {
      if (this.sidebarAutoCollapsed) {
        this.setSidebarCollapsed(false, false);
      }
      return;
    }

    const drawerWidth = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--drawer-width').trim(), 10) || 420;
    const sidebar = document.getElementById('sidebar');
    const sidebarWidth = sidebar && !sidebar.classList.contains('collapsed') ? 220 : 58;
    const remainingReaderWidth = window.innerWidth - drawerWidth - sidebarWidth;

    if (remainingReaderWidth < 540) {
      this.setSidebarCollapsed(true, true);
    } else if (remainingReaderWidth >= 660 && this.sidebarAutoCollapsed) {
      this.setSidebarCollapsed(false, true);
    }
  },

  bindKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      const tag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      const isInput = tag === 'input' || tag === 'textarea' || tag === 'select' || (document.activeElement && document.activeElement.isContentEditable);
      
      // Ne pas intercepter si l'utilisateur saisit du texte
      if (isInput) return;

      if (e.key === 'F11') {
        e.preventDefault();
        API.call('maximize_window').then(res => {
          if (res && typeof res.is_maximized === 'boolean') {
            App.updateWindowState(res.is_maximized);
          }
        });
        return;
      }

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
  },

  isWindowMaximized: true,

  updateWindowState(isMaximized) {
    this.isWindowMaximized = !!isMaximized;
    const titlebar = document.getElementById('app-window-titlebar');
    const maxBtn = document.getElementById('win-btn-max');
    if (this.isWindowMaximized) {
      document.body.classList.add('window-maximized');
      titlebar?.classList.remove('pywebview-drag-region');
      if (maxBtn) {
        maxBtn.innerHTML = `<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="1" y="3" width="6" height="6" rx="1"/><path d="M3 1h5a1 1 0 0 1 1 1v5"/></svg>`;
        maxBtn.title = "Restaurer la taille de la fenêtre";
      }
    } else {
      document.body.classList.remove('window-maximized');
      titlebar?.classList.add('pywebview-drag-region');
      if (maxBtn) {
        maxBtn.innerHTML = `<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="1" y="1" width="8" height="8" rx="1"/></svg>`;
        maxBtn.title = "Agrandir la fenêtre";
      }
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
