import os

css_path = os.path.join(os.path.dirname(__file__), "..", "web", "css", "logos.css")

with open(css_path, 'r', encoding='utf-8') as f:
    text = f.read()

# Cut off before highlighter css
pos = text.find('/* ========================================================================= */\n/* HIGHLIGHTER REALISTIC STYLES')
if pos != -1:
    text = text[:pos]

highlighter_css = """
/* ========================================================================= */
/* HIGHLIGHTER REALISTIC STYLES (Style Logos - Adapté Thème Clair & Sombre) */
/* ========================================================================= */

/* 1. THÈME CLAIR (Mode normal ou blanc pur) */
.hl-felt-yellow {
  background: rgba(253, 224, 71, 0.55) !important;
  color: #1a1a1a !important;
  mix-blend-mode: multiply;
}
.hl-felt-green {
  background: rgba(134, 239, 172, 0.55) !important;
  color: #1a1a1a !important;
  mix-blend-mode: multiply;
}
.hl-felt-blue {
  background: rgba(125, 211, 252, 0.55) !important;
  color: #1a1a1a !important;
  mix-blend-mode: multiply;
}
.hl-felt-amber {
  background: rgba(253, 186, 116, 0.60) !important;
  color: #1a1a1a !important;
  mix-blend-mode: multiply;
}
.hl-felt-purple {
  background: rgba(216, 180, 254, 0.60) !important;
  color: #1a1a1a !important;
  mix-blend-mode: multiply;
}
.hl-felt-rose {
  background: rgba(253, 164, 175, 0.60) !important;
  color: #1a1a1a !important;
  mix-blend-mode: multiply;
}

.hl-felt-yellow, .hl-felt-green, .hl-felt-blue, .hl-felt-amber, .hl-felt-purple, .hl-felt-rose {
  border-radius: 3px;
  padding: 2px 2px;
  -webkit-box-decoration-break: clone;
  box-decoration-break: clone;
  box-shadow: 0 0 1px rgba(0,0,0,0.05);
}

/* 2. THÈME SOMBRE (body.theme-dark, body.reading-bg-dark) */
body.theme-dark .hl-felt-yellow,
body.reading-bg-dark .hl-felt-yellow {
  background: rgba(234, 179, 8, 0.28) !important;
  color: #FEF9C3 !important;
  mix-blend-mode: normal !important;
  box-shadow: 0 0 0 1px rgba(234, 179, 8, 0.25);
}
body.theme-dark .hl-felt-green,
body.reading-bg-dark .hl-felt-green {
  background: rgba(34, 197, 94, 0.26) !important;
  color: #DCFCE7 !important;
  mix-blend-mode: normal !important;
  box-shadow: 0 0 0 1px rgba(34, 197, 94, 0.25);
}
body.theme-dark .hl-felt-blue,
body.reading-bg-dark .hl-felt-blue {
  background: rgba(14, 165, 233, 0.28) !important;
  color: #E0F2FE !important;
  mix-blend-mode: normal !important;
  box-shadow: 0 0 0 1px rgba(14, 165, 233, 0.25);
}
body.theme-dark .hl-felt-amber,
body.reading-bg-dark .hl-felt-amber {
  background: rgba(249, 115, 22, 0.28) !important;
  color: #FFEDD5 !important;
  mix-blend-mode: normal !important;
  box-shadow: 0 0 0 1px rgba(249, 115, 22, 0.25);
}
body.theme-dark .hl-felt-purple,
body.reading-bg-dark .hl-felt-purple {
  background: rgba(168, 85, 247, 0.28) !important;
  color: #F3E8FF !important;
  mix-blend-mode: normal !important;
  box-shadow: 0 0 0 1px rgba(168, 85, 247, 0.25);
}
body.theme-dark .hl-felt-rose,
body.reading-bg-dark .hl-felt-rose {
  background: rgba(244, 63, 94, 0.28) !important;
  color: #FFE4E6 !important;
  mix-blend-mode: normal !important;
  box-shadow: 0 0 0 1px rgba(244, 63, 94, 0.25);
}

/* 3. STYLE SOULIGNÉ FEUTRE */
.hl-underline-yellow { border-bottom: 3px solid #EAB308 !important; padding-bottom: 1px; }
.hl-underline-green { border-bottom: 3px solid #22C55E !important; padding-bottom: 1px; }
.hl-underline-blue { border-bottom: 3px solid #0EA5E9 !important; padding-bottom: 1px; }
.hl-underline-amber { border-bottom: 3px solid #F97316 !important; padding-bottom: 1px; }
.hl-underline-purple { border-bottom: 3px solid #A855F7 !important; padding-bottom: 1px; }
.hl-underline-rose { border-bottom: 3px solid #F43F5E !important; padding-bottom: 1px; }

/* 4. NOTE LIÉE AU SURLIGNAGE */
.hl-has-note {
  text-decoration: underline dotted 2px rgba(0, 0, 0, 0.5) !important;
}
body.theme-dark .hl-has-note,
body.reading-bg-dark .hl-has-note {
  text-decoration: underline dotted 2px rgba(255, 255, 255, 0.6) !important;
}

/* 5. COULEURS DES PASTILLES (UI) */
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

print('Updated logos.css with dark mode fix successfully!')
