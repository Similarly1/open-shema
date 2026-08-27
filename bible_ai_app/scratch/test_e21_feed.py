import urllib.request
import re
import json

url = 'https://evangile21.thegospelcoalition.org/feed/'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})

try:
    with urllib.request.urlopen(req) as resp:
        xml = resp.read().decode('utf-8')
        print(f'Feed XML length: {len(xml)}')
        items = re.findall(r'<item>([\s\S]*?)</item>', xml)
        print(f'Found {len(items)} items in E21 feed')
        for i, item in enumerate(items[:5]):
            title = re.search(r'<title>([^<]+)</title>', item)
            link = re.search(r'<link>([^<]+)</link>', item)
            creator = re.search(r'<dc:creator><!\[CDATA\[(.*?)\]\]></dc:creator>', item) or re.search(r'<dc:creator>([^<]+)</dc:creator>', item)
            pubDate = re.search(r'<pubDate>([^<]+)</pubDate>', item)
            print(f'Item {i+1}:')
            print('  Title:', title.group(1) if title else 'N/A')
            print('  Link:', link.group(1) if link else 'N/A')
            print('  Author:', creator.group(1) if creator else 'N/A')
            print('  Date:', pubDate.group(1) if pubDate else 'N/A')
            print('-'*40)
except Exception as e:
    print('Error:', e)
