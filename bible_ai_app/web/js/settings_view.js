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

    document.getElementById('btn-reset-synth-prompt')?.addEventListener('click', () => {
      const defaultSynthPrompt = `Vous êtes un éminent professeur de théologie et un exégète biblique chevronné.
Votre mission est de rédiger une SYNTHÈSE EXÉGÉTIQUE COMPARATIVE d'excellence à partir des extraits de commentaires fournis.

RÈGLES CRITIQUES DE RÉDACTION :
1. LANGUE : Rédigez TOUJOURS l'intégralité de la synthèse en FRANÇAIS impeccable, fluide et naturel, même si les commentaires ou sources fournis sont rédigés en anglais, en allemand ou dans une autre langue.
2. FIDÉLITÉ : Basez votre analyse rigoureusement sur les commentaires fournis. Ne spéculez pas et n'inventez aucun contenu.
3. CITATIONS : Citez nommément et explicitement les auteurs ou ouvrages entre crochets gras (ex: **[John MacArthur]**, **[Matthew Henry]**, **[J.N. Darby]**, **[Bible Annotée]**, **[Jean Calvin]**) pour chaque affirmation basée sur leurs écrits.
4. STRUCTURE IMPÉRATIVE (Markdown) :
   - ## 📌 1. Consensus Exégétique & Thèmes Communs (Ce sur quoi tous les auteurs s'accordent, doctrine principale, sens direct du texte)
   - ## 🔍 2. Nuances, Divergences & Traditions Théologiques (Comparaison des points de vue, différences d'accentuation : typologique, dispensationaliste, réformée, historique, analyse des mots originaux hébreux/grecs)
   - ## 💡 3. Clés Textuelles & Applications Pastorales (Enseignements théologiques majeurs, implications pratiques et spirituelles pour la foi)
   - ## 📚 4. Synthèse des Sources Étudiées (Bref résumé récapitulatif des apports uniques de chaque commentateur cité)`;
      document.getElementById('cfg-synthesis-system-prompt').value = defaultSynthPrompt;
      App.showToast('Prompt de synthèse rétabli par défaut');
    });

    document.getElementById('btn-reset-trans-prompt')?.addEventListener('click', () => {
      const defaultTransPrompt = `Vous êtes un traducteur exégétique et théologique de haute précision.
Votre mission est de traduire fidèlement, intégralement et précisément le texte biblique, commentaire ou notice de dictionnaire fourni vers le français.

RÈGLES STRICTES :
1. FIDÉLITÉ ABSOLUE : Traduisez l'intégralité du texte sans rien omettre, sans résumer, et sans inventer ni ajouter d'informations non présentes dans le texte original.
2. TERMINOLOGIE THÉOLOGIQUE : Respectez la terminologie biblique et théologique francophone établie.
3. FORMAT : Conservez la mise en forme originale (paragraphes, puces, références bibliques, codes Strong, termes hébreux/grecs).
4. NE JAMAIS dialoguer ni ajouter de préambule : Renvoyez UNIQUEMENT le texte traduit en français.`;
      document.getElementById('cfg-translation-system-prompt').value = defaultTransPrompt;
      App.showToast('Prompt de traduction rétabli par défaut');
    });

    document.getElementById('btn-save-settings-top').addEventListener('click', () => {
      this.save();
    });

    // STEPBible
    document.getElementById('btn-reindex-stepbible').addEventListener('click', async () => {
      const btn = document.getElementById('btn-reindex-stepbible');
      btn.disabled = true;
      btn.textContent = '⏳ Indexation en cours...';
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
        btn.textContent = '📥 Télécharger & Réindexer STEPBible';
      }
    });

    // Export ZIP
    document.getElementById('btn-export-zip').addEventListener('click', async () => {
      const statusEl = document.getElementById('backup-status-text');
      statusEl.textContent = '⏳ Compression de vos données en cours...';
      try {
        const res = await API.call('export_backup_zip');
        if (res && res.success) {
          statusEl.textContent = `✅ Sauvegarde réussie (${res.size_mb} Mo) : ${res.path}`;
          App.showToast('Sauvegarde complète exportée !');
        } else if (res && !res.cancelled) {
          statusEl.textContent = `❌ Erreur : ${res.error}`;
        } else {
          statusEl.textContent = '';
        }
      } catch (e) {
        statusEl.textContent = `❌ Erreur : ${e}`;
      }
    });

    // Import ZIP
    document.getElementById('btn-import-zip').addEventListener('click', async () => {
      const statusEl = document.getElementById('backup-status-text');
      if (confirm("⚠️ Cette opération REMPLACERA vos données actuelles par celles du fichier ZIP.\n\nContinuer ?")) {
        statusEl.textContent = '⏳ Restauration en cours...';
        try {
          const res = await API.call('import_backup_zip');
          if (res && res.success) {
            statusEl.textContent = '✅ Données restaurées avec succès !';
            App.showToast('Restauration terminée !');
          } else if (res && !res.cancelled) {
            statusEl.textContent = `❌ Erreur : ${res.error}`;
          }
        } catch (e) {
          statusEl.textContent = `❌ Erreur : ${e}`;
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

    document.getElementById('cfg-diff-pct').checked = c.show_diff_percentage !== false;
    document.getElementById('cfg-diff-highlight').checked = c.show_diff_highlights !== false;
    if (document.getElementById('cfg-show-chap-dividers')) {
      document.getElementById('cfg-show-chap-dividers').checked = c.show_chapter_dividers !== false;
    }
    if (document.getElementById('cfg-full-width')) {
      document.getElementById('cfg-full-width').checked = c.full_width_reading === true;
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
    document.getElementById('cfg-include-notes-ai').checked = c.include_notes_in_ai !== false;

    if (typeof NotesView !== 'undefined') {
      NotesView.updateAiToggleVisibility();
      NotesView.renderList();
    }
    if (typeof DrawerNotes !== 'undefined' && DrawerNotes.renderList) {
      DrawerNotes.renderList();
    }

    if (c.chat_model) document.getElementById('cfg-chat-model').value = c.chat_model;
    if (c.synthesis_model && document.getElementById('cfg-synthesis-model')) {
      document.getElementById('cfg-synthesis-model').value = c.synthesis_model;
    }
    if (c.synthesis_max_verses && document.getElementById('cfg-synthesis-max-verses')) {
      document.getElementById('cfg-synthesis-max-verses').value = c.synthesis_max_verses;
    }
    if (document.getElementById('cfg-synthesis-reranking')) {
      document.getElementById('cfg-synthesis-reranking').checked = c.synthesis_enable_reranking !== false;
    }
    if (c.synthesis_curation_model && document.getElementById('cfg-synthesis-curation-model')) {
      document.getElementById('cfg-synthesis-curation-model').value = c.synthesis_curation_model;
    }

    if (c.translation_model && document.getElementById('cfg-translation-model')) {
      document.getElementById('cfg-translation-model').value = c.translation_model;
    }
    if (document.getElementById('cfg-synthesis-system-prompt')) {
      document.getElementById('cfg-synthesis-system-prompt').value = c.synthesis_system_prompt || '';
    }
    if (document.getElementById('cfg-translation-system-prompt')) {
      document.getElementById('cfg-translation-system-prompt').value = c.translation_system_prompt || '';
    }

    if (c.gemini_api_key) document.getElementById('cfg-gemini-key').value = c.gemini_api_key;
    if (c.mistral_api_key) document.getElementById('cfg-mistral-key').value = c.mistral_api_key;
    if (c.infomaniak_token) document.getElementById('cfg-infomaniak-token').value = c.infomaniak_token;
    if (c.infomaniak_product_id) document.getElementById('cfg-infomaniak-pid').value = c.infomaniak_product_id;
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
            this.moveDict(idx, dir);
          });
        });

        item.querySelector('input[type="checkbox"]').addEventListener('change', (e) => {
          d.enabled = e.target.checked;
          API.call('save_dictionaries', this.dictionaries);
        });

        listEl.appendChild(item);
      });
    } catch (e) {
      console.error(e);
    }
  },

  moveDict(idx, direction) {
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
    newCfg.theme = document.getElementById('cfg-theme').value;
    newCfg.theme_palette = document.getElementById('cfg-theme-palette')?.value || 'dark-slate';
    newCfg.reading_bg = document.getElementById('cfg-reading-bg')?.value || 'auto';
    newCfg.font_family = document.getElementById('cfg-font-family').value;
    newCfg.font_size = parseInt(document.getElementById('cfg-font-size').value);
    newCfg.line_spacing = parseInt(document.getElementById('cfg-line-spacing').value);

    newCfg.show_diff_percentage = document.getElementById('cfg-diff-pct').checked;
    newCfg.show_diff_highlights = document.getElementById('cfg-diff-highlight').checked;
    if (document.getElementById('cfg-show-chap-dividers')) {
      newCfg.show_chapter_dividers = document.getElementById('cfg-show-chap-dividers').checked;
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
    newCfg.include_notes_in_ai = document.getElementById('cfg-include-notes-ai').checked;

    newCfg.chat_model = document.getElementById('cfg-chat-model').value;
    if (document.getElementById('cfg-synthesis-model')) {
      newCfg.synthesis_model = document.getElementById('cfg-synthesis-model').value;
    }
    if (document.getElementById('cfg-synthesis-max-verses')) {
      newCfg.synthesis_max_verses = parseInt(document.getElementById('cfg-synthesis-max-verses').value) || 5;
    }
    if (document.getElementById('cfg-synthesis-reranking')) {
      newCfg.synthesis_enable_reranking = document.getElementById('cfg-synthesis-reranking').checked;
    }
    if (document.getElementById('cfg-translation-model')) {
      newCfg.translation_model = document.getElementById('cfg-translation-model').value;
    }
    if (document.getElementById('cfg-synthesis-system-prompt')) {
      newCfg.synthesis_system_prompt = document.getElementById('cfg-synthesis-system-prompt').value;
    }
    if (document.getElementById('cfg-translation-system-prompt')) {
      newCfg.translation_system_prompt = document.getElementById('cfg-translation-system-prompt').value;
    }

    newCfg.gemini_api_key = document.getElementById('cfg-gemini-key').value.trim();
    newCfg.mistral_api_key = document.getElementById('cfg-mistral-key').value.trim();
    newCfg.infomaniak_token = document.getElementById('cfg-infomaniak-token').value.trim();
    newCfg.infomaniak_product_id = document.getElementById('cfg-infomaniak-pid').value.trim();

    try {
      await API.call('save_settings', newCfg);
      this.config = newCfg;
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
  }
};
