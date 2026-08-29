#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script d'analyse homilétique et d'intégration de nouvelles prédications (Fichiers Word .docx & Liens Web).
Anonymise et intègre directement les résultats dans bible_ai_app/data/real_sermons_index.json.
"""

import os
import sys
import json
import re
import time
import zipfile
import xml.etree.ElementTree as ET
import requests
from bs4 import BeautifulSoup
from typing import List, Dict, Any

sys.stdout.reconfigure(encoding='utf-8')

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(CURRENT_DIR)
APP_DIR = os.path.join(PROJECT_ROOT, "bible_ai_app")
INDEX_PATH = os.path.join(APP_DIR, "data", "real_sermons_index.json")
ILLUSTRATIONS_DIR = os.path.join(CURRENT_DIR, "illustrations_extraites")

# Importer les outils du script d'analyse
sys.path.insert(0, CURRENT_DIR)
from analyser_predications_ia import load_all_keys, build_gemini_pool, call_gemini_analysis, save_extracted_illustration_to_app
from compiler_index_predications import parse_passage_reference
from anonymiser_et_generaliser_index import anonymize_entry


def read_docx(file_path: str) -> str:
    """Lit un fichier Word .docx et retourne le texte pur avec paragraphes."""
    with zipfile.ZipFile(file_path) as docx:
        tree = ET.fromstring(docx.read('word/document.xml'))
        namespaces = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
        paragraphs = []
        for p in tree.iterfind('.//w:p', namespaces):
            texts = [node.text for node in p.iterfind('.//w:t', namespaces) if node.text]
            if texts:
                paragraphs.append(''.join(texts).strip())
        return '\n\n'.join(p for p in paragraphs if p)


def fetch_web_sermon_agen(url: str) -> Dict[str, str]:
    """Extrait le texte propre d'une prédication du site UMC Agen."""
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
    r = requests.get(url, headers=headers, timeout=15)
    soup = BeautifulSoup(r.text, 'html.parser')

    h1 = soup.find('h1')
    title = h1.get_text().strip() if h1 else "Prédication"

    paras = [p.get_text().strip() for p in soup.find_all('p') if p.get_text().strip()]
    clean_paras = []
    for p in paras:
        if any(stop_kw in p for stop_kw in ['Laisser un commentaire', 'Votre adresse e-mail', 'Partager :', 'Sur le même thème', 'E-mail *', 'Nom *', 'Site web']):
            break
        if p.startswith(('Cet article a été écrit', 'Articles récents')):
            continue
        clean_paras.append(p)

    full_text = '\n\n'.join(clean_paras)
    return {
        "title": title,
        "text": full_text,
        "url": url,
        "source": "Prédication web"
    }


def main():
    keys = load_all_keys()
    pool = build_gemini_pool(keys)
    if not pool:
        print("❌ Aucune clé Gemini valide trouvée.")
        sys.exit(1)

    ep = pool[0]

    # Définition des sources
    sermon_sources = [
        {
            "id": "web-1ch-13",
            "type": "web",
            "url": "https://agen.umc-europe.org/eglise/1-chroniques-13-david-un-homme-de-communication-mais-pas-dans-tous-les-domaines/",
            "default_title": "1 Chroniques 13 : David, un homme de communication",
            "default_ref": "1 Chroniques 13.1-14"
        },
        {
            "id": "web-luc-15",
            "type": "web",
            "url": "https://agen.umc-europe.org/eglise/luc-15v11-32-le-fils-prodigue-parabole/",
            "default_title": "Luc 15.11-32 : Parabole des 2 fils ou l’amour immérité du Père",
            "default_ref": "Luc 15.11-32"
        }
    ]

    print("=" * 80)
    print(f"📖 ANALYSE ET INTÉGRATION DE {len(sermon_sources)} NOUVELLES PRÉDICATIONS")
    print("=" * 80)

    # Charger l'index existant
    with open(INDEX_PATH, "r", encoding="utf-8") as fp:
        current_index = json.load(fp)

    existing_ids = {item["id"] for item in current_index}
    new_entries = []

    for src in sermon_sources:
        s_id = src["id"]
        print(f"\n⏳ Traitement : {src['default_title']}...")

        # 1. Extraction du texte
        if src["type"] == "docx":
            if not os.path.exists(src["path"]):
                print(f"  ❌ Fichier introuvable : {src['path']}")
                continue
            text = read_docx(src["path"])
            meta = {
                "video_id": s_id,
                "titre": src["default_title"],
                "url": "",
                "duree_formatee": "35:00",
                "source": "Document pastoral"
            }
        else:
            data_web = fetch_web_sermon_agen(src["url"])
            text = data_web["text"]
            meta = {
                "video_id": s_id,
                "titre": data_web["title"],
                "url": src["url"],
                "duree_formatee": "30:00",
                "source": "Prédication web"
            }

        word_count = len(text.split())
        print(f"  📄 Texte extrait : {word_count} mots")

        # 2. Analyse IA Gemini
        print(f"  🧠 Analyse homilétique via Gemini 3.5 Flash-Lite...")
        ok, analysis, usage, err = call_gemini_analysis(meta, text, ep)

        if not ok:
            print(f"  ❌ Erreur analyse Gemini : {err}")
            continue

        print(f"  ✅ Analyse réussie ({usage.get('total_tokens', 0)} tokens) !")
        print(f"     Passage identifié : {analysis.get('passage_reference')}")
        print(f"     Big Idea : « {analysis.get('big_idea')[:70]}... »")

        # 3. Sauvegarde des illustrations privées extraites
        for ill in analysis.get("illustrations", []):
            try:
                save_extracted_illustration_to_app(ill, meta, ILLUSTRATIONS_DIR)
            except Exception:
                pass

        # 4. Normalisation et Anonymisation pour l'Index public
        pass_ref = analysis.get("passage_reference") or src["default_ref"]
        pass_parsed = parse_passage_reference(pass_ref)

        raw_entry = {
            "title": meta["titre"],
            "duration_seconds": 2100,
            "passage_reference": pass_ref,
            "book_code": pass_parsed.get("book_code", "BIB"),
            "chapter": pass_parsed.get("chapter", 1),
            "verse_start": pass_parsed.get("verse_start"),
            "verse_end": pass_parsed.get("verse_end"),
            "theme_general": analysis.get("theme_general", "Exposition biblique"),
            "big_idea": analysis.get("big_idea", ""),
            "contemporary_tension": analysis.get("contemporary_tension", ""),
            "outline": analysis.get("outline", []),
            "applications": analysis.get("applications", [])
        }

        # Anonymisation complète
        clean_entry = anonymize_entry(raw_entry, len(current_index) + len(new_entries) + 1)
        new_entries.append(clean_entry)
        print(f"  🔒 Cannevas anonymisé généré : [{clean_entry['id']}] {clean_entry['title']}")

    # 5. Fusion et mise à jour de l'index
    current_index.extend(new_entries)
    # Tri par livre et chapitre
    current_index.sort(key=lambda x: (x.get("book_code") or "ZZZ", x.get("chapter") or 999, x.get("title", "")))

    with open(INDEX_PATH, "w", encoding="utf-8") as fp:
        json.dump(current_index, fp, ensure_ascii=False, indent=2)

    print("\n" + "=" * 80)
    print(f"🎉 SUCCÈS ! {len(new_entries)} nouveaux canevas ajoutés.")
    print(f"📚 Total dans l'index : {len(current_index)} canevas homilétiques purs.")
    print(f"📁 Fichier : {INDEX_PATH}")
    print("=" * 80)


if __name__ == "__main__":
    main()
