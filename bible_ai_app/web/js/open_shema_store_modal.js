/**
 * Open Shema Store / Data Hub Modal Controller
 * Permet de parcourir et télécharger les ouvrages du catalogue officiel open-shema-data en un clic.
 * RÈGLE STRICTE : 100% icônes SVG, aucun émoji.
 */

const OpenShemaStore = {
  catalogUrl: 'https://raw.githubusercontent.com/Similarly1/open-shema-data/main/catalog.json',
  catalogData: null,
  installedIds: new Set(),
  installedCodes: new Set(),
  activeCategory: 'all',
  searchQuery: '',
  isDownloading: {},

  // Icônes SVG standardisées
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
    cloud: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>`
  },

  init() {
    this._createModalDom();
    this.refreshInstalledCache();
  },

  async refreshInstalledCache() {
    try {
      this.installedIds.clear();
      this.installedCodes.clear();

      // 1. Détection exhaustive depuis le backend (fichiers présents sur disque, dictionnaires, bibles)
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

      // 2. Bibles enregistrées dans BibleReader
      if (typeof BibleReader !== 'undefined' && BibleReader.installedBibles) {
        BibleReader.installedBibles.forEach(b => {
          if (b.name) this.installedIds.add(b.name.toLowerCase());
          if (b.version_code) this.installedCodes.add(b.version_code.toUpperCase());
          if (b.folder_name) this.installedIds.add(b.folder_name.toLowerCase());
        });
      }

      // 3. Ouvrages de la bibliothèque
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

  /**
   * Calcule le nombre de Bibles distantes qui ne sont PAS encore installées/actives dans le lecteur.
   */
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

      if (!isInstalled) {
        missingCount++;
      }
    }

    return missingCount;
  },

  _isModuleInstalled(module) {
    const id = (module.id || '').toLowerCase();
    const abbr = (module.abbreviation || '').toUpperCase();
    const cleanId = id.replace(/^(bible-|dict-|comm-|theology-|dataset-)/, '');

    if (this.installedIds.has(id) || this.installedIds.has(cleanId)) return true;
    if (abbr && (this.installedCodes.has(abbr) || this.installedIds.has(abbr.toLowerCase()))) return true;

    // Détections spécifiques
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
    modal.innerHTML = `
      <div class="modal-card store-modal-card">
        <div class="store-modal-header">
          <div class="store-modal-title-wrap">
            <div class="store-title-icon">${this.svgIcons.cloud}</div>
            <div>
              <h3 class="store-modal-title">Catalogue Open Shema</h3>
              <p class="store-modal-sub">Ressources bibliques, lexiques et théologie libres de droits</p>
            </div>
          </div>
          <button id="btn-close-store-modal" class="btn-icon-close" title="Fermer">
            ${this.svgIcons.close}
          </button>
        </div>

        <div class="store-toolbar">
          <div class="store-search-wrap">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" id="store-search-input" placeholder="Rechercher une version, un livre ou un auteur..." autocomplete="off">
          </div>

          <div class="store-categories-bar" id="store-categories-bar">
            <button class="store-cat-pill active" data-cat="all">Tous</button>
            <button class="store-cat-pill" data-cat="bibles">Bibles</button>
            <button class="store-cat-pill" data-cat="dictionaries">Dictionnaires</button>
            <button class="store-cat-pill" data-cat="commentaries">Commentaires</button>
            <button class="store-cat-pill" data-cat="theology">Théologie</button>
            <button class="store-cat-pill" data-cat="datasets">Jeux de Données</button>
          </div>
        </div>

        <div class="store-content-body" id="store-cards-container">
          <div class="store-loading-state">
            ${this.svgIcons.refresh}
            <span>Chargement du catalogue officiel...</span>
          </div>
        </div>

        <div class="store-modal-footer">
          <div class="store-footer-meta">
            <span>Dépôt officiel : <a href="https://github.com/Similarly1/open-shema-data" target="_blank" rel="noopener">open-shema-data</a></span>
          </div>
          <button id="btn-refresh-store" class="btn-store-secondary" title="Rafraîchir le catalogue">
            ${this.svgIcons.refresh}
            <span>Actualiser</span>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Événements
    modal.querySelector('#btn-close-store-modal').addEventListener('click', () => this.close());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) this.close();
    });

    const searchInput = modal.querySelector('#store-search-input');
    searchInput.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.toLowerCase().trim();
      this.render();
    });

    modal.querySelectorAll('.store-cat-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        modal.querySelectorAll('.store-cat-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeCategory = btn.dataset.cat || 'all';
        this.render();
      });
    });

    modal.querySelector('#btn-refresh-store').addEventListener('click', async () => {
      const btn = modal.querySelector('#btn-refresh-store');
      btn.classList.add('spinning');
      await this.refreshInstalledCache();
      await this.fetchCatalog();
      btn.classList.remove('spinning');
      this.render();
    });
  },

  async open(categoryFilter = null) {
    this._createModalDom();
    const modal = document.getElementById('modal-open-shema-store');
    if (!modal) return;

    if (categoryFilter) {
      this.activeCategory = categoryFilter;
      modal.querySelectorAll('.store-cat-pill').forEach(b => {
        b.classList.toggle('active', b.dataset.cat === categoryFilter);
      });
    }

    modal.classList.remove('hidden');
    document.getElementById('store-search-input')?.focus();

    await this.refreshInstalledCache();
    if (!this.catalogData) {
      await this.fetchCatalog();
    }
    this.render();
  },

  close() {
    const modal = document.getElementById('modal-open-shema-store');
    if (modal) modal.classList.add('hidden');
  },

  render() {
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
      // Filtre catégorie
      if (this.activeCategory !== 'all') {
        if (this.activeCategory === 'bibles' && m.type !== 'bible') return false;
        if (this.activeCategory === 'dictionaries' && m.type !== 'dictionary') return false;
        if (this.activeCategory === 'commentaries' && m.type !== 'commentary') return false;
        if (this.activeCategory === 'theology' && m.type !== 'theology') return false;
        if (this.activeCategory === 'datasets' && m.type !== 'dataset') return false;
      }

      // Filtre recherche
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
      container.innerHTML = `
        <div class="store-empty-state">
          <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/></svg>
          <p>Aucun ouvrage ne correspond à votre recherche dans cette catégorie.</p>
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
          <h4 class="store-card-title">${m.title}</h4>
          <div class="store-card-author">${m.author || 'Domaine Public'}</div>
          <p class="store-card-desc">${m.description || ''}</p>
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

  async downloadModule(module) {
    if (this.isDownloading[module.id]) return;
    this.isDownloading[module.id] = true;
    this.render();

    try {
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast(`Téléchargement de ${module.title}...`);
      }

      const res = await API.call('download_and_install_catalog_module', module);
      if (res && res.success) {
        if (typeof App !== 'undefined' && App.showToast) {
          App.showToast(`${module.title} a été installé avec succès.`);
        }
        
        await this.refreshInstalledCache();

        // Si c'est une Bible, actualiser BibleReader
        if (module.type === 'bible' && typeof BibleReader !== 'undefined' && BibleReader.loadInstalledBibles) {
          await BibleReader.loadInstalledBibles();
        }

        // Si la bibliothèque est ouverte, l'actualiser
        if (typeof LibraryView !== 'undefined' && LibraryView.loadBooks) {
          LibraryView.loadBooks();
        }
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
      this.render();
    }
  }
};

window.OpenShemaStore = OpenShemaStore;
document.addEventListener('DOMContentLoaded', () => {
  OpenShemaStore.init();
});
