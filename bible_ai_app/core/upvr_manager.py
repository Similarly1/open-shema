import os
import sqlite3
import json
import re
import logging
from typing import Dict, List, Any, Optional, Callable

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

                # Vérifier si la table upvr_rag_chunks existe
                cur.execute("SELECT count(*) FROM sqlite_master WHERE type='table' AND name='upvr_rag_chunks'")
                has_chunks_table = bool(cur.fetchone()[0])
                total_chunks = 0
                if has_chunks_table:
                    cur.execute("SELECT count(*) FROM upvr_rag_chunks")
                    total_chunks = cur.fetchone()[0]

                return {
                    "installed": True,
                    "db_path": self.get_db_path(),
                    "total_episodes": ep_count,
                    "total_scriptures": sc_count,
                    "primary_scriptures": primary_count,
                    "total_rag_chunks": total_chunks,
                    "author": "Florent Varak",
                    "show": "Un pasteur vous répond"
                }
        except Exception as e:
            return {"installed": False, "error": str(e)}

    def get_all_rag_chunks(self) -> List[Dict[str, Any]]:
        """
        Récupère tous les fragments RAG formatés pour l'indexation ChromaDB.
        Chaque chunk contient le contexte complet de l'enseignement pastoral.
        """
        if not self.is_installed():
            return []

        try:
            with sqlite3.connect(self.get_db_path()) as conn:
                conn.row_factory = sqlite3.Row
                cur = conn.cursor()

                # Vérifier présence table
                cur.execute("SELECT count(*) FROM sqlite_master WHERE type='table' AND name='upvr_rag_chunks'")
                if not cur.fetchone()[0]:
                    return []

                sql = """
                    SELECT 
                        c.id,
                        c.episode_number,
                        c.chunk_index,
                        c.section_title,
                        c.content,
                        c.verse_refs,
                        c.themes,
                        c.source_url,
                        c.mp3_url,
                        e.titre
                    FROM upvr_rag_chunks c
                    JOIN upvr_episodes e ON e.episode_number = c.episode_number
                    ORDER BY c.episode_number ASC, c.chunk_index ASC
                """
                cur.execute(sql)
                rows = cur.fetchall()

                chunks = []
                for r in rows:
                    ep_num = r["episode_number"]
                    title = r["titre"] or f"Épisode #{ep_num}"
                    sec_title = r["section_title"] or ""
                    
                    # Contexte textuel riche pour l'embedding
                    header = f"### [Un pasteur vous répond #{ep_num} : {title}] - {sec_title}"
                    full_text = f"{header}\n\n{r['content']}".strip()

                    # Nettoyage des listes JSON
                    refs_str = ""
                    if r["verse_refs"]:
                        try:
                            parsed_refs = json.loads(r["verse_refs"])
                            refs_str = ", ".join(parsed_refs) if isinstance(parsed_refs, list) else str(parsed_refs)
                        except Exception:
                            refs_str = str(r["verse_refs"])

                    themes_str = ""
                    if r["themes"]:
                        try:
                            parsed_themes = json.loads(r["themes"])
                            themes_str = ", ".join(parsed_themes) if isinstance(parsed_themes, list) else str(parsed_themes)
                        except Exception:
                            themes_str = str(r["themes"])

                    chunks.append({
                        "id": r["id"],
                        "text": full_text,
                        "metadata": {
                            "source_type": "pastoral_upvr",
                            "source_id": f"upvr_{ep_num}",
                            "source_name": "Un pasteur vous répond",
                            "name": "Un pasteur vous répond",
                            "title": title,
                            "author": "Florent Varak",
                            "url": r["source_url"] or "",
                            "mp3_url": r["mp3_url"] or "",
                            "episode_number": ep_num,
                            "section_title": sec_title,
                            "verse_refs": refs_str,
                            "themes": themes_str,
                            "chunk_index": r["chunk_index"]
                        }
                    })

                return chunks
        except Exception as e:
            logger.error(f"[UPVRManager] Erreur get_all_rag_chunks : {e}")
            return []

    def get_rag_chunks_for_episode(self, episode_number: int) -> List[Dict[str, Any]]:
        """Récupère les chunks RAG pour un épisode donné."""
        if not self.is_installed():
            return []

        try:
            with sqlite3.connect(self.get_db_path()) as conn:
                conn.row_factory = sqlite3.Row
                cur = conn.cursor()
                cur.execute("""
                    SELECT c.*, e.titre
                    FROM upvr_rag_chunks c
                    JOIN upvr_episodes e ON e.episode_number = c.episode_number
                    WHERE c.episode_number = ?
                    ORDER BY c.chunk_index ASC
                """, (int(episode_number),))
                rows = cur.fetchall()
                results = []
                for r in rows:
                    results.append({
                        "id": r["id"],
                        "episode_number": r["episode_number"],
                        "chunk_index": r["chunk_index"],
                        "section_title": r["section_title"],
                        "content": r["content"],
                        "verse_refs": json.loads(r["verse_refs"]) if r["verse_refs"] else [],
                        "themes": json.loads(r["themes"]) if r["themes"] else [],
                        "source_url": r["source_url"],
                        "mp3_url": r["mp3_url"],
                        "title": r["titre"]
                    })
                return results
        except Exception as e:
            logger.error(f"[UPVRManager] Erreur get_rag_chunks_for_episode : {e}")
            return []

    def get_rag_status(self, vector_db: Any = None, embedding_model: str = "bge_multilingual_gemma2 (Infomaniak)") -> Dict[str, Any]:
        """Retourne l'état précis de vectorisation du corpus UPVR pour le modèle d'embedding donné."""
        stats = self.get_stats()
        total_chunks = stats.get("total_rag_chunks", 0)
        indexed_count = 0
        is_vectorized = False

        if vector_db and total_chunks > 0:
            try:
                collection = vector_db.get_collection(embedding_model)
                if collection:
                    res = collection.get(where={"source_type": "pastoral_upvr"}, include=[])
                    if res and res.get("ids"):
                        indexed_count = len(res["ids"])
                        is_vectorized = (indexed_count >= total_chunks)
            except Exception as e:
                logger.debug(f"[UPVRManager] get_rag_status collection check: {e}")

        pct = int((indexed_count / total_chunks * 100)) if total_chunks > 0 else 0

        return {
            "installed": stats.get("installed", False),
            "total_episodes": stats.get("total_episodes", 0),
            "total_chunks": total_chunks,
            "indexed_chunks": indexed_count,
            "is_vectorized": is_vectorized,
            "percentage": pct,
            "embedding_model": embedding_model
        }

    def vectorize_all_chunks(
        self,
        vector_db: Any,
        embedding_model: str = "bge_multilingual_gemma2 (Infomaniak)",
        progress_callback: Optional[Callable[[int, int, int], None]] = None
    ) -> int:
        """
        Vectorise l'intégralité des chunks RAG d'UPVR dans ChromaDB
        avec notification de progression en temps réel.
        """
        if not vector_db:
            raise ValueError("VectorDB non initialisé")

        chunks = self.get_all_rag_chunks()
        if not chunks:
            logger.warning("[UPVRManager] Aucun chunk UPVR à vectoriser.")
            if progress_callback:
                progress_callback(100, 0, 0)
            return 0

        total = len(chunks)
        logger.info(f"[UPVRManager] Début de vectorisation de {total} chunks UPVR avec {embedding_model}...")

        vector_db.add_chunks(
            chunks=chunks,
            embedding_model=embedding_model,
            progress_callback=progress_callback
        )

        logger.info(f"[UPVRManager] Vectorisation terminée ({total} chunks).")
        return total
