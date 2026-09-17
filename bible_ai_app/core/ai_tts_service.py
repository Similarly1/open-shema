"""
Service de synthèse vocale (TTS) en streaming pour les réponses de l'Assistant d'Étude IA.
Découpe les réponses Markdown en phrases nettoyées phonétiquement et génère l'audio
de manière pipelinée pour une écoute instantanée (< 400ms).
Supporte Edge-TTS (100% gratuit), Mistral Voxtral et Google Gemini Flash TTS.
"""

import os
import re
import base64
import hashlib
import logging
import asyncio
from typing import List, Dict, Any, Optional, Tuple

from core.config import load_config
from core.podcast_manager import PodcastEngine

logger = logging.getLogger(__name__)

# Cache mémoire pour éviter de recalculer les phrases déjà synthétisées
_SENTENCE_AUDIO_CACHE: Dict[str, str] = {}
_MAX_CACHE_ENTRIES = 500


def clean_markdown_for_speech(text: str) -> str:
    """
    Supprime les artefacts de mise en forme Markdown, tableaux et citations pour
    obtenir un texte pur et fluide avant la normalisation phonétique biblique.
    """
    if not text:
        return ""

    # 1. Supprimer les blocs de code complets (```...```)
    text = re.sub(r'```[\s\S]*?```', ' ', text)
    # Supprimer le code inline (`...`)
    text = re.sub(r'`([^`]+)`', r'\1', text)

    # 2. Supprimer les images ![alt](url)
    text = re.sub(r'!\[.*?\]\(.*?\)', ' ', text)

    # 3. Remplacer les liens [texte](url) par le texte seul
    text = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', text)

    # 4. Supprimer les pastilles de notes/sources [1], [^1], [source: ...]
    text = re.sub(r'\[\^?\d+\]', '', text)
    text = re.sub(r'\[source:\s*[^\]]+\]', '', text, flags=re.IGNORECASE)

    # 5. Supprimer les balises HTML <...>
    text = re.sub(r'<[^>]+>', ' ', text)

    # 6. Traiter les en-têtes Markdown (# Titre -> Titre.)
    text = re.sub(r'^[ \t]*#{1,6}\s+(.+)$', r'\1.', text, flags=re.MULTILINE)

    # 7. Nettoyer les listes à puces / ordonnées (- item -> item.)
    text = re.sub(r'^[ \t]*[-*+]\s+(.+)$', r'\1.', text, flags=re.MULTILINE)
    text = re.sub(r'^[ \t]*\d+\.\s+(.+)$', r'\1.', text, flags=re.MULTILINE)

    # 8. Supprimer les séparateurs horizontaux (--- ou ***)
    text = re.sub(r'^[ \t]*[-*_]{3,}\s*$', ' ', text, flags=re.MULTILINE)

    # 9. Supprimer les citations blockquote (> texte -> texte)
    text = re.sub(r'^[ \t]*>\s*(.*)$', r'\1', text, flags=re.MULTILINE)

    # 10. Nettoyer les tableaux Markdown (lignes de tirets et barres verticales)
    text = re.sub(r'\|[-:\s|]+\|', ' ', text)
    text = re.sub(r'\|', ', ', text)

    # 11. Nettoyer le gras / italique (**mot**, *mot*, __mot__, _mot_)
    text = re.sub(r'\*\*(.+?)\*\*', r'\1', text)
    text = re.sub(r'\*(.+?)\*', r'\1', text)
    text = re.sub(r'__(.+?)__', r'\1', text)
    text = re.sub(r'_(.+?)_', r'\1', text)
    text = re.sub(r'~~(.+?)~~', r'\1', text)

    # 12. Appliquer la normalisation phonétique et biblique éprouvée d'Open Shema
    clean_text = PodcastEngine._clean_text_for_speech(text)

    # 13. Nettoyage final des ponctuations résiduelles
    clean_text = re.sub(r'\s*\.\s*\.', '.', clean_text)
    clean_text = re.sub(r'\s*,\s*,', ',', clean_text)
    clean_text = re.sub(r'\s{2,}', ' ', clean_text).strip()

    return clean_text


def split_into_sentences(text: str) -> List[str]:
    """
    Découpe un texte nettoyé en phrases cohérentes pour la synthèse vocale pipelinée.
    Préserve les abréviations françaises courantes et les nombres décimaux.
    """
    clean_text = clean_markdown_for_speech(text)
    if not clean_text:
        return []

    # Masquer temporairement les abréviations et cas particuliers
    protected = clean_text
    abbreviations = [
        (r'\bM\.', 'MONSIEUR_ABBR'),
        (r'\bMme\.', 'MADAME_ABBR'),
        (r'\bMlle\.', 'MADEMOISELLE_ABBR'),
        (r'\bDr\.', 'DOCTEUR_ABBR'),
        (r'\bPr\.', 'PROFESSEUR_ABBR'),
        (r'\bp\.\s*ex\.', 'PAR_EXEMPLE_ABBR'),
        (r'\bcf\.', 'CONFER_ABBR'),
        (r'\betc\.', 'ETCETERA_ABBR'),
        (r'\bfig\.', 'FIGURE_ABBR'),
        (r'\bvol\.', 'VOLUME_ABBR'),
        (r'(\d+)\.(\d+)', r'\1_DOTDECIMAL_\2'),
    ]

    for pattern, repl in abbreviations:
        protected = re.sub(pattern, repl, protected, flags=re.IGNORECASE)

    # Découper selon la ponctuation forte ou double saut de ligne
    raw_splits = re.split(r'(?<=[.!?])\s+|\n+', protected)

    sentences = []
    current_sentence = ""

    unmask_map = {
        'MONSIEUR_ABBR': 'M.',
        'MADAME_ABBR': 'Mme',
        'MADEMOISELLE_ABBR': 'Mlle',
        'DOCTEUR_ABBR': 'Dr.',
        'PROFESSEUR_ABBR': 'Pr.',
        'PAR_EXEMPLE_ABBR': 'par exemple',
        'CONFER_ABBR': 'confer',
        'ETCETERA_ABBR': 'etcetera',
        'FIGURE_ABBR': 'figure',
        'VOLUME_ABBR': 'volume',
    }

    for segment in raw_splits:
        seg = segment.strip()
        if not seg:
            continue

        # Rétablir les protections
        for k, v in unmask_map.items():
            seg = seg.replace(k, v)
        seg = re.sub(r'(\d+)_DOTDECIMAL_(\d+)', r'\1.\2', seg)

        # Si le segment est trop court (< 15 caractères) et qu'on a déjà une phrase en cours,
        # on l'agrège pour éviter les micro-requêtes TTS hachées.
        if len(seg) < 15 and current_sentence:
            current_sentence = f"{current_sentence} {seg}".strip()
        else:
            if current_sentence:
                sentences.append(current_sentence)
            current_sentence = seg

    if current_sentence:
        sentences.append(current_sentence)

    # Scinder les phrases anormalement longues (> 300 caractères) sur les points-virgules ou deux-points
    refined_sentences = []
    for s in sentences:
        if len(s) > 300:
            sub_parts = re.split(r'(?<=[;:])\s+', s)
            for sp in sub_parts:
                sp_clean = sp.strip()
                if sp_clean:
                    refined_sentences.append(sp_clean)
        else:
            refined_sentences.append(s)

    return [s for s in refined_sentences if len(s.strip()) > 1]


def _synthesize_edge_tts_sentence(sentence: str, voice: str, speed: float = 1.0) -> bytes:
    """Synthétise une phrase unitaire avec Edge-TTS et modulation de vitesse."""
    import edge_tts

    rate_percent = int((speed - 1.0) * 100)
    rate_str = f"{rate_percent:+d}%"

    buf = bytearray()

    async def _do_synth():
        comm = edge_tts.Communicate(sentence, voice, rate=rate_str)
        async for chunk in comm.stream():
            if chunk["type"] == "audio":
                buf.extend(chunk["data"])

    try:
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
                    fut = executor.submit(lambda: asyncio.run(_do_synth()))
                    fut.result(timeout=10.0)
            else:
                loop.run_until_complete(_do_synth())
        except RuntimeError:
            asyncio.run(_do_synth())
    except Exception as e:
        logger.warning("[AiTtsService] Erreur Edge-TTS: %s", e)

    return bytes(buf)


def _synthesize_voxtral_sentence(sentence: str, voice_id: str, cfg: Dict[str, Any]) -> Tuple[bytes, bool]:
    """Synthétise une phrase unitaire avec Mistral Voxtral via POST /v1/audio/speech."""
    mistral_key = cfg.get("mistral_api_key")
    if not mistral_key:
        return b"", False

    try:
        import httpx
        voices_list = PodcastEngine.fetch_voxtral_voices(mistral_key)
        v_resolved = PodcastEngine.resolve_voxtral_voice_id(voice_id, voices_list)
        url = f"{PodcastEngine.VOXTRAL_API_BASE}/audio/speech"
        headers = {
            "Authorization": f"Bearer {mistral_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": PodcastEngine.VOXTRAL_MODEL,
            "input": sentence,
            "voice_id": v_resolved,
            "response_format": "mp3"
        }
        resp = httpx.post(url, headers=headers, json=payload, timeout=25.0)
        if resp.status_code == 200:
            ct = resp.headers.get("content-type", "")
            if "application/json" in ct:
                data = resp.json()
                audio_b64 = data.get("audio_data") or data.get("audio")
                if audio_b64:
                    mp3_bytes = base64.b64decode(audio_b64)
                    if len(mp3_bytes) > 200:
                        return mp3_bytes, True
            else:
                if len(resp.content) > 200:
                    return resp.content, True
        else:
            logger.warning("[AiTtsService] Réponse inattendue Voxtral : HTTP %d %s", resp.status_code, resp.text[:200])
    except Exception as e:
        logger.warning("[AiTtsService] Erreur Voxtral API : %s", e)

    return b"", False


def _synthesize_gemini_sentence(sentence: str, voice_id: str, cfg: Dict[str, Any]) -> Tuple[bytes, bool]:
    """Synthétise une phrase unitaire avec Google Gemini Flash TTS."""
    api_key = cfg.get("google_api_key") or cfg.get("gemini_api_key") or os.getenv("GEMINI_API_KEY")
    if not api_key:
        return b"", False

    try:
        from google import genai
        client = genai.Client(api_key=api_key)
        model_id = cfg.get("audio_studio_gemini_model", "gemini-3.1-flash-tts-preview")
        resp = client.interactions.create(
            model=model_id,
            input=sentence,
            response_format={"type": "audio"},
            generation_config={
                "speech_config": [
                    {"voice": voice_id}
                ]
            }
        )
        if resp and resp.output_audio and resp.output_audio.data:
            raw_pcm = base64.b64decode(resp.output_audio.data)
            mp3_bytes = PodcastEngine._pcm_to_mp3(raw_pcm, 24000)
            if mp3_bytes and len(mp3_bytes) > 300:
                return mp3_bytes, True
    except Exception as e:
        logger.warning("[AiTtsService] Erreur Gemini Flash TTS : %s", e)

    return b"", False


def synthesize_sentence(
    sentence: str,
    voice: Optional[str] = None,
    engine: Optional[str] = None,
    speed: Optional[float] = None,
    cfg: Optional[Dict[str, Any]] = None
) -> Tuple[bool, str, Optional[str]]:
    """
    Synthétise une phrase unitaire en MP3 et retourne son Data URL base64.
    Retourne: (success: bool, audio_data_url: str, error: Optional[str])
    """
    sentence_clean = sentence.strip()
    if not sentence_clean:
        return False, "", "Phrase vide."

    if cfg is None:
        cfg = load_config()

    chosen_engine = engine or cfg.get("ai_answer_voice_engine", "edge_tts")
    if speed is None:
        speed = float(cfg.get("ai_answer_playback_speed", 1.0))

    if not voice:
        if chosen_engine == "voxtral":
            voice = cfg.get("ai_answer_voice_voxtral", "Marie - Neutral")
        elif chosen_engine == "gemini_tts":
            voice = cfg.get("ai_answer_voice_gemini", "Charon")
        else:
            voice = cfg.get("ai_answer_voice_edge", "fr-CH-FabriceNeural")

    # Clé de cache
    cache_key = hashlib.sha256(f"{chosen_engine}:{voice}:{speed:.2f}:{sentence_clean}".encode("utf-8")).hexdigest()
    if cache_key in _SENTENCE_AUDIO_CACHE:
        return True, _SENTENCE_AUDIO_CACHE[cache_key], None

    audio_bytes = b""
    used_engine = chosen_engine

    if chosen_engine == "voxtral":
        audio_bytes, ok = _synthesize_voxtral_sentence(sentence_clean, voice, cfg)
        if not ok or not audio_bytes:
            logger.info("[AiTtsService] Repli Voxtral -> Edge-TTS (fr-FR-DeniseNeural)")
            used_engine = "edge_tts"
            audio_bytes = _synthesize_edge_tts_sentence(sentence_clean, "fr-FR-DeniseNeural", speed)
    elif chosen_engine == "gemini_tts":
        audio_bytes, ok = _synthesize_gemini_sentence(sentence_clean, voice, cfg)
        if not ok or not audio_bytes:
            logger.info("[AiTtsService] Repli Gemini TTS -> Edge-TTS (fr-CH-FabriceNeural)")
            used_engine = "edge_tts"
            audio_bytes = _synthesize_edge_tts_sentence(sentence_clean, "fr-CH-FabriceNeural", speed)
    else:
        # Edge-TTS par défaut
        audio_bytes = _synthesize_edge_tts_sentence(sentence_clean, voice, speed)

    if not audio_bytes or len(audio_bytes) < 300:
        # Tentative de secours ultime avec voix standard Edge-TTS
        audio_bytes = _synthesize_edge_tts_sentence(sentence_clean, "fr-CH-FabriceNeural", 1.0)

    if not audio_bytes or len(audio_bytes) < 300:
        return False, "", "Échec de synthèse vocale pour cette phrase."

    data_url = f"data:audio/mp3;base64,{base64.b64encode(audio_bytes).decode('ascii')}"

    # Sauvegarde dans le cache mémoire LRU
    if len(_SENTENCE_AUDIO_CACHE) >= _MAX_CACHE_ENTRIES:
        keys_to_remove = list(_SENTENCE_AUDIO_CACHE.keys())[:50]
        for k in keys_to_remove:
            _SENTENCE_AUDIO_CACHE.pop(k, None)

    _SENTENCE_AUDIO_CACHE[cache_key] = data_url
    return True, data_url, None


def get_ai_tts_config(cfg: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Retourne la configuration active et les voix disponibles pour la lecture audio IA."""
    if cfg is None:
        cfg = load_config()

    available_catalog = PodcastEngine.get_available_voices(cfg)

    return {
        "engine": cfg.get("ai_answer_voice_engine", "edge_tts"),
        "voice_edge": cfg.get("ai_answer_voice_edge", "fr-CH-FabriceNeural"),
        "voice_voxtral": cfg.get("ai_answer_voice_voxtral", "Marie - Neutral"),
        "voice_gemini": cfg.get("ai_answer_voice_gemini", "Charon"),
        "playback_speed": float(cfg.get("ai_answer_playback_speed", 1.0)),
        "available_voices": available_catalog
    }
