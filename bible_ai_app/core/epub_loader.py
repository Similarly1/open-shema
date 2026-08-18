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
            
            # 3. Classifier chaque chapitre et estimer la taille
            is_syst_theol = any(w in strip_accents(metadata.get("title", "")) for w in ["systematic theology", "theologie systematique", "theologie dogmatique", "dogmatique", "christian theology", "theologie chretienne"])
            classified_chapters = []
            for idx, entry in enumerate(toc_entries):
                title = entry.get("title", f"Chapitre {idx+1}").strip()
                src = entry.get("src", "")
                
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
                
                classification = cls.classify_chapter_title(title, is_systematic_theology=is_syst_theol)
                
                # Déterminer si inclus par défaut
                norm_t = strip_accents(title)
                is_boilerplate = any(kw in norm_t for kw in BOILERPLATE_KEYWORDS)
                
                # Règle d'inclusion par défaut :
                # - Tout livre biblique identifié est coché d'office
                # - Les annexes/front-matter/boilerplate sont décochés d'office
                # - Les autres chapitres de contenu (> 50 caractères) sont cochés
                if classification["book_code"] is not None:
                    include_default = True
                elif is_boilerplate or classification["source_type"] == "appendix":
                    include_default = False
                else:
                    include_default = size_chars > 50

                classified_chapters.append({
                    "id": idx + 1,
                    "title": title,
                    "src": src,
                    "zip_file": file_zip_path,
                    "anchor": src.split("#")[1] if "#" in src else None,
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
    def classify_chapter_title(cls, title: str, is_systematic_theology: bool = False) -> Dict[str, Any]:
        """
        Détecte automatiquement le livre biblique, le corpus et le type RAG à partir du titre du chapitre.
        """
        norm = strip_accents(title)

        # 0. Détection prioritaire des introductions de groupes de livres (sections globales)
        if any(w in norm for w in ["old testament", "ancien testament"]):
            return {"book_code": None, "book_name": None, "corpus_scope": "OT", "source_type": "ot_context"}
        elif any(w in norm for w in ["new testament", "nouveau testament"]):
            return {"book_code": None, "book_name": None, "corpus_scope": "NT", "source_type": "nt_context"}
        elif any(w in norm for w in ["historical books", "livres historiques"]):
            return {"book_code": None, "book_name": None, "corpus_scope": "OT", "source_type": "ot_context"}
        elif any(w in norm for w in ["wisdom and lyrical", "poetic", "livres poetiques", "livres de sagesse"]):
            return {"book_code": None, "book_name": None, "corpus_scope": "OT", "source_type": "ot_context"}
        elif any(w in norm for w in ["prophetic books", "livres prophetiques", "prophetes"]):
            return {"book_code": None, "book_name": None, "corpus_scope": "OT", "source_type": "ot_context"}
        elif any(w in norm for w in ["pentateuch", "pentateuque", "torah", "loi"]):
            return {"book_code": None, "book_name": None, "corpus_scope": "OT", "source_type": "ot_context"}
        elif any(w in norm for w in ["gospels and acts", "evangiles et actes", "four gospels", "quatre evangiles"]):
            return {"book_code": None, "book_name": None, "corpus_scope": "NT", "source_type": "nt_context"}
        elif any(w in norm for w in ["letters and revelation", "epistles", "epitres"]):
            return {"book_code": None, "book_name": None, "corpus_scope": "NT", "source_type": "nt_context"}

        # 1. Normalisation ordinale (premier/premiere -> 1, deuxieme -> 2, troisieme -> 3)
        norm_ord = re.sub(r'\b(premier|premiere|1er|1ere)\b', '1', norm)
        norm_ord = re.sub(r'\b(deuxieme|2eme|2e)\b', '2', norm_ord)
        norm_ord = re.sub(r'\b(troisieme|3eme|3e)\b', '3', norm_ord)
        norm_ord = re.sub(r'\b(quatrieme|4eme|4e)\b', '4', norm_ord)

        # 2. Nettoyage des préfixes et formules d'introduction courants
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
        else:
            # Tester si une forme ou sous-chaîne correspond à un livre biblique
            # On trie les clés par longueur décroissante
            for b_name, b_code in sorted(BOOK_MAPPING.items(), key=lambda x: -len(x[0])):
                # IMPORTANT : Ne jamais matcher les abréviations courtes de 1 ou 2 lettres dans une phrase (ex: 'is', 'am', 'os', 'in')
                if len(b_name) <= 2:
                    continue
                # Pour les abréviations de 3 lettres ambiguës (ex: 'mal', 'am', 'na', 'act', 'can', 'con'),
                # ne matcher que si c'est le mot exact
                if len(b_name) == 3 and not b_name[0].isdigit() and b_name in ["mal", "am", "na", "os", "mi", "so", "za", "act", "can", "con"]:
                    if clean_title == b_name or norm == b_name:
                        code = b_code
                        break
                    continue

                if b_name[0].isdigit():
                    if re.search(r'\b' + re.escape(b_name) + r'\b', clean_title) or re.search(r'\b' + re.escape(b_name) + r'\b', norm_ord):
                        code = b_code
                        break
                else:
                    if re.search(r'\b' + re.escape(b_name) + r'\b', clean_title):
                        code = b_code
                        break

        if code:
            fr_name = REVERSE_BOOK_MAPPING.get(code, code)
            if code in OT_CODES:
                scope = "OT"
            elif code in NT_CODES:
                scope = "NT"
            elif code in APOCRYPHA_CODES:
                scope = "APOCRYPHA"
            else:
                scope = "GLOBAL"
                
            return {
                "book_code": code,
                "book_name": fr_name,
                "corpus_scope": scope,
                "source_type": "book_intro"
            }

        # Détection thématique générale
        theol_keywords = [
            "salut", "grace", "justification", "foi", "doctrine", "trinite", "trinity", 
            "saint-esprit", "holy spirit", "dieu", "god", "christ", "eschatologie", "eschatology", 
            "theologie", "theology", "church", "eglise", "sanctification", "glorification", 
            "regeneration", "creation", "atonement", "expiation", "resurrection", "covenant", 
            "alliance", "sin", "peche", "providence", "angels", "anges", "demons", "heaven", 
            "ciel", "hell", "enfer", "prayer", "priere", "worship", "culte", "sacrament", 
            "bapteme", "baptism", "death", "mort", "election", "predestination", "perseverance"
        ]

        if any(w in norm for w in ["intertestament", "between the testaments", "periode perse", "hasmoneen", "maccabee"]):
            return {"book_code": None, "book_name": None, "corpus_scope": "INTER", "source_type": "ot_context"}
        elif any(w in norm for w in ["apocryphe", "deuterocanonique"]):
            return {"book_code": None, "book_name": None, "corpus_scope": "APOCRYPHA", "source_type": "general"}
        elif any(w in norm for w in ["nouveau testament", "new testament", "evangiles", "actes", "epitres"]):
            return {"book_code": None, "book_name": None, "corpus_scope": "NT", "source_type": "nt_context"}
        elif any(w in norm for w in ["ancien testament", "old testament", "pentateuque", "prophetes", "psaumes"]):
            return {"book_code": None, "book_name": None, "corpus_scope": "OT", "source_type": "ot_context"}
        elif any(w in norm for w in theol_keywords):
            return {"book_code": None, "book_name": None, "corpus_scope": "GLOBAL", "source_type": "systematic_theology"}
        elif any(w in norm for w in ["lire", "comprendre", "symetrie", "harmonie", "etude", "canon", "inspiration", "revelation"]):
            return {"book_code": None, "book_name": None, "corpus_scope": "GLOBAL", "source_type": "biblical_theology"}
        elif any(kw in norm for kw in BOILERPLATE_KEYWORDS):
            return {"book_code": None, "book_name": None, "corpus_scope": "GLOBAL", "source_type": "appendix"}

        # Si l'ouvrage est une Théologie Systématique, tout chapitre de contenu est par défaut 'systematic_theology'
        default_stype = "systematic_theology" if is_systematic_theology else "general"

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

                    # Nettoyer les éléments indésirables (scripts, styles, retours aux livres/liens popups)
                    for tag in soup(["script", "style", "nav"]):
                        tag.decompose()

                    # Récupérer les blocs de texte (paragraphes, titres, listes)
                    paragraphs = []
                    for el in soup.find_all(["h1", "h2", "h3", "h4", "p", "li"]):
                        txt = el.get_text(separator=" ", strip=True)
                        # Ignorer les liens de retour de popups comme "[Retour au livre]"
                        if txt and txt != "[Retour au livre]" and len(txt) > 3:
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
    ) -> List[Dict[str, str]]:
        """Extrait les points d'entrée de la table des matières (NCX ou Nav XHTML)."""
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

                for np in root.findall(".//navPoint"):
                    lbl = np.find("navLabel/text")
                    cnt = np.find("content")
                    if lbl is not None and lbl.text:
                        title_t = lbl.text.strip()
                        src_t = cnt.get("src", "") if cnt is not None else ""
                        if title_t:
                            toc_entries.append({"title": title_t, "src": src_t})
                
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
                    for a in nav_tag.find_all('a'):
                        t = a.get_text(strip=True)
                        h = a.get('href', '')
                        if t:
                            toc_entries.append({"title": t, "src": h})
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
                    "src": href
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
        """Extrait l'image de couverture dans un dossier temporaire pour l'affichage dans l'UI."""
        try:
            ext = os.path.splitext(cover_zip_path)[1] or ".jpg"
            temp_dir = os.path.join(tempfile.gettempdir(), "bible_ai_covers")
            os.makedirs(temp_dir, exist_ok=True)
            temp_file = os.path.join(temp_dir, f"cover_{os.path.basename(cover_zip_path)}")
            
            with open(temp_file, "wb") as f:
                f.write(z.read(cover_zip_path))
            return temp_file
        except Exception as e:
            logger.error(f"[EpubLoader] Erreur extraction couverture: {e}")
            return None
