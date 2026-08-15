import json
import os
import sys

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

path = r"C:\Users\adrie\kDrive\Documents\Théologie\Ressources externes\Ebooks\Bibles\bible_tob.json"
print("File exists:", os.path.exists(path))
if not os.path.exists(path):
    sys.exit(1)

print("File size:", os.path.getsize(path), "bytes")

with open(path, "r", encoding="utf-8") as f:
    data = json.load(f)

print("Type of root data:", type(data))
if isinstance(data, dict):
    print("Keys count:", len(data))
    print("First 25 keys:", list(data.keys())[:25])
    print("Last 15 keys:", list(data.keys())[-15:])
    for k in list(data.keys())[:5]:
        v = data[k]
        print(f"  Key '{k}': type={type(v)}")
        if isinstance(v, dict):
            print(f"    Subkeys: {list(v.keys())[:10]}")
            if v:
                first_ch = list(v.keys())[0]
                if isinstance(v[first_ch], dict):
                    first_v = list(v[first_ch].keys())[0]
                    print(f"    Sample {k}[{first_ch}][{first_v}]: {str(v[first_ch][first_v])[:100]}")
                else:
                    print(f"    Sample {k}[{first_ch}]: {str(v[first_ch])[:100]}")
elif isinstance(data, list):
    print("List count:", len(data))
    if data:
        print("Sample item 0:", type(data[0]), str(data[0])[:200])
