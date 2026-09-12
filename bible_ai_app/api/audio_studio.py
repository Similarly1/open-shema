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
import base64
import logging
import threading
from typing import Dict, List, Any, Optional

logger = logging.getLogger("api_audio_studio")

from core.podcast_manager import PodcastEngine, PodcastHistory, get_podcasts_dir
from core.config import load_config, save_config


class AudioStudioMixin:
    """Mixin pour les fonctionnalités du Studio Audio / Podcasts d'Open Shema."""

    def audio_studio_get_voices(self) -> Dict[str, Any]:
        """Retourne le catalogue complet des voix neuronales francophones disponibles."""
        try:
            data = PodcastEngine.get_available_voices()
            voices = data.get("voices", data.get("edge_tts", []))
            return {
                "success": True,
                "voices": voices,
                "edge_tts": voices
            }
        except Exception as e:
            logger.error("[AudioStudioMixin] Erreur audio_studio_get_voices : %s", e)
            return {"success": False, "voices": [], "edge_tts": [], "voxtral": []}

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
                "voice_speaker_a": cfg.get("audio_studio_voice_speaker_a", "fr-FR-DeniseNeural"),
                "voice_speaker_b": cfg.get("audio_studio_voice_speaker_b", "fr-FR-HenriNeural"),
                "voice_solo": cfg.get("audio_studio_voice_solo", "fr-FR-HenriNeural"),
                "pause_ms": int(cfg.get("audio_studio_pause_ms", 350)),
                "voxtral_voice": cfg.get("audio_studio_voxtral_voice", "default"),
                "voxtral_modulate": cfg.get("audio_studio_voxtral_modulate", True),
                "sources": sources,
                "context_depth": int(cfg.get("audio_studio_context_depth", 1)),
                "enable_rerank": cfg.get("audio_studio_enable_rerank", True),
                "enable_curator": cfg.get("audio_studio_enable_curator", False),
                "include_profile": cfg.get("audio_studio_include_profile", True),
                "has_mistral_key": bool(cfg.get("mistral_api_key")),
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
            if "voice_speaker_a" in new_settings:
                cfg["audio_studio_voice_speaker_a"] = new_settings["voice_speaker_a"]
            if "voice_speaker_b" in new_settings:
                cfg["audio_studio_voice_speaker_b"] = new_settings["voice_speaker_b"]
            if "voice_solo" in new_settings:
                cfg["audio_studio_voice_solo"] = new_settings["voice_solo"]
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

            save_config(cfg)
            return {"success": True}
        except Exception as e:
            logger.error("[AudioStudioMixin] Erreur audio_studio_save_config : %s", e)
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
            res = PodcastEngine.generate_script(
                subject_or_ref=str(subject_or_ref),
                format_type=str(format_type),
                sources_options=sources_options,
                config=cfg,
                db_instance=db_inst,
                study_mode=str(study_mode),
                focal_questions=focal_questions
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
                custom_options = opts.get("custom_options", custom_options)

            podcast_id = str(podcast_id)

            def _progress(step_idx: int, pct: int, msg: str):
                try:
                    from core.task_manager import TaskManager
                    TaskManager.push_event("task_progress", {
                        "task_id": f"audio_synth_{podcast_id}",
                        "title": "Synthèse Studio Audio",
                        "progress": pct,
                        "message": msg
                    })
                except Exception:
                    pass

            record = PodcastEngine.synthesize_audio(
                podcast_id=podcast_id,
                script_dialogue=script_dialogue,
                engine=engine,
                custom_options=custom_options,
                progress_callback=_progress
            )

            # Préparer le Data URL audio pour lecture directe
            audio_data_url = self._get_audio_data_url_internal(podcast_id)
            return {
                "success": True,
                "podcast": record,
                "audio_url": audio_data_url
            }
        except Exception as e:
            logger.error("[AudioStudioMixin] Erreur audio_studio_synthesize : %s", e)
            return {"success": False, "error": str(e)}

    def audio_studio_get_history(self) -> Dict[str, Any]:
        """Retourne la liste des épisodes enregistrés dans l'historique."""
        try:
            items = PodcastHistory.load_all()
            return {"success": True, "items": items}
        except Exception as e:
            logger.error("[AudioStudioMixin] Erreur audio_studio_get_history : %s", e)
            return {"success": False, "items": []}

    def audio_studio_get_podcast(self, podcast_id: Any) -> Dict[str, Any]:
        """Retourne les métadonnées et le script complet d'un épisode avec son audio."""
        try:
            if isinstance(podcast_id, dict):
                podcast_id = podcast_id.get("podcast_id", "")
            podcast_id = str(podcast_id)

            record = PodcastHistory.get(podcast_id)
            if not record:
                return {"success": False, "error": "Épisode introuvable."}
            
            audio_url = self._get_audio_data_url_internal(podcast_id)
            return {"success": True, "podcast": record, "audio_url": audio_url}
        except Exception as e:
            logger.error("[AudioStudioMixin] Erreur audio_studio_get_podcast : %s", e)
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
