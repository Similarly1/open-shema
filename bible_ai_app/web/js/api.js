/**
 * API Bridge Client
 * Gère la communication asynchrone entre le Frontend Web et le Backend Python (pywebview).
 */

const API = {
  // Attendre que pywebview soit prêt
  isReady: false,
  _readyCallbacks: [],

  init() {
    const markReady = () => {
      if (!this.isReady) {
        this.isReady = true;
        console.log('⚡ PyWebView Bridge Connecté !');
        const cbs = [...this._readyCallbacks];
        this._readyCallbacks = [];
        cbs.forEach(cb => {
          try { cb(); } catch (e) { console.error('Erreur callback onReady:', e); }
        });
      }
    };

    window.addEventListener('pywebviewready', () => {
      markReady();
    });

    if (window.pywebview?.api) {
      markReady();
    }

    const interval = setInterval(() => {
      if (window.pywebview?.api) {
        clearInterval(interval);
        markReady();
      }
    }, 100);

    // Timeout de secours maximum (1.2s)
    setTimeout(() => {
      clearInterval(interval);
      markReady();
    }, 1200);
  },

  onReady(cb) {
    if (this.isReady || window.pywebview?.api) {
      setTimeout(cb, 0);
    } else {
      this._readyCallbacks.push(cb);
    }
  },

  async call(methodName, ...args) {
    if (window.pywebview?.api && typeof window.pywebview.api[methodName] === 'function') {
      try {
        return await window.pywebview.api[methodName](...args);
      } catch (err) {
        console.error(`Erreur appel API [${methodName}]:`, err);
        throw err;
      }
    } else {
      console.warn(`[Mode Démo / Standalone] Simulation API pour : ${methodName}`);
      return this._mockResponse(methodName, ...args);
    }
  },

  // Méthodes métier typées
  async getInstalledBibles() {
    return await this.call('get_installed_bibles');
  },

  async getBooksList() {
    return await this.call('get_books_list');
  },

  async getChapterData(bibleName, bookCode, chapterNum) {
    return await this.call('get_chapter_data', bibleName, bookCode, parseInt(chapterNum));
  },

  async getCommentaries(bookCode, chapterNum, verseNum) {
    return await this.call('get_commentaries', bookCode, parseInt(chapterNum), parseInt(verseNum));
  },

  async parseReference(rawText) {
    return await this.call('parse_reference', rawText);
  },

  async askAI(question, bookCode, chapterNum, verseNum) {
    return await this.call('ask_ai', question, bookCode, chapterNum, verseNum);
  },

  async getSettings() {
    return await this.call('get_settings');
  },

  // Mock pour test dans navigateur externe
  _mockResponse(method, ...args) {
    if (method === 'get_installed_bibles') {
      return [
        { id: 'TOB_2010', name: 'TOB 2010', title: 'Traduction Œcuménique de la Bible', active: true },
        { id: 'Segond_21', name: 'Segond 21', title: 'Bible Segond 21', active: true },
        { id: 'BDS', name: 'BDS', title: 'Bible du Semeur', active: true }
      ];
    }
    if (method === 'get_chapter_data') {
      return {
        bible: args[0] || 'TOB_2010',
        book: args[1] || 'Gen',
        book_french: 'Genèse',
        chapter: args[2] || 1,
        pericope: 'LA CRÉATION',
        verses: [
          { verse: 1, text: "Au commencement, Dieu créa le ciel et la terre." },
          { verse: 2, text: "La terre était déserte et vide, et la ténèbre régnait sur l'abîme." },
          { verse: 3, text: "Dieu dit : « Que la lumière soit ! » Et la lumière fut." }
        ]
      };
    }
    return null;
  }
};

API.init();
