import urllib.request
import urllib.parse
import json
import re
import unicodedata

class WikipediaClient:
    """
    Client asynchrone et intelligent pour l'encyclopédie Wikipédia (en ligne).
    - Recherche de candidats multiples (homonymes / variantes)
    - Classement contextuel (accentuation, contexte biblique/historique)
    - Résumé complet et extraction des métadonnées
    - Cache en mémoire pour zéro latence lors des réouvertures
    """
    _cache = {}
    USER_AGENT = "BibleAIApp/1.0 (Educational Bible Study Tool; contact@bibleai.local)"

    BIBLICAL_KEYWORDS = {
        'bible', 'biblique', 'genèse', 'exode', 'lévitique', 'nombres', 'deutéronome',
        'évangile', 'apôtre', 'roi', 'israël', 'juda', 'jérusalem', 'temple', 'prophète',
        'dieu', 'jésus', 'christ', 'testament', 'torah', 'hébreu', 'chrétien', 'patriarche',
        'alliance', 'paradis', 'antiquité', 'mésopotamie', 'égypte', 'babylone', 'judée', 'église'
    }

    @classmethod
    def strip_accents(cls, text: str) -> str:
        if not text:
            return ""
        return ''.join(c for c in unicodedata.normalize('NFD', text) if unicodedata.category(c) != 'Mn').lower()

    @classmethod
    def get_summary(cls, query: str, exact_title: str = None, lang: str = "fr") -> dict:
        """
        Récupère le résumé Wikipédia d'un terme ou d'un titre exact.
        Retourne :
        - 'title': Titre officiel de l'article
        - 'description': Sous-titre / description courte
        - 'extract': Texte d'introduction complet
        - 'url': Lien complet vers l'article web
        - 'thumbnail': URL de l'image (si disponible)
        - 'candidates': Liste des autres articles homonymes/variantes [{'title': ..., 'snippet': ...}]
        - 'found': Booléen
        """
        if not query or not query.strip():
            return {"found": False, "error": "Requête vide"}

        clean_q = query.strip()
        target_title = exact_title.strip() if exact_title else None
        
        cache_key = f"{lang}:{target_title or clean_q.lower()}"
        if cache_key in cls._cache:
            return cls._cache[cache_key]

        # 1. Récupérer les candidats correspondants via l'API de recherche
        candidates = cls.search_candidates(clean_q, lang=lang, limit=8)

        # 2. Déterminer le meilleur titre d'article à charger
        chosen_title = target_title
        if not chosen_title:
            if candidates:
                ranked = cls.rank_candidates(clean_q, candidates)
                chosen_title = ranked[0]["title"]
            else:
                chosen_title = clean_q

        # 3. Charger le résumé complet de l'article retenu
        result = cls._fetch_direct_summary(chosen_title, lang)
        
        # 4. Si échec ou si c'est une simple page d'homonymie alors qu'un meilleur article existe
        if not result or not result.get("found") or result.get("type") == "disambiguation":
            for cand in candidates:
                if cand["title"] != chosen_title:
                    res_alt = cls._fetch_direct_summary(cand["title"], lang)
                    if res_alt and res_alt.get("found") and res_alt.get("type") != "disambiguation":
                        result = res_alt
                        chosen_title = cand["title"]
                        break

        if not result:
            result = {
                "found": False,
                "title": target_title or clean_q,
                "candidates": candidates,
                "error": f"Aucun article Wikipédia trouvé pour « {clean_q} »."
            }
        else:
            # Filtrer les candidats pour ne pas afficher en double l'article actuellement ouvert
            filtered_cands = [c for c in candidates if c["title"].lower() != result.get("title", "").lower()]
            result["candidates"] = filtered_cands
            result["search_query"] = clean_q

        cls._cache[cache_key] = result
        return result

    @classmethod
    def search_candidates(cls, query: str, lang: str = "fr", limit: int = 8) -> list:
        """Recherche les articles Wikipédia correspondants (homonymes, variantes)."""
        encoded_q = urllib.parse.quote(query)
        url = f"https://{lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch={encoded_q}&srlimit={limit}&format=json"

        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": cls.USER_AGENT,
                "Accept": "application/json"
            }
        )

        try:
            with urllib.request.urlopen(req, timeout=5) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode("utf-8"))
                    items = data.get("query", {}).get("search", [])
                    results = []
                    for it in items:
                        title = it.get("title", "")
                        raw_snip = it.get("snippet", "")
                        clean_snip = re.sub(r'<[^>]+>', '', raw_snip).strip()
                        clean_snip = clean_snip.replace("&quot;", '"').replace("&#039;", "'").replace("&amp;", "&")
                        results.append({
                            "title": title,
                            "snippet": clean_snip
                        })
                    return results
        except Exception:
            pass

        return []

    @classmethod
    def rank_candidates(cls, query: str, candidates: list) -> list:
        """
        Trie intelligemment les candidats :
        - Favorise les formes accentuées correctes (ex: 'Éden' vs 'EDEN')
        - Favorise le contexte biblique / historique / religieux
        - Conserve la pertinence globale de recherche Wikipédia
        """
        if not candidates:
            return []

        scored = []
        q_norm = cls.strip_accents(query)
        has_accents = any(ch in query for ch in "éèêëàâäîïôöùûüç")

        for idx, c in enumerate(candidates):
            score = 0
            t = c["title"]
            t_norm = cls.strip_accents(t)
            t_lower = t.lower()
            snip_lower = c["snippet"].lower()

            # Normalisation sans accent
            if t_norm == q_norm:
                score += 15
                # Si le titre comporte des accents et la requête n'en avait pas (ex: 'Éden' pour 'EDEN')
                if not has_accents and any(ch in t for ch in "éèêëàâäîïôöùûüç"):
                    score += 8
                # Si c'est exactement la même casse
                if t == query:
                    score += 2
            elif t_norm.startswith(q_norm):
                score += 8
            elif q_norm in t_norm:
                score += 4

            # Détection de pertinence biblique / historique
            for kw in cls.BIBLICAL_KEYWORDS:
                if kw in snip_lower or kw in t_lower:
                    score += 6
                    break

            # Pénaliser les pages d'homonymie ou les sujets modernes très éloignés
            if "(homonymie)" in t_lower or "homonymie" in snip_lower:
                score -= 4
            if "série télévisée" in snip_lower or "film de" in snip_lower or "football" in snip_lower:
                score -= 5

            # Bonus d'ordre initial renvoyé par l'API
            score += max(0, 5 - idx)
            scored.append((score, c))

        scored.sort(key=lambda x: x[0], reverse=True)
        return [item[1] for item in scored]

    @classmethod
    def _fetch_direct_summary(cls, title: str, lang: str = "fr") -> dict:
        """Appelle l'API REST v1 summary de Wikipédia pour un titre précis."""
        encoded_title = urllib.parse.quote(title.replace(" ", "_"))
        url = f"https://{lang}.wikipedia.org/api/rest_v1/page/summary/{encoded_title}"

        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": cls.USER_AGENT,
                "Accept": "application/json"
            }
        )

        try:
            with urllib.request.urlopen(req, timeout=5) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode("utf-8"))
                    
                    page_type = data.get("type", "")
                    extract = data.get("extract", "").strip()
                    page_title = data.get("title", title)
                    description = data.get("description", "")
                    page_url = data.get("content_urls", {}).get("desktop", {}).get("page", f"https://{lang}.wikipedia.org/wiki/{encoded_title}")
                    thumbnail = data.get("thumbnail", {}).get("source") if data.get("thumbnail") else None

                    if extract:
                        return {
                            "found": True,
                            "title": page_title,
                            "description": description,
                            "extract": extract,
                            "url": page_url,
                            "thumbnail": thumbnail,
                            "type": page_type
                        }
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
        except Exception as e:
            return {"found": False, "error": f"Erreur de connexion : {e}"}

        return None
