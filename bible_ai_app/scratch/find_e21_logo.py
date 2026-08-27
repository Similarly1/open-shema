import urllib.request
import re

url = 'https://evangile21.thegospelcoalition.org/'
req = urllib.request.Request(url, headers={
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7'
})
try:
    with urllib.request.urlopen(req) as resp:
        html = resp.read().decode('utf-8')
        svgs = re.findall(r'(<svg[^>]*class=["\'][^"\']*logo[^"\']*["\'][\s\S]*?</svg>)', html, re.I)
        print('Found logo svgs:', len(svgs))
        if svgs:
            print(svgs[0][:400])
        imgs = re.findall(r'<img[^>]+src=["\']([^"\']+(?:logo|e21|tgc|evangile)[^"\']*)["\']', html, re.I)
        print('Found logo images:', imgs)
        icons = re.findall(r'<link[^>]+rel=["\'](?:icon|shortcut icon|apple-touch-icon)["\'][^>]+href=["\']([^"\']+)["\']', html, re.I)
        print('Found icons:', icons)
except Exception as e:
    print('Error:', e)
