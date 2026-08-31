#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Script d'optimisation et de raffinement des commentaires TGC (The Gospel Coalition) en français :
1. Extraction et assignation des introductions générales au livre en (Chapitre 0, Verset 0-0).
2. Mise en forme riche et hiérarchique du Plan du livre (Niveaux I, A, 1, a).
3. Mise en forme des cartes 'But' et 'Verset clé'.
4. Synchronisation complète dans `data/commentaires/tgc_francais/livres/` et `commentaires_master.db`.
"""

import os
import sys
import json
import re
import sqlite3
from typing import Dict, List, Any, Tuple

if sys.stdout:
    sys.stdout.reconfigure(encoding='utf-8')

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
APP_DIR = os.path.dirname(CURRENT_DIR)
LIVRES_DIR = os.path.join(APP_DIR, "data", "commentaires", "tgc_francais", "livres")
DB_PATH = os.path.join(APP_DIR, "data", "commentaires", "commentaires_master.db")

ROMAN_NUMS = [
    "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X",
    "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX",
    "XXI", "XXII", "XXIII", "XXIV", "XXV", "XXVI", "XXVII", "XXVIII", "XXIX", "XXX"
]

def format_intro_reference(book_name: str) -> str:
    """Génère une référence élégante en français pour l'introduction."""
    b_lower = book_name.lower().strip()
    if b_lower.startswith(("1 ", "2 ", "3 ")):
        return f"Introduction à {book_name}"
    elif b_lower.startswith(("psaume", "actes", "proverbes", "lamentations", "hébreux")):
        return f"Introduction aux {book_name}"
    elif b_lower[0] in "aeiouyéèêâîôû":
        return f"Introduction à l'{book_name}"
    elif b_lower in ["genèse", "bible"]:
        return f"Introduction à la {book_name}"
    else:
        return f"Introduction à {book_name}"


def parse_and_format_outline(lines: List[str]) -> str:
    """
    Parse les lignes du plan d'un livre TGC en HTML hiérarchique élégant avec indentation.
    Niveau 1: Chiffres Romains (I, II, III...)
    Niveau 2: Lettres majuscules (A, B, C, ..., H, I, J, K...)
    Niveau 3: Chiffres arabes (1, 2, 3...)
    Niveau 4: Lettres minuscules ou sous-points (a, b, c...)
    """
    res = []
    last_level = 0
    last_letter = None
    next_expected_roman_idx = 0

    re_line = re.compile(r'^([A-Za-z0-9\(\)]+[\.\)]?)\s+(.*)$')

    res.append('<div class="comm-outline-tree">')

    for line in lines:
        s = line.strip()
        if not s:
            continue
            
        m = re_line.match(s)
        if not m:
            res.append(f'  <div class="comm-outline-note">{s}</div>')
            continue

        raw_num = m.group(1).rstrip('.')
        content = m.group(2).strip()

        # 1. Chiffre Romain (Niveau 1)
        is_roman = False
        if next_expected_roman_idx < len(ROMAN_NUMS) and raw_num.upper() == ROMAN_NUMS[next_expected_roman_idx]:
            if raw_num.upper() == "I" and last_letter == "H" and last_level == 2:
                is_roman = False
            else:
                is_roman = True

        if is_roman:
            next_expected_roman_idx += 1
            last_level = 1
            last_letter = None
            res.append(f'  <div class="comm-outline-item lvl-1"><span class="comm-outline-num">{raw_num.upper()}.</span><span class="comm-outline-text">{content}</span></div>')
            continue

        # 2. Lettre majuscule (Niveau 2)
        if len(raw_num) == 1 and raw_num.isupper() and raw_num.isalpha():
            last_level = 2
            last_letter = raw_num
            res.append(f'  <div class="comm-outline-item lvl-2"><span class="comm-outline-num">{raw_num}.</span><span class="comm-outline-text">{content}</span></div>')
            continue

        # 3. Chiffre arabe (Niveau 3)
        if raw_num.isdigit():
            last_level = 3
            res.append(f'  <div class="comm-outline-item lvl-3"><span class="comm-outline-num">{raw_num}.</span><span class="comm-outline-text">{content}</span></div>')
            continue

        # 4. Sous-points
        res.append(f'  <div class="comm-outline-item lvl-4"><span class="comm-outline-num">{raw_num}</span><span class="comm-outline-text">{content}</span></div>')

    res.append('</div>')
    return "\n".join(res)


def refine_intro_text(text: str, paragraphs: List[str]) -> Tuple[str, List[str]]:
    """
    Raffinement complet du texte et des paragraphes d'une introduction générale :
    - Détection et mise en forme de '### But' / '### Objectif'
    - Détection et mise en forme de '### Verset clé'
    - Détection et structuration hiérarchique de '### Plan'
    """
    new_paragraphs = []
    in_plan = False
    plan_lines = []

    # Regex pour identifier les sections
    re_goal_heading = re.compile(r'^(?:###\s*)?(?:But|Objectif|But du livre|Thème principal)\s*:?$', re.IGNORECASE)
    re_keyverse_heading = re.compile(r'^(?:###\s*)?Verset[s]?\s+cl[ée][s]?\s*:?$', re.IGNORECASE)
    re_plan_heading = re.compile(r'^(?:###\s*)?(?:Plan|Structure|Plan du livre|Aperçu de la structure)\s*:?$', re.IGNORECASE)

    i = 0
    while i < len(paragraphs):
        p = paragraphs[i].strip()
        
        # 1. Section But / Objectif
        if re_goal_heading.match(p):
            goal_content = []
            i += 1
            while i < len(paragraphs) and not re_keyverse_heading.match(paragraphs[i]) and not re_plan_heading.match(paragraphs[i]) and not paragraphs[i].startswith("### "):
                goal_content.append(paragraphs[i].strip())
                i += 1
            
            goal_body = "\n\n".join(goal_content)
            card_html = (
                '<div class="comm-intro-card comm-intro-goal">\n'
                '  <div class="comm-intro-card-header">\n'
                '    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m10 15 5-3-5-3v6Z"/></svg>\n'
                '    <span>But du livre</span>\n'
                '  </div>\n'
                f'  <div class="comm-intro-card-body">\n    {goal_body}\n  </div>\n'
                '</div>'
            )
            new_paragraphs.append(card_html)
            continue

        # 2. Section Verset clé
        if re_keyverse_heading.match(p):
            kv_content = []
            i += 1
            while i < len(paragraphs) and not re_plan_heading.match(paragraphs[i]) and not paragraphs[i].startswith("### "):
                kv_content.append(paragraphs[i].strip())
                i += 1
            
            # Séparer la citation de la référence
            quote_text = ""
            ref_text = ""
            for line in kv_content:
                if line.startswith(("—", "-", "— ")):
                    ref_text = line.lstrip("—- ").strip()
                elif not quote_text:
                    quote_text = line
                else:
                    if not ref_text and line.strip().startswith(("Gen", "Ex", "Mat", "Jean", "Rom", "1 ", "2 ", "Ap")):
                        ref_text = line.strip()
                    else:
                        quote_text += f"\n\n{line}"

            card_html = (
                '<div class="comm-intro-card comm-intro-keyverse">\n'
                '  <div class="comm-intro-card-header">\n'
                '    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z"/></svg>\n'
                '    <span>Verset clé</span>\n'
                '  </div>\n'
                '  <div class="comm-intro-card-body">\n'
                f'    <blockquote class="comm-keyverse-quote">{quote_text}</blockquote>\n'
                f'    {f"""<div class="comm-keyverse-ref">— {ref_text}</div>""" if ref_text else ""}\n'
                '  </div>\n'
                '</div>'
            )
            new_paragraphs.append(card_html)
            continue

        # 3. Section Plan
        if re_plan_heading.match(p):
            in_plan = True
            i += 1
            while i < len(paragraphs) and not paragraphs[i].startswith("### "):
                plan_lines.append(paragraphs[i].strip())
                i += 1
            
            tree_html = parse_and_format_outline(plan_lines)
            heading_html = (
                '<h3 class="comm-body-h3 comm-outline-heading">\n'
                '  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>\n'
                '  <span>Plan d\'ensemble du livre</span>\n'
                '</h3>'
            )
            new_paragraphs.append(f"{heading_html}\n{tree_html}")
            continue

        new_paragraphs.append(paragraphs[i])
        i += 1

    refined_text = "\n\n".join(new_paragraphs)
    return refined_text, new_paragraphs


def process_all_books():
    """Parcourt et optimise l'ensemble des 66 livres traduits de TGC."""
    if not os.path.exists(LIVRES_DIR):
        print(f"❌ Dossier introuvable : {LIVRES_DIR}")
        return

    files = sorted([f for f in os.listdir(LIVRES_DIR) if f.endswith(".json")])
    print(f"📖 Optimisation de {len(files)} livres TGC...")

    modified_books_count = 0
    intros_isolated_count = 0

    for f in files:
        f_path = os.path.join(LIVRES_DIR, f)
        with open(f_path, "r", encoding="utf-8") as jf:
            b_data = json.load(jf)

        b_name = b_data.get("book_name", f)
        b_code = b_data.get("book_code", "")
        chapters = b_data.get("chapters", [])

        if not chapters:
            continue

        ch0 = chapters[0]
        verses = ch0.get("verses", [])
        if not verses:
            continue

        v0 = verses[0]
        v1 = verses[1] if len(verses) > 1 else None

        # Détection si v0 est une introduction générale
        is_intro = False
        v0_title = v0.get("title", "")
        v0_text = v0.get("text", "")
        
        if any(w in v0_title.lower() for w in ["introduction", "invitation", "pourquoi et par qui", "aperçu", "remarques", "contexte", "auteur", "vue d'ensemble", "paternité"]):
            is_intro = True
        elif "### but" in v0_text.lower() or "### plan" in v0_text.lower() or "### verset clé" in v0_text.lower() or "### objectif" in v0_text.lower() or "but du livre" in v0_text.lower():
            is_intro = True
        elif v1 and v0.get("verse_start") == 1 and v0.get("verse_end") == 1 and v1.get("verse_start") == 1:
            is_intro = True

        if is_intro:
            intros_isolated_count += 1
            # 1. Raffiner le contenu de l'intro
            refined_txt, refined_paras = refine_intro_text(v0_text, v0.get("paragraphs", []))
            
            # 2. Configurer le chunk intro en Chapitre 0, Verset 0-0
            v0["chapter"] = 0
            v0["verse_start"] = 0
            v0["verse_end"] = 0
            v0["title"] = f"Introduction à {b_name}"
            v0["reference"] = format_intro_reference(b_name)
            v0["keys"] = [f"{b_code}.0.0"]
            v0["text"] = refined_txt
            v0["paragraphs"] = refined_paras

            # 3. Structurer le chapitre 0 séparé
            # Si le premier chapitre dans `chapters` contient l'intro et d'autres versets de Ch.1
            if ch0.get("chapter") == 1:
                # Retirer v0 de Ch.1
                ch0["verses"] = verses[1:]
                ch0["verse_count"] = len(ch0["verses"])
                
                # Créer une entrée Chapter 0
                intro_chapter = {
                    "chapter": 0,
                    "verse_count": 1,
                    "verses": [v0]
                }
                # Insérer au tout début de la liste des chapitres
                b_data["chapters"] = [intro_chapter] + chapters
            elif ch0.get("chapter") == 0:
                # Déjà en chapter 0, mettre à jour
                ch0["verses"][0] = v0

        # Sauvegarder le fichier JSON mis à jour
        with open(f_path, "w", encoding="utf-8") as jf:
            json.dump(b_data, jf, ensure_ascii=False, indent=2)

        modified_books_count += 1

    print(f"✅ {modified_books_count} livres traités !")
    print(f"🎯 {intros_isolated_count} introductions générales assignées à Chapitre 0 / Verset 0-0 !")

    # Resynchronisation SQLite
    sync_sqlite_master()


def sync_sqlite_master():
    """Synchronise l'ensemble des commentaires TGC français raffinés dans commentaires_master.db."""
    if not os.path.exists(LIVRES_DIR):
        return

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS commentaries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            commentary_id TEXT,
            commentary_name TEXT,
            book_code TEXT,
            book_name TEXT,
            chapter INTEGER,
            verse_start INTEGER,
            verse_end INTEGER,
            reference TEXT,
            text TEXT,
            paragraphs_json TEXT,
            html TEXT,
            source_url TEXT
        )
    """)
    cur.execute("CREATE INDEX IF NOT EXISTS idx_comm_book_chap ON commentaries (commentary_id, book_code, chapter, verse_start)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_book_chap_verse ON commentaries (book_code, chapter, verse_start)")

    comm_id = "tgc_francais"
    comm_name = "Commentaires The Gospel Coalition (TGC)"

    # Supprimer toute ancienne version de TGC (anglaise ou précédente française)
    cur.execute("DELETE FROM commentaries WHERE commentary_id IN ('tgc_francais', 'tgc_complete')")

    rows = []
    total_passages = 0
    for f in sorted(os.listdir(LIVRES_DIR)):
        if not f.endswith(".json"):
            continue
        try:
            with open(os.path.join(LIVRES_DIR, f), "r", encoding="utf-8") as jf:
                b_data = json.load(jf)
            
            b_code = b_data.get("book_code", "")
            b_name = b_data.get("book_name", "")
            author = b_data.get("author", "Auteur TGC")

            for ch in b_data.get("chapters", []):
                chap_num = ch.get("chapter", 1)
                for v in ch.get("verses", []):
                    total_passages += 1
                    ref_display = f"{v.get('reference', '')} ({author})"
                    rows.append((
                        comm_id,
                        comm_name,
                        b_code,
                        b_name,
                        chap_num,
                        v.get("verse_start", 0),
                        v.get("verse_end", 0),
                        ref_display,
                        v.get("text", ""),
                        json.dumps(v.get("paragraphs", []), ensure_ascii=False),
                        "",
                        v.get("url", "")
                    ))
        except Exception as e:
            print(f"⚠️ Erreur sync SQLite {f} : {e}")

    if rows:
        cur.executemany("""
            INSERT INTO commentaries (
                commentary_id, commentary_name, book_code, book_name,
                chapter, verse_start, verse_end, reference, text,
                paragraphs_json, html, source_url
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, rows)
        conn.commit()
        print(f"✅ Synchronisation SQLite : {len(rows)} sections TGC enregistrées dans {DB_PATH} !")

    conn.close()

if __name__ == "__main__":
    process_all_books()
