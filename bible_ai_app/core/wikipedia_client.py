import urllib.request
import urllib.parse
import json
import re

class WikipediaClient:
    """
    Client léger et asynchrone pour l'encyclopédie Wikipédia (en ligne).
    Récupère le résumé complet, la description et l'URL de l'article pour un terme donné.
    Comporte un cache en mémoire pour une réactivité instantanée (0 ms).
    """
    _cache = {}
    USER_AGENT = "BibleAIApp/1.0 (Educational Bible Study Tool; contact@bibleai.local)"

    @classmethod
    def get_summary(cls, query: str, lang: str = "fr") -> dict:
        """
        Récupère le résumé Wikipédia d'un terme.
        Retourne un dictionnaire avec :
        - 'title': Titre officiel de l'article
        - 'description': Sous-titre / description courte
        - 'extract': Texte d'introduction complet
        - 'url': Lien complet vers l'article web
        - 'thumbnail': URL de l'image (si disponible)
        - 'found': Booléen
        """
        if not query or not query.strip():
            return {"found": False, "error": "Requête vide"}

        clean_q = query.strip()
        cache_key = f"{lang}:{clean_q.lower()}"
        if cache_key in cls._cache:
            return cls._cache[cache_key]

        # 1. Tentative d'accès direct par le endpoint page/summary
        result = cls._fetch_direct_summary(clean_q, lang)
        
        # 2. Si non trouvé directement, recherche de secours via opensearch
        if not result or not result.get("found"):
            alt_title = cls._search_opensearch(clean_q, lang)
            if alt_title and alt_title.lower() != clean_q.lower():
                result = cls._fetch_direct_summary(alt_title, lang)

        if not result:
            result = {
                "found": False,
                "title": clean_q,
                "error": f"Aucun article Wikipédia trouvé pour « {clean_q} »."
            }

        cls._cache[cache_key] = result
        return result

    @classmethod
    def _fetch_direct_summary(cls, title: str, lang: str = "fr") -> dict:
        """Appelle l'API REST v1 summary de Wikipédia."""
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
                    
                    # Ignorer si c'est une simple page de désambiguïsation sans texte utile
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

    @classmethod
    def _search_opensearch(cls, query: str, lang: str = "fr") -> str:
        """Utilise OpenSearch pour trouver le titre exact le plus pertinent."""
        encoded_q = urllib.parse.quote(query)
        url = f"https://{lang}.wikipedia.org/w/api.php?action=opensearch&search={encoded_q}&limit=3&namespace=0&format=json"

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
                    # Format opensearch : [query, [titles...], [descriptions...], [urls...]]
                    if len(data) >= 2 and data[1]:
                        return data[1][0]  # Premier titre suggéré
        except Exception:
            pass

        return None
