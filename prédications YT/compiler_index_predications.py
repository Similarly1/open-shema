#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script de Compilation de l'Index des Modèles de Prédications Réelles.
Source : prédications YT/analyses_cache.json
Destination : bible_ai_app/data/real_sermons_index.json
Génère une base légère et indexée pour le matching intelligent de passages.
"""

import os
import sys
import json
import re

sys.stdout.reconfigure(encoding='utf-8')

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(CURRENT_DIR)
APP_DIR = os.path.join(PROJECT_ROOT, "bible_ai_app")
CACHE_FILE = os.path.join(CURRENT_DIR, "analyses_cache.json")
CORPUS_FILE = os.path.join(CURRENT_DIR, "corpus_predications_104.json")
OUTPUT_JSON = os.path.join(APP_DIR, "data", "real_sermons_index.json")

# Normalisation simplifiée des livres bibliques francophones
BOOK_ALIASES = {
    "genese": "GEN", "genèse": "GEN", "gn": "GEN", "ge": "GEN",
    "exode": "EXO", "ex": "EXO",
    "levitique": "LEV", "lévitique": "LEV", "lv": "LEV",
    "nombres": "NUM", "nb": "NUM", "nom": "NUM",
    "deuteronome": "DEU", "deutéronome": "DEU", "dt": "DEU",
    "josue": "JOS", "josué": "JOS", "jos": "JOS",
    "juges": "JDG", "jg": "JDG", "juge": "JDG",
    "ruth": "RUT", "ru": "RUT",
    "1 samuel": "1SA", "1samuel": "1SA", "1 s": "1SA", "1sa": "1SA", "1sam": "1SA",
    "2 samuel": "2SA", "2samuel": "2SA", "2 s": "2SA", "2sa": "2SA", "2sam": "2SA",
    "1 rois": "1KI", "1rois": "1KI", "1 r": "1KI", "1ki": "1KI",
    "2 rois": "2KI", "2rois": "2KI", "2 r": "2KI", "2ki": "2KI",
    "1 chroniques": "1CH", "1 ch": "1CH", "1ch": "1CH",
    "2 chroniques": "2CH", "2 ch": "2CH", "2ch": "2CH",
    "esdras": "EZR", "esd": "EZR",
    "nehemie": "NEH", "néhémie": "NEH", "ne": "NEH", "neh": "NEH",
    "esther": "EST", "est": "EST",
    "job": "JOB", "jb": "JOB",
    "psaumes": "PSA", "psaume": "PSA", "ps": "PSA", "pss": "PSA",
    "proverbes": "PRO", "proverbe": "PRO", "pr": "PRO", "pv": "PRO",
    "ecclesiaste": "ECC", "ecclésiaste": "ECC", "ec": "ECC", "qoh": "ECC",
    "cantique": "SNG", "ct": "SNG",
    "esaie": "ISA", "ésaïe": "ISA", "es": "ISA", "isa": "ISA",
    "jeremie": "JER", "jérémie": "JER", "jr": "JER",
    "lamentations": "LAM", "lam": "LAM",
    "ezechiel": "EZK", "ézéchiel": "EZK", "ez": "EZK",
    "daniel": "DAN", "dn": "DAN", "da": "DAN",
    "osee": "HOS", "osée": "HOS", "os": "HOS",
    "joel": "JOL", "joël": "JOL", "jl": "JOL",
    "amos": "AMO", "am": "AMO",
    "abdias": "OBA", "ab": "OBA",
    "jonas": "JON", "jon": "JON",
    "michee": "MIC", "michée": "MIC", "mi": "MIC",
    "nahum": "NAH", "na": "NAH",
    "habacuc": "HAB", "hab": "HAB",
    "sophonie": "ZEP", "so": "ZEP",
    "aggee": "HAG", "aggée": "HAG", "ag": "HAG",
    "zacharie": "ZEC", "za": "ZEC",
    "malachie": "MAL", "mal": "MAL",
    "matthieu": "MAT", "mt": "MAT", "matt": "MAT",
    "marc": "MRK", "mc": "MRK", "mar": "MRK",
    "luc": "LUK", "lc": "LUK", "lu": "LUK",
    "jean": "JHN", "jn": "JHN", "je": "JHN",
    "actes": "ACT", "ac": "ACT", "act": "ACT",
    "romains": "ROM", "rm": "ROM", "ro": "ROM",
    "1 corinthiens": "1CO", "1corinthiens": "1CO", "1 co": "1CO", "1co": "1CO",
    "2 corinthiens": "2CO", "2corinthiens": "2CO", "2 co": "2CO", "2co": "2CO",
    "galates": "GAL", "ga": "GAL", "gl": "GAL",
    "ephesiens": "EPH", "éphésiens": "EPH", "ep": "EPH", "eph": "EPH",
    "philippiens": "PHP", "ph": "PHP", "php": "PHP", "phil": "PHP",
    "colossiens": "COL", "col": "COL", "cl": "COL",
    "1 thessaloniciens": "1TH", "1 th": "1TH", "1th": "1TH",
    "2 thessaloniciens": "2TH", "2 th": "2TH", "2th": "2TH",
    "1 timothee": "1TI", "1 timothée": "1TI", "1 tm": "1TI", "1ti": "1TI",
    "2 timothee": "2TI", "2 timothée": "2TI", "2 tm": "2TI", "2ti": "2TI",
    "tite": "TIT", "tt": "TIT",
    "philemon": "PHM", "philémon": "PHM", "phm": "PHM",
    "hebreux": "HEB", "hébreux": "HEB", "he": "HEB", "heb": "HEB",
    "jacques": "JAS", "jc": "JAS", "ja": "JAS", "jac": "JAS",
    "1 pierre": "1PE", "1 pe": "1PE", "1pe": "1PE", "1 p": "1PE",
    "2 pierre": "2PE", "2 pe": "2PE", "2pe": "2PE", "2 p": "2PE",
    "1 jean": "1JN", "1 jn": "1JN", "1jn": "1JN", "1 j": "1JN",
    "2 jean": "2JN", "2 jn": "2JN", "2jn": "2JN", "2 j": "2JN",
    "3 jean": "3JN", "3 jn": "3JN", "3jn": "3JN", "3 j": "3JN",
    "jude": "JUD", "jd": "JUD",
    "apocalypse": "REV", "ap": "REV", "apo": "REV", "apoc": "REV", "revelation": "REV"
}


def parse_passage_reference(raw_ref: str) -> dict:
    if not raw_ref:
        return {"book_code": "", "chapter": None, "verse_start": None, "verse_end": None}
    
    clean = raw_ref.strip().lower()
    # Recherche livre + chapitre
    m = re.search(r'([1-3]?\s*[a-zéèêëîïôöûüâäç]+)\s*(\d+)(?:[.:,](\d+))?(?:[–-](\d+))?', clean)
    if m:
        book_raw = m.group(1).strip()
        chap = int(m.group(2)) if m.group(2) else None
        v_start = int(m.group(3)) if m.group(3) else None
        v_end = int(m.group(4)) if m.group(4) else None
        
        book_code = BOOK_ALIASES.get(book_raw, "")
        if not book_code:
            for k, code in BOOK_ALIASES.items():
                if k in book_raw or book_raw in k:
                    book_code = code
                    break
                    
        return {
            "book_code": book_code,
            "chapter": chap,
            "verse_start": v_start,
            "verse_end": v_end
        }
        
    return {"book_code": "", "chapter": None, "verse_start": None, "verse_end": None}


def main():
    if not os.path.exists(CACHE_FILE):
        print(f"❌ Fichier d'analyses introuvable : {CACHE_FILE}")
        sys.exit(1)
        
    with open(CACHE_FILE, "r", encoding="utf-8") as fp:
        analyses_cache = json.load(fp)
        
    corpus_meta = {}
    if os.path.exists(CORPUS_FILE):
        try:
            with open(CORPUS_FILE, "r", encoding="utf-8") as fp:
                for c in json.load(fp):
                    corpus_meta[c.get("video_id")] = c
        except Exception:
            pass

    compiled_models = []
    
    for v_id, an in analyses_cache.items():
        if not isinstance(an, dict):
            continue
            
        c_info = corpus_meta.get(v_id, {})
        title = c_info.get("titre") or an.get("theme_general") or "Prédication"
        url = c_info.get("url") or f"https://www.youtube.com/watch?v={v_id}"
        duree_sec = c_info.get("duree_secondes", 2100)
        
        # Durée formatée
        m_dur, s_dur = divmod(int(duree_sec), 60)
        h_dur, m_dur = divmod(m_dur, 60)
        duree_str = f"{h_dur:02d}:{m_dur:02d}:{s_dur:02d}" if h_dur > 0 else f"{m_dur:02d}:{s_dur:02d}"

        pass_ref = an.get("passage_reference", "")
        # Si le passage n'est pas explicite, chercher dans le titre
        if not pass_ref or len(pass_ref) < 2:
            title_ref_match = re.search(r'([1-3]?\s*[A-ZÉÈÊÀÂ][a-zéèêëîïôöûüâäç]+\s*\d+(?:[.:]\d+)?(?:-\d+)?)', title)
            if title_ref_match:
                pass_ref = title_ref_match.group(1)

        pass_parsed = parse_passage_reference(pass_ref)

        model_entry = {
            "id": f"model-yt-{v_id}",
            "video_id": v_id,
            "title": title,
            "url": url,
            "source_church": c_info.get("source", "Église francophone"),
            "duration": duree_str,
            "duration_seconds": duree_sec,
            "passage_reference": pass_ref,
            "book_code": pass_parsed.get("book_code", ""),
            "chapter": pass_parsed.get("chapter"),
            "verse_start": pass_parsed.get("verse_start"),
            "verse_end": pass_parsed.get("verse_end"),
            "theme_general": an.get("theme_general", ""),
            "big_idea": an.get("big_idea", ""),
            "contemporary_tension": an.get("contemporary_tension", ""),
            "outline": an.get("outline", []),
            "applications": an.get("applications", []),
            "illustrations_count": len(an.get("illustrations", []))
        }
        compiled_models.append(model_entry)

    # Tri par livre puis chapitre
    compiled_models.sort(key=lambda x: (x.get("book_code") or "ZZZ", x.get("chapter") or 999, x.get("title", "")))

    os.makedirs(os.path.dirname(OUTPUT_JSON), exist_ok=True)
    with open(OUTPUT_JSON, "w", encoding="utf-8") as out_fp:
        json.dump(compiled_models, out_fp, ensure_ascii=False, indent=2)

    print("=" * 70)
    print(f"🎉 INDEXATION TERMINÉE : {len(compiled_models)} modèles de prédications réelles.")
    print(f"📁 Fichier généré : {OUTPUT_JSON} ({os.path.getsize(OUTPUT_JSON)/1024:.1f} KB)")
    print("=" * 70)


if __name__ == "__main__":
    main()
