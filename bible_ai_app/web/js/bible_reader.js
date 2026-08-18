/**
 * Bible Reader Engine & Logos Experience
 * Gère le défilement continu pour toute la Bible, les options d'affichage,
 * les onglets multi-documents, le lexique Strong au clic et le menu contextuel (clic droit / double-clic).
 */

// 1. LISTE CANONIQUE DES LIVRES & CALCULS DE NAVIGATION
const CANONICAL_BOOKS = [
  // Ancien Testament
  { name: "Genèse", code: "Gen", chapters: 50 },
  { name: "Exode", code: "Exo", chapters: 40 },
  { name: "Lévitique", code: "Lev", chapters: 27 },
  { name: "Nombres", code: "Num", chapters: 36 },
  { name: "Deutéronome", code: "Deu", chapters: 34 },
  { name: "Josué", code: "Jos", chapters: 24 },
  { name: "Juges", code: "Jdg", chapters: 21 },
  { name: "Ruth", code: "Rut", chapters: 4 },
  { name: "1 Samuel", code: "1Sa", chapters: 31 },
  { name: "2 Samuel", code: "2Sa", chapters: 24 },
  { name: "1 Rois", code: "1Ki", chapters: 22 },
  { name: "2 Rois", code: "2Ki", chapters: 25 },
  { name: "1 Chroniques", code: "1Ch", chapters: 29 },
  { name: "2 Chroniques", code: "2Ch", chapters: 36 },
  { name: "Esdras", code: "Ezr", chapters: 10 },
  { name: "Néhémie", code: "Neh", chapters: 13 },
  { name: "Esther", code: "Est", chapters: 10 },
  { name: "Job", code: "Job", chapters: 42 },
  { name: "Psaumes", code: "Psa", chapters: 150 },
  { name: "Proverbes", code: "Pro", chapters: 31 },
  { name: "Ecclésiaste", code: "Ecc", chapters: 12 },
  { name: "Cantique", code: "Sol", chapters: 8 },
  { name: "Ésaïe", code: "Isa", chapters: 66 },
  { name: "Jérémie", code: "Jer", chapters: 52 },
  { name: "Lamentations", code: "Lam", chapters: 5 },
  { name: "Ézéchiel", code: "Eze", chapters: 48 },
  { name: "Daniel", code: "Dan", chapters: 12 },
  { name: "Osée", code: "Hos", chapters: 14 },
  { name: "Joël", code: "Joe", chapters: 3 },
  { name: "Amos", code: "Amo", chapters: 9 },
  { name: "Abdias", code: "Oba", chapters: 1 },
  { name: "Jonas", code: "Jon", chapters: 4 },
  { name: "Michée", code: "Mic", chapters: 7 },
  { name: "Nahum", code: "Nah", chapters: 3 },
  { name: "Habacuc", code: "Hab", chapters: 3 },
  { name: "Sophonie", code: "Zep", chapters: 3 },
  { name: "Aggée", code: "Hag", chapters: 2 },
  { name: "Zacharie", code: "Zec", chapters: 14 },
  { name: "Malachie", code: "Mal", chapters: 4 },
  // Nouveau Testament
  { name: "Matthieu", code: "Mat", chapters: 28 },
  { name: "Marc", code: "Mar", chapters: 16 },
  { name: "Luc", code: "Luk", chapters: 24 },
  { name: "Jean", code: "Joh", chapters: 21 },
  { name: "Actes", code: "Act", chapters: 28 },
  { name: "Romains", code: "Rom", chapters: 16 },
  { name: "1 Corinthiens", code: "1Co", chapters: 16 },
  { name: "2 Corinthiens", code: "2Co", chapters: 13 },
  { name: "Galates", code: "Gal", chapters: 6 },
  { name: "Éphésiens", code: "Eph", chapters: 6 },
  { name: "Philippiens", code: "Phi", chapters: 4 },
  { name: "Colossiens", code: "Col", chapters: 4 },
  { name: "1 Thessaloniciens", code: "1Th", chapters: 5 },
  { name: "2 Thessaloniciens", code: "2Th", chapters: 3 },
  { name: "1 Timothée", code: "1Ti", chapters: 6 },
  { name: "2 Timothée", code: "2Ti", chapters: 4 },
  { name: "Tite", code: "Tit", chapters: 3 },
  { name: "Philémon", code: "Phm", chapters: 1 },
  { name: "Hébreux", code: "Heb", chapters: 13 },
  { name: "Jacques", code: "Jam", chapters: 5 },
  { name: "1 Pierre", code: "1Pe", chapters: 5 },
  { name: "2 Pierre", code: "2Pe", chapters: 3 },
  { name: "1 Jean", code: "1Jo", chapters: 5 },
  { name: "2 Jean", code: "2Jo", chapters: 1 },
  { name: "3 Jean", code: "3Jo", chapters: 1 },
  { name: "Jude", code: "Jud", chapters: 1 },
  { name: "Apocalypse", code: "Rev", chapters: 22 }
];

function getBookInfo(bookCode) {
  const b = CANONICAL_BOOKS.find(item => item.code.toLowerCase() === bookCode.toLowerCase());
  return b || { name: bookCode, code: bookCode, chapters: 50 };
}

function getNextChapterCoord(bookCode, chNum) {
  const info = getBookInfo(bookCode);
  if (chNum < info.chapters) {
    return { book: info.code, chapter: chNum + 1 };
  }
  const idx = CANONICAL_BOOKS.findIndex(item => item.code.toLowerCase() === bookCode.toLowerCase());
  if (idx !== -1 && idx < CANONICAL_BOOKS.length - 1) {
    return { book: CANONICAL_BOOKS[idx + 1].code, chapter: 1 };
  }
  return null;
}

function getPrevChapterCoord(bookCode, chNum) {
  if (chNum > 1) {
    return { book: bookCode, chapter: chNum - 1 };
  }
  const idx = CANONICAL_BOOKS.findIndex(item => item.code.toLowerCase() === bookCode.toLowerCase());
  if (idx > 0) {
    const prevBook = CANONICAL_BOOKS[idx - 1];
    return { book: prevBook.code, chapter: prevBook.chapters };
  }
  return null;
}

// =============================================================================
// 2. GESTIONNAIRE D'ONGLETS MULTI-DOCUMENTS (Style Logos)
// =============================================================================

const TabsManager = {
  tabs: [],
  activeTabId: null,

  init() {
    document.getElementById('btn-add-tab')?.addEventListener('click', () => {
      this.createNewTab();
    });
  },

  setupInitialTabs(bibles) {
    if (!bibles || bibles.length === 0) return;

    const b1 = bibles[0].name;
    const b2 = bibles.length > 1 ? bibles[1].name : b1;

    this.createTab(b1, 'Gen', 1, '#EA580C', false, false, 'LSG');
    if (bibles.length > 1) {
      this.createTab(b2, 'Gen', 1, '#2563EB', false, false, 'LSG');
    }
    if (this.tabs.length > 0) {
      this.activateTab(this.tabs[0].id);
    }
  },

  createTab(bibleName, book = 'Gen', chapter = 1, forceColor = null, activateNow = true, isInterlinear = false, interlinearVersion = 'LSG') {
    const id = 'tab_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    const colorPalette = ['#EA580C', '#2563EB', '#059669', '#7C3AED', '#DB2777', '#D97706', '#0891B2'];
    const badgeColor = forceColor || colorPalette[this.tabs.length % colorPalette.length];

    const tab = {
      id: id,
      bibleName: bibleName,
      book: book,
      chapter: chapter,
      badgeColor: badgeColor,
      isInterlinear: isInterlinear,
      interlinearVersion: interlinearVersion
    };

    this.tabs.push(tab);
    this.renderTabs();

    if (activateNow) {
      this.activateTab(id);
    }
    return tab;
  },

  createNewTab() {
    const openNames = this.tabs.map(t => t.bibleName);
    let chosenBible = BibleReader.installedBibles.find(b => !openNames.includes(b.name))?.name;
    if (!chosenBible) {
      chosenBible = BibleReader.installedBibles[0]?.name || 'Colombe';
    }

    const newTab = this.createTab(chosenBible, BibleReader.currentBook, BibleReader.currentChapter, null, true, false, 'LSG');
    App.showToast(`Nouvel onglet ouvert : ${chosenBible}`);
  },

  activateTab(tabId) {
    const target = this.tabs.find(t => t.id === tabId);
    if (!target) return;

    this.activeTabId = tabId;
    BibleReader.currentBible1 = target.bibleName;
    BibleReader.currentBook = target.book || 'Gen';
    BibleReader.currentChapter = target.chapter || 1;
    BibleReader.isInterlinear = !!target.isInterlinear;
    BibleReader.interlinearVersion = target.interlinearVersion || 'LSG';

    // Mettre à jour l'état visuel du bouton et du menu Interlinéaire
    const interBtn = document.getElementById('btn-toggle-interlinear');
    const masterSwitch = document.getElementById('interlinear-master-switch');
    if (interBtn) interBtn.classList.toggle('active', BibleReader.isInterlinear);
    if (masterSwitch) masterSwitch.checked = BibleReader.isInterlinear;

    const radioLSG = document.getElementById('lbl-inter-lsg');
    const radioDarby = document.getElementById('lbl-inter-darby');
    const radioInput = document.querySelector(`input[name="interlinear-version-radio"][value="${BibleReader.interlinearVersion}"]`);
    if (radioInput) radioInput.checked = true;
    if (radioLSG) radioLSG.classList.toggle('active', BibleReader.interlinearVersion === 'LSG');
    if (radioDarby) radioDarby.classList.toggle('active', BibleReader.interlinearVersion === 'DARBY');

    BibleReader.updatePaneHeader(1);
    if (BibleReader.isSplitView) BibleReader.updatePaneHeader(2);

    BibleReader.navigateTo(target.book, target.chapter);
    this.renderTabs();
  },

  closeTab(tabId, e) {
    if (e) e.stopPropagation();
    if (this.tabs.length <= 1) {
      App.showToast('Impossible de fermer le dernier onglet');
      return;
    }

    const idx = this.tabs.findIndex(t => t.id === tabId);
    if (idx === -1) return;

    const wasActive = this.activeTabId === tabId;
    this.tabs.splice(idx, 1);

    if (wasActive) {
      const nextTab = this.tabs[Math.max(0, idx - 1)];
      this.activateTab(nextTab.id);
    } else {
      this.renderTabs();
    }
  },

  updateActiveTab(bibleName = null, book = null, chapter = null, isInterlinear = null, interlinearVersion = null) {
    const active = this.tabs.find(t => t.id === this.activeTabId);
    if (active) {
      if (bibleName !== null) active.bibleName = bibleName;
      if (book !== null) active.book = book;
      if (chapter !== null) active.chapter = chapter;
      if (isInterlinear !== null) active.isInterlinear = isInterlinear;
      if (interlinearVersion !== null) active.interlinearVersion = interlinearVersion;
      this.renderTabs();
    }
  },

  renderTabs() {
    const container = document.getElementById('tabs-list');
    if (!container) return;
    container.innerHTML = '';

    this.tabs.forEach(tab => {
      const tabEl = document.createElement('div');
      tabEl.className = `tab ${tab.id === this.activeTabId ? 'active' : ''}`;
      tabEl.dataset.tabId = tab.id;

      const titleText = tab.isInterlinear 
        ? `${tab.bibleName} [${tab.interlinearVersion || 'Interl.'}]`
        : tab.bibleName;

      tabEl.innerHTML = `
        <span class="tab-badge-icon" style="background-color: ${tab.badgeColor};">📖</span>
        <span class="tab-title">${titleText}</span>
        <button class="tab-close-btn" title="Fermer cet onglet">✕</button>
      `;

      tabEl.addEventListener('click', () => {
        this.activateTab(tab.id);
      });

      tabEl.querySelector('.tab-close-btn').addEventListener('click', (e) => {
        this.closeTab(tab.id, e);
      });

      container.appendChild(tabEl);
    });
  }
};


// 3. OPTIONS D'AFFICHAGE
const DisplayOptions = {
  init() {
    const btn = document.getElementById('btn-display-options');
    const popover = document.getElementById('display-options-popover');
    const workspace = document.getElementById('reader-workspace');

    if (!btn || !popover) return;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      popover.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
      if (!popover.contains(e.target) && e.target !== btn) {
        popover.classList.add('hidden');
      }
    });

    document.getElementById('opt-show-pericopes')?.addEventListener('change', (e) => {
      workspace?.classList.toggle('hide-pericopes', !e.target.checked);
    });

    document.getElementById('opt-show-chap-num')?.addEventListener('change', (e) => {
      workspace?.classList.toggle('hide-chap-num', !e.target.checked);
    });

    document.getElementById('opt-show-verse-num')?.addEventListener('change', (e) => {
      workspace?.classList.toggle('hide-verse-num', !e.target.checked);
    });

    document.getElementById('opt-verse-per-line')?.addEventListener('change', (e) => {
      workspace?.classList.toggle('verse-per-line', e.target.checked);
    });

    document.getElementById('opt-font-serif')?.addEventListener('change', (e) => {
      workspace?.classList.toggle('font-sans', !e.target.checked);
    });
  }
};


// 3b. MENU OPTIONS INTERLINÉAIRE INVERSÉ (Style Logos)
const InterlinearMenu = {
  init() {
    const btn = document.getElementById('btn-toggle-interlinear');
    const popover = document.getElementById('interlinear-options-popover');
    const masterSwitch = document.getElementById('interlinear-master-switch');
    const closeBtn = document.getElementById('btn-close-interlinear-popover');
    const radioLSG = document.getElementById('lbl-inter-lsg');
    const radioDarby = document.getElementById('lbl-inter-darby');

    if (!btn || !popover) return;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      popover.classList.toggle('hidden');
    });

    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        popover.classList.add('hidden');
      });
    }

    document.addEventListener('click', (e) => {
      if (!popover.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
        popover.classList.add('hidden');
      }
    });

    if (masterSwitch) {
      masterSwitch.addEventListener('change', (e) => {
        BibleReader.isInterlinear = e.target.checked;
        btn.classList.toggle('active', BibleReader.isInterlinear);
        TabsManager.updateActiveTab(null, null, null, BibleReader.isInterlinear, BibleReader.interlinearVersion);
        BibleReader.updatePaneHeader(1);
        if (BibleReader.isSplitView) BibleReader.updatePaneHeader(2);
        BibleReader.reloadCurrentChapters();
      });
    }

    document.querySelectorAll('input[name="interlinear-version-radio"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        BibleReader.interlinearVersion = e.target.value;
        if (radioLSG) radioLSG.classList.toggle('active', e.target.value === 'LSG');
        if (radioDarby) radioDarby.classList.toggle('active', e.target.value === 'DARBY');
        TabsManager.updateActiveTab(null, null, null, BibleReader.isInterlinear, BibleReader.interlinearVersion);
        if (BibleReader.isInterlinear) {
          BibleReader.updatePaneHeader(1);
          if (BibleReader.isSplitView) BibleReader.updatePaneHeader(2);
          BibleReader.reloadCurrentChapters();
        }
      });
    });

    const layerSurface = document.getElementById('inter-layer-surface');
    const layerOrig = document.getElementById('inter-layer-orig');
    const layerTranslit = document.getElementById('inter-layer-translit');
    const layerStrong = document.getElementById('inter-layer-strong');

    const onLayerChanged = () => {
      BibleReader.interlinearLayers = {
        surface: layerSurface ? layerSurface.checked : true,
        orig: layerOrig ? layerOrig.checked : true,
        translit: layerTranslit ? layerTranslit.checked : true,
        strong: layerStrong ? layerStrong.checked : true
      };
      if (BibleReader.isInterlinear) {
        BibleReader.reloadCurrentChapters();
      }
    };

    if (layerSurface) layerSurface.addEventListener('change', onLayerChanged);
    if (layerOrig) layerOrig.addEventListener('change', onLayerChanged);
    if (layerTranslit) layerTranslit.addEventListener('change', onLayerChanged);
    if (layerStrong) layerStrong.addEventListener('change', onLayerChanged);
  }
};


// 4. GESTIONNAIRE INDIVIDUEL DE COMMENTAIRES (Style Logos)
const CommentaryViewer = {
  currentComments: [],
  activeIndex: 0,

  init() {
    const btn = document.getElementById('btn-select-comm-source');
    const popover = document.getElementById('comm-sources-popover');

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      popover.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
      if (!popover.contains(e.target) && e.target !== btn) {
        popover.classList.add('hidden');
      }
    });
  },

  setComments(comments, verseRef) {
    this.currentComments = comments || [];
    this.activeIndex = 0;

    const countEl = document.getElementById('comm-popover-count');
    const listEl = document.getElementById('comm-sources-list');
    const badgeEl = document.getElementById('comm-selected-verse');

    if (badgeEl) badgeEl.textContent = verseRef;
    if (countEl) countEl.textContent = this.currentComments.length;
    if (listEl) listEl.innerHTML = '';

    if (this.currentComments.length === 0) {
      document.getElementById('lbl-active-comm-source').textContent = 'Aucun commentaire';
      document.getElementById('commentary-single-view').innerHTML = `
        <div class="empty-hint" style="padding: 20px; color: var(--text-muted);">
          Aucun commentaire disponible pour ce verset.
        </div>
      `;
      return;
    }

    this.currentComments.forEach((c, idx) => {
      const authorName = c.author || c.source || `Commentaire ${idx + 1}`;
      const item = document.createElement('button');
      item.className = `comm-source-item ${idx === 0 ? 'active' : ''}`;
      item.innerHTML = `<span>📖 ${authorName}</span>`;
      item.addEventListener('click', () => {
        this.selectCommentary(idx);
        document.getElementById('comm-sources-popover').classList.add('hidden');
      });
      listEl.appendChild(item);
    });

    this.selectCommentary(0);
  },

  selectCommentary(index) {
    if (!this.currentComments[index]) return;
    this.activeIndex = index;

    const comm = this.currentComments[index];
    const authorName = comm.author || comm.source || 'Commentaire';

    document.getElementById('lbl-active-comm-source').textContent = authorName;

    document.querySelectorAll('.comm-source-item').forEach((item, idx) => {
      item.classList.toggle('active', idx === index);
    });

    const container = document.getElementById('commentary-single-view');
    container.innerHTML = `
      <div class="comm-single-author-header">
        <span class="comm-single-author-badge">📖 ${authorName}</span>
      </div>
      <div class="comm-single-body">
        ${comm.text.replace(/\n\n/g, '<br><br>')}
      </div>
    `;
  }
};


// 5. MENU CONTEXTUEL FLOTTANT (Clic droit & Double-clic)
const ContextMenuManager = {
  menuEl: null,

  init() {
    this.menuEl = document.getElementById('bible-context-menu');
    document.getElementById('btn-close-context-menu').addEventListener('click', () => {
      this.hide();
    });

    document.addEventListener('click', (e) => {
      if (this.menuEl && !this.menuEl.contains(e.target)) {
        this.hide();
      }
    });
  },

  hide() {
    if (this.menuEl) this.menuEl.classList.add('hidden');
  },

  positionMenu(clientX, clientY) {
    this.menuEl.classList.remove('hidden');
    const width = 320;
    const height = this.menuEl.offsetHeight || 250;
    
    let left = clientX;
    let top = clientY;

    if (left + width > window.innerWidth - 20) {
      left = window.innerWidth - width - 20;
    }
    if (top + height > window.innerHeight - 20) {
      top = window.innerHeight - height - 20;
    }

    this.menuEl.style.left = `${Math.max(10, left)}px`;
    this.menuEl.style.top = `${Math.max(10, top)}px`;
  },

  async showForWord(word, strongCode, verseNum, bookCode, chapterNum, clientX, clientY) {
    const cleanWord = (word || '').trim();
    if (!cleanWord) return;

    const headerTitle = document.getElementById('context-header-title');
    const headerBadge = document.getElementById('context-header-badge');
    const previewEl = document.getElementById('context-menu-preview');
    const actionsEl = document.getElementById('context-menu-actions');

    headerTitle.textContent = cleanWord;
    headerBadge.textContent = strongCode || 'Recherche lexicale';
    previewEl.innerHTML = `<em>Chargement de la définition lexicale...</em>`;

    this.positionMenu(clientX, clientY);

    // Charger aperçu lexical
    let dictEntry = null;
    try {
      dictEntry = await API.call('lookup_dictionary', cleanWord, strongCode);
      if (dictEntry) {
        headerBadge.textContent = dictEntry.badge || strongCode || 'Lexique';
        const snippet = dictEntry.full_text ? dictEntry.full_text.slice(0, 180) + '...' : '';
        previewEl.innerHTML = `<strong>${dictEntry.title}</strong><br>${snippet}`;
      } else {
        previewEl.innerHTML = `Terme biblique — Cliquez pour rechercher dans les dictionnaires.`;
      }
    } catch (e) {
      previewEl.innerHTML = ``;
    }

    const bInfo = getBookInfo(bookCode);
    const refStr = `${bInfo.name} ${chapterNum}:${verseNum}`;

    actionsEl.innerHTML = `
      <button class="context-action-btn" id="ctx-act-lexicon">
        <span>📜</span>
        <span>Voir la définition complète dans le Lexique</span>
      </button>
      <button class="context-action-btn" id="ctx-act-search">
        <span>🔍</span>
        <span>Rechercher toutes les occurrences de « ${cleanWord} »</span>
      </button>
      <button class="context-action-btn" id="ctx-act-ai">
        <span>🤖</span>
        <span>Étudier le mot avec l'Assistant IA</span>
      </button>
      <button class="context-action-btn" id="ctx-act-copy">
        <span>📋</span>
        <span>Copier le mot</span>
      </button>
    `;

    document.getElementById('ctx-act-lexicon').addEventListener('click', () => {
      this.hide();
      BibleReader.lookupWordInLexicon(cleanWord, strongCode);
    });

    document.getElementById('ctx-act-search').addEventListener('click', () => {
      this.hide();
      App.switchView('search');
      const sInput = document.getElementById('search-main-input');
      if (sInput) {
        sInput.value = cleanWord;
        SearchView.executeSearch();
      }
    });

    document.getElementById('ctx-act-ai').addEventListener('click', () => {
      this.hide();
      App.switchView('ai');
      const aiInput = document.getElementById('ai-study-input');
      const passRef = document.getElementById('ai-passage-ref');
      if (passRef) passRef.value = refStr;
      if (aiInput) {
        aiInput.value = `Fais une analyse lexicale, théologique et contextuelle approfondie du terme « ${cleanWord} » dans le passage de ${refStr}.`;
        aiInput.focus();
      }
    });

    document.getElementById('ctx-act-copy').addEventListener('click', () => {
      this.hide();
      navigator.clipboard.writeText(cleanWord);
      App.showToast(`« ${cleanWord} » copié dans le presse-papier !`);
    });
  },

  showForVerse(verseNum, verseText, bookCode, chapterNum, clientX, clientY) {
    const bInfo = getBookInfo(bookCode);
    const refStr = `${bInfo.name} ${chapterNum}:${verseNum}`;

    const headerTitle = document.getElementById('context-header-title');
    const headerBadge = document.getElementById('context-header-badge');
    const previewEl = document.getElementById('context-menu-preview');
    const actionsEl = document.getElementById('context-menu-actions');

    headerTitle.textContent = refStr;
    headerBadge.textContent = BibleReader.currentBible1;
    previewEl.innerHTML = `« ${verseText} »`;

    this.positionMenu(clientX, clientY);

    actionsEl.innerHTML = `
      <button class="context-action-btn" id="ctx-act-v-comm">
        <span>💬</span>
        <span>Ouvrir les commentaires exégétiques</span>
      </button>
      <button class="context-action-btn" id="ctx-act-v-ai">
        <span>🤖</span>
        <span>Étudier ce verset avec l'Assistant IA</span>
      </button>
      <button class="context-action-btn" id="ctx-act-v-note">
        <span>📝</span>
        <span>Créer une note sur ce verset</span>
      </button>
      <button class="context-action-btn" id="ctx-act-v-split">
        <span>⇄</span>
        <span>Comparer dans une 2e version</span>
      </button>
      <button class="context-action-btn" id="ctx-act-v-copy">
        <span>📋</span>
        <span>Copier le verset avec la référence</span>
      </button>
    `;

    document.getElementById('ctx-act-v-comm').addEventListener('click', () => {
      this.hide();
      const drawer = document.getElementById('right-drawer');
      drawer.classList.remove('collapsed');
      document.querySelector('.drawer-tab[data-drawer-tab="commentaries"]')?.click();
      BibleReader.loadCommentariesForVerse(verseNum, bookCode, chapterNum);
    });

    document.getElementById('ctx-act-v-ai').addEventListener('click', () => {
      this.hide();
      App.switchView('ai');
      const passRef = document.getElementById('ai-passage-ref');
      const aiInput = document.getElementById('ai-study-input');
      if (passRef) passRef.value = refStr;
      if (aiInput) {
        aiInput.value = `Donne-moi une analyse exégétique et théologique détaillée du verset ${refStr} : « ${verseText} »`;
        aiInput.focus();
      }
    });

    document.getElementById('ctx-act-v-note').addEventListener('click', () => {
      this.hide();
      App.switchView('notes');
      NotesView.createNewNote();
      const refInput = document.getElementById('note-edit-ref');
      const titleInput = document.getElementById('note-edit-title');
      if (refInput) refInput.value = refStr;
      if (titleInput) titleInput.value = `Méditation sur ${refStr}`;
    });

    document.getElementById('ctx-act-v-split').addEventListener('click', () => {
      this.hide();
      BibleReader.toggleSplitView(true);
    });

    document.getElementById('ctx-act-v-copy').addEventListener('click', () => {
      this.hide();
      navigator.clipboard.writeText(`${refStr} (${BibleReader.currentBible1}) — ${verseText}`);
      App.showToast(`Verset ${refStr} copié !`);
    });
  }
};


// 6. GESTIONNAIRE DU LEXIQUE STRONG, DICTIONNAIRES & WIKIPÉDIA (Style Logos)
const LexiconViewer = {
  currentTerm: '',
  currentStrong: null,
  currentMatches: [],
  activeSourceIndex: 0,

  async load(word, strongCode = null) {
    this.currentTerm = (word || '').trim();
    this.currentStrong = strongCode;
    this.activeSourceIndex = 0;

    const drawer = document.getElementById('right-drawer');
    drawer.classList.remove('collapsed');
    document.querySelector('.drawer-tab[data-drawer-tab="lexicon"]')?.click();

    const container = document.getElementById('lexicon-details');
    container.innerHTML = `<div style="padding: 20px; color: var(--text-muted);">Recherche lexicale pour « ${word} » ${strongCode ? `(${strongCode})` : ''}...</div>`;

    try {
      const entry = await API.call('lookup_dictionary', word, strongCode);
      this.currentMatches = entry?.matches || [];
      this.render();
    } catch (e) {
      console.error('Erreur lookup_dictionary:', e);
      container.innerHTML = `<div style="padding: 20px; color: var(--accent-red);">Erreur lors de la consultation lexicale.</div>`;
    }
  },

  render() {
    const container = document.getElementById('lexicon-details');
    container.innerHTML = '';

    // Barre d'onglets de sources (Strong, Calmet, Vigouroux, Bailly, Wikipédia)
    const toolbar = document.createElement('div');
    toolbar.className = 'lexicon-header-toolbar';

    const tabsContainer = document.createElement('div');
    tabsContainer.className = 'lexicon-source-tabs';

    // 1. Boutons pour chaque dictionnaire trouvé
    this.currentMatches.forEach((m, idx) => {
      const btn = document.createElement('button');
      btn.className = `lex-source-pill ${this.activeSourceIndex === idx ? 'active' : ''}`;
      btn.innerHTML = `${m.badge || m.dict_name}`;
      btn.addEventListener('click', () => {
        this.activeSourceIndex = idx;
        this.render();
      });
      tabsContainer.appendChild(btn);
    });

    // 2. Bouton Wikipédia
    const wikiIdx = this.currentMatches.length;
    const wikiBtn = document.createElement('button');
    wikiBtn.className = `lex-source-pill ${this.activeSourceIndex === wikiIdx ? 'active' : ''}`;
    wikiBtn.innerHTML = `🌐 Wikipédia`;
    wikiBtn.addEventListener('click', () => {
      this.activeSourceIndex = wikiIdx;
      this.render();
    });
    tabsContainer.appendChild(wikiBtn);

    toolbar.appendChild(tabsContainer);
    container.appendChild(toolbar);

    // Contenu principal
    const contentBox = document.createElement('div');
    contentBox.className = 'lexicon-active-content';
    container.appendChild(contentBox);

    if (this.activeSourceIndex === wikiIdx) {
      this.renderWikipedia(contentBox);
    } else if (this.currentMatches[this.activeSourceIndex]) {
      this.renderDictionaryMatch(contentBox, this.currentMatches[this.activeSourceIndex]);
    } else {
      contentBox.innerHTML = `
        <div style="padding: 24px; color: var(--text-muted); text-align: center;">
          <span style="font-size: 32px; display: block; margin-bottom: 10px;">📖</span>
          Aucune entrée trouvée dans ce dictionnaire pour « <strong>${this.currentTerm}</strong> ».
        </div>
      `;
    }
  },

  renderDictionaryMatch(container, match) {
    const isPolished = match.is_polished;
    const modelName = match.polished_model || 'Mistral 14B';

    let polishBarHtml = '';
    if (match.dict_id !== 'strong') {
      polishBarHtml = `
        <div class="ai-polish-bar">
          <div>
            ${isPolished 
              ? `<span class="ai-polished-badge">✨ Notice restaurée par IA (${modelName})</span>` 
              : `<span style="font-size: 11px; color: #4338CA; font-weight: 600;">Améliorer la lisibilité avec l'IA</span>`
            }
          </div>
          <button class="ai-polish-btn" id="btn-polish-entry">
            <span>✨</span>
            <span>${isPolished ? 'Re-générer' : "Améliorer avec l'IA (Mistral 14B)"}</span>
          </button>
        </div>
      `;
    }

    const textToRender = (match.full_text || match.preview || '')
      .replace(/### (.*)/g, '<h3 style="margin: 10px 0 6px 0; color: var(--accent-blue); font-size: 16px;">$1</h3>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n\n/g, '<br><br>');

    container.innerHTML = `
      <div style="padding: 16px;">
        <div style="font-size: 20px; font-weight: 800; color: var(--accent-blue); margin-bottom: 4px;">${match.title || this.currentTerm}</div>
        <div style="font-size: 11px; font-weight: 700; color: var(--accent-orange); margin-bottom: 12px;">${match.badge || match.dict_name}</div>
        ${polishBarHtml}
        <div style="font-family: var(--font-bible); font-size: 15px; line-height: 1.7; color: #334155;" id="match-body-text">${textToRender}</div>
      </div>
    `;

    const btnPolish = container.querySelector('#btn-polish-entry');
    if (btnPolish) {
      btnPolish.addEventListener('click', async () => {
        btnPolish.disabled = true;
        btnPolish.innerHTML = `<span>⏳</span><span>Restauration IA en cours...</span>`;
        const bodyEl = container.querySelector('#match-body-text');
        bodyEl.innerHTML = `<div style="padding: 20px; text-align: center; color: var(--accent-blue);"><em>Restauration philologique et restructuration de la notice par Mistral 14B...</em></div>`;

        try {
          const res = await API.call('polish_dictionary_article', match.dict_id, match.title, match.raw_text || match.full_text, null, match.slug);
          if (res && res.success) {
            match.is_polished = true;
            match.full_text = res.text;
            match.polished_model = res.model;
            App.showToast('✨ Notice restaurée par IA avec succès !');
            this.render();
          } else {
            alert(`Erreur d'amélioration IA : ${res?.error || 'Erreur inconnue'}`);
            this.render();
          }
        } catch (e) {
          alert(`Erreur d'appel IA : ${e}`);
          this.render();
        }
      });
    }
  },

  async renderWikipedia(container, exactTitle = null) {
    container.innerHTML = `<div style="padding: 24px; color: var(--text-muted); text-align: center;">Chargement de l'article Wikipédia pour « ${this.currentTerm} »...</div>`;

    try {
      const data = await API.call('get_wikipedia_summary', this.currentTerm, exactTitle);
      if (!data || !data.found) {
        container.innerHTML = `
          <div style="padding: 24px; color: var(--text-muted); text-align: center;">
            <span style="font-size: 32px; display: block; margin-bottom: 10px;">🌐</span>
            Aucun article Wikipédia trouvé pour « <strong>${this.currentTerm}</strong> ».
          </div>
        `;
        return;
      }

      let candidatesHtml = '';
      if (data.candidates && data.candidates.length > 0) {
        candidatesHtml = `
          <div class="wiki-candidates-box">
            <div class="wiki-candidates-title">Articles connexes & Homonymes :</div>
            ${data.candidates.map(c => `<button class="wiki-cand-pill" data-title="${c.title}">${c.title}</button>`).join('')}
          </div>
        `;
      }

      container.innerHTML = `
        <div class="wiki-container">
          <div class="wiki-header-box">
            <div>
              <div class="wiki-title">${data.title}</div>
              ${data.description ? `<div style="font-size: 11px; color: var(--text-muted); font-weight: 600; margin-top: 2px;">${data.description}</div>` : ''}
            </div>
            <a href="${data.url}" target="_blank" class="wiki-link-btn" title="Ouvrir sur le web">Ouvrir ↗</a>
          </div>

          ${data.thumbnail ? `<img src="${data.thumbnail}" class="wiki-thumbnail" alt="${data.title}">` : ''}

          <div class="wiki-extract">${(data.extract || '').replace(/\n\n/g, '<br><br>')}</div>

          ${candidatesHtml}
        </div>
      `;

      container.querySelectorAll('.wiki-cand-pill').forEach(pill => {
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


// 7. MOTEUR PRINCIPAL DU LECTEUR BIBLIQUE
const BibleReader = {
  currentBook: 'Gen',
  currentChapter: 1,
  currentBible1: 'Colombe',
  currentBible2: 'Segond 21',
  
  isSplitView: false,
  isInterlinear: false,
  interlinearVersion: 'LSG',
  interlinearLayers: { surface: true, orig: true, translit: true, strong: true },
  zoomPercent: 100,

  installedBibles: [],
  targetPaneForPicker: 1,

  loadedChapters: [],
  isLoadingMore: false,

  async init() {
    this.bindEvents();
    TabsManager.init();
    DisplayOptions.init();
    InterlinearMenu.init();
    CommentaryViewer.init();
    ContextMenuManager.init();
    
    BookPicker.init((bookCode, chNum) => {
      this.navigateTo(bookCode, chNum);
    });

    API.onReady(async () => {
      this.installedBibles = await API.getInstalledBibles() || [];
      if (this.installedBibles.length > 0) {
        this.currentBible1 = this.installedBibles[0].name;
        if (this.installedBibles.length > 1) {
          this.currentBible2 = this.installedBibles[1].name;
        }
        TabsManager.setupInitialTabs(this.installedBibles);
      } else {
        this.navigateTo(this.currentBook, this.currentChapter);
      }
    });

    this.setupInfiniteScroll();
  },

  bindEvents() {
    document.getElementById('book-picker-pill')?.addEventListener('click', () => {
      BookPicker.toggle(this.currentBook, this.currentChapter);
    });

    document.getElementById('btn-history-back')?.addEventListener('click', () => {
      const prev = getPrevChapterCoord(this.currentBook, this.currentChapter);
      if (prev) this.navigateTo(prev.book, prev.chapter);
    });
    
    document.getElementById('btn-history-forward')?.addEventListener('click', () => {
      const next = getNextChapterCoord(this.currentBook, this.currentChapter);
      if (next) this.navigateTo(next.book, next.chapter);
    });

    document.getElementById('btn-toggle-split')?.addEventListener('click', () => {
      this.toggleSplitView();
    });

    document.getElementById('btn-close-pane-2')?.addEventListener('click', () => {
      this.toggleSplitView(false);
    });

    document.getElementById('pane-1-select-bible')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openBiblePicker(1);
    });

    document.getElementById('pane-2-select-bible')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openBiblePicker(2);
    });

    document.getElementById('btn-close-bible-picker')?.addEventListener('click', () => {
      this.closeBiblePicker();
    });

    document.addEventListener('click', (e) => {
      const picker = document.getElementById('bible-version-picker-popover');
      if (picker && !picker.classList.contains('hidden') && !picker.contains(e.target)) {
        this.closeBiblePicker();
      }
    });

    document.getElementById('btn-zoom-in')?.addEventListener('click', () => {
      this.setZoom(this.zoomPercent + 10);
    });

    document.getElementById('btn-zoom-out')?.addEventListener('click', () => {
      this.setZoom(this.zoomPercent - 10);
    });

    document.getElementById('btn-toggle-right-drawer')?.addEventListener('click', () => {
      const drawer = document.getElementById('right-drawer');
      drawer?.classList.toggle('collapsed');
    });

    // Filtre de recherche dans le sélecteur de Bible
    document.getElementById('bible-picker-search')?.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase();
      document.querySelectorAll('#version-list-items .version-row-btn').forEach(btn => {
        const txt = btn.textContent.toLowerCase();
        btn.style.display = txt.includes(q) ? 'flex' : 'none';
      });
    });

    const quickPassage = document.getElementById('quick-passage-input');
    if (quickPassage) {
      quickPassage.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
          const query = e.target.value.trim();
          if (query) {
            const parsed = await API.parseReference(query);
            if (parsed && parsed.book) {
              this.navigateTo(parsed.book, parsed.chapter || 1);
              e.target.value = '';
            }
          }
        }
      });
    }
  },

  updatePaneHeader(paneNum) {
    if (paneNum === 1) {
      if (this.isInterlinear) {
        const interLabel = this.interlinearVersion === 'DARBY' ? 'Darby (Interlinéaire)' : 'LSG 1910 (Interlinéaire)';
        document.getElementById('pane-1-bible-name').textContent = interLabel;
      } else {
        document.getElementById('pane-1-bible-name').textContent = this.currentBible1;
      }
    } else if (paneNum === 2) {
      if (this.isInterlinear) {
        const interLabel = this.interlinearVersion === 'DARBY' ? 'Darby (Interlinéaire)' : 'LSG 1910 (Interlinéaire)';
        document.getElementById('pane-2-bible-name').textContent = interLabel;
      } else {
        document.getElementById('pane-2-bible-name').textContent = this.currentBible2;
      }
    }
  },

  setZoom(percent) {
    this.zoomPercent = Math.min(Math.max(70, percent), 180);
    document.getElementById('lbl-zoom-level').textContent = `${this.zoomPercent}%`;
    document.getElementById('pane-1-content').style.fontSize = `${this.zoomPercent}%`;
    document.getElementById('pane-2-content').style.fontSize = `${this.zoomPercent}%`;
  },

  toggleSplitView(forceState) {
    this.isSplitView = forceState !== undefined ? forceState : !this.isSplitView;
    const workspace = document.getElementById('reader-workspace');
    workspace.classList.toggle('split-view', this.isSplitView);
    document.getElementById('btn-toggle-split').classList.toggle('active', this.isSplitView);

    if (this.isSplitView) {
      this.updatePaneHeader(2);
      this.reloadPane2();
    }
  },

  async reloadPane2() {
    if (!this.isSplitView) return;
    const pane2Container = document.getElementById('pane-2-verses');
    pane2Container.innerHTML = '';
    const data2 = await API.getChapterData(this.currentBible2, this.currentBook, this.currentChapter, this.interlinearVersion);
    const block2 = this.createChapterBlockElement(2, data2, this.currentBible2);
    pane2Container.appendChild(block2);
  },

  setupInfiniteScroll() {
    const pane1 = document.getElementById('pane-1-content');
    if (!pane1) return;
    
    pane1.addEventListener('scroll', () => {
      if (this.isLoadingMore) return;
      const { scrollTop, scrollHeight, clientHeight } = pane1;

      // Défilement vers le bas -> charger le chapitre suivant
      if (scrollTop + clientHeight >= scrollHeight - 250) {
        this.loadNextChapterContinuous();
      }

      // Défilement vers le haut -> charger le chapitre précédent
      if (scrollTop <= 50) {
        this.loadPrevChapterContinuous(pane1);
      }

      // Détection du chapitre actuellement visible pour mettre à jour la pilule
      this.updateCurrentlyVisibleHeader(pane1);
    });
  },

  updateCurrentlyVisibleHeader(container) {
    const blocks = container.querySelectorAll('.chapter-block');
    const containerTop = container.getBoundingClientRect().top;

    for (const block of blocks) {
      const rect = block.getBoundingClientRect();
      if (rect.bottom > containerTop + 60) {
        const bCode = block.dataset.book;
        const ch = block.dataset.chapter;
        if (bCode && ch && (this.currentBook !== bCode || this.currentChapter !== parseInt(ch))) {
          this.currentBook = bCode;
          this.currentChapter = parseInt(ch);
          const info = getBookInfo(bCode);
          document.getElementById('pill-reference-text').textContent = `${info.name} ${ch}`;
          document.getElementById('pane-1-breadcrumb').textContent = `${info.name.toUpperCase()} > Chapitre ${ch}`;
          TabsManager.updateActiveTab(null, bCode, ch);
        }
        break;
      }
    }
  },

  async navigateTo(bookCode, chapterNum) {
    this.currentBook = bookCode;
    this.currentChapter = chapterNum;
    this.loadedChapters = [{ book: bookCode, chapter: chapterNum }];

    const info = getBookInfo(bookCode);
    document.getElementById('pill-reference-text').textContent = `${info.name} ${chapterNum}`;
    document.getElementById('pane-1-breadcrumb').textContent = `${info.name.toUpperCase()} > Chapitre ${chapterNum}`;
    this.updatePaneHeader(1);

    const pane1Container = document.getElementById('pane-1-verses');
    pane1Container.innerHTML = '';

    const data1 = await API.getChapterData(this.currentBible1, bookCode, chapterNum, this.interlinearVersion);
    const block1 = this.createChapterBlockElement(1, data1, this.currentBible1);
    pane1Container.appendChild(block1);

    if (this.isSplitView) {
      const pane2Container = document.getElementById('pane-2-verses');
      pane2Container.innerHTML = '';
      this.updatePaneHeader(2);
      const data2 = await API.getChapterData(this.currentBible2, bookCode, chapterNum, this.interlinearVersion);
      const block2 = this.createChapterBlockElement(2, data2, this.currentBible2);
      pane2Container.appendChild(block2);
    }

    document.getElementById('pane-1-content').scrollTop = 0;
    this.loadCommentariesForVerse(1);
    TabsManager.updateActiveTab(null, bookCode, chapterNum);
  },

  async reloadCurrentChapters() {
    const chaptersToReload = [...this.loadedChapters];
    const pane1Container = document.getElementById('pane-1-verses');
    pane1Container.innerHTML = '';

    for (const c of chaptersToReload) {
      const data = await API.getChapterData(this.currentBible1, c.book, c.chapter, this.interlinearVersion);
      const block = this.createChapterBlockElement(1, data, this.currentBible1);
      pane1Container.appendChild(block);
    }
  },

  async loadNextChapterContinuous() {
    if (this.isLoadingMore || this.loadedChapters.length === 0) return;
    const last = this.loadedChapters[this.loadedChapters.length - 1];
    const next = getNextChapterCoord(last.book, last.chapter);
    if (!next) return;

    this.isLoadingMore = true;
    this.loadedChapters.push(next);

    const data = await API.getChapterData(this.currentBible1, next.book, next.chapter, this.interlinearVersion);
    const block = this.createChapterBlockElement(1, data, this.currentBible1);

    const divider = document.createElement('div');
    divider.className = 'chapter-badge-divider';
    divider.innerHTML = `<span>${data.book_french} — Chapitre ${data.chapter}</span>`;

    const pane1Container = document.getElementById('pane-1-verses');
    pane1Container.appendChild(divider);
    pane1Container.appendChild(block);

    this.isLoadingMore = false;
  },

  async loadPrevChapterContinuous(scrollEl) {
    if (this.isLoadingMore || this.loadedChapters.length === 0) return;
    const first = this.loadedChapters[0];
    const prev = getPrevChapterCoord(first.book, first.chapter);
    if (!prev) return;

    this.isLoadingMore = true;
    this.loadedChapters.unshift(prev);

    const data = await API.getChapterData(this.currentBible1, prev.book, prev.chapter, this.interlinearVersion);
    const block = this.createChapterBlockElement(1, data, this.currentBible1);

    const divider = document.createElement('div');
    divider.className = 'chapter-badge-divider';
    divider.innerHTML = `<span>${data.book_french} — Chapitre ${data.chapter}</span>`;

    const oldScrollHeight = scrollEl.scrollHeight;
    const pane1Container = document.getElementById('pane-1-verses');
    pane1Container.prepend(divider);
    pane1Container.prepend(block);

    const diff = scrollEl.scrollHeight - oldScrollHeight;
    scrollEl.scrollTop += diff;

    this.isLoadingMore = false;
  },

  createChapterBlockElement(paneNum, data, bibleName) {
    const block = document.createElement('div');
    block.className = 'chapter-block';
    block.dataset.book = data.book;
    block.dataset.chapter = data.chapter;

    if (data.pericope) {
      const pericope = document.createElement('h1');
      pericope.className = 'pericope-title';
      pericope.textContent = data.pericope;
      block.appendChild(pericope);
    }

    const flow = document.createElement('div');
    flow.className = 'verses-flow';
    if (this.isInterlinear) {
      flow.classList.add('interlinear-mode');
    }

    if (data.verses && data.verses.length > 0) {
      data.verses.forEach((v, index) => {
        const vSpan = document.createElement('span');
        vSpan.className = 'verse-item';
        vSpan.dataset.verseNum = v.verse;
        vSpan.dataset.bookCode = data.book;
        vSpan.dataset.chapter = data.chapter;

        if (this.isInterlinear && v.words && v.words.length > 0) {
          vSpan.className = 'verse-item interlinear-mode';
          let wordsHtml = '';
          v.words.forEach(w => {
            const showSurf = this.interlinearLayers.surface;
            const showOrig = this.interlinearLayers.orig && w.orig && w.orig !== w.surface;
            const showTrans = this.interlinearLayers.translit && w.translit;
            const showStrong = this.interlinearLayers.strong && w.strong;

            wordsHtml += `
              <div class="interlinear-block" data-strong="${w.strong || ''}" data-word="${w.orig || w.surface}" data-surface="${w.surface}" title="${w.morph || ''}">
                ${showSurf ? `<span class="interlinear-surface">${w.surface}</span>` : ''}
                ${showOrig ? `<span class="interlinear-lemma">${w.orig}</span>` : ''}
                ${showTrans ? `<span class="interlinear-translit">${w.translit}</span>` : ''}
                ${showStrong ? `<span class="interlinear-strong">${w.strong}</span>` : ''}
              </div>
            `;
          });
          const badgeText = this.interlinearVersion === 'DARBY' ? 'Bible Darby (Interlinéaire Inversé)' : 'Louis Segond 1910 (Interlinéaire Inversé)';
          vSpan.innerHTML = `
            <div class="verse-interlinear-header">
              <sup class="verse-num">${v.verse}</sup>
              <span class="verse-interlinear-badge">${badgeText}</span>
            </div>
            <div class="verse-interlinear-grid">${wordsHtml}</div>
          `;

          vSpan.querySelectorAll('.interlinear-block').forEach(b => {
            b.addEventListener('click', (e) => {
              e.stopPropagation();
              this.lookupWordInLexicon(b.dataset.word, b.dataset.strong);
            });
            b.addEventListener('dblclick', (e) => {
              e.stopPropagation();
              ContextMenuManager.showForWord(b.dataset.surface || b.dataset.word, b.dataset.strong, v.verse, data.book, data.chapter, e.clientX, e.clientY);
            });
            b.addEventListener('contextmenu', (e) => {
              e.preventDefault();
              e.stopPropagation();
              ContextMenuManager.showForWord(b.dataset.surface || b.dataset.word, b.dataset.strong, v.verse, data.book, data.chapter, e.clientX, e.clientY);
            });
          });

        } else {
          // Lecture continue avec mots cliquables
          const isFirst = index === 0;
          const numHtml = isFirst 
            ? `<span class="chapter-number-dropcap">${data.chapter}</span><sup class="verse-num">${v.verse}</sup>`
            : `<sup class="verse-num">${v.verse}</sup>`;

          // Découper le texte en tokens pour permettre le clic/clic droit sur chaque mot
          const cleanText = (v.text || '').replace(/<[^>]+>/g, '');
          const tokens = cleanText.split(/(\s+)/);
          let formattedHtml = numHtml;

          tokens.forEach(tok => {
            if (!tok || /^\s+$/.test(tok)) {
              formattedHtml += tok;
            } else {
              const cleanWord = tok.replace(/^[«"'(]+|[»"') ,;:!?.…]+$/g, '');
              formattedHtml += `<span class="word-token" data-word="${cleanWord}" data-verse="${v.verse}">${tok}</span>`;
            }
          });

          vSpan.innerHTML = formattedHtml;

          // Écouteurs sur chaque mot
          vSpan.querySelectorAll('.word-token').forEach(wEl => {
            const w = wEl.dataset.word;
            // Clic gauche sur mot -> charger le lexique Strong
            wEl.addEventListener('click', (e) => {
              e.stopPropagation();
              document.querySelectorAll('.verse-item').forEach(el => el.classList.remove('selected'));
              vSpan.classList.add('selected');
              this.lookupWordInLexicon(w);
            });

            // Double clic sur mot -> ouvrir menu contextuel
            wEl.addEventListener('dblclick', (e) => {
              e.stopPropagation();
              ContextMenuManager.showForWord(w, null, v.verse, data.book, data.chapter, e.clientX, e.clientY);
            });

            // Clic droit sur mot -> ouvrir menu contextuel
            wEl.addEventListener('contextmenu', (e) => {
              e.preventDefault();
              e.stopPropagation();
              ContextMenuManager.showForWord(w, null, v.verse, data.book, data.chapter, e.clientX, e.clientY);
            });
          });
        }

        // Clic sur le verset (hors mot spécifique ou pour sélectionner) -> charger commentaires
        vSpan.addEventListener('click', () => {
          document.querySelectorAll('.verse-item').forEach(el => el.classList.remove('selected'));
          vSpan.classList.add('selected');
          this.loadCommentariesForVerse(v.verse, data.book, data.chapter);
        });

        // Double clic sur le verset -> menu contextuel verset
        vSpan.addEventListener('dblclick', (e) => {
          if (!e.target.classList.contains('word-token')) {
            ContextMenuManager.showForVerse(v.verse, v.text, data.book, data.chapter, e.clientX, e.clientY);
          }
        });

        // Clic droit sur le verset -> menu contextuel verset
        vSpan.addEventListener('contextmenu', (e) => {
          if (!e.target.classList.contains('word-token')) {
            e.preventDefault();
            ContextMenuManager.showForVerse(v.verse, v.text, data.book, data.chapter, e.clientX, e.clientY);
          }
        });

        flow.appendChild(vSpan);
      });
    }

    block.appendChild(flow);
    return block;
  },

  async loadCommentariesForVerse(verseNum, bookCode = null, chapterNum = null) {
    const book = bookCode || this.currentBook;
    const ch = chapterNum || this.currentChapter;
    const bookInfo = getBookInfo(book);
    const refStr = `${bookInfo.name} ${ch}:${verseNum}`;

    try {
      const comms = await API.getCommentaries(book, ch, verseNum);
      CommentaryViewer.setComments(comms, refStr);
    } catch (e) {
      console.error('Erreur commentaires:', e);
    }
  },

  async lookupWordInLexicon(word, strongCode = null) {
    LexiconViewer.load(word, strongCode);
  },

  openBiblePicker(paneNum) {
    this.targetPaneForPicker = paneNum;
    const popover = document.getElementById('bible-version-picker-popover');
    const listEl = document.getElementById('version-list-items');
    listEl.innerHTML = '';

    const currentSelected = paneNum === 1 ? this.currentBible1 : this.currentBible2;

    this.installedBibles.forEach(b => {
      const btn = document.createElement('button');
      btn.className = `version-row-btn ${b.name === currentSelected ? 'active' : ''}`;
      btn.innerHTML = `
        <span>${b.name}</span>
        <span style="font-size: 10px; opacity: 0.7;">${b.version_code || 'BIBLE'}</span>
      `;
      btn.addEventListener('click', () => {
        this.selectBibleVersion(b.name);
      });
      listEl.appendChild(btn);
    });

    popover.classList.remove('hidden');
  },

  closeBiblePicker() {
    document.getElementById('bible-version-picker-popover').classList.add('hidden');
  },

  selectBibleVersion(versionName) {
    this.closeBiblePicker();
    if (this.targetPaneForPicker === 1) {
      this.currentBible1 = versionName;
      if (versionName === 'DARBY') {
        this.interlinearVersion = 'DARBY';
      } else if (versionName === 'LSG') {
        this.interlinearVersion = 'LSG';
      } else {
        this.isInterlinear = false;
        const interBtn = document.getElementById('btn-toggle-interlinear');
        const masterSwitch = document.getElementById('interlinear-master-switch');
        if (interBtn) interBtn.classList.remove('active');
        if (masterSwitch) masterSwitch.checked = false;
      }
      TabsManager.updateActiveTab(versionName, this.currentBook, this.currentChapter, this.isInterlinear, this.interlinearVersion);
      this.updatePaneHeader(1);
    } else {
      this.currentBible2 = versionName;
      this.updatePaneHeader(2);
    }
    this.navigateTo(this.currentBook, this.currentChapter);
  },

  toggleSplitView(forceState = null) {
    this.isSplitView = forceState !== null ? forceState : !this.isSplitView;
    const paneRight = document.getElementById('pane-right');
    const btnSplit = document.getElementById('btn-toggle-split');

    if (this.isSplitView) {
      paneRight.classList.remove('hidden');
      btnSplit.classList.add('active');
    } else {
      paneRight.classList.add('hidden');
      btnSplit.classList.remove('active');
    }
    this.navigateTo(this.currentBook, this.currentChapter);
  },

  setZoom(percent) {
    this.zoomPercent = Math.max(70, Math.min(180, percent));
    document.getElementById('lbl-zoom-level').textContent = `${this.zoomPercent}%`;
    document.querySelectorAll('.verses-flow').forEach(el => {
      el.style.fontSize = `${19 * (this.zoomPercent / 100)}px`;
    });
  }
};
