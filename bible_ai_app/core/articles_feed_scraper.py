import re
import html
import hashlib
import logging
import xml.etree.ElementTree as ET
from datetime import datetime
from email.utils import parsedate_to_datetime
from typing import List, Dict, Any, Optional, Tuple
import requests
from bs4 import BeautifulSoup, Comment

from core.bible_reference_detector import find_bible_references

logger = logging.getLogger(__name__)

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 (BibleStudyApp/1.0)"

class ArticlesFeedScraper:
    """
    Scraper et parseur de flux RSS / Atom avec extraction et nettoyage Markdown
    pour les blogs théologiques sélectionnés.
    """

    def __init__(self, timeout: int = 15):
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8"
        })

    def fetch_feed_xml(self, feed_url: str) -> Optional[str]:
        """Télécharge le contenu brut du flux RSS/Atom."""
        try:
            resp = self.session.get(feed_url, timeout=self.timeout)
            if resp.status_code == 200:
                return resp.text
            else:
                logger.warning(f"[FeedScraper] Code HTTP {resp.status_code} pour {feed_url}")
                return None
        except Exception as e:
            logger.error(f"[FeedScraper] Erreur de récupération du flux {feed_url} : {e}")
            return None

    def parse_feed_items(self, feed_xml: str, source_config: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Parse les entrées du flux RSS 2.0 ou Atom.
        """
        if not feed_xml or not feed_xml.strip():
            return []

        items = []
        source_id = source_config.get("id", "source")

        # 1. Essai avec xml.etree.ElementTree
        try:
            # Nettoyer les déclarations d'encodage si nécessaire
            xml_bytes = feed_xml.encode("utf-8") if isinstance(feed_xml, str) else feed_xml
            root = ET.fromstring(xml_bytes)

            # RSS 2.0 (<channel><item>)
            for item in root.findall(".//item"):
                title = (item.findtext("title") or "Sans titre").strip()
                link = (item.findtext("link") or "").strip()
                if not link:
                    guid = item.findtext("guid")
                    if guid and guid.strip().startswith("http"):
                        link = guid.strip()

                if not link:
                    continue

                # Auteur
                author = ""
                for child in item:
                    if child.tag.endswith("creator") or child.tag.endswith("author"):
                        author = (child.text or "").strip()
                        if author:
                            break

                if "@" in author:
                    user_part = author.split("@")[0].replace(".", " ").title()
                    author = user_part

                pub_date_raw = item.findtext("pubDate") or item.findtext("date") or ""
                pub_date_str = self._normalize_date(pub_date_raw)

                # Contenu / description
                content_html = ""
                for child in item:
                    if child.tag.endswith("encoded") or child.tag.endswith("content"):
                        content_html = child.text or ""
                        break

                desc_text = item.findtext("description") or ""
                summary_text = ""
                if desc_text:
                    desc_soup = BeautifulSoup(desc_text, "html.parser")
                    summary_text = desc_soup.get_text(separator=" ", strip=True)[:350]
                    if not content_html:
                        content_html = desc_text

                # Catégories / Badges thématiques
                tags = [c.text.strip() for c in item.findall("category") if c.text and c.text.strip()]

                url_hash = hashlib.sha256(link.encode("utf-8")).hexdigest()[:12]
                article_id = f"{source_id}_{url_hash}"

                items.append({
                    "id": article_id,
                    "source_id": source_id,
                    "title": title,
                    "url": link,
                    "author": author,
                    "published_at": pub_date_str,
                    "summary": summary_text,
                    "tags": tags,
                    "raw_content_html": content_html,
                    "source_config": source_config
                })

            if items:
                return items

            # Atom (<entry>)
            for entry in root.findall(".//{http://www.w3.org/2005/Atom}entry") or root.findall(".//entry"):
                title = ""
                for child in entry:
                    if child.tag.endswith("title"):
                        title = (child.text or "Sans titre").strip()
                        break

                link = ""
                for child in entry:
                    if child.tag.endswith("link"):
                        link = child.attrib.get("href", "") or (child.text or "")
                        if link:
                            break

                if not link:
                    continue

                author = ""
                for child in entry:
                    if child.tag.endswith("author"):
                        name_node = child.find(".//{http://www.w3.org/2005/Atom}name") or child.find(".//name")
                        author = name_node.text.strip() if name_node is not None and name_node.text else (child.text or "").strip()
                        break

                pub_date_raw = ""
                for child in entry:
                    if child.tag.endswith("published") or child.tag.endswith("updated"):
                        pub_date_raw = (child.text or "").strip()
                        break
                pub_date_str = self._normalize_date(pub_date_raw)

                content_html = ""
                for child in entry:
                    if child.tag.endswith("content") or child.tag.endswith("summary"):
                        content_html = child.text or ""
                        break

                # Catégories Atom
                tags = []
                for c in entry.findall(".//{http://www.w3.org/2005/Atom}category") or entry.findall(".//category"):
                    term = c.attrib.get("term", "").strip() or (c.text or "").strip()
                    if term:
                        tags.append(term)

                desc_soup = BeautifulSoup(content_html, "html.parser")
                summary_text = desc_soup.get_text(separator=" ", strip=True)[:350]

                url_hash = hashlib.sha256(link.encode("utf-8")).hexdigest()[:12]
                article_id = f"{source_id}_{url_hash}"

                items.append({
                    "id": article_id,
                    "source_id": source_id,
                    "title": title,
                    "url": link,
                    "author": author,
                    "published_at": pub_date_str,
                    "summary": summary_text,
                    "tags": tags,
                    "raw_content_html": content_html,
                    "source_config": source_config
                })

        except Exception as e:
            logger.debug(f"[FeedScraper] ElementTree fallback : {e}")

        return items

    def fetch_full_article_content(self, article: Dict[str, Any]) -> Tuple[str, str]:
        """
        Garantit l'obtention du contenu complet en Markdown et le nom de l'auteur.
        Si le flux RSS ne contient qu'un extrait court (< 800 car.), effectue le scraping de la page web.
        Retourne (content_markdown, author).
        """
        raw_html = article.get("raw_content_html", "")
        author = article.get("author", "")
        source_config = article.get("source_config", {})
        selectors = source_config.get("selectors", {})
        
        # Teste si le contenu HTML du flux est suffisant
        clean_text_len = len(BeautifulSoup(raw_html, "html.parser").get_text(strip=True)) if raw_html else 0
        
        if clean_text_len >= 800:
            md_content = self.html_to_clean_markdown(raw_html, selectors.get("excludes", []))
            return md_content, author

        # Scraping de la page web complète si disponible
        url = article.get("url")
        if not url:
            return self.html_to_clean_markdown(raw_html, selectors.get("excludes", [])), author

        try:
            resp = self.session.get(url, timeout=self.timeout)
            if resp.status_code == 200:
                page_soup = BeautifulSoup(resp.text, "html.parser")
                
                # Extraction de l'auteur si manquant
                if not author and selectors.get("author"):
                    auth_tag = page_soup.select_one(selectors["author"])
                    if auth_tag:
                        author = auth_tag.get_text(strip=True)

                # Extraction du corps de l'article via le sélecteur dédié
                content_el = None
                if selectors.get("content"):
                    for sel in selectors["content"].split(","):
                        found = page_soup.select_one(sel.strip())
                        if found:
                            content_el = found
                            break

                if not content_el:
                    content_el = page_soup.find("article") or page_soup.find("main") or page_soup.find("body")

                if content_el:
                    md_content = self.html_to_clean_markdown(str(content_el), selectors.get("excludes", []))
                    return md_content, author
        except Exception as e:
            logger.warning(f"[FeedScraper] Échec du scraping web pour {url} : {e}")

        # Fallback sur le contenu initial
        return self.html_to_clean_markdown(raw_html, selectors.get("excludes", [])), author

    def html_to_clean_markdown(self, html_content: str, exclude_selectors: Optional[List[str]] = None) -> str:
        """
        Nettoie le HTML (suppression scripts, styles, widgets) et le convertit en Markdown structuré.
        """
        if not html_content:
            return ""

        soup = BeautifulSoup(html_content, "html.parser")

        # 1. Supprimer les balises indésirables
        for tag in soup(["script", "style", "nav", "footer", "form", "iframe", "noscript", "svg"]):
            tag.decompose()

        # Supprimer les commentaires HTML
        for comment in soup.find_all(string=lambda text: isinstance(text, Comment)):
            comment.extract()

        # 2. Supprimer les éléments correspondant aux sélecteurs d'exclusion
        if exclude_selectors:
            for sel in exclude_selectors:
                try:
                    for match in soup.select(sel):
                        match.decompose()
                except Exception:
                    pass

        # 3. Traiter les blocs et formater en Markdown
        return self._convert_soup_to_markdown(soup).strip()

    def _convert_soup_to_markdown(self, soup: BeautifulSoup) -> str:
        """Convertit les nœuds BeautifulSoup en texte Markdown structuré."""
        lines = []

        for element in soup.children:
            if not hasattr(element, "name") or element.name is None:
                text = str(element).strip()
                if text:
                    lines.append(text)
                continue

            tag_name = element.name.lower()

            if tag_name in ["h1", "h2", "h3", "h4", "h5", "h6"]:
                level = int(tag_name[1])
                prefix = "#" * level
                lines.append(f"\n{prefix} {element.get_text(strip=True)}\n")

            elif tag_name == "p":
                p_text = self._format_inline(element)
                if p_text.strip():
                    lines.append(f"\n{p_text}\n")

            elif tag_name == "blockquote":
                bq_text = element.get_text(strip=True)
                quoted = "\n".join(f"> {l}" for l in bq_text.splitlines() if l.strip())
                lines.append(f"\n{quoted}\n")

            elif tag_name in ["ul", "ol"]:
                for idx, li in enumerate(element.find_all("li", recursive=False), start=1):
                    bullet = f"{idx}." if tag_name == "ol" else "-"
                    li_text = self._format_inline(li)
                    lines.append(f"{bullet} {li_text}")
                lines.append("")

            elif tag_name in ["div", "section", "article"]:
                sub_md = self._convert_soup_to_markdown(element)
                if sub_md.strip():
                    lines.append(sub_md)

            elif tag_name == "hr":
                lines.append("\n---\n")

            else:
                inline = self._format_inline(element)
                if inline.strip():
                    lines.append(inline)

        # Nettoyage des sauts de ligne multiples et résidus de lecteurs audio
        result = "\n".join(lines)
        result = re.sub(r'Loading the Elevenlabs.*?\n', '', result, flags=re.IGNORECASE)
        result = re.sub(r'↩\s*\d+\s*▶\s*↩\s*\d+\s*[\d:]+\s*[\d:]+', '', result)
        result = re.sub(r'\n{3,}', '\n\n', result)
        return result.strip()

    def _format_inline(self, soup_element) -> str:
        """Formate les éléments inline (liens, gras, italique)."""
        if not hasattr(soup_element, "descendants"):
            return str(soup_element)

        # Formater les liens
        for a in soup_element.find_all("a"):
            href = a.get("href", "")
            text = a.get_text(strip=True)
            if href and text and not href.startswith("javascript:"):
                a.replace_with(f"[{text}]({href})")

        # Formater le gras
        for strong in soup_element.find_all(["strong", "b"]):
            t = strong.get_text(strip=True)
            if t:
                strong.replace_with(f"**{t}**")

        # Formater l'italique
        for em in soup_element.find_all(["em", "i"]):
            t = em.get_text(strip=True)
            if t:
                em.replace_with(f"*{t}*")

        return soup_element.get_text(separator=" ", strip=True)

    def _normalize_date(self, raw_date: str) -> str:
        """Convertit diverses représentations de date en ISO 8601 (YYYY-MM-DDTHH:MM:SSZ)."""
        if not raw_date:
            return datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")

        try:
            # Essai avec le format standard RFC 2822 / RFC 822 (RSS)
            dt = parsedate_to_datetime(raw_date)
            return dt.strftime("%Y-%m-%dT%H:%M:%SZ")
        except Exception:
            pass

        # Essai ISO format (Atom)
        try:
            clean_d = raw_date.replace("Z", "+00:00")
            dt = datetime.fromisoformat(clean_d)
            return dt.strftime("%Y-%m-%dT%H:%M:%SZ")
        except Exception:
            pass

        return datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")

    def process_article(self, raw_item: Dict[str, Any]) -> Dict[str, Any]:
        """
        Pipeline complet pour un article :
        1. Extraction Markdown propre (+ scraping si nécessaire)
        2. Détection des références bibliques
        3. Retourne l'objet prêt à être persisté
        """
        content_md, author = self.fetch_full_article_content(raw_item)
        
        if not raw_item.get("author") and author:
            raw_item["author"] = author

        # Extraction des références bibliques dans le titre et le corps de l'article
        combined_text = f"{raw_item.get('title', '')}\n\n{content_md}"
        scripture_refs = find_bible_references(combined_text)

        # Dédoublonnage des références par verset/chapitre
        unique_refs = []
        seen = set()
        for ref in scripture_refs:
            key = (ref.get("book_code"), ref.get("chapter"), str(ref.get("verse")))
            if key not in seen:
                seen.add(key)
                unique_refs.append(ref)

        return {
            "id": raw_item["id"],
            "source_id": raw_item["source_id"],
            "title": raw_item["title"],
            "author": raw_item.get("author", ""),
            "url": raw_item["url"],
            "published_at": raw_item.get("published_at", ""),
            "fetched_at": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
            "summary": raw_item.get("summary", ""),
            "tags": raw_item.get("tags", []),
            "content_markdown": content_md,
            "has_full_text": len(content_md) > 500,
            "scripture_references": unique_refs
        }
