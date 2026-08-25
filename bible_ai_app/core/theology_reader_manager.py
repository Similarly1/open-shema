import os
os.environ["ANONYMIZED_TELEMETRY"] = "False"
import re
import html
import logging
from typing import Dict, List, Any, Optional, Tuple
import chromadb
from chromadb.config import Settings
from gui.library_utils import load_books_metadata
from core.reference_parser import get_french_book_name, strip_accents

logger = logging.getLogger(__name__)

class TheologyReaderManager:
    """
    Gestionnaire central pour la lecture des ouvrages de théologie,
    manuels bibliques et commentaires thématiques indexés dans ChromaDB / EPUB.
    """

    _chroma_client = None
    _books_cache = None
    _toc_cache = {}
    _chapter_cache = {}
    _passage_theology_cache = {}
    _bible_book_index = None

    @classmethod
    def get_chroma_client(cls, persist_directory: str = "./data/chroma_db"):
        if cls._chroma_client is None:
            os.makedirs(persist_directory, exist_ok=True)
            cls._chroma_client = chromadb.PersistentClient(
                path=persist_directory,
                settings=Settings(anonymized_telemetry=False)
            )
        return cls._chroma_client

    @classmethod
    def invalidate_cache(cls):
        """Réinitialise les caches en mémoire si la bibliothèque change."""
        cls._books_cache = None
        cls._toc_cache.clear()
        cls._chapter_cache.clear()
        cls._passage_theology_cache.clear()
        cls._bible_book_index = None
        try:
            from core.epub_loader import EpubLoader
            EpubLoader.invalidate_cache()
        except Exception:
            pass

    @classmethod
    def get_all_theology_books(cls, force_refresh: bool = False) -> List[Dict[str, Any]]:
        """
        Retourne instantanément la liste des ouvrages de type Théologie ou équivalents
        avec leurs métadonnées, couvertures et informations de chapitres.
        """
        if cls._books_cache is not None and not force_refresh:
            return cls._books_cache

        from webview_app import get_cover_data_url
        
        registry = load_books_metadata()
        theology_books = []

        for name, meta in registry.items():
            b_type = str(meta.get("type", "")).strip().lower()
            is_theology = (
                b_type in ["théologie", "theologie", "théologique", "theology", "étude", "etude", "doctrine", "introduction"]
                or meta.get("source_type") in ["systematic_theology", "biblical_theology", "general", "nt_context", "ot_context", "book_intro"]
                or meta.get("chapters_count", 0) > 0
                or name in ["STGru", "Lire/Comprendre", "Paradoxes", "LirelaBibles", "NIV", "NIV Cultural", "MacArthur BC", "NIVArchaeo", "TSM"]
            )
            
            # Ne pas inclure les Bibles simples dans les livres de théologie
            if b_type in ["bible", "bibles", "audio"]:
                is_theology = False

            if is_theology:
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
        cls._books_cache = theology_books
        return theology_books

    @classmethod
    def get_book_toc(cls, book_name: str) -> Dict[str, Any]:
        """
        Récupère la table des matières (TOC) d'un livre de théologie
        ordonnée par chapitre croissant (avec mise en cache mémoire).
        """
        if book_name in cls._toc_cache:
            return cls._toc_cache[book_name]

        chapters_dict = {}

        # 1. Vérifier si un fichier EPUB existe (analyse directe ultra-rapide)
        registry = load_books_metadata()
        book_meta = registry.get(book_name, {})
        fpath = book_meta.get("file_path", "")

        if fpath and os.path.exists(fpath) and fpath.lower().endswith(".epub"):
            try:
                from core.epub_loader import EpubLoader
                inspect_data = EpubLoader.inspect_epub(fpath)
                for ch in inspect_data.get("chapters", []):
                    cid = ch.get("id", 0)
                    is_sec = ch.get("is_section_header", False)
                    depth = ch.get("depth", 0)
                    b_code = ch.get("book_code")
                    b_name = get_french_book_name(b_code) if b_code else None
                    chapters_dict[cid] = {
                        "chapter_id": cid,
                        "title": cls._clean_text_encoding(ch.get("title") or f"Chapitre {cid}"),
                        "book_code": b_code,
                        "book_name": b_name,
                        "corpus_scope": ch.get("corpus_scope", "GLOBAL"),
                        "source_type": ch.get("source_type", "general"),
                        "depth": depth,
                        "is_section_header": is_sec,
                        "zip_file": ch.get("zip_file", ""),
                        "chunks_count": 1 if not is_sec else 0
                    }
            except Exception as e:
                logger.warning(f"[TheologyReaderManager] Erreur analyse directe EPUB TOC pour {book_name}: {e}")

        # 2. Fallback ChromaDB si aucun chapitre n'a été trouvé via l'EPUB
        if not chapters_dict:
            client = cls.get_chroma_client()
            collections_to_search = ['bible_study_bge_multilingual_gemma2_Infomaniak', 'bible_study_gemini_embedding_2']

            for col_name in collections_to_search:
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
                                        "depth": m.get('depth', 0),
                                        "is_section_header": m.get('is_section_header', False),
                                        "chunks_count": 0
                                    }
                                chapters_dict[cid_int]["chunks_count"] += 1
                except Exception as e:
                    logger.debug(f"[TheologyReaderManager] Recherche TOC ChromaDB {col_name} : {e}")

        is_part_regex = re.compile(
            r'^((premier|premiere|deuxieme|troisieme|quatrieme|cinquieme|sixieme|septieme|huitieme|neuvieme|dixieme|[0-9]+(ere|eme|re|er|e)?)\s+(partie|section|volume|tome|livre)|(partie|part|section|volume|tome|livre|book)\s+([0-9ivxlcdm]+|[a-z]+))\b',
            re.IGNORECASE
        )

        # Si trouvé, ordonner la liste des chapitres
        sorted_chapters = []
        for cid in sorted(chapters_dict.keys(), key=lambda x: (int(x) if str(x).isdigit() else 999, str(x))):
            item = chapters_dict[cid]
            ctitle = item.get("title", "")
            norm_title = strip_accents(ctitle)
            is_part = bool(
                item.get("is_section_header") or 
                (is_part_regex.match(norm_title) and not re.match(r'^(chapter|chapitre)\b', norm_title, re.IGNORECASE))
            )
            item["is_section_header"] = is_part
            sorted_chapters.append(item)

        # Attacher le titre de section parent aux chapitres enfants
        cur_section = None
        for c in sorted_chapters:
            if c.get("is_section_header"):
                cur_section = c["title"]
            else:
                c["section_title"] = cur_section

        # Métadonnées du livre
        registry = load_books_metadata()
        book_meta = registry.get(book_name, {})
        from webview_app import get_cover_data_url
        cov_data_url = get_cover_data_url(book_meta.get("cover_path"))

        readable_count = len([c for c in sorted_chapters if not c.get("is_section_header")])

        result = {
            "book_name": book_name,
            "title": book_meta.get("title", book_name),
            "author": book_meta.get("author", ""),
            "year": book_meta.get("year", ""),
            "description": book_meta.get("description", ""),
            "cover_url": cov_data_url,
            "total_chapters": readable_count,
            "chapters": sorted_chapters
        }
        cls._toc_cache[book_name] = result
        return result

    @classmethod
    def get_chapter_content(cls, book_name: str, chapter_id: int) -> Dict[str, Any]:
        """
        Récupère et assemble le contenu intégral d'un chapitre d'ouvrage de théologie,
        avec détection des versets cités et contexte de navigation.
        """
        try:
            cid_query = int(chapter_id)
        except (ValueError, TypeError):
            cid_query = chapter_id

        cache_key = (book_name, cid_query)
        if cache_key in cls._chapter_cache:
            return cls._chapter_cache[cache_key]

        client = cls.get_chroma_client()
        chunks = []
        chapter_meta = {}
        all_referenced_verses = set()
        all_referenced_books = set()
        registry = load_books_metadata()
        book_meta = registry.get(book_name, {})
        fpath = book_meta.get("file_path", "")

        # 1. Priorité à la lecture directe du fichier EPUB original (texte intégral fidèle, notes exactes, sans césure RAG)
        if fpath and os.path.exists(fpath) and fpath.lower().endswith(".epub"):
            try:
                import zipfile
                from bs4 import BeautifulSoup
                from core.epub_loader import EpubLoader
                inspect_data = EpubLoader.inspect_epub(fpath)
                ch_info = next((c for c in inspect_data.get("chapters", []) if c.get("id") == cid_query), None)
                if ch_info and ch_info.get("zip_file"):
                    with zipfile.ZipFile(fpath, 'r') as z:
                        if ch_info["zip_file"] in z.namelist():
                            html_content = z.read(ch_info["zip_file"]).decode('utf-8', errors='ignore')
                            soup = BeautifulSoup(html_content, 'html.parser')
                            for tag in soup(["script", "style", "nav"]):
                                tag.decompose()
                            
                            for p_tag in soup.find_all(attrs={"class": lambda c: c and any(k in str(c).lower() for k in ["page-papier", "page_papier", "pagenum", "pagebreak", "page-number"])}):
                                p_tag.decompose()

                            direct_paragraphs = []
                            # Convertir les appels de notes (sup, a noteref, etc.) en marqueurs propres [^n]
                            for fn_ref in soup.find_all(["sup", "a"]):
                                is_fn = False
                                if fn_ref.name == "sup":
                                    is_fn = True
                                elif fn_ref.get("epub:type") == "noteref" or "footnote" in str(fn_ref.get("class", [])).lower() or "noteref" in str(fn_ref.get("class", [])).lower():
                                    is_fn = True
                                elif fn_ref.get("href") and ("#fn" in fn_ref.get("href", "").lower() or "#note" in fn_ref.get("href", "").lower() or "note" in fn_ref.get("href", "").lower() or "footnote" in fn_ref.get("href", "").lower()):
                                    is_fn = True
                                
                                if is_fn:
                                    fn_txt = fn_ref.get_text(strip=True)
                                    fn_clean = re.sub(r'[^\w\d]', '', fn_txt)
                                    if fn_clean and (fn_clean.isdigit() or len(fn_clean) <= 4):
                                        fn_ref.replace_with(f" [^{fn_clean}] ")

                            for el in soup.find_all(["h1", "h2", "h3", "h4", "h5", "h6", "p", "li", "blockquote", "aside"]):
                                tag_name = el.name.lower()
                                classes = " ".join(el.get("class", [])) if el.get("class") else ""
                                classes_lower = classes.lower()

                                is_h1 = tag_name == "h1" or "chapter-title" in classes_lower or "ch-title" in classes_lower
                                is_h2 = tag_name == "h2" or "section-title" in classes_lower or "part-title" in classes_lower or "titre-niveau-1" in classes_lower
                                is_h3 = tag_name == "h3" or "subsection-title" in classes_lower or "subheading" in classes_lower or "titre-niveau-2" in classes_lower
                                is_h4 = tag_name in ["h4", "h5", "h6"] or "rubrique" in classes_lower or "titre-niveau-3" in classes_lower

                                if not (is_h1 or is_h2 or is_h3 or is_h4) and tag_name in ["p", "div"]:
                                    if any(k in classes_lower for k in ["title", "titre", "heading", "head", "subhead"]):
                                        is_h3 = True

                                txt = el.get_text(separator=" ", strip=True)
                                if not txt or txt == "[Retour au livre]" or len(txt) < 2:
                                    continue

                                txt = re.sub(r'\s*\[\^(\d+)\]\s*', r' [^\1] ', txt)
                                txt = re.sub(r'[ \t]+', ' ', txt).strip()

                                is_footnote_def = False
                                if "footnote" in classes_lower or "note" in classes_lower or el.get("epub:type") == "footnote" or tag_name == "aside":
                                    is_footnote_def = True
                                elif re.match(r'^(?:\[\^?(\d+)\]|\b(\d+)\b)\s*(.+)', txt) and ("n.d.t" in txt.lower() or "n.d.e" in txt.lower() or "http" in txt.lower() or len(txt) < 300):
                                    is_footnote_def = True

                                if is_footnote_def:
                                    m_fn = re.match(r'^(?:\[\^?(\d+)\]|\b(\d+)\b)\s*(.*)', txt)
                                    if m_fn:
                                        fn_id = m_fn.group(1) or m_fn.group(2)
                                        fn_body = m_fn.group(3)
                                        txt = f"[^{fn_id}]: {fn_body.strip()}"
                                elif is_h1:
                                    txt = f"# {txt}"
                                elif is_h2:
                                    txt = f"## {txt}"
                                elif is_h3:
                                    txt = f"### {txt}"
                                elif is_h4:
                                    txt = f"#### {txt}"
                                elif tag_name == "blockquote":
                                    txt = f"> {txt}"

                                direct_paragraphs.append(txt)

                            if not direct_paragraphs:
                                full_txt = soup.get_text(separator="\n", strip=True)
                                direct_paragraphs = [p.strip() for p in full_txt.split("\n") if p.strip()]
                            
                            for idx_p, p_text in enumerate(direct_paragraphs):
                                chunks.append((f"{book_name}_direct_{idx_p}", {
                                    "chapter_title": ch_info.get("title", ""),
                                    "name": book_name,
                                    "title": book_meta.get("title", book_name),
                                    "author": book_meta.get("author", "")
                                }, p_text))
                            
                            chapter_meta = {
                                "chapter_title": ch_info.get("title", ""),
                                "name": book_name,
                                "title": book_meta.get("title", book_name),
                                "author": book_meta.get("author", "")
                            }
            except Exception as e:
                logger.warning(f"Direct EPUB chapter read error: {e}")

        # 2. Fallback ChromaDB si le fichier source n'est pas sur le disque
        if not chunks:
            collections_to_search = []
            try:
                for c in client.list_collections():
                    c_name = c.name if hasattr(c, 'name') else str(c)
                    collections_to_search.append(c_name)
            except Exception:
                collections_to_search = ['bible_study_bge_multilingual_gemma2_Infomaniak', 'study_library', 'bible_study_gemini_embedding_2']

            for col_name in collections_to_search:
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
        raw_paragraphs = []
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
                        raw_paragraphs.append(p_str)

        full_raw_text = "\n\n".join(full_text_parts)

        # Extraction structurée des notes de bas de page et séparation du corps de texte
        body_paragraphs = []
        footnotes = []
        seen_fn_ids = set()

        # 1ère passe : identifier les notes explicites [^n]: ...
        for p in raw_paragraphs:
            m_fn_exp = re.match(r'^\[\^(\d+)\]:\s*(.+)', p, flags=re.DOTALL)
            if m_fn_exp:
                fn_id = m_fn_exp.group(1)
                fn_text = m_fn_exp.group(2).strip()
                if fn_id not in seen_fn_ids:
                    seen_fn_ids.add(fn_id)
                    footnotes.append({"id": fn_id, "text": fn_text})
            else:
                body_paragraphs.append(p)

        # 2ème passe : si pas de notes explicites, détecter les notes implicites en fin de chapitre
        # (ex: "1 Hidden tribes signifie...", "2 Sa branche...", etc.)
        if not footnotes and body_paragraphs:
            trailing_notes = []
            cut_idx = len(body_paragraphs)
            
            for i in range(len(body_paragraphs) - 1, -1, -1):
                p_cand = body_paragraphs[i]
                m_num = re.match(r'^(?:\[(\d+)\]|(\d+))\s*[\.\-\)]?\s+(.+)', p_cand, flags=re.DOTALL)
                if m_num:
                    fn_id = m_num.group(1) or m_num.group(2)
                    fn_text = m_num.group(3).strip()
                    is_note_like = (
                        len(fn_text) < 400 or
                        "n.d.t" in fn_text.lower() or 
                        "n.d.e" in fn_text.lower() or 
                        "http" in fn_text.lower() or 
                        "voir " in fn_text.lower() or
                        "page " in fn_text.lower() or
                        len(trailing_notes) > 0
                    )
                    if is_note_like:
                        trailing_notes.insert(0, {"id": fn_id, "text": fn_text})
                        cut_idx = i
                    else:
                        break
                else:
                    break
            
            if trailing_notes:
                body_paragraphs = body_paragraphs[:cut_idx]
                footnotes = trailing_notes

        # 3ème passe : nettoyer les numéros de page papier résiduels et normaliser les appels de notes
        fn_ids_set = set(str(f["id"]) for f in footnotes)
        fn_ids_list = sorted(list(fn_ids_set), key=lambda x: -len(x))
        
        normalized_body = []
        for p in body_paragraphs:
            p_mod = p
            
            # Nettoyer les numéros de pages papier résiduels entre crochets (ex: [14], [9]) qui ne sont pas des notes
            for m in re.finditer(r'\[(\d+)\]', p_mod):
                num_cand = m.group(1)
                if num_cand not in fn_ids_set:
                    p_mod = p_mod.replace(m.group(0), '')
            p_mod = re.sub(r'[ \t]+', ' ', p_mod).strip()

            if footnotes:
                for fid in fn_ids_list:
                    # 1. Déjà entre crochets: [fid] ou [^fid]
                    p_mod = re.sub(r'\[\^?' + fid + r'\]', f' [^{fid}] ', p_mod)
                    # 2. Après ponctuation ou guillemets: » 67 ou . 67
                    p_mod = re.sub(r'([»\.\!\?:\,])\s*(\b' + fid + r'\b)(?=\s+[A-ZÀ-Ÿa-z])', r'\1 [^\2] ', p_mod)
                    # 3. Avant ponctuation ou en fin de mot: écoute67. ou écoute 67. ou mot 67,
                    p_mod = re.sub(r'(\b[A-ZÀ-Ÿa-z]+)\s*(\b' + fid + r'\b)(?=\s*[\.\!\?:\,])', r'\1 [^\2] ', p_mod)
                    # 4. Collé directement à un mot: écoute67
                    p_mod = re.sub(r'(\b[A-ZÀ-Ÿa-z]+)(' + fid + r')(?=[\s\.\!\?:\,]|$)', r'\1 [^\2] ', p_mod)
                
                # Nettoyer les espaces superflus autour des marqueurs
                p_mod = re.sub(r'\s*\[\^(\d+)\]\s*', r' [^\1] ', p_mod)
                p_mod = re.sub(r'[ \t]+', ' ', p_mod).strip()

            normalized_body.append(p_mod)
        body_paragraphs = normalized_body

        # Calculer le temps de lecture estimé (environ 200 mots/min)
        word_count = len(re.findall(r'\w+', full_raw_text))
        reading_time_min = max(1, round(word_count / 200))

        # Obtenir la liste ordonnée des chapitres pour la navigation Précédent / Suivant (en sautant les intertitres de parties)
        toc_info = cls.get_book_toc(book_name)
        chapters_list = toc_info.get("chapters", [])
        readable_chapters = [c for c in chapters_list if not c.get("is_section_header")]
        
        current_readable_idx = -1
        for idx, ch in enumerate(readable_chapters):
            if str(ch["chapter_id"]) == str(chapter_id):
                current_readable_idx = idx
                break

        if current_readable_idx >= 0:
            prev_chapter = readable_chapters[current_readable_idx - 1] if current_readable_idx > 0 else None
            next_chapter = readable_chapters[current_readable_idx + 1] if current_readable_idx < len(readable_chapters) - 1 else None
            cur_idx_display = current_readable_idx + 1
        else:
            # Si on a ouvert directement une page d'intertitre, lier vers le prochain chapitre lisible
            cid_val = int(chapter_id) if str(chapter_id).isdigit() else 0
            next_readable = next((c for c in readable_chapters if int(c["chapter_id"]) > cid_val), None)
            prev_readable = next((c for c in reversed(readable_chapters) if int(c["chapter_id"]) < cid_val), None)
            prev_chapter = prev_readable
            next_chapter = next_readable
            cur_idx_display = 1

        target_ch_info = next((c for c in chapters_list if str(c["chapter_id"]) == str(chapter_id)), {})
        section_title = target_ch_info.get("section_title")

        ch_title = chapter_meta.get("chapter_title") or target_ch_info.get("title") or f"Chapitre {chapter_id}"
        ch_title = cls._clean_text_encoding(ch_title)

        # Livre biblique associé éventuel
        book_code = chapter_meta.get("book_code") or target_ch_info.get("book_code")
        book_french_name = get_french_book_name(book_code) if book_code else None

        registry = load_books_metadata()
        book_meta = registry.get(book_name, {})
        from webview_app import get_cover_data_url
        cov_data_url = get_cover_data_url(book_meta.get("cover_path"))

        # Formater les références de versets
        sorted_verses = sorted(list(all_referenced_verses))
        sorted_books = sorted(list(all_referenced_books))

        res_dict = {
            "success": True,
            "book_name": book_name,
            "book_title": book_meta.get("title", book_name),
            "book_author": book_meta.get("author", ""),
            "book_year": book_meta.get("year", ""),
            "cover_url": cov_data_url,
            "chapter_id": chapter_id,
            "chapter_title": ch_title,
            "section_title": section_title,
            "book_code": book_code,
            "book_french_name": book_french_name,
            "paragraphs": body_paragraphs,
            "footnotes": footnotes,
            "raw_text": full_raw_text,
            "word_count": word_count,
            "reading_time_min": reading_time_min,
            "referenced_verses": sorted_verses,
            "referenced_books": sorted_books,
            "prev_chapter": prev_chapter,
            "next_chapter": next_chapter,
            "current_index": cur_idx_display,
            "total_chapters": len(readable_chapters)
        }
        cls._chapter_cache[cache_key] = res_dict
        return res_dict

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

    @classmethod
    def _get_bible_book_index(cls) -> Dict[str, List[Dict[str, Any]]]:
        """Indexe en mémoire et sur disque une seule fois les chapitres d'ouvrages correspondant à chaque livre biblique."""
        if cls._bible_book_index is not None:
            return cls._bible_book_index

        import json
        cache_path = os.path.join("data", "cache", "theology_bible_book_index.json")
        if os.path.exists(cache_path):
            try:
                with open(cache_path, "r", encoding="utf-8") as f:
                    cls._bible_book_index = json.load(f)
                    return cls._bible_book_index
            except Exception:
                pass

        from core.reference_parser import get_standard_book_code, get_french_book_name
        from webview_app import get_cover_data_url

        index = {}
        registry = load_books_metadata()

        for b_name, b_meta in registry.items():
            b_type = str(b_meta.get("type", "")).strip().lower()
            if b_type in ["bible", "commentaire"]:
                continue
            is_theo_or_study = (
                b_type in ["théologie", "theologie", "théologique", "theology", "étude", "etude", "doctrine", "introduction", "dictionnaire"]
                or b_name in ["STGru", "Lire/Comprendre", "Paradoxes", "LirelaBibles", "NIV", "NIV Cultural", "MacArthur BC", "NIVArchaeo", "TSM", "Nouveau dictionnaire biblique. Révisé et augmenté"]
            )
            if not is_theo_or_study:
                continue

            try:
                toc_data = cls.get_book_toc(b_name)
                cov_p = b_meta.get("cover_path")
                cov_url = get_cover_data_url(cov_p) if (cov_p and get_cover_data_url) else None

                for ch in toc_data.get("chapters", []):
                    if ch.get("is_section_header"):
                        continue
                    ch_bcode = (ch.get("book_code") or "").upper()
                    ch_title = ch.get("title", "")
                    cid = ch.get("chapter_id", 1)

                    item = {
                        "book_name": b_name,
                        "book_title": b_meta.get("title", b_name),
                        "book_author": b_meta.get("author", ""),
                        "chapter_id": cid,
                        "chapter_title": ch_title,
                        "cover_url": cov_url,
                        "source_type": ch.get("source_type", "general")
                    }

                    if ch_bcode:
                        if ch_bcode not in index:
                            index[ch_bcode] = []
                        index[ch_bcode].append(item)
                    else:
                        for code, fr_name in [("GEN", "Genèse"), ("EXO", "Exode"), ("LEV", "Lévitique"), ("NUM", "Nombres"), ("DEU", "Deutéronome"),
                                              ("MAT", "Matthieu"), ("MRK", "Marc"), ("LUK", "Luc"), ("JHN", "Jean"), ("ACT", "Actes"),
                                              ("ROM", "Romains"), ("1CO", "1 Corinthiens"), ("2CO", "2 Corinthiens"), ("GAL", "Galates"),
                                              ("EPH", "Éphésiens"), ("PHP", "Philippiens"), ("COL", "Colossiens"), ("1TH", "1 Thessaloniciens"),
                                              ("2TH", "2 Thessaloniciens"), ("1TI", "1 Timothée"), ("2TI", "2 Timothée"), ("TIT", "Tite"),
                                              ("PHM", "Philémon"), ("HEB", "Hébreux"), ("JAS", "Jacques"), ("1PE", "1 Pierre"), ("2PE", "2 Pierre"),
                                              ("1JN", "1 Jean"), ("2JN", "2 Jean"), ("3JN", "3 Jean"), ("JUD", "Jude"), ("REV", "Apocalypse")]:
                            if fr_name.lower() in ch_title.lower() or f"ephésiens" in ch_title.lower() or f"ephesiens" in ch_title.lower():
                                if code not in index:
                                    index[code] = []
                                index[code].append(item)
                                break
            except Exception:
                pass

        try:
            os.makedirs(os.path.dirname(cache_path), exist_ok=True)
            with open(cache_path, "w", encoding="utf-8") as f:
                json.dump(index, f, ensure_ascii=False, indent=2)
        except Exception:
            pass

        cls._bible_book_index = index
        return cls._bible_book_index

    @classmethod
    def get_theology_resources_for_passage(
        cls,
        book_code: str,
        chapter: int,
        verse: int = 1,
        limit: int = 8
    ) -> List[Dict[str, Any]]:
        """
        Trouve tous les chapitres de livres de théologie, manuels et dictionnaires
        qui traitent du passage ou citent directement le verset.
        """
        from core.reference_parser import get_standard_book_code, get_french_book_name
        from webview_app import get_cover_data_url

        norm_code = (get_standard_book_code(book_code) or book_code).upper()
        french_book = get_french_book_name(norm_code) or book_code
        cache_key = f"{norm_code}_{chapter}_{verse}"

        if cache_key in cls._passage_theology_cache:
            return cls._passage_theology_cache[cache_key]

        results = []
        seen = set()
        registry = load_books_metadata()

        # 1. Chapitres de livres de la bibliothèque dédiés à ce livre biblique (instantané en mémoire)
        book_index = cls._get_bible_book_index()
        book_matches = book_index.get(norm_code, [])
        for bm in book_matches:
            if len(results) >= limit:
                break
            key = (bm["book_name"], bm["chapter_id"])
            if key not in seen:
                seen.add(key)
                item = dict(bm)
                item["snippet"] = f"Étude, archéologie et contexte théologique consacrés à {french_book} dans {bm['book_title']}."
                results.append(item)

        # 2. Citations directes dans les manuels de théologie systématique (ChromaDB si nécessaire)
        if len(results) < 3:
            client = cls.get_chroma_client()
            search_terms = [
                f"{french_book} {chapter}:{verse}",
                f"{french_book} {chapter}"
            ]

            try:
                col = client.get_collection('bible_study_bge_multilingual_gemma2_Infomaniak')
                for term in search_terms:
                    if len(results) >= limit:
                        break
                    try:
                        res = col.get(where_document={"$contains": term}, limit=3, include=['metadatas', 'documents'])
                        if res and res.get('ids'):
                            for i in range(len(res['ids'])):
                                m = res['metadatas'][i]
                                doc = res['documents'][i]
                                b_name = m.get('name') or m.get('title')
                                if not b_name:
                                    continue
                                cid = m.get('chapter_id', 1)
                                try:
                                    cid_int = int(cid)
                                except (ValueError, TypeError):
                                    cid_int = cid
                                
                                key = (b_name, cid_int)
                                if key in seen:
                                    continue
                                seen.add(key)

                                b_meta = registry.get(b_name, {})
                                doc_clean = cls._clean_text_encoding(doc)

                                # Extraire l'extrait textuel ciblé
                                idx = doc_clean.lower().find(term.lower())
                                if idx != -1:
                                    start = max(0, idx - 70)
                                    end = min(len(doc_clean), idx + len(term) + 140)
                                    snippet = ("..." if start > 0 else "") + doc_clean[start:end].replace('\n', ' ') + ("..." if end < len(doc_clean) else "")
                                else:
                                    snippet = doc_clean[:180] + "..." if len(doc_clean) > 180 else doc_clean

                                cov_p = b_meta.get('cover_path')
                                results.append({
                                    "book_name": b_name,
                                    "book_title": b_meta.get("title", b_name),
                                    "book_author": b_meta.get("author", m.get("author", "")),
                                    "chapter_id": cid_int,
                                    "chapter_title": cls._clean_text_encoding(m.get("chapter_title", f"Chapitre {cid_int}")),
                                    "snippet": snippet,
                                    "cover_url": get_cover_data_url(cov_p) if (cov_p and get_cover_data_url) else None,
                                    "source_type": m.get("source_type", "theology")
                                })
                    except Exception:
                        pass
            except Exception:
                pass

        cls._passage_theology_cache[cache_key] = results[:limit]
        return cls._passage_theology_cache[cache_key]

    @staticmethod
    def _clean_text_encoding(text: str) -> str:
        """Nettoie les artefacts d'encodage (ex:  -> accents français courants si détectables)."""
        if not text:
            return ""
        # Remplacements basiques des encodages tronqués courants
        cleaned = text.replace('\ufffd', "'")
        return cleaned
