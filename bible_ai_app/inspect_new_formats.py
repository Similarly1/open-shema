import os
import json
import sys

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

target_dir = r"C:\Users\adrie\kDrive\Documents\Théologie\Ressources externes\Bibles JSON"

# 1. Inspect fr_apee.json
print("========================================")
print("1. Inspecting fr_apee.json")
print("========================================")
apee_path = os.path.join(target_dir, "fr_apee.json")
with open(apee_path, "r", encoding="utf-8-sig") as f:
    apee_data = json.load(f)

print("Type of apee_data:", type(apee_data))
if isinstance(apee_data, dict):
    print("Keys count:", len(apee_data))
    print("Keys sample:", list(apee_data.keys())[:15])
    first_k = list(apee_data.keys())[0]
    first_v = apee_data[first_k]
    print(f"Sample book '{first_k}': type={type(first_v)}")
    if isinstance(first_v, dict):
        print(f"  Chapters in {first_k}:", list(first_v.keys())[:10])
        first_ch = list(first_v.keys())[0]
        print(f"  Verses in {first_k} {first_ch}:", list(first_v[first_ch].keys())[:10])
        print(f"  Verse {first_k} {first_ch}:1 =", first_v[first_ch].get("1"))
elif isinstance(apee_data, list):
    print("List length:", len(apee_data))
    print("Sample item 0:", apee_data[0] if apee_data else None)

# 2. Inspect Ostervald Bible
print("\n========================================")
print("2. Inspecting Ostervald Bible / Crosswire JSON format")
print("========================================")
ost_dir = os.path.join(target_dir, "Ostervald Bible")
ost_files = [f for f in os.listdir(ost_dir) if f.endswith(".json")]
print(f"Total files in Ostervald: {len(ost_files)}")
sample_ost_file = os.path.join(ost_dir, ost_files[0])
with open(sample_ost_file, "r", encoding="utf-8-sig") as f:
    ost_data = json.load(f)

print("Keys in 02-GENfra_fob.json:", list(ost_data.keys()))
print("General section:", ost_data.get("general"))
verses_sample = ost_data.get("verses", [])
print(f"Verses count: {len(verses_sample)}")
if verses_sample:
    print("Sample verse 0:", verses_sample[0])
    print("Sample verse 1:", verses_sample[1])

# 3. Inspect French néo-Crampon Libre
print("\n========================================")
print("3. Inspecting French néo-Crampon Libre")
print("========================================")
ncl_dir = os.path.join(target_dir, "French néo-Crampon Libre")
ncl_files = [f for f in os.listdir(ncl_dir) if f.endswith(".json")]
print(f"Total files in NCL: {len(ncl_files)}")
sample_ncl_file = os.path.join(ncl_dir, ncl_files[0])
with open(sample_ncl_file, "r", encoding="utf-8-sig") as f:
    ncl_data = json.load(f)
print("General section in NCL:", ncl_data.get("general"))
ncl_verses = ncl_data.get("verses", [])
print(f"NCL Verses count: {len(ncl_verses)}")
if ncl_verses:
    print("Sample NCL verse 0:", ncl_verses[0])
    print("Sample NCL verse 1:", ncl_verses[1])
