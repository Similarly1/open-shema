"""
Open Shema - Module Conseiller de Lecture & Équilibrage Bibliographique.
Analyse la bibliothèque locale (auteurs, couverture canonique, thématiques, angles morts)
et formule des recommandations d'approfondissement et d'équilibrage via LLM.

RÈGLE STRICTE : Zéro émoji, 100% SVG.
"""

import os
import re
import json
import hashlib
import logging
from typing import Dict, List, Any, Optional

from core.paths import resolve_data_path, get_user_data_path
from core.config import load_config, DEFAULT_LIBRARY_ADVISOR_SYSTEM_PROMPT
from gui.library_utils import load_books_metadata
from ai.llm_client import LLMClient, resolve_llm_provider

logger = logging.getLogger(__name__)

CACHE_FILE = "library_advisor_cache.json"

# Listes de détection canonique et thématique
CANONICAL_KEYWORDS = {
    "wisdom": ["sagesse", "job", "psaume", "psaumes", "proverbe", "proverbes", "ecclesiaste", "cantique", "poesie"],
    "prophets": ["prophete", "prophetes", "esaie", "jeremie", "ezechiel", "daniel", "osee", "joel", "amos", "abdias", "jonas", "michee", "nahum", "habacuc", "sophonie", "aggee", "zacharie", "malachie"],
    "pentateuch": ["pentateuque", "genese", "exode", "levitique", "nombres", "deuteronome", "moise", "thora", "torah"],
    "ot_history": ["josue", "juges", "ruth", "samuel", "rois", "chroniques", "esdras", "nehemie", "esther"],
    "gospels_acts": ["evangile", "evangiles", "matthieu", "marc", "luc", "jean", "actes"],
    "pauline": ["paul", "paulinien", "romains", "corinthiens", "galates", "ephesiens", "philippiens", "colossiens", "thessaloniciens", "timothee", "tite", "philemon"],
    "general_epistles": ["hebreux", "jacques", "pierre", "jude"],
    "revelation": ["apocalypse", "eschatologie", "fin des temps"]
}

THEME_KEYWORDS = {
    "systematic": ["dogmatique", "systematique", "doctrine", "calvin", "hodge", "bavinck", "turretin", "grudem", "berkhof"],
    "biblical_theology": ["theologie biblique", "histoire du salut", "alliance", "alliances", "accomplissement", "vos", "carson", "wright"],
    "hermeneutics_languages": ["hermeneutique", "exegese", "grec", "hebreu", "grammaire", "lexique", "syntaxe", "interpretation", "methode"],
    "dictionaries": ["dictionnaire", "lexique", "encyclopedie", "concordance", "calmet", "vigouroux", "bailly"],
    "history_archaeology": ["histoire", "archeologie", "eglise", "peres", "patristique", "reforme", "contexte"],
    "pastoral_ethics": ["pastorale", "predication", "homiletique", "ethique", "ministere", "priere", "discipulat", "vie chretienne"]
}


class LibraryAdvisorManager:
    """Gestionnaire de profilage de bibliothèque et de conseil bibliographique."""

    _MEMORY_CACHE: Optional[Dict[str, Any]] = None

    @classmethod
    def invalidate_memory_cache(cls):
        """Invalide le cache en mémoire vive."""
        cls._MEMORY_CACHE = None

    @classmethod
    def get_cache_path(cls) -> str:
        cache_dir = get_user_data_path("cache")
        os.makedirs(cache_dir, exist_ok=True)
        return os.path.join(cache_dir, CACHE_FILE)

    @classmethod
    def compute_library_fingerprint(cls, books: List[Dict[str, Any]]) -> str:
        """Calcule une empreinte de la bibliothèque pour invalider le cache si des livres changent."""
        summary = []
        for b in sorted(books, key=lambda x: str(x.get("name", ""))):
            summary.append(f"{b.get('name')}|{b.get('title')}|{b.get('author')}|{b.get('type')}|{b.get('active', True)}")
        raw = "##".join(summary)
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]

    @classmethod
    def analyze_profile(cls) -> Dict[str, Any]:
        """
        Analyse locale et statistique instantanée de la bibliothèque de l'utilisateur.
        Détecte les auteurs récurrents, la distribution canonique/thématique,
        les angles morts et les ouvrages à compléter.
        """
        raw_books = load_books_metadata()
        books_list = []
        for name, meta in raw_books.items():
            b = dict(meta)
            b["name"] = name
            if not b.get("active", True):
                continue
            books_list.append(b)

        total_books = len(books_list)

        # 1. Classification par type
        types_count = {}
        for b in books_list:
            t = (b.get("type") or "Autre").strip()
            types_count[t] = types_count.get(t, 0) + 1

        # 2. Auteurs récurrents
        author_freq = {}
        for b in books_list:
            author = (b.get("author") or "").strip()
            if author and author.lower() not in ["collectif", "inconnu", "divers"]:
                # Normalisation légère
                clean_auth = re.sub(r'\(.*?\)', '', author).strip()
                author_freq[clean_auth] = author_freq.get(clean_auth, 0) + 1

        top_authors = sorted(author_freq.items(), key=lambda x: x[1], reverse=True)[:6]
        frequent_authors = [{"author": a, "count": c} for a, c in top_authors if c >= 1]

        # 3. Répartition Canonique & Thématique
        canonical_stats = {
            "pentateuch": 0,
            "ot_history": 0,
            "wisdom": 0,
            "prophets": 0,
            "gospels_acts": 0,
            "pauline": 0,
            "general_epistles": 0,
            "revelation": 0
        }

        theme_stats = {
            "systematic": 0,
            "biblical_theology": 0,
            "hermeneutics_languages": 0,
            "dictionaries": 0,
            "history_archaeology": 0,
            "pastoral_ethics": 0
        }

        incomplete_books = []

        for b in books_list:
            text_corpus = f"{b.get('title', '')} {b.get('name', '')} {b.get('description', '')} {b.get('author', '')} {' '.join(b.get('tags', []))}".lower()

            # Test canonique
            for cat, kws in CANONICAL_KEYWORDS.items():
                if any(kw in text_corpus for kw in kws):
                    canonical_stats[cat] += 1

            # Test thématique
            for th, kws in THEME_KEYWORDS.items():
                if any(kw in text_corpus for kw in kws):
                    theme_stats[th] += 1

            # Détection métadonnées incomplètes
            author_val = (b.get("author") or "").strip()
            desc_val = (b.get("description") or "").strip()
            title_val = (b.get("title") or b.get("name") or "").strip()

            is_bible = (b.get("type") or "").lower() == "bible"
            if not is_bible and (not author_val or len(desc_val) < 25):
                incomplete_books.append({
                    "name": b.get("name"),
                    "title": title_val,
                    "author": author_val or "Auteur non renseigné",
                    "has_desc": bool(desc_val)
                })

        # Totaux AT / NT
        ot_total = canonical_stats["pentateuch"] + canonical_stats["ot_history"] + canonical_stats["wisdom"] + canonical_stats["prophets"]
        nt_total = canonical_stats["gospels_acts"] + canonical_stats["pauline"] + canonical_stats["general_epistles"] + canonical_stats["revelation"]

        # 4. Diagnostic d'Angles Morts
        detected_gaps = []
        if ot_total == 0 and total_books >= 3:
            detected_gaps.append({
                "id": "gap_ot_global",
                "label": "Ancien Testament global",
                "explanation": "Aucun ouvrage identifié couvrant spécifiquement le corpus de l'Ancien Testament."
            })
        elif canonical_stats["wisdom"] == 0 and total_books >= 3:
            detected_gaps.append({
                "id": "gap_wisdom",
                "label": "Littérature sapientiale (Psaumes, Job, Proverbes)",
                "explanation": "Absence d'ouvrages ou commentaires spécialisés sur la poésie et les écrits de sagesse hébraïque."
            })
        elif canonical_stats["prophets"] == 0 and total_books >= 3:
            detected_gaps.append({
                "id": "gap_prophets",
                "label": "Prophètes de l'Ancien Testament",
                "explanation": "Faible représentation des livres prophétiques (Ésaïe, Jérémie, Petits Prophètes)."
            })

        if theme_stats["hermeneutics_languages"] == 0 and total_books >= 3:
            detected_gaps.append({
                "id": "gap_hermeneutics",
                "label": "Herméneutique & Méthode exégétique",
                "explanation": "Aucun manuel de méthode d'interprétation textuelle ou d'outils philologiques répertorié."
            })

        if theme_stats["systematic"] == 0 and total_books >= 3:
            detected_gaps.append({
                "id": "gap_systematic",
                "label": "Théologie systématique & Dogmatique",
                "explanation": "Manque d'ouvrages de synthèse doctrinale structurée."
            })

        if theme_stats["pastoral_ethics"] == 0 and total_books >= 3:
            detected_gaps.append({
                "id": "gap_ethics",
                "label": "Éthique chrétienne & Théologie pastorale",
                "explanation": "Peu de ressources orientées sur l'application pratique, le ministère et l'éthique."
            })

        # Barres d'équilibre en pourcentages
        grand_total_canonical = max(ot_total + nt_total, 1)
        ot_pct = int(round((ot_total / grand_total_canonical) * 100))
        nt_pct = 100 - ot_pct if ot_total + nt_total > 0 else 0

        fingerprint = cls.compute_library_fingerprint(books_list)

        return {
            "total_books": total_books,
            "types_count": types_count,
            "frequent_authors": frequent_authors,
            "canonical_stats": canonical_stats,
            "theme_stats": theme_stats,
            "ot_count": ot_total,
            "nt_count": nt_total,
            "ot_percentage": ot_pct,
            "nt_percentage": nt_pct,
            "detected_gaps": detected_gaps,
            "incomplete_books": incomplete_books[:6],  # Limite d'affichage
            "incomplete_books_count": len(incomplete_books),
            "fingerprint": fingerprint
        }

    @classmethod
    def get_advice(cls, force_refresh: bool = False) -> Dict[str, Any]:
        """
        Génère ou récupère en cache les conseils de lecture et d'équilibrage.
        """
        config = load_config()
        profile = cls.analyze_profile()
        cache_path = cls.get_cache_path()

        # 1. Vérification du cache mémoire rapide
        if not force_refresh and cls._MEMORY_CACHE:
            if cls._MEMORY_CACHE.get("fingerprint") == profile["fingerprint"] and cls._MEMORY_CACHE.get("deepening_recommendations"):
                logger.info("[LibraryAdvisor] Conseil retourné depuis le cache mémoire (bibliothèque inchangée).")
                res = dict(cls._MEMORY_CACHE)
                res["profile"] = profile
                res["from_cache"] = True
                return res

        # 2. Vérification du cache persistant sur disque
        if not force_refresh and os.path.exists(cache_path):
            try:
                with open(cache_path, "r", encoding="utf-8") as f:
                    cached_data = json.load(f)
                if cached_data.get("fingerprint") == profile["fingerprint"] and cached_data.get("deepening_recommendations"):
                    logger.info("[LibraryAdvisor] Conseil retourné depuis le cache disque (bibliothèque inchangée).")
                    cached_data["profile"] = profile
                    cached_data["from_cache"] = True
                    cls._MEMORY_CACHE = cached_data
                    return cached_data
            except Exception as e:
                logger.debug(f"[LibraryAdvisor] Erreur lecture cache : {e}")

        # 3. Si la bibliothèque est très petite (moins de 2 ouvrages)
        if profile["total_books"] < 2:
            fallback_advice = {
                "fingerprint": profile["fingerprint"],
                "profile": profile,
                "diagnostic": "Votre bibliothèque contient encore peu d'ouvrages indexés. Pour vous offrir des conseils affinés, importez quelques-uns de vos livres théologiques, commentaires ou Bibles d'étude favoris.",
                "strengths_summary": "Début de collection.",
                "gaps_summary": "Toutes les disciplines théologiques et sections canoniques sont ouvertes à la découverte.",
                "deepening_recommendations": [
                    {
                        "title": "La prédication biblique",
                        "author": "Haddon W. Robinson",
                        "publisher": "Éditions Clé",
                        "rationale": "Un classique incontournable de l'enseignement textuel pour débuter une bibliothèque homilétique solide."
                    },
                    {
                        "title": "Introduction au Nouveau Testament",
                        "author": "D.A. Carson, Douglas J. Moo",
                        "publisher": "Excelsis",
                        "rationale": "Une référence académique rigoureuse et accessible pour structurer toute recherche sur le Nouveau Testament."
                    }
                ],
                "balance_recommendations": [
                    {
                        "title": "Comprendre l'Ancien Testament",
                        "author": "Tremper Longman III, Raymond B. Dillard",
                        "publisher": "Excelsis",
                        "target_gap": "Ancien Testament global",
                        "rationale": "L'ouvrage idéal pour poser les bases historiques et théologiques indispensables de la première alliance."
                    },
                    {
                        "title": "À l'écoute de l'Écriture : Manuel d'herméneutique",
                        "author": "Gordon D. Fee, Douglas Stuart",
                        "publisher": "Éditions Vida",
                        "target_gap": "Herméneutique & Méthode exégétique",
                        "rationale": "Permet d'aborder chaque genre littéraire de la Bible avec les bonnes règles d'interprétation."
                    }
                ],
                "from_cache": False
            }
            cls._save_cache(fallback_advice)
            cls._MEMORY_CACHE = fallback_advice
            return fallback_advice

        # 4. Préparation du prompt pour le LLM
        books_meta = load_books_metadata()
        sample_books = []
        for name, meta in list(books_meta.items())[:45]:
            title = meta.get("title") or name
            author = meta.get("author") or "Auteur non spécifié"
            t = meta.get("type") or "Livre"
            sample_books.append(f"- « {title} » par {author} ({t})")

        books_summary_text = "\n".join(sample_books)
        top_auth_text = ", ".join([f"{a['author']} ({a['count']} livre(s))" for a in profile["frequent_authors"][:5]]) or "Aucun auteur dominant"
        gaps_text = "\n".join([f"- {g['label']} : {g['explanation']}" for g in profile["detected_gaps"]]) or "- Aucun déséquilibre critique majeur détecté"

        user_query = f"""Voici le bilan statistique de la bibliothèque de l'utilisateur :
- Nombre total d'ouvrages actifs : {profile['total_books']}
- Répartition : {profile['ot_percentage']}% Ancien Testament vs {profile['nt_percentage']}% Nouveau Testament
- Auteurs récurrents : {top_auth_text}
- Angles morts statistiques identifiés :
{gaps_text}

Échantillon des ouvrages possédés :
{books_summary_text}

Analyse cette collection et formule tes recommandations en respectant scrupuleusement le format JSON défini."""

        system_prompt = config.get("prompt_library_advisor") or DEFAULT_LIBRARY_ADVISOR_SYSTEM_PROMPT
        primary_model = config.get("library_advisor_model", "gemini-3.7-flash")
        fallback_model = config.get("library_advisor_fallback_model", "gemini-3.5-flash-lite")

        # 5. Appel LLM avec Fallback automatique
        response_json = cls._invoke_llm_with_fallback(
            prompt=user_query,
            system_prompt=system_prompt,
            primary_model=primary_model,
            fallback_model=fallback_model,
            config=config
        )

        if response_json:
            result = {
                "fingerprint": profile["fingerprint"],
                "profile": profile,
                "diagnostic": response_json.get("diagnostic", ""),
                "strengths_summary": response_json.get("strengths_summary", ""),
                "gaps_summary": response_json.get("gaps_summary", ""),
                "deepening_recommendations": response_json.get("deepening_recommendations", []),
                "balance_recommendations": response_json.get("balance_recommendations", []),
                "from_cache": False
            }
            cls._save_cache(result)
            cls._MEMORY_CACHE = result
            return result

        # Fallback local structuré si le LLM n'a pas répondu
        fallback_res = cls._generate_heuristic_fallback(profile)
        fallback_res["profile"] = profile
        fallback_res["from_cache"] = False
        cls._save_cache(fallback_res)
        cls._MEMORY_CACHE = fallback_res
        return fallback_res

    @classmethod
    def _invoke_llm_with_fallback(cls, prompt: str, system_prompt: str, primary_model: str, fallback_model: str, config: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Tente d'appeler le modèle primaire puis le modèle fallback."""
        models_to_try = [primary_model]
        if fallback_model and fallback_model != primary_model:
            models_to_try.append(fallback_model)

        for mod in models_to_try:
            try:
                provider = resolve_llm_provider(mod)
                api_key = cls._get_api_key_for_provider(provider, config)
                if not api_key:
                    logger.warning(f"[LibraryAdvisor] Clé API manquante pour le provider {provider}")
                    continue

                client = LLMClient(
                    api_key=api_key,
                    model=mod,
                    provider=provider,
                    product_id=config.get("infomaniak_product_id")
                )

                raw_output = client.ask_question(
                    context="",
                    question=prompt,
                    system_prompt=system_prompt
                )

                if raw_output and not str(raw_output).startswith("Erreur"):
                    # Nettoyage JSON
                    cleaned = re.sub(r'^```(?:json)?\s*', '', raw_output.strip(), flags=re.IGNORECASE)
                    cleaned = re.sub(r'\s*```$', '', cleaned)
                    data = json.loads(cleaned)
                    if isinstance(data, dict) and "diagnostic" in data:
                        return data

            except Exception as e:
                logger.warning(f"[LibraryAdvisor] Échec avec le modèle {mod} : {e}")

        return None

    @classmethod
    def _get_api_key_for_provider(cls, provider: str, config: Dict[str, Any]) -> Optional[str]:
        if provider == "gemini":
            return config.get("gemini_api_key")
        elif provider == "mistral":
            return config.get("mistral_api_key")
        elif provider == "infomaniak":
            return config.get("infomaniak_token")
        return None

    @classmethod
    def _generate_heuristic_fallback(cls, profile: Dict[str, Any]) -> Dict[str, Any]:
        """Génère une recommandation heuristique locale en cas d'indisponibilité réseau."""
        deepening = []
        if profile.get("frequent_authors"):
            top_a = profile["frequent_authors"][0]["author"]
            deepening.append({
                "title": "Études bibliques et théologiques",
                "author": top_a,
                "publisher": "Édition de référence",
                "rationale": f"Pour prolonger votre étude approfondie des écrits et perspectives de {top_a}."
            })
        else:
            deepening.append({
                "title": "Théologie du Nouveau Testament",
                "author": "George Eldon Ladd",
                "publisher": "Éditions Clé",
                "rationale": "Un grand classique pour approfondir la dimension eschatologique et christologique des Écritures."
            })

        deepening.append({
            "title": "Introduction à l'éthique chrétienne",
            "author": "John Jefferson Davis",
            "publisher": "Publications Chrétiennes",
            "rationale": "Un cadre méthodologique indispensable pour relier exégèse textuelle et discernement moral contemporain."
        })

        balance = []
        for gap in profile.get("detected_gaps", [])[:2]:
            if "wisdom" in gap["id"]:
                balance.append({
                    "title": "Psaumes : Commentaire poétique et théologique",
                    "author": "Derek Kidner",
                    "publisher": "Excelsis",
                    "target_gap": gap["label"],
                    "rationale": "Une étude lumineuse des Psaumes alliant sensibilité littéraire et profondeur spirituelle."
                })
            elif "ot_global" in gap["id"] or "prophets" in gap["id"]:
                balance.append({
                    "title": "Les prophètes d'Israël",
                    "author": "Leon J. Wood",
                    "publisher": "Éditions Clé",
                    "target_gap": gap["label"],
                    "rationale": "Pour combler le manque de commentaires sur la voix prophétique et l'histoire pré-exilique."
                })
            elif "hermeneutics" in gap["id"]:
                balance.append({
                    "title": "À l'écoute de l'Écriture",
                    "author": "Gordon Fee et Douglas Stuart",
                    "publisher": "Éditions Vida",
                    "target_gap": gap["label"],
                    "rationale": "Le guide de référence pour éviter les écueils d'interprétation et maîtriser chaque genre biblique."
                })

        if not balance:
            balance.append({
                "title": "Théologie systématique",
                "author": "Wayne Grudem",
                "publisher": "Excelsis",
                "target_gap": "Dogmatique & Synthèse",
                "rationale": "Permet de structurer l'ensemble des doctrines bibliques dans une vision d'ensemble ordonnée."
            })

        return {
            "fingerprint": profile.get("fingerprint", ""),
            "diagnostic": f"Votre bibliothèque compte {profile['total_books']} ressource(s) avec une attention marquée pour le Nouveau Testament. Un élargissement vers l'Ancien Testament et les manuels de méthode enrichira votre démarche.",
            "strengths_summary": "Bonne assise sur les textes néotestamentaires et les grands corpus pastoraux.",
            "gaps_summary": "Quelques axes méritent d'être complétés (poésie de l'AT, herméneutique générale).",
            "deepening_recommendations": deepening,
            "balance_recommendations": balance
        }

    @classmethod
    def _save_cache(cls, data: Dict[str, Any]):
        try:
            cache_path = cls.get_cache_path()
            with open(cache_path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.debug(f"[LibraryAdvisor] Erreur écriture cache : {e}")
