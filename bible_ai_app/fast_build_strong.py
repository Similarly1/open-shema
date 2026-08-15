import zipfile
import xml.etree.ElementTree as ET
import re
import json
import time
import os
import sys

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

doc_p = r"C:\Users\adrie\kDrive\Documents\Livres Logos\DHG\Strong.docx"

t0 = time.time()
print("Extracting word/document.xml from docx...")
with zipfile.ZipFile(doc_p, 'r') as z:
    xml_content = z.read('word/document.xml')

t1 = time.time()
print(f"Extracted {len(xml_content)/(1024*1024):.1f} MB XML in {t1-t0:.2f}s. Parsing XML tree...")

root = ET.fromstring(xml_content)
t2 = time.time()
print(f"Parsed XML tree in {t2-t1:.2f}s. Extracting paragraphs...")

# XML namespace for Word
ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}

paragraphs = []
for p in root.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p'):
    texts = [t.text for t in p.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t') if t.text]
    if texts:
        paragraphs.append("".join(texts).strip())

t3 = time.time()
print(f"Extracted {len(paragraphs)} paragraphs in {t3-t2:.2f}s.")

pattern = r'\[\[@(Hebrew|Greek)Strongs:([HG]\d+)\]\](\d+)\.\s*([^:]+?)\s*:\s*(.+)'

entries = {}
current_strong = None

for txt in paragraphs:
    if not txt:
        continue
    
    m = re.search(pattern, txt)
    if m:
        lang_type = m.group(1)
        strong_code = m.group(2) # H2, G1, etc.
        strong_num = m.group(3)
        lemma = m.group(4).strip()
        definition = m.group(5).strip()
        
        prefix = strong_code[0].upper()
        num_part = int(re.sub(r'\D', '', strong_code))
        
        # We index with both 4-digit (H0430) and simple (H430) codes for instant lookup!
        std_code_4d = f"{prefix}{num_part:04d}"
        std_code_short = f"{prefix}{num_part}"
        
        entry_data = {
            "code": std_code_4d,
            "short_code": std_code_short,
            "num": num_part,
            "lang": "hebrew" if prefix == "H" else "greek",
            "lemma": lemma,
            "definition": definition,
            "details": []
        }
        entries[std_code_4d] = entry_data
        entries[std_code_short] = entry_data
        current_strong = std_code_4d
    elif current_strong:
        if not txt.startswith("[[@"):
            entries[current_strong]["details"].append(txt)
        else:
            current_strong = None

unique_entries = len({e['code'] for e in entries.values()})
print(f"\nTotal Unique Strong Entries: {unique_entries} (Hebrew + Greek)")

# Save to data/strong_lexicon.json
out_dir = os.path.join(os.path.dirname(__file__), "data")
os.makedirs(out_dir, exist_ok=True)
out_file = os.path.join(out_dir, "strong_lexicon.json")

with open(out_file, "w", encoding="utf-8") as fp:
    json.dump(entries, fp, ensure_ascii=False)

print(f"Saved complete Strong lexicon to {out_file} ({os.path.getsize(out_file)/(1024*1024):.2f} MB)")

# Samples
for test_c in ["H7225", "H0430", "H1254", "G3972", "G2424", "G5547", "G1401"]:
    if test_c in entries:
        e = entries[test_c]
        print(f"  [{test_c}] {e['lemma']} : {e['definition']}")
        if e['details']:
            print(f"      ↳ {' / '.join(e['details'][:2])}")
