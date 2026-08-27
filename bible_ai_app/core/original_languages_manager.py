import logging
logger = logging.getLogger(__name__)
import os
import re
import json
import sqlite3
import urllib.request
from typing import Dict, List, Any, Optional, Tuple

# Mapping normalisé des livres (STEPBible -> Standard 3-lettres App)
STEP_BOOK_TO_STANDARD = {
    "Gen": "GEN", "Exo": "EXO", "Lev": "LEV", "Num": "NUM", "Deu": "DEU",
    "Jos": "JOS", "Jdg": "JDG", "Rut": "RUT", "1Sa": "1SA", "2Sa": "2SA",
    "1Ki": "1KI", "2Ki": "2KI", "1Ch": "1CH", "2Ch": "2CH", "Ezr": "EZR",
    "Neh": "NEH", "Est": "EST", "Job": "JOB", "Psa": "PSA", "Pro": "PRO",
    "Ecc": "ECC", "Sng": "SNG", "Isa": "ISA", "Jer": "JER", "Lam": "LAM",
    "Ezk": "EZK", "Dan": "DAN", "Hos": "HOS", "Jol": "JOL", "Amo": "AMO",
    "Oba": "OBA", "Jon": "JON", "Mic": "MIC", "Nam": "NAM", "Hab": "HAB",
    "Zep": "ZEP", "Hag": "HAG", "Zec": "ZEC", "Mal": "MAL",
    "Mat": "MAT", "Mrk": "MRK", "Luk": "LUK", "Jhn": "JHN", "Act": "ACT",
    "Rom": "ROM", "1Co": "1CO", "2Co": "2CO", "Gal": "GAL", "Eph": "EPH",
    "Php": "PHP", "Col": "COL", "1Th": "1TH", "2Th": "2TH", "1Ti": "1TI",
    "2Ti": "2TI", "Tit": "TIT", "Phm": "PHM", "Heb": "HEB", "Jas": "JAS",
    "1Pe": "1PE", "2Pe": "2PE", "1Jn": "1JN", "2Jn": "2JN", "3Jn": "3JN",
    "Jud": "JUD", "Rev": "REV"
}

# URLs officielles des datasets STEPBible (Translators Amalgamated OT+NT)
STEPBIBLE_URLS = {
    # Ancien Testament (Hébreu)
    "TAHOT_Gen-Deu": "https://raw.githubusercontent.com/STEPBible/STEPBible-Data/master/Translators%20Amalgamated%20OT%2BNT/TAHOT%20Gen-Deu%20-%20Translators%20Amalgamated%20Hebrew%20OT%20-%20STEPBible.org%20CC%20BY.txt",
    "TAHOT_Jos-Est": "https://raw.githubusercontent.com/STEPBible/STEPBible-Data/master/Translators%20Amalgamated%20OT%2BNT/TAHOT%20Jos-Est%20-%20Translators%20Amalgamated%20Hebrew%20OT%20-%20STEPBible.org%20CC%20BY.txt",
    "TAHOT_Job-Sng": "https://raw.githubusercontent.com/STEPBible/STEPBible-Data/master/Translators%20Amalgamated%20OT%2BNT/TAHOT%20Job-Sng%20-%20Translators%20Amalgamated%20Hebrew%20OT%20-%20STEPBible.org%20CC%20BY.txt",
    "TAHOT_Isa-Mal": "https://raw.githubusercontent.com/STEPBible/STEPBible-Data/master/Translators%20Amalgamated%20OT%2BNT/TAHOT%20Isa-Mal%20-%20Translators%20Amalgamated%20Hebrew%20OT%20-%20STEPBible.org%20CC%20BY.txt",
    # Nouveau Testament (Grec)
    "TAGNT_Mat-Jhn": "https://raw.githubusercontent.com/STEPBible/STEPBible-Data/master/Translators%20Amalgamated%20OT%2BNT/TAGNT%20Mat-Jhn%20-%20Translators%20Amalgamated%20Greek%20NT%20-%20STEPBible.org%20CC-BY.txt",
    "TAGNT_Act-Rev": "https://raw.githubusercontent.com/STEPBible/STEPBible-Data/master/Translators%20Amalgamated%20OT%2BNT/TAGNT%20Act-Rev%20-%20Translators%20Amalgamated%20Greek%20NT%20-%20STEPBible.org%20CC-BY.txt",
}

class OriginalLanguagesManager:
    """
    Gestionnaire central pour l'accès aux textes originaux hébreu/araméen (AT) et grec (NT).
    """
    _instance = None
    _base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    _db_path = os.path.join(_base_dir, "data", "original_languages.db")
    _lexicon_cache = None

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = OriginalLanguagesManager()
        return cls._instance

    def __init__(self):
        self.db_path = self._db_path
        self._ensure_db()

    def _ensure_db(self):
        """Initialise le schéma SQLite si la base n'existe pas encore."""
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("PRAGMA journal_mode = WAL;")
            conn.execute("""
                CREATE TABLE IF NOT EXISTS original_words (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    book_code TEXT NOT NULL,
                    chapter INTEGER NOT NULL,
                    verse INTEGER NOT NULL,
                    word_idx INTEGER NOT NULL,
                    original_text TEXT NOT NULL,
                    transliteration TEXT,
                    lemma TEXT,
                    strong_code TEXT,
                    morph_code TEXT,
                    morph_desc_fr TEXT,
                    gloss TEXT,
                    lang TEXT
                );
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_orig_ref ON original_words(book_code, chapter, verse, word_idx);")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_orig_strong ON original_words(strong_code);")

    def is_installed(self) -> bool:
        """Vérifie si la base de données contient des données."""
        if not os.path.exists(self.db_path):
            return False
        try:
            with sqlite3.connect(self.db_path) as conn:
                cur = conn.cursor()
                cur.execute("SELECT COUNT(*) FROM original_words LIMIT 1;")
                count = cur.fetchone()[0]
                return count > 100000  # Le texte complet contient environ 440 000 mots
        except Exception:
            return False

    def get_stats(self) -> Dict[str, Any]:
        """Retourne des statistiques sur la base de données originale."""
        if not os.path.exists(self.db_path):
            return {"installed": False, "total_words": 0, "ot_words": 0, "nt_words": 0}
        try:
            with sqlite3.connect(self.db_path) as conn:
                cur = conn.cursor()
                cur.execute("SELECT COUNT(*), COUNT(CASE WHEN lang='hebrew' THEN 1 END), COUNT(CASE WHEN lang='greek' THEN 1 END) FROM original_words;")
                row = cur.fetchone()
                total, ot, nt = row if row else (0, 0, 0)
                return {
                    "installed": total > 100000,
                    "total_words": total,
                    "ot_words": ot,
                    "nt_words": nt,
                    "db_size_mb": round(os.path.getsize(self.db_path) / (1024 * 1024), 2) if os.path.exists(self.db_path) else 0.0
                }
        except Exception:
            return {"installed": False, "total_words": 0, "ot_words": 0, "nt_words": 0}

    # =========================================================================
    # DÉCODEURS MORPHOLOGIQUES (Grec & Hébreu -> Français)
    # =========================================================================

    @staticmethod
    def decode_greek_morphology(code: str) -> str:
        """Traduit un code morphologique grec (ex: V-AAI-3S, N-NSF) en français."""
        if not code:
            return ""
        code = code.strip()
        parts = code.split("-")
        cat = parts[0]
        details = parts[1] if len(parts) > 1 else ""

        cat_names = {
            "N": "Nom", "V": "Verbe", "A": "Adjectif", "T": "Article défini",
            "P": "Pronom personnel", "R": "Pronom relatif", "C": "Conjonction",
            "D": "Adverbe", "PREP": "Préposition", "CONJ": "Conjonction",
            "ADV": "Adverbe", "PRT": "Particule", "I": "Interjection",
            "X": "Pronom indéfini", "Q": "Pronom interrogatif", "F": "Pronom réflexif",
            "S": "Pronom possessif", "K": "Pronom corrélatif"
        }

        # Verbes (ex: AAI-3S, PAI-3P, PAP-NSM)
        if cat == "V" and details:
            tense_map = {"P": "Présent", "I": "Imparfait", "F": "Futur", "A": "Aoriste", "R": "Parfait", "L": "Plus-que-parfait"}
            voice_map = {"A": "Actif", "M": "Moyen", "P": "Passif", "E": "Moyen ou Passif", "D": "Déponent"}
            mood_map = {"I": "Indicatif", "S": "Subjonctif", "O": "Optatif", "M": "Impératif", "N": "Infinitif", "P": "Participe"}
            
            t = tense_map.get(details[0], details[0]) if len(details) > 0 else ""
            v = voice_map.get(details[1], details[1]) if len(details) > 1 else ""
            m = mood_map.get(details[2], details[2]) if len(details) > 2 else ""
            
            p_str = ""
            if len(parts) > 2:
                pers = parts[2]
                pers_map = {"1S": "1re pers. sing.", "2S": "2e pers. sing.", "3S": "3e pers. sing.",
                            "1P": "1re pers. plur.", "2P": "2e pers. plur.", "3P": "3e pers. plur.",
                            "NSM": "Nom. sing. masc.", "NSF": "Nom. sing. fém.", "NSN": "Nom. sing. neutre",
                            "GSM": "Gén. sing. masc.", "GSF": "Gén. sing. fém.", "GSN": "Gén. sing. neutre",
                            "DSM": "Dat. sing. masc.", "DSF": "Dat. sing. fém.", "DSN": "Dat. sing. neutre",
                            "ASM": "Acc. sing. masc.", "ASF": "Acc. sing. fém.", "ASN": "Acc. sing. neutre",
                            "NPM": "Nom. plur. masc.", "NPF": "Nom. plur. fém.", "NPN": "Nom. plur. neutre",
                            "GPM": "Gén. plur. masc.", "GPF": "Gén. plur. fém.", "GPN": "Gén. plur. neutre",
                            "DPM": "Dat. plur. masc.", "DPF": "Dat. plur. fém.", "DPN": "Dat. plur. neutre",
                            "APM": "Acc. plur. masc.", "APF": "Acc. plur. fém.", "APN": "Acc. plur. neutre"}
                p_str = pers_map.get(pers, pers)
            
            res = f"Verbe {t} {v} {m}".strip()
            if p_str:
                res += f" ({p_str})"
            return res

        # Noms / Adjectifs / Articles / Pronoms (ex: NSF, GSM, APM)
        if details:
            case_map = {"N": "Nominatif", "V": "Vocatif", "G": "Génitif", "D": "Datif", "A": "Accusatif"}
            num_map = {"S": "singulier", "P": "pluriel"}
            gen_map = {"M": "masculin", "F": "féminin", "N": "neutre"}
            
            c = case_map.get(details[0], details[0]) if len(details) > 0 else ""
            n = num_map.get(details[1], details[1]) if len(details) > 1 else ""
            g = gen_map.get(details[2], details[2]) if len(details) > 2 else ""
            
            cat_name = cat_names.get(cat, cat)
            prop = " propre" if len(parts) > 2 and parts[2] == "P" else ""
            return f"{cat_name}{prop} {c} {g} {n}".strip()

        return cat_names.get(cat, code)

    @staticmethod
    def decode_hebrew_morphology(code: str) -> str:
        """Traduit un code morphologique hébreu (ex: HC/Td/Ncfsa, HVqp3fs, HNcmsa, HR) en français."""
        if not code:
            return ""
        code = code.strip()
        
        # Supprimer le préfixe initial "H" ou "A" (Hébreu/Araméen) si présent devant les codes standards
        prefixes_map = {
            "HR": "Préposition", "HC": "Conjonction", "HT": "Article",
            "Td": "Article défini", "Hd": "Particule interrogative", "Ti": "Particule d'existence", "Tn": "Négation",
            "Pp": "Pronom personnel", "Pd": "Pronom démonstratif", "Pi": "Pronom interrogatif",
            "R": "Préposition", "C": "Conjonction", "D": "Adverbe"
        }
        stem_map = {
            "q": "Qal", "N": "Niphal", "p": "Piel", "P": "Pual", "h": "Hiphil",
            "H": "Hophal", "t": "Hithpael", "o": "Polel", "O": "Polal"
        }
        tense_map = {
            "p": "Parfait (accompli)", "q": "Parfait séquentiel", "i": "Imparfait (inaccompli)",
            "w": "Imparfait séquentiel (Vayyiqtol)", "v": "Impératif", "a": "Participe actif",
            "s": "Participe passif", "c": "Infinitif construit", "b": "Infinitif absolu", "j": "Jussif", "h": "Cohortatif"
        }
        person_map = {
            "1cs": "1re pers. com. sing.", "2ms": "2e pers. masc. sing.", "2fs": "2e pers. fém. sing.",
            "3ms": "3e pers. masc. sing.", "3fs": "3e pers. fém. sing.", "1cp": "1re pers. com. plur.",
            "2mp": "2e pers. masc. plur.", "2fp": "2e pers. fém. plur.", "3mp": "3e pers. masc. plur.",
            "3fp": "3e pers. fém. plur."
        }
        gender_num_map = {
            "ms": "masc. sing.", "fs": "fém. sing.", "mp": "masc. plur.", "fp": "fém. plur.",
            "md": "masc. duel", "fd": "fém. duel", "cs": "com. sing.", "cp": "com. plur."
        }
        state_map = {"a": "absolu", "c": "construit", "e": "emphatique"}

        elements = []
        segments = code.split("/")
        
        for idx, seg in enumerate(segments):
            seg = seg.strip()
            if not seg:
                continue
                
            # Préfixes connus
            if seg in prefixes_map:
                elements.append(prefixes_map[seg])
                continue
                
            # Nettoyer 'H' initial s'il s'agit d'un mot hébreu (ex: HVqp3fs -> Vqp3fs, HNcmsa -> Ncmsa)
            clean_seg = seg[1:] if (seg.startswith("H") or seg.startswith("A")) and len(seg) > 1 and seg[1] in ["V", "N", "A", "P", "R", "C", "D", "T"] else seg
            
            # Verbe
            if clean_seg.startswith("V") and len(clean_seg) >= 3:
                stem = stem_map.get(clean_seg[1], clean_seg[1])
                tense = tense_map.get(clean_seg[2], clean_seg[2])
                pers = person_map.get(clean_seg[3:6], "")
                v_desc = f"Verbe {stem} {tense}"
                if pers:
                    v_desc += f" ({pers})"
                elements.append(v_desc)
            # Nom
            elif clean_seg.startswith("N") and len(clean_seg) >= 3:
                n_type = "Nom propre" if clean_seg.startswith("Np") else "Nom"
                gn = gender_num_map.get(clean_seg[2:4], "")
                st = state_map.get(clean_seg[4:5], "")
                n_desc = f"{n_type} {gn} {st}".strip()
                elements.append(n_desc)
            # Adjectif
            elif clean_seg.startswith("A") and len(clean_seg) >= 3:
                gn = gender_num_map.get(clean_seg[2:4], "")
                st = state_map.get(clean_seg[4:5], "")
                elements.append(f"Adjectif {gn} {st}".strip())
            # Préposition / Conjonction / Adverbe
            elif clean_seg in prefixes_map:
                elements.append(prefixes_map[clean_seg])
            elif clean_seg.startswith("R"):
                elements.append("Préposition")
            elif clean_seg.startswith("C"):
                elements.append("Conjonction")
            elif clean_seg.startswith("D"):
                elements.append("Adverbe")
            else:
                elements.append(seg)

        return " + ".join(elements)

    # =========================================================================
    # IMPORTATION ET PARSING STEPBIBLE-DATA
    # =========================================================================

    def download_and_import(self, progress_callback=None) -> bool:
        """
        Télécharge les 6 fichiers de STEPBible-Data et les importe dans SQLite.
        """
        raw_dir = os.path.join(self._base_dir, "data", "stepbible_raw")
        os.makedirs(raw_dir, exist_ok=True)
        
        # 1. Téléchargement des fichiers
        total_files = len(STEPBIBLE_URLS)
        for i, (key, url) in enumerate(STEPBIBLE_URLS.items(), 1):
            dest_file = os.path.join(raw_dir, f"{key}.txt")
            if not os.path.exists(dest_file) or os.path.getsize(dest_file) < 1000000:
                if progress_callback:
                    progress_callback(f"Téléchargement {key} ({i}/{total_files})...", (i - 1) / total_files * 0.4)
                urllib.request.urlretrieve(url, dest_file)
        
        # 2. Parsing et insertion SQLite
        if progress_callback:
            progress_callback("Création et indexation de la base SQLite...", 0.45)
            
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("DROP TABLE IF EXISTS original_words;")
            self._ensure_db()
            
            insert_rows = []
            file_keys = list(STEPBIBLE_URLS.keys())
            
            for f_idx, key in enumerate(file_keys):
                filepath = os.path.join(raw_dir, f"{key}.txt")
                if not os.path.exists(filepath):
                    continue
                    
                is_hebrew = "TAHOT" in key
                lang = "hebrew" if is_hebrew else "greek"
                
                if progress_callback:
                    progress_callback(f"Indexation de {key}...", 0.45 + (f_idx / len(file_keys)) * 0.45)
                    
                with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                    for line in f:
                        line = line.strip()
                        if not line or line.startswith("#") or line.startswith("="):
                            continue
                            
                        # Les lignes de données commencent par une référence: Book.Chap.Verse#Index...
                        # Ex: Gen.1.1#01=K \t בְּרֵאשִׁ֖ית (bərēʾšît) \t In [the] beginning \t H7225=HR/Ncfsa \t רֵאשִׁית=beginning
                        parts = line.split("\t")
                        if len(parts) < 4:
                            continue
                            
                        ref_part = parts[0]
                        m = re.match(r"^([0-9A-Za-z]+)\.([0-9]+)\.([0-9]+)#([0-9]+)", ref_part)
                        if not m:
                            continue
                            
                        raw_book, raw_ch, raw_v, raw_w = m.groups()
                        book_code = STEP_BOOK_TO_STANDARD.get(raw_book, raw_book.upper())
                        chapter = int(raw_ch)
                        verse = int(raw_v)
                        word_idx = int(raw_w)
                            
                        if is_hebrew:
                            # TAHOT : Col 1=Hebrew, Col 2=Translit, Col 3=Gloss, Col 4=dStrongs, Col 5=Grammar, Col 8=RootStrong, Col 11=Expanded
                            raw_heb = parts[1].strip() if len(parts) > 1 else ""
                            orig_text = re.sub(r"[/\\׃־]", "", raw_heb).strip()
                            raw_translit = parts[2].strip() if len(parts) > 2 else ""
                            translit = re.sub(r"[/\\]", "", raw_translit).strip()
                            raw_gloss = parts[3].strip() if len(parts) > 3 else ""
                            gloss = re.sub(r"\s+", " ", raw_gloss.replace("/", " ")).strip()
                            
                            # Strong code
                            root_strong = parts[8].strip() if len(parts) > 8 else ""
                            if root_strong:
                                s_m = re.search(r"(H[0-9]+)", root_strong)
                                strong_code = s_m.group(1) if s_m else root_strong
                            else:
                                raw_strongs = parts[4].strip() if len(parts) > 4 else ""
                                s_m = re.search(r"\{?(H[0-9]+[A-Za-z]*)", raw_strongs)
                                strong_code = s_m.group(1) if s_m else raw_strongs
                                
                            morph_code = parts[5].strip() if len(parts) > 5 else ""
                            
                            # Lemma
                            lemma = ""
                            if len(parts) > 11 and parts[11]:
                                m_lem = re.search(r"H[0-9]+[A-Za-z]*=([^=]+)=", parts[11])
                                if m_lem:
                                    lemma = m_lem.group(1).strip()
                            if not lemma and strong_code:
                                strong_entry = self._get_strong_lexicon().get(strong_code)
                                if strong_entry:
                                    lemma = strong_entry.get("lemma", "")
                                    
                            morph_desc = self.decode_hebrew_morphology(morph_code)
                        else:
                            # TAGNT : Col 1=Greek (Translit), Col 2=Gloss, Col 3=dStrong=Grammar, Col 4=lemma=gloss
                            raw_orig_text = parts[1].strip() if len(parts) > 1 else ""
                            translit = ""
                            m_trans = re.search(r"\(([^)]+)\)", raw_orig_text)
                            if m_trans:
                                translit = m_trans.group(1).strip()
                                orig_text = re.sub(r"\s*\([^)]+\)", "", raw_orig_text).strip()
                            else:
                                orig_text = raw_orig_text
                                
                            gloss = parts[2].strip() if len(parts) > 2 else ""
                            
                            strong_morph = parts[3].strip() if len(parts) > 3 else ""
                            strong_code = ""
                            morph_code = ""
                            if "=" in strong_morph:
                                s_parts = strong_morph.split("=", 1)
                                strong_m = re.search(r"([HG][0-9]+[A-Za-z]*)", s_parts[0])
                                strong_code = strong_m.group(1) if strong_m else s_parts[0].strip()
                                morph_code = s_parts[1].strip()
                            else:
                                strong_code = strong_morph
                                
                            lemma = ""
                            if len(parts) > 4 and "=" in parts[4]:
                                lemma = parts[4].split("=")[0].strip()
                            elif len(parts) > 4:
                                lemma = parts[4].strip()
                                
                            morph_desc = self.decode_greek_morphology(morph_code)
                            
                        insert_rows.append((
                            book_code, chapter, verse, word_idx,
                            orig_text, translit, lemma, strong_code,
                            morph_code, morph_desc, gloss, lang
                        ))
                        
                        if len(insert_rows) >= 20000:
                            conn.executemany("""
                                INSERT INTO original_words 
                                (book_code, chapter, verse, word_idx, original_text, transliteration, lemma, strong_code, morph_code, morph_desc_fr, gloss, lang)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                            """, insert_rows)
                            insert_rows = []
                            
            if insert_rows:
                conn.executemany("""
                    INSERT INTO original_words 
                    (book_code, chapter, verse, word_idx, original_text, transliteration, lemma, strong_code, morph_code, morph_desc_fr, gloss, lang)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                """, insert_rows)
                
            conn.commit()
            
        if progress_callback:
            progress_callback("Indexation terminée avec succès !", 1.0)
            
        return True

    # =========================================================================
    # REQUÊTES DE CONSULTATION EXÉGÉTIQUE
    # =========================================================================

    def _get_strong_lexicon(self) -> Dict[str, Any]:
        """Charge en cache le lexique français Strong existant."""
        if self._lexicon_cache is None:
            lex_path = os.path.join(self._base_dir, "data", "strong_lexicon.json")
            if os.path.exists(lex_path):
                with open(lex_path, "r", encoding="utf-8") as f:
                    self._lexicon_cache = json.load(f)
            else:
                self._lexicon_cache = {}
        return self._lexicon_cache

    def get_verse_original_words(self, book_code: str, chapter: int, verse: int) -> List[Dict[str, Any]]:
        """
        Récupère tous les mots originaux d'un verset avec lemmes, morphologie et Strong.
        """
        if not self.is_installed():
            return []
            
        b_up = book_code.upper()
        lexicon = self._get_strong_lexicon()
        
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cur = conn.cursor()
            cur.execute("""
                SELECT * FROM original_words 
                WHERE book_code = ? AND chapter = ? AND verse = ?
                ORDER BY word_idx ASC;
            """, (b_up, chapter, verse))
            rows = cur.fetchall()
            
        result = []
        for r in rows:
            strong = r["strong_code"] or ""
            # Récupérer définition française Strong
            strong_entry = lexicon.get(strong)
            if not strong_entry and len(strong) > 1:
                prefix = strong[0]
                num_match = re.search(r'\d+', strong)
                if num_match:
                    num = int(num_match.group())
                    strong_entry = lexicon.get(f"{prefix}{num:04d}") or lexicon.get(f"{prefix}{num}")
                    
            strong_def = strong_entry.get("definition", "") if strong_entry else ""
            lemma = r["lemma"] or ""
            if (not lemma or len(lemma) <= 1) and strong_entry:
                lemma = strong_entry.get("lemma", "") or lemma
            
            result.append({
                "index": r["word_idx"],
                "text": r["original_text"],
                "transliteration": r["transliteration"],
                "lemma": lemma,
                "strong": strong,
                "strong_def_fr": strong_def,
                "morph_code": r["morph_code"],
                "morph_desc_fr": r["morph_desc_fr"],
                "gloss": r["gloss"],
                "lang": r["lang"]
            })
            
        return result

    def get_verse_reverse_interlinear(self, book_code: str, chapter: int, verse: int) -> str:
        """
        Génère la version Segond 1910 avec balises Strong & lemmes pour un verset.
        """
        lsg_dir = os.path.join(self._base_dir, "data", "bibles", "LSG")
        if not os.path.exists(lsg_dir):
            return ""
            
        b_up = book_code.upper()
        matching_file = None
        for f in os.listdir(lsg_dir):
            if f.endswith(".json") and (f"_{b_up}_" in f.upper() or f"_{b_up}." in f.upper() or f.upper().startswith(f"{b_up}_")):
                matching_file = os.path.join(lsg_dir, f)
                break
                
        if not matching_file:
            return ""
            
        try:
            with open(matching_file, "r", encoding="utf-8") as f:
                bible_data = json.load(f)
                
            raw_text = bible_data.get("chapters", {}).get(str(chapter), {}).get(str(verse), "")
            if not raw_text:
                return ""
                
            lexicon = self._get_strong_lexicon()
            
            def replace_tag(match):
                strong_code = match.group(1).strip()
                word = match.group(2).strip()
                if not word:
                    return ""
                    
                entry = lexicon.get(strong_code)
                if not entry and len(strong_code) > 1:
                    prefix = strong_code[0]
                    num_match = re.search(r'\d+', strong_code)
                    if num_match:
                        num = int(num_match.group())
                        entry = lexicon.get(f"{prefix}{num:04d}") or lexicon.get(f"{prefix}{num}")
                        
                lemma = entry.get("lemma", "") if entry else ""
                lemma_str = f": {lemma}" if lemma else ""
                return f"{word} [{strong_code}{lemma_str}]"
                
            formatted = re.sub(r'<w strong="([^"]+)">([^<]*)</w>', replace_tag, raw_text)
            formatted = re.sub(r'<[^>]+>', '', formatted)
            formatted = re.sub(r'\s+', ' ', formatted).strip()
            return formatted
        except Exception:
            return ""

    def get_passage_original_block(self, book_code: str, chapter: int, 
                                   start_verse: int = 1, end_verse: Optional[int] = None, 
                                   max_verses: int = 10,
                                   displayed_version_name: str = "Traduction courante",
                                   displayed_verses_dict: Optional[Dict[int, str]] = None) -> str:
        """
        Construit le triple bloc exégétique complet pour le LLM :
        1. Passage dans la version affichée
        2. Passage dans la version Segond 1910 avec interlinéaire inversé
        3. Passage dans le texte original (Hébreu/Grec mot-à-mot avec morphologie)
        """
        if end_verse is None or end_verse < start_verse:
            end_verse = start_verse
            
        total_requested = (end_verse - start_verse) + 1
        num_verses_to_process = min(total_requested, max_verses)
        actual_end_verse = start_verse + num_verses_to_process - 1
        
        sections = []
        is_truncated = total_requested > max_verses
        
        # 1. Version affichée
        displayed_lines = []
        if displayed_verses_dict:
            for v in range(start_verse, actual_end_verse + 1):
                txt = displayed_verses_dict.get(v, "")
                if txt:
                    clean_txt = re.sub(r'<[^>]+>', '', txt).strip()
                    displayed_lines.append(f"V.{v} : {clean_txt}")
        if displayed_lines:
            sections.append(f"--- 1. VERSION AFFICHÉE ({displayed_version_name}) ---\n" + "\n".join(displayed_lines))

        # 2. Segond 1910 Interlinéaire inversé
        interlinear_lines = []
        for v in range(start_verse, actual_end_verse + 1):
            rev_txt = self.get_verse_reverse_interlinear(book_code, chapter, v)
            if rev_txt:
                interlinear_lines.append(f"V.{v} : {rev_txt}")
        if interlinear_lines:
            sections.append("--- 2. VERSION SEGOND 1910 (INTERLINÉAIRE INVERSÉ AVEC CODES STRONGS) ---\n" + "\n".join(interlinear_lines))

        # 3. Texte original mot-à-mot avec morphologie
        orig_lines = []
        lang_name = ""
        for v in range(start_verse, actual_end_verse + 1):
            words = self.get_verse_original_words(book_code, chapter, v)
            if not words:
                continue
            if not lang_name:
                lang_name = "Hébreu (AT - WLC)" if words[0]["lang"] == "hebrew" else "Grec (NT - NA28/SBLGNT)"
                
            orig_lines.append(f"[Verset {v}]")
            for w in words:
                trans_str = f" ({w['transliteration']})" if w['transliteration'] else ""
                lemma_str = f" | Lemme: {w['lemma']}" if w['lemma'] else ""
                strong_str = f" | Strong: {w['strong']}" if w['strong'] else ""
                def_str = f" ({w['strong_def_fr'][:45]}...)" if w['strong_def_fr'] and len(w['strong_def_fr']) > 45 else (f" ({w['strong_def_fr']})" if w['strong_def_fr'] else "")
                morph_str = f" | Morpho: {w['morph_desc_fr'] or w['morph_code']}" if (w['morph_desc_fr'] or w['morph_code']) else ""
                gloss_str = f" | Sens: \"{w['gloss']}\"" if w['gloss'] else ""
                
                orig_lines.append(f"  • {w['text']}{trans_str}{lemma_str}{strong_str}{def_str}{morph_str}{gloss_str}")
                
        if orig_lines:
            trunc_note = f" (Limité aux {max_verses} premiers versets sur {total_requested} demandés)" if is_truncated else ""
            sections.append(f"--- 3. TEXTE ORIGINAL MOT-À-MOT ({lang_name}){trunc_note} ---\n" + "\n".join(orig_lines))
            
        if not sections:
            return ""
            
        header = f"=== CONTEXTE EXÉGÉTIQUE MULTI-NIVEAUX ({book_code} {chapter}:{start_verse}{('-' + str(end_verse)) if end_verse != start_verse else ''}) ==="
        return header + "\n\n" + "\n\n".join(sections)

    def get_chapter_verse_count(self, book_code: str, chapter: int) -> int:
        """Retourne le nombre exact de versets d'un chapitre biblique."""
        if not self.is_installed():
            return 30
        try:
            with sqlite3.connect(self.db_path) as conn:
                cur = conn.cursor()
                cur.execute("SELECT MAX(verse) FROM original_words WHERE book_code = ? AND chapter = ?;", (book_code.upper(), int(chapter)))
                r = cur.fetchone()
                if r and r[0]:
                    return int(r[0])
        except Exception as _silent_e:
            logger.debug("Erreur ignoree : %s", _silent_e)
        return 30
