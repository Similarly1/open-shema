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
          <button type="button" class="mm-dock-btn" id="mm-btn-styles" title="Styles de connecteurs et formes de nœuds (Alt+T)">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19h16"/><circle cx="7" cy="12" r="3"/><path d="M10 12h5"/><rect x="15" y="9" width="6" height="6" rx="1.5"/></svg>
          </button>
          <button type="button" class="mm-dock-btn" id="mm-btn-reorganize" title="Réorganiser harmonieusement la carte (Alt+R)">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>
          </button>
          <button type="button" class="mm-dock-btn" id="mm-btn-relationship" title="Créer une liaison transversale entre deux branches (Ctrl+L)">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8L22 12L18 16"/><path d="M2 12H22"/></svg>
          </button>
          <button type="button" class="mm-dock-btn" id="mm-btn-boundary" title="Créer un enclos / clôture sur la branche (Ctrl+B)">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="4" stroke-dasharray="4 3"/><path d="M7 8h10M7 12h6"/></svg>
          </button>
          <button type="button" class="mm-dock-btn" id="mm-btn-floating" title="Créer un sujet flottant indépendant (Alt+F ou Double-clic)">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="7" stroke-dasharray="3 2"/><circle cx="7.5" cy="12" r="1.5" fill="currentColor"/><line x1="11" y1="12" x2="16" y2="12"/></svg>
          </button>
          <button type="button" class="mm-dock-btn" id="mm-btn-marker" title="Marqueurs, Numéros & Priorités (1-9, P1-P4, Statuts) — Touche M">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><text x="12" y="15.5" font-size="10" font-weight="800" text-anchor="middle" fill="currentColor" stroke="none">1</text></svg>
          </button>
          <button type="button" class="mm-dock-btn" id="mm-btn-zoom-in" title="Zoom avant (Ctrl + Molette)">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
          <button type="button" class="mm-dock-btn" id="mm-btn-zoom-out" title="Zoom arrière">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
          <button type="button" class="mm-dock-btn" id="mm-btn-fit" title="Recentrer et ajuster la carte à l'écran (R)">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/></svg>
          </button>
          <button type="button" class="mm-dock-btn" id="mm-btn-theme" title="Basculer Fond Thème / Feuille Blanche">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 0 20z" fill="currentColor"/></svg>
          </button>
          <button type="button" class="mm-dock-btn" id="mm-btn-palette" title="Changer la palette de couleurs">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>
          </button>
          <button type="button" class="mm-dock-btn" id="mm-btn-export" title="Exporter la carte mentale en PDF / PNG / JPG (Ctrl+E)">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
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
              <span class="mm-style-check" data-connector-for="curve">✓</span>
            </div>

            <div class="mm-style-card" data-style-type="connector" data-value="orthogonal" title="Ligne à angle droit avec coudes arrondis">
              <div class="mm-style-card-icon">
                <svg viewBox="0 0 32 20" width="28" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                  <path d="M 3 16 L 12 16 Q 16 16, 16 12 L 16 8 Q 16 4, 20 4 L 29 4"/>
                </svg>
              </div>
              <span class="mm-style-card-name">Équerre</span>
              <span class="mm-style-check hidden" data-connector-for="orthogonal">✓</span>
            </div>

            <div class="mm-style-card" data-style-type="connector" data-value="straight" title="Ligne droite directe">
              <div class="mm-style-card-icon">
                <svg viewBox="0 0 32 20" width="28" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                  <line x1="3" y1="16" x2="29" y2="4"/>
                </svg>
              </div>
              <span class="mm-style-card-name">Droite</span>
              <span class="mm-style-check hidden" data-connector-for="straight">✓</span>
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
              <span class="mm-style-check" data-shape-for="underline">✓</span>
            </div>

            <div class="mm-style-card" data-style-type="shape" data-value="rounded-rect" title="Rectangle arrondi moderne">
              <div class="mm-style-card-icon">
                <svg viewBox="0 0 32 20" width="28" height="18" fill="none" stroke="currentColor" stroke-width="1.8">
                  <rect x="3" y="3" width="26" height="14" rx="4" fill="currentColor" fill-opacity="0.12"/>
                  <text x="16" y="12" text-anchor="middle" font-size="8" font-weight="700" fill="currentColor">ABC</text>
                </svg>
              </div>
              <span class="mm-style-card-name">Rectangle</span>
              <span class="mm-style-check hidden" data-shape-for="rounded-rect">✓</span>
            </div>

            <div class="mm-style-card" data-style-type="shape" data-value="pill" title="Capsule / Pilule">
              <div class="mm-style-card-icon">
                <svg viewBox="0 0 32 20" width="28" height="18" fill="none" stroke="currentColor" stroke-width="1.8">
                  <rect x="2" y="3" width="28" height="14" rx="7" fill="currentColor" fill-opacity="0.12"/>
                  <text x="16" y="12" text-anchor="middle" font-size="8" font-weight="700" fill="currentColor">ABC</text>
                </svg>
              </div>
              <span class="mm-style-card-name">Pilule</span>
              <span class="mm-style-check hidden" data-shape-for="pill">✓</span>
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
            <div class="mm-marker-choice" data-marker="done" style="--m-bg: #10b981;" title="Terminé / Validé"><span>✓</span></div>
            <div class="mm-marker-choice" data-marker="progress" style="--m-bg: #f59e0b;" title="En cours"><span>◐</span></div>
            <div class="mm-marker-choice" data-marker="star" style="--m-bg: #f59e0b;" title="Étoile clé"><span>★</span></div>
            <div class="mm-marker-choice" data-marker="alert" style="--m-bg: #ef4444;" title="Attention / Important"><span>!</span></div>
          </div>

          <div class="mm-marker-footer">
            <button type="button" class="mm-marker-clear-btn" data-action="clear-marker" title="Effacer le marqueur (Touche 0)">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              <span>Effacer le marqueur (0)</span>
            </button>
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
            <div style="margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--border-color); display: flex; align-items: center; justify-content: space-between;">
              <span style="font-size: 11.5px; color: var(--text-muted);">Spécification Markdown (.md)</span>
              <button type="button" class="btn-secondary" id="mm-btn-open-markdown-guide" style="font-size: 11px; padding: 4px 10px; display: inline-flex; align-items: center; gap: 5px;">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                <span>Guide Markdown</span>
              </button>
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
        this.selectedBoundaryId = null;
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
    this.svg?.addEventListener('wheel', (e) => {
      e.preventDefault();
      const activeEditor = document.querySelector('.mm-inline-editor');
      if (activeEditor) activeEditor.blur();
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
    document.getElementById('mm-btn-zoom-in')?.addEventListener('click', (e) => { e.currentTarget?.blur(); this.zoom(1.2); });
    document.getElementById('mm-btn-zoom-out')?.addEventListener('click', (e) => { e.currentTarget?.blur(); this.zoom(0.8); });
    document.getElementById('mm-btn-fit')?.addEventListener('click', (e) => { e.currentTarget?.blur(); this.fitView(); });
    document.getElementById('mm-btn-theme')?.addEventListener('click', (e) => { e.currentTarget?.blur(); this.togglePaperMode(); });
    document.getElementById('mm-btn-palette')?.addEventListener('click', (e) => { e.currentTarget?.blur(); this.cyclePalette(); });
    document.getElementById('mm-btn-export')?.addEventListener('click', (e) => { e.currentTarget?.blur(); this.openExportModal(); });
    document.getElementById('mm-btn-help')?.addEventListener('click', (e) => { e.currentTarget?.blur(); this.toggleHelpDrawer(); });
    document.getElementById('mm-btn-close-help')?.addEventListener('click', (e) => { e.currentTarget?.blur(); this.toggleHelpDrawer(false); });
    document.getElementById('mm-btn-open-markdown-guide')?.addEventListener('click', (e) => {
      e.currentTarget?.blur();
      this.toggleHelpDrawer(false);
      if (typeof SettingsView !== 'undefined' && SettingsView.openMarkdownGuideModal) {
        SettingsView.openMarkdownGuideModal('mindmap');
      }
    });

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
      } else if (e.key === 'r' || e.key === 'R') {
        this.fitView();
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
      this.showContextMenu(e.clientX, e.clientY, null);
    });

    // Double-clic sur le fond = créer un sujet flottant indépendant (style XMind)
    this.svg?.addEventListener('dblclick', (e) => {
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

  parseMarkdownToTree(title, markdownContent) {
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
    const serializeChildren = (node, indentLevel) => {
      if (!node || !node.children) return;
      for (const child of node.children) {
        const indent = '  '.repeat(indentLevel);
        const markerPart = child.marker ? ` <!-- marker: ${child.marker} -->` : '';
        const refPart = child.ref ? ` [${child.ref}]` : '';
        const notePart = child.note ? ` <!-- note: ${child.note.replace(/\r?\n/g, ' ')} -->` : '';
        md += `${indent}- ${child.text}${refPart}${notePart}${markerPart}\n`;
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

  measureNode(node) {
    if (node.isFloating) {
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

      node.contentWidth = markerW + textW + refW + noteW;
      node.width = Math.max(92, node.contentWidth + 32);
      node.height = 32;
    } else if (node.level === 0) {
      // NIVEAU 0 (Thème général / Noyau central dominant)
      const textW = this.getTextWidth(node.text, 16, '900');
      node.textWidth = textW;
      node.markerWidth = 0;
      node.width = Math.max(130, textW + 56);
      node.height = 52;
    } else if (node.level === 1) {
      // NIVEAU 1 (BOIs - Règles de Buzan : mots-clés forces, affirmé et contrasté)
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

      node.contentWidth = markerW + textW + refW + noteW;
      node.width = Math.max(96, node.contentWidth + 36);
      node.height = 36; // Plus imposant que les niveaux inférieurs (36px vs 28px/24px)
    } else if (node.level === 2) {
      // NIVEAU 2 (Sous-branches subordonnées)
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

      node.contentWidth = markerW + textW + refW + noteW;
      node.width = Math.max(82, node.contentWidth + 30);
      node.height = 28;
    } else {
      // NIVEAU 3+ (Détails fins légers)
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

      node.contentWidth = markerW + textW + refW + noteW;
      node.width = Math.max(68, node.contentWidth + 26);
      node.height = 24;
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
      sum += child.totalHeight;
    });
    const contentHeight = Math.max(node.height + 18, sum);
    const hasBoundary = this.boundaries && this.boundaries.some(b => b.rootId === node.id);
    node.boundaryTop = hasBoundary ? 42 : 0;
    node.boundaryBottom = hasBoundary ? 28 : 0;
    node.contentHeight = contentHeight;
    node.totalHeight = contentHeight + node.boundaryTop + node.boundaryBottom;
  },

  measureTopDown(node) {
    if (node.level === 0) {
      const textW = this.getTextWidth(node.text, 16, '900');
      node.textWidth = textW;
      node.markerWidth = 0;
      node.width = Math.max(130, textW + 56);
      node.height = 52;
    } else if (node.level === 1) {
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

      node.contentWidth = markerW + textW + refW + noteW;
      node.width = Math.max(96, node.contentWidth + 36);
      node.height = 36;
    } else if (node.level === 2) {
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

      node.contentWidth = markerW + textW + refW + noteW;
      node.width = Math.max(82, node.contentWidth + 30);
      node.height = 28;
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

      node.contentWidth = markerW + textW + refW + noteW;
      node.width = Math.max(68, node.contentWidth + 26);
      node.height = 24;
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
      sum += child.totalWidth;
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
      boi.x = dir * (rootW / 2 + uniformDist + boi.width / 2);
      boi.y = 0;
      this.layoutChildren(boi, side);
      return;
    }

    // Répartition verticale stricte garantissant l'absence totale de chevauchement entre sous-arbres
    const totalHeight = bois.reduce((acc, b) => acc + b.totalHeight, 0);
    let currentY = -totalHeight / 2;

    bois.forEach(boi => {
      const bTop = boi.boundaryTop || 0;
      const bBot = boi.boundaryBottom || 0;
      const cHeight = boi.contentHeight || (boi.totalHeight - bTop - bBot);

      // Centrage vertical du contenu de chaque sous-arbre dans son espace alloué dédié
      boi.y = currentY + bTop + cHeight / 2;

      // Position horizontale : garantit la distance uniforme par rapport au contour du médaillon central
      boi.x = dir * (rootW / 2 + uniformDist + boi.width / 2);

      this.layoutChildren(boi, side);
      currentY += boi.totalHeight;
    });
  },

  layoutChildren(parent, side) {
    if (!parent.children || parent.children.length === 0) return;

    const dir = side === 'right' ? 1 : -1;
    const clearHorizGap = 55; // Espace horizontal net garanti entre bord parent et bord enfant
    const childrenTotalHeight = parent.children.reduce((acc, c) => acc + c.totalHeight, 0);
    let currentY = parent.y - childrenTotalHeight / 2;

    parent.children.forEach(child => {
      const bTop = child.boundaryTop || 0;
      const bBot = child.boundaryBottom || 0;
      const cHeight = child.contentHeight || (child.totalHeight - bTop - bBot);
      const centerY = currentY + bTop + cHeight / 2;

      child.x = parent.x + dir * (parent.width / 2 + clearHorizGap + child.width / 2);
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
    this.updateStylesUI();
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

    // 1. Dessiner d'abord les enclos / clôtures en arrière-plan (au fond sous les branches et nœuds)
    this.drawBoundaries();

    // 2. Dessiner toutes les branches (courbes fluides sous le texte)
    if (this.tree) {
      this.drawBranches(this.tree);
    }
    if (this.floatingTopics && this.floatingTopics.length > 0) {
      this.floatingTopics.forEach(ft => this.drawBranches(ft));
    }

    // 3. Dessiner les liaisons transversales inter-branches (Relations style XMind)
    this.drawRelationships();

    // 4. Dessiner tous les nœuds (textes, boutons contextuels)
    if (this.tree) {
      this.drawNodes(this.tree);
    }
    if (this.floatingTopics && this.floatingTopics.length > 0) {
      this.floatingTopics.forEach(ft => this.drawNodes(ft));
    }
  },

  drawBranches(node) {
    if (!node.children || node.children.length === 0) return;

    const isBox = this.nodeShape === 'rounded-rect' || this.nodeShape === 'pill';
    const connStyle = this.connectorStyle || 'curve';
    const isRoot = node.level === 0;
    const totalChildren = node.children.length;

    node.children.forEach(child => {
      if (this.treeStructure === 'top-down') {
        let x1 = node.x;
        let y1 = isRoot ? node.y + node.height / 2 : (isBox ? node.y + (node.height || 28) / 2 : node.y + 10);

        if (isRoot && totalChildren > 1) {
          const childIdx = node.children.indexOf(child);
          const maxSpanX = Math.min((node.width || 120) * 0.7, (totalChildren - 1) * 16);
          const xStep = maxSpanX / (totalChildren - 1);
          x1 = node.x - maxSpanX / 2 + childIdx * xStep;
        }

        const x2 = child.x;
        const y2 = isBox ? child.y - (child.height || 28) / 2 : child.y + 10;

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

        if (!isBox) {
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
          const rootW = node.width || 140;
          const rootH = node.height || 46;
          const sameSideChildren = node.children
            .filter(c => (c.side || 'right') === childSide)
            .sort((a, b) => a.y - b.y);
          totalOnSide = sameSideChildren.length;
          const idxOnSide = sameSideChildren.indexOf(child);

          if (totalOnSide <= 1) {
            x1 = dir * (rootW / 2);
            y1 = 0;
          } else {
            // Répartition aérée sur 75% de la hauteur du médaillon central (évite tout faisceau serré)
            const maxSpanY = Math.min(rootH * 0.75, (totalOnSide - 1) * 8.5);
            const yStep = maxSpanY / (totalOnSide - 1);
            y1 = -maxSpanY / 2 + idxOnSide * yStep;

            // Point d'ancrage calculé précisément sur le contour arrondi du médaillon central
            const capRadius = rootH / 2;
            const flatW = rootW / 2 - capRadius;
            const capX = Math.sqrt(Math.max(0, capRadius * capRadius - y1 * y1));
            x1 = dir * (flatW + capX);
          }
        } else {
          x1 = childSide === 'right' ? node.x + node.width / 2 : node.x - node.width / 2;
          y1 = isBox ? node.y : node.y + 10;
        }

        const x2 = childSide === 'right' ? child.x - child.width / 2 : child.x + child.width / 2;
        const y2 = isBox ? child.y : child.y + 10;

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

        if (!isBox) {
          // Trait de soulignement sous le mot (Loi 7 : longueur branche = mot)
          const underX2 = childSide === 'right' ? child.x + child.width / 2 : child.x - child.width / 2;
          const underline = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          underline.setAttribute('x1', x2);
          underline.setAttribute('y1', y2);
          underline.setAttribute('x2', underX2);
          underline.setAttribute('y2', y2);
          underline.setAttribute('stroke', strokeColor);
          const underlineW = child.level === 1 ? (totalOnSide >= 4 ? 2.2 : 2.6) : (child.level === 2 ? 1.8 : 1.4);
          underline.setAttribute('stroke-width', underlineW);
          underline.setAttribute('stroke-linecap', 'round');
          this.viewportG.appendChild(underline);
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

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', `mm-node-g mm-level-${node.level} ${isRoot ? 'mm-root-node' : ''} ${isFloatingRoot ? 'mm-floating-node' : ''} ${isSelected ? 'selected' : ''} ${isConnectingSource ? 'connecting-source' : ''}`);
    g.setAttribute('transform', `translate(${node.x}, ${node.y})`);
    g.setAttribute('data-id', node.id);
    const nodeColor = node.color || (isRoot ? 'var(--accent-blue, #2563eb)' : '#3b82f6');
    g.style.setProperty('--node-color', nodeColor);

    if (isRoot) {
      // Médaillon central arrondi avec icône vectorielle noble
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', -node.width / 2);
      rect.setAttribute('y', -node.height / 2);
      rect.setAttribute('width', node.width);
      rect.setAttribute('height', node.height);
      rect.setAttribute('rx', node.height / 2);
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
      const isBox = node.isFloating || this.nodeShape === 'rounded-rect' || this.nodeShape === 'pill';
      const isPill = node.isFloating || this.nodeShape === 'pill';
      const rx = isPill ? (isLvl1 ? 18 : (isLvl2 ? 14 : 12)) : (isLvl1 ? 9 : (isLvl2 ? 6 : 4));
      const boxW = node.width;
      const boxH = node.height || (isLvl1 ? 36 : (isLvl2 ? 28 : 24));
      const strokeW = node.isFloating ? '2' : (isLvl1 ? '2.4' : (isLvl2 ? '1.5' : '1.1'));

      if (isBox) {
        // Boîte d'arrière-plan avec bordure colorée (Style XMind & Buzan : Niveau 1 plus imposant)
        const boxRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        boxRect.setAttribute('x', -boxW / 2);
        boxRect.setAttribute('y', -boxH / 2);
        boxRect.setAttribute('width', boxW);
        boxRect.setAttribute('height', boxH);
        boxRect.setAttribute('rx', rx);
        boxRect.setAttribute('class', `mm-branch-box ${node.isFloating ? 'mm-floating-box' : this.nodeShape}`);
        boxRect.setAttribute('fill', 'var(--bg-card, #ffffff)');
        boxRect.setAttribute('stroke', node.color || 'var(--accent-blue)');
        boxRect.setAttribute('stroke-width', strokeW);
        boxRect.setAttribute('filter', isSelected ? 'url(#mm-select-glow)' : 'url(#mm-glow)');
        g.appendChild(boxRect);

        // Fond teinté translucide assorti à la couleur de la branche
        const tintRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        tintRect.setAttribute('x', -boxW / 2);
        tintRect.setAttribute('y', -boxH / 2);
        tintRect.setAttribute('width', boxW);
        tintRect.setAttribute('height', boxH);
        tintRect.setAttribute('rx', rx);
        tintRect.setAttribute('fill', node.color || 'var(--accent-blue)');
        tintRect.setAttribute('opacity', node.isFloating ? '0.12' : (isLvl1 ? '0.14' : (isLvl2 ? '0.07' : '0.05')));
        g.appendChild(tintRect);
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
      hitRect.setAttribute('y', isBox ? -boxH / 2 - 4 : -18);
      hitRect.setAttribute('width', hitW);
      hitRect.setAttribute('height', isBox ? boxH + 8 : 36);
      hitRect.setAttribute('fill', 'transparent');
      hitRect.setAttribute('style', 'cursor: pointer;');
      g.appendChild(hitRect);

      // Nœud de branche : Mot-clé (Buzan : plus gros pour niveau 1, majuscules)
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('dominant-baseline', isBox ? 'central' : 'bottom');
      text.setAttribute('y', isBox ? 0 : 5);
      text.setAttribute('class', 'mm-branch-text');
      text.setAttribute('fill', 'var(--text-primary)');
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

      const displayRef = node.ref ? this.formatScripturePillRef(node.ref) : '';
      const refPillW = node.ref ? (node.refPillWidth || Math.max(38, this.getTextWidth(displayRef, 9.5, '700') + 14)) : 0;
      const notePillW = node.note ? 18 : 0;

      if (node.isFloating) {
        if (!node.marker && !node.ref && !node.note) {
          text.setAttribute('text-anchor', 'middle');
          text.setAttribute('x', 0);
        } else {
          let totalContent = textW;
          if (node.marker) totalContent += markerW;
          if (node.ref) totalContent += refPillW + 6;
          if (node.note) totalContent += notePillW + 6;

          let curX = -totalContent / 2;
          if (node.marker) {
            markerX = curX + markerHalf;
            curX += markerW;
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
        // De gauche à droite : [Marker] -> Texte -> [Ref] -> [Note]
        let totalContent = textW;
        if (node.marker) totalContent += markerW;
        if (node.ref) totalContent += refPillW + 6;
        if (node.note) totalContent += notePillW + 6;

        let curX = -totalContent / 2;
        if (node.marker) {
          markerX = curX + markerHalf;
          curX += markerW;
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
        // Branche à gauche : De gauche à droite [Note] -> [Ref] -> [Marker] -> Texte
        // L'icône de note et la pastille sont côté extérieur gauche, le texte à droite vers la branche
        let totalContent = textW;
        if (node.note) totalContent += notePillW + 6;
        if (node.ref) totalContent += refPillW + 6;
        if (node.marker) totalContent += markerW;

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
        textX = curX;
        text.setAttribute('text-anchor', 'start');
        text.setAttribute('x', textX);
        curX += textW;
      }
      g.appendChild(text);

      // Pastille Marqueur / Numéro / Priorité si présent (placé immédiatement à gauche du mot-clé)
      if (node.marker && markerX !== null) {
        const def = this.MARKER_DEFS[node.marker];
        if (def) {
          const markerG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
          markerG.setAttribute('transform', `translate(${markerX}, ${isBox ? 0 : 3})`);
          markerG.setAttribute('class', 'mm-node-marker-badge');
          markerG.setAttribute('style', 'cursor: pointer;');
          markerG.setAttribute('title', `Marqueur : ${def.label} (Cliquer pour faire défiler)`);

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
            this.cycleNodeMarker(node.id);
          });

          g.appendChild(markerG);
        }
      }

      // Pastille de référence biblique si présente
      if (node.ref && refX !== null) {
        const pillW = refPillW;
        const refG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        refG.setAttribute('transform', `translate(${refX}, ${isBox ? 0 : 3})`);
        refG.setAttribute('class', 'mm-scripture-pill');

        const refRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        refRect.setAttribute('x', -pillW / 2);
        refRect.setAttribute('y', -8);
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
      if (node.note && noteX !== null) {
        const noteG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        noteG.setAttribute('transform', `translate(${noteX}, ${isBox ? 0 : 3})`);
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

        noteG.addEventListener('mouseenter', () => this.showNoteTooltip(noteG, node.note));
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

      const actionY = isBox ? 0 : 3;
      const endX = (isTopDown || node.side === 'right') ? node.width / 2 + 14 : -node.width / 2 - 14;
      const addSubBtn = this.createActionButton('+', endX, actionY, () => this.addChildToNode(node));
      addSubBtn.setAttribute('title', 'Ajouter une sous-branche');

      const delX = (isTopDown || node.side === 'right') ? node.width / 2 + 34 : -node.width / 2 - 34;
      const delBtn = this.createActionButton('×', delX, actionY, () => this.deleteNode(node.id), true);
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
    this.viewportG?.querySelectorAll('.mm-relationship-g').forEach(el => {
      const isRelSel = el.getAttribute('data-rel-id') === this.selectedRelId;
      el.classList.toggle('selected', isRelSel);
      const handle = el.querySelector('.mm-rel-handle');
      if (handle) {
        handle.style.display = isRelSel ? 'inline' : 'none';
      }
    });
    this.viewportG?.querySelectorAll('.mm-boundary-g').forEach(el => {
      const isBndSel = el.getAttribute('data-boundary-id') === this.selectedBoundaryId;
      el.classList.toggle('selected', isBndSel);
      const delBtn = el.querySelector('.mm-boundary-del-btn');
      if (delBtn) {
        delBtn.style.display = isBndSel ? 'inline' : 'none';
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
    if (!this.selectedNodeId || this.selectedNodeId === 'root') return;
    this.deleteNode(this.selectedNodeId);
  },

  deleteNode(id) {
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
    input.className = isPaperMode ? 'mm-inline-editor paper-mode' : 'mm-inline-editor';
    input.style.position = 'fixed';
    input.style.background = 'transparent';
    if (isPaperMode) {
      input.style.color = '#0f172a';
    }
    input.style.border = 'none';
    input.style.outline = 'none';
    input.style.boxShadow = 'none';
    input.style.padding = '0';
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
    const rect = this.svg.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return;

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

    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast('✨ Carte réorganisée harmonieusement');
    }
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
    const html = `
      <div class="mm-tooltip-header">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
        <span>Note de branche</span>
      </div>
      <div class="mm-tooltip-body">${this.escapeHtml(noteText)}</div>
      <div class="mm-tooltip-hint">Cliquer ou F4 pour modifier</div>
    `;
    this.showTooltip(targetEl, html);
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

  setConnectorStyle(styleName) {
    if (!['curve', 'orthogonal', 'straight'].includes(styleName)) return;
    this.connectorStyle = styleName;
    if (this.viewMode === 'map') {
      this.draw();
    }
    this.updateStylesUI();
    this.syncAndAutoSave();

    if (typeof App !== 'undefined' && App.showToast) {
      const labels = {
        'curve': 'Branches : Courbes fluides de Bézier',
        'orthogonal': 'Branches : Angles droits (Équerre)',
        'straight': 'Branches : Lignes droites'
      };
      App.showToast(labels[styleName] || `Connecteur : ${styleName}`);
    }
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

    if (typeof App !== 'undefined' && App.showToast) {
      const labels = {
        'underline': 'Forme des nœuds : Souligné épuré',
        'rounded-rect': 'Forme des nœuds : Rectangle arrondi',
        'pill': 'Forme des nœuds : Capsule / Pilule'
      };
      App.showToast(labels[shapeName] || `Forme : ${shapeName}`);
    }
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
      // Toujours attachée au SVG, affichée dynamiquement dès que la liaison est sélectionnée
      const handleCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      handleCircle.setAttribute('cx', cx);
      handleCircle.setAttribute('cy', cy);
      handleCircle.setAttribute('r', '6.5');
      handleCircle.setAttribute('class', 'mm-rel-handle');
      handleCircle.setAttribute('fill', relColor);
      handleCircle.setAttribute('stroke', '#ffffff');
      handleCircle.setAttribute('stroke-width', '2');
      handleCircle.style.display = isSelected ? 'inline' : 'none';
      handleCircle.setAttribute('style', isSelected ? 'display: inline;' : 'display: none;');
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
      rect.setAttribute('style', 'cursor: pointer;');
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
      labelG.setAttribute('style', 'cursor: pointer;');

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

      // Bouton supprimer [×] visible au survol ou à la sélection
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

      // Événements sur l'enclos
      bndG.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectBoundary(bnd.id);
      });

      labelG.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        this.promptEditBoundaryLabel(bnd.id);
      });

      bndG.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
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

      if (this.boundaries && this.boundaries.length > 0) {
        this.boundaries.forEach(bnd => {
          const b = this.getBoundaryBBox(bnd);
          if (b) {
            minX = Math.min(minX, b.x);
            maxX = Math.max(maxX, b.x + b.width);
            minY = Math.min(minY, b.y - 14);
            maxY = Math.max(maxY, b.y + b.height);
          }
        });
      }
      if (this.floatingTopics && this.floatingTopics.length > 0) {
        this.floatingTopics.forEach(ft => {
          const w = (ft.width || 100) / 2 + 30;
          const h = (ft.height || 34) / 2 + 20;
          minX = Math.min(minX, ft.x - w);
          maxX = Math.max(maxX, ft.x + w);
          minY = Math.min(minY, ft.y - h);
          maxY = Math.max(maxY, ft.y + h);
          if (ft.children) ft.children.forEach(traverse);
        });
      }
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
    const padding = options.padding !== undefined ? options.padding : 50;

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

    // Supprimer les contrôles interactifs de l'interface
    cloneG.querySelectorAll('.mm-node-actions, .reparent-drop-target, #mm-connecting-preview-group').forEach(el => el.remove());
    cloneG.querySelectorAll('.mm-selected-node, .mm-selected-rel, .mm-selected-boundary').forEach(el => {
      el.classList.remove('mm-selected-node', 'mm-selected-rel', 'mm-selected-boundary');
    });

    const bodyStyle = window.getComputedStyle(document.body);
    const themeBgCard = bodyStyle.getPropertyValue('--bg-card').trim() || '#ffffff';
    const themeTextPrimary = bodyStyle.getPropertyValue('--text-primary').trim() || '#0f172a';

    // Inliner les styles pour autonomie totale du SVG hors DOM
    const isWhiteBg = (bg === 'white');
    cloneG.querySelectorAll('text').forEach(t => {
      const curFill = t.getAttribute('fill');
      if (!curFill || curFill.includes('var(') || curFill === 'currentColor') {
        t.setAttribute('fill', isWhiteBg ? '#0f172a' : themeTextPrimary);
      }
      if (!t.getAttribute('font-family')) {
        t.setAttribute('font-family', 'Inter, system-ui, -apple-system, sans-serif');
      }
    });

    cloneG.querySelectorAll('.mm-node-box').forEach(b => {
      const curFill = b.getAttribute('fill');
      if (!curFill || curFill.includes('var(')) {
        b.setAttribute('fill', isWhiteBg ? '#ffffff' : themeBgCard);
      }
    });

    cloneG.querySelectorAll('.mm-scripture-pill circle, .mm-note-pill circle').forEach(c => {
      const curFill = c.getAttribute('fill');
      if (!curFill || curFill.includes('var(')) {
        c.setAttribute('fill', isWhiteBg ? '#f8fafc' : themeBgCard);
      }
    });

    // Fond SVG selon choix
    let bgRectSvg = '';
    if (bg === 'white') {
      bgRectSvg = `<rect x="${exportX}" y="${exportY}" width="${exportW}" height="${exportH}" fill="#ffffff" />`;
    } else if (bg === 'theme') {
      const themeBg = bodyStyle.getPropertyValue('--bg-surface').trim() || bodyStyle.getPropertyValue('--bg-main').trim() || '#0f172a';
      bgRectSvg = `<rect x="${exportX}" y="${exportY}" width="${exportW}" height="${exportH}" fill="${themeBg}" />`;
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
          .mm-node-text { font-weight: 700; }
          .mm-central-node-text { font-weight: 800; }
          .mm-node-actions { display: none !important; }
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
  }
};
