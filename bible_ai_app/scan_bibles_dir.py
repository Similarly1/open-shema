import os
import json
import sys

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

target_dir = r"C:\Users\adrie\kDrive\Documents\Théologie\Ressources externes\Bibles JSON"
print("Directory exists:", os.path.exists(target_dir))
if not os.path.exists(target_dir):
    sys.exit(1)

entries = os.listdir(target_dir)
print(f"Total entries in directory: {len(entries)}")

for idx, entry in enumerate(entries):
    full_p = os.path.join(target_dir, entry)
    if os.path.isfile(full_p):
        size_kb = os.path.getsize(full_p) / 1024
        print(f"\n[{idx+1}] FILE: {entry} ({size_kb:.1f} KB)")
        if entry.endswith(".json"):
            try:
                with open(full_p, "r", encoding="utf-8") as f:
                    data = json.load(f)
                if isinstance(data, dict):
                    keys = list(data.keys())
                    print(f"    Root Dict keys ({len(keys)}): {keys[:10]}")
                    first_k = keys[0] if keys else None
                    if first_k:
                        sample_val = data[first_k]
                        print(f"    Sample '{first_k}' type: {type(sample_val)}")
                        if isinstance(sample_val, dict):
                            subkeys = list(sample_val.keys())
                            print(f"      Subkeys ({len(subkeys)}): {subkeys[:10]}")
                            first_sub = subkeys[0] if subkeys else None
                            if first_sub and isinstance(sample_val[first_sub], dict):
                                v_sub = list(sample_val[first_sub].keys())[0]
                                print(f"      Sample {first_k}[{first_sub}][{v_sub}]: {str(sample_val[first_sub][v_sub])[:100]}")
                elif isinstance(data, list):
                    print(f"    Root List length: {len(data)}")
                    if data:
                        print(f"    Sample item 0: {type(data[0])} - {str(data[0])[:120]}")
            except Exception as e:
                print(f"    Error reading json: {e}")
    elif os.path.isdir(full_p):
        subfiles = os.listdir(full_p)
        json_subfiles = [sf for sf in subfiles if sf.endswith(".json")]
        print(f"\n[{idx+1}] FOLDER: {entry} ({len(subfiles)} files, {len(json_subfiles)} JSON)")
        if json_subfiles:
            print(f"    First 3 files: {json_subfiles[:3]}")
            sample_sf = os.path.join(full_p, json_subfiles[0])
            try:
                with open(sample_sf, "r", encoding="utf-8") as f:
                    data = json.load(f)
                if isinstance(data, dict):
                    print(f"    Sample {json_subfiles[0]} keys: {list(data.keys())}")
                    print(f"    Version: {data.get('version')}, Fullname: {data.get('version_fullname')}")
            except Exception as e:
                print(f"    Error reading subfile: {e}")
