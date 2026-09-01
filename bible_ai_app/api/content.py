"""
ContentMixin - Extracted from BibleAppApi.
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



class ContentMixin:
    def open_external_url(self, url: str) -> bool:
        """Ouvre une URL externe dans le navigateur par défaut du système."""
        import webbrowser
        try:
            if url and (url.startswith('http://') or url.startswith('https://') or url.startswith('mailto:')):
                webbrowser.open(url)
                return True
        except Exception as e:
            logger.error(f"[API] Erreur ouverture URL externe : {e}")
        return False

    def get_biblical_places(self, query: str = "", place_type: Optional[str] = None, limit: int = 150) -> List[Dict[str, Any]]:
        """Recherche des lieux bibliques avec filtre optionnel par type."""
        try:
            return MapsManager.search_places(query=query, place_type=place_type, limit=limit)
        except Exception as e:
            logger.error(f"Erreur API get_biblical_places: {e}")
            return []

    def get_chapter_places(self, book_code: str = "", chapter_num: int = 1) -> List[Dict[str, Any]]:
        """Retourne les lieux mentionnés dans un chapitre biblique."""
        try:
            return MapsManager.get_places_for_chapter(book_code=book_code, chapter_num=chapter_num)
        except Exception as e:
            logger.error(f"Erreur API get_chapter_places: {e}")
            return []

    def get_biblical_place_details(self, place_id: str = "") -> Optional[Dict[str, Any]]:
        """Détails complets d'un lieu avec ses versets."""
        try:
            return MapsManager.get_place_details(place_id=place_id)
        except Exception as e:
            logger.error(f"Erreur API get_biblical_place_details: {e}")
            return None

    def get_biblical_itineraries(self) -> List[Dict[str, Any]]:
        """Retourne les grands itinéraires bibliques enregistrés."""
        try:
            return MapsManager.get_all_itineraries()
        except Exception as e:
            logger.error(f"Erreur API get_biblical_itineraries: {e}")
            return []

    def get_articles(
        self,
        source_id: Optional[str] = None,
        book_code: Optional[str] = None,
        chapter: Optional[int] = None,
        search_query: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """Retourne la liste paginée et filtrée des articles contemporains."""
        try:
            from core.articles_manager import ArticlesManager
            manager = ArticlesManager.get_instance()
            return manager.get_articles(
                source_id=source_id,
                book_code=book_code,
                chapter=chapter,
                search_query=search_query,
                limit=limit,
                offset=offset
            )
        except Exception as e:
            logger.error(f"Erreur API get_articles: {e}")
            return []

    def get_articles_count(self, source_id: Optional[str] = None, search_query: Optional[str] = None) -> int:
        """Retourne le nombre total d'articles correspondant aux critères."""
        try:
            from core.articles_manager import ArticlesManager
            manager = ArticlesManager.get_instance()
            return manager.get_articles_count(source_id=source_id, search_query=search_query)
        except Exception as e:
            logger.error(f"Erreur API get_articles_count: {e}")
            return 0

    def load_more_articles_archive(self, source_id: str = "tpsg", page_num: int = 2) -> Dict[str, Any]:
        """Télécharge une page d'archive plus ancienne du flux RSS."""
        try:
            from core.articles_manager import ArticlesManager
            manager = ArticlesManager.get_instance()
            return manager.load_more_articles_archive(source_id=source_id, page_num=page_num)
        except Exception as e:
            logger.error(f"Erreur API load_more_articles_archive: {e}")
            return {"success": False, "error": str(e), "new_count": 0}

    def get_article_content(self, article_id: str) -> Dict[str, Any]:
        """Retourne les détails et le texte complet Markdown d'un article, et déclenche la vectorisation à la lecture si nécessaire."""
        try:
            from core.articles_manager import ArticlesManager
            manager = ArticlesManager.get_instance()
            art = manager.db.get_article_by_id(article_id)
            if not art:
                return {"success": False, "error": "Article introuvable."}
            
            # Déclencher la vectorisation à la demande en tâche de fond si non indexé
            if not art.get("is_indexed") and getattr(self, "vector_db", None):
                import threading
                embedding_model = self.config.get("embedding_model", "gemini-embedding-2")
                threading.Thread(
                    target=manager.vectorize_single_article,
                    args=(article_id, self.vector_db, embedding_model),
                    daemon=True
                ).start()

            md_content = manager.get_article_markdown(article_id)
            return {
                "success": True,
                "article": art,
                "content_markdown": md_content or art.get("summary", "")
            }
        except Exception as e:
            logger.error(f"Erreur API get_article_content: {e}")
            return {"success": False, "error": str(e)}

    def get_article_sources(self) -> List[Dict[str, Any]]:
        """Retourne la liste des sources de blogs avec le décompte d'articles."""
        try:
            from core.articles_manager import ArticlesManager
            manager = ArticlesManager.get_instance()
            return manager.get_sources(enabled_only=False)
        except Exception as e:
            logger.error(f"Erreur API get_article_sources: {e}")
            return []

    def toggle_article_source(self, source_id: str, is_enabled: bool) -> Dict[str, Any]:
        """Active ou désactive une source de blog."""
        try:
            from core.articles_manager import ArticlesManager
            manager = ArticlesManager.get_instance()
            manager.toggle_source(source_id, is_enabled)
            return {"success": True, "source_id": source_id, "is_enabled": is_enabled}
        except Exception as e:
            logger.error(f"Erreur API toggle_article_source: {e}")
            return {"success": False, "error": str(e)}

    def sync_article_sources(self, source_id: Optional[str] = None) -> Dict[str, Any]:
        """Déclenche le téléchargement textuel immédiat des flux, puis vectorise les N récents en arrière-plan selon le mode."""
        try:
            from core.articles_manager import ArticlesManager
            manager = ArticlesManager.get_instance()
            
            if source_id:
                new_count = manager.sync_source(source_id)
                results = {source_id: new_count}
            else:
                results = manager.sync_all_active_sources()

            # Vectorisation contrôlée en arrière-plan selon le mode configuré (balanced: cap 10, economical: 0, full: all)
            if getattr(self, "vector_db", None):
                import threading
                v_mode = self.config.get("articles_vectorization_mode", "balanced")
                v_cap = self.config.get("articles_recent_vectorize_cap", 10)
                embedding_model = self.config.get("embedding_model", "gemini-embedding-2")
                threading.Thread(
                    target=manager.index_unindexed_articles_in_rag,
                    args=(self.vector_db, embedding_model, v_cap, v_mode),
                    daemon=True
                ).start()

            stats = manager.db.get_stats()
            return {
                "success": True,
                "results": results,
                "total_new": sum(results.values()),
                "stats": stats
            }
        except Exception as e:
            logger.error(f"Erreur API sync_article_sources: {e}")
            return {"success": False, "error": str(e)}

    def get_articles_for_passage(self, book_code: str, chapter: int, limit: int = 10) -> List[Dict[str, Any]]:
        """Retourne les articles liés à un chapitre biblique spécifique."""
        try:
            from core.articles_manager import ArticlesManager
            manager = ArticlesManager.get_instance()
            return manager.get_articles_for_passage(book_code=book_code, chapter=chapter, limit=limit)
        except Exception as e:
            logger.error(f"Erreur API get_articles_for_passage: {e}")
            return []

    def suggest_article_source(self, blog_name: str = "", blog_url: str = "", notes: str = "", user_email: str = "") -> Dict[str, Any]:
        """Transmet une suggestion de blog/flux RSS vers l'alias email configuré 0wl8a4k7@family3130.anonaddy.com."""
        import urllib.request
        import urllib.parse
        import json

        FEEDBACK_EMAIL = "0wl8a4k7@family3130.anonaddy.com"
        try:
            subject = f"[Open Shema Flux RSS] Suggestion de source : {blog_name}"
            payload = {
                "_subject": subject,
                "Nom_du_blog": str(blog_name or "Non spécifié"),
                "URL_du_site_ou_flux": str(blog_url or "Non spécifié"),
                "Recommandation_ou_remarque": str(notes or ""),
                "Email_expediteur": str(user_email) if user_email else "Non renseigné",
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
                return {"success": True, "message": "Merci ! Votre suggestion de flux a été transmise avec succès."}
        except Exception as e:
            logger.error(f"[ContentMixin] Erreur envoi suggestion de flux: {e}")
            # Fallback mailto si hors ligne
            try:
                from core.articles_manager import ArticlesManager
                url = ArticlesManager.get_suggestion_mailto_link(
                    blog_name=blog_name,
                    blog_url=blog_url,
                    notes=notes
                )
                return {"success": True, "mailto_url": url, "message": "Suggestion préparée."}
            except Exception:
                return {"success": False, "error": str(e)}

    def get_article_suggestion_url(self, blog_name: str = "", blog_url: str = "", notes: str = "") -> Dict[str, Any]:
        """Génère le lien mailto pour proposer une nouvelle source."""
        try:
            from core.articles_manager import ArticlesManager
            url = ArticlesManager.get_suggestion_mailto_link(
                blog_name=blog_name,
                blog_url=blog_url,
                notes=notes
            )
            return {"success": True, "url": url}
        except Exception as e:
            logger.error(f"Erreur get_article_suggestion_url: {e}")
            return {"success": False, "error": str(e)}

    def get_sermons_list(self) -> List[Dict[str, Any]]:
        """Retourne la liste de tous les sermons stockés sous forme de fichiers Markdown."""
        try:
            return SermonsManager.list_sermons(self.config)
        except Exception as e:
            logger.error(f"Erreur get_sermons_list: {e}")
            return []

    def get_sermon(self, sermon_id: str) -> Optional[Dict[str, Any]]:
        """Charge un sermon complet avec métadonnées et contenu."""
        try:
            return SermonsManager.get_sermon(sermon_id, self.config)
        except Exception as e:
            logger.error(f"Erreur get_sermon({sermon_id}): {e}")
            return None

    def save_sermon(self, sermon_data: Dict[str, Any]) -> Dict[str, Any]:
        """Sauvegarde un sermon (création ou mise à jour)."""
        try:
            return SermonsManager.save_sermon(sermon_data, self.config)
        except Exception as e:
            logger.error(f"Erreur save_sermon: {e}")
            return {"success": False, "error": str(e)}

    def delete_sermon(self, sermon_id: str) -> Dict[str, Any]:
        """Supprime un sermon."""
        try:
            return SermonsManager.delete_sermon(sermon_id, self.config)
        except Exception as e:
            logger.error(f"Erreur delete_sermon({sermon_id}): {e}")
            return {"success": False, "error": str(e)}

    def open_sermons_folder(self) -> Dict[str, Any]:
        """Ouvre le dossier local des sermons dans l'explorateur Windows."""
        try:
            d = SermonsManager.get_sermons_directory(self.config)
            os.startfile(d)
            return {"success": True, "path": d}
        except Exception as e:
            logger.error(f"Erreur open_sermons_folder: {e}")
            return {"success": False, "error": str(e)}

    def import_sermon_file(self, file_path: Optional[str] = None) -> Dict[str, Any]:
        """Importe un sermon depuis un fichier Word (.docx) ou Markdown (.md)."""
        try:
            if not file_path:
                import tkinter as tk
                from tkinter import filedialog
                root = tk.Tk()
                root.withdraw()
                root.attributes("-topmost", True)
                file_path = filedialog.askopenfilename(
                    title="Importer une prédication",
                    filetypes=[
                        ("Documents Prédication", "*.docx;*.md;*.txt"),
                        ("Word (*.docx)", "*.docx"),
                        ("Markdown (*.md)", "*.md"),
                        ("Tous les fichiers", "*.*")
                    ]
                )
                root.destroy()
            
            if not file_path:
                return {"success": False, "cancelled": True}
            
            return SermonsManager.import_sermon_file(file_path, self.config)
        except Exception as e:
            logger.error(f"Erreur import_sermon_file: {e}")
            return {"success": False, "error": str(e)}

    def get_illustrations_list(self) -> List[Dict[str, Any]]:
        """Retourne la liste de toutes les illustrations du réservoir."""
        try:
            return SermonsManager.list_illustrations(self.config)
        except Exception as e:
            logger.error(f"Erreur get_illustrations_list: {e}")
            return []

    def get_illustrations_page(
        self,
        page: int = 1,
        page_size: int = 30,
        query: str = "",
        category: str = "all",
        type_filter: str = "all",
        status_filter: str = "all",
        sort_by: str = "date_desc"
    ) -> Dict[str, Any]:
        """Retourne une page légère d'illustrations (sub-10ms)."""
        try:
            return SermonsManager.get_illustrations_page(
                page=page,
                page_size=page_size,
                query=query,
                category=category,
                type_filter=type_filter,
                status_filter=status_filter,
                sort_by=sort_by,
                config=self.config
            )
        except Exception as e:
            logger.error(f"Erreur get_illustrations_page: {e}")
            return {"items": [], "total": 0, "page": page, "page_size": page_size, "has_more": False}

    def get_illustration(self, ill_id: str) -> Optional[Dict[str, Any]]:
        """Charge une illustration complète."""
        try:
            return SermonsManager.get_illustration(ill_id, self.config)
        except Exception as e:
            logger.error(f"Erreur get_illustration({ill_id}): {e}")
            return None

    def save_illustration(self, ill_data: Dict[str, Any]) -> Dict[str, Any]:
        """Sauvegarde une illustration (création ou mise à jour)."""
        try:
            return SermonsManager.save_illustration(ill_data, self.config)
        except Exception as e:
            logger.error(f"Erreur save_illustration: {e}")
            return {"success": False, "error": str(e)}

    def delete_illustration(self, ill_id: str) -> Dict[str, Any]:
        """Supprime une illustration."""
        try:
            return SermonsManager.delete_illustration(ill_id, self.config)
        except Exception as e:
            logger.error(f"Erreur delete_illustration({ill_id}): {e}")
            return {"success": False, "error": str(e)}

    def open_illustrations_folder(self) -> Dict[str, Any]:
        """Ouvre le dossier local des illustrations dans l'explorateur Windows."""
        try:
            d = SermonsManager.get_illustrations_directory(self.config)
            os.startfile(d)
            return {"success": True, "path": d}
        except Exception as e:
            logger.error(f"Erreur open_illustrations_folder: {e}")
            return {"success": False, "error": str(e)}

    def get_real_sermon_models(self, passage_ref: Optional[str] = None, query: Optional[str] = None) -> List[Dict[str, Any]]:
        """Retourne les modèles de prédications réelles filtrés par passage ou recherche."""
        try:
            return SermonsManager.list_real_sermon_models(passage_ref, query)
        except Exception as e:
            logger.error(f"Erreur get_real_sermon_models: {e}")
            return []

    def get_wikipedia_extended(self, title: str) -> Dict[str, Any]:
        """Récupère le contenu détaillé étendu (5 à 10 paragraphes structurés) d'un article Wikipédia."""
        from core.wikipedia_client import WikipediaClient
        return WikipediaClient.get_extended_content(title)

    def get_wikipedia_summary(self, query: str, exact_title: Optional[str] = None) -> Dict[str, Any]:

        """Récupère le résumé et les métadonnées Wikipédia pour un terme."""
        from core.wikipedia_client import WikipediaClient
        return WikipediaClient.get_summary(query, exact_title=exact_title)

