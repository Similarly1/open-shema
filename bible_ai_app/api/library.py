"""
LibraryMixin - Extracted from BibleAppApi.
"""
import os
import sys
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



class LibraryMixin:
    def get_library_books(self) -> List[Dict[str, Any]]:
        """Retourne tous les ouvrages de la bibliothèque (Bibles, Théologie, Dictionnaires) avec leurs couvertures."""
        registry = load_books_metadata()
        books = []
        registered_dict_ids = set()

        for name, meta in registry.items():
            b = meta.copy()
            b["name"] = name
            cov_p = b.get("cover_path")
            data_url = get_cover_data_url(cov_p)
            b["cover_data_url"] = data_url
            if data_url:
                b["cover_url"] = data_url
            if b.get("type") == "Dictionnaire" or b.get("dict_id"):
                registered_dict_ids.add(b.get("dict_id") or b.get("name"))
            books.append(b)

        # Intégrer également tous les dictionnaires enregistrés dans DictionaryManager
        dict_registry = DictionaryManager.get_all_dictionaries()
        covers_dir = os.path.join(current_dir, "data", "covers")
        
        for d in dict_registry:
            d_id = d.get("id")
            d_name = d.get("name")
            dict_desc = d.get("description") or f"Dictionnaire biblique comprenant {d.get('count', 0):,} articles et définitions.".replace(",", " ")
            
            # Vérifier si déjà présent dans books
            matched_book = next((b for b in books if b.get("dict_id") == d_id or b.get("name") == d_name or b.get("title") == d_name), None)
            if matched_book:
                matched_book["dict_id"] = d_id
                matched_book["type"] = "Dictionnaire"
                matched_book["articles_count"] = d.get("count", 0)
                matched_book["active"] = d.get("enabled", True)
                if dict_desc and not matched_book.get("description"):
                    matched_book["description"] = dict_desc
                elif d.get("description"):
                    matched_book["description"] = d.get("description")
            else:
                # Chercher une couverture automatique dans data/covers/
                cov_path = None
                if os.path.exists(covers_dir):
                    for fn in os.listdir(covers_dir):
                        fn_l = fn.lower()
                        if (d_id in fn_l) or ("calmet" in d_id and "calmet" in fn_l) or ("vigo" in d_id and "vigo" in fn_l) or ("nouveau" in d_id and "nouveau" in fn_l):
                            cov_path = os.path.join(covers_dir, fn)
                            break
                
                author_name = d.get("author") or ("Dom Calmet" if d_id == "calmet" else ("F. Vigouroux" if d_id == "vigouroux" else ("Anatole Bailly" if d_id == "bailly" else ("James Strong" if d_id == "strong" else "Collectif"))))
                year_val = d.get("year") or ("1728" if d_id == "calmet" else ("1912" if d_id == "vigouroux" else ("1901" if d_id == "bailly" else ("1890" if d_id == "strong" else ""))))
                
                books.append({
                    "name": d_name,
                    "title": d_name,
                    "dict_id": d_id,
                    "author": author_name,
                    "year": str(year_val),
                    "type": "Dictionnaire",
                    "description": dict_desc,
                    "chapters_count": 0,
                    "articles_count": d.get("count", 0),
                    "active": d.get("enabled", True),
                    "cover_path": cov_path,
                    "cover_data_url": get_cover_data_url(cov_path) if cov_path else None,
                    "format": "dict"
                })

        return books

    def get_cover_image_data(self, cover_path: str) -> Dict[str, Any]:
        """Retourne la Data URL Base64 d'une couverture pour le frontend."""
        data_url = get_cover_data_url(cover_path)
        return {"success": bool(data_url), "data_url": data_url}

    def toggle_book(self, book_name: str, active: bool) -> bool:
        """Active ou désactive un ouvrage ou dictionnaire."""
        # 1. Vérifier si c'est un dictionnaire dans DictionaryManager
        dict_reg = DictionaryManager.load_registry()
        for d in dict_reg:
            if d.get("name") == book_name or d.get("id") == book_name:
                d["enabled"] = bool(active)
                DictionaryManager.save_registry(dict_reg)
                break

        registry = load_books_metadata()
        if book_name in registry:
            registry[book_name]["active"] = bool(active)
            save_books_metadata(registry)
            return True
        return True

    def delete_book(self, book_name: str) -> bool:
        """Supprime définitivement un ouvrage."""
        registry = load_books_metadata()
        if book_name in registry:
            info = registry[book_name]
            folder_name = info.get("folder_name", book_name.replace(" ", "_"))
            json_dir = os.path.join(current_dir, "data", "bibles", folder_name)
            if os.path.exists(json_dir):
                try:
                    shutil.rmtree(json_dir)
                except Exception as _silent_e:
                    logger.debug("Erreur ignoree : %s", _silent_e)
            BibleJsonLoader.clear_cache()
            del registry[book_name]
            save_books_metadata(registry)
            return True
        return False

    def update_book_metadata(self, book_name: str, new_meta: Dict[str, Any]) -> bool:
        """Met à jour les métadonnées d'un livre."""
        registry = load_books_metadata()
        if book_name in registry:
            registry[book_name].update(new_meta)
            save_books_metadata(registry)
            return True
        return False

    def get_theology_books(self) -> List[Dict[str, Any]]:
        """Retourne tous les ouvrages de théologie indexés avec leurs métadonnées et couvertures."""
        from core.theology_reader_manager import TheologyReaderManager
        return TheologyReaderManager.get_all_theology_books()

    def get_theology_book_toc(self, book_name: str) -> Dict[str, Any]:
        """Récupère la table des matières ordonnée d'un ouvrage de théologie."""
        from core.theology_reader_manager import TheologyReaderManager
        return TheologyReaderManager.get_book_toc(book_name)

    def get_theology_chapter_content(self, book_name: str, chapter_id: int) -> Dict[str, Any]:
        """Récupère le contenu intégral d'un chapitre d'ouvrage de théologie."""
        from core.theology_reader_manager import TheologyReaderManager
        return TheologyReaderManager.get_chapter_content(book_name, chapter_id)

    def synthesize_theology_chapter(self, book_name: str, chapter_id: int, model: Optional[str] = None) -> Dict[str, Any]:
        """Génère une synthèse exégétique et théologique IA d'un chapitre."""
        from core.theology_reader_manager import TheologyReaderManager
        self.config = load_config()
        return TheologyReaderManager.synthesize_chapter(book_name, chapter_id, model=model, config=self.config)

    def search_theology_books(self, query: str, book_name: Optional[str] = None) -> List[Dict[str, Any]]:
        """Recherche plein-texte dans les ouvrages de théologie."""
        from core.theology_reader_manager import TheologyReaderManager
        return TheologyReaderManager.search_theology_books(query, book_name=book_name)

    def get_dictionaries(self) -> List[Dict[str, Any]]:
        dicts = DictionaryManager.get_all_dictionaries()
        covers_dir = os.path.join(current_dir, "data", "covers")
        for d in dicts:
            d_id = d.get("id", "").lower()
            d_name = d.get("name", "").lower()
            cov_path = None
            if os.path.exists(covers_dir):
                for fn in os.listdir(covers_dir):
                    fn_l = fn.lower()
                    if (d_id and d_id in fn_l) or ("nouveau" in d_id and "nouveau" in fn_l) or ("calmet" in d_id and "calmet" in fn_l) or ("vigo" in d_id and "vigo" in fn_l) or ("strong" in d_id and "strong" in fn_l) or ("bailly" in d_id and "bailly" in fn_l):
                        cov_path = os.path.join(covers_dir, fn)
                        break
            if cov_path:
                data_url = get_cover_data_url(cov_path)
                d["cover_path"] = cov_path
                d["cover_data_url"] = data_url
                d["cover_url"] = data_url
        return dicts

    def get_dictionary_headwords(self, dict_id: str, letter: Optional[str] = None, query: Optional[str] = None, limit: int = 300, offset: int = 0) -> Dict[str, Any]:
        return DictionaryManager.get_headwords(dict_id, letter=letter, query=query, limit=limit, offset=offset)

    def get_dictionary_entry(self, dict_id: str, slug: str, strong_code: Optional[str] = None) -> Dict[str, Any]:
        return DictionaryManager.get_entry_content(dict_id, slug, strong_code=strong_code)

    def get_dictionary_valid_headwords(self, dict_id: str) -> List[str]:
        return DictionaryManager.get_all_headword_titles(dict_id)

    def save_dictionaries(self, dict_list: List[Dict[str, Any]]) -> bool:
        DictionaryManager.save_registry(dict_list)
        return True

    def get_stepbible_status(self) -> Dict[str, Any]:
        return OriginalLanguagesManager.get_instance().get_stats()

    def reindex_stepbible(self) -> bool:
        mgr = OriginalLanguagesManager.get_instance()
        return mgr.download_and_import()

    def polish_dictionary_article(self, dict_id: str, title: str, raw_text: str, model: Optional[str] = None, slug: Optional[str] = None) -> Dict[str, Any]:
        """Améliore et restructure une notice de dictionnaire ancien avec l'IA (Mistral 14B / Infomaniak)."""
        from core.dictionary_polisher import DictionaryPolisher
        target_model = model or self.config.get("infomaniak_polish_model") or "mistralai/Ministral-3-14B-Instruct-2512"
        success, result = DictionaryPolisher.polish_article(raw_text, title=title, model=target_model, config=self.config)
        if success:
            DictionaryPolisher.set_polished_entry(dict_id, slug or title, title, result, target_model, slug=slug)
            return {"success": True, "text": result, "model": target_model}
        else:
            return {"success": False, "error": result}

    def pick_ebooks_folder(self) -> Dict[str, Any]:
        """Ouvre un dialogue natif Windows pour choisir le dossier des ebooks théologiques (EPUB)."""
        win = get_active_window()
        if not win:
            return {"success": False, "error": "Fenêtre introuvable"}
        result = win.create_file_dialog(webview.FOLDER_DIALOG)
        if not result or len(result) == 0:
            return {"cancelled": True}
        folder_path = result[0]
        return {"success": True, "path": folder_path}

    def summarize_theology_chapter(self, book_name: str, chapter_id: str, chapter_title: str, text: str, word_count: Optional[int] = None, model: Optional[str] = None) -> Dict[str, Any]:
        """Génère un résumé synthétique, structuré et clair d'un chapitre de théologie via LLM."""
        from core.translation_manager import TranslationManager
        from core.config import load_config, DEFAULT_SUMMARY_SYSTEM_PROMPT
        config = load_config()

        cache_id = f"summary_{book_name}_{chapter_id}"
        cached = TranslationManager.get_translation(item_type="theology_summary", item_id=cache_id, target_lang="fr")
        if cached and cached.get("translated_text"):
            return {
                "success": True,
                "summary_markdown": cached["translated_text"],
                "cached": True,
                "model_used": cached.get("model_used", "Cache")
            }

        try:
            target_words = word_count or config.get("summary_word_count") or 300
            sys_prompt = config.get("summary_system_prompt") or DEFAULT_SUMMARY_SYSTEM_PROMPT
            clean_model = model or config.get("summary_model") or "gemini-3.7-flash"

            user_prompt = (
                f"Rédige un résumé structuré et soigné d'environ {target_words} mots du chapitre théologique suivant :\n\n"
                f"Ouvrage : {book_name}\n"
                f"Chapitre : {chapter_title} (ID: {chapter_id})\n\n"
                f"--- TEXTE DU CHAPITRE ---\n{text[:16000]}"
            )

            from ai.llm_client import LLMClient
            models_to_try = [clean_model]
            fallback_model = config.get("summary_fallback_model")
            if fallback_model and fallback_model != clean_model:
                models_to_try.append(fallback_model)

            summary_text = None
            used_model = clean_model
            last_err = None

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
                    out = client.chat(messages=[{"role": "user", "content": user_prompt}], system_prompt=sys_prompt)
                    if out and not str(out).startswith("Erreur"):
                        summary_text = out.strip()
                        used_model = cur_model
                        break
                    else:
                        last_err = out
                except Exception as e:
                    last_err = str(e)
                    logger.warning("Échec résumé chapitre avec %s: %s", cur_model, e)

            if not summary_text:
                raise Exception(f"Échec de la génération du résumé ({used_model}) : {last_err}")

            if summary_text.startswith("```markdown") and summary_text.endswith("```"):
                summary_text = summary_text[11:-3].strip()
            elif summary_text.startswith("```") and summary_text.endswith("```"):
                summary_text = summary_text[3:-3].strip()

            TranslationManager.save_translation(
                item_type="theology_summary",
                item_id=cache_id,
                translated_text=summary_text,
                model_used=used_model,
                source_lang="auto",
                target_lang="fr",
                original_text=text[:1000]
            )

            return {
                "success": True,
                "summary_markdown": summary_text,
                "cached": False,
                "model_used": used_model
            }
        except Exception as e:
            logger.error("Erreur summarize_theology_chapter: %s", e)
            return {
                "success": False,
                "error": str(e),
                "summary_markdown": None
            }

    def lookup_dictionary(self, word: str, strong_code: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Recherche une entrée dans les dictionnaires actifs."""
        return DictionaryManager.lookup(word, strong_code)

    def get_theology_chapter_snippet(self, book_name: str, chapter_id: Any, book_code: str, chapter: int, verse: int = 1) -> Dict[str, Any]:
        """Extrait à la demande au survol le passage textuel pertinent d'un chapitre de théologie."""
        try:
            from core.theology_reader_manager import TheologyReaderManager
            snippet = TheologyReaderManager.get_theology_chapter_snippet(
                book_name, chapter_id, book_code, chapter, verse
            )
            return {"success": True, "snippet": snippet}
        except Exception as e:
            logger.error(f"Erreur get_theology_chapter_snippet: {e}")
            return {"success": False, "snippet": "", "error": str(e)}

    def get_word_pronunciation_audio(self, word: str, lang: str = "he", strong_code: str = "") -> Dict[str, Any]:
        """Télécharge ou récupère du cache l'audio MP3 haute fidélité de prononciation d'un mot hébreu ou grec."""
        try:
            import os, urllib.request, urllib.parse, base64, hashlib
            base_dir = os.path.dirname(os.path.abspath(__file__))
            cache_dir = os.path.join(base_dir, "data", "audio_cache")
            os.makedirs(cache_dir, exist_ok=True)

            code_clean = (strong_code or "").strip().upper()
            if code_clean:
                filename = f"{code_clean}.mp3"
            else:
                h = hashlib.md5(f"{lang}_{word}".encode("utf-8")).hexdigest()[:10]
                filename = f"{lang}_{h}.mp3"

            file_path = os.path.join(cache_dir, filename)

            # Si déjà en cache
            if os.path.exists(file_path) and os.path.getsize(file_path) > 100:
                with open(file_path, "rb") as f:
                    audio_b64 = base64.b64encode(f.read()).decode("utf-8")
                return {"success": True, "audio_base64": f"data:audio/mp3;base64,{audio_b64}", "cached": True}

            # Sinon, téléchargement à la demande
            tl = "iw" if lang in ("he", "hebrew", "iw") else "el"
            q = urllib.parse.quote(word.strip())
            url = f"https://translate.google.com/translate_tts?ie=UTF-8&q={q}&tl={tl}&client=tw-ob"

            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
            with urllib.request.urlopen(req, timeout=8) as resp:
                audio_bytes = resp.read()

            if audio_bytes and len(audio_bytes) > 100:
                with open(file_path, "wb") as f:
                    f.write(audio_bytes)
                audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")
                return {"success": True, "audio_base64": f"data:audio/mp3;base64,{audio_b64}", "cached": False}

            return {"success": False, "error": "Fichier audio vide."}
        except Exception as e:
            logger.error(f"Erreur get_word_pronunciation_audio ({word}, {lang}): {e}")
            return {"success": False, "error": str(e)}

    def open_ebooks_folder(self) -> Dict[str, Any]:
        """Ouvre le dossier des ebooks théologiques dans l'explorateur de fichiers."""
        self.config = load_secrets_into_config(load_config())
        ebooks_dir = self.config.get("ebooks_dir", "")
        if not ebooks_dir or not os.path.isdir(ebooks_dir):
            _app_root = os.path.dirname(os.path.abspath(__file__))
            ebooks_dir = os.path.join(_app_root, "data", "ebooks")
            os.makedirs(ebooks_dir, exist_ok=True)
        try:
            if os.name == 'nt':
                os.startfile(ebooks_dir)
            elif sys.platform == 'darwin':
                import subprocess
                subprocess.Popen(['open', ebooks_dir])
            else:
                import subprocess
                subprocess.Popen(['xdg-open', ebooks_dir])
            return {"success": True, "path": ebooks_dir}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def report_typo(self, book_title: str, entry_title: str, selected_text: str, user_comment: str, user_email: str = None) -> Dict[str, Any]:
        """
        Transmet un signalement de coquille / erreur directement vers l'alias email anonaddy/addy.io configuré.
        """
        import urllib.request
        import urllib.parse
        import json

        FEEDBACK_EMAIL = "0wl8a4k7@family3130.anonaddy.com"
        try:
            subject = f"[Open Shema Coquille] {book_title} — {entry_title}"
            payload = {
                "_subject": subject,
                "Ouvrage": str(book_title or "Non spécifié"),
                "Article_ou_Chapitre": str(entry_title or "Non spécifié"),
                "Extrait_concerne": str(selected_text) if selected_text else "(Aucun extrait surligné)",
                "Remarque_ou_Correction": str(user_comment or ""),
                "Email_lecteur": str(user_email) if user_email else "Non renseigné",
                "_template": "table",
                "_captcha": "false"
            }
            
            url = f"https://formsubmit.co/ajax/{FEEDBACK_EMAIL}"
            data = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(
                url,
                data=data,
                headers={
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) OpenShema/1.0",
                    "Referer": "https://openshema.app/",
                    "Origin": "https://openshema.app"
                }
            )
            with urllib.request.urlopen(req, timeout=12) as response:
                res_body = response.read().decode("utf-8")
                res_json = json.loads(res_body)
                if str(res_json.get("success", "")).lower() == "true":
                    return {"success": True, "message": "Signalement transmis avec succès."}
                elif "activation" in str(res_json.get("message", "")).lower():
                    return {"success": True, "message": "E-mail d'activation envoyé sur votre boîte. Veuillez cliquer sur le lien d'activation."}
                else:
                    return {"success": True, "message": res_json.get("message", "Signalement transmis.")}
        except Exception as e:
            logger.error(f"[LibraryMixin] Erreur envoi signalement coquille: {e}")
            return {"success": False, "error": str(e)}


