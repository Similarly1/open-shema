import urllib.request

url = 'https://evangile21.thegospelcoalition.org/icon.svg'
req = urllib.request.Request(url, headers={
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
})
try:
    with urllib.request.urlopen(req) as resp:
        content = resp.read().decode('utf-8')
        print('SVG length:', len(content))
        print(content[:500])
        with open('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/web/img/sources/e21.svg', 'w', encoding='utf-8') as f:
            f.write(content)
        print('Saved to web/img/sources/e21.svg')
except Exception as e:
    print('Error:', e)
