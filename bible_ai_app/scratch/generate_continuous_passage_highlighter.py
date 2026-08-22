import os
import urllib.parse

def make_svg_marker(color_start, color_mid, color_end, mode="single", opacity=0.75):
    """
    mode:
      - 'single': rounded start, wavy top/bottom, rounded end
      - 'start':  rounded start, wavy top/bottom, flat straight right
      - 'mid':    flat straight left, wavy top/bottom, flat straight right
      - 'end':    flat straight left, wavy top/bottom, rounded end
    """
    # Base wavy top and bottom coordinates
    if mode == "single":
        path_d = "M 4,7 Q 28,3 58,6 Q 98,2 138,5 Q 172,3 196,6 C 201,11 201,21 196,26 Q 165,30 128,27 Q 85,30 48,27 Q 22,29 4,25 C -1,20 -1,12 4,7 Z"
    elif mode == "start":
        path_d = "M 4,7 Q 28,3 58,6 Q 98,2 138,5 Q 172,3 200,5 L 200,27 Q 165,30 128,27 Q 85,30 48,27 Q 22,29 4,25 C -1,20 -1,12 4,7 Z"
    elif mode == "mid":
        path_d = "M 0,5 Q 38,2 78,5 Q 120,2 160,5 Q 185,3 200,5 L 200,27 Q 165,30 125,27 Q 75,30 35,27 L 0,27 Z"
    elif mode == "end":
        path_d = "M 0,5 Q 38,2 78,5 Q 120,2 160,5 Q 172,3 196,6 C 201,11 201,21 196,26 Q 165,30 128,27 Q 85,30 35,27 L 0,27 Z"
    else:
        path_d = "M 4,7 Q 28,3 58,6 Q 98,2 138,5 Q 172,3 196,6 C 201,11 201,21 196,26 Q 165,30 128,27 Q 85,30 48,27 Q 22,29 4,25 C -1,20 -1,12 4,7 Z"

    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 32" preserveAspectRatio="none">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="{color_start}" stop-opacity="{min(1.0, opacity + 0.12):.2f}"/>
      <stop offset="12%" stop-color="{color_mid}" stop-opacity="{opacity:.2f}"/>
      <stop offset="88%" stop-color="{color_mid}" stop-opacity="{max(0.1, opacity - 0.05):.2f}"/>
      <stop offset="100%" stop-color="{color_end}" stop-opacity="{min(1.0, opacity + 0.08):.2f}"/>
    </linearGradient>
  </defs>
  <path d="{path_d}" fill="url(#g)"/>
</svg>'''
    clean_svg = "".join([line.strip() for line in svg.split("\n")])
    encoded = urllib.parse.quote(clean_svg)
    return f'url("data:image/svg+xml,{encoded}")'

# Couleurs Thème Clair
light_colors = {
    "yellow": ("#FACC15", "#FEF08A", "#EAB308", 0.72),
    "green":  ("#4ADE80", "#BBF7D0", "#22C55E", 0.72),
    "blue":   ("#38BDF8", "#BAE6FD", "#0EA5E9", 0.72),
    "amber":  ("#FB923C", "#FED7AA", "#F97316", 0.72),
    "purple": ("#C084FC", "#E9D5FF", "#A855F7", 0.72),
    "rose":   ("#FB7185", "#FECDD3", "#F43F5E", 0.72),
}

# Couleurs Thème Sombre
dark_colors = {
    "yellow": ("#FACC15", "#EAB308", "#CA8A04", 0.42),
    "green":  ("#4ADE80", "#22C55E", "#16A34A", 0.40),
    "blue":   ("#38BDF8", "#0EA5E9", "#0284C7", 0.42),
    "amber":  ("#FB923C", "#F97316", "#EA580C", 0.42),
    "purple": ("#C084FC", "#A855F7", "#9333EA", 0.42),
    "rose":   ("#FB7185", "#F43F5E", "#E11D48", 0.42),
}

css_lines = [
    "/* ========================================================================= */",
    "/* HIGHLIGHTER REALISTIC MULTI-VERSE CONTINUOUS STYLES (Style Logos)         */",
    "/* ========================================================================= */",
    "",
    "/* Base commune pour tous les versets surlignés */",
    ".verse-item[class*=\"hl-felt-\"] {",
    "  display: inline;",
    "  background-size: 100% 100% !important;",
    "  background-repeat: no-repeat !important;",
    "  -webkit-box-decoration-break: clone !important;",
    "  box-decoration-break: clone !important;",
    "  transition: background 0.15s ease, color 0.15s ease;",
    "}",
    "",
    "/* Verset isolé (Single) */",
    ".verse-item[class*=\"hl-felt-\"]:not(.hl-range-start):not(.hl-range-mid):not(.hl-range-end),",
    ".verse-item.hl-range-single {",
    "  padding: 3px 6px 4px 5px !important;",
    "  margin: 0 -2px !important;",
    "  border-radius: 4px 8px 3px 7px / 7px 3px 8px 4px !important;",
    "}",
    "",
    "/* Début d'un passage multi-versets (Start) */",
    ".verse-item.hl-range-start {",
    "  padding: 3px 0px 4px 5px !important;",
    "  margin: 0 0 0 -2px !important;",
    "  border-radius: 4px 0 0 7px / 7px 0 0 4px !important;",
    "}",
    "",
    "/* Milieu d'un passage multi-versets (Mid) */",
    ".verse-item.hl-range-mid {",
    "  padding: 3px 0px 4px 0px !important;",
    "  margin: 0 !important;",
    "  border-radius: 0 !important;",
    "}",
    "",
    "/* Fin d'un passage multi-versets (End) */",
    ".verse-item.hl-range-end {",
    "  padding: 3px 6px 4px 0px !important;",
    "  margin: 0 -2px 0 0 !important;",
    "  border-radius: 0 8px 3px 0 / 0 3px 8px 0 !important;",
    "}",
    "",
    "/* Annuler tout fond parasite sur les word-tokens individuels d'un verset surligné */",
    ".verse-item[class*=\"hl-\"] .word-token {",
    "  background: transparent !important;",
    "  color: inherit !important;",
    "  padding: 0 !important;",
    "  margin: 0 !important;",
    "}",
    "",
    "/* 1. THÈME CLAIR (Mode normal, blanc ou sépia) */"
]

for name, (c_start, c_mid, c_end, op) in light_colors.items():
    bg_single = make_svg_marker(c_start, c_mid, c_end, "single", opacity=op)
    bg_start  = make_svg_marker(c_start, c_mid, c_end, "start",  opacity=op)
    bg_mid    = make_svg_marker(c_mid,   c_mid, c_mid, "mid",    opacity=op)
    bg_end    = make_svg_marker(c_mid,   c_mid, c_end, "end",    opacity=op)

    css_lines.extend([
        f".hl-felt-{name} {{",
        f"  background-image: {bg_single} !important;",
        f"  color: #0f172a !important;",
        f"  mix-blend-mode: multiply;",
        f"}}",
        f".hl-felt-{name}.hl-range-start {{ background-image: {bg_start} !important; }}",
        f".hl-felt-{name}.hl-range-mid   {{ background-image: {bg_mid}   !important; }}",
        f".hl-felt-{name}.hl-range-end   {{ background-image: {bg_end}   !important; }}",
    ])

css_lines.extend([
    "",
    "/* 2. THÈME SOMBRE (body.theme-dark, body.reading-bg-dark) */"
])

for name, (c_start, c_mid, c_end, op) in dark_colors.items():
    bg_single = make_svg_marker(c_start, c_mid, c_end, "single", opacity=op)
    bg_start  = make_svg_marker(c_start, c_mid, c_end, "start",  opacity=op)
    bg_mid    = make_svg_marker(c_mid,   c_mid, c_mid, "mid",    opacity=op)
    bg_end    = make_svg_marker(c_mid,   c_mid, c_end, "end",    opacity=op)

    text_color = {
        "yellow": "#FEF9C3",
        "green":  "#DCFCE7",
        "blue":   "#E0F2FE",
        "amber":  "#FFEDD5",
        "purple": "#F3E8FF",
        "rose":   "#FFE4E6",
    }[name]
    
    glow_color = {
        "yellow": "rgba(250, 204, 21, 0.15)",
        "green":  "rgba(74, 222, 128, 0.15)",
        "blue":   "rgba(56, 189, 248, 0.15)",
        "amber":  "rgba(251, 146, 60, 0.15)",
        "purple": "rgba(192, 132, 252, 0.15)",
        "rose":   "rgba(251, 113, 133, 0.15)",
    }[name]

    css_lines.extend([
        f"body.theme-dark .hl-felt-{name},",
        f"body.reading-bg-dark .hl-felt-{name} {{",
        f"  background-image: {bg_single} !important;",
        f"  color: {text_color} !important;",
        f"  mix-blend-mode: normal !important;",
        f"  filter: drop-shadow(0 0 5px {glow_color});",
        f"}}",
        f"body.theme-dark .hl-felt-{name}.hl-range-start, body.reading-bg-dark .hl-felt-{name}.hl-range-start {{ background-image: {bg_start} !important; }}",
        f"body.theme-dark .hl-felt-{name}.hl-range-mid,   body.reading-bg-dark .hl-felt-{name}.hl-range-mid   {{ background-image: {bg_mid}   !important; }}",
        f"body.theme-dark .hl-felt-{name}.hl-range-end,   body.reading-bg-dark .hl-felt-{name}.hl-range-end   {{ background-image: {bg_end}   !important; }}",
    ])

css_lines.extend([
    "",
    "/* 3. STYLE SOULIGNÉ FEUTRE */",
    ".verse-item.hl-underline-yellow { border-bottom: 3.5px solid #EAB308 !important; padding-bottom: 1px; }",
    ".verse-item.hl-underline-green { border-bottom: 3.5px solid #22C55E !important; padding-bottom: 1px; }",
    ".verse-item.hl-underline-blue { border-bottom: 3.5px solid #0EA5E9 !important; padding-bottom: 1px; }",
    ".verse-item.hl-underline-amber { border-bottom: 3.5px solid #F97316 !important; padding-bottom: 1px; }",
    ".verse-item.hl-underline-purple { border-bottom: 3.5px solid #A855F7 !important; padding-bottom: 1px; }",
    ".verse-item.hl-underline-rose { border-bottom: 3.5px solid #F43F5E !important; padding-bottom: 1px; }",
    "",
    "/* 4. NOTE LIÉE AU SURLIGNAGE (Indicateur discret) */",
    ".hl-has-note {",
    "  border-bottom: 2px dashed rgba(0, 0, 0, 0.45) !important;",
    "}",
    "body.theme-dark .hl-has-note,",
    "body.reading-bg-dark .hl-has-note {",
    "  border-bottom: 2px dashed rgba(255, 255, 255, 0.55) !important;",
    "}",
    "",
    "/* 5. PASTILLES DE COULEUR DANS L'INTERFACE */",
    ".hl-bg-yellow { background-color: #FACC15 !important; }",
    ".hl-bg-green { background-color: #4ADE80 !important; }",
    ".hl-bg-blue { background-color: #38BDF8 !important; }",
    ".hl-bg-amber { background-color: #FB923C !important; }",
    ".hl-bg-purple { background-color: #C084FC !important; }",
    ".hl-bg-rose { background-color: #FB7185 !important; }",
    "",
    "/* 6. PALETTE FLOTTANTE AU-DESSUS DE LA SÉLECTION */",
    ".hl-palette {",
    "  position: fixed;",
    "  z-index: 10000;",
    "  background: var(--bg-primary, #ffffff);",
    "  border: 1px solid var(--border-color, #e2e8f0);",
    "  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);",
    "  border-radius: 20px;",
    "  padding: 5px 8px;",
    "  display: flex;",
    "  align-items: center;",
    "  gap: 4px;",
    "  animation: palettePop 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275);",
    "}",
    ".hl-palette.hidden {",
    "  display: none !important;",
    "}",
    "",
    "@keyframes palettePop {",
    "  0% { transform: scale(0.9) translateY(6px); opacity: 0; }",
    "  100% { transform: scale(1) translateY(0); opacity: 1; }",
    "}",
    "",
    ".hl-palette-colors {",
    "  display: flex;",
    "  align-items: center;",
    "  gap: 5px;",
    "}",
    "",
    ".hl-color-btn {",
    "  width: 22px;",
    "  height: 22px;",
    "  border-radius: 50%;",
    "  border: 2px solid transparent;",
    "  cursor: pointer;",
    "  transition: transform 0.1s, border-color 0.1s;",
    "}",
    ".hl-color-btn:hover {",
    "  transform: scale(1.2);",
    "  border-color: rgba(255, 255, 255, 0.6);",
    "}",
    "",
    ".hl-divider {",
    "  width: 1px;",
    "  height: 16px;",
    "  background: var(--border-color, #cbd5e1);",
    "  margin: 0 4px;",
    "}",
    "",
    ".hl-action-btn {",
    "  background: none;",
    "  border: none;",
    "  color: var(--text-secondary, #64748b);",
    "  cursor: pointer;",
    "  padding: 4px;",
    "  border-radius: 4px;",
    "  display: flex;",
    "  align-items: center;",
    "  justify-content: center;",
    "}",
    ".hl-action-btn:hover {",
    "  background: var(--bg-hover, #f1f5f9);",
    "  color: var(--accent-blue, #2563eb);",
    "}",
    "#hl-btn-erase:hover {",
    "  color: var(--accent-red, #ef4444);",
    "}",
    "",
    "/* 7. MODE STYLO ACTIF */",
    ".hl-pen-mode-active .reader-container,",
    ".hl-pen-mode-active .verse-item,",
    ".hl-pen-mode-active .word-token {",
    "  cursor: crosshair !important;",
    "}",
    "",
    "/* 8. PASTILLES DANS LE POPOVER SUPÉRIEUR */",
    ".hl-swatch-picker {",
    "  width: 32px;",
    "  height: 32px;",
    "  border-radius: 50%;",
    "  border: 2px solid transparent;",
    "  cursor: pointer;",
    "  transition: transform 0.1s, border-color 0.1s;",
    "}",
    ".hl-swatch-picker:hover {",
    "  transform: scale(1.1);",
    "}",
    ".hl-swatch-picker.active {",
    "  border-color: var(--accent-blue, #2563eb);",
    "  box-shadow: 0 0 0 2px var(--bg-primary, #ffffff), 0 0 0 4px var(--accent-blue, #2563eb);",
    "}",
    "",
    "/* 9. ROW DE SURLIGNAGE DANS LE MENU CONTEXTUEL */",
    ".scm-highlight-row {",
    "  display: flex;",
    "  align-items: center;",
    "  justify-content: space-between;",
    "  padding: 6px 12px 8px 12px;",
    "  border-bottom: 1px solid var(--border-color, #e2e8f0);",
    "  background: var(--bg-subtle, #f8fafc);",
    "  gap: 8px;",
    "}",
    "",
    ".scm-hl-title {",
    "  font-size: 11px;",
    "  font-weight: 700;",
    "  color: var(--text-secondary, #64748b);",
    "  display: flex;",
    "  align-items: center;",
    "  gap: 4px;",
    "  text-transform: uppercase;",
    "  letter-spacing: 0.5px;",
    "}",
    "",
    ".scm-hl-swatches {",
    "  display: flex;",
    "  align-items: center;",
    "  gap: 5px;",
    "}",
    "",
    ".scm-swatch-btn {",
    "  width: 20px;",
    "  height: 20px;",
    "  border-radius: 50%;",
    "  border: 1px solid rgba(0,0,0,0.12);",
    "  cursor: pointer;",
    "  transition: transform 0.1s;",
    "}",
    ".scm-swatch-btn:hover {",
    "  transform: scale(1.2);",
    "}",
    "",
    ".scm-erase-btn {",
    "  background: none;",
    "  border: 1px dashed var(--border-color, #cbd5e1);",
    "  color: var(--text-muted, #94a3b8);",
    "  font-size: 11px;",
    "  display: flex;",
    "  align-items: center;",
    "  justify-content: center;",
    "}",
    ".scm-erase-btn:hover {",
    "  border-color: var(--accent-red, #ef4444);",
    "  color: var(--accent-red, #ef4444);",
    "}",
])

final_highlighter_css = "\n".join(css_lines)

css_file_path = os.path.join(os.path.dirname(__file__), "..", "web", "css", "logos.css")
with open(css_file_path, "r", encoding="utf-8") as f:
    orig_css = f.read()

pos = orig_css.find("/* ========================================================================= */\n/* HIGHLIGHTER")
if pos != -1:
    orig_css = orig_css[:pos]

with open(css_file_path, "w", encoding="utf-8") as f:
    f.write(orig_css.rstrip() + "\n\n" + final_highlighter_css + "\n")

print("Generated continuous multi-verse Logos highlighter CSS successfully!")
