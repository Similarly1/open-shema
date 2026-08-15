import re
import sys
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

from core.strong_lexicon import StrongLexicon

def parse_verse_segments(text):
    tokens = re.split(r'(<w\s+strong="[^"]*">.*?</w>)', text)
    result = []
    for t in tokens:
        if not t:
            continue
        m = re.match(r'<w\s+strong="([^"]*)">(.*?)</w>', t)
        if m:
            result.append({
                "type": "strong",
                "strong": m.group(1),
                "word": m.group(2)
            })
        else:
            # Nettoyer les balises orphelines éventuelles
            clean_t = re.sub(r'<[^>]+>', '', t)
            if clean_t:
                result.append({
                    "type": "text",
                    "text": clean_t
                })
    return result

sample = 'Au <w strong="H7225">commencement</w>, <w strong="H0430">Dieu</w> <w strong="H1254">créa</w> les <w strong="H8064">cieux</w> et la <w strong="H0776">terre</w>.'
segments = parse_verse_segments(sample)
print("Parsed segments:", segments)

for seg in segments:
    if seg["type"] == "strong":
        e = StrongLexicon.get_multiple(seg["strong"])
        lemmas = " ".join([f"{x['lemma']}‹{x['short_code']}›" for x in e])
        print(f"Word: {seg['word']:15s} -> Gloss: {lemmas}")
