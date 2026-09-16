import json
import logging
from typing import Dict, Any, Optional
from ai.llm_client import LLMClient

logger = logging.getLogger(__name__)

class BookClassifier:
    """
    Classifie automatiquement les livres (titre + description ou table des matières)
    pour en extraire les métadonnées utiles au RAG Tri-Flux (corpus_scope, source_type, book_code).
    """
    
    SYSTEM_PROMPT = """Tu es un documentaliste biblique expert.
Ton rôle est de déterminer le corpus et le type d'un ouvrage à partir de son titre et de sa description (ou de ses premiers paragraphes).
Tu dois répondre STRICTEMENT en JSON en utilisant ce schéma :
{
  "corpus_scope": "NT | OT | BOTH | APOCRYPHA | GLOBAL",
  "source_type": "commentary_verse | book_intro | nt_context | ot_context | global_context | biblical_theology | systematic_theology | dictionary | sermon | general",
  "book_code": "Code USFM à 3 lettres majuscules (ex: MAT, ROM, GEN) ou null si l'ouvrage couvre plusieurs livres ou un thème large",
  "confidence": "high | low"
}

Règles de décision :
- corpus_scope : "GLOBAL" pour une théologie systématique, un dictionnaire biblique ou si ça couvre toute la Bible. "NT" si ça ne parle que du Nouveau Testament.
- source_type : 
   * "commentary_verse" pour les commentaires bibliques suivis.
   * "nt_context", "ot_context" ou "global_context" pour l'histoire, la culture, l'archéologie d'un testament ou de toute la Bible.
   * "systematic_theology" pour la dogmatique (Grudem, Calvin Institutio, etc.).
   * "dictionary" pour les lexiques, dictionnaires, encyclopédies.
- book_code : Si le livre traite d'un SEUL livre de la Bible (ex: "Commentaire sur Romains" -> "ROM"), ou d'un ENSEMBLE canonique reconnu parmi (GRP_PENTATEUCH, GRP_OT_HISTORICAL, GRP_WISDOM, GRP_PROPHETS_ALL, GRP_MAJOR_PROPHETS, GRP_MINOR_PROPHETS, GRP_GOSPELS, GRP_SYNOPTICS, GRP_GOSPELS_ACTS, GRP_PAULINE, GRP_PASTORAL, GRP_PRISON, GRP_GENERAL_EPISTLES, GRP_JOHANNINE). Sinon "null".
"""

    @classmethod
    def classify_metadata(cls, title: str, description: str, api_keys: Dict[str, str], model: str = "gemini-2.5-flash-lite") -> Dict[str, Any]:
        """
        Interroge le LLM pour classifier l'ouvrage.
        """
        # Résolution du client LLM (par défaut Gemini)
        provider = "gemini"
        api_key = api_keys.get("gemini_api_key") or api_keys.get("gemini")
        product_id = None
        
        if "infomaniak" in model.lower() or "ministral" in model.lower():
            provider = "infomaniak"
            api_key = api_keys.get("infomaniak_token")
            product_id = api_keys.get("infomaniak_product_id", "251")
        elif "mistral" in model.lower():
            provider = "mistral"
            api_key = api_keys.get("mistral_api_key")
            
        if not api_key:
            logger.warning(f"[BookClassifier] Clé API manquante pour {provider}. Classification ignorée.")
            return cls._get_default_tags()
            
        text_to_analyze = f"Titre : {title}\nDescription / Extrait : {description[:2000]}"
        
        try:
            llm = LLMClient(api_key=api_key, provider=provider, product_id=product_id)
            response = llm.ask_question(
                context="",
                question=text_to_analyze,
                system_prompt=cls.SYSTEM_PROMPT,
                model=model,
                json_mode=True
            )
            
            if response and not str(response).startswith("Erreur"):
                try:
                    data = json.loads(response)
                    # Validation basique
                    scope = data.get("corpus_scope", "GLOBAL")
                    stype = data.get("source_type", "general")
                    bcode = data.get("book_code")
                    if bcode == "null" or bcode == "None":
                        bcode = None
                    
                    return {
                        "corpus_scope": scope,
                        "source_type": stype,
                        "book_code": bcode,
                        "confidence": data.get("confidence", "low")
                    }
                except json.JSONDecodeError:
                    logger.error(f"[BookClassifier] Erreur parsing JSON: {response}")
            
            return cls._get_default_tags()
            
        except Exception as e:
            logger.error(f"[BookClassifier] Erreur lors de la classification IA: {e}")
            return cls._get_default_tags()
            
    @classmethod
    def heuristic_classify(cls, title: str, description: str = "") -> Dict[str, Any]:
        """
        Classifie localement et instantanément un ouvrage à partir de son titre et de sa description
        sans appel réseau / LLM.
        """
        from core.epub_loader import EpubLoader
        from core.reference_parser import CANONICAL_GROUPS
        
        full_text = f"{title} {description}".lower()

        # 1. Détection via detect_book_from_title (gère livres individuels et ensembles canoniques)
        t_detect = EpubLoader.detect_book_from_title(title)
        if t_detect and t_detect.get("book_code"):
            b_code = t_detect["book_code"]
            is_comm = any(w in full_text for w in ["commentaire", "explication", "vers par vers", "notes", "exposition", "expository"])
            return {
                "corpus_scope": t_detect.get("corpus_scope", "GLOBAL"),
                "source_type": "commentary_verse" if is_comm else ("biblical_theology" if b_code.startswith("GRP_") else "book_intro"),
                "book_code": b_code,
                "confidence": "high"
            }

        # 2. Détection par classify_chapter_title
        res = EpubLoader.classify_chapter_title(title)
        if res.get("book_code"):
            return {
                "corpus_scope": res["corpus_scope"],
                "source_type": "commentary_verse" if any(w in full_text for w in ["commentaire", "explication", "vers par vers", "notes"]) else "book_intro",
                "book_code": res["book_code"],
                "confidence": "high"
            }
            
        # 3. Si c'est une théologie systématique / dogmatique
        if any(w in full_text for w in ["systematique", "dogmatique", "institution", "doctrine chretienne", "grudem", "berkhof"]):
            return {
                "corpus_scope": "GLOBAL",
                "source_type": "systematic_theology",
                "book_code": None,
                "confidence": "medium"
            }
            
        # 4. Si c'est un dictionnaire ou glossaire
        if any(w in full_text for w in ["dictionnaire", "lexique", "encyclopedie", "vocabulaire"]):
            return {
                "corpus_scope": "GLOBAL",
                "source_type": "dictionary",
                "book_code": None,
                "confidence": "high"
            }
            
        # 5. Détection directe d'ensembles canoniques par mots-clés dans la description ou titre
        grp_keywords = [
            ("GRP_PENTATEUCH", "OT", ["pentateuque", "torah", "cinq livres de moise", "five books of moses"]),
            ("GRP_PAULINE", "NT", ["paulinien", "pauline", "epitres de paul", "lettres de paul"]),
            ("GRP_SYNOPTICS", "NT", ["synoptique", "synoptics", "synoptic"]),
            ("GRP_PASTORAL", "NT", ["pastorales", "pastoral epistles"]),
            ("GRP_PRISON", "NT", ["captivite", "prison epistles"]),
            ("GRP_MINOR_PROPHETS", "OT", ["petits prophetes", "minor prophets", "livre des douze", "douze prophetes"]),
            ("GRP_MAJOR_PROPHETS", "OT", ["grands prophetes", "major prophets"]),
            ("GRP_WISDOM", "OT", ["livres de sagesse", "wisdom literature", "poetiques"]),
            ("GRP_GOSPELS", "NT", ["quatre evangiles", "four gospels"]),
            ("GRP_JOHANNINE", "NT", ["johannique", "johannine"]),
            ("GRP_GENERAL_EPISTLES", "NT", ["epitres generales", "general epistles", "epitres catholiques"])
        ]
        for g_code, g_scope, kw_list in grp_keywords:
            if any(kw in full_text for kw in kw_list):
                return {
                    "corpus_scope": g_scope,
                    "source_type": "biblical_theology",
                    "book_code": g_code,
                    "confidence": "high"
                }

        # 6. Si c'est le Nouveau Testament uniquement
        if any(w in full_text for w in ["nouveau testament", "epitre", "evangile"]) and not any(w in full_text for w in ["ancien testament", "toute la bible"]):
            return {
                "corpus_scope": "NT",
                "source_type": "nt_context",
                "book_code": None,
                "confidence": "medium"
            }

        # 7. Si c'est l'Ancien Testament uniquement
        if any(w in full_text for w in ["ancien testament", "tanakh", "hebreu"]) and not any(w in full_text for w in ["nouveau testament", "toute la bible"]):
            return {
                "corpus_scope": "OT",
                "source_type": "ot_context",
                "book_code": None,
                "confidence": "medium"
            }

        return cls._get_default_tags()

    @classmethod
    def _get_default_tags(cls) -> Dict[str, Any]:
        return {
            "corpus_scope": "GLOBAL",
            "source_type": "general",
            "book_code": None,
            "confidence": "low"
        }

