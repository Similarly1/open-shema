/**
 * Bible Reader Engine
 * Gère l'affichage du texte biblique, le split-pane, l'interlinéaire et les interactions versets.
 */

const BibleReader = {
  currentBook: 'Gen',
  currentChapter: 1,
  currentBible1: 'TOB 2010',
  currentBible2: 'Segond 21',
  
  isSplitView: false,
  isInterlinear: false,
  zoomPercent: 100,

  selectedVerse: null,

  async init() {
    this.bindEvents();
    
    // Initialiser le BookPicker
    BookPicker.init((bookCode, chNum) => {
      this.navigateTo(bookCode, chNum);
    });

    // Charger le premier chapitre dès que l'API est prête
    API.onReady(async () => {
      const bibles = await API.getInstalledBibles();
      if (bibles && bibles.length > 0) {
        this.currentBible1 = bibles[0].name;
        if (bibles.length > 1) {
          this.currentBible2 = bibles[1].name;
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

      if (this.isInterlinear && v.words) {
        // Mode Interlinéaire Inversé
        let wordsHtml = '';
        v.words.forEach(w => {
          wordsHtml += `
            <div class="interlinear-block" title="Strong: ${w.strong || ''}">
              <span class="interlinear-surface">${w.surface}</span>
              <span class="interlinear-lemma">${w.lemma || ''}</span>
              <span class="interlinear-translit">${w.translit || ''}</span>
              ${w.strong ? `<span class="interlinear-strong">${w.strong}</span>` : ''}
            </div>
          `;
        });
        vSpan.innerHTML = `<sup class="verse-num">${v.verse}</sup> ${wordsHtml}`;
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
