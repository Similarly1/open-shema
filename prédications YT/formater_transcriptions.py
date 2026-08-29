#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Formateur et Nettoyeur des Transcriptions de Prédications.
Reconstruit les paragraphes et les horodatages à partir des formats bruts.
"""

import glob
import os
import re
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
TRANS_DIR = os.path.join(CURRENT_DIR, "transcriptions")
CONSOLIDATED_JSON = os.path.join(CURRENT_DIR, "corpus_transcriptions_complet_104.json")


def clean_transcript_file(fpath: str) -> dict:
    with open(fpath, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()

    parts = re.split(r'##\s*Transcription\s*int[ée]grale.*?\n+', content, flags=re.IGNORECASE)
    if len(parts) < 2:
        return None

    header = parts[0].strip()
    raw_body = parts[1].strip()

    # Si c'est déjà propre
    if 'wireMagic' not in raw_body and 'tStartMs' not in raw_body:
        # Extraire métadonnées
        v_id_match = re.search(r'video_id:\s*"([^"]+)"', header)
        t_match = re.search(r'titre:\s*"([^"]+)"', header)
        w_match = re.search(r'nombre_de_mots:\s*(\d+)', header)
        return {
            "video_id": v_id_match.group(1) if v_id_match else "",
            "titre": t_match.group(1) if t_match else "",
            "word_count": int(w_match.group(1)) if w_match else len(raw_body.split()),
            "file_path": fpath,
            "success": True
        }

    json_str = '{' + raw_body + '}' if not raw_body.startswith('{') else raw_body
    try:
        data = json.loads(json_str)
    except Exception:
        events_match = re.search(r'"events":\s*(\[.*?\])\s*\}?$', json_str, re.DOTALL)
        if events_match:
            data = {'events': json.loads(events_match.group(1))}
        else:
            return None

    paragraphs = []
    curr_text = []
    curr_start = 0.0

    for ev in data.get('events', []):
        start_s = ev.get('tStartMs', 0) / 1000.0
        segs = ev.get('segs', [])
        seg_txt = ''.join(s.get('utf8', '') for s in segs if s.get('utf8'))
        seg_clean = re.sub(r'\[.*?\]', '', seg_txt).strip()
        if not seg_clean or seg_clean == '\n':
            continue

        if not curr_text:
            curr_start = start_s

        curr_text.append(seg_clean)

        block_str = ' '.join(curr_text)
        if (start_s - curr_start) >= 40 or (seg_clean.endswith(('.', '!', '?')) and len(block_str) > 200):
            m, s = divmod(int(curr_start), 60)
            h, m = divmod(m, 60)
            ts = f'{h:02d}:{m:02d}:{s:02d}' if h > 0 else f'{m:02d}:{s:02d}'
            p_clean = re.sub(r'\s+', ' ', block_str).strip()
            paragraphs.append(f'**[{ts}]** {p_clean}')
            curr_text = []

    if curr_text:
        m, s = divmod(int(curr_start), 60)
        h, m = divmod(m, 60)
        ts = f'{h:02d}:{m:02d}:{s:02d}' if h > 0 else f'{m:02d}:{s:02d}'
        p_clean = re.sub(r'\s+', ' ', ' '.join(curr_text)).strip()
        paragraphs.append(f'**[{ts}]** {p_clean}')

    full_text = '\n\n'.join(paragraphs)
    words_count = sum(len(p.split()) - 1 for p in paragraphs)

    # Nettoyer header
    header = re.sub(r'nombre_de_mots:\s*\d+', f'nombre_de_mots: {words_count}', header)
    header = re.sub(r'\(\d[\d,]*\s*mots\)', f'({words_count:,} mots)', header)

    new_md = f'{header}\n\n---\n\n## 📜 Transcription intégrale horodatée\n\n{full_text}\n'
    with open(fpath, 'w', encoding='utf-8') as out_f:
        out_f.write(new_md)

    v_id_match = re.search(r'video_id:\s*"([^"]+)"', header)
    t_match = re.search(r'titre:\s*"([^"]+)"', header)
    return {
        "video_id": v_id_match.group(1) if v_id_match else "",
        "titre": t_match.group(1) if t_match else "",
        "word_count": words_count,
        "file_path": fpath,
        "success": True
    }


def main():
    files = glob.glob(os.path.join(TRANS_DIR, "*.md"))
    print(f"🔄 Nettoyage et structuration de {len(files)} fichiers...")
    
    cleaned_items = []
    total_words = 0
    
    for f in files:
        res = clean_transcript_file(f)
        if res and res.get("success"):
            cleaned_items.append(res)
            total_words += res.get("word_count", 0)
            
    print(f"✅ {len(cleaned_items)} transcriptions parfaitement structurées !")
    print(f"📖 Volume total : {total_words:,} mots (~{total_words/max(1, len(cleaned_items)):,.0f} mots / prédication)")


if __name__ == "__main__":
    main()
