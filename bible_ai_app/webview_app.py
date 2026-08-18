import os
import sys
import json
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
    BOOKS_DEUTERO
)
from core.pericope_manager import PericopeManager
from core.commentary_loader import CommentaryLoader
from core.config import load_config, save_config
from gui.library_utils import load_books_metadata


class BibleAppApi:
    """
    API Bridge exposée au Frontend Webview JavaScript.
    Chaque méthode publique est directement invocable via window.pywebview.api.<nom_methode>(...).
    """

    def __init__(self):
        self.config = load_config()

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
        
        # Si vide, fallback sur la recherche directe de dossiers JSON
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
        """Retourne la liste complète des 66 livres bibliques + deutérocanoniques."""
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
        """
        Récupère instantanément (< 1ms) les versets d'un chapitre et son titre de section.
        """
        ch_int = int(chapter)
        book_data = BibleJsonLoader.load_book(bible_name, book_code)
        french_name = get_french_book_name(book_code)

        if not book_data or "chapters" not in book_data:
            # Essayer avec la première Bible disponible si le nom est introuvable
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

        # Récupération du titre de péricope (section)
        sections = book_data.get("sections", {})
        pericope_title = sections.get(f"{ch_int}:1") or sections.get(f"{ch_int}") or f"CHAPITRE {ch_int}"

        # Extraction propre des versets
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
        """
        Récupère instantanément tous les commentaires exégétiques pour un verset donné.
        """
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
        """
        Décode une saisie utilisateur de passage biblique (ex: 'Jean 3', 'Gen 1:1', 'Rom 8').
        """
        resolved = resolve_book_input(raw_input)
        if resolved:
            code, french, ch_count = resolved
            # Vérifier si un chapitre a été spécifié
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
        """
        Interroge l'assistant IA avec le contexte du passage biblique.
        """
        # Générer une réponse concise basée sur le contexte
        french = get_french_book_name(book)
        ref = f"{french} {chapter}:{verse}"
        
        # Récupérer les commentaires associés pour contextualiser
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

    def get_settings(self) -> Dict[str, Any]:
        return load_config()

    def save_settings(self, new_config: Dict[str, Any]) -> bool:
        save_config(new_config)
        return True


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
    
    # Lancement avec le moteur natif Edge WebView2
    webview.start(debug=False)


if __name__ == "__main__":
    main()
