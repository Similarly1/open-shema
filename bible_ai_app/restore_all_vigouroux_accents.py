import os
import sys
import json
import re
import time
import unicodedata

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

def strip_accents(s):
    nfd = unicodedata.normalize('NFD', s)
    return ''.join(c for c in nfd if unicodedata.category(c) != 'Mn')

def build_accent_dictionary(base_dir):
    print("Construction du lexique étendu d'accents français...")
    dict_cache_path = os.path.join(base_dir, "data", "french_words.json")
    if not os.path.exists(dict_cache_path):
        import urllib.request
        url = "https://raw.githubusercontent.com/words/an-array-of-french-words/master/index.json"
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as resp:
            data = resp.read()
        with open(dict_cache_path, 'wb') as f:
            f.write(data)

    with open(dict_cache_path, 'r', encoding='utf-8') as f:
        all_words = json.load(f)

    words_naturally_unaccented = set()
    purely_accented_words = {}

    for w in all_words:
        w_low = w.lower()
        if strip_accents(w_low) == w_low:
            words_naturally_unaccented.add(w_low)

    for w in all_words:
        w_low = w.lower()
        stripped = strip_accents(w_low)
        if stripped != w_low:
            if stripped not in words_naturally_unaccented:
                if stripped not in purely_accented_words:
                    purely_accented_words[stripped] = w_low

    EXPLICIT_SAFE_MAP = {
        # Pronoms, adverbes, prépositions
        "apres": "après",
        "deja": "déjà",
        "tres": "très",
        "bientot": "bientôt",
        "aussitot": "aussitôt",
        "tot": "tôt",
        "plutot": "plutôt",
        "tantot": "tantôt",
        "voila": "voilà",
        "meme": "même",
        "memes": "mêmes",
        "grace": "grâce",
        "graces": "grâces",
        "d'apres": "d'après",
        
        # Noms de parenté
        "pere": "père",
        "peres": "pères",
        "mere": "mère",
        "meres": "mères",
        "frere": "frère",
        "freres": "frères",
        "soeur": "sœur",
        "soeurs": "sœurs",
        
        # Personnages & Noms bibliques majeurs
        "moise": "Moïse",
        "noel": "Noël",
        "jesus": "Jésus",
        "jerusalem": "Jérusalem",
        "israel": "Israël",
        "israël": "Israël",
        "chanaan": "Chanaan",
        "salomon": "Salomon",
        "bethleem": "Bethléem",
        "nazareth": "Nazareth",
        "samarie": "Samarie",
        "galilee": "Galilée",
        "judee": "Judée",
        "babylone": "Babylone",
        "ninive": "Ninive",
        
        # Termes théologiques, bibliques et ecclésiastiques
        "eglise": "église",
        "eglises": "églises",
        "chretien": "chrétien",
        "chretiens": "chrétiens",
        "chretienne": "chrétienne",
        "chretiennes": "chrétiennes",
        "chretiente": "chrétienté",
        "prophete": "prophète",
        "prophetes": "prophètes",
        "prophetie": "prophétie",
        "propheties": "prophéties",
        "prophetique": "prophétique",
        "prophetiques": "prophétiques",
        "evangile": "évangile",
        "evangiles": "évangiles",
        "evangelique": "évangélique",
        "evangeliques": "évangéliques",
        "evangeliste": "évangéliste",
        "evangelistes": "évangélistes",
        "apotre": "apôtre",
        "apotres": "apôtres",
        "apostolique": "apostolique",
        "apostoliques": "apostoliques",
        "pretre": "prêtre",
        "pretres": "prêtres",
        "pretrise": "prêtrise",
        "eveque": "évêque",
        "eveques": "évêques",
        "archeveque": "archevêque",
        "theologie": "théologie",
        "theologies": "théologies",
        "theologien": "théologien",
        "theologiens": "théologiens",
        "theologique": "théologique",
        "theologiques": "théologiques",
        "exegete": "exégète",
        "exegetes": "exégètes",
        "exegetique": "exégétique",
        "exegetiques": "exégétiques",
        "exegese": "exégèse",
        "genealogie": "généalogie",
        "genealogies": "généalogies",
        "genealogique": "généalogique",
        "archeologie": "archéologie",
        "archeologique": "archéologique",
        "archeologiques": "archéologiques",
        "archeologue": "archéologue",
        "archeologues": "archéologues",
        
        # Langues et peuples
        "israelite": "israélite",
        "israelites": "israélites",
        "hebreu": "hébreu",
        "hebreux": "hébreux",
        "hebraique": "hébraïque",
        "hebraiques": "hébraïques",
        "hebraisant": "hébraïsant",
        "arameen": "araméen",
        "arameens": "araméens",
        "arameenne": "araméenne",
        "egyptien": "égyptien",
        "egyptiens": "égyptiens",
        "egyptienne": "égyptienne",
        "egypte": "égypte",
        "chananeen": "chananéen",
        "chananeens": "chananéens",
        "chananeenne": "chananéenne",
        "chaldeen": "chaldéen",
        "chaldeens": "chaldéens",
        "phenicien": "phénicien",
        "pheniciens": "phéniciens",
        "samaritain": "samaritain",
        "samaritains": "samaritains",
        
        # Livres bibliques
        "genese": "genèse",
        "epitre": "épître",
        "epitres": "épîtres",
        "ecriture": "écriture",
        "ecritures": "écritures",
        "deuteronome": "deutéronome",
        "ecclesiaste": "ecclésiaste",
        "ecclesiastique": "ecclésiastique",
        "levitique": "lévitique",
        
        # Noms communs et adjectifs indispensables
        "siecle": "siècle",
        "siecles": "siècles",
        "evenement": "événement",
        "evenements": "événements",
        "premiere": "première",
        "premieres": "premières",
        "premierement": "premièrement",
        "derniere": "dernière",
        "dernieres": "dernières",
        "matiere": "matière",
        "matieres": "matières",
        "maniere": "manière",
        "manieres": "manières",
        "regne": "règne",
        "regnes": "règnes",
        "creation": "création",
        "createur": "créateur",
        "creature": "créature",
        "creatures": "créatures",
        "peche": "péché",
        "peches": "péchés",
        "pecheur": "pécheur",
        "pecheurs": "pécheurs",
        "verite": "vérité",
        "verites": "vérités",
        "veritable": "véritable",
        "veritables": "véritables",
        "caractere": "caractère",
        "caracteres": "caractères",
        "phenomene": "phénomène",
        "phenomenes": "phénomènes",
        "periode": "période",
        "periodes": "périodes",
        "mystere": "mystère",
        "mysteres": "mystères",
        "modele": "modèle",
        "modeles": "modèles",
        "fidele": "fidèle",
        "fideles": "fidèles",
        "fidelite": "fidélité",
        "systeme": "système",
        "systemes": "systèmes",
        "probleme": "problème",
        "problemes": "problèmes",
        "celebre": "célèbre",
        "celebres": "célèbres",
        "celebrer": "célébrer",
        "celebration": "célébration",
        "temoignage": "témoignage",
        "temoignages": "témoignages",
        "temoin": "témoin",
        "temoins": "témoins",
        "edition": "édition",
        "editions": "éditions",
        "editeur": "éditeur",
        "editeurs": "éditeurs",
        "erudit": "érudit",
        "erudits": "érudits",
        "erudition": "érudition",
        "etude": "étude",
        "etudes": "études",
        "etudiant": "étudiant",
        "etudiants": "étudiants",
        "element": "élément",
        "elements": "éléments",
        "etrange": "étrange",
        "etranger": "étranger",
        "etrangers": "étrangers",
        "etrangere": "étrangère",
        "etrangeres": "étrangères",
        "etat": "état",
        "etats": "états",
        "etablir": "établir",
        "etabli": "établi",
        "etablis": "établis",
        "etablie": "établie",
        "etablies": "établies",
        "etablissement": "établissement",
        "etendue": "étendue",
        "etendard": "étendard",
        "etendards": "étendards",
        "etoile": "étoile",
        "etoiles": "étoiles",
        "etroit": "étroit",
        "etroite": "étroite",
        "elevation": "élévation",
        "eleve": "élève",
        "eleves": "élèves",
        "eloigne": "éloigné",
        "eloignee": "éloignée",
        "eloignes": "éloignés",
        "eloquence": "éloquence",
        "emigration": "émigration",
        "egale": "égale",
        "egalement": "également",
        "egaux": "égaux",
        
        # Participes passés et adjectifs très fréquents sans conflit
        "nomme": "nommé",
        "nommes": "nommés",
        "nommee": "nommée",
        "nommees": "nommées",
        "crucifie": "crucifié",
        "crucifies": "crucifiés",
        "ressuscite": "ressuscité",
        "ressuscites": "ressuscités",
        "separe": "séparé",
        "separes": "séparés",
        "separee": "séparée",
        "separees": "séparées",
        "situe": "situé",
        "situes": "situés",
        "situee": "située",
        "situees": "situées",
        "fonde": "fondé",
        "fondes": "fondés",
        "fondee": "fondée",
        "fondees": "fondées",
        "compose": "composé",
        "composes": "composés",
        "composee": "composée",
        "composees": "composées",
        "designe": "désigné",
        "designes": "désignés",
        "designee": "désignée",
        "designees": "désignées",
        "redige": "rédigé",
        "rediges": "rédigés",
        "redigee": "rédigée",
        "redigees": "rédigées",
        "divinite": "divinité",
        "trinite": "trinité",
        "chastete": "chasteté",
        "saintete": "sainteté",
        "eternite": "éternité",
        "immortalite": "immortalité",
        "pitie": "pitié",
        "charite": "charité",
        "piete": "piété",
        "autorite": "autorité",
        "dignite": "dignité",
        "majeste": "majesté",
        "societe": "société",
        "faculte": "faculté",
        "difficulte": "difficulté",
        "difficultes": "difficultés",
        "facilite": "facilité",
        "severite": "sévérité",
        "purete": "pureté",
        "variete": "variété",
        "varietes": "variétés",
        "sacre": "sacré",
        "sacres": "sacrés",
        "sacree": "sacrée",
        "sacrees": "sacrées",
        "consacre": "consacré",
        "consacres": "consacrés",
        "consacree": "consacrée",
        "consacrees": "consacrées",
        "edifie": "édifié",
        "edifies": "édifiés",
        "purifie": "purifié",
        "sanctifie": "sanctifié",
        "glorifie": "glorifié",
        "justifie": "justifié",
        
        # Formes du verbe Être
        "etait": "était",
        "etaient": "étaient",
        "ete": "été",
        "etant": "étant"
    }

    purely_accented_words.update(EXPLICIT_SAFE_MAP)
    print(f"Total lexique d'accents sécurisé : {len(purely_accented_words)} mots.")
    return purely_accented_words

def apply_accent_restoration(text, accent_dict, word_pat):
    # 1. Ligatures françaises (œ, æ)
    text = re.sub(r"\bmoeurs\b", "mœurs", text, flags=re.IGNORECASE)
    text = re.sub(r"\bcoeur\b", "cœur", text, flags=re.IGNORECASE)
    text = re.sub(r"\bcoeurs\b", "cœurs", text, flags=re.IGNORECASE)
    text = re.sub(r"\boeuvre\b", "œuvre", text, flags=re.IGNORECASE)
    text = re.sub(r"\boeuvres\b", "œuvres", text, flags=re.IGNORECASE)
    text = re.sub(r"\bvoeu\b", "vœu", text, flags=re.IGNORECASE)
    text = re.sub(r"\bvoeux\b", "vœux", text, flags=re.IGNORECASE)
    text = re.sub(r"\bsoeur\b", "sœur", text, flags=re.IGNORECASE)
    text = re.sub(r"\bsoeurs\b", "sœurs", text, flags=re.IGNORECASE)
    
    # 2. Expressions avec 'à'
    text = re.sub(r"\bc'est-a-dire\b", "c'est-à-dire", text, flags=re.IGNORECASE)
    text = re.sub(r"\bvis-a-vis\b", "vis-à-vis", text, flags=re.IGNORECASE)
    text = re.sub(r"\bquant a\b", "quant à", text, flags=re.IGNORECASE)
    text = re.sub(r"\bgrace a\b", "grâce à", text, flags=re.IGNORECASE)
    text = re.sub(r"\bjusqu'a\b", "jusqu'à", text, flags=re.IGNORECASE)
    text = re.sub(r"\bface a\b", "face à", text, flags=re.IGNORECASE)
    text = re.sub(r"\bpeu a peu\b", "peu à peu", text, flags=re.IGNORECASE)
    text = re.sub(r"\btour a tour\b", "tour à tour", text, flags=re.IGNORECASE)
    text = re.sub(r"\bmise a mort\b", "mise à mort", text, flags=re.IGNORECASE)
    text = re.sub(r"\bmettre a mort\b", "mettre à mort", text, flags=re.IGNORECASE)
    text = re.sub(r"\bmis a mort\b", "mis à mort", text, flags=re.IGNORECASE)
    text = re.sub(r"\bd'apres\b", "d'après", text, flags=re.IGNORECASE)
    
    # Préposition 'à' devant articles ou déterminants
    text = re.sub(r"\b([Aa])\s+(la|l'|le|les|un|une|des|ce|cet|cette|ces|son|sa|ses|leur|leurs|mon|ma|mes|ton|ta|tes|notre|nos|votre|vos|tout|tous|toute|toutes|quel|quelle|quelles|quels|travers|cause|partir|propos|cote|côté|défaut|egard|égard|titre|présent|present|peine|jamais|nouveau|vrai|dire|moins|plus|condition|portee|portée|coup|base)\b", r"à \2", text)
    
    # 3. 'où' temporel ou de lieu
    text = re.sub(r"\b(la|lieu|jour|moment|temps|epoque|époque|pays|ville|endroit|point|region|région|annee|année|siecle|siècle|d'|par)\s+ou\b", r"\1 où", text, flags=re.IGNORECASE)
    text = re.sub(r"\bou\s+(il|elle|ils|elles|on|l'on)\b", r"où \1", text, flags=re.IGNORECASE)
    
    # 4. Remplacement mot à mot
    def word_sub(match):
        w = match.group(0)
        low = w.lower()
        if low in accent_dict:
            rep = accent_dict[low]
            if w.isupper() and len(w) > 1:
                return rep.upper()
            elif w[0].isupper():
                return rep.capitalize()
            else:
                return rep
        return w
        
    return word_pat.sub(word_sub, text)

def process_vigouroux_dictionary():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    dict_path = os.path.join(base_dir, "data", "vigouroux_dict.json")
    
    if not os.path.exists(dict_path):
        print(f"Fichier introuvable : {dict_path}")
        return
        
    print(f"Chargement de {dict_path}...")
    t0 = time.time()
    with open(dict_path, "r", encoding="utf-8") as f:
        dict_data = json.load(f)
        
    articles = dict_data.get("articles", {})
    print(f"Nombre d'articles à traiter : {len(articles)}")
    
    accent_dict = build_accent_dictionary(base_dir)
    word_pat = re.compile(r"\b[a-zA-Zà-ÿÀ-ÝœŒæÆ'-]+\b")
    
    print("Application de la restauration des accents...")
    count = 0
    for slug, art in articles.items():
        # Title
        t = art.get("title", "")
        if t:
            art["title"] = apply_accent_restoration(t, accent_dict, word_pat)
        # Text
        txt = art.get("text", "")
        if txt:
            art["text"] = apply_accent_restoration(txt, accent_dict, word_pat)
            
        count += 1
        if count % 2000 == 0:
            print(f"  - {count} / {len(articles)} articles traités...")
            
    print("Écriture du fichier mis à jour...")
    with open(dict_path, "w", encoding="utf-8") as f:
        json.dump(dict_data, f, ensure_ascii=False, indent=2)
        
    print(f"✅ Terminé avec succès en {time.time()-t0:.2f}s !")
    print(f"  - Fichier {dict_path} mis à jour.")

if __name__ == "__main__":
    process_vigouroux_dictionary()
