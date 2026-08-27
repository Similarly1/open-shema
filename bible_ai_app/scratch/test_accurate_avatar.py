import urllib.request
from bs4 import BeautifulSoup
import re

urls = [
    ("Jean-Jacques Riou", "https://evangile21.thegospelcoalition.org/article/je-me-confie-en-jesus-un-chant-pour-les-jours-de-doute/"),
    ("Ben Lattimore", "https://evangile21.thegospelcoalition.org/article/trouver-les-hauteurs-et-chercher-de-leau-lire-les-livres-des-rois/"),
    ("Michael Lawrence", "https://evangile21.thegospelcoalition.org/article/quelle-est-la-relation-entre-la-theologie-biblique-et-la-theologie-systematique/")
]

def extract_author_avatar(soup, author_name):
    # 1. Chercher dans les encadrés d'auteurs spécifiques (Évangile 21, TPSG, WordPress)
    for box in soup.select(".article_author_bio, .author-info, .author-bio, .post-author, .author-box, .single-author"):
        # a. data-bg-image
        for el in box.select("[data-bg-image]"):
            bg_val = el.get("data-bg-image", "")
            m = re.search(r'url\([\'"]?([^\'")]+)[\'"]?\)', bg_val)
            if m and not m.group(1).startswith("data:"):
                return m.group(1)
        # b. style background-image
        for el in box.find_all(attrs={"style": re.compile(r'background-image', re.I)}):
            m = re.search(r'url\([\'"]?([^\'")]+)[\'"]?\)', el.get("style", ""))
            if m and not m.group(1).startswith("data:"):
                return m.group(1)
        # c. img tag inside author box
        for img in box.find_all("img"):
            src = img.get("data-src") or img.get("data-lazy-src") or img.get("src") or ""
            if src and not src.startswith("data:") and "logo" not in src.lower():
                return src

    # 2. Chercher les classes spécifiques d'avatars (.author_img_wrap, .author-avatar, .author-image, img.avatar)
    for wrap in soup.select(".author_img_wrap, .author-avatar, .author-image, img.avatar"):
        if wrap.name == "img":
            src = wrap.get("data-src") or wrap.get("data-lazy-src") or wrap.get("src") or ""
            if src and not src.startswith("data:"):
                return src
        bg_val = wrap.get("data-bg-image") or wrap.get("style", "")
        m = re.search(r'url\([\'"]?([^\'")]+)[\'"]?\)', bg_val)
        if m and not m.group(1).startswith("data:"):
            return m.group(1)

    # 3. Chercher une image dont le alt ou l'URL correspond au nom de l'auteur
    if author_name:
        author_slug = re.sub(r'[^a-z0-9]+', '-', author_name.lower()).strip('-')
        for img in soup.find_all("img"):
            src = img.get("data-src") or img.get("data-lazy-src") or img.get("src") or ""
            alt = (img.get("alt") or "").strip().lower()
            if not src or src.startswith("data:") or "logo" in src.lower():
                continue
            if (alt and author_name.lower() in alt) or (author_slug and author_slug in src.lower()):
                return src

    return ""

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

for expected_author, u in urls:
    req = urllib.request.Request(u, headers=headers)
    with urllib.request.urlopen(req) as resp:
        html = resp.read().decode('utf-8')
    soup = BeautifulSoup(html, 'html.parser')
    avatar = extract_author_avatar(soup, expected_author)
    print(f"Author: {expected_author:20} -> Avatar: {avatar}")
