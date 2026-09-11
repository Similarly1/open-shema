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
  isReadOnly: false,
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
  connectorStyle: 'curve', // 'curve' | 'orthogonal' | 'straight'
  nodeShape: 'underline', // 'underline' | 'rounded-rect' | 'pill'
  collapsedNodes: new Set(),
  relationships: [], // [ { id, fromId, toId, label, color, customControl } ]
  connectingSourceId: null, // ID du nœud source en cours de liaison
  selectedRelId: null, // ID de la liaison sélectionnée
  boundaries: [], // [ { id, rootId, label, color } ] Clôtures / Enclos style XMind
  selectedBoundaryId: null, // ID de l'enclos sélectionné
  floatingTopics: [], // [ { id, text, x, y, color, ref, note, children, isFloating } ] Sujets Flottants style XMind

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
    initialX: 0,
    initialY: 0,
    hasMoved: false
  },
  reparentDropTargetId: null,

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

  // Marqueurs, numérotation et priorités (Style XMind)
  MARKER_DEFS: {
    '1': { label: '1', bg: '#ef4444', text: '#ffffff', isWide: false },
    '2': { label: '2', bg: '#f97316', text: '#ffffff', isWide: false },
    '3': { label: '3', bg: '#0284c7', text: '#ffffff', isWide: false },
    '4': { label: '4', bg: '#10b981', text: '#ffffff', isWide: false },
    '5': { label: '5', bg: '#8b5cf6', text: '#ffffff', isWide: false },
    '6': { label: '6', bg: '#d946ef', text: '#ffffff', isWide: false },
    '7': { label: '7', bg: '#06b6d4', text: '#ffffff', isWide: false },
    '8': { label: '8', bg: '#eab308', text: '#1e293b', isWide: false },
    '9': { label: '9', bg: '#64748b', text: '#ffffff', isWide: false },
    'p1': { label: 'P1', bg: '#dc2626', text: '#ffffff', isWide: true },
    'p2': { label: 'P2', bg: '#ea580c', text: '#ffffff', isWide: true },
    'p3': { label: 'P3', bg: '#2563eb', text: '#ffffff', isWide: true },
    'p4': { label: 'P4', bg: '#059669', text: '#ffffff', isWide: true },
    'done': { label: '✓', bg: '#10b981', text: '#ffffff', isWide: false },
    'progress': { label: '◐', bg: '#f59e0b', text: '#ffffff', isWide: false },
    'star': { label: '★', bg: '#f59e0b', text: '#ffffff', isWide: false },
    'alert': { label: '!', bg: '#ef4444', text: '#ffffff', isWide: false }
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

    if (!this.container.querySelector('.mindmap-wrapper')) {
      this.container.innerHTML = `
        <div class="mindmap-wrapper">
          <svg id="mindmap-svg" class="mindmap-svg-canvas" width="100%" height="100%">
          <defs>
            <filter id="mm-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#000000" flood-opacity="0.15"/>
            </filter>
            <filter id="mm-select-glow" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="0" stdDeviation="6" flood-color="#3b82f6" flood-opacity="0.6"/>
              <feDropShadow dx="0" dy="0" stdDeviation="2" flood-color="#ffffff" flood-opacity="0.4"/>
            </filter>
            <filter id="mm-root-aura" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="8" result="blur"/>
              <feColorMatrix in="blur" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.55 0" result="aura"/>
              <feMerge><feMergeNode in="aura"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <radialGradient id="mm-root-grad" cx="38%" cy="35%" r="62%" fx="38%" fy="35%">
              <stop offset="0%" stop-color="#ffffff" stop-opacity="0.28"/>
              <stop offset="55%" stop-color="var(--mm-root-color, #2563eb)" stop-opacity="0.92"/>
              <stop offset="100%" stop-color="var(--mm-root-color, #1d4ed8)" stop-opacity="1"/>
            </radialGradient>
            <marker id="mm-rel-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#2563eb" />
            </marker>
            <filter id="mm-filter-bw">
              <feColorMatrix type="matrix" values="0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0 0 0 1 0"/>
              <feComponentTransfer>
                <feFuncR type="linear" slope="1.15" intercept="-0.05"/>
                <feFuncG type="linear" slope="1.15" intercept="-0.05"/>
                <feFuncB type="linear" slope="1.15" intercept="-0.05"/>
              </feComponentTransfer>
            </filter>
          </defs>
          <g id="mindmap-viewport"></g>
        </svg>

        <!-- Vue Plan (Outliner hiérarchique interactif) -->
        <div id="mindmap-outline-view" class="mindmap-outline-container hidden"></div>

        <!-- Bandeau supérieur discret en plein écran -->
        <div class="mm-fullscreen-bar" id="mm-fullscreen-bar">
          <div class="mm-fs-bar-left">
            <span class="mm-fs-note-title" id="mm-fs-note-title">Mind Map</span>
            <span class="mm-fs-note-ref" id="mm-fs-note-ref" style="display: none;"></span>
          </div>
          <div class="mm-fs-bar-right">
            <button type="button" class="mm-fs-exit-btn" id="mm-fs-btn-exit" title="Quitter le plein écran (Échap ou F11)">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14h6m0 0v6m0-6L3 21m17-7h-6m0 0v6m0-6l7 7M4 10h6m0 0V4m0 6L3 3m17 7h-6m0 0V4m0 6l7-7"/></svg>
              <span>Quitter le plein écran</span>
            </button>
          </div>
        </div>

        <!-- Bannière d'indication mode liaison -->
        <div id="mm-connecting-banner" class="mm-connecting-banner hidden">
          <div class="mm-connecting-badge">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 8L22 12L18 16"/><path d="M2 12H22"/></svg>
          </div>
          <span class="mm-connecting-text">Cliquez sur la branche cible pour créer la liaison (<kbd>Échap</kbd> pour annuler)</span>
          <button type="button" class="btn-icon-subtle" id="mm-btn-cancel-connecting" title="Annuler (Échap)">×</button>
        </div>

        <!-- Dock d'outils flottant réactif par îlots thématiques (Option 3 & Option 1) -->
        <div class="mindmap-dock" id="mindmap-dock">
          <!-- Îlot 1 : Vue & Structure -->
          <div class="mm-dock-group" data-group="structure">
            <button type="button" class="mm-dock-btn" id="mm-btn-toggle-outline" data-tooltip-title="Vue Plan hiérarchique" data-tooltip-kbd="Alt+P">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
              <span class="mm-dock-label">Plan</span>
            </button>
            <button type="button" class="mm-dock-btn" id="mm-btn-structure" data-tooltip-title="Squelette de mise en page" data-tooltip-kbd="Alt+S">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor"/><line x1="9" y1="12" x2="3" y2="12"/><line x1="3" y1="8" x2="3" y2="16"/><line x1="15" y1="12" x2="21" y2="12"/><line x1="21" y1="8" x2="21" y2="16"/></svg>
              <span class="mm-dock-label">Structure</span>
            </button>
            <button type="button" class="mm-dock-btn" id="mm-btn-styles" data-tooltip-title="Styles & Connecteurs" data-tooltip-kbd="Alt+T">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19h16"/><circle cx="7" cy="12" r="3"/><path d="M10 12h5"/><rect x="15" y="9" width="6" height="6" rx="1.5"/></svg>
              <span class="mm-dock-label">Styles</span>
            </button>
            <button type="button" class="mm-dock-btn" id="mm-btn-reorganize" data-tooltip-title="Harmoniser et réorganiser" data-tooltip-kbd="Alt+R">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>
              <span class="mm-dock-label">Harmoniser</span>
            </button>
          </div>

          <div class="mm-dock-separator"></div>

          <!-- Îlot 2 : Éléments -->
          <div class="mm-dock-group" data-group="elements">
            <button type="button" class="mm-dock-btn" id="mm-btn-relationship" data-tooltip-title="Liaison transversale" data-tooltip-kbd="Ctrl+L">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8L22 12L18 16"/><path d="M2 12H22"/></svg>
              <span class="mm-dock-label">Liaison</span>
            </button>
            <button type="button" class="mm-dock-btn" id="mm-btn-boundary" data-tooltip-title="Enclos / Clôture de branche" data-tooltip-kbd="Ctrl+B">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="4" stroke-dasharray="4 3"/><path d="M7 8h10M7 12h6"/></svg>
              <span class="mm-dock-label">Enclos</span>
            </button>
            <button type="button" class="mm-dock-btn" id="mm-btn-floating" data-tooltip-title="Sujet flottant indépendant" data-tooltip-kbd="Alt+F">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="7" stroke-dasharray="3 2"/><circle cx="7.5" cy="12" r="1.5" fill="currentColor"/><line x1="11" y1="12" x2="16" y2="12"/></svg>
              <span class="mm-dock-label">Flottant</span>
            </button>
            <button type="button" class="mm-dock-btn" id="mm-btn-marker" data-tooltip-title="Marqueurs & Priorités" data-tooltip-kbd="1-9 / M">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><text x="12" y="15.5" font-size="10" font-weight="800" text-anchor="middle" fill="currentColor" stroke="none">1</text></svg>
              <span class="mm-dock-label">Marqueur</span>
            </button>
          </div>

          <div class="mm-dock-separator"></div>

          <!-- Îlot 3 : Thème & Aide -->
          <div class="mm-dock-group" data-group="theme-help">
            <button type="button" class="mm-dock-btn" id="mm-btn-theme" data-tooltip-title="Basculer Fond Sombre / Papier" data-tooltip-kbd="Thème">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 0 20z" fill="currentColor"/></svg>
              <span class="mm-dock-label">Fond</span>
            </button>
            <button type="button" class="mm-dock-btn" id="mm-btn-palette" data-tooltip-title="Changer la palette de couleurs" data-tooltip-kbd="Palette">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>
              <span class="mm-dock-label">Palette</span>
            </button>
            <button type="button" class="mm-dock-btn" id="mm-btn-help" data-tooltip-title="Aide raccourcis clavier" data-tooltip-kbd="?">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              <span class="mm-dock-label">Aide</span>
            </button>
          </div>

          <div class="mm-dock-separator"></div>

          <!-- Bouton Toggle Développer / Réduire -->
          <button type="button" class="mm-dock-btn mm-dock-toggle-btn" id="mm-btn-dock-toggle" data-tooltip-title="Développer / Réduire le bandeau" data-tooltip-kbd="Bascule">
            <svg class="mm-dock-icon-expand" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
            <svg class="mm-dock-icon-collapse hidden" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
            <span class="mm-dock-label">Réduire</span>
          </button>
        </div>

        <!-- Composant infobulle flottante instantanée -->
        <div id="mm-dock-tooltip" class="mm-dock-tooltip hidden">
          <span class="mm-dock-tooltip-title"></span>
          <kbd class="mm-dock-tooltip-kbd"></kbd>
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
                <div class="mm-struct-name">Pensée radiante <span class="mm-struct-check" data-for="radiant"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span></div>
                <div class="mm-struct-desc">Équilibrée gauche / droite (Buzan). Idéale pour le remue-méninges et les synthèses.</div>
              </div>
            </div>
            <div class="mm-structure-option" data-structure="right-tree">
              <div class="mm-struct-icon">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="9" width="5" height="6" rx="1.5" fill="currentColor"/><path d="M8 12h5m0-6h6m-6 6h6m-6 6h6"/><path d="M13 6v12"/></svg>
              </div>
              <div class="mm-struct-info">
                <div class="mm-struct-name">Arbre logique à droite <span class="mm-struct-check hidden" data-for="right-tree"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span></div>
                <div class="mm-struct-desc">Racine à gauche, branches à droite. Parfait pour plans d'homélie et exégèse linéaire.</div>
              </div>
            </div>
            <div class="mm-structure-option" data-structure="top-down">
              <div class="mm-struct-icon">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="3" width="6" height="5" rx="1.5" fill="currentColor"/><path d="M12 8v5m-6 0h12m-12 0v6m6-6v6m6-6v6"/></svg>
              </div>
              <div class="mm-struct-info">
                <div class="mm-struct-name">Organigramme descendant <span class="mm-struct-check hidden" data-for="top-down"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span></div>
                <div class="mm-struct-desc">Hiérarchie verticale descendante. Idéal pour généalogies et divisions structurelles.</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Popover de styles de connecteurs et formes de nœuds (style XMind) -->
        <div class="mm-styles-popover hidden" id="mm-styles-popover">
          <div class="mm-styles-header">
            <span class="mm-styles-title">Styles & Connecteurs</span>
            <span class="mm-styles-badge">Alt+T</span>
          </div>

          <!-- Section 1 : Style des branches (Connecteurs) -->
          <div class="mm-styles-section-label">Connecteurs des branches</div>
          <div class="mm-styles-grid">
            <div class="mm-style-card active" data-style-type="connector" data-value="curve" title="Courbe fluide de Bézier">
              <div class="mm-style-card-icon">
                <svg viewBox="0 0 32 20" width="28" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                  <path d="M 3 16 C 12 16, 20 4, 29 4"/>
                </svg>
              </div>
              <span class="mm-style-card-name">Courbe</span>
              <span class="mm-style-check" data-connector-for="curve"><svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>
            </div>

            <div class="mm-style-card" data-style-type="connector" data-value="orthogonal" title="Ligne à angle droit avec coudes arrondis">
              <div class="mm-style-card-icon">
                <svg viewBox="0 0 32 20" width="28" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                  <path d="M 3 16 L 12 16 Q 16 16, 16 12 L 16 8 Q 16 4, 20 4 L 29 4"/>
                </svg>
              </div>
              <span class="mm-style-card-name">Équerre</span>
              <span class="mm-style-check hidden" data-connector-for="orthogonal"><svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>
            </div>

            <div class="mm-style-card" data-style-type="connector" data-value="straight" title="Ligne droite directe">
              <div class="mm-style-card-icon">
                <svg viewBox="0 0 32 20" width="28" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                  <line x1="3" y1="16" x2="29" y2="4"/>
                </svg>
              </div>
              <span class="mm-style-card-name">Droite</span>
              <span class="mm-style-check hidden" data-connector-for="straight"><svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>
            </div>
          </div>

          <!-- Section 2 : Forme des nœuds -->
          <div class="mm-styles-section-label" style="margin-top: 10px;">Forme des nœuds</div>
          <div class="mm-styles-grid">
            <div class="mm-style-card active" data-style-type="shape" data-value="underline" title="Texte souligné sur la branche (épuré)">
              <div class="mm-style-card-icon">
                <svg viewBox="0 0 32 20" width="28" height="18" fill="none" stroke="currentColor" stroke-width="2">
                  <text x="16" y="11" text-anchor="middle" font-size="8" font-weight="700" fill="currentColor">ABC</text>
                  <line x1="4" y1="15" x2="28" y2="15" stroke-linecap="round"/>
                </svg>
              </div>
              <span class="mm-style-card-name">Souligné</span>
              <span class="mm-style-check" data-shape-for="underline"><svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>
            </div>

            <div class="mm-style-card" data-style-type="shape" data-value="rounded-rect" title="Rectangle arrondi moderne">
              <div class="mm-style-card-icon">
                <svg viewBox="0 0 32 20" width="28" height="18" fill="none" stroke="currentColor" stroke-width="1.8">
                  <rect x="3" y="3" width="26" height="14" rx="4" fill="currentColor" fill-opacity="0.12"/>
                  <text x="16" y="12" text-anchor="middle" font-size="8" font-weight="700" fill="currentColor">ABC</text>
                </svg>
              </div>
              <span class="mm-style-card-name">Rectangle</span>
              <span class="mm-style-check hidden" data-shape-for="rounded-rect"><svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>
            </div>

            <div class="mm-style-card" data-style-type="shape" data-value="pill" title="Capsule / Pilule">
              <div class="mm-style-card-icon">
                <svg viewBox="0 0 32 20" width="28" height="18" fill="none" stroke="currentColor" stroke-width="1.8">
                  <rect x="2" y="3" width="28" height="14" rx="7" fill="currentColor" fill-opacity="0.12"/>
                  <text x="16" y="12" text-anchor="middle" font-size="8" font-weight="700" fill="currentColor">ABC</text>
                </svg>
              </div>
              <span class="mm-style-card-name">Pilule</span>
              <span class="mm-style-check hidden" data-shape-for="pill"><svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>
            </div>
          </div>
        </div>

        <!-- Popover de sélection des Marqueurs & Priorités (style XMind) -->
        <div class="mm-marker-popover hidden" id="mm-marker-popover">
          <div class="mm-marker-header">
            <span class="mm-marker-title">Marqueurs & Priorités</span>
            <span class="mm-marker-badge">1 - 9 / M</span>
          </div>

          <div class="mm-marker-section-label">Numéros ordonnés (Touches 1 à 9)</div>
          <div class="mm-marker-grid numbers">
            <div class="mm-marker-choice" data-marker="1" style="--m-bg: #ef4444;" title="Numéro 1 (Touche 1)"><span>1</span></div>
            <div class="mm-marker-choice" data-marker="2" style="--m-bg: #f97316;" title="Numéro 2 (Touche 2)"><span>2</span></div>
            <div class="mm-marker-choice" data-marker="3" style="--m-bg: #0284c7;" title="Numéro 3 (Touche 3)"><span>3</span></div>
            <div class="mm-marker-choice" data-marker="4" style="--m-bg: #10b981;" title="Numéro 4 (Touche 4)"><span>4</span></div>
            <div class="mm-marker-choice" data-marker="5" style="--m-bg: #8b5cf6;" title="Numéro 5 (Touche 5)"><span>5</span></div>
            <div class="mm-marker-choice" data-marker="6" style="--m-bg: #d946ef;" title="Numéro 6 (Touche 6)"><span>6</span></div>
            <div class="mm-marker-choice" data-marker="7" style="--m-bg: #06b6d4;" title="Numéro 7 (Touche 7)"><span>7</span></div>
            <div class="mm-marker-choice" data-marker="8" style="--m-bg: #eab308;" title="Numéro 8 (Touche 8)"><span style="color:#1e293b;">8</span></div>
            <div class="mm-marker-choice" data-marker="9" style="--m-bg: #64748b;" title="Numéro 9 (Touche 9)"><span>9</span></div>
          </div>

          <div class="mm-marker-section-label" style="margin-top: 10px;">Priorités (P1 - P4)</div>
          <div class="mm-marker-grid priorities">
            <div class="mm-marker-choice wide" data-marker="p1" style="--m-bg: #dc2626;" title="Priorité 1 - Critique"><span>P1</span></div>
            <div class="mm-marker-choice wide" data-marker="p2" style="--m-bg: #ea580c;" title="Priorité 2 - Majeure"><span>P2</span></div>
            <div class="mm-marker-choice wide" data-marker="p3" style="--m-bg: #2563eb;" title="Priorité 3 - Normale"><span>P3</span></div>
            <div class="mm-marker-choice wide" data-marker="p4" style="--m-bg: #059669;" title="Priorité 4 - Secondaire"><span>P4</span></div>
          </div>

          <div class="mm-marker-section-label" style="margin-top: 10px;">Statuts & Symboles</div>
          <div class="mm-marker-grid symbols">
            <div class="mm-marker-choice" data-marker="done" style="--m-bg: #10b981;" title="Terminé / Validé"><span style="display:inline-flex;align-items:center;justify-content:center;"><svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#ffffff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span></div>
            <div class="mm-marker-choice" data-marker="progress" style="--m-bg: #f59e0b;" title="En cours"><span style="display:inline-flex;align-items:center;justify-content:center;"><svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#ffffff" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="#ffffff"/></svg></span></div>
            <div class="mm-marker-choice" data-marker="star" style="--m-bg: #f59e0b;" title="Étoile clé"><span style="display:inline-flex;align-items:center;justify-content:center;"><svg viewBox="0 0 24 24" width="11" height="11" fill="#ffffff"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></span></div>
            <div class="mm-marker-choice" data-marker="alert" style="--m-bg: #ef4444;" title="Attention / Important"><span>!</span></div>
          </div>

          <div class="mm-marker-footer">
            <button type="button" class="mm-marker-clear-btn" data-action="clear-marker" title="Effacer le marqueur (Touche 0)">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              <span>Effacer le marqueur (0)</span>
            </button>
          </div>
        </div>

        <!-- Modale d'aide aux raccourcis clavier centrée (remplace l'ancien tiroir) -->
        <div class="mm-help-overlay hidden" id="mm-help-overlay">
          <div class="mindmap-help-drawer mm-help-modal" id="mindmap-help-drawer" role="dialog" aria-modal="true" aria-labelledby="mm-help-title-text">
            <div class="mm-help-header">
              <div class="mm-help-title" id="mm-help-title-text">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                <span>Guide des raccourcis & Gestes Mind Map</span>
              </div>
              <button type="button" class="btn-icon-subtle mm-help-close-btn" id="mm-btn-close-help" title="Fermer (Échap)">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div class="mm-help-content mm-help-body">
              <table class="mm-help-table">
                <tr><td><kbd>1</kbd> à <kbd>9</kbd></td><td><strong>Numéroter / Marquer la branche</strong></td></tr>
                <tr><td><kbd>0</kbd></td><td><strong>Effacer le marqueur de branche</strong></td></tr>
                <tr><td><kbd>M</kbd></td><td><strong>Ouvrir le menu des marqueurs & priorités</strong></td></tr>
                <tr><td><kbd>Alt+P</kbd></td><td><strong>Basculer entre Vue Carte et Vue Plan</strong></td></tr>
                <tr><td><kbd>Alt+S</kbd></td><td><strong>Changer de squelette de mise en page</strong></td></tr>
                <tr><td><kbd>Alt+T</kbd></td><td><strong>Styles de connecteurs & formes de nœuds</strong></td></tr>
                <tr><td><kbd>Alt+R</kbd></td><td><strong>Réorganiser harmonieusement la carte</strong></td></tr>
                <tr><td><kbd>Ctrl+L</kbd></td><td><strong>Créer une liaison transversale (Relation)</strong></td></tr>
                <tr><td><kbd>Ctrl+B</kbd></td><td><strong>Créer un enclos / clôture sur la branche</strong></td></tr>
                <tr><td><kbd>Ctrl+E</kbd></td><td><strong>Exporter la carte (PDF, PNG, JPG)</strong></td></tr>
                <tr><td><kbd>Alt+F</kbd> ou <em>Double-clic</em></td><td><strong>Créer un sujet flottant indépendant</strong></td></tr>
                <tr><td><kbd>Tab</kbd></td><td>Ajouter une sous-branche (Enfant)</td></tr>
                <tr><td><kbd>Entrée</kbd></td><td>Ajouter une branche voisine (Sœur)</td></tr>
                <tr><td><kbd>Espace</kbd> ou <em>Double-clic</em></td><td>Modifier le mot-clé</td></tr>
                <tr><td><kbd>F4</kbd></td><td>Ajouter / Modifier la note de branche</td></tr>
                <tr><td><kbd>Suppr</kbd> / <kbd>Retour</kbd></td><td>Supprimer la branche, enclos ou liaison sélectionnée</td></tr>
                <tr><td><kbd>Ctrl+C</kbd> / <kbd>Ctrl+V</kbd></td><td>Copier / Coller une branche</td></tr>
                <tr><td><em>Clic Droit</em></td><td>Menu contextuel complet (branche ou fond)</td></tr>
                <tr><td><kbd>←</kbd> <kbd>→</kbd> <kbd>↑</kbd> <kbd>↓</kbd></td><td>Naviguer d'une branche à l'autre</td></tr>
                <tr><td><kbd>Ctrl + Molette</kbd></td><td>Zoomer / Dézoomer</td></tr>
                <tr><td><em>Clic-glissé fond</em></td><td>Déplacer la feuille (Panoramique)</td></tr>
                <tr><td><kbd>R</kbd></td><td>Recentrer la vue</td></tr>
                <tr><td><kbd>?</kbd></td><td>Afficher / Masquer cette aide</td></tr>
              </table>
              <div class="mm-help-tip">
                <strong>Astuce 100% Souris :</strong> Clic droit sur n'importe quel élément pour afficher toutes les options contextuelles, ou survolez une branche pour faire apparaître <span class="badge-mini">+</span> et <span class="badge-mini">×</span>.
              </div>
            </div>
            <div class="mm-help-footer">
              <span class="mm-help-footer-sub">Spécification Markdown (.md)</span>
              <button type="button" class="btn-secondary" id="mm-btn-open-markdown-guide" style="font-size: 11.5px; padding: 4px 10px; display: inline-flex; align-items: center; gap: 6px;">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                <span>Guide Markdown</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
    }

    this.svg = this.container.querySelector('.mindmap-svg-canvas') || document.getElementById('mindmap-svg');
    this.viewportG = this.container.querySelector('#mindmap-viewport') || this.svg?.querySelector('g') || document.getElementById('mindmap-viewport');

    if (!this._eventsBound) {
      this.bindEvents();
      this._eventsBound = true;
    }
  },

  bindEvents() {
    // 1. Panoramique à la souris (Drag)
    const onMouseDown = (e) => {
      this.hideTooltip();
      if (this.connectingSourceId && !e.target.closest('.mm-node-g')) {
        this.cancelConnecting();
        return;
      }
      if (e.button !== 0) return; // Clic gauche uniquement

      // Autoriser le panoramique si clic sur le fond, le canevas, les branches, ou n'importe où en lecture seule (sauf badges interactifs)
      // Autoriser le panoramique si clic sur le fond, le canevas, les branches, ou n'importe où en lecture seule (sauf badges interactifs et liaisons/enclos)
      const isInteractiveBadge = e.target.closest('.mm-node-icon-badge') || e.target.closest('.mm-scripture-pill') || e.target.closest('.mm-note-pill') || e.target.closest('.mm-action-btn') || e.target.closest('button');
      const isNode = !!e.target.closest('.mm-node-g');
      const isRel = !!e.target.closest('.mm-relationship-g, .mm-rel-label-wrap, .mm-rel-label-g, .mm-rel-handle, .mm-rel-handle-line');
      const isBoundary = !!e.target.closest('.mm-boundary-g');

      if (!isInteractiveBadge && !isRel && !isBoundary && (!isNode || this.isReadOnly)) {
        this.isPanning = true;
        this.panStart = { x: e.clientX - this.viewBox.x, y: e.clientY - this.viewBox.y };
        this.selectedNodeId = null;
        this.selectedRelId = null;
        this.selectedBoundaryId = null;
        this.updateSelectionState();
      }
    };

    this.svg?.addEventListener('mousedown', onMouseDown);
    this.container?.addEventListener('mousedown', onMouseDown);

    window.addEventListener('mousemove', (e) => {
      // 1. Panoramique du canevas
      if (this.isPanning) {
        this.hideTooltip();
        this.viewBox.x = e.clientX - this.panStart.x;
        this.viewBox.y = e.clientY - this.panStart.y;
        this.applyTransform();
        return;
      }

      // 2. Glisser-déplacer de la courbure d'une liaison (poignée Bézier) ou de son titre
      if (this.dragState.active && (this.dragState.type === 'rel-curve' || this.dragState.type === 'rel-label')) {
        this.hideTooltip();
        const rel = this.relationships.find(r => r.id === this.dragState.relId);
        if (rel && this.svg) {
          const rect = this.svg.getBoundingClientRect();
          const mouseSvgX = (e.clientX - rect.left - this.viewBox.x) / this.viewBox.scale;
          const mouseSvgY = (e.clientY - rect.top - this.viewBox.y) / this.viewBox.scale;

          if (this.dragState.type === 'rel-label') {
            // L'utilisateur déplace directement le titre de la liaison :
            // Inverser la formule quadratique Bézier pour que le milieu L(t=0.5) suive la souris au pixel près
            const fromNode = this.findNode(rel.fromId);
            const toNode = this.findNode(rel.toId);
            if (fromNode && toNode) {
              const p1 = this.getNodeConnectionPoint(fromNode, { x: toNode.x, y: toNode.y });
              const p2 = this.getNodeConnectionPoint(toNode, { x: fromNode.x, y: fromNode.y });
              rel.customControl = {
                x: 2 * mouseSvgX - 0.5 * (p1.x + p2.x),
                y: 2 * mouseSvgY - 0.5 * (p1.y + p2.y)
              };
            } else {
              rel.customControl = { x: mouseSvgX, y: mouseSvgY };
            }
          } else {
            // L'utilisateur déplace la poignée de courbure ou la courbe
            rel.customControl = { x: mouseSvgX, y: mouseSvgY };
          }
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
            if (node.isFloating) {
              node.x = (this.dragState.initialX ?? node.x) + deltaX;
              node.y = (this.dragState.initialY ?? node.y) + deltaY;
            } else {
              node.offsetX = (this.dragState.initialOffsetX || 0) + deltaX;
              node.offsetY = (this.dragState.initialOffsetY || 0) + deltaY;
            }
            this.layoutTree();
            this.draw();
            this.updateReparentDropTarget(e.clientX, e.clientY, node.id);
          }
          return;
        }
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (this.isPanning) {
        this.isPanning = false;
      }

      // Fin de drag de liaison (courbe ou titre)
      if (this.dragState.active && (this.dragState.type === 'rel-curve' || this.dragState.type === 'rel-label')) {
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

        const targetDropId = this.reparentDropTargetId;
        const draggedNodeId = this.dragState.nodeId;

        // Nettoyage de l'indicateur visuel de cible
        document.querySelectorAll('.reparent-drop-target').forEach(el => el.classList.remove('reparent-drop-target'));
        this.reparentDropTargetId = null;

        if (wasActive && this.dragState.hasMoved) {
          if (targetDropId && draggedNodeId && targetDropId !== draggedNodeId) {
            this.reparentNode(draggedNodeId, targetDropId);
          } else {
            this.syncAndAutoSave();
          }
        }

        this.dragState.active = false;
        this.dragState.type = null;
        this.dragState.nodeId = null;
        this.dragState.node = null;
        setTimeout(() => { this.dragState.hasMoved = false; }, 50);
      }
    });

    // 2. Zoom à la molette
    const onWheel = (e) => {
      e.preventDefault();
      const activeEditor = document.querySelector('.mm-inline-editor');
      if (activeEditor) activeEditor.blur();
      this.hideTooltip();
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      const targetRectEl = this.svg || this.container;
      const rect = targetRectEl ? targetRectEl.getBoundingClientRect() : { left: 0, top: 0 };
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const newScale = Math.min(Math.max(0.2, this.viewBox.scale * zoomFactor), 3.5);

      // Zoom centré sur la souris
      this.viewBox.x = mouseX - (mouseX - this.viewBox.x) * (newScale / this.viewBox.scale);
      this.viewBox.y = mouseY - (mouseY - this.viewBox.y) * (newScale / this.viewBox.scale);
      this.viewBox.scale = newScale;

      this.applyTransform();
    };

    this.svg?.addEventListener('wheel', onWheel, { passive: false });
    this.container?.addEventListener('wheel', onWheel, { passive: false });

    // 3. Boutons Dock
    document.getElementById('mm-btn-toggle-outline')?.addEventListener('click', () => this.toggleViewMode());
    document.getElementById('mm-btn-structure')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleStructurePopover();
    });
    document.getElementById('mm-btn-styles')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleStylesPopover();
    });
    document.getElementById('mm-btn-reorganize')?.addEventListener('click', () => this.autoReorganize());
    document.getElementById('mm-btn-relationship')?.addEventListener('click', () => {
      if (this.selectedNodeId) {
        this.startConnecting(this.selectedNodeId);
      } else if (typeof App !== 'undefined' && App.showToast) {
        App.showToast('Sélectionnez d\'abord une branche à relier');
      }
    });
    document.getElementById('mm-btn-boundary')?.addEventListener('click', () => {
      if (this.selectedNodeId && this.selectedNodeId !== 'root') {
        this.createBoundary(this.selectedNodeId);
      } else if (typeof App !== 'undefined' && App.showToast) {
        App.showToast('Sélectionnez d\'abord une branche pour créer un enclos');
      }
    });
    document.getElementById('mm-btn-floating')?.addEventListener('click', (e) => {
      e.currentTarget?.blur();
      const rect = this.svg?.getBoundingClientRect() || { width: 800, height: 600 };
      const centerSvgX = (rect.width / 2 - this.viewBox.x) / this.viewBox.scale;
      const centerSvgY = (rect.height / 2 - this.viewBox.y) / this.viewBox.scale;
      const offset = (this.floatingTopics?.length || 0) * 30;
      this.createFloatingTopic(centerSvgX + 140 + offset, centerSvgY + 60 + offset);
    });
    document.getElementById('mm-btn-cancel-connecting')?.addEventListener('click', (e) => { e.currentTarget?.blur(); this.cancelConnecting(); });
    document.getElementById('mm-btn-marker')?.addEventListener('click', (e) => {
      e.currentTarget?.blur();
      this.toggleMarkerPopover();
    });
    document.getElementById('btn-mm-zoom-in')?.addEventListener('click', (e) => { e.currentTarget?.blur(); this.zoom(1.2); });
    document.getElementById('btn-mm-zoom-out')?.addEventListener('click', (e) => { e.currentTarget?.blur(); this.zoom(0.8); });
    document.getElementById('btn-mm-fit')?.addEventListener('click', (e) => { e.currentTarget?.blur(); this.fitView(); });
    document.getElementById('mm-btn-theme')?.addEventListener('click', (e) => { e.currentTarget?.blur(); this.togglePaperMode(); });
    document.getElementById('mm-btn-palette')?.addEventListener('click', (e) => { e.currentTarget?.blur(); this.cyclePalette(); });
    document.getElementById('mm-fs-btn-exit')?.addEventListener('click', (e) => { e.currentTarget?.blur(); this.toggleFullscreen(false); });
    document.addEventListener('fullscreenchange', () => {
      const isNativeFs = !!document.fullscreenElement;
      if (!isNativeFs && document.body.classList.contains('mindmap-fullscreen-active')) {
        this.toggleFullscreen(false);
      }
    });
    document.getElementById('mm-btn-help')?.addEventListener('click', (e) => { e.currentTarget?.blur(); this.toggleHelpDrawer(); });
    document.getElementById('mm-btn-close-help')?.addEventListener('click', (e) => { e.currentTarget?.blur(); this.toggleHelpDrawer(false); });
    document.getElementById('mm-help-overlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'mm-help-overlay') {
        this.toggleHelpDrawer(false);
      }
    });
    document.getElementById('mm-btn-open-markdown-guide')?.addEventListener('click', (e) => {
      e.currentTarget?.blur();
      this.toggleHelpDrawer(false);
      if (typeof SettingsView !== 'undefined' && SettingsView.openMarkdownGuideModal) {
        SettingsView.openMarkdownGuideModal('mindmap');
      }
    });

    // Bascule Développer / Réduire du bandeau d'outils
    document.getElementById('mm-btn-dock-toggle')?.addEventListener('click', (e) => {
      e.currentTarget?.blur();
      this.toggleDockExpanded();
    });

    // Initialiser les infobulles enrichies instantanées du bandeau
    this.initDockTooltips();

    // Écouteurs de la modale d'exportation Mind Map
    document.getElementById('btn-close-mm-export-modal')?.addEventListener('click', () => this.closeExportModal());
    document.getElementById('btn-cancel-mm-export')?.addEventListener('click', () => this.closeExportModal());
    document.getElementById('btn-confirm-mm-export')?.addEventListener('click', () => this.executeExport(this.exportModalState));

    const exportModalEl = document.getElementById('modal-mm-export');
    exportModalEl?.addEventListener('mousedown', (e) => {
      if (e.target === exportModalEl) this.closeExportModal();
    });

    // Onglets de format (PDF, PNG, JPG)
    document.querySelectorAll('#mm-export-format-tabs .mm-format-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const fmt = tab.getAttribute('data-format');
        if (!fmt) return;
        this.exportModalState.format = fmt;
        document.querySelectorAll('#mm-export-format-tabs .mm-format-tab').forEach(t => t.classList.toggle('active', t === tab));

        const pdfOpts = document.getElementById('mm-export-pdf-options');
        if (pdfOpts) pdfOpts.style.display = fmt === 'pdf' ? 'block' : 'none';

        const transPill = document.getElementById('mm-pill-bg-transparent');
        if (transPill) {
          if (fmt === 'png') {
            transPill.removeAttribute('disabled');
            transPill.style.opacity = '1';
            transPill.style.pointerEvents = 'auto';
          } else {
            transPill.setAttribute('disabled', 'true');
            transPill.style.opacity = '0.35';
            transPill.style.pointerEvents = 'none';
            if (this.exportModalState.bg === 'transparent') {
              this.exportModalState.bg = 'white';
              document.querySelectorAll('#mm-export-bg-pills .mm-pill-btn').forEach(p => {
                p.classList.toggle('active', p.getAttribute('data-bg') === 'white');
              });
            }
          }
        }
        this.refreshExportPreview();
      });
    });

    // Pastilles d'arrière-plan
    document.querySelectorAll('#mm-export-bg-pills .mm-pill-btn').forEach(pill => {
      pill.addEventListener('click', () => {
        const bg = pill.getAttribute('data-bg');
        if (!bg) return;
        this.exportModalState.bg = bg;
        document.querySelectorAll('#mm-export-bg-pills .mm-pill-btn').forEach(p => p.classList.toggle('active', p === pill));
        this.refreshExportPreview();
      });
    });

    // Pastilles de cadrage
    document.querySelectorAll('#mm-export-scope-pills .mm-pill-btn').forEach(pill => {
      pill.addEventListener('click', () => {
        const scope = pill.getAttribute('data-scope');
        if (!scope) return;
        this.exportModalState.scope = scope;
        document.querySelectorAll('#mm-export-scope-pills .mm-pill-btn').forEach(p => p.classList.toggle('active', p === pill));
        this.refreshExportPreview();
      });
    });

    // Pastilles d'échelle
    document.querySelectorAll('#mm-export-scale-pills .mm-pill-btn').forEach(pill => {
      pill.addEventListener('click', () => {
        const scale = parseInt(pill.getAttribute('data-scale'), 10);
        if (!scale) return;
        this.exportModalState.scale = scale;
        document.querySelectorAll('#mm-export-scale-pills .mm-pill-btn').forEach(p => p.classList.toggle('active', p === pill));
        this.refreshExportPreview();
      });
    });

    // Pastilles de format page PDF
    document.querySelectorAll('#mm-export-pdf-page-pills .mm-pill-btn').forEach(pill => {
      pill.addEventListener('click', () => {
        const pdfPage = pill.getAttribute('data-pdf-page');
        if (!pdfPage) return;
        this.exportModalState.pdfPage = pdfPage;
        document.querySelectorAll('#mm-export-pdf-page-pills .mm-pill-btn').forEach(p => p.classList.toggle('active', p === pill));
        this.refreshExportPreview();
      });
    });

    // Checkbox en-tête PDF
    document.getElementById('mm-export-include-header')?.addEventListener('change', (e) => {
      this.exportModalState.includeHeader = !!e.target.checked;
    });

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

    // Options du popover de styles & connecteurs (style XMind)
    document.getElementById('mm-styles-popover')?.addEventListener('click', (e) => {
      const card = e.target.closest('.mm-style-card');
      if (!card) return;
      e.stopPropagation();
      const type = card.getAttribute('data-style-type');
      const val = card.getAttribute('data-value');
      if (type === 'connector') {
        this.setConnectorStyle(val);
      } else if (type === 'shape') {
        this.setNodeShape(val);
      }
    });

    // Options du popover de marqueurs & priorités (style XMind)
    document.getElementById('mm-marker-popover')?.addEventListener('click', (e) => {
      const choice = e.target.closest('.mm-marker-choice');
      if (choice) {
        e.stopPropagation();
        const marker = choice.getAttribute('data-marker');
        if (!this.selectedNodeId || this.selectedNodeId === 'root') {
          if (typeof App !== 'undefined' && App.showToast) {
            App.showToast('Sélectionnez d\'abord une branche');
          }
          return;
        }
        this.setNodeMarker(this.selectedNodeId, marker);
        this.toggleMarkerPopover(false);
        return;
      }
      const clearBtn = e.target.closest('.mm-marker-clear-btn');
      if (clearBtn) {
        e.stopPropagation();
        if (this.selectedNodeId && this.selectedNodeId !== 'root') {
          this.setNodeMarker(this.selectedNodeId, null);
        }
        this.toggleMarkerPopover(false);
      }
    });

    // Fermer les popovers lors d'un clic extérieur
    window.addEventListener('click', (e) => {
      if (!e.target.closest('#mm-structure-popover') && !e.target.closest('#mm-btn-structure')) {
        this.toggleStructurePopover(false);
      }
      if (!e.target.closest('#mm-styles-popover') && !e.target.closest('#mm-btn-styles')) {
        this.toggleStylesPopover(false);
      }
      if (!e.target.closest('#mm-marker-popover') && !e.target.closest('#mm-btn-marker')) {
        this.toggleMarkerPopover(false);
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

      // Bascule Plein Écran (F11)
      if (e.key === 'F11') {
        e.preventDefault();
        this.toggleFullscreen();
        return;
      }

      // Si l'utilisateur est en train de taper dans un champ de saisie HTML
      const activeTag = document.activeElement?.tagName;
      if (['INPUT', 'TEXTAREA'].includes(activeTag) || document.activeElement?.isContentEditable) return;

      // En mode lecture seule (ex: modale de prévisualisation), n'autoriser QUE la navigation et consultation
      if (this.isReadOnly) {
        if (e.key === 'r' || e.key === 'R') {
          this.fitView();
        } else if ((e.key === 'p' || e.key === 'P') && e.altKey) {
          e.preventDefault();
          this.toggleViewMode();
        } else if (!e.ctrlKey && !e.altKey && !e.metaKey && (e.key === 'f' || e.key === 'F')) {
          e.preventDefault();
          this.toggleFullscreen();
        } else if (e.key === 'F4' || (e.altKey && (e.key === 'n' || e.key === 'N'))) {
          if (this.selectedNodeId && this.selectedNodeId !== 'root') {
            e.preventDefault();
            this.promptTopicNote(this.selectedNodeId);
          }
        } else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
          e.preventDefault();
          this.navigateWithArrows(e.key);
        } else if (e.key === '?') {
          e.preventDefault();
          this.toggleHelpDrawer();
        }
        return;
      }

      // Changement de squelette / structure (Alt+S)
      if (e.altKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        this.cycleStructure();
        return;
      }

      // Styles de connecteurs & formes de nœuds (Alt+T)
      if (e.altKey && (e.key === 't' || e.key === 'T')) {
        e.preventDefault();
        this.toggleStylesPopover();
        return;
      }

      // Réorganisation automatique harmonieuse de la carte (Alt+R)
      if (e.altKey && (e.key === 'r' || e.key === 'R')) {
        e.preventDefault();
        this.autoReorganize();
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

      // Création d'un enclos / clôture (Ctrl+B)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        if (this.selectedNodeId && this.selectedNodeId !== 'root') {
          this.createBoundary(this.selectedNodeId);
        } else if (typeof App !== 'undefined' && App.showToast) {
          App.showToast('Sélectionnez d\'abord une branche pour créer un enclos');
        }
        return;
      }

      // Exporter la carte mentale (Ctrl+E)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'e' || e.key === 'E')) {
        e.preventDefault();
        this.openExportModal();
        return;
      }

      // Création d'un sujet flottant indépendant (Alt+F)
      if (e.altKey && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        const rect = this.svg?.getBoundingClientRect() || { width: 800, height: 600 };
        const centerSvgX = (rect.width / 2 - this.viewBox.x) / this.viewBox.scale;
        const centerSvgY = (rect.height / 2 - this.viewBox.y) / this.viewBox.scale;
        const offset = (this.floatingTopics?.length || 0) * 30;
        this.createFloatingTopic(centerSvgX + 140 + offset, centerSvgY + 60 + offset);
        return;
      }

      // Raccourci direct 'I' pour la palette d'icônes SVG sur le nœud sélectionné
      if (!e.ctrlKey && !e.metaKey && !e.altKey && (e.key === 'i' || e.key === 'I')) {
        if (this.selectedNodeId) {
          e.preventDefault();
          this.openIconPicker(this.selectedNodeId);
          return;
        }
      }

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
        if (this.selectedBoundaryId) {
          this.deleteBoundary(this.selectedBoundaryId);
        } else if (this.selectedRelId) {
          this.deleteRelationship(this.selectedRelId);
        } else {
          this.deleteSelected();
        }
      } else if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        if (this.selectedNodeId) this.startInlineEdit(this.selectedNodeId);
      } else if (!e.ctrlKey && !e.altKey && !e.metaKey && (e.key === 'f' || e.key === 'F')) {
        if (this.selectedNodeId && this.selectedNodeId !== 'root' && !document.body.classList.contains('mindmap-fullscreen-active')) {
          e.preventDefault();
          this.toggleNodeCollapse(this.selectedNodeId);
          return;
        }
        if (!this.selectedNodeId || this.selectedNodeId === 'root') {
          e.preventDefault();
          this.toggleFullscreen();
          return;
        }
      } else if (e.key === 'r' || e.key === 'R') {
        this.fitView();
      } else if (e.key === 'Escape') {
        const helpOverlay = document.getElementById('mm-help-overlay');
        if (helpOverlay && !helpOverlay.classList.contains('hidden')) {
          e.preventDefault();
          this.toggleHelpDrawer(false);
          return;
        }
        if (document.body.classList.contains('mindmap-fullscreen-active')) {
          e.preventDefault();
          this.toggleFullscreen(false);
          return;
        }
      } else if (!e.ctrlKey && !e.altKey && !e.metaKey && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        this.toggleFullscreen();
        return;
      } else if (!e.ctrlKey && !e.altKey && !e.metaKey && (e.key === 'm' || e.key === 'M')) {
        e.preventDefault();
        this.toggleMarkerPopover();
      } else if (!e.ctrlKey && !e.altKey && !e.metaKey && e.key >= '1' && e.key <= '9') {
        if (this.selectedNodeId && this.selectedNodeId !== 'root') {
          e.preventDefault();
          this.setNodeMarker(this.selectedNodeId, e.key);
        }
      } else if (!e.ctrlKey && !e.altKey && !e.metaKey && e.key === '0') {
        if (this.selectedNodeId && this.selectedNodeId !== 'root') {
          e.preventDefault();
          this.setNodeMarker(this.selectedNodeId, null);
        }
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
      if (this.isReadOnly) return;
      this.showContextMenu(e.clientX, e.clientY, null);
    });

    // Double-clic sur le fond = créer un sujet flottant indépendant (style XMind)
    this.svg?.addEventListener('dblclick', (e) => {
      if (this.isReadOnly) return;
      if (e.target === this.svg || e.target === this.viewportG) {
        e.stopPropagation();
        const rect = this.svg.getBoundingClientRect();
        const mouseSvgX = (e.clientX - rect.left - this.viewBox.x) / this.viewBox.scale;
        const mouseSvgY = (e.clientY - rect.top - this.viewBox.y) / this.viewBox.scale;
        this.createFloatingTopic(mouseSvgX, mouseSvgY);
      }
    });
  },

  // =========================================================================
  // PARSING & SÉRIALISATION MARKDOWN ↔ TREE
  // =========================================================================

  parseImageDirective(raw) {
    let image = raw;
    let mode = 'background';
    let zoom = 1.0;
    let panX = 0;
    let panY = 0;
    let color = 'natural';
    let aspect = 1.0;
    let shape = null;
    let size = null;

    if (raw && raw.includes('|')) {
      const parts = raw.split('|');
      image = parts[0].trim();
      const modeMatch = raw.match(/mode:\s*([a-zA-Z\-]+)/i);
      if (modeMatch) mode = modeMatch[1].trim().toLowerCase();

      const zoomMatch = raw.match(/zoom:\s*([0-9.]+)/i);
      if (zoomMatch) {
        const z = parseFloat(zoomMatch[1]);
        if (!isNaN(z) && z >= 0.5 && z <= 4.0) zoom = Math.round(z * 100) / 100;
      }

      const panMatch = raw.match(/pan:\s*(-?[0-9.]+)\s*,\s*(-?[0-9.]+)/i);
      if (panMatch) {
        const px = parseFloat(panMatch[1]);
        const py = parseFloat(panMatch[2]);
        if (!isNaN(px)) panX = Math.round(px * 10) / 10;
        if (!isNaN(py)) panY = Math.round(py * 10) / 10;
      }

      const colorMatch = raw.match(/color:\s*([a-zA-Z\-]+)/i);
      if (colorMatch) color = colorMatch[1].trim().toLowerCase();

      const aspectMatch = raw.match(/aspect:\s*([0-9.]+)/i);
      if (aspectMatch) {
        const a = parseFloat(aspectMatch[1]);
        if (!isNaN(a) && a > 0.1 && a < 10) aspect = Math.round(a * 100) / 100;
      }

      const shapeMatch = raw.match(/shape:\s*([a-zA-Z\-]+)/i);
      if (shapeMatch) shape = shapeMatch[1].trim().toLowerCase();

      const sizeMatch = raw.match(/size:\s*([0-9]+)/i);
      if (sizeMatch) {
        const s = parseInt(sizeMatch[1]);
        if (!isNaN(s) && s >= 36 && s <= 260) size = s;
      }
    }
    return { image, mode, zoom, panX, panY, color, aspect: aspect || 1.0, shape, size };
  },

  serializeImageDirective(node) {
    if (!node || !node.image) return '';
    const parts = [node.image];
    if (node.imageMode && node.imageMode !== 'background') {
      parts.push(`mode: ${node.imageMode}`);
    }
    if (typeof node.imageZoom === 'number' && node.imageZoom !== 1.0) {
      parts.push(`zoom: ${node.imageZoom}`);
    }
    if ((typeof node.imagePanX === 'number' && node.imagePanX !== 0) || (typeof node.imagePanY === 'number' && node.imagePanY !== 0)) {
      parts.push(`pan: ${node.imagePanX || 0},${node.imagePanY || 0}`);
    }
    if (node.imageColor && node.imageColor !== 'natural') {
      parts.push(`color: ${node.imageColor}`);
    }
    if (typeof node.imageAspect === 'number' && Math.abs(node.imageAspect - 1.0) > 0.01) {
      parts.push(`aspect: ${Math.round(node.imageAspect * 100) / 100}`);
    }
    if (node.imageShape) {
      parts.push(`shape: ${node.imageShape}`);
    }
    if (typeof node.imageSize === 'number' && node.imageSize >= 36) {
      parts.push(`size: ${Math.round(node.imageSize)}`);
    }
    return parts.join(' | ');
  },

  parseMarkdownToTree(title, markdownContent) {
    // Si markdownContent contient un en-tête YAML Frontmatter (ex: importation brute), le détacher du corps
    if (markdownContent && typeof markdownContent === 'string' && markdownContent.trim().startsWith('---')) {
      const parts = markdownContent.split('---');
      if (parts.length >= 3) {
        markdownContent = parts.slice(2).join('---').trim();
      }
    }

    // Détection de la directive de structure <!-- mindmap-layout: radiant|right-tree|top-down -->
    let structure = 'radiant';
    let connector = 'curve';
    let shape = 'underline';

    if (markdownContent) {
      const structMatch = markdownContent.match(/<!--\s*mindmap-layout:\s*(radiant|right-tree|top-down)\s*-->/i);
      if (structMatch) {
        structure = structMatch[1].toLowerCase();
      } else if (this.currentNote && this.currentNote.structure) {
        structure = this.currentNote.structure;
      }

      const connMatch = markdownContent.match(/<!--\s*mindmap-connector:\s*(curve|orthogonal|straight)\s*-->/i);
      if (connMatch) connector = connMatch[1].toLowerCase();

      const shapeMatch = markdownContent.match(/<!--\s*mindmap-node-shape:\s*(underline|rounded-rect|pill)\s*-->/i);
      if (shapeMatch) shape = shapeMatch[1].toLowerCase();
    } else if (this.currentNote && this.currentNote.structure) {
      structure = this.currentNote.structure;
    }
    this.treeStructure = structure;
    this.connectorStyle = connector;
    this.nodeShape = shape;

    let rootIcon = null;
    let rootImage = null;
    let rootImageMode = 'background';
    let rootImageZoom = 1.0;
    let rootImagePanX = 0;
    let rootImagePanY = 0;
    let rootImageColor = 'natural';
    let rootImageAspect = 1.0;
    let rootImageShape = null;
    let rootImageSize = null;
    let rootTitle = (title || 'CONCEPT CENTRAL').toUpperCase();
    if (markdownContent) {
      const rootIconMatch = markdownContent.match(/<!--\s*mindmap-root-icon:\s*([a-zA-Z0-9_-]+)\s*-->/i);
      if (rootIconMatch) {
        rootIcon = rootIconMatch[1].trim().toLowerCase();
      }
      const rootImageMatch = markdownContent.match(/<!--\s*mindmap-root-image:\s*([\s\S]*?)\s*-->/i);
      if (rootImageMatch) {
        const parsed = this.parseImageDirective(rootImageMatch[1].trim());
        rootImage = parsed.image;
        rootImageMode = parsed.mode;
        rootImageZoom = parsed.zoom;
        rootImagePanX = parsed.panX;
        rootImagePanY = parsed.panY;
        rootImageColor = parsed.color;
        if (parsed.aspect) rootImageAspect = parsed.aspect;
        if (parsed.shape) rootImageShape = parsed.shape;
        if (parsed.size) rootImageSize = parsed.size;
      }
    }
    const titleIconMatch = rootTitle.match(/::([a-zA-Z0-9_-]+):?/i);
    if (titleIconMatch && typeof SvgIconsRegistry !== 'undefined') {
      const cand = titleIconMatch[1].toLowerCase();
      if (SvgIconsRegistry.has(cand)) {
        rootIcon = cand;
        rootTitle = rootTitle.replace(titleIconMatch[0], '').trim() || SvgIconsRegistry.get(cand)?.label?.toUpperCase();
      }
    }
    if (!rootIcon && this.currentNote && this.currentNote.rootIcon) {
      rootIcon = this.currentNote.rootIcon;
    }
    if (!rootImage && this.currentNote && this.currentNote.rootImage) {
      rootImage = this.currentNote.rootImage;
      rootImageMode = this.currentNote.rootImageMode || 'background';
      rootImageZoom = this.currentNote.rootImageZoom || 1.0;
      rootImagePanX = this.currentNote.rootImagePanX || 0;
      rootImagePanY = this.currentNote.rootImagePanY || 0;
      rootImageColor = this.currentNote.rootImageColor || 'natural';
      rootImageShape = this.currentNote.rootImageShape || null;
      rootImageSize = this.currentNote.rootImageSize || null;
    }
    if (this.currentNote && this.currentNote.rootImageAspect) {
      rootImageAspect = this.currentNote.rootImageAspect;
    }

    const root = {
      id: 'root',
      text: rootTitle,
      icon: rootIcon,
      image: rootImage,
      imageMode: rootImageMode,
      imageZoom: rootImageZoom,
      imagePanX: rootImagePanX,
      imagePanY: rootImagePanY,
      imageColor: rootImageColor,
      imageAspect: rootImageAspect,
      imageShape: rootImageShape,
      imageSize: rootImageSize,
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

    let inFloatingBlock = false;
    for (const rawLine of lines) {
      const line = rawLine.trimEnd();
      const trimmed = line.trim();
      if (trimmed.startsWith('<!-- mindmap-floating-start:')) {
        inFloatingBlock = true;
        continue;
      }
      if (trimmed.startsWith('<!-- mindmap-floating-end')) {
        inFloatingBlock = false;
        continue;
      }
      if (inFloatingBlock || trimmed.startsWith('<!-- mindmap-floating:')) continue;
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('<!-- mindmap-layout:') || trimmed.startsWith('<!-- mindmap-connector:') || trimmed.startsWith('<!-- mindmap-node-shape:') || trimmed.startsWith('<!-- mindmap-rel:') || trimmed.startsWith('<!-- mindmap-boundary:') || trimmed.startsWith('<!-- mindmap-pos:')) continue;

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

        // Extraction d'un marqueur <!-- marker: ... -->
        let marker = null;
        const markerMatch = text.match(/<!--\s*marker:\s*([a-zA-Z0-9_-]+)\s*-->/i);
        if (markerMatch) {
          marker = markerMatch[1].trim().toLowerCase();
          text = text.replace(markerMatch[0], '').trim();
        }

        // Support d'un préfixe optionnel [1], (1), [P1], etc.
        if (!marker) {
          const prefixMatch = text.match(/^\[([1-9]|p[1-4])\]\s*/i) || text.match(/^\(([1-9]|p[1-4])\)\s*/i);
          if (prefixMatch) {
            marker = prefixMatch[1].toLowerCase();
            text = text.replace(prefixMatch[0], '').trim();
          }
        }

        // Extraction d'une icône <!-- icon: ... --> ou ::icon::
        let icon = null;
        const iconCommentMatch = text.match(/<!--\s*icon:\s*([a-zA-Z0-9_-]+)\s*-->/i);
        if (iconCommentMatch) {
          icon = iconCommentMatch[1].trim().toLowerCase();
          text = text.replace(iconCommentMatch[0], '').trim();
        }
        if (!icon) {
          const iconTokenMatch = text.match(/^::([a-zA-Z0-9_-]+)::\s*/i) || text.match(/\s*::([a-zA-Z0-9_-]+)::$/i);
          if (iconTokenMatch) {
            icon = iconTokenMatch[1].trim().toLowerCase();
            text = text.replace(iconTokenMatch[0], '').trim();
          }
        }

        // Extraction d'une image <!-- image: path | mode: ... | zoom: ... | pan: ... | color: ... -->
        let image = null;
        let imageMode = 'background';
        let imageZoom = 1.0;
        let imagePanX = 0;
        let imagePanY = 0;
        let imageColor = 'natural';
        let imageAspect = 1.0;
        let imageShape = null;
        let imageSize = null;
        const imageMatch = text.match(/<!--\s*image:\s*([\s\S]*?)\s*-->/i);
        if (imageMatch) {
          const parsed = this.parseImageDirective(imageMatch[1].trim());
          image = parsed.image;
          imageMode = parsed.mode;
          imageZoom = parsed.zoom;
          imagePanX = parsed.panX;
          imagePanY = parsed.panY;
          imageColor = parsed.color;
          if (parsed.aspect) imageAspect = parsed.aspect;
          if (parsed.shape) imageShape = parsed.shape;
          if (parsed.size) imageSize = parsed.size;
          text = text.replace(imageMatch[0], '').trim();
        }

        // Extraction d'une référence biblique entre crochets [Jean 3:16] ou [Romains 3:21-31]
        let refMatch = text.match(/\[([A-Za-z0-9À-ÿ\s:.,\-–—]+)\]\s*$/);
        if (refMatch) {
          ref = refMatch[1].trim();
          text = text.replace(refMatch[0], '').trim();
        } else {
          refMatch = text.match(/^\s*\[([A-Za-z0-9À-ÿ\s:.,\-–—]+)\]\s*/);
          if (refMatch) {
            ref = refMatch[1].trim();
            text = text.replace(refMatch[0], '').trim();
          }
        }

        const newNode = {
          id: `node_${idCounter++}`,
          text: text.toUpperCase(), // Loi 4 de Buzan : MAJUSCULES
          marker: marker,
          icon: icon,
          image: image,
          imageMode: imageMode,
          imageZoom: imageZoom,
          imagePanX: imagePanX,
          imagePanY: imagePanY,
          imageColor: imageColor,
          imageAspect: imageAspect || null,
          imageShape: imageShape,
          imageSize: imageSize,
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
        // Filtrer les coordonnées factices d'exemples de prompts (ex: cx: 120, cy: -40)
        const isDummyPlaceholder = (cx !== null && cy !== null && Math.abs(cx - 120) < 3 && Math.abs(cy - (-40)) < 3);

        const fromNode = this.findNode(fromRef, root) || this.findNodeByText(fromRef, root);
        const toNode = this.findNode(toRef, root) || this.findNodeByText(toRef, root);

        if (fromNode && toNode && fromNode.id !== toNode.id) {
          this.relationships.push({
            id: `rel_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            fromId: fromNode.id,
            toId: toNode.id,
            label: label || 'VOIR AUSSI',
            color: color || '',
            customControl: (cx !== null && cy !== null && !isDummyPlaceholder) ? { x: cx, y: cy } : null
          });
        }
      }
    }

    // Extraction des enclos / clôtures <!-- mindmap-boundary: RACINE | label: ... | color: ... -->
    this.boundaries = [];
    if (markdownContent) {
      const bndRegex = /<!--\s*mindmap-boundary:\s*(.+?)(?:\s*\|\s*label:\s*(.*?))?(?:\s*\|\s*color:\s*(.*?))?\s*-->/g;
      let bndMatch;
      while ((bndMatch = bndRegex.exec(markdownContent)) !== null) {
        const rootRef = bndMatch[1].trim();
        const label = bndMatch[2] !== undefined ? bndMatch[2].trim() : 'ENCLOS';
        const color = bndMatch[3] !== undefined ? bndMatch[3].trim() : '';

        const targetNode = this.findNode(rootRef, root) || this.findNodeByText(rootRef, root);
        if (targetNode && targetNode.id !== 'root') {
          this.boundaries.push({
            id: `bnd_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            rootId: targetNode.id,
            label: label || 'ENCLOS',
            color: color || ''
          });
        }
      }
    }

    // Extraction des sujets flottants (Floating Topics style XMind)
    this.floatingTopics = [];
    if (markdownContent) {
      // 1. Blocs avec sous-arborescences
      const blockFloatRegex = /<!--\s*mindmap-floating-start:\s*(.+?)(?:\s*\|\s*marker:\s*(.*?))?(?:\s*\|\s*x:\s*(-?\d+(?:\.\d+)?))?(?:\s*\|\s*y:\s*(-?\d+(?:\.\d+)?))?(?:\s*\|\s*color:\s*(.*?))?\s*-->([\s\S]*?)<!--\s*mindmap-floating-end\s*-->/g;
      let blockMatch;
      while ((blockMatch = blockFloatRegex.exec(markdownContent)) !== null) {
        let text = blockMatch[1].trim().toUpperCase();
        let ftMarker = (blockMatch[2] || '').trim().toLowerCase() || null;
        if (!ftMarker) {
          const ftMarkerMatch = text.match(/<!--\s*marker:\s*([a-zA-Z0-9_-]+)\s*-->/i);
          if (ftMarkerMatch) {
            ftMarker = ftMarkerMatch[1].trim().toLowerCase();
            text = text.replace(ftMarkerMatch[0], '').trim();
          }
        }
        if (!ftMarker) {
          const pMatch = text.match(/^\[([1-9]|p[1-4])\]\s*/i) || text.match(/^\(([1-9]|p[1-4])\)\s*/i);
          if (pMatch) {
            ftMarker = pMatch[1].toLowerCase();
            text = text.replace(pMatch[0], '').trim();
          }
        }
        const fx = blockMatch[3] !== undefined ? parseFloat(blockMatch[3]) : 200;
        const fy = blockMatch[4] !== undefined ? parseFloat(blockMatch[4]) : 100;
        const color = blockMatch[5] !== undefined ? blockMatch[5].trim() : '#0284c7';
        const innerMd = blockMatch[6] || '';

        const ftNode = {
          id: `float_${idCounter++}`,
          text: text,
          marker: ftMarker,
          ref: '',
          note: '',
          color: color || '#0284c7',
          x: fx,
          y: fy,
          width: 100,
          height: 30,
          level: 1,
          side: 'right',
          children: [],
          isFloating: true
        };

        const ftLines = innerMd.split(/\r?\n/);
        const ftStack = [{ node: ftNode, indent: -1 }];
        for (const ftRawLine of ftLines) {
          const ftLine = ftRawLine.trimEnd();
          const ftMatch = ftLine.match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/);
          if (ftMatch) {
            const indent = ftMatch[1].length;
            let cText = ftMatch[3].trim();
            let cRef = '';
            let cNote = '';
            let cMarker = null;

            const nMatch = cText.match(/<!--\s*note:\s*([\s\S]*?)\s*-->/);
            if (nMatch) {
              cNote = nMatch[1].trim();
              cText = cText.replace(nMatch[0], '').trim();
            }

            const mMatch = cText.match(/<!--\s*marker:\s*([a-zA-Z0-9_-]+)\s*-->/i);
            if (mMatch) {
              cMarker = mMatch[1].trim().toLowerCase();
              cText = cText.replace(mMatch[0], '').trim();
            }
            if (!cMarker) {
              const pMatch = cText.match(/^\[([1-9]|p[1-4])\]\s*/i) || cText.match(/^\(([1-9]|p[1-4])\)\s*/i);
              if (pMatch) {
                cMarker = pMatch[1].toLowerCase();
                cText = cText.replace(pMatch[0], '').trim();
              }
            }

            let rMatch = cText.match(/\[([A-Za-z0-9À-ÿ\s:.,\-–—]+)\]\s*$/);
            if (rMatch) {
              cRef = rMatch[1].trim();
              cText = cText.replace(rMatch[0], '').trim();
            } else {
              rMatch = cText.match(/^\s*\[([A-Za-z0-9À-ÿ\s:.,\-–—]+)\]\s*/);
              if (rMatch) {
                cRef = rMatch[1].trim();
                cText = cText.replace(rMatch[0], '').trim();
              }
            }

            const childNode = {
              id: `node_${idCounter++}`,
              text: cText.toUpperCase(),
              marker: cMarker,
              ref: cRef,
              note: cNote,
              color: color || '#0284c7',
              children: [],
              level: 2,
              side: 'right'
            };

            while (ftStack.length > 1 && ftStack[ftStack.length - 1].indent >= indent) {
              ftStack.pop();
            }
            const parent = ftStack[ftStack.length - 1].node;
            childNode.level = parent.level + 1;
            parent.children.push(childNode);
            ftStack.push({ node: childNode, indent });
          }
        }

        this.floatingTopics.push(ftNode);
      }

      // 2. Sujets flottants d'une seule ligne
      const singleFloatRegex = /<!--\s*mindmap-floating:\s*(.+?)(?:\s*\|\s*marker:\s*(.*?))?(?:\s*\|\s*x:\s*(-?\d+(?:\.\d+)?))?(?:\s*\|\s*y:\s*(-?\d+(?:\.\d+)?))?(?:\s*\|\s*color:\s*(.*?))?\s*-->/g;
      let singleMatch;
      while ((singleMatch = singleFloatRegex.exec(markdownContent)) !== null) {
        let text = singleMatch[1].trim().toUpperCase();
        let sMarker = (singleMatch[2] || '').trim().toLowerCase() || null;
        if (!sMarker) {
          const sMarkerMatch = text.match(/<!--\s*marker:\s*([a-zA-Z0-9_-]+)\s*-->/i);
          if (sMarkerMatch) {
            sMarker = sMarkerMatch[1].trim().toLowerCase();
            text = text.replace(sMarkerMatch[0], '').trim();
          }
        }
        if (!sMarker) {
          const pMatch = text.match(/^\[([1-9]|p[1-4])\]\s*/i) || text.match(/^\(([1-9]|p[1-4])\)\s*/i);
          if (pMatch) {
            sMarker = pMatch[1].toLowerCase();
            text = text.replace(pMatch[0], '').trim();
          }
        }
        const fx = singleMatch[3] !== undefined ? parseFloat(singleMatch[3]) : 200;
        const fy = singleMatch[4] !== undefined ? parseFloat(singleMatch[4]) : 100;
        const color = singleMatch[5] !== undefined ? singleMatch[5].trim() : '#0284c7';

        this.floatingTopics.push({
          id: `float_${idCounter++}`,
          text: text,
          marker: sMarker,
          ref: '',
          note: '',
          color: color || '#0284c7',
          x: fx,
          y: fy,
          width: 100,
          height: 30,
          level: 1,
          side: 'right',
          children: [],
          isFloating: true
        });
      }
    }

    return root;
  },

  treeToMarkdown(tree = this.tree) {
    if (!tree) return '';
    let md = '';
    if (this.treeStructure && this.treeStructure !== 'radiant') {
      md += `<!-- mindmap-layout: ${this.treeStructure} -->\n`;
    }
    if (this.connectorStyle && this.connectorStyle !== 'curve') {
      md += `<!-- mindmap-connector: ${this.connectorStyle} -->\n`;
    }
    if (this.nodeShape && this.nodeShape !== 'underline') {
      md += `<!-- mindmap-node-shape: ${this.nodeShape} -->\n`;
    }
    if (tree && tree.icon) {
      md += `<!-- mindmap-root-icon: ${tree.icon} -->\n`;
    }
    if (tree && tree.image) {
      md += `<!-- mindmap-root-image: ${this.serializeImageDirective(tree)} -->\n`;
    }
    const serializeChildren = (node, indentLevel) => {
      if (!node || !node.children) return;
      for (const child of node.children) {
        const indent = '  '.repeat(indentLevel);
        const markerPart = child.marker ? ` <!-- marker: ${child.marker} -->` : '';
        const iconPart = child.icon ? ` <!-- icon: ${child.icon} -->` : '';
        const imagePart = child.image ? ` <!-- image: ${this.serializeImageDirective(child)} -->` : '';
        const refPart = child.ref ? ` [${child.ref}]` : '';
        const notePart = child.note ? ` <!-- note: ${child.note.replace(/\r?\n/g, ' ')} -->` : '';
        md += `${indent}- ${child.text}${refPart}${notePart}${markerPart}${iconPart}${imagePart}\n`;
        serializeChildren(child, indentLevel + 1);
      }
    };

    serializeChildren(tree, 0);

    // Sérialisation des positions spatiales manuelles (Free Positioning)
    const offsets = [];
    const collectOffsets = (node) => {
      if (node.id !== 'root' && !node.isFloating && (Math.round(node.offsetX || 0) !== 0 || Math.round(node.offsetY || 0) !== 0)) {
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

    // Sérialisation des enclos / clôtures (Boundaries style XMind)
    if (this.boundaries && this.boundaries.length > 0) {
      md += '\n';
      this.boundaries.forEach(bnd => {
        const rootNode = this.findNode(bnd.rootId, tree || this.tree);
        if (rootNode) {
          const rootText = rootNode.text.replace(/\|/g, '');
          const labelPart = bnd.label ? ` | label: ${bnd.label.replace(/\|/g, '')}` : '';
          const colorPart = bnd.color ? ` | color: ${bnd.color}` : '';
          md += `<!-- mindmap-boundary: ${rootText}${labelPart}${colorPart} -->\n`;
        }
      });
    }

    // Sérialisation des sujets flottants (Floating Topics style XMind)
    if (this.floatingTopics && this.floatingTopics.length > 0) {
      md += '\n';
      this.floatingTopics.forEach(ft => {
        const cleanText = ft.text.replace(/\|/g, '');
        const markerPart = ft.marker ? ` | marker: ${ft.marker}` : '';
        const xVal = Math.round(ft.x || 0);
        const yVal = Math.round(ft.y || 0);
        const colorPart = ft.color ? ` | color: ${ft.color}` : '';

        if (ft.children && ft.children.length > 0) {
          md += `<!-- mindmap-floating-start: ${cleanText}${markerPart} | x: ${xVal} | y: ${yVal}${colorPart} -->\n`;
          serializeChildren(ft, 0);
          md += `<!-- mindmap-floating-end -->\n`;
        } else {
          md += `<!-- mindmap-floating: ${cleanText}${markerPart} | x: ${xVal} | y: ${yVal}${colorPart} -->\n`;
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
      this.layoutFloatingTopics();
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
      this.layoutFloatingTopics();
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
    this.layoutFloatingTopics();
  },

  layoutFloatingTopics() {
    if (!this.floatingTopics || this.floatingTopics.length === 0) return;
    this.floatingTopics.forEach(ft => {
      ft.side = 'right';
      this.propagateColorAndSide(ft, ft.color || '#0284c7', 'right');
      this.measureNode(ft);
      if (ft.children && ft.children.length > 0) {
        this.layoutChildren(ft, 'right');
      }
      this.applyNodeOffsets(ft);
    });
  },

  applyNodeOffsets(node = this.tree, inheritedDx = 0, inheritedDy = 0) {
    if (!node) return;
    const totalDx = inheritedDx + (node.offsetX || 0);
    const totalDy = inheritedDy + (node.offsetY || 0);
    if (node.id !== 'root' && !node.isFloating) {
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

  // Table des abréviations bibliques françaises pour les pastilles de carte mentale
  formatScripturePillRef(ref) {
    if (!ref) return '';
    const trimmed = ref.trim();
    const BIBLE_FR_ABBR = {
      'Genèse': 'Gn', 'Exode': 'Ex', 'Lévitique': 'Lv', 'Nombres': 'Nb', 'Deutéronome': 'Dt',
      'Josué': 'Jos', 'Juges': 'Jg', 'Ruth': 'Rt', '1 Samuel': '1S', '2 Samuel': '2S',
      '1 Rois': '1R', '2 Rois': '2R', '1 Chroniques': '1Ch', '2 Chroniques': '2Ch',
      'Esdras': 'Esd', 'Néhémie': 'Néh', 'Esther': 'Est', 'Job': 'Jb', 'Psaumes': 'Ps',
      'Psaume': 'Ps', 'Proverbes': 'Pr', 'Ecclésiaste': 'Ec', 'Cantique': 'Ct',
      'Ésaïe': 'És', 'Jérémie': 'Jr', 'Lamentations': 'La', 'Ézéchiel': 'Éz', 'Daniel': 'Da',
      'Osée': 'Os', 'Joël': 'Jl', 'Amos': 'Am', 'Abdias': 'Ab', 'Jonas': 'Jon',
      'Michée': 'Mi', 'Nahum': 'Na', 'Habacuc': 'Ha', 'Sophonie': 'So', 'Aggée': 'Ag',
      'Zacharie': 'Za', 'Malachie': 'Ml', 'Matthieu': 'Mt', 'Marc': 'Mc', 'Luc': 'Lc',
      'Jean': 'Jn', 'Actes': 'Ac', 'Romains': 'Rm', '1 Corinthiens': '1Co', '2 Corinthiens': '2Co',
      'Galates': 'Ga', 'Éphésiens': 'Ép', 'Philippiens': 'Ph', 'Colossiens': 'Col',
      '1 Thessaloniciens': '1Th', '2 Thessaloniciens': '2Th', '1 Timothée': '1Tm',
      '2 Timothée': '2Tm', 'Tite': 'Tt', 'Philémon': 'Phm', 'Hébreux': 'Héb', 'Jacques': 'Jc',
      '1 Pierre': '1P', '2 Pierre': '2P', '1 Jean': '1Jn', '2 Jean': '2Jn', '3 Jean': '3Jn',
      'Jude': 'Jd', 'Apocalypse': 'Ap'
    };
    let shortRef = trimmed;
    for (const [full, abbr] of Object.entries(BIBLE_FR_ABBR)) {
      if (trimmed.toLowerCase().startsWith(full.toLowerCase())) {
        shortRef = abbr + trimmed.slice(full.length);
        break;
      }
    }
    return shortRef.length > 15 ? shortRef.slice(0, 13) + '…' : shortRef;
  },

  getTextWidth(text, fontSize = 11.5, fontWeight = '700') {
    if (!this._measureCanvas) {
      this._measureCanvas = document.createElement('canvas');
      this._measureCtx = this._measureCanvas.getContext('2d');
    }
    this._measureCtx.font = `${fontWeight} ${fontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    const baseW = this._measureCtx.measureText(text || '').width;
    const strLen = text ? text.length : 0;
    const tracking = strLen * (fontSize >= 13 ? 0.65 : 0.55);
    const safetyBuffer = 6;
    return Math.ceil(baseW + tracking + safetyBuffer);
  },

  calcImageCover(vW, vH, imgAspect, zoom, panX, panY) {
    const w = Math.max(1, vW || 100);
    const h = Math.max(1, vH || 100);
    const R = (typeof imgAspect === 'number' && imgAspect > 0) ? imgAspect : 1.0;
    const Z = (typeof zoom === 'number' && zoom >= 0.95) ? zoom : 1.0;
    const Px = typeof panX === 'number' ? panX : 0;
    const Py = typeof panY === 'number' ? panY : 0;

    const boxAspect = w / h;
    let baseW, baseH;
    if (R >= boxAspect) {
      baseH = h;
      baseW = h * R;
    } else {
      baseW = w;
      baseH = w / R;
    }

    const renderW = baseW * Z;
    const renderH = baseH * Z;
    const maxPanX = Math.max(0, (renderW - w) / 2);
    const maxPanY = Math.max(0, (renderH - h) / 2);

    const clampedPx = Math.max(-100, Math.min(100, Px));
    const clampedPy = Math.max(-100, Math.min(100, Py));

    const offsetX = (clampedPx / 100) * maxPanX;
    const offsetY = (clampedPy / 100) * maxPanY;

    return {
      vW: w,
      vH: h,
      renderW,
      renderH,
      maxPanX,
      maxPanY,
      offsetX,
      offsetY,
      clampedPx,
      clampedPy
    };
  },

  measureNode(node) {
    const hasImg = !!node.image;
    const imgMode = node.imageMode || 'background';

    if (node.isFloating) {
      if (hasImg && imgMode === 'image-only') {
        const s = (node.imageSize && node.imageSize >= 36 && node.imageSize <= 260) ? node.imageSize : 56;
        node.textWidth = 0;
        node.markerWidth = 0;
        node.refPillWidth = 0;
        node.notePillWidth = 0;
        node.width = s;
        node.height = s;
        node.contentWidth = s;
      } else {
        const textW = this.getTextWidth(node.text, 12, '800');
        node.textWidth = textW;

        let markerW = 0;
        if (node.marker) {
          const isP = String(node.marker).toLowerCase().startsWith('p');
          node.markerWidth = isP ? 22 : 18;
          markerW = node.markerWidth + 6;
        } else {
          node.markerWidth = 0;
        }

        let refW = 0;
        if (node.ref) {
          const displayRef = this.formatScripturePillRef(node.ref);
          const refTextW = this.getTextWidth(displayRef, 9, '700');
          node.refPillWidth = Math.max(38, Math.min(94, refTextW + 14));
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

        if (hasImg && imgMode === 'top-image') {
          const footerContentW = textW + (node.ref ? refW : 0) + (node.note ? noteW : 0);
          node.contentWidth = footerContentW;
          node.width = Math.max(104, footerContentW + 26);
          node.height = 76; // 46px topImg + 30px footer
        } else {
          node.contentWidth = markerW + (node.icon ? 22 : 0) + textW + refW + noteW;
          node.width = Math.max(92, node.contentWidth + 32);
          node.height = hasImg ? 36 : 30;
        }
      }
    } else if (node.level === 0) {
      // NIVEAU 0 (Thème général / Noyau central dominant Buzan - médaillon circulaire polychrome)
      if (hasImg && imgMode === 'image-only') {
        const s = (node.imageSize && node.imageSize >= 36 && node.imageSize <= 260) ? node.imageSize : 104;
        const rootR = Math.round(s / 2);
        node.rootRadius = rootR;
        node.width = s;
        node.height = s;
        node.textWidth = 0;
        node.markerWidth = 0;
        node.iconWidth = 0;
      } else {
        const textW = this.getTextWidth(node.text, 15, '900');
        node.textWidth = textW;
        node.markerWidth = 0;
        const iconW = node.icon ? 38 : 0;
        node.iconWidth = iconW;

        // Rayon harmonieux pour le médaillon circulaire Buzan (évite tout disque démesuré sur titre long)
        const words = (node.text || '').trim().split(/\s+/);
        const isMultiWord = words.length >= 3 && node.text.length > 15;
        const effectiveTextW = isMultiWord ? textW * 0.58 : textW;
        const rootR = Math.max(node.image ? 58 : 48, Math.min(88, Math.max(effectiveTextW * 0.52 + 16, node.icon ? 56 : 46)));
        node.rootRadius = rootR;
        node.width = rootR * 2;
        node.height = rootR * 2;
      }
    } else if (node.level === 1) {
      // NIVEAU 1 (BOIs - Règles de Buzan : mots-clés forces, affirmé et contrasté)
      if (hasImg && imgMode === 'image-only') {
        const s = (node.imageSize && node.imageSize >= 36 && node.imageSize <= 260) ? node.imageSize : 68;
        node.textWidth = 0;
        node.markerWidth = 0;
        node.refPillWidth = 0;
        node.notePillWidth = 0;
        node.width = s;
        node.height = s;
        node.contentWidth = s;
      } else {
        const textW = this.getTextWidth(node.text, 14, '800');
        node.textWidth = textW;

        let markerW = 0;
        if (node.marker) {
          const isP = String(node.marker).toLowerCase().startsWith('p');
          node.markerWidth = isP ? 22 : 18;
          markerW = node.markerWidth + 6;
        } else {
          node.markerWidth = 0;
        }

        let refW = 0;
        if (node.ref) {
          const displayRef = this.formatScripturePillRef(node.ref);
          const refTextW = this.getTextWidth(displayRef, 9.5, '700');
          node.refPillWidth = Math.max(40, Math.min(100, refTextW + 16));
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

        if (hasImg && imgMode === 'top-image') {
          const footerContentW = textW + (node.ref ? refW : 0) + (node.note ? noteW : 0);
          node.contentWidth = footerContentW;
          node.width = Math.max(120, footerContentW + 28);
          node.height = 82; // 52px topImg + 30px footer
        } else {
          node.contentWidth = markerW + (node.icon ? 22 : 0) + textW + refW + noteW;
          const minW = node.image ? 116 : 96;
          node.width = Math.max(minW, node.contentWidth + 36);
          node.height = node.image ? 40 : 36; // Plus imposant que les niveaux inférieurs (36px vs 28px/24px)
        }
      }
    } else if (node.level === 2) {
      // NIVEAU 2 (Sous-branches subordonnées)
      if (hasImg && imgMode === 'image-only') {
        const s = (node.imageSize && node.imageSize >= 36 && node.imageSize <= 260) ? node.imageSize : 52;
        node.textWidth = 0;
        node.markerWidth = 0;
        node.refPillWidth = 0;
        node.notePillWidth = 0;
        node.width = s;
        node.height = s;
        node.contentWidth = s;
      } else {
        const textW = this.getTextWidth(node.text, 11.5, '700');
        node.textWidth = textW;

        let markerW = 0;
        if (node.marker) {
          const isP = String(node.marker).toLowerCase().startsWith('p');
          node.markerWidth = isP ? 22 : 18;
          markerW = node.markerWidth + 6;
        } else {
          node.markerWidth = 0;
        }

        let refW = 0;
        if (node.ref) {
          const displayRef = this.formatScripturePillRef(node.ref);
          const refTextW = this.getTextWidth(displayRef, 9, '700');
          node.refPillWidth = Math.max(38, Math.min(94, refTextW + 14));
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

        if (hasImg && imgMode === 'top-image') {
          const footerContentW = textW + (node.ref ? refW : 0) + (node.note ? noteW : 0);
          node.contentWidth = footerContentW;
          node.width = Math.max(100, footerContentW + 26);
          node.height = 72; // 44px topImg + 28px footer
        } else {
          node.contentWidth = markerW + (node.icon ? 22 : 0) + textW + refW + noteW;
          const minW = node.image ? 104 : 82;
          node.width = Math.max(minW, node.contentWidth + 30);
          node.height = node.image ? 32 : 28;
        }
      }
    } else {
      // NIVEAU 3+ (Détails fins légers)
      if (hasImg && imgMode === 'image-only') {
        const s = (node.imageSize && node.imageSize >= 36 && node.imageSize <= 260) ? node.imageSize : 44;
        node.textWidth = 0;
        node.markerWidth = 0;
        node.refPillWidth = 0;
        node.notePillWidth = 0;
        node.width = s;
        node.height = s;
        node.contentWidth = s;
      } else {
        const textW = this.getTextWidth(node.text, 10, '600');
        node.textWidth = textW;

        let markerW = 0;
        if (node.marker) {
          const isP = String(node.marker).toLowerCase().startsWith('p');
          node.markerWidth = isP ? 22 : 18;
          markerW = node.markerWidth + 6;
        } else {
          node.markerWidth = 0;
        }

        let refW = 0;
        if (node.ref) {
          const displayRef = this.formatScripturePillRef(node.ref);
          const refTextW = this.getTextWidth(displayRef, 8.5, '700');
          node.refPillWidth = Math.max(36, Math.min(90, refTextW + 12));
          refW = node.refPillWidth + 6;
        } else {
          node.refPillWidth = 0;
        }

        let noteW = 0;
        if (node.note) {
          node.notePillWidth = 18;
          noteW = 18 + 6;
        } else {
          node.notePillWidth = 0;
        }

        if (hasImg && imgMode === 'top-image') {
          const footerContentW = textW + (node.ref ? refW : 0) + (node.note ? noteW : 0);
          node.contentWidth = footerContentW;
          node.width = Math.max(88, footerContentW + 24);
          node.height = 64; // 38px topImg + 26px footer
        } else {
          node.contentWidth = markerW + (node.icon ? 22 : 0) + textW + refW + noteW;
          const minW = node.image ? 96 : 68;
          node.width = Math.max(minW, node.contentWidth + 26);
          node.height = node.image ? 28 : 24;
        }
      }
    }

    if (!node.children || node.children.length === 0) {
      const contentHeight = node.height + 18; // Espace négatif
      const hasBoundary = this.boundaries && this.boundaries.some(b => b.rootId === node.id);
      node.boundaryTop = hasBoundary ? 42 : 0;
      node.boundaryBottom = hasBoundary ? 28 : 0;
      node.contentHeight = contentHeight;
      node.totalHeight = contentHeight + node.boundaryTop + node.boundaryBottom;
      return;
    }

    let sum = 0;
    node.children.forEach(child => {
      this.measureNode(child);
      sum += (child.totalHeight || child.height + 18 || 30);
    });
    const contentHeight = Math.max(node.height + 18, sum);
    const hasBoundary = this.boundaries && this.boundaries.some(b => b.rootId === node.id);
    node.boundaryTop = hasBoundary ? 42 : 0;
    node.boundaryBottom = hasBoundary ? 28 : 0;
    node.contentHeight = contentHeight;
    node.totalHeight = contentHeight + node.boundaryTop + node.boundaryBottom;
  },

  measureTopDown(node) {
    const hasImg = !!node.image;
    const imgMode = node.imageMode || 'background';

    if (node.level === 0) {
      if (hasImg && imgMode === 'image-only') {
        const s = (node.imageSize && node.imageSize >= 36 && node.imageSize <= 260) ? node.imageSize : 104;
        const rootR = Math.round(s / 2);
        node.rootRadius = rootR;
        node.width = s;
        node.height = s;
        node.textWidth = 0;
        node.markerWidth = 0;
        node.iconWidth = 0;
      } else {
        const textW = this.getTextWidth(node.text, 15, '900');
        node.textWidth = textW;
        node.markerWidth = 0;
        const iconW = node.icon ? 38 : 0;
        node.iconWidth = iconW;
        const words = (node.text || '').trim().split(/\s+/);
        const isMultiWord = words.length >= 3 && node.text.length > 15;
        const effectiveTextW = isMultiWord ? textW * 0.58 : textW;
        const rootR = Math.max(48, Math.min(82, Math.max(effectiveTextW * 0.52 + 16, node.icon ? 56 : 46)));
        node.rootRadius = rootR;
        node.width = rootR * 2;
        node.height = rootR * 2;
      }
    } else if (node.level === 1) {
      if (hasImg && imgMode === 'image-only') {
        const s = (node.imageSize && node.imageSize >= 36 && node.imageSize <= 260) ? node.imageSize : 68;
        node.textWidth = 0;
        node.markerWidth = 0;
        node.refPillWidth = 0;
        node.notePillWidth = 0;
        node.width = s;
        node.height = s;
        node.contentWidth = s;
      } else {
        const textW = this.getTextWidth(node.text, 14, '800');
        node.textWidth = textW;

        let markerW = 0;
        if (node.marker) {
          const isP = String(node.marker).toLowerCase().startsWith('p');
          node.markerWidth = isP ? 22 : 18;
          markerW = node.markerWidth + 6;
        } else {
          node.markerWidth = 0;
        }

        let refW = 0;
        if (node.ref) {
          const displayRef = this.formatScripturePillRef(node.ref);
          const refTextW = this.getTextWidth(displayRef, 9.5, '700');
          node.refPillWidth = Math.max(40, Math.min(100, refTextW + 16));
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

        if (hasImg && imgMode === 'top-image') {
          const footerContentW = textW + (node.ref ? refW : 0) + (node.note ? noteW : 0);
          node.contentWidth = footerContentW;
          node.width = Math.max(120, footerContentW + 28);
          node.height = 82; // 52px topImg + 30px footer
        } else {
          node.contentWidth = markerW + textW + refW + noteW;
          node.width = Math.max(96, node.contentWidth + 36);
          node.height = 36;
        }
      }
    } else if (node.level === 2) {
      if (hasImg && imgMode === 'image-only') {
        const s = (node.imageSize && node.imageSize >= 36 && node.imageSize <= 260) ? node.imageSize : 52;
        node.textWidth = 0;
        node.markerWidth = 0;
        node.refPillWidth = 0;
        node.notePillWidth = 0;
        node.width = s;
        node.height = s;
        node.contentWidth = s;
      } else {
        const textW = this.getTextWidth(node.text, 11.5, '700');
        node.textWidth = textW;

        let markerW = 0;
        if (node.marker) {
          const isP = String(node.marker).toLowerCase().startsWith('p');
          node.markerWidth = isP ? 22 : 18;
          markerW = node.markerWidth + 6;
        } else {
          node.markerWidth = 0;
        }

        let refW = 0;
        if (node.ref) {
          const displayRef = this.formatScripturePillRef(node.ref);
          const refTextW = this.getTextWidth(displayRef, 9, '700');
          node.refPillWidth = Math.max(38, Math.min(94, refTextW + 14));
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

        if (hasImg && imgMode === 'top-image') {
          const footerContentW = textW + (node.ref ? refW : 0) + (node.note ? noteW : 0);
          node.contentWidth = footerContentW;
          node.width = Math.max(100, footerContentW + 26);
          node.height = 72; // 44px topImg + 28px footer
        } else {
          node.contentWidth = markerW + textW + refW + noteW;
          node.width = Math.max(82, node.contentWidth + 30);
          node.height = 28;
        }
      }
    } else {
      if (hasImg && imgMode === 'image-only') {
        const s = (node.imageSize && node.imageSize >= 36 && node.imageSize <= 260) ? node.imageSize : 44;
        node.textWidth = 0;
        node.markerWidth = 0;
        node.refPillWidth = 0;
        node.notePillWidth = 0;
        node.width = s;
        node.height = s;
        node.contentWidth = s;
      } else {
        const textW = this.getTextWidth(node.text, 10, '600');
        node.textWidth = textW;

        let markerW = 0;
        if (node.marker) {
          const isP = String(node.marker).toLowerCase().startsWith('p');
          node.markerWidth = isP ? 22 : 18;
          markerW = node.markerWidth + 6;
        } else {
          node.markerWidth = 0;
        }

        let refW = 0;
        if (node.ref) {
          const displayRef = this.formatScripturePillRef(node.ref);
          const refTextW = this.getTextWidth(displayRef, 8.5, '700');
          node.refPillWidth = Math.max(36, Math.min(90, refTextW + 12));
          refW = node.refPillWidth + 6;
        } else {
          node.refPillWidth = 0;
        }

        let noteW = 0;
        if (node.note) {
          node.notePillWidth = 18;
          noteW = 18 + 6;
        } else {
          node.notePillWidth = 0;
        }

        const iconW = node.icon ? 20 : 0;
        node.iconWidth = iconW;

        if (hasImg && imgMode === 'top-image') {
          const footerContentW = textW + (node.ref ? refW : 0) + (node.note ? noteW : 0);
          node.contentWidth = footerContentW;
          node.width = Math.max(88, footerContentW + 24);
          node.height = 64; // 38px topImg + 26px footer
        } else {
          node.contentWidth = markerW + iconW + textW + refW + noteW;
          node.width = Math.max(68, node.contentWidth + 26);
          node.height = 24;
        }
      }
    }

    if (!node.children || node.children.length === 0) {
      const contentWidth = node.width + 28; // Marge négative horizontale entre feuilles
      const hasBoundary = this.boundaries && this.boundaries.some(b => b.rootId === node.id);
      node.boundaryLeft = hasBoundary ? 24 : 0;
      node.boundaryRight = hasBoundary ? 24 : 0;
      node.contentWidth = contentWidth;
      node.totalWidth = contentWidth + node.boundaryLeft + node.boundaryRight;
      return;
    }

    let sum = 0;
    node.children.forEach(child => {
      this.measureTopDown(child);
      sum += (child.totalWidth || child.width + 28 || 40);
    });
    const contentWidth = Math.max(node.width + 28, sum);
    const hasBoundary = this.boundaries && this.boundaries.some(b => b.rootId === node.id);
    node.boundaryLeft = hasBoundary ? 24 : 0;
    node.boundaryRight = hasBoundary ? 24 : 0;
    node.contentWidth = contentWidth;
    node.totalWidth = contentWidth + node.boundaryLeft + node.boundaryRight;
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
    if (!bois || bois.length === 0) return;

    const dir = side === 'right' ? 1 : -1;
    const N = bois.length;

    // Règles de Buzan : tous les BOIs (niveau 1) sont à la même distance uniforme du bloc principal
    const rootW = this.tree ? (this.tree.width || 140) : 140;
    const rootH = this.tree ? (this.tree.height || 46) : 46;
    const uniformDist = 115; // Distance constante entre le bord du bloc central et le bord du BOI

    if (N === 1) {
      const boi = bois[0];
      boi.x = dir * (rootW / 2 + uniformDist + (boi.width || 80) / 2);
      boi.y = 0;
      this.layoutChildren(boi, side);
      return;
    }

    // Répartition verticale stricte garantissant l'absence totale de chevauchement entre sous-arbres
    const totalHeight = bois.reduce((acc, b) => acc + (b.totalHeight || b.height + 18 || 40), 0);
    let currentY = -totalHeight / 2;

    bois.forEach(boi => {
      const bH = boi.totalHeight || (boi.height + 18) || 40;
      const bTop = boi.boundaryTop || 0;
      const bBot = boi.boundaryBottom || 0;
      const cHeight = boi.contentHeight || (bH - bTop - bBot);

      // Centrage vertical du contenu de chaque sous-arbre dans son espace alloué dédié
      boi.y = currentY + bTop + cHeight / 2;

      // Position horizontale : garantit la distance uniforme par rapport au contour du médaillon central
      boi.x = dir * (rootW / 2 + uniformDist + (boi.width || 80) / 2);

      this.layoutChildren(boi, side);
      currentY += bH;
    });
  },

  layoutChildren(parent, side) {
    if (!parent.children || parent.children.length === 0) return;

    const dir = side === 'right' ? 1 : -1;
    const clearHorizGap = 76; // Espace horizontal net garanti entre bord parent et bord enfant (dégage les boutons d'action)
    const childrenTotalHeight = parent.children.reduce((acc, c) => acc + (c.totalHeight || c.height + 18 || 30), 0);
    let currentY = parent.y - childrenTotalHeight / 2;

    parent.children.forEach(child => {
      const cH = child.totalHeight || (child.height + 18) || 30;
      const bTop = child.boundaryTop || 0;
      const bBot = child.boundaryBottom || 0;
      const cHeight = child.contentHeight || (cH - bTop - bBot);
      const centerY = currentY + bTop + cHeight / 2;

      child.x = parent.x + dir * ((parent.width || 80) / 2 + clearHorizGap + (child.width || 80) / 2);
      child.y = centerY;

      this.layoutChildren(child, side);
      currentY += cH;
    });
  },

  // =========================================================================
  // RENDU SVG GRAPHIQUE PUR (Zéro Émoji, Courbes de Bézier vivantes)
  // =========================================================================

  render(note) {
    this.currentNote = note;
    document.body.classList.add('has-mindmap');
    if (!this.container) this.init();

    this.tree = this.parseMarkdownToTree(note.title, note.content);
    this.layoutTree();

    // Initialiser l'historique pour cette note
    this.history = [];
    this.historyIndex = -1;
    this.pushHistory();

    this.svg = this.container?.querySelector('.mindmap-svg-canvas') || document.getElementById('mindmap-svg');
    this.viewportG = this.container?.querySelector('#mindmap-viewport') || this.svg?.querySelector('g') || document.getElementById('mindmap-viewport');

    const svgEl = this.svg;
    const outlineEl = this.container?.querySelector('.mindmap-outline-container') || document.getElementById('mindmap-outline-view');

    if (this.viewMode === 'outline') {
      svgEl?.classList.add('hidden');
      outlineEl?.classList.remove('hidden');
      this.renderOutlineView();
    } else {
      outlineEl?.classList.add('hidden');
      svgEl?.classList.remove('hidden');
      this.draw();
      this.fitView();
      if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(() => this.fitView());
      }
    }
    this.updateViewModeUI();
    this.updateStructureUI();
    this.updateStylesUI();

    const fsTitleEl = document.getElementById('mm-fs-note-title');
    const fsRefEl = document.getElementById('mm-fs-note-ref');
    if (fsTitleEl) fsTitleEl.textContent = note.title || 'Mind Map';
    if (fsRefEl) {
      const ref = (note.reference || '').trim();
      fsRefEl.textContent = ref ? `Passage : ${ref}` : '';
      fsRefEl.style.display = ref ? 'inline' : 'none';
    }
  },

  refreshView() {
    this.layoutTree();
    if (this.viewMode === 'outline') {
      this.renderOutlineView();
    } else {
      this.draw();
    }
  },

  toggleDockExpanded(forceState) {
    const dock = document.getElementById('mindmap-dock') || document.querySelector('.mindmap-dock');
    if (!dock) return;
    const isCurrentlyExp = dock.classList.contains('expanded');
    const newState = (typeof forceState === 'boolean') ? forceState : !isCurrentlyExp;
    dock.classList.toggle('expanded', newState);

    const iconExpand = dock.querySelector('.mm-dock-icon-expand');
    const iconCollapse = dock.querySelector('.mm-dock-icon-collapse');
    const toggleBtn = dock.querySelector('#mm-btn-dock-toggle');
    const toggleLabel = toggleBtn?.querySelector('.mm-dock-label');

    if (iconExpand && iconCollapse) {
      iconExpand.classList.toggle('hidden', newState);
      iconCollapse.classList.toggle('hidden', !newState);
    }
    if (toggleLabel) {
      toggleLabel.textContent = newState ? 'Réduire' : 'Développer';
    }
    if (toggleBtn) {
      toggleBtn.setAttribute('data-tooltip-title', newState ? 'Réduire le bandeau' : 'Développer avec libellés');
    }

    // Repli / Dépli automatique des volets gauche (Menu principal & Liste des notes)
    const notesLayout = document.querySelector('.notes-workspace-layout');
    if (newState) {
      if (typeof App !== 'undefined' && App.setSidebarCollapsed) {
        App.setSidebarCollapsed(true, true);
      }
      if (notesLayout && !notesLayout.classList.contains('notes-sidebar-collapsed')) {
        notesLayout.classList.add('notes-sidebar-collapsed');
        notesLayout.dataset.autoCollapsedByMindmap = 'true';
      }
    } else {
      if (typeof App !== 'undefined' && App.setSidebarCollapsed && App.sidebarAutoCollapsed) {
        App.setSidebarCollapsed(false, true);
      }
      if (notesLayout && notesLayout.dataset.autoCollapsedByMindmap === 'true') {
        notesLayout.classList.remove('notes-sidebar-collapsed');
        delete notesLayout.dataset.autoCollapsedByMindmap;
      }
    }

    try {
      localStorage.setItem('mm_dock_expanded', newState ? 'true' : 'false');
    } catch (e) {}

    // Notifier le redimensionnement pour recentrer et ajuster la carte
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 250);
  },

  initDockTooltips() {
    const dock = document.getElementById('mindmap-dock') || document.querySelector('.mindmap-dock');
    const tooltipEl = document.getElementById('mm-dock-tooltip');
    if (!dock || !tooltipEl) return;

    try {
      const savedExpanded = localStorage.getItem('mm_dock_expanded') === 'true';
      if (savedExpanded) {
        this.toggleDockExpanded(true);
      }
    } catch (e) {}

    let hideTimeout = null;

    const showTooltip = (btn) => {
      const title = btn.getAttribute('data-tooltip-title') || btn.getAttribute('title');
      const kbd = btn.getAttribute('data-tooltip-kbd');
      if (!title) return;

      const titleEl = tooltipEl.querySelector('.mm-dock-tooltip-title');
      const kbdEl = tooltipEl.querySelector('.mm-dock-tooltip-kbd');
      if (titleEl) titleEl.textContent = title;
      if (kbdEl) {
        if (kbd) {
          kbdEl.textContent = kbd;
          kbdEl.style.display = 'inline-flex';
        } else {
          kbdEl.style.display = 'none';
        }
      }

      tooltipEl.classList.remove('hidden');

      const btnRect = btn.getBoundingClientRect();
      const tipRect = tooltipEl.getBoundingClientRect();

      const top = btnRect.top - tipRect.height - 8;
      const left = btnRect.left + (btnRect.width / 2) - (tipRect.width / 2);

      tooltipEl.style.top = `${Math.max(8, top)}px`;
      tooltipEl.style.left = `${Math.max(8, Math.min(window.innerWidth - tipRect.width - 8, left))}px`;
    };

    const hideTooltip = () => {
      tooltipEl.classList.add('hidden');
    };

    dock.querySelectorAll('.mm-dock-btn').forEach(btn => {
      // Retirer l'attribut title natif pour éviter les infobulles grises lentes du navigateur
      const nativeTitle = btn.getAttribute('title');
      if (nativeTitle && !btn.getAttribute('data-tooltip-title')) {
        btn.setAttribute('data-tooltip-title', nativeTitle);
      }
      btn.removeAttribute('title');

      btn.addEventListener('mouseenter', () => {
        clearTimeout(hideTimeout);
        showTooltip(btn);
      });
      btn.addEventListener('mouseleave', () => {
        clearTimeout(hideTimeout);
        hideTimeout = setTimeout(hideTooltip, 60);
      });
      btn.addEventListener('click', () => {
        hideTooltip();
      });
    });
  },

  toggleViewMode(targetMode = null) {
    this.viewMode = targetMode || (this.viewMode === 'map' ? 'outline' : 'map');
    const svgEl = this.container?.querySelector('.mindmap-svg-canvas') || document.getElementById('mindmap-svg');
    const outlineEl = this.container?.querySelector('.mindmap-outline-container') || document.getElementById('mindmap-outline-view');

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
      if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(() => this.fitView());
      }
    }

    this.updateViewModeUI();
  },

  updateViewModeUI() {
    const isOutline = this.viewMode === 'outline';

    // Niveau 2 : Affichage des outils du plan dans la sous-barre
    const subbar = document.getElementById('notes-editor-subbar');
    const subbarActions = document.getElementById('notes-subbar-outline-actions');
    if (subbar) {
      subbar.classList.toggle('hidden', !isOutline);
    }
    if (subbarActions) {
      subbarActions.classList.toggle('hidden', !isOutline);
      if (isOutline) {
        this.bindOutlineToolbarEvents();
      }
    }

    // 1. Bouton en-tête des notes
    const headerBtn = document.getElementById('btn-toggle-mindmap-mode');
    if (headerBtn) {
      headerBtn.classList.toggle('btn-primary', isOutline);
      headerBtn.classList.toggle('btn-secondary', !isOutline);
      headerBtn.title = isOutline ? 'Basculer en Vue Carte Mind Map (Alt+P)' : 'Basculer en Vue Plan Outliner (Alt+P)';
      headerBtn.innerHTML = isOutline ? `
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a4 4 0 0 0-4 4v1a4 4 0 0 0-2 7.5A4 4 0 0 0 8 22h8a4 4 0 0 0 2-7.5A4 4 0 0 0 16 7V6a4 4 0 0 0-4-4Z"/><path d="M12 2v20"/><path d="M8 8h8"/><path d="M7 14h10"/></svg>
      ` : `
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
      `;
    }

    // 2. Bouton dock flottant
    const dockBtn = document.getElementById('mm-btn-toggle-outline');
    if (dockBtn) {
      dockBtn.title = isOutline ? 'Basculer en Vue Carte (Alt+P)' : 'Basculer en Vue Plan (Alt+P)';
      dockBtn.classList.toggle('active', isOutline);
      dockBtn.innerHTML = (isOutline ? `
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a4 4 0 0 0-4 4v1a4 4 0 0 0-2 7.5A4 4 0 0 0 8 22h8a4 4 0 0 0 2-7.5A4 4 0 0 0 16 7V6a4 4 0 0 0-4-4Z"/><path d="M12 2v20"/><path d="M8 8h8"/><path d="M7 14h10"/></svg>
      ` : `
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
      `) + `<span class="mm-dock-label">${isOutline ? 'Carte' : 'Plan'}</span>`;
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
              <div class="mm-outline-root-badge" data-id="root" style="cursor: pointer;" title="Changer l'icône du concept central (I)">
                ${this.tree.icon && typeof SvgIconsRegistry !== 'undefined' && SvgIconsRegistry.get(this.tree.icon)
                  ? SvgIconsRegistry.getSvg(this.tree.icon, 20)
                  : '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a4 4 0 0 0-4 4v1a4 4 0 0 0-2 7.5A4 4 0 0 0 8 22h8a4 4 0 0 0 2-7.5A4 4 0 0 0 16 7V6a4 4 0 0 0-4-4Z"/><path d="M12 2v20"/><path d="M8 8h8"/><path d="M7 14h10"/></svg>'}
              </div>
              <div class="mm-outline-root-title" data-id="root" title="Cliquer pour modifier le concept central">
                ${this.escapeHtml(this.tree.text)}
              </div>
              <div class="mm-outline-actions root-actions" style="opacity: 1;">
                <button type="button" class="btn-icon-subtle" data-action="svg-icon" data-id="root" title="Associer une icône SVG (I)">
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M7 8h10"/></svg>
                </button>
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

            <!-- Section Sujets Flottants (Floating Topics style XMind) -->
            ${(this.floatingTopics && this.floatingTopics.length > 0) ? `
              <div class="mm-outline-floating-section">
                <div class="mm-outline-floating-header">
                  <span class="mm-outline-floating-badge">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="6" width="18" height="12" rx="6"/><circle cx="8" cy="12" r="1.5" fill="currentColor"/><circle cx="16" cy="12" r="1.5" fill="currentColor"/></svg>
                  </span>
                  <span class="mm-outline-floating-title">Sujets Flottants</span>
                  <button type="button" class="btn-icon-subtle" data-action="add-floating-topic" title="Ajouter un sujet flottant">
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  </button>
                </div>
                <div class="mm-outline-floating-list">
                  ${this.floatingTopics.map((ft, idx) => this.renderOutlineBoi(ft, idx)).join('')}
                </div>
              </div>
            ` : `
              <div class="mm-outline-floating-section" style="opacity: 0.85;">
                <div class="mm-outline-floating-header">
                  <span class="mm-outline-floating-badge">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="6" width="18" height="12" rx="6"/><circle cx="8" cy="12" r="1.5" fill="currentColor"/><circle cx="16" cy="12" r="1.5" fill="currentColor"/></svg>
                  </span>
                  <span class="mm-outline-floating-title" style="font-size: 11px;">Sujets Flottants</span>
                  <button type="button" class="btn-icon-subtle" data-action="add-floating-topic" title="Créer un sujet flottant (Alt+F)">
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  </button>
                </div>
              </div>
            `}
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
            ${this.renderOutlineMarkerPill(boi)}
            ${this.renderOutlineIconPill(boi)}
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
            ${this.renderOutlineBoundaryPill(boi.id)}
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
            ${this.renderOutlineMarkerPill(node)}
            ${this.renderOutlineIconPill(node)}
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
            ${this.renderOutlineBoundaryPill(node.id)}
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
    // Bouton ajouter un sujet flottant
    outlineEl.querySelectorAll('[data-action="add-floating-topic"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.createFloatingTopic(250, 100);
      });
    });

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

    // Clic sur une pastille d'enclos -> modification du titre
    outlineEl.querySelectorAll('.mm-outline-boundary-pill[data-action="edit-boundary"]').forEach(pill => {
      pill.addEventListener('click', (e) => {
        e.stopPropagation();
        const bndId = pill.getAttribute('data-boundary-id');
        if (bndId) this.promptEditBoundaryLabel(bndId);
      });
    });

    // Clic sur une pastille de marqueur -> faire défiler le marqueur
    outlineEl.querySelectorAll('.mm-outline-marker-badge').forEach(badge => {
      badge.addEventListener('click', (e) => {
        e.stopPropagation();
        const nodeId = badge.getAttribute('data-id');
        if (nodeId) this.cycleNodeMarker(nodeId);
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
          case 'svg-icon':
            this.openIconPicker(nodeId, e.clientX, e.clientY);
            break;
          case 'edit-node':
            const targetText = outlineEl.querySelector(`.mm-outline-text[data-id="${nodeId}"], .mm-outline-root-title[data-id="${nodeId}"]`);
            if (targetText) this.startOutlineInlineEdit(nodeId, targetText);
            break;
        }
      });
    });

    // Clic direct sur une pastille d'icône SVG (nœud ou racine) dans la vue plan
    outlineEl.querySelectorAll('.mm-outline-icon-badge, .mm-outline-root-badge').forEach(badge => {
      badge.addEventListener('click', (e) => {
        e.stopPropagation();
        const nodeId = badge.getAttribute('data-id') || 'root';
        this.openIconPicker(nodeId, e.clientX, e.clientY);
      });
    });

    // Clic droit dans la vue plan pour ouvrir le menu contextuel
    outlineEl.querySelectorAll('.mm-outline-root-header, .mm-outline-row, [data-node-id]').forEach(el => {
      el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const nodeId = el.getAttribute('data-node-id') || el.querySelector('[data-id]')?.getAttribute('data-id') || (el.classList.contains('mm-outline-root-header') ? 'root' : null);
        if (nodeId) {
          this.selectNode(nodeId);
          this.showContextMenu(e.clientX, e.clientY, nodeId);
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
      pill.addEventListener('mouseenter', () => this.showScriptureTooltip(pill, ref));
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
    if (this.isReadOnly) return;
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
      let val = input.value.trim();

      // Prise en charge des raccourcis d'icônes ::icon-name
      const iconMatch = val.match(/::([a-zA-Z0-9_-]+):?/i);
      if (iconMatch && typeof SvgIconsRegistry !== 'undefined') {
        const candidate = iconMatch[1].toLowerCase();
        if (SvgIconsRegistry.has(candidate)) {
          node.icon = candidate;
          val = val.replace(iconMatch[0], '').trim();
          if (nodeId === 'root' && this.currentNote) {
            this.currentNote.rootIcon = candidate;
          }
        }
      }
      node.text = val || (node.icon ? SvgIconsRegistry.get(node.icon)?.label?.toUpperCase() : originalText);
      if (nodeId === 'root' && this.currentNote) {
        this.currentNote.title = node.text;
        const titleInput = document.getElementById('note-edit-title');
        if (titleInput) titleInput.value = node.text;
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
    if (this.container) {
      this.container.classList.toggle('is-read-only', !!this.isReadOnly);
    }
    this.viewportG.innerHTML = '';

    // 1. Dessiner d'abord les enclos / clôtures en arrière-plan (au fond sous les branches et nœuds)
    this.drawBoundaries();

    // 2. Dessiner toutes les branches (courbes fluides sous le texte)
    if (this.tree) {
      this.drawBranches(this.tree);
    }
    if (this.floatingTopics && this.floatingTopics.length > 0) {
      this.floatingTopics.forEach(ft => this.drawBranches(ft));
    }

    // 3. Calque dédié aux lignes de liaisons transversales (sous les nœuds)
    const relsLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    relsLayer.setAttribute('id', 'mm-relationships-layer');
    this.viewportG.appendChild(relsLayer);

    // 4. Dessiner tous les nœuds (textes, boutons contextuels)
    if (this.tree) {
      this.drawNodes(this.tree);
    }
    if (this.floatingTopics && this.floatingTopics.length > 0) {
      this.floatingTopics.forEach(ft => this.drawNodes(ft));
    }

    // 5. Calque dédié aux étiquettes et poignées de liaisons (au premier plan, au-dessus des nœuds)
    const relsLabelsLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    relsLabelsLayer.setAttribute('id', 'mm-rel-labels-layer');
    this.viewportG.appendChild(relsLabelsLayer);

    // 6. Dessiner les liaisons transversales inter-branches dans leurs calques respectifs
    this.drawRelationships();
  },

  drawBranches(node) {
    if (!node.children || node.children.length === 0) return;
    // Mode Mémorisation : ne pas tracer les branches des nœuds repliés
    if (this.collapsedNodes && this.collapsedNodes.has(node.id)) return;

    const isBox = this.nodeShape === 'rounded-rect' || this.nodeShape === 'pill';
    const connStyle = this.connectorStyle || 'curve';
    const isRoot = node.level === 0;
    const totalChildren = node.children.length;

    node.children.forEach(child => {
      const nodeIsBox = isBox || !!node.image || !!node.isFloating;
      const childIsBox = isBox || !!child.image || !!child.isFloating;

      if (this.treeStructure === 'top-down') {
        const rootR = node.rootRadius || (Math.max(node.width || 100, node.height || 100) / 2);
        let x1 = node.x;
        let y1;

        if (isRoot && totalChildren > 1) {
          const childIdx = node.children.indexOf(child);
          const maxSpanX = Math.min(rootR * 1.4, (totalChildren - 1) * 16);
          const xStep = maxSpanX / (totalChildren - 1);
          x1 = node.x - maxSpanX / 2 + childIdx * xStep;
          const dx = x1 - node.x;
          y1 = node.y + Math.sqrt(Math.max(0, rootR * rootR - dx * dx));
        } else if (isRoot) {
          y1 = node.y + rootR;
        } else {
          y1 = nodeIsBox ? node.y + (node.height || 28) / 2 : node.y + 10;
        }

        const x2 = child.x;
        const y2 = childIsBox ? child.y - (child.height || 28) / 2 : child.y + 10;

        // Règles de BUZAN : hiérarchie visuelle forte (niveau 1 plus gros, s'affinant ensuite)
        let strokeWidth;
        if (isRoot) {
          strokeWidth = 4.2; // Branche maîtresse forte et organique (Buzan)
        } else if (child.level === 2) {
          strokeWidth = 2.6; // Branche secondaire
        } else if (child.level === 3) {
          strokeWidth = 1.9; // Branche tertiaire
        } else {
          strokeWidth = 1.5; // Ramification fine
        }
        const strokeColor = child.color || 'var(--text-secondary)';

        let pathD = '';
        let isTapered = false;
        if (connStyle === 'straight') {
          if (isRoot) {
            isTapered = true;
            const w1 = 1.4;
            const w2 = 4.2;
            pathD = `M ${(x1 - w1 / 2).toFixed(2)} ${y1.toFixed(2)} L ${(x2 - w2 / 2).toFixed(2)} ${y2.toFixed(2)} L ${(x2 + w2 / 2).toFixed(2)} ${y2.toFixed(2)} L ${(x1 + w1 / 2).toFixed(2)} ${y1.toFixed(2)} Z`;
          } else {
            pathD = `M ${x1} ${y1} L ${x2} ${y2}`;
          }
        } else if (connStyle === 'orthogonal') {
          const dx = x2 - x1;
          const dy = y2 - y1;
          if (Math.abs(dy) < 2) {
            pathD = `M ${x1} ${y1} L ${x2} ${y2}`;
          } else {
            const yMid = y1 + dy * 0.5;
            const dirX = dx > 0 ? 1 : -1;
            const r = Math.min(10, Math.abs(dx) / 2, Math.abs(dy) / 2);
            pathD = `M ${x1} ${y1} L ${x1} ${yMid - r} Q ${x1} ${yMid}, ${x1 + dirX * r} ${yMid} L ${x2 - dirX * r} ${yMid} Q ${x2} ${yMid}, ${x2} ${yMid + r} L ${x2} ${y2}`;
          }
        } else {
          // 'curve' (Bézier cubique)
          const dy = Math.abs(y2 - y1);
          const factor = isRoot ? 0.42 : 0.48;
          const cx1 = x1;
          const cy1 = y1 + dy * factor;
          const cx2 = x2;
          const cy2 = y2 - dy * factor;

          if (isRoot) {
            isTapered = true;
            const w1 = 3.6;
            const wm = 6.2;
            const w2 = 2.6;
            const xm = (x1 + x2) / 2;
            const ym = (y1 + y2) / 2;

            // Vecteur tangent et normale pour top-down
            const tx = 1.5 * (x2 - x1);
            const ty = 0.9 * (y2 - y1);
            const lenT = Math.sqrt(tx * tx + ty * ty) || 1;
            const nx = ty / lenT;
            const ny = -tx / lenT;

            const p1Left = { x: x1 - w1 / 2, y: y1 };
            const p1Right = { x: x1 + w1 / 2, y: y1 };
            const pmLeft = { x: xm - nx * (wm / 2), y: ym - ny * (wm / 2) };
            const pmRight = { x: xm + nx * (wm / 2), y: ym + ny * (wm / 2) };
            const p2Left = { x: x2 - w2 / 2, y: y2 };
            const p2Right = { x: x2 + w2 / 2, y: y2 };

            const c1aLeft = { x: x1 - w1 / 2, y: y1 + dy * 0.22 };
            const c1bLeft = { x: pmLeft.x - (tx / lenT) * (dy * 0.14), y: pmLeft.y - (ty / lenT) * (dy * 0.14) };
            const c1aRight = { x: x1 + w1 / 2, y: y1 + dy * 0.22 };
            const c1bRight = { x: pmRight.x - (tx / lenT) * (dy * 0.14), y: pmRight.y - (ty / lenT) * (dy * 0.14) };

            const c2aLeft = { x: pmLeft.x + (tx / lenT) * (dy * 0.14), y: pmLeft.y + (ty / lenT) * (dy * 0.14) };
            const c2bLeft = { x: x2 - w2 / 2, y: y2 - dy * 0.22 };
            const c2aRight = { x: pmRight.x + (tx / lenT) * (dy * 0.14), y: pmRight.y + (ty / lenT) * (dy * 0.14) };
            const c2bRight = { x: x2 + w2 / 2, y: y2 - dy * 0.22 };

            pathD = `M ${p1Left.x.toFixed(2)} ${p1Left.y.toFixed(2)} ` +
              `C ${c1aLeft.x.toFixed(2)} ${c1aLeft.y.toFixed(2)}, ${c1bLeft.x.toFixed(2)} ${c1bLeft.y.toFixed(2)}, ${pmLeft.x.toFixed(2)} ${pmLeft.y.toFixed(2)} ` +
              `C ${c2aLeft.x.toFixed(2)} ${c2aLeft.y.toFixed(2)}, ${c2bLeft.x.toFixed(2)} ${c2bLeft.y.toFixed(2)}, ${p2Left.x.toFixed(2)} ${p2Left.y.toFixed(2)} ` +
              `L ${p2Right.x.toFixed(2)} ${p2Right.y.toFixed(2)} ` +
              `C ${c2bRight.x.toFixed(2)} ${c2bRight.y.toFixed(2)}, ${c2aRight.x.toFixed(2)} ${c2aRight.y.toFixed(2)}, ${pmRight.x.toFixed(2)} ${pmRight.y.toFixed(2)} ` +
              `C ${c1bRight.x.toFixed(2)} ${c1bRight.y.toFixed(2)}, ${c1aRight.x.toFixed(2)} ${c1aRight.y.toFixed(2)}, ${p1Right.x.toFixed(2)} ${p1Right.y.toFixed(2)} Z`;
          } else {
            pathD = `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`;
          }
        }

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', pathD);
        if (isTapered) {
          path.setAttribute('fill', strokeColor);
          path.setAttribute('stroke', 'none');
        } else {
          path.setAttribute('fill', 'none');
          path.setAttribute('stroke', strokeColor);
          path.setAttribute('stroke-width', strokeWidth);
          path.setAttribute('stroke-linecap', 'round');
        }
        path.classList.add('mm-branch-path');
        this.viewportG.appendChild(path);

        if (!childIsBox) {
          // Trait de soulignement sous le mot (centré horizontalement sous le mot-clé)
          const underX1 = child.x - child.width / 2;
          const underX2 = child.x + child.width / 2;
          const underline = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          underline.setAttribute('x1', underX1);
          underline.setAttribute('y1', child.y + 10);
          underline.setAttribute('x2', underX2);
          underline.setAttribute('y2', child.y + 10);
          underline.setAttribute('stroke', strokeColor);
          const underlineW = child.level === 1 ? 3.0 : (child.level === 2 ? 2.0 : 1.5);
          underline.setAttribute('stroke-width', underlineW);
          underline.setAttribute('stroke-linecap', 'round');
          this.viewportG.appendChild(underline);
        }

      } else {
        // Radiant / Arbre logique (gauche / droite)
        const childSide = child.side || 'right';
        const dir = childSide === 'right' ? 1 : -1;

        // Position de départ sur le bloc principal : ventilation élégante le long du pourtour de l'ellipse
        let x1, y1;
        let totalOnSide = 1;
        if (isRoot) {
          const rootR = node.rootRadius || (Math.max(node.width || 100, node.height || 100) / 2);
          const sameSideChildren = node.children
            .filter(c => (c.side || 'right') === childSide)
            .sort((a, b) => a.y - b.y);
          totalOnSide = sameSideChildren.length;
          const idxOnSide = sameSideChildren.indexOf(child);

          if (totalOnSide <= 1) {
            x1 = dir * rootR;
            y1 = 0;
          } else {
            // Répartition aérée sur 70% de la hauteur du médaillon central
            const maxSpanY = Math.min(rootR * 1.4, (totalOnSide - 1) * 14);
            const yStep = maxSpanY / (totalOnSide - 1);
            y1 = -maxSpanY / 2 + idxOnSide * yStep;

            // Point d'ancrage calculé précisément sur la circonférence du cercle
            const capX = Math.sqrt(Math.max(0, rootR * rootR - y1 * y1));
            x1 = dir * capX;
          }
        } else {
          x1 = childSide === 'right' ? node.x + node.width / 2 : node.x - node.width / 2;
          y1 = nodeIsBox ? node.y : node.y + 10;
        }

        const x2 = childSide === 'right' ? child.x - child.width / 2 : child.x + child.width / 2;
        const y2 = childIsBox ? child.y : child.y + 10;

        // Finesse élégante et hiérarchie visuelle (affinement des liaisons vers le sujet central)
        let strokeWidth;
        if (isRoot) {
          strokeWidth = totalOnSide >= 4 ? 2.2 : (totalOnSide === 3 ? 2.5 : 2.9);
        } else if (child.level === 2) {
          strokeWidth = 2.0;
        } else if (child.level === 3) {
          strokeWidth = 1.6;
        } else {
          strokeWidth = 1.2;
        }
        const strokeColor = child.color || 'var(--text-secondary)';

        let pathD = '';
        let isTapered = false;
        if (connStyle === 'straight') {
          if (isRoot) {
            isTapered = true;
            const w1 = 3.6;
            const wm = 6.2;
            const w2 = 2.6;
            const xm = (x1 + x2) / 2;
            const ym = (y1 + y2) / 2;
            const dxS = x2 - x1;
            const dyS = y2 - y1;
            const lenS = Math.sqrt(dxS * dxS + dyS * dyS) || 1;
            const nxS = -dyS / lenS;
            const nyS = dxS / lenS;
            pathD = `M ${(x1 - nxS * (w1 / 2)).toFixed(2)} ${(y1 - nyS * (w1 / 2)).toFixed(2)} ` +
              `L ${(xm - nxS * (wm / 2)).toFixed(2)} ${(ym - nyS * (wm / 2)).toFixed(2)} ` +
              `L ${(x2 - nxS * (w2 / 2)).toFixed(2)} ${(y2 - nyS * (w2 / 2)).toFixed(2)} ` +
              `L ${(x2 + nxS * (w2 / 2)).toFixed(2)} ${(y2 + nyS * (w2 / 2)).toFixed(2)} ` +
              `L ${(xm + nxS * (wm / 2)).toFixed(2)} ${(ym + nyS * (wm / 2)).toFixed(2)} ` +
              `L ${(x1 + nxS * (w1 / 2)).toFixed(2)} ${(y1 + nyS * (w1 / 2)).toFixed(2)} Z`;
          } else {
            pathD = `M ${x1} ${y1} L ${x2} ${y2}`;
          }
        } else if (connStyle === 'orthogonal') {
          const dx = x2 - x1;
          const dy = y2 - y1;
          if (Math.abs(dy) < 2) {
            pathD = `M ${x1} ${y1} L ${x2} ${y2}`;
          } else {
            const xMid = x1 + dx * 0.5;
            const dirX = dx > 0 ? 1 : -1;
            const dirY = dy > 0 ? 1 : -1;
            const r = Math.min(10, Math.abs(dx) / 2, Math.abs(dy) / 2);
            pathD = `M ${x1} ${y1} L ${xMid - dirX * r} ${y1} Q ${xMid} ${y1}, ${xMid} ${y1 + dirY * r} L ${xMid} ${y2 - dirY * r} Q ${xMid} ${y2}, ${xMid + dirX * r} ${y2} L ${x2} ${y2}`;
          }
        } else {
          // Courbe de Bézier cubique organique avec départ fluide
          const dx = Math.abs(x2 - x1);
          const factor = isRoot ? 0.42 : 0.48;
          const dir = childSide === 'right' ? 1 : -1;
          const cx1 = x1 + dir * dx * factor;
          const cy1 = y1;
          const cx2 = x2 - dir * dx * factor;
          const cy2 = y2;

          if (isRoot) {
            // Effet d'effilement Tony Buzan (mots-clés forces) :
            // La branche maîtresse part avec une assise solide (3.6px),
            // atteint son épaisseur maximale à la moitié de la longueur (6.2px),
            // puis s'affine harmonieusement pour se raccorder au nœud de niveau 1 (2.6px).
            isTapered = true;
            const w1 = 3.6;
            const wm = 6.2;
            const w2 = 2.6;

            const xm = (x1 + x2) / 2;
            const ym = (y1 + y2) / 2;

            // Vecteur tangent et normale au milieu de la courbe
            const tx = 0.9 * (x2 - x1);
            const ty = 1.5 * (y2 - y1);
            const lenT = Math.sqrt(tx * tx + ty * ty) || 1;
            const nx = -ty / lenT;
            const ny = tx / lenT;

            // Points extrêmes et médians
            const p1Top = { x: x1, y: y1 - w1 / 2 };
            const p1Bot = { x: x1, y: y1 + w1 / 2 };
            const pmTop = { x: xm - nx * (wm / 2), y: ym - ny * (wm / 2) };
            const pmBot = { x: xm + nx * (wm / 2), y: ym + ny * (wm / 2) };
            const p2Top = { x: x2, y: y2 - w2 / 2 };
            const p2Bot = { x: x2, y: y2 + w2 / 2 };

            // Points de contrôle de la moitié amont (Root -> Milieu)
            const c1aTop = { x: x1 + dir * dx * 0.22, y: y1 - w1 / 2 };
            const c1bTop = { x: pmTop.x - (tx / lenT) * (dx * 0.14), y: pmTop.y - (ty / lenT) * (dx * 0.14) };
            const c1aBot = { x: x1 + dir * dx * 0.22, y: y1 + w1 / 2 };
            const c1bBot = { x: pmBot.x - (tx / lenT) * (dx * 0.14), y: pmBot.y - (ty / lenT) * (dx * 0.14) };

            // Points de contrôle de la moitié aval (Milieu -> Niveau 1)
            const c2aTop = { x: pmTop.x + (tx / lenT) * (dx * 0.14), y: pmTop.y + (ty / lenT) * (dx * 0.14) };
            const c2bTop = { x: x2 - dir * dx * 0.22, y: y2 - w2 / 2 };
            const c2aBot = { x: pmBot.x + (tx / lenT) * (dx * 0.14), y: pmBot.y + (ty / lenT) * (dx * 0.14) };
            const c2bBot = { x: x2 - dir * dx * 0.22, y: y2 + w2 / 2 };

            pathD = `M ${p1Top.x.toFixed(2)} ${p1Top.y.toFixed(2)} ` +
              `C ${c1aTop.x.toFixed(2)} ${c1aTop.y.toFixed(2)}, ${c1bTop.x.toFixed(2)} ${c1bTop.y.toFixed(2)}, ${pmTop.x.toFixed(2)} ${pmTop.y.toFixed(2)} ` +
              `C ${c2aTop.x.toFixed(2)} ${c2aTop.y.toFixed(2)}, ${c2bTop.x.toFixed(2)} ${c2bTop.y.toFixed(2)}, ${p2Top.x.toFixed(2)} ${p2Top.y.toFixed(2)} ` +
              `L ${p2Bot.x.toFixed(2)} ${p2Bot.y.toFixed(2)} ` +
              `C ${c2bBot.x.toFixed(2)} ${c2bBot.y.toFixed(2)}, ${c2aBot.x.toFixed(2)} ${c2aBot.y.toFixed(2)}, ${pmBot.x.toFixed(2)} ${pmBot.y.toFixed(2)} ` +
              `C ${c1bBot.x.toFixed(2)} ${c1bBot.y.toFixed(2)}, ${c1aBot.x.toFixed(2)} ${c1aBot.y.toFixed(2)}, ${p1Bot.x.toFixed(2)} ${p1Bot.y.toFixed(2)} Z`;
          } else {
            pathD = `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`;
          }
        }

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', pathD);
        if (isTapered) {
          path.setAttribute('fill', strokeColor);
          path.setAttribute('stroke', 'none');
        } else {
          path.setAttribute('fill', 'none');
          path.setAttribute('stroke', strokeColor);
          path.setAttribute('stroke-width', strokeWidth);
          path.setAttribute('stroke-linecap', 'round');
        }
        path.classList.add('mm-branch-path');
        this.viewportG.appendChild(path);

        if (!childIsBox) {
          // Branche organique continue : courbe de Bézier du point d'arrivée jusqu'au bout du texte
          // (Loi Buzan 7 : longueur branche = exactement le mot-clé, pas de trait rigide)
          const underX2 = childSide === 'right' ? child.x + child.width / 2 : child.x - child.width / 2;
          const underlineW = child.level === 1 ? (totalOnSide >= 4 ? 2.2 : 2.6) : (child.level === 2 ? 1.8 : 1.4);

          // Points de contrôle pour que la courbe parte tangentiellement dans le bon sens
          const ucx1 = x2 + (underX2 - x2) * 0.35;
          const ucx2 = x2 + (underX2 - x2) * 0.65;
          const underPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          underPath.setAttribute('d', `M ${x2} ${y2} C ${ucx1} ${y2}, ${ucx2} ${y2}, ${underX2} ${y2}`);
          underPath.setAttribute('fill', 'none');
          underPath.setAttribute('stroke', strokeColor);
          underPath.setAttribute('stroke-width', underlineW);
          underPath.setAttribute('stroke-linecap', 'round');
          underPath.classList.add('mm-branch-path');
          this.viewportG.appendChild(underPath);
        }
      }

      this.drawBranches(child);
    });
  },

  drawNodes(node) {
    const isRoot = node.level === 0 && !node.isFloating;
    const isFloatingRoot = !!node.isFloating;
    const isSelected = this.selectedNodeId === node.id;
    const isConnectingSource = this.connectingSourceId === node.id;
    const isTopDown = this.treeStructure === 'top-down';
    const isLvl1 = node.level === 1;
    const isLvl2 = node.level === 2;
    // isBox, effectiveIsBox, isImgOnly et isTopImage déclarés ici pour être accessibles dans tout drawNodes (y compris fold indicator)
    const isBox = node.isFloating || this.nodeShape === 'rounded-rect' || this.nodeShape === 'pill';
    const hasImage = !!node.image;
    const effectiveIsBox = isBox || hasImage;
    const imgMode = node.imageMode || 'background';
    const isImgOnly = hasImage && imgMode === 'image-only';
    const isTopImage = hasImage && imgMode === 'top-image';

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', `mm-node-g mm-level-${node.level} ${isRoot ? 'mm-root-node' : ''} ${isFloatingRoot ? 'mm-floating-node' : ''} ${isSelected ? 'selected' : ''} ${isConnectingSource ? 'connecting-source' : ''}`);
    g.setAttribute('transform', `translate(${node.x}, ${node.y})`);
    g.setAttribute('data-id', node.id);
    const nodeColor = node.color || (isRoot ? 'var(--accent-blue, #2563eb)' : '#3b82f6');
    g.style.setProperty('--node-color', nodeColor);

    if (isRoot) {
      // ── Médaillon central Buzan ─ sphère polychrome vivante mixant les branches ──
      const rootR = node.rootRadius || (Math.max(node.width || 100, node.height || 100) / 2);

      // Collecter les couleurs des branches de niveau 1 (enfants directs)
      const boiChildren = node.children || [];
      const leftColors = boiChildren
        .filter(c => (c.side || 'right') === 'left')
        .sort((a, b) => a.y - b.y)
        .map(c => c.color)
        .filter(c => typeof c === 'string' && c.trim().length > 0 && !c.includes('var('));

      const rightColors = boiChildren
        .filter(c => (c.side || 'right') === 'right')
        .sort((a, b) => a.y - b.y)
        .map(c => c.color)
        .filter(c => typeof c === 'string' && c.trim().length > 0 && !c.includes('var('));

      // Liste ordonnée pour faire correspondre le gradient à la répartition spatiale des branches
      let effectiveColors = [];
      if (leftColors.length > 0 && rightColors.length > 0) {
        effectiveColors = [...leftColors, ...rightColors];
      } else if (leftColors.length > 0) {
        effectiveColors = leftColors;
      } else if (rightColors.length > 0) {
        effectiveColors = rightColors;
      } else {
        effectiveColors = boiChildren
          .map(c => c.color)
          .filter(c => typeof c === 'string' && c.trim().length > 0 && !c.includes('var('));
      }

      if (effectiveColors.length === 0) {
        effectiveColors = ['#2563eb', '#3b82f6', '#1d4ed8'];
      }

      // IDs uniques pour les dégradés SVG dynamiques
      const gradId = `mm-root-grad-${node.id || 'r'}`;
      const sphereId = `mm-root-sphere-${node.id || 'r'}`;
      const defs = this.svg.querySelector('defs');

      if (defs) {
        // Supprimer systématiquement les anciens dégradés pour mise à jour instantanée en temps réel
        const oldGrad = defs.querySelector(`#${gradId}`);
        if (oldGrad) oldGrad.remove();
        const oldSphere = defs.querySelector(`#${sphereId}`);
        if (oldSphere) oldSphere.remove();

        // 1. Dégradé polychrome linéaire traversant le médaillon (mix harmonieux des branches)
        const grad = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
        grad.setAttribute('id', gradId);
        grad.setAttribute('x1', '0%');
        grad.setAttribute('y1', '25%');
        grad.setAttribute('x2', '100%');
        grad.setAttribute('y2', '75%');

        if (effectiveColors.length === 1) {
          const s0 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
          s0.setAttribute('offset', '0%');
          s0.setAttribute('stop-color', effectiveColors[0]);
          const s1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
          s1.setAttribute('offset', '100%');
          s1.setAttribute('stop-color', effectiveColors[0]);
          grad.appendChild(s0);
          grad.appendChild(s1);
        } else {
          effectiveColors.forEach((col, idx) => {
            const pct = Math.round((idx / (effectiveColors.length - 1)) * 100);
            const stop = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
            stop.setAttribute('offset', `${pct}%`);
            stop.setAttribute('stop-color', col);
            grad.appendChild(stop);
          });
        }
        defs.appendChild(grad);

        // 2. Dégradé de brillance sphérique 3D (volume, reflet spéculaire & profondeur cristalline)
        const sphere = document.createElementNS('http://www.w3.org/2000/svg', 'radialGradient');
        sphere.setAttribute('id', sphereId);
        sphere.setAttribute('cx', '35%');
        sphere.setAttribute('cy', '30%');
        sphere.setAttribute('r', '70%');
        sphere.setAttribute('fx', '35%');
        sphere.setAttribute('fy', '30%');

        const sp0 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
        sp0.setAttribute('offset', '0%');
        sp0.setAttribute('stop-color', '#ffffff');
        sp0.setAttribute('stop-opacity', '0.62');

        const sp1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
        sp1.setAttribute('offset', '42%');
        sp1.setAttribute('stop-color', '#ffffff');
        sp1.setAttribute('stop-opacity', '0.12');

        const sp2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
        sp2.setAttribute('offset', '82%');
        sp2.setAttribute('stop-color', '#000000');
        sp2.setAttribute('stop-opacity', '0.14');

        const sp3 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
        sp3.setAttribute('offset', '100%');
        sp3.setAttribute('stop-color', '#000000');
        sp3.setAttribute('stop-opacity', '0.42');

        sphere.appendChild(sp0);
        sphere.appendChild(sp1);
        sphere.appendChild(sp2);
        sphere.appendChild(sp3);
        defs.appendChild(sphere);
      }

      // Si une illustration IA est associée au médaillon central
      const rootImgSrc = node.imageDataUrl || (node.image && (node.image.startsWith('data:') || node.image.startsWith('http')) ? node.image : null);
      if (node.image && !rootImgSrc) {
        this.resolveNodeImageDataUrl(node);
      }
      const isRootImgOnly = !!(rootImgSrc || node.image) && (node.imageMode === 'image-only');
      const rootShape = node.imageShape || 'circle';
      let rootRx = rootR;
      if (isRootImgOnly) {
        if (rootShape === 'square') rootRx = 10;
        else if (rootShape === 'rounded') rootRx = Math.min(32, Math.max(12, Math.round(rootR * 0.44)));
        else if (rootShape === 'pill') rootRx = rootR;
        else rootRx = rootR;
      }

      // Halo / aura extérieure polychrome translucide
      const auraCircle = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      auraCircle.setAttribute('x', -rootR - 10);
      auraCircle.setAttribute('y', -rootR - 10);
      auraCircle.setAttribute('width', (rootR + 10) * 2);
      auraCircle.setAttribute('height', (rootR + 10) * 2);
      auraCircle.setAttribute('rx', rootRx + 6);
      auraCircle.setAttribute('fill', `url(#${gradId})`);
      auraCircle.setAttribute('opacity', '0.22');
      auraCircle.setAttribute('class', 'mm-root-aura');
      auraCircle.setAttribute('filter', 'url(#mm-root-aura)');
      g.appendChild(auraCircle);

      // Anneau de bordure élégant avec dégradé polychrome
      const ringCircle = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      ringCircle.setAttribute('x', -rootR - 2.5);
      ringCircle.setAttribute('y', -rootR - 2.5);
      ringCircle.setAttribute('width', (rootR + 2.5) * 2);
      ringCircle.setAttribute('height', (rootR + 2.5) * 2);
      ringCircle.setAttribute('rx', rootRx + 2);
      ringCircle.setAttribute('fill', 'none');
      ringCircle.setAttribute('stroke', `url(#${gradId})`);
      ringCircle.setAttribute('stroke-width', '2.2');
      ringCircle.setAttribute('opacity', '0.7');
      g.appendChild(ringCircle);

      // Forme principale avec le dégradé polychrome mixant les branches
      const mainCircle = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      mainCircle.setAttribute('x', -rootR);
      mainCircle.setAttribute('y', -rootR);
      mainCircle.setAttribute('width', rootR * 2);
      mainCircle.setAttribute('height', rootR * 2);
      mainCircle.setAttribute('rx', rootRx);
      mainCircle.setAttribute('fill', `url(#${gradId})`);
      mainCircle.setAttribute('class', 'mm-root-medallion');
      mainCircle.setAttribute('filter', isSelected ? 'url(#mm-select-glow)' : 'none');
      g.appendChild(mainCircle);

      if (rootImgSrc && defs) {
        const rootClipId = `mm-root-clip-${node.id || 'root'}`;
        let rClip = defs.querySelector(`#${rootClipId}`);
        if (rClip) rClip.remove();
        rClip = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
        rClip.setAttribute('id', rootClipId);
        const cShape = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        cShape.setAttribute('x', -rootR);
        cShape.setAttribute('y', -rootR);
        cShape.setAttribute('width', rootR * 2);
        cShape.setAttribute('height', rootR * 2);
        cShape.setAttribute('rx', rootRx);
        rClip.appendChild(cShape);
        defs.appendChild(rClip);

        const imgG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        imgG.setAttribute('clip-path', `url(#${rootClipId})`);

        const vW = rootR * 2;
        const vH = rootR * 2;
        const imgAspect = node.imageAspect || 1.0;
        const cover = this.calcImageCover(vW, vH, imgAspect, node.imageZoom, node.imagePanX, node.imagePanY);

        const imgEl = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        imgEl.setAttribute('href', rootImgSrc);
        imgEl.setAttribute('x', -cover.renderW / 2 + cover.offsetX);
        imgEl.setAttribute('y', -cover.renderH / 2 + cover.offsetY);
        imgEl.setAttribute('width', cover.renderW);
        imgEl.setAttribute('height', cover.renderH);
        imgEl.setAttribute('preserveAspectRatio', 'none');

        if (node.imageColor === 'bw' || node.imageColor === 'tint') {
          imgEl.setAttribute('filter', 'url(#mm-filter-bw)');
        }

        imgG.appendChild(imgEl);

        // Mesurer l'aspect naturel si non encore mémorisé
        if (!node.imageAspect) {
          const tmpImg = new Image();
          tmpImg.onload = () => {
            if (tmpImg.naturalWidth && tmpImg.naturalHeight) {
              const asp = tmpImg.naturalWidth / tmpImg.naturalHeight;
              if (Math.abs((node.imageAspect || 1) - asp) > 0.01) {
                node.imageAspect = asp;
                this.drawNodes(this.tree);
              }
            }
          };
          tmpImg.src = rootImgSrc;
        }

        // Teinte polychrome harmonisée pour le médaillon central (mix des branches)
        if (node.imageColor === 'tint') {
          const tintShape = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          tintShape.setAttribute('x', -rootR);
          tintShape.setAttribute('y', -rootR);
          tintShape.setAttribute('width', rootR * 2);
          tintShape.setAttribute('height', rootR * 2);
          tintShape.setAttribute('rx', rootRx);
          tintShape.setAttribute('fill', `url(#${gradId})`);
          tintShape.setAttribute('style', 'mix-blend-mode: multiply; opacity: 0.72;');
          tintShape.setAttribute('pointer-events', 'none');
          imgG.appendChild(tintShape);
        }

        if (!isRootImgOnly) {
          const darkOverlay = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          darkOverlay.setAttribute('r', rootR);
          darkOverlay.setAttribute('fill', 'rgba(15, 23, 42, 0.55)');
          darkOverlay.setAttribute('class', 'mm-root-image-overlay');
          imgG.appendChild(darkOverlay);
        }

        g.appendChild(imgG);
      }

      if (!isRootImgOnly) {
        // Superposition sphérique 3D (volume et reflet de brillance)
        const sphereCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        sphereCircle.setAttribute('r', rootR);
        sphereCircle.setAttribute('fill', `url(#${sphereId})`);
        sphereCircle.setAttribute('pointer-events', 'none');
        sphereCircle.setAttribute('class', 'mm-root-sphere-layer');
        g.appendChild(sphereCircle);

        // ── Icône SVG centrale (positionnée dans la moitié supérieure du médaillon) ──
        const iconSize = 42;
        const iconCenterY = -Math.round(rootR * 0.35);

        if (node.icon && typeof SvgIconsRegistry !== 'undefined') {
          const iconDef = SvgIconsRegistry.get(node.icon);
          if (iconDef) {
            const iconG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            iconG.setAttribute('transform', `translate(0, ${iconCenterY})`);
            iconG.setAttribute('class', 'mm-node-icon-badge mm-root-icon-badge');
            iconG.setAttribute('style', 'cursor: pointer;');
            iconG.setAttribute('title', `Icône SVG : ${iconDef.label} (Cliquer pour changer ou [I])`);

            const iHit = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            iHit.setAttribute('r', iconSize / 2 + 5);
            iHit.setAttribute('fill', 'transparent');
            iconG.appendChild(iHit);

            const svgWrap = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            svgWrap.setAttribute('transform', `translate(${-iconSize / 2}, ${-iconSize / 2}) scale(${iconSize / 24})`);
            svgWrap.setAttribute('fill', 'none');
            svgWrap.setAttribute('stroke', '#ffffff');
            svgWrap.setAttribute('stroke-width', '1.8');
            svgWrap.setAttribute('stroke-linecap', 'round');
            svgWrap.setAttribute('stroke-linejoin', 'round');
            svgWrap.setAttribute('filter', 'drop-shadow(0 1px 3px rgba(0,0,0,0.4))');
            svgWrap.setAttribute('pointer-events', 'none');
            svgWrap.innerHTML = iconDef.path;
            iconG.appendChild(svgWrap);

            iconG.addEventListener('click', (e) => {
              e.stopPropagation();
              if (this.isReadOnly) return;
              this.openIconPicker(node.id, e.clientX, e.clientY);
            });
            g.appendChild(iconG);
          }
        }

        // ── Titre du concept central (positionné dans la moitié inférieure du médaillon) ──
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        const textBaseY = node.icon ? Math.round(rootR * 0.34) : 0;
        text.setAttribute('dominant-baseline', 'central');
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('class', 'mm-root-text');
        text.setAttribute('fill', '#ffffff');
        text.setAttribute('pointer-events', 'none');
        text.setAttribute('style', 'text-shadow: 0 1px 4px rgba(0,0,0,0.6); font-weight: 900;');

        const words = (node.text || '').trim().split(/\s+/);
        const isMultiWordLong = words.length >= 3 && node.text.length > 15;

        if (isMultiWordLong) {
          const mid = Math.ceil(words.length / 2);
          const line1 = words.slice(0, mid).join(' ');
          const line2 = words.slice(mid).join(' ');

          const tspan1 = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
          tspan1.setAttribute('x', '0');
          tspan1.setAttribute('y', `${textBaseY - 7.5}`);
          tspan1.setAttribute('font-size', '11.5px');
          tspan1.textContent = line1;

          const tspan2 = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
          tspan2.setAttribute('x', '0');
          tspan2.setAttribute('y', `${textBaseY + 7.5}`);
          tspan2.setAttribute('font-size', '11.5px');
          tspan2.textContent = line2;

          text.appendChild(tspan1);
          text.appendChild(tspan2);
        } else {
          text.setAttribute('x', '0');
          text.setAttribute('y', textBaseY);
          text.setAttribute('font-size', node.text.length > 13 ? '13px' : '15px');
          text.textContent = node.text;
        }
        g.appendChild(text);
      } else {
        const rootTitle = document.createElementNS('http://www.w3.org/2000/svg', 'title');
        rootTitle.textContent = node.text || '';
        g.appendChild(rootTitle);
      }

      // Bouton contextuel + pour ajouter un BOI (en mode édition uniquement)
      if (!this.isReadOnly) {
        const plusX = isTopDown ? 0 : rootR + 14;
        const plusY = isTopDown ? rootR + 14 : 0;
        const plusBtn = this.createActionButton('+', plusX, plusY, () => this.addChildToNode(node));
        plusBtn.setAttribute('title', 'Ajouter une idée directrice majeure (BOI)');
        plusBtn.classList.add('mm-root-plus');
        g.appendChild(plusBtn);
      }

    } else {
      const topImgH = isTopImage ? (isLvl1 ? 52 : (isLvl2 ? 44 : (node.isFloating ? 46 : 38))) : 0;

      if (isImgOnly) {
        g.classList.add('mm-node-img-only');
      }

      const boxW = node.width;
      const boxH = node.height || (isLvl1 ? 36 : (isLvl2 ? 28 : 24));
      const strokeW = node.isFloating ? '2' : (isLvl1 ? '2.4' : (isLvl2 ? '1.5' : '1.1'));

      const isPill = node.isFloating || hasImage || this.nodeShape === 'pill';
      const imgShape = node.imageShape || 'rounded';
      let rx;
      if (isImgOnly) {
        if (imgShape === 'circle') {
          rx = boxW / 2;
        } else if (imgShape === 'pill') {
          rx = Math.min(boxW, boxH) / 2;
        } else if (imgShape === 'square') {
          rx = 6;
        } else { // 'rounded'
          rx = Math.min(24, Math.max(8, Math.round(boxW * 0.22)));
        }
      } else {
        rx = isPill ? (isLvl1 ? 18 : (isLvl2 ? 14 : 12)) : (isLvl1 ? 9 : (isLvl2 ? 6 : 4));
      }

      if (effectiveIsBox) {
        // Boîte d'arrière-plan avec bordure colorée (Style XMind & Buzan : Niveau 1 plus imposant)
        const boxRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        boxRect.setAttribute('x', -boxW / 2);
        boxRect.setAttribute('y', -boxH / 2);
        boxRect.setAttribute('width', boxW);
        boxRect.setAttribute('height', boxH);
        boxRect.setAttribute('rx', rx);
        boxRect.setAttribute('class', `mm-branch-box ${node.isFloating ? 'mm-floating-box' : this.nodeShape} ${isImgOnly ? 'mm-img-only-box' : ''}`);
        boxRect.setAttribute('fill', 'var(--bg-card, #ffffff)');
        boxRect.setAttribute('stroke', node.color || 'var(--accent-blue)');
        boxRect.setAttribute('stroke-width', strokeW);
        boxRect.setAttribute('filter', isSelected ? 'url(#mm-select-glow)' : 'url(#mm-glow)');
        g.appendChild(boxRect);

        // Si une illustration IA est attachée à la branche
        const branchImgSrc = node.imageDataUrl || (node.image && (node.image.startsWith('data:') || node.image.startsWith('http')) ? node.image : null);
        if (node.image && !branchImgSrc) {
          this.resolveNodeImageDataUrl(node);
        }
        const defs = this.svg?.querySelector('defs');
        if (branchImgSrc && defs) {
          const nodeClipId = `mm-node-clip-${node.id}`;
          let nClip = defs.querySelector(`#${nodeClipId}`);
          if (nClip) nClip.remove();
          nClip = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
          nClip.setAttribute('id', nodeClipId);

          if (isTopImage) {
            const halfW = boxW / 2;
            const topY = -boxH / 2;
            const botImgY = -boxH / 2 + topImgH;
            const pathD = `M ${-halfW} ${topY + rx} ` +
              `A ${rx} ${rx} 0 0 1 ${-halfW + rx} ${topY} ` +
              `L ${halfW - rx} ${topY} ` +
              `A ${rx} ${rx} 0 0 1 ${halfW} ${topY + rx} ` +
              `L ${halfW} ${botImgY} ` +
              `L ${-halfW} ${botImgY} Z`;
            const cPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            cPath.setAttribute('d', pathD);
            nClip.appendChild(cPath);
          } else {
            const cRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            cRect.setAttribute('x', -boxW / 2);
            cRect.setAttribute('y', -boxH / 2);
            cRect.setAttribute('width', boxW);
            cRect.setAttribute('height', boxH);
            cRect.setAttribute('rx', rx);
            nClip.appendChild(cRect);
          }
          defs.appendChild(nClip);

          const imgG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
          imgG.setAttribute('clip-path', `url(#${nodeClipId})`);

          const vW = boxW;
          const vH = isTopImage ? topImgH : boxH;
          const vCx = 0;
          const vCy = isTopImage ? (-boxH / 2 + topImgH / 2) : 0;
          const imgAspect = node.imageAspect || 1.0;
          const cover = this.calcImageCover(vW, vH, imgAspect, node.imageZoom, node.imagePanX, node.imagePanY);

          const imgEl = document.createElementNS('http://www.w3.org/2000/svg', 'image');
          imgEl.setAttribute('href', branchImgSrc);
          imgEl.setAttribute('x', vCx - cover.renderW / 2 + cover.offsetX);
          imgEl.setAttribute('y', vCy - cover.renderH / 2 + cover.offsetY);
          imgEl.setAttribute('width', cover.renderW);
          imgEl.setAttribute('height', cover.renderH);
          imgEl.setAttribute('preserveAspectRatio', 'none');

          if (node.imageColor === 'bw' || node.imageColor === 'tint') {
            imgEl.setAttribute('filter', 'url(#mm-filter-bw)');
          }

          imgG.appendChild(imgEl);

          // Mesurer l'aspect naturel si non encore mémorisé
          if (!node.imageAspect) {
            const tmpImg = new Image();
            tmpImg.onload = () => {
              if (tmpImg.naturalWidth && tmpImg.naturalHeight) {
                const asp = tmpImg.naturalWidth / tmpImg.naturalHeight;
                if (Math.abs((node.imageAspect || 1) - asp) > 0.01) {
                  node.imageAspect = asp;
                  this.drawNodes(this.tree);
                }
              }
            };
            tmpImg.src = branchImgSrc;
          }

          // Teinte harmonisée de branche
          if (node.imageColor === 'tint') {
            const tintRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            tintRect.setAttribute('x', -vW / 2);
            tintRect.setAttribute('y', isTopImage ? -boxH / 2 : -boxH / 2);
            tintRect.setAttribute('width', vW);
            tintRect.setAttribute('height', vH);
            tintRect.setAttribute('fill', node.color || 'var(--accent-blue)');
            tintRect.setAttribute('style', 'mix-blend-mode: multiply; opacity: 0.72;');
            tintRect.setAttribute('pointer-events', 'none');
            imgG.appendChild(tintRect);
          }

          if (isTopImage) {
            const sepLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            sepLine.setAttribute('x1', -boxW / 2);
            sepLine.setAttribute('y1', -boxH / 2 + topImgH);
            sepLine.setAttribute('x2', boxW / 2);
            sepLine.setAttribute('y2', -boxH / 2 + topImgH);
            sepLine.setAttribute('stroke', 'rgba(148, 163, 184, 0.28)');
            sepLine.setAttribute('stroke-width', '1');
            imgG.appendChild(sepLine);
          } else if (!isImgOnly) {
            const darkOverlay = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            darkOverlay.setAttribute('x', -boxW / 2);
            darkOverlay.setAttribute('y', -boxH / 2);
            darkOverlay.setAttribute('width', boxW);
            darkOverlay.setAttribute('height', boxH);
            darkOverlay.setAttribute('rx', rx);
            darkOverlay.setAttribute('fill', 'rgba(15, 23, 42, 0.62)');
            darkOverlay.setAttribute('class', 'mm-node-image-overlay');
            imgG.appendChild(darkOverlay);
          }

          g.appendChild(imgG);

          // Réappliquer le contour coloré par-dessus l'image
          const borderRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          borderRect.setAttribute('x', -boxW / 2);
          borderRect.setAttribute('y', -boxH / 2);
          borderRect.setAttribute('width', boxW);
          borderRect.setAttribute('height', boxH);
          borderRect.setAttribute('rx', rx);
          borderRect.setAttribute('fill', 'none');
          borderRect.setAttribute('stroke', node.color || 'var(--accent-blue)');
          borderRect.setAttribute('stroke-width', strokeW);
          borderRect.setAttribute('pointer-events', 'none');
          g.appendChild(borderRect);
        } else if (!hasImage) {
          // Fond teinté translucide assorti à la couleur de la branche (quand pas d'image)
          const tintRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          tintRect.setAttribute('x', -boxW / 2);
          tintRect.setAttribute('y', -boxH / 2);
          tintRect.setAttribute('width', boxW);
          tintRect.setAttribute('height', boxH);
          tintRect.setAttribute('rx', rx);
          tintRect.setAttribute('fill', node.color || 'var(--accent-blue)');
          tintRect.setAttribute('opacity', node.isFloating ? '0.12' : (isLvl1 ? '0.14' : (isLvl2 ? '0.07' : '0.05')));
          g.appendChild(tintRect);
        }
      } else {
        // Mode souligné (underline) : halo d'illumination discret visible uniquement à la sélection
        const haloRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        const haloW = node.width + 12;
        const haloH = (node.height || 24) + 6;
        haloRect.setAttribute('x', -haloW / 2);
        haloRect.setAttribute('y', -haloH / 2);
        haloRect.setAttribute('width', haloW);
        haloRect.setAttribute('height', haloH);
        haloRect.setAttribute('rx', 8);
        haloRect.setAttribute('class', 'mm-underline-halo');
        g.appendChild(haloRect);
      }

      // Zone réceptive continue invisible
      const hitRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      const hitW = node.width + 65;
      const hitX = isTopDown ? -node.width / 2 - 5 : (node.side === 'right' ? -node.width / 2 - 5 : -node.width / 2 - 55);
      hitRect.setAttribute('x', hitX);
      hitRect.setAttribute('y', effectiveIsBox ? -boxH / 2 - 4 : -18);
      hitRect.setAttribute('width', hitW);
      hitRect.setAttribute('height', effectiveIsBox ? boxH + 8 : 36);
      hitRect.setAttribute('fill', 'transparent');
      hitRect.setAttribute('style', 'cursor: pointer;');
      g.appendChild(hitRect);

      const textCenterY = isTopImage ? (-boxH / 2 + topImgH + (boxH - topImgH) / 2) : (effectiveIsBox ? 0 : 5);
      const badgeCenterY = isTopImage ? textCenterY : (effectiveIsBox ? 0 : 3);
      const hasDarkBg = hasImage && !isTopImage;

      // Nœud de branche : Mot-clé (Buzan : plus gros pour niveau 1, majuscules)
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('dominant-baseline', effectiveIsBox ? 'central' : 'bottom');
      text.setAttribute('y', textCenterY);
      text.setAttribute('class', 'mm-branch-text');
      if (hasDarkBg) {
        text.setAttribute('fill', '#ffffff');
        text.setAttribute('style', 'text-shadow: 0 1px 4px rgba(0,0,0,0.85); font-weight: 800;');
      } else {
        text.setAttribute('fill', 'var(--text-primary)');
      }
      if (isLvl1) {
        text.setAttribute('font-size', '14px');
        text.setAttribute('font-weight', '800');
        text.setAttribute('letter-spacing', '0.6px');
      } else if (isLvl2) {
        text.setAttribute('font-size', '11.5px');
        text.setAttribute('font-weight', '700');
        text.setAttribute('letter-spacing', '0.3px');
      } else {
        text.setAttribute('font-size', '10px');
        text.setAttribute('font-weight', '600');
        text.setAttribute('letter-spacing', '0.2px');
      }
      text.textContent = node.text;

      let markerX = null;
      let refX = null;
      let noteX = null;
      let textX = 0;

      const baseFontSize = node.isFloating ? 12 : (isLvl1 ? 14 : (isLvl2 ? 11.5 : 10));
      const baseFontWeight = node.isFloating || isLvl1 ? '800' : (isLvl2 ? '700' : '600');
      const textW = node.textWidth || this.getTextWidth(node.text, baseFontSize, baseFontWeight);
      const isWideMarker = node.marker && String(node.marker).toLowerCase().startsWith('p');
      const markerW = node.marker ? ((isWideMarker ? 22 : 18) + 6) : 0;
      const markerHalf = isWideMarker ? 11 : 9;

      const iconW = node.icon ? 22 : 0;
      const iconHalf = 10;
      let iconX = null;

      const displayRef = node.ref ? this.formatScripturePillRef(node.ref) : '';
      const refPillW = node.ref ? (node.refPillWidth || Math.max(38, this.getTextWidth(displayRef, 9.5, '700') + 14)) : 0;
      const notePillW = node.note ? 18 : 0;

      // Marqueur timbre d'angle pour mode Polaroid (top-image)
      if (isTopImage && node.marker) {
        const def = this.MARKER_DEFS[node.marker];
        if (def) {
          const cornerMarkerX = boxW / 2 - 13;
          const cornerMarkerY = -boxH / 2 + 13;
          const markerG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
          markerG.setAttribute('transform', `translate(${cornerMarkerX}, ${cornerMarkerY})`);
          markerG.setAttribute('class', 'mm-node-marker-badge mm-corner-marker');
          markerG.setAttribute('style', this.isReadOnly ? 'cursor: default;' : 'cursor: pointer;');
          markerG.setAttribute('title', this.isReadOnly ? `Marqueur : ${def.label}` : `Marqueur : ${def.label} (Cliquer pour faire défiler)`);

          const mHit = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          mHit.setAttribute('r', 13);
          mHit.setAttribute('fill', 'transparent');
          markerG.appendChild(mHit);

          if (def.isWide) {
            const mRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            mRect.setAttribute('x', -11);
            mRect.setAttribute('y', -8);
            mRect.setAttribute('width', 22);
            mRect.setAttribute('height', 16);
            mRect.setAttribute('rx', 4.5);
            mRect.setAttribute('fill', def.bg);
            mRect.setAttribute('stroke', 'rgba(255, 255, 255, 0.85)');
            mRect.setAttribute('stroke-width', '1.2');
            mRect.setAttribute('filter', 'drop-shadow(0 1px 3px rgba(0,0,0,0.5))');
            markerG.appendChild(mRect);
          } else {
            const mCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            mCircle.setAttribute('r', 8.5);
            mCircle.setAttribute('fill', def.bg);
            mCircle.setAttribute('stroke', 'rgba(255, 255, 255, 0.85)');
            mCircle.setAttribute('stroke-width', '1.2');
            mCircle.setAttribute('filter', 'drop-shadow(0 1px 3px rgba(0,0,0,0.5))');
            markerG.appendChild(mCircle);
          }

          const mText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          mText.setAttribute('text-anchor', 'middle');
          mText.setAttribute('dominant-baseline', 'central');
          mText.setAttribute('font-size', def.isWide ? '9px' : '9.5px');
          mText.setAttribute('font-weight', '800');
          mText.setAttribute('fill', def.text);
          mText.setAttribute('pointer-events', 'none');
          mText.textContent = def.label;
          markerG.appendChild(mText);

          markerG.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.isReadOnly) return;
            this.cycleNodeMarker(node.id);
          });

          g.appendChild(markerG);
        }
      }

      if (isTopImage) {
        // En mode Polaroid : pied de carte dédié centré contenant [Mot-clé] [Pastille biblique] [Note]
        let totalFooterW = textW;
        if (node.ref) totalFooterW += refPillW + 8;
        if (node.note) totalFooterW += notePillW + 8;

        let curX = -totalFooterW / 2;
        textX = curX;
        text.setAttribute('text-anchor', 'start');
        text.setAttribute('x', textX);
        curX += textW;

        if (node.ref) {
          curX += 8;
          refX = curX + refPillW / 2;
          curX += refPillW;
        }
        if (node.note) {
          curX += 8;
          noteX = curX + 9;
          curX += notePillW;
        }
      } else if (node.isFloating) {
        if (!node.marker && !node.icon && !node.ref && !node.note) {
          text.setAttribute('text-anchor', 'middle');
          text.setAttribute('x', 0);
        } else {
          let totalContent = textW;
          if (node.marker) totalContent += markerW;
          if (node.icon) totalContent += iconW;
          if (node.ref) totalContent += refPillW + 6;
          if (node.note) totalContent += notePillW + 6;

          let curX = -totalContent / 2;
          if (node.marker) {
            markerX = curX + markerHalf;
            curX += markerW;
          }
          if (node.icon) {
            iconX = curX + iconHalf;
            curX += iconW;
          }
          textX = curX;
          text.setAttribute('text-anchor', 'start');
          text.setAttribute('x', textX);
          curX += textW;

          if (node.ref) {
            curX += 6;
            refX = curX + refPillW / 2;
            curX += refPillW;
          }
          if (node.note) {
            curX += 6;
            noteX = curX + 9;
            curX += notePillW;
          }
        }
      } else if (isTopDown || node.side === 'right') {
        // De gauche à droite : [Marker] -> [Icon] -> Texte -> [Ref] -> [Note]
        let totalContent = textW;
        if (node.marker) totalContent += markerW;
        if (node.icon) totalContent += iconW;
        if (node.ref) totalContent += refPillW + 6;
        if (node.note) totalContent += notePillW + 6;

        let curX = -totalContent / 2;
        if (node.marker) {
          markerX = curX + markerHalf;
          curX += markerW;
        }
        if (node.icon) {
          iconX = curX + iconHalf;
          curX += iconW;
        }
        textX = curX;
        text.setAttribute('text-anchor', 'start');
        text.setAttribute('x', textX);
        curX += textW;

        if (node.ref) {
          curX += 6;
          refX = curX + refPillW / 2;
          curX += refPillW;
        }
        if (node.note) {
          curX += 6;
          noteX = curX + 9;
          curX += notePillW;
        }
      } else {
        // Branche à gauche : De gauche à droite [Note] -> [Ref] -> [Marker] -> [Icon] -> Texte
        let totalContent = textW;
        if (node.note) totalContent += notePillW + 6;
        if (node.ref) totalContent += refPillW + 6;
        if (node.marker) totalContent += markerW;
        if (node.icon) totalContent += iconW;

        let curX = -totalContent / 2;
        if (node.note) {
          noteX = curX + 9;
          curX += notePillW + 6;
        }
        if (node.ref) {
          refX = curX + refPillW / 2;
          curX += refPillW + 6;
        }
        if (node.marker) {
          markerX = curX + markerHalf;
          curX += markerW;
        }
        if (node.icon) {
          iconX = curX + iconHalf;
          curX += iconW;
        }
        textX = curX;
        text.setAttribute('text-anchor', 'start');
        text.setAttribute('x', textX);
        curX += textW;
      }

      if (!isImgOnly) {
        g.appendChild(text);
      } else {
        const nodeTitle = document.createElementNS('http://www.w3.org/2000/svg', 'title');
        let tooltipLines = [];
        let header = (node.text || '').toUpperCase();
        if (node.marker) {
          const mDef = this.MARKER_DEFS?.[node.marker];
          const mLabel = mDef ? mDef.label : node.marker;
          header = `[${mLabel}] ${header}`;
        }
        if (node.ref) {
          header += ` (${node.ref})`;
        }
        tooltipLines.push(header);
        if (node.note) {
          tooltipLines.push('---');
          tooltipLines.push(node.note);
        }
        nodeTitle.textContent = tooltipLines.join('\n');
        g.appendChild(nodeTitle);

        hitRect.addEventListener('mouseenter', () => this.showImageOnlyTooltip(g, node));
        hitRect.addEventListener('mouseleave', () => this.hideTooltip());
      }

      // Pastille Marqueur / Numéro / Priorité si présent (placé immédiatement à gauche du mot-clé, hors mode Polaroid où il est en timbre d'angle)
      if (!isImgOnly && !isTopImage && node.marker && markerX !== null) {
        const def = this.MARKER_DEFS[node.marker];
        if (def) {
          const markerG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
          markerG.setAttribute('transform', `translate(${markerX}, ${badgeCenterY})`);
          markerG.setAttribute('class', 'mm-node-marker-badge');
          markerG.setAttribute('style', this.isReadOnly ? 'cursor: default;' : 'cursor: pointer;');
          markerG.setAttribute('title', this.isReadOnly ? `Marqueur : ${def.label}` : `Marqueur : ${def.label} (Cliquer pour faire défiler)`);

          // Zone tactile de survol stable
          const mHit = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          mHit.setAttribute('r', def.isWide ? 14 : 12);
          mHit.setAttribute('fill', 'transparent');
          markerG.appendChild(mHit);

          if (def.isWide) {
            const mRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            mRect.setAttribute('x', -11);
            mRect.setAttribute('y', -8);
            mRect.setAttribute('width', 22);
            mRect.setAttribute('height', 16);
            mRect.setAttribute('rx', 4.5);
            mRect.setAttribute('fill', def.bg);
            markerG.appendChild(mRect);
          } else {
            const mCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            mCircle.setAttribute('r', 8.5);
            mCircle.setAttribute('fill', def.bg);
            markerG.appendChild(mCircle);
          }

          const mText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          mText.setAttribute('text-anchor', 'middle');
          mText.setAttribute('dominant-baseline', 'central');
          mText.setAttribute('font-size', def.isWide ? '9px' : '9.5px');
          mText.setAttribute('font-weight', '800');
          mText.setAttribute('fill', def.text);
          mText.setAttribute('pointer-events', 'none');
          mText.textContent = def.label;
          markerG.appendChild(mText);

          markerG.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.isReadOnly) return;
            this.cycleNodeMarker(node.id);
          });

          g.appendChild(markerG);
        }
      }

      // Badge Icône SVG vectorielle (pur SVG sans emoji - masqué en mode Polaroid où l'illustration IA remplace l'icône)
      if (!isImgOnly && !isTopImage && node.icon && iconX !== null && typeof SvgIconsRegistry !== 'undefined') {
        const iconDef = SvgIconsRegistry.get(node.icon);
        if (iconDef) {
          const iconG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
          iconG.setAttribute('transform', `translate(${iconX}, ${badgeCenterY})`);
          iconG.setAttribute('class', 'mm-node-icon-badge');
          iconG.setAttribute('style', this.isReadOnly ? 'cursor: default;' : 'cursor: pointer;');
          iconG.setAttribute('title', this.isReadOnly ? `Icône SVG : ${iconDef.label}` : `Icône SVG : ${iconDef.label} (Cliquer pour modifier ou [I])`);

          // Zone tactile de clic
          const iHit = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          iHit.setAttribute('r', 11);
          iHit.setAttribute('fill', 'transparent');
          iconG.appendChild(iHit);

          const svgWrap = document.createElementNS('http://www.w3.org/2000/svg', 'g');
          svgWrap.setAttribute('transform', 'translate(-7.5, -7.5) scale(0.64)');
          svgWrap.setAttribute('fill', 'none');
          svgWrap.setAttribute('stroke', hasDarkBg ? '#ffffff' : (isBox ? (node.color || 'var(--text-main)') : (node.color || 'var(--accent-blue)')));
          svgWrap.setAttribute('stroke-width', '2.2');
          svgWrap.setAttribute('stroke-linecap', 'round');
          svgWrap.setAttribute('stroke-linejoin', 'round');
          svgWrap.setAttribute('pointer-events', 'none');
          svgWrap.style.pointerEvents = 'none';
          svgWrap.innerHTML = iconDef.path;
          iconG.appendChild(svgWrap);

          iconG.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.isReadOnly) return;
            this.openIconPicker(node.id);
          });

          g.appendChild(iconG);
        }
      }

      // Pastille de référence biblique si présente
      if (!isImgOnly && node.ref && refX !== null) {
        const pillW = refPillW;
        const refG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        refG.setAttribute('transform', `translate(${refX}, ${badgeCenterY})`);
        refG.setAttribute('class', 'mm-scripture-pill');

        const refRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        refRect.setAttribute('x', -pillW / 2);
        refRect.setAttribute('y', -8);
        refRect.setAttribute('width', pillW);
        refRect.setAttribute('height', 16);
        refRect.setAttribute('rx', 4);
        const isDarkTheme = typeof document !== 'undefined' && !document.body.classList.contains('theme-light');
        if (hasDarkBg) {
          refRect.setAttribute('fill', 'rgba(255, 255, 255, 0.18)');
          refRect.setAttribute('stroke', 'rgba(255, 255, 255, 0.35)');
          refRect.setAttribute('stroke-width', '1');
          refRect.setAttribute('opacity', '1');
        } else if (isBox) {
          refRect.setAttribute('fill', isDarkTheme ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)');
          refRect.setAttribute('stroke', node.color || 'var(--accent-blue)');
          refRect.setAttribute('stroke-width', '1');
          refRect.setAttribute('opacity', '1');
        } else {
          refRect.setAttribute('fill', node.color || 'var(--accent-blue)');
          refRect.setAttribute('opacity', '0.18');
        }
        refG.appendChild(refRect);

        const refText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        refText.setAttribute('text-anchor', 'middle');
        refText.setAttribute('dominant-baseline', 'central');
        refText.setAttribute('font-size', '9px');
        refText.setAttribute('font-weight', '800');
        refText.setAttribute('letter-spacing', '0.3px');
        refText.setAttribute('fill', hasDarkBg ? '#ffffff' : (isDarkTheme ? '#f8fafc' : (isBox ? '#0f172a' : (node.color || '#2563eb'))));
        refText.textContent = displayRef;
        refG.appendChild(refText);

        refG.addEventListener('mouseenter', () => this.showScriptureTooltip(refG, node.ref));
        refG.addEventListener('mouseleave', () => this.hideTooltip());

        refG.addEventListener('click', (e) => {
          e.stopPropagation();
          this.hideTooltip();
          this.openScriptureRef(node.ref);
        });

        g.appendChild(refG);
      }

      // Pastille d'annotation / Note textuelle si présente (Topic Note XMind)
      if (!isImgOnly && node.note && noteX !== null) {
        const noteG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        noteG.setAttribute('transform', `translate(${noteX}, ${badgeCenterY})`);
        noteG.setAttribute('class', 'mm-note-pill');
        noteG.setAttribute('style', 'cursor: pointer;');
        noteG.setAttribute('title', this.isReadOnly ? 'Note de branche (Cliquer pour agrandir)' : 'Note de branche (Cliquer pour modifier)');

        const noteCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        noteCircle.setAttribute('r', 8.5);
        noteCircle.setAttribute('fill', 'var(--bg-card, #ffffff)');
        noteCircle.setAttribute('stroke', node.color || 'var(--accent-blue)');
        noteCircle.setAttribute('stroke-width', '1.2px');
        noteG.appendChild(noteCircle);

        // Petite icône carnet / note SVG épurée
        const noteIconColor = node.color || 'var(--accent-blue, #2563eb)';
        const noteIconG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        noteIconG.setAttribute('transform', 'translate(-5, -5) scale(0.42)');
        noteIconG.setAttribute('stroke', noteIconColor);
        noteIconG.setAttribute('fill', 'none');
        noteIconG.innerHTML = `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" fill="none" stroke="${noteIconColor}" stroke-width="2.5"/><polyline points="14 2 14 8 20 8" fill="none" stroke="${noteIconColor}" stroke-width="2.5"/><line x1="16" y1="13" x2="8" y2="13" stroke="${noteIconColor}" stroke-width="2.5"/><line x1="16" y1="17" x2="8" y2="17" stroke="${noteIconColor}" stroke-width="2.5"/>`;
        noteG.appendChild(noteIconG);

        noteG.addEventListener('mouseenter', () => this.showNoteTooltip(noteG, node.note));
        noteG.addEventListener('mouseleave', () => this.hideTooltip());

        noteG.addEventListener('click', (e) => {
          e.stopPropagation();
          if (this.isReadOnly) {
            this.showNoteModalReadOnly(node);
            return;
          }
          this.hideTooltip();
          this.promptTopicNote(node.id);
        });

        g.appendChild(noteG);
      }

      // Actions au survol ou à la sélection (Loi ergonomie 100% Souris - désactivé en lecture seule)
      if (!this.isReadOnly) {
        const actionsG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        actionsG.setAttribute('class', 'mm-node-actions');

        const hasKids = node.children && node.children.length > 0;
        const foldOffset = hasKids ? (isImgOnly ? 20 : 14) : (isImgOnly ? 4 : 0);
        const actionY = effectiveIsBox ? 0 : 3;
        const endX = (isTopDown || node.side === 'right') ? node.width / 2 + 13 + foldOffset : -node.width / 2 - 13 - foldOffset;
        const addSubBtn = this.createActionButton('+', endX, actionY, () => this.addChildToNode(node));
        addSubBtn.setAttribute('title', 'Ajouter une sous-branche');

        const delX = (isTopDown || node.side === 'right') ? node.width / 2 + 33 + foldOffset : -node.width / 2 - 33 - foldOffset;
        const delBtn = this.createActionButton('×', delX, actionY, () => this.deleteNode(node.id), true);
        delBtn.setAttribute('title', 'Supprimer la branche');

        actionsG.appendChild(addSubBtn);
        actionsG.appendChild(delBtn);
        g.appendChild(actionsG);
      }
    }

    // ── Indicateur de repli Fold/Unfold ──────────────────────────────────────
    // Positionné à l'extrémité exacte de la branche pour tout nœud ayant des sous-branches
    if (!isRoot && node.children && node.children.length > 0) {
      const isCollapsed = this.collapsedNodes && this.collapsedNodes.has(node.id);
      const foldG = document.createElementNS('http://www.w3.org/2000/svg', 'g');

      // Coordonnées exactes à l'extrémité de la branche dans le repère local de g
      const foldDir = (isTopDown || (node.side || 'right') === 'right') ? 1 : -1;
      const foldOffset = isImgOnly ? 10 : 6;
      const foldX = isTopDown ? 0 : foldDir * (node.width / 2 + foldOffset);
      const foldY = isTopDown ? (effectiveIsBox ? (node.height || 28) / 2 + 7 : 17) : (effectiveIsBox ? 0 : 10);

      foldG.setAttribute('transform', `translate(${foldX}, ${foldY})`);
      foldG.setAttribute('class', `mm-fold-indicator ${isCollapsed ? 'is-folded' : ''} ${isImgOnly ? 'mm-fold-img-only' : ''}`);
      foldG.setAttribute('title', isCollapsed ? `Déplier (${node.children.length} sous-branches) — [F]` : 'Replier les sous-branches — [F]');
      foldG.setAttribute('style', 'cursor: pointer;');
      foldG.setAttribute('data-node-id', node.id);

      const foldCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      foldCircle.setAttribute('r', isCollapsed ? 8.5 : 7.5);
      foldCircle.setAttribute('fill', isCollapsed ? (node.color || '#2563eb') : 'var(--bg-card, #ffffff)');
      foldCircle.setAttribute('stroke', node.color || '#2563eb');
      foldCircle.setAttribute('stroke-width', '1.6');
      foldG.appendChild(foldCircle);

      if (isCollapsed) {
        // En mode replié : badge bien visible avec le nombre de branches masquées
        const countText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        countText.setAttribute('text-anchor', 'middle');
        countText.setAttribute('dominant-baseline', 'central');
        countText.setAttribute('font-size', '8px');
        countText.setAttribute('font-weight', '900');
        countText.setAttribute('fill', '#ffffff');
        countText.setAttribute('pointer-events', 'none');
        countText.textContent = node.children.length;
        foldG.appendChild(countText);
      } else {
        // En mode déplié : tiret discret de la couleur de la branche
        const minusLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        minusLine.setAttribute('x1', '-3.2');
        minusLine.setAttribute('y1', '0');
        minusLine.setAttribute('x2', '3.2');
        minusLine.setAttribute('y2', '0');
        minusLine.setAttribute('stroke', node.color || '#2563eb');
        minusLine.setAttribute('stroke-width', '1.8');
        minusLine.setAttribute('stroke-linecap', 'round');
        minusLine.setAttribute('pointer-events', 'none');
        foldG.appendChild(minusLine);
      }

      foldG.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleNodeCollapse(node.id);
      });

      // Crucial : ajouter à g (le groupe du nœud) pour être parfaitement positionné avec le nœud
      g.appendChild(foldG);
    }

    // Initialisation du glisser-déplacer spatial pour les branches (non-root - désactivé en lecture seule)
    if (!isRoot && !this.isReadOnly) {
      g.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return; // Clic gauche uniquement
        if (this.connectingSourceId) return; // Priorité au mode création de liaison
        if (e.target.closest('.mm-action-btn, .mm-scripture-pill, .mm-note-pill, .mm-fold-indicator')) return;

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
          initialX: node.x || 0,
          initialY: node.y || 0,
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
      if (this.isReadOnly) return;
      if (this.dragState.hasMoved) return;
      this.startInlineEdit(node.id);
    });

    g.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (this.isReadOnly) return;
      this.selectNode(node.id);
      this.showContextMenu(e.clientX, e.clientY, node.id);
    });

    this.viewportG.appendChild(g);

    // Récursion sur les enfants (bloquée si le nœud est replié)
    if (node.children && !(this.collapsedNodes && this.collapsedNodes.has(node.id))) {
      node.children.forEach(child => this.drawNodes(child));
    }
  },

  // ── Mode Mémorisation : Fold / Unfold des branches ───────────────────────
  toggleNodeCollapse(nodeId) {
    if (!nodeId || nodeId === 'root') return;
    if (!this.collapsedNodes) this.collapsedNodes = new Set();
    if (this.collapsedNodes.has(nodeId)) {
      this.collapsedNodes.delete(nodeId);
    } else {
      this.collapsedNodes.add(nodeId);
    }
    this.draw();
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
    this.selectedBoundaryId = null;
    this.updateSelectionState();
  },

  updateSelectionState() {
    this.viewportG?.querySelectorAll('.mm-node-g').forEach(el => {
      const isSel = el.getAttribute('data-id') === this.selectedNodeId;
      el.classList.toggle('selected', isSel);
      const box = el.querySelector('.mm-branch-box, .mm-root-rect, .mm-floating-box');
      if (box) {
        box.setAttribute('filter', isSel ? 'url(#mm-select-glow)' : 'url(#mm-glow)');
      }
    });
    this.viewportG?.querySelectorAll('.mm-relationship-g, .mm-rel-label-wrap, .mm-rel-label-g').forEach(el => {
      const isRelSel = el.getAttribute('data-rel-id') === this.selectedRelId;
      el.classList.toggle('selected', isRelSel);
    });
    this.viewportG?.querySelectorAll('.mm-rel-handle').forEach(handle => {
      const wrap = handle.closest('[data-rel-id]');
      const relId = wrap ? wrap.getAttribute('data-rel-id') : handle.getAttribute('data-rel-id');
      const isRelSel = relId === this.selectedRelId;
      handle.style.display = (isRelSel && !this.isReadOnly) ? 'inline' : 'none';
    });
    this.viewportG?.querySelectorAll('.mm-rel-handle-line').forEach(line => {
      const wrap = line.closest('[data-rel-id]');
      const relId = wrap ? wrap.getAttribute('data-rel-id') : line.getAttribute('data-rel-id');
      const isRelSel = relId === this.selectedRelId;
      line.style.display = (isRelSel && !this.isReadOnly) ? 'inline' : 'none';
    });
    this.viewportG?.querySelectorAll('.mm-boundary-g').forEach(el => {
      const isBndSel = el.getAttribute('data-boundary-id') === this.selectedBoundaryId;
      el.classList.toggle('selected', isBndSel);
      const delBtn = el.querySelector('.mm-boundary-del-btn');
      if (delBtn) {
        delBtn.style.display = (isBndSel && !this.isReadOnly) ? 'inline' : 'none';
      }
    });
    this.updateMarkerPopoverUI();
  },

  findNode(id, current = this.tree) {
    if (!current) return null;
    if (current.id === id) return current;
    if (current.children) {
      for (const child of current.children) {
        const found = this.findNode(id, child);
        if (found) return found;
      }
    }
    if (current === this.tree && this.floatingTopics && this.floatingTopics.length > 0) {
      for (const ft of this.floatingTopics) {
        const found = this.findNode(id, ft);
        if (found) return found;
      }
    }
    return null;
  },

  findParent(id, current = this.tree) {
    if (!current) return null;
    if (current.children) {
      for (const child of current.children) {
        if (child.id === id) return current;
        const found = this.findParent(id, child);
        if (found) return found;
      }
    }
    if (current === this.tree && this.floatingTopics && this.floatingTopics.length > 0) {
      for (const ft of this.floatingTopics) {
        const found = this.findParent(id, ft);
        if (found) return found;
      }
    }
    return null;
  },

  findNodeByText(text, current = this.tree) {
    if (!current || !text) return null;
    const clean = text.trim().toUpperCase();
    if (current.text && current.text.trim().toUpperCase() === clean) return current;
    if (current.children) {
      for (const child of current.children) {
        const found = this.findNodeByText(text, child);
        if (found) return found;
      }
    }
    if (current === this.tree && this.floatingTopics && this.floatingTopics.length > 0) {
      for (const ft of this.floatingTopics) {
        const found = this.findNodeByText(text, ft);
        if (found) return found;
      }
    }
    return null;
  },

  addChildToSelected() {
    if (this.isReadOnly) return;
    const target = this.selectedNodeId ? this.findNode(this.selectedNodeId) : this.tree;
    if (target) this.addChildToNode(target);
  },

  addChildToNode(parentNode) {
    if (this.isReadOnly) return;
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
    if (this.isReadOnly) return;
    if (!this.selectedNodeId || this.selectedNodeId === 'root') {
      this.addChildToNode(this.tree);
      return;
    }

    // Si le nœud sélectionné est une racine de sujet flottant
    const floatingRoot = this.floatingTopics?.find(ft => ft.id === this.selectedNodeId);
    if (floatingRoot) {
      this.createFloatingTopic(floatingRoot.x, floatingRoot.y + 50);
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
    if (this.isReadOnly) return;
    if (!this.selectedNodeId || this.selectedNodeId === 'root') return;
    this.deleteNode(this.selectedNodeId);
  },

  deleteNode(id) {
    if (this.isReadOnly) return;
    // Si c'est un sujet flottant racine
    const ftIndex = this.floatingTopics?.findIndex(ft => ft.id === id);
    if (ftIndex !== undefined && ftIndex !== -1) {
      const deletedIds = new Set();
      const collectIds = (n) => {
        if (!n) return;
        deletedIds.add(n.id);
        if (n.children) n.children.forEach(collectIds);
      };
      collectIds(this.floatingTopics[ftIndex]);
      this.floatingTopics.splice(ftIndex, 1);
      this.selectedNodeId = null;

      if (this.relationships && this.relationships.length > 0) {
        this.relationships = this.relationships.filter(r => !deletedIds.has(r.fromId) && !deletedIds.has(r.toId));
      }
      if (this.boundaries && this.boundaries.length > 0) {
        this.boundaries = this.boundaries.filter(b => !deletedIds.has(b.rootId));
        if (this.selectedBoundaryId && !this.boundaries.some(b => b.id === this.selectedBoundaryId)) {
          this.selectedBoundaryId = null;
        }
      }
      this.layoutTree();
      if (this.viewMode === 'outline') {
        this.renderOutlineView();
      } else {
        this.draw();
        this.updateSelectionState();
      }
      this.syncAndAutoSave();
      return;
    }

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

    if (this.boundaries && this.boundaries.length > 0) {
      this.boundaries = this.boundaries.filter(b => !deletedIds.has(b.rootId));
      if (this.selectedBoundaryId && !this.boundaries.some(b => b.id === this.selectedBoundaryId)) {
        this.selectedBoundaryId = null;
      }
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

    const isFloatingRoot = this.floatingTopics?.some(ft => ft.id === draggedId);
    let currentParent = null;
    if (!isFloatingRoot) {
      currentParent = this.findParent(draggedId);
      if (!currentParent) return false;
      if (currentParent.id === newParentId) return false;
    }

    const draggedNode = this.findNode(draggedId);
    if (!draggedNode) return false;

    const newParent = this.findNode(newParentId);
    if (!newParent) return false;

    // Retirer de l'ancien parent / conteneur flottant
    if (isFloatingRoot) {
      this.floatingTopics = this.floatingTopics.filter(ft => ft.id !== draggedId);
      draggedNode.isFloating = false;
      delete draggedNode.x;
      delete draggedNode.y;
    } else {
      currentParent.children = currentParent.children.filter(c => c.id !== draggedId);
    }

    draggedNode.offsetX = 0;
    draggedNode.offsetY = 0;

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

  updateReparentDropTarget(clientX, clientY, draggedId) {
    document.querySelectorAll('.reparent-drop-target').forEach(el => el.classList.remove('reparent-drop-target'));
    this.reparentDropTargetId = null;

    const elements = document.elementsFromPoint ? document.elementsFromPoint(clientX, clientY) : [document.elementFromPoint(clientX, clientY)];
    if (!elements) return;

    for (const el of elements) {
      if (!el) continue;
      const nodeG = el.closest ? el.closest('.mm-node-g') : null;
      if (nodeG) {
        const targetId = nodeG.getAttribute('data-id');
        if (targetId && targetId !== draggedId && !this.isDescendant(draggedId, targetId)) {
          this.reparentDropTargetId = targetId;
          nodeG.classList.add('reparent-drop-target');
          break;
        }
      }
    }
  },

  createFloatingTopic(x, y, text = 'SUJET FLOTTANT') {
    if (this.isReadOnly) return null;
    const id = `float_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const colors = ['#0284c7', '#2563eb', '#0d9488', '#d97706', '#7c3aed', '#db2777'];
    const color = colors[(this.floatingTopics?.length || 0) % colors.length];

    const newTopic = {
      id: id,
      text: text.toUpperCase(),
      ref: '',
      note: '',
      color: color,
      x: x !== undefined ? x : 200,
      y: y !== undefined ? y : 100,
      width: 100,
      height: 32,
      level: 1,
      side: 'right',
      children: [],
      isFloating: true
    };

    this.floatingTopics = this.floatingTopics || [];
    this.floatingTopics.push(newTopic);

    this.layoutTree();
    if (this.viewMode === 'outline') {
      this.renderOutlineView();
      const newEl = document.querySelector(`.mm-outline-text[data-id="${id}"]`);
      if (newEl) this.startOutlineInlineEdit(id, newEl);
    } else {
      this.draw();
      this.selectNode(id);
      this.startInlineEdit(id);
    }
    this.syncAndAutoSave();

    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast('Nouveau sujet flottant créé');
    }
    return newTopic;
  },

  detachAsFloatingTopic(nodeId) {
    if (this.isReadOnly) return;
    if (!nodeId || nodeId === 'root') return;
    const node = this.findNode(nodeId);
    if (!node || node.isFloating) return;

    const parent = this.findParent(nodeId);
    if (!parent) return;

    // Retirer de son parent
    parent.children = parent.children.filter(c => c.id !== nodeId);

    // Calculer une position par défaut à proximité de l'ancienne position
    const currentX = node.x || 300;
    const currentY = node.y || 200;
    const offset = 40;

    node.isFloating = true;
    node.x = currentX + (node.side === 'left' ? -offset : offset);
    node.y = currentY;
    node.level = 1;
    node.side = 'right';
    node.offsetX = 0;
    node.offsetY = 0;

    this.floatingTopics = this.floatingTopics || [];
    this.floatingTopics.push(node);

    this.selectedNodeId = node.id;
    this.layoutTree();
    if (this.viewMode === 'outline') {
      this.renderOutlineView();
    } else {
      this.draw();
      this.updateSelectionState();
    }
    this.syncAndAutoSave();

    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast(`Branche « ${node.text} » détachée en sujet flottant`);
    }
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

  hexToRgba(hex, alpha = 0.2) {
    if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) {
      return `rgba(37, 99, 235, ${alpha})`;
    }
    const clean = hex.replace('#', '');
    let r, g, b;
    if (clean.length === 3) {
      r = parseInt(clean[0] + clean[0], 16);
      g = parseInt(clean[1] + clean[1], 16);
      b = parseInt(clean[2] + clean[2], 16);
    } else {
      r = parseInt(clean.substring(0, 2), 16);
      g = parseInt(clean.substring(2, 4), 16);
      b = parseInt(clean.substring(4, 6), 16);
    }
    if (isNaN(r) || isNaN(g) || isNaN(b)) {
      return `rgba(37, 99, 235, ${alpha})`;
    }
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  },

  startInlineEdit(nodeId) {
    if (this.isReadOnly) return;
    this.hideTooltip();
    const node = this.findNode(nodeId);
    if (!node) return;

    const nodeG = this.viewportG?.querySelector(`.mm-node-g[data-id="${nodeId}"]`);
    if (!nodeG) return;

    const isRoot = nodeId === 'root';
    const isFloating = !!node.isFloating;
    const isCentered = isRoot || isFloating;
    const textEl = nodeG.querySelector('.mm-branch-text') || nodeG.querySelector('.mm-root-text');
    const targetRect = textEl ? textEl.getBoundingClientRect() : nodeG.getBoundingClientRect();

    const scale = this.viewBox?.scale || 1;
    const baseFontSize = isRoot ? 14 : (isFloating ? 12 : (node.level === 1 ? 13.5 : (node.level === 2 ? 11.5 : 10.5)));
    const baseFontWeight = isRoot || node.level === 1 || isFloating ? '800' : (node.level === 2 ? '700' : '600');
    const isLeft = node.side === 'left' && !isFloating;

    // Masquer le texte SVG et les boutons d'actions pendant l'édition
    nodeG.classList.add('editing');

    // Création de l'input transparent calé directement sur le texte avec GPU scale
    const input = document.createElement('input');
    input.type = 'text';
    input.value = node.text;
    input.placeholder = 'MOT-CLÉ';
    const isPaperMode = !!(this.container && this.container.classList.contains('paper-mode'));
    const isDarkMode = document.body.classList.contains('theme-dark') ||
      Array.from(document.body.classList).some(c => c.includes('palette-dark'));
    input.className = isPaperMode ? 'mm-inline-editor paper-mode' : 'mm-inline-editor';
    input.style.position = 'fixed';
    // Fond légèrement opaque pour garantir la lisibilité en tout contexte
    if (isPaperMode) {
      input.style.background = 'rgba(255,255,255,0.92)';
      input.style.color = '#0f172a';
    } else if (isDarkMode) {
      input.style.background = 'rgba(15,23,42,0.88)';
      input.style.color = '#f8fafc';
    } else {
      input.style.background = 'rgba(255,255,255,0.92)';
      input.style.color = '#0f172a';
    }
    input.style.borderRadius = '4px';
    input.style.border = 'none';
    input.style.outline = 'none';
    input.style.boxShadow = 'none';
    input.style.padding = '0 3px';
    input.style.margin = '0';
    input.style.top = `${Math.round(targetRect.top)}px`;
    input.style.height = `${Math.max(16, Math.round(targetRect.height / scale))}px`;
    input.style.lineHeight = `${Math.max(16, Math.round(targetRect.height / scale))}px`;
    input.style.fontSize = `${baseFontSize}px`;
    input.style.fontWeight = baseFontWeight;
    input.style.letterSpacing = '0.5px';
    input.style.transformOrigin = '0 0';
    input.style.transform = `scale(${scale})`;
    input.style.caretColor = node.color || 'var(--accent-blue, #2563eb)';

    const unscaledTextW = this.getTextWidth(node.text, baseFontSize, baseFontWeight);
    const initialUnscaledW = Math.max(unscaledTextW + 12, 40);
    input.style.width = `${initialUnscaledW}px`;

    if (isLeft) {
      input.style.textAlign = 'right';
      input.style.left = `${Math.round(targetRect.right - initialUnscaledW * scale)}px`;
    } else if (isCentered) {
      input.style.textAlign = 'center';
      const centerX = targetRect.left + targetRect.width / 2;
      input.style.left = `${Math.round(centerX - (initialUnscaledW * scale) / 2)}px`;
    } else {
      input.style.textAlign = 'left';
      input.style.left = `${Math.round(targetRect.left)}px`;
    }

    document.body.appendChild(input);
    input.focus();
    input.select();

    // Redimensionnement dynamique continu au fil de la frappe
    const handleDynamicResize = () => {
      const currentVal = input.value || ' ';
      const curW = Math.max(this.getTextWidth(currentVal, baseFontSize, baseFontWeight) + 12, 40);
      input.style.width = `${curW}px`;

      if (isLeft) {
        input.style.left = `${Math.round(targetRect.right - curW * scale)}px`;
      } else if (isCentered) {
        const centerX = targetRect.left + targetRect.width / 2;
        input.style.left = `${Math.round(centerX - (curW * scale) / 2)}px`;
      } else {
        input.style.left = `${Math.round(targetRect.left)}px`;
      }
    };

    input.addEventListener('input', handleDynamicResize);

    let isCommitted = false;

    const finish = (newText = null) => {
      if (isCommitted) return;
      isCommitted = true;

      nodeG.classList.remove('editing');
      if (input.parentNode) {
        input.remove();
      }

      if (newText !== null) {
        // Détection intelligente d'un mot-clé d'icône SVG tapé : ::croix, ::bible, etc.
        const iconMatch = newText.match(/::([a-zA-Z0-9_-]+):?/i);
        if (iconMatch && typeof SvgIconsRegistry !== 'undefined') {
          const candidate = iconMatch[1].toLowerCase();
          if (SvgIconsRegistry.has(candidate)) {
            node.icon = candidate;
            newText = newText.replace(iconMatch[0], '').trim();
          }
        }

        node.text = newText || (node.icon ? SvgIconsRegistry.get(node.icon)?.label?.toUpperCase() : 'MOT-CLÉ');
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
      if (e.key === 'Enter' || e.key === 'Tab') {
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
    let rect = this.svg.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) {
      const cW = this.container?.clientWidth || this.svg.parentElement?.clientWidth || 0;
      const cH = this.container?.clientHeight || this.svg.parentElement?.clientHeight || 0;
      if (cW > 0 && cH > 0) {
        rect = { width: cW, height: cH };
      } else {
        return;
      }
    }

    // 1. Calcul de l'emprise géométrique réelle de tous les éléments (BBox SVG ou parcours récursif)
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

    let bbox = null;
    try {
      if (this.viewportG && typeof this.viewportG.getBBox === 'function') {
        bbox = this.viewportG.getBBox();
      }
    } catch (e) {
      bbox = null;
    }

    if (bbox && bbox.width > 20 && bbox.height > 20 && isFinite(bbox.x) && isFinite(bbox.y)) {
      minX = bbox.x;
      maxX = bbox.x + bbox.width;
      minY = bbox.y;
      maxY = bbox.y + bbox.height;
    } else {
      // Fallback géométrique analytique
      const traverse = (node) => {
        if (!node) return;
        const w = (node.width || 120) / 2 + 30;
        const h = (node.height || 36) / 2 + 20;
        minX = Math.min(minX, node.x - w);
        maxX = Math.max(maxX, node.x + w);
        minY = Math.min(minY, node.y - h);
        maxY = Math.max(maxY, node.y + h);
        if (node.children) node.children.forEach(traverse);
      };
      traverse(this.tree);

      // Prise en compte des enclos dans le cadrage automatique
      if (this.boundaries && this.boundaries.length > 0) {
        this.boundaries.forEach(bnd => {
          const b = this.getBoundaryBBox(bnd);
          if (b) {
            minX = Math.min(minX, b.x);
            maxX = Math.max(maxX, b.x + b.width);
            minY = Math.min(minY, b.y - 14); // Marge pour l'étiquette pilule
            maxY = Math.max(maxY, b.y + b.height);
          }
        });
      }
    }

    if (!isFinite(minX) || !isFinite(maxX) || minX >= maxX) {
      minX = -120; maxX = 120;
      minY = -60; maxY = 60;
    }

    const contentW = Math.max(100, maxX - minX);
    const contentH = Math.max(80, maxY - minY);
    const contentCenterX = (minX + maxX) / 2;
    const contentCenterY = (minY + maxY) / 2;

    // 2. Marge de confort généreuse autour de la carte
    const padding = 70;
    const availW = Math.max(80, rect.width - padding * 2);
    const availH = Math.max(80, rect.height - padding * 2);

    // 3. Calcul du zoom optimal pour embrasser 100% de la carte sans coupure
    const scaleX = availW / contentW;
    const scaleY = availH / contentH;
    const fitScale = Math.min(scaleX, scaleY);

    // Bornes de zoom douces : min 0.25 (très grande carte), max 1.15 (éviter le gigantisme sur petite carte)
    const targetScale = Math.min(Math.max(0.25, fitScale), 1.15);

    // 4. Centrage précis sur le centre de gravité de la carte
    this.viewBox.x = rect.width / 2 - contentCenterX * targetScale;
    this.viewBox.y = rect.height / 2 - contentCenterY * targetScale;
    this.viewBox.scale = targetScale;

    this.applyTransform();
  },

  autoReorganize() {
    if (this.isReadOnly) return;
    if (!this.tree) return;

    // Réinitialisation de tous les décalages spatiaux manuels
    const resetOffsets = (node) => {
      node.offsetX = 0;
      node.offsetY = 0;
      if (node.children) node.children.forEach(resetOffsets);
    };
    resetOffsets(this.tree);
    if (this.floatingTopics) this.floatingTopics.forEach(resetOffsets);

    // Réinitialisation des courbures manuelles des liaisons pour un tracé automatique équilibré
    if (this.relationships) {
      this.relationships.forEach(rel => {
        rel.customControl = null;
      });
    }

    this.layoutTree();

    // Dégagement automatique des sujets flottants s'ils chevauchent des branches de l'arbre ou des enclos
    if (this.floatingTopics && this.floatingTopics.length > 0) {
      if (this.tree) {
        const allTreeNodes = [];
        const collect = (n) => {
          allTreeNodes.push(n);
          if (n.children) n.children.forEach(collect);
        };
        collect(this.tree);

        this.floatingTopics.forEach(ft => {
          const ftHalfW = (ft.width || 88) / 2;
          const ftHalfH = (ft.height || 32) / 2;
          allTreeNodes.forEach(tn => {
            const tnHalfW = (tn.width || 80) / 2;
            const tnHalfH = (tn.height || 28) / 2;
            const padX = ftHalfW + tnHalfW + 25;
            const padY = ftHalfH + tnHalfH + 20;
            if (Math.abs(ft.x - tn.x) < padX && Math.abs(ft.y - tn.y) < padY) {
              if (ft.y <= tn.y) {
                ft.y = tn.y - padY;
              } else {
                ft.y = tn.y + padY;
              }
            }
          });
        });
      }

      if (this.boundaries && this.boundaries.length > 0) {
        this.boundaries.forEach(bnd => {
          const bbox = this.getBoundaryBBox(bnd);
          if (!bbox) return;
          this.floatingTopics.forEach(ft => {
            const ftHalfW = (ft.width || 88) / 2;
            const ftHalfH = (ft.height || 32) / 2;
            const ftLeft = ft.x - ftHalfW;
            const ftRight = ft.x + ftHalfW;
            const ftTop = ft.y - ftHalfH;
            const ftBottom = ft.y + ftHalfH;
            const bTop = bbox.y - 14;
            const bBottom = bbox.y + bbox.height + 10;
            const bLeft = bbox.x - 10;
            const bRight = bbox.x + bbox.width + 10;

            if (ftRight > bLeft && ftLeft < bRight && ftBottom > bTop && ftTop < bBottom) {
              if (ft.y < (bTop + bBottom) / 2) {
                ft.y = bTop - ftHalfH - 15;
              } else {
                ft.y = bBottom + ftHalfH + 15;
              }
            }
          });
        });
      }
    }
    this.draw();
    this.fitView();
    this.syncAndAutoSave();
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
    const overlay = document.getElementById('mm-help-overlay');
    const drawer = document.getElementById('mindmap-help-drawer');
    const target = overlay || drawer;
    if (!target) return;
    const isHidden = target.classList.contains('hidden');
    const shouldOpen = force !== null ? !!force : isHidden;
    if (overlay) overlay.classList.toggle('hidden', !shouldOpen);
    if (drawer && drawer !== overlay) drawer.classList.toggle('hidden', !shouldOpen);
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

  formatVerseText(rawText) {
    if (!rawText) return '';
    let safe = String(rawText).replace(/</g, '&lt;').replace(/>/g, '&gt;');
    // Rétablir proprement les balises exposant pour les numéros de versets
    safe = safe.replace(/&lt;sup&gt;(\d+)&lt;\/sup&gt;/gi, '<sup>$1</sup>');
    safe = safe.replace(/&lt;br\s*\/?&gt;/gi, '<br>');
    return safe;
  },

  showTooltip(targetEl, contentHtml) {
    if (!this.tooltipEl) {
      this.tooltipEl = document.createElement('div');
      this.tooltipEl.id = 'mm-floating-tooltip';
      this.tooltipEl.className = 'mm-floating-tooltip';
      document.body.appendChild(this.tooltipEl);
    }

    this.tooltipEl.innerHTML = contentHtml;
    this.tooltipEl.style.display = 'block';
    this.positionTooltip(targetEl);
  },

  positionTooltip(targetEl) {
    if (!this.tooltipEl || !targetEl) return;
    const rect = (typeof targetEl.getBoundingClientRect === 'function')
      ? targetEl.getBoundingClientRect()
      : { left: 0, top: 0, width: 0, height: 0, bottom: 0 };
    const tooltipRect = this.tooltipEl.getBoundingClientRect();
    const tooltipW = tooltipRect.width || 330;
    const tooltipH = tooltipRect.height || 140;

    // Centrage horizontal fixe sur l'élément survolé
    let left = rect.left + (rect.width / 2) - (tooltipW / 2);
    const padding = 16;
    if (left < padding) left = padding;
    if (left + tooltipW > window.innerWidth - padding) {
      left = window.innerWidth - tooltipW - padding;
    }

    // Position fixe au-dessus de l'élément (ou en dessous si manque d'espace en haut)
    let top = rect.top - tooltipH - 10;
    if (top < padding) {
      top = rect.bottom + 10;
    }

    this.tooltipEl.style.left = `${Math.round(left)}px`;
    this.tooltipEl.style.top = `${Math.round(top)}px`;
  },

  hideTooltip() {
    this.currentTooltipTarget = null;
    if (this.tooltipEl) {
      this.tooltipEl.style.display = 'none';
    }
  },

  async showScriptureTooltip(targetEl, ref) {
    this.currentTooltipTarget = ref;
    const activeBible = (typeof BibleReader !== 'undefined' && BibleReader.currentBible1) 
      ? BibleReader.currentBible1 
      : (localStorage.getItem('bible_version') || 'Segond 21');
    const cacheKey = `${ref}_${activeBible}`.trim().toLowerCase();

    const renderTooltip = (verseText = null, version = null) => {
      const displayVer = version || (typeof BibleReader !== 'undefined' && typeof BibleReader.getBibleDisplayName === 'function' 
        ? BibleReader.getBibleDisplayName(activeBible) 
        : activeBible);
      let html = `
        <div class="mm-tooltip-header">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
          <span>Verset (${this.escapeHtml(displayVer)})</span>
        </div>
        <div class="mm-tooltip-ref">${this.escapeHtml(ref)}</div>
      `;
      if (verseText) {
        html += `<div class="mm-tooltip-verse-text">« ${this.formatVerseText(verseText)} »</div>`;
      }
      html += `<div class="mm-tooltip-hint">Cliquer pour ouvrir dans le lecteur biblique</div>`;
      return html;
    };

    if (this._verseCache && this._verseCache[cacheKey]) {
      const cached = this._verseCache[cacheKey];
      this.showTooltip(targetEl, renderTooltip(cached.text, cached.version));
      return;
    }

    this.showTooltip(targetEl, renderTooltip());

    try {
      this._verseCache = this._verseCache || {};
      if (typeof API !== 'undefined' && API.getVersePreview) {
        const res = await API.getVersePreview(ref, activeBible);
        if (res && res.success && res.text) {
          const verName = res.version || res.bible || (typeof BibleReader !== 'undefined' && typeof BibleReader.getBibleDisplayName === 'function' ? BibleReader.getBibleDisplayName(activeBible) : activeBible);
          this._verseCache[cacheKey] = { text: res.text, version: verName };
          if (this.currentTooltipTarget === ref && this.tooltipEl && this.tooltipEl.style.display !== 'none') {
            this.showTooltip(targetEl, renderTooltip(res.text, verName));
          }
        }
      }
    } catch (err) {
      // Ignorer si la prévisualisation échoue
    }
  },

  showNoteTooltip(targetEl, noteText) {
    this.currentTooltipTarget = null;
    const hintText = this.isReadOnly ? 'Cliquer pour agrandir' : 'Cliquer ou F4 pour modifier';
    const html = `
      <div class="mm-tooltip-header">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
        <span>Note de branche</span>
      </div>
      <div class="mm-tooltip-body">${this.escapeHtml(noteText)}</div>
      <div class="mm-tooltip-hint">${hintText}</div>
    `;
    this.showTooltip(targetEl, html);
  },

  showImageOnlyTooltip(targetEl, node) {
    this.currentTooltipTarget = null;
    let header = this.escapeHtml((node.text || '').toUpperCase());
    if (node.marker) {
      const def = this.MARKER_DEFS?.[node.marker];
      const mLabel = def ? def.label : node.marker;
      header = `<span style="display:inline-block;padding:1px 6px;background:var(--accent-blue,#2563eb);color:#fff;border-radius:4px;font-size:10px;font-weight:800;margin-right:6px;">${this.escapeHtml(mLabel)}</span>` + header;
    }
    let html = `
      <div class="mm-tooltip-header" style="font-weight:800;font-size:13px;letter-spacing:0.5px;color:var(--text-primary,#0f172a);">
        ${header}
      </div>
    `;
    if (node.ref) {
      html += `
        <div class="mm-tooltip-ref" style="margin-top:5px;font-size:11px;font-weight:700;color:var(--accent-blue,#2563eb);display:flex;align-items:center;gap:4px;">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
          <span>${this.escapeHtml(node.ref)}</span>
        </div>
      `;
    }
    if (node.note) {
      html += `
        <div class="mm-tooltip-body" style="margin-top:6px;font-size:11.5px;line-height:1.45;max-height:120px;overflow-y:auto;border-top:1px solid rgba(148,163,184,0.2);padding-top:5px;">
          ${this.escapeHtml(node.note)}
        </div>
      `;
    }
    const hintText = this.isReadOnly ? '' : 'Double-cliquer pour renommer';
    if (hintText) {
      html += `<div class="mm-tooltip-hint" style="margin-top:6px;">${hintText}</div>`;
    }
    this.showTooltip(targetEl, html);
  },

  // =========================================================================
  // SYNCHRONISATION & EXPORT
  // =========================================================================

  syncAndAutoSave(recordHistory = true) {
    if (this.isReadOnly) return;
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
    if (this.isReadOnly) return;
    if (!this.clipboardNode) return;
    const target = this.findNode(targetId) || this.tree;
    if (!target) return;

    // Recréer récursivement avec de nouveaux identifiants uniques
    const cloneTree = (orig, level) => {
      return {
        id: `node_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        text: orig.text,
        marker: orig.marker || null,
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
    if (this.isReadOnly) return;
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

  showNoteModalReadOnly(node) {
    if (!node || !node.note) return;
    document.getElementById('mm-note-view-modal')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'mm-note-view-modal';
    overlay.className = 'mm-prompt-overlay';
    overlay.innerHTML = `
      <div class="mm-prompt-dialog mm-note-view-dialog" style="width: 560px; max-width: 92vw;">
        <div class="mm-prompt-header">
          <div class="mm-prompt-header-left">
            <div class="mm-prompt-icon-badge">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            </div>
            <div class="mm-prompt-title">
              <span>Note de branche</span>
              <span class="mm-prompt-target-tag">${this.escapeHtml(node.text || '')}</span>
            </div>
          </div>
          <button type="button" class="mm-prompt-close-btn" id="mm-note-view-x-close" title="Fermer (Échap)">×</button>
        </div>

        <div class="mm-prompt-readonly-body">${this.escapeHtml(node.note || '')}</div>

        <div class="mm-prompt-actions-row" style="justify-content: flex-end;">
          <button type="button" class="btn-primary" id="mm-note-view-close">Fermer</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const closeDialog = () => {
      document.removeEventListener('keydown', handleKey);
      overlay.remove();
    };

    overlay.querySelector('#mm-note-view-x-close')?.addEventListener('click', closeDialog);
    overlay.querySelector('#mm-note-view-close')?.addEventListener('click', closeDialog);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeDialog();
    });

    const handleKey = (e) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault();
        closeDialog();
      }
    };
    document.addEventListener('keydown', handleKey);
  },

  promptTopicNote(nodeId) {
    const node = this.findNode(nodeId);
    if (!node) return;
    if (this.isReadOnly) {
      if (node.note) {
        this.showNoteModalReadOnly(node);
      }
      return;
    }

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
              <span class="mm-prompt-target-tag">${this.escapeHtml(node.text)}</span>
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
    if (this.isReadOnly) return;
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
              <span class="mm-prompt-target-tag">${this.escapeHtml(node.text)}</span>
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
    if (this.isReadOnly) return;
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

    const nodeText = isRoot ? (this.tree?.text || 'Sujet Central') : (node?.text || '');
    const topSuggestions = (typeof SvgIconsRegistry !== 'undefined' && nodeText)
      ? SvgIconsRegistry.suggestIconsForText(nodeText, 1)
      : [];
    const topSuggestion = topSuggestions[0] || null;

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
        <div class="mm-ctx-item" data-action="boundary">
          <span class="mm-ctx-icon">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="4" stroke-dasharray="4 3"/><path d="M7 8h10M7 12h6"/></svg>
          </span>
          <span class="mm-ctx-label">${this.boundaries?.some(b => b.rootId === targetNodeId) ? 'Modifier l\'enclos' : 'Créer un enclos'}</span>
          <span class="mm-ctx-shortcut">Ctrl+B</span>
        </div>
        <div class="mm-ctx-item" data-action="color">
          <span class="mm-ctx-icon">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>
          </span>
          <span class="mm-ctx-label">Changer la couleur</span>
        </div>
        <div class="mm-ctx-item" data-action="marker">
          <span class="mm-ctx-icon">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><text x="12" y="15.5" font-size="10" font-weight="800" text-anchor="middle" fill="currentColor" stroke="none">1</text></svg>
          </span>
          <span class="mm-ctx-label">Marqueur / Priorité...</span>
          <span class="mm-ctx-shortcut">1-9</span>
        </div>
        ${(topSuggestion && topSuggestion.id !== node?.icon) ? `
          <div class="mm-ctx-item mm-ctx-item-suggest" data-action="auto-suggest-icon" data-icon-id="${topSuggestion.id}" title="Appliquer instantanément l'icône suggérée pour « ${SvgIconsRegistry.escapeHtml(nodeText)} »">
            <span class="mm-ctx-icon">${SvgIconsRegistry.getSvg(topSuggestion.id, 15)}</span>
            <span class="mm-ctx-label">Suggéré : <strong>${SvgIconsRegistry.escapeHtml(topSuggestion.label)}</strong></span>
            <span class="mm-ctx-shortcut">1-clic</span>
          </div>
        ` : ''}
        <div class="mm-ctx-item" data-action="svg-icon">
          <span class="mm-ctx-icon">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M7 8h10"/></svg>
          </span>
          <span class="mm-ctx-label">${node?.icon ? 'Modifier l\'icône SVG' : 'Associer une icône SVG'}</span>
          <span class="mm-ctx-shortcut">I</span>
        </div>
        <div class="mm-ctx-item" data-action="ai-image">
          <span class="mm-ctx-icon">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
          </span>
          <span class="mm-ctx-label">${node?.image ? 'Modifier l\'illustration IA...' : 'Illustration IA (Flux)...'}</span>
        </div>
        ${node?.image ? `
          <div class="mm-ctx-item" data-action="image-crop">
            <span class="mm-ctx-icon">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/></svg>
            </span>
            <span class="mm-ctx-label">Recadrer & Zoomer...</span>
          </div>
          <div class="mm-ctx-item" data-action="image-mode-background">
            <span class="mm-ctx-icon">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="7" y1="12" x2="17" y2="12"/><line x1="12" y1="7" x2="12" y2="17"/></svg>
            </span>
            <span class="mm-ctx-label">Affichage : Fond avec texte</span>
            ${(node?.imageMode || 'background') === 'background' ? '<span class="mm-ctx-shortcut" style="display:inline-flex;align-items:center;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>' : ''}
          </div>
          <div class="mm-ctx-item" data-action="image-mode-image-only">
            <span class="mm-ctx-icon">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
            </span>
            <span class="mm-ctx-label">Affichage : Image seule (Buzan)</span>
            ${node?.imageMode === 'image-only' ? '<span class="mm-ctx-shortcut" style="display:inline-flex;align-items:center;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>' : ''}
          </div>
          <div class="mm-ctx-item" data-action="image-mode-top-image">
            <span class="mm-ctx-icon">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="13" x2="21" y2="13"/><line x1="7" y1="18" x2="17" y2="18"/></svg>
            </span>
            <span class="mm-ctx-label">Affichage : Vignette + Mot</span>
            ${node?.imageMode === 'top-image' ? '<span class="mm-ctx-shortcut" style="display:inline-flex;align-items:center;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>' : ''}
          </div>
          <div class="mm-ctx-divider"></div>
          <div class="mm-ctx-item" data-action="image-color-natural">
            <span class="mm-ctx-icon">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/></svg>
            </span>
            <span class="mm-ctx-label">Couleur : Naturelle</span>
            ${(!node?.imageColor || node?.imageColor === 'natural') ? '<span class="mm-ctx-shortcut" style="display:inline-flex;align-items:center;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>' : ''}
          </div>
          <div class="mm-ctx-item" data-action="image-color-bw">
            <span class="mm-ctx-icon">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 0 0 20z" fill="currentColor"/></svg>
            </span>
            <span class="mm-ctx-label">Couleur : Noir & Blanc</span>
            ${node?.imageColor === 'bw' ? '<span class="mm-ctx-shortcut" style="display:inline-flex;align-items:center;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>' : ''}
          </div>
          <div class="mm-ctx-item" data-action="image-color-tint">
            <span class="mm-ctx-icon">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="m19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2c.8.8 2 .8 2.8 0L19 11Z"/><circle cx="19" cy="19" r="3" fill="currentColor"/></svg>
            </span>
            <span class="mm-ctx-label">Couleur : Teinte de la pastille</span>
            ${node?.imageColor === 'tint' ? '<span class="mm-ctx-shortcut" style="display:inline-flex;align-items:center;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>' : ''}
          </div>
          ${node?.imageMode === 'image-only' ? `
            <div class="mm-ctx-divider"></div>
            <div style="font-size: 10px; font-weight: 700; color: var(--text-secondary); padding: 4px 12px; text-transform: uppercase;">Forme du médaillon</div>
            <div class="mm-ctx-item" data-action="image-shape-rounded">
              <span class="mm-ctx-icon"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/></svg></span>
              <span class="mm-ctx-label">Carré arrondi</span>
              ${(!node?.imageShape || node?.imageShape === 'rounded') ? '<span class="mm-ctx-shortcut" style="display:inline-flex;align-items:center;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>' : ''}
            </div>
            <div class="mm-ctx-item" data-action="image-shape-circle">
              <span class="mm-ctx-icon"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/></svg></span>
              <span class="mm-ctx-label">Cercle</span>
              ${node?.imageShape === 'circle' ? '<span class="mm-ctx-shortcut" style="display:inline-flex;align-items:center;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>' : ''}
            </div>
            <div class="mm-ctx-item" data-action="image-shape-pill">
              <span class="mm-ctx-icon"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="6"/></svg></span>
              <span class="mm-ctx-label">Capsule</span>
              ${node?.imageShape === 'pill' ? '<span class="mm-ctx-shortcut" style="display:inline-flex;align-items:center;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>' : ''}
            </div>
            <div style="font-size: 10px; font-weight: 700; color: var(--text-secondary); padding: 4px 12px; text-transform: uppercase;">Taille du médaillon</div>
            <div class="mm-ctx-item" data-action="image-size-48">
              <span class="mm-ctx-label">Compact (48 px)</span>
              ${node?.imageSize === 48 ? '<span class="mm-ctx-shortcut" style="display:inline-flex;align-items:center;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>' : ''}
            </div>
            <div class="mm-ctx-item" data-action="image-size-72">
              <span class="mm-ctx-label">Standard (72 px)</span>
              ${(!node?.imageSize || node?.imageSize === 72 || node?.imageSize === 68 || node?.imageSize === 56 || node?.imageSize === 52) ? '<span class="mm-ctx-shortcut" style="display:inline-flex;align-items:center;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>' : ''}
            </div>
            <div class="mm-ctx-item" data-action="image-size-96">
              <span class="mm-ctx-label">Grand (96 px)</span>
              ${node?.imageSize === 96 ? '<span class="mm-ctx-shortcut" style="display:inline-flex;align-items:center;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>' : ''}
            </div>
            <div class="mm-ctx-item" data-action="image-size-128">
              <span class="mm-ctx-label">Héroïque (128 px)</span>
              ${node?.imageSize === 128 ? '<span class="mm-ctx-shortcut" style="display:inline-flex;align-items:center;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>' : ''}
            </div>
          ` : ''}
          <div class="mm-ctx-divider"></div>
          <div class="mm-ctx-item danger" data-action="remove-image">
            <span class="mm-ctx-icon">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </span>
            <span class="mm-ctx-label">Supprimer l'illustration</span>
          </div>
        ` : ''}
        ${(node?.offsetX || node?.offsetY) ? `
          <div class="mm-ctx-item" data-action="reset-position">
            <span class="mm-ctx-icon">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/></svg>
            </span>
            <span class="mm-ctx-label">Réinitialiser la position</span>
          </div>
        ` : ''}
        ${!node?.isFloating ? `
          <div class="mm-ctx-item" data-action="detach-floating">
            <span class="mm-ctx-icon">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
            </span>
            <span class="mm-ctx-label">Détacher en sujet flottant</span>
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
        ${(topSuggestion && topSuggestion.id !== this.tree?.icon) ? `
          <div class="mm-ctx-item mm-ctx-item-suggest" data-action="auto-suggest-icon" data-icon-id="${topSuggestion.id}" title="Appliquer instantanément l'icône suggérée pour « ${SvgIconsRegistry.escapeHtml(nodeText)} »">
            <span class="mm-ctx-icon">${SvgIconsRegistry.getSvg(topSuggestion.id, 15)}</span>
            <span class="mm-ctx-label">Suggéré : <strong>${SvgIconsRegistry.escapeHtml(topSuggestion.label)}</strong></span>
            <span class="mm-ctx-shortcut">1-clic</span>
          </div>
        ` : ''}
        <div class="mm-ctx-item" data-action="svg-icon">
          <span class="mm-ctx-icon">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M7 8h10"/></svg>
          </span>
          <span class="mm-ctx-label">${this.tree?.icon ? 'Modifier l\'icône SVG' : 'Associer une icône SVG'}</span>
          <span class="mm-ctx-shortcut">I</span>
        </div>
        <div class="mm-ctx-item" data-action="ai-image">
          <span class="mm-ctx-icon">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
          </span>
          <span class="mm-ctx-label">${this.tree?.image ? 'Modifier l\'illustration IA...' : 'Illustration IA (Flux)...'}</span>
        </div>
        ${this.tree?.image ? `
          <div class="mm-ctx-item" data-action="image-crop">
            <span class="mm-ctx-icon">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/></svg>
            </span>
            <span class="mm-ctx-label">Recadrer & Zoomer...</span>
          </div>
          <div class="mm-ctx-item" data-action="image-mode-background">
            <span class="mm-ctx-icon">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="7" y1="12" x2="17" y2="12"/><line x1="12" y1="7" x2="12" y2="17"/></svg>
            </span>
            <span class="mm-ctx-label">Affichage : Fond avec texte</span>
            ${(this.tree?.imageMode || 'background') === 'background' ? '<span class="mm-ctx-shortcut" style="display:inline-flex;align-items:center;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>' : ''}
          </div>
          <div class="mm-ctx-item" data-action="image-mode-image-only">
            <span class="mm-ctx-icon">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
            </span>
            <span class="mm-ctx-label">Affichage : Image seule (Buzan)</span>
            ${this.tree?.imageMode === 'image-only' ? '<span class="mm-ctx-shortcut" style="display:inline-flex;align-items:center;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>' : ''}
          </div>
          <div class="mm-ctx-divider"></div>
          <div class="mm-ctx-item" data-action="image-color-natural">
            <span class="mm-ctx-icon">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/></svg>
            </span>
            <span class="mm-ctx-label">Couleur : Naturelle</span>
            ${(!this.tree?.imageColor || this.tree?.imageColor === 'natural') ? '<span class="mm-ctx-shortcut" style="display:inline-flex;align-items:center;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>' : ''}
          </div>
          <div class="mm-ctx-item" data-action="image-color-bw">
            <span class="mm-ctx-icon">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 0 0 20z" fill="currentColor"/></svg>
            </span>
            <span class="mm-ctx-label">Couleur : Noir & Blanc</span>
            ${this.tree?.imageColor === 'bw' ? '<span class="mm-ctx-shortcut" style="display:inline-flex;align-items:center;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>' : ''}
          </div>
          <div class="mm-ctx-item" data-action="image-color-tint">
            <span class="mm-ctx-icon">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="m19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2c.8.8 2 .8 2.8 0L19 11Z"/><circle cx="19" cy="19" r="3" fill="currentColor"/></svg>
            </span>
            <span class="mm-ctx-label">Couleur : Dégradé central</span>
            ${this.tree?.imageColor === 'tint' ? '<span class="mm-ctx-shortcut" style="display:inline-flex;align-items:center;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>' : ''}
          </div>
          ${this.tree?.imageMode === 'image-only' ? `
            <div class="mm-ctx-divider"></div>
            <div style="font-size: 10px; font-weight: 700; color: var(--text-secondary); padding: 4px 12px; text-transform: uppercase;">Forme du médaillon central</div>
            <div class="mm-ctx-item" data-action="image-shape-circle">
              <span class="mm-ctx-icon"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/></svg></span>
              <span class="mm-ctx-label">Cercle classique</span>
              ${(!this.tree?.imageShape || this.tree?.imageShape === 'circle') ? '<span class="mm-ctx-shortcut" style="display:inline-flex;align-items:center;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>' : ''}
            </div>
            <div class="mm-ctx-item" data-action="image-shape-rounded">
              <span class="mm-ctx-icon"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/></svg></span>
              <span class="mm-ctx-label">Carré arrondi</span>
              ${this.tree?.imageShape === 'rounded' ? '<span class="mm-ctx-shortcut" style="display:inline-flex;align-items:center;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>' : ''}
            </div>
            <div class="mm-ctx-item" data-action="image-shape-pill">
              <span class="mm-ctx-icon"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="6"/></svg></span>
              <span class="mm-ctx-label">Capsule</span>
              ${this.tree?.imageShape === 'pill' ? '<span class="mm-ctx-shortcut" style="display:inline-flex;align-items:center;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>' : ''}
            </div>
            <div style="font-size: 10px; font-weight: 700; color: var(--text-secondary); padding: 4px 12px; text-transform: uppercase;">Taille du médaillon central</div>
            <div class="mm-ctx-item" data-action="image-size-80">
              <span class="mm-ctx-label">Compact (80 px)</span>
              ${this.tree?.imageSize === 80 ? '<span class="mm-ctx-shortcut" style="display:inline-flex;align-items:center;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>' : ''}
            </div>
            <div class="mm-ctx-item" data-action="image-size-104">
              <span class="mm-ctx-label">Standard (104 px)</span>
              ${(!this.tree?.imageSize || this.tree?.imageSize === 104) ? '<span class="mm-ctx-shortcut" style="display:inline-flex;align-items:center;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>' : ''}
            </div>
            <div class="mm-ctx-item" data-action="image-size-130">
              <span class="mm-ctx-label">Grand (130 px)</span>
              ${this.tree?.imageSize === 130 ? '<span class="mm-ctx-shortcut" style="display:inline-flex;align-items:center;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>' : ''}
            </div>
            <div class="mm-ctx-item" data-action="image-size-160">
              <span class="mm-ctx-label">Héroïque (160 px)</span>
              ${this.tree?.imageSize === 160 ? '<span class="mm-ctx-shortcut" style="display:inline-flex;align-items:center;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>' : ''}
            </div>
          ` : ''}
          <div class="mm-ctx-divider"></div>
          <div class="mm-ctx-item danger" data-action="remove-image">
            <span class="mm-ctx-icon">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </span>
            <span class="mm-ctx-label">Supprimer l'illustration</span>
          </div>
        ` : ''}
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
          ${this.treeStructure === 'radiant' ? '<span class="mm-ctx-shortcut" style="display:inline-flex;align-items:center;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>' : ''}
        </div>
        <div class="mm-ctx-item" data-action="structure-right-tree">
          <span class="mm-ctx-icon">${this.STRUCTURE_ICONS['right-tree']}</span>
          <span class="mm-ctx-label">Arbre logique à droite</span>
          ${this.treeStructure === 'right-tree' ? '<span class="mm-ctx-shortcut" style="display:inline-flex;align-items:center;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>' : ''}
        </div>
        <div class="mm-ctx-item" data-action="structure-top-down">
          <span class="mm-ctx-icon">${this.STRUCTURE_ICONS['top-down']}</span>
          <span class="mm-ctx-label">Organigramme descendant</span>
          ${this.treeStructure === 'top-down' ? '<span class="mm-ctx-shortcut" style="display:inline-flex;align-items:center;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>' : ''}
        </div>
        <div class="mm-ctx-divider"></div>
        <div class="mm-ctx-item" data-action="palette">
          <span class="mm-ctx-icon">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>
          </span>
          <span class="mm-ctx-label">Changer la palette de couleurs</span>
        </div>
        <div class="mm-ctx-divider"></div>
        <div class="mm-ctx-item" data-action="reorganize">
          <span class="mm-ctx-icon">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>
          </span>
          <span class="mm-ctx-label">Réorganiser harmonieusement</span>
          <span class="mm-ctx-shortcut">Alt+R</span>
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
        <div class="mm-ctx-item" data-action="add-floating">
          <span class="mm-ctx-icon">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="6" width="18" height="12" rx="6"/><line x1="12" y1="9" x2="12" y2="15"/><line x1="9" y1="12" x2="15" y2="12"/></svg>
          </span>
          <span class="mm-ctx-label">Nouveau sujet flottant</span>
          <span class="mm-ctx-shortcut">Alt+F</span>
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
          ${this.treeStructure === 'radiant' ? '<span class="mm-ctx-shortcut" style="display:inline-flex;align-items:center;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>' : ''}
        </div>
        <div class="mm-ctx-item" data-action="structure-right-tree">
          <span class="mm-ctx-icon">${this.STRUCTURE_ICONS['right-tree']}</span>
          <span class="mm-ctx-label">Arbre logique à droite</span>
          ${this.treeStructure === 'right-tree' ? '<span class="mm-ctx-shortcut" style="display:inline-flex;align-items:center;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>' : ''}
        </div>
        <div class="mm-ctx-item" data-action="structure-top-down">
          <span class="mm-ctx-icon">${this.STRUCTURE_ICONS['top-down']}</span>
          <span class="mm-ctx-label">Organigramme descendant</span>
          ${this.treeStructure === 'top-down' ? '<span class="mm-ctx-shortcut" style="display:inline-flex;align-items:center;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>' : ''}
        </div>
        <div class="mm-ctx-item" data-action="open-styles">
          <span class="mm-ctx-icon">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19h16"/><circle cx="7" cy="12" r="3"/><path d="M10 12h5"/><rect x="15" y="9" width="6" height="6" rx="1.5"/></svg>
          </span>
          <span class="mm-ctx-label">Styles & Connecteurs...</span>
          <span class="mm-ctx-shortcut">Alt+T</span>
        </div>
        <div class="mm-ctx-divider"></div>
        <div class="mm-ctx-item" data-action="reorganize">
          <span class="mm-ctx-icon">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>
          </span>
          <span class="mm-ctx-label">Réorganiser harmonieusement</span>
          <span class="mm-ctx-shortcut">Alt+R</span>
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
        <div class="mm-ctx-item" data-action="markdown-guide">
          <span class="mm-ctx-icon">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          </span>
          <span class="mm-ctx-label">Guide Spécification Markdown...</span>
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
          case 'open-styles':
            this.toggleStylesPopover(true);
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
          case 'add-floating': {
            const rect = this.svg?.getBoundingClientRect() || { left: 0, top: 0, width: 800, height: 600 };
            const mouseSvgX = (clientX - rect.left - this.viewBox.x) / this.viewBox.scale;
            const mouseSvgY = (clientY - rect.top - this.viewBox.y) / this.viewBox.scale;
            this.createFloatingTopic(mouseSvgX, mouseSvgY);
            break;
          }
          case 'detach-floating':
            if (targetNodeId) this.detachAsFloatingTopic(targetNodeId);
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
          case 'boundary':
            if (targetNodeId) {
              const bnd = this.boundaries?.find(b => b.rootId === targetNodeId);
              if (bnd) {
                this.promptEditBoundaryLabel(bnd.id);
              } else {
                this.createBoundary(targetNodeId);
              }
            }
            break;
          case 'color':
            if (targetNodeId) this.promptChangeColor(targetNodeId);
            break;
          case 'marker':
            if (targetNodeId && targetNodeId !== 'root') {
              this.selectNode(targetNodeId);
              this.toggleMarkerPopover(true);
            }
            break;
          case 'svg-icon':
            if (targetNodeId) {
              this.openIconPicker(targetNodeId, clientX, clientY);
            }
            break;
          case 'ai-image':
            if (targetNodeId) {
              this.openImageGenModal(targetNodeId);
            }
            break;
          case 'image-crop':
            if (targetNodeId) {
              this.openImageGenModal(targetNodeId);
            }
            break;
          case 'image-mode-background':
            if (targetNodeId) {
              this.setNodeImageMode(targetNodeId, 'background');
            }
            break;
          case 'image-mode-image-only':
            if (targetNodeId) {
              this.setNodeImageMode(targetNodeId, 'image-only');
            }
            break;
          case 'image-mode-top-image':
            if (targetNodeId) {
              this.setNodeImageMode(targetNodeId, 'top-image');
            }
            break;
          case 'image-color-natural':
            if (targetNodeId) {
              this.setNodeImageColor(targetNodeId, 'natural');
            }
            break;
          case 'image-color-bw':
            if (targetNodeId) {
              this.setNodeImageColor(targetNodeId, 'bw');
            }
            break;
          case 'image-color-tint':
            if (targetNodeId) {
              this.setNodeImageColor(targetNodeId, 'tint');
            }
            break;
          case 'image-shape-rounded':
          case 'image-shape-circle':
          case 'image-shape-pill':
          case 'image-shape-square':
            if (targetNodeId) {
              const shape = action.replace('image-shape-', '');
              this.setNodeImageShape(targetNodeId, shape);
            }
            break;
          case 'image-size-48':
          case 'image-size-72':
          case 'image-size-80':
          case 'image-size-96':
          case 'image-size-104':
          case 'image-size-128':
          case 'image-size-130':
          case 'image-size-160':
            if (targetNodeId) {
              const size = parseInt(action.replace('image-size-', ''), 10);
              this.setNodeImageSize(targetNodeId, size);
            }
            break;
          case 'remove-image':
            if (targetNodeId) {
              this.removeNodeImage(targetNodeId);
            }
            break;
          case 'auto-suggest-icon': {
            const iconId = item.getAttribute('data-icon-id');
            if (targetNodeId && iconId) {
              this.setNodeIcon(targetNodeId, iconId);
            }
            break;
          }
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
          case 'reorganize':
            this.autoReorganize();
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
      dockBtn.innerHTML = (this.STRUCTURE_ICONS[struct] || this.STRUCTURE_ICONS.radiant) + '<span class="mm-dock-label">Structure</span>';
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

  setConnectorStyle(styleName) {
    if (!['curve', 'orthogonal', 'straight'].includes(styleName)) return;
    this.connectorStyle = styleName;
    if (this.viewMode === 'map') {
      this.draw();
    }
    this.updateStylesUI();
    this.syncAndAutoSave();
  },

  setNodeShape(shapeName) {
    if (!['underline', 'rounded-rect', 'pill'].includes(shapeName)) return;
    this.nodeShape = shapeName;
    this.layoutTree();
    if (this.viewMode === 'map') {
      this.draw();
    }
    this.updateStylesUI();
    this.syncAndAutoSave();
  },

  toggleStylesPopover(force = null) {
    const popover = document.getElementById('mm-styles-popover');
    if (!popover) return;
    const isHidden = popover.classList.contains('hidden');
    const shouldOpen = force !== null ? force : isHidden;
    popover.classList.toggle('hidden', !shouldOpen);
    if (shouldOpen) {
      // Fermer les autres popovers pour éviter les superpositions
      document.getElementById('mm-structure-popover')?.classList.add('hidden');
      document.getElementById('mindmap-help-drawer')?.classList.add('hidden');
      this.updateStylesUI();
    }
  },

  updateStylesUI() {
    const conn = this.connectorStyle || 'curve';
    const shape = this.nodeShape || 'underline';

    const popover = document.getElementById('mm-styles-popover');
    if (popover) {
      popover.querySelectorAll('[data-style-type="connector"]').forEach(card => {
        const isActive = card.getAttribute('data-value') === conn;
        card.classList.toggle('active', isActive);
        const check = card.querySelector('.mm-style-check');
        if (check) check.classList.toggle('hidden', !isActive);
      });
      popover.querySelectorAll('[data-style-type="shape"]').forEach(card => {
        const isActive = card.getAttribute('data-value') === shape;
        card.classList.toggle('active', isActive);
        const check = card.querySelector('.mm-style-check');
        if (check) check.classList.toggle('hidden', !isActive);
      });
    }
  },

  setNodeMarker(nodeId, marker) {
    if (this.isReadOnly) return;
    if (!nodeId || nodeId === 'root') return;
    const node = this.findNode(nodeId);
    if (!node) return;
    const cleanMarker = marker ? String(marker).trim().toLowerCase() : null;
    node.marker = cleanMarker;
    this.layoutTree();
    this.draw();
    this.syncAndAutoSave();
    if (this.viewMode === 'outline') {
      this.renderOutlineView();
    }
    this.updateMarkerPopoverUI();
    if (typeof App !== 'undefined' && App.showToast) {
      if (cleanMarker && this.MARKER_DEFS[cleanMarker]) {
        App.showToast(`Marqueur ${this.MARKER_DEFS[cleanMarker].label} appliqué`);
      } else {
        App.showToast('Marqueur effacé');
      }
    }
  },

  cycleNodeMarker(nodeId) {
    if (this.isReadOnly) return;
    if (!nodeId || nodeId === 'root') return;
    const node = this.findNode(nodeId);
    if (!node) return;
    const cycleOrder = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'p1', 'p2', 'p3', 'p4', 'done', 'progress', 'star', 'alert', null];
    const currentMarker = node.marker ? String(node.marker).toLowerCase() : null;
    const idx = cycleOrder.indexOf(currentMarker);
    const nextMarker = idx === -1 ? '1' : cycleOrder[(idx + 1) % cycleOrder.length];
    this.setNodeMarker(nodeId, nextMarker);
  },

  toggleMarkerPopover(force = null) {
    if (this.isReadOnly) return;
    if (typeof document === 'undefined' || typeof document.getElementById !== 'function') return;
    const popover = document.getElementById('mm-marker-popover');
    if (!popover) return;
    const isHidden = popover.classList.contains('hidden');
    const shouldOpen = force !== null ? force : isHidden;
    popover.classList.toggle('hidden', !shouldOpen);
    if (shouldOpen) {
      document.getElementById('mm-structure-popover')?.classList.add('hidden');
      document.getElementById('mm-styles-popover')?.classList.add('hidden');
      document.getElementById('mindmap-help-drawer')?.classList.add('hidden');
      this.updateMarkerPopoverUI();
    }
  },

  updateMarkerPopoverUI() {
    if (typeof document === 'undefined' || typeof document.getElementById !== 'function') return;
    const popover = document.getElementById('mm-marker-popover');
    if (!popover || popover.classList.contains('hidden')) return;
    const node = this.selectedNodeId ? this.findNode(this.selectedNodeId) : null;
    const currentMarker = node ? (node.marker || null) : null;
    popover.querySelectorAll('.mm-marker-choice').forEach(choice => {
      const val = choice.getAttribute('data-marker');
      choice.classList.toggle('active', val === currentMarker);
    });
  },

  renderOutlineMarkerPill(node) {
    if (!node || !node.marker) return '';
    const def = this.MARKER_DEFS[node.marker];
    if (!def) return '';
    return `
      <span class="mm-outline-marker-badge ${def.isWide ? 'wide' : ''}" style="background-color: ${def.bg}; color: ${def.text};" data-id="${node.id}" title="Marqueur : ${def.label} (Cliquer pour changer)">
        ${def.label}
      </span>
    `;
  },

  renderOutlineIconPill(node) {
    if (!node || !node.icon || typeof SvgIconsRegistry === 'undefined') return '';
    const def = SvgIconsRegistry.get(node.icon);
    if (!def) return '';
    return `
      <span class="mm-outline-icon-badge" data-id="${node.id}" title="Icône SVG : ${def.label} (Cliquer pour changer ou [I])">
        ${SvgIconsRegistry.getSvg(node.icon, 14)}
      </span>
    `;
  },

  openIconPicker(nodeId, fallbackX = null, fallbackY = null) {
    if (this.isReadOnly) return;
    if (!nodeId) return;
    const node = this.findNode(nodeId);
    if (!node) return;

    let anchorRect = null;
    const nodeEl = document.querySelector(`.mm-node-g[data-id="${nodeId}"]`);
    if (nodeEl) {
      const r = nodeEl.getBoundingClientRect();
      if (r && (r.width > 0 || r.height > 0)) {
        anchorRect = r;
      }
    }
    if (!anchorRect) {
      const outlineEl = document.querySelector(`.mm-outline-item[data-id="${nodeId}"], [data-node-id="${nodeId}"]`);
      if (outlineEl) {
        const r = outlineEl.getBoundingClientRect();
        if (r && (r.width > 0 || r.height > 0)) {
          anchorRect = r;
        }
      }
    }
    if (!anchorRect && fallbackX !== null && fallbackY !== null) {
      anchorRect = {
        left: fallbackX,
        top: fallbackY,
        width: 0,
        height: 0,
        right: fallbackX,
        bottom: fallbackY
      };
    }

    if (typeof SvgIconsRegistry !== 'undefined') {
      SvgIconsRegistry.openPicker({
        anchorRect: anchorRect,
        title: `Icône SVG : ${node.text || 'Nœud'}`,
        currentText: node.text || '',
        currentValue: node.icon || null,
        onSelect: (iconId) => {
          this.setNodeIcon(nodeId, iconId);
        },
        onRemove: () => {
          this.setNodeIcon(nodeId, null);
        }
      });
    }
  },

  setNodeIcon(nodeId, iconId) {
    if (this.isReadOnly) return;
    if (!nodeId) return;
    const node = this.findNode(nodeId);
    if (!node) return;

    const cleanIcon = iconId ? String(iconId).trim().toLowerCase() : null;
    node.icon = cleanIcon;
    if (nodeId === 'root' && this.currentNote) {
      this.currentNote.rootIcon = cleanIcon;
    }
    this.layoutTree();
    this.draw();
    this.syncAndAutoSave();
    if (this.viewMode === 'outline') {
      this.renderOutlineView();
    }
    if (typeof App !== 'undefined' && App.showToast) {
      if (cleanIcon && typeof SvgIconsRegistry !== 'undefined' && SvgIconsRegistry.get(cleanIcon)) {
        App.showToast(`Icône SVG « ${SvgIconsRegistry.get(cleanIcon).label} » appliquée`);
      } else {
        App.showToast('Icône SVG retirée');
      }
    }
  },

  // =========================================================================
  // ILLUSTRATIONS IA EN FOND DE PASTILLE (INFOMANIAK FLUX)
  // =========================================================================

  resolveNodeImageDataUrl(node) {
    if (!node || !node.image || node._loadingImage || node.imageDataUrl) return;
    if (node.image.startsWith('data:') || node.image.startsWith('http')) {
      node.imageDataUrl = node.image;
      return;
    }
    node._loadingImage = true;
    if (window.pywebview && window.pywebview.api && window.pywebview.api.load_mindmap_image_data_url) {
      window.pywebview.api.load_mindmap_image_data_url(node.image).then(res => {
        node._loadingImage = false;
        if (res && res.success && res.dataUrl) {
          node.imageDataUrl = res.dataUrl;
          this.draw();
        }
      }).catch(err => {
        node._loadingImage = false;
        console.warn('Erreur chargement image mindmap:', err);
      });
    }
  },

  setNodeImageMode(nodeId, mode) {
    if (this.isReadOnly || !nodeId) return;
    const isRoot = (nodeId === 'root');
    const node = this.findNode(nodeId);
    if (!node) return;
    node.imageMode = mode;
    if (isRoot && this.currentNote) {
      this.currentNote.rootImageMode = mode;
    }
    this.layoutTree();
    this.draw();
    this.syncAndAutoSave();
    const modeLabels = {
      'background': 'Fond avec texte',
      'image-only': 'Image seule (Buzan)',
      'top-image': 'Vignette + Mot'
    };
    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast(`Affichage : ${modeLabels[mode] || mode}`);
    }
  },

  setNodeImageColor(nodeId, color) {
    if (this.isReadOnly || !nodeId) return;
    const isRoot = (nodeId === 'root');
    const node = this.findNode(nodeId);
    if (!node) return;
    node.imageColor = color;
    if (isRoot && this.currentNote) {
      this.currentNote.rootImageColor = color;
    }
    this.draw();
    this.syncAndAutoSave();
    const colorLabels = {
      'natural': 'Couleur naturelle',
      'bw': 'Noir & Blanc artistique',
      'tint': isRoot ? 'Dégradé central' : 'Teinte de la pastille'
    };
    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast(`Harmonie visuelle : ${colorLabels[color] || color}`);
    }
  },

  setNodeImageShape(nodeId, shape) {
    if (this.isReadOnly || !nodeId) return;
    const isRoot = (nodeId === 'root');
    const node = this.findNode(nodeId);
    if (!node) return;
    node.imageShape = shape;
    if (isRoot && this.currentNote) {
      this.currentNote.rootImageShape = shape;
    }
    this.draw();
    this.syncAndAutoSave();
    const shapeLabels = {
      'rounded': 'Carré arrondi',
      'circle': 'Cercle parfait',
      'pill': 'Capsule',
      'square': 'Carré'
    };
    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast(`Forme du médaillon : ${shapeLabels[shape] || shape}`);
    }
  },

  setNodeImageSize(nodeId, size) {
    if (this.isReadOnly || !nodeId) return;
    const isRoot = (nodeId === 'root');
    const node = this.findNode(nodeId);
    if (!node) return;
    const s = parseInt(size);
    if (isNaN(s) || s < 36 || s > 260) return;
    node.imageSize = s;
    if (isRoot && this.currentNote) {
      this.currentNote.rootImageSize = s;
    }
    this.layoutTree();
    this.draw();
    this.syncAndAutoSave();
    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast(`Taille du médaillon : ${s} px`);
    }
  },

  setNodeImageCrop(nodeId, zoom, panX, panY) {
    if (this.isReadOnly || !nodeId) return;
    const isRoot = (nodeId === 'root');
    const node = this.findNode(nodeId);
    if (!node) return;
    node.imageZoom = typeof zoom === 'number' ? zoom : 1.0;
    node.imagePanX = typeof panX === 'number' ? panX : 0;
    node.imagePanY = typeof panY === 'number' ? panY : 0;
    if (isRoot && this.currentNote) {
      this.currentNote.rootImageZoom = node.imageZoom;
      this.currentNote.rootImagePanX = node.imagePanX;
      this.currentNote.rootImagePanY = node.imagePanY;
    }
    this.draw();
    this.syncAndAutoSave();
  },

  removeNodeImage(nodeId) {
    if (this.isReadOnly || !nodeId) return;
    const node = this.findNode(nodeId);
    if (!node) return;
    delete node.image;
    delete node.imageDataUrl;
    delete node.imageMode;
    delete node.imageZoom;
    delete node.imagePanX;
    delete node.imagePanY;
    delete node.imageColor;
    delete node.imageShape;
    delete node.imageSize;
    if (nodeId === 'root' && this.currentNote) {
      delete this.currentNote.rootImage;
      delete this.currentNote.rootImageMode;
      delete this.currentNote.rootImageZoom;
      delete this.currentNote.rootImagePanX;
      delete this.currentNote.rootImagePanY;
      delete this.currentNote.rootImageColor;
      delete this.currentNote.rootImageShape;
      delete this.currentNote.rootImageSize;
    }
    this.layoutTree();
    this.draw();
    this.syncAndAutoSave();
    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast('Illustration retirée de la pastille');
    }
  },

  async openImageGenModal(nodeId) {
    if (this.isReadOnly || !nodeId) return;
    const node = this.findNode(nodeId);
    if (!node) return;

    if (node.image && !node.imageDataUrl && !(node.image.startsWith('data:') || node.image.startsWith('http'))) {
      if (window.pywebview && window.pywebview.api && window.pywebview.api.load_mindmap_image_data_url) {
        try {
          const res = await window.pywebview.api.load_mindmap_image_data_url(node.image);
          if (res && res.success && res.dataUrl) {
            node.imageDataUrl = res.dataUrl;
          }
        } catch (e) {
          console.warn('Erreur chargement image modale:', e);
        }
      }
    }

    // Supprimer une modale existante
    document.getElementById('mm-image-gen-overlay')?.remove();

    const isRoot = (nodeId === 'root');
    const nodeText = isRoot ? (this.tree?.text || 'Concept Central') : (node.text || 'Branche');
    const currentImg = node.imageDataUrl || (node.image && (node.image.startsWith('data:') || node.image.startsWith('http')) ? node.image : null);

    const styles = [
      { id: 'biblical_oil', label: 'Peinture d\'Histoire' },
      { id: 'cinematic', label: 'Cinématique Dramatique' },
      { id: 'golden_engraving', label: 'Gravure & Dorures' },
      { id: 'watercolor', label: 'Aquarelle & Lumière' },
      { id: 'minimal_modern', label: 'Symbole Épuré' }
    ];
    let selectedStyle = 'biblical_oil';
    let selectedMode = node.imageMode || 'background';
    let selectedColor = node.imageColor || 'natural';
    let selectedShape = node.imageShape || (isRoot ? 'circle' : 'rounded');
    let selectedSize = (typeof node.imageSize === 'number' && node.imageSize >= 36) ? node.imageSize : (isRoot ? 104 : (node.level === 1 ? 72 : (node.level === 2 ? 52 : 48)));
    const sizePresets = isRoot ? [
      { label: 'Compact', size: 80 },
      { label: 'Standard', size: 104 },
      { label: 'Grand', size: 130 },
      { label: 'Héroïque', size: 160 }
    ] : [
      { label: 'Compact', size: 48 },
      { label: 'Standard', size: 72 },
      { label: 'Grand', size: 96 },
      { label: 'Héroïque', size: 128 }
    ];
    let selectedZoom = (typeof node.imageZoom === 'number' && node.imageZoom >= 0.5) ? node.imageZoom : 1.0;
    let selectedPanX = typeof node.imagePanX === 'number' ? node.imagePanX : 0;
    let selectedPanY = typeof node.imagePanY === 'number' ? node.imagePanY : 0;
    let generatedImageResult = null;
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let startPanX = 0;
    let startPanY = 0;

    const overlay = document.createElement('div');
    overlay.id = 'mm-image-gen-overlay';
    overlay.className = 'mm-prompt-overlay';
    overlay.innerHTML = `
      <div class="mm-prompt-dialog mm-image-modal" style="width: 540px; max-width: 95vw;">
        <div class="mm-prompt-header">
          <div class="mm-prompt-header-left">
            <div class="mm-prompt-icon-badge" style="background: rgba(234, 88, 12, 0.15); color: #ea580c;">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
            </div>
            <div class="mm-prompt-title">
              <span>Illustration IA & Disposition Visuelle</span>
              <span class="mm-prompt-target-tag" style="background: rgba(234, 88, 12, 0.12); color: #ea580c; border-color: rgba(234, 88, 12, 0.3);">${this.escapeHtml(nodeText)}</span>
            </div>
          </div>
          <button type="button" class="mm-prompt-close-btn" id="mm-img-x-close" title="Fermer (Échap)">×</button>
        </div>

        <p class="mm-prompt-desc" style="margin-bottom: 8px; font-size: 12px; line-height: 1.5;">
          Générez une illustration avec <strong>Infomaniak Flux (Flux Schnell)</strong> et ajustez son cadrage selon les lois de Buzan.
        </p>

        <!-- Sélecteur de style artistique -->
        <div class="mm-img-styles-row" style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px;">
          ${styles.map((s, idx) => `
            <button type="button" class="mm-img-style-pill ${idx === 0 ? 'active' : ''}" data-style="${s.id}" style="padding: 4px 10px; font-size: 11px; font-weight: 600; border-radius: 20px; border: 1px solid ${idx === 0 ? 'var(--accent-blue, #2563eb)' : 'var(--border-color, #cbd5e1)'}; background: ${idx === 0 ? 'var(--accent-blue, #2563eb)' : 'var(--bg-secondary, #f1f5f9)'}; color: ${idx === 0 ? '#ffffff' : 'var(--text-primary)'}; cursor: pointer; transition: all 0.15s ease;">
              ${this.escapeHtml(s.label)}
            </button>
          `).join('')}
        </div>

        <!-- Sélecteur de mode d'affichage visuel (Lois de Buzan) -->
        <div style="margin-bottom: 8px;">
          <label style="font-size: 10.5px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 4px;">
            Disposition visuelle (Lois de Buzan)
          </label>
          <div class="mm-img-modes-row" style="display: flex; gap: 6px;">
            <button type="button" class="mm-img-mode-pill ${selectedMode === 'background' ? 'active' : ''}" data-mode="background" style="flex: 1; padding: 6px 8px; font-size: 11px; font-weight: 600; border-radius: 8px; border: 1px solid ${selectedMode === 'background' ? 'var(--accent-blue, #2563eb)' : 'var(--border-color, #cbd5e1)'}; background: ${selectedMode === 'background' ? 'var(--accent-blue, #2563eb)' : 'var(--bg-secondary, #f1f5f9)'}; color: ${selectedMode === 'background' ? '#ffffff' : 'var(--text-primary)'}; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 5px; transition: all 0.15s ease;">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="7" y1="12" x2="17" y2="12"/><line x1="12" y1="7" x2="12" y2="17"/></svg>
              <span>Fond + Texte</span>
            </button>
            <button type="button" class="mm-img-mode-pill ${selectedMode === 'image-only' ? 'active' : ''}" data-mode="image-only" style="flex: 1; padding: 6px 8px; font-size: 11px; font-weight: 600; border-radius: 8px; border: 1px solid ${selectedMode === 'image-only' ? 'var(--accent-blue, #2563eb)' : 'var(--border-color, #cbd5e1)'}; background: ${selectedMode === 'image-only' ? 'var(--accent-blue, #2563eb)' : 'var(--bg-secondary, #f1f5f9)'}; color: ${selectedMode === 'image-only' ? '#ffffff' : 'var(--text-primary)'}; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 5px; transition: all 0.15s ease;">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
              <span>Image seule</span>
            </button>
            ${!isRoot ? `
            <button type="button" class="mm-img-mode-pill ${selectedMode === 'top-image' ? 'active' : ''}" data-mode="top-image" style="flex: 1; padding: 6px 8px; font-size: 11px; font-weight: 600; border-radius: 8px; border: 1px solid ${selectedMode === 'top-image' ? 'var(--accent-blue, #2563eb)' : 'var(--border-color, #cbd5e1)'}; background: ${selectedMode === 'top-image' ? 'var(--accent-blue, #2563eb)' : 'var(--bg-secondary, #f1f5f9)'}; color: ${selectedMode === 'top-image' ? '#ffffff' : 'var(--text-primary)'}; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 5px; transition: all 0.15s ease;">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="13" x2="21" y2="13"/><line x1="7" y1="18" x2="17" y2="18"/></svg>
              <span>Vignette + Mot</span>
            </button>
            ` : ''}
          </div>
        </div>

        <!-- Personnalisation Forme & Taille du médaillon (affiché en mode Image seule) -->
        <div id="mm-img-only-customization" style="display: ${selectedMode === 'image-only' ? 'block' : 'none'}; margin-bottom: 8px; padding: 8px 10px; background: rgba(0,0,0,0.16); border-radius: 8px; border: 1px solid var(--border-color, rgba(255,255,255,0.08));">
          <!-- Forme du médaillon -->
          <div style="margin-bottom: 8px;">
            <label style="font-size: 10px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 4px;">
              Forme du médaillon
            </label>
            <div class="mm-img-shapes-row" style="display: flex; gap: 6px;">
              <button type="button" class="mm-img-shape-pill ${selectedShape === 'rounded' ? 'active' : ''}" data-shape="rounded" style="flex: 1; padding: 5px 8px; font-size: 11px; font-weight: 600; border-radius: 8px; border: 1px solid ${selectedShape === 'rounded' ? 'var(--accent-blue, #2563eb)' : 'var(--border-color, #cbd5e1)'}; background: ${selectedShape === 'rounded' ? 'var(--accent-blue, #2563eb)' : 'var(--bg-secondary, #f1f5f9)'}; color: ${selectedShape === 'rounded' ? '#ffffff' : 'var(--text-primary)'}; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 5px; transition: all 0.15s ease;">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/></svg>
                <span>Carré arrondi</span>
              </button>
              <button type="button" class="mm-img-shape-pill ${selectedShape === 'circle' ? 'active' : ''}" data-shape="circle" style="flex: 1; padding: 5px 8px; font-size: 11px; font-weight: 600; border-radius: 8px; border: 1px solid ${selectedShape === 'circle' ? 'var(--accent-blue, #2563eb)' : 'var(--border-color, #cbd5e1)'}; background: ${selectedShape === 'circle' ? 'var(--accent-blue, #2563eb)' : 'var(--bg-secondary, #f1f5f9)'}; color: ${selectedShape === 'circle' ? '#ffffff' : 'var(--text-primary)'}; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 5px; transition: all 0.15s ease;">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/></svg>
                <span>Cercle</span>
              </button>
              <button type="button" class="mm-img-shape-pill ${selectedShape === 'pill' ? 'active' : ''}" data-shape="pill" style="flex: 1; padding: 5px 8px; font-size: 11px; font-weight: 600; border-radius: 8px; border: 1px solid ${selectedShape === 'pill' ? 'var(--accent-blue, #2563eb)' : 'var(--border-color, #cbd5e1)'}; background: ${selectedShape === 'pill' ? 'var(--accent-blue, #2563eb)' : 'var(--bg-secondary, #f1f5f9)'}; color: ${selectedShape === 'pill' ? '#ffffff' : 'var(--text-primary)'}; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 5px; transition: all 0.15s ease;">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="6"/></svg>
                <span>Capsule</span>
              </button>
            </div>
          </div>
          <!-- Taille du médaillon -->
          <div>
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
              <label style="font-size: 10px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px;">
                Taille du médaillon
              </label>
              <span id="mm-img-size-val" style="font-size: 11px; font-weight: 700; color: var(--accent-blue, #3b82f6);">${selectedSize} px</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
              <input type="range" id="mm-img-size-slider" min="${isRoot ? 70 : 40}" max="${isRoot ? 200 : 160}" step="2" value="${selectedSize}" style="flex: 1;" />
            </div>
            <div class="mm-img-size-presets" style="display: flex; gap: 6px;">
              ${sizePresets.map(p => `
                <button type="button" class="mm-img-size-preset-btn ${selectedSize === p.size ? 'active' : ''}" data-size="${p.size}" style="flex: 1; padding: 3px 6px; font-size: 10.5px; font-weight: 600; border-radius: 6px; border: 1px solid ${selectedSize === p.size ? 'var(--accent-blue, #2563eb)' : 'var(--border-color, #cbd5e1)'}; background: ${selectedSize === p.size ? 'var(--accent-blue, #2563eb)' : 'var(--bg-secondary, #f1f5f9)'}; color: ${selectedSize === p.size ? '#ffffff' : 'var(--text-primary)'}; cursor: pointer; transition: all 0.15s ease;">
                  ${p.label} (${p.size}px)
                </button>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- Sélecteur d'harmonisation chromatique -->
        <div style="margin-bottom: 10px;">
          <label style="font-size: 10.5px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 4px;">
            Harmonisation chromatique
          </label>
          <div class="mm-img-colors-row" style="display: flex; gap: 6px;">
            <button type="button" class="mm-img-color-pill ${selectedColor === 'natural' ? 'active' : ''}" data-color="natural" style="flex: 1; padding: 6px 8px; font-size: 11px; font-weight: 600; border-radius: 8px; border: 1px solid ${selectedColor === 'natural' ? 'var(--accent-blue, #2563eb)' : 'var(--border-color, #cbd5e1)'}; background: ${selectedColor === 'natural' ? 'var(--accent-blue, #2563eb)' : 'var(--bg-secondary, #f1f5f9)'}; color: ${selectedColor === 'natural' ? '#ffffff' : 'var(--text-primary)'}; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 5px; transition: all 0.15s ease;">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/></svg>
              <span>Couleur naturelle</span>
            </button>
            <button type="button" class="mm-img-color-pill ${selectedColor === 'bw' ? 'active' : ''}" data-color="bw" style="flex: 1; padding: 6px 8px; font-size: 11px; font-weight: 600; border-radius: 8px; border: 1px solid ${selectedColor === 'bw' ? 'var(--accent-blue, #2563eb)' : 'var(--border-color, #cbd5e1)'}; background: ${selectedColor === 'bw' ? 'var(--accent-blue, #2563eb)' : 'var(--bg-secondary, #f1f5f9)'}; color: ${selectedColor === 'bw' ? '#ffffff' : 'var(--text-primary)'}; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 5px; transition: all 0.15s ease;">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 0 0 20z" fill="currentColor"/></svg>
              <span>Noir & Blanc</span>
            </button>
            <button type="button" class="mm-img-color-pill ${selectedColor === 'tint' ? 'active' : ''}" data-color="tint" style="flex: 1; padding: 6px 8px; font-size: 11px; font-weight: 600; border-radius: 8px; border: 1px solid ${selectedColor === 'tint' ? 'var(--accent-blue, #2563eb)' : 'var(--border-color, #cbd5e1)'}; background: ${selectedColor === 'tint' ? 'var(--accent-blue, #2563eb)' : 'var(--bg-secondary, #f1f5f9)'}; color: ${selectedColor === 'tint' ? '#ffffff' : 'var(--text-primary)'}; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 5px; transition: all 0.15s ease;">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="m19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2c.8.8 2 .8 2.8 0L19 11Z"/><circle cx="19" cy="19" r="3" fill="currentColor"/></svg>
              <span>${isRoot ? 'Dégradé central' : 'Teinte pastille'}</span>
            </button>
          </div>
        </div>

        <!-- Prompt artistique -->
        <div style="position: relative; margin-bottom: 4px;">
          <textarea class="mm-prompt-textarea" id="mm-img-prompt-input" rows="3" maxlength="390" placeholder="Génération du prompt artistique contextuel en cours..." style="font-size: 12px; padding: 10px 38px 10px 10px; width: 100%; box-sizing: border-box; resize: vertical;"></textarea>
          <button type="button" id="mm-img-btn-regen-prompt" title="Régénérer le prompt avec l'IA" style="position: absolute; right: 8px; top: 8px; background: transparent; border: none; cursor: pointer; color: var(--text-secondary); padding: 4px; border-radius: 4px;">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
          </button>
        </div>
        <div style="display: flex; justify-content: flex-end; margin-bottom: 8px;">
          <span id="mm-img-char-count" style="font-size: 10px; color: var(--text-secondary); transition: color 0.15s ease;">0 / 390 car. (max Infomaniak)</span>
        </div>

        <!-- Bouton d'action Génération -->
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
          <span id="mm-img-status" style="font-size: 11px; color: var(--text-secondary); display: inline-flex; align-items: center; gap: 4px;">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            <span>Moteur : Infomaniak Flux (&lt; 3s)</span>
          </span>
          <button type="button" class="btn-primary" id="mm-img-btn-generate" disabled style="display: flex; align-items: center; gap: 6px; padding: 6px 14px; font-size: 12px; font-weight: 700; opacity: 0.5; cursor: not-allowed;">
            <span id="mm-img-gen-icon" style="display: inline-flex; align-items: center;">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3Z"/></svg>
            </span>
            <span id="mm-img-gen-label">Générer avec Flux</span>
          </button>
        </div>

        <!-- Zone d'aperçu / résultat -->
        <div id="mm-img-preview-container" class="mm-crop-container" style="background: var(--bg-secondary, #0f172a); border-radius: 10px; padding: 10px; margin-bottom: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 140px; position: relative; overflow: hidden; border: 1px solid var(--border-color, rgba(255,255,255,0.1));">
          <div id="mm-img-preview-placeholder" style="color: var(--text-secondary); font-size: 12px; text-align: center;">
            ${currentImg ? '' : 'Aucune illustration générée pour le moment'}
          </div>
        </div>

        <!-- Barre de contrôles Recadrage interactif & Zoom (visible si une image est présente) -->
        <div id="mm-img-crop-controls" style="display: ${currentImg ? 'flex' : 'none'}; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 12px; padding: 6px 10px; background: rgba(0,0,0,0.18); border-radius: 8px; border: 1px solid var(--border-color, rgba(255,255,255,0.08));">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 11px; font-weight: 700; color: var(--text-secondary); display: flex; align-items: center; gap: 4px;">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
              <span>Zoom</span>
            </span>
            <button type="button" id="mm-crop-zoom-out" title="Dézoomer" style="background: var(--bg-secondary, #334155); border: 1px solid var(--border-color, #475569); color: var(--text-primary); width: 22px; height: 22px; border-radius: 4px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
            <input type="range" id="mm-crop-zoom-range" class="mm-crop-zoom-slider" min="100" max="300" step="5" value="${Math.round(selectedZoom * 100)}" style="width: 85px;" />
            <button type="button" id="mm-crop-zoom-in" title="Zoomer" style="background: var(--bg-secondary, #334155); border: 1px solid var(--border-color, #475569); color: var(--text-primary); width: 22px; height: 22px; border-radius: 4px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
            <span id="mm-crop-zoom-val" style="font-size: 11px; font-weight: 600; min-width: 32px; color: var(--text-primary);">${Math.round(selectedZoom * 100)}%</span>
          </div>
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 10px; color: var(--text-secondary);">(Glisser l'image pour cadrer)</span>
            <button type="button" id="mm-crop-reset" title="Réinitialiser zoom et cadrage" style="background: transparent; border: 1px solid var(--border-color, #475569); color: var(--text-secondary); font-size: 10px; padding: 2px 7px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; gap: 4px;">
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
              <span>Centrer</span>
            </button>
          </div>
        </div>

        <!-- Boutons d'actions -->
        <div class="mm-prompt-actions-row">
          <div>
            ${node.image ? `
              <button type="button" class="btn-danger-subtle" id="mm-img-btn-delete" title="Supprimer l'illustration actuelle">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                <span>Retirer l'image</span>
              </button>
            ` : ''}
          </div>
          <div class="mm-prompt-actions-right" style="display: flex; gap: 8px;">
            <button type="button" class="btn-secondary" id="mm-img-btn-cancel">Annuler</button>
            <button type="button" class="btn-primary" id="mm-img-btn-apply" ${currentImg ? '' : 'disabled style="opacity: 0.5;"'} style="display: inline-flex; align-items: center; gap: 6px;">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              <span>Appliquer à la pastille</span>
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const promptTextarea = overlay.querySelector('#mm-img-prompt-input');
    const stylePills = overlay.querySelectorAll('.mm-img-style-pill');
    const modePills = overlay.querySelectorAll('.mm-img-mode-pill');
    const colorPills = overlay.querySelectorAll('.mm-img-color-pill');
    const shapePills = overlay.querySelectorAll('.mm-img-shape-pill');
    const sizeSlider = overlay.querySelector('#mm-img-size-slider');
    const sizeVal = overlay.querySelector('#mm-img-size-val');
    const sizePresetBtns = overlay.querySelectorAll('.mm-img-size-preset-btn');
    const imgOnlyCustomization = overlay.querySelector('#mm-img-only-customization');
    const btnRegen = overlay.querySelector('#mm-img-btn-regen-prompt');
    const btnGen = overlay.querySelector('#mm-img-btn-generate');
    const btnApply = overlay.querySelector('#mm-img-btn-apply');
    const statusSpan = overlay.querySelector('#mm-img-status');
    const previewContainer = overlay.querySelector('#mm-img-preview-container');
    const cropControls = overlay.querySelector('#mm-img-crop-controls');
    const zoomRange = overlay.querySelector('#mm-crop-zoom-range');
    const zoomVal = overlay.querySelector('#mm-crop-zoom-val');
    const charCountEl = overlay.querySelector('#mm-img-char-count');

    const updatePreviewTransform = () => {
      const viewportEl = previewContainer.querySelector('.mm-crop-viewport');
      const previewImg = previewContainer.querySelector('.mm-crop-preview-img');
      if (!viewportEl || !previewImg) return;
      const vW = viewportEl.clientWidth || (isRoot ? 150 : 340);
      const vH = viewportEl.clientHeight || (isRoot ? 150 : 84);
      const imgAspect = node.imageAspect || 1.0;
      const cover = this.calcImageCover(vW, vH, imgAspect, selectedZoom, selectedPanX, selectedPanY);

      previewImg.style.width = `${Math.round(cover.renderW)}px`;
      previewImg.style.height = `${Math.round(cover.renderH)}px`;
      previewImg.style.left = '50%';
      previewImg.style.top = '50%';
      previewImg.style.transform = `translate(calc(-50% + ${Math.round(cover.offsetX)}px), calc(-50% + ${Math.round(cover.offsetY)}px))`;
    };

    const setZoom = (val) => {
      selectedZoom = Math.max(1.0, Math.min(3.0, Math.round(val * 100) / 100));
      if (zoomRange) zoomRange.value = Math.round(selectedZoom * 100);
      if (zoomVal) zoomVal.textContent = `${Math.round(selectedZoom * 100)}%`;
      updatePreviewTransform();
    };

    const attachCropListeners = () => {
      const viewportEl = previewContainer.querySelector('.mm-crop-viewport');
      if (!viewportEl) return;

      viewportEl.onmousedown = (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        isDragging = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        startPanX = selectedPanX;
        startPanY = selectedPanY;
        viewportEl.classList.add('panning');
      };

      viewportEl.onwheel = (e) => {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.05 : -0.05;
        setZoom(selectedZoom + delta);
      };
    };

    const onGlobalMouseMove = (e) => {
      if (!isDragging) return;
      const viewportEl = previewContainer.querySelector('.mm-crop-viewport');
      if (!viewportEl) return;
      const vW = viewportEl.clientWidth || (isRoot ? 150 : 340);
      const vH = viewportEl.clientHeight || (isRoot ? 150 : 84);
      const imgAspect = node.imageAspect || 1.0;
      const cover = this.calcImageCover(vW, vH, imgAspect, selectedZoom, 0, 0);

      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;

      if (cover.maxPanX > 0) {
        selectedPanX = Math.max(-100, Math.min(100, Math.round(startPanX + (dx / cover.maxPanX) * 100)));
      } else {
        selectedPanX = 0;
      }

      if (cover.maxPanY > 0) {
        selectedPanY = Math.max(-100, Math.min(100, Math.round(startPanY + (dy / cover.maxPanY) * 100)));
      } else {
        selectedPanY = 0;
      }

      updatePreviewTransform();
    };

    const onGlobalMouseUp = () => {
      if (isDragging) {
        isDragging = false;
        const viewportEl = previewContainer.querySelector('.mm-crop-viewport');
        if (viewportEl) viewportEl.classList.remove('panning');
      }
    };

    window.addEventListener('mousemove', onGlobalMouseMove);
    window.addEventListener('mouseup', onGlobalMouseUp);

    const renderPreview = (dataUrl) => {
      if (!dataUrl) return;
      if (cropControls) cropControls.style.display = 'flex';

      const filterStyle = (selectedColor === 'bw' || selectedColor === 'tint') ? 'filter: grayscale(100%) contrast(1.15) brightness(0.95);' : '';
      const tintBg = isRoot ? 'linear-gradient(135deg, #3b82f6, #ec4899, #10b981)' : (node.color || '#3b82f6');
      const tintOverlayHtml = selectedColor === 'tint' ? `<div class="mm-crop-preview-tint" style="position: absolute; inset: 0; pointer-events: none; background: ${tintBg}; mix-blend-mode: multiply; opacity: 0.72;"></div>` : '';

      if (isRoot) {
        // Le concept central est un médaillon (Buzan)
        if (selectedMode === 'image-only') {
          const previewW = Math.min(170, Math.max(80, Math.round(selectedSize * 1.15)));
          const previewH = previewW;
          let previewRadius = '50%';
          if (selectedShape === 'circle') previewRadius = '50%';
          else if (selectedShape === 'pill') previewRadius = `${Math.round(previewH / 2)}px`;
          else if (selectedShape === 'square') previewRadius = '8px';
          else previewRadius = `${Math.min(32, Math.max(12, Math.round(previewW * 0.22)))}px`;

          previewContainer.innerHTML = `
            <div style="position: relative; width: 100%; display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 6px 0;">
              <div class="mm-crop-viewport" style="width: ${previewW}px; height: ${previewH}px; border-radius: ${previewRadius}; overflow: hidden; position: relative; box-shadow: 0 4px 16px rgba(0,0,0,0.4); border: 2.5px solid var(--accent-blue, #3b82f6); user-select: none; transition: width 0.15s ease, height 0.15s ease, border-radius 0.15s ease;">
                <img src="${dataUrl}" class="mm-crop-preview-img" style="position: absolute; pointer-events: none; user-select: none; max-width: none; max-height: none; ${filterStyle}" />
                ${tintOverlayHtml}
              </div>
              <span style="font-size: 11px; color: var(--text-secondary); font-weight: 600;">L'illustration remplace le texte du concept central (${selectedSize} px)</span>
            </div>
          `;
        } else {
          // background (défaut pour root)
          previewContainer.innerHTML = `
            <div style="position: relative; width: 100%; display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 4px 0;">
              <div class="mm-crop-viewport" style="width: 150px; height: 150px; border-radius: 50%; overflow: hidden; position: relative; box-shadow: 0 4px 16px rgba(0,0,0,0.4); border: 2.5px solid var(--accent-blue, #3b82f6); user-select: none;">
                <img src="${dataUrl}" class="mm-crop-preview-img" style="position: absolute; pointer-events: none; user-select: none; max-width: none; max-height: none; ${filterStyle}" />
                ${tintOverlayHtml}
                <div style="position: absolute; inset: 0; background: rgba(15, 23, 42, 0.45); pointer-events: none;"></div>
                <div style="position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; pointer-events: none; padding: 10px; text-align: center;">
                  ${node.icon && typeof SvgIconsRegistry !== 'undefined' ? `<span style="display: inline-flex; margin-bottom: 4px;">${SvgIconsRegistry.getSvg(node.icon, 22)}</span>` : '<span style="display: inline-flex; margin-bottom: 4px;"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a4 4 0 0 0-4 4v1a4 4 0 0 0-2 7.5A4 4 0 0 0 8 22h8a4 4 0 0 0 2-7.5A4 4 0 0 0 16 7V6a4 4 0 0 0-4-4Z"/><path d="M12 2v20"/></svg></span>'}
                  <span style="font-weight: 900; font-size: 15px; letter-spacing: 0.5px; color: #ffffff; text-shadow: 0 1px 4px rgba(0,0,0,0.9);">${this.escapeHtml(nodeText)}</span>
                </div>
              </div>
              <span style="font-size: 11px; color: var(--text-secondary); font-weight: 600;">Médaillon central radiant (Lois de Buzan)</span>
            </div>
          `;
        }
      } else {
        // Nœuds de branches
        if (selectedMode === 'image-only') {
          const previewW = Math.min(160, Math.max(76, Math.round(selectedSize * 1.2)));
          const previewH = previewW;
          let previewRadius = '14px';
          if (selectedShape === 'circle') previewRadius = '50%';
          else if (selectedShape === 'pill') previewRadius = `${Math.round(previewH / 2)}px`;
          else if (selectedShape === 'square') previewRadius = '6px';
          else previewRadius = `${Math.min(26, Math.max(10, Math.round(previewW * 0.22)))}px`;

          previewContainer.innerHTML = `
            <div style="position: relative; width: 100%; display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 6px 0;">
              <div class="mm-crop-viewport" style="width: ${previewW}px; height: ${previewH}px; border-radius: ${previewRadius}; overflow: hidden; position: relative; box-shadow: 0 4px 14px rgba(0,0,0,0.35); border: 2.5px solid ${node.color || '#3b82f6'}; user-select: none; transition: width 0.15s ease, height 0.15s ease, border-radius 0.15s ease;">
                <img src="${dataUrl}" class="mm-crop-preview-img" style="position: absolute; pointer-events: none; user-select: none; max-width: none; max-height: none; ${filterStyle}" />
                ${tintOverlayHtml}
              </div>
              <span style="font-size: 11px; color: var(--text-secondary); font-weight: 600;">L'image remplace le mot-clé (${selectedSize} px)</span>
              <span style="font-size: 10px; opacity: 0.75; color: var(--text-secondary);">« ${this.escapeHtml(nodeText)} » reste visible au survol</span>
            </div>
          `;
        } else if (selectedMode === 'top-image') {
          previewContainer.innerHTML = `
            <div style="position: relative; width: 100%; display: flex; flex-direction: column; align-items: center; padding: 4px 0;">
              <div style="width: 170px; border-radius: 12px; overflow: hidden; border: 2px solid ${node.color || '#3b82f6'}; background: var(--bg-card, #ffffff); box-shadow: 0 4px 14px rgba(0,0,0,0.25); display: flex; flex-direction: column;">
                <div class="mm-crop-viewport" style="height: 75px; overflow: hidden; position: relative; user-select: none;">
                  <img src="${dataUrl}" class="mm-crop-preview-img" style="position: absolute; pointer-events: none; user-select: none; max-width: none; max-height: none; ${filterStyle}" />
                  ${tintOverlayHtml}
                </div>
                <div style="padding: 6px 8px; text-align: center; border-top: 1px solid rgba(148,163,184,0.25); color: var(--text-primary); font-weight: 700; font-size: 11px; display: flex; align-items: center; justify-content: center; gap: 4px;">
                  ${node.icon && typeof SvgIconsRegistry !== 'undefined' ? `<span style="display: inline-flex;">${SvgIconsRegistry.getSvg(node.icon, 12)}</span>` : ''}
                  <span>${this.escapeHtml(nodeText)}</span>
                </div>
              </div>
            </div>
          `;
        } else {
          // background (défaut branche)
          previewContainer.innerHTML = `
            <div style="position: relative; width: 100%; display: flex; flex-direction: column; align-items: center;">
              <div class="mm-crop-viewport" style="width: 100%; max-width: 340px; height: 84px; border-radius: 10px; overflow: hidden; position: relative; box-shadow: 0 4px 14px rgba(0,0,0,0.3); border: 2px solid ${node.color || '#3b82f6'}; user-select: none;">
                <img src="${dataUrl}" class="mm-crop-preview-img" style="position: absolute; pointer-events: none; user-select: none; max-width: none; max-height: none; ${filterStyle}" />
                ${tintOverlayHtml}
                <div style="position: absolute; inset: 0; background: rgba(15, 23, 42, 0.45); pointer-events: none;"></div>
                <div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; gap: 8px; color: #ffffff; font-weight: 800; font-size: 12px; pointer-events: none;">
                  ${node.icon && typeof SvgIconsRegistry !== 'undefined' ? `<span style="display: inline-flex;">${SvgIconsRegistry.getSvg(node.icon, 14)}</span>` : ''}
                  <span style="text-shadow: 0 1px 3px rgba(0,0,0,0.9);">${this.escapeHtml(nodeText)}</span>
                  ${node.ref ? `<span style="font-size: 9px; padding: 2px 6px; border-radius: 4px; background: rgba(255,255,255,0.2); backdrop-filter: blur(4px);">${this.escapeHtml(this.formatScripturePillRef(node.ref))}</span>` : ''}
                </div>
              </div>
            </div>
          `;
        }
      }

      // Mesurer le ratio d'aspect naturel dès chargement de l'image
      const tmpImg = new Image();
      tmpImg.onload = () => {
        if (tmpImg.naturalWidth && tmpImg.naturalHeight) {
          node.imageAspect = tmpImg.naturalWidth / tmpImg.naturalHeight;
        }
        updatePreviewTransform();
      };
      tmpImg.src = dataUrl;

      attachCropListeners();
    };

    if (currentImg) {
      renderPreview(currentImg);
    }

    const updateCharCount = () => {
      const len = (promptTextarea.value || '').length;
      if (charCountEl) {
        charCountEl.textContent = `${len} / 390 car. (max Infomaniak)`;
        charCountEl.style.color = len > 360 ? '#f59e0b' : (len >= 390 ? '#ef4444' : 'var(--text-secondary)');
      }
    };

    const updateGenerateBtnState = () => {
      if (!btnGen) return;
      const val = (promptTextarea.value || '').trim();
      const isLoadingPrompt = promptTextarea.disabled;
      const isGenerating = btnGen.dataset.generating === 'true';
      const isValid = val.length > 0 && val.length <= 390 && !isLoadingPrompt && !isGenerating;
      btnGen.disabled = !isValid;
      btnGen.style.opacity = isValid ? '1' : '0.5';
      btnGen.style.cursor = isValid ? 'pointer' : 'not-allowed';
    };

    promptTextarea.addEventListener('input', () => {
      updateCharCount();
      updateGenerateBtnState();
    });

    const closeDialog = () => {
      window.removeEventListener('mousemove', onGlobalMouseMove);
      window.removeEventListener('mouseup', onGlobalMouseUp);
      overlay.remove();
    };
    overlay.querySelector('#mm-img-x-close')?.addEventListener('click', closeDialog);
    overlay.querySelector('#mm-img-btn-cancel')?.addEventListener('click', closeDialog);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeDialog(); });

    // Contrôles de zoom
    zoomRange?.addEventListener('input', () => {
      setZoom(parseFloat(zoomRange.value) / 100);
    });

    overlay.querySelector('#mm-crop-zoom-out')?.addEventListener('click', () => {
      setZoom(selectedZoom - 0.1);
    });

    overlay.querySelector('#mm-crop-zoom-in')?.addEventListener('click', () => {
      setZoom(selectedZoom + 0.1);
    });

    overlay.querySelector('#mm-crop-reset')?.addEventListener('click', () => {
      selectedPanX = 0;
      selectedPanY = 0;
      setZoom(1.0);
    });

    // Clic sur les styles
    stylePills.forEach(pill => {
      pill.addEventListener('click', () => {
        stylePills.forEach(p => {
          p.classList.remove('active');
          p.style.background = 'var(--bg-secondary, #f1f5f9)';
          p.style.borderColor = 'var(--border-color, #cbd5e1)';
          p.style.color = 'var(--text-primary)';
        });
        pill.classList.add('active');
        pill.style.background = 'var(--accent-blue, #2563eb)';
        pill.style.borderColor = 'var(--accent-blue, #2563eb)';
        pill.style.color = '#ffffff';
        selectedStyle = pill.getAttribute('data-style');
        loadSuggestedPrompt();
      });
    });

    // Clic sur les modes d'affichage visuel
    modePills.forEach(pill => {
      pill.addEventListener('click', () => {
        modePills.forEach(p => {
          p.classList.remove('active');
          p.style.background = 'var(--bg-secondary, #f1f5f9)';
          p.style.borderColor = 'var(--border-color, #cbd5e1)';
          p.style.color = 'var(--text-primary)';
        });
        pill.classList.add('active');
        pill.style.background = 'var(--accent-blue, #2563eb)';
        pill.style.borderColor = 'var(--accent-blue, #2563eb)';
        pill.style.color = '#ffffff';
        selectedMode = pill.getAttribute('data-mode') || 'background';
        if (imgOnlyCustomization) {
          imgOnlyCustomization.style.display = (selectedMode === 'image-only') ? 'block' : 'none';
        }
        const activeUrl = generatedImageResult?.dataUrl || currentImg;
        if (activeUrl) renderPreview(activeUrl);
      });
    });

    // Clic sur les formes du médaillon (mode image seule)
    shapePills.forEach(pill => {
      pill.addEventListener('click', () => {
        shapePills.forEach(p => {
          p.classList.remove('active');
          p.style.background = 'var(--bg-secondary, #f1f5f9)';
          p.style.borderColor = 'var(--border-color, #cbd5e1)';
          p.style.color = 'var(--text-primary)';
        });
        pill.classList.add('active');
        pill.style.background = 'var(--accent-blue, #2563eb)';
        pill.style.borderColor = 'var(--accent-blue, #2563eb)';
        pill.style.color = '#ffffff';
        selectedShape = pill.getAttribute('data-shape') || 'rounded';
        const activeUrl = generatedImageResult?.dataUrl || currentImg;
        if (activeUrl) renderPreview(activeUrl);
      });
    });

    // Contrôles de taille du médaillon (mode image seule)
    const updateSizePresetsUI = (size) => {
      sizePresetBtns.forEach(btn => {
        const btnSize = parseInt(btn.getAttribute('data-size'));
        const isActive = (btnSize === size);
        btn.classList.toggle('active', isActive);
        btn.style.background = isActive ? 'var(--accent-blue, #2563eb)' : 'var(--bg-secondary, #f1f5f9)';
        btn.style.borderColor = isActive ? 'var(--accent-blue, #2563eb)' : 'var(--border-color, #cbd5e1)';
        btn.style.color = isActive ? '#ffffff' : 'var(--text-primary)';
      });
    };

    sizeSlider?.addEventListener('input', () => {
      selectedSize = parseInt(sizeSlider.value) || 72;
      if (sizeVal) sizeVal.textContent = `${selectedSize} px`;
      updateSizePresetsUI(selectedSize);
      const activeUrl = generatedImageResult?.dataUrl || currentImg;
      if (activeUrl) renderPreview(activeUrl);
    });

    sizePresetBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const s = parseInt(btn.getAttribute('data-size'));
        if (s && s >= 36) {
          selectedSize = s;
          if (sizeSlider) sizeSlider.value = s;
          if (sizeVal) sizeVal.textContent = `${s} px`;
          updateSizePresetsUI(s);
          const activeUrl = generatedImageResult?.dataUrl || currentImg;
          if (activeUrl) renderPreview(activeUrl);
        }
      });
    });

    // Clic sur les modes chromatiques
    colorPills.forEach(pill => {
      pill.addEventListener('click', () => {
        colorPills.forEach(p => {
          p.classList.remove('active');
          p.style.background = 'var(--bg-secondary, #f1f5f9)';
          p.style.borderColor = 'var(--border-color, #cbd5e1)';
          p.style.color = 'var(--text-primary)';
        });
        pill.classList.add('active');
        pill.style.background = 'var(--accent-blue, #2563eb)';
        pill.style.borderColor = 'var(--accent-blue, #2563eb)';
        pill.style.color = '#ffffff';
        selectedColor = pill.getAttribute('data-color') || 'natural';
        const activeUrl = generatedImageResult?.dataUrl || currentImg;
        if (activeUrl) renderPreview(activeUrl);
      });
    });

    // Chargement automatique du prompt artistique
    const loadSuggestedPrompt = async () => {
      promptTextarea.disabled = true;
      if (btnRegen) {
        btnRegen.disabled = true;
        btnRegen.style.opacity = '0.5';
        btnRegen.style.cursor = 'not-allowed';
      }
      updateGenerateBtnState();
      statusSpan.textContent = 'Synthèse du prompt artistique contextuel...';
      try {
        if (window.pywebview && window.pywebview.api && window.pywebview.api.get_suggested_image_prompt) {
          try {
            const res = await window.pywebview.api.get_suggested_image_prompt(
              nodeText,
              this.tree?.text || '',
              node.parent?.text || '',
              node.ref || '',
              selectedStyle
            );
            if (res && res.success && res.prompt) {
              let p = res.prompt.trim();
              if (p.length > 390) p = p.slice(0, 390);
              promptTextarea.value = p;
              statusSpan.textContent = 'Prêt pour génération Flux';
            } else {
              promptTextarea.value = `Evocative sacred scene of ${nodeText}, dramatic lighting, fine art`;
              statusSpan.textContent = 'Prêt pour génération';
            }
          } catch (e) {
            promptTextarea.value = `Evocative sacred scene of ${nodeText}, dramatic lighting, fine art`;
            statusSpan.textContent = 'Prêt pour génération';
          }
        } else {
          promptTextarea.value = `Evocative sacred scene of ${nodeText}, dramatic lighting, fine art`;
          statusSpan.textContent = 'Prêt pour génération';
        }
      } finally {
        promptTextarea.disabled = false;
        if (btnRegen) {
          btnRegen.disabled = false;
          btnRegen.style.opacity = '1';
          btnRegen.style.cursor = 'pointer';
        }
        updateCharCount();
        updateGenerateBtnState();
      }
    };

    btnRegen?.addEventListener('click', () => loadSuggestedPrompt());

    // Génération avec Infomaniak Flux
    btnGen?.addEventListener('click', async () => {
      let prompt = promptTextarea.value.trim();
      if (!prompt || btnGen.disabled) return;
      if (prompt.length > 390) {
        prompt = prompt.slice(0, 390);
        promptTextarea.value = prompt;
        updateCharCount();
      }

      btnGen.dataset.generating = 'true';
      updateGenerateBtnState();
      overlay.querySelector('#mm-img-gen-icon').innerHTML = '<span style="display:inline-block; width:12px; height:12px; border:2px solid currentColor; border-top-color:transparent; border-radius:50%; animation:mmSpin 0.7s linear infinite;"></span>';
      overlay.querySelector('#mm-img-gen-label').textContent = 'Génération en cours...';
      statusSpan.textContent = 'Infomaniak Flux génère votre illustration...';

      previewContainer.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; gap: 8px; color: var(--text-secondary); padding: 20px 0;">
          <div style="width: 24px; height: 24px; border: 2.5px solid rgba(255,255,255,0.2); border-top-color: #3b82f6; border-radius: 50%; animation: mmSpin 0.7s linear infinite;"></div>
          <span style="font-size: 11px;">Création par Flux Schnell (< 3s)...</span>
        </div>
      `;

      try {
        if (window.pywebview && window.pywebview.api && window.pywebview.api.generate_mindmap_node_image) {
          const res = await window.pywebview.api.generate_mindmap_node_image(
            prompt,
            this.currentNote?.id || 'note',
            node.id,
            selectedStyle
          );
          if (res && res.success && res.dataUrl) {
            generatedImageResult = res;
            statusSpan.textContent = 'Illustration générée avec succès !';
            renderPreview(res.dataUrl);
            btnApply.disabled = false;
            btnApply.style.opacity = '1';
          } else {
            const err = res?.error || 'Erreur inconnue';
            statusSpan.textContent = `Erreur : ${err}`;
            previewContainer.innerHTML = `<div style="color: #ef4444; font-size: 12px; text-align: center; padding: 10px;">${this.escapeHtml(err)}</div>`;
          }
        }
      } catch (ex) {
        statusSpan.textContent = `Erreur : ${ex.message || ex}`;
        previewContainer.innerHTML = `<div style="color: #ef4444; font-size: 12px; text-align: center; padding: 10px;">${this.escapeHtml(String(ex))}</div>`;
      } finally {
        delete btnGen.dataset.generating;
        updateGenerateBtnState();
        overlay.querySelector('#mm-img-gen-icon').innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3Z"/></svg>';
        overlay.querySelector('#mm-img-gen-label').textContent = 'Régénérer avec Flux';
      }
    });

    // Appliquer à la pastille
    btnApply?.addEventListener('click', () => {
      if (generatedImageResult) {
        node.image = generatedImageResult.relativePath;
        node.imageDataUrl = generatedImageResult.dataUrl;
      }
      node.imageMode = selectedMode;
      node.imageColor = selectedColor;
      node.imageZoom = selectedZoom;
      node.imagePanX = selectedPanX;
      node.imagePanY = selectedPanY;

      if (isRoot && this.currentNote) {
        if (generatedImageResult) {
          this.currentNote.rootImage = generatedImageResult.relativePath;
        }
        this.currentNote.rootImageMode = selectedMode;
        this.currentNote.rootImageColor = selectedColor;
        this.currentNote.rootImageZoom = selectedZoom;
        this.currentNote.rootImagePanX = selectedPanX;
        this.currentNote.rootImagePanY = selectedPanY;
        if (selectedMode === 'image-only') {
          this.currentNote.rootImageShape = selectedShape;
          this.currentNote.rootImageSize = selectedSize;
          node.imageShape = selectedShape;
          node.imageSize = selectedSize;
        }
        if (node.imageAspect) {
          this.currentNote.rootImageAspect = node.imageAspect;
        }
      } else if (selectedMode === 'image-only') {
        node.imageShape = selectedShape;
        node.imageSize = selectedSize;
      }
      this.layoutTree();
      this.draw();
      this.syncAndAutoSave();
      closeDialog();
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast('Illustration, recadrage et harmonie enregistrés');
      }
    });

    // Supprimer l'image
    overlay.querySelector('#mm-img-btn-delete')?.addEventListener('click', () => {
      this.removeNodeImage(nodeId);
      closeDialog();
    });

    // Lancer automatiquement la première suggestion de prompt
    loadSuggestedPrompt();
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

    const isBox = node.isFloating || !!node.image || this.nodeShape === 'rounded-rect' || this.nodeShape === 'pill';

    if (this.treeStructure === 'top-down') {
      if (targetPoint.y >= node.y) {
        return { x: node.x, y: isBox ? node.y + (node.height || 28) / 2 : node.y + 12 };
      } else {
        return { x: node.x, y: isBox ? node.y - (node.height || 28) / 2 : node.y - 12 };
      }
    }

    // Structure Radiant ou Right-tree
    if (isBox) {
      const halfW = (node.width || 80) / 2;
      const halfH = (node.height || 28) / 2;
      const dx = targetPoint.x - node.x;
      const dy = targetPoint.y - node.y;
      if (Math.abs(dy) > Math.abs(dx) * 1.5) {
        return dy >= 0 ? { x: node.x, y: node.y + halfH } : { x: node.x, y: node.y - halfH };
      }
      return dx >= 0 ? { x: node.x + halfW, y: node.y } : { x: node.x - halfW, y: node.y };
    }

    // Mode SOULIGNÉ (Buzan classique : mot-clé posé sur la branche maîtresse)
    // Ne jamais ancrer à l'extrême bout de la ligne pour ne pas couper le départ des sous-branches
    const dy = targetPoint.y - node.y;
    const dx = targetPoint.x - node.x;

    // Si la cible est nettement plus haute (au-dessus du mot-clé)
    if (dy < -12) {
      return { x: node.x, y: node.y - 14 };
    }
    // Si la cible est nettement plus basse (sous la ligne de soulignement)
    if (dy > 12) {
      return { x: node.x, y: node.y + 12 };
    }

    // Trajectoire quasi-horizontale : flanc immédiat du mot-clé
    const textHalfW = Math.min((node.width || 80) / 2, (node.textWidth || 60) / 2 + 16);
    if (dx >= 0) {
      return { x: node.x + textHalfW, y: node.y + 3 };
    } else {
      return { x: node.x - textHalfW, y: node.y + 3 };
    }
  },

  drawRelationships() {
    if (!this.relationships || this.relationships.length === 0 || !this.viewportG) return;

    // Calque dédié pour les lignes de liaisons (sous les nœuds)
    let relsLayer = this.viewportG.querySelector('#mm-relationships-layer');
    if (!relsLayer) {
      relsLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      relsLayer.setAttribute('id', 'mm-relationships-layer');
      this.viewportG.appendChild(relsLayer);
    } else {
      relsLayer.innerHTML = '';
    }

    // Calque dédié pour les étiquettes et poignées de contrôle (au-dessus des nœuds, toujours visibles)
    let relsLabelsLayer = this.viewportG.querySelector('#mm-rel-labels-layer');
    if (!relsLabelsLayer) {
      relsLabelsLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      relsLabelsLayer.setAttribute('id', 'mm-rel-labels-layer');
      this.viewportG.appendChild(relsLabelsLayer);
    } else {
      relsLabelsLayer.innerHTML = '';
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

      // Normale perpendiculaire standard
      let nx = -dy / dist;
      let ny = dx / dist;

      // Paramètres du nœud racine central
      const rootNode = this.tree;
      const rootW = rootNode ? (rootNode.width || 180) : 180;
      const rootH = rootNode ? (rootNode.height || 48) : 48;
      const rootX = rootNode ? (rootNode.x || 0) : 0;
      const rootY = rootNode ? (rootNode.y || 0) : 0;

      // Détecter si la liaison traverse l'arbre de part en part (ex: branche gauche <-> branche droite)
      const isCrossHemisphere = this.treeStructure !== 'top-down' && (
        (fromNode.id !== 'root' && toNode.id !== 'root') &&
        ((fromNode.x < rootX - 20 && toNode.x > rootX + 20) || (fromNode.x > rootX + 20 && toNode.x < rootX - 20))
      );

      let cx, cy;

      if (rel.customControl && !(Math.abs(rel.customControl.x - 120) < 3 && Math.abs(rel.customControl.y - (-40)) < 3)) {
        cx = rel.customControl.x;
        cy = rel.customControl.y;
      } else if (isCrossHemisphere) {
        // Contournement noble du sujet central : arquer au-dessus ou en-dessous du nœud racine
        const avgY = (fromNode.y + toNode.y) / 2;
        const archAbove = avgY <= rootY;

        cx = (p1.x + p2.x) / 2;

        if (archAbove) {
          const clearTop = rootY - rootH / 2 - 38;
          const minNodeY = Math.min(fromNode.y, toNode.y);
          const targetLy = Math.min(clearTop, minNodeY - 25);
          cy = 2 * targetLy - 0.5 * (p1.y + p2.y);
        } else {
          const clearBottom = rootY + rootH / 2 + 38;
          const maxNodeY = Math.max(fromNode.y, toNode.y);
          const targetLy = Math.max(clearBottom, maxNodeY + 25);
          cy = 2 * targetLy - 0.5 * (p1.y + p2.y);
        }
      } else {
        // Courbure douce avec orientation élégante vers l'extérieur de l'arbre
        const curvature = Math.min(85, Math.max(30, dist * 0.2));

        // Sur le côté droit, cambrer vers la droite (nx > 0)
        if (fromNode.x > rootX + 20 && toNode.x > rootX + 20) {
          if (nx < 0) { nx = -nx; ny = -ny; }
        }
        // Sur le côté gauche, cambrer vers la gauche (nx < 0)
        else if (fromNode.x < rootX - 20 && toNode.x < rootX - 20) {
          if (nx > 0) { nx = -nx; ny = -ny; }
        }

        cx = (p1.x + p2.x) / 2 + nx * curvature;
        cy = (p1.y + p2.y) / 2 + ny * curvature;
      }

      // Milieu exact sur la courbe quadratique de Bézier (t = 0.5)
      let lx = 0.25 * p1.x + 0.5 * cx + 0.25 * p2.x;
      let ly = 0.25 * p1.y + 0.5 * cy + 0.25 * p2.y;

      // Garde-fou absolu contre toute collision de l'étiquette avec le rectangle du nœud racine
      const isActivelyDraggingRel = this.dragState && this.dragState.active && this.dragState.type === 'rel-curve' && this.dragState.relId === rel.id;
      if (!isActivelyDraggingRel && rootNode && fromNode.id !== 'root' && toNode.id !== 'root') {
        const rHalfW = rootW / 2 + 32;
        const rHalfH = rootH / 2 + 22;
        if (Math.abs(lx - rootX) < rHalfW && Math.abs(ly - rootY) < rHalfH) {
          const goAbove = (p1.y + p2.y) / 2 <= rootY;
          const targetLy = goAbove ? (rootY - rHalfH - 20) : (rootY + rHalfH + 20);
          cy = 2 * targetLy - 0.5 * (p1.y + p2.y);
          lx = 0.25 * p1.x + 0.5 * cx + 0.25 * p2.x;
          ly = 0.25 * p1.y + 0.5 * cy + 0.25 * p2.y;
        }
      }

      const pathData = `M ${p1.x} ${p1.y} Q ${cx} ${cy}, ${p2.x} ${p2.y}`;
      const isSelected = this.selectedRelId === rel.id;
      const relColor = rel.color || fromNode.color || '#2563eb';

      const relG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      relG.setAttribute('class', `mm-relationship-g ${isSelected ? 'selected' : ''}`);
      relG.setAttribute('data-rel-id', rel.id);

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

      // Trait transparent pour zone de clic et glisser-déplacer aérée (au premier plan du groupe de courbe)
      const hitPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      hitPath.setAttribute('d', pathData);
      hitPath.setAttribute('stroke', 'transparent');
      hitPath.setAttribute('stroke-width', '20');
      hitPath.setAttribute('fill', 'none');
      hitPath.setAttribute('class', 'mm-rel-hit-path');
      hitPath.setAttribute('style', this.isReadOnly ? 'cursor: default;' : 'cursor: pointer;');

      // Possibilité de glisser directement le fil de liaison pour courber (désactivé en lecture seule)
      hitPath.addEventListener('mousedown', (e) => {
        if (this.isReadOnly) return;
        if (e.button !== 0) return;
        e.stopPropagation();
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
      relsLayer.appendChild(relG);

      // Conteneur au premier plan pour l'étiquette et la poignée de manipulation (au-dessus des nœuds)
      const labelWrapG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      labelWrapG.setAttribute('class', `mm-rel-label-wrap ${isSelected ? 'selected' : ''}`);
      labelWrapG.setAttribute('data-rel-id', rel.id);

      // Poignée de contrôle interactive de la courbure Bézier (style XMind - masquée en lecture seule)
      if (!this.isReadOnly) {
        // Ligne directrice en pointillés reliant le titre (sommet) à la poignée de contrôle
        const handleLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        handleLine.setAttribute('x1', lx);
        handleLine.setAttribute('y1', ly);
        handleLine.setAttribute('x2', cx);
        handleLine.setAttribute('y2', cy);
        handleLine.setAttribute('stroke', relColor);
        handleLine.setAttribute('stroke-width', '1.4');
        handleLine.setAttribute('stroke-dasharray', '3,3');
        handleLine.setAttribute('class', 'mm-rel-handle-line');
        handleLine.setAttribute('data-rel-id', rel.id);
        handleLine.setAttribute('style', isSelected ? 'display: inline;' : 'display: none;');
        labelWrapG.appendChild(handleLine);

        const handleCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        handleCircle.setAttribute('cx', cx);
        handleCircle.setAttribute('cy', cy);
        handleCircle.setAttribute('r', '7');
        handleCircle.setAttribute('class', 'mm-rel-handle');
        handleCircle.setAttribute('data-rel-id', rel.id);
        handleCircle.setAttribute('fill', relColor);
        handleCircle.setAttribute('stroke', '#ffffff');
        handleCircle.setAttribute('stroke-width', '2.5');
        handleCircle.setAttribute('style', isSelected ? 'display: inline;' : 'display: none;');
        handleCircle.setAttribute('title', 'Glisser pour ajuster la courbure (Double-clic pour réinitialiser)');

        handleCircle.addEventListener('mousedown', (e) => {
          if (e.button !== 0) return;
          e.stopPropagation();
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

        labelWrapG.appendChild(handleCircle);
      }

      // Étiquette flottante centrale
      const labelText = (rel.label || 'VOIR AUSSI').toUpperCase();
      const textW = this.getTextWidth(labelText, 9.5, '700');
      const pillW = Math.max(54, textW + 18);
      const pillH = 20;

      const labelG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      labelG.setAttribute('transform', `translate(${lx}, ${ly})`);
      labelG.setAttribute('class', `mm-rel-label-g ${isSelected ? 'selected' : ''}`);
      labelG.setAttribute('data-rel-id', rel.id);

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

      // Bouton contextuel × au survol (masqué en mode lecture seule)
      if (!this.isReadOnly) {
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

        delBtnG.addEventListener('mousedown', (e) => {
          e.stopPropagation();
        });

        delBtnG.addEventListener('click', (e) => {
          e.stopPropagation();
          this.deleteRelationship(rel.id);
        });
        labelG.appendChild(delBtnG);
      }

      // Glisser-déplacer direct du titre de la liaison pour déplacer son emplacement et sa courbe
      labelG.addEventListener('mousedown', (e) => {
        if (this.isReadOnly) return;
        if (e.button !== 0) return;
        if (e.target.closest('.mm-rel-del-btn')) return;
        e.stopPropagation();
        this.selectRelationship(rel.id);
        this.dragState = {
          active: true,
          type: 'rel-label',
          nodeId: null,
          relId: rel.id,
          startX: e.clientX,
          startY: e.clientY,
          hasMoved: false,
          targetNodeId: null
        };
      });

      // Synchronisation survol entre la ligne et l'étiquette
      labelG.addEventListener('mouseenter', () => {
        visiblePath.setAttribute('stroke-width', '2.8');
        relG.classList.add('hovered');
      });
      labelG.addEventListener('mouseleave', () => {
        if (this.selectedRelId !== rel.id) {
          visiblePath.setAttribute('stroke-width', '2');
        }
        relG.classList.remove('hovered');
      });
      relG.addEventListener('mouseenter', () => {
        labelG.classList.add('hovered');
      });
      relG.addEventListener('mouseleave', () => {
        labelG.classList.remove('hovered');
      });

      // Événements d'interaction
      relG.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.dragState && this.dragState.hasMoved) return;
        this.selectRelationship(rel.id);
      });

      labelG.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.dragState && this.dragState.hasMoved) return;
        this.selectRelationship(rel.id);
      });

      labelG.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        if (this.isReadOnly) return;
        if (this.dragState && this.dragState.hasMoved) return;
        this.promptEditRelationshipLabel(rel.id);
      });

      labelG.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (this.isReadOnly) return;
        this.selectRelationship(rel.id);
        this.promptEditRelationshipLabel(rel.id);
      });

      relG.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (this.isReadOnly) return;
        this.selectRelationship(rel.id);
        this.promptEditRelationshipLabel(rel.id);
      });

      labelWrapG.appendChild(labelG);
      relsLabelsLayer.appendChild(labelWrapG);
    });
  },

  selectRelationship(relId) {
    this.selectedRelId = relId;
    this.selectedNodeId = null;
    this.updateSelectionState();
  },

  deleteRelationship(relId) {
    if (this.isReadOnly) return;
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
    if (this.isReadOnly) return;
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
      App.showToast(`Liaison créée : « ${fromNode?.text} » → « ${toNode?.text} »`);
    }

    this.promptEditRelationshipLabel(createdId);
  },

  promptEditRelationshipLabel(relId) {
    if (this.isReadOnly) return;
    const rel = this.relationships?.find(r => r.id === relId);
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
  },

  // =========================================================================
  // ENCLOS / CLÔTURES STYLE XMIND (Boundaries)
  // =========================================================================

  getBoundaryBBox(boundary) {
    const rootNode = this.findNode(boundary.rootId);
    if (!rootNode) return null;

    const nodes = [];
    const collect = (n) => {
      if (!n) return;
      nodes.push(n);
      if (n.children) n.children.forEach(collect);
    };
    collect(rootNode);

    if (nodes.length === 0) return null;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    nodes.forEach(n => {
      const hw = (n.width || 70) / 2;
      const hh = (n.height || 28) / 2;
      minX = Math.min(minX, n.x - hw);
      maxX = Math.max(maxX, n.x + hw);
      minY = Math.min(minY, n.y - hh);
      maxY = Math.max(maxY, n.y + hh);
    });

    const padX = 18;
    const padY = 16;
    let bWidth = (maxX - minX) + 2 * padX;
    const labelText = (boundary.label || 'ENCLOS').toUpperCase();
    const textW = this.getTextWidth ? this.getTextWidth(labelText, 9.5, '700') : 60;
    const pillW = Math.max(56, textW + 20);
    if (pillW + 28 > bWidth) {
      bWidth = pillW + 28;
    }

    return {
      x: minX - padX,
      y: minY - padY,
      width: bWidth,
      height: (maxY - minY) + 2 * padY
    };
  },

  drawBoundaries() {
    if (!this.boundaries || this.boundaries.length === 0 || !this.viewportG) return;

    let bndLayer = this.viewportG.querySelector('#mm-boundaries-layer');
    if (!bndLayer) {
      bndLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      bndLayer.setAttribute('id', 'mm-boundaries-layer');
      if (this.viewportG.firstChild) {
        this.viewportG.insertBefore(bndLayer, this.viewportG.firstChild);
      } else {
        this.viewportG.appendChild(bndLayer);
      }
    } else {
      bndLayer.innerHTML = '';
    }

    this.boundaries.forEach(bnd => {
      const bbox = this.getBoundaryBBox(bnd);
      if (!bbox) return;

      const rootNode = this.findNode(bnd.rootId);
      const bndColor = bnd.color || rootNode?.color || '#2563eb';
      const isSelected = this.selectedBoundaryId === bnd.id;

      const bndG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      bndG.setAttribute('class', `mm-boundary-g ${isSelected ? 'selected' : ''}`);
      bndG.setAttribute('data-boundary-id', bnd.id);

      // 1. Rectangle d'enclos principal (bordure en pointillés + fond translucide doux)
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', bbox.x);
      rect.setAttribute('y', bbox.y);
      rect.setAttribute('width', bbox.width);
      rect.setAttribute('height', bbox.height);
      rect.setAttribute('rx', 12);
      rect.setAttribute('ry', 12);
      rect.setAttribute('class', 'mm-boundary-rect');
      rect.setAttribute('fill', this.hexToRgba(bndColor, isSelected ? 0.12 : 0.06));
      rect.setAttribute('stroke', bndColor);
      rect.setAttribute('stroke-width', isSelected ? '2.4' : '1.8');
      rect.setAttribute('stroke-dasharray', isSelected ? '7,3' : '6,4');
      rect.setAttribute('style', this.isReadOnly ? 'cursor: default;' : 'cursor: pointer;');
      bndG.appendChild(rect);

      // 2. Étiquette supérieure style pilule XMind
      const labelText = (bnd.label || 'ENCLOS').toUpperCase();
      const textW = this.getTextWidth(labelText, 9.5, '700');
      const pillW = Math.max(56, textW + 20);
      const pillH = 22;
      const pillX = Math.min(bbox.x + 14, bbox.x + bbox.width - pillW - 10);
      const pillY = bbox.y - pillH / 2;

      const labelG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      labelG.setAttribute('transform', `translate(${pillX}, ${pillY})`);
      labelG.setAttribute('class', 'mm-boundary-label-g');
      labelG.setAttribute('style', this.isReadOnly ? 'cursor: default;' : 'cursor: pointer;');

      const pillRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      pillRect.setAttribute('x', 0);
      pillRect.setAttribute('y', 0);
      pillRect.setAttribute('width', pillW);
      pillRect.setAttribute('height', pillH);
      pillRect.setAttribute('rx', 11);
      pillRect.setAttribute('class', 'mm-boundary-label-pill');
      pillRect.setAttribute('fill', 'var(--bg-card, #ffffff)');
      pillRect.setAttribute('stroke', bndColor);
      pillRect.setAttribute('stroke-width', '1.5');
      labelG.appendChild(pillRect);

      const labelT = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      labelT.setAttribute('x', pillW / 2);
      labelT.setAttribute('y', pillH / 2);
      labelT.setAttribute('text-anchor', 'middle');
      labelT.setAttribute('dominant-baseline', 'central');
      labelT.setAttribute('class', 'mm-boundary-label-text');
      labelT.setAttribute('fill', bndColor);
      labelT.textContent = labelText;
      labelG.appendChild(labelT);

      // Bouton supprimer [×] visible au survol ou à la sélection (masqué en mode lecture seule)
      if (!this.isReadOnly) {
        const delBtnG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        delBtnG.setAttribute('transform', `translate(${pillW + 9}, ${pillH / 2})`);
        delBtnG.setAttribute('class', 'mm-boundary-del-btn');
        delBtnG.setAttribute('title', 'Supprimer cet enclos');
        delBtnG.setAttribute('style', isSelected ? 'display: inline;' : 'display: none;');

        const delCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        delCircle.setAttribute('r', 7.5);
        delCircle.setAttribute('class', 'mm-boundary-del-circle');
        delBtnG.appendChild(delCircle);

        const delXText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        delXText.setAttribute('text-anchor', 'middle');
        delXText.setAttribute('dominant-baseline', 'central');
        delXText.setAttribute('class', 'mm-boundary-del-text');
        delXText.setAttribute('y', -0.5);
        delXText.textContent = '×';
        delBtnG.appendChild(delXText);

        delBtnG.addEventListener('click', (e) => {
          e.stopPropagation();
          this.deleteBoundary(bnd.id);
        });
        labelG.appendChild(delBtnG);
      }

      // Événements sur l'enclos
      bndG.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectBoundary(bnd.id);
      });

      labelG.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        if (this.isReadOnly) return;
        this.promptEditBoundaryLabel(bnd.id);
      });

      bndG.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (this.isReadOnly) return;
        this.selectBoundary(bnd.id);
        this.promptEditBoundaryLabel(bnd.id);
      });

      bndG.appendChild(labelG);
      bndLayer.appendChild(bndG);
    });
  },

  selectBoundary(bndId) {
    this.selectedBoundaryId = bndId;
    this.selectedNodeId = null;
    this.selectedRelId = null;
    this.updateSelectionState();
  },

  createBoundary(rootNodeId, label = null) {
    if (this.isReadOnly) return;
    if (!rootNodeId || rootNodeId === 'root') return;
    const node = this.findNode(rootNodeId);
    if (!node) return;

    // Si un enclos existe déjà sur cette branche, ouvrir directement l'édition
    let bnd = this.boundaries?.find(b => b.rootId === rootNodeId);
    if (bnd) {
      this.selectedBoundaryId = bnd.id;
      this.selectedNodeId = null;
      this.selectedRelId = null;
      this.updateSelectionState();
      this.promptEditBoundaryLabel(bnd.id);
      return;
    }

    const newBnd = {
      id: `bnd_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      rootId: rootNodeId,
      label: label || 'ENCLOS',
      color: node.color || '#2563eb'
    };

    if (!this.boundaries) this.boundaries = [];
    this.boundaries.push(newBnd);
    this.selectedBoundaryId = newBnd.id;
    this.selectedNodeId = null;
    this.selectedRelId = null;

    this.layoutTree();
    this.draw();
    this.syncAndAutoSave();

    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast(`Enclos créé autour de « ${node.text} »`);
    }

    this.promptEditBoundaryLabel(newBnd.id);
  },

  deleteBoundary(bndId) {
    if (this.isReadOnly) return;
    if (!this.boundaries) return;
    this.boundaries = this.boundaries.filter(b => b.id !== bndId);
    if (this.selectedBoundaryId === bndId) this.selectedBoundaryId = null;
    this.layoutTree();
    this.draw();
    this.syncAndAutoSave();
    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast('Enclos supprimé');
    }
  },

  promptEditBoundaryLabel(bndId) {
    if (this.isReadOnly) return;
    const bnd = this.boundaries?.find(b => b.id === bndId);
    if (!bnd) return;

    const rootNode = this.findNode(bnd.rootId);
    document.getElementById('mm-boundary-edit-modal')?.remove();

    const presets = [
      'ARGUMENTATION',
      'ENCLOS',
      'CONTEXTE',
      'APPLICATION',
      'EXHORTATION',
      'DOCTRINE',
      'CONCLUSION'
    ];

    const overlay = document.createElement('div');
    overlay.id = 'mm-boundary-edit-modal';
    overlay.className = 'mm-rel-modal-overlay';
    overlay.innerHTML = `
      <div class="mm-rel-modal" role="dialog" aria-modal="true">
        <div class="mm-rel-modal-title">
          <span>Enclos / Clôture</span>
          <button type="button" class="mm-modal-close-btn" id="mm-btn-close-bnd-modal" title="Fermer (Échap)">×</button>
        </div>
        <div style="font-size: 12px; color: var(--text-secondary);">
          Branche mère : <strong>${this.escapeHtml(rootNode?.text || 'Branche')}</strong>
        </div>
        <div class="mm-rel-presets">
          ${presets.map(p => `<button type="button" class="mm-rel-preset-chip" data-label="${p}">${p}</button>`).join('')}
        </div>
        <input type="text" class="mm-rel-modal-input" id="mm-bnd-input-label" value="${this.escapeHtml(bnd.label || 'ENCLOS')}" placeholder="Titre de l'enclos...">
        <div class="mm-rel-modal-actions">
          <button type="button" class="mm-rel-btn-delete" id="mm-btn-del-bnd" title="Supprimer cet enclos">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            <span>Supprimer</span>
          </button>
          <div class="mm-rel-modal-right-actions">
            <button type="button" class="mm-rel-btn-cancel" id="mm-btn-cancel-bnd">Annuler</button>
            <button type="button" class="mm-rel-btn-save" id="mm-btn-save-bnd">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              <span>Appliquer</span>
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const input = document.getElementById('mm-bnd-input-label');
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
      const val = (input?.value || '').trim().toUpperCase() || 'ENCLOS';
      bnd.label = val;
      close();
      this.layoutTree();
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

    document.getElementById('mm-btn-close-bnd-modal')?.addEventListener('click', close);
    document.getElementById('mm-btn-cancel-bnd')?.addEventListener('click', close);
    document.getElementById('mm-btn-save-bnd')?.addEventListener('click', save);
    document.getElementById('mm-btn-del-bnd')?.addEventListener('click', () => {
      close();
      this.deleteBoundary(bndId);
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });

    document.addEventListener('keydown', handleKey);
  },

  renderOutlineBoundaryPill(nodeId) {
    if (!this.boundaries || this.boundaries.length === 0) return '';
    const bnd = this.boundaries.find(b => b.rootId === nodeId);
    if (!bnd) return '';

    return `
      <span class="mm-outline-boundary-pill" data-action="edit-boundary" data-boundary-id="${bnd.id}" title="Enclos : ${this.escapeHtml(bnd.label)} (Cliquer pour modifier)">
        <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="4" stroke-dasharray="3 2"/><path d="M7 8h10"/></svg>
        <span>${this.escapeHtml(bnd.label || 'ENCLOS')}</span>
      </span>
    `;
  },

  // =========================================================================
  // MOTEUR D'EXPORTATION MIND MAP (PDF, PNG, JPG) — ZÉRO ÉMOJI, 100% SVG
  // =========================================================================

  exportModalState: {
    format: 'pdf',
    bg: 'white',
    scope: 'fit',
    scale: 2,
    pdfPage: 'a4_landscape',
    includeHeader: true
  },

  toggleExportDropdown(force) {
    const menu = document.getElementById('mm-export-menu');
    if (!menu) return;
    const shouldShow = force !== undefined ? force : menu.classList.contains('hidden');
    if (shouldShow) {
      menu.classList.remove('hidden');
    } else {
      menu.classList.add('hidden');
    }
  },

  closeExportDropdown() {
    this.toggleExportDropdown(false);
  },

  exportDirect(format) {
    this.closeExportDropdown();
    this.executeExport({
      format: format,
      bg: 'white',
      scale: format === 'pdf' ? 3 : 2,
      scope: 'fit',
      pdfPage: 'a4_landscape',
      includeHeader: true
    });
  },

  openExportModal() {
    this.closeExportDropdown();
    const modal = document.getElementById('modal-mm-export');
    if (!modal) return;

    this.exportModalState = {
      format: 'pdf',
      bg: 'white',
      scope: 'fit',
      scale: 2,
      pdfPage: 'a4_landscape',
      includeHeader: true
    };

    this.updateExportModalUI();
    modal.classList.remove('hidden');
    this.refreshExportPreview();
  },

  closeExportModal() {
    const modal = document.getElementById('modal-mm-export');
    modal?.classList.add('hidden');
  },

  updateExportModalUI() {
    const st = this.exportModalState;

    document.querySelectorAll('#mm-export-format-tabs .mm-format-tab').forEach(t => {
      t.classList.toggle('active', t.getAttribute('data-format') === st.format);
    });

    const pdfOpts = document.getElementById('mm-export-pdf-options');
    if (pdfOpts) pdfOpts.style.display = st.format === 'pdf' ? 'block' : 'none';

    document.querySelectorAll('#mm-export-bg-pills .mm-pill-btn').forEach(p => {
      p.classList.toggle('active', p.getAttribute('data-bg') === st.bg);
    });

    const transPill = document.getElementById('mm-pill-bg-transparent');
    if (transPill) {
      if (st.format === 'png') {
        transPill.removeAttribute('disabled');
        transPill.style.opacity = '1';
        transPill.style.pointerEvents = 'auto';
      } else {
        transPill.setAttribute('disabled', 'true');
        transPill.style.opacity = '0.35';
        transPill.style.pointerEvents = 'none';
      }
    }

    document.querySelectorAll('#mm-export-scope-pills .mm-pill-btn').forEach(p => {
      p.classList.toggle('active', p.getAttribute('data-scope') === st.scope);
    });

    document.querySelectorAll('#mm-export-scale-pills .mm-pill-btn').forEach(p => {
      p.classList.toggle('active', parseInt(p.getAttribute('data-scale'), 10) === st.scale);
    });

    document.querySelectorAll('#mm-export-pdf-page-pills .mm-pill-btn').forEach(p => {
      p.classList.toggle('active', p.getAttribute('data-pdf-page') === st.pdfPage);
    });

    const headerCheck = document.getElementById('mm-export-include-header');
    if (headerCheck) headerCheck.checked = st.includeHeader !== false;
  },

  getDiagramBoundingBox() {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

    // 1. Parcours géométrique analytique complet de tous les éléments du diagramme
    const traverse = (node) => {
      if (!node) return;
      const w = (node.width || 120) / 2 + 65; // Marge pour pastilles versets/notes et actions
      const h = (node.height || 36) / 2 + 25;
      minX = Math.min(minX, node.x - w);
      maxX = Math.max(maxX, node.x + w);
      minY = Math.min(minY, node.y - h);
      maxY = Math.max(maxY, node.y + h);
      if (node.children) node.children.forEach(traverse);
    };
    if (this.tree) traverse(this.tree);

    // Sujets flottants
    if (this.floatingTopics && this.floatingTopics.length > 0) {
      this.floatingTopics.forEach(ft => {
        const w = (ft.width || 120) / 2 + 65;
        const h = (ft.height || 36) / 2 + 25;
        minX = Math.min(minX, ft.x - w);
        maxX = Math.max(maxX, ft.x + w);
        minY = Math.min(minY, ft.y - h);
        maxY = Math.max(maxY, ft.y + h);
        if (ft.children) ft.children.forEach(traverse);
      });
    }

    // Enclos (Boundaries)
    if (this.boundaries && this.boundaries.length > 0) {
      this.boundaries.forEach(bnd => {
        const b = this.getBoundaryBBox(bnd);
        if (b) {
          minX = Math.min(minX, b.x - 15);
          maxX = Math.max(maxX, b.x + b.width + 15);
          minY = Math.min(minY, b.y - 25); // Marge pour l'étiquette pilule supérieure
          maxY = Math.max(maxY, b.y + b.height + 15);
        }
      });
    }

    // Liaisons (Relationships) avec courbures Bézier et étiquettes flottantes
    if (this.relationships && this.relationships.length > 0) {
      this.relationships.forEach(rel => {
        const fromNode = this.findNode(rel.fromId);
        const toNode = this.findNode(rel.toId);
        if (!fromNode || !toNode) return;
        const p1 = this.getNodeConnectionPoint(fromNode, { x: toNode.x, y: toNode.y });
        const p2 = this.getNodeConnectionPoint(toNode, { x: fromNode.x, y: fromNode.y });
        minX = Math.min(minX, p1.x, p2.x);
        maxX = Math.max(maxX, p1.x, p2.x);
        minY = Math.min(minY, p1.y, p2.y);
        maxY = Math.max(maxY, p1.y, p2.y);

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const curvature = Math.min(85, Math.max(30, dist * 0.2));
        let cx = (p1.x + p2.x) / 2 + (-dy / dist) * curvature;
        let cy = (p1.y + p2.y) / 2 + (dx / dist) * curvature;
        if (rel.customControl) {
          cx = rel.customControl.x;
          cy = rel.customControl.y;
        }
        minX = Math.min(minX, cx - 30);
        maxX = Math.max(maxX, cx + 30);
        minY = Math.min(minY, cy - 20);
        maxY = Math.max(maxY, cy + 20);

        // Étiquette pilule de la liaison
        const lx = 0.25 * p1.x + 0.5 * cx + 0.25 * p2.x;
        const ly = 0.25 * p1.y + 0.5 * cy + 0.25 * p2.y;
        const labelText = (rel.label || 'VOIR AUSSI').toUpperCase();
        const textW = this.getTextWidth(labelText, 9.5, '700');
        const pillW = Math.max(54, textW + 24);
        minX = Math.min(minX, lx - pillW / 2 - 15);
        maxX = Math.max(maxX, lx + pillW / 2 + 15);
        minY = Math.min(minY, ly - 20);
        maxY = Math.max(maxY, ly + 20);
      });
    }

    // 2. Fusion avec le BBox DOM réel si disponible
    try {
      if (this.viewportG && typeof this.viewportG.getBBox === 'function') {
        const bbox = this.viewportG.getBBox();
        if (bbox && bbox.width > 20 && bbox.height > 20 && isFinite(bbox.x) && isFinite(bbox.y)) {
          minX = Math.min(minX, bbox.x);
          maxX = Math.max(maxX, bbox.x + bbox.width);
          minY = Math.min(minY, bbox.y);
          maxY = Math.max(maxY, bbox.y + bbox.height);
        }
      }
    } catch (e) {
      // Ignorer si échec getBBox
    }

    if (!isFinite(minX) || !isFinite(maxX) || minX >= maxX) {
      minX = -200; maxX = 200;
      minY = -120; maxY = 120;
    }

    return {
      x: minX,
      y: minY,
      width: Math.max(100, maxX - minX),
      height: Math.max(80, maxY - minY)
    };
  },

  buildExportSvgString(options = {}) {
    if (!this.viewportG || !this.svg) return null;

    const scope = options.scope || 'fit';
    const bg = options.bg || 'white';
    const padding = options.padding !== undefined ? options.padding : 70;

    let exportX, exportY, exportW, exportH;

    if (scope === 'viewport') {
      const rect = this.svg.getBoundingClientRect();
      const scale = this.viewBox.scale || 1;
      exportX = -this.viewBox.x / scale;
      exportY = -this.viewBox.y / scale;
      exportW = Math.max(100, rect.width / scale);
      exportH = Math.max(100, rect.height / scale);
    } else {
      const bbox = this.getDiagramBoundingBox();
      exportX = bbox.x - padding;
      exportY = bbox.y - padding;
      exportW = bbox.width + padding * 2;
      exportH = bbox.height + padding * 2;
    }

    const cloneG = this.viewportG.cloneNode(true);

    // CRUCIAL : Supprimer le transform de navigation interactif (pan/zoom d'écran)
    // afin que les coordonnées internes du clone correspondent exactement au repère diagramme !
    cloneG.removeAttribute('transform');
    cloneG.removeAttribute('id');

    // Supprimer tous les contrôles interactifs de l'interface
    cloneG.querySelectorAll(`
      .mm-node-actions,
      .reparent-drop-target,
      #mm-connecting-preview-group,
      .mm-rel-del-btn,
      .mm-boundary-del-btn,
      .mm-rel-handle,
      .mm-root-plus,
      .mm-node-plus,
      .mm-rel-hit-path,
      .mm-rel-del-circle,
      .mm-boundary-del-circle,
      rect[fill="transparent"]
    `).forEach(el => el.remove());

    // Retirer les surbrillances de sélection
    cloneG.querySelectorAll('.selected, .mm-selected-node, .mm-selected-rel, .mm-selected-boundary').forEach(el => {
      el.classList.remove('selected', 'mm-selected-node', 'mm-selected-rel', 'mm-selected-boundary');
    });

    const bodyStyle = window.getComputedStyle(document.body);
    const themeBgCard = bodyStyle.getPropertyValue('--bg-card').trim() || '#1e293b';
    const themeBgSurface = bodyStyle.getPropertyValue('--bg-surface').trim() || bodyStyle.getPropertyValue('--bg-main').trim() || '#0f172a';
    const themeTextPrimary = bodyStyle.getPropertyValue('--text-primary').trim() || '#f8fafc';
    const themeTextSecondary = bodyStyle.getPropertyValue('--text-secondary').trim() || '#94a3b8';
    const themeBorder = bodyStyle.getPropertyValue('--border-color').trim() || '#334155';

    const isWhiteBg = (bg === 'white');
    const cardBgColor = isWhiteBg ? '#ffffff' : themeBgCard;
    const textColor = isWhiteBg ? '#0f172a' : themeTextPrimary;
    const textSecColor = isWhiteBg ? '#475569' : themeTextSecondary;
    const borderColor = isWhiteBg ? '#cbd5e1' : themeBorder;

    // Inliner explicitement styles et attributs SVG pour autonomie 100% hors DOM :

    // 1. Nœud central (Root)
    cloneG.querySelectorAll('.mm-root-rect').forEach(r => {
      r.setAttribute('fill', cardBgColor);
      r.setAttribute('stroke', '#2563eb');
      r.setAttribute('stroke-width', '3.2');
    });
    cloneG.querySelectorAll('.mm-root-text').forEach(t => {
      t.setAttribute('fill', textColor);
      t.setAttribute('font-size', '16px');
      t.setAttribute('font-weight', '900');
      t.setAttribute('letter-spacing', '0.8px');
    });

    // 2. Boîtes de branches et sujets flottants
    cloneG.querySelectorAll('.mm-branch-box, .mm-floating-box').forEach(b => {
      b.setAttribute('fill', cardBgColor);
      const curStroke = b.getAttribute('stroke');
      if (!curStroke || curStroke.includes('var(')) {
        b.setAttribute('stroke', '#2563eb');
      }
    });

    // 3. Étiquettes de liaisons (Relations) - Élimination radicale des rectangles noirs
    cloneG.querySelectorAll('.mm-rel-label-rect').forEach(rect => {
      rect.setAttribute('fill', cardBgColor);
      rect.setAttribute('stroke', borderColor);
      rect.setAttribute('stroke-width', '1.2');
    });
    cloneG.querySelectorAll('.mm-rel-label-text').forEach(t => {
      t.setAttribute('fill', textSecColor);
      t.setAttribute('font-size', '9.5px');
      t.setAttribute('font-weight', '700');
      t.setAttribute('letter-spacing', '0.4px');
    });

    // 4. Enclos (Boundaries)
    cloneG.querySelectorAll('.mm-boundary-label-pill').forEach(pill => {
      pill.setAttribute('fill', cardBgColor);
    });
    cloneG.querySelectorAll('.mm-boundary-label-text').forEach(t => {
      t.setAttribute('font-size', '9.5px');
      t.setAttribute('font-weight', '700');
    });

    // 5. Pastilles de notes
    cloneG.querySelectorAll('.mm-note-pill circle').forEach(c => {
      c.setAttribute('fill', cardBgColor);
    });

    // 6. Pastilles de versets bibliques
    cloneG.querySelectorAll('.mm-scripture-pill text').forEach(t => {
      const curFill = t.getAttribute('fill');
      if (curFill && curFill.includes('var(')) {
        t.setAttribute('fill', '#2563eb');
      }
      t.setAttribute('font-weight', '700');
    });
    cloneG.querySelectorAll('.mm-scripture-pill rect').forEach(r => {
      const curFill = r.getAttribute('fill');
      if (curFill && curFill.includes('var(')) {
        r.setAttribute('fill', '#2563eb');
      }
    });

    // 7. Tous les autres éléments texte
    cloneG.querySelectorAll('text').forEach(t => {
      const curFill = t.getAttribute('fill');
      if (!curFill || curFill.includes('var(') || curFill === 'currentColor') {
        t.setAttribute('fill', textColor);
      }
      if (!t.getAttribute('font-family')) {
        t.setAttribute('font-family', 'Inter, system-ui, -apple-system, sans-serif');
      }
    });

    // Fond SVG selon le choix de l'utilisateur
    let bgRectSvg = '';
    if (bg === 'white') {
      bgRectSvg = `<rect x="${exportX}" y="${exportY}" width="${exportW}" height="${exportH}" fill="#ffffff" />`;
    } else if (bg === 'theme') {
      bgRectSvg = `<rect x="${exportX}" y="${exportY}" width="${exportW}" height="${exportH}" fill="${themeBgSurface}" />`;
    }

    const defsEl = this.svg.querySelector('defs');
    const defsContent = defsEl ? defsEl.innerHTML : '';

    const serializer = new XMLSerializer();
    const gContent = serializer.serializeToString(cloneG);

    const svgString = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${exportX} ${exportY} ${exportW} ${exportH}" width="${Math.round(exportW)}" height="${Math.round(exportH)}">
      <defs>
        ${defsContent}
        <style>
          text { font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
          .mm-root-text { font-weight: 900 !important; font-size: 16px !important; letter-spacing: 0.8px !important; }
          .mm-branch-text { font-family: Inter, system-ui, sans-serif; }
          .mm-rel-label-rect { fill: ${cardBgColor} !important; stroke: ${borderColor} !important; stroke-width: 1.2px !important; }
          .mm-rel-label-text { font-weight: 700 !important; font-size: 9.5px !important; fill: ${textSecColor} !important; letter-spacing: 0.4px !important; }
          .mm-boundary-label-pill { fill: ${cardBgColor} !important; }
          .mm-boundary-label-text { font-weight: 700 !important; font-size: 9.5px !important; }
          .mm-root-rect { fill: ${cardBgColor} !important; stroke: #2563eb !important; stroke-width: 3.2px !important; }
          .mm-branch-box, .mm-floating-box { fill: ${cardBgColor} !important; }
          .mm-node-actions, .mm-rel-del-btn, .mm-boundary-del-btn, .mm-rel-handle, .reparent-drop-target, #mm-connecting-preview-group { display: none !important; }
        </style>
      </defs>
      ${bgRectSvg}
      ${gContent}
    </svg>`;

    return {
      svgString,
      width: exportW,
      height: exportH,
      exportX,
      exportY
    };
  },

  async renderSvgToCanvas(svgData, scale = 2) {
    const { svgString, width, height } = svgData;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    return new Promise((resolve, reject) => {
      const img = new Image();
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas);
      };
      img.onerror = (err) => {
        URL.revokeObjectURL(url);
        reject(err);
      };
      img.src = url;
    });
  },

  async refreshExportPreview() {
    const previewBox = document.getElementById('mm-export-preview-box');
    const previewImg = document.getElementById('mm-export-preview-img');
    const loadingEl = document.getElementById('mm-export-preview-loading');
    const dimEl = document.getElementById('mm-meta-dim');
    const fileEl = document.getElementById('mm-meta-filename');
    if (!previewImg) return;

    if (loadingEl) loadingEl.classList.remove('hidden');

    if (previewBox) {
      previewBox.classList.toggle('bg-theme', this.exportModalState.bg === 'theme');
      previewBox.classList.toggle('bg-transparent', this.exportModalState.bg === 'transparent');
    }

    try {
      const svgData = this.buildExportSvgString({
        scope: this.exportModalState.scope,
        bg: this.exportModalState.bg
      });

      if (svgData) {
        previewImg.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgData.svgString);

        const estW = Math.round(svgData.width * this.exportModalState.scale);
        const estH = Math.round(svgData.height * this.exportModalState.scale);
        if (dimEl) dimEl.textContent = `${estW} × ${estH} px`;

        const title = (this.currentNote?.title || 'mindmap').trim().replace(/[\/\\?%*:|"<>]/g, '_');
        if (fileEl) fileEl.textContent = `${title}.${this.exportModalState.format}`;
      }
    } catch (e) {
      console.warn('Erreur aperçu export Mind Map:', e);
    } finally {
      if (loadingEl) loadingEl.classList.add('hidden');
    }
  },

  async executeExport(options = {}) {
    const format = (options.format || 'pdf').toLowerCase();
    const scale = options.scale || (format === 'pdf' ? 3 : 2);
    const bg = options.bg || (format === 'jpg' ? 'white' : (options.bg || 'white'));
    const scope = options.scope || 'fit';

    const noteTitle = (this.currentNote?.title || 'mindmap').trim();
    const noteRef = (this.currentNote?.reference || '').trim();

    try {
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast(`Préparation de l'export ${format.toUpperCase()}…`);
      }

      const svgData = this.buildExportSvgString({ scope, bg });
      if (!svgData) {
        throw new Error("Impossible de générer le schéma vectoriel");
      }

      const canvas = await this.renderSvgToCanvas(svgData, scale);

      let dataUrl;
      let filename = noteTitle.replace(/[\/\\?%*:|"<>]/g, '_');
      if (format === 'pdf') {
        filename += '.pdf';
        dataUrl = canvas.toDataURL('image/png');
      } else if (format === 'jpg' || format === 'jpeg') {
        filename += '.jpg';
        if (bg === 'transparent') {
          const solidCanvas = document.createElement('canvas');
          solidCanvas.width = canvas.width;
          solidCanvas.height = canvas.height;
          const sCtx = solidCanvas.getContext('2d');
          sCtx.fillStyle = '#ffffff';
          sCtx.fillRect(0, 0, solidCanvas.width, solidCanvas.height);
          sCtx.drawImage(canvas, 0, 0);
          dataUrl = solidCanvas.toDataURL('image/jpeg', 0.95);
        } else {
          dataUrl = canvas.toDataURL('image/jpeg', 0.95);
        }
      } else {
        filename += '.png';
        dataUrl = canvas.toDataURL('image/png');
      }

      const pdfOptions = {
        title: noteTitle,
        reference: noteRef,
        pageFormat: options.pdfPage || 'a4_landscape',
        includeHeader: options.includeHeader !== false
      };

      const res = await API.exportMindmapFile(dataUrl, filename, format, pdfOptions);
      if (res && res.success) {
        if (typeof App !== 'undefined' && App.showToast) {
          App.showToast(`Mind Map exportée avec succès (${format.toUpperCase()}) !`);
        }
        this.closeExportModal();
      } else if (res && res.cancelled) {
        // Annulé pacifiquement par l'utilisateur
      } else {
        throw new Error(res?.error || "Erreur lors de l'export");
      }
    } catch (err) {
      console.error("Erreur export Mind Map:", err);
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast(`Erreur export : ${err.message || 'inconnue'}`, 'error');
      }
    }
  },

  toggleFullscreen(forceState) {
    const isCurrentlyFs = document.body.classList.contains('mindmap-fullscreen-active');
    const targetState = (typeof forceState === 'boolean') ? forceState : !isCurrentlyFs;

    if (targetState) {
      document.body.classList.add('mindmap-fullscreen-active');
      // Demande de plein écran physique OS si disponible
      try {
        if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().catch(() => {});
        }
      } catch (e) {}

      // Mettre à jour titre et passage dans le bandeau flottant supérieur
      const titleEl = document.getElementById('mm-fs-note-title');
      const refEl = document.getElementById('mm-fs-note-ref');
      if (titleEl) titleEl.textContent = this.currentNote?.title || 'Mind Map';
      if (refEl) {
        const ref = (this.currentNote?.reference || '').trim();
        refEl.textContent = ref ? `Passage : ${ref}` : '';
        refEl.style.display = ref ? 'inline' : 'none';
      }

      this.updateFullscreenButtons(true);
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast('Mode plein écran activé (Échap ou F11 pour quitter)');
      }
    } else {
      document.body.classList.remove('mindmap-fullscreen-active');
      // Sortie du plein écran natif système si actif
      try {
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
      } catch (e) {}

      this.updateFullscreenButtons(false);
    }

    // Recentrage doux et adaptation de l'espace de dessin
    setTimeout(() => {
      if (this.viewMode === 'map') {
        this.fitView();
      }
    }, 140);
  },

  updateFullscreenButtons(isActive) {
    // 1. Bouton de la barre supérieure de la note
    const headerBtn = document.getElementById('btn-toggle-mindmap-fullscreen');
    if (headerBtn) {
      headerBtn.classList.toggle('active', isActive);
      headerBtn.title = isActive ? 'Quitter le plein écran (Échap ou F11)' : 'Mode Plein Écran (F11 ou F)';
      headerBtn.querySelector('.icon-mm-fullscreen-enter')?.classList.toggle('hidden', isActive);
      headerBtn.querySelector('.icon-mm-fullscreen-exit')?.classList.toggle('hidden', !isActive);
    }

    // 2. Bouton du dock flottant inférieur
    const dockBtn = document.getElementById('mm-btn-fullscreen');
    if (dockBtn) {
      dockBtn.classList.toggle('active', isActive);
      dockBtn.title = isActive ? 'Quitter le plein écran (Échap ou F11)' : 'Mode Plein Écran (F11 ou F)';
      dockBtn.innerHTML = (isActive ? `
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 14h6m0 0v6m0-6L3 21m17-7h-6m0 0v6m0-6l7 7M4 10h6m0 0V4m0 6L3 3m17 7h-6m0 0V4m0 6l7-7"/>
        </svg>
      ` : `
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
        </svg>
      `) + '<span class="mm-dock-label">Plein écran</span>';
    }
  }
};
