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
        file_path = os.path.join(base_dir, rel_file) if not os.path.isabs(rel_file) else rel_file
        
        if not os.path.exists(file_path):
            return None
            
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                cls._dict_cache[dict_id] = data
                return data
        except Exception as e:
            print(f"Erreur chargement dictionnaire {dict_id} : {e}")
            return None

    @classmethod
    def lookup_in_dict(cls, dict_info, word, strong_code=None):
        """Recherche dans une source de dictionnaire spécifique."""
        dict_id = dict_info["id"]
        dict_type = dict_info.get("type", "custom")
        
        # 1. Source Strong
        if dict_type == "strong":
            if not strong_code:
                return None
            entry = StrongLexicon.get(strong_code)
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
                "title": f"{word} [{lemma}]" if word else f"Strong {code} [{lemma}]",
                "preview": defn[:220] + "..." if len(defn) > 220 else defn,
                "full_text": defn,
                "entry": entry
            }
            
        # 2. Source Bailly (grec)
        if dict_type == "greek":
            if not strong_code or not strong_code.startswith("G"):
                return None
            b_entries = StrongLexicon.get_bailly_entries(strong_code)
            if not b_entries:
                return None
            b_first = b_entries[0]
            hw = b_first.get("headword", word)
            txt = b_first.get("full_text", "")
            return {
                "dict_id": dict_id,
                "dict_name": dict_info["name"],
                "badge": "🏛️ Dictionnaire Grec Bailly (1901)",
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
            
        raw_text = art.get("text", "")
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
            "badge": f"📖 {dict_info['name']}",
            "title": art.get("title", word),
            "preview": snippet or (raw_text[:200] + "..."),
            "full_text": raw_text,
            "art": art
        }

    @classmethod
    def lookup(cls, word, strong_code=None):
        """
        Recherche globale dans tous les dictionnaires activés, ordonnée par priorité utilisateur.
        Retourne une synthèse hiérarchisée pour l'info-bulle et le panneau complet.
        """
        clean_w = word.strip(" ,:;.!?()«»[]\"'’\n\r\t") if word else ""
        if not clean_w and not strong_code:
            return None
            
        registry = cls.load_registry()
        # Trier par priorité
        active_dicts = sorted([d for d in registry if d.get("enabled", True)], key=lambda x: x.get("priority", 99))
        
        matches = []
        for d in active_dicts:
            res = cls.lookup_in_dict(d, clean_w, strong_code)
            if res:
                matches.append(res)
                
        if not matches:
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
            preview_lines.append(f"📚 Aussi disponible dans : {', '.join(other_names)}")
            
        return {
            "word": clean_w,
            "title": global_title,
            "source": global_badge,
            "preview": "\n\n".join(preview_lines),
            "leader": leader,
            "matches": matches,
            # Rétro-compatibilité
            "strong": next((m["entry"] for m in matches if m["dict_id"] == "strong"), None),
            "calmet": next((m["art"] for m in matches if m["dict_id"] == "calmet"), None)
        }

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
