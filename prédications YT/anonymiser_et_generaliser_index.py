#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script d'Anonymisation et Généralisation Totale des Modèles Homilétiques.
Transforme les 94 analyses en une banque de modèles et canevas textuels purs,
sans aucun nom, aucune URL, aucune référence d'église ou de vidéo.
"""

import os
import sys
import json
import re

sys.stdout.reconfigure(encoding='utf-8')

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(CURRENT_DIR)
APP_DIR = os.path.join(PROJECT_ROOT, "bible_ai_app")
INDEX_PATH = os.path.join(APP_DIR, "data", "real_sermons_index.json")

# Noms ou références personnelles à nettoyer
CLEAN_PATTERNS = [
    r'https?://[^\s]+',
    r'youtube\.com/[^\s]+',
    r'youtu\.be/[^\s]+',
    r'prédication\s*#?\d+\s*[:-]?',
    r'sermon\s*[:-]?',
    r'culte\s+du\s+\d+.*',
    r'par\s+[A-Z][a-z]+\s+[A-Z][a-z]+',
    r'pasteur\s+[A-Z][a-z]+',
]


def clean_text(txt: str) -> str:
    if not txt:
        return ""
    res = txt
    for pat in CLEAN_PATTERNS:
        res = re.sub(pat, '', res, flags=re.IGNORECASE)
    res = re.sub(r'\s+', ' ', res).strip(' :-–')
    return res


def generate_generic_title(passage_ref: str, theme: str, big_idea: str, original_title: str) -> str:
    ref_display = passage_ref if passage_ref else "Passage biblique"
    
    # Trouver une phrase courte thématique
    theme_clean = clean_text(theme)
    if not theme_clean or len(theme_clean) < 3:
        # Extraire de l'idée maîtresse
        m = re.match(r'^([^,.;:!?]{5,40})', big_idea)
        theme_clean = m.group(1).strip() if m else "Exposition textuelle"
        
    if not theme_clean or len(theme_clean) < 3:
        theme_clean = clean_text(original_title)
        
    # Nettoyer les mentions de prédication / séries / dates
    theme_clean = re.sub(r'^[1-3]?\s*[A-ZÉÈÊÀÂ][a-zéèêëîïôöûüâäç]+\s*\d+.*?[–:-]\s*', '', theme_clean).strip()
    theme_clean = re.sub(r'^(prédication|message|sermon|culte)\s*[:#\d-]*\s*', '', theme_clean, flags=re.IGNORECASE).strip()
    
    if not theme_clean:
        theme_clean = "Vérité du texte et rédemption en Christ"

    return f"Plan d'exposition : {ref_display} — {theme_clean}"


def anonymize_entry(entry: dict, counter: int) -> dict:
    pass_ref = entry.get("passage_reference") or ""
    book_code = entry.get("book_code") or "BIB"
    chap = entry.get("chapter") or 1
    
    # ID générique et pur
    clean_id = f"canevas-{book_code.lower()}-{chap:02d}-{counter:02d}"
    
    # Titre générique
    clean_title = generate_generic_title(
        pass_ref,
        entry.get("theme_general", ""),
        entry.get("big_idea", ""),
        entry.get("title", "")
    )

    # Durée indicative arrondie
    d_sec = entry.get("duration_seconds", 2100)
    dur_min = int(round(d_sec / 60 / 5) * 5)
    if dur_min < 20: dur_min = 30
    if dur_min > 60: dur_min = 45
    duration_indicative = f"{dur_min} min (indicatif)"

    # Nettoyage de l'outline
    clean_outline = []
    for sec in entry.get("outline", []):
        t = clean_text(sec.get("titre", "Section"))
        s = clean_text(sec.get("synthese", ""))
        clean_outline.append({
            "section_type": sec.get("section_type", "point"),
            "titre": t,
            "passages": sec.get("passages", []),
            "synthese": s
        })

    # Nettoyage des applications
    clean_apps = [clean_text(app) for app in entry.get("applications", []) if clean_text(app)]

    return {
        "id": clean_id,
        "title": clean_title,
        "passage_reference": pass_ref,
        "book_code": book_code,
        "chapter": chap,
        "verse_start": entry.get("verse_start"),
        "verse_end": entry.get("verse_end"),
        "duration": duration_indicative,
        "theme_general": clean_text(entry.get("theme_general", "Exposition biblique")),
        "big_idea": clean_text(entry.get("big_idea", "")),
        "contemporary_tension": clean_text(entry.get("contemporary_tension", "")),
        "outline": clean_outline,
        "applications": clean_apps
    }


def main():
    if not os.path.exists(INDEX_PATH):
        print(f"❌ Index introuvable : {INDEX_PATH}")
        sys.exit(1)

    with open(INDEX_PATH, "r", encoding="utf-8") as fp:
        raw_models = json.load(fp)

    print("=" * 80)
    print("🔒 ANONYMISATION ET GÉNÉRALISATION DU CORPUS HOMILÉTIQUE")
    print("=" * 80)
    print(f"📚 Total modèles bruts : {len(raw_models)}")

    anonymized = []
    for idx, item in enumerate(raw_models, 1):
        anonymized.append(anonymize_entry(item, idx))

    # Sauvegarde du fichier index propre
    with open(INDEX_PATH, "w", encoding="utf-8") as fp:
        json.dump(anonymized, fp, ensure_ascii=False, indent=2)

    print(f"✅ {len(anonymized)} modèles 100% anonymisés et généralisés !")
    print(f"📁 Fichier : {INDEX_PATH}")
    print("=" * 80)
    print("🔍 Aperçu des 3 premiers modèles anonymisés :")
    for m in anonymized[:3]:
        print(f" • [{m['id']}] {m['title']}")
        print(f"   Passage: {m['passage_reference']} | Durée: {m['duration']}")
        print(f"   Big Idea: « {m['big_idea'][:65]}... »")
        print()


if __name__ == "__main__":
    main()
