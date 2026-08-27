#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import os, sys, json, re
sys.stdout.reconfigure(encoding='utf-8')

def sanitize_vigouroux_cache():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    cache_path = os.path.join(base_dir, 'data', 'dictionaries', 'polished_cache.json')
    if not os.path.exists(cache_path):
        print(f"❌ Erreur : {cache_path} introuvable.")
        return

    print(f"Ο Chargement de {cache_path}...")
    with open(cache_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    total_entries = len(data)
    vigouroux_entries = 0
    modified_entries = 0

    for key, item in data.items():
        if not key.startswith('vigouroux:'):
            continue
        vigouroux_entries += 1
        text = item.get('text', '')
        if not text:
            continue

        original_text = text
        lines = text.split('\n')
        new_lines = []

        for i in range(len(lines)):
            line = lines[i]
            line_stripped = line.strip()

            # if 'Voir aussi :' completement vide
            if re.match(r'^[*\s•-]*(?:Voir|V\.)(?:\s+(?:aussi|également))?\s*:?\s*$', line_stripped, re.I):
                continue

            # Corriger les virgules orphelines avant renvoi Voir
            if line_stripped.endswith(','):
                next_is_see = False
                for j in range(i + 1, min(i + 4, len(lines))):
                    nxt = lines[j].strip()
                    if nxt:
                        if re.match(r'^[*\s•-]*(?:Voir|V\.)', nxt, re.I):
                            next_is_see = True
                        break
                if next_is_see:
                    line = re.sub(r',\s*$', ' :', line)

            # Nettoyer les liens markdown dans les lignes Voir (ex: [ABEL](#) -> ABEL)
            if re.match(r'^[*\s•-]*(?:Voir|V\.)', line_stripped, re.I):
                line = re.sub(r'\[([^\]]+)\](?:\([^\)]*\))?', r'\1', line)

            new_lines.append(line)

        cleaned_text = '\n'.join(new_lines)
        if cleaned_text != original_text:
            item['text'] = cleaned_text
            modified_entries += 1

    print(f"🔓 Bilan d'assainiissement :")
    print(f"   • Total entrées en cache : {total_entries}")
    print(f"   • Entrées Vigouroux inspectées : {vigouroux_entries}")
    print(f"   • Entrées Vigouroux assainies : {modified_entries}")

    if modified_entries > 0:
        tmp_path = cache_path + '.tmp'
        with open(tmp_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        os.replace(tmp_path, cache_path)
        print("✅ Sauvegarde terminƩe avec succèss dans polished_cache.json !")
    else:
        print("✨ Toutes les entrées étaient déjà parfaitement conformes.")

if __name__ == '__main__':
    sanitize_vigouroux_cache()
