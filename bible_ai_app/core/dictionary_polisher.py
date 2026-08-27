import os
import json
import re
import time
import requests
import logging
from threading import Lock

logger = logging.getLogger(__name__)

POLISH_SYSTEM_PROMPT = """Tu es un éminent professeur d'exégèse biblique, philologue et éditeur scientifique spécialisé dans les encyclopédies et dictionnaires bibliques (notamment le Dictionnaire de la Bible de Fulcran Vigouroux et de Dom Calmet).
Ton rôle est de restaurer, moderniser, restructurer et sublimer une notice de dictionnaire extraite d'un scan ancien OCRisé du XIXe/début XXe siècle.

Règles impératives de restauration :
1. Modernisation du Français et Fluidité :
   - Rédige dans un français moderne, impeccable, naturel et agréable à lire pour un lecteur d'aujourd'hui (orthographe moderne, ponctuation soignée, accents complets).
   - Corrige tous les archaïsmes d'imprimerie et coquilles OCR (ex: 'ne a' -> 'né à', 'philosophic' -> 'philosophie', 'public' -> 'publié', 'II entra' -> 'Il entra', 'enfans' -> 'enfants', 'leltre' -> 'lettre', 'd'avec' -> 'de').
   - Supprime les résidus parasites de scan ou de reliure d'époque (ex: '44 Bf', numéros de pagination ou signatures de cahiers isolés en fin ou milieu de texte).

2. Développement et Clarté des Abréviations :
   - Développe ou rends parfaitement explicites et intelligibles les abréviations cryptiques du XIXe siècle pour le lecteur moderne :
     • 't.' -> 'tome', 'vol.' -> 'volume', 'col.' -> 'colonne', 'p.' -> 'page', 'ch.' ou 'chap.' -> 'chapitre', 'v.' -> 'verset'.
     • 'in-4°' -> 'in-quarto (in-4°)', 'in-8°' -> 'in-octavo (in-8°)', 'in-fol.' -> 'in-folio'.
     • 'Sept.' -> 'Septante', 'Vulg.' -> 'Vulgate', 'Targ.' -> 'Targum', 'Pesh.' -> 'Peshitta'.
     • 'ms.', 'mss.' -> 'manuscrit', 'manuscrits'.
     • 'c.-à-d.' -> 'c'est-à-dire'.
     • 'op. cit.' -> 'ouvrage cité', 'ib.' ou 'ibid.' -> 'au même endroit (*ibid.*)'.
   - Harmonise les références bibliques avec le nom du livre canonique et les chapitres/versets clairs (*Gen.*, I, 1 ; *Apoc.*, IX, 11).

3. Structure et Lisibilité :
   - Formate la notice en Markdown soigné et aéré.
   - S'il y a plusieurs acceptions ou sens numérotés (1., 2., 3., etc.), crée pour chacun un paragraphe distinct avec un sous-titre clair et en gras (ex: **1. Éden (Personnage / Lévite)**, **2. Éden (Jardin d'Éden / Paradis terrestre)**).
   - Utilise des puces pour détacher les arguments et détails biographiques, géographiques ou philologiques.

4. Langues Anciennes & Philologie :
   - Restitue avec exactitude les termes originaux en hébreu biblique avec translittération (ex: עֵדֶן / ‘Ēḏen) et en grec biblique/Septante (ex: Ἐδέμ, τρυφή / Truphê) lorsque l'OCR a produit du bruit.
   - Mets en *italique* les citations latines et titres d'ouvrages (*Commentarius in Scripturam Sacram*, *Keilinschriften*, etc.).

5. Renvois et Références Croisées (Voir aussi) :
   - Pour tous les renvois vers d'autres articles du dictionnaire (ex: 'Voir : BETH', 'Voir aussi : TORCHE', 'Voir : CHÊNE (tome II, colonne 654)'), formate clairement sous la forme `*Voir* : **NOM_ARTICLE**` ou `*Voir aussi* : **NOM_ARTICLE** (tome X, colonne Y)` sans inclure les tomes ou parenthèses dans le nom en gras.
   - Ne termine JAMAIS une phrase introductive par une virgule orpheline avant un renvoi `*Voir* :` ; termine toujours la phrase introductive par un point `.` ou deux-points `:`.
   - Ne laisse JAMAIS de ligne orpheline `*Voir aussi* :` vide.

6. Intégrité et Fidélité absolue :
   - N'invente JAMAIS de faits ou de sections fictives non documentées.
   - Conserve rigoureusement toute la substance exégétique, historique, biographique, géographique et théologique de l'auteur d'origine.
   - Ne laisse AUCUNE section ou puce vide ou tronquée.
   - Rends directement le texte restauré en Markdown prêt à l'affichage, sans préambule ni méta-commentaires.

7. Illustrations et Gravures :
   - Si la notice originale mentionne une figure ou une illustration (ex: '3. — Cad. D\'après une peinture de Pompéi.', 'Illustration : ...'), préserve cette mention sous la forme `*Illustration : Description de la gravure.*` pour que l'application charge automatiquement la gravure correspondante."""


AVAILABLE_POLISH_MODELS = [
    # Infomaniak Swiss AI (Recommandé par défaut)
    ("mistralai/Mistral-Small-4-119B-2603", "Mistral Small 4 119B (Infomaniak - Recommandé)"),
    ("mistralai/Ministral-3-14B-Instruct-2512", "Ministral 3 14B (Infomaniak)"),
    ("swiss-ai/Apertus-v1.5-70B", "Swiss AI Apertus 1.5 70B (Infomaniak)"),
    ("google/gemma-4-31B-it", "Gemma 4 31B (Infomaniak)"),
    ("moonshotai/Kimi-K2.6", "Kimi K2.6 (Infomaniak)"),
    ("nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B-FP8", "Nemotron 3 Nano 30B (Infomaniak)"),
    ("Qwen/Qwen3.5-122B-A10B-FP8", "Qwen 3.5 122B (Infomaniak)"),
    ("Qwen/Qwen3.5-397B-A17B-FP8", "Qwen 3.5 397B (Infomaniak)"),

    # Google Gemini
    ("gemini-2.5-flash", "Gemini 2.5 Flash (Google)"),
    ("gemini-2.5-flash-lite", "Gemini 2.5 Flash-Lite (Google)"),
    ("gemini-3.7-flash", "Gemini 3.7 Flash (Google)"),
    ("gemini-3.5-flash", "Gemini 3.5 Flash (Google)"),
    ("gemini-3.5-flash-lite", "Gemini 3.5 Flash-Lite (Google)"),
    
    # Mistral AI
    ("mistral-small-latest", "Mistral Small (Mistral AI)"),
    ("mistral-large-latest", "Mistral Large (Mistral AI)"),
    ("open-mistral-nemo", "Mistral Nemo (Mistral AI)"),
    ("codestral-latest", "Codestral (Mistral AI)")
]

class DictionaryPolisher:
    _cache = None
    _save_lock = Lock()
    
    @classmethod
    def get_cache_path(cls):
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        return os.path.join(base_dir, "data", "dictionaries", "polished_cache.json")

    @classmethod
    def load_cache(cls):
        if cls._cache is not None:
            return cls._cache
        c_path = cls.get_cache_path()
        if os.path.exists(c_path):
            try:
                with open(c_path, "r", encoding="utf-8") as f:
                    cls._cache = json.load(f)
                    return cls._cache
            except Exception as e:
                logger.error(f"Erreur chargement polished_cache.json : {e}")
        cls._cache = {}
        return cls._cache

    @classmethod
    def save_cache(cls):
        if cls._cache is None:
            return
        with cls._save_lock:
            c_path = cls.get_cache_path()
            os.makedirs(os.path.dirname(c_path), exist_ok=True)
            tmp_path = c_path + ".tmp"
            try:
                with open(tmp_path, "w", encoding="utf-8") as f:
                    json.dump(cls._cache, f, ensure_ascii=False, indent=2)
                if os.path.exists(c_path):
                    os.replace(tmp_path, c_path)
                else:
                    os.rename(tmp_path, c_path)
            except Exception as e:
                logger.error(f"Erreur sauvegarde polished_cache.json : {e}")

    @classmethod
    def get_cache_key(cls, dict_id, slug_or_title):
        clean_key = re.sub(r'\s+', ' ', str(slug_or_title).strip().lower())
        return f"{dict_id}:{clean_key}"

    @classmethod
    def get_polished_entry(cls, dict_id, slug_or_title):
        """Récupère l'article restauré depuis la BDD / cache local si existant."""
        cache = cls.load_cache()
        key = cls.get_cache_key(dict_id, slug_or_title)
        return cache.get(key)

    @classmethod
    def set_polished_entry(cls, dict_id, slug_or_title, title, polished_text, model, slug=None):
        """Enregistre un article poli dans la base de données locale permanente."""
        cache = cls.load_cache()
        entry_data = {
            "title": title or slug_or_title,
            "text": polished_text,
            "model": model,
            "dict_id": dict_id,
            "slug": slug or slug_or_title
        }
        
        # Enregistrer sous plusieurs clés pour un accès infaillible (titre brut, titre avec accents, slug normalisé)
        keys_to_set = [cls.get_cache_key(dict_id, slug_or_title)]
        if title:
            keys_to_set.append(cls.get_cache_key(dict_id, title))
        if slug:
            keys_to_set.append(cls.get_cache_key(dict_id, slug))
            
        for k in set(keys_to_set):
            cache[k] = entry_data
            
        cls.save_cache()

    @classmethod
    def _clean_markdown_fences(cls, text):
        if not text:
            return ""
        cleaned = text.strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```(?:markdown|md)?\s*\n?", "", cleaned, flags=re.IGNORECASE)
            cleaned = re.sub(r"\n?```\s*$", "", cleaned)
        # Nettoyage des phrases conversationnelles en début de réponse
        cleaned = re.sub(r"^[\s\n]*(?:Voici (?:la notice|le texte|la version|l['’]article|ce texte)[^\n]*|Ci-dessous[^\n]*|Notice restaurée[^\n]*)\s*\n+", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"^[\s\n]*(?:[-*_—–]{3,}\s*\n+)+", "", cleaned)
        return cleaned.strip()

    @classmethod
    def split_text_into_chunks(cls, text, max_chars=12000):
        """Découpe un texte trop volumineux en morceaux logiques strictement inférieurs à max_chars."""
        if len(text) <= max_chars:
            return [text]
            
        def _slice_huge_string(s, limit):
            if len(s) <= limit:
                return [s]
            sentences = re.split(r'(?<=[.!?])\s+', s)
            out = []
            cur = []
            cur_l = 0
            for sent in sentences:
                if cur_l + len(sent) + 1 > limit and cur:
                    out.append(" ".join(cur))
                    cur = [sent]
                    cur_l = len(sent)
                else:
                    cur.append(sent)
                    cur_l += len(sent) + 1
            if cur:
                out.append(" ".join(cur))
                
            final_out = []
            for block in out:
                if len(block) <= limit:
                    final_out.append(block)
                else:
                    words = block.split(" ")
                    w_cur = []
                    w_len = 0
                    for w in words:
                        if w_len + len(w) + 1 > limit and w_cur:
                            final_out.append(" ".join(w_cur))
                            w_cur = [w]
                            w_len = len(w)
                        else:
                            w_cur.append(w)
                            w_len += len(w) + 1
                    if w_cur:
                        final_out.append(" ".join(w_cur))
            return final_out

        paragraphs = text.split("\n\n")
        sub_parts = []
        for p in paragraphs:
            if len(p) <= max_chars:
                sub_parts.append(p)
            else:
                lines = p.split("\n")
                cur_l = []
                cur_len = 0
                for line in lines:
                    if len(line) > max_chars:
                        if cur_l:
                            sub_parts.append("\n".join(cur_l))
                            cur_l = []
                            cur_len = 0
                        sliced = _slice_huge_string(line, max_chars)
                        sub_parts.extend(sliced)
                    elif cur_len + len(line) + 1 > max_chars and cur_l:
                        sub_parts.append("\n".join(cur_l))
                        cur_l = [line]
                        cur_len = len(line)
                    else:
                        cur_l.append(line)
                        cur_len += len(line) + 1
                if cur_l:
                    sub_parts.append("\n".join(cur_l))
                    
        chunks = []
        cur_chunk = []
        cur_len = 0
        for sp in sub_parts:
            if cur_len + len(sp) + 2 > max_chars and cur_chunk:
                chunks.append("\n\n".join(cur_chunk))
                cur_chunk = [sp]
                cur_len = len(sp)
            else:
                cur_chunk.append(sp)
                cur_len += len(sp) + 2
                
        if cur_chunk:
            chunks.append("\n\n".join(cur_chunk))
            
        return chunks


    @classmethod
    def polish_article(cls, raw_text, title="", model="gemini-2.5-flash", config=None, api_key=None, return_usage=False, limiter=None):
        """
        Envoie le texte brut au modèle sélectionné (Google Gemini, Mistral AI ou Infomaniak Swiss AI).
        Gère automatiquement le découpage en sections si l'article est long (> 14 000 caractères).
        Retourne (success: bool, result_or_error: str) ou (success, result_or_error, usage_dict) si return_usage=True.
        """
        if not raw_text or len(raw_text.strip()) < 10:
            return (False, "Texte trop court", {}) if return_usage else (False, "Texte trop court")

        # Découpage si > 14 000 caractères pour une génération ultra-rapide et sans risque de timeout
        if len(raw_text) > 14000:
            chunks = cls.split_text_into_chunks(raw_text, max_chars=12000)
            polished_chunks = []
            agg_usage = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
            print(f"\n   📄 [{title}] Grand article ({len(raw_text):,} caractères) découpé en {len(chunks)} sections...", flush=True)
            
            for i, chunk in enumerate(chunks, 1):
                sub_title = f"{title} (Partie {i}/{len(chunks)})" if len(chunks) > 1 else title
                chunk_ok = False
                chunk_res = ""
                chunk_usage = {}
                
                for attempt in range(1, 4):
                    if limiter:
                        limiter.acquire()
                    ok, res, u = cls._polish_single_chunk(chunk, title=sub_title, model=model, config=config, api_key=api_key)
                    if ok:
                        chunk_ok = True
                        chunk_res = res
                        chunk_usage = u
                        print(f"      • Section {i}/{len(chunks)} polie avec succès ({len(chunk):,} chars)", flush=True)
                        break
                        
                    err_l = str(res).lower()
                    if "429" in err_l or "quota" in err_l or "rate" in err_l or "exhausted" in err_l:
                        wait_t = 15.0 * attempt
                        if "retry in" in err_l:
                            try:
                                m = re.search(r'retry in ([0-9\.]+)s', err_l)
                                if m:
                                    wait_t = float(m.group(1)) + 2.0
                            except Exception:
                                pass
                        print(f"      ⏳ Pause quota {wait_t:.0f}s sur section {i}/{len(chunks)}...", flush=True)
                        time.sleep(wait_t)
                    else:
                        time.sleep(2 * attempt)

                if not chunk_ok:
                    return (False, f"Erreur partie {i}/{len(chunks)} : {chunk_res}", agg_usage) if return_usage else (False, f"Erreur partie {i}/{len(chunks)} : {chunk_res}")
                polished_chunks.append(chunk_res)
                for k in agg_usage:
                    agg_usage[k] += chunk_usage.get(k, 0)
                    
            combined_text = "\n\n---\n\n".join(polished_chunks)
            return (True, combined_text, agg_usage) if return_usage else (True, combined_text)

        if limiter:
            limiter.acquire()
        ok, res, u = cls._polish_single_chunk(raw_text, title=title, model=model, config=config, api_key=api_key)
        return (ok, res, u) if return_usage else (ok, res)

    @classmethod
    def _polish_single_chunk(cls, raw_text, title="", model="gemini-2.5-flash", config=None, api_key=None):
        if config is None:
            try:
                from core.config import load_config
                config = load_config()
            except Exception:
                config = {}
                
        clean_model = model.strip()
        user_prompt = f"""Notice de dictionnaire à restaurer :
TITRE : {title or 'Article de Dictionnaire'}

TEXTE BRUT ORIGINAL :
\"\"\"
{raw_text}
\"\"\"
"""
        usage_res = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}

        # 1. Fournisseur MISTRAL AI
        if clean_model.startswith("mistral-") or clean_model.startswith("open-mistral-") or clean_model.startswith("codestral-") or clean_model.startswith("pixtral-"):
            m_key = config.get("mistral_api_key") or api_key
            if not m_key:
                return False, "Clé API Mistral non configurée dans les paramètres.", usage_res
                
            url = "https://api.mistral.ai/v1/chat/completions"
            headers = {
                "Authorization": f"Bearer {m_key}",
                "Content-Type": "application/json"
            }
            payload = {
                "model": clean_model,
                "messages": [
                    {"role": "system", "content": POLISH_SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt}
                ],
                "temperature": 0.2,
                "max_tokens": 8192
            }
            try:
                resp = requests.post(url, headers=headers, json=payload, timeout=180)
                if resp.status_code == 200:
                    data = resp.json()
                    content = data["choices"][0]["message"]["content"].strip()
                    raw_u = data.get("usage", {})
                    usage_res = {
                        "prompt_tokens": raw_u.get("prompt_tokens", 0),
                        "completion_tokens": raw_u.get("completion_tokens", 0),
                        "total_tokens": raw_u.get("total_tokens", 0)
                    }
                    return True, cls._clean_markdown_fences(content), usage_res
                return False, f"Erreur API Mistral ({resp.status_code}) : {resp.text}", usage_res
            except requests.exceptions.Timeout:
                return False, "Délai d'attente dépassé pour Mistral AI (timeout).", usage_res
            except Exception as e:
                return False, f"Erreur de communication Mistral : {e}", usage_res

        # 2. Fournisseur INFOMANIAK (Swiss AI)
        elif "/" in clean_model or clean_model.startswith("infomaniak/") or "llama" in clean_model.lower() or "ministral" in clean_model.lower() or "qwen" in clean_model.lower():
            info_token = config.get("infomaniak_token")
            product_id = config.get("infomaniak_product_id") or "251"
            if not info_token:
                return False, "Token Infomaniak non configuré dans les paramètres.", usage_res
                
            clean_info_model = clean_model.replace("infomaniak/", "").strip()
            url = f"https://api.infomaniak.com/2/ai/{product_id}/openai/v1/chat/completions"
            headers = {
                "Authorization": f"Bearer {info_token}",
                "Content-Type": "application/json"
            }
            
            # Calcul adaptatif des max_tokens pour respecter la fenêtre de 80k
            est_prompt_tokens = int(len(user_prompt) / 3.0)
            max_out_tokens = min(8192, max(500, 75000 - est_prompt_tokens))

            payload = {
                "model": clean_info_model,
                "messages": [
                    {"role": "system", "content": POLISH_SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt}
                ],
                "temperature": 0.2,
                "max_tokens": max_out_tokens
            }
            try:
                resp = requests.post(url, headers=headers, json=payload, timeout=180)
                if resp.status_code == 200:
                    data = resp.json()
                    content = data["choices"][0]["message"]["content"].strip()
                    raw_u = data.get("usage", {})
                    usage_res = {
                        "prompt_tokens": raw_u.get("prompt_tokens", 0),
                        "completion_tokens": raw_u.get("completion_tokens", 0),
                        "total_tokens": raw_u.get("total_tokens", 0)
                    }
                    return True, cls._clean_markdown_fences(content), usage_res
                return False, f"Erreur API Infomaniak ({resp.status_code}) : {resp.text}", usage_res
            except requests.exceptions.Timeout:
                return False, "Délai d'attente dépassé pour Infomaniak (timeout).", usage_res
            except Exception as e:
                return False, f"Erreur de communication Infomaniak : {e}", usage_res

        # 3. Fournisseur GOOGLE GEMINI (Par défaut)
        else:
            g_key = config.get("gemini_api_key") or api_key
            if not g_key:
                return False, "Clé API Gemini non configurée dans les paramètres.", usage_res
                
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{clean_model}:generateContent?key={g_key}"
            payload = {
                "systemInstruction": {
                    "parts": [{"text": POLISH_SYSTEM_PROMPT}]
                },
                "contents": [
                    {
                        "role": "user",
                        "parts": [{"text": user_prompt}]
                    }
                ],
                "generationConfig": {
                    "temperature": 0.2,
                    "topP": 0.95,
                    "maxOutputTokens": 8192
                }
            }
            
            try:
                resp = requests.post(url, json=payload, timeout=(10, 45))
                if resp.status_code == 200:
                    data = resp.json()
                    candidates = data.get("candidates", [])
                    raw_u = data.get("usageMetadata", {})
                    usage_res = {
                        "prompt_tokens": raw_u.get("promptTokenCount", 0),
                        "completion_tokens": raw_u.get("candidatesTokenCount", 0),
                        "total_tokens": raw_u.get("totalTokenCount", 0)
                    }
                    if candidates and "content" in candidates[0]:
                        parts = candidates[0]["content"].get("parts", [])
                        if parts and "text" in parts[0]:
                            polished_text = parts[0]["text"].strip()
                            return True, cls._clean_markdown_fences(polished_text), usage_res
                    return False, "Réponse de l'API Gemini vide ou invalide.", usage_res
                elif resp.status_code == 429:
                    return False, f"Erreur API Gemini (429) : {resp.text}", usage_res
                elif resp.status_code == 400:
                    fallback_prompt = f"{POLISH_SYSTEM_PROMPT}\n\n---\n\n{user_prompt}"
                    fallback_payload = {
                        "contents": [{"parts": [{"text": fallback_prompt}]}],
                        "generationConfig": {"temperature": 0.2}
                    }
                    fb_resp = requests.post(url, json=fallback_payload, timeout=(10, 45))
                    if fb_resp.status_code == 200:
                        fb_data = fb_resp.json()
                        fb_candidates = fb_data.get("candidates", [])
                        raw_u = fb_data.get("usageMetadata", {})
                        usage_res = {
                            "prompt_tokens": raw_u.get("promptTokenCount", 0),
                            "completion_tokens": raw_u.get("candidatesTokenCount", 0),
                            "total_tokens": raw_u.get("totalTokenCount", 0)
                        }
                        if fb_candidates and "content" in fb_candidates[0]:
                            polished_text = fb_candidates[0]["content"]["parts"][0]["text"].strip()
                            return True, cls._clean_markdown_fences(polished_text), usage_res
                    return False, f"Erreur API Gemini ({resp.status_code}) : {resp.text}", usage_res
                else:
                    return False, f"Erreur API Gemini ({resp.status_code}) : {resp.text}", usage_res
            except requests.exceptions.Timeout:
                return False, "Délai d'attente dépassé (timeout).", usage_res
            except Exception as e:
                return False, f"Erreur lors du polissage : {e}", usage_res




