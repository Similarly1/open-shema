"""
CommentaryMixin - Extracted from BibleAppApi.
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



class CommentaryMixin:
    def get_commentaries(self, book_code: str, chapter: int, verse: int) -> List[Dict[str, Any]]:
        """Récupère instantanément tous les commentaires pour un verset donné en regroupant les sections par ouvrage."""
        try:
            ch_int = int(chapter) if chapter is not None else 1
        except Exception:
            ch_int = 1
            
        try:
            v_int = int(verse) if verse is not None else 1
        except Exception:
            v_int = 1

        res = CommentaryLoader.get_all_comments_for_passage(book_code, ch_int, v_int)
        
        grouped = {}
        for i, text in enumerate(res.get("documents", [])):
            meta = res["metadatas"][i] if i < len(res.get("metadatas", [])) else {}
            cid = meta.get("commentary_id", meta.get("name", "Commentaire"))
            cname = meta.get("name", "Commentaire")
            ref = meta.get("reference", f"{book_code} {ch_int}:{v_int}")
            
            if cid not in grouped:
                grouped[cid] = {
                    "author": cname,
                    "source": cname,
                    "reference": ref,
                    "texts": [text]
                }
            else:
                grouped[cid]["texts"].append(text)
                if ref not in grouped[cid]["reference"]:
                    grouped[cid]["reference"] += f" / {ref}"

        comments = []
        for cid, data in grouped.items():
            comments.append({
                "commentary_id": str(cid),
                "author": data["author"],
                "source": data["source"],
                "reference": data["reference"],
                "text": "\n\n---\n\n".join(data["texts"])
            })
        return comments

    def get_chapter_commentaries_grouped(self, book_code: str, chapter: int) -> Dict[str, Any]:
        """
        Récupère l'intégralité des commentaires exégétiques pour un chapitre complet,
        regroupés par verset, avec le texte biblique de référence associé pour l'affichage en flux continu.
        """
        ch_int = int(chapter)
        french_name = get_french_book_name(book_code)

        # 1. Récupérer tous les commentaires bruts du chapitre
        res = CommentaryLoader.get_all_comments_for_passage(book_code, ch_int, None)
        
        # 2. Récupérer le texte des versets du chapitre (chargement direct ultra-rapide avec cache)
        verses_text_map = {}
        try:
            book_data = BibleJsonLoader.load_book("Segond 21", book_code)
            if not book_data:
                book_data = BibleJsonLoader.load_book("LSG", book_code)
            if not book_data:
                book_data = BibleJsonLoader.load_book("DARBY", book_code)
            if not book_data:
                installed = self.get_installed_bibles()
                if installed:
                    book_data = BibleJsonLoader.load_book(installed[0]["name"], book_code)
            if book_data:
                verses_dict = book_data.get("chapters", {}).get(str(ch_int), {})
                for v_str, v_val in verses_dict.items():
                    if v_str.isdigit():
                        if isinstance(v_val, dict):
                            verses_text_map[int(v_str)] = v_val.get("text", "")
                        else:
                            verses_text_map[int(v_str)] = str(v_val)
        except Exception as e:
            logger.warning(f"Erreur chargement texte versets pour chapitre {book_code} {ch_int}: {e}")

        # 3. Regrouper les commentaires par verset de départ
        comments_by_verse: Dict[int, Dict[str, Dict[str, Any]]] = {}
        all_sources_set = set()

        for i, text in enumerate(res.get("documents", [])):
            meta = res["metadatas"][i] if i < len(res.get("metadatas", [])) else {}
            cid = meta.get("commentary_id", meta.get("name", "Commentaire"))
            cname = meta.get("name", "Commentaire")
            v_start = int(meta.get("verse_start", 1))
            v_end = int(meta.get("verse_end", v_start))
            ref = meta.get("reference", f"{book_code} {ch_int}:{v_start}")
            all_sources_set.add(cname)

            if v_start not in comments_by_verse:
                comments_by_verse[v_start] = {}

            if cid not in comments_by_verse[v_start]:
                comments_by_verse[v_start][cid] = {
                    "id": cid,
                    "author": cname,
                    "source": cname,
                    "reference": ref,
                    "verse_start": v_start,
                    "verse_end": v_end,
                    "texts": [text]
                }
            else:
                comments_by_verse[v_start][cid]["texts"].append(text)
                if ref not in comments_by_verse[v_start][cid]["reference"]:
                    comments_by_verse[v_start][cid]["reference"] += f" / {ref}"

        # 4. Construire la liste ordonnée des versets avec leurs commentaires
        verses_out = []
        max_verse = max(
            list(verses_text_map.keys()) + list(comments_by_verse.keys()) + [1]
        )

        for v_num in range(1, max_verse + 1):
            v_text = verses_text_map.get(v_num, "")
            comm_dict = comments_by_verse.get(v_num, {})
            v_comments = []
            for cid, c_data in comm_dict.items():
                v_comments.append({
                    "id": c_data["id"],
                    "author": c_data["author"],
                    "source": c_data["source"],
                    "reference": c_data["reference"],
                    "verse_start": c_data["verse_start"],
                    "verse_end": c_data["verse_end"],
                    "text": "\n\n---\n\n".join(c_data["texts"])
                })

            verses_out.append({
                "verse": v_num,
                "text": v_text,
                "comments": v_comments,
                "has_comments": len(v_comments) > 0
            })

        return {
            "book": book_code,
            "book_french": french_name,
            "chapter": ch_int,
            "total_verses": len(verses_out),
            "verses": verses_out,
            "available_sources": sorted(list(all_sources_set))
        }

    def synthesize_commentaries(self, book_code: str, chapter: int, verse_start: int, verse_end: Optional[int] = None, model: Optional[str] = None, *args, **kwargs) -> Dict[str, Any]:
        """Génère une synthèse exégétique comparative par IA de tous les commentaires d'une plage de versets."""
        from core.commentary_synthesizer import CommentarySynthesizer
        return CommentarySynthesizer.synthesize(
            book_code=book_code,
            chapter=chapter,
            verse_start=verse_start,
            verse_end=verse_end,
            model=model
        )

