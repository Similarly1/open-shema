import csv
import sys

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

path = r"C:\Users\adrie\kDrive\Documents\Théologie\Ressources externes\Ebooks\Bibles\Sg1910.csv"

from core.reference_parser import get_standard_book_code, get_french_book_name, BOOK_MAPPING

raw_codes = set()
with open(path, "r", encoding="utf-8-sig") as f:
    reader = csv.reader(f, delimiter="\t")
    next(reader)
    for r in reader:
        if r:
            raw_codes.add(r[0].strip())

print(f"Total raw codes ({len(raw_codes)}):")
for rc in sorted(list(raw_codes)):
    std = get_standard_book_code(rc)
    fr = get_french_book_name(std)
    mapped = std in BOOK_MAPPING.values() or std in ("Gen", "Exo", "Lev", "Num", "Deu")
    print(f"  Raw: {rc:8s} -> Std: {std:6s} -> Fr: {fr:15s} (valid: {mapped})")
