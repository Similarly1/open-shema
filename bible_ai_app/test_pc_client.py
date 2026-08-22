import requests
import json
import re

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
}

def search_publications_chretiennes(query: str, author: str = "", limit: int = 5):
    search_q = f"{query} {author}".strip()
    url = f"https://publicationschretiennes.com/search/suggest.json?q={requests.utils.quote(search_q)}&resources[type]=product"
    try:
        r = requests.get(url, headers=headers, timeout=5)
        if r.status_code != 200:
            return []
        data = r.json()
        products = data.get("resources", {}).get("results", {}).get("products", [])
        
        results = []
        for p in products[:limit]:
            # Pour chaque produit, on peut enrichir avec product.json si nécessaire ou utiliser les champs disponibles
            handle = p.get("handle")
            title = p.get("title", "")
            img_url = p.get("image") or ""
            # Nettoyer l'URL de l'image pour avoir la résolution maximale
            if img_url:
                img_url = re.sub(r'_[0-9]+x[0-9]*\.', '.', img_url)
                img_url = re.sub(r'\?v=\d+', '', img_url)
                if not img_url.startswith("http"):
                    img_url = "https:" + img_url

            # Récupérer les détails complets du produit (description, auteur, tags, ISBN)
            product_detail_url = f"https://publicationschretiennes.com/products/{handle}.json"
            detail_author = p.get("vendor", "")
            detail_desc = p.get("body", "")
            isbn = ""
            year = ""
            
            try:
                r_det = requests.get(product_detail_url, headers=headers, timeout=4)
                if r_det.status_code == 200:
                    p_full = r_det.json().get("product", {})
                    detail_desc = p_full.get("body_html", "") or detail_desc
                    tags = p_full.get("tags", "")
                    # Extraire auteur des tags si présent (ex: Auteur_John MacArthur)
                    tag_list = [t.strip() for t in tags.split(",") if t.strip()]
                    for t in tag_list:
                        if t.lower().startswith("auteur_"):
                            detail_author = t.split("_", 1)[1].strip()
                            break
                    # Extraire ISBN
                    variants = p_full.get("variants", [])
                    if variants and variants[0].get("barcode"):
                        isbn = variants[0].get("barcode").strip()
                    # Année
                    created_at = p_full.get("created_at", "")
                    if created_at and len(created_at) >= 4:
                        year = created_at[:4]
                    # Image HD
                    images = p_full.get("images", [])
                    if images and images[0].get("src"):
                        img_url = images[0].get("src")
            except Exception:
                pass

            # Nettoyer description HTML
            from bs4 import BeautifulSoup
            soup = BeautifulSoup(detail_desc, "html.parser")
            clean_desc = soup.get_text(separator="\n").strip()
            # Nettoyer les mentions parasites
            clean_desc = re.sub(r'\n\s*\n+', '\n\n', clean_desc)

            results.append({
                "id": f"pc_{handle}",
                "source": "Publications Chrétiennes",
                "source_badge": "Publications Chrétiennes",
                "source_badge_color": "#DC2626",
                "title": title,
                "authors": [detail_author] if detail_author else [],
                "author_str": detail_author,
                "publisher": p.get("vendor") or "Publications Chrétiennes",
                "year": year,
                "description": clean_desc,
                "isbn": isbn,
                "cover_url": img_url,
                "url": f"https://publicationschretiennes.com/products/{handle}",
                "is_3d_cover": False
            })
        return results
    except Exception as e:
        print("PC search error:", e)
        return []

# Test
books_to_test = [
    ("La divinité de Christ", "John MacArthur"),
    ("Prendre plaisir en Dieu", "John Piper"),
    ("Théologie systématique", "Wayne Grudem")
]

for title, author in books_to_test:
    res = search_publications_chretiennes(title, author, limit=2)
    print(f"\n==========================================")
    print(f"TEST: {title} ({author})")
    print(f"Results found: {len(res)}")
    for r in res:
        print(f"  -> Title: {r['title']}")
        print(f"  -> Author: {r['author_str']}")
        print(f"  -> Year: {r['year']} | ISBN: {r['isbn']}")
        print(f"  -> Cover HD: {r['cover_url']}")
        print(f"  -> Desc: {r['description'][:120]}...\n")
