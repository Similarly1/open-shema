import json
import sqlite3
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

base_dir = os.path.dirname(os.path.abspath(__file__))
while not os.path.exists(os.path.join(base_dir, "core")):
    base_dir = os.path.dirname(base_dir)

db_path = os.path.join(base_dir, "data", "commentaires", "commentaires_master.db")
lib_path = os.path.join(base_dir, "data", "library.json")

conn = sqlite3.connect(db_path)
cur = conn.cursor()
cur.execute("SELECT commentary_id, commentary_name, COUNT(*) FROM commentaries GROUP BY commentary_id, commentary_name")
rows = cur.fetchall()
conn.close()

with open(lib_path, "r", encoding="utf-8") as f:
    lib = json.load(f)

print(f"Commentaries found in SQLite ({len(rows)}):")
added_count = 0
for cid, cname, cnt in rows:
    print(f"• [{cid}] {cname} : {cnt} passages")
    if cname not in lib:
        lib[cname] = {
            "title": cname,
            "author": cname.replace("Commentaire de ", "").replace("Commentaire Biblique de ", "").replace("Commentaire Biblique par ", "").replace("Commentaire ", ""),
            "description": f"Commentaire biblique ({cnt} passages indexés)",
            "year": "",
            "cover_path": None,
            "type": "Commentaire",
            "format": "sqlite",
            "commentary_id": cid,
            "chunks_count": cnt,
            "embedding_model": "study_library",
            "active": True
        }
        added_count += 1
    else:
        lib[cname]["chunks_count"] = cnt
        lib[cname]["active"] = True

with open(lib_path, "w", encoding="utf-8") as f:
    json.dump(lib, f, ensure_ascii=False, indent=2)

print(f"\n✅ Total entries in library.json: {len(lib)} (+{added_count} newly registered).")
