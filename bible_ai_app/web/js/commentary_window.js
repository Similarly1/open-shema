/**
 * Commentary & Companion Study Window Controller
 * Gère le volet d'étude déporté autonome sur 2nd écran ou fenêtre détachée :
 * - 4 Onglets complets : Commentaires, Assistant IA, Lexique Strong, Notes
 * - Redimensionnement matériel fluide aux bordures et aux coins (WS_THICKFRAME Win32)
 * - Synchronisation bidirectionnelle en temps réel avec le texte biblique principal
 * - Zéro émoji, icônes vectorielles SVG épurées
 */

const CommentaryWindow = {
  // Navigation & État actif
  currentBook: 'Gen',
  currentBookFrench: 'Genèse',
  currentChapter: 1,
  currentVerse: 1,
  currentChapterData: null,
  activeAuthorFilter: null,
  activeTab: 'commentaries', // 'commentaries' | 'ai' | 'lexicon' | 'notes'
  isSyncActive: true,
  _currentRequestId: 0,
  channel: null,

  // Paramètres d'affichage
  zoomPercent: 100,
  fontFamily: 'EB Garamond',
  readingBg: 'auto',

  // Cache & Historique
  translationCache: {},
  showTranslatedVersion: {},
  aiChatHistory: [],
  currentLexiconWords: [],
  activeLexiconWordIndex: -1,

  init() {
    // 1. Lire les paramètres d'URL
    try {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('book')) this.currentBook = urlParams.get('book');
      if (urlParams.get('chapter')) this.currentChapter = parseInt(urlParams.get('chapter'), 10) || 1;
      if (urlParams.get('verse')) this.currentVerse = parseInt(urlParams.get('verse'), 10) || 1;
    } catch (e) {}

    // 2. Restaurer l'onglet actif sauvegardé
    try {
      const savedTab = localStorage.getItem('open_shema_comm_active_tab');
      if (savedTab && ['commentaries', 'ai', 'lexicon', 'notes'].includes(savedTab)) {
        this.activeTab = savedTab;
      }
    } catch (e) {}

    this.initBroadcastChannel();
    this.bindEvents();
    this.restorePreferences();
    this.switchTab(this.activeTab);

    // 3. Charger le passage initial
    const startInitialLoad = async () => {
      try {
        const passage = await API.getCurrentPassage();
        if (passage && passage.book) {
          this.currentBook = passage.book;
          this.currentBookFrench = passage.book_french || passage.book;
          this.currentChapter = parseInt(passage.chapter, 10) || 1;
          this.currentVerse = parseInt(passage.verse, 10) || 1;
        }
      } catch (err) {
        console.debug('[CommentaryWindow] getCurrentPassage fallback:', err);
      }
      this.updatePassageDisplay(this.currentBookFrench, this.currentChapter, this.currentVerse);
      this.loadChapterCommentaries(this.currentBook, this.currentChapter);
    };

    API.onReady(() => {
      startInitialLoad();
    });

    if (API.isReady) {
      startInitialLoad();
    } else {
      setTimeout(startInitialLoad, 250);
    }
  },

  initBroadcastChannel() {
    try {
      this.channel = new BroadcastChannel('open_shema_multiwindow');
      this.channel.onmessage = (event) => {
        this.handleMessage(event.data);
      };
      this.channel.postMessage({ type: 'SECONDARY_WINDOW_READY' });
      this.channel.postMessage({ type: 'REQUEST_CURRENT_STATE' });
    } catch (e) {
      console.warn('[CommentaryWindow] BroadcastChannel non supporté:', e);
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
    const ch = parseInt(chapterNum, 10);
    const v = parseInt(verseNum, 10) || 1;
    const isNewChapter = this.currentBook !== bookCode || this.currentChapter !== ch;

    this.currentBook = bookCode;
    this.currentBookFrench = bookFrench || bookCode;
    this.currentChapter = ch;
    this.currentVerse = v;

    this.updatePassageDisplay(this.currentBookFrench, this.currentChapter, this.currentVerse);

    if (isNewChapter || !this.currentChapterData) {
      await this.loadChapterCommentaries(bookCode, this.currentChapter);
    } else {
      this.refreshActiveTab();
    }
  },

  handleVerseChanged(bookCode, chapterNum, verseNum) {
    const ch = parseInt(chapterNum, 10);
    const v = parseInt(verseNum, 10) || 1;

    if (this.currentBook !== bookCode || this.currentChapter !== ch || !this.currentChapterData) {
      this.currentBook = bookCode;
      this.currentChapter = ch;
      this.currentVerse = v;
      this.updatePassageDisplay(this.currentBookFrench, this.currentChapter, this.currentVerse);
      this.loadChapterCommentaries(bookCode, ch);
      return;
    }

    this.currentVerse = v;
    this.updatePassageDisplay(this.currentBookFrench, this.currentChapter, this.currentVerse);
    this.refreshActiveTab();
  },

  updatePassageDisplay(bookName, chapter, verse) {
    const textEl = document.getElementById('comm-win-passage-text');
    if (textEl) {
      textEl.textContent = `${bookName} ${chapter}:${verse || 1}`;
    }
    const noteRefEl = document.getElementById('lbl-note-current-ref');
    if (noteRefEl) {
      noteRefEl.textContent = `${bookName} ${chapter}:${verse || 1}`;
    }
  },

  receiveChapterDataB64(b64Data, targetVerse = 1) {
    try {
      const decodedStr = decodeURIComponent(escape(atob(b64Data)));
      const data = JSON.parse(decodedStr);
      this.receiveChapterData(data, targetVerse);
    } catch (e) {
      console.error('[CommentaryWindow] Erreur de décodage JSON base64:', e);
    }
  },

  receiveChapterData(data, targetVerse = 1) {
    if (!data || !data.verses) return;
    this.currentBook = data.book || this.currentBook;
    this.currentBookFrench = data.book_french || this.currentBookFrench;
    this.currentChapter = parseInt(data.chapter, 10) || this.currentChapter;
    this.currentVerse = parseInt(targetVerse, 10) || this.currentVerse;
    this.currentChapterData = data;

    this.updatePassageDisplay(this.currentBookFrench, this.currentChapter, this.currentVerse);
    this.populateAuthorFilter(data.available_sources || []);
    this.refreshActiveTab();
  },

  async loadChapterCommentaries(bookCode, chapterNum) {
    const reqId = ++this._currentRequestId;
    const container = document.getElementById('comm-stream-container');
    
    if (container && (!this.currentChapterData || this.currentChapter !== parseInt(chapterNum, 10))) {
      container.innerHTML = `
        <div style="text-align: center; padding: 60px 20px; color: var(--text-secondary);">
          <div class="synth-spinner" style="width: 24px; height: 24px; border-width: 2.5px; margin: 0 auto 12px auto;"></div>
          <div style="font-size: 14px; font-weight: 600;">Chargement des commentaires de ${this.currentBookFrench} ${chapterNum}...</div>
        </div>
      `;
    }

    try {
      await API.ensureReady(3000);
      const data = await API.getChapterCommentariesGrouped(bookCode, parseInt(chapterNum, 10));
      
      if (reqId !== this._currentRequestId) return;
      
      if (!data || !data.verses || data.error) {
        throw new Error(data?.error || "Données de commentaires non disponibles");
      }

      this.currentChapterData = data;
      this.currentBookFrench = data.book_french || this.currentBookFrench;
      this.updatePassageDisplay(this.currentBookFrench, this.currentChapter, this.currentVerse);
      this.populateAuthorFilter(data.available_sources || []);
      this.refreshActiveTab();
    } catch (e) {
      if (reqId !== this._currentRequestId) return;
      console.error('[CommentaryWindow] Erreur chargement commentaires:', e);
      if (container) {
        container.innerHTML = `
          <div style="text-align: center; padding: 40px; color: var(--accent-red, #EF4444);">
            <div style="font-size: 15px; font-weight: 700; margin-bottom: 6px;">Impossible de charger les commentaires</div>
            <div style="font-size: 12px; opacity: 0.8; margin-bottom: 14px;">${this.escapeHtml(e.message || String(e))}</div>
            <button type="button" class="comm-win-tool-btn" id="btn-retry-load" style="margin: 0 auto; display: inline-flex;">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6"/><path d="M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
              <span>Réessayer</span>
            </button>
          </div>
        `;
        document.getElementById('btn-retry-load')?.addEventListener('click', () => {
          this.loadChapterCommentaries(bookCode, chapterNum);
        });
      }
    }
  },

  // =========================================================================
  // GESTION DES 4 ONGLETS
  // =========================================================================

  switchTab(tabId) {
    this.activeTab = tabId;
    try {
      localStorage.setItem('open_shema_comm_active_tab', tabId);
    } catch (e) {}

    // Mise à jour de la barre d'onglets
    document.querySelectorAll('.comm-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    // Affichage du bon panneau
    document.querySelectorAll('.comm-tab-panel').forEach(panel => {
      panel.classList.toggle('active', panel.id === `tab-panel-${tabId}`);
    });

    // Afficher le sélecteur d'ouvrages uniquement pour l'onglet Commentaires
    const authorWrap = document.getElementById('comm-author-filter-wrapper');
    if (authorWrap) {
      authorWrap.style.display = tabId === 'commentaries' ? 'block' : 'none';
    }

    this.refreshActiveTab();
  },

  refreshActiveTab() {
    switch (this.activeTab) {
      case 'commentaries':
        if (this.currentChapterData) {
          this.renderCommentaryView(this.currentChapterData);
        }
        break;
      case 'ai':
        this.renderAiChatHeader();
        break;
      case 'lexicon':
        this.loadLexiconForActiveVerse();
        break;
      case 'notes':
        this.loadNotesForActiveVerse();
        break;
    }
  },

  // =========================================================================
  // 1. ONGLET COMMENTAIRES (Verset unique & sélecteur d'ouvrage)
  // =========================================================================

  populateAuthorFilter(sources) {
    const listEl = document.getElementById('author-filter-list');
    const labelEl = document.getElementById('lbl-active-author');
    if (!listEl) return;

    if (sources && sources.length > 0) {
      if (!this.activeAuthorFilter || !sources.includes(this.activeAuthorFilter)) {
        this.activeAuthorFilter = sources[0];
      }
    } else {
      this.activeAuthorFilter = null;
    }

    if (labelEl) {
      labelEl.textContent = this.activeAuthorFilter || 'Aucun ouvrage';
    }

    listEl.innerHTML = '';

    (sources || []).forEach(src => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `comm-win-tool-btn author-filter-item ${this.activeAuthorFilter === src ? 'active' : ''}`;
      btn.dataset.author = src;
      btn.style.width = '100%';
      btn.style.justifyContent = 'flex-start';
      btn.style.textAlign = 'left';
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
        <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${this.escapeHtml(src)}</span>
      `;
      listEl.appendChild(btn);
    });

    listEl.querySelectorAll('.author-filter-item').forEach(btn => {
      btn.addEventListener('click', () => {
        this.setAuthorFilter(btn.dataset.author);
        document.getElementById('author-filter-popover')?.classList.add('hidden');
      });
    });
  },

  setAuthorFilter(author) {
    this.activeAuthorFilter = author;
    const labelEl = document.getElementById('lbl-active-author');
    if (labelEl) {
      labelEl.textContent = author || 'Aucun ouvrage';
    }
    const listEl = document.getElementById('author-filter-list');
    if (listEl) {
      listEl.querySelectorAll('.author-filter-item').forEach(b => {
        b.classList.toggle('active', b.dataset.author === author);
      });
    }
    if (this.currentChapterData) {
      this.renderCommentaryView(this.currentChapterData);
    }
  },

  renderCommentaryView(data) {
    const container = document.getElementById('comm-stream-container');
    if (!container || !data || !data.verses) return;

    if (!this.activeAuthorFilter && data.available_sources && data.available_sources.length > 0) {
      this.activeAuthorFilter = data.available_sources[0];
      const labelEl = document.getElementById('lbl-active-author');
      if (labelEl) {
        labelEl.textContent = this.activeAuthorFilter;
      }
    }

    const currentAuthor = this.activeAuthorFilter;
    const targetVerseNum = parseInt(this.currentVerse, 10) || 1;
    const vObj = data.verses.find(v => v.verse === targetVerseNum) || data.verses[0] || { verse: targetVerseNum, text: '', comments: [] };
    const vNum = vObj.verse;
    const vText = vObj.text || '';
    const allCommentsForVerse = vObj.comments || [];

    let comments = allCommentsForVerse;
    if (currentAuthor) {
      comments = comments.filter(c => c.author === currentAuthor || c.source === currentAuthor);
    }

    const otherAuthorsForVerse = [];
    allCommentsForVerse.forEach(c => {
      const a = c.author || c.source;
      if (a && a !== currentAuthor && !otherAuthorsForVerse.includes(a)) {
        otherAuthorsForVerse.push(a);
      }
    });

    let html = `
      <div class="comm-stream-verse-block active-synced-comm" id="comm-verse-${vNum}" data-verse="${vNum}" style="margin-bottom: 24px; border: none; background: transparent;">
        <div class="comm-verse-quote-banner" data-nav-verse="${vNum}" style="cursor: default;">
          <div class="comm-verse-num-badge">${vNum}</div>
          <div class="comm-verse-quote-text">« ${this.escapeHtml(vText || '...')} »</div>
        </div>
        <div class="comm-verse-cards-list">
    `;

    if (comments.length === 0) {
      html += `
        <div class="comm-stream-card" style="padding: 32px 20px; text-align: center;">
          <div style="font-size: 15px; font-weight: 600; color: var(--text-secondary); margin-bottom: 6px;">
            Aucune note exégétique de « ${this.escapeHtml(currentAuthor || 'cet ouvrage')} » pour ${this.escapeHtml(data.book_french || '')} ${data.chapter}:${vNum}
          </div>
          ${otherAuthorsForVerse.length > 0 ? `
            <div style="font-size: 13px; color: var(--text-secondary); margin-top: 18px; margin-bottom: 10px;">
              Commentaires disponibles pour ce verset :
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 8px; justify-content: center;">
              ${otherAuthorsForVerse.map(auth => `
                <button type="button" class="comm-win-tool-btn btn-quick-switch-author" data-author="${this.escapeHtml(auth)}" style="padding: 6px 12px; font-size: 12px; background: var(--bg-hover);">
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                  <span>${this.escapeHtml(auth)}</span>
                </button>
              `).join('')}
            </div>
          ` : `
            <div style="font-size: 13px; opacity: 0.7; margin-top: 8px;">
              Sélectionnez un autre ouvrage dans le menu supérieur pour consulter d'autres commentaires.
            </div>
          `}
        </div>
      `;
    } else {
      comments.forEach((comm, idx) => {
        const itemId = `comm_${vNum}_${idx}_${(comm.author || 'comm').replace(/[^a-zA-Z0-9]/g, '_')}`;
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
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                  <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
                </svg>
                <span style="font-weight: 700; font-size: 14px;">${this.escapeHtml(comm.author || comm.source || 'Commentaire')}</span>
              </div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="comm-stream-ref-badge">${this.escapeHtml(comm.reference || `${data.book_french} ${data.chapter}:${vNum}`)}</span>
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

    container.innerHTML = html;

    container.querySelectorAll('.btn-quick-switch-author').forEach(btn => {
      btn.addEventListener('click', () => {
        this.setAuthorFilter(btn.dataset.author);
      });
    });

    container.querySelectorAll('.btn-trans-comm').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const itemId = btn.dataset.itemId;
        const rawText = decodeURIComponent(btn.dataset.rawText || '');
        await this.handleTranslateClick(btn, itemId, rawText);
      });
    });
  },

  // =========================================================================
  // 2. ONGLET ASSISTANT IA
  // =========================================================================

  renderAiChatHeader() {
    const text = document.getElementById('comm-win-passage-text')?.textContent || 'Passage en cours';
    const chips = document.getElementById('ai-prompt-chips');
    if (chips) {
      chips.querySelectorAll('.ai-prompt-chip').forEach(chip => {
        chip.onclick = () => {
          this.sendAiMessage(chip.dataset.prompt);
        };
      });
    }
  },

  async sendAiMessage(promptText = null) {
    const inputEl = document.getElementById('ai-chat-input');
    const query = (promptText || inputEl?.value || '').trim();
    if (!query) return;

    if (inputEl && !promptText) inputEl.value = '';

    const messagesStream = document.getElementById('ai-chat-messages');
    if (!messagesStream) return;

    // Bulle utilisateur
    const userMsg = document.createElement('div');
    userMsg.className = 'ai-msg-bubble user';
    userMsg.textContent = query;
    messagesStream.appendChild(userMsg);

    // Bulle de chargement IA
    const aiMsg = document.createElement('div');
    aiMsg.className = 'ai-msg-bubble assistant';
    aiMsg.innerHTML = '<span class="synth-spinner" style="width: 14px; height: 14px; border-width: 2px; vertical-align: middle; margin-right: 6px;"></span>Analyse théologique en cours...';
    messagesStream.appendChild(aiMsg);
    messagesStream.scrollTop = messagesStream.scrollHeight;

    try {
      const response = await API.askAI(query, this.currentBook, this.currentChapter, this.currentVerse);
      const textResult = response?.answer || response?.result || response?.text || (typeof response === 'string' ? response : 'Réponse reçue.');
      aiMsg.innerHTML = this.formatMarkdown(textResult);
    } catch (e) {
      aiMsg.innerHTML = `<span style="color: var(--accent-red, #EF4444);">Erreur lors de la communication avec l'assistant : ${this.escapeHtml(e.message || String(e))}</span>`;
    }

    messagesStream.scrollTop = messagesStream.scrollHeight;
  },

  clearAiChat() {
    const messagesStream = document.getElementById('ai-chat-messages');
    if (messagesStream) {
      messagesStream.innerHTML = `
        <div class="ai-msg-bubble assistant">
          Conversation réinitialisée. Posez une nouvelle question sur ${this.currentBookFrench} ${this.currentChapter}:${this.currentVerse}.
        </div>
      `;
    }
  },

  // =========================================================================
  // 3. ONGLET LEXIQUE STRONG & DICTIONNAIRES
  // =========================================================================

  async loadLexiconForActiveVerse() {
    const wordsFlow = document.getElementById('lex-words-flow');
    const detailEl = document.getElementById('lex-entry-detail');
    if (!wordsFlow) return;

    wordsFlow.innerHTML = '<div style="color: var(--text-secondary); font-size: 13px;"><span class="synth-spinner" style="width: 12px; height: 12px; border-width: 1.5px; vertical-align: middle; margin-right: 6px;"></span>Chargement des racines hébraïques / grecques...</div>';

    try {
      const chData = await API.getChapterData('LSG', this.currentBook, this.currentChapter, 'LSG');
      const vData = (chData?.verses || []).find(v => v.verse === this.currentVerse);

      if (!vData || !vData.text) {
        wordsFlow.innerHTML = '<div style="color: var(--text-secondary); font-size: 13px;">Texte du verset introuvable.</div>';
        return;
      }

      // Découper les mots du verset
      const rawWords = vData.text.split(/[\s,;:«»'".()]+/g).filter(w => w.length > 1);
      wordsFlow.innerHTML = '';

      rawWords.forEach((word, idx) => {
        const pill = document.createElement('button');
        pill.type = 'button';
        pill.className = `lex-word-pill ${idx === 0 ? 'active' : ''}`;
        pill.innerHTML = `
          <span class="lex-word-orig">${this.escapeHtml(word)}</span>
          <span class="lex-word-trans">Mot ${idx + 1}</span>
        `;
        pill.addEventListener('click', () => {
          wordsFlow.querySelectorAll('.lex-word-pill').forEach(p => p.classList.remove('active'));
          pill.classList.add('active');
          this.lookupLexiconEntry(word);
        });
        wordsFlow.appendChild(pill);
      });

      if (rawWords.length > 0) {
        this.lookupLexiconEntry(rawWords[0]);
      }
    } catch (e) {
      wordsFlow.innerHTML = `<div style="color: var(--accent-red);">Erreur lexique : ${this.escapeHtml(e.message || String(e))}</div>`;
    }
  },

  async lookupLexiconEntry(word) {
    const detailEl = document.getElementById('lex-entry-detail');
    if (!detailEl) return;

    detailEl.innerHTML = `<div style="padding: 20px; color: var(--text-secondary); text-align: center;"><span class="synth-spinner" style="width: 14px; height: 14px; border-width: 2px; vertical-align: middle; margin-right: 6px;"></span>Recherche dans les dictionnaires Strong & Bailly pour « ${this.escapeHtml(word)} »...</div>`;

    try {
      const entry = await API.call('lookup_dictionary', word, null);
      const matches = entry?.matches || [];

      if (matches.length === 0) {
        detailEl.innerHTML = `
          <div style="padding: 24px; text-align: center; color: var(--text-secondary);">
            <div style="font-size: 14px; font-weight: 600; margin-bottom: 4px;">« ${this.escapeHtml(word)} »</div>
            <div style="font-size: 12px; opacity: 0.8;">Aucune entrée exacte dans le lexique pour cette forme fléchie.</div>
          </div>
        `;
        return;
      }

      let html = `<div style="display: flex; flex-direction: column; gap: 14px;">`;
      matches.forEach(m => {
        html += `
          <div style="border-bottom: 1px solid var(--border-color, rgba(255,255,255,0.08)); padding-bottom: 12px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
              <span style="font-weight: 700; font-size: 15px; color: var(--accent-orange, #F97316);">${this.escapeHtml(m.lemma || word)}</span>
              <span style="font-size: 11px; background: var(--bg-hover); padding: 2px 7px; border-radius: 4px;">${this.escapeHtml(m.source || 'Lexique')}</span>
            </div>
            ${m.strong ? `<div style="font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--accent-blue); margin-bottom: 6px;">Strong: ${this.escapeHtml(m.strong)}</div>` : ''}
            <div style="font-size: 14px; line-height: 1.6; color: var(--text-primary);">${this.formatMarkdown(m.definition || m.content || '')}</div>
          </div>
        `;
      });
      html += `</div>`;
      detailEl.innerHTML = html;
    } catch (e) {
      detailEl.innerHTML = `<div style="color: var(--accent-red); padding: 20px;">Erreur de consultation lexicale.</div>`;
    }
  },

  // =========================================================================
  // 4. ONGLET NOTES D'ÉTUDE
  // =========================================================================

  loadNotesForActiveVerse() {
    const key = `note_${this.currentBook}_${this.currentChapter}_${this.currentVerse}`;
    const textarea = document.getElementById('note-editor-textarea');
    if (!textarea) return;

    try {
      const savedNote = localStorage.getItem(key) || '';
      textarea.value = savedNote;
    } catch (e) {
      textarea.value = '';
    }
  },

  saveCurrentNote() {
    const key = `note_${this.currentBook}_${this.currentChapter}_${this.currentVerse}`;
    const textarea = document.getElementById('note-editor-textarea');
    if (!textarea) return;

    try {
      localStorage.setItem(key, textarea.value);
      const saveBtn = document.getElementById('btn-save-note');
      if (saveBtn) {
        saveBtn.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg><span>Enregistré !</span>';
        setTimeout(() => {
          saveBtn.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline></svg><span>Enregistrer</span>';
        }, 1500);
      }
    } catch (e) {
      console.error('Erreur sauvegarde note:', e);
    }
  },

  // =========================================================================
  // ÉVÉNEMENTS & TRADUCTION
  // =========================================================================

  bindEvents() {
    // 1. Clic sur les onglets
    document.querySelectorAll('.comm-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.switchTab(btn.dataset.tab);
      });
    });

    // 2. Assistant IA Input & Send
    const sendBtn = document.getElementById('btn-send-ai-chat');
    const inputEl = document.getElementById('ai-chat-input');
    sendBtn?.addEventListener('click', () => this.sendAiMessage());
    inputEl?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendAiMessage();
      }
    });
    document.getElementById('btn-clear-ai-chat')?.addEventListener('click', () => this.clearAiChat());

    // 3. Notes Save
    document.getElementById('btn-save-note')?.addEventListener('click', () => this.saveCurrentNote());

    // 4. Popover Auteurs
    const btnAuthor = document.getElementById('btn-author-filter');
    const popoverAuthor = document.getElementById('author-filter-popover');
    btnAuthor?.addEventListener('click', (e) => {
      e.stopPropagation();
      popoverAuthor?.classList.toggle('hidden');
      document.getElementById('comm-display-popover')?.classList.add('hidden');
    });

    // 5. Popover Affichage
    const btnDisplay = document.getElementById('btn-comm-display');
    const popoverDisplay = document.getElementById('comm-display-popover');
    btnDisplay?.addEventListener('click', (e) => {
      e.stopPropagation();
      popoverDisplay?.classList.toggle('hidden');
      popoverAuthor?.classList.add('hidden');
    });

    document.addEventListener('click', (e) => {
      if (popoverAuthor && !popoverAuthor.contains(e.target) && e.target !== btnAuthor) {
        popoverAuthor.classList.add('hidden');
      }
      if (popoverDisplay && !popoverDisplay.contains(e.target) && e.target !== btnDisplay) {
        popoverDisplay.classList.add('hidden');
      }
    });

    // 6. Options d'affichage (Zoom, Police, Fond)
    document.getElementById('btn-zoom-in')?.addEventListener('click', () => this.adjustZoom(10));
    document.getElementById('btn-zoom-out')?.addEventListener('click', () => this.adjustZoom(-10));

    document.querySelectorAll('.font-choice-btn').forEach(b => {
      b.addEventListener('click', () => {
        document.querySelectorAll('.font-choice-btn').forEach(btn => btn.classList.remove('active'));
        b.classList.add('active');
        this.setFontFamily(b.dataset.font);
      });
    });

    document.querySelectorAll('.bg-choice-btn').forEach(b => {
      b.addEventListener('click', () => {
        document.querySelectorAll('.bg-choice-btn').forEach(btn => btn.classList.remove('active'));
        b.classList.add('active');
        this.setReadingBg(b.dataset.bg);
      });
    });

    // 7. Contrôles Fenêtre
    document.getElementById('btn-win-min')?.addEventListener('click', () => API.minimizeCommentaryWindow());
    document.getElementById('btn-win-max')?.addEventListener('click', () => API.maximizeCommentaryWindow());
    document.getElementById('btn-win-close')?.addEventListener('click', () => API.closeCommentaryWindow());

    // Double-clic sur la barre de titre pour maximiser/restaurer
    document.getElementById('comm-win-titlebar')?.addEventListener('dblclick', (e) => {
      if (e.target.closest('button') || e.target.closest('input') || e.target.closest('select')) return;
      API.maximizeCommentaryWindow();
    });

    // 8. Bascule de synchronisation
    document.getElementById('comm-win-sync-badge')?.addEventListener('click', () => {
      this.isSyncActive = !this.isSyncActive;
      const badge = document.getElementById('comm-win-sync-badge');
      const label = document.getElementById('comm-win-sync-label');
      if (badge) {
        badge.className = `comm-win-sync-indicator ${this.isSyncActive ? 'synced' : 'paused'}`;
      }
      if (label) {
        label.textContent = this.isSyncActive ? 'Lié' : 'Délié';
      }
    });
  },

  updateMaximizedState(isMaximized) {
    const maxBtn = document.getElementById('btn-win-max');
    if (maxBtn) {
      maxBtn.title = isMaximized ? "Restaurer" : "Agrandir / Plein écran";
    }
  },

  async handleTranslateClick(btn, itemId, rawText) {
    if (this.translationCache[itemId]) {
      this.showTranslatedVersion[itemId] = !this.showTranslatedVersion[itemId];
      if (this.currentChapterData) this.renderCommentaryView(this.currentChapterData);
      return;
    }

    btn.disabled = true;
    btn.innerHTML = `<span class="synth-spinner" style="width: 10px; height: 10px; border-width: 1.5px; vertical-align: middle; margin-right: 4px;"></span><span>Traduction...</span>`;

    try {
      const res = await API.translateText(rawText, 'commentary', itemId);
      if (res && res.success && res.translated_text) {
        this.translationCache[itemId] = res.translated_text;
        this.showTranslatedVersion[itemId] = true;
        if (this.currentChapterData) this.renderCommentaryView(this.currentChapterData);
      } else {
        alert(res?.error || 'Erreur lors de la traduction.');
      }
    } catch (e) {
      console.error('Erreur traduction:', e);
      alert('Impossible de traduire le texte.');
    } finally {
      btn.disabled = false;
    }
  },

  // =========================================================================
  // FORMATAGE & PRÉFÉRENCES
  // =========================================================================

  adjustZoom(delta) {
    this.zoomPercent = Math.max(70, Math.min(180, this.zoomPercent + delta));
    const lbl = document.getElementById('lbl-zoom-val');
    if (lbl) lbl.textContent = `${this.zoomPercent}%`;
    document.documentElement.style.setProperty('--comm-zoom', `${this.zoomPercent / 100}`);
    document.body.style.fontSize = `${14 * (this.zoomPercent / 100)}px`;
    try { localStorage.setItem('comm_win_zoom', String(this.zoomPercent)); } catch (e) {}
  },

  setFontFamily(font) {
    this.fontFamily = font;
    document.documentElement.style.setProperty('--font-reading', `'${font}', Georgia, serif`);
    try { localStorage.setItem('comm_win_font', font); } catch (e) {}
  },

  setReadingBg(theme) {
    this.readingBg = theme;
    const body = document.body;
    body.classList.remove('bg-theme-white', 'bg-theme-sepia', 'bg-theme-dark');
    if (theme === 'white') body.classList.add('bg-theme-white');
    if (theme === 'sepia') body.classList.add('bg-theme-sepia');
    if (theme === 'dark') body.classList.add('bg-theme-dark');
    try { localStorage.setItem('comm_win_bg', theme); } catch (e) {}
  },

  restorePreferences() {
    try {
      const z = localStorage.getItem('comm_win_zoom');
      if (z) this.adjustZoom(parseInt(z, 10) - 100);

      const f = localStorage.getItem('comm_win_font');
      if (f) {
        this.setFontFamily(f);
        document.querySelectorAll('.font-choice-btn').forEach(b => b.classList.toggle('active', b.dataset.font === f));
      }

      const bg = localStorage.getItem('comm_win_bg');
      if (bg) {
        this.setReadingBg(bg);
        document.querySelectorAll('.bg-choice-btn').forEach(b => b.classList.toggle('active', b.dataset.bg === bg));
      }
    } catch (e) {}
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
      .replace(/^### (.*$)/gim, '<h3 style="margin: 14px 0 6px 0; font-size: 15px; font-weight: 700; color: var(--accent-blue);">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 style="margin: 16px 0 8px 0; font-size: 17px; font-weight: 700; color: var(--accent-blue);">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 style="margin: 18px 0 10px 0; font-size: 19px; font-weight: 800; color: var(--accent-blue);">$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/^\> (.*$)/gim, '<blockquote style="border-left: 3px solid var(--accent-blue); padding: 8px 12px; margin: 10px 0; background: var(--bg-hover); border-radius: 0 6px 6px 0; font-style: italic;">$1</blockquote>')
      .split(/\n\n+/)
      .map(p => p.trim())
      .filter(Boolean)
      .map(p => (p.startsWith('<h') || p.startsWith('<blockquote')) ? p : `<p style="margin: 0 0 12px 0; line-height: 1.75;">${p}</p>`)
      .join('');
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

window.CommentaryWindow = CommentaryWindow;

// Initialisation dès que le DOM est chargé
document.addEventListener('DOMContentLoaded', () => {
  API.init();
  CommentaryWindow.init();
});
