import re
from typing import List, Dict, Any
from core.bible_reference_detector import find_bible_references

class ChunkEnricher:
    """
    Prépare les textes génériques (Livres d'introduction, PDF, EPUB) pour l'indexation RAG.
    Applique le "Contextual Chunking" et extrait automatiquement les références bibliques 
    pour faciliter le Tri-Flux.
    """

    @staticmethod
    def contextualize_chunk(text: str, book_title: str, chapter_title: str = "", author: str = "") -> str:
        """
        Préfixe le texte avec son contexte hiérarchique pour que le modèle d'embedding
        ne perde pas le sens global du fragment.
        """
        header_parts = []
        if author:
            header_parts.append(f"Auteur: {author}")
        if book_title:
            header_parts.append(f"Livre: {book_title}")
        if chapter_title:
            header_parts.append(f"Chapitre: {chapter_title}")
            
        header = " | ".join(header_parts)
        if header:
            return f"[Source: {header}]\n{text.strip()}"
        return text.strip()

    @classmethod
    def auto_tag_metadata(cls, text: str, base_metadata: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Analyse le texte pour trouver les références bibliques citées
        et met à jour les métadonnées pour le filtrage hybride.
        """
        meta = dict(base_metadata) if base_metadata else {}
        
        # Détection des références
        found_refs = find_bible_references(text)
        
        # On normalise en USFM
        referenced_verses = []
        referenced_books = set()
        
        for ref in found_refs:
            ref_raw = ref.get("raw", "")
            b_code = ref.get("book_code", "")
            ch = ref.get("chapter")
            v = ref.get("verse")
            
            if b_code:
                referenced_books.add(b_code)
                if ch is not None and v is not None:
                    referenced_verses.append(f"{b_code} {ch}:{v}")
                elif ch is not None:
                    referenced_verses.append(f"{b_code} {ch}")
                elif ref_raw:
                    referenced_verses.append(ref_raw)
        
        if referenced_verses:
            meta["referenced_verses"] = referenced_verses
            
        if referenced_books:
            meta["referenced_books"] = list(referenced_books)
            
        return meta

    @classmethod
    def process_document(cls, chunks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Traite une liste complète de chunks bruts pour les enrichir avant l'insertion dans ChromaDB.
        Chaque chunk doit être un dict: {"text": "...", "metadata": {"title": "...", "chapter": "...", ...}}
        """
        enriched_chunks = []
        for chunk in chunks:
            text = chunk.get("text", "")
            meta = chunk.get("metadata", {})
            
            author = meta.get("author", "")
            title = meta.get("title", meta.get("name", ""))
            chapter = meta.get("chapter_title", meta.get("chapter", ""))
            
            # 1. Contextualisation du texte
            new_text = cls.contextualize_chunk(text, title, str(chapter), author)
            
            # 2. Enrichissement des métadonnées avec les versets cités
            new_meta = cls.auto_tag_metadata(new_text, meta)
            
            enriched_chunks.append({
                "id": chunk.get("id"),
                "text": new_text,
                "metadata": new_meta
            })
            
        return enriched_chunks
