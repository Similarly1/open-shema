/**
 * Mind Map View Controller — Open Shema
 * Moteur autonome de Mind Mapping organique SVG basé sur les 10 lois de Tony Buzan :
 * - Pensée radiante bilatérale (noyau central, BOIs colorées, sous-branches effilées)
 * - Branches curvilignes en courbes de Bézier cubiques dégressives
 * - Un mot-clé par branche en lettres capitales (Lois 4 & 5)
 * - Code couleur systématique par BOI (Loi 8)
 * - Zéro émoji : icônes vectorielles SVG nobles pour le centre et les badges
 * - Ergonomie 100% souris (actions contextuelles au survol) & 100% clavier avec aide intégrée
 * - Source de vérité en Markdown standard (.md) avec auto-sauvegarde transparente
 */

const MindMapView = {
  container: null,
  svg: null,
  viewportG: null,
  currentNote: null,
  tree: null,
  selectedNodeId: null,
  editingNodeId: null,
  clipboardNode: null,
  viewMode: 'map', // 'map' (Mind Map SVG) ou 'outline' (Plan outliner)
  collapsedNodes: new Set(),

  // Vue Pan & Zoom
  viewBox: { x: 0, y: 0, scale: 1 },
  isPanning: false,
  panStart: { x: 0, y: 0 },

  // Palettes chromatiques harmonieuses (Loi 8 de Buzan)
  PALETTES: {
    nature: ['#059669', '#0284c7', '#d97706', '#7c3aed', '#e11d48', '#0d9488', '#ea580c'],
    ocean: ['#0284c7', '#06b6d4', '#2563eb', '#0d9488', '#4f46e5', '#38bdf8', '#0891b2'],
    automne: ['#d97706', '#ea580c', '#b45309', '#059669', '#c2410c', '#854d0e', '#e11d48'],
    royal: ['#7c3aed', '#4f46e5', '#2563eb', '#9333ea', '#6366f1', '#c026d3', '#0284c7']
  },

  // Icônes SVG vectorielles nobles (sans émojis)
  ICONS: {
    brain: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a4 4 0 0 0-4 4v1a4 4 0 0 0-2 7.5A4 4 0 0 0 8 22h8a4 4 0 0 0 2-7.5A4 4 0 0 0 16 7V6a4 4 0 0 0-4-4Z"/><path d="M12 2v20"/><path d="M8 8h8"/><path d="M7 14h10"/></svg>',
    bible: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
    cross: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="22"/><line x1="5" y1="8" x2="19" y2="8"/></svg>',
    anchor: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="3"/><line x1="12" y1="22" x2="12" y2="8"/><path d="M5 12H2a10 10 0 0 0 20 0h-3"/></svg>',
    scroll: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1 .4-1 1v7c0 .6.4 1 1 1h14Z"/><path d="M16 17v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/></svg>',
    lamp: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2h6"/><path d="M12 2v4"/><path d="M5 9a7 7 0 0 0 14 0H5Z"/><path d="M10 22h4"/><path d="M12 18v4"/><path d="M8 14l-2 4h12l-2-4"/></svg>'
  },

  init(containerEl) {
    this.container = containerEl || document.getElementById('note-mindmap-container');
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="mindmap-wrapper">
        <svg id="mindmap-svg" class="mindmap-svg-canvas" width="100%" height="100%">
          <defs>
            <filter id="mm-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#000000" flood-opacity="0.15"/>
            </filter>
            <filter id="mm-select-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="0" stdDeviation="5" flood-color="#3b82f6" flood-opacity="0.5"/>
            </filter>
          </defs>
          <g id="mindmap-viewport"></g>
        </svg>

        <!-- Vue Plan (Outliner hiérarchique interactif) -->
        <div id="mindmap-outline-view" class="mindmap-outline-container hidden"></div>

        <!-- Dock d'outils flottant minimaliste -->
        <div class="mindmap-dock">
          <button type="button" class="mm-dock-btn" id="mm-btn-toggle-outline" title="Basculer entre Vue Carte et Vue Plan (Alt+P)">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
          </button>
          <button type="button" class="mm-dock-btn" id="mm-btn-zoom-in" title="Zoom avant (Ctrl + Molette)">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
          <button type="button" class="mm-dock-btn" id="mm-btn-zoom-out" title="Zoom arrière">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
          <button type="button" class="mm-dock-btn" id="mm-btn-fit" title="Recentrer et ajuster la carte (R ou Espace)">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/></svg>
          </button>
          <button type="button" class="mm-dock-btn" id="mm-btn-theme" title="Basculer Fond Thème / Feuille Blanche">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 0 20z" fill="currentColor"/></svg>
          </button>
          <button type="button" class="mm-dock-btn" id="mm-btn-palette" title="Changer la palette de couleurs">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>
          </button>
          <button type="button" class="mm-dock-btn" id="mm-btn-export-text" title="Exporter en plan de note rédigé">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          </button>
          <button type="button" class="mm-dock-btn" id="mm-btn-help" title="Aide raccourcis clavier (?)">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </button>
        </div>

        <!-- Tiroir d'aide aux raccourcis clavier -->
        <div class="mindmap-help-drawer hidden" id="mindmap-help-drawer">
          <div class="mm-help-header">
            <div class="mm-help-title">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
              <span>Guide Raccourcis — Mind Map Buzan</span>
            </div>
            <button type="button" class="btn-icon-subtle" id="mm-btn-close-help">×</button>
          </div>
          <div class="mm-help-content">
            <table class="mm-help-table">
              <tr><td><kbd>Alt+P</kbd></td><td><strong>Basculer entre Vue Carte et Vue Plan</strong></td></tr>
              <tr><td><kbd>Tab</kbd></td><td>Ajouter une sous-branche (Enfant)</td></tr>
              <tr><td><kbd>Entrée</kbd></td><td>Ajouter une branche voisine (Sœur)</td></tr>
              <tr><td><kbd>Espace</kbd> ou <em>Double-clic</em></td><td>Modifier le mot-clé</td></tr>
              <tr><td><kbd>F4</kbd></td><td>Ajouter / Modifier la note de branche</td></tr>
              <tr><td><kbd>Suppr</kbd> / <kbd>Retour</kbd></td><td>Supprimer la branche sélectionnée</td></tr>
              <tr><td><kbd>Ctrl+C</kbd> / <kbd>Ctrl+V</kbd></td><td>Copier / Coller une branche</td></tr>
              <tr><td><em>Clic Droit</em></td><td>Menu contextuel complet (branche ou fond)</td></tr>
              <tr><td><kbd>←</kbd> <kbd>→</kbd> <kbd>↑</kbd> <kbd>↓</kbd></td><td>Naviguer d'une branche à l'autre</td></tr>
              <tr><td><kbd>Ctrl + Molette</kbd></td><td>Zoomer / Dézoomer</td></tr>
              <tr><td><em>Clic-glissé fond</em></td><td>Déplacer la feuille (Panoramique)</td></tr>
              <tr><td><kbd>R</kbd> ou <em>Double-clic</em></td><td>Recentrer la vue</td></tr>
              <tr><td><kbd>?</kbd></td><td>Afficher / Masquer cette aide</td></tr>
            </table>
            <div class="mm-help-tip">
              <strong>Astuce 100% Souris :</strong> Clic droit sur n'importe quel élément pour afficher toutes les options contextuelles, ou survolez une branche pour faire apparaître <span class="badge-mini">+</span> et <span class="badge-mini">×</span>.
            </div>
          </div>
        </div>
      </div>
    `;

    this.svg = document.getElementById('mindmap-svg');
    this.viewportG = document.getElementById('mindmap-viewport');

    this.bindEvents();
  },

  bindEvents() {
    // 1. Panoramique à la souris (Drag)
    this.svg?.addEventListener('mousedown', (e) => {
      this.hideTooltip();
      if (e.target === this.svg || e.target.id === 'mindmap-svg' || e.target === this.viewportG) {
        this.isPanning = true;
        this.panStart = { x: e.clientX - this.viewBox.x, y: e.clientY - this.viewBox.y };
        this.selectedNodeId = null;
        this.updateSelectionState();
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isPanning) return;
      this.hideTooltip();
      this.viewBox.x = e.clientX - this.panStart.x;
      this.viewBox.y = e.clientY - this.panStart.y;
      this.applyTransform();
    });

    window.addEventListener('mouseup', () => {
      this.isPanning = false;
    });

    // 2. Zoom à la molette
    this.svg?.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.hideTooltip();
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      const rect = this.svg.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const newScale = Math.min(Math.max(0.3, this.viewBox.scale * zoomFactor), 3.0);

      // Zoom centré sur la souris
      this.viewBox.x = mouseX - (mouseX - this.viewBox.x) * (newScale / this.viewBox.scale);
      this.viewBox.y = mouseY - (mouseY - this.viewBox.y) * (newScale / this.viewBox.scale);
      this.viewBox.scale = newScale;

      this.applyTransform();
    }, { passive: false });

    // 3. Boutons Dock
    document.getElementById('mm-btn-toggle-outline')?.addEventListener('click', () => this.toggleViewMode());
    document.getElementById('mm-btn-zoom-in')?.addEventListener('click', () => this.zoom(1.2));
    document.getElementById('mm-btn-zoom-out')?.addEventListener('click', () => this.zoom(0.8));
    document.getElementById('mm-btn-fit')?.addEventListener('click', () => this.fitView());
    document.getElementById('mm-btn-theme')?.addEventListener('click', () => this.togglePaperMode());
    document.getElementById('mm-btn-palette')?.addEventListener('click', () => this.cyclePalette());
    document.getElementById('mm-btn-export-text')?.addEventListener('click', () => this.exportToTextNote());
    document.getElementById('mm-btn-help')?.addEventListener('click', () => this.toggleHelpDrawer());
    document.getElementById('mm-btn-close-help')?.addEventListener('click', () => this.toggleHelpDrawer(false));

    // 4. Raccourcis Clavier
    window.addEventListener('keydown', (e) => {
      // Ignorer si on n'est pas dans la vue Mind Map active
      const mmContainer = this.container || document.getElementById('note-mindmap-container');
      if (!mmContainer || mmContainer.classList.contains('hidden')) return;

      // Bascule universelle Carte ↔ Plan (Alt+P)
      if (e.altKey && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        this.toggleViewMode();
        return;
      }

      // Si l'utilisateur est en train de taper dans un champ de saisie HTML
      const activeTag = document.activeElement?.tagName;
      if (['INPUT', 'TEXTAREA'].includes(activeTag)) return;

      if (e.key === 'Tab') {
        e.preventDefault();
        e.stopPropagation();
        this.addChildToSelected();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        this.addSiblingToSelected();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        this.deleteSelected();
      } else if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        if (this.selectedNodeId) this.startInlineEdit(this.selectedNodeId);
      } else if (e.key === 'r' || e.key === 'R') {
        this.fitView();
      } else if (e.key === 'F4' || (e.altKey && (e.key === 'n' || e.key === 'N'))) {
        if (this.selectedNodeId && this.selectedNodeId !== 'root') {
          e.preventDefault();
          this.promptTopicNote(this.selectedNodeId);
        }
      } else if (e.key === '?') {
        e.preventDefault();
        this.toggleHelpDrawer();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
        if (this.selectedNodeId && this.selectedNodeId !== 'root') {
          e.preventDefault();
          this.copyNode(this.selectedNodeId);
        }
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V')) {
        if (this.clipboardNode) {
          e.preventDefault();
          this.pasteNode(this.selectedNodeId || 'root');
        }
      } else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        this.navigateWithArrows(e.key);
      }
    });

    // Clic droit sur le fond = Menu contextuel du canevas
    this.svg?.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.showContextMenu(e.clientX, e.clientY, null);
    });

    // Double-clic sur le fond = recentrer
    this.svg?.addEventListener('dblclick', (e) => {
      if (e.target === this.svg || e.target === this.viewportG) {
        this.fitView();
      }
    });
  },

  // =========================================================================
  // PARSING & SÉRIALISATION MARKDOWN ↔ TREE
  // =========================================================================

  parseMarkdownToTree(title, markdownContent) {
    const root = {
      id: 'root',
      text: (title || 'CONCEPT CENTRAL').toUpperCase(),
      ref: '',
      children: [],
      side: 'center',
      level: 0
    };

    if (!markdownContent || !markdownContent.trim()) {
      // Squelette par défaut si vide (Loi des BOIs)
      root.children = [
        { id: 'node_1', text: 'IDÉE 1', ref: '', children: [], level: 1 },
        { id: 'node_2', text: 'IDÉE 2', ref: '', children: [], level: 1 },
        { id: 'node_3', text: 'IDÉE 3', ref: '', children: [], level: 1 }
      ];
      return root;
    }

    const lines = markdownContent.split(/\r?\n/);
    const stack = [{ node: root, indent: -1 }];
    let idCounter = 1;

    for (const rawLine of lines) {
      const line = rawLine.trimEnd();
      if (!line.trim() || line.trim().startsWith('#')) continue;

      // Détection de l'indentation
      const match = line.match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/);
      if (match) {
        const indent = match[1].length;
        let text = match[3].trim();
        let ref = '';

        // Extraction d'une note / commentaire rattaché <!-- note: ... -->
        let noteText = '';
        const noteMatch = text.match(/<!--\s*note:\s*([\s\S]*?)\s*-->/);
        if (noteMatch) {
          noteText = noteMatch[1].trim();
          text = text.replace(noteMatch[0], '').trim();
        }

        // Extraction d'une référence biblique entre crochets ou parenthèses [Jean 3:16]
        const refMatch = text.match(/\[([A-Za-z0-9À-ÿ\s:]+)\]$/);
        if (refMatch) {
          ref = refMatch[1].trim();
          text = text.replace(refMatch[0], '').trim();
        }

        const newNode = {
          id: `node_${idCounter++}`,
          text: text.toUpperCase(), // Loi 4 de Buzan : MAJUSCULES
          ref: ref,
          note: noteText,
          children: [],
          level: 1
        };

        // Trouver le parent selon l'indentation
        while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
          stack.pop();
        }

        const parent = stack[stack.length - 1].node;
        newNode.level = parent.level + 1;
        parent.children.push(newNode);
        stack.push({ node: newNode, indent });
      }
    }

    if (root.children.length === 0) {
      root.children = [
        { id: 'node_1', text: 'IDÉE 1', ref: '', note: '', children: [], level: 1 },
        { id: 'node_2', text: 'IDÉE 2', ref: '', note: '', children: [], level: 1 }
      ];
    }

    return root;
  },

  treeToMarkdown(tree) {
    let md = '';
    const serializeChildren = (node, indentLevel) => {
      if (!node.children) return;
      for (const child of node.children) {
        const indent = '  '.repeat(indentLevel);
        const refPart = child.ref ? ` [${child.ref}]` : '';
        const notePart = child.note ? ` <!-- note: ${child.note.replace(/\r?\n/g, ' ')} -->` : '';
        md += `${indent}- ${child.text}${refPart}${notePart}\n`;
        serializeChildren(child, indentLevel + 1);
      }
    };

    serializeChildren(tree, 0);
    return md;
  },

  // =========================================================================
  // CALCULS GÉOMÉTRIQUES RADIANT & DISPOSITION BUZAN
  // =========================================================================

  layoutTree() {
    if (!this.tree) return;

    // Palette active
    const paletteName = this.currentNote?.palette || 'nature';
    const colors = this.PALETTES[paletteName] || this.PALETTES.nature;

    // Répartir les BOIs (Level 1) équitablement : Droite & Gauche
    const rightBOIs = [];
    const leftBOIs = [];

    this.tree.children.forEach((boi, index) => {
      boi.color = colors[index % colors.length];
      if (index % 2 === 0) {
        boi.side = 'right';
        rightBOIs.push(boi);
      } else {
        boi.side = 'left';
        leftBOIs.push(boi);
      }
      this.propagateColorAndSide(boi, boi.color, boi.side);
    });

    // Calcul récursif des dimensions
    this.measureNode(this.tree);

    // Positionner le centre
    this.tree.x = 0;
    this.tree.y = 0;

    // Disposer le côté Droit
    this.layoutSide(rightBOIs, 'right');
    // Disposer le côté Gauche
    this.layoutSide(leftBOIs, 'left');
  },

  propagateColorAndSide(node, color, side) {
    if (!node.children) return;
    node.children.forEach(child => {
      child.color = color;
      child.side = side;
      this.propagateColorAndSide(child, color, side);
    });
  },

  getTextWidth(text, fontSize = 11.5, fontWeight = '700') {
    if (!this._measureCanvas) {
      this._measureCanvas = document.createElement('canvas');
      this._measureCtx = this._measureCanvas.getContext('2d');
    }
    this._measureCtx.font = `${fontWeight} ${fontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    return Math.ceil(this._measureCtx.measureText(text || '').width);
  },

  measureNode(node) {
    if (node.level === 0) {
      const textW = this.getTextWidth(node.text, 13, '800');
      node.textWidth = textW;
      node.width = Math.max(120, textW + 48);
      node.height = 46;
    } else {
      const textW = this.getTextWidth(node.text, 11.5, '700');
      node.textWidth = textW;

      let refW = 0;
      if (node.ref) {
        const refTextW = this.getTextWidth(node.ref.length > 11 ? node.ref.slice(0, 9) + '…' : node.ref, 9, '700');
        node.refPillWidth = Math.max(38, Math.min(84, refTextW + 14));
        refW = node.refPillWidth + 8; // largeur de pastille + espacement
      } else {
        node.refPillWidth = 0;
      }

      let noteW = 0;
      if (node.note) {
        node.notePillWidth = 18;
        noteW = 18 + 8; // pastille ronde 18px + espacement
      } else {
        node.notePillWidth = 0;
      }

      // La largeur de la branche englobe le mot et ses badges avec marges aérées
      node.contentWidth = textW + refW + noteW;
      node.width = Math.max(70, node.contentWidth + 24);
      node.height = 28;
    }

    if (!node.children || node.children.length === 0) {
      node.totalHeight = node.height + 18; // Espace négatif
      return;
    }

    let sum = 0;
    node.children.forEach(child => {
      this.measureNode(child);
      sum += child.totalHeight;
    });
    node.totalHeight = Math.max(node.height + 18, sum);
  },

  layoutSide(bois, side) {
    const totalHeight = bois.reduce((acc, b) => acc + b.totalHeight, 0);
    let currentY = -totalHeight / 2;

    const dir = side === 'right' ? 1 : -1;
    const rootGap = 160; // Distance du noyau aux premiers BOIs

    bois.forEach(boi => {
      const centerY = currentY + boi.totalHeight / 2;
      boi.x = dir * rootGap;
      boi.y = centerY;

      this.layoutChildren(boi, side);
      currentY += boi.totalHeight;
    });
  },

  layoutChildren(parent, side) {
    if (!parent.children || parent.children.length === 0) return;

    const dir = side === 'right' ? 1 : -1;
    const horizGap = 110;
    let currentY = parent.y - parent.totalHeight / 2;

    parent.children.forEach(child => {
      const centerY = currentY + child.totalHeight / 2;
      child.x = parent.x + dir * (parent.width / 2 + horizGap);
      child.y = centerY;

      this.layoutChildren(child, side);
      currentY += child.totalHeight;
    });
  },

  // =========================================================================
  // RENDU SVG GRAPHIQUE PUR (Zéro Émoji, Courbes de Bézier vivantes)
  // =========================================================================

  render(note) {
    this.currentNote = note;
    if (!this.container) this.init();

    this.tree = this.parseMarkdownToTree(note.title, note.content);
    this.layoutTree();

    const svgEl = document.getElementById('mindmap-svg');
    const outlineEl = document.getElementById('mindmap-outline-view');

    if (this.viewMode === 'outline') {
      svgEl?.classList.add('hidden');
      outlineEl?.classList.remove('hidden');
      this.renderOutlineView();
    } else {
      outlineEl?.classList.add('hidden');
      svgEl?.classList.remove('hidden');
      this.draw();
      this.fitView();
    }
    this.updateViewModeUI();
  },

  refreshView() {
    this.layoutTree();
    if (this.viewMode === 'outline') {
      this.renderOutlineView();
    } else {
      this.draw();
    }
  },

  toggleViewMode(targetMode = null) {
    this.viewMode = targetMode || (this.viewMode === 'map' ? 'outline' : 'map');
    const svgEl = document.getElementById('mindmap-svg');
    const outlineEl = document.getElementById('mindmap-outline-view');

    if (this.viewMode === 'outline') {
      this.hideTooltip();
      svgEl?.classList.add('hidden');
      outlineEl?.classList.remove('hidden');
      this.renderOutlineView();
    } else {
      this.hideTooltip();
      outlineEl?.classList.add('hidden');
      svgEl?.classList.remove('hidden');
      this.layoutTree();
      this.draw();
      this.fitView();
    }

    this.updateViewModeUI();
  },

  updateViewModeUI() {
    const isOutline = this.viewMode === 'outline';

    // 1. Bouton en-tête des notes
    const headerBtn = document.getElementById('btn-toggle-mindmap-mode');
    const headerLabel = document.getElementById('label-mm-mode');
    if (headerBtn) {
      headerBtn.classList.toggle('btn-primary', isOutline);
      headerBtn.classList.toggle('btn-secondary', !isOutline);
      headerBtn.title = isOutline ? 'Basculer en Vue Carte Mind Map (Alt+P)' : 'Basculer en Vue Plan Outliner (Alt+P)';
      headerBtn.innerHTML = isOutline ? `
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a4 4 0 0 0-4 4v1a4 4 0 0 0-2 7.5A4 4 0 0 0 8 22h8a4 4 0 0 0 2-7.5A4 4 0 0 0 16 7V6a4 4 0 0 0-4-4Z"/><path d="M12 2v20"/><path d="M8 8h8"/><path d="M7 14h10"/></svg>
        <span id="label-mm-mode">Vue Carte</span>
      ` : `
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
        <span id="label-mm-mode">Vue Plan</span>
      `;
    }

    // 2. Bouton dock flottant
    const dockBtn = document.getElementById('mm-btn-toggle-outline');
    if (dockBtn) {
      dockBtn.title = isOutline ? 'Basculer en Vue Carte (Alt+P)' : 'Basculer en Vue Plan (Alt+P)';
      dockBtn.classList.toggle('active', isOutline);
      dockBtn.innerHTML = isOutline ? `
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a4 4 0 0 0-4 4v1a4 4 0 0 0-2 7.5A4 4 0 0 0 8 22h8a4 4 0 0 0 2-7.5A4 4 0 0 0 16 7V6a4 4 0 0 0-4-4Z"/><path d="M12 2v20"/><path d="M8 8h8"/><path d="M7 14h10"/></svg>
      ` : `
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
      `;
    }
  },

  // =========================================================================
  // RENDU VUE PLAN / OUTLINER (Option 1 — XMind Interactive Outliner)
  // =========================================================================

  renderOutlineView() {
    const outlineEl = document.getElementById('mindmap-outline-view');
    if (!outlineEl || !this.tree) return;

    let html = `
      <div class="mm-outline-wrapper">
        <!-- Barre d'actions du Plan -->
        <div class="mm-outline-toolbar">
          <div class="mm-outline-toolbar-left">
            <button type="button" class="mm-outline-tool-btn" id="mm-ot-btn-back-map" title="Basculer en Vue Carte Mind Map (Alt+P)">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a4 4 0 0 0-4 4v1a4 4 0 0 0-2 7.5A4 4 0 0 0 8 22h8a4 4 0 0 0 2-7.5A4 4 0 0 0 16 7V6a4 4 0 0 0-4-4Z"/><path d="M12 2v20"/><path d="M8 8h8"/><path d="M7 14h10"/></svg>
              <span>Vue Carte</span>
            </button>
            <div class="mm-outline-tool-sep"></div>
            <button type="button" class="mm-outline-tool-btn" id="mm-ot-btn-expand-all" title="Déplier toutes les branches">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="7 13 12 18 17 13"/><polyline points="7 6 12 11 17 6"/></svg>
              <span>Tout déplier</span>
            </button>
            <button type="button" class="mm-outline-tool-btn" id="mm-ot-btn-collapse-all" title="Replier toutes les branches">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 11 12 6 7 11"/><polyline points="17 18 12 13 7 18"/></svg>
              <span>Tout replier</span>
            </button>
          </div>
          <div class="mm-outline-toolbar-right">
            <button type="button" class="mm-outline-tool-btn primary" id="mm-ot-btn-add-boi" title="Ajouter une idée maîtresse (BOI)">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              <span>+ Idée directrice</span>
            </button>
            <button type="button" class="mm-outline-tool-btn" id="mm-ot-btn-copy-md" title="Copier le plan en Markdown">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              <span>Copier</span>
            </button>
            <button type="button" class="mm-outline-tool-btn" id="mm-ot-btn-print" title="Imprimer le plan structuré">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
              <span>Imprimer</span>
            </button>
          </div>
        </div>

        <!-- Feuille de document Outliner -->
        <div class="mm-outline-sheet">
          <!-- Titre Noyau Central -->
          <div class="mm-outline-root-header">
            <div class="mm-outline-root-badge">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a4 4 0 0 0-4 4v1a4 4 0 0 0-2 7.5A4 4 0 0 0 8 22h8a4 4 0 0 0 2-7.5A4 4 0 0 0 16 7V6a4 4 0 0 0-4-4Z"/><path d="M12 2v20"/><path d="M8 8h8"/><path d="M7 14h10"/></svg>
            </div>
            <div class="mm-outline-root-title" data-id="root" title="Cliquer pour modifier le concept central">
              ${this.escapeHtml(this.tree.text)}
            </div>
            <div class="mm-outline-actions root-actions" style="opacity: 1;">
              <button type="button" class="btn-icon-subtle" data-action="edit-node" data-id="root" title="Modifier le titre">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
              </button>
              <button type="button" class="btn-icon-subtle" data-action="add-child" data-id="root" title="Ajouter une idée directrice (BOI)">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </button>
            </div>
          </div>

          <!-- Arborescence des branches -->
          <div class="mm-outline-tree">
            ${(this.tree.children || []).map((boi, idx) => this.renderOutlineBoi(boi, idx)).join('')}
          </div>
        </div>
      </div>
    `;

    outlineEl.innerHTML = html;
    this.bindOutlineEvents(outlineEl);
  },

  renderOutlineBoi(boi, idx) {
    const isCollapsed = this.collapsedNodes.has(boi.id);
    const hasChildren = boi.children && boi.children.length > 0;
    const color = boi.color || '#3b82f6';

    return `
      <div class="mm-outline-boi-block ${isCollapsed ? 'is-collapsed' : ''}" data-node-id="${boi.id}" style="--boi-color: ${color};">
        <div class="mm-outline-row boi-row">
          <div class="mm-outline-left-col">
            ${hasChildren ? `
              <button type="button" class="mm-outline-chevron ${isCollapsed ? 'collapsed' : ''}" data-action="toggle-collapse" data-id="${boi.id}" title="${isCollapsed ? 'Déplier' : 'Replier'}">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
            ` : `
              <span class="mm-outline-dot-bullet" style="background: ${color};"></span>
            `}
            <span class="mm-outline-text boi-text" data-id="${boi.id}" title="Cliquer pour modifier">${this.escapeHtml(boi.text)}</span>
            ${boi.ref ? `
              <span class="mm-outline-ref-pill" data-ref="${this.escapeHtml(boi.ref)}" title="Cliquer pour lire le passage biblique">
                <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                <span>${this.escapeHtml(boi.ref)}</span>
              </span>
            ` : ''}
            ${boi.note ? `
              <span class="mm-outline-note-badge" data-action="edit-note" data-id="${boi.id}" title="Voir / modifier la note de branche">
                <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              </span>
            ` : ''}
          </div>

          <div class="mm-outline-actions">
            <button type="button" class="btn-icon-subtle" data-action="add-child" data-id="${boi.id}" title="Ajouter une sous-branche (Tab)">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
            <button type="button" class="btn-icon-subtle" data-action="scripture" data-id="${boi.id}" title="Associer un verset biblique">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
            </button>
            <button type="button" class="btn-icon-subtle" data-action="edit-note" data-id="${boi.id}" title="Note de branche (F4)">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            </button>
            <button type="button" class="btn-icon-subtle" data-action="color" data-id="${boi.id}" title="Changer la couleur">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>
            </button>
            <button type="button" class="btn-icon-subtle danger" data-action="delete" data-id="${boi.id}" title="Supprimer la branche">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>

        ${boi.note ? `
          <div class="mm-outline-note-card" data-action="edit-note" data-id="${boi.id}" title="Cliquer pour modifier la note">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <div class="mm-outline-note-text">${this.escapeHtml(boi.note)}</div>
          </div>
        ` : ''}

        <div class="mm-outline-children ${isCollapsed ? 'hidden' : ''}">
          ${(boi.children || []).map(child => this.renderOutlineSubTree(child, 1)).join('')}
        </div>
      </div>
    `;
  },

  renderOutlineSubTree(node, depth) {
    const isCollapsed = this.collapsedNodes.has(node.id);
    const hasChildren = node.children && node.children.length > 0;

    return `
      <div class="mm-outline-sub-block ${isCollapsed ? 'is-collapsed' : ''}" data-node-id="${node.id}">
        <div class="mm-outline-row sub-row depth-${depth}">
          <div class="mm-outline-left-col">
            ${hasChildren ? `
              <button type="button" class="mm-outline-chevron ${isCollapsed ? 'collapsed' : ''}" data-action="toggle-collapse" data-id="${node.id}" title="${isCollapsed ? 'Déplier' : 'Replier'}">
                <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
            ` : `
              <span class="mm-outline-sub-bullet"></span>
            `}
            <span class="mm-outline-text sub-text" data-id="${node.id}" title="Cliquer pour modifier">${this.escapeHtml(node.text)}</span>
            ${node.ref ? `
              <span class="mm-outline-ref-pill" data-ref="${this.escapeHtml(node.ref)}" title="Cliquer pour lire le passage biblique">
                <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                <span>${this.escapeHtml(node.ref)}</span>
              </span>
            ` : ''}
            ${node.note ? `
              <span class="mm-outline-note-badge" data-action="edit-note" data-id="${node.id}" title="Voir / modifier la note de branche">
                <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              </span>
            ` : ''}
          </div>

          <div class="mm-outline-actions">
            <button type="button" class="btn-icon-subtle" data-action="add-child" data-id="${node.id}" title="Ajouter une sous-branche (Tab)">
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
            <button type="button" class="btn-icon-subtle" data-action="scripture" data-id="${node.id}" title="Associer un verset biblique">
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
            </button>
            <button type="button" class="btn-icon-subtle" data-action="edit-note" data-id="${node.id}" title="Note de branche (F4)">
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            </button>
            <button type="button" class="btn-icon-subtle danger" data-action="delete" data-id="${node.id}" title="Supprimer">
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>

        ${node.note ? `
          <div class="mm-outline-note-card sub-note-card" data-action="edit-note" data-id="${node.id}" title="Cliquer pour modifier la note">
            <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <div class="mm-outline-note-text">${this.escapeHtml(node.note)}</div>
          </div>
        ` : ''}

        <div class="mm-outline-children ${isCollapsed ? 'hidden' : ''}">
          ${(node.children || []).map(child => this.renderOutlineSubTree(child, depth + 1)).join('')}
        </div>
      </div>
    `;
  },

  bindOutlineEvents(outlineEl) {
    // Toolbar actions
    outlineEl.querySelector('#mm-ot-btn-back-map')?.addEventListener('click', () => this.toggleViewMode('map'));
    outlineEl.querySelector('#mm-ot-btn-expand-all')?.addEventListener('click', () => this.expandAllNodes());
    outlineEl.querySelector('#mm-ot-btn-collapse-all')?.addEventListener('click', () => this.collapseAllNodes());
    outlineEl.querySelector('#mm-ot-btn-add-boi')?.addEventListener('click', () => this.addChildToNode(this.tree));
    outlineEl.querySelector('#mm-ot-btn-copy-md')?.addEventListener('click', () => {
      const md = this.treeToMarkdown(this.tree);
      if (navigator.clipboard) {
        navigator.clipboard.writeText(md).then(() => {
          if (typeof App !== 'undefined' && App.showToast) App.showToast('Plan Markdown copié dans le presse-papier');
        });
      }
    });
    outlineEl.querySelector('#mm-ot-btn-print')?.addEventListener('click', () => window.print());

    // Clic sur chevron replier/déplier
    outlineEl.querySelectorAll('[data-action="toggle-collapse"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const nodeId = btn.getAttribute('data-id');
        this.toggleCollapseNode(nodeId);
      });
    });

    // Clic sur le texte pour éditer en ligne
    outlineEl.querySelectorAll('.mm-outline-text, .mm-outline-root-title').forEach(textEl => {
      textEl.addEventListener('click', (e) => {
        e.stopPropagation();
        const nodeId = textEl.getAttribute('data-id');
        this.startOutlineInlineEdit(nodeId, textEl);
      });
    });

    // Actions rapides (+, verset, note, couleur, supprimer, éditer)
    outlineEl.querySelectorAll('[data-action]').forEach(btn => {
      const action = btn.getAttribute('data-action');
      const nodeId = btn.getAttribute('data-id');
      if (!nodeId || action === 'toggle-collapse') return;

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const node = this.findNode(nodeId);
        switch (action) {
          case 'add-child':
            if (node) this.addChildToNode(node);
            break;
          case 'scripture':
            this.promptScriptureRef(nodeId);
            break;
          case 'edit-note':
            this.promptTopicNote(nodeId);
            break;
          case 'color':
            this.promptChangeColor(nodeId);
            break;
          case 'delete':
            this.deleteNode(nodeId);
            break;
          case 'edit-node':
            const targetText = outlineEl.querySelector(`.mm-outline-text[data-id="${nodeId}"], .mm-outline-root-title[data-id="${nodeId}"]`);
            if (targetText) this.startOutlineInlineEdit(nodeId, targetText);
            break;
        }
      });
    });

    // Clic sur pastille biblique -> ouvre lecteur
    outlineEl.querySelectorAll('.mm-outline-ref-pill').forEach(pill => {
      const ref = pill.getAttribute('data-ref');
      pill.addEventListener('click', (e) => {
        e.stopPropagation();
        this.hideTooltip();
        this.openScriptureRef(ref);
      });
      pill.addEventListener('mouseenter', (e) => this.showScriptureTooltip(e, ref));
      pill.addEventListener('mousemove', (e) => this.moveTooltip(e));
      pill.addEventListener('mouseleave', () => this.hideTooltip());
    });
  },

  toggleCollapseNode(nodeId) {
    if (this.collapsedNodes.has(nodeId)) {
      this.collapsedNodes.delete(nodeId);
    } else {
      this.collapsedNodes.add(nodeId);
    }
    this.renderOutlineView();
  },

  expandAllNodes() {
    this.collapsedNodes.clear();
    this.renderOutlineView();
  },

  collapseAllNodes() {
    const collectIds = (node) => {
      if (node.children && node.children.length > 0) {
        this.collapsedNodes.add(node.id);
        node.children.forEach(collectIds);
      }
    };
    if (this.tree && this.tree.children) {
      this.tree.children.forEach(collectIds);
    }
    this.renderOutlineView();
  },

  startOutlineInlineEdit(nodeId, targetEl) {
    const node = this.findNode(nodeId);
    if (!node || targetEl.querySelector('input')) return;

    const originalText = node.text;
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'mm-outline-inline-input';
    input.value = originalText;

    targetEl.innerHTML = '';
    targetEl.appendChild(input);
    input.focus();
    input.select();

    let committed = false;
    const commit = () => {
      if (committed) return;
      committed = true;
      const val = input.value.trim().toUpperCase() || originalText;
      node.text = val;
      if (nodeId === 'root' && this.currentNote) {
        this.currentNote.title = val;
        const titleInput = document.getElementById('note-edit-title');
        if (titleInput) titleInput.value = val;
      }
      this.layoutTree();
      this.renderOutlineView();
      this.syncAndAutoSave();
    };

    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        committed = true;
        this.renderOutlineView();
      }
    });
  },

  draw() {
    if (!this.viewportG) return;
    this.viewportG.innerHTML = '';

    // 1. Dessiner d'abord toutes les branches (courbes fluides sous le texte)
    this.drawBranches(this.tree);

    // 2. Dessiner tous les nœuds (textes, boutons contextuels)
    this.drawNodes(this.tree);
  },

  drawBranches(node) {
    if (!node.children) return;

    node.children.forEach(child => {
      const isRoot = node.level === 0;
      const x1 = isRoot ? (child.side === 'right' ? node.width / 2 : -node.width / 2) : (child.side === 'right' ? node.x + node.width / 2 : node.x - node.width / 2);
      const y1 = node.y;

      const x2 = child.side === 'right' ? child.x - child.width / 2 : child.x + child.width / 2;
      const y2 = child.y;

      // Courbe de Bézier cubique organique
      const dx = Math.abs(x2 - x1);
      const cx1 = x1 + (child.side === 'right' ? dx * 0.5 : -dx * 0.5);
      const cy1 = y1;
      const cx2 = x1 + (child.side === 'right' ? dx * 0.5 : -dx * 0.5);
      const cy2 = y2;

      // Épaisseur dégressive selon la loi de Buzan
      const strokeWidth = isRoot ? 5.5 : Math.max(2, 4.0 - child.level * 0.6);

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', child.color || 'var(--text-secondary)');
      path.setAttribute('stroke-width', strokeWidth);
      path.setAttribute('stroke-linecap', 'round');
      path.classList.add('mm-branch-path');
      this.viewportG.appendChild(path);

      // Trait de soulignement sous le mot (Loi 7 : longueur branche = mot)
      const underX2 = child.side === 'right' ? child.x + child.width / 2 : child.x - child.width / 2;
      const underline = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      underline.setAttribute('x1', x2);
      underline.setAttribute('y1', y2 + 10);
      underline.setAttribute('x2', underX2);
      underline.setAttribute('y2', y2 + 10);
      underline.setAttribute('stroke', child.color || 'var(--text-secondary)');
      underline.setAttribute('stroke-width', Math.max(1.8, strokeWidth * 0.6));
      underline.setAttribute('stroke-linecap', 'round');
      this.viewportG.appendChild(underline);

      this.drawBranches(child);
    });
  },

  drawNodes(node) {
    const isRoot = node.level === 0;
    const isSelected = this.selectedNodeId === node.id;

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', `mm-node-g ${isRoot ? 'mm-root-node' : ''} ${isSelected ? 'selected' : ''}`);
    g.setAttribute('transform', `translate(${node.x}, ${node.y})`);
    g.setAttribute('data-id', node.id);

    if (isRoot) {
      // Médaillon central arrondi avec icône vectorielle noble
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', -node.width / 2);
      rect.setAttribute('y', -node.height / 2);
      rect.setAttribute('width', node.width);
      rect.setAttribute('height', node.height);
      rect.setAttribute('rx', 23);
      rect.setAttribute('class', 'mm-root-rect');
      rect.setAttribute('filter', isSelected ? 'url(#mm-select-glow)' : 'url(#mm-glow)');
      g.appendChild(rect);

      // Titre central en capitales
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'central');
      text.setAttribute('class', 'mm-root-text');
      text.textContent = node.text;
      g.appendChild(text);

      // Bouton contextuel + pour ajouter un BOI
      const plusBtn = this.createActionButton('+', node.width / 2 + 16, 0, () => this.addChildToNode(node));
      plusBtn.setAttribute('title', 'Ajouter une idée directrice majeure (BOI)');
      plusBtn.classList.add('mm-root-plus');
      g.appendChild(plusBtn);

    } else {
      // Zone réceptive continue invisible (évite la disparition des boutons entre le mot et les boutons)
      const hitRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      const hitW = node.width + 65;
      const hitX = node.side === 'right' ? -node.width / 2 - 5 : -node.width / 2 - 55;
      hitRect.setAttribute('x', hitX);
      hitRect.setAttribute('y', -18);
      hitRect.setAttribute('width', hitW);
      hitRect.setAttribute('height', 36);
      hitRect.setAttribute('fill', 'transparent');
      hitRect.setAttribute('style', 'cursor: pointer;');
      g.appendChild(hitRect);

      // Nœud de branche : Mot-clé épuré au-dessus du fil
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('dominant-baseline', 'bottom');
      text.setAttribute('y', 5);
      text.setAttribute('class', 'mm-branch-text');
      text.setAttribute('fill', 'var(--text-primary)');
      text.textContent = node.text;

      let badgeX;
      const textW = node.textWidth || this.getTextWidth(node.text, 11.5, '700');

      if (node.side === 'right') {
        const textX = -node.width / 2 + 10;
        text.setAttribute('text-anchor', 'start');
        text.setAttribute('x', textX);
        badgeX = textX + textW + 8;
      } else {
        const textX = node.width / 2 - 10;
        text.setAttribute('text-anchor', 'end');
        text.setAttribute('x', textX);
        badgeX = textX - textW - 8;
      }
      g.appendChild(text);

      // Pastille de référence biblique si présente
      if (node.ref) {
        const pillW = node.refPillWidth || 48;
        const refX = node.side === 'right' ? badgeX + pillW / 2 : badgeX - pillW / 2;
        if (node.side === 'right') {
          badgeX += pillW + 6;
        } else {
          badgeX -= (pillW + 6);
        }

        const refG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        refG.setAttribute('transform', `translate(${refX}, 3)`);
        refG.setAttribute('class', 'mm-scripture-pill');

        const refRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        refRect.setAttribute('x', -pillW / 2);
        refRect.setAttribute('y', -10);
        refRect.setAttribute('width', pillW);
        refRect.setAttribute('height', 16);
        refRect.setAttribute('rx', 4);
        refRect.setAttribute('fill', node.color || 'var(--accent-blue)');
        refRect.setAttribute('opacity', '0.18');
        refG.appendChild(refRect);

        const refText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        refText.setAttribute('text-anchor', 'middle');
        refText.setAttribute('dominant-baseline', 'central');
        refText.setAttribute('font-size', '9px');
        refText.setAttribute('font-weight', '700');
        refText.setAttribute('fill', node.color || 'var(--accent-blue)');
        refText.textContent = node.ref.length > 11 ? node.ref.slice(0, 9) + '…' : node.ref;
        refG.appendChild(refText);

        refG.addEventListener('mouseenter', (e) => this.showScriptureTooltip(e, node.ref));
        refG.addEventListener('mousemove', (e) => this.moveTooltip(e));
        refG.addEventListener('mouseleave', () => this.hideTooltip());

        refG.addEventListener('click', (e) => {
          e.stopPropagation();
          this.hideTooltip();
          this.openScriptureRef(node.ref);
        });

        g.appendChild(refG);
      }

      // Pastille d'annotation / Note textuelle si présente (Topic Note XMind)
      if (node.note) {
        const noteX = node.side === 'right' ? badgeX + 9 : badgeX - 9;
        if (node.side === 'right') {
          badgeX += 18 + 6;
        } else {
          badgeX -= (18 + 6);
        }

        const noteG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        noteG.setAttribute('transform', `translate(${noteX}, 3)`);
        noteG.setAttribute('class', 'mm-note-pill');

        const noteCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        noteCircle.setAttribute('r', 8.5);
        noteCircle.setAttribute('fill', 'var(--bg-card, #ffffff)');
        noteCircle.setAttribute('stroke', node.color || 'var(--accent-blue)');
        noteCircle.setAttribute('stroke-width', '1.2px');
        noteG.appendChild(noteCircle);

        // Petite icône carnet / note SVG épurée
        const noteIconG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        noteIconG.setAttribute('transform', 'translate(-5, -5) scale(0.42)');
        noteIconG.innerHTML = '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" fill="none" stroke="currentColor" stroke-width="2.5"/><polyline points="14 2 14 8 20 8" fill="none" stroke="currentColor" stroke-width="2.5"/><line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" stroke-width="2.5"/><line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" stroke-width="2.5"/>';
        noteIconG.setAttribute('stroke', node.color || 'var(--accent-blue)');
        noteIconG.setAttribute('fill', 'none');
        noteG.appendChild(noteIconG);

        noteG.addEventListener('mouseenter', (e) => this.showNoteTooltip(e, node.note));
        noteG.addEventListener('mousemove', (e) => this.moveTooltip(e));
        noteG.addEventListener('mouseleave', () => this.hideTooltip());

        noteG.addEventListener('click', (e) => {
          e.stopPropagation();
          this.hideTooltip();
          this.promptTopicNote(node.id);
        });

        g.appendChild(noteG);
      }

      // Actions au survol ou à la sélection (Loi ergonomie 100% Souris)
      const actionsG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      actionsG.setAttribute('class', 'mm-node-actions');

      const endX = node.side === 'right' ? node.width / 2 + 14 : -node.width / 2 - 14;
      const addSubBtn = this.createActionButton('+', endX, 3, () => this.addChildToNode(node));
      addSubBtn.setAttribute('title', 'Ajouter une sous-branche');

      const delX = node.side === 'right' ? node.width / 2 + 34 : -node.width / 2 - 34;
      const delBtn = this.createActionButton('×', delX, 3, () => this.deleteNode(node.id), true);
      delBtn.setAttribute('title', 'Supprimer la branche');

      actionsG.appendChild(addSubBtn);
      actionsG.appendChild(delBtn);
      g.appendChild(actionsG);
    }

    // Gestion de la sélection et de l'édition directe
    g.addEventListener('click', (e) => {
      e.stopPropagation();
      this.selectNode(node.id);
    });

    g.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      this.startInlineEdit(node.id);
    });

    g.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.selectNode(node.id);
      this.showContextMenu(e.clientX, e.clientY, node.id);
    });

    this.viewportG.appendChild(g);

    if (node.children) {
      node.children.forEach(child => this.drawNodes(child));
    }
  },

  createActionButton(label, x, y, onClick, isDanger = false) {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('transform', `translate(${x}, ${y})`);
    g.setAttribute('class', `mm-action-btn ${isDanger ? 'danger' : ''}`);

    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('r', 9.5);
    circle.setAttribute('class', 'mm-action-circle');
    g.appendChild(circle);

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'central');
    text.setAttribute('class', 'mm-action-text');
    text.setAttribute('y', label === '+' ? -0.5 : 0);
    text.textContent = label;
    g.appendChild(text);

    g.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick();
    });

    return g;
  },

  // =========================================================================
  // INTERACTIONS D'ÉDITION SOURIS & CLAVIER (100% Fluide)
  // =========================================================================

  selectNode(id) {
    this.selectedNodeId = id;
    this.updateSelectionState();
  },

  updateSelectionState() {
    this.viewportG?.querySelectorAll('.mm-node-g').forEach(el => {
      el.classList.toggle('selected', el.getAttribute('data-id') === this.selectedNodeId);
    });
  },

  findNode(id, current = this.tree) {
    if (!current) return null;
    if (current.id === id) return current;
    if (!current.children) return null;
    for (const child of current.children) {
      const found = this.findNode(id, child);
      if (found) return found;
    }
    return null;
  },

  findParent(id, current = this.tree) {
    if (!current || !current.children) return null;
    for (const child of current.children) {
      if (child.id === id) return current;
      const found = this.findParent(id, child);
      if (found) return found;
    }
    return null;
  },

  addChildToSelected() {
    const target = this.selectedNodeId ? this.findNode(this.selectedNodeId) : this.tree;
    if (target) this.addChildToNode(target);
  },

  addChildToNode(parentNode) {
    const newId = `node_${Date.now()}`;
    const newNode = {
      id: newId,
      text: 'MOT-CLÉ',
      ref: '',
      children: [],
      level: parentNode.level + 1
    };

    parentNode.children = parentNode.children || [];
    parentNode.children.push(newNode);

    this.layoutTree();
    if (this.viewMode === 'outline') {
      this.renderOutlineView();
      const newEl = document.querySelector(`.mm-outline-text[data-id="${newId}"]`);
      if (newEl) this.startOutlineInlineEdit(newId, newEl);
    } else {
      this.draw();
      this.selectNode(newId);
      this.startInlineEdit(newId);
    }
    this.syncAndAutoSave();
  },

  addSiblingToSelected() {
    if (!this.selectedNodeId || this.selectedNodeId === 'root') {
      this.addChildToNode(this.tree);
      return;
    }

    const parent = this.findParent(this.selectedNodeId);
    if (!parent) return;

    const newId = `node_${Date.now()}`;
    const newNode = {
      id: newId,
      text: 'MOT-CLÉ',
      ref: '',
      children: [],
      level: parent.level + 1
    };

    const index = parent.children.findIndex(c => c.id === this.selectedNodeId);
    parent.children.splice(index + 1, 0, newNode);

    this.layoutTree();
    if (this.viewMode === 'outline') {
      this.renderOutlineView();
      const newEl = document.querySelector(`.mm-outline-text[data-id="${newId}"]`);
      if (newEl) this.startOutlineInlineEdit(newId, newEl);
    } else {
      this.draw();
      this.selectNode(newId);
      this.startInlineEdit(newId);
    }
    this.syncAndAutoSave();
  },

  deleteSelected() {
    if (!this.selectedNodeId || this.selectedNodeId === 'root') return;
    this.deleteNode(this.selectedNodeId);
  },

  deleteNode(id) {
    const parent = this.findParent(id);
    if (!parent) return;

    parent.children = parent.children.filter(c => c.id !== id);
    this.selectedNodeId = parent.id;

    this.layoutTree();
    if (this.viewMode === 'outline') {
      this.renderOutlineView();
    } else {
      this.draw();
      this.updateSelectionState();
    }
    this.syncAndAutoSave();
  },

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  startInlineEdit(nodeId) {
    this.hideTooltip();
    const node = this.findNode(nodeId);
    if (!node) return;

    const nodeG = this.viewportG?.querySelector(`.mm-node-g[data-id="${nodeId}"]`);
    if (!nodeG) return;

    // Masquer le texte SVG et les boutons d'actions pendant l'édition
    nodeG.classList.add('editing');

    const rect = this.svg.getBoundingClientRect();
    const isRoot = node.id === 'root';
    const scale = this.viewBox.scale;

    // Calcul précis de l'emplacement de l'input
    let screenX, screenY, inputWidth;

    if (isRoot) {
      screenX = rect.left + this.viewBox.x + (node.x - node.width / 2) * scale;
      screenY = rect.top + this.viewBox.y + (node.y - node.height / 2) * scale;
      inputWidth = Math.max(100, node.width * scale);
    } else {
      const textW = node.textWidth || this.getTextWidth(node.text, 11.5, '700');
      const textX = node.side === 'right' ? node.x - node.width / 2 + 10 : node.x + node.width / 2 - 10 - textW;
      screenX = rect.left + this.viewBox.x + textX * scale;
      screenY = rect.top + this.viewBox.y + (node.y - 14) * scale;
      inputWidth = Math.max(80, (textW + 20) * scale);
    }

    // Création d'un input flottant calé sur le mot
    const input = document.createElement('input');
    input.type = 'text';
    input.value = node.text;
    input.className = 'mm-inline-editor';
    input.style.left = `${screenX}px`;
    input.style.top = `${screenY}px`;
    input.style.width = `${inputWidth}px`;

    document.body.appendChild(input);
    input.focus();
    input.select();

    let isCommitted = false;

    const finish = (newText = null) => {
      if (isCommitted) return;
      isCommitted = true;

      nodeG.classList.remove('editing');
      if (input.parentNode) {
        input.remove();
      }

      if (newText !== null) {
        node.text = newText;
        if (nodeId === 'root' && this.currentNote) {
          this.currentNote.title = newText;
          const titleInput = document.getElementById('note-edit-title');
          if (titleInput) titleInput.value = newText;
        }
        this.layoutTree();
        this.draw();
        this.syncAndAutoSave();
      }
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const newText = input.value.trim().toUpperCase() || 'MOT-CLÉ';
        finish(newText);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        finish(null);
      }
    });

    input.addEventListener('blur', () => {
      const newText = input.value.trim().toUpperCase() || 'MOT-CLÉ';
      finish(newText);
    });
  },

  navigateWithArrows(key) {
    if (!this.selectedNodeId) {
      this.selectNode('root');
      return;
    }

    const current = this.findNode(this.selectedNodeId);
    const parent = this.findParent(this.selectedNodeId);
    if (!current) return;

    if (key === 'ArrowRight') {
      if (current.id === 'root') {
        const rightChild = current.children?.find(c => c.side === 'right');
        if (rightChild) this.selectNode(rightChild.id);
      } else if (current.side === 'right' && current.children?.length > 0) {
        this.selectNode(current.children[0].id);
      } else if (current.side === 'left' && parent) {
        this.selectNode(parent.id);
      }
    } else if (key === 'ArrowLeft') {
      if (current.id === 'root') {
        const leftChild = current.children?.find(c => c.side === 'left');
        if (leftChild) this.selectNode(leftChild.id);
      } else if (current.side === 'left' && current.children?.length > 0) {
        this.selectNode(current.children[0].id);
      } else if (current.side === 'right' && parent) {
        this.selectNode(parent.id);
      }
    } else if (key === 'ArrowUp' || key === 'ArrowDown') {
      if (parent && parent.children) {
        const siblings = parent.children.filter(c => c.side === current.side);
        const idx = siblings.findIndex(c => c.id === current.id);
        const nextIdx = key === 'ArrowUp' ? idx - 1 : idx + 1;
        if (nextIdx >= 0 && nextIdx < siblings.length) {
          this.selectNode(siblings[nextIdx].id);
        }
      }
    }
  },

  // =========================================================================
  // NAVIGATION VIEWPORT (Zoom & Fit)
  // =========================================================================

  applyTransform() {
    if (this.viewportG) {
      this.viewportG.setAttribute('transform', `translate(${this.viewBox.x}, ${this.viewBox.y}) scale(${this.viewBox.scale})`);
    }
  },

  zoom(factor) {
    const rect = this.svg.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const newScale = Math.min(Math.max(0.3, this.viewBox.scale * factor), 3.0);
    this.viewBox.x = centerX - (centerX - this.viewBox.x) * (newScale / this.viewBox.scale);
    this.viewBox.y = centerY - (centerY - this.viewBox.y) * (newScale / this.viewBox.scale);
    this.viewBox.scale = newScale;

    this.applyTransform();
  },

  fitView() {
    if (!this.svg) return;
    const rect = this.svg.getBoundingClientRect();
    this.viewBox.x = rect.width / 2;
    this.viewBox.y = rect.height / 2;
    this.viewBox.scale = 1.0;
    this.applyTransform();
  },

  togglePaperMode() {
    if (!this.container) return;
    this.container.classList.toggle('paper-mode');
  },

  cyclePalette() {
    const keys = Object.keys(this.PALETTES);
    const current = this.currentNote?.palette || 'nature';
    const nextIndex = (keys.indexOf(current) + 1) % keys.length;
    const nextPalette = keys[nextIndex];

    if (this.currentNote) {
      this.currentNote.palette = nextPalette;
    }
    this.layoutTree();
    this.draw();
    this.syncAndAutoSave();
  },

  toggleHelpDrawer(force = null) {
    const drawer = document.getElementById('mindmap-help-drawer');
    if (!drawer) return;
    if (force !== null) {
      drawer.classList.toggle('hidden', !force);
    } else {
      drawer.classList.toggle('hidden');
    }
  },

  openScriptureRef(ref) {
    if (typeof BibleReader !== 'undefined' && BibleReader.searchPassage) {
      BibleReader.searchPassage(ref);
      if (typeof App !== 'undefined' && App.switchView) {
        App.switchView('bible');
      }
    }
  },

  // =========================================================================
  // GESTION DES INFOBULLES FLOTTANTES RICHES (Versets & Notes)
  // =========================================================================

  showTooltip(e, contentHtml) {
    if (!this.tooltipEl) {
      this.tooltipEl = document.createElement('div');
      this.tooltipEl.id = 'mm-floating-tooltip';
      this.tooltipEl.className = 'mm-floating-tooltip';
      document.body.appendChild(this.tooltipEl);
    }

    this.tooltipEl.innerHTML = contentHtml;
    this.tooltipEl.style.display = 'block';
    this.moveTooltip(e);
  },

  moveTooltip(e) {
    if (!this.tooltipEl || this.tooltipEl.style.display === 'none') return;
    const tooltipRect = this.tooltipEl.getBoundingClientRect();
    const padding = 12;
    let left = e.clientX - tooltipRect.width / 2;
    let top = e.clientY - tooltipRect.height - 12;

    if (left < padding) left = padding;
    if (left + tooltipRect.width > window.innerWidth - padding) {
      left = window.innerWidth - tooltipRect.width - padding;
    }
    if (top < padding) {
      top = e.clientY + 22;
    }

    this.tooltipEl.style.left = `${left}px`;
    this.tooltipEl.style.top = `${top}px`;
  },

  hideTooltip() {
    this.currentTooltipTarget = null;
    if (this.tooltipEl) {
      this.tooltipEl.style.display = 'none';
    }
  },

  async showScriptureTooltip(e, ref) {
    this.currentTooltipTarget = ref;
    const cacheKey = (ref || '').trim().toLowerCase();

    const renderTooltip = (verseText = null, version = null) => {
      let html = `
        <div class="mm-tooltip-header">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
          <span>${version ? `Verset (${version})` : 'Passage Biblique'}</span>
        </div>
        <div class="mm-tooltip-ref">${this.escapeHtml(ref)}</div>
      `;
      if (verseText) {
        html += `<div class="mm-tooltip-verse-text">« ${this.escapeHtml(verseText)} »</div>`;
      }
      html += `<div class="mm-tooltip-hint">Cliquer pour ouvrir dans le lecteur biblique</div>`;
      return html;
    };

    if (this._verseCache && this._verseCache[cacheKey]) {
      const cached = this._verseCache[cacheKey];
      this.showTooltip(e, renderTooltip(cached.text, cached.version));
      return;
    }

    this.showTooltip(e, renderTooltip());

    try {
      this._verseCache = this._verseCache || {};
      if (typeof API !== 'undefined' && API.getVersePreview) {
        const res = await API.getVersePreview(ref);
        if (res && res.success && res.text) {
          this._verseCache[cacheKey] = { text: res.text, version: res.version || 'LSG' };
          if (this.currentTooltipTarget === ref && this.tooltipEl && this.tooltipEl.style.display !== 'none') {
            this.showTooltip(e, renderTooltip(res.text, res.version || 'LSG'));
          }
        }
      }
    } catch (err) {
      // Ignorer si la prévisualisation échoue
    }
  },

  showNoteTooltip(e, noteText) {
    this.currentTooltipTarget = null;
    const html = `
      <div class="mm-tooltip-header">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
        <span>Note de branche</span>
      </div>
      <div class="mm-tooltip-body">${this.escapeHtml(noteText)}</div>
      <div class="mm-tooltip-hint">Cliquer ou F4 pour modifier</div>
    `;
    this.showTooltip(e, html);
  },

  // =========================================================================
  // SYNCHRONISATION & EXPORT
  // =========================================================================

  syncAndAutoSave() {
    if (!this.currentNote) return;

    const newMdContent = this.treeToMarkdown(this.tree);
    this.currentNote.content = newMdContent;
    this.currentNote.type = 'mindmap';

    if (typeof NotesView !== 'undefined' && NotesView.triggerAutoSave) {
      NotesView.triggerAutoSave();
    }
  },

  async exportToTextNote() {
    if (!this.currentNote || !this.tree) return;

    let outlineText = `## ${this.tree.text}\n*Plan rédigé extrait de la Mind Map le ${new Date().toLocaleDateString('fr-FR')}*\n\n`;

    const walk = (node, depth) => {
      if (!node.children) return;
      for (const child of node.children) {
        const prefix = depth === 1 ? '### ' : '  '.repeat(depth - 2) + '- ';
        const refPart = child.ref ? ` *(${child.ref})*` : '';
        outlineText += `${prefix}${child.text}${refPart}\n`;
        if (child.note) {
          const indentSpace = depth === 1 ? '  > ' : '  '.repeat(depth - 1) + '> ';
          outlineText += `${indentSpace}${child.note}\n`;
        }
        walk(child, depth + 1);
      }
      if (depth === 1) outlineText += '\n';
    };

    walk(this.tree, 1);

    const newNoteData = {
      title: `Plan — ${this.currentNote.title}`,
      reference: this.currentNote.reference || '',
      tags: `${this.currentNote.tags ? this.currentNote.tags + ', ' : ''}plan, prédication`,
      type: 'text',
      include_in_ai: true,
      content: outlineText
    };

    try {
      await API.call('save_note', newNoteData);
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast(`Plan textuel créé : « ${newNoteData.title} »`);
      }
      if (typeof NotesView !== 'undefined' && NotesView.loadNotes) {
        await NotesView.loadNotes();
      }
    } catch (e) {
      alert(`Erreur export plan : ${e}`);
    }
  },

  // =========================================================================
  // GESTION DU COPIER / COLLER DE BRANCHES
  // =========================================================================

  copyNode(nodeId) {
    const node = this.findNode(nodeId);
    if (!node || node.id === 'root') return;

    // Clone profond pour le presse-papier
    this.clipboardNode = JSON.parse(JSON.stringify(node));
    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast(`Branche « ${node.text} » copiée`);
    }
  },

  pasteNode(targetId) {
    if (!this.clipboardNode) return;
    const target = this.findNode(targetId) || this.tree;
    if (!target) return;

    // Recréer récursivement avec de nouveaux identifiants uniques
    const cloneTree = (orig, level) => {
      return {
        id: `node_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        text: orig.text,
        ref: orig.ref || '',
        note: orig.note || '',
        color: orig.color,
        level: level,
        children: (orig.children || []).map(child => cloneTree(child, level + 1))
      };
    };

    const cloned = cloneTree(this.clipboardNode, target.level + 1);
    target.children = target.children || [];
    target.children.push(cloned);

    this.layoutTree();
    this.draw();
    this.selectNode(cloned.id);
    this.syncAndAutoSave();

    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast(`Branche « ${cloned.text} » collée`);
    }
  },

  // =========================================================================
  // BOÎTE DE DIALOGUE : ASSOCIER UN VERSET BIBLIQUE
  // =========================================================================

  promptScriptureRef(nodeId) {
    const node = this.findNode(nodeId);
    if (!node) return;

    const overlay = document.createElement('div');
    overlay.className = 'mm-prompt-overlay';
    overlay.innerHTML = `
      <div class="mm-prompt-dialog" style="width: 400px;">
        <div class="mm-prompt-header">
          <div class="mm-prompt-header-left">
            <div class="mm-prompt-icon-badge">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
            </div>
            <div class="mm-prompt-title">
              <span>Référence biblique</span>
              <span class="mm-prompt-target-tag" style="background: ${node.color || '#3b82f6'}22; color: ${node.color || 'var(--accent-blue)'}; border: 1px solid ${node.color || '#3b82f6'}44;">${this.escapeHtml(node.text)}</span>
            </div>
          </div>
          <button type="button" class="mm-prompt-close-btn" id="mm-prompt-x-close" title="Fermer (Échap)">×</button>
        </div>

        <p class="mm-prompt-desc">La référence s'affichera sous forme de pastille interactive cliquable à côté du mot-clé :</p>
        <input type="text" class="mm-prompt-input" id="mm-scripture-input" placeholder="Ex: Jean 3:16, Romains 8:28..." value="${this.escapeHtml(node.ref || '')}">

        <div class="mm-prompt-hint">
          <kbd>Entrée</kbd> pour valider &nbsp;•&nbsp; <kbd>Échap</kbd> pour fermer
        </div>

        <div class="mm-prompt-actions-row">
          <div>
            ${node.ref ? `
              <button type="button" class="btn-danger-subtle" id="mm-prompt-remove" title="Supprimer la référence biblique">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                <span>Retirer</span>
              </button>
            ` : ''}
          </div>
          <div class="mm-prompt-actions-right">
            <button type="button" class="btn-secondary" id="mm-prompt-cancel">Annuler</button>
            <button type="button" class="btn-primary" id="mm-prompt-save">Enregistrer</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    const input = overlay.querySelector('#mm-scripture-input');
    input.focus();
    input.select();

    const closeDialog = () => overlay.remove();

    overlay.querySelector('#mm-prompt-x-close')?.addEventListener('click', closeDialog);
    overlay.querySelector('#mm-prompt-cancel')?.addEventListener('click', closeDialog);
    overlay.querySelector('#mm-prompt-remove')?.addEventListener('click', () => {
      node.ref = '';
      this.refreshView();
      this.syncAndAutoSave();
      closeDialog();
    });

    const saveRef = () => {
      const val = input.value.trim();
      node.ref = val;
      this.refreshView();
      this.syncAndAutoSave();
      closeDialog();
    };

    overlay.querySelector('#mm-prompt-save')?.addEventListener('click', saveRef);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveRef();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeDialog();
      }
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeDialog();
    });
  },

  // =========================================================================
  // BOÎTE DE DIALOGUE : NOTE DE BRANCHE (TOPIC NOTE)
  // =========================================================================

  promptTopicNote(nodeId) {
    const node = this.findNode(nodeId);
    if (!node) return;

    const overlay = document.createElement('div');
    overlay.className = 'mm-prompt-overlay';
    overlay.innerHTML = `
      <div class="mm-prompt-dialog" style="width: 480px;">
        <div class="mm-prompt-header">
          <div class="mm-prompt-header-left">
            <div class="mm-prompt-icon-badge">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            </div>
            <div class="mm-prompt-title">
              <span>Note de branche</span>
              <span class="mm-prompt-target-tag" style="background: ${node.color || '#3b82f6'}22; color: ${node.color || 'var(--accent-blue)'}; border: 1px solid ${node.color || '#3b82f6'}44;">${this.escapeHtml(node.text)}</span>
            </div>
          </div>
          <button type="button" class="mm-prompt-close-btn" id="mm-note-x-close" title="Fermer (Échap)">×</button>
        </div>

        <p class="mm-prompt-desc">Ajoutez des détails, commentaires ou réflexions sans surcharger la clarté visuelle de votre carte :</p>
        
        <textarea class="mm-prompt-textarea" id="mm-topic-note-input" rows="6" placeholder="Écrivez vos notes, citations, développements ou réflexions ici...">${this.escapeHtml(node.note || '')}</textarea>

        <div class="mm-prompt-hint">
          <kbd>Ctrl</kbd>+<kbd>Entrée</kbd> pour enregistrer &nbsp;•&nbsp; <kbd>Échap</kbd> pour fermer
        </div>

        <div class="mm-prompt-actions-row">
          <div>
            ${node.note ? `
              <button type="button" class="btn-danger-subtle" id="mm-note-remove" title="Supprimer la note de cette branche">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                <span>Retirer la note</span>
              </button>
            ` : ''}
          </div>
          <div class="mm-prompt-actions-right">
            <button type="button" class="btn-secondary" id="mm-note-cancel">Annuler</button>
            <button type="button" class="btn-primary" id="mm-note-save">Enregistrer</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    const textarea = overlay.querySelector('#mm-topic-note-input');
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);

    const closeDialog = () => overlay.remove();

    overlay.querySelector('#mm-note-x-close')?.addEventListener('click', closeDialog);
    overlay.querySelector('#mm-note-cancel')?.addEventListener('click', closeDialog);
    overlay.querySelector('#mm-note-remove')?.addEventListener('click', () => {
      delete node.note;
      this.refreshView();
      this.syncAndAutoSave();
      closeDialog();
    });

    const saveNote = () => {
      const val = textarea.value.trim();
      if (val) {
        node.note = val;
      } else {
        delete node.note;
      }
      this.refreshView();
      this.syncAndAutoSave();
      closeDialog();
    };

    overlay.querySelector('#mm-note-save')?.addEventListener('click', saveNote);
    textarea.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        saveNote();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeDialog();
      }
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeDialog();
    });
  },

  // =========================================================================
  // BOÎTE DE DIALOGUE : COULEUR DE BRANCHE
  // =========================================================================

  promptChangeColor(nodeId) {
    const node = this.findNode(nodeId);
    if (!node || node.id === 'root') return;

    const palette = this.PALETTES[this.currentNote?.palette || 'nature'] || this.PALETTES.nature;
    const colors = [...palette, '#ef4444', '#f59e0b', '#10b981', '#06b6d4', '#6366f1', '#ec4899'];

    const overlay = document.createElement('div');
    overlay.className = 'mm-prompt-overlay';
    overlay.innerHTML = `
      <div class="mm-prompt-dialog" style="width: 290px;">
        <div class="mm-prompt-header">
          <div class="mm-prompt-header-left">
            <div class="mm-prompt-icon-badge">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>
            </div>
            <div class="mm-prompt-title">
              <span>Couleur</span>
              <span class="mm-prompt-target-tag" style="background: ${node.color || '#3b82f6'}22; color: ${node.color || 'var(--accent-blue)'}; border: 1px solid ${node.color || '#3b82f6'}44;">${this.escapeHtml(node.text)}</span>
            </div>
          </div>
          <button type="button" class="mm-prompt-close-btn" id="mm-color-x-close" title="Fermer (Échap)">×</button>
        </div>
        <p class="mm-prompt-desc">Choisissez une teinte distincte pour cette branche :</p>
        <div style="display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin: 12px 0;">
          ${colors.map(c => `
            <div class="mm-color-choice" data-color="${c}" style="width: 28px; height: 28px; border-radius: 50%; background: ${c}; cursor: pointer; border: 2px solid ${node.color === c ? '#ffffff' : 'transparent'}; box-shadow: 0 2px 6px rgba(0,0,0,0.15); transition: transform 0.15s ease;" title="${c}"></div>
          `).join('')}
        </div>
        <div class="mm-prompt-actions-row">
          <button type="button" class="btn-secondary" id="mm-color-reset" style="font-size: 11px;">Par défaut</button>
          <button type="button" class="btn-secondary" id="mm-color-cancel" style="margin-left: auto;">Fermer</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    const closeDialog = () => overlay.remove();

    overlay.querySelector('#mm-color-x-close')?.addEventListener('click', closeDialog);

    overlay.querySelectorAll('.mm-color-choice').forEach(el => {
      el.addEventListener('click', () => {
        const selectedColor = el.getAttribute('data-color');
        node.color = selectedColor;
        this.refreshView();
        this.syncAndAutoSave();
        closeDialog();
      });
    });

    overlay.querySelector('#mm-color-reset')?.addEventListener('click', () => {
      delete node.color;
      this.refreshView();
      this.syncAndAutoSave();
      closeDialog();
    });

    overlay.querySelector('#mm-color-cancel')?.addEventListener('click', closeDialog);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeDialog();
    });
  },

  // =========================================================================
  // MENU CONTEXTUEL CLIC DROIT INTELLIGENT
  // =========================================================================

  showContextMenu(clientX, clientY, targetNodeId = null) {
    this.hideTooltip();
    // Supprimer un ancien menu contextuel s'il existe
    document.getElementById('mm-dynamic-context-menu')?.remove();

    const isNode = targetNodeId !== null;
    const isRoot = targetNodeId === 'root';
    const isBranch = isNode && !isRoot;
    const node = isNode ? this.findNode(targetNodeId) : null;

    const menu = document.createElement('div');
    menu.id = 'mm-dynamic-context-menu';
    menu.className = 'mm-context-menu';

    let itemsHtml = '';

    if (isBranch) {
      // 1. Clic droit sur une BRANCHE / SOUS-BRANCHE
      itemsHtml = `
        <div class="mm-ctx-item" data-action="add-child">
          <span class="mm-ctx-icon">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </span>
          <span class="mm-ctx-label">Ajouter une sous-branche</span>
          <span class="mm-ctx-shortcut">Tab</span>
        </div>
        <div class="mm-ctx-item" data-action="add-sibling">
          <span class="mm-ctx-icon">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </span>
          <span class="mm-ctx-label">Ajouter une branche voisine</span>
          <span class="mm-ctx-shortcut">Entrée</span>
        </div>
        <div class="mm-ctx-item" data-action="edit">
          <span class="mm-ctx-icon">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
          </span>
          <span class="mm-ctx-label">Modifier le mot-clé</span>
          <span class="mm-ctx-shortcut">Espace</span>
        </div>
        <div class="mm-ctx-item" data-action="scripture">
          <span class="mm-ctx-icon">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
          </span>
          <span class="mm-ctx-label">${node?.ref ? 'Modifier le verset biblique' : 'Associer un verset biblique'}</span>
        </div>
        <div class="mm-ctx-item" data-action="note">
          <span class="mm-ctx-icon">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          </span>
          <span class="mm-ctx-label">${node?.note ? 'Modifier la note de branche' : 'Ajouter une note de branche'}</span>
          <span class="mm-ctx-shortcut">F4</span>
        </div>
        <div class="mm-ctx-item" data-action="color">
          <span class="mm-ctx-icon">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>
          </span>
          <span class="mm-ctx-label">Changer la couleur</span>
        </div>
        <div class="mm-ctx-divider"></div>
        <div class="mm-ctx-item" data-action="copy">
          <span class="mm-ctx-icon">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          </span>
          <span class="mm-ctx-label">Copier la branche</span>
          <span class="mm-ctx-shortcut">Ctrl+C</span>
        </div>
        ${this.clipboardNode ? `
          <div class="mm-ctx-item" data-action="paste">
            <span class="mm-ctx-icon">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
            </span>
            <span class="mm-ctx-label">Coller en sous-branche</span>
            <span class="mm-ctx-shortcut">Ctrl+V</span>
          </div>
        ` : ''}
        <div class="mm-ctx-divider"></div>
        <div class="mm-ctx-item danger" data-action="delete">
          <span class="mm-ctx-icon">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </span>
          <span class="mm-ctx-label">Supprimer la branche</span>
          <span class="mm-ctx-shortcut">Suppr</span>
        </div>
        <div class="mm-ctx-divider"></div>
        <div class="mm-ctx-item" data-action="toggle-mode">
          <span class="mm-ctx-icon">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
          </span>
          <span class="mm-ctx-label">${this.viewMode === 'outline' ? 'Basculer en Vue Carte' : 'Basculer en Vue Plan'}</span>
          <span class="mm-ctx-shortcut">Alt+P</span>
        </div>
      `;
    } else if (isRoot) {
      // 2. Clic droit sur le CONCEPT CENTRAL (Noyau)
      itemsHtml = `
        <div class="mm-ctx-item" data-action="add-child">
          <span class="mm-ctx-icon">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </span>
          <span class="mm-ctx-label">Ajouter une idée maîtresse (BOI)</span>
          <span class="mm-ctx-shortcut">Tab</span>
        </div>
        <div class="mm-ctx-item" data-action="edit">
          <span class="mm-ctx-icon">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
          </span>
          <span class="mm-ctx-label">Renommer le concept central</span>
          <span class="mm-ctx-shortcut">Double-clic</span>
        </div>
        ${this.clipboardNode ? `
          <div class="mm-ctx-item" data-action="paste">
            <span class="mm-ctx-icon">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
            </span>
            <span class="mm-ctx-label">Coller en nouvelle branche</span>
            <span class="mm-ctx-shortcut">Ctrl+V</span>
          </div>
        ` : ''}
        <div class="mm-ctx-divider"></div>
        <div class="mm-ctx-item" data-action="toggle-mode">
          <span class="mm-ctx-icon">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
          </span>
          <span class="mm-ctx-label">${this.viewMode === 'outline' ? 'Basculer en Vue Carte' : 'Basculer en Vue Plan'}</span>
          <span class="mm-ctx-shortcut">Alt+P</span>
        </div>
        <div class="mm-ctx-item" data-action="palette">
          <span class="mm-ctx-icon">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>
          </span>
          <span class="mm-ctx-label">Changer la palette de couleurs</span>
        </div>
        <div class="mm-ctx-item" data-action="fit">
          <span class="mm-ctx-icon">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/></svg>
          </span>
          <span class="mm-ctx-label">Recentrer la carte</span>
          <span class="mm-ctx-shortcut">R</span>
        </div>
      `;
    } else {
      // 3. Clic droit sur l'ARRIÈRE-PLAN (Feuille / Cannevas vide)
      itemsHtml = `
        <div class="mm-ctx-item" data-action="add-boi">
          <span class="mm-ctx-icon">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </span>
          <span class="mm-ctx-label">Nouvelle idée maîtresse (BOI)</span>
          <span class="mm-ctx-shortcut">Tab</span>
        </div>
        ${this.clipboardNode ? `
          <div class="mm-ctx-item" data-action="paste">
            <span class="mm-ctx-icon">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
            </span>
            <span class="mm-ctx-label">Coller la branche</span>
            <span class="mm-ctx-shortcut">Ctrl+V</span>
          </div>
        ` : ''}
        <div class="mm-ctx-divider"></div>
        <div class="mm-ctx-item" data-action="toggle-mode">
          <span class="mm-ctx-icon">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
          </span>
          <span class="mm-ctx-label">${this.viewMode === 'outline' ? 'Basculer en Vue Carte' : 'Basculer en Vue Plan'}</span>
          <span class="mm-ctx-shortcut">Alt+P</span>
        </div>
        <div class="mm-ctx-item" data-action="fit">
          <span class="mm-ctx-icon">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/></svg>
          </span>
          <span class="mm-ctx-label">Recentrer la vue</span>
          <span class="mm-ctx-shortcut">R</span>
        </div>
        <div class="mm-ctx-item" data-action="palette">
          <span class="mm-ctx-icon">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>
          </span>
          <span class="mm-ctx-label">Changer de palette chromatique</span>
        </div>
        <div class="mm-ctx-item" data-action="theme">
          <span class="mm-ctx-icon">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 0 20z" fill="currentColor"/></svg>
          </span>
          <span class="mm-ctx-label">Basculer Feuille Blanche / Thème</span>
        </div>
        <div class="mm-ctx-divider"></div>
        <div class="mm-ctx-item" data-action="export-text">
          <span class="mm-ctx-icon">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          </span>
          <span class="mm-ctx-label">Exporter en plan textuel (.md)</span>
        </div>
        <div class="mm-ctx-item" data-action="help">
          <span class="mm-ctx-icon">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </span>
          <span class="mm-ctx-label">Aide & Raccourcis</span>
          <span class="mm-ctx-shortcut">?</span>
        </div>
      `;
    }

    menu.innerHTML = itemsHtml;
    document.body.appendChild(menu);

    // Calcul du positionnement pour éviter de déborder de l'écran
    const menuWidth = 220;
    const menuHeight = menu.offsetHeight || 260;
    const x = Math.min(clientX, window.innerWidth - menuWidth - 10);
    const y = Math.min(clientY, window.innerHeight - menuHeight - 10);

    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    const closeMenu = () => {
      menu.remove();
      document.removeEventListener('click', closeMenu);
      document.removeEventListener('keydown', handleKey);
    };

    const handleKey = (e) => {
      if (e.key === 'Escape') closeMenu();
    };

    setTimeout(() => {
      document.addEventListener('click', closeMenu);
      document.addEventListener('keydown', handleKey);
    }, 10);

    // Écouteurs d'actions du menu contextuel
    menu.querySelectorAll('.mm-ctx-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        closeMenu();

        const action = item.getAttribute('data-action');
        switch (action) {
          case 'toggle-mode':
            this.toggleViewMode();
            break;
          case 'add-child':
            if (node) this.addChildToNode(node);
            break;
          case 'add-sibling':
            this.addSiblingToSelected();
            break;
          case 'add-boi':
            this.addChildToNode(this.tree);
            break;
          case 'edit':
            if (targetNodeId) this.startInlineEdit(targetNodeId);
            break;
          case 'scripture':
            if (targetNodeId) this.promptScriptureRef(targetNodeId);
            break;
          case 'note':
            if (targetNodeId) this.promptTopicNote(targetNodeId);
            break;
          case 'color':
            if (targetNodeId) this.promptChangeColor(targetNodeId);
            break;
          case 'copy':
            if (targetNodeId) this.copyNode(targetNodeId);
            break;
          case 'paste':
            this.pasteNode(targetNodeId || 'root');
            break;
          case 'delete':
            if (targetNodeId) this.deleteNode(targetNodeId);
            break;
          case 'fit':
            this.fitView();
            break;
          case 'palette':
            this.cyclePalette();
            break;
          case 'theme':
            this.togglePaperMode();
            break;
          case 'export-text':
            this.exportToTextNote();
            break;
          case 'help':
            this.toggleHelpDrawer(true);
            break;
        }
      });
    });
  }
};
