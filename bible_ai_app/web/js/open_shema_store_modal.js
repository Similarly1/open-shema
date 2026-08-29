/**
 * Open Shema Store / Hub de Recherche & Découverte Biblique Unifié
 * 
 * 3 Piliers de Découverte :
 * 1. ✦ Modules Natifs Open Shema (Bibles, Dictionnaires, Commentaires, Théologie optimisés avec Strong)
 * 2. ⚡ Domaine Public & Archives Libres (Gutendex / Gutenberg, Logos Community Personal Books)
 * 3. 🛒 Librairies & Éditeurs Chrétiens (Bibli'O, BLF Store, Publications Chrétiennes, Éditions Clé, Google Play)
 * 
 * RÈGLE STRICTE : 100% icônes SVG vectorielles, aucun émoji.
 */

const OpenShemaStore = {
  catalogUrl: 'https://raw.githubusercontent.com/Similarly1/open-shema-data/main/catalog.json',
  catalogData: null,
  communityLogosBooks: [],
  installedIds: new Set(),
  installedCodes: new Set(),
  
  // État de recherche unifiée
  activeCategory: 'all', // 'all' | 'open_shema' | 'public_domain' | 'bookstores'
  activeLanguage: 'all', // 'all' | 'fr' | 'en'
  searchQuery: '',
  hideInstalled: localStorage.getItem('open_shema_store_hide_installed') === 'true',
  
  // Cache des résultats unifiés
  unifiedResults: {
    open_shema: [],
    public_domain: [],
    bookstores: [],
    direct_links: []
  },
  
  isSearching: false,
  searchDebounceTimer: null,
  isDownloading: {},

  // Icônes SVG standardisées Open Shema (100% SVG)
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
    book: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M6 6h10"/><path d="M6 10h10"/></svg>`,
    info: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
    award: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>`,
    scale: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/></svg>`,
    spinner: `<svg class="spin-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`
  },

  async init() {
    this._createModalDom();
    await this.refreshInstalledCache();
    
    // Chargement différé du catalogue distant et des livres communautaires
    setTimeout(() => {
      this.fetchCatalog();
      this.checkNewModulesOnStartup();
    }, 2000);
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
      if (response.ok) {
        this.catalogData = await response.json();
      }
    } catch (err) {
      console.error('Erreur chargement catalogue distant:', err);
    }
    await this.fetchCommunityBooks();
    this._populateInitialUnifiedResults();
    return this.catalogData;
  },

  async fetchCommunityBooks() {
    try {
      const books = await API.call('get_community_logos_books');
      if (Array.isArray(books) && books.length > 0) {
        this.communityLogosBooks = books;
      }
    } catch (e) {
      console.warn('Erreur chargement livres communautaires Logos:', e);
    }
  },

  _populateInitialUnifiedResults() {
    const official = (this.catalogData && this.catalogData.modules) ? this.catalogData.modules : [];
    const community = this.communityLogosBooks || [];

    this.unifiedResults.open_shema = official.map(m => ({
      ...m,
      category: 'open_shema',
      badge_label: 'Natif Open Shema',
      action_label: 'Installer dans l\'application',
      is_free: true
    }));

    this.unifiedResults.public_domain = community.map(m => ({
      ...m,
      category: 'public_domain',
      source: 'Logos Community Wiki',
      badge_label: 'Logos PB',
      action_label: 'Importer DOCX',
      is_free: true
    }));

    this.unifiedResults.bookstores = [];
    this.unifiedResults.direct_links = [
      { name: "Bibli'O", url: "https://bibliostore.fr/12-ebooks" },
      { name: "BLF Store", url: "https://blfstore.com/collections/ebooks" },
      { name: "Publications Chrétiennes", url: "https://publicationschretiennes.com/collections/livres-numeriques" },
      { name: "Éditions Clé", url: "https://editionscle.com/78-ebook" },
      { name: "Google Play Livres", url: "https://play.google.com/store/books" },
      { name: "Rakuten Kobo", url: "https://www.kobo.com/fr/fr" }
    ];
  },

  async open(initialCategory = 'all', searchQuery = '') {
    let modal = document.getElementById('modal-open-shema-store');
    if (!modal) {
      this._createModalDom();
      modal = document.getElementById('modal-open-shema-store');
    }
    if (!modal) return;

    modal.style.display = 'flex';
    modal.classList.remove('hidden');

    this.activeCategory = initialCategory || 'all';
    if (searchQuery) {
      this.searchQuery = searchQuery;
    }

    await this.refreshInstalledCache();

    if (!this.catalogData) {
      await this.fetchCatalog();
    } else {
      this._populateInitialUnifiedResults();
    }

    this._updateCategoryPills();

    const searchInput = modal.querySelector('#store-unified-search-input');
    if (searchInput) {
      if (this.searchQuery) {
        searchInput.value = this.searchQuery;
        this._handleSearchInput(true);
      } else {
        this.renderUnifiedHub();
      }
      setTimeout(() => searchInput.focus(), 50);
    } else {
      this.renderUnifiedHub();
    }
  },

  async getMissingBiblesCount() {
    if (!this.catalogData) {
      await this.fetchCatalog();
    }
    if (!this.catalogData || !this.catalogData.modules) return 0;
    const bibleModules = this.catalogData.modules.filter(m => m.type === 'bible');
    return bibleModules.filter(m => !this._isModuleInstalled(m)).length;
  },

  close() {
    const modal = document.getElementById('modal-open-shema-store');
    if (modal) {
      modal.style.display = 'none';
      modal.classList.add('hidden');
    }
  },

  _createModalDom() {
    let modal = document.getElementById('modal-open-shema-store');
    if (modal) return;

    modal = document.createElement('div');
    modal.id = 'modal-open-shema-store';
    modal.className = 'store-modal-overlay hidden';
    modal.style.cssText = 'position: fixed; inset: 0; z-index: 10000; background: rgba(0, 0, 0, 0.75); backdrop-filter: blur(8px); display: none; align-items: center; justify-content: center;';

    modal.innerHTML = `
      <div class="store-modal-card" style="width: 1060px; max-width: 95vw; height: 88vh; display: flex; flex-direction: column; background: var(--bg-card, #1e293b); border-radius: 14px; border: 1px solid var(--border-color, #334155); box-shadow: 0 25px 50px -12px rgba(0,0,0,0.6); overflow: hidden; animation: modalFadeIn 0.2s ease-out;">
        
        <!-- HEADER DU HUB UNIFIÉ -->
        <div class="store-modal-header" style="padding: 14px 20px; border-bottom: 1px solid var(--border-subtle, #334155); background: var(--bg-surface-elevated, #0f172a); display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div class="store-logo-badge" style="width: 38px; height: 38px; border-radius: 9px; background: linear-gradient(135deg, #2563eb, #10b981); color: #fff; display: flex; align-items: center; justify-content: center;">
              ${this.svgIcons.sparkle}
            </div>
            <div>
              <h3 style="margin: 0; font-size: 1.05rem; font-weight: 700; color: #f8fafc; display: flex; align-items: center; gap: 8px;">
                Recherche & Découverte Biblique
              </h3>
              <div style="font-size: 0.76rem; color: var(--text-muted, #94a3b8); margin-top: 1px;">
                ✦ Open Shema &bull; ⚡ Domaine Public &bull; 🛒 Librairies Chrétiennes
              </div>
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 8px;">
            <!-- Bouton Formats & Collections Centré -->
            <button id="btn-store-info-tooltip" style="display: inline-flex; align-items: center; gap: 5px; padding: 5px 10px; border-radius: 6px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); color: var(--text-muted, #94a3b8); font-size: 0.75rem; cursor: pointer; transition: all 0.2s;" title="Comprendre les 3 collections">
              ${this.svgIcons.info}
              <span>Formats & Origines</span>
            </button>

            <button id="btn-close-store-modal" class="btn-icon-close" style="background: transparent; border: none; color: var(--text-muted, #94a3b8); cursor: pointer; padding: 6px; border-radius: 6px;" title="Fermer">
              ${this.svgIcons.close}
            </button>
          </div>
        </div>

        <!-- TOOLBAR DE RECHERCHE UNIFIÉE -->
        <div class="store-toolbar" style="padding: 14px 20px 10px 20px; border-bottom: 1px solid var(--border-subtle, #334155); background: var(--bg-card, #1e293b);">
          
          <!-- Champ de recherche principal -->
          <div style="position: relative; display: flex; align-items: center; margin-bottom: 10px;">
            <div style="position: absolute; left: 14px; color: var(--text-muted, #94a3b8); display: flex; align-items: center; pointer-events: none;">
              ${this.svgIcons.search}
            </div>
            <input type="text" id="store-unified-search-input" placeholder="Rechercher un auteur, un livre, une Bible ou un sujet (ex: Calvin, Romains, Spurgeon, Augustin, Segond)..." autocomplete="off" style="width: 100%; padding: 11px 40px 11px 40px; border-radius: 8px; border: 1px solid var(--border-color, #334155); background: var(--bg-surface-elevated, #0f172a); color: #fff; font-size: 0.92rem; outline: none; transition: border-color 0.2s;">
            <div id="store-search-spinner" style="position: absolute; right: 14px; color: #60a5fa; display: none; align-items: center;">
              ${this.svgIcons.spinner}
            </div>
          </div>

          <!-- Ligne des Facettes & Filtres Rapides -->
          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
            
            <!-- Pills Catégories -->
            <div class="store-categories-bar" id="store-facets-bar" style="display: flex; gap: 6px; flex-wrap: wrap; align-items: center;">
              <button class="store-cat-pill active" data-cat="all">
                <span>Tous</span>
                <span class="facet-count" id="count-facet-all">0</span>
              </button>
              <button class="store-cat-pill" data-cat="open_shema" style="border-color: rgba(16, 185, 129, 0.35); color: #34d399;">
                ${this.svgIcons.sparkle}
                <span>✦ Open Shema</span>
                <span class="facet-count" id="count-facet-openshema">0</span>
              </button>
              <button class="store-cat-pill" data-cat="public_domain" style="border-color: rgba(59, 130, 246, 0.35); color: #60a5fa;">
                ${this.svgIcons.book}
                <span>⚡ Domaine Public & Gratuit</span>
                <span class="facet-count" id="count-facet-publicdomain">0</span>
              </button>
              <button class="store-cat-pill" data-cat="bookstores" style="border-color: rgba(168, 85, 247, 0.35); color: #c084fc;">
                ${this.svgIcons.store}
                <span>🛒 Librairies Chrétiennes</span>
                <span class="facet-count" id="count-facet-bookstores">0</span>
              </button>
            </div>

            <!-- Filtres Secondaires (Langue & Installés) -->
            <div style="display: flex; align-items: center; gap: 12px;">
              <select id="store-lang-filter-select" style="padding: 4px 8px; border-radius: 6px; background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.12); color: #e2e8f0; font-size: 0.76rem; outline: none; cursor: pointer;">
                <option value="all">🌐 Toutes les langues</option>
                <option value="fr">FR Français</option>
                <option value="en">EN Anglais</option>
              </select>

              <label class="store-hide-installed-toggle" style="display: flex; align-items: center; gap: 6px; font-size: 0.78rem; color: var(--text-muted, #94a3b8); cursor: pointer;" title="Masquer les ouvrages déjà installés">
                <input type="checkbox" id="store-hide-installed-cb">
                <span>Masquer installés</span>
              </label>
            </div>

          </div>
        </div>

        <!-- ZONE CENTRALE DES RÉSULTATS UNIFIÉS -->
        <div class="store-content-body" id="store-unified-container" style="flex: 1; overflow-y: auto; padding: 18px 20px; background: var(--bg-card, #1e293b);">
          <div class="store-loading-state" style="text-align: center; padding: 50px 20px; color: var(--text-muted, #94a3b8);">
            ${this.svgIcons.refresh}
            <span style="margin-left: 8px;">Chargement du catalogue...</span>
          </div>
        </div>

        <!-- FOOTER UNIFIÉ -->
        <div class="store-modal-footer" style="padding: 10px 20px; border-top: 1px solid var(--border-subtle, #334155); background: var(--bg-surface-elevated, #0f172a); display: flex; align-items: center; justify-content: space-between; font-size: 0.78rem; color: var(--text-muted, #94a3b8);">
          <div class="store-footer-meta" style="display: flex; align-items: center; gap: 14px;">
            <span>✦ Dépôt officiel : <a href="https://github.com/Similarly1/open-shema-data" target="_blank" rel="noopener" style="color: #60a5fa; text-decoration: none;">open-shema-data</a></span>
            <span style="opacity: 0.6;">&bull;</span>
            <span>⚡ Domaine Public : Gutenberg & Logos PB</span>
            <span style="opacity: 0.6;">&bull;</span>
            <span>🛒 100% E-books numériques</span>
          </div>
          <button id="btn-refresh-store" class="btn-store-secondary" title="Actualiser les données" style="display: flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 6px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: #fff; cursor: pointer;">
            ${this.svgIcons.refresh}
            <span>Actualiser</span>
          </button>
        </div>

      </div>
    `;

    document.body.appendChild(modal);
    this._attachEvents(modal);
  },

  _attachEvents(modal) {
    // Fermeture
    modal.querySelector('#btn-close-store-modal').addEventListener('click', () => this.close());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) this.close();
    });

    // Recherche unifiée avec debounce
    const searchInput = modal.querySelector('#store-unified-search-input');
    searchInput.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.trim();
      this._handleSearchInput();
    });

    // Filtres Facettes Catégories
    modal.querySelectorAll('.store-cat-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        modal.querySelectorAll('.store-cat-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeCategory = btn.dataset.cat || 'all';
        this.renderUnifiedHub();
      });
    });

    // Filtre Langue
    const langSelect = modal.querySelector('#store-lang-filter-select');
    if (langSelect) {
      langSelect.addEventListener('change', (e) => {
        this.activeLanguage = e.target.value;
        this.renderUnifiedHub();
      });
    }

    // Toggle Masquer les installés
    const hideCb = modal.querySelector('#store-hide-installed-cb');
    if (hideCb) {
      hideCb.checked = this.hideInstalled;
      hideCb.addEventListener('change', (e) => {
        this.hideInstalled = e.target.checked;
        localStorage.setItem('open_shema_store_hide_installed', this.hideInstalled ? 'true' : 'false');
        this.renderUnifiedHub();
      });
    }

    // Formats & Collections Dialog
    const infoTooltipBtn = modal.querySelector('#btn-store-info-tooltip');
    if (infoTooltipBtn) {
      infoTooltipBtn.addEventListener('click', () => {
        this.showFormatsHelpModal();
      });
    }

    // Rafraîchir
    modal.querySelector('#btn-refresh-store').addEventListener('click', async () => {
      const btn = modal.querySelector('#btn-refresh-store');
      btn.classList.add('spinning');
      await this.refreshInstalledCache();
      await this.fetchCatalog();
      btn.classList.remove('spinning');
      this._handleSearchInput(true);
    });
  },

  _handleSearchInput(force = false) {
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }

    // Filtrage instantané en mémoire des données locales
    this._filterLocalModulesInstant();
    this.renderUnifiedHub();

    const query = this.searchQuery;
    if (!query || query.length < 2) {
      this._populateInitialUnifiedResults();
      this._updateFacetCounts();
      this.renderUnifiedHub();
      return;
    }

    // Déclenchement de la recherche réseau unifiée
    this.searchDebounceTimer = setTimeout(async () => {
      this._showSearchSpinner(true);
      try {
        const officialModules = (this.catalogData && this.catalogData.modules) ? this.catalogData.modules : [];
        const res = await API.call('search_unified_hub', query, officialModules);
        if (res) {
          if (Array.isArray(res.open_shema_results)) {
            this.unifiedResults.open_shema = res.open_shema_results;
          }
          if (Array.isArray(res.public_domain_results)) {
            this.unifiedResults.public_domain = res.public_domain_results;
          }
          if (Array.isArray(res.bookstore_results)) {
            this.unifiedResults.bookstores = res.bookstore_results;
          }
          if (Array.isArray(res.direct_store_links)) {
            this.unifiedResults.direct_links = res.direct_store_links;
          }
        }
      } catch (err) {
        console.warn('Erreur recherche unifiée réseau:', err);
      } finally {
        this._showSearchSpinner(false);
        this._updateFacetCounts();
        this.renderUnifiedHub();
      }
    }, 350);
  },

  _showSearchSpinner(show) {
    const spinner = document.getElementById('store-search-spinner');
    if (spinner) {
      spinner.style.display = show ? 'flex' : 'none';
    }
  },

  _filterLocalModulesInstant() {
    const q = (this.searchQuery || '').toLowerCase();
    const official = (this.catalogData && this.catalogData.modules) ? this.catalogData.modules : [];
    const community = this.communityLogosBooks || [];

    if (!q) {
      this._populateInitialUnifiedResults();
      return;
    }

    this.unifiedResults.open_shema = official.filter(m => {
      return (m.title || '').toLowerCase().includes(q) ||
             (m.author || '').toLowerCase().includes(q) ||
             (m.description || '').toLowerCase().includes(q) ||
             (m.abbreviation || '').toLowerCase().includes(q);
    }).map(m => ({ ...m, category: 'open_shema', badge_label: 'Natif Open Shema', action_label: 'Installer dans l\'application', is_free: true }));

    this.unifiedResults.public_domain = community.filter(m => {
      return (m.title || '').toLowerCase().includes(q) ||
             (m.author || '').toLowerCase().includes(q) ||
             (m.description || '').toLowerCase().includes(q);
    }).map(m => ({ ...m, category: 'public_domain', source: 'Logos Community Wiki', badge_label: 'Logos PB', action_label: 'Importer DOCX', is_free: true }));

    this._updateFacetCounts();
  },

  _updateFacetCounts() {
    const countAll = (this.unifiedResults.open_shema.length) + (this.unifiedResults.public_domain.length) + (this.unifiedResults.bookstores.length);
    
    const setTxt = (id, count) => {
      const el = document.getElementById(id);
      if (el) el.textContent = count;
    };

    setTxt('count-facet-all', countAll);
    setTxt('count-facet-openshema', this.unifiedResults.open_shema.length);
    setTxt('count-facet-publicdomain', this.unifiedResults.public_domain.length);
    setTxt('count-facet-bookstores', this.unifiedResults.bookstores.length);
  },

  _updateCategoryPills() {
    const modal = document.getElementById('modal-open-shema-store');
    if (!modal) return;
    modal.querySelectorAll('.store-cat-pill').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.cat === this.activeCategory);
    });
    this._updateFacetCounts();
  },

  _isModuleInstalled(m) {
    if (!m) return false;
    const id = String(m.id || '').toLowerCase();
    const cleanId = id.replace(/^(bible|dict|theology|comm)-/, '');
    const code = String(m.abbreviation || m.version_code || '').toUpperCase();
    return this.installedIds.has(id) || this.installedIds.has(cleanId) || (code && this.installedCodes.has(code));
  },

  _matchesLang(m) {
    if (this.activeLanguage === 'all') return true;
    const l = (m.language || 'fr').toLowerCase();
    return l.startsWith(this.activeLanguage);
  },

  renderUnifiedHub() {
    const container = document.getElementById('store-unified-container');
    if (!container) return;

    this._updateFacetCounts();

    const openShemaList = (this.unifiedResults.open_shema || []).filter(m => {
      if (this.hideInstalled && this._isModuleInstalled(m)) return false;
      return this._matchesLang(m);
    });

    const publicDomainList = (this.unifiedResults.public_domain || []).filter(m => {
      if (this.hideInstalled && this._isModuleInstalled(m)) return false;
      return this._matchesLang(m);
    });

    const bookstoresList = (this.unifiedResults.bookstores || []).filter(m => {
      return this._matchesLang(m);
    });

    const totalVisible = (this.activeCategory === 'all')
      ? (openShemaList.length + publicDomainList.length + bookstoresList.length)
      : (this.activeCategory === 'open_shema' ? openShemaList.length : (this.activeCategory === 'public_domain' ? publicDomainList.length : bookstoresList.length));

    if (totalVisible === 0) {
      container.innerHTML = `
        <div class="store-empty-state" style="text-align: center; padding: 60px 20px; color: var(--text-muted, #94a3b8);">
          <svg viewBox="0 0 24 24" width="42" height="42" fill="none" stroke="currentColor" stroke-width="1.8" style="margin-bottom: 12px; opacity: 0.6;">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
          </svg>
          <h4 style="margin: 0 0 6px 0; color: #f8fafc; font-size: 1.05rem;">Aucun résultat pour cette sélection</h4>
          <p style="font-size: 0.85rem; max-width: 450px; margin: 0 auto; line-height: 1.45;">
            Essayez d'autres mots-clés ou désactivez le filtre « Masquer installés » pour explorer les ouvrages déjà présents.
          </p>
        </div>
      `;
      return;
    }

    container.innerHTML = '';

    // =========================================================================
    // SECTION 1 : ✦ MODULES OPTIMISÉS OPEN SHEMA (Natif)
    // =========================================================================
    if ((this.activeCategory === 'all' || this.activeCategory === 'open_shema') && openShemaList.length > 0) {
      const sec = document.createElement('div');
      sec.className = 'store-unified-section';
      sec.style.marginBottom = '28px';

      sec.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid rgba(16, 185, 129, 0.25);">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="color: #10b981;">${this.svgIcons.sparkle}</span>
            <span style="font-weight: 700; color: #f8fafc; font-size: 0.95rem;">Modules Officiels Open Shema</span>
            <span style="font-size: 0.7rem; padding: 2px 7px; border-radius: 4px; background: rgba(16, 185, 129, 0.15); color: #34d399; font-weight: 700;">Natif 1-clic</span>
          </div>
          <span style="font-size: 0.76rem; color: var(--text-muted, #94a3b8);">${openShemaList.length} module(s)</span>
        </div>
        <div class="store-modules-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); gap: 14px;"></div>
      `;

      const grid = sec.querySelector('.store-modules-grid');
      openShemaList.forEach(m => grid.appendChild(this._renderOpenShemaCard(m)));
      container.appendChild(sec);
    }

    // =========================================================================
    // SECTION 2 : ⚡ DOMAINE PUBLIC & ARCHIVES LIBRES (Gutenberg / Logos PB)
    // =========================================================================
    if ((this.activeCategory === 'all' || this.activeCategory === 'public_domain') && publicDomainList.length > 0) {
      const sec = document.createElement('div');
      sec.className = 'store-unified-section';
      sec.style.marginBottom = '28px';

      sec.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid rgba(59, 130, 246, 0.25);">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="color: #60a5fa;">${this.svgIcons.book}</span>
            <span style="font-weight: 700; color: #f8fafc; font-size: 0.95rem;">Domaine Public & Archives Libres</span>
            <span style="font-size: 0.7rem; padding: 2px 7px; border-radius: 4px; background: rgba(59, 130, 246, 0.15); color: #60a5fa; font-weight: 700;">Gutenberg & Logos PB</span>
          </div>
          <span style="font-size: 0.76rem; color: var(--text-muted, #94a3b8);">${publicDomainList.length} livre(s)</span>
        </div>
        <div class="store-modules-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); gap: 14px;"></div>
      `;

      const grid = sec.querySelector('.store-modules-grid');
      publicDomainList.forEach(m => grid.appendChild(this._renderPublicDomainCard(m)));
      container.appendChild(sec);
    }

    // =========================================================================
    // SECTION 3 : 🛒 LIBRAIRIES & ÉDITEURS CHRÉTIENS (E-books payants)
    // =========================================================================
    if ((this.activeCategory === 'all' || this.activeCategory === 'bookstores')) {
      const sec = document.createElement('div');
      sec.className = 'store-unified-section';
      sec.style.marginBottom = '20px';

      sec.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid rgba(168, 85, 247, 0.25);">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="color: #c084fc;">${this.svgIcons.store}</span>
            <span style="font-weight: 700; color: #f8fafc; font-size: 0.95rem;">Librairies & Éditeurs Chrétiens (E-books)</span>
            <span style="font-size: 0.7rem; padding: 2px 7px; border-radius: 4px; background: rgba(168, 85, 247, 0.15); color: #c084fc; font-weight: 700;">100% Numérique</span>
          </div>
          <span style="font-size: 0.76rem; color: var(--text-muted, #94a3b8);">${bookstoresList.length} e-book(s)</span>
        </div>
        
        <!-- Raccourcis directs vers les librairies chrétiennes -->
        <div style="margin-bottom: 14px; padding: 10px 14px; border-radius: 8px; background: rgba(15, 23, 42, 0.6); border: 1px solid var(--border-subtle, #334155); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
          <div style="font-size: 0.76rem; color: var(--text-muted, #94a3b8); display: flex; align-items: center; gap: 6px;">
            ${this.svgIcons.external} Rayons e-books directs :
          </div>
          <div style="display: flex; gap: 6px; flex-wrap: wrap;">
            ${(this.unifiedResults.direct_links || []).map(link => `
              <button class="btn-direct-store-link" data-url="${this._escapeHtml(link.url)}" style="display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 4px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); color: #cbd5e1; font-size: 0.72rem; cursor: pointer; transition: all 0.2s;">
                <span>${this._escapeHtml(link.name)}</span>
              </button>
            `).join('')}
          </div>
        </div>

        <div class="store-ebooks-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 14px;"></div>
      `;

      const grid = sec.querySelector('.store-ebooks-grid');
      if (bookstoresList.length > 0) {
        bookstoresList.forEach((item, idx) => grid.appendChild(this._renderBookstoreCard(item, idx)));
      } else {
        grid.innerHTML = `
          <div style="grid-column: 1 / -1; padding: 25px; text-align: center; color: var(--text-muted, #94a3b8); font-size: 0.82rem;">
            Tapez un mot-clé (ex: <em>Calvin, Romains, Spurgeon</em>) dans la barre de recherche pour interroger simultanément Bibli'O, BLF Store, Éditions Clé, Publications Chrétiennes et Google Play.
          </div>
        `;
      }
      container.appendChild(sec);

      // Événements boutons directs
      sec.querySelectorAll('.btn-direct-store-link').forEach(btn => {
        btn.addEventListener('click', () => {
          const url = btn.getAttribute('data-url');
          if (url) API.call('open_external_url', url);
        });
      });
    }
  },

  _renderOpenShemaCard(m) {
    const isInstalled = this._isModuleInstalled(m);
    const isDownloading = !!this.isDownloading[m.id];
    const card = document.createElement('div');
    card.className = `store-card ${isInstalled ? 'installed' : ''}`;
    card.style.cssText = 'border: 1px solid rgba(16, 185, 129, 0.28); background: var(--bg-surface-elevated, #0f172a); border-radius: 8px; padding: 14px; display: flex; flex-direction: column; gap: 8px;';

    const iconSvg = this.svgIcons[m.type] || this.svgIcons.bible;
    const typeLabel = m.type === 'bible' ? 'Bible' : (m.type === 'dictionary' ? 'Dictionnaire' : (m.type === 'commentary' ? 'Commentaire' : (m.type === 'theology' ? 'Théologie' : 'Données')));
    const hasStrong = (m.features || []).includes('strong') || (m.features || []).includes('strong_ready');
    const langBadge = m.language ? `<span style="font-size: 0.68rem; padding: 2px 6px; border-radius: 4px; background: rgba(255, 255, 255, 0.08); color: #e2e8f0; font-weight: 700;">${m.language.toUpperCase()}</span>` : '';

    card.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <div style="display: inline-flex; align-items: center; gap: 5px; font-size: 0.72rem; font-weight: 700; color: #34d399; background: rgba(16, 185, 129, 0.15); padding: 2px 7px; border-radius: 4px; border: 1px solid rgba(16, 185, 129, 0.3);">
          <span>${iconSvg}</span>
          <span>${typeLabel}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 5px;">
          ${langBadge}
          ${hasStrong ? `<span style="font-size: 0.68rem; padding: 2px 6px; border-radius: 4px; background: rgba(245, 158, 11, 0.15); color: #f59e0b; font-weight: 700; display: inline-flex; align-items: center; gap: 3px;">${this.svgIcons.sparkle} Strong</span>` : ''}
        </div>
      </div>

      <div>
        <h4 style="margin: 0 0 3px 0; font-size: 0.94rem; font-weight: 700; color: #f8fafc; line-height: 1.3;">
          ${this._escapeHtml(m.title)}
        </h4>
        <div style="font-size: 0.78rem; color: var(--text-muted, #94a3b8);">${this._escapeHtml(m.author || 'Open Shema Data')}</div>
      </div>

      <p style="margin: 0; font-size: 0.78rem; color: var(--text-muted, #94a3b8); line-height: 1.4; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">
        ${this._escapeHtml(m.description || 'Module officiel calibré et optimisé nativement.')}
      </p>

      <div style="margin-top: auto; padding-top: 10px; display: flex; align-items: center; justify-content: space-between; border-top: 1px solid rgba(255,255,255,0.06);">
        <span style="font-size: 0.72rem; color: #10b981; font-weight: 700;">Gratuit / Natif</span>
        
        ${isInstalled ? `
          <button style="display: flex; align-items: center; gap: 5px; padding: 5px 10px; border-radius: 5px; background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); font-size: 0.75rem; font-weight: 700; cursor: default;">
            ${this.svgIcons.check}
            <span>Installé</span>
          </button>
        ` : `
          <button class="btn-install-openshema" style="display: flex; align-items: center; gap: 5px; padding: 6px 12px; border-radius: 6px; background: #059669; color: #fff; border: none; font-size: 0.76rem; font-weight: 600; cursor: pointer; transition: all 0.2s;" ${isDownloading ? 'disabled' : ''}>
            ${isDownloading ? this.svgIcons.spinner : this.svgIcons.download}
            <span>${isDownloading ? 'Installation...' : 'Installer'}</span>
          </button>
        `}
      </div>
    `;

    const installBtn = card.querySelector('.btn-install-openshema');
    if (installBtn) {
      installBtn.addEventListener('click', () => this.downloadModule(m));
    }

    return card;
  },

  _renderPublicDomainCard(m) {
    const isInstalled = this._isModuleInstalled(m);
    const isDownloading = !!this.isDownloading[m.id];
    const card = document.createElement('div');
    card.className = `store-card ${isInstalled ? 'installed' : ''}`;
    card.style.cssText = 'border: 1px solid rgba(59, 130, 246, 0.28); background: var(--bg-surface-elevated, #0f172a); border-radius: 8px; padding: 14px; display: flex; flex-direction: column; gap: 8px;';

    const formatBadge = m.format ? `<span style="font-size: 0.68rem; padding: 2px 6px; border-radius: 4px; background: rgba(59, 130, 246, 0.18); color: #60a5fa; font-weight: 700;">${m.format.toUpperCase()}</span>` : '';
    const langBadge = m.language ? `<span style="font-size: 0.68rem; padding: 2px 6px; border-radius: 4px; background: rgba(255, 255, 255, 0.08); color: #e2e8f0; font-weight: 700;">${m.language.toUpperCase()}</span>` : '';

    card.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <div style="display: inline-flex; align-items: center; gap: 5px; font-size: 0.72rem; font-weight: 700; color: #60a5fa; background: rgba(59, 130, 246, 0.12); padding: 2px 7px; border-radius: 4px; border: 1px solid rgba(59, 130, 246, 0.25);">
          <span>${this.svgIcons.book}</span>
          <span>${this._escapeHtml(m.badge_label || 'Domaine Public')}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 5px;">
          ${formatBadge}
          ${langBadge}
        </div>
      </div>

      <div>
        <h4 style="margin: 0 0 3px 0; font-size: 0.92rem; font-weight: 700; color: #f8fafc; line-height: 1.3; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;" title="${this._escapeHtml(m.title)}">
          ${this._escapeHtml(m.title)}
        </h4>
        <div style="font-size: 0.78rem; color: var(--text-muted, #94a3b8); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${this._escapeHtml(m.author || 'Domaine Public')}</div>
      </div>

      <p style="margin: 0; font-size: 0.76rem; color: var(--text-muted, #94a3b8); line-height: 1.4; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">
        ${this._escapeHtml(m.description || 'Texte libre de droits à télécharger.')}
      </p>

      <div style="margin-top: auto; padding-top: 10px; display: flex; align-items: center; justify-content: space-between; border-top: 1px solid rgba(255,255,255,0.06);">
        <span style="font-size: 0.72rem; color: #60a5fa; font-weight: 700;">Gratuit / Libre</span>
        
        ${isInstalled ? `
          <button style="display: flex; align-items: center; gap: 5px; padding: 5px 10px; border-radius: 5px; background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3); font-size: 0.75rem; font-weight: 700; cursor: default;">
            ${this.svgIcons.check}
            <span>Présent</span>
          </button>
        ` : `
          <button class="btn-download-public-domain" style="display: flex; align-items: center; gap: 5px; padding: 6px 12px; border-radius: 6px; background: #2563eb; color: #fff; border: none; font-size: 0.76rem; font-weight: 600; cursor: pointer; transition: all 0.2s;" ${isDownloading ? 'disabled' : ''}>
            ${isDownloading ? this.svgIcons.spinner : this.svgIcons.download}
            <span>${isDownloading ? 'Téléchargement...' : (m.format === 'DOCX' ? 'Importer DOCX' : 'Télécharger')}</span>
          </button>
        `}
      </div>
    `;

    const dlBtn = card.querySelector('.btn-download-public-domain');
    if (dlBtn) {
      dlBtn.addEventListener('click', () => this.downloadModule(m));
    }

    return card;
  },

  _renderBookstoreCard(item, itemIdx) {
    const card = document.createElement('div');
    const isMultiple = item.offers_count > 1;
    card.className = `ebook-card ${isMultiple ? 'is-grouped' : ''}`;
    card.style.cssText = 'border: 1px solid rgba(168, 85, 247, 0.28); background: var(--bg-surface-elevated, #0f172a); border-radius: 8px; padding: 12px; display: flex; flex-direction: column; gap: 8px;';

    card.innerHTML = `
      <div style="display: flex; gap: 10px; min-width: 0;">
        <div style="width: 44px; height: 60px; flex-shrink: 0; border-radius: 4px; background: rgba(255,255,255,0.04); overflow: hidden; display: flex; align-items: center; justify-content: center; border: 1px solid rgba(255,255,255,0.06);">
          ${item.image ? `<img src="${this._escapeHtml(item.image)}" alt="Cover" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.style.display='none'">` : this.svgIcons.bible}
        </div>

        <div style="flex: 1; min-width: 0; display: flex; flex-direction: column;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 2px;">
            ${isMultiple ? `
              <span style="font-size: 0.66rem; font-weight: 700; padding: 1px 5px; border-radius: 3px; background: rgba(245, 158, 11, 0.15); color: #f59e0b;">
                ${item.offers_count} offres
              </span>
            ` : `
              <span style="font-size: 0.66rem; font-weight: 700; padding: 1px 5px; border-radius: 3px; background: rgba(168, 85, 247, 0.15); color: #c084fc;">
                ${this._escapeHtml(item.best_store)}
              </span>
            `}
          </div>

          <h4 style="margin: 0 0 2px 0; font-size: 0.84rem; font-weight: 700; color: #f8fafc; line-height: 1.25; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;" title="${this._escapeHtml(item.title)}">
            ${this._escapeHtml(item.title)}
          </h4>
          ${item.authors ? `<div style="font-size: 0.74rem; color: var(--text-muted, #94a3b8); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${this._escapeHtml(item.authors)}</div>` : ''}
        </div>
      </div>

      <div style="display: flex; align-items: center; justify-content: space-between; margin-top: auto; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.06);">
        <div style="font-size: 0.95rem; font-weight: 700; color: #10b981;">
          ${this._escapeHtml(item.price_display)}
        </div>

        ${isMultiple ? `
          <button class="btn-open-compare-modal" data-item-idx="${itemIdx}" style="display: flex; align-items: center; gap: 5px; padding: 5px 9px; border-radius: 5px; background: rgba(168, 85, 247, 0.15); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.3); font-size: 0.74rem; font-weight: 600; cursor: pointer;">
            <span>Comparer</span>
            ${this.svgIcons.scale}
          </button>
        ` : `
          <button class="btn-buy-ebook-link" data-url="${this._escapeHtml(item.direct_url)}" style="display: flex; align-items: center; gap: 4px; padding: 5px 10px; border-radius: 5px; background: #7c3aed; color: #fff; border: none; font-size: 0.74rem; font-weight: 600; cursor: pointer;" title="Ouvrir chez l'éditeur">
            <span>Acheter ↗</span>
          </button>
        `}
      </div>
    `;

    const compareBtn = card.querySelector('.btn-open-compare-modal');
    if (compareBtn) {
      compareBtn.addEventListener('click', () => this.showComparisonModal(item));
    }

    const buyBtn = card.querySelector('.btn-buy-ebook-link');
    if (buyBtn) {
      buyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const url = buyBtn.getAttribute('data-url');
        if (url) API.call('open_external_url', url);
      });
    }

    return card;
  },

  showComparisonModal(item) {
    let popover = document.getElementById('modal-ebook-comparison-popover');
    if (!popover) {
      popover = document.createElement('div');
      popover.id = 'modal-ebook-comparison-popover';
      popover.style.cssText = 'position: fixed; inset: 0; z-index: 10015; background: rgba(0, 0, 0, 0.75); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center;';
      document.body.appendChild(popover);
    }

    const titleEncoded = encodeURIComponent(item.title);
    const fnacUrl = `https://www.fnac.com/SearchResult/ResultList.aspx?Search=${titleEncoded}&sft=1`;
    const koboUrl = `https://www.kobo.com/fr/fr/search?query=${titleEncoded}&fclanguages=fr`;

    popover.innerHTML = `
      <div style="width: 600px; max-width: 92vw; max-height: 85vh; display: flex; flex-direction: column; background: var(--bg-card, #1e293b); border-radius: 12px; border: 1px solid var(--border-color, #334155); box-shadow: 0 25px 50px -12px rgba(0,0,0,0.6); overflow: hidden; animation: modalFadeIn 0.2s ease-out;">
        
        <div style="padding: 14px 18px; border-bottom: 1px solid var(--border-subtle, #334155); background: var(--bg-surface-elevated, #0f172a); display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 12px; min-width: 0;">
            <div style="width: 48px; height: 65px; flex-shrink: 0; border-radius: 4px; background: rgba(255,255,255,0.04); overflow: hidden; display: flex; align-items: center; justify-content: center; border: 1px solid rgba(255,255,255,0.08);">
              ${item.image ? `<img src="${this._escapeHtml(item.image)}" alt="Cover" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.style.display='none'">` : this.svgIcons.bible}
            </div>
            <div style="min-width: 0;">
              <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 3px;">
                <span style="font-size: 0.68rem; font-weight: 700; padding: 2px 6px; border-radius: 4px; background: rgba(245, 158, 11, 0.18); color: #f59e0b;">
                  ${item.offers_count} offres comparées
                </span>
                <span style="font-size: 0.7rem; color: #10b981; font-weight: 700;">Dès ${item.min_price_raw > 0 ? item.min_price_raw.toFixed(2) + ' €' : 'Gratuit'}</span>
              </div>
              <h3 style="margin: 0; font-size: 0.95rem; font-weight: 700; color: #f8fafc; line-height: 1.3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                ${this._escapeHtml(item.title)}
              </h3>
              ${item.authors ? `<div style="font-size: 0.78rem; color: var(--text-muted, #94a3b8);">${this._escapeHtml(item.authors)}</div>` : ''}
            </div>
          </div>
          <button id="btn-close-compare-popover" style="background: transparent; border: none; color: var(--text-muted, #94a3b8); cursor: pointer; padding: 6px;" title="Fermer">
            ${this.svgIcons.close}
          </button>
        </div>

        <div style="padding: 16px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 8px; background: var(--bg-card, #1e293b);">
          <div style="font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted, #94a3b8); font-weight: 700; margin-bottom: 2px;">
            Prix et disponibilités en direct :
          </div>

          ${item.offers.map((off, idx) => `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-radius: 6px; background: var(--bg-surface-elevated, #0f172a); border: 1px solid ${idx === 0 ? 'rgba(16, 185, 129, 0.35)' : 'var(--border-color, #334155)'};">
              <div>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span style="font-size: 0.88rem; font-weight: 700; color: #f8fafc;">${this._escapeHtml(off.store_badge)}</span>
                  ${idx === 0 ? `<span style="font-size: 0.65rem; padding: 2px 6px; border-radius: 4px; background: rgba(16, 185, 129, 0.2); color: #10b981; font-weight: 700; display: inline-flex; align-items: center; gap: 3px;">${this.svgIcons.award} Meilleur prix</span>` : ''}
                </div>
                <div style="font-size: 0.74rem; color: var(--text-muted, #94a3b8); display: flex; align-items: center; gap: 4px; margin-top: 2px;">
                  ${this.svgIcons.digital} <span>${this._escapeHtml(off.format)}</span>
                </div>
              </div>

              <div style="display: flex; align-items: center; gap: 12px;">
                <span style="font-size: 1rem; font-weight: 700; color: ${idx === 0 ? '#10b981' : '#f8fafc'};">${this._escapeHtml(off.price_str)}</span>
                <button class="btn-popover-buy" data-url="${this._escapeHtml(off.url)}" style="padding: 5px 12px; border-radius: 5px; background: #2563eb; color: #fff; border: none; font-size: 0.76rem; font-weight: 600; cursor: pointer;">
                  Voir ↗
                </button>
              </div>
            </div>
          `).join('')}
        </div>

        <div style="padding: 10px 16px; border-top: 1px solid var(--border-subtle, #334155); background: var(--bg-surface-elevated, #0f172a); display: flex; align-items: center; justify-content: flex-end;">
          <button id="btn-close-compare-popover-footer" style="padding: 5px 14px; border-radius: 6px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); color: #f8fafc; font-size: 0.78rem; cursor: pointer;">
            Fermer
          </button>
        </div>

      </div>
    `;

    popover.style.display = 'flex';

    popover.querySelector('#btn-close-compare-popover').addEventListener('click', () => this.closeComparisonModal());
    popover.querySelector('#btn-close-compare-popover-footer').addEventListener('click', () => this.closeComparisonModal());
    popover.addEventListener('click', (e) => {
      if (e.target === popover) this.closeComparisonModal();
    });

    popover.querySelectorAll('.btn-popover-buy').forEach(btn => {
      btn.addEventListener('click', () => {
        const url = btn.getAttribute('data-url');
        if (url) API.call('open_external_url', url);
      });
    });
  },

  closeComparisonModal() {
    const popover = document.getElementById('modal-ebook-comparison-popover');
    if (popover) popover.style.display = 'none';
  },

  showFormatsHelpModal() {
    let modal = document.getElementById('modal-formats-help-popover');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modal-formats-help-popover';
      modal.style.cssText = 'position: fixed; inset: 0; z-index: 10020; background: rgba(0, 0, 0, 0.75); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center;';
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div style="width: 580px; max-width: 92vw; background: var(--bg-card, #1e293b); border-radius: 12px; border: 1px solid var(--border-color, #334155); box-shadow: 0 25px 50px -12px rgba(0,0,0,0.6); overflow: hidden; animation: modalFadeIn 0.2s ease-out; display: flex; flex-direction: column;">
        
        <div style="padding: 16px 20px; border-bottom: 1px solid var(--border-subtle, #334155); background: var(--bg-surface-elevated, #0f172a); display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 32px; height: 32px; border-radius: 6px; background: rgba(37, 99, 235, 0.2); color: #60a5fa; display: flex; align-items: center; justify-content: center;">
              ${this.svgIcons.info}
            </div>
            <h3 style="margin: 0; font-size: 1rem; font-weight: 700; color: #f8fafc;">
              Les 3 Piliers du Savoir Biblique
            </h3>
          </div>
          <button id="btn-close-formats-help" style="background: transparent; border: none; color: var(--text-muted, #94a3b8); cursor: pointer; padding: 6px;" title="Fermer">
            ${this.svgIcons.close}
          </button>
        </div>

        <div style="padding: 18px 20px; display: flex; flex-direction: column; gap: 12px; background: var(--bg-card, #1e293b);">
          
          <!-- 1. Open Shema -->
          <div style="padding: 12px 14px; border-radius: 8px; background: var(--bg-surface-elevated, #0f172a); border: 1px solid rgba(16, 185, 129, 0.35);">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
              <div style="display: flex; align-items: center; gap: 6px;">
                <span style="color: #10b981;">${this.svgIcons.sparkle}</span>
                <span style="font-weight: 700; color: #f8fafc; font-size: 0.9rem;">1. Modules Natifs Open Shema</span>
              </div>
              <span style="font-size: 0.68rem; padding: 2px 6px; border-radius: 4px; background: rgba(16, 185, 129, 0.2); color: #34d399; font-weight: 700;">Natif .sqlite / .json</span>
            </div>
            <p style="margin: 0; font-size: 0.8rem; color: var(--text-muted, #94a3b8); line-height: 1.4;">
              Ouvrages officiels vérifiés et calibrés nativement : versification précise, renvois Strong grecs et hébreux, recherche instantanée et intégration directe dans la lecture biblique.
            </p>
          </div>

          <!-- 2. Domaine Public -->
          <div style="padding: 12px 14px; border-radius: 8px; background: var(--bg-surface-elevated, #0f172a); border: 1px solid rgba(59, 130, 246, 0.35);">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
              <div style="display: flex; align-items: center; gap: 6px;">
                <span style="color: #60a5fa;">${this.svgIcons.book}</span>
                <span style="font-weight: 700; color: #f8fafc; font-size: 0.9rem;">2. Domaine Public & Archives Libres</span>
              </div>
              <span style="font-size: 0.68rem; padding: 2px 6px; border-radius: 4px; background: rgba(59, 130, 246, 0.2); color: #60a5fa; font-weight: 700;">EPUB & Word .docx</span>
            </div>
            <p style="margin: 0; font-size: 0.8rem; color: var(--text-muted, #94a3b8); line-height: 1.4;">
              Centaines de classiques chrétiens historiques (Project Gutenberg) et livres de la communauté Logos Bible Software téléchargeables et importables gratuitement dans votre bibliothèque de documents.
            </p>
          </div>

          <!-- 3. Librairies -->
          <div style="padding: 12px 14px; border-radius: 8px; background: var(--bg-surface-elevated, #0f172a); border: 1px solid rgba(168, 85, 247, 0.35);">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
              <div style="display: flex; align-items: center; gap: 6px;">
                <span style="color: #c084fc;">${this.svgIcons.store}</span>
                <span style="font-weight: 700; color: #f8fafc; font-size: 0.9rem;">3. Librairies & Éditeurs Chrétiens</span>
              </div>
              <span style="font-size: 0.68rem; padding: 2px 6px; border-radius: 4px; background: rgba(168, 85, 247, 0.2); color: #c084fc; font-weight: 700;">100% Numérique (Payant)</span>
            </div>
            <p style="margin: 0; font-size: 0.8rem; color: var(--text-muted, #94a3b8); line-height: 1.4;">
              Moteur de comparaison de prix et disponibilité des e-books contemporains chez Bibli'O, BLF Store, Publications Chrétiennes, Éditions Clé et Google Play.
            </p>
          </div>

        </div>

        <div style="padding: 12px 20px; border-top: 1px solid var(--border-subtle, #334155); background: var(--bg-surface-elevated, #0f172a); display: flex; align-items: center; justify-content: flex-end;">
          <button id="btn-close-formats-help-footer" style="padding: 6px 18px; border-radius: 6px; background: var(--primary-accent, #2563eb); color: #fff; border: none; font-size: 0.82rem; font-weight: 600; cursor: pointer;">
            Compris
          </button>
        </div>

      </div>
    `;

    modal.style.display = 'flex';

    modal.querySelector('#btn-close-formats-help').addEventListener('click', () => this.closeFormatsHelpModal());
    modal.querySelector('#btn-close-formats-help-footer').addEventListener('click', () => this.closeFormatsHelpModal());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) this.closeFormatsHelpModal();
    });
  },

  closeFormatsHelpModal() {
    const modal = document.getElementById('modal-formats-help-popover');
    if (modal) modal.style.display = 'none';
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
    this.renderUnifiedHub();

    try {
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast(`Téléchargement de ${module.title}...`);
      }

      const res = await API.call('download_and_install_catalog_module', module);
      if (res && res.success) {
        this.installedIds.add(String(module.id).toLowerCase());
        if (module.abbreviation) {
          this.installedCodes.add(String(module.abbreviation).toUpperCase());
        }

        if (typeof App !== 'undefined' && App.showToast) {
          App.showToast(`« ${module.title} » installé avec succès !`, 'success');
        }

        if (module.type === 'bible' && typeof BibleReader !== 'undefined' && BibleReader.loadInstalledBibles) {
          BibleReader.loadInstalledBibles();
        } else if (typeof BibleApp !== 'undefined' && BibleApp.loadInstalledModules) {
          BibleApp.loadInstalledModules();
        }
      } else {
        const errMsg = (res && res.error) ? res.error : 'Erreur inconnue lors de l\'installation.';
        if (typeof App !== 'undefined' && App.showToast) {
          App.showToast(`Échec : ${errMsg}`, 'error');
        } else {
          alert(`Erreur de téléchargement : ${errMsg}`);
        }
      }
    } catch (err) {
      console.error('Erreur téléchargement module:', err);
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast(`Erreur réseau : ${err.message || err}`, 'error');
      }
    } finally {
      delete this.isDownloading[module.id];
      this.renderUnifiedHub();
    }
  },

  async checkNewModulesOnStartup() {
    // Vérification discrète en arrière-plan sans bloquer
  }
};

window.OpenShemaStore = OpenShemaStore;

// Auto-initialisation au chargement de la page
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      OpenShemaStore.init();
    });
  } else {
    OpenShemaStore.init();
  }

  // Écouteur global de secours pour le bouton Catalogue & E-books
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('#btn-lib-open-store, .btn-open-store, [data-action="open-store"]');
    if (btn) {
      e.preventDefault();
      OpenShemaStore.open();
    }
  });
}
