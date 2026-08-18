import os
import json
import re
import requests
import logging

logger = logging.getLogger(__name__)

POLISH_SYSTEM_PROMPT = """Tu es un éminent professeur d'exégèse biblique, philologue et éditeur scientifique spécialisé dans les encyclopédies et dictionnaires bibliques (notamment le Dictionnaire de la Bible de Fulcran Vigouroux et de Dom Calmet).
Ton rôle est de restaurer, restructurer et sublimer une notice de dictionnaire extraite d'un scan ancien OCRisé du XIXe/début XXe siècle.

Règles impératives de restauration :
1. Structure et Lisibilité :
   - Formate la notice en Markdown soigné et aéré.
   - S'il y a plusieurs acceptions ou sens numérotés (1., 2., 3., etc.), crée pour chacun un paragraphe distinct avec un sous-titre clair et en gras (ex: **1. Éden (Personnage / Lévite)**, **2. Éden (Jardin d'Éden / Paradis terrestre)**, etc.).
   - Utilise des puces et des retours à la ligne pour détacher les arguments géographiques, archéologiques et textuels.

2. Restauration Philologique et Langues Anciennes :
   - Rétablis les lettrines ou premières lettres coupées (ex: 'DEN' -> 'ÉDEN', 'AARON' -> '1. AARON').
   - Restitue avec exactitude les termes originaux en hébreu biblique avec translittération (ex: עֵדֶן / ‘Ēḏen, בֵּית עֵדֶן / Bêṯ ‘Ēḏen) et en grec biblique/Septante (ex: Ἐδέμ, τρυφή / Truphê) lorsque l'OCR a produit du bruit ou des caractères corrompus (ex: 'ESsfi, Tpt^', 'lEden', 'IwaScxjji').
   - Corrige les coquilles OCR typiques ('Get' -> 'Cet', 'dj' -> 'de', '11' -> 'Il', 'Edea' -> 'Éden', 'aobeir' -> 'à obéir', etc.).

3. Références Bibliques et Citations :
   - Rétablis les chiffres romains et versets bibliques corrompus (ex: 'Gen., u, 8' -> 'Gen., II, 8', 'm, 23' -> 'Gen., III, 23', 'xxxvn' -> 'XXXVII', 'xxvn' -> 'XXVII').
   - Mets en *italique* les citations latines (Vulgate, Pères), grecques, ainsi que les titres d'ouvrages et revues historiques (*Keilinschriften*, *Wo lag das Paradies*, etc.).

4. Intégrité et Fidélité :
   - Conserve rigoureusement toute la substance exégétique, historique, géographique et théologique de l'auteur d'origine sans supprimer de détails importants.
   - Rends directement le texte restauré en Markdown prêt à l'affichage, sans préambule ni méta-commentaires."""

AVAILABLE_POLISH_MODELS = [
    ("gemini-2.5-flash", "⚡ Gemini 2.5 Flash (Rapide & Économe - Recommandé)"),
    ("gemini-2.5-flash-lite", "⚡ Gemini 2.5 Flash-Lite (Ultra-rapide)"),
    ("gemini-3.7-flash", "🧠 Gemini 3.7 Flash (Haute Précision Exégétique)"),
    ("gemini-3.5-flash", "🧠 Gemini 3.5 Flash"),
    ("gemini-3.5-flash-lite", "⚡ Gemini 3.5 Flash-Lite")
]

class DictionaryPolisher:
    _cache = None
    
    @classmethod
    def get_cache_path(cls):
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        return os.path.join(base_dir, "data", "dictionaries", "polished_cache.json")

    @classmethod
    def load_cache(cls):
        if cls._cache is not None:
            return cls._cache
        c_path = cls.get_cache_path()
        if os.path.exists(c_path):
            try:
                with open(c_path, "r", encoding="utf-8") as f:
                    cls._cache = json.load(f)
                    return cls._cache
            except Exception as e:
                logger.error(f"Erreur chargement polished_cache.json : {e}")
        cls._cache = {}
        return cls._cache

    @classmethod
    def save_cache(cls):
        if cls._cache is None:
            return
        c_path = cls.get_cache_path()
        os.makedirs(os.path.dirname(c_path), exist_ok=True)
        try:
            with open(c_path, "w", encoding="utf-8") as f:
                json.dump(cls._cache, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"Erreur sauvegarde polished_cache.json : {e}")

    @classmethod
    def get_cache_key(cls, dict_id, slug_or_title):
        clean_key = re.sub(r'\s+', ' ', str(slug_or_title).strip().lower())
        return f"{dict_id}:{clean_key}"

    @classmethod
    def get_polished_entry(cls, dict_id, slug_or_title):
        """Récupère l'article restauré depuis le cache local si existant."""
        cache = cls.load_cache()
        key = cls.get_cache_key(dict_id, slug_or_title)
        return cache.get(key)

    @classmethod
    def set_polished_entry(cls, dict_id, slug_or_title, title, polished_text, model):
        """Enregistre un article poli dans le cache persistant."""
        cache = cls.load_cache()
        key = cls.get_cache_key(dict_id, slug_or_title)
        cache[key] = {
            "title": title,
            "text": polished_text,
            "model": model,
            "dict_id": dict_id
        }
        cls.save_cache()

    @classmethod
    def polish_article(cls, raw_text, title="", model="gemini-2.5-flash", api_key=None):
        """
        Envoie le texte brut au modèle sélectionné pour restauration philologique.
        Retourne (success: bool, result_or_error: str).
        """
        if not api_key:
            return False, "Clé API Gemini non configurée dans les paramètres."
            
        clean_model = model.strip()
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{clean_model}:generateContent?key={api_key}"
        
        user_prompt = f"""Notice à restaurer :
TITRE : {title or 'Article de Dictionnaire'}

TEXTE BRUT ORIGINAL :
\"\"\"
{raw_text}
\"\"\"
"""
        payload = {
            "systemInstruction": {
                "parts": [{"text": POLISH_SYSTEM_PROMPT}]
            },
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": user_prompt}]
                }
            ],
            "generationConfig": {
                "temperature": 0.2,
                "topP": 0.95
            }
        }
        
        try:
            resp = requests.post(url, json=payload, timeout=45)
            if resp.status_code == 200:
                data = resp.json()
                candidates = data.get("candidates", [])
                if candidates and "content" in candidates[0]:
                    parts = candidates[0]["content"].get("parts", [])
                    if parts and "text" in parts[0]:
                        polished_text = parts[0]["text"].strip()
                        return True, polished_text
                return False, "Réponse de l'API vide ou invalide."
            else:
                # Fallback si systemInstruction n'est pas supporté sur certains endpoints
                fallback_prompt = f"{POLISH_SYSTEM_PROMPT}\n\n---\n\n{user_prompt}"
                fallback_payload = {
                    "contents": [{"parts": [{"text": fallback_prompt}]}],
                    "generationConfig": {"temperature": 0.2}
                }
                fb_resp = requests.post(url, json=fallback_payload, timeout=45)
                if fb_resp.status_code == 200:
                    fb_data = fb_resp.json()
                    fb_candidates = fb_data.get("candidates", [])
                    if fb_candidates and "content" in fb_candidates[0]:
                        polished_text = fb_candidates[0]["content"]["parts"][0]["text"].strip()
                        return True, polished_text
                return False, f"Erreur API Gemini ({resp.status_code}) : {resp.text}"
        except requests.exceptions.Timeout:
            return False, "Délai d'attente dépassé (timeout). Veuillez réessayer."
        except Exception as e:
            return False, f"Erreur lors du polissage : {e}"
