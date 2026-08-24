import os
import re
import json
import rdata
import pandas as pd

TITLE_TRANSLATIONS = {
    "Prologue": "Prologue",
    "The Promise of the Birth of John the Baptist": "L'annonce de la naissance de Jean-Baptiste",
    "The Annunciation": "L'Annonciation",
    "Mary's Visit to Elizabeth": "La visite de Marie à Élisabeth (Le Magnificat)",
    "The Birth of John the Baptist": "La naissance de Jean-Baptiste (Le Benedictus)",
    "The Genealogy of Jesus": "La généalogie de Jésus-Christ",
    "The Birth of Jesus": "La naissance de Jésus",
    "The Adoration of the Infant Jesus": "L'adoration des bergers et des anges",
    "The Circumcision and Presentation in the Temple": "La circoncision et la présentation au Temple (Siméon et Anne)",
    "The Flight into Egypt and Return": "La fuite en Égypte et le retour à Nazareth",
    "The Childhood of Jesus at Nazareth": "L'enfance de Jésus à Nazareth",
    "The Boy Jesus in the Temple": "Jésus à douze ans au milieu des docteurs",
    "John the Baptist": "Ministère et prédication de Jean-Baptiste",
    "John's Preaching of Repentance": "Prédication de repentance de Jean-Baptiste",
    "John Replies to Questioners": "Jean répond aux foules et aux soldats",
    "John's Messianic Preaching": "L'annonce du Messie et du baptême dans l'Esprit",
    "The Imprisonment of John": "L'arrestation et l'emprisonnement de Jean",
    "The Baptism of Jesus": "Le baptême de Jésus",
    "The Temptation": "La tentation de Jésus au désert",
    "The Call of the First Disciples": "L'appel des premiers disciples",
    "The Marriage at Cana": "Les noces de Cana (Le premier miracle)",
    "The Sojourn at Capernaum": "Séjour à Capernaüm",
    "The First Journey to Jerusalem": "Première montée à Jérusalem",
    "The Cleansing of the Temple": "La purification du Temple",
    "Jesus' Ministry in Jerusalem": "Ministère de Jésus à Jérusalem",
    "The Discourse with Nicodemus": "L'entretien avec Nicodème",
    "Jesus' Ministry in Judea": "Ministère de Jésus en Judée",
    "John's Testimony to Christ": "Le dernier témoignage de Jean-Baptiste",
    "The Journey into Galilee": "Départ pour la Galilée",
    "The Discourse with the Woman of Samaria": "La rencontre avec la Samaritaine au puits de Jacob",
    "Ministry in Galilee": "Début du ministère en Galilée",
    "Jesus' Preaching at Nazareth": "Prédication et rejet de Jésus à Nazareth",
    "The Call of the Disciples": "L'appel des disciples au bord du lac",
    "Teaching in the Synagogue at Capernaum": "Enseignement dans la synagogue de Capernaüm",
    "The Healing of the Demoniac in the Synagogue": "Guérison de l'homme possédé d'un esprit impur",
    "The Healing of Peter's Mother-in-law": "La guérison de la belle-mère de Pierre",
    "The Sick Healed at Evening": "Guérisons multiples au coucher du soleil",
    "Jesus Departs from Capernaum": "Jésus se retire dans un lieu désert pour prier",
    "First Preaching Tour in Galilee": "Première tournée d'évangélisation en Galilée",
    "The Miraculous Draught of Fish": "La pêche miraculeuse",
    "The Cleansing of the Leper": "La purification d'un lépreux",
    "The Healing of the Paralytic": "La guérison du paralytique",
    "The Call of Levi (Matthew)": "L'appel de Lévi (Matthieu) et le repas avec les pécheurs",
    "The Question about Fasting": "La question sur le jeûne et les outres neuves",
    "Plucking Grain on the Sabbath": "Les épis arrachés le jour du sabbat",
    "The Man with the Withered Hand": "L'homme à la main paralysée guéri le jour du sabbat",
    "Jesus Heals Multitudes by the Sea": "Guérisons des foules au bord du lac",
    "The Choosing of the Twelve": "Le choix et l'institution des douze apôtres",
    "Occasion of the Sermon": "Le cadre du Sermon sur la montagne / dans la plaine",
    "The Beatitudes": "Les Béatitudes",
    "The Salt of the Earth": "Le sel de la terre",
    "The Light of the World": "La lumière du monde",
    "On the Law and the Prophets": "L'accomplissement de la Loi et des Prophètes",
    "On Murder and Wrath": "De la colère et de la réconciliation fraternelle",
    "On Adultery and Divorce": "De l'adultère et de la pureté du cœur",
    "On Oaths": "Du serment et de la sincérité de la parole",
    "On Retaliation": "Du pardon des offenses (Tendre l'autre joue)",
    "On Love of One's Enemies": "L'amour des ennemis",
    "On Almsgiving": "De l'aumône faite en secret",
    "On Prayer": "De la prière dans le secret",
    "The Lord's Prayer": "La prière du Seigneur (Notre Père)",
    "On Fasting": "Du jeûne sincère",
    "On Treasures": "Les trésors dans le ciel",
    "The Sound Eye": "L'œil, lampe du corps",
    "On Serving Two Masters": "Le choix entre Dieu et l'argent (Mammon)",
    "On Anxiety": "Ne vous inquiétez pas pour votre vie",
    "On Judging": "Ne jugez point, afin de ne pas être jugés",
    "On Profaning the Holy": "Ne donnez pas les choses saintes aux chiens",
    "God's Answering of Prayer": "Demandez, cherchez, frappez",
    "The Golden Rule": "La Règle d'or",
    "The Two Ways": "La porte étroite et les deux chemins",
    "By their Fruits": "L'arbre et ses fruits",
    "Saying Lord, Lord": "Ceux qui disent Seigneur, Seigneur",
    "The House Built upon the Rock": "La maison bâtie sur le roc",
    "The Effect of the Sermon": "L'impression produite par le sermon",
    "The Woes": "Les malédictions du sermon dans la plaine",
    "The Centurion of Capernaum": "La foi du centurion de Capernaüm",
    "The Widow's Son at Nain": "La résurrection du fils de la veuve de Naïn",
    "On Following Jesus": "Les exigences pour suivre Jésus",
    "Stilling the Storm": "La tempête apaisée",
    "The Gadarene Demoniacs": "Les démoniaques gadaréniens et le troupeau de porcs",
    "Jairus' Daughter and the Woman with a Hemorrhage": "La fille de Jaïrus et la femme hémorroïsse",
    "Two Blind Men": "La guérison de deux aveugles",
    "The Dumb Demoniac": "La délivrance d'un possédé muet",
    "The Harvest is Great": "La moisson est grande, mais il y a peu d'ouvriers",
    "The Mission of the Twelve": "L'envoi en mission des douze apôtres",
    "Instructions for the Mission": "Instructions et consignes pour la mission",
    "Persecutions Foretold": "Annonce des persécutions et encouragement au témoignage",
    "Fearless Confession": "Confesser le Christ sans crainte",
    "Not Peace, but a Sword": "Non la paix, mais l'épée (Les divisions familiales)",
    "The Reward of Discipleship": "La récompense accordée à qui accueille un disciple",
    "John the Baptist's Question and Jesus' Answer": "La question de Jean-Baptiste en prison et la réponse de Jésus",
    "Jesus' Eulogy of John": "L'éloge de Jean-Baptiste par Jésus",
    "The Unresponsive Generation": "Cette génération comparée à des enfants sur les places",
    "Woes to the Cities of Galilee": "Malheurs proclamés sur les villes impénitentes (Corazin, Bethsaïda, Capernaüm)",
    "Thanksgiving to the Father": "La prière de louange : Je te loue, Père...",
    "The Great Invitation": "Venez à moi, vous tous qui êtes fatigués et chargés",
    "A Sinful Woman Anoints Jesus": "La femme pécheresse qui oint les pieds de Jésus (Chez Simon le pharisien)",
    "The Women who Accompanied Jesus": "Les femmes qui accompagnaient et servaient Jésus",
    "The Beelzebul Controversy": "L'accusation de chasser les démons par Béelzébul",
    "The Sin against the Holy Spirit": "Le péché impardonnable contre le Saint-Esprit",
    "A Tree and Its Fruit": "L'arbre et ses fruits (Paroles et cœur)",
    "The Sign of Jonah": "La demande d'un signe et le signe de Jonas",
    "The Return of the Unclean Spirit": "Le retour de l'esprit impur dans la maison balayée",
    "The True Relatives of Jesus": "La vraie famille de Jésus (Qui est ma mère ?)",
    "The Parable of the Sower": "La parabole du semeur",
    "The Purpose of Parables": "Pourquoi Jésus parle en paraboles",
    "The Explanation of the Sower": "L'explication de la parabole du semeur",
    "The Parable of the Seed Growing Secretly": "La parabole de la semence qui croît d'elle-même",
    "The Parable of the Weeds": "La parabole du bon grain et de l'ivraie",
    "The Parable of the Mustard Seed": "La parabole du grain de sénevé",
    "The Parable of the Leaven": "La parabole du levain",
    "Use of Parables": "L'usage des paraboles pour accomplir l'Écriture",
    "Explanation of the Parable of the Weeds": "L'explication de la parabole de l'ivraie",
    "The Hidden Treasure and the Pearl of Great Value": "Le trésor caché et la perle de grand prix",
    "The Parable of the Net": "La parabole du filet jeté dans la mer",
    "Treasures New and Old": "Le maître de maison et les trésors neufs et anciens",
    "Rejection at Nazareth": "Rejet de Jésus dans sa patrie (Nazareth)",
    "Death of John the Baptist": "Le martyre et la décapitation de Jean-Baptiste",
    "The Return of the Apostles": "Le retour des apôtres après leur mission",
    "Feeding the Five Thousand": "La multiplication des cinq pains (Les cinq mille hommes)",
    "Jesus Walks on the Water": "Jésus marche sur les eaux",
    "Healings at Gennesaret": "Guérisons multiples au pays de Génésareth",
    "The Tradition of the Elders": "La tradition des anciens et la vraie pureté",
    "What Defiles a Person": "Ce qui souille l'homme (Ce qui sort du cœur)",
    "The Faith of the Syrophoenician Woman": "La foi de la Cananéenne (femme syro-phénicienne)",
    "Healing of the Deaf Mute": "La guérison du sourd-muet en Décapole (Effata)",
    "Feeding the Four Thousand": "La seconde multiplication des pains (Les quatre mille)",
    "The Demand for a Sign": "Les pharisiens réclament un signe du ciel",
    "The Leaven of the Pharisees": "Mise en garde contre le levain des pharisiens et des sadducéens",
    "Healing of a Blind Man at Bethsaida": "La guérison graduelle de l'aveugle de Bethsaïda",
    "Peter's Confession of Christ": "La confession de foi de Pierre à Césarée de Philippe",
    "First Prediction of the Passion": "Première annonce de la Passion et de la Résurrection",
    "The Conditions of Discipleship": "Les conditions pour marcher à la suite de Jésus (Porter sa croix)",
    "The Transfiguration": "La Transfiguration sur la montagne",
    "The Coming of Elijah": "La question sur la venue préalable d'Élie",
    "Healing of an Epileptic Boy": "La guérison du jeune garçon épileptique / possédé",
    "Second Prediction of the Passion": "Deuxième annonce de la Passion et de la Résurrection",
    "The Temple Tax": "L'impôt du Temple et la pièce trouvée dans le poisson",
    "True Greatness": "Qui est le plus grand dans le Royaume des cieux ? (L'enfant pour modèle)",
    "The Strange Exorcist": "Celui qui n'est pas contre nous est pour nous",
    "Temptations to Sin": "Malheur à celui par qui le scandale arrive",
    "The Parable of the Lost Sheep": "La parabole de la brebis perdue",
    "Reproving Another and Reconciliation": "La correction fraternelle et le pouvoir de lier/délier",
    "The Parable of the Unforgiving Servant": "La parabole du serviteur impitoyable",
    "Departure for Judea": "Départ de la Galilée pour la Judée",
    "Teaching on Divorce": "Enseignement sur le mariage et le divorce",
    "Jesus Blesses Little Children": "Jésus accueille et bénit les petits enfants",
    "The Rich Young Man": "Le jeune homme riche et les exigences du Royaume",
    "Possessions and the Kingdom": "Le danger des richesses (Le chameau et le trou d'aiguille)",
    "The Parable of the Laborers in the Vineyard": "La parabole des ouvriers de la onzième heure",
    "Third Prediction of the Passion": "Troisième annonce de la Passion et de la Résurrection",
    "The Request of James and John": "La requête des fils de Zébédée (Servir et donner sa vie)",
    "Healing of the Blind at Jericho": "La guérison des aveugles de Jéricho (Bartimée)",
    "Zacchaeus": "La rencontre et la conversion de Zachée",
    "The Parable of the Ten Pounds (Minas)": "La parabole des mines (ou des talents)",
    "The Triumphal Entry into Jerusalem": "L'entrée triomphale de Jésus à Jérusalem (Les Rameaux)",
    "Jesus Weeps over Jerusalem": "Jésus pleure sur Jérusalem",
    "The Cursing of the Fig Tree": "Le figuier stérile maudit",
    "The Authority of Jesus Questioned": "La question sur l'autorité de Jésus",
    "The Parable of the Two Sons": "La parabole des deux fils envoyés à la vigne",
    "The Parable of the Wicked Tenants": "La parabole des vignerons homicides",
    "The Parable of the Wedding Banquet": "La parabole du festin des noces",
    "Paying Taxes to Caesar": "Le tribut payé à César (Rendez à César...)",
    "The Question about the Resurrection": "La question des sadducéens sur la résurrection",
    "The Great Commandment": "Le plus grand commandement (Aimer Dieu et son prochain)",
    "David's Son": "Le Messie, fils ou Seigneur de David ?",
    "Denunciation of the Scribes and Pharisees": "Dénonciation de l'hypocrisie des scribes et des pharisiens (Les sept malheurs)",
    "Lament over Jerusalem": "Complainte de Jésus sur Jérusalem meurtrière des prophètes",
    "The Widow's Offering": "L'offrande de la pauvre veuve au Temple",
    "The Destruction of the Temple Foretold": "Annonce de la ruine du Temple et début du discours eschatologique",
    "Signs of the End of the Age": "Les signes avant-coureurs de la fin",
    "The Abomination of Desolation": "L'abomination de la désolation et la grande tribulation",
    "The Coming of the Son of Man": "L'avènement glorieux du Fils de l'homme",
    "The Lesson of the Fig Tree": "La leçon du figuier (Veillez et soyez prêts)",
    "The Day and Hour Unknown": "Nul ne connaît le jour ni l'heure",
    "The Faithful and Unfaithful Servants": "Le serviteur fidèle et le serviteur infidèle",
    "The Parable of the Ten Virgins": "La parabole des dix vierges",
    "The Parable of the Talents": "La parabole des talents",
    "The Last Judgment (Sheep and Goats)": "Le Jugement dernier (Les brebis et les boucs)",
    "The Plot against Jesus": "Le complot des chefs religieux contre Jésus",
    "The Anointing at Bethany": "L'onction de Jésus à Béthanie (Le parfum de grand prix)",
    "Judas' Agreement to Betray Jesus": "La trahison de Judas pour trente pièces d'argent",
    "Preparation for the Passover": "Les préparatifs du repas pascal",
    "The Last Supper": "La Cène et l'institution de l'Eucharistie",
    "Prediction of Peter's Denial": "L'annonce du reniement de Pierre",
    "Gethsemane": "La prière et l'agonie de Jésus à Gethsémané",
    "The Betrayal and Arrest of Jesus": "L'arrestation de Jésus et le baiser de Judas",
    "Jesus before the Sanhedrin": "Jésus devant le Sanhédrin et le grand prêtre Caïphe",
    "Peter Denies Jesus": "Le reniement de Pierre et ses larmes amères",
    "The Death of Judas": "Le remords et le suicide de Judas",
    "Jesus before Pilate": "Jésus comparaît devant Ponce Pilate",
    "Jesus before Herod": "Jésus comparaît devant Hérode Antipas",
    "Jesus Condemned to Death": "La condamnation de Jésus et le choix de Barabbas",
    "The Soldiers Mock Jesus": "Les outrages, la couronne d'épines et la dérision des soldats",
    "The Road to Golgotha": "Le chemin de croix (Simon de Cyrène)",
    "The Crucifixion": "Le crucifiement de Jésus au Golgotha",
    "Jesus Mocked on the Cross": "Les outrages et les insultes au pied de la croix",
    "The Death of Jesus": "La mort de Jésus sur la croix (Le voile déchiré)",
    "The Burial of Jesus": "L'ensevelissement de Jésus par Joseph d'Arimathée",
    "The Guard at the Tomb": "La garde placée devant le sépulcre scellé",
    "The Resurrection / The Empty Tomb": "La Résurrection : Les femmes au tombeau vide",
    "The Report of the Guard": "Le rapport des gardes acheté par les chefs religieux",
    "Jesus Appears to the Disciples": "Apparitions de Jésus ressuscité aux disciples",
    "The Great Commission": "La Grande Commission (Allez, faites de toutes les nations des disciples)",
    "The Ascension": "L'Ascension du Seigneur au ciel"
}

def clean_french_title(english_title: str) -> str:
    cleaned_en = english_title.strip().strip('"').strip("'").strip(',').strip('!').strip('/')
    cleaned_en = re.sub(r'^[0-9A-Za-z]\s*', '', cleaned_en) if cleaned_en.startswith(('0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '!', '/', '"', "'", ',', '$', '&')) else cleaned_en
    cleaned_en = cleaned_en.strip()
    
    if cleaned_en in TITLE_TRANSLATIONS:
        return TITLE_TRANSLATIONS[cleaned_en]
    
    for k, v in TITLE_TRANSLATIONS.items():
        if k.lower() in cleaned_en.lower() or cleaned_en.lower() in k.lower():
            return v
            
    return cleaned_en

def parse_ref_ranges(raw_val: str, book_code: str):
    if not raw_val or not isinstance(raw_val, str) or not raw_val.strip():
        return None
        
    s = raw_val.strip()
    if s.lower() in ['nan', 'none', '']:
        return None
        
    pattern = r'(\d+)\.(\d+)(?:-(\d+)(?:\.(\d+))?)?'
    matches = list(re.finditer(pattern, s))
    if not matches:
        return None
        
    parsed_ranges = []
    display_refs = []
    
    for m in matches:
        start_ch = int(m.group(1))
        start_v = int(m.group(2))
        if m.group(3):
            if m.group(4):
                end_ch = int(m.group(3))
                end_v = int(m.group(4))
            else:
                end_ch = start_ch
                end_v = int(m.group(3))
        else:
            end_ch = start_ch
            end_v = start_v
            
        if start_ch == end_ch:
            if start_v == end_v:
                d_ref = f"{book_code} {start_ch}:{start_v}"
                v_keys = [f"{start_ch}:{start_v}"]
            else:
                d_ref = f"{book_code} {start_ch}:{start_v}-{end_v}"
                v_keys = [f"{start_ch}:{v}" for v in range(start_v, end_v + 1)]
        else:
            d_ref = f"{book_code} {start_ch}:{start_v}-{end_ch}:{end_v}"
            v_keys = [f"{start_ch}:{start_v}"]
            
        display_refs.append(d_ref)
        parsed_ranges.append({
            "book": book_code,
            "ref": d_ref,
            "start_ch": start_ch,
            "start_v": start_v,
            "end_ch": end_ch,
            "end_v": end_v,
            "verse_keys": v_keys
        })
        
    if not parsed_ranges:
        return None
        
    main_r = parsed_ranges[0]
    all_verse_keys = []
    for pr in parsed_ranges:
        all_verse_keys.extend(pr["verse_keys"])
        
    return {
        "book": book_code,
        "ref": ", ".join(display_refs),
        "primary_ref": main_r["ref"],
        "start_ch": main_r["start_ch"],
        "start_v": main_r["start_v"],
        "end_ch": parsed_ranges[-1]["end_ch"],
        "end_v": parsed_ranges[-1]["end_v"],
        "ranges": parsed_ranges,
        "verse_keys": sorted(list(set(all_verse_keys)))
    }

def main():
    root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    workspace_root = os.path.dirname(root_dir)
    source_path = os.path.join(workspace_root, "data", "gospel_parallels")
    
    if not os.path.exists(source_path):
        source_path = os.path.join(root_dir, "data", "gospel_parallels")
        
    print(f"Chargement de {source_path}...")
    parsed = rdata.parser.parse_file(source_path)
    df = rdata.conversion.convert(parsed)["gospel_parallels"]
    
    pericopes = []
    
    for idx, row in df.iterrows():
        num = int(row["No."])
        en_title = str(row["Pericope"]).strip()
        fr_title = clean_french_title(en_title)
        
        mat_data = parse_ref_ranges(str(row.get("Matthew", "")), "MAT")
        mrk_data = parse_ref_ranges(str(row.get("Mark", "")), "MRK")
        luk_data = parse_ref_ranges(str(row.get("Luke", "")), "LUK")
        jhn_data = parse_ref_ranges(str(row.get("John", "")), "JHN")
        
        active_gospels = []
        if mat_data: active_gospels.append("MAT")
        if mrk_data: active_gospels.append("MRK")
        if luk_data: active_gospels.append("LUK")
        if jhn_data: active_gospels.append("JHN")
        
        tradition_type = "single"
        if len(active_gospels) == 4:
            tradition_type = "quadruple"
        elif len(active_gospels) == 3:
            if "MRK" in active_gospels and "MAT" in active_gospels and "LUK" in active_gospels:
                tradition_type = "triple"
            else:
                tradition_type = "other_triple"
        elif len(active_gospels) == 2:
            if "MAT" in active_gospels and "LUK" in active_gospels and "MRK" not in active_gospels:
                tradition_type = "double_q"
            else:
                tradition_type = "double"
        elif len(active_gospels) == 1:
            tradition_type = f"sondergut_{active_gospels[0].lower()}"
            
        p_obj = {
            "id": num,
            "title_fr": fr_title,
            "title_en": en_title,
            "tradition_type": tradition_type,
            "gospels_count": len(active_gospels),
            "active_gospels": active_gospels,
            "MAT": mat_data,
            "MRK": mrk_data,
            "LUK": luk_data,
            "JHN": jhn_data
        }
        pericopes.append(p_obj)
        
    out_dir = os.path.join(root_dir, "data")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "gospel_parallels.json")
    
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump({
            "version": "1.0",
            "source": "Kurt Aland / Burton H. Throckmorton Synopsis of the Four Gospels",
            "total_pericopes": len(pericopes),
            "pericopes": pericopes
        }, f, ensure_ascii=False, indent=2)
        
    print(f"[OK] {len(pericopes)} péricopes synoptiques sauvegardées avec succès dans {out_path}")

if __name__ == "__main__":
    main()
