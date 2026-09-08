# -*- coding: utf-8 -*-
"""
Générateur et actualisateur de dataset 100% autonome pour BibleProject (FR).
Utilisé en local et par le GitHub Action hebdomadaire (CRON).
Source 1: Découverte exhaustive des playlists et vidéos de la chaîne YouTube BibleProject - Français (via yt-dlp)
Source 2: CloudFront CDN officiel de BibleProject pour les posters HD et schémas littéraires PDF
"""

import json
import re
import os
import subprocess
import urllib.request
import time

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

# Playlists de référence initiales (complétées dynamiquement par auto-découverte)
KNOWN_PLAYLISTS = [
    # Panoramas par livre
    ("OT", "Panoramas: Ancien Testament", "PLSEw5zAcWoz2-gWfwR9i9F_SUTqUk8l5e"),
    ("NT", "Panoramas: Nouveau Testament", "PLSEw5zAcWoz1JQ2-Cq9jaBKKczz4MCAbs"),
    ("LUKE_ACTS", "Luc-Actes - La série", "PLSEw5zAcWoz3-AKdGTRbwKTIlUIJBuy0L"),

    # Études de mots hébreux et grecs
    ("WORDS", "Étude de mots", "PLSEw5zAcWoz1DageO_sjMgATJAuJQ8bky"),
    ("WORDS_GOD", "Étude de mots : le caractère de Dieu", "PLSEw5zAcWoz0UBAYCydgqH_9LroubSxqE"),
    ("WORDS_NEG", "Les termes négatifs - La série", "PLSEw5zAcWoz2dwhoJZZXM2EBsJncg_81p"),
    ("SHEMA", "Shema - La série", "PLSEw5zAcWoz0BXdV1VkE1PyhpS_GhZjeI"),

    # Séries thématiques et théologiques majeures
    ("COMMANDMENTS", "Les 10 Commandements", "PLSEw5zAcWoz3npT8_BrLBwJIUv0q4OvJx"),
    ("SERMON_MOUNT", "Le Sermon sur la Montagne", "PLSEw5zAcWoz0PcrCcCEaWQen-_wALViEA"),
    ("PRIESTHOOD", "Sacerdoce royal - La série", "PLSEw5zAcWoz25RtpEF3CTf3zKhOiZ9Qy_"),
    ("SPIRITS", "Les êtres spirituels - La série", "PLSEw5zAcWoz2fKEOcojc4PED_u798GRHX"),
    ("TORAH", "La Torah - La série", "PLSEw5zAcWoz3Pw95vrEOuRrMm-8DjYHSj"),
    ("WISDOM", "Sagesse - La série", "PLSEw5zAcWoz2cSx27x0gqcz4TiUby4VDd"),
    ("HOW_TO_READ", "Comment lire la Bible - La série", "PLSEw5zAcWoz3wkqTXCuYyBY8uBw3_dDa8"),
    ("DISCOVERY", "À la découverte de la Bible", "PLSEw5zAcWoz1mxAFXDGZ78r7wwqHAkc03"),
    ("VISUAL_COMM", "Commentaire visuel", "PLSEw5zAcWoz3btjbwl50Pq3g-46Rsh96H"),
    ("ADVENT", "L’Avent - La série", "PLSEw5zAcWoz376z9QxTknRDL1W2htWvXt"),
    ("THEMES", "Thèmes bibliques", "PLSEw5zAcWoz3YHMsCQT3m1ChP3sKR6Jbs")
]

# Règles sémantiques pour associer automatiquement un thème théologique aux livres bibliques
KNOWN_THEME_RULES = [
    (re.compile(r"10\s*commandements|commandement", re.I), ["EXO", "DEU"]),
    (re.compile(r"sermon sur la montagne|b[ée]atitude", re.I), ["MAT", "LUK"]),
    (re.compile(r"sacerdoce royal|pr[êe]tre|sacrifice", re.I), ["LEV", "HEB", "1PE"]),
    (re.compile(r"torah", re.I), ["GEN", "EXO", "LEV", "NUM", "DEU"]),
    (re.compile(r"sagesse|proverbe|eccl[ée]siaste|job", re.I), ["PRO", "ECC", "JOB"]),
    (re.compile(r"luc[- ]actes|évangile de luc", re.I), ["LUK", "ACT"]),
    (re.compile(r"avent|no[ëe]l|messie|incarnation", re.I), ["ISA", "MIC", "MAT", "LUK"]),
    (re.compile(r"esprit|spirituel|ange|d[ée]mon|satan", re.I), ["GEN", "ACT"]),
    (re.compile(r"temple", re.I), ["1KI", "2CH", "EZK", "1CO"]),
    (re.compile(r"alliance", re.I), ["GEN", "EXO", "JER", "HEB"]),
    (re.compile(r"saint[- ]esprit", re.I), ["ACT", "ROM"]),
]

def format_duration(seconds):
    if not seconds:
        return "Panorama"
    m = int(seconds) // 60
    s = int(seconds) % 60
    return f"{m}:{s:02d}"

def detect_related_books(title, desc=""):
    text = f"{title} {desc}".lower()
    books = set()
    for pattern, codes in KNOWN_THEME_RULES:
        if pattern.search(text):
            books.update(codes)
    for code, name, testament, keywords in BOOKS_DEF:
        for kw in keywords:
            if re.search(r'\b' + re.escape(kw.lower()) + r'\b', text):
                books.add(code)
                break
    return sorted(list(books))

def discover_channel_playlists():
    print("Découverte dynamique des playlists sur la chaîne YouTube BibleProject FR...")
    url = "https://www.youtube.com/@BibleProject-Francais/playlists"
    all_playlists = list(KNOWN_PLAYLISTS)
    known_pids = {p[2]: p for p in KNOWN_PLAYLISTS}

    try:
        res = subprocess.run([
            'yt-dlp', '--flat-playlist', '--dump-json', url
        ], capture_output=True, text=True, encoding='utf-8', timeout=40)

        for line in res.stdout.strip().split('\n'):
            if line.strip():
                try:
                    data = json.loads(line)
                    pid = data.get("id")
                    title = data.get("title", "")
                    if pid and pid not in known_pids:
                        cat = "THEMES"
                        if "mot" in title.lower():
                            cat = "WORDS"
                        elif "panorama" in title.lower():
                            cat = "OT"
                        all_playlists.append((cat, title, pid))
                        known_pids[pid] = (cat, title, pid)
                        print(f" -> Nouvelle playlist détectée : {title} ({pid})")
                except Exception:
                    pass
    except Exception as e:
        print(f"Avertissement lors de la découverte des playlists : {e}")

    return all_playlists

def fetch_playlist_items(pid):
    url = f"https://www.youtube.com/playlist?list={pid}"
    try:
        res = subprocess.run([
            'yt-dlp', '--flat-playlist', '--dump-json', url
        ], capture_output=True, text=True, encoding='utf-8', timeout=60)
        items = []
        for line in res.stdout.strip().split('\n'):
            if line.strip():
                try:
                    data = json.loads(line)
                    items.append({
                        "id": data.get("id"),
                        "title": data.get("title", ""),
                        "duration": data.get("duration"),
                        "description": data.get("description", "")
                    })
                except Exception:
                    pass
        return items
    except Exception as e:
        print(f"Erreur extraction playlist {pid}: {e}")
        return []

def fetch_channel_recent_videos():
    print("Vérification des téléversements récents de la chaîne (@BibleProject-Français)...")
    url = "https://www.youtube.com/@BibleProject-Francais/videos"
    try:
        res = subprocess.run([
            'yt-dlp', '--flat-playlist', '--dump-json', url
        ], capture_output=True, text=True, encoding='utf-8', timeout=60)
        items = []
        for line in res.stdout.strip().split('\n'):
            if line.strip():
                try:
                    data = json.loads(line)
                    items.append({
                        "id": data.get("id"),
                        "title": data.get("title", ""),
                        "duration": data.get("duration"),
                        "description": data.get("description", "")
                    })
                except Exception:
                    pass
        print(f" -> {len(items)} vidéos analysées sur la chaîne.")
        return items
    except Exception as e:
        print(f"Avertissement lors de la récupération des vidéos de la chaîne : {e}")
        return []

def fetch_download_page_media():
    print("Scraping page téléchargements BibleProject FR...")
    try:
        req = urllib.request.Request("https://bibleproject.com/locale/downloads/fra/", headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=15) as response:
            html = response.read().decode('utf-8')
        media_urls = list(set(re.findall(r'https?://[^\s"\'<>]+(?:jpg|png|pdf|webp)', html, re.IGNORECASE)))
        print(f" -> {len(media_urls)} URLs médias extraites.")
        return media_urls
    except Exception as e:
        print(f"Avertissement : impossible de contacter bibleproject.com ({e})")
        return []

def main():
    start_time = time.time()
    playlists = discover_channel_playlists()
    
    yt_data = {}
    for cat, name, pid in playlists:
        print(f"Extraction YouTube playlist {name} ({pid})...")
        items = fetch_playlist_items(pid)
        yt_data[pid] = {"cat": cat, "name": name, "id": pid, "items": items}
        print(f" -> {len(items)} vidéos trouvées.")

    channel_recent_videos = fetch_channel_recent_videos()
    media_urls = fetch_download_page_media()

    # 1. Traitement des livres bibliques (Panoramas AT / NT)
    all_panorama_items = []
    for p_info in yt_data.values():
        if p_info["cat"] in ["OT", "NT"]:
            all_panorama_items.extend(p_info["items"])

    books_result = {}
    indexed_video_ids = set()

    for code, name, testament, keywords in BOOKS_DEF:
        matched_vids = []
        for item in all_panorama_items:
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
                indexed_video_ids.add(item["id"])

        # Match posters CloudFront
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

    # 2. Traitement des études de mots
    word_studies_result = []
    seen_word_ids = set()
    for p_info in yt_data.values():
        if p_info["cat"] in ["WORDS", "WORDS_GOD", "WORDS_NEG", "SHEMA"]:
            for item in p_info["items"]:
                vid = item["id"]
                if vid and vid not in seen_word_ids:
                    seen_word_ids.add(vid)
                    word_studies_result.append({
                        "id": f"word-{vid}",
                        "title": item["title"],
                        "yt_id": vid,
                        "duration": format_duration(item.get("duration")),
                        "thumbnail": f"https://i.ytimg.com/vi/{vid}/hqdefault.jpg",
                        "description": item.get("description", "")
                    })
                    indexed_video_ids.add(vid)

    # 3. Traitement des thèmes théologiques et des séries
    themes_result = []
    seen_theme_ids = set()

    for p_info in yt_data.values():
        if p_info["cat"] not in ["OT", "NT", "WORDS", "WORDS_GOD", "WORDS_NEG", "SHEMA"]:
            for item in p_info["items"]:
                vid = item["id"]
                if vid and vid not in seen_theme_ids:
                    seen_theme_ids.add(vid)
                    themes_result.append({
                        "id": f"theme-{vid}",
                        "title": item["title"],
                        "yt_id": vid,
                        "duration": format_duration(item.get("duration")),
                        "thumbnail": f"https://i.ytimg.com/vi/{vid}/hqdefault.jpg",
                        "description": item.get("description", ""),
                        "related_books": detect_related_books(item["title"], item.get("description", ""))
                    })
                    indexed_video_ids.add(vid)

    # 4. Inclusion des vidéos récentes de la chaîne non encore classées
    for item in channel_recent_videos:
        vid = item["id"]
        if vid and vid not in indexed_video_ids and vid not in seen_theme_ids:
            seen_theme_ids.add(vid)
            themes_result.append({
                "id": f"theme-{vid}",
                "title": item["title"],
                "yt_id": vid,
                "duration": format_duration(item.get("duration")),
                "thumbnail": f"https://i.ytimg.com/vi/{vid}/hqdefault.jpg",
                "description": item.get("description", ""),
                "related_books": detect_related_books(item["title"], item.get("description", ""))
            })
            indexed_video_ids.add(vid)

    final_dataset = {
        "version": "2.1",
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
    target_path = os.path.join(base_dir, "data", "bibleproject_fr.json")
    with open(target_path, "w", encoding="utf-8") as f:
        json.dump(final_dataset, f, indent=2, ensure_ascii=False)

    duration = time.time() - start_time
    print(f"\n[OK] Fichier {target_path} mis à jour avec succès en {duration:.1f}s.")
    print(f"Livres indexés: {len(books_result)} | Thèmes & séries: {len(themes_result)} | Études de mots: {len(word_studies_result)}")

if __name__ == "__main__":
    main()
