import os
import sqlite3
import json
import re
import logging
from typing import Dict, List, Any, Optional

logger = logging.getLogger(__name__)

class UPVRManager:
    """
    Gestionnaire officiel du corpus pastoral 'Un pasteur vous répond' (Florent Varak / ToutPourSaGloire.com).
    Permet l'interrogation ultra-rapide (< 1ms) des fiches pastorales,
    la liaison contextuelle par péricope/verset et la recherche plein-texte FTS5.
    """
    _instance = None
    _db_path = None

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    @classmethod
    def get_db_path(cls) -> str:
        if cls._db_path is None:
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            # 1. Vérifier dans data/upvr_corpus.sqlite
            p1 = os.path.join(base_dir, "data", "upvr_corpus.sqlite")
            # 2. Vérifier dans data/upvr_corpus/upvr_corpus.sqlite
            p2 = os.path.join(base_dir, "data", "upvr_corpus", "upvr_corpus.sqlite")
            # 3. Racine projet
            p3 = os.path.abspath("data/upvr_corpus/upvr_corpus.sqlite")
            p4 = os.path.abspath("data/upvr_corpus.sqlite")

            if os.path.exists(p1):
                cls._db_path = p1
            elif os.path.exists(p2):
                cls._db_path = p2
            elif os.path.exists(p3):
                cls._db_path = p3
            elif os.path.exists(p4):
                cls._db_path = p4
            else:
                cls._db_path = p1
        return cls._db_path

    @classmethod
    def is_installed(cls) -> bool:
        return os.path.exists(cls.get_db_path())

    def get_episodes_for_passage(
        self,
        book_code: str,
        chapter: int,
        verse: Optional[int] = None,
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """
        Récupère les épisodes pastoraux associés à un livre et un chapitre donnés.
        Hiérarchise automatiquement les passages primaires (focalisés sur le texte)
        puis les passages secondaires.
        """
        if not self.is_installed():
            return []

        try:
            from core.reference_parser import get_standard_book_code
        except ModuleNotFoundError:
            try:
                from bible_ai_app.core.reference_parser import get_standard_book_code
            except ModuleNotFoundError:
                get_standard_book_code = lambda x: x
        norm_code = get_standard_book_code(book_code) or book_code

        try:
            with sqlite3.connect(self.get_db_path()) as conn:
                conn.row_factory = sqlite3.Row
                cur = conn.cursor()

                # Requête avec tri par priorité (is_primary DESC) et verset
                query = """
                    SELECT 
                        e.id,
                        e.episode_number,
                        e.titre,
                        e.source_url,
                        e.audio_url,
                        e.mp3_url,
                        e.duration,
                        e.youtube_url,
                        e.date_published,
                        e.question_auditeur,
                        e.these_centrale,
                        e.resume_analytique,
                        e.points_cles_json,
                        e.applications_json,
                        e.themes_csv,
                        e.transcription_type,
                        s.book_code,
                        s.chapter,
                        s.verse_start,
                        s.verse_end,
                        s.is_primary
                    FROM upvr_scriptures s
                    JOIN upvr_episodes e ON e.id = s.episode_id
                    WHERE s.book_code = ? AND s.chapter = ?
                    ORDER BY s.is_primary DESC, e.episode_number DESC
                """
                cur.execute(query, (norm_code, int(chapter)))
                rows = cur.fetchall()

                seen_episodes = set()
                results = []

                for r in rows:
                    ep_id = r["id"] if "id" in r.keys() else r["episode_number"]
                    if ep_id in seen_episodes:
                        continue
                    seen_episodes.add(ep_id)

                    # Vérification verset si précisé
                    v_start = r["verse_start"] or 1
                    v_end = r["verse_end"] or v_start
                    
                    is_exact_verse = False
                    if verse is not None:
                        is_exact_verse = (v_start <= int(verse) <= v_end)

                    points_cles = []
                    if r["points_cles_json"]:
                        try:
                            points_cles = json.loads(r["points_cles_json"])
                        except Exception:
                            points_cles = []

                    apps = []
                    if r["applications_json"]:
                        try:
                            apps = json.loads(r["applications_json"])
                        except Exception:
                            apps = []

                    themes = [t.strip() for t in (r["themes_csv"] or "").split(",") if t.strip()]

                    type_q = "Question d'auditeur" if r["question_auditeur"] else "Pastorale"
                    results.append({
                        "id": r["id"],
                        "episode_number": r["episode_number"],
                        "titre": r["titre"],
                        "titre_fr": r["titre"],
                        "original_title": r["titre"],
                        "source_url": r["source_url"],
                        "source_brand": "ToutPourSaGloire",
                        "audio_url": r["audio_url"],
                        "mp3_url": r["mp3_url"] if "mp3_url" in r.keys() else None,
                        "duration": r["duration"] if "duration" in r.keys() else None,
                        "youtube_url": r["youtube_url"],
                        "date_published": r["date_published"],
                        "type_question": type_q,
                        "question_auditeur": r["question_auditeur"],
                        "these_centrale": r["these_centrale"],
                        "resume_analytique": r["resume_analytique"],
                        "points_cles": points_cles,
                        "applications_pastorales": apps,
                        "pistes_applications": apps,
                        "illustration": {"has_illustration": False, "titre": "", "resume": ""},
                        "themes": themes,
                        "verse_ref": f"{norm_code} {r['chapter']}:{v_start}" + (f"-{v_end}" if v_end != v_start else ""),
                        "is_primary": bool(r["is_primary"]),
                        "is_exact_verse": is_exact_verse,
                        "author": "Florent Varak",
                        "show_name": "Un pasteur vous répond",
                        "is_upvr": True
                    })
                    if len(results) >= limit:
                        break

                if verse is not None:
                    results.sort(key=lambda x: (not x["is_exact_verse"], not x["is_primary"]))

                self._attach_scriptures(cur, results)
                return results

        except Exception as e:
            logger.error(f"Erreur get_episodes_for_passage (UPVR) : {e}")
            return []

    def search_episodes(self, query: str, limit: int = 25) -> List[Dict[str, Any]]:
        """
        Recherche plein texte FTS5 haute performance dans le corpus de Florent Varak.
        """
        if not self.is_installed() or not query or not query.strip():
            return []

        cleaned_q = re.sub(r'[\'\"*?^~:()\[\]]', ' ', query.strip())
        tokens = [t.strip() for t in cleaned_q.split() if len(t.strip()) > 1]
        if not tokens:
            return []

        fts_pattern = " ".join(f'"{t}"*' for t in tokens)

        try:
            with sqlite3.connect(self.get_db_path()) as conn:
                conn.row_factory = sqlite3.Row
                cur = conn.cursor()

                sql = """
                    SELECT 
                        e.id,
                        e.episode_number,
                        e.titre,
                        e.source_url,
                        e.audio_url,
                        e.mp3_url,
                        e.duration,
                        e.youtube_url,
                        e.date_published,
                        e.question_auditeur,
                        e.these_centrale,
                        e.resume_analytique,
                        e.points_cles_json,
                        e.applications_json,
                        e.themes_csv,
                        rank
                    FROM upvr_fts(?)
                    JOIN upvr_episodes e ON e.id = upvr_fts.rowid
                    ORDER BY rank
                    LIMIT ?
                """
                cur.execute(sql, (fts_pattern, limit))
                rows = cur.fetchall()

                results = []
                for r in rows:
                    pts = []
                    if r["points_cles_json"]:
                        try:
                            pts = json.loads(r["points_cles_json"])
                        except Exception:
                            pts = []

                    apps = []
                    if r["applications_json"]:
                        try:
                            apps = json.loads(r["applications_json"])
                        except Exception:
                            apps = []

                    type_q = "Question d'auditeur" if r["question_auditeur"] else "Pastorale"
                    results.append({
                        "id": r["id"],
                        "episode_number": r["episode_number"],
                        "titre": r["titre"],
                        "titre_fr": r["titre"],
                        "original_title": r["titre"],
                        "source_url": r["source_url"],
                        "source_brand": "ToutPourSaGloire",
                        "audio_url": r["audio_url"],
                        "mp3_url": r["mp3_url"] if "mp3_url" in r.keys() else None,
                        "duration": r["duration"] if "duration" in r.keys() else None,
                        "youtube_url": r["youtube_url"],
                        "date_published": r["date_published"],
                        "type_question": type_q,
                        "question_auditeur": r["question_auditeur"],
                        "these_centrale": r["these_centrale"],
                        "resume_analytique": r["resume_analytique"],
                        "points_cles": pts,
                        "applications_pastorales": apps,
                        "pistes_applications": apps,
                        "illustration": {"has_illustration": False, "titre": "", "resume": ""},
                        "themes": [t.strip() for t in (r["themes_csv"] or "").split(",") if t.strip()],
                        "author": "Florent Varak",
                        "show_name": "Un pasteur vous répond",
                        "is_upvr": True
                    })

                self._attach_scriptures(cur, results)
                return results
        except Exception as e:
            logger.error(f"Erreur search_episodes (UPVR) : {e}")
            return []

    def get_episode_by_number(self, episode_number: int) -> Optional[Dict[str, Any]]:
        """Récupère une fiche complète par son numéro d'épisode."""
        if not self.is_installed():
            return None

        try:
            with sqlite3.connect(self.get_db_path()) as conn:
                conn.row_factory = sqlite3.Row
                cur = conn.cursor()
                cur.execute("SELECT * FROM upvr_episodes WHERE episode_number = ?", (int(episode_number),))
                r = cur.fetchone()
                if not r:
                    return None

                pts = json.loads(r["points_cles_json"]) if r["points_cles_json"] else []
                apps = json.loads(r["applications_json"]) if r["applications_json"] else []
                type_q = "Question d'auditeur" if r["question_auditeur"] else "Pastorale"

                item = {
                    "id": r["id"],
                    "episode_number": r["episode_number"],
                    "titre": r["titre"],
                    "titre_fr": r["titre"],
                    "original_title": r["titre"],
                    "source_url": r["source_url"],
                    "source_brand": "ToutPourSaGloire",
                    "audio_url": r["audio_url"],
                    "mp3_url": r["mp3_url"] if "mp3_url" in r.keys() else None,
                    "duration": r["duration"] if "duration" in r.keys() else None,
                    "youtube_url": r["youtube_url"],
                    "date_published": r["date_published"],
                    "type_question": type_q,
                    "question_auditeur": r["question_auditeur"],
                    "these_centrale": r["these_centrale"],
                    "resume_analytique": r["resume_analytique"],
                    "points_cles": pts,
                    "applications_pastorales": apps,
                    "pistes_applications": apps,
                    "illustration": {"has_illustration": False, "titre": "", "resume": ""},
                    "themes": [t.strip() for t in (r["themes_csv"] or "").split(",") if t.strip()],
                    "author": "Florent Varak",
                    "show_name": "Un pasteur vous répond",
                    "is_upvr": True
                }
                self._attach_scriptures(cur, [item])
                return item
        except Exception as e:
            logger.error(f"Erreur get_episode_by_number (UPVR) : {e}")
            return None

    def _attach_scriptures(self, cur: sqlite3.Cursor, episodes: List[Dict[str, Any]]):
        if not episodes:
            return

        ep_ids = [e["id"] for e in episodes if e.get("id")]
        if not ep_ids:
            return

        placeholders = ",".join("?" * len(ep_ids))
        sql = f"""
            SELECT episode_id, book_code, chapter, verse_start, verse_end, is_primary
            FROM upvr_scriptures
            WHERE episode_id IN ({placeholders})
            ORDER BY is_primary DESC, id ASC
        """
        cur.execute(sql, ep_ids)
        rows = cur.fetchall()

        scriptures_by_ep = {}
        for r in rows:
            eid = r["episode_id"]
            if eid not in scriptures_by_ep:
                scriptures_by_ep[eid] = {"primaires": [], "secondaires": []}

            v_str = f"{r['book_code']} {r['chapter']}"
            if r['verse_start']:
                v_str += f":{r['verse_start']}"
                if r['verse_end'] and r['verse_end'] != r['verse_start']:
                    v_str += f"-{r['verse_end']}"

            if r["is_primary"]:
                scriptures_by_ep[eid]["primaires"].append(v_str)
            else:
                scriptures_by_ep[eid]["secondaires"].append(v_str)

        for ep in episodes:
            eid = ep.get("id")
            sc = scriptures_by_ep.get(eid, {"primaires": [], "secondaires": []})
            ep["passages_primaires"] = sc["primaires"]
            ep["passages_secondaires"] = sc["secondaires"]

    def get_stats(self) -> Dict[str, Any]:
        """Retourne les métadonnées et statistiques du corpus."""
        if not self.is_installed():
            return {"installed": False}

        try:
            with sqlite3.connect(self.get_db_path()) as conn:
                cur = conn.cursor()
                cur.execute("SELECT count(*) FROM upvr_episodes")
                ep_count = cur.fetchone()[0]
                cur.execute("SELECT count(*) FROM upvr_scriptures")
                sc_count = cur.fetchone()[0]
                cur.execute("SELECT count(*) FROM upvr_scriptures WHERE is_primary = 1")
                primary_count = cur.fetchone()[0]

                return {
                    "installed": True,
                    "db_path": self.get_db_path(),
                    "total_episodes": ep_count,
                    "total_scriptures": sc_count,
                    "primary_scriptures": primary_count,
                    "author": "Florent Varak",
                    "show": "Un pasteur vous répond"
                }
        except Exception as e:
            return {"installed": False, "error": str(e)}
