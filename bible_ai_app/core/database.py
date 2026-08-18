import os
import re
import chromadb
from ai.llm_client import LLMClient
from core.bible_json_loader import BibleJsonLoader

class VectorDB:
    def __init__(self, persist_directory="./data/chroma_db", api_keys=None):
        os.makedirs(persist_directory, exist_ok=True)
        self.client = chromadb.PersistentClient(
            path=persist_directory
        )
        self.api_keys = api_keys or {}

    def get_collection(self, embedding_model):
        if embedding_model == "study_library":
            return self.client.get_or_create_collection(
                name="study_library",
                metadata={"hnsw:space": "cosine"}
            )
        clean_name = re.sub(r'[^a-zA-Z0-9_-]', '_', embedding_model.strip())
        clean_name = re.sub(r'_+', '_', clean_name).strip('_')[:45]
        collection_name = f"bible_study_{clean_name}"
        return self.client.get_or_create_collection(
            name=collection_name,
            metadata={"hnsw:space": "cosine"}
        )

    def add_chunks(self, chunks, embedding_model="gemini-embedding-2", progress_callback=None):
        if not chunks:
            return
            
        collection = self.get_collection(embedding_model)
        
        # Détection des fragments déjà indexés pour reprise instantanée sans recalculer
        existing_ids = set()
        try:
            doc_name = chunks[0]["metadata"].get("name") if chunks else None
            if doc_name:
                existing_data = collection.get(where={"name": doc_name}, include=[])
                if existing_data and existing_data.get("ids"):
                    existing_ids = set(existing_data["ids"])
        except Exception:
            existing_ids = set()

        chunks_to_process = [c for c in chunks if c["id"] not in existing_ids]
        total_all = len(chunks)
        already_done = total_all - len(chunks_to_process)
        
        if progress_callback and already_done > 0:
            progress_callback(int((already_done / total_all) * 100))
            
        if not chunks_to_process:
            if progress_callback:
                progress_callback(100)
            return

        texts = [c["text"] for c in chunks_to_process]
        raw_metadatas = [c.get("metadata", {}) for c in chunks_to_process]
        ids = [c["id"] for c in chunks_to_process]
        
        # Nettoyage strict des métadonnées pour ChromaDB (types primitifs uniquement, listes en chaînes)
        metadatas = []
        for m in raw_metadatas:
            clean_m = {}
            for k, v in m.items():
                if v is None:
                    continue
                elif isinstance(v, (list, set, tuple)):
                    clean_m[k] = ", ".join(str(item) for item in v)
                elif isinstance(v, (str, int, float, bool)):
                    clean_m[k] = v
                else:
                    clean_m[k] = str(v)
            metadatas.append(clean_m)
        
        batch_size = 20 if ("gemini" in embedding_model or "infomaniak" in embedding_model or "bge" in embedding_model) else 50
        total_remaining = len(texts)
        
        if embedding_model == "study_library":
            for i in range(0, total_remaining, batch_size):
                end = min(i + batch_size, total_remaining)
                batch_texts = texts[i:end]
                batch_ids = ids[i:end]
                batch_metas = metadatas[i:end]
                dummy_embeddings = [[0.0] * 384 for _ in range(len(batch_texts))]
                collection.add(
                    embeddings=dummy_embeddings,
                    documents=batch_texts,
                    metadatas=batch_metas,
                    ids=batch_ids
                )
                if progress_callback:
                    current_done = already_done + end
                    progress_callback(int((current_done / total_all) * 100))
            return
            
        if "infomaniak" in embedding_model or "bge" in embedding_model or "mini_lm" in embedding_model:
            provider = "infomaniak"
            key = self.api_keys.get("infomaniak") or self.api_keys.get("infomaniak_token")
            product_id = self.api_keys.get("infomaniak_product_id", "251")
        elif "gemini" in embedding_model:
            provider = "gemini"
            key = self.api_keys.get("gemini") or self.api_keys.get("gemini_api_key")
            product_id = None
        else:
            provider = "mistral"
            key = self.api_keys.get("mistral") or self.api_keys.get("mistral_api_key")
            product_id = None

        if not key:
            raise Exception(f"Clé/Token API manquant pour {provider}")
            
        llm = LLMClient(api_key=key, provider=provider, product_id=product_id)
        
        for i in range(0, total_remaining, batch_size):
            end = min(i + batch_size, total_remaining)
            batch_texts = texts[i:end]
            
            embeddings = llm.get_embeddings(batch_texts, model=embedding_model)
            collection.add(
                embeddings=embeddings,
                documents=batch_texts,
                metadatas=metadatas[i:end],
                ids=ids[i:end]
            )
            if progress_callback:
                current_done = already_done + end
                progress_callback(int((current_done / total_all) * 100))

    def get_by_reference(self, reference, active_sources=None):
        if not active_sources:
            return None
            
        from core.reference_parser import normalize_reference
        norm_ref = normalize_reference(reference) or reference
        
        # Parser la référence (ex: "Rut 3" ou "Joh 3:16")
        m_verse = re.match(r'^([1-3]?\s*[A-Za-zÀ-ÖØ-öø-ÿ]+)\s+(\d+):(\d+)$', norm_ref.strip())
        m_chap = re.match(r'^([1-3]?\s*[A-Za-zÀ-ÖØ-öø-ÿ]+)\s+(\d+)$', norm_ref.strip())
        
        book = None
        chapter = None
        verse = None
        
        if m_verse:
            book = m_verse.group(1).strip()
            chapter = int(m_verse.group(2))
            verse = int(m_verse.group(3))
        elif m_chap:
            book = m_chap.group(1).strip()
            chapter = int(m_chap.group(2))
        else:
            book = norm_ref.strip()
            chapter = None
            verse = None
            
        from gui.library_utils import load_books_metadata
        registry = load_books_metadata()

        all_metadatas = []
        all_documents = []
        all_ids = []
        
        # Séparer les sources JSON locales, commentaires SQLite et sources ChromaDB
        json_sources = []
        commentary_sources = []
        chroma_sources = []
        
        from core.commentary_loader import CommentaryLoader
        
        for src in active_sources:
            src_name = src["name"] if isinstance(src, dict) else src
            src_meta = registry.get(src_name, {})
            # 1. Vérifier si c'est une Bible JSON disponible sur disque (priorité absolue)
            if src_meta.get("format") == "json" or src_meta.get("type") == "Bible" or BibleJsonLoader.find_bible_dir_by_name(src_name) is not None:
                json_sources.append(src_name)
            # 2. Vérifier si c'est un Commentaire local
            elif src_meta.get("format") == "commentary_sqlite" or src_meta.get("type") == "Commentaire" or CommentaryLoader.is_commentary_source(src_name):
                commentary_sources.append(src_name)
            else:
                chroma_sources.append(src)

        # 1. Récupération ultra-rapide (<1ms) depuis les Bibles JSON locales
        if book:
            for b_name in json_sources:
                res_json = BibleJsonLoader.get_verses(b_name, book, chapter, verse)
                if res_json and res_json.get("ids"):
                    all_ids.extend(res_json["ids"])
                    all_documents.extend(res_json["documents"])
                    all_metadatas.extend(res_json["metadatas"])

        # 2. Récupération ultra-rapide (<1ms) depuis les Commentaires locaux
        if book:
            for c_name in commentary_sources:
                res_comm = CommentaryLoader.get_comments(c_name, book, chapter, verse)
                if res_comm and res_comm.get("ids"):
                    all_ids.extend(res_comm["ids"])
                    all_documents.extend(res_comm["documents"])
                    all_metadatas.extend(res_comm["metadatas"])

        # 3. Récupération depuis ChromaDB pour les autres sources (Docx, Livres externes, etc.)
        if chroma_sources:
            sources_by_model = {}
            for src in chroma_sources:
                model = src.get("embedding_model", "study_library") if isinstance(src, dict) else "study_library"
                s_name = src["name"] if isinstance(src, dict) else src
                if model not in sources_by_model:
                    sources_by_model[model] = []
                sources_by_model[model].append(s_name)

            for model, names in sources_by_model.items():
                collection = self.get_collection(model)
                try:
                    # Tenter requête par book (+ chapter si présent)
                    results = None
                    if book and chapter is not None:
                        try:
                            results = collection.get(
                                where={"$and": [{"book": book}, {"chapter": chapter}, {"name": {"$in": names}}]},
                                include=["metadatas", "documents"]
                            )
                        except Exception:
                            results = None
                    elif book and chapter is None:
                        try:
                            results = collection.get(
                                where={"$and": [{"book": book}, {"name": {"$in": names}}]},
                                include=["metadatas", "documents"]
                            )
                        except Exception:
                            results = None
                            
                    # Repli par référence exacte
                    if not results or not results.get("ids"):
                        results = collection.get(
                            where={"$and": [{"reference": norm_ref}, {"name": {"$in": names}}]},
                            include=["metadatas", "documents"]
                        )
                        
                    if results and results.get("ids"):
                        res_ids = results["ids"]
                        res_metas = results.get("metadatas", [])
                        res_docs = results.get("documents", [])
                        
                        if verse is not None:
                            filtered = []
                            for rid, rdoc, rmeta in zip(res_ids, res_docs, res_metas):
                                meta_verse = rmeta.get("verse")
                                if meta_verse is not None:
                                    if int(meta_verse) == verse:
                                        filtered.append((rid, rdoc, rmeta))
                                else:
                                    if rmeta.get("reference", "").endswith(f":{verse}"):
                                        filtered.append((rid, rdoc, rmeta))
                            
                            if filtered:
                                res_ids = [x[0] for x in filtered]
                                res_docs = [x[1] for x in filtered]
                                res_metas = [x[2] for x in filtered]
                                
                        all_ids.extend(res_ids)
                        all_metadatas.extend(res_metas)
                        all_documents.extend(res_docs)
                except Exception as e:
                    print(f"Error querying database for reference {norm_ref}: {e}")
                    continue

        if not all_ids:
            return None
            
        # Trier : Bibles d'abord, puis commentaires, puis par nom, chapitre et verset
        combined = list(zip(all_ids, all_documents, all_metadatas))
        def sort_key(item):
            m = item[2]
            type_order = 0 if m.get("type") == "Bible" else 1
            name_val = m.get("name", "")
            
            chap_val = m.get("chapter", 0)
            if isinstance(chap_val, str) and chap_val.isdigit():
                chap_val = int(chap_val)
            elif not isinstance(chap_val, int):
                chap_val = 0
                
            verse_val = m.get("verse", 0)
            if isinstance(verse_val, str) and verse_val.isdigit():
                verse_val = int(verse_val)
            elif not isinstance(verse_val, int):
                verse_val = 0
            return (type_order, name_val, chap_val, verse_val)
            
        combined.sort(key=sort_key)
        
        return {
            "ids": [item[0] for item in combined],
            "documents": [item[1] for item in combined],
            "metadatas": [item[2] for item in combined]
        }

    def search_semantic(self, query, n_results=5, doc_type=None, where_clause=None, embedding_model="gemini-embedding-2"):
        collection = self.get_collection(embedding_model)
        if "infomaniak" in embedding_model or "bge" in embedding_model or "mini_lm" in embedding_model:
            provider = "infomaniak"
            key = self.api_keys.get("infomaniak") or self.api_keys.get("infomaniak_token")
            product_id = self.api_keys.get("infomaniak_product_id", "251")
        elif "gemini" in embedding_model:
            provider = "gemini"
            key = self.api_keys.get("gemini") or self.api_keys.get("gemini_api_key")
            product_id = None
        else:
            provider = "mistral"
            key = self.api_keys.get("mistral") or self.api_keys.get("mistral_api_key")
            product_id = None

        if not key:
            raise Exception(f"Clé/Token API manquant pour {provider}")
            
        llm = LLMClient(api_key=key, provider=provider, product_id=product_id)
        query_embedding = llm.get_embeddings([query], model=embedding_model)[0]
        
        where = where_clause
        if not where and doc_type:
            where = {"type": doc_type}
            
        return collection.query(
            query_embeddings=[query_embedding],
            n_results=n_results,
            where=where,
            include=["metadatas", "documents", "distances"]
        )
