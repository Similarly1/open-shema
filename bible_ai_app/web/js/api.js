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
    }, 50);

    // Timeout de secours maximum (5s)
    setTimeout(() => {
      clearInterval(interval);
      markReady();
    }, 5000);
  },

  async ensureReady() {
    if (window.pywebview?.api) return true;
    return new Promise(resolve => {
      if (window.pywebview?.api) return resolve(true);
      let checks = 0;
      const interval = setInterval(() => {
        checks++;
        if (window.pywebview?.api) {
          clearInterval(interval);
          resolve(true);
        } else if (checks > 100) { // 10 secondes d'attente max
          clearInterval(interval);
          resolve(false);
        }
      }, 100);
    });
  },

  onReady(cb) {
    if (this.isReady || window.pywebview?.api) {
      setTimeout(cb, 0);
    } else {
      this._readyCallbacks.push(cb);
    }
  },

  async call(methodName, ...args) {
    if (!window.pywebview?.api) {
      await this.ensureReady();
    }
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

  async getChapterData(bibleName, bookCode, chapterNum, interlinearVersion = "LSG") {
    return await this.call('get_chapter_data', bibleName, bookCode, parseInt(chapterNum), interlinearVersion);
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
        { id: 'LSG', name: 'LSG', title: 'Louis Segond 1910 (Strong)', version_code: 'LSG', active: true },
        { id: 'DARBY', name: 'DARBY', title: 'Bible J.N. Darby', version_code: 'DARB', active: true },
        { id: 'Colombe', name: 'Colombe', title: 'Bible à la Colombe', version_code: 'COL', active: true },
        { id: 'Segond_21', name: 'Segond 21', title: 'Bible Segond 21', version_code: 'S21', active: true }
      ];
    }
    if (method === 'get_chapter_data') {
      return {
        bible: args[0] || 'LSG',
        book: args[1] || 'Gen',
        book_french: 'Genèse',
        chapter: args[2] || 1,
        pericope: 'LA CRÉATION',
        verses: [
          {
            verse: 1,
            text: "Au commencement, Dieu créa les cieux et la terre.",
            words: [
              { surface: "Au", orig: "", translit: "", lemma: "", strong: "", morph: "", lang: "fr" },
              { surface: "commencement", orig: "רֵאשִׁית", translit: "re'shiyth", lemma: "רֵאשִׁית", strong: "H7225", morph: "", lang: "hebrew" },
              { surface: "Dieu", orig: "אֱלֹהִים", translit: "'elohiym", lemma: "אֱלֹהִים", strong: "H0430", morph: "", lang: "hebrew" },
              { surface: "créa", orig: "בָּרָא", translit: "bara'", lemma: "בָּרָא", strong: "H1254", morph: "", lang: "hebrew" },
              { surface: "les", orig: "", translit: "", lemma: "", strong: "", morph: "", lang: "fr" },
              { surface: "cieux", orig: "שָׁמַיִם", translit: "shamayim", lemma: "שָׁמַיִם", strong: "H8064", morph: "", lang: "hebrew" },
              { surface: "et", orig: "", translit: "", lemma: "", strong: "", morph: "", lang: "fr" },
              { surface: "la", orig: "", translit: "", lemma: "", strong: "", morph: "", lang: "fr" },
              { surface: "terre", orig: "אֶרֶץ", translit: "'erets", lemma: "אֶרֶץ", strong: "H0776", morph: "", lang: "hebrew" }
            ]
          },
          {
            verse: 2,
            text: "La terre était informe et vide; il y avait des ténèbres à la surface de l'abîme, et l'esprit de Dieu se mouvait au-dessus des eaux.",
            words: [
              { surface: "La", orig: "", translit: "", lemma: "", strong: "", morph: "", lang: "fr" },
              { surface: "terre", orig: "אֶרֶץ", translit: "'erets", lemma: "אֶרֶץ", strong: "H0776", morph: "", lang: "hebrew" },
              { surface: "était", orig: "הָיָה", translit: "hayah", lemma: "הָיָה", strong: "H1961", morph: "", lang: "hebrew" },
              { surface: "informe", orig: "תֹּהוּ", translit: "tohuw", lemma: "תֹּהוּ", strong: "H8414", morph: "", lang: "hebrew" },
              { surface: "et", orig: "", translit: "", lemma: "", strong: "", morph: "", lang: "fr" },
              { surface: "vide", orig: "בֹּהוּ", translit: "bohuw", lemma: "בֹּהוּ", strong: "H0922", morph: "", lang: "hebrew" }
            ]
          },
          {
            verse: 3,
            text: "Dieu dit: Que la lumière soit! Et la lumière fut.",
            words: [
              { surface: "Dieu", orig: "אֱלֹהִים", translit: "'elohiym", lemma: "אֱלֹהִים", strong: "H0430", morph: "", lang: "hebrew" },
              { surface: "dit", orig: "אָמַר", translit: "'amar", lemma: "אָמַר", strong: "H0559", morph: "", lang: "hebrew" },
              { surface: "Que", orig: "", translit: "", lemma: "", strong: "", morph: "", lang: "fr" },
              { surface: "la", orig: "", translit: "", lemma: "", strong: "", morph: "", lang: "fr" },
              { surface: "lumière", orig: "אוֹר", translit: "'owr", lemma: "אוֹר", strong: "H0216", morph: "", lang: "hebrew" },
              { surface: "soit", orig: "הָיָה", translit: "hayah", lemma: "הָיָה", strong: "H1961", morph: "", lang: "hebrew" }
            ]
          }
        ]
      };
    }
    return null;
  }
};

API.init();
