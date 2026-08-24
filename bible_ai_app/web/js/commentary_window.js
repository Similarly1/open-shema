/**
 * Commentary Window Controller (Second Screen)
 * Gère le défilement continu synchronisé et l'affichage riche des commentaires exégétiques.
 * Règle stricte : 100% icônes SVG, aucun émoji.
 */

const CommentaryWindow = {
  channel: null,
  isSyncActive: true,
  isUserScrolled: false,
  _isProgrammaticScroll: false,
  _scrollTimeout: null,

  currentBook: 'Gen',
  currentBookFrench: 'Genèse',
  currentChapter: 1,
  currentVerse: 1,
  currentChapterData: null,
  activeAuthorFilter: 'all',

  // Paramètres d'affichage
  zoomPercent: 100,
  fontFamily: 'EB Garamond',
  readingBg: 'auto',

  // Cache de traduction
  translationCache: {},
  showTranslatedVersion: {},

  init() {
    this.initBroadcastChannel();
    this.bindEvents();
    this.restorePreferences();

    // 1. Charger immédiatement le chapitre par défaut
    const startLoad = () => {
      this.loadChapterCommentaries(this.currentBook, this.currentChapter).then(() => {
        this.notifyReady();
      });
    };

    // 2. Attendre que l'API soit prête
    API.onReady(() => {
      startLoad();
    });

    if (API.isReady) {
      startLoad();
    }
  },

  initBroadcastChannel() {
    try {
      this.channel = new BroadcastChannel('open_shema_multiwindow');
      this.channel.onmessage = (event) => {
        this.handleMessage(event.data);
      };
      console.log('[CommentaryWindow] BroadcastChannel connecté.');
    } catch (e) {
      console.warn('[CommentaryWindow] Erreur BroadcastChannel:', e);
    }
  },

  notifyReady() {
    if (this.channel) {
      this.channel.postMessage({ type: 'SECONDARY_WINDOW_READY' });
      this.channel.postMessage({ type: 'REQUEST_CURRENT_STATE' });
    }
  },

  handleMessage(data) {
    if (!data || !data.type) return;

    switch (data.type) {
      case 'PASSAGE_NAVIGATED':
        this.handlePassageNavigated(data.book, data.bookFrench, data.chapter, data.verse);
        break;

      case 'VERSE_CHANGED':
        this.handleVerseChanged(data.book, data.chapter, data.verse);
        break;

      default:
        break;
    }
  },

  async handlePassageNavigated(bookCode, bookFrench, chapterNum, verseNum = 1) {
    const isNewChapter = this.currentBook !== bookCode || this.currentChapter !== parseInt(chapterNum, 10);
    this.currentBook = bookCode;
    this.currentBookFrench = bookFrench || bookCode;
    this.currentChapter = parseInt(chapterNum, 10);
    this.currentVerse = parseInt(verseNum, 10) || 1;

    this.updatePassageDisplay(this.currentBookFrench, this.currentChapter, this.currentVerse);

    if (isNewChapter || !this.currentChapterData) {
      await this.loadChapterCommentaries(bookCode, this.currentChapter);
    }

    if (this.isSyncActive) {
      this.scrollToVerseBlock(this.currentVerse);
    }
  },

  handleVerseChanged(bookCode, chapterNum, verseNum) {
    const ch = parseInt(chapterNum, 10);
    const v = parseInt(verseNum, 10);

    // Si on a changé de chapitre par défilement continu OU si les données ne sont pas encore chargées
    if (this.currentBook !== bookCode || this.currentChapter !== ch || !this.currentChapterData) {
      this.currentBook = bookCode;
      this.currentChapter = ch;
      this.currentVerse = v;
      this.updatePassageDisplay(this.currentBookFrench, this.currentChapter, this.currentVerse);
      this.loadChapterCommentaries(bookCode, ch).then(() => {
        if (this.isSyncActive && !this.isUserScrolled) {
          this.scrollToVerseBlock(v);
        }
      });
      return;
    }

    this.currentVerse = v;
    this.updatePassageDisplay(this.currentBookFrench, this.currentChapter, this.currentVerse);

    if (this.isSyncActive && !this.isUserScrolled) {
      this.scrollToVerseBlock(v);
    }
  },

  updatePassageDisplay(bookName, chapter, verse) {
    const textEl = document.getElementById('comm-win-passage-text');
    if (textEl) {
      textEl.textContent = `${bookName} ${chapter}:${verse || 1}`;
    }
  },

  async loadChapterCommentaries(bookCode, chapterNum) {
    const container = document.getElementById('commentary-stream-container');
    if (!container) return;

    container.innerHTML = `
      <div style="text-align: center; padding: 60px 20px; color: var(--text-secondary);">
        <div class="synth-spinner" style="width: 24px; height: 24px; border-width: 2.5px; margin: 0 auto 12px auto;"></div>
        <div style="font-size: 14px; font-weight: 600;">Chargement des commentaires de ${this.currentBookFrench} ${chapterNum}...</div>
      </div>
    `;

    try {
      const data = await API.getChapterCommentariesGrouped(bookCode, chapterNum);
      this.currentChapterData = data;
      this.populateAuthorFilter(data.available_sources || []);
      this.renderStream(data);
      if (this.isSyncActive) {
        setTimeout(() => {
          this.scrollToVerseBlock(this.currentVerse);
        }, 50);
      }
    } catch (e) {
      console.error('[CommentaryWindow] Erreur chargement commentaires:', e);
      container.innerHTML = `
        <div style="text-align: center; padding: 40px; color: var(--accent-red, #EF4444);">
          <div style="font-size: 15px; font-weight: 700; margin-bottom: 6px;">Impossible de charger les commentaires</div>
          <div style="font-size: 12px; opacity: 0.8;">${String(e)}</div>
        </div>
      `;
    }
  },

  populateAuthorFilter(sources) {
    const listEl = document.getElementById('author-filter-list');
    const labelEl = document.getElementById('lbl-active-author');
    if (!listEl) return;

    listEl.innerHTML = `
      <button type="button" class="comm-win-tool-btn author-filter-item ${this.activeAuthorFilter === 'all' ? 'active' : ''}" data-author="all" style="width: 100%; justify-content: flex-start; text-align: left;">
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
        <span>Tous les ouvrages (${sources.length})</span>
      </button>
    `;

    sources.forEach(src => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `comm-win-tool-btn author-filter-item ${this.activeAuthorFilter === src ? 'active' : ''}`;
      btn.dataset.author = src;
      btn.style.width = '100%';
      btn.style.justifyContent = 'flex-start';
      btn.style.textAlign = 'left';
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
        <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${src}</span>
      `;
      listEl.appendChild(btn);
    });

    listEl.querySelectorAll('.author-filter-item').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeAuthorFilter = btn.dataset.author;
        listEl.querySelectorAll('.author-filter-item').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (labelEl) {
          labelEl.textContent = this.activeAuthorFilter === 'all' ? 'Tous les ouvrages' : this.activeAuthorFilter;
        }
        document.getElementById('author-filter-popover')?.classList.add('hidden');
        if (this.currentChapterData) {
          this.renderStream(this.currentChapterData);
        }
      });
    });
  },

  renderStream(data) {
    const container = document.getElementById('commentary-stream-container');
    if (!container || !data || !data.verses) return;

    const totalCommentsCount = data.verses.reduce((acc, v) => acc + (v.comments ? v.comments.length : 0), 0);

    let html = `
      <div class="comm-stream-chapter-hero">
        <h1 class="comm-stream-chapter-title">${data.book_french.toUpperCase()} ${data.chapter}</h1>
        <div class="comm-stream-chapter-subtitle">
          <span>${data.total_verses} versets</span>
          <span>•</span>
          <span>${totalCommentsCount} notes exégétiques</span>
          <span>•</span>
          <span>${data.available_sources.length} sources</span>
        </div>
      </div>
    `;

    data.verses.forEach(vObj => {
      const vNum = vObj.verse;
      const vText = vObj.text || '';
      let comments = vObj.comments || [];

      if (this.activeAuthorFilter !== 'all') {
        comments = comments.filter(c => c.author === this.activeAuthorFilter || c.source === this.activeAuthorFilter);
      }

      if (comments.length === 0 && this.activeAuthorFilter !== 'all') {
        return; // Ne pas afficher le verset si aucun commentaire ne correspond au filtre
      }

      html += `
        <div class="comm-stream-verse-block ${vNum === this.currentVerse ? 'active-synced-comm' : ''}" id="comm-verse-${vNum}" data-verse="${vNum}">
          <div class="comm-verse-quote-banner" data-nav-verse="${vNum}" title="Cliquer pour positionner la Bible principale sur ce verset" style="cursor: pointer;">
            <div class="comm-verse-num-badge">${vNum}</div>
            <div class="comm-verse-quote-text">« ${vText || '...'} »</div>
          </div>
          <div class="comm-verse-cards-list">
      `;

      if (comments.length === 0) {
        html += `
          <div class="comm-stream-card" style="padding: 12px 18px; opacity: 0.6; font-style: italic; font-size: 13px;">
            Aucune note exégétique directe pour ce verset dans la sélection active.
          </div>
        `;
      } else {
        comments.forEach(comm => {
          const itemId = `comm_${comm.id || comm.author}_${data.book}_${data.chapter}_${vNum}`;
          const isForeign = this.isForeignText(comm.text);
          const cachedTrans = this.translationCache[itemId];
          const isShowingTranslated = this.showTranslatedVersion[itemId] !== false && !!cachedTrans;

          let displayedText = comm.text || '';
          if (cachedTrans && isShowingTranslated) {
            displayedText = cachedTrans;
          }

          const formattedText = this.formatMarkdown(displayedText);

          html += `
            <article class="comm-stream-card" id="${itemId}">
              <div class="comm-stream-card-header">
                <div class="comm-stream-author-title">
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
                  </svg>
                  <span>${comm.author || comm.source || 'Commentaire'}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span class="comm-stream-ref-badge">${comm.reference || `${data.book_french} ${data.chapter}:${vNum}`}</span>
                  ${isForeign ? `
                    <button type="button" class="comm-win-tool-btn btn-trans-comm" data-item-id="${itemId}" data-raw-text="${encodeURIComponent(comm.text)}" style="height: 22px; font-size: 11px; padding: 2px 7px;">
                      <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                      <span>${cachedTrans ? (isShowingTranslated ? 'Texte original' : 'Traduction') : 'Traduire'}</span>
                    </button>
                  ` : ''}
                </div>
              </div>
              <div class="comm-stream-body">${formattedText}</div>
            </article>
          `;
        });
      }

      html += `
          </div>
        </div>
      `;
    });

    container.innerHTML = html;

    // Attacher les clics sur les bandeaux de versets pour naviguer dans la fenêtre principale
    container.querySelectorAll('.comm-verse-quote-banner').forEach(banner => {
      banner.addEventListener('click', () => {
        const v = parseInt(banner.dataset.navVerse, 10);
        if (v && this.channel) {
          this.channel.postMessage({
            type: 'NAVIGATE_REQUEST',
            book: this.currentBook,
            chapter: this.currentChapter,
            verse: v
          });
          this.currentVerse = v;
          this.updateActiveVerseHighlight(v);
        }
      });
    });

    // Attacher la traduction
    container.querySelectorAll('.btn-trans-comm').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const itemId = btn.dataset.itemId;
        const rawText = decodeURIComponent(btn.dataset.rawText || '');
        await this.handleTranslateClick(btn, itemId, rawText);
      });
    });
  },

  async handleTranslateClick(btn, itemId, rawText) {
    if (this.translationCache[itemId]) {
      this.showTranslatedVersion[itemId] = !this.showTranslatedVersion[itemId];
      if (this.currentChapterData) this.renderStream(this.currentChapterData);
      return;
    }

    btn.disabled = true;
    btn.innerHTML = `<span class="synth-spinner" style="width: 10px; height: 10px; border-width: 1.5px; vertical-align: middle; margin-right: 4px;"></span><span>Traduction...</span>`;

    try {
      const res = await API.translateText(rawText, 'commentary', itemId);
      if (res && res.success && res.translated_text) {
        this.translationCache[itemId] = res.translated_text;
        this.showTranslatedVersion[itemId] = true;
        if (this.currentChapterData) this.renderStream(this.currentChapterData);
      } else {
        alert(res?.error || 'Erreur lors de la traduction.');
        btn.disabled = false;
        btn.innerHTML = `<span>Traduire</span>`;
      }
    } catch (err) {
      alert(`Erreur : ${err}`);
      btn.disabled = false;
      btn.innerHTML = `<span>Traduire</span>`;
    }
  },

  scrollToVerseBlock(verseNum) {
    const el = document.getElementById(`comm-verse-${verseNum}`);
    if (!el) return;

    this.updateActiveVerseHighlight(verseNum);

    this._isProgrammaticScroll = true;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });

    if (this._scrollTimeout) clearTimeout(this._scrollTimeout);
    this._scrollTimeout = setTimeout(() => {
      this._isProgrammaticScroll = false;
    }, 600);
  },

  updateActiveVerseHighlight(verseNum) {
    document.querySelectorAll('.comm-stream-verse-block').forEach(b => {
      const isTarget = parseInt(b.dataset.verse, 10) === parseInt(verseNum, 10);
      b.classList.toggle('active-synced-comm', isTarget);
    });
  },

  isForeignText(txt) {
    if (!txt || typeof txt !== 'string') return false;
    const clean = txt.substring(0, 300).toLowerCase();
    const englishWords = [' the ', ' and ', ' that ', ' with ', ' from ', ' which ', ' this ', ' have ', ' shall ', ' unto '];
    return englishWords.some(w => clean.includes(w));
  },

  formatMarkdown(raw) {
    if (!raw) return '';
    return raw
      .replace(/^### (.*$)/gim, '<h3 style="margin: 12px 0 6px 0; font-size: 15px; font-weight: 700;">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 style="margin: 14px 0 8px 0; font-size: 17px; font-weight: 700;">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 style="margin: 16px 0 10px 0; font-size: 19px; font-weight: 800;">$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/^\> (.*$)/gim, '<blockquote style="border-left: 3px solid var(--accent-blue); padding: 8px 12px; margin: 10px 0; background: var(--bg-hover); border-radius: 0 6px 6px 0; font-style: italic;">$1</blockquote>')
      .split(/\n\n+/)
      .map(p => p.trim())
      .filter(Boolean)
      .map(p => (p.startsWith('<h') || p.startsWith('<blockquote')) ? p : `<p>${p}</p>`)
      .join('');
  },

  bindEvents() {
    // 1. Bouton de synchro dans la barre de titre
    const syncBadge = document.getElementById('comm-win-sync-badge');
    const syncLabel = document.getElementById('comm-win-sync-label');
    syncBadge?.addEventListener('click', () => {
      this.isSyncActive = !this.isSyncActive;
      syncBadge.classList.toggle('synced', this.isSyncActive);
      syncBadge.classList.toggle('paused', !this.isSyncActive);
      if (syncLabel) {
        syncLabel.textContent = this.isSyncActive ? 'Synchro active' : 'Synchro en pause';
      }
      if (this.isSyncActive) {
        this.isUserScrolled = false;
        document.getElementById('btn-resume-sync')?.classList.add('hidden');
        this.scrollToVerseBlock(this.currentVerse);
      }
    });

    // 2. Bouton flottant de reprise du suivi en direct
    const btnResume = document.getElementById('btn-resume-sync');
    btnResume?.addEventListener('click', () => {
      this.isSyncActive = true;
      this.isUserScrolled = false;
      btnResume.classList.add('hidden');
      if (syncBadge) {
        syncBadge.classList.add('synced');
        syncBadge.classList.remove('paused');
      }
      if (syncLabel) syncLabel.textContent = 'Synchro active';
      this.scrollToVerseBlock(this.currentVerse);
    });

    // 3. Détection du défilement manuel utilisateur
    const scrollContainer = document.getElementById('comm-stream-scrollable');
    scrollContainer?.addEventListener('wheel', () => {
      if (!this._isProgrammaticScroll) {
        this.isUserScrolled = true;
        btnResume?.classList.remove('hidden');
      }
    }, { passive: true });

    scrollContainer?.addEventListener('touchmove', () => {
      if (!this._isProgrammaticScroll) {
        this.isUserScrolled = true;
        btnResume?.classList.remove('hidden');
      }
    }, { passive: true });

    // 4. Popovers
    const btnAuthor = document.getElementById('btn-author-filter');
    const popAuthor = document.getElementById('author-filter-popover');
    btnAuthor?.addEventListener('click', (e) => {
      e.stopPropagation();
      popAuthor?.classList.toggle('hidden');
      document.getElementById('comm-display-popover')?.classList.add('hidden');
    });

    const btnDisplay = document.getElementById('btn-comm-display');
    const popDisplay = document.getElementById('comm-display-popover');
    btnDisplay?.addEventListener('click', (e) => {
      e.stopPropagation();
      popDisplay?.classList.toggle('hidden');
      document.getElementById('author-filter-popover')?.classList.add('hidden');
    });

    document.addEventListener('click', (e) => {
      if (popAuthor && !popAuthor.contains(e.target) && e.target !== btnAuthor) {
        popAuthor.classList.add('hidden');
      }
      if (popDisplay && !popDisplay.contains(e.target) && e.target !== btnDisplay) {
        popDisplay.classList.add('hidden');
      }
    });

    // 5. Options d'affichage (Police, Zoom, Fond)
    document.querySelectorAll('.font-choice-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.font-choice-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.fontFamily = btn.dataset.font;
        document.documentElement.style.setProperty('--font-comm', `'${this.fontFamily}', Georgia, serif`);
        localStorage.setItem('comm_win_font', this.fontFamily);
      });
    });

    document.getElementById('btn-zoom-in')?.addEventListener('click', () => {
      this.setZoom(this.zoomPercent + 10);
    });

    document.getElementById('btn-zoom-out')?.addEventListener('click', () => {
      this.setZoom(this.zoomPercent - 10);
    });

    document.querySelectorAll('.bg-choice-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.bg-choice-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.readingBg = btn.dataset.bg;
        this.applyReadingBg(this.readingBg);
      });
    });

    // 6. Contrôles Fenêtre
    document.getElementById('btn-win-min')?.addEventListener('click', () => {
      API.call('minimize_commentary_window');
    });

    document.getElementById('btn-win-max')?.addEventListener('click', () => {
      API.call('maximize_commentary_window');
    });

    document.getElementById('btn-win-close')?.addEventListener('click', () => {
      API.call('close_commentary_window');
    });
  },

  setZoom(percent) {
    this.zoomPercent = Math.max(70, Math.min(180, percent));
    const lbl = document.getElementById('lbl-zoom-val');
    if (lbl) lbl.textContent = `${this.zoomPercent}%`;
    const container = document.getElementById('comm-stream-container');
    if (container) {
      container.style.fontSize = `${(this.zoomPercent / 100) * 15.5}px`;
    }
    localStorage.setItem('comm_win_zoom', this.zoomPercent);
  },

  applyReadingBg(bg) {
    document.body.classList.remove('reading-bg-white', 'reading-bg-sepia', 'reading-bg-dark');
    if (bg === 'white') document.body.classList.add('reading-bg-white');
    else if (bg === 'sepia') document.body.classList.add('reading-bg-sepia');
    else if (bg === 'dark') document.body.classList.add('reading-bg-dark');
    localStorage.setItem('comm_win_bg', bg);
  },

  restorePreferences() {
    try {
      const savedZoom = localStorage.getItem('comm_win_zoom');
      if (savedZoom) this.setZoom(parseInt(savedZoom, 10));

      const savedFont = localStorage.getItem('comm_win_font');
      if (savedFont) {
        this.fontFamily = savedFont;
        document.documentElement.style.setProperty('--font-comm', `'${this.fontFamily}', Georgia, serif`);
        document.querySelectorAll('.font-choice-btn').forEach(btn => {
          btn.classList.toggle('active', btn.dataset.font === this.fontFamily);
        });
      }

      const savedBg = localStorage.getItem('comm_win_bg');
      if (savedBg) {
        this.readingBg = savedBg;
        this.applyReadingBg(this.readingBg);
        document.querySelectorAll('.bg-choice-btn').forEach(btn => {
          btn.classList.toggle('active', btn.dataset.bg === this.readingBg);
        });
      }
    } catch (e) {}
  }
};

// Initialisation dès que le DOM est chargé
document.addEventListener('DOMContentLoaded', () => {
  API.init();
  CommentaryWindow.init();
});
