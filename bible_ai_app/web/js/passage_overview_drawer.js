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

  // Icônes SVG vectorielles réutilisables (100% sans émoji)
  icons: {
    compass: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>`,
    commentary: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
    article: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 20H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h10l6 6v8a2 2 0 0 1-2 2z"/><path d="M14 2v6h6"/><path d="M7 13h10"/><path d="M7 17h6"/></svg>`,
    book: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M6 6h10"/><path d="M6 10h10"/></svg>`,
    note: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>`,
    map: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`,
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

    // Bouton verset précédent / suivant
    document.getElementById('btn-overview-prev-v')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (typeof BibleReader !== 'undefined') {
        const nextV = Math.max(1, (this.currentVerse || 1) - 1);
        BibleReader.selectVerse(nextV);
      }
    });

    document.getElementById('btn-overview-next-v')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (typeof BibleReader !== 'undefined') {
        const nextV = (this.currentVerse || 1) + 1;
        BibleReader.selectVerse(nextV);
      }
    });

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
   * Nettoie et formate les extraits textuels (enlève le markdown brut, les en-têtes ##, etc.)
   */
  cleanExcerpt(text) {
    if (!text) return '';
    let cleaned = text.replace(/<[^>]+>/g, ' ');
    cleaned = cleaned.replace(/^#+\s+/gm, '');
    cleaned = cleaned.replace(/^[0-9IVXLCDM]+\.\s+/gm, '');
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    if (cleaned.length > 175) {
      cleaned = cleaned.slice(0, 172) + '...';
    }
    return cleaned;
  },

  /**
   * Rendu complet des cartes et compteurs.
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

    let activeHtml = '';
    let emptyHtml = '';
    let emptyCount = 0;

    // A. Section Commentaires Exégétiques
    if (commCount > 0) {
      activeHtml += this.renderCommentariesSection(data);
    } else {
      emptyHtml += this.renderCommentariesSection(data);
      emptyCount++;
    }

    // B. Section Articles & Revues Théologiques
    if (artCount > 0) {
      activeHtml += this.renderArticlesSection(data);
    } else {
      emptyHtml += this.renderArticlesSection(data);
      emptyCount++;
    }

    // C. Section Livres de Théologie & Bibliothèque
    if (theoCount > 0) {
      activeHtml += this.renderTheologySection(data);
    } else {
      emptyHtml += this.renderTheologySection(data);
      emptyCount++;
    }

    // D. Section Vos Notes & Surlignages Personnels
    if (notesCount > 0) {
      activeHtml += this.renderNotesSection(data);
    } else {
      emptyHtml += this.renderNotesSection(data);
      emptyCount++;
    }

    // E. Section Géographie & Lieux Bibliques
    if (mapsCount > 0) {
      activeHtml += this.renderMapsSection(data);
    } else {
      emptyHtml += this.renderMapsSection(data);
      emptyCount++;
    }

    // Assemblage avec tiroir discret pour les sections vides
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

    // Attacher les écouteurs de clics et d'accordéons
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

    chipsBar.innerHTML = `
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
   * Section Commentaires Exégétiques (Épurée, typographique, sans boîtes lourdes)
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
      const topCount = 3;
      const initialList = list.slice(0, topCount);
      const remainingList = list.slice(topCount);

      bodyHtml = `<div class="overview-clean-list">`;
      
      const renderItem = (c, idx) => {
        const author = c.author || c.source_name || 'Commentaire';
        const title = c.title && c.title !== author ? c.title : (c.source_name || '');
        const excerpt = this.cleanExcerpt(c.excerpt);

        return `
          <div class="overview-clean-item" data-action="select-commentary" data-author="${this.escapeHtml(author)}" data-source-id="${this.escapeHtml(c.source_id)}" data-index="${idx}">
            <div class="clean-item-header">
              <div class="clean-item-title-group">
                <span class="clean-author-name">${this.escapeHtml(author)}</span>
                ${title ? `<span class="clean-source-title">· ${this.escapeHtml(title)}</span>` : ''}
              </div>
              <span class="clean-item-arrow">${this.icons.arrowRight}</span>
            </div>
            <p class="clean-item-excerpt">${this.escapeHtml(excerpt)}</p>
          </div>
        `;
      };

      initialList.forEach((c, idx) => {
        bodyHtml += renderItem(c, idx);
      });

      if (remainingList.length > 0) {
        bodyHtml += `
          <div class="overview-extra-comms hidden" id="extra-comms-list">
            ${remainingList.map((c, i) => renderItem(c, topCount + i)).join('')}
          </div>
          <button type="button" class="overview-show-more-link" data-action="toggle-more-comms">
            <span>Afficher les ${remainingList.length} autres commentaires</span>
            ${this.icons.chevronDown}
          </button>
        `;
      }

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
   * Section Articles de blog
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
        const time = art.reading_time_minutes ? `${art.reading_time_minutes} min` : '';
        const summary = this.cleanExcerpt(art.lead_summary);

        bodyHtml += `
          <div class="overview-clean-item" data-action="open-article" data-article-id="${this.escapeHtml(art.id)}">
            <div class="clean-item-header">
              <div class="clean-item-title-group">
                <span class="clean-author-name">${this.escapeHtml(title)}</span>
                <span class="clean-source-tag">${this.escapeHtml(src)}</span>
              </div>
              <span class="clean-item-arrow">${this.icons.arrowRight}</span>
            </div>
            ${summary ? `<p class="clean-item-excerpt">${this.escapeHtml(summary)}</p>` : ''}
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
   * Section Livres de Théologie & Bibliothèque
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

        bodyHtml += `
          <div class="overview-clean-item" data-action="open-theology-chapter" data-book-name="${this.escapeHtml(b.book_name)}" data-chapter-id="${b.chapter_id}">
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
   * Section Notes & Surlignages
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
        bodyHtml += `
          <div class="overview-clean-item" data-action="open-note" data-note-id="${this.escapeHtml(n.id)}">
            <div class="clean-item-header">
              <span class="clean-author-name">${this.escapeHtml(n.title || 'Note')}</span>
              <span class="clean-item-arrow">${this.icons.arrowRight}</span>
            </div>
            ${n.snippet ? `<p class="clean-item-excerpt">${this.escapeHtml(this.cleanExcerpt(n.snippet))}</p>` : ''}
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
   * Section Lieux Géographiques
   */
  renderMapsSection(data) {
    const list = data.maps || [];
    const isCollapsed = this.collapsedSections['sec-maps'] || false;

    let bodyHtml = '';
    if (list.length === 0) {
      bodyHtml = `
        <div class="overview-empty-hint">
          <span>Aucun site géographique identifié dans ce chapitre.</span>
        </div>
      `;
    } else {
      bodyHtml = `<div class="overview-clean-list">`;
      list.forEach((p) => {
        bodyHtml += `
          <div class="overview-clean-item" data-action="focus-map-place" data-place-id="${this.escapeHtml(p.id)}">
            <div class="clean-item-header">
              <span class="clean-author-name">${this.escapeHtml(p.name)}</span>
              <span class="clean-source-tag">${this.escapeHtml(p.type || 'Lieu')}</span>
            </div>
            ${p.description ? `<p class="clean-item-excerpt">${this.escapeHtml(this.cleanExcerpt(p.description))}</p>` : ''}
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
        const sourceId = card.dataset.sourceId;
        const idx = parseInt(card.dataset.index) || 0;

        document.querySelector('.drawer-tab[data-drawer-tab="commentaries"]')?.click();
        
        setTimeout(() => {
          if (typeof CommentaryViewer !== 'undefined') {
            if (author) CommentaryViewer.preferredAuthor = author;
            CommentaryViewer.selectCommentary(idx);
          }
        }, 50);
      });
    });

    // 3. Ouvrir l'onglet Commentaires général
    container.querySelectorAll('[data-action="open-commentaries-tab"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelector('.drawer-tab[data-drawer-tab="commentaries"]')?.click();
      });
    });

    // 4. Clic sur un article -> Ouvre l'article
    container.querySelectorAll('[data-action="open-article"]').forEach(card => {
      card.addEventListener('click', () => {
        const artId = card.dataset.articleId;
        if (typeof App !== 'undefined' && App.switchView) {
          App.switchView('articles');
          setTimeout(() => {
            if (typeof ArticlesView !== 'undefined' && ArticlesView.openArticle) {
              ArticlesView.openArticle(artId);
            }
          }, 150);
        }
      });
    });

    container.querySelectorAll('[data-action="open-articles-tab"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelector('.drawer-tab[data-drawer-tab="articles"]')?.click();
      });
    });

    // 5. Clic sur un livre de théologie -> Ouvre le chapitre dans la vue théologie
    container.querySelectorAll('[data-action="open-theology-chapter"]').forEach(card => {
      card.addEventListener('click', () => {
        const bName = card.dataset.bookName;
        const chId = card.dataset.chapterId;
        if (typeof App !== 'undefined' && App.switchView) {
          App.switchView('theology');
          setTimeout(() => {
            if (typeof TheologyView !== 'undefined' && TheologyView.selectBook) {
              TheologyView.selectBook(bName, chId);
            }
          }, 150);
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
        document.querySelector('.drawer-tab[data-drawer-tab="notes"]')?.click();
      });
    });

    container.querySelectorAll('[data-action="add-quick-note"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelector('.drawer-tab[data-drawer-tab="notes"]')?.click();
        setTimeout(() => {
          if (typeof DrawerNotesViewer !== 'undefined' && DrawerNotesViewer.openNewNote) {
            DrawerNotesViewer.openNewNote();
          }
        }, 80);
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

    // 8. Boutons d'actions rapides du bas de carte
    container.querySelector('#btn-card-launch-synth')?.addEventListener('click', (e) => {
      e.stopPropagation();
      document.querySelector('.drawer-tab[data-drawer-tab="commentaries"]')?.click();
      setTimeout(() => {
        if (typeof CommentarySynthesizerUI !== 'undefined') {
          CommentarySynthesizerUI.openModal();
        }
      }, 100);
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
