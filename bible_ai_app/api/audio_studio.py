"""
api/audio_studio.py — AudioStudioMixin pour l'API PyWebView d'Open Shema.

Expose au frontend JavaScript toutes les méthodes nécessaires pour piloter le Studio Audio :
- Récupération des voix neuronales et de la configuration
- Génération du script IA (Transcript-First) avec filtrage RAG multi-sources
- Synthèse vocale Edge-TTS / Voxtral avec progression TaskManager
- Gestion de l'historique (lecture, suppression, export en note .md)
- Fourniture de l'audio MP3 sous forme de Data URL base64 pour lecture instantanée
"""

import os
import sys
import shutil
import base64
import logging
import threading
from typing import Dict, List, Any, Optional

import webview

logger = logging.getLogger("api_audio_studio")

from core.podcast_manager import PodcastEngine, PodcastHistory, get_podcasts_dir
from core.config import load_config, save_config
from api.window import get_global_window


class AudioStudioMixin:
    """Mixin pour les fonctionnalités du Studio Audio / Podcasts d'Open Shema."""

    def audio_studio_get_voices(self) -> Dict[str, Any]:
        """Retourne le catalogue complet des voix neuronales francophones disponibles (Edge-TTS et Voxtral)."""
        try:
            cfg = load_config()
            data = PodcastEngine.get_available_voices(cfg)
            return {
                "success": True,
                "voices": data.get("voices", data.get("edge_tts", [])),
                "edge_tts": data.get("edge_tts", []),
                "voxtral": data.get("voxtral", []),
                "gemini_tts": data.get("gemini_tts", []),
                "gemini_models": data.get("gemini_models", []),
                "gemini_quota": data.get("gemini_quota", {})
            }
        except Exception as e:
            logger.error("[AudioStudioMixin] Erreur audio_studio_get_voices : %s", e)
            return {"success": False, "voices": [], "edge_tts": [], "voxtral": [], "gemini_tts": [], "gemini_models": [], "gemini_quota": {}}

    def audio_studio_get_soundpack(self) -> Dict[str, Any]:
        """Retourne le catalogue soundpack (musiques d'ambiance, jingles, etc.)."""
        try:
            data = PodcastEngine.load_soundpack_manifest()
            return {"success": True, "soundpack": data}
        except Exception as e:
            logger.error("[AudioStudioMixin] Erreur audio_studio_get_soundpack : %s", e)
            return {"success": False, "error": str(e), "soundpack": {"tracks": []}}

    def audio_studio_get_soundpack_track_url(self, track_id: Any) -> Dict[str, Any]:
        """Retourne le flux audio MP3 d'une piste sous forme de Data URL base64 pour préécoute immédiate."""
        try:
            if isinstance(track_id, dict):
                track_id = track_id.get("track_id", "")
            track_id = str(track_id)
            p = PodcastEngine.resolve_soundpack_track_path(track_id)
            if p and os.path.exists(p):
                with open(p, "rb") as f:
                    b64 = base64.b64encode(f.read()).decode("ascii")
                    return {"success": True, "audio_url": f"data:audio/mp3;base64,{b64}"}
            return {"success": False, "error": f"Piste introuvable : {track_id}"}
        except Exception as e:
            logger.error("[AudioStudioMixin] Erreur audio_studio_get_soundpack_track_url : %s", e)
            return {"success": False, "error": str(e)}

    def audio_studio_get_voice_sample_url(self, voice_id: Any, engine: str = "edge_tts", role: str = "host") -> Dict[str, Any]:
        """Retourne l'extrait audio MP3 d'une voix sous forme de Data URL base64 pour préécoute immédiate."""
        try:
            if isinstance(voice_id, dict):
                opts = voice_id
                voice_id = opts.get("voice_id", "")
                engine = opts.get("engine", engine)
                role = opts.get("role", role)
            voice_id = str(voice_id)

            raw_bytes = PodcastEngine.get_voice_sample(voice_id=voice_id, engine=engine, role=role)
            if raw_bytes and len(raw_bytes) > 500:
                b64 = base64.b64encode(raw_bytes).decode("ascii")
                data_url = f"data:audio/mp3;base64,{b64}"
                return {"success": True, "audio_url": data_url, "sample_url": data_url}
            return {"success": False, "error": f"Impossible de générer l'échantillon pour {voice_id}"}
        except Exception as e:
            logger.error("[AudioStudioMixin] Erreur audio_studio_get_voice_sample_url : %s", e)
            return {"success": False, "error": str(e)}

    def audio_studio_get_config(self) -> Dict[str, Any]:
        """Retourne les paramètres actuels du Studio Audio."""
        try:
            cfg = load_config()
            sources_cfg = cfg.get("audio_studio_sources") or {}

            # Hériter scrupuleusement des préférences globales de l'utilisateur pour Notes (.md) et Textes UPVR
            include_notes = cfg.get("include_notes_in_ai", True)
            include_upvr = cfg.get("include_upvr_in_ai", True)

            sources = {
                "bibles": sources_cfg.get("bibles", True),
                "commentaries": sources_cfg.get("commentaries", True),
                "dictionaries": sources_cfg.get("dictionaries", True),
                "articles": sources_cfg.get("articles", True),
                "notes": False if not include_notes else sources_cfg.get("notes", True),
                "upvr": False if not include_upvr else sources_cfg.get("upvr", True),
                "theology": sources_cfg.get("theology", True)
            }

            return {
                "engine": cfg.get("audio_studio_engine", "edge_tts"),
                "voice_speaker_a": cfg.get("audio_studio_voice_speaker_a", "fr-FR-VivienneMultilingualNeural"),
                "voice_speaker_b": cfg.get("audio_studio_voice_speaker_b", "fr-CH-FabriceNeural"),
                "voice_solo": cfg.get("audio_studio_voice_solo", "fr-CH-FabriceNeural"),
                "voxtral_voice_speaker_a": cfg.get("audio_studio_voxtral_voice_speaker_a", "Marie - Happy"),
                "voxtral_voice_speaker_b": cfg.get("audio_studio_voxtral_voice_speaker_b", "Marie - Neutral"),
                "voxtral_voice_solo": cfg.get("audio_studio_voxtral_voice_solo", "Marie - Neutral"),
                "pause_ms": int(cfg.get("audio_studio_pause_ms", 350)),
                "voxtral_voice": cfg.get("audio_studio_voxtral_voice", "default"),
                "voxtral_modulate": cfg.get("audio_studio_voxtral_modulate", True),
                "sources": sources,
                "context_depth": int(cfg.get("audio_studio_context_depth", 1)),
                "enable_rerank": cfg.get("audio_studio_enable_rerank", True),
                "enable_curator": cfg.get("audio_studio_enable_curator", False),
                "include_profile": cfg.get("audio_studio_include_profile", True),
                "mastering_enabled": bool(cfg.get("audio_studio_mastering_enabled", True)),
                "calm_prosody": bool(cfg.get("audio_studio_calm_prosody", True)),
                "rate": str(cfg.get("audio_studio_rate", "-6%")),
                "pitch": str(cfg.get("audio_studio_pitch", "-3Hz")),
                "inject_breaks": bool(cfg.get("audio_studio_inject_breaks", True)),
                "bg_music": str(cfg.get("audio_studio_bg_music", "bed_cozy_jazz_study")),
                "jingle_intro": str(cfg.get("audio_studio_jingle_intro", "jingle_piano_solemn")),
                "sfx_ambient": str(cfg.get("audio_studio_sfx_ambient", "none")),
                "ducking_enabled": bool(cfg.get("audio_studio_ducking_enabled", True)),
                "ducking_db": float(cfg.get("audio_studio_ducking_db", -16.0)),
                "has_mistral_key": bool(cfg.get("mistral_api_key")),
                "has_google_key": bool(cfg.get("google_api_key") or cfg.get("gemini_api_key") or os.getenv("GEMINI_API_KEY")),
                "engine_mode": cfg.get("audio_studio_engine_mode", "single"),
                "gemini_model": cfg.get("audio_studio_gemini_model", "gemini-3.1-flash-tts-preview"),
                "gemini_voice_speaker_a": cfg.get("audio_studio_gemini_voice_speaker_a", "Puck"),
                "gemini_voice_speaker_b": cfg.get("audio_studio_gemini_voice_speaker_b", "Charon"),
                "gemini_voice_solo": cfg.get("audio_studio_gemini_voice_solo", "Puck"),
                "speaker_a_engine": cfg.get("audio_studio_speaker_a_engine", "gemini_tts"),
                "speaker_b_engine": cfg.get("audio_studio_speaker_b_engine", "edge_tts"),
                "solo_engine": cfg.get("audio_studio_solo_engine", "gemini_tts"),
                "gemini_tts_rpm_limit": int(cfg.get("gemini_tts_rpm_limit", 3)),
                "gemini_tts_rpd_limit": int(cfg.get("gemini_tts_rpd_limit", 10)),
                "gemini_tts_tpm_limit": int(cfg.get("gemini_tts_tpm_limit", 10000)),
                "gemini_tts_batch_mode": cfg.get("gemini_tts_batch_mode", "dialogue_batch"),
            }
        except Exception as e:
            logger.error("[AudioStudioMixin] Erreur audio_studio_get_config : %s", e)
            return {}

    def audio_studio_save_config(self, new_settings: Dict[str, Any]) -> Dict[str, Any]:
        """Sauvegarde les réglages du Studio Audio."""
        try:
            cfg = load_config()
            if "engine" in new_settings:
                cfg["audio_studio_engine"] = new_settings["engine"]
            if "engine_mode" in new_settings:
                cfg["audio_studio_engine_mode"] = new_settings["engine_mode"]
            if "voice_speaker_a" in new_settings:
                cfg["audio_studio_voice_speaker_a"] = new_settings["voice_speaker_a"]
            if "voice_speaker_b" in new_settings:
                cfg["audio_studio_voice_speaker_b"] = new_settings["voice_speaker_b"]
            if "voice_solo" in new_settings:
                cfg["audio_studio_voice_solo"] = new_settings["voice_solo"]
            if "gemini_model" in new_settings:
                cfg["audio_studio_gemini_model"] = new_settings["gemini_model"]
            if "gemini_voice_speaker_a" in new_settings:
                cfg["audio_studio_gemini_voice_speaker_a"] = new_settings["gemini_voice_speaker_a"]
            if "gemini_voice_speaker_b" in new_settings:
                cfg["audio_studio_gemini_voice_speaker_b"] = new_settings["gemini_voice_speaker_b"]
            if "gemini_voice_solo" in new_settings:
                cfg["audio_studio_gemini_voice_solo"] = new_settings["gemini_voice_solo"]
            if "speaker_a_engine" in new_settings:
                cfg["audio_studio_speaker_a_engine"] = new_settings["speaker_a_engine"]
            if "speaker_b_engine" in new_settings:
                cfg["audio_studio_speaker_b_engine"] = new_settings["speaker_b_engine"]
            if "solo_engine" in new_settings:
                cfg["audio_studio_solo_engine"] = new_settings["solo_engine"]
            if "gemini_tts_rpm_limit" in new_settings:
                cfg["gemini_tts_rpm_limit"] = int(new_settings["gemini_tts_rpm_limit"])
            if "gemini_tts_rpd_limit" in new_settings:
                cfg["gemini_tts_rpd_limit"] = int(new_settings["gemini_tts_rpd_limit"])
            if "gemini_tts_tpm_limit" in new_settings:
                cfg["gemini_tts_tpm_limit"] = int(new_settings["gemini_tts_tpm_limit"])
            if "gemini_tts_batch_mode" in new_settings:
                cfg["gemini_tts_batch_mode"] = new_settings["gemini_tts_batch_mode"]
            if "voxtral_voice_speaker_a" in new_settings:
                cfg["audio_studio_voxtral_voice_speaker_a"] = new_settings["voxtral_voice_speaker_a"]
            if "voxtral_voice_speaker_b" in new_settings:
                cfg["audio_studio_voxtral_voice_speaker_b"] = new_settings["voxtral_voice_speaker_b"]
            if "voxtral_voice_solo" in new_settings:
                cfg["audio_studio_voxtral_voice_solo"] = new_settings["voxtral_voice_solo"]
            if "pause_ms" in new_settings:
                cfg["audio_studio_pause_ms"] = int(new_settings["pause_ms"])
            if "voxtral_voice" in new_settings:
                cfg["audio_studio_voxtral_voice"] = new_settings["voxtral_voice"]
            if "voxtral_modulate" in new_settings:
                cfg["audio_studio_voxtral_modulate"] = bool(new_settings["voxtral_modulate"])
            if "sources" in new_settings and isinstance(new_settings["sources"], dict):
                cfg["audio_studio_sources"] = new_settings["sources"]
                # Synchroniser avec les réglages globaux si modifiés
                if "notes" in new_settings["sources"]:
                    cfg["include_notes_in_ai"] = bool(new_settings["sources"]["notes"])
                if "upvr" in new_settings["sources"]:
                    cfg["include_upvr_in_ai"] = bool(new_settings["sources"]["upvr"])
            if "context_depth" in new_settings:
                cfg["audio_studio_context_depth"] = int(new_settings["context_depth"])
            if "enable_rerank" in new_settings:
                cfg["audio_studio_enable_rerank"] = bool(new_settings["enable_rerank"])
            if "enable_curator" in new_settings:
                cfg["audio_studio_enable_curator"] = bool(new_settings["enable_curator"])
            if "include_profile" in new_settings:
                cfg["audio_studio_include_profile"] = bool(new_settings["include_profile"])
            if "mastering_enabled" in new_settings:
                cfg["audio_studio_mastering_enabled"] = bool(new_settings["mastering_enabled"])
            if "calm_prosody" in new_settings:
                cfg["audio_studio_calm_prosody"] = bool(new_settings["calm_prosody"])
            if "rate" in new_settings:
                cfg["audio_studio_rate"] = str(new_settings["rate"])
            if "pitch" in new_settings:
                cfg["audio_studio_pitch"] = str(new_settings["pitch"])
            if "inject_breaks" in new_settings:
                cfg["audio_studio_inject_breaks"] = bool(new_settings["inject_breaks"])
            if "bg_music" in new_settings:
                cfg["audio_studio_bg_music"] = str(new_settings["bg_music"])
            if "jingle_intro" in new_settings:
                cfg["audio_studio_jingle_intro"] = str(new_settings["jingle_intro"])
            if "sfx_ambient" in new_settings:
                cfg["audio_studio_sfx_ambient"] = str(new_settings["sfx_ambient"])
            if "ducking_enabled" in new_settings:
                cfg["audio_studio_ducking_enabled"] = bool(new_settings["ducking_enabled"])
            if "ducking_db" in new_settings:
                cfg["audio_studio_ducking_db"] = float(new_settings["ducking_db"])

            save_config(cfg)
            return {"success": True}
        except Exception as e:
            logger.error("[AudioStudioMixin] Erreur audio_studio_save_config : %s", e)
            return {"success": False, "error": str(e)}

    def audio_studio_save_gemini_quotas(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Sauvegarde les limites de quotas configurables de Gemini Flash TTS (RPM, RPD, TPM)."""
        try:
            cfg = load_config()
            if "rpm" in params:
                cfg["gemini_tts_rpm_limit"] = int(params["rpm"])
            if "rpd" in params:
                cfg["gemini_tts_rpd_limit"] = int(params["rpd"])
            if "tpm" in params:
                cfg["gemini_tts_tpm_limit"] = int(params["tpm"])
            save_config(cfg)
            from core.podcast_manager import GeminiQuotaTracker
            updated_quota = GeminiQuotaTracker.get_status(
                rpm_limit=int(cfg.get("gemini_tts_rpm_limit", 3)),
                rpd_limit=int(cfg.get("gemini_tts_rpd_limit", 10)),
                tpm_limit=int(cfg.get("gemini_tts_tpm_limit", 10000))
            )
            return {"success": True, "quota": updated_quota}
        except Exception as e:
            logger.error("[AudioStudioMixin] Erreur audio_studio_save_gemini_quotas : %s", e)
            return {"success": False, "error": str(e)}

    def audio_studio_suggest_axes(
        self,
        subject_or_ref: Any,
        study_mode: str = "auto"
    ) -> Dict[str, Any]:
        """Suggère des questions directrices ou axes clés d'étude pour co-construire l'émission."""
        try:
            if isinstance(subject_or_ref, dict):
                opts = subject_or_ref
                subject_or_ref = opts.get("subject_or_ref") or opts.get("query", "")
                study_mode = opts.get("study_mode") or opts.get("mode", "auto")

            cfg = load_config()
            questions = PodcastEngine.suggest_focus_questions(
                subject_or_ref=str(subject_or_ref),
                study_mode=str(study_mode),
                config=cfg
            )
            return {"success": True, "questions": questions}
        except Exception as e:
            logger.error("[AudioStudioMixin] Erreur audio_studio_suggest_axes : %s", e)
            return {"success": False, "error": str(e), "questions": []}

    def audio_studio_generate_script(
        self,
        subject_or_ref: Any,
        format_type: str = "dialogue",
        sources_options: Optional[Dict[str, Any]] = None,
        study_mode: str = "auto",
        focal_questions: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Génère le script structuré de l'émission à partir du sujet et des options RAG."""
        try:
            if isinstance(subject_or_ref, dict):
                opts = subject_or_ref
                subject_or_ref = opts.get("subject_or_ref", "")
                format_type = opts.get("format_type", format_type)
                sources_options = opts.get("sources_options", sources_options)
                study_mode = opts.get("study_mode", study_mode)
                focal_questions = opts.get("focal_questions", focal_questions)
            elif isinstance(sources_options, dict):
                if not study_mode or study_mode == "auto":
                    study_mode = sources_options.get("study_mode", study_mode)
                if not focal_questions:
                    focal_questions = sources_options.get("focal_questions", focal_questions)

            cfg = load_config()
            db_inst = getattr(self, "db", None)

            def _script_progress(pct: int, msg: str):
                try:
                    win = get_global_window()
                    if win:
                        import json as _json
                        # json.dumps() produit un littéral JS sûr (guillemets doubles, séquences
                        # d'échappement complètes) sans risque d'injection JS.
                        safe_msg = _json.dumps(str(msg))
                        win.evaluate_js(f"window.AudioStudioView && window.AudioStudioView.updateScriptProgress({int(pct)}, {safe_msg})")
                except Exception as _e_prog:
                    logger.debug("[audio_studio_generate_script] evaluate_js error: %s", _e_prog)

            res = PodcastEngine.generate_script(
                subject_or_ref=str(subject_or_ref),
                format_type=str(format_type),
                sources_options=sources_options,
                config=cfg,
                db_instance=db_inst,
                study_mode=str(study_mode),
                focal_questions=focal_questions,
                progress_callback=_script_progress
            )
            return {"success": True, "podcast": res}
        except Exception as e:
            logger.error("[AudioStudioMixin] Erreur audio_studio_generate_script : %s", e)
            return {"success": False, "error": str(e)}

    def audio_studio_synthesize(
        self,
        podcast_id: Any,
        script_dialogue: Optional[List[Dict[str, Any]]] = None,
        engine: Optional[str] = None,
        custom_options: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Lance la synthèse audio du script."""
        try:
            if isinstance(podcast_id, dict):
                opts = podcast_id
                podcast_id = opts.get("podcast_id", "")
                script_dialogue = opts.get("script_dialogue", script_dialogue)
                engine = opts.get("engine", engine)
                custom_opts = opts.get("custom_options") or {}
                for k in (
                    "bg_music", "jingle_intro", "sfx_ambient", "sfx", "music_enabled", "jingle_enabled", "sfx_enabled",
                    "ducking_enabled", "ducking_db", "mastering_enabled", "voice_speaker_a", "voice_speaker_b", "voice_solo",
                    "calm_prosody", "rate", "pitch", "inject_breaks", "gemini_model", "gemini_voice_speaker_a",
                    "gemini_voice_speaker_b", "gemini_voice_solo", "speaker_a_engine", "speaker_b_engine", "solo_engine",
                    "engine_mode", "voxtral_voice_speaker_a", "voxtral_voice_speaker_b", "voxtral_voice_solo", "voxtral_modulate"
                ):
                    if k in opts and k not in custom_opts:
                        custom_opts[k] = opts[k]
                custom_options = custom_opts
            elif custom_options is None:
                custom_options = {}

            podcast_id = str(podcast_id)

            def _progress(step_idx: int, pct: int, msg: str):
                try:
                    win = get_global_window()
                    if win:
                        import json as _json
                        safe_msg = _json.dumps(str(msg))
                        win.evaluate_js(f"window.AudioStudioView && window.AudioStudioView.updateSynthesisProgress({int(pct)}, {safe_msg})")
                except Exception as _e_prog:
                    logger.debug("[audio_studio_synthesize] evaluate_js error: %s", _e_prog)

            record = PodcastEngine.synthesize_audio(
                podcast_id=podcast_id,
                script_dialogue=script_dialogue,
                engine=engine,
                custom_options=custom_options,
                progress_callback=_progress
            )

            # Préparer le Data URL audio pour lecture directe
            audio_data_url = self._get_audio_data_url_internal(podcast_id)
            record_copy = dict(record)
            if audio_data_url:
                record_copy["audio_data_url"] = audio_data_url
            return {
                "success": True,
                "podcast": record_copy,
                "audio_url": audio_data_url
            }
        except Exception as e:
            logger.error("[AudioStudioMixin] Erreur audio_studio_synthesize : %s", e)
            return {"success": False, "error": str(e)}

    def audio_studio_get_history(self) -> Dict[str, Any]:
        """Retourne la liste des épisodes enregistrés dans l'historique avec vérification de présence audio."""
        try:
            items = PodcastHistory.load_all()
            pod_dir = get_podcasts_dir()
            for it in items:
                af = it.get("audio_file")
                it["has_audio"] = bool(af and os.path.exists(os.path.join(pod_dir, af)))
            return {"success": True, "items": items}
        except Exception as e:
            logger.error("[AudioStudioMixin] Erreur audio_studio_get_history : %s", e)
            return {"success": False, "items": []}

    def audio_studio_get_podcast(self, podcast_id: Any) -> Dict[str, Any]:
        """Retourne les métadonnées et le script complet d'un épisode avec son audio en Data URL."""
        try:
            if isinstance(podcast_id, dict):
                podcast_id = podcast_id.get("podcast_id", "")
            podcast_id = str(podcast_id)

            record = PodcastHistory.get(podcast_id)
            if not record:
                return {"success": False, "error": "Épisode introuvable."}
            
            audio_url = self._get_audio_data_url_internal(podcast_id)
            record_copy = dict(record)
            if audio_url:
                record_copy["audio_data_url"] = audio_url
            return {"success": True, "podcast": record_copy, "audio_url": audio_url}
        except Exception as e:
            logger.error("[AudioStudioMixin] Erreur audio_studio_get_podcast : %s", e)
            return {"success": False, "error": str(e)}

    def audio_studio_save_mp3(self, podcast_id: Any) -> Dict[str, Any]:
        """Ouvre une boîte de dialogue native pour enregistrer le fichier MP3 sur l'ordinateur de l'utilisateur."""
        try:
            if isinstance(podcast_id, dict):
                podcast_id = podcast_id.get("podcast_id", "")
            podcast_id = str(podcast_id)

            src_path = self.audio_studio_get_audio_file_path(podcast_id)
            if not src_path or not os.path.exists(src_path):
                return {"success": False, "error": "Fichier audio MP3 introuvable sur le disque."}

            record = PodcastHistory.get(podcast_id) or {}
            title = record.get("title", "episode_podcast")
            clean_title = "".join(c for c in title if c.isalnum() or c in (" ", "-", "_")).strip().replace(" ", "_")
            if not clean_title:
                clean_title = f"podcast_{podcast_id}"
            default_filename = f"{clean_title}.mp3"

            win = get_global_window()
            if not win:
                return {"success": False, "error": "Fenêtre de l'application introuvable."}

            save_path = win.create_file_dialog(
                webview.SAVE_DIALOG,
                save_filename=default_filename,
                file_types=('Fichiers Audio MP3 (*.mp3)', 'Tous les fichiers (*.*)')
            )
            if not save_path:
                return {"cancelled": True}
            
            if isinstance(save_path, (list, tuple)):
                if not save_path:
                    return {"cancelled": True}
                dest_path = str(save_path[0])
            else:
                dest_path = str(save_path)

            shutil.copy2(src_path, dest_path)
            return {"success": True, "saved_path": dest_path}
        except Exception as e:
            logger.error("[AudioStudioMixin] Erreur audio_studio_save_mp3 : %s", e)
            return {"success": False, "error": str(e)}

    def audio_studio_delete_podcast(self, podcast_id: Any) -> Dict[str, Any]:
        """Supprime un épisode et son fichier MP3."""
        try:
            if isinstance(podcast_id, dict):
                podcast_id = podcast_id.get("podcast_id", "")
            podcast_id = str(podcast_id)

            ok = PodcastHistory.delete(podcast_id)
            return {"success": ok}
        except Exception as e:
            logger.error("[AudioStudioMixin] Erreur audio_studio_delete_podcast : %s", e)
            return {"success": False, "error": str(e)}

    def audio_studio_export_to_note(self, podcast_id: Any) -> Dict[str, Any]:
        """Exporte le script d'un épisode en note Markdown."""
        try:
            if isinstance(podcast_id, dict):
                podcast_id = podcast_id.get("podcast_id", "")
            podcast_id = str(podcast_id)

            return PodcastEngine.export_to_note(podcast_id)
        except Exception as e:
            logger.error("[AudioStudioMixin] Erreur audio_studio_export_to_note : %s", e)
            return {"success": False, "error": str(e)}

    def audio_studio_get_audio_file_path(self, podcast_id: str) -> Optional[str]:
        """Retourne le chemin absolu du fichier MP3 d'un épisode pour téléchargement."""
        record = PodcastHistory.get(podcast_id)
        if record and record.get("audio_file"):
            p = os.path.join(get_podcasts_dir(), record["audio_file"])
            if os.path.exists(p):
                return p
        return None

    def _get_audio_data_url_internal(self, podcast_id: str) -> Optional[str]:
        """Génère un Data URL audio/mp3 base64 pour lecture directe dans le lecteur webview."""
        p = self.audio_studio_get_audio_file_path(podcast_id)
        if p and os.path.exists(p):
            try:
                with open(p, "rb") as f:
                    b64 = base64.b64encode(f.read()).decode("ascii")
                    return f"data:audio/mp3;base64,{b64}"
            except Exception as e:
                logger.warning("[AudioStudioMixin] Erreur encodage base64 audio : %s", e)
        return None
