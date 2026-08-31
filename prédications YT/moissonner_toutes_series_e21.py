#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Moissonneur Intégral des 165 Épisodes de Prédications et Séries Évangile 21.
Récupère les transcriptions intégrales textuelles depuis les pages web et les flux RSS.
"""

import os
import sys
import json
import re
import time
import requests
import unicodedata
from bs4 import BeautifulSoup
from concurrent.futures import ThreadPoolExecutor

sys.stdout.reconfigure(encoding='utf-8')

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(CURRENT_DIR, "transcriptions_e21_complet")
METADATA_FILE = os.path.join(CURRENT_DIR, "catalogue_e21_165_episodes.json")
os.makedirs(OUTPUT_DIR, exist_ok=True)

HEADERS = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}

PODCAST_FEEDS = [
    {"serie": "Prédications Textuelles", "url": "https://evangile21.thegospelcoalition.org/fr-evangile-21/feed/?feed=podcast", "base_web": "https://evangile21.thegospelcoalition.org/fr-evangile-21/"},
    {"serie": "Prédications du Psautier", "url": "https://evangile21.thegospelcoalition.org/fr-psautier/feed/?feed=podcast", "base_web": "https://evangile21.thegospelcoalition.org/fr-psautier/"},
    {"serie": "Parents pour le plaisir", "url": "https://evangile21.thegospelcoalition.org/parents-pour-plaisir/feed/?feed=podcast", "base_web": "https://evangile21.thegospelcoalition.org/parents-pour-plaisir/"},
    {"serie": "Kurious (Réflexions & Société)", "url": "https://evangile21.thegospelcoalition.org/kurious/feed/?feed=podcast", "base_web": "https://evangile21.thegospelcoalition.org/kurious/"},
    {"serie": "Boîte à outils Théologie", "url": "https://evangile21.thegospelcoalition.org/boite-a-outil-philo/feed/?feed=podcast", "base_web": "https://evangile21.thegospelcoalition.org/boite-a-outil-philo/"},
    {"serie": "Accent Louange & Culte", "url": "https://evangile21.thegospelcoalition.org/accent-louange/feed/?feed=podcast", "base_web": "https://evangile21.thegospelcoalition.org/accent-louange/"},
]


def slugify(value: str) -> str:
    value = unicodedata.normalize('NFKD', value).encode('ascii', 'ignore').decode('ascii')
    value = re.sub(r'[^\w\s-]', '', value.lower())
    return re.sub(r'[-\s]+', '-', value).strip('-')


def sanitize_filename(title: str, ep_id: str) -> str:
    clean = slugify(title)[:45]
    return f"{clean}_{ep_id}.md" if clean else f"sermon_{ep_id}.md"


def harvest_all_feeds() -> list:
    print("=" * 80)
    print("📡 MOISSONNAGE DE TOUTES LES SÉRIES PODCASTS & PRÉDICATIONS ÉVANGILE 21")
    print("=" * 80)

    all_items = []
    seen_urls = set()

    for feed_info in PODCAST_FEEDS:
        s_name = feed_info["serie"]
        f_url = feed_info["url"]
        print(f"\n⏳ Récupération du flux : {s_name}...")

        try:
            r = requests.get(f_url, headers=HEADERS, timeout=15)
            if r.status_code != 200:
                print(f"  ❌ Erreur HTTP {r.status_code}")
                continue

            soup = BeautifulSoup(r.text, 'xml')
            items = soup.find_all('item')
            print(f"  ✅ {len(items)} épisodes trouvés dans le flux.")

            for it in items:
                title_node = it.find('title')
                title = title_node.get_text().strip() if title_node else "Prédication"
                
                enc = it.find('enclosure')
                mp3 = enc.get('url') if enc else ''
                
                guid_node = it.find('guid')
                guid = guid_node.get_text().strip() if guid_node else ''
                
                desc_node = it.find('description')
                desc = desc_node.get_text().strip() if desc_node else ''
                
                # Deviner ou construire l'URL de la page web
                slug = slugify(title)
                web_url = f"{feed_info['base_web']}{slug}/"
                
                ep_id = f"e21-{abs(hash(title + mp3)) % 100000:05d}"

                if mp3 not in seen_urls:
                    seen_urls.add(mp3)
                    all_items.append({
                        "id": ep_id,
                        "serie": s_name,
                        "title": title,
                        "web_url": web_url,
                        "mp3_url": mp3,
                        "description": desc,
                        "guid": guid
                    })

        except Exception as e:
            print(f"  ⚠️ Erreur sur {s_name} : {e}")

    print("\n" + "=" * 80)
    print(f"🎉 TOTAL ÉPISODES CATALOGUÉS : {len(all_items)}")
    print("=" * 80)

    with open(METADATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(all_items, f, ensure_ascii=False, indent=2)

    return all_items


def extract_transcript_from_page(ep: dict) -> dict:
    ep_id = ep["id"]
    title = ep["title"]
    serie = ep["serie"]
    web_url = ep["web_url"]
    fname = sanitize_filename(title, ep_id)
    fpath = os.path.join(OUTPUT_DIR, fname)

    if os.path.exists(fpath) and os.path.getsize(fpath) > 500:
        return {"id": ep_id, "title": title, "success": True, "already": True}

    # 1. Tenter d'extraire la transcription de la page web
    try:
        r = requests.get(web_url, headers=HEADERS, timeout=12)
        if r.status_code == 200:
            soup = BeautifulSoup(r.text, 'html.parser')
            
            # Chercher la transcription
            trans_heading = soup.find(lambda tag: tag.name in ['h2', 'h3', 'h4', 'div', 'p', 'span'] and 'TRANSCRIPTION' in tag.get_text().upper())
            if trans_heading:
                parent = trans_heading.find_parent()
                paras = [p.get_text().strip() for p in parent.find_all('p') if len(p.get_text().strip()) > 20 and not p.get_text().strip().startswith(('Cette transcription a', 'Partager :'))]
                
                if len(paras) >= 5:
                    full_text = '\n\n'.join(paras)
                    words = len(full_text.split())
                    
                    md = f"""---
id: "{ep_id}"
title: "{title}"
serie: "{serie}"
url: "{web_url}"
mp3_url: "{ep['mp3_url']}"
words: {words}
has_full_transcript: true
date_extracted: "{time.strftime('%Y-%m-%d %H:%M:%S')}"
---

# {title}
- **Série :** {serie}  
- **Page Web :** [{web_url}]({web_url})  
- **Audio MP3 :** [{ep['mp3_url']}]({ep['mp3_url']})  
- **Volume du texte :** {words:,} mots  

---

## 📜 Transcription Intégrale

{full_text}
"""
                    with open(fpath, 'w', encoding='utf-8') as out_f:
                        out_f.write(md)
                    return {"id": ep_id, "title": title, "success": True, "words": words, "type": "transcript"}

            # Si pas de section transcription mais texte d'article
            paras_art = [p.get_text().strip() for p in soup.find_all('p') if len(p.get_text().strip()) > 35]
            clean_art = []
            for p in paras_art:
                if any(stop_kw in p for stop_kw in ['Cet article a été', 'Inscrivez-vous', 'Laisser un commentaire']):
                    break
                clean_art.append(p)
                
            if len(clean_art) >= 4:
                full_text = '\n\n'.join(clean_art)
                words = len(full_text.split())
                md = f"""---
id: "{ep_id}"
title: "{title}"
serie: "{serie}"
url: "{web_url}"
mp3_url: "{ep['mp3_url']}"
words: {words}
has_full_transcript: false
date_extracted: "{time.strftime('%Y-%m-%d %H:%M:%S')}"
---

# {title}
- **Série :** {serie}  
- **Page Web :** [{web_url}]({web_url})  
- **Audio MP3 :** [{ep['mp3_url']}]({ep['mp3_url']})  
- **Volume du texte :** {words:,} mots  

---

## 📖 Étude & Notes d'Exposition

{full_text}
"""
                with open(fpath, 'w', encoding='utf-8') as out_f:
                    out_f.write(md)
                return {"id": ep_id, "title": title, "success": True, "words": words, "type": "article"}

    except Exception:
        pass

    # 2. Fallback avec la description de l'épisode si pas de page web trouvée
    desc = ep.get("description", "").strip()
    if len(desc.split()) >= 30:
        clean_desc = re.sub(r'<[^>]+>', '', desc)
        words = len(clean_desc.split())
        md = f"""---
id: "{ep_id}"
title: "{title}"
serie: "{serie}"
url: "{web_url}"
mp3_url: "{ep['mp3_url']}"
words: {words}
has_full_transcript: false
date_extracted: "{time.strftime('%Y-%m-%d %H:%M:%S')}"
---

# {title}
- **Série :** {serie}  
- **Audio MP3 :** [{ep['mp3_url']}]({ep['mp3_url']})  

---

## 📖 Résumé Homilétique de l'Épisode

{clean_desc}
"""
        with open(fpath, 'w', encoding='utf-8') as out_f:
            out_f.write(md)
        return {"id": ep_id, "title": title, "success": True, "words": words, "type": "summary"}

    return {"id": ep_id, "title": title, "success": False}


def main():
    items = harvest_all_feeds()
    
    print("\n" + "=" * 80)
    print(f"📥 EXTRACTION DES TRANSCRIPTIONS & ÉTUDES ({len(items)} ÉPISODES)")
    print("=" * 80)

    success_count = 0
    total_words = 0

    for idx, ep in enumerate(items, 1):
        res = extract_transcript_from_page(ep)
        t_type = res.get("type", "none")
        w = res.get("words", 0)
        
        if res.get("success"):
            success_count += 1
            total_words += w
            sym = "✅"
            info = f"[{t_type.upper()}: {w} mots]"
        else:
            sym = "⚠️"
            info = "[Échec]"

        percent = (idx / len(items)) * 100
        title_disp = ep['title'][:35]
        sys.stdout.write(f"\r[{percent:5.1f}%] {idx:3d}/{len(items)} | {sym} {title_disp.ljust(35)} {info}")
        sys.stdout.flush()

    print("\n\n" + "=" * 80)
    print("🎉 EXTRACTION TERMINÉE SANS API GEMINI !")
    print(f"✅ Documents constitués : {success_count} / {len(items)}")
    print(f"📖 Volume total récolté : {total_words:,} mots")
    print(f"📁 Dossier de sortie : {OUTPUT_DIR}")
    print("=" * 80)


if __name__ == "__main__":
    main()
