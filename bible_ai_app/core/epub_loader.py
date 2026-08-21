import os
import re
import zipfile
import tempfile
import logging
import xml.etree.ElementTree as ET
from typing import List, Dict, Any, Optional, Tuple
from bs4 import BeautifulSoup

from core.reference_parser import (
    BOOK_MAPPING, 
    REVERSE_BOOK_MAPPING, 
    strip_accents,
    get_standard_book_code
)
from core.chunk_enricher import ChunkEnricher

logger = logging.getLogger(__name__)

def clean_html_tags(raw_html: str) -> str:
    """Nettoie les balises HTML et décode les entités d'une description."""
    if not raw_html:
        return ""
    import html
    text = re.sub(r'<(?:br|p|div|li)[^>]*>', '\n', raw_html, flags=re.I)
    text = re.sub(r'<[^>]+>', '', text)
    text = html.unescape(text)
    text = re.sub(r'\n\s*\n+', '\n\n', text)
    text = re.sub(r'[ \t]+', ' ', text)
    return text.strip()

# Listes de classification canonique
OT_CODES = {
    "Gen", "Exo", "Lev", "Num", "Deu", "Jos", "Jdg", "Rut", "1Sa", "2Sa",
    "1Ki", "2Ki", "1Ch", "2Ch", "Ezr", "Neh", "Est", "Job", "Psa", "Pro",
    "Ecc", "Sol", "Isa", "Jer", "Lam", "Eze", "Dan", "Hos", "Joe", "Amo",
    "Oba", "Jon", "Mic", "Nah", "Hab", "Zep", "Hag", "Zec", "Mal"
}

NT_CODES = {
    "Mat", "Mar", "Luk", "Joh", "Act", "Rom", "1Co", "2Co", "Gal", "Eph",
    "Phi", "Col", "1Th", "2Th", "1Ti", "2Ti", "Tit", "Phm", "Heb", "Jam",
    "1Pe", "2Pe", "1Jo", "2Jo", "3Jo", "Jud", "Rev"
}

APOCRYPHA_CODES = {
    "Tob", "Jdt", "Esg", "1Ma", "2Ma", "3Ma", "4Ma", "Wis", "Sir", "Bar",
    "Lje", "Dag", "1Es", "2Es", "Man", "Ps2"
}

# Mots-clés pour ignorer les pages annexes / techniques / front-matter par défaut
BOILERPLATE_KEYWORDS = [
    # Français
    "titre", "avertissement", "copyright", "droits", "preliminaires", 
    "table des matieres", "sommaire", "table of contents", "toc", 
    "questionnaire", "index", "couverture", "cover", "colophon",
    "remerciements", "dedicace", "bibliographie", "annexe", "credits",
    "cartes", "tableaux", "profils", "notes d'etude", "concordance",
    "references croisees", "plan de lecture", "chronologie",
    
    # Anglais
    "contents", "ebook introduction", "contributors", "publisher",
    "preface", "foreword", "about the", "acknowledgments", "dedication",
    "abbreviations", "master index", "charts", "maps", "personality profiles",
    "profiles", "study notes", "cross-references", "cross references",
    "concordance", "reading plan", "timeline", "timelines", "features of",
    "user guide", "how to use", "why the", "what is application"
]

class EpubLoader:
    """
    Chargeur et analyseur d'ouvrages EPUB structurés.
    Extrait la table des matières (TOC), identifie les chapitres par livre biblique / portée théologique,
    et segmente le texte en chunks contextualisés pour le RAG Tri-Flux.
    """

    @classmethod
    def inspect_epub(cls, epub_path: str) -> Dict[str, Any]:
        """
        Inspecte rapidement un fichier EPUB pour en extraire les métadonnées,
        l'éventuelle couverture et la liste des chapitres avec leur classification suggérée.
        """
        if not os.path.exists(epub_path):
            raise FileNotFoundError(f"Fichier EPUB introuvable: {epub_path}")

        metadata = {
            "title": "",
            "author": "",
            "description": "",
            "year": "",
            "publisher": "",
            "language": "fr",
            "cover_path": None,
            "chapters": []
        }

        with zipfile.ZipFile(epub_path, 'r') as z:
            # 1. Trouver le fichier OPF (Package Document)
            opf_path = cls._find_opf_path(z)
            opf_dir = os.path.dirname(opf_path) if opf_path else ""
            
            manifest_items = {}
            spine_refs = []
            
            if opf_path and opf_path in z.namelist():
                opf_data = z.read(opf_path).decode('utf-8', errors='ignore')
                meta_extracted, manifest_items, spine_refs, cover_id = cls._parse_opf(opf_data)
                metadata.update(meta_extracted)
                
                # Extraire l'image de couverture si disponible
                if cover_id and cover_id in manifest_items:
                    cover_rel = manifest_items[cover_id].get("href", "")
                    cover_full_zip = cls._resolve_zip_path(opf_dir, cover_rel)
                    if cover_full_zip in z.namelist():
                        metadata["cover_path"] = cls._extract_cover_temp(z, cover_full_zip)

            # Si le titre n'a pas été trouvé dans l'OPF, utiliser le nom du fichier nettoyé
            if not metadata["title"]:
                base_name = os.path.splitext(os.path.basename(epub_path))[0]
                # Nettoyer les mentions comme (z-library...)
                clean_name = re.sub(r'\(.*?\)', '', base_name).strip()
                metadata["title"] = clean_name or base_name

            # 2. Extraire la Table des Matières (TOC)
            toc_entries = cls._extract_toc(z, opf_dir, manifest_items, spine_refs)
            
            # 3. Déterminer la portée dominante par défaut du livre entier
            book_title_norm = strip_accents(metadata.get("title", ""))
            book_desc_norm = strip_accents(metadata.get("description", ""))
            if any(w in book_title_norm for w in ["christ", "jesus", "nouveau testament", "new testament", "evangile", "gospel", "paul", "epitres"]):
                book_dominant_scope = "NT"
            elif any(w in book_title_norm for w in ["ancien testament", "old testament", "pentateuque", "prophetes", "psaumes", "torah"]):
                book_dominant_scope = "OT"
            else:
                book_dominant_scope = "GLOBAL"

            is_part_regex = re.compile(
                r'^((premier|premiere|deuxieme|troisieme|quatrieme|cinquieme|sixieme|septieme|huitieme|neuvieme|dixieme|[0-9]+(ere|eme|re|er|e)?)\s+(partie|section|volume|tome|livre)|(partie|part|section|volume|tome|livre|book)\s+([0-9ivxlcdm]+|[a-z]+))\b',
                re.IGNORECASE
            )

            current_active_scope = book_dominant_scope
            current_active_book_code = None
            current_active_book_name = None

            is_syst_theol = any(w in book_title_norm for w in ["systematic theology", "theologie systematique", "theologie dogmatique", "dogmatique", "christian theology", "theologie chretienne"])
            classified_chapters = []
            
            for idx, entry in enumerate(toc_entries):
                title = entry.get("title", f"Chapitre {idx+1}").strip()
                src = entry.get("src", "")
                depth = entry.get("depth", 0)
                
                # Résoudre le chemin de fichier dans le ZIP
                file_zip_path = cls._resolve_zip_path(opf_dir, src.split("#")[0])
                
                # Estimation de taille
                size_chars = 0
                if file_zip_path in z.namelist():
                    try:
                        raw_html = z.read(file_zip_path).decode('utf-8', errors='ignore')
                        soup = BeautifulSoup(raw_html, 'html.parser')
                        text_only = soup.get_text()
                        size_chars = len(text_only.strip())
                    except Exception:
                        pass
                
                norm_t = strip_accents(title)
                is_section = bool(is_part_regex.match(norm_t))

                classification = cls.classify_chapter_title(
                    title, 
                    is_systematic_theology=is_syst_theol, 
                    book_author=metadata.get("author", "")
                )
                
                # Propagation contextuelle intelligente pour les sous-sections
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
                
                # Déterminer si inclus par défaut
                is_boilerplate = any(re.search(r'\b' + re.escape(strip_accents(kw)) + r'\b', norm_t) for kw in BOILERPLATE_KEYWORDS)
                
                # Règle d'inclusion par défaut :
                # - Les sections / parties sont TOUJOURS incluses pour préserver la structure
                # - Tout livre ou chapitre de contenu (> 50 caractères) est coché d'office
                # - Les annexes/front-matter/boilerplate sont décochés d'office
                if is_section:
                    include_default = True
                    classification["source_type"] = "general"
                elif classification["source_type"] == "appendix" or is_boilerplate:
                    include_default = False
                elif classification["book_code"] is not None:
                    include_default = True
                else:
                    include_default = size_chars > 50 or size_chars == 0

                classified_chapters.append({
                    "id": idx + 1,
                    "title": title,
                    "src": src,
                    "zip_file": file_zip_path,
                    "anchor": src.split("#")[1] if "#" in src else None,
                    "depth": depth,
                    "is_section_header": is_section,
                    "book_code": classification["book_code"],
                    "book_name": classification["book_name"],
                    "corpus_scope": classification["corpus_scope"],
                    "source_type": classification["source_type"],
                    "size_chars": size_chars,
                    "include": include_default
                })

            metadata["chapters"] = classified_chapters

        return metadata

    @classmethod
    def classify_chapter_title(cls, title: str, is_systematic_theology: bool = False, book_author: str = "") -> Dict[str, Any]:
        """
        Détecte automatiquement le livre biblique, le corpus et le type RAG à partir du titre du chapitre.
        """
        norm = strip_accents(title)

        def _has_word(words_list):
            for w in words_list:
                norm_w = strip_accents(w)
                if re.search(r'\b' + re.escape(norm_w) + r'\b', norm):
                    return True
            return False

        # 0. Vérifier si c'est le nom de l'auteur de l'ouvrage ou une page d'auteur
        if book_author and len(book_author) > 3:
            norm_author = strip_accents(book_author)
            if norm == norm_author or norm_author in norm or norm in norm_author:
                return {"book_code": None, "book_name": None, "corpus_scope": "GLOBAL", "source_type": "appendix"}

        # Noms d'auteurs ou signatures courantes isolées (ex: "John MacArthur", "John Piper", "Jean Calvin")
        if re.search(r'\b(john|jean|james|peter|pierre|paul|marc|mark|luke|luc|matthew|matthieu)\s+[a-z]+', norm):
            if not _has_word(["evangile", "epitre", "lettre", "gospel", "epistle", "selon"]):
                return {"book_code": None, "book_name": None, "corpus_scope": "GLOBAL", "source_type": "appendix"}

        # 1. Boilerplate / Front matter / Annexes
        if _has_word(BOILERPLATE_KEYWORDS):
            return {"book_code": None, "book_name": None, "corpus_scope": "GLOBAL", "source_type": "appendix"}

        # 2. Détection prioritaire des introductions de groupes de livres (sections globales)
        if _has_word(["old testament", "ancien testament", "historical books", "livres historiques", "prophetic books", "livres prophetiques", "pentateuch", "pentateuque", "torah"]):
            return {"book_code": None, "book_name": None, "corpus_scope": "OT", "source_type": "ot_context"}
        elif _has_word(["new testament", "nouveau testament", "gospels and acts", "evangiles et actes", "four gospels", "quatre evangiles", "epistles", "epitres"]):
            return {"book_code": None, "book_name": None, "corpus_scope": "NT", "source_type": "nt_context"}
        elif _has_word(["intertestament", "between the testaments", "hasmoneen", "maccabee", "periode perse"]):
            return {"book_code": None, "book_name": None, "corpus_scope": "INTER", "source_type": "ot_context"}
        elif _has_word(["apocryphe", "deuterocanonique"]):
            return {"book_code": None, "book_name": None, "corpus_scope": "APOCRYPHA", "source_type": "general"}

        # 3. Détection de références bibliques explicites entre parenthèses ou avec numéros (ex: "(Jean 1.1-5)", "(Colossiens 1.15-19)")
        ref_match = re.search(r'\(\s*([1-4]?\s*[a-zA-Z\u00C0-\u017F]+)\s+(\d+[\.:\d\-]*)', title)
        if ref_match:
            cand_book = strip_accents(ref_match.group(1).strip())
            if cand_book in BOOK_MAPPING:
                code = BOOK_MAPPING[cand_book]
                fr_name = REVERSE_BOOK_MAPPING.get(code, code)
                scope = "OT" if code in OT_CODES else ("NT" if code in NT_CODES else ("APOCRYPHA" if code in APOCRYPHA_CODES else "GLOBAL"))
                return {
                    "book_code": code,
                    "book_name": fr_name,
                    "corpus_scope": scope,
                    "source_type": "systematic_theology" if is_systematic_theology else "general"
                }

        # 4. Normalisation ordinale (premier/premiere -> 1, deuxieme -> 2, etc.)
        norm_ord = re.sub(r'\b(premier|premiere|1er|1ere)\b', '1', norm)
        norm_ord = re.sub(r'\b(deuxieme|2eme|2e)\b', '2', norm_ord)
        norm_ord = re.sub(r'\b(troisieme|3eme|3e)\b', '3', norm_ord)
        norm_ord = re.sub(r'\b(quatrieme|4eme|4e)\b', '4', norm_ord)

        # Nettoyage des préfixes
        clean_title = norm_ord
        clean_title = re.sub(r'\b(l[\'’]|la|le|les|de|d[\'’]|du|des|au|aux|a|the|of|to|introduction)\b', ' ', clean_title)
        clean_title = re.sub(r'\b(evangile|epitre|lettre|livre|selon|gospel|epistle|letter|book)\b', ' ', clean_title)
        clean_title = re.sub(r'\s+', ' ', clean_title).strip()

        # Tester le code direct sur le titre nettoyé
        code = None
        if clean_title in BOOK_MAPPING:
            code = BOOK_MAPPING[clean_title]
        elif norm_ord in BOOK_MAPPING:
            code = BOOK_MAPPING[norm_ord]
        elif norm in BOOK_MAPPING:
            code = BOOK_MAPPING[norm]

        if code:
            fr_name = REVERSE_BOOK_MAPPING.get(code, code)
            scope = "OT" if code in OT_CODES else ("NT" if code in NT_CODES else ("APOCRYPHA" if code in APOCRYPHA_CODES else "GLOBAL"))
            is_intro = any(kw in norm for kw in ["introduction", "intro", "preface"]) or clean_title == strip_accents(fr_name)
            stype = "book_intro" if is_intro else ("systematic_theology" if is_systematic_theology else "general")
            return {
                "book_code": code,
                "book_name": fr_name,
                "corpus_scope": scope,
                "source_type": stype
            }

        # 5. Détection thématique générale par mots entiers
        theol_keywords = [
            "salut", "grace", "justification", "foi", "doctrine", "trinite", "trinity", 
            "saint-esprit", "holy spirit", "dieu", "god", "christ", "eschatologie", "eschatology", 
            "theologie", "theology", "church", "eglise", "sanctification", "glorification", 
            "regeneration", "creation", "atonement", "expiation", "resurrection", "covenant", 
            "alliance", "sin", "peche", "providence", "angels", "anges", "demons", "heaven", 
            "ciel", "hell", "enfer", "prayer", "priere", "worship", "culte", "sacrament", 
            "bapteme", "baptism", "death", "mort", "election", "predestination", "perseverance"
        ]

        default_stype = "systematic_theology" if is_systematic_theology else "general"

        if _has_word(["christ", "jesus", "messie", "evangile", "gospel", "parole divine"]):
            return {"book_code": None, "book_name": None, "corpus_scope": "NT", "source_type": default_stype}
        elif _has_word(theol_keywords):
            return {"book_code": None, "book_name": None, "corpus_scope": "GLOBAL", "source_type": "systematic_theology"}
        elif _has_word(["lire", "comprendre", "symetrie", "harmonie", "etude", "canon", "inspiration", "revelation"]):
            return {"book_code": None, "book_name": None, "corpus_scope": "GLOBAL", "source_type": "biblical_theology"}

        return {
            "book_code": None,
            "book_name": None,
            "corpus_scope": "GLOBAL",
            "source_type": default_stype
        }

    @classmethod
    def extract_chapters_and_chunks(
        cls, 
        epub_path: str, 
        selected_chapters: List[Dict[str, Any]], 
        custom_name: str, 
        metadata: Dict[str, Any],
        max_chars: int = 1500,
        overlap: int = 200
    ) -> List[Dict[str, Any]]:
        """
        Extrait le contenu texte de tous les chapitres sélectionnés,
        les découpe sémantiquement en fragments, et les enrichit avec les métadonnées et versets cités.
        """
        if not os.path.exists(epub_path):
            return []

        raw_chunks = []
        author = metadata.get("author", "")
        book_title = metadata.get("title", custom_name)
        doc_type = metadata.get("type", "Théologie")
        embed_model = metadata.get("embedding_model", "study_library")

        chunk_counter = 0

        with zipfile.ZipFile(epub_path, 'r') as z:
            for ch in selected_chapters:
                if not ch.get("include", True):
                    continue

                zip_file = ch.get("zip_file", "")
                ch_title = ch.get("title", "")
                book_code = ch.get("book_code")
                corpus_scope = ch.get("corpus_scope", "GLOBAL")
                source_type = ch.get("source_type", "general")

                if not zip_file or zip_file not in z.namelist():
                    continue

                try:
                    html_content = z.read(zip_file).decode('utf-8', errors='ignore')
                    soup = BeautifulSoup(html_content, 'html.parser')

                    # Nettoyer les éléments indésirables (scripts, styles, nav)
                    for tag in soup(["script", "style", "nav"]):
                        tag.decompose()

                    # Supprimer les balises de pagination papier InDesign (ex: <span class="page-papier">[14]</span>)
                    for p_tag in soup.find_all(attrs={"class": lambda c: c and any(k in str(c).lower() for k in ["page-papier", "page_papier", "pagenum", "pagebreak", "page-number"])}):
                        p_tag.decompose()

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

                    # Récupérer les blocs de texte structurés (paragraphes, titres, listes, citations)
                    paragraphs = []
                    for el in soup.find_all(["h1", "h2", "h3", "h4", "h5", "h6", "p", "li", "blockquote", "aside"]):
                        tag_name = el.name.lower()
                        classes = " ".join(el.get("class", [])) if el.get("class") else ""
                        classes_lower = classes.lower()

                        # Détection de titre
                        is_h1 = tag_name == "h1" or "chapter-title" in classes_lower or "ch-title" in classes_lower
                        is_h2 = tag_name == "h2" or "section-title" in classes_lower or "part-title" in classes_lower or "titre1" in classes_lower
                        is_h3 = tag_name == "h3" or "subsection-title" in classes_lower or "subheading" in classes_lower or "titre2" in classes_lower
                        is_h4 = tag_name in ["h4", "h5", "h6"] or "titre3" in classes_lower or "rubrique" in classes_lower

                        # Titre via classe ou style si balise p ou div
                        if not (is_h1 or is_h2 or is_h3 or is_h4) and tag_name in ["p", "div"]:
                            if any(k in classes_lower for k in ["title", "titre", "heading", "head", "subhead", "sectiontitle"]):
                                is_h3 = True

                        txt = el.get_text(separator=" ", strip=True)
                        if not txt or txt == "[Retour au livre]" or len(txt) < 2:
                            continue

                        # Nettoyer et normaliser les espaces
                        txt = re.sub(r'\s*\[\^(\d+)\]\s*', r' [^\1] ', txt)
                        txt = re.sub(r'[ \t]+', ' ', txt).strip()

                        # Détection si c'est un paragraphe de note de bas de page (au bas du document)
                        is_footnote_def = False
                        if "footnote" in classes_lower or "note" in classes_lower or el.get("epub:type") == "footnote" or tag_name == "aside" or el.find_parent(attrs={"class": lambda c: c and "footnote" in str(c).lower()}):
                            is_footnote_def = True
                        elif re.match(r'^(\d+|\[\d+\])\s+(.+)', txt) and ("n.d.t" in txt.lower() or "n.d.e" in txt.lower() or "http" in txt.lower() or "voir " in txt.lower() or len(txt) < 300):
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

                        paragraphs.append(txt)

                    if not paragraphs:
                        # Fallback texte global
                        full_txt = soup.get_text(separator="\n", strip=True)
                        if full_txt:
                            paragraphs = [p.strip() for p in full_txt.split("\n") if p.strip()]

                    # Assembler en morceaux sémantiques équilibrés (~1200-1600 caractères)
                    current_chunk_text = []
                    current_length = 0

                    for p in paragraphs:
                        p_len = len(p)
                        if current_length + p_len > max_chars and current_chunk_text:
                            chunk_str = "\n\n".join(current_chunk_text)
                            raw_chunks.append({
                                "id": f"{custom_name}_ch{ch.get('id', 0)}_{chunk_counter}",
                                "text": chunk_str,
                                "metadata": {
                                    "name": custom_name,
                                    "title": book_title,
                                    "author": author,
                                    "type": doc_type,
                                    "chapter_title": ch_title,
                                    "chapter_id": ch.get("id", 0),
                                    "book_code": book_code,
                                    "corpus_scope": corpus_scope,
                                    "source_type": source_type,
                                    "embedding_model": embed_model
                                }
                            })
                            chunk_counter += 1
                            
                            # Overlap : garder le dernier paragraphe si pas trop long
                            if p_len < overlap * 2:
                                current_chunk_text = [p]
                                current_length = p_len
                            else:
                                current_chunk_text = []
                                current_length = 0
                        else:
                            current_chunk_text.append(p)
                            current_length += p_len + 2

                    # Dernier bloc restant
                    if current_chunk_text:
                        chunk_str = "\n\n".join(current_chunk_text)
                        raw_chunks.append({
                            "id": f"{custom_name}_ch{ch.get('id', 0)}_{chunk_counter}",
                            "text": chunk_str,
                            "metadata": {
                                "name": custom_name,
                                "title": book_title,
                                "author": author,
                                "type": doc_type,
                                "chapter_title": ch_title,
                                "chapter_id": ch.get("id", 0),
                                "book_code": book_code,
                                "corpus_scope": corpus_scope,
                                "source_type": source_type,
                                "embedding_model": embed_model
                            }
                        })
                        chunk_counter += 1

                except Exception as e:
                    logger.error(f"[EpubLoader] Erreur lors de l'extraction de {zip_file}: {e}")

        # Enrichir tous les chunks avec ChunkEnricher (contextualisation hiérarchique + détection des versets cités)
        enriched_chunks = ChunkEnricher.process_document(raw_chunks)
        return enriched_chunks

    @classmethod
    def extract_chunks(
        cls,
        epub_path: str,
        selected_chapters: List[Dict[str, Any]] = None,
        metadata: Dict[str, Any] = None,
        custom_name: str = "",
        **kwargs
    ) -> List[Dict[str, Any]]:
        """Alias de compatibilité pour extract_chapters_and_chunks."""
        if metadata is None:
            metadata = {}
        if not custom_name:
            custom_name = metadata.get("title", "") or kwargs.get("name", "book")
        return cls.extract_chapters_and_chunks(
            epub_path=epub_path,
            selected_chapters=selected_chapters or [],
            custom_name=custom_name,
            metadata=metadata,
            **kwargs
        )

    # =========================================================================
    # METHODES INTERNES DE PARSING EPUB / XML
    # =========================================================================

    @classmethod
    def _find_opf_path(cls, z: zipfile.ZipFile) -> Optional[str]:
        """Trouve le chemin du fichier .opf dans container.xml ou par scan."""
        try:
            if "META-INF/container.xml" in z.namelist():
                container_data = z.read("META-INF/container.xml")
                root = ET.fromstring(container_data)
                for rootfile in root.findall(".//{urn:oasis:names:tc:opendocument:xmlns:container}rootfile"):
                    full_path = rootfile.get("full-path")
                    if full_path:
                        return full_path
        except Exception:
            pass

        # Fallback : chercher le premier fichier qui termine par .opf
        for name in z.namelist():
            if name.lower().endswith(".opf"):
                return name
        return None

    @classmethod
    def _parse_opf(cls, opf_xml: str) -> Tuple[Dict[str, str], Dict[str, Dict[str, str]], List[str], Optional[str]]:
        """Parse les métadonnées, le manifest et le spine du fichier OPF."""
        metadata = {}
        manifest = {}
        spine = []
        cover_id = None

        try:
            root = ET.fromstring(opf_xml)
            # Ignorer les namespaces pour faciliter l'accès
            for el in root.iter():
                if '}' in el.tag:
                    el.tag = el.tag.split('}', 1)[1]

            # 1. Metadata
            meta_elem = root.find("metadata")
            if meta_elem is not None:
                for child in meta_elem:
                    tag = child.tag.lower()
                    val = child.text.strip() if child.text else ""
                    if tag == "title" and not metadata.get("title"):
                        metadata["title"] = val
                    elif tag == "creator" and not metadata.get("author"):
                        metadata["author"] = val
                    elif tag == "date" and not metadata.get("year"):
                        metadata["year"] = val[:4] if len(val) >= 4 else val
                    elif tag == "publisher" and not metadata.get("publisher"):
                        metadata["publisher"] = val
                    elif tag == "description" and not metadata.get("description"):
                        metadata["description"] = clean_html_tags(val)
                    elif tag == "language" and not metadata.get("language"):
                        metadata["language"] = val
                    elif tag == "meta":
                        if child.get("name") == "cover":
                            cover_id = child.get("content")

            # 2. Manifest
            manifest_elem = root.find("manifest")
            if manifest_elem is not None:
                for item in manifest_elem.findall("item"):
                    i_id = item.get("id")
                    i_href = item.get("href")
                    i_type = item.get("media-type", "")
                    i_props = item.get("properties", "")
                    if i_id and i_href:
                        manifest[i_id] = {
                            "href": i_href,
                            "media-type": i_type,
                            "properties": i_props
                        }
                        if "cover-image" in i_props or ("cover" in i_id.lower() and "image" in i_type):
                            if not cover_id:
                                cover_id = i_id

            # 3. Spine
            spine_elem = root.find("spine")
            if spine_elem is not None:
                for itemref in spine_elem.findall("itemref"):
                    idref = itemref.get("idref")
                    if idref:
                        spine.append(idref)

        except Exception as e:
            logger.error(f"[EpubLoader] Erreur parsing OPF: {e}")

        return metadata, manifest, spine, cover_id

    @classmethod
    def _extract_toc(
        cls, 
        z: zipfile.ZipFile, 
        opf_dir: str, 
        manifest: Dict[str, Dict[str, str]], 
        spine: List[str]
    ) -> List[Dict[str, Any]]:
        """Extrait les points d'entrée de la table des matières (NCX ou Nav XHTML) en préservant la hiérarchie."""
        toc_entries = []

        # 1. Essayer toc.ncx (EPUB 2 / EPUB 3 compatible)
        ncx_path = None
        for i_id, info in manifest.items():
            if info.get("media-type") == "application/x-dtbncx+xml" or info.get("href", "").endswith(".ncx"):
                ncx_path = cls._resolve_zip_path(opf_dir, info.get("href"))
                break

        if not ncx_path:
            for name in z.namelist():
                if name.lower().endswith("toc.ncx"):
                    ncx_path = name
                    break

        if ncx_path and ncx_path in z.namelist():
            try:
                ncx_data = z.read(ncx_path)
                root = ET.fromstring(ncx_data)
                for el in root.iter():
                    if '}' in el.tag:
                        el.tag = el.tag.split('}', 1)[1]

                def _parse_nav_points(np_list, depth=0):
                    for np in np_list:
                        lbl = np.find("navLabel/text")
                        cnt = np.find("content")
                        if lbl is not None and lbl.text:
                            title_t = lbl.text.strip()
                            src_t = cnt.get("src", "") if cnt is not None else ""
                            if title_t:
                                toc_entries.append({"title": title_t, "src": src_t, "depth": depth})
                        child_points = np.findall("./navPoint")
                        if child_points:
                            _parse_nav_points(child_points, depth + 1)

                top_points = root.findall("./navMap/navPoint")
                if not top_points:
                    top_points = root.findall(".//navPoint")
                _parse_nav_points(top_points, 0)
                
                if toc_entries:
                    return toc_entries
            except Exception as e:
                logger.error(f"[EpubLoader] Erreur parsing NCX: {e}")

        # 2. Essayer nav.xhtml (EPUB 3)
        nav_path = None
        for i_id, info in manifest.items():
            if "nav" in info.get("properties", ""):
                nav_path = cls._resolve_zip_path(opf_dir, info.get("href"))
                break

        if nav_path and nav_path in z.namelist():
            try:
                nav_html = z.read(nav_path).decode('utf-8', errors='ignore')
                soup = BeautifulSoup(nav_html, 'html.parser')
                nav_tag = soup.find('nav', attrs={'epub:type': 'toc'}) or soup.find('nav')
                if nav_tag:
                    def _parse_nav_list(ol_or_ul, depth=0):
                        for li in ol_or_ul.find_all('li', recursive=False):
                            a = li.find('a', recursive=False)
                            if a:
                                t = a.get_text(strip=True)
                                h = a.get('href', '')
                                if t:
                                    toc_entries.append({"title": t, "src": h, "depth": depth})
                            child_list = li.find(['ol', 'ul'], recursive=False)
                            if child_list:
                                _parse_nav_list(child_list, depth + 1)

                    top_list = nav_tag.find(['ol', 'ul'])
                    if top_list:
                        _parse_nav_list(top_list, 0)
                    else:
                        for a in nav_tag.find_all('a'):
                            t = a.get_text(strip=True)
                            h = a.get('href', '')
                            if t:
                                toc_entries.append({"title": t, "src": h, "depth": 0})
                if toc_entries:
                    return toc_entries
            except Exception as e:
                logger.error(f"[EpubLoader] Erreur parsing Nav: {e}")

        # 3. Fallback : utiliser le Spine si aucun TOC n'a été trouvé
        for idref in spine:
            if idref in manifest:
                href = manifest[idref].get("href", "")
                base_title = os.path.splitext(os.path.basename(href))[0]
                toc_entries.append({
                    "title": base_title.replace("-", " ").replace("_", " ").title(),
                    "src": href,
                    "depth": 0
                })

        return toc_entries

    @classmethod
    def _resolve_zip_path(cls, base_dir: str, rel_path: str) -> str:
        """Résout un chemin relatif à l'intérieur de l'archive ZIP."""
        if not base_dir:
            return rel_path.replace("\\", "/")
        norm = os.path.normpath(os.path.join(base_dir, rel_path)).replace("\\", "/")
        return norm

    @classmethod
    def _extract_cover_temp(cls, z: zipfile.ZipFile, cover_zip_path: str) -> Optional[str]:
        """Extrait l'image de couverture dans le dossier permanent data/covers pour l'affichage immédiat."""
        try:
            import uuid
            ext = os.path.splitext(cover_zip_path)[1] or ".jpg"
            app_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
            covers_dir = os.path.join(app_root, "data", "covers")
            os.makedirs(covers_dir, exist_ok=True)
            
            clean_base = re.sub(r'[^a-zA-Z0-9._-]', '_', os.path.basename(cover_zip_path))
            unique_name = f"epub_{uuid.uuid4().hex[:8]}_{clean_base}"
            target_file = os.path.join(covers_dir, unique_name)
            
            with open(target_file, "wb") as f:
                f.write(z.read(cover_zip_path))
            return target_file
        except Exception as e:
            logger.error(f"[EpubLoader] Erreur extraction couverture: {e}")
            return None
