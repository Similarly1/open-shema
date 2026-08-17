import os
import sqlite3
import json
from typing import Dict, List, Any, Optional

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
    def get_available_commentaries(cls) -> Dict[str, Dict[str, Any]]:
        """Renvoie la liste des commentaires disponibles dans la base SQLite locale."""
        db_path = cls.get_db_path()
        if not os.path.exists(db_path):
            return {}
            
        if cls._catalog_cache is not None:
            return cls._catalog_cache
            
        catalog = {}
        try:
            conn = sqlite3.connect(db_path)
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
            conn.close()
            cls._catalog_cache = catalog
        except Exception as e:
            print(f"Erreur chargement catalogue commentaires: {e}")
            catalog = {}
            
        return catalog

    @classmethod
    def is_commentary_source(cls, source_name: str) -> bool:
        catalog = cls.get_available_commentaries()
        if source_name in catalog:
            return True
        # Check by id or partial name match
        for k, v in catalog.items():
            if source_name.lower() in k.lower() or k.lower() in source_name.lower():
                return True
        return False

    @classmethod
    def get_commentary_id(cls, source_name: str) -> Optional[str]:
        catalog = cls.get_available_commentaries()
        if source_name in catalog:
            return catalog[source_name]["id"]
        for k, v in catalog.items():
            if source_name.lower() in k.lower() or k.lower() in source_name.lower():
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
            
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        
        query = "SELECT id, commentary_name, book_name, chapter, verse_start, verse_end, reference, text FROM commentaries WHERE commentary_id = ? AND book_code = ?"
        params = [str(cid), book_code]
        
        if chapter is not None:
            query += " AND chapter = ?"
            params.append(chapter)
            
        if verse is not None:
            query += " AND verse_start <= ? AND verse_end >= ?"
            params.extend([verse, verse])
            
        query += " ORDER BY chapter ASC, verse_start ASC"
        
        cur.execute(query, params)
        rows = cur.fetchall()
        conn.close()
        
        docs = []
        metas = []
        ids = []
        
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
                "verse_end": v_end,
                "reference": ref
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
