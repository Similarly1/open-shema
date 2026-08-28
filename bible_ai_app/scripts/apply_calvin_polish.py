import os
import sys
import json
import sqlite3
import re

sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.reference_parser import get_french_book_name

base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
cache_path = os.path.join(base_dir, 'data', 'commentaires', '03_calvin', 'calvin_polished_cache.json')
db_path = os.path.join(base_dir, 'data', 'commentaires', 'commentaires_master.db')
livres_dir = os.path.join(base_dir, 'data', 'commentaires', '03_calvin', 'livres')

if not os.path.exists(cache_path):
    print(f"❌ Fichier cache introuvable : {cache_path}")
    sys.exit(1)

with open(cache_path, 'r', encoding='utf-8') as f:
    cache = json.load(f)

print(f"Chargement de {len(cache)} chapitres depuis le cache...")

conn = sqlite3.connect(db_path)
cur = conn.cursor()

# 1. Supprimer les anciens commentaires bruts de Calvin
cur.execute("DELETE FROM commentaries WHERE commentary_id = '3'")
print("Anciennes lignes Calvin supprimées de la base SQLite master.")

# 2. Insérer tous les versets polis
insert_rows = []
book_grouped = {}

for ch_key, ch_data in cache.items():
    b_code = ch_data.get('book')
    c_num = int(ch_data.get('chapter', 1))
    verses = ch_data.get('verses', [])
    b_name = get_french_book_name(b_code) or b_code

    if b_code not in book_grouped:
        book_grouped[b_code] = {'book_name': b_name, 'book_code': b_code, 'chapters': {}}
    
    book_grouped[b_code]['chapters'][c_num] = verses

    for v in verses:
        raw_v = str(v.get('verse') or v.get('verse_start') or '1')
        if '-' in raw_v:
            parts = raw_v.split('-')
            try:
                v_num = int(re.sub(r'\D', '', parts[0]) or 1)
                v_end = int(re.sub(r'\D', '', parts[1]) or v_num)
            except Exception:
                v_num = int(re.sub(r'\D', '', raw_v) or 1)
                v_end = v_num
        else:
            v_num = int(re.sub(r'\D', '', raw_v) or 1)
            v_end = int(v.get('verse_end') or v_num)

        ref = v.get('reference') or f"{b_name} {c_num}:{v_num}"
        md_text = v.get('markdown') or v.get('text') or ''

        insert_rows.append((
            '3',
            'Commentaire Biblique de Jean Calvin',
            b_code,
            b_name,
            c_num,
            v_num,
            v_end,
            ref,
            md_text,
            json.dumps([md_text], ensure_ascii=False),
            None,
            None
        ))

cur.executemany("""
    INSERT INTO commentaries (
        commentary_id, commentary_name, book_code, book_name,
        chapter, verse_start, verse_end, reference, text,
        paragraphs_json, html, source_url
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
""", insert_rows)

conn.commit()
conn.close()

print(f"✅ {len(insert_rows)} versets polis insérés dans {db_path} !")

# 3. Mettre à jour les fichiers JSON par livre
os.makedirs(livres_dir, exist_ok=True)
for b_code, b_info in book_grouped.items():
    json_path = os.path.join(livres_dir, f"{b_code}.json")
    chapters_list = []
    for ch_num in sorted(b_info['chapters'].keys()):
        ch_verses = b_info['chapters'][ch_num]
        chapters_list.append({
            'chapter': ch_num,
            'verse_count': len(ch_verses),
            'verses': ch_verses
        })
    book_obj = {
        'book_code': b_code,
        'book_name': b_info['book_name'],
        'commentary_id': '3',
        'commentary_name': 'Commentaire Biblique de Jean Calvin',
        'total_chapters': len(chapters_list),
        'chapters': chapters_list
    }
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(book_obj, f, ensure_ascii=False, indent=2)

print(f"✅ {len(book_grouped)} fichiers livres JSON mis à jour avec le Markdown poli !")
