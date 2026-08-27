import urllib.request
from bs4 import BeautifulSoup
import re

url = 'https://evangile21.thegospelcoalition.org/article/je-me-confie-en-jesus-un-chant-pour-les-jours-de-doute/'
req = urllib.request.Request(url, headers={
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
})

with urllib.request.urlopen(req) as resp:
    html = resp.read().decode('utf-8')

soup = BeautifulSoup(html, 'html.parser')

print("=== ALL IMAGES & BACKGROUND IMAGES IN PAGE ===")
for img in soup.find_all('img'):
    print("img:", img.get('src') or img.get('data-src') or img.get('data-lazy-src'), "class:", img.get('class'))

for el in soup.find_all(attrs={"data-bg-image": True}):
    print("data-bg-image:", el.get('data-bg-image'), "class:", el.get('class'))

for el in soup.find_all(attrs={"style": re.compile(r'background-image', re.I)}):
    print("style bg:", el.get('style'), "class:", el.get('class'))

print("\n=== SELECTORS FOR AUTHOR AVATAR ===")
print("select .author_img_wrap:", soup.select('.author_img_wrap'))
print("select .author_bio:", soup.select('.article_author_bio'))
print("select .author-avatar, .avatar:", soup.select('.author-avatar, .avatar'))
