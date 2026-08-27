from html.parser import HTMLParser

class AISectionChecker(HTMLParser):
    def __init__(self):
        super().__init__()
        self.stack = []
        self.active = False

    def handle_starttag(self, tag, attrs):
        if self.getpos()[0] >= 2974:
            return
        attrs_dict = dict(attrs)
        if attrs_dict.get('id') == 'sec-ai':
            self.active = True
        if self.active:
            if tag not in ['img', 'input', 'br', 'hr', 'meta', 'link', 'source', 'polyline', 'line', 'circle', 'path', 'polygon', 'rect']:
                self.stack.append((tag, self.getpos()[0], attrs_dict.get('id') or attrs_dict.get('class')))

    def handle_endtag(self, tag):
        if self.getpos()[0] >= 2974:
            return
        if not self.active:
            return
        if tag in ['img', 'input', 'br', 'hr', 'meta', 'link', 'source', 'polyline', 'line', 'circle', 'path', 'polygon', 'rect']:
            return
        if self.stack:
            self.stack.pop()

with open('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/web/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

c = AISectionChecker()
c.feed(content)
print(f"Tags still open in sec-ai at line 2974 (count={len(c.stack)}):")
for t in c.stack:
    print(" -", t)
