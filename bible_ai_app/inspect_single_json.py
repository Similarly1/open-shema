import json
import os
import sys

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

path = r"C:\Users\adrie\kDrive\Documents\Théologie\Ressources externes\Ebooks\Bible Parole Vivante\bible_parole_vivante.json"
with open(path, "r", encoding="utf-8") as f:
    data = json.load(f)

print(f"Total books in file: {len(data)}")
print("Books list:", list(data.keys()))

total_verses = 0
for b_name, chapters in data.items():
    v_count = sum(len(v) for ch, v in chapters.items())
    total_verses += v_count
    print(f"  {b_name:20s}: {len(chapters):3d} ch, {v_count:4d} verses")

print(f"Total verses in parole vivante: {total_verses}")
