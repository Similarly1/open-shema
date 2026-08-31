/**
 * Sermons View Controller — Studio de Prédication Modulaire & Hub de Cartes
 * 
 * Architecture en 3 Sous-pages Homilétiques :
 * 1. « Mes Prédications » (Hub en grille de cartes modernes, filtres statut & séries, recherche).
 * 2. « Studio de Rédaction » (Espace plein écran épuré, sans volet gauche encombrant, sommaire interactif, blocs modulaires).
 * 3. « Banque d'Illustrations » (Hub d'anecdotes et récits avec anti-redite).
 */

const SermonsView = {
  sermons: [],
  illustrations: [],
  currentSermon: null,
  currentFilter: 'all',
  activeDrawerTab: 'metadata',
  
  // Blocs de sections modulaires
  sections: [],
  activeSectionId: null,
  
  // Undo / Redo
  history: [],
  historyIndex: -1,
  maxHistory: 60,
  historyDebounceTimer: null,
  saveDebounceTimer: null,
  
  // Mode Pupitre
  pulpitChronoSeconds: 0,
  pulpitChronoTimer: null,
  pulpitIsPlaying: false,
  pulpitFontSize: 24,
  pulpitWakeLock: null,

  // Éléments du Hub
  hubCardsContainer: null,
  hubSearchInput: null,
  lblSermonsCount: null,

  // Éléments du Studio de Rédaction
  titleInput: null,
  churchInput: null,
  refInput: null,
  dateInput: null,
  seriesInput: null,
  bigIdeaInput: null,
  goalInput: null,
  resourcesDrawer: null,
  drawerContent: null,
  blocksContainer: null,
  outlineList: null,

  // Métriques
  lblEstTime: null,
  lblWordCount: null,
  barExegesis: null,
  barIllustration: null,
  barApplication: null,

  init() {
    // 1. Hub de cartes
    this.hubCardsContainer = document.getElementById('sermons-hub-cards-container');
    this.hubSearchInput = document.getElementById('sermons-hub-search-input');
    this.lblSermonsCount = document.getElementById('lbl-sermons-count');

    // 2. Studio de Rédaction
    this.titleInput = document.getElementById('sermon-edit-title');
    this.churchInput = document.getElementById('sermon-edit-church');
    this.refInput = document.getElementById('sermon-edit-ref');
    this.dateInput = document.getElementById('sermon-edit-date');
    this.seriesInput = document.getElementById('sermon-edit-series');
    this.bigIdeaInput = document.getElementById('sermon-edit-bigidea');
    this.goalInput = document.getElementById('sermon-edit-goal');
    this.resourcesDrawer = document.getElementById('sermons-resources-drawer');
    this.drawerContent = document.getElementById('sermons-drawer-content');
    this.blocksContainer = document.getElementById('sermon-blocks-container');
    this.outlineList = document.getElementById('sermon-outline-list');

    this.lblEstTime = document.getElementById('lbl-sermon-est-time');
    this.lblWordCount = document.getElementById('lbl-sermon-word-count');
    this.barExegesis = document.getElementById('bar-seg-exegesis');
    this.barIllustration = document.getElementById('bar-seg-illustration');
    this.barApplication = document.getElementById('bar-seg-application');

    this.initDrawerWidth();
    this.initIllustrationPickerModal();
    this.bindEvents();
  },

  initDrawerWidth() {
    const saved = localStorage.getItem('sermon_drawer_width');
    if (saved && this.resourcesDrawer) {
      this.resourcesDrawer.style.setProperty('--sermon-drawer-width', `${saved}px`);
    }
  },

  bindDrawerResizer() {
    const resizer = document.getElementById('sermon-drawer-resizer');
    const drawer = this.resourcesDrawer || document.getElementById('sermons-resources-drawer');
    const expandBtn = document.getElementById('btn-expand-resources-drawer');

    const updateExpandBtnUi = (isWide) => {
      if (!expandBtn) return;
      expandBtn.title = isWide ? "Réduire le volet (Taille normale)" : "Agrandir le volet (Mode Large)";
      expandBtn.classList.toggle('active', isWide);
      expandBtn.innerHTML = isWide
        ? `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`
        : `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`;
    };

    expandBtn?.addEventListener('click', () => {
      drawer?.classList.toggle('wide');
      const isWide = drawer?.classList.contains('wide');
      updateExpandBtnUi(isWide);

      // Si on agrandit le volet droit en mode large -> réduire automatiquement le plan de prédication
      if (isWide) {
        this.toggleOutlinePanel(false);
      } else {
        this.toggleOutlinePanel(true);
      }
    });

    if (!resizer || !drawer) return;

    let isResizing = false;
    let startX = 0;
    let startWidth = 0;

    resizer.addEventListener('mousedown', (e) => {
      isResizing = true;
      startX = e.clientX;
      startWidth = drawer.offsetWidth;
      resizer.classList.add('resizing');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isResizing) return;
      const delta = startX - e.clientX;
      const newWidth = Math.min(760, Math.max(360, startWidth + delta));
      drawer.style.setProperty('--sermon-drawer-width', `${newWidth}px`);
    });

    document.addEventListener('mouseup', () => {
      if (!isResizing) return;
      isResizing = false;
      resizer.classList.remove('resizing');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      const finalWidth = drawer.offsetWidth;
      localStorage.setItem('sermon_drawer_width', finalWidth);
    });
  },

  getDefaultSermonTemplate() {
    const todayStr = new Date().toISOString().split('T')[0];
    return {
      id: `sermon-${Date.now()}`,
      title: "Nouvelle prédication",
      church: "",
      date_planned: todayStr,
      status: "draft",
      series: { title: "" },
      passage: { reference: "" },
      big_idea: "",
      goal: "",
      timing: { target_duration_min: 35, words_per_minute: 135 },
      body: `## Introduction

Accroche et tension contemporaine...

## Lecture du passage

> [!scripture]
> « Insérez le texte biblique ici »

## I. Premier Point Principal

Explication textuelle et fondement doctrinal...

## II. Deuxième Point Principal

Développement théologique et illustration concrète...

## Conclusion & Appel

Synthèse de la pensée maîtresse et application pour la semaine...`
    };
  },

  ensureCurrentSermon() {
    if (!this.currentSermon) {
      this.currentSermon = this.getDefaultSermonTemplate();
    }
    return this.currentSermon;
  },

  focusActiveEditor() {
    if (this.sections.length === 0) {
      this.addSection('point');
    }
    let targetEditor = null;
    if (this.activeSectionId) {
      const card = document.getElementById(`section-card-${this.activeSectionId}`);
      targetEditor = card?.querySelector('.sermon-section-editor');
    }
    if (!targetEditor) {
      const firstCard = document.querySelector('.sermon-section-card');
      targetEditor = firstCard?.querySelector('.sermon-section-editor');
    }
    if (targetEditor) {
      targetEditor.focus();
      return targetEditor;
    }
    return null;
  },

  bindEvents() {
    // 1. Actions du Hub de prédications
    document.getElementById('btn-hub-new-sermon')?.addEventListener('click', () => this.createNewSermon());
    document.getElementById('btn-hub-open-folder')?.addEventListener('click', () => this.openSermonsFolder());
    document.getElementById('btn-hub-import')?.addEventListener('click', () => this.importSermon());

    this.hubSearchInput?.addEventListener('input', () => {
      const val = this.hubSearchInput.value.trim();
      const clearBtn = document.getElementById('btn-clear-sermons-hub-search');
      if (clearBtn) clearBtn.classList.toggle('hidden', !val);
      this.renderHubCards();
    });

    document.getElementById('btn-clear-sermons-hub-search')?.addEventListener('click', () => {
      if (this.hubSearchInput) this.hubSearchInput.value = '';
      document.getElementById('btn-clear-sermons-hub-search')?.classList.add('hidden');
      this.renderHubCards();
    });

    document.querySelectorAll('#sermons-hub-status-pills .sermon-hub-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('#sermons-hub-status-pills .sermon-hub-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.currentFilter = pill.dataset.filter || 'all';
        this.renderHubCards();
      });
    });

    // 2. Navigation Studio <-> Hub
    document.getElementById('btn-sermon-back-to-hub')?.addEventListener('click', () => this.openHub());

    // 3. Actions Studio de Rédaction
    document.getElementById('btn-save-current-sermon')?.addEventListener('click', () => this.saveCurrentSermon());
    document.getElementById('btn-delete-current-sermon')?.addEventListener('click', () => this.deleteCurrentSermon());
    document.getElementById('btn-sermon-undo')?.addEventListener('click', () => this.undo());
    document.getElementById('btn-sermon-redo')?.addEventListener('click', () => this.redo());

    // 4. Tiroir de ressources & redimensionnement
    document.getElementById('btn-sermon-toggle-drawer')?.addEventListener('click', () => this.toggleResourcesDrawer());
    document.getElementById('btn-close-resources-drawer')?.addEventListener('click', () => this.toggleResourcesDrawer(false));
    this.bindDrawerResizer();

    // 4b. Bascule manuelle du volet de Plan de la prédication
    document.getElementById('btn-sermon-toggle-outline')?.addEventListener('click', () => this.toggleOutlinePanel());

    // Clic sur le fil d'ariane pour ouvrir les détails homilétiques
    document.getElementById('sermon-header-summary')?.addEventListener('click', () => {
      this.toggleResourcesDrawer(true);
      this.activeDrawerTab = 'metadata';
      document.querySelectorAll('#sermon-drawer-tabs-bar .drawer-tab').forEach(b => {
        b.classList.toggle('active', b.dataset.drawerTab === 'metadata');
      });
      this.renderDrawerContent();
    });

    // 5. Onglets du tiroir
    document.querySelectorAll('#sermon-drawer-tabs-bar .drawer-tab').forEach(tabBtn => {
      tabBtn.addEventListener('click', () => {
        document.querySelectorAll('#sermon-drawer-tabs-bar .drawer-tab').forEach(b => b.classList.remove('active'));
        tabBtn.classList.add('active');
        this.activeDrawerTab = tabBtn.dataset.drawerTab || 'overview';
        this.renderDrawerContent();
      });
    });

    // 6. Infobulle flottante Anytype & Commandes Slash
    this.bindFloatingToolbar();

    // 7. Actions Sommaire & Ajout de sections
    document.getElementById('btn-sermon-toggle-all-sections')?.addEventListener('click', () => this.toggleAllSections());
    document.getElementById('btn-outline-add-point')?.addEventListener('click', () => this.addSection('point'));
    document.getElementById('btn-add-section-point')?.addEventListener('click', () => this.addSection('point'));
    document.getElementById('btn-add-section-scripture')?.addEventListener('click', () => this.addSection('scripture'));
    document.getElementById('btn-add-section-conclusion')?.addEventListener('click', () => this.addSection('conclusion'));

    // 8. Titre du sermon
    this.titleInput?.addEventListener('input', () => {
      this.ensureCurrentSermon();
      if (this.currentSermon) this.currentSermon.title = this.titleInput.value.trim();
      this.debouncedPushHistory();
      this.debouncedAutoSave();
    });

    // 9. Mode Pupitre
    document.getElementById('btn-sermon-pulpit-mode')?.addEventListener('click', () => this.openPulpitMode());
    document.getElementById('btn-pulpit-exit')?.addEventListener('click', () => this.closePulpitMode());
    document.getElementById('btn-pulpit-play-pause')?.addEventListener('click', () => this.togglePulpitChrono());
    document.getElementById('btn-pulpit-reset-chrono')?.addEventListener('click', () => this.resetPulpitChrono());
    document.getElementById('btn-pulpit-font-inc')?.addEventListener('click', () => this.changePulpitFontSize(2));
    document.getElementById('btn-pulpit-font-dec')?.addEventListener('click', () => this.changePulpitFontSize(-2));
    document.getElementById('btn-pulpit-fullscreen')?.addEventListener('click', () => this.toggleFullscreen());
    
    // Conseils de chaire Spurgeon
    document.getElementById('btn-pulpit-spurgeon-tips')?.addEventListener('click', () => {
      document.getElementById('pulpit-spurgeon-drawer')?.classList.toggle('hidden');
    });
    document.getElementById('btn-close-spurgeon-drawer')?.addEventListener('click', () => {
      document.getElementById('pulpit-spurgeon-drawer')?.classList.add('hidden');
    });

    // Touche Échap pour quitter le mode pupitre
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const pulpitModal = document.getElementById('sermon-pulpit-modal');
        if (pulpitModal && !pulpitModal.classList.contains('hidden')) {
          this.closePulpitMode();
        }
      }
    });
  },

  showHubLoading() {
    if (this.lblSermonsCount && (!this.sermons || this.sermons.length === 0)) {
      this.lblSermonsCount.innerHTML = `<span class="synth-spinner" style="width: 10px; height: 10px; border-width: 1.5px; display: inline-block; vertical-align: middle; margin-right: 5px; border-top-color: var(--accent-amber, #f59e0b);"></span> Chargement...`;
    }
    if (this.hubCardsContainer && (!this.sermons || this.sermons.length === 0)) {
      this.hubCardsContainer.innerHTML = `
        <div style="padding: 70px 24px; text-align: center; color: var(--text-muted); width: 100%; grid-column: 1 / -1;">
          <div class="synth-spinner" style="width: 32px; height: 32px; border-width: 3px; margin: 0 auto 16px auto; border-top-color: var(--accent-amber, #f59e0b);"></div>
          <div style="font-size: 15px; font-weight: 600; color: var(--text-primary); margin-bottom: 6px;">Chargement de vos prédications...</div>
          <div style="font-size: 12.5px; opacity: 0.75;">Indexation et préparation du carnet homilétique</div>
        </div>
      `;
    }
  },

  async onViewActivated() {
    this.showHubLoading();
    await this.loadSermons();
    await this.loadIllustrations();
    this.renderHubCards();
  },

  openHub() {
    if (this.currentSermon && !this.currentSermon.isNewDraft) {
      this.saveCurrentSermon(true);
    }
    if (typeof App !== 'undefined') {
      if (App.sidebarAutoCollapsed && App.setSidebarCollapsed) {
        App.setSidebarCollapsed(false, true);
      }
      App.switchView('sermons');
    }
    this.renderHubCards();
  },

  async openEditor(sermon = null) {
    if (!sermon) {
      if (this.currentSermon) {
        sermon = this.currentSermon;
      } else {
        if (this.sermons.length === 0) {
          this.showHubLoading();
          await this.loadSermons();
        }
        if (this.sermons.length > 0) {
          sermon = await API.getSermon(this.sermons[0].id) || this.sermons[0];
        } else {
          await this.createNewSermon();
          return;
        }
      }
    }

    this.currentSermon = sermon;
    if (typeof App !== 'undefined') {
      App.switchView('sermon-editor');
    }
    this.populateEditor(sermon);
    this.resetHistory();
    this.syncPassageResources();
  },

  // =========================================================================
  // CHARGEMENT & GESTION DU HUB DE PRÉDICATIONS (VUE EN CARTES)
  // =========================================================================

  async loadSermons() {
    this.showHubLoading();
    try {
      const list = await API.getSermonsList();
      this.sermons = Array.isArray(list) ? list : [];
      if (!this.currentSermon && this.sermons.length > 0) {
        this.currentSermon = this.sermons[0];
      }
    } catch (e) {
      console.error('Erreur chargement des sermons:', e);
    }
  },

  async loadIllustrations() {
    try {
      const list = await API.getIllustrationsList();
      this.illustrations = Array.isArray(list) ? list : [];
    } catch (e) {
      console.warn('Erreur chargement des illustrations:', e);
    }
  },

  renderHubCards() {
    if (!this.hubCardsContainer) return;
    const q = (this.hubSearchInput?.value || '').toLowerCase().trim();

    let filtered = this.sermons.filter(s => {
      const matchQuery = !q || 
        (s.title || '').toLowerCase().includes(q) ||
        (s.church || '').toLowerCase().includes(q) ||
        (s.passage?.reference || '').toLowerCase().includes(q) ||
        (s.series?.title || '').toLowerCase().includes(q) ||
        (s.theme_tags || []).some(t => t.toLowerCase().includes(q));

      if (!matchQuery) return false;

      if (this.currentFilter === 'ready') return s.status === 'ready';
      if (this.currentFilter === 'draft') return s.status === 'draft';
      return true;
    });

    if (this.lblSermonsCount) {
      const count = filtered.length;
      this.lblSermonsCount.textContent = `${count} ${count > 1 ? 'prédications' : 'prédication'}`;
    }

    if (filtered.length === 0) {
      this.hubCardsContainer.innerHTML = `
        <div style="padding: 56px 24px; text-align: center; color: var(--text-muted);">
          <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 14px; opacity: 0.4;">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="22"/>
            <line x1="8" y1="22" x2="16" y2="22"/>
          </svg>
          <div style="font-size: 15px; font-weight: 700; color: var(--text-primary); margin-bottom: 6px;">Aucune prédication trouvée</div>
          <div style="font-size: 13px; max-width: 400px; margin: 0 auto 16px auto;">Créez votre première prédication ou modifiez vos termes de recherche.</div>
          <button class="btn-primary" id="btn-empty-new-sermon" style="display: inline-flex; align-items: center; gap: 6px; margin: 0 auto;">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            <span>Nouvelle Prédication</span>
          </button>
        </div>
      `;
      document.getElementById('btn-empty-new-sermon')?.addEventListener('click', () => this.createNewSermon());
      return;
    }

    const cardsHtml = filtered.map(sermon => {
      const statusClass = sermon.status === 'ready' ? 'status-ready' : 'status-draft';
      const statusLabel = sermon.status === 'ready' ? 'Prêt pour la chaire' : 'Brouillon en cours';
      const ref = sermon.passage?.reference || 'Sans passage lié';
      const date = sermon.date_planned || '';
      const church = sermon.church || '';
      const series = sermon.series?.title || '';
      const targetMin = sermon.timing?.target_duration_min || 35;
      const bigIdea = sermon.big_idea || sermon.pmt || sermon.contemporary_tension || '';

      return `
        <article class="sermon-card" data-sermon-id="${sermon.id}">
          <div class="sermon-card-header">
            <span class="sermon-card-badge ${statusClass}">${statusLabel}</span>
            <span class="sermon-card-timing">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <span>${targetMin} min</span>
            </span>
          </div>

          <h2 class="sermon-card-title">${this.escapeHtml(sermon.title || 'Prédication sans titre')}</h2>

          <div class="sermon-card-meta">
            <span class="sermon-card-passage">${this.escapeHtml(ref)}</span>
            ${church ? `<span>• ${this.escapeHtml(church)}</span>` : ''}
            ${date ? `<span>• ${this.escapeHtml(date)}</span>` : ''}
            ${series ? `<span>• Série : ${this.escapeHtml(series)}</span>` : ''}
          </div>

          ${bigIdea ? `<div class="sermon-card-idea">« ${this.escapeHtml(bigIdea)} »</div>` : ''}

          <div class="sermon-card-footer">
            <button class="btn-primary btn-card-action btn-open-sermon-editor" data-sermon-id="${sermon.id}" title="Ouvrir dans le studio de rédaction">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              <span>Rédiger</span>
            </button>
            <div class="sermon-card-actions">
              <button class="btn-secondary btn-card-action btn-card-pulpit" data-sermon-id="${sermon.id}" title="Lancer le Mode Pupitre directement" style="color: var(--accent-orange, #f59e0b);">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg>
                <span>Pupitre</span>
              </button>
              <button class="btn-icon-subtle btn-card-more-options" data-sermon-id="${sermon.id}" title="Plus d'options">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>
              </button>
            </div>
          </div>
        </article>
      `;
    }).join('');

    this.hubCardsContainer.innerHTML = `<div class="sermons-grid">${cardsHtml}</div>`;

    // Événements sur les cartes
    this.hubCardsContainer.querySelectorAll('.sermon-card').forEach(card => {
      card.addEventListener('click', async (e) => {
        if (e.target.closest('.btn-card-action') || e.target.closest('.btn-card-more-options')) return;
        const id = card.dataset.sermonId;
        const sermon = await API.getSermon(id);
        if (sermon) this.openEditor(sermon);
      });
    });

    this.hubCardsContainer.querySelectorAll('.btn-open-sermon-editor').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.sermonId;
        const sermon = await API.getSermon(id);
        if (sermon) this.openEditor(sermon);
      });
    });

    this.hubCardsContainer.querySelectorAll('.btn-card-pulpit').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.sermonId;
        const sermon = await API.getSermon(id);
        if (sermon) {
          this.currentSermon = sermon;
          this.populateEditor(sermon);
          this.openPulpitMode();
        }
      });
    });

    // Menu 3 points "Plus d'options"
    this.hubCardsContainer.querySelectorAll('.btn-card-more-options').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.sermonId;
        const sermon = this.sermons.find(s => s.id === id);
        if (sermon) this.openCardMoreMenu(sermon, btn);
      });
    });
  },

  openCardMoreMenu(sermon, anchorBtn) {
    this.closeCardMoreMenu();

    const menu = document.createElement('div');
    menu.id = 'sermon-card-more-menu-active';
    menu.className = 'sermon-card-more-menu';

    const isReady = sermon.status === 'ready';
    const statusActionLabel = isReady ? 'Repasser en brouillon' : 'Marquer comme prêt';
    const nextStatus = isReady ? 'draft' : 'ready';

    menu.innerHTML = `
      <button class="sermon-menu-item" id="menu-action-rename">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
        <span>Renommer</span>
      </button>
      <button class="sermon-menu-item" id="menu-action-status">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        <span>${statusActionLabel}</span>
      </button>
      <button class="sermon-menu-item" id="menu-action-duplicate">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
        <span>Dupliquer</span>
      </button>
      <div class="sermon-menu-divider"></div>
      <button class="sermon-menu-item danger" id="menu-action-delete">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/></svg>
        <span>Supprimer</span>
      </button>
    `;

    document.body.appendChild(menu);

    // Positionner sous ou au-dessus du bouton
    const rect = anchorBtn.getBoundingClientRect();
    const menuWidth = 180;
    let left = rect.right - menuWidth;
    if (left < 10) left = 10;
    let top = rect.bottom + 6;
    if (top + 160 > window.innerHeight) {
      top = rect.top - 150;
    }

    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;

    // Événements du menu
    menu.querySelector('#menu-action-rename')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeCardMoreMenu();
      this.promptRenameSermon(sermon);
    });

    menu.querySelector('#menu-action-status')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeCardMoreMenu();
      this.toggleSermonStatus(sermon, nextStatus);
    });

    menu.querySelector('#menu-action-duplicate')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeCardMoreMenu();
      this.duplicateSermon(sermon);
    });

    menu.querySelector('#menu-action-delete')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeCardMoreMenu();
      this.deleteSermon(sermon.id);
    });

    // Fermeture si clic extérieur
    const onDocClick = (e) => {
      if (!menu.contains(e.target) && e.target !== anchorBtn) {
        this.closeCardMoreMenu();
        document.removeEventListener('click', onDocClick);
      }
    };
    setTimeout(() => document.addEventListener('click', onDocClick), 20);
  },

  closeCardMoreMenu() {
    const existing = document.getElementById('sermon-card-more-menu-active');
    if (existing) existing.remove();
  },

  async promptRenameSermon(sermon) {
    if (!sermon) return;
    const newTitle = await App.showPromptModal({
      title: "Renommer la prédication",
      message: "Entrez le nouveau titre du sermon :",
      defaultValue: sermon.title || "",
      placeholder: "Titre de la prédication...",
      confirmText: "Renommer"
    });

    if (!newTitle || newTitle === sermon.title) return;

    try {
      // Mise à jour optimiste
      sermon.title = newTitle;
      const found = this.sermons.find(s => s.id === sermon.id);
      if (found) found.title = newTitle;
      if (this.currentSermon?.id === sermon.id) {
        this.currentSermon.title = newTitle;
        if (this.titleInput) this.titleInput.value = newTitle;
        this.updateHeaderSummary(this.currentSermon);
      }
      this.renderHubCards();

      const fullSermon = await API.getSermon(sermon.id) || sermon;
      fullSermon.title = newTitle;
      const res = await API.saveSermon(fullSermon);
      if (res && res.success) {
        await this.loadSermons();
        this.renderHubCards();
        if (typeof App !== 'undefined' && App.showToast) {
          App.showToast("Prédication renommée !");
        }
      }
    } catch (e) {
      console.error('Erreur renommage sermon:', e);
    }
  },

  async toggleSermonStatus(sermon, newStatus) {
    if (!sermon) return;
    try {
      // 1. Mise à jour immédiate et optimiste en mémoire
      sermon.status = newStatus;
      const found = this.sermons.find(s => s.id === sermon.id);
      if (found) found.status = newStatus;
      if (this.currentSermon && this.currentSermon.id === sermon.id) {
        this.currentSermon.status = newStatus;
      }
      this.renderHubCards();

      // 2. Sauvegarde sur disque
      const fullSermon = await API.getSermon(sermon.id) || sermon;
      fullSermon.status = newStatus;
      const res = await API.saveSermon(fullSermon);
      if (res && res.success) {
        if (res.sermon) {
          const idx = this.sermons.findIndex(s => s.id === sermon.id);
          if (idx !== -1) this.sermons[idx] = { ...this.sermons[idx], ...res.sermon };
          if (this.currentSermon?.id === sermon.id) this.currentSermon = res.sermon;
        }
        await this.loadSermons();
        this.renderHubCards();
        if (typeof App !== 'undefined' && App.showToast) {
          App.showToast(newStatus === 'ready' ? "Prédication marquée comme prête pour la chaire !" : "Prédication remise en brouillon.");
        }
      }
    } catch (e) {
      console.error('Erreur changement statut sermon:', e);
    }
  },

  async duplicateSermon(sermon) {
    if (!sermon) return;
    try {
      const fullSermon = await API.getSermon(sermon.id) || sermon;
      const newId = `sermon-${Date.now()}`;
      const duplicate = {
        ...fullSermon,
        id: newId,
        title: `${fullSermon.title || 'Prédication'} (Copie)`,
        date_planned: new Date().toISOString().split('T')[0],
        status: 'draft'
      };
      // Supprimer explicitement les références du fichier d'origine
      delete duplicate.filename;
      delete duplicate.file_path;

      const res = await API.saveSermon(duplicate);
      if (res && res.success) {
        await this.loadSermons();
        this.renderHubCards();
        if (typeof App !== 'undefined' && App.showToast) {
          App.showToast("Prédication dupliquée avec succès !");
        }
      }
    } catch (e) {
      console.error('Erreur duplication sermon:', e);
    }
  },

  populateEditor(sermon) {
    if (!sermon) {
      sermon = this.ensureCurrentSermon();
    }
    this.currentSermon = sermon;
    if (this.titleInput) this.titleInput.value = sermon.title || '';
    this.updateHeaderSummary(sermon);

    // Découpage du corps Markdown en sections modulaires
    this.parseMarkdownIntoSections(sermon.body || '');
    this.renderSections();
    this.renderOutline();
    this.updateMetrics();
    this.renderDrawerContent();
    this.updateAutoSaveIndicator('saved');
  },

  updateAutoSaveIndicator(status) {
    const el = document.getElementById('sermon-autosave-indicator');
    if (!el) return;

    if (status === 'saving') {
      el.className = 'note-autosave-indicator saving';
      el.innerHTML = `
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
        <span>Enregistrement...</span>
      `;
    } else if (status === 'dirty') {
      el.className = 'note-autosave-indicator dirty';
      el.innerHTML = `
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="4" fill="currentColor"/></svg>
        <span>Modifié</span>
      `;
    } else if (status === 'saved') {
      el.className = 'note-autosave-indicator';
      el.innerHTML = `
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
        <span>Enregistré</span>
      `;
    }
  },

  updateHeaderSummary(sermon = this.currentSermon) {
    if (!sermon) return;
    const churchEl = document.getElementById('summary-church');
    const refEl = document.getElementById('summary-ref');
    const dateEl = document.getElementById('summary-date');

    const church = sermon.church?.trim() || 'Lieu non spécifié';
    const ref = sermon.passage?.reference?.trim() || 'Passage non lié';
    const date = sermon.date_planned || 'Date à définir';

    if (churchEl) churchEl.textContent = church;
    if (refEl) refEl.textContent = ref;
    if (dateEl) dateEl.textContent = date;
  },

  async createNewSermon() {
    // Si on est déjà sur un brouillon neuf vierge non modifié, rester dessus sans recréer
    if (this.currentSermon && this.currentSermon.isNewDraft && !this.isSermonModified()) {
      await this.openEditor(this.currentSermon);
      if (this.titleInput) {
        this.titleInput.focus();
        this.titleInput.select();
      }
      return;
    }

    // Sauvegarder le sermon existant en cours si nécessaire
    if (this.currentSermon && !this.currentSermon.isNewDraft) {
      await this.saveCurrentSermon(true);
    }

    const template = this.getDefaultSermonTemplate();
    template.isNewDraft = true;
    template.id = null; // Pas encore de fichier disque

    this.currentSermon = template;
    await this.openEditor(template);
    if (this.titleInput) {
      this.titleInput.focus();
      this.titleInput.select();
    }
  },

  isSermonModified() {
    if (!this.currentSermon) return false;
    const currentTitle = (this.titleInput?.value || this.currentSermon.title || '').trim();
    const isTitleChanged = currentTitle !== "Nouvelle prédication" && currentTitle !== "" && currentTitle !== "Prédication sans titre";

    const church = (this.currentSermon.church || '').trim();
    const ref = (this.currentSermon.passage?.reference || '').trim();
    const pmt = (this.currentSermon.pmt || this.currentSermon.big_idea || '').trim();
    const pms = (this.currentSermon.pms || '').trim();
    const tension = (this.currentSermon.contemporary_tension || '').trim();
    const goal = (this.currentSermon.goal || '').trim();

    if (isTitleChanged || church || ref || pmt || pms || tension || goal) {
      return true;
    }

    if (this.sections && this.sections.length > 0) {
      for (const sec of this.sections) {
        const text = (sec.contentHtml || '').replace(/<[^>]+>/g, ' ').trim();
        if (text && !this.isDefaultPlaceholder(text)) {
          return true;
        }
      }
    }

    return false;
  },

  async importSermon() {
    try {
      const res = await API.importSermon();
      if (res && res.cancelled) return;
      if (res && res.success && res.sermon) {
        await this.loadSermons();
        await this.openEditor(res.sermon);
        if (typeof App !== 'undefined' && App.showToast) {
          App.showToast(`Prédication "${res.sermon.title}" importée avec succès !`);
        }
      } else if (res && res.error) {
        if (typeof App !== 'undefined' && App.showToast) {
          App.showToast(`Erreur lors de l'import : ${res.error}`, "error");
        }
      }
    } catch (e) {
      console.error('Erreur import prédication:', e);
    }
  },

  async saveCurrentSermon(silent = true) {
    this.ensureCurrentSermon();
    if (!this.currentSermon) return;

    // Ne rien écrire sur le disque si la nouvelle prédication est encore un brouillon vierge non modifié
    if (this.currentSermon.isNewDraft && !this.isSermonModified()) {
      this.updateAutoSaveIndicator('saved');
      return;
    }

    this.updateAutoSaveIndicator('saving');

    const bodyMarkdown = this.serializeSectionsToMarkdown();
    const sermonId = this.currentSermon.id || `sermon-${Date.now()}`;
    
    const payload = {
      ...this.currentSermon,
      id: sermonId,
      title: this.titleInput?.value.trim() || 'Prédication sans titre',
      church: this.currentSermon.church || '',
      date_planned: this.currentSermon.date_planned || new Date().toISOString().split('T')[0],
      series: {
        ...(this.currentSermon.series || {}),
        title: this.currentSermon.series?.title || ''
      },
      passage: {
        ...(this.currentSermon.passage || {}),
        reference: this.currentSermon.passage?.reference || ''
      },
      big_idea: this.currentSermon.big_idea || this.currentSermon.pmt || '',
      pmt: this.currentSermon.pmt || this.currentSermon.big_idea || '',
      pms: this.currentSermon.pms || '',
      contemporary_tension: this.currentSermon.contemporary_tension || '',
      redemptive_era: this.currentSermon.redemptive_era || 'christ',
      goal: this.currentSermon.goal || '',
      body: bodyMarkdown
    };

    delete payload.isNewDraft;

    try {
      const res = await API.saveSermon(payload);
      if (res && res.success) {
        this.currentSermon = res.sermon || payload;
        this.currentSermon.isNewDraft = false;
        this.updateHeaderSummary(this.currentSermon);
        this.updateAutoSaveIndicator('saved');
        await this.loadSermons();
        if (!silent && typeof App !== 'undefined' && App.showToast) {
          App.showToast("Prédication enregistrée !");
        }
      } else {
        this.updateAutoSaveIndicator('dirty');
      }
    } catch (e) {
      console.error('Erreur sauvegarde sermon:', e);
      this.updateAutoSaveIndicator('dirty');
    }
  },

  debouncedAutoSave() {
    this.updateAutoSaveIndicator('dirty');
    if (this.saveDebounceTimer) clearTimeout(this.saveDebounceTimer);
    this.saveDebounceTimer = setTimeout(() => {
      this.saveCurrentSermon(true);
    }, 1200);
  },

  async deleteSermon(sermonId) {
    if (!sermonId) return;
    const sermon = this.sermons.find(s => s.id === sermonId);
    const targetTitle = sermon?.title || 'cette prédication';

    let confirmed = false;
    if (typeof App !== 'undefined' && App.showConfirmModal) {
      confirmed = await App.showConfirmModal({
        title: "Supprimer la prédication",
        message: `Voulez-vous supprimer définitivement la prédication "${targetTitle}" ?`,
        confirmText: "Supprimer",
        cancelText: "Annuler",
        danger: true,
        icon: "trash"
      });
    } else {
      confirmed = confirm(`Voulez-vous supprimer définitivement la prédication "${targetTitle}" ?`);
    }

    if (!confirmed) return;

    try {
      const res = await API.deleteSermon(sermonId);
      if (res && res.success) {
        if (this.currentSermon?.id === sermonId) {
          this.currentSermon = null;
        }
        await this.loadSermons();
        this.renderHubCards();
        if (typeof App !== 'undefined' && App.showToast) {
          App.showToast("Prédication supprimée avec succès.");
        }
      }
    } catch (e) {
      console.error('Erreur suppression sermon:', e);
    }
  },

  async deleteCurrentSermon() {
    if (!this.currentSermon) return;
    if (this.currentSermon.isNewDraft || !this.currentSermon.id) {
      this.currentSermon = null;
      this.openHub();
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast("Brouillon annulé.");
      }
      return;
    }
    await this.deleteSermon(this.currentSermon.id);
    this.openHub();
  },

  async openSermonsFolder() {
    try {
      const res = await API.openSermonsFolder();
      if (res && res.success && typeof App !== 'undefined' && App.showToast) {
        App.showToast(`Dossier ouvert : ${res.path}`);
      }
    } catch (e) {
      console.error('Erreur ouverture dossier:', e);
    }
  },

  // =========================================================================
  // MOTEUR MODULAIRE DE SECTIONS & OUTLINE
  // =========================================================================

  parseMarkdownIntoSections(markdown) {
    if (!markdown || !markdown.trim()) {
      this.sections = [
        { id: `sec_${Date.now()}_1`, type: 'intro', title: 'Introduction', contentHtml: '<p>Accroche, mise en contexte et tension contemporaine...</p>', isCollapsed: false, wordCount: 0, estMinutes: 0 },
        { id: `sec_${Date.now()}_2`, type: 'scripture', title: 'Lecture du passage', contentHtml: '<p>« Insérez le texte biblique ici... »</p>', isCollapsed: false, wordCount: 0, estMinutes: 0 },
        { id: `sec_${Date.now()}_3`, type: 'point', title: 'I. Premier Point Principal', contentHtml: '<p>Explication du texte et fondement doctrinal...</p>', isCollapsed: false, wordCount: 0, estMinutes: 0 },
        { id: `sec_${Date.now()}_4`, type: 'point', title: 'II. Deuxième Point Principal', contentHtml: '<p>Développement théologique et résonance...</p>', isCollapsed: false, wordCount: 0, estMinutes: 0 },
        { id: `sec_${Date.now()}_5`, type: 'conclusion', title: 'Conclusion & Appel', contentHtml: '<p>Synthèse de la pensée maîtresse et application pour la semaine...</p>', isCollapsed: false, wordCount: 0, estMinutes: 0 }
      ];
      return;
    }

    const lines = markdown.split('\n');
    let parsedSections = [];
    let currentSec = null;

    for (let line of lines) {
      const match = line.match(/^#{1,3}\s+(.*)$/);
      if (match) {
        if (currentSec) {
          parsedSections.push(currentSec);
        }
        const title = match[1].trim();
        const type = this.detectSectionType(title);
        currentSec = {
          id: `sec_${Date.now()}_${parsedSections.length + 1}`,
          type: type,
          title: title,
          mdLines: [],
          isCollapsed: false,
          wordCount: 0,
          estMinutes: 0
        };
      } else {
        if (!currentSec) {
          currentSec = {
            id: `sec_${Date.now()}_1`,
            type: 'intro',
            title: 'Introduction',
            mdLines: [],
            isCollapsed: false,
            wordCount: 0,
            estMinutes: 0
          };
        }
        currentSec.mdLines.push(line);
      }
    }
    if (currentSec) {
      parsedSections.push(currentSec);
    }

    this.sections = parsedSections.map(sec => ({
      id: sec.id,
      type: sec.type,
      title: sec.title,
      contentHtml: this.markdownToEditorHtml((sec.mdLines || []).join('\n').trim()),
      isCollapsed: false,
      wordCount: 0,
      estMinutes: 0
    }));

    if (this.sections.length === 0) {
      this.sections = [
        { id: `sec_${Date.now()}_1`, type: 'point', title: 'Prédication', contentHtml: this.markdownToEditorHtml(markdown), isCollapsed: false, wordCount: 0, estMinutes: 0 }
      ];
    }
  },

  detectSectionType(title) {
    const t = (title || '').toLowerCase();
    if (t.includes('intro')) return 'intro';
    if (t.includes('lecture') || t.includes('passage') || t.includes('texte') || t.includes('verset')) return 'scripture';
    if (t.includes('concl') || t.includes('appel') || t.includes('synthèse') || t.includes('fin')) return 'conclusion';
    return 'point';
  },

  serializeSectionsToMarkdown() {
    return this.sections.map(sec => {
      const heading = `## ${sec.title || 'Section'}`;
      const body = this.editorHtmlToMarkdown(sec.contentHtml || '');
      return `${heading}\n\n${body}`;
    }).join('\n\n');
  },

  renderSections() {
    if (!this.blocksContainer) return;
    this.blocksContainer.innerHTML = '';

    const wpm = this.currentSermon?.timing?.words_per_minute || 135;

    this.sections.forEach((sec, idx) => {
      const card = document.createElement('div');
      card.className = `sermon-section-card ${sec.isCollapsed ? 'collapsed' : ''}`;
      card.id = `section-card-${sec.id}`;
      card.dataset.sectionId = sec.id;

      // Calcul mots et minutes de la section
      const words = (sec.contentHtml || '').replace(/<[^>]+>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
      sec.wordCount = words;
      sec.estMinutes = (words / wpm).toFixed(1);

      // Badge type
      let badgeHtml = `<span class="section-type-badge">${idx + 1}</span>`;
      if (sec.type === 'intro') badgeHtml = `<span class="section-type-badge badge-intro">Intro</span>`;
      else if (sec.type === 'scripture') badgeHtml = `<span class="section-type-badge badge-scripture">Texte</span>`;
      else if (sec.type === 'conclusion') badgeHtml = `<span class="section-type-badge badge-conclusion">Ccl</span>`;

      card.innerHTML = `
        <div class="section-card-header">
          <button class="btn-section-toggle" title="Replier / Déplier la section">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          ${badgeHtml}
          <input type="text" class="section-card-title-input" value="${this.escapeHtml(sec.title)}" placeholder="Titre de la section...">
          <div class="section-card-meta">
            <span class="section-badge-time" id="sec-badge-time-${sec.id}">${sec.estMinutes} min • ${sec.wordCount} mots</span>
            <div class="section-card-actions">
              <button class="btn-section-action btn-move-up" title="Monter cette section" ${idx === 0 ? 'disabled style="opacity:0.3;"' : ''}>
                <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg>
              </button>
              <button class="btn-section-action btn-move-down" title="Descendre cette section" ${idx === this.sections.length - 1 ? 'disabled style="opacity:0.3;"' : ''}>
                <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              <button class="btn-section-action btn-delete-section" title="Supprimer cette section">
                <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>
        </div>
        <div class="section-card-body">
          <div class="sermon-section-editor" contenteditable="true" spellcheck="true" data-placeholder="Rédigez le contenu de cette section... Tapez / pour insérer un bloc (exégèse, illustration, verset, diapo).">${sec.contentHtml || ''}</div>
        </div>
      `;

      // Event listeners sur la carte
      const toggleBtn = card.querySelector('.btn-section-toggle');
      toggleBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleSectionCollapse(sec.id);
      });

      const titleInput = card.querySelector('.section-card-title-input');
      titleInput?.addEventListener('input', () => {
        sec.title = titleInput.value;
        sec.type = this.detectSectionType(sec.title);
        this.renderOutline();
        this.debouncedAutoSave();
      });

      const editor = card.querySelector('.sermon-section-editor');
      
      const clearIfDefaultPlaceholder = () => {
        if (this.isDefaultPlaceholder(editor.innerHTML)) {
          editor.innerHTML = '<p><br></p>';
          sec.contentHtml = editor.innerHTML;
          this.updateMetrics();
          this.debouncedAutoSave();
        }
      };

      editor?.addEventListener('pointerdown', () => {
        clearIfDefaultPlaceholder();
      });

      editor?.addEventListener('focus', () => {
        this.activeSectionId = sec.id;
        this.highlightOutlineItem(sec.id);
        clearIfDefaultPlaceholder();
      });

      editor?.addEventListener('input', (e) => {
        sec.contentHtml = editor.innerHTML;
        const wCount = (editor.innerText || '').trim().split(/\s+/).filter(Boolean).length;
        sec.wordCount = wCount;
        sec.estMinutes = (wCount / wpm).toFixed(1);

        const badgeEl = document.getElementById(`sec-badge-time-${sec.id}`);
        if (badgeEl) badgeEl.textContent = `${sec.estMinutes} min • ${sec.wordCount} mots`;

        this.renderOutline();
        this.updateMetrics();
        this.debouncedPushHistory();
        this.debouncedAutoSave();
        this.handleSlashInput(e);

        editor.querySelectorAll('.sermon-block-illustration').forEach(b => {
          this.attachIllustrationBlockHelpers(b, sec.id);
        });
      });

      editor?.addEventListener('blur', () => {
        this.pushHistoryState();
      });

      editor?.addEventListener('keydown', (e) => {
        if (this.isSlashMenuOpen) {
          if (this.handleSlashKeyDown(e)) return;
        }

        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
          e.preventDefault();
          this.saveCurrentSermon();
        } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
          if (e.shiftKey) { e.preventDefault(); this.redo(); }
          else { e.preventDefault(); this.undo(); }
        }
      });

      card.querySelector('.btn-move-up')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.moveSection(sec.id, -1);
      });

      card.querySelector('.btn-move-down')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.moveSection(sec.id, 1);
      });

      card.querySelector('.btn-delete-section')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteSection(sec.id);
      });

      this.blocksContainer.appendChild(card);

      // Attacher les pastilles d'illustrations intelligentes sur chaque bloc d'illustration
      card.querySelectorAll('.sermon-block-illustration').forEach(b => {
        this.attachIllustrationBlockHelpers(b, sec.id);
      });
    });

    this.updateToggleAllSectionsButton();
  },

  isDefaultPlaceholder(htmlOrText) {
    if (!htmlOrText) return false;
    const clean = htmlOrText.replace(/<[^>]+>/g, '').trim();
    if (!clean) return false;
    const placeholders = [
      'Accroche, mise en contexte et tension contemporaine...',
      'Accroche et tension contemporaine...',
      '« Insérez le texte biblique ici... »',
      '« Insérez le texte biblique ici »',
      'Insérez le texte biblique ici...',
      'Insérez le texte biblique ici',
      'Explication du texte et fondement doctrinal...',
      'Explication textuelle et fondement doctrinal...',
      'Explication du texte...',
      'Développement théologique et illustration concrète...',
      'Développement théologique et résonance...',
      'Développement et vérité théologique...',
      'Synthèse de la pensée maîtresse et application pour la semaine...',
      'Synthèse et application concrète...',
      'Contenu de cette partie...'
    ];
    return placeholders.some(p => {
      const pClean = p.replace(/[«»….]/g, '').trim().toLowerCase();
      const cClean = clean.replace(/[«»….]/g, '').trim().toLowerCase();
      return pClean === cClean || (cClean.length > 6 && (pClean.includes(cClean) || cClean.includes(pClean)));
    });
  },

  renderOutline() {
    if (!this.outlineList) return;

    this.outlineList.innerHTML = this.sections.map((sec, idx) => {
      let icon = `${idx + 1}`;
      if (sec.type === 'intro') icon = 'Intro';
      else if (sec.type === 'scripture') icon = 'Texte';
      else if (sec.type === 'conclusion') icon = 'Ccl';

      const isActive = this.activeSectionId === sec.id;

      return `
        <div class="sermon-outline-item ${isActive ? 'active' : ''}" data-sec-id="${sec.id}" id="outline-item-${sec.id}">
          <div class="outline-item-left">
            <span class="outline-item-icon">${icon}</span>
            <span class="outline-item-title">${this.escapeHtml(sec.title || 'Sans titre')}</span>
          </div>
          <span class="outline-item-time">${sec.estMinutes || 0}m</span>
        </div>
      `;
    }).join('');

    this.outlineList.querySelectorAll('.sermon-outline-item').forEach(item => {
      item.addEventListener('click', () => {
        const secId = item.dataset.secId;
        this.scrollToSection(secId);
      });
    });
  },

  scrollToSection(secId) {
    this.activeSectionId = secId;
    this.highlightOutlineItem(secId);

    const card = document.getElementById(`section-card-${secId}`);
    const scrollPane = document.getElementById('sermon-blocks-scroll-pane');
    if (card && scrollPane) {
      const sec = this.sections.find(s => s.id === secId);
      if (sec && sec.isCollapsed) {
        this.toggleSectionCollapse(secId, false);
      }
      
      // Défilement doux précis
      const paneRect = scrollPane.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();
      const targetScrollTop = scrollPane.scrollTop + (cardRect.top - paneRect.top) - 18;

      scrollPane.scrollTo({
        top: Math.max(0, targetScrollTop),
        behavior: 'smooth'
      });

      const editor = card.querySelector('.sermon-section-editor');
      if (editor) {
        editor.focus({ preventScroll: true });
      }
    }
  },

  highlightOutlineItem(secId) {
    this.outlineList?.querySelectorAll('.sermon-outline-item').forEach(item => {
      item.classList.toggle('active', item.dataset.secId === secId);
    });
  },

  toggleSectionCollapse(secId, forceState) {
    const sec = this.sections.find(s => s.id === secId);
    if (!sec) return;

    sec.isCollapsed = typeof forceState === 'boolean' ? forceState : !sec.isCollapsed;
    const card = document.getElementById(`section-card-${secId}`);
    if (card) {
      card.classList.toggle('collapsed', sec.isCollapsed);
    }
    this.updateToggleAllSectionsButton();
  },

  toggleAllSections() {
    const hasExpanded = this.sections.some(s => !s.isCollapsed);
    if (hasExpanded) {
      this.collapseAllSections();
    } else {
      this.expandAllSections();
    }
  },

  updateToggleAllSectionsButton() {
    const btn = document.getElementById('btn-sermon-toggle-all-sections');
    if (!btn) return;
    const hasExpanded = this.sections.some(s => !s.isCollapsed);
    if (hasExpanded) {
      btn.title = "Tout replier";
      btn.setAttribute('aria-label', 'Tout replier');
      btn.innerHTML = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/></svg>`;
    } else {
      btn.title = "Tout déplier";
      btn.setAttribute('aria-label', 'Tout déplier');
      btn.innerHTML = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/></svg>`;
    }
  },

  collapseAllSections() {
    this.sections.forEach(s => s.isCollapsed = true);
    document.querySelectorAll('.sermon-section-card').forEach(c => c.classList.add('collapsed'));
    this.updateToggleAllSectionsButton();
  },

  expandAllSections() {
    this.sections.forEach(s => s.isCollapsed = false);
    document.querySelectorAll('.sermon-section-card').forEach(c => c.classList.remove('collapsed'));
    this.updateToggleAllSectionsButton();
  },

  addSection(type = 'point', title = '', content = '') {
    this.ensureCurrentSermon();
    this.pushHistoryState();
    const defaultTitles = {
      intro: 'Introduction',
      scripture: 'Lecture du passage',
      point: `Point ${this.sections.filter(s => s.type === 'point').length + 1}`,
      conclusion: 'Conclusion & Appel'
    };

    const newSec = {
      id: `sec_${Date.now()}_${this.sections.length + 1}`,
      type: type,
      title: title || defaultTitles[type] || 'Nouvelle section',
      contentHtml: content || '<p>Contenu de cette partie...</p>',
      isCollapsed: false,
      wordCount: 0,
      estMinutes: 0
    };

    this.sections.push(newSec);
    this.renderSections();
    this.renderOutline();
    this.updateMetrics();
    this.debouncedAutoSave();

    setTimeout(() => {
      this.scrollToSection(newSec.id);
    }, 50);
  },

  async deleteSection(secId) {
    if (this.sections.length <= 1) {
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast("Le sermon doit contenir au moins une section.", "warn");
      }
      return;
    }

    const sec = this.sections.find(s => s.id === secId);
    if (!sec) return;

    let confirmed = false;
    if (typeof App !== 'undefined' && App.showConfirmModal) {
      confirmed = await App.showConfirmModal({
        title: "Supprimer la section",
        message: `Voulez-vous supprimer la section "${sec.title || 'cette partie'}" ?`,
        confirmText: "Supprimer",
        cancelText: "Annuler",
        danger: true,
        icon: "trash"
      });
    } else {
      confirmed = confirm(`Supprimer la section "${sec.title || 'cette partie'}" ?`);
    }

    if (!confirmed) {
      return;
    }

    this.pushHistoryState();
    this.sections = this.sections.filter(s => s.id !== secId);
    this.renderSections();
    this.renderOutline();
    this.updateMetrics();
    this.debouncedAutoSave();
  },

  moveSection(secId, delta) {
    const idx = this.sections.findIndex(s => s.id === secId);
    if (idx === -1) return;

    const newIdx = idx + delta;
    if (newIdx < 0 || newIdx >= this.sections.length) return;

    this.pushHistoryState();
    const temp = this.sections[idx];
    this.sections[idx] = this.sections[newIdx];
    this.sections[newIdx] = temp;

    this.renderSections();
    this.renderOutline();
    this.debouncedAutoSave();

    setTimeout(() => {
      this.scrollToSection(secId);
    }, 50);
  },

  insertHtmlIntoActiveSection(html) {
    this.ensureCurrentSermon();
    if (this.sections.length === 0) {
      this.addSection('point');
    }

    let targetEditor = null;
    if (this.activeSectionId) {
      const card = document.getElementById(`section-card-${this.activeSectionId}`);
      targetEditor = card?.querySelector('.sermon-section-editor');
    }

    if (!targetEditor) {
      const firstCard = document.querySelector('.sermon-section-card');
      targetEditor = firstCard?.querySelector('.sermon-section-editor');
    }

    if (targetEditor) {
      targetEditor.focus();
      document.execCommand('insertHTML', false, html);
      targetEditor.dispatchEvent(new Event('input', { bubbles: true }));
    }
  },

  // =========================================================================
  // INSERTION DE BLOCS SPÉCIALISÉS (DANS L'ÉDITEUR ACTIF)
  // =========================================================================

  insertBlock(type) {
    this.ensureCurrentSermon();
    if (this.sections.length === 0) {
      this.addSection('point');
    }

    let htmlToInsert = '';
    let blockId = null;

    switch (type) {
      case 'subpoint':
        htmlToInsert = `<h3>Sous-point</h3><p>Explication du sous-point...</p>`;
        break;
      case 'scripture':
        const ref = this.currentSermon?.passage?.reference || 'Passage lié';
        htmlToInsert = `
          <div class="sermon-callout-block sermon-block-scripture" data-type="scripture">
            <div class="sermon-block-header">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
              <span>Écriture (${this.escapeHtml(ref)})</span>
            </div>
            <p>« Insérez le texte du verset biblique ici... »</p>
          </div><p></p>
        `;
        break;
      case 'exegesis':
        htmlToInsert = `
          <div class="sermon-callout-block sermon-block-exegesis" data-type="exegesis">
            <div class="sermon-block-header">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="m8.5 13.5 2-5.5 2 5.5"/><path d="M9.2 11.8h2.6"/><path d="M14 8.5h3.5l-3.5 5h3.5"/></svg>
              <span>Exégèse & Terme original</span>
            </div>
            <p><strong>Analyse du mot-clé :</strong> Sens grammatical, portée théologique et contexte.</p>
          </div><p></p>
        `;
        break;
      case 'illustration':
        blockId = `ill-block-${Date.now()}`;
        htmlToInsert = `
          <div class="sermon-callout-block sermon-block-illustration" data-type="illustration" id="${blockId}">
            <div class="sermon-block-header" contenteditable="false">
              <div class="sermon-block-header-left">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1.3.5 2.6 1.5 3.5.8.8 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>
                <span>Illustration / Récit</span>
              </div>
            </div>
            <p><strong>Titre de l'anecdote :</strong> Racontez l'histoire ou l'image concrète ici...</p>
          </div><p></p>
        `;
        break;
      case 'application':
        htmlToInsert = `
          <div class="sermon-callout-block sermon-block-application" data-type="application">
            <div class="sermon-block-header" contenteditable="false">
              <div class="sermon-block-header-left">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
                <span>Application pratique</span>
              </div>
            </div>
            <p><strong>Question pour l'auditeur :</strong> Comment appliquer cette vérité dès cette semaine ?</p>
          </div><p></p>
        `;
        break;
      case 'cue':
        htmlToInsert = `
          <div class="sermon-callout-block sermon-block-cue" data-type="cue">
            <div class="sermon-block-header" contenteditable="false">
              <div class="sermon-block-header-left">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <span>Régie / Timing</span>
              </div>
            </div>
            <p>Indication technique pour la projection ou le pupitre...</p>
          </div><p></p>
        `;
        break;
      case 'slide':
        htmlToInsert = `<span class="sermon-slide-badge" contenteditable="false"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg> DIAPO</span>&nbsp;`;
        break;
    }

    if (htmlToInsert) {
      this.insertHtmlIntoActiveSection(htmlToInsert);
      if (type === 'illustration') {
        setTimeout(() => {
          const el = document.getElementById(blockId);
          if (el) this.attachIllustrationBlockHelpers(el, this.activeSectionId);
        }, 30);
      }
    }
  },

  // =========================================================================
  // PARSING & CONVERSION MARKDOWN <-> ÉDITEUR HTML
  // =========================================================================

  inlineFormat(text) {
    if (!text) return '';
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>');
  },

  markdownToEditorHtml(md) {
    if (!md) return '';
    let text = md.trim();

    // 1. Repères de diapositives [_]
    text = text.replace(/\[\s*_\s*\]/g, '<span class="sermon-slide-badge" contenteditable="false"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg> DIAPO</span>&nbsp;');

    // 2. Découpage en blocs ligne par ligne avec capture correcte des callouts
    const lines = text.split('\n');
    const blocks = [];
    let currentBlock = [];
    let inCallout = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (trimmed.startsWith('> [!') || trimmed.startsWith('>[!')) {
        if (currentBlock.length > 0) {
          blocks.push({ isCallout: inCallout, text: currentBlock.join('\n') });
          currentBlock = [];
        }
        inCallout = true;
        currentBlock.push(line);
      } else if (inCallout) {
        if (trimmed.startsWith('>') || trimmed === '') {
          currentBlock.push(line);
        } else {
          // Fin du callout
          blocks.push({ isCallout: true, text: currentBlock.join('\n') });
          currentBlock = [line];
          inCallout = false;
        }
      } else if (trimmed === '') {
        if (currentBlock.length > 0) {
          blocks.push({ isCallout: false, text: currentBlock.join('\n') });
          currentBlock = [];
        }
      } else {
        currentBlock.push(line);
      }
    }
    if (currentBlock.length > 0) {
      blocks.push({ isCallout: inCallout, text: currentBlock.join('\n') });
    }

    const htmlBlocks = blocks.map(bObj => {
      const bTrim = bObj.text.trim();
      if (!bTrim) return '';

      // A. Callout
      if (bObj.isCallout || (bTrim.startsWith('>') && bTrim.includes('[!'))) {
        const bLines = bTrim.split('\n');
        const firstLine = bLines[0];
        const restLines = bLines.slice(1);
        const innerContent = restLines.map(l => l.replace(/^>\s?/, '')).join('\n').trim();

        // Extraire type & attributs
        let type = 'cue';
        let ref = '';
        let ver = '';
        let key = '';
        let id = '';

        if (firstLine.includes('[!scripture')) {
          type = 'scripture';
          const mRef = firstLine.match(/ref=([^|\]]+)/i);
          if (mRef) ref = mRef[1].trim();
          const mVer = firstLine.match(/version=([^\]]+)/i);
          if (mVer) ver = mVer[1].trim();
        } else if (firstLine.includes('[!exegesis')) {
          type = 'exegesis';
          const mKey = firstLine.match(/key=([^\]]+)/i);
          if (mKey) key = mKey[1].trim();
        } else if (firstLine.includes('[!illustration')) {
          type = 'illustration';
          const mId = firstLine.match(/id=([^\]]+)/i);
          if (mId) id = mId[1].trim();
        } else if (firstLine.includes('[!application')) {
          type = 'application';
        } else if (firstLine.includes('[!cue')) {
          type = 'cue';
        }

        let label = 'Bloc';
        let iconSvg = '';
        if (type === 'scripture') {
          label = `Écriture${ref ? ` (${ref}${ver ? ' - ' + ver : ''})` : ''}`;
          iconSvg = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>';
        } else if (type === 'exegesis') {
          label = `Exégèse${key ? ` (${key})` : ''}`;
          iconSvg = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="m8.5 13.5 2-5.5 2 5.5"/><path d="M9.2 11.8h2.6"/><path d="M14 8.5h3.5l-3.5 5h3.5"/></svg>';
        } else if (type === 'illustration') {
          label = 'Illustration / Récit';
          iconSvg = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1.3.5 2.6 1.5 3.5.8.8 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>';
        } else if (type === 'application') {
          label = 'Application pratique';
          iconSvg = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>';
        } else if (type === 'cue') {
          label = 'Régie / Timing';
          iconSvg = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';
        }

        // Formatage du contenu interne
        let innerHtml = '';
        if (innerContent) {
          const paragraphs = innerContent.split(/\n\n+/);
          innerHtml = paragraphs.map(p => {
            const formatted = this.inlineFormat(p).replace(/\n/g, '<br>');
            return `<p>${formatted}</p>`;
          }).join('');
        } else {
          innerHtml = '<p></p>';
        }

        const dataAttrs = `data-type="${type}"${ref ? ` data-ref="${this.escapeHtml(ref)}"` : ''}${ver ? ` data-version="${this.escapeHtml(ver)}"` : ''}${key ? ` data-key="${this.escapeHtml(key)}"` : ''}${id ? ` data-id="${this.escapeHtml(id)}"` : ''}`;

        return `<div class="sermon-callout-block sermon-block-${type}" ${dataAttrs}><div class="sermon-block-header" contenteditable="false"><div class="sermon-block-header-left">${iconSvg}<span>${this.escapeHtml(label)}</span></div></div>${innerHtml}</div>`;
      }

      // B. Titres
      if (bTrim.startsWith('### ')) {
        return `<h3>${this.inlineFormat(bTrim.substring(4))}</h3>`;
      }
      if (bTrim.startsWith('## ')) {
        return `<h2>${this.inlineFormat(bTrim.substring(3))}</h2>`;
      }
      if (bTrim.startsWith('# ')) {
        return `<h1>${this.inlineFormat(bTrim.substring(2))}</h1>`;
      }
      if (bTrim === '---') {
        return '<hr>';
      }

      // C. Paragraphe régulier
      const formatted = this.inlineFormat(bTrim).replace(/\n/g, '<br>');
      return `<p>${formatted}</p>`;
    });

    return htmlBlocks.filter(Boolean).join('\n\n');
  },

  editorHtmlToMarkdown(html) {
    if (!html) return '';
    const container = document.createElement('div');
    container.innerHTML = html;

    // Remplacement des badges de diapositive
    container.querySelectorAll('.sermon-slide-badge').forEach(b => {
      b.replaceWith(document.createTextNode(' [_] '));
    });

    // Remplacement des callouts par leur syntaxe Markdown
    container.querySelectorAll('.sermon-callout-block').forEach(b => {
      const type = b.dataset.type || 'cue';
      const ref = b.dataset.ref;
      const ver = b.dataset.version;
      const key = b.dataset.key;
      const id = b.dataset.id;

      // Retirer le header avant de lire le texte
      const header = b.querySelector('.sermon-block-header');
      if (header) header.remove();

      // Convertir les paragraphes et formats internes en markdown
      let innerHtml = b.innerHTML;
      innerHtml = innerHtml.replace(/<strong>(.*?)<\/strong>/gi, '**$1**');
      innerHtml = innerHtml.replace(/<b>(.*?)<\/b>/gi, '**$1**');
      innerHtml = innerHtml.replace(/<em>(.*?)<\/em>/gi, '*$1*');
      innerHtml = innerHtml.replace(/<i>(.*?)<\/i>/gi, '*$1*');
      innerHtml = innerHtml.replace(/<p>(.*?)<\/p>/gi, '$1\n\n');
      innerHtml = innerHtml.replace(/<br\s*\/?>/gi, '\n');

      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = innerHtml;
      const text = (tempDiv.innerText || tempDiv.textContent || '').trim();

      let tagParams = [];
      if (ref) tagParams.push(`ref=${ref}`);
      if (ver) tagParams.push(`version=${ver}`);
      if (key) tagParams.push(`key=${key}`);
      if (id) tagParams.push(`id=${id}`);
      const tagSuffix = tagParams.length > 0 ? `|${tagParams.join('|')}` : '';

      let calloutTag = `> [!${type}${tagSuffix}]`;
      let calloutBody = text ? text.split('\n').map(line => `> ${line}`).join('\n') : '> ';

      const mdText = `\n\n${calloutTag}\n${calloutBody}\n\n`;
      b.replaceWith(document.createTextNode(mdText));
    });

    // Éléments restants dans le container
    let raw = container.innerHTML;
    raw = raw.replace(/<h1>(.*?)<\/h1>/gi, '\n\n# $1\n\n');
    raw = raw.replace(/<h2>(.*?)<\/h2>/gi, '\n\n## $1\n\n');
    raw = raw.replace(/<h3>(.*?)<\/h3>/gi, '\n\n### $1\n\n');
    raw = raw.replace(/<hr>/gi, '\n\n---\n\n');
    raw = raw.replace(/<strong>(.*?)<\/strong>/gi, '**$1**');
    raw = raw.replace(/<b>(.*?)<\/b>/gi, '**$1**');
    raw = raw.replace(/<em>(.*?)<\/em>/gi, '*$1*');
    raw = raw.replace(/<i>(.*?)<\/i>/gi, '*$1*');
    raw = raw.replace(/<p>(.*?)<\/p>/gi, '\n$1\n');
    raw = raw.replace(/<br\s*\/?>/gi, '\n');

    const tempDiv2 = document.createElement('div');
    tempDiv2.innerHTML = raw;
    let cleanText = tempDiv2.innerText || tempDiv2.textContent || '';
    return cleanText.replace(/\n{3,}/g, '\n\n').trim();
  },

  // =========================================================================
  // CALCUL DES MÉTRIQUES & ÉQUILIBRE HOMILÉTIQUE
  // =========================================================================

  updateMetrics() {
    const wpm = this.currentSermon?.timing?.words_per_minute || 135;
    let totalWords = 0;

    this.sections.forEach(sec => {
      totalWords += (sec.wordCount || 0);
    });

    const estMinutes = (totalWords / wpm).toFixed(1);

    if (this.lblEstTime) this.lblEstTime.textContent = `${estMinutes} min`;
    if (this.lblWordCount) this.lblWordCount.textContent = `${totalWords} mots`;

    // Calcul de proportion des blocs
    let exegesisCount = 1;
    let illustrationCount = 1;
    let applicationCount = 1;

    document.querySelectorAll('.sermon-section-card').forEach(card => {
      exegesisCount += card.querySelectorAll('.sermon-block-exegesis').length;
      illustrationCount += card.querySelectorAll('.sermon-block-illustration').length;
      applicationCount += card.querySelectorAll('.sermon-block-application').length;
    });

    const total = exegesisCount + illustrationCount + applicationCount;
    const pctExg = Math.round((exegesisCount / total) * 100);
    const pctIll = Math.round((illustrationCount / total) * 100);
    const pctApp = 100 - pctExg - pctIll;

    if (this.barExegesis) this.barExegesis.style.width = `${pctExg}%`;
    if (this.barIllustration) this.barIllustration.style.width = `${pctIll}%`;
    if (this.barApplication) this.barApplication.style.width = `${pctApp}%`;
  },

  // =========================================================================
  // VOLETS GAUCHE ET DROIT : RÉTRACTATION & ANIMATION FLUIDE
  // =========================================================================

  toggleSidebar(forceState) {
    if (!this.sidebarPane) {
      this.sidebarPane = document.getElementById('sermons-sidebar-pane');
    }
    if (!this.sidebarPane) return;

    const willOpen = typeof forceState === 'boolean' ? forceState : this.sidebarPane.classList.contains('collapsed');

    if (typeof forceState === 'boolean') {
      this.sidebarPane.classList.toggle('collapsed', !forceState);
    } else {
      this.sidebarPane.classList.toggle('collapsed');
    }

    const toggleBtn = document.getElementById('btn-sermons-toggle-sidebar');
    if (toggleBtn) {
      toggleBtn.classList.toggle('active', willOpen);
    }
  },

  toggleOutlinePanel(forceState) {
    const outlinePanel = document.getElementById('sermon-outline-panel');
    if (!outlinePanel) return;

    const willOpen = typeof forceState === 'boolean' ? forceState : outlinePanel.classList.contains('collapsed');
    outlinePanel.classList.toggle('collapsed', !willOpen);

    const toggleBtn = document.getElementById('btn-sermon-toggle-outline');
    if (toggleBtn) {
      toggleBtn.classList.toggle('active', willOpen);
      toggleBtn.title = willOpen ? "Masquer le plan de prédication" : "Afficher le plan de prédication";
    }
  },

  toggleResourcesDrawer(forceState) {
    if (!this.resourcesDrawer) {
      this.resourcesDrawer = document.getElementById('sermons-resources-drawer');
    }
    if (!this.resourcesDrawer) return;
    const willOpen = typeof forceState === 'boolean' ? forceState : this.resourcesDrawer.classList.contains('collapsed');

    if (typeof forceState === 'boolean') {
      this.resourcesDrawer.classList.toggle('collapsed', !forceState);
    } else {
      this.resourcesDrawer.classList.toggle('collapsed');
    }

    const toggleBtn = document.getElementById('btn-sermon-toggle-drawer');
    if (toggleBtn) {
      toggleBtn.classList.toggle('active', willOpen);
    }

    // Lorsque le volet droit s'ouvre -> replier automatiquement le menu principal à gauche (exactement comme pour la page Bible)
    if (typeof App !== 'undefined' && App.setSidebarCollapsed) {
      if (willOpen) {
        App.setSidebarCollapsed(true, true);
      } else if (App.sidebarAutoCollapsed) {
        App.setSidebarCollapsed(false, true);
      }
    }
  },

  async syncPassageResources() {
    this.renderDrawerContent();
  },

  async renderDrawerContent() {
    if (!this.drawerContent) return;
    const s = this.currentSermon || {};
    const passageRef = s.passage?.reference || '';
    const currentChurch = s.church || '';
    const date = s.date_planned || '';
    const series = s.series?.title || '';
    const bigIdea = s.big_idea || '';
    const goal = s.goal || '';

    if (this.activeDrawerTab === 'metadata') {
      const s = this.currentSermon || {};
      const passageRef = s.passage?.reference || '';
      const currentChurch = s.church || '';
      const date = s.date_planned || '';
      const series = s.series?.title || '';
      const pmt = s.pmt || s.big_idea || '';
      const pms = s.pms || '';
      const tension = s.contemporary_tension || '';
      const era = s.redemptive_era || 'christ';
      const goal = s.goal || '';

      const eras = [
        { id: "creation", name: "1. Création (Dessein originel)" },
        { id: "fall", name: "2. Chute (Rupture & Entrée du péché)" },
        { id: "patriarchs", name: "3. Patriarches (Alliance & Promesses)" },
        { id: "exodus_law", name: "4. Exode & Loi (Rédemption & Sainteté)" },
        { id: "kingdom", name: "5. Royaume & Rois (Royauté & Temple)" },
        { id: "exile_prophets", name: "6. Exil & Prophètes (Jugement & Espérance)" },
        { id: "christ", name: "7. Jésus-Christ (Accomplissement & Croix)" },
        { id: "church_new_creation", name: "8. Église & Nouvelle Création (Mission & Gloire)" }
      ];

      const eraOptionsHtml = eras.map(e => `
        <option value="${e.id}" ${era === e.id ? 'selected' : ''}>${e.name}</option>
      `).join('');

      this.drawerContent.innerHTML = `
        <div class="sermon-drawer-meta-form">
          <!-- 1. Passage biblique -->
          <div class="sermon-drawer-meta-field">
            <label class="sermon-drawer-meta-label">
              <span>Passage Biblique</span>
              <span class="sermon-meta-tooltip-trigger" title="Détails homilétiques">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                <div class="sermon-meta-popover">
                  <div class="meta-popover-title">Passage Biblique & Péricope</div>
                  <div class="meta-popover-author">Florent Varak (IBG) • David Helm</div>
                  <div class="meta-popover-body">Le passage détermine les limites de votre prédication. Choisissez une unité littéraire complète (un paragraphe, une histoire, un argument).</div>
                  <div class="meta-popover-tip">Règle d'or : Laissez le texte imposer son ordre et sa dynamique au sermon.</div>
                </div>
              </span>
            </label>
            <div style="display: flex; gap: 6px;">
              <input type="text" id="sermon-meta-passage" class="sermon-drawer-input" value="${this.escapeHtml(passageRef)}" placeholder="ex: 2 Corinthiens 1.12-2.13">
              <button class="btn-secondary" id="btn-sync-meta-passage" title="Synchroniser avec la Bible" style="padding: 0 8px; flex-shrink: 0;">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
              </button>
            </div>
          </div>

          <!-- 2. Histoire du Salut -->
          <div class="sermon-drawer-meta-field">
            <label class="sermon-drawer-meta-label">
              <span>Histoire du Salut (Théologie Biblique)</span>
              <span class="sermon-meta-tooltip-trigger" title="Détails homilétiques">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                <div class="sermon-meta-popover">
                  <div class="meta-popover-title">Étape de la Grande Histoire de Dieu</div>
                  <div class="meta-popover-author">Phil Crowter (Langham) • David Helm</div>
                  <div class="meta-popover-body">Situe le passage dans le grand récit de la rédemption en 8 étapes pour prêcher le Christ sans moralisme.</div>
                  <div class="meta-popover-tip">Règle d'or : Toujours tracer une ligne théologique solide vers l'accomplissement en Jésus-Christ.</div>
                </div>
              </span>
            </label>
            <select id="sermon-meta-era" class="sermon-drawer-input sermon-drawer-select">
              ${eraOptionsHtml}
            </select>
          </div>

          <!-- 3. PMT -->
          <div class="sermon-drawer-meta-field">
            <label class="sermon-drawer-meta-label">
              <span>PMT — Pensée Maîtresse du Texte (Rive 1)</span>
              <span class="sermon-meta-tooltip-trigger" title="Détails homilétiques">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                <div class="sermon-meta-popover">
                  <div class="meta-popover-title">Pensée Maîtresse du Texte (Sujet + Complément)</div>
                  <div class="meta-popover-author">Florent Varak & Philippe Viguier (IBG)</div>
                  <div class="meta-popover-body">La vérité originelle que l'auteur biblique déclarait à ses premiers destinataires dans leur contexte historique.</div>
                  <div class="meta-popover-tip">Formule : Sujet précis + Complément (Ce que l'auteur en dit).</div>
                </div>
              </span>
            </label>
            <textarea id="sermon-meta-pmt" class="sermon-drawer-input sermon-drawer-textarea" placeholder="Qu'est-ce que l'auteur biblique affirmait à ses premiers auditeurs ?">${this.escapeHtml(pmt)}</textarea>
          </div>

          <!-- 4. Le Pont -->
          <div class="sermon-drawer-meta-field">
            <label class="sermon-drawer-meta-label">
              <span style="display: flex; align-items: center; gap: 4px;">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" style="color: #3b82f6;"><path d="M4 19V9a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10"/><path d="M4 15h16"/><path d="M10 7v12"/><path d="M14 7v12"/></svg>
                Le Pont — Tension Contemporaine
              </span>
              <span class="sermon-meta-tooltip-trigger" title="Détails homilétiques">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                <div class="sermon-meta-popover">
                  <div class="meta-popover-title">Bâtir un Pont entre les deux mondes</div>
                  <div class="meta-popover-author">John Stott (Le défi de la prédication)</div>
                  <div class="meta-popover-body">Traverse le fossé culturel de 2000 ans en identifiant la tension existentielle, l'angoisse ou le défi moderne auquel le texte répond.</div>
                  <div class="meta-popover-tip">Règle d'or : Rendre le texte brûlant d'actualité pour nos contemporains.</div>
                </div>
              </span>
            </label>
            <textarea id="sermon-meta-tension" class="sermon-drawer-input sermon-drawer-textarea" placeholder="À quelle question ou tension de notre monde ce texte répond-il aujourd'hui ?">${this.escapeHtml(tension)}</textarea>
          </div>

          <!-- 5. PMS -->
          <div class="sermon-drawer-meta-field">
            <label class="sermon-drawer-meta-label">
              <span>PMS — Pensée Maîtresse du Sermon (Rive 2)</span>
              <span class="sermon-meta-tooltip-trigger" title="Détails homilétiques">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                <div class="sermon-meta-popover">
                  <div class="meta-popover-title">Pensée Maîtresse du Sermon (La Grande Idée)</div>
                  <div class="meta-popover-author">Florent Varak (IBG) • John Stott • Haddon Robinson</div>
                  <div class="meta-popover-body">La proposition centrale active et percutante que chaque membre de l'assemblée doit retenir et emporter chez lui.</div>
                  <div class="meta-popover-tip">Règle d'or : Une seule phrase mémorisable et orientée vers l'action.</div>
                </div>
              </span>
            </label>
            <textarea id="sermon-meta-pms" class="sermon-drawer-input sermon-drawer-textarea" placeholder="En une phrase : quelle vérité active prêchez-vous à votre assemblée ?">${this.escapeHtml(pms)}</textarea>
          </div>

          <!-- 6. Objectif -->
          <div class="sermon-drawer-meta-field">
            <label class="sermon-drawer-meta-label">
              <span>Objectif pour l'Auditeur (Transformation)</span>
              <span class="sermon-meta-tooltip-trigger" title="Détails homilétiques">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                <div class="sermon-meta-popover">
                  <div class="meta-popover-title">Objectif Spirituel & Pastoral</div>
                  <div class="meta-popover-author">Alfred Kuen • John Stott</div>
                  <div class="meta-popover-body">La transformation de cœur, de pensée ou de comportement attendue par l'Esprit (foi, repentance, consolation, sainteté).</div>
                  <div class="meta-popover-tip">Règle d'or : Que doivent croire, ressentir ou faire les auditeurs après ce message ?</div>
                </div>
              </span>
            </label>
            <textarea id="sermon-meta-goal" class="sermon-drawer-input sermon-drawer-textarea" placeholder="Que doit faire, croire ou ressentir l'assemblée suite à ce message ?">${this.escapeHtml(goal)}</textarea>
          </div>

          <!-- 7. Organisation -->
          <div class="sermon-drawer-meta-field">
            <label class="sermon-drawer-meta-label"><span>Lieu / Église</span></label>
            <input type="text" id="sermon-meta-church" class="sermon-drawer-input" value="${this.escapeHtml(currentChurch)}" placeholder="ex: Église Évangélique de Lyon">
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
            <div class="sermon-drawer-meta-field">
              <label class="sermon-drawer-meta-label"><span>Date prévue</span></label>
              <input type="date" id="sermon-meta-date" class="sermon-drawer-input" value="${this.escapeHtml(date)}">
            </div>
            <div class="sermon-drawer-meta-field">
              <label class="sermon-drawer-meta-label"><span>Série</span></label>
              <input type="text" id="sermon-meta-series" class="sermon-drawer-input" value="${this.escapeHtml(series)}" placeholder="ex: Romains">
            </div>
          </div>
        </div>
      `;

      // Sauvegarde des métadonnées
      const bindMetaInput = (id, field) => {
        const el = document.getElementById(id);
        el?.addEventListener('input', () => {
          if (!this.currentSermon) return;
          if (field === 'passage') {
            this.currentSermon.passage = { ...(this.currentSermon.passage || {}), reference: el.value.trim() };
          } else if (field === 'series') {
            this.currentSermon.series = { ...(this.currentSermon.series || {}), title: el.value.trim() };
          } else {
            this.currentSermon[field] = el.value.trim();
          }
          this.updateHeaderSummary(this.currentSermon);
          this.debouncedAutoSave();
        });
      };

      bindMetaInput('sermon-meta-passage', 'passage');
      bindMetaInput('sermon-meta-era', 'redemptive_era');
      bindMetaInput('sermon-meta-pmt', 'pmt');
      bindMetaInput('sermon-meta-tension', 'contemporary_tension');
      bindMetaInput('sermon-meta-pms', 'pms');
      bindMetaInput('sermon-meta-goal', 'goal');
      bindMetaInput('sermon-meta-church', 'church');
      bindMetaInput('sermon-meta-date', 'date_planned');
      bindMetaInput('sermon-meta-series', 'series');

      return;
    }

    if (this.activeDrawerTab === 'overview') {
      this.drawerContent.innerHTML = `
        <div style="padding: 12px 6px;">
          <h4 style="font-size: 13px; font-weight: 700; margin-bottom: 8px;">Aperçu du Passage</h4>
          <p style="font-size: 12px; color: var(--text-secondary); line-height: 1.5;">Texte actif : <strong>${this.escapeHtml(passageRef || 'Non défini')}</strong></p>
        </div>
      `;
      return;
    }

    if (this.activeDrawerTab === 'commentaries') {
      this.drawerContent.innerHTML = `
        <div style="padding: 12px 6px;">
          <h4 style="font-size: 13px; font-weight: 700; margin-bottom: 8px;">Commentaires Exégétiques</h4>
          <p style="font-size: 12px; color: var(--text-secondary); line-height: 1.5;">Consultez les commentaires sur ${this.escapeHtml(passageRef || 'le passage')} depuis la bibliothèque.</p>
        </div>
      `;
      return;
    }

    if (this.activeDrawerTab === 'ai') {
      this.drawerContent.innerHTML = `
        <div style="padding: 8px 4px; display: flex; flex-direction: column; gap: 14px;">
          <!-- 1. Canevas Classiques des Manuels -->
          <div>
            <div style="font-size: 11.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
              <span>Structures des Grands Manuels</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 6px;">
              <button class="btn-secondary" id="btn-ai-classic-plan" style="text-align: left; padding: 7px 10px; font-size: 11.5px; display: flex; align-items: center; gap: 8px;">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--accent-amber, #f59e0b);"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
                <span>Plan Standard par défaut (5 parties)</span>
              </button>
              <button class="btn-secondary" id="btn-ai-bridge-plan" style="text-align: left; padding: 7px 10px; font-size: 11.5px; display: flex; align-items: center; gap: 8px;">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" style="color: #3b82f6;"><path d="M4 19V9a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10"/><path d="M4 15h16"/><path d="M10 7v12"/><path d="M14 7v12"/></svg>
                <span>Structure du Pont (John Stott)</span>
              </button>
              <button class="btn-secondary" id="btn-ai-synthetique-plan" style="text-align: left; padding: 7px 10px; font-size: 11.5px; display: flex; align-items: center; gap: 8px;">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/></svg>
                <span>Plan Synthétique (Alfred Kuen)</span>
              </button>
              <button class="btn-secondary" id="btn-ai-helm-grid" style="text-align: left; padding: 7px 10px; font-size: 11.5px; display: flex; align-items: center; gap: 8px;">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
                <span>Grille d'Applications (David Helm)</span>
              </button>
            </div>
          </div>

          <div style="height: 1px; background: var(--border-color); margin: 2px 0;"></div>

          <!-- 2. Modèles de Chaire Réelle (Corpus de 94 Prédications) -->
          <div>
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
              <div style="font-size: 11.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--accent-amber, #f59e0b); display: flex; align-items: center; gap: 6px;">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>
                <span>Canevas Homilétiques Réels</span>
              </div>
              <span id="real-sermons-count-badge" style="font-size: 10.5px; background: rgba(245, 158, 11, 0.15); color: var(--accent-amber, #f59e0b); padding: 1px 6px; border-radius: 10px; font-weight: 600;">...</span>
            </div>

            <!-- Barre de filtrage interne -->
            <div style="position: relative; margin-bottom: 10px;">
              <input type="text" id="input-filter-real-models" class="sermon-drawer-input" placeholder="Filtrer par texte (ex: Luc 11, Joseph, grâce...)" style="padding-left: 26px; font-size: 11px; height: 28px;">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" style="position: absolute; left: 8px; top: 8px; color: var(--text-muted); pointer-events: none;"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </div>

            <!-- Liste des modèles réels -->
            <div id="real-sermons-models-container" style="display: flex; flex-direction: column; gap: 8px;">
              <div style="text-align: center; padding: 20px; color: var(--text-muted); font-size: 11.5px;">
                <span class="synth-spinner" style="width: 12px; height: 12px; display: inline-block; vertical-align: middle; margin-right: 6px;"></span>
                Chargement des canevas correspondants...
              </div>
            </div>
          </div>
        </div>
      `;

      document.getElementById('btn-ai-classic-plan')?.addEventListener('click', () => this.insertHomileticOutline('classique'));
      document.getElementById('btn-ai-bridge-plan')?.addEventListener('click', () => this.insertHomileticOutline('inductif'));
      document.getElementById('btn-ai-synthetique-plan')?.addEventListener('click', () => this.insertHomileticOutline('synthetique'));
      document.getElementById('btn-ai-helm-grid')?.addEventListener('click', () => this.insertHomileticOutline('application-grille'));

      // Charger les modèles réels
      this.loadRealSermonModelsList(passageRef);

      const filterInput = document.getElementById('input-filter-real-models');
      filterInput?.addEventListener('input', () => {
        const q = filterInput.value.trim();
        this.loadRealSermonModelsList(passageRef, q);
      });

      return;
    }

    if (this.activeDrawerTab === 'illustrations') {
      this.drawerContent.innerHTML = `
        <div style="padding: 8px 4px; display: flex; flex-direction: column; gap: 10px;">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <span style="font-size: 12px; font-weight: 700; color: var(--text-primary);">Illustrations Pastorales</span>
            <button class="btn-link" id="btn-drawer-go-illustrations" style="font-size: 11px; color: var(--accent-blue);">Ouvrir la banque ↗</button>
          </div>
          <p style="font-size: 11.5px; color: var(--text-secondary); line-height: 1.45;">Accédez aux 1 500 fiches d'illustrations et insérez-les d'un clic dans la section active.</p>
        </div>
      `;

      document.getElementById('btn-drawer-go-illustrations')?.addEventListener('click', () => {
        if (typeof App !== 'undefined' && App.switchView) {
          App.switchView('illustrations');
        }
      });
      return;
    }

    this.drawerContent.innerHTML = `
      <div style="padding: 12px 6px; font-size: 12px; color: var(--text-muted);">
        Contenu de l'onglet en cours de chargement...
      </div>
    `;
  },

  insertHomileticOutline(type) {
    const passage = this.currentSermon?.passage?.reference || 'Passage';
    let newSections = [];
    let name = "Plan Homilétique";

    if (type === 'classique') {
      name = "Plan Standard par défaut";
      newSections = [
        { id: `sec_${Date.now()}_1`, type: 'intro', title: 'Introduction', contentHtml: '<p>Accroche, mise en contexte et tension contemporaine...</p>', isCollapsed: false, wordCount: 0, estMinutes: 0 },
        { id: `sec_${Date.now()}_2`, type: 'scripture', title: `Lecture du passage (${passage})`, contentHtml: '<p>« Insérez le texte biblique ici... »</p>', isCollapsed: false, wordCount: 0, estMinutes: 0 },
        { id: `sec_${Date.now()}_3`, type: 'point', title: 'I. Premier Point Principal', contentHtml: '<p>Explication du texte et fondement doctrinal...</p>', isCollapsed: false, wordCount: 0, estMinutes: 0 },
        { id: `sec_${Date.now()}_4`, type: 'point', title: 'II. Deuxième Point Principal', contentHtml: '<p>Développement théologique et résonance...</p>', isCollapsed: false, wordCount: 0, estMinutes: 0 },
        { id: `sec_${Date.now()}_5`, type: 'conclusion', title: 'Conclusion & Appel', contentHtml: '<p>Synthèse de la pensée maîtresse et application pour la semaine...</p>', isCollapsed: false, wordCount: 0, estMinutes: 0 }
      ];
    } else if (type === 'synthetique') {
      name = "Plan Synthétique (Alfred Kuen)";
      newSections = [
        { id: `sec_${Date.now()}_1`, type: 'intro', title: 'Introduction', contentHtml: '<p><strong>Accroche :</strong> Captez l\'attention dès les premières secondes...<br><strong>Tension :</strong> Quel combat existentiel ce texte éclaire-t-il ?<br><strong>Vérité Maîtresse :</strong> La proposition centrale du sermon en 1 phrase.</p>', isCollapsed: false, wordCount: 0, estMinutes: 0 },
        { id: `sec_${Date.now()}_2`, type: 'scripture', title: `Lecture du Passage (${passage})`, contentHtml: '<p>« Insérez les versets ici... »</p>', isCollapsed: false, wordCount: 0, estMinutes: 0 },
        { id: `sec_${Date.now()}_3`, type: 'point', title: 'I. Premier Axe : La Révélation du Texte', contentHtml: '<p>Explication du passage et des mots-clés originaux...</p>', isCollapsed: false, wordCount: 0, estMinutes: 0 },
        { id: `sec_${Date.now()}_4`, type: 'point', title: 'II. Deuxième Axe : L\'Exigence et le Diagnostic', contentHtml: '<p>Développement spirituel et résonance pour notre condition...</p>', isCollapsed: false, wordCount: 0, estMinutes: 0 },
        { id: `sec_${Date.now()}_5`, type: 'point', title: 'III. Troisième Axe : L\'Accomplissement en Christ', contentHtml: '<p>Comment la grâce de Jésus-Christ répond à ce que la Loi révèle...</p>', isCollapsed: false, wordCount: 0, estMinutes: 0 },
        { id: `sec_${Date.now()}_6`, type: 'conclusion', title: 'Conclusion & Appel', contentHtml: '<p><strong>Synthèse :</strong> Récapitulatif clair.<br><strong>Défi pratique :</strong> Comment appliquer cette vérité dès cette semaine ?</p>', isCollapsed: false, wordCount: 0, estMinutes: 0 }
      ];
    } else if (type === 'inductif') {
      name = "Structure du Pont (John Stott)";
      newSections = [
        { id: `sec_${Date.now()}_1`, type: 'intro', title: '1. La Tension Contemporaine (Rive 2)', contentHtml: '<p>Le dilemme humain, la soif ou l\'épreuve universelle vécue aujourd\'hui...</p>', isCollapsed: false, wordCount: 0, estMinutes: 0 },
        { id: `sec_${Date.now()}_2`, type: 'scripture', title: `2. L\'Écoute de la Parole (${passage})`, contentHtml: '<p>Ce que Dieu déclare dans son texte pour bousculer nos schémas...</p>', isCollapsed: false, wordCount: 0, estMinutes: 0 },
        { id: `sec_${Date.now()}_3`, type: 'point', title: '3. La Résolution par la Grâce (Le Pont en Christ)', contentHtml: '<p>Comment la personne et l\'œuvre du Christ bâtissent le pont de la rédemption...</p>', isCollapsed: false, wordCount: 0, estMinutes: 0 },
        { id: `sec_${Date.now()}_4`, type: 'conclusion', title: '4. La Marche par la Foi (L\'Application)', contentHtml: '<p>Décision personnelle, repentance et impact concret dans nos relations quotidiennes...</p>', isCollapsed: false, wordCount: 0, estMinutes: 0 }
      ];
    } else if (type === 'application-grille') {
      this.pushHistoryState();
      this.addSection('conclusion', 'Grille d\'Applications Différenciées (David Helm)', `
        <p><strong>1. Sceptiques & Non-croyants :</strong> Quelle vérité de l\'Évangile interpelle leurs présupposés ?</p>
        <p><strong>2. Croyants éprouvés & souffrants :</strong> Quelle promesse et consolation solide ce texte offre-t-il ?</p>
        <p><strong>3. Croyants établis (danger de tiédeur) :</strong> Quel avertissement ou appel à la sainteté est proclamé ?</p>
        <p><strong>4. Vie publique & familiale :</strong> Quelle répercussion éthique (foyer, travail, société) en découle ?</p>
      `);
      return;
    }

    this.confirmStructureApplication(name, newSections, null);
  },

  async loadRealSermonModelsList(passageRef, query = '') {
    const container = document.getElementById('real-sermons-models-container');
    const badge = document.getElementById('real-sermons-count-badge');
    if (!container) return;

    try {
      const models = await API.getRealSermonModels(passageRef, query) || [];
      
      if (badge) {
        badge.textContent = `${models.length} dispo`;
      }

      if (models.length === 0) {
        container.innerHTML = `
          <div style="padding: 14px 10px; text-align: center; color: var(--text-muted); font-size: 11.5px; background: var(--bg-card); border-radius: 6px; border: 1px dashed var(--border-color);">
            Aucune prédication trouvée pour cette recherche.
          </div>
        `;
        return;
      }

      container.innerHTML = models.slice(0, 15).map(m => {
        const hasScore = m.match_score && m.match_score > 0;
        const matchTag = hasScore 
          ? `<span style="font-size: 9.5px; background: rgba(59, 130, 246, 0.18); color: var(--accent-blue, #3b82f6); padding: 1px 5px; border-radius: 4px; font-weight: 600; display: inline-flex; align-items: center; gap: 3px;"><svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg><span>Match Texte</span></span>` 
          : '';

        const preacherName = (m.preacher || '').trim();
        let displayTitle = m.title || 'Prédication sans titre';
        if (preacherName && !displayTitle.toLowerCase().includes(preacherName.toLowerCase())) {
          displayTitle = `${displayTitle} — ${preacherName}`;
        }

        const outlineItemsHtml = (m.outline || []).map(item => `
          <div style="font-size: 11px; padding: 3px 0; border-bottom: 1px dotted var(--border-color); display: flex; flex-direction: column; gap: 2px;">
            <span style="font-weight: 600; color: var(--text-primary);">${this.escapeHtml(item.titre || '')}</span>
            <span style="font-size: 10.5px; color: var(--text-secondary); opacity: 0.85;">${this.escapeHtml(item.synthese || '')}</span>
          </div>
        `).join('');

        return `
          <div class="sermon-resource-card" style="padding: 10px; border-radius: 6px; background: var(--bg-card); border: 1px solid var(--border-color); display: flex; flex-direction: column; gap: 8px;">
            <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 6px;">
              <div>
                <div style="font-size: 11.5px; font-weight: 700; color: var(--text-primary); line-height: 1.35;">
                  ${this.escapeHtml(displayTitle)}
                </div>
                <div style="font-size: 10.5px; color: var(--text-muted); margin-top: 3px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                  ${preacherName ? `<span style="display: inline-flex; align-items: center; gap: 4px; color: var(--text-primary); font-weight: 600;"><svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>${this.escapeHtml(preacherName)}</span><span>•</span>` : ''}
                  <span style="display: inline-flex; align-items: center; gap: 4px;"><svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>${this.escapeHtml(m.passage_reference || 'Texte')}</span>
                  <span>•</span>
                  <span style="display: inline-flex; align-items: center; gap: 4px;"><svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>${this.escapeHtml(m.duration || '35 min')}</span>
                  ${matchTag}
                </div>
              </div>
            </div>

            <!-- Big Idea / PMT -->
            ${m.big_idea ? `
              <div style="padding: 6px 8px; background: rgba(245, 158, 11, 0.08); border-left: 3px solid var(--accent-amber, #f59e0b); border-radius: 0 4px 4px 0; font-size: 11px; line-height: 1.35; color: var(--text-primary);">
                <strong style="color: var(--accent-amber, #f59e0b);">Proposition Centrale :</strong> « ${this.escapeHtml(m.big_idea)} »
              </div>
            ` : ''}

            <!-- Tension contemporaine -->
            ${m.contemporary_tension ? `
              <div style="font-size: 10.5px; color: var(--text-secondary); line-height: 1.35; font-style: italic; display: flex; align-items: flex-start; gap: 5px;">
                <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--accent-amber, #f59e0b); flex-shrink: 0; margin-top: 2px;"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                <div><strong>Tension :</strong> ${this.escapeHtml(m.contemporary_tension)}</div>
              </div>
            ` : ''}

            <!-- Plan détaillé repliable -->
            <details style="font-size: 11px; background: var(--bg-subtle, rgba(255,255,255,0.03)); padding: 6px 8px; border-radius: 4px; border: 1px solid var(--border-color);">
              <summary style="font-weight: 600; cursor: pointer; color: var(--text-secondary); user-select: none; display: inline-flex; align-items: center; gap: 6px;">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--text-muted);"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                <span>Plan homilétique (${(m.outline || []).length} sections)</span>
              </summary>
              <div style="margin-top: 6px; display: flex; flex-direction: column; gap: 4px;">
                ${outlineItemsHtml}
              </div>
            </details>

            <!-- Actions -->
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-top: 2px;">
              <button class="btn-primary btn-inject-model-plan" data-model-id="${this.escapeHtml(m.id)}" style="padding: 6px 10px; font-size: 11px; display: flex; align-items: center; gap: 6px; flex: 1; justify-content: center;">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                <span>Injecter ce canevas dans l'éditeur</span>
              </button>
            </div>
          </div>
        `;
      }).join('');

      // Bind des boutons d'injection
      container.querySelectorAll('.btn-inject-model-plan').forEach(btn => {
        btn.addEventListener('click', () => {
          const modelId = btn.dataset.modelId;
          const targetModel = models.find(m => m.id === modelId);
          if (targetModel) {
            this.insertRealSermonOutline(targetModel);
          }
        });
      });

    } catch (e) {
      console.error('Erreur chargement modèles de prédications réelles:', e);
      container.innerHTML = `
        <div style="padding: 10px; color: var(--accent-red, #ef4444); font-size: 11px;">
          Erreur lors du chargement des modèles réels.
        </div>
      `;
    }
  },

  insertRealSermonOutline(model) {
    if (!model || !model.outline || model.outline.length === 0) return;

    // Conversion de l'outline en blocs de section
    const newSections = [];
    model.outline.forEach((item, idx) => {
      let secType = 'point';
      const st = (item.section_type || '').toLowerCase();
      if (st.includes('intro')) secType = 'intro';
      else if (st.includes('concl')) secType = 'conclusion';
      else if (st.includes('scripture') || st.includes('lecture')) secType = 'scripture';

      const passagesStr = item.passages && item.passages.length > 0 ? ` (${item.passages.join(', ')})` : '';
      const title = `${item.titre || 'Point ' + (idx + 1)}${passagesStr}`;
      const synth = item.synthese || '';
      
      const contentHtml = `<p>${this.escapeHtml(synth)}</p>`;

      newSections.push({
        id: `sec_${Date.now()}_${idx}`,
        type: secType,
        title: title,
        contentHtml: contentHtml,
        isCollapsed: false,
        wordCount: 0,
        estMinutes: 0
      });
    });

    const preacherName = (model.preacher || '').trim();
    let displayTitle = model.title || "Canevas Homilétique";
    if (preacherName && !displayTitle.toLowerCase().includes(preacherName.toLowerCase())) {
      displayTitle = `${displayTitle} — ${preacherName}`;
    }

    this.confirmStructureApplication(
      displayTitle,
      newSections,
      {
        big_idea: model.big_idea,
        contemporary_tension: model.contemporary_tension,
        passage_reference: model.passage_reference,
        preacher: preacherName
      }
    );
  },

  // =========================================================================
  // MODE PUPITRE / PROMPTEUR LIVE
  // =========================================================================

  openPulpitMode() {
    const pulpitModal = document.getElementById('sermon-pulpit-modal');
    const container = document.getElementById('pulpit-content-container');
    if (!pulpitModal || !container) return;

    const sectionsHtml = this.sections.map((sec, idx) => {
      let temp = document.createElement('div');
      temp.innerHTML = sec.contentHtml || '';

      temp.querySelectorAll('.sermon-slide-badge').forEach(b => {
        let slideTag = document.createElement('span');
        slideTag.className = 'pulpit-slide-tag';
        slideTag.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg> <span>DIAPO</span>`;
        b.replaceWith(slideTag);
      });

      return `
        <div class="pulpit-section-card" id="pulpit-sec-${idx}">
          <div class="pulpit-section-title-row">
            <input type="checkbox" class="pulpit-point-check" title="Marquer cette section comme terminée">
            <div class="pulpit-point-heading">${this.escapeHtml(sec.title)}</div>
          </div>
          <div class="pulpit-section-body">
            ${temp.innerHTML}
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = sectionsHtml;
    container.style.fontSize = `${this.pulpitFontSize}px`;

    container.querySelectorAll('.pulpit-point-check').forEach(chk => {
      chk.addEventListener('change', (e) => {
        const card = e.target.closest('.pulpit-section-card');
        if (card) {
          card.classList.toggle('completed', e.target.checked);
        }
      });
    });

    pulpitModal.classList.remove('hidden');
    this.requestWakeLock();
  },

  closePulpitMode() {
    const pulpitModal = document.getElementById('sermon-pulpit-modal');
    if (pulpitModal) pulpitModal.classList.add('hidden');
    this.pausePulpitChrono();
    this.releaseWakeLock();
  },

  togglePulpitChrono() {
    if (this.pulpitIsPlaying) this.pausePulpitChrono();
    else this.startPulpitChrono();
  },

  startPulpitChrono() {
    this.pulpitIsPlaying = true;
    document.getElementById('pulpit-play-icon')?.classList.add('hidden');
    document.getElementById('pulpit-pause-icon')?.classList.remove('hidden');

    this.pulpitChronoTimer = setInterval(() => {
      this.pulpitChronoSeconds++;
      this.updatePulpitChronoDisplay();
    }, 1000);
  },

  pausePulpitChrono() {
    this.pulpitIsPlaying = false;
    document.getElementById('pulpit-play-icon')?.classList.remove('hidden');
    document.getElementById('pulpit-pause-icon')?.classList.add('hidden');
    clearInterval(this.pulpitChronoTimer);
  },

  resetPulpitChrono() {
    this.pausePulpitChrono();
    this.pulpitChronoSeconds = 0;
    this.updatePulpitChronoDisplay();
  },

  updatePulpitChronoDisplay() {
    const m = Math.floor(this.pulpitChronoSeconds / 60);
    const s = this.pulpitChronoSeconds % 60;
    const str = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    const el = document.getElementById('pulpit-chrono-display');
    if (el) el.textContent = str;
  },

  changePulpitFontSize(delta) {
    this.pulpitFontSize = Math.max(16, Math.min(38, this.pulpitFontSize + delta));
    const container = document.getElementById('pulpit-content-container');
    if (container) container.style.fontSize = `${this.pulpitFontSize}px`;
  },

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  },

  async requestWakeLock() {
    try {
      if ('wakeLock' in navigator) {
        this.pulpitWakeLock = await navigator.wakeLock.request('screen');
      }
    } catch (e) {}
  },

  releaseWakeLock() {
    if (this.pulpitWakeLock) {
      this.pulpitWakeLock.release().catch(() => {});
      this.pulpitWakeLock = null;
    }
  },

  // =========================================================================
  // GESTION DE L'HISTORIQUE (UNDO / REDO) & SÉCURITÉ DE STRUCTURE
  // =========================================================================

  historyDebounceTimer: null,

  resetHistory() {
    this.history = [];
    this.historyIndex = -1;
    this.pushHistoryState();
  },

  debouncedPushHistory() {
    if (this.historyDebounceTimer) {
      clearTimeout(this.historyDebounceTimer);
    }
    this.historyDebounceTimer = setTimeout(() => {
      this.pushHistoryState();
    }, 600);
  },

  pushHistoryState() {
    const currentState = {
      title: this.titleInput?.value || (this.currentSermon?.title || ''),
      sections: JSON.parse(JSON.stringify(this.sections || []))
    };

    // Éviter les doublons successifs strictement identiques
    if (this.history.length > 0 && this.historyIndex >= 0 && this.historyIndex < this.history.length) {
      const last = this.history[this.historyIndex];
      if (last && last.title === currentState.title && JSON.stringify(last.sections) === JSON.stringify(currentState.sections)) {
        this.updateUndoRedoButtonsState();
        return;
      }
    }

    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }

    this.history.push(currentState);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
    this.historyIndex = this.history.length - 1;
    this.updateUndoRedoButtonsState();
  },

  updateUndoRedoButtonsState() {
    const btnUndo = document.getElementById('btn-sermon-undo');
    const btnRedo = document.getElementById('btn-sermon-redo');
    if (btnUndo) {
      const canUndo = this.historyIndex > 0;
      btnUndo.disabled = !canUndo;
      btnUndo.style.opacity = canUndo ? '1' : '0.35';
      btnUndo.style.pointerEvents = canUndo ? 'auto' : 'none';
      btnUndo.title = canUndo ? 'Annuler (Ctrl+Z)' : 'Rien à annuler';
    }
    if (btnRedo) {
      const canRedo = this.historyIndex < this.history.length - 1;
      btnRedo.disabled = !canRedo;
      btnRedo.style.opacity = canRedo ? '1' : '0.35';
      btnRedo.style.pointerEvents = canRedo ? 'auto' : 'none';
      btnRedo.title = canRedo ? 'Rétablir (Ctrl+Y)' : 'Rien à rétablir';
    }
  },

  undo() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      this.restoreHistoryState(this.history[this.historyIndex]);
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast("Action annulée", "info", 1500);
      }
    }
  },

  redo() {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      this.restoreHistoryState(this.history[this.historyIndex]);
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast("Action rétablie", "info", 1500);
      }
    }
  },

  restoreHistoryState(state) {
    if (!state) return;
    if (this.titleInput) this.titleInput.value = state.title || '';
    if (this.currentSermon) this.currentSermon.title = state.title || '';
    this.sections = JSON.parse(JSON.stringify(state.sections || []));
    this.renderSections();
    this.renderOutline();
    this.updateMetrics();
    this.debouncedAutoSave();
    this.updateUndoRedoButtonsState();
  },

  hasUserContent() {
    if (!this.sections || this.sections.length === 0) return false;
    return this.sections.some(s => {
      const text = (s.contentHtml || '').replace(/<[^>]+>/g, '').trim();
      return text.length > 0 && !this.isDefaultPlaceholder(text);
    });
  },

  adaptSectionsStructure(currentSections, newSections) {
    if (!currentSections || currentSections.length === 0) return newSections;
    
    // Identifier les sections rédigées par l'utilisateur
    const userSections = currentSections.filter(s => {
      const text = (s.contentHtml || '').replace(/<[^>]+>/g, '').trim();
      return text.length > 0 && !this.isDefaultPlaceholder(text);
    });

    if (userSections.length === 0) {
      return newSections;
    }

    // Regrouper par catégories
    const currIntro = currentSections.find(s => s.type === 'intro' && !this.isDefaultPlaceholder((s.contentHtml || '').replace(/<[^>]+>/g, '')));
    const currConcl = currentSections.find(s => s.type === 'conclusion' && !this.isDefaultPlaceholder((s.contentHtml || '').replace(/<[^>]+>/g, '')));
    const currScripture = currentSections.find(s => s.type === 'scripture' && !this.isDefaultPlaceholder((s.contentHtml || '').replace(/<[^>]+>/g, '')));
    
    // Points de corps (ou toutes sections hors intro/concl/scripture)
    const currPoints = currentSections.filter(s => {
      if (s === currIntro || s === currConcl || s === currScripture) return false;
      const text = (s.contentHtml || '').replace(/<[^>]+>/g, '').trim();
      return text.length > 0 && !this.isDefaultPlaceholder(text);
    });

    const adapted = JSON.parse(JSON.stringify(newSections));
    const targetPoints = adapted.filter(s => s.type === 'point');
    const targetIntro = adapted.find(s => s.type === 'intro');
    const targetConcl = adapted.find(s => s.type === 'conclusion');
    const targetScripture = adapted.find(s => s.type === 'scripture');

    // 1. Adapter l'Introduction
    if (targetIntro && currIntro) {
      targetIntro.contentHtml = currIntro.contentHtml;
    }

    // 2. Adapter la Lecture Biblique
    if (targetScripture && currScripture) {
      targetScripture.contentHtml = currScripture.contentHtml;
    }

    // 3. Adapter les Points séquentiellement
    const usedCurrPoints = new Set();
    targetPoints.forEach((tPoint, idx) => {
      if (idx < currPoints.length) {
        const cPoint = currPoints[idx];
        tPoint.contentHtml = cPoint.contentHtml;
        usedCurrPoints.add(cPoint);
      }
    });

    // 4. Gérer les points excédentaires (si l'ancien plan avait plus de points que le nouveau)
    const surplusPoints = currPoints.filter(p => !usedCurrPoints.has(p));
    if (surplusPoints.length > 0) {
      let surplusHtml = '';
      surplusPoints.forEach(sp => {
        surplusHtml += `
          <div class="sermon-preserved-box" style="margin-top: 14px; padding: 10px 14px; background: rgba(245, 158, 11, 0.08); border-left: 3px solid #f59e0b; border-radius: 4px;">
            <div style="font-size: 11.5px; font-weight: 700; color: #f59e0b; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
              <span>[Texte conservé de l'ancien plan : ${this.escapeHtml(sp.title)}]</span>
            </div>
            ${sp.contentHtml}
          </div>
        `;
      });

      const lastPoint = targetPoints[targetPoints.length - 1];
      if (lastPoint) {
        lastPoint.contentHtml += surplusHtml;
      } else if (targetConcl) {
        targetConcl.contentHtml = surplusHtml + targetConcl.contentHtml;
      }
    }

    // 5. Adapter la Conclusion
    if (targetConcl && currConcl) {
      targetConcl.contentHtml = currConcl.contentHtml;
    }

    return adapted;
  },

  applyStructureResult(structureName, sections, modelMeta = null, successMsg = null) {
    this.pushHistoryState();

    if (modelMeta && this.currentSermon) {
      if (!this.currentSermon.big_idea && modelMeta.big_idea) {
        this.currentSermon.big_idea = modelMeta.big_idea;
        this.currentSermon.pmt = modelMeta.big_idea;
        this.currentSermon.pms = modelMeta.big_idea;
      }
      if (!this.currentSermon.contemporary_tension && modelMeta.contemporary_tension) {
        this.currentSermon.contemporary_tension = modelMeta.contemporary_tension;
      }
      if (!this.currentSermon.passage?.reference && modelMeta.passage_reference) {
        this.currentSermon.passage = { reference: modelMeta.passage_reference };
      }
      if (modelMeta.preacher && !this.currentSermon.preacher) {
        this.currentSermon.preacher = modelMeta.preacher;
      }
      this.updateHeaderSummary(this.currentSermon);
    }

    this.sections = sections;
    this.renderSections();
    this.renderOutline();
    this.updateMetrics();
    this.debouncedAutoSave();

    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast(successMsg || `Structure « ${structureName} » appliquée !`);
    }
  },

  confirmStructureApplication(structureName, newSections, modelMeta = null) {
    if (!this.hasUserContent()) {
      this.applyStructureResult(structureName, newSections, modelMeta, `Structure « ${structureName} » appliquée !`);
      return;
    }

    let modal = document.getElementById('sermon-structure-confirm-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'sermon-structure-confirm-modal';
      document.body.appendChild(modal);
    }

    modal.className = 'modal-dialog-container modal-overlay';
    modal.style.display = 'flex';
    modal.style.zIndex = '999999';

    modal.innerHTML = `
      <div class="structure-modal-card">
        <div class="structure-modal-header">
          <div class="structure-modal-title">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--accent-amber, #f59e0b); flex-shrink: 0;"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <span>Application du canevas : ${this.escapeHtml(structureName)}</span>
          </div>
          <button class="btn-icon-subtle btn-close-confirm" style="cursor: pointer;"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>
        <div class="structure-modal-body">
          <div>
            <div style="font-size: 13px; font-weight: 600; color: var(--text-primary); margin-bottom: 4px;">
              Vous avez déjà du contenu rédigé dans votre prédication.
            </div>
            <div style="font-size: 12px; color: var(--text-secondary); line-height: 1.45;">
              Choisissez comment vous souhaitez intégrer la nouvelle structure sans perdre vos idées.
            </div>
          </div>

          <div class="structure-choice-grid">
            <!-- Option 1 : Conserver & Adapter -->
            <div class="structure-choice-card highlight btn-opt-adapt">
              <div class="structure-card-top">
                <div class="structure-card-icon" style="color: #10b981; background: rgba(16, 185, 129, 0.12);">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                </div>
                <span class="structure-badge instant">100% Instantané</span>
              </div>
              <div class="structure-card-title">1. Conserver mes textes &amp; adapter</div>
              <p class="structure-card-desc">Garde tous vos écrits dans l'ordre, met à jour les titres et fusionne les surplus sans rien perdre (sans IA, 0s).</p>
            </div>

            <!-- Option 2 : Réorganisation IA -->
            <div class="structure-choice-card btn-opt-ai">
              <div class="structure-card-top">
                <div class="structure-card-icon" style="color: #a855f7; background: rgba(168, 85, 247, 0.12);">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>
                </div>
                <span class="structure-badge ai">IA Homilétique</span>
              </div>
              <div class="structure-card-title">2. Réorganisation par l'IA</div>
              <p class="structure-card-desc">L'IA analyse le sens de vos idées et les distribue intelligemment dans les axes du nouveau canevas avec transitions.</p>
            </div>

            <!-- Option 3 : Brouillon Archive -->
            <div class="structure-choice-card btn-opt-draft">
              <div class="structure-card-top">
                <div class="structure-card-icon" style="color: #f59e0b; background: rgba(245, 158, 11, 0.12);">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
                </div>
                <span class="structure-badge draft">Brouillon</span>
              </div>
              <div class="structure-card-title">3. Appliquer à neuf &amp; archiver</div>
              <p class="structure-card-desc">Insère le canevas à blanc et place l'intégralité de vos anciens textes dans un bloc replié en bas pour copier/coller.</p>
            </div>

            <!-- Option 4 : Remplacer à blanc -->
            <div class="structure-choice-card btn-opt-clean">
              <div class="structure-card-top">
                <div class="structure-card-icon" style="color: #94a3b8; background: rgba(148, 163, 184, 0.12);">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </div>
                <span class="structure-badge clean">Canevas Vierge</span>
              </div>
              <div class="structure-card-title">4. Remplacer à blanc</div>
              <p class="structure-card-desc">Remplace entièrement le plan actuel par le canevas vierge (toujours 100% annulable via ↶ / Ctrl+Z).</p>
            </div>
          </div>

          <div id="sermon-restructure-loading-indicator" style="display: none; padding: 14px; background: rgba(168, 85, 247, 0.08); border: 1px solid rgba(168, 85, 247, 0.25); border-radius: 8px; align-items: center; gap: 12px;">
            <div class="spinner" style="width: 20px; height: 20px; border-width: 2.5px; border-top-color: #a855f7;"></div>
            <div style="font-size: 12px; color: var(--text-primary);">
              <strong>Réorganisation IA en cours...</strong>
              <div style="font-size: 11px; color: var(--text-secondary);">Redistribution théologique des paragraphes et harmonisation des transitions.</div>
            </div>
          </div>
        </div>
        <div class="structure-modal-footer">
          <button type="button" class="btn-secondary btn-close-confirm" style="padding: 7px 16px; font-size: 12px;">
            <span>Annuler</span>
          </button>
        </div>
      </div>
    `;

    modal.classList.remove('hidden');
    modal.style.display = 'flex';

    const closeModal = () => {
      modal.classList.add('hidden');
      modal.style.display = 'none';
    };

    modal.onclick = (e) => {
      if (e.target === modal) closeModal();
    };

    modal.querySelectorAll('.btn-close-confirm').forEach(b => b.addEventListener('click', closeModal));

    // Option 1 : Adapter les titres
    modal.querySelector('.btn-opt-adapt')?.addEventListener('click', () => {
      closeModal();
      const adapted = this.adaptSectionsStructure(this.sections, newSections);
      this.applyStructureResult(structureName, adapted, modelMeta, `Structure « ${structureName} » adaptée avec vos textes !`);
    });

    // Option 2 : Réorganisation IA
    modal.querySelector('.btn-opt-ai')?.addEventListener('click', async () => {
      const loader = document.getElementById('sermon-restructure-loading-indicator');
      const grid = modal.querySelector('.structure-choice-grid');
      if (loader) loader.style.display = 'flex';
      if (grid) grid.style.pointerEvents = 'none';

      try {
        const res = await API.reorganizeSermonWithAI(this.sections, newSections, this.currentSermon);
        if (res && res.success && Array.isArray(res.sections) && res.sections.length > 0) {
          closeModal();
          this.applyStructureResult(structureName, res.sections, modelMeta, `✓ Prédication restructurée avec succès par l'IA (${res.used_model || 'Modèle IA'}) !`);
        } else {
          if (loader) loader.style.display = 'none';
          if (grid) grid.style.pointerEvents = 'auto';
          const errMsg = res?.error || "Erreur de communication avec l'assistant IA.";
          if (confirm(`${errMsg}\n\nSouhaitez-vous basculer instantanément sur l'Option 1 (Conserver et adapter sans IA) ?`)) {
            closeModal();
            const adapted = this.adaptSectionsStructure(this.sections, newSections);
            this.applyStructureResult(structureName, adapted, modelMeta, `Structure « ${structureName} » adaptée avec vos textes !`);
          }
        }
      } catch (err) {
        if (loader) loader.style.display = 'none';
        if (grid) grid.style.pointerEvents = 'auto';
        console.error("Erreur réorganisation IA", err);
        if (confirm(`Erreur : ${err}\n\nSouhaitez-vous basculer instantanément sur l'Option 1 (Conserver et adapter sans IA) ?`)) {
          closeModal();
          const adapted = this.adaptSectionsStructure(this.sections, newSections);
          this.applyStructureResult(structureName, adapted, modelMeta, `Structure « ${structureName} » adaptée avec vos textes !`);
        }
      }
    });

    // Option 3 : Brouillon Archive
    modal.querySelector('.btn-opt-draft')?.addEventListener('click', () => {
      closeModal();
      let archivedHtml = '';
      this.sections.forEach((s, idx) => {
        const text = (s.contentHtml || '').replace(/<[^>]+>/g, '').trim();
        if (text.length > 0 && !this.isDefaultPlaceholder(text)) {
          archivedHtml += `
            <div style="margin-bottom: 14px; padding: 10px 12px; background: rgba(255, 255, 255, 0.04); border-left: 3px solid var(--accent-primary, #3b82f6); border-radius: 4px;">
              <div style="font-size: 11px; font-weight: 700; color: var(--text-primary); margin-bottom: 4px;">${this.escapeHtml(s.title || 'Section ' + (idx + 1))}</div>
              <div style="font-size: 12.5px; line-height: 1.5; color: var(--text-secondary);">${s.contentHtml}</div>
            </div>
          `;
        }
      });

      const draftSection = {
        id: `sec_draft_${Date.now()}`,
        type: 'point',
        title: 'Brouillon & Textes de la version précédente',
        contentHtml: archivedHtml || '<p><em>(Aucun texte rédigé précédemment)</em></p>',
        isCollapsed: true,
        wordCount: 0,
        estMinutes: 0
      };

      const finalSections = [...JSON.parse(JSON.stringify(newSections)), draftSection];
      this.applyStructureResult(structureName, finalSections, modelMeta, `Structure « ${structureName} » appliquée avec archive brouillon en bas !`);
    });

    // Option 4 : Remplacer à blanc
    modal.querySelector('.btn-opt-clean')?.addEventListener('click', () => {
      closeModal();
      this.applyStructureResult(structureName, newSections, modelMeta, `Structure « ${structureName} » appliquée à blanc !`);
    });
  },

  // =========================================================================
  // INFOBULLE FLOTTANTE DE SÉLECTION STYLE ANYTYPE (SERMONS)
  // =========================================================================

  floatingToolbar: null,
  currentSelectionRange: null,

  bindFloatingToolbar() {
    const toolbar = document.getElementById('sermon-floating-toolbar');
    if (!toolbar) return;
    this.floatingToolbar = toolbar;

    // Empêcher la perte de sélection lors du clic sur la barre flottante
    toolbar.addEventListener('mousedown', (e) => {
      e.preventDefault();
    });

    const blockTypeBtn = document.getElementById('sft-btn-block-type');
    const blockMenu = document.getElementById('sft-block-menu');
    const moreBtn = document.getElementById('sft-btn-more');
    const moreMenu = document.getElementById('sft-more-menu');

    // Menu Type de Bloc
    blockTypeBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      moreMenu?.classList.add('hidden');
      blockMenu?.classList.toggle('hidden');
    });

    // Menu Plus d'options
    moreBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      blockMenu?.classList.add('hidden');
      moreMenu?.classList.toggle('hidden');
    });

    // Clic sur les boutons principaux
    toolbar.querySelectorAll('.nft-btn[data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        this.handleFloatingToolbarAction(action);
      });
    });

    // Clic sur les éléments des menus déroulants
    toolbar.querySelectorAll('.nft-dropdown-item[data-action]').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = item.dataset.action;
        blockMenu?.classList.add('hidden');
        moreMenu?.classList.add('hidden');
        this.handleFloatingToolbarAction(action);
      });
    });

    // Fermer les sous-menus au clic extérieur
    document.addEventListener('click', (e) => {
      if (!toolbar.contains(e.target)) {
        blockMenu?.classList.add('hidden');
        moreMenu?.classList.add('hidden');
      }
    });

    // Détection de la sélection dans n'importe quel éditeur de section
    const updateSelectionToolbar = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) {
        this.hideFloatingToolbar();
        return;
      }

      const range = sel.getRangeAt(0);
      let container = range.commonAncestorContainer;
      if (container.nodeType === Node.TEXT_NODE) container = container.parentNode;
      const editor = container.closest('.sermon-section-editor');
      if (!editor) {
        this.hideFloatingToolbar();
        return;
      }

      const text = sel.toString().trim();
      if (!text) {
        this.hideFloatingToolbar();
        return;
      }

      this.showFloatingToolbar(range);
    };

    document.addEventListener('selectionchange', () => {
      setTimeout(updateSelectionToolbar, 10);
    });

    window.addEventListener('scroll', () => {
      if (!this.floatingToolbar?.classList.contains('hidden')) {
        const sel = window.getSelection();
        if (sel && !sel.isCollapsed && sel.rangeCount) {
          const range = sel.getRangeAt(0);
          let container = range.commonAncestorContainer;
          if (container.nodeType === Node.TEXT_NODE) container = container.parentNode;
          if (container.closest('.sermon-section-editor')) {
            this.showFloatingToolbar(range);
          }
        }
      }
    }, true);
  },

  showFloatingToolbar(range) {
    const toolbar = this.floatingToolbar;
    if (!toolbar) return;

    this.currentSelectionRange = range.cloneRange();
    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      this.hideFloatingToolbar();
      return;
    }

    toolbar.classList.remove('hidden');

    const toolbarWidth = toolbar.offsetWidth || 340;
    const toolbarHeight = toolbar.offsetHeight || 36;

    let left = rect.left + (rect.width / 2) - (toolbarWidth / 2);
    let top = rect.top - toolbarHeight - 8;

    if (top < 55) {
      top = rect.bottom + 8;
    }

    if (left < 10) left = 10;
    if (left + toolbarWidth > window.innerWidth - 10) {
      left = window.innerWidth - toolbarWidth - 10;
    }
    if (top + toolbarHeight > window.innerHeight - 10) {
      top = window.innerHeight - toolbarHeight - 10;
    }

    toolbar.style.top = `${Math.round(top)}px`;
    toolbar.style.left = `${Math.round(left)}px`;

    this.updateCurrentBlockLabel(range);
    this.updateFloatingButtonsState();
  },

  hideFloatingToolbar() {
    if (this.floatingToolbar) {
      this.floatingToolbar.classList.add('hidden');
      document.getElementById('sft-block-menu')?.classList.add('hidden');
      document.getElementById('sft-more-menu')?.classList.add('hidden');
    }
  },

  updateCurrentBlockLabel(range) {
    const labelEl = document.getElementById('sft-current-block-label');
    if (!labelEl) return;

    let node = range.commonAncestorContainer;
    if (node.nodeType === Node.TEXT_NODE) node = node.parentNode;

    const block = node.closest('h1, h2, h3, blockquote, .sermon-callout-block, ul, ol, p') || node;
    const tag = block.tagName ? block.tagName.toLowerCase() : '';

    if (tag === 'h1') labelEl.textContent = 'H1';
    else if (tag === 'h2') labelEl.textContent = 'H2';
    else if (tag === 'h3') labelEl.textContent = 'H3';
    else if (tag === 'blockquote') labelEl.textContent = '”';
    else if (block.classList?.contains('sermon-block-scripture')) {
      labelEl.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" style="display:inline-block; vertical-align:middle;"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>';
    } else if (block.classList?.contains('sermon-block-exegesis')) {
      labelEl.innerHTML = '<span style="font-weight:700; font-size:11px; font-family:serif;">ΑΩ</span>';
    } else if (block.classList?.contains('sermon-block-illustration')) {
      labelEl.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" style="display:inline-block; vertical-align:middle; color:var(--accent-amber,#f59e0b);"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1.3.5 2.6 1.5 3.5.8.8 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>';
    } else if (block.classList?.contains('sermon-block-application')) {
      labelEl.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" style="display:inline-block; vertical-align:middle; color:var(--accent-green,#10b981);"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 14 14"/></svg>';
    } else if (block.classList?.contains('sermon-block-cue')) {
      labelEl.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" style="display:inline-block; vertical-align:middle;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';
    } else if (tag === 'ul') {
      labelEl.textContent = '•';
    } else {
      labelEl.textContent = 'Aa';
    }
  },

  updateFloatingButtonsState() {
    if (!this.floatingToolbar) return;
    const checkState = (action, query) => {
      const btn = this.floatingToolbar.querySelector(`.nft-btn[data-action="${action}"]`);
      if (btn) {
        try {
          const isActive = document.queryCommandState(query);
          btn.classList.toggle('active', !!isActive);
        } catch (e) {
          btn.classList.remove('active');
        }
      }
    };

    checkState('bold', 'bold');
    checkState('italic', 'italic');
    checkState('underline', 'underline');
    checkState('strikethrough', 'strikeThrough');
  },

  handleFloatingToolbarAction(action) {
    if (this.currentSelectionRange) {
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(this.currentSelectionRange);
    }

    if (['scripture', 'exegesis', 'illustration', 'application', 'cue', 'slide'].includes(action)) {
      this.insertBlock(action);
    } else if (action === 'h1') {
      document.execCommand('formatBlock', false, 'h1');
    } else if (action === 'h2') {
      document.execCommand('formatBlock', false, 'h2');
    } else if (action === 'h3') {
      document.execCommand('formatBlock', false, 'h3');
    } else if (action === 'text') {
      document.execCommand('formatBlock', false, 'p');
    } else if (action === 'quote') {
      document.execCommand('formatBlock', false, 'blockquote');
    } else if (action === 'bullet') {
      document.execCommand('insertUnorderedList');
    } else if (action === 'bold') {
      document.execCommand('bold');
    } else if (action === 'italic') {
      document.execCommand('italic');
    } else if (action === 'underline') {
      document.execCommand('underline');
    } else if (action === 'strikethrough') {
      document.execCommand('strikeThrough');
    } else if (action === 'code') {
      this.surroundSelectionWithTag('code');
    } else if (action === 'highlight') {
      this.surroundSelectionWithTag('mark');
    } else if (action === 'superscript') {
      document.execCommand('superscript');
    } else if (action === 'subscript') {
      document.execCommand('subscript');
    } else if (action === 'clear-format') {
      document.execCommand('removeFormat');
    }

    this.pushHistoryState();
    this.debouncedAutoSave();
    this.updateFloatingButtonsState();
  },

  surroundSelectionWithTag(tagName) {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    const selectedText = range.extractContents();
    
    let parent = range.commonAncestorContainer;
    if (parent.nodeType === Node.TEXT_NODE) parent = parent.parentNode;
    const existing = parent.closest(tagName);
    if (existing) {
      const textNode = document.createTextNode(existing.textContent);
      existing.parentNode.replaceChild(textNode, existing);
      return;
    }

    const wrapper = document.createElement(tagName);
    wrapper.appendChild(selectedText);
    range.insertNode(wrapper);
    sel.removeAllRanges();
    const newRange = document.createRange();
    newRange.selectNodeContents(wrapper);
    sel.addRange(newRange);
  },

  // =========================================================================
  // GESTION DU MENU SLASH MODAL (/) DANS L'ÉDITEUR DE SERMON
  // =========================================================================

  isSlashMenuOpen: false,
  slashMenuEl: null,
  slashSelectedIndex: 0,
  slashCurrentItems: [],
  slashAnchorRange: null,

  getSlashCommandsDefinitions() {
    return [
      {
        category: "Structure Homilétique",
        items: [
          { id: "point", label: "Point Principal", iconText: "H1", desc: "Nouveau point majeur (Titre H1)", action: "point" },
          { id: "subpoint", label: "Sous-point", iconText: "H2", desc: "Sous-division du point (Titre H2)", action: "subpoint" },
          { id: "scripture", label: "Lecture Biblique / Écriture", iconSvg: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`, desc: "Encadré de citation du passage biblique", action: "scripture" },
          { id: "exegesis", label: "Exégèse & Terme original", iconSvg: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="m8.5 13.5 2-5.5 2 5.5"/><path d="M9.2 11.8h2.6"/><path d="M14 8.5h3.5l-3.5 5h3.5"/></svg>`, desc: "Analyse du mot hébreu/grec et portée", action: "exegesis" },
          { id: "illustration", label: "Illustration / Récit", iconSvg: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1.3.5 2.6 1.5 3.5.8.8 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>`, desc: "Anecdote, histoire ou métaphore concrète", action: "illustration" },
          { id: "application", label: "Application pratique", iconSvg: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>`, desc: "Question au cœur et défi pour la semaine", action: "application" },
          { id: "cue", label: "Régie & Timing", iconSvg: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`, desc: "Indication technique pour le pupitre ou la vidéo", action: "cue" },
          { id: "slide", label: "Diapositive [_]", iconSvg: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`, desc: "Insérer le repère de projection [ _ ]", action: "slide" }
        ]
      },
      {
        category: "Formatage & Blocs",
        items: [
          { id: "h3", label: "Sous-titre 3", iconText: "H3", desc: "Titre de niveau 3 (H3)", action: "h3" },
          { id: "quote", label: "Citation", iconSvg: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.75-2-2-2H4c-1.25 0-2 .75-2 2v6c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/></svg>`, desc: "Citation théologique ou d'auteur", action: "quote" },
          { id: "bullet", label: "Liste à puces", iconSvg: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>`, desc: "Liste d'idées ou points concis", action: "bullet" },
          { id: "divider", label: "Ligne de séparation", iconSvg: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"/></svg>`, desc: "Séparateur horizontal (---)", action: "divider" }
        ]
      }
    ];
  },

  handleSlashInput(e) {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) {
      this.closeSlashMenu();
      return;
    }

    const range = sel.getRangeAt(0);
    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) {
      this.closeSlashMenu();
      return;
    }

    const textBefore = node.textContent.slice(0, range.startOffset);
    const lastSlashIndex = textBefore.lastIndexOf('/');

    if (lastSlashIndex !== -1) {
      const isStartOrSpace = lastSlashIndex === 0 || /\s/.test(textBefore[lastSlashIndex - 1]);
      if (isStartOrSpace) {
        const query = textBefore.slice(lastSlashIndex + 1);
        const rect = range.getBoundingClientRect();
        this.openSlashMenu(query, rect);
        return;
      }
    }

    this.closeSlashMenu();
  },

  openSlashMenu(query = '', rect = null) {
    if (!this.slashMenuEl) {
      this.createSlashMenuEl();
    }

    try {
      this.slashAnchorRange = window.getSelection().getRangeAt(0).cloneRange();
    } catch (e) {
      this.slashAnchorRange = null;
    }

    this.renderSlashMenuItems(query);
    this.slashMenuEl.classList.remove('hidden');
    this.isSlashMenuOpen = true;

    if (rect && (rect.top > 0 || rect.bottom > 0)) {
      const menuWidth = this.slashMenuEl.offsetWidth || 280;
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      const left = Math.min(viewportWidth - menuWidth - 16, Math.max(10, rect.left));
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;
      const measuredHeight = this.slashMenuEl.offsetHeight || 300;

      if (spaceBelow < measuredHeight + 16 && spaceAbove > spaceBelow) {
        // Afficher au-dessus du curseur
        const maxHeight = Math.max(140, Math.min(380, spaceAbove - 20));
        this.slashMenuEl.style.maxHeight = `${maxHeight}px`;
        const menuHeight = this.slashMenuEl.offsetHeight || measuredHeight;
        const top = Math.max(10, rect.top - menuHeight - 6);
        this.slashMenuEl.style.left = `${left}px`;
        this.slashMenuEl.style.top = `${top}px`;
      } else {
        // Afficher en-dessous du curseur
        const maxHeight = Math.max(140, Math.min(380, spaceBelow - 20));
        this.slashMenuEl.style.maxHeight = `${maxHeight}px`;
        const top = rect.bottom + 6;
        this.slashMenuEl.style.left = `${left}px`;
        this.slashMenuEl.style.top = `${top}px`;
      }
    }
  },

  closeSlashMenu() {
    if (this.slashMenuEl) {
      this.slashMenuEl.classList.add('hidden');
    }
    this.isSlashMenuOpen = false;
  },

  createSlashMenuEl() {
    let el = document.getElementById('sermon-slash-menu');
    if (!el) {
      el = document.createElement('div');
      el.id = 'sermon-slash-menu';
      el.className = 'notes-slash-dropdown hidden';
      document.body.appendChild(el);
    }
    this.slashMenuEl = el;

    document.addEventListener('click', (e) => {
      if (this.isSlashMenuOpen && !this.slashMenuEl.contains(e.target) && !e.target.closest('.sermon-section-editor')) {
        this.closeSlashMenu();
      }
    });
  },

  renderSlashMenuItems(query = '') {
    const q = query.toLowerCase().trim();
    const categories = this.getSlashCommandsDefinitions();

    let flatItems = [];
    let html = '';

    categories.forEach(cat => {
      const matching = cat.items.filter(item => 
        !q || item.label.toLowerCase().includes(q) || item.desc.toLowerCase().includes(q) || item.id.toLowerCase().includes(q)
      );

      if (matching.length > 0) {
        html += `<div class="slash-category-header">${cat.category}</div>`;
        matching.forEach(item => {
          const currentIndex = flatItems.length;
          flatItems.push(item);
          const icon = item.iconSvg || `<span class="slash-icon-text">${item.iconText || 'Aa'}</span>`;
          html += `
            <div class="slash-item ${currentIndex === 0 ? 'active' : ''}" data-action="${item.action}" data-index="${currentIndex}">
              <div class="slash-item-icon">${icon}</div>
              <div class="slash-item-text">
                <div class="slash-item-label">${this.escapeHtml(item.label)}</div>
                <div class="slash-item-desc">${this.escapeHtml(item.desc)}</div>
              </div>
            </div>
          `;
        });
      }
    });

    this.slashCurrentItems = flatItems;
    this.slashSelectedIndex = 0;

    if (flatItems.length === 0) {
      html = `<div class="slash-empty">Aucune commande trouvée</div>`;
    }

    this.slashMenuEl.innerHTML = html;

    this.slashMenuEl.querySelectorAll('.slash-item').forEach(itemEl => {
      itemEl.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = itemEl.dataset.action;
        this.executeSlashCommand(action);
      });
    });
  },

  handleSlashKeyDown(e) {
    if (!this.isSlashMenuOpen) return false;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (this.slashCurrentItems.length > 0) {
        this.slashSelectedIndex = (this.slashSelectedIndex + 1) % this.slashCurrentItems.length;
        this.updateSlashSelection();
      }
      return true;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (this.slashCurrentItems.length > 0) {
        this.slashSelectedIndex = (this.slashSelectedIndex - 1 + this.slashCurrentItems.length) % this.slashCurrentItems.length;
        this.updateSlashSelection();
      }
      return true;
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (this.slashCurrentItems[this.slashSelectedIndex]) {
        this.executeSlashCommand(this.slashCurrentItems[this.slashSelectedIndex].action);
      }
      return true;
    } else if (e.key === 'Escape') {
      e.preventDefault();
      this.closeSlashMenu();
      return true;
    }
    return false;
  },

  updateSlashSelection() {
    this.slashMenuEl.querySelectorAll('.slash-item').forEach((item, idx) => {
      const isActive = idx === this.slashSelectedIndex;
      item.classList.toggle('active', isActive);
      if (isActive) {
        item.scrollIntoView({ block: 'nearest' });
      }
    });
  },

  executeSlashCommand(action) {
    this.closeSlashMenu();

    if (this.slashAnchorRange) {
      try {
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(this.slashAnchorRange);

        const node = this.slashAnchorRange.startContainer;
        if (node && node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent;
          const lastSlash = text.lastIndexOf('/');
          if (lastSlash !== -1) {
            node.textContent = text.slice(0, lastSlash);
          }
        }
      } catch (e) {
        console.warn('Erreur nettoyage slash anchor:', e);
      }
    }

    if (action === 'point') {
      this.addSection('point');
    } else if (['scripture', 'exegesis', 'illustration', 'application', 'cue', 'slide', 'subpoint'].includes(action)) {
      this.insertBlock(action);
    } else if (action === 'h1') {
      document.execCommand('formatBlock', false, 'h1');
    } else if (action === 'h2') {
      document.execCommand('formatBlock', false, 'h2');
    } else if (action === 'h3') {
      document.execCommand('formatBlock', false, 'h3');
    } else if (action === 'text') {
      document.execCommand('formatBlock', false, 'p');
    } else if (action === 'quote') {
      document.execCommand('formatBlock', false, 'blockquote');
    } else if (action === 'bullet') {
      document.execCommand('insertUnorderedList');
    } else if (action === 'divider') {
      document.execCommand('insertHorizontalRule');
    }

    this.pushHistoryState();
    this.debouncedAutoSave();
  },

  // =========================================================================
  // SUGGESTIONS D'ILLUSTRATIONS & SÉLECTEUR MODAL DU RÉSERVOIR
  // =========================================================================

  currentTargetIllustrationBlock: null,
  activeIllPickerFilter: 'context',

  findMatchingIllustrations(context = {}, limit = 6) {
    if (!this.illustrations || this.illustrations.length === 0) return [];

    const sermonPassage = (this.currentSermon?.passage?.reference || '').toLowerCase().trim();
    const sermonTitle = (this.currentSermon?.title || '').toLowerCase().trim();
    const sermonBigIdea = (this.currentSermon?.big_idea || '').toLowerCase().trim();
    const sectionTitle = (context.sectionTitle || '').toLowerCase().trim();
    const query = (context.query || '').toLowerCase().trim();

    let bookTokens = [];
    if (sermonPassage) {
      bookTokens = sermonPassage.split(/[\s,.:;-]+/).filter(w => w.length >= 2);
    }

    const stopWords = new Set(['dans', 'pour', 'avec', 'sans', 'sous', 'vers', 'chez', 'cette', 'notre', 'votre', 'leurs', 'tout', 'tous', 'plus', 'très', 'faire', 'être', 'avoir', 'comme', 'mais', 'donc', 'ainsi', 'aussi', 'bien', 'point', 'titre', 'section', 'partie', 'axe']);
    const extractKeywords = (str) => {
      return str.split(/[\s,.:;!?'"«»()\[\]-]+/)
        .map(w => w.trim().toLowerCase())
        .filter(w => w.length >= 3 && !stopWords.has(w));
    };

    const themeKeywords = [
      ...extractKeywords(sermonTitle),
      ...extractKeywords(sermonBigIdea),
      ...extractKeywords(sectionTitle),
      ...(query ? extractKeywords(query) : [])
    ];

    const scored = this.illustrations.map(ill => {
      let score = 0;
      const title = (ill.title || '').toLowerCase();
      const body = (ill.body || ill.content || '').toLowerCase();
      const category = (ill.category || '').toLowerCase();
      const author = (ill.author || '').toLowerCase();
      const tags = (Array.isArray(ill.tags) ? ill.tags.join(' ') : (ill.tags || '')).toLowerCase();
      const passages = (Array.isArray(ill.passages_associes) ? ill.passages_associes.join(' ') : (ill.passages_associes || '')).toLowerCase();

      // 1. Recherche directe (query)
      if (query) {
        if (title.includes(query)) score += 40;
        if (passages.includes(query)) score += 30;
        if (tags.includes(query)) score += 20;
        if (category.includes(query)) score += 15;
        if (body.includes(query)) score += 10;
        if (author.includes(query)) score += 10;
      }

      // 2. Correspondance du passage biblique
      if (sermonPassage && passages) {
        if (passages.includes(sermonPassage)) {
          score += 60;
        } else {
          bookTokens.forEach(tok => {
            if (passages.includes(tok)) score += 15;
          });
        }
      }

      // 3. Mots-clés du thème / point
      themeKeywords.forEach(kw => {
        if (title.includes(kw)) score += 18;
        if (tags.includes(kw)) score += 12;
        if (category.includes(kw)) score += 8;
        if (body.includes(kw)) score += 4;
      });

      return { ill, score };
    });

    scored.sort((a, b) => b.score - a.score);

    if (scored.length > 0 && scored[0].score > 0) {
      return scored.slice(0, limit).map(s => s.ill);
    }
    return this.illustrations.slice(0, limit);
  },

  isIllustrationBlockEmpty(blockEl) {
    if (!blockEl) return true;
    const header = blockEl.querySelector('.sermon-block-header');
    let text = '';
    Array.from(blockEl.children).forEach(child => {
      if (child !== header) {
        text += ' ' + (child.innerText || child.textContent || '');
      }
    });
    text = text.trim();
    if (!text) return true;

    const lower = text.toLowerCase();
    const isPlaceholder = lower.includes("racontez l'histoire") ||
      lower.includes("image concrète ici") ||
      lower === "titre de l'anecdote :" ||
      lower === "titre de l'anecdote : racontez l'histoire ou l'image concrète ici..." ||
      (lower.startsWith("titre de l'anecdote") && lower.length < 35);

    return isPlaceholder;
  },

  attachIllustrationBlockHelpers(blockEl, sectionId) {
    if (!blockEl) return;

    const header = blockEl.querySelector('.sermon-block-header');
    if (!header) return;

    // Règle : aucune suggestion si le bloc contient déjà une illustration rédigée
    if (!this.isIllustrationBlockEmpty(blockEl)) {
      header.querySelector('.ill-suggest-chips')?.remove();
      return;
    }

    const sec = this.sections.find(s => s.id === sectionId) || {};
    const matches = this.findMatchingIllustrations({ sectionTitle: sec.title }, 3);

    let chipsWrap = header.querySelector('.ill-suggest-chips');
    if (!chipsWrap) {
      chipsWrap = document.createElement('div');
      chipsWrap.className = 'ill-suggest-chips';
      chipsWrap.setAttribute('contenteditable', 'false');
      header.appendChild(chipsWrap);
    }

    let chipsHtml = `<span style="opacity: 0.7; font-size: 10px; margin-right: 2px;">Suggestions :</span>`;
    matches.forEach(ill => {
      chipsHtml += `
        <button type="button" class="ill-chip" data-ill-id="${ill.id}" title="${this.escapeHtml(ill.title)}">
          <span style="font-size: 10px;">💡</span>
          <span>${this.escapeHtml(ill.title)}</span>
        </button>
      `;
    });

    chipsHtml += `
      <button type="button" class="ill-chip-more" title="Parcourir tout le réservoir filtré pour cette prédication">
        <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <span>+ d'illustrations</span>
      </button>
    `;

    chipsWrap.innerHTML = chipsHtml;

    const tooltip = document.getElementById('ill-hover-tooltip');

    chipsWrap.querySelectorAll('.ill-chip[data-ill-id]').forEach(btn => {
      const illId = btn.dataset.illId;
      const ill = this.illustrations.find(i => i.id === illId);
      if (!ill) return;

      btn.addEventListener('mouseenter', () => {
        if (!tooltip) return;
        const rect = btn.getBoundingClientRect();
        const snippet = (ill.body || ill.content || '').replace(/<[^>]+>/g, '').replace(/^[#>*\s-]+/gm, '').trim().slice(0, 180) + '...';
        const passageBadge = Array.isArray(ill.passages_associes) ? ill.passages_associes.join(', ') : (ill.passages_associes || '');

        tooltip.innerHTML = `
          <div class="ill-tooltip-header">
            <span class="ill-tooltip-title">${this.escapeHtml(ill.title)}</span>
            <span class="ill-tooltip-badge">${this.escapeHtml(ill.category || 'Illustration')}</span>
          </div>
          ${passageBadge ? `<div style="font-size: 10px; color: var(--accent-blue, #3b82f6); font-weight:600; margin-bottom:4px; display:inline-flex; align-items:center; gap:3px;"><svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg><span>${this.escapeHtml(passageBadge)}</span></div>` : ''}
          <div class="ill-tooltip-snippet">${this.escapeHtml(snippet)}</div>
          <div class="ill-tooltip-footer">
            <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 10 4 15 9 20"/><path d="M20 4v7a4 4 0 0 1-4 4H4"/></svg>
            <span>Cliquer pour insérer dans ce bloc</span>
          </div>
        `;

        tooltip.classList.remove('hidden');
        const tooltipWidth = tooltip.offsetWidth || 280;
        let left = rect.left + (rect.width / 2) - (tooltipWidth / 2);
        let top = rect.top - tooltip.offsetHeight - 8;
        if (top < 10) top = rect.bottom + 8;
        if (left < 10) left = 10;
        if (left + tooltipWidth > window.innerWidth - 10) left = window.innerWidth - tooltipWidth - 10;

        tooltip.style.left = `${Math.round(left)}px`;
        tooltip.style.top = `${Math.round(top)}px`;
      });

      btn.addEventListener('mouseleave', () => {
        tooltip?.classList.add('hidden');
      });

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        tooltip?.classList.add('hidden');
        this.insertIllustrationIntoBlock(blockEl, ill);
      });
    });

    chipsWrap.querySelector('.ill-chip-more')?.addEventListener('click', (e) => {
      e.stopPropagation();
      tooltip?.classList.add('hidden');
      this.openIllustrationPickerModal(blockEl, sec);
    });
  },

  insertIllustrationIntoBlock(blockEl, ill) {
    if (!blockEl || !ill) return;

    const header = blockEl.querySelector('.sermon-block-header');
    const cleanBody = (ill.body || ill.content || '').replace(/^[#>*\s-]+/gm, '').trim();
    const sourceText = ill.author ? (ill.author + (ill.source ? ` (${ill.source})` : '')) : (ill.source || '');

    // Retirer les pastilles de suggestion dès qu'une illustration est insérée
    header.querySelector('.ill-suggest-chips')?.remove();

    let newContent = `<p><strong>${this.escapeHtml(ill.title)} :</strong> ${this.escapeHtml(cleanBody)}</p>`;
    if (sourceText) {
      newContent += `<p style="font-size: 12px; opacity: 0.75; font-style: italic; margin-top: 4px;">— Source : ${this.escapeHtml(sourceText)}</p>`;
    }

    Array.from(blockEl.children).forEach(child => {
      if (child !== header) child.remove();
    });

    const tempWrap = document.createElement('div');
    tempWrap.innerHTML = newContent;
    while (tempWrap.firstChild) {
      blockEl.appendChild(tempWrap.firstChild);
    }

    const editor = blockEl.closest('.sermon-section-editor');
    if (editor) {
      editor.dispatchEvent(new Event('input', { bubbles: true }));
    }
    this.debouncedAutoSave();
  },

  initIllustrationPickerModal() {
    const modal = document.getElementById('sermon-illustration-picker-modal');
    const closeBtn = document.getElementById('btn-close-ill-picker-modal');
    const searchInput = document.getElementById('ill-picker-search-input');
    const clearBtn = document.getElementById('btn-clear-ill-picker-search');

    closeBtn?.addEventListener('click', () => this.closeIllustrationPickerModal());

    modal?.addEventListener('click', (e) => {
      if (e.target === modal) this.closeIllustrationPickerModal();
    });

    searchInput?.addEventListener('input', () => {
      const q = searchInput.value.trim();
      clearBtn?.classList.toggle('hidden', !q);
      this.renderIllustrationPickerList(q, this.activeIllPickerFilter);
    });

    clearBtn?.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      clearBtn.classList.add('hidden');
      this.renderIllustrationPickerList('', this.activeIllPickerFilter);
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
        this.closeIllustrationPickerModal();
      }
    });
  },

  openIllustrationPickerModal(blockEl, sec = null) {
    this.currentTargetIllustrationBlock = blockEl;
    const modal = document.getElementById('sermon-illustration-picker-modal');
    if (!modal) return;

    const sermonPassage = this.currentSermon?.passage?.reference || '';
    const contextLabel = document.getElementById('lbl-ill-picker-context');
    if (contextLabel) {
      contextLabel.textContent = sermonPassage ? `Filtré selon le passage ${sermonPassage} et le thème du sermon` : `Recherche dans le réservoir de ${this.illustrations.length} fiches`;
    }

    const filtersRow = document.getElementById('ill-picker-quick-filters');
    if (filtersRow) {
      const categories = ['all', 'Foi & Confiance', 'Grâce & Pardon', 'Combat spirituel', 'Discipulat', 'Prière', 'Évangélisation'];
      filtersRow.innerHTML = `
        <button class="ill-category-pill active" data-filter="context">⭐ Liées au texte (${sermonPassage || 'Prédication'})</button>
        <button class="ill-category-pill" data-filter="all">Toutes (${this.illustrations.length})</button>
        ${categories.slice(1).map(c => `<button class="ill-category-pill" data-filter="${c}">${c}</button>`).join('')}
      `;

      filtersRow.querySelectorAll('.ill-category-pill').forEach(btn => {
        btn.addEventListener('click', () => {
          filtersRow.querySelectorAll('.ill-category-pill').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.activeIllPickerFilter = btn.dataset.filter || 'all';
          const q = document.getElementById('ill-picker-search-input')?.value || '';
          this.renderIllustrationPickerList(q, this.activeIllPickerFilter);
        });
      });
    }

    this.activeIllPickerFilter = 'context';
    const searchInput = document.getElementById('ill-picker-search-input');
    if (searchInput) searchInput.value = '';
    document.getElementById('btn-clear-ill-picker-search')?.classList.add('hidden');

    this.renderIllustrationPickerList('', 'context');
    modal.classList.remove('hidden');
    setTimeout(() => searchInput?.focus(), 50);
  },

  closeIllustrationPickerModal() {
    document.getElementById('sermon-illustration-picker-modal')?.classList.add('hidden');
    this.currentTargetIllustrationBlock = null;
  },

  renderIllustrationPickerList(query = '', filter = 'context') {
    const container = document.getElementById('ill-picker-list-container');
    const countEl = document.getElementById('lbl-ill-picker-count');
    if (!container) return;

    let items = [];
    if (filter === 'context') {
      items = this.findMatchingIllustrations({ query }, 30);
    } else if (filter === 'all') {
      const q = query.toLowerCase().trim();
      items = this.illustrations.filter(ill => {
        if (!q) return true;
        return (ill.title || '').toLowerCase().includes(q) ||
          (ill.body || ill.content || '').toLowerCase().includes(q) ||
          (ill.category || '').toLowerCase().includes(q) ||
          (Array.isArray(ill.tags) ? ill.tags.join(' ') : '').toLowerCase().includes(q) ||
          (Array.isArray(ill.passages_associes) ? ill.passages_associes.join(' ') : '').toLowerCase().includes(q);
      });
    } else {
      const q = query.toLowerCase().trim();
      items = this.illustrations.filter(ill => {
        const cat = (ill.category || '').toLowerCase();
        if (!cat.includes(filter.toLowerCase())) return false;
        if (!q) return true;
        return (ill.title || '').toLowerCase().includes(q) ||
          (ill.body || ill.content || '').toLowerCase().includes(q) ||
          (Array.isArray(ill.tags) ? ill.tags.join(' ') : '').toLowerCase().includes(q);
      });
    }

    if (countEl) {
      countEl.textContent = `${items.length} ${items.length > 1 ? 'fiches' : 'fiche'}`;
    }

    if (items.length === 0) {
      container.innerHTML = `
        <div style="padding: 40px 20px; text-align: center; color: var(--text-muted);">
          <div style="font-size: 14px; font-weight: 600; color: var(--text-primary); margin-bottom: 4px;">Aucune illustration trouvée</div>
          <div style="font-size: 12px;">Essayez d'autres mots-clés ou cliquez sur « Toutes » pour voir l'ensemble du réservoir.</div>
        </div>
      `;
      return;
    }

    container.innerHTML = items.map(ill => {
      const snippet = (ill.body || ill.content || '').replace(/<[^>]+>/g, '').replace(/^[#>*\s-]+/gm, '').trim().slice(0, 220) + '...';
      const passageBadge = Array.isArray(ill.passages_associes) ? ill.passages_associes.join(', ') : (ill.passages_associes || '');

      return `
        <div class="ill-picker-item" data-ill-id="${ill.id}">
          <div class="ill-picker-item-header">
            <span class="ill-picker-item-title">${this.escapeHtml(ill.title)}</span>
            <div class="ill-picker-item-badges">
              <span class="ill-tooltip-badge">${this.escapeHtml(ill.category || 'Illustration')}</span>
              ${passageBadge ? `<span class="ill-tooltip-badge" style="background:rgba(59,130,246,0.15); color:var(--accent-blue,#3b82f6); display:inline-flex; align-items:center; gap:3px;"><svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg><span>${this.escapeHtml(passageBadge)}</span></span>` : ''}
              ${ill.author ? `<span style="font-size:10.5px; opacity:0.7; font-style:italic;">— ${this.escapeHtml(ill.author)}</span>` : ''}
            </div>
          </div>
          <div class="ill-picker-item-snippet">${this.escapeHtml(snippet)}</div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.ill-picker-item').forEach(itemEl => {
      itemEl.addEventListener('click', () => {
        const illId = itemEl.dataset.illId;
        const ill = this.illustrations.find(i => i.id === illId);
        if (ill && this.currentTargetIllustrationBlock) {
          this.insertIllustrationIntoBlock(this.currentTargetIllustrationBlock, ill);
          this.closeIllustrationPickerModal();
        }
      });
    });
  },

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
};

window.SermonsView = SermonsView;
