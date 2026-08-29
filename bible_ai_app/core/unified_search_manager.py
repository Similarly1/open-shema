"""
Unified Search & Discovery Manager for Open Shema
Agrégateur de recherche unifiée pour les 3 pôles du savoir biblique :
1. Modules Natifs Open Shema (Bibles, Dictionnaires, Commentaires, Théologie)
2. Domaine Public & Archives Libres (Gutendex / Gutenberg, Logos PB .docx)
3. Librairies Chrétiennes E-books 100% numériques (Bibli'O, BLF, Pub. Chrétiennes, Clé, Google Play)
"""

import os
import sys
import json
import re
import ssl
import urllib.request
import urllib.parse
import concurrent.futures
from typing import List, Dict, Any

from core.ebook_finder_manager import EbookFinderManager, HEADERS, ssl_ctx


class UnifiedSearchManager:
    """Gestionnaire de recherche unifiée pour le Hub Open Shema."""

    def __init__(self):
        self.ebook_manager = EbookFinderManager()
        self.current_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        self.logos_books_path = os.path.join(self.current_dir, "data", "logos_community_books.json")

    def search_gutendex(self, query: str) -> List[Dict[str, Any]]:
        """Recherche dans Project Gutenberg via Gutendex avec filtre thématique chrétien."""
        results = []
        if not query or len(query.strip()) < 2:
            return results

        clean_q = query.strip()
        params = {
            'search': clean_q,
            'topic': 'Christianity'
        }
        url = f"https://gutendex.com/books/?{urllib.parse.urlencode(params)}"

        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, context=ssl_ctx, timeout=2.5) as resp:
                if resp.status != 200:
                    return results
                data = json.loads(resp.read().decode('utf-8'))
                books = data.get('results', [])

                for b in books:
                    title = b.get('title', '')
                    authors_list = b.get('authors', [])
                    authors_str = ", ".join(a.get('name', '') for a in authors_list) if authors_list else "Domaine Public"
                    languages = b.get('languages', ['en'])
                    lang_code = languages[0] if languages else 'en'
                    formats = b.get('formats', {})

                    # Prioriser EPUB
                    epub_url = formats.get('application/epub+zip') or formats.get('application/x-mobipocket-ebook') or formats.get('text/html') or ''
                    cover_url = formats.get('image/jpeg', '')

                    if not epub_url:
                        continue

                    book_id = b.get('id', hash(title))
                    results.append({
                        'id': f"gutenberg_{book_id}",
                        'title': title,
                        'author': authors_str,
                        'category': 'public_domain',
                        'source': 'Project Gutenberg',
                        'badge_label': 'Gutenberg',
                        'format': 'EPUB',
                        'language': lang_code,
                        'size_bytes': 1500000,
                        'download_url': epub_url,
                        'cover_url': cover_url,
                        'description': f"Classique libre de droits numérisé par le Projet Gutenberg ({authors_str}).",
                        'action_label': 'Télécharger EPUB',
                        'is_free': True
                    })
        except Exception:
            pass

        return results

    def search_logos_personal_books(self, query: str) -> List[Dict[str, Any]]:
        """Recherche dans la base locale des Personal Books de la communauté Logos."""
        results = []
        if not os.path.exists(self.logos_books_path):
            return results

        try:
            with open(self.logos_books_path, "r", encoding="utf-8") as f:
                all_books = json.load(f)

            q_lower = query.lower().strip()
            for b in all_books:
                title = (b.get('title') or '').lower()
                author = (b.get('author') or '').lower()
                desc = (b.get('description') or '').lower()

                if not q_lower or q_lower in title or q_lower in author or q_lower in desc:
                    results.append({
                        'id': b.get('id'),
                        'title': b.get('title'),
                        'author': b.get('author') or 'Communauté Logos',
                        'category': 'public_domain',
                        'source': 'Logos Community Wiki',
                        'badge_label': 'Logos PB',
                        'format': 'DOCX',
                        'language': b.get('language', 'en'),
                        'size_bytes': b.get('size_bytes', 2500000),
                        'download_url': b.get('download_url', ''),
                        'cover_url': b.get('cover_url', ''),
                        'description': b.get('description', ''),
                        'action_label': 'Importer DOCX',
                        'is_free': True
                    })
        except Exception:
            pass

        return results

    def search_all_unified(self, query: str, official_catalog_modules: List[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Exécute la recherche simultanée et parallèle sur les 3 pôles :
        1. Modules Natifs Open Shema
        2. Domaine Public & Archives (Gutendex + Logos PB)
        3. Librairies Chrétiennes E-books
        """
        clean_q = (query or "").strip()
        q_lower = clean_q.lower()

        # 1. Pôle Open Shema (Modules natifs)
        open_shema_results: List[Dict[str, Any]] = []
        if official_catalog_modules:
            for m in official_catalog_modules:
                t = (m.get('title') or '').lower()
                a = (m.get('author') or '').lower()
                d = (m.get('description') or '').lower()
                ab = (m.get('abbreviation') or '').lower()

                if not q_lower or q_lower in t or q_lower in a or q_lower in d or q_lower in ab:
                    open_shema_results.append({
                        'id': m.get('id'),
                        'title': m.get('title'),
                        'author': m.get('author') or 'Open Shema Data',
                        'type': m.get('type', 'bible'),
                        'category': 'open_shema',
                        'source': 'Open Shema Data',
                        'badge_label': 'Natif Open Shema',
                        'format': m.get('format', 'sqlite').upper(),
                        'language': m.get('language', 'fr'),
                        'size_bytes': m.get('size_bytes', 0),
                        'download_url': m.get('download_url', ''),
                        'cover_url': m.get('cover_url', ''),
                        'abbreviation': m.get('abbreviation', ''),
                        'features': m.get('features', []),
                        'description': m.get('description', ''),
                        'action_label': 'Installer dans l\'application',
                        'is_free': True
                    })

        # 2 & 3. Parallélisation du Domaine Public et des Librairies via ThreadPoolExecutor
        public_domain_results: List[Dict[str, Any]] = []
        bookstore_results: List[Dict[str, Any]] = []
        direct_store_links: List[Dict[str, str]] = []

        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            future_gutendex = executor.submit(self.search_gutendex, clean_q)
            future_logos_pb = executor.submit(self.search_logos_personal_books, clean_q)
            future_bookstores = executor.submit(self.ebook_manager.search_all_ebooks, clean_q)

            # Gutendex
            try:
                guten_items = future_gutendex.result()
                if guten_items:
                    public_domain_results.extend(guten_items)
            except Exception:
                pass

            # Logos PB
            try:
                logos_items = future_logos_pb.result()
                if logos_items:
                    public_domain_results.extend(logos_items)
            except Exception:
                pass

            # Librairies Chrétiennes
            try:
                ebook_data = future_bookstores.result()
                if ebook_data:
                    raw_bookstore = ebook_data.get('results', [])
                    direct_store_links = ebook_data.get('direct_links', [])
                    for b in raw_bookstore:
                        b['category'] = 'bookstores'
                        b['action_label'] = 'Comparer / Acheter'
                        bookstore_results.append(b)
            except Exception:
                pass

        total_count = len(open_shema_results) + len(public_domain_results) + len(bookstore_results)

        return {
            'query': clean_q,
            'total_count': total_count,
            'counts_by_category': {
                'all': total_count,
                'open_shema': len(open_shema_results),
                'public_domain': len(public_domain_results),
                'bookstores': len(bookstore_results)
            },
            'open_shema_results': open_shema_results,
            'public_domain_results': public_domain_results,
            'bookstore_results': bookstore_results,
            'direct_store_links': direct_store_links
        }
