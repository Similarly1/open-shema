with open('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/web/index.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

opens = 0
closes = 0
for i in range(1540, 3224):
    line = lines[i]
    o = line.count('<div')
    c = line.count('</div')
    opens += o
    closes += c
    if opens != closes and i > 3210:
        print(f"Line {i+1}: opens={opens}, closes={closes}, diff={opens-closes}")
print(f"Total in view-settings: opens={opens}, closes={closes}, diff={opens-closes}")
