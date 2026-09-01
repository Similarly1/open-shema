#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script de Traduction IA Haute Fidélité par Lot pour A.T. Robertson - Word Pictures in the New Testament.
Modèles avec bascule automatique :
1. gemini-2.5-flash-lite
2. gemini-2.5-flash
3. gemini-3.5-flash-lite
"""

import os
import sys
import json
import re
import time
import sqlite3
import argparse
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
from threading import Lock
from typing import Dict, List, Any, Optional, Tuple

sys.stdout.reconfigure(encoding='utf-8')
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(CURRENT_DIR, "bible_ai_app"))

from core.config import load_config

THEOL_DB_PATH = os.path.join(CURRENT_DIR, "bible_ai_app", "data", "theology", "word_pictures_robertson.sqlite")
COMM_DB_PATH = os.path.join(CURRENT_DIR, "bible_ai_app", "data", "commentaires", "comm_robertson.sqlite")
MASTER_DB_PATH = os.path.join(CURRENT_DIR, "bible_ai_app", "data", "commentaires", "commentaires_master.db")

SYSTEM_PROMPT = """Tu es un traducteur théologique et exégète d'élite, expert en grammaire et syntaxe du grec biblique néotestamentaire.
Ta mission est de traduire de l'anglais vers un français d'excellence l'ouvrage exégétique monumental d'A.T. Robertson : « Word Pictures in the New Testament » (Images verbales du Nouveau Testament).

RÈGLES D'OR DE TRADUCTION & RIGUEUR EXÉGÉTIQUE :
1. FIDÉLITÉ ABSOLUE & INTÉGRALE (Zéro omission, zéro paraphrase) :
   - Traduis l'intégralité du texte sans rien omettre, ni abréger, ni résumer.
   - Ne formule AUCUN méta-commentaire (ex: "Voici la traduction :"), aucun préambule. Rends directement le texte pur.
2. PRÉSERVATION ABSOLUE DU GREC & DES NOTIONS TECHNIQUES :
   - Conserve STRICTEMENT intacts tous les mots grecs en alphabet grec (ex: βιβλος, γενεσεως, χριστος, λογος), leurs translittérations et l'analyse grammaticale.
   - Traduis la terminologie grammaticale anglaise en français exégétique standard :
     • "verbal adjective" -> "adjectif verbal"
     • "diminutive form" -> "forme diminutive"
     • "genitive absolute" -> "génitif absolu"
     • "aorist active / passive / middle" -> "aoriste actif / passif / moyen"
     • "linear / durative action" -> "action linéaire / durative"
     • "punctiliar action" -> "action ponctuelle"
     • "papyrus roll" -> "rouleau de papyrus"
3. STRUCTURE & TITRES MARKDOWN :
   - Conserve exactement les balises et titres Markdown : ## Livre Chapitre, ### Livre C:V, le gras <b> ou **, l'italique <i> ou *.
"""

db_lock = Lock()

MODELS_POOL = ["gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-3.5-flash-lite"]

def get_api_keys() -> List[str]:
    cfg = load_config()
    keys = []
    k1 = cfg.get("google_api_key") or cfg.get("gemini_api_key")
    if k1:
        keys.append(k1)
    k2 = cfg.get("google_api_key_2") or cfg.get("gemini_api_key_2")
    if k2 and k2 not in keys:
        keys.append(k2)
    return keys

def translate_text_with_gemini(text: str, api_key: str, max_retries: int = 4) -> str:
    headers = {"Content-Type": "application/json"}
    payload = {
        "systemInstruction": {"parts": [{"text": SYSTEM_PROMPT}]},
        "contents": [{"parts": [{"text": f"Traduis fidèlement ce texte exégétique en français en conservant tout le grec et les titres Markdown :\n\n{text}"}]}],
        "generationConfig": {"temperature": 0.1, "maxOutputTokens": 8192}
    }

    for model in MODELS_POOL:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
        for attempt in range(max_retries):
            try:
                resp = requests.post(url, headers=headers, json=payload, timeout=60)
                if resp.status_code == 200:
                    data = resp.json()
                    parts = data["candidates"][0]["content"]["parts"]
                    return parts[0]["text"].strip()
                elif resp.status_code == 429:
                    # If quota exhausted on this model, break to try next model in pool
                    if "limit: 500" in resp.text or "RESOURCE_EXHAUSTED" in resp.text:
                        break
                    time.sleep((attempt + 1) * 4)
                else:
                    time.sleep(2)
            except Exception:
                time.sleep(2)

    raise RuntimeError(f"Échec de traduction sur tous les modèles Gemini disponibles.")

def split_large_markdown(text: str, max_chunk_words: int = 1400) -> List[str]:
    sections = re.split(r'(?=\n###\s+)', text)
    chunks = []
    current_chunk = []
    current_words = 0

    for sec in sections:
        sec_words = len(re.findall(r'\b\w+\b', sec))
        if current_words + sec_words > max_chunk_words and current_chunk:
            chunks.append("\n".join(current_chunk))
            current_chunk = [sec]
            current_words = sec_words
        else:
            current_chunk.append(sec)
            current_words += sec_words

    if current_chunk:
        chunks.append("\n".join(current_chunk))

    return chunks

def process_chapter(section_id: int, api_key: str) -> Tuple[int, bool, str]:
    with db_lock:
        conn = sqlite3.connect(THEOL_DB_PATH)
        cur = conn.cursor()
        cur.execute("SELECT section_title, content_markdown, raw_markdown_en FROM sections WHERE id = ?", (section_id,))
        row = cur.fetchone()
        conn.close()

    if not row:
        return section_id, False, "Section introuvable"

    sec_title, content_md, raw_en = row
    source_text = raw_en if raw_en else content_md

    word_cnt = len(re.findall(r'\b\w+\b', source_text))

    try:
        if word_cnt > 1500:
            chunks = split_large_markdown(source_text, max_chunk_words=1100)
            translated_chunks = []
            for chk in chunks:
                tr = translate_text_with_gemini(chk, api_key)
                translated_chunks.append(tr)
                time.sleep(0.3)
            full_translated = "\n\n".join(translated_chunks)
        else:
            full_translated = translate_text_with_gemini(source_text, api_key)

        with db_lock:
            conn = sqlite3.connect(THEOL_DB_PATH)
            cur = conn.cursor()
            cur.execute("""
            UPDATE sections 
            SET content_markdown = ?, is_translated = 1 
            WHERE id = ?
            """, (full_translated, section_id))
            conn.commit()
            conn.close()

        return section_id, True, sec_title
    except Exception as e:
        return section_id, False, str(e)

def update_commentary_databases():
    print("\n--- Synchronisation des bases de commentaires verset par verset ---", flush=True)
    conn = sqlite3.connect(THEOL_DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT part_id, chapter_id, section_title, content_markdown FROM sections WHERE is_translated = 1")
    rows = cur.fetchall()
    conn.close()

    comm_conn = sqlite3.connect(COMM_DB_PATH)
    comm_cur = comm_conn.cursor()

    master_conn = sqlite3.connect(MASTER_DB_PATH)
    master_cur = master_conn.cursor()

    updated_count = 0
    for part_id, chapter_id, sec_title, content_md in rows:
        verse_blocks = re.split(r'(?=\n###\s+)', content_md)
        for v_blk in verse_blocks:
            m = re.search(r'###\s+([^\n]+)\n+(.*)', v_blk, re.DOTALL)
            if m:
                v_ref = m.group(1).strip()
                v_body = m.group(2).strip()

                comm_cur.execute("UPDATE comments SET content = ? WHERE verse_ref = ?", (v_body, v_ref))
                master_cur.execute("UPDATE commentaries SET text = ? WHERE commentary_id = 'robertson' AND reference = ?", (v_body, v_ref))
                updated_count += 1

    comm_conn.commit()
    comm_conn.close()

    master_conn.commit()
    master_conn.close()

    print(f"Synchronisé {updated_count} notices de commentaires traduites en français !", flush=True)

def main():
    parser = argparse.ArgumentParser(description="Batch translate A.T. Robertson to French with Gemini Flash Lite")
    parser.add_argument("--workers", type=int, default=3, help="Nombre de threads parallèles (défaut: 3)")
    parser.add_argument("--limit", type=int, default=0, help="Nombre maximal de chapitres à traduire (0 = tous)")
    args = parser.parse_args()

    api_keys = get_api_keys()
    if not api_keys:
        print("Erreur: Aucune clé API Google Gemini trouvée dans config.json !", flush=True)
        return

    print("==================================================================", flush=True)
    print("  TRADUCTION PAR LOT : A.T. ROBERTSON (WORD PICTURES IN THE NT)", flush=True)
    print(f"  Modèles de secours : {MODELS_POOL}", flush=True)
    print(f"  Threads parallèles : {args.workers}", flush=True)
    print("==================================================================", flush=True)

    conn = sqlite3.connect(THEOL_DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT id, order_index, section_title, word_count FROM sections WHERE is_translated = 0 ORDER BY order_index")
    pending = cur.fetchall()
    cur.execute("SELECT COUNT(*) FROM sections WHERE is_translated = 1")
    already_done = cur.fetchone()[0]
    conn.close()

    total_sections = len(pending) + already_done
    print(f"\nÉtat d'avancement : {already_done}/{total_sections} chapitres déjà traduits ({already_done/total_sections*100:.1f}%).", flush=True)

    if not pending:
        print("Tous les chapitres sont déjà traduits en français !", flush=True)
        update_commentary_databases()
        return

    if args.limit > 0:
        pending = pending[:args.limit]

    print(f"Chapitres à traduire dans cette session : {len(pending)}\n", flush=True)

    start_time = time.time()
    completed = 0
    errors = 0

    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = {}
        for idx, (sec_id, ord_idx, sec_title, w_cnt) in enumerate(pending):
            key = api_keys[idx % len(api_keys)]
            f = executor.submit(process_chapter, sec_id, key)
            futures[f] = (sec_id, ord_idx, sec_title)

        for future in as_completed(futures):
            sec_id, ord_idx, sec_title = futures[future]
            try:
                sid, success, msg = future.result()
                if success:
                    completed += 1
                    elapsed = time.time() - start_time
                    avg_speed = elapsed / completed if completed else 0
                    remaining = (len(pending) - completed) * avg_speed
                    print(f"[{completed + already_done}/{total_sections}] ✓ {sec_title} (Reste: {int(remaining//60)}m{int(remaining%60):02d}s)", flush=True)
                else:
                    errors += 1
                    print(f"[ERREUR] ✗ {sec_title} : {msg}", flush=True)
            except Exception as exc:
                errors += 1
                print(f"[EXCEPTION] {sec_title} : {exc}", flush=True)

    print("\nSession de traduction terminée !", flush=True)
    print(f"Succès : {completed}, Erreurs : {errors}", flush=True)
    update_commentary_databases()

if __name__ == "__main__":
    main()
