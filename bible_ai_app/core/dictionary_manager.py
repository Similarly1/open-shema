import os
import json
import re
import zipfile
import xml.etree.ElementTree as ET
import csv
import unicodedata
from typing import Dict, List, Any, Optional
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
        
        meta_info = {
            "nouveau_dictionnaire": {"author": "Collectif / Éditions Emmaüs", "year": "1992", "badge": "7 016 art.", "count": 7016},
            "calmet": {"author": "Dom Augustin Calmet", "year": "1728", "badge": "5 369 art.", "count": 5369},
            "vigouroux": {"author": "Fulcran Vigouroux", "year": "1912", "badge": "7 585 art.", "count": 7585},
            "strong": {"author": "James Strong", "year": "1890", "badge": "14 024 ent.", "count": 14024},
            "bailly": {"author": "Anatole Bailly", "year": "1901", "badge": "14 642 ent.", "count": 14642},
            "theologie_systematiq": {"author": "Études Doctrinales", "year": "", "badge": "99 art.", "count": 99},
        }

        for d in reg:
            item = dict(d)
            d_id = d.get("id", "")
            custom_meta = meta_info.get(d_id, {})
            
            if "author" in custom_meta and not item.get("author"):
                item["author"] = custom_meta["author"]
            if "year" in custom_meta and not item.get("year"):
                item["year"] = custom_meta["year"]
                
            dict_type = d.get("type", "custom")
            if dict_type == "strong":
                item["count"] = 14024
                item["badge"] = "14 024 ent."
                item["subtitle"] = f"{item.get('author', 'James Strong')} ({item.get('year', '1890')})"
            elif dict_type == "greek":
                item["count"] = 14642
                item["badge"] = "14 642 ent."
                item["subtitle"] = f"{item.get('author', 'Anatole Bailly')} ({item.get('year', '1901')})"
            else:
                data = cls.load_dictionary_file(d)
                if data and "articles" in data:
                    item["count"] = len(data["articles"])
                elif "count" in custom_meta:
                    item["count"] = custom_meta["count"]
                cnt = item.get("count", 0)
                item["badge"] = f"{cnt:,} art.".replace(",", " ")
                yr = f" ({item.get('year')})" if item.get('year') else ""
                item["subtitle"] = f"{item.get('author', 'Auteur non spécifié')}{yr}"

            result.append(item)
        return result

    _index_cache: Dict[str, List[Dict[str, Any]]] = {}

    @classmethod
    def invalidate_index_cache(cls, dict_id: str = None):
        """Invalide le cache d'index d'un dictionnaire ou de tous."""
        if dict_id:
            cls._index_cache.pop(dict_id, None)
        else:
            cls._index_cache.clear()

    @classmethod
    def _get_or_build_index(cls, dict_id: str, d_info: dict) -> List[Dict[str, Any]]:
        """Construit ou retourne l'index en mémoire ultra-rapide d'un dictionnaire."""
        if dict_id in cls._index_cache:
            return cls._index_cache[dict_id]

        dict_type = d_info.get("type", "custom")
        indexed_items = []

        if dict_type == "strong":
            from core.strong_lexicon import StrongLexicon
            lex = StrongLexicon.load_lexicon()
            for code, ent in lex.items():
                short = ent.get("short_code", ent.get("code", code))
                lemma = ent.get("lemma", "")
                translit = ent.get("translit", "")
                defn = ent.get("definition", "")
                title = f"{short} — {lemma} ({translit})" if translit else f"{short} — {lemma}"
                norm_title = f"{cls.normalize_term(short)} {cls.normalize_term(lemma)} {cls.normalize_term(translit)}".strip()
                snippet = defn[:120] + "..." if len(defn) > 120 else defn
                snippet = re.sub(r'^[,\.\:\;\—\–\-\s\'\^£«»\(\)\[\]]+', '', snippet).strip()
                
                # Première lettre pour le filtre A-Z
                first_letter = translit.upper()[0] if translit else short.upper()[0]

                indexed_items.append({
                    "slug": code,
                    "title": title,
                    "lemma": lemma,
                    "code": short,
                    "translit": translit,
                    "norm_title": norm_title,
                    "first_letter": first_letter,
                    "snippet": snippet,
                    "norm_body": cls.normalize_term(defn[:400])
                })

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
                norm_title = f"{cls.normalize_term(code)} {cls.normalize_term(hw)}".strip()
                snippet = txt[:120] + "..." if len(txt) > 120 else txt
                snippet = re.sub(r'^[,\.\:\;\—\–\-\s\'\^£«»\(\)\[\]]+', '', snippet).strip()
                first_letter = unicodedata.normalize('NFD', hw.upper())[0] if hw else code.upper()[0]

                indexed_items.append({
                    "slug": code,
                    "title": title,
                    "code": code,
                    "norm_title": norm_title,
                    "first_letter": first_letter,
                    "snippet": snippet,
                    "norm_body": cls.normalize_term(txt[:400])
                })

        else:
            data = cls.load_dictionary_file(d_info)
            articles = data.get("articles", {}) if data else {}
            for slug, art in articles.items():
                title = (art.get("title") or art.get("headword") or slug).strip()
                norm_title = cls.normalize_term(title)
                first_char = unicodedata.normalize('NFD', title.upper())[0] if title else ''
                txt = art.get("text", "")
                
                snippet = re.sub(r'^(?:[0-9]+\.\s*)?[A-ZÉÈÊËÀÂÄÎÏÔÖÙÛÜÇ\s–-]{2,}\s*', '', txt).strip()
                snippet = re.sub(r'^[,\.\:\;\—\–\-\s\'\^£«»\(\)\[\]\?\/\\\|]+', '', snippet).strip()
                if not snippet:
                    snippet = re.sub(r'^[,\.\:\;\—\–\-\s\'\^£«»]+', '', txt).strip()
                if len(snippet) > 130:
                    snippet = snippet[:130] + "..."

                indexed_items.append({
                    "slug": slug,
                    "title": title,
                    "norm_title": norm_title,
                    "first_letter": first_char,
                    "snippet": snippet,
                    "norm_body": cls.normalize_term(txt[:500])
                })

        cls._index_cache[dict_id] = indexed_items
        return indexed_items

    @classmethod
    def get_all_headword_titles(cls, dict_id: str) -> List[str]:
        """Retourne la liste de tous les titres et slugs disponibles pour valider les renvois en temps réel."""
        reg = cls.load_registry()
        d_info = next((d for d in reg if d["id"] == dict_id), None)
        if not d_info:
            return []
        items = cls._get_or_build_index(dict_id, d_info)
        titles = set()
        for it in items:
            if it.get("slug"):
                slug_up = it["slug"].upper()
                titles.add(slug_up)
                titles.add(unicodedata.normalize('NFD', slug_up).encode('ascii', 'ignore').decode('utf-8'))
            if it.get("title"):
                t_clean = re.sub(r'^(?:[0-9]+\.\s*)', '', it["title"]).strip().upper()
                titles.add(t_clean)
                titles.add(unicodedata.normalize('NFD', t_clean).encode('ascii', 'ignore').decode('utf-8'))
                first_word = t_clean.split(' ')[0]
                if len(first_word) >= 3:
                    titles.add(first_word)
                    titles.add(unicodedata.normalize('NFD', first_word).encode('ascii', 'ignore').decode('utf-8'))
        return list(titles)

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
        Retourne l'index alphabétique ordonné des termes / lemmes d'un dictionnaire spécifique en quelques millisecondes.
        """
        reg = cls.load_registry()
        d_info = next((d for d in reg if d["id"] == dict_id), None)
        if not d_info:
            d_info = reg[0] if reg else {"id": dict_id, "name": dict_id}

        dict_type = d_info.get("type", "custom")
        norm_q = cls.normalize_term(query) if query else ""
        filter_letter = letter.upper().strip() if letter and letter not in ["ALL", "TOUS", "*"] else None

        items = cls._get_or_build_index(dict_id, d_info)
        headwords = []

        for item in items:
            # 1. Filtre par lettre A-Z
            if filter_letter:
                fl = item.get("first_letter", "")
                if filter_letter in ["H", "G"] and dict_type == "strong":
                    if not item.get("code", "").startswith(filter_letter):
                        continue
                elif filter_letter not in ["H", "G"] and dict_type == "strong":
                    if not item.get("translit", "").upper().startswith(filter_letter) and not item.get("code", "").startswith(filter_letter):
                        continue
                elif fl != filter_letter:
                    continue

            # 2. Pertinence de recherche ordonnée
            match_score = 0
            if norm_q:
                nt = item["norm_title"]
                if nt == norm_q or (dict_type == "strong" and (cls.normalize_term(item.get("code", "")) == norm_q or cls.normalize_term(item.get("lemma", "")) == norm_q)):
                    match_score = 0
                elif nt.startswith(norm_q) or (dict_type == "strong" and (cls.normalize_term(item.get("code", "")).startswith(norm_q) or cls.normalize_term(item.get("lemma", "")).startswith(norm_q) or cls.normalize_term(item.get("translit", "")).startswith(norm_q))):
                    match_score = 1
                elif re.search(r'\b' + re.escape(norm_q), nt):
                    match_score = 2
                elif norm_q in nt:
                    match_score = 3
                elif norm_q in item.get("norm_body", ""):
                    match_score = 4
                else:
                    continue

            res_item = {
                "slug": item["slug"],
                "title": item["title"],
                "snippet": item["snippet"],
                "_score": match_score,
                "_norm_title": item["norm_title"]
            }
            if "code" in item:
                res_item["code"] = item["code"]
            if "lemma" in item:
                res_item["lemma"] = item["lemma"]

            headwords.append(res_item)

        if norm_q:
            # Priorité absolue : Score 0 (titre exact) -> Score 1 (commence par) -> Score 2 (mot commence par) -> Score 3 (contient) -> Score 4 (corps)
            headwords.sort(key=lambda x: (x["_score"], len(x["title"]), x["_norm_title"]))
        elif dict_type == "strong":
            def strong_sort_key(it):
                c = it.get("code", "")
                prefix = 0 if c.startswith("H") else 1
                num = int(re.sub(r'\D', '', c)) if re.search(r'\d+', c) else 0
                return (prefix, num)
            headwords.sort(key=strong_sort_key)
        elif dict_type == "greek":
            headwords.sort(key=lambda x: (int(re.sub(r'\D', '', x.get('code', ''))) if re.search(r'\d+', x.get('code', '')) else 0))
        else:
            headwords.sort(key=lambda x: x["_norm_title"])

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
            "illustrations": main_match.get("illustrations", []),
            "matches": all_matches
        }

    _vigouroux_illustrations = None

    @classmethod
    def get_vigouroux_illustrations(cls, word_or_title: str) -> list:
        """Récupère la liste des gravures Vigouroux associées à un mot-clé."""
        if cls._vigouroux_illustrations is None:
            data_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "dictionaries")
            json_path = os.path.join(data_dir, "vigouroux_illustrations.json")
            if os.path.exists(json_path):
                try:
                    with open(json_path, "r", encoding="utf-8") as f:
                        cls._vigouroux_illustrations = json.load(f)
                except Exception:
                    cls._vigouroux_illustrations = {}
            else:
                cls._vigouroux_illustrations = {}
        
        if not word_or_title:
            return []
        
        key = word_or_title.strip().upper()
        norm_key = re.sub(r'[^A-Z0-9]', '', key)
        return cls._vigouroux_illustrations.get(key) or cls._vigouroux_illustrations.get(norm_key) or []

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
                
            entry = None
            if target_code:
                entry = StrongLexicon.get(target_code)
            elif word:
                # 1. Recherche par mot original hébreu/grec
                entry = StrongLexicon.find_by_original_word(word)
                # 2. Recherche par mot français
                if not entry:
                    entry = StrongLexicon.find_by_french_word(word)

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
                "entry": entry,
                "is_strong": True,
                "strong": code,
                "lemma": lemma
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
                
        illustrations = []
        if "vigouroux" in dict_id.lower() or "vigouroux" in dict_info.get("name", "").lower():
            illustrations = cls.get_vigouroux_illustrations(art.get("title", word)) or cls.get_vigouroux_illustrations(norm)

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
            "illustrations": illustrations,
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
                                    m = re.search(r'\[\[@(Headword|Topic|Article|Dictionary):([^\]]+)\]\]', p_text)
                                    if m:
                                        if current_hw and current_paras:
                                            norm_k = cls.normalize_term(current_hw)
                                            if norm_k:
                                                clean_txt = '\n\n'.join(current_paras).strip()
                                                clean_txt = re.sub(r'\{\{field-(?:on|off):.*?\}\}', '', clean_txt)
                                                clean_txt = re.sub(r'<Bible:\s*([^>]+)>', r'\1', clean_txt)
                                                entries[norm_k] = {
                                                    "title": current_hw,
                                                    "text": clean_txt,
                                                    "source": "Didier Fontaine / Areopage.net",
                                                    "formatter": "Bible Parser"
                                                }
                                                for sub_w in current_hw.split():
                                                    sub_norm = cls.normalize_term(sub_w)
                                                    if len(sub_norm) >= 3:
                                                        if sub_norm not in keywords:
                                                            keywords[sub_norm] = []
                                                        if norm_k not in keywords[sub_norm]:
                                                            keywords[sub_norm].append(norm_k)
                                        current_hw = m.group(2).strip()
                                        current_paras = []
                                        clean_first = re.sub(r'\[\[@(Headword|Topic|Article|Dictionary):[^\]]+\]\]', '', p_text).strip()
                                        clean_first = re.sub(r'\{\{field-(?:on|off):.*?\}\}', '', clean_first)
                                        if clean_first:
                                            current_paras.append(clean_first)
                                    else:
                                        if current_hw:
                                            clean_line = re.sub(r'\{\{field-(?:on|off):.*?\}\}', '', p_text).strip()
                                            if clean_line:
                                                current_paras.append(clean_line)
                                elem.clear()
                                
                        if current_hw and current_paras:
                            norm_k = cls.normalize_term(current_hw)
                            if norm_k:
                                clean_txt = '\n\n'.join(current_paras).strip()
                                clean_txt = re.sub(r'\{\{field-(?:on|off):.*?\}\}', '', clean_txt)
                                clean_txt = re.sub(r'<Bible:\s*([^>]+)>', r'\1', clean_txt)
                                entries[norm_k] = {
                                    "title": current_hw,
                                    "text": clean_txt,
                                    "source": "Didier Fontaine / Areopage.net",
                                    "formatter": "Bible Parser"
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
