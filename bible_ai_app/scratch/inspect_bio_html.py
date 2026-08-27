import urllib.request
from bs4 import BeautifulSoup

url = 'https://evangile21.thegospelcoalition.org/article/trouver-les-hauteurs-et-chercher-de-leau-lire-les-livres-des-rois/'
req = urllib.request.Request(url, headers={
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
})

with urllib.request.urlopen(req) as resp:
    html = resp.read().decode('utf-8')

soup = BeautifulSoup(html, 'html.parser')

bios = soup.select('.article_author_bio')
print(f"Found {len(bios)} .article_author_bio elements")
for i, b in enumerate(bios):
    print(f"\n--- BIO {i+1} ---")
    print(str(b))
