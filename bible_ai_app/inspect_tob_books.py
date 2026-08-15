import json
import sys

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

path = r"C:\Users\adrie\kDrive\Documents\Théologie\Ressources externes\Ebooks\Bibles\bible_tob.json"
with open(path, "r", encoding="utf-8") as f:
    data = json.load(f)

from core.reference_parser import get_standard_book_code, get_french_book_name

print("All 82 books in TOB:")
for i, name in enumerate(data.keys()):
    std = get_standard_book_code(name)
    print(f"  {i+1:2d}. {name:30s} -> Standard Code: {std}")
