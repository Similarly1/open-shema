with open('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/web/index.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 'id="view-settings"' in line or 'id="view-search"' in line or 'id="view-articles"' in line:
        print(f"Line {i+1}: {line.strip()}")
