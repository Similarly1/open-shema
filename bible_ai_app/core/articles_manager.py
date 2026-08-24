import os
import json
import logging
import urllib.parse
from datetime import datetime
from typing import List, Dict, Any, Optional, Callable

from core.articles_db import ArticlesDB
from core.articles_feed_scraper import ArticlesFeedScraper
from core.database import VectorDB

logger = logging.getLogger(__name__)

class ArticlesManager:
    """
    Orchestrateur central pour la gestion des Articles & Blogs :
    - Synchronisation des flux préconfigurés
    - Sauvegarde locale Markdown et SQLite
    - Indexation vectorielle dans ChromaDB pour le RAG
    - Fourniture des APIs pour l'interface utilisateur et le lecteur biblique
    """

    _instance = None

    @classmethod
    def get_instance(cls, base_dir: str = "./data/articles"):
        if cls._instance is None:
            cls._instance = cls(base_dir=base_dir)
        return cls._instance

    def __init__(self, base_dir: str = "./data/articles"):
        self.base_dir = os.path.abspath(base_dir)
        self.content_dir = os.path.join(self.base_dir, "content")
        os.makedirs(self.content_dir, exist_ok=True)

        self.db = ArticlesDB(db_path=os.path.join(self.base_dir, "articles.db"))
        self.scraper = ArticlesFeedScraper()
        
        # Charger les sources préconfigurées
        self.curated_sources = self._load_curated_sources_config()
        self.db.sync_curated_sources(self.curated_sources)

    def _load_curated_sources_config(self) -> List[Dict[str, Any]]:
        """Charge le catalogue des blogs officiels depuis curated_sources.json."""
        config_path = os.path.join(os.path.dirname(__file__), "curated_sources.json")
        if os.path.exists(config_path):
            try:
                with open(config_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                logger.error(f"[ArticlesManager] Erreur chargement curated_sources.json: {e}")
        return []

    def get_sources(self, enabled_only: bool = False) -> List[Dict[str, Any]]:
        """Retourne la liste des sources de blogs."""
        return self.db.get_sources(enabled_only=enabled_only)

    def toggle_source(self, source_id: str, is_enabled: bool):
        """Active ou désactive un blog pour la recherche et la synchronisation."""
        self.db.set_source_enabled(source_id, is_enabled)

    def sync_source(self, source_id: str, max_articles: int = 15) -> int:
        """
        Synchronise un blog spécifique :
        Télécharge le flux RSS, traite les articles et les enregistre localement.
        Retourne le nombre de nouveaux articles ajoutés.
        """
        source = next((s for s in self.curated_sources if s["id"] == source_id), None)
        if not source:
            logger.warning(f"[ArticlesManager] Source inconnue : {source_id}")
            return 0

        logger.info(f"[ArticlesManager] Synchronisation de {source['name']} ({source['feed_url']})...")
        feed_xml = self.scraper.fetch_feed_xml(source["feed_url"])
        if not feed_xml:
            return 0

        raw_items = self.scraper.parse_feed_items(feed_xml, source)
        if not raw_items:
            return 0

        # Limiter aux N plus récents
        raw_items = raw_items[:max_articles]
        new_count = 0

        source_content_dir = os.path.join(self.content_dir, source_id)
        os.makedirs(source_content_dir, exist_ok=True)

        for item in raw_items:
            try:
                processed = self.scraper.process_article(item)
                
                # Sauvegarder le fichier Markdown
                md_path = os.path.join(source_content_dir, f"{processed['id']}.md")
                with open(md_path, "w", encoding="utf-8") as f:
                    f.write(f"# {processed['title']}\n\n")
                    f.write(f"**Auteur :** {processed.get('author', 'Anonyme')}  \n")
                    f.write(f"**Source :** [{source['name']}]({processed['url']})  \n")
                    f.write(f"**Date :** {processed.get('published_at', '')}  \n\n---\n\n")
                    f.write(processed["content_markdown"])

                processed["content_path"] = os.path.relpath(md_path, start=self.base_dir)

                # Persister dans SQLite
                is_new = self.db.upsert_article(processed, processed.get("scripture_references", []))
                if is_new:
                    new_count += 1
            except Exception as e:
                logger.error(f"[ArticlesManager] Erreur traitement article {item.get('title')}: {e}")

        # Mettre à jour l'horodatage de synchro
        self.db.update_source_synced_at(source_id, datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"))
        logger.info(f"[ArticlesManager] Fin synchro {source['name']} : {new_count} nouveaux articles.")
        return new_count

    def sync_all_active_sources(self, max_per_source: int = 15, progress_callback: Optional[Callable[[str, int], None]] = None) -> Dict[str, int]:
        """Synchronise toutes les sources actuellement activées."""
        sources = self.db.get_sources(enabled_only=True)
        total_sources = len(sources)
        results = {}

        for idx, src in enumerate(sources):
            if progress_callback:
                progress_callback(src["name"], int((idx / max(1, total_sources)) * 100))
            new_articles = self.sync_source(src["id"], max_articles=max_per_source)
            results[src["id"]] = new_articles

        if progress_callback:
            progress_callback("Terminé", 100)

        return results

    def get_article_markdown(self, article_id: str) -> Optional[str]:
        """Lit le texte complet d'un article depuis son fichier Markdown local."""
        art = self.db.get_article_by_id(article_id)
        if not art or not art.get("content_path"):
            return None
        
        full_path = os.path.join(self.base_dir, art["content_path"])
        if os.path.exists(full_path):
            with open(full_path, "r", encoding="utf-8") as f:
                return f.read()
        return None

    def get_articles(
        self,
        source_id: Optional[str] = None,
        book_code: Optional[str] = None,
        chapter: Optional[int] = None,
        search_query: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """Liste paginée des articles pour l'affichage."""
        return self.db.get_articles(
            source_id=source_id,
            book_code=book_code,
            chapter=chapter,
            search_query=search_query,
            limit=limit,
            offset=offset
        )

    def get_articles_for_passage(self, book_code: str, chapter: int, limit: int = 10) -> List[Dict[str, Any]]:
        """Articles contemporains liés à un livre et chapitre biblique (Lecteur & Panneau latéral)."""
        return self.db.get_articles_for_passage(book_code=book_code, chapter=chapter, limit=limit)

    def index_unindexed_articles_in_rag(
        self,
        vector_db: VectorDB,
        embedding_model: str = "gemini-embedding-2",
        chunk_size: int = 800,
        chunk_overlap: int = 150,
        progress_callback: Optional[Callable[[int], None]] = None
    ) -> int:
        """
        Découpe et vectorise les articles non encore indexés dans ChromaDB.
        Retourne le nombre d'articles vectorisés avec succès.
        """
        unindexed = self.db.get_unindexed_articles(limit=50)
        if not unindexed:
            if progress_callback:
                progress_callback(100)
            return 0

        total_articles = len(unindexed)
        indexed_count = 0

        for idx, art in enumerate(unindexed):
            md_text = self.get_article_markdown(art["id"])
            if not md_text or len(md_text.strip()) < 100:
                self.db.mark_as_indexed(art["id"], is_indexed=True)
                continue

            # Découpage en fragments (chunks)
            chunks = self._chunk_text(
                text=md_text,
                article=art,
                chunk_size=chunk_size,
                chunk_overlap=chunk_overlap
            )

            if chunks:
                vector_db.add_chunks(chunks, embedding_model=embedding_model)

            self.db.mark_as_indexed(art["id"], is_indexed=True)
            indexed_count += 1

            if progress_callback:
                progress_callback(int(((idx + 1) / total_articles) * 100))

        return indexed_count

    def _chunk_text(self, text: str, article: Dict[str, Any], chunk_size: int = 800, chunk_overlap: int = 150) -> List[Dict[str, Any]]:
        """Découpe un texte Markdown en chunks logiques pour ChromaDB."""
        paragraphs = text.split("\n\n")
        chunks = []
        current_chunk = []
        current_len = 0
        chunk_idx = 0

        for p in paragraphs:
            p = p.strip()
            if not p:
                continue

            p_len = len(p)
            if current_len + p_len > chunk_size and current_chunk:
                chunk_str = "\n\n".join(current_chunk)
                chunks.append({
                    "id": f"{article['id']}_chk_{chunk_idx}",
                    "text": chunk_str,
                    "metadata": {
                        "source_type": "contemporary_article",
                        "source_id": article["source_id"],
                        "source_name": article.get("source_name", "Blog"),
                        "name": article.get("source_name", "Blog"), # Rétrocompatibilité RAG
                        "title": article["title"],
                        "author": article.get("author", ""),
                        "url": article.get("url", ""),
                        "published_at": article.get("published_at", ""),
                        "chunk_index": chunk_idx
                    }
                })
                chunk_idx += 1
                # Garder le dernier paragraphe pour le chevauchement si pas trop long
                if p_len < chunk_overlap:
                    current_chunk = [p]
                    current_len = p_len
                else:
                    current_chunk = []
                    current_len = 0

            current_chunk.append(p)
            current_len += p_len

        if current_chunk:
            chunk_str = "\n\n".join(current_chunk)
            chunks.append({
                "id": f"{article['id']}_chk_{chunk_idx}",
                "text": chunk_str,
                "metadata": {
                    "source_type": "contemporary_article",
                    "source_id": article["source_id"],
                    "source_name": article.get("source_name", "Blog"),
                    "name": article.get("source_name", "Blog"),
                    "title": article["title"],
                    "author": article.get("author", ""),
                    "url": article.get("url", ""),
                    "published_at": article.get("published_at", ""),
                    "chunk_index": chunk_idx
                }
            })

        return chunks

    @staticmethod
    def get_suggestion_mailto_link(
        developer_email: str = "contact@bible-app.org",
        blog_name: str = "",
        blog_url: str = "",
        notes: str = ""
    ) -> str:
        """Génère une URL mailto préremplie pour proposer une nouvelle source."""
        subject = "[Suggestion Source] Nouveau blog théologique"
        body = f"Bonjour,\n\nJe souhaite vous suggérer l'ajout d'une nouvelle source théologique :\n\n- Nom du site : {blog_name}\n- URL du site / flux : {blog_url}\n- Raison / Commentaire : {notes}\n\nMerci !"
        params = {
            "subject": subject,
            "body": body
        }
        return f"mailto:{developer_email}?{urllib.parse.urlencode(params, quote_via=urllib.parse.quote)}"
