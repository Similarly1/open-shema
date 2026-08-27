from html.parser import HTMLParser

class PreciseChecker(HTMLParser):
    def __init__(self):
        super().__init__()
        self.stack = []

    def handle_starttag(self, tag, attrs):
        if tag not in ['img', 'input', 'br', 'hr', 'meta', 'link', 'source']:
            self.stack.append((tag, self.getpos()))

    def handle_endtag(self, tag):
        if tag in ['img', 'input', 'br', 'hr', 'meta', 'link', 'source']:
            return
        if not self.stack:
            print(f"Extra closing tag </{tag}> at line {self.getpos()[0]}")
            return
        last_tag, pos = self.stack.pop()
        if last_tag != tag:
            print(f"MISMATCH at line {self.getpos()[0]}: closed </{tag}> but top of stack was <{last_tag}> from line {pos[0]}")
            # Try to see if it's one level deeper
            if self.stack and self.stack[-1][0] == tag:
                print(f"  -> Skipping unclosed <{last_tag}> from line {pos[0]}")

with open('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/web/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

c = PreciseChecker()
c.feed(content)
