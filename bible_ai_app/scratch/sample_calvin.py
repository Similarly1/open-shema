import os
import json
import random

livres_dir = r"c:\Users\adrie\Documents\antigravity\peaceful-mendeleev\bible_ai_app\data\commentaires\03_calvin\livres"
files = [f for f in os.listdir(livres_dir) if f.endswith(".json")]

random.seed(123)
sampled_files = random.sample(files, min(8, len(files)))

for i, bf in enumerate(sampled_files, 1):
    f_path = os.path.join(livres_dir, bf)
    with open(f_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    b_name = data.get("book_name", bf[:-5])
    chapters = data.get("chapters", [])
    if not chapters:
        continue
    ch = random.choice(chapters)
    verses = ch.get("verses", [])
    if not verses:
        continue
    v = random.choice(verses)
    
    ref = v.get("reference", f"{b_name} {ch.get('chapter')}:{v.get('verse_start')}")
    txt = v.get("text", "")
    print(f"\n==================== [{i}] {ref} ====================")
    print(txt[:700] + ("..." if len(txt) > 700 else ""))
