from html.parser import HTMLParser

class ViewSettingsChecker(HTMLParser):
    def __init__(self):
        super().__init__()
        self.stack = []
        self.active = False

    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        if attrs_dict.get('id') == 'view-settings':
            self.active = True
        if self.active:
            if tag not in ['img', 'input', 'br', 'hr', 'meta', 'link', 'source', 'polyline', 'line', 'circle', 'path', 'polygon', 'rect']:
                self.stack.append((tag, self.getpos(), attrs_dict.get('id') or attrs_dict.get('class')))

    def handle_endtag(self, tag):
        if not self.active:
            return
        if tag in ['img', 'input', 'br', 'hr', 'meta', 'link', 'source', 'polyline', 'line', 'circle', 'path', 'polygon', 'rect']:
            return
        if not self.stack:
            print(f"Extra closing tag </{tag}> at line {self.getpos()[0]}")
            return
        last_tag, pos, ident = self.stack.pop()
        if last_tag != tag:
            print(f"Mismatch in view-settings: closed </{tag}> at line {self.getpos()[0]}, was <{last_tag}> (id/class={ident}) at line {pos[0]}")
        if ident == 'view-settings' and tag == 'div':
            self.active = False
            print(f"Successfully closed view-settings at line {self.getpos()[0]}")

with open('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/web/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

c = ViewSettingsChecker()
c.feed(content)
print(f"Remaining open tags in view-settings: {len(c.stack)}")
for t in c.stack:
    print(" -", t)
