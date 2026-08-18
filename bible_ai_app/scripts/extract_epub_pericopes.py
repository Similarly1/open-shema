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

# Mapping complet standardisé
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

def update_book_json(folder_name: str, usfm_code: str, sections_dict: Dict[str, str], pericopes_list: List[Dict[str, Any]]) -> bool:
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
            
        data["sections"] = sections_dict
        data["pericopes"] = pericopes_list
        
        with open(matched_file, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        print(f"Erreur mise à jour {matched_file}: {e}")
        return False

def build_pericopes_from_sections(sections_dict: Dict[str, str], chapters_dict: Dict[str, Any]) -> List[Dict[str, Any]]:
    items = []
    for k, title in sections_dict.items():
        parts = k.split(":")
        if len(parts) == 2 and parts[0].isdigit() and parts[1].isdigit():
            items.append((int(parts[0]), int(parts[1]), title))
            
    items.sort(key=lambda x: (x[0], x[1]))
    if not items:
        return []
        
    pericopes = []
    for i, (ch, v, title) in enumerate(items):
        if i + 1 < len(items):
            next_ch, next_v, _ = items[i + 1]
            if next_ch == ch:
                end_ch = ch
                end_v = max(v, next_v - 1)
            else:
                end_ch = ch
                ch_verses = chapters_dict.get(str(ch), {})
                max_v_in_ch = max([int(x) for x in ch_verses.keys() if x.isdigit()] or [v])
                end_v = max_v_in_ch
        else:
            end_ch = ch
            ch_verses = chapters_dict.get(str(ch), {})
            max_v_in_ch = max([int(x) for x in ch_verses.keys() if x.isdigit()] or [v])
            end_v = max_v_in_ch
            
        pericopes.append({
            "title": title,
            "start_ch": ch,
            "start_v": v,
            "end_ch": end_ch,
            "end_v": end_v
        })
    return pericopes

def extract_segond_21():
    epub_path = os.path.join(EBOOKS_DIR, "Bible S21.epub")
    if not os.path.exists(epub_path):
        print(f"Fichier manquant: {epub_path}")
        return
        
    print("\n--- Extraction Segond 21 ---")
    with zipfile.ZipFile(epub_path, 'r') as z:
        book_sections = {}
        for name in z.namelist():
            if not (name.startswith("Ops/") and name.endswith(".html")):
                continue
            base = os.path.basename(name).replace(".html", "")
            if "-" not in base:
                continue
            book_prefix, chap_str = base.rsplit("-", 1)
            if not chap_str.isdigit():
                continue
            chap_num = int(chap_str)
            usfm = PREFIX_TO_USFM.get(book_prefix)
            if not usfm:
                continue
                
            if usfm not in book_sections:
                book_sections[usfm] = {}
                
            content = z.read(name).decode("utf-8", errors="ignore")
            pattern = re.compile(r'<(h[345])[^>]*>(.*?)</\1>|<span class="verseNum">\s*(\d+)\s*</span>', re.DOTALL)
            
            headers = []
            for m in pattern.finditer(content):
                if m.group(1):
                    tag = m.group(1)
                    txt = re.sub(r'<[^>]+>', '', m.group(2)).strip()
                    txt = re.sub(r'\s+', ' ', txt)
                    if txt:
                        headers.append((tag, txt))
                elif m.group(3) and headers:
                    v_num = int(m.group(3))
                    h4_titles = [t for tag, t in headers if tag == 'h4']
                    h3_titles = [t for tag, t in headers if tag == 'h3']
                    chosen_title = h4_titles[-1] if h4_titles else h3_titles[-1]
                    ref_key = f"{chap_num}:{v_num}"
                    book_sections[usfm][ref_key] = chosen_title
                    headers = []
                    
        total_sections = 0
        for usfm, sec_dict in book_sections.items():
            target_dir = os.path.join(DATA_BIBLES_DIR, "Segond_21")
            matched_file = None
            if os.path.exists(target_dir):
                for fname in os.listdir(target_dir):
                    if fname.endswith(".json") and f"_{usfm}_" in fname:
                        matched_file = os.path.join(target_dir, fname)
                        break
            ch_dict = {}
            if matched_file:
                with open(matched_file, "r", encoding="utf-8") as f:
                    ch_dict = json.load(f).get("chapters", {})
            pericopes = build_pericopes_from_sections(sec_dict, ch_dict)
            if update_book_json("Segond_21", usfm, sec_dict, pericopes):
                total_sections += len(sec_dict)
                
        print(f"Segond 21 : {len(book_sections)} livres mis à jour, {total_sections} sections extraites.")

def extract_nfc():
    epub_path = os.path.join(EBOOKS_DIR, r"nfc-ebook-sans-deuterocanoniques\nfc_sansDC.epub")
    if not os.path.exists(epub_path):
        epub_path = os.path.join(EBOOKS_DIR, "La Bible Nouvelle Francais cour - Collectif.kepub.epub")
    if not os.path.exists(epub_path):
        print(f"Fichier NFC manquant: {epub_path}")
        return
        
    print("\n--- Extraction Nouvelle Français Courant (NFC) ---")
    with zipfile.ZipFile(epub_path, 'r') as z:
        book_sections = {}
        for name in z.namelist():
            if not (name.startswith("OEBPS/XHTML/") and name.endswith(".xhtml")):
                continue
            if any(x in name for x in ['GLO', 'toc', 'cover', 'nav', 'titlepage', 'preface', 'intro']):
                continue
                
            parts = name.split("/")
            if len(parts) < 4:
                continue
            book_dir = parts[2]
            usfm = book_dir.upper()
            if usfm == "JN": usfm = "JHN"
            elif usfm == "MT": usfm = "MAT"
            elif usfm == "MC": usfm = "MRK"
            elif usfm == "LC": usfm = "LUK"
            elif usfm == "AC": usfm = "ACT"
            elif usfm == "PS": usfm = "PSA"
            elif usfm == "PR": usfm = "PRO"
            elif usfm == "EC": usfm = "ECC"
            elif usfm == "CT": usfm = "SNG"
            elif usfm == "ES": usfm = "ISA"
            elif usfm == "JR": usfm = "JER"
            elif usfm == "LM": usfm = "LAM"
            elif usfm == "EZ": usfm = "EZK"
            elif usfm == "DA": usfm = "DAN"
            elif usfm == "OS": usfm = "HOS"
            elif usfm == "JL": usfm = "JOL"
            elif usfm == "AM": usfm = "AMO"
            elif usfm == "AB": usfm = "OBA"
            elif usfm == "SO": usfm = "ZEP"
            elif usfm == "AG": usfm = "HAG"
            elif usfm == "ZA": usfm = "ZEC"
            elif usfm == "ML": usfm = "MAL"
            elif usfm == "AP": usfm = "REV"
            elif usfm == "JA": usfm = "JAS"
            elif usfm == "JD": usfm = "JUD"
            elif usfm == "PHM": usfm = "PHM"
            
            if usfm not in book_sections:
                book_sections[usfm] = {}
                
            content = z.read(name).decode("utf-8", errors="ignore")
            cur_chap = 1
            pattern = re.compile(
                r'<h3 id="chapter_(\d+)"|<(h[34])[^>]*class="([^"]*)"[^>]*>(.*?)</\2>|<span class="verses">\s*(\d+)\s*</span>',
                re.DOTALL
            )
            headers = []
            for m in pattern.finditer(content):
                if m.group(1):
                    cur_chap = int(m.group(1))
                elif m.group(2):
                    cls = m.group(3)
                    txt = re.sub(r'<[^>]+>', '', m.group(4)).strip()
                    txt = re.sub(r'\s+', ' ', txt)
                    if 'chapter' not in cls and txt and not any(x in txt.lower() for x in ["l'essentiel", 'pour aller plus loin', 'table des']):
                        headers.append((cls, txt))
                elif m.group(5) and headers:
                    v_num = int(m.group(5))
                    s_titles = [t for c_name, t in headers if c_name == 's']
                    ms_titles = [t for c_name, t in headers if 'ms' in c_name]
                    chosen_title = s_titles[-1] if s_titles else (ms_titles[-1] if ms_titles else headers[-1][1])
                    ref_key = f"{cur_chap}:{v_num}"
                    book_sections[usfm][ref_key] = chosen_title
                    headers = []

        total_sections = 0
        for usfm, sec_dict in book_sections.items():
            target_dir = os.path.join(DATA_BIBLES_DIR, "NFC")
            matched_file = None
            if os.path.exists(target_dir):
                for fname in os.listdir(target_dir):
                    if fname.endswith(".json") and f"_{usfm}_" in fname:
                        matched_file = os.path.join(target_dir, fname)
                        break
            ch_dict = {}
            if matched_file:
                with open(matched_file, "r", encoding="utf-8") as f:
                    ch_dict = json.load(f).get("chapters", {})
            pericopes = build_pericopes_from_sections(sec_dict, ch_dict)
            if update_book_json("NFC", usfm, sec_dict, pericopes):
                total_sections += len(sec_dict)
        print(f"NFC : {len(book_sections)} livres mis à jour, {total_sections} sections extraites.")

def extract_tob():
    epub_path = os.path.join(EBOOKS_DIR, "La Bible TOB.epub")
    if not os.path.exists(epub_path):
        print(f"Fichier TOB manquant: {epub_path}")
        return
        
    print("\n--- Extraction TOB 2010 ---")
    with zipfile.ZipFile(epub_path, 'r') as z:
        book_sections = {}
        for name in sorted(z.namelist()):
            if not (name.startswith("text/part") and name.endswith(".html")):
                continue
            content = z.read(name).decode("utf-8", errors="ignore")
            
            pattern = re.compile(
                r'<h[1234][^>]*class="title"[^>]*>(.*?)</h[1234]>|<span class="versejump"[^>]*>([A-Za-z0-9]+)\s+(\d+)\s+(\d+)</span>|<a id="v([A-Za-z0-9]+)\.(\d+)\.(\d+)"></a>',
                re.DOTALL
            )
            headers = []
            for m in pattern.finditer(content):
                if m.group(1):
                    txt = re.sub(r'<[^>]+>', '', m.group(1)).strip()
                    txt = re.sub(r'\s+', ' ', txt)
                    if txt and not any(x in txt.lower() for x in ['introduction', 'liste des livres', 'table des', 'notes']):
                        headers.append(txt)
                elif (m.group(2) or m.group(5)) and headers:
                    raw_bk = m.group(2) or m.group(5)
                    ch = int(m.group(3) or m.group(6))
                    v = int(m.group(4) or m.group(7))
                    usfm = PREFIX_TO_USFM.get(raw_bk)
                    if usfm:
                        if usfm not in book_sections:
                            book_sections[usfm] = {}
                        ref_key = f"{ch}:{v}"
                        book_sections[usfm][ref_key] = headers[-1]
                    headers = []

        total_sections = 0
        for usfm, sec_dict in book_sections.items():
            target_dir = os.path.join(DATA_BIBLES_DIR, "TOB")
            matched_file = None
            if os.path.exists(target_dir):
                for fname in os.listdir(target_dir):
                    if fname.endswith(".json") and f"_{usfm}_" in fname:
                        matched_file = os.path.join(target_dir, fname)
                        break
            ch_dict = {}
            if matched_file:
                with open(matched_file, "r", encoding="utf-8") as f:
                    ch_dict = json.load(f).get("chapters", {})
            pericopes = build_pericopes_from_sections(sec_dict, ch_dict)
            if update_book_json("TOB", usfm, sec_dict, pericopes):
                total_sections += len(sec_dict)
        print(f"TOB : {len(book_sections)} livres mis à jour, {total_sections} sections extraites.")

def extract_parole_vivante():
    epub_path = os.path.join(EBOOKS_DIR, "Parole vivante.epub")
    if not os.path.exists(epub_path):
        print(f"Fichier Parole Vivante manquant: {epub_path}")
        return
        
    print("\n--- Extraction Parole Vivante (NT) ---")
    with zipfile.ZipFile(epub_path, 'r') as z:
        content = z.read("OEBPS/EPUB.Parole.Vivante.xhtml").decode("utf-8", errors="ignore")
        
        book_sections = {}
        cur_book_idx = -1
        cur_chap = 1
        pending_headers = []
        
        pattern = re.compile(
            r'<p[^>]*class="([^"]*PV-03-titres-tx-biblique[^"]*)"[^>]*>(.*?)</p>|<p[^>]*class="([^"]*PV-02-st[^"]*)"[^>]*>(.*?)</p>|<span[^>]*class="[^"]*_idGenDropcap-1[^"]*">\s*(\d+)&#160;\s*</span>|<span[^>]*class="[^"]*PV-00-exposant-verset[^"]*">\s*(\d+)&#160;\s*</span>',
            re.DOTALL
        )
        
        for m in pattern.finditer(content):
            if m.group(1):
                # Nouveau livre biblique
                cur_book_idx += 1
                cur_chap = 1
                pending_headers = []
            elif m.group(3):
                # Titre de section / péricope
                txt = re.sub(r'<[^>]+>', '', m.group(4)).strip()
                txt = re.sub(r'\s+', ' ', txt)
                if txt:
                    pending_headers.append(txt)
            elif m.group(5):
                # Nouveau chapitre (dropcap) -> verset 1
                cur_chap = int(m.group(5))
                if 0 <= cur_book_idx < len(PV_NT_BOOKS) and pending_headers:
                    usfm = PV_NT_BOOKS[cur_book_idx][0]
                    if usfm not in book_sections:
                        book_sections[usfm] = {}
                    book_sections[usfm][f"{cur_chap}:1"] = pending_headers[-1]
                    pending_headers = []
            elif m.group(6):
                # Numéro de verset
                v_num = int(m.group(6))
                if 0 <= cur_book_idx < len(PV_NT_BOOKS) and pending_headers:
                    usfm = PV_NT_BOOKS[cur_book_idx][0]
                    if usfm not in book_sections:
                        book_sections[usfm] = {}
                    book_sections[usfm][f"{cur_chap}:{v_num}"] = pending_headers[-1]
                    pending_headers = []

        total_sections = 0
        for usfm, sec_dict in book_sections.items():
            target_dir = os.path.join(DATA_BIBLES_DIR, "Parole_Vivante")
            matched_file = None
            if os.path.exists(target_dir):
                for fname in os.listdir(target_dir):
                    if fname.endswith(".json") and f"_{usfm}_" in fname:
                        matched_file = os.path.join(target_dir, fname)
                        break
            ch_dict = {}
            if matched_file:
                with open(matched_file, "r", encoding="utf-8") as f:
                    ch_dict = json.load(f).get("chapters", {})
            pericopes = build_pericopes_from_sections(sec_dict, ch_dict)
            if update_book_json("Parole_Vivante", usfm, sec_dict, pericopes):
                total_sections += len(sec_dict)
        print(f"Parole Vivante : {len(book_sections)} livres mis à jour, {total_sections} sections extraites.")

def main():
    print("=== EXTRACTION GLOBALE DES TITRES DE PÉRICOPES ===")
    extract_segond_21()
    extract_nfc()
    extract_tob()
    extract_parole_vivante()
    print("\nExtraction terminée avec succès !")

if __name__ == "__main__":
    main()
