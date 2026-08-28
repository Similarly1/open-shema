#!/usr/bin/env python3
"""
Générateur de bases SQLite pour les Bibles Open Shema (LSG 1910 et Darby avec Strongs).
Lit les 66 fichiers JSON de chaque version et produit un fichier SQLite optimisé.
"""

import glob
import json
import os
import re
import sqlite3
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

def strip_tags(text: str) -> str:
    # Retirer les notes de bas de page d'abord
    clean = re.sub(r'<note[^>]*>.*?</note>', '', text, flags=re.DOTALL)
    # Retirer toutes les balises XML/HTML (<w strong="...">, <p>, </p>, <divineName>, etc.)
    clean = re.sub(r'<[^>]+>', '', clean)
    # Nettoyer les espaces multiples
    clean = re.sub(r'\s+', ' ', clean).strip()
    return clean

def build_bible_sqlite(json_dir: str, output_sqlite: str, meta: dict):
    print(f"🔨 Construction de {output_sqlite} à partir de {json_dir}...")
    
    if os.path.exists(output_sqlite):
        os.remove(output_sqlite)

    conn = sqlite3.connect(output_sqlite)
    cur = conn.cursor()

    # Appliquer le schéma standard
    cur.executescript("""
    CREATE TABLE metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    );

    CREATE TABLE books (
        id INTEGER PRIMARY KEY,
        testament TEXT NOT NULL,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        short_name TEXT NOT NULL,
        chapters_count INTEGER NOT NULL,
        order_index INTEGER NOT NULL
    );

    CREATE TABLE verses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        book_id INTEGER NOT NULL,
        chapter INTEGER NOT NULL,
        verse INTEGER NOT NULL,
        text TEXT NOT NULL,
        text_strong TEXT,
        notes TEXT,
        FOREIGN KEY (book_id) REFERENCES books(id)
    );

    CREATE INDEX idx_verses_bcv ON verses(book_id, chapter, verse);
    CREATE INDEX idx_verses_lookup ON verses(book_id, chapter);
    """)

    # Insérer les métadonnées
    for k, v in meta.items():
        cur.execute("INSERT INTO metadata (key, value) VALUES (?, ?)", (k, str(v)))

    # Lister les 66 fichiers ordonnés
    json_files = sorted(glob.glob(os.path.join(json_dir, "*.json")))
    if not json_files:
        raise FileNotFoundError(f"Aucun fichier JSON trouvé dans {json_dir}")

    total_verses = 0

    for fpath in json_files:
        with open(fpath, "r", encoding="utf-8") as f:
            bdata = json.load(f)

        book_id = int(bdata.get("id"))
        code = bdata.get("code")
        name = bdata.get("name")
        total_ch = int(bdata.get("total_chapters", len(bdata.get("chapters", {}))))
        testament = "OT" if book_id <= 39 else "NT"
        short_name = code

        cur.execute("""
            INSERT INTO books (id, testament, code, name, short_name, chapters_count, order_index)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (book_id, testament, code, name, short_name, total_ch, book_id))

        chapters = bdata.get("chapters", {})
        for ch_num_str, verses_map in sorted(chapters.items(), key=lambda x: int(x[0])):
            ch_num = int(ch_num_str)
            for v_num_str, raw_text in sorted(verses_map.items(), key=lambda x: int(x[0])):
                v_num = int(v_num_str)
                clean_txt = strip_tags(raw_text)
                
                cur.execute("""
                    INSERT INTO verses (book_id, chapter, verse, text, text_strong)
                    VALUES (?, ?, ?, ?, ?)
                """, (book_id, ch_num, v_num, clean_txt, raw_text))
                total_verses += 1

    conn.commit()
    conn.execute("VACUUM;")
    conn.close()

    size_mb = os.path.getsize(output_sqlite) / (1024 * 1024)
    print(f"✅ {meta['title']} créé avec succès : {total_verses} versets ({size_mb:.2f} Mo).")
    return os.path.getsize(output_sqlite)

if __name__ == "__main__":
    base_repo = r"c:\Users\adrie\Documents\antigravity\peaceful-mendeleev"
    target_bibles_dir = os.path.join(base_repo, "scratch", "open-shema-data", "data", "bibles")
    os.makedirs(target_bibles_dir, exist_ok=True)

    # 1. Louis Segond 1910
    lsg_src = os.path.join(base_repo, "bible_ai_app", "data", "bibles", "LSG")
    lsg_dst = os.path.join(target_bibles_dir, "bible_lsg1910.sqlite")
    lsg_meta = {
        "id": "bible-lsg-1910",
        "title": "Louis Segond 1910",
        "abbreviation": "LSG",
        "language": "fr",
        "has_strong": "1",
        "license": "Public Domain",
        "author": "Louis Segond",
        "year": "1910",
        "description": "Texte biblique français classique de référence avec numérotation Strong complète."
    }
    lsg_size = build_bible_sqlite(lsg_src, lsg_dst, lsg_meta)

    # 2. J.N. Darby
    darby_src = os.path.join(base_repo, "bible_ai_app", "data", "bibles", "DARBY")
    darby_dst = os.path.join(target_bibles_dir, "bible_darby.sqlite")
    darby_meta = {
        "id": "bible-darby",
        "title": "Bible J.N. Darby",
        "abbreviation": "DARBY",
        "language": "fr",
        "has_strong": "1",
        "license": "Public Domain",
        "author": "John Nelson Darby",
        "year": "1885",
        "description": "Traduction littérale et rigoureuse de John Nelson Darby avec numérotation Strong."
    }
    darby_size = build_bible_sqlite(darby_src, darby_dst, darby_meta)

    print(f"\nTerminé ! LSG={lsg_size} octets, DARBY={darby_size} octets.")
