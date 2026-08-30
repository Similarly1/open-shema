#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Moissonneur et Téléchargeur de Transcriptions : TGC Évangile 21.
Télécharge toutes les transcriptions/sous-titres des prédications et conférences
SANS utiliser l'API Gemini.
"""

import os
import sys
import json
import re
import time
import requests
import yt_dlp
from bs4 import BeautifulSoup
from concurrent.futures import ThreadPoolExecutor

sys.stdout.reconfigure(encoding='utf-8')

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(CURRENT_DIR, "transcriptions_evangile21")
CORPUS_FILE = os.path.join(CURRENT_DIR, "corpus_evangile21.json")

E21_CHANNEL_URL = "https://www.youtube.com/channel/UCTDVDT1fNMmksYSih8F4jQQ/videos"
E21_PLAYLISTS_URL = "https://www.youtube.com/channel/UCTDVDT1fNMmksYSih8F4jQQ/playlists"


def sanitize_filename(title: str, video_id: str) -> str:
    clean = re.sub(r'[^\w\s-]', '', title.lower(), flags=re.UNICODE)
    clean = re.sub(r'[-\s]+', '-', clean).strip('-')[:50].rstrip('-')
    return f"{clean}_{video_id}.md" if clean else f"sermon_{video_id}.md"


def harvest_e21_videos(max_items: int = 150) -> list:
    print("🔍 Récupération du catalogue de vidéos Évangile 21...")
    ydl_opts = {
        'extract_flat': True,
        'quiet': True,
        'no_warnings': True,
        'playlist_items': f'1:{max_items}'
    }

    videos = []
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        try:
            info = ydl.extract_info(E21_CHANNEL_URL, download=False)
            entries = info.get('entries', [])
            for e in entries:
                dur = e.get('duration') or 0
                title = e.get('title') or ''
                # Filtrer les vidéos de moins de 12 minutes (teasers, chants courts, etc.)
                if dur >= 720:  # >= 12 minutes
                    videos.append({
                        "video_id": e.get("id"),
                        "titre": title,
                        "url": f"https://www.youtube.com/watch?v={e.get('id')}",
                        "duree_secondes": dur,
                        "duree_formatee": f"{int(dur//60):02d}:{int(dur%60):02d}",
                        "source": "TGC Évangile 21"
                    })
        except Exception as ex:
            print(f"⚠️ Erreur moissonnage channel : {ex}")

    print(f"✅ {len(videos)} prédications & conférences retenues (durée >= 12 min).")
    with open(CORPUS_FILE, 'w', encoding='utf-8') as fp:
        json.dump(videos, fp, ensure_ascii=False, indent=2)
    return videos


def fetch_and_format_transcript(video_item: dict) -> dict:
    vid = video_item["video_id"]
    title = video_item["titre"]
    fname = sanitize_filename(title, vid)
    fpath = os.path.join(OUTPUT_DIR, fname)

    # Si déjà téléchargé
    if os.path.exists(fpath) and os.path.getsize(fpath) > 1000:
        return {"video_id": vid, "titre": title, "success": True, "already": True}

    from youtube_transcript_api import YouTubeTranscriptApi

    # 1. Méthode principale : YouTubeTranscriptApi
    try:
        api = YouTubeTranscriptApi()
        t_list = api.list(vid)
        target_t = None
        for t in t_list:
            if t.language_code.lower().startswith('fr'):
                target_t = t
                break
        if target_t:
            raw_entries = target_t.fetch()
            if raw_entries and len(raw_entries) > 0:
                paragraphs = []
                curr_text = []
                curr_start = 0.0

                for item in raw_entries:
                    start_s = getattr(item, 'start', item.get('start', 0.0) if isinstance(item, dict) else 0.0)
                    txt = getattr(item, 'text', item.get('text', '') if isinstance(item, dict) else '')
                    clean_seg = re.sub(r'\[.*?\]', '', txt).strip()
                    if not clean_seg or clean_seg == '\n':
                        continue

                    if not curr_text:
                        curr_start = start_s
                    curr_text.append(clean_seg)

                    block_str = ' '.join(curr_text)
                    if (start_s - curr_start) >= 40 or (clean_seg.endswith(('.', '!', '?')) and len(block_str) > 200):
                        m, s = divmod(int(curr_start), 60)
                        h, m = divmod(m, 60)
                        ts = f"{h:02d}:{m:02d}:{s:02d}" if h > 0 else f"{m:02d}:{s:02d}"
                        p_clean = re.sub(r'\s+', ' ', block_str).strip()
                        paragraphs.append(f"**[{ts}]** {p_clean}")
                        curr_text = []

                if curr_text:
                    m, s = divmod(int(curr_start), 60)
                    h, m = divmod(m, 60)
                    ts = f"{h:02d}:{m:02d}:{s:02d}" if h > 0 else f"{m:02d}:{s:02d}"
                    p_clean = re.sub(r'\s+', ' ', ' '.join(curr_text)).strip()
                    paragraphs.append(f"**[{ts}]** {p_clean}")

                full_text = '\n\n'.join(paragraphs)
                word_count = len([w for p in paragraphs for w in p.split() if not p.startswith('**[')])

                md_content = f"""---
video_id: "{vid}"
titre: "{title}"
url: "{video_item['url']}"
source: "TGC Évangile 21"
duree_secondes: {video_item['duree_secondes']}
duree_formatee: "{video_item['duree_formatee']}"
nombre_de_mots: {word_count}
date_telechargement: "{time.strftime('%Y-%m-%d %H:%M:%S')}"
---

# {title}
- **Lien YouTube :** [{video_item['url']}]({video_item['url']})  
- **Durée de la prédication :** {video_item['duree_formatee']}  
- **Volume du message :** {word_count:,} mots  

---

## 📜 Transcription intégrale horodatée

{full_text}
"""
                with open(fpath, 'w', encoding='utf-8') as out_f:
                    out_f.write(md_content)

                return {"video_id": vid, "titre": title, "success": True, "word_count": word_count}
    except Exception as e:
        pass

    return {"video_id": vid, "titre": title, "success": False, "error": "Sous-titres indisponibles"}


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    videos = harvest_e21_videos(max_items=150)

    print("=" * 80)
    print("🎙️ TÉLÉCHARGEMENT DES TRANSCRIPTIONS ÉVANGILE 21 (SANS API GEMINI)")
    print("=" * 80)
    print(f"📚 Total vidéos à traiter : {len(videos)}")
    print(f"📁 Dossier de sortie : {OUTPUT_DIR}")
    print("=" * 80)

    success = 0
    fail = 0
    total_words = 0

    for idx, v in enumerate(videos, 1):
        time.sleep(1.2)  # Respect des quotas YouTube
        res = fetch_and_format_transcript(v)
        if res.get("success"):
            success += 1
            w = res.get("word_count", 0)
            total_words += w
            sym = "✅"
        else:
            fail += 1
            sym = "⚠️"

        title_prev = v["titre"][:38]
        percent = (idx / len(videos)) * 100
        sys.stdout.write(f"\r[{percent:5.1f}%] {idx:2d}/{len(videos)} | {sym} {v['video_id']} : {title_prev.ljust(38)}")
        sys.stdout.flush()

    print("\n\n" + "=" * 80)
    print(f"🎉 TÉLÉCHARGEMENT TERMINÉ !")
    print(f"✅ Transcriptions récupérées : {success} / {len(videos)}")
    print(f"📖 Volume total : {total_words:,} mots")
    print(f"📁 Dossier : {OUTPUT_DIR}")
    print("=" * 80)


if __name__ == "__main__":
    main()
