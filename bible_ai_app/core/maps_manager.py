"""
Maps Manager for Open Shema
Gère les requêtes géographiques bibliques, les correspondances avec les chapitres/versets,
la recherche de lieux et la fourniture des grands itinéraires bibliques.
"""

import os
import sqlite3
import json
import re
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger("MapsManager")

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
APP_DIR = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
DATA_DIR = os.path.join(APP_DIR, "data")
DB_PATH = os.path.join(DATA_DIR, "biblical_places.db")


def clean_comment_markup(text: str) -> str:
    """Nettoie les balises XML brutes (ex: <source id="...">, <modern id="...">) pour un texte lisible."""
    if not text:
        return ""
    cleaned = re.sub(r'<[^>]+>', '', text)
    cleaned = cleaned.replace('&amp;', '&').replace('&quot;', '"').replace('&apos;', "'").replace('&lt;', '<').replace('&gt;', '>')
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    return cleaned


class MapsManager:
    _conn = None

    @classmethod
    def get_connection(cls) -> sqlite3.Connection:
        if cls._conn is None:
            if not os.path.exists(DB_PATH):
                logger.warning(f"Base de données de cartes introuvable: {DB_PATH}")
                # Tentative d'auto-construction si le script existe
                try:
                    from scripts.build_biblical_places_db import build_database
                    logger.info("Construction automatique de biblical_places.db...")
                    build_database()
                except Exception as e:
                    logger.error(f"Erreur lors de la construction automatique: {e}")
            
            if os.path.exists(DB_PATH):
                cls._conn = sqlite3.connect(DB_PATH, check_same_thread=False)
                cls._conn.row_factory = sqlite3.Row
        return cls._conn

    @classmethod
    def search_places(cls, query: str = "", place_type: Optional[str] = None, limit: int = 150) -> List[Dict[str, Any]]:
        """
        Recherche des lieux bibliques par nom (français ou anglais), avec filtre optionnel par type.
        """
        conn = cls.get_connection()
        if not conn:
            return []

        cur = conn.cursor()
        sql = "SELECT * FROM places WHERE 1=1"
        params = []

        if query and query.strip():
            q = f"%{query.strip()}%"
            sql += " AND (name_fr LIKE ? OR name_en LIKE ? OR modern_name LIKE ?)"
            params.extend([q, q, q])

        if place_type and place_type.lower() != "all" and place_type.lower() != "tous":
            sql += " AND place_type = ?"
            params.append(place_type.lower())

        sql += " ORDER BY verses_count DESC, name_fr ASC LIMIT ?"
        params.append(limit)

        try:
            cur.execute(sql, params)
            rows = cur.fetchall()
            results = []
            for r in rows:
                verses_list = []
                if r["verses_json"]:
                    try:
                        verses_list = json.loads(r["verses_json"])
                    except Exception:
                        pass
                results.append({
                    "place_id": r["place_id"],
                    "name_fr": r["name_fr"],
                    "name_en": r["name_en"],
                    "ancient_name": clean_comment_markup(r["ancient_name"]),
                    "modern_name": clean_comment_markup(r["modern_name"]),
                    "latitude": r["latitude"],
                    "longitude": r["longitude"],
                    "place_type": r["place_type"],
                    "confidence": r["confidence"],
                    "comment": clean_comment_markup(r["comment"]),
                    "verses_count": r["verses_count"],
                    "verses": verses_list[:20], # Limiter pour l'aperçu
                    "thumbnail_url": r["thumbnail_url"]
                })
            return results
        except Exception as e:
            logger.error(f"Erreur recherche lieux: {e}")
            return []

    @classmethod
    def get_places_for_chapter(cls, book_code: str, chapter_num: int) -> List[Dict[str, Any]]:
        """
        Retourne tous les lieux mentionnés dans un chapitre spécifique de la Bible.
        """
        conn = cls.get_connection()
        if not conn:
            return []

        # Normaliser le code de livre (ex: 'Gen' -> 'GEN', '1Th' -> '1TH', etc.)
        b_code = book_code.strip().upper()

        cur = conn.cursor()
        sql = """
        SELECT DISTINCT p.*, GROUP_CONCAT(pv.verse, ', ') as verses_in_chapter
        FROM places p
        JOIN place_verses pv ON p.place_id = pv.place_id
        WHERE pv.book = ? AND pv.chapter = ?
        GROUP BY p.place_id
        ORDER BY MIN(pv.verse) ASC
        """
        try:
            cur.execute(sql, (b_code, int(chapter_num)))
            rows = cur.fetchall()
            places = []
            for r in rows:
                verses_list = []
                if r["verses_json"]:
                    try:
                        verses_list = json.loads(r["verses_json"])
                    except Exception:
                        pass
                places.append({
                    "place_id": r["place_id"],
                    "name_fr": r["name_fr"],
                    "name_en": r["name_en"],
                    "ancient_name": clean_comment_markup(r["ancient_name"]),
                    "modern_name": clean_comment_markup(r["modern_name"]),
                    "latitude": r["latitude"],
                    "longitude": r["longitude"],
                    "place_type": r["place_type"],
                    "confidence": r["confidence"],
                    "comment": clean_comment_markup(r["comment"]),
                    "verses_count": r["verses_count"],
                    "verses_in_chapter": r["verses_in_chapter"],
                    "verses": verses_list,
                    "thumbnail_url": r["thumbnail_url"]
                })
            return places
        except Exception as e:
            logger.error(f"Erreur récupération lieux pour chapitre {book_code} {chapter_num}: {e}")
            return []

    @classmethod
    def get_place_details(cls, place_id: str) -> Optional[Dict[str, Any]]:
        """
        Retourne les détails complets d'un lieu avec toutes ses références bibliques.
        """
        conn = cls.get_connection()
        if not conn:
            return None

        cur = conn.cursor()
        try:
            cur.execute("SELECT * FROM places WHERE place_id = ?", (place_id,))
            r = cur.fetchone()
            if not r:
                return None

            # Récupérer les versets détaillés
            cur.execute("SELECT book, chapter, verse, osis FROM place_verses WHERE place_id = ? ORDER BY id ASC", (place_id,))
            v_rows = cur.fetchall()
            verses_detailed = []
            for vr in v_rows:
                verses_detailed.append({
                    "book": vr["book"],
                    "chapter": vr["chapter"],
                    "verse": vr["verse"],
                    "osis": vr["osis"]
                })

            return {
                "place_id": r["place_id"],
                "name_fr": r["name_fr"],
                "name_en": r["name_en"],
                "ancient_name": clean_comment_markup(r["ancient_name"]),
                "modern_name": clean_comment_markup(r["modern_name"]),
                "latitude": r["latitude"],
                "longitude": r["longitude"],
                "place_type": r["place_type"],
                "confidence": r["confidence"],
                "comment": clean_comment_markup(r["comment"]),
                "verses_count": r["verses_count"],
                "verses_detailed": verses_detailed,
                "thumbnail_url": r["thumbnail_url"]
            }
        except Exception as e:
            logger.error(f"Erreur détails lieu {place_id}: {e}")
            return None

    @classmethod
    def get_all_itineraries(cls) -> List[Dict[str, Any]]:
        """
        Retourne la liste des grands itinéraires bibliques disponibles.
        """
        conn = cls.get_connection()
        if not conn:
            return []

        cur = conn.cursor()
        try:
            cur.execute("SELECT * FROM itineraries ORDER BY itinerary_id ASC")
            rows = cur.fetchall()
            results = []
            for r in rows:
                waypoints = []
                if r["waypoints_json"]:
                    try:
                        waypoints = json.loads(r["waypoints_json"])
                    except Exception:
                        pass
                results.append({
                    "itinerary_id": r["itinerary_id"],
                    "title": r["title"],
                    "category": r["category"],
                    "description": r["description"],
                    "color": r["color"],
                    "waypoints": waypoints
                })
            return results
        except Exception as e:
            logger.error(f"Erreur récupération itinéraires: {e}")
            return []
