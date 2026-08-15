import re
import difflib
import sys

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

def clean_bible_text(text):
    if not text:
        return ""
    # 1. Supprimer les balises malformées ou complètes publishing_chapter_number
    text = re.sub(r'<publishing_chapter_number>.*?</?publishing_chapter_number>', '', text)
    text = re.sub(r'</?publishing_chapter_number>', '', text)
    text = re.sub(r'<footnote>.*?</footnote>', '', text, flags=re.DOTALL)
    text = re.sub(r'<cross_reference>.*?</cross_reference>', '', text, flags=re.DOTALL)
    # 2. Supprimer toutes les autres balises XML/HTML (<insert_footnote />, <dictionary_word>, etc.)
    text = re.sub(r'<[^>]+>', '', text)
    # 3. Supprimer {{field-on:...}}
    text = re.sub(r'\{\{field-on:.*?\}\}', '', text)
    text = re.sub(r'\{\{field-off:.*?\}\}', '', text)
    # 4. Normaliser espaces
    text = re.sub(r'[\xa0\u200b\u202f]+', ' ', text)
    text = re.sub(r'\s+([,.;:!?»\)])', r'\1', text)
    text = re.sub(r'([«\(])\s+', r'\1', text)
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def tokenize(text):
    # Découpe en mots, ponctuation et espaces
    return re.findall(r'[\w\'-]+|[^\w\s]|\s+', text)

# Test with BDS as reference
ref_raw = 'Voici la généalogie de Jésus-Christ, de la descendance de David et d’Abraham.'
other_raws = {
    "COL": "1\xa0Généalogie de Jésus–Christ, fils de David, fils d'Abraham.\n",
    "NBS": "Généalogie de Jésus-Christ, fils de David, fils d'Abraham.",
    "NCL": "<publishing_chapter_number>1<publishing_chapter_number>Généalogie de Jésus-Christ, fils de David, fils d’Abraham<insert_footnote />.",
    "NEG79": "Généalogie de Jésus-Christ, fils de David, fils d'Abraham.",
    "S21": "Voici la généalogie de Jésus-Christ, fils de David, fils d'Abraham."
}

ref_clean = clean_bible_text(ref_raw)
ref_tokens = tokenize(ref_clean)

print("=== Référence (BDS) ===")
print(" ", ref_clean)
print("\n=== Bibles comparées (Word-Level Diff) ===")

for abbr, raw_t in other_raws.items():
    clean_t = clean_bible_text(raw_t)
    # Supprimer le numéro de verset initial s'il existe
    clean_t = re.sub(r'^1(?!\d)[\s\xa0\u200b]*', '', clean_t)
    
    other_tokens = tokenize(clean_t)
    matcher = difflib.SequenceMatcher(None, ref_tokens, other_tokens)
    diff_pct = int((1.0 - matcher.ratio()) * 100)
    
    rendered_parts = []
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        chunk = "".join(other_tokens[j1:j2])
        if tag == 'equal':
            rendered_parts.append(chunk)
        elif tag == 'insert':
            rendered_parts.append(f"[{chunk}]")
        elif tag == 'replace':
            rendered_parts.append(f"[{chunk}]")
        elif tag == 'delete':
            # Ignorer pour ne pas insérer de symboles bizarres dans le texte
            pass
            
    print(f"{abbr:5s} {''.join(rendered_parts)}  ({diff_pct}% de diff.)")
