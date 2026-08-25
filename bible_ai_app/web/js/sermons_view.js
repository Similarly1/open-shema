/**
 * Sermons View Controller — Studio de Prédication
 * 
 * Module de gestion et d'édition modulaire de sermons par blocs :
 * - Zéro émoji : icônes vectorielles SVG uniquement.
 * - Stockage Markdown (.md) et Frontmatter YAML standard.
 * - Volet droit de ressources connecté (Exégèse, Commentaires, Réservoir d'illustrations avec historique anti-redite).
 * - Calcul dynamique du temps de parole par section (mots/minute) et équilibre homilétique.
 * - Mode Pupitre / Prompteur plein écran avec chronomètre et validation de points.
 */

const SermonsView = {
  sermons: [],
  illustrations: [],
  currentSermon: null,
  currentFilter: 'all',
  activeDrawerTab: 'exegesis',
  
  // Undo / Redo
  history: [],
  historyIndex: -1,
  maxHistory: 60,
  historyDebounceTimer: null,
  
  // Mode Pupitre
  pulpitChronoSeconds: 0,
  pulpitChronoTimer: null,
  pulpitIsPlaying: false,
  pulpitFontSize: 24,
  wakeLockSentinel: null,

  // Éléments du DOM
  listContainer: null,
  searchInput: null,
  titleInput: null,
  churchInput: null,
  refInput: null,
  dateInput: null,
  seriesInput: null,
  bigIdeaInput: null,
  goalInput: null,
  contentEditor: null,
  previewContainer: null,
  resourcesDrawer: null,
  drawerContent: null,

  // Métriques
  lblEstTime: null,
  lblWordCount: null,
  barExegesis: null,
  barIllustration: null,
  barApplication: null,

  init() {
    this.listContainer = document.getElementById('sermons-list-items');
    this.searchInput = document.getElementById('sermons-search-input');
    this.titleInput = document.getElementById('sermon-edit-title');
    this.churchInput = document.getElementById('sermon-edit-church');
    this.refInput = document.getElementById('sermon-edit-ref');
    this.dateInput = document.getElementById('sermon-edit-date');
    this.seriesInput = document.getElementById('sermon-edit-series');
    this.bigIdeaInput = document.getElementById('sermon-edit-bigidea');
    this.goalInput = document.getElementById('sermon-edit-goal');
    this.contentEditor = document.getElementById('sermon-edit-content');
    this.previewContainer = document.getElementById('sermon-preview-content');
    this.resourcesDrawer = document.getElementById('sermons-resources-drawer');
    this.drawerContent = document.getElementById('sermons-drawer-content');

    this.lblEstTime = document.getElementById('lbl-sermon-est-time');
    this.lblWordCount = document.getElementById('lbl-sermon-word-count');
    this.barExegesis = document.getElementById('bar-seg-exegesis');
    this.barIllustration = document.getElementById('bar-seg-illustration');
    this.barApplication = document.getElementById('bar-seg-application');

    this.bindEvents();
  },

  bindEvents() {
    // 1. Boutons principaux de gestion
    document.getElementById('btn-new-sermon')?.addEventListener('click', () => this.createNewSermon());
    document.getElementById('btn-import-sermon')?.addEventListener('click', () => this.importSermon());
    document.getElementById('btn-save-current-sermon')?.addEventListener('click', () => this.saveCurrentSermon());
    document.getElementById('btn-delete-current-sermon')?.addEventListener('click', () => this.deleteCurrentSermon());
    document.getElementById('btn-open-sermons-folder')?.addEventListener('click', () => this.openSermonsFolder());

    // 2. Recherche & Filtres
    this.searchInput?.addEventListener('input', () => this.renderList());
    document.querySelectorAll('.sermon-filter-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.sermon-filter-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.currentFilter = pill.dataset.filter || 'all';
        this.renderList();
      });
    });

    // 3. Undo / Redo
    document.getElementById('btn-sermon-undo')?.addEventListener('click', () => this.undo());
    document.getElementById('btn-sermon-redo')?.addEventListener('click', () => this.redo());

    // 4. Rétractation des volets & Synchronisation
    document.getElementById('btn-sermons-toggle-sidebar')?.addEventListener('click', () => this.toggleSidebar());
    document.getElementById('btn-sermon-sync-bible')?.addEventListener('click', () => this.syncPassageResources());
    document.getElementById('btn-sermon-toggle-drawer')?.addEventListener('click', () => this.toggleResourcesDrawer());
    document.getElementById('btn-close-resources-drawer')?.addEventListener('click', () => this.toggleResourcesDrawer(false));

    // Clic sur le fil d'ariane sous le titre pour ouvrir l'inspecteur d'infos
    document.getElementById('sermon-header-summary')?.addEventListener('click', () => {
      this.toggleResourcesDrawer(true);
      this.activeDrawerTab = 'metadata';
      document.querySelectorAll('#sermon-drawer-tabs-bar .drawer-tab').forEach(b => {
        b.classList.toggle('active', b.dataset.drawerTab === 'metadata');
      });
      this.renderDrawerContent();
    });

    // 5. Onglets du tiroir de ressources (Aperçu, Commentaires, IA, Lexique, Illustrations, Infos)
    document.querySelectorAll('#sermon-drawer-tabs-bar .drawer-tab').forEach(tabBtn => {
      tabBtn.addEventListener('click', () => {
        document.querySelectorAll('#sermon-drawer-tabs-bar .drawer-tab').forEach(b => b.classList.remove('active'));
        tabBtn.classList.add('active');
        this.activeDrawerTab = tabBtn.dataset.drawerTab || 'overview';
        this.renderDrawerContent();
      });
    });

    // 6. Insertion rapide de blocs
    document.getElementById('btn-insert-point')?.addEventListener('click', () => this.insertBlock('point'));
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

    // 7. Écoute de saisie pour métriques et historique
    this.titleInput?.addEventListener('input', () => {
      if (this.currentSermon) this.currentSermon.title = this.titleInput.value.trim();
      this.debouncedPushHistory();
    });

    this.contentEditor?.addEventListener('input', (e) => {
      this.updateMetrics();
      this.debouncedPushHistory();
      this.handleSlashInput(e);
    });

    // 8. Raccourcis clavier (Ctrl+S, Ctrl+Z, Ctrl+Y, Ctrl+B, Ctrl+I, Slash Navigation)
    this.contentEditor?.addEventListener('keydown', (e) => {
      if (this.isSlashMenuOpen) {
        if (this.handleSlashKeyDown(e)) {
          return;
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        this.saveCurrentSermon();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          this.redo();
        } else {
          e.preventDefault();
          this.undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        this.redo();
      }
    });

    // 9. Mode Pupitre
    document.getElementById('btn-sermon-pulpit-mode')?.addEventListener('click', () => this.openPulpitMode());
    document.getElementById('btn-pulpit-exit')?.addEventListener('click', () => this.closePulpitMode());
    document.getElementById('btn-pulpit-play-pause')?.addEventListener('click', () => this.togglePulpitChrono());
    document.getElementById('btn-pulpit-reset-chrono')?.addEventListener('click', () => this.resetPulpitChrono());
    document.getElementById('btn-pulpit-font-inc')?.addEventListener('click', () => this.adjustPulpitFontSize(2));
    document.getElementById('btn-pulpit-font-dec')?.addEventListener('click', () => this.adjustPulpitFontSize(-2));
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
    if (this.currentSermon) {
      this.syncPassageResources();
    }
  },

  // =========================================================================
  // CHARGEMENT & GESTION DES SERMONS
  // =========================================================================

  async loadSermons() {
    try {
      const list = await API.getSermonsList();
      this.sermons = Array.isArray(list) ? list : [];
      this.renderList();

      if (!this.currentSermon && this.sermons.length > 0) {
        await this.selectSermon(this.sermons[0].id);
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

  renderList() {
    if (!this.listContainer) return;
    const q = (this.searchInput?.value || '').toLowerCase().trim();

    let filtered = this.sermons.filter(s => {
      // Filtre texte
      const matchQuery = !q || 
        (s.title || '').toLowerCase().includes(q) ||
        (s.church || '').toLowerCase().includes(q) ||
        (s.passage?.reference || '').toLowerCase().includes(q) ||
        (s.theme_tags || []).some(t => t.toLowerCase().includes(q));

      if (!matchQuery) return false;

      // Filtres rapides
      if (this.currentFilter === 'ready') return s.status === 'ready';
      if (this.currentFilter === 'draft') return s.status === 'draft';
      return true;
    });

    if (filtered.length === 0) {
      this.listContainer.innerHTML = `
        <div style="padding: 24px 16px; text-align: center; color: var(--text-muted); font-size: 12.5px;">
          Aucune prédication correspondante.
        </div>
      `;
      return;
    }

    this.listContainer.innerHTML = '';
    filtered.forEach(s => {
      const item = document.createElement('div');
      const isActive = this.currentSermon?.id === s.id;
      const statusClass = s.status === 'ready' ? 'status-ready' : 'status-draft';
      const statusLabel = s.status === 'ready' ? 'Prêt' : 'Brouillon';
      const passRef = s.passage?.reference || 'Général';
      const church = s.church || 'Lieu non spécifié';
      const estMin = s.estimated_minutes ? `${s.estimated_minutes} min` : '';

      item.className = `sermon-list-item ${isActive ? 'active' : ''}`;
      item.setAttribute('data-id', s.id);

      item.innerHTML = `
        <div class="sermon-list-item-body">
          <div class="sermon-item-top">
            <span class="sermon-item-title" title="${this.escapeHtml(s.title || 'Sans titre')}"><span class="sermon-item-title-text">${this.escapeHtml(s.title || 'Sans titre')}</span></span>
            <span class="sermon-badge-pill ${statusClass}">${statusLabel}</span>
          </div>
          <div class="sermon-item-church">
            <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
            <span>${this.escapeHtml(church)}</span>
          </div>
          <div class="sermon-item-meta">
            <span style="font-size: 10.5px; font-weight: 700; color: var(--accent-blue);">${this.escapeHtml(passRef)}</span>
            <span class="sermon-item-timing">${estMin}</span>
          </div>
        </div>
        <div class="sermon-list-item-actions">
          <button type="button" class="btn-history-action btn-sermon-menu" title="Options (Clic droit)">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
          </button>
        </div>
      `;

      item.addEventListener('click', (e) => {
        if (e.target.closest('.btn-sermon-menu')) {
          e.stopPropagation();
          const btn = e.target.closest('.btn-sermon-menu');
          const rect = btn.getBoundingClientRect();
          this.showSermonContextMenu(s.id, s.title, rect.right, rect.bottom);
          return;
        }
        this.selectSermon(s.id);
      });

      // Clic droit (Menu contextuel)
      item.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.showSermonContextMenu(s.id, s.title, e.clientX, e.clientY);
      });

      this.listContainer.appendChild(item);
    });
  },

  showSermonContextMenu(sermonId, currentTitle, x, y) {
    let menu = document.getElementById('sermons-item-context-menu');
    if (!menu) {
      menu = document.createElement('div');
      menu.id = 'sermons-item-context-menu';
      menu.className = 'smooth-context-menu';
      document.body.appendChild(menu);
    }

    menu.innerHTML = `
      <div class="context-menu-item" data-action="rename">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
        <span>Renommer</span>
      </div>
      <div class="context-menu-item" data-action="duplicate">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
        <span>Dupliquer</span>
      </div>
      <div class="context-menu-divider"></div>
      <div class="context-menu-item danger" data-action="delete">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        <span>Supprimer</span>
      </div>
    `;

    menu.style.display = 'flex';
    menu.style.position = 'fixed';
    menu.style.zIndex = '10000';

    // Positionnement sans déborder
    const menuWidth = 170;
    const menuHeight = 110;
    let posX = Math.min(x, window.innerWidth - menuWidth - 10);
    let posY = Math.min(y, window.innerHeight - menuHeight - 10);
    menu.style.left = `${posX}px`;
    menu.style.top = `${posY}px`;

    // Actions
    menu.querySelector('[data-action="rename"]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.hideContextMenu();
      this.promptRenameSermon(sermonId, currentTitle);
    });

    menu.querySelector('[data-action="duplicate"]')?.addEventListener('click', async () => {
      this.hideContextMenu();
      const sermon = await API.getSermon(sermonId);
      if (sermon) {
        const copy = {
          ...sermon,
          id: `sermon-${Date.now()}`,
          filename: null,
          title: `${sermon.title || 'Sermon'} (Copie)`,
          date_planned: new Date().toISOString().split('T')[0]
        };
        await API.saveSermon(copy);
        await this.loadSermons();
        await this.selectSermon(copy.id);
      }
    });

    menu.querySelector('[data-action="delete"]')?.addEventListener('click', async () => {
      this.hideContextMenu();
      const targetTitle = currentTitle || 'cette prédication';
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

      if (confirmed) {
        await API.deleteSermon(sermonId);
        if (this.currentSermon?.id === sermonId) {
          this.currentSermon = null;
        }
        await this.loadSermons();
        if (typeof App !== 'undefined' && App.showToast) {
          App.showToast("Prédication supprimée.");
        }
      }
    });

    const closeHandler = (e) => {
      if (!menu.contains(e.target)) {
        this.hideContextMenu();
        document.removeEventListener('click', closeHandler);
      }
    };
    setTimeout(() => document.addEventListener('click', closeHandler), 10);
  },

  hideContextMenu() {
    const menu = document.getElementById('sermons-item-context-menu');
    if (menu) menu.style.display = 'none';
  },

  async promptRenameSermon(sermonId, currentTitle) {
    const itemEl = document.querySelector(`.sermon-list-item[data-id="${sermonId}"]`);
    const titleEl = itemEl?.querySelector('.sermon-item-title-text');

    if (itemEl && titleEl) {
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'history-rename-input';
      input.value = currentTitle || '';

      titleEl.replaceWith(input);
      input.focus();
      input.select();

      let isSaving = false;
      const saveRename = async () => {
        if (isSaving) return;
        isSaving = true;
        const newTitle = input.value.trim() || currentTitle || 'Prédication sans titre';
        try {
          const sermon = await API.getSermon(sermonId);
          if (sermon) {
            sermon.title = newTitle;
            if (this.currentSermon?.id === sermonId) {
              this.currentSermon.title = newTitle;
              if (this.titleInput) this.titleInput.value = newTitle;
            }
            await API.saveSermon(sermon);
            await this.loadSermons();
            if (typeof App !== 'undefined' && App.showToast) {
              App.showToast('Prédication renommée.');
            }
          } else {
            await this.loadSermons();
          }
        } catch (e) {
          console.error("Erreur renommage prédication:", e);
          await this.loadSermons();
        }
      };

      input.addEventListener('blur', saveRename);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          input.blur();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          this.renderList();
        }
      });
    }
  },

  toggleSidebar() {
    const sidebar = document.getElementById('sermons-sidebar-pane');
    if (sidebar) {
      sidebar.classList.toggle('collapsed');
    }
  },

  async selectSermon(sermonId) {
    try {
      const sermon = await API.getSermon(sermonId);
      if (!sermon) return;

      this.currentSermon = sermon;
      this.populateEditor(sermon);
      this.renderList();
      this.resetHistory();
      this.syncPassageResources();
    } catch (e) {
      console.error('Erreur sélection sermon:', e);
    }
  },

  populateEditor(sermon) {
    if (this.titleInput) this.titleInput.value = sermon.title || '';
    this.updateHeaderSummary(sermon);

    if (this.contentEditor) {
      // Transformation des callouts Markdown en HTML structuré propre
      this.contentEditor.innerHTML = this.markdownToEditorHtml(sermon.body || '');
    }

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
      body: ""
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

    const bodyMarkdown = this.editorHtmlToMarkdown(this.contentEditor?.innerHTML || '');
    
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
      big_idea: this.currentSermon.big_idea || '',
      goal: this.currentSermon.goal || '',
      body: bodyMarkdown
    };

    try {
      const res = await API.saveSermon(payload);
      if (res && res.success) {
        this.currentSermon = res.sermon || payload;
        await this.loadSermons();
        this.updateHeaderSummary(this.currentSermon);
        if (typeof App !== 'undefined' && App.showToast) {
          App.showToast("Prédication enregistrée !");
        }
      }
    } catch (e) {
      console.error('Erreur sauvegarde sermon:', e);
    }
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
  // INSERTION DE BLOCS HOMILÉTIQUES & ÉDITION
  // =========================================================================

  insertBlock(type) {
    if (!this.contentEditor) return;
    this.contentEditor.focus();

    let htmlToInsert = '';

    switch (type) {
      case 'point':
        htmlToInsert = `<h2>Point Principal</h2><p>Développement du point...</p>`;
        break;
      case 'subpoint':
        htmlToInsert = `<h3>Sous-point</h3><p>Explication...</p>`;
        break;
      case 'scripture':
        const ref = this.refInput?.value || 'Passage lié';
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
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
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

    document.execCommand('insertHTML', false, htmlToInsert);
    this.updateMetrics();
    this.debouncedPushHistory();
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
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
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

    // Titres Markdown
    html = html.replace(/^# (.*?)$/gm, '<h1>$1</h1>');
    html = html.replace(/^## (.*?)$/gm, '<h2>$1</h2>');
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
      // Extraire le texte interne sans l'en-tête
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

    // Nettoyer les balises résiduelles
    temp.innerHTML = raw;
    let cleanText = temp.innerText || temp.textContent || '';
    return cleanText.replace(/\n{3,}/g, '\n\n').trim();
  },

  // =========================================================================
  // CALCUL DES MÉTRIQUES & ÉQUILIBRE HOMILÉTIQUE
  // =========================================================================

  updateMetrics() {
    if (!this.contentEditor) return;

    const text = this.contentEditor.innerText || '';
    const words = text.trim().split(/\s+/).filter(w => w.length > 0);
    const wordCount = words.length;

    const wpm = this.currentSermon?.timing?.words_per_minute || 135;
    const estMinutes = (wordCount / wpm).toFixed(1);

    if (this.lblEstTime) this.lblEstTime.textContent = `${estMinutes} min`;
    if (this.lblWordCount) this.lblWordCount.textContent = `${wordCount} mots`;

    // Calcul de proportion des blocs
    const exegesisCount = this.contentEditor.querySelectorAll('.sermon-block-exegesis').length + 1;
    const illustrationCount = this.contentEditor.querySelectorAll('.sermon-block-illustration').length + 1;
    const applicationCount = this.contentEditor.querySelectorAll('.sermon-block-application').length + 1;

    const total = exegesisCount + illustrationCount + applicationCount;
    const pctExg = Math.round((exegesisCount / total) * 100);
    const pctIll = Math.round((illustrationCount / total) * 100);
    const pctApp = 100 - pctExg - pctIll;

    if (this.barExegesis) this.barExegesis.style.width = `${pctExg}%`;
    if (this.barIllustration) this.barIllustration.style.width = `${pctIll}%`;
    if (this.barApplication) this.barApplication.style.width = `${pctApp}%`;

    const elExg = document.getElementById('popover-pct-exegesis');
    const elIll = document.getElementById('popover-pct-illustration');
    const elApp = document.getElementById('popover-pct-application');
    const elAdvice = document.getElementById('popover-balance-advice');

    if (elExg) elExg.textContent = `${pctExg}%`;
    if (elIll) elIll.textContent = `${pctIll}%`;
    if (elApp) elApp.textContent = `${pctApp}%`;

    if (elAdvice) {
      if (pctExg > 55) {
        elAdvice.textContent = "Conseil : Sermon riche en exégèse. Pensez à ajouter des illustrations pour faciliter l'assimilation.";
      } else if (pctIll > 50) {
        elAdvice.textContent = "Conseil : Nombreuses illustrations. Veillez à bien ancrer le fond doctrinal dans le texte biblique.";
      } else if (pctApp > 50) {
        elAdvice.textContent = "Conseil : Forte orientation pratique. Vérifiez que les fondements exégétiques sont suffisants.";
      } else {
        elAdvice.textContent = "Équilibre sain et harmonieux entre enseignement, clarté et impact pratique.";
      }
    }
  },

  // =========================================================================
  // VOLET DROIT : RESSOURCES, COMMENTAIRES & ILLUSTRATIONS
  // =========================================================================

  toggleResourcesDrawer(forceState) {
    if (!this.resourcesDrawer) return;
    if (typeof forceState === 'boolean') {
      this.resourcesDrawer.classList.toggle('collapsed', !forceState);
    } else {
      this.resourcesDrawer.classList.toggle('collapsed');
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
      this.drawerContent.innerHTML = `
        <div class="sermon-drawer-meta-form">
          <div class="sermon-drawer-meta-field">
            <label class="sermon-drawer-meta-label">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
              <span>Passage Biblique</span>
            </label>
            <div style="display: flex; gap: 4px;">
              <input type="text" id="drawer-meta-ref" class="sermon-drawer-input" value="${this.escapeHtml(passageRef)}" placeholder="ex: Amos 3 ou Ga 3.1-14">
              <button class="btn-secondary btn-sm" id="btn-drawer-sync-bible" title="Synchroniser l'exégèse" style="padding: 0 8px;">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
              </button>
            </div>
          </div>

          <div class="sermon-drawer-meta-field">
            <label class="sermon-drawer-meta-label">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              <span>Église / Assemblée / Lieu</span>
            </label>
            <input type="text" id="drawer-meta-church" class="sermon-drawer-input" value="${this.escapeHtml(currentChurch)}" placeholder="ex: AMD ou Église de Lyon">
          </div>

          <div class="sermon-drawer-meta-field">
            <label class="sermon-drawer-meta-label">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              <span>Date de prononciation</span>
            </label>
            <input type="date" id="drawer-meta-date" class="sermon-drawer-input" value="${this.escapeHtml(date)}">
          </div>

          <div class="sermon-drawer-meta-field">
            <label class="sermon-drawer-meta-label">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
              <span>Série de prédications</span>
            </label>
            <input type="text" id="drawer-meta-series" class="sermon-drawer-input" value="${this.escapeHtml(series)}" placeholder="ex: Traversée d'Amos">
          </div>

          <div class="sermon-drawer-meta-field">
            <label class="sermon-drawer-meta-label">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
              <span>Idée Centrale (Big Idea)</span>
            </label>
            <textarea id="drawer-meta-bigidea" class="sermon-drawer-input sermon-drawer-textarea" placeholder="La vérité maîtresse en une phrase...">${this.escapeHtml(bigIdea)}</textarea>
          </div>

          <div class="sermon-drawer-meta-field">
            <label class="sermon-drawer-meta-label">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
              <span>Objectif pour l'auditeur</span>
            </label>
            <textarea id="drawer-meta-goal" class="sermon-drawer-input sermon-drawer-textarea" placeholder="L'application ou le défi clé...">${this.escapeHtml(goal)}</textarea>
          </div>
        </div>
      `;

      const refIn = document.getElementById('drawer-meta-ref');
      const churchIn = document.getElementById('drawer-meta-church');
      const dateIn = document.getElementById('drawer-meta-date');
      const seriesIn = document.getElementById('drawer-meta-series');
      const bigIdeaIn = document.getElementById('drawer-meta-bigidea');
      const goalIn = document.getElementById('drawer-meta-goal');

      const updateSermonMeta = () => {
        if (!this.currentSermon) return;
        this.currentSermon.passage = { reference: refIn?.value.trim() || '' };
        this.currentSermon.church = churchIn?.value.trim() || '';
        this.currentSermon.date_planned = dateIn?.value || '';
        this.currentSermon.series = { title: seriesIn?.value.trim() || '' };
        this.currentSermon.big_idea = bigIdeaIn?.value.trim() || '';
        this.currentSermon.goal = goalIn?.value.trim() || '';
        this.updateHeaderSummary(this.currentSermon);
        this.renderList();
        this.debouncedPushHistory();
      };

      [refIn, churchIn, dateIn, seriesIn, bigIdeaIn, goalIn].forEach(el => {
        el?.addEventListener('input', updateSermonMeta);
      });

      document.getElementById('btn-drawer-sync-bible')?.addEventListener('click', () => {
        this.syncPassageResources();
      });
      return;
    }

    if (this.activeDrawerTab === 'overview') {
      this.drawerContent.innerHTML = `
        <div class="overview-panel-header" style="margin-bottom: 12px;">
          <div class="overview-header-top-row" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
            <div class="overview-passage-info">
              <div class="overview-ref-badge-wrap" style="display: flex; align-items: center; gap: 6px;">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--accent-orange, #f59e0b);"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>
                <span style="font-size: 15px; font-weight: 800; color: var(--text-primary);">${this.escapeHtml(passageRef || 'Passage non lié')}</span>
              </div>
              <div style="font-size: 11.5px; color: var(--text-muted); font-style: italic; margin-top: 2px;">
                ${passageRef ? "Étude contextuelle et ressources bibliques liées" : "Définissez un passage dans l'onglet Infos pour synchroniser"}
              </div>
            </div>
            <span class="sermon-badge-pill" style="background: rgba(37,99,235,0.15); color: var(--accent-blue); font-weight: 700;">Lié</span>
          </div>

          <div class="overview-counters-strip" style="display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px;">
            <span class="sermon-stat-pill" style="font-size: 11px; padding: 2px 8px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 4px; display: flex; align-items: center; gap: 4px;">
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
              <span>Vidéo 1</span>
            </span>
            <span class="sermon-stat-pill" style="font-size: 11px; padding: 2px 8px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 4px; display: flex; align-items: center; gap: 4px;">
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              <span>Commentaires 14</span>
            </span>
            <span class="sermon-stat-pill" style="font-size: 11px; padding: 2px 8px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 4px; display: flex; align-items: center; gap: 4px;">
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/></svg>
              <span>Lexique 6</span>
            </span>
          </div>
        </div>

        <!-- 1. Carte BibleProject -->
        <div class="sermon-resource-card" style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 8px; padding: 12px; margin-bottom: 10px;">
          <div class="sermon-resource-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="font-size: 12px; font-weight: 700; color: #a855f7; display: flex; align-items: center; gap: 6px;">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
              <span>BibleProject (Panorama & Vidéo)</span>
            </span>
            <span class="sermon-badge-pill" style="background: rgba(168,85,247,0.15); color: #c084fc;">7:44 min</span>
          </div>
          <div style="font-size: 12px; color: var(--text-primary); font-weight: 600; margin-bottom: 6px;">
            Panorama narratif et structure théologique du livre
          </div>
          <div style="font-size: 11.5px; color: var(--text-muted); line-height: 1.45; margin-bottom: 10px;">
            Visualisez le contexte historique, les thèmes principaux et la portée prophétique pour nourrir votre introduction.
          </div>
          <button class="btn-secondary btn-resource-insert" id="btn-insert-bp-note" style="width: 100%; justify-content: center;">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
            <span>Insérer repère vidéo dans le sermon</span>
          </button>
        </div>

        <!-- 2. Carte Commentaires clés -->
        <div class="sermon-resource-card" style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 8px; padding: 12px; margin-bottom: 10px;">
          <div class="sermon-resource-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="font-size: 12px; font-weight: 700; color: var(--accent-blue); display: flex; align-items: center; gap: 6px;">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              <span>Frédéric Godet (Commentaire)</span>
            </span>
            <span class="sermon-badge-pill" style="background: rgba(37,99,235,0.1); color: var(--accent-blue);">Exégèse</span>
          </div>
          <div style="font-size: 12px; color: var(--text-primary); font-style: italic; line-height: 1.45; margin-bottom: 10px;">
            « L'apôtre montre que la fidélité de Dieu n'est pas un concept abstrait, mais une réalité qui s'incarne dans les relations quotidiennes. »
          </div>
          <button class="btn-secondary btn-resource-insert" onclick="SermonsView.insertCommentarySnippet('Frédéric Godet', 'L\'apôtre montre que la fidélité de Dieu n\'est pas un concept abstrait, mais une réalité qui s\'incarne dans les relations quotidiennes.')" style="width: 100%; justify-content: center;">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
            <span>Insérer citation Godet</span>
          </button>
        </div>

        <!-- 3. Carte Lexique & Mots originaux -->
        <div class="sermon-resource-card" style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 8px; padding: 12px; margin-bottom: 10px;">
          <div class="sermon-resource-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="font-size: 12px; font-weight: 700; color: #10b981; display: flex; align-items: center; gap: 6px;">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/></svg>
              <span>Terme clé : Arrhabon (G728)</span>
            </span>
            <span class="sermon-badge-pill" style="background: rgba(16,185,129,0.15); color: #10b981;">Grec</span>
          </div>
          <div style="font-size: 12px; color: var(--text-primary); margin-bottom: 6px;">
            <strong>ἀρραβών (arrhabōn)</strong> : Gage, acompte légal, première tranche d'un paiement garantissant le solde futur.
          </div>
          <button class="btn-secondary btn-resource-insert" onclick="SermonsView.insertExegesisSnippet('Arrhabon (G728)', 'Gage / Acompte de l\'Esprit garantissant notre héritage éternel.')" style="width: 100%; justify-content: center;">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
            <span>Insérer note lexicale</span>
          </button>
        </div>
      `;

      document.getElementById('btn-insert-bp-note')?.addEventListener('click', () => {
        this.insertBlock('cue');
      });
      return;
    }

    if (this.activeDrawerTab === 'commentaries') {
      this.drawerContent.innerHTML = `
        <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.5px;">
          Commentaires pour ${this.escapeHtml(passageRef || 'le passage')}
        </div>
        <div class="sermon-resource-card" style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 8px; padding: 12px; margin-bottom: 10px;">
          <div class="sermon-resource-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <span style="font-weight: 700; color: var(--accent-blue); font-size: 12px;">Frédéric Godet</span>
            <span class="sermon-badge-pill" style="background: rgba(37,99,235,0.1); color: var(--accent-blue); font-size: 10px;">Exégèse</span>
          </div>
          <div class="sermon-resource-body" style="font-size: 12px; color: var(--text-primary); line-height: 1.45; margin-bottom: 8px;">
            « La certitude chrétienne ne repose pas sur les dispositions changeantes de l'homme, mais sur l'immuable conseil de la grâce divine manifestée en Jésus-Christ. »
          </div>
          <button class="btn-secondary btn-resource-insert" onclick="SermonsView.insertCommentarySnippet('Frédéric Godet', 'La certitude chrétienne ne repose pas sur les dispositions changeantes de l\\'homme, mais sur l\\'immuable conseil de la grâce divine.')" style="width: 100%; justify-content: center;">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
            <span>Insérer citation</span>
          </button>
        </div>

        <div class="sermon-resource-card" style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 8px; padding: 12px; margin-bottom: 10px;">
          <div class="sermon-resource-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <span style="font-weight: 700; color: var(--accent-blue); font-size: 12px;">Matthew Henry</span>
            <span class="sermon-badge-pill" style="background: rgba(37,99,235,0.1); color: var(--accent-blue); font-size: 10px;">Pastorale</span>
          </div>
          <div class="sermon-resource-body" style="font-size: 12px; color: var(--text-primary); line-height: 1.45; margin-bottom: 8px;">
            « Toutes les promesses de Dieu sont oui et amen en Christ ; elles sont confirmées et scellées par son sang, et accomplies par son Esprit. »
          </div>
          <button class="btn-secondary btn-resource-insert" onclick="SermonsView.insertCommentarySnippet('Matthew Henry', 'Toutes les promesses de Dieu sont oui et amen en Christ ; elles sont confirmées et scellées par son sang.')" style="width: 100%; justify-content: center;">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
            <span>Insérer citation</span>
          </button>
        </div>
      `;
      return;
    }

    if (this.activeDrawerTab === 'ai') {
      this.drawerContent.innerHTML = `
        <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.5px;">
          Assistant Homilétique & Exégétique
        </div>
        <div class="sermon-resource-card" style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 8px; padding: 12px; margin-bottom: 10px;">
          <div style="font-size: 12px; font-weight: 700; color: var(--accent-blue); margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/></svg>
            <span>Générer des pistes pour votre message</span>
          </div>
          <div style="display: flex; flex-direction: column; gap: 6px; margin-top: 8px;">
            <button class="btn-secondary btn-sm" onclick="SermonsView.insertBlock('illustration')" style="justify-content: flex-start; text-align: left; padding: 6px 10px;">
              💡 Idées d'illustrations concrètes
            </button>
            <button class="btn-secondary btn-sm" onclick="SermonsView.insertBlock('application')" style="justify-content: flex-start; text-align: left; padding: 6px 10px;">
              🎯 Questions d'application pour l'auditoire
            </button>
            <button class="btn-secondary btn-sm" onclick="SermonsView.insertBlock('exegesis')" style="justify-content: flex-start; text-align: left; padding: 6px 10px;">
              🔍 Mots-clés et contexte historique
            </button>
          </div>
        </div>
      `;
      return;
    }

    if (this.activeDrawerTab === 'lexicon') {
      this.drawerContent.innerHTML = `
        <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.5px;">
          Lexique & Termes originaux Strong
        </div>
        <div class="sermon-resource-card" style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 8px; padding: 12px; margin-bottom: 10px;">
          <div class="sermon-resource-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <span style="font-size: 13px; font-weight: 800; color: var(--accent-blue);">G728 • arrhabōn (ἀρραβών)</span>
            <span class="sermon-badge-pill" style="background: rgba(37,99,235,0.1); color: var(--accent-blue);">Nom masc.</span>
          </div>
          <div style="font-size: 12px; color: var(--text-primary); line-height: 1.45; margin-bottom: 8px;">
            <strong>Définition :</strong> Acompte, gage versé d'avance pour valider un contrat d'achat et garantissant la pleine possession ultérieure.
          </div>
          <button class="btn-secondary btn-resource-insert" onclick="SermonsView.insertExegesisSnippet('arrhabōn (G728)', 'Acompte et gage de l\'Esprit')" style="width: 100%; justify-content: center;">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
            <span>Insérer note lexicale</span>
          </button>
        </div>
      `;
      return;
    }

    if (this.activeDrawerTab === 'illustrations') {
      if (this.illustrations.length === 0) {
        this.drawerContent.innerHTML = `<div style="color: var(--text-muted); font-size: 12px; text-align: center; padding: 20px;">Aucune illustration dans le réservoir.</div>`;
        return;
      }

      this.drawerContent.innerHTML = this.illustrations.map(ill => {
        const usedInChurch = (ill.usage_history || []).find(h => h.church && currentChurch && h.church.toLowerCase() === currentChurch.toLowerCase());
        const badgeWarning = usedInChurch ? `
          <div style="font-size: 10.5px; color: #f59e0b; font-weight: 700; display: flex; align-items: center; gap: 4px; margin-top: 4px;">
            <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <span>Déjà utilisée à ${this.escapeHtml(usedInChurch.church)} (${usedInChurch.date})</span>
          </div>
        ` : '';

        return `
          <div class="sermon-resource-card" style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 8px; padding: 12px; margin-bottom: 10px;">
            <div class="sermon-resource-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <span class="sermon-resource-title" style="font-weight: 700; font-size: 12.5px; color: var(--text-primary);">${this.escapeHtml(ill.title)}</span>
              <span class="sermon-badge-pill" style="background: rgba(245,158,11,0.15); color: #f59e0b; font-size: 10px;">${this.escapeHtml(ill.category || 'Général')}</span>
            </div>
            <div class="sermon-resource-body" style="font-size: 11.5px; color: var(--text-muted); line-height: 1.45; margin-bottom: 8px;">
              ${this.escapeHtml(ill.body ? ill.body.slice(0, 140) + '...' : '')}
            </div>
            ${badgeWarning}
            <button class="btn-secondary btn-resource-insert" onclick="SermonsView.insertIllustrationSnippet('${ill.id}', '${this.escapeHtml(ill.title)}')" style="width: 100%; justify-content: center; margin-top: 6px;">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
              <span>Insérer dans la prédication</span>
            </button>
          </div>
        `;
      }).join('');
      return;
    }
  },

  insertCommentarySnippet(author, text) {
    if (!this.contentEditor) return;
    this.contentEditor.focus();
    const html = `
      <div class="sermon-callout-block sermon-block-exegesis" data-type="exegesis">
        <div class="sermon-block-header">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          <span>Commentaire (${author})</span>
        </div>
        <p>« ${this.escapeHtml(text)} »</p>
      </div><p></p>
    `;
    document.execCommand('insertHTML', false, html);
    this.updateMetrics();
  },

  insertIllustrationSnippet(illId, title) {
    const ill = this.illustrations.find(i => i.id === illId);
    if (!ill) return;

    if (!this.contentEditor) return;
    this.contentEditor.focus();
    const html = `
      <div class="sermon-callout-block sermon-block-illustration" data-type="illustration" data-id="${ill.id}">
        <div class="sermon-block-header">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          <span>Illustration : ${this.escapeHtml(title)}</span>
        </div>
        <p>${this.escapeHtml(ill.body || '')}</p>
      </div><p></p>
    `;
    document.execCommand('insertHTML', false, html);
    this.updateMetrics();
  },

  // =========================================================================
  // MODE PUPITRE / PROMPTEUR LIVE
  // =========================================================================

  openPulpitMode() {
    const pulpitModal = document.getElementById('sermon-pulpit-modal');
    const container = document.getElementById('pulpit-content-container');
    if (!pulpitModal || !container) return;

    // Génération de la vue haute lisibilité
    const rawHtml = this.contentEditor?.innerHTML || '';
    container.innerHTML = this.buildPulpitViewHtml(rawHtml);
    container.style.fontSize = `${this.pulpitFontSize}px`;

    // Écoute des cases à cocher de validation de points
    container.querySelectorAll('.pulpit-point-check').forEach(chk => {
      chk.addEventListener('change', (e) => {
        const card = e.target.closest('.pulpit-section-card');
        if (card) {
          card.classList.toggle('completed', e.target.checked);
        }
      });
    });

    pulpitModal.classList.remove('hidden');

    // Demande de maintien d'écran actif (No-sleep)
    this.requestWakeLock();
  },

  buildPulpitViewHtml(html) {
    let temp = document.createElement('div');
    temp.innerHTML = html;

    // Convertir les repères de diapositive en badges prompteur percutants
    temp.querySelectorAll('.sermon-slide-badge').forEach(b => {
      let slideTag = document.createElement('span');
      slideTag.className = 'pulpit-slide-tag';
      slideTag.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg> <span>DIAPO</span>`;
      b.replaceWith(slideTag);
    });

    // Découpage en cartes de sections selon les H1, H2 et H3
    let sections = [];
    let currentCard = { title: "Introduction", nodes: [] };

    Array.from(temp.childNodes).forEach(node => {
      if (node.tagName === 'H1' || node.tagName === 'H2' || node.tagName === 'H3') {
        if (currentCard.nodes.length > 0) {
          sections.push(currentCard);
        }
        currentCard = { title: node.innerText.trim(), nodes: [] };
      } else {
        currentCard.nodes.push(node.cloneNode(true));
      }
    });
    if (currentCard.nodes.length > 0) {
      sections.push(currentCard);
    }

    return sections.map((sec, idx) => {
      let contentWrap = document.createElement('div');
      sec.nodes.forEach(n => contentWrap.appendChild(n));

      return `
        <div class="pulpit-section-card" id="pulpit-sec-${idx}">
          <div class="pulpit-section-title-row">
            <input type="checkbox" class="pulpit-point-check" title="Marquer cette section comme terminée">
            <div class="pulpit-point-heading">${this.escapeHtml(sec.title)}</div>
          </div>
          <div class="pulpit-section-body">
            ${contentWrap.innerHTML}
          </div>
        </div>
      `;
    }).join('');
  },

  closePulpitMode() {
    const pulpitModal = document.getElementById('sermon-pulpit-modal');
    if (pulpitModal) pulpitModal.classList.add('hidden');
    this.pausePulpitChrono();
    this.releaseWakeLock();
  },

  togglePulpitChrono() {
    if (this.pulpitIsPlaying) {
      this.pausePulpitChrono();
    } else {
      this.startPulpitChrono();
    }
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
    const el = document.getElementById('pulpit-chrono-time');
    if (el) el.textContent = str;
  },

  changePulpitFontSize(delta) {
    this.pulpitFontSize = Math.max(16, Math.min(36, this.pulpitFontSize + delta));
    const container = document.getElementById('pulpit-content-container');
    if (container) {
      container.style.fontSize = `${this.pulpitFontSize}px`;
    }
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
    } catch (e) {
      console.warn("WakeLock non supporté ou refusé :", e);
    }
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

  debouncedPushHistory() {
    if (this.historyDebounceTimer) clearTimeout(this.historyDebounceTimer);
    this.historyDebounceTimer = setTimeout(() => {
      this.pushHistoryState();
    }, 400);
  },

  pushHistoryState() {
    const state = {
      title: this.titleInput?.value || '',
      church: this.churchInput?.value || '',
      ref: this.refInput?.value || '',
      date: this.dateInput?.value || '',
      series: this.seriesInput?.value || '',
      bigIdea: this.bigIdeaInput?.value || '',
      goal: this.goalInput?.value || '',
      content: this.contentEditor?.innerHTML || ''
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
    if (this.churchInput) this.churchInput.value = state.church;
    if (this.refInput) this.refInput.value = state.ref;
    if (this.dateInput) this.dateInput.value = state.date;
    if (this.seriesInput) this.seriesInput.value = state.series;
    if (this.bigIdeaInput) this.bigIdeaInput.value = state.bigIdea;
    if (this.goalInput) this.goalInput.value = state.goal;
    if (this.contentEditor) this.contentEditor.innerHTML = state.content;
    this.updateMetrics();
  },

  // =========================================================================
  // GESTION DU MENU SLASH MODAL (STYLE ANYTYPE)
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
          { id: "h1", label: "Titre", iconText: "Aa", desc: "Point principal (H1)", action: "h1" },
          { id: "h2", label: "En-tête", iconText: "Aa", desc: "Sous-point (H2)", action: "h2" },
          { id: "h3", label: "Sous-titre", iconText: "Aa", desc: "Sous-section mineure (H3)", action: "h3" },
          { id: "highlight", label: "Surbrillance", iconSvg: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 11-6 6v3h3l6-6"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/></svg>`, desc: "Mettre en évidence le texte", action: "highlight" },
          { id: "box", label: "Encadré", iconText: "Aa", desc: "Bloc encadré général", action: "box" }
        ]
      },
      {
        category: "Prédication",
        items: [
          { id: "scripture", label: "Verset biblique", iconSvg: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`, desc: "Citation de l'Écriture", action: "scripture" },
          { id: "exegesis", label: "Exégèse & Langues", iconSvg: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="m8.5 13.5 2-5.5 2 5.5"/><path d="M9.2 11.8h2.6"/><path d="M14 8.5h3.5l-3.5 5h3.5"/></svg>`, desc: "Mots originaux hébreu/grec et lexique", action: "exegesis" },
          { id: "illustration", label: "Illustration", iconSvg: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`, desc: "Histoire, métaphore ou parabole", action: "illustration" },
          { id: "application", label: "Application pratique", iconSvg: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>`, desc: "Appel à l'action ou réflexion concrète", action: "application" },
          { id: "cue", label: "Note régie / Timing", iconSvg: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`, desc: "Indication technique ou projection", action: "cue" },
          { id: "slide", label: "Repère diapositive [_]", iconSvg: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`, desc: "Changement de slide projection", action: "slide" }
        ]
      },
      {
        category: "Listes",
        items: [
          { id: "task", label: "Case à cocher", iconSvg: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/><circle cx="12" cy="12" r="10"/></svg>`, desc: "Tâche ou point à vérifier", action: "task" },
          { id: "bullet", label: "Liste à puces", iconSvg: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>`, desc: "Liste non ordonnée", action: "bullet" },
          { id: "number", label: "Liste numérotée", iconSvg: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><text x="6" y="16" font-size="12" font-weight="bold" fill="currentColor">1.</text></svg>`, desc: "Liste ordonnée 1, 2, 3...", action: "number" },
          { id: "toggle", label: "Bloc dépliant", iconSvg: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>`, desc: "Contenu masquable / dépliable", action: "toggle" }
        ]
      },
      {
        category: "Autres",
        items: [
          { id: "divider", label: "Ligne de séparation", iconSvg: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"/></svg>`, desc: "Séparateur visuel", action: "divider" },
          { id: "table", label: "Tableau 3x3", iconSvg: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/><path d="M15 3v18"/></svg>`, desc: "Insérer une grille de comparaison", action: "table" },
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

  handleSlashKeyDown(e) {
    if (!this.isSlashMenuOpen) return false;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (this.slashCurrentItems.length > 0) {
        this.slashSelectedIndex = (this.slashSelectedIndex + 1) % this.slashCurrentItems.length;
        this.updateSlashSelection();
      }
      return true;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (this.slashCurrentItems.length > 0) {
        this.slashSelectedIndex = (this.slashSelectedIndex - 1 + this.slashCurrentItems.length) % this.slashCurrentItems.length;
        this.updateSlashSelection();
      }
      return true;
    }

    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      if (this.slashCurrentItems.length > 0 && this.slashCurrentItems[this.slashSelectedIndex]) {
        this.executeSlashCommand(this.slashCurrentItems[this.slashSelectedIndex].action);
      }
      return true;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      this.closeSlashMenu();
      return true;
    }

    return false;
  },

  openSlashMenu(query = "", rect = null) {
    if (!this.slashMenuEl) {
      this.slashMenuEl = document.createElement('div');
      this.slashMenuEl.id = 'sermon-slash-menu';
      this.slashMenuEl.className = 'sermon-slash-menu';
      document.body.appendChild(this.slashMenuEl);

      document.addEventListener('click', (e) => {
        if (this.isSlashMenuOpen && this.slashMenuEl && !this.slashMenuEl.contains(e.target) && e.target !== this.contentEditor) {
          this.closeSlashMenu();
        }
      });
    }

    const categories = this.getSlashCommandsDefinitions();
    const cleanQ = query.toLowerCase().trim();

    let flatItems = [];
    let html = '<div class="sermon-slash-list">';

    categories.forEach(cat => {
      const filtered = cat.items.filter(item => {
        if (!cleanQ) return true;
        return item.label.toLowerCase().includes(cleanQ) || item.desc.toLowerCase().includes(cleanQ) || item.id.toLowerCase().includes(cleanQ);
      });

      if (filtered.length > 0) {
        html += `<div class="sermon-slash-group-title">${cat.category}</div>`;
        filtered.forEach(item => {
          const itemIndex = flatItems.length;
          flatItems.push(item);
          
          let iconHtml = '';
          if (item.iconSvg) {
            iconHtml = item.iconSvg;
          } else {
            iconHtml = `<span style="font-family: serif; font-size: 13px;">${item.iconText || 'Aa'}</span>`;
          }

          html += `
            <div class="sermon-slash-item" data-index="${itemIndex}" data-action="${item.action}">
              <div class="sermon-slash-item-icon">${iconHtml}</div>
              <div class="sermon-slash-item-text">
                <span class="sermon-slash-item-label">${item.label}</span>
                <span class="sermon-slash-item-desc">${item.desc}</span>
              </div>
            </div>
          `;
        });
      }
    });

    html += '</div>';

    if (flatItems.length === 0) {
      html = '<div style="padding: 16px; text-align: center; color: var(--text-muted); font-size: 12px;">Aucun bloc trouvé.</div>';
    }

    this.slashCurrentItems = flatItems;
    this.slashSelectedIndex = 0;
    this.slashMenuEl.innerHTML = html;
    this.slashMenuEl.style.display = 'flex';
    this.isSlashMenuOpen = true;

    // Clic sur un item
    this.slashMenuEl.querySelectorAll('.sermon-slash-item').forEach(el => {
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const action = el.dataset.action;
        this.executeSlashCommand(action);
      });
    });

    this.updateSlashSelection();

    // Positionnement
    if (rect) {
      const menuWidth = 280;
      const menuHeight = Math.min(380, this.slashMenuEl.offsetHeight || 300);
      let posX = Math.min(rect.left, window.innerWidth - menuWidth - 20);
      let posY = rect.bottom + 6;

      if (posY + menuHeight > window.innerHeight - 10) {
        posY = Math.max(10, rect.top - menuHeight - 6);
      }

      this.slashMenuEl.style.left = `${posX}px`;
      this.slashMenuEl.style.top = `${posY}px`;
    }
  },

  updateSlashSelection() {
    if (!this.slashMenuEl) return;
    const items = this.slashMenuEl.querySelectorAll('.sermon-slash-item');
    items.forEach((item, idx) => {
      if (idx === this.slashSelectedIndex) {
        item.classList.add('selected');
        item.scrollIntoView({ block: 'nearest' });
      } else {
        item.classList.remove('selected');
      }
    });
  },

  closeSlashMenu() {
    if (this.slashMenuEl) {
      this.slashMenuEl.style.display = 'none';
    }
    this.isSlashMenuOpen = false;
    this.slashCurrentItems = [];
    this.slashSelectedIndex = 0;
  },

  removeSlashTrigger() {
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    const node = range.startContainer;
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent;
      const lastSlashIndex = text.lastIndexOf('/', range.startOffset);
      if (lastSlashIndex !== -1) {
        const beforeSlash = text.slice(0, lastSlashIndex);
        const afterCaret = text.slice(range.startOffset);
        node.textContent = beforeSlash + afterCaret;
        
        // Repositionner le curseur
        const newRange = document.createRange();
        newRange.setStart(node, beforeSlash.length);
        newRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(newRange);
      }
    }
  },

  executeSlashCommand(action) {
    this.removeSlashTrigger();
    this.closeSlashMenu();

    if (!this.contentEditor) return;
    this.contentEditor.focus();

    switch (action) {
      case 'text':
        document.execCommand('formatBlock', false, '<p>');
        break;
      case 'h1':
        this.applyBlockFormat('h1');
        break;
      case 'h2':
        this.applyBlockFormat('h2');
        break;
      case 'h3':
        this.applyBlockFormat('h3');
        break;
      case 'highlight':
        this.surroundSelectionWithTag('mark');
        break;
      case 'box':
        this.insertCallout('Remarque');
        break;
      case 'scripture':
        this.insertBlock('scripture');
        break;
      case 'exegesis':
        this.insertBlock('exegesis');
        break;
      case 'illustration':
        this.insertBlock('illustration');
        break;
      case 'application':
        this.insertBlock('application');
        break;
      case 'cue':
        this.insertBlock('cue');
        break;
      case 'slide':
        this.insertBlock('slide');
        break;
      case 'task':
        this.insertTaskItem();
        break;
      case 'bullet':
        document.execCommand('insertUnorderedList');
        break;
      case 'number':
        document.execCommand('insertOrderedList');
        break;
      case 'toggle':
        this.insertToggleBlock();
        break;
      case 'divider':
        document.execCommand('insertHorizontalRule');
        break;
      case 'table':
        this.insertTable3x3();
        break;
      case 'quote':
        document.execCommand('formatBlock', false, 'blockquote');
        break;
      default:
        break;
    }

    this.updateMetrics();
    this.debouncedPushHistory();
  },

  applyBlockFormat(tag) {
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    let parent = range.commonAncestorContainer;
    if (parent.nodeType === Node.TEXT_NODE) parent = parent.parentNode;

    if (parent.closest(tag)) {
      document.execCommand('formatBlock', false, '<p>');
    } else {
      document.execCommand('formatBlock', false, `<${tag}>`);
    }
  },

  surroundSelectionWithTag(tag) {
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    const selectedText = range.toString();

    if (selectedText) {
      const el = document.createElement(tag);
      el.textContent = selectedText;
      range.deleteContents();
      range.insertNode(el);
    } else {
      const el = document.createElement(tag);
      el.innerHTML = '&nbsp;';
      range.insertNode(el);
      range.selectNodeContents(el);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  },

  insertCallout(title = 'Remarque') {
    const html = `
      <div class="note-callout">
        <div class="note-callout-title">${this.escapeHtml(title)}</div>
        <div>Votre note ou commentaire ici...</div>
      </div>
      <p><br></p>
    `;
    document.execCommand('insertHTML', false, html);
  },

  insertTaskItem() {
    const html = `
      <div class="note-task-item" style="display: flex; align-items: center; gap: 8px; margin: 4px 0;">
        <input type="checkbox" style="cursor: pointer;">
        <span>Point ou tâche à cocher</span>
      </div>
      <p><br></p>
    `;
    document.execCommand('insertHTML', false, html);
  },

  insertToggleBlock() {
    const html = `
      <details class="note-details" style="margin: 8px 0; padding: 6px 10px; background: rgba(0,0,0,0.03); border-radius: 6px; cursor: pointer;">
        <summary style="font-weight: 600;">Titre dépliant</summary>
        <div style="padding-top: 6px;">Contenu masquable du bloc...</div>
      </details>
      <p><br></p>
    `;
    document.execCommand('insertHTML', false, html);
  },

  insertTable3x3() {
    const html = `
      <table class="note-table" style="width: 100%; border-collapse: collapse; margin: 12px 0;">
        <thead>
          <tr>
            <th style="border: 1px solid var(--border-color); padding: 6px 10px;">Colonne 1</th>
            <th style="border: 1px solid var(--border-color); padding: 6px 10px;">Colonne 2</th>
            <th style="border: 1px solid var(--border-color); padding: 6px 10px;">Colonne 3</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border: 1px solid var(--border-color); padding: 6px 10px;">Donnée 1</td>
            <td style="border: 1px solid var(--border-color); padding: 6px 10px;">Donnée 2</td>
            <td style="border: 1px solid var(--border-color); padding: 6px 10px;">Donnée 3</td>
          </tr>
          <tr>
            <td style="border: 1px solid var(--border-color); padding: 6px 10px;">Donnée A</td>
            <td style="border: 1px solid var(--border-color); padding: 6px 10px;">Donnée B</td>
            <td style="border: 1px solid var(--border-color); padding: 6px 10px;">Donnée C</td>
          </tr>
        </tbody>
      </table>
      <p><br></p>
    `;
    document.execCommand('insertHTML', false, html);
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
