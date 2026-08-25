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

    // 5. Onglets du tiroir de ressources
    document.querySelectorAll('.drawer-tab-btn').forEach(tabBtn => {
      tabBtn.addEventListener('click', () => {
        document.querySelectorAll('.drawer-tab-btn').forEach(b => b.classList.remove('active'));
        tabBtn.classList.add('active');
        this.activeDrawerTab = tabBtn.dataset.drawerTab || 'exegesis';
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

    // Outils formatage texte
    document.getElementById('btn-sermon-bold')?.addEventListener('click', () => document.execCommand('bold'));
    document.getElementById('btn-sermon-italic')?.addEventListener('click', () => document.execCommand('italic'));
    document.getElementById('btn-sermon-list')?.addEventListener('click', () => document.execCommand('insertUnorderedList'));
    document.getElementById('btn-sermon-quote')?.addEventListener('click', () => document.execCommand('formatBlock', false, 'blockquote'));

    // 7. Écoute de saisie pour métriques et historique
    const inputs = [this.titleInput, this.churchInput, this.refInput, this.dateInput, this.seriesInput, this.bigIdeaInput, this.goalInput];
    inputs.forEach(el => {
      el?.addEventListener('input', () => this.debouncedPushHistory());
    });

    this.contentEditor?.addEventListener('input', () => {
      this.updateMetrics();
      this.debouncedPushHistory();
    });

    // 8. Raccourcis clavier (Ctrl+S, Ctrl+Z, Ctrl+Y, Ctrl+B, Ctrl+I)
    this.contentEditor?.addEventListener('keydown', (e) => {
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
            <span class="sermon-item-title" title="${this.escapeHtml(s.title || 'Sans titre')}">${this.escapeHtml(s.title || 'Sans titre')}</span>
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
    menu.querySelector('[data-action="rename"]')?.addEventListener('click', async () => {
      this.hideContextMenu();
      const newTitle = prompt("Nouveau titre de la prédication :", currentTitle || "");
      if (newTitle && newTitle.trim() && newTitle.trim() !== currentTitle) {
        const sermon = await API.getSermon(sermonId);
        if (sermon) {
          sermon.title = newTitle.trim();
          await API.saveSermon(sermon);
          await this.loadSermons();
          if (this.currentSermon?.id === sermonId) {
            this.titleInput.value = newTitle.trim();
          }
        }
      }
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
      if (confirm(`Supprimer définitivement "${currentTitle || 'ce sermon'}" ?`)) {
        await API.deleteSermon(sermonId);
        if (this.currentSermon?.id === sermonId) {
          this.currentSermon = null;
        }
        await this.loadSermons();
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
    if (this.churchInput) this.churchInput.value = sermon.church || '';
    if (this.refInput) this.refInput.value = sermon.passage?.reference || '';
    if (this.dateInput) this.dateInput.value = sermon.date_planned || '';
    if (this.seriesInput) this.seriesInput.value = sermon.series?.title || '';
    if (this.bigIdeaInput) this.bigIdeaInput.value = sermon.big_idea || '';
    if (this.goalInput) this.goalInput.value = sermon.goal || '';

    if (this.contentEditor) {
      // Transformation des callouts Markdown en HTML structuré propre
      this.contentEditor.innerHTML = this.markdownToEditorHtml(sermon.body || '');
    }

    this.updateMetrics();
  },

  async createNewSermon() {
    const todayStr = new Date().toISOString().split('T')[0];
    const newSermon = {
      id: `sermon-${Date.now()}`,
      title: "Nouvelle prédication",
      church: this.churchInput?.value || "Église locale",
      date_planned: todayStr,
      status: "draft",
      series: { title: "" },
      passage: { reference: "Jean 3:16" },
      big_idea: "",
      goal: "",
      timing: { target_duration_min: 35, words_per_minute: 135 },
      body: "# Introduction\n\n> [!cue] Projeter diapo d'introduction\n\nVotre texte ici...\n\n---\n\n# I. Premier Point\n\n> [!application]\n> Défi pour l'auditoire...\n"
    };

    const res = await API.saveSermon(newSermon);
    if (res && res.success) {
      await this.loadSermons();
      await this.selectSermon(newSermon.id);
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast("Nouveau sermon créé avec succès !");
      }
    }
  },

  async saveCurrentSermon() {
    if (!this.currentSermon) return;

    const bodyMarkdown = this.editorHtmlToMarkdown(this.contentEditor?.innerHTML || '');
    
    const payload = {
      ...this.currentSermon,
      title: this.titleInput?.value.trim() || 'Sermon sans titre',
      church: this.churchInput?.value.trim() || '',
      date_planned: this.dateInput?.value || new Date().toISOString().split('T')[0],
      series: {
        ...(this.currentSermon.series || {}),
        title: this.seriesInput?.value.trim() || ''
      },
      passage: {
        ...(this.currentSermon.passage || {}),
        reference: this.refInput?.value.trim() || ''
      },
      big_idea: this.bigIdeaInput?.value.trim() || '',
      goal: this.goalInput?.value.trim() || '',
      body: bodyMarkdown
    };

    try {
      const res = await API.saveSermon(payload);
      if (res && res.success) {
        this.currentSermon = res.sermon || payload;
        await this.loadSermons();
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
    if (!confirm(`Supprimer définitivement la prédication "${this.currentSermon.title}" ?`)) return;

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
    const passageRef = this.refInput?.value.trim() || 'Romains 8:28-39';
    this.renderDrawerContent();
  },

  async renderDrawerContent() {
    if (!this.drawerContent) return;
    const passageRef = this.refInput?.value.trim() || 'Romains 8:28-39';
    const currentChurch = this.churchInput?.value.trim() || '';

    if (this.activeDrawerTab === 'exegesis') {
      this.drawerContent.innerHTML = `
        <div class="sermon-resource-card">
          <div class="sermon-resource-header">
            <span class="sermon-resource-title">Passage lié : ${this.escapeHtml(passageRef)}</span>
          </div>
          <div class="sermon-resource-body">
            Grec / Hébreu et lexiques disponibles pour ce texte.
          </div>
          <button class="btn-secondary btn-resource-insert" id="btn-add-exg-snippet">
            <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            <span>Insérer note exégèse</span>
          </button>
        </div>
      `;
      document.getElementById('btn-add-exg-snippet')?.addEventListener('click', () => {
        this.insertBlock('exegesis');
      });

    } else if (this.activeDrawerTab === 'commentaries') {
      this.drawerContent.innerHTML = `
        <div class="sermon-resource-card">
          <div class="sermon-resource-header">
            <span class="sermon-resource-title">Frédéric Godet</span>
            <span class="sermon-badge-pill" style="background: rgba(37,99,235,0.1); color: var(--accent-blue);">Romains 8</span>
          </div>
          <div class="sermon-resource-body">
            « La certitude chrétienne ne repose pas sur les dispositions changeantes de l'homme, mais sur l'immuable conseil de la grâce divine. »
          </div>
          <button class="btn-secondary btn-resource-insert" onclick="SermonsView.insertCommentarySnippet('Frédéric Godet', 'La certitude chrétienne ne repose pas sur les dispositions changeantes...')">
            <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            <span>Insérer citation</span>
          </button>
        </div>
      `;

    } else if (this.activeDrawerTab === 'illustrations') {
      if (this.illustrations.length === 0) {
        this.drawerContent.innerHTML = `<div style="color: var(--text-muted); font-size: 12px;">Aucune illustration dans le réservoir.</div>`;
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
          <div class="sermon-resource-card">
            <div class="sermon-resource-header">
              <span class="sermon-resource-title">${this.escapeHtml(ill.title)}</span>
            </div>
            <div class="sermon-resource-body">${this.escapeHtml(ill.body ? ill.body.slice(0, 140) + '...' : '')}</div>
            ${badgeWarning}
            <button class="btn-secondary btn-resource-insert" onclick="SermonsView.insertIllustrationSnippet('${ill.id}', '${this.escapeHtml(ill.title)}')">
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              <span>Insérer</span>
            </button>
          </div>
        `;
      }).join('');
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

    // Découpage en cartes de sections selon les H1 et H2
    let sections = [];
    let currentCard = { title: "Introduction", nodes: [] };

    Array.from(temp.childNodes).forEach(node => {
      if (node.tagName === 'H1' || node.tagName === 'H2') {
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
    if (this.pulpitChronoTimer) {
      clearInterval(this.pulpitChronoTimer);
      this.pulpitChronoTimer = null;
    }
  },

  resetPulpitChrono() {
    this.pausePulpitChrono();
    this.pulpitChronoSeconds = 0;
    this.updatePulpitChronoDisplay();
  },

  updatePulpitChronoDisplay() {
    const min = Math.floor(this.pulpitChronoSeconds / 60);
    const sec = this.pulpitChronoSeconds % 60;
    const str = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    const display = document.getElementById('pulpit-chrono-display');
    if (display) display.textContent = str;
  },

  adjustPulpitFontSize(delta) {
    this.pulpitFontSize = Math.max(16, Math.min(48, this.pulpitFontSize + delta));
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
    if ('wakeLock' in navigator) {
      try {
        this.wakeLockSentinel = await navigator.wakeLock.request('screen');
      } catch (err) {
        console.warn('Wake Lock non disponible:', err);
      }
    }
  },

  releaseWakeLock() {
    if (this.wakeLockSentinel) {
      this.wakeLockSentinel.release().catch(() => {});
      this.wakeLockSentinel = null;
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
