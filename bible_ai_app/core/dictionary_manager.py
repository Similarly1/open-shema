import os
import json
import re
import zipfile
import xml.etree.ElementTree as ET
import csv
import unicodedata
from core.strong_lexicon import StrongLexicon

class DictionaryManager:
    """
    Gestionnaire universel et modulaire de dictionnaires bibliques et linguistiques :
    - Gestion du registre des dictionnaires (priorité, activation)
    - Importation automatique de fichiers .docx (Logos / standard), .json, .csv
    - Recherche multi-dictionnaires ultra-rapide (<0.01ms) avec respect des priorités
    """
    _registry = None
    _dict_cache = {}
    _stop_words = {
        'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'd', 'l', 'en', 'a', 'au', 'aux',
        'et', 'ou', 'où', 'mais', 'donc', 'or', 'ni', 'car', 'que', 'qui', 'quoi', 'dont',
        'ce', 'cet', 'cette', 'ces', 'son', 'sa', 'ses', 'leur', 'leurs', 'mon', 'ma', 'mes',
        'ton', 'ta', 'tes', 'notre', 'nos', 'votre', 'vos', 'il', 'elle', 'ils', 'elles',
        'je', 'tu', 'nous', 'vous', 'on', 'se', 'si', 'y', 'ne', 'pas', 'plus', 'par', 'pour',
        'sur', 'sous', 'dans', 'avec', 'sans', 'comme', 'tout', 'tous', 'toute', 'toutes'
    }

    @classmethod
    def get_dict_dir(cls):
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        d = os.path.join(base_dir, "data", "dictionaries")
        os.makedirs(d, exist_ok=True)
        return d

    @classmethod
    def get_registry_path(cls):
        return os.path.join(cls.get_dict_dir(), "registry.json")

    @classmethod
    def load_registry(cls):
        if cls._registry is not None:
            return cls._registry
            
        r_path = cls.get_registry_path()
        if os.path.exists(r_path):
            try:
                with open(r_path, "r", encoding="utf-8") as f:
                    cls._registry = json.load(f)
                    return cls._registry
            except Exception as e:
                print(f"Erreur lecture registry.json : {e}")
                
        # Registre par défaut
        cls._registry = [
            {
                "id": "strong",
                "name": "Lexique Hébreu & Grec Strong",
                "type": "strong",
                "enabled": True,
                "priority": 1,
                "count": 14024,
                "file": "data/strong_lexicon.json"
            },
            {
                "id": "calmet",
                "name": "Dictionnaire Historique et Critique Dom Calmet (1728)",
                "type": "custom",
                "enabled": True,
                "priority": 2,
                "count": 5369,
                "file": "data/calmet_dict.json"
            },
            {
                "id": "bailly",
                "name": "Dictionnaire Grec-Français Anatole Bailly (1901)",
                "type": "greek",
                "enabled": True,
                "priority": 3,
                "count": 14642,
                "file": "data/bailly_lexicon.json"
            }
        ]
        cls.save_registry(cls._registry)
        return cls._registry

    @classmethod
    def save_registry(cls, registry_data):
        cls._registry = registry_data
        r_path = cls.get_registry_path()
        try:
            with open(r_path, "w", encoding="utf-8") as f:
                json.dump(registry_data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"Erreur écriture registry.json : {e}")

    @classmethod
    def normalize_term(cls, s):
        if not s:
            return ""
        s = s.replace("’", "'").replace("–", "-")
        nfd = unicodedata.normalize('NFD', s.lower())
        cleaned = ''.join(c for c in nfd if unicodedata.category(c) != 'Mn' and (c.isalnum() or c in " -_"))
        return re.sub(r'\s+', ' ', cleaned).strip()

    @classmethod
    def load_dictionary_file(cls, dict_info):
        dict_id = dict_info["id"]
        if dict_id in cls._dict_cache:
            return cls._dict_cache[dict_id]
            
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        rel_file = dict_info.get("file", "")
        
        if os.path.isabs(rel_file):
            file_path = rel_file
        else:
            candidates = [
                os.path.join(base_dir, "data", rel_file),
                os.path.join(base_dir, rel_file),
                os.path.join(base_dir, "data", "dictionaries", os.path.basename(rel_file)),
                os.path.join(base_dir, "data", os.path.basename(rel_file))
            ]
            file_path = next((p for p in candidates if os.path.exists(p)), candidates[0])
        
        if not os.path.exists(file_path):
            return None
            
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                cls._dict_cache[dict_id] = data
                return data
        except Exception as e:
            print(f"Erreur chargement dictionnaire {dict_id} ({file_path}) : {e}")
            return None

    @classmethod
    def get_all_dictionaries(cls) -> list:
        """Retourne la liste enrichie de tous les dictionnaires disponibles."""
        reg = cls.load_registry()
        result = []
        for d in reg:
            item = dict(d)
            dict_type = d.get("type", "custom")
            if dict_type == "strong":
                item["badge"] = "STRONG"
                item["subtitle"] = "Lexique Hébreu & Grec Strong"
            elif dict_type == "greek":
                item["badge"] = "BAILLY"
                item["subtitle"] = "Grec Ancien - Français"
            else:
                data = cls.load_dictionary_file(d)
                if data and "articles" in data:
                    item["count"] = len(data["articles"])
                item["badge"] = "DICT"
                item["subtitle"] = f"{item.get('count', 0):,} articles".replace(",", " ")
            result.append(item)
        return result

    @classmethod
    def get_headwords(
        cls, 
        dict_id: str, 
        letter: str = None, 
        query: str = None, 
        limit: int = 300, 
        offset: int = 0
    ) -> dict:
        """
        Retourne l'index alphabétique ordonné des termes / lemmes d'un dictionnaire spécifique.
        """
        reg = cls.load_registry()
        d_info = next((d for d in reg if d["id"] == dict_id), None)
        if not d_info:
            d_info = reg[0] if reg else {"id": dict_id, "name": dict_id}

        dict_type = d_info.get("type", "custom")
        headwords = []

        norm_q = cls.normalize_term(query) if query else ""
        filter_letter = letter.upper().strip() if letter and letter not in ["ALL", "TOUS", "*"] else None

        # 1. Strong
        if dict_type == "strong":
            from core.strong_lexicon import StrongLexicon
            lex = StrongLexicon.load_lexicon()
            for code, ent in lex.items():
                short = ent.get("short_code", ent.get("code", code))
                lemma = ent.get("lemma", "")
                translit = ent.get("translit", "")
                defn = ent.get("definition", "")
                title = f"{short} — {lemma} ({translit})" if translit else f"{short} — {lemma}"
                
                if filter_letter:
                    if filter_letter == "H" and not short.startswith("H"): continue
                    elif filter_letter == "G" and not short.startswith("G"): continue
                    elif filter_letter not in ["H", "G"] and not translit.upper().startswith(filter_letter) and not short.startswith(filter_letter):
                        continue
                if norm_q:
                    search_str = f"{short} {lemma} {translit} {cls.normalize_term(defn[:150])}".lower()
                    if norm_q not in search_str:
                        continue
                
                snippet = defn[:120] + "..." if len(defn) > 120 else defn
                headwords.append({
                    "slug": code,
                    "title": title,
                    "lemma": lemma,
                    "code": short,
                    "snippet": snippet
                })
            def strong_sort_key(item):
                c = item["code"]
                prefix = 0 if c.startswith("H") else 1
                num = int(re.sub(r'\D', '', c)) if re.search(r'\d+', c) else 0
                return (prefix, num)
            headwords.sort(key=strong_sort_key)

        # 2. Bailly
        elif dict_type == "greek":
            from core.strong_lexicon import StrongLexicon
            bailly_data = StrongLexicon.load_bailly()
            by_strong = bailly_data.get("by_strong", {})
            for code, entries in by_strong.items():
                if not entries: continue
                first = entries[0]
                hw = first.get("headword", code)
                txt = first.get("full_text", "")
                title = f"{code} — {hw}"
                if filter_letter and not hw.upper().startswith(filter_letter) and not code.startswith(filter_letter):
                    continue
                if norm_q and norm_q not in f"{code} {hw} {cls.normalize_term(txt[:150])}".lower():
                    continue
                headwords.append({
                    "slug": code,
                    "title": title,
                    "code": code,
                    "snippet": txt[:120] + "..." if len(txt) > 120 else txt
                })
            headwords.sort(key=lambda x: (int(re.sub(r'\D', '', x['code'])) if re.search(r'\d+', x['code']) else 0))

        # 3. Dictionnaires Personnalisés / Calmet / Vigouroux / Nouveau Dict
        else:
            data = cls.load_dictionary_file(d_info)
            articles = data.get("articles", {}) if data else {}
            
            for slug, art in articles.items():
                title = art.get("title") or art.get("headword") or slug
                clean_title = title.strip()
                norm_title = cls.normalize_term(clean_title)
                
                if filter_letter:
                    first_char = unicodedata.normalize('NFD', clean_title.upper())[0] if clean_title else ''
                    if first_char != filter_letter:
                        continue
                        
                if norm_q:
                    art_text = art.get("text", "")[:300]
                    if norm_q not in norm_title and norm_q not in cls.normalize_term(art_text):
                        continue
                        
                txt = art.get("text", "")
                snippet = re.sub(r'^[A-ZÉÈÊËÀÂÄÎÏÔÖÙÛÜÇ\s–-]{2,}\s*', '', txt).strip()
                if len(snippet) > 120:
                    snippet = snippet[:120] + "..."
                elif not snippet:
                    snippet = txt[:120] + "..." if len(txt) > 120 else txt
                    
                headwords.append({
                    "slug": slug,
                    "title": clean_title,
                    "snippet": snippet
                })
                
            headwords.sort(key=lambda x: cls.normalize_term(x["title"]))

        total_count = len(headwords)
        paged_headwords = headwords[offset:offset + limit]

        return {
            "dict_id": d_info["id"],
            "dict_name": d_info["name"],
            "total_count": total_count,
            "offset": offset,
            "limit": limit,
            "headwords": paged_headwords
        }

    @classmethod
    def get_entry_content(cls, dict_id: str, slug_or_title: str, strong_code: str = None) -> dict:
        """Retourne le contenu complet et enrichi d'un article de dictionnaire."""
        reg = cls.load_registry()
        d_info = next((d for d in reg if d["id"] == dict_id), None)
        if not d_info:
            d_info = reg[0] if reg else {"id": dict_id, "name": dict_id}

        main_match = cls.lookup_in_dict(d_info, slug_or_title, strong_code=strong_code)
        
        other_matches = []
        for other_d in reg:
            if other_d["id"] == dict_id:
                continue
            m = cls.lookup_in_dict(other_d, slug_or_title, strong_code=strong_code)
            if m:
                other_matches.append(m)

        all_matches = ([main_match] if main_match else []) + other_matches

        if not main_match and other_matches:
            main_match = other_matches[0]

        if not main_match:
            return {
                "dict_id": dict_id,
                "dict_name": d_info.get("name", dict_id),
                "title": slug_or_title,
                "full_text": "",
                "matches": []
            }

        return {
            "dict_id": dict_id,
            "dict_name": d_info.get("name", dict_id),
            "title": main_match.get("title", slug_or_title),
            "badge": main_match.get("badge", d_info.get("name", dict_id)),
            "full_text": main_match.get("full_text", ""),
            "raw_text": main_match.get("raw_text", ""),
            "is_polished": main_match.get("is_polished", False),
            "polished_model": main_match.get("polished_model", ""),
            "slug": slug_or_title,
            "matches": all_matches
        }

    @classmethod
    def lookup_in_dict(cls, dict_info, word, strong_code=None):
        """Recherche dans une source de dictionnaire spécifique."""
        dict_id = dict_info["id"]
        dict_type = dict_info.get("type", "custom")
        
        # 1. Source Strong
        if dict_type == "strong":
            target_code = strong_code
            if not target_code and word and re.match(r'^[HG]\d+', word.strip(), re.I):
                target_code = word.strip().upper()
            if not target_code:
                return None
            entry = StrongLexicon.get(target_code)
            if not entry:
                return None
            code = entry.get('short_code', entry.get('code', ''))
            lang = "Hébreu" if entry.get('lang') == 'hebrew' else "Grec"
            lemma = entry.get('lemma', '')
            defn = entry.get('definition', '').strip()
            return {
                "dict_id": dict_id,
                "dict_name": dict_info["name"],
                "badge": f"■ Strong {code} ({lang})",
                "title": f"{word} [{lemma}]" if word and word != code else f"Strong {code} [{lemma}]",
                "preview": defn[:220] + "..." if len(defn) > 220 else defn,
                "full_text": defn,
                "entry": entry
            }
            
        # 2. Source Bailly (grec)
        if dict_type == "greek":
            target_code = strong_code
            if not target_code and word and re.match(r'^G\d+', word.strip(), re.I):
                target_code = word.strip().upper()
            if not target_code or not target_code.startswith("G"):
                return None
            b_entries = StrongLexicon.get_bailly_entries(target_code)
            if not b_entries:
                return None
            b_first = b_entries[0]
            hw = b_first.get("headword", word)
            txt = b_first.get("full_text", "")
            return {
                "dict_id": dict_id,
                "dict_name": dict_info["name"],
                "badge": "Dictionnaire Grec Bailly (1901)",
                "title": hw,
                "preview": txt[:220] + "..." if len(txt) > 220 else txt,
                "full_text": txt,
                "entries": b_entries
            }
            
        # 3. Dictionnaire personnalisé / Calmet / Format standard
        data = cls.load_dictionary_file(dict_info)
        if not data:
            return None
            
        articles = data.get("articles", {})
        keywords = data.get("keywords", {})
        norm = cls.normalize_term(word)
        if not norm or norm in cls._stop_words:
            return None
            
        art = None
        if norm in articles:
            art = articles[norm]
        elif norm.endswith("s") and len(norm) > 3 and norm[:-1] in articles:
            art = articles[norm[:-1]]
        elif norm in keywords:
            t_keys = keywords[norm]
            if t_keys and t_keys[0] in articles:
                art = articles[t_keys[0]]
        elif norm in ("abraham", "abrahams") and "abram" in articles:
            art = articles["abram"]
            
        if not art:
            return None
            
        orig_text = art.get("text", "")
        try:
            from core.dictionary_polisher import DictionaryPolisher
            cached_polish = DictionaryPolisher.get_polished_entry(dict_id, norm) or DictionaryPolisher.get_polished_entry(dict_id, art.get("title", ""))
        except Exception:
            cached_polish = None
            
        is_polished = False
        polished_model = ""
        if cached_polish and cached_polish.get("text"):
            raw_text = cached_polish["text"]
            is_polished = True
            polished_model = cached_polish.get("model", "")
        else:
            raw_text = orig_text
            
        paras = [p.strip() for p in raw_text.split('\n\n') if p.strip()]
        snippet = ""
        for p in paras:
            cleaned_p = re.sub(r'^[A-ZÉÈÊËÀÂÄÎÏÔÖÙÛÜÇ\s–-]{2,}\s*', '', p).strip()
            if len(cleaned_p) > 15:
                snippet = cleaned_p[:240] + "..." if len(cleaned_p) > 240 else cleaned_p
                break
                
        return {
            "dict_id": dict_id,
            "dict_name": dict_info["name"],
            "badge": dict_info['name'],
            "title": art.get("title", word),
            "preview": snippet or (raw_text[:200] + "..."),
            "full_text": raw_text,
            "raw_text": orig_text,
            "is_polished": is_polished,
            "polished_model": polished_model,
            "slug": norm,
            "art": art
        }

    _lookup_cache = {}

    @classmethod
    def lookup(cls, word, strong_code=None):
        """
        Recherche globale dans tous les dictionnaires activés, ordonnée par priorité utilisateur.
        Retourne une synthèse hiérarchisée pour l'info-bulle et le panneau complet avec cache mémoire instantané.
        """
        clean_w = word.strip(" ,:;.!?()«»[]\"'’\n\r\t") if word else ""
        if not clean_w and not strong_code:
            return None
            
        cache_key = (clean_w.lower(), strong_code or "")
        if cache_key in cls._lookup_cache:
            return cls._lookup_cache[cache_key]
            
        registry = cls.load_registry()
        # Trier par priorité
        active_dicts = sorted([d for d in registry if d.get("enabled", True)], key=lambda x: x.get("priority", 99))
        
        matches = []
        for d in active_dicts:
            res = cls.lookup_in_dict(d, clean_w, strong_code)
            if res:
                matches.append(res)
                
        if not matches:
            cls._lookup_cache[cache_key] = None
            return None
            
        # 1er dictionnaire = Priorité Principale
        leader = matches[0]
        
        # Titre global
        global_title = leader["title"]
        # Badge global
        if len(matches) == 1:
            global_badge = leader["badge"]
        else:
            global_badge = f"{leader['badge']} (+{len(matches)-1} autre{'s' if len(matches)>2 else ''})"
            
        # Construction du texte d'aperçu pour l'info-bulle
        preview_lines = []
        preview_lines.append(leader["preview"])
        
        if len(matches) > 1:
            other_names = [m['dict_name'] for m in matches[1:]]
            preview_lines.append(f"Aussi disponible dans : {', '.join(other_names)}")
            
        result = {
            "title": global_title,
            "badge": global_badge,
            "preview": "\n\n".join(preview_lines),
            "full_text": leader.get("full_text", "") or leader.get("preview", ""),
            "matches": matches
        }
        cls._lookup_cache[cache_key] = result
        return result

    @classmethod
    def search_all_entries(cls, query: str, limit: int = 50) -> list:
        """
        Recherche plein-texte dans tous les dictionnaires enregistrés (titres et définitions).
        """
        if not query or not query.strip():
            return []
            
        clean_q = query.strip()
        norm_q = cls.normalize_term(clean_q)
        if not norm_q:
            return []
            
        registry = cls.load_registry()
        active_dicts = sorted([d for d in registry if d.get("enabled", True)], key=lambda x: x.get("priority", 99))
        
        results = []
        seen_titles = set()
        
        # 1. Recherche par lookup exact ou préfixe direct d'abord
        direct = cls.lookup(clean_q)
        if direct and "matches" in direct:
            for m in direct["matches"]:
                t = m.get("title", clean_q)
                if t not in seen_titles:
                    seen_titles.add(t)
                    results.append({
                        "dict_id": m.get("dict_id"),
                        "dict_name": m.get("dict_name", "Dictionnaire"),
                        "term": t,
                        "definition": m.get("full_text", m.get("preview", "")),
                        "preview": m.get("preview", "")
                    })
                    
        # 2. Parcourir les dictionnaires JSON (Calmet, Théologie systématique, etc.)
        for d in active_dicts:
            dict_type = d.get("type", "custom")
            if dict_type in ("strong", "greek"):
                continue
                
            data = cls.load_dictionary_file(d)
            if not data:
                continue
                
            articles = data.get("articles", {})
            for key, art in articles.items():
                if len(results) >= limit:
                    break
                title = art.get("title", key)
                norm_title = cls.normalize_term(title)
                text = art.get("text", "")
                
                # Match dans le titre ou le début du texte
                if norm_q in norm_title or (len(norm_q) >= 4 and norm_q in cls.normalize_term(text[:500])):
                    if title not in seen_titles:
                        seen_titles.add(title)
                        snippet = text[:250] + "..." if len(text) > 250 else text
                        results.append({
                            "dict_id": d.get("id"),
                            "dict_name": d.get("name", "Dictionnaire"),
                            "term": title,
                            "definition": text,
                            "preview": snippet
                        })
                        
        return results

    @classmethod
    def import_dictionary(cls, file_path, custom_name=None):
        """
        Importe un nouveau dictionnaire depuis un fichier DOCX, JSON ou CSV.
        Extrait automatiquement les articles et l'enregistre dans data/dictionaries/.
        """
        if not os.path.exists(file_path):
            return {"success": False, "error": "Fichier introuvable."}
            
        filename = os.path.basename(file_path)
        base_name, ext = os.path.splitext(filename)
        ext = ext.lower()
        
        dict_name = custom_name or base_name.replace("_", " ").replace("-", " ").title()
        dict_id = re.sub(r'[^a-z0-9_]', '', cls.normalize_term(dict_name).replace(" ", "_"))[:20]
        if not dict_id:
            dict_id = f"dict_{len(cls.load_registry()) + 1}"
            
        dest_filename = f"{dict_id}.json"
        dest_path = os.path.join(cls.get_dict_dir(), dest_filename)
        
        entries = {}
        keywords = {}
        
        try:
            if ext == ".docx":
                # 1. Analyse DOCX (Logos ou Standard)
                with zipfile.ZipFile(file_path, 'r') as z:
                    if 'word/document.xml' not in z.namelist():
                        return {"success": False, "error": "Document DOCX invalide."}
                        
                    with z.open('word/document.xml') as f:
                        current_hw = None
                        current_paras = []
                        
                        for event, elem in ET.iterparse(f, events=('end',)):
                            if elem.tag.endswith('}p'):
                                text_parts = [t.text for t in elem.iter() if t.tag.endswith('}t') and t.text]
                                p_text = ''.join(text_parts).strip()
                                if p_text:
                                    m = re.search(r'\[\[@Headword:([^\]]+)\]\]', p_text)
                                    if m:
                                        if current_hw and current_paras:
                                            norm_k = cls.normalize_term(current_hw)
                                            if norm_k:
                                                entries[norm_k] = {
                                                    "title": current_hw,
                                                    "text": '\n\n'.join(current_paras).strip()
                                                }
                                                for sub_w in current_hw.split():
                                                    sub_norm = cls.normalize_term(sub_w)
                                                    if len(sub_norm) >= 3:
                                                        if sub_norm not in keywords:
                                                            keywords[sub_norm] = []
                                                        if norm_k not in keywords[sub_norm]:
                                                            keywords[sub_norm].append(norm_k)
                                        current_hw = m.group(1).strip()
                                        current_paras = []
                                        clean_first = re.sub(r'\[\[@Headword:[^\]]+\]\]', '', p_text).strip()
                                        if clean_first:
                                            current_paras.append(clean_first)
                                    else:
                                        if current_hw:
                                            current_paras.append(p_text)
                                elem.clear()
                                
                        if current_hw and current_paras:
                            norm_k = cls.normalize_term(current_hw)
                            if norm_k:
                                entries[norm_k] = {
                                    "title": current_hw,
                                    "text": '\n\n'.join(current_paras).strip()
                                }
                                
            elif ext == ".json":
                # 2. Analyse JSON
                with open(file_path, "r", encoding="utf-8") as f:
                    raw_data = json.load(f)
                    if isinstance(raw_data, dict) and "articles" in raw_data:
                        entries = raw_data.get("articles", {})
                        keywords = raw_data.get("keywords", {})
                    elif isinstance(raw_data, list):
                        for item in raw_data:
                            title = item.get("title") or item.get("word") or item.get("term")
                            txt = item.get("text") or item.get("definition") or item.get("def")
                            if title and txt:
                                norm_k = cls.normalize_term(title)
                                entries[norm_k] = {"title": title, "text": txt}
                                
            elif ext == ".csv":
                # 3. Analyse CSV
                with open(file_path, "r", encoding="utf-8") as f:
                    reader = csv.reader(f)
                    for row in reader:
                        if len(row) >= 2:
                            title = row[0].strip()
                            txt = row[1].strip()
                            if title and txt:
                                norm_k = cls.normalize_term(title)
                                entries[norm_k] = {"title": title, "text": txt}
                                
            if not entries:
                return {"success": False, "error": "Aucun article extrait du fichier."}
                
            # Sauvegarder le dictionnaire extrait
            dict_content = {
                "articles": entries,
                "keywords": keywords
            }
            with open(dest_path, "w", encoding="utf-8") as f:
                json.dump(dict_content, f, ensure_ascii=False, indent=2)
                
            # Enregistrer dans le registre
            reg = cls.load_registry()
            max_prio = max([d.get("priority", 0) for d in reg], default=0)
            
            # Vérifier si l'id existe déjà
            existing = next((d for d in reg if d["id"] == dict_id), None)
            if existing:
                existing["name"] = dict_name
                existing["count"] = len(entries)
                existing["file"] = os.path.relpath(dest_path, os.path.dirname(cls.get_dict_dir()))
            else:
                reg.append({
                    "id": dict_id,
                    "name": dict_name,
                    "type": "custom",
                    "enabled": True,
                    "priority": max_prio + 1,
                    "count": len(entries),
                    "file": os.path.relpath(dest_path, os.path.dirname(cls.get_dict_dir()))
                })
                
            cls.save_registry(reg)
            # Vider le cache pour forcer le rechargement
            cls._dict_cache.pop(dict_id, None)
            
            return {
                "success": True,
                "id": dict_id,
                "name": dict_name,
                "count": len(entries)
            }
            
        except Exception as e:
            return {"success": False, "error": f"Erreur lors de l'import : {str(e)}"}
