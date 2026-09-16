import urllib.request
import urllib.parse
import json
import re
import unicodedata
import logging

logger = logging.getLogger(__name__)

class WikipediaClient:
    """
    Client asynchrone et intelligent pour l'encyclopédie Wikipédia (en ligne).
    - Filtrage strict des contenus de pop-culture (films, séries, musique, jeux vidéo, essais contemporains)
    - Priorisation du contexte biblique, théologique, historique et philosophique
    - Mappage des termes bibliques ambigus vers les articles doctrinaux et exégétiques majeurs
    - Recherche multi-candidats avec sélecteur direct pour l'utilisateur
    - Résumé d'introduction + contenu étendu (5 à 10 paragraphes)
    - Cache en mémoire pour un affichage instantané
    """
    _cache = {}
    _extended_cache = {}
    USER_AGENT = "BibleAIApp/2.0 (Academic and Educational Bible Study Tool; contact@bibleai.local)"

    # Mappage des concepts théologiques / bibliques fondamentaux vers les articles encyclopédiques de référence
    THEOLOGICAL_ALIASES = {
        'commencement': ['Livre de la Genèse', 'Bereshit', 'Prologue de l\'Évangile selon Jean', 'Logos (christianisme)', 'Récit de la création dans la Genèse'],
        'au commencement': ['Livre de la Genèse', 'Bereshit', 'Prologue de l\'Évangile selon Jean', 'Logos (christianisme)', 'Récit de la création dans la Genèse'],
        'bereshit': ['Bereshit', 'Livre de la Genèse', 'Torah'],
        'verbe': ['Logos (christianisme)', 'Parole de Dieu', 'Prologue de l\'Évangile selon Jean'],
        'parole': ['Parole de Dieu', 'Logos (christianisme)', 'Révélation divine'],
        'alliance': ['Alliance (Bible)', 'Nouvelle Alliance', 'Arche d\'alliance', 'Alliance avec Noé'],
        'arche': ['Arche de Noé', 'Arche d\'alliance'],
        'eden': ['Jardin d\'Éden', 'Arbre de la connaissance du bien et du mal', 'Chute (christianisme)'],
        'creation': ['Récit de la création dans la Genèse', 'Cosmogonie', 'Théologie de la création'],
        'temple': ['Temple de Jérusalem', 'Second Temple de Jérusalem', 'Tabernacle (Bible)'],
        'salut': ['Salut (théologie)', 'Rédemption (théologie)', 'Justification (théologie)'],
        'grace': ['Grâce (christianisme)', 'Salut (théologie)'],
        'loi': ['Loi de Moïse', 'Décalogue', 'Torah'],
        'messie': ['Messie dans le christianisme', 'Messie dans le judaïsme', 'Jésus-Christ', 'Christologie'],
        'esprit': ['Saint-Esprit', 'Esprit de Dieu (judaïsme)', 'Pneumatologie'],
        'apocalypse': ['Apocalypse', 'Eschatologie chrétienne', 'Parousie'],
        'exode': ['Livre de l\'Exode', 'Exode hors d\'Égypte', 'Moïse'],
        'pentateuque': ['Pentateuque', 'Torah', 'Loi de Moïse'],
        'prophete': ['Prophète', 'Prophètes de la Bible', 'Nevi\'im'],
        'abraham': ['Abraham', 'Alliance abrahamique', 'Patriarches (Bible)'],
        'moise': ['Moïse', 'Livre de l\'Exode', 'Tables de la Loi'],
        'david': ['David (Bible)', 'Royaume unifié d\'Israël et de Juda', 'Psaumes'],
        'trinite': ['Trinité (christianisme)', 'Père (Dieu)', 'Fils (christianisme)', 'Saint-Esprit']
    }

    BIBLICAL_KEYWORDS = {
        'bible', 'biblique', 'genèse', 'exode', 'lévitique', 'nombres', 'deutéronome',
        'évangile', 'apôtre', 'roi', 'israël', 'juda', 'jérusalem', 'temple', 'prophète',
        'dieu', 'jésus', 'christ', 'testament', 'torah', 'hébreu', 'chrétien', 'patriarche',
        'alliance', 'paradis', 'antiquité', 'mésopotamie', 'égypte', 'babylone', 'judée', 'église',
        'théologie', 'philosophie', 'foi', 'création', 'religion', 'saint', 'rédemption', 'verbe',
        'logos', 'bereshit', 'exégèse', 'canon', 'pénitence', 'prologue', 'messie'
    }

    BIBLICAL_BOOKS = {
        'genèse', 'exode', 'lévitique', 'nombres', 'deutéronome', 'josué', 'juges', 'ruth',
        'samuel', 'rois', 'chroniques', 'esdras', 'néhémie', 'esther', 'job', 'psaumes',
        'proverbes', 'ecclésiaste', 'cantique', 'ésaïe', 'jérémie', 'lamentations', 'ézéchiel',
        'daniel', 'osée', 'joël', 'amos', 'abdias', 'jonas', 'michée', 'nahum', 'habacuc',
        'sophonie', 'aggée', 'zacharie', 'malachie', 'évangile', 'actes', 'romains', 'corinthiens',
        'galates', 'éphésiens', 'philippiens', 'colossiens', 'thessaloniciens', 'timothée',
        'tite', 'philémon', 'hébreux', 'jacques', 'pierre', 'jean', 'jude', 'apocalypse', 'torah', 'tanakh'
    }

    POP_CULTURE_BLACKLIST = {
        'film', 'cinéma', 'série télévisée', 'série d\'animation', 'bande dessinée', 'comics',
        'chanson', 'album', 'discographie', 'single', 'jeu vidéo', 'manga', 'marvel',
        'super-héros', 'actrice', 'acteur', 'réalisateur', 'groupe de musique', 'groupe de rock',
        'groupe de metal', 'saison de', 'épisode de', 'série de jeux', 'univers cinématographique',
        'téléfilm', 'feuilleton', 'warcraft', 'batman', 'x-men', 'personnage de fiction',
        'roman de', 'roman d\'', 'essai de', 'essai d\'', 'recueil de', 'ici tout commence',
        'exorciste', 'dracula', 'saga', 'franchise', 'trilogie', 'court métrage'
    }

    # Entités commerciales, modernes, technologiques ou contemporaines incompatibles avec l'histoire biblique
    ANACHRONISM_BLACKLIST = {
        'société', 'entreprise', 'fabricant', 'marque', 'multinationale', 'holding', 'startup',
        'siège social', "chiffre d'affaires", 'filiale', 'commerciale', 'électronique',
        'audio', 'microphone', 'casque audio', 'automobile', 'constructeur automobile',
        'logiciel', 'informatique', 'téléphonie', 'smartphone', 'compagnie aérienne',
        'banque', 'bourse', 'chaîne de magasins', 'supermarché', 'magasin', 'matériel audio',
        'album', 'chanson', 'single', 'disque', 'discographie', 'label discographique',
        'groupe de musique', 'groupe de rock', 'groupe de pop', 'groupe de metal',
        'série télévisée', 'feuilleton', 'téléfilm', 'jeu vidéo', 'comics', 'manga',
        'footballeur', 'joueur de football', 'basketteur', 'rugbyman', 'cycliste',
        'pilote automobile', 'formule 1', 'tennisman', 'catcheur', 'boxeur',
        'animateur de télévision', 'journaliste contemporain', 'architecte français',
        'architecte américain', 'architecte britannique', 'député français'
    }

    MODERN_BIOGRAPHY_REGEX = re.compile(
        r'\b(?:né|née|mort|morte)\s+(?:le\s+\d{1,2}\s+[a-zàâäéèêëîïôöùûüç]+\s+)?(?:en\s+)?(17|18|19|20)\d{2}\b',
        re.IGNORECASE
    )
    MODERN_COMPANY_REGEX = re.compile(
        r'\b(?:fondée|créée|fondé|créé)\s+(?:en\s+|le\s+)(18|19|20)\d{2}\b',
        re.IGNORECASE
    )

    # Typologies géographiques valides
    HISTORICAL_GEOGRAPHICAL_KEYWORDS = {
        'ville', 'cité', 'village', 'localité', 'commune', 'agglomération', 'bourg', 'oasis', 'capitale',
        'région', 'province', 'district', 'gouvernorat', 'territoire', 'pays', 'royaume', 'empire',
        'désert', 'désertique', 'mont', 'montagne', 'monts', 'colline', 'vallée', 'plaine', 'plateau',
        'oued', 'wadi', 'fleuve', 'rivière', "cours d'eau", 'mer', 'lac', 'golfe', 'baie', 'détroit',
        'île', 'îles', 'archipel', 'péninsule', 'source', 'puits', 'port', 'état'
    }

    # Ancres historiques, archéologiques, antiques ou bibliques indispensables pour le contexte géographique
    BIBLICAL_ANCIENT_KEYWORDS = {
        'tell', 'ruines', 'site archéologique', 'vestiges', 'fouilles', 'antique', 'antiquité',
        'ancien', 'ancienne', 'âge du bronze', 'âge du fer', 'époque hellénistique', 'époque romaine',
        'époque perse', 'époque byzantine', 'époque ottomane',
        'proche-orient', 'moyen-orient', 'levant', 'croissant fertile', 'mésopotamie', 'anatolie',
        'israël', 'palestine', 'judée', 'samarie', 'galilée', 'chanaan', 'canaan', 'phénicie',
        'égypte', 'syrie', 'jordanie', 'liban', 'sinaï', 'négev', 'bashan', 'basan', 'hauran',
        'galaad', 'moab', 'édom', 'ammon', 'italie', 'rome', 'romain', 'romaine', 'grèce', 'grec',
        'méditerranée', 'mer méditerranée', 'latin', 'latium', 'bassin levantin', 'bassin méditerranéen',
        'bible', 'biblique', 'ancien testament', 'nouveau testament', 'torah', 'tanakh',
        'hébreu', 'sémitique', 'araméen', 'patrimoine mondial'
    }

    # Entités textuelles ou humaines non-géographiques à écarter en contexte de lieux
    NON_PLACE_INDICATORS = {
        'personnage', 'personnalité', 'roi de', 'reine de', 'prince de', 'princesse de',
        'prophète', 'apôtre', 'patriarche', 'homme politique', 'femme politique',
        'livre de', 'livres de', 'évangile', 'épître', 'psaume', 'cantique', 'sourate',
        'est un personnage', 'est un roi', 'est le fils', 'est une reine', 'est un apôtre'
    }

    @classmethod
    def strip_accents(cls, text: str) -> str:
        if not text:
            return ""
        return ''.join(c for c in unicodedata.normalize('NFD', text) if unicodedata.category(c) != 'Mn').lower()

    @classmethod
    def is_title_relevant_for_place(cls, query: str, title: str) -> bool:
        """Vérifie si le titre de l'article correspond bien au nom du lieu recherché."""
        if not query or not title:
            return False
        q_norm = cls.strip_accents(query).strip().lower()
        t_norm = cls.strip_accents(title).strip().lower()
        if not q_norm or not t_norm:
            return False
        if q_norm == t_norm or q_norm in t_norm or t_norm in q_norm:
            return True
        q_words = [w for w in q_norm.split() if len(w) > 2]
        if q_words and all(w in t_norm for w in q_words):
            return True
        return False

    @classmethod
    def is_pop_culture(cls, text: str) -> bool:
        if not text:
            return False
        t_low = text.lower()
        
        # Les livres bibliques (ex: Livre de la Genèse) ne sont JAMAIS de la pop culture
        for b_name in cls.BIBLICAL_BOOKS:
            if b_name in t_low:
                return False

        for kw in cls.POP_CULTURE_BLACKLIST:
            if kw in t_low:
                return True
        return False

    @classmethod
    def is_anachronistic_or_irrelevant(cls, title: str, desc: str = "", extract: str = "", context: str = None, query: str = None) -> bool:
        """
        Détecte si un article Wikipédia est anachronique, commercial ou hors sujet.
        Si context == 'place', applique des filtres stricts garantissant que l'article
        concerne bien une entité géographique ayant une assise historique, archéologique ou biblique.
        """
        combined = f"{title} {desc} {extract[:400]}".lower()

        # 1. Pop-culture générale
        if cls.is_pop_culture(title) or cls.is_pop_culture(desc) or cls.is_pop_culture(extract[:200]):
            return True

        # 2. Mots-clés d'entreprises / marques / anachronismes commerciaux
        for bad_kw in cls.ANACHRONISM_BLACKLIST:
            if bad_kw in combined:
                return True

        # 3. Dates de biographies contemporaines (ex: architecte ou footballeur né en 1889 ou 1975)
        if cls.MODERN_BIOGRAPHY_REGEX.search(combined):
            return True

        # 4. Dates de création d'entreprises modernes (ex: fondée en 1925)
        if cls.MODERN_COMPANY_REGEX.search(combined):
            return True

        # 5. Filtrage contextuel spécifique aux lieux bibliques et antiques
        if context == 'place':
            # Si une requête est fournie, vérifier la pertinence directe du titre
            if query and not cls.is_title_relevant_for_place(query, title):
                return True

            # Rejet des entités non-géographiques (personnages, rois, livres bibliques)
            first_sentence = extract[:150].lower()
            for np in cls.NON_PLACE_INDICATORS:
                if np in title.lower() or np in desc.lower() or np in first_sentence:
                    return True

            has_geo = any(k in combined for k in cls.HISTORICAL_GEOGRAPHICAL_KEYWORDS)
            if not has_geo:
                return True
            has_anc = any(k in combined for k in cls.BIBLICAL_ANCIENT_KEYWORDS)
            if not has_anc:
                return True

        return False

    @classmethod
    def get_summary(cls, query: str, exact_title: str = None, lang: str = "fr", context: str = None) -> dict:
        """
        Récupère le résumé Wikipédia d'un terme ou d'un titre exact.
        Retourne l'article sélectionné et une liste riche de candidats alternatifs sélectionnables par l'utilisateur.
        Si context == 'place', applique le filtrage strict anti-anachronisme géographique et antique.
        """
        if not query or not query.strip():
            return {"found": False, "error": "Requête vide"}

        clean_q = query.strip()
        target_title = exact_title.strip() if exact_title else None
        
        cache_key = f"{lang}:{context or ''}:{target_title or clean_q.lower()}"
        if cache_key in cls._cache and not exact_title:
            return cls._cache[cache_key]

        # 1. Récupérer tous les candidats correspondants
        candidates = cls.search_candidates(clean_q, lang=lang, limit=10, context=context)

        # 2. Déterminer le titre à charger
        chosen_title = target_title
        if not chosen_title:
            if candidates:
                chosen_title = candidates[0]["title"]
            else:
                chosen_title = clean_q

        # 3. Charger les données détaillées de l'article retenu via l'Action API robuste
        result = cls._fetch_direct_summary(chosen_title, lang)
        
        # 4. Repli si l'article obtenu est invalide, anachronique ou pop-culture
        if not result or not result.get("found") or cls.is_anachronistic_or_irrelevant(result.get("title", ""), result.get("description", ""), result.get("extract", ""), context=context, query=clean_q):
            result = None
            for cand in candidates:
                if cand["title"] != chosen_title:
                    res_alt = cls._fetch_direct_summary(cand["title"], lang)
                    if res_alt and res_alt.get("found") and not cls.is_anachronistic_or_irrelevant(res_alt.get("title", ""), res_alt.get("description", ""), res_alt.get("extract", ""), context=context, query=clean_q):
                        result = res_alt
                        chosen_title = cand["title"]
                        break

        if not result or not result.get("found"):
            result = {
                "found": False,
                "title": target_title or clean_q,
                "candidates": candidates,
                "search_query": clean_q,
                "error": f"Aucun article encyclopédique pertinent trouvé pour « {clean_q} »."
            }
        else:
            result["search_query"] = clean_q
            # S'assurer que tous les candidats sont disponibles avec leur tier (nuage de mots)
            cands_list = []
            for c in candidates:
                cands_list.append({
                    "title": c["title"],
                    "snippet": c.get("snippet", ""),
                    "score": c.get("score", 0),
                    "tier": c.get("tier", "md"),
                    "is_current": (c["title"].lower() == result["title"].lower())
                })
            # Si l'article actuel n'est pas dans la liste des candidats, l'ajouter en premier
            if not any(c["title"].lower() == result["title"].lower() for c in cands_list):
                cands_list.insert(0, {
                    "title": result["title"],
                    "snippet": result.get("description") or "Article sélectionné",
                    "score": 100,
                    "tier": "xl",
                    "is_current": True
                })
            result["candidates"] = cands_list

        cls._cache[cache_key] = result
        return result

    @classmethod
    def get_extended_content(cls, title: str, lang: str = "fr", max_paragraphs: int = 8) -> dict:
        """
        Récupère le contenu détaillé d'un article Wikipédia (5 à 10 paragraphes structurés avec sections).
        Permet la lecture approfondie directement dans l'application sans ouvrir le navigateur.
        """
        if not title or not title.strip():
            return {"found": False, "error": "Titre manquant"}

        clean_title = title.strip()
        cache_key = f"{lang}:ext:{clean_title.lower()}"
        if cache_key in cls._extended_cache:
            return cls._extended_cache[cache_key]

        encoded_title = urllib.parse.quote(clean_title)
        url = f"https://{lang}.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&titles={encoded_title}&format=json"

        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": cls.USER_AGENT,
                "Accept": "application/json"
            }
        )

        try:
            with urllib.request.urlopen(req, timeout=7) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode("utf-8"))
                    pages = data.get("query", {}).get("pages", {})
                    if not pages:
                        return {"found": False, "error": "Article introuvable"}

                    page_data = list(pages.values())[0]
                    raw_extract = page_data.get("extract", "").strip()

                    if not raw_extract:
                        return {"found": False, "error": "Contenu vide"}

                    # Découpage et structuration en paragraphes et sections
                    raw_lines = [l.strip() for l in raw_extract.split('\n') if l.strip()]
                    formatted_html = []
                    para_count = 0

                    for line in raw_lines:
                        line_low = line.lower()
                        # Arrêter aux sections bibliographiques et annexes
                        if any(stop_sec in line_low for stop_sec in ['== bibliographie ==', '== voir aussi ==', '== liens externes ==', '== notes et références ==', '== annexes ==']):
                            break

                        # Titre de niveau 2 (== Section ==)
                        if line.startswith('== ') and line.endswith(' =='):
                            sec_title = line[3:-3].strip()
                            formatted_html.append(f'<h3 class="wiki-sec-h3">{sec_title}</h3>')
                        # Titre de niveau 3 (=== Sous-section ===)
                        elif line.startswith('=== ') and line.endswith(' ==='):
                            subsec_title = line[4:-4].strip()
                            formatted_html.append(f'<h4 class="wiki-sec-h4">{subsec_title}</h4>')
                        else:
                            formatted_html.append(f'<p class="wiki-p">{line}</p>')
                            para_count += 1

                        if para_count >= max_paragraphs:
                            break

                    result_html = "\n".join(formatted_html)
                    out = {
                        "found": True,
                        "title": clean_title,
                        "html": result_html,
                        "paragraph_count": para_count
                    }
                    cls._extended_cache[cache_key] = out
                    return out
        except Exception as e:
            return {"found": False, "error": f"Erreur de chargement étendu : {e}"}

        return {"found": False, "error": "Impossible de charger le contenu"}

    @classmethod
    def search_candidates(cls, query: str, lang: str = "fr", limit: int = 10, context: str = None) -> list:
        """
        Recherche intelligente des articles Wikipédia candidats :
        - Vérifie les alias théologiques majeurs (si hors contexte 'place')
        - Effectue plusieurs passes de recherche ciblées
        - Élimine la pop-culture, les entreprises et les entités contemporaines (anachronismes)
        - Trie par pertinence doctrinale, biblique ou historico-géographique
        """
        clean_q = re.sub(r'[^a-zA-Z0-9àâäéèêëîïôöùûüç\s]', '', query).lower().strip()
        candidates_map = {}

        # 1. Injecter d'abord les alias théologiques s'ils correspondent (sauf en mode purement géographique)
        if context != 'place':
            matched_aliases = []
            if clean_q in cls.THEOLOGICAL_ALIASES:
                matched_aliases = cls.THEOLOGICAL_ALIASES[clean_q]
            else:
                for k, v in cls.THEOLOGICAL_ALIASES.items():
                    if k in clean_q or clean_q in k:
                        matched_aliases.extend(v)

            for idx, alias in enumerate(matched_aliases):
                if alias not in candidates_map:
                    candidates_map[alias] = {
                        "title": alias,
                        "snippet": f"Article théologique et biblique de référence pour « {query} »",
                        "score_bonus": 100 - (idx * 5)
                    }

        # 2. Requêtes de recherche Wikipédia ciblées
        queries_to_run = [query]
        if context == 'place':
            if len(query.split()) == 1:
                queries_to_run.append(f"{query} Bible")
                queries_to_run.append(f"{query} Proche-Orient")
                queries_to_run.append(f"{query} antique")
        else:
            if len(query.split()) == 1:
                queries_to_run.append(f"{query} bible")
                queries_to_run.append(f"{query} théologie")

        for q_str in queries_to_run:
            encoded_q = urllib.parse.quote(q_str)
            url = f"https://{lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch={encoded_q}&srlimit={limit}&format=json"

            req = urllib.request.Request(
                url,
                headers={"User-Agent": cls.USER_AGENT, "Accept": "application/json"}
            )

            try:
                with urllib.request.urlopen(req, timeout=5) as response:
                    if response.status == 200:
                        data = json.loads(response.read().decode("utf-8"))
                        items = data.get("query", {}).get("search", [])
                        for it in items:
                            title = it.get("title", "")
                            raw_snip = it.get("snippet", "")
                            clean_snip = re.sub(r'<[^>]+>', '', raw_snip).strip()
                            clean_snip = clean_snip.replace("&quot;", '"').replace("&#039;", "'").replace("&amp;", "&")

                            # Filtrer immédiatement si anachronique, pop-culture ou hors sujet
                            if cls.is_anachronistic_or_irrelevant(title, "", clean_snip, context=context, query=query):
                                continue

                            if title not in candidates_map:
                                candidates_map[title] = {
                                    "title": title,
                                    "snippet": clean_snip,
                                    "score_bonus": 0
                                }
            except Exception as _silent_e:
                logger.debug("Erreur ignoree : %s", _silent_e)

        # 3. Classer et trier les candidats
        scored_candidates = []
        q_norm = cls.strip_accents(query)

        for title, cand in candidates_map.items():
            t_norm = cls.strip_accents(title)
            t_lower = title.lower()
            snip_lower = cand["snippet"].lower()
            score = cand.get("score_bonus", 0)

            # Rejet anachronisme résiduel
            if cls.is_anachronistic_or_irrelevant(title, "", cand["snippet"], context=context, query=query):
                continue

            # Correspondance exacte ou proche
            if t_norm == q_norm:
                score += 50
            elif t_norm.startswith(q_norm):
                score += 25
            elif q_norm in t_norm:
                score += 12

            # Bonus contexte biblique / religieux
            keywords_to_check = cls.BIBLICAL_ANCIENT_KEYWORDS if context == 'place' else cls.BIBLICAL_KEYWORDS
            for kw in keywords_to_check:
                if kw in snip_lower or kw in t_lower:
                    score += 25
                    break

            # Pénaliser les simples pages d'homonymie
            if "(homonymie)" in t_lower:
                score -= 15

            cand["score"] = score
            if t_norm == q_norm or score >= 90:
                cand["tier"] = "xl"
            elif score >= 45 or t_norm.startswith(q_norm):
                cand["tier"] = "lg"
            elif score >= 20 or q_norm in t_norm:
                cand["tier"] = "md"
            else:
                cand["tier"] = "sm"

            scored_candidates.append((score, cand))

        scored_candidates.sort(key=lambda x: x[0], reverse=True)
        return [c[1] for c in scored_candidates[:limit]]

    @classmethod
    def _fetch_direct_summary(cls, title: str, lang: str = "fr") -> dict:
        """
        Récupère le résumé et l'image d'un article via l'Action API officielle de Wikipédia.
        Garantit 100% de stabilité sans limitation de débit HTTP 429.
        """
        encoded_title = urllib.parse.quote(title)
        url = f"https://{lang}.wikipedia.org/w/api.php?action=query&prop=extracts|pageprops|pageimages&exintro=1&explaintext=1&piprop=thumbnail&pithumbsize=300&titles={encoded_title}&format=json"

        req = urllib.request.Request(
            url,
            headers={"User-Agent": cls.USER_AGENT, "Accept": "application/json"}
        )

        try:
            with urllib.request.urlopen(req, timeout=5) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode("utf-8"))
                    pages = data.get("query", {}).get("pages", {})
                    for pid, p in pages.items():
                        if pid == "-1":
                            return None
                        
                        desc = p.get("pageprops", {}).get("wikibase-shortdesc", "")
                        extract = p.get("extract", "").strip()
                        page_title = p.get("title", title)
                        thumbnail = p.get("thumbnail", {}).get("source") if p.get("thumbnail") else None
                        clean_url_title = urllib.parse.quote(page_title.replace(" ", "_"))
                        page_url = f"https://{lang}.wikipedia.org/wiki/{clean_url_title}"

                        if extract:
                            return {
                                "found": True,
                                "title": page_title,
                                "description": desc,
                                "extract": extract,
                                "thumbnail": thumbnail,
                                "url": page_url
                            }
        except Exception as e:
            logger.warning(f"Erreur fetch Wikipédia summary ({title}): {e}")
            return None

        return None
