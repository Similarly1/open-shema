import os

css_path = os.path.join(os.path.dirname(__file__), "..", "web", "css", "logos.css")

with open(css_path, 'r', encoding='utf-8') as f:
    text = f.read()

# Cut off before highlighter section
pos = text.find('/* ========================================================================= */\n/* HIGHLIGHTER REALISTIC STYLES')
if pos != -1:
    text = text[:pos]

highlighter_css = """
/* ========================================================================= */
/* HIGHLIGHTER REALISTIC STYLES (Style Logos - Feutre Organique Haute Fidélité) */
/* ========================================================================= */

/* Rendu continu sur le verset entier sans séparation de mots */
.verse-item.hl-felt-yellow,
.verse-item.hl-felt-green,
.verse-item.hl-felt-blue,
.verse-item.hl-felt-amber,
.verse-item.hl-felt-purple,
.verse-item.hl-felt-rose,
.verse-item.hl-underline-yellow,
.verse-item.hl-underline-green,
.verse-item.hl-underline-blue,
.verse-item.hl-underline-amber,
.verse-item.hl-underline-purple,
.verse-item.hl-underline-rose {
  display: inline;
  padding: 3px 6px 3px 4px !important;
  margin: 0 -2px !important;
  border-radius: 4px 8px 3px 7px / 7px 3px 8px 4px !important;
  -webkit-box-decoration-break: clone !important;
  box-decoration-break: clone !important;
  transition: background 0.2s ease, color 0.2s ease;
}

/* Annuler tout background parasite sur les word-tokens individuels d'un verset surligné */
.verse-item[class*="hl-"] .word-token {
  background: transparent !important;
  color: inherit !important;
  padding: 0 !important;
  margin: 0 !important;
}

/* 1. THÈME CLAIR (Mode normal, blanc ou sépia) */
.hl-felt-yellow {
  background: linear-gradient(104deg, rgba(250, 204, 21, 0.82) 0%, rgba(254, 240, 138, 0.60) 12%, rgba(254, 240, 138, 0.52) 86%, rgba(250, 204, 21, 0.72) 100%) !important;
  color: #111827 !important;
  mix-blend-mode: multiply;
}
.hl-felt-green {
  background: linear-gradient(104deg, rgba(74, 222, 128, 0.82) 0%, rgba(187, 247, 208, 0.60) 12%, rgba(187, 247, 208, 0.52) 86%, rgba(74, 222, 128, 0.72) 100%) !important;
  color: #111827 !important;
  mix-blend-mode: multiply;
}
.hl-felt-blue {
  background: linear-gradient(104deg, rgba(56, 189, 248, 0.82) 0%, rgba(186, 230, 253, 0.60) 12%, rgba(186, 230, 253, 0.52) 86%, rgba(56, 189, 248, 0.72) 100%) !important;
  color: #111827 !important;
  mix-blend-mode: multiply;
}
.hl-felt-amber {
  background: linear-gradient(104deg, rgba(251, 146, 60, 0.82) 0%, rgba(254, 215, 170, 0.62) 12%, rgba(254, 215, 170, 0.54) 86%, rgba(251, 146, 60, 0.72) 100%) !important;
  color: #111827 !important;
  mix-blend-mode: multiply;
}
.hl-felt-purple {
  background: linear-gradient(104deg, rgba(192, 132, 252, 0.82) 0%, rgba(233, 213, 255, 0.62) 12%, rgba(233, 213, 255, 0.54) 86%, rgba(192, 132, 252, 0.72) 100%) !important;
  color: #111827 !important;
  mix-blend-mode: multiply;
}
.hl-felt-rose {
  background: linear-gradient(104deg, rgba(251, 113, 133, 0.82) 0%, rgba(254, 205, 211, 0.62) 12%, rgba(254, 205, 211, 0.54) 86%, rgba(251, 113, 133, 0.72) 100%) !important;
  color: #111827 !important;
  mix-blend-mode: multiply;
}

/* 2. THÈME SOMBRE (body.theme-dark, body.reading-bg-dark) */
body.theme-dark .hl-felt-yellow,
body.reading-bg-dark .hl-felt-yellow {
  background: linear-gradient(104deg, rgba(250, 204, 21, 0.48) 0%, rgba(234, 179, 8, 0.30) 12%, rgba(234, 179, 8, 0.22) 86%, rgba(250, 204, 21, 0.40) 100%) !important;
  color: #FEF9C3 !important;
  mix-blend-mode: normal !important;
  box-shadow: 0 0 12px rgba(250, 204, 21, 0.12);
}
body.theme-dark .hl-felt-green,
body.reading-bg-dark .hl-felt-green {
  background: linear-gradient(104deg, rgba(74, 222, 128, 0.45) 0%, rgba(34, 197, 94, 0.28) 12%, rgba(34, 197, 94, 0.20) 86%, rgba(74, 222, 128, 0.38) 100%) !important;
  color: #DCFCE7 !important;
  mix-blend-mode: normal !important;
  box-shadow: 0 0 12px rgba(74, 222, 128, 0.12);
}
body.theme-dark .hl-felt-blue,
body.reading-bg-dark .hl-felt-blue {
  background: linear-gradient(104deg, rgba(56, 189, 248, 0.48) 0%, rgba(14, 165, 233, 0.28) 12%, rgba(14, 165, 233, 0.20) 86%, rgba(56, 189, 248, 0.40) 100%) !important;
  color: #E0F2FE !important;
  mix-blend-mode: normal !important;
  box-shadow: 0 0 12px rgba(56, 189, 248, 0.12);
}
body.theme-dark .hl-felt-amber,
body.reading-bg-dark .hl-felt-amber {
  background: linear-gradient(104deg, rgba(251, 146, 60, 0.48) 0%, rgba(249, 115, 22, 0.28) 12%, rgba(249, 115, 22, 0.20) 86%, rgba(251, 146, 60, 0.40) 100%) !important;
  color: #FFEDD5 !important;
  mix-blend-mode: normal !important;
  box-shadow: 0 0 12px rgba(251, 146, 60, 0.12);
}
body.theme-dark .hl-felt-purple,
body.reading-bg-dark .hl-felt-purple {
  background: linear-gradient(104deg, rgba(192, 132, 252, 0.48) 0%, rgba(168, 85, 247, 0.28) 12%, rgba(168, 85, 247, 0.20) 86%, rgba(192, 132, 252, 0.40) 100%) !important;
  color: #F3E8FF !important;
  mix-blend-mode: normal !important;
  box-shadow: 0 0 12px rgba(192, 132, 252, 0.12);
}
body.theme-dark .hl-felt-rose,
body.reading-bg-dark .hl-felt-rose {
  background: linear-gradient(104deg, rgba(251, 113, 133, 0.48) 0%, rgba(244, 63, 94, 0.28) 12%, rgba(244, 63, 94, 0.20) 86%, rgba(251, 113, 133, 0.40) 100%) !important;
  color: #FFE4E6 !important;
  mix-blend-mode: normal !important;
  box-shadow: 0 0 12px rgba(251, 113, 133, 0.12);
}

/* 3. STYLE SOULIGNÉ FEUTRE (Trait Biseauté Texturé) */
.hl-underline-yellow { border-bottom: 3.5px solid #EAB308 !important; }
.hl-underline-green { border-bottom: 3.5px solid #22C55E !important; }
.hl-underline-blue { border-bottom: 3.5px solid #0EA5E9 !important; }
.hl-underline-amber { border-bottom: 3.5px solid #F97316 !important; }
.hl-underline-purple { border-bottom: 3.5px solid #A855F7 !important; }
.hl-underline-rose { border-bottom: 3.5px solid #F43F5E !important; }

/* 4. NOTE LIÉE AU SURLIGNAGE (Indicateur discret) */
.hl-has-note {
  border-bottom: 2px dashed rgba(0, 0, 0, 0.4) !important;
}
body.theme-dark .hl-has-note,
body.reading-bg-dark .hl-has-note {
  border-bottom: 2px dashed rgba(255, 255, 255, 0.5) !important;
}

/* 5. PASTILLES DE COULEUR DANS L'INTERFACE */
.hl-bg-yellow { background-color: #FACC15 !important; }
.hl-bg-green { background-color: #4ADE80 !important; }
.hl-bg-blue { background-color: #38BDF8 !important; }
.hl-bg-amber { background-color: #FB923C !important; }
.hl-bg-purple { background-color: #C084FC !important; }
.hl-bg-rose { background-color: #FB7185 !important; }

/* 6. PALETTE FLOTTANTE AU-DESSUS DE LA SÉLECTION */
.hl-palette {
  position: fixed;
  z-index: 10000;
  background: var(--bg-primary, #ffffff);
  border: 1px solid var(--border-color, #e2e8f0);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
  border-radius: 20px;
  padding: 5px 8px;
  display: flex;
  align-items: center;
  gap: 4px;
  animation: palettePop 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
.hl-palette.hidden {
  display: none !important;
}

@keyframes palettePop {
  0% { transform: scale(0.9) translateY(6px); opacity: 0; }
  100% { transform: scale(1) translateY(0); opacity: 1; }
}

.hl-palette-colors {
  display: flex;
  align-items: center;
  gap: 5px;
}

.hl-color-btn {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: transform 0.1s, border-color 0.1s;
}
.hl-color-btn:hover {
  transform: scale(1.2);
  border-color: rgba(255, 255, 255, 0.6);
}

.hl-divider {
  width: 1px;
  height: 16px;
  background: var(--border-color, #cbd5e1);
  margin: 0 4px;
}

.hl-action-btn {
  background: none;
  border: none;
  color: var(--text-secondary, #64748b);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.hl-action-btn:hover {
  background: var(--bg-hover, #f1f5f9);
  color: var(--accent-blue, #2563eb);
}
#hl-btn-erase:hover {
  color: var(--accent-red, #ef4444);
}

/* 7. MODE STYLO ACTIF */
.hl-pen-mode-active .reader-container,
.hl-pen-mode-active .verse-item,
.hl-pen-mode-active .word-token {
  cursor: crosshair !important;
}

/* 8. PASTILLES DANS LE POPOVER SUPÉRIEUR */
.hl-swatch-picker {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: transform 0.1s, border-color 0.1s;
}
.hl-swatch-picker:hover {
  transform: scale(1.1);
}
.hl-swatch-picker.active {
  border-color: var(--accent-blue, #2563eb);
  box-shadow: 0 0 0 2px var(--bg-primary, #ffffff), 0 0 0 4px var(--accent-blue, #2563eb);
}

/* 9. ROW DE SURLIGNAGE DANS LE MENU CONTEXTUEL */
.scm-highlight-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px 8px 12px;
  border-bottom: 1px solid var(--border-color, #e2e8f0);
  background: var(--bg-subtle, #f8fafc);
  gap: 8px;
}

.scm-hl-title {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-secondary, #64748b);
  display: flex;
  align-items: center;
  gap: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.scm-hl-swatches {
  display: flex;
  align-items: center;
  gap: 5px;
}

.scm-swatch-btn {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 1px solid rgba(0,0,0,0.12);
  cursor: pointer;
  transition: transform 0.1s;
}
.scm-swatch-btn:hover {
  transform: scale(1.2);
}

.scm-erase-btn {
  background: none;
  border: 1px dashed var(--border-color, #cbd5e1);
  color: var(--text-muted, #94a3b8);
  font-size: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.scm-erase-btn:hover {
  border-color: var(--accent-red, #ef4444);
  color: var(--accent-red, #ef4444);
}
"""

with open(css_path, 'w', encoding='utf-8') as f:
    f.write(text.rstrip() + '\n\n' + highlighter_css.strip() + '\n')

print('Updated logos.css with continuous realistic highlighter styles!')
