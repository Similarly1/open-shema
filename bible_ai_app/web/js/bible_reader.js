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
      chosenBible = BibleReader.installedBibles[0]?.name || 'Segond 21';
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
    BibleReader.pane1IsInterlinear = !!target.isInterlinear;
    BibleReader.pane1InterlinearVersion = target.interlinearVersion || 'LSG';

    // Mettre à jour l'état visuel du bouton et du menu Interlinéaire
    const interBtn = document.getElementById('btn-toggle-interlinear');
    if (interBtn) interBtn.classList.toggle('active', BibleReader.pane1IsInterlinear || BibleReader.pane2IsInterlinear);

    InterlinearMenu.syncPopoverUI();

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
  currentBg: 'auto',

  async init() {
    const btn = document.getElementById('btn-display-options');
    const popover = document.getElementById('display-options-popover');
    const workspace = document.getElementById('reader-workspace');

    if (!btn || !popover) return;

    const updateActiveSwatch = (bgKey) => {
      this.currentBg = bgKey || 'auto';
      document.querySelectorAll('.reading-bg-quick-swatch').forEach(sw => {
        sw.classList.toggle('active', sw.dataset.bg === this.currentBg);
      });
    };

    // Synchronisation de l'état actif et options au démarrage
    try {
      const cfg = await API.getSettings() || {};
      updateActiveSwatch(cfg.reading_bg || 'auto');
      const showDiv = cfg.show_chapter_dividers !== false;
      const chkDiv = document.getElementById('opt-show-chap-dividers');
      if (chkDiv) chkDiv.checked = showDiv;
      workspace?.classList.toggle('hide-chap-dividers', !showDiv);
    } catch (e) {}

    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        const cfg = await API.getSettings() || {};
        updateActiveSwatch(cfg.reading_bg || 'auto');
        const showDiv = cfg.show_chapter_dividers !== false;
        const chkDiv = document.getElementById('opt-show-chap-dividers');
        if (chkDiv) chkDiv.checked = showDiv;
        workspace?.classList.toggle('hide-chap-dividers', !showDiv);
      } catch (e) {}
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

    document.getElementById('opt-show-chap-dividers')?.addEventListener('change', async (e) => {
      workspace?.classList.toggle('hide-chap-dividers', !e.target.checked);
      const cfg = await API.getSettings() || {};
      cfg.show_chapter_dividers = e.target.checked;
      const cfgCheck = document.getElementById('cfg-show-chap-dividers');
      if (cfgCheck) cfgCheck.checked = e.target.checked;
      API.call('save_settings', cfg);
    });

    document.getElementById('opt-font-serif')?.addEventListener('change', (e) => {
      workspace?.classList.toggle('font-sans', !e.target.checked);
    });

    // Clic sur les 4 pastilles visuelles de fond de lecture
    document.querySelectorAll('.reading-bg-quick-swatch').forEach(sw => {
      sw.addEventListener('click', async () => {
        const bgKey = sw.dataset.bg || 'auto';
        updateActiveSwatch(bgKey);

        const cfg = await API.getSettings() || {};
        cfg.reading_bg = bgKey;
        const bgHiddenInput = document.getElementById('cfg-reading-bg');
        if (bgHiddenInput) bgHiddenInput.value = bgKey;

        App.applyTheme(cfg.theme, cfg.theme_palette, bgKey);
        await API.call('save_settings', cfg);
        popover.classList.add('hidden');
      });
    });
  }
};


// 3b. MENU OPTIONS INTERLINÉAIRE INVERSÉ (Style Logos)
const InterlinearMenu = {
  currentTargetPane: '1',

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
      this.syncPopoverUI();
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

    // Gestion du choix de la fenêtre cible (Gauche / Droite / Les deux)
    document.querySelectorAll('.target-pane-pill').forEach(pill => {
      pill.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelectorAll('.target-pane-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.currentTargetPane = pill.dataset.pane || '1';
        this.syncPopoverUI();
      });
    });

    if (masterSwitch) {
      masterSwitch.addEventListener('change', (e) => {
        const checked = e.target.checked;
        if (this.currentTargetPane === '1') {
          BibleReader.pane1IsInterlinear = checked;
        } else if (this.currentTargetPane === '2') {
          BibleReader.pane2IsInterlinear = checked;
        } else if (this.currentTargetPane === 'both') {
          BibleReader.pane1IsInterlinear = checked;
          BibleReader.pane2IsInterlinear = checked;
        }

        btn.classList.toggle('active', BibleReader.pane1IsInterlinear || BibleReader.pane2IsInterlinear);
        TabsManager.updateActiveTab(null, null, null, BibleReader.pane1IsInterlinear, BibleReader.pane1InterlinearVersion);
        BibleReader.updatePaneHeader(1);
        if (BibleReader.isSplitView) BibleReader.updatePaneHeader(2);
        BibleReader.reloadCurrentChapters();
      });
    }

    document.querySelectorAll('input[name="interlinear-version-radio"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        const val = e.target.value;
        if (this.currentTargetPane === '1') {
          BibleReader.pane1InterlinearVersion = val;
        } else if (this.currentTargetPane === '2') {
          BibleReader.pane2InterlinearVersion = val;
        } else if (this.currentTargetPane === 'both') {
          BibleReader.pane1InterlinearVersion = val;
          BibleReader.pane2InterlinearVersion = val;
        }

        if (radioLSG) radioLSG.classList.toggle('active', val === 'LSG');
        if (radioDarby) radioDarby.classList.toggle('active', val === 'DARBY');

        TabsManager.updateActiveTab(null, null, null, BibleReader.pane1IsInterlinear, BibleReader.pane1InterlinearVersion);
        BibleReader.updatePaneHeader(1);
        if (BibleReader.isSplitView) BibleReader.updatePaneHeader(2);
        BibleReader.reloadCurrentChapters();
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
      if (BibleReader.pane1IsInterlinear || BibleReader.pane2IsInterlinear) {
        BibleReader.reloadCurrentChapters();
      }
    };

    if (layerSurface) layerSurface.addEventListener('change', onLayerChanged);
    if (layerOrig) layerOrig.addEventListener('change', onLayerChanged);
    if (layerTranslit) layerTranslit.addEventListener('change', onLayerChanged);
    if (layerStrong) layerStrong.addEventListener('change', onLayerChanged);
  },

  syncPopoverUI() {
    const targetBox = document.getElementById('interlinear-target-container');
    if (targetBox) {
      targetBox.style.display = BibleReader.isSplitView ? 'flex' : 'none';
    }

    const masterSwitch = document.getElementById('interlinear-master-switch');
    const radioLSG = document.getElementById('lbl-inter-lsg');
    const radioDarby = document.getElementById('lbl-inter-darby');

    let isTargetActive = false;
    let targetVersion = 'LSG';

    if (this.currentTargetPane === '1') {
      isTargetActive = BibleReader.pane1IsInterlinear;
      targetVersion = BibleReader.pane1InterlinearVersion || 'LSG';
    } else if (this.currentTargetPane === '2') {
      isTargetActive = BibleReader.pane2IsInterlinear;
      targetVersion = BibleReader.pane2InterlinearVersion || 'DARBY';
    } else {
      isTargetActive = BibleReader.pane1IsInterlinear || BibleReader.pane2IsInterlinear;
      targetVersion = BibleReader.pane1InterlinearVersion || 'LSG';
    }

    if (masterSwitch) masterSwitch.checked = isTargetActive;
    const radioInput = document.querySelector(`input[name="interlinear-version-radio"][value="${targetVersion}"]`);
    if (radioInput) radioInput.checked = true;
    if (radioLSG) radioLSG.classList.toggle('active', targetVersion === 'LSG');
    if (radioDarby) radioDarby.classList.toggle('active', targetVersion === 'DARBY');
  }
};


// 4. GESTIONNAIRE INDIVIDUEL DE COMMENTAIRES (Style Logos)
const CommentaryViewer = {
  currentComments: [],
  activeIndex: 0,
  preferredAuthor: null, // Auteur/ouvrage mémorisé pour rester constant lors de la navigation
  currentVerseRef: '',

  init() {
    const btn = document.getElementById('btn-select-comm-source');
    const popover = document.getElementById('comm-sources-popover');

    btn?.addEventListener('click', (e) => {
      e.stopPropagation();
      popover?.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
      if (popover && !popover.contains(e.target) && e.target !== btn) {
        popover.classList.add('hidden');
      }
    });
  },

  setComments(comments, verseRef) {
    this.currentComments = comments || [];
    this.currentVerseRef = verseRef || '';

    const countEl = document.getElementById('comm-popover-count');
    const listEl = document.getElementById('comm-sources-list');
    const badgeEl = document.getElementById('comm-selected-verse');

    if (badgeEl) badgeEl.textContent = verseRef;
    if (countEl) countEl.textContent = this.currentComments.length;
    if (listEl) listEl.innerHTML = '';

    // Si aucun auteur préféré n'a encore été choisi, initialiser avec le premier disponible
    if (!this.preferredAuthor && this.currentComments.length > 0) {
      this.preferredAuthor = this.currentComments[0].author || this.currentComments[0].source;
    }

    // Peupler le popover de sélection de source
    if (this.currentComments.length > 0) {
      this.currentComments.forEach((c, idx) => {
        const authorName = c.author || c.source || `Commentaire ${idx + 1}`;
        const isMatch = this.preferredAuthor && authorName.toLowerCase() === this.preferredAuthor.toLowerCase();
        const item = document.createElement('button');
        item.className = `comm-source-item ${isMatch ? 'active' : ''}`;
        item.innerHTML = `<span>📖 ${authorName}</span>`;
        item.addEventListener('click', () => {
          this.preferredAuthor = authorName;
          this.selectCommentary(idx);
          document.getElementById('comm-sources-popover')?.classList.add('hidden');
        });
        listEl?.appendChild(item);
      });
    }

    // 1. Chercher si l'auteur préféré est présent pour ce verset
    let targetIndex = -1;
    if (this.preferredAuthor && this.currentComments.length > 0) {
      targetIndex = this.currentComments.findIndex(c => {
        const aName = c.author || c.source || '';
        return aName.toLowerCase() === this.preferredAuthor.toLowerCase();
      });
    }

    if (targetIndex !== -1) {
      // L'auteur préféré commente ce verset -> afficher directement son analyse
      this.selectCommentary(targetIndex);
    } else {
      // L'auteur préféré n'a pas de note sur ce verset -> afficher la vue sobre avec suggestions
      this.renderAbsentPreferredAuthor();
    }
  },

  selectCommentary(index) {
    if (!this.currentComments[index]) return;
    this.activeIndex = index;

    const comm = this.currentComments[index];
    const authorName = comm.author || comm.source || 'Commentaire';
    this.preferredAuthor = authorName;

    const lbl = document.getElementById('lbl-active-comm-source');
    if (lbl) lbl.textContent = authorName;

    document.querySelectorAll('.comm-source-item').forEach((item, idx) => {
      item.classList.toggle('active', idx === index);
    });

    const container = document.getElementById('commentary-single-view');
    if (!container) return;

    container.innerHTML = `
      <div class="comm-single-author-header">
        <span class="comm-single-author-badge">📖 ${authorName}</span>
      </div>
      <div class="comm-single-body">
        ${(comm.text || '').replace(/\n\n/g, '<br><br>')}
      </div>
    `;
  },

  renderAbsentPreferredAuthor() {
    const authorName = this.preferredAuthor || 'Commentaire';
    const lbl = document.getElementById('lbl-active-comm-source');
    if (lbl) lbl.textContent = `${authorName}`;

    document.querySelectorAll('.comm-source-item').forEach(item => {
      item.classList.remove('active');
    });

    const container = document.getElementById('commentary-single-view');
    if (!container) return;

    const hasOtherComments = this.currentComments && this.currentComments.length > 0;

    let suggestionsHtml = '';
    if (hasOtherComments) {
      suggestionsHtml = `
        <div class="comm-suggestions-box" style="margin-top: 20px; background: var(--bg-subtle); border: 1px solid var(--border-color); border-radius: 8px; padding: 14px; text-align: left;">
          <div style="font-size: 11px; font-weight: 700; color: var(--accent-blue); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between;">
            <span>✨ Autres commentaires pour ce verset :</span>
            <span style="background: rgba(2, 132, 199, 0.15); color: var(--accent-blue); padding: 1px 7px; border-radius: 10px; font-size: 10px; font-weight: 700;">${this.currentComments.length}</span>
          </div>
          <div style="display: flex; flex-direction: column; gap: 6px;">
            ${this.currentComments.map((c, idx) => `
              <button class="comm-suggestion-btn" data-idx="${idx}" style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 6px; padding: 9px 12px; font-size: 12px; text-align: left; cursor: pointer; display: flex; align-items: center; justify-content: space-between; transition: all 0.15s ease;">
                <span style="font-weight: 600; color: var(--text-primary);">📖 ${c.author || c.source}</span>
                <span style="font-size: 11px; color: var(--accent-blue); font-weight: 600;">Consulter ➔</span>
              </button>
            `).join('')}
          </div>
        </div>
      `;
    } else {
      suggestionsHtml = `
        <div style="font-size: 12px; color: var(--text-muted); background: var(--bg-subtle); border-radius: 6px; padding: 12px; border: 1px dashed var(--border-color); margin-top: 16px;">
          Aucun autre ouvrage de commentaire n'est disponible pour ce verset.
        </div>
      `;
    }

    container.innerHTML = `
      <div class="comm-absent-view" style="padding: 16px 8px; text-align: center;">
        <div style="display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 50%; background: var(--bg-subtle); color: var(--text-secondary); font-size: 20px; margin-bottom: 12px; border: 1px solid var(--border-color);">
          📖
        </div>
        <div style="font-size: 14px; font-weight: 700; color: var(--text-primary); margin-bottom: 4px;">
          ${authorName}
        </div>
        <div style="font-size: 12px; color: var(--text-muted); line-height: 1.5; max-width: 320px; margin: 0 auto;">
          Cet ouvrage ne comporte pas de note directe pour le verset <strong>${this.currentVerseRef || ''}</strong>.
        </div>
        ${suggestionsHtml}
      </div>
    `;

    // Écouteurs sur les suggestions rapides
    container.querySelectorAll('.comm-suggestion-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx);
        this.selectCommentary(idx);
      });
      btn.addEventListener('mouseenter', () => {
        btn.style.borderColor = 'var(--accent-blue)';
        btn.style.transform = 'translateX(2px)';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.borderColor = 'var(--border-color)';
        btn.style.transform = 'translateX(0)';
      });
    });
  }
};


// 4bis. GESTIONNAIRE DE NOTES DU VOLET DROIT (Bible à gauche, Notes à droite)
const DrawerNotesViewer = {
  currentBook: 'Gen',
  currentChapter: 1,
  currentVerse: null,
  currentNotes: [],
  editingNoteId: null,

  init() {
    // Bouton + Note en haut de l'onglet
    document.getElementById('btn-drawer-new-note')?.addEventListener('click', () => {
      this.openComposer();
    });

    // Bouton Plein écran
    document.getElementById('btn-drawer-full-notes')?.addEventListener('click', () => {
      App.switchView('notes');
      const bInfo = getBookInfo(this.currentBook);
      const refStr = `${bInfo.name} ${this.currentChapter}${this.currentVerse ? `:${this.currentVerse}` : ''}`;
      NotesView.createNewNote(refStr);
    });

    // Enregistrer note rapide
    document.getElementById('btn-drawer-save-note')?.addEventListener('click', () => {
      this.saveQuickNote();
    });
  },

  async load(bookCode, chapterNum, verseNum = null) {
    this.currentBook = bookCode || BibleReader.currentBook || 'Gen';
    this.currentChapter = chapterNum || BibleReader.currentChapter || 1;
    this.currentVerse = verseNum || BibleReader.selectedVerse || null;

    const bInfo = getBookInfo(this.currentBook);
    const refStr = `${bInfo.name} ${this.currentChapter}${this.currentVerse ? `:${this.currentVerse}` : ''}`;

    const badgeEl = document.getElementById('notes-drawer-passage-badge');
    const composerRefEl = document.getElementById('drawer-composer-ref');
    if (badgeEl) badgeEl.textContent = refStr;
    if (composerRefEl) composerRefEl.textContent = refStr;

    const listEl = document.getElementById('drawer-notes-list');
    if (listEl) {
      listEl.innerHTML = `<div style="padding: 12px; color: var(--text-muted); font-size: 12px; text-align: center;">Chargement des notes...</div>`;
    }

    try {
      this.currentNotes = await API.call('get_notes_for_passage', this.currentBook, this.currentChapter, this.currentVerse) || [];
      this.renderList();
    } catch (e) {
      console.error('Erreur chargement notes volet droit:', e);
      if (listEl) listEl.innerHTML = `<div style="color: var(--accent-red); font-size: 12px; padding: 10px;">Erreur chargement notes.</div>`;
    }
  },

  renderList() {
    const listEl = document.getElementById('drawer-notes-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    if (this.currentNotes.length === 0) {
      listEl.innerHTML = `
        <div style="padding: 16px 12px; text-align: center; color: var(--text-muted); font-size: 12px; background: var(--bg-subtle); border-radius: 6px; border: 1px dashed var(--border-color);">
          <span style="font-size: 22px; display: block; margin-bottom: 4px;">📝</span>
          Aucune note pour ce passage.<br>
          <span style="font-size: 11px;">Rédigez une réflexion ci-dessous.</span>
        </div>
      `;
      return;
    }

    this.currentNotes.forEach((n) => {
      const card = document.createElement('div');
      card.className = 'drawer-note-card';
      card.style.cssText = 'background: var(--bg-subtle); border: 1px solid var(--border-color); border-radius: 6px; padding: 10px; margin-bottom: 8px; cursor: pointer;';
      
      const aiBadge = n.include_in_ai !== false ? '<span title="Prise en compte par l\'IA" style="font-size: 11px;">🤖 IA</span>' : '<span title="Non transmise à l\'IA" style="font-size: 10px; color: var(--text-muted);">🔒 Privée</span>';
      
      card.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
          <strong style="font-size: 13px; color: var(--text-primary);">${n.title || 'Note sans titre'}</strong>
          <div style="display: flex; gap: 6px; align-items: center;">
            <span style="font-size: 10px; font-weight: 600; color: var(--accent-blue); background: var(--bg-hover); padding: 2px 6px; border-radius: 4px;">${n.reference || ''}</span>
            ${aiBadge}
          </div>
        </div>
        <div style="font-size: 12px; color: var(--text-secondary); line-height: 1.4; max-height: 60px; overflow: hidden; text-overflow: ellipsis; margin-bottom: 6px;">
          ${(n.content || '').replace(/#+\s/g, '').slice(0, 140)}...
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: var(--text-muted);">
          <span>Modifié : ${n.updated_at || ''}</span>
          <div style="display: flex; gap: 8px;">
            <button class="btn-link btn-open-full" style="color: var(--accent-blue); font-size: 11px; background: none; border: none; cursor: pointer; text-decoration: underline;">Ouvrir ↗</button>
            <button class="btn-link btn-del-drawer" style="color: var(--accent-red); font-size: 11px; background: none; border: none; cursor: pointer;">🗑️</button>
          </div>
        </div>
      `;

      card.querySelector('.btn-open-full')?.addEventListener('click', (e) => {
        e.stopPropagation();
        App.switchView('notes');
        NotesView.selectNote(n);
      });

      card.querySelector('.btn-del-drawer')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm(`Supprimer la note « ${n.title} » ?`)) {
          await API.call('delete_note', n.id);
          App.showToast('Note supprimée');
          this.load(this.currentBook, this.currentChapter, this.currentVerse);
          NotesView.loadNotes();
        }
      });

      card.addEventListener('click', () => {
        this.populateComposerWithNote(n);
      });

      listEl.appendChild(card);
    });
  },

  openComposer(initialTitle = '', initialContent = '') {
    const titleInp = document.getElementById('drawer-note-title-input');
    const contentInp = document.getElementById('drawer-note-content-input');
    const bInfo = getBookInfo(this.currentBook);
    const refStr = `${bInfo.name} ${this.currentChapter}${this.currentVerse ? `:${this.currentVerse}` : ''}`;
    
    this.editingNoteId = null;
    const titleHeader = document.getElementById('drawer-composer-title');
    if (titleHeader) titleHeader.textContent = '✍️ Rédiger une note';

    if (titleInp) {
      titleInp.value = initialTitle || `Note sur ${refStr}`;
      titleInp.focus();
    }
    if (contentInp) contentInp.value = initialContent || '';
  },

  populateComposerWithNote(note) {
    const titleInp = document.getElementById('drawer-note-title-input');
    const contentInp = document.getElementById('drawer-note-content-input');
    const aiToggle = document.getElementById('drawer-note-ai-toggle');
    const titleHeader = document.getElementById('drawer-composer-title');

    if (titleInp) titleInp.value = note.title || '';
    if (contentInp) contentInp.value = note.content || '';
    if (aiToggle) aiToggle.checked = note.include_in_ai !== false;
    if (titleHeader) titleHeader.textContent = '✏️ Modifier la note';
    this.editingNoteId = note.id;
  },

  async saveQuickNote() {
    const titleInp = document.getElementById('drawer-note-title-input');
    const contentInp = document.getElementById('drawer-note-content-input');
    const aiToggle = document.getElementById('drawer-note-ai-toggle');

    const bInfo = getBookInfo(this.currentBook);
    const refStr = `${bInfo.name} ${this.currentChapter}${this.currentVerse ? `:${this.currentVerse}` : ''}`;

    const noteToSave = {
      id: this.editingNoteId || null,
      title: titleInp?.value.trim() || `Note sur ${refStr}`,
      reference: refStr,
      tags: '',
      include_in_ai: aiToggle?.checked !== false,
      content: contentInp?.value || ''
    };

    try {
      await API.call('save_note', noteToSave);
      App.showToast('Note enregistrée en Markdown (.md) !');
      this.editingNoteId = null;
      if (titleInp) titleInp.value = '';
      if (contentInp) contentInp.value = '';
      const titleHeader = document.getElementById('drawer-composer-title');
      if (titleHeader) titleHeader.textContent = '✍️ Rédiger une note';
      
      this.load(this.currentBook, this.currentChapter, this.currentVerse);
      NotesView.loadNotes();
    } catch (e) {
      alert(`Erreur sauvegarde note : ${e}`);
    }
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
      const drawer = document.getElementById('right-drawer');
      drawer?.classList.remove('collapsed');
      document.querySelector('.drawer-tab[data-drawer-tab="notes"]')?.click();
      DrawerNotesViewer.load(bookCode, chapterNum, verseNum);
      DrawerNotesViewer.openComposer(`Note sur ${refStr}`, '');
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
        <div style="font-family: var(--font-bible); font-size: 15px; line-height: 1.7; color: var(--text-primary);" id="match-body-text" class="dict-entry-body">${textToRender}</div>
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
  currentBible1: 'Segond 21',
  currentBible2: 'BDS',
  
  isSplitView: false,
  isScrollSynced: true,
  isSyncingScroll: false,

  pane1IsInterlinear: false,
  pane1InterlinearVersion: 'LSG',
  pane2IsInterlinear: false,
  pane2InterlinearVersion: 'DARBY',

  get isInterlinear() {
    return this.pane1IsInterlinear || this.pane2IsInterlinear;
  },
  set isInterlinear(val) {
    this.pane1IsInterlinear = !!val;
  },

  get interlinearVersion() {
    return this.pane1InterlinearVersion || 'LSG';
  },
  set interlinearVersion(val) {
    this.pane1InterlinearVersion = val;
  },

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
    DrawerNotesViewer.init();
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

    // Surlignage synchronisé au survol des versets en double vue
    const workspace = document.getElementById('reader-workspace');
    if (workspace) {
      workspace.addEventListener('mouseover', (e) => {
        if (!this.isSplitView) return;
        const vItem = e.target.closest('.verse-item');
        if (!vItem) return;
        
        const bCode = vItem.dataset.bookCode;
        const ch = vItem.dataset.chapter;
        const vNum = vItem.dataset.verseNum;
        if (!bCode || !ch || !vNum) return;

        workspace.querySelectorAll(`.verse-item[data-book-code="${bCode}"][data-chapter="${ch}"][data-verse-num="${vNum}"]`).forEach(el => {
          el.classList.add('synced-hover');
        });
      });

      workspace.addEventListener('mouseout', (e) => {
        if (!this.isSplitView) return;
        const vItem = e.target.closest('.verse-item');
        if (!vItem) return;
        
        workspace.querySelectorAll('.verse-item.synced-hover').forEach(el => {
          el.classList.remove('synced-hover');
        });
      });
    }
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

    // Liens rapides de la barre d'outils du lecteur
    document.getElementById('mode-notes-inline')?.addEventListener('click', () => {
      const drawer = document.getElementById('right-drawer');
      const notesTab = document.querySelector('.drawer-tab[data-drawer-tab="notes"]');
      const isNotesOpen = !drawer?.classList.contains('collapsed') && notesTab?.classList.contains('active');
      if (isNotesOpen) {
        drawer?.classList.add('collapsed');
        document.getElementById('btn-toggle-right-drawer')?.classList.remove('active');
      } else {
        drawer?.classList.remove('collapsed');
        document.getElementById('btn-toggle-right-drawer')?.classList.add('active');
        notesTab?.click();
        DrawerNotesViewer.load(this.currentBook, this.currentChapter, this.selectedVerse || 1);
      }
    });

    document.getElementById('mode-search-inline')?.addEventListener('click', () => {
      App.switchView('search');
    });

    document.getElementById('btn-toggle-split')?.addEventListener('click', () => {
      this.toggleSplitView();
    });

    document.getElementById('btn-toggle-sync-scroll')?.addEventListener('click', () => {
      if (!this.isSplitView) {
        this.toggleSplitView(true);
        this.toggleSyncScroll(true);
      } else {
        this.toggleSyncScroll();
      }
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
      if (drawer) {
        drawer.classList.toggle('collapsed');
        document.getElementById('btn-toggle-right-drawer')?.classList.toggle('active', !drawer.classList.contains('collapsed'));
      }
    });

    document.getElementById('btn-collapse-drawer')?.addEventListener('click', () => {
      const drawer = document.getElementById('right-drawer');
      drawer?.classList.add('collapsed');
      document.getElementById('btn-toggle-right-drawer')?.classList.remove('active');
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
      const el = document.getElementById('pane-1-bible-name');
      if (!el) return;
      if (this.pane1IsInterlinear) {
        const interLabel = this.pane1InterlinearVersion === 'DARBY' ? 'Darby (Interlinéaire)' : 'LSG 1910 (Interlinéaire)';
        el.textContent = interLabel;
      } else {
        el.textContent = this.currentBible1;
      }
    } else if (paneNum === 2) {
      const el = document.getElementById('pane-2-bible-name');
      if (!el) return;
      if (this.pane2IsInterlinear) {
        const interLabel = this.pane2InterlinearVersion === 'DARBY' ? 'Darby (Interlinéaire)' : 'LSG 1910 (Interlinéaire)';
        el.textContent = interLabel;
      } else {
        el.textContent = this.currentBible2;
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
    const paneRight = document.getElementById('pane-right');
    const btnSplit = document.getElementById('btn-toggle-split');
    const btnSync = document.getElementById('btn-toggle-sync-scroll');

    if (workspace) workspace.classList.toggle('split-view', this.isSplitView);
    if (paneRight) paneRight.classList.toggle('hidden', !this.isSplitView);
    if (btnSplit) btnSplit.classList.toggle('active', this.isSplitView);

    if (this.isSplitView) {
      if (btnSync) {
        btnSync.classList.remove('hidden');
        btnSync.classList.toggle('active', this.isScrollSynced);
      }
      // Si la bible 2 n'est pas définie ou identique à la bible 1, sélectionner une alternative
      if (!this.currentBible2 || this.currentBible2 === this.currentBible1) {
        const other = (this.installedBibles || []).find(b => b.name !== this.currentBible1);
        if (other) this.currentBible2 = other.name;
      }
      this.updatePaneHeader(2);
      this.reloadPane2();
    } else {
      if (btnSync) btnSync.classList.add('hidden');
    }
  },

  toggleSyncScroll(forceState = null) {
    this.isScrollSynced = forceState !== null ? forceState : !this.isScrollSynced;
    const btnSync = document.getElementById('btn-toggle-sync-scroll');
    if (btnSync) {
      btnSync.classList.toggle('active', this.isScrollSynced);
    }
    
    if (this.isScrollSynced && this.isSplitView) {
      const pane1 = document.getElementById('pane-1-content');
      const pane2 = document.getElementById('pane-2-content');
      if (pane1 && pane2) {
        this.syncScrollToMatch(pane1, pane2);
      }
      App.showToast('Défilement synchronisé activé (alignement verset)');
    } else if (!this.isScrollSynced && this.isSplitView) {
      App.showToast('Défilement synchronisé désactivé');
    }
  },

  getTopVisibleVerse(container) {
    if (!container) return null;
    const verses = container.querySelectorAll('.verse-item');
    if (!verses || verses.length === 0) return null;
    const containerTop = container.getBoundingClientRect().top;

    for (const v of verses) {
      const rect = v.getBoundingClientRect();
      if (rect.bottom >= containerTop + 5) {
        return {
          book: v.dataset.bookCode,
          chapter: v.dataset.chapter,
          verse: v.dataset.verseNum,
          element: v,
          rect: rect
        };
      }
    }
    return null;
  },

  syncScrollToMatch(sourceContainer, targetContainer) {
    if (!this.isSplitView || !this.isScrollSynced || this.isSyncingScroll) return;
    if (!sourceContainer || !targetContainer) return;

    const topVerse = this.getTopVisibleVerse(sourceContainer);
    if (!topVerse || !topVerse.book || !topVerse.chapter || !topVerse.verse || !topVerse.element) return;

    const targetVerse = targetContainer.querySelector(
      `.verse-item[data-book-code="${topVerse.book}"][data-chapter="${topVerse.chapter}"][data-verse-num="${topVerse.verse}"]`
    );

    if (targetVerse) {
      this.isSyncingScroll = true;

      const sourceContainerTop = sourceContainer.getBoundingClientRect().top;
      const targetContainerTop = targetContainer.getBoundingClientRect().top;
      const sourceVerseTop = topVerse.element.getBoundingClientRect().top;
      const targetVerseTop = targetVerse.getBoundingClientRect().top;

      // Calcul ultra-précis du décalage relatif par rapport au haut du conteneur respectif
      const sourceOffsetFromTop = sourceVerseTop - sourceContainerTop;
      const targetOffsetFromTop = targetVerseTop - targetContainerTop;
      const scrollDelta = targetOffsetFromTop - sourceOffsetFromTop;

      if (Math.abs(scrollDelta) > 1) {
        targetContainer.scrollTop += scrollDelta;
      }

      setTimeout(() => {
        this.isSyncingScroll = false;
      }, 50);
    }
  },

  async reloadPane2() {
    if (!this.isSplitView) return;
    const pane2Container = document.getElementById('pane-2-verses');
    if (!pane2Container) return;
    pane2Container.innerHTML = '';
    
    const chaptersToLoad = this.loadedChapters.length > 0 ? this.loadedChapters : [{ book: this.currentBook, chapter: this.currentChapter }];

    for (let i = 0; i < chaptersToLoad.length; i++) {
      const c = chaptersToLoad[i];
      const data2 = await API.getChapterData(this.currentBible2, c.book, c.chapter, this.pane2IsInterlinear ? this.pane2InterlinearVersion : null);
      const block2 = this.createChapterBlockElement(2, data2, this.currentBible2);
      
      if (i > 0) {
        const divider2 = document.createElement('div');
        divider2.className = 'chapter-badge-divider';
        divider2.innerHTML = `<span>${data2.book_french} — Chapitre ${data2.chapter}</span>`;
        pane2Container.appendChild(divider2);
      }
      pane2Container.appendChild(block2);
    }

    if (this.isScrollSynced) {
      const pane1 = document.getElementById('pane-1-content');
      const pane2 = document.getElementById('pane-2-content');
      setTimeout(() => {
        this.syncScrollToMatch(pane1, pane2);
      }, 50);
    }
  },

  setupInfiniteScroll() {
    const pane1 = document.getElementById('pane-1-content');
    const pane2 = document.getElementById('pane-2-content');

    const handleScroll = (sourcePane, targetPane) => {
      if (this.isLoadingMore) return;
      const { scrollTop, scrollHeight, clientHeight } = sourcePane;

      // Défilement vers le bas -> charger le chapitre suivant
      if (scrollTop + clientHeight >= scrollHeight - 250) {
        this.loadNextChapterContinuous();
      }

      // Défilement vers le haut -> charger le chapitre précédent
      if (scrollTop <= 50) {
        this.loadPrevChapterContinuous(sourcePane);
      }

      // Mettre à jour l'en-tête du livre / chapitres
      this.updateCurrentlyVisibleHeader(sourcePane);

      // Synchronisation du défilement
      if (this.isSplitView && this.isScrollSynced && targetPane && !this.isSyncingScroll) {
        this.syncScrollToMatch(sourcePane, targetPane);
      }
    };

    if (pane1) {
      pane1.addEventListener('scroll', () => {
        handleScroll(pane1, pane2);
      });
    }

    if (pane2) {
      pane2.addEventListener('scroll', () => {
        handleScroll(pane2, pane1);
      });
    }
  },

  updateCurrentlyVisibleHeader(container) {
    if (!container) return;
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
          const breadcrumb2 = document.getElementById('pane-2-breadcrumb');
          if (breadcrumb2) breadcrumb2.textContent = `${info.name.toUpperCase()} > Chapitre ${ch}`;
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
    const breadcrumb2 = document.getElementById('pane-2-breadcrumb');
    if (breadcrumb2) breadcrumb2.textContent = `${info.name.toUpperCase()} > Chapitre ${chapterNum}`;
    this.updatePaneHeader(1);

    const pane1Container = document.getElementById('pane-1-verses');
    if (pane1Container) pane1Container.innerHTML = '';

    const data1 = await API.getChapterData(this.currentBible1, bookCode, chapterNum, this.pane1IsInterlinear ? this.pane1InterlinearVersion : null);
    const block1 = this.createChapterBlockElement(1, data1, this.currentBible1);
    if (pane1Container) pane1Container.appendChild(block1);

    if (this.isSplitView) {
      const pane2Container = document.getElementById('pane-2-verses');
      if (pane2Container) pane2Container.innerHTML = '';
      this.updatePaneHeader(2);
      const data2 = await API.getChapterData(this.currentBible2, bookCode, chapterNum, this.pane2IsInterlinear ? this.pane2InterlinearVersion : null);
      const block2 = this.createChapterBlockElement(2, data2, this.currentBible2);
      if (pane2Container) pane2Container.appendChild(block2);
      
      const pane2 = document.getElementById('pane-2-content');
      if (pane2) pane2.scrollTop = 0;

      if (this.isScrollSynced) {
        const pane1 = document.getElementById('pane-1-content');
        setTimeout(() => {
          this.syncScrollToMatch(pane1, pane2);
        }, 60);
      }
    }

    const pane1 = document.getElementById('pane-1-content');
    if (pane1) pane1.scrollTop = 0;
    this.loadCommentariesForVerse(1);
    TabsManager.updateActiveTab(null, bookCode, chapterNum);
  },

  async reloadCurrentChapters() {
    const chaptersToReload = [...this.loadedChapters];
    const pane1Container = document.getElementById('pane-1-verses');
    if (pane1Container) pane1Container.innerHTML = '';

    for (let i = 0; i < chaptersToReload.length; i++) {
      const c = chaptersToReload[i];
      const data = await API.getChapterData(this.currentBible1, c.book, c.chapter, this.pane1IsInterlinear ? this.pane1InterlinearVersion : null);
      const block = this.createChapterBlockElement(1, data, this.currentBible1);
      if (i > 0) {
        const divider = document.createElement('div');
        divider.className = 'chapter-badge-divider';
        divider.innerHTML = `<span>${data.book_french} — Chapitre ${data.chapter}</span>`;
        pane1Container.appendChild(divider);
      }
      pane1Container.appendChild(block);
    }

    if (this.isSplitView) {
      const pane2Container = document.getElementById('pane-2-verses');
      if (pane2Container) pane2Container.innerHTML = '';
      for (let i = 0; i < chaptersToReload.length; i++) {
        const c = chaptersToReload[i];
        const data2 = await API.getChapterData(this.currentBible2, c.book, c.chapter, this.pane2IsInterlinear ? this.pane2InterlinearVersion : null);
        const block2 = this.createChapterBlockElement(2, data2, this.currentBible2);
        if (i > 0) {
          const divider2 = document.createElement('div');
          divider2.className = 'chapter-badge-divider';
          divider2.innerHTML = `<span>${data2.book_french} — Chapitre ${data2.chapter}</span>`;
          pane2Container.appendChild(divider2);
        }
        pane2Container.appendChild(block2);
      }
    }
  },

  async loadNextChapterContinuous() {
    if (this.isLoadingMore || this.loadedChapters.length === 0) return;
    const last = this.loadedChapters[this.loadedChapters.length - 1];
    const next = getNextChapterCoord(last.book, last.chapter);
    if (!next) return;

    this.isLoadingMore = true;
    this.loadedChapters.push(next);

    // Colonne 1
    const data1 = await API.getChapterData(this.currentBible1, next.book, next.chapter, this.pane1IsInterlinear ? this.pane1InterlinearVersion : null);
    const block1 = this.createChapterBlockElement(1, data1, this.currentBible1);

    const divider1 = document.createElement('div');
    divider1.className = 'chapter-badge-divider';
    divider1.innerHTML = `<span>${data1.book_french} — Chapitre ${data1.chapter}</span>`;

    const pane1Container = document.getElementById('pane-1-verses');
    if (pane1Container) {
      pane1Container.appendChild(divider1);
      pane1Container.appendChild(block1);
    }

    // Colonne 2 (si double vue)
    if (this.isSplitView) {
      const data2 = await API.getChapterData(this.currentBible2, next.book, next.chapter, this.pane2IsInterlinear ? this.pane2InterlinearVersion : null);
      const block2 = this.createChapterBlockElement(2, data2, this.currentBible2);

      const divider2 = document.createElement('div');
      divider2.className = 'chapter-badge-divider';
      divider2.innerHTML = `<span>${data2.book_french} — Chapitre ${data2.chapter}</span>`;

      const pane2Container = document.getElementById('pane-2-verses');
      if (pane2Container) {
        pane2Container.appendChild(divider2);
        pane2Container.appendChild(block2);
      }
    }

    this.isLoadingMore = false;
  },

  async loadPrevChapterContinuous(scrollEl) {
    if (this.isLoadingMore || this.loadedChapters.length === 0) return;
    const first = this.loadedChapters[0];
    const prev = getPrevChapterCoord(first.book, first.chapter);
    if (!prev) return;

    this.isLoadingMore = true;
    this.loadedChapters.unshift(prev);

    // Colonne 1
    const data1 = await API.getChapterData(this.currentBible1, prev.book, prev.chapter, this.pane1IsInterlinear ? this.pane1InterlinearVersion : null);
    const block1 = this.createChapterBlockElement(1, data1, this.currentBible1);

    const divider1 = document.createElement('div');
    divider1.className = 'chapter-badge-divider';
    divider1.innerHTML = `<span>${data1.book_french} — Chapitre ${data1.chapter}</span>`;

    const pane1 = document.getElementById('pane-1-content');
    const pane1Container = document.getElementById('pane-1-verses');
    const oldScrollHeight1 = pane1 ? pane1.scrollHeight : 0;

    if (pane1Container) {
      pane1Container.prepend(divider1);
      pane1Container.prepend(block1);
    }

    if (pane1) {
      const diff1 = pane1.scrollHeight - oldScrollHeight1;
      pane1.scrollTop += diff1;
    }

    // Colonne 2 (si double vue)
    if (this.isSplitView) {
      const data2 = await API.getChapterData(this.currentBible2, prev.book, prev.chapter, this.pane2IsInterlinear ? this.pane2InterlinearVersion : null);
      const block2 = this.createChapterBlockElement(2, data2, this.currentBible2);

      const divider2 = document.createElement('div');
      divider2.className = 'chapter-badge-divider';
      divider2.innerHTML = `<span>${data2.book_french} — Chapitre ${data2.chapter}</span>`;

      const pane2 = document.getElementById('pane-2-content');
      const pane2Container = document.getElementById('pane-2-verses');
      const oldScrollHeight2 = pane2 ? pane2.scrollHeight : 0;

      if (pane2Container) {
        pane2Container.prepend(divider2);
        pane2Container.prepend(block2);
      }

      if (pane2) {
        const diff2 = pane2.scrollHeight - oldScrollHeight2;
        pane2.scrollTop += diff2;
      }
    }

    this.isLoadingMore = false;
  },

  createChapterBlockElement(paneNum, data, bibleName) {
    if (!data) return document.createElement('div');
    const block = document.createElement('div');
    block.className = 'chapter-block';
    block.dataset.book = data.book || this.currentBook;
    block.dataset.chapter = data.chapter || this.currentChapter;

    if (data.pericope) {
      const pericope = document.createElement('h1');
      pericope.className = 'pericope-title';
      pericope.textContent = data.pericope;
      block.appendChild(pericope);
    }

    const isPaneInterlinear = paneNum === 1 ? this.pane1IsInterlinear : this.pane2IsInterlinear;
    const paneInterVersion = paneNum === 1 ? this.pane1InterlinearVersion : this.pane2InterlinearVersion;

    const flow = document.createElement('div');
    flow.className = 'verses-flow';
    if (isPaneInterlinear) {
      flow.classList.add('interlinear-mode');
    }

    if (data.verses && Array.isArray(data.verses) && data.verses.length > 0) {
      data.verses.forEach((v, index) => {
        const vSpan = document.createElement('span');
        vSpan.className = 'verse-item';
        vSpan.dataset.verseNum = v.verse;
        vSpan.dataset.bookCode = data.book || this.currentBook;
        vSpan.dataset.chapter = data.chapter || this.currentChapter;

        if (isPaneInterlinear && v.words && v.words.length > 0) {
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
          const badgeText = paneInterVersion === 'DARBY' ? 'Bible Darby (Interlinéaire Inversé)' : 'Louis Segond 1910 (Interlinéaire Inversé)';
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
          if (this.isSplitView) {
            const workspace = document.getElementById('reader-workspace');
            workspace?.querySelectorAll(`.verse-item[data-book-code="${data.book}"][data-chapter="${data.chapter}"][data-verse-num="${v.verse}"]`).forEach(el => {
              el.classList.add('selected');
            });
          }
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
    this.selectedVerse = verseNum;
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

    // Synchronisation automatique des notes dans le volet latéral
    try {
      DrawerNotesViewer.load(book, ch, verseNum);
    } catch (e) {
      console.error('Erreur sync DrawerNotesViewer:', e);
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
      const displayTitle = b.title || b.name;
      const displayCode = b.version_code || b.name;
      btn.innerHTML = `
        <span class="version-name-full" title="${displayTitle}">${displayTitle}</span>
        <span class="version-badge-code">${displayCode}</span>
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
        this.pane1IsInterlinear = true;
        this.pane1InterlinearVersion = 'DARBY';
      } else if (versionName === 'LSG') {
        this.pane1IsInterlinear = true;
        this.pane1InterlinearVersion = 'LSG';
      } else {
        this.pane1IsInterlinear = false;
      }
      const interBtn = document.getElementById('btn-toggle-interlinear');
      if (interBtn) interBtn.classList.toggle('active', this.pane1IsInterlinear || this.pane2IsInterlinear);
      TabsManager.updateActiveTab(versionName, this.currentBook, this.currentChapter, this.pane1IsInterlinear, this.pane1InterlinearVersion);
      this.updatePaneHeader(1);
    } else {
      this.currentBible2 = versionName;
      if (versionName === 'DARBY') {
        this.pane2IsInterlinear = true;
        this.pane2InterlinearVersion = 'DARBY';
      } else if (versionName === 'LSG') {
        this.pane2IsInterlinear = true;
        this.pane2InterlinearVersion = 'LSG';
      } else {
        this.pane2IsInterlinear = false;
      }
      const interBtn = document.getElementById('btn-toggle-interlinear');
      if (interBtn) interBtn.classList.toggle('active', this.pane1IsInterlinear || this.pane2IsInterlinear);
      this.updatePaneHeader(2);
    }
    this.navigateTo(this.currentBook, this.currentChapter);
  },

  goToNextChapter() {
    const next = getNextChapterCoord(this.currentBook, this.currentChapter);
    if (next) {
      this.navigateTo(next.book, next.chapter);
    }
  },

  goToPrevChapter() {
    const prev = getPrevChapterCoord(this.currentBook, this.currentChapter);
    if (prev) {
      this.navigateTo(prev.book, prev.chapter);
    }
  },

  selectNextVerse() {
    const pane1 = document.getElementById('pane-1-content');
    if (!pane1) return;
    const allVerses = Array.from(pane1.querySelectorAll('.verse-item'));
    if (allVerses.length === 0) return;

    let selected = pane1.querySelector('.verse-item.selected');
    let nextIdx = 0;

    if (selected) {
      const curIdx = allVerses.indexOf(selected);
      if (curIdx >= 0 && curIdx < allVerses.length - 1) {
        nextIdx = curIdx + 1;
      } else {
        nextIdx = allVerses.length - 1;
      }
    } else {
      const topV = this.getTopVisibleVerse(pane1);
      if (topV && topV.element) {
        const topIdx = allVerses.indexOf(topV.element);
        nextIdx = Math.min(allVerses.length - 1, topIdx + 1);
      }
    }

    allVerses.forEach(el => el.classList.remove('selected'));
    const target = allVerses[nextIdx];
    if (target) {
      target.classList.add('selected');
      target.scrollIntoView({ block: 'center', behavior: 'smooth' });
      const vNum = target.dataset.verseNum;
      const bCode = target.dataset.bookCode || this.currentBook;
      const ch = target.dataset.chapter || this.currentChapter;
      this.loadCommentariesForVerse(vNum, bCode, ch);
    }
  },

  selectPrevVerse() {
    const pane1 = document.getElementById('pane-1-content');
    if (!pane1) return;
    const allVerses = Array.from(pane1.querySelectorAll('.verse-item'));
    if (allVerses.length === 0) return;

    let selected = pane1.querySelector('.verse-item.selected');
    let prevIdx = 0;

    if (selected) {
      const curIdx = allVerses.indexOf(selected);
      if (curIdx > 0) {
        prevIdx = curIdx - 1;
      } else {
        prevIdx = 0;
      }
    } else {
      const topV = this.getTopVisibleVerse(pane1);
      if (topV && topV.element) {
        const topIdx = allVerses.indexOf(topV.element);
        prevIdx = Math.max(0, topIdx - 1);
      }
    }

    allVerses.forEach(el => el.classList.remove('selected'));
    const target = allVerses[prevIdx];
    if (target) {
      target.classList.add('selected');
      target.scrollIntoView({ block: 'center', behavior: 'smooth' });
      const vNum = target.dataset.verseNum;
      const bCode = target.dataset.bookCode || this.currentBook;
      const ch = target.dataset.chapter || this.currentChapter;
      this.loadCommentariesForVerse(vNum, bCode, ch);
    }
  }
};
