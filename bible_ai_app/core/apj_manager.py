import os
import sqlite3
import json
import re
import logging
from typing import Dict, List, Any, Optional

logger = logging.getLogger(__name__)

class APJManager:
    """
    Gestionnaire officiel du corpus pastoral Ask Pastor John (John Piper / Desiring God).
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
            # 1. Vérifier dans data/apj_corpus.sqlite
            p1 = os.path.join(base_dir, "data", "apj_corpus.sqlite")
            # 2. Vérifier dans data/datasets/apj_corpus.sqlite
            p2 = os.path.join(base_dir, "data", "datasets", "apj_corpus.sqlite")
            # 3. Racine projet
            p3 = os.path.abspath("data/apj_corpus/apj_corpus.sqlite")

            if os.path.exists(p1):
                cls._db_path = p1
            elif os.path.exists(p2):
                cls._db_path = p2
            elif os.path.exists(p3):
                cls._db_path = p3
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
                        e.titre_fr,
                        e.original_title,
                        e.source_url,
                        e.date_published,
                        e.type_question,
                        e.these_centrale,
                        e.resume_analytique,
                        e.illustration_titre,
                        e.illustration_resume,
                        e.applications_json,
                        e.themes_csv,
                        s.book_code,
                        s.chapter,
                        s.verse_start,
                        s.verse_end,
                        s.is_primary
                    FROM apj_scriptures s
                    JOIN apj_episodes e ON e.id = s.episode_id
                    WHERE s.book_code = ? AND s.chapter = ?
                    ORDER BY s.is_primary DESC, e.episode_number DESC
                """
                cur.execute(query, (norm_code, int(chapter)))
                rows = cur.fetchall()

                seen_episodes = set()
                results = []

                for r in rows:
                    ep_id = r["id"] if "id" in r.keys() else (r["episode_number"] or r["source_url"])
                    if ep_id in seen_episodes:
                        continue
                    seen_episodes.add(ep_id)

                    # Si un verset spécifique est demandé, vérifier s'il correspond
                    v_start = r["verse_start"] or 1
                    v_end = r["verse_end"] or v_start
                    
                    is_exact_verse = False
                    if verse is not None:
                        is_exact_verse = (v_start <= int(verse) <= v_end)

                    apps = []
                    if r["applications_json"]:
                        try:
                            apps = json.loads(r["applications_json"])
                        except Exception:
                            apps = []

                    themes = [t.strip() for t in (r["themes_csv"] or "").split(",") if t.strip()]

                    has_illustration = bool(r["illustration_titre"] or r["illustration_resume"])

                    results.append({
                        "id": r["id"] if "id" in r.keys() else None,
                        "episode_number": r["episode_number"],
                        "titre_fr": r["titre_fr"],
                        "original_title": r["original_title"],
                        "source_url": r["source_url"],
                        "date_published": r["date_published"],
                        "type_question": r["type_question"] or "pastorale",
                        "these_centrale": r["these_centrale"],
                        "resume_analytique": r["resume_analytique"],
                        "illustration": {
                            "has_illustration": has_illustration,
                            "titre": r["illustration_titre"] or "",
                            "resume": r["illustration_resume"] or ""
                        },
                        "pistes_applications": apps,
                        "themes": themes,
                        "verse_ref": f"{norm_code} {r['chapter']}:{v_start}" + (f"-{v_end}" if v_end != v_start else ""),
                        "is_primary": bool(r["is_primary"]),
                        "is_exact_verse": is_exact_verse,
                        "author": "John Piper",
                        "show_name": "Ask Pastor John",
                        "source_brand": "Desiring God",
                        "is_upvr": False
                    })
                    if len(results) >= limit:
                        break

                # Si un verset précis était demandé, on met en avant ceux qui le ciblent exactement
                if verse is not None:
                    results.sort(key=lambda x: (not x["is_exact_verse"], not x["is_primary"]))

                # Attacher l'ensemble des références bibliques (primaires et secondaires)
                self._attach_scriptures(cur, results)

                return results

        except Exception as e:
            logger.error(f"Erreur get_episodes_for_passage (APJ) : {e}")
            return []

    def search_episodes(self, query: str, limit: int = 25) -> List[Dict[str, Any]]:
        """
        Recherche plein texte FTS5 haute performance à travers les titres, thèses, résumés et analogies.
        """
        if not self.is_installed() or not query or not query.strip():
            return []

        # Nettoyage et préparation de la requête FTS5
        clean_q = re.sub(r'["\*\+\-\(\)]', ' ', query).strip()
        if not clean_q:
            return []

        # Construction requête FTS avec préfixe sur chaque terme
        terms = [f'"{t}"*' for t in clean_q.split() if len(t) > 1]
        if not terms:
            terms = [f'"{clean_q}"*']
        fts_expr = " AND ".join(terms)

        try:
            with sqlite3.connect(self.get_db_path()) as conn:
                conn.row_factory = sqlite3.Row
                cur = conn.cursor()

                cur.execute("""
                    SELECT 
                        e.id,
                        e.episode_number,
                        e.titre_fr,
                        e.original_title,
                        e.source_url,
                        e.type_question,
                        e.these_centrale,
                        e.resume_analytique,
                        e.illustration_titre,
                        e.illustration_resume,
                        e.themes_csv,
                        snippet(apj_fts, 1, '<mark>', '</mark>', '...', 12) as snippet_titre,
                        snippet(apj_fts, 2, '<mark>', '</mark>', '...', 15) as snippet_these,
                        snippet(apj_fts, 3, '<mark>', '</mark>', '...', 20) as snippet_resume
                    FROM apj_fts f
                    JOIN apj_episodes e ON e.id = f.rowid
                    WHERE apj_fts MATCH ?
                    LIMIT ?
                """, (fts_expr, limit))

                rows = cur.fetchall()
                results = []
                for r in rows:
                    snippet = r["snippet_these"] or r["snippet_resume"] or r["snippet_titre"] or r["these_centrale"]
                    results.append({
                        "id": r["id"],
                        "episode_number": r["episode_number"],
                        "titre_fr": r["titre_fr"],
                        "original_title": r["original_title"],
                        "source_url": r["source_url"],
                        "type_question": r["type_question"],
                        "these_centrale": r["these_centrale"],
                        "resume_analytique": r["resume_analytique"],
                        "illustration_titre": r["illustration_titre"],
                        "illustration_resume": r["illustration_resume"],
                        "snippet": snippet,
                        "themes": [t.strip() for t in (r["themes_csv"] or "").split(",") if t.strip()],
                        "author": "John Piper",
                        "show_name": "Ask Pastor John",
                        "source_brand": "Desiring God",
                        "is_upvr": False
                    })

                self._attach_scriptures(cur, results)
                return results

        except Exception as e:
            logger.debug(f"Erreur search_episodes FTS5 : {e}")
            # Fallback sur LIKE simple si erreur syntaxe FTS
            return self._search_like_fallback(query, limit)

    def _search_like_fallback(self, query: str, limit: int = 20) -> List[Dict[str, Any]]:
        try:
            with sqlite3.connect(self.get_db_path()) as conn:
                conn.row_factory = sqlite3.Row
                cur = conn.cursor()
                pat = f"%{query}%"
                cur.execute("""
                    SELECT id, episode_number, titre_fr, original_title, source_url, type_question, these_centrale, resume_analytique, themes_csv
                    FROM apj_episodes
                    WHERE titre_fr LIKE ? OR these_centrale LIKE ? OR themes_csv LIKE ?
                    LIMIT ?
                """, (pat, pat, pat, limit))
                return [dict(r) for r in cur.fetchall()]
        except Exception as e:
            logger.error(f"Erreur fallback search : {e}")
            return []

    def get_episode_details(self, episode_identifier: Any) -> Optional[Dict[str, Any]]:
        """Retourne la fiche complète d'un épisode donné (par numéro, id ou URL) avec ses versets associés."""
        if not self.is_installed():
            return None

        try:
            with sqlite3.connect(self.get_db_path()) as conn:
                conn.row_factory = sqlite3.Row
                cur = conn.cursor()

                try:
                    val = int(episode_identifier)
                    cur.execute("SELECT * FROM apj_episodes WHERE episode_number = ? OR id = ?", (val, val))
                except (ValueError, TypeError):
                    cur.execute("SELECT * FROM apj_episodes WHERE source_url = ?", (str(episode_identifier),))

                row = cur.fetchone()
                if not row:
                    return None

                ep = dict(row)
                ep["author"] = "John Piper"
                ep["show_name"] = "Ask Pastor John"
                ep["source_brand"] = "Desiring God"
                ep["is_upvr"] = False
                if ep.get("applications_json"):
                    try:
                        ep["pistes_applications"] = json.loads(ep["applications_json"])
                    except Exception:
                        ep["pistes_applications"] = []

                self._attach_scriptures(cur, [ep])
                return ep
        except Exception as e:
            logger.error(f"Erreur get_episode_details : {e}")
            return None

    def _attach_scriptures(self, cur, episodes_list: List[Dict[str, Any]]) -> None:
        """Récupère et formate les passages primaires et secondaires en français pour une liste d'épisodes."""
        if not episodes_list:
            return

        try:
            from core.reference_parser import get_french_book_name
        except Exception:
            try:
                from bible_ai_app.core.reference_parser import get_french_book_name
            except Exception:
                get_french_book_name = lambda x: x

        ep_ids = [ep["id"] for ep in episodes_list if ep.get("id") is not None]
        ep_nums = [ep["episode_number"] for ep in episodes_list if ep.get("episode_number") is not None]

        if not ep_ids and not ep_nums:
            return

        if ep_ids:
            placeholders = ",".join("?" for _ in ep_ids)
            cur.execute(f"""
                SELECT s.episode_id, e.episode_number, s.book_code, s.chapter, s.verse_start, s.verse_end, s.is_primary
                FROM apj_scriptures s
                JOIN apj_episodes e ON e.id = s.episode_id
                WHERE s.episode_id IN ({placeholders})
                ORDER BY s.is_primary DESC, s.chapter ASC, s.verse_start ASC
            """, ep_ids)
        else:
            placeholders = ",".join("?" for _ in ep_nums)
            cur.execute(f"""
                SELECT s.episode_id, e.episode_number, s.book_code, s.chapter, s.verse_start, s.verse_end, s.is_primary
                FROM apj_scriptures s
                JOIN apj_episodes e ON e.id = s.episode_id
                WHERE e.episode_number IN ({placeholders})
                ORDER BY s.is_primary DESC, s.chapter ASC, s.verse_start ASC
            """, ep_nums)

        scriptures_by_id = {}
        scriptures_by_num = {}
        for ep_id, ep_n, b_code, ch, vs, ve, is_prim in cur.fetchall():
            if ep_id not in scriptures_by_id:
                scriptures_by_id[ep_id] = {"primaires": [], "secondaires": []}
            if ep_n is not None and ep_n not in scriptures_by_num:
                scriptures_by_num[ep_n] = {"primaires": [], "secondaires": []}

            b_name = get_french_book_name(b_code) or b_code
            ref_str = f"{b_name} {ch}:{vs}" + (f"-{ve}" if ve and ve != vs else "")
            if is_prim:
                scriptures_by_id[ep_id]["primaires"].append(ref_str)
                if ep_n is not None:
                    scriptures_by_num[ep_n]["primaires"].append(ref_str)
            else:
                scriptures_by_id[ep_id]["secondaires"].append(ref_str)
                if ep_n is not None:
                    scriptures_by_num[ep_n]["secondaires"].append(ref_str)

        for ep in episodes_list:
            sc = None
            if ep.get("id") in scriptures_by_id:
                sc = scriptures_by_id[ep["id"]]
            elif ep.get("episode_number") in scriptures_by_num:
                sc = scriptures_by_num[ep["episode_number"]]
            else:
                sc = {"primaires": [], "secondaires": []}

            ep["passages_primaires"] = sc["primaires"]
            ep["passages_secondaires"] = sc["secondaires"]
            ep["all_passages"] = sc["primaires"] + sc["secondaires"]
            if not ep.get("verse_ref") and sc["primaires"]:
                ep["verse_ref"] = sc["primaires"][0]

