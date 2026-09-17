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
    def compute_library_fingerprint(cls, books: List[Dict[str, Any]], extra_state: Optional[Dict[str, Any]] = None) -> str:
        """Calcule une empreinte de la bibliothèque et de l'environnement pour invalider le cache."""
        summary = []
        for b in sorted(books, key=lambda x: str(x.get("name", ""))):
            summary.append(f"{b.get('name')}|{b.get('title')}|{b.get('author')}|{b.get('type')}|{b.get('active', True)}")
        raw = "##".join(summary)
        if extra_state:
            raw += f"##BLOGS|{extra_state.get('blog_sources')}|{extra_state.get('blog_count')}##PROFILE|{extra_state.get('role')}|{extra_state.get('tradition')}|{extra_state.get('comm_count')}"
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

        # 5. Profil théologique personnel (Passeport Herméneutique)
        user_profile_data = {}
        try:
            from core.ai_session_manager import AISessionManager
            user_profile_data = AISessionManager.get_user_profile() or {}
        except Exception as e:
            logger.debug(f"[LibraryAdvisor] Erreur lecture profil théologique: {e}")

        user_role = user_profile_data.get("user_role") or "etude_perso"
        role_labels = {
            "pasteur": "Pasteur / Berger d'église",
            "enseignant": "Enseignant / Prédicateur",
            "etudiant": "Étudiant en théologie",
            "ancien": "Ancien / Responsable d'église",
            "etude_perso": "Étude biblique personnelle approfondie & Dévotion",
            "curieux": "Chrétien engagé / Lecteur curieux"
        }
        user_role_label = role_labels.get(user_role, user_role)
        theological_tradition = user_profile_data.get("tradition") or "Évangélique"
        greek_hebrew_level = user_profile_data.get("greek_hebrew_level") or "debutant"
        country_culture = user_profile_data.get("country_culture") or "Suisse romande / France"
        church_confession_raw = (user_profile_data.get("church_confession_raw") or "").strip()

        theological_profile = {
            "user_role": user_role,
            "user_role_label": user_role_label,
            "tradition": theological_tradition,
            "greek_hebrew_level": greek_hebrew_level,
            "country_culture": country_culture,
            "has_confession": bool(church_confession_raw)
        }

        # 6. Bibles installées
        installed_bibles = []
        for b in books_list:
            if (b.get("type") or "").strip().lower() == "bible":
                t_name = b.get("title") or b.get("name")
                if t_name and t_name not in installed_bibles:
                    installed_bibles.append(t_name)

        # 7. Commentaires bibliques installés dans Open Shema
        installed_commentaries = []
        try:
            from core.commentary_loader import CommentaryLoader
            comm_catalog = CommentaryLoader.get_available_commentaries() or {}
            for c_id, c_data in comm_catalog.items():
                name = c_data.get("title") or c_data.get("name") or c_id
                if name and name not in installed_commentaries:
                    installed_commentaries.append(name)
        except Exception as e:
            logger.debug(f"[LibraryAdvisor] Erreur lecture commentaires: {e}")

        # 8. Statut des abonnements aux flux de blogs chrétiens (TPSG + E21) et articles stockés
        blog_status = {
            "total_sources": 2,
            "enabled_sources_count": 0,
            "enabled_sources": [],
            "disabled_sources": [],
            "total_articles": 0,
            "top_tags": [],
            "recent_articles_sample": []
        }
        try:
            from core.articles_db import ArticlesDB
            art_db = ArticlesDB()
            sources = art_db.get_sources(enabled_only=False) or []
            blog_status["total_sources"] = len(sources)
            for s in sources:
                s_name = s.get("name", s.get("id"))
                s_count = s.get("article_count", 0)
                if s.get("is_enabled", 1) == 1:
                    blog_status["enabled_sources_count"] += 1
                    blog_status["enabled_sources"].append(f"{s_name} ({s_count} articles)")
                else:
                    blog_status["disabled_sources"].append(s_name)
                blog_status["total_articles"] += s_count

            if blog_status["total_articles"] > 0:
                recent_arts = art_db.get_articles(limit=15) or []
                tag_freq = {}
                for a in recent_arts:
                    for t in a.get("tags_list", []):
                        t_clean = t.strip()
                        if len(t_clean) >= 3 and not t_clean.startswith("channel."):
                            tag_freq[t_clean] = tag_freq.get(t_clean, 0) + 1
                sorted_tags = sorted(tag_freq.items(), key=lambda x: x[1], reverse=True)[:8]
                blog_status["top_tags"] = [t[0] for t in sorted_tags]
                blog_status["recent_articles_sample"] = [a.get("title") for a in recent_arts[:4] if a.get("title")]
        except Exception as e:
            logger.debug(f"[LibraryAdvisor] Erreur lecture articles: {e}")

        # 9. Calcul du fingerprint étendu pour invalidation automatique du cache
        extra_fingerprint_state = {
            "blog_sources": "_".join(sorted(blog_status["enabled_sources"])),
            "blog_count": blog_status["total_articles"],
            "role": user_role,
            "tradition": theological_tradition,
            "comm_count": len(installed_commentaries)
        }
        fingerprint = cls.compute_library_fingerprint(books_list, extra_fingerprint_state)

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
            "theological_profile": theological_profile,
            "installed_bibles": installed_bibles,
            "installed_commentaries": installed_commentaries,
            "blog_status": blog_status,
            "fingerprint": fingerprint
        }

    @classmethod
    def _normalize_recommendation(cls, rec: Dict[str, Any], is_balance: bool = False) -> Dict[str, Any]:
        """Normalise une recommandation d'axe d'étude et garantit les champs de recherche requis."""
        axis_title = rec.get("axis_title") or rec.get("title") or "Axe d'étude biblique"
        authors = rec.get("benchmark_authors") or []
        if not authors and rec.get("author"):
            authors = [rec.get("author")]

        keywords = rec.get("search_keywords") or []
        if not keywords:
            kw = []
            for a in authors[:2]:
                last = a.split()[-1] if a else ""
                if len(last) >= 3:
                    kw.append(last)
            words = [w for w in re.findall(r'\b[A-Za-zÀ-ÿ]{4,}\b', axis_title) if w.lower() not in ["pour", "dans", "avec", "votre", "étude", "livre", "axes", "lectures"]]
            kw.extend(words[:3])
            keywords = list(dict.fromkeys(kw))[:4]

        norm = {
            "axis_title": axis_title,
            "rationale": rec.get("rationale") or "",
            "benchmark_authors": authors,
            "search_keywords": keywords
        }
        if is_balance:
            norm["target_gap"] = rec.get("target_gap") or "Équilibrage"
        return norm

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
                # Assurer la normalisation même si issu d'un ancien cache
                res["deepening_recommendations"] = [cls._normalize_recommendation(r, False) for r in res.get("deepening_recommendations", [])]
                res["balance_recommendations"] = [cls._normalize_recommendation(r, True) for r in res.get("balance_recommendations", [])]
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
                    cached_data["deepening_recommendations"] = [cls._normalize_recommendation(r, False) for r in cached_data.get("deepening_recommendations", [])]
                    cached_data["balance_recommendations"] = [cls._normalize_recommendation(r, True) for r in cached_data.get("balance_recommendations", [])]
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
                        "axis_title": "Initiation à l'exégèse et à la prédication biblique",
                        "rationale": "Un axe fondamental pour apprendre à structurer l'étude du texte et sa proclamation.",
                        "benchmark_authors": ["Haddon W. Robinson", "David Helm", "John Stott"],
                        "search_keywords": ["Prédication", "Homilétique", "Exégèse", "Stott"]
                    },
                    {
                        "axis_title": "Survol et théologie du Nouveau Testament",
                        "rationale": "Une assise indispensable pour comprendre le contexte et la portée théologique des Évangiles et des Épîtres.",
                        "benchmark_authors": ["D.A. Carson", "Douglas J. Moo", "F.F. Bruce"],
                        "search_keywords": ["Nouveau Testament", "Évangiles", "Carson", "Moo"]
                    }
                ],
                "balance_recommendations": [
                    {
                        "axis_title": "Bases historiques et théologiques de l'Ancien Testament",
                        "target_gap": "Ancien Testament global",
                        "rationale": "L'axe idéal pour poser les repères narratifs, d'alliance et d'histoire de la première alliance.",
                        "benchmark_authors": ["Tremper Longman", "Raymond Dillard", "Henri Blocher"],
                        "search_keywords": ["Ancien Testament", "Pentateuque", "Longman", "Blocher"]
                    },
                    {
                        "axis_title": "Herméneutique générale et règles d'interprétation",
                        "target_gap": "Herméneutique & Méthode",
                        "rationale": "Permet d'aborder chaque genre littéraire (poésie, prophétie, épîtres) avec les bonnes clés de lecture.",
                        "benchmark_authors": ["Gordon D. Fee", "Douglas Stuart", "Alfred Kuen"],
                        "search_keywords": ["Herméneutique", "Interprétation", "Gordon Fee"]
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

        # Données de contexte enrichies
        prof_info = profile.get("theological_profile", {})
        user_role_str = prof_info.get("user_role_label", "Étude personnelle")
        tradition_str = prof_info.get("tradition", "Évangélique")
        greek_heb_str = prof_info.get("greek_hebrew_level", "débutant")
        culture_str = prof_info.get("country_culture", "Suisse romande / France")

        bibles_str = ", ".join(profile.get("installed_bibles", [])[:10]) or "Bibles par défaut"
        comm_list = profile.get("installed_commentaries", [])
        comm_str = ", ".join(comm_list[:12]) or "Commentaires par défaut"
        comm_count = len(comm_list)

        b_status = profile.get("blog_status", {})
        enabled_blogs_count = b_status.get("enabled_sources_count", 0)
        enabled_blogs_str = ", ".join(b_status.get("enabled_sources", [])) or "Aucun flux actif"
        disabled_blogs_str = ", ".join(b_status.get("disabled_sources", [])) or "Aucun"
        total_arts = b_status.get("total_articles", 0)
        tags_str = ", ".join(b_status.get("top_tags", [])) or "Général"
        recent_arts_list = b_status.get("recent_articles_sample", [])
        recent_arts_str = "\n".join([f"  * {t}" for t in recent_arts_list]) if recent_arts_list else "  * Aucun article récent"

        user_query = f"""Voici le bilan complet du profil d'étude, des ressources et de la bibliothèque de la personne à qui tu t'adresses directement :

1. PROFIL DE VOTRE INTERLOCUTEUR & CADRE MINISTÉRIEL :
- Rôle / Cadre d'étude : {user_role_str}
- Tradition théologique : {tradition_str}
- Niveau en langues bibliques (grec / hébreu) : {greek_heb_str}
- Contexte géographique et culturel : {culture_str}

2. OUTILS & RESSOURCES DÉJÀ DISPONIBLES DANS SON APPLICATION (NE PAS RECOMMANDER EN DOUBLON) :
- Bibles installées ({len(profile.get('installed_bibles', []))}) : {bibles_str}
- Commentaires bibliques et dictionnaires intégrés ({comm_count} modules déjà disponibles) :
  {comm_str}
  (Note : La personne dispose déjà de ces commentaires classiques et notes dans son application. Ne lui propose pas ces classiques-là, mais des commentaires exégétiques contemporains ou des monographies théologiques spécialisées !)

3. FLUX D'ARTICLES DE BLOGS CHRÉTIENS ÉVANGÉLIQUES (TOUT POUR SA GLOIRE & ÉVANGILE 21) :
- Abonnements actifs : {enabled_blogs_count} sur 2 flux ({enabled_blogs_str})
- Flux inactifs : {disabled_blogs_str}
- Nombre total d'articles stockés en base locale : {total_arts} articles
- Thématiques majeures couvertes par les articles : {tags_str}
- Exemples d'articles récents :
{recent_arts_str}
(Règle d'impact : Si la personne est abonnée aux 2 flux, elle reçoit déjà en continu des réflexions pastorales courtes et de la vie pratique ; oriente alors tes recommandations vers des monographies de fond, de la théologie systématique et de l'exégèse universitaire. Si 0 ou 1 flux est actif, compense les éventuels manques pratiques ou éthiques.)

4. BILAN DE SA BIBLIOTHÈQUE LOCALE D'OUVRAGES & E-BOOKS :
- Nombre total d'ouvrages actifs : {profile['total_books']}
- Répartition canonique : {profile['ot_percentage']}% Ancien Testament vs {profile['nt_percentage']}% Nouveau Testament
- Auteurs récurrents : {top_auth_text}
- Angles morts statistiques identifiés :
{gaps_text}

Échantillon des ouvrages possédés :
{books_summary_text}

CONSIGNE CRUCIALE DE TON ET DE POSTURE :
Adresse-toi DIRECTEMENT à la personne en la vouvoyant chaleureusement (« Vous », « Vos lectures », « Votre bibliothèque »). Bannis absolument toute formulation à la 3e personne (« l'utilisateur », « le lecteur », « sa foi »). Formule le diagnostic et tes conseils avec bienveillance, fraternité et profondeur en respectant scrupuleusement le schéma JSON défini (sans aucun émoji)."""

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
            deepening = [cls._normalize_recommendation(r, False) for r in response_json.get("deepening_recommendations", [])]
            balance = [cls._normalize_recommendation(r, True) for r in response_json.get("balance_recommendations", [])]
            result = {
                "fingerprint": profile["fingerprint"],
                "profile": profile,
                "diagnostic": response_json.get("diagnostic", ""),
                "strengths_summary": response_json.get("strengths_summary", ""),
                "gaps_summary": response_json.get("gaps_summary", ""),
                "deepening_recommendations": deepening,
                "balance_recommendations": balance,
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
                "axis_title": f"Approfondissement : perspectives et thématiques de {top_a}",
                "rationale": f"Pour prolonger votre étude des écrits, méthodes et perspectives théologiques de {top_a}.",
                "benchmark_authors": [top_a, "D.A. Carson", "John Stott"],
                "search_keywords": [top_a.split()[-1], "Commentaire", "Exégèse", "Théologie"]
            })
        else:
            deepening.append({
                "axis_title": "Théologie biblique et christologie du Nouveau Testament",
                "rationale": "Un grand classique pour approfondir la dimension eschatologique et l'accomplissement des Écritures.",
                "benchmark_authors": ["George Eldon Ladd", "D.A. Carson", "Geerhardus Vos"],
                "search_keywords": ["Théologie biblique", "Nouveau Testament", "Ladd", "Carson"]
            })

        deepening.append({
            "axis_title": "Éthique chrétienne appliquée & Théologie pastorale",
            "rationale": "Un cadre méthodologique indispensable pour relier exégèse textuelle et discernement moral contemporain.",
            "benchmark_authors": ["John Stott", "Wayne Grudem", "Henri Blocher"],
            "search_keywords": ["Éthique", "Pastorale", "Discipulat", "Stott"]
        })

        balance = []
        for gap in profile.get("detected_gaps", [])[:2]:
            if "wisdom" in gap["id"]:
                balance.append({
                    "axis_title": "Poésie hébraïque et sagesse de l'Ancien Testament (Psaumes, Job, Proverbes)",
                    "target_gap": gap["label"],
                    "rationale": "Combler le manque d'ouvrages sapientiaux pour allier sensibilité poétique et profondeur spirituelle.",
                    "benchmark_authors": ["Derek Kidner", "Tremper Longman", "Henri Blocher"],
                    "search_keywords": ["Psaumes", "Sagesse", "Proverbes", "Kidner"]
                })
            elif "ot_global" in gap["id"] or "prophets" in gap["id"]:
                balance.append({
                    "axis_title": "La voix des prophètes d'Israël et l'histoire pré-exilique",
                    "target_gap": gap["label"],
                    "rationale": "Pour combler le manque de ressources sur la voix prophétique et l'alliance de l'Ancien Testament.",
                    "benchmark_authors": ["Leon Wood", "Henri Blocher", "Alfred Kuen"],
                    "search_keywords": ["Prophètes", "Ésaïe", "Jérémie", "Exil"]
                })
            elif "hermeneutics" in gap["id"]:
                balance.append({
                    "axis_title": "Herméneutique textuelle et règles d'interprétation",
                    "target_gap": gap["label"],
                    "rationale": "Le fondement méthodologique pour éviter les écueils d'interprétation et maîtriser chaque genre biblique.",
                    "benchmark_authors": ["Gordon Fee", "Douglas Stuart", "D.A. Carson"],
                    "search_keywords": ["Herméneutique", "Exégèse", "Gordon Fee", "Carson"]
                })

        if not balance:
            balance.append({
                "axis_title": "Théologie systématique et synthèse doctrinale",
                "target_gap": "Dogmatique & Synthèse",
                "rationale": "Permet de structurer l'ensemble des doctrines bibliques dans une vision d'ensemble ordonnée.",
                "benchmark_authors": ["Wayne Grudem", "Louis Berkhof", "Henri Blocher"],
                "search_keywords": ["Systématique", "Dogmatique", "Doctrine", "Grudem"]
            })

        return {
            "fingerprint": profile.get("fingerprint", ""),
            "diagnostic": f"Vous disposez d'une belle collection de {profile['total_books']} ressource(s), portée par un attachement vivant au Nouveau Testament. Pour enrichir encore votre étude et nourrir votre démarche, explorer la poésie de l'Ancien Testament et approfondir la méthode exégétique constitueront de stimulants compléments.",
            "strengths_summary": "Un ancrage solide dans les textes apostoliques, la pensée réformée et les repères pastoraux.",
            "gaps_summary": "Une belle opportunité d'ouvrir vos lectures aux trésors sapientiaux de l'Ancien Testament et aux repères d'herméneutique contemporaine.",
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
