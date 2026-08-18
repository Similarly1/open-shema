import os
import sys
import json
import shutil
import zipfile
import datetime
import threading
import webview
from typing import Dict, List, Any, Optional

# Ajouter le répertoire racine au PYTHONPATH
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from core.bible_json_loader import BibleJsonLoader, extract_verse_text
from core.reference_parser import (
    get_french_book_name,
    resolve_book_input,
    parse_smart_book_input,
    BOOKS_OT,
    BOOKS_NT,
    BOOKS_DEUTERO,
    ALL_BOOKS
)
from core.pericope_manager import PericopeManager
from core.commentary_loader import CommentaryLoader
from core.dictionary_manager import DictionaryManager
from core.original_languages_manager import OriginalLanguagesManager
from core.config import load_config, save_config
from gui.library_utils import load_books_metadata, save_books_metadata


# Composants inclus dans la sauvegarde complète
_BACKUP_MANIFEST_VERSION = "1.0"
_BACKUP_COMPONENTS = [
    ("chroma_db",      "📦 Vecteurs ChromaDB"),
    ("commentaires",   "📝 Commentaires bibliques"),
    ("bibles",         "📖 Bibles JSON"),
    ("covers",         "🖼️ Couvertures"),
    ("dictionaries",   "📚 Dictionnaires"),
    ("library.json",   "🗂️ Registre (library.json)"),
    ("config.json",    "⚙️ Paramètres (config.json)"),
]


class BibleAppApi:
    """
    API Bridge exposée au Frontend Webview JavaScript.
    Chaque méthode publique est directement invocable via window.pywebview.api.<nom_methode>(...).
    """

    def __init__(self, window_ref=None):
        self.window = window_ref
        self.config = load_config()

    def set_window(self, window):
        self.window = window

    # =========================================================================
    # 1. LECTEUR BIBLIQUE
    # =========================================================================

    def get_installed_bibles(self) -> List[Dict[str, Any]]:
        """Retourne la liste des Bibles installées dans la bibliothèque."""
        registry = load_books_metadata()
        bibles = []
        for name, meta in registry.items():
            if meta.get("type") == "Bible" and meta.get("active", True):
                bibles.append({
                    "id": meta.get("folder_name", name),
                    "name": name,
                    "title": meta.get("title", name),
                    "author": meta.get("author", ""),
                    "version_code": meta.get("version_code", "BIBLE")
                })
        
        # Si vide, fallback sur les dossiers JSON
        if not bibles:
            installed = BibleJsonLoader.list_installed_bibles()
            for b in installed:
                bibles.append({
                    "id": b,
                    "name": b.replace("_", " "),
                    "title": b.replace("_", " "),
                    "author": "",
                    "version_code": b
                })
        return bibles

    def get_books_list(self) -> List[Dict[str, Any]]:
        """Retourne la liste complète des livres bibliques."""
        books = []
        for name, code, ch_count in BOOKS_OT:
            books.append({
                "code": code,
                "name": name,
                "chapters": ch_count,
                "testament": "OT"
            })
        for name, code, ch_count in BOOKS_NT:
            books.append({
                "code": code,
                "name": name,
                "chapters": ch_count,
                "testament": "NT"
            })
        for name, code, ch_count in BOOKS_DEUTERO:
            books.append({
                "code": code,
                "name": name,
                "chapters": ch_count,
                "testament": "DEUTERO"
            })
        return books

    def get_chapter_data(self, bible_name: str, book_code: str, chapter: int) -> Dict[str, Any]:
        """Récupère les versets d'un chapitre, titre de péricope et enrichissement interlinéaire."""
        ch_int = int(chapter)
        book_data = BibleJsonLoader.load_book(bible_name, book_code)
        french_name = get_french_book_name(book_code)

        if not book_data or "chapters" not in book_data:
            bibles = BibleJsonLoader.list_installed_bibles()
            if bibles:
                bible_name = bibles[0]
                book_data = BibleJsonLoader.load_book(bible_name, book_code)

        if not book_data:
            return {
                "bible": bible_name,
                "book": book_code,
                "book_french": french_name,
                "chapter": ch_int,
                "pericope": f"CHAPITRE {ch_int}",
                "verses": []
            }

        chapters_dict = book_data.get("chapters", {})
        verses_dict = chapters_dict.get(str(ch_int), {})

        # Péricope
        sections = book_data.get("sections", {})
        pericope_title = sections.get(f"{ch_int}:1") or sections.get(f"{ch_int}") or f"CHAPITRE {ch_int}"

        verses_list = []
        sorted_verses = sorted(verses_dict.keys(), key=lambda x: int(x) if x.isdigit() else 999)
        
        for v_str in sorted_verses:
            v_raw = verses_dict[v_str]
            v_text = extract_verse_text(v_raw)
            verses_list.append({
                "verse": int(v_str) if v_str.isdigit() else v_str,
                "text": v_text
            })

        return {
            "bible": bible_name,
            "book": book_code,
            "book_french": french_name,
            "chapter": ch_int,
            "pericope": pericope_title,
            "verses": verses_list
        }

    def get_commentaries(self, book_code: str, chapter: int, verse: int) -> List[Dict[str, Any]]:
        """Récupère instantanément tous les commentaires pour un verset donné."""
        ch_int = int(chapter)
        v_int = int(verse)
        res = CommentaryLoader.get_all_comments_for_passage(book_code, ch_int, v_int)
        
        comments = []
        for i, text in enumerate(res.get("documents", [])):
            meta = res["metadatas"][i] if i < len(res.get("metadatas", [])) else {}
            comments.append({
                "author": meta.get("name", "Commentaire"),
                "source": meta.get("name", "Commentaire"),
                "reference": meta.get("reference", f"{book_code} {ch_int}:{v_int}"),
                "text": text
            })
        return comments

    def parse_reference(self, raw_input: str) -> Dict[str, Any]:
        """Décode une saisie libre de passage biblique."""
        resolved = resolve_book_input(raw_input)
        if resolved:
            code, french, ch_count = resolved
            parts = raw_input.strip().split()
            ch = 1
            if len(parts) > 1 and parts[-1].isdigit():
                ch = int(parts[-1])
            elif ":" in raw_input:
                sub = raw_input.split(":")
                ch_candidate = "".join(filter(str.isdigit, sub[0].split()[-1]))
                if ch_candidate:
                    ch = int(ch_candidate)
            return {
                "book": code,
                "book_french": french,
                "chapter": min(max(1, ch), ch_count)
            }
        return {"book": "Gen", "book_french": "Genèse", "chapter": 1}

    def ask_ai(self, question: str, book: str, chapter: int, verse: int) -> Dict[str, Any]:
        """Interroge l'assistant IA."""
        french = get_french_book_name(book)
        ref = f"{french} {chapter}:{verse}"
        comms = self.get_commentaries(book, chapter, verse)
        comm_context = "\n".join([f"- [{c['author']}] {c['text'][:200]}..." for c in comms[:2]])
        
        prompt = (
            f"Passage d'étude : **{ref}**\n\n"
            f"Question de l'utilisateur : {question}\n\n"
            f"Contexte des commentaires disponibles :\n{comm_context or 'Aucun commentaire textuel direct.'}\n\n"
            f"Analyse exégétique synthétique :"
        )

        try:
            from ai.gemini_client import GeminiClient
            client = GeminiClient()
            answer = client.generate_response(prompt)
            return {"answer": answer}
        except Exception:
            return {
                "answer": f"**[Analyse pour {ref}]**\n\nCe passage souligne la structure théologique du texte. Vous pouvez consulter les commentaires de la barre latérale pour des détails verset par verset."
            }

    # =========================================================================
    # 2. GESTION DE LA BIBLIOTHÈQUE
    # =========================================================================

    def get_library_books(self) -> List[Dict[str, Any]]:
        """Retourne tous les ouvrages de la bibliothèque."""
        registry = load_books_metadata()
        books = []
        for name, meta in registry.items():
            b = meta.copy()
            b["name"] = name
            books.append(b)
        return books

    def toggle_book(self, book_name: str, active: bool) -> bool:
        """Active ou désactive un ouvrage."""
        registry = load_books_metadata()
        if book_name in registry:
            registry[book_name]["active"] = bool(active)
            save_books_metadata(registry)
            return True
        return False

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
                except Exception:
                    pass
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

    def pick_and_import_book(self) -> Dict[str, Any]:
        """Ouvre une boîte de dialogue pour importer un fichier."""
        if not self.window:
            return {"success": False, "error": "Fenêtre introuvable"}
            
        file_types = ('Documents supportés (*.epub;*.json;*.docx;*.csv)', 'Tous les fichiers (*.*)')
        result = self.window.create_file_dialog(webview.OPEN_DIALOG, allow_multiple=False, file_types=file_types)
        
        if not result or len(result) == 0:
            return {"cancelled": True}
            
        file_path = result[0]
        ext = os.path.splitext(file_path)[1].lower()
        
        if ext in ['.docx', '.csv']:
            # Dictionnaire
            res = DictionaryManager.import_dictionary(file_path)
            return res
        elif ext == '.epub':
            # EPUB
            from core.epub_loader import EpubLoader
            info = EpubLoader.inspect_epub(file_path)
            return {"success": True, "type": "epub", "file_path": file_path, "info": info}
        elif ext == '.json':
            return {"success": True, "type": "json", "file_path": file_path}
            
        return {"success": False, "error": f"Format non supporté : {ext}"}

    # =========================================================================
    # 3. GESTION DES PARAMÈTRES
    # =========================================================================

    def get_settings(self) -> Dict[str, Any]:
        return load_config()

    def save_settings(self, new_config: Dict[str, Any]) -> bool:
        save_config(new_config)
        self.config = load_config()
        return True

    # =========================================================================
    # 4. STEPBIBLE & DICTIONNAIRES
    # =========================================================================

    def get_stepbible_status(self) -> Dict[str, Any]:
        return OriginalLanguagesManager.get_instance().get_stats()

    def reindex_stepbible(self) -> bool:
        mgr = OriginalLanguagesManager.get_instance()
        return mgr.download_and_import()

    def get_dictionaries(self) -> List[Dict[str, Any]]:
        return [dict(d) for d in DictionaryManager.load_registry()]

    def save_dictionaries(self, dict_list: List[Dict[str, Any]]) -> bool:
        DictionaryManager.save_registry(dict_list)
        return True

    # =========================================================================
    # 5. SAUVEGARDE & RESTAURATION COMPLÈTE (ZIP)
    # =========================================================================

    def export_backup_zip(self) -> Dict[str, Any]:
        """Exporte l'ensemble des données dans un fichier ZIP sélectionné."""
        if not self.window:
            return {"success": False, "error": "Fenêtre introuvable"}
            
        now_str = datetime.datetime.now().strftime('%Y%m%d_%H%M')
        default_name = f"backup_bible_ai_{now_str}.zip"
        
        save_path = self.window.create_file_dialog(
            webview.SAVE_FILENAME_DIALOG,
            save_filename=default_name,
            file_types=('Archives ZIP (*.zip)', 'Tous les fichiers (*.*)')
        )
        if not save_path:
            return {"cancelled": True}
            
        if isinstance(save_path, (list, tuple)):
            save_path = save_path[0]

        data_dir = os.path.join(current_dir, "data")
        tmp_zip = save_path + ".tmp"

        try:
            manifest = {
                "version": _BACKUP_MANIFEST_VERSION,
                "created_at": datetime.datetime.now().isoformat(),
                "components": []
            }

            with zipfile.ZipFile(tmp_zip, "w", compression=zipfile.ZIP_DEFLATED, allowZip64=True) as zf:
                for folder_or_file, label in _BACKUP_COMPONENTS:
                    src = os.path.join(data_dir, folder_or_file)
                    if not os.path.exists(src):
                        continue

                    if os.path.isfile(src):
                        arcname = os.path.join("data", folder_or_file)
                        zf.write(src, arcname)
                        manifest["components"].append(folder_or_file)
                    else:
                        for root, _, files in os.walk(src):
                            for fname in files:
                                full = os.path.join(root, fname)
                                rel = os.path.relpath(full, data_dir)
                                zf.write(full, os.path.join("data", rel))
                        manifest["components"].append(folder_or_file)

                zf.writestr("backup_manifest.json", json.dumps(manifest, ensure_ascii=False, indent=2))

            if os.path.exists(save_path):
                os.remove(save_path)
            os.rename(tmp_zip, save_path)

            size_mb = os.path.getsize(save_path) / (1024 * 1024)
            return {"success": True, "path": save_path, "size_mb": round(size_mb, 1)}
        except Exception as e:
            if os.path.exists(tmp_zip):
                try: os.remove(tmp_zip)
                except OSError: pass
            return {"success": False, "error": str(e)}

    def import_backup_zip(self) -> Dict[str, Any]:
        """Restaure les données depuis un fichier ZIP."""
        if not self.window:
            return {"success": False, "error": "Fenêtre introuvable"}
            
        pick = self.window.create_file_dialog(
            webview.OPEN_DIALOG,
            allow_multiple=False,
            file_types=('Archives ZIP (*.zip)', 'Tous les fichiers (*.*)')
        )
        if not pick or len(pick) == 0:
            return {"cancelled": True}
            
        zip_path = pick[0]
        data_dir = os.path.join(current_dir, "data")

        try:
            with zipfile.ZipFile(zip_path, "r") as zf:
                if "backup_manifest.json" not in zf.namelist():
                    return {"success": False, "error": "Archive invalide (manifeste manquant)."}

                manifest = json.loads(zf.read("backup_manifest.json"))
                components = manifest.get("components", [])

                for component in components:
                    dest = os.path.join(data_dir, component)
                    if os.path.isdir(dest):
                        shutil.rmtree(dest, ignore_errors=True)
                    elif os.path.isfile(dest):
                        os.remove(dest)

                    prefix = f"data/{component}"
                    entries = [n for n in zf.namelist() if n.startswith(prefix)]
                    for entry in entries:
                        target = os.path.join(data_dir, os.path.relpath(entry, "data"))
                        if entry.endswith("/"):
                            os.makedirs(target, exist_ok=True)
                        else:
                            os.makedirs(os.path.dirname(target), exist_ok=True)
                            with zf.open(entry) as src_f, open(target, "wb") as dst_f:
                                shutil.copyfileobj(src_f, dst_f)

            return {"success": True}
        except Exception as e:
            return {"success": False, "error": str(e)}


def main():
    api = BibleAppApi()
    
    html_path = os.path.join(current_dir, "web", "index.html")
    
    window = webview.create_window(
        title="Bible AI — Lecteur Biblique & Étude (Logos Edition)",
        url=f"file:///{html_path.replace(os.sep, '/')}",
        js_api=api,
        width=1440,
        height=920,
        min_size=(1050, 680),
        background_color="#F8FAFC"
    )
    api.set_window(window)
    
    # Lancement avec Edge WebView2
    webview.start(debug=False)


if __name__ == "__main__":
    main()
