/**
 * Multiwindow Synchronization Controller (BroadcastChannel)
 * Assure la communication bidirectionnelle en temps réel (< 1ms)
 * entre la fenêtre principale (BibleReader) et la fenêtre secondaire de commentaires exégétiques.
 */

const MultiwindowSync = {
  channelName: 'open_shema_multiwindow',
  channel: null,
  isSecondaryWindowActive: false,
  _lastSentVerse: null,
  _lastSentChapter: null,

  init() {
    try {
      this.channel = new BroadcastChannel(this.channelName);
      this.channel.onmessage = (event) => {
        this.handleIncomingMessage(event.data);
      };
      console.log('[MultiwindowSync] Canal BroadcastChannel initialisé avec succès.');
    } catch (e) {
      console.warn('[MultiwindowSync] BroadcastChannel non supporté, mode fallback actif:', e);
    }
  },

  handleIncomingMessage(data) {
    if (!data || !data.type) return;

    switch (data.type) {
      case 'SECONDARY_WINDOW_READY':
        this.isSecondaryWindowActive = true;
        this.updateToolbarButtonState(true);
        // Répondre avec l'état courant de la lecture
        this.broadcastCurrentState();
        break;

      case 'SECONDARY_WINDOW_CLOSED':
        this.isSecondaryWindowActive = false;
        this.updateToolbarButtonState(false);
        break;

      case 'NAVIGATE_REQUEST':
        if (data.book && data.chapter) {
          if (typeof BibleReader !== 'undefined') {
            BibleReader.navigateTo(data.book, parseInt(data.chapter, 10), data.verse ? parseInt(data.verse, 10) : null);
          }
        }
        break;

      case 'REQUEST_CURRENT_STATE':
        this.broadcastCurrentState();
        break;

      case 'PASSAGE_NAVIGATED':
        if (typeof App !== 'undefined' && App.isDetachedMode) {
          const b = data.book;
          const ch = parseInt(data.chapter, 10);
          const v = parseInt(data.verse, 10) || 1;
          const activeView = App.activeView || App.detachedViewId;

          if (activeView === 'commentaries' && typeof CommentariesView !== 'undefined' && CommentariesView.loadCommentariesForPassage) {
            CommentariesView.loadCommentariesForPassage(b, ch, v);
          } else if (activeView === 'articles' && typeof ArticlesView !== 'undefined' && ArticlesView.loadDrawerArticles) {
            ArticlesView.loadDrawerArticles(b, ch);
          } else if (activeView === 'bible' && typeof BibleReader !== 'undefined' && BibleReader.navigateTo) {
            if (BibleReader._isPreloaded && (BibleReader.currentBook !== b || BibleReader.currentChapter !== ch)) {
              BibleReader.navigateTo(b, ch, v);
            }
          }
        }
        break;

      case 'VERSE_CHANGED':
        if (typeof App !== 'undefined' && App.isDetachedMode) {
          const activeView = App.activeView || App.detachedViewId;
          if (activeView === 'commentaries' && typeof CommentariesView !== 'undefined' && CommentariesView.highlightVerse) {
            CommentariesView.highlightVerse(parseInt(data.verse, 10));
          }
        }
        break;

      default:
        break;
    }
  },

  broadcastPassageNavigated(bookCode, bookFrench, chapterNum, verseNum = 1) {
    this._lastSentChapter = `${bookCode}_${chapterNum}`;
    this._lastSentVerse = `${bookCode}_${chapterNum}_${verseNum}`;

    if (this.channel) {
      this.channel.postMessage({
        type: 'PASSAGE_NAVIGATED',
        book: bookCode,
        bookFrench: bookFrench,
        chapter: parseInt(chapterNum, 10),
        verse: parseInt(verseNum, 10) || 1,
        timestamp: Date.now()
      });
    }

    if (typeof API !== 'undefined' && API.syncPassage) {
      API.syncPassage(bookCode, bookFrench, chapterNum, verseNum);
    }
  },

  broadcastVerseChanged(bookCode, chapterNum, verseNum) {
    const vKey = `${bookCode}_${chapterNum}_${verseNum}`;
    if (this._lastSentVerse === vKey) return;
    this._lastSentVerse = vKey;

    if (this.channel) {
      this.channel.postMessage({
        type: 'VERSE_CHANGED',
        book: bookCode,
        chapter: parseInt(chapterNum, 10),
        verse: parseInt(verseNum, 10),
        timestamp: Date.now()
      });
    }

    if (typeof API !== 'undefined' && API.syncVerse) {
      API.syncVerse(bookCode, chapterNum, verseNum);
    }
  },

  broadcastCurrentState() {
    if (typeof BibleReader === 'undefined') return;
    const bCode = BibleReader.currentBook || 'Gen';
    const ch = BibleReader.currentChapter || 1;
    const v = BibleReader.selectedVerse || 1;
    const info = (typeof getBookInfo === 'function') ? getBookInfo(bCode) : { name: bCode };

    this.broadcastPassageNavigated(bCode, info.name, ch, v);
  },

  handleSecondaryWindowClosed() {
    this.isSecondaryWindowActive = false;
    this.updateToolbarButtonState(false);
  },

  updateToolbarButtonState(isActive) {
    const btn = document.getElementById('btn-open-commentary-window');
    if (btn) {
      btn.classList.toggle('active', isActive);
      btn.title = isActive 
        ? "Commentaires ouverts sur le second écran (Cliquer pour ramener au premier plan)" 
        : "Ouvrir les commentaires en plein écran sur le second écran";
    }
  }
};

// Auto-initialisation au chargement du DOM
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    MultiwindowSync.init();
  });
}
