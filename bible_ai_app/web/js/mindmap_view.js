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
  treeStructure: 'radiant', // 'radiant' | 'right-tree' | 'top-down'
  collapsedNodes: new Set(),
  relationships: [], // [ { id, fromId, toId, label, color, customControl } ]
  connectingSourceId: null, // ID du nœud source en cours de liaison
  selectedRelId: null, // ID de la liaison sélectionnée

  // Pile d'historique Undo / Redo
  history: [],
  historyIndex: -1,
  maxHistory: 50,

  // État de glisser-déposer (Drag & Drop)
  dragState: {
    active: false,
    type: null, // 'node' | 'rel-curve'
    nodeId: null,
    node: null,
    relId: null,
    startX: 0,
    startY: 0,
    startMouseSvgX: 0,
    startMouseSvgY: 0,
    initialOffsetX: 0,
    initialOffsetY: 0,
    hasMoved: false
  },

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

  // Icônes de squelette / structure
  STRUCTURE_ICONS: {
    radiant: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor"/><line x1="9" y1="12" x2="3" y2="12"/><line x1="3" y1="8" x2="3" y2="16"/><line x1="15" y1="12" x2="21" y2="12"/><line x1="21" y1="8" x2="21" y2="16"/></svg>',
    'right-tree': '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="9" width="5" height="6" rx="1.5" fill="currentColor"/><path d="M8 12h5m0-6h6m-6 6h6m-6 6h6"/><path d="M13 6v12"/></svg>',
    'top-down': '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="5" rx="1.5" fill="currentColor"/><path d="M12 8v5m-6 0h12m-12 0v6m6-6v6m6-6v6"/></svg>'
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
            <marker id="mm-rel-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#2563eb" />
            </marker>
          </defs>
          <g id="mindmap-viewport"></g>
        </svg>

        <!-- Vue Plan (Outliner hiérarchique interactif) -->
        <div id="mindmap-outline-view" class="mindmap-outline-container hidden"></div>

        <!-- Bannière d'indication mode liaison -->
        <div id="mm-connecting-banner" class="mm-connecting-banner hidden">
          <div class="mm-connecting-badge">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 8L22 12L18 16"/><path d="M2 12H22"/></svg>
          </div>
          <span class="mm-connecting-text">Cliquez sur la branche cible pour créer la liaison (<kbd>Échap</kbd> pour annuler)</span>
          <button type="button" class="btn-icon-subtle" id="mm-btn-cancel-connecting" title="Annuler (Échap)">×</button>
        </div>

        <!-- Dock d'outils flottant minimaliste -->
        <div class="mindmap-dock">
          <button type="button" class="mm-dock-btn" id="mm-btn-toggle-outline" title="Basculer entre Vue Carte et Vue Plan (Alt+P)">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
          </button>
          <button type="button" class="mm-dock-btn" id="mm-btn-structure" title="Squelette de mise en page : Radiante, Arbre droit, Organigramme (Alt+S)">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor"/><line x1="9" y1="12" x2="3" y2="12"/><line x1="3" y1="8" x2="3" y2="16"/><line x1="15" y1="12" x2="21" y2="12"/><line x1="21" y1="8" x2="21" y2="16"/></svg>
          </button>
          <button type="button" class="mm-dock-btn" id="mm-btn-relationship" title="Créer une liaison transversale entre deux branches (Ctrl+L)">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8L22 12L18 16"/><path d="M2 12H22"/></svg>
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
          <button type="button" class="mm-dock-btn" id="mm-btn-help" title="Aide raccourcis clavier (?)">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </button>
        </div>

        <!-- Popover de sélection du squelette / structure -->
        <div class="mm-structure-popover hidden" id="mm-structure-popover">
          <div class="mm-structure-header">
            <span class="mm-structure-title">Squelette de mise en page</span>
            <span class="mm-structure-badge">Alt+S</span>
          </div>
          <div class="mm-structure-list">
            <div class="mm-structure-option active" data-structure="radiant">
              <div class="mm-struct-icon">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor"/><line x1="9" y1="12" x2="3" y2="12"/><line x1="3" y1="8" x2="3" y2="16"/><line x1="15" y1="12" x2="21" y2="12"/><line x1="21" y1="8" x2="21" y2="16"/></svg>
              </div>
              <div class="mm-struct-info">
                <div class="mm-struct-name">Pensée radiante <span class="mm-struct-check" data-for="radiant">✓</span></div>
                <div class="mm-struct-desc">Équilibrée gauche / droite (Buzan). Idéale pour le remue-méninges et les synthèses.</div>
              </div>
            </div>
            <div class="mm-structure-option" data-structure="right-tree">
              <div class="mm-struct-icon">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="9" width="5" height="6" rx="1.5" fill="currentColor"/><path d="M8 12h5m0-6h6m-6 6h6m-6 6h6"/><path d="M13 6v12"/></svg>
              </div>
              <div class="mm-struct-info">
                <div class="mm-struct-name">Arbre logique à droite <span class="mm-struct-check hidden" data-for="right-tree">✓</span></div>
                <div class="mm-struct-desc">Racine à gauche, branches à droite. Parfait pour plans d'homélie et exégèse linéaire.</div>
              </div>
            </div>
            <div class="mm-structure-option" data-structure="top-down">
              <div class="mm-struct-icon">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="3" width="6" height="5" rx="1.5" fill="currentColor"/><path d="M12 8v5m-6 0h12m-12 0v6m6-6v6m6-6v6"/></svg>
              </div>
              <div class="mm-struct-info">
                <div class="mm-struct-name">Organigramme descendant <span class="mm-struct-check hidden" data-for="top-down">✓</span></div>
                <div class="mm-struct-desc">Hiérarchie verticale descendante. Idéal pour généalogies et divisions structurelles.</div>
              </div>
            </div>
          </div>
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
              <tr><td><kbd>Alt+S</kbd></td><td><strong>Changer de squelette de mise en page</strong></td></tr>
              <tr><td><kbd>Ctrl+L</kbd></td><td><strong>Créer une liaison transversale (Relation)</strong></td></tr>
              <tr><td><kbd>Tab</kbd></td><td>Ajouter une sous-branche (Enfant)</td></tr>
              <tr><td><kbd>Entrée</kbd></td><td>Ajouter une branche voisine (Sœur)</td></tr>
              <tr><td><kbd>Espace</kbd> ou <em>Double-clic</em></td><td>Modifier le mot-clé</td></tr>
              <tr><td><kbd>F4</kbd></td><td>Ajouter / Modifier la note de branche</td></tr>
              <tr><td><kbd>Suppr</kbd> / <kbd>Retour</kbd></td><td>Supprimer la branche ou liaison sélectionnée</td></tr>
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
      if (this.connectingSourceId && !e.target.closest('.mm-node-g')) {
        this.cancelConnecting();
        return;
      }
      if (e.target === this.svg || e.target.id === 'mindmap-svg' || e.target === this.viewportG) {
        this.isPanning = true;
        this.panStart = { x: e.clientX - this.viewBox.x, y: e.clientY - this.viewBox.y };
        this.selectedNodeId = null;
        this.selectedRelId = null;
        this.updateSelectionState();
      }
    });

    window.addEventListener('mousemove', (e) => {
      // 1. Panoramique du canevas
      if (this.isPanning) {
        this.hideTooltip();
        this.viewBox.x = e.clientX - this.panStart.x;
        this.viewBox.y = e.clientY - this.panStart.y;
        this.applyTransform();
        return;
      }

      // 2. Glisser-déplacer de la courbure d'une liaison (Bézier handle)
      if (this.dragState.active && this.dragState.type === 'rel-curve') {
        this.hideTooltip();
        const rel = this.relationships.find(r => r.id === this.dragState.relId);
        if (rel && this.svg) {
          const rect = this.svg.getBoundingClientRect();
          const mouseSvgX = (e.clientX - rect.left - this.viewBox.x) / this.viewBox.scale;
          const mouseSvgY = (e.clientY - rect.top - this.viewBox.y) / this.viewBox.scale;
          rel.customControl = { x: mouseSvgX, y: mouseSvgY };
          this.dragState.hasMoved = true;
          this.drawRelationships();
        }
        return;
      }

      // 3. Glisser-déplacer visuel d'un mot-clé / branche dans l'espace (Free Positioning)
      if (this.dragState.type === 'node') {
        const dxScreen = e.clientX - this.dragState.startX;
        const dyScreen = e.clientY - this.dragState.startY;

        if (!this.dragState.active) {
          if (Math.hypot(dxScreen, dyScreen) > 4) {
            this.dragState.active = true;
            this.dragState.hasMoved = true;
            document.body.classList.add('mm-dragging-node');
          }
        }

        if (this.dragState.active && this.svg) {
          this.hideTooltip();
          const rect = this.svg.getBoundingClientRect();
          const currentMouseSvgX = (e.clientX - rect.left - this.viewBox.x) / this.viewBox.scale;
          const currentMouseSvgY = (e.clientY - rect.top - this.viewBox.y) / this.viewBox.scale;
          const deltaX = currentMouseSvgX - this.dragState.startMouseSvgX;
          const deltaY = currentMouseSvgY - this.dragState.startMouseSvgY;

          const node = this.dragState.node || this.findNode(this.dragState.nodeId);
          if (node) {
            node.offsetX = this.dragState.initialOffsetX + deltaX;
            node.offsetY = this.dragState.initialOffsetY + deltaY;
            this.layoutTree();
            this.draw();
          }
          return;
        }
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (this.isPanning) {
        this.isPanning = false;
      }

      // Fin de drag de liaison
      if (this.dragState.active && this.dragState.type === 'rel-curve') {
        if (this.dragState.hasMoved) {
          this.syncAndAutoSave();
        }
        this.dragState.active = false;
        this.dragState.type = null;
        this.dragState.relId = null;
        setTimeout(() => { this.dragState.hasMoved = false; }, 50);
        return;
      }

      // Fin de drag visuel de branche / mot-clé
      if (this.dragState.type === 'node') {
        const wasActive = this.dragState.active;
        document.body.classList.remove('mm-dragging-node');

        if (wasActive && this.dragState.hasMoved) {
          this.syncAndAutoSave();
        }

        this.dragState.active = false;
        this.dragState.type = null;
        this.dragState.nodeId = null;
        this.dragState.node = null;
        setTimeout(() => { this.dragState.hasMoved = false; }, 50);
      }
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
    document.getElementById('mm-btn-structure')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleStructurePopover();
    });
    document.getElementById('mm-btn-relationship')?.addEventListener('click', () => {
      if (this.selectedNodeId) {
        this.startConnecting(this.selectedNodeId);
      } else if (typeof App !== 'undefined' && App.showToast) {
        App.showToast('Sélectionnez d\'abord une branche à relier');
      }
    });
    document.getElementById('mm-btn-cancel-connecting')?.addEventListener('click', () => this.cancelConnecting());
    document.getElementById('mm-btn-zoom-in')?.addEventListener('click', () => this.zoom(1.2));
    document.getElementById('mm-btn-zoom-out')?.addEventListener('click', () => this.zoom(0.8));
    document.getElementById('mm-btn-fit')?.addEventListener('click', () => this.fitView());
    document.getElementById('mm-btn-theme')?.addEventListener('click', () => this.togglePaperMode());
    document.getElementById('mm-btn-palette')?.addEventListener('click', () => this.cyclePalette());
    document.getElementById('mm-btn-help')?.addEventListener('click', () => this.toggleHelpDrawer());
    document.getElementById('mm-btn-close-help')?.addEventListener('click', () => this.toggleHelpDrawer(false));

    // Options du popover de structure
    document.querySelectorAll('#mm-structure-popover .mm-structure-option').forEach(opt => {
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        const struct = opt.getAttribute('data-structure');
        if (struct) {
          this.setStructure(struct);
          this.toggleStructurePopover(false);
        }
      });
    });

    // Fermer le popover de structure lors d'un clic extérieur
    window.addEventListener('click', (e) => {
      if (!e.target.closest('#mm-structure-popover') && !e.target.closest('#mm-btn-structure')) {
        this.toggleStructurePopover(false);
      }
    });

    // 4. Raccourcis Clavier
    window.addEventListener('keydown', (e) => {
      // Ignorer si on n'est pas dans la vue Mind Map active
      const mmContainer = this.container || document.getElementById('note-mindmap-container');
      if (!mmContainer || mmContainer.classList.contains('hidden')) return;

      // Annulation du mode création de liaison (Échap)
      if (e.key === 'Escape' && this.connectingSourceId) {
        e.preventDefault();
        this.cancelConnecting();
        return;
      }

      // Bascule universelle Carte ↔ Plan (Alt+P)
      if (e.altKey && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        this.toggleViewMode();
        return;
      }

      // Changement de squelette / structure (Alt+S)
      if (e.altKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        this.cycleStructure();
        return;
      }

      // Création de liaison transversale (Ctrl+L)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'l' || e.key === 'L')) {
        e.preventDefault();
        if (this.selectedNodeId) {
          this.startConnecting(this.selectedNodeId);
        } else if (typeof App !== 'undefined' && App.showToast) {
          App.showToast('Sélectionnez d\'abord une branche à relier');
        }
        return;
      }

      // Si l'utilisateur est en train de taper dans un champ de saisie HTML
      const activeTag = document.activeElement?.tagName;
      if (['INPUT', 'TEXTAREA'].includes(activeTag)) return;

      // Annuler (Ctrl+Z) / Rétablir (Ctrl+Y ou Ctrl+Shift+Z)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (e.shiftKey) {
          this.redo();
        } else {
          this.undo();
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        this.redo();
        return;
      }

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
        if (this.selectedRelId) {
          this.deleteRelationship(this.selectedRelId);
        } else {
          this.deleteSelected();
        }
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
    // Détection de la directive de structure <!-- mindmap-layout: radiant|right-tree|top-down -->
    let structure = 'radiant';
    if (markdownContent) {
      const structMatch = markdownContent.match(/<!--\s*mindmap-layout:\s*(radiant|right-tree|top-down)\s*-->/i);
      if (structMatch) {
        structure = structMatch[1].toLowerCase();
      } else if (this.currentNote && this.currentNote.structure) {
        structure = this.currentNote.structure;
      }
    } else if (this.currentNote && this.currentNote.structure) {
      structure = this.currentNote.structure;
    }
    this.treeStructure = structure;

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
      if (!line.trim() || line.trim().startsWith('#') || line.trim().startsWith('<!-- mindmap-layout:') || line.trim().startsWith('<!-- mindmap-rel:') || line.trim().startsWith('<!-- mindmap-pos:')) continue;

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

    // Extraction des positions spatiales manuelles <!-- mindmap-pos: MOT-CLÉ | x: 45 | y: -20 -->
    if (markdownContent) {
      const posRegex = /<!--\s*mindmap-pos:\s*(.+?)\s*\|\s*x:\s*(-?\d+(?:\.\d+)?)\s*\|\s*y:\s*(-?\d+(?:\.\d+)?)\s*-->/g;
      let posMatch;
      while ((posMatch = posRegex.exec(markdownContent)) !== null) {
        const nodeText = posMatch[1].trim();
        const ox = parseFloat(posMatch[2]);
        const oy = parseFloat(posMatch[3]);
        const found = this.findNodeByText(nodeText, root);
        if (found) {
          found.offsetX = ox;
          found.offsetY = oy;
        }
      }
    }

    // Extraction des liaisons transversales <!-- mindmap-rel: SOURCE -> CIBLE | label: ... | color: ... -->
    this.relationships = [];
    if (markdownContent) {
      const relRegex = /<!--\s*mindmap-rel:\s*(.+?)\s*->\s*(.+?)(?:\s*\|\s*label:\s*(.*?))?(?:\s*\|\s*color:\s*(.*?))?(?:\s*\|\s*cx:\s*(-?\d+(?:\.\d+)?)\s*\|\s*cy:\s*(-?\d+(?:\.\d+)?))?\s*-->/g;
      let relMatch;
      while ((relMatch = relRegex.exec(markdownContent)) !== null) {
        const fromRef = relMatch[1].trim();
        const toRef = relMatch[2].trim();
        const label = relMatch[3] !== undefined ? relMatch[3].trim() : 'VOIR AUSSI';
        const color = relMatch[4] !== undefined ? relMatch[4].trim() : '';
        const cx = relMatch[5] !== undefined ? parseFloat(relMatch[5]) : null;
        const cy = relMatch[6] !== undefined ? parseFloat(relMatch[6]) : null;

        const fromNode = this.findNode(fromRef, root) || this.findNodeByText(fromRef, root);
        const toNode = this.findNode(toRef, root) || this.findNodeByText(toRef, root);

        if (fromNode && toNode && fromNode.id !== toNode.id) {
          this.relationships.push({
            id: `rel_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            fromId: fromNode.id,
            toId: toNode.id,
            label: label || 'VOIR AUSSI',
            color: color || '',
            customControl: (cx !== null && cy !== null) ? { x: cx, y: cy } : null
          });
        }
      }
    }

    return root;
  },

  treeToMarkdown(tree) {
    let md = '';
    if (this.treeStructure && this.treeStructure !== 'radiant') {
      md += `<!-- mindmap-layout: ${this.treeStructure} -->\n`;
    }
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

    // Sérialisation des positions spatiales manuelles (Free Positioning)
    const offsets = [];
    const collectOffsets = (node) => {
      if (node.id !== 'root' && (Math.round(node.offsetX || 0) !== 0 || Math.round(node.offsetY || 0) !== 0)) {
        const cleanText = node.text.replace(/\|/g, '');
        offsets.push(`<!-- mindmap-pos: ${cleanText} | x: ${Math.round(node.offsetX)} | y: ${Math.round(node.offsetY)} -->`);
      }
      if (node.children) node.children.forEach(collectOffsets);
    };
    collectOffsets(tree);

    if (offsets.length > 0) {
      md += '\n' + offsets.join('\n') + '\n';
    }

    // Sérialisation des liaisons transversales (Relations style XMind)
    if (this.relationships && this.relationships.length > 0) {
      md += '\n';
      this.relationships.forEach(rel => {
        const fromNode = this.findNode(rel.fromId, tree || this.tree);
        const toNode = this.findNode(rel.toId, tree || this.tree);
        if (fromNode && toNode) {
          const fromText = fromNode.text.replace(/\|/g, '');
          const toText = toNode.text.replace(/\|/g, '');
          const labelPart = rel.label ? ` | label: ${rel.label.replace(/\|/g, '')}` : '';
          const colorPart = rel.color ? ` | color: ${rel.color}` : '';
          const cxPart = rel.customControl ? ` | cx: ${Math.round(rel.customControl.x)} | cy: ${Math.round(rel.customControl.y)}` : '';
          md += `<!-- mindmap-rel: ${fromText} -> ${toText}${labelPart}${colorPart}${cxPart} -->\n`;
        }
      });
    }

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

    // 1. Structure 'right-tree' : Arbre logique unilatéral vers la droite
    if (this.treeStructure === 'right-tree') {
      this.tree.children.forEach((boi, index) => {
        boi.color = colors[index % colors.length];
        boi.side = 'right';
        this.propagateColorAndSide(boi, boi.color, 'right');
      });
      this.measureNode(this.tree);
      this.tree.x = 0;
      this.tree.y = 0;
      this.layoutSide(this.tree.children, 'right');
      this.applyNodeOffsets(this.tree);
      return;
    }

    // 2. Structure 'top-down' : Organigramme arborescent descendant
    if (this.treeStructure === 'top-down') {
      this.tree.children.forEach((boi, index) => {
        boi.color = colors[index % colors.length];
        boi.side = 'bottom';
        this.propagateColorAndSide(boi, boi.color, 'bottom');
      });
      this.measureTopDown(this.tree);
      this.layoutTopDown(this.tree);
      this.applyNodeOffsets(this.tree);
      return;
    }

    // 3. Structure 'radiant' (par défaut) : Pensée radiante bilatérale équilibrée (Tony Buzan)
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

    // Décalages spatiaux personnalisés (Free Positioning)
    this.applyNodeOffsets(this.tree);
  },

  applyNodeOffsets(node = this.tree, inheritedDx = 0, inheritedDy = 0) {
    if (!node) return;
    const totalDx = inheritedDx + (node.offsetX || 0);
    const totalDy = inheritedDy + (node.offsetY || 0);
    if (node.id !== 'root') {
      node.x += totalDx;
      node.y += totalDy;
    }
    if (node.children) {
      node.children.forEach(child => this.applyNodeOffsets(child, totalDx, totalDy));
    }
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

  measureTopDown(node) {
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
        refW = node.refPillWidth + 8;
      } else {
        node.refPillWidth = 0;
      }

      let noteW = 0;
      if (node.note) {
        node.notePillWidth = 18;
        noteW = 18 + 8;
      } else {
        node.notePillWidth = 0;
      }

      node.contentWidth = textW + refW + noteW;
      node.width = Math.max(76, node.contentWidth + 24);
      node.height = 28;
    }

    if (!node.children || node.children.length === 0) {
      node.totalWidth = node.width + 28; // Marge négative horizontale entre feuilles
      return;
    }

    let sum = 0;
    node.children.forEach(child => {
      this.measureTopDown(child);
      sum += child.totalWidth;
    });
    node.totalWidth = Math.max(node.width + 28, sum);
  },

  layoutTopDown(root) {
    root.x = 0;
    root.y = 0;
    this.layoutChildrenTopDown(root);
  },

  layoutChildrenTopDown(parent) {
    if (!parent.children || parent.children.length === 0) return;

    const vertGap = parent.level === 0 ? 95 : 85;
    const childY = parent.y + vertGap;

    const totalChildrenWidth = parent.children.reduce((acc, c) => acc + c.totalWidth, 0);
    let currentX = parent.x - totalChildrenWidth / 2;

    parent.children.forEach(child => {
      const centerX = currentX + child.totalWidth / 2;
      child.x = centerX;
      child.y = childY;
      child.side = 'bottom';

      this.layoutChildrenTopDown(child);
      currentX += child.totalWidth;
    });
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

    // Initialiser l'historique pour cette note
    this.history = [];
    this.historyIndex = -1;
    this.pushHistory();

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
    this.updateStructureUI();
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

    // Niveau 2 : Affichage des outils du plan dans la sous-barre
    const subbarActions = document.getElementById('notes-subbar-outline-actions');
    if (subbarActions) {
      subbarActions.classList.toggle('hidden', !isOutline);
      if (isOutline) {
        this.bindOutlineToolbarEvents();
      }
    }

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

  bindOutlineToolbarEvents() {
    const subbar = document.getElementById('notes-subbar-outline-actions');
    if (!subbar || subbar.dataset.eventsBound === 'true') return;
    subbar.dataset.eventsBound = 'true';

    subbar.querySelector('#mm-ot-btn-expand-all')?.addEventListener('click', () => this.expandAllNodes());
    subbar.querySelector('#mm-ot-btn-collapse-all')?.addEventListener('click', () => this.collapseAllNodes());
    subbar.querySelector('#mm-ot-btn-add-boi')?.addEventListener('click', () => this.addChildToNode(this.tree));
    subbar.querySelector('#mm-ot-btn-copy-md')?.addEventListener('click', () => {
      const md = this.treeToMarkdown(this.tree);
      if (navigator.clipboard) {
        navigator.clipboard.writeText(md).then(() => {
          if (typeof App !== 'undefined' && App.showToast) App.showToast('Plan Markdown copié dans le presse-papier');
        });
      }
    });
    subbar.querySelector('#mm-ot-btn-print')?.addEventListener('click', () => this.printOutline());
  },

  // =========================================================================
  // RENDU VUE PLAN / OUTLINER (Option 1 — XMind Interactive Outliner)
  // =========================================================================

  renderOutlineView() {
    const outlineEl = document.getElementById('mindmap-outline-view');
    if (!outlineEl || !this.tree) return;

    let html = `
      <!-- Zone de défilement indépendante -->
      <div class="mm-outline-scroll-area">
        <div class="mm-outline-wrapper">
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
            ${this.renderOutlineRelPills(boi.id)}
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
            ${this.renderOutlineRelPills(node.id)}
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

  renderOutlineRelPills(nodeId) {
    if (!this.relationships || this.relationships.length === 0) return '';
    const outgoing = this.relationships.filter(r => r.fromId === nodeId);
    const incoming = this.relationships.filter(r => r.toId === nodeId);
    if (outgoing.length === 0 && incoming.length === 0) return '';

    let html = '';
    outgoing.forEach(r => {
      const target = this.findNode(r.toId);
      if (target) {
        html += `
          <span class="mm-outline-rel-pill outgoing" data-action="jump-node" data-id="${target.id}" title="Liaison vers : ${this.escapeHtml(target.text)} (${this.escapeHtml(r.label || 'Liaison')})">
            <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 8L22 12L18 16"/><path d="M2 12H22"/></svg>
            <span>${this.escapeHtml(r.label || 'Liaison')} : <strong>${this.escapeHtml(target.text)}</strong></span>
          </span>
        `;
      }
    });

    incoming.forEach(r => {
      const source = this.findNode(r.fromId);
      if (source) {
        html += `
          <span class="mm-outline-rel-pill incoming" data-action="jump-node" data-id="${source.id}" title="Liaison depuis : ${this.escapeHtml(source.text)} (${this.escapeHtml(r.label || 'Liaison')})">
            <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 16L2 12L6 8"/><path d="M22 12H2"/></svg>
            <span>← ${this.escapeHtml(source.text)} (${this.escapeHtml(r.label || 'Liaison')})</span>
          </span>
        `;
      }
    });

    return html;
  },

  bindOutlineEvents(outlineEl) {
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

    // Clic sur une pastille de liaison transversale -> saut fluide vers le nœud relié
    outlineEl.querySelectorAll('.mm-outline-rel-pill[data-action="jump-node"]').forEach(pill => {
      pill.addEventListener('click', (e) => {
        e.stopPropagation();
        const targetId = pill.getAttribute('data-id');
        if (targetId) {
          const targetBlock = outlineEl.querySelector(`[data-node-id="${targetId}"]`);
          if (targetBlock) {
            targetBlock.scrollIntoView({ behavior: 'smooth', block: 'center' });
            targetBlock.classList.add('highlight-pulse');
            setTimeout(() => targetBlock.classList.remove('highlight-pulse'), 1600);
          }
        }
      });
    });

    // Actions rapides (+, verset, note, couleur, supprimer, éditer)
    outlineEl.querySelectorAll('[data-action]').forEach(btn => {
      const action = btn.getAttribute('data-action');
      const nodeId = btn.getAttribute('data-id');
      if (!nodeId || action === 'toggle-collapse' || action === 'jump-node') return;

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

  printOutline() {
    const sheet = document.querySelector('#mindmap-outline-view .mm-outline-sheet');
    if (!sheet) {
      window.print();
      return;
    }

    document.getElementById('mm-print-iframe')?.remove();

    const printClone = sheet.cloneNode(true);

    // Déplier toutes les branches pour l'impression complète
    printClone.querySelectorAll('.mm-outline-children.hidden').forEach(el => el.classList.remove('hidden'));
    printClone.querySelectorAll('.is-collapsed').forEach(el => el.classList.remove('is-collapsed'));

    // Supprimer les éléments interactifs d'interface
    printClone.querySelectorAll('.mm-outline-actions, .mm-outline-chevron, button, .btn-icon-subtle, .root-actions').forEach(el => el.remove());

    const titleText = this.tree?.text || this.currentNote?.title || 'PLAN';
    const noteRef = this.currentNote?.reference 
      ? `<div style="font-size: 11pt; color: #475569; margin-top: 4px; font-weight: 500;">Passage lié : <strong style="color: #0f172a;">${this.escapeHtml(this.currentNote.reference)}</strong></div>` 
      : '';

    const iframe = document.createElement('iframe');
    iframe.id = 'mm-print-iframe';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.visibility = 'hidden';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html lang="fr">
        <head>
          <meta charset="UTF-8">
          <title>${this.escapeHtml(titleText)} — Open Shema</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 18mm 16mm;
            }
            * {
              box-sizing: border-box;
            }
            body {
              background: #ffffff !important;
              color: #0f172a !important;
              margin: 0 !important;
              padding: 0 !important;
              font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .mm-outline-sheet {
              background: transparent !important;
              border: none !important;
              box-shadow: none !important;
              padding: 0 !important;
              margin: 0 !important;
            }
            .mm-outline-root-header {
              display: flex;
              align-items: center;
              gap: 14px;
              padding-bottom: 14px;
              margin-bottom: 20px;
              border-bottom: 2px solid #cbd5e1;
            }
            .mm-outline-root-badge {
              width: 32px;
              height: 32px;
              border-radius: 8px;
              background: #eff6ff !important;
              color: #2563eb !important;
              display: flex;
              align-items: center;
              justify-content: center;
              flex-shrink: 0;
            }
            .mm-outline-root-title {
              font-size: 18pt;
              font-weight: 800;
              color: #0f172a;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .mm-outline-tree {
              display: flex;
              flex-direction: column;
              gap: 14px;
            }
            .mm-outline-boi-block {
              background: transparent !important;
              border: none !important;
              border-left: 3.5px solid var(--boi-color, #2563eb) !important;
              padding: 2px 0 6px 14px !important;
              page-break-inside: avoid;
            }
            .mm-outline-row {
              display: flex;
              align-items: center;
              gap: 8px;
              min-height: 24px;
            }
            .mm-outline-left-col {
              display: flex;
              align-items: center;
              gap: 8px;
              flex-wrap: wrap;
            }
            .mm-outline-text.boi-text {
              font-size: 13pt;
              font-weight: 750;
              color: #0f172a;
            }
            .mm-outline-text.sub-text {
              font-size: 11pt;
              font-weight: 600;
              color: #1e293b;
            }
            .mm-outline-dot-bullet {
              width: 6px;
              height: 6px;
              border-radius: 50%;
              margin: 0 4px;
              background: currentColor;
            }
            .mm-outline-sub-bullet {
              width: 5px;
              height: 5px;
              border-radius: 50%;
              background: #64748b;
              margin: 0 5px;
            }
            .mm-outline-children {
              padding-left: 16px;
              margin-left: 6px;
              border-left: 1.5px solid #e2e8f0;
              display: flex;
              flex-direction: column;
              gap: 4px;
              margin-top: 4px;
            }
            .mm-outline-sub-block {
              page-break-inside: avoid;
            }
            .mm-outline-ref-pill {
              display: inline-flex;
              align-items: center;
              gap: 4px;
              padding: 1px 7px;
              border-radius: 4px;
              font-size: 9.5pt;
              font-weight: 600;
              background: #eff6ff !important;
              color: #1e40af !important;
              border: 1px solid #bfdbfe !important;
            }
            .mm-outline-ref-pill svg {
              display: none;
            }
            .mm-outline-note-badge {
              display: none;
            }
            .mm-outline-note-card {
              margin: 4px 0 6px 14px;
              padding: 6px 10px;
              border-radius: 5px;
              background: #fffbeb !important;
              border-left: 3px solid #f59e0b !important;
              font-size: 10pt;
              line-height: 1.45;
              color: #78350f !important;
            }
            .mm-outline-note-card svg {
              color: #d97706;
              width: 12px;
              height: 12px;
              flex-shrink: 0;
            }
          </style>
        </head>
        <body>
          <div class="mm-outline-sheet">
            ${noteRef ? `<div style="margin-bottom: 12px;">${noteRef}</div>` : ''}
            ${printClone.innerHTML}
          </div>
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (err) {
        console.error("Erreur impression iframe :", err);
      }
      setTimeout(() => iframe.remove(), 2500);
    }, 250);
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

    // 2. Dessiner les liaisons transversales inter-branches (Relations style XMind)
    this.drawRelationships();

    // 3. Dessiner tous les nœuds (textes, boutons contextuels)
    this.drawNodes(this.tree);
  },

  drawBranches(node) {
    if (!node.children) return;

    node.children.forEach(child => {
      const isRoot = node.level === 0;

      if (this.treeStructure === 'top-down') {
        const x1 = node.x;
        const y1 = isRoot ? node.y + node.height / 2 : node.y + 10;
        const x2 = child.x;
        const y2 = child.y + 10;

        const dy = Math.abs(y2 - y1);
        const cx1 = x1;
        const cy1 = y1 + dy * 0.5;
        const cx2 = x2;
        const cy2 = y2 - dy * 0.5;

        const strokeWidth = isRoot ? 5.2 : Math.max(2, 4.0 - child.level * 0.6);

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', child.color || 'var(--text-secondary)');
        path.setAttribute('stroke-width', strokeWidth);
        path.setAttribute('stroke-linecap', 'round');
        path.classList.add('mm-branch-path');
        this.viewportG.appendChild(path);

        // Trait de soulignement sous le mot (centré horizontalement sous le mot-clé)
        const underX1 = child.x - child.width / 2;
        const underX2 = child.x + child.width / 2;
        const underline = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        underline.setAttribute('x1', underX1);
        underline.setAttribute('y1', child.y + 10);
        underline.setAttribute('x2', underX2);
        underline.setAttribute('y2', child.y + 10);
        underline.setAttribute('stroke', child.color || 'var(--text-secondary)');
        underline.setAttribute('stroke-width', Math.max(1.8, strokeWidth * 0.6));
        underline.setAttribute('stroke-linecap', 'round');
        this.viewportG.appendChild(underline);

      } else {
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
      }

      this.drawBranches(child);
    });
  },

  drawNodes(node) {
    const isRoot = node.level === 0;
    const isSelected = this.selectedNodeId === node.id;
    const isConnectingSource = this.connectingSourceId === node.id;
    const isTopDown = this.treeStructure === 'top-down';

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', `mm-node-g ${isRoot ? 'mm-root-node' : ''} ${isSelected ? 'selected' : ''} ${isConnectingSource ? 'connecting-source' : ''}`);
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
      const plusX = isTopDown ? 0 : node.width / 2 + 16;
      const plusY = isTopDown ? node.height / 2 + 16 : 0;
      const plusBtn = this.createActionButton('+', plusX, plusY, () => this.addChildToNode(node));
      plusBtn.setAttribute('title', 'Ajouter une idée directrice majeure (BOI)');
      plusBtn.classList.add('mm-root-plus');
      g.appendChild(plusBtn);

    } else {
      // Zone réceptive continue invisible (évite la disparition des boutons entre le mot et les boutons)
      const hitRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      const hitW = node.width + 65;
      const hitX = isTopDown ? -node.width / 2 - 5 : (node.side === 'right' ? -node.width / 2 - 5 : -node.width / 2 - 55);
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

      if (isTopDown) {
        const startX = -(node.contentWidth || textW) / 2;
        text.setAttribute('text-anchor', 'start');
        text.setAttribute('x', startX);
        badgeX = startX + textW + 8;
      } else if (node.side === 'right') {
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
        const refX = (isTopDown || node.side === 'right') ? badgeX + pillW / 2 : badgeX - pillW / 2;
        if (isTopDown || node.side === 'right') {
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
        const noteX = (isTopDown || node.side === 'right') ? badgeX + 9 : badgeX - 9;
        if (isTopDown || node.side === 'right') {
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

      const endX = (isTopDown || node.side === 'right') ? node.width / 2 + 14 : -node.width / 2 - 14;
      const addSubBtn = this.createActionButton('+', endX, 3, () => this.addChildToNode(node));
      addSubBtn.setAttribute('title', 'Ajouter une sous-branche');

      const delX = (isTopDown || node.side === 'right') ? node.width / 2 + 34 : -node.width / 2 - 34;
      const delBtn = this.createActionButton('×', delX, 3, () => this.deleteNode(node.id), true);
      delBtn.setAttribute('title', 'Supprimer la branche');

      actionsG.appendChild(addSubBtn);
      actionsG.appendChild(delBtn);
      g.appendChild(actionsG);
    }

    // Initialisation du glisser-déplacer spatial pour les branches (non-root)
    if (!isRoot) {
      g.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return; // Clic gauche uniquement
        if (this.connectingSourceId) return; // Priorité au mode création de liaison
        if (e.target.closest('.mm-action-btn, .mm-scripture-pill, .mm-note-pill')) return;

        const rect = this.svg.getBoundingClientRect();
        const mouseSvgX = (e.clientX - rect.left - this.viewBox.x) / this.viewBox.scale;
        const mouseSvgY = (e.clientY - rect.top - this.viewBox.y) / this.viewBox.scale;

        this.dragState = {
          active: false,
          type: 'node',
          nodeId: node.id,
          node: node,
          startX: e.clientX,
          startY: e.clientY,
          startMouseSvgX: mouseSvgX,
          startMouseSvgY: mouseSvgY,
          initialOffsetX: node.offsetX || 0,
          initialOffsetY: node.offsetY || 0,
          hasMoved: false
        };
      });
    }

    // Gestion de la sélection et de l'édition directe
    g.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.dragState.hasMoved) return; // Ignorer le clic consécutif à un glisser-déposer
      if (this.connectingSourceId) {
        this.finishConnecting(node.id);
        return;
      }
      this.selectNode(node.id);
    });

    g.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      if (this.dragState.hasMoved) return;
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
    this.selectedRelId = null;
    this.updateSelectionState();
  },

  updateSelectionState() {
    this.viewportG?.querySelectorAll('.mm-node-g').forEach(el => {
      el.classList.toggle('selected', el.getAttribute('data-id') === this.selectedNodeId);
    });
    this.viewportG?.querySelectorAll('.mm-relationship-g').forEach(el => {
      el.classList.toggle('selected', el.getAttribute('data-rel-id') === this.selectedRelId);
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

  findNodeByText(text, current = this.tree) {
    if (!current || !text) return null;
    const clean = text.trim().toUpperCase();
    if (current.text && current.text.trim().toUpperCase() === clean) return current;
    if (!current.children) return null;
    for (const child of current.children) {
      const found = this.findNodeByText(text, child);
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

    // Collecter les IDs du nœud et de ses descendants pour purger les liaisons rattachées
    const deletedIds = new Set();
    const collectIds = (n) => {
      if (!n) return;
      deletedIds.add(n.id);
      if (n.children) n.children.forEach(collectIds);
    };
    const nodeToDelete = this.findNode(id);
    if (nodeToDelete) collectIds(nodeToDelete);

    parent.children = parent.children.filter(c => c.id !== id);
    this.selectedNodeId = parent.id;

    if (this.relationships && this.relationships.length > 0) {
      this.relationships = this.relationships.filter(r => !deletedIds.has(r.fromId) && !deletedIds.has(r.toId));
    }

    this.layoutTree();
    if (this.viewMode === 'outline') {
      this.renderOutlineView();
    } else {
      this.draw();
      this.updateSelectionState();
    }
    this.syncAndAutoSave();
  },

  isDescendant(ancestorId, candidateId) {
    if (!ancestorId || !candidateId) return false;
    if (ancestorId === candidateId) return true;
    const ancestor = this.findNode(ancestorId);
    if (!ancestor || !ancestor.children) return false;
    return !!this.findNode(candidateId, ancestor);
  },

  countDescendants(node) {
    if (!node || !node.children) return 0;
    let count = node.children.length;
    for (const child of node.children) {
      count += this.countDescendants(child);
    }
    return count;
  },

  reparentNode(draggedId, newParentId) {
    if (!draggedId || !newParentId || draggedId === 'root') return false;
    if (draggedId === newParentId) return false;
    if (this.isDescendant(draggedId, newParentId)) {
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast('Impossible de déplacer une branche dans sa propre sous-arborescence');
      }
      return false;
    }

    const currentParent = this.findParent(draggedId);
    if (!currentParent) return false;
    if (currentParent.id === newParentId) return false;

    const draggedNode = this.findNode(draggedId);
    if (!draggedNode) return false;

    const newParent = this.findNode(newParentId);
    if (!newParent) return false;

    // Retirer de l'ancien parent
    currentParent.children = currentParent.children.filter(c => c.id !== draggedId);

    // Attacher au nouveau parent
    newParent.children = newParent.children || [];
    newParent.children.push(draggedNode);

    // Mettre à jour les niveaux de profondeur
    const updateLevel = (n, lvl) => {
      n.level = lvl;
      if (n.children) {
        n.children.forEach(c => updateLevel(c, lvl + 1));
      }
    };
    updateLevel(draggedNode, newParent.level + 1);

    this.selectedNodeId = draggedId;
    this.layoutTree();
    if (this.viewMode === 'outline') {
      this.renderOutlineView();
    } else {
      this.draw();
      this.updateSelectionState();
    }
    this.syncAndAutoSave();

    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast(`Branche « ${draggedNode.text} » rattachée à « ${newParent.text} »`);
    }
    return true;
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
      let textX;
      if (this.treeStructure === 'top-down') {
        textX = node.x - (node.contentWidth || textW) / 2;
      } else {
        textX = node.side === 'right' ? node.x - node.width / 2 + 10 : node.x + node.width / 2 - 10 - textW;
      }
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
        this.selectNode(nodeId);
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

    if (this.treeStructure === 'top-down') {
      if (key === 'ArrowDown') {
        if (current.children && current.children.length > 0) {
          const midIdx = Math.floor(current.children.length / 2);
          this.selectNode(current.children[midIdx].id);
        }
      } else if (key === 'ArrowUp') {
        if (parent) {
          this.selectNode(parent.id);
        }
      } else if (key === 'ArrowLeft' || key === 'ArrowRight') {
        if (parent && parent.children) {
          const idx = parent.children.findIndex(c => c.id === current.id);
          const nextIdx = key === 'ArrowLeft' ? idx - 1 : idx + 1;
          if (nextIdx >= 0 && nextIdx < parent.children.length) {
            this.selectNode(parent.children[nextIdx].id);
          }
        }
      }
      return;
    }

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
    if (this.treeStructure === 'top-down') {
      this.viewBox.x = rect.width / 2;
      this.viewBox.y = Math.max(90, rect.height * 0.22);
    } else if (this.treeStructure === 'right-tree') {
      this.viewBox.x = Math.max(140, rect.width * 0.22);
      this.viewBox.y = rect.height / 2;
    } else {
      this.viewBox.x = rect.width / 2;
      this.viewBox.y = rect.height / 2;
    }
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

  syncAndAutoSave(recordHistory = true) {
    if (!this.currentNote) return;

    const newMdContent = this.treeToMarkdown(this.tree);
    this.currentNote.content = newMdContent;
    this.currentNote.type = 'mindmap';

    if (recordHistory) {
      this.pushHistory();
    }

    if (typeof NotesView !== 'undefined' && NotesView.triggerAutoSave) {
      NotesView.triggerAutoSave();
    }
  },

  pushHistory() {
    if (!this.tree) return;
    const md = this.treeToMarkdown(this.tree);

    // Éviter d'empiler des états identiques consécutifs
    if (this.historyIndex >= 0 && this.history[this.historyIndex] === md) {
      return;
    }

    // Si on a annulé puis fait une modification, tronquer le futur
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }

    this.history.push(md);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    } else {
      this.historyIndex++;
    }
  },

  undo() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      const md = this.history[this.historyIndex];
      this.tree = this.parseMarkdownToTree(this.currentNote?.title, md);
      this.layoutTree();
      this.draw();
      this.updateSelectionState();
      this.syncAndAutoSave(false);
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast('↶ Annulé (Ctrl+Z)');
      }
    } else {
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast('Début de l\'historique atteint');
      }
    }
  },

  redo() {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      const md = this.history[this.historyIndex];
      this.tree = this.parseMarkdownToTree(this.currentNote?.title, md);
      this.layoutTree();
      this.draw();
      this.updateSelectionState();
      this.syncAndAutoSave(false);
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast('↷ Rétabli (Ctrl+Y)');
      }
    } else {
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast('Fin de l\'historique atteinte');
      }
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
  // SÉLECTION D'UN PASSAGE / VERSET BIBLIQUE (Style Sélecteur Logos / BookPicker)
  // =========================================================================

  promptScriptureRef(nodeId) {
    const node = this.findNode(nodeId);
    if (!node) return;

    let initialBook = 'Gen';
    let initialChapter = 1;

    if (node.ref && typeof BookPicker !== 'undefined' && typeof BookPicker.parseQuickPassage === 'function') {
      const parsed = BookPicker.parseQuickPassage(node.ref);
      if (parsed && parsed.bookCode) {
        initialBook = parsed.bookCode;
        if (parsed.chapter) initialChapter = parsed.chapter;
      }
    } else if (typeof BibleReader !== 'undefined' && BibleReader.currentBook) {
      initialBook = BibleReader.currentBook;
      initialChapter = BibleReader.currentChapter || 1;
    }

    if (typeof BookPicker !== 'undefined') {
      BookPicker.open(initialBook, initialChapter, (bCode, chNum, vNum = null) => {
        if (!bCode) {
          node.ref = '';
        } else {
          const book = (BookPicker.booksData || []).find(b => b.code.toLowerCase() === bCode.toLowerCase());
          const bookName = book ? book.name : bCode;
          node.ref = vNum ? `${bookName} ${chNum}:${vNum}` : `${bookName} ${chNum}`;
        }
        this.refreshView();
        this.syncAndAutoSave();
      }, {
        center: true,
        allowClear: !!node.ref,
        targetLabel: node.text,
        initialQuery: node.ref || ''
      });
    }
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
        <div class="mm-ctx-item" data-action="relationship">
          <span class="mm-ctx-icon">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8L22 12L18 16"/><path d="M2 12H22"/></svg>
          </span>
          <span class="mm-ctx-label">Créer une liaison</span>
          <span class="mm-ctx-shortcut">Ctrl+L</span>
        </div>
        <div class="mm-ctx-item" data-action="color">
          <span class="mm-ctx-icon">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>
          </span>
          <span class="mm-ctx-label">Changer la couleur</span>
        </div>
        ${(node?.offsetX || node?.offsetY) ? `
          <div class="mm-ctx-item" data-action="reset-position">
            <span class="mm-ctx-icon">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/></svg>
            </span>
            <span class="mm-ctx-label">Réinitialiser la position</span>
          </div>
        ` : ''}
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
        <div class="mm-ctx-divider"></div>
        <div class="mm-ctx-item" data-action="structure-radiant">
          <span class="mm-ctx-icon">${this.STRUCTURE_ICONS.radiant}</span>
          <span class="mm-ctx-label">Pensée radiante (Buzan)</span>
          ${this.treeStructure === 'radiant' ? '<span class="mm-ctx-shortcut">✓</span>' : ''}
        </div>
        <div class="mm-ctx-item" data-action="structure-right-tree">
          <span class="mm-ctx-icon">${this.STRUCTURE_ICONS['right-tree']}</span>
          <span class="mm-ctx-label">Arbre logique à droite</span>
          ${this.treeStructure === 'right-tree' ? '<span class="mm-ctx-shortcut">✓</span>' : ''}
        </div>
        <div class="mm-ctx-item" data-action="structure-top-down">
          <span class="mm-ctx-icon">${this.STRUCTURE_ICONS['top-down']}</span>
          <span class="mm-ctx-label">Organigramme descendant</span>
          ${this.treeStructure === 'top-down' ? '<span class="mm-ctx-shortcut">✓</span>' : ''}
        </div>
        <div class="mm-ctx-divider"></div>
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
        <div class="mm-ctx-divider"></div>
        <div class="mm-ctx-item" data-action="structure-radiant">
          <span class="mm-ctx-icon">${this.STRUCTURE_ICONS.radiant}</span>
          <span class="mm-ctx-label">Pensée radiante (Buzan)</span>
          ${this.treeStructure === 'radiant' ? '<span class="mm-ctx-shortcut">✓</span>' : ''}
        </div>
        <div class="mm-ctx-item" data-action="structure-right-tree">
          <span class="mm-ctx-icon">${this.STRUCTURE_ICONS['right-tree']}</span>
          <span class="mm-ctx-label">Arbre logique à droite</span>
          ${this.treeStructure === 'right-tree' ? '<span class="mm-ctx-shortcut">✓</span>' : ''}
        </div>
        <div class="mm-ctx-item" data-action="structure-top-down">
          <span class="mm-ctx-icon">${this.STRUCTURE_ICONS['top-down']}</span>
          <span class="mm-ctx-label">Organigramme descendant</span>
          ${this.treeStructure === 'top-down' ? '<span class="mm-ctx-shortcut">✓</span>' : ''}
        </div>
        <div class="mm-ctx-divider"></div>
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
          case 'structure-radiant':
            this.setStructure('radiant');
            break;
          case 'structure-right-tree':
            this.setStructure('right-tree');
            break;
          case 'structure-top-down':
            this.setStructure('top-down');
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
          case 'relationship':
            if (targetNodeId) this.startConnecting(targetNodeId);
            break;
          case 'color':
            if (targetNodeId) this.promptChangeColor(targetNodeId);
            break;
          case 'reset-position':
            if (node) {
              node.offsetX = 0;
              node.offsetY = 0;
              this.layoutTree();
              this.draw();
              this.syncAndAutoSave();
              if (typeof App !== 'undefined' && App.showToast) {
                App.showToast('Position réinitialisée');
              }
            }
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
  },

  setStructure(structureName) {
    if (!['radiant', 'right-tree', 'top-down'].includes(structureName)) return;
    this.treeStructure = structureName;
    if (this.currentNote) {
      this.currentNote.structure = structureName;
    }
    this.layoutTree();
    if (this.viewMode === 'map') {
      this.draw();
      this.fitView();
    }
    this.updateStructureUI();
    this.syncAndAutoSave();

    if (typeof App !== 'undefined' && App.showToast) {
      const labels = {
        'radiant': 'Squelette : Pensée radiante (Buzan bilatérale)',
        'right-tree': 'Squelette : Arbre logique à droite',
        'top-down': 'Squelette : Organigramme descendant'
      };
      App.showToast(labels[structureName] || `Structure : ${structureName}`);
    }
  },

  cycleStructure() {
    const structures = ['radiant', 'right-tree', 'top-down'];
    const curIdx = structures.indexOf(this.treeStructure || 'radiant');
    const next = structures[(curIdx + 1) % structures.length];
    this.setStructure(next);
  },

  toggleStructurePopover(force = null) {
    const popover = document.getElementById('mm-structure-popover');
    if (!popover) return;
    const isHidden = popover.classList.contains('hidden');
    const shouldOpen = force !== null ? force : isHidden;
    popover.classList.toggle('hidden', !shouldOpen);
    if (shouldOpen) {
      this.updateStructureUI();
    }
  },

  updateStructureUI() {
    const struct = this.treeStructure || 'radiant';

    // 1. Bouton du dock flottant
    const dockBtn = document.getElementById('mm-btn-structure');
    if (dockBtn) {
      dockBtn.innerHTML = this.STRUCTURE_ICONS[struct] || this.STRUCTURE_ICONS.radiant;
      const labels = {
        'radiant': 'Squelette : Pensée radiante (Alt+S)',
        'right-tree': 'Squelette : Arbre logique à droite (Alt+S)',
        'top-down': 'Squelette : Organigramme descendant (Alt+S)'
      };
      dockBtn.title = labels[struct] || 'Squelette de mise en page (Alt+S)';
    }

    // 2. Options du popover
    const popover = document.getElementById('mm-structure-popover');
    if (popover) {
      popover.querySelectorAll('.mm-structure-option').forEach(opt => {
        const optStruct = opt.getAttribute('data-structure');
        const isActive = optStruct === struct;
        opt.classList.toggle('active', isActive);
        const check = opt.querySelector('.mm-struct-check');
        if (check) check.classList.toggle('hidden', !isActive);
      });
    }
  },

  // =========================================================================
  // LIAISONS TRANSVERSALES (RELATIONSHIPS STYLE XMIND)
  // =========================================================================

  getNodeConnectionPoint(node, targetPoint) {
    if (!node) return { x: 0, y: 0 };
    if (node.id === 'root') {
      const dx = targetPoint.x - (node.x || 0);
      const dy = targetPoint.y - (node.y || 0);
      if (this.treeStructure === 'top-down') {
        return dy >= 0 ? { x: node.x || 0, y: (node.y || 0) + (node.height || 46) / 2 } : { x: node.x || 0, y: (node.y || 0) - (node.height || 46) / 2 };
      }
      return dx >= 0 ? { x: (node.x || 0) + (node.width || 120) / 2, y: node.y || 0 } : { x: (node.x || 0) - (node.width || 120) / 2, y: node.y || 0 };
    }

    if (this.treeStructure === 'top-down') {
      if (targetPoint.y >= node.y) {
        return { x: node.x, y: node.y + 12 };
      } else {
        return { x: node.x, y: node.y - 12 };
      }
    }

    // Structure Radiant ou Right-tree
    const halfW = (node.width || 80) / 2;
    if (targetPoint.x >= node.x) {
      return { x: node.x + halfW, y: node.y + 3 };
    } else {
      return { x: node.x - halfW, y: node.y + 3 };
    }
  },

  drawRelationships() {
    if (!this.relationships || this.relationships.length === 0 || !this.viewportG) return;

    // Calque dédié pour les liaisons
    let relsLayer = this.viewportG.querySelector('#mm-relationships-layer');
    if (!relsLayer) {
      relsLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      relsLayer.setAttribute('id', 'mm-relationships-layer');
      this.viewportG.appendChild(relsLayer);
    } else {
      relsLayer.innerHTML = '';
    }

    this.relationships.forEach(rel => {
      const fromNode = this.findNode(rel.fromId);
      const toNode = this.findNode(rel.toId);
      if (!fromNode || !toNode) return;

      const p1 = this.getNodeConnectionPoint(fromNode, { x: toNode.x, y: toNode.y });
      const p2 = this.getNodeConnectionPoint(toNode, { x: fromNode.x, y: fromNode.y });

      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;

      // Normale perpendiculaire
      const nx = -dy / dist;
      const ny = dx / dist;

      // Courbure douce et élégante
      const curvature = Math.min(85, Math.max(30, dist * 0.2));
      let cx = (p1.x + p2.x) / 2 + nx * curvature;
      let cy = (p1.y + p2.y) / 2 + ny * curvature;

      if (rel.customControl) {
        cx = rel.customControl.x;
        cy = rel.customControl.y;
      }

      // Milieu exact sur la courbe quadratique de Bézier (t = 0.5)
      const lx = 0.25 * p1.x + 0.5 * cx + 0.25 * p2.x;
      const ly = 0.25 * p1.y + 0.5 * cy + 0.25 * p2.y;

      const pathData = `M ${p1.x} ${p1.y} Q ${cx} ${cy}, ${p2.x} ${p2.y}`;
      const isSelected = this.selectedRelId === rel.id;
      const relColor = rel.color || fromNode.color || '#2563eb';

      const relG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      relG.setAttribute('class', `mm-relationship-g ${isSelected ? 'selected' : ''}`);
      relG.setAttribute('data-rel-id', rel.id);

      // Trait transparent pour zone de clic et glisser-déplacer aérée
      const hitPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      hitPath.setAttribute('d', pathData);
      hitPath.setAttribute('stroke', 'transparent');
      hitPath.setAttribute('stroke-width', '18');
      hitPath.setAttribute('fill', 'none');
      hitPath.setAttribute('class', 'mm-rel-hit-path');
      hitPath.setAttribute('style', 'cursor: pointer;');

      // Possibilité de glisser directement le fil de liaison pour courber
      hitPath.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        e.preventDefault();
        this.selectRelationship(rel.id);
        this.dragState = {
          active: true,
          type: 'rel-curve',
          nodeId: null,
          relId: rel.id,
          startX: e.clientX,
          startY: e.clientY,
          hasMoved: false,
          targetNodeId: null
        };
      });

      relG.appendChild(hitPath);

      // Courbe tiretée noble avec flèche terminale
      const visiblePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      visiblePath.setAttribute('d', pathData);
      visiblePath.setAttribute('stroke', relColor);
      visiblePath.setAttribute('stroke-width', isSelected ? '2.8' : '2');
      visiblePath.setAttribute('stroke-dasharray', '6,4');
      visiblePath.setAttribute('fill', 'none');
      visiblePath.setAttribute('marker-end', 'url(#mm-rel-arrow)');
      visiblePath.setAttribute('class', 'mm-rel-visible-path');
      relG.appendChild(visiblePath);

      // Poignée de contrôle interactive de la courbure Bézier (style XMind)
      // UNIQUEMENT visible lorsque la liaison est sélectionnée
      if (isSelected) {
        const handleCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        handleCircle.setAttribute('cx', cx);
        handleCircle.setAttribute('cy', cy);
        handleCircle.setAttribute('r', '6.5');
        handleCircle.setAttribute('class', 'mm-rel-handle');
        handleCircle.setAttribute('fill', relColor);
        handleCircle.setAttribute('stroke', '#ffffff');
        handleCircle.setAttribute('stroke-width', '2');
        handleCircle.setAttribute('title', 'Glisser pour ajuster la courbure (Double-clic pour réinitialiser)');

        handleCircle.addEventListener('mousedown', (e) => {
          if (e.button !== 0) return;
          e.stopPropagation();
          e.preventDefault();
          this.selectRelationship(rel.id);
          this.dragState = {
            active: true,
            type: 'rel-curve',
            nodeId: null,
            relId: rel.id,
            startX: e.clientX,
            startY: e.clientY,
            hasMoved: false,
            targetNodeId: null
          };
        });

        handleCircle.addEventListener('dblclick', (e) => {
          e.stopPropagation();
          e.preventDefault();
          rel.customControl = null;
          this.drawRelationships();
          this.syncAndAutoSave();
          if (typeof App !== 'undefined' && App.showToast) {
            App.showToast('Courbure de la liaison réinitialisée');
          }
        });

        relG.appendChild(handleCircle);
      }

      // Étiquette flottante centrale
      const labelText = (rel.label || 'VOIR AUSSI').toUpperCase();
      const textW = this.getTextWidth(labelText, 9.5, '700');
      const pillW = Math.max(54, textW + 18);
      const pillH = 20;

      const labelG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      labelG.setAttribute('transform', `translate(${lx}, ${ly})`);
      labelG.setAttribute('class', 'mm-rel-label-g');

      const pillRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      pillRect.setAttribute('x', -pillW / 2);
      pillRect.setAttribute('y', -pillH / 2);
      pillRect.setAttribute('width', pillW);
      pillRect.setAttribute('height', pillH);
      pillRect.setAttribute('rx', 10);
      pillRect.setAttribute('class', 'mm-rel-label-rect');
      labelG.appendChild(pillRect);

      const labelT = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      labelT.setAttribute('text-anchor', 'middle');
      labelT.setAttribute('dominant-baseline', 'central');
      labelT.setAttribute('class', 'mm-rel-label-text');
      labelT.textContent = labelText;
      labelG.appendChild(labelT);

      // Bouton contextuel × au survol
      const delBtnG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      delBtnG.setAttribute('transform', `translate(${pillW / 2 + 8}, 0)`);
      delBtnG.setAttribute('class', 'mm-rel-del-btn');
      delBtnG.setAttribute('title', 'Supprimer cette liaison');

      const delCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      delCircle.setAttribute('r', 7.5);
      delCircle.setAttribute('class', 'mm-rel-del-circle');
      delBtnG.appendChild(delCircle);

      const delXText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      delXText.setAttribute('text-anchor', 'middle');
      delXText.setAttribute('dominant-baseline', 'central');
      delXText.setAttribute('class', 'mm-rel-del-text');
      delXText.setAttribute('y', -0.5);
      delXText.textContent = '×';
      delBtnG.appendChild(delXText);

      delBtnG.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteRelationship(rel.id);
      });
      labelG.appendChild(delBtnG);

      // Événements
      relG.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.dragState.hasMoved) return;
        this.selectRelationship(rel.id);
      });

      labelG.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        this.promptEditRelationshipLabel(rel.id);
      });

      relG.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.selectRelationship(rel.id);
        this.promptEditRelationshipLabel(rel.id);
      });

      relG.appendChild(labelG);
      relsLayer.appendChild(relG);
    });
  },

  selectRelationship(relId) {
    this.selectedRelId = relId;
    this.selectedNodeId = null;
    this.updateSelectionState();
    this.viewportG?.querySelectorAll('.mm-relationship-g').forEach(el => {
      el.classList.toggle('selected', el.getAttribute('data-rel-id') === relId);
    });
  },

  deleteRelationship(relId) {
    if (!this.relationships) return;
    this.relationships = this.relationships.filter(r => r.id !== relId);
    if (this.selectedRelId === relId) this.selectedRelId = null;
    this.draw();
    this.syncAndAutoSave();
    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast('Liaison supprimée');
    }
  },

  startConnecting(sourceId) {
    const node = this.findNode(sourceId);
    if (!node) return;

    this.connectingSourceId = sourceId;
    this.selectedRelId = null;

    const banner = document.getElementById('mm-connecting-banner');
    if (banner) {
      const textEl = banner.querySelector('.mm-connecting-text');
      if (textEl) {
        textEl.innerHTML = `Relier <strong>« ${this.escapeHtml(node.text)} »</strong> à... (<kbd>Échap</kbd> pour annuler)`;
      }
      banner.classList.remove('hidden');
    }

    this.svg?.classList.add('mm-connecting-mode');

    // Mettre en évidence la branche source
    this.viewportG?.querySelectorAll('.mm-node-g').forEach(el => {
      el.classList.toggle('connecting-source', el.getAttribute('data-id') === sourceId);
    });

    // Créer le calque / élément de prévisualisation de liaison interactive en direct
    let previewLayer = this.viewportG?.querySelector('#mm-connecting-preview-group');
    if (!previewLayer && this.viewportG) {
      previewLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      previewLayer.setAttribute('id', 'mm-connecting-preview-group');
      const previewPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      previewPath.setAttribute('id', 'mm-connecting-preview-path');
      previewPath.setAttribute('class', 'mm-rel-preview-path');
      previewPath.setAttribute('fill', 'none');
      previewPath.setAttribute('stroke', node.color || 'var(--accent-blue, #2563eb)');
      previewPath.setAttribute('stroke-width', '2.5');
      previewPath.setAttribute('stroke-dasharray', '6,4');
      previewPath.setAttribute('marker-end', 'url(#mm-rel-arrow)');
      previewLayer.appendChild(previewPath);
      this.viewportG.appendChild(previewLayer);
    }

    // Écouteur de mouvement de la souris pour la flèche en direct
    if (this._onConnectingMouseMove) {
      window.removeEventListener('mousemove', this._onConnectingMouseMove);
    }

    this._onConnectingMouseMove = (e) => {
      if (!this.connectingSourceId || !this.svg) return;
      const rect = this.svg.getBoundingClientRect();
      const mouseSvgX = (e.clientX - rect.left - this.viewBox.x) / this.viewBox.scale;
      const mouseSvgY = (e.clientY - rect.top - this.viewBox.y) / this.viewBox.scale;

      const srcNode = this.findNode(this.connectingSourceId);
      if (!srcNode) return;

      // Détecter si on survole une branche cible candidate
      let hoveredNode = null;
      const elementUnderCursor = document.elementFromPoint(e.clientX, e.clientY);
      const nodeEl = elementUnderCursor?.closest('.mm-node-g');
      if (nodeEl) {
        const nid = nodeEl.getAttribute('data-id');
        if (nid && nid !== this.connectingSourceId) {
          hoveredNode = this.findNode(nid);
        }
      }

      this.viewportG?.querySelectorAll('.mm-node-g').forEach(el => {
        const nid = el.getAttribute('data-id');
        el.classList.toggle('connecting-target', !!(hoveredNode && nid === hoveredNode.id));
      });

      let targetPt = { x: mouseSvgX, y: mouseSvgY };
      if (hoveredNode) {
        targetPt = this.getNodeConnectionPoint(hoveredNode, { x: srcNode.x, y: srcNode.y });
      }

      const p1 = this.getNodeConnectionPoint(srcNode, targetPt);
      const p2 = targetPt;

      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;

      const nx = -dy / dist;
      const ny = dx / dist;
      const curvature = Math.min(85, Math.max(25, dist * 0.2));
      const cx = (p1.x + p2.x) / 2 + nx * curvature;
      const cy = (p1.y + p2.y) / 2 + ny * curvature;

      const previewPath = document.getElementById('mm-connecting-preview-path');
      if (previewPath) {
        previewPath.setAttribute('d', `M ${p1.x} ${p1.y} Q ${cx} ${cy}, ${p2.x} ${p2.y}`);
      }
    };

    window.addEventListener('mousemove', this._onConnectingMouseMove);

    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast('Pointez et cliquez sur la branche cible pour créer la liaison');
    }
  },

  cancelConnecting() {
    this.connectingSourceId = null;
    if (this._onConnectingMouseMove) {
      window.removeEventListener('mousemove', this._onConnectingMouseMove);
      this._onConnectingMouseMove = null;
    }
    document.getElementById('mm-connecting-preview-group')?.remove();

    const banner = document.getElementById('mm-connecting-banner');
    if (banner) banner.classList.add('hidden');
    this.svg?.classList.remove('mm-connecting-mode');
    this.viewportG?.querySelectorAll('.mm-node-g').forEach(el => {
      el.classList.remove('connecting-source');
      el.classList.remove('connecting-target');
    });
  },

  finishConnecting(targetId) {
    if (!this.connectingSourceId) return;

    if (targetId === this.connectingSourceId) {
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast('Impossible de relier une branche à elle-même');
      }
      this.cancelConnecting();
      return;
    }

    const exists = this.relationships.some(r =>
      (r.fromId === this.connectingSourceId && r.toId === targetId) ||
      (r.fromId === targetId && r.toId === this.connectingSourceId)
    );

    if (exists) {
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast('Une liaison existe déjà entre ces deux branches');
      }
      this.cancelConnecting();
      return;
    }

    const fromNode = this.findNode(this.connectingSourceId);
    const toNode = this.findNode(targetId);

    const newRel = {
      id: `rel_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      fromId: this.connectingSourceId,
      toId: targetId,
      label: 'VOIR AUSSI',
      color: fromNode?.color || '#2563eb'
    };

    this.relationships.push(newRel);
    const createdId = newRel.id;
    this.cancelConnecting();
    this.selectedRelId = createdId;
    this.draw();
    this.syncAndAutoSave();

    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast(`Liaison créée : « ${fromNode?.text} » ➔ « ${toNode?.text} »`);
    }

    this.promptEditRelationshipLabel(createdId);
  },

  promptEditRelationshipLabel(relId) {
    const rel = this.relationships.find(r => r.id === relId);
    if (!rel) return;

    const fromNode = this.findNode(rel.fromId);
    const toNode = this.findNode(rel.toId);

    document.getElementById('mm-rel-edit-modal')?.remove();

    const presets = [
      'VOIR AUSSI',
      'ACCOMPLISSEMENT',
      'TYPOLOGIE',
      'PARALLÈLE',
      'OPPOSITION',
      'CHIASME',
      'CAUSE À EFFET'
    ];

    const overlay = document.createElement('div');
    overlay.id = 'mm-rel-edit-modal';
    overlay.className = 'mm-rel-modal-overlay';
    overlay.innerHTML = `
      <div class="mm-rel-modal" role="dialog" aria-modal="true">
        <div class="mm-rel-modal-title">
          <span>Liaison transversale</span>
          <button type="button" class="mm-modal-close-btn" id="mm-btn-close-rel-modal" title="Fermer (Échap)">×</button>
        </div>
        <div style="font-size: 12px; color: var(--text-secondary);">
          De <strong>${this.escapeHtml(fromNode?.text || 'Source')}</strong> vers <strong>${this.escapeHtml(toNode?.text || 'Cible')}</strong>
        </div>
        <div class="mm-rel-presets">
          ${presets.map(p => `<button type="button" class="mm-rel-preset-chip" data-label="${p}">${p}</button>`).join('')}
        </div>
        <input type="text" class="mm-rel-modal-input" id="mm-rel-input-label" value="${this.escapeHtml(rel.label || 'VOIR AUSSI')}" placeholder="Mot-clé de la relation...">
        <div class="mm-rel-modal-actions">
          <button type="button" class="mm-rel-btn-delete" id="mm-btn-del-rel" title="Supprimer définitivement cette liaison">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            <span>Supprimer</span>
          </button>
          <div class="mm-rel-modal-right-actions">
            <button type="button" class="mm-rel-btn-cancel" id="mm-btn-cancel-rel">Annuler</button>
            <button type="button" class="mm-rel-btn-save" id="mm-btn-save-rel">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              <span>Appliquer</span>
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const input = document.getElementById('mm-rel-input-label');
    input?.focus();
    input?.select();

    const close = () => {
      overlay.remove();
      document.removeEventListener('keydown', handleKey);
    };

    const handleKey = (e) => {
      if (e.key === 'Escape') close();
      if (e.key === 'Enter') save();
    };

    const save = () => {
      const val = (input?.value || '').trim().toUpperCase() || 'LIAISON';
      rel.label = val;
      close();
      this.draw();
      this.syncAndAutoSave();
    };

    overlay.querySelectorAll('.mm-rel-preset-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const lbl = chip.getAttribute('data-label');
        if (input) input.value = lbl;
        save();
      });
    });

    document.getElementById('mm-btn-close-rel-modal')?.addEventListener('click', close);
    document.getElementById('mm-btn-cancel-rel')?.addEventListener('click', close);
    document.getElementById('mm-btn-save-rel')?.addEventListener('click', save);
    document.getElementById('mm-btn-del-rel')?.addEventListener('click', () => {
      close();
      this.deleteRelationship(relId);
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });

    document.addEventListener('keydown', handleKey);
  }
};
