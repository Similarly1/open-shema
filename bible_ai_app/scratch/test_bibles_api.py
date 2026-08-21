import sys
sys.path.insert(0, '.')
from webview_app import BibleAppApi
api = BibleAppApi()
bibles = api.get_installed_bibles()
for b in bibles:
    if b['name'] in ['SV', 'PV', 'Parole Vivante', 'Sagesse Vivante', 'JXLFR', 'BENFS', 'Segond 21', 'OST']:
        print(f"{b['name']} ({b['version_code']}): total={len(b['available_books'])}, first={b['first_book']}, books={b['available_books'][:5]}")
