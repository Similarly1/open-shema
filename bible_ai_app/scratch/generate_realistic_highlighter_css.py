import os
import urllib.parse

def make_svg_marker(color_start, color_mid, color_end, opacity=0.75):
    # Organic hand-drawn path with wavy top and bottom, rounded ends
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 32" preserveAspectRatio="none">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="{color_start}" stop-opacity="{min(1.0, opacity + 0.15):.2f}"/>
      <stop offset="10%" stop-color="{color_mid}" stop-opacity="{opacity:.2f}"/>
      <stop offset="88%" stop-color="{color_mid}" stop-opacity="{max(0.1, opacity - 0.05):.2f}"/>
      <stop offset="100%" stop-color="{color_end}" stop-opacity="{min(1.0, opacity + 0.10):.2f}"/>
    </linearGradient>
  </defs>
  <path d="M 4,7 Q 28,3 58,6 Q 98,2 138,5 Q 172,3 196,6 C 201,11 201,21 196,26 Q 165,30 128,27 Q 85,30 48,27 Q 22,29 4,25 C -1,20 -1,12 4,7 Z" fill="url(#grad)"/>
</svg>'''
    # Compact url encoding
    clean_svg = "".join([line.strip() for line in svg.split("\n")])
    encoded = urllib.parse.quote(clean_svg)
    return f'url("data:image/svg+xml,{encoded}")'

# Colors for Light Theme (Soft pastel watercolor/felt markers)
light_colors = {
    "yellow": ("#FACC15", "#FEF08A", "#EAB308", 0.72),
    "green":  ("#4ADE80", "#BBF7D0", "#22C55E", 0.72),
    "blue":   ("#38BDF8", "#BAE6FD", "#0EA5E9", 0.72),
    "amber":  ("#FB923C", "#FED7AA", "#F97316", 0.72),
    "purple": ("#C084FC", "#E9D5FF", "#A855F7", 0.72),
    "rose":   ("#FB7185", "#FECDD3", "#F43F5E", 0.72),
}

# Colors for Dark Theme (Luminous translucent glows with soft ink body)
dark_colors = {
    "yellow": ("#FACC15", "#EAB308", "#CA8A04", 0.40),
    "green":  ("#4ADE80", "#22C55E", "#16A34A", 0.38),
    "blue":   ("#38BDF8", "#0EA5E9", "#0284C7", 0.40),
    "amber":  ("#FB923C", "#F97316", "#EA580C", 0.40),
    "purple": ("#C084FC", "#A855F7", "#9333EA", 0.40),
    "rose":   ("#FB7185", "#F43F5E", "#E11D48", 0.40),
}

css_lines = [
    "/* ========================================================================= */",
    "/* HIGHLIGHTER REALISTIC ORGANIC STYLES (Style Logos - Tracé Feutre Wavy)     */",
    "/* ========================================================================= */",
    "",
    "/* Rendu continu sur le verset entier */",
    ".verse-item.hl-felt-yellow,",
    ".verse-item.hl-felt-green,",
    ".verse-item.hl-felt-blue,",
    ".verse-item.hl-felt-amber,",
    ".verse-item.hl-felt-purple,",
    ".verse-item.hl-felt-rose {",
    "  display: inline;",
    "  padding: 3px 6px 4px 5px !important;",
    "  margin: 0 -2px !important;",
    "  background-size: 100% 100% !important;",
    "  background-repeat: no-repeat !important;",
    "  -webkit-box-decoration-break: clone !important;",
    "  box-decoration-break: clone !important;",
    "  transition: background 0.15s ease, color 0.15s ease;",
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
    bg_svg = make_svg_marker(c_start, c_mid, c_end, opacity=op)
    css_lines.extend([
        f".hl-felt-{name} {{",
        f"  background-image: {bg_svg} !important;",
        f"  color: #0f172a !important;",
        f"  mix-blend-mode: multiply;",
        f"}}"
    ])

css_lines.extend([
    "",
    "/* 2. THÈME SOMBRE (body.theme-dark, body.reading-bg-dark) */"
])

for name, (c_start, c_mid, c_end, op) in dark_colors.items():
    bg_svg = make_svg_marker(c_start, c_mid, c_end, opacity=op)
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
        f"  background-image: {bg_svg} !important;",
        f"  color: {text_color} !important;",
        f"  mix-blend-mode: normal !important;",
        f"  filter: drop-shadow(0 0 5px {glow_color});",
        f"}}"
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

print("Generated and written true organic Logos highlighter CSS successfully!")
