#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script d'extraction des illustrations et analogies de Charles Spurgeon
depuis son livre 'Causeries sur la prédication (Lectures to My Students)'.
100% Domaine Public -> Enregistré dans bible_ai_app/data/illustrations/.
"""

import os
import sys
import json
import re
import time
import zipfile
import yaml
from bs4 import BeautifulSoup

sys.stdout.reconfigure(encoding='utf-8')

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(CURRENT_DIR)
APP_DIR = os.path.join(PROJECT_ROOT, "bible_ai_app")
PUBLIC_ILL_DIR = os.path.join(APP_DIR, "data", "illustrations")

EPUB_PATH = r"C:\Users\adrie\kDrive\Documents\Théologie\Ressources externes\Ebooks\Charles-Spurgeon-Causeries-sur-la-predication-le-secret-d-un-ministere-fecond-.epub"

# Importer les outils Gemini
sys.path.insert(0, CURRENT_DIR)
from analyser_predications_ia import load_all_keys, build_gemini_pool

SYSTEM_PROMPT_SPURGEON = """Tu es un expert en littérature homilétique et biographe de Charles Spurgeon.
Ta mission est d'extraire toutes les illustrations, anecdotes historiques, analogies du quotidien et métaphores marquantes présentes dans ce chapitre des "Causeries sur la prédication" de Charles Spurgeon.

Pour chaque illustration extraite :
- `titre` : Titre évocateur (max 8 mots).
- `categorie` : UNE parmi : "Grâce & Salut", "Foi & Confiance", "Pardon & Réconciliation", "Épreuve & Souffrance", "Amour & Compassion", "Prière & Intimité", "Sainteté & Obéissance", "Espérance & Éternité", "Évangélisation & Mission".
- `type` : "Histoire vraie", "Métaphore & Vie courante" ou "Allégorie".
- `recit` : Récit ou analogie rédigé dans un français soigné et vivant (1 à 2 paragraphes).
- `lecon_homiletique` : La portée spirituelle ou pastorale pour l'auditeur.
- `passages_associes` : 1 ou 2 références bibliques pertinentes (ex: ["Romains 8.28", "Éphésiens 2.8"]).
- `tags` : 3 à 4 mots-clés.

RÉPONDS UNIQUEMENT SOUS FORME D'UN TABLEAU JSON STRICT :
[
  {
    "titre": "Titre",
    "categorie": "Foi & Confiance",
    "type": "Métaphore & Vie courante",
    "recit": "Texte...",
    "lecon_homiletique": "Leçon...",
    "passages_associes": ["Ref1"],
    "tags": ["Tag1", "Tag2"]
  }
]
"""


def extract_chapters_text(epub_path: str) -> list:
    chapters = []
    with zipfile.ZipFile(epub_path) as z:
        for name in z.namelist():
            if name.endswith(('.html', '.xhtml', '.htm')):
                soup = BeautifulSoup(z.read(name), 'html.parser')
                h = soup.find(['h1', 'h2', 'h3', 'title'])
                title = h.get_text().strip() if h else name
                # Supprimer scripts et styles
                for s in soup(['script', 'style']):
                    s.decompose()
                text = soup.get_text()
                words = len(text.split())
                if words >= 300:
                    chapters.append({
                        "filename": name,
                        "title": title,
                        "text": text,
                        "words": words
                    })
    return chapters


def main():
    if not os.path.exists(EPUB_PATH):
        print(f"❌ EPUB introuvable : {EPUB_PATH}")
        sys.exit(1)

    keys = load_all_keys()
    pool = build_gemini_pool(keys)
    if not pool:
        print("❌ Clé Gemini non configurée.")
        sys.exit(1)

    ep = pool[0]
    chapters = extract_chapters_text(EPUB_PATH)
    print("=" * 80)
    print(f"🎩 EXTRACTION DES ILLUSTRATIONS DE CHARLES SPURGEON (DOMAINE PUBLIC)")
    print("=" * 80)
    print(f"📚 Total chapitres éligibles : {len(chapters)}")
    print(f"📁 Destination : {PUBLIC_ILL_DIR}")
    print("=" * 80)

    total_extracted = 0
    os.makedirs(PUBLIC_ILL_DIR, exist_ok=True)

    import requests

    for idx, chap in enumerate(chapters, 1):
        print(f"\n⏳ [{idx}/{len(chapters)}] Traitement : {chap['title'][:55]} ({chap['words']} mots)...")
        ep["limiter"].acquire()

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{ep['model']}:generateContent?key={ep['key']}"
        body_req = {
            "systemInstruction": {"parts": [{"text": SYSTEM_PROMPT_SPURGEON}]},
            "contents": [{"role": "user", "parts": [{"text": f"CHAPITRE : {chap['title']}\n\nTEXTE :\n{chap['text'][:25000]}"}]}],
            "generationConfig": {"temperature": 0.2, "responseMimeType": "application/json"}
        }

        try:
            resp = requests.post(url, json=body_req, timeout=45)
            if resp.status_code == 200:
                data = resp.json()
                cand = data.get("candidates", [])
                if cand and "content" in cand[0]:
                    raw_txt = cand[0]["content"]["parts"][0]["text"].strip()
                    illustrations = json.loads(raw_txt)
                    if isinstance(illustrations, list):
                        print(f"  ✅ {len(illustrations)} illustrations extraites !")
                        for ill in illustrations:
                            title = ill.get("titre") or "Illustration"
                            safe_title = re.sub(r'[^\w\s-]', '', title.lower(), flags=re.UNICODE)
                            safe_title = re.sub(r'[-\s]+', '-', safe_title).strip('-')[:35].rstrip('-')
                            ill_id = f"spurgeon-{abs(hash(title)) % 10000:04d}"
                            fname = f"{safe_title}-{ill_id}.md"
                            fpath = os.path.join(PUBLIC_ILL_DIR, fname)

                            recit = ill.get("recit", "").strip()
                            lecon = ill.get("lecon_homiletique", "").strip()
                            body_text = f"{recit}\n\n> **Leçon homilétique :** {lecon}" if lecon else recit

                            fm = {
                                "id": ill_id,
                                "title": title,
                                "category": ill.get("categorie", "Foi & Confiance"),
                                "type": ill.get("type", "Métaphore & Vie courante"),
                                "tags": ill.get("tags", []),
                                "passages_associes": ill.get("passages_associes", []),
                                "source": f"Charles Spurgeon — Causeries sur la prédication",
                                "author": "Charles H. Spurgeon",
                                "license": "public_domain",
                                "public_domain": True,
                                "created_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
                                "updated_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
                            }

                            content = f"---\n{yaml.dump(fm, allow_unicode=True, sort_keys=False, default_flow_style=False)}---\n\n{body_text}\n"
                            with open(fpath, "w", encoding="utf-8") as out_f:
                                out_f.write(content)
                            total_extracted += 1
            else:
                print(f"  ⚠️ Erreur HTTP {resp.status_code}")
        except Exception as e:
            print(f"  ❌ Erreur extraction : {e}")

    print("\n" + "=" * 80)
    print(f"🎉 EXTRACTION TERMINÉE : +{total_extracted} nouvelles illustrations de Spurgeon ajoutées !")
    print("=" * 80)


if __name__ == "__main__":
    main()
