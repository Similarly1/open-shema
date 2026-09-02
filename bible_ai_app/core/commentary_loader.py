import os
import logging
import sqlite3
import json
from typing import Dict, List, Any, Optional

logger = logging.getLogger(__name__)

class CommentaryLoader:
    """
    Gestionnaire haute performance pour le chargement instantané (< 1ms)
    des commentaires bibliques stockés dans 'data/commentaires/commentaires_master.db'
    ou dans les dossiers JSON.
    """
    _db_path = None
    _catalog_cache = None

    @classmethod
    def get_db_path(cls) -> str:
        if cls._db_path is None:
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            cls._db_path = os.path.join(base_dir, "data", "commentaires", "commentaires_master.db")
        return cls._db_path

    @classmethod
    def _ensure_master_db(cls):
        """Initialise la base SQLite centrale et synchronise automatiquement les modules de commentaires individuels."""
        db_path = cls.get_db_path()
        comm_dir = os.path.dirname(db_path)
        os.makedirs(comm_dir, exist_ok=True)
        try:
            with sqlite3.connect(db_path) as conn:
                cur = conn.cursor()
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS commentaries (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        commentary_id TEXT NOT NULL,
                        commentary_name TEXT NOT NULL,
                        book_code TEXT NOT NULL,
                        book_name TEXT NOT NULL,
                        chapter INTEGER NOT NULL,
                        verse_start INTEGER NOT NULL,
                        verse_end INTEGER NOT NULL,
                        reference TEXT NOT NULL,
                        text TEXT NOT NULL,
                        paragraphs_json TEXT,
                        html TEXT,
                        source_url TEXT
                    );
                """)
                cur.execute("CREATE INDEX IF NOT EXISTS idx_comm_lookup ON commentaries(book_code, chapter, verse_start, verse_end);")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_comm_cid ON commentaries(commentary_id, book_code);")

            # Auto-sync de tous les fichiers .sqlite individuels présents dans data/commentaires/
            for fn in os.listdir(comm_dir):
                if fn.endswith(".sqlite") and fn != "commentaires_master.db":
                    single_p = os.path.join(comm_dir, fn)
                    try:
                        with sqlite3.connect(single_p) as s_conn, sqlite3.connect(db_path) as m_conn:
                            s_cur = s_conn.cursor()
                            s_cur.execute("SELECT commentary_id, commentary_name, book_code, book_name, chapter, verse_start, verse_end, reference, text, paragraphs_json, html, source_url FROM commentaries")
                            rows = s_cur.fetchall()
                            if rows:
                                c_name = rows[0][1]
                                m_cur = m_conn.cursor()
                                m_cur.execute("SELECT COUNT(*) FROM commentaries WHERE commentary_name = ?", (c_name,))
                                existing_count = m_cur.fetchone()[0]
                                if existing_count < len(rows):
                                    m_cur.execute("DELETE FROM commentaries WHERE commentary_name = ?", (c_name,))
                                    m_cur.executemany("INSERT INTO commentaries (commentary_id, commentary_name, book_code, book_name, chapter, verse_start, verse_end, reference, text, paragraphs_json, html, source_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", rows)
                                    m_conn.commit()
                    except Exception as sync_e:
                        logger.debug(f"Erreur auto-sync commentaire {fn}: {sync_e}")
        except Exception as e:
            logger.error(f"Erreur _ensure_master_db : {e}")

    @classmethod
    def get_available_commentaries(cls) -> Dict[str, Dict[str, Any]]:
        """Renvoie la liste des commentaires disponibles dans la base SQLite locale."""
        cls._ensure_master_db()
        db_path = cls.get_db_path()
        if not os.path.exists(db_path):
            return {}
            
        if cls._catalog_cache is not None:
            return cls._catalog_cache
            
        catalog = {}
        try:
            with sqlite3.connect(db_path) as conn:
                cur = conn.cursor()
                cur.execute("""
                    SELECT commentary_id, commentary_name, COUNT(*), COUNT(DISTINCT book_code)
                    FROM commentaries
                    GROUP BY commentary_id, commentary_name
                """)
                for cid, cname, cnt, bcnt in cur.fetchall():
                    catalog[cname] = {
                        "id": cid,
                        "name": cname,
                        "title": cname,
                        "total_passages": cnt,
                        "total_books": bcnt
                    }
            cls._catalog_cache = catalog
        except Exception as e:
            logger.error("Erreur chargement catalogue commentaires: %s", e)
            catalog = {}

        return catalog

    @classmethod
    def is_commentary_source(cls, source_name: str) -> bool:
        catalog = cls.get_available_commentaries()
        if source_name in catalog:
            return True
        for k, v in catalog.items():
            if str(v["id"]) == source_name or source_name.lower() == k.lower() or k.lower() in source_name.lower():
                return True
        return False

    @classmethod
    def get_commentary_id(cls, source_name: str) -> Optional[str]:
        catalog = cls.get_available_commentaries()
        if source_name in catalog:
            return catalog[source_name]["id"]
        for k, v in catalog.items():
            if str(v["id"]) == source_name or source_name.lower() == k.lower() or k.lower() in source_name.lower():
                return v["id"]
        return None

    @classmethod
    def get_comments(cls, source_name: str, book_code: str, chapter: Optional[int] = None, verse: Optional[int] = None) -> Dict[str, Any]:
        """
        Récupère instantanément les commentaires d'une source pour un livre, chapitre ou verset.
        """
        db_path = cls.get_db_path()
        if not os.path.exists(db_path):
            return {"ids": [], "documents": [], "metadatas": []}
            
        cid = cls.get_commentary_id(source_name)
        if not cid:
            return {"ids": [], "documents": [], "metadatas": []}
            
        query = "SELECT id, commentary_name, book_name, chapter, verse_start, verse_end, reference, text FROM commentaries WHERE commentary_id = ? AND book_code = ?"
        params = [str(cid), book_code]

        if chapter is not None:
            query += " AND chapter = ?"
            params.append(chapter)

        if verse is not None:
            query += " AND verse_start <= ? AND verse_end >= ?"
            params.extend([verse, verse])

        query += " ORDER BY chapter ASC, verse_start ASC"

        docs = []
        metas = []
        ids = []

        with sqlite3.connect(db_path) as conn:
            cur = conn.cursor()
            cur.execute(query, params)
            rows = cur.fetchall()

        for r in rows:
            row_id, c_name, b_name, ch, v_start, v_end, ref, txt = r
            doc_id = f"comm_{cid}_{book_code}_{ch}_{v_start}_{v_end}"
            ids.append(doc_id)
            docs.append(txt)
            metas.append({
                "name": c_name,
                "type": "Commentaire",
                "book": b_name,
                "book_code": book_code,
                "chapter": ch,
                "verse": v_start,
                "verse_start": v_start,
                "verse_end": v_end,
                "reference": ref
            })

        return {"ids": ids, "documents": docs, "metadatas": metas}

    BOOK_CODE_ALIASES = {
        "Mat": ["Mat", "Matt", "Matthieu"],
        "Mrk": ["Mrk", "Mar", "Marc", "Mark"],
        "Mar": ["Mrk", "Mar", "Marc", "Mark"],
        "Luk": ["Luk", "Luc", "Luke"],
        "Luc": ["Luk", "Luc", "Luke"],
        "Jhn": ["Jhn", "Joh", "Jean", "John"],
        "Joh": ["Jhn", "Joh", "Jean", "John"],
        "Act": ["Act", "Ac", "Acts", "Actes"],
        "Rom": ["Rom", "Rm", "Ro", "Romans", "Romains"],
        "1Co": ["1Co", "1Cor", "1 Corinthians", "1 Corinthiens"],
        "2Co": ["2Co", "2Cor", "2 Corinthians", "2 Corinthiens"],
        "Gal": ["Gal", "Ga", "Galatians", "Galates"],
        "Eph": ["Eph", "Ephes", "Ephesians", "Éphésiens", "Ephesiens"],
        "Php": ["Php", "Phi", "Phil", "Philippians", "Philippiens"],
        "Phi": ["Php", "Phi", "Phil", "Philippians", "Philippiens"],
        "Col": ["Col", "Coloss", "Colossians", "Colossiens"],
        "1Th": ["1Th", "1Thess", "1 Thessalonians", "1 Thessaloniciens"],
        "2Th": ["2Th", "2Thess", "2 Thessalonians", "2 Thessaloniciens"],
        "1Ti": ["1Ti", "1Tim", "1 Timothy", "1 Timothée"],
        "2Ti": ["2Ti", "2Tim", "2 Timothy", "2 Timothée"],
        "Tit": ["Tit", "Tite", "Titus"],
        "Phm": ["Phm", "Phlm", "Philemon", "Philémon"],
        "Heb": ["Heb", "Hébreux", "Hebreux", "Hebrews"],
        "Jas": ["Jas", "Jam", "Jac", "James", "Jacques"],
        "Jam": ["Jas", "Jam", "Jac", "James", "Jacques"],
        "1Pe": ["1Pe", "1Pet", "1 Peter", "1 Pierre"],
        "2Pe": ["2Pe", "2Pet", "2 Peter", "2 Pierre"],
        "1Jn": ["1Jn", "1Jo", "1John", "1 Jean"],
        "1Jo": ["1Jn", "1Jo", "1John", "1 Jean"],
        "2Jn": ["2Jn", "2Jo", "2John", "2 Jean"],
        "2Jo": ["2Jn", "2Jo", "2John", "2 Jean"],
        "3Jn": ["3Jn", "3Jo", "3John", "3 Jean"],
        "3Jo": ["3Jn", "3Jo", "3John", "3 Jean"],
        "Jud": ["Jud", "Jude"],
        "Rev": ["Rev", "Apoc", "Apocalypse", "Revelation"]
    }

    @classmethod
    def get_all_comments_for_passage(cls, book_code: str, chapter: int, verse: Optional[int] = None) -> Dict[str, Any]:
        """
        Récupère instantanément les commentaires de TOUTES les sources pour un passage spécifique.
        """
        db_path = cls.get_db_path()
        if not os.path.exists(db_path):
            return {"ids": [], "documents": [], "metadatas": []}

        aliases = cls.BOOK_CODE_ALIASES.get(book_code, [book_code])
        if book_code not in aliases:
            aliases.append(book_code)
        placeholders = ",".join(["?"] * len(aliases))

        query = f"SELECT id, commentary_name, book_name, chapter, verse_start, verse_end, reference, text, commentary_id FROM commentaries WHERE book_code IN ({placeholders})"
        params = list(aliases)

        if chapter is not None:
            query += " AND chapter = ?"
            params.append(chapter)

        if verse is not None:
            query += " AND verse_start <= ? AND verse_end >= ?"
            params.extend([verse, verse])

        query += " ORDER BY commentary_name ASC"

        docs = []
        metas = []
        ids = []

        with sqlite3.connect(db_path) as conn:
            cur = conn.cursor()
            cur.execute(query, params)
            rows = cur.fetchall()

        for r in rows:
            row_id, c_name, b_name, ch, v_start, v_end, ref, txt, cid = r
            doc_id = f"comm_{cid}_{book_code}_{ch}_{v_start}_{v_end}_{row_id}"
            ids.append(doc_id)
            docs.append(txt)
            metas.append({
                "name": c_name,
                "type": "Commentaire",
                "book": b_name,
                "book_code": book_code,
                "chapter": ch,
                "verse": v_start,
                "verse_start": v_start,
                "verse_end": v_end,
                "reference": ref,
                "commentary_id": cid
            })

        return {"ids": ids, "documents": docs, "metadatas": metas}

    @classmethod
    def get_all_comments_for_verse_range(cls, book_code: str, chapter: int, verse_start: int, verse_end: int) -> Dict[str, Any]:
        """
        Récupère instantanément les commentaires de TOUTES les sources pour une plage de versets (ex: versets 1 à 4).
        """
        db_path = cls.get_db_path()
        if not os.path.exists(db_path):
            return {"ids": [], "documents": [], "metadatas": []}

        v_min = min(int(verse_start), int(verse_end))
        v_max = max(int(verse_start), int(verse_end))

        aliases = cls.BOOK_CODE_ALIASES.get(book_code, [book_code])
        if book_code not in aliases:
            aliases.append(book_code)
        placeholders = ",".join(["?"] * len(aliases))

        query = (
            f"SELECT id, commentary_name, book_name, chapter, verse_start, verse_end, reference, text, commentary_id "
            f"FROM commentaries WHERE book_code IN ({placeholders}) AND chapter = ? AND verse_start <= ? AND verse_end >= ? "
            f"ORDER BY commentary_name ASC, verse_start ASC"
        )
        params = list(aliases) + [int(chapter), v_max, v_min]

        docs = []
        metas = []
        ids = []

        with sqlite3.connect(db_path) as conn:
            cur = conn.cursor()
            cur.execute(query, params)
            rows = cur.fetchall()

        for r in rows:
            row_id, c_name, b_name, ch, v_s, v_e, ref, txt, cid = r
            doc_id = f"comm_{cid}_{book_code}_{ch}_{v_s}_{v_e}_{row_id}"
            ids.append(doc_id)
            docs.append(txt)
            metas.append({
                "name": c_name,
                "type": "Commentaire",
                "book": b_name,
                "book_code": book_code,
                "chapter": ch,
                "verse": v_s,
                "verse_start": v_s,
                "verse_end": v_e,
                "reference": ref,
                "commentary_id": cid
            })

        return {"ids": ids, "documents": docs, "metadatas": metas}

    @classmethod
    def register_all_in_library(cls, active: bool = True) -> int:
        """
        Enregistre de manière groupée tous les 10 commentaires dans data/library.json.
        """
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        lib_path = os.path.join(base_dir, "data", "library.json")
        
        registry = {}
        if os.path.exists(lib_path):
            try:
                with open(lib_path, "r", encoding="utf-8") as f:
                    registry = json.load(f)
            except Exception:
                registry = {}
                
        catalog = cls.get_available_commentaries()
        added_count = 0
        
        for name, info in catalog.items():
            if name not in registry:
                registry[name] = {
                    "title": name,
                    "author": name.replace("Commentaire Biblique de ", "").replace("Commentaire Biblique par ", "").replace("Commentaire de ", "").replace("Commentaire ", ""),
                    "description": f"Commentaire biblique complet ({info['total_passages']} passages indexés sur {info['total_books']} livres).",
                    "year": "",
                    "cover_path": None,
                    "type": "Commentaire",
                    "format": "commentary_sqlite",
                    "commentary_id": info["id"],
                    "embedding_model": "study_library",
                    "active": active
                }
                added_count += 1
            else:
                # S'assurer que le format et type sont corrects
                registry[name]["type"] = "Commentaire"
                registry[name]["format"] = "commentary_sqlite"
                registry[name]["commentary_id"] = info["id"]
                
        with open(lib_path, "w", encoding="utf-8") as f:
            json.dump(registry, f, ensure_ascii=False, indent=2)
            
        return added_count
