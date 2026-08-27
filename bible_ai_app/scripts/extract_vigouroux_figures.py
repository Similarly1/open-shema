#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Pipeline d'Extraction Automatique des Gravures du Dictionnaire de la Bible (F. Vigouroux).
- Parcourt les 5 tomes PDF originaux.
- Détecte les légendes des figures numérotées.
- Découpe précisément chaque gravure au-dessus de sa légende en 300 DPI.
- Convertit le fond blanc en canal Alpha (transparence pure, idéal Dark/Light mode).
- Associe chaque illustration à l'article correspondant du dictionnaire.
- Génère le catalogue JSON 'vigouroux_illustrations.json'.
"""

import os
import sys
import json
import re
import fitz
from PIL import Image
import numpy as np

sys.stdout.reconfigure(encoding='utf-8')

PDF_DIR = r"C:\Users\adrie\kDrive\Documents\Théologie\Ressources externes\Ebooks\Dictionnaire Biblique Vigouroux"
APP_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG_OUT_DIR = os.path.join(APP_DIR, "web", "img", "vigouroux")
INDEX_PATH = os.path.join(APP_DIR, "data", "dictionaries", "vigouroux_illustrations.json")

VOLUMES = [
    (1, "Vigouroux_DB_I (A - ).pdf"),
    (2, "Vigouroux_DB_II (C - ).pdf"),
    (3, "Vigouroux_DB_III (G - ).pdf"),
    (4, "Vigouroux_DB_IV (L - ).pdf"),
    (5, "Vigouroux_DB_V (PE - ).pdf")
]

CAPTION_REGEX = re.compile(r'^\s*(?:Fig\.\s*)?(\d{1,4})\.\s*[-—–]\s*(.+)$', re.M)

def normalize_key(s):
    if not s:
        return ""
    s = s.lower().replace("’", "'")
    s = re.sub(r'[̀-ͯ]', '', s)
    s = re.sub(r'[^a-z0-9]', '', s)
    return s

def clean_caption_text(raw_text):
    text = raw_text.replace('\n', ' ').strip()
    text = re.sub(r'\s+', ' ', text)
    text = text.replace("D'apr6s", "D'après").replace("D'aprfes", "D'après").replace("D*apres", "D'après").replace("D'apres", "D'après")
    text = text.replace("photografhie", "photographie").replace("pb.otograpb.ie", "photographie").replace("photographic", "photographie")
    text = text.replace("Kgypte", "Égypte").replace("Egypte", "Égypte").replace("phe'nicien", "phénicien")
    text = text.replace("Pompdi", "Pompéi").replace("Ghiz6h", "Gizeh")
    return text

def extract_figures_from_pdf(vol_num, pdf_filename, max_pages=None):
    pdf_path = os.path.join(PDF_DIR, pdf_filename)
    if not os.path.exists(pdf_path):
        print(f"❌ Fichier introuvable : {pdf_path}")
        return []

    doc = fitz.open(pdf_path)
    total_pages = len(doc)
    page_limit = min(total_pages, max_pages) if max_pages else total_pages
    
    print(f"\n📖 Traitement du Tome {vol_num} : {pdf_filename} ({page_limit} pages)...")
    
    extracted_figures = []
    seen_figs = set()
    zoom = 300 / 72.0
    mat = fitz.Matrix(zoom, zoom)

    for pno in range(page_limit):
        page = doc[pno]
        txt = page.get_text()
        blocks = page.get_text("blocks")
        
        page_header = ""
        for b in blocks:
            if b[1] < 45 and len(b[4].strip()) > 2:
                page_header = b[4].strip()
                break

        for m in CAPTION_REGEX.finditer(txt):
            fig_num = int(m.group(1))
            fig_raw_title = m.group(2).strip()
            
            if len(fig_raw_title) < 3:
                continue
            if re.match(r'^(?:Genèse|Exode|Lévitique|Nombres|Deutéronome|Josué|Juges|1 Samuel|2 Samuel|1 Rois|2 Rois|1 Chroniques|2 Chroniques|Psaumes|Ésaïe|Jérémie|Lamentations|Ézéchiel|Daniel|Osée|Joël|Amos|Matthieu|Marc|Luc|Jean|Actes|Romains|1 Corinthiens|2 Corinthiens|Galates|Éphésiens|Philippiens|Colossiens|Hébreux|Jacques|1 Pierre|2 Pierre|Apocalypse)\b', fig_raw_title, re.I):
                continue
            if re.match(r'^(?:Aujourd[\'’]hui|Plusieurs|Certains|Cette|Dans|Sous|Pour|Sur|Le|La|Les|Un|Une|Saint|D[\'’]après)\s+(?:auteurs|exégètes|critiques|savants|siècles|temps|années)\b', fig_raw_title, re.I) and fig_num > 500:
                continue
            if (vol_num, fig_num) in seen_figs:
                continue

            cap_rects = page.search_for(f"{fig_num}. —") or page.search_for(f"{fig_num}. -") or page.search_for(f"{fig_num}. –") or page.search_for(f"{fig_num}.")
            if not cap_rects:
                continue
            cap_rect = cap_rects[0]

            if cap_rect.x0 < 250 and cap_rect.x1 < 290:
                col_x0, col_x1 = 45, 275
            elif cap_rect.x0 > 240:
                col_x0, col_x1 = 265, 500
            else:
                col_x0, col_x1 = 45, 500

            above_y = 60.0
            for b in blocks:
                if b[4].strip() and b[1] < cap_rect.y0 - 4:
                    if not (b[2] < col_x0 or b[0] > col_x1):
                        if b[3] < cap_rect.y0 - 4:
                            if b[3] > above_y:
                                above_y = b[3]

            draw_rect = fitz.Rect(col_x0, above_y + 2, col_x1, cap_rect.y0 - 2)
            if draw_rect.height < 15 or draw_rect.width < 20:
                continue

            clip_pix = page.get_pixmap(matrix=mat, clip=draw_rect)
            img = Image.frombytes("RGB", [clip_pix.width, clip_pix.height], clip_pix.samples).convert("L")
            np_img = np.array(img)

            coords = np.argwhere(np_img < 220)
            if len(coords) < 80:
                continue

            y_min, x_min = coords.min(axis=0)
            y_max, x_max = coords.max(axis=0)
            if (y_max - y_min) < 20 or (x_max - x_min) < 20:
                continue

            cropped = np_img[max(0, y_min - 4):min(np_img.shape[0], y_max + 4), max(0, x_min - 4):min(np_img.shape[1], x_max + 4)]
            np_c = cropped.astype(np.float32)

            alpha = 255.0 * (1.0 - np.clip((np_c - 60.0) / (245.0 - 60.0), 0.0, 1.0))
            rgba = np.zeros((cropped.shape[0], cropped.shape[1], 4), dtype=np.uint8)
            rgba[:, :, 3] = np.uint8(alpha)

            final_img = Image.fromarray(rgba, mode="RGBA")
            save_name = f"vol{vol_num}_fig_{fig_num}.png"
            save_path = os.path.join(IMG_OUT_DIR, save_name)
            final_img.save(save_path, format="PNG", optimize=True)

            cleaned_title = clean_caption_text(fig_raw_title)
            seen_figs.add((vol_num, fig_num))

            first_word_match = re.match(r'^([A-ZÉÈÊËÀÂÄÎÏÔÖÙÛÜÇ][a-zA-ZÉÈÊËÀÂÄÎÏÔÖÙÛÜÇa-zÀ-ÿ\-]+)', cleaned_title)
            leading_word = first_word_match.group(1) if first_word_match else ""

            extracted_figures.append({
                "vol": vol_num,
                "fig_num": fig_num,
                "caption": cleaned_title,
                "page": pno + 1,
                "header": page_header,
                "leading_word": leading_word,
                "rel_path": f"img/vigouroux/{save_name}",
                "width": final_img.size[0],
                "height": final_img.size[1]
            })

        if (pno + 1) % 100 == 0 or (pno + 1) == page_limit:
            print(f"  • Page {pno + 1}/{page_limit} traitée — {len(extracted_figures)} gravures extraites.")

    return extracted_figures

def main():
    os.makedirs(IMG_OUT_DIR, exist_ok=True)
    os.makedirs(os.path.dirname(INDEX_PATH), exist_ok=True)

    all_figures = []
    
    for vol_num, fname in VOLUMES:
        figs = extract_figures_from_pdf(vol_num, fname)
        all_figures.extend(figs)

    print(f"\n✨ Extraction terminée : {len(all_figures)} gravures au total !")

    index_by_article = {}
    
    vigouroux_dict_path = os.path.join(APP_DIR, "data", "dictionaries", "vigouroux_dict.json")
    known_articles = {}
    if os.path.exists(vigouroux_dict_path):
        with open(vigouroux_dict_path, "r", encoding="utf-8") as f:
            v_dict = json.load(f)
            for k in v_dict.keys():
                norm = normalize_key(k)
                if norm:
                    known_articles[norm] = k

    for fig in all_figures:
        cand_keys = []
        if fig["leading_word"]:
            cand_keys.append(normalize_key(fig["leading_word"]))
        
        if fig["header"]:
            for hw in re.findall(r'[A-ZÉÈÊËÀÂÄÎÏÔÖÙÛÜÇ]{2,}', fig["header"]):
                cand_keys.append(normalize_key(hw))

        matched_key = None
        for ck in cand_keys:
            if ck in known_articles:
                matched_key = known_articles[ck]
                break
        
        if not matched_key and fig["leading_word"]:
            matched_key = fig["leading_word"].upper()

        if not matched_key:
            matched_key = f"FIG_{fig['vol']}_{fig['fig_num']}"

        target_article = matched_key.upper()
        if target_article not in index_by_article:
            index_by_article[target_article] = []
        index_by_article[target_article].append(fig)

    with open(INDEX_PATH, "w", encoding="utf-8") as f:
        json.dump(index_by_article, f, ensure_ascii=False, indent=2)

    print(f"📁 Index sauvegardé dans {INDEX_PATH} ({len(index_by_article)} articles associés).")

if __name__ == "__main__":
    main()
