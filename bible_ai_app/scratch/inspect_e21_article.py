import urllib.request
import re
from bs4 import BeautifulSoup

url = 'https://evangile21.thegospelcoalition.org/article/quelle-est-la-relation-entre-la-theologie-biblique-et-la-theologie-systematique/'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})

try:
    with urllib.request.urlopen(req) as resp:
        html = resp.read().decode('utf-8')
        soup = BeautifulSoup(html, 'html.parser')
        print('Title:', soup.title.string if soup.title else 'N/A')
        
        # Check potential content containers
        content = soup.select_one('.entry-content, .post-content, .article-content, main article')
        if content:
            print('Found content container:', content.name, content.get('class'))
            print('Text snippet:', content.get_text()[:300].strip())
        else:
            print('No standard content container found')
            
        # Check logo
        logos = soup.select('header img, .site-logo img, .custom-logo, header svg')
        print('Found header logo elements:', len(logos))
        for l in logos:
            print('  Logo:', l.get('src') or l.get('class'))
except Exception as e:
    print('Error:', e)
