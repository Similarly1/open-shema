"""
StudyMixin - Extracted from BibleAppApi.
"""
import os
import sys
import re
import datetime
import logging
import json
import sqlite3
import traceback
import asyncio
import webview
import threading
import time
import shutil
from typing import Dict, List, Any, Optional

logger = logging.getLogger(__name__)
from api._utils import (
    current_dir, BibleJsonLoader, extract_verse_text,
    get_french_book_name, resolve_book_input, parse_smart_book_input,
    BOOKS_OT, BOOKS_NT, BOOKS_DEUTERO, ALL_BOOKS, BOOK_MAPPING, strip_accents,
    PericopeManager, CommentaryLoader, DictionaryManager, OriginalLanguagesManager,
    NotesManager, load_config, save_config,
    DEFAULT_NOTE_TITLE_SYSTEM_PROMPT, DEFAULT_NOTE_TAGS_SYSTEM_PROMPT,
    SermonsManager, HighlightsManager, MapsManager,
    load_books_metadata, save_books_metadata, AISessionManager,
    migrate_secrets_from_config, load_secrets_into_config, send_windows_toast,
    BIBLES_REGISTRY_FILE, BIBLE_CANONICAL_INFO,
    strip_xml_tags, load_bibles_registry, find_bible_registry_entry,
    get_cover_data_url, parse_reverse_interlinear_verse,
    _BACKUP_MANIFEST_VERSION, _BACKUP_COMPONENTS
)
current_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
from api.window import get_active_window, get_global_window



class StudyMixin:
    def get_passage_study_data(self, passage_ref: str, bible_name: str = "LSG") -> Dict[str, Any]:
        """Récupère l'ensemble 360° des données d'étude pour un passage (textes multi-versions, hébreu/grec intégral, commentaires, dictionnaires, lieux)."""
        from core.passage_study_manager import PassageStudyManager
        return PassageStudyManager.get_passage_study_data(passage_ref=passage_ref, bible_name=bible_name)

    def get_passage_overview_bundle(self, book_code: str, chapter: int = 1, verse: int = 1, bible_name: str = "LSG") -> Dict[str, Any]:
        """Agrège tout l'écosystème documentaire pour le volet d'aperçu rapide de la page Bible."""
        from core.passage_study_manager import PassageStudyManager
        try:
            ch_int = int(chapter) if chapter is not None else 1
        except (ValueError, TypeError):
            ch_int = 1
        try:
            v_int = int(verse) if verse is not None else 1
        except (ValueError, TypeError):
            v_int = 1
        return PassageStudyManager.get_passage_overview_bundle(
            book_code=book_code or "GEN",
            chapter=ch_int,
            verse=v_int,
            bible_name=bible_name or "LSG"
        )

    def get_bibleproject_media(self, book_code: str, chapter: int = 1) -> Dict[str, Any]:
        """Récupère les vidéos et posters BibleProject (FR) pour un livre et un chapitre donnés."""
        from core.passage_study_manager import PassageStudyManager
        try:
            ch_int = int(chapter) if chapter is not None else 1
        except (ValueError, TypeError):
            ch_int = 1
        return PassageStudyManager.get_bibleproject_media(book_code=book_code or "GEN", chapter=ch_int)

    def get_synoptic_harmony(self, pericope_id: int, bible_name: str = "LSG", pivot_book: Optional[str] = None) -> Dict[str, Any]:
        """Récupère la matrice synoptique complète pour une péricope évangélique avec pivot optionnel."""
        from core.passage_study_manager import PassageStudyManager
        return PassageStudyManager.get_synoptic_harmony(pericope_id=int(pericope_id), bible_name=bible_name, pivot_book=pivot_book)

    def generate_passage_ai_insight(self, passage_ref: str, insight_type: str, model: Optional[str] = None) -> Dict[str, Any]:
        """Génère une analyse exégétique, théologique ou homilétique ciblée par IA pour un passage sans émojis."""
        from core.passage_study_manager import PassageStudyManager
        return PassageStudyManager.generate_passage_ai_insight(passage_ref=passage_ref, insight_type=insight_type, model=model)

    def export_passage_study_to_note(self, passage_ref: str, payload: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Exporte l'étude complète du passage en document Markdown dans les notes de l'utilisateur."""
        from core.passage_study_manager import PassageStudyManager
        return PassageStudyManager.export_passage_study_to_note(passage_ref=passage_ref, payload=payload or {})

    def detect_language(self, text: str, meta_lang: Optional[str] = None) -> Dict[str, Any]:
        """Détecte la langue d'un extrait textuel."""
        from core.translation_manager import TranslationManager
        lang = TranslationManager.detect_language(text, meta_lang)
        return {"language": lang, "is_french": lang == "fr"}

    def get_cached_translation(self, item_type: str, item_id: str) -> Optional[Dict[str, Any]]:
        """Récupère une traduction déjà en cache SQLite si elle existe."""
        from core.translation_manager import TranslationManager
        return TranslationManager.get_translation(item_type=item_type, item_id=item_id, target_lang="fr")

    def translate_text(self, text: str, item_type: str = "", item_id: str = "", model: Optional[str] = None) -> Dict[str, Any]:
        """Traduit un texte spécifique (commentaire, dictionnaire) en français via LLM sans synthétiser."""
        from core.translation_manager import TranslationManager
        from core.config import load_config
        config = load_config()
        try:
            # Vérifier si déjà en cache
            if item_type and item_id:
                cached = TranslationManager.get_translation(item_type=item_type, item_id=item_id, target_lang="fr")
                if cached and cached.get("translated_text"):
                    return {
                        "success": True,
                        "translated_text": cached["translated_text"],
                        "cached": True,
                        "model_used": cached.get("model_used", "Cache")
                    }

            clean_model = model or config.get("translation_model") or "gemini-3.5-flash-lite"
            translated = TranslationManager.translate_text(
                text=text,
                model=clean_model,
                config=config,
                item_type=item_type,
                item_id=item_id
            )
            return {
                "success": True,
                "translated_text": translated,
                "cached": False,
                "model_used": clean_model
            }
        except Exception as e:
            logger.error("Erreur traduction: %s", e)
            return {"success": False, "error": str(e)}

    def translate_theology_toc(self, book_name: str, titles: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Traduit en français l'ensemble des titres de la table des matières d'un livre de théologie."""
        from core.translation_manager import TranslationManager
        from core.config import load_config
        config = load_config()

        if not titles:
            return {"success": False, "error": "Aucun titre fourni", "translated_titles": {}}

        cache_id = f"toc_{book_name}"
        cached = TranslationManager.get_translation(item_type="theology_toc", item_id=cache_id, target_lang="fr")
        if cached and cached.get("translated_text"):
            try:
                import json
                data = json.loads(cached["translated_text"])
                return {"success": True, "translated_titles": data, "cached": True}
            except Exception as _silent_e:
                logger.debug("Erreur ignoree : %s", _silent_e)

        try:
            lines = []
            for item in titles:
                cid = str(item.get("chapter_id", ""))
                title = str(item.get("title", "")).strip()
                if cid and title:
                    lines.append(f"{cid}::: {title}")

            prompt_text = (
                "Tu es un traducteur théologique expert. Traduis fidèlement chaque titre de chapitre ou de section en français soigné.\n"
                "Conserve impérativement le préfixe identifiant exact (ex: '1::: ' ou 'intro::: ') au tout début de chaque ligne.\n"
                "Renvoyez UNIQUEMENT la liste traduite ligne par ligne sans aucun commentaire ni bloc markdown :\n\n"
                + "\n".join(lines)
            )

            clean_model = config.get("translation_model") or "gemini-3.5-flash-lite"
            from ai.llm_client import LLMClient
            models_to_try = [clean_model]
            fallback_model = config.get("translation_fallback_model")
            if fallback_model and fallback_model != clean_model:
                models_to_try.append(fallback_model)

            res_text = None
            for cur_model in models_to_try:
                lower_m = cur_model.lower()
                if "/" in lower_m or "infomaniak" in lower_m or lower_m.startswith("qwen"):
                    token = config.get("infomaniak_token", "")
                    pid = config.get("infomaniak_product_id", "251")
                    client = LLMClient(api_key=token, model=cur_model, provider="infomaniak", product_id=pid)
                elif lower_m.startswith("mistral-") or lower_m.startswith("open-mistral-"):
                    api_key = config.get("mistral_api_key", "")
                    client = LLMClient(api_key=api_key, model=cur_model, provider="mistral")
                else:
                    api_key = config.get("gemini_api_key", "")
                    client = LLMClient(api_key=api_key, model=cur_model, provider="gemini")

                try:
                    out = client.chat(messages=[{"role": "user", "content": prompt_text}], system_prompt="Traducteur de titres théologiques.")
                    if out and not str(out).startswith("Erreur"):
                        res_text = out
                        break
                except Exception as e:
                    logger.warning("Échec traduction TOC avec %s: %s", cur_model, e)

            if not res_text:
                raise Exception("Échec de la traduction des titres par le modèle IA.")

            result_map = {}
            for line in res_text.splitlines():
                line = line.strip()
                if ":::" in line:
                    parts = line.split(":::", 1)
                    k = parts[0].strip().replace("-", "").replace("*", "").strip()
                    val = parts[1].strip()
                    if k and val:
                        result_map[k] = val

            import json
            TranslationManager.save_translation(
                item_type="theology_toc",
                item_id=cache_id,
                translated_text=json.dumps(result_map, ensure_ascii=False),
                model_used=clean_model,
                source_lang="auto",
                target_lang="fr",
                original_text="\n".join(lines)
            )

            return {"success": True, "translated_titles": result_map, "cached": False}
        except Exception as e:
            logger.error("Erreur translate_theology_toc: %s", e)
            return {"success": False, "error": str(e), "translated_titles": {}}

    def save_note(self, *args, **kwargs) -> Dict[str, Any]:
        """Enregistre ou met à jour une note au format Markdown (.md)."""
        self.config = load_config()
        target_dir = NotesManager.get_notes_directory(self.config)
        note = {}
        if args and isinstance(args[0], dict):
            note = args[0]
        elif len(args) >= 2:
            note = {
                "title": args[0],
                "content": args[1],
                "reference": args[2] if len(args) > 2 else "",
                "tags": args[3] if len(args) > 3 else [],
                "id": args[4] if len(args) > 4 else None
            }
        elif kwargs:
            note = kwargs
        return NotesManager.save_note_file(note, target_dir)

    def delete_note(self, note_id: str) -> bool:
        """Supprime le fichier Markdown (.md) d'une note."""
        self.config = load_config()
        target_dir = NotesManager.get_notes_directory(self.config)
        return NotesManager.delete_note_file(note_id, target_dir)

    def save_highlight(self, *args, **kwargs) -> Dict[str, Any]:
        self.config = load_config()
        data = {}
        if args and isinstance(args[0], dict):
            data = args[0]
        elif kwargs:
            data = kwargs
        return HighlightsManager.save_highlight(data, config=self.config)

    def get_highlights_for_chapter(self, book: str, chapter: int, version: str = "") -> List[Dict[str, Any]]:
        self.config = load_config()
        return HighlightsManager.get_highlights_for_chapter(book, chapter, version=version, config=self.config)

    def get_notes_list(self) -> List[Dict[str, Any]]:
        """Charge toutes les notes personnelles sous forme de fichiers Markdown (.md)."""
        self.config = load_config()
        return NotesManager.list_notes(self.config)

    def delete_highlight(self, hl_id: str) -> bool:
        self.config = load_config()
        return HighlightsManager.delete_highlight(hl_id, config=self.config)

    def create_note_from_highlight(self, hl_id: str, hl_text: str, hl_ref: str) -> Dict[str, Any]:
        """Crée une note préremplie liée à un surlignage."""
        self.config = load_config()
        target_dir = NotesManager.get_notes_directory(self.config)
        note_data = {
            "title": f"Note sur {hl_ref}",
            "reference": hl_ref,
            "content": f"> \"{hl_text}\"\n\n",
            "tags": ["surlignage"]
        }
        note_res = NotesManager.save_note_file(note_data, target_dir)
        if note_res and "id" in note_res:
            HighlightsManager.link_note(hl_id, note_res["id"], config=self.config)
        return note_res

    def open_highlights_folder(self) -> Dict[str, Any]:
        """Ouvre le dossier contenant le fichier de surlignages dans l'explorateur de fichiers."""
        self.config = load_config()
        hl_file = HighlightsManager.get_highlights_file(self.config)
        hl_dir = os.path.dirname(hl_file)
        try:
            if os.name == 'nt':
                if os.path.exists(hl_file):
                    import subprocess
                    subprocess.Popen(f'explorer /select,"{os.path.normpath(hl_file)}"')
                else:
                    os.startfile(hl_dir)
            elif sys.platform == 'darwin':
                import subprocess
                if os.path.exists(hl_file):
                    subprocess.Popen(['open', '-R', hl_file])
                else:
                    subprocess.Popen(['open', hl_dir])
            else:
                import subprocess
                subprocess.Popen(['xdg-open', hl_dir])
            return {"success": True, "path": hl_file if os.path.exists(hl_file) else hl_dir}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def import_highlights(self, mode: str = "merge") -> Dict[str, Any]:
        """Importe des surlignages depuis un fichier JSON choisi par l'utilisateur."""
        win = get_active_window()
        if not win:
            return {"success": False, "error": "Fenêtre introuvable"}

        pick = win.create_file_dialog(
            webview.OPEN_DIALOG,
            allow_multiple=False,
            file_types=('Fichiers JSON (*.json)', 'Tous les fichiers (*.*)')
        )
        if not pick or len(pick) == 0:
            return {"cancelled": True}

        file_path = pick[0]
        self.config = load_config()

        try:
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()
            res = HighlightsManager.import_from_json(content, mode=mode, config=self.config)
            return res
        except Exception as e:
            return {"success": False, "error": str(e)}

    def pick_notes_folder(self) -> Dict[str, Any]:
        """Ouvre un dialogue natif Windows pour choisir le dossier des notes Markdown."""
        win = get_active_window()
        if not win:
            return {"success": False, "error": "Fenêtre introuvable"}
        result = win.create_file_dialog(webview.FOLDER_DIALOG)
        if not result or len(result) == 0:
            return {"cancelled": True}
        folder_path = result[0]
        return {"success": True, "path": folder_path}

    def get_notes_for_passage(self, book: str, chapter: int, verse: Optional[int] = None) -> List[Dict[str, Any]]:
        """Retourne les notes personnelles associées à un passage biblique."""
        self.config = load_config()
        french = get_french_book_name(book)
        return NotesManager.get_notes_for_passage(french, chapter, verse, config=self.config)

    def search_all(self, query: str, corpus: str = "ALL", match_mode: str = "ALL_WORDS", source_type: str = "Tous") -> Dict[str, Any]:
        """Recherche plein-texte haute performance dans les Bibles et commentaires."""
        from core.search_engine import SearchEngine
        engine = SearchEngine.get_instance()
        
        results = []
        if source_type in ["Tous", "Bibles", "Bible"]:
            bible_res = engine.search_bibles(query, corpus=corpus, match_mode=match_mode, limit=150)
            for r in bible_res:
                r["type"] = "Bible"
                results.append(r)
                
        if source_type in ["Tous", "Commentaires", "Commentaire"]:
            comm_res = engine.search_commentaries(query, match_mode=match_mode, limit=80)
            for r in comm_res:
                r["type"] = "Commentaire"
                results.append(r)
                
        return {"count": len(results), "results": results[:150]}

    def open_notes_folder(self) -> Dict[str, Any]:
        """Ouvre le dossier des notes dans l'explorateur de fichiers de l'ordinateur."""
        self.config = load_config()
        notes_dir = NotesManager.get_notes_directory(self.config)
        try:
            if os.name == 'nt':
                os.startfile(notes_dir)
            elif sys.platform == 'darwin':
                import subprocess
                subprocess.Popen(['open', notes_dir])
            else:
                import subprocess
                subprocess.Popen(['xdg-open', notes_dir])
            return {"success": True, "path": notes_dir}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def generate_note_tags(self, content: str, reference: str = "", current_tags: str = "") -> Dict[str, Any]:
        """Génère automatiquement des tags pour une note à partir de son contenu."""
        self.config = load_config()
        clean_content = (content or "").strip()
        if not clean_content:
            return {"success": False, "error": "Le contenu de la note est vide."}

        sys_prompt = self.config.get("prompt_note_tags") or self.config.get("note_tags_system_prompt") or DEFAULT_NOTE_TAGS_SYSTEM_PROMPT
        clean_model = self.config.get("notes_ai_model") or self.config.get("title_model") or "gemini-3.7-flash"
        fallback_model = self.config.get("notes_ai_fallback_model") or self.config.get("title_fallback_model") or "gemini-3.5-flash-lite"

        models_to_try = [clean_model]
        if fallback_model and fallback_model != clean_model:
            models_to_try.append(fallback_model)

        user_prompt = f"Contenu de la note :\n\"\"\"\n{clean_content[:4000]}\n\"\"\""
        if reference:
            user_prompt += f"\n\nPassage biblique lié : {reference}"

        from ai.llm_client import LLMClient
        used_model = clean_model
        last_err = None
        generated_tags = None

        for cur_model in models_to_try:
            lower_m = cur_model.lower()
            if "/" in lower_m or "infomaniak" in lower_m or lower_m.startswith("qwen") or "swiss-ai" in lower_m or "gemma" in lower_m:
                token = self.config.get("infomaniak_token", "")
                pid = self.config.get("infomaniak_product_id", "251")
                client = LLMClient(api_key=token, model=cur_model, provider="infomaniak", product_id=pid)
            elif lower_m.startswith("mistral-") or lower_m.startswith("open-mistral-") or "codestral" in lower_m:
                api_key = self.config.get("mistral_api_key", "")
                client = LLMClient(api_key=api_key, model=cur_model, provider="mistral")
            else:
                api_key = self.config.get("gemini_api_key", "")
                client = LLMClient(api_key=api_key, model=cur_model, provider="gemini")

            try:
                out = client.chat(messages=[{"role": "user", "content": user_prompt}], system_prompt=sys_prompt)
                if out and not str(out).startswith("Erreur"):
                    clean_res = str(out).strip().strip('"\'').strip('`')
                    clean_res = re.sub(r'^(Tags\s*:\s*|Mots-clés\s*:\s*)', '', clean_res, flags=re.IGNORECASE).strip()
                    clean_res = re.sub(r'^\s*[-*•]\s*', '', clean_res, flags=re.MULTILINE)
                    clean_res = clean_res.replace('\n', ', ')
                    clean_res = re.sub(r',\s*,+', ',', clean_res).strip(', ')
                    if clean_res:
                        generated_tags = clean_res
                        used_model = cur_model
                        break
                else:
                    last_err = out
            except Exception as e:
                last_err = str(e)
                logger.warning("Échec génération tags note avec %s: %s", cur_model, e)

        if not generated_tags:
            return {"success": False, "error": f"Impossible de générer les tags : {last_err}"}

        return {
            "success": True,
            "tags": generated_tags,
            "model_used": used_model
        }

    def export_highlights(self, format: str = "json") -> Dict[str, Any]:
        """Exporte tous les surlignages vers un fichier JSON ou Markdown choisi par l'utilisateur."""
        win = get_active_window()
        if not win:
            return {"success": False, "error": "Fenêtre introuvable"}

        now_str = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        self.config = load_config()

        if format.lower() in ["md", "markdown"]:
            default_name = f"surlignages_bibliques_{now_str}.md"
            file_types = ('Fichiers Markdown (*.md)', 'Tous les fichiers (*.*)')
            content = HighlightsManager.export_to_markdown(self.config)
        else:
            default_name = f"surlignages_bibliques_{now_str}.json"
            file_types = ('Fichiers JSON (*.json)', 'Tous les fichiers (*.*)')
            content = HighlightsManager.export_to_json(self.config)

        save_path = win.create_file_dialog(
            webview.SAVE_DIALOG,
            save_filename=default_name,
            file_types=file_types
        )
        if not save_path:
            return {"cancelled": True}

        if isinstance(save_path, (list, tuple)):
            save_path = save_path[0]

        try:
            with open(save_path, "w", encoding="utf-8") as f:
                f.write(content)
            return {"success": True, "path": save_path, "format": format}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def generate_note_title(self, content: str, reference: str = "", current_title: str = "") -> Dict[str, Any]:
        """Génère automatiquement un titre pour une note à partir de son contenu."""
        self.config = load_config()
        clean_content = (content or "").strip()
        if not clean_content:
            return {"success": False, "error": "Le contenu de la note est vide."}

        sys_prompt = self.config.get("prompt_note_title") or self.config.get("note_title_system_prompt") or DEFAULT_NOTE_TITLE_SYSTEM_PROMPT
        clean_model = self.config.get("notes_ai_model") or self.config.get("title_model") or "gemini-3.7-flash"
        fallback_model = self.config.get("notes_ai_fallback_model") or self.config.get("title_fallback_model") or "gemini-3.5-flash-lite"

        models_to_try = [clean_model]
        if fallback_model and fallback_model != clean_model:
            models_to_try.append(fallback_model)

        user_prompt = f"Contenu de la note :\n\"\"\"\n{clean_content[:4000]}\n\"\"\""
        if reference:
            user_prompt += f"\n\nPassage biblique lié : {reference}"

        from ai.llm_client import LLMClient
        used_model = clean_model
        last_err = None
        generated_title = None

        for cur_model in models_to_try:
            lower_m = cur_model.lower()
            if "/" in lower_m or "infomaniak" in lower_m or lower_m.startswith("qwen") or "swiss-ai" in lower_m or "gemma" in lower_m:
                token = self.config.get("infomaniak_token", "")
                pid = self.config.get("infomaniak_product_id", "251")
                client = LLMClient(api_key=token, model=cur_model, provider="infomaniak", product_id=pid)
            elif lower_m.startswith("mistral-") or lower_m.startswith("open-mistral-") or "codestral" in lower_m:
                api_key = self.config.get("mistral_api_key", "")
                client = LLMClient(api_key=api_key, model=cur_model, provider="mistral")
            else:
                api_key = self.config.get("gemini_api_key", "")
                client = LLMClient(api_key=api_key, model=cur_model, provider="gemini")

            try:
                out = client.chat(messages=[{"role": "user", "content": user_prompt}], system_prompt=sys_prompt)
                if out and not str(out).startswith("Erreur"):
                    clean_res = str(out).strip().strip('"\'').strip('«»').strip('`')
                    clean_res = re.sub(r'^(Titre\s*:\s*|Title\s*:\s*)', '', clean_res, flags=re.IGNORECASE).strip()
                    if clean_res:
                        generated_title = clean_res
                        used_model = cur_model
                        break
                else:
                    last_err = out
            except Exception as e:
                last_err = str(e)
                logger.warning("Échec génération titre note avec %s: %s", cur_model, e)

        if not generated_title:
            return {"success": False, "error": f"Impossible de générer le titre : {last_err}"}

        return {
            "success": True,
            "title": generated_title,
            "model_used": used_model
        }

    def delete_highlights_for_passage(self, book: str, chapter: int, verse_start: int, verse_end: int, version: str = "") -> int:
        self.config = load_config()
        return HighlightsManager.delete_highlights_for_passage(book, int(chapter), int(verse_start), int(verse_end), version=version, config=self.config)

    def get_all_highlights(self) -> List[Dict[str, Any]]:
        self.config = load_config()
        return HighlightsManager.get_all_highlights(config=self.config)

    def pick_highlights_file(self) -> Dict[str, Any]:
        """Ouvre un dialogue natif Windows pour choisir ou créer un fichier JSON de surlignages."""
        win = get_active_window()
        if not win:
            return {"success": False, "error": "Fenêtre introuvable"}
        result = win.create_file_dialog(
            webview.SAVE_DIALOG,
            save_filename="highlights.json",
            file_types=('Fichiers JSON (*.json)', 'Tous les fichiers (*.*)')
        )
        if not result:
            return {"cancelled": True}
        if isinstance(result, (list, tuple)):
            result = result[0]
        return {"success": True, "path": result}

