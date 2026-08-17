import os
import sys
import unittest

# Ajouter le répertoire bible_ai_app au sys.path
sys.path.insert(0, os.path.dirname(__file__))

from core.book_metadata_client import BookMetadataClient

class TestBookMetadata(unittest.TestCase):
    def test_search_calvin(self):
        results = BookMetadataClient.search_books("Jean Calvin", limit=5)
        self.assertIsInstance(results, list)
        self.assertTrue(len(results) > 0, "Doit renvoyer au moins un résultat pour Jean Calvin")
        first = results[0]
        self.assertIn("title", first)
        self.assertIn("author_str", first)
        self.assertIn("source", first)
        print(f"\n[TEST OK] Calvin : {first['title']} par {first['author_str']} ({first['source']})")

    def test_search_segond(self):
        results = BookMetadataClient.search_books("Segond 21", limit=5)
        self.assertTrue(len(results) > 0, "Doit renvoyer des résultats pour Segond 21")
        first = results[0]
        print(f"[TEST OK] Segond 21 : {first['title']} | Couverture URL: {bool(first.get('cover_url'))}")

    def test_download_cover(self):
        # Tester le téléchargement d'une couverture Open Library
        cover_url = "https://covers.openlibrary.org/b/id/13113477-M.jpg"
        local_path = BookMetadataClient.download_cover_image(cover_url, title_hint="test_segond21_cover")
        self.assertIsNotNone(local_path, "Le téléchargement de l'image doit réussir")
        self.assertTrue(os.path.exists(local_path), "Le fichier local doit exister")
        print(f"[TEST OK] Téléchargement couverture : {local_path} (Taille: {os.path.getsize(local_path)} octets)")

if __name__ == "__main__":
    unittest.main()
