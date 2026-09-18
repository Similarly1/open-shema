/**
 * Bible Comparison Hub — Open Shema
 * 
 * Hub unifié de comparaison textuelle et synoptique pour le lecteur biblique :
 * - Double Vue (défilement parallèle en 2 colonnes avec switch interactif)
 * - Matrice Multi-Traductions (custom dropdown picker avec recherche instantanée, variantes douces)
 * - Harmonie des Évangiles (synopse 4 colonnes Mt // Mc // Lc // Jn avec texte intégral et accords)
 * 
 * Directives :
 * - 100% SVG purs vectoriels (zéro émoji).
 * - Intégration transparente dans la Page Bible.
 */

const BibleComparisonHub = {
  // Éléments du DOM
  btnCompareMenuEl: null,
  popoverEl: null,
  gospelBadgeEl: null,
  optSplitEl: null,
  splitSwitchEl: null,
  optMatrixEl: null,
  optSynopsisEl: null,

  // Éléments de l'overlay de comparaison
  overlayEl: null,
  overlayWindowEl: null,
  overlayBodyEl: null,
  overlayTitleEl: null,
  overlaySubtitleEl: null,
  overlayIconEl: null,
  btnCloseOverlayEl: null,
  btnFullscreenOverlayEl: null,

  // État local
  isOpen: false,
  activeMode: null, // 'matrix' | 'synopsis'
  currentReference: null,
  currentBook: 'Gen',
  currentChapter: 1,
  currentBible: 'LSG',
  currentData: null,
  isLoading: false,

  diffOptions: {
    enabled: true,
    showAdded: true,
    showRemoved: true,
    hideRemoved: false
  },
  synopticVersions: {
    v1: 'LSG',
    v2: 'BDJ',
    v3: 'TOB'
  },
  gospelSynopsisState: {
    activePericopeId: null,
    pivotBook: 'MAT',
    colLangs: { MAT: 'fr', MRK: 'fr', LUK: 'fr', JHN: 'fr' },
    diffEnabled: true,
    viewMode: 'full' // 'full' (texte intégral) | 'refs' (références seules)
  },

  // Icônes SVG vectorielles sobres (100% pures, zéro émoji)
  ICONS: {
    layers: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>',
    columns: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="18" x="3" y="3" rx="1.5"/><rect width="8" height="18" x="13" y="3" rx="1.5"/></svg>',
    compass: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>',
    matrix: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/><path d="M15 3v18"/></svg>',
    check: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    close: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    expand: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>',
    search: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    bookText: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M6 6h10"/><path d="M6 10h10"/></svg>',
    listRefs: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>'
  },

  GOSPEL_BOOKS: ['Mat', 'Mar', 'Luk', 'Joh', 'MAT', 'MRK', 'LUK', 'JHN'],

  init() {
    this.btnCompareMenuEl = document.getElementById('btn-reader-compare-menu');
    this.popoverEl = document.getElementById('reader-compare-popover');
    this.gospelBadgeEl = document.getElementById('badge-gospel-available');
    this.optSplitEl = document.getElementById('btn-compare-opt-split');
    this.splitSwitchEl = document.getElementById('compare-split-switch');
    this.optMatrixEl = document.getElementById('btn-compare-opt-matrix');
    this.optSynopsisEl = document.getElementById('btn-compare-opt-synopsis');

    this.overlayEl = document.getElementById('reader-comparison-overlay');
    this.overlayWindowEl = document.getElementById('comp-overlay-window');
    this.overlayBodyEl = document.getElementById('comp-overlay-body');
    this.overlayTitleEl = document.getElementById('comp-overlay-title');
    this.overlaySubtitleEl = document.getElementById('comp-overlay-subtitle');
    this.overlayIconEl = document.getElementById('comp-overlay-mode-icon');
    this.btnCloseOverlayEl = document.getElementById('btn-comp-overlay-close');
    this.btnFullscreenOverlayEl = document.getElementById('btn-comp-overlay-fullscreen');

    this.bindEvents();
    this.updateSplitStatus(typeof BibleReader !== 'undefined' && BibleReader.isSplitView);
  },

  bindEvents() {
    // 1. Bascule du menu popover
    this.btnCompareMenuEl?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.togglePopover();
    });

    // Fermeture du popover au clic en dehors
    document.addEventListener('click', (e) => {
      if (this.popoverEl && !this.popoverEl.classList.contains('hidden')) {
        if (!this.popoverEl.contains(e.target) && !this.btnCompareMenuEl?.contains(e.target)) {
          this.closePopover();
        }
      }
    });

    // Fermeture immédiate si d'autres boutons de la barre d'outils sont cliqués
    document.getElementById('btn-toggle-interlinear')?.addEventListener('click', () => {
      this.closePopover();
    });
    document.getElementById('btn-display-options')?.addEventListener('click', () => {
      this.closePopover();
    });
    document.getElementById('top-hl-palette-pill')?.addEventListener('click', () => {
      this.closePopover();
    });
    document.getElementById('book-picker-pill')?.addEventListener('click', () => {
      this.closePopover();
    });

    // 2. Option Double Vue (clic sur la carte ou le switch)
    this.optSplitEl?.addEventListener('click', (e) => {
      if (typeof BibleReader !== 'undefined') {
        BibleReader.toggleSplitView();
        this.updateSplitStatus(BibleReader.isSplitView);
      }
      this.closePopover();
    });

    // 3. Option Comparer les versions (Matrice)
    this.optMatrixEl?.addEventListener('click', () => {
      this.closePopover();
      this.openMatrix();
    });

    // 4. Option Harmonie des Évangiles (Synopse)
    this.optSynopsisEl?.addEventListener('click', () => {
      this.closePopover();
      this.openGospelSynopsis();
    });

    // 5. Fermeture de l'overlay
    this.btnCloseOverlayEl?.addEventListener('click', () => {
      this.closeOverlay();
    });

    document.getElementById('comp-overlay-backdrop')?.addEventListener('click', () => {
      this.closeOverlay();
    });

    // Plein écran
    this.btnFullscreenOverlayEl?.addEventListener('click', () => {
      this.overlayWindowEl?.classList.toggle('fullscreen');
      const isFull = this.overlayWindowEl?.classList.contains('fullscreen');
      this.btnFullscreenOverlayEl.classList.toggle('active', isFull);
    });

    // Touche Échap
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        // Si un picker custom est ouvert dans l'overlay, fermer le picker en priorité
        const openPicker = document.querySelector('.version-picker-menu:not(.hidden)');
        if (openPicker) {
          openPicker.classList.add('hidden');
          return;
        }

        if (this.isOpen) {
          this.closeOverlay();
        } else if (this.popoverEl && !this.popoverEl.classList.contains('hidden')) {
          this.closePopover();
        }
      }
    });
  },

  togglePopover() {
    if (!this.popoverEl) return;
    const isHidden = this.popoverEl.classList.contains('hidden');
    if (isHidden) {
      // Fermer tous les popovers concurrents de la barre d'outils
      if (typeof InterlinearMenu !== 'undefined' && typeof InterlinearMenu.closePopover === 'function') {
        InterlinearMenu.closePopover();
      } else {
        const interlinearPopover = document.getElementById('interlinear-options-popover');
        if (interlinearPopover) interlinearPopover.classList.add('hidden');
      }
      const displayPopover = document.getElementById('display-options-popover');
      if (displayPopover) displayPopover.classList.add('hidden');
      const hlDropdown = document.getElementById('top-hl-picker-dropdown');
      if (hlDropdown) hlDropdown.classList.add('hidden');

      this.updateGospelState();
      this.popoverEl.classList.remove('hidden');
      this.btnCompareMenuEl?.classList.add('active');
    } else {
      this.closePopover();
    }
  },

  closePopover() {
    if (!this.popoverEl) return;
    this.popoverEl.classList.add('hidden');
    this.btnCompareMenuEl?.classList.remove('active');
  },

  updateSplitStatus(isSplit) {
    if (this.splitSwitchEl) {
      this.splitSwitchEl.checked = !!isSplit;
    }
    if (this.optSplitEl) {
      this.optSplitEl.classList.toggle('active', !!isSplit);
    }
  },

  updateGospelState(bookCode = null) {
    const currentBook = bookCode || (typeof BibleReader !== 'undefined' && BibleReader.currentBook) || this.currentBook;
    const isGospel = this.GOSPEL_BOOKS.includes(currentBook);

    if (this.gospelBadgeEl) {
      this.gospelBadgeEl.classList.toggle('hidden', !isGospel);
    }

    const badgeTextEl = document.getElementById('compare-gospel-badge-text');
    const descEl = document.getElementById('compare-gospel-desc');

    if (this.optSynopsisEl) {
      if (isGospel) {
        this.optSynopsisEl.classList.remove('disabled');
        if (badgeTextEl) {
          badgeTextEl.textContent = 'Disponible';
          badgeTextEl.className = 'compare-item-badge-gospel available';
        }
        if (descEl) descEl.textContent = 'Synopse en 4 colonnes';
      } else {
        this.optSynopsisEl.classList.add('disabled');
        if (badgeTextEl) {
          badgeTextEl.textContent = 'Hors Évangiles';
          badgeTextEl.className = 'compare-item-badge-gospel disabled';
        }
        if (descEl) descEl.textContent = 'Actif dans les 4 Évangiles';
      }
    }
  },

  async openMatrix(ref = null, bible = null) {
    this.activeMode = 'matrix';
    this.resolveCurrentLocation(ref, bible);

    if (this.overlayTitleEl) this.overlayTitleEl.textContent = 'Comparaison des versions & traductions';
    if (this.overlaySubtitleEl) this.overlaySubtitleEl.textContent = `${this.currentReference} (${this.currentBible})`;
    if (this.overlayIconEl) this.overlayIconEl.innerHTML = this.ICONS.matrix;

    this.showOverlay();
    await this.loadMatrixData();
  },

  async openGospelSynopsis(ref = null) {
    this.resolveCurrentLocation(ref);
    const isGospel = this.GOSPEL_BOOKS.includes(this.currentBook);
    if (!isGospel) {
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast("L'harmonie synoptique est réservée aux 4 Évangiles (Mt, Mc, Lc, Jn).", "info");
      }
      return;
    }

    this.activeMode = 'synopsis';
    if (this.overlayTitleEl) this.overlayTitleEl.textContent = 'Harmonie synoptique des Évangiles';
    if (this.overlaySubtitleEl) this.overlaySubtitleEl.textContent = `Péricopes parallèles pour ${this.currentReference}`;
    if (this.overlayIconEl) this.overlayIconEl.innerHTML = this.ICONS.compass;

    this.showOverlay();
    await this.loadGospelSynopsisData();
  },

  resolveCurrentLocation(ref = null, bible = null) {
    if (typeof BibleReader !== 'undefined') {
      this.currentBook = BibleReader.currentBook || 'Gen';
      this.currentChapter = BibleReader.currentChapter || 1;
      this.currentBible = bible || BibleReader.currentBible || 'LSG';
      const verse = BibleReader.selectedVerse || 1;
      this.currentReference = ref || `${this.currentBook} ${this.currentChapter}`;
    } else {
      this.currentReference = ref || 'Genèse 1';
      this.currentBible = bible || 'LSG';
    }
    this.synopticVersions.v1 = this.currentBible || 'LSG';
  },

  showOverlay() {
    this.isOpen = true;
    if (this.overlayEl) {
      this.overlayEl.classList.remove('hidden');
      document.body.classList.add('modal-open');
    }
  },

  closeOverlay() {
    this.isOpen = false;
    this.activeMode = null;
    if (this.overlayEl) {
      this.overlayEl.classList.add('hidden');
      document.body.classList.remove('modal-open');
    }
    if (this.overlayWindowEl?.classList.contains('fullscreen')) {
      this.overlayWindowEl.classList.remove('fullscreen');
      this.btnFullscreenOverlayEl?.classList.remove('active');
    }
  },

  // =========================================================================
  // GESTION DE LA MATRICE MULTI-TRADUCTIONS
  // =========================================================================

  async loadMatrixData() {
    if (!this.overlayBodyEl) return;
    this.overlayBodyEl.innerHTML = `
      <div class="comp-loading-box">
        <div class="comp-spinner"></div>
        <div class="comp-loading-text">Chargement des traductions et calcul des variantes mot-à-mot...</div>
      </div>
    `;

    try {
      const data = await API.getPassageStudyData(this.currentReference, this.currentBible);
      if (!data || !data.success) {
        this.overlayBodyEl.innerHTML = `
          <div class="comp-empty-box">
            <p>Impossible de charger la comparaison pour ${this.escapeHtml(this.currentReference)}.</p>
          </div>
        `;
        return;
      }

      this.currentData = data;
      if (this.overlaySubtitleEl && data.reference) {
        this.overlaySubtitleEl.textContent = `${data.reference} · ${data.scripture?.verses?.length || 0} versets`;
      }

      this.renderMatrixView();
    } catch (err) {
      console.error('[BibleComparisonHub] Erreur loadMatrixData:', err);
      this.overlayBodyEl.innerHTML = `
        <div class="comp-empty-box">
          <p>Erreur lors de la récupération des données.</p>
        </div>
      `;
    }
  },

  getBibleShortCode(bibleCode, metaMap = {}) {
    if (!bibleCode) return '';
    const clean = bibleCode.trim();
    const SHORT_MAP = {
      'Segond_21': 'S21',
      'segond_21': 'S21',
      'Parole_Vivante': 'PV',
      'parole_vivante': 'PV',
      'Prophetie_Vivante': 'PViv',
      'PDV2017': 'PDV',
      'DARBY': 'DARBY',
      'CAHEN': 'Cahen',
      'BENFS': 'BFC',
      'NEG79': 'NEG',
      'JXLFR': 'JXL',
      'LAU': 'Lausanne',
      'OST': 'OST',
      'BDJ': 'BDJ',
      'TOB': 'TOB',
      'BDS': 'BDS',
      'NFC': 'NFC',
      'NBS': 'NBS',
      'LSG': 'LSG'
    };
    if (SHORT_MAP[clean]) return SHORT_MAP[clean];
    const meta = metaMap[clean] || {};
    if (meta.code && meta.code.length <= 6) return meta.code;
    return clean;
  },

  formatPresetShortLabel(preset, metaMap = {}) {
    const v2Short = this.getBibleShortCode(preset.v2, metaMap);
    const v3Short = this.getBibleShortCode(preset.v3, metaMap);

    if (v2Short && v3Short) {
      return `${v2Short} vs ${v3Short}`;
    } else if (v2Short) {
      return v2Short;
    } else if (v3Short) {
      return v3Short;
    }

    let lbl = preset.label || '';
    return lbl.replace(/Littérale vs Dynamique/i, 'DARBY vs BDS')
              .replace(/Jérusalem vs TOB/i, 'BDJ vs TOB')
              .replace(/Segond 21 vs Semeur/i, 'S21 vs BDS')
              .replace(/Ostervald vs Segond 21/i, 'OST vs S21')
              .replace(/Français Courant vs Parole Vivante/i, 'NFC vs PV');
  },

  renderMatrixView() {
    const sc = this.currentData?.scripture;
    if (!sc || !this.overlayBodyEl) return;

    const availableVersions = sc.available_versions || [];
    const metaMap = sc.versions_metadata || {};
    const presets = sc.comparison_presets || [];

    const v1 = this.synopticVersions.v1 || this.currentBible || 'LSG';
    const v2 = this.synopticVersions.v2 || 'BDJ';
    const v3 = this.synopticVersions.v3 || 'TOB';

    let html = `
      <div class="ps-synoptic-panel" id="hub-synoptic-panel">
        <div class="ps-synoptic-header">
          <!-- Contrôles de variantes (Soft Critique) -->
          <div class="ps-synoptic-diff-controls">
            <button type="button" class="ps-diff-toggle-btn ${this.diffOptions.enabled ? 'active' : ''}" id="hub-btn-toggle-diff" title="Activer / désactiver la mise en valeur des variantes">
              <span class="ps-icon-slot">${this.ICONS.layers}</span>
              <span>Variantes textuelles</span>
            </button>
            <label class="ps-diff-checkbox-label" title="Afficher les mots ajoutés ou spécifiques">
              <input type="checkbox" id="hub-chk-diff-added" ${this.diffOptions.showAdded ? 'checked' : ''} ${!this.diffOptions.enabled ? 'disabled' : ''}>
              <span class="ps-diff-legend-pill ps-diff-added-pill">+ Spécifiques</span>
            </label>
            <label class="ps-diff-checkbox-label" title="Afficher les mots absents par rapport à la référence">
              <input type="checkbox" id="hub-chk-diff-removed" ${this.diffOptions.showRemoved ? 'checked' : ''} ${!this.diffOptions.enabled ? 'disabled' : ''}>
              <span class="ps-diff-legend-pill ps-diff-removed-pill">- Absents</span>
            </label>
            <label class="ps-diff-checkbox-label" title="Masquer entièrement les mots absents pour une lecture fluide">
              <input type="checkbox" id="hub-chk-diff-hide-removed" ${this.diffOptions.hideRemoved ? 'checked' : ''} ${!this.diffOptions.enabled ? 'disabled' : ''}>
              <span class="ps-diff-legend-text">Lecture épurée</span>
            </label>
          </div>

          <!-- Custom Pickers de versions (remplacement moderne des select natifs) -->
          <div class="ps-synoptic-picker-group">
            ${this.buildCustomPickerHTML('v1', 'Réf. (V1)', v1, availableVersions, metaMap, false)}
            ${this.buildCustomPickerHTML('v2', 'Version 2', v2, availableVersions, metaMap, false)}
            ${this.buildCustomPickerHTML('v3', 'Version 3', v3, availableVersions, metaMap, true)}
          </div>
        </div>

        <!-- Ruban de suggestions méthodologiques élégant & horizontal -->
        ${presets.length > 0 ? `
          <div class="ps-synoptic-presets-strip">
            <span class="ps-presets-strip-title">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
              Préréglages :
            </span>
            <div class="ps-presets-strip-scroll">
              ${presets.map(p => {
                const shortLabel = this.formatPresetShortLabel(p, metaMap);
                const badgeText = p.badge === 'Interconfessionnel' ? 'Interconf.' : (p.badge || '');
                const fullDesc = p.description ? `${p.label ? p.label + ' — ' : ''}${p.description}` : (p.label || shortLabel);
                return `
                <button type="button" class="ps-preset-pill ${p.v2 === v2 && p.v3 === v3 ? 'active' : ''}" data-v2="${p.v2}" data-v3="${p.v3}" title="${this.escapeHtml(fullDesc)}">
                  <span class="ps-preset-badge">${this.escapeHtml(badgeText)}</span>
                  <span class="ps-preset-text">${this.escapeHtml(shortLabel)}</span>
                </button>
              `;
              }).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Conteneur du tableau comparatif -->
        <div class="ps-synoptic-table-container" id="hub-synoptic-table-container">
          <!-- Tableau rendu ci-dessous -->
        </div>
      </div>
    `;

    this.overlayBodyEl.innerHTML = html;
    this.renderSynopticTableBody();
    this.bindMatrixEvents(availableVersions, metaMap);
  },

  // Rendu du composant Custom Version Picker (HTML)
  buildCustomPickerHTML(slot, label, currentCode, availableVersions, metaMap, allowEmpty = false) {
    const meta = metaMap[currentCode] || { nom_officiel: currentCode || 'Aucune', philosophie: '' };
    const displayCode = currentCode || '—';
    const displayName = currentCode ? (meta.nom_officiel || currentCode) : 'Aucune version sélectionnée';

    return `
      <div class="version-picker-wrap" id="picker-wrap-${slot}" data-slot="${slot}">
        <span class="version-picker-label">${label} :</span>
        <button type="button" class="version-picker-btn ${slot === 'v1' ? 'is-ref' : ''}" id="picker-btn-${slot}">
          <span class="version-picker-badge ${slot === 'v1' ? 'badge-ref' : ''}">${this.escapeHtml(displayCode)}</span>
          <span class="version-picker-name" title="${this.escapeHtml(displayName)}">${this.escapeHtml(displayName)}</span>
          <span class="version-picker-chevron">▾</span>
        </button>

        <div class="version-picker-menu hidden" id="picker-menu-${slot}">
          <div class="version-picker-search-box">
            <span class="version-picker-search-icon">${this.ICONS.search}</span>
            <input type="text" class="version-picker-search-input" placeholder="Rechercher une version (sigle, nom)...">
          </div>
          <div class="version-picker-options-scroll">
            ${this.buildCustomPickerOptions(availableVersions, metaMap, currentCode, allowEmpty)}
          </div>
        </div>
      </div>
    `;
  },

  // Options groupées par familles théologiques pour le Custom Version Picker
  buildCustomPickerOptions(availableVersions, metaMap, selectedVersion, allowEmpty = false) {
    let html = '';

    if (allowEmpty) {
      const isNone = !selectedVersion;
      html += `
        <div class="version-option-item ${isNone ? 'selected' : ''}" data-code="">
          <span class="version-option-badge badge-empty">—</span>
          <div class="version-option-info">
            <div class="version-option-title">Aucune (comparer 2 versions)</div>
          </div>
          ${isNone ? `<span class="version-option-check">${this.ICONS.check}</span>` : ''}
        </div>
      `;
    }

    const familyOrder = [
      'Famille Segond',
      'Protestante',
      'Évangélique',
      'Catholique',
      'Œcuménique ou Interconfessionnelle',
      'Libérale',
      'Juive',
      'Autre'
    ];

    const groups = {};
    availableVersions.forEach(v => {
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
      html += `
        <div class="version-group-section" data-group-name="${this.escapeHtml(fam.toLowerCase())}">
          <div class="version-group-header">${this.escapeHtml(fam)}</div>
          <div class="version-group-items">
      `;
      items.forEach(({ code, meta }) => {
        const isSel = (selectedVersion && code === selectedVersion);
        html += `
          <div class="version-option-item ${isSel ? 'selected' : ''}" data-code="${code}" data-search="${this.escapeHtml((code + ' ' + (meta.nom_officiel || '') + ' ' + (meta.philosophie || '')).toLowerCase())}">
            <span class="version-option-badge">${this.escapeHtml(code)}</span>
            <div class="version-option-info">
              <div class="version-option-title">${this.escapeHtml(meta.nom_officiel || code)}</div>
              ${meta.philosophie ? `<div class="version-option-meta">${this.escapeHtml(meta.philosophie)}</div>` : ''}
            </div>
            ${isSel ? `<span class="version-option-check">${this.ICONS.check}</span>` : ''}
          </div>
        `;
      });
      html += `</div></div>`;
    });

    return html;
  },

  renderSynopticTableBody() {
    const sc = this.currentData?.scripture;
    const container = document.getElementById('hub-synoptic-table-container');
    if (!sc || !container) return;

    const mainVersion = this.synopticVersions.v1 || sc.main_version || this.currentBible || 'LSG';
    const metaMap = sc.versions_metadata || {};
    const v2Name = this.synopticVersions.v2 || '';
    const v3Name = this.synopticVersions.v3 || '';

    const matrix = sc.synoptic_matrix || [];
    const mainMeta = metaMap[mainVersion] || {};
    const v2Meta = metaMap[v2Name] || {};
    const v3Meta = metaMap[v3Name] || {};

    const colCount = 1 + (v2Name ? 1 : 0) + (v3Name ? 1 : 0);
    const colWidth = (92 / colCount).toFixed(1) + '%';

    let html = `
      <table class="ps-synoptic-table">
        <thead>
          <tr>
            <th style="width: 48px; text-align: center;">V.</th>
            <th style="width: ${colWidth};">
              <div class="ps-th-code">${mainVersion} <span class="ps-th-badge">Référence</span></div>
              <div class="ps-th-meta">${this.escapeHtml(mainMeta.nom_officiel || mainVersion)}${mainMeta.philosophie ? ' · ' + this.escapeHtml(mainMeta.philosophie) : ''}</div>
            </th>
            ${v2Name ? `
              <th style="width: ${colWidth};">
                <div class="ps-th-code">${v2Name}</div>
                <div class="ps-th-meta">${this.escapeHtml(v2Meta.nom_officiel || v2Name)}${v2Meta.philosophie ? ' · ' + this.escapeHtml(v2Meta.philosophie) : ''}</div>
              </th>
            ` : ''}
            ${v3Name ? `
              <th style="width: ${colWidth};">
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
        ? this.computeWordDiff(t1, t2, this.diffOptions.showAdded, this.diffOptions.showRemoved, this.diffOptions.hideRemoved, mainVersion)
        : this.escapeHtml(t2);

      const cell3Html = (v3Name && this.diffOptions.enabled)
        ? this.computeWordDiff(t1, t3, this.diffOptions.showAdded, this.diffOptions.showRemoved, this.diffOptions.hideRemoved, mainVersion)
        : this.escapeHtml(t3);

      html += `
        <tr>
          <td class="ps-syn-cell-v">${row.verse}</td>
          <td class="ps-syn-cell-ref-text">${this.escapeHtml(t1)}</td>
          ${v2Name ? `<td class="ps-syn-cell-comp-text">${cell2Html}</td>` : ''}
          ${v3Name ? `<td class="ps-syn-cell-comp-text">${cell3Html}</td>` : ''}
        </tr>
      `;
    });

    html += `
        </tbody>
      </table>
    `;

    container.innerHTML = html;
  },

  bindMatrixEvents(availableVersions, metaMap) {
    // 1. Bouton bascule globale des variantes
    document.getElementById('hub-btn-toggle-diff')?.addEventListener('click', () => {
      this.diffOptions.enabled = !this.diffOptions.enabled;
      document.getElementById('hub-btn-toggle-diff')?.classList.toggle('active', this.diffOptions.enabled);
      
      const chkAdd = document.getElementById('hub-chk-diff-added');
      const chkRem = document.getElementById('hub-chk-diff-removed');
      const chkHide = document.getElementById('hub-chk-diff-hide-removed');
      if (chkAdd) chkAdd.disabled = !this.diffOptions.enabled;
      if (chkRem) chkRem.disabled = !this.diffOptions.enabled;
      if (chkHide) chkHide.disabled = !this.diffOptions.enabled;

      this.renderSynopticTableBody();
    });

    // 2. Cases à cocher des variantes douces
    document.getElementById('hub-chk-diff-added')?.addEventListener('change', (e) => {
      this.diffOptions.showAdded = e.target.checked;
      this.renderSynopticTableBody();
    });

    document.getElementById('hub-chk-diff-removed')?.addEventListener('change', (e) => {
      this.diffOptions.showRemoved = e.target.checked;
      this.renderSynopticTableBody();
    });

    document.getElementById('hub-chk-diff-hide-removed')?.addEventListener('change', (e) => {
      this.diffOptions.hideRemoved = e.target.checked;
      this.renderSynopticTableBody();
    });

    // 3. Attachement des Custom Version Pickers (v1, v2, v3)
    ['v1', 'v2', 'v3'].forEach(slot => {
      const wrap = document.getElementById(`picker-wrap-${slot}`);
      const btn = document.getElementById(`picker-btn-${slot}`);
      const menu = document.getElementById(`picker-menu-${slot}`);
      const searchInput = menu?.querySelector('.version-picker-search-input');

      btn?.addEventListener('click', (e) => {
        e.stopPropagation();
        // Fermer tous les autres menus ouverts
        document.querySelectorAll('.version-picker-menu').forEach(m => {
          if (m !== menu) m.classList.add('hidden');
        });
        menu?.classList.toggle('hidden');
        if (!menu?.classList.contains('hidden')) {
          searchInput?.focus();
        }
      });

      // Filtrage par recherche instantanée
      searchInput?.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        const items = menu.querySelectorAll('.version-option-item');
        const sections = menu.querySelectorAll('.version-group-section');

        items.forEach(it => {
          const searchData = it.dataset.search || '';
          const match = !query || searchData.includes(query);
          it.style.display = match ? 'flex' : 'none';
        });

        sections.forEach(sec => {
          const visibleItems = sec.querySelectorAll('.version-option-item:not([style*="display: none"])');
          sec.style.display = visibleItems.length > 0 ? 'block' : 'none';
        });
      });

      // Clic sur une option
      menu?.querySelectorAll('.version-option-item').forEach(opt => {
        opt.addEventListener('click', () => {
          const code = opt.dataset.code;
          this.synopticVersions[slot] = code;

          // Mettre à jour le bouton trigger
          const meta = metaMap[code] || { nom_officiel: code || 'Aucune' };
          const badgeEl = btn.querySelector('.version-picker-badge');
          const nameEl = btn.querySelector('.version-picker-name');
          if (badgeEl) badgeEl.textContent = code || '—';
          if (nameEl) nameEl.textContent = code ? (meta.nom_officiel || code) : 'Aucune version sélectionnée';

          // Fermer le menu
          menu.classList.add('hidden');

          // Désélectionner les pilules de preset
          document.querySelectorAll('#hub-synoptic-panel .ps-preset-pill').forEach(b => b.classList.remove('active'));

          // Re-rendre le tableau
          this.renderSynopticTableBody();
        });
      });
    });

    // Fermeture des menus au clic en dehors
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.version-picker-wrap')) {
        document.querySelectorAll('.version-picker-menu').forEach(m => m.classList.add('hidden'));
      }
    });

    // 4. Préréglages méthodologiques (pills horizontales)
    document.querySelectorAll('#hub-synoptic-panel .ps-preset-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        const v2 = pill.dataset.v2;
        const v3 = pill.dataset.v3;

        this.synopticVersions.v2 = v2;
        this.synopticVersions.v3 = v3;

        // Mettre à jour les déclencheurs de v2 et v3
        const btnV2 = document.getElementById('picker-btn-v2');
        const btnV3 = document.getElementById('picker-btn-v3');
        if (btnV2) {
          const m2 = metaMap[v2] || { nom_officiel: v2 };
          btnV2.querySelector('.version-picker-badge').textContent = v2;
          btnV2.querySelector('.version-picker-name').textContent = m2.nom_officiel || v2;
        }
        if (btnV3) {
          const m3 = metaMap[v3] || { nom_officiel: v3 };
          btnV3.querySelector('.version-picker-badge').textContent = v3;
          btnV3.querySelector('.version-picker-name').textContent = m3.nom_officiel || v3;
        }

        document.querySelectorAll('#hub-synoptic-panel .ps-preset-pill').forEach(b => b.classList.remove('active'));
        pill.classList.add('active');
        this.renderSynopticTableBody();
      });
    });
  },

  // =========================================================================
  // GESTION DE L'HARMONIE DES ÉVANGILES
  // =========================================================================

  async loadGospelSynopsisData(customPid = null) {
    if (!this.overlayBodyEl) return;
    this.overlayBodyEl.innerHTML = `
      <div class="comp-loading-box">
        <div class="comp-spinner"></div>
        <div class="comp-loading-text">Alignement narratif et synoptique des 4 Évangiles...</div>
      </div>
    `;

    try {
      const data = await API.getPassageStudyData(this.currentReference, this.currentBible);
      this.currentData = data;
      const synData = data?.gospel_synopsis;

      if (!synData || !synData.has_synoptic) {
        this.overlayBodyEl.innerHTML = `
          <div class="comp-empty-box">
            <p>Aucune péricope parallèle identifiée pour ${this.escapeHtml(this.currentReference)}.</p>
          </div>
        `;
        return;
      }

      if (customPid) {
        this.gospelSynopsisState.activePericopeId = customPid;
      } else if (!this.gospelSynopsisState.activePericopeId) {
        this.gospelSynopsisState.activePericopeId = synData.primary_pericope_id || (synData.pericopes?.[0]?.id);
      }

      this.renderGospelSynopsisView();
    } catch (err) {
      console.error('[BibleComparisonHub] Erreur loadGospelSynopsisData:', err);
      this.overlayBodyEl.innerHTML = `
        <div class="comp-empty-box">
          <p>Erreur lors du chargement de l'harmonie des Évangiles.</p>
        </div>
      `;
    }
  },

  async switchSynopsisPericope(pid) {
    this.gospelSynopsisState.activePericopeId = pid;
    const pivot = this.gospelSynopsisState.pivotBook || 'MAT';
    const activeBible = this.currentBible || 'LSG';
    const res = await API.getSynopticHarmony(pid, activeBible, pivot);
    if (res && res.success && res.matrix) {
      this.renderGospelSynopsisView(res.matrix);
    }
  },

  async switchSynopsisPivot(pivotBook) {
    this.gospelSynopsisState.pivotBook = pivotBook;
    const pid = this.gospelSynopsisState.activePericopeId || this.currentData?.gospel_synopsis?.primary_pericope_id;
    const activeBible = this.currentBible || 'LSG';
    const res = await API.getSynopticHarmony(pid, activeBible, pivotBook);
    if (res && res.success && res.matrix) {
      this.renderGospelSynopsisView(res.matrix);
    }
  },

  renderGospelSynopsisView(customMatrix = null) {
    const synData = this.currentData?.gospel_synopsis;
    if (!synData || !synData.has_synoptic || !this.overlayBodyEl) return;

    const matrix = customMatrix || synData.synopsis_matrix;
    if (!matrix) {
      this.overlayBodyEl.innerHTML = `<div class="comp-empty-box"><p>Aucune harmonie synoptique trouvée pour ce passage.</p></div>`;
      return;
    }

    const pericopes = synData.pericopes || [];
    const activePid = this.gospelSynopsisState.activePericopeId || matrix.pericope_id;
    const pivot = this.gospelSynopsisState.pivotBook || matrix.pivot_book || 'MAT';
    const colLangs = this.gospelSynopsisState.colLangs || { MAT: 'fr', MRK: 'fr', LUK: 'fr', JHN: 'fr' };
    const diffEnabled = this.gospelSynopsisState.diffEnabled;
    const viewMode = this.gospelSynopsisState.viewMode || 'full';

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
    const tradLabel = traditionLabels[matrix.tradition_type] || matrix.tradition_type || 'Synoptique';

    const frenchGospelNames = {
      'MAT': 'Matthieu', 'MRK': 'Marc', 'LUK': 'Luc', 'JHN': 'Jean',
      'Mat': 'Matthieu', 'Mar': 'Marc', 'Luk': 'Luc', 'Joh': 'Jean'
    };
    const frenchGospelAbbrs = {
      'MAT': 'Mt', 'MRK': 'Mc', 'LUK': 'Lc', 'JHN': 'Jn',
      'Mat': 'Mt', 'Mar': 'Mc', 'Luk': 'Lc', 'Joh': 'Jn'
    };
    const toFrenchRef = (rawRef) => {
      if (!rawRef) return '';
      let refStr = rawRef.trim();
      for (const [code, abbr] of Object.entries(frenchGospelAbbrs)) {
        refStr = refStr.replace(new RegExp(`^${code}\\b`, 'i'), abbr);
      }
      return refStr;
    };

    let html = `
      <div class="ps-gospel-synopsis-panel" id="hub-gospel-synopsis-panel">
        <div class="ps-gospel-synopsis-toolbar">
          <div class="ps-synopsis-toolbar-left">
            <div class="ps-synopsis-pericope-select-group">
              <label for="hub-synopsis-pericope-select" class="ps-synopsis-label">Péricope :</label>
              <select id="hub-synopsis-pericope-select" class="ps-select-sm" style="max-width: 320px;">
                ${pericopes.map(p => `
                  <option value="${p.id}" ${p.id === activePid ? 'selected' : ''}>#${p.id} · ${this.escapeHtml(p.title_fr)}</option>
                `).join('')}
              </select>
            </div>
            <span class="ps-synopsis-tradition-badge ${tradClass}">${this.escapeHtml(tradLabel)}</span>
          </div>

          <div class="ps-synoptic-diff-controls">
            <!-- Bascule Affichage : Texte Intégral vs Références Seules -->
            <div class="syn-view-mode-toggle">
              <button type="button" class="syn-mode-btn ${viewMode === 'full' ? 'active' : ''}" id="hub-btn-syn-mode-full" title="Afficher le texte biblique intégral en vis-à-vis">
                <span class="syn-mode-icon">${this.ICONS.bookText}</span>
                <span>Texte intégral</span>
              </button>
              <button type="button" class="syn-mode-btn ${viewMode === 'refs' ? 'active' : ''}" id="hub-btn-syn-mode-refs" title="Afficher uniquement les références (vue structurelle)">
                <span class="syn-mode-icon">${this.ICONS.listRefs}</span>
                <span>Références seules</span>
              </button>
            </div>

            <!-- Accords textuels -->
            <button type="button" class="ps-diff-toggle-btn ${diffEnabled ? 'active' : ''}" id="hub-btn-toggle-gospel-diff" title="Mettre en valeur le vocabulaire partagé entre les évangélistes">
              <span class="ps-icon-slot">${this.ICONS.layers}</span>
              <span>Accords</span>
            </button>
            <span class="ps-diff-legend-pill pill-triple" title="Terme partagé par 3 évangélistes ou plus">Triple (3+)</span>
            <span class="ps-diff-legend-pill pill-double" title="Terme partagé par 2 évangélistes">Double (2)</span>
          </div>
        </div>

        <div class="ps-gospel-synopsis-table-wrap">
          <table class="ps-gospel-synopsis-table ${viewMode === 'refs' ? 'mode-refs-only' : 'mode-full-text'}">
            <thead>
              <tr>
                ${matrix.columns.map(col => {
                  const isPivot = col.book === pivot;
                  const lang = colLangs[col.book] || 'fr';
                  const colWidth = (100 / matrix.columns.length).toFixed(1) + '%';
                  const bookDisplayName = frenchGospelNames[col.book] || col.french_name || col.book;
                  const refDisplayName = toFrenchRef(col.ref || '');
                  return `
                    <th style="width: ${colWidth};" class="${isPivot ? 'ps-syn-th-pivot' : ''}">
                      <div class="ps-syn-col-header-box">
                        <div class="ps-syn-col-header-top">
                          <div class="ps-syn-book-name">
                            <span>${this.escapeHtml(bookDisplayName)}</span>
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
                        <div class="ps-syn-col-ref">${this.escapeHtml(refDisplayName)}</div>
                      </div>
                    </th>
                  `;
                }).join('')}
              </tr>
            </thead>
            <tbody>
      `;

    matrix.rows.forEach(row => {
      const renderedCells = this.renderSynopticRowCells(row.cells, matrix.columns, colLangs, diffEnabled, viewMode);
      html += `<tr>${renderedCells}</tr>`;
    });

    html += `
            </tbody>
          </table>
        </div>
      </div>
    `;

    this.overlayBodyEl.innerHTML = html;

    // Événements de la synopse
    document.getElementById('hub-synopsis-pericope-select')?.addEventListener('change', (e) => {
      const pid = parseInt(e.target.value);
      this.switchSynopsisPericope(pid);
    });

    document.getElementById('hub-btn-syn-mode-full')?.addEventListener('click', () => {
      this.gospelSynopsisState.viewMode = 'full';
      this.renderGospelSynopsisView();
    });

    document.getElementById('hub-btn-syn-mode-refs')?.addEventListener('click', () => {
      this.gospelSynopsisState.viewMode = 'refs';
      this.renderGospelSynopsisView();
    });

    document.getElementById('hub-btn-toggle-gospel-diff')?.addEventListener('click', () => {
      this.gospelSynopsisState.diffEnabled = !this.gospelSynopsisState.diffEnabled;
      this.renderGospelSynopsisView();
    });

    document.querySelectorAll('#hub-gospel-synopsis-panel .ps-btn-pivot').forEach(btn => {
      btn.addEventListener('click', () => {
        const bCode = btn.dataset.pivotBook;
        if (bCode) this.switchSynopsisPivot(bCode);
      });
    });

    document.querySelectorAll('#hub-gospel-synopsis-panel .ps-col-lang-toggle .ps-lang-btn').forEach(btn => {
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

  // Rendu des cellules synoptiques avec texte intégral ou références seules
  renderSynopticRowCells(cells, columns, colLangs, diffEnabled, viewMode) {
    // Calcul des accords lexicaux transversaux pour cette ligne si le diff est activé
    const wordCounts = {};
    if (diffEnabled && viewMode === 'full') {
      const cleanNorm = w => w.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
      columns.forEach(col => {
        const cData = cells[col.book];
        if (!cData || cData.is_empty || cData.empty) return;
        const lang = colLangs[col.book] || 'fr';
        const rawT = (lang === 'gr' ? (cData.text_gr || cData.text_fr) : cData.text_fr) || '';
        const tokens = this.tokenizeWords(rawT);
        const seenInThisCol = new Set();
        tokens.forEach(tok => {
          if (/[a-zA-ZÀ-ÿ0-9]/.test(tok) && tok.length > 2) {
            const root = cleanNorm(tok);
            if (root && !seenInThisCol.has(root)) {
              seenInThisCol.add(root);
              wordCounts[root] = (wordCounts[root] || 0) + 1;
            }
          }
        });
      });
    }

    let cellsHtml = '';
    columns.forEach(col => {
      const bCode = col.book;
      const cellData = cells[bCode];
      const lang = colLangs[bCode] || 'fr';

      const isEmpty = !cellData || cellData.is_empty || cellData.empty;

      if (isEmpty) {
        cellsHtml += `
          <td class="ps-syn-cell ps-syn-cell-empty">
            <div class="syn-cell-empty-dash">—</div>
          </td>
        `;
        return;
      }

      // Rendre la référence de la cellule toujours en français (Mt, Mc, Lc, Jn)
      const toFrenchCellRef = (rawRef) => {
        if (!rawRef) return '';
        let refStr = rawRef.trim();
        const abbrs = {
          'MAT': 'Mt', 'MRK': 'Mc', 'LUK': 'Lc', 'JHN': 'Jn',
          'Mat': 'Mt', 'Mar': 'Mc', 'Luk': 'Lc', 'Joh': 'Jn'
        };
        for (const [code, abbr] of Object.entries(abbrs)) {
          refStr = refStr.replace(new RegExp(`^${code}\\b`, 'i'), abbr);
        }
        return refStr;
      };
      const cellRefDisplay = toFrenchCellRef(cellData.ref || '');

      // 1. Mode Références Seules
      if (viewMode === 'refs') {
        cellsHtml += `
          <td class="ps-syn-cell ps-syn-cell-ref-only">
            <span class="ps-syn-ref-pill">${this.escapeHtml(cellRefDisplay)}</span>
          </td>
        `;
        return;
      }

      // 2. Mode Texte Intégral
      const rawText = (lang === 'gr' ? (cellData.text_gr || cellData.text_fr) : cellData.text_fr) || '';
      let formattedText = '';

      if (diffEnabled && Object.keys(wordCounts).length > 0) {
        const cleanNorm = w => w.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
        const tokens = this.tokenizeWords(rawText);
        formattedText = tokens.map(tok => {
          if (/[a-zA-ZÀ-ÿ0-9]/.test(tok) && tok.length > 2) {
            const root = cleanNorm(tok);
            const count = wordCounts[root] || 1;
            if (count >= 3) {
              return `<span class="syn-word-accord syn-accord-triple" title="Accord partagé par 3+ évangélistes">${this.escapeHtml(tok)}</span>`;
            } else if (count === 2) {
              return `<span class="syn-word-accord syn-accord-double" title="Accord partagé par 2 évangélistes">${this.escapeHtml(tok)}</span>`;
            }
          }
          return this.escapeHtml(tok);
        }).join('');
      } else {
        formattedText = this.escapeHtml(rawText);
      }

      cellsHtml += `
        <td class="ps-syn-cell ${lang === 'gr' ? 'ps-syn-greek-mode' : ''}">
          <div class="syn-verse-card">
            <div class="syn-verse-header">
              <span class="syn-verse-tag">${this.escapeHtml(cellRefDisplay)}</span>
            </div>
            <div class="syn-verse-body">${formattedText}</div>
          </div>
        </td>
      `;
    });

    return cellsHtml;
  },

  // =========================================================================
  // CALCULS DIFF ET TOKENISATION MOT-À-MOT
  // =========================================================================

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

  // Calcul du diff mot-à-mot avec apparat critique délicat (non-agressif)
  computeWordDiff(refText, compText, showAdded = true, showRemoved = true, hideRemoved = false, refVersionName = 'la référence') {
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

        if ((rIsW && cIsW && rNorm === cNorm) || (!rIsW && !cIsW && rTok.trim() === cTok.trim())) {
          dp[i + 1][j + 1] = dp[i][j] + 1;
        } else {
          dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
        }
      }
    }

    let i = N;
    let j = M;
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
        if (isWord(refTokens[i - 1]) && showRemoved && !hideRemoved) {
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
          html += `<span class="diff-soft-added" title="Mot spécifique / variante">${this.escapeHtml(item.text)}</span>`;
        } else {
          html += this.escapeHtml(item.text);
        }
      } else if (item.type === 'removed') {
        if (showRemoved && !hideRemoved) {
          html += `<span class="diff-soft-removed" title="Mot absent (présent dans ${this.escapeHtml(refVersionName)})">${this.escapeHtml(item.text)}</span>`;
        }
      }
    }
    return html;
  },

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
};

// Initialisation globale au chargement
document.addEventListener('DOMContentLoaded', () => {
  BibleComparisonHub.init();
});
