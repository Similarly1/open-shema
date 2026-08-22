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

  init() {
    this.bindHeaderControls();
    this.bindTocControls();
    this.bindArticleControls();
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

  adjustZoom(delta) {
    this.currentZoom = Math.min(180, Math.max(70, this.currentZoom + delta));
    const lbl = document.getElementById('lbl-dict-zoom-level');
    const bodyEl = document.getElementById('dict-article-body');
    if (lbl) lbl.textContent = `${this.currentZoom}%`;
    if (bodyEl) {
      bodyEl.style.fontSize = `${16 * (this.currentZoom / 100)}px`;
    }
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

    this.renderSelectedSourceMatch();
  },

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
    const formatted = this.formatArticleMarkdown(rawText);
    let linkified = (typeof TheologyView !== 'undefined' && TheologyView.highlightScriptureReferences)
      ? TheologyView.highlightScriptureReferences(formatted)
      : formatted;
    if (typeof TheologyView !== 'undefined' && TheologyView.linkifyUrls) {
      linkified = TheologyView.linkifyUrls(linkified);
    }

    bodyEl.innerHTML = `
      ${polishBannerHtml}
      <div class="dict-entry-body-content">${linkified}</div>
    `;

    // Attacher les liens vers les versets bibliques
    if (typeof ScriptureTooltip !== 'undefined') {
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

    // Basculer vers l'original si cliqué
    bodyEl.querySelector('#btn-dict-view-original')?.addEventListener('click', () => {
      const origText = match.raw_text || match.full_text || '';
      bodyEl.innerHTML = `<div class="dict-entry-body-content">${this.formatArticleMarkdown(origText)}</div>`;
    });
  },

  formatArticleMarkdown(text) {
    if (!text) return '';
    const formatted = text
      .replace(/^### (.*$)/gim, '<h3 style="margin: 16px 0 8px 0; font-size: 17px; font-weight: 700;">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 style="margin: 20px 0 10px 0; font-size: 19px; font-weight: 700;">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 style="margin: 22px 0 12px 0; font-size: 22px; font-weight: 800;">$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/^\> (.*$)/gim, '<blockquote style="border-left: 3px solid var(--accent-blue); padding: 8px 14px; margin: 12px 0; background: var(--bg-subtle); border-radius: 0 6px 6px 0; font-style: italic;">$1</blockquote>')
      .replace(/^\- (.*$)/gim, '<li style="margin-left: 20px; margin-bottom: 4px;">$1</li>');

    return formatted
      .split(/\n\n+/)
      .map(p => p.trim())
      .filter(Boolean)
      .map(p => (p.startsWith('<h') || p.startsWith('<blockquote') || p.startsWith('<li')) ? p : `<p style="margin: 8px 0; line-height: 1.75;">${p}</p>`)
      .join('');
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
  }
};

window.DictView = DictView;
