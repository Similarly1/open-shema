/**
 * Dictionary View Controller (Logos Master-Detail Explorer)
 * Gère la navigation alphabétique (A-Z), la sélection de dictionnaires,
 * la lecture fluide des articles, la comparaison multi-sources et Wikipédia.
 */

const DictView = {
  allDictionaries: [],
  activeDictId: null,
  activeDictInfo: null,
  currentHeadwords: [],
  activeSlug: null,
  currentEntryData: null,
  currentMatches: [],
  activeSourceIndex: 0,
  activeLetter: 'ALL',
  currentZoom: 100,
  isTocCollapsed: false,
  currentFootnotesList: [],
  vigourouxIllustrationsMap: null,
  lightboxEl: null,

  // Historique de navigation (Précédent / Suivant)
  historyStack: [],
  historyPointer: -1,
  _isNavigatingHistory: false,

  // Cache des mots-vedettes valides pour vérifier les liens de renvois
  knownHeadwordsSet: new Set(),

  // Options d'affichage et de transformation du texte
  optLogosRestructure: true,
  optConvertRoman: true,
  optFootnotes: true,
  optScripture: true,
  fontFamily: 'EB Garamond',
  readingBg: 'auto',

  init() {
    try {
      const savedLogos = localStorage.getItem('dict_opt_logos_restructure');
      if (savedLogos !== null) this.optLogosRestructure = (savedLogos === 'true');
      const savedRoman = localStorage.getItem('dict_opt_convert_roman');
      if (savedRoman !== null) this.optConvertRoman = (savedRoman === 'true');
      const savedFn = localStorage.getItem('dict_opt_footnotes');
      if (savedFn !== null) this.optFootnotes = (savedFn === 'true');
      const savedScrip = localStorage.getItem('dict_opt_scripture');
      if (savedScrip !== null) this.optScripture = (savedScrip === 'true');
      const savedFont = localStorage.getItem('dict_view_font');
      if (savedFont) this.fontFamily = savedFont;
      const savedBg = localStorage.getItem('dict_reading_bg');
      if (savedBg) this.readingBg = savedBg;
      const savedZoom = localStorage.getItem('dict_view_zoom');
      if (savedZoom) this.currentZoom = parseInt(savedZoom, 10) || 100;
    } catch (e) {}

    this.bindHeaderControls();
    this.bindDisplayOptions();
    this.bindTocControls();
    this.bindArticleControls();
    this.applyDisplayPreferences();
    this.loadVigourouxIllustrations();
  },

  async loadVigourouxIllustrations() {
    if (this.vigourouxIllustrationsMap) return this.vigourouxIllustrationsMap;
    try {
      const res = await fetch('data/dictionaries/vigouroux_illustrations.json');
      if (res.ok) {
        this.vigourouxIllustrationsMap = await res.json();
      } else {
        this.vigourouxIllustrationsMap = {};
      }
    } catch (e) {
      this.vigourouxIllustrationsMap = {};
    }
    return this.vigourouxIllustrationsMap;
  },

  initLightbox() {
    if (this.lightboxEl) return;
    this.lightboxEl = document.createElement('div');
    this.lightboxEl.className = 'dict-lightbox-overlay';
    this.lightboxEl.id = 'dict-lightbox-overlay';
    this.lightboxEl.innerHTML = `
      <div class="dict-lightbox-container">
        <div class="dict-lightbox-card">
          <button type="button" class="dict-lightbox-close" title="Fermer (Échap)">✕</button>
          <img src="" alt="" class="dict-lightbox-img" />
          <div class="dict-lightbox-caption"></div>
        </div>
      </div>
    `;
    document.body.appendChild(this.lightboxEl);

    this.lightboxEl.querySelector('.dict-lightbox-close')?.addEventListener('click', () => this.hideLightbox());
    this.lightboxEl.addEventListener('click', (e) => {
      if (e.target === this.lightboxEl || e.target.classList.contains('dict-lightbox-container')) {
        this.hideLightbox();
      }
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.hideLightbox();
    });
  },

  showLightbox(src, caption) {
    this.initLightbox();
    const cardEl = document.querySelector('.dict-article-card') || document.querySelector('.dict-view-main-scroll');
    const isLightMode = document.body.classList.contains('theme-light') ||
                        document.body.classList.contains('reading-bg-sepia') ||
                        document.body.classList.contains('reading-bg-parchment') ||
                        document.body.classList.contains('reading-bg-paper') ||
                        document.body.classList.contains('reading-bg-white') ||
                        cardEl?.classList.contains('vintage-epoch-xix') ||
                        cardEl?.classList.contains('vintage-epoch-classic') ||
                        cardEl?.classList.contains('vintage-epoch-ancient') ||
                        (this.readingBg && this.readingBg !== 'dark' && this.readingBg !== 'auto');

    this.lightboxEl.classList.toggle('lightbox-theme-light', !!isLightMode);
    this.lightboxEl.classList.toggle('lightbox-theme-dark', !isLightMode);

    const imgEl = this.lightboxEl.querySelector('.dict-lightbox-img');
    const capEl = this.lightboxEl.querySelector('.dict-lightbox-caption');
    if (imgEl) imgEl.src = src;
    if (capEl) capEl.textContent = caption || '';
    this.lightboxEl.classList.add('visible');
  },

  hideLightbox() {
    if (this.lightboxEl) {
      this.lightboxEl.classList.remove('visible');
    }
  },

  async preloadInitialData() {
    if (this._isPreloading || this._isPreloaded) return;
    this._isPreloading = true;
    try {
      await this.loadDictionaries();
      this._isPreloaded = true;
    } catch (err) {
      console.error('[DictView] Erreur preloadInitialData:', err);
    } finally {
      this._isPreloading = false;
    }
  },

  onViewActivated() {
    if (!this.allDictionaries || this.allDictionaries.length === 0) {
      this.loadDictionaries();
    }
    this.applyDisplayPreferences();
  },

  _hashCode(str) {
    let hash = 0;
    if (!str) return hash;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  },

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },

  openDictionary(dictId, targetTerm = null) {
    App.switchView('dict');
    if (!this.allDictionaries || this.allDictionaries.length === 0) {
      this.loadDictionaries().then(() => {
        this.selectDictionary(dictId, targetTerm);
      });
    } else {
      this.selectDictionary(dictId, targetTerm);
    }
  },

  // =========================================================================
  // 1. CONTRÔLES D'EN-TÊTE & SÉLECTEUR DÉROULANT (STYLE THÉOLOGIE)
  // =========================================================================

  bindHeaderControls() {
    const btnSelector = document.getElementById('btn-dict-active-selector');
    const popover = document.getElementById('dict-picker-popover');
    const searchInPopover = document.getElementById('dict-picker-search-input');

    // Basculer le popover des dictionnaires
    btnSelector?.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = popover?.classList.contains('hidden');
      if (isHidden) {
        if (searchInPopover) searchInPopover.value = '';
        this.renderDictionaryPickerList();
        popover.classList.remove('hidden');
        setTimeout(() => searchInPopover?.focus(), 50);
      } else {
        popover?.classList.add('hidden');
      }
    });

    // Fermer le popover au clic en dehors
    document.addEventListener('click', (e) => {
      if (popover && !popover.classList.contains('hidden') && !e.target.closest('#btn-dict-active-selector') && !e.target.closest('#dict-picker-popover')) {
        popover.classList.add('hidden');
      }
    });

    // Filtrer les dictionnaires dans le popover
    searchInPopover?.addEventListener('input', () => {
      this.renderDictionaryPickerList();
    });

    // Contrôles d'historique de navigation (Précédent / Suivant)
    const btnHistBack = document.getElementById('btn-dict-history-back');
    const btnHistFwd = document.getElementById('btn-dict-history-forward');

    btnHistBack?.addEventListener('click', async () => {
      if (this.historyPointer > 0) {
        this.historyPointer--;
        const item = this.historyStack[this.historyPointer];
        this._isNavigatingHistory = true;
        try {
          if (item.dictId && item.dictId !== this.activeDictId) {
            await this.selectDictionary(item.dictId, item.slug);
          } else {
            await this.selectEntry(item.slug);
          }
        } catch (e) {
          console.error('Erreur navigation historique arrière:', e);
        } finally {
          this._isNavigatingHistory = false;
          this.updateHistoryButtons();
        }
      }
    });

    btnHistFwd?.addEventListener('click', async () => {
      if (this.historyPointer < this.historyStack.length - 1) {
        this.historyPointer++;
        const item = this.historyStack[this.historyPointer];
        this._isNavigatingHistory = true;
        try {
          if (item.dictId && item.dictId !== this.activeDictId) {
            await this.selectDictionary(item.dictId, item.slug);
          } else {
            await this.selectEntry(item.slug);
          }
        } catch (e) {
          console.error('Erreur navigation historique avant:', e);
        } finally {
          this._isNavigatingHistory = false;
          this.updateHistoryButtons();
        }
      }
    });

    // Recherche Rapide Globale
    const searchInput = document.getElementById('dict-search-input');
    const btnSearch = document.getElementById('btn-dict-search');
    const btnClear = document.getElementById('btn-dict-search-clear');

    const handleSearch = () => {
      const q = searchInput?.value?.trim();
      if (q) {
        this.executeLookup(q);
      }
    };

    btnSearch?.addEventListener('click', handleSearch);
    searchInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleSearch();
    });

    searchInput?.addEventListener('input', (e) => {
      if (btnClear) {
        btnClear.classList.toggle('hidden', !e.target.value);
      }
    });

    btnClear?.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      if (btnClear) btnClear.classList.add('hidden');
      this.loadHeadwords(this.activeLetter);
    });

    // Bouton Toggle Sommaire / Index
    document.getElementById('btn-dict-toggle-toc')?.addEventListener('click', () => {
      const toc = document.getElementById('dict-toc-panel');
      const btn = document.getElementById('btn-dict-toggle-toc');
      if (toc) {
        this.isTocCollapsed = !this.isTocCollapsed;
        toc.classList.toggle('collapsed', this.isTocCollapsed);
        btn?.classList.toggle('active', !this.isTocCollapsed);
      }
    });

    // Contrôles de Zoom
    document.getElementById('btn-dict-zoom-out')?.addEventListener('click', () => this.adjustZoom(-10));
    document.getElementById('btn-dict-zoom-in')?.addEventListener('click', () => this.adjustZoom(10));
  },

  bindDisplayOptions() {
    const btnDisplay = document.getElementById('btn-dict-display-options');
    const popover = document.getElementById('dict-display-popover');

    btnDisplay?.addEventListener('click', (e) => {
      e.stopPropagation();
      popover?.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
      if (popover && !popover.classList.contains('hidden') && !e.target.closest('#btn-dict-display-options') && !e.target.closest('#dict-display-popover')) {
        popover.classList.add('hidden');
      }
    });

    // Checkboxes de transformation du texte
    const chkLogos = document.getElementById('dict-opt-logos-restructure');
    const chkRoman = document.getElementById('dict-opt-convert-roman');
    const chkFn = document.getElementById('dict-opt-footnotes');
    const chkScrip = document.getElementById('dict-opt-scripture');

    if (chkLogos) {
      chkLogos.checked = this.optLogosRestructure;
      chkLogos.addEventListener('change', () => {
        this.optLogosRestructure = chkLogos.checked;
        localStorage.setItem('dict_opt_logos_restructure', String(this.optLogosRestructure));
        this.renderSelectedSourceMatch();
      });
    }

    if (chkRoman) {
      chkRoman.checked = this.optConvertRoman;
      chkRoman.addEventListener('change', () => {
        this.optConvertRoman = chkRoman.checked;
        localStorage.setItem('dict_opt_convert_roman', String(this.optConvertRoman));
        this.renderSelectedSourceMatch();
      });
    }

    if (chkFn) {
      chkFn.checked = this.optFootnotes;
      chkFn.addEventListener('change', () => {
        this.optFootnotes = chkFn.checked;
        localStorage.setItem('dict_opt_footnotes', String(this.optFootnotes));
        this.renderSelectedSourceMatch();
      });
    }

    if (chkScrip) {
      chkScrip.checked = this.optScripture;
      chkScrip.addEventListener('change', () => {
        this.optScripture = chkScrip.checked;
        localStorage.setItem('dict_opt_scripture', String(this.optScripture));
        this.renderSelectedSourceMatch();
      });
    }

    // Polices de caractères
    document.querySelectorAll('.dict-font-choice-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const font = btn.dataset.font;
        if (font) {
          this.fontFamily = font;
          localStorage.setItem('dict_view_font', font);
          this.applyDisplayPreferences();
        }
      });
    });

    // Fond de lecture
    document.querySelectorAll('.dict-bg-swatch').forEach(btn => {
      btn.addEventListener('click', () => {
        const bg = btn.dataset.bg;
        if (bg) {
          this.setReadingBg(bg);
        }
      });
    });
  },

  setReadingBg(bg) {
    this.readingBg = bg || 'auto';
    try {
      localStorage.setItem('dict_reading_bg', this.readingBg);
    } catch (e) {}

    // Synchronisation avec le thème global de l'application
    if (typeof App !== 'undefined' && App.applyTheme) {
      const currentTheme = document.body.classList.contains('theme-light') ? 'light' : 'dark';
      const currentPalette = document.body.className.match(/palette-([a-z-]+)/)?.[1] || 'slate';
      App.applyTheme(currentTheme, currentPalette, this.readingBg);
    }

    this.applyDisplayPreferences();
  },

  applyDisplayPreferences() {
    const bodyEl = document.getElementById('dict-article-body');
    const lblZoom = document.getElementById('lbl-dict-zoom-level');
    if (lblZoom) lblZoom.textContent = `${this.currentZoom}%`;

    // Polices
    document.querySelectorAll('.dict-font-choice-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.font === this.fontFamily);
    });
    if (bodyEl) {
      bodyEl.style.fontFamily = (this.fontFamily === 'Inter') ? "'Inter', sans-serif" : (this.fontFamily === 'Georgia' ? "Georgia, serif" : "'EB Garamond', serif");
      bodyEl.style.fontSize = `${16 * (this.currentZoom / 100)}px`;
    }

    // Fond de lecture
    document.querySelectorAll('.dict-bg-swatch').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.bg === this.readingBg);
    });
    const card = document.querySelector('.dict-article-card') || document.getElementById('dict-article-card');
    const scrollPane = document.getElementById('dict-main-scroll') || document.querySelector('.dict-main-reading-scroll');
    const viewDict = document.getElementById('view-dictionary');
    [card, scrollPane, viewDict].forEach(el => {
      if (el) {
        el.classList.remove('reading-bg-white', 'reading-bg-sepia', 'reading-bg-dark', 'bg-white', 'bg-sepia', 'bg-dark');
        if (this.readingBg !== 'auto') {
          el.classList.add(`reading-bg-${this.readingBg}`);
          el.classList.add(`bg-${this.readingBg}`);
        }
      }
    });
  },

  adjustZoom(delta) {
    this.currentZoom = Math.min(180, Math.max(70, this.currentZoom + delta));
    localStorage.setItem('dict_view_zoom', String(this.currentZoom));
    this.applyDisplayPreferences();
  },


  // =========================================================================
  // 2. CHARGEMENT & SÉLECTION DES DICTIONNAIRES
  // =========================================================================

  async loadDictionaries() {
    try {
      const dicts = await API.call('get_dictionaries') || [];
      this.allDictionaries = dicts;
      this.renderDictionaryPickerList();

      if (!this.activeDictId && dicts.length > 0) {
        // Sélectionner par défaut le Nouveau Dictionnaire Biblique s'il existe, sinon le premier
        const defaultDict = dicts.find(d => d.id === 'nouveau_dictionnaire') || dicts[0];
        this.selectDictionary(defaultDict.id);
      }
    } catch (e) {
      console.error('Erreur chargement dictionnaires:', e);
    }
  },

  renderDictionaryPickerList() {
    const listEl = document.getElementById('dict-picker-list');
    const searchInPopover = document.getElementById('dict-picker-search-input');
    if (!listEl) return;

    const q = (searchInPopover?.value || '').toLowerCase().trim();
    const filtered = this.allDictionaries.filter(d => {
      if (!q) return true;
      const title = (d.name || d.title || '').toLowerCase();
      const author = (d.author || d.subtitle || '').toLowerCase();
      return title.includes(q) || author.includes(q);
    });

    if (filtered.length === 0) {
      listEl.innerHTML = `
        <div class="theol-picker-empty">Aucun dictionnaire trouvé</div>
      `;
      return;
    }

    const coverColors = ['#0F766E', '#1E3A8A', '#4338CA', '#7C2D12', '#065F46', '#831843', '#312E81', '#92400e'];

    listEl.innerHTML = filtered.map(d => {
      const isActive = d.id === this.activeDictId;
      const color = coverColors[Math.abs(this._hashCode(d.id || d.name)) % coverColors.length];
      const initials = (d.name || 'D').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'D';
      const coverUrl = d.cover_data_url || d.cover_url;

      const coverHtml = coverUrl
        ? `<div class="theol-book-mini-cover" style="background: url('${coverUrl}') center/cover no-repeat;"><div class="theol-book-mini-spine"></div></div>`
        : `<div class="theol-book-mini-cover" style="background: ${color};"><div class="theol-book-mini-spine"></div><span class="theol-book-mini-initials">${initials}</span></div>`;

      const articlesTag = d.badge || (d.count ? `${(d.count).toLocaleString('fr-FR')} art.` : '');

      return `
        <div class="theol-picker-item ${isActive ? 'active' : ''}" data-dict-id="${d.id}">
          ${coverHtml}
          <div class="theol-picker-item-details">
            <div class="theol-picker-item-title-row">
              <span class="theol-picker-item-name">${this.escapeHtml(d.name)}</span>
              ${articlesTag ? `<span class="theol-picker-item-chapters-tag">${articlesTag}</span>` : ''}
            </div>
            <div class="theol-picker-item-author">${this.escapeHtml(d.subtitle || d.author || 'Auteur non spécifié')}</div>
          </div>
          ${isActive ? '<span class="theol-picker-item-check">✓</span>' : ''}
        </div>
      `;
    }).join('');

    listEl.querySelectorAll('.theol-picker-item').forEach(item => {
      item.addEventListener('click', () => {
        const dId = item.dataset.dictId;
        if (dId) {
          this.selectDictionary(dId);
          document.getElementById('dict-picker-popover')?.classList.add('hidden');
        }
      });
    });
  },

  async selectDictionary(dictId, targetSlug = null) {
    const dInfo = this.allDictionaries.find(d => d.id === dictId || d.name === dictId) || this.allDictionaries[0];
    if (!dInfo) return;

    this.activeDictId = dInfo.id;
    this.activeDictInfo = dInfo;

    // Charger les mots-vedettes valides pour filtrer les boutons de renvois
    this.loadValidHeadwords(this.activeDictId);

    // Mettre à jour le bouton actif dans l'en-tête (Style Théologie)
    const titleEl = document.getElementById('dict-active-book-title');
    const metaEl = document.getElementById('dict-active-book-meta');
    const badgeEl = document.getElementById('dict-active-count-badge');
    const coverEl = document.getElementById('dict-active-book-cover');
    const coverInitials = document.getElementById('dict-active-book-initials');

    if (titleEl) titleEl.textContent = dInfo.name;
    if (metaEl) metaEl.textContent = dInfo.subtitle || dInfo.author || `${dInfo.count || 0} articles`;
    if (badgeEl) badgeEl.textContent = dInfo.badge || `${(dInfo.count || 0).toLocaleString('fr-FR')} art.`;
    
    if (coverEl) {
      const coverColors = ['#0F766E', '#1E3A8A', '#4338CA', '#7C2D12', '#065F46', '#831843', '#312E81', '#92400e'];
      const color = coverColors[Math.abs(this._hashCode(dInfo.id || dInfo.name)) % coverColors.length];
      const initials = (dInfo.name || 'D').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'D';
      const coverUrl = dInfo.cover_data_url || dInfo.cover_url;

      if (coverUrl) {
        coverEl.style.background = `url("${coverUrl}") center/cover no-repeat`;
        if (coverInitials) coverInitials.style.display = 'none';
      } else {
        coverEl.style.background = color;
        if (coverInitials) {
          coverInitials.style.display = 'block';
          coverInitials.textContent = initials;
        }
      }
    }

    const cleanSlug = targetSlug ? targetSlug.replace(/^[^\w\u00C0-\u017F]+|[^\w\u00C0-\u017F]+$/g, '').trim() : null;

    if (cleanSlug) {
      const firstLetter = cleanSlug.normalize("NFD").replace(/[\u0300-\u036f]/g, "")[0]?.toUpperCase() || 'ALL';
      this.activeLetter = firstLetter;
      document.querySelectorAll('.dict-az-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.letter === firstLetter);
      });

      const filterInput = document.getElementById('dict-toc-filter-input');
      if (filterInput) filterInput.value = '';

      // Ouvrir immédiatement la notice pour l'utilisateur
      this.selectEntry(cleanSlug);
      // Charger la tranche alphabétique correspondante dans l'index à gauche
      this.loadHeadwords(firstLetter, null, cleanSlug);
    } else {
      this.activeLetter = 'ALL';
      document.querySelectorAll('.dict-az-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.letter === 'ALL');
      });

      const filterInput = document.getElementById('dict-toc-filter-input');
      if (filterInput) filterInput.value = '';

      this.loadHeadwords('ALL', null, null);
    }
  },

  async loadValidHeadwords(dictId) {
    try {
      const list = await API.getDictionaryValidHeadwords(dictId);
      if (Array.isArray(list)) {
        this.knownHeadwordsSet = new Set(list.map(s => (s || '').toUpperCase().trim()));
      }
    } catch (e) {
      console.error('Erreur chargement mots-vedettes valides:', e);
    }
  },

  isValidHeadword(word) {
    if (!word) return false;
    if (!this.knownHeadwordsSet || this.knownHeadwordsSet.size === 0) return true;
    const wUpper = word.toUpperCase().trim();
    const wNorm = wUpper.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]/g, '');
    return this.knownHeadwordsSet.has(wUpper) || this.knownHeadwordsSet.has(wNorm);
  },

  // =========================================================================
  // 3. INDEX ALPHABÉTIQUE / TABLE DES MOTS (VOLET GAUCHE)
  // =========================================================================

  bindTocControls() {
    // Filtre de recherche dans l'index (Titres seuls)
    const filterIn = document.getElementById('dict-toc-filter-input');
    const filterClear = document.getElementById('btn-dict-toc-filter-clear');
    let filterTimer = null;

    filterIn?.addEventListener('input', (e) => {
      const q = e.target.value;
      if (filterClear) {
        filterClear.classList.toggle('hidden', !q);
      }
      clearTimeout(filterTimer);
      filterTimer = setTimeout(() => {
        const queryVal = q.trim();
        this.loadHeadwords(this.activeLetter, queryVal);
      }, 180);
    });

    filterClear?.addEventListener('click', () => {
      if (filterIn) filterIn.value = '';
      if (filterClear) filterClear.classList.add('hidden');
      this.loadHeadwords(this.activeLetter, null);
    });

    // Barre A-Z
    document.querySelectorAll('.dict-az-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.dict-az-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeLetter = btn.dataset.letter;
        btn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        
        const filterVal = document.getElementById('dict-toc-filter-input')?.value.trim();
        this.loadHeadwords(this.activeLetter, filterVal);
      });
    });
  },

  async loadHeadwords(letter = 'ALL', query = null, targetSlug = null) {
    if (!this.activeDictId) return;

    const listEl = document.getElementById('dict-toc-list');
    const countEl = document.getElementById('dict-toc-count');

    if (listEl) {
      listEl.innerHTML = `<div style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 12px;">Chargement des entrées...</div>`;
    }

    try {
      const res = await API.call('get_dictionary_headwords', this.activeDictId, letter, query, 300, 0);
      const headwords = res?.headwords || [];
      this.currentHeadwords = headwords;

      const total = res?.total_count || headwords.length;
      if (countEl) {
        countEl.textContent = total.toLocaleString('fr-FR');
        countEl.title = `${total.toLocaleString('fr-FR')} entrée${total > 1 ? 's' : ''}`;
      }

      this.renderHeadwordsList(headwords, targetSlug);
    } catch (e) {
      console.error('Erreur chargement headwords:', e);
      if (listEl) {
        listEl.innerHTML = `<div style="padding: 20px; text-align: center; color: var(--accent-red); font-size: 12px;">Erreur de chargement.</div>`;
      }
    }
  },

  renderHeadwordsList(headwords, targetSlug = null) {
    const listEl = document.getElementById('dict-toc-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    if (headwords.length === 0) {
      listEl.innerHTML = `
        <div style="padding: 30px 14px; text-align: center; color: var(--text-muted); font-size: 12px;">
          Aucune entrée trouvée.
        </div>
      `;
      return;
    }

    let itemToSelect = null;

    headwords.forEach((hw, idx) => {
      const item = document.createElement('div');
      item.className = 'dict-toc-item';
      item.dataset.slug = hw.slug;
      if (hw.code) item.dataset.code = hw.code;

      item.innerHTML = `
        <div class="dict-toc-item-title">${hw.title}</div>
        ${hw.snippet ? `<div class="dict-toc-item-snippet">${hw.snippet}</div>` : ''}
      `;

      item.addEventListener('click', () => {
        this.selectEntry(hw.slug, hw.code);
      });

      listEl.appendChild(item);

      if (targetSlug && (hw.slug.toLowerCase() === targetSlug.toLowerCase() || hw.title.toLowerCase() === targetSlug.toLowerCase())) {
        itemToSelect = hw;
      } else if (!targetSlug && idx === 0 && !this.activeSlug) {
        itemToSelect = hw;
      }
    });

    if (itemToSelect) {
      this.selectEntry(itemToSelect.slug, itemToSelect.code);
    } else if (this.activeSlug) {
      // Maintenir la sélection actuelle si présente
      const activeEl = listEl.querySelector(`.dict-toc-item[data-slug="${this.activeSlug}"]`);
      if (activeEl) activeEl.classList.add('active');
    }
  },

  // =========================================================================
  // 4. LECTURE & AFFICHAGE DE L'ARTICLE SÉLECTIONNÉ (VOLET DROIT)
  // =========================================================================

  bindArticleControls() {
    // Bouton Polissage IA
    document.getElementById('btn-dict-polish-article')?.addEventListener('click', () => {
      this.polishCurrentArticle();
    });

    // Bouton Copier
    document.getElementById('btn-dict-copy-article')?.addEventListener('click', () => {
      if (!this.currentEntryData) return;
      const text = `${this.currentEntryData.title}\n\n${this.currentEntryData.full_text || this.currentEntryData.raw_text || ''}`;
      navigator.clipboard.writeText(text).then(() => {
        App.showToast('Définition copiée dans le presse-papier !', 'success');
      }).catch(() => {
        App.showToast('Erreur lors de la copie', 'error');
      });
    });

    // Bouton Vers Note
    document.getElementById('btn-dict-export-note')?.addEventListener('click', () => {
      if (!this.currentEntryData) return;
      const title = `Notice : ${this.currentEntryData.title}`;
      const content = `### ${this.currentEntryData.title}\n*Source : ${this.currentEntryData.dict_name || this.activeDictInfo?.name || 'Dictionnaire'}*\n\n${this.currentEntryData.full_text || this.currentEntryData.raw_text || ''}`;
      
      API.call('save_note', { title, content, reference: '', tags: ['Dictionnaire', this.currentEntryData.title] }).then(() => {
        App.showToast(`Notice « ${this.currentEntryData.title} » exportée dans vos notes !`, 'success');
      }).catch(e => {
        alert(`Erreur d'enregistrement dans les notes : ${e}`);
      });
    });
  },

  async selectEntry(slug, strongCode = null) {
    this.activeSlug = slug;
    this.activeSourceIndex = 0;

    // Mettre à jour la classe active dans l'index à gauche
    document.querySelectorAll('#dict-toc-list .dict-toc-item').forEach(el => {
      el.classList.toggle('active', el.dataset.slug === slug);
    });

    const bodyEl = document.getElementById('dict-article-body');
    const heroTitle = document.getElementById('dict-hero-title');
    const heroBadge = document.getElementById('dict-hero-badge');

    if (heroTitle) heroTitle.textContent = slug;
    if (bodyEl) {
      bodyEl.innerHTML = `<div style="padding: 40px; text-align: center; color: var(--text-muted);"><div class="synth-spinner" style="width:24px; height:24px; border-width:2px; margin: 0 auto 12px auto;"></div>Chargement de l'article...</div>`;
    }

    try {
      const data = await API.call('get_dictionary_entry', this.activeDictId, slug, strongCode);
      this.currentEntryData = data;
      this.currentMatches = data?.matches || [];

      // Gestion de la pile d'historique
      if (!this._isNavigatingHistory && slug) {
        if (this.historyPointer < this.historyStack.length - 1) {
          this.historyStack = this.historyStack.slice(0, this.historyPointer + 1);
        }
        const currentTop = this.historyStack[this.historyPointer];
        if (!currentTop || currentTop.slug !== slug || currentTop.dictId !== this.activeDictId) {
          this.historyStack.push({ dictId: this.activeDictId, slug: slug });
          this.historyPointer = this.historyStack.length - 1;
        }
      }
      this.updateHistoryButtons();

      this.renderArticleView();
    } catch (e) {
      console.error('Erreur lecture notice:', e);
      if (bodyEl) {
        bodyEl.innerHTML = `<div style="padding: 30px; text-align: center; color: var(--accent-red);">Erreur lors de la récupération de la notice.</div>`;
      }
    }
  },

  updateHistoryButtons() {
    const btnHistBack = document.getElementById('btn-dict-history-back');
    const btnHistFwd = document.getElementById('btn-dict-history-forward');
    if (btnHistBack) {
      btnHistBack.disabled = (this.historyPointer <= 0);
    }
    if (btnHistFwd) {
      btnHistFwd.disabled = (this.historyPointer >= this.historyStack.length - 1 || this.historyPointer === -1);
    }
  },

  renderArticleView() {
    const data = this.currentEntryData;
    if (!data) return;

    const heroTitle = document.getElementById('dict-hero-title');
    const heroBadge = document.getElementById('dict-hero-badge');

    if (heroTitle) heroTitle.textContent = data.title;
    if (heroBadge) heroBadge.textContent = data.badge || data.dict_name || this.activeDictInfo?.name || 'Dictionnaire';

    // Application du style d'immersion historique (ex: Vigouroux = 1895 -> Belle Époque XIXe)
    const cardEl = document.querySelector('.dict-article-card') || document.querySelector('.dict-view-main-scroll');
    if (cardEl && typeof VintageThemeManager !== 'undefined') {
      const dictName = data.badge || data.dict_name || this.activeDictInfo?.name || 'Vigouroux';
      VintageThemeManager.applyEpochToElement(cardEl, dictName);
    }

    this.renderSelectedSourceMatch();
  },

  currentFootnotesList: [],

  renderSelectedSourceMatch() {
    const bodyEl = document.getElementById('dict-article-body');
    if (!bodyEl) return;

    const match = this.currentMatches[this.activeSourceIndex] || this.currentEntryData;
    if (!match) {
      bodyEl.innerHTML = `<div style="padding: 30px; text-align: center; color: var(--text-muted);">Aucune notice disponible.</div>`;
      return;
    }

    const isPolished = match.is_polished;
    const modelName = match.polished_model || 'Mistral 14B';

    let polishBannerHtml = '';
    if (isPolished) {
      polishBannerHtml = `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 14px; background: rgba(79, 70, 229, 0.08); border: 1px solid rgba(79, 70, 229, 0.2); border-radius: 8px; margin-bottom: 18px;">
          <span style="display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; font-weight: 700; color: #6366f1;">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/></svg>
            Notice restaurée et modernisée par l'IA (${modelName})
          </span>
          <button id="btn-dict-view-original" style="background: transparent; border: none; font-size: 11px; color: var(--text-secondary); cursor: pointer; text-decoration: underline;">Voir l'original</button>
        </div>
      `;
    }

    const isVigouroux = (match?.dict_id || this.activeDictId || '').toLowerCase().includes('vigouroux') || (this.activeDictInfo?.name || '').toLowerCase().includes('vigouroux');
    const rawText = match.full_text || match.raw_text || match.preview || '';
    this.currentFootnotesList = [];
    const formatted = this.formatArticleMarkdown(rawText, isVigouroux);
    let linkified = (this.optScripture && typeof TheologyView !== 'undefined' && TheologyView.highlightScriptureReferences)
      ? TheologyView.highlightScriptureReferences(formatted)
      : formatted;
    if (typeof TheologyView !== 'undefined' && TheologyView.linkifyUrls) {
      linkified = TheologyView.linkifyUrls(linkified);
    }

    // Section des notes de bas de page si des citations ont été extraites
    let footnotesHtml = '';
    if (this.optFootnotes && this.currentFootnotesList.length > 0) {
      // Pour Vigouroux : enrichir le texte des notes avec le glossaire patristique latin
      const renderedFootnotes = this.currentFootnotesList.map(fn => {
        let fnText = (typeof TheologyView !== 'undefined' && TheologyView.highlightScriptureReferences) ? TheologyView.highlightScriptureReferences(fn.text) : fn.text;
        if (isVigouroux && typeof TheolLatinGlossary !== 'undefined') {
          fnText = TheolLatinGlossary.annotate(fnText);
        }
        return `
          <li class="theol-fn-item" id="theol-fn-${fn.id}" data-fn-id="${fn.id}" style="margin-bottom: 8px;">
            <span class="theol-fn-num" style="font-weight: 700; color: #6366f1; margin-right: 4px;">${fn.id}.</span>
            <span class="theol-fn-text">${fnText}</span>
            <a href="#dict-fnref-${fn.id}" class="theol-fn-backref" data-target-id="dict-fnref-${fn.id}" title="Retour au passage" style="color: #6366f1; text-decoration: none; margin-left: 6px; font-weight: bold;">↩</a>
          </li>
        `;
      }).join('');

      footnotesHtml = `
        <div class="theol-footnotes-section" id="dict-footnotes-section" style="margin-top: 32px; border-top: 1px solid var(--border-color); padding-top: 18px;">
          <div class="theol-footnotes-header" style="display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 700; color: var(--text-secondary); margin-bottom: 12px;">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            <span>Notes & Références de sources (${this.currentFootnotesList.length})</span>
          </div>
          <ol class="theol-footnotes-list" style="padding-left: 20px; font-size: 12.5px; color: var(--text-secondary); line-height: 1.6;">
            ${renderedFootnotes}
          </ol>
        </div>
      `;
    }

    // 0b. Intégration des gravures historiques Vigouroux
    let illustrationsHtml = '';
    if (isVigouroux) {
      const rawTitle = match.title || match.headword || this.currentEntryData?.title || '';
      const normTitle = rawTitle.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]/g, '');
      const map = this.vigourouxIllustrationsMap || {};
      const figs = (match.illustrations && match.illustrations.length > 0)
        ? match.illustrations
        : (this.currentEntryData?.illustrations && this.currentEntryData.illustrations.length > 0)
          ? this.currentEntryData.illustrations
          : (map[rawTitle.toUpperCase()] || map[normTitle] || []);
      if (figs.length > 0) {
        illustrationsHtml = `
          <div class="dict-illustrations-gallery">
            ${figs.map(fig => `
              <figure class="dict-article-figure">
                <div class="dict-article-img-wrap" data-img-src="${fig.rel_path}" data-img-caption="${this.escapeHtml(fig.caption)}">
                  <img src="${fig.rel_path}" alt="${this.escapeHtml(fig.caption)}" class="dict-article-img" loading="lazy" />
                </div>
                <figcaption class="dict-article-figcaption">
                  <span class="dict-fig-badge">Fig. ${fig.fig_num}</span> ${this.escapeHtml(fig.caption)}
                </figcaption>
              </figure>
            `).join('')}
          </div>
        `;
      }
    }

    if (illustrationsHtml) {
      if (linkified.includes('<!-- ILLUSTRATION_PLACEHOLDER')) {
        linkified = linkified.replace(/<!-- ILLUSTRATION_PLACEHOLDER:[^>]*-->/g, illustrationsHtml);
      } else {
        const firstPEnd = linkified.indexOf('</p>');
        if (firstPEnd !== -1) {
          linkified = linkified.slice(0, firstPEnd + 4) + illustrationsHtml + linkified.slice(firstPEnd + 4);
        } else {
          linkified = illustrationsHtml + linkified;
        }
      }
    } else {
      linkified = linkified.replace(/<!-- ILLUSTRATION_PLACEHOLDER:(.*?)-->/g, (m, cap) => {
        return `
          <figure class="dict-article-figure" style="opacity: 0.85;">
            <figcaption class="dict-article-figcaption">
              <span class="dict-fig-badge">Illustration</span> ${cap}
            </figcaption>
          </figure>
        `;
      });
    }

    bodyEl.innerHTML = `
      ${polishBannerHtml}
      <div class="dict-entry-body-content">${linkified}</div>
      ${footnotesHtml}
    `;

    // 1. Attacher les liens vers les versets bibliques (ScriptureTooltip)
    if (this.optScripture && typeof ScriptureTooltip !== 'undefined') {
      ScriptureTooltip.bindToElements(bodyEl.querySelectorAll('.theol-inline-scripture-ref'));
    }
    bodyEl.querySelectorAll('.theol-inline-scripture-ref').forEach(span => {
      span.addEventListener('click', (e) => {
        e.stopPropagation();
        const ref = span.dataset.ref || span.textContent.trim();
        if (ref) {
          if (typeof ScriptureTooltip !== 'undefined') ScriptureTooltip.hide();
          if (typeof TheologyView !== 'undefined') TheologyView.openScriptureReference(ref);
        }
      });
    });

    // 2. Attacher les liens interactifs des Articles Connexes (*Voir* : MOT)
    bodyEl.querySelectorAll('.dict-cross-ref-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const rawWord = link.dataset.word || link.textContent;
        const word = (rawWord || '').replace(/^[^\w\u00C0-\u017F]+|[^\w\u00C0-\u017F]+$/g, '').trim();
        if (word) {
          this.openDictionary(this.activeDictId, word);
        }
      });
    });

    // 2b. Attacher les liens de saut interne (ex: Voir N° 8)
    bodyEl.querySelectorAll('.dict-internal-jump-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const targetId = link.dataset.jumpTo;
        if (targetId) {
          const targetEl = document.getElementById(targetId);
          if (targetEl) {
            targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            targetEl.classList.remove('theol-highlight-pulse');
            void targetEl.offsetWidth;
            targetEl.classList.add('theol-highlight-pulse');
          }
        }
      });
    });

    // 3. Attacher le gestionnaire d'infobulles des notes de bas de page (FootnoteTooltip)
    if (this.optFootnotes && typeof FootnoteTooltip !== 'undefined') {
      FootnoteTooltip.setFootnotes(this.currentFootnotesList);
      FootnoteTooltip.bindToElements(bodyEl.querySelectorAll('.theol-fn-badge'));
    }

    // 3b. Attacher le gestionnaire d'infobulles patristiques / latines (LatinGlossTooltip)
    if (isVigouroux && typeof LatinGlossTooltip !== 'undefined') {
      LatinGlossTooltip.bindToElements(bodyEl.querySelectorAll('.theol-latin-gloss'));
    }

    // 4. Attacher les liens retour (back-links) de la section des notes
    bodyEl.querySelectorAll('.theol-fn-backref').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = btn.dataset.targetId;
        if (targetId) {
          const callEl = document.getElementById(targetId);
          if (callEl) {
            callEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            callEl.classList.remove('theol-highlight-pulse');
            void callEl.offsetWidth;
            callEl.classList.add('theol-highlight-pulse');
          }
        }
      });
    });

    // 4b. Attacher les clics sur les gravures pour ouvrir la visionneuse LightBox HD
    bodyEl.querySelectorAll('.dict-article-img-wrap').forEach(wrap => {
      wrap.addEventListener('click', () => {
        const src = wrap.dataset.imgSrc || wrap.querySelector('img')?.src;
        const caption = wrap.dataset.imgCaption || wrap.querySelector('img')?.alt;
        if (src) this.showLightbox(src, caption);
      });
    });

    // 5. Basculer vers l'original si cliqué
    bodyEl.querySelector('#btn-dict-view-original')?.addEventListener('click', () => {
      const origText = match.raw_text || match.full_text || '';
      bodyEl.innerHTML = `<div class="dict-entry-body-content">${this.formatArticleMarkdown(origText)}</div>`;
      this.applyDisplayPreferences();
    });

    this.applyDisplayPreferences();
  },

  formatArticleMarkdown(text, isVigouroux = false) {
    if (!text) return '';
    isVigouroux = isVigouroux || (this.activeDictId || '').toLowerCase().includes('vigouroux') || (this.activeDictInfo?.name || '').toLowerCase().includes('vigouroux');

    const ROMAN_MAP = {
      'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5, 'VI': 6, 'VII': 7, 'VIII': 8, 'IX': 9, 'X': 10,
      'XI': 11, 'XII': 12, 'XIII': 13, 'XIV': 14, 'XV': 15, 'XVI': 16, 'XVII': 17, 'XVIII': 18, 'XIX': 19, 'XX': 20,
      'XXI': 21, 'XXII': 22, 'XXIII': 23, 'XXIV': 24, 'XXV': 25, 'XXVI': 26, 'XXVII': 27, 'XXVIII': 28, 'XXIX': 29, 'XXX': 30,
      'XXXI': 31, 'XXXII': 32, 'XXXIII': 33, 'XXXIV': 34, 'XXXV': 35, 'XXXVI': 36, 'XXXVII': 37, 'XXXVIII': 38, 'XXXIX': 39, 'XL': 40,
      'XLI': 41, 'XLII': 42, 'XLIII': 43, 'XLIV': 44, 'XLV': 45, 'XLVI': 46, 'XLVII': 47, 'XLVIII': 48, 'XLIX': 49, 'L': 50,
      'LI': 51, 'LII': 52, 'LIII': 53, 'LIV': 54, 'LV': 55, 'LVI': 56, 'LVII': 57, 'LVIII': 58, 'LIX': 59, 'LX': 60,
      'LXI': 61, 'LXII': 62, 'LXIII': 63, 'LXIV': 64, 'LXV': 65, 'LXVI': 66, 'LXVII': 67, 'LXVIII': 68, 'LXIX': 69, 'LXX': 70,
      'LXXI': 71, 'LXXII': 72, 'LXXIII': 73, 'LXXIV': 74, 'LXXV': 75, 'LXXVI': 76, 'LXXVII': 77, 'LXXVIII': 78, 'LXXIX': 79, 'LXXX': 80,
      'LXXXI': 81, 'LXXXII': 82, 'LXXXIII': 83, 'LXXXIV': 84, 'LXXXV': 85, 'LXXXVI': 86, 'LXXXVII': 87, 'LXXXVIII': 88, 'LXXXIX': 89, 'XC': 90,
      'XCI': 91, 'XCII': 92, 'XCIII': 93, 'XCIV': 94, 'XCV': 95, 'XCVI': 96, 'XCVII': 97, 'XCVIII': 98, 'XCIX': 99, 'C': 100,
      'CI': 101, 'CII': 102, 'CIII': 103, 'CIV': 104, 'CV': 105, 'CVI': 106, 'CVII': 107, 'CVIII': 108, 'CIX': 109, 'CX': 110,
      'CXI': 111, 'CXII': 112, 'CXIII': 113, 'CXIV': 114, 'CXV': 115, 'CXVI': 116, 'CXVII': 117, 'CXVIII': 118, 'CXIX': 119, 'CXX': 120,
      'CXXI': 121, 'CXXII': 122, 'CXXIII': 123, 'CXXIV': 124, 'CXXV': 125, 'CXXVI': 126, 'CXXVII': 127, 'CXXVIII': 128, 'CXXIX': 129, 'CXXX': 130,
      'CXXXI': 131, 'CXXXII': 132, 'CXXXIII': 133, 'CXXXIV': 134, 'CXXXV': 135, 'CXXXVI': 136, 'CXXXVII': 137, 'CXXXVIII': 138, 'CXXXIX': 139, 'CXL': 140,
      'CXLI': 141, 'CXLII': 142, 'CXLIII': 143, 'CXLIV': 144, 'CXLV': 145, 'CXLVI': 146, 'CXLVII': 147, 'CXLVIII': 148, 'CXLIX': 149, 'CL': 150
    };

    const BOOK_ALIASES = {
      "gen": "Genèse", "genese": "Genèse", "ge": "Genèse", "gn": "Genèse",
      "exod": "Exode", "exode": "Exode", "ex": "Exode",
      "lev": "Lévitique", "levitique": "Lévitique", "lv": "Lévitique",
      "num": "Nombres", "nom": "Nombres", "nomb": "Nombres", "nombres": "Nombres", "nb": "Nombres", "numeri": "Nombres",
      "deut": "Deutéronome", "deuteronome": "Deutéronome", "dt": "Deutéronome",
      "jos": "Josué", "josue": "Josué",
      "jug": "Juges", "juges": "Juges", "jg": "Juges",
      "ruth": "Ruth", "rt": "Ruth",
      "1 sam": "1 Samuel", "2 sam": "2 Samuel", "1 samuel": "1 Samuel", "2 samuel": "2 Samuel", "1s": "1 Samuel", "2s": "2 Samuel", "i sam": "1 Samuel", "ii sam": "2 Samuel", "i samuel": "1 Samuel", "ii samuel": "2 Samuel", "i reg": "1 Samuel", "ii reg": "2 Samuel", "1 reg": "1 Samuel", "2 reg": "2 Samuel",
      "1 rois": "1 Rois", "2 rois": "2 Rois", "1r": "1 Rois", "2r": "2 Rois", "i rois": "1 Rois", "ii rois": "2 Rois", "iii reg": "1 Rois", "iv reg": "2 Rois", "3 reg": "1 Rois", "4 reg": "2 Rois",
      "1 chron": "1 Chroniques", "2 chron": "2 Chroniques", "1 chroniques": "1 Chroniques", "2 chroniques": "2 Chroniques", "1 ch": "1 Chroniques", "2 ch": "2 Chroniques", "1ch": "1 Chroniques", "2ch": "2 Chroniques", "i chron": "1 Chroniques", "ii chron": "2 Chroniques", "i chroniques": "1 Chroniques", "ii chroniques": "2 Chroniques", "i par": "1 Chroniques", "ii par": "2 Chroniques", "1 par": "1 Chroniques", "2 par": "2 Chroniques", "chron": "1 Chroniques", "par": "1 Chroniques", "paralipomenes": "1 Chroniques", "i paralipomenes": "1 Chroniques", "ii paralipomenes": "2 Chroniques",
      "esd": "Esdras", "esdras": "Esdras", "1 esdr": "1 Esdras", "2 esdr": "2 Esdras", "i esdr": "1 Esdras", "ii esdr": "2 Esdras",
      "neh": "Néhémie", "nehemie": "Néhémie", "ne": "Néhémie",
      "tob": "Tobie", "tobie": "Tobie", "tb": "Tobie",
      "jdt": "Judith", "judith": "Judith",
      "esth": "Esther", "esther": "Esther", "est": "Esther",
      "job": "Job", "jb": "Job",
      "ps": "Psaumes", "psa": "Psaumes", "psaumes": "Psaumes", "psaume": "Psaumes", "pss": "Psaumes",
      "prov": "Proverbes", "proverbes": "Proverbes", "pr": "Proverbes",
      "eccl": "Ecclésiaste", "ecclesiaste": "Ecclésiaste", "ec": "Ecclésiaste", "ecc": "Ecclésiaste", "qoh": "Ecclésiaste",
      "eccli": "Siracide", "ecclesiastique": "Siracide", "ecclique": "Siracide", "sir": "Siracide", "siracide": "Siracide", "si": "Siracide",
      "sag": "Sagesse", "sagesse": "Sagesse", "sg": "Sagesse",
      "cant": "Cantique des cantiques", "cantique": "Cantique des cantiques", "ct": "Cantique des cantiques",
      "is": "Ésaïe", "isa": "Ésaïe", "esaie": "Ésaïe", "isaie": "Ésaïe", "es": "Ésaïe",
      "jer": "Jérémie", "jeremie": "Jérémie", "jr": "Jérémie",
      "lam": "Lamentations", "lamentations": "Lamentations", "lm": "Lamentations",
      "bar": "Baruch", "baruch": "Baruch",
      "ezech": "Ézéchiel", "eze": "Ézéchiel", "ezechiel": "Ézéchiel", "ez": "Ézéchiel",
      "dan": "Daniel", "daniel": "Daniel", "da": "Daniel", "dn": "Daniel",
      "os": "Osée", "osee": "Osée",
      "joel": "Joël", "jl": "Joël",
      "am": "Amos", "amos": "Amos",
      "abd": "Abdias", "abdias": "Abdias", "ab": "Abdias",
      "jon": "Jonas", "jonas": "Jonas",
      "mich": "Michée", "michee": "Michée", "mi": "Michée",
      "nah": "Nahum", "nahum": "Nahum", "na": "Nahum",
      "hab": "Habacuc", "habacuc": "Habacuc", "ha": "Habacuc",
      "soph": "Sophonie", "sophonie": "Sophonie", "so": "Sophonie",
      "agg": "Aggée", "aggee": "Aggée", "ag": "Aggée",
      "zach": "Zacharie", "zacharie": "Zacharie", "za": "Zacharie",
      "mal": "Malachie", "malachie": "Malachie", "ml": "Malachie",
      "1 mac": "1 Maccabées", "2 mac": "2 Maccabées", "1 macc": "1 Maccabées", "2 macc": "2 Maccabées", "i mac": "1 Maccabées", "ii mac": "2 Maccabées", "i macc": "1 Maccabées", "ii macc": "2 Maccabées",
      "matth": "Matthieu", "matt": "Matthieu", "mat": "Matthieu", "matthieu": "Matthieu", "mt": "Matthieu",
      "marc": "Marc", "mar": "Marc", "mc": "Marc",
      "luc": "Luc", "lc": "Luc",
      "jean": "Jean", "jn": "Jean",
      "act": "Actes", "actes": "Actes", "ac": "Actes",
      "rom": "Romains", "romains": "Romains", "ro": "Romains", "rm": "Romains",
      "1 cor": "1 Corinthiens", "2 cor": "2 Corinthiens", "i cor": "1 Corinthiens", "ii cor": "2 Corinthiens", "1co": "1 Corinthiens", "2co": "2 Corinthiens",
      "gal": "Galates", "galates": "Galates", "ga": "Galates",
      "eph": "Éphésiens", "ephesiens": "Éphésiens", "ep": "Éphésiens",
      "phil": "Philippiens", "philippiens": "Philippiens", "php": "Philippiens", "ph": "Philippiens",
      "col": "Colossiens", "colossiens": "Colossiens",
      "1 thes": "1 Thessaloniciens", "2 thes": "2 Thessaloniciens", "i thes": "1 Thessaloniciens", "ii thes": "2 Thessaloniciens", "1th": "1 Thessaloniciens", "2th": "2 Thessaloniciens",
      "1 tim": "1 Timothée", "2 tim": "2 Timothée", "i tim": "1 Timothée", "ii tim": "2 Timothée", "1tm": "1 Timothée", "2tm": "2 Timothée",
      "tit": "Tite", "tite": "Tite", "tt": "Tite",
      "phlm": "Philémon", "philemon": "Philémon", "phm": "Philémon",
      "heb": "Hébreux", "hebreux": "Hébreux", "he": "Hébreux", "hé": "Hébreux",
      "jacq": "Jacques", "jacques": "Jacques", "ja": "Jacques", "jas": "Jacques", "jc": "Jacques",
      "1 pierre": "1 Pierre", "2 pierre": "2 Pierre", "i pierre": "1 Pierre", "ii pierre": "2 Pierre", "1p": "1 Pierre", "2p": "2 Pierre",
      "1 jean": "1 Jean", "2 jean": "2 Jean", "3 jean": "3 Jean", "i jean": "1 Jean", "ii jean": "2 Jean", "iii jean": "3 Jean", "1j": "1 Jean", "2j": "2 Jean", "3j": "3 Jean", "1jn": "1 Jean", "2jn": "2 Jean", "3jn": "3 Jean",
      "jude": "Jude", "jd": "Jude",
      "apoc": "Apocalypse", "apocalypse": "Apocalypse", "rev": "Apocalypse", "apo": "Apocalypse", "ap": "Apocalypse",
      "4m": "4 Maccabées"
    };

    const cleanBookKey = (name) => {
      return (name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[*_`\.,]+/g, '').trim().toLowerCase();
    };

    let processed = (text || '');

    // 0a. Nettoyage de tout préambule conversationnel d'IA en tête d'article
    processed = processed.replace(/^[\s\n]*(?:Voici\s+(?:la\s+restauration|la\s+mise\s+en\s+forme|la\s+notice|les\s+notices|le\s+texte|la\s+version|l['’]article|ce\s+texte|une\s+version)[^\n]*|Ci-dessous[^\n]*|Notice\s+(?:restaurée|mise\s+à\s+jour|modernisée|révisée)[^\n]*|Bien\s+sûr[^\n]*)\s*\n+/i, '');
    processed = processed.replace(/^[\s\n]*(?:[-*_—–]{3,}\s*\n+)+/, '');

    // Nettoyage des artefacts de découpage intermédiaire (ex: " (Partie 1/2)", " (Partie 2/2)")
    processed = processed.replace(/\s*\((?:Partie|partie)\s+\d+\/\d+\)/gi, '');

    // Nettoyage des astérisques de notes attachées aux chiffres/versets et ponctuations
    processed = processed.replace(/(\b[0-9]+(?::|\.)[0-9]+(?:\s*[\-–,]\s*[0-9]+)*)\s*\*/g, '$1');
    processed = processed.replace(/\(\s*([^\)\n]+?)\s*\*\s*\)/g, '($1)');
    processed = processed.replace(/(?<=[0-9\.,;\s\(\[])\*(?=[0-9\.,;\s\)\]]|$)/g, '');
    processed = processed.replace(/\s*\*\s*([\)\]\.,;:])/g, '$1');
    processed = processed.replace(/\s+\*\s+/g, ' ');

    // Espacement et découpage des doubles deux-points collés (ex: Sources :Voir aussi :)
    processed = processed.replace(/:\s*Voir aussi\s*:/gi, '.\n\n*Voir aussi :*');
    processed = processed.replace(/:\s*Voir\s*:/gi, '.\n\n*Voir :*');

    // Helper Markdown inline universel et robuste (garantit ZERO astérisque à l'écran)
    const formatInlineMarkdown = (s) => {
      if (!s) return '';
      let res = s;
      res = res.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
      res = res.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      res = res.replace(/(?<=[^\w*]|^)\*([^\s*\n].*?[^\s*\n])\*(?=[^\w*]|$)/g, '<em>$1</em>');
      res = res.replace(/(?<=[^\w*]|^)\*([^\s*\n])\*(?=[^\w*]|$)/g, '<em>$1</em>');
      res = res.replace(/(?<!<[^>]*)\*/g, '');
      return res;
    };

    // Élimination du doublon de titre en tête d'article (ex: ABAGARE \n ABAGARE)
    processed = processed.replace(/^([A-ZÉÈÊËÀÂÄÎÏÔÖÙÛÜÇ\-\s]{2,})\n+\1\n+/i, '$1\n\n');

    // Découpage automatique des paragraphes encodés en non-breaking spaces (\xa0, \u202f)
    processed = processed.replace(/[\u00a0\u202f]+\s*/g, '\n\n');

    // 0. Traitement des Balises Logos Standards
    processed = processed
      .replace(/\[\[@Headword:[^\]]+\]\]/gi, '')
      .replace(/\[\[@Bible:([^\]]+)\]\]/gi, '($1)')
      .replace(/\[\[@(?:Topic|Article):([^\]]+)\]\]/gi, 'Voir : $1')
      .replace(/\[\[@Strong:([HG]\d+)\]\]/gi, 'Strong $1');

    // 0c. Conversion des Liens Markdown [Label](#) et [Label](URL)
    processed = processed.replace(/\[([^\]]+)\]\(([^)]*)\)/g, (match, label, href) => {
      const cleanHref = (href || '').trim();
      const cleanLabel = label.trim();
      if (!cleanHref || cleanHref === '#' || cleanHref.startsWith('dict:') || cleanHref.startsWith('#dict-')) {
        const cleanWord = cleanLabel.replace(/[*_`]+/g, '').trim();
        return `<a href="javascript:void(0)" class="dict-cross-ref-link" data-word="${this.escapeHtml(cleanWord)}">${this.escapeHtml(cleanLabel)}</a>`;
      } else if (/^https?:\/\//i.test(cleanHref)) {
        return `<a href="${this.escapeHtml(cleanHref)}" target="_blank" rel="noopener noreferrer">${this.escapeHtml(cleanLabel)}</a>`;
      }
      return match;
    });

    // 0b. Restructuration Automatique des textes bruts (Logos / NDB)
    if (this.optLogosRestructure) {
      // Badges de versions bibliques (exclure TOB suivi de ponctuation de versets pour ne pas casser le livre de Tobie)
      processed = processed.replace(/(^|[^\w])(Bible\s+de\s+Jérusalem|SEGOND|SYNODALE|T\.O\.B\.|DARBY|Français\s+Courant|Colombe|BFC|NBS|NFC|S21)\b/gi, '$1<span class="dict-version-badge">$2</span>');
      processed = processed.replace(/(^|[^\w])(TOB)(?!\.|\s*[,0-9IVXLCDM])\b/g, '$1<span class="dict-version-badge">$2</span>');

      // Normalisation des marqueurs orphelins (chiffre ou lettre seul sur une ligne avec texte sur la suivante)
      processed = processed.replace(/^(\d+)\.?\s*\n+([A-ZÉÈÊËÀÂÄÎÏÔÖÙÛÜÇa-zÀ-ÿ])/gm, '$1. $2');
      processed = processed.replace(/^([a-z]\))\s*\n+([A-ZÉÈÊËÀÂÄÎÏÔÖÙÛÜÇa-zÀ-ÿ])/gm, '$1 $2');

      // Nettoyage typographique : suppression espace avant point, espaces dans parenthèses
      processed = processed.replace(/\b([A-Za-zÉÈÊËÀÂÄÎÏÔÖÙÛÜÇéèêëàâäîïôöùûüç]+)\s+\./g, '$1.');
      processed = processed.replace(/\(\s+([^\)]+?)\s+\)/g, '($1)');
      processed = processed.replace(/\s+\.1\b/g, '');

      // Normalisation des références bibliques abrégées NDB avec points (ex: 1Ch 24.1 , 6, 10 ou 2S 20.14, 15, 18 ou Nom 2.3)
      processed = processed.replace(/\b(1Ch|2Ch|1S|2S|1R|2R|Lc|Mt|Mc|Jn|Ac|Rm|1Co|2Co|Ga|Ep|Ph|Col|1Th|2Th|1Tm|2Tm|Tt|Phm|He|Hé|Jc|1P|2P|1J|2J|3J|1Jn|2Jn|3Jn|Jd|Ap|Gn|Ex|Lv|Nb|Nom|Dt|Jos|Jg|Rt|Esd|Né|Ne|Est|Jb|Ps|Pr|Ec|Ct|Es|Jr|Lm|Ez|Dn|Os|Jl|Am|Ab|Jon|Mi|Na|Ha|So|Ag|Za|Ml|4M)\s+(\d+)\.(\d+(?:\s*[\-–]\s*\d+)?(?:\s*,\s*\d+)*)/gi, (match, bk, ch, vs) => {
        const k = cleanBookKey(bk);
        const bookFr = BOOK_ALIASES[k] || bk;
        const cleanVs = vs.replace(/\s+/g, '');
        return `${bookFr} ${ch}:${cleanVs}`;
      });

      // Normalisation des références de livres avec chapitre seul (ex: Gn 4, Gn 13, Hé 9)
      processed = processed.replace(/\b(1Ch|2Ch|1S|2S|1R|2R|Lc|Mt|Mc|Jn|Ac|Rm|1Co|2Co|Ga|Ep|Ph|Col|1Th|2Th|1Tm|2Tm|Tt|Phm|He|Hé|Jc|1P|2P|1J|2J|3J|1Jn|2Jn|3Jn|Jd|Ap|Gn|Ex|Lv|Nb|Nom|Dt|Jos|Jg|Rt|Esd|Né|Ne|Est|Jb|Ps|Pr|Ec|Ct|Es|Jr|Lm|Ez|Dn|Os|Jl|Am|Ab|Jon|Mi|Na|Ha|So|Ag|Za|Ml|4M)\s+(\d+)\b/gi, (match, bk, ch) => {
        const k = cleanBookKey(bk);
        const bookFr = BOOK_ALIASES[k] || bk;
        return `${bookFr} ${ch}`;
      });

      // Normalisation des versets composés sans rappel de livre (ex: Matthieu 18:4 ; 23.12 -> Matthieu 18:4 ; 23:12)
      processed = processed.replace(/([;,]\s*)(\d+)\.(\d+(?:\s*[\-–]\s*\d+)?(?:\s*,\s*\d+)*)/g, '$1$2:$3');

      // 0c. Traitement spécifique Dom Calmet (1728)
      const isCalmetDict = (this.activeDictId === 'calmet') || ((this.activeDictInfo?.name || '').toLowerCase().includes('calmet'));
      if (isCalmetDict) {
        // Découpage automatique des homonymes (1), (2), (3)... uniquement au début d'une ligne
        if (/(?:^|\n+)(?:[A-ZÉÈÊËÀÂÄÎÏÔÖÙÛÜÇ\-]{2,}\s+)?\(\s*1\s*\)/i.test(processed) && /(?:^|\n+)(?:[A-ZÉÈÊËÀÂÄÎÏÔÖÙÛÜÇ\-]{2,}\s+)?\(\s*2\s*\)/i.test(processed)) {
          processed = processed.replace(/^[A-ZÉÈÊËÀÂÄÎÏÔÖÙÛÜÇ\-]{2,}\s*\(\s*1\s*\)\s*/i, '(1) ');
          const parts = processed.split(/(?:\n+)(?:[A-ZÉÈÊËÀÂÄÎÏÔÖÙÛÜÇ\-]{2,}\s+)?\(\s*(\d+)\s*\)\s*/i);
          if (parts.length > 2) {
            const outCards = [];
            const preamble = (parts[0] || '').trim();
            if (preamble && preamble.length > 5 && !preamble.toUpperCase().includes('DICTIONNAIRE')) {
              outCards.push(`<p style="margin: 8px 0 12px 0; line-height: 1.75;">${preamble}</p>`);
            }
            for (let i = 1; i < parts.length; i += 2) {
              const num = parts[i];
              let body = (parts[i + 1] || '').trim();
              if (body.startsWith('..') || body.startsWith('.')) body = body.replace(/^\.+/, '').trim();
              outCards.push(`<div class="dict-subentry-card dict-calmet-homonym" id="dict-subentry-${num}"><span class="dict-subentry-num">${num}</span><div class="dict-subentry-content" style="flex: 1; font-size: 14.5px; line-height: 1.75;">${body}</div></div>`);
            }
            processed = outCards.join('\n\n');
          }
        }

        // Aération des longs paragraphes monolithiques de Calmet aux articulations logiques
        const transitions = [
          'Jésus[–\\-]Christ lui fit réponse', 'Eusèbe dit', 'Abagare, ou Abgar,',
          'Il est étonnant', 'Les difficultés qu\'on', 'On raconte qu\'', 'C\'est ce que raconte',
          'Selon le récit de', 'A l\'occasion d\'un', 'En effet, plusieurs', 'Vers ces derniers temps',
          'Il faut en effet convenir', 'A ces lettres d\'', 'Le célèbre Addison', 'La correspondance dont',
          'Ceux qui rejettent', 'Les voies de Dieu', 'Continuons de citer', 'M\\. Boré répète',
          'Réponse :', 'Après avoir dit', 'Toute l\'Eglise', 'M\\. Cyprien Robert', 'Or, le roi était',
          'Les porteurs de la lettre', 'La mort d\'Arshavir', 'Quelque temps après', 'Pendant le voyage',
          'Pendant ce temps', 'Après la mort de', 'Dans la suite', 'Selon saint Jérôme',
          'Eusèbe remarque', 'Les Hébreux croient', 'Josèphe raconte', 'Cette remarque servira',
          'Il était plus âgé', 'Lorsque les', 'Après cela', 'Enfin,', 'Le Seigneur lui', 'Moïse lui raconta',
          'Sur quoi', 'De là vient', 'Ce prince', 'On voit dans', 'Plus tard', 'Vers ce même temps',
          'Dieu s’étant manifesté', 'En même temps', 'Alors ils assemblèrent', 'Citation :'
        ];
        const transRegex = new RegExp(`(?<=[.!?;:])\\s+(${transitions.join('|')})`, 'g');
        processed = processed.replace(transRegex, '\n\n$1');

        // Renvois cliquables vers les autres articles de Calmet
        processed = processed.replace(/\b(?:dans|à|sous)\s+l’article\s+(?:de\s+|d’)?([A-ZÉÈÊËÀÂÄÎÏÔÖÙÛÜÇ]{2,})\b/g, (match, word) => {
          const cleanW = word.replace(/[.,;:()\[\]]+$/, '').trim();
          return `dans l’article de <a href="javascript:void(0)" class="dict-cross-ref-link" data-word="${this.escapeHtml(cleanW)}">${this.escapeHtml(cleanW)}</a>`;
        });
        processed = processed.replace(/\bcomme on le verra dans l'article de\s+([A-ZÉÈÊËÀÂÄÎÏÔÖÙÛÜÇ]{2,})\b/g, (match, word) => {
          const cleanW = word.replace(/[.,;:()\[\]]+$/, '').trim();
          return `comme on le verra dans l'article de <a href="javascript:void(0)" class="dict-cross-ref-link" data-word="${this.escapeHtml(cleanW)}">${this.escapeHtml(cleanW)}</a>`;
        });
        processed = processed.replace(/\bVoyez\s+([A-ZÉÈÊËÀÂÄÎÏÔÖÙÛÜÇ]{2,})\b/g, (match, word) => {
          const cleanW = word.replace(/[.,;:()\[\]]+$/, '').trim();
          return `Voyez <a href="javascript:void(0)" class="dict-cross-ref-link" data-word="${this.escapeHtml(cleanW)}">${this.escapeHtml(cleanW)}</a>`;
        });
        processed = processed.replace(/\bVoy\.\s+([A-ZÉÈÊËÀÂÄÎÏÔÖÙÛÜÇ]{2,})\b/g, (match, word) => {
          const cleanW = word.replace(/[.,;:()\[\]]+$/, '').trim();
          return `Voy. <a href="javascript:void(0)" class="dict-cross-ref-link" data-word="${this.escapeHtml(cleanW)}">${this.escapeHtml(cleanW)}</a>`;
        });
      }

      // Notes éditoriales entre crochets [...] dans Calmet
      processed = processed.replace(/\[([^\]]{3,900})\]/g, (match, inner) => {
        const cleanInner = inner.trim();
        // Cas d'un renvoi direct : [Voyez X] ou [Voir X]
        if (/^(?:Voyez|Voir|Voy\.)\s+[A-ZÉÈÊËÀÂÄÎÏÔÖÙÛÜÇ\-\s]+[.,;]?$/i.test(cleanInner)) {
          const word = cleanInner.replace(/^(?:Voyez|Voir|Voy\.)\s+/i, '').replace(/[.,;:()\[\]]+$/, '').trim();
          return `<a href="javascript:void(0)" class="dict-cross-ref-link" data-word="${this.escapeHtml(word)}">Voyez ${this.escapeHtml(word)}</a>`;
        }
        // Si c'est un long bloc éditorial indépendant (> 160 caractères ou note de savant/M. Boré)
        if (cleanInner.length > 160 && (cleanInner.includes('. ') || cleanInner.startsWith('M.') || cleanInner.startsWith('Note') || cleanInner.startsWith('A l\'occasion'))) {
          return `\n\n<div class="dict-calmet-editorial-note"><span class="dict-calmet-note-label">Note critique & historique :</span>${cleanInner}</div>\n\n`;
        }
        // Sinon, glose ou précision courte inline
        return `<span class="dict-editorial-gloss">[${cleanInner}]</span>`;
      });
      // Nettoyage des virgules ou points orphelins en début de ligne
      processed = processed.replace(/\n\s*([,;:\.])/g, '$1');
    }

    // 1. Normalisation des références bibliques et conversion des chiffres romains
    if (this.optConvertRoman) {
      // Vulgate avec crochets : (IV Reg. [II Rois], XXIII, 29-30) ou (*IV Reg.* [II Rois], XXIII, 29-30)
      processed = processed.replace(/(^|[^\wÀ-ÿ*])(?:\*+)?([I|V|X|1-4\s]*[A-Za-zÉÈÊËÀÂÄÎÏÔÖÙÛÜÇéèêëàâäîïôöùûüç\.]+)(?:\*+)?\s*\[([^\]]+)\]\s*,\s*([IVXLCDM0-9]+)\s*,\s*([0-9]+(?:\s*(?:,|et|\-|\–)\s*[0-9]+)*)/gi, (match, prefix, rawB, bkAlias, romCh, verses) => {
        const kAlias = cleanBookKey(bkAlias);
        const kRaw = cleanBookKey(rawB);
        const bookFr = BOOK_ALIASES[kAlias] || BOOK_ALIASES[kRaw] || bkAlias;
        const chNum = ROMAN_MAP[romCh.toUpperCase()] || romCh;
        const cleanV = verses.replace(/et\s+/g, '').replace(/–/g, '-').replace(/\s+/g, '');
        return `${prefix}${bookFr} ${chNum}:${cleanV}`;
      });

      // Classiques avec chiffres romains et versets multiples (ex: Ps. XXXIII, 10-11 ou *Isaïe* XLIV, 14 ou (*Daniel* XIII, 58) ou Ézéch., XVIII, 7, 16)
      processed = processed.replace(/(^|[^\wÀ-ÿ*])(?:\*+)?((?:I{1,3}|IV|[1-4])\s*[A-Za-zÉÈÊËÀÂÄÎÏÔÖÙÛÜÇéèêëàâäîïôöùûüç\.]+|[A-Za-zÉÈÊËÀÂÄÎÏÔÖÙÛÜÇéèêëàâäîïôöùûüç\.]+)(?:\*+)?\s*[\.,]*\s*([IVXLCDM]+)\s*,\s*([0-9]+(?:\s*(?:,|et|\-|\–)\s*[0-9]+)*)/gi, (match, prefix, rawB, romCh, verses) => {
        const k = cleanBookKey(rawB);
        const bookFr = BOOK_ALIASES[k];
        const chNum = ROMAN_MAP[romCh.toUpperCase()];
        if (bookFr && chNum) {
          const cleanV = verses.replace(/et\s+/g, '').replace(/–/g, '-').replace(/\s+/g, '');
          return `${prefix}${bookFr} ${chNum}:${cleanV}`;
        }
        return match;
      });

      // Références consécutives sans rappel de nom de livre (ex: Psaumes 33:10-11 ; XXXVI, 25 -> Psaumes 33:10-11 ; 36:25)
      processed = processed.replace(/([;,]\s*)([IVXLCDM]+)\s*,\s*([0-9]+(?:\s*(?:,|et|\-|\–)\s*[0-9]+)*)/g, (match, sep, romCh, verses) => {
        const chNum = ROMAN_MAP[romCh.toUpperCase()];
        if (chNum) {
          const cleanV = verses.replace(/et\s+/g, '').replace(/–/g, '-').replace(/\s+/g, '');
          return `${sep}${chNum}:${cleanV}`;
        }
        return match;
      });

      // Contextuelles : Ézéchiel (VIII, 14) ou *Ézéchiel* (VIII, 14) -> Ézéchiel 8:14
      processed = processed.replace(/(^|[^\wÀ-ÿ*])(?:\*+)?([A-Za-zÉÈÊËÀÂÄÎÏÔÖÙÛÜÇéèêëàâäîïôöùûüç]+)(?:\*+)?\s*\(([IVXLCDM]+)\s*,\s*([0-9]+(?:\s*[\-–]\s*[0-9]+)?)\)/gi, (match, prefix, rawB, romCh, verses) => {
        const k = cleanBookKey(rawB);
        const bookFr = BOOK_ALIASES[k];
        if (bookFr) {
          const chNum = ROMAN_MAP[romCh.toUpperCase()] || romCh;
          const cleanV = verses.replace(/–/g, '-').replace(/\s+/g, '');
          return `${prefix}${bookFr} ${chNum}:${cleanV}`;
        }
        return match;
      });

      // Paralipomènes (XXXV, 25) -> (2 Chroniques 35:25)
      processed = processed.replace(/Paralipomènes\s*\(([IVXLCDM]+)\s*,\s*([0-9]+)\)/gi, (match, romCh, v) => {
        const chNum = ROMAN_MAP[romCh.toUpperCase()] || romCh;
        return `Paralipomènes (2 Chroniques ${chNum}:${v})`;
      });

      // Tomes, parties, planches et ouvrages : t. I -> t. 1, pl. LXV -> pl. 65, Sat. I -> Sat. 1
      processed = processed.replace(/\bI(?:re|ère)\s+(partie|série)/gi, '1re $1');
      processed = processed.replace(/\bII(?:e|ème)\s+(partie|série)/gi, '2e $1');
      processed = processed.replace(/\bIII(?:e|ème)\s+(partie|série)/gi, '3e $1');
      processed = processed.replace(/(^|[^\w])(tomes?|t\.|pl\.|planche|sat\.|saturnales)\s+([IVXLCDM]+)\b/gi, (match, prefix, label, rom) => {
        const arab = ROMAN_MAP[rom.toUpperCase()] || rom;
        const normL = label.toLowerCase().startsWith('tome') ? 'tome' : (label.toLowerCase().startsWith('t.') ? 't.' : label);
        return `${prefix}${normL} ${arab}`;
      });

      // Nettoyage des astérisques orphelins attachés aux versets bibliques (ex: Matthieu 22.4 * -> Matthieu 22.4)
      processed = processed.replace(/(\b[0-9]+(?::|\.)[0-9]+(?:\s*[\-–,]\s*[0-9]+)*)\s*\*/g, '$1');
      processed = processed.replace(/\(\s*([^\)\n]+?)\s*\*\s*\)/g, '($1)');
    }

    // 1c. Remplacement des renvois d'articles inline en cours de paragraphe (ex: *Voir aussi :* **FUMIER** (tome 2, colonne 2415) ou Voir HACHILA.)
    const inlineSeeRx = /(?:[*_]+)?\s*\b(?:Voir(?:\s+(?:aussi|également))?|Voyez)\b(?:\s*:\s*|\s+)(?:\*\*([A-ZÉÈÊËÀÂÄÎÏÔÖÙÛÜÇ\-\s]{2,35})\*\*|([A-Za-zÉÈÊËÀÂÄÎÏÔÖÙÛÜÇéèêëàâäîïôöùûüç\-\s]{2,35}))(?:\s*\(([^)]+)\))?(?=[.,;:!\?\s]|$)/g;
    processed = processed.replace(inlineSeeRx, (match, boldW, plainW, parenMeta) => {
      let cleanW = (boldW || plainW || '').replace(/^(?:voir|voyez)?\s*(?:aussi|également)?\s*[:\s]*/i, '').trim();
      if (!cleanW || cleanW.length < 2) return match;
      // RÈGLE STRICTE : Uniquement les noms en MAJUSCULES qui existent RÉELLEMENT dans le dictionnaire
      if (cleanW !== cleanW.toUpperCase() || !/^[A-ZÉÈÊËÀÂÄÎÏÔÖÙÛÜÇ\-\s]{2,35}$/.test(cleanW) || !this.isValidHeadword(cleanW)) {
        return match;
      }
      if (/^(?:I{1,3}|IV|V|VI|VII|VIII|IX|X|XI|XII|TOB|NBS|BFC|S21)$/.test(cleanW)) return match;
      const metaHtml = parenMeta ? ` <span class="dict-see-meta">(${this.escapeHtml(parenMeta.trim())})</span>` : '';
      return `Voir aussi : <span class="dict-cross-ref-item"><a href="javascript:void(0)" class="dict-cross-ref-link" data-word="${this.escapeHtml(cleanW)}"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg><span>${this.escapeHtml(cleanW)}</span></a>${metaHtml}</span>`;
    });

    // 2. Extraction des citations de sources entre parenthèses (avec support des parenthèses imbriquées comme in-8°)
    if (this.optFootnotes) {
      let outChars = '';
      let i = 0;
      while (i < processed.length) {
        if (processed[i] === '(') {
          // Scanner jusqu'à la parenthèse fermante équilibrée
          let depth = 1;
          let j = i + 1;
          while (j < processed.length && depth > 0) {
            if (processed[j] === '\n') break; // ne pas franchir de saut de ligne
            if (processed[j] === '(') depth++;
            else if (processed[j] === ')') depth--;
            j++;
          }

          if (depth === 0) {
            const inner = processed.slice(i + 1, j - 1);
            const lower = inner.toLowerCase();

            // Éviter les faux positifs sur les badges de versions bibliques
            const hasVersionBadge = inner.includes('dict-version-badge');
            const isFigOrPlanche = /^(?:voir\s+)?(?:fig\b|fig\.|figure|planche|pl\b|pl\.|carte)/i.test(inner.trim());
            
            // Ne pas transformer les parenthèses situées sur une ligne de renvoi Voir
            const lineStart = processed.lastIndexOf('\n', i);
            const currentLine = processed.slice(lineStart === -1 ? 0 : lineStart + 1, i);
            const isSeeLine = /^\s*[*•-]?\s*(?:\*+|_+)?\s*(?:Voir|V\.)/i.test(currentLine);

            const isSource = !hasVersionBadge && !isFigOrPlanche && !isSeeLine && ['col.', 'p.', 'page', 't.', 'tome', 'édit', 'éd.', 'vol.', 'in-4', 'in-8', 'in-fol', 'in-octavo', 'in-quarto', 'in-folio', 'ouv. cité', 'op. cit.', 'comment.', 'explan.', 'scholia', 'lexicon', 'revue', 'theol.', 'religionsgeschichte', 'monuments', 'sat.', 'genesis', 'mélanges', 'description de la palestine', 'thésaurus', 'keilinschriften', 'les prophètes'].some(k => lower.includes(k));

            if (isSource && inner.length >= 12 && inner.length <= 450) {
              const fnId = this.currentFootnotesList.length + 1;
              const cleanText = inner.replace(/[*_`]+/g, '').trim();
              this.currentFootnotesList.push({ id: fnId, text: cleanText });
              outChars += `<span class="theol-fn-badge" data-fn-id="${fnId}" id="dict-fnref-${fnId}">${fnId}</span>`;
              i = j;
              continue;
            }
          }
        }
        outChars += processed[i];
        i++;
      }
      processed = outChars;
    }

    // Nettoyage des retours à la ligne orphelins devant deux-points (\n: -> :)
    processed = processed.replace(/\n\s*:\s*/g, ' : ');

    // 3. Traitement structuré ligne par ligne
    const lines = processed.split(/\r?\n/);
    const out = [];
    let inSeeList = false;
    let inUlList = false;
    let inBulletCategory = false;
    let currentBlockquote = [];

    const flushBlockquote = () => {
      if (currentBlockquote.length > 0) {
        const bqRaw = currentBlockquote.join(' ').trim();
        const bqFmt = bqRaw
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.*?)\*/g, '<em>$1</em>');
        out.push(`<blockquote class="dict-article-blockquote">${bqFmt}</blockquote>`);
        currentBlockquote = [];
      }
    };

    lines.forEach((line, lineIdx) => {
      const raw = line.trim();
      if (!raw) {
        flushBlockquote();
        if (inSeeList) { out.push('</ul>'); inSeeList = false; }
        if (inUlList) { out.push('</ul>'); inUlList = false; }
        inBulletCategory = false;
        return;
      }

      // Supprimer le titre répété isolé en ligne 0 s'il n'apporte rien (ex: "Abel" ou "Abana")
      if (this.optLogosRestructure && lineIdx === 0 && !raw.includes(' ') && !raw.includes('.') && !raw.includes(':') && !raw.startsWith('#')) {
        return;
      }

      // Traitement des blockquotes multiline (> Citation...)
      if (raw.startsWith('>')) {
        if (inSeeList) { out.push('</ul>'); inSeeList = false; }
        if (inUlList) { out.push('</ul>'); inUlList = false; }
        const bqLine = raw.replace(/^>\s*/, '');
        currentBlockquote.push(bqLine);
        return;
      } else {
        flushBlockquote();
      }

      // Séparateurs horizontaux (---, ***, ___, – – –)
      if (/^(?:-{3,}|\*{3,}|_{3,}|[–—]{3,}|(?:[-*–—]\s*){3,})$/.test(raw)) {
        if (inSeeList) { out.push('</ul>'); inSeeList = false; }
        if (inUlList) { out.push('</ul>'); inUlList = false; }
        out.push('<div class="dict-article-divider-wrap"><hr class="dict-article-divider" /></div>');
        return;
      }

      // A) Titres Markdown standards (# à ######)
      const headingMatch = raw.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        if (inSeeList) { out.push('</ul>'); inSeeList = false; }
        if (inUlList) { out.push('</ul>'); inUlList = false; }
        const level = headingMatch[1].length;
        let titleContent = headingMatch[2].trim();
        // Évaluer le gras et l'italique à l'intérieur du titre pour supprimer les astérisques brutes
        const titleFmt = formatInlineMarkdown(titleContent);
        
        const margins = {
          1: 'margin: 24px 0 12px 0; font-size: 22px; font-weight: 800;',
          2: 'margin: 22px 0 10px 0; font-size: 19px; font-weight: 700;',
          3: 'margin: 18px 0 8px 0; font-size: 17px; font-weight: 700;',
          4: 'margin: 16px 0 8px 0; font-size: 15.5px; font-weight: 700;',
          5: 'margin: 14px 0 6px 0; font-size: 14.5px; font-weight: 700;',
          6: 'margin: 12px 0 6px 0; font-size: 13.5px; font-weight: 700;'
        };
        out.push(`<h${level} class="dict-heading dict-h${level}" style="${margins[level] || ''}">${titleFmt}</h${level}>`);
        return;
      }

      // B00) Ligne initiale d'Étymologie & Langues originales (ex: *(Hébreu : מַעֲלוֹת / ma‘ălôt)* ou GÉHENNE (grec : γέεννα...))
      const isInitialEtym = lineIdx <= 2 && /^\*?\(?\s*(?:Hébreu|Grec|Latin|Septante|Vulgate|Araméen|Arabe|Syriaque)\s*:/i.test(raw);
      if (isInitialEtym) {
        let cleanEtym = raw.replace(/^[*_`\s\(\)]+/, '').replace(/[*_`\s\(\)\.]*$/, '').trim();
        const cleanEtymFmt = formatInlineMarkdown(cleanEtym);
        out.push(`
          <div class="dict-etymology-box" style="margin: 10px 0 14px 0; padding: 10px 14px; border-radius: 0 6px 6px 0; font-size: 14.5px;">
            <span class="dict-etymology-label" style="font-weight: 700; font-size: 13.5px;">Langues originales :</span>
            <span class="dict-etymology-content" style="margin-left: 6px;">${cleanEtymFmt}</span>
          </div>
        `);
        return;
      }

      // B00b) Ligne initiale avec Mot-Vedette et étymologie entre parenthèses (ex: **AVIM** (hébreu : ...) ou 8. GABAA HACHILA (hébreu : ...))
      if (lineIdx <= 2 && !raw.startsWith('I.') && !raw.startsWith('#')) {
        const etymInlineMatch = raw.match(/^(?:[0-9]+\.\s+)?(?:\*\*|\*|_)?([A-ZÉÈÊËÀÂÄÎÏÔÖÙÛÜÇÏ\-\s]{2,})(?:\*\*|\*|_)?\s*\(([^)]*(?:hébreu|grec|latin|septante|vulgate|araméen|arabe|syriaque)[^)]*)\)[,\s]*(.*)$/i);
        if (etymInlineMatch) {
          const innerEtym = etymInlineMatch[2].trim();
          const restText = etymInlineMatch[3].trim();
          const cleanEtymFmt = formatInlineMarkdown(innerEtym);
          out.push(`
            <div class="dict-etymology-box" style="margin: 10px 0 14px 0; padding: 10px 14px; border-radius: 0 6px 6px 0; font-size: 14.5px;">
              <span class="dict-etymology-label" style="font-weight: 700; font-size: 13.5px;">Langues originales :</span>
              <span class="dict-etymology-content" style="margin-left: 6px;">${cleanEtymFmt}</span>
            </div>
          `);
          if (restText) {
            const restFormatted = formatInlineMarkdown(restText);
            out.push(`<p style="margin: 12px 0; line-height: 1.75;">${restFormatted}</p>`);
          }
          return;
        }
      }

      // B0) En-tête NDB avec variantes et définition courte (Ligne initiale - strictement réservé à NDB)
      if (this.optLogosRestructure && !isVigouroux && lineIdx <= 2 && raw.includes(' : ') && !raw.startsWith('I.') && !raw.startsWith('1.') && !raw.startsWith('**') && !raw.startsWith('#') && !raw.startsWith('*(') && !raw.startsWith('(')) {
        const colonIdx = raw.indexOf(' : ');
        const varPart = raw.substring(0, colonIdx).trim();
        const meanPart = raw.substring(colonIdx + 3).trim();
        if (!varPart.includes('(') && meanPart.length > 0) {
          let meaningOnly = meanPart;
          let introPart = '';
          if (meanPart.includes('. ') && meanPart.split('. ')[0].length < 60) {
            const sp = meanPart.split('. ');
            meaningOnly = sp[0].trim() + '.';
            introPart = sp.slice(1).join('. ').trim();
          }

          if (varPart) {
            out.push(`<div class="dict-header-variants" style="margin-bottom: 6px; font-size: 14px; color: var(--text-secondary); line-height: 1.6;">${varPart}</div>`);
          }
          out.push(`<div class="dict-etymology-box" style="margin: 10px 0 14px 0; padding: 10px 14px; border-radius: 0 6px 6px 0; font-size: 14.5px; display: flex; align-items: center; gap: 8px;"><span class="dict-etymology-label" style="font-weight: 700; font-size: 13.5px; white-space: nowrap;">Signification :</span> <span><em>${meaningOnly}</em></span></div>`);
          if (introPart) {
            out.push(`<p style="margin: 8px 0 12px 0; line-height: 1.75;">${introPart}</p>`);
          }
          return;
        }
      }

      // B1) Grandes sections en chiffres romains NDB : I. Souffle, vapeur ; ... ou III. L’Alliance.
      if (this.optLogosRestructure) {
        const romSecMatch = raw.match(/^(I{1,3}|IV|V|VI|VII|VIII|IX|X)\.\s+(.+)$/);
        if (romSecMatch) {
          if (inSeeList) { out.push('</ul>'); inSeeList = false; }
          if (inUlList) { out.push('</ul>'); inUlList = false; }
          const romNum = romSecMatch[1];
          const romBody = romSecMatch[2].trim();

          let titlePart = romBody;
          let restPart = '';

          if (romBody.includes(' ; ')) {
            const sp = romBody.split(' ; ');
            if (sp[0].trim().length < 80) {
              titlePart = sp[0].trim();
              restPart = sp.slice(1).join(' ; ').trim();
            }
          } else if (romBody.includes('. ')) {
            const sp = romBody.split('. ');
            if (sp[0].trim().length < 80) {
              titlePart = sp[0].trim();
              restPart = sp.slice(1).join('. ').trim();
            }
          }

          out.push(`
            <div class="dict-roman-heading">
              <span class="dict-roman-badge">${romNum}</span>
              <span class="dict-roman-title">${this.escapeHtml(titlePart)}</span>
            </div>
          `);
          if (restPart) {
            const restFmt = restPart.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>');
            out.push(`<p style="margin: 8px 0; line-height: 1.75;">${restFmt}</p>`);
          }
          return;
        }
      }

      // B2) Sous-entrées numérotées Markdown : **1. AGRICOLA Conrad** ou **1. Hébal (Personnage)**
      const subHdrMatch = raw.match(/^\*\*(\d+)\.\s+([^*]+?)\*\*\s*(.*)$/) || raw.match(/^(\d+)\.\s+\*\*([^*]+?)\*\*\s*(.*)$/);
      if (subHdrMatch) {
        if (inSeeList) { out.push('</ul>'); inSeeList = false; }
        if (inUlList) { out.push('</ul>'); inUlList = false; }
        const num = subHdrMatch[1];
        const name = subHdrMatch[2].trim();
        const rest = (subHdrMatch[3] || '').trim();

        out.push(`
          <div class="dict-subentry-heading">
            <span class="dict-point-badge">${num}</span>
            <span>${this.escapeHtml(name)}</span>
          </div>
        `);
        if (rest) {
          const restFmt = rest.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>');
          out.push(`<p style="margin: 8px 0; line-height: 1.75;">${restFmt}</p>`);
        }
        return;
      }

      // B3) Points et sous-entrées numérotées : 1. **La stèle de la Loi :** ... ou 1. Proximité d'Aphec... ou 1 Proximité d'Aphec
      if (this.optLogosRestructure) {
        const rawNumMatch = raw.match(/^(\d+)[\.\)]\s*(.+)$/) || raw.match(/^(\d+)\s+([A-ZÉÈÊËÀÂÄÎÏÔÖÙÛÜÇ][a-zA-ZÉÈÊËÀÂÄÎÏÔÖÙÛÜÇa-zÀ-ÿ'\s\-]+?\s*:?\s*.+)$/);
        if (rawNumMatch && !raw.startsWith('1 Chroniques') && !raw.startsWith('2 Chroniques') && !raw.startsWith('1 Rois') && !raw.startsWith('2 Rois') && !raw.startsWith('1 Samuel') && !raw.startsWith('2 Samuel') && !raw.startsWith('1 Corinthiens') && !raw.startsWith('2 Corinthiens') && !raw.startsWith('1 Pierre') && !raw.startsWith('2 Pierre') && !raw.startsWith('1 Jean') && !raw.startsWith('2 Jean') && !raw.startsWith('3 Jean') && !raw.startsWith('1 Thessaloniciens') && !raw.startsWith('2 Thessaloniciens') && !raw.startsWith('1 Timothée') && !raw.startsWith('2 Timothée')) {
          if (inSeeList) { out.push('</ul>'); inSeeList = false; }
          if (inUlList) { out.push('</ul>'); inUlList = false; }
          const num = rawNumMatch[1];
          let content = rawNumMatch[2].trim();

          // Convertir les renvois inline dans le paragraphe (ex: Voir Abiyam. ou V. Ahbân)
          content = content.replace(/\b(?:Voir|V\.)\s+([A-ZÉÈÊËÀÂÄÎÏÔÖÙÛÜÇ][a-zA-ZÉÈÊËÀÂÄÎÏÔÖÙÛÜÇa-zÀ-ÿ\-]+)/g, (sm, targetW) => {
            return `<a href="javascript:void(0)" class="dict-cross-ref-link" data-word="${this.escapeHtml(targetW)}">🔗 ${this.escapeHtml(targetW)}</a>`;
          });

          // Évaluer d'abord le gras et l'italique
          content = content
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>');

          // Mise en valeur élégante de l'en-tête de phrase si présent
          if (!content.startsWith('<strong>') && content.includes(' : ') && content.indexOf(' : ') < 60) {
            const sp = content.split(' : ');
            content = `<strong>${sp[0]} :</strong> ${sp.slice(1).join(' : ')}`;
          } else if (!content.startsWith('<strong>') && content.includes('. ') && content.indexOf('. ') < 40 && !['s.', 'ch.', 'v.', 'r.', 'd.'].some(k => content.split('. ')[0].toLowerCase().includes(k))) {
            const sp = content.split('. ');
            content = `<strong>${sp[0]}.</strong> ${sp.slice(1).join('. ')}`;
          }

          out.push(`
            <div class="dict-numbered-point" id="dict-subentry-${num}">
              <span class="dict-point-badge">${num}</span>
              <div class="dict-point-content">${content}</div>
            </div>
          `);
          return;
        }
      }

      // B4) Sous-points avec lettres NDB : a) L'immersion... ou a)rupture...
      if (this.optLogosRestructure) {
        const alphaMatch = raw.match(/^([a-z])\)\s*(.+)$/);
        if (alphaMatch) {
          if (inSeeList) { out.push('</ul>'); inSeeList = false; }
          if (inUlList) { out.push('</ul>'); inUlList = false; }
          const letter = alphaMatch[1];
          let content = alphaMatch[2].trim();

          content = content.replace(/\b(?:Voir|V\.)\s+([A-ZÉÈÊËÀÂÄÎÏÔÖÙÛÜÇ][a-zA-ZÉÈÊËÀÂÄÎÏÔÖÙÛÜÇa-zÀ-ÿ\-]+)/g, (sm, targetW) => {
            return `<a href="javascript:void(0)" class="dict-cross-ref-link" data-word="${this.escapeHtml(targetW)}">🔗 ${this.escapeHtml(targetW)}</a>`;
          });

          content = content
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>');

          if (!content.startsWith('<strong>') && content.includes(' : ') && content.indexOf(' : ') < 60) {
            const sp = content.split(' : ');
            content = `<strong>${sp[0]} :</strong> ${sp.slice(1).join(' : ')}`;
          } else if (!content.startsWith('<strong>') && content.includes('. ') && content.indexOf('. ') < 40 && !['s.', 'ch.', 'v.', 'r.', 'd.'].some(k => content.split('. ')[0].toLowerCase().includes(k))) {
            const sp = content.split('. ');
            content = `<strong>${sp[0]}.</strong> ${sp.slice(1).join('. ')}`;
          }

          out.push(`
            <div class="dict-numbered-point dict-alpha-point" id="dict-subentry-${letter}">
              <span class="dict-point-badge">${letter}</span>
              <div class="dict-point-content">${content}</div>
            </div>
          `);
          return;
        }
      }

      // C) Renvois et Articles Connexes (ex: Voir Élever ; Humilité. ou *Voir* : **ÉBAL (1)** ou *Voir aussi* : **HÉBER**)
      let seeTargetCandidate = null;
      const voirMatch = raw.match(/^[*•-]?\s*(?:\*+|_+)?\s*(?:Voir|Voyez)(?:\s+(?:aussi|également))?\s*(?:\*+|_+)?\s*:?\s*(.*)$/i);
      if (voirMatch && !raw.startsWith('1.') && !raw.startsWith('2.') && !raw.startsWith('I.') && voirMatch[1].trim().length > 0) {
        seeTargetCandidate = voirMatch[1].trim();
      } else {
        const vMatch = raw.match(/^(?:\*+|_+)?\s*V\.\s*(?:\*+|_+)?\s*(?::\s*|\s+)([A-ZÉÈÊËÀÂÄÎÏÔÖÙÛÜÇ]{2,}.*)$/);
        if (vMatch && !['in-8', 'in-4', 'in-fol', 'p.', 'page', 'édit', 'vol.', 'paris', 'londres'].some(k => vMatch[1].toLowerCase().includes(k))) {
          seeTargetCandidate = vMatch[1].trim();
        }
      }

      if (seeTargetCandidate) {
        let rawTargetStr = seeTargetCandidate;
        // Supprimer toute balise HTML déjà injectée (ex: <span class="theol-fn-badge">...)
        rawTargetStr = rawTargetStr
          .replace(/<[^>]+>/g, ' ')
          .replace(/&lt;[^&]+&gt;/g, ' ')
          .replace(/\[([^\]]+)\](?:\([^\)]*\))?/g, '$1')
          .replace(/\s+/g, ' ')
          .trim();

        if (rawTargetStr.length < 250 && (/[A-ZÉÈÊËÀÂÄÎÏÔÖÙÛÜÇ]{2,}/.test(rawTargetStr) || rawTargetStr.includes('**') || rawTargetStr.includes('colonne') || rawTargetStr.includes('tome'))) {
          if (inUlList) { out.push('</ul>'); inUlList = false; }
          if (inSeeList) { out.push('</ul>'); inSeeList = false; }

          let inArticleIntro = '';
          let cleanTargetStr = rawTargetStr;
          const inArticleMatch = rawTargetStr.match(/^(.*?)\s+(?:dans|à|sous)\s+l['’]article(?:\s+de)?\s+([A-ZÉÈÊËÀÂÄÎÏÔÖÙÛÜÇ\-\s]+?)(?:\s+([0-9IVXLCDM]+.*|[,\.\(].*))?$/i);
          if (inArticleMatch) {
            inArticleIntro = inArticleMatch[1].trim();
            const targetWord = inArticleMatch[2].trim();
            const extraMeta = inArticleMatch[3] ? inArticleMatch[3].trim() : '';
            cleanTargetStr = extraMeta ? `${targetWord} (${extraMeta})` : targetWord;
          }

          // Découpage intelligent respectant les parenthèses et crochets
          const rawChunks = [];
          let currentChunk = [];
          let parenDepth = 0;
          let bracketDepth = 0;

          for (let i = 0; i < cleanTargetStr.length; i++) {
            const char = cleanTargetStr[i];
            if (char === '(') parenDepth++;
            else if (char === ')') parenDepth = Math.max(0, parenDepth - 1);
            else if (char === '[') bracketDepth++;
            else if (char === ']') bracketDepth = Math.max(0, bracketDepth - 1);

            if ((char === ';' || char === ',') && parenDepth === 0 && bracketDepth === 0) {
              const piece = currentChunk.join('').trim();
              if (piece) rawChunks.push(piece);
              currentChunk = [];
            } else {
              currentChunk.push(char);
            }
          }
          const lastPiece = currentChunk.join('').trim();
          if (lastPiece) rawChunks.push(lastPiece);

          // Regrouper les métadonnées isolées (ex: "col. 654" ou "t. II") avec l'article précédent
          const parsedTargets = [];
          rawChunks.forEach(chunk => {
            let c = chunk.replace(/\*\*/g, '').replace(/\*/g, '').trim().replace(/[.,;:]+$/, '');
            // Nettoyage strict : retirer tout "aussi :", "voir :", "v. :", etc.
            c = c.replace(/^(?:voir|voyez)?\s*(?:aussi|également)?\s*[:\s]*/i, '').trim();
            if (!c) return;

            const isPureMeta = /^(?:colonne|col\.|tome|t\.|p\.|page|vol\.|volume)\s*[0-9IVXLCDM]+/i.test(c);
            if (isPureMeta && parsedTargets.length > 0) {
              parsedTargets[parsedTargets.length - 1].meta = parsedTargets[parsedTargets.length - 1].meta ? `${parsedTargets[parsedTargets.length - 1].meta}, ${c}` : c;
              return;
            }

            let word = c;
            let meta = '';
            let qualifier = '';

            const parenMatch = c.match(/^([^(]+?)\s*\(([^)]+)\)\s*$/);
            if (parenMatch) {
              word = parenMatch[1].trim();
              const inner = parenMatch[2].trim();
              const metaRegex = /(?:(?:tome|t\.|vol\.|volume)\s*[0-9IVXLCDM]+(?:\s*,\s*)?)?(?:colonne|col\.|page|p\.)\s*\d+(?:\s+\d+)?|(?:tome|t\.|vol\.|volume)\s*[0-9IVXLCDM]+/i;
              const metaMatch = inner.match(metaRegex);
              if (metaMatch) {
                meta = metaMatch[0].trim();
                const textWithoutMeta = inner.replace(metaMatch[0], '').replace(/^[,\s–—;]+|[,\s–—;]+$/g, '').trim();
                if (textWithoutMeta) {
                  qualifier = textWithoutMeta;
                }
              } else {
                qualifier = inner;
              }
            }

            word = word.replace(/^(?:voir|voyez)?\s*(?:aussi|également)?\s*[:\s]*/i, '').replace(/[.,;:]+$/, '').trim();
            const currentTitleNorm = (this.currentEntryData?.title || this.activeSlug || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]/g, '');
            const wordNorm = word.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]/g, '');
            // RÈGLE STRICTE : Le mot DOIT être en majuscules ET exister dans le dictionnaire pour avoir un bouton
            if (word && word === word.toUpperCase() && /^[A-ZÉÈÊËÀÂÄÎÏÔÖÙÛÜÇ\-\s]{2,35}$/.test(word) && wordNorm !== currentTitleNorm && this.isValidHeadword(word)) {
              parsedTargets.push({ word, meta, qualifier });
            }
          });

          if (parsedTargets.length > 0) {
            const linksHtml = parsedTargets.map(t => {
              const isColOrTome = /^(?:colonne|col\.|tome|t\.|p\.|page)\s*\d+/i.test(t.word);
              if (isColOrTome) {
                const cleanMetaWord = (typeof TheolLatinGlossary !== 'undefined') ? TheolLatinGlossary.annotate(t.word) : this.escapeHtml(t.word);
                return `<span class="dict-see-meta">${cleanMetaWord}</span>`;
              }
              const displayLabel = t.word.replace(/^(?:voir|voyez)?\s*(?:aussi|également)?\s*[:\s]*/i, '').trim();
              const qualifierHtml = t.qualifier ? ` <span class="dict-see-qualifier" style="font-size: 13px; color: var(--text-secondary); font-style: italic;">(${this.escapeHtml(t.qualifier)})</span>` : '';
              let metaHtml = '';
              if (t.meta) {
                const annotatedMeta = (typeof TheolLatinGlossary !== 'undefined') ? TheolLatinGlossary.annotate(t.meta) : this.escapeHtml(t.meta);
                metaHtml = ` <span class="dict-see-meta">${annotatedMeta}</span>`;
              }
              return `
                <span class="dict-cross-ref-item" style="display: inline-flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                  <a href="javascript:void(0)" class="dict-cross-ref-link" data-word="${this.escapeHtml(t.word)}">
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                    <span>${this.escapeHtml(displayLabel)}</span>
                  </a>
                  ${qualifierHtml}
                  ${metaHtml}
                </span>
              `;
            }).join(' ');

            // OPTION B (Spécifique Vigouroux) : Fusion dans une boîte « Étude approfondie & Notice liée »
            let mergedOptionB = false;
            if (isVigouroux) {
              if (inArticleIntro) {
                let cleanIntro = inArticleIntro.replace(/[,\s]+$/, ' :');
                if (!cleanIntro.endsWith(':') && !cleanIntro.endsWith('.')) cleanIntro += ' :';
                out.push(`
                  <div class="dict-related-notice-box">
                    <div class="dict-related-notice-header">
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>
                      <span>Étude approfondie &amp; Notice liée</span>
                    </div>
                    <div class="dict-related-notice-body">
                      <p class="dict-related-intro">${cleanIntro}</p>
                      <div class="dict-related-actions">${linksHtml}</div>
                    </div>
                  </div>
                `);
                mergedOptionB = true;
              } else if (out.length > 0) {
                const lastOut = out[out.length - 1];
                const pMatch = lastOut.match(/^<p style="[^"]*">(.*?)<\/p>$/);
                if (pMatch) {
                  let pText = pMatch[1].trim();
                  const isNotBiblio = !['référence', 'source', 'auteur', 'biblio'].some(k => pText.toLowerCase().includes(k));
                  const isIntroPattern = isNotBiblio && (/^(?:Pour (?:une étude|l['’]étude|en savoir plus)|Sur la signification|Ce terme désigne|Consulter également|Pour la symbolique|\*+\s*Exégèse)/i.test(pText) || pText.endsWith(',') || pText.endsWith(':'));
                  if (isIntroPattern) {
                    // Nettoyer la ponctuation terminale
                    let cleanIntro = pText.replace(/[,\s]+$/, ' :');
                    if (!cleanIntro.endsWith(':') && !cleanIntro.endsWith('.')) cleanIntro += ' :';
                    out.pop(); // Retirer le paragraphe précédent pour le fusionner
                    out.push(`
                      <div class="dict-related-notice-box">
                        <div class="dict-related-notice-header">
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>
                          <span>Étude approfondie &amp; Notice liée</span>
                        </div>
                        <div class="dict-related-notice-body">
                          <p class="dict-related-intro">${cleanIntro}</p>
                          <div class="dict-related-actions">${linksHtml}</div>
                        </div>
                      </div>
                    `);
                    mergedOptionB = true;
                  }
                }
              }
            }

            if (!mergedOptionB) {
              out.push(`
                <div class="dict-see-row">
                  <span class="dict-see-label">Voir aussi :</span>
                  ${linksHtml}
                </div>
              `);
            }
            return;
          }
        }
      }

      // D0) Lignes d'Illustration brute (ex: *Illustration : D'après une peinture de Pompéi...*)
      const illustrMatch = raw.match(/^(?:\*+)?(?:Illustration|Figure|Gravure)\s*:\s*(.+?)(?:\*+)?$/i);
      if (illustrMatch) {
        const captionText = illustrMatch[1].replace(/[*_`]+/g, '').trim();
        if (inUlList) { out.push('</ul>'); inUlList = false; }
        out.push(`<!-- ILLUSTRATION_PLACEHOLDER:${this.escapeHtml(captionText)} -->`);
        return;
      }

      // D) Lignes de Bibliographie / Sources *Cf.* Hurter...
      const cfMatch = raw.match(/^(?:\*+)?(?:Cf\.|Confère|Conf\.|Bibliographie\s*:|Sources?\s*:)(?:\*+)?\s*(.*)$/i);
      if (cfMatch) {
        const srcBody = cfMatch[1].trim();
        const cleanSrc = srcBody.replace(/[*_`:]+/g, '').trim();
        if (cleanSrc.length >= 5) {
          if (this.optFootnotes) {
            const fnId = this.currentFootnotesList.length + 1;
            this.currentFootnotesList.push({ id: fnId, text: `Cf. ${cleanSrc}` });
            const badgeHtml = ` <span class="theol-fn-badge" data-fn-id="${fnId}" id="dict-fnref-${fnId}">${fnId}</span>`;

            let attached = false;
            for (let i = out.length - 1; i >= 0; i--) {
              if (out[i].endsWith('</li>')) {
                out[i] = out[i].slice(0, -5) + badgeHtml + '</li>';
                attached = true;
                break;
              } else if (out[i].endsWith('</p>')) {
                out[i] = out[i].slice(0, -4) + badgeHtml + '</p>';
                attached = true;
                break;
              } else if (out[i].endsWith('</div>')) {
                out[i] = out[i].slice(0, -6) + badgeHtml + '</div>';
                attached = true;
                break;
              }
            }
            if (!attached) {
              out.push(badgeHtml);
            }
            return;
          } else {
            if (inUlList) { out.push('</ul>'); inUlList = false; }
            out.push(`
              <div class="dict-cf-source-row">
                *Cf.* ${srcBody.replace(/\*(.*?)\*/g, '<em>$1</em>')}
              </div>
            `);
            return;
          }
        } else {
          // Titre de section bibliographique autonome (ex: **Bibliographie :**) -> afficher comme en-tête propre
          if (inUlList) { out.push('</ul>'); inUlList = false; }
          const headingLabel = raw.replace(/[*_`]+/g, '').trim();
          out.push(`<div class="dict-biblio-heading" style="margin: 16px 0 6px 0; font-weight: 700; font-size: 14.5px; color: var(--text-primary); font-style: italic;">${this.escapeHtml(headingLabel)}</div>`);
          return;
        }
      }

      // E) Listes à puces Markdown (* Ouvrage..., - Item..., • Item...) avec indentation hiérarchique
      const bulletMatch = line.match(/^(\s*)[*•-]\s+(.+)$/);
      if (bulletMatch) {
        if (!inUlList) {
          out.push('<ul class="dict-bullet-list">');
          inUlList = true;
        }
        const rawSpaces = bulletMatch[1].length;
        let itemText = bulletMatch[2].trim();

        // Rendre cliquables les renvois à l'intérieur des listes à puces (ex: *Voir* : **ÉBAL (1)**)
        itemText = itemText.replace(/\b(?:Voir|V\.)\s*:\s*<strong>([A-ZÉÈÊËÀÂÄÎÏÔÖÙÛÜÇ][^<]+?)<\/strong>/gi, (m, word) => {
          return `Voir : <a href="javascript:void(0)" class="dict-cross-ref-link" data-word="${this.escapeHtml(word.trim())}">${this.escapeHtml(word.trim())}</a>`;
        });

        // Détection de catégorie d'en-tête (ex: * **Attributs individuels :**)
        const isHeaderOnly = /^\*\*[^*]+:\*\*\s*$/.test(itemText) || /^\*\*[^*]+\*\*\s*:\s*$/.test(itemText);
        let isNested = (rawSpaces >= 2);
        if (!isNested && inBulletCategory && !isHeaderOnly) {
          isNested = true;
        }

        if (isHeaderOnly) {
          inBulletCategory = true;
        } else if (!isNested && !isHeaderOnly && (itemText.includes('. ') || itemText.length > 80)) {
          inBulletCategory = false;
        }

        const itemFormatted = formatInlineMarkdown(itemText);

        const extraClass = isNested ? ' dict-bullet-nested' : (isHeaderOnly ? ' dict-bullet-category' : '');
        out.push(`<li class="dict-bullet-item${extraClass}">${itemFormatted}</li>`);
        return;
      } else {
        if (inUlList) {
          out.push('</ul>');
          inUlList = false;
        }
        inBulletCategory = false;
      }

      // F) Blocs HTML préformatés (cartes, notes éditoriales, citations)
      if (raw.startsWith('<div') || raw.startsWith('<blockquote') || raw.startsWith('<p') || raw.startsWith('<ul') || raw.startsWith('<ol') || raw.startsWith('<table')) {
        out.push(raw);
        return;
      }

      // F2) Ligne d'ouvrages recommandés / bibliographie multiple avec points-virgules
      const biblioMultiMatch = raw.match(/^(?:\*+)?(?:Voir également|Voir aussi|Consulter aussi|Ouvrages recommandés|Ouvrages de référence|Bibliographie)\s*:(?:\*+)?\s*(.+)$/i);
      if (biblioMultiMatch) {
        const content = biblioMultiMatch[1].trim();
        if (content.includes(' ; ') || (content.includes(';') && content.split(';').length >= 2)) {
          const items = content.split(/\s*;\s*/).map(s => s.trim().replace(/\.$/, '')).filter(Boolean);
          if (items.length >= 2) {
            if (inUlList) { out.push('</ul>'); inUlList = false; }
            out.push(`<div class="dict-biblio-heading" style="margin: 16px 0 6px 0; font-weight: 700; font-size: 14.5px; color: var(--text-primary); font-style: italic;">Ouvrages recommandés :</div>`);
            out.push('<ul class="dict-bullet-list">');
            items.forEach(it => {
              const itFmt = formatInlineMarkdown(it);
              out.push(`  <li class="dict-bullet-item">${itFmt}</li>`);
            });
            out.push('</ul>');
            return;
          }
        }
      }

      // G) Paragraphe classique
      const pFmt = formatInlineMarkdown(raw);

      out.push(`<p style="margin: 8px 0; line-height: 1.75;">${pFmt}</p>`);
    });

    flushBlockquote();
    if (inSeeList) out.push('</ul>');
    if (inUlList) out.push('</ul>');

    return out.join('\n');
  },


  async polishCurrentArticle() {
    const match = this.currentMatches[this.activeSourceIndex] || this.currentEntryData;
    if (!match) return;

    const btn = document.getElementById('btn-dict-polish-article');
    if (btn) btn.disabled = true;

    const bodyEl = document.getElementById('dict-article-body');
    if (bodyEl) {
      const bannerHtml = `
        <div class="ai-processing-floating-banner">
          <div class="banner-icon">✨</div>
          <div class="banner-text shine-text">Restauration philologique et restructuration de la notice par l'IA...</div>
        </div>
      `;
      const curText = match.raw_text || match.full_text || match.preview || '';
      const formatted = this.formatArticleMarkdown(curText);
      const linkified = (typeof TheologyView !== 'undefined' && TheologyView.highlightScriptureReferences)
        ? TheologyView.highlightScriptureReferences(formatted)
        : formatted;
      bodyEl.innerHTML = `
        ${bannerHtml}
        <div class="dict-entry-body dict-entry-body-content ai-shining-container">${linkified}</div>
      `;
    }

    try {
      const res = await API.call('polish_dictionary_article', match.dict_id || this.activeDictId, match.title, match.raw_text || match.full_text, null, match.slug);
      if (res && res.success) {
        match.is_polished = true;
        match.full_text = res.text;
        match.polished_model = res.model;
        App.showToast('Notice restaurée par IA avec succès !', 'success');
        this.renderSelectedSourceMatch();
      } else {
        alert(`Erreur IA : ${res?.error || 'Erreur inconnue'}`);
        this.renderSelectedSourceMatch();
      }
    } catch (e) {
      alert(`Erreur d'appel IA : ${e}`);
      this.renderSelectedSourceMatch();
    } finally {
      if (btn) btn.disabled = false;
    }
  },

  // =========================================================================
  // 5. RECHERCHE RAPIDE MULTI-DICTIONNAIRES
  // =========================================================================

  async executeLookup(term) {
    const word = term.trim();
    if (!word) return;

    this.activeSlug = word;
    this.activeSourceIndex = 0;

    const bodyEl = document.getElementById('dict-article-body');
    const heroTitle = document.getElementById('dict-hero-title');
    const heroBadge = document.getElementById('dict-hero-badge');

    if (heroTitle) heroTitle.textContent = word;
    if (heroBadge) heroBadge.textContent = 'Recherche globale';
    if (bodyEl) {
      bodyEl.innerHTML = `<div style="padding: 40px; text-align: center; color: var(--text-muted);"><div class="synth-spinner" style="width:24px; height:24px; border-width:2px; margin: 0 auto 12px auto;"></div>Recherche dans les dictionnaires pour « ${word} »...</div>`;
    }

    try {
      const data = await API.call('lookup_dictionary', word);
      if (data && data.matches && data.matches.length > 0) {
        this.currentEntryData = {
          title: data.title || word,
          badge: data.badge,
          full_text: data.full_text,
          matches: data.matches
        };
        this.currentMatches = data.matches;
        this.renderArticleView();
      } else {
        // Fallback sur Wikipédia si aucun match dans les dictionnaires
        this.currentMatches = [];
        this.renderWikipedia(bodyEl);
      }
    } catch (e) {
      console.error('Erreur recherche dictionnaire:', e);
      if (bodyEl) {
        bodyEl.innerHTML = `<div style="padding: 30px; text-align: center; color: var(--accent-red);">Erreur lors de la recherche.</div>`;
      }
    }
  },

  // =========================================================================
  // 6. MODULE WIKIPÉDIA INTÉGRÉ
  // =========================================================================

  async renderWikipedia(container, exactTitle = null) {
    const query = exactTitle || this.currentEntryData?.title || this.activeSlug || 'Bible';
    container.innerHTML = `<div style="padding: 30px; color: var(--text-muted); text-align: center;"><div class="synth-spinner" style="width:24px; height:24px; border-width:2px; margin: 0 auto 12px auto;"></div>Chargement de l'article Wikipédia pour « ${query} »...</div>`;

    try {
      const data = await API.call('get_wikipedia_summary', query, exactTitle);
      if (!data || (!data.found && (!data.candidates || data.candidates.length === 0))) {
        container.innerHTML = `
          <div style="padding: 40px; color: var(--text-muted); text-align: center;">
            <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.8" style="display: block; margin: 0 auto 10px auto; opacity: 0.5;"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
            Aucun article Wikipédia pertinent trouvé pour « <strong>${query}</strong> ».
          </div>
        `;
        return;
      }

      const candidates = data.candidates || [];
      const currentTitle = data.title || exactTitle || query;

      let navHtml = `
        <div class="wiki-top-nav" style="margin-bottom: 16px;">
          ${candidates.length > 1 ? `
            <div class="wiki-cloud-box">
              <div class="wiki-cloud-label" style="font-size: 11px; font-weight: 700; color: var(--text-secondary); margin-bottom: 6px;">Articles connexes :</div>
              <div class="wiki-pills-bar" style="display: flex; flex-wrap: wrap; gap: 6px;">
                ${candidates.map(c => `
                  <button class="dict-source-pill ${c.title.toLowerCase() === currentTitle.toLowerCase() ? 'active' : ''}" data-title="${c.title}">
                    ${c.title}
                  </button>
                `).join('')}
              </div>
            </div>
          ` : ''}
        </div>
      `;

      const cleanExtract = (data.extract || '').replace(/\n\n/g, '<br><br>');
      const linkifiedExtract = (typeof TheologyView !== 'undefined' && TheologyView.highlightScriptureReferences)
        ? TheologyView.highlightScriptureReferences(cleanExtract)
        : cleanExtract;

      container.innerHTML = `
        <div class="wiki-container" style="line-height: 1.75; font-size: 15px;">
          ${navHtml}
          <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; margin-bottom: 14px; border-bottom: 1px solid var(--border-color); padding-bottom: 10px;">
            <div>
              <h2 style="font-size: 20px; font-weight: 700; color: var(--text-primary); margin: 0;">${data.title}</h2>
              ${data.description ? `<div style="font-size: 12px; color: var(--text-muted); font-weight: 600; margin-top: 2px;">${data.description}</div>` : ''}
            </div>
            <a href="${data.url}" target="_blank" style="font-size: 11px; color: var(--accent-blue); text-decoration: none; padding: 4px 8px; border: 1px solid var(--border-color); border-radius: 4px; white-space: nowrap;">Ouvrir sur le web ↗</a>
          </div>

          ${data.thumbnail ? `<img src="${data.thumbnail}" style="max-width: 180px; float: right; margin: 0 0 12px 16px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.2);" alt="${data.title}">` : ''}

          <div class="wiki-extract">${linkifiedExtract}</div>
        </div>
      `;

      // Attacher les clics sur les suggestions connexes
      container.querySelectorAll('.dict-source-pill').forEach(pill => {
        pill.addEventListener('click', () => {
          this.renderWikipedia(container, pill.dataset.title);
        });
      });

    } catch (e) {
      console.error('Erreur Wikipédia:', e);
      container.innerHTML = `<div style="padding: 20px; color: var(--accent-red);">Erreur de connexion à Wikipédia.</div>`;
    }
  },

  refreshVintage() {
    const cardEl = document.querySelector('.dict-article-card') || document.querySelector('.dict-view-main-scroll');
    if (cardEl && typeof VintageThemeManager !== 'undefined') {
      const data = this.currentEntryData;
      const dictName = data?.badge || data?.dict_name || this.activeDictInfo?.name || 'Vigouroux';
      VintageThemeManager.applyEpochToElement(cardEl, dictName);
    }
  }
};

window.DictView = DictView;
