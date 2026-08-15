import sys
import re
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

from core.strong_lexicon import StrongLexicon

sample_verse = 'Au <w strong="H7225">commencement</w>, <w strong="H0430">Dieu</w> <w strong="H1254">créa</w> les <w strong="H8064">cieux</w> et la <w strong="H0776">terre</w>.'

def render_interlinear_sample(raw_text):
    tokens = re.split(r'(<w strong="[^"]*">.*?</w>)', raw_text)
    out_clean = []
    out_interlinear = []
    
    for token in tokens:
        if not token:
            continue
        m = re.match(r'<w strong="([^"]*)">(.*?)</w>', token)
        if m:
            strong_str = m.group(1)
            word = m.group(2)
            out_clean.append(word)
            
            strong_entries = StrongLexicon.get_multiple(strong_str)
            lemmas = [f"{e['lemma']} ({e['short_code']})" for e in strong_entries]
            out_interlinear.append(f"{word}[{' / '.join(lemmas)}]")
        else:
            out_clean.append(token)
            out_interlinear.append(token)
            
    return "".join(out_clean), "".join(out_interlinear)

clean, inter = render_interlinear_sample(sample_verse)
print("=== Texte Français Pur ===")
print(clean)
print("\n=== Rendu Interlinéaire Inversé ===")
print(inter)

nt_sample = '<w strong="G3972">Paul</w>, <w strong="G1401">serviteur</w> de <w strong="G2424">Jésus</w>-<w strong="G5547">Christ</w>, <w strong="G2822">appelé</w> à être <w strong="G0652">apôtre</w>'
clean_nt, inter_nt = render_interlinear_sample(nt_sample)
print("\n=== NT Épître aux Romains ===")
print(clean_nt)
print(inter_nt)
