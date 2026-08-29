#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script de Téléchargement des Transcriptions Françaises des Prédications YouTube.
Source : corpus_predications_104.json
Télécharge et structure le texte intégral de chaque prédication en paragraphes lisibles.
"""

import os
import sys
import json
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from youtube_transcript_api import YouTubeTranscriptApi
import yt_dlp
import requests

# Encodage console UTF-8
sys.stdout.reconfigure(encoding='utf-8')

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
INPUT_CORPUS_JSON = os.path.join(CURRENT_DIR, "corpus_predications_104.json")
OUTPUT_DIR = os.path.join(CURRENT_DIR, "transcriptions")
CONSOLIDATED_JSON = os.path.join(CURRENT_DIR, "corpus_transcriptions_complet_104.json")

LANGUES_FR = ['fr', 'fr-FR', 'fr-CA', 'fr-CH', 'fr-BE']


def format_seconds(secs: float) -> str:
    m, s = divmod(int(secs), 60)
    h, m = divmod(m, 60)
    if h > 0:
        return f"{h:02d}:{m:02d}:{s:02d}"
    return f"{m:02d}:{s:02d}"


def group_transcript_into_paragraphs(transcript_entries: list, time_window_seconds: int = 40) -> tuple[str, list]:
    """
    Regroupe les courts segments sous-titres en paragraphes fluides avec horodatage propre.
    """
    paragraphs = []
    structured_blocks = []
    
    current_block_text = []
    current_start_time = 0.0
    
    for entry in transcript_entries:
        # Supporte à la fois les objets de FetchedTranscriptSnippet et les dictionnaires bruts
        txt = getattr(entry, 'text', '') if hasattr(entry, 'text') else entry.get('text', '')
        start = getattr(entry, 'start', 0.0) if hasattr(entry, 'start') else entry.get('start', 0.0)
        
        txt = re.sub(r'\[.*?\]', '', txt).strip()
        if not txt:
            continue
            
        if not current_block_text:
            current_start_time = start
            
        current_block_text.append(txt)
        
        # Découpage naturel : fin de phrase ou fenêtre temporelle de 40-50s
        block_str = " ".join(current_block_text)
        if (start - current_start_time) >= time_window_seconds or (txt.endswith(('.', '!', '?')) and len(block_str) > 200):
            p_clean = re.sub(r'\s+', ' ', block_str).strip()
            ts_str = format_seconds(current_start_time)
            paragraphs.append(f"**[{ts_str}]** {p_clean}")
            structured_blocks.append({
                "start": current_start_time,
                "timestamp": ts_str,
                "text": p_clean
            })
            current_block_text = []
            
    if current_block_text:
        block_str = " ".join(current_block_text)
        p_clean = re.sub(r'\s+', ' ', block_str).strip()
        ts_str = format_seconds(current_start_time)
        paragraphs.append(f"**[{ts_str}]** {p_clean}")
        structured_blocks.append({
            "start": current_start_time,
            "timestamp": ts_str,
            "text": p_clean
        })
        
    full_text = "\n\n".join(paragraphs)
    return full_text, structured_blocks


def parse_json3_subtitles(json3_content: str) -> list:
    """Parse le format sous-titres json3 retourné par YouTube/yt-dlp."""
    entries = []
    try:
        data = json.loads(json3_content)
        for ev in data.get('events', []):
            start_ms = ev.get('tStartMs', 0)
            segs = ev.get('segs', [])
            txt_parts = [s.get('utf8', '') for s in segs if s.get('utf8')]
            line = "".join(txt_parts).strip()
            if line and line != "\n":
                entries.append({'start': start_ms / 1000.0, 'text': line})
    except Exception:
        pass
    return entries


def fetch_transcript_for_video(video_item: dict) -> dict:
    video_id = video_item.get('video_id')
    title = video_item.get('titre', 'Sans titre')
    
    res = {
        "video_id": video_id,
        "titre": title,
        "url": video_item.get('url', f"https://www.youtube.com/watch?v={video_id}"),
        "source": video_item.get('source', ''),
        "duree_secondes": video_item.get('duree_secondes', 0),
        "duree_formatee": format_seconds(video_item.get('duree_secondes', 0)),
        "success": False,
        "error": "",
        "word_count": 0,
        "full_text": "",
        "blocks": []
    }
    
    # 1. Méthode principale : YouTubeTranscriptApi API instance
    try:
        api = YouTubeTranscriptApi()
        transcript_list = api.list(video_id)
        transcript = None
        for t in transcript_list:
            if any(t.language_code.lower().startswith(c.lower()) for c in ['fr']):
                transcript = t
                break
        if not transcript:
            try:
                transcript = transcript_list.find_transcript(LANGUES_FR)
            except Exception:
                pass
        if transcript:
            raw_entries = transcript.fetch()
            if raw_entries and len(raw_entries) > 0:
                full_text, blocks = group_transcript_into_paragraphs(raw_entries)
                words = [w for b in blocks for w in b['text'].split()]
                res["success"] = True
                res["full_text"] = full_text
                res["blocks"] = blocks
                res["word_count"] = len(words)
                return res
    except Exception as e:
        err_msg = str(e)

    # 2. Méthode de secours : yt-dlp
    try:
        ydl_opts = {
            'skip_download': True,
            'writesubtitles': True,
            'writeautomaticsub': True,
            'subtitleslangs': ['fr'],
            'quiet': True
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            v_info = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=False)
            sub_url = None
            if v_info:
                subs = v_info.get('subtitles', {}) or v_info.get('automatic_captions', {})
                for code in LANGUES_FR:
                    if code in subs and len(subs[code]) > 0:
                        sub_url = subs[code][0].get('url')
                        break
                        
            if sub_url:
                r = requests.get(sub_url, timeout=15)
                if r.status_code == 200:
                    raw_entries = parse_json3_subtitles(r.text)
                    if raw_entries:
                        full_text, blocks = group_transcript_into_paragraphs(raw_entries)
                        words = [w for b in blocks for w in b['text'].split()]
                        res["success"] = True
                        res["full_text"] = full_text
                        res["blocks"] = blocks
                        res["word_count"] = len(words)
                        return res
    except Exception as e2:
        err_msg = f"{err_msg} | Secours: {e2}"
        
    res["error"] = err_msg
    return res


def sanitize_filename(title: str, video_id: str) -> str:
    clean = re.sub(r'[^\w\s-]', '', title.lower(), flags=re.UNICODE)
    clean = re.sub(r'[-\s]+', '-', clean).strip('-')[:50].rstrip('-')
    if not clean:
        clean = "predication"
    return f"{clean}_{video_id}.md"


def main():
    if not os.path.exists(INPUT_CORPUS_JSON):
        print(f"❌ Fichier introuvable : {INPUT_CORPUS_JSON}")
        sys.exit(1)
        
    with open(INPUT_CORPUS_JSON, 'r', encoding='utf-8') as f:
        corpus = json.load(f)
        
    total_videos = len(corpus)
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    print("=" * 80)
    print("🎙️ TÉLÉCHARGEMENT DES TRANSCRIPTIONS DES PRÉDICATIONS YOUTUBE")
    print("=" * 80)
    print(f"📚 Total vidéos à traiter : {total_videos}")
    print(f"📂 Dossier de destination  : {OUTPUT_DIR}")
    print("⚡ Traitement régulé (Mode anti-blocage & Reprise automatique)...")
    print("=" * 80)
    
    results = []
    success_count = 0
    fail_count = 0
    total_words = 0
    start_time = time.time()

    # Charger les transcriptions déjà existantes pour reprise
    for item in corpus:
        fname = sanitize_filename(item.get('titre', ''), item.get('video_id', ''))
        fpath = os.path.join(OUTPUT_DIR, fname)
        if os.path.exists(fpath) and os.path.getsize(fpath) > 500:
            # Déjà téléchargé avec succès !
            try:
                with open(fpath, 'r', encoding='utf-8') as fp:
                    cnt = fp.read()
                words_match = re.search(r'nombre_de_mots:\s*(\d+)', cnt)
                w_count = int(words_match.group(1)) if words_match else len(cnt.split())
                results.append({
                    "video_id": item.get('video_id'),
                    "titre": item.get('titre'),
                    "url": item.get('url'),
                    "success": True,
                    "word_count": w_count,
                    "file_path": fpath
                })
                success_count += 1
                total_words += w_count
            except Exception:
                pass

    print(f"✅ Déjà téléchargées sur le disque : {success_count} / {total_videos}")
    remaining = [item for item in corpus if not any(r['video_id'] == item['video_id'] and r['success'] for r in results)]
    print(f"🎯 Restantes à récupérer           : {len(remaining)}")
    print("-" * 80)

    for idx, item in enumerate(remaining, 1):
        vid = item.get('video_id')
        title = item.get('titre', '')[:35]
        
        # Délai poli entre requêtes pour éviter le blocage IP
        time.sleep(1.8)
        res = fetch_transcript_for_video(item)
        results.append(res)
        
        if res["success"]:
            success_count += 1
            total_words += res["word_count"]
            fname = sanitize_filename(res["titre"], res["video_id"])
            fpath = os.path.join(OUTPUT_DIR, fname)
            
            md_content = f"""---
video_id: "{res['video_id']}"
titre: "{res['titre']}"
url: "{res['url']}"
source: "{res['source']}"
duree_secondes: {res['duree_secondes']}
duree_formatee: "{res['duree_formatee']}"
nombre_de_mots: {res['word_count']}
date_telechargement: "{time.strftime('%Y-%m-%d %H:%M:%S')}"
---

# {res['titre']}
- **Lien YouTube :** [{res['url']}]({res['url']})  
- **Durée de la prédication :** {res['duree_formatee']}  
- **Volume du message :** {res['word_count']:,} mots  

---

## 📜 Transcription intégrale horodatée

{res['full_text']}
"""
            with open(fpath, 'w', encoding='utf-8') as out_f:
                out_f.write(md_content)
        else:
            fail_count += 1

        percent = ((total_videos - len(remaining) + idx) / total_videos) * 100
        status_symbol = "✅" if res["success"] else "⚠️"
        sys.stdout.write(f"\r[{percent:5.1f}%] {total_videos - len(remaining) + idx:3d}/{total_videos} | {status_symbol} {vid} : {title.ljust(35)}")
        sys.stdout.flush()
            
    # Sauvegarde consolidée JSON
    with open(CONSOLIDATED_JSON, 'w', encoding='utf-8') as cf:
        json.dump(results, cf, ensure_ascii=False, indent=2)
        
    elapsed = time.time() - start_time
    print("\n\n" + "=" * 80)
    print("🎉 TÉLÉCHARGEMENT TERMINÉ AVEC SUCCÈS !")
    print("=" * 80)
    print(f"⏱️ Durée totale : {elapsed:.2f} s ({elapsed/max(1, total_videos):.2f} s / prédication)")
    print(f"✅ Transcriptions récupérées : {success_count} / {total_videos} ({success_count/total_videos*100:.1f}%)")
    if fail_count > 0:
        print(f"⚠️ Échecs : {fail_count}")
    print(f"📖 Total de mots transcrits : {total_words:,} mots (moyenne : {total_words/max(1, success_count):,.0f} mots / prédication)")
    print(f"📁 Fichiers individuels (.md) : {OUTPUT_DIR}")
    print(f"📄 Corpus consolidé (.json)   : {CONSOLIDATED_JSON}")
    print("=" * 80)


if __name__ == "__main__":
    main()
