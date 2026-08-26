/**
 * Commentary & Companion Study Window Controller
 * Gère le volet d'étude déporté autonome sur 2nd écran ou fenêtre détachée :
 * - 5 Onglets complets : Aperçu 360°, Commentaires exégétiques, Assistant IA, Lexique Strong, Notes d'étude
 * - Sélecteur riche d'ouvrages avec badges théologiques, recherche et mini-avatars
 * - Panneau de Synthèse Exégétique IA multi-versets
 * - Navigation par verset < >, saut de référence indépendant et synchronisation bidirectionnelle
 * - Redimensionnement matériel fluide (WS_THICKFRAME Win32)
 * - 100% SVG purs, zéro émoji
 */

const CommentaryWindow = {
  // Navigation & État actif
  currentBook: 'Gen',
  currentBookFrench: 'Genèse',
  currentChapter: 1,
  currentVerse: 1,
  currentChapterData: null,
  activeAuthorFilter: null,
  activeTab: 'overview', // 'overview' | 'commentaries' | 'ai' | 'lexicon' | 'notes'
  isSyncActive: true,
  _currentRequestId: 0,
  channel: null,

  // Paramètres d'affichage
  zoomPercent: 100,
  fontFamily: 'EB Garamond',
  readingBg: 'auto',

  // Synthèse IA
  synthVerseStart: 1,
  synthVerseEnd: 1,
  synthMaxLimit: 5,
  latestSynthesisMarkdown: '',

  // Cache & Historique
  translationCache: {},
  showTranslatedVersion: {},
  aiChatHistory: [],
  aiSessionId: null,
  currentLexiconWords: [],
  activeLexiconWordIndex: -1,

  // Catalogue complet des commentateurs & théologiens
  commentaryCatalog: {
    "adam clarke": { title: "Commentaire Biblique de Adam Clarke", author: "Adam Clarke (1760–1832)", period: "Méthodiste & Historique (1832)", color: "#991B1B", initials: "AC" },
    "calvin": { title: "Commentaires de Jean Calvin", author: "Jean Calvin (1509–1564)", period: "Réforme Protestante (1560)", color: "#1E40AF", initials: "JC" },
    "matthew henry": { title: "Commentaire Biblique de Matthew Henry", author: "Matthew Henry (1662–1714)", period: "Puritain / Dévotionnel (1710)", color: "#065F46", initials: "MH" },
    "pulpit": { title: "The Pulpit Commentary", author: "H.D.M. Spence & Joseph S. Exell", period: "The Pulpit Commentary (1890)", color: "#3730A3", initials: "PC" },
    "scofield": { title: "Notes Bibliques de Scofield", author: "C.I. Scofield (1843–1921)", period: "Dispensationaliste (1909)", color: "#334155", initials: "CIS" },
    "arnot": { title: "Commentaire Pratique de William Arnot", author: "William Arnot (1808–1875)", period: "Église Libre d'Écosse (1870)", color: "#7C2D12", initials: "WA" },
    "darby": { title: "Études sur la Parole de J.N. Darby", author: "John Nelson Darby (1800–1882)", period: "Frères de Plymouth (1880)", color: "#475569", initials: "JND" },
    "bonnet": { title: "Nouveau Testament avec Notes de Louis Bonnet", author: "Louis Bonnet", period: "Notes Pastorales (1885)", color: "#0891B2", initials: "LB" },
    "acg": { title: "Bible annotée par A.C. Gaebelein", author: "Arno C. Gaebelein", period: "The Annotated Bible (1922)", color: "#475569", initials: "ACG" },
    "gaebelein": { title: "Bible annotée par A.C. Gaebelein", author: "Arno C. Gaebelein", period: "The Annotated Bible (1922)", color: "#475569", initials: "ACG" },
    "godet": { title: "Bible annotée (Frédéric Godet & Neuchâtel)", author: "Frédéric Godet et collaborateurs", period: "Bible Annotée de Neuchâtel (1899)", color: "#0D9488", initials: "BAG" },
    "frédéric godet": { title: "Bible annotée (Frédéric Godet & Neuchâtel)", author: "Frédéric Godet et collaborateurs", period: "Bible Annotée de Neuchâtel (1899)", color: "#0D9488", initials: "BAG" },
    "bible annotée": { title: "Bible annotée (Frédéric Godet & Neuchâtel)", author: "Frédéric Godet et collaborateurs", period: "Bible Annotée de Neuchâtel (1899)", color: "#0D9488", initials: "BAG" },
    "tgc": { title: "Commentaires The Gospel Coalition (TGC)", author: "The Gospel Coalition", period: "The Gospel Coalition (2021-2024)", color: "#9A3412", initials: "TGC" },
    "the gospel coalition": { title: "Commentaires The Gospel Coalition (TGC)", author: "The Gospel Coalition", period: "The Gospel Coalition (2021-2024)", color: "#9A3412", initials: "TGC" },
    "john gill": { title: "Exposition of the Bible de John Gill", author: "John Gill (1697–1771)", period: "Exposition of the Bible (1763)", color: "#047857", initials: "JG" },
    "albert barnes": { title: "Notes on the Bible de Albert Barnes", author: "Albert Barnes (1798–1870)", period: "Notes on the Old & New Testament (1884)", color: "#1D4ED8", initials: "AB" }
  },

  bookFrenchMap: {
    'Gen': 'Genèse', 'Exo': 'Exode', 'Lev': 'Lévitique', 'Num': 'Nombres', 'Deu': 'Deutéronome',
    'Jos': 'Josué', 'Jug': 'Juges', 'Rut': 'Ruth', '1Sa': '1 Samuel', '2Sa': '2 Samuel',
    '1Ro': '1 Rois', '2Ro': '2 Rois', '1Ch': '1 Chroniques', '2Ch': '2 Chroniques',
    'Esd': 'Esdras', 'Nee': 'Néhémie', 'Est': 'Esther', 'Job': 'Job', 'Psa': 'Psaumes',
    'Pro': 'Proverbes', 'Ecc': 'Ecclésiaste', 'Can': 'Cantique des Cantiques', 'Esa': 'Ésaïe',
    'Jer': 'Jérémie', 'Lam': 'Lamentations', 'Eze': 'Ézéchiel', 'Dan': 'Daniel',
    'Ose': 'Osée', 'Joe': 'Joël', 'Amo': 'Amos', 'Abd': 'Abdias', 'Jon': 'Jonas',
    'Mic': 'Michée', 'Nah': 'Nahum', 'Hab': 'Habacuc', 'Soz': 'Sophonie', 'Agg': 'Aggée',
    'Zac': 'Zacharie', 'Mal': 'Malachie', 'Mat': 'Matthieu', 'Mar': 'Marc', 'Luc': 'Luc',
    'Jea': 'Jean', 'Act': 'Actes', 'Rom': 'Romains', '1Co': '1 Corinthiens', '2Co': '2 Corinthiens',
    'Gal': 'Galates', 'Eph': 'Éphésiens', 'Phi': 'Philippiens', 'Col': 'Colossiens',
    '1Th': '1 Thessaloniciens', '2Th': '2 Thessaloniciens', '1Ti': '1 Timothée', '2Ti': '2 Timothée',
    'Tit': 'Tite', 'Phm': 'Philémon', 'Heb': 'Hébreux', 'Jac': 'Jacques',
    '1Pi': '1 Pierre', '2Pi': '2 Pierre', '1Jn': '1 Jean', '2Jn': '2 Jean', '3Jn': '3 Jean',
    'Jud': 'Jude', 'Apo': 'Apocalypse'
  },

  getSourceInfo(name) {
    if (!name) return { title: 'Commentaire Biblique', author: 'Auteur', period: 'Source d\'étude', color: '#1E293B', initials: 'BIB' };
    const clean = name.trim().toLowerCase().replace(/[\[\]]/g, '');
    if (this.commentaryCatalog[clean]) return this.commentaryCatalog[clean];
    for (const [k, v] of Object.entries(this.commentaryCatalog)) {
      if (clean.includes(k) || k.includes(clean)) return v;
    }
    const initials = name.split(/\s+/).map(w => w[0]).filter(Boolean).join('').slice(0, 3).toUpperCase() || 'BIB';
    const trimmed = name.trim();
    const title = (trimmed.toLowerCase().startsWith('commentaire') || trimmed.toLowerCase().startsWith('notes') || trimmed.toLowerCase().startsWith('bible'))
      ? trimmed
      : `Commentaire de ${trimmed}`;
    return {
      title: title,
      author: name,
      period: "Ouvrage de référence",
      color: "#2563EB",
      initials: initials
    };
  },

  init() {
    // 1. Lire les paramètres d'URL synchrones (disponibles à 0ms)
    try {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('book')) this.currentBook = urlParams.get('book');
      if (urlParams.get('chapter')) this.currentChapter = parseInt(urlParams.get('chapter'), 10) || 1;
      if (urlParams.get('verse')) this.currentVerse = parseInt(urlParams.get('verse'), 10) || 1;
    } catch (e) {}

    this.currentBookFrench = this.bookFrenchMap[this.currentBook] || this.currentBook;

    // 2. Restaurer l'onglet actif sauvegardé
    try {
      const savedTab = localStorage.getItem('open_shema_comm_active_tab');
      if (savedTab && ['overview', 'commentaries', 'ai', 'lexicon', 'notes'].includes(savedTab)) {
        this.activeTab = savedTab;
      }
    } catch (e) {}

    this.initBroadcastChannel();
    this.bindEvents();
    this.restorePreferences();

    // Mettre à jour l'affichage immédiatement de manière synchrone (0ms)
    this.updatePassageDisplay(this.currentBookFrench, this.currentChapter, this.currentVerse);
    const subLabel = document.getElementById('comm-skeleton-sublabel');
    if (subLabel) {
      subLabel.textContent = `${this.currentBookFrench} ${this.currentChapter}:${this.currentVerse}`;
    }

    // 3. Initialiser le contrôleur de l'Aperçu
    if (typeof PassageOverviewDrawer !== 'undefined' && PassageOverviewDrawer.init) {
      PassageOverviewDrawer.init();
      PassageOverviewDrawer.switchTab = (tabId) => this.switchTab(tabId);
    }

    this.switchTab(this.activeTab);

    // 4. Charger les données du passage
    const startInitialLoad = async () => {
      this.loadAllPassageData(this.currentBook, this.currentChapter, this.currentVerse);
    };

    if (API.isReady) {
      startInitialLoad();
    } else {
      API.onReady(() => {
        startInitialLoad();
      });
      setTimeout(startInitialLoad, 80);
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

    this.currentBook = bookCode;
    this.currentBookFrench = bookFrench || this.bookFrenchMap[bookCode] || bookCode;
    this.currentChapter = ch;
    this.currentVerse = v;

    this.updatePassageDisplay(this.currentBookFrench, this.currentChapter, this.currentVerse);
    await this.loadAllPassageData(bookCode, this.currentChapter, this.currentVerse);
  },

  handleVerseChanged(bookCode, chapterNum, verseNum) {
    const ch = parseInt(chapterNum, 10);
    const v = parseInt(verseNum, 10) || 1;

    this.currentBook = bookCode;
    this.currentChapter = ch;
    this.currentVerse = v;
    this.currentBookFrench = this.bookFrenchMap[bookCode] || this.currentBookFrench;
    this.updatePassageDisplay(this.currentBookFrench, this.currentChapter, this.currentVerse);

    if (this.currentChapterData && this.currentChapterData.chapter === ch && this.currentChapterData.book === bookCode) {
      this.refreshActiveTab();
    } else {
      this.loadAllPassageData(bookCode, ch, v);
    }
  },

  updatePassageDisplay(bookName, chapter, verse) {
    const textEl = document.getElementById('comm-win-passage-label');
    if (textEl) {
      textEl.textContent = `${bookName} ${chapter}:${verse || 1}`;
    }
    const commRefBadge = document.getElementById('comm-selected-verse-text');
    if (commRefBadge) {
      commRefBadge.textContent = `${bookName} ${chapter}:${verse || 1}`;
    }
    const overviewRef = document.getElementById('overview-passage-ref');
    if (overviewRef) {
      overviewRef.textContent = `${bookName} ${chapter}:${verse || 1}`;
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
    this.currentBookFrench = data.book_french || this.bookFrenchMap[this.currentBook] || this.currentBookFrench;
    this.currentChapter = parseInt(data.chapter, 10) || this.currentChapter;
    this.currentVerse = parseInt(targetVerse, 10) || this.currentVerse;
    this.currentChapterData = data;

    this.updatePassageDisplay(this.currentBookFrench, this.currentChapter, this.currentVerse);
    this.refreshActiveTab();
  },

  renderSkeleton(bookFrench, chapterNum) {
    return `
      <div class="comm-skeleton-wrap comm-fade-in">
        <div class="comm-skeleton-header">
          <div class="comm-skeleton-spinner-box">
            <div class="comm-loader-orb"></div>
            <div>
              <div style="font-size: 13.5px; font-weight: 700; color: #38BDF8; letter-spacing: 0.2px;">Chargement des commentaires exégétiques...</div>
              <div style="font-size: 11.5px; color: #94A3B8; margin-top: 2px;">${this.escapeHtml(bookFrench)} ${chapterNum}</div>
            </div>
          </div>
          <div class="comm-skeleton-shimmer" style="width: 80px; height: 24px; border-radius: 6px;"></div>
        </div>

        <div class="comm-skeleton-card">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <div class="comm-skeleton-shimmer" style="width: 190px; height: 16px;"></div>
            <div class="comm-skeleton-shimmer" style="width: 70px; height: 14px;"></div>
          </div>
          <div class="comm-skeleton-shimmer comm-skeleton-line" style="width: 92%;"></div>
          <div class="comm-skeleton-shimmer comm-skeleton-line" style="width: 98%;"></div>
          <div class="comm-skeleton-shimmer comm-skeleton-line" style="width: 78%;"></div>
        </div>
      </div>
    `;
  },

  async loadAllPassageData(bookCode, chapterNum, verseNum = 1) {
    const reqId = ++this._currentRequestId;
    const frenchName = this.bookFrenchMap[bookCode] || this.currentBookFrench || bookCode;

    // 1. Charger l'Aperçu 360°
    if (typeof PassageOverviewDrawer !== 'undefined' && PassageOverviewDrawer.load) {
      PassageOverviewDrawer.load(bookCode, chapterNum, verseNum, 'LSG', true);
    }

    // 2. Charger les Commentaires
    try {
      await API.ensureReady(800);
      const data = await API.getChapterCommentariesGrouped(bookCode, parseInt(chapterNum, 10));
      
      if (reqId !== this._currentRequestId) return;
      
      if (!data || !data.verses || data.error) {
        throw new Error(data?.error || "Données de commentaires non disponibles");
      }

      this.currentChapterData = data;
      this.currentBookFrench = data.book_french || frenchName;
      this.updatePassageDisplay(this.currentBookFrench, this.currentChapter, this.currentVerse);
      this.refreshActiveTab();
    } catch (e) {
      if (reqId !== this._currentRequestId) return;
      console.error('[CommentaryWindow] Erreur chargement commentaires:', e);
      const container = document.getElementById('comm-stream-container');
      if (container) {
        container.innerHTML = `
          <div class="comm-fade-in" style="text-align: center; padding: 40px; color: #EF4444;">
            <div style="font-size: 15px; font-weight: 700; margin-bottom: 6px;">Impossible de charger les commentaires</div>
            <div style="font-size: 12px; opacity: 0.8; margin-bottom: 14px;">${this.escapeHtml(e.message || String(e))}</div>
            <button type="button" class="comm-win-tool-btn" id="btn-retry-load" style="margin: 0 auto; display: inline-flex;">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6"/><path d="M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
              <span>Réessayer</span>
            </button>
          </div>
        `;
        document.getElementById('btn-retry-load')?.addEventListener('click', () => {
          this.loadAllPassageData(bookCode, chapterNum, verseNum);
        });
      }
    }
  },

  // =========================================================================
  // GESTION DES 5 ONGLETS
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

    this.refreshActiveTab();
  },

  refreshActiveTab() {
    switch (this.activeTab) {
      case 'overview':
        if (typeof PassageOverviewDrawer !== 'undefined' && PassageOverviewDrawer.load) {
          PassageOverviewDrawer.load(this.currentBook, this.currentChapter, this.currentVerse, 'LSG', true);
        }
        break;
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
  // 1. ONGLET COMMENTAIRES (RÉPLIQUE CONFORME DU VOLET DROIT)
  // =========================================================================

  renderCommentaryView(data) {
    const container = document.getElementById('comm-stream-container');
    if (!container || !data || !data.verses) return;

    const targetVerseNum = parseInt(this.currentVerse, 10) || 1;
    const vObj = data.verses.find(v => v.verse === targetVerseNum) || data.verses[0] || { verse: targetVerseNum, text: '', comments: [] };
    const vNum = vObj.verse;
    const vText = vObj.text || '';
    const allCommentsForVerse = vObj.comments || [];

    // Mettre à jour le sélecteur d'ouvrages et son popover
    this.updateCommentarySourcesPopover(allCommentsForVerse);

    // Déterminer le commentaire actif
    let activeComment = null;
    if (this.activeAuthorFilter) {
      activeComment = allCommentsForVerse.find(c => (c.author === this.activeAuthorFilter || c.source === this.activeAuthorFilter));
    }
    if (!activeComment && allCommentsForVerse.length > 0) {
      activeComment = allCommentsForVerse[0];
      this.activeAuthorFilter = activeComment.author || activeComment.source;
    }

    // Mettre à jour le libellé du bouton sélecteur
    const btnLabel = document.getElementById('lbl-active-comm-source');
    const badgeCount = document.getElementById('lbl-comm-source-count');
    if (btnLabel) {
      const sourceMeta = this.getSourceInfo(this.activeAuthorFilter);
      btnLabel.textContent = sourceMeta.title || this.activeAuthorFilter || 'Sélectionner un commentaire';
    }
    if (badgeCount) {
      badgeCount.textContent = allCommentsForVerse.length;
    }

    let html = `
      <div class="comm-stream-verse-block active-synced-comm comm-fade-in" id="comm-verse-${vNum}" data-verse="${vNum}">
        <div class="comm-verse-quote-banner" data-nav-verse="${vNum}">
          <div class="comm-verse-num-badge">${vNum}</div>
          <div class="comm-verse-quote-text">« ${this.escapeHtml(vText || '...')} »</div>
        </div>
    `;

    if (!activeComment) {
      html += `
        <div class="comm-stream-card" style="padding: 36px 20px; text-align: center;">
          <div style="font-size: 15px; font-weight: 600; color: #94A3B8; margin-bottom: 6px;">
            Aucune note exégétique disponible pour ${this.escapeHtml(data.book_french || '')} ${data.chapter}:${vNum}
          </div>
          <div style="font-size: 13px; opacity: 0.7; margin-top: 8px;">
            Sélectionnez un autre verset avec les flèches supérieures ou choisissez un ouvrage dans le menu.
          </div>
        </div>
      `;
    } else {
      const comm = activeComment;
      const authorName = comm.author || comm.source || 'Commentaire';
      const sourceMeta = this.getSourceInfo(authorName);
      const itemId = `comm_${vNum}_${authorName.replace(/[^a-zA-Z0-9]/g, '_')}`;
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
              <span class="comm-single-author-avatar" style="background-color: ${sourceMeta.color || '#1E3A8A'};">${sourceMeta.initials || 'C'}</span>
              <span style="font-weight: 700; font-size: 14.5px;">${this.escapeHtml(sourceMeta.title || authorName)}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="comm-stream-ref-badge">${this.escapeHtml(comm.reference || `${data.book_french} ${data.chapter}:${vNum}`)}</span>
              ${isForeign ? `
                <button type="button" class="comm-win-tool-btn btn-trans-comm" data-item-id="${itemId}" data-raw-text="${encodeURIComponent(comm.text)}" style="height: 24px; font-size: 11.5px; padding: 2px 8px;">
                  <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                  <span>${cachedTrans ? (isShowingTranslated ? 'Original' : 'Traduction') : 'Traduire'}</span>
                </button>
              ` : ''}
              <button type="button" class="comm-win-tool-btn btn-export-comm-note" data-author="${this.escapeHtml(authorName)}" data-ref="${this.escapeHtml(data.book_french)} ${data.chapter}:${vNum}" style="height: 24px; font-size: 11.5px; padding: 2px 8px;">
                <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                <span>Vers note</span>
              </button>
            </div>
          </div>
          <div class="comm-stream-body">${formattedText}</div>
        </article>
      `;

      // Liste des autres commentaires disponibles pour ce verset sous forme de raccourcis rapides
      const otherComments = allCommentsForVerse.filter(c => (c.author || c.source) !== authorName);
      if (otherComments.length > 0) {
        html += `
          <div style="margin-top: 20px; padding: 14px 18px; background: rgba(30, 41, 59, 0.5); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px;">
            <div style="font-size: 12.5px; font-weight: 600; color: #94A3B8; margin-bottom: 10px;">
              Autres commentaires pour ce verset (${otherComments.length}) :
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 8px;">
              ${otherComments.map(c => {
                const a = c.author || c.source;
                const m = this.getSourceInfo(a);
                return `
                  <button type="button" class="comm-win-tool-btn btn-quick-switch-author" data-author="${this.escapeHtml(a)}" style="padding: 6px 10px; font-size: 12px; background: #1E293B;">
                    <span class="comm-single-author-avatar" style="width: 18px; height: 18px; font-size: 8.5px; background-color: ${m.color || '#1E3A8A'};">${m.initials || 'C'}</span>
                    <span>${this.escapeHtml(m.title || a)}</span>
                  </button>
                `;
              }).join('')}
            </div>
          </div>
        `;
      }
    }

    html += `</div>`;
    container.innerHTML = html;

    // Liaison des événements dans la carte
    container.querySelectorAll('.btn-quick-switch-author').forEach(btn => {
      btn.addEventListener('click', () => {
        this.selectCommentarySource(btn.dataset.author);
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

    container.querySelectorAll('.btn-export-comm-note').forEach(btn => {
      btn.addEventListener('click', () => {
        const textContent = container.querySelector('.comm-stream-body')?.textContent || '';
        this.exportToNote(btn.dataset.ref, btn.dataset.author, textContent);
      });
    });
  },

  updateCommentarySourcesPopover(comments) {
    const listEl = document.getElementById('comm-sources-list');
    const countEl = document.getElementById('comm-popover-count');
    if (!listEl) return;

    listEl.innerHTML = '';
    const count = (comments || []).length;
    if (countEl) countEl.textContent = count;

    if (count === 0) {
      listEl.innerHTML = '<div style="padding: 12px; color: #94A3B8; font-size: 12px; text-align: center;">Aucun commentaire indexé pour ce verset.</div>';
      return;
    }

    comments.forEach(c => {
      const authorName = c.author || c.source;
      const sourceMeta = this.getSourceInfo(authorName);
      const isActive = this.activeAuthorFilter === authorName;

      const item = document.createElement('button');
      item.type = 'button';
      item.className = `comm-source-item ${isActive ? 'active' : ''}`;
      item.dataset.author = authorName;
      item.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; min-width: 0;">
          <span class="comm-single-author-avatar" style="background-color: ${sourceMeta.color || '#1E3A8A'};">${sourceMeta.initials || 'C'}</span>
          <span style="font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${this.escapeHtml(sourceMeta.title || authorName)}</span>
        </div>
        <span class="comm-source-item-meta" style="font-size: 11px; color: #94A3B8; white-space: nowrap;">${this.escapeHtml(sourceMeta.period ? sourceMeta.period.split('(')[0].trim() : '')}</span>
      `;

      item.addEventListener('click', () => {
        this.selectCommentarySource(authorName);
        document.getElementById('comm-sources-popover')?.classList.add('hidden');
      });

      listEl.appendChild(item);
    });
  },

  selectCommentarySource(authorName) {
    this.activeAuthorFilter = authorName;
    try {
      localStorage.setItem('open_shema_preferred_author', authorName);
    } catch (e) {}
    if (this.currentChapterData) {
      this.renderCommentaryView(this.currentChapterData);
    }
  },

  filterSourcesList(query) {
    const listEl = document.getElementById('comm-sources-list');
    if (!listEl) return;
    const cleanQ = (query || '').toLowerCase().trim();
    listEl.querySelectorAll('.comm-source-item').forEach(item => {
      const text = item.textContent.toLowerCase();
      if (!cleanQ || text.includes(cleanQ)) {
        item.style.setProperty('display', 'flex', 'important');
      } else {
        item.style.setProperty('display', 'none', 'important');
      }
    });
  },

  async navigateVerse(delta) {
    let curV = parseInt(this.currentVerse, 10) || 1;
    let nextV = curV + delta;
    let nextCh = parseInt(this.currentChapter, 10) || 1;
    let nextBk = this.currentBook || 'Gen';

    if (nextV < 1) {
      if (nextCh > 1) {
        nextCh -= 1;
        nextV = 1;
      } else {
        App.showToast('Début du livre');
        return;
      }
    }

    this.currentVerse = nextV;
    this.currentChapter = nextCh;
    this.currentBook = nextBk;
    this.currentBookFrench = this.bookFrenchMap[nextBk] || nextBk;

    this.updatePassageDisplay(this.currentBookFrench, this.currentChapter, this.currentVerse);

    // Si synchronisé, notifier la fenêtre principale
    if (this.isSyncActive) {
      if (this.channel) {
        this.channel.postMessage({
          type: 'PASSAGE_NAVIGATED',
          book: nextBk,
          bookFrench: this.currentBookFrench,
          chapter: nextCh,
          verse: nextV
        });
      }
      try {
        await API.navigateMainFromSecondary(nextBk, nextCh, nextV);
      } catch (e) {}
    }

    if (this.currentChapterData && this.currentChapterData.chapter === nextCh && this.currentChapterData.book === nextBk) {
      this.refreshActiveTab();
    } else {
      this.loadAllPassageData(nextBk, nextCh, nextV);
    }
  },

  toggleSync(forcedState) {
    if (typeof forcedState === 'boolean') {
      this.isSyncActive = forcedState;
    } else {
      this.isSyncActive = !this.isSyncActive;
    }

    this.updateSyncUI();

    if (this.isSyncActive) {
      App.showToast('Synchronisation active avec le texte biblique');
      if (this.channel) {
        this.channel.postMessage({ type: 'REQUEST_CURRENT_STATE' });
      }
    } else {
      App.showToast('Fenêtre déliée (indépendante du lecteur)');
    }
  },

  updateSyncUI() {
    const commSync = document.getElementById('btn-toggle-comm-sync');
    const commSyncLabel = document.getElementById('comm-sync-label');
    const winSync = document.getElementById('comm-win-sync-badge');
    const winSyncLabel = document.getElementById('comm-win-sync-label');
    const ovSync = document.getElementById('btn-overview-toggle-sync');
    const ovSyncLabel = document.getElementById('lbl-overview-sync');

    if (this.isSyncActive) {
      commSync?.classList.add('active');
      commSync?.classList.remove('unlinked');
      if (commSyncLabel) commSyncLabel.textContent = 'Lié';

      winSync?.classList.add('synced');
      winSync?.classList.remove('paused');
      if (winSyncLabel) winSyncLabel.textContent = 'Lié';

      ovSync?.classList.add('active');
      ovSync?.classList.remove('unlinked');
      if (ovSyncLabel) ovSyncLabel.textContent = 'Lié';
    } else {
      commSync?.classList.remove('active');
      commSync?.classList.add('unlinked');
      if (commSyncLabel) commSyncLabel.textContent = 'Délié';

      winSync?.classList.remove('synced');
      winSync?.classList.add('paused');
      if (winSyncLabel) winSyncLabel.textContent = 'Délié';

      ovSync?.classList.remove('active');
      ovSync?.classList.add('unlinked');
      if (ovSyncLabel) ovSyncLabel.textContent = 'Délié';
    }
  },

  adjustFontSize(delta) {
    this.zoomPercent = Math.max(70, Math.min(180, this.zoomPercent + delta * 10));
    document.documentElement.style.setProperty('--comm-zoom', String(this.zoomPercent / 100));
    const lbl = document.getElementById('lbl-zoom-val');
    if (lbl) lbl.textContent = `${this.zoomPercent}%`;
    try {
      localStorage.setItem('open_shema_comm_zoom', String(this.zoomPercent));
    } catch (e) {}
    App.showToast(`Zoom : ${this.zoomPercent}%`);
  },

  // =========================================================================
  // SYNTHÈSE EXÉGÉTIQUE IA MULTI-VERSETS
  // =========================================================================

  toggleSynthesisPanel(forceOpen = null) {
    const panel = document.getElementById('comm-synthesis-panel');
    const singleView = document.getElementById('commentary-single-view');
    const btnSynth = document.getElementById('btn-open-comm-synth');
    if (!panel) return;

    const isOpen = forceOpen !== null ? forceOpen : panel.classList.contains('hidden');

    if (isOpen) {
      panel.classList.remove('hidden');
      btnSynth?.classList.add('active');
      this.refreshSynthesisRange();
    } else {
      panel.classList.add('hidden');
      singleView?.classList.remove('hidden');
      btnSynth?.classList.remove('active');
    }
  },

  refreshSynthesisRange() {
    this.synthVerseStart = parseInt(this.currentVerse, 10) || 1;
    this.synthVerseEnd = parseInt(this.currentVerse, 10) || 1;

    const startInput = document.getElementById('synth-verse-start');
    const endInput = document.getElementById('synth-verse-end');
    const bookLbl = document.getElementById('synth-range-book');
    const passageBadge = document.getElementById('synth-passage-badge');
    const rangeInfo = document.getElementById('synth-range-info');

    if (startInput) startInput.value = this.synthVerseStart;
    if (endInput) endInput.value = this.synthVerseEnd;
    if (bookLbl) bookLbl.textContent = `${this.currentBookFrench} ${this.currentChapter}:`;
    if (passageBadge) passageBadge.textContent = `${this.currentBookFrench} ${this.currentChapter}:${this.synthVerseStart}`;
    if (rangeInfo) rangeInfo.textContent = '1 verset';
  },

  handleSynthesisRangeChange() {
    const startInput = document.getElementById('synth-verse-start');
    const endInput = document.getElementById('synth-verse-end');
    if (!startInput || !endInput) return;

    let vStart = parseInt(startInput.value, 10) || 1;
    let vEnd = parseInt(endInput.value, 10) || vStart;

    if (vStart < 1) vStart = 1;
    if (vEnd < 1) vEnd = 1;

    let vMin = Math.min(vStart, vEnd);
    let vMax = Math.max(vStart, vEnd);

    const span = (vMax - vMin + 1);
    const ceilingWarning = document.getElementById('synth-ceiling-warning');

    if (span > this.synthMaxLimit) {
      vMax = vMin + this.synthMaxLimit - 1;
      endInput.value = vMax;
      ceilingWarning?.classList.remove('hidden');
    } else {
      ceilingWarning?.classList.add('hidden');
    }

    this.synthVerseStart = vMin;
    this.synthVerseEnd = vMax;

    const passageBadge = document.getElementById('synth-passage-badge');
    const rangeInfo = document.getElementById('synth-range-info');

    const refStr = (vMax === vMin)
      ? `${this.currentBookFrench} ${this.currentChapter}:${vMin}`
      : `${this.currentBookFrench} ${this.currentChapter}:${vMin}-${vMax}`;

    if (passageBadge) passageBadge.textContent = refStr;
    if (rangeInfo) rangeInfo.textContent = (vMax === vMin) ? '1 verset' : `${vMax - vMin + 1} versets`;
  },

  async launchSynthesis() {
    const btnLaunch = document.getElementById('btn-launch-synth');
    const loadingBox = document.getElementById('synth-loading-box');
    const resultBox = document.getElementById('synth-result-container');
    const contentEl = document.getElementById('synth-markdown-content');
    const statusText = document.getElementById('synth-step-status');

    if (!btnLaunch) return;

    btnLaunch.disabled = true;
    loadingBox?.classList.remove('hidden');
    resultBox?.classList.add('hidden');

    if (statusText) statusText.textContent = 'Extraction de tous les commentaires bibliques...';

    const t1 = setTimeout(() => {
      if (statusText) statusText.textContent = 'Analyse théologique comparative...';
    }, 1200);

    const t2 = setTimeout(() => {
      if (statusText) statusText.textContent = 'Génération de la synthèse par IA...';
    }, 2800);

    try {
      const res = await API.synthesizePassageCommentaries(
        this.currentBook,
        this.currentChapter,
        this.synthVerseStart,
        this.synthVerseEnd
      );

      clearTimeout(t1);
      clearTimeout(t2);

      if (res && res.synthesis) {
        this.latestSynthesisMarkdown = res.synthesis;
        if (contentEl) contentEl.innerHTML = this.formatMarkdown(res.synthesis);
        resultBox?.classList.remove('hidden');
      } else {
        throw new Error(res?.error || "Échec de génération de la synthèse.");
      }
    } catch (e) {
      clearTimeout(t1);
      clearTimeout(t2);
      App.showToast(`Erreur synthèse : ${e.message || String(e)}`);
    } finally {
      btnLaunch.disabled = false;
      loadingBox?.classList.add('hidden');
    }
  },

  exportToNote(ref, author, text) {
    const textarea = document.getElementById('note-editor-textarea');
    if (textarea) {
      const noteChunk = `\n\n### ${ref} — ${author}\n> ${text.trim()}\n`;
      textarea.value = (textarea.value + noteChunk).trim();
      App.showToast(`Ajouté aux notes d'étude (${ref})`);
    }
  },

  // =========================================================================
  // 2. ONGLET ASSISTANT IA
  // =========================================================================

  renderAiChatHeader() {
    // Entête IA
  },

  async sendAiChatMessage() {
    const inputEl = document.getElementById('ai-chat-input');
    const msgStream = document.getElementById('ai-chat-messages');
    if (!inputEl || !msgStream) return;

    const query = inputEl.value.trim();
    if (!query) return;

    inputEl.value = '';

    // Message utilisateur
    const userBubble = document.createElement('div');
    userBubble.className = 'ai-msg-bubble user comm-fade-in';
    userBubble.textContent = query;
    msgStream.appendChild(userBubble);

    // Bulle réponse IA
    const aiBubble = document.createElement('div');
    aiBubble.className = 'ai-msg-bubble assistant comm-fade-in';
    aiBubble.innerHTML = `<div style="display: flex; align-items: center; gap: 8px; color: #38BDF8;"><div class="comm-loader-orb" style="width: 16px; height: 16px; border-width: 2px;"></div><span>Recherche théologique en cours...</span></div>`;
    msgStream.appendChild(aiBubble);
    msgStream.scrollTop = msgStream.scrollHeight;

    try {
      const refStr = `${this.currentBookFrench} ${this.currentChapter}:${this.currentVerse}`;
      const res = await API.askAI(query, this.currentBook, this.currentChapter, this.currentVerse);
      const textResult = res?.answer || res?.result || res?.text || (typeof res === 'string' ? res : 'Réponse générée.');
      aiBubble.innerHTML = this.formatMarkdown(textResult);
    } catch (e) {
      aiBubble.innerHTML = `<span style="color: #EF4444;">Erreur lors de l'échange avec l'assistant : ${this.escapeHtml(e.message || String(e))}</span>`;
    }
    msgStream.scrollTop = msgStream.scrollHeight;
  },

  // =========================================================================
  // 3. ONGLET LEXIQUE STRONG
  // =========================================================================

  async loadLexiconForActiveVerse() {
    const wordsFlow = document.getElementById('lex-words-flow');
    const detailEl = document.getElementById('lex-entry-detail');
    if (!wordsFlow) return;

    wordsFlow.innerHTML = `
      <div style="display: flex; gap: 8px; flex-wrap: wrap; width: 100%;" class="comm-fade-in">
        <div class="comm-skeleton-shimmer" style="width: 85px; height: 38px; border-radius: 7px;"></div>
        <div class="comm-skeleton-shimmer" style="width: 110px; height: 38px; border-radius: 7px;"></div>
        <div class="comm-skeleton-shimmer" style="width: 95px; height: 38px; border-radius: 7px;"></div>
        <div class="comm-skeleton-shimmer" style="width: 75px; height: 38px; border-radius: 7px;"></div>
      </div>
    `;

    try {
      const chData = await API.getChapterData('LSG', this.currentBook, this.currentChapter, 'LSG');
      const vData = (chData?.verses || []).find(v => v.verse === this.currentVerse);

      if (!vData || !vData.text) {
        wordsFlow.innerHTML = '<div style="color: #94A3B8; font-size: 13px;">Texte du verset introuvable.</div>';
        return;
      }

      let wordList = [];
      if (vData.words && Array.isArray(vData.words) && vData.words.length > 0) {
        wordList = vData.words.filter(w => (w.surface || w.orig || '').trim().length > 0);
      } else {
        const rawTokens = vData.text.split(/[\s,;:«»'".()]+/g).filter(w => w.length > 0);
        wordList = rawTokens.map(t => ({ surface: t, orig: '', strong: '' }));
      }

      this.currentLexiconWords = wordList;
      wordsFlow.innerHTML = '';

      wordList.forEach((w, idx) => {
        const pill = document.createElement('div');
        pill.className = `lex-word-pill ${idx === 0 ? 'active' : ''}`;
        pill.innerHTML = `
          <span class="lex-word-surface">${this.escapeHtml(w.surface || '')}</span>
          ${w.orig ? `<span class="lex-word-orig">${this.escapeHtml(w.orig)}</span>` : ''}
          ${w.strong ? `<span class="lex-word-strong">${this.escapeHtml(w.strong)}</span>` : ''}
        `;
        pill.addEventListener('click', () => {
          wordsFlow.querySelectorAll('.lex-word-pill').forEach(p => p.classList.remove('active'));
          pill.classList.add('active');
          this.showLexiconWordDetail(w);
        });
        wordsFlow.appendChild(pill);
      });

      if (wordList.length > 0) {
        this.showLexiconWordDetail(wordList[0]);
      }
    } catch (e) {
      console.error('[CommentaryWindow] Erreur chargement lexique:', e);
      wordsFlow.innerHTML = '<div style="color: #EF4444; font-size: 13px;">Erreur chargement lexique.</div>';
    }
  },

  async showLexiconWordDetail(wordObj) {
    const detailEl = document.getElementById('lex-entry-detail');
    if (!detailEl) return;

    detailEl.innerHTML = `
      <div class="comm-fade-in" style="display: flex; flex-direction: column; gap: 12px;">
        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px;">
          <div>
            <span style="font-size: 18px; font-weight: 700; color: #F97316;">${this.escapeHtml(wordObj.orig || wordObj.surface)}</span>
            <span style="font-size: 14px; font-weight: 600; color: #F8FAFC; margin-left: 8px;">« ${this.escapeHtml(wordObj.surface)} »</span>
          </div>
          ${wordObj.strong ? `<span class="comm-stream-ref-badge" style="color: #F97316; font-size: 13px;">${this.escapeHtml(wordObj.strong)}</span>` : ''}
        </div>
        <div id="lex-entry-body" style="font-size: 14.5px; line-height: 1.7; color: #E2E8F0;">
          <div class="comm-loader-orb" style="width: 18px; height: 18px; border-width: 2px; display: inline-block; vertical-align: middle; margin-right: 8px;"></div>
          <span>Recherche des définitions dans les dictionnaires Strong / Bailly / Gesenius...</span>
        </div>
      </div>
    `;

    try {
      const strongCode = wordObj.strong || '';
      const defRes = await API.getDictionaryDefinition(strongCode, wordObj.surface);
      const bodyEl = document.getElementById('lex-entry-body');
      if (bodyEl) {
        if (defRes && (defRes.definition || defRes.text || defRes.html)) {
          bodyEl.innerHTML = this.formatMarkdown(defRes.definition || defRes.text || defRes.html || '');
        } else {
          bodyEl.innerHTML = `<p>Définition Strong ${this.escapeHtml(strongCode)} pour « ${this.escapeHtml(wordObj.surface)} » : terme indexé dans le corpus hébreu/grec biblique.</p>`;
        }
      }
    } catch (e) {
      const bodyEl = document.getElementById('lex-entry-body');
      if (bodyEl) bodyEl.innerHTML = `<p style="color: #94A3B8;">Mot « ${this.escapeHtml(wordObj.surface)} » (${this.escapeHtml(wordObj.strong || '')}).</p>`;
    }
  },

  // =========================================================================
  // 4. ONGLET NOTES D'ÉTUDE
  // =========================================================================

  async loadNotesForActiveVerse() {
    const textarea = document.getElementById('note-editor-textarea');
    const preview = document.getElementById('note-preview-content');
    if (!textarea) return;

    try {
      const note = await API.getVerseNote(this.currentBook, this.currentChapter, this.currentVerse);
      const text = (note && (note.text || note.content)) || '';
      textarea.value = text;
      if (preview) preview.innerHTML = this.formatMarkdown(text || '*Aucune note rédigée.*');
    } catch (e) {
      console.warn('[CommentaryWindow] Pas de note existante pour ce verset');
    }
  },

  async saveActiveNote() {
    const textarea = document.getElementById('note-editor-textarea');
    if (!textarea) return;

    try {
      await API.saveVerseNote(this.currentBook, this.currentChapter, this.currentVerse, textarea.value);
      App.showToast('Note enregistrée avec succès !');
    } catch (e) {
      App.showToast(`Erreur enregistrement note : ${e.message || String(e)}`);
    }
  },

  // =========================================================================
  // GESTION DES ÉVÉNEMENTS GLOBAUX
  // =========================================================================

  bindEvents() {
    // 1. Navigation entre onglets
    document.querySelectorAll('.comm-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.switchTab(btn.dataset.tab);
      });
    });

    // 2. Navigation verset précédent / suivant (Commentaires)
    document.getElementById('btn-comm-prev-verse')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.navigateVerse(-1);
    });
    document.getElementById('btn-comm-next-verse')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.navigateVerse(1);
    });

    // 2b. Navigation verset précédent / suivant (Aperçu)
    document.getElementById('btn-overview-prev-v')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.navigateVerse(-1);
    });
    document.getElementById('btn-overview-next-v')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.navigateVerse(1);
    });

    // 3. Synchronisation
    document.getElementById('btn-toggle-comm-sync')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleSync();
    });
    document.getElementById('comm-win-sync-badge')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleSync();
    });
    document.getElementById('btn-overview-toggle-sync')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleSync();
    });

    // 4. Zoom & Tailles de police
    document.getElementById('btn-comm-font-dec')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.adjustFontSize(-1);
    });
    document.getElementById('btn-comm-font-inc')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.adjustFontSize(1);
    });
    document.getElementById('btn-zoom-out')?.addEventListener('click', () => this.adjustFontSize(-1));
    document.getElementById('btn-zoom-in')?.addEventListener('click', () => this.adjustFontSize(1));

    // 5. Popover Sélecteur d'Ouvrages
    const btnSelectSource = document.getElementById('btn-select-comm-source');
    const popoverSources = document.getElementById('comm-sources-popover');
    const inputSourcesFilter = document.getElementById('comm-sources-filter-input');

    btnSelectSource?.addEventListener('click', (e) => {
      e.stopPropagation();
      popoverSources?.classList.toggle('hidden');
      if (popoverSources && !popoverSources.classList.contains('hidden')) {
        if (inputSourcesFilter) {
          inputSourcesFilter.value = '';
          this.filterSourcesList('');
          setTimeout(() => inputSourcesFilter.focus(), 50);
        }
      }
    });

    inputSourcesFilter?.addEventListener('input', (e) => {
      this.filterSourcesList(e.target.value);
    });

    // 6. Popover Saisie Manuelle de Référence
    const btnRefBadge = document.getElementById('comm-selected-verse');
    const popoverRef = document.getElementById('comm-ref-picker-popover');
    const inputRef = document.getElementById('comm-ref-input');
    const btnSubmitRef = document.getElementById('btn-comm-ref-submit');

    btnRefBadge?.addEventListener('click', (e) => {
      e.stopPropagation();
      popoverRef?.classList.toggle('hidden');
      if (popoverRef && !popoverRef.classList.contains('hidden')) {
        if (inputRef) {
          inputRef.value = `${this.currentBookFrench} ${this.currentChapter}:${this.currentVerse}`;
          inputRef.focus();
          inputRef.select();
        }
      }
    });

    const handleRefSubmit = async () => {
      const q = inputRef?.value?.trim();
      if (!q) return;
      try {
        const parsed = await API.parseReference(q);
        if (parsed && parsed.book) {
          this.currentBook = parsed.book;
          this.currentChapter = parsed.chapter || 1;
          this.currentVerse = parsed.verse || 1;
          this.currentBookFrench = parsed.book_french || this.bookFrenchMap[parsed.book] || parsed.book;
          this.updatePassageDisplay(this.currentBookFrench, this.currentChapter, this.currentVerse);
          this.loadAllPassageData(this.currentBook, this.currentChapter, this.currentVerse);
          popoverRef?.classList.add('hidden');
        } else {
          App.showToast(`Référence introuvable : « ${q} »`);
        }
      } catch (e) {
        console.error('Erreur parsing ref:', e);
      }
    };

    btnSubmitRef?.addEventListener('click', (e) => {
      e.stopPropagation();
      handleRefSubmit();
    });

    inputRef?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleRefSubmit();
      }
    });

    // 7. Synthèse IA
    document.getElementById('btn-open-comm-synth')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleSynthesisPanel();
    });
    document.getElementById('btn-close-comm-synth')?.addEventListener('click', () => {
      this.toggleSynthesisPanel(false);
    });
    document.getElementById('synth-verse-start')?.addEventListener('input', () => this.handleSynthesisRangeChange());
    document.getElementById('synth-verse-end')?.addEventListener('input', () => this.handleSynthesisRangeChange());
    document.getElementById('btn-launch-synth')?.addEventListener('click', () => this.launchSynthesis());
    document.getElementById('btn-copy-synth')?.addEventListener('click', () => {
      if (this.latestSynthesisMarkdown) {
        navigator.clipboard.writeText(this.latestSynthesisMarkdown);
        App.showToast('Synthèse copiée dans le presse-papier !');
      }
    });
    document.getElementById('btn-export-synth-note')?.addEventListener('click', () => {
      if (this.latestSynthesisMarkdown) {
        this.exportToNote(`${this.currentBookFrench} ${this.currentChapter}:${this.synthVerseStart}-${this.synthVerseEnd}`, "Synthèse IA", this.latestSynthesisMarkdown);
      }
    });

    // 8. Assistant IA (Envoi & Chips)
    document.getElementById('btn-send-ai-chat')?.addEventListener('click', () => this.sendAiChatMessage());
    document.getElementById('ai-chat-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendAiChatMessage();
      }
    });
    document.querySelectorAll('.ai-prompt-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const input = document.getElementById('ai-chat-input');
        if (input) {
          input.value = chip.dataset.prompt || '';
          input.focus();
        }
      });
    });

    // 9. Notes (Enregistrement & Markdown)
    document.getElementById('btn-save-note')?.addEventListener('click', () => this.saveActiveNote());
    document.getElementById('btn-note-mode-edit')?.addEventListener('click', () => {
      document.getElementById('btn-note-mode-edit')?.classList.add('active');
      document.getElementById('btn-note-mode-preview')?.classList.remove('active');
      document.getElementById('note-editor-textarea')?.classList.remove('hidden');
      document.getElementById('note-preview-content')?.classList.add('hidden');
    });
    document.getElementById('btn-note-mode-preview')?.addEventListener('click', () => {
      document.getElementById('btn-note-mode-preview')?.classList.add('active');
      document.getElementById('btn-note-mode-edit')?.classList.remove('active');
      document.getElementById('note-editor-textarea')?.classList.add('hidden');
      const preview = document.getElementById('note-preview-content');
      if (preview) {
        preview.classList.remove('hidden');
        preview.innerHTML = this.formatMarkdown(document.getElementById('note-editor-textarea')?.value || '*Aucune note rédigée.*');
      }
    });

    // 10. Boutons Barre de Titre (Réduire, Agrandir, Fermer)
    document.getElementById('btn-win-min')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        await API.call('minimize_commentary_window');
      } catch (err) {
        try { await API.minimizeCommentaryWindow(); } catch (e) {}
      }
    });

    document.getElementById('btn-win-max')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        await API.call('maximize_commentary_window');
      } catch (err) {
        try { await API.maximizeCommentaryWindow(); } catch (e) {}
      }
    });

    document.getElementById('btn-win-close')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        await API.call('close_commentary_window');
      } catch (err) {
        window.close();
      }
    });

    // Double-clic sur la barre de titre pour maximiser / restaurer
    document.getElementById('comm-win-titlebar')?.addEventListener('dblclick', async (e) => {
      if (e.target.closest('button') || e.target.closest('input') || e.target.closest('select') || e.target.closest('.comm-dropdown-popover')) return;
      try {
        await API.call('maximize_commentary_window');
      } catch (err) {
        try { await API.maximizeCommentaryWindow(); } catch (e) {}
      }
    });

    // 11. Menu Options d'Affichage
    const btnDisplay = document.getElementById('btn-comm-display');
    const popoverDisplay = document.getElementById('comm-display-popover');
    btnDisplay?.addEventListener('click', (e) => {
      e.stopPropagation();
      popoverDisplay?.classList.toggle('hidden');
    });

    // Polices
    document.querySelectorAll('.font-choice-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.font-choice-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.fontFamily = btn.dataset.font;
        document.documentElement.style.setProperty('--font-reading', `'${this.fontFamily}', Georgia, serif`);
      });
    });

    // Thèmes
    document.querySelectorAll('.bg-choice-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.bg-choice-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.body.className = `bg-theme-${btn.dataset.bg}`;
      });
    });

    // Fermeture des popovers au clic à l'extérieur
    document.addEventListener('click', (e) => {
      if (popoverSources && !popoverSources.contains(e.target) && e.target !== btnSelectSource) {
        popoverSources.classList.add('hidden');
      }
      if (popoverRef && !popoverRef.contains(e.target) && !btnRefBadge?.contains(e.target)) {
        popoverRef.classList.add('hidden');
      }
      if (popoverDisplay && !popoverDisplay.contains(e.target) && !btnDisplay?.contains(e.target)) {
        popoverDisplay.classList.add('hidden');
      }
    });
  },

  restorePreferences() {
    try {
      const savedZoom = localStorage.getItem('open_shema_comm_zoom');
      if (savedZoom) {
        this.zoomPercent = parseInt(savedZoom, 10) || 100;
        document.documentElement.style.setProperty('--comm-zoom', String(this.zoomPercent / 100));
        const lbl = document.getElementById('lbl-zoom-val');
        if (lbl) lbl.textContent = `${this.zoomPercent}%`;
      }
      const savedAuthor = localStorage.getItem('open_shema_preferred_author');
      if (savedAuthor) {
        this.activeAuthorFilter = savedAuthor;
      }
    } catch (e) {}
  },

  formatMarkdown(text) {
    if (!text) return '';
    let res = String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Titres
    res = res.replace(/^### (.*$)/gim, '<h3 style="color: #38BDF8; margin: 14px 0 6px 0; font-size: 16px;">$1</h3>');
    res = res.replace(/^## (.*$)/gim, '<h2 style="color: #38BDF8; margin: 16px 0 8px 0; font-size: 18px;">$1</h2>');
    res = res.replace(/^# (.*$)/gim, '<h1 style="color: #38BDF8; margin: 18px 0 10px 0; font-size: 20px;">$1</h1>');

    // Gras & Italique
    res = res.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    res = res.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // Listes & Citations
    res = res.replace(/^\> (.*$)/gim, '<blockquote style="border-left: 3px solid #38BDF8; padding-left: 12px; margin: 8px 0; color: #94A3B8; font-style: italic;">$1</blockquote>');
    res = res.replace(/^- (.*$)/gim, '<li style="margin-left: 18px;">$1</li>');

    // Paragraphes
    res = res.split('\n\n').map(p => {
      const trimmed = p.trim();
      if (!trimmed) return '';
      if (trimmed.startsWith('<h') || trimmed.startsWith('<blockquote') || trimmed.startsWith('<li')) return trimmed;
      return `<p style="margin: 0 0 12px 0;">${trimmed.replace(/\n/g, '<br>')}</p>`;
    }).join('');

    return res;
  },

  updateMaximizedState(isMaximized) {
    const btnMax = document.getElementById('btn-win-max');
    if (!btnMax) return;
    if (isMaximized) {
      btnMax.title = "Restaurer la fenêtre";
      btnMax.innerHTML = `
        <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="5" y="5" width="10" height="10" rx="1.5" />
          <path d="M9 5V3.5A1.5 1.5 0 0 1 10.5 2h8A1.5 1.5 0 0 1 20 3.5v8a1.5 1.5 0 0 1-1.5 1.5H17" />
        </svg>
      `;
    } else {
      btnMax.title = "Agrandir en plein écran";
      btnMax.innerHTML = `
        <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2" />
        </svg>
      `;
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
  },

  isForeignText(text) {
    if (!text) return false;
    const sample = text.slice(0, 300).toLowerCase();
    const engWords = ['the', 'and', 'that', 'this', 'with', 'from', 'which', 'unto', 'unto', 'lord', 'god'];
    let count = 0;
    engWords.forEach(w => {
      if (new RegExp(`\\b${w}\\b`).test(sample)) count++;
    });
    return count >= 3;
  },

  async handleTranslateClick(btn, itemId, rawText) {
    if (this.translationCache[itemId]) {
      this.showTranslatedVersion[itemId] = !this.showTranslatedVersion[itemId];
      this.renderCommentaryView(this.currentChapterData);
      return;
    }

    btn.disabled = true;
    btn.innerHTML = `<div class="comm-loader-orb" style="width: 10px; height: 10px; border-width: 1.5px; display: inline-block;"></div> Traduction...`;

    try {
      const res = await API.call('translate_commentary_article', rawText, 'fr');
      if (res && res.translated_text) {
        this.translationCache[itemId] = res.translated_text;
        this.showTranslatedVersion[itemId] = true;
        this.renderCommentaryView(this.currentChapterData);
      } else {
        App.showToast("Échec de la traduction.");
      }
    } catch (e) {
      App.showToast(`Erreur traduction : ${e.message || String(e)}`);
    } finally {
      btn.disabled = false;
    }
  }
};

window.CommentaryWindow = CommentaryWindow;

document.addEventListener('DOMContentLoaded', () => {
  CommentaryWindow.init();
});
