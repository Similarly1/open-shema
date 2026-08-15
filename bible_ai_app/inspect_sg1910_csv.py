import os
import csv
import sys

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

path = r"C:\Users\adrie\kDrive\Documents\Théologie\Ressources externes\Ebooks\Bibles\Sg1910.csv"
print("File exists:", os.path.exists(path))
if not os.path.exists(path):
    sys.exit(1)

size_mb = os.path.getsize(path) / (1024 * 1024)
print(f"File size: {size_mb:.2f} MB")

# Inspect first few lines
with open(path, "r", encoding="utf-8-sig", errors="replace") as f:
    sample_lines = [f.readline() for _ in range(15)]

print("\n--- First 15 raw lines ---")
for i, l in enumerate(sample_lines):
    print(f"Line {i+1}: {repr(l[:150])}")

# Detect delimiter and headers
with open(path, "r", encoding="utf-8-sig", errors="replace") as f:
    sample_text = "".join([f.readline() for _ in range(50)])

sniffer = csv.Sniffer()
try:
    dialect = sniffer.sniff(sample_text)
    delimiter = dialect.delimiter
    print(f"\nDetected delimiter: {repr(delimiter)}")
except Exception as e:
    print(f"Sniffer error: {e}, falling back to comma or tab or semicolon")
    delimiter = "\t" if "\t" in sample_lines[0] else (";" if ";" in sample_lines[0] else ",")

with open(path, "r", encoding="utf-8-sig", errors="replace") as f:
    reader = csv.reader(f, delimiter=delimiter)
    headers = next(reader)
    print(f"\nHeaders ({len(headers)}): {headers}")
    
    print("\n--- First 5 rows ---")
    for i in range(5):
        row = next(reader, None)
        if row is None:
            break
        print(f"Row {i+1}: {dict(zip(headers, row)) if len(headers)==len(row) else row}")
