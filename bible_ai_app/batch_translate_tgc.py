#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script de Traduction IA Haute Fidélité par Lot pour The Gospel Coalition (TGC).
Modèles recommandés : Google Gemini 3.5 & 3.1 Flash-Lite (ou 2.5 / 2.0 Flash-Lite).

Caractéristiques :
- Pool Multi-Clés (2 clés Google Gemini) et Multi-Modèles (Gemini 3.5 & 3.1 Flash-Lite).
- Régulation de débit stricte (Leaky Bucket ~5.5s par point d'accès pour 0 erreur 429).
- Règle de fidélité absolue pour les théologiens vivants (zéro omission, zéro paraphrase).
- Traitement par chapitre / lot de péricopes avec découpage adaptatif pour éviter tout débordement.
- Sauvegarde continue, reprise automatique en cas d'interruption (Ctrl+C).
- Export des 66 livres complets dans `data/commentaires/tgc_francais/livres/` et synchronisation SQLite `commentaires_master.db`.
"""

import os
import sys
import json
import re
import time
import signal
import argparse
import itertools
import sqlite3
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
from threading import Lock
from typing import Dict, List, Any, Optional, Tuple

# Configuration console Windows UTF-8
sys.stdout.reconfigure(encoding='utf-8')
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, CURRENT_DIR)

from core.config import load_config
from core.translation_manager import TranslationManager

# 9 livres STRICTEMENT EXCLUS car déjà traduits officiellement en français sur Évangile21 :
EXCLUDED_SLUGS = {
    'ruth', 'matthew', 'proverbs', 'daniel', 'habakkuk', 
    'malachi', 'ephesians', 'philippians', 'james'
}

TGC_TRANSLATION_SYSTEM_PROMPT = """Tu es un traducteur théologique d'élite, expert en exégèse biblique contemporaine, langues anciennes (hébreu, grec) et théologie réformée/évangélique.
Ta mission est de traduire fidèlement de l'anglais vers un français d'excellence les commentaires bibliques de The Gospel Coalition (TGC).

RÈGLES D'OR DE TRADUCTION & ÉTHIQUE (AUTEURS VIVANTS) :
1. FIDÉLITÉ ABSOLUE ET INTÉGRALE (Zéro omission, zéro paraphrase) :
   - Les auteurs de ces commentaires sont des théologiens et exégètes contemporains vivants (D.A. Carson, Douglas Moo, Paul Jeon, Dan Doriani, etc.).
   - Tu dois traduire l'INTÉGRALITÉ du texte, paragraphe par paragraphe, sans JAMAIS résumer, abréger, paraphraser ni omettre le moindre argument ou nuance.
   - Ne formule AUCUN méta-commentaire (ex: "Voici la traduction :"), aucun préambule ni commentaire personnel. Rends directement le texte pur.

2. TERMINOLOGIE THÉOLOGIQUE ET DOCTRINALE STANDARD :
   - Traduis les concepts doctrinaux selon l'usage francophone évangélique/réformé standard :
     • "redemptive history / redemptive-historical" -> "histoire de la rédemption / histoire du salut"
     • "inaugurated eschatology / already and not yet" -> "eschatologie inaugurée / le « déjà et pas encore »"
     • "substitutionary atonement" -> "expiation par substitution / expiation substitutive"
     • "propitiation" -> "propitiation"
     • "imputed righteousness" -> "justice imputée"
     • "covenant theology / covenant" -> "théologie de l'alliance / alliance"
     • "godliness" -> "piété"
     • "justification by faith" -> "justification par la foi"
     • "general revelation / special revelation" -> "révélation générale / révélation spéciale"
   - Noms bibliques francophones standard :
     • James -> Jacques | Jude -> Jude | Isaiah -> Ésaïe | Elijah -> Élie | Elisha -> Élisée
     • Timothy -> Timothée | Titus -> Tite | Matthew -> Matthieu | John -> Jean | Paul -> Paul

3. LANGUES ANCIENNES, CITATIONS & RÉFÉRENCES :
   - Conserve intacts les termes originaux en hébreu, grec ou latin (ex: epignōsin, apseudēs, Elohim, Bara, creatio ex nihilo) avec leur translittération et analyse grammaticale.
   - Conserve fidèlement toutes les références bibliques (ex: "Titus 1:1", "Rom. 8:28", "2Tim. 4:10", "Ps. 104:30").
   - Traduis les citations bibliques en français fluide et fidèle au texte commenté (souvent ESV ou hébreu/grec original).

4. TYPOGRAPHIE & STRUCTURE (AUCUN EMOJI) :
   - AUCUN EMOJI : Tu ne dois JAMAIS utiliser d'émojis. Le style doit être strictement sobre, noble, académique et typographique.
   - Préserve scrupuleusement la structure originale en Markdown : titres de sections (###), sous-titres, puces, listes numérotées du plan (Outline), et citations en bloc (>).

FORMAT DE SORTIE REQUIS (JSON STRICT) :
Tu dois impérativement répondre UNIQUEMENT par un objet JSON valide suivant ce schéma :
{
  "chunks": [
    {
      "index": 0,
      "title": "<Titre traduit en français>",
      "text": "<Texte intégral traduit en Markdown>",
      "paragraphs": [
        "<Paragraphe 1 traduit>",
        "<Paragraphe 2 traduit>"
      ]
    }
  ]
}
"""

MODEL_PRICING = {
    "gemini-3.5-flash-lite": {"input_per_m": 0.075, "output_per_m": 0.30, "curr": "$"},
    "gemini-3.1-flash-lite": {"input_per_m": 0.075, "output_per_m": 0.30, "curr": "$"},
    "gemini-2.5-flash-lite": {"input_per_m": 0.075, "output_per_m": 0.30, "curr": "$"},
    "gemini-2.0-flash-lite": {"input_per_m": 0.075, "output_per_m": 0.30, "curr": "$"},
    "gemini-2.5-flash": {"input_per_m": 0.15, "output_per_m": 0.60, "curr": "$"},
    "gemini-3.7-flash": {"input_per_m": 0.15, "output_per_m": 0.60, "curr": "$"},
    "mistralai/ministral-3-14b-instruct-2512": {"input_per_m": 0.30, "output_per_m": 0.40, "curr": "CHF"},
    "mistralai/mistral-small-4-119b-2603": {"input_per_m": 0.60, "output_per_m": 1.80, "curr": "CHF"},
    "mistral-small-latest": {"input_per_m": 0.20, "output_per_m": 0.60, "curr": "€"},
}

class TGCTranslationCache:
    _cache = None
    _cache_file = os.path.join(CURRENT_DIR, "data", "commentaires", "tgc_francais", "tgc_translation_cache.json")
    _lock = Lock()

    @classmethod
    def load_cache(cls) -> Dict[str, Any]:
        with cls._lock:
            if os.path.exists(cls._cache_file):
                try:
                    with open(cls._cache_file, "r", encoding="utf-8") as f:
                        disk_cache = json.load(f)
                        if cls._cache is None:
                            cls._cache = disk_cache
                        else:
                            cls._cache.update(disk_cache)
                        return cls._cache
                except Exception as e:
                    print(f"⚠️ Erreur chargement cache TGC : {e}")
            if cls._cache is None:
                cls._cache = {}
            return cls._cache

    @classmethod
    def save_cache(cls):
        with cls._lock:
            if cls._cache is None:
                return
            os.makedirs(os.path.dirname(cls._cache_file), exist_ok=True)
            if os.path.exists(cls._cache_file):
                try:
                    with open(cls._cache_file, "r", encoding="utf-8") as f:
                        disk_cache = json.load(f)
                        disk_cache.update(cls._cache)
                        cls._cache = disk_cache
                except Exception:
                    pass
            try:
                with open(cls._cache_file, "w", encoding="utf-8") as f:
                    json.dump(cls._cache, f, ensure_ascii=False, indent=2)
            except Exception as e:
                print(f"⚠️ Erreur sauvegarde cache TGC : {e}")

    @classmethod
    def get_key(cls, book_code: str, chapter_num: int) -> str:
        return f"{book_code}:{chapter_num}"

    @classmethod
    def is_chapter_cached(cls, book_code: str, chapter_num: int) -> bool:
        cache = cls.load_cache()
        key = cls.get_key(book_code, chapter_num)
        if key not in cache or "chunks" not in cache[key]:
            return False
        chunks = cache[key].get("chunks", [])
        if not chunks:
            return False
        # Vérifier qu'aucun chunk n'est resté en anglais
        for c in chunks:
            txt = c.get("text", "").strip()
            if not txt:
                return False
            # Si le texte est substantiel, s'assurer qu'il est bien en français
            if len(txt) > 60 and not TranslationManager.is_french(txt):
                return False
        return True

    @classmethod
    def get_chapter(cls, book_code: str, chapter_num: int) -> Optional[Dict[str, Any]]:
        cache = cls.load_cache()
        key = cls.get_key(book_code, chapter_num)
        return cache.get(key)

    @classmethod
    def set_chapter(cls, book_code: str, chapter_num: int, chunks_data: List[Dict[str, Any]], model_name: str):
        cache = cls.load_cache()
        key = cls.get_key(book_code, chapter_num)
        cache[key] = {
            "book_code": book_code,
            "chapter": chapter_num,
            "updated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
            "model": model_name,
            "chunks": chunks_data
        }


def handle_sigint(signum, frame):
    print("\n\n🛑 Interruption immédiate (Ctrl+C). Sauvegarde du cache en cours...")
    try:
        TGCTranslationCache.save_cache()
    except Exception:
        pass
    print("✅ Cache TGC sauvegardé avec succès ! Sortie.")
    os._exit(0)

signal.signal(signal.SIGINT, handle_sigint)


def load_all_keys() -> Dict[str, str]:
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
        "gemini_key1": ext_keys.get("gemini_key1") or cfg.get("gemini_api_key") or "",
        "gemini_key2": ext_keys.get("gemini_key2") or "",
        "infomaniak_token": ext_keys.get("infomaniak_token") or cfg.get("infomaniak_token") or "",
        "infomaniak_product_id": ext_keys.get("infomaniak_product_id") or cfg.get("infomaniak_product_id", "251"),
        "mistral_key": ext_keys.get("mistral_key") or cfg.get("mistral_api_key") or ""
    }


class EndpointRateLimiter:
    """Régulateur de débit strict (Leaky Bucket) sans interblocage pour respecter les RPM."""
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


def build_gemini_pool(keys: Dict[str, str]) -> List[Dict[str, Any]]:
    """Construit le pool Google Gemini avec les clés disponibles et les modèles Flash-Lite."""
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

    # Si aucune clé kDrive n'est trouvée, utiliser la clé locale de configuration
    if not pool:
        cfg = load_config()
        gkey = cfg.get("gemini_api_key")
        if gkey:
            pool.append({
                "id": "gemini_default",
                "name": "Gemini Flash-Lite (Config locale)",
                "model": "gemini-2.5-flash-lite",
                "config": {"gemini_api_key": gkey},
                "limiter": EndpointRateLimiter(min_interval=5.0)
            })
    return pool


def build_hybrid_pool(keys: Dict[str, str]) -> List[Dict[str, Any]]:
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


def clean_json_response(raw_text: str) -> Optional[Dict[str, Any]]:
    """Extrait et assainit le JSON renvoyé par le LLM de façon ultra-robuste."""
    if not raw_text:
        return None
    cleaned = raw_text.strip()
    if "```" in cleaned:
        cleaned = re.sub(r"^```(?:json)?\s*\n?", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\n?```\s*$", "", cleaned)
        cleaned = cleaned.strip()

    # 1. Essai direct avec strict=False (tolère les retours à la ligne bruts dans les chaînes)
    try:
        return json.loads(cleaned, strict=False)
    except Exception:
        pass

    # 2. Recherche du bloc JSON global { ... }
    match = re.search(r'\{[\s\S]*\}', cleaned)
    if match:
        candidate = match.group(0)
        try:
            return json.loads(candidate, strict=False)
        except Exception:
            pass

        # 3. Réparation des retours à la ligne bruts non échappés dans les chaînes JSON
        try:
            # Remplacer les vrais sauts de ligne à l'intérieur des guillemets par \n
            fixed = re.sub(r'(?<!\\)\n', r'\\n', candidate)
            return json.loads(fixed, strict=False)
        except Exception:
            pass

    # 4. Fallback par extraction regex robuste de chaque objet JSON
    chunks_found = []
    # Pattern pour capturer les objets JSON même avec ordre de clés inversé
    for obj_match in re.finditer(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', cleaned):
        obj_str = obj_match.group(0)
        t_m = re.search(r'"title"\s*:\s*"(?P<title>(?:\\.|[^"\\])*)"', obj_str)
        txt_m = re.search(r'"text"\s*:\s*"(?P<text>(?:\\.|[^"\\])*)"', obj_str)
        idx_m = re.search(r'"index"\s*:\s*(?P<index>\d+)', obj_str)
        if txt_m:
            try:
                c_idx = int(idx_m.group("index")) if idx_m else len(chunks_found)
                raw_title = t_m.group("title") if t_m else ""
                raw_text_chunk = txt_m.group("text")
                try:
                    c_title = json.loads(f'"{raw_title}"', strict=False)
                except Exception:
                    c_title = raw_title.replace('\\"', '"').replace('\\n', '\n')
                try:
                    c_text = json.loads(f'"{raw_text_chunk}"', strict=False)
                except Exception:
                    c_text = raw_text_chunk.replace('\\"', '"').replace('\\n', '\n')

                chunks_found.append({
                    "index": c_idx,
                    "title": c_title,
                    "text": c_text,
                    "paragraphs": [p.strip() for p in c_text.split("\n\n") if p.strip()]
                })
            except Exception:
                pass

    if chunks_found:
        return {"chunks": chunks_found}

    return None


def _call_llm_single_subchunk(chapter_item: Dict[str, Any], sub_chunks: List[Dict[str, Any]], endpoint: Dict[str, Any]) -> Tuple[bool, Any, Dict[str, int]]:
    """Effectue un appel unitaire à l'API LLM pour un sous-lot de péricopes."""
    book_name = chapter_item["book_name"]
    book_code = chapter_item["book_code"]
    author = chapter_item.get("author", "Auteur TGC")
    chap_num = chapter_item["chapter"]

    # Construction du contenu utilisateur
    chunks_prompt_blocks = []
    for idx, chunk in enumerate(sub_chunks):
        c_title = chunk.get("title", "")
        c_ref = chunk.get("reference", f"{book_name} {chap_num}")
        c_text = chunk.get("text", "")
        chunks_prompt_blocks.append(
            f"=== SECTION [{idx}] ===\n"
            f"TITRE ORIGINAL : {c_title}\n"
            f"RÉFÉRENCE : {c_ref}\n"
            f"TEXTE ANGLAIS INTEGRAL DE L'AUTEUR ({author}) :\n"
            f"\"\"\"\n{c_text.strip()}\n\"\"\"\n"
        )

    full_user_prompt = f"""LIVRE : {book_name} (Code: {book_code})
CHAPITRE : {chap_num}
AUTEUR : {author}

SECTIONS À TRADUIRE FIDÈLEMENT EN FRANÇAIS :
{"".join(chunks_prompt_blocks)}

RAPPEL CRUCIAL :
- Traduis l'intégralité du texte sans rien omettre ni résumer.
- Réponds UNIQUEMENT en JSON avec la clé "chunks" contenant la liste des objets traduits (avec "index", "title", "text", "paragraphs").
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
                "parts": [{"text": TGC_TRANSLATION_SYSTEM_PROMPT}]
            },
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": full_user_prompt}]
                }
            ],
            "generationConfig": {
                "temperature": 0.1,  # Faible température pour une fidélité maximale
                "topP": 0.95,
                "maxOutputTokens": 8192,
                "responseMimeType": "application/json"
            }
        }

        for attempt in range(1, 4):
            try:
                if endpoint.get("limiter"):
                    endpoint["limiter"].acquire()

                resp = requests.post(url, json=payload, timeout=(15, 150))
                if resp.status_code == 200:
                    data = resp.json()
                    raw_u = data.get("usageMetadata", {})
                    usage_res = {
                        "prompt_tokens": raw_u.get("promptTokenCount", 0),
                        "completion_tokens": raw_u.get("candidatesTokenCount", 0),
                        "total_tokens": raw_u.get("totalTokenCount", 0)
                    }
                    candidates = data.get("candidates", [])
                    if candidates:
                        parts = candidates[0].get("content", {}).get("parts", [])
                        if parts:
                            raw_reply = parts[0].get("text", "")
                            parsed = clean_json_response(raw_reply)
                            if parsed and "chunks" in parsed:
                                return True, parsed["chunks"], usage_res
                            return False, f"JSON Gemini invalide : {raw_reply[:200]}...", usage_res
                    return False, "Réponse Gemini vide ou bloquée", usage_res
                elif resp.status_code in [429, 500, 503]:
                    if attempt < 3:
                        time.sleep(4.0 * attempt)
                        continue
                    return False, f"Erreur Gemini ({resp.status_code}) après {attempt} essais", usage_res
                else:
                    return False, f"Erreur Gemini ({resp.status_code}) : {resp.text[:300]}", usage_res
            except Exception as e:
                if attempt < 3:
                    time.sleep(3.0 * attempt)
                    continue
                return False, f"Exception Gemini : {e}", usage_res

    # 2. Fournisseur Infomaniak
    elif "ministral" in clean_model.lower() or "infomaniak" in clean_model.lower() or "qwen" in clean_model.lower():
        token = ep_config.get("infomaniak_token")
        prod_id = ep_config.get("infomaniak_product_id", "251")
        if not token:
            return False, "Token Infomaniak manquant", usage_res

        url = f"https://api.infomaniak.com/1/ai/{prod_id}/openai/chat/completions"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": clean_model,
            "messages": [
                {"role": "system", "content": TGC_TRANSLATION_SYSTEM_PROMPT},
                {"role": "user", "content": full_user_prompt}
            ],
            "temperature": 0.1,
            "max_tokens": 8192,
            "response_format": {"type": "json_object"}
        }

        try:
            if endpoint.get("limiter"):
                endpoint["limiter"].acquire()

            resp = requests.post(url, json=payload, headers=headers, timeout=(15, 150))
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
                if parsed and "chunks" in parsed:
                    return True, parsed["chunks"], usage_res
                return False, f"JSON Infomaniak invalide : {content[:200]}...", usage_res
            return False, f"Erreur Infomaniak ({resp.status_code}) : {resp.text}", usage_res
        except Exception as e:
            return False, f"Exception Infomaniak : {e}", usage_res

    return False, f"Modèle non supporté : {clean_model}", usage_res


def call_llm_with_endpoint_fallback(chapter_item: Dict[str, Any], sub_chunks: List[Dict[str, Any]], primary_ep: Dict[str, Any], pool: Optional[List[Dict[str, Any]]] = None) -> Tuple[bool, Any, Dict[str, int]]:
    """Tente la traduction avec primary_ep, et si échec / 429, bascule automatiquement sur les autres endpoints du pool."""
    all_eps = [primary_ep]
    if pool:
        all_eps.extend([ep for ep in pool if ep.get("id") != primary_ep.get("id") or ep.get("model") != primary_ep.get("model")])

    total_u = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
    last_err = ""

    for ep in all_eps:
        ok, res, u = _call_llm_single_subchunk(chapter_item, sub_chunks, ep)
        for k in total_u:
            total_u[k] += u.get(k, 0)
        if ok and isinstance(res, list):
            return True, res, total_u
        last_err = res

    return False, last_err, total_u


def _split_large_chunk(chunk: Dict[str, Any], max_words: int = 900) -> List[Dict[str, Any]]:
    """Si une péricope unique dépasse max_words, la divise en sous-blocs de paragraphes."""
    text = chunk.get("text", "")
    paragraphs = text.split("\n\n")
    if len(text.split()) <= max_words or len(paragraphs) <= 1:
        return [chunk]

    sub_chunks = []
    curr_paras = []
    curr_words = 0

    for p in paragraphs:
        p_w = len(p.split())
        if curr_paras and (curr_words + p_w > max_words):
            sub_chunks.append({
                **chunk,
                "text": "\n\n".join(curr_paras),
                "is_subpart": True
            })
            curr_paras = [p]
            curr_words = p_w
        else:
            curr_paras.append(p)
            curr_words += p_w

    if curr_paras:
        sub_chunks.append({
            **chunk,
            "text": "\n\n".join(curr_paras),
            "is_subpart": True
        })
    return sub_chunks


def _translate_single_pericope_with_split(chapter_item: Dict[str, Any], original_v: Dict[str, Any], endpoint: Dict[str, Any], pool: Optional[List[Dict[str, Any]]] = None) -> Tuple[bool, Optional[Dict[str, Any]], Dict[str, int]]:
    """Traduit une péricope unique, en la découpant en sous-parties si elle est très volumineuse."""
    sub_parts = _split_large_chunk(original_v, max_words=900)
    total_u = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
    part_texts = []
    part_titles = []
    all_part_paras = []

    for idx, part in enumerate(sub_parts):
        s_ok, s_chunks, s_u = call_llm_with_endpoint_fallback(chapter_item, [part], endpoint, pool)
        for k in total_u:
            total_u[k] += s_u.get(k, 0)
        if not s_ok or not s_chunks:
            return False, None, total_u

        c_item = s_chunks[0]
        t_txt = c_item.get("text", "").strip()
        t_tit = c_item.get("title", "").strip()
        t_paras = c_item.get("paragraphs", []) or [p.strip() for p in t_txt.split("\n\n") if p.strip()]

        part_texts.append(t_txt)
        if t_tit and not part_titles:
            part_titles.append(t_tit)
        all_part_paras.extend(t_paras)

    combined_text = "\n\n".join(part_texts)
    chunk_obj = dict(original_v)
    chunk_obj["title"] = part_titles[0] if part_titles else original_v.get("title", "")
    chunk_obj["text"] = combined_text
    chunk_obj["paragraphs"] = all_part_paras or [p.strip() for p in combined_text.split("\n\n") if p.strip()]
    return True, chunk_obj, total_u


def create_sub_batches(verses: List[Dict[str, Any]], max_words_per_batch: int = 1200, max_items_per_batch: int = 3) -> List[List[Dict[str, Any]]]:
    """Découpe adaptative des péricopes pour garantir de ne jamais dépasser le plafond de tokens de sortie."""
    batches = []
    current_batch = []
    current_words = 0
    for v in verses:
        w_count = len(v.get("text", "").split())
        if current_batch and (current_words + w_count > max_words_per_batch or len(current_batch) >= max_items_per_batch):
            batches.append(current_batch)
            current_batch = [v]
            current_words = w_count
        else:
            current_batch.append(v)
            current_words += w_count
    if current_batch:
        batches.append(current_batch)
    return batches


def call_llm_translate_chapter(chapter_item: Dict[str, Any], endpoint: Dict[str, Any], pool: Optional[List[Dict[str, Any]]] = None) -> Tuple[bool, Any, Dict[str, int]]:
    """Envoie un chapitre complet avec découpage adaptatif et vérification stricte du français."""
    raw_verses = chapter_item.get("verses", [])
    if not raw_verses:
        return True, [], {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}

    batches = create_sub_batches(raw_verses, max_words_per_batch=1200, max_items_per_batch=3)
    all_translated_chunks = []
    total_usage = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}

    for batch in batches:
        # Si le lot contient une seule très grande péricope (> 1000 mots), traitement scindé direct
        if len(batch) == 1 and len(batch[0].get("text", "").split()) > 1000:
            s_ok, s_chunk, s_u = _translate_single_pericope_with_split(chapter_item, batch[0], endpoint, pool)
            for k in total_usage:
                total_usage[k] += s_u.get(k, 0)
            if not s_ok or not s_chunk:
                return False, f"Échec traduction péricope longue {batch[0].get('title')}", total_usage
            all_translated_chunks.append(s_chunk)
            continue

        ok, res_chunks, u = call_llm_with_endpoint_fallback(chapter_item, batch, endpoint, pool)
        for k in total_usage:
            total_usage[k] += u.get(k, 0)

        # Si le lot global a échoué ou n'est pas une liste valide, repli immédiat en mode unitaire
        if not ok or not isinstance(res_chunks, list):
            for single_v in batch:
                s_ok, s_chunk, s_u = _translate_single_pericope_with_split(chapter_item, single_v, endpoint, pool)
                for k in total_usage:
                    total_usage[k] += s_u.get(k, 0)
                if not s_ok or not s_chunk:
                    return False, f"Échec traduction péricope {single_v.get('title')}", total_usage
                all_translated_chunks.append(s_chunk)
            continue

        # Vérification détaillée de chaque péricope
        for sub_idx, original_v in enumerate(batch):
            matched = None
            if sub_idx < len(res_chunks):
                matched = res_chunks[sub_idx]

            trans_text = matched.get("text", "").strip() if matched else ""
            trans_title = matched.get("title", "").strip() if matched else ""

            # Si le texte est vide ou s'il est resté en anglais, retraduction unitaire dédiée
            if not trans_text or (len(trans_text) > 60 and not TranslationManager.is_french(trans_text)):
                s_ok, s_chunk, s_u = _translate_single_pericope_with_split(chapter_item, original_v, endpoint, pool)
                for k in total_usage:
                    total_usage[k] += s_u.get(k, 0)
                if s_ok and s_chunk:
                    trans_text = s_chunk.get("text", "").strip()
                    trans_title = s_chunk.get("title", "").strip()

            trans_paras = matched.get("paragraphs", []) if (matched and matched.get("paragraphs")) else []
            if not trans_paras and trans_text:
                trans_paras = [p.strip() for p in trans_text.split("\n\n") if p.strip()]

            chunk_obj = dict(original_v)
            chunk_obj["title"] = trans_title or original_v.get("title", "")
            chunk_obj["text"] = trans_text or original_v.get("text", "")
            chunk_obj["paragraphs"] = trans_paras or original_v.get("paragraphs", [])
            all_translated_chunks.append(chunk_obj)

    return True, all_translated_chunks, total_usage


def load_tgc_chapters(target_book=None, target_chapter=None) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """Charge tous les chapitres à traduire depuis `data/commentaires/tgc_english/livres/`."""
    en_dir = os.path.join(CURRENT_DIR, "data", "commentaires", "tgc_english", "livres")
    if not os.path.exists(en_dir):
        print(f"❌ Erreur : Dossier introuvable {en_dir}")
        return [], {}

    chapter_items = []
    book_meta_map = {}
    files = sorted([f for f in os.listdir(en_dir) if f.endswith(".json")])

    for f_name in files:
        slug = f_name[:-5]
        if slug in EXCLUDED_SLUGS:
            continue

        if target_book:
            tb = target_book.lower().strip()
            if tb != slug and tb not in f_name.lower():
                continue

        f_path = os.path.join(en_dir, f_name)
        try:
            with open(f_path, "r", encoding="utf-8") as f:
                b_data = json.load(f)

            b_code = b_data.get("book_code", slug[:3].capitalize())
            b_name = b_data.get("book_name", slug)
            author = b_data.get("author", "Auteur TGC")
            
            book_meta_map[b_code] = b_data

            chapters = b_data.get("chapters", [])
            for ch in chapters:
                ch_num = ch.get("chapter", 1)
                if target_chapter and int(ch_num) != int(target_chapter):
                    continue

                chapter_items.append({
                    "slug": slug,
                    "book_code": b_code,
                    "book_name": b_name,
                    "author": author,
                    "chapter": ch_num,
                    "verse_count": ch.get("verse_count", len(ch.get("verses", []))),
                    "verses": ch.get("verses", [])
                })
        except Exception as e:
            print(f"⚠️ Erreur lecture {f_name} : {e}")

    return chapter_items, book_meta_map


def copy_french_evangile21_books():
    """Copie les 9 livres déjà traduits d'Évangile21 dans `tgc_francais/livres/`."""
    e21_dir = os.path.join(CURRENT_DIR, "data", "commentaires", "tgc_evangile21", "livres")
    fr_dir = os.path.join(CURRENT_DIR, "data", "commentaires", "tgc_francais", "livres")
    os.makedirs(fr_dir, exist_ok=True)

    if os.path.exists(e21_dir):
        for f in os.listdir(e21_dir):
            if f.endswith(".json"):
                src = os.path.join(e21_dir, f)
                dst = os.path.join(fr_dir, f)
                if not os.path.exists(dst):
                    try:
                        with open(src, "r", encoding="utf-8") as s_f:
                            content = s_f.read()
                        with open(dst, "w", encoding="utf-8") as d_f:
                            d_f.write(content)
                    except Exception as e:
                        print(f"⚠️ Erreur copie {f} vers tgc_francais : {e}")


def export_translated_books(book_meta_map: Dict[str, Any]) -> int:
    """Génère les fichiers JSON complets traduits dans `data/commentaires/tgc_francais/livres/`."""
    fr_dir = os.path.join(CURRENT_DIR, "data", "commentaires", "tgc_francais", "livres")
    os.makedirs(fr_dir, exist_ok=True)
    TGCTranslationCache.load_cache()

    exported_count = 0
    for b_code, orig_meta in book_meta_map.items():
        slug = orig_meta.get("slug", b_code)
        target_file = os.path.join(fr_dir, f"{slug}.json")

        translated_chapters = []
        is_complete = True

        for ch in orig_meta.get("chapters", []):
            ch_num = ch.get("chapter", 1)
            cached_data = TGCTranslationCache.get_chapter(b_code, ch_num)
            if cached_data and "chunks" in cached_data:
                translated_chapters.append({
                    "chapter": ch_num,
                    "verse_count": len(cached_data["chunks"]),
                    "verses": cached_data["chunks"]
                })
            else:
                is_complete = False
                break

        if is_complete and translated_chapters:
            full_book = dict(orig_meta)
            full_book["language"] = "fr"
            full_book["chapters"] = translated_chapters
            try:
                with open(target_file, "w", encoding="utf-8") as f:
                    json.dump(full_book, f, ensure_ascii=False, indent=2)
                exported_count += 1
            except Exception as e:
                print(f"⚠️ Erreur écriture livre {slug}.json : {e}")

    return exported_count


def sync_sqlite_master():
    """Synchronise l'ensemble des commentaires TGC français dans commentaires_master.db."""
    db_path = os.path.join(CURRENT_DIR, "data", "commentaires", "commentaires_master.db")
    fr_dir = os.path.join(CURRENT_DIR, "data", "commentaires", "tgc_francais", "livres")
    if not os.path.exists(fr_dir):
        return

    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS commentaries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            commentary_id TEXT,
            commentary_name TEXT,
            book_code TEXT,
            book_name TEXT,
            chapter INTEGER,
            verse_start INTEGER,
            verse_end INTEGER,
            reference TEXT,
            text TEXT,
            paragraphs_json TEXT,
            html TEXT,
            source_url TEXT
        )
    """)
    cur.execute("CREATE INDEX IF NOT EXISTS idx_comm_book_chap ON commentaries (commentary_id, book_code, chapter, verse_start)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_book_chap_verse ON commentaries (book_code, chapter, verse_start)")

    comm_id = "tgc_francais"
    comm_name = "Commentaires The Gospel Coalition (TGC)"

    cur.execute("DELETE FROM commentaries WHERE commentary_id = ?", (comm_id,))

    rows = []
    total_passages = 0
    for f in sorted(os.listdir(fr_dir)):
        if not f.endswith(".json"):
            continue
        try:
            with open(os.path.join(fr_dir, f), "r", encoding="utf-8") as jf:
                b_data = json.load(jf)
            
            b_code = b_data.get("book_code", "")
            b_name = b_data.get("book_name", "")
            author = b_data.get("author", "Auteur TGC")

            for ch in b_data.get("chapters", []):
                chap_num = ch.get("chapter", 1)
                for v in ch.get("verses", []):
                    total_passages += 1
                    rows.append((
                        comm_id,
                        comm_name,
                        b_code,
                        b_name,
                        chap_num,
                        v.get("verse_start", 1),
                        v.get("verse_end", 1),
                        f"{v.get('reference', '')} ({author})",
                        v.get("text", ""),
                        json.dumps(v.get("paragraphs", []), ensure_ascii=False),
                        "",
                        v.get("url", "")
                    ))
        except Exception as e:
            print(f"⚠️ Erreur sync SQLite {f} : {e}")

    if rows:
        cur.executemany("""
            INSERT INTO commentaries (
                commentary_id, commentary_name, book_code, book_name,
                chapter, verse_start, verse_end, reference, text, paragraphs_json, html, source_url
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, rows)
        conn.commit()
        print(f"✅ Synchronisation SQLite : {len(rows)} sections TGC enregistrées dans {db_path} !")

    conn.close()

    # Mettre à jour library.json
    lib_path = os.path.join(CURRENT_DIR, "data", "library.json")
    if os.path.exists(lib_path):
        try:
            with open(lib_path, "r", encoding="utf-8") as f:
                lib = json.load(f)

            lib["Commentaires The Gospel Coalition (TGC)"] = {
                "title": "Commentaires Bibliques The Gospel Coalition (TGC)",
                "author": "The Gospel Coalition (D.A. Carson, Douglas Moo, Dan Doriani, etc.)",
                "description": f"Commentaires bibliques contemporains complets traduits en français ({total_passages} sections exégétiques).",
                "year": "2021-2026",
                "cover_path": None,
                "type": "Commentaire",
                "format": "sqlite",
                "commentary_id": "tgc_francais",
                "chunks_count": total_passages,
                "embedding_model": "study_library",
                "active": True
            }

            with open(lib_path, "w", encoding="utf-8") as f:
                json.dump(lib, f, ensure_ascii=False, indent=2)
            print("✔ Entrée TGC ajoutée à library.json")
        except Exception as e:
            print(f"⚠️ Erreur library.json : {e}")


def main():
    parser = argparse.ArgumentParser(description="Traduction IA Haute Fidélité par Lot - Commentaires TGC")
    parser.add_argument("--book", type=str, default="", help="Livre spécifique à traduire (ex: titus, Tit, romans, 1-samuel)")
    parser.add_argument("--chapter", type=int, default=0, help="Chapitre spécifique à traduire (ex: 1)")
    parser.add_argument("--model", type=str, default="gemini", help="Modèle ('gemini', 'hybrid', ou nom spécifique)")
    parser.add_argument("--workers", type=int, default=0, help="Nombre de threads parallèles (défaut: auto selon pool)")
    parser.add_argument("--limit", type=int, default=0, help="Nombre max de chapitres à traiter (0 = tous)")
    parser.add_argument("--force", action="store_true", help="Forcer le recalcul des chapitres déjà en cache")
    parser.add_argument("--dry-run", action="store_true", help="Afficher les chapitres à traduire et l'estimation de coût sans appeler l'API")
    parser.add_argument("--sync-db", action="store_true", help="Synchroniser immédiatement le cache et les JSON vers SQLite master")
    args = parser.parse_args()

    # Copier d'abord les 9 livres d'Évangile21 dans tgc_francais
    copy_french_evangile21_books()

    if args.sync_db:
        sync_sqlite_master()
        return

    keys = load_all_keys()
    m_choice = args.model.lower().strip()

    if m_choice in {"gemini", "gemini-pool", "google"}:
        endpoints_pool = build_gemini_pool(keys)
        pool_title = "POOL 100% GOOGLE GEMINI FLASH-LITE (Multi-Clés & Modèles 3.5/3.1)"
    elif m_choice in {"hybrid", "hybride", "multi"}:
        endpoints_pool = build_hybrid_pool(keys)
        pool_title = "MODE HYBRIDE (Infomaniak Ministral + Clés Gemini)"
    else:
        cfg = load_config()
        endpoints_pool = [{
            "id": "single",
            "name": args.model,
            "model": args.model,
            "config": cfg,
            "limiter": EndpointRateLimiter(min_interval=5.0)
        }]
        pool_title = f"Modèle unique : {args.model}"

    workers_count = args.workers or len(endpoints_pool) or 1

    print("=" * 80)
    print("📖 TRADUCTION IA HAUTE FIDÉLITÉ - THE GOSPEL COALITION (TGC)")
    print("=" * 80)
    print(f"⚡ {pool_title}")
    print(f"🎯 Points d'accès configurés ({len(endpoints_pool)}) :")
    for ep in endpoints_pool:
        print(f"   • {ep['name']} -> Modèle : {ep['model']}")
    print(f"⚡ Threads parallèles : {workers_count}")

    # Chargement des chapitres
    all_chapters, book_meta_map = load_tgc_chapters(target_book=args.book or None, target_chapter=args.chapter or None)
    total_chapters = len(all_chapters)
    print(f"📚 Total chapitres TGC à traduire : {total_chapters} (hors 9 livres Évangile21)")

    # Filtrage du cache
    TGCTranslationCache.load_cache()
    to_process = []
    for item in all_chapters:
        b_code = item["book_code"]
        c_num = item["chapter"]
        if not args.force and TGCTranslationCache.is_chapter_cached(b_code, c_num):
            continue
        to_process.append(item)

    if args.limit > 0:
        to_process = to_process[:args.limit]

    already_done = total_chapters - len(to_process)
    print(f"✅ Déjà traduits en cache : {already_done}")
    print(f"🎯 Chapitres restants à traiter : {len(to_process)}")
    print("=" * 80)

    if args.dry_run:
        print("\n🔍 MODE DRY-RUN : Aperçu des 10 premiers chapitres à traiter :")
        total_est_words = 0
        for idx, it in enumerate(to_process[:10], 1):
            w_count = sum(len(v.get("text", "").split()) for v in it["verses"])
            total_est_words += w_count
            print(f"  {idx}. {it['book_name']} ({it['book_code']}) Chapitre {it['chapter']} — {it['verse_count']} péricopes (~{w_count} mots) - Auteur: {it['author']}")
        
        all_words = sum(sum(len(v.get("text", "").split()) for v in it["verses"]) for it in to_process)
        est_tokens = int(all_words * 1.4)
        est_cost_usd = (est_tokens / 1_000_000) * 0.075 + (est_tokens / 1_000_000) * 0.30
        print(f"\n📊 Estimation totale pour {len(to_process)} chapitres : ~{all_words:,} mots / ~{est_tokens:,} tokens")
        print(f"💰 Coût estimé avec Gemini Flash Lite : ~{est_cost_usd:.3f} $ USD")
        return

    if not to_process:
        print("🎉 Tous les chapitres sont déjà traduits en cache !")
        export_count = export_translated_books(book_meta_map)
        print(f"📁 {export_count} livres traduits exportés dans data/commentaires/tgc_francais/livres/")
        sync_sqlite_master()
        return

    # Lancement du traitement par lot
    start_time = time.time()
    total_tokens_spent = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
    completed_count = 0
    errors_count = 0
    lock_stats = Lock()

    endpoints_cycle = itertools.cycle(endpoints_pool)

    def process_chapter_task(item: Dict[str, Any]) -> bool:
        nonlocal completed_count, errors_count
        ep = next(endpoints_cycle)
        b_code = item["book_code"]
        b_name = item["book_name"]
        c_num = item["chapter"]

        ok, res_chunks, usage = call_llm_translate_chapter(item, ep, endpoints_pool)

        with lock_stats:
            for k in total_tokens_spent:
                total_tokens_spent[k] += usage.get(k, 0)

            if ok:
                completed_count += 1
                TGCTranslationCache.set_chapter(b_code, c_num, res_chunks, ep["model"])
                TGCTranslationCache.save_cache()

                elapsed = time.time() - start_time
                rate = completed_count / (elapsed / 60.0) if elapsed > 0 else 0
                print(f"[{completed_count + already_done}/{total_chapters}] ✅ {b_name} Ch.{c_num} ({len(res_chunks)} péricopes) via {ep['name']} | Débit: {rate:.1f} chap/min")
                return True
            else:
                errors_count += 1
                print(f"❌ [ERREUR] {b_name} Ch.{c_num} via {ep['name']} : {res_chunks}")
                return False

    executor = ThreadPoolExecutor(max_workers=workers_count)
    futures = {executor.submit(process_chapter_task, it): it for it in to_process}

    try:
        for f in as_completed(futures):
            f.result()
    except KeyboardInterrupt:
        print("\n\n🛑 Interruption détectée (Ctrl+C). Arrêt immédiat des threads...")
        executor.shutdown(wait=False, cancel_futures=True)
        TGCTranslationCache.save_cache()
        print("✅ Cache TGC sauvegardé avec succès. Sortie propre.")
        os._exit(0)
    finally:
        executor.shutdown(wait=True)

    # Sauvegarde finale
    TGCTranslationCache.save_cache()
    export_count = export_translated_books(book_meta_map)

    total_time = time.time() - start_time
    print("\n" + "=" * 80)
    print("🎉 TRAITEMENT TERMINÉ !")
    print(f"⏱ Durée totale : {total_time/60:.2f} minutes")
    print(f"✅ Chapitres traduits avec succès : {completed_count}")
    print(f"❌ Échecs : {errors_count}")
    print(f"📊 Tokens consommés : Prompt: {total_tokens_spent['prompt_tokens']:,} | Completion: {total_tokens_spent['completion_tokens']:,} | Total: {total_tokens_spent['total_tokens']:,}")
    
    # Calcul coût
    cost_usd = (total_tokens_spent['prompt_tokens'] / 1_000_000) * 0.075 + (total_tokens_spent['completion_tokens'] / 1_000_000) * 0.30
    print(f"💰 Coût total estimé : ~{cost_usd:.4f} $ USD")
    print(f"📁 Livres exportés dans data/commentaires/tgc_francais/livres/ : {export_count}")
    print("=" * 80)

    # Synchroniser vers SQLite master
    sync_sqlite_master()

if __name__ == "__main__":
    main()
