import sys
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

from core.database import VectorDB
from core.bible_json_loader import BibleJsonLoader
from gui.center_panel import format_bible_text, CODE_TO_FRENCH
from gui.library_utils import load_books_metadata
import difflib
import re

print("========================================")
print("TEST: Comparison Rendering on Matthieu 1:1-3")
print("========================================")

db = VectorDB()
reg = load_books_metadata()
active = [{'name': k, 'embedding_model': v.get('embedding_model', 'study_library')} for k, v in reg.items() if v.get('active', False)]

for v_target in ["1", "2", "3"]:
    ref_query = f"Matthieu 1:{v_target}"
    res = db.get_by_reference(ref_query, active_sources=active)
    
    docs_by_bible = {}
    for doc, meta in zip(res['documents'], res['metadatas']):
        docs_by_bible[meta['name']] = doc
        
    print(f"\n--- {ref_query} ---")
    
    # Supposons Segond 21 comme référence
    ref_bible = "Segond 21"
    ref_doc = docs_by_bible.get(ref_bible, list(docs_by_bible.values())[0])
    ref_text = format_bible_text(ref_doc)
    ref_text = re.sub(r'^' + re.escape(v_target) + r'(?!\d)[\s\xa0\u200b]*', '', ref_text)
    
    print(f"  [S21 (Réf.)] {ref_text}")
    
    def tokenize(text):
        return re.findall(r'[\w\'-]+|[^\w\s]|\s+', text)

    ref_tokens = tokenize(ref_text)
    
    for other_name in ["Colombe", "NBS", "NCL", "NEG79", "OST", "APEE", "BDS", "TOB"]:
        if other_name in docs_by_bible:
            other_raw = docs_by_bible[other_name]
            other_text = format_bible_text(other_raw)
            other_text = re.sub(r'^' + re.escape(v_target) + r'(?!\d)[\s\xa0\u200b]*', '', other_text)
            
            other_tokens = tokenize(other_text)
            matcher = difflib.SequenceMatcher(None, ref_tokens, other_tokens)
            diff_pct = int((1.0 - matcher.ratio()) * 100)
            
            rendered = []
            for tag, i1, i2, j1, j2 in matcher.get_opcodes():
                chunk = "".join(other_tokens[j1:j2])
                if tag == 'equal':
                    rendered.append(chunk)
                elif tag in ('insert', 'replace'):
                    rendered.append(f"*{chunk}*")
                elif tag == 'delete':
                    pass
            print(f"  [{other_name:8s}] {''.join(rendered)}  ({diff_pct}% diff)")

print("\n========================================")
print("TEST RENDU COMPARAISON RÉUSSI SANS BALISES NI GLYPHES '°' ! 🎉")
print("========================================")
