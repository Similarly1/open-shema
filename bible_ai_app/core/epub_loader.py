import os
import re
import zipfile
import tempfile
import logging
import posixpath
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
    "user guide", "how to use", "why the", "what is application",
    "title page", "titlepage", "half title", "works cited", "works-cited",
    "author index", "subject index", "share your thoughts"
]

class EpubLoader:
    """
    Chargeur et analyseur d'ouvrages EPUB structurés.
    Extrait la table des matières (TOC), identifie les chapitres par livre biblique / portée théologique,
    et segmente le texte en chunks contextualisés pour le RAG Tri-Flux.
    """
    _inspect_cache: Dict[Tuple[str, float], Dict[str, Any]] = {}

    @classmethod
    def invalidate_cache(cls):
        """Vide le cache mémoire d'inspection EPUB."""
        cls._inspect_cache.clear()

    @classmethod
    def inspect_epub(cls, epub_path: str) -> Dict[str, Any]:
        """
        Inspecte rapidement un fichier EPUB pour en extraire les métadonnées,
        l'éventuelle couverture et la liste des chapitres avec leur classification suggérée.
        """
        if not os.path.exists(epub_path):
            raise FileNotFoundError(f"Fichier EPUB introuvable: {epub_path}")

        mtime = os.path.getmtime(epub_path)
        cache_key = (epub_path, mtime)
        if cache_key in cls._inspect_cache:
            return cls._inspect_cache[cache_key]

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

            active_books_by_depth: Dict[int, Dict[str, str]] = {}
            last_sibling_book: Optional[Dict[str, str]] = None

            is_syst_theol = any(w in book_title_norm for w in [
                "systematic theology", "theologie systematique", "theologie dogmatique", 
                "dogmatique", "dogmatics", "christian theology", "theologie chretienne",
                "theology", "theologie", "doctrine", "doctrines", "biblical theology", "theologie biblique"
            ])
            classified_chapters = []
            raw_files_cache: Dict[str, str] = {}
            
            for idx, entry in enumerate(toc_entries):
                title = entry.get("title", f"Chapitre {idx+1}").strip()
                src = entry.get("src", "")
                depth = entry.get("depth", 0)
                anchor = src.split("#")[1] if "#" in src else None
                
                # Résoudre le chemin de fichier dans le ZIP
                file_zip_path = cls._resolve_zip_path(opf_dir, src.split("#")[0])
                
                # Estimation de taille
                size_chars = 0
                if file_zip_path in z.namelist():
                    try:
                        if file_zip_path not in raw_files_cache:
                            raw_files_cache[file_zip_path] = z.read(file_zip_path).decode('utf-8', errors='ignore')
                        raw_html = raw_files_cache[file_zip_path]

                        if anchor:
                            # Découpage ultra-rapide de la tranche du chapitre
                            slice_html = cls.slice_html_by_chapter(
                                raw_html,
                                {"anchor": anchor, "zip_file": file_zip_path, "id": idx + 1},
                                [{"id": i + 1, "anchor": e.get("src", "").split("#")[1] if "#" in e.get("src", "") else None, "zip_file": cls._resolve_zip_path(opf_dir, e.get("src", "").split("#")[0])} for i, e in enumerate(toc_entries)]
                            )
                            text_only = re.sub(r'<[^>]+>', ' ', slice_html)
                            size_chars = len(' '.join(text_only.split()))
                        else:
                            soup = BeautifulSoup(raw_html, 'html.parser')
                            text_only = soup.get_text()
                            size_chars = len(text_only.strip())
                    except Exception:
                        pass
                
                norm_t = strip_accents(title)
                is_section = bool(is_part_regex.match(norm_t))

                is_intro_book = any(w in book_title_norm for w in ["introduction", "intro", "guide", "survey", "handbook", "manuel"])
                classification = cls.classify_chapter_title(
                    title, 
                    is_systematic_theology=is_syst_theol,
                    is_intro_book=is_intro_book,
                    book_dominant_scope=book_dominant_scope,
                    book_author=metadata.get("author", "")
                )
                
                # Détection complémentaire par nom de fichier (ex: note.html, notes.xhtml, endnotes.html)
                if classification["source_type"] != "endnotes" and file_zip_path:
                    base_fn = os.path.basename(file_zip_path).lower()
                    if base_fn in ["note.html", "notes.html", "note.xhtml", "notes.xhtml", "endnotes.html", "endnotes.xhtml", "footnotes.html", "footnotes.xhtml"]:
                        classification["source_type"] = "endnotes"

                # Propagation contextuelle intelligente pour les sections et sous-sections
                if classification["source_type"] not in ["appendix", "endnotes"]:
                    # Si on remonte en profondeur ou qu'on change de niveau, purger les niveaux >= depth
                    for d in list(active_books_by_depth.keys()):
                        if d >= depth:
                            del active_books_by_depth[d]

                    is_continuation = bool(re.search(r'\b(part|partie|suite|tome|volume)\s*([2-9ivxlcdm]+)\b', norm_t, re.IGNORECASE))

                    if classification["book_code"]:
                        active_books_by_depth[depth] = {
                            "book_code": classification["book_code"],
                            "book_name": classification["book_name"],
                            "corpus_scope": classification["corpus_scope"]
                        }
                        last_sibling_book = active_books_by_depth[depth]
                    elif is_continuation and last_sibling_book:
                        # Suite directe du chapitre frère précédent
                        classification["book_code"] = last_sibling_book["book_code"]
                        classification["book_name"] = last_sibling_book["book_name"]
                        if classification["corpus_scope"] == "GLOBAL":
                            classification["corpus_scope"] = last_sibling_book["corpus_scope"]
                    else:
                        # Recherche d'un livre parent dans un niveau hiérarchique supérieur (d < depth)
                        parent_book = None
                        for d in sorted(active_books_by_depth.keys(), reverse=True):
                            if d < depth:
                                parent_book = active_books_by_depth[d]
                                break
                        if parent_book:
                            classification["book_code"] = parent_book["book_code"]
                            classification["book_name"] = parent_book["book_name"]
                            if classification["corpus_scope"] == "GLOBAL":
                                classification["corpus_scope"] = parent_book["corpus_scope"]
                        else:
                            last_sibling_book = None

                    if classification["corpus_scope"] == "GLOBAL" and book_dominant_scope != "GLOBAL":
                        classification["corpus_scope"] = book_dominant_scope
                
                # Déterminer si inclus par défaut
                is_boilerplate = any(re.search(r'\b' + re.escape(strip_accents(kw)) + r'\b', norm_t) for kw in BOILERPLATE_KEYWORDS)
                
                # Règle d'inclusion par défaut :
                # - Les sections / parties sont TOUJOURS incluses pour préserver la structure
                # - Tout livre ou chapitre de contenu (> 50 caractères) est coché d'office
                # - Les annexes/notes de fin/front-matter/boilerplate sont décochés d'office
                if is_section:
                    include_default = True
                    classification["source_type"] = "general"
                elif classification["source_type"] in ["appendix", "endnotes"] or is_boilerplate:
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

        cls._inspect_cache[cache_key] = metadata
        return metadata

    @classmethod
    def classify_chapter_title(
        cls, 
        title: str, 
        is_systematic_theology: bool = False, 
        is_intro_book: bool = False,
        book_dominant_scope: str = "GLOBAL",
        book_author: str = ""
    ) -> Dict[str, Any]:
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
            if norm == norm_author or (len(norm) > 4 and (norm == f"par {norm_author}" or norm == f"by {norm_author}")):
                return {"book_code": None, "book_name": None, "corpus_scope": "GLOBAL", "source_type": "appendix"}

        # Détection spécifique des sections de notes (notes de bas de page, notes de fin, endnotes)
        norm_clean = re.sub(r'^(?:[0-9]+|[ivxlcdm]+)[\.\:\-\s]+', '', norm, flags=re.I).strip()
        if (norm_clean in ["notes", "notes de fin", "notes de fin de texte", "notes de bas de page", "endnotes", "footnotes", "chapter notes", "notes des chapitres"] 
            or _has_word(["endnotes", "footnotes", "notes de fin", "notes de bas de page"])):
            return {"book_code": None, "book_name": None, "corpus_scope": "GLOBAL", "source_type": "endnotes"}

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

        # Nettoyage des préfixes et des numérotations ordinales de chapitres (ex: "30. Micah" -> "micah")
        clean_title = norm_ord
        clean_title = re.sub(r'^(?:[0-9]+|[ivxlcdm]+)[\.\:\-\s]+', '', clean_title, flags=re.I).strip()
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
        elif any(sep in norm for sep in [":", "-", "—", "–"]):
            # Détection de livre en sous-titre (ex: "THE GIFT OF I AM: DEUTERONOMY", "LAND, PART 1: JOSHUA")
            segments = re.split(r'[:\-—–]', norm)
            sub = segments[-1].strip()
            clean_sub = re.sub(r'\b(l[\'’]|la|le|les|de|d[\'’]|du|des|au|aux|a|the|of|to|part|partie)\b', ' ', sub)
            clean_sub = re.sub(r'[^\w\s]', '', clean_sub).strip()
            clean_sub = re.sub(r'\s+', ' ', clean_sub).strip()
            if clean_sub in BOOK_MAPPING:
                code = BOOK_MAPPING[clean_sub]
            else:
                for sub_part in re.split(r'\b(?:and|et|ou|or)\b', clean_sub):
                    sp = sub_part.strip()
                    if sp in BOOK_MAPPING:
                        code = BOOK_MAPPING[sp]
                        break

        if code:
            fr_name = REVERSE_BOOK_MAPPING.get(code, code)
            scope = "OT" if code in OT_CODES else ("NT" if code in NT_CODES else ("APOCRYPHA" if code in APOCRYPHA_CODES else "GLOBAL"))
            is_intro = (
                is_intro_book 
                or any(kw in norm for kw in ["introduction", "intro", "preface"]) 
                or clean_title == strip_accents(fr_name)
                or clean_title in BOOK_MAPPING
            )
            stype = "book_intro" if is_intro else ("systematic_theology" if is_systematic_theology else "general")
            return {
                "book_code": code,
                "book_name": fr_name,
                "corpus_scope": scope,
                "source_type": stype
            }

        # 5. Détection thématique générale par mots entiers
        default_scope = book_dominant_scope if book_dominant_scope in ["OT", "NT", "APOCRYPHA", "INTER"] else "GLOBAL"
        default_stype = "systematic_theology" if is_systematic_theology else "general"

        theol_keywords = [
            # Français & Anglais
            "salut", "salvation", "grace", "justification", "foi", "faith", "doctrine", "doctrines", 
            "trinite", "trinité", "trinity", "saint-esprit", "holy spirit", "dieu", "god", "christ", 
            "eschatologie", "eschatology", "theologie", "théologie", "theology", "church", "eglise", 
            "église", "sanctification", "glorification", "regeneration", "régénération", 
            "creation", "création", "atonement", "expiation", "resurrection", "résurrection", 
            "covenant", "alliance", "sin", "sins", "peche", "péché", "providence", "angels", 
            "anges", "demons", "démons", "heaven", "ciel", "hell", "enfer", "prayer", "priere", 
            "prière", "worship", "culte", "sacrament", "sacrement", "bapteme", "baptême", "baptism", 
            "death", "mort", "election", "élection", "predestination", "prédestination", 
            "perseverance", "persévérance", "kingdom", "royaume", "reign", "regne", "règne", 
            "messiah", "messie", "righteousness", "justice", "law", "loi", "ethics", "ethique", 
            "éthique", "redemption", "rédemption", "parable", "parables", "parabole", "paraboles", 
            "disciple", "disciples", "discipleship", "incarnation", "reconciliation", 
            "réconciliation", "communion", "christology", "christologie", "pneumatology", 
            "pneumatologie", "ecclesiology", "ecclésiologie", "soteriology", "sotériologie", 
            "anthropology", "anthropologie", "baptist", "baptiste", "son of man", "fils de l'homme", 
            "son of god", "fils de dieu"
        ]

        is_nt_theme = _has_word(["christ", "jesus", "messie", "messiah", "evangile", "gospel", "parole divine", "baptist", "baptiste", "son of man", "fils de l'homme", "apostle", "apotre"])
        is_ot_theme = _has_word(["yahwe", "yahweh", "torah", "tanakh", "israel", "patriarch", "patriarchs", "patriarche", "patriarches", "prophet", "prophets", "prophete", "prophetes"])

        if _has_word(theol_keywords):
            sc = "NT" if is_nt_theme else ("OT" if is_ot_theme else default_scope)
            return {"book_code": None, "book_name": None, "corpus_scope": sc, "source_type": "systematic_theology"}
        elif is_nt_theme:
            return {"book_code": None, "book_name": None, "corpus_scope": "NT", "source_type": default_stype}
        elif is_ot_theme:
            sc = "OT" if default_scope in ["OT", "GLOBAL"] else default_scope
            return {"book_code": None, "book_name": None, "corpus_scope": sc, "source_type": default_stype}
        elif _has_word(["lire", "comprendre", "symetrie", "harmonie", "etude", "canon", "inspiration", "revelation", "introduction"]):
            st = "ot_context" if default_scope == "OT" else ("nt_context" if default_scope == "NT" else "biblical_theology")
            return {"book_code": None, "book_name": None, "corpus_scope": default_scope, "source_type": st}

        return {
            "book_code": None,
            "book_name": None,
            "corpus_scope": default_scope,
            "source_type": default_stype
        }

    @classmethod
    def process_chapter_html(
        cls, 
        z: zipfile.ZipFile, 
        zip_file: str, 
        html_content: str,
        global_soups_cache: Optional[Dict[str, Any]] = None
    ) -> Tuple[List[str], List[Dict[str, str]]]:
        """
        Analyse universelle et haute-performance du HTML d'un chapitre EPUB :
        - Résout et extrait les notes de bas de page (inter-fichiers et intra-fichiers)
        - Normalise les appels de notes en marqueurs markdown standardisés [^id]
        - Extrait les paragraphes structurés, titres et citations
        - Retourne (paragraphs, footnotes)
        """
        soup = BeautifulSoup(html_content, 'html.parser')

        # 1. Nettoyer les éléments indésirables (scripts, styles, nav)
        for tag in soup(["script", "style", "nav"]):
            tag.decompose()

        # 2. Supprimer les balises de pagination papier InDesign (ex: <span class="page-papier">[14]</span>)
        for p_tag in soup.find_all(attrs={"class": lambda c: c and any(k in str(c).lower() for k in ["page-papier", "page_papier", "pagenum", "pagebreak", "page-number"])}):
            p_tag.decompose()

        # 3. Pré-marquer les conteneurs de notes dédiés dans le fichier courant pour éviter les comparaisons récursives O(N^2)
        for fn_cont in soup.find_all(attrs={"class": lambda c: c and any(k in str(c).lower() for k in ["_idfootnotes", "footnotes", "theol-footnotes"])}):
            fn_cont['_os_skip_fn'] = '1'
            for child in fn_cont.find_all(True):
                child['_os_skip_fn'] = '1'

        for aside in soup.find_all('aside'):
            if aside.get('epub:type') == 'footnote' or 'footnote' in str(aside.get('class', [])).lower():
                aside['_os_skip_fn'] = '1'
                for child in aside.find_all(True):
                    child['_os_skip_fn'] = '1'

        # Cache partagé de parsing des fichiers du zip (évite de re-parser les mêmes fichiers de notes entre chapitres)
        zip_soups_cache = global_soups_cache if global_soups_cache is not None else {}
        if zip_file not in zip_soups_cache:
            zip_soups_cache[zip_file] = soup

        def get_file_soup(target_zip):
            if target_zip not in zip_soups_cache:
                if target_zip in z.namelist():
                    content = z.read(target_zip).decode('utf-8', errors='ignore')
                    zip_soups_cache[target_zip] = BeautifulSoup(content, 'html.parser')
                else:
                    zip_soups_cache[target_zip] = None
            return zip_soups_cache[target_zip]

        # Identifier tous les liens candidats d'appels de notes
        candidate_links = []
        seen_a = set()

        for tag in soup.find_all(['a', 'sup']):
            a_tag = tag if tag.name == 'a' else tag.find('a')
            if not a_tag or a_tag in seen_a:
                continue

            href = a_tag.get('href', '').strip()
            epub_type = (a_tag.get('epub:type') or tag.get('epub:type') or '').lower()
            cls_str = (' '.join(a_tag.get('class', [])) + ' ' + ' '.join(tag.get('class', []))).lower()

            is_fn = False
            if any(k in epub_type for k in ['noteref', 'footnote']):
                is_fn = True
            elif any(k in cls_str for k in ['footnote', 'noteref', 'fnref', '_idfootnotelink', 'footnote-link', 'notelink', 'ref-note']):
                is_fn = True
            elif href and '#' in href:
                target_rel, _, anchor = href.partition('#')
                h_lower = href.lower()
                if any(k in h_lower for k in ['note', 'fn', 'ftn', 'foot', 'endnote']):
                    is_fn = True
                elif target_rel and any(k in target_rel.lower() for k in ['note', 'fn', 'endnote']):
                    is_fn = True
                elif tag.name == 'sup':
                    is_fn = True
                elif re.match(r'^(?:ch\d+)?(?:fn|note|ftn|endnote)\d*', anchor, re.I):
                    is_fn = True
                elif a_tag.get_text(strip=True).isdigit() or (a_tag.get_text(strip=True).startswith('[') and a_tag.get_text(strip=True).rstrip(']').isdigit()):
                    is_fn = True

            if is_fn:
                seen_a.add(a_tag)
                candidate_links.append((tag, a_tag, href))

        extracted_footnotes = {}
        fn_counter = 0
        base_ch_filename = zip_file.split('/')[-1]

        for wrapper_tag, a_tag, href in candidate_links:
            callout_text = a_tag.get_text(strip=True) or wrapper_tag.get_text(strip=True)
            target_file_rel, _, anchor = href.partition('#')
            if target_file_rel:
                target_zip = posixpath.normpath(posixpath.join(posixpath.dirname(zip_file), target_file_rel))
            else:
                target_zip = zip_file

            target_soup = get_file_soup(target_zip)
            note_text = ""

            if target_soup and anchor:
                target_el = target_soup.find(attrs={'id': anchor}) or target_soup.find(attrs={'name': anchor})
                if target_el:
                    # Trouver le conteneur de bloc de la note
                    container = target_el
                    if container.name in ['a', 'span', 'b', 'i', 'sup', 'sub', 'em', 'strong', 'cite']:
                        block_parent = container.find_parent(['p', 'li', 'dd', 'aside', 'div', 'tr', 'td', 'blockquote'])
                        if block_parent:
                            container = block_parent

                    if target_zip == zip_file:
                        container['_os_skip_fn'] = '1'
                        for child in container.find_all(True):
                            child['_os_skip_fn'] = '1'

                    # Extraction propre du texte de la note sans réinstanciation coûteuse de BeautifulSoup
                    raw_txt = container.get_text(separator=' ', strip=True)
                    # Nettoyer les mentions de retour
                    raw_txt = re.sub(r'\b(?:retour|back|\[retour\]|[↩↑^])\b', '', raw_txt, flags=re.I).strip()
                    # Nettoyer les préfixes numériques résiduels ("1.", "[1]", "1 ")
                    note_text = re.sub(r'^(?:\[\^?\d+\]|\b\d+\b)\s*[\.\:\-\)]*\s*', '', raw_txt).strip()

            # Déterminer l'ID propre de la note
            clean_num = re.sub(r'[^\w\d]', '', callout_text)
            if clean_num:
                fn_id = clean_num
            else:
                fn_counter += 1
                fn_id = str(fn_counter)

            # Remplacer l'appel par le marqueur propre [^id]
            replace_target = wrapper_tag if (wrapper_tag.name == 'sup' and wrapper_tag != a_tag) else a_tag
            replace_target.replace_with(f" [^{fn_id}] ")

            if note_text and fn_id not in extracted_footnotes:
                extracted_footnotes[fn_id] = note_text

        # Extraire les paragraphes du corps de texte (accès O(1) sans parcours récursif de parents)
        paragraphs = []
        for el in soup.find_all(["h1", "h2", "h3", "h4", "h5", "h6", "p", "li", "blockquote", "aside"]):
            if el.has_attr('_os_skip_fn'):
                continue

            tag_name = el.name.lower()
            classes = " ".join(el.get("class", [])) if el.get("class") else ""
            classes_lower = classes.lower()

            # Vérifier si cet élément est une définition de note de fin non liée
            is_fn_def = False
            if ("footnote" in classes_lower or "note" in classes_lower or el.get("epub:type") == "footnote" or tag_name == "aside"):
                is_fn_def = True

            txt = el.get_text(separator=" ", strip=True)
            if not txt or txt == "[Retour au livre]" or len(txt) < 2:
                continue

            txt = re.sub(r'\s*\[\^([a-zA-Z0-9_\-]+)\]\s*', r' [^\1] ', txt)
            txt = re.sub(r'[ \t]+', ' ', txt).strip()

            if is_fn_def:
                m_fn = re.match(r'^(?:\[\^?(\d+)\]|\b(\d+)\b)\s*[\.\:\-\)]*\s*(.*)', txt)
                if m_fn:
                    fn_id = m_fn.group(1) or m_fn.group(2)
                    fn_body = m_fn.group(3).strip()
                    if fn_id not in extracted_footnotes:
                        extracted_footnotes[fn_id] = fn_body
                continue

            is_h1 = tag_name == "h1" or "chapter-title" in classes_lower or "ch-title" in classes_lower
            is_h2 = tag_name == "h2" or "section-title" in classes_lower or "part-title" in classes_lower or "titre1" in classes_lower
            is_h3 = tag_name == "h3" or "subsection-title" in classes_lower or "subheading" in classes_lower or "titre2" in classes_lower
            is_h4 = tag_name in ["h4", "h5", "h6"] or "titre3" in classes_lower or "rubrique" in classes_lower

            if not (is_h1 or is_h2 or is_h3 or is_h4) and tag_name in ["p", "div"]:
                if any(k in classes_lower for k in ["title", "titre", "heading", "head", "subhead", "sectiontitle"]):
                    is_h3 = True

            if is_h1:
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
            full_txt = soup.get_text(separator="\n", strip=True)
            if full_txt:
                paragraphs = [p.strip() for p in full_txt.split("\n") if p.strip()]

        footnotes = []
        sorted_fn_ids = sorted(extracted_footnotes.keys(), key=lambda x: int(x) if str(x).isdigit() else str(x))
        for fid in sorted_fn_ids:
            footnotes.append({"id": fid, "text": extracted_footnotes[fid]})

        return paragraphs, footnotes

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
        global_soups_cache = {}
        raw_files_cache: Dict[str, str] = {}

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
                    if zip_file not in raw_files_cache:
                        raw_files_cache[zip_file] = z.read(zip_file).decode('utf-8', errors='ignore')
                    html_content = raw_files_cache[zip_file]
                    if ch.get("anchor"):
                        html_content = cls.slice_html_by_chapter(html_content, ch, selected_chapters)

                    paragraphs, footnotes = cls.process_chapter_html(
                        z, zip_file, html_content, global_soups_cache=global_soups_cache
                    )

                    # Ajouter les définitions de notes à la fin du texte pour enrichir l'indexation sémantique
                    if footnotes:
                        for fn in footnotes:
                            paragraphs.append(f"[^{fn['id']}]: {fn['text']}")

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
                
                if toc_entries and len(toc_entries) > 2:
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
                if toc_entries and len(toc_entries) > 2:
                    return toc_entries
            except Exception as e:
                logger.error(f"[EpubLoader] Erreur parsing Nav: {e}")

        # 3. Récupération intelligente depuis le HTML interne si le TOC est absent ou tronqué (ex: EPUB convertis depuis Kindle/Calibre)
        if len(toc_entries) <= 2:
            recovered = cls._recover_toc_from_html(z, opf_dir, manifest, spine)
            if len(recovered) > len(toc_entries):
                return recovered

        if toc_entries:
            return toc_entries

        # 4. Fallback : utiliser le Spine si aucun TOC n'a été trouvé
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
    def _recover_toc_from_html(
        cls, 
        z: zipfile.ZipFile, 
        opf_dir: str, 
        manifest: Dict[str, Dict[str, str]], 
        spine: List[str]
    ) -> List[Dict[str, Any]]:
        """
        Récupère automatiquement la table des matières depuis le contenu HTML interne
        lorsque le fichier toc.ncx ou spine est tronqué ou dégénéré (ex: EPUB convertis depuis Kindle/Calibre).
        """
        candidate_files = []
        for idref in spine:
            if idref in manifest:
                href = manifest[idref].get("href", "")
                full_path = cls._resolve_zip_path(opf_dir, href)
                if "cover" not in full_path.lower():
                    candidate_files.append((full_path, href))

        if not candidate_files:
            for n in z.namelist():
                if n.lower().endswith(('.html', '.xhtml', '.htm')) and "cover" not in n.lower():
                    rel_h = os.path.relpath(n, opf_dir).replace('\\', '/') if opf_dir else n
                    candidate_files.append((n, rel_h))

        for full_zip_path, rel_href in candidate_files:
            if full_zip_path not in z.namelist():
                continue
            
            # Ne tester que les fichiers ayant du contenu significatif (> 50 Ko)
            if z.getinfo(full_zip_path).file_size < 50000:
                continue

            try:
                raw_html = z.read(full_zip_path).decode('utf-8', errors='ignore')
            except Exception:
                continue

            # --- METHODE 1 : Détection d'un bloc de Table des Matières HTML ---
            toc_match = re.search(
                r'<h[1-3][^>]*>\s*(?:<[^>]+>\s*)*(?:TABLE OF CONTENTS|CONTENTS|TABLE DES MATI[EÈ]RES|SOMMAIRE|INHALTSVERZEICHNIS)\s*(?:<[^>]+>\s*)*</h[1-3]>', 
                raw_html, 
                re.I
            )
            if toc_match:
                start_pos = toc_match.end()
                next_h1 = re.search(r'<h1[^>]*>', raw_html[start_pos:], re.I)
                end_pos = start_pos + next_h1.start() if next_h1 else start_pos + 80000
                toc_chunk = raw_html[start_pos:end_pos]
                
                soup_toc = BeautifulSoup(toc_chunk, 'html.parser')
                entries = []
                for el in soup_toc.find_all(['p', 'blockquote', 'li']):
                    if el.find(['p', 'blockquote', 'li']):
                        continue
                    
                    txt = ' '.join(el.get_text().split()).strip()
                    if not txt or len(txt) < 2:
                        continue

                    target_anchor = None
                    for a in el.find_all('a'):
                        href_val = a.get('href', '')
                        if '#' in href_val:
                            target_anchor = href_val.split('#')[1]
                            break
                        elif a.get('filepos'):
                            fp = a.get('filepos').lstrip('0')
                            if a.get('id') and not a.get('id').startswith('filepos'):
                                target_anchor = a.get('id')
                            elif fp:
                                target_anchor = f"filepos{fp}"
                            break
                        elif a.get('id') and not a.get('id').startswith('filepos'):
                            target_anchor = a.get('id')
                            break

                    if not target_anchor:
                        for a in el.find_all('a'):
                            if a.get('id'):
                                target_anchor = a.get('id')
                                break

                    is_part = bool(re.match(r'^(part\s+[a-z0-9]+|partie\s+[a-z0-9]+|volume\s+[a-z0-9]+|tome\s+[a-z0-9]+|livre\s+[a-z0-9]+)', txt, re.I))
                    is_chap = bool(re.match(r'^(chapter\s+[0-9]+|chapitre\s+[0-9]+)', txt, re.I))
                    depth = 0 if (is_part or el.name == 'p') else 1

                    src_entry = f"{rel_href}#{target_anchor}" if target_anchor else rel_href
                    entries.append({
                        "title": txt,
                        "src": src_entry,
                        "depth": depth
                    })

                if len(entries) >= 3:
                    return entries

            # --- METHODE 2 : Analyse des balises d'en-tête structurelles (h1, h2) ---
            soup_full = BeautifulSoup(raw_html, 'html.parser')
            heading_entries = []
            seen_anchors = set()

            for h in soup_full.find_all(['h1', 'h2']):
                txt = ' '.join(h.get_text().split()).strip()
                if not txt or len(txt) < 3:
                    continue
                txt_up = txt.upper()
                if any(k in txt_up for k in ['THOUGHT QUESTION', 'EXCURSUS', 'FIGURE ', 'TABLE ']):
                    continue

                is_part = bool(re.match(r'^(part\s+[a-z0-9]+|partie\s+[a-z0-9]+|volume\s+[a-z0-9]+|tome\s+[a-z0-9]+|livre\s+[a-z0-9]+)', txt, re.I))
                is_chap = bool(re.match(r'^(chapter\s+[0-9]+|chapitre\s+[0-9]+)', txt, re.I))
                is_major_section = any(k in txt_up for k in [
                    'CONTENTS', 'TABLE OF CONTENTS', 'TABLE DES MATIERES', 
                    'PREFACE', 'ABBREVIATIONS', 'INTRODUCTION', 'WORKS CITED', 
                    'BIBLIOGRAPHY', 'BIBLIOGRAPHIE', 'INDEX', 'AUTHOR INDEX', 
                    'SUBJECT INDEX', 'ABOUT THE AUTHOR', 'ABOUT THE PUBLISHER'
                ])

                if not (h.name == 'h1' or is_part or is_chap or (is_major_section and len(txt) < 60)):
                    continue

                aid = None
                for a in h.find_all('a'):
                    if a.get('id') or a.get('name'):
                        aid = a.get('id') or a.get('name')
                        break
                if not aid:
                    prev_a = h.find_previous('a')
                    if prev_a and (prev_a.get('id') or prev_a.get('name')):
                        aid = prev_a.get('id') or prev_a.get('name')

                if aid and aid in seen_anchors:
                    continue
                if aid:
                    seen_anchors.add(aid)

                depth = 0 if (is_part or is_major_section) else 1
                src_entry = f"{rel_href}#{aid}" if aid else rel_href
                heading_entries.append({
                    "title": txt,
                    "src": src_entry,
                    "depth": depth
                })

            if len(heading_entries) >= 3:
                return heading_entries

        return []

    @classmethod
    def slice_html_by_chapter(
        cls, 
        raw_html: str, 
        ch_info: Dict[str, Any], 
        all_chapters: List[Dict[str, Any]]
    ) -> str:
        """
        Découpe un fichier HTML monolithique pour ne conserver que la portion correspondant
        au chapitre donné (de son ancre de début jusqu'à l'ancre du chapitre suivant dans le même fichier).
        """
        anchor = ch_info.get("anchor")
        if not anchor:
            return raw_html

        zip_file = ch_info.get("zip_file")
        current_idx = None
        for i, c in enumerate(all_chapters):
            if c.get("id") == ch_info.get("id"):
                current_idx = i
                break

        next_anchor = None
        if current_idx is not None:
            for j in range(current_idx + 1, len(all_chapters)):
                c_next = all_chapters[j]
                if c_next.get("zip_file") == zip_file and c_next.get("anchor"):
                    next_anchor = c_next.get("anchor")
                    break

        # Chercher la fin de la table des matières éventuelle pour éviter de matcher dans le sommaire
        toc_match = re.search(
            r'<h[1-3][^>]*>\s*(?:<[^>]+>\s*)*(?:TABLE OF CONTENTS|CONTENTS|TABLE DES MATI[EÈ]RES|SOMMAIRE)\s*(?:<[^>]+>\s*)*</h[1-3]>', 
            raw_html, 
            re.I
        )
        search_start = 0
        if toc_match:
            next_h1 = re.search(r'<h1[^>]*>', raw_html[toc_match.end():], re.I)
            search_start = toc_match.end() + (next_h1.start() if next_h1 else 40000)

        pattern_start = rf'(?:id|name)=["\']{re.escape(anchor)}["\']'
        m_start = re.search(pattern_start, raw_html[search_start:])
        if not m_start:
            m_start = re.search(pattern_start, raw_html)
            start_pos = m_start.start() if m_start else 0
        else:
            start_pos = search_start + m_start.start()

        tag_back = raw_html.rfind('<', max(0, start_pos - 150), start_pos)
        if tag_back != -1:
            start_pos = tag_back

        end_pos = len(raw_html)
        if next_anchor:
            pattern_end = rf'(?:id|name)=["\']{re.escape(next_anchor)}["\']'
            m_end = re.search(pattern_end, raw_html[start_pos + 50:])
            if m_end:
                end_pos = start_pos + 50 + m_end.start()
                tag_back_end = raw_html.rfind('<', max(0, end_pos - 150), end_pos)
                if tag_back_end != -1:
                    end_pos = tag_back_end

        return raw_html[start_pos:end_pos]

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
