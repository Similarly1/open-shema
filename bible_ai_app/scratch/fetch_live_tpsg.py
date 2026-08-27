import urllib.request
import re

url = 'https://toutpoursagloire.com/podcasts/predications-tpsg/unite-eglise-samuel-laurent/'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req) as resp:
        html = resp.read().decode('utf-8')
        spotify = re.findall(r'(https?://[^\s"\'<>]+spotify[^\s"\'<>]+)', html)
        print('Spotify links found in HTML:')
        for s in set(spotify):
            print(' -', s)
        iframe = re.findall(r'<iframe[^>]+src=["\']([^"\']+)["\']', html)
        print('All iframe srcs:')
        for i in iframe:
            print(' -', i)
        audio = re.findall(r'<audio[^>]+src=["\']([^"\']+)["\']', html)
        print('All audio srcs:')
        for a in audio:
            print(' -', a)
except Exception as e:
    print('Error:', e)
