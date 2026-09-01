"""
ImportMixin - Extracted from BibleAppApi.
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



class ImportMixin:
    def choose_import_file(self) -> Dict[str, Any]:
        """Ouvre une boîte de dialogue native pour sélectionner un fichier sans bloquer le rendu web."""
        win = get_active_window()
        if not win:
            return {"success": False, "error": "Fenêtre introuvable"}
            
        file_types = ('Ouvrages supportés (*.epub;*.json;*.docx;*.md;*.txt;*.csv)', 'Tous les fichiers (*.*)')
        result = win.create_file_dialog(webview.OPEN_DIALOG, allow_multiple=False, file_types=file_types)
        
        if not result or len(result) == 0:
            return {"cancelled": True}
            
        file_path = result[0]
        file_name = os.path.basename(file_path)
        file_size = os.path.getsize(file_path) if os.path.exists(file_path) else 0
        ext = os.path.splitext(file_name)[1].lower()
        return {
            "success": True,
            "file_path": file_path,
            "file_name": file_name,
            "file_size": file_size,
            "format": ext.replace('.', '').upper()
        }

    def pick_import_file(self) -> Dict[str, Any]:
        """Ouvre une boîte de dialogue native pour sélectionner un fichier d'importation."""
        win = get_active_window()
        if not win:
            return {"success": False, "error": "Fenêtre introuvable"}
            
        file_types = ('Ouvrages supportés (*.epub;*.json;*.docx;*.md;*.txt;*.csv)', 'Tous les fichiers (*.*)')
        result = win.create_file_dialog(webview.OPEN_DIALOG, allow_multiple=False, file_types=file_types)
        
        if not result or len(result) == 0:
            return {"cancelled": True}
            
        file_path = result[0]
        return self.inspect_import_source(file_path)

    def pick_cover_image(self) -> Dict[str, Any]:
        """Ouvre une boîte de dialogue native pour sélectionner une image de couverture et la stocke de manière permanente."""
        win = get_active_window()
        if not win:
            return {"success": False, "error": "Fenêtre introuvable"}
            
        file_types = ('Images (*.jpg;*.jpeg;*.png;*.webp)', 'Tous les fichiers (*.*)')
        result = win.create_file_dialog(webview.OPEN_DIALOG, allow_multiple=False, file_types=file_types)
        
        if not result or len(result) == 0:
            return {"cancelled": True}
            
        src_path = result[0]
        try:
            import time, uuid
            covers_dir = os.path.join(current_dir, "data", "covers")
            os.makedirs(covers_dir, exist_ok=True)
            clean_base = re.sub(r'[^a-zA-Z0-9._-]', '_', os.path.basename(src_path))
            dest_filename = f"user_{uuid.uuid4().hex[:6]}_{clean_base}"
            dest_path = os.path.join(covers_dir, dest_filename)
            shutil.copy2(src_path, dest_path)
            data_url = get_cover_data_url(dest_path)
            return {"success": True, "cover_path": dest_path, "cover_data_url": data_url}
        except Exception as e:
            return {"success": False, "error": f"Erreur de copie de couverture : {e}"}

    def save_clipboard_cover(self, data_url: str, book_id: str = "cover") -> Dict[str, Any]:
        """Enregistre une image base64 collée depuis le presse-papier."""
        try:
            import base64, uuid, re
            if not data_url or not str(data_url).startswith("data:image/"):
                return {"success": False, "error": "Données d'image invalides"}
            
            header, encoded = data_url.split(",", 1)
            ext_match = re.search(r'data:image/([a-zA-Z0-9]+);', header)
            ext = ext_match.group(1).lower() if ext_match else "png"
            if ext == "jpeg": ext = "jpg"

            img_bytes = base64.b64decode(encoded)
            covers_dir = os.path.join(current_dir, "data", "covers")
            os.makedirs(covers_dir, exist_ok=True)
            clean_id = re.sub(r'[^a-zA-Z0-9._-]', '_', book_id or 'cover')
            dest_filename = f"clip_{uuid.uuid4().hex[:6]}_{clean_id}.{ext}"
            dest_path = os.path.join(covers_dir, dest_filename)

            with open(dest_path, "wb") as f:
                f.write(img_bytes)

            data_url_out = get_cover_data_url(dest_path)
            return {"success": True, "cover_path": dest_path, "cover_data_url": data_url_out}
        except Exception as e:
            return {"success": False, "error": f"Erreur enregistrement image collée : {e}"}

    def paste_native_clipboard_cover(self, book_id: str = "cover") -> Dict[str, Any]:
        """Récupère directement l'image depuis le presse-papier Windows/OS de manière 100% native et sans popup de permission."""
        try:
            from PIL import ImageGrab, Image
            import uuid, re
            
            data = ImageGrab.grabclipboard()
            if data is None:
                return {"success": False, "error": "Aucune image dans le presse-papier. Copiez d'abord une image (Clic droit > Copier l'image ou capture d'écran)."}
                
            covers_dir = os.path.join(current_dir, "data", "covers")
            os.makedirs(covers_dir, exist_ok=True)
            clean_id = re.sub(r'[^a-zA-Z0-9._-]', '_', book_id or 'cover')
            dest_filename = f"clip_{uuid.uuid4().hex[:6]}_{clean_id}.png"
            dest_path = os.path.join(covers_dir, dest_filename)

            if isinstance(data, Image.Image):
                data.save(dest_path, "PNG")
            elif isinstance(data, list) and len(data) > 0 and os.path.exists(data[0]):
                src_file = data[0]
                ext = os.path.splitext(src_file)[1].lower()
                if ext in ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif']:
                    dest_filename = f"clip_{uuid.uuid4().hex[:6]}_{clean_id}{ext}"
                    dest_path = os.path.join(covers_dir, dest_filename)
                    shutil.copy2(src_file, dest_path)
                else:
                    return {"success": False, "error": "Le fichier dans le presse-papier n'est pas une image supportée."}
            else:
                return {"success": False, "error": "Le contenu du presse-papier n'est pas une image reconnue."}

            data_url_out = get_cover_data_url(dest_path)
            return {"success": True, "cover_path": dest_path, "cover_data_url": data_url_out}
        except Exception as e:
            logger.error(f"[API] Erreur paste_native_clipboard_cover : {e}")
            return {"success": False, "error": f"Erreur de lecture du presse-papier : {e}"}

    def search_google_books_metadata(self, query: str, author: str = "", title: str = "", isbn: str = "") -> List[Dict[str, Any]]:
        """Recherche des métadonnées bibliographiques via Google Books et Open Library."""
        from core.book_metadata_client import BookMetadataClient
        api_key = self.config.get("google_books_api_key")
        return BookMetadataClient.search_books(query=query, author=author, title=title, isbn=isbn, api_key=api_key)

    def download_book_cover(self, cover_url: str, book_id: str) -> Optional[str]:
        """Télécharge une couverture depuis une URL et l'enregistre en local."""
        from core.book_metadata_client import BookMetadataClient
        return BookMetadataClient.download_cover(cover_url, book_id)

    def search_unified_hub(self, query: str, official_catalog_modules: List[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Recherche unifiée sur les 3 piliers : Open Shema Natif, Domaine Public & Archives, Librairies Chrétiennes."""
        from core.unified_search_manager import UnifiedSearchManager
        manager = UnifiedSearchManager()
        return manager.search_all_unified(query, official_catalog_modules)

    def search_christian_ebooks(self, query: str) -> Dict[str, Any]:
        """Recherche des e-books chrétiens 100% numériques à travers plusieurs librairies et plateformes."""
        from core.ebook_finder_manager import EbookFinderManager
        finder = EbookFinderManager()
        return finder.search_all_ebooks(query)

    def get_community_logos_books(self) -> List[Dict[str, Any]]:
        """Renvoie la liste complète des livres personnels de la communauté Logos (section Books du wiki)."""
        json_path = os.path.join(current_dir, "data", "logos_community_books.json")
        if os.path.exists(json_path):
            try:
                with open(json_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                logger.error(f"Erreur chargement logos_community_books.json: {e}")
        return []

    def get_gutenberg_theology_books(self) -> List[Dict[str, Any]]:
        """Renvoie les classiques chrétiens du Projet Gutenberg indexés localement."""
        json_path = os.path.join(current_dir, "data", "gutenberg_theology_books.json")
        if os.path.exists(json_path):
            try:
                with open(json_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                logger.error(f"Erreur chargement gutenberg_theology_books.json: {e}")
        return []

    def get_ccel_theology_books(self) -> List[Dict[str, Any]]:
        """Renvoie les classiques de la Christian Classics Ethereal Library indexés localement."""
        json_path = os.path.join(current_dir, "data", "ccel_theology_books.json")
        if os.path.exists(json_path):
            try:
                with open(json_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                logger.error(f"Erreur chargement ccel_theology_books.json: {e}")
        return []

    def download_external_book_file(self, book_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Télécharge un livre externe (Project Gutenberg EPUB, Logos Community DOCX/ZIP, etc.)
        dans le dossier temporaire d'importation pour l'injecter directement
        dans l'assistant d'importation (ImportModal).
        """
        import urllib.request
        import shutil
        import ssl
        import re

        try:
            download_url = book_data.get("download_url")
            if not download_url:
                return {"success": False, "error": "URL de téléchargement manquante."}

            title = book_data.get("title", "Livre")
            b_id = str(book_data.get("id", "book"))
            fmt = str(book_data.get("format") or "EPUB").lower()

            # Dossier temporaire pour les imports
            import_cache_dir = os.path.join(current_dir, "data", "temp_imports")
            os.makedirs(import_cache_dir, exist_ok=True)

            safe_title = re.sub(r'[^\w\s-]', '', title).strip().replace(' ', '_')[:40]
            if not safe_title:
                safe_title = f"book_{b_id}"

            ext = ".epub" if "epub" in fmt or "epub" in download_url.lower() else (".docx" if "docx" in fmt or "docx" in download_url.lower() else (".zip" if download_url.lower().endswith(".zip") else ".epub"))
            file_name = f"{safe_title}{ext}"
            target_path = os.path.join(import_cache_dir, file_name)

            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
            ctx = ssl.create_default_context()
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE

            req = urllib.request.Request(download_url, headers=headers)
            with urllib.request.urlopen(req, context=ctx, timeout=60) as response, open(target_path, "wb") as out_file:
                shutil.copyfileobj(response, out_file)

            # Si c'est un ZIP (cas Logos PB), extraire pour trouver le .docx
            if target_path.endswith(".zip"):
                import zipfile
                try:
                    with zipfile.ZipFile(target_path, 'r') as zf:
                        docx_files = [n for n in zf.namelist() if n.lower().endswith('.docx')]
                        if docx_files:
                            extracted_path = zf.extract(docx_files[0], import_cache_dir)
                            target_path = extracted_path
                            file_name = os.path.basename(extracted_path)
                            fmt = "docx"
                except Exception as zip_err:
                    logger.warning(f"Erreur décompression ZIP Logos PB: {zip_err}")

            file_size = os.path.getsize(target_path) if os.path.exists(target_path) else 0

            return {
                "success": True,
                "file_path": target_path,
                "file_name": file_name,
                "file_size": file_size,
                "format": fmt.upper(),
                "metadata": {
                    "title": book_data.get("title"),
                    "author": book_data.get("author"),
                    "description": book_data.get("description"),
                    "cover_url": book_data.get("cover_url"),
                    "language": book_data.get("language", "fr")
                }
            }
        except Exception as e:
            logger.error(f"Erreur téléchargement livre externe : {e}")
            return {"success": False, "error": str(e)}

    def download_and_install_catalog_module(self, module_data: Dict[str, Any]) -> Dict[str, Any]:
        """Télécharge un module officiel depuis le dépôt open-shema-data et l'installe localement."""
        import urllib.request
        import shutil
        try:
            m_id = module_data.get("id")
            m_type = module_data.get("type", "bible")
            m_title = module_data.get("title", m_id)
            download_url = module_data.get("download_url")
            m_format = module_data.get("format", "sqlite")
            m_abbr = module_data.get("abbreviation", (m_id or "").upper())

            if not download_url:
                return {"success": False, "error": "URL de téléchargement manquante."}

            if m_type == "bible":
                target_dir = os.path.join(current_dir, "data", "bibles")
                os.makedirs(target_dir, exist_ok=True)
                file_name = f"bible_{m_id.replace('-', '_')}.sqlite" if m_format == "sqlite" else f"{m_id}.json"
                target_path = os.path.join(target_dir, file_name)
            elif m_type == "dictionary":
                target_dir = os.path.join(current_dir, "data", "dictionaries")
                os.makedirs(target_dir, exist_ok=True)
                file_name = f"dict_{m_id.replace('-', '_')}.sqlite" if m_format == "sqlite" else f"{m_id}.json"
                target_path = os.path.join(target_dir, file_name)
            elif m_type == "commentary":
                target_dir = os.path.join(current_dir, "data", "commentaires")
                os.makedirs(target_dir, exist_ok=True)
                file_name = f"comm_{m_id.replace('-', '_')}.sqlite" if m_format == "sqlite" else f"{m_id}.json"
                target_path = os.path.join(target_dir, file_name)
            elif m_type == "theology":
                target_dir = os.path.join(current_dir, "data", "theology")
                os.makedirs(target_dir, exist_ok=True)
                file_name = f"{m_id.replace('-', '_')}.sqlite" if m_format == "sqlite" else f"{m_id}.json"
                target_path = os.path.join(target_dir, file_name)
            elif m_type in ["logos_pb", "personal_book", "docx"]:
                target_dir = os.path.join(current_dir, "data", "personal_books")
                os.makedirs(target_dir, exist_ok=True)
                ext = ".zip" if download_url.endswith(".zip") else ".docx"
                file_name = f"{m_id}{ext}"
                target_path = os.path.join(target_dir, file_name)
            else:
                target_dir = os.path.join(current_dir, "data")
                file_name = os.path.basename(download_url.split("?")[0])
                target_path = os.path.join(target_dir, file_name)

            req = urllib.request.Request(
                download_url,
                headers={"User-Agent": "OpenShemaApp/1.0 (https://github.com/Similarly1/open-shema)"}
            )
            with urllib.request.urlopen(req, timeout=60) as response, open(target_path, "wb") as out_file:
                shutil.copyfileobj(response, out_file)

            # Si c'est une Bible SQLite, extraire les 66 livres JSON pour compatibilité native instantanée
            if m_type == "bible" and target_path.endswith(".sqlite"):
                try:
                    self._extract_sqlite_bible_to_json(target_path, m_abbr, m_title)
                except Exception as extract_err:
                    logger.warning(f"Erreur extraction SQLite Bible vers JSON : {extract_err}")

            # Si c'est un Commentaire SQLite, synchroniser avec la base centrale des commentaires
            if m_type == "commentary" and target_path.endswith(".sqlite"):
                master_db = os.path.join(current_dir, "data", "commentaires", "commentaires_master.db")
                if os.path.exists(master_db):
                    try:
                        import sqlite3
                        m_conn = sqlite3.connect(master_db)
                        c_conn = sqlite3.connect(target_path)
                        c_cur = c_conn.cursor()
                        c_cur.execute("SELECT commentary_id, commentary_name, book_code, book_name, chapter, verse_start, verse_end, reference, text, paragraphs_json, html, source_url FROM commentaries")
                        c_rows = c_cur.fetchall()
                        if c_rows:
                            m_cur = m_conn.cursor()
                            comm_name = c_rows[0][1]
                            m_cur.execute("DELETE FROM commentaries WHERE commentary_name = ?", (comm_name,))
                            m_cur.executemany("INSERT INTO commentaries (commentary_id, commentary_name, book_code, book_name, chapter, verse_start, verse_end, reference, text, paragraphs_json, html, source_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", c_rows)
                            m_conn.commit()
                        c_conn.close()
                        m_conn.close()
                        from core.commentary_loader import CommentaryLoader
                        CommentaryLoader._catalog_cache = None
                    except Exception as comm_err:
                        logger.warning(f"Erreur intégration commentaire SQLite vers master DB : {comm_err}")

            # Téléchargement de l'image de couverture si spécifiée
            cover_path = None
            cover_url = module_data.get("cover_url")
            if cover_url:
                try:
                    covers_dir = os.path.join(current_dir, "data", "covers")
                    os.makedirs(covers_dir, exist_ok=True)
                    cover_ext = os.path.splitext(cover_url.split("?")[0])[1] or ".png"
                    local_cover_file = f"{m_abbr}{cover_ext}"
                    cover_dest = os.path.join(covers_dir, local_cover_file)
                    req_cov = urllib.request.Request(
                        cover_url,
                        headers={"User-Agent": "OpenShemaApp/1.0"}
                    )
                    with urllib.request.urlopen(req_cov, timeout=15) as cov_resp, open(cover_dest, "wb") as cov_out:
                        shutil.copyfileobj(cov_resp, cov_out)
                    cover_path = cover_dest
                except Exception as cov_err:
                    logger.warning(f"Erreur téléchargement de la couverture pour {m_title}: {cov_err}")

            registry = load_books_metadata()
            reg_key = m_abbr or m_id
            registry[reg_key] = {
                "title": m_title,
                "author": module_data.get("author", "Open Shema"),
                "description": module_data.get("description", ""),
                "year": module_data.get("version", "1.0.0"),
                "cover_path": cover_path,
                "type": "Bible" if m_type == "bible" else ("Dictionnaire" if m_type == "dictionary" else ("Commentaire" if m_type == "commentary" else "Théologie")),
                "format": "json" if (m_type == "bible" and target_path.endswith(".sqlite")) else m_format,
                "file_path": target_path,
                "folder_name": m_abbr,
                "version_code": m_abbr,
                "total_books": 66 if m_type == "bible" else 0,
                "embedding_model": "study_library",
                "active": True,
                "has_strongs": "strong" in module_data.get("features", [])
            }
            save_books_metadata(registry)

            try:
                from core.bible_json_loader import BibleJsonLoader
                BibleJsonLoader.clear_cache()
            except Exception:
                pass

            return {
                "success": True,
                "installed_path": target_path,
                "message": f"{m_title} a été téléchargé et activé avec succès."
            }
        except Exception as e:
            logger.error(f"Erreur lors du téléchargement du module {module_data.get('title')}: {e}")
            return {"success": False, "error": str(e)}

    def get_installed_catalog_module_ids(self) -> List[str]:
        """Retourne la liste exhaustive des identifiants de modules actifs/installés localement."""
        installed = set()
        data_dir = os.path.join(current_dir, "data")

        # 1. Registre des ouvrages et Bibles actifs
        registry = load_books_metadata()
        for k, v in registry.items():
            if v.get("active", True):
                installed.add(k.lower())
                if v.get("version_code"):
                    installed.add(v.get("version_code").lower())
                if v.get("folder_name"):
                    installed.add(v.get("folder_name").lower())
                if v.get("title"):
                    installed.add(v.get("title").lower())

        # 2. Dictionnaires
        dict_registry = DictionaryManager.get_all_dictionaries()
        for d in dict_registry:
            d_id = d.get("id")
            if d_id and d.get("enabled", True):
                installed.add(d_id.lower())
                installed.add(f"dict-{d_id.lower()}")

        # 3. Fichiers spécifiques indispensables sur disque
        if os.path.exists(os.path.join(data_dir, "bibleproject_fr.json")):
            installed.add("dataset-bibleproject-fr")
            installed.add("bp-fr")
            installed.add("bibleproject")

        if os.path.exists(os.path.join(data_dir, "strong_lexicon.json")):
            installed.add("dict-strong-fr")
            installed.add("strong")

        return list(installed)

    def auto_classify_document_metadata(self, title: str, description: str, model: str = "gemini-2.5-flash-lite") -> Dict[str, Any]:
        """Classifie automatiquement l'ouvrage pour le RAG Tri-Flux via l'IA."""
        from core.book_classifier import BookClassifier
        return BookClassifier.classify_metadata(title, description, self.config, model=model)

    def inspect_import_source(self, file_path: str) -> Dict[str, Any]:
        """Inspecte un fichier d'importation et extrait les métadonnées et chapitres."""
        if not os.path.exists(file_path):
            return {"success": False, "error": "Fichier introuvable"}
            
        ext = os.path.splitext(file_path)[1].lower()
        file_size = os.path.getsize(file_path)
        file_name = os.path.basename(file_path)
        file_base = os.path.splitext(file_name)[0]
        
        info = {}
        if ext == '.epub':
            from core.epub_loader import EpubLoader
            try:
                info = EpubLoader.inspect_epub(file_path)
                if info.get("cover_path"):
                    info["cover_data_url"] = get_cover_data_url(info["cover_path"])
            except Exception as e:
                return {"success": False, "error": f"Erreur inspection EPUB : {e}"}
                
        elif ext in ['.md', '.txt']:
            try:
                with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
                    lines = [l.strip() for l in f.readlines() if l.strip()]
                
                title = file_base
                author = ""
                chapters = []
                current_ch_title = ""
                current_ch_lines = []

                for l in lines:
                    if l.startswith('# '):
                        if not title or title == file_base:
                            title = l.lstrip('# ').strip()
                        else:
                            if current_ch_title:
                                chapters.append({"title": current_ch_title, "include": True, "size": len(" ".join(current_ch_lines))})
                            current_ch_title = l.lstrip('# ').strip()
                            current_ch_lines = []
                    elif l.startswith('## '):
                        if current_ch_title:
                            chapters.append({"title": current_ch_title, "include": True, "size": len(" ".join(current_ch_lines))})
                        current_ch_title = l.lstrip('# ').strip()
                        current_ch_lines = []
                    elif l.lower().startswith('auteur:') or l.lower().startswith('par '):
                        author = l.split(':', 1)[-1].strip() if ':' in l else l[4:].strip()
                    else:
                        current_ch_lines.append(l)

                if current_ch_title:
                    chapters.append({"title": current_ch_title, "include": True, "size": len(" ".join(current_ch_lines))})
                elif not chapters:
                    chapters.append({"title": title or "Document", "include": True, "size": len(" ".join(lines))})

                info = {"title": title, "author": author, "chapters": chapters}
            except Exception as e:
                info = {"title": file_base, "chapters": [{"title": file_base, "include": True, "size": 0}]}

        elif ext == '.docx':
            from core.bible_docx_importer import BibleDocxImporter
            if BibleDocxImporter.is_logos_bible_docx(file_path):
                try:
                    info = BibleDocxImporter.inspect_bible_docx(file_path)
                except Exception as e:
                    logger.warning(f"Erreur inspection Logos DOCX: {e}")
                    info = {"title": file_base, "chapters": [{"title": file_base, "include": True, "size": 0}]}
            else:
                info = {"title": file_base, "chapters": [{"title": file_base, "include": True, "size": 0}]}
            
        elif ext in ['.json', '.csv']:
            info = {"title": file_base, "chapters": []}
        else:
            info = {"title": file_base, "chapters": []}

        # Détection automatique intelligente du type d'ouvrage (Bible vs Théologie vs Commentaire vs Dictionnaire)
        raw_title = info.get("title", "") or ""
        raw_author = info.get("author", "") or ""
        title_lower = strip_accents(raw_title).lower()
        desc_lower = strip_accents(info.get("description", "") or "").lower()
        base_lower = strip_accents(file_base or "").lower()
        combined_text = f"{title_lower} {desc_lower} {base_lower}"

        reg_bibles = load_bibles_registry()
        reg_match = (
            find_bible_registry_entry(raw_title, reg_bibles) or 
            find_bible_registry_entry(file_base, reg_bibles) or 
            find_bible_registry_entry(file_name, reg_bibles)
        )
        
        # Mots-clés excluant catégoriquement qu'un ouvrage soit une simple Bible de texte
        non_bible_kws = [
            "commentaire", "commentary", "theologie", "theology", "etude", "study", 
            "doctrine", "sermon", "introduction", "cultur", "archaeolog", "manuel", 
            "guide", "lecture", "comprendre", "selon", "divinite", "grace", "croix", 
            "justification", "trinite", "histoire", "eglise", "philosophie", "apologetique"
        ]
        has_non_bible_kw = any(re.search(r'\b' + re.escape(w) + r'\b', combined_text) for w in non_bible_kws)
        has_author = bool(raw_author and len(raw_author.strip()) > 3 and not any(kw in raw_author.lower() for kw in ["collectif", "societe biblique", "bible society", "anonymous", "inconnu"]))

        is_bible = False
        if ext in ['.json', '.csv'] and not has_non_bible_kw:
            is_bible = True
        elif ext == '.docx':
            from core.bible_docx_importer import BibleDocxImporter
            if (reg_match and not has_non_bible_kw and not has_author) or info.get("is_bible") or BibleDocxImporter.is_logos_bible_docx(file_path):
                is_bible = True
        elif ext == '.epub':
            if reg_match and not has_non_bible_kw and not has_author:
                is_bible = True
            else:
                biblical_chapters_count = sum(1 for c in info.get("chapters", []) if c.get("book_code") is not None)
                total_chapters = len(info.get("chapters", []))
                if not has_non_bible_kw and not has_author:
                    if biblical_chapters_count >= 10:
                        is_bible = True
                    elif total_chapters > 0 and (biblical_chapters_count / total_chapters) >= 0.5:
                        is_bible = True
                    elif any(kw in combined_text for kw in ["sainte bible", "holy bible", "septante", "tanakh", "ancien testament", "nouveau testament", "evangiles"]):
                        if biblical_chapters_count >= 1:
                            is_bible = True

        if is_bible:
            info["type"] = "Bible"
            info["is_bible"] = True
            
            # Pas de vectorisation RAG pour les Bibles
            for c in info.get("chapters", []):
                c["include"] = False
                
            if reg_match:
                info["short_id"] = reg_match.get("code") or file_base.upper()[:6]
                info["title"] = reg_match.get("nom_officiel") or info.get("title")
                info["author"] = reg_match.get("editeur") or reg_match.get("auteur") or info.get("author")
                info["year"] = str(reg_match.get("annee", "")) or str(info.get("year", ""))
                info["description"] = reg_match.get("description") or info.get("description")
                info["famille"] = reg_match.get("famille")
                info["famille_badge_color"] = reg_match.get("famille_badge_color")
                if not info.get("cover_data_url") and reg_match.get("cover_url"):
                    info["cover_data_url"] = reg_match.get("cover_url")
                    info["cover_url"] = reg_match.get("cover_url")
            else:
                clean_id = re.sub(r'[^a-zA-Z0-9]', '', file_base).upper()[:8]
                if "BIBLE" in clean_id and len(clean_id) > 5:
                    clean_id = clean_id.replace("BIBLE", "")
                info["short_id"] = clean_id or file_base.upper()[:6]
        else:
            # Classification automatique du type d'ouvrage pour les non-Bibles
            info["is_bible"] = False
            if any(w in combined_text for w in ["commentaire", "commentary", "explication", "vers par vers"]):
                info["type"] = "Commentaire"
            elif any(w in combined_text for w in ["dictionnaire", "dictionary", "lexique", "lexicon", "encyclopedie"]):
                info["type"] = "Dictionnaire"
            else:
                info["type"] = "Théologie"

        return {
            "success": True,
            "format": ext.lstrip('.'),
            "file_path": file_path,
            "file_name": file_name,
            "file_size": file_size,
            "info": info
        }

    def execute_document_import(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Exécute l'importation complète et l'indexation RAG d'un ouvrage (ou conversion directe de Bible)."""
        name = payload.get("name", "").strip()
        if not name:
            return {"success": False, "error": "Identifiant obligatoire."}
            
        edit_mode = payload.get("edit_mode", False)
        old_name = payload.get("old_name", name)
        
        raw_cover = payload.get("cover_path")
        final_cover_path = raw_cover

        # Traitement de la couverture : enregistrement permanent
        if raw_cover and str(raw_cover).startswith("data:image/"):
            try:
                import base64
                header, b64_data = raw_cover.split(",", 1)
                img_data = base64.b64decode(b64_data)
                covers_dir = os.path.join(current_dir, "data", "covers")
                os.makedirs(covers_dir, exist_ok=True)
                slug_name = re.sub(r'[^a-zA-Z0-9_-]', '_', name).strip('_')
                dest_path = os.path.join(covers_dir, f"{slug_name}.png")
                with open(dest_path, "wb") as f:
                    f.write(img_data)
                final_cover_path = dest_path
            except Exception as e:
                logger.warning(f"Erreur enregistrement Smart Cover: {e}")
        elif raw_cover and os.path.exists(raw_cover):
            covers_dir = os.path.abspath(os.path.join(current_dir, "data", "covers"))
            os.makedirs(covers_dir, exist_ok=True)
            if not os.path.abspath(raw_cover).startswith(covers_dir):
                slug_name = re.sub(r'[^a-zA-Z0-9_-]', '_', name).strip('_')
                ext = os.path.splitext(raw_cover)[1] or ".jpg"
                dest_path = os.path.join(covers_dir, f"{slug_name}{ext}")
                try:
                    shutil.copy2(raw_cover, dest_path)
                    final_cover_path = dest_path
                except Exception:
                    final_cover_path = raw_cover

        metadata = {
            "name": name,
            "title": payload.get("title", name),
            "author": payload.get("author", ""),
            "description": payload.get("description", ""),
            "year": payload.get("year", ""),
            "cover_path": final_cover_path,
            "type": payload.get("type", "Théologie"),
            "corpus_scope": payload.get("corpus_scope", "GLOBAL"),
            "source_type": payload.get("source_type", "general"),
            "book_code": payload.get("book_code"),
            "embedding_model": payload.get("embedding_model", "bge_multilingual_gemma2 (Infomaniak)"),
            "active": True
        }
        
        registry = load_books_metadata()
        
        if edit_mode:
            if old_name != name and old_name in registry:
                del registry[old_name]
            if name in registry:
                registry[name].update(metadata)
            else:
                registry[name] = metadata
            save_books_metadata(registry)
            return {"success": True, "edited": True, "name": name}
            
        file_path = payload.get("file_path", "")
        if not file_path or not os.path.exists(file_path):
            registry[name] = metadata
            save_books_metadata(registry)
            return {"success": True, "name": name, "chunks_count": 0}
            
        ext = os.path.splitext(file_path)[1].lower()
        
        # Cas 1 : Importation de Bible (Pas de vectorisation RAG !)
        if metadata.get("type") == "Bible":
            if ext == '.epub':
                from core.bible_epub_importer import BibleEpubImporter
                try:
                    b_name, b_meta = BibleEpubImporter.import_bible_epub(
                        file_path, 
                        custom_name=name, 
                        custom_metadata=metadata
                    )
                    return {"success": True, "name": b_name, "is_bible": True, "books_count": b_meta.get("total_books", 0), "chunks_count": 0}
                except Exception as e:
                    logger.error(f"Erreur importation Bible EPUB : {e}", exc_info=True)
                    return {"success": False, "error": f"Erreur importation Bible EPUB : {e}"}
            elif ext == '.docx':
                from core.bible_docx_importer import BibleDocxImporter
                try:
                    b_name, b_meta = BibleDocxImporter.import_bible_docx(
                        file_path,
                        custom_name=name,
                        custom_metadata=metadata
                    )
                    return {"success": True, "name": b_name, "is_bible": True, "books_count": b_meta.get("total_books", 0), "chunks_count": 0}
                except Exception as e:
                    logger.error(f"Erreur importation Bible DOCX : {e}", exc_info=True)
                    return {"success": False, "error": f"Erreur importation Bible DOCX : {e}"}
            elif ext == '.json':
                try:
                    b_name, b_meta = BibleJsonLoader.import_single_bible_json(
                        file_path,
                        custom_name=name,
                        custom_metadata=metadata
                    )
                    return {"success": True, "name": b_name, "is_bible": True, "books_count": b_meta.get("total_books", 0), "chunks_count": 0}
                except Exception as e:
                    logger.error(f"Erreur importation Bible JSON : {e}", exc_info=True)
                    return {"success": False, "error": f"Erreur importation Bible JSON : {e}"}
            elif ext in ['.csv', '.tsv']:
                try:
                    b_name, b_meta = BibleJsonLoader.import_bible_csv(
                        file_path,
                        custom_name=name,
                        custom_metadata=metadata
                    )
                    return {"success": True, "name": b_name, "is_bible": True, "books_count": b_meta.get("total_books", 0), "chunks_count": 0}
                except Exception as e:
                    logger.error(f"Erreur importation Bible CSV : {e}", exc_info=True)
                    return {"success": False, "error": f"Erreur importation Bible CSV : {e}"}

        # Cas 2 : EPUB Standard Théologie / Commentaires / Ouvrages d'étude (Vectorisation RAG)
        if ext == '.epub':
            from core.epub_loader import EpubLoader
            from core.theology_reader_manager import TheologyReaderManager
            from core.task_manager import TaskManager
            import threading
            
            selected_chapters = payload.get("chapters", [])
            chunks = EpubLoader.extract_chapters_and_chunks(
                epub_path=file_path,
                selected_chapters=selected_chapters,
                custom_name=name,
                metadata=metadata
            )
            
            metadata["chapters_count"] = len([c for c in selected_chapters if c.get("include", True)])
            metadata["chunks_count"] = len(chunks)
            metadata["file_path"] = file_path
            registry[name] = metadata
            save_books_metadata(registry)
            TheologyReaderManager.invalidate_cache()
            
            enable_ai = self.config.get("enable_ai", True)
            if chunks and enable_ai:
                task_id = f"import_{name}"
                TaskManager.start_task(
                    task_id=task_id, 
                    title=metadata.get("title", name), 
                    task_type="rag_indexing",
                    total=len(chunks),
                    detail=f"Indexation vectorielle de {len(chunks)} fragments..."
                )
                
                def _async_index_worker():
                    try:
                        from core.database import VectorDB
                        db = VectorDB(api_keys=self.config)
                        def p_cb(pct, cur=0, tot=0):
                            TaskManager.update_progress(task_id, pct, current=cur, total=tot)
                        db.add_chunks(
                            chunks, 
                            embedding_model=metadata.get("embedding_model", "bge_multilingual_gemma2 (Infomaniak)"),
                            progress_callback=p_cb
                        )
                        TaskManager.complete_task(task_id, message=f"Indexation terminée ({len(chunks)} fragments)")
                        TheologyReaderManager.invalidate_cache()
                    except Exception as e:
                        logger.error(f"Erreur indexation vectorielle arrière-plan pour {name}: {e}", exc_info=True)
                        TaskManager.fail_task(task_id, str(e))

                threading.Thread(target=_async_index_worker, daemon=True).start()
                return {"success": True, "name": name, "chunks_count": len(chunks), "background_indexing": True, "task_id": task_id}

            return {"success": True, "name": name, "chunks_count": len(chunks), "background_indexing": False}

        # Cas 3 : Markdown (.md) et Fichiers Texte (.txt)
        elif ext in ['.md', '.txt']:
            from core.theology_reader_manager import TheologyReaderManager
            from core.task_manager import TaskManager
            import threading
            
            selected_chapters = payload.get("chapters", [])
            chunks = []
            try:
                with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
                    content = f.read()

                # Découpage basique en paragraphes / blocs pour RAG
                paragraphs = [p.strip() for p in content.split('\n\n') if p.strip()]
                for i, p in enumerate(paragraphs):
                    chunks.append({
                        "text": p,
                        "metadata": {
                            "book_name": name,
                            "title": metadata.get("title", name),
                            "author": metadata.get("author", ""),
                            "chunk_id": f"{name}_ch_{i}",
                            "type": metadata.get("type", "Théologie"),
                            "corpus_scope": metadata.get("corpus_scope", "GLOBAL"),
                            "source_type": metadata.get("source_type", "general")
                        }
                    })
            except Exception as e:
                logger.error(f"Erreur lecture MD/TXT: {e}")

            metadata["chapters_count"] = len(selected_chapters) or 1
            metadata["chunks_count"] = len(chunks)
            metadata["file_path"] = file_path
            registry[name] = metadata
            save_books_metadata(registry)
            TheologyReaderManager.invalidate_cache()

            enable_ai = self.config.get("enable_ai", True)
            if chunks and enable_ai:
                task_id = f"import_{name}"
                TaskManager.start_task(
                    task_id=task_id, 
                    title=metadata.get("title", name), 
                    task_type="rag_indexing",
                    total=len(chunks),
                    detail=f"Indexation vectorielle de {len(chunks)} fragments..."
                )
                
                def _async_index_md_worker():
                    try:
                        from core.database import VectorDB
                        db = VectorDB(api_keys=self.config)
                        def p_cb(pct, cur=0, tot=0):
                            TaskManager.update_progress(task_id, pct, current=cur, total=tot)
                        db.add_chunks(
                            chunks, 
                            embedding_model=metadata.get("embedding_model", "bge_multilingual_gemma2 (Infomaniak)"),
                            progress_callback=p_cb
                        )
                        TaskManager.complete_task(task_id, message=f"Indexation terminée ({len(chunks)} fragments)")
                        TheologyReaderManager.invalidate_cache()
                    except Exception as e:
                        logger.error(f"Erreur indexation vectorielle arrière-plan pour {name}: {e}", exc_info=True)
                        TaskManager.fail_task(task_id, str(e))

                threading.Thread(target=_async_index_md_worker, daemon=True).start()
                return {"success": True, "name": name, "chunks_count": len(chunks), "background_indexing": True, "task_id": task_id}

            return {"success": True, "name": name, "chunks_count": len(chunks), "background_indexing": False}
            
        # Cas 4 : Dictionnaire / Docx / CSV
        elif ext in ['.docx', '.csv']:
            res = DictionaryManager.import_dictionary(file_path)
            registry[name] = metadata
            save_books_metadata(registry)
            return {"success": True, "name": name, "dict_res": res}
            
        registry[name] = metadata
        save_books_metadata(registry)
        return {"success": True, "name": name}

