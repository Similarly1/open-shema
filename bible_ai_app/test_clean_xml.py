import os
import json
import re
import sys

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

sample_verses = [
    "<publishing_chapter_number>1<publishing_chapter_number>Généalogie de Jésus-Christ, fils de David, fils d’Abraham<insert_footnote />.",
    "Abraham engendra Isaac ; Isaac engendra Jacob ; Jacob engendra Juda et ses frères ;",
    "Juda, de Thamar, engendra Pharès et Zara ; Pharès engendra Esron ; Esron engendra Aram ;",
    "Aram engendra Aminadab ; Aminadab engendra Naasson ; Naasson engendra Salmon ;",
    "Salmon, de Rahab, engendra Booz ; Booz, de Ruth, engendra Obed ; Obed engendra Jessé ; Jessé engendra le roi David<insert_footnote />.",
    "David engendra Salomon, de celle qui fut la femme d’Urie <insert_footnote /> ;",
    "Salomon engendra Roboam ; Roboam engendra Abias ; Abias engendra Asa ;",
    "Asa engendra Josaphat ; Josaphat engendra Joram ; Joram engendra Ozias ;",
    "Ozias engendra Joathan ; Joathan engendra Achaz ; Achaz engendra Ezéchias ;",
    "Ezéchias engendra Manassé ; Manassé engendra Amon ; Amon engendra Josias ;",
    "Josias engendra Jéchonias et ses frères, au temps de la déportation à Babylone <insert_footnote />.",
    "Et après la déportation à Babylone, Jéchonias engendra Salathiel ; Salathiel engendra Zorobabel ;"
]

def clean_bible_text(text):
    if not text:
        return ""
    # 1. Supprimer les balises et leur contenu pour publishing_chapter_number, footnote, xref
    text = re.sub(r'<publishing_chapter_number>.*?</publishing_chapter_number>', '', text)
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

print("Cleaned Sample Verses:")
for i, v in enumerate(sample_verses, 1):
    cleaned = clean_bible_text(v)
    print(f"  {i:2d} {cleaned}")
