/**
 * Open Shema Store / Data Hub & E-book Finder Modal Controller
 * Hub unique pour :
 * 1. Télécharger les ouvrages officiels et gratuits du catalogue Open Shema Data
 * 2. Trouver et comparer les e-books chrétiens 100% numériques (Bibli'O, BLF Store, Pub. Chrétiennes, Google Play, Fnac, Kobo)
 * RÈGLE STRICTE : 100% icônes SVG, aucun émoji.
 */

const OpenShemaStore = {
  catalogUrl: 'https://raw.githubusercontent.com/Similarly1/open-shema-data/main/catalog.json',
  catalogData: null,
  installedIds: new Set(),
  installedCodes: new Set(),
  activeTab: 'catalog', // 'catalog' | 'ebooks'
  activeCategory: 'all',
  searchQuery: '',
  ebookSearchQuery: '',
  hideInstalled: localStorage.getItem('open_shema_store_hide_installed') === 'true',
  isDownloading: {},
  isSearchingEbooks: false,
  ebookDebounceTimer: null,

  // Icônes SVG standardisées Open Shema
  svgIcons: {
    bible: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M6 6h10"/><path d="M6 10h10"/></svg>`,
    dictionary: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/></svg>`,
    commentary: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
    theology: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`,
    dataset: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"/></svg>`,
    download: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
    check: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    refresh: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>`,
    close: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    sparkle: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
    cloud: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>`,
    search: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>`,
    store: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/><circle cx="12" cy="12" r="2"/></svg>`,
    external: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`,
    digital: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/><path d="m14 9 3 3-3 3"/></svg>`,
    spinner: `<svg class="spin-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`
  },

  init() {
    this._createModalDom();
    this.refreshInstalledCache();
    // Contrôle automatique doux des nouveautés au démarrage
    setTimeout(() => {
      this.checkNewModulesOnStartup();
    }, 2500);
  },

  async refreshInstalledCache() {
    try {
      this.installedIds.clear();
      this.installedCodes.clear();

      try {
        const backendInstalled = await API.call('get_installed_catalog_module_ids');
        if (Array.isArray(backendInstalled)) {
          backendInstalled.forEach(id => {
            if (id) {
              this.installedIds.add(String(id).toLowerCase());
              this.installedCodes.add(String(id).toUpperCase());
            }
          });
        }
      } catch (err) {
        console.warn('Backend get_installed_catalog_module_ids non disponible:', err);
      }

      if (typeof BibleReader !== 'undefined' && BibleReader.installedBibles) {
        BibleReader.installedBibles.forEach(b => {
          if (b.name) this.installedIds.add(b.name.toLowerCase());
          if (b.version_code) this.installedCodes.add(b.version_code.toUpperCase());
          if (b.folder_name) this.installedIds.add(b.folder_name.toLowerCase());
        });
      }

      const books = await API.call('get_library_books') || [];
      books.forEach(b => {
        if (b.name) this.installedIds.add(b.name.toLowerCase());
        if (b.folder_name) this.installedIds.add(b.folder_name.toLowerCase());
        if (b.version_code) this.installedCodes.add(b.version_code.toUpperCase());
        if (b.dict_id) this.installedIds.add(b.dict_id.toLowerCase());
      });
    } catch (err) {
      console.warn('Erreur rafraîchissement cache installés:', err);
    }
  },

  async fetchCatalog() {
    try {
      const response = await fetch(this.catalogUrl, { cache: 'no-cache' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      this.catalogData = await response.json();
      return this.catalogData;
    } catch (err) {
      console.error('Erreur chargement catalogue distant:', err);
      return null;
    }
  },

  async getMissingBiblesCount() {
    if (!this.catalogData) {
      await this.fetchCatalog();
    }
    if (!this.catalogData || !this.catalogData.modules) return 0;

    const bibleModules = this.catalogData.modules.filter(m => m.type === 'bible');
    const installed = (typeof BibleReader !== 'undefined' && Array.isArray(BibleReader.installedBibles) && BibleReader.installedBibles.length > 0)
      ? BibleReader.installedBibles
      : (await API.call('get_installed_bibles') || []);

    let missingCount = 0;

    for (const m of bibleModules) {
      const code = (m.abbreviation || '').toUpperCase();
      const id = (m.id || '').toLowerCase();
      const cleanId = id.replace(/^bible-/, '');

      const isInstalled = installed.some(b => {
        const bName = (b.name || '').toLowerCase();
        const bCode = (b.version_code || '').toUpperCase();
        const bFolder = (b.folder_name || '').toLowerCase();
        const bId = (b.id || '').toLowerCase();
        return (code && bCode === code) || bName === id || bName === cleanId || bFolder === cleanId || bId === cleanId;
      });

      if (!isInstalled) missingCount++;
    }

    return missingCount;
  },

  _isModuleInstalled(module) {
    const id = (module.id || '').toLowerCase();
    const abbr = (module.abbreviation || '').toUpperCase();
    const cleanId = id.replace(/^(bible-|dict-|comm-|theology-|dataset-)/, '');

    if (this.installedIds.has(id) || this.installedIds.has(cleanId)) return true;
    if (abbr && (this.installedCodes.has(abbr) || this.installedIds.has(abbr.toLowerCase()))) return true;

    if (id === 'dataset-bibleproject-fr' && (this.installedIds.has('bibleproject') || this.installedIds.has('dataset-bibleproject-fr') || this.installedIds.has('bp-fr'))) return true;
    if (id === 'bible-lsg-1910' && (this.installedCodes.has('LSG') || this.installedIds.has('lsg'))) return true;
    if (id === 'bible-darby' && (this.installedCodes.has('DARBY') || this.installedCodes.has('DARB') || this.installedIds.has('darby'))) return true;
    if (id === 'dict-strong-fr' && (this.installedIds.has('strong') || this.installedIds.has('dict_strong_fr'))) return true;

    return false;
  },

  _formatBytes(bytes) {
    if (!bytes || bytes <= 0) return '0 Mo';
    const mb = bytes / (1024 * 1024);
    if (mb < 1) {
      const kb = bytes / 1024;
      return `${Math.round(kb)} Ko`;
    }
    return `${mb.toFixed(1)} Mo`;
  },

  _createModalDom() {
    if (document.getElementById('modal-open-shema-store')) return;

    const modal = document.createElement('div');
    modal.id = 'modal-open-shema-store';
    modal.className = 'modal-dialog-container hidden';
    modal.style.position = 'fixed';
    modal.style.inset = '0';
    modal.style.zIndex = '10000';
    modal.style.background = 'rgba(0, 0, 0, 0.72)';
    modal.style.backdropFilter = 'blur(6px)';
    modal.style.display = 'none';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';

    modal.innerHTML = `
      <div class="modal-card store-modal-card" style="width: 980px; max-width: 94vw; height: 86vh; max-height: 800px; display: flex; flex-direction: column; background: var(--bg-card, #1e293b); border-radius: 12px; border: 1px solid var(--border-color, #334155); box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); overflow: hidden; position: relative;">
        
        <!-- Header avec sélecteur d'onglets unifié -->
        <div class="store-modal-header" style="display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; border-bottom: 1px solid var(--border-subtle, #334155); background: var(--bg-surface-elevated, #0f172a);">
          <div style="display: flex; align-items: center; gap: 16px;">
            <div class="store-modal-title-wrap" style="display: flex; align-items: center; gap: 10px;">
              <div class="store-title-icon" style="width: 34px; height: 34px; border-radius: 8px; background: rgba(37, 99, 235, 0.15); color: #3b82f6; display: flex; align-items: center; justify-content: center;">
                ${this.svgIcons.cloud}
              </div>
              <h3 class="store-modal-title" style="font-size: 1.05rem; font-weight: 700; color: var(--text-primary, #f8fafc); margin: 0;">
                Catalogue & Librairies
              </h3>
            </div>

            <!-- Onglets de navigation principaux -->
            <div class="store-nav-tabs" style="display: flex; background: rgba(255,255,255,0.06); padding: 3px; border-radius: 8px; gap: 4px;">
              <button class="store-tab-btn active" data-tab="catalog" style="display: flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 6px; border: none; font-size: 0.82rem; font-weight: 600; cursor: pointer; transition: all 0.2s; background: var(--primary-accent, #2563eb); color: #fff;">
                ${this.svgIcons.bible}
                <span>Catalogue Gratuit Open Shema</span>
              </button>
              <button class="store-tab-btn" data-tab="ebooks" style="display: flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 6px; border: none; font-size: 0.82rem; font-weight: 500; cursor: pointer; transition: all 0.2s; background: transparent; color: var(--text-muted, #94a3b8);">
                ${this.svgIcons.store}
                <span>Trouver en E-book (Librairies)</span>
              </button>
            </div>
          </div>

          <button id="btn-close-store-modal" class="btn-icon-close" style="background: transparent; border: none; color: var(--text-muted, #94a3b8); cursor: pointer; padding: 6px; border-radius: 6px;" title="Fermer">
            ${this.svgIcons.close}
          </button>
        </div>

        <!-- ========================================================= -->
        <!-- VUE ONGLET 1 : CATALOGUE OPEN SHEMA GRATUIT               -->
        <!-- ========================================================= -->
        <div id="store-tab-content-catalog" class="store-tab-pane" style="display: flex; flex-direction: column; flex: 1; min-height: 0;">
          <div class="store-toolbar" style="padding: 12px 20px; border-bottom: 1px solid var(--border-subtle, #334155); background: var(--bg-card, #1e293b);">
            <div class="store-search-wrap" style="position: relative; margin-bottom: 10px;">
              <div style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted, #94a3b8); display: flex;">
                ${this.svgIcons.search}
              </div>
              <input type="text" id="store-search-input" placeholder="Rechercher une version, un livre ou un auteur dans le catalogue gratuit..." autocomplete="off" style="width: 100%; padding: 9px 12px 9px 36px; border-radius: 6px; border: 1px solid var(--border-color, #334155); background: var(--bg-surface-elevated, #0f172a); color: #fff; font-size: 0.88rem; outline: none;">
            </div>

            <div class="store-filters-row" style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
              <div class="store-categories-bar" id="store-categories-bar" style="display: flex; gap: 6px;">
                <button class="store-cat-pill active" data-cat="all">Tous</button>
                <button class="store-cat-pill" data-cat="bibles">Bibles</button>
                <button class="store-cat-pill" data-cat="dictionaries">Dictionnaires</button>
                <button class="store-cat-pill" data-cat="commentaries">Commentaires</button>
                <button class="store-cat-pill" data-cat="theology">Théologie</button>
                <button class="store-cat-pill" data-cat="datasets">Données</button>
              </div>

              <label class="store-hide-installed-toggle" style="display: flex; align-items: center; gap: 6px; font-size: 0.8rem; color: var(--text-muted, #94a3b8); cursor: pointer;" title="Masquer les ouvrages déjà présents dans votre bibliothèque">
                <input type="checkbox" id="store-hide-installed-cb">
                <span class="store-toggle-text">Masquer les installés</span>
              </label>
            </div>
          </div>

          <div class="store-content-body" id="store-cards-container" style="flex: 1; overflow-y: auto; padding: 16px 20px;">
            <div class="store-loading-state" style="text-align: center; padding: 40px; color: var(--text-muted, #94a3b8);">
              ${this.svgIcons.refresh}
              <span style="margin-left: 8px;">Chargement du catalogue officiel...</span>
            </div>
          </div>

          <div class="store-modal-footer" style="padding: 10px 20px; border-top: 1px solid var(--border-subtle, #334155); background: var(--bg-surface-elevated, #0f172a); display: flex; align-items: center; justify-content: space-between; font-size: 0.78rem; color: var(--text-muted, #94a3b8);">
            <div class="store-footer-meta">
              <span>Dépôt officiel gratuit : <a href="https://github.com/Similarly1/open-shema-data" target="_blank" rel="noopener" style="color: #60a5fa; text-decoration: none;">open-shema-data</a></span>
            </div>
            <button id="btn-refresh-store" class="btn-store-secondary" title="Rafraîchir le catalogue" style="display: flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 6px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: #fff; cursor: pointer;">
              ${this.svgIcons.refresh}
              <span>Actualiser</span>
            </button>
          </div>
        </div>

        <!-- ========================================================= -->
        <!-- VUE ONGLET 2 : RECHERCHE D'E-BOOKS CHRÉTIENS NUMÉRIQUES   -->
        <!-- ========================================================= -->
        <div id="store-tab-content-ebooks" class="store-tab-pane" style="display: none; flex-direction: column; flex: 1; min-height: 0;">
          
          <div style="padding: 12px 20px; border-bottom: 1px solid var(--border-subtle, #334155); background: var(--bg-card, #1e293b);">
            <div style="position: relative; display: flex; align-items: center;">
              <div style="position: absolute; left: 12px; color: var(--text-muted, #94a3b8); display: flex;">
                ${this.svgIcons.search}
              </div>
              <input type="text" id="ebook-store-search-input" placeholder="Titre de la Bible ou de l'ouvrage (ex: Nouvelle Français Courant, Segond 21, John Piper, Romains)..." 
                style="width: 100%; padding: 10px 38px 10px 36px; border-radius: 6px; border: 1px solid var(--border-color, #334155); background: var(--bg-surface-elevated, #0f172a); color: #fff; font-size: 0.9rem; outline: none;">
              <button id="btn-clear-ebook-store-search" style="position: absolute; right: 10px; background: none; border: none; color: var(--text-muted, #94a3b8); cursor: pointer; padding: 4px; display: none;" title="Effacer">
                ${this.svgIcons.close}
              </button>
            </div>
            <div id="ebook-store-status" style="margin-top: 8px; font-size: 0.8rem; color: var(--text-muted, #94a3b8); display: flex; align-items: center; justify-content: space-between;">
              <span>Recherchez un e-book chrétien chez Bibli'O, BLF Store, Pub. Chrétiennes, Google Play...</span>
              <span style="font-size: 0.72rem; padding: 1px 7px; border-radius: 10px; background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3);">100% Numérique (EPUB/PDF)</span>
            </div>
          </div>

          <div style="flex: 1; overflow-y: auto; padding: 16px 20px; background: var(--bg-card, #1e293b);">
            
            <!-- Liens directs pré-filtrés 1-clic -->
            <div id="ebook-store-direct-links-section" style="margin-bottom: 16px; display: none;">
              <div style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted, #94a3b8); margin-bottom: 8px; font-weight: 600; display: flex; align-items: center; gap: 6px;">
                ${this.svgIcons.store} Rayons E-books directs en 1 clic
              </div>
              <div id="ebook-store-direct-links-container" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 8px;">
              </div>
            </div>

            <!-- Grille des résultats e-books -->
            <div id="ebook-store-results-container" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 14px;">
              <div style="grid-column: 1 / -1; text-align: center; padding: 50px 20px; color: var(--text-muted, #94a3b8);">
                <div style="display: inline-flex; padding: 14px; border-radius: 50%; background: rgba(255,255,255,0.03); margin-bottom: 10px;">
                  ${this.svgIcons.bible}
                </div>
                <p style="font-size: 0.95rem; margin: 0 0 6px 0; font-weight: 500;">Recherche instantanée d'e-books chrétiens</p>
                <p style="font-size: 0.82rem; margin: 0; opacity: 0.8;">Tapez une version biblique ou un auteur pour comparer les disponibilités et prix numériques.</p>
              </div>
            </div>

          </div>

          <div style="padding: 10px 20px; border-top: 1px solid var(--border-subtle, #334155); background: var(--bg-surface-elevated, #0f172a); display: flex; align-items: center; justify-content: space-between; font-size: 0.78rem; color: var(--text-muted, #94a3b8);">
            <span>Sources : Éditions Bibli'O, BLF Store, Publications Chrétiennes, Google Play, Fnac, Kobo</span>
            <span style="color: #10b981;">Zéro livre papier inclus</span>
          </div>

        </div>

      </div>
    `;

    document.body.appendChild(modal);

    // Événements de fermeture
    modal.querySelector('#btn-close-store-modal').addEventListener('click', () => this.close());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) this.close();
    });

    // Basculement d'onglets principaux (Catalogue vs E-books)
    modal.querySelectorAll('.store-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        this.switchTab(tab);
      });
    });

    // Recherche Catalogue Gratuit
    const searchInput = modal.querySelector('#store-search-input');
    searchInput.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.toLowerCase().trim();
      this.renderCatalog();
    });

    modal.querySelectorAll('.store-cat-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        modal.querySelectorAll('.store-cat-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeCategory = btn.dataset.cat || 'all';
        this.renderCatalog();
      });
    });

    const hideCb = modal.querySelector('#store-hide-installed-cb');
    if (hideCb) {
      hideCb.checked = this.hideInstalled;
      hideCb.addEventListener('change', (e) => {
        this.hideInstalled = e.target.checked;
        localStorage.setItem('open_shema_store_hide_installed', this.hideInstalled ? 'true' : 'false');
        this.renderCatalog();
      });
    }

    modal.querySelector('#btn-refresh-store').addEventListener('click', async () => {
      const btn = modal.querySelector('#btn-refresh-store');
      btn.classList.add('spinning');
      await this.refreshInstalledCache();
      await this.fetchCatalog();
      btn.classList.remove('spinning');
      this.renderCatalog();
    });

    // Recherche E-books chrétiens
    const ebookInput = modal.querySelector('#ebook-store-search-input');
    const clearEbookBtn = modal.querySelector('#btn-clear-ebook-store-search');

    clearEbookBtn.addEventListener('click', () => {
      ebookInput.value = '';
      clearEbookBtn.style.display = 'none';
      ebookInput.focus();
      this.renderEbooksEmptyState();
    });

    ebookInput.addEventListener('input', () => {
      const q = ebookInput.value.trim();
      clearEbookBtn.style.display = q ? 'block' : 'none';
      clearTimeout(this.ebookDebounceTimer);
      if (!q) {
        this.renderEbooksEmptyState();
        return;
      }
      this.ebookDebounceTimer = setTimeout(() => {
        this.searchEbooks(q);
      }, 300);
    });

    ebookInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        clearTimeout(this.ebookDebounceTimer);
        this.searchEbooks(ebookInput.value.trim());
      } else if (e.key === 'Escape') {
        this.close();
      }
    });
  },

  switchTab(tab) {
    this.activeTab = tab;
    const modal = document.getElementById('modal-open-shema-store');
    if (!modal) return;

    modal.querySelectorAll('.store-tab-btn').forEach(b => {
      const isActive = b.dataset.tab === tab;
      b.classList.toggle('active', isActive);
      b.style.background = isActive ? 'var(--primary-accent, #2563eb)' : 'transparent';
      b.style.color = isActive ? '#fff' : 'var(--text-muted, #94a3b8)';
    });

    const catalogPane = modal.querySelector('#store-tab-content-catalog');
    const ebooksPane = modal.querySelector('#store-tab-content-ebooks');

    if (tab === 'catalog') {
      catalogPane.style.display = 'flex';
      ebooksPane.style.display = 'none';
      this.renderCatalog();
      setTimeout(() => modal.querySelector('#store-search-input')?.focus(), 50);
    } else {
      catalogPane.style.display = 'none';
      ebooksPane.style.display = 'flex';
      const ebookInput = modal.querySelector('#ebook-store-search-input');
      setTimeout(() => ebookInput?.focus(), 50);
    }
  },

  async open(initialTab = 'catalog', filterOrQuery = '') {
    this._createModalDom();
    const modal = document.getElementById('modal-open-shema-store');
    if (!modal) return;

    modal.style.display = 'flex';
    modal.classList.remove('hidden');

    if (initialTab === 'ebooks') {
      this.switchTab('ebooks');
      if (filterOrQuery) {
        const input = modal.querySelector('#ebook-store-search-input');
        if (input) {
          input.value = filterOrQuery;
          modal.querySelector('#btn-clear-ebook-store-search').style.display = 'block';
          this.searchEbooks(filterOrQuery);
        }
      }
    } else {
      this.switchTab('catalog');
      if (filterOrQuery) {
        this.activeCategory = filterOrQuery;
        modal.querySelectorAll('.store-cat-pill').forEach(b => {
          b.classList.toggle('active', b.dataset.cat === filterOrQuery);
        });
      }
      await this.refreshInstalledCache();
      if (!this.catalogData) {
        await this.fetchCatalog();
      }
      this.renderCatalog();
    }
  },

  close() {
    const modal = document.getElementById('modal-open-shema-store');
    if (modal) {
      modal.style.display = 'none';
      modal.classList.add('hidden');
    }
  },

  renderCatalog() {
    const container = document.getElementById('store-cards-container');
    if (!container) return;

    if (!this.catalogData || !this.catalogData.modules) {
      container.innerHTML = `
        <div class="store-empty-state">
          <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <p>Impossible de joindre le catalogue distant. Vérifiez votre connexion internet.</p>
        </div>
      `;
      return;
    }

    const modules = this.catalogData.modules.filter(m => {
      if (this.hideInstalled && this._isModuleInstalled(m)) return false;

      if (this.activeCategory !== 'all') {
        if (this.activeCategory === 'bibles' && m.type !== 'bible') return false;
        if (this.activeCategory === 'dictionaries' && m.type !== 'dictionary') return false;
        if (this.activeCategory === 'commentaries' && m.type !== 'commentary') return false;
        if (this.activeCategory === 'theology' && m.type !== 'theology') return false;
        if (this.activeCategory === 'datasets' && m.type !== 'dataset') return false;
      }

      if (this.searchQuery) {
        const title = (m.title || '').toLowerCase();
        const author = (m.author || '').toLowerCase();
        const desc = (m.description || '').toLowerCase();
        const abbr = (m.abbreviation || '').toLowerCase();
        return title.includes(this.searchQuery) || author.includes(this.searchQuery) || desc.includes(this.searchQuery) || abbr.includes(this.searchQuery);
      }
      return true;
    });

    if (modules.length === 0) {
      const isAllInstalled = this.hideInstalled && this.catalogData.modules.some(m => this._isModuleInstalled(m));
      container.innerHTML = `
        <div class="store-empty-state">
          <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.8">
            ${isAllInstalled ? '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>' : '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/>'}
          </svg>
          <p>${isAllInstalled ? 'Tous les ouvrages de cette sélection sont déjà installés dans votre bibliothèque !' : 'Aucun ouvrage ne correspond à votre recherche dans cette catégorie.'}</p>
        </div>
      `;
      return;
    }

    container.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'store-modules-grid';

    modules.forEach(m => {
      const isInstalled = this._isModuleInstalled(m);
      const isDownloading = !!this.isDownloading[m.id];
      const card = document.createElement('div');
      card.className = `store-card ${isInstalled ? 'installed' : ''}`;

      const iconSvg = this.svgIcons[m.type] || this.svgIcons.bible;
      const typeLabel = m.type === 'bible' ? 'Bible' : (m.type === 'dictionary' ? 'Dictionnaire' : (m.type === 'commentary' ? 'Commentaire' : (m.type === 'theology' ? 'Théologie' : 'Données')));
      const hasStrong = (m.features || []).includes('strong') || (m.features || []).includes('strong_ready');

      card.innerHTML = `
        <div class="store-card-header">
          <div class="store-card-type-tag">
            <span class="store-card-type-icon">${iconSvg}</span>
            <span>${typeLabel}</span>
          </div>
          ${hasStrong ? `<span class="store-badge-strong" title="Comprend les codes Strong Hébreu/Grec">${this.svgIcons.sparkle} Strong</span>` : ''}
          <span class="store-badge-size">${this._formatBytes(m.size_bytes)}</span>
        </div>

        <div class="store-card-body">
          ${m.cover_url ? `
            <div class="store-card-cover-container">
              <img src="${m.cover_url}" class="store-card-cover-img" alt="${m.title}" loading="lazy" />
            </div>
          ` : ''}
          <div class="store-card-info-container">
            <h4 class="store-card-title">${m.title}</h4>
            <div class="store-card-author">${m.author || 'Domaine Public'}</div>
            <p class="store-card-desc">${m.description || ''}</p>
          </div>
        </div>

        <div class="store-card-footer">
          <div class="store-card-code-badge">${m.abbreviation || m.id.toUpperCase()}</div>
          
          ${isInstalled ? `
            <button class="btn-store-action installed" disabled>
              ${this.svgIcons.check}
              <span>Installé</span>
            </button>
          ` : (isDownloading ? `
            <button class="btn-store-action downloading" disabled>
              <div class="store-spinner"></div>
              <span>Téléchargement...</span>
            </button>
          ` : `
            <button class="btn-store-action download" data-id="${m.id}">
              ${this.svgIcons.download}
              <span>Télécharger</span>
            </button>
          `)}
        </div>
      `;

      const dlBtn = card.querySelector('.btn-store-action.download');
      if (dlBtn) {
        dlBtn.addEventListener('click', () => this.downloadModule(m));
      }

      grid.appendChild(card);
    });

    container.appendChild(grid);
  },

  renderEbooksEmptyState() {
    const modal = document.getElementById('modal-open-shema-store');
    if (!modal) return;

    modal.querySelector('#ebook-store-direct-links-section').style.display = 'none';
    modal.querySelector('#ebook-store-status').innerHTML = `
      <span>Recherchez un e-book chrétien chez Bibli'O, BLF Store, Pub. Chrétiennes, Google Play...</span>
      <span style="font-size: 0.72rem; padding: 1px 7px; border-radius: 10px; background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3);">100% Numérique (EPUB/PDF)</span>
    `;

    modal.querySelector('#ebook-store-results-container').innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 50px 20px; color: var(--text-muted, #94a3b8);">
        <div style="display: inline-flex; padding: 14px; border-radius: 50%; background: rgba(255,255,255,0.03); margin-bottom: 10px;">
          ${this.svgIcons.bible}
        </div>
        <p style="font-size: 0.95rem; margin: 0 0 6px 0; font-weight: 500;">Recherche instantanée d'e-books chrétiens</p>
        <p style="font-size: 0.82rem; margin: 0; opacity: 0.8;">Tapez une version biblique ou un auteur pour comparer les disponibilités et prix numériques.</p>
      </div>
    `;
  },

  async searchEbooks(query) {
    if (!query) return;
    const modal = document.getElementById('modal-open-shema-store');
    if (!modal) return;

    this.ebookSearchQuery = query;
    this.isSearchingEbooks = true;

    const statusEl = modal.querySelector('#ebook-store-status');
    const resultsEl = modal.querySelector('#ebook-store-results-container');
    const directSection = modal.querySelector('#ebook-store-direct-links-section');
    const directLinksEl = modal.querySelector('#ebook-store-direct-links-container');

    statusEl.innerHTML = `
      <span style="display: flex; align-items: center; gap: 8px; color: #60a5fa;">
        ${this.svgIcons.spinner} Recherche en direct dans les librairies chrétiennes...
      </span>
      <span style="font-size: 0.72rem; padding: 1px 7px; border-radius: 10px; background: rgba(16, 185, 129, 0.15); color: #10b981;">100% Numérique</span>
    `;

    resultsEl.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 50px 20px; color: var(--text-muted, #94a3b8);">
        <div style="display: inline-flex; animation: spin 1s linear infinite; margin-bottom: 10px;">
          ${this.svgIcons.spinner}
        </div>
        <p style="font-size: 0.9rem; margin: 0;">Interrogation de Bibli'O, BLF Store, Publications Chrétiennes et Google Play...</p>
      </div>
    `;

    try {
      const data = await API.call('search_christian_ebooks', query);
      this.isSearchingEbooks = false;

      if (!data || this.ebookSearchQuery !== query) return;

      const results = data.results || [];
      const directLinks = data.direct_links || [];

      // Statut
      statusEl.innerHTML = `
        <span><strong>${results.length}</strong> e-book(s) trouvé(s) pour « <em>${this._escapeHtml(query)}</em> »</span>
        <span style="font-size: 0.72rem; padding: 1px 7px; border-radius: 10px; background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); display: flex; align-items: center; gap: 4px;">
          ${this.svgIcons.digital} 100% Numérique
        </span>
      `;

      // Liens directs de magasins
      if (directLinks.length > 0) {
        directSection.style.display = 'block';
        directLinksEl.innerHTML = directLinks.map(dl => `
          <a href="#" data-url="${this._escapeHtml(dl.url)}" class="ebook-direct-link-card" style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border-radius: 6px; background: var(--bg-surface-elevated, #0f172a); border: 1px solid var(--border-color, #334155); text-decoration: none; color: inherit; transition: all 0.2s;">
            <div style="display: flex; align-items: center; gap: 8px; min-width: 0;">
              <span style="font-size: 0.72rem; padding: 2px 6px; border-radius: 4px; background: rgba(59, 130, 246, 0.15); color: #60a5fa; font-weight: 600; white-space: nowrap;">${this._escapeHtml(dl.badge)}</span>
              <span style="font-size: 0.8rem; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${this._escapeHtml(dl.source)}</span>
            </div>
            <div style="color: var(--text-muted, #94a3b8); margin-left: 6px; display: flex;">
              ${this.svgIcons.external}
            </div>
          </a>
        `).join('');

        directLinksEl.querySelectorAll('.ebook-direct-link-card').forEach(el => {
          el.addEventListener('click', (e) => {
            e.preventDefault();
            const url = el.getAttribute('data-url');
            if (url) API.call('open_external_url', url);
          });
        });
      } else {
        directSection.style.display = 'none';
      }

      // Résultats produits
      if (results.length === 0) {
        resultsEl.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; padding: 40px 20px; color: var(--text-muted, #94a3b8);">
            <p style="font-size: 0.95rem; margin: 0 0 6px 0; font-weight: 500;">Aucun e-book direct trouvé dans les catalogues JSON.</p>
            <p style="font-size: 0.82rem; margin: 0;">Consultez les rayons numériques en 1 clic via les boutons Fnac, Kobo et Maison de la Bible ci-dessus.</p>
          </div>
        `;
        return;
      }

      resultsEl.innerHTML = results.map(item => `
        <div class="ebook-card" style="display: flex; flex-direction: column; border-radius: 8px; background: var(--bg-surface-elevated, #0f172a); border: 1px solid var(--border-color, #334155); padding: 12px; transition: transform 0.2s; box-shadow: 0 2px 8px rgba(0,0,0,0.2);">
          
          <div style="display: flex; gap: 10px; margin-bottom: 10px;">
            <div style="width: 55px; height: 75px; flex-shrink: 0; border-radius: 4px; background: rgba(255,255,255,0.04); overflow: hidden; display: flex; align-items: center; justify-content: center; border: 1px solid rgba(255,255,255,0.06);">
              ${item.image ? `<img src="${this._escapeHtml(item.image)}" alt="Cover" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.style.display='none'">` : this.svgIcons.bible}
            </div>

            <div style="flex: 1; min-width: 0; display: flex; flex-direction: column;">
              <span style="display: inline-block; align-self: flex-start; font-size: 0.68rem; font-weight: 600; padding: 1px 5px; border-radius: 3px; background: rgba(59, 130, 246, 0.15); color: #60a5fa; margin-bottom: 3px;">
                ${this._escapeHtml(item.store_badge || item.source)}
              </span>
              <h4 style="margin: 0 0 3px 0; font-size: 0.85rem; font-weight: 600; line-height: 1.25; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;" title="${this._escapeHtml(item.title)}">
                ${this._escapeHtml(item.title)}
              </h4>
              ${item.authors ? `<div style="font-size: 0.75rem; color: var(--text-muted, #94a3b8); margin-bottom: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${this._escapeHtml(item.authors)}</div>` : ''}
              <div style="margin-top: auto; font-size: 0.72rem; color: var(--text-muted, #94a3b8); display: flex; align-items: center; gap: 4px;">
                ${this.svgIcons.digital} <span>${this._escapeHtml(item.format || 'EPUB')}</span>
              </div>
            </div>
          </div>

          <div style="display: flex; align-items: center; justify-content: space-between; margin-top: auto; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.06);">
            <div style="font-size: 1rem; font-weight: 700; color: #10b981;">
              ${this._escapeHtml(item.price)}
            </div>
            <button class="btn-buy-ebook-link" data-url="${this._escapeHtml(item.url)}" style="display: flex; align-items: center; gap: 5px; padding: 5px 10px; border-radius: 5px; background: #2563eb; color: #fff; border: none; font-size: 0.78rem; font-weight: 500; cursor: pointer;" title="Ouvrir la page de la librairie">
              <span>Acheter / Voir</span>
              ${this.svgIcons.external}
            </button>
          </div>

        </div>
      `).join('');

      resultsEl.querySelectorAll('.btn-buy-ebook-link').forEach(btn => {
        btn.addEventListener('click', () => {
          const url = btn.getAttribute('data-url');
          if (url) API.call('open_external_url', url);
        });
      });

    } catch (err) {
      this.isSearchingEbooks = false;
      statusEl.innerHTML = `<span style="color: #ef4444;">Erreur lors de la recherche</span>`;
      resultsEl.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 40px 20px; color: var(--text-muted, #94a3b8);">
          <p style="color: #ef4444; margin-bottom: 6px;">Impossible de contacter les librairies actuellement.</p>
          <p style="font-size: 0.82rem;">${this._escapeHtml(String(err))}</p>
        </div>
      `;
    }
  },

  _escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  async downloadModule(module) {
    if (this.isDownloading[module.id]) return;
    this.isDownloading[module.id] = true;
    this.renderCatalog();

    try {
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast(`Téléchargement de ${module.title}...`);
      }

      const res = await API.call('download_and_install_catalog_module', module);
      if (res && res.success) {
        if (typeof App !== 'undefined' && App.showToast) {
          App.showToast(`${module.title} a été installé avec succès.`);
        }
        
        if (typeof BibleReader !== 'undefined' && BibleReader.reloadInstalledBibles) {
          await BibleReader.reloadInstalledBibles();
        }

        if (typeof LibraryView !== 'undefined' && LibraryView.loadBooks) {
          await LibraryView.loadBooks();
        }

        await this.refreshInstalledCache();
        this.renderCatalog();
      } else {
        const errMsg = res?.error || 'Erreur inconnue';
        if (typeof App !== 'undefined' && App.showToast) {
          App.showToast(`Erreur lors du téléchargement : ${errMsg}`);
        }
      }
    } catch (err) {
      console.error('Erreur téléchargement module:', err);
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast(`Erreur : ${err.message || err}`);
      }
    } finally {
      this.isDownloading[module.id] = false;
      this.renderCatalog();
    }
  },

  async checkNewModulesOnStartup() {
    try {
      const catalog = await this.fetchCatalog();
      if (!catalog || !catalog.modules || catalog.modules.length === 0) return;

      await this.refreshInstalledCache();

      const storageKey = 'open_shema_known_catalog_ids';
      let knownIds = [];
      try {
        const stored = localStorage.getItem(storageKey);
        if (stored) knownIds = JSON.parse(stored);
      } catch (e) {
        knownIds = [];
      }

      const uninstalledModules = catalog.modules.filter(m => !this._isModuleInstalled(m));
      const newAvailableModules = uninstalledModules.filter(m => !knownIds.includes(m.id));

      if (newAvailableModules.length > 0) {
        this._showNewModulesNotification(newAvailableModules);
      }

      const allCurrentIds = catalog.modules.map(m => m.id);
      localStorage.setItem(storageKey, JSON.stringify(allCurrentIds));
    } catch (err) {
      console.warn('[OpenShemaStore] Erreur vérification démarrage:', err);
    }
  },

  _showNewModulesNotification(newModules) {
    const isSingle = newModules.length === 1;
    const firstMod = newModules[0];
    const title = isSingle ? 'Nouvel ouvrage disponible' : `${newModules.length} nouveaux ouvrages disponibles`;
    const snippet = isSingle 
      ? `« ${firstMod.title} » (${firstMod.author || 'Domaine Public'}) est disponible au téléchargement gratuit.`
      : `${newModules.map(m => m.title).slice(0, 2).join(', ')}${newModules.length > 2 ? '...' : ''} sont disponibles dans le catalogue.`;

    if (typeof NotificationManager !== 'undefined' && NotificationManager.showInAppToast) {
      NotificationManager.showInAppToast({
        title: title,
        snippet: snippet,
        targetView: 'library',
        onClick: () => {
          this.open();
        }
      });
    } else if (typeof App !== 'undefined' && App.showToast) {
      App.showToast(`${title} : ${snippet}`);
    }
  }
};

window.OpenShemaStore = OpenShemaStore;
document.addEventListener('DOMContentLoaded', () => {
  OpenShemaStore.init();
});
