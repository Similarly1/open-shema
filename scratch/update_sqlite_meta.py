import sqlite3
import os

repo_dir = r"c:\Users\adrie\Documents\antigravity\peaceful-mendeleev\scratch\open-shema-data\data\bibles"

# 1. LSG
lsg_path = os.path.join(repo_dir, "bible_lsg1910.sqlite")
if os.path.exists(lsg_path):
    conn = sqlite3.connect(lsg_path)
    cur = conn.cursor()
    cur.execute("REPLACE INTO metadata (key, value) VALUES ('title', 'Louis Segond 1910 (avec Strongs)')")
    cur.execute("REPLACE INTO metadata (key, value) VALUES ('description', 'Bible Louis Segond 1910 avec numérotation Strong complète (Hébreu & Grec)')")
    conn.commit()
    conn.close()
    print("LSG metadata updated.")

# 2. Darby
darby_path = os.path.join(repo_dir, "bible_darby.sqlite")
if os.path.exists(darby_path):
    conn = sqlite3.connect(darby_path)
    cur = conn.cursor()
    cur.execute("REPLACE INTO metadata (key, value) VALUES ('title', 'Bible J.N. Darby (avec Strong)')")
    cur.execute("REPLACE INTO metadata (key, value) VALUES ('description', 'Traduction littérale et rigoureuse de John Nelson Darby (66 livres, 31 171 versets) avec balisage Strong complet.')")
    conn.commit()
    conn.close()
    print("Darby metadata updated.")
