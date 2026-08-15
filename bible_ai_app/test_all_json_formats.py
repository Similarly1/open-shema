import os
import json
import re
import sys

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

from core.reference_parser import get_standard_book_code, get_french_book_name
from gui.center_panel import BOOKS_OT, BOOKS_NT

all_books_list = BOOKS_OT + BOOKS_NT
app_order = {code: i + 1 for i, (name, code, ch) in enumerate(all_books_list)}

def clean_ebible_text(text):
    text = re.sub(r'</?dictionary_word>', '', text)
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

# Test 1: Parser for Ostervald / Crosswire JSON folder
print("--- Testing eBible Folder Parser (Ostervald) ---")
ost_dir = r"C:\Users\adrie\kDrive\Documents\Théologie\Ressources externes\Bibles JSON\Ostervald Bible"
ost_files = sorted([f for f in os.listdir(ost_dir) if f.endswith(".json")])
print(f"Ostervald files: {len(ost_files)}")
first_ost = os.path.join(ost_dir, ost_files[0])
with open(first_ost, "r", encoding="utf-8-sig") as f:
    d = json.load(f)

about_tr = d.get("general", {}).get("about_translation", {})
abbr = about_tr.get("translation_abbr", "OST")
tr_name = about_tr.get("translation_name_in_english", "Ostervald")
print(f"Translation: {tr_name} ({abbr})")

# Test verses extraction
verses_by_ch = {}
for v_obj in d.get("verses", []):
    ch = str(v_obj.get("chapter", "1"))
    v_num = str(v_obj.get("verse_number", "1"))
    txt = clean_ebible_text(v_obj.get("text", ""))
    if ch not in verses_by_ch:
        verses_by_ch[ch] = {}
    verses_by_ch[ch][v_num] = txt

print(f"Genèse total chapters extracted: {len(verses_by_ch)}")
print("Genèse 1:1 =", verses_by_ch.get("1", {}).get("1"))
print("Genèse 1:2 =", verses_by_ch.get("1", {}).get("2"))

# Test 2: Parser for APEE (List of Books)
print("\n--- Testing APEE (List of Books) ---")
apee_path = r"C:\Users\adrie\kDrive\Documents\Théologie\Ressources externes\Bibles JSON\fr_apee.json"
with open(apee_path, "r", encoding="utf-8-sig") as f:
    apee_list = json.load(f)

print(f"APEE total books: {len(apee_list)}")
for b_obj in apee_list[:3]:
    b_name = b_obj.get("name")
    std = get_standard_book_code(b_name)
    fr = get_french_book_name(std)
    raw_chs = b_obj.get("chapters", [])
    ch_dict = {}
    for ch_idx, ch_verses in enumerate(raw_chs):
        ch_num = str(ch_idx + 1)
        ch_dict[ch_num] = {}
        if isinstance(ch_verses, list):
            for v_idx, v_txt in enumerate(ch_verses):
                ch_dict[ch_num][str(v_idx + 1)] = v_txt
        elif isinstance(ch_verses, dict):
            ch_dict[ch_num] = ch_verses
    print(f"  Book '{b_name}' -> '{fr}' ({std}): {len(ch_dict)} chapters, Ch 1 verses: {len(ch_dict.get('1', {}))}")
    print(f"    1:1 = {ch_dict.get('1', {}).get('1')}")
