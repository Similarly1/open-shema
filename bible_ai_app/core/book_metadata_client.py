import os
import re
import json
import logging
import urllib.parse
import urllib.request
import requests
from typing import List, Dict, Optional, Any

logger = logging.getLogger(__name__)

COVERS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "covers")

class BookMetadataClient:
    """
    Client de recherche de métadonnées bibliographiques.
    Interroge l'API Google Books en priorité (avec clé API optionnelle)
    et bascule automatiquement sur Open Library si Google Books est indisponible ou bridé.
    """

    @staticmethod
    def _sanitize_filename(name: str) -> str:
        """Nettoie une chaîne pour en faire un nom de fichier valide."""
        clean = re.sub(r'[\\/*?:"<>|]', "", name)
        clean = clean.replace(" ", "_").strip("._")
        return clean[:50] if clean else "book_cover"

    @classmethod
    def search_books(
        cls,
        query: str,
        author: str = "",
        title: str = "",
        isbn: str = "",
        api_key: Optional[str] = None,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Recherche des ouvrages par mot-clé, titre, auteur ou ISBN.
        Retourne une liste de dictionnaires normalisés.
        """
        results: List[Dict[str, Any]] = []
        cleaned_query = (query or "").strip()
        
        # 1. Tentative Google Books API
        try:
            gb_results = cls._search_google_books(
                query=cleaned_query,
                author=author.strip(),
                title=title.strip(),
                isbn=isbn.strip(),
                api_key=api_key,
                limit=limit
            )
            if gb_results:
                results.extend(gb_results)
        except Exception as e:
            logger.warning("Erreur lors de la recherche Google Books : %s", e)

        # 2. Si moins de résultats, compléter via Open Library
        if len(results) < limit:
            try:
                ol_results = cls._search_open_library(
                    query=cleaned_query or f"{title} {author}".strip(),
                    limit=limit - len(results)
                )
                # Éviter les doublons stricts par titre
                seen_titles = {r["title"].lower().strip() for r in results}
                for r in ol_results:
                    if r["title"].lower().strip() not in seen_titles:
                        results.append(r)
                        seen_titles.add(r["title"].lower().strip())
            except Exception as e:
                logger.warning("Erreur lors de la recherche Open Library : %s", e)

        # 3. Compléter via Internet Archive pour trouver des couvertures supplémentaires
        if len(results) < limit or not any(r.get("cover_url") for r in results):
            try:
                ia_results = cls._search_internet_archive(
                    query=cleaned_query or f"{title} {author}".strip(),
                    limit=min(4, limit)
                )
                seen_titles = {r["title"].lower().strip() for r in results}
                for r in ia_results:
                    if r["title"].lower().strip() not in seen_titles:
                        results.append(r)
                        seen_titles.add(r["title"].lower().strip())
            except Exception as e:
                logger.warning("Erreur lors de la recherche Internet Archive : %s", e)

        return results[:limit]

    @classmethod
    def _search_google_books(
        cls,
        query: str,
        author: str = "",
        title: str = "",
        isbn: str = "",
        api_key: Optional[str] = None,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """Interroge l'API Google Books."""
        # Construction de la requête
        parts = []
        if isbn:
            parts.append(f"isbn:{isbn}")
        if title:
            parts.append(f"intitle:{title}")
        if author:
            parts.append(f"inauthor:{author}")
        if not parts and query:
            parts.append(query)

        final_query = " ".join(parts).strip()
        if not final_query:
            return []

        params = {
            "q": final_query,
            "maxResults": min(max(limit, 1), 20),
            "printType": "books",
        }
        if api_key:
            params["key"] = api_key

        url = f"https://www.googleapis.com/books/v1/volumes?{urllib.parse.urlencode(params)}"
        
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        resp = requests.get(url, headers=headers, timeout=8)
        
        if resp.status_code == 429:
            logger.info("Google Books quota dépassé (429), bascule vers Open Library.")
            return []
            
        resp.raise_for_status()
        data = resp.json()

        items = data.get("items", [])
        results = []
        for item in items:
            vol = item.get("volumeInfo", {})
            
            # Récupération de l'image de couverture haute résolution si dispo
            img_links = vol.get("imageLinks", {})
            cover_url = (
                img_links.get("extraLarge")
                or img_links.get("large")
                or img_links.get("medium")
                or img_links.get("thumbnail")
                or img_links.get("smallThumbnail")
                or ""
            )
            # Nettoyer l'URL de couverture Google Books
            if cover_url:
                cover_url = cover_url.replace("http://", "https://")
                cover_url = re.sub(r"&edge=curl", "", cover_url)
                if "zoom=" in cover_url:
                    cover_url = re.sub(r"zoom=\d+", "zoom=1", cover_url)

            # Année
            pub_date = vol.get("publishedDate", "")
            year = pub_date[:4] if (pub_date and len(pub_date) >= 4 and pub_date[:4].isdigit()) else pub_date

            # ISBN
            isbns = []
            for id_info in vol.get("industryIdentifiers", []):
                if "identifier" in id_info:
                    isbns.append(id_info["identifier"])
            isbn_str = ", ".join(isbns)

            authors = vol.get("authors", [])
            author_str = ", ".join(authors) if authors else ""

            # Titre & sous-titre
            raw_title = vol.get("title", "")
            subtitle = vol.get("subtitle", "")
            full_title = f"{raw_title}: {subtitle}" if (subtitle and subtitle not in raw_title) else raw_title

            results.append({
                "id": f"gb_{item.get('id', '')}",
                "source": "Google Books",
                "title": full_title or raw_title,
                "short_title": raw_title,
                "authors": authors,
                "author_str": author_str,
                "publisher": vol.get("publisher", ""),
                "published_date": pub_date,
                "year": year,
                "description": vol.get("description", ""),
                "isbn": isbn_str,
                "categories": vol.get("categories", []),
                "page_count": vol.get("pageCount"),
                "cover_url": cover_url,
                "language": vol.get("language", "fr")
            })

        return results

    @classmethod
    def _search_open_library(cls, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Interroge l'API Open Library (sans quota restrictif)."""
        if not query:
            return []

        url = "https://openlibrary.org/search.json"
        params = {
            "q": query,
            "fields": "key,title,author_name,first_publish_year,publisher,cover_i,cover_edition_key,isbn,subject,number_of_pages_median,language",
            "limit": min(max(limit, 1), 20)
        }
        headers = {
            "User-Agent": "BibleAIApp/1.0 (https://github.com/Similarly1/free-logos-ai)"
        }
        resp = requests.get(url, params=params, headers=headers, timeout=8)
        resp.raise_for_status()
        data = resp.json()

        docs = data.get("docs", [])
        results = []
        for doc in docs:
            title = doc.get("title", "")
            authors = doc.get("author_name", [])
            author_str = ", ".join(authors) if authors else ""
            year = str(doc.get("first_publish_year", "")) if doc.get("first_publish_year") else ""
            publishers = doc.get("publisher", [])
            publisher_str = publishers[0] if publishers else ""
            
            # Couverture Open Library : cover_i, cover_edition_key ou isbn
            cover_i = doc.get("cover_i")
            cover_edition_key = doc.get("cover_edition_key")
            isbns = doc.get("isbn", [])
            isbn_str = isbns[0] if isbns else ""

            cover_url = ""
            if cover_i:
                cover_url = f"https://covers.openlibrary.org/b/id/{cover_i}-L.jpg"
            elif cover_edition_key:
                cover_url = f"https://covers.openlibrary.org/b/olid/{cover_edition_key}-L.jpg"
            elif isbns:
                clean_isbn = re.sub(r'\D', '', str(isbns[0]))
                if clean_isbn:
                    cover_url = f"https://covers.openlibrary.org/b/isbn/{clean_isbn}-L.jpg"

            results.append({
                "id": f"ol_{doc.get('key', '').replace('/', '_')}",
                "source": "Open Library",
                "title": title,
                "short_title": title,
                "authors": authors,
                "author_str": author_str,
                "publisher": publisher_str,
                "published_date": year,
                "year": year,
                "description": "",
                "isbn": isbn_str,
                "categories": doc.get("subject", [])[:3] if doc.get("subject") else [],
                "page_count": doc.get("number_of_pages_median"),
                "cover_url": cover_url,
                "language": doc.get("language", ["fre"])[0] if doc.get("language") else "fr"
            })

        return results

    @classmethod
    def _search_internet_archive(cls, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        """Interroge l'API Internet Archive pour trouver des couvertures et métadonnées."""
        if not query:
            return []
            
        try:
            url = "https://archive.org/advancedsearch.php"
            params = {
                "q": f"{query} AND mediatype:texts",
                "fl[]": ["identifier", "title", "creator", "year", "publisher", "description"],
                "rows": min(max(limit, 1), 10),
                "output": "json"
            }
            resp = requests.get(url, params=params, timeout=6)
            if resp.status_code != 200:
                return []
                
            docs = resp.json().get("response", {}).get("docs", [])
            results = []
            for doc in docs:
                ident = doc.get("identifier")
                if not ident:
                    continue
                title = doc.get("title", "")
                creator = doc.get("creator", "")
                authors = [creator] if isinstance(creator, str) and creator else (creator if isinstance(creator, list) else [])
                author_str = ", ".join(authors) if authors else ""
                year = str(doc.get("year", "")) if doc.get("year") else ""
                
                results.append({
                    "id": f"ia_{ident}",
                    "source": "Internet Archive",
                    "title": title,
                    "short_title": title,
                    "authors": authors,
                    "author_str": author_str,
                    "publisher": doc.get("publisher", ""),
                    "published_date": year,
                    "year": year,
                    "description": doc.get("description", ""),
                    "isbn": "",
                    "categories": ["Bible / Théologie"],
                    "page_count": None,
                    "cover_url": f"https://archive.org/services/img/{ident}",
                    "language": "fr"
                })
            return results
        except Exception as e:
            logger.warning("Erreur Internet Archive : %s", e)
            return []

    @classmethod
    def download_cover_image(cls, cover_url: str, title_hint: str = "book") -> Optional[str]:
        """
        Télécharge une image de couverture distante et l'enregistre dans data/covers/.
        Retourne le chemin absolu du fichier téléchargé, ou None en cas d'échec.
        """
        if not cover_url or not cover_url.startswith("http"):
            return None

        os.makedirs(COVERS_DIR, exist_ok=True)
        safe_name = cls._sanitize_filename(title_hint)
        filename = f"{safe_name}.jpg"
        dest_path = os.path.join(COVERS_DIR, filename)

        # Si le fichier existe déjà, générer une variante unique
        counter = 1
        while os.path.exists(dest_path):
            filename = f"{safe_name}_{counter}.jpg"
            dest_path = os.path.join(COVERS_DIR, filename)
            counter += 1

        try:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
            }
            resp = requests.get(cover_url, headers=headers, timeout=12)
            if resp.status_code == 200 and len(resp.content) > 500:
                with open(dest_path, "wb") as f:
                    f.write(resp.content)
                logger.info("Couverture téléchargée avec succès : %s", dest_path)
                return os.path.abspath(dest_path)
            else:
                logger.warning("Échec téléchargement couverture : code %d", resp.status_code)
                return None
        except Exception as e:
            logger.error("Erreur téléchargement couverture (%s) : %s", cover_url, e)
            return None
