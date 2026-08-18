import os
import sys
import zipfile
import re
import json
from typing import Dict, List, Any, Optional

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_BIBLES_DIR = os.path.join(BASE_DIR, "data", "bibles")
EBOOKS_DIR = r"C:\Users\adrie\kDrive\Documents\Théologie\Ressources externes\Ebooks\Bibles"

PREFIX_TO_USFM = {
    "Gen": "GEN", "Genesis": "GEN", "Exod": "EXO", "Exodus": "EXO", "Lev": "LEV", "Leviticus": "LEV",
    "Num": "NUM", "Numbers": "NUM", "Deut": "DEU", "Deuteronomy": "DEU", "Josh": "JOS", "Joshua": "JOS",
    "Judg": "JDG", "Judges": "JDG", "Ruth": "RUT", "1Sam": "1SA", "2Sam": "2SA",
    "1Kgs": "1KI", "1Kings": "1KI", "2Kgs": "2KI", "2Kings": "2KI", "1Chr": "1CH", "2Chr": "2CH",
    "Ezra": "EZR", "Neh": "NEH", "Nehemiah": "NEH", "Esth": "EST", "Esther": "EST",
    "Job": "JOB", "Ps": "PSA", "Psalms": "PSA", "Prov": "PRO", "Proverbs": "PRO",
    "Eccl": "ECC", "Ecclesiastes": "ECC", "Song": "SNG", "Isa": "ISA", "Isaiah": "ISA",
    "Jer": "JER", "Jeremiah": "JER", "Lam": "LAM", "Lamentations": "LAM", "Ezek": "EZK", "Ezekiel": "EZK",
    "Dan": "DAN", "Daniel": "DAN", "Hos": "HOS", "Hosea": "HOS", "Joel": "JOL",
    "Amos": "AMO", "Obad": "OBA", "Obadiah": "OBA", "Jonah": "JON", "Mic": "MIC", "Micah": "MIC",
    "Nah": "NAM", "Nahum": "NAM", "Hab": "HAB", "Habakkuk": "HAB", "Zeph": "ZEP", "Zephaniah": "ZEP",
    "Hag": "HAG", "Haggai": "HAG", "Zech": "ZEC", "Zechariah": "ZEC", "Mal": "MAL", "Malachi": "MAL",
    "Matt": "MAT", "Matthew": "MAT", "Mark": "MRK", "Luke": "LUK", "John": "JHN",
    "Acts": "ACT", "Rom": "ROM", "Romans": "ROM", "1Cor": "1CO", "2Cor": "2CO",
    "Gal": "GAL", "Galatians": "GAL", "Eph": "EPH", "Ephesians": "EPH", "Phil": "PHP", "Philippians": "PHP",
    "Col": "COL", "Colossians": "COL", "1Thess": "1TH", "2Thess": "2TH", "1Tim": "1TI",
    "2Tim": "2TI", "Titus": "TIT", "Phlm": "PHM", "Philemon": "PHM", "Heb": "HEB", "Hebrews": "HEB",
    "Jas": "JAS", "James": "JAS", "1Pet": "1PE", "1Peter": "1PE", "2Pet": "2PE", "2Peter": "2PE",
    "1John": "1JN", "2John": "2JN", "3John": "3JN", "Jude": "JUD", "Rev": "REV", "Revelation": "REV",
    # Deutérocanoniques
    "Tob": "TOB", "Jdt": "JDT", "Wis": "WIS", "Sir": "SIR", "Bar": "BAR", "1Macc": "1MA", "2Macc": "2MA",
    "3Macc": "3MA", "4Macc": "4MA", "1Esd": "1ES", "2Esd": "2ES", "PrMan": "MAN"
}

PV_NT_BOOKS = [
    ("MAT", "Matthieu"), ("MRK", "Marc"), ("LUK", "Luc"), ("JHN", "Jean"),
    ("ACT", "Actes"), ("ROM", "Romains"), ("1CO", "1 Corinthiens"), ("2CO", "2 Corinthiens"),
    ("GAL", "Galates"), ("EPH", "Éphésiens"), ("PHP", "Philippiens"), ("COL", "Colossiens"),
    ("1TH", "1 Thessaloniciens"), ("2TH", "2 Thessaloniciens"), ("1TI", "1 Timothée"),
    ("2TI", "2 Timothée"), ("TIT", "Tite"), ("PHM", "Philémon"), ("HEB", "Hébreux"),
    ("JAS", "Jacques"), ("1PE", "1 Pierre"), ("2PE", "2 Pierre"), ("1JN", "1 Jean"),
    ("2JN", "2 Jean"), ("3JN", "3 Jean"), ("JUD", "Jude"), ("REV", "Apocalypse")
]

OST_NAME_MAP = {
    "GEN_SE": "GEN", "EXODE": "EXO", "L_VITIQUE": "LEV", "NOMBRES": "NUM", "DEUT_RONOME": "DEU",
    "JOSU_": "JOS", "JUGES": "JDG", "RUTH": "RUT", "1_SAMUEL": "1SA", "2_SAMUEL": "2SA",
    "1_ROIS": "1KI", "2_ROIS": "2KI", "1_CHRONIQUES": "1CH", "2_CHRONIQUES": "2CH",
    "ESDRAS": "EZR", "N_H_MIE": "NEH", "ESTHER": "EST", "JOB": "JOB", "PSAUMES": "PSA",
    "PROVERBES": "PRO", "ECCL_SIASTE": "ECC", "CANTIQUE": "SNG", "_SA_E": "ISA", "J_R_MIE": "JER",
    "LAMENTATIONS": "LAM", "_Z_CHIEL": "EZK", "DANIEL": "DAN", "OS_E": "HOS", "JO_L": "JOL",
    "AMOS": "AMO", "ABDIAS": "OBA", "JONAS": "JON", "MICH_E": "MIC", "NAHUM": "NAM",
    "HABACUC": "HAB", "SOPHONIE": "ZEP", "AGG_E": "HAG", "ZACHARIE": "ZEC", "MALACHIE": "MAL",
    "MATTHIEU": "MAT", "MARC": "MRK", "LUC": "LUK", "JEAN": "JHN", "ACTES": "ACT",
    "ROMAINS": "ROM", "1_CORINTHIENS": "1CO", "2_CORINTHIENS": "2CO", "GALATES": "GAL",
    "_PH_SIENS": "EPH", "PHILIPPIENS": "PHP", "COLOSSIENS": "COL", "1_THESSALONICIENS": "1TH",
    "2_THESSALONICIENS": "2TH", "1_TIMOTH_E": "1TI", "2_TIMOTH_E": "2TI", "TITE": "TIT",
    "PHIL_MON": "PHM", "H_BREUX": "HEB", "JACQUES": "JAS", "1_PIERRE": "1PE", "2_PIERRE": "2PE",
    "1_JEAN": "1JN", "2_JEAN": "2JN", "3_JEAN": "3JN", "JUDE": "JUD", "APOCALYPSE": "REV"
}

def update_book_json_paragraphs(folder_name: str, usfm_code: str, paragraphs_list: List[str]) -> bool:
    target_dir = os.path.join(DATA_BIBLES_DIR, folder_name)
    if not os.path.exists(target_dir):
        return False
        
    matched_file = None
    for fname in os.listdir(target_dir):
        if fname.endswith(".json") and (f"_{usfm_code}_" in fname or f"_{usfm_code}." in fname):
            matched_file = os.path.join(target_dir, fname)
            break
            
    if not matched_file:
        return False
        
    try:
        with open(matched_file, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        data["paragraphs"] = sorted(list(set(paragraphs_list)), key=lambda x: (int(x.split(":")[0]) if ":" in x else 0, int(x.split(":")[1]) if ":" in x else 0))
        
        with open(matched_file, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        print(f"Erreur mise à jour {matched_file}: {e}")
        return False

# 1. SEGOND 21
def extract_s21_paragraphs():
    epub_path = os.path.join(EBOOKS_DIR, "Bible S21.epub")
    if not os.path.exists(epub_path): return
    print("\n--- Extraction Paragraphes : Segond 21 ---")
    with zipfile.ZipFile(epub_path, "r") as z:
        files = [f for f in z.namelist() if f.startswith("Ops/") and f.endswith(".html") and not f.endswith("-notes.html")]
        books_map = {}
        for f in files:
            base = os.path.basename(f)[:-5]
            if "-" in base:
                parts = base.rsplit("-", 1)
                prefix, ch_str = parts[0], parts[1]
                if ch_str.isdigit():
                    usfm = PREFIX_TO_USFM.get(prefix)
                    if usfm:
                        if usfm not in books_map: books_map[usfm] = []
                        books_map[usfm].append((int(ch_str), f))
        total_p = 0
        for usfm, ch_files in books_map.items():
            ch_files.sort(key=lambda x: x[0])
            para_list = []
            for ch, fname in ch_files:
                c = z.read(fname).decode("utf-8", errors="ignore")
                para_list.append(f"{ch}:1")
                for m in re.finditer(r'(?:<p[^>]*>|<div[^>]*>|<h3>|<h4>)\s*(?:<span[^>]*class="[^"]*noteref[^"]*"[^>]*>.*?</span>\s*)*<span class="verseNum">\s*(\d+)', c):
                    para_list.append(f"{ch}:{int(m.group(1))}")
            if para_list:
                update_book_json_paragraphs("Segond_21", usfm, para_list)
                total_p += len(set(para_list))
        print(f"-> S21 : {len(books_map)} livres mis à jour ({total_p} paragraphes)")

# 2. TOB 2010
def extract_tob_paragraphs():
    epub_path = os.path.join(EBOOKS_DIR, "La Bible TOB.epub")
    if not os.path.exists(epub_path): return
    print("\n--- Extraction Paragraphes : TOB 2010 ---")
    with zipfile.ZipFile(epub_path, "r") as z:
        html_files = [f for f in z.namelist() if f.startswith("text/part") and f.endswith(".html")]
        books_data = {}
        for hf in html_files:
            c = z.read(hf).decode("utf-8", errors="ignore")
            m_book = re.search(r'<span class="versejump"[^>]*>([A-Za-z0-9]+)\s+(\d+)\s+(\d+)</span>', c)
            if not m_book:
                m_book = re.search(r'href="part\d+\.html#v([A-Za-z0-9]+)\.(\d+)\.(\d+)"', c)
            if m_book:
                prefix = m_book.group(1)
                usfm = PREFIX_TO_USFM.get(prefix)
                if not usfm: continue
                if usfm not in books_data: books_data[usfm] = []
                for p in re.findall(r'<p[^>]*>.*?</p>', c, re.DOTALL):
                    v_m = re.search(r'<span class="versejump"[^>]*>[A-Za-z0-9]+\s+(\d+)\s+(\d+)</span>|<a id="v[A-Za-z0-9]+\.(\d+)\.(\d+)"></a>', p)
                    if v_m:
                        ch = int(v_m.group(1) or v_m.group(3))
                        v = int(v_m.group(2) or v_m.group(4))
                        books_data[usfm].append(f"{ch}:{v}")
        total_p = 0
        for usfm, paras in books_data.items():
            if paras:
                update_book_json_paragraphs("TOB", usfm, paras)
                total_p += len(set(paras))
        print(f"-> TOB : {len(books_data)} livres mis à jour ({total_p} paragraphes)")

# 3. NFC
def extract_nfc_paragraphs():
    epub_path = os.path.join(EBOOKS_DIR, r"nfc-ebook-sans-deuterocanoniques\nfc_sansDC.epub")
    if not os.path.exists(epub_path): return
    print("\n--- Extraction Paragraphes : NFC ---")
    with zipfile.ZipFile(epub_path, "r") as z:
        xhtml_files = [f for f in z.namelist() if f.startswith("OEBPS/XHTML/") and f.endswith(".xhtml")]
        total_p = 0
        books_count = 0
        for xf in xhtml_files:
            parts = xf.split("/")
            if len(parts) >= 4:
                prefix = parts[2]
                usfm = PREFIX_TO_USFM.get(prefix, prefix)
                c = z.read(xf).decode("utf-8", errors="ignore")
                paras = []
                cur_ch = 1
                for block in re.split(r'(<div class="c"[^>]*>|<div class="p"[^>]*>|<div class="q[^"]*"[^>]*>|<div class="m"[^>]*>|<div class="b"[^>]*>)', c):
                    ch_m = re.search(r'<span class="c[^"]*">(\d+)</span>', block)
                    if ch_m: cur_ch = int(ch_m.group(1))
                    v_m = re.search(r'<span class="v[^"]*">(\d+)</span>', block)
                    if v_m: paras.append(f"{cur_ch}:{int(v_m.group(1))}")
                if paras:
                    update_book_json_paragraphs("NFC", usfm, paras)
                    total_p += len(set(paras))
                    books_count += 1
        print(f"-> NFC : {books_count} livres mis à jour ({total_p} paragraphes)")

# 4. PAROLE VIVANTE (NT)
def extract_pv_paragraphs():
    epub_path = os.path.join(EBOOKS_DIR, "Parole vivante.epub")
    if not os.path.exists(epub_path): return
    print("\n--- Extraction Paragraphes : Parole Vivante ---")
    with zipfile.ZipFile(epub_path, 'r') as z:
        content = z.read("OEBPS/EPUB.Parole.Vivante.xhtml").decode("utf-8", errors="ignore")
        
        # Parcourir chaque paragraphe du livre avec balises <p class="PV-...">
        # et suivre les changements de livre et de chapitre
        pattern = re.compile(
            r'<p[^>]*class="PV-01-Titre-de-livre[^"]*"[^>]*>(.*?)</p>|<p[^>]*class="PV-03-titres-tx-biblique[^"]*"[^>]*>(.*?)</p>|<span[^>]*class="[^"]*_idGenDropcap-1[^"]*">\s*(\d+)&#160;\s*</span>|<span[^>]*class="[^"]*PV-00-exposant-verset[^"]*">\s*(\d+)&#160;\s*</span>|<p[^>]*class="([^"]*PV-01-Texte[^"]*|[^"]*PV-02-Texte[^"]*|[^"]*PV-03-Poesie[^"]*)"[^>]*>(.*?)</p>',
            re.DOTALL
        )
        
        book_paras = {}
        cur_book_idx = -1
        cur_chap = 1
        
        # Identifier chaque <p>
        for p in re.findall(r'<p[^>]*>.*?</p>', content, re.DOTALL):
            # Détection de titre de livre
            for b_idx, (b_code, b_name) in enumerate(PV_NT_BOOKS):
                if f">{b_name}<" in p or f">{b_name.upper()}<" in p or f"Évangile selon {b_name}" in p or f"Lettre de {b_name}" in p:
                    if b_idx > cur_book_idx:
                        cur_book_idx = b_idx
                        cur_chap = 1
                        book_paras[b_code] = []
                        break
                        
            if cur_book_idx >= 0 and cur_book_idx < len(PV_NT_BOOKS):
                usfm = PV_NT_BOOKS[cur_book_idx][0]
                if usfm not in book_paras:
                    book_paras[usfm] = []
                    
                # Détection de chapitre Dropcap
                ch_m = re.search(r'<span[^>]*class="[^"]*_idGenDropcap-1[^"]*">\s*(\d+)&#160;\s*</span>', p)
                if ch_m:
                    cur_chap = int(ch_m.group(1))
                    book_paras[usfm].append(f"{cur_chap}:1")
                    
                # Détection de verset
                v_m = re.search(r'<span[^>]*class="[^"]*PV-00-exposant-verset[^"]*">\s*(\d+)&#160;\s*</span>', p)
                if v_m:
                    v = int(v_m.group(1))
                    # Si c'est un paragraphe de texte/poésie, c'est un début de paragraphe
                    if any(c in p for c in ['PV-01-Texte', 'PV-02-Texte', 'PV-03-Poesie', 'PV-01-paragraphe', 'PV-02-paragraphe']):
                        book_paras[usfm].append(f"{cur_chap}:{v}")
                        
        total_p = 0
        for usfm, paras in book_paras.items():
            if paras:
                update_book_json_paragraphs("Parole_Vivante", usfm, paras)
                total_p += len(set(paras))
        print(f"-> Parole Vivante : {len(book_paras)} livres mis à jour ({total_p} paragraphes)")

# 5. PAROLE DE VIE (PDV)
def extract_pdv_paragraphs():
    epub_path = os.path.join(EBOOKS_DIR, r"PDV\collectif_la-bible-parole-de-vie-sans-les-livres-deuterocanoniques.epub")
    if not os.path.exists(epub_path): return
    print("\n--- Extraction Paragraphes : Parole de Vie (PDV) ---")
    with zipfile.ZipFile(epub_path, "r") as z:
        files = [f for f in z.namelist() if f.startswith("OPS/") and f.endswith(".xml") and not f.endswith("-notes.xml")]
        books_map = {}
        for f in files:
            base = os.path.basename(f)[:-4]
            if "-" in base:
                parts = base.rsplit("-", 1)
                prefix, ch_str = parts[0], parts[1]
                if ch_str.isdigit():
                    usfm = PREFIX_TO_USFM.get(prefix)
                    if usfm:
                        if usfm not in books_map: books_map[usfm] = []
                        books_map[usfm].append((int(ch_str), f))
        total_p = 0
        for usfm, ch_files in books_map.items():
            ch_files.sort(key=lambda x: x[0])
            para_list = []
            for ch, fname in ch_files:
                c = z.read(fname).decode("utf-8", errors="ignore")
                para_list.append(f"{ch}:1")
                for m in re.finditer(r'(?:<p[^>]*>|<div[^>]*>|<h3>|<h4>)\s*(?:<span[^>]*class="[^"]*noteref[^"]*"[^>]*>.*?</span>\s*)*<span class="verseNum">\s*(\d+)', c):
                    para_list.append(f"{ch}:{int(m.group(1))}")
            if para_list:
                update_book_json_paragraphs("PDV2017", usfm, para_list)
                total_p += len(set(para_list))
        print(f"-> PDV : {len(books_map)} livres mis à jour ({total_p} paragraphes)")

# 6. OSTERVALD (OST)
def extract_ostervald_paragraphs():
    epub_path = os.path.join(EBOOKS_DIR, "2018-11-19 La Bible Ostervald.epub")
    if not os.path.exists(epub_path):
        epub_path = os.path.join(EBOOKS_DIR, "Ostervald.epub")
    if not os.path.exists(epub_path): return
    print("\n--- Extraction Paragraphes : Ostervald (OST) ---")
    with zipfile.ZipFile(epub_path, "r") as z:
        files = [f for f in z.namelist() if f.endswith(".xhtml") and f.startswith("OEBPS/")]
        books_data = {}
        for f in files:
            base = os.path.splitext(os.path.basename(f))[0]
            # Match clean name
            cleaned_key = re.sub(r'-\d+$', '', base).upper()
            usfm = OST_NAME_MAP.get(cleaned_key)
            if not usfm:
                continue
            if usfm not in books_data:
                books_data[usfm] = []
                
            c = z.read(f).decode("utf-8", errors="ignore")
            # In Ostervald, each <p class="...Paragraphe..."> contains dropcap or verset
            cur_ch = 1
            for p in re.findall(r'<p[^>]*>.*?</p>', c, re.DOTALL):
                ch_m = re.search(r'class="[^"]*Lettrine[^"]*">\s*(\d+)\s*<', p)
                if ch_m:
                    cur_ch = int(ch_m.group(1))
                    books_data[usfm].append(f"{cur_ch}:1")
                v_m = re.search(r'class="[^"]*Verset[^"]*">\s*(\d+)\s*<', p)
                if v_m:
                    v = int(v_m.group(1))
                    books_data[usfm].append(f"{cur_ch}:{v}")
                    
        total_p = 0
        for usfm, paras in books_data.items():
            if paras:
                update_book_json_paragraphs("OST", usfm, paras)
                total_p += len(set(paras))
        print(f"-> Ostervald : {len(books_data)} livres mis à jour ({total_p} paragraphes)")

if __name__ == "__main__":
    extract_s21_paragraphs()
    extract_tob_paragraphs()
    extract_nfc_paragraphs()
    extract_pv_paragraphs()
    extract_pdv_paragraphs()
    extract_ostervald_paragraphs()
    print("\nExtraction de tous les paragraphes terminée !")
