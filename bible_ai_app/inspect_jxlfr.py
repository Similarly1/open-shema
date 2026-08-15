import os
import json
import sys

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

path = r"c:\Users\adrie\kDrive\Documents\Site chants de la bible\Antigravity\data_jxlfr_2026"
print("Path exists:", os.path.exists(path))
print("Is directory:", os.path.isdir(path))

if os.path.isdir(path):
    files = os.listdir(path)
    print(f"Total files in folder: {len(files)}")
    print("First 10 files:", files[:10])
    print("Last 5 files:", files[-5:])
    
    # Check first file
    json_files = [f for f in files if f.endswith(".json")]
    if json_files:
        first_p = os.path.join(path, json_files[0])
        with open(first_p, "r", encoding="utf-8") as f:
            data = json.load(f)
        print("\nSample first JSON file keys:", list(data.keys()) if isinstance(data, dict) else type(data))
        if isinstance(data, dict):
            for k in ["id", "code", "name", "version", "version_fullname", "total_chapters"]:
                print(f"  {k}: {data.get(k)}")
            ch1 = data.get("chapters", {}).get("1", {})
            print(f"  Chapter 1 verses count: {len(ch1)}")
            if ch1:
                first_v = list(ch1.keys())[0]
                print(f"  Chapter 1 verse {first_v}: {str(ch1[first_v])[:120]}")
elif os.path.isfile(path):
    print("File size:", os.path.getsize(path))
