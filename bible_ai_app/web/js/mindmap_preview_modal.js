/**
 * MindMapPreviewModal - Contrôleur de la fenêtre modale intermédiaire de prévisualisation Mind Map.
 * Permet de visualiser la carte mentale générée par l'IA en mode lecture seule (avec zoom, pan,
 * infobulles de versets et notes) avant de l'enregistrer et de l'éditer dans ses notes.
 */

const MindMapPreviewModal = {
  currentNoteData: null,
  rawAnswer: '',
  passageRef: '',
  userQuestion: '',
  sourceBtn: null,
  isExpanded: false,
  previousMmContainer: null,
  previousMmNote: null,

  init() {
    this.modalEl = document.getElementById('modal-mindmap-preview');
    this.cardEl = document.getElementById('mm-preview-modal-card');
    this.canvasContainer = document.getElementById('mm-preview-canvas-container');
    this.loadingOverlay = document.getElementById('mm-preview-loading-overlay');
    this.titleEl = document.getElementById('mm-preview-modal-title');
    this.refSubtitleEl = document.getElementById('mm-preview-ref-subtitle');
    this.modelPill = document.getElementById('mm-preview-meta-model');
    this.statsEl = document.getElementById('mm-preview-meta-stats');

    // Boutons de fermeture
    document.getElementById('btn-close-mm-preview-modal')?.addEventListener('click', () => this.close());
    document.getElementById('btn-mm-preview-cancel')?.addEventListener('click', () => this.close());

    // Bouton Agrandir / Réduire (Plein écran)
    document.getElementById('btn-mm-preview-toggle-expand')?.addEventListener('click', () => this.toggleExpand());

    // Bouton Régénérer
    document.getElementById('btn-mm-preview-regenerate')?.addEventListener('click', () => this.regenerate());

    // Bouton Enregistrer et Éditer dans mes Notes
    document.getElementById('btn-mm-preview-save-edit')?.addEventListener('click', () => this.saveAndEdit());

    // Fermeture avec Échap
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.modalEl && !this.modalEl.classList.contains('hidden')) {
        this.close();
      }
    });
  },

  async open(rawAnswer, passageRef = '', userQuestion = '', sourceBtn = null) {
    if (!this.modalEl) this.init();
    if (!rawAnswer || !rawAnswer.trim()) return;

    this.rawAnswer = rawAnswer.trim();
    this.passageRef = (passageRef || '').trim();
    this.userQuestion = (userQuestion || '').trim();
    this.sourceBtn = sourceBtn;

    // Réinitialiser état modal
    this.isExpanded = false;
    this.cardEl?.classList.remove('is-expanded');
    this.updateExpandIcons();

    // Titres et badges initiaux
    const displayRef = this.passageRef
      ? `Passage d'étude : ${this.passageRef}`
      : (this.userQuestion ? `Question : ${this.userQuestion}` : 'Étude biblique');

    if (this.refSubtitleEl) this.refSubtitleEl.textContent = displayRef;
    if (this.titleEl) this.titleEl.textContent = 'Génération de la Mind Map...';
    if (this.modelPill) this.modelPill.textContent = 'IA en cours...';
    if (this.statsEl) this.statsEl.textContent = '';

    // Afficher la modale et l'overlay de chargement
    this.modalEl.classList.remove('hidden');
    this.loadingOverlay?.classList.remove('hidden');

    if (sourceBtn) {
      sourceBtn.disabled = true;
      sourceBtn.classList.add('loading');
    }

    try {
      // 1. Appel au backend AI dédié
      let mindmapResult = null;
      let modelUsed = 'Gemini';

      try {
        const res = await API.call('generate_mindmap_from_text', this.rawAnswer, this.passageRef, this.userQuestion);
        if (res && res.success && res.mindmap) {
          mindmapResult = res.mindmap;
          modelUsed = res.model_used || 'IA';
        } else if (res && res.error) {
          console.warn('Erreur renvoyée par generate_mindmap_from_text:', res.error);
        }
      } catch (err) {
        console.warn('Échec appel IA generate_mindmap_from_text, activation repli algorithmique:', err);
      }

      // 2. Repli déterministe NLP si l'IA n'est pas disponible ou a échoué
      if (!mindmapResult) {
        mindmapResult = this.generateFallbackMindmap(this.rawAnswer, this.passageRef, this.userQuestion);
        modelUsed = 'Algorithme Local (Buzan)';
      }

      // 3. Préparer les données de note conformes
      this.currentNoteData = {
        title: mindmapResult.title || 'MIND MAP SYNTHÈSE',
        reference: this.passageRef || '',
        tags: Array.isArray(mindmapResult.tags) ? mindmapResult.tags.join(', ') : (mindmapResult.tags || 'mindmap, étude-ia'),
        type: 'mindmap',
        icon: mindmapResult.root_icon || 'brain',
        palette: mindmapResult.palette || 'nature',
        include_in_ai: true,
        content: mindmapResult.markdown || mindmapResult.content || ''
      };

      // 4. Mettre à jour l'en-tête et les compteurs
      if (this.titleEl) this.titleEl.textContent = this.currentNoteData.title;
      if (this.modelPill) this.modelPill.textContent = modelUsed;

      const branchCount = (this.currentNoteData.content.match(/^-\s+[^\n]+/gm) || []).length;
      const subBranchCount = (this.currentNoteData.content.match(/^\s+-\s+[^\n]+/gm) || []).length;
      if (this.statsEl) {
        this.statsEl.textContent = `• ${branchCount} branches majeures (BOIs) • ${subBranchCount} sous-branches`;
      }

      // 5. Masquer le chargement
      this.loadingOverlay?.classList.add('hidden');

      // 6. Reparenter le conteneur Mind Map réel dans la modale en lecture seule
      const noteMmContainer = document.getElementById('note-mindmap-container');
      if (noteMmContainer) {
        if (!document.getElementById('note-mindmap-placeholder') && noteMmContainer.parentNode) {
          const placeholder = document.createElement('div');
          placeholder.id = 'note-mindmap-placeholder';
          placeholder.style.display = 'none';
          noteMmContainer.parentNode.insertBefore(placeholder, noteMmContainer);
        }
        this.canvasContainer.appendChild(noteMmContainer);
        noteMmContainer.classList.remove('hidden');
        noteMmContainer.classList.add('is-preview-mode');
      }

      if (typeof MindMapView !== 'undefined') {
        MindMapView.isReadOnly = true;
        if (!MindMapView.svg || !noteMmContainer.querySelector('.mindmap-svg-canvas')) {
          MindMapView.init(noteMmContainer);
        } else {
          MindMapView.container = noteMmContainer;
          MindMapView.svg = noteMmContainer.querySelector('.mindmap-svg-canvas') || document.getElementById('mindmap-svg');
          MindMapView.viewportG = noteMmContainer.querySelector('#mindmap-viewport') || MindMapView.svg?.querySelector('g');
        }
        MindMapView.render(this.currentNoteData);

        if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
          window.requestAnimationFrame(() => MindMapView.fitView());
        }
        setTimeout(() => MindMapView.fitView(), 80);
        setTimeout(() => MindMapView.fitView(), 220);
      }

    } catch (e) {
      console.error('Erreur ouverture prévisualisation mind map:', e);
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast(`Erreur : ${e?.message || e}`);
      }
      this.close();
    } finally {
      if (sourceBtn) {
        sourceBtn.disabled = false;
        sourceBtn.classList.remove('loading');
      }
    }
  },

  toggleExpand() {
    this.isExpanded = !this.isExpanded;
    this.cardEl?.classList.toggle('is-expanded', this.isExpanded);
    this.updateExpandIcons();

    setTimeout(() => {
      if (typeof MindMapView !== 'undefined') {
        MindMapView.fitView();
      }
    }, 220);
  },

  updateExpandIcons() {
    const btn = document.getElementById('btn-mm-preview-toggle-expand');
    if (!btn) return;
    const maxIcon = btn.querySelector('.icon-maximize');
    const minIcon = btn.querySelector('.icon-minimize');
    if (this.isExpanded) {
      maxIcon?.classList.add('hidden');
      minIcon?.classList.remove('hidden');
      btn.title = 'Réduire la fenêtre';
    } else {
      maxIcon?.classList.remove('hidden');
      minIcon?.classList.add('hidden');
      btn.title = 'Agrandir en plein écran';
    }
  },

  async regenerate() {
    if (!this.rawAnswer) return;

    this.loadingOverlay?.classList.remove('hidden');
    if (this.titleEl) this.titleEl.textContent = 'Régénération par l\'IA...';

    const regenBtn = document.getElementById('btn-mm-preview-regenerate');
    if (regenBtn) regenBtn.disabled = true;

    try {
      let mindmapResult = null;
      let modelUsed = 'Gemini';

      try {
        const res = await API.call('generate_mindmap_from_text', this.rawAnswer, this.passageRef, this.userQuestion);
        if (res && res.success && res.mindmap) {
          mindmapResult = res.mindmap;
          modelUsed = res.model_used || 'IA';
        }
      } catch (err) {
        console.warn('Erreur régénération IA:', err);
      }

      if (!mindmapResult) {
        mindmapResult = this.generateFallbackMindmap(this.rawAnswer, this.passageRef, this.userQuestion);
        modelUsed = 'Algorithme Local (Buzan)';
      }

      this.currentNoteData = {
        title: mindmapResult.title || 'MIND MAP SYNTHÈSE',
        reference: this.passageRef || '',
        tags: Array.isArray(mindmapResult.tags) ? mindmapResult.tags.join(', ') : (mindmapResult.tags || 'mindmap, étude-ia'),
        type: 'mindmap',
        icon: mindmapResult.root_icon || 'brain',
        palette: mindmapResult.palette || 'nature',
        include_in_ai: true,
        content: mindmapResult.markdown || mindmapResult.content || ''
      };

      if (this.titleEl) this.titleEl.textContent = this.currentNoteData.title;
      if (this.modelPill) this.modelPill.textContent = modelUsed;

      const branchCount = (this.currentNoteData.content.match(/^-\s+[^\n]+/gm) || []).length;
      const subBranchCount = (this.currentNoteData.content.match(/^\s+-\s+[^\n]+/gm) || []).length;
      if (this.statsEl) {
        this.statsEl.textContent = `• ${branchCount} branches majeures (BOIs) • ${subBranchCount} sous-branches`;
      }

      this.loadingOverlay?.classList.add('hidden');

      if (typeof MindMapView !== 'undefined') {
        MindMapView.isReadOnly = true;
        MindMapView.render(this.currentNoteData);
        if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
          window.requestAnimationFrame(() => MindMapView.fitView());
        }
        setTimeout(() => MindMapView.fitView(), 80);
      }

      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast('Nouvelle synthèse Mind Map générée !');
      }
    } catch (e) {
      console.error('Erreur régénération:', e);
      this.loadingOverlay?.classList.add('hidden');
    } finally {
      if (regenBtn) regenBtn.disabled = false;
    }
  },

  async saveAndEdit() {
    if (!this.currentNoteData) return;

    const saveBtn = document.getElementById('btn-mm-preview-save-edit');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.classList.add('loading');
    }

    try {
      const saved = await API.call('save_note', this.currentNoteData);
      if (saved && saved.success) {
        const savedId = saved.id;
        const savedTitle = this.currentNoteData.title;

        // Fermer la modale (ce qui replace proprement note-mindmap-container dans NotesView)
        this.close();

        // Basculer vers la vue Notes
        if (typeof App !== 'undefined') {
          if (App.switchView) {
            App.switchView('notes');
          }
          if (App.showToast) {
            App.showToast(`Mind Map créée : « ${savedTitle} »`);
          }
        }

        // Sélectionner et charger la note dans NotesView
        if (typeof NotesView !== 'undefined' && NotesView.loadNotes) {
          await NotesView.loadNotes(savedId);
        }
      } else {
        alert(`Erreur enregistrement note : ${saved?.error || 'Échec'}`);
      }
    } catch (e) {
      console.error('Erreur saveAndEdit:', e);
      alert(`Erreur enregistrement note : ${e?.message || e}`);
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.classList.remove('loading');
      }
    }
  },

  close() {
    if (this.modalEl) {
      this.modalEl.classList.add('hidden');
    }

    // Restaurer le conteneur principal dans NotesView
    const placeholder = document.getElementById('note-mindmap-placeholder');
    const noteMmContainer = document.getElementById('note-mindmap-container');
    if (placeholder && noteMmContainer) {
      placeholder.parentNode.insertBefore(noteMmContainer, placeholder);
      placeholder.remove();
      noteMmContainer.classList.remove('is-preview-mode');

      const isNotesMindmapActive = typeof NotesView !== 'undefined' &&
                                   NotesView.currentNote &&
                                   NotesView.currentNote.type === 'mindmap' &&
                                   typeof App !== 'undefined' &&
                                   App.currentView === 'notes';
      if (!isNotesMindmapActive) {
        noteMmContainer.classList.add('hidden');
      }
    }

    // Réinitialiser le mode lecture seule
    if (typeof MindMapView !== 'undefined') {
      MindMapView.isReadOnly = false;
      if (noteMmContainer) {
        MindMapView.container = noteMmContainer;
        MindMapView.svg = noteMmContainer.querySelector('.mindmap-svg-canvas') || document.getElementById('mindmap-svg');
        MindMapView.viewportG = noteMmContainer.querySelector('#mindmap-viewport') || MindMapView.svg?.querySelector('g');
      }

      // Si l'utilisateur retourne sur l'onglet Notes avec une note mindmap ouverte, restaurer la vue
      if (typeof NotesView !== 'undefined' && NotesView.currentNote && NotesView.currentNote.type === 'mindmap') {
        MindMapView.render(NotesView.currentNote);
      }
    }
  },

  /**
   * Algorithme déterministe NLP de repli :
   * Extrait intelligemment les concepts réels, nettoie les mots vides,
   * suggère des icônes vectorielles et formate une carte radiante de Buzan.
   */
  generateFallbackMindmap(rawAnswer, passageRef, userQuestion) {
    // 1. Concept central
    let centralTitle = (passageRef || '').trim();
    if (!centralTitle && userQuestion) {
      let qClean = userQuestion
        .replace(/^(peux-tu|pourrais-tu|explique|analyse|synthétise|quel|quelle|quels|quelles|comment|pourquoi)\s+/i, '')
        .replace(/[?!.:]+$/, '')
        .trim();
      centralTitle = qClean;
    }
    if (!centralTitle) centralTitle = 'SYNTHÈSE BIBLIQUE';

    const centralWords = centralTitle.split(/\s+/).filter(w => w.length > 1);
    if (centralWords.length > 4) {
      centralTitle = centralWords.slice(0, 4).join(' ');
    }
    centralTitle = centralTitle.toUpperCase();

    // Suggérer l'icône racine
    let rootIcon = 'brain';
    if (typeof SvgIconsRegistry !== 'undefined') {
      const sug = SvgIconsRegistry.suggestIconsForText(centralTitle, 1);
      if (sug && sug.length > 0) rootIcon = sug[0].id;
    }

    // Mots vides français à éliminer pour les mots-clés
    const stopWords = new Set([
      'dans', 'avec', 'pour', 'sans', 'sous', 'vers', 'chez', 'cette', 'celui', 'celle',
      'ceux', 'celles', 'nous', 'vous', 'leur', 'leurs', 'notre', 'votre', 'comme', 'plus',
      'moins', 'très', 'bien', 'aussi', 'ainsi', 'alors', 'apres', 'avant', 'selon',
      'faire', 'avoir', 'etre', 'sont', 'peut', 'tous', 'tout', 'toute', 'toutes'
    ]);

    const cleanKeywords = (str, maxWords = 3) => {
      let c = str.replace(/[*_#`]/g, '').trim();
      c = c.replace(/^([0-9IVXLCDM]+|[A-Z])[\.\)]\s*/, '');
      c = c.replace(/^(consensus|analyse|contexte|structure|point|notion)\s*:\s*/i, '');
      const rawWords = c.split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w.toLowerCase()));
      const selected = (rawWords.length > 0 ? rawWords : c.split(/\s+/)).slice(0, maxWords);
      return selected.join(' ').toUpperCase();
    };

    const extractScriptureRef = (str) => {
      const m = str.match(/\[([A-Za-z0-9À-ÿ\s:.,\-–—]+)\]/) || str.match(/\(([1-4]?\s*[A-Za-zÀ-ÿ]+\s*\d+(?::\d+(?:-\d+)?)?)\)/);
      return m ? m[1].trim() : '';
    };

    const lines = rawAnswer.split(/\r?\n/);
    const treeBois = [];
    let currentBoi = null;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      // Détection d'un titre de section majeur (BOI)
      if (line.startsWith('#') || line.match(/^\*\*[0-9IVXLCDM]+\./) || line.match(/^[0-9]+\.\s+\*\*/)) {
        const titleText = cleanKeywords(line, 3);
        const ref = extractScriptureRef(line);
        if (titleText && titleText.length > 1) {
          let icon = null;
          if (typeof SvgIconsRegistry !== 'undefined') {
            const sug = SvgIconsRegistry.suggestIconsForText(titleText, 1);
            if (sug && sug.length > 0) icon = sug[0].id;
          }
          currentBoi = {
            title: titleText,
            ref: ref,
            icon: icon,
            children: []
          };
          treeBois.push(currentBoi);
        }
        continue;
      }

      // Détection d'une sous-branche (puce ou numéro)
      if (line.match(/^[-*+]\s+/) || line.match(/^[0-9]+\.\s+/)) {
        const ref = extractScriptureRef(line);
        let cleanedContent = line.replace(/^[-*+]\s+/, '').replace(/^[0-9]+\.\s+/, '').replace(/[*_`]/g, '').trim();
        if (ref) {
          cleanedContent = cleanedContent.replace(`[${ref}]`, '').replace(`(${ref})`, '').trim();
        }

        // Extraire un mot-clé de 2-4 mots pour le nœud
        const conceptTitle = cleanKeywords(cleanedContent, 3);
        // Conserver le reste du texte en note explicative
        const noteText = cleanedContent.length > 25 ? cleanedContent : '';

        if (conceptTitle && conceptTitle.length > 1) {
          if (!currentBoi) {
            currentBoi = { title: 'FONDEMENTS', ref: '', icon: 'bible', children: [] };
            treeBois.push(currentBoi);
          }
          currentBoi.children.push({
            text: conceptTitle,
            ref: ref,
            note: noteText
          });
        }
      }
    }

    // Fallback par paragraphes si aucun titre explicite
    if (treeBois.length === 0) {
      const paragraphs = rawAnswer.split(/\n\s*\n/).filter(p => p.trim().length > 15);
      paragraphs.slice(0, 5).forEach((p, idx) => {
        const boiTitle = cleanKeywords(p, 3) || `AXE PRINCIPAL ${idx + 1}`;
        const ref = extractScriptureRef(p);
        const childWords = p.replace(/[*_#`]/g, '').split(/\s+/).filter(w => w.length > 2);
        const childTitle = childWords.slice(3, 7).join(' ').toUpperCase() || 'DÉVELOPPEMENT';
        treeBois.push({
          title: boiTitle,
          ref: ref,
          icon: 'cle',
          children: [{ text: childTitle, ref: '', note: p.slice(0, 200).trim() }]
        });
      });
    }

    // Construction du Markdown enrichi
    let md = `<!-- mindmap-layout: radiant -->\n<!-- mindmap-connector: curve -->\n<!-- mindmap-node-shape: underline -->\n\n`;

    const boiSlice = treeBois.slice(0, 6);
    boiSlice.forEach((boi, bIdx) => {
      const refPart = boi.ref ? ` [${boi.ref}]` : '';
      const markerPart = ` <!-- marker: ${bIdx + 1} -->`;
      const iconPart = boi.icon ? ` <!-- icon: ${boi.icon} -->` : '';
      md += `- ${boi.title}${refPart}${markerPart}${iconPart}\n`;

      const childrenSlice = (boi.children || []).slice(0, 5);
      childrenSlice.forEach(child => {
        const cRef = child.ref ? ` [${child.ref}]` : '';
        const cNote = child.note ? ` <!-- note: ${child.note.replace(/\n+/g, ' ')} -->` : '';
        md += `  - ${child.text}${cRef}${cNote}\n`;
      });
    });

    // Ajouter une frontière sur le premier BOI
    if (boiSlice.length > 0) {
      md += `\n<!-- mindmap-boundary: ${boiSlice[0].title} | label: POINT CENTRAL | color: #0284c7 -->\n`;
    }

    // Ajouter une liaison entre la 1ère et la dernière BOI si au moins 2 branches
    if (boiSlice.length >= 2) {
      const lastBoi = boiSlice[boiSlice.length - 1];
      md += `<!-- mindmap-rel: ${boiSlice[0].title} -> ${lastBoi.title} | label: ABOUTISSEMENT | color: #059669 | cx: 120 | cy: -40 -->\n`;
    }

    return {
      title: centralTitle,
      root_icon: rootIcon,
      palette: 'nature',
      tags: ['mindmap', 'étude-ia'],
      markdown: md
    };
  }
};

if (typeof window !== 'undefined') {
  window.MindMapPreviewModal = MindMapPreviewModal;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MindMapPreviewModal;
}
