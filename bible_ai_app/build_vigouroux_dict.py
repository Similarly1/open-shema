import os
import sys
import fitz
import re
import json
import time
import unicodedata

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

def normalize_key(s):
    if not s:
        return ""
    s = s.replace("’", "'").replace("–", "-").replace("—", "-")
    nfd = unicodedata.normalize('NFD', s.lower())
    cleaned = ''.join(c for c in nfd if unicodedata.category(c) != 'Mn' and (c.isalnum() or c in " -_"))
    return re.sub(r'\s+', ' ', cleaned).strip()

def clean_ocr_text(text):
    """Nettoyage approfondi des artefacts d'OCR du XIXe siècle."""
    # 1. Remplacement des faux '1' et 'I' devant apostrophe
    text = re.sub(r"\b1['’](?=[a-zA-Zà-ÿÀ-Ý])", "l'", text)
    text = re.sub(r"(?<=\s)1['’](?=[a-zA-Zà-ÿÀ-Ý])", "l'", text)
    text = re.sub(r"\bI['’](?=[a-zA-Zà-ÿÀ-Ý])", "l'", text)
    text = re.sub(r"\b([dlDL])['’]\s+([a-zA-Zà-ÿÀ-Ý])", r"\1'\2", text)
    
    # 2. Raccord des césures en fin de ligne (ex: "tem- \n ple" -> "temple")
    text = re.sub(r"([a-zA-Zà-ÿÀ-Ý]{2,})-\s*\n\s*([a-zA-Zà-ÿÀ-Ý]{2,})", r"\1\2", text)
    
    # 3. Suppression des signatures et mentions d'en-tête récurrentes
    text = re.sub(r"\n\s*DICT\.\s*DE\s*LA\s*BIBLE\.\s*", "\n", text)
    text = re.sub(r"\n\s*[I|V|X]+\.\s*[-–—]\s*\d+[-–—]\d+\s*", "\n", text)
    text = re.sub(r"\n\s*I\.\s*-\s*\d+\s*", "\n", text)
    
    # 4. Suppression des en-têtes de colonnes (ex: "33 | ABELMAIM | 34")
    lines = text.split('\n')
    cleaned_lines = []
    for line in lines:
        l = line.strip()
        if not l:
            if cleaned_lines and cleaned_lines[-1] != "":
                cleaned_lines.append("")
            continue
            
        # Filtrer en-têtes avec numéros de page
        if re.match(r'^\d+\s*[-–—|]\s*[A-ZÉÈÊËÀÂÄÎÏÔÖÙÛÜÇ\s\.\-–—\']+\s*[-–—|]?\s*\d*$', l):
            continue
        if re.match(r'^[A-ZÉÈÊËÀÂÄÎÏÔÖÙÛÜÇ\s\.\-–—\']+\s*[-–—|]\s*\d+$', l):
            continue
        if re.match(r'^\d+\s*[-–—|]\s*[A-ZÉÈÊËÀÂÄÎÏÔÖÙÛÜÇ\s\.\-–—\']+$', l):
            continue
            
        cleaned_lines.append(l)
        
    # 5. Reconstitution propre des paragraphes
    joined = []
    current_p = []
    for l in cleaned_lines:
        if not l:
            if current_p:
                joined.append(" ".join(current_p))
                current_p = []
        else:
            current_p.append(l)
    if current_p:
        joined.append(" ".join(current_p))
        
    res = "\n\n".join(joined)
    # Nettoyage des espaces multiples
    res = re.sub(r'[ \t]+', ' ', res)
    return res.strip()

# Expression régulière pour détecter les lemmes / titres d'articles
HEADWORD_RE = re.compile(
    r'^(?:(?:\d{1,2}\.?\s+)|(?:[I|V|X]+\.\s+))?([A-ZÉÈÊËÀÂÄÎÏÔÖÙÛÜÇ\s\-\'’]{2,50})(?:[,\.\(–—\-\s]|$)'
)

STOP_HEADWORDS = {
    "DICT", "DE LA BIBLE", "TOME", "PREMIERE PARTIE", "DEUXIEME PARTIE", 
    "FIGURE", "FIG", "PAGE", "VOIR", "MM", "LISTE DES COLLABORATEURS",
    "AVERTISSEMENT", "PREFACE", "IMPRIMATUR", "BIBLIOGRAPHIE"
}

def is_valid_headword(cand):
    c = cand.strip(" .,-–—()'")
    if len(c) < 2 or len(c) > 45:
        return False
    if c in STOP_HEADWORDS:
        return False
    if re.match(r'^[0-9\s]+$', c):
        return False
    # Éviter les simples numéros romains de sous-sections (I, II, III, IV, V, VI...)
    if re.match(r'^[IVXLCDM]+$', c) and len(c) <= 4:
        return False
    return True

VOLUMES_CONFIG = [
    {
        "vol": 1,
        "filename": "Vigouroux_DB_I (A - ).pdf",
        "start_page": 64,
        "end_page": 1054
    },
    {
        "vol": 2,
        "filename": "Vigouroux_DB_II (C - ).pdf",
        "start_page": 9,
        "end_page": 1254
    },
    {
        "vol": 3,
        "filename": "Vigouroux_DB_III (G - ).pdf",
        "start_page": 6,
        "end_page": 987
    },
    {
        "vol": 4,
        "filename": "Vigouroux_DB_IV (L - ).pdf",
        "start_page": 6,
        "end_page": 1154
    },
    {
        "vol": 5,
        "filename": "Vigouroux_DB_V (PE - ).pdf",
        "start_page": 4,
        "end_page": 1307
    }
]

def build_vigouroux_dictionary(pdf_dir, output_json_path):
    print("=== Démarrage de l'extraction intégrale du Dictionnaire Vigouroux (5 tomes) ===")
    t_start = time.time()
    
    raw_articles = {} # slug -> list of {title, text, vol, page}
    
    total_extracted_entries = 0
    
    for cfg in VOLUMES_CONFIG:
        pdf_path = os.path.join(pdf_dir, cfg["filename"])
        if not os.path.exists(pdf_path):
            print(f"ATTENTION : Fichier non trouvé : {pdf_path}")
            continue
            
        doc = fitz.open(pdf_path)
        vol_num = cfg["vol"]
        s_p = cfg["start_page"]
        e_p = min(cfg["end_page"], len(doc))
        print(f"\n--- Tome {vol_num} : {cfg['filename']} (pages {s_p} à {e_p}) ---")
        
        current_hw = None
        current_title = None
        current_blocks = []
        current_page = s_p
        
        vol_entry_count = 0
        
        for pno in range(s_p, e_p):
            page = doc[pno]
            blocks = page.get_text("blocks")
            
            # Trier en 2 colonnes verticales (gauche puis droite)
            left_blocks = [b for b in blocks if b[0] < 265 and b[1] > 50 and b[3] < 710]
            right_blocks = [b for b in blocks if b[0] >= 265 and b[1] > 50 and b[3] < 710]
            left_blocks.sort(key=lambda b: b[1])
            right_blocks.sort(key=lambda b: b[1])
            
            for col in (left_blocks, right_blocks):
                for b in col:
                    b_text = b[4].strip()
                    if not b_text:
                        continue
                    
                    first_line = b_text.split('\n')[0].strip()
                    m = HEADWORD_RE.match(first_line)
                    
                    new_hw = None
                    if m:
                        cand = m.group(1).strip()
                        if is_valid_headword(cand):
                            new_hw = cand
                            
                    if new_hw and (not current_hw or new_hw != current_hw):
                        # Sauvegarder l'article en cours
                        if current_hw and current_blocks:
                            raw_txt = "\n".join(current_blocks)
                            cleaned = clean_ocr_text(raw_txt)
                            if len(cleaned) > 20:
                                slug = normalize_key(current_hw)
                                if slug:
                                    if slug not in raw_articles:
                                        raw_articles[slug] = []
                                    raw_articles[slug].append({
                                        "title": current_title or current_hw,
                                        "text": cleaned,
                                        "vol": vol_num,
                                        "page": current_page
                                    })
                                    vol_entry_count += 1
                                    total_extracted_entries += 1
                                    
                        current_hw = new_hw
                        current_title = new_hw
                        current_blocks = [b_text]
                        current_page = pno
                    else:
                        if current_hw:
                            current_blocks.append(b_text)
                            
        # Dernier article du tome
        if current_hw and current_blocks:
            raw_txt = "\n".join(current_blocks)
            cleaned = clean_ocr_text(raw_txt)
            if len(cleaned) > 20:
                slug = normalize_key(current_hw)
                if slug:
                    if slug not in raw_articles:
                        raw_articles[slug] = []
                    raw_articles[slug].append({
                        "title": current_title or current_hw,
                        "text": cleaned,
                        "vol": vol_num,
                        "page": current_page
                    })
                    vol_entry_count += 1
                    total_extracted_entries += 1
                    
        doc.close()
        print(f"  Tome {vol_num} terminé : {vol_entry_count} articles extraits.")
        
    print(f"\nFusion et structuration finale de {len(raw_articles)} entrées uniques...")
    
    articles_dict = {}
    keywords_dict = {}
    
    for slug, parts in raw_articles.items():
        if len(parts) == 1:
            main_title = parts[0]["title"]
            full_text = parts[0]["text"]
        else:
            main_title = parts[0]["title"]
            full_text = "\n\n---\n\n".join(p["text"] for p in parts)
            
        articles_dict[slug] = {
            "title": main_title,
            "text": full_text
        }
        
        # Indexer les mots-clés
        keywords_dict[slug] = [slug]
        # Ajouter sans tirets
        if "-" in slug:
            no_dash = slug.replace("-", " ").strip()
            if no_dash != slug:
                keywords_dict[slug].append(no_dash)
                if no_dash not in keywords_dict:
                    keywords_dict[no_dash] = [slug]
                    
    dict_payload = {
        "id": "vigouroux",
        "name": "Dictionnaire de la Bible - F. Vigouroux (1912)",
        "count": len(articles_dict),
        "articles": articles_dict,
        "keywords": keywords_dict
    }
    
    print(f"Écriture du fichier JSON final : {output_json_path}...")
    os.makedirs(os.path.dirname(output_json_path), exist_ok=True)
    with open(output_json_path, "w", encoding="utf-8") as f:
        json.dump(dict_payload, f, ensure_ascii=False, indent=2)
        
    file_size_mb = os.path.getsize(output_json_path) / (1024 * 1024)
    print(f"✅ Terminé en {time.time()-t_start:.1f}s !")
    print(f"  - Total articles uniques : {len(articles_dict)}")
    print(f"  - Total mots-clés indexés : {len(keywords_dict)}")
    print(f"  - Taille du fichier : {file_size_mb:.2f} Mo")
    
    return dict_payload

def update_registry(base_dir):
    """Enregistre Vigouroux dans le registre des dictionnaires de l'application."""
    reg_path = os.path.join(base_dir, "data", "dictionaries", "registry.json")
    registry = []
    if os.path.exists(reg_path):
        try:
            with open(reg_path, "r", encoding="utf-8") as f:
                registry = json.load(f)
        except Exception as e:
            print(f"Erreur lecture registry.json : {e}")
            registry = []
            
    # Vérifier si Vigouroux est déjà présent
    vig_entry = None
    for entry in registry:
        if entry.get("id") == "vigouroux":
            vig_entry = entry
            break
            
    if not vig_entry:
        vig_entry = {
            "id": "vigouroux",
            "name": "Dictionnaire de la Bible - F. Vigouroux (1912)",
            "type": "custom",
            "enabled": True,
            "priority": 3,
            "count": 0,
            "file": "data/vigouroux_dict.json"
        }
        registry.append(vig_entry)
        
    # Mettre à jour le nombre d'articles
    dict_file = os.path.join(base_dir, "data", "vigouroux_dict.json")
    if os.path.exists(dict_file):
        try:
            with open(dict_file, "r", encoding="utf-8") as f:
                d = json.load(f)
                vig_entry["count"] = len(d.get("articles", {}))
        except Exception:
            pass
            
    # Réajuster les priorités si nécessaire
    for i, entry in enumerate(registry):
        if "priority" not in entry:
            entry["priority"] = i + 1
            
    with open(reg_path, "w", encoding="utf-8") as f:
        json.dump(registry, f, ensure_ascii=False, indent=2)
    print(f"✅ Registre {reg_path} mis à jour avec succès.")

if __name__ == "__main__":
    app_dir = r'C:\Users\adrie\Documents\antigravity\peaceful-mendeleev\bible_ai_app'
    pdf_dir = r'C:\Users\adrie\kDrive\Documents\Théologie\Ressources externes\Ebooks\Dictionnaire Biblique Vigouroux'
    out_json = os.path.join(app_dir, "data", "vigouroux_dict.json")
    
    build_vigouroux_dictionary(pdf_dir, out_json)
    update_registry(app_dir)
