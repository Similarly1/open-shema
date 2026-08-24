/**
 * Passage Study View Controller — Open Shema
 * 
 * Module d'interface pour le "Guide de Passage" (Étude exégétique à 360°).
 * Directives :
 * - Zéro émoji : icônes vectorielles SVG uniquement.
 * - Texte original intégral (Hébreu WLC avec RTL / Grec NA28/SBLGNT) en mode continu et interlinéaire mot-à-mot.
 * - Comparaison multi-versions synoptique.
 * - Commentaires historiques & synthèse.
 * - Contexte historique, dictionnaires et cartographie.
 * - Atelier IA (Structure, Idée maîtresse, Plan de prédication, Questions d'étude).
 * - Prise de notes et export Markdown (.md).
 */

const PassageStudyView = {
  // Éléments du DOM
  viewEl: null,
  searchInputEl: null,
  btnSearchEl: null,
  btnSyncBibleEl: null,
  btnExportNoteEl: null,
  headerRefEl: null,
  headerPericopeEl: null,
  headerContextEl: null,
  btnPrevPericopeEl: null,
  btnNextPericopeEl: null,
  
  // Conteneurs de contenu
  scriptureContainerEl: null,
  originalContainerEl: null,
  commentariesContainerEl: null,
  encyclopediaContainerEl: null,
  aiAtelierContainerEl: null,
  notesContainerEl: null,
  
  // État local
  currentData: null,
  currentReference: 'Philippiens 2:5-11',
  activeMainTab: 'scripture',
  activeOrigMode: 'continuous', // 'continuous', 'interlinear', 'lemmas'
  showTranslit: true,
  activeAiInsight: 'structure',
  aiInsightsCache: {},
  diffOptions: {
    enabled: true,
    showAdded: true,
    showRemoved: true
  },
  gospelSynopsisState: {
    activePericopeId: null,
    pivotBook: null,
    colLangs: { MAT: 'fr', MRK: 'fr', LUK: 'fr', JHN: 'fr' },
    diffEnabled: true,
    viewMode: 'text'
  },
  isLoading: false,

  // Icônes SVG sobres
  ICONS: {
    search: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
    bible: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
    scroll: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1 .4-1 1v7c0 .6.4 1 1 1h14Z"/><path d="M16 17v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/></svg>',
    comment: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    history: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    sparkles: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/></svg>',
    note: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
    sync: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>',
    export: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
    layers: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>',
    mapPin: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>',
    bookOpen: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
    copy: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>',
    check: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    arrowLeft: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>',
    arrowRight: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>',
    compass: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>',
    list: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>'
  },

  init() {
    this.viewEl = document.getElementById('view-passage-study');
    if (!this.viewEl) return;

    this.searchInputEl = document.getElementById('ps-search-input');
    this.btnSearchEl = document.getElementById('btn-ps-search');
    this.btnSyncBibleEl = document.getElementById('btn-ps-sync-bible');
    this.btnExportNoteEl = document.getElementById('btn-ps-export-note');
    
    this.headerRefEl = document.getElementById('ps-header-ref');
    this.headerPericopeEl = document.getElementById('ps-header-pericope');
    this.headerContextEl = document.getElementById('ps-header-context');
    this.btnPrevPericopeEl = document.getElementById('btn-ps-prev-pericope');
    this.btnNextPericopeEl = document.getElementById('btn-ps-next-pericope');

    this.scriptureContainerEl = document.getElementById('ps-content-scripture');
    this.originalContainerEl = document.getElementById('ps-content-original');
    this.commentariesContainerEl = document.getElementById('ps-content-commentaries');
    this.encyclopediaContainerEl = document.getElementById('ps-content-encyclopedia');
    this.aiAtelierContainerEl = document.getElementById('ps-content-ai');
    this.notesContainerEl = document.getElementById('ps-content-notes');

    this.bindEvents();
  },

  bindEvents() {
    // 1. Recherche de passage
    const triggerSearch = () => {
      const q = this.searchInputEl?.value?.trim();
      if (q) {
        this.loadPassage(q);
      }
    };

    this.btnSearchEl?.addEventListener('click', triggerSearch);
    this.searchInputEl?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        triggerSearch();
      }
    });

    // 2. Suggestions de passages rapides
    document.querySelectorAll('.ps-quick-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const ref = chip.dataset.ref;
        if (ref) {
          if (this.searchInputEl) this.searchInputEl.value = ref;
          this.loadPassage(ref);
        }
      });
    });

    // 3. Synchronisation avec le lecteur Bible
    this.btnSyncBibleEl?.addEventListener('click', () => {
      this.syncWithBibleReader();
    });

    // 4. Navigation Péricopes précédente / suivante
    this.btnPrevPericopeEl?.addEventListener('click', () => {
      const d = this.currentData;
      let prevRef = d?.pericope?.prev?.ref_range;
      if (!prevRef && d && d.start_ch > 1) {
        prevRef = `${d.french_book} ${d.start_ch - 1}`;
      }
      if (prevRef) {
        if (this.searchInputEl) this.searchInputEl.value = prevRef;
        this.loadPassage(prevRef);
      }
    });

    this.btnNextPericopeEl?.addEventListener('click', () => {
      const d = this.currentData;
      let nextRef = d?.pericope?.next?.ref_range;
      if (!nextRef && d && d.end_ch) {
        nextRef = `${d.french_book} ${d.end_ch + 1}`;
      }
      if (nextRef) {
        if (this.searchInputEl) this.searchInputEl.value = nextRef;
        this.loadPassage(nextRef);
      }
    });

    // 5. Navigation des onglets principaux
    document.querySelectorAll('.ps-nav-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const tabKey = tab.dataset.tab;
        if (tabKey) this.switchTab(tabKey);
      });
    });

    // 6. Export vers les notes
    this.btnExportNoteEl?.addEventListener('click', () => {
      this.exportToNotes();
    });
  },

  onViewActivated() {
    if (!this.currentData && !this.isLoading) {
      // Charger le passage actif du lecteur s'il existe, sinon le passage par défaut
      if (typeof BibleReader !== 'undefined' && BibleReader.currentBook) {
        this.syncWithBibleReader();
      } else {
        this.loadPassage(this.currentReference);
      }
    }
  },

  syncWithBibleReader() {
    if (typeof BibleReader === 'undefined') return;
    const b = BibleReader.currentBook || 'PHP';
    const ch = BibleReader.currentChapter || 2;
    const v = BibleReader.selectedVerse || 5;
    
    // Déterminer la référence de péricope ou du verset
    const ref = `${b} ${ch}:${v}`;
    if (this.searchInputEl) this.searchInputEl.value = ref;
    this.loadPassage(ref);
  },

  switchTab(tabKey) {
    this.activeMainTab = tabKey;
    document.querySelectorAll('.ps-nav-tab').forEach(t => {
      if (t.dataset.tab === tabKey) t.classList.add('active');
      else t.classList.remove('active');
    });

    document.querySelectorAll('.ps-tab-panel').forEach(p => {
      if (p.id === `ps-panel-${tabKey}`) p.classList.add('active');
      else p.classList.remove('active');
    });

    // Déclencher le chargement de l'atelier IA si l'onglet est ouvert pour la première fois
    if (tabKey === 'ai' && !this.aiInsightsCache[this.activeAiInsight]) {
      this.fetchAiInsight(this.activeAiInsight);
    }
  },

  async loadPassage(passageRef) {
    if (!passageRef || !passageRef.trim()) return;
    this.isLoading = true;
    this.currentReference = passageRef.trim();
    this.aiInsightsCache = {};

    this.showGlobalLoading(true);

    try {
      const activeBible = (typeof BibleReader !== 'undefined' && BibleReader.currentBible) || 'LSG';
      const data = await API.getPassageStudyData(this.currentReference, activeBible);

      if (!data || !data.success) {
        if (typeof App !== 'undefined' && App.showToast) {
          App.showToast(data?.error || "Impossible d'analyser ce passage", "error");
        }
        this.showGlobalLoading(false);
        return;
      }

      this.currentData = data;
      if (data.gospel_synopsis?.has_synoptic) {
        this.gospelSynopsisState.activePericopeId = data.gospel_synopsis.primary_pericope_id || null;
        this.gospelSynopsisState.pivotBook = data.book_code || 'MAT';
        this.gospelSynopsisState.colLangs = { MAT: 'fr', MRK: 'fr', LUK: 'fr', JHN: 'fr' };
        this.gospelSynopsisState.diffEnabled = true;
      }
      this.renderHeader();
      this.renderScripture();
      this.renderOriginalLanguage();
      this.renderCommentaries();
      this.renderEncyclopedia();
      this.renderAiAtelier();
      this.renderNotesSection();

      if (this.searchInputEl) {
        this.searchInputEl.value = data.reference;
      }
    } catch (err) {
      console.error('Erreur chargement étude de passage:', err);
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast("Erreur de connexion au serveur", "error");
      }
    } finally {
      this.isLoading = false;
      this.showGlobalLoading(false);
    }
  },

  showGlobalLoading(show) {
    const loader = document.getElementById('ps-global-loader');
    if (loader) {
      if (show) loader.classList.remove('hidden');
      else loader.classList.add('hidden');
    }
  },

  // =========================================================================
  // RENDU DE L'EN-TÊTE
  // =========================================================================
  renderHeader() {
    const d = this.currentData;
    if (!d) return;

    if (this.headerRefEl) {
      this.headerRefEl.textContent = d.reference;
    }

    if (this.headerPericopeEl) {
      if (d.pericope?.title) {
        this.headerPericopeEl.textContent = d.pericope.title;
        this.headerPericopeEl.classList.remove('hidden');
      } else {
        this.headerPericopeEl.classList.add('hidden');
      }
    }

    // Gestion du fil de contexte et péricopes précédentes / suivantes
    if (this.btnPrevPericopeEl) {
      const prev = d.pericope?.prev;
      if (prev?.ref_range) {
        this.btnPrevPericopeEl.title = `Péricope précédente : ${prev.ref_range}${prev.title ? ' — ' + prev.title : ''}`;
        this.btnPrevPericopeEl.classList.remove('disabled');
        this.btnPrevPericopeEl.removeAttribute('disabled');
      } else if (d.start_ch > 1) {
        this.btnPrevPericopeEl.title = `Chapitre précédent : ${d.french_book} ${d.start_ch - 1}`;
        this.btnPrevPericopeEl.classList.remove('disabled');
        this.btnPrevPericopeEl.removeAttribute('disabled');
      } else {
        this.btnPrevPericopeEl.classList.add('disabled');
        this.btnPrevPericopeEl.setAttribute('disabled', 'true');
      }
    }

    if (this.btnNextPericopeEl) {
      const next = d.pericope?.next;
      if (next?.ref_range) {
        this.btnNextPericopeEl.title = `Péricope suivante : ${next.ref_range}${next.title ? ' — ' + next.title : ''}`;
        this.btnNextPericopeEl.classList.remove('disabled');
        this.btnNextPericopeEl.removeAttribute('disabled');
      } else {
        this.btnNextPericopeEl.title = `Chapitre suivant : ${d.french_book} ${d.end_ch + 1}`;
        this.btnNextPericopeEl.classList.remove('disabled');
        this.btnNextPericopeEl.removeAttribute('disabled');
      }
    }
  },

  // =========================================================================
  // 1. SECTION TEXTE FRANÇAIS, SYNOPSE DES ÉVANGILES & COMPARAISON MULTI-VERSIONS
  // =========================================================================
  renderScripture() {
    const sc = this.currentData?.scripture;
    if (!sc || !this.scriptureContainerEl) return;

    const verses = sc.verses || [];
    const mainVersion = sc.main_version || 'LSG';
    const synoptic = sc.synoptic_matrix || [];
    const availableVersions = sc.available_versions || [mainVersion];
    const gospelSyn = this.currentData?.gospel_synopsis;
    const hasGospelSyn = gospelSyn && gospelSyn.has_synoptic && gospelSyn.pericopes && gospelSyn.pericopes.length > 0;
    const vParMap = gospelSyn?.verse_parallels || {};

    let html = `
      <div class="ps-card ps-scripture-card">
        <div class="ps-card-header">
          <div class="ps-card-title-group">
            <span class="ps-card-icon">${this.ICONS.bible}</span>
            <h3 class="ps-card-title">Texte Biblique (${mainVersion})</h3>
            <span class="ps-badge ps-badge-neutral">${verses.length} verset${verses.length > 1 ? 's' : ''}</span>
          </div>
          <div class="ps-card-actions">
            <button type="button" class="ps-btn-sm" id="btn-ps-copy-text" title="Copier le texte complet du passage">
              <span class="ps-icon-slot">${this.ICONS.copy}</span>
              <span>Copier</span>
            </button>
            <button type="button" class="ps-btn-sm ps-btn-accent" id="btn-ps-toggle-synoptic" title="Afficher la matrice comparative des traductions (LSG, S21, Chouraqui...)">
              <span class="ps-icon-slot">${this.ICONS.layers}</span>
              <span>Comparer les versions</span>
            </button>
            ${hasGospelSyn ? `
              <button type="button" class="ps-btn-sm ps-btn-gospel-synopsis" id="btn-ps-toggle-gospel-synopsis" title="Afficher l'harmonie synoptique des Évangiles (Mt // Mc // Lc // Jn)">
                <span class="ps-icon-slot">${this.ICONS.compass}</span>
                <span>Harmonie des Évangiles</span>
              </button>
            ` : ''}
          </div>
        </div>

        <div class="ps-scripture-body" id="ps-scripture-main-body">
    `;

    verses.forEach(v => {
      const vPar = vParMap[v.key];
      const parBadgeHtml = vPar ? `
        <button type="button" class="ps-parallel-badge" data-verse-key="${v.key}" title="Parallèles : ${this.escapeHtml(vPar.title_fr)}">
          <span class="ps-badge-icon">☵</span>
          <span>${this.escapeHtml(vPar.badges_str)}</span>
        </button>
      ` : '';

      const drawerHtml = vPar ? `
        <div class="ps-inline-parallel-drawer hidden" id="ps-drawer-${v.key.replace(':', '-')}">
          <div class="ps-drawer-header">
            <div class="ps-drawer-title-group">
              <span class="ps-drawer-title">Parallèles · ${this.escapeHtml(vPar.title_fr)}</span>
              <span class="ps-badge ps-badge-neutral">${this.escapeHtml(vPar.tradition_type || 'Synopse')}</span>
            </div>
            <button type="button" class="ps-btn-xs ps-btn-accent btn-open-gospel-synopsis" data-pericope-id="${vPar.pericope_id}" title="Ouvrir le tableau synoptique complet">
              <span>Voir la synopse complète ➔</span>
            </button>
          </div>
          <div class="ps-drawer-grid">
            ${vPar.items.map(item => `
              <div class="ps-drawer-item">
                <div class="ps-drawer-item-header">
                  <span class="ps-drawer-item-ref">${this.escapeHtml(item.french_book)} (${item.abbr}) ${this.escapeHtml(item.ref.replace(item.book + ' ', ''))}</span>
                  <span class="ps-drawer-item-badge">${this.escapeHtml(mainVersion)}</span>
                </div>
                <div class="ps-drawer-item-text">${this.escapeHtml(item.text || 'Texte non disponible')}</div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : '';

      html += `
        <div class="ps-verse-row" data-verse-key="${v.key}">
          <span class="ps-verse-num">${v.chapter}:${v.verse}</span>
          <span class="ps-verse-text">${this.escapeHtml(v.text)}</span>
          ${parBadgeHtml}
        </div>
        ${drawerHtml}
      `;
    });

    html += `
        </div>

        <!-- Panneau d'Harmonie des Évangiles (Niveau 2) -->
        ${hasGospelSyn ? `
          <div class="ps-gospel-synopsis-panel hidden" id="ps-gospel-synopsis-panel">
            <!-- Injecté dynamiquement par renderGospelSynopsisView() -->
          </div>
        ` : ''}

        <!-- Panneau de comparaison synoptique multi-traductions escamotable -->
        <div class="ps-synoptic-panel hidden" id="ps-synoptic-panel">
          <div class="ps-synoptic-header">
            <div class="ps-synoptic-header-left">
              <div class="ps-synoptic-title">Comparaison des versions & traductions</div>
              <div class="ps-synoptic-diff-controls">
                <button type="button" class="ps-diff-toggle-btn ${this.diffOptions.enabled ? 'active' : ''}" id="btn-ps-toggle-diff" title="Activer / désactiver la mise en valeur des variantes">
                  <span class="ps-icon-slot">${this.ICONS.layers}</span>
                  <span>Variantes textuelles</span>
                </button>
                <label class="ps-diff-checkbox-label" title="Afficher les mots ajoutés / spécifiques à la traduction">
                  <input type="checkbox" id="ps-chk-diff-added" ${this.diffOptions.showAdded ? 'checked' : ''} ${!this.diffOptions.enabled ? 'disabled' : ''}>
                  <span class="ps-diff-legend-pill ps-diff-added-pill">+ Mots en plus</span>
                </label>
                <label class="ps-diff-checkbox-label" title="Afficher les mots absents par rapport à la version de référence">
                  <input type="checkbox" id="ps-chk-diff-removed" ${this.diffOptions.showRemoved ? 'checked' : ''} ${!this.diffOptions.enabled ? 'disabled' : ''}>
                  <span class="ps-diff-legend-pill ps-diff-removed-pill">- Mots en moins</span>
                </label>
              </div>
            </div>

            <div class="ps-synoptic-selector-group">
              <label for="ps-synoptic-ver2-select" style="font-size: 11.5px; opacity: 0.8;">Version 2 :</label>
              <select id="ps-synoptic-ver2-select" class="ps-select-sm">
                ${this.buildCategorizedVersionOptions(availableVersions, mainVersion, sc.versions_metadata || {}, false)}
              </select>
              <label for="ps-synoptic-ver3-select" style="font-size: 11.5px; opacity: 0.8; margin-left: 8px;">Version 3 :</label>
              <select id="ps-synoptic-ver3-select" class="ps-select-sm">
                ${this.buildCategorizedVersionOptions(availableVersions, mainVersion, sc.versions_metadata || {}, true)}
              </select>
            </div>
          </div>

          <!-- Suggestions de comparaison méthodologiques fondées sur les catégories -->
          ${(sc.comparison_presets && sc.comparison_presets.length > 0) ? `
            <div class="ps-synoptic-suggestions-bar">
              <div class="ps-suggestions-header">
                <span class="ps-suggestions-badge">
                  <span class="ps-icon-slot">${this.ICONS.sparkles}</span>
                  <span>Suggestions de comparaison</span>
                </span>
                <span class="ps-suggestions-hint">Basées sur la typologie des traductions (Littérales, Dynamiques, Confessionnelles)</span>
              </div>
              <div class="ps-synoptic-preset-pills">
                ${sc.comparison_presets.map(p => `
                  <button type="button" class="ps-preset-pill" data-v2="${p.v2 || ''}" data-v3="${p.v3 || ''}" title="${this.escapeHtml(p.description || '')}">
                    <span class="ps-preset-pill-badge">${this.escapeHtml(p.badge || 'Preset')}</span>
                    <span class="ps-preset-pill-name">${this.escapeHtml(p.label)}</span>
                  </button>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <div class="ps-synoptic-table-wrap" id="ps-synoptic-table-container">
            <!-- Rendu dynamique de la table synoptique -->
          </div>
        </div>
      </div>
    `;

    this.scriptureContainerEl.innerHTML = html;

    // Événements
    document.getElementById('btn-ps-copy-text')?.addEventListener('click', (e) => {
      const fullTxt = verses.map(v => `${v.chapter}:${v.verse} ${v.text}`).join('\n');
      navigator.clipboard.writeText(fullTxt);
      const btn = e.currentTarget;
      const slot = btn.querySelector('.ps-icon-slot');
      if (slot) slot.innerHTML = this.ICONS.check;
      setTimeout(() => { if (slot) slot.innerHTML = this.ICONS.copy; }, 1800);
    });

    // 1. Bouton Comparer les versions
    const synPanel = document.getElementById('ps-synoptic-panel');
    const btnToggleSyn = document.getElementById('btn-ps-toggle-synoptic');
    btnToggleSyn?.addEventListener('click', () => {
      synPanel?.classList.toggle('hidden');
      if (!synPanel?.classList.contains('hidden')) {
        this.renderSynopticTable();
      }
    });

    // 2. Bouton Harmonie des Évangiles (Vue Synopse Plein Écran)
    const gospelPanel = document.getElementById('ps-gospel-synopsis-panel');
    const btnToggleGospelSyn = document.getElementById('btn-ps-toggle-gospel-synopsis');
    btnToggleGospelSyn?.addEventListener('click', () => {
      gospelPanel?.classList.toggle('hidden');
      const isOpen = !gospelPanel?.classList.contains('hidden');
      btnToggleGospelSyn.classList.toggle('active', isOpen);
      if (isOpen) {
        this.renderGospelSynopsisView();
        gospelPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });

    // 3. Clic sur les badges de parallèles (Niveau 1 : Tiroir accordéon)
    document.querySelectorAll('.ps-parallel-badge').forEach(badge => {
      badge.addEventListener('click', (e) => {
        e.stopPropagation();
        const vKey = badge.dataset.verseKey;
        const drawer = document.getElementById(`ps-drawer-${vKey.replace(':', '-')}`);
        if (drawer) {
          drawer.classList.toggle('hidden');
          badge.classList.toggle('active', !drawer.classList.contains('hidden'));
        }
      });
    });

    // 4. Clic sur "Voir la synopse complète" à l'intérieur du tiroir accordéon
    document.querySelectorAll('.btn-open-gospel-synopsis').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const pid = parseInt(btn.dataset.pericopeId);
        const gPanel = document.getElementById('ps-gospel-synopsis-panel');
        const gBtn = document.getElementById('btn-ps-toggle-gospel-synopsis');
        if (gPanel) {
          gPanel.classList.remove('hidden');
          if (gBtn) gBtn.classList.add('active');
          this.switchSynopsisPericope(pid);
          gPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });

    document.getElementById('ps-synoptic-ver2-select')?.addEventListener('change', () => {
      document.querySelectorAll('.ps-preset-pill').forEach(b => b.classList.remove('active'));
      this.renderSynopticTable();
    });
    document.getElementById('ps-synoptic-ver3-select')?.addEventListener('change', () => {
      document.querySelectorAll('.ps-preset-pill').forEach(b => b.classList.remove('active'));
      this.renderSynopticTable();
    });

    // Clic sur les suggestions de comparaison (presets)
    document.querySelectorAll('.ps-preset-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        const v2 = pill.dataset.v2;
        const v3 = pill.dataset.v3;
        const sel2 = document.getElementById('ps-synoptic-ver2-select');
        const sel3 = document.getElementById('ps-synoptic-ver3-select');

        if (sel2 && v2) sel2.value = v2;
        if (sel3) sel3.value = v3 || '';

        document.querySelectorAll('.ps-preset-pill').forEach(b => b.classList.remove('active'));
        pill.classList.add('active');

        this.renderSynopticTable();
      });
    });

    // Événements pour le surlignage des variantes
    document.getElementById('btn-ps-toggle-diff')?.addEventListener('click', (e) => {
      this.diffOptions.enabled = !this.diffOptions.enabled;
      e.currentTarget.classList.toggle('active', this.diffOptions.enabled);
      
      const chkAdd = document.getElementById('ps-chk-diff-added');
      const chkDel = document.getElementById('ps-chk-diff-removed');
      if (chkAdd) chkAdd.disabled = !this.diffOptions.enabled;
      if (chkDel) chkDel.disabled = !this.diffOptions.enabled;

      this.renderSynopticTable();
    });

    document.getElementById('ps-chk-diff-added')?.addEventListener('change', (e) => {
      this.diffOptions.showAdded = e.target.checked;
      this.renderSynopticTable();
    });

    document.getElementById('ps-chk-diff-removed')?.addEventListener('change', (e) => {
      this.diffOptions.showRemoved = e.target.checked;
      this.renderSynopticTable();
    });
  },

  buildCategorizedVersionOptions(availableVersions, mainVersion, metaMap, allowEmpty = false) {
    let html = allowEmpty ? '<option value="">(Aucune)</option>' : '';

    const familyOrder = [
      'Famille Segond',
      'Protestante',
      'Évangélique',
      'Catholique',
      'Œcuménique ou Interconfessionnelle',
      'Libérale',
      'Autre'
    ];

    const groups = {};
    availableVersions.forEach(v => {
      if (v === mainVersion && !allowEmpty) return;
      const meta = metaMap[v] || { code: v, nom_officiel: v, famille: 'Autre', philosophie: '' };
      const fam = meta.famille || 'Autre';
      if (!groups[fam]) groups[fam] = [];
      groups[fam].push({ code: v, meta });
    });

    const allFamKeys = Object.keys(groups).sort((a, b) => {
      const idxA = familyOrder.indexOf(a);
      const idxB = familyOrder.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });

    allFamKeys.forEach(fam => {
      const items = groups[fam];
      if (!items || items.length === 0) return;
      html += `<optgroup label="${this.escapeHtml(fam)}">`;
      items.forEach(({ code, meta }) => {
        const philTxt = meta.philosophie ? ` — ${meta.philosophie}` : '';
        const titleTxt = `${meta.nom_officiel}${philTxt}`;
        html += `<option value="${code}" title="${this.escapeHtml(titleTxt)}">${code} · ${this.escapeHtml(meta.nom_officiel)}</option>`;
      });
      html += `</optgroup>`;
    });

    return html;
  },

  tokenizeWords(text) {
    if (!text) return [];
    const regex = /([a-zA-ZÀ-ÿ0-9'’]+|[^a-zA-ZÀ-ÿ0-9'’\s]+|\s+)/g;
    const tokens = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
      if (match[0].length > 0) {
        tokens.push(match[0]);
      }
    }
    return tokens;
  },

  computeWordDiff(refText, compText, showAdded = true, showRemoved = true) {
    if (!refText) return this.escapeHtml(compText);
    if (!compText) return '';

    const refTokens = this.tokenizeWords(refText);
    const compTokens = this.tokenizeWords(compText);

    const isWord = t => /[a-zA-ZÀ-ÿ0-9]/.test(t);
    const cleanWord = w => w.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/['’]/g, '');

    const N = refTokens.length;
    const M = compTokens.length;
    const dp = Array.from({ length: N + 1 }, () => new Uint16Array(M + 1));

    for (let i = 0; i < N; i++) {
      const rTok = refTokens[i];
      const rIsW = isWord(rTok);
      const rNorm = cleanWord(rTok);

      for (let j = 0; j < M; j++) {
        const cTok = compTokens[j];
        const cIsW = isWord(cTok);
        const cNorm = cleanWord(cTok);

        let match = false;
        if (rIsW && cIsW) {
          match = (rNorm === cNorm);
        } else if (!rIsW && !cIsW) {
          match = (rTok.trim() === cTok.trim());
        }

        if (match) {
          dp[i + 1][j + 1] = dp[i][j] + 1;
        } else {
          dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
        }
      }
    }

    let i = N, j = M;
    const diffComp = [];

    while (i > 0 || j > 0) {
      if (i > 0 && j > 0) {
        const rTok = refTokens[i - 1];
        const cTok = compTokens[j - 1];
        const rIsW = isWord(rTok);
        const cIsW = isWord(cTok);
        const match = (rIsW && cIsW && cleanWord(rTok) === cleanWord(cTok)) ||
                      (!rIsW && !cIsW && rTok.trim() === cTok.trim());

        if (match) {
          diffComp.unshift({ type: 'same', text: cTok });
          i--;
          j--;
          continue;
        }
      }

      if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        diffComp.unshift({ type: 'added', text: compTokens[j - 1] });
        j--;
      } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
        if (isWord(refTokens[i - 1]) && showRemoved) {
          diffComp.unshift({ type: 'removed', text: refTokens[i - 1] });
        }
        i--;
      }
    }

    let html = '';
    for (const item of diffComp) {
      if (item.type === 'same') {
        html += this.escapeHtml(item.text);
      } else if (item.type === 'added') {
        if (isWord(item.text) && showAdded) {
          html += `<span class="ps-diff-added" title="Mot spécifique / ajouté dans cette version">${this.escapeHtml(item.text)}</span>`;
        } else {
          html += this.escapeHtml(item.text);
        }
      } else if (item.type === 'removed') {
        if (showRemoved) {
          html += `<span class="ps-diff-removed" title="Mot absent de cette version (présent dans ${this.currentData?.scripture?.main_version || 'la référence'})">${this.escapeHtml(item.text)}</span>`;
        }
      }
    }
    return html;
  },

  renderSynopticTable() {
    const sc = this.currentData?.scripture;
    if (!sc) return;
    const container = document.getElementById('ps-synoptic-table-container');
    if (!container) return;

    const mainVersion = sc.main_version || 'LSG';
    const metaMap = sc.versions_metadata || {};
    const sel2 = document.getElementById('ps-synoptic-ver2-select');
    const sel3 = document.getElementById('ps-synoptic-ver3-select');
    const v2Name = sel2 ? sel2.value : '';
    const v3Name = sel3 ? sel3.value : '';

    const matrix = sc.synoptic_matrix || [];

    const mainMeta = metaMap[mainVersion] || {};
    const v2Meta = metaMap[v2Name] || {};
    const v3Meta = metaMap[v3Name] || {};

    let html = `
      <table class="ps-synoptic-table">
        <thead>
          <tr>
            <th style="width: 50px; text-align: center;">Verset</th>
            <th style="width: 32%;">
              <div class="ps-th-code">${mainVersion} <span class="ps-th-badge">Référence</span></div>
              <div class="ps-th-meta">${this.escapeHtml(mainMeta.nom_officiel || mainVersion)}${mainMeta.philosophie ? ' · ' + this.escapeHtml(mainMeta.philosophie) : ''}</div>
            </th>
            ${v2Name ? `
              <th style="width: 32%;">
                <div class="ps-th-code">${v2Name}</div>
                <div class="ps-th-meta">${this.escapeHtml(v2Meta.nom_officiel || v2Name)}${v2Meta.philosophie ? ' · ' + this.escapeHtml(v2Meta.philosophie) : ''}</div>
              </th>
            ` : ''}
            ${v3Name ? `
              <th style="width: 32%;">
                <div class="ps-th-code">${v3Name}</div>
                <div class="ps-th-meta">${this.escapeHtml(v3Meta.nom_officiel || v3Name)}${v3Meta.philosophie ? ' · ' + this.escapeHtml(v3Meta.philosophie) : ''}</div>
              </th>
            ` : ''}
          </tr>
        </thead>
        <tbody>
    `;

    matrix.forEach(row => {
      const t1 = row.versions[mainVersion] || '';
      const t2 = v2Name ? (row.versions[v2Name] || '') : '';
      const t3 = v3Name ? (row.versions[v3Name] || '') : '';

      const cell2Html = (v2Name && this.diffOptions.enabled) 
        ? this.computeWordDiff(t1, t2, this.diffOptions.showAdded, this.diffOptions.showRemoved)
        : this.escapeHtml(t2);

      const cell3Html = (v3Name && this.diffOptions.enabled)
        ? this.computeWordDiff(t1, t3, this.diffOptions.showAdded, this.diffOptions.showRemoved)
        : this.escapeHtml(t3);

      html += `
        <tr>
          <td class="ps-syn-cell-v">${row.chapter}:${row.verse}</td>
          <td class="ps-syn-cell-txt ps-syn-cell-ref">${this.escapeHtml(t1)}</td>
          ${v2Name ? `<td class="ps-syn-cell-txt">${cell2Html}</td>` : ''}
          ${v3Name ? `<td class="ps-syn-cell-txt">${cell3Html}</td>` : ''}
        </tr>
      `;
    });

    html += `
        </tbody>
      </table>
    `;

    container.innerHTML = html;
  },

  // =========================================================================
  // 1.1 VUE SYNOPSE DES 4 ÉVANGILES (HARMONIE COMPLÈTE & DIFFING DES ACCORDS)
  // =========================================================================
  async switchSynopsisPericope(pericopeId) {
    if (!pericopeId) return;
    this.gospelSynopsisState.activePericopeId = pericopeId;
    const activeBible = (typeof BibleReader !== 'undefined' && BibleReader.currentBible) || 'LSG';
    const res = await API.getSynopticHarmony(pericopeId, activeBible, this.gospelSynopsisState.pivotBook);
    if (res && res.success && res.matrix) {
      this.renderGospelSynopsisView(res.matrix);
    }
  },

  async switchSynopsisPivot(pivotBook) {
    if (!pivotBook) return;
    this.gospelSynopsisState.pivotBook = pivotBook;
    const pid = this.gospelSynopsisState.activePericopeId || this.currentData?.gospel_synopsis?.primary_pericope_id;
    const activeBible = (typeof BibleReader !== 'undefined' && BibleReader.currentBible) || 'LSG';
    const res = await API.getSynopticHarmony(pid, activeBible, pivotBook);
    if (res && res.success && res.matrix) {
      this.renderGospelSynopsisView(res.matrix);
    }
  },

  renderGospelSynopsisView(customMatrix = null) {
    const container = document.getElementById('ps-gospel-synopsis-panel');
    if (!container) return;

    const synData = this.currentData?.gospel_synopsis;
    if (!synData || !synData.has_synoptic) return;

    const matrix = customMatrix || synData.synopsis_matrix;
    if (!matrix) {
      container.innerHTML = `<div class="ps-card ps-empty-card"><p>Aucune harmonie synoptique trouvée pour ce passage.</p></div>`;
      return;
    }

    const pericopes = synData.pericopes || [];
    const activePid = this.gospelSynopsisState.activePericopeId || matrix.pericope_id;
    const pivot = this.gospelSynopsisState.pivotBook || matrix.pivot_book || 'MAT';
    const colLangs = this.gospelSynopsisState.colLangs || { MAT: 'fr', MRK: 'fr', LUK: 'fr', JHN: 'fr' };
    const diffEnabled = this.gospelSynopsisState.diffEnabled;

    const traditionLabels = {
      triple: "Tradition Triple (Mt // Mc // Lc)",
      quadruple: "Tradition Quadruple (Mt // Mc // Lc // Jn)",
      double_q: "Tradition Double / Source Q (Mt // Lc)",
      double: "Tradition Double",
      sondergut_mat: "Propre à Matthieu (Sondergut)",
      sondergut_mrk: "Propre à Marc (Sondergut)",
      sondergut_luk: "Propre à Luc (Sondergut)",
      sondergut_jhn: "Propre à Jean (Sondergut)",
      single: "Récit Unique"
    };

    const tradClass = `ps-tradition-${matrix.tradition_type || 'single'}`;
    const tradLabel = traditionLabels[matrix.tradition_type] || matrix.tradition_type;

    let html = `
      <div class="ps-gospel-synopsis-toolbar">
        <div class="ps-synopsis-toolbar-left">
          <div class="ps-synopsis-pericope-select-group">
            <label for="ps-synopsis-pericope-select" style="font-size: 11.5px; opacity: 0.8; font-weight: 600;">Péricope :</label>
            <select id="ps-synopsis-pericope-select" class="ps-select-sm" style="max-width: 320px;">
              ${pericopes.map(p => `
                <option value="${p.id}" ${p.id === activePid ? 'selected' : ''}>#${p.id} · ${this.escapeHtml(p.title_fr)}</option>
              `).join('')}
            </select>
          </div>
          <span class="ps-synopsis-tradition-badge ${tradClass}">${this.escapeHtml(tradLabel)}</span>
        </div>

        <div class="ps-synoptic-diff-controls">
          <button type="button" class="ps-diff-toggle-btn ${diffEnabled ? 'active' : ''}" id="btn-ps-toggle-gospel-diff" title="Mettre en valeur les mots partagés par les évangélistes">
            <span class="ps-icon-slot">${this.ICONS.layers}</span>
            <span>Accords synoptiques</span>
          </button>
          <span class="ps-diff-legend-pill" style="background: rgba(6,182,212,0.18); color:#06b6d4; border: 1px solid rgba(6,182,212,0.35);">Triple (3+)</span>
          <span class="ps-diff-legend-pill" style="background: rgba(245,158,11,0.18); color:#f59e0b; border: 1px solid rgba(245,158,11,0.35);">Double (2)</span>
        </div>
      </div>

      <div class="ps-gospel-synopsis-table-wrap">
        <table class="ps-gospel-synopsis-table">
          <thead>
            <tr>
              ${matrix.columns.map(col => {
                const isPivot = col.book === pivot;
                const lang = colLangs[col.book] || 'fr';
                const colWidth = (100 / matrix.columns.length).toFixed(1) + '%';
                return `
                  <th style="width: ${colWidth};" class="${isPivot ? 'ps-syn-th-pivot' : ''}">
                    <div class="ps-syn-col-header-box">
                      <div class="ps-syn-col-header-top">
                        <div class="ps-syn-book-name">
                          <span>${this.escapeHtml(col.french_name)}</span>
                          ${isPivot ? `<span class="ps-syn-pivot-badge">Pivot</span>` : ''}
                        </div>
                        <div class="ps-syn-col-controls">
                          <button type="button" class="ps-btn-pivot ${isPivot ? 'active' : ''}" data-pivot-book="${col.book}" title="Faire de cet évangile le pivot chronologique">
                            <span>Pivot</span>
                          </button>
                          <div class="ps-col-lang-toggle" data-col-book="${col.book}">
                            <button type="button" class="ps-lang-btn ${lang === 'fr' ? 'active' : ''}" data-lang="fr">FR</button>
                            <button type="button" class="ps-lang-btn ${lang === 'gr' ? 'active' : ''}" data-lang="gr">GR</button>
                          </div>
                        </div>
                      </div>
                      <div class="ps-syn-col-ref">${this.escapeHtml(col.ref || '')}</div>
                    </div>
                  </th>
                `;
              }).join('')}
            </tr>
          </thead>
          <tbody>
    `;

    matrix.rows.forEach(row => {
      const renderedCells = this.renderSynopticRowCells(row.cells, matrix.columns, colLangs, diffEnabled);
      html += `<tr>${renderedCells}</tr>`;
    });

    html += `
          </tbody>
        </table>
      </div>
    `;

    container.innerHTML = html;

    // Attach events
    document.getElementById('ps-synopsis-pericope-select')?.addEventListener('change', (e) => {
      const pid = parseInt(e.target.value);
      this.switchSynopsisPericope(pid);
    });

    document.getElementById('btn-ps-toggle-gospel-diff')?.addEventListener('click', () => {
      this.gospelSynopsisState.diffEnabled = !this.gospelSynopsisState.diffEnabled;
      this.renderGospelSynopsisView();
    });

    document.querySelectorAll('.ps-btn-pivot').forEach(btn => {
      btn.addEventListener('click', () => {
        const bCode = btn.dataset.pivotBook;
        if (bCode) this.switchSynopsisPivot(bCode);
      });
    });

    document.querySelectorAll('.ps-col-lang-toggle .ps-lang-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const parent = btn.closest('.ps-col-lang-toggle');
        const bCode = parent?.dataset.colBook;
        const targetLang = btn.dataset.lang;
        if (bCode && targetLang) {
          this.gospelSynopsisState.colLangs[bCode] = targetLang;
          this.renderGospelSynopsisView();
        }
      });
    });
  },

  renderSynopticRowCells(cells, columns, colLangs, diffEnabled) {
    const cleanWord = w => w.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/['’]/g, '');
    const isWord = t => /[a-zA-ZÀ-ÿ0-9\u0370-\u03FF\u1F00-\u1FFF]/.test(t);

    // 1. Collect tokens per column
    const colTokensMap = {};
    const wordOccurrences = {};

    columns.forEach(col => {
      const bCode = col.book;
      const cell = cells[bCode];
      if (!cell || cell.is_empty) {
        colTokensMap[bCode] = null;
        return;
      }
      const lang = colLangs[bCode] || 'fr';
      const rawText = (lang === 'gr') ? (cell.text_gr || cell.text_fr) : cell.text_fr;
      const tokens = this.tokenizeWords(rawText);
      colTokensMap[bCode] = { tokens, cell, lang };

      tokens.forEach(tok => {
        if (isWord(tok)) {
          const norm = cleanWord(tok);
          if (norm.length > 2 || (lang === 'gr' && norm.length >= 2)) {
            if (!wordOccurrences[norm]) wordOccurrences[norm] = new Set();
            wordOccurrences[norm].add(bCode);
          }
        }
      });
    });

    // 2. Render HTML for each cell
    let html = '';
    columns.forEach(col => {
      const bCode = col.book;
      const cellData = colTokensMap[bCode];
      if (!cellData || !cellData.cell || cellData.cell.is_empty) {
        html += `<td class="ps-syn-cell-empty"><span class="ps-cell-empty-dash">—</span></td>`;
        return;
      }

      const { tokens, cell, lang } = cellData;
      let cellTextHtml = '';

      if (!diffEnabled) {
        cellTextHtml = this.escapeHtml(tokens.join(''));
      } else {
        tokens.forEach(tok => {
          if (isWord(tok)) {
            const norm = cleanWord(tok);
            const count = wordOccurrences[norm] ? wordOccurrences[norm].size : 0;
            if (count >= 3) {
              cellTextHtml += `<span class="ps-diff-triple" title="Accord triple (partagé par ${count} évangiles)">${this.escapeHtml(tok)}</span>`;
            } else if (count === 2) {
              cellTextHtml += `<span class="ps-diff-double" title="Accord double (partagé par 2 évangiles)">${this.escapeHtml(tok)}</span>`;
            } else {
              cellTextHtml += this.escapeHtml(tok);
            }
          } else {
            cellTextHtml += this.escapeHtml(tok);
          }
        });
      }

      const fontClass = (lang === 'gr') ? 'greek-font' : '';
      html += `
        <td class="ps-synopsis-td ${fontClass}">
          <span class="ps-syn-cell-vnum">${this.escapeHtml(cell.ref || '')}</span>
          <span>${cellTextHtml}</span>
        </td>
      `;
    });

    return html;
  },

  // =========================================================================
  // 2. SECTION TEXTE ORIGINAL INTÉGRAL (HÉBREU WLC / GREC NA28/SBLGNT)
  // =========================================================================
  renderOriginalLanguage() {
    const orig = this.currentData?.original_language;
    if (!orig || !this.originalContainerEl) return;

    if (!orig.available) {
      this.originalContainerEl.innerHTML = `
        <div class="ps-card ps-empty-card">
          <span class="ps-card-icon">${this.ICONS.scroll}</span>
          <p>${orig.reason || "Données originales non disponibles pour ce passage."}</p>
        </div>
      `;
      return;
    }

    const isRtl = orig.is_rtl;
    const langName = orig.language;
    const totalWords = orig.total_words_count || 0;
    const keyLemmas = orig.key_lemmas || [];
    const verses = orig.verses || [];

    let html = `
      <div class="ps-card ps-original-card ${isRtl ? 'is-rtl-mode' : ''}">
        <div class="ps-card-header">
          <div class="ps-card-title-group">
            <span class="ps-card-icon">${this.ICONS.scroll}</span>
            <div>
              <h3 class="ps-card-title">${langName}</h3>
              <div class="ps-card-subtitle">${totalWords} mots originaux répertoriés</div>
            </div>
          </div>
          
          <div class="ps-orig-view-switches">
            <button type="button" class="ps-orig-switch-btn ${this.activeOrigMode === 'continuous' ? 'active' : ''}" data-orig-mode="continuous" title="Lecture continue en grand format">
              <span class="ps-icon-slot">${this.ICONS.bookOpen}</span>
              <span>Texte Continu</span>
            </button>
            <button type="button" class="ps-orig-switch-btn ${this.activeOrigMode === 'interlinear' ? 'active' : ''}" data-orig-mode="interlinear" title="Analyse morphologique mot-à-mot">
              <span class="ps-icon-slot">${this.ICONS.list}</span>
              <span>Interlinéaire Mot-à-Mot</span>
            </button>
            <button type="button" class="ps-orig-switch-btn ${this.activeOrigMode === 'lemmas' ? 'active' : ''}" data-orig-mode="lemmas" title="Vocabulaire clé et lemmes majeurs">
              <span class="ps-icon-slot">${this.ICONS.compass}</span>
              <span>Vocabulaire Clé (${keyLemmas.length})</span>
            </button>
          </div>
        </div>

        <div class="ps-orig-content-area">
          <!-- 1. VUE CONTINUE -->
          <div class="ps-orig-panel ${this.activeOrigMode === 'continuous' ? 'active' : ''}" id="ps-orig-panel-continuous">
            <div class="ps-orig-continuous-box ${isRtl ? 'dir-rtl hebrew-font' : 'dir-ltr greek-font'}">
              ${verses.map(v => `
                <span class="ps-orig-cont-verse" title="Verset ${v.chapter}:${v.verse}">
                  <sup class="ps-orig-cont-num">(${v.verse})</sup> ${this.escapeHtml(v.original_text)}
                </span>
              `).join(' ')}
            </div>
            ${this.showTranslit ? `
              <div class="ps-orig-translit-box">
                <div class="ps-orig-translit-title">Translittération phonétique :</div>
                <p class="ps-orig-translit-p">
                  ${verses.map(v => `<span class="ps-translit-verse"><strong style="opacity:0.6;">(${v.verse})</strong> ${this.escapeHtml(v.transliteration)}</span>`).join(' ')}
                </p>
              </div>
            ` : ''}
          </div>

          <!-- 2. VUE INTERLINÉAIRE MOT-À-MOT -->
          <div class="ps-orig-panel ${this.activeOrigMode === 'interlinear' ? 'active' : ''}" id="ps-orig-panel-interlinear">
            <div class="ps-interlinear-flow">
              ${verses.map(v => `
                <div class="ps-il-verse-section">
                  <div class="ps-il-verse-banner">
                    <span class="ps-il-verse-badge">${v.chapter}:${v.verse}</span>
                    <span class="ps-il-verse-fr">${this.escapeHtml(v.french_text)}</span>
                  </div>
                  <div class="ps-il-words-grid ${isRtl ? 'dir-rtl' : 'dir-ltr'}">
                    ${v.words.map(w => `
                      <div class="ps-word-card ${isRtl ? 'rtl-word' : 'ltr-word'}" data-strong="${w.strong}">
                        <div class="ps-w-orig ${isRtl ? 'hebrew-font' : 'greek-font'}">${this.escapeHtml(w.text)}</div>
                        <div class="ps-w-translit">${this.escapeHtml(w.transliteration)}</div>
                        <div class="ps-w-gloss">${this.escapeHtml(w.gloss || '—')}</div>
                        <div class="ps-w-lemma">${this.escapeHtml(w.lemma)}</div>
                        <div class="ps-w-morph" title="${this.escapeHtml(w.morph_desc_fr)}">${this.escapeHtml(w.morph_code)}</div>
                        <button type="button" class="ps-w-strong-pill" data-strong="${w.strong}" title="Consulter dans le Lexique Strong : ${this.escapeHtml(w.strong_def_fr)}">
                          ${w.strong}
                        </button>
                      </div>
                    `).join('')}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- 3. VUE VOCABULAIRE & LEMMES CLÉS -->
          <div class="ps-orig-panel ${this.activeOrigMode === 'lemmas' ? 'active' : ''}" id="ps-orig-panel-lemmas">
            <div class="ps-lemmas-grid">
              ${keyLemmas.map(lem => `
                <div class="ps-lemma-card">
                  <div class="ps-lem-header">
                    <span class="ps-lem-text ${isRtl ? 'hebrew-font' : 'greek-font'}">${this.escapeHtml(lem.lemma)}</span>
                    <span class="ps-lem-strong">${lem.strong}</span>
                  </div>
                  <div class="ps-lem-translit">${this.escapeHtml(lem.transliteration)}</div>
                  <div class="ps-lem-gloss">${this.escapeHtml(lem.gloss)}</div>
                  ${lem.strong_def_fr ? `<div class="ps-lem-def">${this.escapeHtml(lem.strong_def_fr)}</div>` : ''}
                  <div class="ps-lem-footer">
                    <span class="ps-lem-count">${lem.count} occurrence${lem.count > 1 ? 's' : ''}</span>
                    <span class="ps-lem-occ-list">${lem.occurrences.slice(0, 3).map(o => `<code class="ps-occ-pill">${this.escapeHtml(o)}</code>`).join(' ')}</span>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    `;

    this.originalContainerEl.innerHTML = html;

    // Événements pour basculer les sous-vues originales
    document.querySelectorAll('.ps-orig-switch-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.origMode;
        if (mode) {
          this.activeOrigMode = mode;
          document.querySelectorAll('.ps-orig-switch-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');

          document.querySelectorAll('.ps-orig-panel').forEach(p => p.classList.remove('active'));
          document.getElementById(`ps-orig-panel-${mode}`)?.classList.add('active');
        }
      });
    });

    // Clic sur un bouton Strong
    document.querySelectorAll('.ps-w-strong-pill').forEach(pill => {
      pill.addEventListener('click', (e) => {
        e.stopPropagation();
        const code = pill.dataset.strong;
        if (code && typeof DictView !== 'undefined') {
          if (typeof App !== 'undefined') App.switchView('dict');
          setTimeout(() => {
            DictView.searchWord('', code);
          }, 80);
        }
      });
    });
  },

  // =========================================================================
  // 3. SECTION COMMENTAIRES & SYNTHÈSE
  // =========================================================================
  renderCommentaries() {
    const comms = this.currentData?.commentaries;
    if (!comms || !this.commentariesContainerEl) return;

    const authors = comms.by_author || [];
    const totalAuthors = comms.total_authors || 0;

    let html = `
      <div class="ps-card ps-comm-card">
        <div class="ps-card-header">
          <div class="ps-card-title-group">
            <span class="ps-card-icon">${this.ICONS.comment}</span>
            <div>
              <h3 class="ps-card-title">Commentaires Historiques & Exégétiques</h3>
              <div class="ps-card-subtitle">${totalAuthors} auteurs de référence disponibles sur ce passage</div>
            </div>
          </div>
          
          <div class="ps-card-actions">
            <button type="button" class="ps-btn-sm ps-btn-accent" id="btn-ps-generate-synth" title="Générer une synthèse comparative par IA de tous les commentateurs">
              <span class="ps-icon-slot">${this.ICONS.sparkles}</span>
              <span>Synthèse Comparative</span>
            </button>
          </div>
        </div>

        <div class="ps-comm-synth-box hidden" id="ps-comm-synth-box">
          <div class="ps-synth-header">
            <span class="ps-card-icon">${this.ICONS.sparkles}</span>
            <span class="ps-synth-title">Synthèse Comparative des Commentateurs</span>
          </div>
          <div class="ps-synth-content" id="ps-comm-synth-content"></div>
        </div>

        <div class="ps-comm-authors-tabs" id="ps-comm-authors-tabs">
          ${authors.map((a, idx) => `
            <button type="button" class="ps-author-tab ${idx === 0 ? 'active' : ''}" data-author-idx="${idx}">
              ${this.escapeHtml(a.author)}
            </button>
          `).join('')}
        </div>

        <div class="ps-comm-author-content-area" id="ps-comm-author-content-area">
          ${authors.length > 0 ? this.renderAuthorContent(authors[0]) : '<p class="ps-empty-p">Aucun commentaire direct disponible pour ce passage.</p>'}
        </div>
      </div>
    `;

    this.commentariesContainerEl.innerHTML = html;

    // Gestion des onglets auteurs
    document.querySelectorAll('.ps-author-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const idx = parseInt(tab.dataset.authorIdx);
        document.querySelectorAll('.ps-author-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        const area = document.getElementById('ps-comm-author-content-area');
        if (area && authors[idx]) {
          area.innerHTML = this.renderAuthorContent(authors[idx]);
        }
      });
    });

    // Génération de synthèse
    document.getElementById('btn-ps-generate-synth')?.addEventListener('click', () => {
      this.generateCommentarySynthesis();
    });
  },

  renderAuthorContent(authorData) {
    if (!authorData) return '';
    return `
      <div class="ps-author-view">
        <div class="ps-author-meta">
          <h4 class="ps-author-name">${this.escapeHtml(authorData.author)}</h4>
          <span class="ps-author-badge">${authorData.verses_covered} verset${authorData.verses_covered > 1 ? 's' : ''} commenté${authorData.verses_covered > 1 ? 's' : ''}</span>
        </div>
        <div class="ps-author-body markdown-body">
          ${this.formatMarkdownSimple(authorData.full_text)}
        </div>
      </div>
    `;
  },

  async generateCommentarySynthesis() {
    const synthBox = document.getElementById('ps-comm-synth-box');
    const synthContent = document.getElementById('ps-comm-synth-content');
    if (!synthBox || !synthContent) return;

    synthBox.classList.remove('hidden');
    synthContent.innerHTML = `
      <div class="ps-loading-skeleton">
        <div class="ps-skeleton-line" style="width: 80%;"></div>
        <div class="ps-skeleton-line" style="width: 95%;"></div>
        <div class="ps-skeleton-line" style="width: 60%;"></div>
      </div>
    `;

    try {
      const d = this.currentData;
      const res = await API.synthesizeCommentaries(d.book_code, d.start_ch, d.start_v, d.end_v);
      if (res && res.synthesis) {
        synthContent.innerHTML = `<div class="markdown-body">${this.formatMarkdownSimple(res.synthesis)}</div>`;
      } else {
        synthContent.innerHTML = `<p class="ps-error-p">Synthèse non disponible ou aucun commentaire suffisant.</p>`;
      }
    } catch (err) {
      synthContent.innerHTML = `<p class="ps-error-p">Erreur lors de la génération de la synthèse.</p>`;
    }
  },

  // =========================================================================
  // 4. SECTION CONTEXTE HISTORIQUE, DICTIONNAIRES & LIEUX
  // =========================================================================
  renderEncyclopedia() {
    const enc = this.currentData?.encyclopedia;
    if (!enc || !this.encyclopediaContainerEl) return;

    const places = enc.places || [];
    const dicts = enc.dict_entries || [];

    let html = `
      <div class="ps-grid-2col">
        <!-- Lieux géographiques -->
        <div class="ps-card">
          <div class="ps-card-header">
            <div class="ps-card-title-group">
              <span class="ps-card-icon">${this.ICONS.mapPin}</span>
              <h3 class="ps-card-title">Géographie & Lieux Bibliques</h3>
            </div>
            <span class="ps-badge ps-badge-neutral">${places.length} lieu${places.length > 1 ? 'x' : ''}</span>
          </div>
          
          <div class="ps-places-list">
            ${places.length > 0 ? places.map(p => `
              <div class="ps-place-item" data-lat="${p.latitude}" data-lon="${p.longitude}">
                <div class="ps-place-header">
                  <span class="ps-place-name">${this.escapeHtml(p.name)}</span>
                  <span class="ps-place-coords">${p.latitude ? `${p.latitude.toFixed(2)}°, ${p.longitude.toFixed(2)}°` : ''}</span>
                </div>
                ${p.comment ? `<p class="ps-place-desc">${this.escapeHtml(p.comment)}</p>` : ''}
              </div>
            `).join('') : '<p class="ps-empty-p">Aucun lieu géographique spécifique mentionné dans ce passage.</p>'}
          </div>
        </div>

        <!-- Dictionnaires encyclopédiques -->
        <div class="ps-card">
          <div class="ps-card-header">
            <div class="ps-card-title-group">
              <span class="ps-card-icon">${this.ICONS.history}</span>
              <h3 class="ps-card-title">Dictionnaires & Contexte Historique</h3>
            </div>
            <span class="ps-badge ps-badge-neutral">${dicts.length} entrée${dicts.length > 1 ? 's' : ''}</span>
          </div>

          <div class="ps-dict-entries-list">
            ${dicts.length > 0 ? dicts.map(e => `
              <div class="ps-dict-entry-card">
                <div class="ps-dict-entry-header">
                  <span class="ps-dict-entry-title">${this.escapeHtml(e.title)}</span>
                  <span class="ps-dict-badge">${this.escapeHtml(e.dictionary)}</span>
                </div>
                <div class="ps-dict-entry-snippet">${this.escapeHtml(e.snippet)}...</div>
              </div>
            `).join('') : '<p class="ps-empty-p">Consultez la vue Dictionnaires pour explorer les thèmes doctrinaux.</p>'}
          </div>
        </div>
      </div>
    `;

    this.encyclopediaContainerEl.innerHTML = html;
  },

  // =========================================================================
  // 5. ATELIER EXÉGÉTIQUE & HOMILÉTIQUE IA (SANS ÉMOJIS)
  // =========================================================================
  renderAiAtelier() {
    if (!this.aiAtelierContainerEl) return;

    let html = `
      <div class="ps-card ps-ai-card">
        <div class="ps-card-header">
          <div class="ps-card-title-group">
            <span class="ps-card-icon">${this.ICONS.sparkles}</span>
            <div>
              <h3 class="ps-card-title">Atelier Exégétique & Homilétique Assisté par IA</h3>
              <div class="ps-card-subtitle">Analyses approfondies générées avec rigueur académique</div>
            </div>
          </div>
        </div>

        <div class="ps-ai-modes-toolbar">
          <button type="button" class="ps-ai-mode-btn ${this.activeAiInsight === 'structure' ? 'active' : ''}" data-insight="structure">
            <span class="ps-icon-slot">${this.ICONS.layers}</span>
            <span>Structure Littéraire</span>
          </button>
          <button type="button" class="ps-ai-mode-btn ${this.activeAiInsight === 'big_idea' ? 'active' : ''}" data-insight="big_idea">
            <span class="ps-icon-slot">${this.ICONS.compass}</span>
            <span>Idée Maîtresse (Big Idea)</span>
          </button>
          <button type="button" class="ps-ai-mode-btn ${this.activeAiInsight === 'sermon_outline' ? 'active' : ''}" data-insight="sermon_outline">
            <span class="ps-icon-slot">${this.ICONS.scroll}</span>
            <span>Plan de Prédication (3 Points)</span>
          </button>
          <button type="button" class="ps-ai-mode-btn ${this.activeAiInsight === 'study_questions' ? 'active' : ''}" data-insight="study_questions">
            <span class="ps-icon-slot">${this.ICONS.list}</span>
            <span>Questions d'Étude Inductive</span>
          </button>
        </div>

        <div class="ps-ai-insight-content" id="ps-ai-insight-content">
          <!-- Rendu du résultat IA -->
        </div>
      </div>
    `;

    this.aiAtelierContainerEl.innerHTML = html;

    document.querySelectorAll('.ps-ai-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.insight;
        if (type) {
          this.activeAiInsight = type;
          document.querySelectorAll('.ps-ai-mode-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.fetchAiInsight(type);
        }
      });
    });

    this.renderCurrentAiInsight();
  },

  renderCurrentAiInsight() {
    const container = document.getElementById('ps-ai-insight-content');
    if (!container) return;

    const cached = this.aiInsightsCache[this.activeAiInsight];
    if (cached) {
      container.innerHTML = `
        <div class="ps-ai-result-box markdown-body">
          ${this.formatMarkdownSimple(cached)}
        </div>
      `;
    } else {
      container.innerHTML = `
        <div class="ps-ai-prompt-box">
          <p>Cliquez pour générer l'analyse <strong>${this.getInsightLabel(this.activeAiInsight)}</strong> pour ce passage.</p>
          <button type="button" class="ps-btn ps-btn-primary" id="btn-ps-run-ai">
            <span class="ps-icon-slot">${this.ICONS.sparkles}</span>
            <span>Lancer l'analyse</span>
          </button>
        </div>
      `;

      document.getElementById('btn-ps-run-ai')?.addEventListener('click', () => {
        this.fetchAiInsight(this.activeAiInsight);
      });
    }
  },

  async fetchAiInsight(insightType) {
    const container = document.getElementById('ps-ai-insight-content');
    if (!container) return;

    container.innerHTML = `
      <div class="ps-ai-generating-state">
        <div class="ps-loading-skeleton">
          <div class="ps-skeleton-line" style="width: 70%;"></div>
          <div class="ps-skeleton-line" style="width: 90%;"></div>
          <div class="ps-skeleton-line" style="width: 85%;"></div>
          <div class="ps-skeleton-line" style="width: 60%;"></div>
        </div>
        <div class="ps-ai-generating-label">Analyse en cours par le modèle d'IA...</div>
      </div>
    `;

    try {
      const res = await API.generatePassageAIInsight(this.currentReference, insightType);
      if (res && res.success && res.content) {
        this.aiInsightsCache[insightType] = res.content;
        this.renderCurrentAiInsight();
      } else {
        container.innerHTML = `<p class="ps-error-p">Erreur : ${res?.error || "Impossible de générer l'analyse"}</p>`;
      }
    } catch (err) {
      container.innerHTML = `<p class="ps-error-p">Erreur réseau ou d'API lors de la génération.</p>`;
    }
  },

  getInsightLabel(type) {
    const labels = {
      structure: 'Structure Littéraire',
      big_idea: 'Idée Maîtresse & Théologie',
      sermon_outline: 'Plan de Prédication',
      study_questions: "Questions d'Étude Inductive"
    };
    return labels[type] || type;
  },

  // =========================================================================
  // 6. SECTION NOTES PERSONNELLES
  // =========================================================================
  renderNotesSection() {
    if (!this.notesContainerEl) return;
    const existingNotes = this.currentData?.user_data?.notes || [];

    let html = `
      <div class="ps-card ps-notes-card">
        <div class="ps-card-header">
          <div class="ps-card-title-group">
            <span class="ps-card-icon">${this.ICONS.note}</span>
            <h3 class="ps-card-title">Vos Notes Personnelles</h3>
          </div>
          <div class="ps-card-actions">
            <button type="button" class="ps-btn-sm ps-btn-primary" id="btn-ps-save-note">
              <span class="ps-icon-slot">${this.ICONS.check}</span>
              <span>Enregistrer</span>
            </button>
          </div>
        </div>

        <div class="ps-notes-editor-box">
          <textarea id="ps-notes-textarea" class="ps-textarea" placeholder="Rédigez ici vos réflexions, vos observations exégétiques ou votre trame de prédication...">${existingNotes.length > 0 ? existingNotes.map(n => n.content || '').join('\n\n') : ''}</textarea>
        </div>
      </div>
    `;

    this.notesContainerEl.innerHTML = html;

    document.getElementById('btn-ps-save-note')?.addEventListener('click', async () => {
      const txt = document.getElementById('ps-notes-textarea')?.value || '';
      await this.savePersonalNote(txt);
    });
  },

  async savePersonalNote(content) {
    if (!this.currentData) return;
    const d = this.currentData;
    const title = `Étude — ${d.reference}`;

    try {
      await API.call('save_note', {
        title: title,
        content: content,
        book_code: d.book_code,
        chapter: d.start_ch,
        verse: d.start_v,
        tags: ["Guide de Passage", d.french_book]
      });

      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast("Note enregistrée avec succès", "success");
      }
    } catch (e) {
      console.error('Erreur sauvegarde note:', e);
    }
  },

  async exportToNotes() {
    if (!this.currentData) return;
    const userNotes = document.getElementById('ps-notes-textarea')?.value || '';
    
    try {
      const res = await API.exportPassageStudyToNote(this.currentReference, {
        ai_insights: this.aiInsightsCache,
        user_notes: userNotes
      });

      if (res && res.success) {
        if (typeof App !== 'undefined' && App.showToast) {
          App.showToast(res.message || "Dossier d'étude exporté dans vos notes Markdown", "success");
        }
      } else {
        if (typeof App !== 'undefined' && App.showToast) {
          App.showToast(res?.error || "Erreur lors de l'exportation", "error");
        }
      }
    } catch (err) {
      console.error('Erreur export dossier étude:', err);
    }
  },

  // =========================================================================
  // UTILITAIRES & FORMATEURS
  // =========================================================================
  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  formatMarkdownSimple(md) {
    if (!md) return '';
    let text = md;
    // Titres
    text = text.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    text = text.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    text = text.replace(/^# (.*$)/gim, '<h1>$1</h1>');
    // Gras & Italique
    text = text.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');
    text = text.replace(/\*(.*?)\*/gim, '<em>$1</em>');
    // Citations
    text = text.replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>');
    // Listes à puces
    text = text.replace(/^\- (.*$)/gim, '<li>$1</li>');
    text = text.replace(/(<li>.*<\/li>)/gim, '<ul>$1</ul>');
    // Paragraphes
    text = text.replace(/\n\n+/g, '<br><br>');
    return text;
  }
};
