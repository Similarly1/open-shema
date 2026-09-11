"""
Open Shema - Module de recherche et d'agrégation d'e-books et Bibles numériques chrétiennes.
Permet d'interroger en direct les librairies chrétiennes francophones et les plateformes numériques,
avec un filtrage strict 100% numérique (exclusion absolue des formats papier).
"""

import os
import time
import logging
import urllib.parse
import urllib.request
import json
import ssl
import sys
import re
import unicodedata
import concurrent.futures
from typing import List, Dict, Any, Optional
from core.ssl_utils import make_relaxed_ssl_context

logger = logging.getLogger(__name__)

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
            'default_format': 'EPUB / PDF',
            'currency_symbol': '€',
            'currency_code': 'EUR'
        },
        {
            'name': "BLF Store",
            'domain': 'blfstore.com',
            'badge': "BLF Éditions",
            'default_format': 'EPUB (Sans DRM)',
            'currency_symbol': '€',
            'currency_code': 'EUR'
        },
        {
            'name': "Publications Chrétiennes",
            'domain': 'publicationschretiennes.com',
            'badge': "Pub. Chrétiennes",
            'default_format': 'EPUB / PDF',
            'currency_symbol': '$',
            'currency_code': 'CAD'
        }
    ]

    def __init__(self):
        try:
            from core.paths import resolve_data_path
            self.curated_catalog_path = resolve_data_path("french_bible_ebooks.json")
        except Exception:
            self.current_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            self.curated_catalog_path = os.path.join(self.current_dir, "data", "french_bible_ebooks.json")
        self._curated_books: List[Dict[str, Any]] = []
        self._cache: Dict[str, Any] = {}
        self._cache_ttl = 300  # 5 minutes de mise en cache
        self._load_curated_catalog()

    def _load_curated_catalog(self):
        """Charge le catalogue curé de Bibles et d'e-books chrétiens francophones."""
        if os.path.exists(self.curated_catalog_path):
            try:
                with open(self.curated_catalog_path, "r", encoding="utf-8") as f:
                    self._curated_books = json.load(f)
            except Exception as e:
                logger.error(f"Erreur chargement catalogue e-books: {e}")

    def get_curated_ebooks(self, query: str = "") -> List[Dict[str, Any]]:
        """
        Recherche dans le catalogue curé de Bibles et classiques chrétiens francophones.
        Garantit des résultats immédiats, de qualité certifiée, sans latence ni rate-limit.
        """
        if not self._curated_books:
            self._load_curated_catalog()

        clean_q = (query or "").strip().lower()
        if not clean_q:
            return list(self._curated_books)

        def strip_accents(s: str) -> str:
            return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')

        q_norm = strip_accents(clean_q)
        q_words = [w for w in re.split(r'\s+', q_norm) if len(w) > 1]
        results = []

        for b in self._curated_books:
            t_norm = strip_accents(b.get('title', '').lower())
            a_norm = strip_accents(b.get('authors', '').lower())
            keywords_norm = [strip_accents(k.lower()) for k in b.get('keywords', [])]

            # Correspondance directe dans titre, auteur ou mots-clés
            if q_norm in t_norm or q_norm in a_norm or any(q_norm in k for k in keywords_norm):
                results.append(dict(b))
            elif q_words and all(w in t_norm or w in a_norm or any(w in k for k in keywords_norm) for w in q_words):
                results.append(dict(b))

        return results

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
            '(epub)', '[epub]', '- epub', ' epub', 'epub ', 'format epub', 'format pdf',
            '(format epub)', '(format pdf)', '[format epub]', '[format pdf]',
            '(pdf)', '[pdf]', '- pdf', 'format numérique', 'version numérique',
            'téléchargement', 'livre numérique'
        ]
        if any(tok in t for tok in digital_title_tokens):
            return True

        # 2. Présence explicite dans le slug ou le chemin d'URL du produit
        digital_slug_tokens = [
            '-ebook', '_ebook', '-e-book', '_e-book', '-epub', '_epub', '-pdf', '_pdf',
            '-format-epub', '-format-pdf', '-telechargement', '-numerique', '-format-numerique',
            '/ebook/', '/epub/', '/ebooks/', '/epubs/', '/pdf/',  # chemin de catégorie (ex: Editions Clé)
        ]
        if any(tok in u for tok in digital_slug_tokens):
            return True

        return False

    def clean_ebook_title(self, title: str) -> str:
        """Nettoie le titre pour retirer les mentions redondantes (eBook), (EPUB), (format ePub), etc."""
        cleaned = re.sub(r'(?i)\s*[\(\[-]?\s*(format\s+epub|format\s+pdf|ebook|e-book|format numérique|version numérique|epub|pdf)[\)\]-]?', '', title)
        cleaned = re.sub(r'^\s*[-:–—]\s*', '', cleaned)
        cleaned = re.sub(r'\s*[-:–—]\s*$', '', cleaned)
        return cleaned.strip()

    # ------------------------------------------------------------------ #
    # Indicateurs qui signalent CLAIREMENT un livre physique (papier)     #
    # ------------------------------------------------------------------ #
    _PHYSICAL_BOOK_INDICATORS = [
        'broché', 'relié', 'relie', 'rigide', 'souple', 'semi-souple', 'cuir', 'similicuir',
        'couverture rigide', 'couverture souple', 'couverture textile', 'lin bleu',
        'tranche blanche', 'tranche dorée', 'tranche argentée', 'tranche doree', 'tranche argentee',
        'grand format', 'format poche', 'poche', 'hardcover', 'paperback', 'softcover',
        'gros caractères', 'gros caracteres'
    ]

    def _is_clearly_physical(self, title: str) -> bool:
        """Retourne True si le titre contient un indicateur explicite de livre physique."""
        t = (title or '').lower()
        return any(ind in t for ind in self._PHYSICAL_BOOK_INDICATORS)

    def _query_shopify_store(self, store_info: Dict[str, str], query: str) -> List[Dict[str, Any]]:
        """Interroge une boutique Shopify via l'endpoint suggest.json."""
        results = []
        name = store_info['name']
        domain = store_info['domain']
        badge = store_info.get('badge', name)
        default_format = store_info.get('default_format', 'EPUB')

        seen_urls = set()
        has_ebook = bool(re.search(r'\b(ebook|numérique|epub)\b', query, re.IGNORECASE))
        queries_to_try = [(query, has_ebook)]
        if not has_ebook:
            queries_to_try.append((f"{query} ebook", True))

        for q, is_ebook_query in queries_to_try:
            encoded_query = urllib.parse.quote(q)
            url = f"https://{domain}/search/suggest.json?q={encoded_query}&resources[type]=product&resources[limit]=8"

            try:
                req = urllib.request.Request(url, headers=HEADERS)
                with urllib.request.urlopen(req, context=make_relaxed_ssl_context(url), timeout=4.5) as response:
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
                        p_type = (prod.get('type') or '').lower()
                        tags = [str(t).lower() for t in prod.get('tags', [])]

                        # ── FILTRAGE STRICT PAR TYPE ET TAGS SHOPIFY ───────────────────────
                        if p_type == 'papier':
                            continue
                        if any(t in ['format_relié', 'format_broché', 'rigide', 'cuir', 'similicuir'] for t in tags):
                            continue
                        if self._is_clearly_physical(raw_title):
                            continue

                        # Détection explicite numérique dans les métadonnées de la boutique
                        has_digital_meta = (
                            p_type in ['ebook', 'e-book', 'numérique', 'digital', 'téléchargement'] or
                            any(t in ['ebook', 'e-book', 'bible numérique', 'livre numérique', 'noshipping'] for t in tags)
                        )

                        # Marqueur numérique strict dans le titre ou l'URL
                        if self.is_strictly_ebook(raw_title, prod_url) or has_digital_meta:
                            pass  # 100% numérique vérifié
                        else:
                            # Produit ambigu : ne pas accepter de produit papier par erreur
                            continue

                        clean_t = self.clean_ebook_title(raw_title)

                        # Correction du protocole d'image si nécessaire
                        if image.startswith('//'):
                            image = f"https:{image}"

                        curr_sym = store_info.get('currency_symbol', '€')
                        price_formatted = f"{float(price):.2f} {curr_sym}" if price else "Disponible"

                        results.append({
                            'id': f"{domain}_{prod.get('id', hash(prod_url))}",
                            'title': clean_t if clean_t else raw_title,
                            'raw_title': raw_title,
                            'source': name,
                            'store_badge': badge,
                            'format': default_format,
                            'price': price_formatted,
                            'price_raw': float(price) if price else 0.0,
                            'currency': curr_sym,
                            'url': f"https://{domain}{prod_url}",
                            'image': image,
                            'is_direct_product': True
                        })
            except Exception:
                continue

        return results

    def _query_editions_cle(self, query: str) -> List[Dict[str, Any]]:
        """Interroge et extrait en direct les e-books des Éditions Clé (editionscle.com)."""
        results = []
        encoded_query = urllib.parse.quote_plus(query)
        url = f"https://editionscle.com/recherche?controller=search&s={encoded_query}"

        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, context=make_relaxed_ssl_context(url), timeout=5.0) as response:
                if response.status != 200:
                    return results
                raw = response.read().decode('utf-8', errors='ignore')
                if not raw.strip().startswith('{'):
                    return results
                data = json.loads(raw)
                products = data.get('products', [])

                for p in products:
                    name = p.get('name', '')
                    url_p = p.get('url', '')
                    if not url_p:
                        continue

                    if not self.is_strictly_ebook(name, url_p):
                        continue

                    price_raw = float(p.get('price_amount', 0.0))
                    price_str = f"{price_raw:.2f} €" if price_raw > 0 else (p.get('price') or "Disponible")

                    # Image
                    image_url = ""
                    cover = p.get('cover') or {}
                    if isinstance(cover, dict):
                        by_size = cover.get('bySize', {})
                        med = by_size.get('medium_default') or by_size.get('home_default') or {}
                        image_url = med.get('url', '')

                    clean_t = self.clean_ebook_title(name)
                    fmt = 'PDF' if 'pdf' in name.lower() or 'pdf' in url_p.lower() else 'EPUB'

                    results.append({
                        'id': f"cle_{p.get('id_product', hash(url_p))}",
                        'title': clean_t if clean_t else name,
                        'raw_title': name,
                        'source': 'Éditions Clé',
                        'store_badge': 'Éditions Clé',
                        'format': fmt,
                        'price': price_str,
                        'price_raw': price_raw,
                        'url': url_p,
                        'image': image_url,
                        'is_direct_product': True
                    })
        except Exception:
            pass

        return results

    def _query_google_books(self, query: str) -> List[Dict[str, Any]]:
        """Recherche les ebooks sur Google Play Livres via l'API Google Books publique."""
        results = []
        encoded_query = urllib.parse.quote(query)
        url = f"https://www.googleapis.com/books/v1/volumes?q={encoded_query}&filter=ebooks&langRestrict=fr&maxResults=6"

        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, context=make_relaxed_ssl_context(url), timeout=4.5) as response:
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
                    curr_code = (retail.get('currencyCode') or 'EUR').upper()
                    curr_map = {'EUR': '€', 'USD': '$', 'CAD': '$', 'GBP': '£', 'CHF': 'CHF'}
                    curr_sym = curr_map.get(curr_code, '€')
                    price_str = f"{price_raw:.2f} {curr_sym}" if 'amount' in retail else "Consultable"
                    
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
                        'currency': curr_sym,
                        'url': buy_link,
                        'image': image,
                        'is_direct_product': True
                    })
        except Exception:
            pass

        return results

    def get_direct_store_links(self, query: str) -> List[Dict[str, str]]:
        """Génère les liens directs pré-filtrés sur le rayon e-books pour Fnac et Kobo."""
        encoded_query = urllib.parse.quote(query)
        return [
            {
                'source': 'Rayon E-books Fnac',
                'badge': 'Fnac.com',
                'description': 'Téléchargement numérique immédiat sur Fnac.com',
                'url': f"https://www.fnac.com/SearchResult/ResultList.aspx?Search={encoded_query}&sft=1"
            },
            {
                'source': 'Librairie Kobo Store',
                'badge': 'Rakuten Kobo',
                'description': 'Librairie 100% numérique Kobo',
                'url': f"https://www.kobo.com/fr/fr/search?query={encoded_query}&fclanguages=fr"
            }
        ]

    def normalize_title_key(self, title: str) -> str:
        """Crée une clé canonique normalisée pour regrouper les titres identiques."""
        import unicodedata
        cleaned = self.clean_ebook_title(title)
        nfkd = unicodedata.normalize('NFKD', cleaned)
        ascii_text = ''.join([c for c in nfkd if not unicodedata.combining(c)]).lower()
        alpha_only = re.sub(r'[^a-z0-9]', '', ascii_text)
        return alpha_only

    def group_ebook_results(self, items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Regroupe les e-books identiques provenant de différentes librairies.
        Chaque groupe contient la liste des offres triées du prix le plus bas au plus cher.
        """
        groups: Dict[str, Dict[str, Any]] = {}

        for it in items:
            title = it.get('title', '')
            key = self.normalize_title_key(title)
            if not key:
                key = str(hash(it.get('url', '')))

            if key not in groups:
                groups[key] = {
                    'group_id': key,
                    'title': self.clean_ebook_title(title),
                    'authors': it.get('authors', ''),
                    'image': it.get('image', ''),
                    'offers': []
                }

            if not groups[key]['image'] and it.get('image'):
                groups[key]['image'] = it.get('image')
            if not groups[key]['authors'] and it.get('authors'):
                groups[key]['authors'] = it.get('authors')

            # Éviter les doublons exacts d'URL ou même store+prix
            is_dup = any(
                o.get('url') == it.get('url') or 
                (o.get('store_badge') == it.get('store_badge') and o.get('price_raw') == it.get('price_raw'))
                for o in groups[key]['offers']
            )
            if not is_dup:
                groups[key]['offers'].append({
                    'source': it.get('source', ''),
                    'store_badge': it.get('store_badge', it.get('source', '')),
                    'price': it.get('price', 'N/C'),
                    'price_raw': it.get('price_raw', 0.0),
                    'format': it.get('format', 'EPUB'),
                    'url': it.get('url', ''),
                    'image': it.get('image', '')
                })

        result_groups = []
        for g in groups.values():
            offers = g['offers']
            # Trier les offres de la moins chère à la plus chère
            offers.sort(key=lambda o: (o['price_raw'] == 0, o['price_raw']))

            prices_raw = [o['price_raw'] for o in offers if o['price_raw'] > 0]
            min_price = min(prices_raw) if prices_raw else 0.0
            max_price = max(prices_raw) if prices_raw else 0.0

            g['min_price_raw'] = min_price
            g['max_price_raw'] = max_price
            g['offers_count'] = len(offers)

            if len(offers) == 1:
                g['price_display'] = offers[0]['price']
                g['best_store'] = offers[0]['store_badge']
                g['direct_url'] = offers[0]['url']
                g['format'] = offers[0]['format']
            else:
                best_price_str = offers[0].get('price', '')
                if min_price > 0 and best_price_str and best_price_str != "Disponible":
                    g['price_display'] = f"Dès {best_price_str}"
                else:
                    g['price_display'] = "Disponible"
                g['best_store'] = offers[0]['store_badge']
                g['direct_url'] = offers[0]['url']
                g['format'] = f"{len(offers)} offres"

            result_groups.append(g)

        # Trier les groupes : les prix les plus bas en premier
        result_groups.sort(key=lambda x: (x['min_price_raw'] == 0, x['min_price_raw']))
        return result_groups

    def calculate_relevance_score(self, title: str, query: str) -> int:
        """
        Calcule un score de pertinence pour classer les véritables versions bibliques
        en priorité lors d'une recherche générique (ex: 'Bible', 'La Bible')
        et reléguer les simples livrets / manuels d'étude.
        """
        t_lower = title.lower()
        q_lower = query.lower().strip()
        score = 0

        # Grandes versions bibliques reconnues
        known_versions = [
            'segond', 'semeur', 'tob', 'nfc', 'francais courant', 'français courant',
            'colombe', 'darby', 'jerusalem', 'jérusalem', 'osty', 'chouraqui',
            'bible annotée', 'neuchâtel', 'bible en 1 an', 'nouvelle bible segond',
            'bible d\'etude', 'bible d\'étude', 'bible expliquée', 'bible pastorale',
            'parole vivante', 'parole de vie', 'bible crampon', 'glaire', 'sacy',
            'martin', 'ostervald', 'king james', 'kjv', 'esv', 'niv'
        ]

        # Malus pour les guides / manuels sur la Bible
        manual_keywords = [
            'comment lire', 'comment étudier', 'pourquoi lire', 'pourquoi croire',
            'vrai ou faux', 'en 100 pages', 'can i really trust', 'hommes de la bible',
            'femmes de la bible', 'panorama', 'introduction à', 'survol de', 'guide de',
            'lire la bible', 'étudier la bible', 'découvrir la bible', 'personnages de la bible'
        ]

        if any(k in t_lower for k in manual_keywords):
            score -= 60

        if t_lower.startswith('bible ') or t_lower.startswith('la bible ') or t_lower.startswith('sainte bible') or t_lower.startswith('le nouveau testament') or t_lower.startswith('l\'ancien testament'):
            score += 80

        if any(v in t_lower for v in known_versions):
            score += 60

        # Correspondance textuelle
        if q_lower in t_lower:
            score += 20
        if t_lower == q_lower or t_lower == f"la {q_lower}":
            score += 50

        return score

    def search_all_ebooks(self, query: str) -> Dict[str, Any]:
        """
        Effectue une recherche unifiée sur les librairies chrétiennes francophones.
        Combine le catalogue curé certifié (Bibles et classiques sans latence)
        et les requêtes directes en magasin avec mise en cache anti-rate-limit.
        """
        clean_q = query.strip()

        # Si aucune requête n'est fournie, renvoyer la vitrine du catalogue curé (Bibles en tête)
        if not clean_q:
            curated_all = self.get_curated_ebooks("")
            grouped_all = self.group_ebook_results(curated_all)
            grouped_all.sort(
                key=lambda g: (-self.calculate_relevance_score(g['title'], 'Bible'), g['min_price_raw'] == 0, g['min_price_raw'])
            )
            direct_links = self.get_direct_store_links("Bible")
            return {
                'query': '',
                'count': len(grouped_all),
                'raw_count': len(curated_all),
                'results': grouped_all,
                'direct_links': direct_links
            }

        direct_products: List[Dict[str, Any]] = []

        # 1. Catalogue curé local : résultats certifiés, immédiats et immunisés contre le rate-limiting
        curated_matches = self.get_curated_ebooks(clean_q)
        direct_products.extend(curated_matches)

        # 2. Requête en direct sur les boutiques externes (avec cache pour éviter 429)
        cache_key = clean_q.lower()
        now = time.time()
        cached_entry = self._cache.get(cache_key)

        if cached_entry and (now - cached_entry[0] < self._cache_ttl):
            live_items = cached_entry[1]
            direct_products.extend(live_items)
        else:
            live_items = []
            with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
                future_tasks = []
                for store in self.SHOPIFY_STORES:
                    future_tasks.append(executor.submit(self._query_shopify_store, store, clean_q))
                future_tasks.append(executor.submit(self._query_google_books, clean_q))
                future_tasks.append(executor.submit(self._query_editions_cle, clean_q))

                for future in concurrent.futures.as_completed(future_tasks):
                    try:
                        res_items = future.result()
                        if res_items:
                            live_items.extend(res_items)
                    except Exception:
                        pass

            self._cache[cache_key] = (now, live_items)
            direct_products.extend(live_items)

        # 3. Regroupement intelligent des doublons et tri par pertinence
        grouped_results = self.group_ebook_results(direct_products)
        grouped_results.sort(
            key=lambda g: (-self.calculate_relevance_score(g['title'], clean_q), g['min_price_raw'] == 0, g['min_price_raw'])
        )

        direct_links = self.get_direct_store_links(clean_q)

        return {
            'query': clean_q,
            'count': len(grouped_results),
            'raw_count': len(direct_products),
            'results': grouped_results,
            'direct_links': direct_links
        }
