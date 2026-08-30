#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Collecteur d'articles et études homilétiques d'exposition : TGC Évangile 21.
Télécharge les articles complets en Markdown sans utiliser l'API Gemini.
"""

import os
import sys
import re
import time
import requests
from bs4 import BeautifulSoup

sys.stdout.reconfigure(encoding='utf-8')

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(CURRENT_DIR, "articles_evangile21")
os.makedirs(OUTPUT_DIR, exist_ok=True)

HEADERS = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}


def sanitize_filename(title: str, post_id: str) -> str:
    clean = re.sub(r'[^\w\s-]', '', title.lower(), flags=re.UNICODE)
    clean = re.sub(r'[-\s]+', '-', clean).strip('-')[:50].rstrip('-')
    return f"{clean}_{post_id}.md" if clean else f"article_{post_id}.md"


def crawl_articles(max_pages: int = 3) -> None:
    print("=" * 80)
    print("📰 COLLECTE DES ARTICLES ET EXPOSITIONS ÉVANGILE 21 (SANS API GEMINI)")
    print("=" * 80)

    saved_count = 0
    total_words = 0

    for p in range(1, max_pages + 1):
        rss_url = f"https://evangile21.thegospelcoalition.org/feed/?paged={p}"
        try:
            r = requests.get(rss_url, headers=HEADERS, timeout=15)
            if r.status_code != 200:
                continue

            soup = BeautifulSoup(r.text, 'xml')
            items = soup.find_all('item')
            print(f"\n📄 Page {p} du flux RSS : {len(items)} articles trouvés...")

            for it in items:
                t_node = it.find('title')
                l_node = it.find('link')
                if not t_node or not l_node:
                    continue

                title = t_node.get_text().strip()
                url = l_node.get_text().strip()
                post_id = f"art-{abs(hash(url)) % 10000:04d}"
                fname = sanitize_filename(title, post_id)
                fpath = os.path.join(OUTPUT_DIR, fname)

                if os.path.exists(fpath):
                    continue

                # Récupérer l'article complet
                time.sleep(0.5)
                r_art = requests.get(url, headers=HEADERS, timeout=12)
                if r_art.status_code != 200:
                    continue

                soup_art = BeautifulSoup(r_art.text, 'html.parser')
                paras = [p.get_text().strip() for p in soup_art.find_all('p') if len(p.get_text().strip()) > 35]

                # Filtrer les mentions de fin
                clean_paras = []
                for para in paras:
                    if any(stop_kw in para for stop_kw in ['Cet article a été initialement publié', 'Pour aller plus loin', 'Inscrivez-vous à notre infolettre']):
                        break
                    clean_paras.append(para)

                if len(clean_paras) < 3:
                    continue

                body_text = '\n\n'.join(clean_paras)
                words = len(body_text.split())

                md_doc = f"""---
id: "{post_id}"
title: "{title}"
url: "{url}"
source: "TGC Évangile 21"
words: {words}
date_extracted: "{time.strftime('%Y-%m-%d %H:%M:%S')}"
---

# {title}
- **Source :** [{url}]({url})  
- **Volume :** {words:,} mots  

---

{body_text}
"""
                with open(fpath, 'w', encoding='utf-8') as out_f:
                    out_f.write(md_doc)

                saved_count += 1
                total_words += words
                print(f"  ✅ [{saved_count}] {title[:50]} ({words} mots)")

                if saved_count >= 30:
                    break

        except Exception as e:
            print(f"⚠️ Erreur page {p} : {e}")

        if saved_count >= 30:
            break

    print("\n" + "=" * 80)
    print(f"🎉 COLLECTE TERMINÉE SANS API GEMINI !")
    print(f"📚 {saved_count} articles et études complètes enregistrés.")
    print(f"📖 Total : {total_words:,} mots de matière première.")
    print(f"📁 Dossier : {OUTPUT_DIR}")
    print("=" * 80)


if __name__ == "__main__":
    crawl_articles(max_pages=2)
