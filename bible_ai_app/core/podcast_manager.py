"""
core/podcast_manager.py — Moteur Métier pour le Studio Audio d'Open Shema.

Gère la chaîne complète :
1. Recherche contextuelle RAG multi-sources avec filtrage granulaire (Bibles, Commentaires,
   Dictionnaires, Articles, Notes .md, UPVR, Théologie), réglage de profondeur (tokens),
   reranking sémantique local (BGE-M3) et LLM curateur intermédiaire.
2. Scénarisation IA du script (format Dialogue Hôte/Exégète ou Chronique Solo) via Gemini / Mistral.
3. Synthèse vocale neuronale via Microsoft Edge-TTS (gratuit, sans quota) ou Mistral Voxtral.
4. Concaténation audio avec horodatage millimétrique pour la synchronisation karaoké.
5. Gestionnaire d'historique persistant pour écoute et réutilisation immédiates.
"""

import os
import sys
import re
import json
import base64
import time
import uuid
import asyncio
import logging
import datetime
import threading
import io
import wave
from typing import Dict, List, Any, Optional, Callable, Tuple

logger = logging.getLogger("podcast_manager")

from core.paths import get_user_data_path, resolve_data_path
from core.config import (
    load_config,
    save_config,
    DEFAULT_AUDIO_STUDIO_DIALOGUE_PROMPT,
    DEFAULT_AUDIO_STUDIO_SOLO_PROMPT,
    DEFAULT_EXEGESIS_SYSTEM_PROMPT,
    DEFAULT_HISTORICAL_SYSTEM_PROMPT,
    DEFAULT_SERMON_SYSTEM_PROMPT,
    DEFAULT_IMMERSION_SYSTEM_PROMPT,
    DEFAULT_THEOLOGY_SYSTEM_PROMPT,
    DEFAULT_LEXICAL_SYSTEM_PROMPT
)


# Dossier de stockage des podcasts
def get_podcasts_dir() -> str:
    p_dir = get_user_data_path("podcasts")
    os.makedirs(p_dir, exist_ok=True)
    return p_dir


def get_history_file_path() -> str:
    return os.path.join(get_podcasts_dir(), "history.json")


class PodcastHistory:
    """Gestionnaire d'historique persistant des podcasts et chroniques."""

    @classmethod
    def load_all(cls) -> List[Dict[str, Any]]:
        h_file = get_history_file_path()
        if not os.path.exists(h_file):
            return []
        try:
            with open(h_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list):
                    return data
                return []
        except Exception as e:
            logger.warning("[PodcastHistory] Erreur lecture history.json : %s", e)
            return []

    @classmethod
    def save_all(cls, items: List[Dict[str, Any]]):
        h_file = get_history_file_path()
        try:
            with open(h_file, "w", encoding="utf-8") as f:
                json.dump(items, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error("[PodcastHistory] Erreur sauvegarde history.json : %s", e)

    @classmethod
    def get(cls, podcast_id: str) -> Optional[Dict[str, Any]]:
        items = cls.load_all()
        for it in items:
            if it.get("id") == podcast_id:
                return it
        return None

    @classmethod
    def upsert(cls, podcast_data: Dict[str, Any]):
        items = cls.load_all()
        p_id = podcast_data.get("id")
        found = False
        for idx, it in enumerate(items):
            if it.get("id") == p_id:
                items[idx] = podcast_data
                found = True
                break
        if not found:
            items.insert(0, podcast_data)
        cls.save_all(items)

    @classmethod
    def delete(cls, podcast_id: str) -> bool:
        items = cls.load_all()
        target = None
        new_items = []
        for it in items:
            if it.get("id") == podcast_id:
                target = it
            else:
                new_items.append(it)
        if target:
            # Supprimer le fichier audio MP3 associé s'il existe
            audio_file = target.get("audio_file")
            if audio_file:
                audio_path = os.path.join(get_podcasts_dir(), audio_file)
                if os.path.exists(audio_path):
                    try:
                        os.remove(audio_path)
                    except OSError as e:
                        logger.warning("[PodcastHistory] Erreur suppression MP3 %s : %s", audio_path, e)
            cls.save_all(new_items)
            return True
class GeminiQuotaTracker:
    """Suivi et limitation des quotas Gemini TTS (RPM, RPD, TPM)."""

    QUOTA_FILE = os.path.join(get_podcasts_dir(), "gemini_tts_quota.json")
    _lock = threading.Lock()

    @classmethod
    def _load_data(cls) -> dict:
        try:
            if os.path.exists(cls.QUOTA_FILE):
                with open(cls.QUOTA_FILE, "r", encoding="utf-8") as f:
                    return json.load(f)
        except Exception as e:
            logger.warning("[GeminiQuotaTracker] Erreur lecture quota: %s", e)
        return {}

    @classmethod
    def _save_data(cls, data: dict):
        try:
            os.makedirs(os.path.dirname(cls.QUOTA_FILE), exist_ok=True)
            with open(cls.QUOTA_FILE, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            logger.warning("[GeminiQuotaTracker] Erreur sauvegarde quota: %s", e)

    @classmethod
    def get_status(cls, rpm_limit: int = 3, rpd_limit: int = 10, tpm_limit: int = 10000) -> dict:
        with cls._lock:
            data = cls._load_data()
            today = datetime.date.today().isoformat()
            if data.get("date") != today:
                return {
                    "date": today,
                    "requests_today": 0,
                    "tokens_today": 0,
                    "rpd_limit": rpd_limit,
                    "rpm_limit": rpm_limit,
                    "tpm_limit": tpm_limit,
                    "remaining_rpd": rpd_limit if rpd_limit > 0 else 9999
                }
            reqs = int(data.get("requests_today", 0))
            rem = max(0, rpd_limit - reqs) if rpd_limit > 0 else 9999
            return {
                "date": today,
                "requests_today": reqs,
                "tokens_today": int(data.get("tokens_today", 0)),
                "rpd_limit": rpd_limit,
                "rpm_limit": rpm_limit,
                "tpm_limit": tpm_limit,
                "remaining_rpd": rem
            }

    @classmethod
    def check_and_increment(cls, estimated_tokens: int = 0, rpm_limit: int = 3, rpd_limit: int = 10, tpm_limit: int = 10000):
        with cls._lock:
            data = cls._load_data()
            today = datetime.date.today().isoformat()
            if data.get("date") != today:
                data = {
                    "date": today,
                    "requests_today": 0,
                    "tokens_today": 0,
                    "last_request_timestamp": 0.0
                }

            requests_today = int(data.get("requests_today", 0))
            if rpd_limit > 0 and requests_today >= rpd_limit:
                raise RuntimeError(
                    f"Quota quotidien Gemini Flash TTS atteint ({requests_today}/{rpd_limit} requêtes aujourd'hui). "
                    "Repli automatique sur Edge-TTS."
                )

            if rpm_limit > 0:
                last_ts = float(data.get("last_request_timestamp", 0.0))
                min_interval = 60.0 / float(rpm_limit)
                elapsed = time.time() - last_ts
                if elapsed < min_interval:
                    sleep_sec = min_interval - elapsed
                    logger.info("[GeminiQuotaTracker] Régulation RPM Gemini : pause de %.1f secondes...", sleep_sec)
                    time.sleep(sleep_sec)

            data["requests_today"] = requests_today + 1
            data["tokens_today"] = int(data.get("tokens_today", 0)) + estimated_tokens
            data["last_request_timestamp"] = time.time()
            cls._save_data(data)


class PodcastEngine:
    """Moteur central d'orchestration RAG, de scénarisation et de synthèse vocale."""

    EDGE_VOICES = [
        # France
        {"id": "fr-FR-DeniseNeural", "name": "Denise (France - Féminine, claire & vive)", "gender": "Female", "locale": "fr-FR", "region": "France", "role": "host"},
        {"id": "fr-FR-HenriNeural", "name": "Henri (France - Masculine, posé & érudit)", "gender": "Male", "locale": "fr-FR", "region": "France", "role": "scholar"},
        {"id": "fr-FR-VivienneMultilingualNeural", "name": "Vivienne (France - Féminine, naturelle & fluide)", "gender": "Female", "locale": "fr-FR", "region": "France", "role": "host"},
        {"id": "fr-FR-RemyMultilingualNeural", "name": "Rémy (France - Masculine, expressif & chaleureux)", "gender": "Male", "locale": "fr-FR", "region": "France", "role": "scholar"},
        {"id": "fr-FR-EloiseNeural", "name": "Éloïse (France - Féminine, douce & posée)", "gender": "Female", "locale": "fr-FR", "region": "France", "role": "host"},
        # Belgique
        {"id": "fr-BE-CharlineNeural", "name": "Charline (Belgique - Féminine, posée)", "gender": "Female", "locale": "fr-BE", "region": "Belgique", "role": "host"},
        {"id": "fr-BE-GerardNeural", "name": "Gérard (Belgique - Masculine, calme & posé)", "gender": "Male", "locale": "fr-BE", "region": "Belgique", "role": "scholar"},
        # Suisse
        {"id": "fr-CH-ArianeNeural", "name": "Ariane (Suisse - Féminine, posée)", "gender": "Female", "locale": "fr-CH", "region": "Suisse", "role": "host"},
        {"id": "fr-CH-FabriceNeural", "name": "Fabrice (Suisse - Masculine, posé & net)", "gender": "Male", "locale": "fr-CH", "region": "Suisse", "role": "scholar"},
        # Canada
        {"id": "fr-CA-SylvieNeural", "name": "Sylvie (Canada - Féminine, chaleureuse)", "gender": "Female", "locale": "fr-CA", "region": "Canada", "role": "host"},
        {"id": "fr-CA-AntoineNeural", "name": "Antoine (Canada - Masculine, posé)", "gender": "Male", "locale": "fr-CA", "region": "Canada", "role": "scholar"},
        {"id": "fr-CA-JeanNeural", "name": "Jean (Canada - Masculine, dynamique)", "gender": "Male", "locale": "fr-CA", "region": "Canada", "role": "scholar"},
        {"id": "fr-CA-ThierryNeural", "name": "Thierry (Canada - Masculine, expressif)", "gender": "Male", "locale": "fr-CA", "region": "Canada", "role": "scholar"},
    ]

    # Intonations Voxtral disponibles sur compte gratuit Mistral (voix 'Marie' avec variations d'émotion).
    # Ces identifiants sont les "name" retournés par GET /v1/audio/voices.
    # Sur compte gratuit : une seule voix de base (ex: Marie) avec plusieurs intonations.
    # Sur compte payant : l'API retourne des UUIDs supplémentaires (voix personnalisées).
    VOXTRAL_DEFAULT_VOICES = [
        # Intonations disponibles sur compte gratuit (Français)
        {"id": "Marie - Neutral",  "name": "Marie - Neutre (naturelle, posée)",      "gender": "Female", "role": "both",    "category": "Intonations Marie (Français)", "languages": ["fr"]},
        {"id": "Marie - Happy",    "name": "Marie - Joyeuse (chaleureuse, vivante)", "gender": "Female", "role": "host",   "category": "Intonations Marie (Français)", "languages": ["fr"]},
        {"id": "Marie - Excited",  "name": "Marie - Enthousiaste (dynamique)",       "gender": "Female", "role": "host",   "category": "Intonations Marie (Français)", "languages": ["fr"]},
        {"id": "Marie - Curious",  "name": "Marie - Curieuse (interrogative)",       "gender": "Female", "role": "host",   "category": "Intonations Marie (Français)", "languages": ["fr"]},
        {"id": "Marie - Sad",      "name": "Marie - Grave (méditative)",             "gender": "Female", "role": "scholar","category": "Intonations Marie (Français)", "languages": ["fr"]},
        {"id": "Marie - Angry",    "name": "Marie - Ferme (sérieuse)",               "gender": "Female", "role": "scholar","category": "Intonations Marie (Français)", "languages": ["fr"]},
    ]

    # Correspondance intonation Voxtral -> voix Edge-TTS pour le fallback (sans clé API Mistral)
    VOXTRAL_EMOTION_EDGE_MAP = {
        "Marie - Neutral":  "fr-FR-DeniseNeural",
        "Marie - Happy":    "fr-FR-VivienneMultilingualNeural",
        "Marie - Excited":  "fr-FR-DeniseNeural",
        "Marie - Curious":  "fr-FR-VivienneMultilingualNeural",
        "Marie - Sad":      "fr-FR-EloiseNeural",
        "Marie - Angry":    "fr-FR-HenriNeural",
        "Marie - Fearful":  "fr-FR-EloiseNeural",
    }

    VOXTRAL_MODEL = "voxtral-mini-tts-2603"
    VOXTRAL_API_BASE = "https://api.mistral.ai/v1"

    GEMINI_TTS_MODELS = [
        {"id": "gemini-3.1-flash-tts-preview", "name": "Gemini 3.1 Flash TTS (Recommandé, dernière génération)", "recommended": True},
        {"id": "gemini-2.5-flash-preview-tts", "name": "Gemini 2.5 Flash TTS (Ultra-rapide)", "recommended": False},
    ]

    GEMINI_TTS_VOICES = [
        # Voix Recommandées en Français (Timbres optimaux)
        {"id": "Puck",      "name": "Puck (Masculine, engageante & naturelle — Recommandé FR)",       "gender": "Male",   "role": "both",    "category": "Voix Recommandées (Français)", "languages": ["fr"], "recommended_fr": True},
        {"id": "Charon",    "name": "Charon (Masculine, grave, profonde & érudite — Recommandé FR)", "gender": "Male",   "role": "scholar", "category": "Voix Recommandées (Français)", "languages": ["fr"], "recommended_fr": True},
        {"id": "Aoede",     "name": "Aoede (Féminine, posée, chaleureuse & fluide — Recommandée FR)", "gender": "Female", "role": "host",    "category": "Voix Recommandées (Français)", "languages": ["fr"], "recommended_fr": True},
        {"id": "Kore",      "name": "Kore (Féminine, claire, douce & expressive — Recommandée FR)",    "gender": "Female", "role": "host",    "category": "Voix Recommandées (Français)", "languages": ["fr"], "recommended_fr": True},
        {"id": "Fenrir",    "name": "Fenrir (Masculine, dynamique, chaleureuse & articulée — FR)",   "gender": "Male",   "role": "scholar", "category": "Voix Recommandées (Français)", "languages": ["fr"], "recommended_fr": True},

        # Catalogue Complet des 30 Voix Google (Multilingue / Français natif)
        {"id": "Leda",      "name": "Leda (Féminine, douce & mélodieuse)",        "gender": "Female", "role": "host",    "category": "Catalogue Complet Google (30 voix)", "languages": ["fr"]},
        {"id": "Orpheus",   "name": "Orpheus (Masculine, résonnante & solennelle)", "gender": "Male",   "role": "scholar", "category": "Catalogue Complet Google (30 voix)", "languages": ["fr"]},
        {"id": "Zephyr",    "name": "Zephyr (Masculine, claire & fluide)",         "gender": "Male",   "role": "both",    "category": "Catalogue Complet Google (30 voix)", "languages": ["fr"]},
        {"id": "Callisto",  "name": "Callisto (Féminine, calme & posée)",          "gender": "Female", "role": "host",    "category": "Catalogue Complet Google (30 voix)", "languages": ["fr"]},
        {"id": "Europa",    "name": "Europa (Féminine, vive & articulée)",          "gender": "Female", "role": "host",    "category": "Catalogue Complet Google (30 voix)", "languages": ["fr"]},
        {"id": "Ganymede",  "name": "Ganymede (Masculine, ferme & posée)",         "gender": "Male",   "role": "scholar", "category": "Catalogue Complet Google (30 voix)", "languages": ["fr"]},
        {"id": "Io",        "name": "Io (Féminine, vive & expressive)",            "gender": "Female", "role": "host",    "category": "Catalogue Complet Google (30 voix)", "languages": ["fr"]},
        {"id": "Titan",     "name": "Titan (Masculine, puissante & affirmée)",      "gender": "Male",   "role": "scholar", "category": "Catalogue Complet Google (30 voix)", "languages": ["fr"]},
        {"id": "Oberon",    "name": "Oberon (Masculine, chaleureuse & posée)",     "gender": "Male",   "role": "scholar", "category": "Catalogue Complet Google (30 voix)", "languages": ["fr"]},
        {"id": "Miranda",   "name": "Miranda (Féminine, expressive & douce)",       "gender": "Female", "role": "host",    "category": "Catalogue Complet Google (30 voix)", "languages": ["fr"]},
        {"id": "Ariel",     "name": "Ariel (Féminine, lumineuse & aérienne)",      "gender": "Female", "role": "host",    "category": "Catalogue Complet Google (30 voix)", "languages": ["fr"]},
        {"id": "Umbriel",   "name": "Umbriel (Masculine, posée & méditative)",     "gender": "Male",   "role": "scholar", "category": "Catalogue Complet Google (30 voix)", "languages": ["fr"]},
        {"id": "Titania",   "name": "Titania (Féminine, majestueuse & claire)",    "gender": "Female", "role": "host",    "category": "Catalogue Complet Google (30 voix)", "languages": ["fr"]},
        {"id": "Cupid",     "name": "Cupid (Féminine, enjouée & légère)",          "gender": "Female", "role": "host",    "category": "Catalogue Complet Google (30 voix)", "languages": ["fr"]},
        {"id": "Enceladus", "name": "Enceladus (Masculine, intime & posée)",       "gender": "Male",   "role": "scholar", "category": "Catalogue Complet Google (30 voix)", "languages": ["fr"]},
        {"id": "Dione",     "name": "Dione (Féminine, claire & sereine)",          "gender": "Female", "role": "host",    "category": "Catalogue Complet Google (30 voix)", "languages": ["fr"]},
        {"id": "Rhea",      "name": "Rhea (Féminine, douce & harmonieuse)",        "gender": "Female", "role": "host",    "category": "Catalogue Complet Google (30 voix)", "languages": ["fr"]},
        {"id": "Iapetus",   "name": "Iapetus (Masculine, sobre & profonde)",       "gender": "Male",   "role": "scholar", "category": "Catalogue Complet Google (30 voix)", "languages": ["fr"]},
        {"id": "Hyperion",  "name": "Hyperion (Masculine, dynamique & assurée)",   "gender": "Male",   "role": "scholar", "category": "Catalogue Complet Google (30 voix)", "languages": ["fr"]},
        {"id": "Phoebe",    "name": "Phoebe (Féminine, posée & équilibrée)",       "gender": "Female", "role": "host",    "category": "Catalogue Complet Google (30 voix)", "languages": ["fr"]},
        {"id": "Proteus",   "name": "Proteus (Masculine, articulée & précise)",    "gender": "Male",   "role": "scholar", "category": "Catalogue Complet Google (30 voix)", "languages": ["fr"]},
        {"id": "Triton",    "name": "Triton (Masculine, sobre & affirmée)",        "gender": "Male",   "role": "scholar", "category": "Catalogue Complet Google (30 voix)", "languages": ["fr"]},
        {"id": "Nereid",    "name": "Nereid (Féminine, fluide & discrète)",        "gender": "Female", "role": "host",    "category": "Catalogue Complet Google (30 voix)", "languages": ["fr"]},
        {"id": "Thalassa",  "name": "Thalassa (Féminine, contemplative & douce)",   "gender": "Female", "role": "host",    "category": "Catalogue Complet Google (30 voix)", "languages": ["fr"]},
        {"id": "Naiad",     "name": "Naiad (Féminine, délicate & limpide)",        "gender": "Female", "role": "host",    "category": "Catalogue Complet Google (30 voix)", "languages": ["fr"]},
    ]

    DEPTH_CHAR_LIMITS = {
        0: 1000,  # Éclair (~250 tokens / source)
        1: 2400,  # Équilibré (~600 tokens / source)
        2: 4800,  # Approfondi (~1200 tokens / source)
        3: 8000,  # Exhaustif (~2000 tokens / source)
    }

    DEPTH_DOC_COUNTS = {
        0: 3,
        1: 5,
        2: 8,
        3: 12
    }

    @classmethod
    def fetch_voxtral_voices(cls, api_key: str) -> list:
        """
        Interroge l'API Mistral pour obtenir la liste des voix disponibles sur le compte.
        Filtre STRICTEMENT pour ne retourner que les voix en français.
        Retourne VOXTRAL_DEFAULT_VOICES si la clé est absente ou si l'appel échoue.
        """
        if not api_key:
            return cls.VOXTRAL_DEFAULT_VOICES
        try:
            import httpx
            url = f"{cls.VOXTRAL_API_BASE}/audio/voices?limit=100"
            headers = {"Authorization": f"Bearer {api_key}"}
            resp = httpx.get(url, headers=headers, timeout=10.0)
            resp.raise_for_status()
            data = resp.json()
            items = data.get("items", data.get("voices", data.get("data", [])))
            if not items:
                return cls.VOXTRAL_DEFAULT_VOICES

            french_marie_map = {
                "marie - happy": "Marie - Joyeuse (chaleureuse, vivante)",
                "marie - excited": "Marie - Enthousiaste (dynamique)",
                "marie - neutral": "Marie - Neutre (naturelle, posée)",
                "marie - curious": "Marie - Curieuse (interrogative)",
                "marie - sad": "Marie - Grave (méditative)",
                "marie - angry": "Marie - Ferme (sérieuse)",
            }

            voices = []
            for item in items:
                # Filtrage strict de la langue : uniquement le français
                langs = item.get("languages") or []
                if isinstance(langs, str):
                    langs = [langs]
                if item.get("language"):
                    langs.append(item.get("language"))

                is_fr = False
                for l in langs:
                    l_norm = str(l).strip().lower().replace("-", "_")
                    if l_norm == "fr" or l_norm.startswith("fr_") or "french" in l_norm or "francais" in l_norm or "français" in l_norm:
                        is_fr = True
                        break

                v_id = item.get("id", "")
                v_name = item.get("name", v_id)

                if not is_fr:
                    v_name_low = str(v_name).lower()
                    v_id_low = str(v_id).lower()
                    if "marie" in v_name_low or "marie" in v_id_low or "français" in v_name_low or "francais" in v_name_low:
                        is_fr = True

                if not is_fr:
                    continue

                # C'est une voix française
                v_name_key = str(v_name).strip().lower()
                display_name = french_marie_map.get(v_name_key, v_name)
                category = "Intonations Marie (Français)" if "marie" in v_name_key else "Voix personnalisées (Mistral)"
                role = "host" if any(k in v_name_key for k in ("happy", "joyeuse", "excited", "enthousiaste", "curious", "curieuse")) else "scholar" if any(k in v_name_key for k in ("sad", "grave", "angry", "ferme", "fearful")) else "both"

                voices.append({
                    "id": v_id,
                    "name": display_name,
                    "languages": ["fr"],
                    "gender": "Female" if "marie" in v_name_key else "Unknown",
                    "role": role,
                    "category": category
                })

            if not voices:
                return cls.VOXTRAL_DEFAULT_VOICES

            logger.info("[PodcastEngine] %d voix Voxtral françaises chargées depuis l'API Mistral.", len(voices))
            return voices
        except Exception as e_fetch:
            logger.debug("[PodcastEngine] Impossible de charger les voix Mistral : %s", e_fetch)
            return cls.VOXTRAL_DEFAULT_VOICES

    @classmethod
    def get_available_voices(cls, cfg: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Retourne le catalogue complet des voix Edge-TTS, Mistral Voxtral et Google Gemini TTS."""
        voxtral_voices = cls.VOXTRAL_DEFAULT_VOICES
        rpm = 3
        rpd = 10
        tpm = 10000
        if cfg:
            api_key = cfg.get("mistral_api_key", "")
            if api_key:
                voxtral_voices = cls.fetch_voxtral_voices(api_key)
            rpm = int(cfg.get("gemini_tts_rpm_limit", 3))
            rpd = int(cfg.get("gemini_tts_rpd_limit", 10))
            tpm = int(cfg.get("gemini_tts_tpm_limit", 10000))
        quota_status = GeminiQuotaTracker.get_status(rpm_limit=rpm, rpd_limit=rpd, tpm_limit=tpm)
        return {
            "voices": cls.EDGE_VOICES,
            "edge_tts": cls.EDGE_VOICES,
            "voxtral": voxtral_voices,
            "gemini_tts": cls.GEMINI_TTS_VOICES,
            "gemini_models": cls.GEMINI_TTS_MODELS,
            "gemini_quota": quota_status
        }

    @classmethod
    def build_context(
        cls,
        subject_or_ref: str,
        sources_options: Optional[Dict[str, Any]] = None,
        config: Optional[Dict[str, Any]] = None,
        db_instance: Any = None,
        progress_callback: Optional[Callable[[int, str], None]] = None
    ) -> str:
        """
        Collecte et extrait le corpus documentaire approfondi selon les options configurées :
        - Détection et parsing précis du passage biblique
        - Extraction des versets bibliques de référence
        - Extraction des commentaires exégétiques historiques et contemporains
        - Recherche sémantique dans les ouvrages de théologie et traités
        - Extraction des dictionnaires bibliques et lexique Strong
        - Recherche des articles contemporains et blogs
        - Extraction des réflexions pastorales (UPVR / Florent Varak)
        - Notes personnelles de l'utilisateur (.md)
        - Recherche vectorielle dense ChromaDB
        - Reranking sémantique local (Cross-Encoder BGE-M3)
        - Curation intermédiaire LLM
        - Profil herméneutique (« Mon Église »)
        """
        cfg = config or load_config()
        opts = sources_options or {}

        active_sources = opts.get("sources", {
            "bibles": True,
            "commentaries": True,
            "dictionaries": True,
            "articles": True,
            "notes": True,
            "upvr": True,
            "theology": True
        })

        depth_level = int(opts.get("context_depth", cfg.get("audio_studio_context_depth", 1)))
        max_chars_per_doc = cls.DEPTH_CHAR_LIMITS.get(depth_level, 2400)
        top_k_docs = cls.DEPTH_DOC_COUNTS.get(depth_level, 5)

        enable_rerank = opts.get("enable_reranking", cfg.get("audio_studio_enable_rerank", True))
        enable_curator = opts.get("enable_curator", cfg.get("audio_studio_enable_curator", False))
        include_profile = opts.get("include_profile", cfg.get("audio_studio_include_profile", True))

        if progress_callback:
            progress_callback(12, "Recherche documentaire multi-sources dans votre bibliothèque...")

        # 1. Parsing du passage biblique potentiel
        parsed_bounds = None
        try:
            from core.passage_study_manager import PassageStudyManager
            parsed_bounds = PassageStudyManager.parse_passage_bounds(subject_or_ref)
        except Exception:
            pass

        if not parsed_bounds:
            try:
                from core.reference_parser import parse_smart_book_input
                parsed = parse_smart_book_input(subject_or_ref)
                if parsed and parsed.get("book"):
                    b_code = parsed.get("code") or parsed.get("book")
                    ch = int(parsed.get("chapter") or 1)
                    v_start = int(parsed.get("verse_start") or parsed.get("verse") or 1)
                    v_end = int(parsed.get("verse_end") or v_start)
                    parsed_bounds = {
                        "book_code": b_code,
                        "french_book": parsed.get("book", b_code),
                        "start_ch": ch,
                        "start_v": v_start,
                        "end_ch": ch,
                        "end_v": v_end
                    }
            except Exception:
                pass

        # 2. Extraction des mots-clés thématiques
        stop_words_fr = {
            "quel", "quelle", "quels", "quelles", "etait", "étaient", "était", "etaient", "etre", "être",
            "dans", "avec", "pour", "selon", "entre", "cette", "cet", "ces", "leurs", "leur", "notre", "nos",
            "votre", "vos", "mon", "ton", "son", "sa", "ses", "comme", "tout", "tous", "toute", "toutes",
            "comment", "pourquoi", "vision", "texte", "temps", "epoque", "époque", "cadre", "plus", "aussi",
            "faire", "fais", "fait", "avoir", "sujet", "point", "points", "dessus", "dessous", "alors", "ainsi",
            "bible", "verset", "versets", "chapitre", "chapitres", "livre", "livres", "sur", "sous", "par",
            "une", "des", "les", "aux", "est", "sont", "podcast", "emission", "émission"
        }
        clean_subject = subject_or_ref
        if parsed_bounds and parsed_bounds.get("raw_reference"):
            clean_subject = clean_subject.replace(parsed_bounds["raw_reference"], " ")

        parentheses_matches = re.findall(r'[\"«\((.*?)\)»\"]', clean_subject)
        priority_terms = [m.strip() for m in parentheses_matches if len(m.strip()) > 2 and m.strip().lower() not in stop_words_fr]
        general_words = [w for w in re.findall(r'[a-zA-ZÀ-ÿ]{3,}', clean_subject) if w.lower() not in stop_words_fr]
        keywords = list(dict.fromkeys(priority_terms + general_words))

        raw_chunks: List[Dict[str, Any]] = []
        scripture_sections: List[str] = []

        # A. Passage biblique de référence
        if active_sources.get("bibles", True) and parsed_bounds:
            if progress_callback:
                progress_callback(14, "Lecture du passage biblique de référence...")
            try:
                from core.bible_json_loader import BibleJsonLoader
                b_code = parsed_bounds["book_code"]
                ch = parsed_bounds["start_ch"]
                s_v = parsed_bounds["start_v"]
                e_v = min(parsed_bounds.get("end_v", s_v), 60)
                version = cfg.get("primary_bible", "LSG")
                book = BibleJsonLoader.load_book(version, b_code)
                if book and "chapters" in book and str(ch) in book["chapters"]:
                    ch_verses = book["chapters"][str(ch)]
                    v_lines = []
                    for vn in range(s_v, e_v + 1):
                        txt = ch_verses.get(str(vn))
                        if txt:
                            clean_t = re.sub(r'<[^>]+>', '', txt).strip()
                            v_lines.append(f"{b_code} {ch}:{vn} — {clean_t}")
                    if v_lines:
                        scripture_sections.append(f"=== PASSAGE BIBLIQUE D'ÉTUDE ({version} — {parsed_bounds.get('french_book', b_code)} {ch}:{s_v}–{e_v}) ===\n" + "\n".join(v_lines))
            except Exception as e_bib:
                logger.debug("[build_context] Erreur extraction biblique : %s", e_bib)

        # B. Commentaires bibliques
        if active_sources.get("commentaries", True) and parsed_bounds:
            if progress_callback:
                progress_callback(18, "Consultation des commentaires exégétiques...")
            try:
                from core.commentary_loader import CommentaryLoader
                b_code = parsed_bounds["book_code"]
                ch = parsed_bounds["start_ch"]
                s_v = parsed_bounds["start_v"]
                e_v = min(parsed_bounds.get("end_v", s_v), 60)
                comm_res = CommentaryLoader.get_all_comments_for_verse_range(b_code, ch, s_v, e_v)
                docs = comm_res.get("documents", [])
                metas = comm_res.get("metadatas", [])
                for i, doc in enumerate(docs[:top_k_docs * 3]):
                    meta = metas[i] if i < len(metas) else {}
                    author = meta.get("name") or meta.get("author") or "Commentaire"
                    ref = meta.get("reference") or f"{b_code} {ch}"
                    raw_chunks.append({
                        "id": f"comm_{author}_{i}",
                        "type": "Commentaire",
                        "name": f"{author} ({ref})",
                        "text": f"### Commentaire [{author}] sur {ref} :\n{doc}",
                        "metadata": {"type": "Commentaire", "name": author, "ref": ref}
                    })
            except Exception as e_comm:
                logger.debug("[build_context] Erreur extraction commentaires : %s", e_comm)

        # C. Ouvrages de théologie & traités
        if active_sources.get("theology", True):
            if progress_callback:
                progress_callback(23, "Recherche dans les ouvrages de théologie...")
            try:
                from core.theology_reader_manager import TheologyReaderManager
                theo_seen = set()
                search_terms = keywords[:5] if keywords else [subject_or_ref]
                for term in search_terms:
                    t_res = TheologyReaderManager.search_theology_books(term, limit=3)
                    if t_res:
                        for tr in t_res[:2]:
                            b_title = tr.get("book_title") or tr.get("title") or "Ouvrage Théologique"
                            t_key = f"{b_title}:{term}".lower()
                            if t_key not in theo_seen:
                                theo_seen.add(t_key)
                                snippet = tr.get("snippet") or tr.get("text") or ""
                                if snippet:
                                    raw_chunks.append({
                                        "id": f"theo_{b_title}_{term}",
                                        "type": "Théologie",
                                        "name": b_title,
                                        "text": f"### Ouvrage de Théologie [{b_title}] (sur '{term}') :\n{snippet}",
                                        "metadata": {"type": "Théologie", "name": b_title, "author": tr.get("author", "")}
                                    })
            except Exception as e_theo:
                logger.debug("[build_context] Erreur extraction théologie : %s", e_theo)

        # D. Dictionnaires bibliques & Lexiques Strong
        if active_sources.get("dictionaries", True):
            if progress_callback:
                progress_callback(29, "Consultation des dictionnaires bibliques & lexiques Strong...")
            try:
                from core.dictionary_manager import DictionaryManager
                dict_seen = set()
                search_terms = keywords[:6] if keywords else [subject_or_ref]
                for term in search_terms:
                    d_res = DictionaryManager.lookup(term)
                    if (not d_res or not d_res.get("matches")) and term.endswith("s") and len(term) > 4:
                        d_res = DictionaryManager.lookup(term[:-1])
                    if d_res and d_res.get("matches"):
                        for m in d_res["matches"][:2]:
                            dict_name = m.get("dict_name", "Dictionnaire")
                            art_title = m.get("title", term)
                            d_key = f"{dict_name}:{art_title}".lower()
                            if d_key not in dict_seen:
                                dict_seen.add(d_key)
                                snippet = m.get("preview") or m.get("full_text") or ""
                                if snippet:
                                    raw_chunks.append({
                                        "id": f"dict_{term}_{dict_name}",
                                        "type": "Dictionnaire",
                                        "name": f"{dict_name} ({art_title})",
                                        "text": f"### Entrée de Dictionnaire [{dict_name} : {art_title}] :\n{snippet}",
                                        "metadata": {"type": "Dictionnaire", "name": dict_name}
                                    })
            except Exception as e_dict:
                logger.debug("[build_context] Erreur extraction dictionnaires : %s", e_dict)

            # Lexique Strong pour le passage
            if parsed_bounds:
                try:
                    from core.strong_helper import StrongLexiconHelper
                    b_code = parsed_bounds["book_code"]
                    ch = parsed_bounds["start_ch"]
                    v = parsed_bounds["start_v"]
                    strong_entry = StrongLexiconHelper.get_verse_lexicon_block(b_code, ch, v)
                    if strong_entry and isinstance(strong_entry, dict) and strong_entry.get("text"):
                        raw_chunks.append({
                            "id": f"strong_{b_code}_{ch}_{v}",
                            "type": "Dictionnaire",
                            "name": f"Lexique Strong ({b_code} {ch}:{v})",
                            "text": f"### Analyse Lexicale & Racines ({b_code} {ch}:{v}) :\n{strong_entry.get('text')}",
                            "metadata": {"type": "Dictionnaire", "name": "Strong Lexicon"}
                        })
                except Exception as e_str:
                    logger.debug("[build_context] Erreur Strong : %s", e_str)

        # E. Articles contemporains & Blogs
        if active_sources.get("articles", True):
            if progress_callback:
                progress_callback(33, "Recherche dans les articles contemporains...")
            try:
                from core.articles_manager import ArticlesManager
                art_mgr = ArticlesManager.get_instance()
                art_seen = set()
                if parsed_bounds:
                    b_code = parsed_bounds["book_code"]
                    ch = parsed_bounds["start_ch"]
                    passage_articles = art_mgr.get_articles_for_passage(b_code, ch, limit=3)
                    for pa in passage_articles:
                        art_id = pa.get("id")
                        if art_id and art_id not in art_seen:
                            art_seen.add(art_id)
                            content = pa.get("content_markdown") or pa.get("summary") or ""
                            src_name = pa.get("source_name") or "Article"
                            title = pa.get("title") or "Article"
                            raw_chunks.append({
                                "id": f"article_{art_id}",
                                "type": "Article",
                                "name": f"{src_name} ({title})",
                                "text": f"### Article contemporain [{src_name} : {title}] :\n{content}",
                                "metadata": {"type": "Article", "name": f"{src_name} ({title})"}
                            })
            except Exception as e_art:
                logger.debug("[build_context] Erreur extraction articles : %s", e_art)

        # F. Réflexions Pastorales (UPVR - Florent Varak)
        if active_sources.get("upvr", True) and cfg.get("include_upvr_in_ai", True):
            if progress_callback:
                progress_callback(37, "Consultation des réflexions pastorales (UPVR)...")
            try:
                from core.upvr_manager import UPVRManager
                upvr_mgr = UPVRManager.get_instance()
                if upvr_mgr.is_installed() and parsed_bounds:
                    b_code = parsed_bounds["book_code"]
                    ch = parsed_bounds["start_ch"]
                    v = parsed_bounds["start_v"]
                    pastoral_eps = upvr_mgr.get_episodes_for_passage(b_code, ch, verse=v, limit=3)
                    for pep in pastoral_eps:
                        ep_num = pep.get("episode_number")
                        resume = pep.get("resume_analytique") or pep.get("these_centrale") or ""
                        ep_title = pep.get("titre") or f"Épisode #{ep_num}"
                        if resume:
                            raw_chunks.append({
                                "id": f"upvr_{ep_num}",
                                "type": "Pastorale",
                                "name": f"UPVR #{ep_num} ({ep_title})",
                                "text": f"### Réflexion Pastorale [Un pasteur vous répond #{ep_num} : {ep_title}] :\n{resume}",
                                "metadata": {"type": "Pastorale", "name": f"UPVR #{ep_num}"}
                            })
            except Exception as e_upvr:
                logger.debug("[build_context] Erreur extraction UPVR : %s", e_upvr)

        # G. Recherche Vectorielle Dense (ChromaDB / VectorDB)
        if progress_callback:
            progress_callback(40, "Recherche sémantique dense dans toute la bibliothèque (ChromaDB)...")
        try:
            from core.database import VectorDB
            vdb = VectorDB(api_keys=cfg)
            embed_model = cfg.get("embedding_model", "bge_multilingual_gemma2 (Infomaniak)")
            search_res = vdb.search_semantic(
                query=subject_or_ref,
                n_results=top_k_docs * 3,
                embedding_model=embed_model
            )
            v_docs = search_res.get("documents", [[]])[0] if search_res else []
            v_metas = search_res.get("metadatas", [[]])[0] if search_res else []
            v_ids = search_res.get("ids", [[]])[0] if search_res else []
            for idx, doc in enumerate(v_docs):
                meta = v_metas[idx] if idx < len(v_metas) else {}
                raw_id = v_ids[idx] if idx < len(v_ids) else f"vec_{idx}"
                doc_type = (meta.get("type") or meta.get("source_type") or "Ouvrage").lower()

                # Filtrage selon les sources cochées
                is_allowed = True
                if "pastoral" in doc_type and not active_sources.get("upvr", True): is_allowed = False
                elif "article" in doc_type and not active_sources.get("articles", True): is_allowed = False
                elif "commentary" in doc_type and not active_sources.get("commentaries", True): is_allowed = False
                elif "dict" in doc_type and not active_sources.get("dictionaries", True): is_allowed = False
                elif "theology" in doc_type and not active_sources.get("theology", True): is_allowed = False

                if is_allowed:
                    s_name = meta.get("name") or meta.get("title") or meta.get("book") or "Bibliothèque"
                    raw_chunks.append({
                        "id": f"vdb_{raw_id}",
                        "type": "Recherche Vectorielle",
                        "name": s_name,
                        "text": f"### Extrait de [{s_name}] :\n{doc}",
                        "metadata": meta
                    })
        except Exception as e_vdb:
            logger.debug("[build_context] Erreur VectorDB : %s", e_vdb)

        # H. Notes personnelles (.md)
        if active_sources.get("notes", True) and cfg.get("include_notes_in_ai", True):
            if progress_callback:
                progress_callback(43, "Lecture de vos notes personnelles...")
            try:
                from core.notes_manager import NotesManager
                notes_text = NotesManager.build_ai_notes_context(passage_ref=subject_or_ref, question=subject_or_ref, config=cfg)
                if notes_text and notes_text.strip():
                    raw_chunks.append({
                        "id": "user_notes",
                        "type": "Notes",
                        "name": "Notes personnelles (.md)",
                        "text": f"### Notes personnelles de l'utilisateur :\n{notes_text.strip()}",
                        "metadata": {"type": "Notes", "name": "Notes personnelles"}
                    })
            except Exception as e_notes:
                logger.debug("[build_context] Erreur notes : %s", e_notes)

        if progress_callback:
            progress_callback(47, "Évaluation de pertinence croisée (Reranking BGE-M3)...")

        # 3. Dédoublonnage et Reranking sémantique
        dedup_chunks = []
        seen_ids = set()
        seen_snippets = set()
        for chunk in raw_chunks:
            c_id = chunk.get("id")
            snip = (chunk.get("text") or "")[:80].strip().lower()
            if c_id not in seen_ids and snip not in seen_snippets:
                seen_ids.add(c_id)
                seen_snippets.add(snip)
                dedup_chunks.append(chunk)

        selected_chunks = dedup_chunks
        if enable_rerank and len(dedup_chunks) > 1:
            try:
                from core.reranker import LocalReranker
                reranker = LocalReranker.get_instance()
                candidate_chunks = dedup_chunks[:25]
                selected_chunks = reranker.rerank(query=subject_or_ref, documents=candidate_chunks, top_k=top_k_docs * 3)
            except Exception as e_rr:
                logger.info("[build_context] Reranking bypass : %s", e_rr)
                selected_chunks = dedup_chunks[:top_k_docs * 3]
        else:
            selected_chunks = dedup_chunks[:top_k_docs * 3]

        if progress_callback:
            progress_callback(72, "Curation et structuration du corpus documentaire...")

        # 4. Curation intermédiaire si activée
        if enable_curator and selected_chunks:
            try:
                from core.rag_pipeline import RAGPipeline
                rag_pipe = RAGPipeline.get_instance(config=cfg)
                curator_m = cfg.get("curator_model") or cfg.get("rag_curation_model")
                curator_fb = cfg.get("curator_fallback_model") or cfg.get("rag_curation_fallback_model")
                curated = rag_pipe.curate_context(
                    query=subject_or_ref,
                    documents=selected_chunks,
                    curation_model=curator_m,
                    fallback_model=curator_fb
                )
                if curated:
                    selected_chunks = curated
            except Exception as e_cur:
                logger.info("[build_context] Curation bypass : %s", e_cur)

        # 5. Organisation des sections par catégories sourcées
        sections: List[str] = list(scripture_sections)

        by_type: Dict[str, List[str]] = {}
        for chunk in selected_chunks:
            c_type = chunk.get("type", "Document")
            txt = chunk.get("text", "").strip()
            if len(txt) > max_chars_per_doc:
                txt = txt[:max_chars_per_doc] + "..."
            by_type.setdefault(c_type, []).append(txt)

        category_titles = {
            "Commentaire": "=== EXTRAITS DE COMMENTAIRES EXÉGÉTIQUES ===",
            "Théologie": "=== OUVRAGES DE THÉOLOGIE & TRAITÉS ===",
            "Dictionnaire": "=== DICTIONNAIRES BIBLIQUES & LEXIQUES ===",
            "Article": "=== ARTICLES CONTEMPORAINS & BLOGS ===",
            "Pastorale": "=== RÉFLEXIONS PASTORALES (FLORENT VARAK - UPVR) ===",
            "Notes": "=== NOTES PERSONNELLES DE L'UTILISATEUR ===",
            "Recherche Vectorielle": "=== EXTRAITS DOCUMENTAIRES DE LA BIBLIOTHÈQUE ==="
        }

        for c_type, items in by_type.items():
            title = category_titles.get(c_type, f"=== EXTRAITS : {c_type.upper()} ===")
            sections.append(f"{title}\n" + "\n\n".join(items))

        # 6. Passeport Herméneutique (« Mon Église »)
        if include_profile:
            profile_text = cfg.get("theological_profile_prompt", "").strip()
            if profile_text:
                sections.append(f"=== ORIENTATION THÉOLOGIQUE ET HERMÉNEUTIQUE (« MON ÉGLISE ») ===\n{profile_text}\n")

        final_corpus = "\n\n".join(sections).strip()
        logger.info("[PodcastEngine] Corpus RAG consolidé pour '%s' : %d caractères, %d extraits retenus.", subject_or_ref, len(final_corpus), len(selected_chunks))
        return final_corpus

    @classmethod
    def _try_extract_passage_text(cls, query: str, config: Dict[str, Any]) -> str:
        """Tente d'extraire les versets réels si la chaîne est une référence biblique (ex: Romains 5:1-11)."""
        try:
            from core.passage_study_manager import PassageStudyManager
            p = PassageStudyManager.parse_passage_bounds(query)
            if p:
                from core.bible_json_loader import BibleJsonLoader
                b_code = p["book_code"]
                ch = p["start_ch"]
                s_v = p["start_v"]
                e_v = min(p.get("end_v", s_v), 60)
                version = config.get("primary_bible", "LSG")
                book = BibleJsonLoader.load_book(version, b_code)
                if book and "chapters" in book and str(ch) in book["chapters"]:
                    ch_verses = book["chapters"][str(ch)]
                    v_lines = []
                    for vn in range(s_v, e_v + 1):
                        txt = ch_verses.get(str(vn))
                        if txt:
                            clean_t = re.sub(r'<[^>]+>', '', txt).strip()
                            v_lines.append(f"{b_code} {ch}:{vn} — {clean_t}")
                    if v_lines:
                        return "\n".join(v_lines)
        except Exception:
            pass
        return ""

    @classmethod
    def _create_llm_client_for_model(cls, model_name: str, cfg: Dict[str, Any]):
        """Crée un LLMClient adapté au modèle (Gemini, Mistral ou Infomaniak)."""
        from ai.llm_client import LLMClient, resolve_llm_provider
        provider = resolve_llm_provider(model_name)
        if provider == "mistral":
            api_key = cfg.get("mistral_api_key", "")
            pid = None
        elif provider == "infomaniak":
            api_key = cfg.get("infomaniak_token", "")
            pid = cfg.get("infomaniak_product_id", "251")
        else:
            api_key = cfg.get("gemini_api_key", "")
            pid = None

        if not api_key:
            if cfg.get("gemini_api_key"):
                provider = "gemini"
                model_name = "gemini-3.7-flash"
                api_key = cfg.get("gemini_api_key")
            elif cfg.get("mistral_api_key"):
                provider = "mistral"
                model_name = "mistral-small-latest"
                api_key = cfg.get("mistral_api_key")
            elif cfg.get("infomaniak_token"):
                provider = "infomaniak"
                model_name = "mistralai/Ministral-3-14B-Instruct-2512"
                api_key = cfg.get("infomaniak_token")
                pid = cfg.get("infomaniak_product_id", "251")

        if not api_key:
            return None, provider, model_name

        client = LLMClient(api_key=api_key, model=model_name, provider=provider, product_id=pid)
        return client, provider, model_name

    @classmethod
    def suggest_focus_questions(
        cls,
        subject_or_ref: str,
        study_mode: str = "auto",
        config: Optional[Dict[str, Any]] = None
    ) -> List[str]:
        """
        Génère rapidement 3 à 4 questions directrices ou axes clés d'étude (plan d'attaque)
        adaptés au sujet/passage et au mode herméneutique sélectionné.
        """
        cfg = config or load_config()
        mode_labels = {
            "auto": "Général & Équilibré",
            "exegesis": "Exégèse Approfondie (structure, syntaxe, verset par verset)",
            "historical": "Contexte Historique & Culturel (monde antique, archéologie)",
            "sermon": "Préparation de Prédication (idée maîtresse, applications concrètes)",
            "theology": "Théologie Systématique & Débats (enjeux doctrinaux, histoire des idées)",
            "lexical": "Analyse Lexicale (racines grecques/hébraïques, Strong, nuances)"
        }
        mode_str = mode_labels.get(study_mode, "Analyse Théologique")

        # Extraction textuelle si c'est un passage biblique
        passage_snippet = cls._try_extract_passage_text(subject_or_ref, cfg)
        context_hint = f"\nTexte biblique associé :\n{passage_snippet[:800]}\n" if passage_snippet else ""

        from core.config import DEFAULT_AUDIO_STUDIO_AXES_SYSTEM_PROMPT
        base_prompt = cfg.get("prompt_audio_studio_axes") or DEFAULT_AUDIO_STUDIO_AXES_SYSTEM_PROMPT
        sys_prompt = f"{base_prompt}\n\nAngle herméneutique imposé pour cette émission : {mode_str}."

        user_prompt = (
            f"Sujet ou passage : {subject_or_ref}{context_hint}\n"
            f"Propose 3 ou 4 axes / questions clés pour l'émission."
        )

        primary_model = cfg.get("audio_studio_axes_model") or cfg.get("chat_model", "gemini-3.7-flash")
        fallback_model = cfg.get("audio_studio_axes_fallback_model") or cfg.get("chat_fallback_model", "gemini-3.5-flash-lite")
        models_to_try = [primary_model]
        if fallback_model and fallback_model != primary_model:
            models_to_try.append(fallback_model)

        for m_name in models_to_try:
            try:
                client, _, _ = cls._create_llm_client_for_model(m_name, cfg)
                if not client:
                    continue
                raw = client.chat(messages=[{"role": "user", "content": user_prompt}], system_prompt=sys_prompt)
                data = cls._clean_and_parse_json(raw)
                questions = data.get("focus_questions", [])
                if isinstance(questions, list) and len(questions) > 0:
                    clean_q = [re.sub(r'^\d+[\s.)-]+\s*', '', str(q)).strip() for q in questions if str(q).strip()]
                    return clean_q[:5]
            except Exception as e_m:
                logger.warning("[PodcastEngine] Échec suggest_focus_questions avec modèle %s : %s", m_name, e_m)

        return [
            f"Analyse littéraire et contexte historique de {subject_or_ref}",
            f"Thèmes théologiques majeurs et articulations du texte",
            f"Portée existentielle et implications contemporaines"
        ]

    @classmethod
    def generate_script(
        cls,
        subject_or_ref: str,
        format_type: str = "dialogue",  # "dialogue" | "solo"
        sources_options: Optional[Dict[str, Any]] = None,
        config: Optional[Dict[str, Any]] = None,
        db_instance: Any = None,
        provider: Optional[str] = None,
        model: Optional[str] = None,
        study_mode: str = "auto",
        focal_questions: Optional[List[str]] = None,
        progress_callback: Optional[Callable[[int, str], None]] = None
    ) -> Dict[str, Any]:
        """
        Génère le script textuel structuré en JSON strict (Transcript-First).
        """
        cfg = config or load_config()
        format_clean = "solo" if format_type == "solo" else "dialogue"

        if isinstance(sources_options, dict):
            if not study_mode or study_mode == "auto":
                study_mode = sources_options.get("study_mode", study_mode)
            if not focal_questions:
                focal_questions = sources_options.get("focal_questions", focal_questions)

        if study_mode in ("immersion", "narrative"):
            format_clean = "solo"

        # 1. Récupération du prompt système de base
        if study_mode in ("immersion", "narrative"):
            system_prompt = cfg.get("prompt_immersion") or DEFAULT_IMMERSION_SYSTEM_PROMPT
        elif format_clean == "solo":
            system_prompt = cfg.get("prompt_audio_studio_solo") or DEFAULT_AUDIO_STUDIO_SOLO_PROMPT
        else:
            system_prompt = cfg.get("prompt_audio_studio_dialogue") or DEFAULT_AUDIO_STUDIO_DIALOGUE_PROMPT

        # 2. Construction du contexte herméneutique sourcé
        corpus_context = cls.build_context(subject_or_ref, sources_options, cfg, db_instance, progress_callback=progress_callback)

        if not corpus_context:
            corpus_context = f"Sujet d'étude : {subject_or_ref}\n(Analyse basée sur les textes bibliques et théologiques associés)."

        # Instructions spécifiques selon le mode d'étude sélectionné
        mode_directives = {
            "exegesis": cfg.get("prompt_exegesis") or DEFAULT_EXEGESIS_SYSTEM_PROMPT,
            "historical": cfg.get("prompt_historical") or DEFAULT_HISTORICAL_SYSTEM_PROMPT,
            "sermon": cfg.get("prompt_sermon") or DEFAULT_SERMON_SYSTEM_PROMPT,
            "immersion": cfg.get("prompt_immersion") or DEFAULT_IMMERSION_SYSTEM_PROMPT,
            "narrative": cfg.get("prompt_immersion") or DEFAULT_IMMERSION_SYSTEM_PROMPT,
            "theology": cfg.get("prompt_theology") or DEFAULT_THEOLOGY_SYSTEM_PROMPT,
            "lexical": cfg.get("prompt_lexical") or DEFAULT_LEXICAL_SYSTEM_PROMPT,
        }
        mode_instruction = mode_directives.get(study_mode, "")
        mode_title = {
            "auto": "Détection Automatique & Synthèse Complète",
            "exegesis": "Exégèse Approfondie & Analyse Textuelle",
            "historical": "Contexte Historique, Archéologique & Culturel",
            "sermon": "Préparation de Prédication & Application Pastorale",
            "immersion": "Immersion Narrative (Dramaturgie en 3 Actes)",
            "narrative": "Immersion Narrative (Dramaturgie en 3 Actes)",
            "theology": "Théologie Systématique & Débats Doctrinaux",
            "lexical": "Analyse Lexicale & Langues Originales (Grec/Hébreu)"
        }.get(study_mode, "Étude Théologique")

        mode_block = ""
        if mode_instruction and study_mode not in ("immersion", "narrative"):
            mode_block = (
                f"ORIENTATION SPÉCIFIQUE DU MODE D'ÉTUDE CHOISI : **{mode_title.upper()}**\n"
                f"Adoptez rigoureusement l'angle méthodologique suivant dans le contenu des explications et des interventions :\n"
                f"{mode_instruction}\n\n"
            )

        focal_block = ""
        if focal_questions and len(focal_questions) > 0:
            lines = [f"- {q}" for q in focal_questions if q.strip()]
            if lines:
                focal_block = (
                    "AXES DIRECTEURS ET QUESTIONS CLÉS DÉCIDÉS PAR L'UTILISATEUR (FIL CONDUCTEUR DE L'ÉMISSION) :\n"
                    + "\n".join(lines) + "\n"
                    "-> Veillez à articuler l'échange de manière à traiter méthodiquement chacun de ces axes au fil du dialogue ou de la chronique.\n\n"
                )

        if study_mode in ("immersion", "narrative"):
            format_instruction = (
                "FORMAT DEMANDÉ : **IMMERSION NARRATIVE (FICTION AUDIO & RÉCIT SENSORIEL DU Ier SIÈCLE)**\n"
                "- Il n'y a qu'UN SEUL narrateur ('narrator') qui raconte l'histoire vivante à l'oreille de l'auditeur, comme dans une fiction radio immersive ou un documentaire sonore captivant.\n"
                "- RÈGLE DU 4e MUR (RÈGLE ABSOLUE & CRITIQUE) :\n"
                "  * Le narrateur raconte DIRECTEMENT l'histoire à l'auditeur. Il ne dit JAMAIS les titres de son plan !\n"
                "  * INTERDICTION FORMELLE d'écrire ou de faire prononcer des intitulés de structure (ne JAMAIS écrire « Acte 1 », « Acte premier », « L'accroche sensorielle », « Acte deux », « Le gouffre », etc.) dans le texte parlé.\n"
                "  * Chaque réplique du JSON doit contenir UNIQUEMENT la narration vivante, sans aucun préfixe ni méta-titre.\n"
                "- Rédigez 4 à 6 répliques narratives substantielles et immersives (80 à 120 mots par réplique, pour un total d'environ 400 à 500 mots, durée 2 min 30 à 3 min 30).\n"
                "- Dans le JSON, chaque élément du tableau 'dialogue' doit avoir 'speaker': 'narrator', 'speaker_name': 'Narrateur', 'voice_role': 'solo'.\n\n"
            )
        elif format_clean == "solo":
            format_instruction = (
                "FORMAT DEMANDÉ : **CHRONIQUE THÉOLOGIQUE SOLO (UN SEUL ORATEUR)**\n"
                "- Il n'y a qu'UN SEUL orateur enseignant/pasteur ('narrator').\n"
                "- AUCUN dialogue, AUCUNE animatrice, AUCUN échange de questions-réponses.\n"
                "- Rédigez le script sous la forme d'un exposé oral continu et chaleureux, découpé en 8 à 14 sections thématiques suivies.\n"
                "- Dans le JSON, chaque élément du tableau 'dialogue' doit avoir 'speaker': 'narrator', 'speaker_name': 'Narrateur', 'voice_role': 'solo'.\n\n"
            )
        else:
            format_instruction = (
                "FORMAT DEMANDÉ : **DIALOGUE EN DUO (DEUX INTERVENANTS DISTINCTS)**\n"
                "- Locuteur A ('host') : pose les questions, anime et relance la réflexion.\n"
                "- Locuteur B ('scholar') : répond de façon développée, exégétique et érudite.\n"
                "- Alternez obligatoirement entre 'host' et 'scholar' à chaque réplique.\n"
                "- Dans le JSON, utilisez 'speaker_name': 'Animatrice' pour le rôle A et 'speaker_name': 'Exégète' pour le rôle B.\n\n"
            )

        no_names_rule = (
            "INTERDICTION FORMELLE DE CITER DES PRÉNOMS OU NOMS D'INTERVENANTS (RÈGLE CRITIQUE) :\n"
            "- Ne mentionnez JAMAIS aucun prénom ni nom pour désigner ou interpeller les intervenants (interdiction absolue de dire « Henri », « Denise », ou tout autre prénom dans le texte parlé).\n"
            "- Les intervenants s'adressent directement l'un à l'autre de manière fluide et naturelle (ex: « Entrons directement dans le vif du sujet... », « C'est un point capital... », « Que dit le texte au verset suivant ? », « Tout à fait... »).\n\n"
        )

        phonetic_rule = (
            "EXIGENCE IMPÉRATIVE DE PRONONCIATION AUDIO :\n"
            "1. RÉFÉRENCES BIBLIQUES (RÈGLE ABSOLUE) :\n"
            "   - Ne JAMAIS écrire les références sous la forme chiffrée avec deux-points (ex: 'Romains 2:1', 'Jean 3:16' ou '2:4'), car les moteurs de synthèse vocale les lisent comme des heures ('2 heures 1', '3 heures 16', '2 heures 4') !\n"
            "   - Écrivez TOUJOURS les références bibliques intégralement en toutes lettres :\n"
            "     * 'Romains chapitre 2, verset 1' au lieu de 'Romains 2:1'\n"
            "     * 'Jean chapitre 3, verset 16' au lieu de 'Jean 3:16'\n"
            "     * 'versets 1 à 5' au lieu de 'v. 1-5' ou '1-5'\n"
            "     * 'chapitre 2' au lieu de 'ch. 2' ou 'chap. 2'\n"
            "     * 'après Jésus-Christ' / 'avant Jésus-Christ' au lieu de 'apr. J.-C.' / 'av. J.-C.'\n"
            "2. PRONONCIATION DIRECTE DES TERMES GRECS ET HÉBREUX (ZÉRO CROCHET, ZÉRO DOUBLON) :\n"
            "   - N'insérez jamais de caractères grecs ou hébreux d'origine non translittérés.\n"
            "   - Écrivez DIRECTEMENT et UNIQUEMENT le mot en graphie phonétique française intuitive entre guillemets français (ex: écrivez directement « a-na-baï-no », « kata apo-ka-lup-sin », « kata-fro-né-o », « kré-sto-tèss », « khè-ssèd »).\n"
            "   - INTERDICTION FORMELLE DE DOUBLER LE TERME AVEC DES CROCHETS COMME [prononcé ...] (la voix neuronale lirait les deux versions à haute voix ! Écrivez directement la graphie phonétique).\n\n"
        )

        if study_mode in ("immersion", "narrative"):
            length_instruction = (
                "PROGRESSION DRAMATIQUE FLUIDE (INVISIBLE POUR L'AUDITEUR — NE JAMAIS EN FAIRE DES TITRES ORALISÉS) :\n"
                "- Développez une narration continue et progressive enchaînant naturellement les 3 mouvements suivants, fondus d'un paragraphe à l'autre sans aucune annonce d'acte :\n"
                "  1. Ouverture sensorielle (0s–45s) : Plongée physique immédiate (chaleur écrasante, poussière sous les sandales, odeurs d'herbes brûlées ou d'huile, bruits d'ambiance) et survenue d'un événement concret qui rompt le calme quotidien. Zéro chiffre/date/cours encyclopédique.\n"
                "  2. Montée de la tension et gouffre socio-culturel (45s–2m15s) : Le conflit selon Kenneth E. Bailey (code omniprésent de l'Honneur et de la Honte, poids de l'occupant romain, regards inquisiteurs des chefs religieux, faim viscérale des disciples, risque social de transgression).\n"
                "  3. Climax et seuil du texte (2m15s–3m15s) : La tension dramatique est à son comble. Suspendre le récit au seuil exact de la rencontre ou de la parole de Jésus (« Need to know »), créant une soif irrésistible de lire la suite dans le texte biblique.\n"
                "- RÈGLE FORMELLE : Le tableau 'dialogue' doit contenir entre 4 et 6 paragraphes narratifs développés (SANS aucun titre d'acte).\n"
                "- Insérez des balises orales [pause: 1.2s] ou [pause: 1.5s] avant les moments clés de tension ou de silence pesant.\n"
                "- TITRE DE L'ÉMISSION : Donnez un titre évocateur et littéraire (ex: « Au Seuil du Sabbat », « La Moisson Fragile », « Le Silence des Collines de Galilée »). Ne mettez JAMAIS de termes méta comme « Immersif », « Audio », « Chapitre Douze » ou « Format » dans le titre !\n\n"
            )
        else:
            length_instruction = (
                "EXIGENCE CRITIQUE DE LONGUEUR ET DE PROFONDEUR EXÉGÉTIQUE :\n"
                "- Produisez une émission consistante, substantielle et approfondie, avec la même rigueur et le même niveau d'érudition que l'Assistant d'Étude d'Open Shema.\n"
                "- Développez au moins 12 à 18 répliques substantielles (pour un dialogue) ou 8 à 12 sections développées (pour une chronique solo).\n"
                "- Ne vous limitez pas à un survol : parcourez le contexte littéraire et historique, décortiquez les termes grecs/hébreux clés, confrontez les avis des commentateurs fournis et dégagez les enjeux théologiques profonds.\n\n"
            )

        user_prompt = (
            f"Voici le corpus documentaire et les extraits d'étude sur lesquels baser STRICTEMENT l'émission :\n\n"
            f"--- DÉBUT DU CORPUS DOCUMENTAIRE ---\n"
            f"{corpus_context}\n"
            f"--- FIN DU CORPUS DOCUMENTAIRE ---\n\n"
            f"Sujet ou passage ciblé : **{subject_or_ref}**\n"
            f"Mode d'étude appliqué : **{mode_title}**\n\n"
            f"{format_instruction}"
            f"{no_names_rule}"
            f"{phonetic_rule}"
            f"{mode_block}"
            f"{focal_block}"
            f"{length_instruction}"
            f"Rappels impératifs :\n"
            f"- Basez l'émission UNIQUEMENT sur les extraits ci-dessus (zéro hallucination).\n"
            f"- Renvoyez UNIQUEMENT l'objet JSON valide avec les clés 'title', 'summary', 'sources_cited', 'dialogue'. Pas de markdown autour."
        )

        # 3. Résolution du LLM et exécution avec fallback
        primary_model = model or cfg.get("audio_studio_script_model") or cfg.get("chat_model", "gemini-3.7-flash")
        fallback_model = cfg.get("audio_studio_script_fallback_model") or cfg.get("chat_fallback_model", "gemini-3.5-flash-lite")
        models_to_try = [primary_model]
        if fallback_model and fallback_model != primary_model:
            models_to_try.append(fallback_model)

        raw_response = None
        last_error = None
        if progress_callback:
            progress_callback(80, f"Rédaction de l'émission par l'IA ({primary_model})...")

        for m_name in models_to_try:
            try:
                client, _, _ = cls._create_llm_client_for_model(m_name, cfg)
                if not client:
                    continue
                raw_response = client.chat(
                    messages=[{"role": "user", "content": user_prompt}],
                    system_prompt=system_prompt
                )
                if raw_response and raw_response.strip():
                    break
            except Exception as e_gen:
                logger.warning("[PodcastEngine] Échec génération script avec modèle %s : %s", m_name, e_gen)
                last_error = e_gen

        if not raw_response or not raw_response.strip():
            if last_error:
                raise last_error
            raise Exception("Aucune clé API IA (Google Gemini, Mistral ou Infomaniak) n'a pu générer le script audio.")

        if progress_callback:
            progress_callback(95, "Validation et structuration du script...")

        # 4. Nettoyage et parsing JSON
        parsed_script = cls._clean_and_parse_json(raw_response)
        
        # 5. Normalisation des répliques
        script_id = f"pod_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}"
        dialogue_items = parsed_script.get("dialogue", [])
        clean_dialogue = []
        
        default_pause = int(cfg.get("audio_studio_pause_ms", 350))

        for idx, item in enumerate(dialogue_items):
            raw_spk = str(item.get("speaker", "")).lower()
            raw_role = str(item.get("voice_role", "")).upper()

            if format_clean == "solo":
                speaker_role = "solo"
                speaker_name = "Henri"
                speaker_val = "narrator"
            else:
                if raw_role == "A" or raw_spk in ("host", "animateur", "animatrice", "denise"):
                    speaker_role = "A"
                    speaker_name = "Denise"
                    speaker_val = "host"
                elif raw_role == "B" or raw_spk in ("scholar", "théologien", "theologien", "exégète", "exegete", "chercheur", "henri"):
                    speaker_role = "B"
                    speaker_name = "Henri"
                    speaker_val = "scholar"
                else:
                    speaker_role = "A" if (idx % 2 == 0) else "B"
                    speaker_name = "Denise" if speaker_role == "A" else "Henri"
                    speaker_val = "host" if speaker_role == "A" else "scholar"

            raw_text = str(item.get("text", "")).strip()

            # Détection et élimination fine des méta-titres d'actes parasites (ex: "Acte premier. L'accroche sensorielle.")
            starts_act = bool(re.match(r'^(?:Acte\s+(?:premier|première|un|deux|trois|troisième|quatre|quatrième|cinq|cinquième|\d+|I|II|III|IV|V)|Partie\s+\d+|Scène\s+\d+)\b', raw_text, re.IGNORECASE))
            if starts_act:
                words = raw_text.split()
                meta_keywords = ("accroche", "sensorielle", "gouffre", "tension", "socio-culturelle", "climax", "passerelle", "incident", "dramatique")
                has_meta_kw = any(kw in raw_text.lower() for kw in meta_keywords)
                if len(words) <= 5 or (has_meta_kw and len(words) <= 10):
                    continue

                # Si ce n'est pas un pur intitulé mais un paragraphe commençant par "Acte 1." ou "Acte premier :", retirer seulement le préfixe
                raw_text = re.sub(
                    r'^(?:Acte\s+(?:premier|première|un|deux|trois|troisième|quatre|quatrième|cinq|cinquième|\d+|I|II|III|IV|V)|Partie\s+\d+|Scène\s+\d+)[\s\.\:\-–—]+',
                    '',
                    raw_text,
                    flags=re.IGNORECASE
                ).strip()

            if not raw_text:
                continue

            # Détection et conversion des balises [pause: X.Xs]
            item_pause = int(item.get("pause_after_ms", default_pause))
            pause_match = re.search(r'\[pause:\s*([\d\.]+)\s*s?\]', raw_text, re.IGNORECASE)
            if pause_match:
                try:
                    p_sec = float(pause_match.group(1))
                    item_pause = max(item_pause, int(p_sec * 1000))
                except Exception:
                    pass

            # Texte littéraire soigné (orthographe française, termes grecs/hébreux et citations intactes)
            raw_text_clean = re.sub(r'\[pause:\s*[\d\.]+\s*s?\]', '', raw_text).strip()
            literary_text = re.sub(r'\b([a-zA-ZÀ-ÿ]+)\s+til\b', r'\1-il', raw_text_clean)
            literary_text = re.sub(r'\b([a-zA-ZÀ-ÿ]+)\s+telle\b', r'\1-elle', literary_text)
            # Correction des coquilles et omissions d'accents fréquentes des LLM
            literary_text = re.sub(r'\bcrpite\b', 'crépite', literary_text)
            literary_text = re.sub(r'\bcrpitent\b', 'crépitent', literary_text)
            literary_text = re.sub(r'\bcrpitement\b', 'crépitement', literary_text)
            literary_text = re.sub(r'\bcrpitements\b', 'crépitements', literary_text)
            literary_text = re.sub(r'\bcrpitant\b', 'crépitant', literary_text)
            literary_text = re.sub(r'\bcrpitante\b', 'crépitante', literary_text)

            # Script vocal / phonétique optimisé pour la synthèse TTS (références développées, énumérations posées)
            speech_text = cls._clean_text_for_speech(literary_text)

            clean_dialogue.append({
                "index": len(clean_dialogue),
                "speaker": speaker_val,
                "speaker_name": speaker_name,
                "voice_role": speaker_role,
                "text": literary_text,
                "speech_text": speech_text,
                "pause_after_ms": item_pause,
                "start_time": 0.0,
                "end_time": 0.0
            })

        for i, itm in enumerate(clean_dialogue):
            itm["index"] = i

        raw_title = parsed_script.get("title") or f"{'Chronique' if format_clean == 'solo' else 'Échange'} — {subject_or_ref}"
        clean_title = re.sub(r"\bL['’]Immersif\s+", "Le ", raw_title, flags=re.IGNORECASE)
        clean_title = re.sub(r"\bImmersif\b\s*", "", clean_title, flags=re.IGNORECASE).strip()
        clean_title = re.sub(r"\s+:\s+:", " :", clean_title).strip(" :")

        podcast_record = {
            "id": script_id,
            "title": clean_title,
            "summary": parsed_script.get("summary") or "",
            "subject": subject_or_ref,
            "study_mode": study_mode,
            "focal_questions": focal_questions or [],
            "format": format_clean,
            "format_type": format_clean,
            "engine": cfg.get("audio_studio_engine", "edge_tts"),
            "created_at": datetime.datetime.now().isoformat(),
            "sources_cited": parsed_script.get("sources_cited", []),
            "dialogue": clean_dialogue,
            "script_dialogue": clean_dialogue,
            "status": "script_only",
            "audio_file": None,
            "duration_seconds": 0.0
        }

        # Sauvegarder dans l'historique
        PodcastHistory.upsert(podcast_record)
        if progress_callback:
            progress_callback(100, "Script audio rédigé avec succès !")
        return podcast_record

    @classmethod
    def _clean_and_parse_json(cls, text: str) -> Dict[str, Any]:
        """Extrait et désérialise un JSON valide à partir d'une réponse textuelle potentiellement bruitée."""
        if not text or not str(text).strip():
            raise Exception("Le modèle IA a renvoyé une réponse vide.")

        clean = str(text).strip()

        # Si le LLM a renvoyé une chaîne d'erreur explicite
        if clean.startswith("Erreur ") or clean.startswith("Erreur:") or clean.startswith("Error:"):
            logger.error("[PodcastEngine] Réponse d'erreur du LLM reçue : %s", clean)
            raise Exception(clean)

        # 1. Extraction d'un bloc ```json ... ``` ou ``` ... ```
        fence_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", clean, re.DOTALL)
        if fence_match:
            candidate = fence_match.group(1).strip()
        else:
            # 2. Chercher la première accolade ouvrante et la dernière fermante
            first_brace = clean.find("{")
            last_brace = clean.rfind("}")
            if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
                candidate = clean[first_brace:last_brace + 1].strip()
            else:
                logger.error("[PodcastEngine] Aucun objet JSON trouvé dans la réponse : %s", clean[:300])
                raise Exception(f"Le modèle IA n'a pas renvoyé de format JSON valide. Réponse reçue : {clean[:120]}...")

        # 3. Essai de parsing standard direct
        try:
            return json.loads(candidate)
        except Exception as e1:
            logger.warning("[PodcastEngine] Parsing JSON direct échoué (%s), tentative de nettoyage...", e1)

        # 4. Suppression des virgules traînantes avant } ou ]
        repaired = re.sub(r",\s*([\]}])", r"\1", candidate)
        try:
            return json.loads(repaired)
        except Exception:
            pass

        # 5. Assainissement des sauts de ligne et tabulations brutes à l'intérieur des chaînes
        try:
            result = []
            in_string = False
            escape = False
            for char in repaired:
                if char == '"' and not escape:
                    in_string = not in_string
                    result.append(char)
                elif char == '\\':
                    escape = not escape
                    result.append(char)
                elif char == '\n' and in_string:
                    result.append('\\n')
                elif char == '\r' and in_string:
                    pass
                elif char == '\t' and in_string:
                    result.append('\\t')
                else:
                    result.append(char)
                if char != '\\':
                    escape = False
            sanitized = "".join(result)
            return json.loads(sanitized)
        except Exception:
            pass

        # 6. Fallback par extraction regex de toutes les répliques
        try:
            title_m = re.search(r'"title"\s*:\s*"([^"]+)"', candidate)
            summary_m = re.search(r'"summary"\s*:\s*"([^"]+)"', candidate)

            turn_pattern = re.compile(
                r'\{\s*"speaker"\s*:\s*"([^"]+)"\s*,\s*'
                r'(?:"speaker_name"\s*:\s*"([^"]+)"\s*,\s*)?'
                r'(?:"voice_role"\s*:\s*"([^"]+)"\s*,\s*)?'
                r'"text"\s*:\s*"((?:[^"\\]|\\.)*)"',
                re.DOTALL
            )
            dialogue_extracted = []
            for m in turn_pattern.finditer(candidate):
                spk = m.group(1)
                name = m.group(2) or ("Denise" if spk in ("host", "animatrice") else "Henri")
                role = m.group(3) or ("A" if spk in ("host", "animatrice") else "B")
                txt = m.group(4).replace('\\"', '"').replace('\\n', ' ')
                dialogue_extracted.append({
                    "speaker": spk,
                    "speaker_name": name,
                    "voice_role": role,
                    "text": txt
                })

            if dialogue_extracted:
                logger.info("[PodcastEngine] Récupération réussie par regex de %d répliques !", len(dialogue_extracted))
                return {
                    "title": title_m.group(1) if title_m else "Échange biblique",
                    "summary": summary_m.group(1) if summary_m else "",
                    "sources_cited": [],
                    "dialogue": dialogue_extracted
                }
        except Exception as e_regex:
            logger.error("[PodcastEngine] Fallback regex échoué : %s", e_regex)

        logger.error("[PodcastEngine] Échec définitif du parsing JSON.\nTexte reçu : %s", clean[:400])
        raise Exception(f"Le modèle IA n'a pas renvoyé un format JSON exploitable. Réponse : {clean[:100]}...")


    @classmethod
    def _transliterate_greek_for_speech(cls, text: str) -> str:
        """Translittère le grec ancien (unicode) vers une phonétique française naturelle."""
        import unicodedata
        greek_pattern = re.compile(r'[\u0370-\u03FF\u1F00-\u1FFF]+')
        if not greek_pattern.search(text):
            return text

        greek_map = {
            'α': 'a', 'β': 'b', 'γ': 'g', 'δ': 'd', 'ε': 'è', 'ζ': 'z', 'η': 'é', 'θ': 'th',
            'ι': 'i', 'κ': 'k', 'λ': 'l', 'μ': 'm', 'ν': 'n', 'ξ': 'x', 'ο': 'o', 'π': 'p',
            'ρ': 'r', 'σ': 's', 'ς': 'ss', 'τ': 't', 'υ': 'u', 'φ': 'f', 'χ': 'k', 'ψ': 'ps', 'ω': 'o'
        }

        def _replace_word(m):
            w = m.group(0)
            w_norm = unicodedata.normalize('NFD', w.lower())
            clean = ''
            for ch in w_norm:
                if ch in ('\u0300', '\u0301', '\u0342', '\u0304', '\u0306', '\u0313'):
                    continue
                if ch == '\u0314':  # esprit rude -> h
                    clean += 'h'
                elif ch in greek_map or ('a' <= ch <= 'z'):
                    clean += ch

            clean = clean.replace('ου', 'ou').replace('αι', 'è').replace('ει', 'i').replace('οι', 'oi').replace('υι', 'ui')
            clean = clean.replace('γγ', 'ng').replace('γκ', 'nk').replace('γχ', 'nkh').replace('γξ', 'nx')
            out = []
            for i, c in enumerate(clean):
                if c == 'σ':
                    if (i > 0 and clean[i - 1] in 'aeiouyèé') and (i < len(clean) - 1 and clean[i + 1] in 'aeiouyèé'):
                        out.append('ss')
                    else:
                        out.append('s')
                elif c == 'ς':
                    out.append('ss')
                else:
                    out.append(greek_map.get(c, c))
            res = ''.join(out)
            if res.endswith('s') and not res.endswith('ss'):
                res += 's'
            return res

        return greek_pattern.sub(_replace_word, text)

    @classmethod
    def _transliterate_hebrew_for_speech(cls, text: str) -> str:
        """Translittère l'hébreu (unicode) vers une phonétique française naturelle."""
        import unicodedata
        hebrew_pattern = re.compile(r'[\u0590-\u05FF]+')
        if not hebrew_pattern.search(text):
            return text

        hebrew_map = {
            'א': '', 'ב': 'b', 'ג': 'g', 'ד': 'd', 'ה': 'h', 'ו': 'v', 'ז': 'z',
            'ח': 'kh', 'ט': 't', 'י': 'y', 'כ': 'k', 'ך': 'k', 'ל': 'l', 'מ': 'm',
            'ם': 'm', 'נ': 'n', 'ן': 'n', 'ס': 'ss', 'ע': '', 'פ': 'p', 'ף': 'f',
            'צ': 'ts', 'ץ': 'ts', 'ק': 'k', 'ר': 'r', 'ש': 'ch', 'ת': 't'
        }
        vowel_map = {
            '\u05B0': 'e', '\u05B1': 'e', '\u05B2': 'a', '\u05B3': 'o',
            '\u05B4': 'i', '\u05B5': 'é', '\u05B6': 'è', '\u05B7': 'a',
            '\u05B8': 'a', '\u05B9': 'o', '\u05BA': 'o', '\u05BB': 'ou'
        }

        def _replace_heb(m):
            w = m.group(0)
            w_norm = unicodedata.normalize('NFD', w)
            res = []
            for ch in w_norm:
                if ch in vowel_map:
                    res.append(vowel_map[ch])
                elif ch in hebrew_map:
                    res.append(hebrew_map[ch])
            return ''.join(res) or 'mot hébreu'

        return hebrew_pattern.sub(_replace_heb, text)

    @classmethod
    def _clean_biblical_transliterations_for_speech(cls, text: str) -> str:
        """Adapte les termes translittérés grecs et hébreux pour la voix neuronale française."""
        # 1. Termes avec suffixes verbaux en -eô / -oô grecs spécifiques
        text = re.sub(r'\bkataphrone[oô]\b', 'katafronéo', text, flags=re.I)
        text = re.sub(r'\bphrone[oô]\b', 'fronéo', text, flags=re.I)
        text = re.sub(r'\bdikaio[oô]\b', 'dikaïo-o', text, flags=re.I)

        # 2. Termes avec kh grec (anokhê, anekhô)
        text = re.sub(r'\banokh[êe]\b', 'anoké', text, flags=re.I)
        text = re.sub(r'\banekh[oô]\b', 'anéko', text, flags=re.I)

        # 3. Termes grecs avec chr- / char- (chrêstotês, christos, charis...)
        text = re.sub(r'\bchr[êe]stot[êe]s\b', 'kréstotèss', text, flags=re.I)
        text = re.sub(r'\bchr[êe]st[oô]s\b', 'kréstoss', text, flags=re.I)
        text = re.sub(r'\bchristos\b', 'kristoss', text, flags=re.I)
        text = re.sub(r'\bcharis\b', 'kariss', text, flags=re.I)
        text = re.sub(r'\bchiasme\b', 'kiasme', text, flags=re.I)
        text = re.sub(r'\bchara\b', 'kara', text, flags=re.I)

        # 1bis. Termes de 1 Corinthiens 1 et corpus paulinien
        text = re.sub(r'\bkl[êe]t[oó]s\b', 'klé-toss', text, flags=re.I)
        text = re.sub(r'\bkal[eé][oô]\b', 'ka-lé-o', text, flags=re.I)
        text = re.sub(r'\bap[oó]stolos\b', 'a-pos-to-loss', text, flags=re.I)
        text = re.sub(r'\bkyrios\b', 'kou-ri-oss', text, flags=re.I)
        text = re.sub(r'\bk[uú]rios\b', 'kou-ri-oss', text, flags=re.I)
        text = re.sub(r'\btheos\b', 'té-oss', text, flags=re.I)
        text = re.sub(r'\bthe[oó]s\b', 'té-oss', text, flags=re.I)
        text = re.sub(r'\bpneuma\b', 'pneu-ma', text, flags=re.I)
        text = re.sub(r'\bpneumatos\b', 'pneu-ma-toss', text, flags=re.I)
        text = re.sub(r'\bsarx\b', 'sarks', text, flags=re.I)
        text = re.sub(r'\bhamartia\b', 'ha-mar-ti-a', text, flags=re.I)
        text = re.sub(r'\bdikaiosyn[eê]\b', 'di-ka-ï-o-su-né', text, flags=re.I)
        text = re.sub(r'\beir[eê]n[eê]\b', 'è-ré-né', text, flags=re.I)
        text = re.sub(r'\bekkl[eê]sia\b', 'èk-klé-si-a', text, flags=re.I)
        text = re.sub(r'\beuangelion\b', 'é-van-gé-li-on', text, flags=re.I)
        text = re.sub(r'\bparakl[eê]tos\b', 'pa-ra-klé-toss', text, flags=re.I)

        # 4. Termes grecs usuels en étude biblique (prononciation du -s final grec)
        text = re.sub(r'\bpistis\b', 'pistiss', text, flags=re.I)
        text = re.sub(r'\bnomos\b', 'nomoss', text, flags=re.I)
        text = re.sub(r'\blogos\b', 'logoss', text, flags=re.I)
        text = re.sub(r'\bkosmos\b', 'kosmoss', text, flags=re.I)
        text = re.sub(r'\bagap[êe]\b', 'agapé', text, flags=re.I)
        text = re.sub(r'\bagape\b', 'agapé', text, flags=re.I)
        text = re.sub(r'\bmetanoia\b', 'métanoïa', text, flags=re.I)
        text = re.sub(r'\bkoinonia\b', 'koïnonia', text, flags=re.I)
        text = re.sub(r'\bploutos\b', 'ploutoss', text, flags=re.I)
        text = re.sub(r'\bgenesis\b', 'génèssiss', text, flags=re.I)

        # 4bis. Adaptation phonétique des termes cités entre guillemets comportant des signes grecs translittérés
        def _phonetize_greek_word(m):
            w = m.group(1)
            lower = w.lower()
            if lower in ('le', 'la', 'les', 'de', 'du', 'des', 'un', 'une', 'en', 'dans', 'par', 'sur', 'pour', 'est', 'qui', 'que'):
                return m.group(0)
            p = lower.replace('ê', 'é').replace('ô', 'o').replace('ó', 'o').replace('á', 'a').replace('í', 'i').replace('ú', 'ou')
            p = p.replace('ph', 'f').replace('th', 't').replace('ch', 'k')
            if p.endswith('os') and not p.endswith('oss'):
                p = p[:-2] + 'oss'
            elif p.endswith('es') and not p.endswith('ess'):
                p = p[:-2] + 'èss'
            elif p.endswith('is') and not p.endswith('iss'):
                p = p[:-2] + 'iss'
            return f"« {p} »"

        text = re.sub(r'«\s*([a-zA-ZÀ-ÿ\^]{3,25})\s*»', _phonetize_greek_word, text)

        # 5. Termes hébreux classiques
        text = re.sub(r'\b(h|ch)esed\b', 'khèssèd', text, flags=re.I)
        text = re.sub(r'\bberit\b', 'béritt', text, flags=re.I)
        text = re.sub(r'\brua(ch|h)\b', 'rouakh', text, flags=re.I)
        text = re.sub(r'\bsh(e|a)lom\b', 'chalom', text, flags=re.I)
        text = re.sub(r'\btorah\b', 'tora', text, flags=re.I)
        text = re.sub(r'\byahweh\b', 'yavé', text, flags=re.I)
        text = re.sub(r'\b(y|j)hwh\b', 'yavé', text, flags=re.I)
        text = re.sub(r'\badonai\b', 'adonaï', text, flags=re.I)
        text = re.sub(r'\belohim\b', 'élohim', text, flags=re.I)
        text = re.sub(r'\bshema\b', 'chéma', text, flags=re.I)
        text = re.sub(r'\bnefesh\b', 'nèfèch', text, flags=re.I)
        text = re.sub(r'\bgoel\b', 'go-èl', text, flags=re.I)

        return text

    @classmethod
    def _clean_text_for_speech(cls, text: str) -> str:
        """
        Normalise phonétiquement le texte pour éviter les bévues de lecture des moteurs TTS.
        Ex: 'Romains 2:1-5' -> 'Romains chapitre 2, versets 1 à 5' (au lieu de '2 heures 1 à 5')
        Ex: 'Jean 3:16' -> 'Jean chapitre 3, verset 16' (au lieu de '3 heures 16')
        Ex: 'redéfinit-elle' -> 'redéfinit telle' (liaison en [t] audible)
        Ex: 'terme grec utilisé ici est genesis' -> 'terme grec utilisé ici est : « genesis »,' (pause d'emphase)
        Ex: 'kataphroneô' -> 'katafronéo', 'chrêstotês' -> 'kréstotèss', 'anokhê' -> 'anoké'
        """
        if not text:
            return ""

        # 0. Supprimer impérativement toute balise XML / SSML / HTML résiduelle (ex: <break time="..."/>)
        # pour éviter qu'Edge-TTS ne les lise mot à mot à voix haute.
        text = re.sub(r'<[^>]+>', ' ', text)

        # 0bis. Déduplication et nettoyage des phonétiques entre crochets
        # Ex: "anabaïnô [prononcé a-na-baï-no]" -> "« a-na-baï-no »"
        # Ex: "kata apokalupsin [prononcé kata apo-ka-lup-sin]" -> "« kata apo-ka-lup-sin »"
        # Ex: "kataphroneô [kata-fro-né-o]" -> "« kata-fro-né-o »"
        text = re.sub(
            r'«?\s*[A-Za-zÀ-ÿ\s\-]+\s*»?\s*\[(?:prononcé|prononcée|prononcer|pron\.)\s*([^\]]+)\]',
            r'« \1 »',
            text,
            flags=re.IGNORECASE
        )
        text = re.sub(
            r'«?\s*[A-Za-zÀ-ÿ]+\s*»?\s*\[([a-zA-ZÀ-ÿ]+(?:-[a-zA-ZÀ-ÿ]+)+)\]',
            r'« \1 »',
            text
        )
        # Supprimer les crochets résiduels
        text = text.replace('[', '').replace(']', '')
        text = re.sub(r'«\s*«', '« ', text)
        text = re.sub(r'»\s*»', ' »', text)

        # 1. Remplacer 'Livre Chapitre:Verset-Fin' (ex: Romains 2:1-5)
        text = re.sub(
            r'\b([1-3]?\s*[A-Za-zÀ-ÿ]+)\s+(\d+)[:\s]+(\d+)\s*[-–—]\s*(\d+)\b',
            r'\1 chapitre \2, versets \3 à \4',
            text
        )
        # 2. Remplacer 'Livre Chapitre:Verset' (ex: Romains 2:4)
        text = re.sub(
            r'\b([1-3]?\s*[A-Za-zÀ-ÿ]+)\s+(\d+):(\d+)\b',
            r'\1 chapitre \2, verset \3',
            text
        )
        # 3. Remplacer les références sans nom de livre (ex: '2:1-5' ou '2:1')
        text = re.sub(
            r'\b(\d+):(\d+)\s*[-–—]\s*(\d+)\b',
            r'chapitre \1, versets \2 à \3',
            text
        )
        text = re.sub(
            r'\b(\d+):(\d+)\b',
            r'chapitre \1, verset \2',
            text
        )
        # 4. Abréviations courantes
        text = re.sub(r'\b[Vv]{2}\.\s*(\d+)\s*[-–—]\s*(\d+)', r'versets \1 à \2', text)
        text = re.sub(r'\b[Vv]\.\s*(\d+)', r'verset \1', text)
        text = re.sub(r'\b[Cc]hap\.\s*(\d+)', r'chapitre \1', text)
        text = re.sub(r'\b[Cc]h\.\s*(\d+)', r'chapitre \1', text)
        text = re.sub(r'\b1er\b', 'premier', text)
        text = re.sub(r'\b1ère\b', 'première', text)
        text = re.sub(r'\b[Aa]v\.\s*J\.-?C\.\b', 'avant Jésus-Christ', text)
        text = re.sub(r'\b[Aa]pr\.\s*J\.-?C\.\b', 'après Jésus-Christ', text)
        # Sécurisation des sigles A.T. et N.T. pour ne pas corrompre les initiales d'auteurs (ex: A.T. Robertson)
        text = re.sub(r'\bA\.T\.(?!\s+[A-Z][a-z])\b', 'Ancien Testament', text)
        text = re.sub(r'\bN\.T\.(?!\s+[A-Z][a-z])\b', 'Nouveau Testament', text)
        text = re.sub(r'\bLXX\b', 'la Septante', text)

        # 4bis. Rétablissement des formes correctes d'inversion interrogative (évite toute scorie 'til'/'telle')
        text = re.sub(r'\b([a-zA-ZÀ-ÿ]+)\s+til\b', r'\1-il', text)
        text = re.sub(r'\b([a-zA-ZÀ-ÿ]+)\s+telle\b', r'\1-elle', text)
        text = re.sub(r'\b([a-zA-ZÀ-ÿ]+)\s+ton\b', r'\1-on', text)
        text = re.sub(r'\b([a-zA-ZÀ-ÿ]+)\s+tils\b', r'\1-ils', text)
        text = re.sub(r'\b([a-zA-ZÀ-ÿ]+)\s+telles\b', r'\1-elles', text)

        # 4bis-b. Correction des coquilles fréquentes des LLM (omission d'accents sur verbes descriptifs)
        text = re.sub(r'\bcrpite\b', 'crépite', text)
        text = re.sub(r'\bcrpitent\b', 'crépitent', text)
        text = re.sub(r'\bcrpitement\b', 'crépitement', text)
        text = re.sub(r'\bcrpitements\b', 'crépitements', text)
        text = re.sub(r'\bcrpitant\b', 'crépitant', text)
        text = re.sub(r'\bcrpitante\b', 'crépitante', text)

        # 4ter. Équilibrage prosodique des énumérations de versets ou chiffres
        # Ex: "Aux versets 10, 12 et 14" -> "Aux versets 10, 12, et 14"
        # Permet à chaque élément énuméré d'avoir la même respiration naturelle posée
        text = re.sub(r'(versets?\s+\d+(?:,\s*\d+)*)\s+et\s+(\d+)', r'\1, et \2', text, flags=re.IGNORECASE)
        text = re.sub(r'(chapitres?\s+\d+(?:,\s*\d+)*)\s+et\s+(\d+)', r'\1, et \2', text, flags=re.IGNORECASE)

        # 4ter. Emphase et pauses prosodiques sur les termes originaux ou mots-clés cités
        # Ex: "le terme grec utilisé ici est genesis, le mot même" -> "le terme grec utilisé ici est : « genesis », le mot même"
        text = re.sub(
            r'\b((?:le|ce|au|du)\s+(?:terme|mot|nom|concept|verbe|vocable|titre)\s+(?:grec|hébreu|araméen|latin|biblique)?\s*(?:utilisé ici|employé ici|ici)?\s*(?:est|c\'est))\s+([a-zA-ZÀ-ÿ\-]+)(?=[\s,\.;:—\-]|$)',
            r'\1 : « \2 »,',
            text,
            flags=re.IGNORECASE
        )
        # Convertir les mots isolés en markdown *mot* ou "mot" en incise avec guillemets français
        text = re.sub(r'(?<=\s)[\*\_"]([A-Za-zÀ-ÿ\-]{2,30})[\*\_"](?=[\s,\.;:—\-]|$)', r'« \1 »', text)
        # Nettoyage des doubles ponctuations induites
        text = re.sub(r':\s*:\s*', ': ', text)
        text = re.sub(r',\s*,', ',', text)
        text = re.sub(r'«\s*«', '«', text)
        text = re.sub(r'»\s*»', '»', text)

        # 5. Translittération du grec et de l'hébreu en caractères originaux
        text = cls._transliterate_greek_for_speech(text)
        text = cls._transliterate_hebrew_for_speech(text)

        # 6. Adaptation phonétique des termes translittérés grecs et hébreux
        text = cls._clean_biblical_transliterations_for_speech(text)

        # 7. Nettoyage des espaces multiples
        text = re.sub(r'\s{2,}', ' ', text).strip()
        return text

    @classmethod
    def _inject_speech_prosody_breaks(cls, text: str) -> str:
        """
        Aère naturellement le texte pour les moteurs vocaux sans injecter de balises XML.
        Utilise la ponctuation naturelle (points, tirets cadratins, points de suspension)
        pour induire les respirations humaines de la synthèse neuronale.
        """
        if not text:
            return ""

        # Supprimer toute balise résiduelle
        text = re.sub(r'<[^>]+>', ' ', text)

        # Normaliser les sauts de paragraphe en ponctuation de respiration douce
        text = re.sub(r'(\r?\n)+', ' — ', text)

        # Nettoyage des espaces résiduels
        text = re.sub(r'\s{2,}', ' ', text).strip()
        return text

    @classmethod
    def apply_audio_mastering(
        cls,
        mp3_bytes: bytes,
        options: Optional[Dict[str, Any]] = None
    ) -> bytes:
        """
        Chaîne de mastering audio studio / radio (DSP FFmpeg via PyAV) :
        1. Filtre passe-haut à 80 Hz : suppression des résonances graves et bruits de micro.
        2. Égalisation chaleur (+2 dB à 250 Hz) : rondeur et présence de la voix.
        3. Adoucissement anti-sibilance (-1.5 dB à 3500 Hz) : atténuation des harmoniques aiguës synthétiques.
        4. Compression dynamique douce (seuil -18 dB, ratio 2.5) : niveau sonore régulier et feutré.
        5. Micro-acoustique (reverb courte 25ms decay, wet 4%) : élimine l'effet de voix brute plaquée.
        """
        if not mp3_bytes or len(mp3_bytes) < 1000:
            return mp3_bytes

        opts = options or {}
        if not opts.get("mastering_enabled", True):
            return mp3_bytes

        try:
            import io
            import av
            import av.filter

            in_buf = io.BytesIO(mp3_bytes)
            in_container = av.open(in_buf)
            if not in_container.streams.audio:
                in_container.close()
                return mp3_bytes

            in_stream = in_container.streams.audio[0]
            sample_rate = in_stream.rate or 24000

            graph = av.filter.Graph()
            src = graph.add_abuffer(template=in_stream)

            hp = graph.add("highpass", "f=80")
            eq_warm = graph.add("equalizer", "f=250:width_type=o:width=1:g=2")
            eq_sooth = graph.add("equalizer", "f=3500:width_type=o:width=1:g=-1.5")
            comp = graph.add("acompressor", "threshold=0.12:ratio=2.5:attack=20:release=250")
            reverb = graph.add("aecho", "0.8:0.88:25:0.04")
            sink = graph.add("abuffersink")

            src.link_to(hp)
            hp.link_to(eq_warm)
            eq_warm.link_to(eq_sooth)
            eq_sooth.link_to(comp)
            comp.link_to(reverb)
            reverb.link_to(sink)
            graph.configure()

            out_buf = io.BytesIO()
            out_container = av.open(out_buf, mode="w", format="mp3")
            out_stream = out_container.add_stream("mp3", rate=sample_rate)

            for frame in in_container.decode(in_stream):
                graph.push(frame)
                while True:
                    try:
                        filtered_frame = graph.pull()
                        for packet in out_stream.encode(filtered_frame):
                            out_container.mux(packet)
                    except (av.BlockingIOError, av.EOFError, StopIteration):
                        break

            graph.push(None)
            while True:
                try:
                    filtered_frame = graph.pull()
                    for packet in out_stream.encode(filtered_frame):
                        out_container.mux(packet)
                except (av.BlockingIOError, av.EOFError, StopIteration):
                    break

            for packet in out_stream.encode():
                out_container.mux(packet)

            out_container.close()
            in_container.close()

            mastered_data = out_buf.getvalue()
            if len(mastered_data) > 1000:
                logger.info("[PodcastEngine] Mastering audio PyAV appliqué avec succès (%d -> %d octets)", len(mp3_bytes), len(mastered_data))
                return mastered_data
            return mp3_bytes

        except Exception as e:
            logger.warning("[PodcastEngine] Échec du mastering audio DSP (fallback audio brut) : %s", e)
            return mp3_bytes

    @classmethod
    def load_soundpack_manifest(cls) -> Dict[str, Any]:
        """Charge le catalogue soundpack.json des musiques, jingles et ambiances."""
        try:
            manifest_path = resolve_data_path("audio", "soundpack.json")
            if os.path.exists(manifest_path):
                with open(manifest_path, "r", encoding="utf-8") as f:
                    return json.load(f)
        except Exception as e:
            logger.error("[PodcastEngine] Erreur lecture soundpack.json : %s", e)
        return {"tracks": []}

    @classmethod
    def resolve_soundpack_track_path(cls, track_id: Optional[str]) -> Optional[str]:
        """Résout le chemin absolu du fichier audio pour une piste du soundpack."""
        if not track_id or track_id in ("none", "null", "false", ""):
            return None
        manifest = cls.load_soundpack_manifest()
        for tr in manifest.get("tracks", []):
            if tr.get("id") == track_id:
                rel_file = tr.get("file", "")
                full_path = resolve_data_path("audio", rel_file)
                if os.path.exists(full_path):
                    return full_path
                logger.warning("[PodcastEngine] Fichier audio soundpack manquant pour %s : %s", track_id, full_path)
                return None
    @classmethod
    def detect_contextual_sfx(
        cls,
        subject: str = "",
        title: str = "",
        summary: str = "",
        dialogue: Optional[List[Dict[str, Any]]] = None
    ) -> str:
        """
        Détecte automatiquement l'ambiance sonore contextuelle la plus appropriée
        en fonction du passage biblique, du sujet, du titre, du résumé et des répliques.
        """
        corpus = f"{subject} {title} {summary}".lower()
        if dialogue:
            dialogue_sample = " ".join([d.get("text", "") for d in dialogue[:8]]).lower()
            corpus += " " + dialogue_sample

        # 1. Reniement de Pierre / Chant du coq (expressions explicites uniquement pour éviter toute fausse détection sur "pierre/rocher")
        if any(w in corpus for w in ["chant du coq", "le coq", "coq chanta", "avant que le coq", "renie trois fois", "reniement de pierre"]):
            return "sfx_rooster_crow"
        # 2. Jean-Baptiste / Désert / Jourdain / Baptême (Luc 3, Matthieu 3, Marc 1...)
        if any(w in corpus for w in ["jean-baptiste", "jean baptiste", "luc 3", "luc 1", "matthieu 3", "marc 1", "désert", "desert", "aride", "voix au désert", "sauvage", "solitude", "jourdain", "baptême"]):
            return "sfx_desert_wind"
        # 3. Contexte hostile / Procès / Pilate / Émeute / Condamnation / Foule agitée
        if any(w in corpus for w in ["foule en colère", "crucifie", "pilate", "ponce pilate", "clameur", "émeute", "tribunal", "condamne", "barabbas"]):
            return "sfx_angry_crowd"
        # 4. Temple / Synagogue / Jérusalem / Foule attentive / Siloé / Parvis
        if any(w in corpus for w in ["temple", "parvis", "synagogue", "jérusalem", "jerusalem", "siloé", "siloe", "tour de siloé", "foule", "assemblée", "multitude", "auditoire", "auditeurs"]):
            return "sfx_crowd_murmur"
        # 5. Marché antique / Ruelles urbaines / Marchands
        if any(w in corpus for w in ["marché", "marche ", "ruelle", "ruelles", "ville", "place publique", "marchand"]):
            return "sfx_ancient_marketplace"
        # 6. Mer / Lac / Barque / Pêche / Tempête (restreint à la mer ou bord de l'eau, exclut 'galilée' isolé)
        if any(w in corpus for w in ["mer de galilée", "lac de galilée", "mer de tibériade", "lac de gênésareth", "mer", "barque", "pêche", "tempête", "ressac", "rivage", "lac", "tibériade", "filets", "eau"]):
            return "sfx_ocean_shore_waves"
        # 7. Feu de camp / Veillée nocturne
        if any(w in corpus for w in ["feu", "braise", "foyer", "camp", "veillée", "flamme"]):
            return "sfx_campfire_crackle"
        # 8. Brebis / Troupeau / Berger
        if any(w in corpus for w in ["brebis", "berger", "pâturage", "troupeau", "agneau", "pâtre"]):
            return "sfx_sheep_flock_bells"
        # 9. Marche / Sentier d'Emmaüs
        if any(w in corpus for w in ["marche", "sentier", "voyage", "chemin", "route d'emmaüs", "emmaüs"]):
            return "sfx_footsteps_trail"
        # 10. Nuit / Gethsémané / Grillons
        if any(w in corpus for w in ["nuit", "gethsémané", "grillon", "étoile", "prière", "soir"]):
            return "sfx_night_crickets"

        # Valeur contextuelle par défaut : vent désertique doux
        return "sfx_desert_wind"

    @classmethod
    def mix_voice_with_soundpack(
        cls,
        speech_mp3_bytes: bytes,
        dialogue_timestamps: List[Dict[str, Any]],
        bg_music_path: Optional[str] = None,
        jingle_intro_path: Optional[str] = None,
        sfx_path: Optional[str] = None,
        options: Optional[Dict[str, Any]] = None,
        sample_rate: int = 24000
    ) -> Tuple[bytes, List[Dict[str, Any]], float]:
        """
        Mixe la voix principale avec le jingle d'introduction, la nappe musicale d'ambiance et les bruitages (SFX)
        en appliquant un Ducking professionnel (sidechain) :
        - Jingle : démarre à 0s, joue seul en amorce (lead-in), puis s'estompe sous l'entrée de la voix.
        - Voix : commence précisément après lead_in_sec (mise à jour absolue des timestamps karaoké).
        - Musique de fond : atténuée à ducking_db (-16 dB) sous la parole, remonte doucement (+6 dB)
          lors des pauses et respirations, puis crescendo final et fondu de sortie lors de l'outro.
        - Bruitages (SFX) : ambiance sonore contextuelle équilibrée en boucle et fondue naturellement.
        """
        if not bg_music_path and not jingle_intro_path and not sfx_path:
            return speech_mp3_bytes, dialogue_timestamps, 0.0

        try:
            import io
            import av
            import numpy as np

            opts = options or {}
            ducking_db = float(opts.get("ducking_db", -30.0))
            duck_gain = 10.0 ** (ducking_db / 20.0)
            swell_gain = 10.0 ** ((ducking_db + 8.0) / 20.0)
            intro_gain = 10.0 ** (float(opts.get("intro_gain_db", -2.5)) / 20.0)
            music_timing = str(opts.get("music_timing", "intro_outro")).strip().lower()
            music_intro_sec = float(opts.get("music_intro_sec", 10.0))

            def _load_stereo(audio_input):
                if isinstance(audio_input, (bytes, bytearray)):
                    container = av.open(io.BytesIO(audio_input))
                else:
                    container = av.open(audio_input)
                resampler = av.AudioResampler(format='fltp', layout='stereo', rate=sample_rate)
                frames = []
                for frame in container.decode(audio=0):
                    frame.pts = None
                    for resampled in resampler.resample(frame):
                        frames.append(resampled.to_ndarray())
                container.close()
                if not frames:
                    return np.zeros((2, 0), dtype=np.float32)
                return np.concatenate(frames, axis=1)

            speech = _load_stereo(speech_mp3_bytes)
            speech_len = speech.shape[1]
            if speech_len == 0:
                return speech_mp3_bytes, dialogue_timestamps, 0.0

            has_jingle = bool(jingle_intro_path and os.path.exists(jingle_intro_path))
            has_music = bool(bg_music_path and os.path.exists(bg_music_path))
            
            # Si jingle ou musique présents : amorce musicale de 10 secondes pour poser l'ambiance
            lead_in_sec = 10.0 if (has_jingle or has_music) else 0.5
            lead_in_samples = int(lead_in_sec * sample_rate)
            outro_tail_sec = 3.5 if (bg_music_path or has_jingle or sfx_path) else 0.5
            outro_tail_samples = int(outro_tail_sec * sample_rate)

            total_samples = lead_in_samples + speech_len + outro_tail_samples
            total_dur_sec = total_samples / sample_rate

            # 1. Piste voix décalée
            voice_track = np.zeros((2, total_samples), dtype=np.float32)
            voice_track[:, lead_in_samples:lead_in_samples + speech_len] = speech

            # Décalage rigoureux des horodatages pour le suivi karaoké visuel
            shifted_dialogue = []
            for it in dialogue_timestamps:
                d = dict(it)
                if "start_time" in d:
                    d["start_time"] = round(float(d["start_time"]) + lead_in_sec, 3)
                if "end_time" in d:
                    d["end_time"] = round(float(d["end_time"]) + lead_in_sec, 3)
                shifted_dialogue.append(d)

            # 2. Piste Jingle (joue en solo, puis s'estompe sur les 2s précédant l'entrée de la voix)
            jingle_track = np.zeros((2, total_samples), dtype=np.float32)
            if has_jingle:
                jingle = _load_stereo(jingle_intro_path)
                j_len = min(jingle.shape[1], total_samples)
                jingle_fade_start = max(0, lead_in_samples - int(2.0 * sample_rate))
                jingle_fade_end = min(lead_in_samples, j_len)
                jingle_env = np.ones(j_len, dtype=np.float32) * intro_gain
                if jingle_fade_end > jingle_fade_start:
                    fade_len = jingle_fade_end - jingle_fade_start
                    jingle_env[jingle_fade_start:jingle_fade_end] = np.linspace(intro_gain, 0.0, fade_len)
                if j_len > jingle_fade_end:
                    jingle_env[jingle_fade_end:] = 0.0
                jingle_track[:, :j_len] = jingle[:, :j_len] * jingle_env

            # 3. Piste Musique d'ambiance avec Ducking sidechain et fondu d'extinction
            music_track = np.zeros((2, total_samples), dtype=np.float32)
            if bg_music_path and os.path.exists(bg_music_path):
                music = _load_stereo(bg_music_path)
                m_len = music.shape[1]
                if m_len > 0:
                    idx = 0
                    while idx < total_samples:
                        take = min(m_len, total_samples - idx)
                        music_track[:, idx:idx + take] = music[:, :take]
                        idx += take

                    speech_end_samp = lead_in_samples + speech_len
                    fade_out_start = lead_in_samples + int(music_intro_sec * sample_rate)
                    fade_out_end = min(total_samples, fade_out_start + int(4.0 * sample_rate))
                    outro_in_start = max(fade_out_end, speech_end_samp - int(3.5 * sample_rate))

                    if music_timing == "intro_outro" and outro_in_start > fade_out_end:
                        # Mode Recommandé :
                        # - 0s à 8s : musique à plein volume pour poser l'ambiance
                        # - 8s à 10s : descente progressive (2s avant la parole) vers le niveau ducké (-30 dB)
                        # - 10s à 20s (10s de parole) : ducking feutré sous les premières répliques
                        # - 20s à 24s : fondu d'extinction vers le silence complet
                        # - Outro : retour musical sous les dernières paroles et crescendo de fin
                        env = np.zeros(total_samples, dtype=np.float32)

                        if has_jingle:
                            # Strictement aucun son de musique pendant le jingle !
                            # Le jingle joue seul en amorce de 0s à 10s (avec descente à 8s).
                            # La musique n'entre qu'après le jingle, en fondu doux direct vers le niveau ducké (-30 dB)
                            music_fade_in_len = min(int(2.0 * sample_rate), max(0, fade_out_start - lead_in_samples))
                            if music_fade_in_len > 0:
                                env[lead_in_samples:lead_in_samples + music_fade_in_len] = np.linspace(0.0, duck_gain, music_fade_in_len)
                            if fade_out_start > (lead_in_samples + music_fade_in_len):
                                env[lead_in_samples + music_fade_in_len:fade_out_start] = duck_gain
                        else:
                            # Amorce solo (0s à 8s) sans jingle : la musique pose seule le décor
                            intro_ramp_down_start = max(0, lead_in_samples - int(2.0 * sample_rate))
                            intro_ramp_in = min(int(1.5 * sample_rate), intro_ramp_down_start)
                            if intro_ramp_in > 0:
                                env[:intro_ramp_in] = np.linspace(0.0, intro_gain, intro_ramp_in)
                                env[intro_ramp_in:intro_ramp_down_start] = intro_gain
                            else:
                                env[:intro_ramp_down_start] = intro_gain

                            # Descente de 2 secondes avant l'arrivée de la voix (8s à 10s)
                            if lead_in_samples > intro_ramp_down_start:
                                env[intro_ramp_down_start:lead_in_samples] = np.linspace(intro_gain, duck_gain, lead_in_samples - intro_ramp_down_start)

                            # Sous la voix pendant 10 secondes (10s à 20s) : ducking feutré (-30 dB)
                            env[lead_in_samples:fade_out_start] = duck_gain

                        # Fondu d'extinction progressif (20s à 24s)
                        if fade_out_end > fade_out_start:
                            env[fade_out_start:fade_out_end] = np.linspace(duck_gain, 0.0, fade_out_end - fade_out_start)

                        # Le corps central reste à 0.0 (Silence musical pour la pureté de l'exégèse)

                        # Outro : remontée en douceur sous les dernières paroles puis swell final
                        if speech_end_samp > outro_in_start:
                            env[outro_in_start:speech_end_samp] = np.linspace(0.0, duck_gain, speech_end_samp - outro_in_start)

                        outro_swell_end = min(total_samples, speech_end_samp + int(2.5 * sample_rate))
                        if outro_swell_end > speech_end_samp:
                            env[speech_end_samp:outro_swell_end] = np.linspace(duck_gain, swell_gain * 1.5, outro_swell_end - speech_end_samp)

                        if total_samples > outro_swell_end:
                            env[outro_swell_end:] = np.linspace(swell_gain * 1.5, 0.0, total_samples - outro_swell_end)

                    else:
                        # Mode continu : ambiance en nappe sur tout l'épisode avec ducking feutré (-30 dB) sous chaque parole
                        env = np.full(total_samples, swell_gain, dtype=np.float32)

                        if has_jingle:
                            # Silence musical complet pendant le jingle (0s à 10s)
                            env[:lead_in_samples] = 0.0
                            # Entrée progressive vers le niveau ducké (-30 dB) au début de la voix
                            fade_in_len = min(int(2.0 * sample_rate), speech_len)
                            if fade_in_len > 0:
                                env[lead_in_samples:lead_in_samples + fade_in_len] = np.linspace(0.0, duck_gain, fade_in_len)
                        else:
                            # Descente de 2 secondes avant l'arrivée de la voix
                            intro_ramp_down_start = max(0, lead_in_samples - int(2.0 * sample_rate))
                            env[:intro_ramp_down_start] = intro_gain
                            if lead_in_samples > intro_ramp_down_start:
                                env[intro_ramp_down_start:lead_in_samples] = np.linspace(intro_gain, duck_gain, lead_in_samples - intro_ramp_down_start)

                        # Ducking sous chaque réplique avec attack / release douces
                        for item in shifted_dialogue:
                            s_samp = max(0, int(float(item.get("start_time", 0.0)) * sample_rate))
                            e_samp = min(total_samples, int(float(item.get("end_time", 0.0)) * sample_rate))
                            att_samp = int(0.15 * sample_rate)
                            rel_samp = int(0.35 * sample_rate)
                            s_att = max(0, s_samp - att_samp)
                            e_rel = min(total_samples, e_samp + rel_samp)
                            env[s_samp:e_samp] = duck_gain
                            if s_samp > s_att and s_att >= lead_in_samples:
                                env[s_att:s_samp] = np.linspace(env[s_att], duck_gain, s_samp - s_att)
                            if e_rel > e_samp:
                                env[e_samp:e_rel] = np.linspace(duck_gain, swell_gain, e_rel - e_samp)

                        # Outro final
                        speech_end_samp = lead_in_samples + speech_len
                        outro_start = speech_end_samp
                        outro_swell_end = min(total_samples, outro_start + int(2.0 * sample_rate))
                        fade_out_start = outro_swell_end
                        if outro_swell_end > outro_start:
                            env[outro_start:outro_swell_end] = np.linspace(duck_gain, swell_gain * 1.5, outro_swell_end - outro_start)
                        if total_samples > fade_out_start:
                            env[fade_out_start:] = np.linspace(env[fade_out_start], 0.0, total_samples - fade_out_start)

                    music_track *= env

            # 3b. Piste Bruitage d'ambiance contextuel (SFX)
            sfx_track = np.zeros((2, total_samples), dtype=np.float32)
            if sfx_path and os.path.exists(sfx_path):
                sfx_audio = _load_stereo(sfx_path)
                s_len = sfx_audio.shape[1]
                if s_len > 0:
                    s_dur = s_len / sample_rate
                    # Vérifier s'il s'agit d'un effet ponctuel (Spot SFX, durée <= 15s) ou d'une nappe continue
                    is_spot_sfx = (s_dur <= 15.0)

                    if is_spot_sfx:
                        # Effet ponctuel (ex: coq, feu de camp, pas, brebis) :
                        # NE DOIT JAMAIS ÊTRE BOUCLÉ ! Joué UNE SEULE FOIS en illustration au démarrage
                        spot_start = int(0.5 * sample_rate)
                        spot_end = min(total_samples, spot_start + s_len)
                        spot_len = spot_end - spot_start
                        if spot_len > 0:
                            sfx_gain = 10.0 ** (-12.0 / 20.0)
                            spot_env = np.ones(spot_len, dtype=np.float32) * sfx_gain
                            fade_s = min(spot_len // 4, int(0.4 * sample_rate))
                            if fade_s > 0:
                                spot_env[:fade_s] = np.linspace(0.0, sfx_gain, fade_s)
                                spot_env[-fade_s:] = np.linspace(sfx_gain, 0.0, fade_s)
                            sfx_track[:, spot_start:spot_end] = sfx_audio[:, :spot_len] * spot_env
                    else:
                        # Nappe d'ambiance continue (vent, ressac marin, grillons...)
                        s_idx = 0
                        while s_idx < total_samples:
                            take = min(s_len, total_samples - s_idx)
                            sfx_track[:, s_idx:s_idx + take] = sfx_audio[:, :take]
                            s_idx += take

                        sfx_gain = 10.0 ** (-12.0 / 20.0)
                        if music_timing == "intro_outro":
                            # S'estompe après l'introduction pour ne pas encombrer l'exégèse
                            fade_start = lead_in_samples + int(music_intro_sec * sample_rate)
                            fade_end = min(total_samples, fade_start + int(4.0 * sample_rate))
                            sfx_env = np.zeros(total_samples, dtype=np.float32)
                            sfx_env[:fade_start] = sfx_gain
                            if fade_end > fade_start:
                                sfx_env[fade_start:fade_end] = np.linspace(sfx_gain, 0.0, fade_end - fade_start)
                            # Fondu d'entrée doux
                            in_ramp = min(fade_start, int(1.5 * sample_rate))
                            if in_ramp > 0:
                                sfx_env[:in_ramp] = np.linspace(0.0, sfx_gain, in_ramp)
                            sfx_track *= sfx_env
                        else:
                            sfx_track *= sfx_gain
                            sfx_fade = min(total_samples, int(1.5 * sample_rate))
                            if sfx_fade > 0:
                                sfx_track[:, :sfx_fade] *= np.linspace(0.0, 1.0, sfx_fade)
                                sfx_track[:, -sfx_fade:] *= np.linspace(1.0, 0.0, sfx_fade)

            # 4. Mixage final stéréo avec soft-clipping et encodage MP3
            mixed = np.clip(voice_track + jingle_track + music_track + sfx_track, -1.0, 1.0)

            out_buf = io.BytesIO()
            container = av.open(out_buf, mode='w', format='mp3')
            stream = container.add_stream('mp3', rate=sample_rate)
            stream.bit_rate = int(opts.get("bitrate", 96000))
            stream.layout = 'stereo'

            frame_size = 1152
            for i in range(0, total_samples, frame_size):
                chunk = mixed[:, i:min(i + frame_size, total_samples)]
                if chunk.shape[1] < frame_size:
                    pad = np.zeros((chunk.shape[0], frame_size - chunk.shape[1]), dtype=np.float32)
                    chunk = np.concatenate([chunk, pad], axis=1)
                frame = av.AudioFrame.from_ndarray(chunk, format='fltp', layout='stereo')
                frame.rate = sample_rate
                for packet in stream.encode(frame):
                    container.mux(packet)

            for packet in stream.encode(None):
                container.mux(packet)
            container.close()

            return out_buf.getvalue(), shifted_dialogue, round(total_dur_sec, 2)
        except Exception as e:
            logger.error("[PodcastEngine] Erreur lors du mixage soundpack & ducking : %s", e)
            return speech_mp3_bytes, dialogue_timestamps, 0.0

    @classmethod
    def synthesize_audio(
        cls,
        podcast_id: str,
        script_dialogue: Optional[List[Dict[str, Any]]] = None,
        engine: Optional[str] = None,
        custom_options: Optional[Dict[str, Any]] = None,
        progress_callback: Optional[Callable[[int, int, str], None]] = None
    ) -> Dict[str, Any]:
        """
        Synthétise l'audio pour un script donné (avec support de l'édition manuelle préalable).
        Calcule les horodatages exacts (karaoké), applique le mastering studio DSP,
        puis mixe les éléments du soundpack (musique d'ambiance, jingle, ducking).
        """
        record = PodcastHistory.get(podcast_id)
        if not record:
            f_val = (custom_options.get("format_type") or custom_options.get("format")) if custom_options else "dialogue"
            record = {
                "id": podcast_id,
                "title": "Script Audio",
                "format": f_val,
                "format_type": f_val,
                "created_at": datetime.datetime.now().isoformat(),
                "script_dialogue": script_dialogue or []
            }
            PodcastHistory.upsert(record)
        elif custom_options and ("format_type" in custom_options or "format" in custom_options):
            f_val = custom_options.get("format_type") or custom_options.get("format")
            record["format"] = f_val
            record["format_type"] = f_val
            PodcastHistory.upsert(record)

        cfg = load_config()
        dialogue = script_dialogue if script_dialogue is not None else record.get("dialogue", [])
        if not dialogue:
            raise Exception("Le script ne contient aucune réplique à synthétiser.")

        chosen_engine = engine or record.get("engine") or cfg.get("audio_studio_engine", "edge_tts")
        opts = custom_options or {}
        engine_mode = opts.get("engine_mode") or cfg.get("audio_studio_engine_mode", "single")

        if chosen_engine == "mixed" or engine_mode == "mixed":
            res = cls._synthesize_mixed_engines(podcast_id, record, dialogue, opts, cfg, progress_callback)
        elif chosen_engine == "gemini_tts":
            res = cls._synthesize_gemini_tts(podcast_id, record, dialogue, opts, cfg, progress_callback)
        elif chosen_engine == "voxtral":
            res = cls._synthesize_voxtral(podcast_id, record, dialogue, opts, cfg, progress_callback)
        else:
            res = cls._synthesize_edge_tts(podcast_id, record, dialogue, opts, cfg, progress_callback)

        # Mixage soundpack (ambiance musicale et/ou jingle d'introduction avec ducking sidechain)
        log_file = os.path.join(get_podcasts_dir(), "audio_studio_mix.log")
        def _audit_log(msg: str):
            try:
                now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                with open(log_file, "a", encoding="utf-8") as f_log:
                    f_log.write(f"[{now_str}] {msg}\n")
            except Exception:
                pass

        # Flags explicites de contrôle et prise en compte du déroulé frontend WYSIWYG
        incoming_audio_events = opts.get("audio_events")

        music_enabled = opts.get("music_enabled")
        jingle_enabled = opts.get("jingle_enabled")
        sfx_enabled = opts.get("sfx_enabled")

        bg_music_id = opts.get("bg_music")
        jingle_intro_id = opts.get("jingle_intro")
        sfx_ambient_id = opts.get("sfx_ambient") or opts.get("sfx")

        if isinstance(incoming_audio_events, list):
            has_music_event = any(e.get("type") in ("fade_out", "fadeout", "outro", "outro_music") for e in incoming_audio_events)
            has_jingle_event = any(e.get("type") in ("music", "intro", "intro_music") for e in incoming_audio_events)
            has_sfx_event = any(e.get("type") == "sfx" for e in incoming_audio_events)

            if not has_jingle_event:
                jingle_enabled = False
                jingle_intro_id = None
            else:
                jingle_enabled = True
                j_ev = next((e for e in incoming_audio_events if e.get("type") in ("music", "intro", "intro_music") and e.get("track_id")), None)
                if j_ev and j_ev.get("track_id") not in ("none", "", None):
                    jingle_intro_id = j_ev.get("track_id")
                else:
                    jingle_intro_id = cfg.get("audio_studio_jingle_intro", "jingle_piano_solemn")

            if not has_music_event:
                music_enabled = False
                bg_music_id = None
            else:
                music_enabled = True
                bg_ev = next((e for e in incoming_audio_events if e.get("type") in ("fade_out", "fadeout", "outro", "outro_music") and e.get("track_id")), None)
                if bg_ev and bg_ev.get("track_id") not in ("none", "", None):
                    bg_music_id = bg_ev.get("track_id")
                else:
                    bg_music_id = cfg.get("audio_studio_bg_music", "bed_cozy_jazz_study")

            if not has_sfx_event:
                sfx_enabled = False
                sfx_ambient_id = None
            else:
                sfx_enabled = True
                sfx_ev = next((e for e in incoming_audio_events if e.get("type") == "sfx" and e.get("track_id")), None)
                if sfx_ev and sfx_ev.get("track_id") not in ("none", "", None, "auto"):
                    sfx_ambient_id = sfx_ev.get("track_id")
                elif not sfx_ambient_id or sfx_ambient_id == "none":
                    sfx_ambient_id = "auto"

        # Résolution selon les drapeaux booléens
        if music_enabled is False:
            bg_music_id = None
        else:
            if bg_music_id is None:
                bg_music_id = cfg.get("audio_studio_bg_music", "bed_cozy_jazz_study")

        if jingle_enabled is False:
            jingle_intro_id = None
        else:
            if jingle_intro_id is None:
                jingle_intro_id = cfg.get("audio_studio_jingle_intro", "jingle_piano_solemn")

        if sfx_enabled is False or sfx_ambient_id in ("none", "null", "false", ""):
            sfx_ambient_id = None
        else:
            # Détection automatique contextuelle si auto ou activé
            if sfx_ambient_id in ("auto", None) or sfx_enabled is True:
                sfx_ambient_id = cls.detect_contextual_sfx(
                    subject=record.get("subject", ""),
                    title=record.get("title", ""),
                    summary=record.get("summary", ""),
                    dialogue=dialogue
                )

        # Choix explicite "none"
        if bg_music_id in ("none", "", "null", False):
            bg_music_id = None
        if jingle_intro_id in ("none", "", "null", False):
            jingle_intro_id = None
        if sfx_ambient_id in ("none", "", "null", False):
            sfx_ambient_id = None

        ducking_enabled = opts.get("ducking_enabled", cfg.get("audio_studio_ducking_enabled", True))
        ducking_db = float(opts.get("ducking_db", cfg.get("audio_studio_ducking_db", -30.0)))

        bg_path = cls.resolve_soundpack_track_path(bg_music_id) if bg_music_id else None
        jingle_path = cls.resolve_soundpack_track_path(jingle_intro_id) if jingle_intro_id else None
        sfx_path = cls.resolve_soundpack_track_path(sfx_ambient_id) if sfx_ambient_id else None

        _audit_log(f"START: Mixage podcast={podcast_id} | bg={bg_music_id} ({bg_path}) | jingle={jingle_intro_id} ({jingle_path}) | sfx={sfx_ambient_id} ({sfx_path}) | ducking={ducking_enabled} ({ducking_db}dB)")
        logger.info("[PodcastEngine] Préparation mixage audio : bg=%s (%s), jingle=%s (%s), sfx=%s (%s), ducking=%s (-%.1f dB)",
                    bg_music_id, bg_path, jingle_intro_id, jingle_path, sfx_ambient_id, sfx_path, ducking_enabled, ducking_db)

        if bg_path or jingle_path or sfx_path:
            audio_path = os.path.join(get_podcasts_dir(), res.get("audio_file", f"{podcast_id}.mp3"))
            if os.path.exists(audio_path):
                if progress_callback:
                    total_l = len(res.get("dialogue", []))
                    progress_callback(total_l, 96, "Mixage sonore de l'émission (ambiance, jingle, bruitages & ducking)...")
                try:
                    with open(audio_path, "rb") as f:
                        speech_bytes = f.read()

                    _audit_log(f"VOICE: Lu {len(speech_bytes)} octets de voix brute depuis {audio_path}")

                    mix_opts = {
                        "ducking_db": ducking_db if ducking_enabled else -12.0,
                        "music_timing": opts.get("music_timing", cfg.get("audio_studio_music_timing", "intro_outro")),
                        "music_intro_sec": float(opts.get("music_intro_sec", cfg.get("audio_studio_music_intro_sec", 10.0))),
                        "bitrate": 96000
                    }
                    mixed_bytes, shifted_dialogue, total_dur = cls.mix_voice_with_soundpack(
                        speech_mp3_bytes=speech_bytes,
                        dialogue_timestamps=res.get("dialogue", []),
                        bg_music_path=bg_path,
                        jingle_intro_path=jingle_path,
                        sfx_path=sfx_path,
                        options=mix_opts
                    )
                    if total_dur > 0 and len(mixed_bytes) > 1000:
                        with open(audio_path, "wb") as f:
                            f.write(mixed_bytes)
                        res["dialogue"] = shifted_dialogue
                        res["script_dialogue"] = shifted_dialogue
                        res["duration_seconds"] = total_dur
                        res["bg_music"] = bg_music_id or "none"
                        res["jingle_intro"] = jingle_intro_id or "none"
                        res["sfx_ambient"] = sfx_ambient_id or "none"
                        res["ducking_enabled"] = ducking_enabled

                        # Construction de la timeline des événements audio pour affichage dans le déroulé (colonne gauche)
                        lead_in = 10.0 if (jingle_path or bg_path) else 0.5
                        audio_events = []
                        if jingle_path or bg_path:
                            if jingle_path:
                                j_title = "Jingle d'ouverture"
                                j_desc = "Jingle solo (10s), descente douce à 00:08 avant la voix"
                                j_track = jingle_intro_id or "jingle_piano_solemn"
                            else:
                                j_title = "Ambiance musicale d'ouverture"
                                j_desc = "Amorce musicale solo (10s), descente douce à 00:08 avant la voix"
                                j_track = bg_music_id or "bed_cozy_jazz_study"
                            audio_events.append({
                                "id": "event_intro_music",
                                "type": "music",
                                "title": j_title,
                                "label": "00:00 – 00:10",
                                "description": j_desc,
                                "start_time": 0.0,
                                "end_time": lead_in,
                                "icon": "music",
                                "track_id": j_track
                            })
                        if sfx_path and sfx_ambient_id:
                            sfx_name = "Vent du Désert" if "desert" in sfx_ambient_id else sfx_ambient_id
                            audio_events.append({
                                "id": "event_sfx_ambient",
                                "type": "sfx",
                                "title": f"Bruitage contextuel : {sfx_name}",
                                "label": f"00:00 – 00:{int(min(lead_in + 10.0, 20.0)):02d}",
                                "description": "Ambiance sonore contextuelle en amorce",
                                "start_time": 0.5,
                                "end_time": round(min(lead_in + 10.0, 20.0), 2),
                                "icon": "wind",
                                "track_id": sfx_ambient_id
                            })
                        if bg_path and mix_opts.get("music_timing") == "intro_outro":
                            fo_start = round(lead_in + mix_opts.get("music_intro_sec", 10.0), 1)
                            audio_events.append({
                                "id": "event_fade_out",
                                "type": "fade_out",
                                "title": "Extinction musicale (Fade-out)",
                                "label": f"{int(fo_start//60):02d}:{int(fo_start%60):02d}",
                                "description": "Silence musical complet pour laisser place à l'écoute de l'exégèse",
                                "start_time": fo_start,
                                "end_time": round(fo_start + 4.0, 1),
                                "icon": "volume-x",
                                "track_id": bg_music_id or "bed_cozy_jazz_study"
                            })
                        if jingle_path or bg_path:
                            outro_t = max(0.0, round(total_dur - 6.0, 1))
                            audio_events.append({
                                "id": "event_outro_music",
                                "type": "outro",
                                "title": "Conclusion & Outro musical",
                                "label": f"{int(outro_t//60):02d}:{int(outro_t%60):02d} – {int(total_dur//60):02d}:{int(total_dur%60):02d}",
                                "description": "Remontée en crescendo de la nappe musicale et fondu final",
                                "start_time": outro_t,
                                "end_time": round(total_dur, 1),
                                "icon": "music",
                                "track_id": bg_music_id or "bed_cozy_jazz_study"
                            })

                        res["audio_events"] = audio_events
                        PodcastHistory.upsert(res)
                        _audit_log(f"SUCCESS: Mixage soundpack terminé avec succès pour {podcast_id} (durée: {total_dur:.2f}s, taille: {len(mixed_bytes)} octets)")
                        logger.info("[PodcastEngine] Mixage soundpack réussi pour %s (durée: %.2fs, taille: %d octets)",
                                    podcast_id, total_dur, len(mixed_bytes))
                        if progress_callback:
                            total_l = len(shifted_dialogue)
                            progress_callback(total_l, 100, f"Épisode finalisé avec soundpack ({cls.format_duration(total_dur)})")
                    else:
                        _audit_log(f"WARNING: Mixage a renvoyé un flux vide ({len(mixed_bytes)} octets)")
                        logger.warning("[PodcastEngine] Mixage soundpack a renvoyé un flux vide, voix d'origine conservée")
                except Exception as e_mix:
                    _audit_log(f"ERROR: Exception lors du mixage soundpack: {e_mix}")
                    logger.error("[PodcastEngine] Erreur mixage soundpack : %s", e_mix, exc_info=True)
                    res["mix_error"] = str(e_mix)
                    PodcastHistory.upsert(res)
            else:
                _audit_log(f"WARNING: Fichier audio introuvable : {audio_path}")
                logger.warning("[PodcastEngine] Fichier audio introuvable pour mixage : %s", audio_path)
        else:
            _audit_log(f"SKIPPED: Aucun habillage sonore demandé (voix pure)")
            res["bg_music"] = "none"
            res["jingle_intro"] = "none"
            res["sfx_ambient"] = "none"
            PodcastHistory.upsert(res)

        return res

    @classmethod
    def _synthesize_edge_tts(
        cls,
        podcast_id: str,
        record: Dict[str, Any],
        dialogue: List[Dict[str, Any]],
        opts: Dict[str, Any],
        cfg: Dict[str, Any],
        progress_callback: Optional[Callable[[int, int, str], None]] = None
    ) -> Dict[str, Any]:
        """Synthèse asynchrone via Microsoft Edge-TTS avec prosodie maîtrisée et mastering audio studio."""
        import edge_tts

        voice_a = opts.get("voice_speaker_a") or cfg.get("audio_studio_voice_speaker_a", "fr-FR-VivienneMultilingualNeural")
        voice_b = opts.get("voice_speaker_b") or cfg.get("audio_studio_voice_speaker_b", "fr-CH-FabriceNeural")
        voice_solo = opts.get("voice_solo") or cfg.get("audio_studio_voice_solo", "fr-CH-FabriceNeural")

        # Options de prosodie (débit, hauteur, respirations)
        calm_prosody = opts.get("calm_prosody", cfg.get("audio_studio_calm_prosody", True))
        rate_val = opts.get("rate") or (cfg.get("audio_studio_rate", "-14%") if calm_prosody else "+0%")
        pitch_val = opts.get("pitch") or (cfg.get("audio_studio_pitch", "-3Hz") if calm_prosody else "+0Hz")
        inject_breaks = opts.get("inject_breaks", cfg.get("audio_studio_inject_breaks", True)) if calm_prosody else False
        mastering_enabled = opts.get("mastering_enabled", cfg.get("audio_studio_mastering_enabled", True))

        total_lines = len(dialogue)
        accumulated_audio = bytearray()
        updated_dialogue = []
        current_timeline_sec = 0.0

        async def _run_edge_synthesis():
            nonlocal accumulated_audio, current_timeline_sec, updated_dialogue

            for idx, item in enumerate(dialogue):
                if progress_callback:
                    pct = int(8 + (idx / max(total_lines, 1)) * 80)
                    speaker_label = item.get("speaker_name", f"Locuteur {item.get('voice_role', 'A')}")
                    progress_callback(idx + 1, pct, f"Synthèse réplique {idx + 1}/{total_lines} ({speaker_label})...")

                text = item.get("text", "").strip()
                speech_text = (item.get("speech_text") or "").strip()
                if not text and not speech_text:
                    continue

                v_role = str(item.get("voice_role", "")).upper()
                spk = str(item.get("speaker", "")).lower()
                fmt = str(record.get("format_type") or record.get("format") or "").lower()

                # Sélection rigoureuse de la voix selon rôle ou locuteur
                if fmt == "solo" and v_role != "B" and not any(k in spk for k in ("scholar", "théolog", "exég")):
                    chosen_voice = voice_solo
                elif v_role in ("B", "SCHOLAR") or any(k in spk for k in ("scholar", "théologien", "theologien", "exégète", "exegete", "chercheur", "henri")):
                    chosen_voice = voice_b
                elif v_role in ("A", "HOST", "ANIMATEUR") or any(k in spk for k in ("host", "animateur", "animatrice", "denise")):
                    chosen_voice = voice_a
                else:
                    # En dernier recours : alternance A/B selon la position de la réplique
                    chosen_voice = voice_a if (idx % 2 == 0) else voice_b

                # Nettoyage phonétique basé sur speech_text prioritaire si édité manuellement, sinon text
                clean_speech_text = cls._clean_text_for_speech(speech_text if speech_text else text)

                # Injection de micro-pauses SSML de respiration si activé
                if inject_breaks:
                    clean_speech_text = cls._inject_speech_prosody_breaks(clean_speech_text)

                communicate = edge_tts.Communicate(
                    clean_speech_text,
                    chosen_voice,
                    rate=rate_val,
                    pitch=pitch_val
                )
                line_audio = bytearray()
                line_duration = 0.0

                async for chunk in communicate.stream():
                    if chunk["type"] == "audio":
                        line_audio.extend(chunk["data"])
                    elif chunk["type"] == "SentenceBoundary":
                        # Calculer la durée maximale rapportée par le flux
                        chunk_dur = (chunk["offset"] + chunk["duration"]) / 10000000.0
                        if chunk_dur > line_duration:
                            line_duration = chunk_dur

                # Si SentenceBoundary n'a pas fourni de durée fiable, estimer par le bitrate (48 kbps = 6000 o/s)
                if line_duration <= 0.0 and len(line_audio) > 0:
                    line_duration = len(line_audio) / 6000.0

                start_t = round(current_timeline_sec, 3)
                end_t = round(start_t + line_duration, 3)

                accumulated_audio.extend(line_audio)

                # Pause après la réplique
                pause_ms = int(item.get("pause_after_ms", cfg.get("audio_studio_pause_ms", 350)))
                pause_sec = pause_ms / 1000.0
                current_timeline_sec = end_t + pause_sec

                # Injecter quelques trames MP3 silencieuses pour la pause si supérieure à 100ms
                if pause_ms >= 100:
                    silence_frames = cls._generate_mp3_silence(pause_ms)
                    accumulated_audio.extend(silence_frames)

                new_item = dict(item)
                new_item["start_time"] = start_t
                new_item["end_time"] = end_t
                new_item["text"] = text
                new_item["speech_text"] = speech_text if speech_text else clean_speech_text
                updated_dialogue.append(new_item)

        # Exécuter la coroutine asynchrone
        try:
            asyncio.run(_run_edge_synthesis())
        except Exception as e:
            logger.error("[PodcastEngine] Erreur synthèse Edge-TTS : %s", e)
            raise Exception(f"Erreur lors de la synthèse vocale Edge-TTS : {str(e)}")

        if progress_callback:
            progress_callback(total_lines, 90, "Consolidation et mastering du fichier audio...")

        final_audio = bytes(accumulated_audio)
        if mastering_enabled and len(accumulated_audio) > 1000:
            if progress_callback:
                progress_callback(total_lines, 94, "Application du mastering studio (égalisation, compression & micro-acoustique)...")
            final_audio = cls.apply_audio_mastering(final_audio, {"mastering_enabled": True})

        if progress_callback:
            progress_callback(total_lines, 98, "Sauvegarde du podcast...")

        # Écriture du fichier MP3 consolidé
        audio_filename = f"{podcast_id}.mp3"
        out_path = os.path.join(get_podcasts_dir(), audio_filename)
        with open(out_path, "wb") as f:
            f.write(final_audio)

        total_duration = round(current_timeline_sec, 2)

        # Mettre à jour l'enregistrement d'historique
        record["dialogue"] = updated_dialogue
        record["script_dialogue"] = updated_dialogue
        record["audio_file"] = audio_filename
        record["duration_seconds"] = total_duration
        record["engine"] = "edge_tts"
        record["voice_speaker_a"] = voice_a
        record["voice_speaker_b"] = voice_b
        record["voice_solo"] = voice_solo
        record["status"] = "ready"
        record["updated_at"] = datetime.datetime.now().isoformat()

        PodcastHistory.upsert(record)

        if progress_callback:
            progress_callback(total_lines, 100, f"Épisode finalisé avec succès ({cls.format_duration(total_duration)})")

        return record

    @classmethod
    def _synthesize_voxtral(
        cls,
        podcast_id: str,
        record: Dict[str, Any],
        dialogue: List[Dict[str, Any]],
        opts: Dict[str, Any],
        cfg: Dict[str, Any],
        progress_callback: Optional[Callable[[int, int, str], None]] = None
    ) -> Dict[str, Any]:
        """
        Synthèse vocale neuronale via Mistral Voxtral Speech API (POST /v1/audio/speech).
        Interroge dynamiquement le compte Mistral pour utiliser les voix disponibles (ex: Marie et ses intonations).
        En cas d'absence de clé ou d'indisponibilité momentanée du service, un repli transparent sur Edge-TTS
        est assuré pour garantir la production ininterrompue de l'audio.
        """
        api_key = (cfg.get("mistral_api_key") or "").strip()
        raw_a = opts.get("voxtral_voice_speaker_a") or opts.get("voice_speaker_a") or cfg.get("audio_studio_voxtral_voice_speaker_a", "Marie - Happy")
        raw_b = opts.get("voxtral_voice_speaker_b") or opts.get("voice_speaker_b") or cfg.get("audio_studio_voxtral_voice_speaker_b", "Marie - Neutral")
        raw_solo = opts.get("voxtral_voice_solo") or opts.get("voice_solo") or cfg.get("audio_studio_voxtral_voice_solo", "Marie - Neutral")

        # Fallback global si aucune clé API Mistral n'est configurée
        if not api_key:
            logger.warning("[PodcastEngine] Aucune clé API Mistral configurée pour Voxtral. Repli automatique sur Edge-TTS.")
            mapped_opts = dict(opts)
            mapped_opts["voice_speaker_a"] = cls.VOXTRAL_EMOTION_EDGE_MAP.get(raw_a, "fr-FR-DeniseNeural")
            mapped_opts["voice_speaker_b"] = cls.VOXTRAL_EMOTION_EDGE_MAP.get(raw_b, "fr-FR-HenriNeural")
            mapped_opts["voice_solo"] = cls.VOXTRAL_EMOTION_EDGE_MAP.get(raw_solo, "fr-FR-HenriNeural")

            res = cls._synthesize_edge_tts(podcast_id, record, dialogue, mapped_opts, cfg, progress_callback)
            res["engine"] = "voxtral"
            res["voice_speaker_a"] = raw_a
            res["voice_speaker_b"] = raw_b
            res["voice_solo"] = raw_solo
            record["engine"] = "voxtral"
            record["voice_speaker_a"] = raw_a
            record["voice_speaker_b"] = raw_b
            record["voice_solo"] = raw_solo
            PodcastHistory.upsert(record)
            return res

        # Récupérer les voix disponibles sur le compte Mistral
        voices_list = cls.fetch_voxtral_voices(api_key)

        def _resolve_voxtral_voice_id(v_req: str) -> str:
            return cls.resolve_voxtral_voice_id(v_req, voices_list)

        import httpx

        total_lines = len(dialogue)
        accumulated_audio = bytearray()
        updated_dialogue = []
        current_timeline_sec = 0.0

        for idx, item in enumerate(dialogue):
            if progress_callback:
                pct = int(8 + (idx / max(total_lines, 1)) * 84)
                speaker_label = item.get("speaker_name", f"Locuteur {item.get('voice_role', 'A')}")
                progress_callback(idx + 1, pct, f"Synthèse Voxtral {idx + 1}/{total_lines} ({speaker_label})...")

            text = item.get("text", "").strip()
            if not text:
                continue

            v_role = str(item.get("voice_role", "")).upper()
            spk = str(item.get("speaker", "")).lower()
            fmt = str(record.get("format_type") or record.get("format") or "").lower()

            if fmt == "solo" and v_role != "B" and not any(k in spk for k in ("scholar", "théolog", "exég")):
                chosen_raw_voice = raw_solo
                fallback_edge = cls.VOXTRAL_EMOTION_EDGE_MAP.get(raw_solo, "fr-FR-HenriNeural")
            elif v_role in ("B", "SCHOLAR") or any(k in spk for k in ("scholar", "théologien", "theologien", "exégète", "exegete", "chercheur")):
                chosen_raw_voice = raw_b
                fallback_edge = cls.VOXTRAL_EMOTION_EDGE_MAP.get(raw_b, "fr-FR-HenriNeural")
            elif v_role in ("A", "HOST", "ANIMATEUR") or any(k in spk for k in ("host", "animateur", "animatrice")):
                chosen_raw_voice = raw_a
                fallback_edge = cls.VOXTRAL_EMOTION_EDGE_MAP.get(raw_a, "fr-FR-DeniseNeural")
            else:
                chosen_raw_voice = raw_a if (idx % 2 == 0) else raw_b
                fallback_edge = cls.VOXTRAL_EMOTION_EDGE_MAP.get(chosen_raw_voice, "fr-FR-DeniseNeural" if (idx % 2 == 0) else "fr-FR-HenriNeural")

            target_voice_id = _resolve_voxtral_voice_id(chosen_raw_voice)
            clean_speech_text = cls._clean_text_for_speech(text)

            line_bytes = None
            try:
                headers = {
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                }
                payload = {
                    "model": cls.VOXTRAL_MODEL,
                    "input": clean_speech_text,
                    "voice_id": target_voice_id,
                    "response_format": "mp3"
                }
                resp = httpx.post(f"{cls.VOXTRAL_API_BASE}/audio/speech", headers=headers, json=payload, timeout=60.0)
                if resp.status_code == 200:
                    ct = resp.headers.get("content-type", "")
                    if "application/json" in ct:
                        res_json = resp.json()
                        audio_b64 = res_json.get("audio_data") or res_json.get("audio")
                        if audio_b64:
                            line_bytes = base64.b64decode(audio_b64)
                    else:
                        line_bytes = resp.content
                else:
                    logger.warning("[PodcastEngine] Erreur Voxtral (%d): %s. Fallback Edge-TTS pour cette réplique.", resp.status_code, resp.text[:120])
            except Exception as e_vox:
                logger.warning("[PodcastEngine] Exception appel Voxtral : %s. Fallback Edge-TTS pour cette réplique.", e_vox)

            # Repli unitaire Edge-TTS si l'appel API a échoué
            if not line_bytes:
                line_bytes = cls._single_edge_tts_call(clean_speech_text, fallback_edge)

            line_duration = max(0.5, len(line_bytes) / 6000.0) if line_bytes else 1.0
            start_t = round(current_timeline_sec, 3)
            end_t = round(start_t + line_duration, 3)

            if line_bytes:
                accumulated_audio.extend(line_bytes)

            pause_ms = int(item.get("pause_after_ms", cfg.get("audio_studio_pause_ms", 350)))
            pause_sec = pause_ms / 1000.0
            current_timeline_sec = end_t + pause_sec

            if pause_ms >= 100:
                silence_frames = cls._generate_mp3_silence(pause_ms)
                accumulated_audio.extend(silence_frames)

            new_item = dict(item)
            new_item["start_time"] = start_t
            new_item["end_time"] = end_t
            updated_dialogue.append(new_item)

        if progress_callback:
            progress_callback(total_lines, 95, "Consolidation du fichier MP3 Voxtral...")

        audio_filename = f"{podcast_id}.mp3"
        out_path = os.path.join(get_podcasts_dir(), audio_filename)
        with open(out_path, "wb") as f:
            f.write(accumulated_audio)

        total_duration = round(current_timeline_sec, 2)
        record["dialogue"] = updated_dialogue
        record["script_dialogue"] = updated_dialogue
        record["audio_file"] = audio_filename
        record["duration_seconds"] = total_duration
        record["engine"] = "voxtral"
        record["voice_speaker_a"] = raw_a
        record["voice_speaker_b"] = raw_b
        record["voice_solo"] = raw_solo
        record["status"] = "ready"
        record["updated_at"] = datetime.datetime.now().isoformat()

        PodcastHistory.upsert(record)

        if progress_callback:
            progress_callback(total_lines, 100, f"Épisode Voxtral finalisé avec succès ({cls.format_duration(total_duration)})")

        return record


    @classmethod
    def resolve_voxtral_voice_id(cls, v_req: str, voices_list: Optional[list] = None) -> str:
        """Résout l'identifiant exact d'une voix ou intonation Voxtral."""
        if not v_req:
            return "marie"
        v_clean = str(v_req).strip()
        if re.match(r'^[0-9a-fA-F-]{32,36}$', v_clean):
            return v_clean
        vl = voices_list or cls.VOXTRAL_DEFAULT_VOICES
        for v in vl:
            if v.get("name", "").strip().lower() == v_clean.lower() or v.get("id", "").strip().lower() == v_clean.lower():
                return v.get("id")
        req_low = v_clean.lower()
        for v in vl:
            v_str = (v.get("name", "") + " " + v.get("id", "")).lower()
            for emo in ["excited", "happy", "joyeuse", "sad", "grave", "curious", "curieuse", "angry", "ferme", "fearful", "douce", "neutral", "neutre"]:
                if emo in req_low and emo in v_str:
                    return v.get("id")
        for v in vl:
            if "marie" in (v.get("name", "") + " " + v.get("id", "")).lower():
                return v.get("id")
        if vl and vl[0].get("id"):
            return vl[0].get("id")
        return "marie"

    @classmethod
    def get_voice_sample(cls, voice_id: str, engine: str = "edge_tts", role: str = "host") -> bytes:
        """
        Retourne un échantillon audio MP3 (~2 secondes) pour une voix donnée.
        Met en cache les extraits dans data/audio/voice_samples/<engine>_<id>.mp3.
        """
        if not voice_id:
            return b""

        clean_id = re.sub(r'[^a-zA-Z0-9_\-]', '_', str(voice_id)).lower()
        samples_dir = get_user_data_path("audio", "voice_samples")
        os.makedirs(samples_dir, exist_ok=True)
        cache_file = os.path.join(samples_dir, f"{engine}_{clean_id}.mp3")

        if os.path.exists(cache_file) and os.path.getsize(cache_file) > 500:
            try:
                with open(cache_file, "rb") as f:
                    return f.read()
            except Exception as e:
                logger.warning("[PodcastEngine] Erreur lecture cache sample : %s", e)

        v_low = voice_id.lower()
        if "happy" in v_low or "joyeuse" in v_low:
            sample_text = "Bienvenue dans Open Shema ! Je suis ravie d'explorer ce passage avec vous."
        elif "sad" in v_low or "grave" in v_low:
            sample_text = "Entrons dans ce temps de recueillement et de méditation biblique."
        elif "curious" in v_low or "curieuse" in v_low:
            sample_text = "Quels secrets et révélations ce passage biblique nous réserve-t-il ?"
        elif "angry" in v_low or "ferme" in v_low:
            sample_text = "Prenons le temps d'examiner ce texte avec toute la rigueur nécessaire."
        elif "henri" in v_low or "fabrice" in v_low or "antoine" in v_low or "jean" in v_low or "gérard" in v_low or "gerard" in v_low or "thierry" in v_low or "scholar" in role:
            sample_text = "Bonjour, examinons ensemble le contexte textuel et historique de ce passage."
        elif "solo" in role:
            sample_text = "Bienvenue dans notre chronique d'étude et de méditation biblique."
        else:
            sample_text = "Bienvenue dans Open Shema pour cette étude biblique."

        audio_bytes = b""
        cfg = load_config()

        if engine == "gemini_tts":
            api_key = cfg.get("google_api_key") or cfg.get("gemini_api_key") or os.getenv("GEMINI_API_KEY")
            if api_key:
                try:
                    from google import genai
                    client = genai.Client(api_key=api_key)
                    model_id = cfg.get("audio_studio_gemini_model", "gemini-3.1-flash-tts-preview")
                    resp = client.interactions.create(
                        model=model_id,
                        input=sample_text,
                        response_format={"type": "audio"},
                        generation_config={
                            "speech_config": [
                                {"voice": voice_id}
                            ]
                        }
                    )
                    if resp and resp.output_audio and resp.output_audio.data:
                        raw_pcm = base64.b64decode(resp.output_audio.data)
                        audio_bytes = cls._pcm_to_mp3(raw_pcm, 24000)
                except Exception as e:
                    logger.warning("[PodcastEngine] Erreur Gemini TTS sample : %s", e)

            if not audio_bytes:
                audio_bytes = cls._single_edge_tts_call(sample_text, "fr-FR-VivienneMultilingualNeural")
        elif engine == "voxtral":
            mistral_key = cfg.get("mistral_api_key")
            if mistral_key:
                try:
                    import httpx
                    v_resolved = cls.resolve_voxtral_voice_id(voice_id)
                    url = f"{cls.VOXTRAL_API_BASE}/audio/speech"
                    headers = {
                        "Authorization": f"Bearer {mistral_key}",
                        "Content-Type": "application/json"
                    }
                    payload = {
                        "model": cls.VOXTRAL_MODEL,
                        "input": sample_text,
                        "voice": v_resolved,
                        "response_format": "mp3"
                    }
                    resp = httpx.post(url, headers=headers, json=payload, timeout=12.0)
                    if resp.status_code == 200 and len(resp.content) > 500:
                        audio_bytes = resp.content
                except Exception as e:
                    logger.warning("[PodcastEngine] Erreur Voxtral sample : %s", e)

            if not audio_bytes:
                mapped_edge = cls.VOXTRAL_EMOTION_EDGE_MAP.get(voice_id, "fr-FR-DeniseNeural")
                audio_bytes = cls._single_edge_tts_call(sample_text, mapped_edge)
        else:
            audio_bytes = cls._single_edge_tts_call(sample_text, voice_id)

        if audio_bytes and len(audio_bytes) > 500:
            try:
                audio_bytes = cls.apply_audio_mastering(audio_bytes, {"mastering_enabled": True})
            except Exception:
                pass

            try:
                with open(cache_file, "wb") as f:
                    f.write(audio_bytes)
            except Exception as e:
                logger.warning("[PodcastEngine] Erreur écriture cache sample : %s", e)

        return audio_bytes

    @classmethod
    def _single_edge_tts_call(cls, text: str, voice: str) -> bytes:
        """Appel synchrone unitaire à Edge-TTS en secours."""
        import edge_tts
        buf = bytearray()
        async def _synth():
            c = edge_tts.Communicate(text, voice)
            async for chunk in c.stream():
                if chunk["type"] == "audio":
                    buf.extend(chunk["data"])
        try:
            asyncio.run(_synth())
        except Exception:
            pass
        return bytes(buf)

    @classmethod
    def _generate_mp3_silence(cls, duration_ms: int) -> bytes:
        """
        Génère des trames MP3 silencieuses au format 24kHz / 48kbps mono.
        Chaque trame MP3 MPEG-2 Layer 3 à 24kHz représente 576 échantillons = 24 ms.
        Une trame silencieuse standard fait 144 octets.
        """
        # Trame MPEG-2 Layer 3, 24kHz, 48kbps mono de silence absolu
        frame_size = 144
        frames_count = max(1, int(duration_ms / 24.0))
        silent_frame = b'\xff\xf3d\xc4' + b'\x00' * (frame_size - 4)
        return silent_frame * frames_count

    @classmethod
    def _pcm_to_mp3(cls, pcm_bytes: bytes, sample_rate: int = 24000) -> bytes:
        """Convertit des octets PCM 16-bit mono 24kHz en MP3 encodé via PyAV."""
        if not pcm_bytes:
            return b""
        try:
            import wave
            import av
            import io
            wav_buf = io.BytesIO()
            with wave.open(wav_buf, "wb") as wf:
                wf.setnchannels(1)
                wf.setsampwidth(2)
                wf.setframerate(sample_rate)
                wf.writeframes(pcm_bytes)
            wav_buf.seek(0)

            in_c = av.open(wav_buf, "r")
            out_buf = io.BytesIO()
            out_c = av.open(out_buf, "w", format="mp3")
            st = out_c.add_stream("libmp3lame", rate=sample_rate)
            st.bit_rate = 64000
            st.layout = "mono"
            for frame in in_c.decode(audio=0):
                for packet in st.encode(frame):
                    out_c.mux(packet)
            for packet in st.encode(None):
                out_c.mux(packet)
            out_c.close()
            in_c.close()
            return out_buf.getvalue()
        except Exception as e_conv:
            logger.error("[PodcastEngine] Erreur conversion PCM vers MP3 : %s", e_conv)
            return b""

    @classmethod
    def _call_gemini_tts_api(
        cls,
        prompt: str,
        speech_config: list,
        model_id: str,
        cfg: Dict[str, Any],
        max_retries: int = 3
    ) -> bytes:
        """
        Appelle l'API Google Gemini Flash TTS pour générer de l'audio PCM.
        Implémente un retry automatique avec backoff exponentiel pour parer aux erreurs 500 temporaires.
        """
        api_key = cfg.get("google_api_key") or cfg.get("gemini_api_key") or os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("Aucune clé API Google configurée pour Gemini Flash TTS.")

        from google import genai
        client = genai.Client(api_key=api_key)

        last_err = None
        for attempt in range(max_retries):
            try:
                response = client.interactions.create(
                    model=model_id,
                    input=prompt,
                    response_format={"type": "audio"},
                    generation_config={
                        "speech_config": speech_config
                    }
                )
                if response and response.output_audio and response.output_audio.data:
                    raw_b64 = response.output_audio.data
                    return base64.b64decode(raw_b64)
                else:
                    raise RuntimeError("L'API Gemini n'a retourné aucune donnée audio.")
            except Exception as e:
                last_err = e
                logger.warning(
                    "[PodcastEngine] Tentative %d/%d échouée pour Gemini TTS (%s): %s",
                    attempt + 1, max_retries, model_id, e
                )
                if attempt < max_retries - 1:
                    time.sleep(2.0 * (attempt + 1))

        # Fallback direct REST via httpx si l'interaction SDK échoue
        try:
            import httpx
            url = f"https://generativelanguage.googleapis.com/v1beta/interactions?key={api_key}"
            payload = {
                "model": model_id,
                "input": prompt,
                "response_format": {"type": "audio"},
                "generation_config": {
                    "speech_config": speech_config
                }
            }
            resp = httpx.post(url, json=payload, timeout=60.0)
            if resp.status_code == 200:
                data = resp.json()
                out_audio = data.get("output_audio", {}).get("data")
                if out_audio:
                    return base64.b64decode(out_audio)
        except Exception as e_rest:
            logger.warning("[PodcastEngine] Tentative REST de secours échouée: %s", e_rest)

        raise RuntimeError(f"Échec de l'appel Gemini Flash TTS après {max_retries} tentatives : {last_err}")

    @classmethod
    def _synthesize_gemini_tts(
        cls,
        podcast_id: str,
        record: Dict[str, Any],
        dialogue: List[Dict[str, Any]],
        opts: Dict[str, Any],
        cfg: Dict[str, Any],
        progress_callback: Optional[Callable[[int, int, str], None]] = None
    ) -> Dict[str, Any]:
        """
        Synthèse vocale neuronale via Google Gemini Flash TTS (Proposition C : Hybrid Batching).
        Génère l'intégralité du dialogue ou de la chronique en 1 seul appel API pour respecter les quotas gratuits.
        """
        model_id = opts.get("gemini_model") or cfg.get("audio_studio_gemini_model", "gemini-3.1-flash-tts-preview")
        raw_a = opts.get("gemini_voice_speaker_a") or opts.get("voice_speaker_a") or cfg.get("audio_studio_gemini_voice_speaker_a", "Puck")
        raw_b = opts.get("gemini_voice_speaker_b") or opts.get("voice_speaker_b") or cfg.get("audio_studio_gemini_voice_speaker_b", "Charon")
        raw_solo = opts.get("gemini_voice_solo") or opts.get("voice_solo") or cfg.get("audio_studio_gemini_voice_solo", "Puck")

        rpm_limit = int(cfg.get("gemini_tts_rpm_limit", 3))
        rpd_limit = int(cfg.get("gemini_tts_rpd_limit", 10))
        tpm_limit = int(cfg.get("gemini_tts_tpm_limit", 10000))

        mastering_enabled = opts.get("mastering_enabled", cfg.get("audio_studio_mastering_enabled", True))
        total_lines = len(dialogue)

        api_key = cfg.get("google_api_key") or cfg.get("gemini_api_key") or os.getenv("GEMINI_API_KEY")
        if not api_key:
            logger.warning("[PodcastEngine] Clé API Google absente pour Gemini TTS. Repli automatique sur Edge-TTS.")
            mapped_opts = dict(opts)
            mapped_opts["voice_speaker_a"] = "fr-FR-DeniseNeural"
            mapped_opts["voice_speaker_b"] = "fr-FR-HenriNeural"
            mapped_opts["voice_solo"] = "fr-FR-HenriNeural"
            res = cls._synthesize_edge_tts(podcast_id, record, dialogue, mapped_opts, cfg, progress_callback)
            res["engine"] = "gemini_tts"
            record["engine"] = "gemini_tts"
            PodcastHistory.upsert(record)
            return record

        fmt = str(record.get("format_type") or record.get("format") or opts.get("format_type") or "dialogue").lower()
        is_solo = (fmt == "solo" or total_lines <= 1)

        if progress_callback:
            progress_callback(1, 15, f"Préparation de l'épisode complet ({model_id})...")

        # Construction du prompt et de la configuration de voix selon le format
        if is_solo:
            speech_config = [
                {"voice": raw_solo}
            ]
            clean_turns = []
            for item in dialogue:
                txt = item.get("speech_text") or item.get("text", "")
                ct = cls._clean_text_for_speech(txt)
                if ct:
                    clean_turns.append(ct)
            joined_text = "\n\n".join(clean_turns)
            full_prompt = f"TTS the following theological reflection in French with natural pacing, clear articulation, and warm depth:\n\n{joined_text}"
        else:
            spk_a_name = "Animatrice"
            spk_b_name = "Exégète"
            speech_config = [
                {"speaker": spk_a_name, "voice": raw_a},
                {"speaker": spk_b_name, "voice": raw_b}
            ]
            lines = [
                "TTS the following dialogue in French with natural pacing, lively interaction, and clear theological depth between Animatrice and Exégète:"
            ]
            for idx, item in enumerate(dialogue):
                v_role = str(item.get("voice_role", "")).upper()
                spk = str(item.get("speaker", "")).lower()
                is_b = (v_role in ("B", "SCHOLAR") or any(k in spk for k in ("scholar", "théolog", "exég", "chercheur", "henri", "charon")))
                role_name = spk_b_name if is_b else spk_a_name
                txt = item.get("speech_text") or item.get("text", "")
                ct = cls._clean_text_for_speech(txt)
                if ct:
                    lines.append(f"{role_name}: {ct}")
            full_prompt = "\n".join(lines)

        est_tokens = max(50, len(full_prompt) // 4)

        try:
            GeminiQuotaTracker.check_and_increment(
                estimated_tokens=est_tokens,
                rpm_limit=rpm_limit,
                rpd_limit=rpd_limit,
                tpm_limit=tpm_limit
            )
        except RuntimeError as q_err:
            logger.warning("[PodcastEngine] %s. Repli automatique sur Edge-TTS.", q_err)
            mapped_opts = dict(opts)
            mapped_opts["voice_speaker_a"] = "fr-FR-DeniseNeural"
            mapped_opts["voice_speaker_b"] = "fr-FR-HenriNeural"
            mapped_opts["voice_solo"] = "fr-FR-HenriNeural"
            res = cls._synthesize_edge_tts(podcast_id, record, dialogue, mapped_opts, cfg, progress_callback)
            res["engine"] = "gemini_tts"
            record["engine"] = "gemini_tts"
            PodcastHistory.upsert(record)
            return record

        if progress_callback:
            progress_callback(1, 40, f"Génération audio neuronale Gemini Flash ({model_id})...")

        try:
            pcm_bytes = cls._call_gemini_tts_api(
                prompt=full_prompt,
                speech_config=speech_config,
                model_id=model_id,
                cfg=cfg
            )
        except Exception as e_gen:
            logger.error("[PodcastEngine] Erreur synthèse Gemini TTS : %s. Repli automatique sur Edge-TTS.", e_gen)
            mapped_opts = dict(opts)
            mapped_opts["voice_speaker_a"] = "fr-FR-DeniseNeural"
            mapped_opts["voice_speaker_b"] = "fr-FR-HenriNeural"
            mapped_opts["voice_solo"] = "fr-FR-HenriNeural"
            res = cls._synthesize_edge_tts(podcast_id, record, dialogue, mapped_opts, cfg, progress_callback)
            res["engine"] = "gemini_tts"
            record["engine"] = "gemini_tts"
            PodcastHistory.upsert(record)
            return record

        if progress_callback:
            progress_callback(total_lines, 80, "Encodage MP3 haute qualité et calcul des repères...")

        mp3_audio = cls._pcm_to_mp3(pcm_bytes, 24000)
        if not mp3_audio:
            logger.warning("[PodcastEngine] Échec encodage MP3 Gemini, repli Edge-TTS.")
            return cls._synthesize_edge_tts(podcast_id, record, dialogue, opts, cfg, progress_callback)

        total_duration = round(max(1.0, len(pcm_bytes) / 48000.0), 2)

        # Répartition proportionnelle des repères karaoké
        total_chars = sum(len(item.get("speech_text") or item.get("text", "")) for item in dialogue) or 1
        curr_t = 0.0
        updated_dialogue = []
        for idx, item in enumerate(dialogue):
            txt = item.get("speech_text") or item.get("text", "")
            prop = max(0.05, len(txt) / total_chars)
            seg_dur = round(prop * total_duration, 3)
            new_item = dict(item)
            new_item["start_time"] = round(curr_t, 3)
            curr_t += seg_dur
            new_item["end_time"] = round(min(total_duration, curr_t), 3)
            updated_dialogue.append(new_item)

        if mastering_enabled and len(mp3_audio) > 1000:
            if progress_callback:
                progress_callback(total_lines, 92, "Application du mastering studio DSP...")
            mp3_audio = cls.apply_audio_mastering(mp3_audio, {"mastering_enabled": True})

        audio_filename = f"{podcast_id}.mp3"
        out_path = os.path.join(get_podcasts_dir(), audio_filename)
        with open(out_path, "wb") as f:
            f.write(mp3_audio)

        record["dialogue"] = updated_dialogue
        record["script_dialogue"] = updated_dialogue
        record["audio_file"] = audio_filename
        record["duration_seconds"] = total_duration
        record["engine"] = "gemini_tts"
        record["gemini_model"] = model_id
        record["voice_speaker_a"] = raw_a
        record["voice_speaker_b"] = raw_b
        record["voice_solo"] = raw_solo
        record["status"] = "ready"
        record["updated_at"] = datetime.datetime.now().isoformat()

        PodcastHistory.upsert(record)

        if progress_callback:
            progress_callback(total_lines, 100, f"Épisode Gemini Flash finalisé ({cls.format_duration(total_duration)})")

        return record

    @classmethod
    def _synthesize_mixed_engines(
        cls,
        podcast_id: str,
        record: Dict[str, Any],
        dialogue: List[Dict[str, Any]],
        opts: Dict[str, Any],
        cfg: Dict[str, Any],
        progress_callback: Optional[Callable[[int, int, str], None]] = None
    ) -> Dict[str, Any]:
        """
        Synthèse vocale multi-moteurs : permet d'assigner un moteur distinct à chaque locuteur
        (ex: Locuteur A / Animatrice sur Edge-TTS, Locuteur B / Exégète sur Gemini Flash TTS).
        """
        spk_a_engine = opts.get("speaker_a_engine") or cfg.get("audio_studio_speaker_a_engine", "gemini_tts")
        spk_b_engine = opts.get("speaker_b_engine") or cfg.get("audio_studio_speaker_b_engine", "edge_tts")
        solo_engine = opts.get("solo_engine") or cfg.get("audio_studio_solo_engine", "gemini_tts")

        voice_a_edge = opts.get("voice_speaker_a") or cfg.get("audio_studio_voice_speaker_a", "fr-FR-VivienneMultilingualNeural")
        voice_b_edge = opts.get("voice_speaker_b") or cfg.get("audio_studio_voice_speaker_b", "fr-CH-FabriceNeural")
        voice_solo_edge = opts.get("voice_solo") or cfg.get("audio_studio_voice_solo", "fr-CH-FabriceNeural")

        voice_a_gemini = opts.get("gemini_voice_speaker_a") or cfg.get("audio_studio_gemini_voice_speaker_a", "Puck")
        voice_b_gemini = opts.get("gemini_voice_speaker_b") or cfg.get("audio_studio_gemini_voice_speaker_b", "Charon")
        voice_solo_gemini = opts.get("gemini_voice_solo") or cfg.get("audio_studio_gemini_voice_solo", "Puck")

        voice_a_voxtral = opts.get("voxtral_voice_speaker_a") or cfg.get("audio_studio_voxtral_voice_speaker_a", "Marie - Happy")
        voice_b_voxtral = opts.get("voxtral_voice_speaker_b") or cfg.get("audio_studio_voxtral_voice_speaker_b", "Marie - Neutral")
        voice_solo_voxtral = opts.get("voxtral_voice_solo") or cfg.get("audio_studio_voxtral_voice_solo", "Marie - Neutral")

        gemini_model = opts.get("gemini_model") or cfg.get("audio_studio_gemini_model", "gemini-3.1-flash-tts-preview")
        rpm_limit = int(cfg.get("gemini_tts_rpm_limit", 3))
        rpd_limit = int(cfg.get("gemini_tts_rpd_limit", 10))
        tpm_limit = int(cfg.get("gemini_tts_tpm_limit", 10000))

        total_lines = len(dialogue)
        accumulated_audio = bytearray()
        current_timeline_sec = 0.0
        updated_dialogue = []

        fmt = str(record.get("format_type") or record.get("format") or opts.get("format_type") or "dialogue").lower()

        for idx, item in enumerate(dialogue):
            pct = int(10 + (idx / max(total_lines, 1)) * 80)
            v_role = str(item.get("voice_role", "")).upper()
            spk = str(item.get("speaker", "")).lower()
            text = item.get("text", "").strip()
            speech_text = (item.get("speech_text") or "").strip()
            if not text and not speech_text:
                continue

            clean_text = cls._clean_text_for_speech(speech_text if speech_text else text)

            # Déterminer rôle et moteur
            if fmt == "solo" and v_role != "B" and not any(k in spk for k in ("scholar", "théolog", "exég")):
                chosen_eng = solo_engine
                role_label = "Chronique Solo"
            elif v_role in ("B", "SCHOLAR") or any(k in spk for k in ("scholar", "théologien", "exégète", "henri", "charon")):
                chosen_eng = spk_b_engine
                role_label = "Exégète"
            else:
                chosen_eng = spk_a_engine
                role_label = "Animatrice"

            if progress_callback:
                progress_callback(idx + 1, pct, f"Synthèse {idx + 1}/{total_lines} ({role_label} — {chosen_eng})...")

            line_mp3 = b""

            # 1. Synthèse Gemini Flash TTS
            if chosen_eng == "gemini_tts":
                chosen_gemini_voice = voice_solo_gemini if role_label == "Chronique Solo" else (voice_b_gemini if role_label == "Exégète" else voice_a_gemini)
                try:
                    GeminiQuotaTracker.check_and_increment(
                        estimated_tokens=max(10, len(clean_text) // 4),
                        rpm_limit=rpm_limit,
                        rpd_limit=rpd_limit,
                        tpm_limit=tpm_limit
                    )
                    prompt_turn = f"TTS in French with natural expression:\n{clean_text}"
                    pcm = cls._call_gemini_tts_api(
                        prompt=prompt_turn,
                        speech_config=[{"voice": chosen_gemini_voice}],
                        model_id=gemini_model,
                        cfg=cfg
                    )
                    line_mp3 = cls._pcm_to_mp3(pcm, 24000)
                except Exception as e_gem:
                    logger.warning("[PodcastEngine] Erreur Gemini réplique %d : %s. Repli Edge-TTS.", idx + 1, e_gem)
                    chosen_eng = "edge_tts"

            # 2. Synthèse Mistral Voxtral
            if chosen_eng == "voxtral" and not line_mp3:
                chosen_vox = voice_solo_voxtral if role_label == "Chronique Solo" else (voice_b_voxtral if role_label == "Exégète" else voice_a_voxtral)
                mistral_key = cfg.get("mistral_api_key")
                if mistral_key:
                    try:
                        import httpx
                        v_res = cls.resolve_voxtral_voice_id(chosen_vox)
                        resp = httpx.post(
                            f"{cls.VOXTRAL_API_BASE}/audio/speech",
                            headers={"Authorization": f"Bearer {mistral_key}", "Content-Type": "application/json"},
                            json={"model": cls.VOXTRAL_MODEL, "input": clean_text, "voice": v_res, "response_format": "mp3"},
                            timeout=60.0
                        )
                        if resp.status_code == 200:
                            line_mp3 = resp.content
                    except Exception as e_vox:
                        logger.warning("[PodcastEngine] Erreur Voxtral réplique %d : %s. Repli Edge-TTS.", idx + 1, e_vox)
                        chosen_eng = "edge_tts"
                else:
                    chosen_eng = "edge_tts"

            # 3. Synthèse Edge-TTS (ou repli)
            if not line_mp3:
                fallback_voice = voice_solo_edge if role_label == "Chronique Solo" else (voice_b_edge if role_label == "Exégète" else voice_a_edge)
                line_mp3 = cls._single_edge_tts_call(clean_text, fallback_voice)

            line_duration = max(0.5, len(line_mp3) / 6000.0) if line_mp3 else 1.0
            start_t = round(current_timeline_sec, 3)
            end_t = round(start_t + line_duration, 3)

            if line_mp3:
                accumulated_audio.extend(line_mp3)

            pause_ms = int(item.get("pause_after_ms", cfg.get("audio_studio_pause_ms", 350)))
            current_timeline_sec = end_t + (pause_ms / 1000.0)

            if pause_ms >= 100:
                accumulated_audio.extend(cls._generate_mp3_silence(pause_ms))

            new_item = dict(item)
            new_item["start_time"] = start_t
            new_item["end_time"] = end_t
            new_item["engine_used"] = chosen_eng
            updated_dialogue.append(new_item)

        audio_filename = f"{podcast_id}.mp3"
        out_path = os.path.join(get_podcasts_dir(), audio_filename)
        with open(out_path, "wb") as f:
            f.write(accumulated_audio)

        total_duration = round(current_timeline_sec, 2)
        record["dialogue"] = updated_dialogue
        record["script_dialogue"] = updated_dialogue
        record["audio_file"] = audio_filename
        record["duration_seconds"] = total_duration
        record["engine"] = "mixed"
        record["status"] = "ready"
        record["updated_at"] = datetime.datetime.now().isoformat()

        PodcastHistory.upsert(record)

        if progress_callback:
            progress_callback(total_lines, 100, f"Épisode Mix Multi-Moteurs finalisé ({cls.format_duration(total_duration)})")

        return record


    @classmethod
    def export_to_note(cls, podcast_id: str) -> Dict[str, Any]:
        """Exporte le script d'un podcast en une note d'étude Markdown (.md) d'Open Shema."""
        record = PodcastHistory.get(podcast_id)
        if not record:
            raise Exception("Podcast introuvable.")

        title = record.get("title", "Podcast Théologique")
        subject = record.get("subject", "")
        summary = record.get("summary", "")
        sources = record.get("sources_cited", [])
        dialogue = record.get("dialogue", [])

        md_lines = [
            f"# {title}",
            f"\n> **Sujet :** {subject}  ",
            f"> **Date :** {record.get('created_at', '')[:10]}  ",
            f"> **Format :** {'Chronique Solo' if record.get('format_type') == 'solo' else 'Dialogue Animateur / Exégète'}  ",
            f"> **Durée :** {cls.format_duration(record.get('duration_seconds', 0))}\n",
        ]

        if summary:
            md_lines.append(f"### Résumé\n{summary}\n")

        if sources:
            md_lines.append(f"### Sources consultées\n" + "\n".join([f"- {s}" for s in sources]) + "\n")

        dialogue = record.get("script_dialogue") or record.get("dialogue", [])
        md_lines.append("### Script de l'émission\n")
        for d in dialogue:
            name = d.get("speaker") or d.get("speaker_name", "Locuteur")
            text = d.get("text", "")
            md_lines.append(f"**{name} :** {text}\n")

        full_content = "\n".join(md_lines)

        # Sauvegarder via NotesManager
        try:
            from core.notes_manager import NotesManager
            notes_dir = NotesManager.get_notes_directory()
            note_title = f"Studio Audio — {title}"
            note_data = {
                "title": note_title,
                "reference": subject,
                "tags": ["podcast", "studio-audio", "exégèse"],
                "type": "text",
                "content": full_content,
                "include_in_ai": True
            }
            note_res = NotesManager.save_note_file(note_data, notes_dir)
            return {"success": True, "note": note_res, "note_title": note_title, "markdown": full_content}
        except Exception as e:
            logger.warning("[PodcastEngine] NotesManager direct non accessible, fallback : %s", e)
            return {"success": True, "note_title": f"Studio Audio — {title}", "markdown": full_content}

    @classmethod
    def format_duration(cls, seconds: float) -> str:
        s = int(seconds or 0)
        m = s // 60
        sec = s % 60
        return f"{m}:{sec:02d}"
