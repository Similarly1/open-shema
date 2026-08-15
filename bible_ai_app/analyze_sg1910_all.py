import csv
import sys
import re

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

path = r"C:\Users\adrie\kDrive\Documents\Théologie\Ressources externes\Ebooks\Bibles\Sg1910.csv"

from core.reference_parser import get_standard_book_code, get_french_book_name

books_data = {}
total_verses = 0

with open(path, "r", encoding="utf-8-sig") as f:
    reader = csv.reader(f, delimiter="\t")
    headers = next(reader)
    for row in reader:
        if len(row) >= 4:
            raw_b, ch, v, txt = row[0].strip(), row[1].strip(), row[2].strip(), row[3]
            std_b = get_standard_book_code(raw_b)
            if std_b not in books_data:
                books_data[std_b] = {}
            if ch not in books_data[std_b]:
                books_data[std_b][ch] = {}
            books_data[std_b][ch][v] = txt
            total_verses += 1

print(f"Total verses loaded from CSV: {total_verses}")
print(f"Total books: {len(books_data)}")
for std_b in list(books_data.keys())[:10]:
    fr = get_french_book_name(std_b)
    ch_cnt = len(books_data[std_b])
    v_cnt = sum(len(v) for v in books_data[std_b].values())
    print(f"  {std_b:5s} ({fr:15s}) : {ch_cnt:3d} chapitres, {v_cnt:4d} versets")
