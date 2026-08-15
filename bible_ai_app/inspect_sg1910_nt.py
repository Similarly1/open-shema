import csv
import sys

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

path = r"C:\Users\adrie\kDrive\Documents\Théologie\Ressources externes\Ebooks\Bibles\Sg1910.csv"

books_seen = set()
nt_samples = []

with open(path, "r", encoding="utf-8-sig") as f:
    reader = csv.reader(f, delimiter="\t")
    headers = next(reader)
    for row in reader:
        if len(row) >= 4:
            b, ch, v, txt = row[0], row[1], row[2], row[3]
            books_seen.add(b)
            if b in ("Mat", "Joh", "Rom") and len(nt_samples) < 5:
                nt_samples.append((b, ch, v, txt))

print("Total unique books in Sg1910.csv:", len(books_seen))
print("Sample books:", sorted(list(books_seen))[:20])

print("\n--- NT Samples ---")
for b, ch, v, txt in nt_samples:
    print(f"[{b} {ch}:{v}] {txt}")
