#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script d'Analyse Homilétique Enrichie (Récits Longs & Détaillés) : TGC Évangile 21.
Ce script utilise Gemini 3.5 Flash-Lite pour générer :
- Des récits d'illustrations immersifs et complets (3 à 5 paragraphes, 250-450 mots).
- Des applications pratiques fouillées et incarnées.
- Des canevas homilétiques complets anonymisés pour Open Shema.
"""

import os
import sys
import json
import re
import time
import glob
import yaml
import requests
from threading import Lock
from typing import List, Dict, Any, Tuple

sys.stdout.reconfigure(encoding='utf-8')

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(CURRENT_DIR)
APP_DIR = os.path.join(PROJECT_ROOT, "bible_ai_app")
ARTICLES_DIR = os.path.join(CURRENT_DIR, "transcriptions_e21_complet")
CACHE_FILE = os.path.join(CURRENT_DIR, "analyses_e21_complet_cache.json")
ILLUSTRATIONS_DIR = os.path.join(CURRENT_DIR, "illustrations_extraites")
INDEX_PATH = os.path.join(APP_DIR, "data", "real_sermons_index.json")

# Importer les outils de base
sys.path.insert(0, CURRENT_DIR)
from analyser_predications_ia import load_all_keys, build_gemini_pool, save_extracted_illustration_to_app
from compiler_index_predications import parse_passage_reference
from anonymiser_et_generaliser_index import anonymize_entry

SYSTEM_PROMPT_ENRICHI = """Tu es un théologien réformé et professeur d'homilétique expert dans l'analyse de prédications et d'études bibliques d'exposition (TGC / Évangile 21).
Ta mission est d'analyser le texte intégral pour en extraire sa structure homilétique exacte, des applications pastorales profondes et des ILLUSTRATIONS TRÈS DÉTAILLÉES ET NARRATIVES.

CONSIGNES STRICTES DE HAUTE QUALITÉ :

1. **Passage Biblique** : Identifie avec précision le texte biblique principal (ex: "Matthieu 3.13-17", "1 Rois 17.1-16", "Proverbes 8.1-36", "Romains 6.1-14").
2. **Proposition Centrale (PMT / Big Idea)** : Une phrase percutante, théocentrique et mémorable résumant le cœur du message.
3. **Tension Contemporaine** : Le combat existentiel, pastoral ou culturel auquel le message s'adresse.
4. **Plan Homilétique** : 2 à 4 points majeurs avec versets et synthèse exégétique claire.

5. **ILLUSTRATIONS RICHES ET DÉTAILLÉES (EXIGENCE NARRATIVE MAJEURE)** :
   - Pour chaque anecdote, métaphore développée ou récit historique :
     * `titre` : Titre évocateur (max 8 mots).
     * `categorie` : UNE parmi : "Grâce & Salut", "Foi & Confiance", "Pardon & Réconciliation", "Épreuve & Souffrance", "Amour & Compassion", "Prière & Intimité", "Mariage & Famille", "Argent & Générosité", "Évangélisation & Mission", "Sainteté & Obéissance", "Espérance & Éternité".
     * `type` : "Histoire vraie", "Métaphore & Vie courante", "Récit historique" ou "Personnel".
     * `recit` : **RÉCIT LONG ET IMMERSIF (3 à 5 paragraphes complets, 250 à 450 mots)** :
       - Décris le contexte de départ, les protagonistes, l'atmosphère.
       - Raconte les étapes de l'histoire, la montée de la tension, les dialogues ou pensées clés.
       - Expose le tournant dramatique et la résolution finale avec des détails vivants.
     * `lecon_homiletique` : Explication fouillée (2-3 phrases) de la vérité spirituelle illustrée.
     * `conseil_orateur` : Phrase de transition suggérée pour introduire ce récit en chaire.
     * `passages_associes` : 1 ou 2 références bibliques pertinentes.
     * `tags` : 3 à 4 mots-clés.

6. **APPLICATIONS PRATIQUES APPROFONDIES** :
   - Rédige 3 applications complètes sous forme de paragraphes développés :
     * 1. *Examen de conscience & Diagnostic du cœur* (Questions directes à l'auditeur).
     * 2. *Mise en situation concrète* (Dans le couple, le travail, face à la tentation ou dans la solitude).
     * 3. *Délivrance par la grâce* (Comment s'appuyer sur l'œuvre accomplie de Christ et la puissance du Saint-Esprit pour vivre cette vérité).

RÉPONDS STRICTEMENT SOUS FORME D'UN OBJET JSON VALIDE :
{
  "passage_reference": "Livre Chapitre.Verset-Verset",
  "theme_general": "Thème principal",
  "big_idea": "La proposition centrale",
  "contemporary_tension": "La tension existentielle",
  "outline": [
    {
      "section_type": "introduction | point_1 | point_2 | point_3 | conclusion",
      "titre": "Titre du point",
      "passages": ["Ref1"],
      "synthese": "Explication claire"
    }
  ],
  "illustrations": [
    {
      "titre": "Titre du récit",
      "categorie": "Grâce & Salut",
      "type": "Histoire vraie",
      "recit": "Paragraphe 1 : Contexte et mise en place...\n\nParagraphe 2 : Développement et péripéties...\n\nParagraphe 3 : Dénouement et conclusion vivante...",
      "lecon_homiletique": "La leçon théologique...",
      "conseil_orateur": "Phrase d'accroche...",
      "passages_associes": ["Ref1"],
      "tags": ["Tag1", "Tag2"]
    }
  ],
  "applications": [
    "Application développée 1...",
    "Application développée 2...",
    "Application développée 3..."
  ]
}
"""


def load_markdown_article(file_path: str) -> Dict[str, Any]:
    with open(file_path, "r", encoding="utf-8") as f:
        raw = f.read()

    meta = {}
    content = raw
    if raw.startswith("---"):
        parts = raw.split("---", 2)
        if len(parts) >= 3:
            try:
                meta = yaml.safe_load(parts[1]) or {}
                content = parts[2].strip()
            except Exception:
                pass

    return {
        "id": meta.get("id") or os.path.splitext(os.path.basename(file_path))[0],
        "title": meta.get("title") or "Article Évangile 21",
        "url": meta.get("url", ""),
        "text": content
    }


def call_gemini_rich_analysis(meta: Dict[str, Any], text: str, endpoint: Dict[str, Any]) -> Tuple[bool, Dict[str, Any], Dict[str, Any], str]:
    endpoint["limiter"].acquire()

    user_prompt = f"""TITRE DU TEXTE : {meta['title']}
SOURCE : Évangile 21 (TGC France)

TEXTE INTÉGRAL DE L'ÉTUDE / PRÉDICATION :
{text[:28000]}
"""

    body = {
        "systemInstruction": {"parts": [{"text": SYSTEM_PROMPT_ENRICHI}]},
        "contents": [{"role": "user", "parts": [{"text": user_prompt}]}],
        "generationConfig": {
            "temperature": 0.25,
            "responseMimeType": "application/json",
            "maxOutputTokens": 8192
        }
    }

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{endpoint['model']}:generateContent?key={endpoint['key']}"

    try:
        resp = requests.post(url, json=body, timeout=60)
        if resp.status_code == 200:
            data = resp.json()
            cand = data.get("candidates", [])
            if cand and "content" in cand[0]:
                raw_text = cand[0]["content"]["parts"][0]["text"].strip()
                cleaned = re.sub(r"^```json\s*", "", raw_text)
                cleaned = re.sub(r"\s*```$", "", cleaned)
                parsed = json.loads(cleaned)
                usage = data.get("usageMetadata", {})
                return True, parsed, usage, ""
            return False, {}, {}, "Réponse vide"
        return False, {}, {}, f"Erreur HTTP {resp.status_code}: {resp.text[:200]}"
    except Exception as e:
        return False, {}, {}, str(e)


def main():
    os.makedirs(ILLUSTRATIONS_DIR, exist_ok=True)

    keys = load_all_keys()
    pool = build_gemini_pool(keys)
    if not pool:
        print("❌ Aucune clé Gemini valide trouvée.")
        sys.exit(1)

    ep = pool[0]

    files = sorted(glob.glob(os.path.join(ARTICLES_DIR, "*.md")))
    if not files:
        print(f"❌ Aucun fichier trouvé dans {ARTICLES_DIR}")
        sys.exit(1)

    # Charger le cache existant
    cache = {}
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, "r", encoding="utf-8") as f:
                cache = json.load(f)
        except Exception:
            cache = {}

    # Charger l'index existant
    with open(INDEX_PATH, "r", encoding="utf-8") as f:
        current_index = json.load(f)

    existing_canevas_ids = {c["id"] for c in current_index}

    print("=" * 80)
    print("🧠 ANALYSE HOMILÉTIQUE ENRICHIE DES PRÉDICATIONS ÉVANGILE 21")
    print("=" * 80)
    print(f"📚 Documents à traiter : {len(files)}")
    print(f"⚡ Format narratif : Récits immersifs longs (300-500 mots) & Applications incarnées")
    print(f"📁 Source : {ARTICLES_DIR}")
    print("=" * 80)

    total_illustrations_created = 0
    new_canevas = []

    for idx, fpath in enumerate(files, 1):
        doc = load_markdown_article(fpath)
        doc_id = doc["id"]
        title = doc["title"]
        words = len(doc["text"].split())

        print(f"\n⏳ [{idx:2d}/{len(files)}] {title[:55]} ({words} mots)...")

        # Vérifier si déjà en cache
        if doc_id in cache:
            print("  ⚡ Déjà en cache.")
            analysis = cache[doc_id]
        else:
            ok, analysis, usage, err = call_gemini_rich_analysis(doc, doc["text"], ep)
            if not ok:
                print(f"  ❌ Erreur Gemini : {err}")
                continue

            tok = usage.get("total_tokens", 0)
            print(f"  ✅ Analyse réussie ({tok} tokens) !")
            cache[doc_id] = analysis
            with open(CACHE_FILE, "w", encoding="utf-8") as cf:
                json.dump(cache, cf, ensure_ascii=False, indent=2)

        # 1. Extraire et enregistrer les illustrations longues
        ills = analysis.get("illustrations", [])
        if ills:
            print(f"  📖 {len(ills)} illustration(s) longue(s) extraite(s) :")
            for ill in ills:
                ill_title = ill.get("titre", "Illustration")
                ill_recit = ill.get("recit", "").strip()
                ill_words = len(ill_recit.split())
                print(f"     • « {ill_title} » ({ill_words} mots) [{ill.get('categorie')}]")

                # Enregistrer la fiche d'illustration
                save_extracted_illustration_to_app(ill, {"video_id": doc_id, "titre": title, "url": doc["url"], "source": "Évangile 21"}, ILLUSTRATIONS_DIR)
                total_illustrations_created += 1

        # 2. Créer le canevas homilétique anonymisé
        pass_ref = analysis.get("passage_reference")
        outline = analysis.get("outline", [])
        if pass_ref and len(outline) >= 2:
            pass_parsed = parse_passage_reference(pass_ref)
            raw_entry = {
                "title": f"Plan d'exposition : {pass_ref} — {analysis.get('theme_general', 'Exposition')}",
                "duration_seconds": 2100,
                "passage_reference": pass_ref,
                "book_code": pass_parsed.get("book_code", "BIB"),
                "chapter": pass_parsed.get("chapter", 1),
                "verse_start": pass_parsed.get("verse_start"),
                "verse_end": pass_parsed.get("verse_end"),
                "theme_general": analysis.get("theme_general", "Exposition biblique"),
                "big_idea": analysis.get("big_idea", ""),
                "contemporary_tension": analysis.get("contemporary_tension", ""),
                "outline": outline,
                "applications": analysis.get("applications", [])
            }

            clean_entry = anonymize_entry(raw_entry, len(current_index) + len(new_canevas) + 1)
            if clean_entry["id"] not in existing_canevas_ids:
                new_canevas.append(clean_entry)
                print(f"  🔒 Canevas homilétique créé : [{clean_entry['id']}] {clean_entry['title']}")

    # Mettre à jour l'index
    if new_canevas:
        current_index.extend(new_canevas)
        current_index.sort(key=lambda x: (x.get("book_code") or "ZZZ", x.get("chapter") or 999, x.get("title", "")))
        with open(INDEX_PATH, "w", encoding="utf-8") as fp:
            json.dump(current_index, fp, ensure_ascii=False, indent=2)

    print("\n" + "=" * 80)
    print("🎉 ANALYSE ÉVANGILE 21 TERMINÉE AVEC SUCCÈS !")
    print(f"📖 Illustrations riches créées : +{total_illustrations_created}")
    print(f"🏛️ Nouveaux canevas homilétiques ajoutés : +{len(new_canevas)}")
    print(f"📚 Total canevas dans l'index : {len(current_index)}")
    print("=" * 80)


if __name__ == "__main__":
    main()
