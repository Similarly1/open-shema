import os
import sqlite3
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

class ArticlesDB:
    """
    Gestionnaire de base de données SQLite pour les articles de blogs,
    leurs métadonnées, statuts d'indexation et liaisons avec les versets bibliques.
    """

    def __init__(self, db_path: str = "./data/articles/articles.db"):
        self.db_path = os.path.abspath(db_path)
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        self.init_db()

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        return conn

    def init_db(self):
        """Initialise le schéma de la base de données si nécessaire."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            # 1. Table des sources
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS sources (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                website_url TEXT,
                feed_url TEXT NOT NULL,
                category TEXT,
                description TEXT,
                is_enabled INTEGER DEFAULT 1,
                last_synced_at TEXT,
                total_articles INTEGER DEFAULT 0
            )
            """)

            # 2. Table des articles
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS articles (
                id TEXT PRIMARY KEY,
                source_id TEXT NOT NULL,
                title TEXT NOT NULL,
                author TEXT,
                url TEXT UNIQUE NOT NULL,
                published_at TEXT,
                fetched_at TEXT,
                summary TEXT,
                content_path TEXT,
                tags TEXT,
                image_url TEXT,
                author_avatar_url TEXT,
                lead_summary TEXT,
                audio_url TEXT,
                has_full_text INTEGER DEFAULT 1,
                is_indexed INTEGER DEFAULT 0,
                FOREIGN KEY (source_id) REFERENCES sources (id) ON DELETE CASCADE
            )
            """)

            # Migration automatique si colonnes absentes
            for col in ["tags TEXT", "image_url TEXT", "author_avatar_url TEXT", "lead_summary TEXT", "audio_url TEXT"]:
                try:
                    cursor.execute(f"ALTER TABLE articles ADD COLUMN {col}")
                except Exception:
                    pass

            # 3. Table des liaisons de versets bibliques
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS article_scripture_links (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                article_id TEXT NOT NULL,
                book_code TEXT NOT NULL,
                chapter INTEGER NOT NULL,
                verse TEXT,
                raw_ref TEXT,
                FOREIGN KEY (article_id) REFERENCES articles (id) ON DELETE CASCADE
            )
            """)

            # Index pour accélérer les requêtes de l'UI et du RAG
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_art_pub ON articles(published_at DESC)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_art_src ON articles(source_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_art_indexed ON articles(is_indexed)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_scr_book_ch ON article_scripture_links(book_code, chapter)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_scr_art ON article_scripture_links(article_id)")
            
            conn.commit()

    def sync_curated_sources(self, curated_sources: List[Dict[str, Any]]):
        """Met à jour la table des sources et désactive celles qui ne sont pas dans curated_sources."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            curated_ids = [s["id"] for s in curated_sources]
            
            # Désactiver les sources absentes du fichier de config
            cursor.execute("UPDATE sources SET is_enabled = 0 WHERE id NOT IN ({})".format(
                ",".join("?" for _ in curated_ids) if curated_ids else "''"
            ), curated_ids)

            for src in curated_sources:
                cursor.execute("SELECT id, is_enabled FROM sources WHERE id = ?", (src["id"],))
                row = cursor.fetchone()
                if row is None:
                    is_enabled = 1 if src.get("enabled_by_default", True) else 0
                    cursor.execute("""
                    INSERT INTO sources (id, name, website_url, feed_url, category, description, is_enabled)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """, (
                        src["id"],
                        src.get("name", src["id"]),
                        src.get("website_url", ""),
                        src.get("feed_url", ""),
                        src.get("category", "general"),
                        src.get("description", ""),
                        is_enabled
                    ))
                else:
                    cursor.execute("""
                    UPDATE sources
                    SET name = ?, website_url = ?, feed_url = ?, category = ?, description = ?, is_enabled = 1
                    WHERE id = ?
                    """, (
                        src.get("name", src["id"]),
                        src.get("website_url", ""),
                        src.get("feed_url", ""),
                        src.get("category", "general"),
                        src.get("description", ""),
                        src["id"]
                    ))
            conn.commit()

    def get_sources(self, enabled_only: bool = False) -> List[Dict[str, Any]]:
        """Récupère la liste des sources avec le nombre d'articles enregistrés."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            query = """
            SELECT s.*, COUNT(a.id) as article_count
            FROM sources s
            LEFT JOIN articles a ON s.id = a.source_id
            """
            params = ()
            if enabled_only:
                query += " WHERE s.is_enabled = 1"
            query += " GROUP BY s.id ORDER BY s.name ASC"
            
            cursor.execute(query, params)
            return [dict(row) for row in cursor.fetchall()]

    def set_source_enabled(self, source_id: str, is_enabled: bool):
        """Active ou désactive une source de blog."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("UPDATE sources SET is_enabled = ? WHERE id = ?", (1 if is_enabled else 0, source_id))
            conn.commit()

    def update_source_synced_at(self, source_id: str, synced_at: str):
        """Met à jour l'horodatage de la dernière synchronisation d'un flux."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("UPDATE sources SET last_synced_at = ? WHERE id = ?", (synced_at, source_id))
            conn.commit()

    def upsert_article(self, article: Dict[str, Any], scripture_refs: Optional[List[Dict[str, Any]]] = None) -> bool:
        """
        Insère ou met à jour un article et ses liens de références bibliques.
        Retourne True si un nouvel article a été inséré, False sinon.
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            # S'assurer que la source existe
            cursor.execute("SELECT id FROM sources WHERE id = ?", (article["source_id"],))
            if cursor.fetchone() is None:
                cursor.execute(
                    "INSERT INTO sources (id, name, feed_url, is_enabled) VALUES (?, ?, ?, 1)",
                    (article["source_id"], article.get("source_name", article["source_id"]), article.get("url", ""))
                )

            # Vérifier si l'article existe déjà par son URL ou son ID
            cursor.execute("SELECT id FROM articles WHERE url = ? OR id = ?", (article["url"], article["id"]))
            existing = cursor.fetchone()
            is_new = existing is None

            raw_tags = article.get("tags", [])
            tags_str = ",".join(raw_tags) if isinstance(raw_tags, list) else str(raw_tags or "")
            image_url = article.get("image_url", "")
            author_avatar_url = article.get("author_avatar_url", "")
            lead_summary = article.get("lead_summary", article.get("summary", ""))
            audio_url = article.get("audio_url", "")

            cursor.execute("""
            INSERT INTO articles (
                id, source_id, title, author, url, published_at, fetched_at, summary, content_path, tags, image_url, author_avatar_url, lead_summary, audio_url, has_full_text, is_indexed
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                title = excluded.title,
                author = CASE WHEN excluded.author != '' THEN excluded.author ELSE articles.author END,
                published_at = excluded.published_at,
                fetched_at = excluded.fetched_at,
                summary = excluded.summary,
                content_path = COALESCE(excluded.content_path, articles.content_path),
                tags = excluded.tags,
                image_url = CASE WHEN excluded.image_url != '' THEN excluded.image_url ELSE articles.image_url END,
                author_avatar_url = CASE WHEN excluded.author_avatar_url != '' THEN excluded.author_avatar_url ELSE articles.author_avatar_url END,
                lead_summary = CASE WHEN excluded.lead_summary != '' THEN excluded.lead_summary ELSE articles.lead_summary END,
                audio_url = CASE WHEN excluded.audio_url != '' THEN excluded.audio_url ELSE articles.audio_url END,
                has_full_text = excluded.has_full_text
            """, (
                article["id"],
                article["source_id"],
                article["title"],
                article.get("author", ""),
                article["url"],
                article.get("published_at", ""),
                article.get("fetched_at", ""),
                article.get("summary", ""),
                article.get("content_path", ""),
                tags_str,
                image_url,
                author_avatar_url,
                lead_summary,
                audio_url,
                1 if article.get("has_full_text", True) else 0,
                1 if article.get("is_indexed", False) else 0
            ))

            # Enregistrer les liaisons bibliques
            if scripture_refs is not None:
                cursor.execute("DELETE FROM article_scripture_links WHERE article_id = ?", (article["id"],))
                for ref in scripture_refs:
                    cursor.execute("""
                    INSERT INTO article_scripture_links (article_id, book_code, chapter, verse, raw_ref)
                    VALUES (?, ?, ?, ?, ?)
                    """, (
                        article["id"],
                        ref.get("book_code", ""),
                        int(ref.get("chapter", 0)),
                        str(ref.get("verse", "")) if ref.get("verse") is not None else None,
                        ref.get("raw", "")
                    ))

            conn.commit()
            return is_new

    def get_articles(
        self,
        source_id: Optional[str] = None,
        book_code: Optional[str] = None,
        chapter: Optional[int] = None,
        search_query: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """Recherche et liste paginée des articles avec filtres."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            where_clauses = ["s.is_enabled = 1"]
            params: List[Any] = []

            if source_id:
                where_clauses.append("a.source_id = ?")
                params.append(source_id)

            if book_code:
                where_clauses.append("EXISTS (SELECT 1 FROM article_scripture_links l WHERE l.article_id = a.id AND l.book_code = ?" + (" AND l.chapter = ?" if chapter else "") + ")")
                params.append(book_code)
                if chapter:
                    params.append(chapter)

            if search_query:
                where_clauses.append("(a.title LIKE ? OR a.author LIKE ? OR a.summary LIKE ? OR a.tags LIKE ?)")
                q_param = f"%{search_query}%"
                params.extend([q_param, q_param, q_param, q_param])

            where_str = " AND ".join(where_clauses)
            
            query = f"""
            SELECT a.*, s.name as source_name, s.category as source_category
            FROM articles a
            JOIN sources s ON a.source_id = s.id
            WHERE {where_str}
            ORDER BY a.published_at DESC
            LIMIT ? OFFSET ?
            """
            params.extend([limit, offset])

            cursor.execute(query, params)
            rows = cursor.fetchall()
            
            results = []
            for row in rows:
                art = dict(row)
                raw_t = art.get("tags") or ""
                art["tags_list"] = [t.strip() for t in raw_t.split(",") if t.strip()]
                # Attacher les références bibliques
                cursor.execute("SELECT raw_ref, book_code, chapter, verse FROM article_scripture_links WHERE article_id = ?", (art["id"],))
                art["scripture_references"] = [dict(r) for r in cursor.fetchall()]
                results.append(art)
                
            return results

    def get_article_by_id(self, article_id: str) -> Optional[Dict[str, Any]]:
        """Récupère un article spécifique par son identifiant."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            SELECT a.*, s.name as source_name, s.category as source_category, s.website_url as source_website
            FROM articles a
            JOIN sources s ON a.source_id = s.id
            WHERE a.id = ?
            """, (article_id,))
            row = cursor.fetchone()
            if not row:
                return None
            art = dict(row)
            raw_t = art.get("tags") or ""
            art["tags_list"] = [t.strip() for t in raw_t.split(",") if t.strip()]
            cursor.execute("SELECT raw_ref, book_code, chapter, verse FROM article_scripture_links WHERE article_id = ?", (article_id,))
            art["scripture_references"] = [dict(r) for r in cursor.fetchall()]
            return art

    def get_articles_for_passage(self, book_code: str, chapter: int, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Récupère instantanément les articles pertinents citant ce livre et chapitre.
        Utilisé pour le panneau latéral du lecteur biblique.
        """
        return self.get_articles(book_code=book_code, chapter=chapter, limit=limit)

    def mark_as_indexed(self, article_id: str, is_indexed: bool = True):
        """Marque l'article comme vectorisé dans ChromaDB."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("UPDATE articles SET is_indexed = ? WHERE id = ?", (1 if is_indexed else 0, article_id))
            conn.commit()

    def get_unindexed_articles(self, limit: int = 100) -> List[Dict[str, Any]]:
        """Récupère les articles qui n'ont pas encore été vectorisés."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            SELECT a.*, s.name as source_name
            FROM articles a
            JOIN sources s ON a.source_id = s.id
            WHERE a.is_indexed = 0 AND s.is_enabled = 1
            LIMIT ?
            """, (limit,))
            return [dict(r) for r in cursor.fetchall()]

    def get_stats(self) -> Dict[str, Any]:
        """Retourne des statistiques globales sur les articles."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM articles")
            total_articles = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM articles WHERE is_indexed = 1")
            indexed_articles = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(DISTINCT article_id) FROM article_scripture_links")
            articles_with_verses = cursor.fetchone()[0]

            return {
                "total_articles": total_articles,
                "indexed_articles": indexed_articles,
                "articles_with_verses": articles_with_verses
            }
