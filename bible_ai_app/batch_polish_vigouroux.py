#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script de restauration et polissage IA par lot pour l'intégralité du Dictionnaire Vigouroux (1912).
Supporte :
- Infomaniak Swiss AI (mistralai/Ministral-3-14B-Instruct-2512, mistralai/Mistral-Small-4-119B-2603)
- Google Gemini (gemini-2.5-flash-lite, gemini-2.5-flash)
- Mistral AI direct (mistral-small-latest)
- Multi-threading, reprise automatique (checkpointing), barre de progression temps réel.
"""

import os
import sys
import json
import time
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from threading import Lock

# Configuration encodage console Windows
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from core.config import load_config
from core.dictionary_polisher import DictionaryPolisher, AVAILABLE_POLISH_MODELS

def main():
    parser = argparse.ArgumentParser(description="Polissage IA par lot du Dictionnaire Vigouroux (1912)")
    parser.add_argument(
        "--model",
        type=str,
        default=None,
        help="Modèle à utiliser (ex: mistralai/Ministral-3-14B-Instruct-2512, mistralai/Mistral-Small-4-119B-2603, gemini-2.5-flash-lite, gemini-2.5-flash)"
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=4,
        help="Nombre de requêtes parallèles simultanées (défaut: 4)"
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Nombre maximum d'articles à traiter (0 = tous)"
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Forcer le re-polissage des articles déjà présents dans le cache"
    )
    args = parser.parse_args()

    config = load_config()
    model = args.model or config.get("dict_polish_model", "mistralai/Ministral-3-14B-Instruct-2512")

    dict_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "vigouroux_dict.json")
    if not os.path.exists(dict_path):
        print(f"❌ Erreur : Fichier dictionnaire introuvable à {dict_path}")
        sys.exit(1)

    print("=" * 70)
    print("📖 RESTAURATION ET POLISSAGE PAR LOT - DICTIONNAIRE VIGOUROUX (1912)")
    print("=" * 70)
    print(f"🤖 Modèle sélectionné : {model}")
    print(f"⚡ Threads parallèles : {args.workers}")

    with open(dict_path, "r", encoding="utf-8") as f:
        vig_data = json.load(f)

    articles = vig_data.get("articles", {})
    all_keys = list(articles.keys())
    total_articles = len(all_keys)
    print(f"📚 Total articles dans le dictionnaire : {total_articles}")

    cache = DictionaryPolisher.load_cache()
    
    # Filtrer les articles restants à traiter
    to_process = []
    for k in all_keys:
        art = articles[k]
        title = art.get("title") or k
        slug = k
        cached_entry = DictionaryPolisher.get_polished_entry("vigouroux", slug) or DictionaryPolisher.get_polished_entry("vigouroux", title)
        if not args.force and cached_entry and cached_entry.get("text"):
            continue
        to_process.append((slug, title, art.get("text", "")))

    if args.limit > 0:
        to_process = to_process[:args.limit]

    already_done = total_articles - len(to_process)
    print(f"✅ Déjà polis en cache : {already_done}")
    print(f"🎯 Restants à polir : {len(to_process)}")
    print("=" * 70)

    if not to_process:
        print("🎉 Tous les articles demandés sont déjà restaurés !")
        sys.exit(0)

    # Statistiques d'exécution
    success_count = 0
    fail_count = 0
    total_to_do = len(to_process)
    start_time = time.time()
    lock = Lock()
    save_counter = 0

    def process_article(item):
        slug, title, raw_text = item
        if not raw_text or len(raw_text.strip()) < 10:
            return slug, title, False, "Texte brut trop court ou vide"

        # Retry logic (max 3 essais)
        for attempt in range(1, 4):
            ok, res = DictionaryPolisher.polish_article(raw_text, title=title, model=model, config=config)
            if ok:
                return slug, title, True, res
            if "quota" in res.lower() or "429" in res or "rate" in res.lower():
                time.sleep(2 * attempt)
            else:
                time.sleep(1)

        return slug, title, False, res

    print(f"\n🚀 Démarrage du traitement de {total_to_do} articles...\n")

    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = {executor.submit(process_article, item): item for item in to_process}
        
        for future in as_completed(futures):
            slug, title, ok, result = future.result()
            with lock:
                save_counter += 1
                if ok:
                    success_count += 1
                    DictionaryPolisher.set_polished_entry("vigouroux", slug, title, result, model, slug=slug)
                else:
                    fail_count += 1
                    print(f"\n⚠️ Échec sur [{title}] : {result}")

                # Calcul du temps et estimation
                elapsed = time.time() - start_time
                done = success_count + fail_count
                speed = (done / elapsed) * 60 if elapsed > 0 else 0  # articles par minute
                remaining_sec = ((total_to_do - done) / (done / elapsed)) if done > 0 and elapsed > 0 else 0
                rem_min = int(remaining_sec // 60)
                rem_sec = int(remaining_sec % 60)

                percent = (done / total_to_do) * 100
                status_line = (
                    f"\r[{percent:5.1f}%] {done}/{total_to_do} "
                    f"| ✅ {success_count} "
                    f"| ⚠️ {fail_count} "
                    f"| ⚡ {speed:4.1f} art/min "
                    f"| ⏳ Reste : {rem_min:02d}m{rem_sec:02d}s "
                    f"| En cours : {title[:20]}"
                )
                sys.stdout.write(status_line.ljust(95))
                sys.stdout.flush()

                # Sauvegarde périodique du cache tous les 20 articles
                if save_counter % 20 == 0:
                    DictionaryPolisher.save_cache()

    # Sauvegarde finale
    DictionaryPolisher.save_cache()
    total_elapsed = time.time() - start_time
    total_min = int(total_elapsed // 60)
    total_sec = int(total_elapsed % 60)

    print("\n\n" + "=" * 70)
    print("✨ TRAITEMENT PAR LOT TERMINÉ AVEC SUCCÈS !")
    print("=" * 70)
    print(f"⏱️ Durée totale : {total_min} min {total_sec} s")
    print(f"✅ Articles polis avec succès : {success_count}")
    print(f"⚠️ Échecs : {fail_count}")
    print(f"💾 Les données sont sauvegardées de façon permanente dans data/dictionaries/polished_cache.json")
    print("=" * 70)

if __name__ == "__main__":
    main()
