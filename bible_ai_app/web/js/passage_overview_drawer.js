/**
 * Passage Overview Drawer Controller
 * Gère le volet « Aperçu 360° » dans le tiroir droit du lecteur biblique.
 * 
 * 100% SVG purs (aucun émoji).
 * Agrège et affiche en temps réel :
 * - Bandeau de compteurs rapides (Commentaires, Articles, Livres, Notes, Lieux, Strongs)
 * - Accordéons déroulants avec aperçus élégants
 * - Passerelles directes vers les onglets et vues de l'application au clic
 */

const PassageOverviewDrawer = {
  currentBook: 'Gen',
  currentChapter: 1,
  currentVerse: 1,
  currentBible: 'LSG',
  currentData: null,
  isLoading: false,
  isSynchronized: true,

  debounceTimer: null,
  collapsedSections: {},

  switchTab(tabId) {
    if (typeof App !== 'undefined' && App.switchDrawerTab) {
      App.switchDrawerTab(tabId);
    } else {
      const tabBtn = document.querySelector(`.drawer-tab[data-drawer-tab="${tabId}"]`);
      if (tabBtn) tabBtn.click();
    }
  },


  // Icônes SVG vectorielles réutilisables (100% sans émoji)
  icons: {
    compass: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>`,
    commentary: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
    article: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 20H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h10l6 6v8a2 2 0 0 1-2 2z"/><path d="M14 2v6h6"/><path d="M7 13h10"/><path d="M7 17h6"/></svg>`,
    book: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M6 6h10"/><path d="M6 10h10"/></svg>`,
    note: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>`,
    map: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`,
    video: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>`,
    lexicon: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/></svg>`,

    sparkle: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/></svg>`,
    study: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`,
    chevronDown: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>`,
    arrowRight: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>`,
    clock: `<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
    plus: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
    sync: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`
  },

  init() {
    this.bindEvents();
    // Restaurer l'état des accordéons
    try {
      const saved = localStorage.getItem('bible_overview_collapsed_sections');
      if (saved) this.collapsedSections = JSON.parse(saved);
    } catch (e) {}
  },

  bindEvents() {
    // Bouton de synchronisation
    const btnSync = document.getElementById('btn-overview-toggle-sync');
    btnSync?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.isSynchronized = !this.isSynchronized;
      this.updateSyncUI();
      if (this.isSynchronized) {
        this.load(this.currentBook, this.currentChapter, this.currentVerse, this.currentBible, true);
      }
    });

    // Bouton verset précédent / suivant (Navigation précise de verset)
    document.getElementById('btn-overview-prev-v')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const bCode = this.currentBook || (typeof BibleReader !== 'undefined' ? BibleReader.currentBook : 'GEN');
      const ch = parseInt(this.currentChapter || (typeof BibleReader !== 'undefined' ? BibleReader.currentChapter : 1), 10) || 1;
      const curV = parseInt(this.currentVerse || (typeof BibleReader !== 'undefined' ? BibleReader.selectedVerse : 1) || 1, 10);
      const nextV = Math.max(1, curV - 1);
      if (typeof BibleReader !== 'undefined' && BibleReader.selectVerse) {
        BibleReader.selectVerse(bCode, ch, nextV, { scroll: true, behavior: 'smooth', block: 'center' });
      } else {
        this.load(bCode, ch, nextV, this.currentBible, true);
      }
    });

    document.getElementById('btn-overview-next-v')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const bCode = this.currentBook || (typeof BibleReader !== 'undefined' ? BibleReader.currentBook : 'GEN');
      const ch = parseInt(this.currentChapter || (typeof BibleReader !== 'undefined' ? BibleReader.currentChapter : 1), 10) || 1;
      const curV = parseInt(this.currentVerse || (typeof BibleReader !== 'undefined' ? BibleReader.selectedVerse : 1) || 1, 10);
      const nextV = curV + 1;
      if (typeof BibleReader !== 'undefined' && BibleReader.selectVerse) {
        BibleReader.selectVerse(bCode, ch, nextV, { scroll: true, behavior: 'smooth', block: 'center' });
      } else {
        this.load(bCode, ch, nextV, this.currentBible, true);
      }
    });

    // Initialisation du popover d'infobulle au survol
    this.initPopover();

    // Boutons d'action globale
    document.getElementById('btn-overview-action-synth')?.addEventListener('click', (e) => {
      e.stopPropagation();
      document.querySelector('.drawer-tab[data-drawer-tab="commentaries"]')?.click();
      setTimeout(() => {
        if (typeof CommentarySynthesizerUI !== 'undefined') {
          CommentarySynthesizerUI.openModal();
        }
      }, 100);
    });

    document.getElementById('btn-overview-action-study')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const refStr = this.currentData?.reference || `${this.currentBook} ${this.currentChapter}:${this.currentVerse}`;
      if (typeof App !== 'undefined' && App.switchView) {
        App.switchView('view-passage-study');
        setTimeout(() => {
          if (typeof PassageStudyView !== 'undefined' && PassageStudyView.loadPassage) {
            PassageStudyView.loadPassage(refStr);
          }
        }, 150);
      }
    });

    document.getElementById('btn-overview-action-ai')?.addEventListener('click', (e) => {
      e.stopPropagation();
      document.querySelector('.drawer-tab[data-drawer-tab="ai"]')?.click();
      setTimeout(() => {
        const refStr = this.currentData?.reference || `${this.currentBook} ${this.currentChapter}:${this.currentVerse}`;
        const inputEl = document.querySelector('.drawer-ai-input-wrapper textarea');
        if (inputEl) {
          inputEl.value = `Peux-tu m'expliquer le contexte et les enjeux clés du passage de ${refStr} ?`;
          inputEl.focus();
        }
      }, 100);
    });
  },

  updateSyncUI() {
    const btn = document.getElementById('btn-overview-toggle-sync');
    const lbl = document.getElementById('lbl-overview-sync');
    if (!btn) return;
    if (this.isSynchronized) {
      btn.classList.add('active');
      btn.classList.remove('unlinked');
      if (lbl) lbl.textContent = 'Lié';
      btn.title = 'Synchronisation active : suit le texte biblique';
    } else {
      btn.classList.remove('active');
      btn.classList.add('unlinked');
      if (lbl) lbl.textContent = 'Délié';
      btn.title = 'Aperçu indépendant (Cliquer pour lier)';
    }
  },

  /**
   * Charge les données complètes d'aperçu pour le verset donné.
   */
  load(bookCode, chapter, verse = 1, bibleName = 'LSG', force = false) {
    if (!force && !this.isSynchronized) {
      return;
    }

    this.currentBook = bookCode || this.currentBook;
    this.currentChapter = parseInt(chapter) || this.currentChapter;
    this.currentVerse = parseInt(verse) || 1;
    this.currentBible = bibleName || this.currentBible;

    // Débouncer l'appel API pour garantir 60fps lors des défilements rapides
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(async () => {
      await this.fetchAndRender();
    }, 120);
  },

  async fetchAndRender() {
    this.isLoading = true;
    this.renderLoadingHeader();

    try {
      const data = await API.getPassageOverviewBundle(
        this.currentBook,
        this.currentChapter,
        this.currentVerse,
        this.currentBible
      );

      if (data && data.success) {
        this.currentData = data;
        this.render(data);
      } else {
        this.renderError(data?.error || 'Impossible de charger les données du passage.');
      }
    } catch (e) {
      console.error('[PassageOverviewDrawer] Erreur chargement:', e);
      this.renderError('Erreur de connexion au serveur.');
    } finally {
      this.isLoading = false;
    }
  },

  renderLoadingHeader() {
    const refEl = document.getElementById('overview-passage-ref');
    const bInfo = (typeof getBookInfo === 'function') ? getBookInfo(this.currentBook) : { name: this.currentBook };
    const bookName = bInfo.name || this.currentBook;
    if (refEl) {
      refEl.innerHTML = `<span class="overview-loading-dot"></span> ${this.escapeHtml(bookName)} ${this.currentChapter}:${this.currentVerse}`;
    }
  },

  renderError(msg) {
    const refEl = document.getElementById('overview-passage-ref');
    const bInfo = (typeof getBookInfo === 'function') ? getBookInfo(this.currentBook) : { name: this.currentBook };
    const bookName = bInfo.name || this.currentBook;
    if (refEl) {
      refEl.textContent = `${bookName} ${this.currentChapter}:${this.currentVerse}`;
    }
    const root = document.getElementById('overview-cards-container');
    if (root) {
      root.innerHTML = `
        <div class="overview-empty-box" style="padding: 24px 12px; text-align: center; color: var(--text-muted);">
          <span class="empty-icon" style="display: block; margin-bottom: 8px; opacity: 0.6;">${this.icons.compass}</span>
          <p style="font-size: 12px; margin: 0 0 10px 0;">${this.escapeHtml(msg)}</p>
          <button class="overview-link-btn" onclick="PassageOverviewDrawer.load(null, null, null, null, true)" style="margin: 0 auto;">
            <span>Réessayer</span>
          </button>
        </div>
      `;
    }
  },

  /**
   * Nettoie et formate les extraits textuels en rendant le Markdown élégamment (gras, italique, etc.)
   */
  formatMarkdownExcerpt(text) {
    if (!text) return '';
    let cleaned = text.replace(/<[^>]+>/g, ' ');
    cleaned = cleaned.replace(/^#+\s+/gm, '');
    cleaned = cleaned.replace(/^[0-9IVXLCDM]+\.\s+/gm, '');
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    if (cleaned.length > 175) {
      cleaned = cleaned.slice(0, 172) + '...';
    }
    // Échappement HTML sécurisé
    let safe = this.escapeHtml(cleaned);
    // Rendu du markdown inline
    safe = safe.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    safe = safe.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    safe = safe.replace(/_([^_]+)_/g, '<em>$1</em>');
    safe = safe.replace(/`([^`]+)`/g, '<code style="font-size: 10px; padding: 1px 4px; border-radius: 3px; background: var(--bg-hover);">$1</code>');
    return safe;
  },

  /**
   * Initialise l'élément popover flottant dans le DOM
   */
  initPopover() {
    let popover = document.getElementById('overview-item-popover');
    if (!popover) {
      popover = document.createElement('div');
      popover.id = 'overview-item-popover';
      popover.className = 'overview-item-popover hidden';
      document.body.appendChild(popover);
    }
    this.popoverEl = popover;
  },

  theologySnippetCache: {},
  currentPopoverItem: null,

  /**
   * Affiche l'infobulle flottante au survol d'une ressource (avec image / couverture)
   */
  async showPopover(itemEl) {
    if (!this.popoverEl) this.initPopover();
    this.currentPopoverItem = itemEl;

    const cat = itemEl.dataset.ttCategory || 'Ressource';
    const author = itemEl.dataset.ttAuthor || '';
    const title = itemEl.dataset.ttTitle || '';
    let excerpt = itemEl.dataset.ttExcerpt || '';
    const badge = itemEl.dataset.ttBadge || '';
    const logoUrl = itemEl.dataset.ttLogo || '';
    const imgUrl = itemEl.dataset.ttImage || '';
    const action = itemEl.dataset.action || '';
    const bName = itemEl.dataset.bookName || '';
    const chId = itemEl.dataset.chapterId || '';

    if (!excerpt && !author && !title && !bName) return;

    let catIcon = this.icons.commentary;
    if (cat === 'Article') catIcon = this.icons.article;
    else if (cat === 'Livre') catIcon = this.icons.book;
    else if (cat === 'Note') catIcon = this.icons.note;
    else if (cat === 'Lieu') catIcon = this.icons.map;

    let coverHtml = '';
    let bannerHtml = '';

    if (cat === 'Article') {
      if (imgUrl) {
        bannerHtml = `<div class="popover-landscape-banner"><img src="${imgUrl}" class="popover-landscape-img" alt=""></div>`;
      }
    } else if (cat === 'Note') {
      coverHtml = '';
    } else {
      coverHtml = imgUrl
        ? `<div class="popover-cover-wrap"><img src="${imgUrl}" class="popover-cover-img" alt=""></div>`
        : `<div class="popover-cover-wrap"><div class="popover-cover-fallback ${cat.toLowerCase()}">${catIcon}</div></div>`;
    }

    const isTheology = action === 'open-theology-chapter' && bName;
    const cacheKey = `${bName}_${chId}_${this.currentBook}_${this.currentChapter}_${this.currentVerse}`;
    let isFetchingSnippet = false;

    if (isTheology) {
      if (this.theologySnippetCache[cacheKey]) {
        excerpt = this.theologySnippetCache[cacheKey];
      } else if (!excerpt) {
        isFetchingSnippet = true;
      }
    }

    const bodyContentHtml = isFetchingSnippet
      ? `<div class="popover-body-loading" style="display:flex; align-items:center; gap:8px; color:#c084fc; font-size:12px; padding:12px 0;">
           <span class="synth-spinner" style="width:13px; height:13px; border-width:2px; border-top-color:#c084fc;"></span>
           <span>Recherche du passage consacré en cours...</span>
         </div>`
      : (excerpt ? `<div class="popover-body">${excerpt}</div>` : '');

    this.popoverEl.innerHTML = `
      <div class="popover-inner">
        ${bannerHtml}
        <div class="popover-header ${!coverHtml ? 'no-cover' : ''}">
          ${coverHtml}
          <div class="popover-header-content">
            <div class="popover-meta-row">
              <span class="popover-cat-badge">${catIcon} <span>${this.escapeHtml(cat)}</span></span>
              ${badge ? `
                <span class="popover-source-badge ${logoUrl ? 'has-logo' : ''}">
                  ${logoUrl ? `<img src="${logoUrl}" class="popover-source-logo" alt="">` : ''}
                  <span>${this.escapeHtml(badge)}</span>
                </span>` : ''}
            </div>
            <div class="popover-title-row">
              <div class="popover-main-title">${this.escapeHtml(author)}</div>
              ${title ? `<div class="popover-sub-title">${this.escapeHtml(title)}</div>` : ''}
            </div>
          </div>
        </div>
        <div class="popover-body-container">
          ${bodyContentHtml}
        </div>
        <div class="popover-footer">
          <span class="popover-hint">${this.icons.arrowRight} <span>Cliquer pour ouvrir dans l'onglet</span></span>
        </div>
      </div>
    `;

    const rect = itemEl.getBoundingClientRect();
    const popoverWidth = 380;
    const estPopoverHeight = 220;

    // 1. Calcul Horizontal : centré sur l'élément ou sous le curseur, avec marge de sécurité
    let left = rect.left + (rect.width - popoverWidth) / 2;
    if (left + popoverWidth > window.innerWidth - 16) {
      left = window.innerWidth - popoverWidth - 16;
    }
    if (left < 16) {
      left = 16;
    }

    // 2. Calcul Vertical adaptatif : par défaut dessous l'élément, bascule au-dessus si proche du bas
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    let top = rect.bottom + 8;

    if (spaceBelow < (estPopoverHeight + 20) && spaceAbove > spaceBelow) {
      // Position au-dessus
      top = Math.max(10, rect.top - estPopoverHeight - 8);
      this.popoverEl.classList.add('popover-top');
      this.popoverEl.classList.remove('popover-bottom');
    } else {
      // Position au-dessous
      top = Math.min(window.innerHeight - estPopoverHeight - 10, rect.bottom + 8);
      this.popoverEl.classList.add('popover-bottom');
      this.popoverEl.classList.remove('popover-top');
    }

    this.popoverEl.style.left = `${Math.round(left)}px`;
    this.popoverEl.style.top = `${Math.round(top)}px`;
    this.popoverEl.classList.remove('hidden');
    void this.popoverEl.offsetWidth; // Reflow
    this.popoverEl.classList.add('visible');

    // Chargement asynchrone si extrait en attente
    if (isFetchingSnippet) {
      try {
        const res = await API.call(
          'get_theology_chapter_snippet',
          bName,
          chId,
          this.currentBook || 'GEN',
          this.currentChapter || 1,
          this.currentVerse || 1
        );
        if (res && res.success && res.snippet) {
          const formatted = this.formatMarkdownExcerpt(res.snippet);
          this.theologySnippetCache[cacheKey] = formatted;
          itemEl.dataset.ttExcerpt = formatted;

          if (this.currentPopoverItem === itemEl && this.popoverEl.classList.contains('visible')) {
            const bodyContainer = this.popoverEl.querySelector('.popover-body-container');
            if (bodyContainer) {
              bodyContainer.innerHTML = `<div class="popover-body" style="animation:fadeIn 0.25s ease;">${formatted}</div>`;
            }
          }
        }
      } catch (err) {
        console.warn('[PassageOverviewDrawer] Erreur chargement snippet théologie:', err);
      }
    }
  },

  /**
   * Masque l'infobulle flottante
   */
  hidePopover() {
    this.currentPopoverItem = null;
    if (this.popoverEl) {
      this.popoverEl.classList.remove('visible');
      setTimeout(() => {
        if (this.popoverEl && !this.popoverEl.classList.contains('visible')) {
          this.popoverEl.classList.add('hidden');
        }
      }, 150);
    }
  },


  /**
   * Rendu complet des cartes et compteurs en 2 colonnes (Studio Dashboard).
   */
  render(data) {
    // 1. En-tête : Référence et Péricope
    const refEl = document.getElementById('overview-passage-ref');
    const pericopeEl = document.getElementById('overview-pericope-title');
    
    if (refEl) {
      refEl.textContent = data.reference || `${data.french_book} ${data.chapter}:${data.verse}`;
    }
    if (pericopeEl) {
      const pTitle = data.pericope?.title || '';
      if (pTitle) {
        pericopeEl.textContent = pTitle;
        pericopeEl.style.display = 'block';
      } else {
        pericopeEl.style.display = 'none';
      }
    }

    // 2. Rendu de la barre des pastilles rapides (Chips minimalistes)
    this.renderChipsBar(data.stats || {});

    // 3. Rendu du conteneur des cartes
    const root = document.getElementById('overview-cards-container');
    if (!root) return;

    const commCount = (data.commentaries || []).length;
    const artCount = (data.articles || []).length;
    const theoCount = (data.theology_books || []).length;
    const notesCount = ((data.user_notes || []).length) + ((data.user_highlights || []).length);
    const mapsCount = (data.maps || []).length;
    const bpCount = ((data.bibleproject?.current_videos || []).length) + ((data.bibleproject?.current_posters || []).length);

    const isSecondaryWindow = !!document.getElementById('comm-win-titlebar');

    // =========================================================================
    // CAS 1 : VOLET LATÉRAL CLASSIQUE (PAGE BIBLE) -> 1 COLONNE VERTICALE PURE
    // =========================================================================
    if (!isSecondaryWindow) {
      let activeHtml = '';
      let emptyHtml = '';
      let emptyCount = 0;

      const appendSafe = (renderFn, count) => {
        try {
          const html = renderFn.call(this, data);
          if (count > 0) {
            activeHtml += html;
          } else {
            emptyHtml += html;
            emptyCount++;
          }
        } catch (err) {
          console.warn('[PassageOverviewDrawer] Erreur rendu section:', err);
        }
      };

      // A. Section BibleProject (Vidéos & Posters)
      appendSafe(this.renderBibleProjectSection, bpCount);

      // B. Section Commentaires Exégétiques
      appendSafe(this.renderCommentariesSection, commCount);

      // C. Section Articles & Revues Théologiques
      appendSafe(this.renderArticlesSection, artCount);

      // D. Section Livres de Théologie & Bibliothèque
      appendSafe(this.renderTheologySection, theoCount);

      // E. Section Vos Notes & Surlignages Personnels
      appendSafe(this.renderNotesSection, notesCount);

      // F. Section Géographie & Lieux Bibliques
      appendSafe(this.renderMapsSection, mapsCount);

      let finalHtml = activeHtml;

      if (emptyCount > 0) {
        const isShowEmpty = this.showEmptySections || false;
        finalHtml += `
          <div class="overview-empty-sections-wrap">
            <button type="button" class="btn-toggle-empty-sections ${isShowEmpty ? 'expanded' : ''}" data-action="toggle-empty-sections">
              <span class="empty-sec-chevron">${this.icons.chevronDown}</span>
              <span>${emptyCount} autre(s) section(s) sans ressource</span>
            </button>
            <div class="empty-sections-container ${isShowEmpty ? '' : 'hidden'}">
              ${emptyHtml}
            </div>
          </div>
        `;
      }

      // G. Section Actions Rapides & IA
      finalHtml += this.renderQuickActionsSection(data);
      root.innerHTML = finalHtml;
      this.attachCardEventListeners(root, data);
      return;
    }

    // =========================================================================
    // CAS 2 : FENÊTRE SECONDAIRE DÉPORTÉE -> GRILLE DASHBOARD (2 COLONNES)
    // =========================================================================
    const leftActiveHtml = [];
    const leftEmptyHtml = [];
    if (bpCount > 0) leftActiveHtml.push(this.renderBibleProjectSection(data));
    else leftEmptyHtml.push(this.renderBibleProjectSection(data));

    if (notesCount > 0) leftActiveHtml.push(this.renderNotesSection(data));
    else leftEmptyHtml.push(this.renderNotesSection(data));

    if (mapsCount > 0) leftActiveHtml.push(this.renderMapsSection(data));
    else leftEmptyHtml.push(this.renderMapsSection(data));

    const rightActiveHtml = [];
    const rightEmptyHtml = [];
    if (commCount > 0) rightActiveHtml.push(this.renderCommentariesSection(data));
    else rightEmptyHtml.push(this.renderCommentariesSection(data));

    if (theoCount > 0) rightActiveHtml.push(this.renderTheologySection(data));
    else rightEmptyHtml.push(this.renderTheologySection(data));

    if (artCount > 0) rightActiveHtml.push(this.renderArticlesSection(data));
    else rightEmptyHtml.push(this.renderArticlesSection(data));

    const totalActive = leftActiveHtml.length + rightActiveHtml.length;
    const totalEmpty = leftEmptyHtml.length + rightEmptyHtml.length;

    let finalHtml = '';
    if (totalActive > 0) {
      finalHtml += `
        <div class="overview-dashboard-grid">
          <div class="overview-col-left">
            ${leftActiveHtml.join('')}
          </div>
          <div class="overview-col-right">
            ${rightActiveHtml.join('')}
          </div>
        </div>
      `;
    }

    if (totalEmpty > 0) {
      const isShowEmpty = this.showEmptySections || false;
      finalHtml += `
        <div class="overview-empty-sections-wrap">
          <button type="button" class="btn-toggle-empty-sections ${isShowEmpty ? 'expanded' : ''}" data-action="toggle-empty-sections">
            <span class="empty-sec-chevron">${this.icons.chevronDown}</span>
            <span>${totalEmpty} autre(s) section(s) sans ressource</span>
          </button>
          <div class="empty-sections-container ${isShowEmpty ? '' : 'hidden'}">
            <div class="overview-dashboard-grid">
              <div class="overview-col-left">${leftEmptyHtml.join('')}</div>
              <div class="overview-col-right">${rightEmptyHtml.join('')}</div>
            </div>
          </div>
        </div>
      `;
    }

    // G. Section Actions Rapides & IA
    finalHtml += this.renderQuickActionsSection(data);

    root.innerHTML = finalHtml;
    this.attachCardEventListeners(root, data);
  },

  /**
   * Rendu des Pastilles / Chips ultra-minimalistes (Icône SVG + Compteur discret)
   */
  renderChipsBar(stats) {
    const chipsBar = document.getElementById('overview-chips-bar');
    if (!chipsBar) return;

    const commCount = stats.commentaries_count || 0;
    const artCount = stats.articles_count || 0;
    const theoCount = stats.theology_count || 0;
    const notesCount = (stats.notes_count || 0) + (stats.highlights_count || 0);
    const mapsCount = stats.maps_count || 0;
    const bpCount = (stats.bibleproject_videos_count || 0) + (stats.bibleproject_posters_count || 0);

    chipsBar.innerHTML = `
      <button class="overview-chip ${bpCount > 0 ? 'has-items' : 'is-empty'}" data-scroll-sec="sec-bibleproject" title="${bpCount} panorama(s) vidéo et poster(s) BibleProject">
        <span class="chip-svg">${this.icons.video}</span>
        <span class="chip-count">${bpCount}</span>
      </button>

      <button class="overview-chip ${commCount > 0 ? 'has-items' : 'is-empty'}" data-scroll-sec="sec-commentaries" title="${commCount} commentaire(s) exégétique(s)">
        <span class="chip-svg">${this.icons.commentary}</span>
        <span class="chip-count">${commCount}</span>
      </button>

      <button class="overview-chip ${artCount > 0 ? 'has-items' : 'is-empty'}" data-scroll-sec="sec-articles" title="${artCount} article(s) de théologie">
        <span class="chip-svg">${this.icons.article}</span>
        <span class="chip-count">${artCount}</span>
      </button>

      <button class="overview-chip ${theoCount > 0 ? 'has-items' : 'is-empty'}" data-scroll-sec="sec-theology" title="${theoCount} livre(s) de théologie">
        <span class="chip-svg">${this.icons.book}</span>
        <span class="chip-count">${theoCount}</span>
      </button>

      <button class="overview-chip ${notesCount > 0 ? 'has-items' : 'is-empty'}" data-scroll-sec="sec-notes" title="${notesCount} note(s) et surlignage(s)">
        <span class="chip-svg">${this.icons.note}</span>
        <span class="chip-count">${notesCount}</span>
      </button>

      <button class="overview-chip ${mapsCount > 0 ? 'has-items' : 'is-empty'}" data-scroll-sec="sec-maps" title="${mapsCount} lieu(x) biblique(s)">
        <span class="chip-svg">${this.icons.map}</span>
        <span class="chip-count">${mapsCount}</span>
      </button>
    `;

    chipsBar.querySelectorAll('.overview-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const secId = btn.dataset.scrollSec;
        let targetSec = document.getElementById(secId);
        
        // Si la section est dans le conteneur masqué des sections vides, l'afficher
        if (targetSec && targetSec.closest('.empty-sections-container.hidden')) {
          this.showEmptySections = true;
          document.querySelector('.btn-toggle-empty-sections')?.classList.add('expanded');
          document.querySelector('.empty-sections-container')?.classList.remove('hidden');
        }

        if (targetSec) {
          targetSec.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          targetSec.classList.add('highlight-flash');
          setTimeout(() => targetSec.classList.remove('highlight-flash'), 1200);
        }
      });
    });
  },

  /**
   * Section BibleProject (Vidéos, Panoramas & Posters HD)
   */
  renderBibleProjectSection(data) {
    const bp = data.bibleproject || {};
    const videos = bp.current_videos || bp.all_videos || [];
    const posters = bp.current_posters || bp.all_posters || [];
    const isCollapsed = this.collapsedSections['sec-bibleproject'] || false;
    const totalMedia = videos.length + posters.length;

    let bodyHtml = '';
    if (totalMedia === 0) {
      bodyHtml = `
        <div class="overview-empty-hint">
          <span>Aucun panorama vidéo ou poster pour ce chapitre.</span>
        </div>
      `;
    } else {
      bodyHtml = `<div class="overview-bp-preview-flow">`;

      // 1. Vidéos du livre / chapitre
      videos.forEach((v) => {
        const thumbUrl = v.thumbnail || `https://i.ytimg.com/vi/${v.yt_id}/hqdefault.jpg`;
        bodyHtml += `
          <div class="overview-bp-video-item"
               data-action="open-bp-video"
               data-yt-id="${v.yt_id}"
               data-title="${this.escapeHtml(v.title)}"
               data-desc="${this.escapeHtml(v.description || '')}"
               data-tt-category="BibleProject"
               data-tt-title="${this.escapeHtml(v.title)}"
               data-tt-image="${thumbUrl}"
               data-tt-excerpt="${this.escapeHtml(v.description || '')}">
            <div class="bp-preview-thumb">
              <img src="${thumbUrl}" alt="${this.escapeHtml(v.title)}" loading="lazy">
              <div class="bp-preview-play-icon">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              </div>
              <span class="bp-preview-badge">${v.duration || 'Panorama'}</span>
            </div>
            <div class="bp-preview-info">
              <span class="bp-preview-title">${this.escapeHtml(v.title)}</span>
              <span class="bp-preview-desc">${this.escapeHtml(v.description || '')}</span>
            </div>
          </div>
        `;
      });

      // 2. Posters / Affiches du livre / chapitre
      posters.forEach((p) => {
        bodyHtml += `
          <div class="overview-bp-poster-item"
               data-action="open-bp-poster"
               data-image-url="${p.image_url}"
               data-pdf-url="${p.pdf_url}"
               data-title="${this.escapeHtml(p.title)}"
               data-tt-category="BibleProject"
               data-tt-title="${this.escapeHtml(p.title)}"
               data-tt-image="${p.image_url}"
               data-tt-excerpt="Structure littéraire et schéma narratif haute définition.">
            <div class="bp-poster-mini-thumb loading">
              <img src="${p.image_url}" alt="${this.escapeHtml(p.title)}" loading="lazy" onload="this.classList.add('loaded'); this.parentElement.classList.remove('loading');" onerror="this.classList.add('loaded'); this.parentElement.classList.remove('loading');">
              <div class="bp-poster-zoom-mini">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </div>
            </div>

            <div class="bp-poster-mini-info">
              <span class="bp-poster-mini-title">${this.escapeHtml(p.title)}</span>
              <span class="bp-poster-mini-hint">Cliquer pour zoomer en plein écran</span>
            </div>
          </div>
        `;
      });

      bodyHtml += `
        <div style="padding: 4px 2px 2px 2px;">
          <button type="button" class="overview-link-btn" data-action="open-media-tab" style="width: 100%; justify-content: center;">
            <span>Espace BibleProject (${videos.length} vidéo(s), ${posters.length} affiche(s))</span>
            ${this.icons.arrowRight}
          </button>
        </div>
      `;

      bodyHtml += `</div>`;

    }

    return `
      <section class="overview-section-card ${isCollapsed ? 'collapsed' : ''}" id="sec-bibleproject">
        <header class="sec-header" data-toggle-sec="sec-bibleproject">
          <div class="sec-header-left">
            <span class="sec-icon sec-icon-purple">${this.icons.video}</span>
            <span class="sec-title">BibleProject (Panoramas &amp; Posters)</span>
            <span class="sec-badge ${totalMedia > 0 ? 'badge-active' : ''}">${totalMedia}</span>
          </div>
          <button class="sec-chevron" title="Plier / Déplier">${this.icons.chevronDown}</button>
        </header>
        <div class="sec-body">
          ${bodyHtml}
        </div>
      </section>
    `;
  },


  /**
   * Section Commentaires Exégétiques (Ultra-compacte + Infobulle au survol)
   */
  renderCommentariesSection(data) {
    const list = data.commentaries || [];
    const isCollapsed = this.collapsedSections['sec-commentaries'] || false;
    const totalChap = data.stats?.chapter_commentaries_count || list.length;

    let bodyHtml = '';
    if (list.length === 0) {
      bodyHtml = `
        <div class="overview-empty-hint">
          <span>Aucun commentaire direct sur ce verset précis.</span>
          ${totalChap > 0 ? `<button class="overview-link-btn" data-action="open-commentaries-tab">Voir les ${totalChap} commentaires du chapitre ${data.chapter} ${this.icons.arrowRight}</button>` : ''}
        </div>
      `;
    } else {
      bodyHtml = `<div class="overview-clean-list">`;
      
      const renderItem = (c, idx) => {
        const author = c.author || c.source_name || 'Commentaire';
        const title = c.title && c.title !== author ? c.title : (c.source_name || '');
        const excerptHtml = this.formatMarkdownExcerpt(c.excerpt);

        return `
          <div class="overview-clean-item"
               data-action="select-commentary"
               data-author="${this.escapeHtml(author)}"
               data-source-id="${this.escapeHtml(c.source_id)}"
               data-index="${idx}"
               data-tt-category="Commentaire"
               data-tt-author="${this.escapeHtml(author)}"
               data-tt-title="${this.escapeHtml(title)}"
               data-tt-image="${this.escapeHtml(c.cover_url || '')}"
               data-tt-excerpt="${this.escapeHtml(excerptHtml)}">
            <div class="clean-item-header">
              <div class="clean-item-title-group">
                <span class="clean-author-name">${this.escapeHtml(author)}</span>
                ${title ? `<span class="clean-source-title">· ${this.escapeHtml(title)}</span>` : ''}
              </div>
              <span class="clean-item-arrow">${this.icons.arrowRight}</span>
            </div>
          </div>
        `;
      };

      list.forEach((c, idx) => {
        bodyHtml += renderItem(c, idx);
      });

      bodyHtml += `</div>`;
    }

    return `
      <section class="overview-section-card ${isCollapsed ? 'collapsed' : ''}" id="sec-commentaries">
        <header class="sec-header" data-toggle-sec="sec-commentaries">
          <div class="sec-header-left">
            <span class="sec-icon sec-icon-blue">${this.icons.commentary}</span>
            <span class="sec-title">Commentaires exégétiques</span>
            <span class="sec-badge ${list.length > 0 ? 'badge-active' : ''}">${list.length}</span>
          </div>
          <button class="sec-chevron" title="Plier / Déplier">${this.icons.chevronDown}</button>
        </header>
        <div class="sec-body">${bodyHtml}</div>
      </section>
    `;
  },

  /**
   * Retourne le chemin du logo officiel d'une source de blog / revue
   */
  getSourceLogo(sourceId, sourceName) {
    const s = (String(sourceId || '') + ' ' + String(sourceName || '')).toLowerCase();
    if (s.includes('tpsg') || s.includes('toutpoursagloire') || s.includes('tout pour sa gloire')) {
      return 'img/sources/tpsg.svg';
    }
    return null;
  },

  /**
   * Section Articles de blog (Ultra-compacte + Infobulle au survol)
   */
  renderArticlesSection(data) {
    const list = data.articles || [];
    const isCollapsed = this.collapsedSections['sec-articles'] || false;

    let bodyHtml = '';
    if (list.length === 0) {
      bodyHtml = `
        <div class="overview-empty-hint">
          <span>Aucun article de blog contemporain lié à ce passage.</span>
          <button class="overview-link-btn" data-action="open-articles-tab">Explorer les revues théologiques ${this.icons.arrowRight}</button>
        </div>
      `;
    } else {
      bodyHtml = `<div class="overview-clean-list">`;
      list.forEach((art) => {
        const src = art.source_name || 'Revue';
        const title = art.title || 'Article';
        const summaryHtml = this.formatMarkdownExcerpt(art.lead_summary);
        const logoUrl = this.getSourceLogo(art.source_id, src);
        const logoHtml = logoUrl ? `<img src="${logoUrl}" class="source-tag-logo" alt="${this.escapeHtml(src)}">` : '';
        const tagClass = logoUrl ? 'clean-source-tag has-logo' : 'clean-source-tag is-generic';

        bodyHtml += `
          <div class="overview-clean-item overview-article-item"
               data-action="open-article"
               data-article-id="${this.escapeHtml(art.id)}"
               data-tt-category="Article"
               data-tt-author="${this.escapeHtml(title)}"
               data-tt-title="${this.escapeHtml(art.author ? 'Par ' + art.author : '')}"
               data-tt-badge="${this.escapeHtml(src)}"
               data-tt-logo="${logoUrl || ''}"
               data-tt-image="${this.escapeHtml(art.image_url || '')}"
               data-tt-excerpt="${this.escapeHtml(summaryHtml)}">
            <div class="clean-article-row">
              <div class="clean-article-content">
                <div class="clean-article-top">
                  <span class="${tagClass}">
                    ${logoHtml}
                    <span class="source-tag-text">${this.escapeHtml(src)}</span>
                  </span>
                  ${art.author ? `<span class="clean-article-author">Par ${this.escapeHtml(art.author)}</span>` : ''}
                </div>
                <div class="clean-article-title">${this.escapeHtml(title)}</div>
              </div>
              <span class="clean-item-arrow">${this.icons.arrowRight}</span>
            </div>
          </div>
        `;
      });
      bodyHtml += `</div>`;
    }


    return `
      <section class="overview-section-card ${isCollapsed ? 'collapsed' : ''}" id="sec-articles">
        <header class="sec-header" data-toggle-sec="sec-articles">
          <div class="sec-header-left">
            <span class="sec-icon sec-icon-purple">${this.icons.article}</span>
            <span class="sec-title">Articles & Revues</span>
            <span class="sec-badge ${list.length > 0 ? 'badge-active' : ''}">${list.length}</span>
          </div>
          <button class="sec-chevron" title="Plier / Déplier">${this.icons.chevronDown}</button>
        </header>
        <div class="sec-body">${bodyHtml}</div>
      </section>
    `;
  },

  /**
   * Section Livres de Théologie & Bibliothèque (Ultra-compacte + Infobulle au survol)
   */
  renderTheologySection(data) {
    const list = data.theology_books || [];
    const isCollapsed = this.collapsedSections['sec-theology'] || false;

    let bodyHtml = '';
    if (list.length === 0) {
      bodyHtml = `
        <div class="overview-empty-hint">
          <span>Aucun manuel de théologie directement associé à ce livre.</span>
          <button class="overview-link-btn" data-action="open-library-tab">Ouvrir la bibliothèque ${this.icons.arrowRight}</button>
        </div>
      `;
    } else {
      bodyHtml = `<div class="overview-clean-list">`;
      list.forEach((b) => {
        const bTitle = b.book_title || b.book_name || 'Ouvrage';
        const chTitle = b.chapter_title || `Chapitre ${b.chapter_id}`;
        const snippetHtml = b.snippet ? this.formatMarkdownExcerpt(b.snippet) : '';

        bodyHtml += `
          <div class="overview-clean-item"
               data-action="open-theology-chapter"
               data-book-name="${this.escapeHtml(b.book_name)}"
               data-chapter-id="${b.chapter_id}"
               data-tt-category="Livre"
               data-tt-author="${this.escapeHtml(bTitle)}"
               data-tt-title="${this.escapeHtml(chTitle)}"
               data-tt-image="${this.escapeHtml(b.cover_url || '')}"
               data-tt-excerpt="${this.escapeHtml(snippetHtml)}">
            <div class="clean-item-header">
              <div class="clean-item-title-group">
                <span class="clean-author-name">${this.escapeHtml(bTitle)}</span>
                <span class="clean-source-title">· ${this.escapeHtml(chTitle)}</span>
              </div>
              <span class="clean-item-arrow">${this.icons.arrowRight}</span>
            </div>
          </div>
        `;
      });
      bodyHtml += `</div>`;
    }

    return `
      <section class="overview-section-card ${isCollapsed ? 'collapsed' : ''}" id="sec-theology">
        <header class="sec-header" data-toggle-sec="sec-theology">
          <div class="sec-header-left">
            <span class="sec-icon sec-icon-amber">${this.icons.book}</span>
            <span class="sec-title">Livres de théologie</span>
            <span class="sec-badge ${list.length > 0 ? 'badge-active' : ''}">${list.length}</span>
          </div>
          <button class="sec-chevron" title="Plier / Déplier">${this.icons.chevronDown}</button>
        </header>
        <div class="sec-body">${bodyHtml}</div>
      </section>
    `;
  },

  /**
   * Section Notes & Surlignages (Ultra-compacte + Infobulle au survol)
   */
  renderNotesSection(data) {
    const notes = data.user_notes || [];
    const highlights = data.user_highlights || [];
    const total = notes.length + highlights.length;
    const isCollapsed = this.collapsedSections['sec-notes'] || false;

    let bodyHtml = '';
    if (total === 0) {
      bodyHtml = `
        <div class="overview-empty-hint">
          <span>Aucune note personnelle sur ce verset.</span>
          <button class="overview-add-btn" data-action="add-quick-note">
            ${this.icons.plus} <span>Ajouter une note</span>
          </button>
        </div>
      `;
    } else {
      bodyHtml = `<div class="overview-clean-list">`;
      
      notes.forEach((n) => {
        const snippetHtml = this.formatMarkdownExcerpt(n.snippet);
        bodyHtml += `
          <div class="overview-clean-item"
               data-action="open-note"
               data-note-id="${this.escapeHtml(n.id)}"
               data-tt-category="Note"
               data-tt-author="${this.escapeHtml(n.title || 'Note')}"
               data-tt-excerpt="${this.escapeHtml(snippetHtml)}">
            <div class="clean-item-header">
              <span class="clean-author-name">${this.escapeHtml(n.title || 'Note')}</span>
              <span class="clean-item-arrow">${this.icons.arrowRight}</span>
            </div>
          </div>
        `;
      });

      if (highlights.length > 0) {
        bodyHtml += `
          <div class="highlights-summary-box">
            <span class="hl-summary-label">${highlights.length} surlignage(s) actif(s)</span>
          </div>
        `;
      }

      bodyHtml += `
        <div class="overview-footer-action">
          <button class="overview-add-btn" data-action="add-quick-note">
            ${this.icons.plus} <span>Nouvelle note</span>
          </button>
        </div>
      `;

      bodyHtml += `</div>`;
    }

    return `
      <section class="overview-section-card ${isCollapsed ? 'collapsed' : ''}" id="sec-notes">
        <header class="sec-header" data-toggle-sec="sec-notes">
          <div class="sec-header-left">
            <span class="sec-icon sec-icon-green">${this.icons.note}</span>
            <span class="sec-title">Notes & Surlignages</span>
            <span class="sec-badge ${total > 0 ? 'badge-active' : ''}">${total}</span>
          </div>
          <button class="sec-chevron" title="Plier / Déplier">${this.icons.chevronDown}</button>
        </header>
        <div class="sec-body">${bodyHtml}</div>
      </section>
    `;
  },

  /**
   * Section Géographie & Lieux Bibliques
   */
  renderMapsSection(data) {
    const list = data.maps || [];
    const isCollapsed = this.collapsedSections['sec-maps'] || false;

    let bodyHtml = '';
    if (list.length === 0) {
      bodyHtml = `
        <div class="overview-empty-hint">
          <span>Aucun lieu géographique répertorié dans ce verset.</span>
          <button class="overview-link-btn" data-action="open-maps-tab">Ouvrir l'Atlas biblique ${this.icons.arrowRight}</button>
        </div>
      `;
    } else {
      bodyHtml = `<div class="overview-clean-list">`;
      list.forEach((p) => {
        const descHtml = this.formatMarkdownExcerpt(p.description);
        bodyHtml += `
          <div class="overview-clean-item"
               data-action="focus-map-place"
               data-place-id="${this.escapeHtml(p.id)}"
               data-tt-category="Lieu"
               data-tt-author="${this.escapeHtml(p.name)}"
               data-tt-title="${this.escapeHtml(p.type || 'Lieu biblique')}"
               data-tt-excerpt="${this.escapeHtml(descHtml)}">
            <div class="clean-item-header">
              <div class="clean-item-title-group">
                <span class="clean-author-name">${this.escapeHtml(p.name)}</span>
                <span class="clean-source-tag is-generic">${this.escapeHtml(p.type || 'Lieu')}</span>
              </div>
              <span class="clean-item-arrow">${this.icons.arrowRight}</span>
            </div>
          </div>
        `;
      });
      bodyHtml += `</div>`;
    }

    return `
      <section class="overview-section-card ${isCollapsed ? 'collapsed' : ''}" id="sec-maps">
        <header class="sec-header" data-toggle-sec="sec-maps">
          <div class="sec-header-left">
            <span class="sec-icon sec-icon-red">${this.icons.map}</span>
            <span class="sec-title">Géographie & Lieux</span>
            <span class="sec-badge ${list.length > 0 ? 'badge-active' : ''}">${list.length}</span>
          </div>
          <button class="sec-chevron" title="Plier / Déplier">${this.icons.chevronDown}</button>
        </header>
        <div class="sec-body">${bodyHtml}</div>
      </section>
    `;
  },

  /**
   * Section Actions Rapides & IA (Épurée en barre fine)
   */
  renderQuickActionsSection(data) {
    return `
      <div class="overview-quick-actions-bar">
        <button class="btn-action-synth" id="btn-card-launch-synth" title="Synthèse IA comparative des commentaires">
          <span class="action-btn-svg">${this.icons.sparkle}</span>
          <span>Synthèse IA</span>
        </button>

        <button class="btn-action-study" id="btn-card-launch-study" title="Ouvrir la vue complète d'étude de passage">
          <span class="action-btn-svg">${this.icons.study}</span>
          <span>Étude complète</span>
        </button>
      </div>
    `;
  },

  /**
   * Attache tous les événements interactifs (clic -> bascule sans quitter la Bible)
   */
  attachCardEventListeners(container, data) {
    // Écouteurs de survol Popover sur chaque élément de ressource
    let hoverTimer = null;
    container.querySelectorAll('.overview-clean-item, .overview-bp-video-item, .overview-bp-poster-item').forEach(item => {
      item.addEventListener('mouseenter', () => {
        clearTimeout(hoverTimer);
        hoverTimer = setTimeout(() => {
          this.showPopover(item);
        }, 90);
      });

      item.addEventListener('mouseleave', () => {
        clearTimeout(hoverTimer);
        this.hidePopover();
      });

      item.addEventListener('click', () => {
        clearTimeout(hoverTimer);
        this.hidePopover();
      });
    });

    // 0. Toggle pour déplier les sections vides
    container.querySelectorAll('[data-action="toggle-empty-sections"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.showEmptySections = !this.showEmptySections;
        const emptyBox = container.querySelector('.empty-sections-container');
        if (emptyBox) {
          emptyBox.classList.toggle('hidden', !this.showEmptySections);
          btn.classList.toggle('expanded', this.showEmptySections);
        }
      });
    });

    // 0b. Toggle pour afficher les commentaires au-delà du top 3
    container.querySelectorAll('[data-action="toggle-more-comms"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const extraEl = container.querySelector('#extra-comms-list');
        if (extraEl) {
          extraEl.classList.toggle('hidden');
          const isHidden = extraEl.classList.contains('hidden');
          btn.classList.toggle('expanded', !isHidden);
          const span = btn.querySelector('span');
          if (span) {
            span.textContent = isHidden ? 'Afficher les autres commentaires' : 'Masquer les commentaires additionnels';
          }
        }
      });
    });

    // 1. Pliage / Dépliage des accordéons
    container.querySelectorAll('.sec-header').forEach(header => {
      header.addEventListener('click', (e) => {
        e.stopPropagation();
        const secCard = header.closest('.overview-section-card');
        const secId = header.dataset.toggleSec;
        if (secCard && secId) {
          secCard.classList.toggle('collapsed');
          this.collapsedSections[secId] = secCard.classList.contains('collapsed');
          try {
            localStorage.setItem('bible_overview_collapsed_sections', JSON.stringify(this.collapsedSections));
          } catch (e) {}
        }
      });
    });

    // 2. Clic sur un commentaire -> Bascule sur l'onglet Commentaires avec cet auteur
    container.querySelectorAll('[data-action="select-commentary"]').forEach(card => {
      card.addEventListener('click', () => {
        const author = card.dataset.author;
        const idx = parseInt(card.dataset.index) || 0;

        if (typeof CommentaryWindow !== 'undefined' && typeof CommentaryWindow.selectCommentarySource === 'function') {
          if (author) CommentaryWindow.selectCommentarySource(author);
          CommentaryWindow.switchTab('commentaries');
        } else {
          document.querySelector('.drawer-tab[data-drawer-tab="commentaries"]')?.click();
          setTimeout(() => {
            if (typeof CommentaryViewer !== 'undefined') {
              if (author) CommentaryViewer.preferredAuthor = author;
              CommentaryViewer.selectCommentary(idx);
            }
          }, 50);
        }
      });
    });

    // 3. Ouvrir l'onglet Commentaires général
    container.querySelectorAll('[data-action="open-commentaries-tab"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (typeof CommentaryWindow !== 'undefined' && typeof CommentaryWindow.switchTab === 'function') {
          CommentaryWindow.switchTab('commentaries');
        } else {
          document.querySelector('.drawer-tab[data-drawer-tab="commentaries"]')?.click();
        }
      });
    });

    // 4. Clic sur un article -> Ouvre l'article dans le tiroir latéral
    container.querySelectorAll('[data-action="open-article"]').forEach(card => {
      card.addEventListener('click', () => {
        const artId = card.dataset.articleId;
        document.querySelector('.drawer-tab[data-drawer-tab="articles"]')?.click();
        setTimeout(() => {
          if (typeof ArticlesView !== 'undefined' && ArticlesView.openDrawerArticle) {
            ArticlesView.openDrawerArticle(artId);
          }
        }, 80);
      });
    });

    container.querySelectorAll('[data-action="open-articles-tab"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelector('.drawer-tab[data-drawer-tab="articles"]')?.click();
      });
    });

    // 5. Clic sur un livre de théologie
    container.querySelectorAll('[data-action="open-theology-chapter"]').forEach(card => {
      card.addEventListener('click', () => {
        const bName = card.dataset.bookName;
        const chId = card.dataset.chapterId;
        if (typeof TheologyView !== 'undefined' && typeof TheologyView.openBook === 'function') {
          TheologyView.openBook(bName, chId);
        } else if (typeof TheologyView !== 'undefined' && typeof TheologyView.selectBook === 'function') {
          if (typeof App !== 'undefined' && App.switchView) {
            App.switchView('theology');
          }
          TheologyView.selectBook(bName, chId);
        } else if (typeof App !== 'undefined' && App.switchView) {
          App.switchView('theology');
        }
      });
    });

    container.querySelectorAll('[data-action="open-library-tab"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (typeof App !== 'undefined' && App.switchView) {
          App.switchView('theology');
        }
      });
    });

    // 6. Clic sur une note -> Ouvre l'onglet notes
    container.querySelectorAll('[data-action="open-note"]').forEach(card => {
      card.addEventListener('click', () => {
        if (typeof CommentaryWindow !== 'undefined' && typeof CommentaryWindow.switchTab === 'function') {
          CommentaryWindow.switchTab('notes');
        } else {
          document.querySelector('.drawer-tab[data-drawer-tab="notes"]')?.click();
        }
      });
    });

    container.querySelectorAll('[data-action="add-quick-note"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (typeof CommentaryWindow !== 'undefined' && typeof CommentaryWindow.switchTab === 'function') {
          CommentaryWindow.switchTab('notes');
        } else {
          document.querySelector('.drawer-tab[data-drawer-tab="notes"]')?.click();
          setTimeout(() => {
            if (typeof DrawerNotesViewer !== 'undefined' && DrawerNotesViewer.openNewNote) {
              DrawerNotesViewer.openNewNote();
            }
          }, 80);
        }
      });
    });

    // 7. Clic sur un lieu cartographique -> Ouvre la vue Cartes
    container.querySelectorAll('[data-action="focus-map-place"]').forEach(card => {
      card.addEventListener('click', () => {
        const placeId = card.dataset.placeId;
        if (typeof App !== 'undefined' && App.switchView) {
          App.switchView('maps');
          setTimeout(() => {
            if (typeof MapsView !== 'undefined' && MapsView.selectPlace) {
              MapsView.selectPlace(placeId);
            }
          }, 150);
        }
      });
    });

    // 7b. Actions BibleProject (Lecture vidéo & Visualisation poster HD)
    container.querySelectorAll('[data-action="open-bp-video"]').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const ytId = item.dataset.ytId;
        const title = item.dataset.title || '';
        const desc = item.dataset.desc || '';
        this.playVideo(ytId, title, desc);
      });
    });

    container.querySelectorAll('[data-action="open-bp-poster"]').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const imgUrl = item.dataset.imageUrl;
        const pdfUrl = item.dataset.pdfUrl;
        const title = item.dataset.title;
        this.openPosterModal(imgUrl, pdfUrl, title);
      });
    });

    container.querySelectorAll('[data-action="open-media-tab"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (typeof App !== 'undefined' && App.switchView) {
          App.switchView('media');
        } else if (document.querySelector('.drawer-tab[data-drawer-tab="media"]')) {
          document.querySelector('.drawer-tab[data-drawer-tab="media"]').click();
        } else {
          const firstVid = this.currentData?.bibleproject?.current_videos?.[0] || this.currentData?.bibleproject?.all_videos?.[0];
          if (firstVid) {
            this.playVideo(firstVid.yt_id, firstVid.title, firstVid.description);
          }
        }
      });
    });

    // 8. Boutons d'actions rapides du bas de carte
    container.querySelector('#btn-card-launch-synth')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (typeof CommentaryWindow !== 'undefined' && typeof CommentaryWindow.toggleSynthesisPanel === 'function') {
        CommentaryWindow.switchTab('commentaries');
        setTimeout(() => CommentaryWindow.toggleSynthesisPanel(true), 80);
      } else {
        document.querySelector('.drawer-tab[data-drawer-tab="commentaries"]')?.click();
        setTimeout(() => {
          if (typeof CommentarySynthesizerUI !== 'undefined') {
            CommentarySynthesizerUI.openModal();
          }
        }, 100);
      }
    });

    container.querySelector('#btn-card-launch-study')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const refStr = data.reference || `${this.currentBook} ${this.currentChapter}:${this.currentVerse}`;
      if (typeof App !== 'undefined' && App.switchView) {
        App.switchView('view-passage-study');
        setTimeout(() => {
          if (typeof PassageStudyView !== 'undefined' && PassageStudyView.loadPassage) {
            PassageStudyView.loadPassage(refStr);
          }
        }, 150);
      }
    });
  },

  // =========================================================================
  // GESTION DU LECTEUR VIDÉO ET DU VISUALISEUR DE POSTER HD BIBLEPROJECT
  // =========================================================================

  panzoom: {
    scale: 1,
    minScale: 0.5,
    maxScale: 6.0,
    translateX: 0,
    translateY: 0,
    isDragging: false,
    startX: 0,
    startY: 0
  },

  playVideo(ytId, title, desc) {
    let modal = document.getElementById('bp-video-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'bp-video-modal';
      modal.className = 'bp-modal-overlay hidden';
      modal.innerHTML = `
        <div class="bp-modal-window" style="max-width: 980px; height: auto; max-height: 92vh; background: #0F172A; border: 1px solid rgba(255,255,255,0.15); box-shadow: 0 24px 64px rgba(0,0,0,0.85); border-radius: 12px; overflow: hidden; display: flex; flex-direction: column;">
          <div class="bp-modal-header" style="padding: 12px 18px; background: #1E293B; border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: space-between;">
            <div class="bp-modal-title-wrap" style="display: flex; align-items: center; gap: 10px;">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#C084FC" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
              <div>
                <div class="bp-modal-main-title" id="bp-video-modal-title" style="font-size: 14px; font-weight: 700; color: #F8FAFC;">Lecture Vidéo BibleProject</div>
                <div class="bp-modal-sub-title" style="font-size: 11.5px; color: #94A3B8;">BibleProject (Français) • Panorama narratif</div>
              </div>
            </div>
            <div class="bp-modal-controls" style="display: flex; align-items: center; gap: 8px;">
              <a href="#" target="_blank" class="bp-ctrl-btn bp-btn-download" id="bp-video-ext-btn" title="Ouvrir la vidéo sur YouTube" style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; color: #F8FAFC; text-decoration: none; font-size: 12px; font-weight: 600;">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                <span>YouTube ↗</span>
              </a>
              <button type="button" class="bp-ctrl-btn bp-btn-close" id="bp-video-modal-close" title="Fermer (Échap)" style="width: 30px; height: 30px; display: inline-flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; color: #F8FAFC; cursor: pointer;">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>
          <div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; background: #000;">
            <iframe id="bp-video-modal-iframe" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      modal.querySelector('#bp-video-modal-close')?.addEventListener('click', () => this.closeVideoModal());
      modal.addEventListener('click', (e) => {
        if (e.target === modal) this.closeVideoModal();
      });
      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
          this.closeVideoModal();
        }
      });
    }

    const titleEl = modal.querySelector('#bp-video-modal-title');
    const iframe = modal.querySelector('#bp-video-modal-iframe');
    const extBtn = modal.querySelector('#bp-video-ext-btn');

    if (titleEl) titleEl.textContent = title || 'Panorama BibleProject';
    if (extBtn) {
      extBtn.onclick = (e) => {
        e.preventDefault();
        try { API.openExternalUrl(`https://www.youtube.com/watch?v=${ytId}`); } catch(err) { window.open(`https://www.youtube.com/watch?v=${ytId}`, '_blank'); }
      };
    }
    if (iframe) {
      iframe.src = `https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&rel=0&modestbranding=1`;
    }

    modal.classList.remove('hidden');
    document.body.classList.add('bp-modal-open');
  },

  closeVideoModal() {
    const modal = document.getElementById('bp-video-modal');
    if (modal) {
      const iframe = modal.querySelector('#bp-video-modal-iframe');
      if (iframe) iframe.src = '';
      modal.classList.add('hidden');
      document.body.classList.remove('bp-modal-open');
    }
  },

  openPosterModal(imageUrl, pdfUrl, title) {
    let modal = document.getElementById('bp-poster-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'bp-poster-modal';
      modal.className = 'bp-modal-overlay hidden';
      modal.innerHTML = `
        <div class="bp-modal-window" style="width: 95vw; height: 92vh; max-width: 1540px; background: #0B0F19; border: 1px solid rgba(255,255,255,0.12); border-radius: 12px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 24px 64px rgba(0,0,0,0.85);">
          <div class="bp-modal-header" style="padding: 10px 18px; background: #111726; border-bottom: 1px solid rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: space-between;">
            <div class="bp-modal-title-wrap" style="display: flex; align-items: center; gap: 10px;">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#C084FC" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              <div>
                <div class="bp-modal-main-title" id="bp-modal-poster-title" style="font-size: 13.5px; font-weight: 700; color: #F1F5F9;">Structure littéraire</div>
                <div class="bp-modal-sub-title" style="font-size: 11px; color: #94A3B8;">BibleProject (Français) • Haute Définition</div>
              </div>
            </div>
            <div class="bp-modal-controls" style="display: flex; align-items: center; gap: 6px;">
              <button type="button" class="bp-ctrl-btn" id="bp-zoom-out" title="Dézoomer (Molette bas)" style="width: 28px; height: 28px; display: inline-flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; color: #F8FAFC; cursor: pointer;">−</button>
              <span class="bp-zoom-level" id="bp-zoom-level-label" style="font-size: 12px; font-weight: 700; color: #94A3B8; min-width: 40px; text-align: center;">100%</span>
              <button type="button" class="bp-ctrl-btn" id="bp-zoom-in" title="Zoomer (Molette haut)" style="width: 28px; height: 28px; display: inline-flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; color: #F8FAFC; cursor: pointer;">+</button>
              <button type="button" class="bp-ctrl-btn" id="bp-zoom-fit" title="Ajuster à l'écran" style="padding: 4px 9px; display: inline-flex; align-items: center; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; color: #F8FAFC; font-size: 11.5px; cursor: pointer;">Ajuster</button>
              <button type="button" class="bp-ctrl-btn" id="bp-zoom-reset" title="Taille réelle (1:1)" style="padding: 4px 9px; display: inline-flex; align-items: center; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; color: #F8FAFC; font-size: 11.5px; cursor: pointer;">1:1</button>
              <a href="#" target="_blank" class="bp-ctrl-btn bp-btn-download" id="bp-poster-download-btn" title="Ouvrir l'affiche HD officielle" style="display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; color: #F8FAFC; text-decoration: none; font-size: 11.5px; font-weight: 600;">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                <span>Affiche HD ↗</span>
              </a>
              <button type="button" class="bp-ctrl-btn bp-btn-close" id="bp-poster-modal-close" title="Fermer (Échap)" style="width: 28px; height: 28px; display: inline-flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; color: #F8FAFC; cursor: pointer;">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>
          <div class="bp-viewport-container" id="bp-poster-viewport" style="flex: 1; overflow: hidden; position: relative; background: #050811; cursor: grab; display: flex; align-items: center; justify-content: center;" title="Glisser pour déplacer • Molette pour zoomer">
            <div class="bp-canvas-transform-layer" id="bp-poster-transform-layer" style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; transform-origin: center center; transition: transform 0.08s ease-out;">
              <img src="" alt="Poster BibleProject" class="bp-poster-highres-img" id="bp-poster-highres-img" draggable="false" style="max-width: 96%; max-height: 96%; object-fit: contain; user-select: none;">
            </div>
            <div class="bp-loading-indicator hidden" id="bp-poster-loading" style="position: absolute; display: flex; flex-direction: column; align-items: center; gap: 8px;">
              <div class="comm-loader-orb"></div>
              <span style="color: #94A3B8; font-size: 12px;">Chargement du poster haute définition...</span>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      this.bindPosterModalEvents();
    }

    const titleEl = modal.querySelector('#bp-modal-poster-title');
    const dlBtn = modal.querySelector('#bp-poster-download-btn');
    const img = modal.querySelector('#bp-poster-highres-img');
    const loader = modal.querySelector('#bp-poster-loading');

    if (titleEl) titleEl.textContent = title || 'Structure littéraire';
    if (dlBtn) {
      dlBtn.onclick = (e) => {
        e.preventDefault();
        try { API.openExternalUrl(pdfUrl || imageUrl); } catch(err) { window.open(pdfUrl || imageUrl, '_blank'); }
      };
    }

    if (img) {
      if (loader) loader.classList.remove('hidden');
      img.style.display = 'none';
      img.src = imageUrl;
      img.onload = () => {
        img.style.display = 'block';
        if (loader) loader.classList.add('hidden');
        this.fitToScreen();
      };
      img.onerror = () => {
        if (loader) loader.classList.add('hidden');
        img.style.display = 'block';
      };
    }

    modal.classList.remove('hidden');
    document.body.classList.add('bp-modal-open');
  },

  closePosterModal() {
    const modal = document.getElementById('bp-poster-modal');
    if (modal) {
      modal.classList.add('hidden');
      document.body.classList.remove('bp-modal-open');
    }
  },

  bindPosterModalEvents() {
    const modal = document.getElementById('bp-poster-modal');
    const closeBtn = modal?.querySelector('#bp-poster-modal-close');
    const zoomInBtn = modal?.querySelector('#bp-zoom-in');
    const zoomOutBtn = modal?.querySelector('#bp-zoom-out');
    const zoomFitBtn = modal?.querySelector('#bp-zoom-fit');
    const zoomResetBtn = modal?.querySelector('#bp-zoom-reset');
    const viewport = modal?.querySelector('#bp-poster-viewport');

    closeBtn?.addEventListener('click', () => this.closePosterModal());
    modal?.addEventListener('click', (e) => {
      if (e.target === modal) this.closePosterModal();
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
        this.closePosterModal();
      }
    });

    zoomInBtn?.addEventListener('click', () => this.zoom(1.25));
    zoomOutBtn?.addEventListener('click', () => this.zoom(0.8));
    zoomFitBtn?.addEventListener('click', () => this.fitToScreen());
    zoomResetBtn?.addEventListener('click', () => this.resetZoom());

    viewport?.addEventListener('wheel', (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.15 : 0.85;
      this.zoom(factor);
    }, { passive: false });

    viewport?.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      this.panzoom.isDragging = true;
      this.panzoom.startX = e.clientX - (this.panzoom.translateX || 0);
      this.panzoom.startY = e.clientY - (this.panzoom.translateY || 0);
      viewport.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.panzoom.isDragging) return;
      this.panzoom.translateX = e.clientX - this.panzoom.startX;
      this.panzoom.translateY = e.clientY - this.panzoom.startY;
      this.applyTransform();
    });

    window.addEventListener('mouseup', () => {
      if (this.panzoom.isDragging) {
        this.panzoom.isDragging = false;
        if (viewport) viewport.style.cursor = 'grab';
      }
    });

    viewport?.addEventListener('dblclick', () => {
      if (Math.abs(this.panzoom.scale - 1) < 0.1) {
        this.fitToScreen();
      } else {
        this.resetZoom();
      }
    });
  },

  zoom(factor) {
    this.panzoom.scale = Math.min(this.panzoom.maxScale, Math.max(this.panzoom.minScale, this.panzoom.scale * factor));
    this.applyTransform();
    this.updateZoomLabel();
  },

  fitToScreen() {
    this.panzoom.scale = 1.0;
    this.panzoom.translateX = 0;
    this.panzoom.translateY = 0;
    this.applyTransform();
    this.updateZoomLabel();
  },

  resetZoom() {
    this.panzoom.scale = this.panzoom.scale <= 1.2 ? 2.2 : 1.0;
    this.panzoom.translateX = 0;
    this.panzoom.translateY = 0;
    this.applyTransform();
    this.updateZoomLabel();
  },

  applyTransform() {
    const layer = document.getElementById('bp-poster-transform-layer');
    if (layer) {
      layer.style.transform = `translate(${this.panzoom.translateX}px, ${this.panzoom.translateY}px) scale(${this.panzoom.scale})`;
    }
  },

  updateZoomLabel() {
    const lbl = document.getElementById('bp-zoom-level-label');
    if (lbl) {
      lbl.textContent = `${Math.round(this.panzoom.scale * 100)}%`;
    }
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

window.PassageOverviewDrawer = PassageOverviewDrawer;
