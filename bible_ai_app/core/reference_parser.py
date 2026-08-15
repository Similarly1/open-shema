import re
import unicodedata

def strip_accents(text: str) -> str:
    """Supprime les accents et met en minuscules pour une comparaison insensible à la casse et aux diacritiques."""
    if not text:
        return ""
    text = unicodedata.normalize('NFKD', text)
    text = ''.join(c for c in text if not unicodedata.combining(c))
    return text.lower().strip()

# Mapping des noms et abréviations vers les codes standards
BOOK_MAPPING_RAW = {
    # Ancien Testament
    "genese": "Gen", "gen": "Gen", "ge": "Gen", "gn": "Gen", "genesis": "Gen",
    "exode": "Exo", "ex": "Exo", "exodus": "Exo", "exod": "Exo",
    "levitique": "Lev", "lv": "Lev", "lev": "Lev", "leviticus": "Lev",
    "nombres": "Num", "nb": "Num", "num": "Num", "numbers": "Num", "nm": "Num",
    "deuteronome": "Deu", "dt": "Deu", "deu": "Deu", "deuteronomy": "Deu", "deut": "Deu",
    "josue": "Jos", "jos": "Jos", "joshua": "Jos", "js": "Jos", "josh": "Jos",
    "juges": "Jdg", "jg": "Jdg", "jdg": "Jdg", "juge": "Jdg", "judges": "Jdg", "judg": "Jdg",
    "ruth": "Rut", "rt": "Rut", "rut": "Rut",
    "1 samuel": "1Sa", "1 s": "1Sa", "1sa": "1Sa", "1sam": "1Sa", "1 sam": "1Sa", "1s": "1Sa",
    "2 samuel": "2Sa", "2 s": "2Sa", "2sa": "2Sa", "2sam": "2Sa", "2 sam": "2Sa", "2s": "2Sa",
    "1 rois": "1Ki", "1 r": "1Ki", "1ki": "1Ki", "1roi": "1Ki", "1 roi": "1Ki", "1 kings": "1Ki", "1r": "1Ki", "1kgs": "1Ki", "1kg": "1Ki",
    "2 rois": "2Ki", "2 r": "2Ki", "2ki": "2Ki", "2roi": "2Ki", "2 roi": "2Ki", "2 kings": "2Ki", "2r": "2Ki", "2kgs": "2Ki", "2kg": "2Ki",
    "1 chroniques": "1Ch", "1 ch": "1Ch", "1ch": "1Ch", "1 chr": "1Ch", "1chr": "1Ch", "1 chronicles": "1Ch",
    "2 chroniques": "2Ch", "2 ch": "2Ch", "2ch": "2Ch", "2 chr": "2Ch", "2chr": "2Ch", "2 chronicles": "2Ch",
    "esdras": "Ezr", "esd": "Ezr", "ezr": "Ezr", "ezra": "Ezr",
    "nehemie": "Neh", "neh": "Neh", "nehemiah": "Neh",
    "esther": "Est", "est": "Est", "esth": "Est",
    "job": "Job", "jb": "Job",
    "psaumes": "Psa", "psaume": "Psa", "ps": "Psa", "psa": "Psa", "pss": "Psa", "psalms": "Psa", "psalm": "Psa",
    "proverbes": "Pro", "pr": "Pro", "pro": "Pro", "prov": "Pro", "proverbs": "Pro",
    "ecclesiaste": "Ecc", "ec": "Ecc", "ecc": "Ecc", "qohelet": "Ecc", "qoh": "Ecc", "ecclesiastes": "Ecc", "eccl": "Ecc",
    "cantique": "Sol", "cantique des cantiques": "Sol", "ct": "Sol", "sol": "Sol", "sng": "Sol", "cant": "Sol", "song of solomon": "Sol", "song of songs": "Sol", "song": "Sol",
    "esaie": "Isa", "es": "Isa", "is": "Isa", "isa": "Isa", "isaiah": "Isa",
    "jeremie": "Jer", "jer": "Jer", "jr": "Jer", "jeremiah": "Jer",
    "lamentations": "Lam", "lm": "Lam", "lam": "Lam",
    "ezechiel": "Eze", "eze": "Eze", "ezk": "Eze", "ezekiel": "Eze", "ez": "Eze", "ezek": "Eze",
    "daniel": "Dan", "da": "Dan", "dan": "Dan",
    "osee": "Hos", "os": "Hos", "hos": "Hos", "hosea": "Hos",
    "joel": "Joe", "joe": "Joe", "jol": "Joe", "jl": "Joe",
    "amos": "Amo", "am": "Amo", "amo": "Amo",
    "abdias": "Oba", "ab": "Oba", "oba": "Oba", "obadiah": "Oba", "obad": "Oba",
    "jonas": "Jon", "jon": "Jon", "jonah": "Jon",
    "michee": "Mic", "mi": "Mic", "mic": "Mic", "micah": "Mic",
    "nahum": "Nah", "na": "Nah", "nah": "Nah", "nam": "Nah",
    "habacuc": "Hab", "ha": "Hab", "hab": "Hab", "habakkuk": "Hab",
    "sophonie": "Zep", "so": "Zep", "zep": "Zep", "soph": "Zep", "zephaniah": "Zep", "zeph": "Zep",
    "aggee": "Hag", "ag": "Hag", "hag": "Hag", "haggai": "Hag",
    "zacharie": "Zec", "za": "Zec", "zec": "Zec", "zach": "Zec", "zechariah": "Zec", "zech": "Zec",
    "malachie": "Mal", "mal": "Mal", "malachi": "Mal", "ml": "Mal",

    # Nouveau Testament
    "matthieu": "Mat", "mt": "Mat", "mat": "Mat", "matt": "Mat", "matthew": "Mat",
    "marc": "Mar", "mc": "Mar", "mar": "Mar", "mrk": "Mar", "mk": "Mar", "mark": "Mar",
    "luc": "Luk", "lc": "Luk", "luk": "Luk", "lu": "Luk", "luke": "Luk",
    "jean": "Joh", "jn": "Joh", "j": "Joh", "john": "Joh", "joh": "Joh", "jhn": "Joh",
    "actes": "Act", "ac": "Act", "act": "Act", "actes des apotres": "Act", "acts": "Act",
    "romains": "Rom", "ro": "Rom", "rom": "Rom", "rm": "Rom", "romans": "Rom",
    "1 corinthiens": "1Co", "1 co": "1Co", "1co": "1Co", "1cor": "1Co", "1 cor": "1Co", "1 corinthians": "1Co",
    "2 corinthiens": "2Co", "2 co": "2Co", "2co": "2Co", "2cor": "2Co", "2 cor": "2Co", "2 corinthians": "2Co",
    "galates": "Gal", "ga": "Gal", "gal": "Gal", "galatians": "Gal",
    "ephesiens": "Eph", "ep": "Eph", "eph": "Eph", "ephesians": "Eph",
    "philippiens": "Phi", "phil": "Phi", "ph": "Phi", "phi": "Phi", "php": "Phi", "philippians": "Phi",
    "colossiens": "Col", "co": "Col", "col": "Col", "colossians": "Col",
    "1 thessaloniciens": "1Th", "1 th": "1Th", "1th": "1Th", "1thes": "1Th", "1 the": "1Th", "1 thessalonians": "1Th", "1thess": "1Th",
    "2 thessaloniciens": "2Th", "2 th": "2Th", "2th": "2Th", "2thes": "2Th", "2 the": "2Th", "2 thessalonians": "2Th", "2thess": "2Th",
    "1 timothee": "1Ti", "1ti": "1Ti", "1tim": "1Ti", "1 tim": "1Ti", "1 timothy": "1Ti",
    "2 timothee": "2Ti", "2ti": "2Ti", "2tim": "2Ti", "2 tim": "2Ti", "2 timothy": "2Ti",
    "tite": "Tit", "tit": "Tit", "titus": "Tit", "tt": "Tit",
    "philemon": "Phm", "phm": "Phm", "phlm": "Phm",
    "hebreux": "Heb", "he": "Heb", "heb": "Heb", "hebrews": "Heb",
    "jacques": "Jam", "jac": "Jam", "ja": "Jam", "jam": "Jam", "jas": "Jam", "jq": "Jam", "james": "Jam",
    "1 pierre": "1Pe", "1 p": "1Pe", "1pe": "1Pe", "1pi": "1Pe", "1 pi": "1Pe", "1pet": "1Pe", "1 peter": "1Pe", "1p": "1Pe",
    "2 pierre": "2Pe", "2 p": "2Pe", "2pe": "2Pe", "2pi": "2Pe", "2 pi": "2Pe", "2pet": "2Pe", "2 peter": "2Pe", "2p": "2Pe",
    "1 jean": "1Jo", "1 jn": "1Jo", "1j": "1Jo", "1 jo": "1Jo", "1jo": "1Jo", "1jn": "1Jo", "1 jhn": "1Jo", "1jhn": "1Jo", "1 john": "1Jo", "1john": "1Jo",
    "2 jean": "2Jo", "2 jn": "2Jo", "2j": "2Jo", "2 jo": "2Jo", "2jo": "2Jo", "2jn": "2Jo", "2 jhn": "2Jo", "2jhn": "2Jo", "2 john": "2Jo", "2john": "2Jo",
    "3 jean": "3Jo", "3 jn": "3Jo", "3j": "3Jo", "3 jo": "3Jo", "3jo": "3Jo", "3jn": "3Jo", "3 jhn": "3Jo", "3jhn": "3Jo", "3 john": "3Jo", "3john": "3Jo",
    "jude": "Jud", "jud": "Jud", "jd": "Jud",
    "apocalypse": "Rev", "ap": "Rev", "apo": "Rev", "rev": "Rev", "apoc": "Rev", "revelation": "Rev",

    # Deutérocanoniques et Apocryphes (TOB, NCL, etc.)
    "tobie": "Tob", "tob": "Tob", "tb": "Tob",
    "judith": "Jdt", "jdt": "Jdt", "jd": "Jdt",
    "esther grec": "Esg", "esg": "Esg",
    "1 maccabees": "1Ma", "1 maccabées": "1Ma", "1ma": "1Ma", "1 mac": "1Ma", "1mac": "1Ma",
    "2 maccabees": "2Ma", "2 maccabées": "2Ma", "2ma": "2Ma", "2 mac": "2Ma", "2mac": "2Ma",
    "3 maccabees": "3Ma", "3 maccabées": "3Ma", "3ma": "3Ma", "3 mac": "3Ma",
    "4 maccabees": "4Ma", "4 maccabées": "4Ma", "4ma": "4Ma", "4 mac": "4Ma",
    "sagesse": "Wis", "sagesse de salomon": "Wis", "wis": "Wis", "sg": "Wis", "sag": "Wis",
    "siracide": "Sir", "ecclesiastique": "Sir", "ecclésiastique": "Sir", "sir": "Sir", "si": "Sir",
    "baruch": "Bar", "bar": "Bar", "ba": "Bar",
    "lettre de jeremie": "Lje", "lettre de jérémie": "Lje", "lje": "Lje",
    "daniel grec": "Dag", "dag": "Dag",
    "3 esdras": "1Es", "1es": "1Es", "3esd": "1Es",
    "4 esdras": "2Es", "2es": "2Es", "4esd": "2Es",
    "priere de manasse": "Man", "prière de manassé": "Man", "man": "Man",
    "psaume 151": "Ps2", "ps2": "Ps2", "psa 151": "Ps2"
}

# Dictionnaire normalisé
BOOK_MAPPING = {strip_accents(k): v for k, v in BOOK_MAPPING_RAW.items()}

def get_standard_book_code(book_name_or_code: str) -> str:
    """Retourne le code standard (ex: 'Joh') pour n'importe quelle entrée."""
    key = strip_accents(book_name_or_code)
    # Remplacer les espaces multiples
    key = re.sub(r'\s+', ' ', key)
    return BOOK_MAPPING.get(key, book_name_or_code.capitalize())

def normalize_reference(user_input: str) -> str:
    """
    Transforme une saisie libre comme 'Jean 3.16', 'JHN 3:16', 'Éphésiens 2:8', 'Jn 3:16-17' ou 'Genèse 1'
    en une référence standard utilisée dans les métadonnées de la BDD (ex: 'Joh 3:16', 'Gen 1', 'Eph 2:8')
    """
    if not user_input:
        return ""
        
    user_input = user_input.strip()
    
    # Capte: (Livre) (Chapitre) [:. ] (Verset)
    # Gère aussi les chiffres devant le nom du livre comme '1 Jean' et les noms composés comme 'Cantique des cantiques'
    pattern = r'^([1-4]?\s*[^\W\d_]+(?:\s+[^\W\d_]+)*)\s*(\d+)(?:[.: ](\d+(?:-\d+)?))?$'
    match = re.match(pattern, user_input)
    
    if match:
        book_raw = match.group(1).strip()
        chapter = match.group(2).strip()
        verse = match.group(3)
        
        book_std = get_standard_book_code(book_raw)
        
        if verse:
            return f"{book_std} {chapter}:{verse.strip()}"
            
        return f"{book_std} {chapter}"
            
    # Cas où seul le nom du livre est passé
    return get_standard_book_code(user_input)

# Dictionnaire inverse pour générer le fil d'Ariane en français
REVERSE_BOOK_MAPPING = {
    "Gen": "Genèse", "Exo": "Exode", "Lev": "Lévitique", "Num": "Nombres", "Deu": "Deutéronome",
    "Jos": "Josué", "Jdg": "Juges", "Rut": "Ruth", "1Sa": "1 Samuel", "2Sa": "2 Samuel",
    "1Ki": "1 Rois", "2Ki": "2 Rois", "1Ch": "1 Chroniques", "2Ch": "2 Chroniques", "Ezr": "Esdras",
    "Neh": "Néhémie", "Est": "Esther", "Job": "Job", "Psa": "Psaumes", "Pro": "Proverbes",
    "Ecc": "Ecclésiaste", "Sol": "Cantique", "Isa": "Ésaïe", "Jer": "Jérémie", "Lam": "Lamentations",
    "Eze": "Ézéchiel", "Dan": "Daniel", "Hos": "Osée", "Joe": "Joël", "Amo": "Amos",
    "Oba": "Abdias", "Jon": "Jonas", "Mic": "Michée", "Nah": "Nahum", "Hab": "Habacuc",
    "Zep": "Sophonie", "Hag": "Aggée", "Zec": "Zacharie", "Mal": "Malachie",
    "Mat": "Matthieu", "Mar": "Marc", "Luk": "Luc", "Joh": "Jean", "Act": "Actes",
    "Rom": "Romains", "1Co": "1 Corinthiens", "2Co": "2 Corinthiens", "Gal": "Galates",
    "Eph": "Éphésiens", "Phi": "Philippiens", "Col": "Colossiens", "1Th": "1 Thessaloniciens",
    "2Th": "2 Thessaloniciens", "1Ti": "1 Timothée", "2Ti": "2 Timothée", "Tit": "Tite",
    "Phm": "Philémon", "Heb": "Hébreux", "Jam": "Jacques", "1Pe": "1 Pierre",
    "2Pe": "2 Pierre", "1Jo": "1 Jean", "2Jo": "2 Jean", "3Jo": "3 Jean", "Jud": "Jude",
    "Rev": "Apocalypse",
    # Deutérocanoniques
    "Tob": "Tobie", "Jdt": "Judith", "Esg": "Esther grec", "1Ma": "1 Maccabées", "2Ma": "2 Maccabées",
    "3Ma": "3 Maccabées", "4Ma": "4 Maccabées", "Wis": "Sagesse", "Sir": "Siracide", "Bar": "Baruch",
    "Lje": "Lettre de Jérémie", "Dag": "Daniel grec", "1Es": "3 Esdras", "2Es": "4 Esdras",
    "Man": "Prière de Manassé", "Ps2": "Psaume 151"
}

def get_french_book_name(book_code: str) -> str:
    return REVERSE_BOOK_MAPPING.get(book_code, book_code)

def resolve_book_input(query: str, all_books: list = None) -> str:
    """
    Résout une chaîne saisie par l'utilisateur (code, abréviation ou préfixe) vers le nom français officiel du livre.
    Exemples: 'gen' -> 'Genèse', '1sa' -> '1 Samuel', 'mat' -> 'Matthieu', 'rev' -> 'Apocalypse', 'ps' -> 'Psaumes'
    """
    if not query:
        return None
        
    q = strip_accents(query.strip())
    if not q:
        return None
        
    # 1. Correspondance directe dans BOOK_MAPPING (abréviations et codes connus)
    if q in BOOK_MAPPING:
        code = BOOK_MAPPING[q]
        return REVERSE_BOOK_MAPPING.get(code, code)
        
    # 2. Correspondance directe avec le code standard (insensible à la casse)
    for code, fr_name in REVERSE_BOOK_MAPPING.items():
        if strip_accents(code) == q:
            return fr_name
            
    # 3. Préfixe d'un nom de livre français (ex: 'gen' -> 'Genèse', 'apo' -> 'Apocalypse')
    candidates = all_books if all_books else list(REVERSE_BOOK_MAPPING.values())
    for b in candidates:
        if strip_accents(b).startswith(q):
            return b
            
    # 4. Contenu dans le nom français (ex: 'samuel' -> '1 Samuel')
    for b in candidates:
        if q in strip_accents(b):
            return b
            
    return None

def parse_smart_book_input(raw_text: str, all_books: list = None) -> dict:
    """
    Parse intelligemment une saisie libre dans le sélecteur de livre.
    Gère les codes ('GEN', 'MAT'), les préfixes ('gen', '1sa'), ou les références ('jn 3.16', 'ps 23', 'Genèse 2').
    Retourne un dict {'book': 'Nom Français', 'code': 'Code', 'chapter': 'ch', 'verse': 'v'}.
    """
    if not raw_text:
        return None
        
    raw = raw_text.strip()
    if not raw:
        return None
        
    # Vérifier si l'utilisateur a tapé une référence avec chapitre/verset (ex: 'Jn 3:16', 'Gen 2', 'Mat 5.3')
    norm = normalize_reference(raw)
    if " " in norm:
        parts = norm.split(" ")
        code = parts[0]
        ch_v = parts[1] if len(parts) > 1 else ""
        
        c = ch_v.split(":")[0] if ":" in ch_v else ch_v
        v = ch_v.split(":")[1] if ":" in ch_v else None
        
        fr_book = REVERSE_BOOK_MAPPING.get(code, code)
        return {
            "book": fr_book,
            "code": code,
            "chapter": c if c and c.isdigit() else None,
            "verse": v
        }
    else:
        # Code standard ou livre seul
        code = norm
        if code in REVERSE_BOOK_MAPPING:
            return {
                "book": REVERSE_BOOK_MAPPING[code],
                "code": code,
                "chapter": None,
                "verse": None
            }
            
    # Résolution par code ou préfixe
    resolved_name = resolve_book_input(raw, all_books)
    if resolved_name:
        code = BOOK_MAPPING.get(strip_accents(resolved_name), resolved_name[:3])
        return {
            "book": resolved_name,
            "code": code,
            "chapter": None,
            "verse": None
        }
        
    return None
