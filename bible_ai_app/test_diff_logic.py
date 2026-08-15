import difflib
import re
import sys

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

ref_text = "Voici la généalogie de Jésus-Christ, fils de David, fils d'Abraham."
other_text = "Généalogie de Jésus-Christ, fils de David, fils d'Abraham."

print("=== Character Level Diff ===")
matcher = difflib.SequenceMatcher(None, ref_text, other_text)
print("Ratio:", matcher.ratio(), "Diff %:", int((1.0 - matcher.ratio()) * 100))
out_char = []
for tag, i1, i2, j1, j2 in matcher.get_opcodes():
    if tag == 'equal':
        out_char.append(other_text[j1:j2])
    elif tag == 'insert':
        out_char.append(f"[+{other_text[j1:j2]}]")
    elif tag == 'replace':
        out_char.append(f"[~{other_text[j1:j2]}]")
    elif tag == 'delete':
        out_char.append("°")
print("Rendered Char Diff:", "".join(out_char))

print("\n=== Word/Token Level Diff ===")
def tokenize(text):
    # Conserve les mots, la ponctuation et les espaces comme tokens séparés
    return re.findall(r'\w+|[^\w\s]|\s+', text)

ref_tokens = tokenize(ref_text)
other_tokens = tokenize(other_text)

word_matcher = difflib.SequenceMatcher(None, ref_tokens, other_tokens)
print("Word Ratio:", word_matcher.ratio(), "Diff %:", int((1.0 - word_matcher.ratio()) * 100))
out_word = []
for tag, i1, i2, j1, j2 in word_matcher.get_opcodes():
    chunk = "".join(other_tokens[j1:j2])
    if tag == 'equal':
        out_word.append(chunk)
    elif tag == 'insert':
        out_word.append(f"[+{chunk}]")
    elif tag == 'replace':
        out_word.append(f"[~{chunk}]")
    elif tag == 'delete':
        # En comparaison entre traductions, pas besoin de mettre de vilains '°' dans le texte d'une autre version
        pass
print("Rendered Word Diff:", "".join(out_word))
