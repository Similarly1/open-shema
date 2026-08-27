from html.parser import HTMLParser

class StepInspector(HTMLParser):
    def __init__(self):
        super().__init__()
        self.stack = []

    def handle_starttag(self, tag, attrs):
        if tag not in ['img', 'input', 'br', 'hr', 'meta', 'link', 'source', 'polyline', 'line', 'circle', 'path', 'polygon', 'rect']:
            attrs_dict = dict(attrs)
            ident = attrs_dict.get('id') or attrs_dict.get('class') or tag
            self.stack.append((tag, self.getpos()[0], ident))

    def handle_endtag(self, tag):
        if tag in ['img', 'input', 'br', 'hr', 'meta', 'link', 'source', 'polyline', 'line', 'circle', 'path', 'polygon', 'rect']:
            return
        if self.stack:
            last = self.stack.pop()
            if self.getpos()[0] >= 3205 and self.getpos()[0] <= 3225:
                print(f"Line {self.getpos()[0]}: closed </{tag}>, popped <{last[0]}> (opened at line {last[1]}: {last[2]})")

with open('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/web/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

c = StepInspector()
c.feed(content)
