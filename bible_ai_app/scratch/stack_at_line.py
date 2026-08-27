from html.parser import HTMLParser

class StackAtLine(HTMLParser):
    def __init__(self, target_line):
        super().__init__()
        self.stack = []
        self.target_line = target_line

    def handle_starttag(self, tag, attrs):
        if self.getpos()[0] >= self.target_line:
            return
        if tag not in ['img', 'input', 'br', 'hr', 'meta', 'link', 'source', 'polyline', 'line', 'circle', 'path', 'polygon', 'rect']:
            attrs_dict = dict(attrs)
            self.stack.append((tag, self.getpos(), attrs_dict.get('id') or attrs_dict.get('class')))

    def handle_endtag(self, tag):
        if self.getpos()[0] >= self.target_line:
            return
        if tag in ['img', 'input', 'br', 'hr', 'meta', 'link', 'source', 'polyline', 'line', 'circle', 'path', 'polygon', 'rect']:
            return
        if self.stack:
            self.stack.pop()

with open('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/web/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

c = StackAtLine(3220)
c.feed(content)
print(f"Stack at line 3220 (count={len(c.stack)}):")
for t in c.stack:
    print(" -", t)
