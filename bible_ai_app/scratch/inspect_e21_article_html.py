import urllib.request
from bs4 import BeautifulSoup

url = 'https://evangile21.thegospelcoalition.org/article/trouver-les-hauteurs-et-chercher-de-leau-lire-les-livres-des-rois/'
req = urllib.request.Request(url, headers={
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
})

with urllib.request.urlopen(req) as resp:
    html = resp.read().decode('utf-8')

soup = BeautifulSoup(html, 'html.parser')

print("=== ARTICLE STRUCTURE ===")
for div in soup.select('div[class*="author"], div[class*="bio"], .entry-content > div, .entry-content > p, .post-author, .author-box'):
    classes = div.get('class')
    print("Element:", div.name, "Classes:", classes)
    img = div.find('img')
    if img:
        print("  Img src:", img.get('src') or img.get('data-src') or img.get('data-lazy-src'))
    print("  Text preview:", div.get_text(strip=True)[:150])
