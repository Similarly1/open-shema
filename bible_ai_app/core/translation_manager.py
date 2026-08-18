import os
import sqlite3
import re
import logging
from typing import Optional, Dict, Any, List, Tuple
from ai.llm_client import LLMClient

logger = logging.getLogger(__name__)

AVAILABLE_TRANSLATION_MODELS: List[Tuple[str, str]] = [
    # Google Gemini Flash-Lite (Recommandé pour 500 req/jour)
    ("gemini-3.5-flash-lite", "⚡ Gemini 3.5 Flash-Lite (500 req/j - Recommandé)"),
    ("gemini-2.5-flash-lite", "⚡ Gemini 2.5 Flash-Lite (500 req/j)"),
    ("gemini-3.1-flash-lite", "⚡ Gemini 3.1 Flash-Lite (500 req/j)"),
    
    # Google Gemini Flash
    ("gemini-3.7-flash", "🧠 Gemini 3.7 Flash (Google)"),
    ("gemini-3.5-flash", "🧠 Gemini 3.5 Flash (Google)"),
    ("gemini-2.5-flash", "⚡ Gemini 2.5 Flash (Google)"),
    
    # Mistral AI
    ("mistral-small-latest", "🇫🇷 Mistral Small (Mistral AI)"),
    ("mistral-large-latest", "🇫🇷 Mistral Large (Mistral AI)"),
    ("open-mistral-nemo", "🇫🇷 Mistral Nemo (Mistral AI)"),
    
    # Infomaniak Swiss AI
    ("mistralai/Ministral-3-14B-Instruct-2512", "🇨🇭 Ministral 3 14B (Infomaniak)"),
    ("mistralai/Mistral-Small-4-119B-2603", "🇨🇭 Mistral Small 4 119B (Infomaniak)"),
    ("Qwen/Qwen3.5-397B-A17B-FP8", "🇨🇭 Qwen 3.5 397B (Infomaniak)")
]

TRANSLATION_SYSTEM_PROMPT = """Tu es un traducteur théologique d'élite, expert en exégèse biblique et langues anciennes.
Ton rôle est de traduire fidèlement en français moderne, fluide et soigné un extrait de commentaire biblique ou une notice de dictionnaire.

Règles impératives de traduction :
1. Vocabulaire Théologique et Précision :
   - Traduis avec exactitude les termes doctrinaux (ex: 'justification by faith' -> 'justification par la foi', 'atonement' -> 'expiation / réconciliation', 'propitiation' -> 'propitiation', 'sanctification' -> 'sanctification').
   - Conserve les noms propres bibliques selon l'usage francophone standard (ex: 'James' -> 'Jacques', 'Jude' -> 'Jude', 'Isaiah' -> 'Ésaïe', 'Elijah' -> 'Élie').

2. Références Bibliques et Codes :
   - Conserve intactes toutes les abréviations et références de versets (ex: 'Gen. 1:1', 'Rom. 8:28', 'Matt. 5:3').
   - Ne modifie JAMAIS les codes Strong (ex: 'G1234', 'H4567') ni les balises textuelles.
   - Conserve les termes en hébreu, grec ou latin entre parenthèses ou italique tels quels.

3. Formatage et Structure :
   - Préserve rigoureusement la structure originale en Markdown (titres, puces, paragraphes, citations en gras/italique).
   - Rends directement le texte traduit en Markdown prêt à l'affichage, sans préambule, sans avertissement ni méta-commentaire du type "Voici la traduction :"."""

class TranslationManager:
    """
    Gestionnaire centralisé pour la détection de langue, la traduction LLM
    et la persistance non-destructive dans un cache SQLite local.
    """
    _db_path = None

    # Mots fonctionnels typiques pour chaque langue (heuristique instantanée <0.01ms)
    _FR_WORDS = {'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'dans', 'avec', 'pour', 'sur', 'par', 'ce', 'cette', 'ces', 'est', 'sont', 'il', 'elle', 'qui', 'que', 'mais', 'ou', 'et', 'donc'}
    _EN_WORDS = {'the', 'and', 'that', 'have', 'for', 'not', 'with', 'you', 'this', 'but', 'his', 'from', 'they', 'which', 'their', 'will', 'about', 'there', 'would', 'these', 'when', 'what'}
    _DE_WORDS = {'der', 'die', 'das', 'und', 'sein', 'in', 'von', 'haben', 'mit', 'auf', 'nicht', 'werden', 'auch', 'nach', 'wie', 'aber', 'wenn', 'durch', 'kann', 'dieser', 'diesem'}
    _ES_WORDS = {'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'en', 'para', 'por', 'con', 'que', 'pero', 'como', 'su', 'sus', 'este', 'esta', 'estos'}

    @classmethod
    def get_db_path(cls) -> str:
        if cls._db_path is None:
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            data_dir = os.path.join(base_dir, "data")
            os.makedirs(data_dir, exist_ok=True)
            cls._db_path = os.path.join(data_dir, "translations_cache.db")
            cls._init_db()
        return cls._db_path

    @classmethod
    def _init_db(cls):
        """Initialise la table SQLite pour le cache des traductions."""
        try:
            conn = sqlite3.connect(cls._db_path)
            cur = conn.cursor()
            cur.execute("""
                CREATE TABLE IF NOT EXISTS translations (
                    item_type TEXT,
                    item_id TEXT,
                    source_lang TEXT,
                    target_lang TEXT DEFAULT 'fr',
                    model_used TEXT,
                    original_text TEXT,
                    translated_text TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (item_type, item_id, target_lang)
                )
            """)
            conn.commit()
            conn.close()
        except Exception as e:
            logger.error(f"Erreur initialisation base translations_cache.db : {e}")

    @classmethod
    def detect_language(cls, text: str, meta_lang: Optional[str] = None) -> str:
        """
        Détecte la langue d'un texte. Renvoie 'fr', 'en', 'de', 'es' ou 'unknown'.
        """
        if meta_lang:
            clean_m = meta_lang.strip().lower()
            if clean_m in ['fr', 'fra', 'fre', 'french', 'français']:
                return 'fr'
            if clean_m in ['en', 'eng', 'english', 'anglais']:
                return 'en'
            if clean_m in ['de', 'deu', 'ger', 'german', 'allemand']:
                return 'de'
            if clean_m in ['es', 'esp', 'spa', 'spanish', 'espagnol']:
                return 'es'

        if not text or len(text.strip()) < 10:
            return 'fr'

        # Nettoyage et extraction de mots minuscules
        words = re.findall(r'\b[a-zA-Zà-öø-ÿÀ-ÖØ-ß]+\b', text.lower())
        if not words:
            return 'fr'

        # Échantillon des 100 premiers mots
        sample = words[:100]
        fr_count = sum(1 for w in sample if w in cls._FR_WORDS)
        en_count = sum(1 for w in sample if w in cls._EN_WORDS)
        de_count = sum(1 for w in sample if w in cls._DE_WORDS)
        es_count = sum(1 for w in sample if w in cls._ES_WORDS)

        scores = [('fr', fr_count), ('en', en_count), ('de', de_count), ('es', es_count)]
        scores.sort(key=lambda x: x[1], reverse=True)

        top_lang, top_score = scores[0]
        if top_score == 0:
            return 'fr'  # Par défaut français

        # Si le français a plus de points ou est égal au premier rang
        if fr_count >= top_score and fr_count > 0:
            return 'fr'

        return top_lang

    @classmethod
    def is_french(cls, text: str, meta_lang: Optional[str] = None) -> bool:
        """Renvoie True si le texte est en français."""
        return cls.detect_language(text, meta_lang) == 'fr'

    @classmethod
    def get_translation(cls, item_type: str, item_id: str, target_lang: str = "fr") -> Optional[Dict[str, Any]]:
        """
        Récupère une traduction déjà en cache SQLite si elle existe.
        """
        try:
            db_path = cls.get_db_path()
            conn = sqlite3.connect(db_path)
            cur = conn.cursor()
            cur.execute("""
                SELECT item_type, item_id, source_lang, target_lang, model_used, original_text, translated_text, created_at
                FROM translations
                WHERE item_type = ? AND item_id = ? AND target_lang = ?
            """, (item_type, item_id, target_lang))
            row = cur.fetchone()
            conn.close()

            if row:
                return {
                    "item_type": row[0],
                    "item_id": row[1],
                    "source_lang": row[2],
                    "target_lang": row[3],
                    "model_used": row[4],
                    "original_text": row[5],
                    "translated_text": row[6],
                    "created_at": row[7]
                }
        except Exception as e:
            logger.error(f"Erreur lecture cache translation : {e}")
        return None

    @classmethod
    def save_translation(cls, item_type: str, item_id: str, translated_text: str, model_used: str, 
                         source_lang: str = "auto", target_lang: str = "fr", original_text: str = "") -> bool:
        """
        Enregistre la version traduite dans le cache SQLite sans toucher au texte original de base.
        """
        try:
            db_path = cls.get_db_path()
            conn = sqlite3.connect(db_path)
            cur = conn.cursor()
            cur.execute("""
                INSERT OR REPLACE INTO translations (
                    item_type, item_id, source_lang, target_lang, model_used, original_text, translated_text, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            """, (item_type, item_id, source_lang, target_lang, model_used, original_text, translated_text))
            conn.commit()
            conn.close()
            return True
        except Exception as e:
            logger.error(f"Erreur sauvegarde cache translation : {e}")
            return False

    @classmethod
    def translate_text(cls, text: str, model: str, config: dict, 
                       item_type: str = "", item_id: str = "", source_lang: str = "auto") -> str:
        """
        Appelle le LLM configuré pour traduire le texte en français et met en cache le résultat.
        """
        if not text or not text.strip():
            return text

        clean_model = model or config.get("translation_model", "gemini-3.5-flash-lite")
        lower_m = clean_model.lower()

        # Déterminer le fournisseur et instancier le LLMClient
        if "/" in lower_m or "infomaniak" in lower_m or lower_m.startswith("qwen") or lower_m.startswith("google/gemma"):
            token = config.get("infomaniak_token", "")
            pid = config.get("infomaniak_product_id", "251")
            client = LLMClient(api_key=token, model=clean_model, provider="infomaniak", product_id=pid)
        elif lower_m.startswith("mistral-") or lower_m.startswith("open-mistral-") or lower_m.startswith("codestral-"):
            api_key = config.get("mistral_api_key", "")
            client = LLMClient(api_key=api_key, model=clean_model, provider="mistral")
        else:
            # Google Gemini par défaut
            api_key = config.get("gemini_api_key", "")
            client = LLMClient(api_key=api_key, model=clean_model, provider="gemini")

        user_prompt = f"Voici le texte à traduire fidèlement en français (conserve le Markdown et les références) :\n\n{text}"
        messages = [{"role": "user", "content": user_prompt}]

        try:
            translated = client.chat(messages=messages, system_prompt=TRANSLATION_SYSTEM_PROMPT)
            
            # Nettoyage léger des blocs de code markdown superflus si le LLM a entouré de ```markdown
            translated = translated.strip()
            if translated.startswith("```markdown") and translated.endswith("```"):
                translated = translated[11:-3].strip()
            elif translated.startswith("```") and translated.endswith("```"):
                translated = translated[3:-3].strip()

            # Enregistrer dans le cache SQLite si item_type et item_id sont renseignés
            if item_type and item_id:
                cls.save_translation(
                    item_type=item_type,
                    item_id=item_id,
                    translated_text=translated,
                    model_used=clean_model,
                    source_lang=source_lang,
                    target_lang="fr",
                    original_text=text
                )

            return translated
        except Exception as e:
            logger.error(f"Erreur lors de la traduction LLM ({clean_model}) : {e}")
            raise Exception(f"Échec de la traduction ({clean_model}) : {str(e)}")
