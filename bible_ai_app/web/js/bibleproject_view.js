/**
 * BibleProject View & Media Controller
 * Gère le volet BibleProject (FR) dans le tiroir droit du lecteur biblique :
 * - Lecture fluide des vidéos YouTube (panoramas AT/NT, thèmes théologiques, études de mots)
 * - Visualiseur interactif Pan & Zoom pour les affiches / posters de structure littéraire HD
 * - Téléchargement direct des posters officiels en PDF haute résolution
 */

const BibleProjectView = {
  currentBook: 'GEN',
  currentChapter: 1,
  currentData: null,
  activeSubTab: 'overviews', // 'overviews' | 'posters' | 'words' | 'themes'
  wordsFilterQuery: '',
  currentPlayingYtId: null,
  isLoading: false,

  // État du visualiseur de poster (Pan & Zoom)
  panzoom: {
    scale: 1,
    minScale: 0.2,
    maxScale: 5,
    translateX: 0,
    translateY: 0,
    isDragging: false,
    startX: 0,
    startY: 0
  },

  // Table de correspondance étendue Strong / Termes -> Études de mots BibleProject

  strongWordMap: [
    { strongs: ['G2098', 'G2097'], terms: ['evangile', 'évangile', 'euangelion', 'bonne nouvelle'], ytId: 'o1jYy7_Z0n8', title: 'Évangile (Euangelion)', orig: 'Εὐαγγέλιον', dur: '5:28' },
    { strongs: ['G3144', 'G3141', 'G3140'], terms: ['temoin', 'témoin', 'martus', 'martyre', 'temoignage'], ytId: 'Qk-e5e54qC4', title: 'Témoin (Martus)', orig: 'Μάρτυς', dur: '5:15' },
    { strongs: ['H2617'], terms: ['hessed', 'hesed', 'amour loyal', 'bienveillance', 'bonté'], ytId: 'g4k5ySgB0i8', title: 'Amour Loyal (Hessed)', orig: 'חֶסֶד', dur: '5:42' },
    { strongs: ['H2580', 'H2603', 'G5485'], terms: ['grace', 'grâce', 'khen', 'chen', 'faveur', 'charis'], ytId: 'q5sN9r0y5U0', title: 'Grâce (Khen / Charis)', orig: 'חֵן / χάρις', dur: '5:10' },
    { strongs: ['H7349', 'H7355', 'H7356', 'G3627'], terms: ['compassion', 'misericorde', 'miséricorde', 'rakhoum', 'racham'], ytId: 'N63hJ4M4Tzg', title: 'La Compassion (Rakhoum)', orig: 'רַחוּם', dur: '5:32' },
    { strongs: ['H0750', 'H0639'], terms: ['lent a la colere', 'lent à la colère', 'colere', 'patience', 'erek apayim'], ytId: 'e4G1o-l8_Kk', title: 'Lent à la colère (Erek Apayim)', orig: 'אֶרֶךְ אַפַּיִם', dur: '5:50' },
    { strongs: ['H0571', 'H0530', 'G0225'], terms: ['fidele', 'fidèle', 'fidelite', 'fidélité', 'emeth', 'emet', 'emounah', 'verite', 'vérité'], ytId: 'bA4yV9XJ0vM', title: 'Fidèle / Vérité (Emeth)', orig: 'אֱמֶת', dur: '5:24' },
    { strongs: ['H8085', 'G0191'], terms: ['shema', 'chema', 'ecouter', 'écouter', 'obeir', 'obéir', 'shama'], ytId: 'O4bO7qj0e2g', title: 'Shema / Écouter (Shama)', orig: 'שָׁמַע', dur: '5:30' },
    { strongs: ['H0160', 'H0157', 'G0026', 'G0025'], terms: ['amour', 'aimer', 'ahavah', 'agape', 'agapé'], ytId: '5f9h_u0r6Wk', title: 'Amour (Ahavah / Agapé)', orig: 'אַהֲבָה / Ἀγάπη', dur: '5:18' },
    { strongs: ['H3820', 'H3824', 'G2588'], terms: ['coeur', 'cœur', 'lev', 'levav', 'kardia'], ytId: 'x6RzM4cW9tM', title: 'Cœur (Lev / Levav)', orig: 'לֵבָב', dur: '5:12' },
    { strongs: ['H5315', 'G5590'], terms: ['ame', 'âme', 'nephesh', 'nefesh', 'psyche'], ytId: 'J4vG_5M2PqI', title: 'Âme (Nephesh)', orig: 'נֶפֶשׁ', dur: '5:05' },
    { strongs: ['H3966'], terms: ['force', 'puissance', 'meod', 'me\'od', 'tres'], ytId: '9vQW8r_t7s0', title: 'Force (Me\'od)', orig: 'מְאֹד', dur: '5:01' },
    { strongs: ['H7965', 'G1515'], terms: ['shalom', 'chalom', 'paix', 'eirene', 'plenitude'], ytId: 'L_R-cZ8D07g', title: 'Shalom (Paix & Plénitude)', orig: 'שָׁלוֹם', dur: '5:35' },
    { strongs: ['H3068', 'H3069'], terms: ['yhwh', 'yahwe', 'yahweh', 'eternel', 'l\'éternel', 'seigneur'], ytId: 'M3xN4_b-06w', title: 'YHWH (L\'Éternel)', orig: 'יהוה', dur: '6:10' },
    { strongs: ['H3176', 'G1680'], terms: ['esperance', 'espérance', 'espoir', 'yakhal', 'elpis'], ytId: 'P_4cM6o5S2k', title: 'Espérance (Yakhal)', orig: 'יָחַל', dur: '5:14' },
    { strongs: ['H2398', 'H2403', 'G0266'], terms: ['peche', 'péché', 'khata', 'manquer le but', 'hamartia'], ytId: '7XqL_8r9s0M', title: 'Péché (Khata)', orig: 'חָטָא', dur: '5:20' },
    { strongs: ['H6588', 'G3847'], terms: ['transgression', 'rebellion', 'rébellion', 'pesha'], ytId: 'kP4_rW0s0uM', title: 'Transgression (Pesha)', orig: 'פֶּשַׁע', dur: '5:15' },
    { strongs: ['H5771'], terms: ['iniquite', 'iniquité', 'tortion', 'faute', 'avon'], ytId: '9rQ_kP4s0uM', title: 'Iniquité (Avon)', orig: 'עָוֹן', dur: '5:18' },
    { strongs: ['H6918', 'H6944', 'G0040'], terms: ['saint', 'saintete', 'sainteté', 'kadosh', 'hagios'], ytId: '8rQ_wK4s0uM', title: 'Sainteté (Kadosh)', orig: 'קָדוֹשׁ', dur: '5:45' }
  ],

  // Recherche d'une étude de mot correspondante
  getWordStudyForStrong(strongCode, term = '') {
    const sNorm = (strongCode || '').trim().toUpperCase();
    const tNorm = (term || '').trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    for (const item of this.strongWordMap) {
      if (sNorm && item.strongs.some(st => st.toUpperCase() === sNorm || st.replace(/^0+/, '') === sNorm.replace(/^0+/, ''))) {
        return {
          ...item,
          thumbnail: `https://i.ytimg.com/vi/${item.ytId}/hqdefault.jpg`,
          description: `Analyse linguistique et biblique de ${item.title}`
        };
      }
      if (tNorm && item.terms.some(tm => tNorm.includes(tm) || tm.includes(tNorm))) {
        return {
          ...item,
          thumbnail: `https://i.ytimg.com/vi/${item.ytId}/hqdefault.jpg`,
          description: `Analyse linguistique et biblique de ${item.title}`
        };
      }
    }
    return null;
  },

  // Ouvrir l'onglet Médias et lancer directement l'étude de mot
  openAndPlayWordStudy(ytId, title, desc) {
    if (typeof PassageOverviewDrawer !== 'undefined') {
      PassageOverviewDrawer.switchTab('media');
    }
    // Activer la pilule 'words'
    document.querySelectorAll('.bp-pill').forEach(b => {
      b.classList.toggle('active', b.dataset.bpTab === 'words');
    });
    this.activeSubTab = 'words';
    this.renderLists();
    this.playVideo(ytId, title, desc);
  },

  init() {
    this.bindSubNav();
    this.bindPosterModal();
  },

  bindSubNav() {
    document.querySelectorAll('.bp-pill').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.bp-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeSubTab = btn.dataset.bpTab || 'overviews';
        this.renderLists();
      });
    });
  },

  /**
   * Charge et synchronise les médias pour le livre et chapitre biblique courant.
   */
  async load(bookCode, chapter = 1, force = false) {
    const normBook = bookCode || (typeof BibleReader !== 'undefined' ? BibleReader.currentBook : 'GEN') || 'GEN';
    const chNum = parseInt(chapter || (typeof BibleReader !== 'undefined' ? BibleReader.currentChapter : 1), 10) || 1;

    if (!force && this.currentBook === normBook && this.currentChapter === chNum && this.currentData) {
      return;
    }

    this.currentBook = normBook;
    this.currentChapter = chNum;
    this.isLoading = true;

    // Mise à jour badge
    const badge = document.getElementById('lbl-drawer-bp-passage');
    const frenchName = (typeof getFrenchBookName === 'function' ? getFrenchBookName(normBook) : null) || normBook;
    if (badge) {
      badge.textContent = `${frenchName} ${chNum}`;
    }

    try {
      const res = await API.getBibleProjectMedia(normBook, chNum);
      if (res && res.success) {
        this.currentData = res;
        this.renderLists();

        // Si aucune vidéo n'est encore en cours de lecture, charger automatiquement le premier panorama pertinent
        if (!this.currentPlayingYtId && res.current_videos && res.current_videos.length > 0) {
          const firstVid = res.current_videos[0];
          this.previewVideo(firstVid.yt_id, firstVid.title, firstVid.description);
        }
      }
    } catch (err) {
      console.error('[BibleProjectView] Erreur lors du chargement des médias:', err);
    } finally {
      this.isLoading = false;
    }
  },

  renderLists() {
    const root = document.getElementById('bp-media-lists-container');
    if (!root) return;

    if (!this.currentData) {
      root.innerHTML = `<div class="bp-empty-box"><p>Chargement des ressources BibleProject...</p></div>`;
      return;
    }

    if (this.activeSubTab === 'overviews') {
      this.renderOverviewsList(root);
    } else if (this.activeSubTab === 'posters') {
      this.renderPostersList(root);
    } else if (this.activeSubTab === 'words') {
      this.renderWordsList(root);
    } else if (this.activeSubTab === 'themes') {
      this.renderThemesList(root);
    }
  },

  renderOverviewsList(root) {
    const videos = this.currentData.all_videos || [];
    if (videos.length === 0) {
      root.innerHTML = `
        <div class="bp-empty-box">
          <p>Aucun panorama vidéo spécifique répertorié pour ce livre.</p>
        </div>
      `;
      return;
    }

    let html = `
      <div class="bp-section-title-row">
        <span class="bp-sec-title">Panoramas du livre (${this.currentData.book_name})</span>
        <span class="bp-sec-count">${videos.length} vidéo(s)</span>
      </div>
      <div class="bp-videos-grid">
    `;

    videos.forEach(v => {
      const isCurrentRange = this.currentChapter >= v.chapters[0] && this.currentChapter <= v.chapters[1];
      const isPlaying = this.currentPlayingYtId === v.yt_id;
      const thumbUrl = v.thumbnail || `https://i.ytimg.com/vi/${v.yt_id}/hqdefault.jpg`;

      html += `
        <div class="bp-video-card ${isCurrentRange ? 'is-active-range' : ''} ${isPlaying ? 'is-playing' : ''}" data-yt-id="${v.yt_id}">
          <div class="bp-video-thumb-wrap" onclick="BibleProjectView.playVideo('${v.yt_id}', '${this.escapeHtml(v.title)}', '${this.escapeHtml(v.description)}')">
            <img src="${thumbUrl}" class="bp-video-thumb-img" alt="${this.escapeHtml(v.title)}" loading="lazy">
            <div class="bp-play-badge">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            </div>
            <span class="bp-video-duration">${v.duration || 'Panorama'}</span>
            ${isCurrentRange ? `<span class="bp-cur-chap-badge">Chap. ${this.currentChapter}</span>` : ''}
          </div>
          <div class="bp-video-meta">
            <div class="bp-video-title" onclick="BibleProjectView.playVideo('${v.yt_id}', '${this.escapeHtml(v.title)}', '${this.escapeHtml(v.description)}')">${this.escapeHtml(v.title)}</div>
            <div class="bp-video-desc">${this.escapeHtml(v.description || '')}</div>
            <div class="bp-video-footer">
              <span class="bp-video-range-pill">Chapitres ${v.chapters[0]} à ${v.chapters[1]}</span>
              <button class="bp-btn-action-sm" onclick="BibleProjectView.playVideo('${v.yt_id}', '${this.escapeHtml(v.title)}', '${this.escapeHtml(v.description)}')">
                <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                <span>${isPlaying ? 'En cours' : 'Regarder'}</span>
              </button>
            </div>
          </div>
        </div>
      `;
    });

    html += `</div>`;
    root.innerHTML = html;
  },

  renderPostersList(root) {
    const posters = this.currentData.all_posters || [];
    if (posters.length === 0) {
      root.innerHTML = `
        <div class="bp-empty-box" style="padding: 24px 12px; text-align: center; color: var(--text-muted);">
          <p>Aucun poster haute définition répertorié pour ce livre.</p>
        </div>
      `;
      return;
    }

    let html = `
      <div class="bp-section-title-row">
        <span class="bp-sec-title">Affiches &amp; Schémas de Structure Littéraire</span>
        <span class="bp-sec-count">${posters.length} affiche(s)</span>
      </div>
      <div class="bp-posters-grid">
    `;

    posters.forEach(p => {
      const isCurrentRange = this.currentChapter >= p.chapters[0] && this.currentChapter <= p.chapters[1];

      html += `
        <div class="bp-poster-card ${isCurrentRange ? 'is-active-range' : ''}">
          <div class="bp-poster-thumb-wrap" onclick="BibleProjectView.openPosterModal('${p.image_url}', '${p.pdf_url}', '${this.escapeHtml(p.title)}')">
            <img src="${p.image_url}" class="bp-poster-thumb-img" alt="${this.escapeHtml(p.title)}" loading="lazy" onerror="this.src='img/textures/vintage/fond_bible.jpg'">
            <div class="bp-poster-zoom-overlay">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
              <span>Agrandir (Zoom HD)</span>
            </div>
          </div>
          <div class="bp-poster-meta">
            <div class="bp-poster-title">${this.escapeHtml(p.title)}</div>
            <div class="bp-poster-actions-row">
              <button type="button" class="bp-btn-view-poster" onclick="BibleProjectView.openPosterModal('${p.image_url}', '${p.pdf_url}', '${this.escapeHtml(p.title)}')">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                <span>Visualiser</span>
              </button>
              <button type="button" class="bp-btn-pdf-download" onclick="API.openExternalUrl('${p.pdf_url || p.image_url}')" title="Ouvrir l'affiche originale HD">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                <span>Affiche HD ↗</span>
              </button>
            </div>
          </div>
        </div>
      `;
    });

    html += `</div>`;
    root.innerHTML = html;
  },

  renderWordsList(root) {
    const allWords = this.currentData.word_studies || [];
    const query = (this.wordsFilterQuery || '').trim().toLowerCase();

    const filteredWords = allWords.filter(w => {
      if (!query) return true;
      const t = (w.title || '').toLowerCase();
      const orig = (w.hebrew_greek || '').toLowerCase();
      const desc = (w.description || '').toLowerCase();
      return t.includes(query) || orig.includes(query) || desc.includes(query);
    });

    let html = `
      <div class="bp-words-header-box">
        <div class="bp-section-title-row">
          <span class="bp-sec-title">Études de Mots Clés (Hébreu &amp; Grec)</span>
          <span class="bp-sec-count">${filteredWords.length} vidéo(s)</span>
        </div>
        <div class="bp-words-search-wrap">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" class="bp-words-search-input" id="bp-words-search-input" placeholder="Filtrer par mot (ex: Shalom, Évangile, Hessed, Âme...)" value="${this.escapeHtml(this.wordsFilterQuery)}">
          ${this.wordsFilterQuery ? `<button class="bp-words-search-clear" onclick="BibleProjectView.clearWordsFilter()">✕</button>` : ''}
        </div>
      </div>
      <div class="bp-words-grid">
    `;

    if (filteredWords.length === 0) {
      html += `
        <div class="bp-empty-box" style="grid-column: 1 / -1; padding: 24px 12px; text-align: center; color: var(--text-muted);">
          <p>Aucune étude de mot ne correspond à « ${this.escapeHtml(this.wordsFilterQuery)} ».</p>
        </div>
      `;
    } else {
      filteredWords.forEach(w => {
        const thumbUrl = w.thumbnail || `https://i.ytimg.com/vi/${w.yt_id}/hqdefault.jpg`;
        const isPlaying = this.currentPlayingYtId === w.yt_id;

        html += `
          <div class="bp-word-card ${isPlaying ? 'is-playing' : ''}" onclick="BibleProjectView.playVideo('${w.yt_id}', '${this.escapeHtml(w.title)}', '${this.escapeHtml(w.description)}')">
            <div class="bp-word-thumb">
              <img src="${thumbUrl}" alt="${this.escapeHtml(w.title)}" loading="lazy">
              <div class="bp-play-badge"><svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg></div>
              <span class="bp-word-dur">${w.duration || '5 min'}</span>
            </div>
            <div class="bp-word-info">
              <div class="bp-word-title">${this.escapeHtml(w.title)}</div>
              ${w.hebrew_greek ? `<div class="bp-word-original">${this.escapeHtml(w.hebrew_greek)}</div>` : ''}
              <div class="bp-word-desc">${this.escapeHtml(w.description || '')}</div>
            </div>
          </div>
        `;
      });
    }

    html += `</div>`;
    root.innerHTML = html;

    // Lier l'événement de saisie pour la recherche instantanée
    const searchInput = document.getElementById('bp-words-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.wordsFilterQuery = e.target.value;
        this.renderWordsList(root);
      });
    }
  },

  clearWordsFilter() {
    this.wordsFilterQuery = '';
    const root = document.getElementById('bp-media-lists-container');
    if (root) this.renderWordsList(root);
  },

  renderThemesList(root) {
    const themes = this.currentData.all_themes || [];

    let html = `
      <div class="bp-section-title-row">
        <span class="bp-sec-title">Thèmes Majeurs de la Théologie Biblique</span>
        <span class="bp-sec-count">${themes.length} vidéo(s)</span>
      </div>
      <div class="bp-themes-grid">
    `;

    themes.forEach(th => {
      const isRelated = (th.related_books || []).includes(this.currentBook);
      const thumbUrl = th.thumbnail || `https://i.ytimg.com/vi/${th.yt_id}/hqdefault.jpg`;
      const isPlaying = this.currentPlayingYtId === th.yt_id;

      html += `
        <div class="bp-theme-card ${isRelated ? 'is-related-theme' : ''} ${isPlaying ? 'is-playing' : ''}">
          <div class="bp-theme-thumb-wrap" onclick="BibleProjectView.playVideo('${th.yt_id}', '${this.escapeHtml(th.title)}', '${this.escapeHtml(th.description)}')">
            <img src="${thumbUrl}" class="bp-theme-thumb-img" alt="${this.escapeHtml(th.title)}" loading="lazy">
            <div class="bp-play-badge">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            </div>
            <span class="bp-video-duration">${th.duration || 'Thème'}</span>
            ${isRelated ? `<span class="bp-related-badge">Lié à ${this.currentBook}</span>` : ''}
          </div>
          <div class="bp-theme-meta">
            <div class="bp-theme-title" onclick="BibleProjectView.playVideo('${th.yt_id}', '${this.escapeHtml(th.title)}', '${this.escapeHtml(th.description)}')">${this.escapeHtml(th.title)}</div>
            <div class="bp-theme-desc">${this.escapeHtml(th.description || '')}</div>
          </div>
        </div>
      `;
    });

    html += `</div>`;
    root.innerHTML = html;
  },


  previewVideo(ytId, title, desc) {
    const placeholder = document.getElementById('bp-player-placeholder');
    const iframe = document.getElementById('bp-youtube-iframe');
    const infoBox = document.getElementById('bp-now-playing-info');

    if (infoBox) {
      infoBox.innerHTML = `
        <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 8px;">
          <div>
            <div class="bp-now-playing-title">${this.escapeHtml(title)}</div>
            <div class="bp-now-playing-desc">${this.escapeHtml(desc || '')}</div>
          </div>
          <button type="button" class="bp-btn-ext-yt" onclick="API.openExternalUrl('https://www.youtube.com/watch?v=${ytId}')" title="Ouvrir la vidéo sur YouTube">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            <span>YouTube ↗</span>
          </button>
        </div>
      `;
      infoBox.classList.remove('hidden');
    }

    if (placeholder) {
      placeholder.innerHTML = `
        <div class="bp-placeholder-preview" style="background-image: url('https://i.ytimg.com/vi/${ytId}/hqdefault.jpg')" onclick="BibleProjectView.playVideo('${ytId}', '${this.escapeHtml(title)}', '${this.escapeHtml(desc)}')">
          <div class="bp-preview-play-btn">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </div>
          <span class="bp-preview-title">${this.escapeHtml(title)}</span>
        </div>
      `;
      placeholder.classList.remove('hidden');
    }
    if (iframe) {
      iframe.classList.add('hidden');
      iframe.src = '';
    }
  },

  playVideo(ytId, title, desc) {
    this.currentPlayingYtId = ytId;
    const placeholder = document.getElementById('bp-player-placeholder');
    const iframe = document.getElementById('bp-youtube-iframe');
    const infoBox = document.getElementById('bp-now-playing-info');

    if (infoBox) {
      infoBox.innerHTML = `
        <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 8px;">
          <div>
            <div class="bp-now-playing-title">${this.escapeHtml(title)}</div>
            <div class="bp-now-playing-desc">${this.escapeHtml(desc || '')}</div>
          </div>
          <button type="button" class="bp-btn-ext-yt" onclick="API.openExternalUrl('https://www.youtube.com/watch?v=${ytId}')" title="Ouvrir la vidéo sur YouTube">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            <span>YouTube ↗</span>
          </button>
        </div>
      `;
      infoBox.classList.remove('hidden');
    }

    if (placeholder) placeholder.classList.add('hidden');
    if (iframe) {
      iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
      iframe.setAttribute('allowfullscreen', 'true');
      iframe.src = `https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&rel=0&modestbranding=1`;
      iframe.classList.remove('hidden');
    }

    // Mettre à jour l'état visuel dans les cartes
    this.renderLists();
  },

  /**
   * Visualiseur interactif Pan & Zoom pour les posters
   */
  bindPosterModal() {
    const modal = document.getElementById('bp-poster-modal');
    const closeBtn = document.getElementById('bp-poster-modal-close');
    const zoomInBtn = document.getElementById('bp-zoom-in');
    const zoomOutBtn = document.getElementById('bp-zoom-out');
    const zoomFitBtn = document.getElementById('bp-zoom-fit');
    const zoomResetBtn = document.getElementById('bp-zoom-reset');
    const viewport = document.getElementById('bp-poster-viewport');

    closeBtn?.addEventListener('click', () => this.closePosterModal());
    modal?.addEventListener('click', (e) => {
      if (e.target === modal) this.closePosterModal();
    });

    // Raccourci Échap
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
        this.closePosterModal();
      }
    });

    // Boutons de zoom
    zoomInBtn?.addEventListener('click', () => this.zoom(1.25));
    zoomOutBtn?.addEventListener('click', () => this.zoom(0.8));
    zoomFitBtn?.addEventListener('click', () => this.fitToScreen());
    zoomResetBtn?.addEventListener('click', () => this.resetZoom());

    // Molette de la souris pour le zoom interactif
    viewport?.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
      this.zoom(zoomFactor, e.clientX, e.clientY);
    }, { passive: false });

    // Glisser-déplacer (Pan)
    viewport?.addEventListener('mousedown', (e) => {
      if (e.button !== 0 || !this.panzoom) return; // Clic gauche uniquement
      this.panzoom.isDragging = true;
      this.panzoom.startX = e.clientX - (this.panzoom.translateX || 0);
      this.panzoom.startY = e.clientY - (this.panzoom.translateY || 0);
      viewport.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.panzoom || !this.panzoom.isDragging) return;
      this.panzoom.translateX = e.clientX - this.panzoom.startX;
      this.panzoom.translateY = e.clientY - this.panzoom.startY;
      this.applyTransform();
    });

    window.addEventListener('mouseup', () => {
      if (this.panzoom && this.panzoom.isDragging) {
        this.panzoom.isDragging = false;
        if (viewport) viewport.style.cursor = 'grab';
      }
    });


    // Double-clic pour alterner entre vue ajustée et zoom 100%
    viewport?.addEventListener('dblclick', () => {
      if (Math.abs(this.panzoom.scale - 1) < 0.1) {
        this.fitToScreen();
      } else {
        this.resetZoom();
      }
    });
  },

  openPosterModal(imageUrl, pdfUrl, title) {
    const modal = document.getElementById('bp-poster-modal');
    const titleEl = document.getElementById('bp-modal-poster-title');
    const dlBtn = document.getElementById('bp-poster-download-btn');
    const img = document.getElementById('bp-poster-highres-img');
    const loader = document.getElementById('bp-poster-loading');

    if (titleEl) titleEl.textContent = title || 'Structure littéraire';
    if (dlBtn) {
      dlBtn.onclick = (e) => {
        e.preventDefault();
        API.openExternalUrl(pdfUrl || imageUrl);
      };
    }

    if (img) {
      if (loader) loader.classList.remove('hidden');
      img.style.display = 'none';
      img.src = imageUrl;

      img.onload = () => {
        img.style.display = 'block';
        if (loader) loader.classList.add('hidden');
        setTimeout(() => {
          this.fitToScreen();
        }, 50);
      };
      img.onerror = () => {
        if (loader) loader.classList.add('hidden');
        img.style.display = 'block';
        img.src = 'img/textures/vintage/fond_bible.jpg';
      };
    }

    if (modal) {
      modal.classList.remove('hidden');
      document.body.classList.add('bp-modal-open');
    }
  },

  closePosterModal() {
    const modal = document.getElementById('bp-poster-modal');
    if (modal) {
      modal.classList.add('hidden');
      document.body.classList.remove('bp-modal-open');
    }
  },

  zoom(factor, clientX = null, clientY = null) {
    const newScale = Math.min(this.panzoom.maxScale, Math.max(this.panzoom.minScale, this.panzoom.scale * factor));
    this.panzoom.scale = newScale;
    this.applyTransform();
    this.updateZoomLabel();
  },

  fitToScreen() {
    this.panzoom.scale = 1.0;
    this.panzoom.translateX = 0;
    this.panzoom.translateY = 0;
    this.applyTransform();
    this.updateZoomLabel();
  },

  resetZoom() {
    // Mode 1:1 / Gros plan lecture (250%)
    this.panzoom.scale = this.panzoom.scale <= 1.2 ? 2.5 : 1.0;
    this.panzoom.translateX = 0;
    this.panzoom.translateY = 0;
    this.applyTransform();
    this.updateZoomLabel();
  },


  applyTransform() {
    const layer = document.getElementById('bp-poster-transform-layer');
    if (layer) {
      layer.style.transform = `translate(${this.panzoom.translateX}px, ${this.panzoom.translateY}px) scale(${this.panzoom.scale})`;
    }
  },

  updateZoomLabel() {
    const lbl = document.getElementById('bp-zoom-level-label');
    if (lbl) {
      lbl.textContent = `${Math.round(this.panzoom.scale * 100)}%`;
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
  }
};

window.BibleProjectView = BibleProjectView;
