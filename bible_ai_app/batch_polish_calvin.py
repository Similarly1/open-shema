#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script de restauration, structuration et polissage IA par lot pour les Commentaires Bibliques de Jean Calvin.
Inspiré de batch_polish_vigouroux.py avec optimisation par Chapitre (Batching) :
- Traitement par chapitre complet pour minimiser les requêtes API (1 chapitre = 1 requête au lieu de 20-50 requêtes).
- Mode HYBRIDE Multi-Clés & Multi-Fournisseurs (Google Gemini 3.5/3.1 Lite, Infomaniak Mistral, Mistral AI).
- Gestion des quotas journaliers (RPD) et du débit (RPM).
- Sauvegarde continue, reprise automatique en cas d'interruption et calcul financier précis.
"""

import os
import sys
import json
import re
import time
import signal
import argparse
import itertools
import requests
from concurrent.futures import ThreadPoolExecutor
from threading import Lock

# Configuration encodage console Windows
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from core.config import load_config

CALVIN_SYSTEM_PROMPT = """Tu es un théologien réformé, philologue biblique et éditeur scientifique spécialisé dans l'œuvre de Jean Calvin.
Ton rôle est de restaurer, moderniser, structurer et sublimer les commentaires de Jean Calvin pour l'application d'étude biblique Open Shema.

RÈGLE ABSOLUE DE STYLE :
- AUCUN EMOJI : Tu ne dois JAMAIS utiliser d'émojis (aucun symbole graphique de type 💡, 📌, ℹ️, ⚠️, 📖, etc.). Le style doit être strictement sobre, noble, académique et typographique.

RÈGLES D'OR DE STRUCTURATION ET ÉDITION :
1. Correction des Calques Anglais & Contresens Majeurs :
   - Les textes sources proviennent d'une rétro-traduction anglaise automatique (Calvin Translation Society) avec des faux-amis et contresens graves à corriger impérativement :
     • "Maris hommes / mari homme" (*husbandmen*) -> "Laboureurs / agriculteurs" (contresens majeur !)
     • "Remettre le vieil homme" (*put off the old man*) -> "Se dépouiller du vieil homme / rejeter" (contresens majeur !)
     • "Vérifier la licence / l'audace" (*check license*) -> "Freiner / réprimer / brider cette licence téméraire"
     • "Honteusement manié" (*shamefully handled*) -> "Indignement maltraité / outragé aux yeux du monde"
     • "Dans le aujourd'hui" (*in the today*) -> "De nos jours / à l'heure actuelle"
     • "Faire éclater leurs artifices" (*blurt out devices*) -> "Débiter / étaler leurs vaines inventions"
     • "Thanksgiving" -> "Action de grâces"
     • "De façon saisonnière" (*seasonably*) -> "Avec à-propos / opportunément"
     • "Faire aucun compte de" (*make no account of*) -> "Ne faire aucun cas de / dédaigner"
     • "Don aveugle" (*promiscuous gift*) -> "Don banal / accordé indistinctement"
     • "Se retirer de leur entreprise" (*company*) -> "Fuir leur compagnie / fréquentation"
     • "Leur travail est jeté" (*thrown away*) -> "Leur labeur est en pure perte"
     • "Le dévot de Dieu serviteurs" (*God's devout servants*) -> "Les pieux serviteurs de Dieu"
     • "Le majeur / Le mineur" (en logique) -> "La majeure / La mineure"
   - Reconstruis une syntaxe française impeccable, noble et fluide.
   - Conserve intégralement la pensée théologique et la précision exégétique de Calvin.

2. Structure Visuelle & Sobriété (Markdown pur sans aucun émoji) :
   - Divise le commentaire en sous-sections thématiques claires (`### 1. ...`, `### 2. ...`, `#### ...`).
   - Lorsque Calvin analyse une gradation (ex: marcher -> s'arrêter -> s'asseoir), structure-la avec clarté sous forme de liste étagée.
   - Adapte la structure à la longueur réelle du commentaire (ne fabrique JAMAIS de contenu artificiel pour des notes courtes).
   - Utilise des citations en bloc `>` pour les thèses doctrinales fortes ou synthèses.

3. Langues Anciennes (Hébreu, Grec, Latin) :
   - Restitue correctement les termes originaux en hébreu (ex: בָּרָא / *Bara*, אֱלֹהִים / *Elohim*) et grec avec translittération et sens.
   - Mets en *italique* les expressions latines (*creatio ex nihilo*, *Dominus potentiarum omnium*).

4. Notes de l'Éditeur (XIXe siècle / Calvin Translation Society) :
   - Les commentaires contiennent souvent des ajouts d'éditeurs (marqués par "- Ed.", des citations de Hengstenberg, Le Clerc, etc.).
   - Isole TOUJOURS ces ajouts dans un bloc dédié en fin de verset sans émoji :
     `> **Note de l'éditeur (CTS) :** ...`

5. Notes de bas de page :
   - Nettoie les numéros bruts comme `(35)`, `(36)` et convertis-les en vraies notes Markdown `[^1]`, `[^2]` avec leurs explications si présentes.

6. Références bibliques :
   - Harmonise les références pour faciliter les liens interactifs (ex: *Genèse 1:2*, *Psaume 104:30*).

FORMAT DE SORTIE REQUIS (JSON STRICT) :
Tu dois impérativement répondre UNIQUEMENT par un objet JSON valide suivant ce schéma :
{
  "verses": [
    {
      "verse": 1,
      "reference": "Genèse 1:1",
      "markdown": "### 1. « Au commencement » : La Création *ex nihilo*\\n\\n..."
    }
  ]
}
"""

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

class CalvinPolisherCache:
    _cache = None
    _cache_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "commentaires", "03_calvin", "calvin_polished_cache.json")
    _lock = Lock()

    @classmethod
    def load_cache(cls):
        with cls._lock:
            if cls._cache is not None:
                return cls._cache
            if os.path.exists(cls._cache_file):
                try:
                    with open(cls._cache_file, "r", encoding="utf-8") as f:
                        cls._cache = json.load(f)
                        return cls._cache
                except Exception as e:
                    print(f"⚠️ Erreur chargement cache Calvin : {e}")
            cls._cache = {}
            return cls._cache

    @classmethod
    def save_cache(cls):
        with cls._lock:
            if cls._cache is None:
                return
            os.makedirs(os.path.dirname(cls._cache_file), exist_ok=True)
            try:
                with open(cls._cache_file, "w", encoding="utf-8") as f:
                    json.dump(cls._cache, f, ensure_ascii=False, indent=2)
            except Exception as e:
                print(f"⚠️ Erreur sauvegarde cache Calvin : {e}")

    @classmethod
    def get_key(cls, book_code, chapter_num):
        return f"{book_code}:{chapter_num}"

    @classmethod
    def is_chapter_cached(cls, book_code, chapter_num):
        cache = cls.load_cache()
        key = cls.get_key(book_code, chapter_num)
        return key in cache and bool(cache[key].get("verses"))

    @classmethod
    def set_chapter(cls, book_code, chapter_num, verses_data, model_name):
        cache = cls.load_cache()
        key = cls.get_key(book_code, chapter_num)
        cache[key] = {
            "book": book_code,
            "chapter": chapter_num,
            "updated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
            "model": model_name,
            "verses": verses_data
        }


def handle_sigint(signum, frame):
    print("\n\n🛑 Interruption immédiate (Ctrl+C). Sauvegarde du cache...")
    try:
        CalvinPolisherCache.save_cache()
    except Exception:
        pass
    print("✅ Cache Calvin sauvegardé avec succès ! Sortie.")
    os._exit(0)

signal.signal(signal.SIGINT, handle_sigint)


def load_all_keys():
    """Charge et fusionne les clés locales et celles du kDrive."""
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
        "mistral_key": ext_keys.get("mistral_key") or cfg.get("mistral_api_key")
    }

class EndpointRateLimiter:
    """Régulateur de débit strict (Leaky Bucket) pour respecter les quotas RPM."""
    def __init__(self, min_interval=5.5):
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


def build_gemini_pool(keys):
    pool = []
    if keys.get("gemini_key1"):
        pool.append({
            "id": "gemini_k1_3.5",
            "name": "Gemini 3.5 Lite (Clé 1)",
            "model": "gemini-3.5-flash-lite",
            "config": {"gemini_api_key": keys["gemini_key1"]},
            "limiter": EndpointRateLimiter(min_interval=5.5)
        })
        pool.append({
            "id": "gemini_k1_3.1",
            "name": "Gemini 3.1 Lite (Clé 1)",
            "model": "gemini-3.1-flash-lite",
            "config": {"gemini_api_key": keys["gemini_key1"]},
            "limiter": EndpointRateLimiter(min_interval=5.5)
        })
    if keys.get("gemini_key2"):
        pool.append({
            "id": "gemini_k2_3.5",
            "name": "Gemini 3.5 Lite (Clé 2)",
            "model": "gemini-3.5-flash-lite",
            "config": {"gemini_api_key": keys["gemini_key2"]},
            "limiter": EndpointRateLimiter(min_interval=5.5)
        })
        pool.append({
            "id": "gemini_k2_3.1",
            "name": "Gemini 3.1 Lite (Clé 2)",
            "model": "gemini-3.1-flash-lite",
            "config": {"gemini_api_key": keys["gemini_key2"]},
            "limiter": EndpointRateLimiter(min_interval=5.5)
        })
    return pool


def build_hybrid_pool(keys):
    pool = []
    if keys.get("infomaniak_token"):
        pool.append({
            "id": "infomaniak",
            "name": "Infomaniak (Ministral)",
            "model": "mistralai/Ministral-3-14B-Instruct-2512",
            "config": {
                "infomaniak_token": keys["infomaniak_token"],
                "infomaniak_product_id": keys.get("infomaniak_product_id", "251")
            },
            "limiter": EndpointRateLimiter(min_interval=2.0)
        })
    pool.extend(build_gemini_pool(keys))
    return pool


def clean_json_response(raw_text):
    """Extrait et assainit le JSON renvoyé par le LLM."""
    if not raw_text:
        return None
    cleaned = raw_text.strip()
    # Supprimer balises markdown ```json
    if "```" in cleaned:
        cleaned = re.sub(r"^```(?:json)?\s*\n?", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\n?```\s*$", "", cleaned)
        cleaned = cleaned.strip()

    try:
        return json.loads(cleaned)
    except Exception:
        # Tenter d'extraire le premier objet JSON valide
        match = re.search(r'\{[\s\S]*\}', cleaned)
        if match:
            try:
                return json.loads(match.group(0))
            except Exception:
                pass
    return None


def call_llm_chapter(chapter_item, endpoint):
    """Envoie un chapitre complet de commentaires à l'API LLM et récupère le JSON structuré."""
    book_name = chapter_item["book_name"]
    book_code = chapter_item["book_code"]
    chap_num = chapter_item["chapter"]
    raw_verses = chapter_item["verses"]

    # Construction du contenu utilisateur
    verses_text_blocks = []
    for v in raw_verses:
        v_ref = v.get("reference") or f"{book_name} {chap_num}:{v.get('verse_start')}"
        v_body = v.get("text") or "\n\n".join(v.get("paragraphs", []))
        verses_text_blocks.append(f"--- VERSET : {v_ref} ---\n{v_body.strip()}\n")

    full_user_prompt = f"""LIVRE : {book_name} (Code: {book_code})
CHAPITRE : {chap_num}

COMMENTAIRES BRUTS DE CALVIN POUR CE CHAPITRE :
\"\"\"
{"".join(verses_text_blocks)}
\"\"\"

RAPPEL : Réponds UNIQUEMENT en JSON avec la clé "verses" contenant la liste des versets restructurés en Markdown.
"""

    ep_config = endpoint["config"]
    clean_model = endpoint["model"]
    usage_res = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}

    # 1. Fournisseur Gemini
    if "gemini" in clean_model or "google" in clean_model:
        g_key = ep_config.get("gemini_api_key")
        if not g_key:
            return False, "Clé API Gemini manquante", usage_res

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{clean_model}:generateContent?key={g_key}"
        payload = {
            "systemInstruction": {
                "parts": [{"text": CALVIN_SYSTEM_PROMPT}]
            },
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": full_user_prompt}]
                }
            ],
            "generationConfig": {
                "temperature": 0.2,
                "topP": 0.95,
                "maxOutputTokens": 8192,
                "responseMimeType": "application/json"
            }
        }

        try:
            if endpoint.get("limiter"):
                endpoint["limiter"].acquire()

            resp = requests.post(url, json=payload, timeout=(15, 90))
            if resp.status_code == 200:
                data = resp.json()
                raw_u = data.get("usageMetadata", {})
                usage_res = {
                    "prompt_tokens": raw_u.get("promptTokenCount", 0),
                    "completion_tokens": raw_u.get("candidatesTokenCount", 0),
                    "total_tokens": raw_u.get("totalTokenCount", 0)
                }
                candidates = data.get("candidates", [])
                if candidates and "content" in candidates[0]:
                    parts = candidates[0]["content"].get("parts", [])
                    if parts and "text" in parts[0]:
                        raw_json_str = parts[0]["text"]
                        parsed = clean_json_response(raw_json_str)
                        if parsed and "verses" in parsed:
                            return True, parsed["verses"], usage_res
                        return False, f"JSON invalide retourné : {raw_json_str[:200]}...", usage_res
                return False, "Réponse Gemini vide", usage_res
            else:
                return False, f"Erreur Gemini ({resp.status_code}) : {resp.text}", usage_res
        except Exception as e:
            return False, f"Exception Gemini : {e}", usage_res

    # 2. Fournisseur Infomaniak
    elif "ministral" in clean_model.lower() or "infomaniak" in endpoint.get("id", ""):
        token = ep_config.get("infomaniak_token")
        product_id = ep_config.get("infomaniak_product_id", "251")
        if not token:
            return False, "Token Infomaniak manquant", usage_res

        url = f"https://api.infomaniak.com/1/ai/{product_id}/openai/chat/completions"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": clean_model,
            "messages": [
                {"role": "system", "content": CALVIN_SYSTEM_PROMPT},
                {"role": "user", "content": full_user_prompt}
            ],
            "temperature": 0.2,
            "max_tokens": 8192,
            "response_format": {"type": "json_object"}
        }

        try:
            if endpoint.get("limiter"):
                endpoint["limiter"].acquire()

            resp = requests.post(url, headers=headers, json=payload, timeout=120)
            if resp.status_code == 200:
                data = resp.json()
                raw_u = data.get("usage", {})
                usage_res = {
                    "prompt_tokens": raw_u.get("prompt_tokens", 0),
                    "completion_tokens": raw_u.get("completion_tokens", 0),
                    "total_tokens": raw_u.get("total_tokens", 0)
                }
                content = data["choices"][0]["message"]["content"]
                parsed = clean_json_response(content)
                if parsed and "verses" in parsed:
                    return True, parsed["verses"], usage_res
                return False, f"JSON Infomaniak invalide : {content[:200]}...", usage_res
            return False, f"Erreur Infomaniak ({resp.status_code}) : {resp.text}", usage_res
        except Exception as e:
            return False, f"Exception Infomaniak : {e}", usage_res

    return False, f"Modèle non supporté : {clean_model}", usage_res


def load_calvin_chapters(target_book=None, target_chapter=None):
    """Charge tous les chapitres disponibles depuis les fichiers JSON des livres."""
    base_dir = os.path.dirname(os.path.abspath(__file__))
    livres_dir = os.path.join(base_dir, "data", "commentaires", "03_calvin", "livres")
    
    if not os.path.exists(livres_dir):
        print(f"❌ Erreur : Dossier introuvable {livres_dir}")
        return []

    chapter_items = []
    book_files = sorted([f for f in os.listdir(livres_dir) if f.endswith(".json")])

    for bf in book_files:
        code = bf[:-5] # ex: Gen
        if target_book and code.lower() != target_book.lower() and target_book.lower() not in bf.lower():
            continue

        f_path = os.path.join(livres_dir, bf)
        try:
            with open(f_path, "r", encoding="utf-8") as f:
                b_data = json.load(f)

            b_name = b_data.get("book_name") or code
            chapters = b_data.get("chapters", [])

            for ch in chapters:
                ch_num = ch.get("chapter")
                if target_chapter and int(ch_num) != int(target_chapter):
                    continue

                chapter_items.append({
                    "book_code": code,
                    "book_name": b_name,
                    "chapter": ch_num,
                    "verse_count": ch.get("verse_count", len(ch.get("verses", []))),
                    "verses": ch.get("verses", [])
                })
        except Exception as e:
            print(f"⚠️ Erreur lecture fichier {bf} : {e}")

    return chapter_items


def main():
    parser = argparse.ArgumentParser(description="Polissage et Restructuration IA par lot - Commentaires de Calvin")
    parser.add_argument("--book", type=str, default="", help="Livre spécifique à traiter (ex: Gen, Rom, Mat)")
    parser.add_argument("--chapter", type=int, default=0, help="Chapitre spécifique à traiter (ex: 1)")
    parser.add_argument("--model", type=str, default="gemini", help="Modèle ('gemini', 'hybrid', ou nom spécifique)")
    parser.add_argument("--workers", type=int, default=4, help="Nombre de threads parallèles (défaut: 4)")
    parser.add_argument("--limit", type=int, default=0, help="Nombre max de chapitres à traiter (0 = tous)")
    parser.add_argument("--force", action="store_true", help="Forcer le recalcul des chapitres déjà en cache")
    parser.add_argument("--dry-run", action="store_true", help="Afficher les chapitres à traiter sans appeler l'API")
    args = parser.parse_args()

    keys = load_all_keys()
    m_choice = args.model.lower().strip()

    if m_choice in {"gemini", "gemini-pool", "google"}:
        endpoints_pool = build_gemini_pool(keys)
        workers_count = args.workers or len(endpoints_pool)
        pool_title = "POOL 100% GOOGLE GEMINI (2 Clés x Modèles 3.5 & 3.1 Flash-Lite)"
    elif m_choice in {"hybrid", "hybride", "multi"}:
        endpoints_pool = build_hybrid_pool(keys)
        workers_count = args.workers or len(endpoints_pool)
        pool_title = "MODE HYBRIDE (Infomaniak + 2 Clés Gemini)"
    else:
        cfg = load_config()
        endpoints_pool = [{
            "id": "single",
            "name": args.model,
            "model": args.model,
            "config": cfg,
            "limiter": EndpointRateLimiter(min_interval=5.0)
        }]
        workers_count = args.workers or 2
        pool_title = f"Modèle unique : {args.model}"

    print("=" * 80)
    print("📖 POLISSAGE & ENRICHISSEMENT IA - COMMENTAIRES DE JEAN CALVIN")
    print("=" * 80)
    print(f"⚡ {pool_title}")
    print(f"🎯 Points d'accès ({len(endpoints_pool)}) :")
    for ep in endpoints_pool:
        print(f"   • {ep['name']} -> Modèle : {ep['model']}")
    print(f"⚡ Threads parallèles : {workers_count}")

    # Chargement des chapitres
    all_chapters = load_calvin_chapters(target_book=args.book or None, target_chapter=args.chapter or None)
    total_chapters = len(all_chapters)
    print(f"📚 Total chapitres trouvés : {total_chapters}")

    # Filtrage du cache
    CalvinPolisherCache.load_cache()
    to_process = []
    for item in all_chapters:
        b_code = item["book_code"]
        c_num = item["chapter"]
        if not args.force and CalvinPolisherCache.is_chapter_cached(b_code, c_num):
            continue
        to_process.append(item)

    if args.limit > 0:
        to_process = to_process[:args.limit]

    already_done = total_chapters - len(to_process)
    print(f"✅ Déjà polis en cache : {already_done}")
    print(f"🎯 Chapitres restants à traiter : {len(to_process)}")
    print("=" * 80)

    if args.dry_run:
        print("\n🔍 MODE DRY-RUN : Liste des 15 premiers chapitres ciblés :")
        for it in to_process[:15]:
            print(f"   • {it['book_name']} ({it['book_code']}) - Chapitre {it['chapter']} ({it['verse_count']} versets)")
        print("\nFin du test à blanc.")
        sys.exit(0)

    if not to_process:
        print("🎉 Tous les chapitres demandés sont déjà restaurés et en cache !")
        sys.exit(0)

    # Variables de suivi
    success_count = 0
    fail_count = 0
    total_prompt_tokens = 0
    total_completion_tokens = 0
    total_to_do = len(to_process)
    start_time = time.time()
    lock = Lock()
    save_counter = 0
    endpoint_stats = {ep["name"]: 0 for ep in endpoints_pool}
    pool_cycle = itertools.cycle(endpoints_pool)

    def process_chapter_task(item, start_endpoint):
        b_code = item["book_code"]
        c_num = item["chapter"]
        b_name = item["book_name"]

        tried = [ep for ep in ([start_endpoint] + [other for other in endpoints_pool if other != start_endpoint]) if not ep.get("exhausted")]
        if not tried:
            return item, False, "Tous les points d'accès sont épuisés (quotas journaliers atteints)", {}, start_endpoint["name"], start_endpoint["model"]

        for ep in tried:
            if ep.get("exhausted"):
                continue

            for attempt in range(1, 3):
                ok, res, usage = call_llm_chapter(item, ep)
                if ok:
                    return item, True, res, usage, ep["name"], ep["model"]

                err_l = str(res).lower()
                # Quota journalier
                if "generaterequestsperday" in err_l or ("quota exceeded" in err_l and "day" in err_l):
                    ep["exhausted"] = True
                    print(f"\n⚠️ Point [{ep['name']}] : Quota journalier atteint. Basculement !", flush=True)
                    break

                # Pause RPM
                if "retry in" in err_l or "429" in err_l or "rate" in err_l:
                    m = re.search(r'retry in ([0-9\.]+)s', err_l)
                    wait_s = float(m.group(1)) + 2.0 if m else (15.0 * attempt)
                    print(f"\n⏳ Point [{ep['name']}] : Pause de débit {wait_s:.0f}s...", flush=True)
                    time.sleep(wait_s)
                else:
                    time.sleep(2 * attempt)

        return item, False, res, {}, start_endpoint["name"], start_endpoint["model"]

    print(f"\n🚀 Démarrage du traitement de {total_to_do} chapitres...\n")

    executor = ThreadPoolExecutor(max_workers=workers_count)
    futures = {}
    for item in to_process:
        ep = next(pool_cycle)
        fut = executor.submit(process_chapter_task, item, ep)
        futures[fut] = item

    pending = set(futures.keys())

    try:
        while pending:
            done_batch = [f for f in list(pending) if f.done()]
            if not done_batch:
                time.sleep(0.1)
                continue

            for future in done_batch:
                pending.remove(future)
                item, ok, result, usage, ep_name, used_model = future.result()
                b_code = item["book_code"]
                c_num = item["chapter"]
                label = f"{item['book_name']} {c_num}"

                with lock:
                    save_counter += 1
                    if ok:
                        success_count += 1
                        endpoint_stats[ep_name] = endpoint_stats.get(ep_name, 0) + 1
                        total_prompt_tokens += usage.get("prompt_tokens", 0)
                        total_completion_tokens += usage.get("completion_tokens", 0)

                        CalvinPolisherCache.set_chapter(b_code, c_num, result, used_model)
                    else:
                        fail_count += 1
                        print(f"\n⚠️ Échec sur [{label}] : {result}")

                    elapsed = time.time() - start_time
                    done = success_count + fail_count
                    speed = (done / elapsed) * 60 if elapsed > 0 else 0
                    remaining_sec = ((total_to_do - done) / (done / elapsed)) if done > 0 and elapsed > 0 else 0
                    rem_min = int(remaining_sec // 60)
                    rem_sec = int(remaining_sec % 60)

                    percent = (done / total_to_do) * 100
                    status_line = (
                        f"\r[{percent:5.1f}%] {done}/{total_to_do} chaps "
                        f"| ✅ {success_count} "
                        f"| ⚡ {speed:4.1f} chap/min "
                        f"| ⏳ {rem_min:02d}m{rem_sec:02d}s "
                        f"| [{ep_name[:10]}] {label[:15]}"
                    )
                    sys.stdout.write(status_line.ljust(95))
                    sys.stdout.flush()

                    if save_counter % 5 == 0:
                        CalvinPolisherCache.save_cache()

    except KeyboardInterrupt:
        print("\n\n🛑 Interruption (Ctrl+C). Sauvegarde du cache...")
        executor.shutdown(wait=False, cancel_futures=True)
        CalvinPolisherCache.save_cache()
        print(f"✅ {success_count} chapitres enregistrés. Sortie.")
        os._exit(0)
    finally:
        executor.shutdown(wait=False, cancel_futures=True)

    CalvinPolisherCache.save_cache()
    total_elapsed = time.time() - start_time
    total_min = int(total_elapsed // 60)
    total_sec = int(total_elapsed % 60)

    print("\n\n" + "=" * 80)
    print("✨ TRAITEMENT CALVIN TERMINÉ AVEC SUCCÈS !")
    print("=" * 80)
    print(f"⏱️ Durée totale : {total_min} min {total_sec} s ({success_count / max(0.1, total_elapsed) * 60:.1f} chapitres/minute)")
    print(f"✅ Chapitres polis avec succès : {success_count} / {total_to_do}")
    print(f"🔤 Jetons traités : {total_prompt_tokens + total_completion_tokens:,} tokens")
    print("-" * 80)
    print("📊 Répartition par point d'accès :")
    for ep_name, cnt in endpoint_stats.items():
        pct = (cnt / max(1, success_count)) * 100
        print(f"   • {ep_name.ljust(30)} : {cnt:5d} chapitres ({pct:5.1f}%)")
    print(f"\n💾 Cache sauvegardé dans : {CalvinPolisherCache._cache_file}")
    print("=" * 80)


if __name__ == "__main__":
    main()
