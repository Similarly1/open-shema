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

DARBY_NAME_MAP = {
    "GENÈSE": "GEN", "EXODE": "EXO", "LÉVITIQUE": "LEV", "NOMBRES": "NUM", "DEUTÉRONOME": "DEU",
    "JOSUÉ": "JOS", "JUGES": "JDG", "RUTH": "RUT", "1 SAMUEL": "1SA", "2 SAMUEL": "2SA",
    "1 ROIS": "1KI", "2 ROIS": "2KI", "1 CHRONIQUES": "1CH", "2 CHRONIQUES": "2CH",
    "ESDRAS": "EZR", "NÉHÉMIE": "NEH", "ESTHER": "EST", "JOB": "JOB", "PSAUMES": "PSA", "PSAUME": "PSA",
    "PROVERBES": "PRO", "ECCLÉSIASTE": "ECC", "CANTIQUE DES CANTIQUES": "SNG", "CANTIQUE": "SNG",
    "ÉSAÏE": "ISA", "ESAÏE": "ISA", "JÉRÉMIE": "JER", "LAMENTATIONS": "LAM",
    "ÉZÉCHIEL": "EZK", "EZÉCHIEL": "EZK", "DANIEL": "DAN", "OSÉE": "HOS", "JOËL": "JOL",
    "AMOS": "AMO", "ABDIAS": "OBA", "JONAS": "JON", "MICHÉE": "MIC", "NAHUM": "NAM",
    "HABACUC": "HAB", "HABAKUK": "HAB", "SOPHONIE": "ZEP", "AGGÉE": "HAG", "ZACHARIE": "ZEC", "MALACHIE": "MAL",
    "MATTHIEU": "MAT", "MARC": "MRK", "LUC": "LUK", "JEAN": "JHN", "ACTES": "ACT",
    "ROMAINS": "ROM", "1 CORINTHIENS": "1CO", "2 CORINTHIENS": "2CO", "GALATES": "GAL",
    "ÉPHÉSIENS": "EPH", "EPHESIENS": "EPH", "PHILIPPIENS": "PHP", "COLOSSIENS": "COL",
    "1 THESSALONICIENS": "1TH", "2 THESSALONICIENS": "2TH", "1 TIMOTHÉE": "1TI", "2 TIMOTHÉE": "2TI",
    "TITE": "TIT", "PHILÉMON": "PHM", "HÉBREUX": "HEB", "JACQUES": "JAS",
    "1 PIERRE": "1PE", "2 PIERRE": "2PE", "1 JEAN": "1JN", "2 JEAN": "2JN", "3 JEAN": "3JN",
    "JUDE": "JUD", "APOCALYPSE": "REV"
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

# 3. NOUVELLE FRANÇAIS COURANT (NFC) - Parser Corrigé
def extract_nfc_paragraphs():
    epub_path = os.path.join(EBOOKS_DIR, r"nfc-ebook-sans-deuterocanoniques\nfc_sansDC.epub")
    if not os.path.exists(epub_path): return
    print("\n--- Extraction Paragraphes : NFC (Corrigé) ---")
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
                # Découper par chapitre : <h3 id="chapter_X" class="chapter">
                ch_blocks = re.split(r'<h3\s+id="chapter_(\d+)"\s+class="chapter">', c)
                if len(ch_blocks) >= 3:
                    # ch_blocks[1] = '1', ch_blocks[2] = content of ch 1, ch_blocks[3] = '2', ch_blocks[4] = content of ch 2...
                    for idx in range(1, len(ch_blocks), 2):
                        ch_num = int(ch_blocks[idx])
                        ch_html = ch_blocks[idx + 1]
                        
                        # Chaque <div class="p">, <div class="q">, <div class="q1">, <div class="q2">, <div class="m">, <div class="b">, <p>
                        for p in re.findall(r'<div class="(?:p|q|q1|q2|m|b)"[^>]*>.*?</div>|<p[^>]*>.*?</p>', ch_html, re.DOTALL):
                            m = re.search(r'<span class="verses">(\d+)</span>|<span class="v">(\d+)</span>', p)
                            if m:
                                v = int(m.group(1) or m.group(2))
                                paras.append(f"{ch_num}:{v}")
                                
                if paras:
                    update_book_json_paragraphs("NFC", usfm, paras)
                    total_p += len(set(paras))
                    books_count += 1
        print(f"-> NFC : {books_count} livres mis à jour ({total_p} paragraphes)")

# 4. DARBY (Authentique avec Découpage Paragraphes)
def extract_darby_paragraphs():
    epub_path = os.path.join(EBOOKS_DIR, "La Sainte Bible (Version J.-N. Darby) (z-library.sk, 1lib.sk, z-lib.sk).epub")
    if not os.path.exists(epub_path):
        print(f"Introuvable : {epub_path}")
        return
        
    print("\n--- Extraction Paragraphes : Darby ---")
    with zipfile.ZipFile(epub_path, "r") as z:
        total_p = 0
        books_count = 0
        for i in range(5, 71):
            fname = f"OEBPS/chapter_{i}.xhtml"
            if fname not in z.namelist():
                continue
            c = z.read(fname).decode("utf-8", errors="ignore")
            
            m_title = re.search(r'<h1>(.*?)</h1>', c)
            if not m_title:
                continue
                
            raw_title = m_title.group(1).strip()
            # Nettoyer ex: '1. Samuel' -> '1 SAMUEL', '.2 Timothée' -> '2 TIMOTHÉE'
            clean_title = re.sub(r'^\.|\.$|\.', ' ', raw_title)
            clean_title = re.sub(r'\s+', ' ', clean_title).strip().upper()
            usfm = DARBY_NAME_MAP.get(clean_title)
            if not usfm:
                print(f"Livre Darby inconnu: '{raw_title}' (nettoyé: '{clean_title}')")
                continue
                
            paras = []
            # Découper par chapitre : <h2 id="chp_...">... (\d+) ...</h2>
            ch_blocks = re.split(r'<h2\s+id="chp_[^"]*">\s*.*?\s+(\d+)\s*<', c)
            if len(ch_blocks) >= 3:
                for idx in range(1, len(ch_blocks), 2):
                    ch_num = int(ch_blocks[idx])
                    ch_html = ch_blocks[idx + 1]
                    
                    for p in re.findall(r'<p[^>]*>.*?</p>', ch_html, re.DOTALL):
                        m = re.search(r'<span class="verses">\s*(\d+)\s*</span>', p)
                        if m:
                            v = int(m.group(1))
                            paras.append(f"{ch_num}:{v}")
                            
            if paras:
                update_book_json_paragraphs("DARBY", usfm, paras)
                total_p += len(set(paras))
                books_count += 1
                
        print(f"-> Darby : {books_count} livres mis à jour ({total_p} paragraphes)")

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

if __name__ == "__main__":
    extract_s21_paragraphs()
    extract_tob_paragraphs()
    extract_nfc_paragraphs()
    extract_darby_paragraphs()
    extract_pdv_paragraphs()
    print("\nExtraction de tous les paragraphes terminée !")
