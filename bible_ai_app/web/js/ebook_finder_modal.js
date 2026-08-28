/**
 * Open Shema - E-book & Bible Finder Modal Controller
 * Recherche d'e-books et Bibles 100% numériques à travers les librairies chrétiennes francophones.
 * RÈGLE STRICTE : 100% icônes SVG, aucun émoji, compatible thèmes sombre/clair/sépia.
 */

const EbookFinderModal = {
  modalEl: null,
  inputEl: null,
  resultsEl: null,
  directLinksEl: null,
  statusEl: null,
  currentQuery: '',
  isSearching: false,
  debounceTimer: null,

  // Icônes SVG standardisées Open Shema
  svg: {
    search: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>`,
    book: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M6 6h10"/><path d="M6 10h10"/></svg>`,
    close: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    external: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`,
    tag: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"/><path d="M7 7h.01"/></svg>`,
    store: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/><circle cx="12" cy="12" r="2"/></svg>`,
    digital: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/><path d="m14 9 3 3-3 3"/></svg>`,
    spinner: `<svg class="spin-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`
  },

  init() {
    this._createModalDom();
  },

  _createModalDom() {
    if (document.getElementById('ebook-finder-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'ebook-finder-modal';
    modal.className = 'modal-backdrop custom-finder-modal';
    modal.style.display = 'none';

    modal.innerHTML = `
      <div class="modal-dialog ebook-finder-dialog" style="max-width: 900px; width: 92%; max-height: 88vh; display: flex; flex-direction: column; background: var(--bg-primary, #1e2430); color: var(--text-primary, #e2e8f0); border-radius: 12px; border: 1px solid var(--border-color, rgba(255,255,255,0.1)); box-shadow: 0 20px 40px rgba(0,0,0,0.45); overflow: hidden;">
        
        <!-- Header -->
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 18px 24px; border-bottom: 1px solid var(--border-color, rgba(255,255,255,0.1)); background: var(--bg-secondary, #181d27);">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 36px; height: 36px; border-radius: 8px; background: rgba(59, 130, 246, 0.15); color: #3b82f6; display: flex; align-items: center; justify-content: center;">
              ${this.svg.book}
            </div>
            <div>
              <h3 style="margin: 0; font-size: 1.15rem; font-weight: 600; display: flex; align-items: center; gap: 8px;">
                Recherche d'E-books Chrétiens
                <span style="font-size: 0.72rem; padding: 2px 8px; border-radius: 12px; background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); font-weight: 500;">100% Numérique (EPUB/PDF)</span>
              </h3>
              <p style="margin: 3px 0 0 0; font-size: 0.8rem; color: var(--text-muted, #94a3b8);">
                Trouvez et comparez les Bibles et ouvrages numériques chez Bibli'O, BLF Store, Publications Chrétiennes, Fnac & Kobo.
              </p>
            </div>
          </div>
          <button id="btn-close-ebook-finder" style="background: transparent; border: none; color: var(--text-muted, #94a3b8); cursor: pointer; padding: 8px; border-radius: 6px; display: flex; align-items: center; justify-content: center; transition: all 0.2s;" title="Fermer">
            ${this.svg.close}
          </button>
        </div>

        <!-- Search Bar -->
        <div style="padding: 16px 24px 12px 24px; background: var(--bg-primary, #1e2430); border-bottom: 1px solid var(--border-color, rgba(255,255,255,0.06));">
          <div style="position: relative; display: flex; align-items: center;">
            <div style="position: absolute; left: 14px; color: var(--text-muted, #94a3b8); display: flex; align-items: center; pointer-events: none;">
              ${this.svg.search}
            </div>
            <input type="text" id="ebook-finder-search-input" placeholder="Titre d'ouvrage, version biblique (ex: Nouvelle Français Courant, Segond 21, John Piper)..." 
              style="width: 100%; padding: 12px 42px 12px 40px; border-radius: 8px; border: 1px solid var(--border-color, rgba(255,255,255,0.15)); background: var(--bg-secondary, #141822); color: var(--text-primary, #fff); font-size: 0.95rem; outline: none; transition: border-color 0.2s;">
            <button id="btn-clear-ebook-finder-search" style="position: absolute; right: 12px; background: none; border: none; color: var(--text-muted, #94a3b8); cursor: pointer; padding: 4px; display: none;" title="Effacer">
              ${this.svg.close}
            </button>
          </div>
          <div id="ebook-finder-status" style="margin-top: 10px; font-size: 0.82rem; color: var(--text-muted, #94a3b8); display: flex; align-items: center; justify-content: space-between;">
            <span>Recherchez un e-book ou une Bible numérique</span>
          </div>
        </div>

        <!-- Scrollable Content -->
        <div style="flex: 1; overflow-y: auto; padding: 20px 24px; min-height: 280px; background: var(--bg-primary, #1e2430);">
          
          <!-- Direct Store Links Banner -->
          <div id="ebook-direct-links-section" style="margin-bottom: 22px; display: none;">
            <div style="font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted, #94a3b8); margin-bottom: 10px; font-weight: 600; display: flex; align-items: center; gap: 6px;">
              ${this.svg.store} Rayons E-books directs en 1 clic
            </div>
            <div id="ebook-direct-links-container" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 10px;">
            </div>
          </div>

          <!-- Direct Results Grid -->
          <div id="ebook-finder-results-list" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px;">
            <!-- Empty state par défaut -->
            <div style="grid-column: 1 / -1; text-align: center; padding: 50px 20px; color: var(--text-muted, #94a3b8);">
              <div style="display: inline-flex; padding: 16px; border-radius: 50%; background: rgba(255,255,255,0.03); margin-bottom: 12px;">
                ${this.svg.book}
              </div>
              <p style="font-size: 0.95rem; margin: 0 0 6px 0; font-weight: 500;">Recherche instantanée d'e-books chrétiens</p>
              <p style="font-size: 0.82rem; margin: 0; opacity: 0.8;">Tapez le titre d'une Bible ou d'un livre chrétien pour comparer les disponibilités et prix numériques.</p>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div style="padding: 12px 24px; border-top: 1px solid var(--border-color, rgba(255,255,255,0.08)); background: var(--bg-secondary, #181d27); display: flex; align-items: center; justify-content: space-between; font-size: 0.78rem; color: var(--text-muted, #94a3b8);">
          <div>
            <span>Sources : Éditions Bibli'O, BLF Store, Publications Chrétiennes, Google Play, Fnac, Kobo</span>
          </div>
          <button id="btn-close-ebook-finder-footer" class="btn btn-secondary" style="padding: 6px 14px; font-size: 0.82rem; border-radius: 6px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); color: var(--text-primary, #fff); cursor: pointer;">
            Fermer
          </button>
        </div>

      </div>
    `;

    document.body.appendChild(modal);

    // Initialisation des références DOM
    this.modalEl = modal;
    this.inputEl = document.getElementById('ebook-finder-search-input');
    this.resultsEl = document.getElementById('ebook-finder-results-list');
    this.directLinksEl = document.getElementById('ebook-direct-links-container');
    this.statusEl = document.getElementById('ebook-finder-status');

    // Écouteurs d'événements
    document.getElementById('btn-close-ebook-finder')?.addEventListener('click', () => this.close());
    document.getElementById('btn-close-ebook-finder-footer')?.addEventListener('click', () => this.close());

    modal.addEventListener('click', (e) => {
      if (e.target === modal) this.close();
    });

    const clearBtn = document.getElementById('btn-clear-ebook-finder-search');
    clearBtn?.addEventListener('click', () => {
      this.inputEl.value = '';
      clearBtn.style.display = 'none';
      this.inputEl.focus();
      this.renderEmptyState();
    });

    this.inputEl.addEventListener('input', () => {
      const q = this.inputEl.value.trim();
      clearBtn.style.display = q ? 'block' : 'none';
      clearTimeout(this.debounceTimer);
      if (!q) {
        this.renderEmptyState();
        return;
      }
      this.debounceTimer = setTimeout(() => {
        this.search(q);
      }, 300);
    });

    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        clearTimeout(this.debounceTimer);
        this.search(this.inputEl.value.trim());
      } else if (e.key === 'Escape') {
        this.close();
      }
    });
  },

  open(initialQuery = '') {
    if (!this.modalEl) {
      this.init();
    }
    this.modalEl.style.display = 'flex';
    if (initialQuery) {
      this.inputEl.value = initialQuery;
      document.getElementById('btn-clear-ebook-finder-search').style.display = 'block';
      this.search(initialQuery);
    } else {
      setTimeout(() => this.inputEl.focus(), 80);
    }
  },

  close() {
    if (this.modalEl) {
      this.modalEl.style.display = 'none';
    }
  },

  renderEmptyState() {
    document.getElementById('ebook-direct-links-section').style.display = 'none';
    this.statusEl.innerHTML = `<span>Recherchez un e-book ou une Bible numérique</span>`;
    this.resultsEl.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 50px 20px; color: var(--text-muted, #94a3b8);">
        <div style="display: inline-flex; padding: 16px; border-radius: 50%; background: rgba(255,255,255,0.03); margin-bottom: 12px;">
          ${this.svg.book}
        </div>
        <p style="font-size: 0.95rem; margin: 0 0 6px 0; font-weight: 500;">Recherche instantanée d'e-books chrétiens</p>
        <p style="font-size: 0.82rem; margin: 0; opacity: 0.8;">Tapez le titre d'une Bible ou d'un livre chrétien pour comparer les disponibilités et prix numériques.</p>
      </div>
    `;
  },

  async search(query) {
    if (!query) return;
    this.currentQuery = query;
    this.isSearching = true;

    this.statusEl.innerHTML = `
      <span style="display: flex; align-items: center; gap: 8px;">
        ${this.svg.spinner} Recherche en direct dans les librairies chrétiennes...
      </span>
    `;

    this.resultsEl.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: var(--text-muted, #94a3b8);">
        <div style="display: inline-flex; animation: spin 1s linear infinite; margin-bottom: 12px;">
          ${this.svg.spinner}
        </div>
        <p style="font-size: 0.9rem; margin: 0;">Interrogation de Bibli'O, BLF Store, Publications Chrétiennes et Google Play...</p>
      </div>
    `;

    try {
      const data = await API.call('search_christian_ebooks', query);
      this.isSearching = false;

      if (!data || this.currentQuery !== query) return;

      const results = data.results || [];
      const directLinks = data.direct_links || [];

      // 1. Mise à jour du statut
      this.statusEl.innerHTML = `
        <span><strong>${results.length}</strong> e-book(s) trouvé(s) pour « <em>${this._escapeHtml(query)}</em> »</span>
        <span style="font-size: 0.75rem; color: #10b981; display: flex; align-items: center; gap: 4px;">
          ${this.svg.digital} Formats 100% numériques
        </span>
      `;

      // 2. Rendu des liens directs de magasins
      const directSection = document.getElementById('ebook-direct-links-section');
      if (directLinks.length > 0) {
        directSection.style.display = 'block';
        this.directLinksEl.innerHTML = directLinks.map(dl => `
          <a href="#" data-url="${this._escapeHtml(dl.url)}" class="ebook-direct-link-card" style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-radius: 8px; background: var(--bg-secondary, #141822); border: 1px solid var(--border-color, rgba(255,255,255,0.08)); text-decoration: none; color: inherit; transition: all 0.2s;">
            <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
              <span style="font-size: 0.75rem; padding: 2px 7px; border-radius: 4px; background: rgba(59, 130, 246, 0.15); color: #60a5fa; font-weight: 600; white-space: nowrap;">${this._escapeHtml(dl.badge)}</span>
              <span style="font-size: 0.82rem; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${this._escapeHtml(dl.source)}</span>
            </div>
            <div style="color: var(--text-muted, #94a3b8); margin-left: 8px; display: flex; align-items: center;">
              ${this.svg.external}
            </div>
          </a>
        `).join('');

        // Écouteurs pour ouverture via PyWebView / navigateur natif
        this.directLinksEl.querySelectorAll('.ebook-direct-link-card').forEach(el => {
          el.addEventListener('click', (e) => {
            e.preventDefault();
            const url = el.getAttribute('data-url');
            if (url) API.call('open_external_url', url);
          });
        });
      } else {
        directSection.style.display = 'none';
      }

      // 3. Rendu des résultats d'e-books
      if (results.length === 0) {
        this.resultsEl.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; padding: 40px 20px; color: var(--text-muted, #94a3b8);">
            <p style="font-size: 0.95rem; margin: 0 0 6px 0; font-weight: 500;">Aucun e-book direct trouvé dans les catalogues JSON.</p>
            <p style="font-size: 0.82rem; margin: 0;">Vous pouvez consulter directement les rayons numériques via les boutons Fnac, Kobo et Maison de la Bible ci-dessus.</p>
          </div>
        `;
        return;
      }

      this.resultsEl.innerHTML = results.map(item => `
        <div class="ebook-result-card" style="display: flex; flex-direction: column; border-radius: 10px; background: var(--bg-secondary, #141822); border: 1px solid var(--border-color, rgba(255,255,255,0.08)); padding: 14px; transition: transform 0.2s, border-color 0.2s; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
          
          <div style="display: flex; gap: 12px; margin-bottom: 12px;">
            <!-- Miniature couverture -->
            <div style="width: 60px; height: 85px; flex-shrink: 0; border-radius: 6px; background: rgba(255,255,255,0.04); overflow: hidden; display: flex; align-items: center; justify-content: center; border: 1px solid rgba(255,255,255,0.05);">
              ${item.image ? `<img src="${this._escapeHtml(item.image)}" alt="Cover" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.style.display='none'">` : this.svg.book}
            </div>

            <!-- Infos principales -->
            <div style="flex: 1; min-width: 0; display: flex; flex-direction: column;">
              <span style="display: inline-block; align-self: flex-start; font-size: 0.7rem; font-weight: 600; padding: 2px 6px; border-radius: 4px; background: rgba(59, 130, 246, 0.15); color: #60a5fa; margin-bottom: 4px;">
                ${this._escapeHtml(item.store_badge || item.source)}
              </span>
              <h4 style="margin: 0 0 4px 0; font-size: 0.88rem; font-weight: 600; line-height: 1.3; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;" title="${this._escapeHtml(item.title)}">
                ${this._escapeHtml(item.title)}
              </h4>
              ${item.authors ? `<div style="font-size: 0.78rem; color: var(--text-muted, #94a3b8); margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${this._escapeHtml(item.authors)}</div>` : ''}
              <div style="margin-top: auto; font-size: 0.74rem; color: var(--text-muted, #94a3b8); display: flex; align-items: center; gap: 4px;">
                ${this.svg.digital} <span>${this._escapeHtml(item.format || 'EPUB')}</span>
              </div>
            </div>
          </div>

          <!-- Bottom: Prix & Bouton Achat -->
          <div style="display: flex; align-items: center; justify-content: space-between; margin-top: auto; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.06);">
            <div style="font-size: 1.05rem; font-weight: 700; color: #10b981;">
              ${this._escapeHtml(item.price)}
            </div>
            <button class="btn-buy-ebook-link" data-url="${this._escapeHtml(item.url)}" style="display: flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 6px; background: #2563eb; color: #fff; border: none; font-size: 0.8rem; font-weight: 500; cursor: pointer; transition: background 0.2s;" title="Ouvrir sur la librairie">
              <span>Acheter / Voir</span>
              ${this.svg.external}
            </button>
          </div>

        </div>
      `).join('');

      // Écouteurs pour les boutons d'achat
      this.resultsEl.querySelectorAll('.btn-buy-ebook-link').forEach(btn => {
        btn.addEventListener('click', () => {
          const url = btn.getAttribute('data-url');
          if (url) API.call('open_external_url', url);
        });
      });

    } catch (err) {
      this.isSearching = false;
      this.statusEl.innerHTML = `<span style="color: #ef4444;">Erreur lors de la recherche</span>`;
      this.resultsEl.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 40px 20px; color: var(--text-muted, #94a3b8);">
          <p style="color: #ef4444; margin-bottom: 6px;">Impossible de contacter les librairies actuellement.</p>
          <p style="font-size: 0.82rem;">Détail : ${this._escapeHtml(String(err))}</p>
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
  }
};

// Initialisation globale
window.EbookFinderModal = EbookFinderModal;
