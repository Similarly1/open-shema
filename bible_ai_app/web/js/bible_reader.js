/**
 * Bible Reader Engine
 * Gère l'affichage du texte biblique, le split-pane, l'interlinéaire, le choix de version et les interactions versets.
 */

const BibleReader = {
  currentBook: 'Gen',
  currentChapter: 1,
  currentBible1: 'Colombe',
  currentBible2: 'Segond 21',
  
  isSplitView: false,
  isInterlinear: false,
  zoomPercent: 100,

  selectedVerse: null,
  installedBibles: [],
  targetPaneForPicker: 1,

  async init() {
    this.bindEvents();
    
    // Initialiser le BookPicker
    BookPicker.init((bookCode, chNum) => {
      this.navigateTo(bookCode, chNum);
    });

    // Charger les Bibles dès que l'API est prête
    API.onReady(async () => {
      this.installedBibles = await API.getInstalledBibles() || [];
      if (this.installedBibles.length > 0) {
        this.currentBible1 = this.installedBibles[0].name;
        if (this.installedBibles.length > 1) {
          this.currentBible2 = this.installedBibles[1].name;
        }
      }
      this.loadChapter();
    });
  },

  bindEvents() {
    // Bouton de la pilule sélecteur
    document.getElementById('book-picker-pill').addEventListener('click', () => {
      BookPicker.toggle(this.currentBook, this.currentChapter);
    });

    // Boutons Historique < >
    document.getElementById('btn-history-back').addEventListener('click', () => {
      if (this.currentChapter > 1) {
        this.navigateTo(this.currentBook, this.currentChapter - 1);
      }
    });
    document.getElementById('btn-history-forward').addEventListener('click', () => {
      this.navigateTo(this.currentBook, this.currentChapter + 1);
    });

    // Toggle Interlinéaire
    document.getElementById('btn-toggle-interlinear').addEventListener('click', () => {
      this.isInterlinear = !this.isInterlinear;
      document.getElementById('btn-toggle-interlinear').classList.toggle('active', this.isInterlinear);
      this.loadChapter();
    });

    // Toggle Double Colonne
    document.getElementById('btn-toggle-split').addEventListener('click', () => {
      this.toggleSplitView();
    });

    document.getElementById('btn-close-pane-2').addEventListener('click', () => {
      this.toggleSplitView(false);
    });

    // Choix de version biblique (Pane 1 et Pane 2)
    document.getElementById('pane-1-select-bible').addEventListener('click', (e) => {
      e.stopPropagation();
      this.openBiblePicker(1);
    });

    document.getElementById('pane-2-select-bible').addEventListener('click', (e) => {
      e.stopPropagation();
      this.openBiblePicker(2);
    });

    document.getElementById('btn-close-bible-picker').addEventListener('click', () => {
      this.closeBiblePicker();
    });

    document.addEventListener('click', (e) => {
      const picker = document.getElementById('bible-version-picker-popover');
      if (picker && !picker.classList.contains('hidden') && !picker.contains(e.target)) {
        this.closeBiblePicker();
      }
    });

    // Zoom
    document.getElementById('btn-zoom-in').addEventListener('click', () => {
      this.setZoom(this.zoomPercent + 10);
    });
    document.getElementById('btn-zoom-out').addEventListener('click', () => {
      this.setZoom(this.zoomPercent - 10);
    });

    // Toggle Right Drawer
    document.getElementById('btn-toggle-right-drawer').addEventListener('click', () => {
      document.getElementById('right-drawer').classList.toggle('collapsed');
    });

    // Champ recherche rapide
    document.getElementById('quick-passage-input').addEventListener('keydown', async (e) => {
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
      // Mettre à jour le 1er onglet
      const tab1 = document.querySelector('.tab[data-tab-id="tab-1"] .tab-title');
      if (tab1) tab1.textContent = versionName;
    } else {
      this.currentBible2 = versionName;
      const tab2 = document.querySelector('.tab[data-tab-id="tab-2"] .tab-title');
      if (tab2) tab2.textContent = versionName;
    }
    this.loadChapter();
  },

  async navigateTo(bookCode, chapterNum) {
    this.currentBook = bookCode;
    this.currentChapter = chapterNum;
    await this.loadChapter();
  },

  async loadChapter() {
    // 1. Mettre à jour la pilule
    document.getElementById('pill-reference-text').textContent = `${this.currentBook} ${this.currentChapter}`;

    // 2. Charger le texte pour la Colonne 1
    const data1 = await API.getChapterData(this.currentBible1, this.currentBook, this.currentChapter);
    this.renderPane(1, data1, this.currentBible1);

    // 3. Charger le texte pour la Colonne 2 si active
    if (this.isSplitView) {
      const data2 = await API.getChapterData(this.currentBible2, this.currentBook, this.currentChapter);
      this.renderPane(2, data2, this.currentBible2);
    }

    // 4. Charger les commentaires du verset 1 par défaut
    this.loadCommentariesForVerse(1);
  },

  renderPane(paneNum, data, bibleName) {
    const breadcrumbEl = document.getElementById(`pane-${paneNum}-breadcrumb`);
    const bibleNameEl = document.getElementById(`pane-${paneNum}-bible-name`);
    const pericopeEl = document.getElementById(`pane-${paneNum}-pericope`);
    const versesEl = document.getElementById(`pane-${paneNum}-verses`);

    if (!data || !data.verses) {
      versesEl.innerHTML = `<p class="empty-hint">Aucun texte disponible pour ce chapitre.</p>`;
      return;
    }

    // Mettre à jour les titres
    breadcrumbEl.textContent = `${data.book_french.toUpperCase()} > Chapitre ${data.chapter}`;
    bibleNameEl.textContent = bibleName;
    pericopeEl.textContent = data.pericope || `CHAPITRE ${data.chapter}`;

    // Générer les versets
    versesEl.innerHTML = '';
    
    data.verses.forEach((v, index) => {
      const vSpan = document.createElement('span');
      vSpan.className = 'verse-item';
      vSpan.dataset.verseNum = v.verse;

      if (this.isInterlinear && v.words && v.words.length > 0) {
        // Mode Interlinéaire Inversé Logos
        let wordsHtml = '';
        v.words.forEach(w => {
          wordsHtml += `
            <div class="interlinear-block" data-strong="${w.strong || ''}" data-word="${w.orig || w.surface}" title="${w.morph || ''}">
              <span class="interlinear-surface">${w.surface}</span>
              ${w.orig && w.orig !== w.surface ? `<span class="interlinear-lemma">${w.orig}</span>` : ''}
              ${w.translit ? `<span class="interlinear-translit">${w.translit}</span>` : ''}
              ${w.strong ? `<span class="interlinear-strong">${w.strong}</span>` : ''}
            </div>
          `;
        });
        vSpan.innerHTML = `<sup class="verse-num">${v.verse}</sup> ${wordsHtml}`;

        // Clic sur mot interlinéaire -> ouvrir Strong / Lexique
        vSpan.querySelectorAll('.interlinear-block').forEach(block => {
          block.addEventListener('click', (e) => {
            e.stopPropagation();
            const strongCode = block.dataset.strong;
            const word = block.dataset.word;
            this.lookupWordInLexicon(word, strongCode);
          });
        });

      } else {
        // Mode de lecture continue Logos
        const isFirst = index === 0;
        const numHtml = isFirst 
          ? `<span class="chapter-number-dropcap">${data.chapter}</span><sup class="verse-num">${v.verse}</sup>`
          : `<sup class="verse-num">${v.verse}</sup>`;
          
        vSpan.innerHTML = `${numHtml}${v.text} `;
      }

      // Clic sur un verset pour charger les commentaires
      vSpan.addEventListener('click', () => {
        document.querySelectorAll('.verse-item').forEach(el => el.classList.remove('selected'));
        vSpan.classList.add('selected');
        this.loadCommentariesForVerse(v.verse);
      });

      versesEl.appendChild(vSpan);
    });

    // Appliquer le zoom
    versesEl.style.fontSize = `${19 * (this.zoomPercent / 100)}px`;
  },

  async lookupWordInLexicon(word, strongCode) {
    const drawer = document.getElementById('right-drawer');
    drawer.classList.remove('collapsed');
    document.querySelector('.drawer-tab[data-drawer-tab="lexicon"]').click();

    const container = document.getElementById('lexicon-details');
    container.innerHTML = `<div style="padding: 20px; color: var(--text-muted);">Recherche lexicale pour « ${word} » (${strongCode || ''})...</div>`;

    try {
      const entry = await API.call('lookup_dictionary', word, strongCode);
      if (entry) {
        container.innerHTML = `
          <div style="padding: 16px;">
            <div style="font-size: 18px; font-weight: 800; color: var(--accent-blue); margin-bottom: 4px;">${entry.title}</div>
            <div style="font-size: 11px; font-weight: 700; color: var(--accent-orange); margin-bottom: 12px;">${entry.badge}</div>
            <div style="font-family: var(--font-bible); font-size: 15px; line-height: 1.65; color: #334155;">${entry.full_text.replace(/\n\n/g, '<br><br>')}</div>
          </div>
        `;
      } else {
        container.innerHTML = `<div style="padding: 20px; color: var(--text-muted);">Aucune entrée lexicale trouvée pour ce terme.</div>`;
      }
    } catch (e) {
      container.innerHTML = `<div style="padding: 20px; color: var(--accent-red);">Erreur lors de la consultation.</div>`;
    }
  },

  async loadCommentariesForVerse(verseNum) {
    this.selectedVerse = verseNum;
    const badgeEl = document.getElementById('comm-selected-verse');
    const countEl = document.getElementById('comm-count');
    const listEl = document.getElementById('commentary-list');

    badgeEl.textContent = `${this.currentBook} ${this.currentChapter}:${verseNum}`;
    countEl.textContent = 'Recherche...';
    listEl.innerHTML = '<p class="empty-hint">Chargement des commentaires...</p>';

    try {
      const comms = await API.getCommentaries(this.currentBook, this.currentChapter, verseNum);
      if (!comms || comms.length === 0) {
        countEl.textContent = '0 commentaire';
        listEl.innerHTML = '<p class="empty-hint">Aucun commentaire direct disponible pour ce verset.</p>';
        return;
      }

      countEl.textContent = `${comms.length} commentaire(s)`;
      listEl.innerHTML = '';

      comms.forEach(c => {
        const card = document.createElement('div');
        card.className = 'commentary-card';
        card.innerHTML = `
          <div class="comm-author">📖 ${c.author || c.source}</div>
          <div class="comm-text">${c.text}</div>
        `;
        listEl.appendChild(card);
      });
    } catch (e) {
      console.error('Erreur commentaires:', e);
      countEl.textContent = 'Erreur';
    }
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
    this.loadChapter();
  },

  setZoom(percent) {
    this.zoomPercent = Math.max(70, Math.min(180, percent));
    document.getElementById('lbl-zoom-level').textContent = `${this.zoomPercent}%`;
    document.querySelectorAll('.verses-flow').forEach(el => {
      el.style.fontSize = `${19 * (this.zoomPercent / 100)}px`;
    });
  }
};
