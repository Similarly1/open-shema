import os
import json
import logging

logger = logging.getLogger(__name__)

CONFIG_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "config.json")

DEFAULT_SYNTHESIS_SYSTEM_PROMPT = """Vous êtes un éminent professeur de théologie et un exégète biblique chevronné.
Votre mission est de rédiger une SYNTHÈSE EXÉGÉTIQUE COMPARATIVE d'excellence à partir des extraits de commentaires fournis.

RÈGLES CRITIQUES DE RÉDACTION :
1. LANGUE : Rédigez TOUJOURS l'intégralité de la synthèse en FRANÇAIS impeccable, fluide et naturel, même si les commentaires ou sources fournis sont rédigés en anglais, en allemand ou dans une autre langue.
2. FIDÉLITÉ : Basez votre analyse rigoureusement sur les commentaires fournis. Ne spéculez pas et n'inventez aucun contenu.
3. CITATIONS : Citez nommément et explicitement les auteurs ou ouvrages entre crochets gras (ex: **[John MacArthur]**, **[Matthew Henry]**, **[J.N. Darby]**, **[Bible Annotée]**, **[Jean Calvin]**) pour chaque affirmation basée sur leurs écrits.
4. STRUCTURE IMPÉRATIVE (Markdown) :
   - ## 📌 1. Consensus Exégétique & Thèmes Communs (Ce sur quoi tous les auteurs s'accordent, doctrine principale, sens direct du texte)
   - ## 🔍 2. Nuances, Divergences & Traditions Théologiques (Comparaison des points de vue, différences d'accentuation : typologique, dispensationaliste, réformée, historique, analyse des mots originaux hébreux/grecs)
   - ## 💡 3. Clés Textuelles & Applications Pastorales (Enseignements théologiques majeurs, implications pratiques et spirituelles pour la foi)
   - ## 📚 4. Synthèse des Sources Étudiées (Bref résumé récapitulatif des apports uniques de chaque commentateur cité)"""

DEFAULT_TRANSLATION_SYSTEM_PROMPT = """Vous êtes un traducteur exégétique et théologique de haute précision.
Votre mission est de traduire fidèlement, intégralement et précisément le texte biblique, commentaire ou notice de dictionnaire fourni vers le français.

RÈGLES STRICTES :
1. FIDÉLITÉ ABSOLUE : Traduisez l'intégralité du texte sans rien omettre, sans résumer, et sans inventer ni ajouter d'informations non présentes dans le texte original.
2. TERMINOLOGIE THÉOLOGIQUE : Respectez la terminologie biblique et théologique francophone établie.
3. FORMAT : Conservez la mise en forme originale (paragraphes, puces, références bibliques, codes Strong, termes hébreux/grecs).
4. NE JAMAIS dialoguer ni ajouter de préambule : Renvoyez UNIQUEMENT le texte traduit en français."""

DEFAULTS = {
    "mistral_api_key": "",
    "gemini_api_key": "",
    "infomaniak_token": "",
    "infomaniak_product_id": "251",
    "embedding_provider": "local",
    "chat_model": "gemini-3.7-flash",
    "theme": "dark",
    "theme_palette": "dark-slate",
    "reading_bg": "auto",
    "font_family": "Georgia",
    "font_size": 18,
    "line_spacing": 6,
    "word_spacing": 3,
    "show_reverse_interlinear": False,
    "interlinear_show_surface": True,
    "interlinear_show_lemma": True,
    "interlinear_show_translit": True,
    "interlinear_show_strong": True,
    "google_books_api_key": "",
    "metadata_classifier_model": "gemini-2.5-flash-lite",
    "dict_polish_model": "mistralai/Mistral-Small-4-119B-2603",
    "translation_model": "gemini-3.5-flash-lite",
    "translation_system_prompt": DEFAULT_TRANSLATION_SYSTEM_PROMPT,
    "max_original_verses_for_llm": 10,
    "show_section_titles": True,
    "show_chapter_dividers": True,
    "full_width_reading": False,
    "notes_directory": "",
    "include_notes_in_ai": True,
    "synthesis_model": "gemini-3.7-flash",
    "synthesis_max_verses": 5,
    "synthesis_enable_reranking": True,
    "synthesis_curation_model": "gemini-2.5-flash-lite",
    "synthesis_system_prompt": DEFAULT_SYNTHESIS_SYSTEM_PROMPT,
}

def load_config():
    if not os.path.exists(CONFIG_PATH):
        return dict(DEFAULTS)

    try:
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            config = json.load(f)
    except (json.JSONDecodeError, OSError) as e:
        logger.warning(
            "config.json illisible (%s). Utilisation des valeurs par défaut.", e
        )
        return dict(DEFAULTS)

    # Compléter les clés manquantes avec les valeurs par défaut
    for key, default_val in DEFAULTS.items():
        if key not in config:
            config[key] = default_val

    return config

def save_config(config_dict):
    os.makedirs(os.path.dirname(CONFIG_PATH), exist_ok=True)
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(config_dict, f, indent=4)
