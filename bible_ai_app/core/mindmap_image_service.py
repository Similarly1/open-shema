"""
bible_ai_app/core/mindmap_image_service.py — Générateur et gestionnaire d'illustrations IA pour les Mind Maps.

Fonctionnalités :
1. Synthèse de prompt artistique contextuel en anglais via LLM (Ministral / Gemini Flash / Mistral).
2. Génération d'image ultra-rapide par Infomaniak Flux (Flux Schnell de Black Forest Labs).
3. Sauvegarde locale du JPEG dans le dossier utilisateur OpenShema/data/mindmap_images/ et conversion en Data URL.
4. Support extensible pour d'autres fournisseurs (Mistral agent image generation, etc.).
"""

import os
import re
import json
import base64
import logging
import uuid
import requests
from typing import Dict, Any, Optional, Tuple

from core.paths import get_user_data_dir, get_user_data_path
from core.config import load_config
from core.secrets_manager import get_secret
from ai.llm_client import LLMClient

logger = logging.getLogger("mindmap_image_service")

# Styles prédéfinis pour orienter le générateur d'images
STYLE_PRESETS = {
    "biblical_oil": {
        "label": "Peinture d'Histoire & Maîtres Classiques",
        "prompt_suffix": "classical fine art oil painting, dramatic chiaroscuro lighting, deep rich earthy colors, Renaissance and Baroque biblical art aesthetic, highly detailed canvas texture, Rembrandt and Caravaggio atmosphere, cinematic framing, masterpiece, no text, no letters, no watermark"
    },
    "cinematic": {
        "label": "Cinématique Biblique Dramatique",
        "prompt_suffix": "dramatic cinematic historical movie scene, 35mm film photography, volumetric rays of divine light, golden hour, epic historical biblical environment, atmospheric dust, photorealistic details, high dynamic range, no text, no typography"
    },
    "golden_engraving": {
        "label": "Gravure Ancienne & Dorures Dorées",
        "prompt_suffix": "antique detailed copperplate etching, vintage botanical and biblical engraving style, delicate hatched line art with subtle warm gold accents, parchment paper background, refined historical illustration, no text"
    },
    "watercolor": {
        "label": "Aquarelle & Lumière Douce",
        "prompt_suffix": "ethereal watercolor and gouache artwork, soft washes of warm sunlight, luminous sacred atmosphere, delicate brushwork, organic paper texture, poetic fine art, no text"
    },
    "minimal_modern": {
        "label": "Symbole Moderne Épuré",
        "prompt_suffix": "clean modern conceptual editorial illustration, minimalist composition, elegant geometric harmony, soft diffused lighting, sophisticated color palette, premium book cover aesthetics, no text"
    }
}

PROMPT_CRAFT_SYSTEM_INSTRUCTION = """You are an elite art director and prompt engineer specializing in historical, biblical, and conceptual art for mind maps.
Your job is to generate a concise, highly evocative English text prompt for a text-to-image AI model (Flux Schnell).

RULES:
1. Output ONLY the English prompt, without any explanations, conversational filler, markdown formatting, or quotes.
2. Focus on a clear central subject, mood, composition, materials, and lighting appropriate to the theme.
3. STRICT NEGATIVE CONSTRAINT: Absolutely NEVER include words like "diagram", "chart", "infographic", "text", "letters", "label", "writing", "alphabet", "symbols". The image must be purely pictorial and artistic.
4. Keep the final prompt between 25 and 55 words long. It should describe a concrete visual scene representing the concept."""


def ensure_mindmap_images_dir() -> str:
    """S'assure que le dossier utilisateur mindmap_images existe et retourne son chemin absolu."""
    target_dir = get_user_data_path("mindmap_images")
    os.makedirs(target_dir, exist_ok=True)
    return target_dir


def suggest_image_prompt(
    node_text: str,
    mindmap_title: str = "",
    parent_context: str = "",
    scripture_ref: str = "",
    style_key: str = "biblical_oil",
    config: Optional[Dict[str, Any]] = None
) -> str:
    """
    Rédige un prompt visuel en anglais via le LLM configuré (Infomaniak Ministral, Gemini Flash ou Mistral).
    """
    if not config:
        config = load_config()

    clean_text = (node_text or "").strip()
    style_def = STYLE_PRESETS.get(style_key, STYLE_PRESETS["biblical_oil"])
    style_suffix = style_def["prompt_suffix"]

    user_msg = (
        f"Create an evocative artistic image prompt for the concept: '{clean_text}'.\n"
        f"Theme / Main Topic: '{mindmap_title or 'Biblical Study'}'\n"
    )
    if parent_context:
        user_msg += f"Parent Context: '{parent_context}'\n"
    if scripture_ref:
        user_msg += f"Biblical Scripture Reference: '{scripture_ref}'\n"

    user_msg += (
        f"Artistic Style: {style_def['label']}.\n"
        "Generate a single evocative visual scene prompt in English for Flux AI."
    )

    # Ordre des modèles à essayer pour la rédaction du prompt
    models_to_try = [
        config.get("curator_model") or "mistralai/Ministral-3-14B-Instruct-2512",
        "mistralai/Ministral-3-14B-Instruct-2512",
        "gemini-2.5-flash",
        "gemini-2.0-flash",
        "mistral-small-latest"
    ]

    generated_prompt = ""
    for cur_model in models_to_try:
        cur_provider = "infomaniak" if ("infomaniak" in cur_model.lower() or "ministral" in cur_model.lower() or "qwen" in cur_model.lower()) else ("mistral" if "mistral" in cur_model.lower() else "gemini")
        cur_api_key = (
            get_secret("infomaniak_token", config) if cur_provider == "infomaniak"
            else (get_secret("mistral_api_key", config) if cur_provider == "mistral"
                  else get_secret("gemini_api_key", config))
        )

        if not cur_api_key:
            continue

        try:
            client = LLMClient(
                api_key=cur_api_key,
                model=cur_model,
                provider=cur_provider,
                product_id=get_secret("infomaniak_product_id", config) or config.get("infomaniak_product_id", "251")
            )
            messages = [{"role": "user", "content": user_msg}]

            if cur_provider == "gemini":
                res = client.client.chat(messages, system_prompt=PROMPT_CRAFT_SYSTEM_INSTRUCTION, fallback=True)
            elif cur_provider == "mistral":
                try:
                    from mistralai.models.chat_completion import ChatMessage
                    resp = client.client.chat(model=cur_model, messages=[
                        ChatMessage(role="system", content=PROMPT_CRAFT_SYSTEM_INSTRUCTION),
                        ChatMessage(role="user", content=user_msg)
                    ])
                    res = resp.choices[0].message.content
                except Exception:
                    res = None
            elif cur_provider == "infomaniak":
                res = client.client.chat(messages, system_prompt=PROMPT_CRAFT_SYSTEM_INSTRUCTION, model=cur_model)
            else:
                res = None

            if res and isinstance(res, str) and not res.startswith("Erreur"):
                clean_res = res.strip().strip('"').strip("'").strip("`")
                # Supprimer les éventuels préfixes "Prompt:" ou "Image prompt:"
                clean_res = re.sub(r'^(?:prompt|image\s+prompt)\s*:\s*', '', clean_res, flags=re.I)
                generated_prompt = clean_res
                break
        except Exception as e:
            logger.warning("Échec suggestion prompt avec %s : %s", cur_model, e)

    if not generated_prompt:
        # Fallback élégant en cas d'absence de LLM
        generated_prompt = f"Evocative sacred scene of {clean_text}, dramatic atmospheric lighting, high quality fine art"

    # Concaténation avec le style d'arrière-plan si nécessaire
    if style_suffix and not any(k in generated_prompt.lower() for k in ["painting", "cinematic", "watercolor", "engraving"]):
        generated_prompt = f"{generated_prompt}, {style_suffix}"

    return generated_prompt


def generate_image_with_infomaniak_flux(
    prompt: str,
    token: Optional[str] = None,
    product_id: Optional[str] = None,
    size: str = "1024x1024"
) -> Tuple[bool, str]:
    """
    Génère une image via l'API Infomaniak Flux (Flux Schnell).
    Retourne (success, base64_jpeg_or_error_message).
    """
    config = load_config()
    token = token or get_secret("infomaniak_token", config) or config.get("infomaniak_token", "")
    product_id = product_id or get_secret("infomaniak_product_id", config) or config.get("infomaniak_product_id", "251")

    if not token:
        return False, "Jeton API Infomaniak non configuré dans les paramètres."

    url = f"https://api.infomaniak.com/1/ai/{product_id}/openai/images/generations"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "flux",
        "prompt": prompt,
        "size": size,
        "n": 1,
        "response_format": "b64_json"
    }

    try:
        logger.info("Envoi requête génération Flux à Infomaniak (product_id=%s)...", product_id)
        resp = requests.post(url, headers=headers, json=payload, timeout=90)
        if resp.status_code == 200:
            data = resp.json()
            items = data.get("data", [])
            if items and "b64_json" in items[0]:
                return True, items[0]["b64_json"]
            elif items and "url" in items[0]:
                # Si l'API retourne une URL au lieu de b64_json
                img_url = items[0]["url"]
                img_resp = requests.get(img_url, timeout=30)
                if img_resp.status_code == 200:
                    b64 = base64.b64encode(img_resp.content).decode("utf-8")
                    return True, b64
            return False, f"Format de réponse inattendu d'Infomaniak : {data}"
        else:
            err_msg = f"Erreur Infomaniak HTTP {resp.status_code} : {resp.text}"
            logger.error(err_msg)
            return False, err_msg
    except Exception as e:
        logger.error("Exception lors de la génération Infomaniak Flux : %s", e)
        return False, str(e)


def save_mindmap_image(
    b64_jpeg: str,
    node_id: str = "",
    note_id: str = ""
) -> Dict[str, Any]:
    """
    Enregistre le base64 JPEG dans le répertoire des données utilisateur `mindmap_images/`.
    Retourne le chemin relatif et le Data URL prêt à l'emploi.
    """
    img_dir = ensure_mindmap_images_dir()
    clean_node = re.sub(r'[^a-zA-Z0-9_-]', '_', node_id or "node")
    clean_note = re.sub(r'[^a-zA-Z0-9_-]', '_', note_id or "note")
    uid = uuid.uuid4().hex[:8]
    filename = f"mm_{clean_note}_{clean_node}_{uid}.jpg"
    filepath = os.path.join(img_dir, filename)

    raw_bytes = base64.b64decode(b64_jpeg)
    with open(filepath, "wb") as f:
        f.write(raw_bytes)

    rel_path = f"mindmap_images/{filename}"
    data_url = f"data:image/jpeg;base64,{b64_jpeg}"

    return {
        "success": True,
        "filename": filename,
        "relativePath": rel_path,
        "absolutePath": filepath,
        "dataUrl": data_url
    }


def get_mindmap_image_data_url(relative_path: str) -> Optional[str]:
    """
    Charge une image depuis le chemin relatif utilisateur (ex: 'mindmap_images/xyz.jpg')
    et renvoie son Data URL base64 pour affichage immédiat et offline.
    """
    if not relative_path:
        return None

    # Si c'est déjà un Data URL ou une URL web
    if relative_path.startswith("data:image/") or relative_path.startswith("http://") or relative_path.startswith("https://"):
        return relative_path

    # Nettoyer les slashes
    clean_rel = relative_path.replace("/", os.sep).replace("\\", os.sep)
    abs_path = get_user_data_path(clean_rel)

    if not os.path.exists(abs_path):
        # Fallback vérification avec basename
        base = os.path.basename(clean_rel)
        alt_path = get_user_data_path("mindmap_images", base)
        if os.path.exists(alt_path):
            abs_path = alt_path
        else:
            return None

    try:
        with open(abs_path, "rb") as f:
            b64 = base64.b64encode(f.read()).decode("utf-8")
        ext = os.path.splitext(abs_path)[1].lower().replace(".", "")
        mime = "jpeg" if ext in ["jpg", "jpeg"] else ("png" if ext == "png" else "webp")
        return f"data:image/{mime};base64,{b64}"
    except Exception as e:
        logger.warning("Erreur chargement image mindmap %s : %s", abs_path, e)
        return None
