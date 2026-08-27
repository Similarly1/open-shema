import urllib.request
import re
import json

# Fetch TPSG podcast feed or show
try:
    # Let's search the TPSG podcast RSS or check other sources
    url = 'https://toutpoursagloire.com/feed/podcast/'
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as resp:
        xml = resp.read().decode('utf-8')
        items = re.findall(r'<item>([\s\S]*?)</item>', xml)
        print(f'Found {len(items)} items in podcast feed')
        for item in items[:15]:
            title = re.search(r'<title>([^<]+)</title>', item)
            enclosure = re.search(r'<enclosure[^>]+url=["\']([^"\']+)["\']', item)
            if title and ('unite' in title.group(1).lower() or 'corinthiens' in title.group(1).lower() or 'samuel' in title.group(1).lower()):
                print('Match title:', title.group(1))
                if enclosure:
                    print('Enclosure:', enclosure.group(1))
except Exception as e:
    print('Error podcast feed:', e)
