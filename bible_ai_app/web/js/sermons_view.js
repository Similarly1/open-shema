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

    this.bindEvents();
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

    // 4. Tiroir de ressources
    document.getElementById('btn-sermon-toggle-drawer')?.addEventListener('click', () => this.toggleResourcesDrawer());
    document.getElementById('btn-close-resources-drawer')?.addEventListener('click', () => this.toggleResourcesDrawer(false));

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

    // 6. Insertion rapide de blocs homilétiques
    document.getElementById('btn-insert-point')?.addEventListener('click', () => this.addSection('point'));
    document.getElementById('btn-insert-subpoint')?.addEventListener('click', () => this.insertBlock('subpoint'));
    document.getElementById('btn-insert-scripture')?.addEventListener('click', () => this.insertBlock('scripture'));
    document.getElementById('btn-insert-exegesis')?.addEventListener('click', () => this.insertBlock('exegesis'));
    document.getElementById('btn-insert-illustration')?.addEventListener('click', () => this.insertBlock('illustration'));
    document.getElementById('btn-insert-application')?.addEventListener('click', () => this.insertBlock('application'));
    document.getElementById('btn-insert-cue')?.addEventListener('click', () => this.insertBlock('cue'));
    document.getElementById('btn-insert-slide')?.addEventListener('click', () => this.insertBlock('slide'));

    // Outils formatage texte
    document.getElementById('btn-sermon-bold')?.addEventListener('click', () => document.execCommand('bold'));
    document.getElementById('btn-sermon-italic')?.addEventListener('click', () => document.execCommand('italic'));
    document.getElementById('btn-sermon-list')?.addEventListener('click', () => document.execCommand('insertUnorderedList'));
    document.getElementById('btn-sermon-quote')?.addEventListener('click', () => document.execCommand('formatBlock', false, 'blockquote'));

    // 7. Actions Sommaire & Ajout de sections
    document.getElementById('btn-sermon-collapse-all')?.addEventListener('click', () => this.collapseAllSections());
    document.getElementById('btn-sermon-expand-all')?.addEventListener('click', () => this.expandAllSections());
    document.getElementById('btn-outline-add-point')?.addEventListener('click', () => this.addSection('point'));
    document.getElementById('btn-add-section-point')?.addEventListener('click', () => this.addSection('point'));
    document.getElementById('btn-add-section-scripture')?.addEventListener('click', () => this.addSection('scripture'));
    document.getElementById('btn-add-section-conclusion')?.addEventListener('click', () => this.addSection('conclusion'));

    // 8. Titre du sermon
    this.titleInput?.addEventListener('input', () => {
      if (this.currentSermon) this.currentSermon.title = this.titleInput.value.trim();
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

  async onViewActivated() {
    await this.loadSermons();
    await this.loadIllustrations();
    this.renderHubCards();
  },

  openHub() {
    if (typeof App !== 'undefined') {
      App.switchView('sermons');
    }
    this.renderHubCards();
  },

  async openEditor(sermon = null) {
    if (!sermon) {
      if (this.currentSermon) {
        sermon = this.currentSermon;
      } else if (this.sermons.length > 0) {
        sermon = await API.getSermon(this.sermons[0].id) || this.sermons[0];
      } else {
        await this.createNewSermon();
        return;
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
    if (this.titleInput) this.titleInput.value = sermon.title || '';
    this.updateHeaderSummary(sermon);

    // Découpage du corps Markdown en sections modulaires
    this.parseMarkdownIntoSections(sermon.body || '');
    this.renderSections();
    this.renderOutline();
    this.updateMetrics();
    this.renderDrawerContent();
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
    const todayStr = new Date().toISOString().split('T')[0];
    const newSermon = {
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

    const res = await API.saveSermon(newSermon);
    if (res && res.success) {
      await this.loadSermons();
      await this.openEditor(newSermon);
      if (this.titleInput) {
        this.titleInput.focus();
        this.titleInput.select();
      }
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast("Nouvelle prédication créée !");
      }
    }
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

  async saveCurrentSermon() {
    if (!this.currentSermon) return;

    const bodyMarkdown = this.serializeSectionsToMarkdown();
    
    const payload = {
      ...this.currentSermon,
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

    try {
      const res = await API.saveSermon(payload);
      if (res && res.success) {
        this.currentSermon = res.sermon || payload;
        this.updateHeaderSummary(this.currentSermon);
        if (typeof App !== 'undefined' && App.showToast) {
          App.showToast("Prédication enregistrée !");
        }
      }
    } catch (e) {
      console.error('Erreur sauvegarde sermon:', e);
    }
  },

  debouncedAutoSave() {
    if (this.saveDebounceTimer) clearTimeout(this.saveDebounceTimer);
    this.saveDebounceTimer = setTimeout(() => {
      this.saveCurrentSermon();
    }, 1200);
  },

  populateEditor(sermon) {
    if (this.titleInput) this.titleInput.value = sermon.title || '';
    this.updateHeaderSummary(sermon);

    // Découpage du corps Markdown en sections modulaires
    this.parseMarkdownIntoSections(sermon.body || '');
    this.renderSections();
    this.renderOutline();
    this.updateMetrics();
    this.renderDrawerContent();
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
    const todayStr = new Date().toISOString().split('T')[0];
    const newSermon = {
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

## I. Premier Point

Explication du texte...

## II. Deuxième Point

Développement et vérité théologique...

## Conclusion & Appel

Synthèse et application concrète...`
    };

    const res = await API.saveSermon(newSermon);
    if (res && res.success) {
      await this.loadSermons();
      await this.selectSermon(newSermon.id);
      if (this.titleInput) {
        this.titleInput.focus();
        this.titleInput.select();
      }
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast("Nouvelle prédication créée !");
      }
    }
  },

  async importSermon() {
    try {
      const res = await API.importSermon();
      if (res && res.cancelled) return;
      if (res && res.success && res.sermon) {
        await this.loadSermons();
        await this.selectSermon(res.sermon.id);
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

  async saveCurrentSermon() {
    if (!this.currentSermon) return;

    const bodyMarkdown = this.serializeSectionsToMarkdown();
    
    const payload = {
      ...this.currentSermon,
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

    try {
      const res = await API.saveSermon(payload);
      if (res && res.success) {
        this.currentSermon = res.sermon || payload;
        this.updateHeaderSummary(this.currentSermon);
        if (typeof App !== 'undefined' && App.showToast) {
          App.showToast("Prédication enregistrée !");
        }
      }
    } catch (e) {
      console.error('Erreur sauvegarde sermon:', e);
    }
  },

  debouncedAutoSave() {
    if (this.saveDebounceTimer) clearTimeout(this.saveDebounceTimer);
    this.saveDebounceTimer = setTimeout(() => {
      this.saveCurrentSermon();
    }, 1200);
  },

  async deleteCurrentSermon() {
    if (!this.currentSermon) return;
    const targetTitle = this.currentSermon.title || 'cette prédication';
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
      const res = await API.deleteSermon(this.currentSermon.id);
      if (res && res.success) {
        this.currentSermon = null;
        await this.loadSermons();
        if (typeof App !== 'undefined' && App.showToast) {
          App.showToast("Prédication supprimée.");
        }
      }
    } catch (e) {
      console.error('Erreur suppression sermon:', e);
    }
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
      editor?.addEventListener('focus', () => {
        this.activeSectionId = sec.id;
        this.highlightOutlineItem(sec.id);
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
        this.debouncedAutoSave();
        this.handleSlashInput(e);
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
    if (card) {
      const sec = this.sections.find(s => s.id === secId);
      if (sec && sec.isCollapsed) {
        this.toggleSectionCollapse(secId, false);
      }
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      card.querySelector('.sermon-section-editor')?.focus();
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
  },

  collapseAllSections() {
    this.sections.forEach(s => s.isCollapsed = true);
    document.querySelectorAll('.sermon-section-card').forEach(c => c.classList.add('collapsed'));
  },

  expandAllSections() {
    this.sections.forEach(s => s.isCollapsed = false);
    document.querySelectorAll('.sermon-section-card').forEach(c => c.classList.remove('collapsed'));
  },

  addSection(type = 'point', title = '', content = '') {
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

  deleteSection(secId) {
    if (this.sections.length <= 1) {
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast("Le sermon doit contenir au moins une section.", "warn");
      }
      return;
    }

    const sec = this.sections.find(s => s.id === secId);
    if (!sec) return;

    if (!confirm(`Supprimer la section "${sec.title || 'cette partie'}" ?`)) {
      return;
    }

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
    let htmlToInsert = '';

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
        htmlToInsert = `
          <div class="sermon-callout-block sermon-block-illustration" data-type="illustration">
            <div class="sermon-block-header">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1.3.5 2.6 1.5 3.5.8.8 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>
              <span>Illustration / Récit</span>
            </div>
            <p><strong>Titre de l'anecdote :</strong> Racontez l'histoire ou l'image concrète ici...</p>
          </div><p></p>
        `;
        break;
      case 'application':
        htmlToInsert = `
          <div class="sermon-callout-block sermon-block-application" data-type="application">
            <div class="sermon-block-header">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
              <span>Application pratique</span>
            </div>
            <p><strong>Question pour l'auditeur :</strong> Comment appliquer cette vérité dès cette semaine ?</p>
          </div><p></p>
        `;
        break;
      case 'cue':
        htmlToInsert = `
          <div class="sermon-callout-block sermon-block-cue" data-type="cue">
            <div class="sermon-block-header">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <span>Régie / Timing</span>
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
    }
  },

  // =========================================================================
  // PARSING & CONVERSION MARKDOWN <-> ÉDITEUR HTML
  // =========================================================================

  markdownToEditorHtml(md) {
    if (!md) return '';
    let html = md;

    // Repères de diapositives [_]
    html = html.replace(/\[\s*_\s*\]/g, '<span class="sermon-slide-badge" contenteditable="false"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg> DIAPO</span>&nbsp;');

    // Callouts [!scripture]
    html = html.replace(/>\s*\[!scripture(?:\|ref=([^|\]]+))?(?:\|version=([^\]]+))?\]\s*\n((?:>.*?\n?)*)/gi, (match, ref, ver, content) => {
      const cleanContent = content.replace(/^>\s?/gm, '').trim();
      const label = ref ? `Écriture (${ref}${ver ? ' - ' + ver : ''})` : 'Écriture';
      return `
        <div class="sermon-callout-block sermon-block-scripture" data-type="scripture">
          <div class="sermon-block-header">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
            <span>${label}</span>
          </div>
          <p>${cleanContent.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>
        </div>
      `;
    });

    // Callouts [!exegesis]
    html = html.replace(/>\s*\[!exegesis(?:\|key=([^\]]+))?\]\s*\n((?:>.*?\n?)*)/gi, (match, key, content) => {
      const cleanContent = content.replace(/^>\s?/gm, '').trim();
      return `
        <div class="sermon-callout-block sermon-block-exegesis" data-type="exegesis">
          <div class="sermon-block-header">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="m8.5 13.5 2-5.5 2 5.5"/><path d="M9.2 11.8h2.6"/><path d="M14 8.5h3.5l-3.5 5h3.5"/></svg>
            <span>Exégèse ${key ? '(' + key + ')' : ''}</span>
          </div>
          <p>${cleanContent.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>
        </div>
      `;
    });

    // Callouts [!illustration]
    html = html.replace(/>\s*\[!illustration(?:\|id=([^\]]+))?\]\s*\n((?:>.*?\n?)*)/gi, (match, id, content) => {
      const cleanContent = content.replace(/^>\s?/gm, '').trim();
      return `
        <div class="sermon-callout-block sermon-block-illustration" data-type="illustration" data-id="${id || ''}">
          <div class="sermon-block-header">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1.3.5 2.6 1.5 3.5.8.8 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>
            <span>Illustration</span>
          </div>
          <p>${cleanContent.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>
        </div>
      `;
    });

    // Callouts [!application]
    html = html.replace(/>\s*\[!application\]\s*\n((?:>.*?\n?)*)/gi, (match, content) => {
      const cleanContent = content.replace(/^>\s?/gm, '').trim();
      return `
        <div class="sermon-callout-block sermon-block-application" data-type="application">
          <div class="sermon-block-header">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
            <span>Application</span>
          </div>
          <p>${cleanContent.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>
        </div>
      `;
    });

    // Callouts [!cue]
    html = html.replace(/>\s*\[!cue\]\s*\n((?:>.*?\n?)*)/gi, (match, content) => {
      const cleanContent = content.replace(/^>\s?/gm, '').trim();
      return `
        <div class="sermon-callout-block sermon-block-cue" data-type="cue">
          <div class="sermon-block-header">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <span>Régie / Timing</span>
          </div>
          <p>${cleanContent.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>
        </div>
      `;
    });

    // Titres Markdown résiduels
    html = html.replace(/^### (.*?)$/gm, '<h3>$1</h3>');
    html = html.replace(/^---$/gm, '<hr>');

    // Gras & Italique simples
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // Paragraphes simples
    const lines = html.split('\n');
    let inP = false;
    let out = [];

    for (let l of lines) {
      if (l.startsWith('<h') || l.startsWith('<div') || l.startsWith('</div') || l.startsWith('<hr')) {
        if (inP) { out.push('</p>'); inP = false; }
        out.push(l);
      } else if (l.trim() === '') {
        if (inP) { out.push('</p>'); inP = false; }
      } else {
        if (!inP) { out.push('<p>' + l); inP = true; }
        else { out.push('<br>' + l); }
      }
    }
    if (inP) out.push('</p>');

    return out.join('\n');
  },

  editorHtmlToMarkdown(html) {
    if (!html) return '';
    let temp = document.createElement('div');
    temp.innerHTML = html;

    // Remplacement des badges de diapositive
    temp.querySelectorAll('.sermon-slide-badge').forEach(b => {
      let mdNode = document.createTextNode(' [_] ');
      b.parentNode.replaceChild(mdNode, b);
    });

    // Remplacement des callouts par leur syntaxe Markdown
    temp.querySelectorAll('.sermon-callout-block').forEach(b => {
      const type = b.dataset.type || 'cue';
      const id = b.dataset.id;
      const header = b.querySelector('.sermon-block-header');
      if (header) header.remove();
      
      let text = b.innerText.trim();
      let calloutTag = `> [!${type}${id ? '|id=' + id : ''}]`;
      let calloutBody = text.split('\n').map(line => `> ${line}`).join('\n');
      
      let mdNode = document.createTextNode(`\n\n${calloutTag}\n${calloutBody}\n\n`);
      b.parentNode.replaceChild(mdNode, b);
    });

    let raw = temp.innerHTML;
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

    temp.innerHTML = raw;
    let cleanText = temp.innerText || temp.textContent || '';
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

  toggleResourcesDrawer(forceState) {
    if (!this.resourcesDrawer) return;
    const willOpen = typeof forceState === 'boolean' ? forceState : this.resourcesDrawer.classList.contains('collapsed');

    if (typeof forceState === 'boolean') {
      this.resourcesDrawer.classList.toggle('collapsed', !forceState);
    } else {
      this.resourcesDrawer.classList.toggle('collapsed');
    }

    // Dès que le volet droit s'ouvre, fermer automatiquement le volet gauche des prédications
    if (willOpen) {
      this.toggleSidebar(false);
    }

    const toggleBtn = document.getElementById('btn-sermon-toggle-drawer');
    if (toggleBtn) {
      toggleBtn.classList.toggle('active', willOpen);
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
        <div style="padding: 8px 4px; display: flex; flex-direction: column; gap: 10px;">
          <div style="font-size: 12px; font-weight: 700; color: var(--text-primary);">Structures & Plans Homilétiques</div>
          <button class="btn-secondary" id="btn-ai-bridge-plan" style="text-align: left; padding: 8px 10px; font-size: 11.5px; display: flex; align-items: center; gap: 8px;">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" style="color: #3b82f6;"><path d="M4 19V9a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10"/><path d="M4 15h16"/><path d="M10 7v12"/><path d="M14 7v12"/></svg>
            <span>Insérer la structure du Pont (John Stott)</span>
          </button>
          <button class="btn-secondary" id="btn-ai-synthetique-plan" style="text-align: left; padding: 8px 10px; font-size: 11.5px; display: flex; align-items: center; gap: 8px;">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/></svg>
            <span>Insérer un Plan Synthétique (Alfred Kuen)</span>
          </button>
          <button class="btn-secondary" id="btn-ai-helm-grid" style="text-align: left; padding: 8px 10px; font-size: 11.5px; display: flex; align-items: center; gap: 8px;">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
            <span>Insérer la Grille d'Application (David Helm)</span>
          </button>
        </div>
      `;

      document.getElementById('btn-ai-bridge-plan')?.addEventListener('click', () => this.insertHomileticOutline('inductif'));
      document.getElementById('btn-ai-synthetique-plan')?.addEventListener('click', () => this.insertHomileticOutline('synthetique'));
      document.getElementById('btn-ai-helm-grid')?.addEventListener('click', () => this.insertHomileticOutline('application-grille'));
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

    if (type === 'synthetique') {
      this.sections = [
        { id: `sec_${Date.now()}_1`, type: 'intro', title: 'Introduction', contentHtml: '<p><strong>Accroche :</strong> Captez l\'attention dès les premières secondes...<br><strong>Tension :</strong> Quel combat existentiel ce texte éclaire-t-il ?<br><strong>Vérité Maîtresse :</strong> La proposition centrale du sermon en 1 phrase.</p>', isCollapsed: false, wordCount: 0, estMinutes: 0 },
        { id: `sec_${Date.now()}_2`, type: 'scripture', title: `Lecture du Passage (${passage})`, contentHtml: '<p>« Insérez les versets ici... »</p>', isCollapsed: false, wordCount: 0, estMinutes: 0 },
        { id: `sec_${Date.now()}_3`, type: 'point', title: 'I. Premier Axe : La Révélation du Texte', contentHtml: '<p>Explication du passage et des mots-clés originaux...</p>', isCollapsed: false, wordCount: 0, estMinutes: 0 },
        { id: `sec_${Date.now()}_4`, type: 'point', title: 'II. Deuxième Axe : L\'Exigence et le Diagnostic', contentHtml: '<p>Développement spirituel et résonance pour notre condition...</p>', isCollapsed: false, wordCount: 0, estMinutes: 0 },
        { id: `sec_${Date.now()}_5`, type: 'point', title: 'III. Troisième Axe : L\'Accomplissement en Christ', contentHtml: '<p>Comment la grâce de Jésus-Christ répond à ce que la Loi révèle...</p>', isCollapsed: false, wordCount: 0, estMinutes: 0 },
        { id: `sec_${Date.now()}_6`, type: 'conclusion', title: 'Conclusion & Appel', contentHtml: '<p><strong>Synthèse :</strong> Récapitulatif clair.<br><strong>Défi pratique :</strong> Comment appliquer cette vérité dès cette semaine ?</p>', isCollapsed: false, wordCount: 0, estMinutes: 0 }
      ];
    } else if (type === 'inductif') {
      this.sections = [
        { id: `sec_${Date.now()}_1`, type: 'intro', title: '1. La Tension Contemporaine (Rive 2)', contentHtml: '<p>Le dilemme humain, la soif ou l\'épreuve universelle vécue aujourd\'hui...</p>', isCollapsed: false, wordCount: 0, estMinutes: 0 },
        { id: `sec_${Date.now()}_2`, type: 'scripture', title: `2. L\'Écoute de la Parole (${passage})`, contentHtml: '<p>Ce que Dieu déclare dans son texte pour bousculer nos schémas...</p>', isCollapsed: false, wordCount: 0, estMinutes: 0 },
        { id: `sec_${Date.now()}_3`, type: 'point', title: '3. La Résolution par la Grâce (Le Pont en Christ)', contentHtml: '<p>Comment la personne et l\'œuvre du Christ bâtissent le pont de la rédemption...</p>', isCollapsed: false, wordCount: 0, estMinutes: 0 },
        { id: `sec_${Date.now()}_4`, type: 'conclusion', title: '4. La Marche par la Foi (L\'Application)', contentHtml: '<p>Décision personnelle, repentance et impact concret dans nos relations quotidiennes...</p>', isCollapsed: false, wordCount: 0, estMinutes: 0 }
      ];
    } else if (type === 'application-grille') {
      this.addSection('conclusion', 'Grille d\'Applications Différenciées (David Helm)', `
        <p><strong>1. Sceptiques & Non-croyants :</strong> Quelle vérité de l\'Évangile interpelle leurs présupposés ?</p>
        <p><strong>2. Croyants éprouvés & souffrants :</strong> Quelle promesse et consolation solide ce texte offre-t-il ?</p>
        <p><strong>3. Croyants établis (danger de tiédeur) :</strong> Quel avertissement ou appel à la sainteté est proclamé ?</p>
        <p><strong>4. Vie publique & familiale :</strong> Quelle répercussion éthique (foyer, travail, société) en découle ?</p>
      `);
      return;
    }

    this.renderSections();
    this.renderOutline();
    this.updateMetrics();
    this.debouncedAutoSave();
    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast("Structure homilétique appliquée en blocs !");
    }
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
  // GESTION DE L'HISTORIQUE (UNDO / REDO)
  // =========================================================================

  resetHistory() {
    this.history = [];
    this.historyIndex = -1;
    this.pushHistoryState();
  },

  pushHistoryState() {
    const state = {
      title: this.titleInput?.value || '',
      sections: JSON.parse(JSON.stringify(this.sections))
    };

    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }

    this.history.push(state);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
    this.historyIndex = this.history.length - 1;
  },

  undo() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      this.restoreHistoryState(this.history[this.historyIndex]);
    }
  },

  redo() {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      this.restoreHistoryState(this.history[this.historyIndex]);
    }
  },

  restoreHistoryState(state) {
    if (!state) return;
    if (this.titleInput) this.titleInput.value = state.title;
    this.sections = JSON.parse(JSON.stringify(state.sections || []));
    this.renderSections();
    this.renderOutline();
    this.updateMetrics();
  },

  // =========================================================================
  // GESTION DU MENU SLASH MODAL
  // =========================================================================

  isSlashMenuOpen: false,
  slashMenuEl: null,
  slashSelectedIndex: 0,
  slashCurrentItems: [],
  slashAnchorRange: null,

  getSlashCommandsDefinitions() {
    return [
      {
        category: "Texte",
        items: [
          { id: "text", label: "Texte normal", iconText: "Aa", desc: "Paragraphe standard", action: "text" },
          { id: "h1", label: "Titre", iconText: "Aa", desc: "Titre principal H1", action: "h1" },
          { id: "h2", label: "Sous-titre", iconText: "Aa", desc: "Sous-titre H2", action: "h2" },
          { id: "h3", label: "En-tête H3", iconText: "Aa", desc: "Sous-section H3", action: "h3" }
        ]
      },
      {
        category: "Prédication",
        items: [
          { id: "scripture", label: "Verset biblique", iconSvg: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`, desc: "Citation de l'Écriture", action: "scripture" },
          { id: "exegesis", label: "Exégèse & Langues", iconSvg: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="m8.5 13.5 2-5.5 2 5.5"/><path d="M9.2 11.8h2.6"/><path d="M14 8.5h3.5l-3.5 5h3.5"/></svg>`, desc: "Termes originaux hébreu / grec", action: "exegesis" },
          { id: "illustration", label: "Illustration", iconSvg: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1.3.5 2.6 1.5 3.5.8.8 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>`, desc: "Histoire, métaphore ou parabole", action: "illustration" },
          { id: "application", label: "Application pratique", iconSvg: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>`, desc: "Appel concret à l'action", action: "application" },
          { id: "cue", label: "Note régie / Timing", iconSvg: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`, desc: "Indication technique régie", action: "cue" },
          { id: "slide", label: "Repère diapositive [_]", iconSvg: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`, desc: "Changement de slide projection", action: "slide" }
        ]
      },
      {
        category: "Listes & Autres",
        items: [
          { id: "bullet", label: "Liste à puces", iconSvg: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>`, desc: "Liste standard", action: "bullet" },
          { id: "quote", label: "Citation", iconSvg: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.75-2-2-2H4c-1.25 0-2 .75-2 2v6c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/></svg>`, desc: "Citation en retrait", action: "quote" }
        ]
      }
    ];
  },

  handleSlashInput(e) {
    const sel = window.getSelection();
    if (!sel.rangeCount) {
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

    this.slashAnchorRange = window.getSelection().getRangeAt(0).cloneRange();
    this.renderSlashMenuItems(query);

    if (rect) {
      this.slashMenuEl.style.left = `${Math.min(window.innerWidth - 300, Math.max(10, rect.left))}px`;
      this.slashMenuEl.style.top = `${rect.bottom + window.scrollY + 6}px`;
    }

    this.slashMenuEl.classList.remove('hidden');
    this.isSlashMenuOpen = true;
  },

  closeSlashMenu() {
    if (this.slashMenuEl) {
      this.slashMenuEl.classList.add('hidden');
    }
    this.isSlashMenuOpen = false;
  },

  createSlashMenuEl() {
    const el = document.createElement('div');
    el.id = 'sermon-slash-menu';
    el.className = 'sermon-slash-dropdown hidden';
    document.body.appendChild(el);
    this.slashMenuEl = el;

    document.addEventListener('click', (e) => {
      if (!this.slashMenuEl.contains(e.target) && !e.target.closest('.sermon-section-editor')) {
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
        !q || item.label.toLowerCase().includes(q) || item.desc.toLowerCase().includes(q)
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
      itemEl.addEventListener('click', () => {
        const action = itemEl.dataset.action;
        this.executeSlashCommand(action);
      });
    });
  },

  handleSlashKeyDown(e) {
    if (!this.isSlashMenuOpen) return false;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.slashSelectedIndex = (this.slashSelectedIndex + 1) % this.slashCurrentItems.length;
      this.updateSlashSelection();
      return true;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.slashSelectedIndex = (this.slashSelectedIndex - 1 + this.slashCurrentItems.length) % this.slashCurrentItems.length;
      this.updateSlashSelection();
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
      item.classList.toggle('active', idx === this.slashSelectedIndex);
    });
  },

  executeSlashCommand(action) {
    this.closeSlashMenu();

    if (this.slashAnchorRange) {
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
    }

    this.insertBlock(action);
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
