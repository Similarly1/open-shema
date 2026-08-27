from bs4 import BeautifulSoup

with open('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/web/index.html', 'r', encoding='utf-8') as f:
    html = f.read()

soup = BeautifulSoup(html, 'html.parser')

view_articles = soup.find(id='view-articles')
if view_articles:
    print('Found #view-articles!')
    print('Parent of #view-articles:', view_articles.parent.get('class'), view_articles.parent.get('id'))
    print('Classes of #view-articles:', view_articles.get('class'))
    print('Children of #view-articles:', [c.get('id') or c.get('class') for c in view_articles.children if hasattr(c, 'get')])
else:
    print('ERROR: #view-articles NOT FOUND in DOM tree!')

# Check all app views
views = soup.find_all(class_='app-view')
print(f'Total .app-view elements: {len(views)}')
for v in views:
    print(' -', v.get('id'), '| parent:', v.parent.get('id') or v.parent.get('class'))
