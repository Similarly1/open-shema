import os
import re
import shutil
import tempfile
import logging
from typing import List, Dict, Any, Optional, Tuple

try:
    import fitz  # PyMuPDF
except ImportError:
    fitz = None

from core.reference_parser import (
    BOOK_MAPPING, 
    REVERSE_BOOK_MAPPING, 
    strip_accents,
    get_standard_book_code
)
from core.chunk_enricher import ChunkEnricher
from core.book_classifier import BookClassifier
from core.epub_loader import EpubLoader, BOILERPLATE_KEYWORDS

logger = logging.getLogger(__name__)


class PdfLoader:
    """
    Chargeur, inspecteur et extracteur de documents et livres au format PDF.
    Extrait les métadonnées, la couverture, la table des matières (TOC ou heuristique)
    et segmente le texte en chapitres et chunks contextualisés pour l'indexation RAG.
    """

    _inspect_cache: Dict[Tuple[str, float], Dict[str, Any]] = {}

    @classmethod
    def invalidate_cache(cls):
        """Vide le cache d'inspection PDF."""
        cls._inspect_cache.clear()

    @classmethod
    def inspect_pdf(cls, pdf_path: str) -> Dict[str, Any]:
        """
        Inspecte un fichier PDF pour en extraire les métadonnées,
        générer une miniature de couverture et lister les chapitres/sections.
        """
        if fitz is None:
            raise ImportError("PyMuPDF (fitz) n'est pas installé dans l'environnement Python.")

        if not os.path.exists(pdf_path):
            raise FileNotFoundError(f"Fichier PDF introuvable : {pdf_path}")

        mtime = os.path.getmtime(pdf_path)
        cache_key = (pdf_path, mtime)
        if cache_key in cls._inspect_cache:
            return cls._inspect_cache[cache_key]

        doc = fitz.open(pdf_path)
        total_pages = len(doc)

        raw_meta = doc.metadata or {}
        title = (raw_meta.get("title") or "").strip()
        author = (raw_meta.get("author") or "").strip()
        subject = (raw_meta.get("subject") or "").strip()
        keywords = (raw_meta.get("keywords") or "").strip()

        # Nettoyage de l'année depuis creationDate (ex: "D:20220817122400+02'00'")
        year = ""
        cdate = raw_meta.get("creationDate") or raw_meta.get("modDate") or ""
        m_year = re.search(r'D:(\d{4})', cdate)
        if m_year:
            year = m_year.group(1)

        # Fallback pour le titre
        if not title or len(title) < 3 or title.lower().endswith(".pdf") or "microsoft" in title.lower():
            base_name = os.path.splitext(os.path.basename(pdf_path))[0]
            clean_name = re.sub(r'\(.*?\)', '', base_name).strip()
            title = clean_name or base_name

        # Fallback pour la description
        description = subject
        if keywords and not description:
            description = f"Mots-clés : {keywords}"

        # 1. Génération de la couverture (page 1 sous forme d'image)
        cover_path = cls._extract_cover(doc, pdf_path)

        # 2. Extraction de la table des matières (TOC)
        toc = doc.get_toc() # [[lvl, title, page], ...]
        chapters = []

        if toc:
            # Structuration basée sur la TOC native du PDF
            for idx, entry in enumerate(toc):
                lvl, t_title, start_pg = entry[0], entry[1].strip(), entry[2]
                if start_pg < 1:
                    start_pg = 1
                if start_pg > total_pages:
                    start_pg = total_pages

                # Calcul de la page de fin
                if idx + 1 < len(toc):
                    next_start = toc[idx + 1][2]
                    end_pg = max(start_pg, next_start - 1) if next_start > start_pg else start_pg
                else:
                    end_pg = total_pages

                chapters.append({
                    "id": idx + 1,
                    "title": t_title or f"Section {idx + 1}",
                    "start_page": start_pg,
                    "end_page": min(end_pg, total_pages),
                    "depth": max(0, lvl - 1),
                    "is_section_header": (lvl == 1 and (end_pg - start_pg > 1)),
                })
        else:
            # TOC absente : détection heuristique des sections ou découpage par pages
            chapters = cls._detect_heuristic_chapters(doc)

        # 3. Calcul de la taille et classification canonique / RAG pour chaque chapitre
        book_title_norm = strip_accents(title.lower())
        is_syst_theol = any(w in book_title_norm for w in [
            "systematic theology", "theologie systematique", "theologie dogmatique", 
            "dogmatique", "christian theology", "theologie chretienne", "doctrine"
        ])

        current_active_scope = "GLOBAL"
        if any(w in book_title_norm for w in ["christ", "jesus", "nouveau testament", "new testament", "evangile", "gospel", "paul", "epitres"]):
            current_active_scope = "NT"
        elif any(w in book_title_norm for w in ["ancien testament", "old testament", "pentateuque", "prophetes", "psaumes", "torah"]):
            current_active_scope = "OT"

        current_active_book_code = None
        current_active_book_name = None

        final_chapters = []
        for ch in chapters:
            ch_title = ch["title"]
            s_pg = ch.get("start_page", 1)
            e_pg = ch.get("end_page", 1)

            # Estimer le nombre de caractères
            char_count = 0
            sample_text_parts = []
            for pno in range(s_pg - 1, min(e_pg, total_pages)):
                try:
                    p_txt = doc[pno].get_text()
                    char_count += len(p_txt)
                    if len(sample_text_parts) < 3 and p_txt.strip():
                        sample_text_parts.append(p_txt.strip()[:300])
                except Exception:
                    pass

            sample_text = " ".join(sample_text_parts)
            classification = EpubLoader.classify_chapter_title(
                ch_title,
                is_systematic_theology=is_syst_theol,
                book_author=author
            )

            # Si le titre ne donne rien de précis, tester un rapide scan sur le premier paragraphe
            if not classification["book_code"] and sample_text:
                heur_cls = BookClassifier.heuristic_classify(ch_title, sample_text)
                if heur_cls.get("book_code"):
                    classification["book_code"] = heur_cls["book_code"]
                    classification["book_name"] = heur_cls.get("book_name")
                    classification["corpus_scope"] = heur_cls.get("corpus_scope", classification["corpus_scope"])

            # Propagation contextuelle pour les sous-sections
            if classification["source_type"] != "appendix":
                if classification["book_code"]:
                    current_active_scope = classification["corpus_scope"]
                    current_active_book_code = classification["book_code"]
                    current_active_book_name = classification["book_name"]
                elif classification["corpus_scope"] == "GLOBAL" and current_active_scope != "GLOBAL":
                    classification["corpus_scope"] = current_active_scope
                    if not classification["book_code"] and current_active_book_code:
                        classification["book_code"] = current_active_book_code
                        classification["book_name"] = current_active_book_name

            norm_t = strip_accents(ch_title)
            is_boilerplate = any(re.search(r'\b' + re.escape(strip_accents(kw)) + r'\b', norm_t) for kw in BOILERPLATE_KEYWORDS)

            include_default = True
            if classification["source_type"] == "appendix" or is_boilerplate:
                include_default = False
            elif char_count < 30 and total_pages > 3:
                include_default = False

            ch.update({
                "book_code": classification["book_code"],
                "book_name": classification["book_name"],
                "corpus_scope": classification["corpus_scope"],
                "source_type": classification["source_type"],
                "size_chars": char_count,
                "include": include_default
            })
            final_chapters.append(ch)

        doc.close()

        result = {
            "title": title,
            "author": author,
            "description": description,
            "year": year,
            "language": "fr",
            "format": "pdf",
            "total_pages": total_pages,
            "cover_path": cover_path,
            "chapters": final_chapters
        }

        cls._inspect_cache[cache_key] = result
        return result

    @classmethod
    def _extract_cover(cls, doc: Any, pdf_path: str) -> Optional[str]:
        """Génère une image miniature PNG de la première page du PDF."""
        try:
            covers_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "covers")
            os.makedirs(covers_dir, exist_ok=True)

            pdf_base = os.path.splitext(os.path.basename(pdf_path))[0]
            safe_name = re.sub(r'[^a-zA-Z0-9_-]', '_', pdf_base)[:30]
            cover_file = os.path.join(covers_dir, f"cover_{safe_name}.png")

            if os.path.exists(cover_file) and os.path.getsize(cover_file) > 1000:
                return cover_file

            if len(doc) > 0:
                page = doc[0]
                # Rendu à échelle modérée (150 DPI) pour une couverture nette mais légère
                pix = page.get_pixmap(dpi=150)
                pix.save(cover_file)
                return cover_file
        except Exception as e:
            logger.warning(f"[PdfLoader] Impossible de générer la couverture pour {pdf_path}: {e}")
        return None

    @classmethod
    def _detect_heuristic_chapters(cls, doc: Any) -> List[Dict[str, Any]]:
        """
        Détecte les chapitres/sections dans un PDF sans table des matières.
        Recherche des en-têtes explicites (ex: 'Message 1', 'Chapitre 2', 'Introduction')
        ou découpe en blocs réguliers de pages.
        """
        total_pages = len(doc)
        detected_sections = []

        header_patterns = [
            re.compile(r'^(?:chapitre|message|partie|section|le[çc]on|discours|sermon|hom[ií]lie)\s+([0-9ivxlcdm]+|[a-z]+)\b.*', re.IGNORECASE),
            re.compile(r'^(?:[0-9ivxlcdm]+[\.\)]\s+)(.+)', re.IGNORECASE),
            re.compile(r'^(?:introduction|conclusion|avant-propos|pr[eé]face|annexe)\b.*', re.IGNORECASE)
        ]

        for pno in range(total_pages):
            try:
                page = doc[pno]
                blocks = page.get_text("blocks") # (x0, y0, x1, y1, text, block_no, block_type)
                for b in blocks:
                    if b[6] != 0: # Ignorer les images
                        continue
                    b_text = b[4].strip()
                    lines = [ln.strip() for ln in b_text.split("\n") if ln.strip()]
                    if not lines:
                        continue

                    first_line = lines[0]
                    # Vérifier si la première ligne correspond à un titre de chapitre/section
                    for pat in header_patterns:
                        if pat.match(first_line) and len(first_line) < 120:
                            clean_header = first_line.strip()
                            if len(lines) > 1 and len(lines[1]) < 80 and not lines[1].endswith('.'):
                                clean_header = f"{clean_header} - {lines[1]}"

                            detected_sections.append({
                                "title": clean_header,
                                "start_page": pno + 1,
                                "depth": 0
                            })
                            break
            except Exception:
                pass

        # Filtrer et dédupliquer les sections détectées sur les mêmes pages
        filtered_sections = []
        seen_pages = set()
        for s in detected_sections:
            pg = s["start_page"]
            if pg not in seen_pages:
                seen_pages.add(pg)
                filtered_sections.append(s)

        # Si nous avons trouvé au moins 2 sections distinctes
        if len(filtered_sections) >= 2:
            chapters = []
            for idx, sec in enumerate(filtered_sections):
                s_pg = sec["start_page"]
                if idx + 1 < len(filtered_sections):
                    e_pg = max(s_pg, filtered_sections[idx + 1]["start_page"] - 1)
                else:
                    e_pg = total_pages

                chapters.append({
                    "id": idx + 1,
                    "title": sec["title"],
                    "start_page": s_pg,
                    "end_page": e_pg,
                    "depth": sec.get("depth", 0),
                    "is_section_header": False
                })
            return chapters

        # Découpage par défaut si aucune section n'est clairement isolée
        chapters = []
        if total_pages <= 5:
            # Très court document : 1 chapitre par page ou 1 seul chapitre global
            if total_pages == 1:
                chapters.append({
                    "id": 1,
                    "title": "Document complet",
                    "start_page": 1,
                    "end_page": 1,
                    "depth": 0,
                    "is_section_header": False
                })
            else:
                for pno in range(total_pages):
                    chapters.append({
                        "id": pno + 1,
                        "title": f"Page {pno + 1}",
                        "start_page": pno + 1,
                        "end_page": pno + 1,
                        "depth": 0,
                        "is_section_header": False
                    })
        elif total_pages <= 30:
            # Document moyen : regroupement par blocs de 3 à 5 pages
            chunk_size = 5
            c_idx = 1
            for pno in range(0, total_pages, chunk_size):
                s_pg = pno + 1
                e_pg = min(pno + chunk_size, total_pages)
                chapters.append({
                    "id": c_idx,
                    "title": f"Pages {s_pg} à {e_pg}",
                    "start_page": s_pg,
                    "end_page": e_pg,
                    "depth": 0,
                    "is_section_header": False
                })
                c_idx += 1
        else:
            # Long document : regroupement par blocs de 10 pages
            chunk_size = 10
            c_idx = 1
            for pno in range(0, total_pages, chunk_size):
                s_pg = pno + 1
                e_pg = min(pno + chunk_size, total_pages)
                chapters.append({
                    "id": c_idx,
                    "title": f"Pages {s_pg} à {e_pg}",
                    "start_page": s_pg,
                    "end_page": e_pg,
                    "depth": 0,
                    "is_section_header": False
                })
                c_idx += 1

        return chapters

    @classmethod
    def extract_chapters_and_chunks(
        cls,
        pdf_path: str,
        selected_chapters: List[Dict[str, Any]],
        custom_name: str,
        metadata: Dict[str, Any],
        max_chars: int = 1500,
        overlap: int = 200
    ) -> List[Dict[str, Any]]:
        """
        Extrait le contenu texte de tous les chapitres PDF sélectionnés,
        les nettoie, les segmente en chunks sémantiques et les enrichit avec ChunkEnricher.
        """
        if fitz is None:
            raise ImportError("PyMuPDF (fitz) n'est pas installé.")

        if not os.path.exists(pdf_path):
            return []

        # Copier le PDF dans data/ebooks/ si nécessaire pour un accès pérenne
        app_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        ebooks_dir = os.path.join(app_root, "data", "ebooks")
        os.makedirs(ebooks_dir, exist_ok=True)

        target_pdf_path = os.path.join(ebooks_dir, os.path.basename(pdf_path))
        if os.path.abspath(pdf_path) != os.path.abspath(target_pdf_path):
            try:
                shutil.copy2(pdf_path, target_pdf_path)
                metadata["file_path"] = target_pdf_path
            except Exception as e:
                logger.warning(f"[PdfLoader] Impossible de copier le PDF vers data/ebooks: {e}")
                metadata["file_path"] = pdf_path
        else:
            metadata["file_path"] = pdf_path

        metadata["format"] = "pdf"

        doc = fitz.open(pdf_path)
        total_pages = len(doc)

        raw_chunks = []
        author = metadata.get("author", "")
        book_title = metadata.get("title", custom_name)
        doc_type = metadata.get("type", "Théologie")
        embed_model = metadata.get("embedding_model", "study_library")

        chunk_counter = 0

        for ch in selected_chapters:
            if not ch.get("include", True):
                continue

            ch_id = ch.get("id", 0)
            ch_title = ch.get("title", f"Section {ch_id}")
            start_pg = ch.get("start_page", 1)
            end_pg = ch.get("end_page", total_pages)
            book_code = ch.get("book_code")
            corpus_scope = ch.get("corpus_scope", "GLOBAL")
            source_type = ch.get("source_type", "general")

            # Extraction et nettoyage des paragraphes pour ce chapitre
            chapter_paragraphs = []
            for pno in range(start_pg - 1, min(end_pg, total_pages)):
                try:
                    page = doc[pno]
                    p_height = page.rect.height

                    # Extraction par blocs de texte
                    blocks = page.get_text("blocks")
                    for b in blocks:
                        if b[6] != 0: # Image
                            continue
                        b_top = b[1]
                        b_bottom = b[3]
                        b_txt = b[4].strip()

                        # Filtrer les en-têtes et pieds de page répétitifs (ex: numéros de page seuls dans les 40pt du haut ou bas)
                        if (b_top < 40 or b_bottom > p_height - 40) and (len(b_txt) < 10 or b_txt.isdigit()):
                            continue

                        # Nettoyage des césures de fin de ligne (ex: "décou-\npage" -> "découpage")
                        clean_block = re.sub(r'(\w+)-\n(\w+)', r'\1\2', b_txt)
                        clean_block = re.sub(r'[ \t]+', ' ', clean_block).strip()

                        if clean_block and len(clean_block) >= 3:
                            chapter_paragraphs.append(clean_block)
                except Exception as e:
                    logger.error(f"[PdfLoader] Erreur page {pno+1}: {e}")

            if not chapter_paragraphs:
                continue

            # Assemblage en chunks sémantiques équilibrés (~1500 caractères)
            current_chunk_paras = []
            current_length = 0

            for p in chapter_paragraphs:
                p_len = len(p)
                if current_length + p_len > max_chars and current_chunk_paras:
                    chunk_text = "\n\n".join(current_chunk_paras)
                    raw_chunks.append({
                        "id": f"{custom_name}_ch{ch_id}_{chunk_counter}",
                        "text": chunk_text,
                        "metadata": {
                            "name": custom_name,
                            "title": book_title,
                            "author": author,
                            "type": doc_type,
                            "chapter_title": ch_title,
                            "chapter_id": ch_id,
                            "start_page": start_pg,
                            "end_page": end_pg,
                            "book_code": book_code,
                            "corpus_scope": corpus_scope,
                            "source_type": source_type,
                            "embedding_model": embed_model
                        }
                    })
                    chunk_counter += 1

                    # Overlap
                    if p_len < overlap * 2:
                        current_chunk_paras = [p]
                        current_length = p_len
                    else:
                        current_chunk_paras = []
                        current_length = 0
                else:
                    current_chunk_paras.append(p)
                    current_length += p_len + 2

            if current_chunk_paras:
                chunk_text = "\n\n".join(current_chunk_paras)
                raw_chunks.append({
                    "id": f"{custom_name}_ch{ch_id}_{chunk_counter}",
                    "text": chunk_text,
                    "metadata": {
                        "name": custom_name,
                        "title": book_title,
                        "author": author,
                        "type": doc_type,
                        "chapter_title": ch_title,
                        "chapter_id": ch_id,
                        "start_page": start_pg,
                        "end_page": end_pg,
                        "book_code": book_code,
                        "corpus_scope": corpus_scope,
                        "source_type": source_type,
                        "embedding_model": embed_model
                    }
                })
                chunk_counter += 1

        doc.close()

        # Enrichissement avec détection des versets cités via ChunkEnricher
        enriched_chunks = ChunkEnricher.process_document(raw_chunks)
        return enriched_chunks
