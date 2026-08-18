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

    def retrieve_candidates(self, query: str, top_k: int = 25, embedding_model: str = None, active_sources: list = None, where_clause: dict = None) -> list:
        """
        Étape 1 : Recherche vectorielle dense dans ChromaDB.
        """
        if not embedding_model:
            embedding_model = self.config.get("embedding_model", "bge_multilingual_gemma2 (Infomaniak)")
            
        try:
            results = self.db.search_semantic(
                query=query, 
                n_results=top_k, 
                where_clause=where_clause,
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

    def curate_context(self, query: str, documents: list, curation_model: str = None) -> list:
        """
        Étape 3 : Curation et synthèse sémantique du contexte par un LLM intermédiaire
        (par exemple mistralai/Ministral-3-14B-Instruct-2512 sur Infomaniak ou mistral-small ou gemini-flash-lite).
        """
        if not documents:
            return documents
            
        curation_model = curation_model or self.config.get("rag_curation_model", "mistralai/Ministral-3-14B-Instruct-2512")
        
        # Résolution du provider et de la clé
        if "infomaniak" in curation_model.lower() or "ministral" in curation_model.lower() or "qwen" in curation_model.lower() or "bge" in curation_model.lower():
            provider = "infomaniak"
            api_key = self.config.get("infomaniak_token", "")
            product_id = self.config.get("infomaniak_product_id", "251")
        elif "mistral" in curation_model.lower():
            provider = "mistral"
            api_key = self.config.get("mistral_api_key", "")
            product_id = None
        else:
            provider = "gemini"
            api_key = self.config.get("gemini_api_key", "")
            product_id = None

        if not api_key:
            return documents

        try:
            llm = LLMClient(api_key=api_key, model=curation_model, provider=provider, product_id=product_id)
            
            raw_excerpts = []
            for i, doc in enumerate(documents, 1):
                meta = doc.get("metadata", {})
                title = meta.get("name") or meta.get("source") or f"Doc {i}"
                raw_excerpts.append(f"[{title}]\n{doc['text']}")
            
            combined_text = "\n\n".join(raw_excerpts)
            
            sys_prompt = (
                "Vous êtes un assistant expert en épuration et synthèse théologique.\n"
                "Votre rôle est d'analyser ces extraits bruts et de produire pour chacun une synthèse ultra-dense et précise "
                "en conservant fidèlement toutes les définitions théologiques, arguments et références bibliques, "
                "tout en supprimant les bavardages et informations redondantes."
            )
            
            curated_output = llm.ask_question(
                context=combined_text, 
                question=f"Synthétise et épure les points clés utiles pour répondre à : '{query}'", 
                system_prompt=sys_prompt
            )
            
            if curated_output and not str(curated_output).startswith("Erreur"):
                curated_docs = [dict(d) for d in documents]
                curated_docs.insert(0, {
                    "id": "curated_summary",
                    "text": f"--- SYNTHÈSE ÉPURÉE PAR LE MODÈLE INTERMÉDIAIRE ({curation_model.split('/')[-1]}) ---\n{curated_output}",
                    "metadata": {"name": f"Synthèse Curée ({curation_model.split('/')[-1]})"},
                    "rerank_score": 1.0
                })
                return curated_docs
        except Exception as e:
            print(f"[RAGPipeline] Erreur lors de la curation IA : {e}")
            
        return documents

    def build_structured_context(self, documents: list, screen_context: str = None, exegetical_context: str = None, pericope_context: str = None) -> str:
        """
        Formate le contexte extrait de manière hautement structurée avec étiquettes de citation exactes
        et injection prioritaire du bloc de péricope littéraire et du triple bloc exégétique (Texte original, Interlinéaire, Version affichée).
        """
        sections = []
        
        if pericope_context and pericope_context.strip():
            sections.append(f"{pericope_context.strip()}\n")
            
        if exegetical_context and exegetical_context.strip():
            sections.append(f"{exegetical_context.strip()}\n")
        
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
                active_location: dict = None,
                top_k_raw: int = 25, 
                top_k_final: int = 7, 
                enable_rerank: bool = True, 
                enable_curation: bool = False, 
                curation_model: str = None,
                embedding_model: str = None,
                chat_model: str = None,
                thinking_budget: int = None,
                system_prompt: str = None,
                step_callback = None) -> dict:
        """
        Exécute la chaîne RAG complète de bout en bout avec notifications d'étapes.
        """
        t0 = time.time()
        
        def _notify(step_id, label, status):
            if step_callback:
                try:
                    step_callback(step_id, label, status)
                except Exception:
                    pass

        # 1a. Détection du contexte et scope vectoriel (Le "Tri-Flux")
        where_clause = None
        b_code = None
        if active_location:
            book = active_location.get("book")
            if book:
                from core.reference_parser import get_standard_book_code
                from core.search_engine import CORPUS_DEFINITIONS
                b_code = get_standard_book_code(book)
                
                # Déduire le corpus (NT ou OT) pour le filtrage thématique (Flux 3)
                corpus_scope = "GLOBAL"
                for scope, (desc, books) in CORPUS_DEFINITIONS.items():
                    if scope in ["OT", "NT"] and b_code in books:
                        corpus_scope = scope
                accepted_scopes = [corpus_scope, "GLOBAL", "BOTH", "AT+NT"]
                if corpus_scope in ["OT", "AT"]:
                    accepted_scopes.extend(["OT", "AT"])
                elif corpus_scope == "NT":
                    accepted_scopes.append("NT")
                where_clause = {"corpus_scope": {"$in": list(set(accepted_scopes))}}

        _notify("retrieval", "Recherche hybride dans la bibliothèque...", "running")
        t_retrieval_0 = time.time()
        
        # Flux 3 (Thématique / Vectoriel Filtré)
        raw_candidates = self.retrieve_candidates(
            query=query, 
            top_k=top_k_raw, 
            embedding_model=embedding_model,
            active_sources=active_sources,
            where_clause=where_clause
        )

        # 1b. Récupération Relationnelle Exacte & Intro (Flux 1 & 2)
        if active_location and b_code:
            ch = active_location.get("chapter")
            v = active_location.get("verse")
            from core.commentary_loader import CommentaryLoader
            
            # Récupérer l'introduction (chapitre 0)
            intro_results = CommentaryLoader.get_all_comments_for_passage(b_code, 0, 0)
            if intro_results and intro_results.get("documents"):
                for i, doc in enumerate(intro_results["documents"]):
                    # Filtrer si on a des active_sources
                    meta = intro_results["metadatas"][i]
                    if active_sources and meta.get("name") not in active_sources:
                        continue
                    raw_candidates.append({
                        "id": intro_results["ids"][i],
                        "text": doc,
                        "metadata": meta,
                        "vector_score": 1.0  # Max score pour forcer le Reranker à l'évaluer en priorité
                    })
                    
            # Récupérer les commentaires du verset exact
            if ch is not None:
                v_num = int(v) if v and str(v) != "Tous" and str(v).isdigit() else None
                exact_results = CommentaryLoader.get_all_comments_for_passage(b_code, ch, v_num)
                if exact_results and exact_results.get("documents"):
                    for i, doc in enumerate(exact_results["documents"]):
                        meta = exact_results["metadatas"][i]
                        if active_sources and meta.get("name") not in active_sources:
                            continue
                        raw_candidates.append({
                            "id": exact_results["ids"][i],
                            "text": doc,
                            "metadata": meta,
                            "vector_score": 1.0
                        })
                            
                    # Récupérer le lexique Strong (Hébreu / Grec) pour le verset
                    if v_num is not None:
                        try:
                            from core.strong_helper import StrongLexiconHelper
                            strong_entry = StrongLexiconHelper.get_verse_lexicon_block(b_code, ch, v_num)
                            if strong_entry:
                                raw_candidates.append(strong_entry)
                        except Exception as e:
                            print(f"[RAGPipeline] Erreur récupération lexique Strong : {e}")

        t_retrieval_ms = (time.time() - t_retrieval_0) * 1000
        if t_retrieval_ms < 500:
            time.sleep((500 - t_retrieval_ms) / 1000.0)
        _notify("retrieval", f"Recherche terminée ({len(raw_candidates)} extraits trouvés)", "done")

        # 2. Reranking local
        if enable_rerank and raw_candidates:
            _notify("rerank", "Évaluation de pertinence croisée (Reranker local)...", "running")
            t_rerank_0 = time.time()
            reranked_docs = self.rerank_candidates(
                query=query, 
                candidates=raw_candidates, 
                top_k=top_k_final, 
                enable_rerank=True
            )
            t_rerank_ms = (time.time() - t_rerank_0) * 1000
            if t_rerank_ms < 600:
                time.sleep((600 - t_rerank_ms) / 1000.0)
            _notify("rerank", f"Reranking terminé ({len(reranked_docs)} passages retenus)", "done")
        else:
            reranked_docs = raw_candidates[:top_k_final]
            t_rerank_ms = 0.0

        # 3. Curation de contexte par LLM intermédiaire
        curation_model_used = curation_model or self.config.get("rag_curation_model", "mistralai/Ministral-3-14B-Instruct-2512")
        t_curation_ms = 0.0
        if enable_curation and reranked_docs:
            _notify("curation", f"Curation du contexte ({curation_model_used.split('/')[-1]})...", "running")
            t_cur_0 = time.time()
            final_docs = self.curate_context(query=query, documents=reranked_docs, curation_model=curation_model_used)
            t_curation_ms = (time.time() - t_cur_0) * 1000
            if t_curation_ms < 600:
                time.sleep((600 - t_curation_ms) / 1000.0)
            _notify("curation", "Curation terminée avec succès", "done")
        else:
            final_docs = reranked_docs

        # 4. Assemblage du contexte et Rédaction finale LLM
        _notify("writing", "Rédaction de l'analyse exégétique...", "running")
        
        # Construction du contexte exégétique (Langues originales + Interlinéaire inversé + Version affichée)
        exegetical_context = ""
        try:
            from core.original_languages_manager import OriginalLanguagesManager
            orig_mgr = OriginalLanguagesManager.get_instance()
            if orig_mgr.is_installed():
                max_orig_verses = int(self.config.get("max_original_verses_for_llm", 10))
                
                target_book = None
                target_chap = None
                target_v_start = 1
                target_v_end = 1
                
                if active_location and b_code:
                    target_book = b_code
                    target_chap = active_location.get("chapter", 1)
                    v_val = active_location.get("verse")
                    if v_val and str(v_val) != "Tous" and str(v_val).isdigit():
                        target_v_start = int(v_val)
                        target_v_end = int(v_val)
                    else:
                        target_v_start = 1
                        target_v_end = max_orig_verses
                else:
                    from core.reference_parser import parse_references
                    detected_refs = parse_references(query)
                    if detected_refs:
                        ref_info = detected_refs[0]
                        target_book = ref_info.get("book_code")
                        target_chap = ref_info.get("chapter", 1)
                        v_s = ref_info.get("verse_start")
                        v_e = ref_info.get("verse_end")
                        target_v_start = v_s if v_s else 1
                        target_v_end = v_e if v_e else (v_s if v_s else max_orig_verses)
                        
                if target_book and target_chap:
                    displayed_ver_name = self.config.get("bible_version", "Version affichée")
                    exegetical_context = orig_mgr.get_passage_original_block(
                        book_code=target_book,
                        chapter=target_chap,
                        start_verse=target_v_start,
                        end_verse=target_v_end,
                        max_verses=max_orig_verses,
                        displayed_version_name=displayed_ver_name
                    )
        except Exception as e:
            print(f"[RAGPipeline] Erreur construction contexte exégétique original : {e}")

        # Construction du bloc de péricope littéraire (Unité de sens + Péricope précédente/suivante)
        pericope_context = ""
        try:
            from core.pericope_manager import PericopeManager
            ref_bible = self.config.get("reference_bible", "Segond 21")
            if target_book and target_chap:
                p_ctx = PericopeManager.get_pericope_context(ref_bible, target_book, target_chap, target_v_start)
                if p_ctx and p_ctx.get("has_pericope"):
                    cur_p = p_ctx.get("current", {})
                    prev_p = p_ctx.get("prev")
                    next_p = p_ctx.get("next")
                    
                    p_lines = [f"=== CONTEXTE LITTÉRAIRE DE LA PÉRICOPE ({ref_bible}) ==="]
                    if prev_p:
                        p_lines.append(f"• Péricope précédente : {prev_p.get('ref_range')} — « {prev_p.get('title')} »")
                    p_lines.append(f"• PÉRICOPE ACTIVE : {cur_p.get('ref_range')} — « {cur_p.get('title')} »")
                    if cur_p.get("text"):
                        p_lines.append(f"  [Texte intégral de la péricope] :\n{cur_p.get('text')}")
                    if next_p:
                        p_lines.append(f"• Péricope suivante : {next_p.get('ref_range')} — « {next_p.get('title')} »")
                    
                    pericope_context = "\n".join(p_lines) + "\n\n"
        except Exception as e:
            print(f"[RAGPipeline] Erreur calcul contexte péricope : {e}")

        structured_context = self.build_structured_context(
            final_docs, 
            screen_context=screen_context, 
            exegetical_context=exegetical_context,
            pericope_context=pericope_context
        )
        
        if not system_prompt:
            system_prompt = (
                "Vous êtes un assistant théologique et exégète biblique expert de haut niveau.\n"
                "Pour vos analyses, appuyez-vous rigoureusement sur les informations fournies dans le contexte :\n"
                "- Analysez toujours le passage biblique dans le cadre de sa PÉRICOPE complète (son unité de pensée et de sens) et en tenant compte de la dynamique narrative avec la péricope précédente et suivante, évitant ainsi d'isoler artificiellement un verset de son contexte littéraire.\n"
                "- Exploitez le texte original (Hébreu pour l'Ancien Testament, Grec pour le Nouveau Testament), les lemmes, les racines et la morphologie grammaticale (aspects verbaux, voix, modes, temps, cas) pour expliciter les nuances théologiques et littérales.\n"
                "- Reliez ces nuances à la traduction française et à l'interlinéaire inversé Segond 1910.\n"
                "- Citez les sources théologiques de la bibliothèque lorsque pertinent.\n"
                "- Répondez avec clarté, profondeur et rigueur académique."
            )
        
        selected_model = chat_model or self.config.get("chat_model", "gemini-3.7-flash")
        provider = "infomaniak" if ("infomaniak" in selected_model.lower() or "ministral" in selected_model.lower() or "qwen" in selected_model.lower()) else ("mistral" if "mistral" in selected_model else "gemini")
        api_key = self.config.get(f"{provider}_api_key" if provider != "infomaniak" else "infomaniak_token", "")
        product_id = self.config.get("infomaniak_product_id", "251") if provider == "infomaniak" else None
        
        llm = LLMClient(api_key=api_key, model=selected_model, provider=provider, product_id=product_id)
        
        t_llm_0 = time.time()
        answer = llm.ask_question(
            context=structured_context, 
            question=query, 
            system_prompt=system_prompt,
            thinking_budget=thinking_budget
        )
        t_llm_ms = (time.time() - t_llm_0) * 1000
        total_time_ms = (time.time() - t0) * 1000
        _notify("writing", "Rédaction finalisée", "done")

        return {
            "answer": answer,
            "sources": final_docs,
            "raw_count": len(raw_candidates),
            "final_count": len(final_docs),
            "model_used": getattr(llm.client, 'last_used_model', selected_model) if hasattr(llm, 'client') else selected_model,
            "provider": provider,
            "curation_used": enable_curation,
            "curation_model": curation_model_used if enable_curation else None,
            "thinking_budget": thinking_budget,
            "timings": {
                "retrieval_ms": round(t_retrieval_ms, 1),
                "rerank_ms": round(t_rerank_ms, 1),
                "curation_ms": round(t_curation_ms, 1),
                "llm_ms": round(t_llm_ms, 1),
                "total_ms": round(total_time_ms, 1)
            }
        }
