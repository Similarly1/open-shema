import os
import json
import re
import sys

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

def clean_bible_text(text):
    if not text:
        return ""
    if not isinstance(text, str):
        return text
    # 1. Balises malformées ou complètes publishing_chapter_number
    text = re.sub(r'<publishing_chapter_number>.*?</?publishing_chapter_number>', '', text)
    text = re.sub(r'</?publishing_chapter_number>', '', text)
    text = re.sub(r'<footnote>.*?</footnote>', '', text, flags=re.DOTALL)
    text = re.sub(r'<cross_reference>.*?</cross_reference>', '', text, flags=re.DOTALL)
    # 2. Toutes autres balises XML/HTML (<insert_footnote />, <dictionary_word>, etc.)
    text = re.sub(r'<[^>]+>', '', text)
    # 3. Marqueurs {{field-on:...}}
    text = re.sub(r'\{\{field-on:.*?\}\}', '', text)
    text = re.sub(r'\{\{field-off:.*?\}\}', '', text)
    # 4. Normalisation des espaces
    text = re.sub(r'[\xa0\u200b\u202f]+', ' ', text)
    text = re.sub(r'\s+([,.;:!?»\)])', r'\1', text)
    text = re.sub(r'([«\(])\s+', r'\1', text)
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

bibles_dir = os.path.join(os.path.dirname(__file__), "data", "bibles")
cleaned_files = 0
cleaned_verses = 0

for b_folder in os.listdir(bibles_dir):
    b_path = os.path.join(bibles_dir, b_folder)
    if os.path.isdir(b_path):
        for f in os.listdir(b_path):
            if f.endswith(".json"):
                f_path = os.path.join(b_path, f)
                try:
                    with open(f_path, "r", encoding="utf-8") as fp:
                        data = json.load(fp)
                    modified = False
                    chapters = data.get("chapters", {})
                    for ch, verses in chapters.items():
                        if isinstance(verses, dict):
                            for v_num, v_val in verses.items():
                                if isinstance(v_val, str):
                                    c_val = clean_bible_text(v_val)
                                    if c_val != v_val:
                                        verses[v_num] = c_val
                                        modified = True
                                        cleaned_verses += 1
                                elif isinstance(v_val, dict):
                                    # Pour format juxtalinéaire
                                    for subk, subv in v_val.items():
                                        if isinstance(subv, str):
                                            c_sub = clean_bible_text(subv)
                                            if c_sub != subv:
                                                v_val[subk] = c_sub
                                                modified = True
                                                cleaned_verses += 1
                    if modified:
                        with open(f_path, "w", encoding="utf-8") as fp:
                            json.dump(data, fp, ensure_ascii=False, indent=2)
                        cleaned_files += 1
                except Exception as e:
                    print(f"Erreur sur {f_path}: {e}")

print(f"Nettoyage terminé : {cleaned_files} fichiers modifiés, {cleaned_verses} versets nettoyés.")
