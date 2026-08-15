import sys

with open('ai/llm_client.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
skip = False
for i, line in enumerate(lines):
    if 'def extract_cover_info(self, image_path):' in line:
        skip = True
    if skip and 'raise Exception(f"Erreur d\'embedding Gemini : {str(e)}")' in line:
        skip = False
        continue
    if not skip:
        new_lines.append(line)

with open('ai/llm_client.py', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)
