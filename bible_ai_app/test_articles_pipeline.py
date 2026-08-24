import os
import shutil
import tempfile
import unittest
from core.articles_db import ArticlesDB
from core.articles_feed_scraper import ArticlesFeedScraper
from core.articles_manager import ArticlesManager

MOCK_RSS_FEED = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Blog Théologique Test</title>
    <link>https://exemple-theologie.com</link>
    <description>Articles et méditations</description>
    <item>
      <title>La grâce souveraine et Romains 8</title>
      <link>https://exemple-theologie.com/grace-romains-8</link>
      <dc:creator>Jean Dupont</dc:creator>
      <pubDate>Mon, 24 Aug 2026 10:00:00 +0200</pubDate>
      <description><![CDATA[Une méditation sur la persévérance et la grâce dans l'épître aux Romains.]]></description>
      <content:encoded><![CDATA[
        <div class="entry-content">
          <p>L'apôtre Paul nous rappelle avec force dans <strong>Romains 8:28-39</strong> que rien ne peut nous séparer de l'amour de Dieu manifesté en Jésus-Christ.</p>
          <p>Comme le dit également l'Écriture dans <em>Jean 3.16</em> ainsi que dans <em>Éphésiens 2:8-9</em>, le salut est entièrement par grâce.</p>
          <div class="sharedaddy">Boutons de partage sociaux à supprimer</div>
          <p>Gardons les yeux fixés sur Christ.</p>
        </div>
      ]]></content:encoded>
    </item>
  </channel>
</rss>
"""

class TestArticlesPipeline(unittest.TestCase):

    def setUp(self):
        self.test_dir = tempfile.mkdtemp(prefix="test_articles_")
        self.db = ArticlesDB(db_path=os.path.join(self.test_dir, "test_articles.db"))
        self.scraper = ArticlesFeedScraper()

    def tearDown(self):
        try:
            shutil.rmtree(self.test_dir, ignore_errors=True)
        except Exception:
            pass

    def test_sources_and_db(self):
        sources = [
            {
                "id": "test_blog",
                "name": "Test Blog",
                "website_url": "https://exemple-theologie.com",
                "feed_url": "https://exemple-theologie.com/feed",
                "category": "test",
                "enabled_by_default": True
            }
        ]
        self.db.sync_curated_sources(sources)
        loaded_sources = self.db.get_sources()
        self.assertEqual(len(loaded_sources), 1)
        self.assertEqual(loaded_sources[0]["id"], "test_blog")
        self.assertEqual(loaded_sources[0]["is_enabled"], 1)

    def test_feed_parsing_and_cleaning(self):
        source_config = {
            "id": "test_blog",
            "name": "Test Blog",
            "selectors": {
                "content": ".entry-content",
                "excludes": [".sharedaddy"]
            }
        }
        items = self.scraper.parse_feed_items(MOCK_RSS_FEED, source_config)
        self.assertEqual(len(items), 1)
        
        processed = self.scraper.process_article(items[0])
        self.assertEqual(processed["title"], "La grâce souveraine et Romains 8")
        self.assertEqual(processed["author"], "Jean Dupont")
        self.assertNotIn("Boutons de partage sociaux", processed["content_markdown"])
        self.assertIn("**Romains 8:28-39**", processed["content_markdown"])

        # Vérification de l'extraction des versets bibliques
        ref_codes = [r["book_code"] for r in processed["scripture_references"]]
        self.assertIn("Rom", ref_codes)
        self.assertIn("Joh", ref_codes)
        self.assertIn("Eph", ref_codes)

        # Test d'insertion dans SQLite
        is_new = self.db.upsert_article(processed, processed["scripture_references"])
        self.assertTrue(is_new)

        # Test de récupération par passage biblique (Romains 8)
        rom_articles = self.db.get_articles_for_passage("Rom", 8)
        self.assertEqual(len(rom_articles), 1)
        self.assertEqual(rom_articles[0]["id"], processed["id"])

        # Test de recherche par abréviations (Rm 8, Jn 3.16, Romains, Rm, Eph)
        self.assertEqual(len(self.db.get_articles(search_query="Rm 8")), 1)
        self.assertEqual(len(self.db.get_articles(search_query="Rm")), 1)
        self.assertEqual(len(self.db.get_articles(search_query="Romains 8")), 1)
        self.assertEqual(len(self.db.get_articles(search_query="Jn 3.16")), 1)
        self.assertEqual(len(self.db.get_articles(search_query="Ép 2")), 1)
        self.assertEqual(self.db.get_articles_count(search_query="Rm 8"), 1)

    def test_articles_manager_workflow(self):
        manager = ArticlesManager(base_dir=self.test_dir)
        source = manager.curated_sources[0] if manager.curated_sources else None
        self.assertIsNotNone(source)

        # Tester le mailto de suggestion
        mailto = manager.get_suggestion_mailto_link(blog_name="Nouveau Blog", blog_url="https://monblog.fr")
        self.assertTrue(mailto.startswith("mailto:"))
        self.assertIn("Nouveau%20Blog", mailto)

if __name__ == "__main__":
    unittest.main()
