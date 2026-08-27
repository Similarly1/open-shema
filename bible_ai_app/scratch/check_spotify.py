import urllib.request

urls = [
    'https://open.spotify.com/episode/1zS5v0613aqqzdklFvQW40',
    'https://open.spotify.com/embed/episode/1zS5v0613aqqzdklFvQW40',
    'https://open.spotify.com/embed/episode/164ZEuaP0crW0Oit3k8sQo',
    'https://open.spotify.com/embed/episode/7nxETlmx0ttYEQV8TnplCq',
]

for u in urls:
    try:
        req = urllib.request.Request(u, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as resp:
            print(f'{u} -> HTTP {resp.status}')
    except urllib.error.HTTPError as e:
        print(f'{u} -> HTTP ERROR {e.code}')
    except Exception as e:
        print(f'{u} -> ERROR {e}')
