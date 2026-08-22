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
          this.readingBg = bg;
          localStorage.setItem('dict_reading_bg', bg);
          this.applyDisplayPreferences();
        }
      });
    });
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
    const articleContainer = document.querySelector('.dict-article-panel');
    if (articleContainer) {
      articleContainer.classList.remove('reading-bg-white', 'reading-bg-sepia', 'reading-bg-dark');
      if (this.readingBg !== 'auto') {
        articleContainer.classList.add(`reading-bg-${this.readingBg}`);
      }
    }
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

  selectDictionary(dictId, targetSlug = null) {
    const dInfo = this.allDictionaries.find(d => d.id === dictId || d.name === dictId) || this.allDictionaries[0];
    if (!dInfo) return;

    this.activeDictId = dInfo.id;
    this.activeDictInfo = dInfo;

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

    // Réinitialiser la lettre A-Z sur 'ALL' et charger les entrées
    this.activeLetter = 'ALL';
    document.querySelectorAll('.dict-az-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.letter === 'ALL');
    });

    const filterInput = document.getElementById('dict-toc-filter-input');
    if (filterInput) filterInput.value = '';

    this.loadHeadwords('ALL', null, targetSlug);
  },

  // =========================================================================
  // 3. INDEX ALPHABÉTIQUE / TABLE DES MOTS (VOLET GAUCHE)
  // =========================================================================

  bindTocControls() {
    // Filtre de recherche dans l'index
    const filterIn = document.getElementById('dict-toc-filter-input');
    let filterTimer = null;

    filterIn?.addEventListener('input', (e) => {
      clearTimeout(filterTimer);
      filterTimer = setTimeout(() => {
        const q = e.target.value.trim();
        this.loadHeadwords(this.activeLetter, q);
      }, 200);
    });

    // Barre A-Z
    document.querySelectorAll('.dict-az-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.dict-az-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeLetter = btn.dataset.letter;
        
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
        countEl.textContent = `${total.toLocaleString('fr-FR')} entrée${total > 1 ? 's' : ''}`;
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

      this.renderArticleView();
    } catch (e) {
      console.error('Erreur lecture notice:', e);
      if (bodyEl) {
        bodyEl.innerHTML = `<div style="padding: 30px; text-align: center; color: var(--accent-red);">Erreur lors de la récupération de la notice.</div>`;
      }
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

    const rawText = match.full_text || match.raw_text || match.preview || '';
    this.currentFootnotesList = [];
    const formatted = this.formatArticleMarkdown(rawText);
    let linkified = (this.optScripture && typeof TheologyView !== 'undefined' && TheologyView.highlightScriptureReferences)
      ? TheologyView.highlightScriptureReferences(formatted)
      : formatted;
    if (typeof TheologyView !== 'undefined' && TheologyView.linkifyUrls) {
      linkified = TheologyView.linkifyUrls(linkified);
    }

    // Section des notes de bas de page si des citations ont été extraites
    let footnotesHtml = '';
    if (this.optFootnotes && this.currentFootnotesList.length > 0) {
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
            ${this.currentFootnotesList.map(fn => `
              <li class="theol-fn-item" id="theol-fn-${fn.id}" data-fn-id="${fn.id}" style="margin-bottom: 8px;">
                <span class="theol-fn-num" style="font-weight: 700; color: #6366f1; margin-right: 4px;">${fn.id}.</span>
                <span class="theol-fn-text">${(typeof TheologyView !== 'undefined' && TheologyView.highlightScriptureReferences) ? TheologyView.highlightScriptureReferences(fn.text) : fn.text}</span>
                <a href="#dict-fnref-${fn.id}" class="theol-fn-backref" data-target-id="dict-fnref-${fn.id}" title="Retour au passage" style="color: #6366f1; text-decoration: none; margin-left: 6px; font-weight: bold;">↩</a>
              </li>
            `).join('')}
          </ol>
        </div>
      `;
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

    // 2. Attacher les liens    // 2. Attacher les liens interactifs des Articles Connexes (*Voir* : MOT)
    bodyEl.querySelectorAll('.dict-cross-ref-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const word = link.dataset.word;
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

    // 5. Basculer vers l'original si cliqué
    bodyEl.querySelector('#btn-dict-view-original')?.addEventListener('click', () => {
      const origText = match.raw_text || match.full_text || '';
      bodyEl.innerHTML = `<div class="dict-entry-body-content">${this.formatArticleMarkdown(origText)}</div>`;
    });
  },

  formatArticleMarkdown(text) {
    if (!text) return '';

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
      'XCI': 91, 'XCII': 92, 'XCIII': 93, 'XCIV': 94, 'XCV': 95, 'XCVI': 96, 'XCVII': 97, 'XCVIII': 98, 'XCIX': 99, 'C': 100
    };

    const BOOK_ALIASES = {
      "gen": "Genèse", "genese": "Genèse", "ge": "Genèse", "gn": "Genèse",
      "exod": "Exode", "exode": "Exode", "ex": "Exode",
      "lev": "Lévitique", "levitique": "Lévitique", "lv": "Lévitique",
      "num": "Nombres", "nombres": "Nombres", "nb": "Nombres",
      "deut": "Deutéronome", "deuteronome": "Deutéronome", "dt": "Deutéronome",
      "jos": "Josué", "josue": "Josué",
      "jug": "Juges", "juges": "Juges", "jg": "Juges",
      "ruth": "Ruth", "rt": "Ruth",
      "i sam": "1 Samuel", "ii sam": "2 Samuel", "1 sam": "1 Samuel", "2 sam": "2 Samuel", "1s": "1 Samuel", "2s": "2 Samuel",
      "i reg": "1 Rois", "ii reg": "2 Rois", "iii reg": "1 Rois", "iv reg": "2 Rois",
      "1 reg": "1 Rois", "2 reg": "2 Rois", "3 reg": "1 Rois", "4 reg": "2 Rois",
      "i rois": "1 Rois", "ii rois": "2 Rois", "1 rois": "1 Rois", "2 rois": "2 Rois", "1r": "1 Rois", "2r": "2 Rois",
      "i par": "1 Chroniques", "ii par": "2 Chroniques", "1 par": "1 Chroniques", "2 par": "2 Chroniques",
      "1 ch": "1 Chroniques", "2 ch": "2 Chroniques", "1ch": "1 Chroniques", "2ch": "2 Chroniques",
      "i chron": "1 Chroniques", "ii chron": "2 Chroniques", "1 chron": "1 Chroniques", "2 chron": "2 Chroniques", "chron": "1 Chroniques",
      "esd": "Esdras", "esdras": "Esdras", "i esdr": "1 Esdras", "ii esdr": "2 Esdras",
      "neh": "Néhémie", "nehemie": "Néhémie", "né": "Néhémie", "ne": "Néhémie",
      "esth": "Esther", "esther": "Esther", "est": "Esther",
      "job": "Job", "jb": "Job",
      "ps": "Psaumes", "psa": "Psaumes", "psaumes": "Psaumes", "psaume": "Psaumes", "pss": "Psaumes",
      "prov": "Proverbes", "proverbes": "Proverbes", "pr": "Proverbes",
      "eccl": "Ecclésiaste", "ecclesiaste": "Ecclésiaste", "ec": "Ecclésiaste", "ecc": "Ecclésiaste",
      "cant": "Cantique des cantiques", "cantique": "Cantique des cantiques", "ct": "Cantique des cantiques",
      "is": "Ésaïe", "isa": "Ésaïe", "esaie": "Ésaïe", "isaie": "Ésaïe", "es": "Ésaïe",
      "jer": "Jérémie", "jeremie": "Jérémie", "jr": "Jérémie",
      "lam": "Lamentations", "lamentations": "Lamentations", "lm": "Lamentations",
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
      "matth": "Matthieu", "matt": "Matthieu", "mat": "Matthieu", "matthieu": "Matthieu", "mt": "Matthieu",
      "marc": "Marc", "mar": "Marc", "mc": "Marc",
      "luc": "Luc", "lc": "Luc",
      "jean": "Jean", "jn": "Jean",
      "act": "Actes", "actes": "Actes", "ac": "Actes",
      "rom": "Romains", "romains": "Romains", "ro": "Romains", "rm": "Romains",
      "i cor": "1 Corinthiens", "ii cor": "2 Corinthiens", "1 cor": "1 Corinthiens", "2 cor": "2 Corinthiens", "1co": "1 Corinthiens", "2co": "2 Corinthiens",
      "gal": "Galates", "galates": "Galates", "ga": "Galates",
      "eph": "Éphésiens", "ephesiens": "Éphésiens", "ep": "Éphésiens",
      "phil": "Philippiens", "philippiens": "Philippiens", "php": "Philippiens", "ph": "Philippiens",
      "col": "Colossiens", "colossiens": "Colossiens",
      "i thes": "1 Thessaloniciens", "ii thes": "2 Thessaloniciens", "1th": "1 Thessaloniciens", "2th": "2 Thessaloniciens",
      "i tim": "1 Timothée", "ii tim": "2 Timothée", "1tm": "1 Timothée", "2tm": "2 Timothée",
      "tit": "Tite", "tite": "Tite", "tt": "Tite",
      "phlm": "Philémon", "philemon": "Philémon", "phm": "Philémon",
      "heb": "Hébreux", "hebreux": "Hébreux", "he": "Hébreux", "hé": "Hébreux",
      "jacq": "Jacques", "jacques": "Jacques", "ja": "Jacques", "jas": "Jacques", "jc": "Jacques",
      "i pierre": "1 Pierre", "ii pierre": "2 Pierre", "1 pierre": "1 Pierre", "2 pierre": "2 Pierre", "1p": "1 Pierre", "2p": "2 Pierre",
      "i jean": "1 Jean", "ii jean": "2 Jean", "iii jean": "3 Jean", "1j": "1 Jean", "2j": "2 Jean", "3j": "3 Jean", "1jn": "1 Jean", "2jn": "2 Jean", "3jn": "3 Jean",
      "jud": "Juges", "jude": "Jude", "jd": "Jude",
      "apoc": "Apocalypse", "apocalypse": "Apocalypse", "rev": "Apocalypse", "apo": "Apocalypse", "ap": "Apocalypse",
      "4m": "4 Maccabées"
    };

    const cleanBookKey = (name) => {
      return (name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[*_`\.]+/g, '').trim().toLowerCase();
    };

    let processed = (text || '').replace(/[\u00a0\u202f]/g, ' ');

    // 0. Traitement des Balises Logos Standards
    processed = processed
      .replace(/\[\[@Headword:[^\]]+\]\]/gi, '')
      .replace(/\[\[@Bible:([^\]]+)\]\]/gi, '($1)')
      .replace(/\[\[@(?:Topic|Article):([^\]]+)\]\]/gi, 'Voir : $1')
      .replace(/\[\[@Strong:([HG]\d+)\]\]/gi, 'Strong $1');

    // 0b. Restructuration Automatique des textes bruts (Logos / NDB)
    if (this.optLogosRestructure) {
      // Badges de versions bibliques EN PREMIER (évite que T.O.B. soit pris pour un tome "t." de source)
      processed = processed.replace(/(^|[^\w])(SEGOND|SYNODALE|JÉRUSALEM|T\.O\.B\.|TOB|DARBY|Français Courant|Colombe|BFC|NBS|NFC|S21)\b/gi, '$1<span class="dict-version-badge">$2</span>');

      // Nettoyage typographique : suppression espace avant point, espaces dans parenthèses
      processed = processed.replace(/\b([A-Za-zÉÈÊËÀÂÄÎÏÔÖÙÛÜÇéèêëàâäîïôöùûüç]+)\s+\./g, '$1.');
      processed = processed.replace(/\(\s+([^\)]+?)\s+\)/g, '($1)');
      processed = processed.replace(/\s+\.1\b/g, '');

      // Normalisation des références bibliques abrégées NDB avec points (ex: 1Ch 24.1 , 6, 10 ou 2S 20.14, 15, 18)
      processed = processed.replace(/\b(1Ch|2Ch|1S|2S|1R|2R|Lc|Mt|Mc|Jn|Ac|Rm|1Co|2Co|Ga|Ep|Ph|Col|1Th|2Th|1Tm|2Tm|Tt|Phm|He|Hé|Jc|1P|2P|1J|2J|3J|1Jn|2Jn|3Jn|Jd|Ap|Gn|Ex|Lv|Nb|Dt|Jos|Jg|Rt|Esd|Né|Ne|Est|Jb|Ps|Pr|Ec|Ct|Es|Jr|Lm|Ez|Dn|Os|Jl|Am|Ab|Jon|Mi|Na|Ha|So|Ag|Za|Ml|4M)\s+(\d+)\.(\d+(?:\s*[\-–]\s*\d+)?(?:\s*,\s*\d+)*)/gi, (match, bk, ch, vs) => {
        const k = cleanBookKey(bk);
        const bookFr = BOOK_ALIASES[k] || bk;
        const cleanVs = vs.replace(/\s+/g, '');
        return `${bookFr} ${ch}:${cleanVs}`;
      });

      // Normalisation des références de livres avec chapitre seul (ex: Gn 4, Gn 13, Hé 9)
      processed = processed.replace(/\b(1Ch|2Ch|1S|2S|1R|2R|Lc|Mt|Mc|Jn|Ac|Rm|1Co|2Co|Ga|Ep|Ph|Col|1Th|2Th|1Tm|2Tm|Tt|Phm|He|Hé|Jc|1P|2P|1J|2J|3J|1Jn|2Jn|3Jn|Jd|Ap|Gn|Ex|Lv|Nb|Dt|Jos|Jg|Rt|Esd|Né|Ne|Est|Jb|Ps|Pr|Ec|Ct|Es|Jr|Lm|Ez|Dn|Os|Jl|Am|Ab|Jon|Mi|Na|Ha|So|Ag|Za|Ml|4M)\s+(\d+)\b/gi, (match, bk, ch) => {
        const k = cleanBookKey(bk);
        const bookFr = BOOK_ALIASES[k] || bk;
        return `${bookFr} ${ch}`;
      });

      // Normalisation des versets composés sans rappel de livre (ex: Matthieu 18:4 ; 23.12 -> Matthieu 18:4 ; 23:12)
      processed = processed.replace(/([;,]\s*)(\d+)\.(\d+(?:\s*[\-–]\s*\d+)?(?:\s*,\s*\d+)*)/g, '$1$2:$3');

      // Liens de saut interne : Voir N° 8 -> ancre vers sous-carte 8
      processed = processed.replace(/\bVoir\s+(?:N°|n°|numéro)\s*(\d+)\b/gi, '<a href="javascript:void(0)" class="dict-internal-jump-link" data-jump-to="dict-subentry-$1">Voir n° $1</a>');
    }

    // 1. Normalisation des références bibliques et conversion des chiffres romains
    if (this.optConvertRoman) {
      // Vulgate avec crochets : (IV Reg. [II Rois], XXIII, 29-30)
      processed = processed.replace(/([I|V|X|1-4\s]*\*?[A-Za-zÉÈÊËÀÂÄÎÏÔÖÙÛÜÇéèêëàâäîïôöùûüç\.]+\*?)\s*\[([^\]]+)\]\s*,\s*([IVXLCDM0-9]+)\s*,\s*([0-9]+(?:\s*(?:,|et|\-|\–)\s*[0-9]+)*)/gi, (match, rawB, bkAlias, romCh, verses) => {
        const kAlias = cleanBookKey(bkAlias);
        const kRaw = cleanBookKey(rawB);
        const bookFr = BOOK_ALIASES[kAlias] || BOOK_ALIASES[kRaw] || bkAlias;
        const chNum = ROMAN_MAP[romCh.toUpperCase()] || romCh;
        const cleanV = verses.replace(/et\s+/g, '').replace(/–/g, '-').replace(/\s+/g, '');
        return `${bookFr} ${chNum}:${cleanV}`;
      });

      // Classiques avec chiffres romains et abréviations complexes : I Par.*, VI, 41 ou Zach., XII, 11
      processed = processed.replace(/(?:\*+)?\b((?:I{1,3}|IV|[1-4])\s*[\*A-Za-zÉÈÊËÀÂÄÎÏÔÖÙÛÜÇéèêëàâäîïôöùûüç\.]+|[A-Za-zÉÈÊËÀÂÄÎÏÔÖÙÛÜÇéèêëàâäîïôöùûüç\.]+)(?:\*+)?\s*,\s*([IVXLCDM]+)\s*,\s*([0-9]+(?:\s*[\-–]\s*[0-9]+)?)/gi, (match, rawB, romCh, verses) => {
        const k = cleanBookKey(rawB);
        const bookFr = BOOK_ALIASES[k];
        if (bookFr) {
          const chNum = ROMAN_MAP[romCh.toUpperCase()] || romCh;
          const cleanV = verses.replace(/–/g, '-').replace(/\s+/g, '');
          return `${bookFr} ${chNum}:${cleanV}`;
        }
        return match;
      });

      // Contextuelles : Ézéchiel (VIII, 14) -> Ézéchiel 8:14
      processed = processed.replace(/\b([A-Za-zÉÈÊËÀÂÄÎÏÔÖÙÛÜÇéèêëàâäîïôöùûüç]+)\s*\(([IVXLCDM]+)\s*,\s*([0-9]+(?:\s*[\-–]\s*[0-9]+)?)\)/gi, (match, rawB, romCh, verses) => {
        const k = cleanBookKey(rawB);
        const bookFr = BOOK_ALIASES[k];
        if (bookFr) {
          const chNum = ROMAN_MAP[romCh.toUpperCase()] || romCh;
          const cleanV = verses.replace(/–/g, '-').replace(/\s+/g, '');
          return `${bookFr} ${chNum}:${cleanV}`;
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
    }

    // 2. Extraction des citations de sources entre parenthèses
    if (this.optFootnotes) {
      processed = processed.replace(/\(([^\)\n]{12,350})\)/g, (match, inner) => {
        const lower = inner.toLowerCase();
        // Éviter les faux positifs sur les badges de versions bibliques déjà balisés
        if (inner.includes('dict-version-badge')) return match;
        const isSource = ['col.', 'p.', 'page', 't.', 'tome', 'édit', 'éd.', 'vol.', 'in-4', 'in-8', 'in-fol', 'ouv. cité', 'op. cit.', 'comment.', 'explan.', 'scholia', 'lexicon', 'revue', 'theol.', 'religionsgeschichte', 'monuments', 'sat.', 'genesis', 'mélanges', 'description de la palestine', 'thésaurus', 'keilinschriften', 'les prophètes'].some(k => lower.includes(k));
        if (isSource) {
          const fnId = this.currentFootnotesList.length + 1;
          const cleanText = inner.replace(/[*_`]+/g, '').trim();
          this.currentFootnotesList.push({ id: fnId, text: cleanText });
          return `<span class="theol-fn-badge" data-fn-id="${fnId}" id="dict-fnref-${fnId}">${fnId}</span>`;
        }
        return match;
      });
    }

    // 3. Traitement structuré ligne par ligne
    const lines = processed.split(/\r?\n/);
    const out = [];
    let inSeeList = false;
    let inUlList = false;

    lines.forEach((line, lineIdx) => {
      const raw = line.trim();
      if (!raw) {
        if (inSeeList) { out.push('</ul>'); inSeeList = false; }
        if (inUlList) { out.push('</ul>'); inUlList = false; }
        return;
      }

      // Supprimer le titre répété isolé en ligne 0 s'il n'apporte rien (ex: "Abel" ou "Abana")
      if (this.optLogosRestructure && lineIdx === 0 && !raw.includes(' ') && !raw.includes('.') && !raw.includes(':')) {
        return;
      }

      // A) Titres Markdown standards
      if (raw.startsWith('#')) {
        if (inSeeList) { out.push('</ul>'); inSeeList = false; }
        if (inUlList) { out.push('</ul>'); inUlList = false; }
        if (raw.startsWith('### ')) {
          out.push(`<h3 style="margin: 18px 0 8px 0; font-size: 17px; font-weight: 700;">${this.escapeHtml(raw.slice(4))}</h3>`);
          return;
        }
        if (raw.startsWith('## ')) {
          out.push(`<h2 style="margin: 22px 0 10px 0; font-size: 19px; font-weight: 700;">${this.escapeHtml(raw.slice(3))}</h2>`);
          return;
        }
        if (raw.startsWith('# ')) {
          out.push(`<h1 style="margin: 24px 0 12px 0; font-size: 22px; font-weight: 800;">${this.escapeHtml(raw.slice(2))}</h1>`);
          return;
        }
      }

      // B0) En-tête NDB avec variantes et étymologie (Ligne initiale)
      if (this.optLogosRestructure && lineIdx <= 1 && raw.includes(' : ') && !raw.startsWith('I.') && !raw.startsWith('1.') && !raw.startsWith('**') && !raw.startsWith('#')) {
        const colonIdx = raw.indexOf(' : ');
        const varPart = raw.substring(0, colonIdx).trim();
        const meanPart = raw.substring(colonIdx + 3).trim();
        if (meanPart.length > 0 && meanPart.length < 180) {
          if (varPart) {
            out.push(`<div class="dict-header-variants" style="margin-bottom: 6px; font-size: 14px; color: var(--text-secondary); line-height: 1.6;">${varPart}</div>`);
          }
          out.push(`<div class="dict-etymology-box"><span class="dict-etymology-label">💡 Signification :</span> <span><em>${meanPart}</em></span></div>`);
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
            out.push(`<p style="margin: 8px 0; line-height: 1.75;">${restPart}</p>`);
          }
          return;
        }
      }

      // B2) Sous-entrées numérotées Markdown : **1. AGRICOLA Conrad**
      const subHdrMatch = raw.match(/^\*\*(\d+)\.\s+([^*]+?)\*\*\s*(.*)$/) || raw.match(/^(\d+)\.\s+\*\*([^*]+?)\*\*\s*(.*)$/);
      if (subHdrMatch) {
        if (inSeeList) { out.push('</ul>'); inSeeList = false; }
        if (inUlList) { out.push('</ul>'); inUlList = false; }
        const num = subHdrMatch[1];
        const name = subHdrMatch[2].trim();
        const rest = (subHdrMatch[3] || '').trim();

        out.push(`
          <div class="dict-subentry-heading" style="margin-top: 22px; margin-bottom: 8px; font-size: 16px; font-weight: 800; color: var(--text-primary); border-bottom: 1px solid var(--border-color); padding-bottom: 4px;">
            <span class="dict-subentry-num" style="display: inline-flex; align-items: center; justify-content: center; background: #6366f1; color: #fff; border-radius: 4px; padding: 1px 7px; font-size: 11.5px; font-weight: 700; margin-right: 6px;">${num}</span>
            <span>${this.escapeHtml(name)}</span>
          </div>
        `);
        if (rest) {
          const restFmt = rest.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>');
          out.push(`<p style="margin: 8px 0; line-height: 1.75;">${restFmt}</p>`);
        }
        return;
      }

      // B3) Sous-entrées numérotées NDB brutes : 1.Épouse de Hetsrôn... ou 1. Une réalité...
      if (this.optLogosRestructure) {
        const rawNumMatch = raw.match(/^(\d+)\.\s*(.+)$/);
        if (rawNumMatch) {
          if (inSeeList) { out.push('</ul>'); inSeeList = false; }
          if (inUlList) { out.push('</ul>'); inUlList = false; }
          const num = rawNumMatch[1];
          let content = rawNumMatch[2].trim();

          // Convertir les renvois inline dans le paragraphe (ex: Voir Abiyam. ou V. Ahbân)
          content = content.replace(/\b(?:Voir|V\.)\s+([A-ZÉÈÊËÀÂÄÎÏÔÖÙÛÜÇ][a-zA-ZÉÈÊËÀÂÄÎÏÔÖÙÛÜÇa-zÀ-ÿ\-]+)/g, (sm, targetW) => {
            return `<a href="javascript:void(0)" class="dict-cross-ref-link" data-word="${this.escapeHtml(targetW)}">🔗 ${this.escapeHtml(targetW)}</a>`;
          });

          // Mise en valeur de l'en-tête de phrase si présent
          if (content.includes(' : ') && content.indexOf(' : ') < 60) {
            const sp = content.split(' : ');
            content = `<strong>${sp[0]} :</strong> ${sp.slice(1).join(' : ')}`;
          } else if (content.includes('. ') && content.indexOf('. ') < 40 && !['s.', 'ch.', 'v.', 'r.', 'd.'].some(k => content.split('. ')[0].toLowerCase().includes(k))) {
            const sp = content.split('. ');
            content = `<strong>${sp[0]}.</strong> ${sp.slice(1).join('. ')}`;
          }

          out.push(`
            <div class="dict-subentry-card" id="dict-subentry-${num}">
              <span class="dict-subentry-num">${num}</span>
              <div class="dict-subentry-content">${content}</div>
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
          const content = alphaMatch[2].trim();

          out.push(`
            <div class="dict-alpha-card">
              <span class="dict-alpha-badge">${letter})</span>
              <div class="dict-alpha-content">${content}</div>
            </div>
          `);
          return;
        }
      }

      // C) Renvois et Articles Connexes (ex: Voir Élever ; Humilité. ou Voir Abiyam ou V. Ahbân)
      const seeMatch = raw.match(/^[*•-]?\s*(?:\*+|_+)?\s*(?:Voir|V\.)(?:\s+(?:aussi|également))?\s*(?:\*+|_+)?\s*:?\s*(?:\*\*)?([A-ZÉÈÊËÀÂÄÎÏÔÖÙÛÜÇ].+?)[\.\s]*$/i);
      if (seeMatch && !raw.startsWith('1.') && !raw.startsWith('2.') && !raw.startsWith('I.')) {
        if (inUlList) { out.push('</ul>'); inUlList = false; }
        if (inSeeList) { out.push('</ul>'); inSeeList = false; }
        const rawTargets = seeMatch[1].trim().replace(/\*\*/g, '');
        const targets = rawTargets.split(/[;,]/).map(t => t.trim()).filter(t => t.length > 0);

        if (targets.length > 0) {
          const linksHtml = targets.map(t => `
            <a href="javascript:void(0)" class="dict-cross-ref-link" data-word="${this.escapeHtml(t)}">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
              <span>${this.escapeHtml(t)}</span>
            </a>
          `).join(' ');

          out.push(`
            <div class="dict-see-row" style="margin: 14px 0 10px 0; display: flex; align-items: center; flex-wrap: wrap; gap: 6px; padding-top: 8px; border-top: 1px dashed var(--border-color);">
              <span class="dict-see-label" style="font-size: 13px; font-weight: 700; color: var(--text-muted);">Voir aussi :</span>
              ${linksHtml}
            </div>
          `);
          return;
        }
      }

      // D) Lignes de Bibliographie / Sources *Cf.* Hurter...
      const cfMatch = raw.match(/^(?:\*+)?(?:Cf\.|Confère|Conf\.|Bibliographie\s*:|Sources?\s*:)(?:\*+)?\s*(.+)$/i);
      if (cfMatch) {
        const srcBody = cfMatch[1].trim();
        if (this.optFootnotes) {
          const fnId = this.currentFootnotesList.length + 1;
          const cleanSrc = srcBody.replace(/[*_`]+/g, '').trim();
          this.currentFootnotesList.push({ id: fnId, text: `Cf. ${cleanSrc}` });
          const badgeHtml = ` <span class="theol-fn-badge" data-fn-id="${fnId}" id="dict-fnref-${fnId}">${fnId}</span>`;

          // Attacher le badge en exposant directement à la fin du dernier élément (liste ou paragraphe)
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
        } else {
          if (inUlList) { out.push('</ul>'); inUlList = false; }
          out.push(`
            <div class="dict-cf-source-row" style="margin: 8px 0 12px 0; font-size: 13px; color: var(--text-secondary); font-style: italic;">
              *Cf.* ${srcBody.replace(/\*(.*?)\*/g, '<em>$1</em>')}
            </div>
          `);
        }
        return;
      }

      // E) Listes à puces Markdown (* Ouvrage...)
      const bulletMatch = raw.match(/^[*•-]\s+(.+)$/);
      if (bulletMatch) {
        if (!inUlList) {
          out.push('<ul style="padding-left: 22px; margin: 8px 0 12px 0; list-style-type: disc;">');
          inUlList = true;
        }
        const itemText = bulletMatch[1].trim().replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>');
        out.push(`<li style="margin-bottom: 5px; line-height: 1.6;">${itemText}</li>`);
        return;
      } else {
        if (inUlList) {
          out.push('</ul>');
          inUlList = false;
        }
      }

      // F) Paragraphe classique
      const pFmt = raw
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/^\> (.*$)/gim, '<blockquote style="border-left: 3px solid var(--accent-blue); padding: 8px 14px; margin: 12px 0; background: var(--bg-subtle); border-radius: 0 6px 6px 0; font-style: italic;">$1</blockquote>');

      out.push(`<p style="margin: 8px 0; line-height: 1.75;">${pFmt}</p>`);
    });

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
