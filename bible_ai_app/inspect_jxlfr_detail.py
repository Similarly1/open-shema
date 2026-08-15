import os
import json
import sys

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

path = r"c:\Users\adrie\kDrive\Documents\Site chants de la bible\Antigravity\data_jxlfr_2026"
json_files = [f for f in os.listdir(path) if f.endswith(".json")]

print("Files in JXLFR:", json_files)

for jf in json_files[:3]:
    with open(os.path.join(path, jf), "r", encoding="utf-8") as f:
        d = json.load(f)
    print(f"\n--- {jf} ---")
    print(f"Book: {d.get('name')}, Code: {d.get('code')}, Version: {d.get('version')}, Fullname: {d.get('version_fullname')}")
    chapters = d.get("chapters", {})
    first_ch = list(chapters.keys())[0] if chapters else None
    if first_ch:
        verses = chapters[first_ch]
        first_v = list(verses.keys())[0] if verses else None
        if first_v:
            val = verses[first_v]
            print(f"Verse {first_ch}:{first_v} type: {type(val)}")
            print(f"Verse {first_ch}:{first_v} content: {val}")
