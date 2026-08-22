import os

css_path = os.path.join(os.path.dirname(__file__), "..", "web", "css", "logos.css")

with open(css_path, 'rb') as f:
    content = f.read()

# Clean null bytes
clean_text = content.replace(b'\x00', b'').decode('utf-8', errors='ignore')

pos = clean_text.find('/* HIGHLIGHTER REALISTIC STYLES')
if pos != -1:
    clean_text = clean_text[:pos]

# Also check for any earlier partial headers
pos2 = clean_text.find('/* ========================================================================= */\n/* HIGHLIGHTER')
if pos2 != -1:
    clean_text = clean_text[:pos2]

highlighter_css = """
/* ========================================================================= */
/* HIGHLIGHTER REALISTIC STYLES (Style Logos)                                */
/* ========================================================================= */

.hl-felt-yellow {
  background: linear-gradient(104deg, rgba(253, 224, 71, 0.88) 0%, rgba(254, 240, 138, 0.65) 15%, rgba(254, 240, 138, 0.60) 85%, rgba(253, 224, 71, 0.78) 100%) !important;
}
.hl-felt-green {
  background: linear-gradient(104deg, rgba(134, 239, 172, 0.88) 0%, rgba(187, 247, 208, 0.65) 15%, rgba(187, 247, 208, 0.60) 85%, rgba(134, 239, 172, 0.78) 100%) !important;
}
.hl-felt-blue {
  background: linear-gradient(104deg, rgba(125, 211, 252, 0.88) 0%, rgba(186, 230, 253, 0.65) 15%, rgba(186, 230, 253, 0.60) 85%, rgba(125, 211, 252, 0.78) 100%) !important;
}
.hl-felt-amber {
  background: linear-gradient(104deg, rgba(253, 186, 116, 0.88) 0%, rgba(254, 215, 170, 0.65) 15%, rgba(254, 215, 170, 0.60) 85%, rgba(253, 186, 116, 0.78) 100%) !important;
}
.hl-felt-purple {
  background: linear-gradient(104deg, rgba(216, 180, 254, 0.88) 0%, rgba(233, 213, 255, 0.65) 15%, rgba(233, 213, 255, 0.60) 85%, rgba(216, 180, 254, 0.78) 100%) !important;
}
.hl-felt-rose {
  background: linear-gradient(104deg, rgba(253, 164, 175, 0.88) 0%, rgba(254, 205, 211, 0.65) 15%, rgba(254, 205, 211, 0.60) 85%, rgba(253, 164, 175, 0.78) 100%) !important;
}

.hl-felt-yellow, .hl-felt-green, .hl-felt-blue, .hl-felt-amber, .hl-felt-purple, .hl-felt-rose {
  mix-blend-mode: multiply;
  border-radius: 2px 4px 3px 5px / 4px 2px 5px 3px;
  padding: 1px 3px;
  margin: 0 -1px;
  -webkit-box-decoration-break: clone;
  box-decoration-break: clone;
  display: inline;
}

/* Style Souligné Épais Feutre */
.hl-underline-yellow { border-bottom: 3px solid #EAB308 !important; padding-bottom: 1px; }
.hl-underline-green { border-bottom: 3px solid #22C55E !important; padding-bottom: 1px; }
.hl-underline-blue { border-bottom: 3px solid #0EA5E9 !important; padding-bottom: 1px; }
.hl-underline-amber { border-bottom: 3px solid #F97316 !important; padding-bottom: 1px; }
.hl-underline-purple { border-bottom: 3px solid #A855F7 !important; padding-bottom: 1px; }
.hl-underline-rose { border-bottom: 3px solid #F43F5E !important; padding-bottom: 1px; }

/* Adaptation Thème Sombre */
[data-theme="dark"] .hl-felt-yellow { background: linear-gradient(104deg, rgba(202, 138, 4, 0.45) 0%, rgba(161, 98, 7, 0.35) 100%) !important; mix-blend-mode: screen; }
[data-theme="dark"] .hl-felt-green { background: linear-gradient(104deg, rgba(22, 163, 74, 0.45) 0%, rgba(21, 128, 61, 0.35) 100%) !important; mix-blend-mode: screen; }
[data-theme="dark"] .hl-felt-blue { background: linear-gradient(104deg, rgba(2, 132, 199, 0.45) 0%, rgba(3, 105, 161, 0.35) 100%) !important; mix-blend-mode: screen; }
[data-theme="dark"] .hl-felt-amber { background: linear-gradient(104deg, rgba(234, 88, 12, 0.45) 0%, rgba(194, 65, 12, 0.35) 100%) !important; mix-blend-mode: screen; }
[data-theme="dark"] .hl-felt-purple { background: linear-gradient(104deg, rgba(147, 51, 234, 0.45) 0%, rgba(126, 34, 206, 0.35) 100%) !important; mix-blend-mode: screen; }
[data-theme="dark"] .hl-felt-rose { background: linear-gradient(104deg, rgba(225, 29, 72, 0.45) 0%, rgba(190, 18, 60, 0.35) 100%) !important; mix-blend-mode: screen; }

/* Note liée au surlignage */
.hl-has-note {
  border-bottom: 2px dotted rgba(0, 0, 0, 0.5) !important;
}
[data-theme="dark"] .hl-has-note {
  border-bottom: 2px dotted rgba(255, 255, 255, 0.6) !important;
}

/* Couleurs des pastilles */
.hl-bg-yellow { background-color: #FACC15 !important; }
.hl-bg-green { background-color: #4ADE80 !important; }
.hl-bg-blue { background-color: #38BDF8 !important; }
.hl-bg-amber { background-color: #FB923C !important; }
.hl-bg-purple { background-color: #C084FC !important; }
.hl-bg-rose { background-color: #FB7185 !important; }

/* Palette Flottante au-dessus de la sélection */
.hl-palette {
  position: fixed;
  z-index: 10000;
  background: var(--bg-primary, #ffffff);
  border: 1px solid var(--border-color, #e2e8f0);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
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
  border-color: rgba(0,0,0,0.25);
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

/* Mode stylo actif sur body */
.hl-pen-mode-active .reader-container,
.hl-pen-mode-active .verse-item,
.hl-pen-mode-active .word-token {
  cursor: crosshair !important;
}

/* Pastilles dans le Popover supérieur */
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

/* Row de surlignage dans le Menu Contextuel */
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
    f.write(clean_text.rstrip() + '\n\n' + highlighter_css.strip() + '\n')

print('Cleaned and saved logos.css successfully!')
