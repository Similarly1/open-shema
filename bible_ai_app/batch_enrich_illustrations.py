#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script de Traduction, Classification et Enrichissement IA par Lots des Illustrations.
Inspiré de batch_polish_vigouroux.py :
- Mode Multi-Clés (2 clés Google Gemini) et Multi-Modèles (Gemini 3.5 & 3.1 Flash-Lite).
- Quotas : 500 appels / jour / modèle / clé (soit 2 000 requêtes / jour).
- Traitement par lots de 3 illustrations par appel (qualité optimale & 100% du réservoir en 1 jour).
- Régulation stricte du débit (Leaky Bucket 5.5s par point d'accès pour 0 erreur 429).
- Sauvegarde continue, reprise automatique et génération immédiate des fichiers .md pour Open Shema.
"""

import os
import sys
import io
import re
import json
import time
import signal
import yaml
import requests
import argparse
import itertools
from concurrent.futures import ThreadPoolExecutor
from threading import Lock
from typing import List, Dict, Any, Tuple

# Console Windows UTF-8
sys.stdout.reconfigure(encoding='utf-8')
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, CURRENT_DIR)

from core.config import load_config
from core.sermons_manager import SermonsManager

RAW_DIR = os.path.join(CURRENT_DIR, "data", "illustrations_raw")
CACHE_FILE = os.path.join(CURRENT_DIR, "data", "illustrations_processed_cache.json")
TARGET_ILL_DIR = os.path.join(CURRENT_DIR, "data", "illustrations")

SYSTEM_PROMPT = """Tu es un théologien expert en homilétique et prédication chrétienne évangélique.
Ta mission est d'adapter, traduire (si le texte est en anglais) et classifier des illustrations pour enrichir la banque pastorale d'Open Shema.

CONSIGNES STRICTES :
1. Catégorie OBLIGATOIREMENT choisie parmi ces 11 catégories exactes :
   - "Grâce & Salut"
   - "Foi & Confiance"
   - "Pardon & Réconciliation"
   - "Épreuve & Souffrance"
   - "Amour & Compassion"
   - "Prière & Intimité"
   - "Mariage & Famille"
   - "Argent & Générosité"
   - "Évangélisation & Mission"
   - "Sainteté & Obéissance"
   - "Espérance & Éternité"

2. Type OBLIGATOIREMENT choisi parmi ces 5 genres exacts :
   - "Histoire vraie"
   - "Métaphore & Vie courante"
   - "Science & Nature"
   - "Citation"
   - "Personnel"

3. Titre : Un titre clair, percutant et évocateur en français (Max 8 mots).
4. Corps (body) :
   - Récit en français élégant, naturel et vivant (sans tournures lourdes).
   - Terminer obligatoirement par une phrase de leçon pastorale en exergue :
     > **Leçon homilétique :** [Application concrète pour le prédicateur et l'assemblée]
5. Passages associés : 1 à 3 références bibliques pertinentes au format compact (ex: ["Mt 18.21-35", "Pr 16.18"]).
6. Tags : 3 à 5 mots-clés théologiques ou éthiques en français.

FORMAT DE SORTIE JSON ATTENDU :
{
  "results": [
    {
      "id": "<id_fourni>",
      "title": "<Titre en français>",
      "category": "<une des 11 catégories>",
      "type": "<un des 5 types>",
      "tags": ["Tag1", "Tag2", "Tag3"],
      "passages_associes": ["Ref1", "Ref2"],
      "body": "<Texte formaté en Markdown avec la leçon homilétique finale>"
    }
  ]
}
"""

_cache_data: Dict[str, Any] = {}
_cache_lock = Lock()


def load_cache() -> Dict[str, Any]:
    global _cache_data
    with _cache_lock:
        if _cache_data:
            return _cache_data
        if os.path.exists(CACHE_FILE):
            try:
                with open(CACHE_FILE, "r", encoding="utf-8") as f:
                    _cache_data = json.load(f)
                    return _cache_data
            except Exception as e:
                print(f"⚠️ Erreur chargement cache : {e}")
        _cache_data = {}
        return _cache_data


def save_cache():
    global _cache_data
    with _cache_lock:
        os.makedirs(os.path.dirname(CACHE_FILE), exist_ok=True)
        try:
            with open(CACHE_FILE, "w", encoding="utf-8") as f:
                json.dump(_cache_data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"⚠️ Erreur sauvegarde cache : {e}")


def handle_sigint(signum, frame):
    print("\n\n🛑 Interruption immédiate (Ctrl+C). Sauvegarde du cache...")
    save_cache()
    print("✅ Cache sauvegardé avec succès ! Sortie.")
    os._exit(0)


signal.signal(signal.SIGINT, handle_sigint)


def load_all_keys() -> Dict[str, Any]:
    """Charge et fusionne les clés locales et celles du kDrive si existantes."""
    cfg = load_config()
    kdrive_path = os.environ.get(
        "KDRIVE_KEYS_PATH",
        r"C:\Users\adrie\kDrive\Documents\Site chants de la bible\BDD JEM\config_keys.json"
    )
    ext_keys = {}
    if os.path.exists(kdrive_path):
        try:
            with open(kdrive_path, "r", encoding="utf-8") as f:
                ext_keys = json.load(f)
        except Exception:
            pass

    return {
        "gemini_key1": ext_keys.get("gemini_key1") or cfg.get("gemini_api_key"),
        "gemini_key2": ext_keys.get("gemini_key2"),
        "infomaniak_token": ext_keys.get("infomaniak_token") or cfg.get("infomaniak_token"),
        "infomaniak_product_id": ext_keys.get("infomaniak_product_id") or cfg.get("infomaniak_product_id", "251"),
    }


class EndpointRateLimiter:
    """Régulateur de débit strict (Leaky Bucket) garantissant le respect des RPM."""
    def __init__(self, min_interval: float = 5.5):
        self.min_interval = min_interval
        self.next_allowed_time = 0.0
        self.lock = Lock()

    def acquire(self):
        with self.lock:
            now = time.time()
            target_time = max(now, self.next_allowed_time)
            self.next_allowed_time = target_time + self.min_interval

        sleep_time = target_time - now
        if sleep_time > 0:
            time.sleep(sleep_time)


def build_gemini_pool(keys: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Construit un pool combinant les 2 clés et les modèles 3.5 & 3.1 Flash-Lite."""
    pool = []
    # Intervalle de 5.5s = ~10.9 RPM (marge de sécurité parfaite sous les 15 RPM)
    if keys.get("gemini_key1"):
        pool.append({
            "id": "gemini_k1_3.5",
            "name": "Gemini 3.5 Lite (K1)",
            "model": "gemini-3.5-flash-lite",
            "key": keys["gemini_key1"],
            "limiter": EndpointRateLimiter(min_interval=5.5)
        })
        pool.append({
            "id": "gemini_k1_3.1",
            "name": "Gemini 3.1 Lite (K1)",
            "model": "gemini-3.1-flash-lite",
            "key": keys["gemini_key1"],
            "limiter": EndpointRateLimiter(min_interval=5.5)
        })
    if keys.get("gemini_key2"):
        pool.append({
            "id": "gemini_k2_3.5",
            "name": "Gemini 3.5 Lite (K2)",
            "model": "gemini-3.5-flash-lite",
            "key": keys["gemini_key2"],
            "limiter": EndpointRateLimiter(min_interval=5.5)
        })
        pool.append({
            "id": "gemini_k2_3.1",
            "name": "Gemini 3.1 Lite (K2)",
            "model": "gemini-3.1-flash-lite",
            "key": keys["gemini_key2"],
            "limiter": EndpointRateLimiter(min_interval=5.5)
        })
    return pool


def call_gemini_batch(batch_items: List[Dict[str, Any]], endpoint: Dict[str, Any]) -> Tuple[bool, List[Dict[str, Any]], Dict[str, Any], str]:
    """Exécute l'appel API Gemini pour un lot de 3 illustrations."""
    endpoint["limiter"].acquire()
    model_name = endpoint["model"]
    api_key = endpoint["key"]
    
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
    user_payload = json.dumps([{
        "id": item["id"],
        "title": item.get("title", ""),
        "body": item.get("body", ""),
        "source": item.get("source", ""),
        "author": item.get("author", ""),
        "lang": item.get("lang", "en")
    } for item in batch_items], ensure_ascii=False)

    body_req = {
        "systemInstruction": {"parts": [{"text": SYSTEM_PROMPT}]},
        "contents": [{"role": "user", "parts": [{"text": user_payload}]}],
        "generationConfig": {
            "temperature": 0.2,
            "responseMimeType": "application/json"
        }
    }

    try:
        resp = requests.post(url, json=body_req, timeout=(10, 45))
        if resp.status_code == 200:
            data = resp.json()
            candidates = data.get("candidates", [])
            usage = data.get("usageMetadata", {})
            u_dict = {
                "prompt_tokens": usage.get("promptTokenCount", 0),
                "completion_tokens": usage.get("candidatesTokenCount", 0),
                "total_tokens": usage.get("totalTokenCount", 0)
            }
            if candidates and "content" in candidates[0]:
                parts = candidates[0]["content"].get("parts", [])
                if parts and "text" in parts[0]:
                    raw_json_txt = parts[0]["text"].strip()
                    parsed = json.loads(raw_json_txt)
                    results = parsed.get("results") if isinstance(parsed, dict) else (parsed if isinstance(parsed, list) else [])
                    if results and len(results) > 0:
                        return True, results, u_dict, ""
            return False, [], u_dict, "Réponse JSON vide ou malformée"
        else:
            return False, [], {}, f"HTTP {resp.status_code} : {resp.text}"
    except Exception as e:
        return False, [], {}, str(e)


def save_illustration_md(ill_obj: Dict[str, Any], raw_item: Dict[str, Any], target_dir: str = TARGET_ILL_DIR):
    """Enregistre le fichier .md final dans bible_ai_app/data/illustrations/."""
    os.makedirs(target_dir, exist_ok=True)
    ill_id = ill_obj.get("id") or raw_item.get("id")
    title = ill_obj.get("title") or raw_item.get("title") or "Illustration"
    
    # Génération du nom de fichier propre
    safe_title = re.sub(r'[^\w\s-]', '', title.lower(), flags=re.UNICODE)
    safe_title = re.sub(r'[-\s]+', '-', safe_title).strip('-')[:40].rstrip('-')
    if not safe_title:
        safe_title = "ill"
    filename = f"{safe_title}-{ill_id}.md"
    file_path = os.path.join(target_dir, filename)

    frontmatter = {
        "id": str(ill_id),
        "title": str(title),
        "category": str(ill_obj.get("category", "Général")),
        "type": str(ill_obj.get("type", "Histoire vraie")),
        "tags": ill_obj.get("tags", []),
        "passages_associes": ill_obj.get("passages_associes", []),
        "source": str(raw_item.get("source", "")),
        "author": str(raw_item.get("author", "")),
        "usage_history": [],
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "updated_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
    }

    body = ill_obj.get("body", "").strip()
    yaml_dump = yaml.dump(frontmatter, allow_unicode=True, sort_keys=False, default_flow_style=False)
    content = f"---\n{yaml_dump}---\n\n{body}\n"

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)


def load_raw_dataset(source_filter: str = "all") -> List[Dict[str, Any]]:
    """Charge toutes les illustrations brutes extraites à l'étape 1."""
    all_items = []
    files_map = {
        "esope": "raw_esope.json",
        "lafontaine": "raw_lafontaine.json",
        "moody": "raw_moody.json",
        "cyclo": "raw_cyclopedia.json"
    }

    for key, fname in files_map.items():
        if source_filter == "all" or source_filter == key:
            p = os.path.join(RAW_DIR, fname)
            if os.path.exists(p):
                with open(p, "r", encoding="utf-8") as f:
                    items = json.load(f)
                    all_items.extend(items)

    return all_items


def main():
    parser = argparse.ArgumentParser(description="Enrichissement IA par lots pour la banque d'illustrations Open Shema")
    parser.add_argument("--source", type=str, default="all", choices=["all", "esope", "lafontaine", "moody", "cyclo"], help="Filtrer la source à traiter")
    parser.add_argument("--batch-size", type=int, default=3, help="Nombre d'illustrations par appel API (défaut: 3)")
    parser.add_argument("--workers", type=int, default=6, help="Nombre de workers parallèles (défaut: 6)")
    parser.add_argument("--limit", type=int, default=0, help="Nombre maximum d'illustrations à traiter (0 = toutes)")
    parser.add_argument("--force", action="store_true", help="Forcer le recalcul des illustrations déjà présentes dans le cache")
    args = parser.parse_args()

    keys = load_all_keys()
    endpoints_pool = build_gemini_pool(keys)
    if not endpoints_pool:
        print("❌ Aucune clé Gemini valide trouvée. Vérifiez vos clés.")
        sys.exit(1)

    print("=" * 80)
    print("🎨 ENRICHISSEMENT ET CLASSIFICATION IA DES ILLUSTRATIONS (OPEN SHEMA)")
    print("=" * 80)
    print(f"⚡ Points d'accès configurés ({len(endpoints_pool)}) :")
    for ep in endpoints_pool:
        print(f"   • {ep['name']} -> Modèle : {ep['model']}")
    print(f"📦 Taille des lots : {args.batch_size} fiches / appel")
    print(f"⚡ Workers parallèles : {args.workers}")

    raw_items = load_raw_dataset(args.source)
    print(f"📚 Total illustrations brutes trouvées : {len(raw_items)}")

    cache = load_cache()
    to_process_raw = []
    for item in raw_items:
        i_id = item["id"]
        if not args.force and i_id in cache:
            continue
        to_process_raw.append(item)

    if args.limit > 0:
        to_process_raw = to_process_raw[:args.limit]

    already_done = len(raw_items) - len(to_process_raw)
    print(f"✅ Déjà enrichies en cache : {already_done}")
    print(f"🎯 Restantes à traiter : {len(to_process_raw)}")
    print("=" * 80)

    if not to_process_raw:
        print("🎉 Toutes les illustrations demandées sont déjà traitées !")
        sys.exit(0)

    # Découpage en lots de N
    batches = [to_process_raw[i:i + args.batch_size] for i in range(0, len(to_process_raw), args.batch_size)]
    total_batches = len(batches)
    print(f"🚀 Découpage en {total_batches} lots d'appels API...")

    pool_cycle = itertools.cycle(endpoints_pool)
    lock = Lock()
    success_illustrations = 0
    fail_illustrations = 0
    total_tokens = 0
    start_time = time.time()
    endpoint_stats = {ep["name"]: 0 for ep in endpoints_pool}
    raw_by_id = {it["id"]: it for it in to_process_raw}

    def process_batch(batch: List[Dict[str, Any]], start_endpoint: Dict[str, Any]):
        tried_endpoints = [ep for ep in ([start_endpoint] + [other for other in endpoints_pool if other != start_endpoint]) if not ep.get("exhausted")]
        if not tried_endpoints:
            return batch, False, [], {}, "Tous les points d'accès sont épuisés (quotas journaliers)", start_endpoint["name"]

        for ep in tried_endpoints:
            if ep.get("exhausted"):
                continue

            for attempt in range(1, 3):
                ok, results, usage, err = call_gemini_batch(batch, ep)
                if ok:
                    return batch, True, results, usage, "", ep["name"]
                
                err_lower = str(err).lower()
                if "retry in" in err_lower:
                    m = re.search(r'retry in ([0-9\.]+)s', err_lower)
                    wait_s = float(m.group(1)) + 2.0 if m else 25.0
                    time.sleep(wait_s)
                    continue
                if "generaterequestsperday" in err_lower or ("quota exceeded" in err_lower and "day" in err_lower):
                    ep["exhausted"] = True
                    print(f"\n⚠️ [{ep['name']}] Quota journalier atteint (500 req/jour). Basculement automatique !", flush=True)
                    break
                if "quota" in err_lower or "429" in err_lower or "rate" in err_lower:
                    time.sleep(4.0 * attempt)
                else:
                    time.sleep(1)

        return batch, False, [], {}, "Échec sur tous les points d'accès", start_endpoint["name"]

    executor = ThreadPoolExecutor(max_workers=args.workers)
    futures = {}
    for b in batches:
        ep = next(pool_cycle)
        fut = executor.submit(process_batch, b, ep)
        futures[fut] = b

    pending = set(futures.keys())

    try:
        while pending:
            done_futures = [f for f in list(pending) if f.done()]
            if not done_futures:
                time.sleep(0.1)
                continue

            for future in done_futures:
                pending.remove(future)
                batch_in, ok, results, usage, err, ep_name = future.result()

                with lock:
                    if ok:
                        endpoint_stats[ep_name] = endpoint_stats.get(ep_name, 0) + 1
                        total_tokens += usage.get("total_tokens", 0)
                        res_by_id = {r.get("id"): r for r in results if isinstance(r, dict) and r.get("id")}
                        
                        for item in batch_in:
                            i_id = item["id"]
                            res_obj = res_by_id.get(i_id)
                            if res_obj:
                                success_illustrations += 1
                                cache[i_id] = res_obj
                                save_illustration_md(res_obj, item)
                            else:
                                fail_illustrations += 1
                    else:
                        fail_illustrations += len(batch_in)
                        print(f"\n⚠️ Échec lot ({[it['id'] for it in batch_in]}) : {err}", flush=True)

                    total_done = success_illustrations + fail_illustrations
                    elapsed = time.time() - start_time
                    speed = (total_done / elapsed) * 60 if elapsed > 0 else 0
                    rem_sec = ((len(to_process_raw) - total_done) / (total_done / elapsed)) if total_done > 0 and elapsed > 0 else 0
                    rem_m = int(rem_sec // 60)
                    rem_s = int(rem_sec % 60)
                    percent = (total_done / len(to_process_raw)) * 100

                    last_title = results[0].get("title", "") if results and isinstance(results[0], dict) else batch_in[0].get("title", "")
                    status_line = (
                        f"\r[{percent:5.1f}%] {total_done}/{len(to_process_raw)} "
                        f"| ✅ {success_illustrations} "
                        f"| ⚡ {speed:4.1f} fiches/min "
                        f"| ⏳ {rem_m:02d}m{rem_s:02d}s "
                        f"| [{ep_name[:12]}] {last_title[:18]}"
                    )
                    sys.stdout.write(status_line.ljust(95))
                    sys.stdout.flush()

                    if (success_illustrations + fail_illustrations) % 15 == 0:
                        save_cache()

    except KeyboardInterrupt:
        print("\n\n🛑 Interruption demandée (Ctrl+C). Sauvegarde du cache...")
        executor.shutdown(wait=False, cancel_futures=True)
        save_cache()
        print(f"✅ {success_illustrations} illustrations sauvegardées avec succès !")
        os._exit(0)
    finally:
        executor.shutdown(wait=False, cancel_futures=True)

    save_cache()
    total_elapsed = time.time() - start_time
    total_min = int(total_elapsed // 60)
    total_sec = int(total_elapsed % 60)

    print("\n\n" + "=" * 80)
    print("✨ TRAITEMENT TERMINÉ AVEC SUCCÈS !")
    print("=" * 80)
    print(f"⏱️ Durée totale : {total_min} min {total_sec} s ({success_illustrations / max(0.1, total_elapsed) * 60:.1f} fiches / minute)")
    print(f"✅ Illustrations créées et enregistrées dans data/illustrations/ : {success_illustrations} / {len(to_process_raw)}")
    print(f"🔤 Total jetons traités : {total_tokens:,} tokens")
    print("-" * 80)
    print("📊 Répartition par point d'accès :")
    for ep_name, cnt in endpoint_stats.items():
        pct = (cnt / max(1, sum(endpoint_stats.values()))) * 100
        print(f"   • {ep_name.ljust(30)} : {cnt:5d} lots ({pct:5.1f}%)")
    print("=" * 80)


if __name__ == "__main__":
    main()
