import requests
from bs4 import BeautifulSoup
import re
import json

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
}

# Test 7ici.com / Excelsis (Prestashop / WooCommerce search)
def search_7ici_excelsis(query: str, limit: int = 3):
    url = f"https://7ici.com/recherche?controller=search&s={requests.utils.quote(query)}"
    try:
        r = requests.get(url, headers=headers, timeout=5)
        if r.status_code != 200:
            return []
        soup = BeautifulSoup(r.text, "html.parser")
        products = soup.find_all("article", class_=re.compile(r"product-miniature|js-product-miniature"))
        results = []
        for p in products[:limit]:
            title_tag = p.find(["h2", "h3"], class_=re.compile(r"product-title|title")) or p.find("a", class_="product-thumbnail")
            img_tag = p.find("img")
            link_tag = p.find("a", href=True)
            
            title = title_tag.get_text(strip=True) if title_tag else ""
            img_url = img_tag.get("src") or img_tag.get("data-src") or "" if img_tag else ""
            link = link_tag.get("href") if link_tag else ""
            
            if title and link:
                results.append({
                    "id": f"7ici_{len(results)}",
                    "source": "Éditions Excelsis",
                    "source_badge": "Excelsis / 7ici",
                    "source_badge_color": "#0284C7",
                    "title": title,
                    "cover_url": img_url,
                    "url": link,
                    "is_3d_cover": False
                })
        return results
    except Exception as e:
        print("7ici error:", e)
        return []

print("=== TEST 7ICI / EXCELSIS ===")
res_7ici = search_7ici_excelsis("Alfred Kuen Lire et comprendre la Bible")
print(f"Results for Kuen: {len(res_7ici)}")
for r in res_7ici:
    print(r)
