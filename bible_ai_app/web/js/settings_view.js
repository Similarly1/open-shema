/**
 * Settings View Controller
 * Gère les sous-onglets de réglages, la sauvegarde, les clés API, STEPBible et le backup ZIP.
 */

const SettingsView = {
  config: {},
  dictionaries: [],

  init() {
    this.bindTabs();
    this.bindSliders();
    this.bindActions();
    this.loadData();
  },

  bindTabs() {
    document.querySelectorAll('.settings-tab').forEach(tabBtn => {
      tabBtn.addEventListener('click', () => {
        document.querySelectorAll('.settings-tab').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.settings-section').forEach(s => s.classList.remove('active'));

        tabBtn.classList.add('active');
        const secId = tabBtn.dataset.sec;
        const targetSec = document.getElementById(`sec-${secId}`);
        if (targetSec) {
          targetSec.classList.add('active');
        }
      });
    });
  },

  bindSliders() {
    const fontSizeSlider = document.getElementById('cfg-font-size');
    const fontSizeLbl = document.getElementById('lbl-font-size-val');
    fontSizeSlider.addEventListener('input', (e) => {
      fontSizeLbl.textContent = `${e.target.value} pt`;
      document.documentElement.style.setProperty('--bible-font-size-base', `${e.target.value}px`);
      const ws = document.getElementById('reader-workspace');
      if (ws) ws.style.setProperty('--bible-font-size-base', `${e.target.value}px`);
    });

    const lineSpacingSlider = document.getElementById('cfg-line-spacing');
    const lineSpacingLbl = document.getElementById('lbl-line-spacing-val');
    lineSpacingSlider.addEventListener('input', (e) => {
      lineSpacingLbl.textContent = `${e.target.value} px`;
    });

    const maxOrigSlider = document.getElementById('cfg-max-orig-verses');
    const maxOrigLbl = document.getElementById('lbl-max-orig-val');
    maxOrigSlider.addEventListener('input', (e) => {
      maxOrigLbl.textContent = `${e.target.value} vers.`;
    });
  },

  DEFAULT_SYNTH_PROMPT: `Vous êtes un éminent professeur de théologie et un exégète biblique chevronné.
Votre mission est de rédiger une SYNTHÈSE EXÉGÉTIQUE COMPARATIVE d'excellence à partir des extraits de commentaires fournis.

RÈGLES CRITIQUES DE RÉDACTION :
1. LANGUE : Rédigez TOUJOURS l'intégralité de la synthèse en FRANÇAIS impeccable, fluide et naturel, même si les commentaires ou sources fournis sont rédigés en anglais, en allemand ou dans une autre langue.
2. MENTION DES AUTEURS DANS LE TEXTE : Citez les auteurs naturellement en GRAS dans vos phrases (ex: « selon **Jean Calvin** », « **Matthew Henry** souligne que... », « **Albert Barnes** et **Scofield** précisent... »). NE METTEZ JAMAIS DE CROCHETS autour des noms d'auteurs.
3. CITATIONS DES SOURCES EN FIN D'AFFIRMATION : À la fin des points de doctrine ou des paragraphes de consensus, indiquez la ou les sources sous la forme \`{sources: NomAuteur1, NomAuteur2}\` (ex: \`{sources: Jean Calvin, Pulpit, Bible du sermon}\`).
4. FIDÉLITÉ STRICTE AUX SOURCES FOURNIES (ZÉRO HALLUCINATION) :
   - Basez votre analyse EXCLUSIVEMENT sur les extraits de commentaires fournis ci-dessous et sur le verset biblique affiché. N'inventez aucun commentaire, ne citez aucune source extérieure non fournie.
   - Si une source de la liste est une note d'étude (ex: « Notes d'étude Segond 21 » ou « Commentaire de la Bible d'étude de Genève »), citez-la expressément comme une note exégétique/d'étude et ne la confondez pas avec le texte biblique principal.
   - Ne comparez pas d'autres versions ou traductions bibliques non fournies : concentrez-vous à 100% sur l'exégèse comparative des commentaires théologiques fournis.
5. STRUCTURE IMPÉRATIVE (Markdown) :
   - ## 1. Consensus Exégétique & Thèmes Communs (Ce sur quoi les exégètes s'accordent, doctrine principale, sens direct du texte)
   - ## 2. Nuances, Divergences & Perspectives Particulières (Comparaison des points de vue, différences d'accentuation : typologie, dispensation, réformée, historique, analyse des mots originaux hébreux/grecs)
   - ## 3. Clés Textuelles & Applications Pastorales (Enseignements théologiques majeurs, implications pratiques et spirituelles pour la vie chrétienne)
   - ## 4. Synthèse des Sources Étudiées (Liste avec chaque auteur en gras suivi de deux-points et de son apport unique, ex: \`* **Jean Calvin** : Démontre la création ex nihilo...\`)`,

  DEFAULT_TRANS_PROMPT: `Vous êtes un traducteur exégétique et théologique de haute précision.
Votre mission est de traduire fidèlement, intégralement et précisément le texte biblique, commentaire ou notice de dictionnaire fourni vers le français.

RÈGLES STRICTES :
1. FIDÉLITÉ ABSOLUE : Traduisez l'intégralité du texte sans rien omettre, sans résumer, et sans inventer ni ajouter d'informations non présentes dans le texte original.
2. TERMINOLOGIE THÉOLOGIQUE : Respectez la terminologie biblique et théologique francophone établie.
3. FORMAT : Conservez la mise en forme originale (paragraphes, puces, références bibliques, codes Strong, termes hébreux/grecs).
4. NE JAMAIS dialoguer ni ajouter de préambule : Renvoyez UNIQUEMENT le texte traduit en français.`,

  DEFAULT_SUMMARY_PROMPT: `Tu es un professeur de théologie et un pédagogue chrétien chevronné.
Ton rôle est de produire un résumé synthétique, structuré, clair et fidèle du chapitre ou de l'ouvrage théologique fourni.

Directives de rédaction :
1. THÈSE & AXES PRINCIPAUX : Dégage la thèse centrale de l'auteur et les 3 à 5 idées maîtresses développées dans le texte.
2. ARGUMENTATION THÉOLOGIQUE : Explique avec rigueur les arguments doctrinaux et exégétiques clés avancés.
3. CITATIONS & ANCRAGE BIBLIQUE : Mentionne les références scripturaires majeures citées dans le chapitre.
4. FORMAT ET CLARTÉ : Structure le résumé avec des intertitres en gras, des puces synthétiques et une conclusion théologique en une phrase.
5. CONCISION : Respecte scrupuleusement la longueur cible demandée. Reste direct, sans préambule superflu.`,

  currentEditingPrompt: null,
  activeModalTab: 'preview',

  bindActions() {
    const triggerThemeUpdate = () => {
      const theme = document.getElementById('cfg-theme')?.value || 'dark';
      const palette = document.getElementById('cfg-theme-palette')?.value || 'dark-slate';
      const readingBg = document.getElementById('cfg-reading-bg')?.value || 'auto';
      App.applyTheme(theme, palette, readingBg);
    };

    // 1. Boutons Segmentés de Mode (Sombre / Clair / Système)
    document.querySelectorAll('.theme-mode-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.theme-mode-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const mode = btn.dataset.theme;
        const themeInput = document.getElementById('cfg-theme');
        if (themeInput) themeInput.value = mode;

        // Bascule de l'affichage des 3 pastilles selon le mode
        const darkGroup = document.getElementById('palette-selector-dark-group');
        const lightGroup = document.getElementById('palette-selector-light-group');
        const paletteInput = document.getElementById('cfg-theme-palette');

        if (mode === 'light') {
          darkGroup?.classList.add('hidden');
          lightGroup?.classList.remove('hidden');
          if (paletteInput && paletteInput.value.startsWith('dark')) {
            paletteInput.value = 'light-clean';
            this.updateActivePaletteCard('light-clean');
          }
        } else {
          // dark ou system
          lightGroup?.classList.add('hidden');
          darkGroup?.classList.remove('hidden');
          if (paletteInput && paletteInput.value.startsWith('light')) {
            paletteInput.value = 'dark-slate';
            this.updateActivePaletteCard('dark-slate');
          }
        }

        triggerThemeUpdate();
      });
    });

    // 2. Clic sur les pastilles bicolores de palette
    document.querySelectorAll('.palette-swatch-card').forEach(card => {
      card.addEventListener('click', () => {
        const palette = card.dataset.palette;
        const paletteInput = document.getElementById('cfg-theme-palette');
        if (paletteInput) paletteInput.value = palette;
        this.updateActivePaletteCard(palette);
        triggerThemeUpdate();
      });
    });

    // 3. Clic sur les tuiles de fond de lecture (Harmonisé, Blanc, Sépia, Sombre)
    document.querySelectorAll('.reading-bg-card').forEach(card => {
      card.addEventListener('click', () => {
        const bgVal = card.dataset.readingBg;
        const bgInput = document.getElementById('cfg-reading-bg');
        if (bgInput) bgInput.value = bgVal;
        this.updateActiveReadingBgCard(bgVal);
        triggerThemeUpdate();
      });
    });

    // 4. Commutateur Maître de Désactivation / Activation de l'IA
    const handleAIToggle = (e) => {
      const isEnabled = e.target.checked;
      App.applyAIEnabled(isEnabled, true);
      this.updateAIToggles(isEnabled);
      this.config.enable_ai = isEnabled;
      API.call('save_settings', { ...this.config, enable_ai: isEnabled });
      App.showToast(isEnabled ? 'Intelligence Artificielle activée' : 'Mode 100% Traditionnel sans IA activé');
    };

    document.getElementById('cfg-enable-ai')?.addEventListener('change', handleAIToggle);
    document.getElementById('cfg-enable-ai-tab')?.addEventListener('change', handleAIToggle);

    // Changement de police en direct
    document.getElementById('cfg-font-family')?.addEventListener('change', (e) => {
      App.applyFontFamily(e.target.value);
    });

    // Notes & Dossier Markdown
    document.getElementById('btn-browse-notes-dir')?.addEventListener('click', async () => {
      try {
        const res = await API.call('pick_notes_folder');
        if (res && res.success && res.path) {
          document.getElementById('cfg-notes-dir').value = res.path;
          App.showToast(`Dossier sélectionné : ${res.path}`);
        }
      } catch (e) {
        alert(`Erreur sélection dossier : ${e}`);
      }
    });

    document.getElementById('btn-open-notes-dir-cfg')?.addEventListener('click', async () => {
      try {
        const res = await API.call('open_notes_folder');
        if (res && res.success) {
          App.showToast(`Dossier ouvert : ${res.path}`);
        } else {
          alert(`Erreur : ${res?.error || 'Impossible d\'ouvrir le dossier'}`);
        }
      } catch (e) {
        alert(`Erreur : ${e}`);
      }
    });

    document.getElementById('btn-reset-notes-dir')?.addEventListener('click', () => {
      document.getElementById('cfg-notes-dir').value = '';
      App.showToast('Dossier réinitialisé par défaut (data/notes/)');
    });

    // Stockage & Fichier des Surlignages
    document.getElementById('btn-browse-highlights-file')?.addEventListener('click', async () => {
      try {
        const res = await API.call('pick_highlights_file');
        if (res && res.success && res.path) {
          document.getElementById('cfg-highlights-file').value = res.path;
          App.showToast(`Fichier sélectionné : ${res.path}`);
        }
      } catch (e) {
        alert(`Erreur sélection fichier : ${e}`);
      }
    });

    document.getElementById('btn-open-highlights-dir')?.addEventListener('click', async () => {
      try {
        const res = await API.call('open_highlights_folder');
        if (res && res.success) {
          App.showToast(`Dossier ouvert : ${res.path}`);
        } else {
          alert(`Erreur : ${res?.error || 'Impossible d\'ouvrir le dossier'}`);
        }
      } catch (e) {
        alert(`Erreur : ${e}`);
      }
    });

    document.getElementById('btn-reset-highlights-file')?.addEventListener('click', () => {
      document.getElementById('cfg-highlights-file').value = '';
      App.showToast('Fichier réinitialisé par défaut (data/highlights.json)');
    });

    // Boutons Export / Import des Surlignages dans les Paramètres
    document.getElementById('btn-cfg-export-hl-json')?.addEventListener('click', async () => {
      try {
        const res = await API.exportHighlights('json');
        if (res && res.success) {
          App.showToast(`Surlignages exportés avec succès (JSON)`);
        } else if (res && !res.cancelled) {
          App.showToast(`Erreur export : ${res.error || 'inconnue'}`);
        }
      } catch (err) {
        console.error('Erreur export JSON', err);
      }
    });

    document.getElementById('btn-cfg-export-hl-md')?.addEventListener('click', async () => {
      try {
        const res = await API.exportHighlights('md');
        if (res && res.success) {
          App.showToast(`Surlignages exportés avec succès (Markdown)`);
        } else if (res && !res.cancelled) {
          App.showToast(`Erreur export : ${res.error || 'inconnue'}`);
        }
      } catch (err) {
        console.error('Erreur export MD', err);
      }
    });

    document.getElementById('btn-cfg-import-hl-json')?.addEventListener('click', async () => {
      try {
        const res = await API.importHighlights('merge');
        if (res && res.success) {
          App.showToast(`✓ ${res.imported_count} surlignage(s) importé(s) (${res.total_count} au total)`);
          if (typeof HighlighterManager !== 'undefined' && typeof BibleReader !== 'undefined') {
            HighlighterManager.renderChapterHighlights(BibleReader.currentBook, BibleReader.currentChapter);
          }
        } else if (res && !res.cancelled) {
          App.showToast(`Erreur import : ${res.error || 'inconnue'}`);
        }
      } catch (err) {
        console.error('Erreur import JSON', err);
      }
    });

    document.getElementById('cfg-include-notes-ai')?.addEventListener('change', (e) => {
      this.config.include_notes_in_ai = e.target.checked;
      if (typeof NotesView !== 'undefined') {
        NotesView.updateAiToggleVisibility();
        NotesView.renderList();
      }
      if (typeof DrawerNotes !== 'undefined' && DrawerNotes.renderList) {
        DrawerNotes.renderList();
      }
    });

    // Boutons des cartes de prompts système
    document.getElementById('btn-open-modal-synth-prompt')?.addEventListener('click', () => {
      this.openPromptModal('synthesis');
    });

    document.getElementById('btn-open-modal-trans-prompt')?.addEventListener('click', () => {
      this.openPromptModal('translation');
    });

    document.getElementById('btn-open-modal-summary-prompt')?.addEventListener('click', () => {
      this.openPromptModal('summary');
    });

    document.getElementById('btn-reset-synth-prompt')?.addEventListener('click', () => {
      if (confirm('Voulez-vous rétablir le prompt de Synthèse Exégétique par défaut ?')) {
        document.getElementById('cfg-synthesis-system-prompt').value = this.DEFAULT_SYNTH_PROMPT;
        this.updateAllPromptStatusBadges();
        this.save();
        App.showToast('Prompt de synthèse rétabli par défaut');
      }
    });

    document.getElementById('btn-reset-trans-prompt')?.addEventListener('click', () => {
      if (confirm('Voulez-vous rétablir le prompt de Traduction par défaut ?')) {
        document.getElementById('cfg-translation-system-prompt').value = this.DEFAULT_TRANS_PROMPT;
        this.updateAllPromptStatusBadges();
        this.save();
        App.showToast('Prompt de traduction rétabli par défaut');
      }
    });

    document.getElementById('btn-reset-summary-prompt')?.addEventListener('click', () => {
      if (confirm('Voulez-vous rétablir le prompt de Résumé de Chapitre par défaut ?')) {
        document.getElementById('cfg-summary-system-prompt').value = this.DEFAULT_SUMMARY_PROMPT;
        this.updateAllPromptStatusBadges();
        this.save();
        App.showToast('Prompt de résumé rétabli par défaut');
      }
    });

    document.getElementById('cfg-summary-word-count')?.addEventListener('input', (e) => {
      const lbl = document.getElementById('lbl-summary-word-count-val');
      if (lbl) lbl.textContent = `~${e.target.value} mots`;
    });

    // Initialisation et liaison des paires de modèles (Principal / Fallback distincts)
    this.initModelSelectPairs();

    // Modale de Prompt Système
    document.getElementById('btn-close-prompt-modal')?.addEventListener('click', () => {
      this.closePromptModal();
    });

    document.getElementById('btn-modal-cancel-prompt')?.addEventListener('click', () => {
      this.closePromptModal();
    });

    document.getElementById('tab-prompt-edit')?.addEventListener('click', () => {
      this.switchPromptModalTab('edit');
    });

    document.getElementById('tab-prompt-preview')?.addEventListener('click', () => {
      this.switchPromptModalTab('preview');
    });

    document.getElementById('modal-prompt-textarea')?.addEventListener('input', () => {
      this.updatePromptModalStats();
      if (this.activeModalTab === 'preview') {
        this.renderPromptPreview();
      }
    });

    document.getElementById('btn-modal-reset-default')?.addEventListener('click', () => {
      this.resetPromptInModal();
    });

    document.getElementById('btn-modal-copy-prompt')?.addEventListener('click', () => {
      this.copyPromptInModal();
    });

    document.getElementById('btn-modal-save-prompt')?.addEventListener('click', () => {
      this.savePromptFromModal();
    });

    // Fermeture modale au clic sur le fond
    document.getElementById('modal-system-prompt')?.addEventListener('click', (e) => {
      if (e.target.id === 'modal-system-prompt') {
        this.closePromptModal();
      }
    });

    document.getElementById('btn-save-settings-top').addEventListener('click', () => {
      this.save();
    });

    // STEPBible
    document.getElementById('btn-reindex-stepbible').addEventListener('click', async () => {
      const btn = document.getElementById('btn-reindex-stepbible');
      btn.disabled = true;
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 14 14"></polyline>
        </svg>
        <span>Indexation en cours...</span>
      `;
      try {
        const ok = await API.call('reindex_stepbible');
        if (ok) {
          App.showToast('Base STEPBible mise à jour avec succès !');
          this.loadStepBibleStatus();
        } else {
          alert("Erreur lors de l'indexation STEPBible.");
        }
      } catch (e) {
        console.error(e);
      } finally {
        btn.disabled = false;
        btn.innerHTML = `
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" x2="12" y1="15" y2="3"></line>
          </svg>
          <span>Télécharger & Réindexer STEPBible</span>
        `;
      }
    });

    // Export ZIP
    document.getElementById('btn-export-zip').addEventListener('click', async () => {
      const statusEl = document.getElementById('backup-status-text');
      statusEl.textContent = 'Compression de vos données en cours...';
      try {
        const res = await API.call('export_backup_zip');
        if (res && res.success) {
          statusEl.textContent = `Sauvegarde réussie (${res.size_mb} Mo) : ${res.path}`;
          App.showToast('Sauvegarde complète exportée !');
        } else if (res && !res.cancelled) {
          statusEl.textContent = `Erreur : ${res.error}`;
        } else {
          statusEl.textContent = '';
        }
      } catch (e) {
        statusEl.textContent = `Erreur : ${e}`;
      }
    });

    // Import ZIP
    document.getElementById('btn-import-zip').addEventListener('click', async () => {
      const statusEl = document.getElementById('backup-status-text');
      if (confirm("Cette opération REMPLACERA vos données actuelles par celles du fichier ZIP.\n\nContinuer ?")) {
        statusEl.textContent = 'Restauration en cours...';
        try {
          const res = await API.call('import_backup_zip');
          if (res && res.success) {
            statusEl.textContent = 'Données restaurées avec succès !';
            App.showToast('Restauration terminée !');
          } else if (res && !res.cancelled) {
            statusEl.textContent = `Erreur : ${res.error}`;
          }
        } catch (e) {
          statusEl.textContent = `Erreur : ${e}`;
        }
      }
    });
  },

  updateActivePaletteCard(palette) {
    document.querySelectorAll('.palette-swatch-card').forEach(c => {
      c.classList.toggle('active', c.dataset.palette === palette);
    });
  },

  updateActiveReadingBgCard(bgVal) {
    document.querySelectorAll('.reading-bg-card').forEach(c => {
      c.classList.toggle('active', c.dataset.readingBg === bgVal);
    });
  },

  updateAIToggles(enabled) {
    const isEnabled = enabled !== false;
    const chk1 = document.getElementById('cfg-enable-ai');
    const chk2 = document.getElementById('cfg-enable-ai-tab');
    const banner1 = document.getElementById('ai-disabled-status-banner');
    const banner2 = document.getElementById('ai-disabled-status-banner-tab');
    const subConfig = document.getElementById('sec-ai-sub-config');

    if (chk1) chk1.checked = isEnabled;
    if (chk2) chk2.checked = isEnabled;

    if (banner1) banner1.classList.toggle('hidden', isEnabled);
    if (banner2) banner2.classList.toggle('hidden', isEnabled);
    if (subConfig) {
      subConfig.style.opacity = isEnabled ? '1' : '0.45';
      subConfig.style.pointerEvents = isEnabled ? 'auto' : 'none';
    }
  },

  async loadData() {
    try {
      this.config = await API.call('get_settings') || {};
      this.populateForm();
      this.loadStepBibleStatus();
      this.loadDictionaries();
    } catch (e) {
      console.error('Erreur chargement paramètres:', e);
    }
  },

  populateForm() {
    const c = this.config;
    const theme = c.theme || 'dark';
    const palette = c.theme_palette || 'dark-slate';
    const readingBg = c.reading_bg || 'auto';

    // 0. État Maître de l'IA
    const isAIEnabled = c.enable_ai !== false;
    this.updateAIToggles(isAIEnabled);
    App.applyAIEnabled(isAIEnabled, false);

    document.getElementById('cfg-theme').value = theme;
    if (document.getElementById('cfg-theme-palette')) {
      document.getElementById('cfg-theme-palette').value = palette;
    }
    if (document.getElementById('cfg-reading-bg')) {
      document.getElementById('cfg-reading-bg').value = readingBg;
    }

    // Boutons segmentés de mode
    document.querySelectorAll('.theme-mode-pill').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === theme);
    });

    const darkGroup = document.getElementById('palette-selector-dark-group');
    const lightGroup = document.getElementById('palette-selector-light-group');
    if (theme === 'light') {
      darkGroup?.classList.add('hidden');
      lightGroup?.classList.remove('hidden');
    } else {
      lightGroup?.classList.add('hidden');
      darkGroup?.classList.remove('hidden');
    }

    this.updateActivePaletteCard(palette);
    this.updateActiveReadingBgCard(readingBg);

    App.applyTheme(theme, palette, readingBg);

    const font = c.font_family || 'EB Garamond';
    document.getElementById('cfg-font-family').value = font;
    App.applyFontFamily(font);
    
    if (c.font_size) {
      document.getElementById('cfg-font-size').value = c.font_size;
      document.getElementById('lbl-font-size-val').textContent = `${c.font_size} pt`;
      document.documentElement.style.setProperty('--bible-font-size-base', `${c.font_size}px`);
      const ws = document.getElementById('reader-workspace');
      if (ws) ws.style.setProperty('--bible-font-size-base', `${c.font_size}px`);
    }
    if (c.line_spacing !== undefined) {
      document.getElementById('cfg-line-spacing').value = c.line_spacing;
      document.getElementById('lbl-line-spacing-val').textContent = `${c.line_spacing} px`;
    }

    if (typeof VintageThemeManager !== 'undefined') {
      VintageThemeManager.init(c);
    }

    document.getElementById('cfg-diff-pct').checked = c.show_diff_percentage !== false;
    document.getElementById('cfg-diff-highlight').checked = c.show_diff_highlights !== false;
    if (document.getElementById('cfg-show-chap-dividers')) {
      document.getElementById('cfg-show-chap-dividers').checked = c.show_chapter_dividers !== false;
    }
    if (document.getElementById('cfg-full-width')) {
      document.getElementById('cfg-full-width').checked = c.full_width_reading === true;
    }
    if (document.getElementById('cfg-show-geo-pins')) {
      document.getElementById('cfg-show-geo-pins').checked = c.show_geo_pins !== false;
    }

    document.getElementById('cfg-inter-surface').checked = c.interlinear_show_surface !== false;
    document.getElementById('cfg-inter-lemma').checked = c.interlinear_show_lemma !== false;
    document.getElementById('cfg-inter-translit').checked = c.interlinear_show_translit !== false;
    document.getElementById('cfg-inter-strong').checked = c.interlinear_show_strong !== false;

    if (c.max_original_verses_for_llm) {
      document.getElementById('cfg-max-orig-verses').value = c.max_original_verses_for_llm;
      document.getElementById('lbl-max-orig-val').textContent = `${c.max_original_verses_for_llm} vers.`;
    }

    if (c.notes_directory !== undefined) {
      document.getElementById('cfg-notes-dir').value = c.notes_directory || '';
    }
    if (c.highlights_file !== undefined && document.getElementById('cfg-highlights-file')) {
      document.getElementById('cfg-highlights-file').value = c.highlights_file || '';
    }
    document.getElementById('cfg-include-notes-ai').checked = c.include_notes_in_ai !== false;

    if (typeof NotesView !== 'undefined') {
      NotesView.updateAiToggleVisibility();
      NotesView.renderList();
    }
    if (typeof DrawerNotes !== 'undefined' && DrawerNotes.renderList) {
      DrawerNotes.renderList();
    }

    if (c.chat_model && document.getElementById('cfg-chat-model')) {
      document.getElementById('cfg-chat-model').value = c.chat_model;
    }
    if (c.chat_fallback_model && document.getElementById('cfg-chat-fallback-model')) {
      document.getElementById('cfg-chat-fallback-model').value = c.chat_fallback_model;
    }
    if (c.synthesis_model && document.getElementById('cfg-synthesis-model')) {
      document.getElementById('cfg-synthesis-model').value = c.synthesis_model;
    }
    if (c.synthesis_fallback_model && document.getElementById('cfg-synthesis-fallback-model')) {
      document.getElementById('cfg-synthesis-fallback-model').value = c.synthesis_fallback_model;
    }
    if (c.synthesis_max_verses && document.getElementById('cfg-synthesis-max-verses')) {
      document.getElementById('cfg-synthesis-max-verses').value = c.synthesis_max_verses;
    }

    if (c.translation_model && document.getElementById('cfg-translation-model')) {
      document.getElementById('cfg-translation-model').value = c.translation_model;
    }
    if (c.translation_fallback_model && document.getElementById('cfg-translation-fallback-model')) {
      document.getElementById('cfg-translation-fallback-model').value = c.translation_fallback_model;
    }
    if (c.summary_model && document.getElementById('cfg-summary-model')) {
      document.getElementById('cfg-summary-model').value = c.summary_model;
    }
    if (c.summary_fallback_model && document.getElementById('cfg-summary-fallback-model')) {
      document.getElementById('cfg-summary-fallback-model').value = c.summary_fallback_model;
    }
    if (document.getElementById('cfg-summary-word-count')) {
      document.getElementById('cfg-summary-word-count').value = c.summary_word_count || 300;
      const lbl = document.getElementById('lbl-summary-word-count-val');
      if (lbl) lbl.textContent = `~${c.summary_word_count || 300} mots`;
    }

    // Synchronisation et exclusion des doublons Principal / Fallback
    this.syncAllModelPairs(false);

    if (document.getElementById('cfg-synthesis-system-prompt')) {
      document.getElementById('cfg-synthesis-system-prompt').value = c.synthesis_system_prompt || '';
    }
    if (document.getElementById('cfg-translation-system-prompt')) {
      document.getElementById('cfg-translation-system-prompt').value = c.translation_system_prompt || '';
    }
    if (document.getElementById('cfg-summary-system-prompt')) {
      document.getElementById('cfg-summary-system-prompt').value = c.summary_system_prompt || '';
    }
    this.updateAllPromptStatusBadges();

    if (c.gemini_api_key) document.getElementById('cfg-gemini-key').value = c.gemini_api_key;
    if (c.mistral_api_key) document.getElementById('cfg-mistral-key').value = c.mistral_api_key;
    if (c.infomaniak_token) document.getElementById('cfg-infomaniak-token').value = c.infomaniak_token;
    if (c.infomaniak_product_id) document.getElementById('cfg-infomaniak-pid').value = c.infomaniak_product_id;
  },

  initModelSelectPairs() {
    const pairs = [
      { primary: 'cfg-chat-model', fallback: 'cfg-chat-fallback-model', label: 'Chat' },
      { primary: 'cfg-synthesis-model', fallback: 'cfg-synthesis-fallback-model', label: 'Synthèse' },
      { primary: 'cfg-translation-model', fallback: 'cfg-translation-fallback-model', label: 'Traduction' },
      { primary: 'cfg-summary-model', fallback: 'cfg-summary-fallback-model', label: 'Résumé' }
    ];

    pairs.forEach(({ primary, fallback, label }) => {
      const pEl = document.getElementById(primary);
      const fEl = document.getElementById(fallback);
      if (!pEl || !fEl) return;

      pEl.addEventListener('change', () => {
        this.syncModelPair(primary, fallback, label, true);
        this.save();
      });

      fEl.addEventListener('change', () => {
        if (fEl.value === pEl.value) {
          const alternate = this.getSmartFallbackModel(pEl.value, fEl);
          if (alternate) {
            fEl.value = alternate;
            App.showToast(`Le modèle de secours (${label}) doit être distinct du modèle principal.`);
          }
        }
        this.syncModelPair(primary, fallback, label, false);
        this.save();
      });
    });

    this.syncAllModelPairs(false);
  },

  syncAllModelPairs(isUserChange = false) {
    const pairs = [
      { primary: 'cfg-chat-model', fallback: 'cfg-chat-fallback-model', label: 'Chat' },
      { primary: 'cfg-synthesis-model', fallback: 'cfg-synthesis-fallback-model', label: 'Synthèse' },
      { primary: 'cfg-translation-model', fallback: 'cfg-translation-fallback-model', label: 'Traduction' },
      { primary: 'cfg-summary-model', fallback: 'cfg-summary-fallback-model', label: 'Résumé' }
    ];

    pairs.forEach(({ primary, fallback, label }) => {
      this.syncModelPair(primary, fallback, label, isUserChange);
    });
  },

  syncModelPair(primaryId, fallbackId, label, isUserChange = false) {
    const pEl = document.getElementById(primaryId);
    const fEl = document.getElementById(fallbackId);
    if (!pEl || !fEl) return;

    const pVal = pEl.value;
    const fVal = fEl.value;

    // Désactiver l'option identique dans le sélecteur de secours
    Array.from(fEl.options).forEach(opt => {
      if (opt.value === pVal) {
        opt.disabled = true;
        if (!opt.text.includes('(Inactif - Identique au principal)')) {
          opt.dataset.origText = opt.text;
          opt.text = `${opt.text} (Indisponible en secours)`;
        }
      } else {
        opt.disabled = false;
        if (opt.dataset.origText) {
          opt.text = opt.dataset.origText;
          delete opt.dataset.origText;
        }
      }
    });

    // Si le fallback a la même valeur que le principal, basculer vers un modèle alternatif distinct
    if (fVal === pVal) {
      const alternate = this.getSmartFallbackModel(pVal, fEl);
      if (alternate) {
        fEl.value = alternate;
        if (isUserChange) {
          App.showToast(`Modèle de secours (${label}) ajusté : distinct du modèle principal.`);
        }
      }
    }
  },

  getSmartFallbackModel(primaryModel, fallbackSelectEl) {
    // Ordre de priorité intelligent pour le fallback
    const defaultsOrder = [
      'gemini-3.5-flash-lite',
      'gemini-2.5-flash-lite',
      'gemini-3.5-flash',
      'gemini-2.5-flash',
      'gemini-3.1-flash-lite',
      'mistral-small-latest',
      'gemini-3.7-flash',
      'mistral-large-latest',
      'mistralai/Ministral-3-14B-Instruct-2512',
      'mistralai/Mistral-Small-4-119B-2603',
      'Qwen/Qwen3.5-122B-A10B-FP8'
    ];

    for (const model of defaultsOrder) {
      if (model !== primaryModel) {
        const opt = fallbackSelectEl.querySelector(`option[value="${model}"]`);
        if (opt && !opt.disabled) return model;
      }
    }

    // Premier choix valide disponible
    for (const opt of fallbackSelectEl.options) {
      if (opt.value && opt.value !== primaryModel && !opt.disabled) {
        return opt.value;
      }
    }
    return '';
  },

  async loadStepBibleStatus() {
    const textEl = document.getElementById('stepbible-status-text');
    const dotEl = document.getElementById('stepbible-status-dot');
    try {
      const stats = await API.call('get_stepbible_status');
      if (stats && stats.installed) {
        textEl.textContent = `Base installée : ${stats.total_words.toLocaleString()} mots (AT Hébreu : ${stats.ot_words.toLocaleString()}, NT Grec : ${stats.nt_words.toLocaleString()})`;
        dotEl.style.color = '#10B981';
      } else {
        textEl.textContent = 'Base de données originale non installée.';
        dotEl.style.color = '#F59E0B';
      }
    } catch (e) {
      textEl.textContent = 'État non disponible';
    }
  },

  async loadDictionaries() {
    const listEl = document.getElementById('dict-reorder-list');
    listEl.innerHTML = '';
    try {
      this.dictionaries = await API.call('get_dictionaries') || [];
      this.dictionaries.forEach((d, idx) => {
        const item = document.createElement('div');
        item.className = 'dict-item-row';
        item.innerHTML = `
          <span class="prio-tag">#${idx + 1}</span>
          <button class="btn-prio-move" data-dir="-1" ${idx === 0 ? 'disabled' : ''}>▲</button>
          <button class="btn-prio-move" data-dir="1" ${idx === this.dictionaries.length - 1 ? 'disabled' : ''}>▼</button>
          <label class="custom-checkbox" style="margin-left: 8px;">
            <input type="checkbox" ${d.enabled !== false ? 'checked' : ''} data-dict-id="${d.id}">
            <span>${d.name} ${d.count ? `(${d.count.toLocaleString()} articles)` : ''}</span>
          </label>
        `;

        item.querySelectorAll('.btn-prio-move').forEach(btn => {
          btn.addEventListener('click', () => {
            const dir = parseInt(btn.dataset.dir);
            this.moveDictionaryPriority(idx, dir);
          });
        });

        item.querySelector('input[type="checkbox"]').addEventListener('change', (e) => {
          d.enabled = e.target.checked;
          API.call('save_dictionaries', this.dictionaries);
        });

        listEl.appendChild(item);
      });
    } catch (e) {
      console.error('Erreur chargement dictionnaires:', e);
    }
  },

  moveDictionaryPriority(idx, direction) {
    const targetIdx = idx + direction;
    if (targetIdx >= 0 && targetIdx < this.dictionaries.length) {
      const temp = this.dictionaries[idx];
      this.dictionaries[idx] = this.dictionaries[targetIdx];
      this.dictionaries[targetIdx] = temp;
      API.call('save_dictionaries', this.dictionaries);
      this.loadDictionaries();
    }
  },

  async save() {
    const newCfg = { ...this.config };
    newCfg.enable_ai = document.getElementById('cfg-enable-ai')?.checked !== false;
    newCfg.theme = document.getElementById('cfg-theme').value;
    newCfg.theme_palette = document.getElementById('cfg-theme-palette')?.value || 'dark-slate';
    newCfg.reading_bg = document.getElementById('cfg-reading-bg')?.value || 'auto';
    newCfg.font_family = document.getElementById('cfg-font-family').value;
    newCfg.font_size = parseInt(document.getElementById('cfg-font-size').value);
    newCfg.line_spacing = parseInt(document.getElementById('cfg-line-spacing').value);

    // Options Mode Historique & Immersion Époque
    newCfg.vintage_mode = document.getElementById('cfg-vintage-mode')?.checked !== false;
    newCfg.vintage_scope = document.querySelector('input[name="cfg-vintage-scope"]:checked')?.value || 'auto';
    newCfg.vintage_intensity = document.querySelector('input[name="cfg-vintage-intensity"]:checked')?.value || 'subtle';
    if (typeof VintageThemeManager !== 'undefined') {
      VintageThemeManager.init(newCfg);
    }

    newCfg.show_diff_percentage = document.getElementById('cfg-diff-pct').checked;
    newCfg.show_diff_highlights = document.getElementById('cfg-diff-highlight').checked;
    if (document.getElementById('cfg-show-chap-dividers')) {
      newCfg.show_chapter_dividers = document.getElementById('cfg-show-chap-dividers').checked;
    }
    if (document.getElementById('cfg-show-geo-pins')) {
      newCfg.show_geo_pins = document.getElementById('cfg-show-geo-pins').checked;
      const ws = document.getElementById('reader-workspace');
      if (ws) ws.classList.toggle('hide-geo-pins', !newCfg.show_geo_pins);
      const chkGeo = document.getElementById('opt-show-geo-pins');
      if (chkGeo) chkGeo.checked = newCfg.show_geo_pins;
    }
    if (document.getElementById('cfg-full-width')) {
      newCfg.full_width_reading = document.getElementById('cfg-full-width').checked;
    }

    newCfg.interlinear_show_surface = document.getElementById('cfg-inter-surface').checked;
    newCfg.interlinear_show_lemma = document.getElementById('cfg-inter-lemma').checked;
    newCfg.interlinear_show_translit = document.getElementById('cfg-inter-translit').checked;
    newCfg.interlinear_show_strong = document.getElementById('cfg-inter-strong').checked;

    newCfg.max_original_verses_for_llm = parseInt(document.getElementById('cfg-max-orig-verses').value);
    newCfg.notes_directory = document.getElementById('cfg-notes-dir').value.trim();
    if (document.getElementById('cfg-highlights-file')) {
      newCfg.highlights_file = document.getElementById('cfg-highlights-file').value.trim();
    }
    newCfg.include_notes_in_ai = document.getElementById('cfg-include-notes-ai').checked;

    newCfg.chat_model = document.getElementById('cfg-chat-model').value;
    if (document.getElementById('cfg-chat-fallback-model')) {
      let fb = document.getElementById('cfg-chat-fallback-model').value;
      if (fb === newCfg.chat_model) {
        fb = this.getSmartFallbackModel(newCfg.chat_model, document.getElementById('cfg-chat-fallback-model'));
        document.getElementById('cfg-chat-fallback-model').value = fb;
      }
      newCfg.chat_fallback_model = fb;
    }
    if (document.getElementById('cfg-synthesis-model')) {
      newCfg.synthesis_model = document.getElementById('cfg-synthesis-model').value;
    }
    if (document.getElementById('cfg-synthesis-fallback-model')) {
      let fb = document.getElementById('cfg-synthesis-fallback-model').value;
      if (fb === newCfg.synthesis_model) {
        fb = this.getSmartFallbackModel(newCfg.synthesis_model, document.getElementById('cfg-synthesis-fallback-model'));
        document.getElementById('cfg-synthesis-fallback-model').value = fb;
      }
      newCfg.synthesis_fallback_model = fb;
    }
    if (document.getElementById('cfg-synthesis-max-verses')) {
      newCfg.synthesis_max_verses = parseInt(document.getElementById('cfg-synthesis-max-verses').value) || 5;
    }
    if (document.getElementById('cfg-translation-model')) {
      newCfg.translation_model = document.getElementById('cfg-translation-model').value;
    }
    if (document.getElementById('cfg-translation-fallback-model')) {
      let fb = document.getElementById('cfg-translation-fallback-model').value;
      if (fb === newCfg.translation_model) {
        fb = this.getSmartFallbackModel(newCfg.translation_model, document.getElementById('cfg-translation-fallback-model'));
        document.getElementById('cfg-translation-fallback-model').value = fb;
      }
      newCfg.translation_fallback_model = fb;
    }
    if (document.getElementById('cfg-summary-model')) {
      newCfg.summary_model = document.getElementById('cfg-summary-model').value;
    }
    if (document.getElementById('cfg-summary-fallback-model')) {
      let fb = document.getElementById('cfg-summary-fallback-model').value;
      if (fb === newCfg.summary_model) {
        fb = this.getSmartFallbackModel(newCfg.summary_model, document.getElementById('cfg-summary-fallback-model'));
        document.getElementById('cfg-summary-fallback-model').value = fb;
      }
      newCfg.summary_fallback_model = fb;
    }
    if (document.getElementById('cfg-summary-word-count')) {
      newCfg.summary_word_count = parseInt(document.getElementById('cfg-summary-word-count').value) || 300;
    }
    if (document.getElementById('cfg-synthesis-system-prompt')) {
      newCfg.synthesis_system_prompt = document.getElementById('cfg-synthesis-system-prompt').value;
    }
    if (document.getElementById('cfg-translation-system-prompt')) {
      newCfg.translation_system_prompt = document.getElementById('cfg-translation-system-prompt').value;
    }
    if (document.getElementById('cfg-summary-system-prompt')) {
      newCfg.summary_system_prompt = document.getElementById('cfg-summary-system-prompt').value;
    }

    newCfg.gemini_api_key = document.getElementById('cfg-gemini-key').value.trim();
    newCfg.mistral_api_key = document.getElementById('cfg-mistral-key').value.trim();
    newCfg.infomaniak_token = document.getElementById('cfg-infomaniak-token').value.trim();
    newCfg.infomaniak_product_id = document.getElementById('cfg-infomaniak-pid').value.trim();

    try {
      await API.call('save_settings', newCfg);
      this.config = newCfg;
      this.updateAllPromptStatusBadges();
      App.applyTheme(newCfg.theme, newCfg.theme_palette, newCfg.reading_bg);
      App.applyFontFamily(newCfg.font_family);
      if (typeof NotesView !== 'undefined') {
        NotesView.updateAiToggleVisibility();
        NotesView.renderList();
      }
      if (typeof DrawerNotes !== 'undefined' && DrawerNotes.renderList) {
        DrawerNotes.renderList();
      }
      App.showToast('Paramètres enregistrés avec succès !');
    } catch (e) {
      alert(`Erreur d'enregistrement : ${e}`);
    }
  },

  // =========================================================
  // GESTIONNAIRE DE MODALE DE PROMPT SYSTÈME DÉDIÉE
  // =========================================================
  openPromptModal(type) {
    this.currentEditingPrompt = type;
    const titleEl = document.getElementById('system-prompt-modal-title');
    const textarea = document.getElementById('modal-prompt-textarea');

    if (titleEl) {
      if (type === 'synthesis') {
        titleEl.textContent = 'System Prompt — Synthèse Exégétique IA';
      } else if (type === 'translation') {
        titleEl.textContent = 'System Prompt — Traduction Fidèle d\'Articles';
      } else if (type === 'summary') {
        titleEl.textContent = 'System Prompt — Résumé Théologique de Chapitre';
      }
    }

    let currentVal = '';
    if (type === 'synthesis') {
      currentVal = document.getElementById('cfg-synthesis-system-prompt')?.value || this.DEFAULT_SYNTH_PROMPT;
    } else if (type === 'translation') {
      currentVal = document.getElementById('cfg-translation-system-prompt')?.value || this.DEFAULT_TRANS_PROMPT;
    } else if (type === 'summary') {
      currentVal = document.getElementById('cfg-summary-system-prompt')?.value || this.DEFAULT_SUMMARY_PROMPT;
    }

    if (textarea) {
      textarea.value = currentVal;
    }

    this.switchPromptModalTab('preview');
    this.updatePromptModalStats();

    const modal = document.getElementById('modal-system-prompt');
    if (modal) {
      modal.classList.remove('hidden');
    }
  },

  closePromptModal() {
    const modal = document.getElementById('modal-system-prompt');
    if (modal) {
      modal.classList.add('hidden');
    }
    this.currentEditingPrompt = null;
  },

  switchPromptModalTab(tab) {
    this.activeModalTab = tab;
    const tabEdit = document.getElementById('tab-prompt-edit');
    const tabPrev = document.getElementById('tab-prompt-preview');
    const paneEdit = document.getElementById('prompt-editor-pane');
    const panePrev = document.getElementById('prompt-preview-pane');

    if (tab === 'edit') {
      tabEdit?.classList.add('active');
      tabPrev?.classList.remove('active');
      paneEdit?.classList.remove('hidden');
      panePrev?.classList.add('hidden');
      const textarea = document.getElementById('modal-prompt-textarea');
      if (textarea) {
        setTimeout(() => textarea.focus(), 60);
      }
    } else {
      tabPrev?.classList.add('active');
      tabEdit?.classList.remove('active');
      panePrev?.classList.remove('hidden');
      paneEdit?.classList.add('hidden');
      this.renderPromptPreview();
    }
  },

  updatePromptModalStats() {
    const val = document.getElementById('modal-prompt-textarea')?.value || '';
    const charCount = val.length;
    const lineCount = val ? val.split('\n').length : 0;

    const charEl = document.getElementById('prompt-char-count');
    const lineEl = document.getElementById('prompt-line-count');
    const badgeEl = document.getElementById('modal-prompt-status-badge');

    if (charEl) charEl.textContent = `${charCount.toLocaleString()} caractères`;
    if (lineEl) lineEl.textContent = `${lineCount.toLocaleString()} lignes`;

    if (badgeEl && this.currentEditingPrompt) {
      let def = this.DEFAULT_SYNTH_PROMPT;
      if (this.currentEditingPrompt === 'translation') def = this.DEFAULT_TRANS_PROMPT;
      if (this.currentEditingPrompt === 'summary') def = this.DEFAULT_SUMMARY_PROMPT;
      const isDef = val.trim() === def.trim();
      badgeEl.textContent = isDef ? 'Par défaut' : 'Personnalisé';
      badgeEl.className = `prompt-status-badge ${isDef ? 'is-default' : 'is-custom'}`;
    }
  },

  renderPromptPreview() {
    const val = document.getElementById('modal-prompt-textarea')?.value || '';
    const container = document.getElementById('modal-prompt-rendered');
    if (container) {
      container.innerHTML = this.renderPromptMarkdown(val);
    }
  },

  async savePromptFromModal() {
    if (!this.currentEditingPrompt) return;
    const val = document.getElementById('modal-prompt-textarea')?.value || '';
    let targetFieldId = 'cfg-synthesis-system-prompt';
    if (this.currentEditingPrompt === 'translation') targetFieldId = 'cfg-translation-system-prompt';
    if (this.currentEditingPrompt === 'summary') targetFieldId = 'cfg-summary-system-prompt';

    const field = document.getElementById(targetFieldId);
    if (field) {
      field.value = val;
    }

    this.closePromptModal();
    this.updateAllPromptStatusBadges();
    await this.save();
    App.showToast('Prompt système appliqué et enregistré !');
  },

  resetPromptInModal() {
    if (!this.currentEditingPrompt) return;
    let def = this.DEFAULT_SYNTH_PROMPT;
    let label = 'Synthèse';
    if (this.currentEditingPrompt === 'translation') {
      def = this.DEFAULT_TRANS_PROMPT;
      label = 'Traduction';
    } else if (this.currentEditingPrompt === 'summary') {
      def = this.DEFAULT_SUMMARY_PROMPT;
      label = 'Résumé';
    }
    if (confirm(`Voulez-vous rétablir le prompt de ${label} par défaut ?`)) {
      const textarea = document.getElementById('modal-prompt-textarea');
      if (textarea) {
        textarea.value = def;
        this.updatePromptModalStats();
        if (this.activeModalTab === 'preview') {
          this.renderPromptPreview();
        }
      }
      App.showToast('Prompt réinitialisé au texte par défaut');
    }
  },

  async copyPromptInModal() {
    const val = document.getElementById('modal-prompt-textarea')?.value || '';
    try {
      await navigator.clipboard.writeText(val);
      App.showToast('Prompt copié dans le presse-papiers !');
    } catch (e) {
      App.showToast('Erreur lors de la copie');
    }
  },

  updateAllPromptStatusBadges() {
    const synthVal = (document.getElementById('cfg-synthesis-system-prompt')?.value || '').trim();
    const synthDefault = this.DEFAULT_SYNTH_PROMPT.trim();
    const badgeSynth = document.getElementById('badge-synth-status');
    if (badgeSynth) {
      const isDef = !synthVal || synthVal === synthDefault;
      badgeSynth.textContent = isDef ? 'Par défaut' : 'Personnalisé';
      badgeSynth.className = `prompt-status-badge ${isDef ? 'is-default' : 'is-custom'}`;
    }

    const transVal = (document.getElementById('cfg-translation-system-prompt')?.value || '').trim();
    const transDefault = this.DEFAULT_TRANS_PROMPT.trim();
    const badgeTrans = document.getElementById('badge-trans-status');
    if (badgeTrans) {
      const isDef = !transVal || transVal === transDefault;
      badgeTrans.textContent = isDef ? 'Par défaut' : 'Personnalisé';
      badgeTrans.className = `prompt-status-badge ${isDef ? 'is-default' : 'is-custom'}`;
    }

    const sumVal = (document.getElementById('cfg-summary-system-prompt')?.value || '').trim();
    const sumDefault = this.DEFAULT_SUMMARY_PROMPT.trim();
    const badgeSum = document.getElementById('badge-summary-status');
    if (badgeSum) {
      const isDef = !sumVal || sumVal === sumDefault;
      badgeSum.textContent = isDef ? 'Par défaut' : 'Personnalisé';
      badgeSum.className = `prompt-status-badge ${isDef ? 'is-default' : 'is-custom'}`;
    }
  },

  renderPromptMarkdown(text) {
    if (!text || !text.trim()) {
      return '<p style="color: var(--text-muted); font-style: italic;">Prompt vide.</p>';
    }

    let md = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // 1. Blocs de code
    md = md.replace(/```([\s\S]*?)```/g, (match, p1) => {
      return `<pre><code>${p1.trim()}</code></pre>\n\n`;
    });

    // 2. Titres
    md = md.replace(/^### (.*$)/gim, '<h3>$1</h3>\n');
    md = md.replace(/^## (.*$)/gim, '<h2>$1</h2>\n');
    md = md.replace(/^# (.*$)/gim, '<h1>$1</h1>\n');

    // 3. Citations
    md = md.replace(/^\&gt; (.*$)/gim, '<blockquote>$1</blockquote>\n');

    // 4. Listes à puces & numérotées
    md = md.replace(/^[\-\*] (.*$)/gim, '<ul><li>$1</li></ul>');
    md = md.replace(/^\d+\. (.*$)/gim, '<ol><li>$1</li></ol>');
    md = md.replace(/<\/ul>\s*<ul>/g, '').replace(/<\/ol>\s*<ol>/g, '');

    // 5. Ligne horizontale
    md = md.replace(/^---$/gim, '<hr>\n');

    // 6. Formatage en ligne
    md = md
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');

    // 7. Paragraphes
    const blocks = md.split(/\n\s*\n/);
    const htmlBlocks = blocks.map(block => {
      const b = block.trim();
      if (!b) return '';
      if (b.startsWith('<h1') || b.startsWith('<h2') || b.startsWith('<h3') || 
          b.startsWith('<pre') || b.startsWith('<blockquote') || 
          b.startsWith('<ul') || b.startsWith('<ol') || b.startsWith('<hr')) {
        return b;
      }
      return `<p>${b.replace(/\n/g, '<br>')}</p>`;
    });

    return htmlBlocks.filter(Boolean).join('\n') || '<p><br></p>';
  }
};
