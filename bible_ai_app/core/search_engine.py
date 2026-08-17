import os
import sqlite3
import json
import re
import unicodedata
from typing import List, Dict, Any, Optional

# Définition des corpus canoniques et de l'ordre standard des livres
CANONICAL_ORDER = [
    # Ancien Testament
    "Gen", "Exo", "Lev", "Num", "Deu", "Jos", "Jdg", "Rut", "1Sa", "2Sa",
    "1Ki", "2Ki", "1Ch", "2Ch", "Ezr", "Neh", "Est", "Job", "Psa", "Pro",
    "Ecc", "Sol", "Isa", "Jer", "Lam", "Eze", "Dan", "Hos", "Joe", "Amo",
    "Oba", "Jon", "Mic", "Nah", "Hab", "Zep", "Hag", "Zec", "Mal",
    # Nouveau Testament
    "Mat", "Mar", "Luk", "Joh", "Act", "Rom", "1Co", "2Co", "Gal", "Eph",
    "Phi", "Col", "1Th", "2Th", "1Ti", "2Ti", "Tit", "Phm", "Heb", "Jam",
    "1Pe", "2Pe", "1Jo", "2Jo", "3Jo", "Jud", "Rev",
    # Deutérocanoniques
    "Tob", "Jdt", "Esg", "1Ma", "2Ma", "3Ma", "4Ma", "Wis", "Sir", "Bar",
    "Lje", "Dag", "1Es", "2Es", "Man", "Ps2"
]

BOOK_ORDER_INDEX = {code: i for i, code in enumerate(CANONICAL_ORDER)}

CORPUS_DEFINITIONS = {
    "ALL": ("Toute la Bible", CANONICAL_ORDER),
    "OT": ("Ancien Testament (39 livres)", CANONICAL_ORDER[:39]),
    "NT": ("Nouveau Testament (27 livres)", CANONICAL_ORDER[39:66]),
    "PENTATEUCH": ("Pentateuque / Loi (5 livres)", ["Gen", "Exo", "Lev", "Num", "Deu"]),
    "HISTORICAL": ("Livres Historiques (12 livres)", ["Jos", "Jdg", "Rut", "1Sa", "2Sa", "1Ki", "2Ki", "1Ch", "2Ch", "Ezr", "Neh", "Est"]),
    "POETIC": ("Poétiques & Sagesse (5 livres)", ["Job", "Psa", "Pro", "Ecc", "Sol"]),
    "PROPHETS": ("Prophètes (17 livres)", ["Isa", "Jer", "Lam", "Eze", "Dan", "Hos", "Joe", "Amo", "Oba", "Jon", "Mic", "Nah", "Hab", "Zep", "Hag", "Zec", "Mal"]),
    "GOSPELS_ACTS": ("Évangiles & Actes (5 livres)", ["Mat", "Mar", "Luk", "Joh", "Act"]),
    "EPISTLES": ("Épîtres & Apocalypse (22 livres)", ["Rom", "1Co", "2Co", "Gal", "Eph", "Phi", "Col", "1Th", "2Th", "1Ti", "2Ti", "Tit", "Phm", "Heb", "Jam", "1Pe", "2Pe", "1Jo", "2Jo", "3Jo", "Jud", "Rev"])
}

FRENCH_BOOK_NAMES = {
    "Gen": "Genèse", "Exo": "Exode", "Lev": "Lévitique", "Num": "Nombres", "Deu": "Deutéronome",
    "Jos": "Josué", "Jdg": "Juges", "Rut": "Ruth", "1Sa": "1 Samuel", "2Sa": "2 Samuel",
    "1Ki": "1 Rois", "2Ki": "2 Rois", "1Ch": "1 Chroniques", "2Ch": "2 Chroniques",
    "Ezr": "Esdras", "Neh": "Néhémie", "Est": "Esther", "Job": "Job", "Psa": "Psaumes",
    "Pro": "Proverbes", "Ecc": "Ecclésiaste", "Sol": "Cantique des cantiques", "Isa": "Ésaïe",
    "Jer": "Jérémie", "Lam": "Lamentations", "Eze": "Ézéchiel", "Dan": "Daniel",
    "Hos": "Osée", "Joe": "Joël", "Amo": "Amos", "Oba": "Abdias", "Jon": "Jonas",
    "Mic": "Michée", "Nah": "Nahum", "Hab": "Habacuc", "Zep": "Sophonie", "Hag": "Aggée",
    "Zec": "Zacharie", "Mal": "Malachie",
    "Mat": "Matthieu", "Mar": "Marc", "Luk": "Luc", "Joh": "Jean", "Act": "Actes",
    "Rom": "Romains", "1Co": "1 Corinthiens", "2Co": "2 Corinthiens", "Gal": "Galates",
    "Eph": "Éphésiens", "Phi": "Philippiens", "Col": "Colossiens",
    "1Th": "1 Thessaloniciens", "2Th": "2 Thessaloniciens", "1Ti": "1 Timothée",
    "2Ti": "2 Timothée", "Tit": "Tite", "Phm": "Philémon", "Heb": "Hébreux",
    "Jam": "Jacques", "1Pe": "1 Pierre", "2Pe": "2 Pierre", "1JN": "1 Jean",
    "1Jo": "1 Jean", "2Jo": "2 Jean", "3Jo": "3 Jean", "Jud": "Jude", "Rev": "Apocalypse",
    "Tob": "Tobie", "Jdt": "Judith", "Esg": "Esther grec", "1Ma": "1 Maccabées",
    "2Ma": "2 Maccabées", "3Ma": "3 Maccabées", "4Ma": "4 Maccabées", "Wis": "Sagesse",
    "Sir": "Siracide", "Bar": "Baruch", "Lje": "Lettre de Jérémie", "Dag": "Daniel grec",
    "1Es": "3 Esdras", "2Es": "4 Esdras", "Man": "Prière de Manassé", "Ps2": "Psaume 151"
}


def strip_accents(text: str) -> str:
    """Supprime les accents pour les comparaisons textuelles."""
    if not text:
        return ""
    nfkd = unicodedata.normalize('NFKD', text)
    return "".join([c for c in nfkd if not unicodedata.combining(c)])


class SearchEngine:
    """
    Moteur de recherche plein-texte universel (FTS5) pour l'application biblique :
    - Bibles JSON (indexées dans 'data/bibles_fts.db')
    - Commentaires bibliques (dans 'data/commentaires/commentaires_master.db')
    - Dictionnaires & Lexiques
    - Indexation automatique, recherche sans accents et sans casse < 5ms.
    """
    _instance = None

    def __init__(self, base_dir: Optional[str] = None):
        if base_dir is None:
            self.base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        else:
            self.base_dir = base_dir

        self.db_path = os.path.join(self.base_dir, "data", "bibles_fts.db")
        self.commentary_db_path = os.path.join(self.base_dir, "data", "commentaires", "commentaires_master.db")
        self._init_bibles_db()

    @classmethod
    def get_instance(cls) -> 'SearchEngine':
        if cls._instance is None:
            cls._instance = SearchEngine()
        return cls._instance

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_bibles_db(self):
        """Initialise la table FTS5 pour les versets bibliques si nécessaire."""
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        conn = self._get_connection()
        cur = conn.cursor()

        # Table FTS5 pour la recherche ultra-rapide sans accents
        cur.execute("""
            CREATE VIRTUAL TABLE IF NOT EXISTS verses_fts USING fts5(
                bible_folder,
                bible_name,
                book_code,
                book_name,
                chapter UNINDEXED,
                verse UNINDEXED,
                text,
                tokenize='unicode61 remove_diacritics 2'
            )
        """)

        # Table des métadonnées d'indexation pour suivre les versions indexées
        cur.execute("""
            CREATE TABLE IF NOT EXISTS indexed_versions (
                folder_name TEXT PRIMARY KEY,
                bible_name TEXT,
                total_verses INTEGER,
                indexed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()
        conn.close()

    def sync_all_bibles(self, force: bool = False, progress_cb=None):
        """
        Synchronise automatiquement toutes les Bibles présentes dans data/bibles/
        vers l'index SQLite FTS5. Rapide (< 1-2 secondes pour 16 Bibles).
        """
        from core.bible_json_loader import BibleJsonLoader
        from gui.library_utils import load_books_metadata

        bibles_dir = BibleJsonLoader.get_bibles_dir()
        if not os.path.exists(bibles_dir):
            return

        registry = load_books_metadata()
        installed = BibleJsonLoader.list_installed_bibles()

        conn = self._get_connection()
        cur = conn.cursor()

        cur.execute("SELECT folder_name FROM indexed_versions")
        already_indexed = {r[0] for r in cur.fetchall()}

        to_index = []
        for folder in installed:
            if force or (folder not in already_indexed):
                to_index.append(folder)

        if not to_index:
            conn.close()
            return

        total_folders = len(to_index)
        for idx, folder in enumerate(to_index):
            if progress_cb:
                progress_cb(int((idx / total_folders) * 100), f"Indexation de {folder}...")

            # Nom convivial de la Bible
            b_name = folder
            for k, meta in registry.items():
                if meta.get("folder_name") == folder or k == folder:
                    b_name = meta.get("title") or k
                    break

            folder_path = os.path.join(bibles_dir, folder)
            json_files = sorted([f for f in os.listdir(folder_path) if f.endswith(".json")])

            verses_batch = []
            for jf in json_files:
                f_path = os.path.join(folder_path, jf)
                try:
                    with open(f_path, "r", encoding="utf-8") as f:
                        b_data = json.load(f)
                except Exception:
                    continue

                raw_code = b_data.get("code", "")
                from core.bible_json_loader import USFM_TO_STD
                book_code = USFM_TO_STD.get(raw_code.upper(), raw_code)
                book_name = b_data.get("name") or FRENCH_BOOK_NAMES.get(book_code, book_code)

                chapters = b_data.get("chapters", {})
                for ch_str, v_dict in chapters.items():
                    try:
                        ch_num = int(ch_str)
                    except ValueError:
                        continue
                    if isinstance(v_dict, dict):
                        for v_str, v_val in v_dict.items():
                            try:
                                v_num = int(v_str)
                            except ValueError:
                                continue
                            from core.bible_json_loader import extract_verse_text
                            v_txt = extract_verse_text(v_val).strip()
                            if v_txt:
                                verses_batch.append((folder, b_name, book_code, book_name, ch_num, v_num, v_txt))

            # Supprimer l'ancienne version si réindexation
            cur.execute("DELETE FROM verses_fts WHERE bible_folder = ?", (folder,))
            cur.execute("DELETE FROM indexed_versions WHERE folder_name = ?", (folder,))

            # Insertion en masse ultra-rapide
            cur.executemany("""
                INSERT INTO verses_fts (bible_folder, bible_name, book_code, book_name, chapter, verse, text)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, verses_batch)

            cur.execute("""
                INSERT INTO indexed_versions (folder_name, bible_name, total_verses)
                VALUES (?, ?, ?)
            """, (folder, b_name, len(verses_batch)))
            conn.commit()

        if progress_cb:
            progress_cb(100, "Indexation terminée")

        conn.close()

    def _format_fts_query(self, query: str, match_mode: str = "ALL_WORDS") -> str:
        """
        Formate une requête utilisateur en syntaxe SQLite FTS5 valide et sécurisée.
        """
        clean = query.strip()
        if not clean:
            return ""

        # Si l'utilisateur a tapé une phrase entre guillemets
        if clean.startswith('"') and clean.endswith('"') and len(clean) > 2:
            inner = clean[1:-1].replace('"', '""')
            return f'"{inner}"'

        if match_mode == "EXACT_PHRASE":
            escaped = clean.replace('"', '""')
            return f'"{escaped}"'

        # Nettoyage des caractères spéciaux FTS
        words = re.findall(r'[\w*]+|-[\w*]+', clean)
        if not words:
            return ""

        fts_tokens = []
        for w in words:
            if w.startswith("-") and len(w) > 1:
                # Exclusion
                token = w[1:].replace('"', '')
                fts_tokens.append(f'NOT "{token}"')
            elif "*" in w:
                # Troncature
                token = w.replace('"', '')
                fts_tokens.append(f'{token}')
            else:
                escaped = w.replace('"', '')
                fts_tokens.append(f'"{escaped}"')

        if match_mode == "ANY_WORD":
            return " OR ".join(fts_tokens)
        else:  # ALL_WORDS par défaut
            return " AND ".join(fts_tokens)

    def search_bibles(
        self,
        query: str,
        versions: Optional[List[str]] = None,
        corpus: str = "ALL",
        book_filter: Optional[str] = None,
        match_mode: str = "ALL_WORDS",
        limit: int = 500
    ) -> List[Dict[str, Any]]:
        """
        Recherche dans le texte biblique avec SQLite FTS5 (< 5 ms).
        """
        self.sync_all_bibles()

        fts_query = self._format_fts_query(query, match_mode)
        if not fts_query:
            return []

        conn = self._get_connection()
        cur = conn.cursor()

        sql_clauses = ["verses_fts MATCH ?"]
        params = [fts_query]

        # Filtrage par version(s)
        if versions:
            from gui.library_utils import load_books_metadata
            registry = load_books_metadata()

            resolved_folders = set()
            for v in versions:
                resolved_folders.add(v)
                for k, meta in registry.items():
                    if k == v or meta.get("title") == v or meta.get("folder_name") == v:
                        if meta.get("folder_name"):
                            resolved_folders.add(meta["folder_name"])
                        resolved_folders.add(k)

            placeholders = ",".join(["?"] * len(resolved_folders))
            sql_clauses.append(f"(bible_folder IN ({placeholders}) OR bible_name IN ({placeholders}))")
            params.extend(list(resolved_folders) * 2)

        # Filtrage par livre unique ou corpus
        if book_filter:
            sql_clauses.append("book_code = ?")
            params.append(book_filter)
        elif corpus in CORPUS_DEFINITIONS and corpus != "ALL":
            allowed_books = CORPUS_DEFINITIONS[corpus][1]
            placeholders = ",".join(["?"] * len(allowed_books))
            sql_clauses.append(f"book_code IN ({placeholders})")
            params.extend(allowed_books)

        where_stmt = " AND ".join(sql_clauses)
        
        # Requête avec FTS5 snippet
        sql = f"""
            SELECT bible_folder, bible_name, book_code, book_name, chapter, verse, text,
                   snippet(verses_fts, 6, '<mark>', '</mark>', '...', 24) as snippet_text
            FROM verses_fts
            WHERE {where_stmt}
            LIMIT ?
        """
        params.append(limit)

        try:
            cur.execute(sql, params)
            rows = cur.fetchall()
        except Exception as e:
            print(f"[SearchEngine] Erreur FTS Bibles: {e}")
            conn.close()
            return []

        conn.close()

        results = []
        for r in rows:
            b_code = r["book_code"]
            order_idx = BOOK_ORDER_INDEX.get(b_code, 999)
            fr_name = FRENCH_BOOK_NAMES.get(b_code, r["book_name"])
            
            results.append({
                "type": "bible",
                "version_folder": r["bible_folder"],
                "version_name": r["bible_name"],
                "book_code": b_code,
                "book_name": fr_name,
                "chapter": int(r["chapter"]),
                "verse": int(r["verse"]),
                "reference": f"{fr_name} {r['chapter']}:{r['verse']}",
                "text": r["text"],
                "snippet": r["snippet_text"] or r["text"],
                "_order": (order_idx, int(r["chapter"]), int(r["verse"]), r["bible_name"])
            })

        # Tri canonique absolu : Livre (Gen -> Rev), Chapitre, Verset, puis Version
        results.sort(key=lambda x: x["_order"])
        return results

    def _init_commentaries_fts(self):
        """Initialise une table virtuelle FTS5 pour les commentaires si nécessaire."""
        if not os.path.exists(self.commentary_db_path):
            return False
            
        try:
            conn = sqlite3.connect(self.commentary_db_path)
            cur = conn.cursor()
            cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='commentaries_fts'")
            exists = cur.fetchone()
            if not exists:
                cur.execute("""
                    CREATE VIRTUAL TABLE commentaries_fts USING fts5(
                        commentary_id UNINDEXED,
                        commentary_name,
                        book_code UNINDEXED,
                        book_name,
                        chapter UNINDEXED,
                        reference UNINDEXED,
                        text,
                        tokenize='unicode61 remove_diacritics 2'
                    )
                """)
                cur.execute("""
                    INSERT INTO commentaries_fts (commentary_id, commentary_name, book_code, book_name, chapter, reference, text)
                    SELECT commentary_id, commentary_name, book_code, book_name, chapter, reference, text
                    FROM commentaries
                """)
                conn.commit()
            conn.close()
            return True
        except Exception as e:
            print(f"[SearchEngine] Erreur init FTS commentaires: {e}")
            return False

    def search_commentaries(
        self,
        query: str,
        commentary_ids: Optional[List[str]] = None,
        book_filter: Optional[str] = None,
        match_mode: str = "ALL_WORDS",
        limit: int = 150
    ) -> List[Dict[str, Any]]:
        """
        Recherche dans les 195 000+ commentaires des Pères et Théologiens (< 5 ms).
        """
        if not os.path.exists(self.commentary_db_path):
            return []

        fts_query = self._format_fts_query(query, match_mode)
        if not fts_query:
            return []

        self._init_commentaries_fts()

        conn = sqlite3.connect(self.commentary_db_path)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()

        sql_clauses = ["commentaries_fts MATCH ?"]
        params = [fts_query]

        if commentary_ids:
            placeholders = ",".join(["?"] * len(commentary_ids))
            sql_clauses.append(f"commentary_id IN ({placeholders})")
            params.extend(commentary_ids)

        if book_filter:
            sql_clauses.append("book_code = ?")
            params.append(book_filter)

        where_stmt = " AND ".join(sql_clauses)
        sql = f"""
            SELECT commentary_id, commentary_name, book_code, book_name, chapter, reference, text,
                   snippet(commentaries_fts, 6, '<mark>', '</mark>', '...', 28) as snippet_text
            FROM commentaries_fts
            WHERE {where_stmt}
            LIMIT ?
        """
        params.append(limit)

        try:
            cur.execute(sql, params)
            rows = cur.fetchall()
        except Exception as e:
            print(f"[SearchEngine] Erreur recherche commentaires: {e}")
            conn.close()
            return []

        conn.close()

        results = []
        for r in rows:
            b_code = r["book_code"]
            order_idx = BOOK_ORDER_INDEX.get(b_code, 999)
            fr_name = FRENCH_BOOK_NAMES.get(b_code, r["book_name"])

            results.append({
                "type": "commentary",
                "author": r["commentary_name"],
                "commentary_id": r["commentary_id"],
                "book_code": b_code,
                "book_name": fr_name,
                "chapter": r["chapter"],
                "reference": r["reference"],
                "text": r["text"],
                "snippet": r["snippet_text"] or (r["text"][:280] + "..."),
                "_order": (order_idx, r["chapter"] or 0, r["commentary_name"])
            })

        results.sort(key=lambda x: x["_order"])
        return results

    def search_dictionaries(self, query: str, limit: int = 50) -> List[Dict[str, Any]]:
        """
        Recherche dans les dictionnaires (Calmet, Strong, Théologie Systématique, etc.).
        """
        from core.dictionary_manager import DictionaryManager
        from core.strong_lexicon import StrongLexicon

        clean_q = query.strip()
        if not clean_q:
            return []

        results = []

        # 1. Code Strong direct (ex: G26, H1254)
        m_strong = re.match(r'^([GHgh])(\d+)$', clean_q)
        if m_strong:
            code = f"{m_strong.group(1).upper()}{m_strong.group(2)}"
            strong_entry = StrongLexicon.get(code)
            if strong_entry:
                results.append({
                    "type": "dictionary",
                    "dict_name": "Lexique Strong",
                    "term": f"{code} - {strong_entry.get('mot_original', '')} ({strong_entry.get('transliteration', '')})",
                    "definition": strong_entry.get("definition_complete") or strong_entry.get("definition_courte") or "",
                    "snippet": strong_entry.get("definition_courte") or strong_entry.get("definition_complete", "")[:250],
                    "raw_entry": strong_entry
                })

        # 2. Recherche dans le dictionnaire
        try:
            dict_hits = DictionaryManager.search_all_entries(clean_q)
            for h in dict_hits[:limit]:
                results.append({
                    "type": "dictionary",
                    "dict_name": h.get("dict_name", "Dictionnaire"),
                    "term": h.get("term", clean_q),
                    "definition": h.get("definition", ""),
                    "snippet": h.get("definition", "")[:250] + "...",
                    "raw_entry": h
                })
        except Exception as e:
            print(f"[SearchEngine] Erreur recherche dictionnaires: {e}")

        return results

    def search_global_library(
        self,
        query: str,
        active_versions: Optional[List[str]] = None,
        limit_bibles: int = 50,
        limit_commentaries: int = 30,
        limit_dictionaries: int = 20
    ) -> Dict[str, Any]:
        """
        Recherche transversale dans toute la bibliothèque avec agrégation catégorisée.
        """
        bibles_res = self.search_bibles(query, versions=active_versions, limit=limit_bibles)
        comm_res = self.search_commentaries(query, limit=limit_commentaries)
        dict_res = self.search_dictionaries(query, limit=limit_dictionaries)

        total_count = len(bibles_res) + len(comm_res) + len(dict_res)
        return {
            "query": query,
            "total_count": total_count,
            "bibles": bibles_res,
            "commentaries": comm_res,
            "dictionaries": dict_res
        }
