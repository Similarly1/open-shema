import os
import sys
import unittest

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

from core.config import load_config
from core.original_languages_manager import OriginalLanguagesManager
from core.rag_pipeline import RAGPipeline

class TestCompleteExegesis(unittest.TestCase):
    def setUp(self):
        self.mgr = OriginalLanguagesManager.get_instance()
        self.config = load_config()

    def test_database_installed(self):
        self.assertTrue(self.mgr.is_installed(), "La base de données originale doit être installée")
        stats = self.mgr.get_stats()
        self.assertGreater(stats["total_words"], 400000, "La base doit contenir plus de 400 000 mots")
        self.assertGreater(stats["ot_words"], 250000, "L'AT doit contenir au moins 250 000 mots hébreux")
        self.assertGreater(stats["nt_words"], 130000, "Le NT doit contenir au moins 130 000 mots grecs")

    def test_hebrew_verse_genesis_1_1(self):
        import unicodedata
        words = self.mgr.get_verse_original_words("GEN", 1, 1)
        self.assertEqual(len(words), 7, "Genèse 1:1 doit contenir 7 mots hébreux")
        # Vérifier le mot 1 (בְּרֵאשִׁית)
        w1 = words[0]
        self.assertEqual(w1["strong"], "H7225")
        self.assertEqual(unicodedata.normalize('NFC', w1["lemma"]), unicodedata.normalize('NFC', "רֵאשִׁית"))
        self.assertIn("Préposition", w1["morph_desc_fr"])
        
        # Vérifier le mot 2 (בָּרָא)
        w2 = words[1]
        self.assertEqual(w2["strong"], "H1254")
        self.assertIn("Verbe Qal Parfait", w2["morph_desc_fr"])

    def test_greek_verse_john_1_1(self):
        words = self.mgr.get_verse_original_words("JHN", 1, 1)
        self.assertEqual(len(words), 17, "Jean 1:1 doit contenir 17 mots grecs")
        # Vérifier le mot 1 (Ἐν)
        w1 = words[0]
        self.assertIn("Ἐν", w1["text"])
        self.assertEqual(w1["strong"], "G1722")
        self.assertEqual(w1["morph_desc_fr"], "Préposition")
        
        # Vérifier le mot 5 (λόγος)
        w5 = words[4]
        self.assertIn("λόγος", w5["text"])
        self.assertEqual(w5["strong"], "G3056")
        self.assertIn("Nominatif", w5["morph_desc_fr"])

    def test_reverse_interlinear_segond_1910(self):
        rev = self.mgr.get_verse_reverse_interlinear("GEN", 1, 1)
        self.assertTrue(len(rev) > 0, "L'interlinéaire inversé de Genèse 1:1 ne doit pas être vide")
        self.assertIn("commencement", rev)
        self.assertIn("H7225", rev)
        self.assertIn("Dieu", rev)
        self.assertIn("H0430", rev)

    def test_exegetical_block_3_layers(self):
        block = self.mgr.get_passage_original_block(
            book_code="GEN", 
            chapter=1, 
            start_verse=1, 
            end_verse=2, 
            max_verses=10,
            displayed_version_name="Segond 21",
            displayed_verses_dict={1: "Au commencement, Dieu créa le ciel et la terre.", 2: "La terre était informe..."}
        )
        self.assertIn("--- 1. VERSION AFFICHÉE (Segond 21) ---", block)
        self.assertIn("--- 2. VERSION SEGOND 1910 (INTERLINÉAIRE INVERSÉ AVEC CODES STRONGS) ---", block)
        self.assertIn("--- 3. TEXTE ORIGINAL MOT-À-MOT", block)
        self.assertIn("H7225", block)
        self.assertIn("H1254", block)

    def test_rag_pipeline_context_assembly(self):
        class DummyDB:
            pass
        pipeline = RAGPipeline(DummyDB(), config={"max_original_verses_for_llm": 5})
        structured = pipeline.build_structured_context(
            documents=[{"id": "doc1", "text": "Commentaire de Calvin", "metadata": {"name": "Jean Calvin", "book": "Genèse"}}],
            screen_context="Genèse 1:1 affiché à l'écran",
            exegetical_context="=== CONTEXTE EXÉGÉTIQUE ===\nTexte original ici"
        )
        self.assertIn("=== CONTEXTE EXÉGÉTIQUE ===", structured)
        self.assertIn("=== CONTEXTE ACTUELLEMENT OUVERT À L'ÉCRAN ===", structured)
        self.assertIn("=== EXTRAITS DE LA BIBLIOTHÈQUE THÉOLOGIQUE ET BIBLIQUE ===", structured)

    def test_chapter_verse_counts(self):
        self.assertEqual(self.mgr.get_chapter_verse_count("GEN", 1), 31, "Genèse 1 doit avoir 31 versets")
        self.assertEqual(self.mgr.get_chapter_verse_count("JHN", 1), 51, "Jean 1 doit avoir 51 versets")
        self.assertEqual(self.mgr.get_chapter_verse_count("PSA", 119), 176, "Psaume 119 doit avoir 176 versets")

if __name__ == "__main__":
    unittest.main()
