import os, glob

files = glob.glob('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/data/articles/content/**/*.md', recursive=True)
print(f"Total markdown files: {len(files)}")
for f in files:
    with open(f, 'r', encoding='utf-8') as fp:
        content = fp.read()
    if 'Editors' in content or 'Initialement publié' in content or 'Note de l’éditeur' in content:
        print("Found matching file:", f)
        print("First 600 chars:")
        print(content[:600])
        print("="*60)
