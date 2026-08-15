import csv
import json
import os
import re
import sys

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

from core.reference_parser import get_standard_book_code, get_french_book_name
from core.bible_json_loader import BibleJsonLoader, STD_TO_USFM
from gui.center_panel import BOOKS_OT, BOOKS_NT

all_books_list = BOOKS_OT + BOOKS_NT
app_order = {code: i + 1 for i, (name, code, ch) in enumerate(all_books_list)}

csv_path = r"C:\Users\adrie\kDrive\Documents\Théologie\Ressources externes\Ebooks\Bibles\Sg1910.csv"
dest_dir = os.path.join(BibleJsonLoader.get_bibles_dir(), "LSG")
os.makedirs(dest_dir, exist_ok=True)

books_map = {}

with open(csv_path, "r", encoding="utf-8-sig") as f:
    reader = csv.reader(f, delimiter="\t")
    headers = next(reader)
    for row in reader:
        if len(row) >= 4:
            raw_b, ch_str, v_str, text_val = row[0].strip(), row[1].strip(), row[2].strip(), row[3].strip()
            std_b = get_standard_book_code(raw_b)
            if std_b not in books_map:
                books_map[std_b] = {}
            if ch_str not in books_map[std_b]:
                books_map[std_b][ch_str] = {}
            books_map[std_b][ch_str][v_str] = text_val

print(f"Loaded {len(books_map)} books from Sg1910.csv. Writing modular JSON files...")

saved_count = 0
for std_b, chaps in books_map.items():
    fr_name = get_french_book_name(std_b)
    order_idx = app_order.get(std_b, 99)
    usfm_code = STD_TO_USFM.get(std_b, std_b.upper())
    
    book_obj = {
        "id": order_idx,
        "code": usfm_code,
        "name": fr_name,
        "version": "LSG",
        "version_fullname": "Louis Segond 1910 (avec codes Strong)",
        "total_chapters": len(chaps),
        "chapters": chaps
    }
    
    dest_filename = f"{order_idx:02d}_{usfm_code}_{fr_name}.json"
    dest_filepath = os.path.join(dest_dir, dest_filename)
    with open(dest_filepath, "w", encoding="utf-8") as fp:
        json.dump(book_obj, fp, ensure_ascii=False, indent=2)
    saved_count += 1

# Update library.json
from gui.library_utils import load_books_metadata, save_books_metadata
reg = load_books_metadata()

reg["LSG"] = {
    "title": "Louis Segond 1910 (avec Strongs)",
    "author": "Louis Segond",
    "description": "Bible Louis Segond 1910 avec numérotation Strong complète (Hébreu & Grec)",
    "year": "1910",
    "cover_path": None,
    "type": "Bible",
    "format": "json",
    "folder_name": "LSG",
    "version_code": "LSG",
    "total_books": saved_count,
    "embedding_model": "study_library",
    "active": True,
    "has_strongs": True
}
save_books_metadata(reg)

# Clear BibleJsonLoader caches
BibleJsonLoader.clear_cache()

print(f"Successfully converted and saved {saved_count} books of Louis Segond 1910 in data/bibles/LSG/!")
