import json
import os
import sys

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

path = r"C:\Users\adrie\kDrive\Documents\Théologie\Ressources externes\Ebooks\Bibles\sagesse_vivante.json"
print("File exists:", os.path.exists(path))
if not os.path.exists(path):
    sys.exit(1)

with open(path, "r", encoding="utf-8") as f:
    data = json.load(f)

print("Type of data:", type(data))
if isinstance(data, dict):
    print("Keys in sagesse_vivante.json:", list(data.keys()))
    for k in data:
        v = data[k]
        if isinstance(v, dict):
            print(f"  {k:25s}: {len(v)} chapters, sample ch1 verses: {len(v.get('1', {}))}")
        elif isinstance(v, list):
            print(f"  {k:25s}: list of {len(v)} items")
