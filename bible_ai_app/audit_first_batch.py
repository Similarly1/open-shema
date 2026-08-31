import json
import os
import sys
import re
from collections import defaultdict

sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from core.translation_manager import TranslationManager

cache_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "commentaires", "tgc_francais", "tgc_translation_cache.json")
if not os.path.exists(cache_path):
    print("❌ Fichier de cache introuvable.")
    sys.exit(1)

with open(cache_path, "r", encoding="utf-8") as f:
    cache = json.load(f)

print("=" * 80)
print(f"🔬 CONTRÔLE QUALITÉ APPROFONDI DU PREMIER LOT ({len(cache)} CHAPITRES TRADUITS)")
print("=" * 80)

books_stats = defaultdict(lambda: {'chapters': [], 'chunks': 0, 'words': 0, 'models': set(), 'en_chunks': 0, 'fr_chunks': 0})
total_words = 0
total_chunks = 0
emoji_pattern = re.compile(r'[\U00010000-\U0010ffff]', flags=re.UNICODE)
emoji_found = 0
meta_found = 0

sample_passages = []

for k, v in cache.items():
    b_code = v.get('book_code', k.split(':')[0])
    c_num = v.get('chapter', k.split(':')[1])
    chunks = v.get('chunks', [])
    
    books_stats[b_code]['chapters'].append(c_num)
    books_stats[b_code]['chunks'] += len(chunks)
    books_stats[b_code]['models'].add(v.get('model', 'inconnu'))
    
    for c_idx, c in enumerate(chunks):
        total_chunks += 1
        text = c.get('text', '')
        w = len(text.split())
        total_words += w
        books_stats[b_code]['words'] += w
        
        if emoji_pattern.search(text):
            emoji_found += 1
        if "voici la traduction" in text.lower() or "en tant que traducteur" in text.lower():
            meta_found += 1
            
        lang = TranslationManager.detect_language(text[:400]) if len(text) > 50 else 'fr'
        if lang == 'fr':
            books_stats[b_code]['fr_chunks'] += 1
        else:
            books_stats[b_code]['en_chunks'] += 1
            
        # Conserver quelques échantillons significatifs de théologie
        if b_code in ['1Co', '1Sa', 'Exo', '1Ti', 'Tit', 'Col', 'Act'] and len(sample_passages) < 6:
            if c_idx == 0 and len(text) > 200 and lang == 'fr':
                sample_passages.append({
                    'book': b_code,
                    'chap': c_num,
                    'title': c.get('title'),
                    'ref': c.get('reference'),
                    'text': text[:500]
                })

print("\n📊 1. INVENTAIRE DES LIVRES DU PREMIER LOT :")
print(f"{'Livre':<8} | {'Chapitres':<12} | {'Péricopes':<10} | {'Mots FR':<10} | {'Conformité FR':<14} | {'Modèles'}")
print("-" * 80)
for b, s in sorted(books_stats.items()):
    c_list = sorted([int(x) for x in s['chapters'] if str(x).isdigit()])
    c_str = f"{len(c_list)} ch ({min(c_list)}-{max(c_list)})" if c_list else f"{len(s['chapters'])} ch"
    pct_fr = (s['fr_chunks'] / s['chunks'] * 100) if s['chunks'] > 0 else 0
    m_str = ', '.join(s['models'])
    print(f"{b:<8} | {c_str:<12} | {s['chunks']:^10} | {s['words']:>9,} | {pct_fr:>11.1f}%   | {m_str}")

print("-" * 80)
print(f"TOTAL : {len(cache)} chapitres | {total_chunks} péricopes | {total_words:,} mots traduits")
print(f"• Présence d'émojis parasites : {emoji_found} (0 attendu)")
print(f"• Présence de méta-commentaires : {meta_found} (0 attendu)")

print("\n" + "=" * 80)
print("🔍 2. ÉCHANTILLONS REPRÉSENTATIFS DE TRADUCTION :")
print("=" * 80)
for sp in sample_passages:
    print(f"\n📖 [{sp['book']} Chapitre {sp['chap']}] — {sp['title']} ({sp['ref']})")
    print("-" * 70)
    print(sp['text'] + "...\n")
