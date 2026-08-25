/**
 * Main Application Orchestrator
 * Gère les vues principales (Bible, Bibliothèque, Paramètres), les onglets, la barre latérale, le chat IA et les toasts.
 */

const App = {
  activeView: 'bible',
  isAIEnabled: true,

  init() {
    // 0. Initialisation immédiate de l'IA, du thème et de la typographie
    this.initAIState();
    this.initThemeAndFont();

    // 1. Initialiser tous les sous-systèmes de manière résiliente
    const modules = [
      { name: 'TaskManager', init: () => (typeof TaskManager !== 'undefined' && TaskManager.init()) },
      { name: 'BibleReader', init: () => BibleReader.init() },
      { name: 'ImportModal', init: () => ImportModal.init() },
      { name: 'LibraryView', init: () => LibraryView.init() },
      { name: 'SettingsView', init: () => SettingsView.init() },
      { name: 'SearchView', init: () => SearchView.init() },
      { name: 'AIStudyView', init: () => AIStudyView.init() },
      { name: 'NotesView', init: () => NotesView.init() },
      { name: 'DictView', init: () => DictView.init() },
      { name: 'MapsView', init: () => MapsView.init() },
      { name: 'CommentariesView', init: () => CommentariesView.init() },
      { name: 'PassageStudyView', init: () => (typeof PassageStudyView !== 'undefined' && PassageStudyView.init()) },
      { name: 'TheologyView', init: () => TheologyView.init() },
      { name: 'SelectionContextMenu', init: () => (typeof SelectionContextMenu !== 'undefined' && SelectionContextMenu.init()) },
      { name: 'TheologicalProfileModal', init: () => (typeof TheologicalProfileModal !== 'undefined' && TheologicalProfileModal.init()) },
      { name: 'HighlighterManager', init: () => (typeof HighlighterManager !== 'undefined' && HighlighterManager.init()) },
      { name: 'ArticlesView', init: () => (typeof ArticlesView !== 'undefined' && ArticlesView.init()) },
      { name: 'PassageOverviewDrawer', init: () => (typeof PassageOverviewDrawer !== 'undefined' && PassageOverviewDrawer.init()) }
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

    document.getElementById('quick-theology')?.addEventListener('click', () => {
      document.querySelectorAll('.sidebar-menu .nav-item, .sidebar-footer .nav-item').forEach(b => b.classList.remove('active'));
      document.getElementById('nav-theology')?.classList.add('active');
      if (typeof TheologyView !== 'undefined') {
        TheologyView.onViewActivated();
      }
      this.switchView('theology');
    });

    document.getElementById('quick-compare')?.addEventListener('click', () => {
      this.switchView('bible');
      BibleReader.toggleSplitView(true);
    });

    document.getElementById('quick-dict')?.addEventListener('click', () => {
      this.switchView('dict');
    });

    // 3. Onglets du panneau droit (Aperçu / Commentaires / IA / Lexique / Notes / Articles)
    document.querySelectorAll('.drawer-tab').forEach(tabBtn => {
      tabBtn.addEventListener('click', () => {
        document.querySelectorAll('.drawer-tab').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.drawer-content').forEach(c => c.classList.remove('active'));

        tabBtn.classList.add('active');
        const tabId = tabBtn.dataset.drawerTab;
        const contentEl = document.getElementById(`drawer-tab-${tabId}`);
        if (contentEl) {
          contentEl.classList.add('active');
          if (tabId === 'overview') {
            const b = (typeof BibleReader !== 'undefined' && BibleReader.currentBook) || 'Gen';
            const ch = (typeof BibleReader !== 'undefined' && BibleReader.currentChapter) || 1;
            const v = (typeof BibleReader !== 'undefined' && BibleReader.selectedVerse) || 1;
            const bible = (typeof BibleReader !== 'undefined' && (BibleReader.currentBible1 || BibleReader.currentVersion)) || 'LSG';
            if (typeof PassageOverviewDrawer !== 'undefined') {
              PassageOverviewDrawer.load(b, ch, v, bible, true);
            }
          } else if (tabId === 'commentaries') {
            if (typeof CommentaryViewer !== 'undefined' && (!CommentaryViewer.currentComments || CommentaryViewer.currentComments.length === 0)) {
              const b = (typeof BibleReader !== 'undefined' && BibleReader.currentBook) || 'Gen';
              const ch = (typeof BibleReader !== 'undefined' && BibleReader.currentChapter) || 1;
              const v = (typeof BibleReader !== 'undefined' && BibleReader.selectedVerse) || 1;
              if (typeof BibleReader !== 'undefined') {
                BibleReader.loadCommentariesForVerse(v, b, ch, true);
              }
            }
          } else if (tabId === 'ai') {
            const passageBadge = document.getElementById('lbl-drawer-ai-passage');
            if (passageBadge && typeof BibleReader !== 'undefined') {
              const curRef = BibleReader.currentVerseRef || `${BibleReader.currentBook || 'GEN'} ${BibleReader.currentChapter || 1}:${BibleReader.selectedVerse || 1}`;
              passageBadge.textContent = curRef;
            }
          } else if (tabId === 'articles') {
            const b = (typeof BibleReader !== 'undefined' && BibleReader.currentBook) || 'Gen';
            const ch = (typeof BibleReader !== 'undefined' && BibleReader.currentChapter) || 1;
            if (typeof ArticlesView !== 'undefined') {
              ArticlesView.loadDrawerArticles(b, ch);
            }
          }
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

    // 6. Lancement du préchargement global unifié dès que l'API bridge est connectée
    API.onReady(async () => {
      await this.runPreloadPipeline();
    });
  },

  initAIState() {
    try {
      const local = localStorage.getItem('open_shema_enable_ai');
      if (local !== null) {
        this.isAIEnabled = local !== 'false';
      }
    } catch (e) {}
    this.applyAIEnabled(this.isAIEnabled, false);
  },

  applyAIEnabled(enabled, saveLocal = true) {
    this.isAIEnabled = enabled !== false;
    document.body.classList.toggle('ai-disabled', !this.isAIEnabled);

    if (saveLocal) {
      try {
        localStorage.setItem('open_shema_enable_ai', this.isAIEnabled ? 'true' : 'false');
      } catch (e) {}
    }

    // 1. Si désactivé et qu'on est sur la vue IA, basculer vers le lecteur biblique
    if (!this.isAIEnabled && this.activeView === 'ai') {
      this.switchView('bible');
    }

    // 2. Si le volet droit est ouvert sur l'onglet IA, basculer sur Commentaires
    const aiDrawerTab = document.querySelector('.drawer-tab[data-drawer-tab="ai"]');
    if (aiDrawerTab && aiDrawerTab.classList.contains('active')) {
      document.querySelector('.drawer-tab[data-drawer-tab="commentaries"]')?.click();
    }

    // 3. Fermer les panneaux de synthèse si ouverts
    if (!this.isAIEnabled) {
      if (typeof CommentariesView !== 'undefined' && CommentariesView.closeAISynthesis) {
        CommentariesView.closeAISynthesis();
      }
      if (typeof TheologyView !== 'undefined' && TheologyView.closeSynthesisPanel) {
        TheologyView.closeSynthesisPanel();
      }
    }

    // 4. Synchroniser avec SettingsView
    if (typeof SettingsView !== 'undefined' && SettingsView.updateAIToggles) {
      SettingsView.updateAIToggles(this.isAIEnabled);
    }
  },

  initThemeAndFont() {
    // Initialiser immédiatement le gestionnaire d'ambiance historique
    if (typeof VintageThemeManager !== 'undefined') {
      VintageThemeManager.init({});
    }

    API.onReady(async () => {
      try {
        const cfg = await API.getSettings();
        if (cfg) {
          if (cfg.enable_ai !== undefined) {
            this.applyAIEnabled(cfg.enable_ai !== false, true);
          }
          this.applyTheme(cfg.theme || 'dark', cfg.theme_palette, cfg.reading_bg);
          if (cfg.font_family) this.applyFontFamily(cfg.font_family);
          if (cfg.font_size) {
            document.documentElement.style.setProperty('--bible-font-size-base', `${cfg.font_size}px`);
          }
          if (typeof VintageThemeManager !== 'undefined') {
            VintageThemeManager.init(cfg);
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

  // Contrôleur d'animation continue haute fluidité pour la barre de chargement (60 FPS)
  SplashProgress: {
    current: 0,
    target: 12,
    timer: null,
    isDone: false,

    start() {
      this.current = 0;
      this.target = 15;
      this.isDone = false;
      if (this.timer) cancelAnimationFrame(this.timer);

      const tick = () => {
        if (this.isDone) {
          this.current = 100;
          this.render();
          return;
        }

        if (this.current < this.target) {
          const diff = this.target - this.current;
          // Interpolation progressive continue
          const step = Math.max(0.15, diff * 0.05);
          this.current = Math.min(this.target, this.current + step);
        } else if (this.current < 95) {
          // Défilement continu organique en tâche de fond (la barre ne s'arrête jamais net)
          this.current = Math.min(95, this.current + 0.035);
        }

        this.render();
        this.timer = requestAnimationFrame(tick);
      };

      this.timer = requestAnimationFrame(tick);
    },

    setTarget(targetPercent, statusText = null) {
      this.target = Math.min(100, Math.max(this.target, targetPercent));
      if (statusText) {
        const textEl = document.getElementById('splash-status-text');
        if (textEl) textEl.textContent = statusText;
      }
    },

    finish(statusText = 'Prêt !') {
      this.isDone = true;
      this.target = 100;
      this.current = 100;
      if (statusText) {
        const textEl = document.getElementById('splash-status-text');
        if (textEl) textEl.textContent = statusText;
      }
      this.render();
      if (this.timer) cancelAnimationFrame(this.timer);
    },

    render() {
      const barEl = document.querySelector('.splash-progress-bar');
      if (barEl) {
        barEl.style.width = `${this.current.toFixed(1)}%`;
      }
    }
  },

  updateSplashStatus(statusText, progressPercent = null) {
    if (progressPercent !== null) {
      this.SplashProgress.setTarget(progressPercent, statusText);
    } else if (statusText) {
      const textEl = document.getElementById('splash-status-text');
      if (textEl) textEl.textContent = statusText;
    }
  },

  async runPreloadPipeline() {
    if (this._isPreloadingDone) return;

    // Démarrer l'animation de progression continue
    this.SplashProgress.start();

    // Timeout de sécurité absolue : 15s max pour garantir la levée du Splash quoi qu'il arrive
    const safetyTimer = setTimeout(() => {
      console.warn('[App] Timeout sécurité de préchargement atteint (15s), masquage du splash.');
      this.SplashProgress.finish();
      this.hideSplash();
    }, 15000);

    try {
      // 1. Initialisation des préférences & fenêtre (15%)
      this.updateSplashStatus("Initialisation des préférences et de l'interface...", 20);
      try {
        const state = await API.call('get_window_state');
        if (state && typeof state.is_maximized === 'boolean') {
          this.updateWindowState(state.is_maximized);
        }
      } catch (e) {}

      // 2. Chargement du lecteur biblique & Genèse 1 (50%)
      this.updateSplashStatus("Chargement des Bibles et du texte biblique...", 50);
      try {
        if (typeof BibleReader !== 'undefined' && BibleReader.preloadInitialData) {
          await BibleReader.preloadInitialData();
        }
      } catch (e) {
        console.error('[App] Erreur préchargement BibleReader:', e);
      }

      // 3. Préchargement de la théologie : livres, TOC et 1er chapitre (82%)
      this.updateSplashStatus("Préchargement des ouvrages et tables des matières théologiques...", 82);
      try {
        if (typeof TheologyView !== 'undefined' && TheologyView.preloadInitialData) {
          await TheologyView.preloadInitialData();
        }
      } catch (e) {
        console.error('[App] Erreur préchargement TheologyView:', e);
      }

      // 4. Préchargement des dictionnaires (95%)
      this.updateSplashStatus("Préparation des dictionnaires et outils d'étude...", 95);
      try {
        if (typeof DictView !== 'undefined' && DictView.preloadInitialData) {
          await DictView.preloadInitialData();
        }
      } catch (e) {
        console.error('[App] Erreur préchargement DictView:', e);
      }

      // 5. Finalisation fluide (100%)
      this.SplashProgress.finish("Prêt ! Bienvenue dans Open Shema.");
      this._isPreloadingDone = true;

      await new Promise(resolve => setTimeout(resolve, 250));
    } catch (err) {
      console.error('[App] Erreur générale pipeline de préchargement:', err);
    } finally {
      clearTimeout(safetyTimer);
      this.hideSplash();
    }
  },

  hideSplash() {
    const splash = document.getElementById('app-splash-loader');
    if (splash && !splash.classList.contains('fade-out')) {
      splash.classList.add('fade-out');
      setTimeout(() => {
        splash.style.display = 'none';
      }, 450);
    }
  },

  switchView(viewName) {
    this.activeView = viewName;
    document.querySelectorAll('.app-view').forEach(v => v.classList.remove('active'));

    const targetEl = document.getElementById(`view-${viewName}`);
    if (targetEl) {
      targetEl.classList.add('active');
    }

    // Synchroniser l'état actif de la barre latérale
    document.querySelectorAll('.sidebar-menu .nav-item, .sidebar-footer .nav-item').forEach(b => {
      if (b.dataset.view === viewName || b.id === `nav-${viewName}`) {
        b.classList.add('active');
      } else {
        b.classList.remove('active');
      }
    });

    // Gérer l'affichage des onglets Bible ou du titre de l'application OPEN SHEMA dans la barre supérieure
    const tabsList = document.getElementById('tabs-list');
    const btnAddTab = document.getElementById('btn-add-tab');
    const appTitle = document.getElementById('topbar-app-title');

    if (viewName === 'bible') {
      if (tabsList) tabsList.classList.remove('hidden');
      if (btnAddTab) btnAddTab.classList.remove('hidden');
      if (appTitle) appTitle.classList.add('hidden');
    } else {
      if (tabsList) tabsList.classList.add('hidden');
      if (btnAddTab) btnAddTab.classList.add('hidden');
      if (appTitle) appTitle.classList.remove('hidden');
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
        CommentariesView.onViewActivated();
      }
    } else if (viewName === 'theology') {
      if (drawerEl) drawerEl.classList.add('collapsed');
      if (typeof TheologyView !== 'undefined') {
        TheologyView.onViewActivated();
      }
    } else if (viewName === 'dict') {
      if (drawerEl) drawerEl.classList.add('collapsed');
      if (typeof DictView !== 'undefined') {
        DictView.onViewActivated();
      }
    } else if (viewName === 'passage-study') {
      if (drawerEl) drawerEl.classList.add('collapsed');
      if (typeof PassageStudyView !== 'undefined') {
        PassageStudyView.onViewActivated();
      }
    } else if (viewName === 'articles') {
      if (drawerEl) drawerEl.classList.add('collapsed');
      if (typeof ArticlesView !== 'undefined') {
        ArticlesView.onViewActivated();
      }
    } else if (viewName === 'ai') {
      if (drawerEl) drawerEl.classList.add('collapsed');
      if (typeof AIStudyView !== 'undefined') {
        AIStudyView.onViewActivated();
      }
    }
  },

  openPassageStudy(passageRef) {
    this.switchView('passage-study');
    if (typeof PassageStudyView !== 'undefined') {
      PassageStudyView.loadPassage(passageRef);
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

  showToast(message, type = 'info', duration = 3500) {
    let container = document.getElementById('app-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'app-toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `app-toast-item toast-${type}`;
    
    let icon = '';
    if (type === 'success') {
      icon = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#10b981" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`;
    } else if (type === 'error') {
      icon = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#ef4444" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
    } else {
      icon = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#38bdf8" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
    }

    toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px) scale(0.95)';
      setTimeout(() => {
        toast.remove();
      }, 250);
    }, duration);
  },

  bindChat() {
    const chatInput = document.getElementById('chat-input');
    const btnSendChat = document.getElementById('btn-send-chat');
    const chatMessages = document.getElementById('chat-messages');
    const modeSelect = document.getElementById('drawer-ai-mode-select');
    const passageBadge = document.getElementById('lbl-drawer-ai-passage');
    const btnClearChat = document.getElementById('btn-clear-drawer-ai-chat');

    let isGenerating = false;
    let activeInterval = null;
    let activeGenerationCancelled = false;
    let currentDrawerSessionId = null;
    let currentDrawerMessages = [];

    // Helper pour récupérer la référence courante du lecteur
    const getCurrentPassageRef = () => {
      if (typeof BibleReader !== 'undefined' && BibleReader.currentVerseRef) {
        return BibleReader.currentVerseRef;
      }
      const b = typeof BibleReader !== 'undefined' ? (BibleReader.currentBook || 'GEN') : 'GEN';
      const c = typeof BibleReader !== 'undefined' ? (BibleReader.currentChapter || 1) : 1;
      const v = typeof BibleReader !== 'undefined' ? (BibleReader.selectedVerse || 1) : 1;
      return `${b} ${c}:${v}`;
    };

    // Mettre à jour l'étiquette au démarrage
    if (passageBadge) {
      passageBadge.textContent = getCurrentPassageRef();
    }

    // Auto-redimensionnement du textarea
    const autoResize = () => {
      if (!chatInput) return;
      chatInput.style.height = 'auto';
      chatInput.style.height = `${Math.min(chatInput.scrollHeight, 120)}px`;
    };
    chatInput?.addEventListener('input', autoResize);

    // Réinitialisation / Clear du chat
    const resetChat = () => {
      if (isGenerating) stopGeneration();
      currentDrawerSessionId = null;
      currentDrawerMessages = [];
      if (!chatMessages) return;
      chatMessages.innerHTML = `
        <div class="chat-message assistant welcome-message">
          <div class="msg-avatar">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/></svg>
          </div>
          <div class="msg-content">
            <div class="welcome-title" style="font-size: 13px; font-weight: 700; color: var(--text-primary); margin-bottom: 4px;">Assistant IA Biblique</div>
            <p style="margin: 0; font-size: 12px; color: var(--text-secondary); line-height: 1.45;">Posez une question sur le passage en cours ou demandez une analyse exégétique, historique ou théologique.</p>
          </div>
        </div>
      `;
    };
    btnClearChat?.addEventListener('click', resetChat);

    // Arrêt de génération
    const stopGeneration = () => {
      isGenerating = false;
      activeGenerationCancelled = true;
      if (activeInterval) clearInterval(activeInterval);
      if (chatInput) chatInput.disabled = false;
      if (btnSendChat) {
        btnSendChat.classList.remove('btn-stop');
        btnSendChat.title = "Envoyer la question (Entrée)";
        btnSendChat.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>`;
      }
    };

    // Gestion des puces de suggestions rapides contextuelles
    document.querySelectorAll('.drawer-quick-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const type = chip.getAttribute('data-prompt-type');
        const ref = getCurrentPassageRef();
        let promptText = '';
        if (type === 'exegesis') {
          promptText = `Fais une analyse exégétique et doctrinale concise de ${ref}.`;
          if (modeSelect) modeSelect.value = 'exegesis';
        } else if (type === 'historical') {
          promptText = `Quel est le contexte historique, culturel et l'arrière-plan de ${ref} ?`;
          if (modeSelect) modeSelect.value = 'historical';
        } else if (type === 'theology') {
          promptText = `Quelles sont les doctrines et vérités théologiques majeures révélées dans ${ref} ?`;
          if (modeSelect) modeSelect.value = 'theology';
        }
        if (chatInput && promptText) {
          chatInput.value = promptText;
          autoResize();
          sendChatMessage();
        }
      });
    });

    const sendChatMessage = async () => {
      if (isGenerating) {
        stopGeneration();
        return;
      }

      const text = chatInput?.value.trim();
      if (!text) return;

      const passageRef = getCurrentPassageRef();
      const mode = modeSelect?.value || 'auto';
      const options = typeof AIStudyView !== 'undefined' && AIStudyView.getOptions ? AIStudyView.getOptions() : {};

      // S'assurer qu'une session existe dans l'historique
      if (!currentDrawerSessionId) {
        const bookCode = typeof BibleReader !== 'undefined' ? (BibleReader.currentBook || 'GEN') : 'GEN';
        const chapter = typeof BibleReader !== 'undefined' ? (BibleReader.currentChapter || 1) : 1;
        const verse = typeof BibleReader !== 'undefined' ? (BibleReader.selectedVerse || 1) : 1;
        const context = { bookCode, chapter, verse, passageRef };
        try {
          currentDrawerSessionId = await API.call('create_ai_session', context);
        } catch (e) {
          console.error("Erreur création session drawer:", e);
        }
      }

      // Ajouter le message utilisateur à la session
      currentDrawerMessages.push({ role: 'user', content: text });

      // Message utilisateur
      const userMsg = document.createElement('div');
      userMsg.className = 'chat-message user';
      userMsg.innerHTML = `
        <div class="msg-content">
          <div class="drawer-user-ref-badge">${typeof AIStudyView !== 'undefined' ? AIStudyView.escapeHtml(passageRef) : passageRef}</div>
          <div>${typeof AIStudyView !== 'undefined' ? AIStudyView.escapeHtml(text) : text}</div>
        </div>
      `;
      chatMessages.appendChild(userMsg);
      chatInput.value = '';
      autoResize();
      chatMessages.scrollTop = chatMessages.scrollHeight;

      // État de génération
      isGenerating = true;
      activeGenerationCancelled = false;
      if (chatInput) chatInput.disabled = true;
      if (btnSendChat) {
        btnSendChat.classList.add('btn-stop');
        btnSendChat.title = "Arrêter la génération";
        btnSendChat.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>`;
      }

      const assistantMsg = document.createElement('div');
      assistantMsg.className = 'chat-message assistant';
      const timerId = `drawer-timer-${Date.now()}`;
      const reasoningId = `drawer-reasoning-${Date.now()}`;
      const stepTextId = `drawer-step-${Date.now()}`;

      assistantMsg.innerHTML = `
        <div class="msg-avatar">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/></svg>
        </div>
        <div class="msg-content">
          <div class="ai-drawer-reasoning-band" id="${reasoningId}">
            <div class="ai-drawer-reasoning-spinner"></div>
            <div class="ai-drawer-step-container">
              <span class="ai-drawer-step-text" id="${stepTextId}">Analyse de l'intention et formulation des requêtes...</span>
            </div>
            <span class="ai-drawer-timer" id="${timerId}">0.0s</span>
          </div>
          <div class="ai-answer-body"></div>
        </div>
      `;
      chatMessages.appendChild(assistantMsg);
      chatMessages.scrollTop = chatMessages.scrollHeight;

      // Chronomètre en direct
      const startTime = performance.now();
      const timerEl = document.getElementById(timerId);
      activeInterval = setInterval(() => {
        const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
        if (timerEl) timerEl.textContent = `${elapsed}s`;
      }, 100);

      // Transitions successives des étapes (une seule étape affichée à la fois avec swap fluide)
      const stepEl = document.getElementById(stepTextId);
      const updateStep = (newText) => {
        if (!stepEl) return;
        stepEl.classList.add('step-exit');
        setTimeout(() => {
          stepEl.textContent = newText;
          stepEl.classList.remove('step-exit');
          stepEl.classList.add('step-enter');
          void stepEl.offsetWidth;
          requestAnimationFrame(() => {
            stepEl.classList.remove('step-enter');
          });
        }, 220);
      };

      const stepTimer1 = setTimeout(() => updateStep("Exploration du corpus documentaire (Bibles, Commentaires, Dicos)..."), 1200);
      const stepTimer2 = setTimeout(() => updateStep("Sélection et ordonnancement sémantique des extraits..."), 2800);
      const stepTimer3 = setTimeout(() => updateStep(`Synthèse exégétique et rédaction théologique avec ${options.model || 'Gemini'}...`), 4800);
      const stepTimer4 = setTimeout(() => updateStep("Recoupement des concordances textuelles et des sources doctrinales..."), 16000);
      const stepTimer5 = setTimeout(() => updateStep("Harmonisation des références bibliques et formulation finale..."), 32000);
      const activeStepTimeouts = [stepTimer1, stepTimer2, stepTimer3, stepTimer4, stepTimer5];

      try {
        const response = await API.call('ask_study_ai', currentDrawerMessages, mode, passageRef, options);
        clearInterval(activeInterval);
        activeStepTimeouts.forEach(t => clearTimeout(t));

        if (chatInput) chatInput.disabled = false;
        if (btnSendChat) {
          btnSendChat.classList.remove('btn-stop');
          btnSendChat.title = "Envoyer la question (Entrée)";
          btnSendChat.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>`;
        }
        isGenerating = false;

        if (activeGenerationCancelled) return;

        const totalDuration = ((performance.now() - startTime) / 1000).toFixed(1);
        const answerText = response.answer || response;
        const sourcesDetails = response.sources_details || [];
        
        // Traduction française garantie du mode
        const frenchModes = {
          "theology": "Synthèse théologique & doctrinale",
          "exegesis": "Exégèse approfondie",
          "historical": "Contexte historique & culturel",
          "sermon": "Préparation de prédication",
          "lexical": "Analyse lexicale (Grec & Hébreu)",
          "free_chat": "Discussion libre & Réflexion",
          "auto": "Synthèse d'étude"
        };
        const rawMode = (response.detected_mode || mode || "theology").toLowerCase();
        const detectedMode = frenchModes[rawMode] || response.detected_mode || "Synthèse d'étude";
        const modelUsed = response.model_used || options.model || "Gemini";

        // Mettre à jour le bandeau de raisonnement terminé
        const reasoningEl = document.getElementById(reasoningId);
        if (reasoningEl) {
          reasoningEl.classList.add('collapsed');
          reasoningEl.innerHTML = `
            <span class="ai-reasoning-check-icon">${typeof AIStudyView !== 'undefined' ? AIStudyView.ICONS.check : '✓'}</span>
            <span style="font-weight: 600; color: var(--text-primary);">Raisonnement terminé (${totalDuration}s) &bull; <strong>${typeof AIStudyView !== 'undefined' ? AIStudyView.escapeHtml(detectedMode) : detectedMode}</strong></span>
          `;
        }

        // Formater la réponse avec le parseur riche complet (pastilles in-text [ 📖 ] avec infobulles)
        const formattedMarkdown = typeof AIStudyView !== 'undefined'
          ? AIStudyView.renderRichMarkdown(answerText, sourcesDetails)
          : answerText;

        const footerHtml = `
          <div class="ai-msg-footer" style="margin-top: 8px;">
            <div class="ai-footer-left">
              <button class="smooth-btn-copy" title="Copier l'analyse">
                <span class="copy-icon-wrap">
                  <svg class="icon-copy" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  <svg class="icon-check" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                </span>
                <span class="copy-label" style="font-size: 10.5px;">Copier</span>
              </button>
              <button class="ai-footer-action-btn btn-export-notes" title="Enregistrer dans les notes (.md)" style="font-size: 10.5px;">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline></svg>
                <span>Note</span>
              </button>
            </div>
            <div class="ai-footer-right">
              <span class="ai-model-tag" style="font-size: 9.5px;">${typeof AIStudyView !== 'undefined' ? AIStudyView.escapeHtml(modelUsed) : modelUsed}</span>
            </div>
          </div>
        `;

        const answerBodyEl = assistantMsg.querySelector('.ai-answer-body');
        if (answerBodyEl) {
          answerBodyEl.innerHTML = `<div class="ai-markdown-content"></div>` + footerHtml;
          
          // Enregistrer la réponse dans la session persistante
          currentDrawerMessages.push({ role: 'assistant', content: answerText, sources: sourcesDetails });
          if (currentDrawerSessionId) {
            API.call('save_ai_messages', currentDrawerSessionId, currentDrawerMessages, text).then(() => {
              if (typeof AIStudyView !== 'undefined' && AIStudyView.loadHistory) {
                AIStudyView.loadHistory();
              }
            });
          }

          if (typeof AIStudyView !== 'undefined') {
            const markdownEl = answerBodyEl.querySelector('.ai-markdown-content');
            AIStudyView.streamMarkdownResponse(markdownEl, formattedMarkdown, () => {
              AIStudyView.attachMessageActions(assistantMsg, answerText, passageRef, text);
            });
          }
        }

        // Rester en haut de la réponse pour commencer la lecture
        setTimeout(() => {
          assistantMsg.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 50);

      } catch (err) {
        clearInterval(activeInterval);
        activeStepTimeouts.forEach(t => clearTimeout(t));
        isGenerating = false;
        if (chatInput) chatInput.disabled = false;
        if (btnSendChat) {
          btnSendChat.classList.remove('btn-stop');
          btnSendChat.title = "Envoyer la question (Entrée)";
          btnSendChat.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>`;
        }
        const answerBodyEl = assistantMsg.querySelector('.ai-answer-body');
        if (answerBodyEl) {
          answerBodyEl.innerHTML = `<p style="color: var(--accent-red); font-size: 12px; margin-top: 4px;">Une erreur est survenue lors de l'appel à l'assistant IA (${err?.message || err}).</p>`;
        }
      }
    };

    btnSendChat?.addEventListener('click', sendChatMessage);
    chatInput?.addEventListener('keydown', (e) => {
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
    const appEl = document.getElementById('app');

    // Empêcher tout décalage / défilement horizontal parasite du conteneur principal
    if (appEl) {
      appEl.addEventListener('scroll', () => {
        if (appEl.scrollLeft !== 0) {
          appEl.scrollLeft = 0;
        }
      });
    }

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

          if (remainingReaderWidth < 500) {
            // Réduire automatiquement le menu gauche en mode icônes compactes
            this.setSidebarCollapsed(true, true);
          } else if (remainingReaderWidth >= 640 && this.sidebarAutoCollapsed) {
            // Rétablir le menu gauche s'il avait été réduit automatiquement
            this.setSidebarCollapsed(false, true);
          }

          if (appEl) appEl.scrollLeft = 0;
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

          if (appEl) appEl.scrollLeft = 0;

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

    // Initialiser l'état de la barre latérale selon l'état du volet droit
    this.checkAutoSidebarCollapse();
  },

  setSidebarCollapsed(collapsed, isAuto = false) {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    sidebar.classList.toggle('collapsed', collapsed);
    document.body.classList.toggle('sidebar-is-collapsed', collapsed);

    const appEl = document.getElementById('app');
    if (appEl) appEl.scrollLeft = 0;

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
    const sidebar = document.getElementById('sidebar');
    const isDrawerOpen = drawer && !drawer.classList.contains('collapsed');

    const appEl = document.getElementById('app');
    if (appEl) appEl.scrollLeft = 0;

    if (!isDrawerOpen) {
      if (this.sidebarAutoCollapsed) {
        this.setSidebarCollapsed(false, true);
      }
    } else {
      // Lorsque le volet droit s'ouvre -> replier systématiquement le volet gauche en mode icônes compactes
      if (sidebar && !sidebar.classList.contains('collapsed')) {
        this.setSidebarCollapsed(true, true);
      }
    }

    if (typeof BibleReader !== 'undefined' && typeof BibleReader.updatePassagePillDisplay === 'function') {
      BibleReader.updatePassagePillDisplay();
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

/**
 * Gestionnaire d'Immersion Historique & Époque (VintageThemeManager)
 * Gère l'application contextuelle de l'apparence des vieux manuscrits / livres selon la date du texte.
 */
const VintageThemeManager = {
  enabled: true,
  scope: 'auto', // 'auto' | 'always'
  intensity: 'subtle', // 'subtle' | 'rich'

  init(cfg = {}) {
    if (cfg.vintage_mode !== undefined) this.enabled = cfg.vintage_mode !== false;
    if (cfg.vintage_scope) this.scope = cfg.vintage_scope;
    if (cfg.vintage_intensity) this.intensity = cfg.vintage_intensity;

    this.syncUIControls();
    this.bindEvents();
    this.refreshAll();
  },

  syncUIControls() {
    const chkPop = document.getElementById('opt-vintage-mode');
    if (chkPop) chkPop.checked = this.enabled;
    const badgePop = document.getElementById('opt-vintage-badge');
    if (badgePop) {
      badgePop.textContent = this.enabled ? 'Actif' : 'Désactivé';
      badgePop.style.color = this.enabled ? 'var(--accent-orange)' : 'var(--text-muted)';
    }

    const chkCfg = document.getElementById('cfg-vintage-mode');
    if (chkCfg) chkCfg.checked = this.enabled;

    const optGroup = document.getElementById('cfg-vintage-options-group');
    if (optGroup) optGroup.style.display = this.enabled ? 'flex' : 'none';

    const radioScopeAuto = document.getElementById('cfg-vintage-scope-auto');
    const radioScopeAlways = document.getElementById('cfg-vintage-scope-always');
    if (radioScopeAuto && this.scope === 'auto') radioScopeAuto.checked = true;
    if (radioScopeAlways && this.scope === 'always') radioScopeAlways.checked = true;

    const radioIntSubtle = document.getElementById('cfg-vintage-intensity-subtle');
    const radioIntRich = document.getElementById('cfg-vintage-intensity-rich');
    if (radioIntSubtle && this.intensity === 'subtle') radioIntSubtle.checked = true;
    if (radioIntRich && this.intensity === 'rich') radioIntRich.checked = true;
  },

  bindEvents() {
    if (this._eventsBound) return;
    this._eventsBound = true;

    // Popover d'options rapides
    document.getElementById('opt-vintage-mode')?.addEventListener('change', (e) => {
      this.setEnabled(e.target.checked);
    });

    // Page Paramètres
    document.getElementById('cfg-vintage-mode')?.addEventListener('change', (e) => {
      this.setEnabled(e.target.checked);
    });

    document.querySelectorAll('input[name="cfg-vintage-scope"]').forEach(r => {
      r.addEventListener('change', (e) => {
        if (e.target.checked) {
          this.scope = e.target.value;
          this.persistSettings();
          this.refreshAll();
        }
      });
    });

    document.querySelectorAll('input[name="cfg-vintage-intensity"]').forEach(r => {
      r.addEventListener('change', (e) => {
        if (e.target.checked) {
          this.intensity = e.target.value;
          this.persistSettings();
          this.refreshAll();
        }
      });
    });
  },

  persistSettings() {
    if (typeof API !== 'undefined' && API.saveSettings && API.getSettings) {
      API.getSettings().then(cfg => {
        if (!cfg) cfg = {};
        cfg.vintage_mode = this.enabled;
        cfg.vintage_scope = this.scope;
        cfg.vintage_intensity = this.intensity;
        API.saveSettings(cfg).catch(() => {});
      }).catch(() => {});
    }
  },

  setEnabled(val) {
    this.enabled = !!val;
    this.syncUIControls();
    this.persistSettings();
    this.refreshAll();
    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast(this.enabled ? '📜 Mode Immersion Historique activé' : 'Mode Immersion Historique désactivé');
    }
  },

  /**
   * Analyse une année ou un nom d'auteur / version pour déterminer l'époque
   * @param {string|number} yearOrName
   * @returns {'ancient'|'classic'|'xix'|'modern'}
   */
  getEpoch(yearOrName) {
    if (!yearOrName) return this.scope === 'always' ? 'xix' : 'modern';

    let str = String(yearOrName).trim();
    const sLower = str.toLowerCase();

    // 0. Exclusions prioritaires : Versions résolument contemporaines (Segond 21, NBS, TOB, BDS, NFC, SEM, etc.)
    if (sLower.includes('segond 21') || sLower.includes('s21') || sLower.includes('nbs') || 
        sLower.includes('tob') || sLower.includes('bds') || sLower.includes('nfc') || 
        sLower.includes('semeur') || sLower.includes('parole de vie') || sLower.includes('pdv') || 
        sLower.includes('francais courant') || sLower.includes('colombe') || sLower.includes('chouraqui') ||
        sLower.includes('bayard') || sLower.includes('jerusalem') || sLower.includes('bdj') ||
        sLower.includes('epee') || sLower.includes('epée') || sLower.includes('osty') ||
        sLower.includes('bible du semeur') || sLower.includes('nouvelle bible segond')) {
      return this.scope === 'always' ? 'xix' : 'modern';
    }

    // 1. Détection prioritaire par année à 4 chiffres (1400 à 2099)
    const yearMatch = str.match(/\b(1[4-9][0-9]{2}|20[0-9]{2})\b/);
    if (yearMatch) {
      const yr = parseInt(yearMatch[1], 10);
      if (yr >= 1930) return this.scope === 'always' ? 'xix' : 'modern';
      if (yr >= 1800) return 'xix';
      if (yr >= 1500) return 'classic';
      return 'ancient';
    }

    // 2. Détections textuelles : Antiquité & Manuscrits (< 1500)
    if (sLower.includes('vulgate') || sLower.includes('vul') || sLower.includes('hebreu') || sLower.includes('hébreu') || 
        sLower.includes('grec') || sLower.includes('septante') || sLower.includes('lxx') || sLower.includes('wlc') ||
        sLower.includes('peshitta') || sLower.includes('tischendorf') || sLower.includes('augustin') || 
        sLower.includes('chrysostome') || sLower.includes('origene') || sLower.includes('origène') ||
        sLower.includes('byz') || sLower.includes('textus receptus') || sLower.includes('tr')) {
      return 'ancient';
    }

    // 3. Période Classique & Réforme (1500 - 1799)
    if (sLower.includes('martin') || sLower.includes('mrt') || sLower.includes('dm1744') ||
        sLower.includes('osterwald') || sLower.includes('ostervald') || sLower.includes('ost') || sLower.includes('jfo') ||
        sLower.includes('calvin') || sLower.includes('matthew henry') || sLower.includes('henry') || 
        sLower.includes('kjv') || sLower.includes('king james') || sLower.includes('geneve 1669') || 
        sLower.includes('geneve 1560') || sLower.includes('genève') || sLower.includes('bgen') ||
        sLower.includes('diodati') || sLower.includes('reina valera 1602') || sLower.includes('gill') || sLower.includes('wesley')) {
      return 'classic';
    }

    // 4. Fin XIXe / Belle Époque (1800 - 1929)
    if (sLower.includes('lausanne') || sLower.includes('lau') ||
        sLower.includes('segond') || sLower.includes('lsg') ||
        sLower.includes('darby') || sLower.includes('drb') ||
        sLower.includes('vigouroux') || sLower.includes('vigo') ||
        sLower.includes('godet') || sLower.includes('bible annotée') || sLower.includes('ban') ||
        sLower.includes('scofield') || sLower.includes('crampon') || sLower.includes('bcr') ||
        sLower.includes('stapfer') || sLower.includes('glaire') || sLower.includes('fillion') || 
        sLower.includes('keil') || sLower.includes('delitzsch') || sLower.includes('jamieson') ||
        sLower.includes('calmet') || sLower.includes('westcott') || sLower.includes('hort')) {
      return 'xix';
    }

    return this.scope === 'always' ? 'xix' : 'modern';
  },

  /**
   * Retourne un libellé élégant pour le badge d'époque
   */
  getEpochLabel(epoch, year = null) {
    if (epoch === 'ancient') return year ? `${year} (Manuscrit)` : 'Codex / Manuscrit';
    if (epoch === 'classic') return year ? `${year} (Classique)` : 'Époque Classique';
    if (epoch === 'xix') return year ? `${year} (XIXᵉ s.)` : 'Belle Époque XIXᵉ';
    return '';
  },

  /**
   * Applique les classes d'époque et d'intensité sur un élément conteneur
   */
  applyEpochToElement(el, yearOrName) {
    if (!el) return;

    el.classList.remove(
      'vintage-epoch-ancient', 'vintage-epoch-classic', 'vintage-epoch-xix', 'vintage-epoch-modern',
      'vintage-intensity-subtle', 'vintage-intensity-rich'
    );

    if (!this.enabled) return;

    const epoch = this.getEpoch(yearOrName);
    if (epoch !== 'modern') {
      el.classList.add(`vintage-epoch-${epoch}`);
      el.classList.add(`vintage-intensity-${this.intensity}`);
    }
  },

  refreshAll() {
    if (typeof BibleReader !== 'undefined' && BibleReader.applyVintageToPanes) {
      BibleReader.applyVintageToPanes();
    }
    if (typeof CommentariesView !== 'undefined' && CommentariesView.refreshVintage) {
      CommentariesView.refreshVintage();
    }
    if (typeof DictView !== 'undefined' && DictView.refreshVintage) {
      DictView.refreshVintage();
    }
    if (typeof TheologyView !== 'undefined' && TheologyView.refreshVintage) {
      TheologyView.refreshVintage();
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
