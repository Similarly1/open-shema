/**
 * NotificationManager - Open Shema
 * Gère intelligemment les notifications de fin de génération IA :
 * - Carillon audio doux haute fidélité via Web Audio API (aucun asset externe requis)
 * - Notification native Windows (Toast OS) quand l'application est en arrière-plan
 * - Bannière / Toast flottant in-app interactif quand l'utilisateur navigue sur un autre onglet
 * - Pastille (badge) sur la barre latérale pour signaler une réponse prête
 */

const NotificationManager = {
  // Contexte Web Audio partagé
  _audioCtx: null,

  // Préférences par défaut
  settings: {
    enabled: true,
    sound: true,
    windows: true,
    inapp: true,
    volume: 0.6
  },

  // État des notifications en attente
  pendingNotification: null,

  init() {
    this.loadSettings();
    this.setupListeners();
    this.createToastContainer();
  },

  loadSettings() {
    try {
      const saved = localStorage.getItem('open_shema_notify_settings');
      if (saved) {
        this.settings = { ...this.settings, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn('[NotificationManager] Erreur chargement réglages:', e);
    }
  },

  saveSettings() {
    try {
      localStorage.setItem('open_shema_notify_settings', JSON.stringify(this.settings));
    } catch (e) {
      console.warn('[NotificationManager] Erreur sauvegarde réglages:', e);
    }
  },

  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    this.saveSettings();
  },

  getActiveView() {
    if (typeof App !== 'undefined' && App.activeView) {
      return App.activeView;
    }
    const activeViewEl = document.querySelector('.app-view.active');
    if (activeViewEl && activeViewEl.id) {
      return activeViewEl.id.replace('view-', '');
    }
    const activeNav = document.querySelector('.sidebar-nav .nav-item.active, #sidebar .nav-item.active');
    if (activeNav) {
      return activeNav.dataset.view || activeNav.id?.replace('nav-', '') || 'bible';
    }
    return 'bible';
  },

  setupListeners() {
    // Nettoyer la pastille dès qu'on clique sur n'importe quel onglet de navigation
    document.addEventListener('click', (e) => {
      const navItem = e.target.closest('[data-view], [id^="nav-"]');
      if (navItem) {
        const viewId = navItem.dataset.view || navItem.id?.replace(/^nav-/, '');
        if (viewId) {
          this.clearBadge(viewId);
        }
      }
    });

    // Nettoyer la pastille quand App bascule de vue
    window.addEventListener('viewchanged', (e) => {
      if (e.detail?.view) {
        this.clearBadge(e.detail.view);
      }
    });
  },

  // =========================================================================
  // Synthétiseur Audio Web Audio API (Carillon feutré & doux)
  // =========================================================================

  getAudioContext() {
    if (!this._audioCtx) {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (AudioCtxClass) {
        this._audioCtx = new AudioCtxClass();
      }
    }
    if (this._audioCtx && this._audioCtx.state === 'suspended') {
      this._audioCtx.resume().catch(() => {});
    }
    return this._audioCtx;
  },

  /**
   * Joue un carillon doux à deux accords harmoniques (Mi5 -> La5)
   */
  playChime(testVolume = null) {
    if (!this.settings.enabled || (!this.settings.sound && testVolume === null)) {
      return;
    }

    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const volume = typeof testVolume === 'number' ? testVolume : (this.settings.volume ?? 0.6);
      if (volume <= 0) return;

      const now = ctx.currentTime;

      // Note 1 : E5 (659.25 Hz)
      this._playHarmonicNote(ctx, 659.25, now, 0.45, volume * 0.4);
      // Note 2 : A5 (880.00 Hz) jouée 120ms après pour un arpège harmonieux
      this._playHarmonicNote(ctx, 880.00, now + 0.12, 0.65, volume * 0.55);

    } catch (err) {
      console.warn('[NotificationManager] Impossible de jouer le son:', err);
    }
  },

  _playHarmonicNote(ctx, freq, startTime, duration, gainLevel) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    // Sinusoïde douce et feutrée
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startTime);

    // Enveloppe d'attaque et d'extinction douce
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(gainLevel, startTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);

    // Ajout d'une harmonique discrète (octave supérieure atténuée)
    const harmonicOsc = ctx.createOscillator();
    const harmonicGain = ctx.createGain();
    harmonicOsc.type = 'sine';
    harmonicOsc.frequency.setValueAtTime(freq * 2, startTime);

    harmonicGain.gain.setValueAtTime(0.0001, startTime);
    harmonicGain.gain.exponentialRampToValueAtTime(gainLevel * 0.25, startTime + 0.02);
    harmonicGain.gain.exponentialRampToValueAtTime(0.0001, startTime + (duration * 0.7));

    harmonicOsc.connect(harmonicGain);
    harmonicGain.connect(ctx.destination);

    harmonicOsc.start(startTime);
    harmonicOsc.stop(startTime + duration);
  },

  // =========================================================================
  // Notification intelligente de fin de génération
  // =========================================================================

  /**
   * Notifie l'utilisateur de la fin d'une tâche LLM
   * @param {Object} options
   * @param {string} options.title Titre court (ex: "Assistant d'Étude", "Script audio prêt")
   * @param {string} options.snippet Extrait ou sujet (ex: "L'Ancienne et la Nouvelle Alliance")
   * @param {string} options.targetView Vue cible ('ai', 'audio-studio', 'passage-study', 'theology', etc.)
   * @param {string} [options.btnText] Texte optionnel du bouton d'action
   */
  notifyAICompletion(options = {}) {
    if (!this.settings.enabled) return;

    const title = options.title || "Assistant d'Étude";
    const snippet = options.snippet || options.body || "";
    const targetView = options.targetView || options.view || "ai";
    const btnText = options.btnText || (targetView === 'audio-studio' ? (title.toLowerCase().includes('audio') && !title.toLowerCase().includes('script') ? "Écouter l'épisode" : "Voir le script") : "Voir l'étude");

    // 0. Retirer l'animation de travail en cours sur la vue cible
    this.setWorkingState(targetView, false);

    const isAppFocused = document.hasFocus() && !document.hidden;
    const currentView = this.getActiveView();
    const isCurrentView = (currentView === targetView);

    // Si l'utilisateur est déjà sur la page concernée :
    // - On s'assure qu'aucun badge résiduel n'est affiché sur cet onglet ni sur l'IA
    if (isCurrentView) {
      this.clearBadge(targetView);
      if (targetView === 'audio-studio') {
        this.clearBadge('ai');
      }

      // Notification sonore douce
      if (this.settings.sound) {
        this.playChime();
      }

      // Si l'application est en arrière-plan Windows
      if (!isAppFocused && this.settings.windows) {
        const notifTitle = `Open Shema • ${title}`;
        const notifMsg = snippet ? `« ${snippet.substring(0, 90)}${snippet.length > 90 ? '...' : ''} »` : "Prêt à être consulté.";
        if (typeof API !== 'undefined' && API.showSystemNotification) {
          API.showSystemNotification(notifTitle, notifMsg);
        }
      } 
      // Si l'app est au premier plan dans Studio Audio, afficher également le toast in-app avec action adaptée
      else if (targetView === 'audio-studio' && this.settings.inapp) {
        this.showInAppToast({
          title,
          snippet,
          targetView,
          btnText,
          onClick: () => {
            if (typeof AudioStudioView !== 'undefined' && AudioStudioView.goToStep) {
              AudioStudioView.goToStep(title.toLowerCase().includes('audio') && !title.toLowerCase().includes('script') ? 3 : 2);
            }
          }
        });
      }
      return;
    }

    // Si l'utilisateur est sur une AUTRE page (ex: Bible, Dictionnaires, Commentaires...) :
    if (this.settings.sound) {
      this.playChime();
    }

    // Afficher la pastille badge STRICTEMENT sur l'onglet de la vue cible (ex: Studio Audio)
    this.setBadge(targetView);

    // 3. Cas A : Application en arrière-plan (autre programme Windows)
    if (!isAppFocused) {
      if (this.settings.windows) {
        const notifTitle = `Open Shema • ${title}`;
        const notifMsg = snippet ? `« ${snippet.substring(0, 90)}${snippet.length > 90 ? '...' : ''} »` : "Prêt à être consulté.";
        if (typeof API !== 'undefined' && API.showSystemNotification) {
          API.showSystemNotification(notifTitle, notifMsg);
        }
      }
    } 
    // 4. Cas B : Utilisateur actif dans Open Shema mais sur une AUTRE page
    else {
      if (this.settings.inapp) {
        this.showInAppToast({
          title,
          snippet,
          targetView,
          btnText,
          onClick: () => {
            if (typeof App !== 'undefined' && App.switchView) {
              App.switchView(targetView);
            }
            this.clearBadge(targetView);
          }
        });
      }
    }
  },

  // =========================================================================
  // Bannière / Toast Flottant In-App
  // =========================================================================

  createToastContainer() {
    let container = document.getElementById('open-shema-floating-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'open-shema-floating-toast-container';
      container.className = 'floating-toast-container';
      document.body.appendChild(container);
    }
    return container;
  },

  showInAppToast({ title, snippet, targetView = 'ai', onClick = null, type = 'ready', tag = null, btnText = null }) {
    const container = this.createToastContainer();
    
    // Supprimer un ancien toast s'il existe
    container.innerHTML = '';

    const toastEl = document.createElement('div');
    const isError = type === 'error';
    const isSuccess = type === 'success';
    toastEl.className = `os-floating-toast ${isError ? 'toast-error' : (isSuccess ? 'toast-success' : '')}`;
    
    const fallbackSnippet = isError ? "Une erreur est survenue." : (targetView === 'audio-studio' ? "Script audio prêt pour la synthèse." : "Étude prête à être consultée.");
    const cleanSnippet = snippet ? snippet.replace(/<[^>]*>?/gm, '').trim() : fallbackSnippet;
    const maxLen = 140;
    const displaySnippet = cleanSnippet.length > maxLen ? cleanSnippet.substring(0, maxLen - 3) + '...' : cleanSnippet;

    let iconSvg = `
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
        <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/>
      </svg>
    `;
    if (isError) {
      iconSvg = `
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#ef4444" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      `;
    } else if (isSuccess) {
      iconSvg = `
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#10b981" stroke-width="2.5">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      `;
    }

    const defaultTag = isError ? 'Erreur' : (isSuccess ? 'Succès' : 'Prêt');
    const displayTag = tag || defaultTag;

    const showAction = Boolean(onClick || btnText);
    const actionLabel = btnText || (targetView === 'audio-studio' ? "Voir le script" : "Voir l'étude");
    const actionBtnHtml = showAction ? `
      <div class="os-toast-actions">
        <button type="button" class="os-toast-btn-action">
          <span>${actionLabel}</span>
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>
    ` : '';

    toastEl.innerHTML = `
      <div class="os-toast-icon">
        ${iconSvg}
      </div>
      <div class="os-toast-content">
        <div class="os-toast-header">
          <span class="os-toast-title">${title}</span>
          <span class="os-toast-tag">${displayTag}</span>
        </div>
        <p class="os-toast-text">${displaySnippet}</p>
        ${actionBtnHtml}
      </div>
      <button type="button" class="os-toast-close" title="Fermer">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    `;

    // Événement clic sur bouton d'action
    const actionBtn = toastEl.querySelector('.os-toast-btn-action');
    actionBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.dismissToast(toastEl);
      if (onClick) onClick();
    });

    // Événement clic global sur le toast
    toastEl.addEventListener('click', () => {
      this.dismissToast(toastEl);
      if (onClick) onClick();
    });

    // Événement fermeture
    const closeBtn = toastEl.querySelector('.os-toast-close');
    closeBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.dismissToast(toastEl);
    });

    container.appendChild(toastEl);

    // Animation d'entrée
    requestAnimationFrame(() => {
      toastEl.classList.add('is-visible');
    });

    // Auto-fermeture après 9 secondes
    setTimeout(() => {
      this.dismissToast(toastEl);
    }, 9000);
  },

  dismissToast(toastEl) {
    if (!toastEl || !toastEl.parentNode) return;
    toastEl.classList.remove('is-visible');
    toastEl.classList.add('is-hiding');
    setTimeout(() => {
      toastEl.remove();
    }, 300);
  },

  // =========================================================================
  // Indicateur de Travail en Cours (Animation tournante sur la Sidebar)
  // =========================================================================

  setWorkingState(viewName, isWorking = true) {
    const navItem = document.querySelector(`[data-view="${viewName}"], #nav-${viewName}, #nav-btn-${viewName}`);
    if (!navItem) return;

    if (isWorking) {
      this.clearBadge(viewName);
      navItem.classList.add('is-working');
      navItem.style.position = 'relative';

      let spinnerEl = navItem.querySelector('.sidebar-working-indicator');
      if (!spinnerEl) {
        spinnerEl = document.createElement('span');
        spinnerEl.className = 'sidebar-working-indicator';
        spinnerEl.title = "Génération IA en cours...";
        spinnerEl.innerHTML = `<span class="sidebar-working-spinner"></span>`;
        navItem.appendChild(spinnerEl);
      }
    } else {
      navItem.classList.remove('is-working');
      const spinnerEl = navItem.querySelector('.sidebar-working-indicator');
      if (spinnerEl) {
        spinnerEl.remove();
      }
    }
  },

  // =========================================================================
  // Pastille / Badge Sidebar de Fin de Réponse
  // =========================================================================

  setBadge(viewName) {
    const navItem = document.querySelector(`[data-view="${viewName}"], #nav-${viewName}, #nav-btn-${viewName}`);
    if (!navItem) return;

    // S'assurer qu'il n'y a plus le spinner en cours
    const spinnerEl = navItem.querySelector('.sidebar-working-indicator');
    if (spinnerEl) spinnerEl.remove();
    navItem.classList.remove('is-working');

    let badge = navItem.querySelector('.sidebar-notification-dot');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'sidebar-notification-dot';
      navItem.style.position = 'relative';
      navItem.appendChild(badge);
    }
    badge.classList.add('is-active');
  },

  clearBadge(viewName) {
    const navItem = document.querySelector(`[data-view="${viewName}"], #nav-${viewName}, #nav-btn-${viewName}`);
    if (!navItem) return;

    const badge = navItem.querySelector('.sidebar-notification-dot');
    if (badge) {
      badge.classList.remove('is-active');
      badge.remove();
    }
  }
};

// Initialiser le gestionnaire au chargement
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => NotificationManager.init());
  } else {
    NotificationManager.init();
  }
}
