import os
import re
import json
import logging
import urllib.parse
import urllib.request
import concurrent.futures
import xml.etree.ElementTree as ET
import requests
from typing import List, Dict, Optional, Any

logger = logging.getLogger(__name__)

COVERS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "covers")

DEFAULT_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 BibleAIApp/1.0"


def clean_html_tags(raw_html: str) -> str:
    """Nettoie les balises HTML et décode les entités d'une description."""
    if not raw_html:
        return ""
    import html
    text = re.sub(r'<(?:br|p|div|li)[^>]*>', '\n', raw_html, flags=re.I)
    text = re.sub(r'<[^>]+>', '', text)
    text = html.unescape(text)
    text = re.sub(r'\n\s*\n+', '\n\n', text)
    text = re.sub(r'[ \t]+', ' ', text)
    return text.strip()


_SEARCH_EXECUTOR = concurrent.futures.ThreadPoolExecutor(max_workers=12)

# =============================================================================
# REGISTRE CURATÉ DES VERSIONS BIBLIQUES (RÉSOLUTION INSTANTANÉE & COUVERTURES HD)
# =============================================================================
BIBLE_VERSIONS_REGISTRY = [
    {
        "id": "bible_s21",
        "keywords": ["s21", "segond 21", "segond21", "bible segond 21", "societe biblique de geneve"],
        "source": "Société Biblique de Genève",
        "source_badge": "Bible S21",
        "source_badge_color": "#2563EB",
        "title": "Bible Segond 21 (Avec notes de référence)",
        "short_title": "S21",
        "authors": ["Société Biblique de Genève"],
        "author_str": "Société Biblique de Genève",
        "publisher": "Société Biblique de Genève",
        "published_date": "2007",
        "year": "2007",
        "description": "La Bible Segond 21 est une traduction de référence éditée par la Société Biblique de Genève, proposant le texte classique de Louis Segond avec le vocabulaire français contemporain.",
        "isbn": "9782608123015",
        "categories": ["Bible"],
        "cover_url": "https://covers.openlibrary.org/b/id/8315998-L.jpg"
    },
    {
        "id": "bible_bds",
        "keywords": ["bds", "semeur", "bible du semeur", "bible semeur", "alfred kuen", "excelsis"],
        "source": "Société Biblique Internationale",
        "source_badge": "Bible du Semeur",
        "source_badge_color": "#0284C7",
        "title": "La Bible du Semeur (Édition d'étude)",
        "short_title": "BDS",
        "authors": ["Biblica", "Alfred Kuen"],
        "author_str": "Biblica (Alfred Kuen)",
        "publisher": "Excelsis / Biblica",
        "published_date": "2015",
        "year": "2015",
        "description": "Traduction à équivalence dynamique d'une grande clarté littéraire, particulièrement appréciée pour la lecture continue et la prédication.",
        "isbn": "9782853006095",
        "categories": ["Bible"],
        "cover_url": "https://covers.openlibrary.org/b/id/8315998-L.jpg"
    },
    {
        "id": "bible_lsg1910",
        "keywords": ["lsg", "segond 1910", "louis segond", "segond", "lsg1910", "bible segond", "1910"],
        "source": "Société Biblique Française",
        "source_badge": "Bible LSG 1910",
        "source_badge_color": "#059669",
        "title": "Sainte Bible - Traduction Louis Segond 1910",
        "short_title": "LSG 1910",
        "authors": ["Louis Segond"],
        "author_str": "Louis Segond",
        "publisher": "Société Biblique Française",
        "published_date": "1910",
        "year": "1910",
        "description": "La version protestante francophone historique la plus lue et la plus citée dans le monde évangélique et réformé.",
        "isbn": "9782853000000",
        "categories": ["Bible"],
        "cover_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/17/La_Sainte_Bible%2C_trad._Segond%2C_ed._1910.djvu/page1-500px-La_Sainte_Bible%2C_trad._Segond%2C_ed._1910.djvu.jpg"
    },
    {
        "id": "bible_bj",
        "keywords": ["bj", "jerusalem", "jérusalem", "bible de jerusalem", "bible de jérusalem", "cerf"],
        "source": "Éditions du Cerf",
        "source_badge": "Bible de Jérusalem",
        "source_badge_color": "#991B1B",
        "title": "La Bible de Jérusalem (Nouvelle édition révisée)",
        "short_title": "BJ",
        "authors": ["École Biblique de Jérusalem"],
        "author_str": "École Biblique de Jérusalem",
        "publisher": "Éditions du Cerf",
        "published_date": "1998",
        "year": "1998",
        "description": "Chef-d'œuvre de l'exégèse catholique moderne, renommée pour ses introductions détaillées et son apparat critique.",
        "isbn": "9782204060639",
        "categories": ["Bible"],
        "cover_url": "https://upload.wikimedia.org/wikipedia/commons/1/11/Bible_de_Jerusalem.jpg"
    },
    {
        "id": "bible_tob",
        "keywords": ["tob", "oecumenique", "œcuménique", "traduction oecumenique", "traduction œcuménique"],
        "source": "Cerf / Bibli'O",
        "source_badge": "Bible TOB",
        "source_badge_color": "#D97706",
        "title": "Traduction Œcuménique de la Bible (TOB)",
        "short_title": "TOB",
        "authors": ["Société Biblique Française", "Éditions du Cerf"],
        "author_str": "Comité Œcuménique",
        "publisher": "Cerf / Bibli'O",
        "published_date": "2010",
        "year": "2010",
        "description": "Première traduction conjointe réalisée par des spécialistes catholiques, protestants et orthodoxes.",
        "isbn": "9782204094122",
        "categories": ["Bible"],
        "cover_url": "https://upload.wikimedia.org/wikipedia/commons/0/01/TOB_note.jpg"
    },
    {
        "id": "bible_nbs",
        "keywords": ["nbs", "nouvelle bible segond", "nouvelle segond"],
        "source": "Bibli'O",
        "source_badge": "Bible NBS",
        "source_badge_color": "#4F46E5",
        "title": "Nouvelle Bible Segond (Édition d'étude NBS)",
        "short_title": "NBS",
        "authors": ["Société Biblique Française"],
        "author_str": "Société Biblique Française",
        "publisher": "Bibli'O",
        "published_date": "2002",
        "year": "2002",
        "description": "Révision rigoureuse à équivalence formelle maximale avec notes d'étude philologiques approfondies.",
        "isbn": "9782853001878",
        "categories": ["Bible"],
        "cover_url": "https://covers.openlibrary.org/b/id/8315998-L.jpg"
    },
    {
        "id": "bible_nfc",
        "keywords": ["nfc", "francais courant", "français courant", "nouvelle francais courant", "nouvelle français courant"],
        "source": "Bibli'O",
        "source_badge": "Bible NFC",
        "source_badge_color": "#0D9488",
        "title": "Nouvelle Français Courant (NFC)",
        "short_title": "NFC",
        "authors": ["Société Biblique Française"],
        "author_str": "Société Biblique Française",
        "publisher": "Bibli'O",
        "published_date": "2019",
        "year": "2019",
        "description": "Traduction interconfessionnelle en langage clair et accessible pour un large public contemporain.",
        "isbn": "9782853007429",
        "categories": ["Bible"],
        "cover_url": "https://covers.openlibrary.org/b/id/8315998-L.jpg"
    },
    {
        "id": "bible_darby",
        "keywords": ["darby", "drb", "bible darby", "j.n. darby"],
        "source": "Bibles & Publications Chrétiennes",
        "source_badge": "Bible Darby",
        "source_badge_color": "#7C2D12",
        "title": "Sainte Bible - Traduction John Nelson Darby",
        "short_title": "Darby",
        "authors": ["John Nelson Darby"],
        "author_str": "J.N. Darby",
        "publisher": "BPC Valence",
        "published_date": "1885",
        "year": "1885",
        "description": "Traduction littérale d'une précision extrême, respectant scrupuleusement la structure des langues originales hébraïque et grecque.",
        "isbn": "9782900325148",
        "categories": ["Bible"],
        "cover_url": "https://upload.wikimedia.org/wikipedia/commons/7/76/John_Nelson_Darby_1870.jpg"
    },
    {
        "id": "bible_crampon",
        "keywords": ["crampon", "cra", "bible crampon", "augustin crampon"],
        "source": "Société de Saint-Jean l'Évangéliste",
        "source_badge": "Bible Crampon",
        "source_badge_color": "#831843",
        "title": "La Sainte Bible - Chanoine Augustin Crampon (1923)",
        "short_title": "Crampon",
        "authors": ["Augustin Crampon"],
        "author_str": "Augustin Crampon",
        "publisher": "Desclée & Cie",
        "published_date": "1923",
        "year": "1923",
        "description": "La première traduction catholique moderne directement réalisée sur les textes originaux hébreu, araméen et grec.",
        "isbn": "9782856522332",
        "categories": ["Bible"],
        "cover_url": "https://upload.wikimedia.org/wikipedia/commons/7/7c/Augustin_Crampon.jpg"
    },
    {
        "id": "bible_martin",
        "keywords": ["martin", "david martin", "bible martin", "martin 1744"],
        "source": "Patrimoine Protestant",
        "source_badge": "Bible Martin 1744",
        "source_badge_color": "#374151",
        "title": "La Sainte Bible - Pasteur David Martin (1744)",
        "short_title": "Martin 1744",
        "authors": ["David Martin"],
        "author_str": "David Martin",
        "publisher": "Patrimoine Protestant",
        "published_date": "1744",
        "year": "1744",
        "description": "La grande révision du XVIIIe siècle de la Bible de Genève, monument du protestantisme francophone.",
        "isbn": "",
        "categories": ["Bible"],
        "cover_url": "https://upload.wikimedia.org/wikipedia/commons/7/74/Photo_Bible_David_Martin_1744.jpg"
    },
    {
        "id": "bible_ostervald",
        "keywords": ["ostervald", "osterwald", "bible ostervald", "jean-frederic ostervald"],
        "source": "Société Biblique de France",
        "source_badge": "Bible Ostervald",
        "source_badge_color": "#1E3A8A",
        "title": "La Sainte Bible - Jean-Frédéric Ostervald (1779)",
        "short_title": "Ostervald",
        "authors": ["Jean-Frédéric Ostervald"],
        "author_str": "J.-F. Ostervald",
        "publisher": "Société Biblique",
        "published_date": "1779",
        "year": "1779",
        "description": "Traduction historique neuchâteloise très répandue dans les familles chrétiennes francophones.",
        "isbn": "",
        "categories": ["Bible"],
        "cover_url": "https://upload.wikimedia.org/wikipedia/commons/7/74/Photo_Bible_David_Martin_1744.jpg"
    },
    {
        "id": "bible_kjv",
        "keywords": ["kjv", "king james", "king james version", "authorized version"],
        "source": "Oxford University Press",
        "source_badge": "King James (KJV)",
        "source_badge_color": "#581C87",
        "title": "The Holy Bible - King James Version (KJV)",
        "short_title": "KJV",
        "authors": ["King James Translation Committee"],
        "author_str": "King James Translators",
        "publisher": "Oxford University Press",
        "published_date": "1611",
        "year": "1611",
        "description": "The landmark 1611 English Bible translation authorized by King James I.",
        "isbn": "9780199535941",
        "categories": ["Bible"],
        "cover_url": "https://upload.wikimedia.org/wikipedia/commons/5/5d/KJV-King-James-Version-Bible.jpg"
    },
    {
        "id": "bible_esv",
        "keywords": ["esv", "english standard", "english standard version", "crossway"],
        "source": "Crossway",
        "source_badge": "Bible ESV",
        "source_badge_color": "#1E293B",
        "title": "The Holy Bible - English Standard Version (ESV)",
        "short_title": "ESV",
        "authors": ["Crossway Translation Oversight Committee"],
        "author_str": "Crossway",
        "publisher": "Crossway",
        "published_date": "2001",
        "year": "2001",
        "description": "Essentially literal Bible translation that emphasizes word-for-word accuracy and literary excellence.",
        "isbn": "9781433558436",
        "categories": ["Bible"],
        "cover_url": "https://covers.openlibrary.org/b/id/12882583-L.jpg"
    }
]


class BookMetadataClient:
    """
    Client de recherche de métadonnées et couvertures bibliographiques multi-sources.
    Interroge en parallèle :
    1. Registre curaté des Bibles officielles (résolution instantanée & HD)
    2. Google Books API (catalogue contemporain)
    3. Open Library Covers & Search API (catalogue mondial ouvert & ISBN 2-step lookup)
    4. BnF Gallica SRU API (éditions françaises historiques, bibles anciennes, fac-similés)
    5. Internet Archive Search API (grands commentaires exégétiques et textes libres)
    6. Wikipédia / Wikimedia Commons API (œuvres majeures et bibles historiques)
    """

    @staticmethod
    def _sanitize_filename(name: str) -> str:
        """Nettoie une chaîne pour en faire un nom de fichier valide."""
        clean = re.sub(r'[\\/*?:"<>|]', "", name)
        clean = clean.replace(" ", "_").strip("._")
        return clean[:60] if clean else "book_cover"

    @classmethod
    def search_books(
        cls,
        query: str,
        author: str = "",
        title: str = "",
        isbn: str = "",
        api_key: Optional[str] = None,
        limit: int = 15
    ) -> List[Dict[str, Any]]:
        """
        Recherche multi-sources en parallèle avec résolution dédiée pour les Bibles.
        Agrège, dédoublonne et classe les résultats par pertinence visuelle.
        """
        cleaned_query = (query or "").strip()
        cleaned_title = (title or "").strip()
        cleaned_author = (author or "").strip()
        cleaned_isbn = (isbn or "").strip()

        if not cleaned_query and not cleaned_title and not cleaned_isbn:
            return []

        search_text = cleaned_query or f"{cleaned_title} {cleaned_author}".strip()
        search_norm = re.sub(r'[^\w\s]', '', search_text.lower()).strip()

        all_results: List[Dict[str, Any]] = []

        # 1. ÉTAPE 1 : Vérification dans le registre curaté des Bibles (Priorité absolue)
        for bible in BIBLE_VERSIONS_REGISTRY:
            for kw in bible.get("keywords", []):
                if kw in search_norm or search_norm in kw or (len(search_norm) >= 2 and kw == search_norm):
                    all_results.append(dict(bible))
                    break

        # 2. ÉTAPE 2 : Requêtes parallèles sur les 5 catalogues en ligne
        tasks = [
            _SEARCH_EXECUTOR.submit(cls._search_google_books, query=cleaned_query, author=cleaned_author, title=cleaned_title, isbn=cleaned_isbn, api_key=api_key, limit=8),
            _SEARCH_EXECUTOR.submit(cls._search_open_library, query=search_text, author=cleaned_author, title=cleaned_title, isbn=cleaned_isbn, limit=8),
            _SEARCH_EXECUTOR.submit(cls._search_bnf_gallica, query=search_text, author=cleaned_author, title=cleaned_title, limit=8),
            _SEARCH_EXECUTOR.submit(cls._search_internet_archive, query=search_text, author=cleaned_author, title=cleaned_title, limit=6),
            _SEARCH_EXECUTOR.submit(cls._search_wikipedia, query=cleaned_title or cleaned_query, limit=3)
        ]

        done, _ = concurrent.futures.wait(tasks, timeout=3.5)
        for future in done:
            try:
                res = future.result()
                if res:
                    all_results.extend(res)
            except Exception as e:
                logger.debug("Erreur résultat tâche recherche métadonnées: %s", e)

        # 3. ÉTAPE 3 : Dédoublonnage intelligent & tri
        seen_keys = set()
        deduped: List[Dict[str, Any]] = []

        # Priorité : résultats avec couverture haute résolution d'abord
        all_results.sort(key=lambda r: (2 if r.get("id", "").startswith("bible_") else (1 if r.get("cover_url") else 0), 1 if r.get("description") else 0), reverse=True)

        for item in all_results:
            title_norm = re.sub(r'\W+', '', (item.get("title") or "").lower())[:40]
            author_norm = re.sub(r'\W+', '', (item.get("author_str") or "").lower())[:25]
            key = f"{title_norm}_{author_norm}"
            
            if key in seen_keys:
                continue
            seen_keys.add(key)
            deduped.append(item)

        return deduped[:limit]

    # =========================================================================
    # 1. GOOGLE BOOKS
    # =========================================================================

    @classmethod
    def _search_google_books(
        cls,
        query: str,
        author: str = "",
        title: str = "",
        isbn: str = "",
        api_key: Optional[str] = None,
        limit: int = 8
    ) -> List[Dict[str, Any]]:
        """Interroge l'API Google Books."""
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
        headers = {"User-Agent": DEFAULT_USER_AGENT}
        try:
            resp = requests.get(url, headers=headers, timeout=5)
            if resp.status_code != 200:
                return []
            data = resp.json()
        except Exception:
            return []

        items = data.get("items", [])
        results = []
        for item in items:
            vol = item.get("volumeInfo", {})
            img_links = vol.get("imageLinks", {})
            cover_url = (
                img_links.get("extraLarge")
                or img_links.get("large")
                or img_links.get("medium")
                or img_links.get("thumbnail")
                or img_links.get("smallThumbnail")
                or ""
            )
            if cover_url:
                cover_url = cover_url.replace("http://", "https://")
                cover_url = re.sub(r"&edge=curl", "", cover_url)
                if "zoom=" in cover_url:
                    cover_url = re.sub(r"zoom=\d+", "zoom=1", cover_url)

            pub_date = vol.get("publishedDate", "")
            year = pub_date[:4] if (pub_date and len(pub_date) >= 4 and pub_date[:4].isdigit()) else pub_date

            isbns = []
            for id_info in vol.get("industryIdentifiers", []):
                if "identifier" in id_info:
                    isbns.append(id_info["identifier"])
            isbn_str = ", ".join(isbns)

            authors = vol.get("authors", [])
            author_str = ", ".join(authors) if authors else ""

            raw_title = vol.get("title", "")
            subtitle = vol.get("subtitle", "")
            full_title = f"{raw_title}: {subtitle}" if (subtitle and subtitle not in raw_title) else raw_title

            results.append({
                "id": f"gb_{item.get('id', '')}",
                "source": "Google Books",
                "source_badge": "Google Books",
                "source_badge_color": "#2563EB",
                "title": full_title or raw_title,
                "short_title": raw_title,
                "authors": authors,
                "author_str": author_str,
                "publisher": vol.get("publisher", ""),
                "published_date": pub_date,
                "year": year,
                "description": clean_html_tags(vol.get("description", "")),
                "isbn": isbn_str,
                "categories": vol.get("categories", []),
                "page_count": vol.get("pageCount"),
                "cover_url": cover_url,
                "language": vol.get("language", "fr")
            })

        return results

    # =========================================================================
    # 2. OPEN LIBRARY (INTERNET ARCHIVE)
    # =========================================================================

    @classmethod
    def _search_open_library(
        cls,
        query: str,
        author: str = "",
        title: str = "",
        isbn: str = "",
        limit: int = 8
    ) -> List[Dict[str, Any]]:
        """Interroge l'API Open Library (Search & Covers)."""
        params = {
            "fields": "key,title,author_name,first_publish_year,publisher,cover_i,cover_edition_key,isbn,subject,number_of_pages_median,language",
            "limit": min(max(limit, 1), 15)
        }
        if isbn:
            params["isbn"] = isbn
        elif title or author:
            if title:
                params["title"] = title
            if author:
                params["author"] = author
        elif query:
            params["q"] = query

        url = "https://openlibrary.org/search.json"
        headers = {"User-Agent": DEFAULT_USER_AGENT}
        try:
            resp = requests.get(url, params=params, headers=headers, timeout=5)
            if resp.status_code != 200:
                return []
            data = resp.json()
        except Exception:
            return []

        docs = data.get("docs", [])
        results = []
        for doc in docs:
            t = doc.get("title", "")
            authors = doc.get("author_name", [])
            author_str = ", ".join(authors) if authors else ""
            year = str(doc.get("first_publish_year", "")) if doc.get("first_publish_year") else ""
            publishers = doc.get("publisher", [])
            publisher_str = publishers[0] if publishers else ""

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
                "source_badge": "Open Library",
                "source_badge_color": "#D97706",
                "title": t,
                "short_title": t,
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

    # =========================================================================
    # 3. BNF GALLICA (BIBLIOTHÈQUE NATIONALE DE FRANCE - SRU DUBLIN CORE)
    # =========================================================================

    @classmethod
    def _search_bnf_gallica(
        cls,
        query: str,
        author: str = "",
        title: str = "",
        limit: int = 8
    ) -> List[Dict[str, Any]]:
        """Interroge l'API SRU de la BnF pour les ouvrages et bibles patrimoniaux en français."""
        try:
            clean_t = re.sub(r'["\\]', ' ', title).strip()
            clean_a = re.sub(r'["\\]', ' ', author).strip()
            clean_q = re.sub(r'["\\]', ' ', query).strip()

            if clean_t and clean_a:
                cql = f'bib.title all "{clean_t}" and bib.author all "{clean_a}"'
            elif clean_t:
                cql = f'bib.title all "{clean_t}"'
            elif clean_q:
                cql = f'bib.anywhere all "{clean_q}"'
            else:
                return []

            url = "https://catalogue.bnf.fr/api/SRU"
            params = {
                "version": "1.2",
                "operation": "searchRetrieve",
                "query": cql,
                "recordSchema": "dublincore",
                "maximumRecords": min(max(limit, 1), 10)
            }
            resp = requests.get(url, params=params, headers={"User-Agent": DEFAULT_USER_AGENT}, timeout=5)
            if resp.status_code != 200:
                return []

            root = ET.fromstring(resp.content)
            ns = {
                'srw': 'http://www.loc.gov/zing/srw/',
                'dc': 'http://purl.org/dc/elements/1.1/'
            }

            results = []
            for rec in root.findall('.//srw:record', ns):
                titles = rec.findall('.//dc:title', ns)
                creators = rec.findall('.//dc:creator', ns)
                dates = rec.findall('.//dc:date', ns)
                publishers = rec.findall('.//dc:publisher', ns)
                descriptions = rec.findall('.//dc:description', ns)
                identifiers = rec.findall('.//dc:identifier', ns)

                t = titles[0].text.strip() if titles and titles[0].text else ""
                if not t:
                    continue

                authors = [c.text.strip() for c in creators if c.text]
                author_str = ", ".join(authors)
                d = dates[0].text.strip() if dates and dates[0].text else ""
                year = d[:4] if (d and len(d) >= 4 and d[:4].isdigit()) else d
                pub = publishers[0].text.strip() if publishers and publishers[0].text else ""
                desc = descriptions[0].text.strip() if descriptions and descriptions[0].text else ""

                ark = next((i.text for i in identifiers if i.text and ('bpt6k' in i.text or 'btv1b' in i.text or 'gallica.bnf.fr' in i.text)), None)
                cover_url = ""
                if ark:
                    ark_clean = ark[ark.find('ark:/12148/'):].strip()
                    cover_url = f"https://gallica.bnf.fr/{ark_clean}/f1.highres"

                results.append({
                    "id": f"bnf_{ark.replace('/', '_') if ark else abs(hash(t))}",
                    "source": "BnF Gallica",
                    "source_badge": "BnF Gallica",
                    "source_badge_color": "#991B1B",
                    "title": t,
                    "short_title": t.split(':')[0].strip(),
                    "authors": authors,
                    "author_str": author_str,
                    "publisher": pub,
                    "published_date": d,
                    "year": year,
                    "description": clean_html_tags(desc),
                    "isbn": "",
                    "categories": ["Théologie / Patrimoine Français"],
                    "page_count": None,
                    "cover_url": cover_url,
                    "language": "fr"
                })

            return results
        except Exception as e:
            logger.debug("Erreur BnF SRU: %s", e)
            return []

    # =========================================================================
    # 4. INTERNET ARCHIVE SEARCH
    # =========================================================================

    @classmethod
    def _search_internet_archive(
        cls,
        query: str,
        author: str = "",
        title: str = "",
        limit: int = 6
    ) -> List[Dict[str, Any]]:
        """Interroge l'API Internet Archive pour trouver des textes théologiques libres."""
        try:
            q_parts = []
            if title:
                q_parts.append(f"title:({title})")
            if author:
                q_parts.append(f"creator:({author})")
            if not q_parts and query:
                q_parts.append(f"title:({query}) OR creator:({query})")

            q_str = f"({' AND '.join(q_parts)}) AND mediatype:texts"
            url = "https://archive.org/advancedsearch.php"
            params = {
                "q": q_str,
                "fl[]": ["identifier", "title", "creator", "year", "publisher", "description"],
                "rows": min(max(limit, 1), 10),
                "output": "json"
            }
            resp = requests.get(url, params=params, headers={"User-Agent": DEFAULT_USER_AGENT}, timeout=5)
            if resp.status_code != 200:
                return []

            docs = resp.json().get("response", {}).get("docs", [])
            results = []
            for doc in docs:
                ident = doc.get("identifier")
                if not ident:
                    continue
                t = doc.get("title", "")
                creator = doc.get("creator", "")
                authors = [creator] if isinstance(creator, str) and creator else (creator if isinstance(creator, list) else [])
                author_str = ", ".join(authors) if authors else ""
                year = str(doc.get("year", "")) if doc.get("year") else ""

                results.append({
                    "id": f"ia_{ident}",
                    "source": "Internet Archive",
                    "source_badge": "Internet Archive",
                    "source_badge_color": "#059669",
                    "title": t,
                    "short_title": t,
                    "authors": authors,
                    "author_str": author_str,
                    "publisher": doc.get("publisher", ""),
                    "published_date": year,
                    "year": year,
                    "description": clean_html_tags(doc.get("description", "")),
                    "isbn": "",
                    "categories": ["Bible / Domaine Public"],
                    "page_count": None,
                    "cover_url": f"https://archive.org/services/img/{ident}",
                    "language": "fr"
                })
            return results
        except Exception as e:
            logger.debug("Erreur Internet Archive: %s", e)
            return []

    # =========================================================================
    # 5. WIKIPÉDIA / WIKIMEDIA COMMONS
    # =========================================================================

    @classmethod
    def _search_wikipedia(cls, query: str, limit: int = 3) -> List[Dict[str, Any]]:
        """Interroge l'API REST de Wikipédia pour les œuvres emblématiques."""
        if not query:
            return []
        try:
            clean_q = query.replace(" ", "_")
            url = f"https://fr.wikipedia.org/api/rest_v1/page/summary/{urllib.parse.quote(clean_q)}"
            resp = requests.get(url, headers={"User-Agent": DEFAULT_USER_AGENT}, timeout=4)
            results = []
            if resp.status_code == 200:
                d = resp.json()
                img = d.get("originalimage", {}).get("source") or d.get("thumbnail", {}).get("source") or ""
                t = d.get("title", "")
                if t and (img or d.get("extract")):
                    results.append({
                        "id": f"wiki_{d.get('pageid', abs(hash(t)))}",
                        "source": "Wikipédia",
                        "source_badge": "Wikipédia",
                        "source_badge_color": "#6366F1",
                        "title": t,
                        "short_title": t,
                        "authors": [],
                        "author_str": "Notice Encyclopédique",
                        "publisher": "Wikipédia",
                        "published_date": "",
                        "year": "",
                        "description": clean_html_tags(d.get("extract", "")),
                        "isbn": "",
                        "categories": ["Article Encyclopédique"],
                        "page_count": None,
                        "cover_url": img,
                        "language": "fr"
                    })
            return results
        except Exception:
            return []

    # =========================================================================
    # TÉLÉCHARGEMENT LOCAL DE LA COUVERTURE
    # =========================================================================

    @classmethod
    def download_cover_image(cls, cover_url: str, title_hint: str = "book") -> Optional[str]:
        """
        Télécharge une image de couverture distante et l'enregistre dans data/covers/.
        Retourne le chemin absolu du fichier téléchargé, ou None en cas d'échec.
        """
        if not cover_url or not str(cover_url).startswith("http"):
            return None

        os.makedirs(COVERS_DIR, exist_ok=True)
        safe_name = cls._sanitize_filename(title_hint)
        filename = f"{safe_name}.jpg"
        dest_path = os.path.join(COVERS_DIR, filename)

        try:
            headers = {"User-Agent": DEFAULT_USER_AGENT}
            resp = requests.get(cover_url, headers=headers, timeout=12)
            if resp.status_code == 200 and len(resp.content) > 400:
                with open(dest_path, "wb") as f:
                    f.write(resp.content)
                logger.info("Couverture enregistrée avec succès : %s", dest_path)
                return os.path.abspath(dest_path)
            else:
                logger.warning("Échec téléchargement couverture (%s) : HTTP %d", cover_url, resp.status_code)
                return None
        except Exception as e:
            logger.error("Erreur téléchargement couverture (%s) : %s", cover_url, e)
            return None

    # Alias pour compatibilité
    download_cover = download_cover_image

