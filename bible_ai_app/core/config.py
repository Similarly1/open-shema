import os
import json
import logging

logger = logging.getLogger(__name__)

CONFIG_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "config.json")

DEFAULTS = {
    "mistral_api_key": "",
    "gemini_api_key": "",
    "infomaniak_token": "",
    "infomaniak_product_id": "251",
    "embedding_provider": "local",
    "chat_model": "gemini-3.7-flash",
    "theme": "dark",
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
    "max_original_verses_for_llm": 10,
    "show_section_titles": True,
    "notes_directory": "",
    "include_notes_in_ai": True,
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
