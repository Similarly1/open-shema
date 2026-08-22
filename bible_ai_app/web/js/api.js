/**
 * API Bridge Client
 * Gère la communication asynchrone entre le Frontend Web et le Backend Python (pywebview).
 */

const API = {
  // Attendre que pywebview soit réellement prêt avec ses méthodes
  isReady: false,
  _readyCallbacks: [],

  _isBridgeAvailable() {
    return !!(window.pywebview?.api && typeof window.pywebview.api.get_installed_bibles === 'function');
  },

  init() {
    const markReady = () => {
      if (!this.isReady && this._isBridgeAvailable()) {
        this.isReady = true;
        console.log('[PyWebView Bridge] Connecté et Méthodes Initialisées !');
        const cbs = [...this._readyCallbacks];
        this._readyCallbacks = [];
        cbs.forEach(cb => {
          try { cb(); } catch (e) { console.error('Erreur callback onReady:', e); }
        });
      }
    };

    window.addEventListener('pywebviewready', () => {
      // Petite attente pour s'assurer que les méthodes sont bien attachées au proxy
      const timer = setInterval(() => {
        if (this._isBridgeAvailable()) {
          clearInterval(timer);
          markReady();
        }
      }, 20);
      setTimeout(() => clearInterval(timer), 3000);
    });

    if (this._isBridgeAvailable()) {
      markReady();
    }

    const interval = setInterval(() => {
      if (this._isBridgeAvailable()) {
        clearInterval(interval);
        markReady();
      }
    }, 40);

    // Timeout de secours maximum (5s) si ouvert dans un navigateur classique sans Python
    setTimeout(() => {
      clearInterval(interval);
      if (!this.isReady) {
        this.isReady = true;
        console.warn('[PyWebView] Non détecté, mode autonome/démo actif.');
        const cbs = [...this._readyCallbacks];
        this._readyCallbacks = [];
        cbs.forEach(cb => {
          try { cb(); } catch (e) { console.error('Erreur callback onReady:', e); }
        });
      }
    }, 5000);
  },

  async ensureReady(maxWaitMs = 5000) {
    if (this._isBridgeAvailable()) return true;
    const start = Date.now();
    return new Promise(resolve => {
      const check = () => {
        if (this._isBridgeAvailable()) {
          this.isReady = true;
          return resolve(true);
        }
        if (Date.now() - start > maxWaitMs) {
          return resolve(false);
        }
        setTimeout(check, 30);
      };
      check();
    });
  },

  async ensureMethodReady(methodName, maxWaitMs = 5000) {
    if (window.pywebview?.api && typeof window.pywebview.api[methodName] === 'function') {
      return true;
    }
    const start = Date.now();
    return new Promise(resolve => {
      const check = () => {
        if (window.pywebview?.api && typeof window.pywebview.api[methodName] === 'function') {
          return resolve(true);
        }
        if (Date.now() - start > maxWaitMs) {
          return resolve(false);
        }
        setTimeout(check, 30);
      };
      check();
    });
  },

  onReady(cb) {
    if (this.isReady && this._isBridgeAvailable()) {
      setTimeout(cb, 0);
    } else {
      this._readyCallbacks.push(cb);
    }
  },

  async call(methodName, ...args) {
    // S'assurer que la méthode spécifique est prête sur le pont pywebview
    const ready = await this.ensureMethodReady(methodName, 4000);
    if (ready && window.pywebview?.api && typeof window.pywebview.api[methodName] === 'function') {
      try {
        return await window.pywebview.api[methodName](...args);
      } catch (err) {
        console.error(`Erreur appel API [${methodName}]:`, err);
        if (typeof App !== 'undefined' && App.showError) {
          App.showError(
            `Erreur API [${methodName}]`,
            err.message || String(err),
            {
              method: methodName,
              arguments: args,
              error: err.stack || err.message || String(err)
            }
          );
        }
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

  async getBibleRegistry() {
    return await this.call('get_bible_registry');
  },

  async getComparativeSuggestion(currentBibleName) {
    return await this.call('get_comparative_suggestion', currentBibleName);
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

  async getVersePreview(rawReference, bibleName = null) {
    return await this.call('get_verse_preview', rawReference, bibleName);
  },

  async askAI(question, bookCode, chapterNum, verseNum) {
    return await this.call('ask_ai', question, bookCode, chapterNum, verseNum);
  },

  async getSettings() {
    return await this.call('get_settings');
  },

  async synthesizeCommentaries(bookCode, chapterNum, verseStart, verseEnd = null, enableReranking = null, model = null) {
    return await this.call('synthesize_commentaries', bookCode, parseInt(chapterNum), parseInt(verseStart), verseEnd ? parseInt(verseEnd) : null, enableReranking, model);
  },

  async translateText(text, itemType = '', itemId = '', model = null) {
    return await this.call('translate_text', text, itemType, itemId, model);
  },

  async getCachedTranslation(itemType, itemId) {
    return await this.call('get_cached_translation', itemType, itemId);
  },

  async detectLanguage(text, metaLang = null) {
    return await this.call('detect_language', text, metaLang);
  },

  async getTheologyBooks() {
    return await this.call('get_theology_books');
  },

  async getTheologyBookToc(bookName) {
    return await this.call('get_theology_book_toc', bookName);
  },

  async getTheologyChapterContent(bookName, chapterId) {
    return await this.call('get_theology_chapter_content', bookName, parseInt(chapterId));
  },

  async synthesizeTheologyChapter(bookName, chapterId, model = null) {
    return await this.call('synthesize_theology_chapter', bookName, parseInt(chapterId), model);
  },

  async searchTheologyBooks(query, bookName = null) {
    return await this.call('search_theology_books', query, bookName);
  },

  async openExternalUrl(url) {
    return await this.call('open_external_url', url);
  },


  async getBiblicalPlaces(query = '', placeType = null, limit = 150) {
    return await this.call('get_biblical_places', query, placeType, limit);
  },

  async getChapterPlaces(bookCode, chapterNum) {
    return await this.call('get_chapter_places', bookCode, parseInt(chapterNum));
  },

  async getBiblicalPlaceDetails(placeId) {
    return await this.call('get_biblical_place_details', placeId);
  },

  async getBiblicalItineraries() {
    return await this.call('get_biblical_itineraries');
  },

  async getBackgroundTasks() {
    return await this.call('get_background_tasks');
  },

  async dismissBackgroundTask(taskId) {
    return await this.call('dismiss_background_task', taskId);
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
  },

  async saveNote(title, content, reference = '', tags = [], id = null) {
    return this.call('save_note', {
      title,
      content,
      reference,
      tags,
      id
    });
  },

  async getHighlightsForChapter(book, chapter, version = null) {
    const ver = version || (typeof BibleReader !== 'undefined' ? BibleReader.currentVersion : '');
    return this.call('get_highlights_for_chapter', book, parseInt(chapter), ver || '');
  },

  async getAllHighlights() {
    return this.call('get_all_highlights');
  },

  async saveHighlight(data) {
    return this.call('save_highlight', data);
  },

  async deleteHighlight(id) {
    return this.call('delete_highlight', id);
  },

  async deleteHighlightsForPassage(book, chapter, verseStart, verseEnd, version = null) {
    const ver = version || (typeof BibleReader !== 'undefined' ? BibleReader.currentVersion : '');
    return this.call('delete_highlights_for_passage', book, parseInt(chapter), parseInt(verseStart), parseInt(verseEnd), ver || '');
  },

  async createNoteFromHighlight(hlId, text, ref) {
    return this.call('create_note_from_highlight', hlId, text, ref);
  },

  async exportHighlights(format = 'json') {
    return this.call('export_highlights', format);
  },

  async importHighlights(mode = 'merge') {
    return this.call('import_highlights', mode);
  },

  async getDictionaries() {
    return this.call('get_dictionaries');
  },

  async getDictionaryHeadwords(dictId, letter = null, query = null, limit = 300, offset = 0) {
    return this.call('get_dictionary_headwords', dictId, letter, query, limit, offset);
  },

  async getDictionaryEntry(dictId, slug, strongCode = null) {
    return this.call('get_dictionary_entry', dictId, slug, strongCode);
  }
};

API.init();
