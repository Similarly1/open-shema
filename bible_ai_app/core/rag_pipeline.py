import time
from core.reranker import LocalReranker
from ai.llm_client import LLMClient

class RAGPipeline:
    """
    Orchestrateur RAG en 4 étapes pour l'étude biblique et théologique :
    1. Récupération sémantique (Bi-encodeur / ChromaDB) -> Top 20-30
    2. Reranking local haute précision (Cross-encodeur CPU) -> Top 5-8
    3. Curation / Normalisation du contexte (Optionnel)
    4. Synthèse exégétique et Rédaction sourcée (Grand LLM)
    """
    def __init__(self, db, config=None):
        self.db = db
        self.config = config or {}
        self.reranker = LocalReranker.get_instance()

    def retrieve_candidates(self, query: str, top_k: int = 25, embedding_model: str = None, active_sources: list = None) -> list:
        """
        Étape 1 : Recherche vectorielle dense dans ChromaDB.
        """
        if not embedding_model:
            embedding_model = self.config.get("embedding_model", "bge_multilingual_gemma2 (Infomaniak)")
            
        try:
            results = self.db.search_semantic(
                query=query, 
                n_results=top_k, 
                embedding_model=embedding_model
            )
        except Exception as e:
            print(f"[RAGPipeline] Erreur lors de la recherche vectorielle : {e}")
            return []

        if not results or "documents" not in results or not results["documents"] or not results["documents"][0]:
            return []

        raw_docs = results["documents"][0]
        raw_metas = results.get("metadatas", [[]])[0] if "metadatas" in results and results["metadatas"] else [{}] * len(raw_docs)
        raw_ids = results.get("ids", [[]])[0] if "ids" in results and results["ids"] else [f"doc_{i}" for i in range(len(raw_docs))]
        raw_dists = results.get("distances", [[]])[0] if "distances" in results and results["distances"] else [0.5] * len(raw_docs)

        candidates = []
        for i in range(len(raw_docs)):
            meta = raw_metas[i] if i < len(raw_metas) else {}
            
            # Filtrer selon les sources actives si spécifié
            if active_sources:
                source_name = meta.get("name") or meta.get("book")
                if source_name and source_name not in active_sources:
                    continue

            dist = raw_dists[i] if i < len(raw_dists) else 0.5
            similarity = max(0.0, min(1.0, 1.0 - (dist if dist is not None else 0.5)))

            candidates.append({
                "id": raw_ids[i] if i < len(raw_ids) else f"doc_{i}",
                "text": raw_docs[i],
                "metadata": meta,
                "vector_score": round(similarity, 4)
            })

        return candidates

    def rerank_candidates(self, query: str, candidates: list, top_k: int = 7, enable_rerank: bool = True) -> list:
        """
        Étape 2 : Évaluation de pertinence croisée (Cross-Encoder) sur CPU local.
        """
        if not candidates:
            return []
            
        if not enable_rerank:
            # Fallback : simple tri par similarité vectorielle
            sorted_docs = sorted(candidates, key=lambda x: x.get("vector_score", 0.0), reverse=True)
            return sorted_docs[:top_k]

        return self.reranker.rerank(query=query, documents=candidates, top_k=top_k)

    def curate_context(self, documents: list, enable_curation: bool = False) -> list:
        """
        Étape 3 : Curation et épuration du contexte (nettoyage des gloses, suppression du bruit).
        """
        if not enable_curation or not documents:
            return documents
            
        # Nettoyage textuel léger des balises parasites et lignes vides excessives
        curated = []
        for doc in documents:
            clean_text = doc["text"]
            # Suppression des sauts de ligne multiples
            clean_text = "\n".join([line.strip() for line in clean_text.splitlines() if line.strip()])
            doc_copy = dict(doc)
            doc_copy["text"] = clean_text
            curated.append(doc_copy)
            
        return curated

    def build_structured_context(self, documents: list, screen_context: str = None) -> str:
        """
        Formate le contexte extrait de manière hautement structurée avec étiquettes de citation exactes.
        """
        sections = []
        
        if screen_context and screen_context.strip():
            sections.append(f"=== CONTEXTE ACTUELLEMENT OUVERT À L'ÉCRAN ===\n{screen_context.strip()}\n")

        if documents:
            sections.append("=== EXTRAITS DE LA BIBLIOTHÈQUE THÉOLOGIQUE ET BIBLIQUE ===")
            for i, doc in enumerate(documents, 1):
                meta = doc.get("metadata", {})
                source_name = meta.get("name") or meta.get("source") or "Ouvrage"
                book = meta.get("book", "")
                chap = meta.get("chapter", "")
                verse = meta.get("verse", "")
                
                ref_parts = []
                if book: ref_parts.append(str(book))
                if chap: ref_parts.append(f"Chapitre {chap}" if not verse else f"{chap}:{verse}")
                
                ref_str = f", {' '.join(ref_parts)}" if ref_parts else ""
                score_str = f" [Pertinence Reranker : {int(doc.get('rerank_score', 0) * 100)}%]" if "rerank_score" in doc else ""
                
                header = f"--- SOURCE #{i} : [{source_name}{ref_str}]{score_str} ---"
                sections.append(f"{header}\n{doc['text']}\n")
                
        return "\n\n".join(sections)

    def execute(self, query: str, 
                active_sources: list = None, 
                screen_context: str = None, 
                top_k_raw: int = 25, 
                top_k_final: int = 7, 
                enable_rerank: bool = True, 
                enable_curation: bool = False, 
                embedding_model: str = None,
                chat_model: str = None,
                thinking_budget: int = None,
                system_prompt: str = None) -> dict:
        """
        Exécute la chaîne RAG complète de bout en bout.
        """
        t0 = time.time()
        
        # 1. Récupération vectorielle
        t_retrieval_0 = time.time()
        raw_candidates = self.retrieve_candidates(
            query=query, 
            top_k=top_k_raw, 
            embedding_model=embedding_model,
            active_sources=active_sources
        )
        t_retrieval_ms = (time.time() - t_retrieval_0) * 1000

        # 2. Reranking local
        t_rerank_0 = time.time()
        reranked_docs = self.rerank_candidates(
            query=query, 
            candidates=raw_candidates, 
            top_k=top_k_final, 
            enable_rerank=enable_rerank
        )
        t_rerank_ms = (time.time() - t_rerank_0) * 1000

        # 3. Curation de contexte
        final_docs = self.curate_context(reranked_docs, enable_curation=enable_curation)

        # 4. Assemblage du contexte et Rédaction finale LLM
        structured_context = self.build_structured_context(final_docs, screen_context=screen_context)
        
        selected_model = chat_model or self.config.get("chat_model", "gemini-3.7-flash")
        provider = "mistral" if "mistral" in selected_model else "gemini"
        api_key = self.config.get(f"{provider}_api_key", "")
        
        llm = LLMClient(api_key=api_key, model=selected_model, provider=provider)
        
        t_llm_0 = time.time()
        answer = llm.ask_question(
            context=structured_context, 
            question=query, 
            system_prompt=system_prompt,
            thinking_budget=thinking_budget
        )
        t_llm_ms = (time.time() - t_llm_0) * 1000
        total_time_ms = (time.time() - t0) * 1000

        return {
            "answer": answer,
            "sources": final_docs,
            "raw_count": len(raw_candidates),
            "final_count": len(final_docs),
            "model_used": getattr(llm.client, 'last_used_model', selected_model) if hasattr(llm, 'client') else selected_model,
            "timings": {
                "retrieval_ms": round(t_retrieval_ms, 1),
                "rerank_ms": round(t_rerank_ms, 1),
                "llm_ms": round(t_llm_ms, 1),
                "total_ms": round(total_time_ms, 1)
            }
        }
