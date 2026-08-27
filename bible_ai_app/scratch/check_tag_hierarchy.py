from html.parser import HTMLParser

class TagChecker(HTMLParser):
    def __init__(self):
        super().__init__()
        self.stack = []
        self.errors = []
        self.line = 0

    def handle_starttag(self, tag, attrs):
        if tag not in ['img', 'input', 'br', 'hr', 'meta', 'link', 'source', 'polyline', 'line', 'circle', 'path', 'polygon', 'rect']:
            self.stack.append((tag, self.getpos()))

    def handle_endtag(self, tag):
        if tag in ['img', 'input', 'br', 'hr', 'meta', 'link', 'source', 'polyline', 'line', 'circle', 'path', 'polygon', 'rect']:
            return
        if not self.stack:
            self.errors.append(f"Extra closing tag </{tag}> at {self.getpos()}")
            return
        last_tag, pos = self.stack.pop()
        if last_tag != tag:
            self.errors.append(f"Mismatched closing tag </{tag}> at {self.getpos()}, expected </{last_tag}> opened at {pos}")

with open('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/web/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

checker = TagChecker()
checker.feed(content)
print(f"Errors found: {len(checker.errors)}")
for err in checker.errors[:10]:
    print(" -", err)
print(f"Unclosed tags in stack: {len(checker.stack)}")
for t in checker.stack[-10:]:
    print(" -", t)
