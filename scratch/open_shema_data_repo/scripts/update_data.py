# -*- coding: utf-8 -*-
"""
Générateur et actualisateur de dataset 100% autonome pour BibleProject (FR).
Utilisé en local et par le GitHub Action hebdomadaire (CRON).
Source 1: Playlists officielles de la chaîne YouTube BibleProject - Français (via yt-dlp)
Source 2: CloudFront CDN officiel de BibleProject pour les posters HD et PDF
"""

import json
import re
import os
import subprocess
import urllib.request

BOOKS_DEF = [
    ("GEN", "Genèse", "OT", ["Genèse", "Genesis"]),
    ("EXO", "Exode", "OT", ["Exode", "Exodus"]),
    ("LEV", "Lévitique", "OT", ["Lévitique", "Levitique"]),
    ("NUM", "Nombres", "OT", ["Nombres", "Numbers"]),
    ("DEU", "Deutéronome", "OT", ["Deutéronome", "Deuteronome"]),
    ("JOS", "Josué", "OT", ["Josué", "Josue"]),
    ("JDG", "Juges", "OT", ["Juges", "Judges"]),
    ("RUT", "Ruth", "OT", ["Ruth"]),
    ("1SA", "1 Samuel", "OT", ["1 Samuel", "1-2 Samuel", "1 et 2 Samuel", "Samuel"]),
    ("2SA", "2 Samuel", "OT", ["2 Samuel", "1-2 Samuel", "1 et 2 Samuel", "Samuel"]),
    ("1KI", "1 Rois", "OT", ["1 Rois", "1-2 Rois", "1 et 2 Rois", "Rois"]),
    ("2KI", "2 Rois", "OT", ["2 Rois", "1-2 Rois", "1 et 2 Rois", "Rois"]),
    ("1CH", "1 Chroniques", "OT", ["1 Chroniques", "1-2 Chroniques", "Chroniques"]),
    ("2CH", "2 Chroniques", "OT", ["2 Chroniques", "1-2 Chroniques", "Chroniques"]),
    ("EZR", "Esdras", "OT", ["Esdras", "Esdras-Néhémie", "Esdras-Nehemie"]),
    ("NEH", "Néhémie", "OT", ["Néhémie", "Nehemie", "Esdras-Néhémie", "Esdras-Nehemie"]),
    ("EST", "Esther", "OT", ["Esther"]),
    ("JOB", "Job", "OT", ["Job"]),
    ("PSA", "Psaumes", "OT", ["Psaumes", "Psaume"]),
    ("PRO", "Proverbes", "OT", ["Proverbes"]),
    ("ECC", "Ecclésiaste", "OT", ["Ecclésiaste", "Ecclesiaste"]),
    ("SNG", "Cantique des Cantiques", "OT", ["Cantique", "Cantiques"]),
    ("ISA", "Ésaïe", "OT", ["Ésaïe", "Esaïe", "Esaie"]),
    ("JER", "Jérémie", "OT", ["Jérémie", "Jeremie"]),
    ("LAM", "Lamentations", "OT", ["Lamentations"]),
    ("EZK", "Ézéchiel", "OT", ["Ézéchiel", "Ezechiel"]),
    ("DAN", "Daniel", "OT", ["Daniel"]),
    ("HOS", "Osée", "OT", ["Osée", "Osee"]),
    ("JOL", "Joël", "OT", ["Joël", "Joel"]),
    ("AMO", "Amos", "OT", ["Amos"]),
    ("OBA", "Abdias", "OT", ["Abdias"]),
    ("JON", "Jonas", "OT", ["Jonas"]),
    ("MIC", "Michée", "OT", ["Michée", "Michee"]),
    ("NAM", "Nahum", "OT", ["Nahum"]),
    ("HAB", "Habacuc", "OT", ["Habacuc"]),
    ("ZEP", "Sophonie", "OT", ["Sophonie"]),
    ("HAG", "Aggée", "OT", ["Aggée", "Aggee"]),
    ("ZEC", "Zacharie", "OT", ["Zacharie"]),
    ("MAL", "Malachie", "OT", ["Malachie"]),
    ("MAT", "Matthieu", "NT", ["Matthieu"]),
    ("MRK", "Marc", "NT", ["Marc"]),
    ("LUK", "Luc", "NT", ["Luc"]),
    ("JHN", "Jean", "NT", ["Jean", "Évangile de Jean", "Evangile de Jean"]),
    ("ACT", "Actes", "NT", ["Actes"]),
    ("ROM", "Romains", "NT", ["Romains"]),
    ("1CO", "1 Corinthiens", "NT", ["1 Corinthiens", "1Corinthiens"]),
    ("2CO", "2 Corinthiens", "NT", ["2 Corinthiens"]),
    ("GAL", "Galates", "NT", ["Galates"]),
    ("EPH", "Éphésiens", "NT", ["Éphésiens", "Ephesiens"]),
    ("PHP", "Philippiens", "NT", ["Philippiens"]),
    ("COL", "Colossiens", "NT", ["Colossiens"]),
    ("1TH", "1 Thessaloniciens", "NT", ["1 Thessaloniciens"]),
    ("2TH", "2 Thessaloniciens", "NT", ["2 Thessaloniciens"]),
    ("1TI", "1 Timothée", "NT", ["1 Timothée", "1 Timothee"]),
    ("2TI", "2 Timothée", "NT", ["2 Timothée", "2 Timothee"]),
    ("TIT", "Tite", "NT", ["Tite"]),
    ("PHM", "Philémon", "NT", ["Philémon", "Philemon"]),
    ("HEB", "Hébreux", "NT", ["Hébreux", "Hebreux"]),
    ("JAS", "Jacques", "NT", ["Jacques"]),
    ("1PE", "1 Pierre", "NT", ["1 Pierre"]),
    ("2PE", "2 Pierre", "NT", ["2 Pierre"]),
    ("1JN", "1 Jean", "NT", ["1 Jean", "1-3 Jean", "1 à 3 Jean", "Jean123"]),
    ("2JN", "2 Jean", "NT", ["2 Jean", "1-3 Jean", "1 à 3 Jean", "Jean123"]),
    ("3JN", "3 Jean", "NT", ["3 Jean", "1-3 Jean", "1 à 3 Jean", "Jean123"]),
    ("JUD", "Jude", "NT", ["Jude"]),
    ("REV", "Apocalypse", "NT", ["Apocalypse", "Revelation"])
]

PLAYLISTS = [
    ("OT", "Panoramas: Ancien Testament", "PLSEw5zAcWoz2-gWfwR9i9F_SUTqUk8l5e"),
    ("NT", "Panoramas: Nouveau Testament", "PLSEw5zAcWoz1JQ2-Cq9jaBKKczz4MCAbs"),
    ("THEMES", "Thèmes bibliques", "PLSEw5zAcWoz3YHMsCQT3m1ChP3sKR6Jbs"),
    ("WORDS", "Étude de mots", "PLSEw5zAcWoz1DageO_sjMgATJAuJQ8bky"),
    ("WORDS_GOD", "Étude de mots : le caractère de Dieu", "PLSEw5zAcWoz0UBAYCydgqH_9LroubSxqE"),
    ("SHEMA", "Shema - La série", "PLSEw5zAcWoz0BXdV1VkE1PyhpS_GhZjeI"),
    ("TORAH", "La Torah - La série", "PLSEw5zAcWoz3Pw95vrEOuRrMm-8DjYHSj"),
    ("WISDOM", "Sagesse - La série", "PLSEw5zAcWoz2cSx27x0gqcz4TiUby4VDd")
]

def format_duration(seconds):
    if not seconds:
        return "Panorama"
    m = int(seconds) // 60
    s = int(seconds) % 60
    return f"{m}:{s:02d}"

def fetch_playlists_data():
    yt_data = {}
    for cat, name, pid in PLAYLISTS:
        print(f"Extraction YouTube playlist {name} ({pid})...")
        url = f"https://www.youtube.com/playlist?list={pid}"
        res = subprocess.run([
            'yt-dlp', '--flat-playlist', '--dump-json', url
        ], capture_output=True, text=True, encoding='utf-8')

        items = []
        for line in res.stdout.strip().split('\n'):
            if line.strip():
                try:
                    data = json.loads(line)
                    items.append({
                        "id": data.get("id"),
                        "title": data.get("title"),
                        "duration": data.get("duration"),
                        "description": data.get("description", "")
                    })
                except Exception:
                    pass
        yt_data[cat] = {"name": name, "id": pid, "items": items}
        print(f" -> {len(items)} vidéos trouvées.")
    return yt_data

def fetch_download_page_media():
    print("Scraping page téléchargements BibleProject FR...")
    try:
        req = urllib.request.Request("https://bibleproject.com/locale/downloads/fra/", headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=10) as response:
            html = response.read().decode('utf-8')
        media_urls = list(set(re.findall(r'https?://[^\s"\'<>]+(?:jpg|png|pdf|webp)', html, re.IGNORECASE)))
        print(f" -> {len(media_urls)} URLs médias extraites.")
        return media_urls
    except Exception as e:
        print(f"Avertissement : impossible de contacter bibleproject.com ({e})")
        return []

def main():
    yt_data = fetch_playlists_data()
    media_urls = fetch_download_page_media()

    all_yt_items = []
    for k in ["OT", "NT"]:
        all_yt_items.extend(yt_data.get(k, {}).get("items", []))

    books_result = {}

    for code, name, testament, keywords in BOOKS_DEF:
        matched_vids = []
        for item in all_yt_items:
            t = item["title"]
            is_match = False
            for kw in keywords:
                if re.search(r'\b' + re.escape(kw) + r'\b', t, re.IGNORECASE) or kw.lower() in t.lower():
                    is_match = True
                    break

            if is_match:
                if code == "JHN" and any(x in t for x in ["1 Jean", "2 Jean", "3 Jean", "1-3 Jean", "Jean 1-3", "Épîtres de Jean"]):
                    continue
                if code == "1JN" and "1-3 Jean" not in t and "1 Jean" not in t and "Jean 1-3" not in t:
                    continue
                if code == "1SA" and "2 Samuel" in t and "1-2" not in t and "1 et 2" not in t:
                    continue
                if code == "1KI" and "2 Rois" in t and "1-2" not in t and "1 et 2" not in t:
                    continue
                if code == "1CH" and "2 Chroniques" in t and "1-2" not in t and "1 et 2" not in t:
                    continue
                if code == "1CO" and "2 Corinthiens" in t and "1-2" not in t:
                    continue
                if code == "1TH" and "2 Thessaloniciens" in t and "1-2" not in t:
                    continue
                if code == "1TI" and "2 Timothée" in t and "1-2" not in t:
                    continue
                if code == "1PE" and "2 Pierre" in t and "1-2" not in t:
                    continue

                ch_match = re.search(r'(\d+)\s*[-–]\s*(\d+)', t)
                if ch_match:
                    ch_range = [int(ch_match.group(1)), int(ch_match.group(2))]
                else:
                    ch_range = [1, 999]

                matched_vids.append({
                    "id": f"bp-{code.lower()}-{ch_range[0]}-{ch_range[1]}",
                    "title": t,
                    "yt_id": item["id"],
                    "chapters": ch_range,
                    "duration": format_duration(item.get("duration")),
                    "thumbnail": f"https://i.ytimg.com/vi/{item['id']}/hqdefault.jpg",
                    "description": item.get("description", f"Panorama du livre de {name} par BibleProject.")
                })

        # Match posters
        matched_posters = []
        for u in media_urls:
            u_clean = u.replace('\\', '')
            if not u_clean.endswith(('.png', '.jpg', '.jpeg')):
                continue

            is_p_match = False
            for kw in keywords:
                kw_slug = kw.lower().replace(' ', '_').replace('é', 'e').replace('è', 'e').replace('ê', 'e')
                if kw_slug in u_clean.lower() or kw.lower() in u_clean.lower():
                    is_p_match = True
                    break

            if is_p_match:
                if code == "JHN" and any(x in u_clean.lower() for x in ["1-3_john", "jean123"]):
                    continue
                if code == "1SA" and "2_samuel" in u_clean.lower() and "11-12" not in u_clean.lower():
                    continue
                if code == "1CO" and "2_corinthians" in u_clean.lower():
                    continue
                if code == "1TH" and "2_thessalonians" in u_clean.lower():
                    continue
                if code == "1TI" and "2_timothy" in u_clean.lower():
                    continue
                if code == "1PE" and "2_peter" in u_clean.lower():
                    continue

                ch_match = re.search(r'(\d+)\s*[-_]\s*(\d+)', u_clean)
                if ch_match:
                    ch_range = [int(ch_match.group(1)), int(ch_match.group(2))]
                else:
                    ch_range = [1, 999]

                matched_posters.append({
                    "id": f"poster-{code.lower()}-{ch_range[0]}-{ch_range[1]}",
                    "title": f"Structure littéraire : {name} {ch_range[0]}-{ch_range[1]}" if ch_range[1] < 999 else f"Structure littéraire : {name}",
                    "chapters": ch_range,
                    "image_url": u_clean,
                    "pdf_url": u_clean
                })


        matched_vids.sort(key=lambda x: x["chapters"][0])
        matched_posters.sort(key=lambda x: x["chapters"][0])

        books_result[code] = {
            "name": name,
            "testament": testament,
            "videos": matched_vids,
            "posters": matched_posters
        }

    themes_result = []
    for item in yt_data.get("THEMES", {}).get("items", []) + yt_data.get("TORAH", {}).get("items", []) + yt_data.get("WISDOM", {}).get("items", []):
        themes_result.append({
            "id": f"theme-{item['id']}",
            "title": item["title"],
            "yt_id": item["id"],
            "duration": format_duration(item.get("duration")),
            "thumbnail": f"https://i.ytimg.com/vi/{item['id']}/hqdefault.jpg",
            "description": item.get("description", ""),
            "related_books": []
        })

    word_studies_result = []
    for item in yt_data.get("WORDS", {}).get("items", []) + yt_data.get("WORDS_GOD", {}).get("items", []) + yt_data.get("SHEMA", {}).get("items", []):
        word_studies_result.append({
            "id": f"word-{item['id']}",
            "title": item["title"],
            "yt_id": item["id"],
            "duration": format_duration(item.get("duration")),
            "thumbnail": f"https://i.ytimg.com/vi/{item['id']}/hqdefault.jpg",
            "description": item.get("description", "")
        })

    final_dataset = {
        "version": "2.0",
        "channel_title": "BibleProject - Français",
        "channel_url": "https://www.youtube.com/@BibleProject-Français",
        "downloads_url": "https://bibleproject.com/locale/downloads/fra/",
        "github_data_repo": "https://github.com/Similarly1/open-shema-data.git",
        "total_books_covered": len(books_result),
        "books": books_result,
        "themes": themes_result,
        "word_studies": word_studies_result
    }

    base_dir = os.path.dirname(os.path.dirname(__file__))
    target_path = os.path.join(base_dir, "bibleproject_fr.json")
    if not os.path.exists(os.path.dirname(target_path)):
        os.makedirs(os.path.dirname(target_path), exist_ok=True)

    with open(target_path, "w", encoding="utf-8") as f:
        json.dump(final_dataset, f, indent=2, ensure_ascii=False)

    print(f"\n[OK] Fichier {target_path} mis à jour avec succès.")
    print(f"Livres indexés: {len(books_result)} | Thèmes: {len(themes_result)} | Études de mots: {len(word_studies_result)}")


if __name__ == "__main__":
    main()
