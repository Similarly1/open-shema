#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script de restauration et polissage IA par lot pour l'intégralité du Dictionnaire Vigouroux (1912).
Mode HYBRIDE Multi-Clés & Multi-Fournisseurs :
- Répartition intelligente de la charge entre Infomaniak (Ministral-14B / Mistral-Small) et 2 clés Google Gemini (Gemini 3.5 & 3.1 Flash-Lite).
- Débit démultiplié (~50-70 articles/min), contournement automatique des limites de requêtes (RPM).
- Basculement automatique (failover) en cas de lenteur d'un fournisseur.
- Sauvegarde continue, reprise automatique et calcul financier précis.
"""

import os
import sys
import json
import time
import argparse
import itertools
from concurrent.futures import ThreadPoolExecutor, as_completed
from threading import Lock

# Configuration encodage console Windows
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from core.config import load_config
from core.dictionary_polisher import DictionaryPolisher

MODEL_PRICING = {
    "mistralai/ministral-3-14b-instruct-2512": {"input_per_m": 0.30, "output_per_m": 0.40, "curr": "CHF"},
    "mistralai/mistral-small-4-119b-2603": {"input_per_m": 0.60, "output_per_m": 1.80, "curr": "CHF"},
    "gemini-3.5-flash-lite": {"input_per_m": 0.075, "output_per_m": 0.30, "curr": "$"},
    "gemini-3.1-flash-lite": {"input_per_m": 0.075, "output_per_m": 0.30, "curr": "$"},
    "gemini-2.5-flash-lite": {"input_per_m": 0.075, "output_per_m": 0.30, "curr": "$"},
    "gemini-2.5-flash": {"input_per_m": 0.15, "output_per_m": 0.60, "curr": "$"},
    "gemini-3.7-flash": {"input_per_m": 0.15, "output_per_m": 0.60, "curr": "$"},
    "mistral-small-latest": {"input_per_m": 0.20, "output_per_m": 0.60, "curr": "€"},
}

def load_all_keys():
    """Charge et fusionne les clés locales et celles du kDrive si existantes."""
    cfg = load_config()
    kdrive_path = r"C:\Users\adrie\kDrive\Documents\Site chants de la bible\BDD JEM\config_keys.json"
    ext_keys = {}
    if os.path.exists(kdrive_path):
        try:
            with open(kdrive_path, "r", encoding="utf-8") as f:
                ext_keys = json.load(f)
        except Exception:
            pass
            
    keys = {
        "gemini_key1": ext_keys.get("gemini_key1") or cfg.get("gemini_api_key"),
        "gemini_key2": ext_keys.get("gemini_key2"),
        "infomaniak_token": ext_keys.get("infomaniak_token") or cfg.get("infomaniak_token"),
        "infomaniak_product_id": ext_keys.get("infomaniak_product_id") or cfg.get("infomaniak_product_id", "251"),
        "mistral_key": ext_keys.get("mistral_key") or cfg.get("mistral_api_key")
    }
    return keys

def build_gemini_pool(keys):
    """Construit un pool 100% Google Gemini combinant les 2 clés et les modèles 3.5 & 3.1 Flash-Lite."""
    pool = []
    if keys.get("gemini_key1"):
        pool.append({
            "id": "gemini_k1_3.5",
            "name": "Gemini 3.5 Lite (Clé 1)",
            "model": "gemini-3.5-flash-lite",
            "config": {"gemini_api_key": keys["gemini_key1"]}
        })
        pool.append({
            "id": "gemini_k1_3.1",
            "name": "Gemini 3.1 Lite (Clé 1)",
            "model": "gemini-3.1-flash-lite",
            "config": {"gemini_api_key": keys["gemini_key1"]}
        })
    if keys.get("gemini_key2"):
        pool.append({
            "id": "gemini_k2_3.5",
            "name": "Gemini 3.5 Lite (Clé 2)",
            "model": "gemini-3.5-flash-lite",
            "config": {"gemini_api_key": keys["gemini_key2"]}
        })
        pool.append({
            "id": "gemini_k2_3.1",
            "name": "Gemini 3.1 Lite (Clé 2)",
            "model": "gemini-3.1-flash-lite",
            "config": {"gemini_api_key": keys["gemini_key2"]}
        })
    return pool

def build_hybrid_pool(keys, infomaniak_model="mistralai/Ministral-3-14B-Instruct-2512"):
    """Construit un pool de points d'accès équilibré."""
    pool = []
    
    # 1. Point d'accès Infomaniak
    if keys.get("infomaniak_token"):
        pool.append({
            "id": "infomaniak",
            "name": "Infomaniak (Ministral)",
            "model": infomaniak_model,
            "config": {
                "infomaniak_token": keys["infomaniak_token"],
                "infomaniak_product_id": keys.get("infomaniak_product_id", "251")
            }
        })
        
    # 2. Points d'accès Gemini Clé 1
    if keys.get("gemini_key1"):
        pool.append({
            "id": "gemini_k1_3.5",
            "name": "Gemini 3.5 Lite (K1)",
            "model": "gemini-3.5-flash-lite",
            "config": {"gemini_api_key": keys["gemini_key1"]}
        })
        pool.append({
            "id": "gemini_k1_3.1",
            "name": "Gemini 3.1 Lite (K1)",
            "model": "gemini-3.1-flash-lite",
            "config": {"gemini_api_key": keys["gemini_key1"]}
        })
        
    # 3. Points d'accès Gemini Clé 2
    if keys.get("gemini_key2"):
        pool.append({
            "id": "gemini_k2_3.5",
            "name": "Gemini 3.5 Lite (K2)",
            "model": "gemini-3.5-flash-lite",
            "config": {"gemini_api_key": keys["gemini_key2"]}
        })
        pool.append({
            "id": "gemini_k2_3.1",
            "name": "Gemini 3.1 Lite (K2)",
            "model": "gemini-3.1-flash-lite",
            "config": {"gemini_api_key": keys["gemini_key2"]}
        })
        
    return pool

def main():
    parser = argparse.ArgumentParser(description="Polissage IA par lot du Dictionnaire Vigouroux (1912)")
    parser.add_argument(
        "--model",
        type=str,
        default="gemini",
        help="Modèle à utiliser : 'gemini' (pool 2 clés 3.5/3.1 Lite), 'hybrid' (Infomaniak + Gemini), ou un nom de modèle spécifique"
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=6,
        help="Nombre de requêtes parallèles simultanées (défaut: 6)"
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

    keys = load_all_keys()
    m_choice = args.model.lower().strip()
    is_gemini_pool = m_choice in {"gemini", "gemini-pool", "gemini-dual", "gemini-only", "google"}
    is_hybrid = m_choice in {"hybrid", "hybride", "multi", "pool", "all"}
    
    if is_gemini_pool:
        endpoints_pool = build_gemini_pool(keys)
        workers_count = args.workers or 6
        pool_title = "POOL 100% GOOGLE GEMINI (2 Clés x Modèles 3.5 & 3.1 Flash-Lite)"
    elif is_hybrid:
        endpoints_pool = build_hybrid_pool(keys)
        workers_count = args.workers or 8
        pool_title = "MODE HYBRIDE (Infomaniak + 2 Clés Gemini)"
    else:
        cfg = load_config()
        endpoints_pool = [{
            "id": "single",
            "name": args.model,
            "model": args.model,
            "config": cfg
        }]
        workers_count = args.workers or 5
        pool_title = f"Modèle unique : {args.model}"


    dict_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "vigouroux_dict.json")
    if not os.path.exists(dict_path):
        print(f"❌ Erreur : Fichier dictionnaire introuvable à {dict_path}")
        sys.exit(1)

    print("=" * 80)
    print("📖 RESTAURATION ET POLISSAGE PAR LOT - DICTIONNAIRE VIGOUROUX (1912)")
    print("=" * 80)
    print(f"⚡ {pool_title}")
    print(f"🎯 Points d'accès configurés ({len(endpoints_pool)}) :")
    for ep in endpoints_pool:
        print(f"   • {ep['name']} -> Modèle : {ep['model']}")
    print(f"⚡ Threads parallèles : {workers_count}")

    with open(dict_path, "r", encoding="utf-8") as f:
        vig_data = json.load(f)

    articles = vig_data.get("articles", {})
    all_keys = list(articles.keys())
    total_articles = len(all_keys)
    print(f"📚 Total articles dans le dictionnaire : {total_articles}")

    cache = DictionaryPolisher.load_cache()
    
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
    print("=" * 80)

    if not to_process:
        print("🎉 Tous les articles demandés sont déjà restaurés !")
        sys.exit(0)

    # Compteurs et métriques
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
    endpoint_stats = {ep["name"]: 0 for ep in endpoints_pool}

    pool_cycle = itertools.cycle(endpoints_pool)

    def process_article(item, start_endpoint):
        slug, title, raw_text = item
        if not raw_text or len(raw_text.strip()) < 10:
            return slug, title, False, "Texte trop court", {}, start_endpoint["name"], start_endpoint["model"]

        # Essayer d'abord le endpoint assigné, puis basculer sur les autres en cas d'erreur
        tried_endpoints = [start_endpoint] + [ep for ep in endpoints_pool if ep != start_endpoint]

        for ep in tried_endpoints:
            for attempt in range(1, 3):
                ok, res, usage = DictionaryPolisher.polish_article(
                    raw_text,
                    title=title,
                    model=ep["model"],
                    config=ep["config"],
                    return_usage=True
                )
                if ok:
                    return slug, title, True, res, usage, ep["name"], ep["model"]
                err_lower = str(res).lower()
                if "quota" in err_lower or "429" in err_lower or "rate" in err_lower or "resource" in err_lower or "exhausted" in err_lower:
                    time.sleep(2.5 * attempt)
                elif "timeout" in err_lower:
                    break  # Basculer immédiatement sur l'endpoint suivant si timeout
                else:
                    time.sleep(1)

        return slug, title, False, res, {}, start_endpoint["name"], start_endpoint["model"]


    print(f"\n🚀 Démarrage du traitement de {total_to_do} articles...\n")

    try:
        with ThreadPoolExecutor(max_workers=workers_count) as executor:
            futures = {}
            for item in to_process:
                ep = next(pool_cycle)
                fut = executor.submit(process_article, item, ep)
                futures[fut] = item
                
            for future in as_completed(futures):
                slug, title, ok, result, usage, ep_name, used_model = future.result()
                with lock:
                    save_counter += 1
                    if ok:
                        success_count += 1
                        endpoint_stats[ep_name] = endpoint_stats.get(ep_name, 0) + 1
                        
                        p_tok = usage.get("prompt_tokens", 0)
                        c_tok = usage.get("completion_tokens", 0)
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

                        DictionaryPolisher.set_polished_entry("vigouroux", slug, title, result, used_model, slug=slug)
                    else:
                        fail_count += 1
                        print(f"\n⚠️ Échec sur [{title}] : {result}")

                    # Calcul des vitesses et temps
                    elapsed = time.time() - start_time
                    done = success_count + fail_count
                    speed = (done / elapsed) * 60 if elapsed > 0 else 0
                    remaining_sec = ((total_to_do - done) / (done / elapsed)) if done > 0 and elapsed > 0 else 0
                    rem_min = int(remaining_sec // 60)
                    rem_sec = int(remaining_sec % 60)

                    percent = (done / total_to_do) * 100
                    status_line = (
                        f"\r[{percent:5.1f}%] {done}/{total_to_do} "
                        f"| ✅ {success_count} "
                        f"| ⚡ {speed:4.1f} art/min "
                        f"| ⏳ {rem_min:02d}m{rem_sec:02d}s "
                        f"| [{ep_name[:12]}] {title[:16]}"
                    )
                    sys.stdout.write(status_line.ljust(95))
                    sys.stdout.flush()

                    if save_counter % 10 == 0:
                        DictionaryPolisher.save_cache()

    except KeyboardInterrupt:
        print("\n\n🛑 Interruption demandée (Ctrl+C). Sauvegarde immédiate du cache...")
        DictionaryPolisher.save_cache()
        print(f"✅ {success_count} articles sauvegardés avec succès ! Vous pouvez relancer le script à tout moment pour continuer.")
        sys.exit(0)

    DictionaryPolisher.save_cache()
    total_elapsed = time.time() - start_time
    total_min = int(total_elapsed // 60)
    total_sec = int(total_elapsed % 60)

    print("\n\n" + "=" * 80)
    print("✨ TRAITEMENT TERMINÉ AVEC SUCCÈS !")
    print("=" * 80)
    print(f"⏱️ Durée totale : {total_min} min {total_sec} s ({success_count / max(0.1, total_elapsed) * 60:.1f} articles / minute)")
    print(f"✅ Articles polis avec succès : {success_count} / {total_to_do}")
    print(f"🔤 Total jetons traités : {total_prompt_tokens + total_completion_tokens:,} tokens")
    print("-" * 80)
    print("📊 Répartition par point d'accès :")
    for ep_name, cnt in endpoint_stats.items():
        pct = (cnt / max(1, success_count)) * 100
        print(f"   • {ep_name.ljust(30)} : {cnt:5d} articles ({pct:5.1f}%)")
    print("=" * 80)

if __name__ == "__main__":
    main()
