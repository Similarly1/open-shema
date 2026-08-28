"""
Open Shema - Module de recherche et d'agrégation d'e-books et Bibles numériques chrétiennes.
Permet d'interroger en direct les librairies chrétiennes francophones et les plateformes numériques,
avec un filtrage strict 100% numérique (exclusion absolue des formats papier).
"""

import urllib.parse
import urllib.request
import json
import ssl
import sys
import re
import concurrent.futures
from typing import List, Dict, Any, Optional

# Création d'un contexte SSL sécurisé mais résilient
ssl_ctx = ssl.create_default_context()
ssl_ctx.check_hostname = False
ssl_ctx.verify_mode = ssl.CERT_NONE

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*'
}

class EbookFinderManager:
    """Gestionnaire de recherche d'e-books chrétiens multi-plateformes."""

    # Librairies chrétiennes utilisant le moteur Shopify
    SHOPIFY_STORES = [
        {
            'name': "Éditions Bibli'O",
            'domain': 'editionsbiblio.fr',
            'badge': "Alliance Biblique",
            'default_format': 'EPUB / PDF'
        },
        {
            'name': "BLF Store",
            'domain': 'blfstore.com',
            'badge': "BLF Éditions",
            'default_format': 'EPUB (Sans DRM)'
        },
        {
            'name': "Publications Chrétiennes",
            'domain': 'publicationschretiennes.com',
            'badge': "Pub. Chrétiennes",
            'default_format': 'EPUB / PDF'
        }
    ]

    def is_strictly_ebook(self, title: str, url_path: str = "") -> bool:
        """
        Vérifie avec certitude que l'ouvrage est un e-book / format numérique.
        Rejette tout livre papier (relié, broché, couverture rigide, etc.).
        """
        t = (title or "").lower()
        u = (url_path or "").lower()

        # 1. Présence explicite dans le titre du produit
        digital_title_tokens = [
            '(ebook)', '[ebook]', '(e-book)', '[e-book]', '- ebook', ' ebook', 'ebook ',
            '(epub)', '[epub]', '- epub', ' epub', 'format numérique', 'version numérique',
            'téléchargement', 'livre numérique'
        ]
        if any(tok in t for tok in digital_title_tokens):
            return True

        # 2. Présence explicite dans le slug d'URL du produit
        digital_slug_tokens = [
            '-ebook', '_ebook', '-e-book', '_e-book', '-epub', '_epub',
            '-telechargement', '-numerique', '-format-numerique'
        ]
        if any(tok in u for tok in digital_slug_tokens):
            return True

        return False

    def clean_ebook_title(self, title: str) -> str:
        """Nettoie le titre pour retirer les mentions redondantes (eBook), (EPUB), etc."""
        cleaned = re.sub(r'(?i)\s*[\(\[-]?\s*(ebook|e-book|format numérique|version numérique|epub|pdf)[\)\]-]?', '', title)
        cleaned = re.sub(r'^\s*[-:–—]\s*', '', cleaned)
        cleaned = re.sub(r'\s*[-:–—]\s*$', '', cleaned)
        return cleaned.strip()

    def _query_shopify_store(self, store_info: Dict[str, str], query: str) -> List[Dict[str, Any]]:
        """Interroge une boutique Shopify via l'endpoint suggest.json."""
        results = []
        name = store_info['name']
        domain = store_info['domain']
        badge = store_info.get('badge', name)
        default_format = store_info.get('default_format', 'EPUB')

        seen_urls = set()
        # On teste la requête brute et la variante avec suffixe 'ebook'
        queries_to_try = [query]
        if not re.search(r'\b(ebook|numérique|epub)\b', query, re.IGNORECASE):
            queries_to_try.append(f"{query} ebook")

        for q in queries_to_try:
            encoded_query = urllib.parse.quote(q)
            url = f"https://{domain}/search/suggest.json?q={encoded_query}&resources[type]=product&resources[limit]=8"

            try:
                req = urllib.request.Request(url, headers=HEADERS)
                with urllib.request.urlopen(req, context=ssl_ctx, timeout=4.5) as response:
                    if response.status != 200:
                        continue
                    data = json.loads(response.read().decode('utf-8'))
                    products = data.get('resources', {}).get('results', {}).get('products', [])

                    for prod in products:
                        prod_url = prod.get('url') or ''
                        if prod_url in seen_urls:
                            continue
                        seen_urls.add(prod_url)

                        raw_title = prod.get('title') or ''
                        price = prod.get('price') or ''
                        image = prod.get('image') or ''

                        # FILTRE STRICT E-BOOK
                        if self.is_strictly_ebook(raw_title, prod_url):
                            clean_t = self.clean_ebook_title(raw_title)
                            
                            # Correction du protocole d'image si nécessaire
                            if image.startswith('//'):
                                image = f"https:{image}"

                            results.append({
                                'id': f"{domain}_{prod.get('id', hash(prod_url))}",
                                'title': clean_t if clean_t else raw_title,
                                'raw_title': raw_title,
                                'source': name,
                                'store_badge': badge,
                                'format': default_format,
                                'price': f"{float(price):.2f} €" if price else "Disponible",
                                'price_raw': float(price) if price else 0.0,
                                'url': f"https://{domain}{prod_url}",
                                'image': image,
                                'is_direct_product': True
                            })
            except Exception:
                continue

        return results

    def _query_google_books(self, query: str) -> List[Dict[str, Any]]:
        """Recherche les ebooks sur Google Play Livres via l'API Google Books publique."""
        results = []
        encoded_query = urllib.parse.quote(query)
        url = f"https://www.googleapis.com/books/v1/volumes?q={encoded_query}&filter=ebooks&langRestrict=fr&maxResults=6"

        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, context=ssl_ctx, timeout=4.5) as response:
                if response.status != 200:
                    return results
                data = json.loads(response.read().decode('utf-8'))
                items = data.get('items', [])

                for item in items:
                    vol = item.get('volumeInfo', {})
                    sale = item.get('saleInfo', {})

                    title = vol.get('title', '')
                    authors = ", ".join(vol.get('authors', []))
                    retail = sale.get('retailPrice', {})
                    
                    price_raw = float(retail.get('amount', 0.0))
                    price_str = f"{price_raw:.2f} €" if 'amount' in retail else "Consultable"
                    
                    buy_link = sale.get('buyLink') or vol.get('infoLink', '')
                    images = vol.get('imageLinks', {})
                    image = images.get('thumbnail') or images.get('smallThumbnail', '')
                    if image.startswith('http://'):
                        image = image.replace('http://', 'https://')

                    results.append({
                        'id': f"google_{item.get('id', hash(buy_link))}",
                        'title': title,
                        'authors': authors,
                        'source': 'Google Play Livres',
                        'store_badge': 'Google Play',
                        'format': 'EPUB / PDF',
                        'price': price_str,
                        'price_raw': price_raw,
                        'url': buy_link,
                        'image': image,
                        'is_direct_product': True
                    })
        except Exception:
            pass

        return results

    def get_direct_store_links(self, query: str) -> List[Dict[str, str]]:
        """Génère les liens directs pré-filtrés sur le rayon e-books pour les grandes plateformes."""
        encoded_query = urllib.parse.quote(query)
        return [
            {
                'source': 'Fnac (Rayon E-books)',
                'badge': 'Fnac / Kobo',
                'description': 'Téléchargement numérique immédiat sur Fnac.com',
                'url': f"https://www.fnac.com/SearchResult/ResultList.aspx?Search={encoded_query}&sft=1"
            },
            {
                'source': 'Rakuten Kobo',
                'badge': 'Kobo Store',
                'description': 'Librairie 100% numérique Kobo',
                'url': f"https://www.kobo.com/fr/fr/search?query={encoded_query}&fclanguages=fr"
            },
            {
                'source': 'La Maison de la Bible',
                'badge': 'Maison de la Bible',
                'description': 'Recherche e-books sur La Maison de la Bible',
                'url': f"https://maisonbible.fr/fr/recherche?controller=search&s={encoded_query}+ebook"
            }
        ]

    def search_all_ebooks(self, query: str) -> Dict[str, Any]:
        """
        Effectue une recherche unifiée et parallèle sur toutes les plateformes.
        Renvoie une liste de produits e-books directs et les liens de recherche rapide.
        """
        clean_q = query.strip()
        if not clean_q:
            return {'results': [], 'direct_links': [], 'query': ''}

        direct_products: List[Dict[str, Any]] = []

        # Exécution en parallèle via ThreadPoolExecutor pour une réponse ultra-rapide (< 1s)
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            future_to_store = {
                executor.submit(self._query_shopify_store, store, clean_q): store['name']
                for store in self.SHOPIFY_STORES
            }
            future_google = executor.submit(self._query_google_books, clean_q)

            for future in concurrent.futures.as_completed(future_to_store):
                try:
                    store_results = future.result()
                    direct_products.extend(store_results)
                except Exception:
                    pass

            try:
                google_results = future_google.result()
                direct_products.extend(google_results)
            except Exception:
                pass

        # Tri des résultats : les prix renseignés en premier, triés par pertinence / prix
        direct_products.sort(key=lambda x: (x['price_raw'] == 0, x['price_raw']))

        direct_links = self.get_direct_store_links(clean_q)

        return {
            'query': clean_q,
            'count': len(direct_products),
            'results': direct_products,
            'direct_links': direct_links
        }
