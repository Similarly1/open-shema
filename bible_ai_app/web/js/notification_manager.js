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

  setupListeners() {
    // Nettoyer la pastille quand l'utilisateur clique sur l'onglet IA
    document.addEventListener('click', (e) => {
      const aiBtn = e.target.closest('[data-view="ai"], #nav-btn-ai, .nav-item-ai');
      if (aiBtn) {
        this.clearBadge('ai');
      }
    });

    // Nettoyer la pastille quand App bascule de vue
    window.addEventListener('viewchanged', (e) => {
      if (e.detail?.view === 'ai') {
        this.clearBadge('ai');
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
   * @param {string} options.title Titre court (ex: "Assistant d'Étude")
   * @param {string} options.snippet Extrait ou sujet (ex: "L'Ancienne et la Nouvelle Alliance")
   * @param {string} options.targetView Vue cible ('ai', 'passage-study', 'theology', etc.)
   */
  notifyAICompletion({ title = "Assistant d'Étude", snippet = "", targetView = "ai" } = {}) {
    if (!this.settings.enabled) return;

    const isAppFocused = document.hasFocus() && !document.hidden;
    const currentView = typeof App !== 'undefined' ? (App.currentView || 'bible') : 'bible';
    const isCurrentView = (currentView === targetView);

    // Si l'utilisateur est déjà actif et regarde la page concernée, pas besoin de le déranger avec un popup
    if (isAppFocused && isCurrentView) {
      return;
    }

    // 1. Jouer le carillon doux
    if (this.settings.sound) {
      this.playChime();
    }

    // 2. Cas A : Application en arrière-plan (autre programme / fenêtre inactive)
    if (!isAppFocused) {
      if (this.settings.windows) {
        const notifTitle = `Open Shema • ${title}`;
        const notifMsg = snippet ? `Réponse prête : « ${snippet.substring(0, 90)}${snippet.length > 90 ? '...' : ''} »` : "Votre étude est prête.";
        if (typeof API !== 'undefined' && API.showSystemNotification) {
          API.showSystemNotification(notifTitle, notifMsg);
        }
      }
      // Ajouter également le badge sur la sidebar
      this.setBadge(targetView);
    } 
    // 3. Cas B : Utilisateur actif dans Open Shema mais sur une AUTRE page (ex: Bible, Dictionnaires)
    else if (!isCurrentView) {
      if (this.settings.inapp) {
        this.showInAppToast({
          title,
          snippet,
          targetView,
          onClick: () => {
            if (typeof App !== 'undefined' && App.switchView) {
              App.switchView(targetView);
            }
            this.clearBadge(targetView);
          }
        });
      }
      this.setBadge(targetView);
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

  showInAppToast({ title, snippet, targetView = 'ai', onClick = null }) {
    const container = this.createToastContainer();
    
    // Supprimer un ancien toast s'il existe
    container.innerHTML = '';

    const toastEl = document.createElement('div');
    toastEl.className = 'os-floating-toast';
    
    const cleanSnippet = snippet ? snippet.replace(/<[^>]*>?/gm, '').trim() : "Étude prête à être consultée.";
    const displaySnippet = cleanSnippet.length > 80 ? cleanSnippet.substring(0, 77) + '...' : cleanSnippet;

    toastEl.innerHTML = `
      <div class="os-toast-icon">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
          <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/>
        </svg>
      </div>
      <div class="os-toast-content">
        <div class="os-toast-header">
          <span class="os-toast-title">${title}</span>
          <span class="os-toast-tag">Prêt</span>
        </div>
        <p class="os-toast-text">${displaySnippet}</p>
        <div class="os-toast-actions">
          <button type="button" class="os-toast-btn-action">
            <span>Voir l'étude</span>
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
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
  // Pastille / Badge Sidebar
  // =========================================================================

  setBadge(viewName) {
    const navItem = document.querySelector(`[data-view="${viewName}"], #nav-btn-${viewName}`);
    if (!navItem) return;

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
    const navItem = document.querySelector(`[data-view="${viewName}"], #nav-btn-${viewName}`);
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
