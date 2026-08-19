"""
Convertisseur et Importateur Universel de Bibles EPUB vers le format JSON de Bible AI.
Gère les EPUBs multi-fichiers avec ancres de versets (TOB, Segond, Crampon),
les EPUBs InDesign (Parole Vivante, Sagesse Vivante) et les EPUBs structurés par chapitres.
"""

import os
import re
import json
import zipfile
import logging
from typing import Dict, Any, Optional, List, Tuple
from bs4 import BeautifulSoup, NavigableString, Tag

from core.reference_parser import (
    BOOK_MAPPING, 
    REVERSE_BOOK_MAPPING, 
    strip_accents,
    get_standard_book_code,
    get_french_book_name
)

logger = logging.getLogger(__name__)

STD_TO_USFM = {
    "Gen": "GEN", "Exo": "EXO", "Lev": "LEV", "Num": "NUM", "Deu": "DEU",
    "Jos": "JOS", "Jdg": "JDG", "Rut": "RUT", "1Sa": "1SA", "2Sa": "2SA",
    "1Ki": "1KI", "2Ki": "2KI", "1Ch": "1CH", "2Ch": "2CH", "Ezr": "EZR",
    "Neh": "NEH", "Est": "EST", "Job": "JOB", "Psa": "PSA", "Pro": "PRO",
    "Ecc": "ECC", "Sol": "SNG", "Isa": "ISA", "Jer": "JER", "Lam": "LAM",
    "Eze": "EZK", "Dan": "DAN", "Hos": "HOS", "Joe": "JOL", "Amo": "AMO",
    "Oba": "OBA", "Jon": "JON", "Mic": "MIC", "Nah": "NAM", "Hab": "HAB",
    "Zep": "ZEP", "Hag": "HAG", "Zec": "ZEC", "Mal": "MAL",
    "Mat": "MAT", "Mar": "MRK", "Luk": "LUK", "Joh": "JHN", "Act": "ACT",
    "Rom": "ROM", "1Co": "1CO", "2Co": "2CO", "Gal": "GAL", "Eph": "EPH",
    "Phi": "PHP", "Col": "COL", "1Th": "1TH", "2Th": "2TH", "1Ti": "1TI",
    "2Ti": "2TI", "Tit": "TIT", "Phm": "PHM", "Heb": "HEB", "Jam": "JAS",
    "1Pe": "1PE", "2Pe": "2PE", "1Jo": "1JN", "2Jo": "2JN", "3Jo": "3JN",
    "Jud": "JUD", "Rev": "REV",
    "Tob": "TOB", "Jdt": "JDT", "Wis": "WIS", "Sir": "SIR", "Bar": "BAR",
    "1Ma": "1MA", "2Ma": "2MA", "3Ma": "3MA", "4Ma": "4MA", "Man": "MAN"
}

CANONICAL_BOOKS = {
    # Nouveau Testament
    'matthieu': 'Matthieu', 'matt': 'Matthieu', 'mt': 'Matthieu', 'levangileselonsaintmatthieu': 'Matthieu',
    'marc': 'Marc', 'mark': 'Marc', 'mc': 'Marc', 'levangileselonsaintmarc': 'Marc',
    'luc': 'Luc', 'luke': 'Luc', 'lc': 'Luc', 'levangileselonsaintluc': 'Luc',
    'jean': 'Jean', 'john': 'Jean', 'jn': 'Jean', 'levangileselonsaintjean': 'Jean',
    'actes': 'Actes', 'acts': 'Actes', 'ac': 'Actes', 'lesactesdesapotres': 'Actes', 'actesdesapotres': 'Actes',
    'rome': 'Romains', 'romains': 'Romains', 'rom': 'Romains', 'rm': 'Romains', 'epitreauxromains': 'Romains',
    'cor1': '1 Corinthiens', '1cor': '1 Corinthiens', '1corinthiens': '1 Corinthiens', 'premierlivredescorinthiens': '1 Corinthiens', 'premierepitreauxcorinthiens': '1 Corinthiens',
    'cor2': '2 Corinthiens', '2cor': '2 Corinthiens', '2corinthiens': '2 Corinthiens', 'deuxiemelivredescorinthiens': '2 Corinthiens', 'deuxiemeepitreauxcorinthiens': '2 Corinthiens',
    'galates': 'Galates', 'gal': 'Galates', 'ga': 'Galates', 'epitreauxgalates': 'Galates',
    'ephesiens': 'Éphésiens', 'eph': 'Éphésiens', 'ep': 'Éphésiens', 'epitreauxephesiens': 'Éphésiens',
    'philippiens': 'Philippiens', 'phil': 'Philippiens', 'ph': 'Philippiens', 'epitreauxphilippiens': 'Philippiens',
    'colossiens': 'Colossiens', 'col': 'Colossiens', 'epitreauxcolossiens': 'Colossiens',
    'thess1': '1 Thessaloniciens', '1thess': '1 Thessaloniciens', '1thessaloniciens': '1 Thessaloniciens', 'premierepitreauxthessaloniciens': '1 Thessaloniciens',
    'thess2': '2 Thessaloniciens', '2thess': '2 Thessaloniciens', '2thessaloniciens': '2 Thessaloniciens', 'deuxiemeepitreauxthessaloniciens': '2 Thessaloniciens',
    'tim1': '1 Timothée', '1tim': '1 Timothée', '1timothee': '1 Timothée', 'premierepitreatimothee': '1 Timothée', '1thimothees': '1 Timothée',
    'tim2': '2 Timothée', '2tim': '2 Timothée', '2timothee': '2 Timothée', 'deuxiemeepitreatimothee': '2 Timothée', '2thimothees': '2 Timothée',
    'tite': 'Tite', 'titus': 'Tite', 'tt': 'Tite', 'epitreatite': 'Tite',
    'philemon': 'Philémon', 'phlm': 'Philémon', 'phm': 'Philémon', 'epitreaphilemon': 'Philémon',
    'hebreux': 'Hébreux', 'heb': 'Hébreux', 'epitreauxhebreux': 'Hébreux',
    'jacques': 'Jacques', 'jas': 'Jacques', 'jc': 'Jacques', 'epitredesaintjacques': 'Jacques',
    'pi1': '1 Pierre', '1pet': '1 Pierre', '1pierre': '1 Pierre', '1p': '1 Pierre', 'premierepitredesaintpierre': '1 Pierre',
    'pi2': '2 Pierre', '2pet': '2 Pierre', '2pierre': '2 Pierre', '2p': '2 Pierre', 'deuxiemeepitredesaintpierre': '2 Pierre',
    'jean1': '1 Jean', '1john': '1 Jean', '1jean': '1 Jean', '1jn': '1 Jean', 'premierepitredesaintjean': '1 Jean',
    'jean2': '2 Jean', '2john': '2 Jean', '2jean': '2 Jean', '2jn': '2 Jean', 'deuxiemeepitredesaintjean': '2 Jean',
    'jean3': '3 Jean', '3john': '3 Jean', '3jean': '3 Jean', '3jn': '3 Jean', 'troisiemeepitredesaintjean': '3 Jean',
    'jude': 'Jude', 'jd': 'Jude', 'epitredesaintjude': 'Jude',
    'apoca': 'Apocalypse', 'apocalypse': 'Apocalypse', 'rev': 'Apocalypse', 'ap': 'Apocalypse', 'lapocalypse': 'Apocalypse',

    # Ancien Testament
    'genese': 'Genèse', 'gen': 'Genèse', 'gn': 'Genèse', 'lagenese': 'Genèse',
    'exode': 'Exode', 'exod': 'Exode', 'ex': 'Exode', 'lexode': 'Exode',
    'levitique': 'Lévitique', 'lev': 'Lévitique', 'lv': 'Lévitique', 'lelevitique': 'Lévitique',
    'nombres': 'Nombres', 'num': 'Nombres', 'nb': 'Nombres', 'lesnombres': 'Nombres',
    'deuteronome': 'Deutéronome', 'deut': 'Deutéronome', 'dt': 'Deutéronome', 'ledeuteronome': 'Deutéronome',
    'josue': 'Josué', 'josh': 'Josué', 'jos': 'Josué', 'lelivredejosue': 'Josué',
    'juges': 'Juges', 'judg': 'Juges', 'jg': 'Juges', 'lelivredesjuges': 'Juges',
    'ruth': 'Ruth', 'rt': 'Ruth', 'lelivrederuth': 'Ruth',
    '1samuel': '1 Samuel', '1sam': '1 Samuel', '1s': '1 Samuel', 'premierlivredesamuel': '1 Samuel',
    '2samuel': '2 Samuel', '2sam': '2 Samuel', '2s': '2 Samuel', 'deuxiemelivredesamuel': '2 Samuel',
    '1rois': '1 Rois', '1kgs': '1 Rois', '1r': '1 Rois', 'premierlivredesrois': '1 Rois',
    '2rois': '2 Rois', '2kgs': '2 Rois', '2r': '2 Rois', 'deuxiemelivredesrois': '2 Rois',
    '1chroniques': '1 Chroniques', '1chr': '1 Chroniques', 'premierlivredeschroniques': '1 Chroniques',
    '2chroniques': '2 Chroniques', '2chr': '2 Chroniques', 'deuxiemelivredeschroniques': '2 Chroniques',
    'esdras': 'Esdras', 'ezra': 'Esdras', 'lelivredesdras': 'Esdras',
    'nehemie': 'Néhémie', 'neh': 'Néhémie', 'lelivredenehemie': 'Néhémie',
    'esther': 'Esther', 'esth': 'Esther',
    'job': 'Job', 'jb': 'Job',
    'psaumes': 'Psaumes', 'psaume': 'Psaumes', 'ps': 'Psaumes', 'lespsaumes': 'Psaumes',
    'proverbes': 'Proverbes', 'proverbe': 'Proverbes', 'prov': 'Proverbes', 'pr': 'Proverbes', 'lesproverbes': 'Proverbes',
    'ecclesiaste': 'Ecclésiaste', 'eccl': 'Ecclésiaste', 'qoheleth': 'Ecclésiaste', 'ec': 'Ecclésiaste', 'lecclesiaste': 'Ecclésiaste',
    'cantique': 'Cantique des cantiques', 'cantiques': 'Cantique des cantiques', 'song': 'Cantique des cantiques', 'ct': 'Cantique des cantiques', 'lecantiquedescantiques': 'Cantique des cantiques',
    'esaie': 'Ésaïe', 'isa': 'Ésaïe', 'is': 'Ésaïe',
    'jeremie': 'Jérémie', 'jer': 'Jérémie', 'jr': 'Jérémie',
    'lamentations': 'Lamentations', 'lam': 'Lamentations', 'lm': 'Lamentations', 'leslamentations': 'Lamentations',
    'ezechiel': 'Ézéchiel', 'ezek': 'Ézéchiel', 'ez': 'Ézéchiel',
    'daniel': 'Daniel', 'dan': 'Daniel', 'dn': 'Daniel',
    'osee': 'Osée', 'hos': 'Osée', 'os': 'Osée',
    'joel': 'Joël', 'jl': 'Joël',
    'amos': 'Amos', 'am': 'Amos',
    'abdias': 'Abdias', 'obad': 'Abdias', 'ab': 'Abdias',
    'jonas': 'Jonas', 'jonah': 'Jonas', 'jon': 'Jonas',
    'michee': 'Michée', 'mic': 'Michée', 'mi': 'Michée',
    'nahum': 'Nahum', 'nah': 'Nahum', 'na': 'Nahum',
    'habacuc': 'Habacuc', 'habaquq': 'Habacuc', 'hab': 'Habacuc', 'ha': 'Habacuc',
    'sophonie': 'Sophonie', 'zeph': 'Sophonie', 'so': 'Sophonie',
    'aggee': 'Aggée', 'hag': 'Aggée', 'ag': 'Aggée',
    'zacharie': 'Zacharie', 'zech': 'Zacharie', 'za': 'Zacharie',
    'malachie': 'Malachie', 'mal': 'Malachie', 'ml': 'Malachie'
}

SINGLE_CHAPTER_BOOKS = {'philemon', 'jean2', 'jean3', 'jude', 'abdias', 'obad', 'phlm'}

def normalize_key(text: str) -> str:
    t = text.lower().strip()
    t = re.sub(r'[éèêë]', 'e', t)
    t = re.sub(r'[àâä]', 'a', t)
    t = re.sub(r'[îï]', 'i', t)
    t = re.sub(r'[ôö]', 'o', t)
    t = re.sub(r'[ûüù]', 'u', t)
    t = re.sub(r'[ç]', 'c', t)
    t = re.sub(r'[^a-z0-9]', '', t)
    return t

def resolve_book_name(identifier: str, title_text: str = '') -> str:
    norm_id = normalize_key(identifier)
    if norm_id in CANONICAL_BOOKS:
        return CANONICAL_BOOKS[norm_id]

    norm_title = normalize_key(title_text)
    for key, canon in CANONICAL_BOOKS.items():
        if key == norm_title or norm_title.startswith(key):
            return canon

    std = get_standard_book_code(title_text or identifier)
    fr = get_french_book_name(std)
    if fr:
        return fr

    return title_text.strip() if title_text.strip() else identifier

def clean_verse_text(text: str) -> str:
    text = text.replace('\xa0', ' ').replace('\u202f', ' ').replace('\u2009', ' ').replace('\u200a', ' ').replace('\ufeff', '')
    text = re.sub(r'([a-zà-öø-ÿ])([A-ZÀ-ÖØ-ß])', r'\1 \2', text)
    text = re.sub(r'([,;:\.!\?])([A-Za-zÀ-ÖØ-öø-ÿ0-9])', r'\1 \2', text)
    text = re.sub(r'([^\s])«', r'\1 «', text)
    text = re.sub(r'»([^\s])', r'» \1', text)
    text = re.sub(r'«\s+', '« ', text)
    text = re.sub(r'\s+»', ' »', text)
    text = re.sub(r'\s+([,\.\)])', r'\1', text)
    text = re.sub(r'\(\s+', '(', text)
    text = re.sub(r'\s+', ' ', text)
    if re.match(r'^[\[\]\.\s…]+$', text):
        return ""
    return text.strip()


class BibleEpubImporter:
    """Importateur automatisé de fichiers EPUB bibliques."""

    @classmethod
    def parse_bible_epub(cls, epub_path: str) -> Dict[str, Dict[str, Dict[str, str]]]:
        if not os.path.exists(epub_path):
            raise FileNotFoundError(f"Fichier EPUB introuvable: {epub_path}")

        with zipfile.ZipFile(epub_path, 'r') as z:
            opf_files = [n for n in z.namelist() if n.endswith('.opf')]
            sample_htmls = [n for n in z.namelist() if n.endswith('.html') or n.endswith('.xhtml')][:25]
            
            has_verse_anchors = False
            for s_name in sample_htmls:
                content_sample = z.read(s_name)
                if b'id="v' in content_sample or b"id='v" in content_sample:
                    has_verse_anchors = True
                    break

            if opf_files and has_verse_anchors:
                return cls._parse_spine_anchors(z, opf_files[0])

            doc_infos = [info for info in z.infolist() if (info.filename.endswith('.xhtml') or info.filename.endswith('.html')) and 'cover' not in info.filename.lower()]
            
            if len(doc_infos) > 5:
                return cls._parse_multifile_structured(z)

            doc_infos.sort(key=lambda x: x.file_size, reverse=True)
            if not doc_infos:
                raise ValueError("Aucun document HTML trouvé dans l'EPUB.")

            main_html = z.read(doc_infos[0].filename).decode('utf-8', errors='ignore')
            return cls._parse_indesign_single(main_html)

    @classmethod
    def _parse_spine_anchors(cls, z: zipfile.ZipFile, opf_path: str) -> Dict[str, Dict[str, Dict[str, str]]]:
        opf_dir = os.path.dirname(opf_path)
        opf_xml = z.read(opf_path).decode('utf-8', errors='ignore')
        opf_soup = BeautifulSoup(opf_xml, 'xml')

        manifest = {}
        for item in opf_soup.find_all('item'):
            href = item.get('href')
            if opf_dir:
                href = f"{opf_dir}/{href}"
            manifest[item.get('id')] = href

        spine_files = []
        for itemref in opf_soup.find_all('itemref'):
            idref = itemref.get('idref')
            if idref in manifest:
                spine_files.append(manifest[idref])

        bible: Dict[str, Dict[str, Dict[str, list]]] = {}
        current_book_name = None
        current_chap = None
        current_v = None

        for filename in spine_files:
            if not (filename.endswith('.html') or filename.endswith('.xhtml')) or filename not in z.namelist():
                continue
            raw_bytes = z.read(filename)
            if b'id="v' not in raw_bytes and b"id='v" not in raw_bytes:
                continue

            soup = BeautifulSoup(raw_bytes.decode('utf-8', errors='ignore'), 'html.parser')
            for el in soup.find_all(class_=['versejump', 'displayreference', 'note-link-in-text', 'toplink']):
                el.decompose()
            for h in soup.find_all(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'title']):
                if h.find('a', id=re.compile(r'^v[A-Za-z0-9]+\.\d+\.\d+')):
                    h.unwrap()
                else:
                    h.decompose()

            body = soup.find('body')
            if not body:
                continue

            for el in body.descendants:
                if isinstance(el, Tag):
                    if el.name == 'a' and el.get('id', '').startswith('v'):
                        m = re.match(r'^v([A-Za-z0-9]+)\.(\d+)\.(\d+)', el['id'])
                        if m:
                            raw_b, ch, v = m.groups()
                            current_book_name = resolve_book_name(raw_b)
                            current_chap = str(int(ch))
                            current_v = str(int(v))
                            if current_book_name not in bible:
                                bible[current_book_name] = {}
                            if current_chap not in bible[current_book_name]:
                                bible[current_book_name][current_chap] = {}
                            if current_v not in bible[current_book_name][current_chap]:
                                bible[current_book_name][current_chap][current_v] = []
                    elif el.name in ['br', 'p', 'div']:
                        if current_book_name and current_chap and current_v:
                            if current_v in bible[current_book_name][current_chap] and bible[current_book_name][current_chap][current_v]:
                                if not bible[current_book_name][current_chap][current_v][-1].endswith(' '):
                                    bible[current_book_name][current_chap][current_v].append(' ')
                elif isinstance(el, NavigableString):
                    if not (isinstance(el.parent, Tag) and el.parent.name in ['script', 'style']):
                        txt = str(el)
                        if txt and current_book_name and current_chap and current_v:
                            bible[current_book_name][current_chap][current_v].append(txt)

        clean_result: Dict[str, Dict[str, Dict[str, str]]] = {}
        for b_k, ch_dict in bible.items():
            clean_result[b_k] = {}
            for ch_k in sorted(ch_dict.keys(), key=lambda x: int(x) if x.isdigit() else 0):
                clean_result[b_k][ch_k] = {}
                for v_k in sorted(ch_dict[ch_k].keys(), key=lambda x: int(x.split('-')[0]) if re.match(r'^\d+', x) else 0):
                    t = clean_verse_text(''.join(ch_dict[ch_k][v_k]))
                    if t:
                        clean_result[b_k][ch_k][v_k] = t
        return clean_result

    @classmethod
    def _parse_multifile_structured(cls, z: zipfile.ZipFile) -> Dict[str, Dict[str, Dict[str, str]]]:
        text_files = [n for n in z.namelist() if (n.endswith('.xhtml') or n.endswith('.html')) and 'cover' not in n.lower()]
        text_files.sort()

        bible: Dict[str, Dict[str, Dict[str, list]]] = {}
        current_book = None
        current_chap = None
        current_verse = None

        for fname in text_files:
            raw = z.read(fname)
            soup = BeautifulSoup(raw.decode('utf-8', errors='ignore'), 'html.parser')
            for h3 in soup.find_all(['h1', 'h2', 'h3']):
                h_txt = h3.get_text(strip=True)
                if h_txt and len(h_txt) < 40 and not any(k in h_txt.upper() for k in ['TABLE', 'SOMMAIRE', 'PREFACE', 'ANNEXE']):
                    cand = resolve_book_name(h_txt, h_txt)
                    if cand:
                        current_book = cand
                        current_chap = None
                        current_verse = None

            for el in soup.find_all(['h4', 'h5', 'p', 'div']):
                txt = el.get_text(separator=' ', strip=True).replace('\xa0', ' ').strip()
                if not txt:
                    continue

                if el.name in ['h4', 'h5'] or re.match(r'^(?:chapitre|psaume|chap\.)\s*(\d+)', txt, re.I):
                    m_chap = re.search(r'(\d+)', txt)
                    if m_chap:
                        current_chap = str(int(m_chap.group(1)))
                        current_verse = None
                        continue

                if not current_book:
                    continue
                if not current_chap:
                    current_chap = "1"

                if current_book not in bible:
                    bible[current_book] = {}
                if current_chap not in bible[current_book]:
                    bible[current_book][current_chap] = {}

                # Regex versets (1 Au commencement...)
                splits = list(re.finditer(r'(?:^|\s+)(\d+(?:-[a-z0-9]+)?)\s+([A-Za-zÀ-ÖØ-öø-ÿ"«\'])', txt))
                if splits:
                    for i in range(len(splits)):
                        v_num = splits[i].group(1)
                        s_idx = splits[i].start(2)
                        e_idx = splits[i+1].start(0) if i+1 < len(splits) else len(txt)
                        v_text = txt[s_idx:e_idx].strip()
                        current_verse = v_num
                        if current_verse not in bible[current_book][current_chap]:
                            bible[current_book][current_chap][current_verse] = []
                        bible[current_book][current_chap][current_verse].append(v_text)
                else:
                    if current_verse and current_verse in bible[current_book][current_chap]:
                        bible[current_book][current_chap][current_verse].append(txt)

        clean_result: Dict[str, Dict[str, Dict[str, str]]] = {}
        for b_k, ch_dict in bible.items():
            clean_result[b_k] = {}
            for ch_k in sorted(ch_dict.keys(), key=lambda x: int(x) if x.isdigit() else 0):
                clean_result[b_k][ch_k] = {}
                for v_k in sorted(ch_dict[ch_k].keys(), key=lambda x: int(x.split('-')[0]) if re.match(r'^\d+', x) else 0):
                    t = clean_verse_text(" ".join(ch_dict[ch_k][v_k]))
                    if t:
                        clean_result[b_k][ch_k][v_k] = t
        return clean_result

    @classmethod
    def _parse_indesign_single(cls, html_content: str) -> Dict[str, Dict[str, Dict[str, str]]]:
        soup = BeautifulSoup(html_content, 'html.parser')
        body = soup.find('body')
        if not body:
            return {}

        bible: Dict[str, Dict[str, Dict[str, list]]] = {}
        current_book: Optional[str] = None
        current_chapter: Optional[str] = None
        current_verse: Optional[str] = None

        for el in body.find_all('p', recursive=True):
            classes = el.get('class', [])
            is_book_header = False
            book_id = el.get('id', '')
            b_name = ""

            if any('PV-03-titres-tx-biblique' in c for c in classes) or any('LV-02-livres' in c for c in classes):
                is_book_header = True
                b_name = resolve_book_name(book_id, el.get_text(separator=' '))

            if is_book_header and b_name:
                current_book = b_name
                if current_book not in bible:
                    bible[current_book] = {}
                current_chapter = "1" if normalize_key(current_book) in SINGLE_CHAPTER_BOOKS else None
                current_verse = None
                continue

            if not current_book:
                continue

            lettrine = el.find(class_=lambda c: c and 'lettrine' in c)
            dropcap = el.find(class_=lambda c: c and ('dropcap' in str(c).lower() or 'lettrine' in str(c).lower()))
            is_chapter_p = any('chapitre' in c or '1e-ligne' in c for c in classes) or (dropcap is not None and not current_chapter)

            if is_chapter_p or dropcap:
                c_str = ''
                if lettrine and lettrine.get_text(strip=True):
                    c_str = lettrine.get_text(strip=True)
                elif dropcap and dropcap.get_text(strip=True):
                    c_str = dropcap.get_text(strip=True)
                else:
                    m = re.search(r'^\s*(\d+)', el.get_text(strip=True))
                    if m:
                        c_str = m.group(1)

                m_chap = re.search(r'^\d+', c_str.strip())
                if m_chap:
                    cand_num = str(int(m_chap.group(0)))
                    current_chapter = cand_num
                    if current_chapter not in bible[current_book]:
                        bible[current_book][current_chapter] = {}
                    current_verse = "1"
                    if current_verse not in bible[current_book][current_chapter]:
                        bible[current_book][current_chapter][current_verse] = []

            if not current_chapter:
                continue

            for child in el.contents:
                if isinstance(child, Tag):
                    child_classes = child.get('class', [])
                    if any('exposant' in c.lower() for c in child_classes):
                        v_raw = child.get_text(strip=True).replace('I', '1').replace('l', '1').replace('O', '0')
                        v_match = re.search(r'^\d+(?:-\d+)?', v_raw)
                        if v_match:
                            current_verse = v_match.group(0)
                            if current_verse not in bible[current_book][current_chapter]:
                                bible[current_book][current_chapter][current_verse] = []
                            continue
                    t = child.get_text(separator=' ')
                    if t and current_verse:
                        bible[current_book][current_chapter][current_verse].append(t)
                elif isinstance(child, NavigableString):
                    t = str(child)
                    if t and current_verse:
                        bible[current_book][current_chapter][current_verse].append(t)

        clean_result: Dict[str, Dict[str, Dict[str, str]]] = {}
        for b_k, ch_dict in bible.items():
            clean_result[b_k] = {}
            for ch_k in sorted(ch_dict.keys(), key=lambda x: int(x) if x.isdigit() else 0):
                clean_result[b_k][ch_k] = {}
                for v_k in sorted(ch_dict[ch_k].keys(), key=lambda x: int(x.split('-')[0]) if re.match(r'^\d+', x) else 0):
                    t = clean_verse_text(''.join(ch_dict[ch_k][v_k]))
                    if t:
                        clean_result[b_k][ch_k][v_k] = t
        return clean_result

    @classmethod
    def import_bible_epub(cls, epub_path: str, custom_name: Optional[str] = None, custom_metadata: Optional[Dict[str, Any]] = None) -> Tuple[str, Dict[str, Any]]:
        """
        Importe et convertit une Bible EPUB complète dans data/bibles/
        Met à jour data/library.json et renvoie l'identifiant et les métadonnées.
        """
        from core.bible_json_loader import BibleJsonLoader
        from gui.center_panel import BOOKS_OT, BOOKS_NT
        from gui.library_utils import load_books_metadata, save_books_metadata

        all_books_list = BOOKS_OT + BOOKS_NT
        app_order = {code: i + 1 for i, (name, code, ch) in enumerate(all_books_list)}

        parsed_bible = cls.parse_bible_epub(epub_path)
        if not parsed_bible:
            raise ValueError("Aucun livre ni verset biblique n'a pu être extrait du fichier EPUB.")

        filename_base = os.path.splitext(os.path.basename(epub_path))[0]
        detected_name = custom_name or filename_base.replace("_", " ").replace("-", " ").title()
        version_code = (custom_metadata.get("version_code") if custom_metadata else None) or detected_name[:4].upper().strip()
        version_fullname = (custom_metadata.get("title") if custom_metadata else None) or f"Bible {detected_name}"

        folder_clean = re.sub(r'[^\w\-_\. ]', '_', detected_name).strip().replace(" ", "_")
        bibles_dir = BibleJsonLoader.get_bibles_dir()
        dest_dir = os.path.join(bibles_dir, folder_clean)
        os.makedirs(dest_dir, exist_ok=True)

        saved_books_count = 0
        extra_idx = 67
        for raw_book_name, chapters_data in parsed_bible.items():
            std_code = get_standard_book_code(raw_book_name)
            fr_name = get_french_book_name(std_code) or raw_book_name
            if std_code in app_order:
                order_idx = app_order[std_code]
            else:
                order_idx = extra_idx
                extra_idx += 1
            usfm_code = STD_TO_USFM.get(std_code, std_code.upper() if std_code else "BOOK")

            book_obj = {
                "id": order_idx,
                "code": usfm_code,
                "name": fr_name,
                "version": version_code,
                "version_fullname": version_fullname,
                "total_chapters": len(chapters_data),
                "chapters": chapters_data
            }

            dest_filename = f"{order_idx:02d}_{usfm_code}_{fr_name}.json"
            dest_filepath = os.path.join(dest_dir, dest_filename)
            with open(dest_filepath, "w", encoding="utf-8") as fp:
                json.dump(book_obj, fp, ensure_ascii=False, indent=2)
            saved_books_count += 1

        registry = load_books_metadata()
        meta = custom_metadata or {}
        bible_entry = {
            "title": meta.get("title") or detected_name,
            "author": meta.get("author") or "",
            "description": meta.get("description") or version_fullname,
            "year": meta.get("year") or "",
            "cover_path": meta.get("cover_path", None),
            "type": "Bible",
            "format": "json",
            "folder_name": folder_clean,
            "version_code": version_code,
            "total_books": saved_books_count,
            "embedding_model": "study_library",
            "active": True
        }

        registry[detected_name] = bible_entry
        save_books_metadata(registry)
        BibleJsonLoader.clear_cache()

        return detected_name, bible_entry
