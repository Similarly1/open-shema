import os
from PIL import Image, ImageDraw, ImageFont

def create_sober_cover(
    title: str,
    subtitle: str = "",
    author: str = "",
    year: str = "",
    badge: str = "✦ SAINTE BIBLE ✦",
    gradient_top: str = "#1e1b4b",
    gradient_bottom: str = "#0b0f19",
    frame_color: str = "#d97706",
    inner_frame_color: tuple = (245, 158, 11, 100),
    badge_color: str = "#fde68a",
    author_color: str = "#fcd34d",
    line_color: str = "#d97706",
    width: int = 400,
    height: int = 560
) -> Image.Image:
    # Convert hex colors to RGB
    def hex_to_rgb(hex_str):
        hex_str = hex_str.lstrip('#')
        return tuple(int(hex_str[i:i+2], 16) for i in (0, 2, 4))

    c_top = hex_to_rgb(gradient_top)
    c_bot = hex_to_rgb(gradient_bottom)

    # 1. Base Image with 2-color vertical/diagonal gradient
    img = Image.new("RGBA", (width, height), (0, 0, 0, 255))
    pixels = img.load()

    for y in range(height):
        factor_y = y / float(height)
        for x in range(width):
            factor_x = (x / float(width)) * 0.3
            t = min(1.0, max(0.0, factor_y + factor_x))
            r = int(c_top[0] * (1 - t) + c_bot[0] * t)
            g = int(c_top[1] * (1 - t) + c_bot[1] * t)
            b = int(c_top[2] * (1 - t) + c_bot[2] * t)

            # Vignette subtile sur les bords
            dx = (x - width / 2) / (width / 2)
            dy = (y - height / 2) / (height / 2)
            dist_sq = (dx * dx + dy * dy) * 0.2
            vignette = max(0.65, 1.0 - dist_sq)

            r = int(r * vignette)
            g = int(g * vignette)
            b = int(b * vignette)

            # Grain ultra fin
            if (x + y) % 6 == 0:
                r = min(255, r + 2)
                g = min(255, g + 2)
                b = min(255, b + 2)

            pixels[x, y] = (r, g, b, 255)

    draw = ImageDraw.Draw(img, "RGBA")

    # 2. Outer and Inner Frames
    f_col = hex_to_rgb(frame_color) + (255,)
    i_col = inner_frame_color if len(inner_frame_color) == 4 else hex_to_rgb(frame_color) + (90,)

    # Cadre extérieur (épaisseur 3px)
    draw.rectangle([20, 20, width - 20, height - 20], outline=f_col, width=3)
    # Cadre intérieur (épaisseur 1px)
    draw.rectangle([28, 28, width - 28, height - 28], outline=i_col, width=1)

    # Coins décoratifs
    c_size = 14
    draw.rectangle([24, 24, 24 + c_size, 24 + c_size], outline=f_col, width=2)
    draw.rectangle([width - 24 - c_size, 24, width - 24, 24 + c_size], outline=f_col, width=2)
    draw.rectangle([24, height - 24 - c_size, 24 + c_size, height - 24], outline=f_col, width=2)
    draw.rectangle([width - 24 - c_size, height - 24 - c_size, width - 24, height - 24], outline=f_col, width=2)

    # 3. Fonts setup
    font_paths = [
        "C:/Windows/Fonts/georgiab.ttf",
        "C:/Windows/Fonts/timesbd.ttf",
        "C:/Windows/Fonts/segoeuib.ttf",
        "C:/Windows/Fonts/arialbd.ttf"
    ]
    font_reg_paths = [
        "C:/Windows/Fonts/segoeui.ttf",
        "C:/Windows/Fonts/arial.ttf",
        "C:/Windows/Fonts/georgia.ttf"
    ]

    title_font_path = next((p for p in font_paths if os.path.exists(p)), None)
    reg_font_path = next((p for p in font_reg_paths if os.path.exists(p)), None)

    try:
        font_badge = ImageFont.truetype(title_font_path or "arialbd.ttf", 13)
        font_title_main = ImageFont.truetype(title_font_path or "georgiab.ttf", 23)
        font_title_sub = ImageFont.truetype(title_font_path or "georgiab.ttf", 19)
        font_author = ImageFont.truetype(reg_font_path or "segoeui.ttf", 14)
        font_year = ImageFont.truetype(reg_font_path or "segoeui.ttf", 12)
    except Exception:
        font_badge = ImageFont.load_default()
        font_title_main = font_badge
        font_title_sub = font_badge
        font_author = font_badge
        font_year = font_badge

    # 4. Badge supérieur
    b_col = hex_to_rgb(badge_color) + (255,)
    draw.text((width / 2, 75), badge, fill=b_col, font=font_badge, anchor="mm")
    
    # Filet sous le badge
    l_col = hex_to_rgb(line_color) + (140,)
    draw.line([(width / 2 - 45, 95), (width / 2 + 45, 95)], fill=l_col, width=1)

    # 5. Titre & Sous-titre
    y_center = 230
    if subtitle:
        draw.text((width / 2, y_center - 18), title, fill=(255, 255, 255, 255), font=font_title_main, anchor="mm")
        draw.text((width / 2, y_center + 18), subtitle, fill=(255, 255, 255, 240), font=font_title_sub, anchor="mm")
        # Filet sous le titre
        draw.line([(width / 2 - 40, y_center + 50), (width / 2 + 40, y_center + 50)], fill=l_col, width=2)
    else:
        draw.text((width / 2, y_center), title, fill=(255, 255, 255, 255), font=font_title_main, anchor="mm")
        draw.line([(width / 2 - 40, y_center + 35), (width / 2 + 40, y_center + 35)], fill=l_col, width=2)

    # 6. Auteur
    a_col = hex_to_rgb(author_color) + (255,)
    draw.text((width / 2, height - 120), author, fill=a_col, font=font_author, anchor="mm")

    # 7. Année
    if year:
        draw.text((width / 2, height - 65), f"Édition {year}", fill=(255, 255, 255, 150), font=font_year, anchor="mm")

    return img.convert("RGB")


def generate_all_catalog_covers():
    current_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    covers_dir = os.path.join(current_dir, "data", "covers")
    os.makedirs(covers_dir, exist_ok=True)

    scratch_covers_dir = os.path.join(os.path.dirname(current_dir), "scratch", "open-shema-data", "data", "covers")
    os.makedirs(scratch_covers_dir, exist_ok=True)

    configs = [
        {
            "filename": "LSG.png",
            "title": "LA SAINTE BIBLE",
            "subtitle": "Louis Segond 1910",
            "badge": "✦ SAINTE BIBLE ✦",
            "author": "Louis Segond (avec Strongs)",
            "year": "1910",
            "gradient_top": "#1e1b4b",
            "gradient_bottom": "#0b0f19",
            "frame_color": "#d97706",
            "inner_frame_color": (245, 158, 11, 100),
            "badge_color": "#fde68a",
            "author_color": "#fcd34d",
            "line_color": "#d97706",
        },
        {
            "filename": "DARBY.png",
            "title": "LA SAINTE BIBLE",
            "subtitle": "Version J.N. Darby",
            "badge": "✦ SAINTE BIBLE ✦",
            "author": "John Nelson Darby (avec Strong)",
            "year": "1885",
            "gradient_top": "#064e3b",
            "gradient_bottom": "#021e17",
            "frame_color": "#d4af37",
            "inner_frame_color": (212, 175, 55, 100),
            "badge_color": "#fef08a",
            "author_color": "#fde68a",
            "line_color": "#d4af37",
        },
        {
            "filename": "OST.png",
            "title": "LA SAINTE BIBLE",
            "subtitle": "J.-F. Ostervald",
            "badge": "✦ SAINTE BIBLE ✦",
            "author": "Jean-Frédéric Ostervald",
            "year": "1877",
            "gradient_top": "#3b0c16",
            "gradient_bottom": "#140306",
            "frame_color": "#eab308",
            "inner_frame_color": (234, 179, 8, 100),
            "badge_color": "#fef08a",
            "author_color": "#fde047",
            "line_color": "#eab308",
        },
        {
            "filename": "NCL.png",
            "title": "LA SAINTE BIBLE",
            "subtitle": "Néo-Crampon Libre",
            "badge": "✦ SAINTE BIBLE ✦",
            "author": "Augustin Crampon (Frat. de Tibériade)",
            "year": "2022",
            "gradient_top": "#2e1065",
            "gradient_bottom": "#0f0521",
            "frame_color": "#f59e0b",
            "inner_frame_color": (245, 158, 11, 100),
            "badge_color": "#fde68a",
            "author_color": "#fcd34d",
            "line_color": "#f59e0b",
        },
        {
            "filename": "CBJC.png",
            "title": "COMMENTAIRES",
            "subtitle": "Jean Calvin",
            "badge": "✦ EXÉGÈSE & DOCTRINE ✦",
            "author": "Jean Calvin (Éd. Ch. Meyrueis)",
            "year": "1854-1855",
            "gradient_top": "#3b1f14",
            "gradient_bottom": "#150904",
            "frame_color": "#fbbf24",
            "inner_frame_color": (251, 191, 36, 100),
            "badge_color": "#fde68a",
            "author_color": "#fcd34d",
            "line_color": "#fbbf24",
        }
    ]

    for cfg in configs:
        filename = cfg.pop("filename")
        img = create_sober_cover(**cfg)
        
        path1 = os.path.join(covers_dir, filename)
        img.save(path1, "PNG", optimize=True)
        print(f"Saved: {path1}")

        path2 = os.path.join(scratch_covers_dir, filename)
        img.save(path2, "PNG", optimize=True)
        print(f"Saved: {path2}")

if __name__ == "__main__":
    generate_all_catalog_covers()
