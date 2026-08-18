import os
import json
import re
import unicodedata

class StrongLexicon:
    """
    Gestionnaire haute-performance du Lexique Strong (Hébreu & Grec) 
    et du Dictionnaire Grec-Français Bailly.
    """
    _lexicon = None
    _bailly = None

    @classmethod
    def load_lexicon(cls):
        if cls._lexicon is not None:
            return cls._lexicon
            
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        lex_path = os.path.join(base_dir, "data", "strong_lexicon.json")
        
        if not os.path.exists(lex_path):
            cls._lexicon = {}
            return cls._lexicon
            
        try:
            with open(lex_path, "r", encoding="utf-8") as f:
                cls._lexicon = json.load(f)
        except Exception as e:
            print(f"Erreur chargement dictionnaire Strong {lex_path} : {e}")
            cls._lexicon = {}
            
        return cls._lexicon

    @classmethod
    def load_bailly(cls):
        if cls._bailly is not None:
            return cls._bailly
            
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        bailly_path = os.path.join(base_dir, "data", "bailly_lexicon.json")
        
        if not os.path.exists(bailly_path):
            cls._bailly = {"by_strong": {}, "by_key": {}}
            return cls._bailly
            
        try:
            with open(bailly_path, "r", encoding="utf-8") as f:
                cls._bailly = json.load(f)
        except Exception as e:
            print(f"Erreur chargement dictionnaire Bailly {bailly_path} : {e}")
            cls._bailly = {"by_strong": {}, "by_key": {}}
            
        return cls._bailly

    @classmethod
    def clean_greek_key(cls, s):
        if not s:
            return ""
        s = s.replace('\xa0', ' ')
        if '-' in s:
            s = s.split('-')[0]
        nfd = unicodedata.normalize('NFD', s.lower())
        cleaned = ''.join(c for c in nfd if '\u0370' <= c <= '\u03ff' and unicodedata.category(c) != 'Mn')
        return cleaned.replace('ς', 'σ').strip()

    @classmethod
    def get_bailly_entries(cls, strong_code=None, lemma=None):
        """Retourne la liste des articles du Bailly associés à un code Strong ou un lemme grec."""
        bailly = cls.load_bailly()
        results = []
        
        # 1. Recherche directe par code Strong (G...)
        if strong_code:
            c = strong_code.strip().upper()
            digits = re.sub(r'\D', '', c)
            if digits and c.startswith('G'):
                num = int(digits)
                for k in [c, f"G{num:04d}", f"G{num}"]:
                    if k in bailly.get("by_strong", {}):
                        results.extend(bailly["by_strong"][k])
                        break
                        
        # 2. Recherche par lemme si pas trouvé par Strong
        if not results and lemma:
            norm_k = cls.clean_greek_key(lemma)
            if norm_k and norm_k in bailly.get("by_key", {}):
                results.extend(bailly["by_key"][norm_k])
                
        # Dédoublonner par texte
        unique_results = []
        seen = set()
        for r in results:
            txt = r.get("full_text", "")
            if txt not in seen:
                seen.add(txt)
                unique_results.append(r)
                
        return unique_results

    @classmethod
    def get(cls, strong_code):
        """
        Retourne l'entrée du dictionnaire Strong pour un code donné (ex: 'H7225', 'H0430', 'G3972', 'G1').
        Enrichit automatiquement l'entrée avec le dictionnaire Bailly pour les mots grecs.
        """
        if not strong_code:
            return None
            
        lex = cls.load_lexicon()
        c = strong_code.strip().upper()
        
        entry = None
        if c in lex:
            entry = lex[c]
        else:
            prefix = c[0] if c and c[0] in ('H', 'G') else ''
            digits = re.sub(r'\D', '', c)
            if digits and prefix:
                num = int(digits)
                k4 = f"{prefix}{num:04d}"
                ks = f"{prefix}{num}"
                if k4 in lex:
                    entry = lex[k4]
                elif ks in lex:
                    entry = lex[ks]
                    
        if entry is not None:
            # Créer une copie légère pour attacher Bailly sans corrompre le dictionnaire source
            entry_copy = dict(entry)
            if entry_copy.get("lang") == "greek" or c.startswith("G"):
                entry_copy["bailly"] = cls.get_bailly_entries(c, entry_copy.get("lemma"))
            return entry_copy
            
        return None

    @classmethod
    def get_multiple(cls, strong_codes_str):
        """
        Gère les chaînes contenant plusieurs codes séparés par des espaces (ex: 'G3588 G0846').
        Retourne la liste des fiches de définitions correspondantes.
        """
        if not strong_codes_str:
            return []
            
        codes = strong_codes_str.strip().split()
        results = []
        for code in codes:
            entry = cls.get(code)
            if entry:
                results.append(entry)
            else:
                results.append({
                    "code": code,
                    "raw_code": code,
                    "num": 0,
                    "lang": "hebrew" if code.startswith("H") else "greek",
                    "lemma": code,
                    "definition": f"Numéro Strong {code}",
                    "details": []
                })
        return results

    _heb_lemma_idx = None
    _grk_lemma_idx = None

    @classmethod
    def _ensure_lemma_indices(cls):
        if cls._heb_lemma_idx is not None and cls._grk_lemma_idx is not None:
            return
            
        lex = cls.load_lexicon()
        cls._heb_lemma_idx = {}
        cls._grk_lemma_idx = {}
        
        for code, ent in lex.items():
            lem = ent.get("lemma", "")
            if ent.get("lang") == "hebrew" or code.startswith("H"):
                nfd = unicodedata.normalize('NFD', lem)
                h_clean = ''.join(c for c in nfd if '\u0590' <= c <= '\u05ff' and unicodedata.category(c) != 'Mn')
                if h_clean:
                    cls._heb_lemma_idx.setdefault(h_clean, []).append(code)
            else:
                g_clean = cls.clean_greek_key(lem)
                if g_clean:
                    cls._grk_lemma_idx.setdefault(g_clean, []).append(code)

    @classmethod
    def find_by_original_word(cls, word):
        """Retourne la fiche Strong correspondante à un mot hébreu ou grec brut."""
        if not word:
            return None
        cls._ensure_lemma_indices()
        
        # Test hébreu
        if any('\u0590' <= c <= '\u05ff' for c in word):
            nfd = unicodedata.normalize('NFD', word)
            h_clean = ''.join(c for c in nfd if '\u0590' <= c <= '\u05ff' and unicodedata.category(c) != 'Mn')
            if h_clean in cls._heb_lemma_idx:
                code = cls._heb_lemma_idx[h_clean][0]
                return cls.get(code)
                
        # Test grec
        if any(('\u0370' <= c <= '\u03ff' or '\u1F00' <= c <= '\u1FFF') for c in word):
            g_clean = cls.clean_greek_key(word)
            if g_clean in cls._grk_lemma_idx:
                code = cls._grk_lemma_idx[g_clean][0]
                return cls.get(code)
                
        return None
