import logging
logger = logging.getLogger(__name__)
import os
import json
import re
import shutil

# Mapping entre les codes USFM (utilisés dans les JSON) et les codes standards internes
USFM_TO_STD = {
    "GEN": "Gen", "EXO": "Exo", "LEV": "Lev", "NUM": "Num", "DEU": "Deu",
    "JOS": "Jos", "JDG": "Jdg", "RUT": "Rut", "1SA": "1Sa", "2SA": "2Sa",
    "1KI": "1Ki", "2KI": "2Ki", "1CH": "1Ch", "2CH": "2Ch", "EZR": "Ezr",
    "NEH": "Neh", "EST": "Est", "JOB": "Job", "PSA": "Psa", "PRO": "Pro",
    "ECC": "Ecc", "SNG": "Sol", "ISA": "Isa", "JER": "Jer", "LAM": "Lam",
    "EZK": "Eze", "DAN": "Dan", "HOS": "Hos", "JOL": "Joe", "AMO": "Amo",
    "OBA": "Oba", "JON": "Jon", "MIC": "Mic", "NAM": "Nah", "HAB": "Hab",
    "ZEP": "Zep", "HAG": "Hag", "ZEC": "Zec", "MAL": "Mal",
    "MAT": "Mat", "MRK": "Mar", "LUK": "Luk", "JHN": "Joh", "ACT": "Act",
    "ROM": "Rom", "1CO": "1Co", "2CO": "2Co", "GAL": "Gal", "EPH": "Eph",
    "PHP": "Phi", "COL": "Col", "1TH": "1Th", "2TH": "2Th", "1TI": "1Ti",
    "2TI": "2Ti", "TIT": "Tit", "PHM": "Phm", "HEB": "Heb", "JAS": "Jam",
    "1PE": "1Pe", "2PE": "2Pe", "1JN": "1Jo", "2JN": "2Jo", "3JN": "3Jo",
    "JUD": "Jud", "REV": "Rev",
    # Deutérocanoniques
    "TOB": "Tob", "JDT": "Jdt", "ESG": "Esg", "1MA": "1Ma", "2MA": "2Ma",
    "3MA": "3Ma", "4MA": "4Ma", "WIS": "Wis", "SIR": "Sir", "BAR": "Bar",
    "LJE": "Lje", "DAG": "Dag", "1ES": "1Es", "2ES": "2Es", "MAN": "Man", "PS2": "Ps2"
}

STD_TO_USFM = {v: k for k, v in USFM_TO_STD.items()}

def extract_verse_text(val):
    """Extrait le texte d'un verset qu'il soit une chaîne simple ou un dictionnaire juxtalinéaire (grec/français)."""
    if isinstance(val, str):
        return val
    if isinstance(val, dict):
        fr = val.get("francais") or val.get("fr") or val.get("text") or ""
        gr = val.get("grec") or val.get("gr") or val.get("greek") or val.get("hebreu") or ""
        if fr and gr:
            return f"{fr}\n   ↳ [Grec] {gr}"
        elif fr:
            return fr
        elif gr:
            return gr
        return " ".join(str(v) for k, v in val.items() if isinstance(v, str))
    return str(val)

class BibleJsonLoader:
    """
    Gestionnaire haute-performance des Bibles au format JSON.
    Permet un accès instantané (< 1ms) aux chapitres et versets des Bibles 
    stockées dans 'data/bibles/'.
    """
    _cache = {}  # Cache en mémoire des livres chargés: {(bible_id, std_book_code): book_data}
    _metadata_cache = {} # Cache des métadonnées globales par Bible

    @classmethod
    def clear_cache(cls):
        """Vide tous les caches en mémoire."""
        cls._cache.clear()
        cls._metadata_cache.clear()

    @classmethod
    def get_bibles_dir(cls):
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        return os.path.join(base_dir, "data", "bibles")

    @classmethod
    def list_installed_bibles(cls):
        """Retourne la liste des dossiers de Bibles installées dans data/bibles/"""
        bibles_dir = cls.get_bibles_dir()
        if not os.path.exists(bibles_dir):
            return []
        bibles = []
        for entry in os.listdir(bibles_dir):
            entry_path = os.path.join(bibles_dir, entry)
            if os.path.isdir(entry_path):
                # Vérifier la présence de fichiers json
                json_files = [f for f in os.listdir(entry_path) if f.endswith(".json")]
                if json_files:
                    bibles.append(entry)
        return bibles

    @classmethod
    def find_bible_dir_by_name(cls, bible_name):
        """Trouve le dossier correspondant au nom ou identifiant de la Bible"""
        bibles_dir = cls.get_bibles_dir()
        if not os.path.exists(bibles_dir):
            return None

        if not bible_name or not isinstance(bible_name, str):
            installed = cls.list_installed_bibles()
            if installed:
                return os.path.join(bibles_dir, installed[0])
            return None
            
        # 1. Vérifier si un dossier a exactement ce nom
        direct_path = os.path.join(bibles_dir, bible_name)
        if os.path.exists(direct_path) and os.path.isdir(direct_path):
            return direct_path

        # 2. Chercher dans library.json ou library_user_full_backup.json si un chemin ou un nom correspond
        base_data = os.path.dirname(cls.get_bibles_dir())
        for lib_filename in ["library_user_full_backup.json", "library.json"]:
            library_path = os.path.join(base_data, lib_filename)
            if os.path.exists(library_path):
                try:
                    with open(library_path, "r", encoding="utf-8") as f:
                        reg = json.load(f)
                    meta = reg.get(bible_name)
                    if meta and "folder_name" in meta:
                        p = os.path.join(bibles_dir, meta["folder_name"])
                        if os.path.exists(p):
                            return p
                except Exception as _silent_e:
                    logger.debug("Erreur ignoree : %s", _silent_e)

        # 3. Scanner les dossiers pour faire correspondre le nom ou la version
        for d in os.listdir(bibles_dir):
            d_path = os.path.join(bibles_dir, d)
            if os.path.isdir(d_path):
                if d.lower() == bible_name.lower().replace(" ", "_"):
                    return d_path
                # Vérifier les métadonnées du premier fichier
                meta = cls.get_bible_metadata(d)
                if meta:
                    if meta.get("name") == bible_name or meta.get("version") == bible_name or meta.get("title") == bible_name:
                        return d_path

        return None

    @classmethod
    def get_available_books(cls, bible_name):
        """Retourne la liste ordonnée des codes standard de livres disponibles dans cette Bible."""
        target_dir = cls.find_bible_dir_by_name(bible_name)
        if not target_dir or not os.path.exists(target_dir):
            return []
        
        available = []
        all_json = sorted([f for f in os.listdir(target_dir) if f.endswith(".json")])
        for filename in all_json:
            parts = filename.replace(".json", "").split("_")
            std_code = None
            for p in parts:
                if p.upper() in USFM_TO_STD:
                    std_code = USFM_TO_STD[p.upper()]
                    break
            if not std_code:
                for usfm, std in USFM_TO_STD.items():
                    if usfm.lower() in filename.lower():
                        std_code = std
                        break
            if std_code and std_code not in available:
                available.append(std_code)
        return available

    @classmethod
    def get_bible_metadata(cls, folder_or_name):
        """Lit les métadonnées d'une Bible JSON à partir de son dossier"""
        if folder_or_name in cls._metadata_cache:
            return cls._metadata_cache[folder_or_name]

        bibles_dir = cls.get_bibles_dir()
        target_dir = os.path.join(bibles_dir, folder_or_name)
        if not os.path.exists(target_dir) or not os.path.isdir(target_dir):
            target_dir = cls.find_bible_dir_by_name(folder_or_name)
            
        if not target_dir or not os.path.exists(target_dir):
            return None

        json_files = sorted([f for f in os.listdir(target_dir) if f.endswith(".json")])
        if not json_files:
            return None

        # Lire le premier fichier pour extraire la version et le titre
        first_file = os.path.join(target_dir, json_files[0])
        try:
            with open(first_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                meta = {
                    "name": folder_or_name,
                    "version": data.get("version", folder_or_name),
                    "version_fullname": data.get("version_fullname", ""),
                    "total_books": len(json_files),
                    "title": data.get("version_fullname") or data.get("version", folder_or_name)
                }
                cls._metadata_cache[folder_or_name] = meta
                return meta
        except Exception:
            return None

    @classmethod
    def load_book(cls, bible_name, std_book_code):
        """
        Charge un livre biblique en mémoire (avec cache).
        std_book_code: abréviation standard interne (ex: 'Gen', 'Joh', '1Co')
        """
        cache_key = (bible_name, std_book_code)
        if cache_key in cls._cache:
            return cls._cache[cache_key]

        target_dir = cls.find_bible_dir_by_name(bible_name)
        if not target_dir or not os.path.exists(target_dir) or len([f for f in os.listdir(target_dir) if f.endswith('.json')]) == 0:
            # Tenter l'auto-extraction à la volée depuis SQLite si présent
            try:
                base_dir = cls.get_bibles_dir()
                clean_name = str(bible_name).lower().replace(" ", "_")
                cand_sqlite = os.path.join(base_dir, f"bible_{clean_name}.sqlite")
                cand_sqlite_alt = os.path.join(base_dir, f"bible_{clean_name}1910.sqlite")
                cand_sqlite_lsg = os.path.join(base_dir, "bible_lsg.sqlite")
                
                sqlite_path = None
                if os.path.exists(cand_sqlite):
                    sqlite_path = cand_sqlite
                elif os.path.exists(cand_sqlite_alt):
                    sqlite_path = cand_sqlite_alt
                elif clean_name in ("lsg", "louis_segond") and os.path.exists(cand_sqlite_lsg):
                    sqlite_path = cand_sqlite_lsg

                if sqlite_path:
                    import sqlite3
                    dest_json_dir = os.path.join(base_dir, bible_name)
                    os.makedirs(dest_json_dir, exist_ok=True)
                    conn = sqlite3.connect(sqlite_path)
                    cur = conn.cursor()
                    cur.execute("SELECT book, chapter, verse, text FROM verses ORDER BY id ASC")
                    all_rows = cur.fetchall()
                    conn.close()

                    verses_by_book = {}
                    for row in all_rows:
                        b_code, ch, v_num, txt = row[0], int(row[1]), int(row[2]), row[3]
                        if b_code not in verses_by_book:
                            verses_by_book[b_code] = {}
                        if str(ch) not in verses_by_book[b_code]:
                            verses_by_book[b_code][str(ch)] = {}
                        verses_by_book[b_code][str(ch)][str(v_num)] = txt

                    from core.reference_parser import get_french_book_name
                    from api._utils import FRENCH_TO_STD_BOOK

                    book_order = list(FRENCH_TO_STD_BOOK.values())
                    for idx, b_code in enumerate(book_order, start=1):
                        chaps = verses_by_book.get(b_code, {})
                        if not chaps:
                            continue
                        fr_name = get_french_book_name(b_code)
                        usfm = STD_TO_USFM.get(b_code, b_code.upper())
                        fname = f"{idx:02d}_{usfm}_{fr_name}.json"
                        out_path = os.path.join(dest_json_dir, fname)
                        data = {
                            "id": b_code,
                            "code": usfm,
                            "name": fr_name,
                            "version": bible_name,
                            "version_fullname": bible_name,
                            "total_chapters": len(chaps),
                            "chapters": chaps
                        }
                        with open(out_path, "w", encoding="utf-8") as f_out:
                            json.dump(data, f_out, ensure_ascii=False, separators=(',', ':'))

                    cls.clear_cache()
                    target_dir = cls.find_bible_dir_by_name(bible_name)
            except Exception as e:
                logger.warning(f"Erreur tentative auto-extraction à la volée pour {bible_name}: {e}")

        if not target_dir or not os.path.exists(target_dir):
            return None

        usfm_code = STD_TO_USFM.get(std_book_code, std_book_code.upper())
        from core.reference_parser import get_french_book_name
        fr_book = get_french_book_name(std_book_code)

        # Scanner les fichiers du dossier avec priorité aux fichiers structurés
        all_json = [f for f in os.listdir(target_dir) if f.endswith(".json")]
        matched_file = None

        # 1. Priorité aux fichiers avec underscore et code USFM exact (ex: "01_GEN_Genèse.json" ou "GEN_Genèse.json")
        for filename in all_json:
            parts = filename.replace(".json", "").split("_")
            for p in parts:
                if p.upper() == usfm_code.upper():
                    matched_file = os.path.join(target_dir, filename)
                    break
            if matched_file:
                break

        # 2. Recherche par nom français
        if not matched_file and fr_book:
            for filename in all_json:
                if fr_book.lower() in filename.lower():
                    matched_file = os.path.join(target_dir, filename)
                    break

        # 3. Recherche par code interne USFM partiel
        if not matched_file:
            for filename in all_json:
                if usfm_code.lower() in filename.lower():
                    matched_file = os.path.join(target_dir, filename)
                    break

        if not matched_file or not os.path.exists(matched_file):
            return None

        try:
            with open(matched_file, "r", encoding="utf-8") as f:
                data = json.load(f)

            # Auto-normalisation si le format est une liste de versets
            if "chapters" not in data and "verses" in data and isinstance(data["verses"], list):
                chapters_dict = {}
                for v in data["verses"]:
                    ch = str(v.get("chapter", "1"))
                    vn = str(v.get("verse_number", "1"))
                    txt = v.get("text", "")
                    if ch not in chapters_dict:
                        chapters_dict[ch] = {}
                    chapters_dict[ch][vn] = txt
                data["chapters"] = chapters_dict

            cls._cache[cache_key] = data
            return data
        except Exception as e:
            logger.error(f"Erreur chargement livre {matched_file} : {e}")
            return None

    @classmethod
    def get_verses(cls, bible_name, std_book_code, chapter=None, verse=None):
        """
        Récupère les versets pour un livre, chapitre (ou livre entier si chapter=None) et verset optionnel.
        Retourne un dictionnaire compatible avec le format de retour de VectorDB :
        {
            "ids": [...],
            "documents": [...],
            "metadatas": [...]
        }
        """
        book_data = cls.load_book(bible_name, std_book_code)
        if not book_data:
            return {"ids": [], "documents": [], "metadatas": []}

        chapters = book_data.get("chapters", {})
        if not chapters:
            return {"ids": [], "documents": [], "metadatas": []}

        ids = []
        documents = []
        metadatas = []

        if chapter is None or str(chapter) == "Tous":
            target_chapters = sorted(chapters.keys(), key=lambda x: int(x) if x.isdigit() else 999)
        else:
            ch_str = str(chapter)
            if ch_str not in chapters:
                return {"ids": [], "documents": [], "metadatas": []}
            target_chapters = [ch_str]

        for cur_ch in target_chapters:
            verses_dict = chapters.get(cur_ch, {})
            ch_int = int(cur_ch) if cur_ch.isdigit() else cur_ch

            # Si un verset précis est demandé sur un chapitre donné
            if chapter is not None and str(chapter) != "Tous" and verse is not None and str(verse) != "Tous":
                v_str = str(verse)
                if v_str in verses_dict:
                    v_raw = verses_dict[v_str]
                    v_text = extract_verse_text(v_raw)
                    v_int = int(v_str) if v_str.isdigit() else v_str
                    ref = f"{std_book_code} {cur_ch}:{v_str}"
                    doc_id = f"{bible_name}_{std_book_code}_{cur_ch}_{v_str}"
                    
                    meta = {
                        "book": std_book_code,
                        "chapter": ch_int,
                        "verse": v_int,
                        "name": bible_name,
                        "reference": ref,
                        "tag_type": "Bible",
                        "type": "Bible"
                    }
                    ids.append(doc_id)
                    documents.append(v_text)
                    metadatas.append(meta)
            else:
                # Récupérer tous les versets du chapitre dans l'ordre
                sorted_verse_keys = sorted(verses_dict.keys(), key=lambda x: int(x) if x.isdigit() else 999)
                for v_key in sorted_verse_keys:
                    v_raw = verses_dict[v_key]
                    v_text = extract_verse_text(v_raw)
                    v_int = int(v_key) if v_key.isdigit() else v_key
                    ref = f"{std_book_code} {cur_ch}:{v_key}"
                    doc_id = f"{bible_name}_{std_book_code}_{cur_ch}_{v_key}"
                    
                    meta = {
                        "book": std_book_code,
                        "chapter": ch_int,
                        "verse": v_int,
                        "name": bible_name,
                        "reference": ref,
                        "tag_type": "Bible",
                        "type": "Bible"
                    }
                    ids.append(doc_id)
                    documents.append(v_text)
                    metadatas.append(meta)

        return {
            "ids": ids,
            "documents": documents,
            "metadatas": metadatas
        }

    @classmethod
    def import_bible_folder(cls, source_folder, custom_name=None, custom_metadata=None):
        """
        Copie un dossier contenant les fichiers JSON de la Bible dans data/bibles/<name>/
        et met à jour data/library.json.
        """
    @classmethod
    def import_bible_folder(cls, source_folder, custom_name=None, custom_metadata=None):
        """
        Importe un dossier contenant des fichiers JSON de la Bible (format modulaire standard ou format eBible/Crosswire).
        Enregistre dans data/bibles/<name>/ et met à jour data/library.json.
        """
        if not os.path.exists(source_folder):
            raise FileNotFoundError(f"Dossier source introuvable : {source_folder}")

        json_files = sorted([f for f in os.listdir(source_folder) if f.endswith(".json")])
        if not json_files:
            raise ValueError("Aucun fichier .json trouvé dans le dossier sélectionné.")

        from core.reference_parser import get_standard_book_code, get_french_book_name
        from gui.center_panel import BOOKS_OT, BOOKS_NT
        all_books_list = BOOKS_OT + BOOKS_NT
        app_order = {code: i + 1 for i, (name, code, ch) in enumerate(all_books_list)}

        # Lire le premier fichier pour inspecter la version et le format
        first_file = os.path.join(source_folder, json_files[0])
        with open(first_file, "r", encoding="utf-8-sig") as f:
            sample_data = json.load(f)

        is_ebible = isinstance(sample_data, dict) and "general" in sample_data and "verses" in sample_data

        # Extraire les infos de version
        if is_ebible:
            about_tr = sample_data.get("general", {}).get("about_translation", {})
            raw_abbr = about_tr.get("translation_abbr", "").upper()
            if "OST" in raw_abbr or "fob" in first_file.lower():
                version_code = "OST"
                version_fullname = "Sainte Bible d'Ostervald (J.-F. Ostervald)"
                default_title = "Ostervald"
                default_author = "J.-F. Ostervald"
                default_year = "1877"
            elif "NCL" in raw_abbr or "ncl" in first_file.lower() or "crampon" in first_file.lower():
                version_code = "NCL"
                version_fullname = "Sainte Bible néo-Crampon Libre"
                default_title = "Néo-Crampon Libre"
                default_author = "Fraternité de Tibériade"
                default_year = "2022"
            else:
                version_code = raw_abbr[:4] if raw_abbr else "BIBLE"
                version_fullname = about_tr.get("translation_name_in_local_language") or about_tr.get("translation_name_in_english") or f"Bible {version_code}"
                default_title = version_fullname
                default_author = about_tr.get("ebible", {}).get("translation_by") or ""
                default_year = ""
        else:
            version_code = sample_data.get("version", "JSON_BIBLE")
            version_fullname = sample_data.get("version_fullname", "")
            if version_code.upper() == "JXLFR" or "jxlfr" in os.path.basename(source_folder).lower():
                version_code = "JXLFR"
                default_title = "Juxtalinéaire FR (Xenizo)"
                default_author = "Xenizo"
                default_year = "2026"
                version_fullname = "Nouveau Testament juxtalinéaire grec-français 2026 (Xenizo)"
            elif version_code.upper() == "S21":
                default_title = "Segond 21"
                default_author = "Société Biblique de Genève"
                default_year = "2007"
                version_fullname = "Bible Segond 21 (Société Biblique de Genève, 2007)"
            else:
                default_title = custom_name or version_code or os.path.basename(source_folder)
                default_author = ""
                default_year = ""

        bible_name = custom_name or version_code or default_title

        # Créer le sous-dossier de destination
        folder_clean = re.sub(r'[^\w\-_\. ]', '_', bible_name).strip().replace(" ", "_")
        dest_dir = os.path.join(cls.get_bibles_dir(), folder_clean)
        os.makedirs(dest_dir, exist_ok=True)

        copied_count = 0
        extra_idx = 67

        if is_ebible:
            # Traiter et convertir chaque fichier eBible
            for f in json_files:
                src_file = os.path.join(source_folder, f)
                try:
                    with open(src_file, "r", encoding="utf-8-sig") as fp:
                        book_raw = json.load(fp)
                except Exception as e:
                    logger.info(f"Fichier {f} ignoré (non lisible ou non-JSON : {e})")
                    continue

                b_code_raw = book_raw.get("general", {}).get("about_book", {}).get("book_code", "")
                if not b_code_raw:
                    parts = f.replace(".json", "").split("-")
                    b_code_raw = parts[1][:3] if len(parts) > 1 else f[:3]

                std_code = USFM_TO_STD.get(b_code_raw.upper(), get_standard_book_code(b_code_raw))
                fr_name = get_french_book_name(std_code)
                if std_code in app_order:
                    order_idx = app_order[std_code]
                else:
                    order_idx = extra_idx
                    extra_idx += 1
                usfm_code = STD_TO_USFM.get(std_code, b_code_raw.upper())

                # Extraire et nettoyer les versets
                chapters_data = {}
                for v_item in book_raw.get("verses", []):
                    ch = str(v_item.get("chapter", "1"))
                    v_num = str(v_item.get("verse_number", "1"))
                    raw_txt = v_item.get("text", "")
                    # Supprimer les balises <dictionary_word>
                    clean_txt = re.sub(r'</?dictionary_word>', '', raw_txt).strip()
                    clean_txt = re.sub(r'\s+', ' ', clean_txt)
                    if ch not in chapters_data:
                        chapters_data[ch] = {}
                    chapters_data[ch][v_num] = clean_txt

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
                copied_count += 1
        else:
            # Copier tous les fichiers json modulaires
            for f in json_files:
                src_file = os.path.join(source_folder, f)
                dst_file = os.path.join(dest_dir, f)
                shutil.copy2(src_file, dst_file)
                copied_count += 1

        # Mettre à jour library.json
        from gui.library_utils import load_books_metadata, save_books_metadata
        registry = load_books_metadata()

        meta = custom_metadata or {}
        bible_entry = {
            "title": meta.get("title") or default_title,
            "author": meta.get("author") or default_author,
            "description": meta.get("description") or version_fullname or f"Bible {bible_name}",
            "year": meta.get("year") or default_year,
            "cover_path": meta.get("cover_path", None),
            "type": "Bible",
            "format": "json",
            "folder_name": folder_clean,
            "version_code": version_code,
            "total_books": copied_count,
            "embedding_model": "study_library",
            "active": True
        }

        registry[bible_name] = bible_entry
        save_books_metadata(registry)

        # Vider le cache
        cls._cache.clear()
        cls._metadata_cache.clear()

        return bible_name, bible_entry

    @classmethod
    def import_single_bible_json(cls, source_file, custom_name=None, custom_metadata=None):
        """
        Importe un fichier JSON unique contenant plusieurs livres ou l'intégralité de la Bible.
        Gère les dictionnaires de livres (ex: {'Matthieu': {'1': {'1': '...'}}}),
        les listes d'objets livres (ex: [{'name': 'Genesis', 'chapters': [['v1', 'v2']]}]),
        extrait et crée les fichiers modulaires dans data/bibles/<name>/,
        et enregistre les métadonnées dans data/library.json.
        """
        if not os.path.exists(source_file):
            raise FileNotFoundError(f"Fichier source introuvable : {source_file}")

        with open(source_file, "r", encoding="utf-8-sig") as f:
            data = json.load(f)

        from core.reference_parser import get_standard_book_code, get_french_book_name
        from gui.center_panel import BOOKS_OT, BOOKS_NT

        all_books_list = BOOKS_OT + BOOKS_NT
        app_order = {code: i + 1 for i, (name, code, ch) in enumerate(all_books_list)}

        # Structure détectée
        books_to_process = {}
        if isinstance(data, dict):
            if "books" in data and isinstance(data["books"], dict):
                books_to_process = data["books"]
            else:
                sample_key = list(data.keys())[0] if data else ""
                sample_val = data[sample_key] if sample_key else None
                if isinstance(sample_val, dict):
                    books_to_process = data
                else:
                    raise ValueError("Format de fichier JSON non reconnu.")
        elif isinstance(data, list):
            for item in data:
                if isinstance(item, dict) and "name" in item and "chapters" in item:
                    raw_chs = item["chapters"]
                    # Si chapters est une liste de listes de versets
                    if isinstance(raw_chs, list):
                        ch_dict = {}
                        for ch_idx, ch_verses in enumerate(raw_chs):
                            ch_num = str(ch_idx + 1)
                            ch_dict[ch_num] = {}
                            if isinstance(ch_verses, list):
                                for v_idx, v_txt in enumerate(ch_verses):
                                    ch_dict[ch_num][str(v_idx + 1)] = v_txt
                            elif isinstance(ch_verses, dict):
                                ch_dict[ch_num] = ch_verses
                        books_to_process[item["name"]] = ch_dict
                    elif isinstance(raw_chs, dict):
                        books_to_process[item["name"]] = raw_chs

        if not books_to_process:
            raise ValueError("Aucun livre biblique n'a pu être extrait du fichier JSON.")

        # Déterminer les métadonnées de version par défaut
        filename_base = os.path.splitext(os.path.basename(source_file))[0]
        detected_name = custom_name
        if not detected_name:
            if "apee" in filename_base.lower():
                detected_name = "APEE"
            elif "tob" in filename_base.lower():
                detected_name = "TOB"
            elif "sagesse_vivante" in filename_base.lower() or "sagesse vivante" in filename_base.lower():
                detected_name = "SV"
            elif "parole_vivante" in filename_base.lower() or "parole vivante" in filename_base.lower():
                detected_name = "PV"
            else:
                detected_name = filename_base.replace("_", " ").title()

        if "apee" in detected_name.lower():
            version_code = "APEE"
            version_fullname = "Bible de l'Épée (APEE 2010)"
            default_title = "Bible de l'Épée"
            default_author = "APEE"
            default_year = "2010"
        elif "tob" in detected_name.lower():
            version_code = "TOB"
            version_fullname = "Traduction Œcuménique de la Bible (TOB 2010)"
            default_title = "TOB 2010"
            default_author = "Société Biblique Française / Cerf"
            default_year = "2010"
        elif "sagesse" in detected_name.lower() or detected_name.upper() == "SV":
            version_code = "SV"
            version_fullname = "Bible Sagesse Vivante - Livres poétiques et de sagesse (Alfred Kuen)"
            default_title = "Sagesse Vivante"
            default_author = "Alfred Kuen"
            default_year = "1988"
        elif "parole" in detected_name.lower() or detected_name.upper() == "PV":
            version_code = "PV"
            version_fullname = "Bible Parole Vivante - Transcription dynamique (Alfred Kuen)"
            default_title = "Parole Vivante"
            default_author = "Alfred Kuen"
            default_year = "1976"
        else:
            version_code = detected_name[:4].upper()
            version_fullname = f"Bible {detected_name}"
            default_title = detected_name
            default_author = ""
            default_year = ""

        # Créer le dossier de destination
        folder_clean = re.sub(r'[^\w\-_\. ]', '_', detected_name).strip().replace(" ", "_")
        dest_dir = os.path.join(cls.get_bibles_dir(), folder_clean)
        os.makedirs(dest_dir, exist_ok=True)

        saved_books_count = 0
        extra_idx = 67
        for raw_book_name, chapters_data in books_to_process.items():
            std_code = get_standard_book_code(raw_book_name)
            fr_name = get_french_book_name(std_code)
            if std_code in app_order:
                order_idx = app_order[std_code]
            else:
                order_idx = extra_idx
                extra_idx += 1
            usfm_code = STD_TO_USFM.get(std_code, std_code.upper())

            # Formater l'objet du livre
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

        # Mettre à jour library.json
        from gui.library_utils import load_books_metadata, save_books_metadata
        registry = load_books_metadata()

        meta = custom_metadata or {}
        bible_entry = {
            "title": meta.get("title") or default_title,
            "author": meta.get("author") or default_author,
            "description": meta.get("description") or version_fullname,
            "year": meta.get("year") or default_year,
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

        return detected_name, bible_entry

    @classmethod
    def import_bible_csv(cls, source_file, custom_name=None, custom_metadata=None):
        """
        Importe une Bible complète depuis un fichier CSV ou TSV (avec ou sans balises Strong).
        Supporte les délimiteurs tabulation, virgule, point-virgule et barre verticale.
        """
        import csv
        from core.reference_parser import get_standard_book_code, get_french_book_name
        from gui.center_panel import BOOKS_OT, BOOKS_NT
        
        all_books_list = BOOKS_OT + BOOKS_NT
        app_order = {code: i + 1 for i, (name, code, ch) in enumerate(all_books_list)}
        
        # Détection automatique du délimiteur
        delimiter = "\t"
        with open(source_file, "r", encoding="utf-8-sig", errors="ignore") as f:
            first_line = f.readline()
            if "\t" in first_line:
                delimiter = "\t"
            elif ";" in first_line:
                delimiter = ";"
            elif "," in first_line:
                delimiter = ","
            elif "|" in first_line:
                delimiter = "|"

        books_map = {}
        with open(source_file, "r", encoding="utf-8-sig", errors="ignore") as f:
            reader = csv.reader(f, delimiter=delimiter)
            first_row = True
            for row in reader:
                if not row or len(row) < 4:
                    continue
                # Ignorer l'éventuelle ligne d'en-tête
                if first_row and any(h.lower() in ("book", "livre", "chapter", "chapitre", "verse", "verset", "text", "texte") for h in row[:4]):
                    first_row = False
                    continue
                first_row = False
                
                raw_b, ch_str, v_str, text_val = row[0].strip(), row[1].strip(), row[2].strip(), row[3].strip()
                ch_clean = re.sub(r'\D', '', ch_str) or ch_str
                v_clean = re.sub(r'\D', '', v_str) or v_str
                if not ch_clean or not v_clean:
                    continue
                    
                std_b = get_standard_book_code(raw_b)
                if std_b not in books_map:
                    books_map[std_b] = {}
                if ch_clean not in books_map[std_b]:
                    books_map[std_b][ch_clean] = {}
                books_map[std_b][ch_clean][v_clean] = text_val

        if not books_map:
            raise ValueError("Aucun verset n'a pu être extrait du fichier CSV.")

        filename_base = os.path.splitext(os.path.basename(source_file))[0]
        detected_name = custom_name or filename_base.replace("_", " ").replace("-", " ").title()
        version_code = detected_name[:4].upper().strip()
        version_fullname = (custom_metadata.get("title") if custom_metadata else None) or f"Bible {detected_name}"

        folder_clean = re.sub(r'[^\w\-_\. ]', '_', detected_name).strip().replace(" ", "_")
        dest_dir = os.path.join(cls.get_bibles_dir(), folder_clean)
        os.makedirs(dest_dir, exist_ok=True)

        saved_books_count = 0
        extra_idx = 67
        for std_b, chaps in books_map.items():
            fr_name = get_french_book_name(std_b)
            if std_b in app_order:
                order_idx = app_order[std_b]
            else:
                order_idx = extra_idx
                extra_idx += 1
            usfm_code = STD_TO_USFM.get(std_b, std_b.upper())

            book_obj = {
                "id": order_idx,
                "code": usfm_code,
                "name": fr_name,
                "version": version_code,
                "version_fullname": version_fullname,
                "total_chapters": len(chaps),
                "chapters": chaps
            }

            dest_filename = f"{order_idx:02d}_{usfm_code}_{fr_name}.json"
            dest_filepath = os.path.join(dest_dir, dest_filename)
            with open(dest_filepath, "w", encoding="utf-8") as fp:
                json.dump(book_obj, fp, ensure_ascii=False, indent=2)
            saved_books_count += 1

        # Mettre à jour library.json
        from gui.library_utils import load_books_metadata, save_books_metadata
        registry = load_books_metadata()

        meta = custom_metadata or {}
        bible_entry = {
            "title": meta.get("title") or detected_name,
            "author": meta.get("author") or "",
            "description": meta.get("description") or f"Bible {detected_name} (Import CSV)",
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

        return detected_name, bible_entry
