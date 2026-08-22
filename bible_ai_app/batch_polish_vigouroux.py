#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script de restauration et polissage IA par lot pour l'intégralité du Dictionnaire Vigouroux (1912).
Supporte :
- Infomaniak Swiss AI (mistralai/Ministral-3-14B-Instruct-2512, mistralai/Mistral-Small-4-119B-2603)
- Google Gemini (gemini-2.5-flash-lite, gemini-2.5-flash)
- Mistral AI direct (mistral-small-latest)
- Multi-threading, reprise automatique (checkpointing), suivi des tokens et calcul précis du coût.
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
from core.dictionary_polisher import DictionaryPolisher

# Tarification exacte par million de tokens (Input / Output)
MODEL_PRICING = {
    "mistralai/ministral-3-14b-instruct-2512": {"input_per_m": 0.30, "output_per_m": 0.40, "curr": "CHF"},
    "mistralai/mistral-small-4-119b-2603": {"input_per_m": 0.60, "output_per_m": 1.80, "curr": "CHF"},
    "swiss-ai/apertus-v1.5-70b": {"input_per_m": 0.60, "output_per_m": 1.80, "curr": "CHF"},
    "gemini-2.5-flash-lite": {"input_per_m": 0.075, "output_per_m": 0.30, "curr": "$"},
    "gemini-2.5-flash": {"input_per_m": 0.15, "output_per_m": 0.60, "curr": "$"},
    "gemini-3.5-flash-lite": {"input_per_m": 0.075, "output_per_m": 0.30, "curr": "$"},
    "gemini-3.7-flash": {"input_per_m": 0.15, "output_per_m": 0.60, "curr": "$"},
    "mistral-small-latest": {"input_per_m": 0.20, "output_per_m": 0.60, "curr": "€"},
}

def get_pricing_info(model_name):
    m_clean = model_name.lower().strip().replace("infomaniak/", "")
    for k, v in MODEL_PRICING.items():
        if k in m_clean or m_clean in k:
            return v
    return {"input_per_m": 0.20, "output_per_m": 0.60, "curr": "€/$"}

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
        default=50,
        help="Nombre maximum d'articles à traiter (défaut: 50, 0 = tous)"
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

    pricing = get_pricing_info(model)

    print("=" * 75)
    print("📖 TEST DE RESTAURATION ET POLISSAGE PAR LOT - VIGOUROUX (1912)")
    print("=" * 75)
    print(f"🤖 Modèle sélectionné : {model}")
    print(f"⚡ Threads parallèles : {args.workers}")
    print(f"💰 Grille tarifaire estimée : {pricing['input_per_m']}{pricing['curr']}/1M in, {pricing['output_per_m']}{pricing['curr']}/1M out")

    with open(dict_path, "r", encoding="utf-8") as f:
        vig_data = json.load(f)

    articles = vig_data.get("articles", {})
    all_keys = list(articles.keys())
    total_articles = len(all_keys)
    print(f"📚 Total articles dans le dictionnaire : {total_articles}")

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
    print(f"🎯 Articles sélectionnés pour ce test : {len(to_process)}")
    print("=" * 75)

    if not to_process:
        print("🎉 Tous les articles demandés sont déjà restaurés !")
        sys.exit(0)

    # Statistiques d'exécution
    success_count = 0
    fail_count = 0
    total_prompt_tokens = 0
    total_completion_tokens = 0
    total_chars_in = 0
    total_chars_out = 0
    total_to_do = len(to_process)
    start_time = time.time()
    lock = Lock()
    save_counter = 0

    def process_article(item):
        slug, title, raw_text = item
        if not raw_text or len(raw_text.strip()) < 10:
            return slug, title, False, "Texte brut trop court ou vide", {}

        for attempt in range(1, 4):
            ok, res, usage = DictionaryPolisher.polish_article(
                raw_text,
                title=title,
                model=model,
                config=config,
                return_usage=True
            )
            if ok:
                return slug, title, True, res, usage
            if "quota" in str(res).lower() or "429" in str(res) or "rate" in str(res).lower():
                time.sleep(2 * attempt)
            else:
                time.sleep(1)

        return slug, title, False, res, {}

    print(f"\n🚀 Démarrage du traitement de {total_to_do} articles...\n")

    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = {executor.submit(process_article, item): item for item in to_process}
        
        for future in as_completed(futures):
            slug, title, ok, result, usage = future.result()
            with lock:
                save_counter += 1
                if ok:
                    success_count += 1
                    p_tok = usage.get("prompt_tokens", 0)
                    c_tok = usage.get("completion_tokens", 0)
                    
                    # Fallback d'estimation si l'API ne renvoie pas l'usage
                    if p_tok == 0:
                        raw_t = articles.get(slug, {}).get("text", "")
                        p_tok = int(len(raw_t) / 3.5)
                    if c_tok == 0:
                        c_tok = int(len(result) / 3.5)

                    total_prompt_tokens += p_tok
                    total_completion_tokens += c_tok
                    total_chars_out += len(result)
                    raw_t = articles.get(slug, {}).get("text", "")
                    total_chars_in += len(raw_t)

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

                # Calcul du coût temps réel
                cost_in = (total_prompt_tokens / 1_000_000) * pricing["input_per_m"]
                cost_out = (total_completion_tokens / 1_000_000) * pricing["output_per_m"]
                current_cost = cost_in + cost_out

                percent = (done / total_to_do) * 100
                status_line = (
                    f"\r[{percent:5.1f}%] {done}/{total_to_do} "
                    f"| ✅ {success_count} "
                    f"| ⚡ {speed:4.1f} art/min "
                    f"| 💰 {current_cost:.4f}{pricing['curr']} "
                    f"| ⏳ {rem_min:02d}m{rem_sec:02d}s "
                    f"| En cours : {title[:18]}"
                )
                sys.stdout.write(status_line.ljust(95))
                sys.stdout.flush()

                if save_counter % 10 == 0:
                    DictionaryPolisher.save_cache()

    DictionaryPolisher.save_cache()
    total_elapsed = time.time() - start_time
    total_min = int(total_elapsed // 60)
    total_sec = int(total_elapsed % 60)

    # Calculs financiers finaux
    cost_in = (total_prompt_tokens / 1_000_000) * pricing["input_per_m"]
    cost_out = (total_completion_tokens / 1_000_000) * pricing["output_per_m"]
    batch_cost = cost_in + cost_out
    
    avg_tokens_per_art = (total_prompt_tokens + total_completion_tokens) / max(1, success_count)
    avg_cost_per_art = batch_cost / max(1, success_count)
    extrapolated_total_cost = avg_cost_per_art * total_articles
    
    extrapolated_seconds = (total_articles / (success_count / total_elapsed)) if success_count > 0 and total_elapsed > 0 else 0
    extrap_hours = int(extrapolated_seconds // 3600)
    extrap_mins = int((extrapolated_seconds % 3600) // 60)

    print("\n\n" + "=" * 75)
    print("📊 BILAN DU TEST (50 ARTICLES) & ESTIMATION DU DICTIONNAIRE COMPLET")
    print("=" * 75)
    print(f"🤖 Modèle testé : {model}")
    print(f"⏱️ Durée du test : {total_min} min {total_sec} s ({success_count / max(0.1, total_elapsed) * 60:.1f} articles / minute)")
    print(f"✅ Articles polis avec succès : {success_count} / {total_to_do}")
    print(f"🔤 Jetons consommés : {total_prompt_tokens:,} in + {total_completion_tokens:,} out = {total_prompt_tokens + total_completion_tokens:,} tokens")
    print(f"💵 COÛT DU TEST ({success_count} articles) : {batch_cost:.4f} {pricing['curr']}")
    print(f"📌 Coût moyen par article : {avg_cost_per_art:.5f} {pricing['curr']} (~{avg_tokens_per_art:.0f} tokens/art)")
    print("-" * 75)
    print(f"🔮 PROJECTION POUR LES {total_articles:,} ARTICLES COMPLETS :")
    print(f"   💰 Coût estimé total : {extrapolated_total_cost:.2f} {pricing['curr']}")
    print(f"   ⏱️ Durée estimée totale : environ {extrap_hours}h {extrap_mins}min (avec {args.workers} workers)")
    print("=" * 75)

if __name__ == "__main__":
    main()
