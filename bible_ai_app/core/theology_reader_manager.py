import os
import re
import html
import logging
from typing import Dict, List, Any, Optional, Tuple
import chromadb
from gui.library_utils import load_books_metadata
from core.reference_parser import get_french_book_name

logger = logging.getLogger(__name__)

class TheologyReaderManager:
    """
    Gestionnaire central pour la lecture des ouvrages de théologie,
    manuels bibliques et commentaires thématiques indexés dans ChromaDB / EPUB.
    """

    _chroma_client = None

    @classmethod
    def get_chroma_client(cls, persist_directory: str = "./data/chroma_db"):
        if cls._chroma_client is None:
            os.makedirs(persist_directory, exist_ok=True)
            cls._chroma_client = chromadb.PersistentClient(path=persist_directory)
        return cls._chroma_client

    @classmethod
    def get_all_theology_books(cls) -> List[Dict[str, Any]]:
        """
        Retourne la liste des ouvrages de type Théologie ou équivalents
        avec leurs métadonnées, couvertures et informations de chapitres.
        """
        from webview_app import get_cover_data_url
        
        registry = load_books_metadata()
        theology_books = []
        
        # Collections ChromaDB potentielles
        client = cls.get_chroma_client()
        chroma_book_names = set()
        for col_name in ['bible_study_bge_multilingual_gemma2_Infomaniak', 'study_library', 'bible_study_gemini_embedding_2']:
            try:
                col = client.get_collection(col_name)
                res = col.get(include=['metadatas'])
                for m in res.get('metadatas', []):
                    n = m.get('name') or m.get('title')
                    if n:
                        chroma_book_names.add(n)
            except Exception:
                pass

        for name, meta in registry.items():
            b_type = str(meta.get("type", "")).strip().lower()
            is_theology = (
                b_type in ["théologie", "theologie", "théologique", "theology", "étude", "etude", "doctrine", "introduction"]
                or meta.get("source_type") in ["systematic_theology", "biblical_theology", "general", "nt_context", "ot_context", "book_intro"]
                or name in ["STGru", "Lire/Comprendre", "Paradoxes", "LirelaBibles", "NIV", "NIV Cultural", "MacArthur BC", "NIVArchaeo", "TSM"]
            )
            
            # Si le livre est actif ou indexé
            if is_theology and (meta.get("active", True) or name in chroma_book_names):
                cov_p = meta.get("cover_path")
                data_url = get_cover_data_url(cov_p)
                
                title = meta.get("title") or name
                author = meta.get("author") or ""
                year = meta.get("year") or ""
                desc = meta.get("description") or ""
                chapters_cnt = meta.get("chapters_count") or 0
                corpus_scope = meta.get("corpus_scope") or "GLOBAL"
                source_type = meta.get("source_type") or "general"
                embedding_model = meta.get("embedding_model") or "bge_multilingual_gemma2 (Infomaniak)"
                
                theology_books.append({
                    "id": name,
                    "name": name,
                    "title": title,
                    "author": author,
                    "year": year,
                    "description": desc,
                    "chapters_count": chapters_cnt,
                    "corpus_scope": corpus_scope,
                    "source_type": source_type,
                    "cover_url": data_url,
                    "cover_data_url": data_url,
                    "embedding_model": embedding_model,
                    "active": meta.get("active", True)
                })

        # Trier par titre
        theology_books.sort(key=lambda x: x["title"].lower())
        return theology_books

    @classmethod
    def get_book_toc(cls, book_name: str) -> Dict[str, Any]:
        """
        Récupère la table des matières (TOC) d'un livre de théologie
        ordonnée par chapitre croissant.
        """
        client = cls.get_chroma_client()
        chapters_dict = {}

        for col_name in ['bible_study_bge_multilingual_gemma2_Infomaniak', 'study_library', 'bible_study_gemini_embedding_2']:
            try:
                col = client.get_collection(col_name)
                res = col.get(where={"name": book_name}, include=['metadatas'])
                if res and res.get('metadatas'):
                    for m in res['metadatas']:
                        cid = m.get('chapter_id')
                        if cid is not None:
                            try:
                                cid_int = int(cid)
                            except (ValueError, TypeError):
                                cid_int = cid
                                
                            ctitle = m.get('chapter_title') or f"Chapitre {cid_int}"
                            # Nettoyer l'encodage éventuel
                            ctitle = cls._clean_text_encoding(ctitle)
                            
                            b_code = m.get('book_code')
                            b_name = get_french_book_name(b_code) if b_code else None
                            
                            if cid_int not in chapters_dict:
                                chapters_dict[cid_int] = {
                                    "chapter_id": cid_int,
                                    "title": ctitle,
                                    "book_code": b_code,
                                    "book_name": b_name,
                                    "corpus_scope": m.get('corpus_scope', 'GLOBAL'),
                                    "source_type": m.get('source_type', 'general'),
                                    "chunks_count": 0
                                }
                            chapters_dict[cid_int]["chunks_count"] += 1
            except Exception as e:
                logger.debug(f"[TheologyReaderManager] Recherche TOC {col_name} : {e}")

        # Si trouvé, ordonner la liste des chapitres
        sorted_chapters = []
        for cid in sorted(chapters_dict.keys(), key=lambda x: (int(x) if str(x).isdigit() else 999, str(x))):
            sorted_chapters.append(chapters_dict[cid])

        # Métadonnées du livre
        registry = load_books_metadata()
        book_meta = registry.get(book_name, {})
        from webview_app import get_cover_data_url
        cov_data_url = get_cover_data_url(book_meta.get("cover_path"))

        return {
            "book_name": book_name,
            "title": book_meta.get("title", book_name),
            "author": book_meta.get("author", ""),
            "year": book_meta.get("year", ""),
            "description": book_meta.get("description", ""),
            "cover_url": cov_data_url,
            "total_chapters": len(sorted_chapters),
            "chapters": sorted_chapters
        }

    @classmethod
    def get_chapter_content(cls, book_name: str, chapter_id: int) -> Dict[str, Any]:
        """
        Récupère et assemble le contenu intégral d'un chapitre d'ouvrage de théologie,
        avec détection des versets cités et contexte de navigation.
        """
        client = cls.get_chroma_client()
        chunks = []
        chapter_meta = {}
        all_referenced_verses = set()
        all_referenced_books = set()

        try:
            cid_query = int(chapter_id)
        except (ValueError, TypeError):
            cid_query = chapter_id

        for col_name in ['bible_study_bge_multilingual_gemma2_Infomaniak', 'study_library', 'bible_study_gemini_embedding_2']:
            try:
                col = client.get_collection(col_name)
                # Requête ChromaDB
                res = col.get(
                    where={"$and": [{"name": book_name}, {"chapter_id": cid_query}]},
                    include=['metadatas', 'documents']
                )
                if res and res.get('ids') and len(res['ids']) > 0:
                    for i in range(len(res['ids'])):
                        c_id = res['ids'][i]
                        m = res['metadatas'][i]
                        doc = res['documents'][i]
                        
                        if not chapter_meta and m:
                            chapter_meta = m
                            
                        # Versets référencés
                        rv = m.get('referenced_verses', '')
                        if rv:
                            for v_item in str(rv).split(','):
                                v_clean = v_item.strip()
                                if v_clean:
                                    all_referenced_verses.add(v_clean)
                                    
                        rb = m.get('referenced_books', '')
                        if rb:
                            for b_item in str(rb).split(','):
                                b_clean = b_item.strip()
                                if b_clean:
                                    all_referenced_books.add(b_clean)

                        chunks.append((c_id, m, doc))
            except Exception as e:
                logger.debug(f"[TheologyReaderManager] Recherche content {col_name} : {e}")

        # Déterminer l'ordre des chunks
        def extract_chunk_idx(item):
            c_id = item[0]
            # Pattern: <name>_ch<chapter>_<index>
            m = re.search(r'_(\d+)$', str(c_id))
            if m:
                return int(m.group(1))
            return 0

        chunks.sort(key=extract_chunk_idx)

        # Nettoyage et assemblage des paragraphes
        paragraphs = []
        full_text_parts = []
        
        for c_id, m, doc in chunks:
            # Supprimer l'en-tête [Source: ...]
            cleaned = re.sub(r'^\[Source:[^\]]*\]\s*', '', doc).strip()
            cleaned = cls._clean_text_encoding(cleaned)
            if cleaned:
                full_text_parts.append(cleaned)
                # Découper en paragraphes pour le rendu HTML
                paras = cleaned.split('\n\n')
                for p in paras:
                    p_str = p.strip()
                    if p_str:
                        paragraphs.append(p_str)

        full_raw_text = "\n\n".join(full_text_parts)

        # Calculer le temps de lecture estimé (environ 200 mots/min)
        word_count = len(re.findall(r'\w+', full_raw_text))
        reading_time_min = max(1, round(word_count / 200))

        # Obtenir la liste ordonnée des chapitres pour la navigation Précédent / Suivant
        toc_info = cls.get_book_toc(book_name)
        chapters_list = toc_info.get("chapters", [])
        
        current_idx = -1
        for idx, ch in enumerate(chapters_list):
            if str(ch["chapter_id"]) == str(chapter_id):
                current_idx = idx
                break

        prev_chapter = chapters_list[current_idx - 1] if current_idx > 0 else None
        next_chapter = chapters_list[current_idx + 1] if 0 <= current_idx < len(chapters_list) - 1 else None

        ch_title = chapter_meta.get("chapter_title") or (chapters_list[current_idx]["title"] if current_idx >= 0 else f"Chapitre {chapter_id}")
        ch_title = cls._clean_text_encoding(ch_title)

        # Livre biblique associé éventuel
        book_code = chapter_meta.get("book_code") or (chapters_list[current_idx].get("book_code") if current_idx >= 0 else None)
        book_french_name = get_french_book_name(book_code) if book_code else None

        registry = load_books_metadata()
        book_meta = registry.get(book_name, {})
        from webview_app import get_cover_data_url
        cov_data_url = get_cover_data_url(book_meta.get("cover_path"))

        # Formater les références de versets
        sorted_verses = sorted(list(all_referenced_verses))
        sorted_books = sorted(list(all_referenced_books))

        return {
            "success": True,
            "book_name": book_name,
            "book_title": book_meta.get("title", book_name),
            "book_author": book_meta.get("author", ""),
            "book_year": book_meta.get("year", ""),
            "cover_url": cov_data_url,
            "chapter_id": chapter_id,
            "chapter_title": ch_title,
            "book_code": book_code,
            "book_french_name": book_french_name,
            "paragraphs": paragraphs,
            "raw_text": full_raw_text,
            "word_count": word_count,
            "reading_time_min": reading_time_min,
            "referenced_verses": sorted_verses,
            "referenced_books": sorted_books,
            "prev_chapter": prev_chapter,
            "next_chapter": next_chapter,
            "current_index": current_idx + 1,
            "total_chapters": len(chapters_list)
        }

    @classmethod
    def synthesize_chapter(cls, book_name: str, chapter_id: int, model: Optional[str] = None, config: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Génère une synthèse théologique approfondie du chapitre avec l'IA.
        """
        from ai.llm_client import LLMClient
        from ai.gemini_client import GeminiClient
        from core.config import load_config
        
        cfg = config or load_config()
        ch_data = cls.get_chapter_content(book_name, chapter_id)
        
        if not ch_data or not ch_data.get("raw_text"):
            return {"success": False, "error": "Contenu du chapitre introuvable pour la synthèse."}

        book_title = ch_data.get("book_title", book_name)
        author = ch_data.get("book_author", "")
        ch_title = ch_data.get("chapter_title", f"Chapitre {chapter_id}")
        raw_text = ch_data.get("raw_text", "")
        
        # Limiter le contexte à 25 000 caractères pour ne pas saturer la fenêtre
        text_excerpt = raw_text[:25000]

        selected_model = model or cfg.get("chat_model", "gemini-3.7-flash")

        system_prompt = (
            "Tu es un théologien et universitaire de haut niveau, expert en exégèse, théologie systématique et pastorale.\n"
            "Ton rôle est de produire une synthèse magistrale, claire, structurée et hautement pédagogique d'un chapitre d'ouvrage théologique."
        )

        user_prompt = f"""Rédige une synthèse théologique complète et structurée du chapitre suivant :

Ouvrage : **{book_title}** {f'({author})' if author else ''}
Chapitre : **{ch_title}**

TEXTE DU CHAPITRE :
\"\"\"{text_excerpt}\"\"\"

Structure demandée pour la synthèse :
### 📌 1. Thèse centrale & Enjeux théologiques
(Présente en 2 ou 3 paragraphes l'argument principal de l'auteur et les questions doctrinales / existentielles traitées).

### 🔍 2. Articulations & Développements doctrinaux majeurs
(Présente les points clés sous forme de liste commentée avec rigueur et profondeur).

### 📖 3. Fondements bibliques & Textes clés
(Dégage les passages de l'Écriture centraux mentionnés et la manière dont l'auteur les interprète).

### 💡 4. Applications pratiques & Perspectives pastorales
(Quelles implications pour la vie de foi, l'Église, la réflexion éthique ou la prédication ?).

Règles de style :
- Rédaction en français soigné, élégant et précis.
- Utilise les balises Markdown avec sous-titres, gras et puces.
"""

        try:
            # Résoudre le provider
            if "mistral" in selected_model.lower():
                provider = "mistral"
                api_key = cfg.get("mistral_api_key", "")
                product_id = None
            elif "infomaniak" in selected_model.lower() or "ministral" in selected_model.lower():
                provider = "infomaniak"
                api_key = cfg.get("infomaniak_token", "")
                product_id = cfg.get("infomaniak_product_id", "251")
            else:
                provider = "gemini"
                api_key = cfg.get("gemini_api_key", "")
                product_id = None

            if api_key:
                client = LLMClient(api_key=api_key, model=selected_model, provider=provider, product_id=product_id)
                response_text = client.ask_question(
                    context="",
                    question=user_prompt,
                    system_prompt=system_prompt,
                    model=selected_model
                )
            else:
                g_client = GeminiClient()
                response_text = g_client.generate_response(f"{system_prompt}\n\n{user_prompt}")

            return {
                "success": True,
                "book_name": book_name,
                "chapter_id": chapter_id,
                "chapter_title": ch_title,
                "synthesis_markdown": response_text,
                "model_used": selected_model
            }
        except Exception as e:
            logger.error(f"[TheologyReaderManager] Erreur synthèse IA : {e}")
            return {
                "success": False,
                "error": f"Erreur lors de la génération de la synthèse : {e}"
            }

    @classmethod
    def search_theology_books(cls, query: str, book_name: Optional[str] = None, limit: int = 40) -> List[Dict[str, Any]]:
        """
        Recherche plein-texte / sémantique dans les ouvrages de théologie.
        """
        if not query or not query.strip():
            return []

        client = cls.get_chroma_client()
        results = []
        q_lower = query.lower().strip()

        registry = load_books_metadata()

        for col_name in ['bible_study_bge_multilingual_gemma2_Infomaniak', 'study_library', 'bible_study_gemini_embedding_2']:
            try:
                col = client.get_collection(col_name)
                where_clause = {"name": book_name} if book_name else None
                res = col.get(where=where_clause, include=['metadatas', 'documents'])
                
                if res and res.get('ids'):
                    for i in range(len(res['ids'])):
                        doc = res['documents'][i]
                        m = res['metadatas'][i]
                        
                        b_name = m.get('name') or m.get('title')
                        if not b_name:
                            continue
                            
                        doc_clean = cls._clean_text_encoding(doc)
                        
                        if q_lower in doc_clean.lower():
                            # Trouver l'extrait autour du match
                            idx = doc_clean.lower().find(q_lower)
                            start = max(0, idx - 80)
                            end = min(len(doc_clean), idx + len(query) + 120)
                            snippet = ("..." if start > 0 else "") + doc_clean[start:end].replace('\n', ' ') + ("..." if end < len(doc_clean) else "")
                            
                            b_meta = registry.get(b_name, {})
                            
                            results.append({
                                "book_name": b_name,
                                "book_title": b_meta.get("title", b_name),
                                "book_author": b_meta.get("author", ""),
                                "chapter_id": m.get("chapter_id", 1),
                                "chapter_title": cls._clean_text_encoding(m.get("chapter_title", "")),
                                "snippet": snippet,
                                "chunk_id": res['ids'][i]
                            })
                            if len(results) >= limit:
                                break
            except Exception as e:
                logger.debug(f"[TheologyReaderManager] Recherche query error : {e}")

        return results[:limit]

    @staticmethod
    def _clean_text_encoding(text: str) -> str:
        """Nettoie les artefacts d'encodage (ex:  -> accents français courants si détectables)."""
        if not text:
            return ""
        # Remplacements basiques des encodages tronqués courants
        cleaned = text.replace('\ufffd', "'")
        return cleaned
