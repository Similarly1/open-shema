with open('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/web/index.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for line_idx in [1535, 1130, 945, 5582, 7551, 7643]:
    if 0 <= line_idx < len(lines):
        print(f"Line {line_idx+1}: {lines[line_idx].strip()}")
