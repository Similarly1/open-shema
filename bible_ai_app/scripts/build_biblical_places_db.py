"""
Script de construction de la base de données cartographique biblique (biblical_places.db)
Télécharge et parse les données d'OpenBible.info (ancient.jsonl & modern.jsonl)
Indexe les lieux, coordonnées, types, niveaux de certitude, et versets associés.
Injecte les itinéraires bibliques majeurs.
"""

import os
import sys
import json
import sqlite3
import urllib.request
import re

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
APP_DIR = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
DATA_DIR = os.path.join(APP_DIR, "data")
DB_PATH = os.path.join(DATA_DIR, "biblical_places.db")

# Dictionnaire de traduction et normalisation des noms de lieux en Français
FRENCH_NAME_OVERRIDES = {
    "Jerusalem": "Jérusalem",
    "Bethlehem": "Bethléem",
    "Nazareth": "Nazareth",
    "Capernaum": "Capharnaüm",
    "Rome": "Rome",
    "Athens": "Athènes",
    "Corinth": "Corinthe",
    "Ephesus": "Éphèse",
    "Antioch": "Antioche",
    "Antioch of Pisidia": "Antioche de Pisidie",
    "Damascus": "Damas",
    "Alexandria": "Alexandrie",
    "Babylon": "Babylone",
    "Nineveh": "Ninive",
    "Samaria": "Samarie",
    "Hebron": "Hébron",
    "Shechem": "Sichem",
    "Bethel": "Béthel",
    "Jericho": "Jéricho",
    "Joppa": "Joppé (Jaffa)",
    "Caesarea": "Césarée maritime",
    "Caesarea Philippi": "Césarée de Philippe",
    "Bethany": "Béthanie",
    "Bethsaida": "Bethsaïda",
    "Cana": "Cana",
    "Nain": "Naïn",
    "Tiberias": "Tibériade",
    "Sea of Galilee": "Mer de Galilée (Lac de Tibériade)",
    "Dead Sea": "Mer Morte",
    "Jordan River": "Jourdain",
    "Mount Sinai": "Mont Sinaï",
    "Mount Nebo": "Mont Nébo",
    "Mount Carmel": "Mont Carmel",
    "Mount Hermon": "Mont Hermon",
    "Mount of Olives": "Mont des Oliviers",
    "Mount Zion": "Mont Sion",
    "Mount Gerizim": "Mont Garizim",
    "Mount Ebal": "Mont Ébal",
    "Mount Ararat": "Mont Ararat",
    "Philippi": "Philippes",
    "Thessalonica": "Thessalonique",
    "Berea": "Bérée",
    "Troas": "Troas",
    "Miletus": "Milet",
    "Smyrna": "Smyrne",
    "Pergamum": "Pergame",
    "Thyatira": "Thyatire",
    "Sardis": "Sardes",
    "Philadelphia": "Philadelphie",
    "Laodicea": "Laodicée",
    "Colossae": "Colosses",
    "Iconium": "Iconium (Konya)",
    "Lystra": "Lystre",
    "Derbe": "Derbe",
    "Tarsus": "Tarse",
    "Tyre": "Tyr",
    "Sidon": "Sidon",
    "Salamis": "Salamine",
    "Paphos": "Paphos",
    "Perga": "Pergé",
    "Attalia": "Attalie",
    "Cnidus": "Cnide",
    "Crete": "Crète",
    "Cyprus": "Chypre",
    "Malta": "Malte",
    "Syracuse": "Syracuse",
    "Rhegium": "Rhégium",
    "Puteoli": "Pouzzoles",
    "Fair Havens": "Bons Ports (Crète)",
    "Bithynia": "Bithynie",
    "Galatia": "Galatie",
    "Cappadocia": "Cappadoce",
    "Pontus": "Pont",
    "Asia": "Asie (province romaine)",
    "Macedonia": "Macédoine",
    "Achaia": "Achaïe (Grèce)",
    "Cilicia": "Cilicie",
    "Syria": "Syrie",
    "Judea": "Judée",
    "Galilee": "Galilée",
    "Decapolis": "Décapole",
    "Perea": "Pérée",
    "Idumea": "Idumée",
    "Moab": "Moab",
    "Edom": "Édom",
    "Ammon": "Ammon",
    "Gilead": "Galaad",
    "Bashan": "Basan",
    "Sinai": "Désert du Sinaï",
    "Ur of the Chaldees": "Our en Chaldée",
    "Haran": "Haran",
    "Sodom": "Sodome",
    "Gomorrah": "Gomorrhe",
    "Beersheba": "Beer-Schéba",
    "Dan": "Dan",
    "Shiloh": "Silo",
    "Gibeon": "Gabaon",
    "Ramah": "Rama",
    "Anathoth": "Anathoth",
    "Emmaus": "Emmaüs",
    "Gethsemane": "Gethsémané",
    "Golgotha": "Golgotha (Calvaire)",
    "Pool of Siloam": "Piscine de Siloé",
    "Pool of Bethesda": "Piscine de Béthesda",
    "Kidron Valley": "Vallée du Cédron",
    "Hinnom Valley": "Vallée de Hinnom (Géhenne)",
    "Red Sea": "Mer Rouge",
    "Nile River": "Le Nil",
    "Euphrates River": "L'Euphrate",
    "Tigris River": "Le Tigre"
}

# Normalisation OSIS Book Code -> Open Shema Book Code
OSIS_TO_SHEMA = {
    "Gen": "GEN", "Exod": "EXO", "Lev": "LEV", "Num": "NUM", "Deut": "DEU",
    "Josh": "JOS", "Judg": "JDG", "Ruth": "RUT", "1Sam": "1SA", "2Sam": "2SA",
    "1Kgs": "1KI", "2Kgs": "2KI", "1Chr": "1CH", "2Chr": "2CH", "Ezra": "EZR",
    "Neh": "NEH", "Esth": "EST", "Job": "JOB", "Ps": "PSA", "Prov": "PRO",
    "Eccl": "ECC", "Song": "SOL", "Isa": "ISA", "Jer": "JER", "Lam": "LAM",
    "Ezek": "EZE", "Dan": "DAN", "Hos": "HOS", "Joel": "JOE", "Amos": "AMO",
    "Obad": "OBA", "Jonah": "JON", "Mic": "MIC", "Nah": "NAH", "Hab": "HAB",
    "Zeph": "ZEP", "Hag": "HAG", "Zech": "ZEC", "Mal": "MAL",
    "Matt": "MAT", "Mark": "MAR", "Luke": "LUK", "John": "JOH", "Acts": "ACT",
    "Rom": "ROM", "1Cor": "1CO", "2Cor": "2CO", "Gal": "GAL", "Eph": "EPH",
    "Phil": "PHI", "Col": "COL", "1Thess": "1TH", "2Thess": "2TH", "1Tim": "1TI",
    "2Tim": "2TI", "Titus": "TIT", "Phlm": "PHM", "Heb": "HEB", "Jas": "JAM",
    "1Pet": "1PE", "2Pet": "2PE", "1John": "1JO", "2John": "2JO", "3John": "3JO",
    "Jude": "JUD", "Rev": "REV",
    "Tob": "TOB", "Jdt": "JDT", "Wis": "WIS", "Sir": "SIR", "Bar": "BAR",
    "1Macc": "1MA", "2Macc": "2MA"
}

def parse_osis_ref(osis_str: str):
    """
    Parse '2Kgs.5.12' ou 'Gen.12.8' -> (book_shema, chapter, verse)
    """
    if not osis_str:
        return None
    parts = osis_str.split('.')
    if len(parts) >= 2:
        raw_b = parts[0]
        shema_b = OSIS_TO_SHEMA.get(raw_b, raw_b.upper()[:3])
        try:
            chap = int(parts[1])
        except ValueError:
            chap = 1
        verse = 1
        if len(parts) >= 3:
            try:
                verse = int(parts[2])
            except ValueError:
                verse = 1
        return (shema_b, chap, verse)
    return None

def fetch_jsonl_from_github(url: str):
    print(f"Téléchargement de {url}...")
    req = urllib.request.Request(url, headers={"User-Agent": "OpenShema/1.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        content = resp.read().decode('utf-8')
        lines = content.splitlines()
        print(f"-> {len(lines)} lignes reçues.")
        return [json.loads(line) for line in lines if line.strip()]

def init_db(conn):
    cur = conn.cursor()
    cur.execute("""
    CREATE TABLE IF NOT EXISTS places (
        place_id TEXT PRIMARY KEY,
        name_en TEXT NOT NULL,
        name_fr TEXT NOT NULL,
        ancient_name TEXT,
        modern_name TEXT,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        place_type TEXT,
        confidence TEXT,
        comment TEXT,
        verses_count INTEGER DEFAULT 0,
        verses_json TEXT,
        thumbnail_url TEXT
    );
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS place_verses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        place_id TEXT NOT NULL,
        book TEXT NOT NULL,
        chapter INTEGER NOT NULL,
        verse INTEGER NOT NULL,
        osis TEXT,
        FOREIGN KEY(place_id) REFERENCES places(place_id)
    );
    """)

    cur.execute("CREATE INDEX IF NOT EXISTS idx_place_verses_bc ON place_verses (book, chapter);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_place_verses_p ON place_verses (place_id);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_places_name_fr ON places (name_fr);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_places_type ON places (place_type);")

    cur.execute("""
    CREATE TABLE IF NOT EXISTS itineraries (
        itinerary_id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT,
        color TEXT DEFAULT '#2563EB',
        waypoints_json TEXT NOT NULL
    );
    """)
    conn.commit()

def populate_itineraries(conn):
    """Insère les grands itinéraires bibliques historiques."""
    itineraries = [
        {
            "itinerary_id": "paul_journey_1",
            "title": "1er Voyage missionnaire de Paul (46-48 apr. J.-C.)",
            "category": "Apôtre Paul",
            "description": "Voyage de Paul et Barnabas à travers Chypre et l'Asie Mineure (Actes 13 - 14).",
            "color": "#3B82F6",
            "waypoints": [
                {"name": "Antioche de Syrie", "lat": 36.2021, "lon": 36.1606, "desc": "Point de départ de la mission avec Barnabas (Actes 13:1-3)"},
                {"name": "Séleucie", "lat": 36.1197, "lon": 35.9286, "desc": "Port d'embarquement (Actes 13:4)"},
                {"name": "Salamine (Chypre)", "lat": 35.1856, "lon": 33.9033, "desc": "Prédication dans les synagogues (Actes 13:5)"},
                {"name": "Paphos (Chypre)", "lat": 34.7571, "lon": 32.4116, "desc": "Rencontre avec le proconsul Sergius Paulus et Élymas (Actes 13:6-12)"},
                {"name": "Pergé (Pamphylie)", "lat": 36.9606, "lon": 30.8522, "desc": "Départ de Jean Marc (Actes 13:13)"},
                {"name": "Antioche de Pisidie", "lat": 38.3072, "lon": 31.1894, "desc": "Grand discours de Paul dans la synagogue (Actes 13:14-52)"},
                {"name": "Iconium", "lat": 37.8714, "lon": 32.4847, "desc": "Grande foule de convertis puis persécution (Actes 14:1-6)"},
                {"name": "Lystre", "lat": 37.5683, "lon": 32.1931, "desc": "Guérison d'un impotent, lapidation de Paul (Actes 14:8-20)"},
                {"name": "Derbe", "lat": 37.3517, "lon": 33.1558, "desc": "Évangélisation et nombreux disciples (Actes 14:20-21)"},
                {"name": "Attalie", "lat": 36.8841, "lon": 30.7056, "desc": "Port de retour en Syrie (Actes 14:25)"},
                {"name": "Antioche de Syrie", "lat": 36.2021, "lon": 36.1606, "desc": "Rapport à l'Église (Actes 14:26-28)"}
            ]
        },
        {
            "itinerary_id": "paul_journey_2",
            "title": "2e Voyage missionnaire de Paul (49-52 apr. J.-C.)",
            "category": "Apôtre Paul",
            "description": "Entrée de l'Évangile en Europe : Philippes, Thessalonique, Athènes et Corinthe (Actes 15:36 - 18:22).",
            "color": "#10B981",
            "waypoints": [
                {"name": "Antioche de Syrie", "lat": 36.2021, "lon": 36.1606, "desc": "Départ avec Silas (Actes 15:40)"},
                {"name": "Tarse", "lat": 36.9177, "lon": 34.8949, "desc": "Traversée de la Cilicie"},
                {"name": "Derbe & Lystre", "lat": 37.5683, "lon": 32.1931, "desc": "Rencontre et engagement de Timothée (Actes 16:1-3)"},
                {"name": "Troas", "lat": 39.7547, "lon": 26.1644, "desc": "Vision de l'homme macédonien (Actes 16:8-10)"},
                {"name": "Néapolis", "lat": 40.9372, "lon": 24.4128, "desc": "Arrivée en Europe / Grèce (Actes 16:11)"},
                {"name": "Philippes", "lat": 41.0131, "lon": 24.2867, "desc": "Conversion de Lydie, geôlier sauvé (Actes 16:12-40)"},
                {"name": "Thessalonique", "lat": 40.6401, "lon": 22.9444, "desc": "Prédication et émeute (Actes 17:1-9)"},
                {"name": "Bérée", "lat": 40.5236, "lon": 22.2039, "desc": "Examen quotidien des Écritures (Actes 17:10-14)"},
                {"name": "Athènes", "lat": 37.9838, "lon": 23.7275, "desc": "Discours à l'Aréopage sur le Dieu Inconnu (Actes 17:16-34)"},
                {"name": "Corinthe", "lat": 37.9392, "lon": 22.9328, "desc": "Séjour de 18 mois avec Aquilas et Priscille (Actes 18:1-18)"},
                {"name": "Cenchres", "lat": 37.8869, "lon": 22.9933, "desc": "Port de Corinthe, vœu de Paul (Actes 18:18)"},
                {"name": "Éphèse", "lat": 37.9497, "lon": 27.3639, "desc": "Courte escale dans la synagogue (Actes 18:19-21)"},
                {"name": "Césarée", "lat": 32.5022, "lon": 34.8922, "desc": "Arrivée en Judée (Actes 18:22)"},
                {"name": "Jérusalem", "lat": 31.7683, "lon": 35.2137, "desc": "Salutations à l'Église (Actes 18:22)"},
                {"name": "Antioche de Syrie", "lat": 36.2021, "lon": 36.1606, "desc": "Fin du second voyage"}
            ]
        },
        {
            "itinerary_id": "paul_journey_3",
            "title": "3e Voyage missionnaire de Paul (53-57 apr. J.-C.)",
            "category": "Apôtre Paul",
            "description": "Long séjour à Éphèse, renforcement des Églises de Grèce et adieux à Milet (Actes 18:23 - 21:17).",
            "color": "#F59E0B",
            "waypoints": [
                {"name": "Antioche de Syrie", "lat": 36.2021, "lon": 36.1606, "desc": "Départ pour affermir les disciples (Actes 18:23)"},
                {"name": "Galatie et Phrygie", "lat": 39.0, "lon": 32.5, "desc": "Visite pastorale des communautés"},
                {"name": "Éphèse", "lat": 37.9497, "lon": 27.3639, "desc": "Ministère de près de 3 ans, école de Tyrannus, émeute des orfèvres (Actes 19)"},
                {"name": "Macédoine & Grèce", "lat": 40.5, "lon": 22.5, "desc": "Visite des Églises (Actes 20:1-3)"},
                {"name": "Troas", "lat": 39.7547, "lon": 26.1644, "desc": "Résurrection d'Eutychus (Actes 20:7-12)"},
                {"name": "Milet", "lat": 37.5303, "lon": 27.2783, "desc": "Adieux émouvants aux anciens d'Éphèse (Actes 20:17-38)"},
                {"name": "Tyr", "lat": 33.2709, "lon": 35.2038, "desc": "Prière sur le rivage avec les disciples (Actes 21:3-6)"},
                {"name": "Ptolémaïs", "lat": 32.9278, "lon": 35.0817, "desc": "Salutation aux frères (Actes 21:7)"},
                {"name": "Césarée", "lat": 32.5022, "lon": 34.8922, "desc": "Chez Philippe l'évangéliste, prophétie d'Agabus (Actes 21:8-14)"},
                {"name": "Jérusalem", "lat": 31.7683, "lon": 35.2137, "desc": "Arrivée et arrestation au Temple (Actes 21:15-36)"}
            ]
        },
        {
            "itinerary_id": "paul_journey_rome",
            "title": "Voyage de Paul captif vers Rome (59-60 apr. J.-C.)",
            "category": "Apôtre Paul",
            "description": "Transfert sous escorte militaire, tempête en Méditerranée, naufrage à Malte et arrivée à Rome (Actes 27 - 28).",
            "color": "#EC4899",
            "waypoints": [
                {"name": "Césarée maritime", "lat": 32.5022, "lon": 34.8922, "desc": "Embarquement comme prisonnier sous la garde du centurion Julius (Actes 27:1)"},
                {"name": "Sidon", "lat": 33.5630, "lon": 35.3689, "desc": "Escale où Paul reçoit la visite de ses amis (Actes 27:3)"},
                {"name": "Myre (Lycie)", "lat": 36.2575, "lon": 29.9844, "desc": "Changement de bateau pour un navire d'Alexandrie (Actes 27:5-6)"},
                {"name": "Cnide", "lat": 36.6853, "lon": 27.3756, "desc": "Navigation difficile contre le vent (Actes 27:7)"},
                {"name": "Bons Ports (Crète)", "lat": 34.9333, "lon": 24.8000, "desc": "Avertissement de Paul contre la reprise de la navigation (Actes 27:8-10)"},
                {"name": "Malte", "lat": 35.9375, "lon": 14.3754, "desc": "Naufrage sans perte de vie, morsure de vipère surmontée (Actes 28:1-10)"},
                {"name": "Syracuse (Sicile)", "lat": 37.0755, "lon": 15.2866, "desc": "Escale de 3 jours (Actes 28:12)"},
                {"name": "Rhégium", "lat": 38.1113, "lon": 15.6473, "desc": "Détroit de Messine (Actes 28:13)"},
                {"name": "Pouzzoles", "lat": 40.8267, "lon": 14.1206, "desc": "Accueil par les frères chrétiens (Actes 28:13-14)"},
                {"name": "Forum d'Appius & Trois-Tavernes", "lat": 41.5200, "lon": 12.9800, "desc": "Rencontre avec les chrétiens de Rome venus à sa rencontre (Actes 28:15)"},
                {"name": "Rome", "lat": 41.9028, "lon": 12.4964, "desc": "Captivité sous garde libre, annonce du Royaume sans obstacle (Actes 28:16-31)"}
            ]
        },
        {
            "itinerary_id": "exodus_sinai",
            "title": "L'Exode et l'Itinéraire du Désert",
            "category": "Ancien Testament",
            "description": "De la sortie d'Égypte à l'entrée en Terre Promise (Exode, Nombres, Deutéronome).",
            "color": "#D97706",
            "waypoints": [
                {"name": "Ramsès (Égypte)", "lat": 30.7936, "lon": 31.8286, "desc": "Départ des Hébreux après la Pâque (Exode 12:37)"},
                {"name": "Soukkot", "lat": 30.6000, "lon": 32.0500, "desc": "Première étape de l'Exode (Exode 13:20)"},
                {"name": "Étham", "lat": 30.4500, "lon": 32.3000, "desc": "À l'orée du désert, colonne de nuée et de feu (Exode 13:20-22)"},
                {"name": "Traversée de la Mer Rouge", "lat": 29.8000, "lon": 32.6000, "desc": "Passage miraculeux à pied sec et cantique de Moïse (Exode 14 - 15)"},
                {"name": "Mara", "lat": 29.5600, "lon": 32.8800, "desc": "Eaux amères rendues douces (Exode 15:23-25)"},
                {"name": "Élim", "lat": 29.3000, "lon": 33.0000, "desc": "12 sources d'eau et 70 palmiers (Exode 15:27)"},
                {"name": "Désert de Sin", "lat": 28.9000, "lon": 33.3000, "desc": "Don de la manne et des cailles (Exode 16)"},
                {"name": "Rephidim", "lat": 28.6500, "lon": 33.6500, "desc": "L'eau du rocher frappé, victoire contre Amalek (Exode 17)"},
                {"name": "Mont Sinaï (Horeb)", "lat": 28.5397, "lon": 33.9750, "desc": "Alliance, don des Dix Commandements et construction du Tabernacle (Exode 19 - 40)"},
                {"name": "Qadesh-Barnéa", "lat": 30.6400, "lon": 34.4200, "desc": "Envoi des 12 explorateurs en Canaan et 40 ans d'errance (Nombres 13 - 14)"},
                {"name": "Mont Hor", "lat": 30.3167, "lon": 35.4000, "desc": "Mort et sépulture d'Aaron (Nombres 20:22-29)"},
                {"name": "Plaines de Moab", "lat": 31.8500, "lon": 35.6000, "desc": "Campement final face à Jéricho (Nombres 22:1)"},
                {"name": "Mont Nébo", "lat": 31.7683, "lon": 35.7258, "desc": "Moïse contemple la Terre Promise avant sa mort (Deutéronome 34)"}
            ]
        },
        {
            "itinerary_id": "abraham_journey",
            "title": "Le Voyage et la Vocation d'Abraham",
            "category": "Ancien Testament",
            "description": "De la Mésopotamie au pays de Canaan (Genèse 11:31 - 25:10).",
            "color": "#8B5CF6",
            "waypoints": [
                {"name": "Our en Chaldée", "lat": 30.9628, "lon": 46.1031, "desc": "Terre natale d'Abram (Genèse 11:28-31)"},
                {"name": "Haran (Mésopotamie)", "lat": 36.8639, "lon": 39.0292, "desc": "Appel de Dieu : 'Quitte ton pays et ta famille' (Genèse 12:1-4)"},
                {"name": "Sichem (Chêne de Moré)", "lat": 32.2136, "lon": 35.2831, "desc": "Premier autel érigé en Canaan (Genèse 12:6-7)"},
                {"name": "Béthel & Aï", "lat": 31.9294, "lon": 35.2236, "desc": "Deuxième autel et invocation de l'Éternel (Genèse 12:8)"},
                {"name": "Égypte (Séjour)", "lat": 30.0444, "lon": 31.2357, "desc": "Famine en Canaan, séjour en Égypte (Genèse 12:10-20)"},
                {"name": "Hébron (Chênes de Mamré)", "lat": 31.5294, "lon": 35.0938, "desc": "Résidence principale, visite des trois anges, grotte de Makpéla (Genèse 13:18; 18; 23)"}
            ]
        },
        {
            "itinerary_id": "jesus_ministry",
            "title": "Le Ministère Terrestre de Jésus-Christ",
            "category": "Évangiles",
            "description": "De son baptême dans le Jourdain jusqu'à Jérusalem (Évangiles).",
            "color": "#DC2626",
            "waypoints": [
                {"name": "Bethléem", "lat": 31.7054, "lon": 35.2024, "desc": "Naissance du Messie (Luc 2:1-7; Matthieu 2:1)"},
                {"name": "Nazareth", "lat": 32.7019, "lon": 35.2979, "desc": "Enfance et croissance de Jésus (Luc 2:39-52)"},
                {"name": "Béthanie au-delà du Jourdain", "lat": 31.8361, "lon": 35.5492, "desc": "Baptême par Jean-Baptiste (Jean 1:28; Matthieu 3:13-17)"},
                {"name": "Désert de Judée", "lat": 31.7500, "lon": 35.3500, "desc": "Tentation au désert pendant 40 jours (Matthieu 4:1-11)"},
                {"name": "Cana de Galilée", "lat": 32.7483, "lon": 35.3378, "desc": "Premier miracle : l'eau changée en vin (Jean 2:1-11)"},
                {"name": "Capharnaüm", "lat": 32.8806, "lon": 35.5750, "desc": "Ville d'adoption et quartier général du ministère en Galilée (Matthieu 4:13)"},
                {"name": "Mer de Galilée (Mont des Béatitudes)", "lat": 32.8814, "lon": 35.5561, "desc": "Le Sermon sur la Montagne, tempête apaisée (Matthieu 5 - 7; 8:23)"},
                {"name": "Bethsaïda", "lat": 32.8900, "lon": 35.6300, "desc": "Multiplication des pains (Luc 9:10-17)"},
                {"name": "Césarée de Philippe", "lat": 33.2483, "lon": 35.6933, "desc": "Confession de foi de Pierre : 'Tu es le Christ' (Matthieu 16:13-20)"},
                {"name": "Mont Hermon (Transfiguration)", "lat": 33.4144, "lon": 35.8572, "desc": "La Transfiguration de Jésus (Matthieu 17:1-9)"},
                {"name": "Sychar (Puits de Jacob)", "lat": 32.2094, "lon": 35.2797, "desc": "Entretien avec la Samaritaine (Jean 4:1-42)"},
                {"name": "Jéricho", "lat": 31.8667, "lon": 35.4500, "desc": "Guérison de Bartimée et rencontre avec Zachée (Luc 18:35 - 19:10)"},
                {"name": "Béthanie", "lat": 31.7708, "lon": 35.2608, "desc": "Résurrection de Lazare, onction de parfum (Jean 11; 12:1-8)"},
                {"name": "Jérusalem (Mont des Oliviers, Golgotha)", "lat": 31.7780, "lon": 35.2350, "desc": "Entrée triomphale, Cène, Passion, Résurrection et Ascension"}
            ]
        }
    ]

    cur = conn.cursor()
    for itin in itineraries:
        cur.execute("""
        INSERT OR REPLACE INTO itineraries (itinerary_id, title, category, description, color, waypoints_json)
        VALUES (?, ?, ?, ?, ?, ?);
        """, (
            itin["itinerary_id"],
            itin["title"],
            itin["category"],
            itin["description"],
            itin["color"],
            json.dumps(itin["waypoints"], ensure_ascii=False)
        ))
    conn.commit()
    print(f"-> {len(itineraries)} grands itinéraires bibliques insérés.")

def build_database():
    os.makedirs(DATA_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    init_db(conn)

    ancient_url = "https://raw.githubusercontent.com/openbibleinfo/Bible-Geocoding-Data/main/data/ancient.jsonl"
    modern_url = "https://raw.githubusercontent.com/openbibleinfo/Bible-Geocoding-Data/main/data/modern.jsonl"

    ancient_items = fetch_jsonl_from_github(ancient_url)
    modern_items = fetch_jsonl_from_github(modern_url)

    # Créer un index des données modernes par ID (pour récupérer les coordonnées précises)
    modern_by_id = {}
    for m in modern_items:
        m_id = m.get("id")
        if m_id:
            modern_by_id[m_id] = m

    cur = conn.cursor()
    places_count = 0
    verses_total = 0

    print("Indexation des lieux et des versets...")
    for anc in ancient_items:
        place_id = anc.get("id") or anc.get("friendly_id")
        if not place_id:
            continue

        name_en = anc.get("friendly_id") or anc.get("url_slug", "").replace("-", " ").title()
        name_fr = FRENCH_NAME_OVERRIDES.get(name_en, name_en)

        # Recherche des coordonnées
        lat, lon = None, None
        modern_id = None
        modern_name = ""

        # 1. Depuis identifiants / résolutions
        identifications = anc.get("identifications", [])
        if identifications:
            for ident in identifications:
                res_list = ident.get("resolutions", [])
                for res in res_list:
                    lonlat_str = res.get("lonlat")
                    if lonlat_str and "," in lonlat_str:
                        parts = lonlat_str.split(",")
                        try:
                            lon = float(parts[0].strip())
                            lat = float(parts[1].strip())
                            break
                        except ValueError:
                            pass
                if lat is not None and lon is not None:
                    modern_id = ident.get("id")
                    break

        # 2. Si pas trouvé, regarder dans modern_associations
        if lat is None:
            mod_assoc = anc.get("modern_associations", {})
            for m_id, m_data in mod_assoc.items():
                if m_id in modern_by_id:
                    mod_entry = modern_by_id[m_id]
                    lonlat_str = mod_entry.get("lonlat")
                    if lonlat_str and "," in lonlat_str:
                        parts = lonlat_str.split(",")
                        try:
                            lon = float(parts[0].strip())
                            lat = float(parts[1].strip())
                            modern_name = mod_entry.get("friendly_id", "")
                            break
                        except ValueError:
                            pass

        if lat is None or lon is None:
            # Pas de coordonnées exploitables
            continue

        # Type de lieu
        raw_types = anc.get("types", [])
        place_type = "city"
        if raw_types:
            t = raw_types[0].lower()
            if "mountain" in t or "hill" in t:
                place_type = "mountain"
            elif "river" in t or "stream" in t:
                place_type = "river"
            elif "sea" in t or "lake" in t or "gulf" in t:
                place_type = "sea"
            elif "region" in t or "territory" in t or "country" in t or "valley" in t or "desert" in t or "wilderness" in t:
                place_type = "region"
            elif "island" in t:
                place_type = "island"
            else:
                place_type = "city"

        confidence = "certain"
        # Si le score moyen ou identifications multiples
        if len(identifications) > 1:
            confidence = "disputed"
        elif len(identifications) == 1:
            score = identifications[0].get("score", {}).get("vote_average", 500)
            if score < 400:
                confidence = "probable"

        comment = anc.get("comment", "")
        if not comment and anc.get("media", {}).get("thumbnail", {}).get("description"):
            comment = re.sub(r'<[^>]+>', '', anc["media"]["thumbnail"]["description"])

        thumbnail_url = anc.get("media", {}).get("thumbnail", {}).get("credit_url", "")

        # Versets
        verses_raw = anc.get("verses", [])
        osis_list = []
        parsed_verses = []

        for v in verses_raw:
            osis = v.get("osis")
            if osis:
                osis_list.append(osis)
                pv = parse_osis_ref(osis)
                if pv:
                    parsed_verses.append((pv[0], pv[1], pv[2], osis))

        # Insertion du lieu
        cur.execute("""
        INSERT OR REPLACE INTO places (
            place_id, name_en, name_fr, ancient_name, modern_name,
            latitude, longitude, place_type, confidence, comment,
            verses_count, verses_json, thumbnail_url
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """, (
            place_id, name_en, name_fr, name_en, modern_name,
            lat, lon, place_type, confidence, comment,
            len(osis_list), json.dumps(osis_list, ensure_ascii=False), thumbnail_url
        ))
        places_count += 1

        # Insertion des versets
        for bk, ch, vs, osis in parsed_verses:
            cur.execute("""
            INSERT INTO place_verses (place_id, book, chapter, verse, osis)
            VALUES (?, ?, ?, ?, ?);
            """, (place_id, bk, ch, vs, osis))
            verses_total += 1

    conn.commit()
    print(f"✅ {places_count} lieux insérés.")
    print(f"✅ {verses_total} liaisons versets-lieux indexées.")

    populate_itineraries(conn)

    conn.close()
    print(f"🎉 Base de données générée avec succès : {DB_PATH}")

if __name__ == "__main__":
    build_database()
