import os
import json

CONFIG_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "config.json")

def load_config():
    if not os.path.exists(CONFIG_PATH):
        return {
            "mistral_api_key": "",
            "gemini_api_key": "",
            "infomaniak_token": "",
            "infomaniak_product_id": "251",
            "embedding_provider": "local",
            "chat_model": "gemini-3.7-flash",
            "theme": "dark",
            "font_family": "Georgia",
            "font_size": 18
        }
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        config = json.load(f)
        if "line_spacing" not in config:
            config["line_spacing"] = 6
        if "word_spacing" not in config:
            config["word_spacing"] = 3
        if "show_reverse_interlinear" not in config:
            config["show_reverse_interlinear"] = False
        if "interlinear_show_surface" not in config:
            config["interlinear_show_surface"] = True
        if "interlinear_show_lemma" not in config:
            config["interlinear_show_lemma"] = True
        if "interlinear_show_translit" not in config:
            config["interlinear_show_translit"] = True
        if "interlinear_show_strong" not in config:
            config["interlinear_show_strong"] = True
        return config

def save_config(config_dict):
    os.makedirs(os.path.dirname(CONFIG_PATH), exist_ok=True)
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(config_dict, f, indent=4)
