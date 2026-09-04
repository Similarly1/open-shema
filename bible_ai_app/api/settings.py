"""
SettingsMixin - Extracted from BibleAppApi.
"""
import os
import sys
import logging
import json
import sqlite3
import traceback
import asyncio
import webview
import threading
import time
import shutil
from typing import Dict, List, Any, Optional

logger = logging.getLogger(__name__)
from api._utils import (
    current_dir, BibleJsonLoader, extract_verse_text,
    get_french_book_name, resolve_book_input, parse_smart_book_input,
    BOOKS_OT, BOOKS_NT, BOOKS_DEUTERO, ALL_BOOKS, BOOK_MAPPING, strip_accents,
    PericopeManager, CommentaryLoader, DictionaryManager, OriginalLanguagesManager,
    NotesManager, load_config, save_config,
    DEFAULT_NOTE_TITLE_SYSTEM_PROMPT, DEFAULT_NOTE_TAGS_SYSTEM_PROMPT,
    SermonsManager, HighlightsManager, MapsManager,
    load_books_metadata, save_books_metadata, AISessionManager,
    migrate_secrets_from_config, load_secrets_into_config, send_windows_toast,
    BIBLES_REGISTRY_FILE, BIBLE_CANONICAL_INFO,
    strip_xml_tags, load_bibles_registry, find_bible_registry_entry,
    get_cover_data_url, parse_reverse_interlinear_verse,
    _BACKUP_MANIFEST_VERSION, _BACKUP_COMPONENTS
)
current_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
from api.window import get_active_window, get_global_window



class SettingsMixin:
    def get_background_tasks(self) -> List[Dict[str, Any]]:
        """Récupère la liste des tâches actives en arrière-plan."""
        from core.task_manager import TaskManager
        return TaskManager.get_all_tasks()

    def dismiss_background_task(self, task_id: str) -> Dict[str, Any]:
        """Supprime une tâche terminée ou fermée."""
        from core.task_manager import TaskManager
        TaskManager.dismiss_task(task_id)
        return {"success": True}

    def get_settings(self) -> Dict[str, Any]:
        return load_secrets_into_config(load_config())

    def get_config(self) -> Dict[str, Any]:
        return self.get_settings()

    def save_settings(self, new_config: Dict[str, Any]) -> bool:
        # Migrer les nouvelles cles API vers le trousseau avant sauvegarde
        new_config = migrate_secrets_from_config(new_config)
        save_config(new_config)
        raw = load_config()
        self.config = load_secrets_into_config(raw)
        return True

    def get_commentary_favorites(self) -> List[str]:
        cfg = load_config()
        favs = cfg.get("commentary_favorites", [])
        return favs if isinstance(favs, list) else []

    def save_commentary_favorites(self, favorites: List[str]) -> bool:
        cfg = load_config()
        if not isinstance(favorites, list):
            favorites = []
        cfg["commentary_favorites"] = favorites[:3]
        save_config(cfg)
        self.config = cfg
        return True

    def fetch_gemini_models(self, api_key: Optional[Any] = None) -> Dict[str, Any]:
        """Interroge l'API Google Gemini pour obtenir la liste en temps réel des modèles supportant generateContent."""
        key = ""
        if isinstance(api_key, dict):
            key = api_key.get("api_key") or api_key.get("key") or ""
        elif isinstance(api_key, str):
            key = api_key
        
        if not key:
            key = self.config.get("gemini_api_key", "")
        if not key:
            raw = load_config()
            cfg_secrets = load_secrets_into_config(raw)
            key = cfg_secrets.get("gemini_api_key", "")
        
        if not key or not str(key).strip():
            return {"success": False, "error": "Clé API Google Gemini non renseignée. Veuillez d'abord saisir votre clé API Google dans le champ ci-dessus."}
        
        key = str(key).strip()
        url = f"https://generativelanguage.googleapis.com/v1beta/models?key={key}"
        try:
            resp = requests.get(url, timeout=12)
            if resp.status_code != 200:
                err_msg = f"Erreur Google ({resp.status_code})"
                try:
                    err_json = resp.json()
                    if "error" in err_json and "message" in err_json["error"]:
                        err_msg = f"Google API : {err_json['error']['message']}"
                except Exception:
                    pass
                return {"success": False, "error": err_msg}
            
            data = resp.json()
            raw_models = data.get("models", [])
            valid_models = []
            
            for m in raw_models:
                methods = m.get("supportedGenerationMethods", [])
                if "generateContent" in methods:
                    m_name = m.get("name", "")
                    m_id = m_name.replace("models/", "")
                    m_id_low = m_id.lower()
                    # Ignorer les modèles spécialisés (audio/tts, computer-use, image generation, embedding, aqa)
                    if any(bad in m_id_low for bad in ["embedding", "aqa", "-tts", "computer-use", "-image", "imagen", "robotics"]):
                        continue
                    
                    display_name = m.get("displayName", m_id)
                    description = m.get("description", "")
                    input_limit = m.get("inputTokenLimit", 0)
                    output_limit = m.get("outputTokenLimit", 0)
                    
                    valid_models.append({
                        "id": m_id,
                        "name": display_name,
                        "description": description,
                        "inputTokenLimit": input_limit,
                        "outputTokenLimit": output_limit
                    })
            
            # Trier de façon ergonomique : 2.5 d'abord, puis 2.0, puis 1.5, etc.
            def model_sort_key(item):
                i_id = item["id"].lower()
                if "2.5" in i_id:
                    return (1, i_id)
                elif "2.0" in i_id:
                    return (2, i_id)
                elif "1.5" in i_id:
                    return (3, i_id)
                return (4, i_id)
            
            valid_models.sort(key=model_sort_key)
            return {"success": True, "models": valid_models}
        except Exception as e:
            logger.exception(f"Erreur fetch_gemini_models: {e}")
            return {"success": False, "error": str(e)}

    def fetch_mistral_models(self, api_key: Optional[Any] = None) -> Dict[str, Any]:
        """Interroge l'API Mistral AI pour obtenir la liste en temps réel des modèles disponibles."""
        key = ""
        if isinstance(api_key, dict):
            key = api_key.get("api_key") or api_key.get("key") or api_key.get("mistral_api_key") or ""
        elif isinstance(api_key, str):
            key = api_key
        
        if not key:
            key = self.config.get("mistral_api_key", "")
        if not key:
            raw = load_config()
            cfg_secrets = load_secrets_into_config(raw)
            key = cfg_secrets.get("mistral_api_key", "")
        
        if not key or not str(key).strip():
            return {"success": False, "error": "Clé API Mistral AI non renseignée. Veuillez d'abord saisir votre clé API Mistral dans vos paramètres."}
        
        key = str(key).strip()
        url = "https://api.mistral.ai/v1/models"
        headers = {"Authorization": f"Bearer {key}"}
        try:
            resp = requests.get(url, headers=headers, timeout=12)
            if resp.status_code != 200:
                err_msg = f"Erreur Mistral ({resp.status_code})"
                try:
                    err_json = resp.json()
                    if "detail" in err_json:
                        err_msg = f"Mistral API : {err_json['detail']}"
                    elif "message" in err_json:
                        err_msg = f"Mistral API : {err_json['message']}"
                except Exception:
                    pass
                return {"success": False, "error": err_msg}
            
            data = resp.json()
            raw_models = data.get("data", [])
            valid_models = []
            
            for m in raw_models:
                m_id = m.get("id", "")
                m_id_low = m_id.lower()
                
                # Ignorer les modèles d'embedding ou de modération pure
                if any(bad in m_id_low for bad in ["embed", "moderation", "guard"]):
                    continue
                
                caps = m.get("capabilities", {})
                if caps and caps.get("completion_chat") is False:
                    continue
                
                display_name = m.get("name") or m_id
                description = m.get("description", "")
                if not description:
                    if "large" in m_id_low:
                        description = "Raisonnement approfondi & style souverain"
                    elif "small" in m_id_low:
                        description = "Rapide, équilibré & concis"
                    elif "nemo" in m_id_low:
                        description = "Polyvalent & multilingue (12B)"
                    elif "codestral" in m_id_low:
                        description = "Structuration stricte & logique"
                    elif "ministral" in m_id_low:
                        description = "Modèle compact pour inférence rapide"
                    elif "pixtral" in m_id_low:
                        description = "Modèle multimodal & analyse"
                    else:
                        description = "Modèle officiel Mistral AI"
                
                valid_models.append({
                    "id": m_id,
                    "name": display_name,
                    "description": description,
                    "provider": "mistral"
                })
            
            def mistral_sort_key(item):
                i_id = item["id"].lower()
                if "large" in i_id:
                    return (1, i_id)
                elif "small" in i_id:
                    return (2, i_id)
                elif "nemo" in i_id:
                    return (3, i_id)
                elif "codestral" in i_id:
                    return (4, i_id)
                elif "ministral" in i_id:
                    return (5, i_id)
                return (6, i_id)
            
            valid_models.sort(key=mistral_sort_key)
            return {"success": True, "models": valid_models}
        except Exception as e:
            logger.exception(f"Erreur fetch_mistral_models: {e}")
            return {"success": False, "error": str(e)}

    def fetch_infomaniak_models(self, token: Optional[Any] = None, product_id: Optional[Any] = None) -> Dict[str, Any]:
        """Interroge l'API Infomaniak Swiss AI pour obtenir la liste en temps réel des modèles déployés."""
        tok = ""
        pid = ""
        if isinstance(token, dict):
            tok = token.get("token") or token.get("api_key") or token.get("infomaniak_token") or ""
            pid = token.get("product_id") or token.get("infomaniak_product_id") or ""
        elif isinstance(token, str):
            tok = token
            if isinstance(product_id, str):
                pid = product_id
        
        if not tok:
            tok = self.config.get("infomaniak_token", "")
        if not pid:
            pid = self.config.get("infomaniak_product_id", "251")
        if not tok:
            raw = load_config()
            cfg_secrets = load_secrets_into_config(raw)
            tok = cfg_secrets.get("infomaniak_token", "")
            pid = cfg_secrets.get("infomaniak_product_id", "251")
            
        if not tok or not str(tok).strip():
            return {"success": False, "error": "Token API Infomaniak non renseigné. Veuillez d'abord saisir votre token dans vos paramètres."}
        
        tok = str(tok).strip()
        pid = str(pid or "251").strip()
        url = f"https://api.infomaniak.com/2/ai/{pid}/openai/v1/models"
        headers = {"Authorization": f"Bearer {tok}"}
        try:
            resp = requests.get(url, headers=headers, timeout=12)
            if resp.status_code != 200:
                err_msg = f"Erreur Infomaniak ({resp.status_code})"
                try:
                    err_json = resp.json()
                    if "error" in err_json and isinstance(err_json["error"], dict) and "message" in err_json["error"]:
                        err_msg = f"Infomaniak API : {err_json['error']['message']}"
                    elif "detail" in err_json:
                        err_msg = f"Infomaniak API : {err_json['detail']}"
                except Exception:
                    pass
                return {"success": False, "error": err_msg}
            
            data = resp.json()
            raw_models = data.get("data", [])
            valid_models = []
            
            for m in raw_models:
                m_id = m.get("id", "")
                m_id_low = m_id.lower()
                if any(bad in m_id_low for bad in ["embed", "bge_", "mini_lm_"]):
                    continue
                display_name = m.get("name") or m_id
                valid_models.append({
                    "id": m_id,
                    "name": display_name,
                    "description": "Hébergé souverainement en Suisse sur Infomaniak AI",
                    "provider": "infomaniak"
                })
            
            return {"success": True, "models": valid_models}
        except Exception as e:
            logger.exception(f"Erreur fetch_infomaniak_models: {e}")
            return {"success": False, "error": str(e)}

    def export_backup_zip(self) -> Dict[str, Any]:
        """Exporte l'ensemble des données dans un fichier ZIP sélectionné."""
        win = get_active_window()
        if not win:
            return {"success": False, "error": "Fenêtre introuvable"}
            
        now_str = datetime.datetime.now().strftime('%Y%m%d_%H%M')
        default_name = f"backup_bible_ai_{now_str}.zip"
        
        save_path = win.create_file_dialog(
            webview.SAVE_DIALOG,
            save_filename=default_name,
            file_types=('Archives ZIP (*.zip)', 'Tous les fichiers (*.*)')
        )
        if not save_path:
            return {"cancelled": True}
            
        if isinstance(save_path, (list, tuple)):
            save_path = save_path[0]

        data_dir = os.path.join(current_dir, "data")
        tmp_zip = save_path + ".tmp"

        try:
            manifest = {
                "version": _BACKUP_MANIFEST_VERSION,
                "created_at": datetime.datetime.now().isoformat(),
                "components": []
            }

            with zipfile.ZipFile(tmp_zip, "w", compression=zipfile.ZIP_DEFLATED, allowZip64=True) as zf:
                for folder_or_file, label in _BACKUP_COMPONENTS:
                    src = os.path.join(data_dir, folder_or_file)
                    if not os.path.exists(src):
                        continue

                    if os.path.isfile(src):
                        arcname = os.path.join("data", folder_or_file)
                        zf.write(src, arcname)
                        manifest["components"].append(folder_or_file)
                    else:
                        for root, _, files in os.walk(src):
                            for fname in files:
                                full = os.path.join(root, fname)
                                rel = os.path.relpath(full, data_dir)
                                zf.write(full, os.path.join("data", rel))
                        manifest["components"].append(folder_or_file)

                zf.writestr("backup_manifest.json", json.dumps(manifest, ensure_ascii=False, indent=2))

            if os.path.exists(save_path):
                os.remove(save_path)
            os.rename(tmp_zip, save_path)

            size_mb = os.path.getsize(save_path) / (1024 * 1024)
            return {"success": True, "path": save_path, "size_mb": round(size_mb, 1)}
        except Exception as e:
            if os.path.exists(tmp_zip):
                try: os.remove(tmp_zip)
                except OSError: pass
            return {"success": False, "error": str(e)}

    def import_backup_zip(self) -> Dict[str, Any]:
        """Restaure les données depuis un fichier ZIP."""
        win = get_active_window()
        if not win:
            return {"success": False, "error": "Fenêtre introuvable"}
            
        pick = win.create_file_dialog(
            webview.OPEN_DIALOG,
            allow_multiple=False,
            file_types=('Archives ZIP (*.zip)', 'Tous les fichiers (*.*)')
        )
        if not pick or len(pick) == 0:
            return {"cancelled": True}
            
        zip_path = pick[0]
        data_dir = os.path.join(current_dir, "data")

        try:
            with zipfile.ZipFile(zip_path, "r") as zf:
                if "backup_manifest.json" not in zf.namelist():
                    return {"success": False, "error": "Archive invalide (manifeste manquant)."}

                manifest = json.loads(zf.read("backup_manifest.json"))
                components = manifest.get("components", [])

                for component in components:
                    dest = os.path.join(data_dir, component)
                    if os.path.isdir(dest):
                        shutil.rmtree(dest, ignore_errors=True)
                    elif os.path.isfile(dest):
                        os.remove(dest)

                    prefix = f"data/{component}"
                    entries = [n for n in zf.namelist() if n.startswith(prefix)]
                    for entry in entries:
                        target = os.path.join(data_dir, os.path.relpath(entry, "data"))
                        if entry.endswith("/"):
                            os.makedirs(target, exist_ok=True)
                        else:
                            os.makedirs(os.path.dirname(target), exist_ok=True)
                            with zf.open(entry) as src_f, open(target, "wb") as dst_f:
                                shutil.copyfileobj(src_f, dst_f)

            return {"success": True}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def is_first_run(self) -> Dict[str, Any]:
        """Vérifie si l'application est au premier lancement."""
        cfg = load_secrets_into_config(load_config())
        first_run_flag = cfg.get("first_run")

        # Si l'onboarding a déjà été validé par l'utilisateur
        if first_run_flag is False:
            return {"is_first_run": False, "config": cfg}

        # Si first_run est explicitement True
        if first_run_flag is True:
            return {"is_first_run": True, "config": cfg}

        # Sinon (clé absente d'une ancienne version), vérifier la présence physique de Bibles
        bundle_root = getattr(sys, "_MEIPASS", None) or os.path.dirname(sys.executable)
        candidates = [
            os.path.join(current_dir, "data", "bibles"),
            os.path.join(bundle_root, "data", "bibles"),
            os.path.join(bundle_root, "_internal", "data", "bibles")
        ]
        has_bibles = False
        for bdir in candidates:
            if os.path.isdir(bdir):
                for entry in os.listdir(bdir):
                    full_p = os.path.join(bdir, entry)
                    if os.path.isdir(full_p) or entry.endswith((".sqlite", ".db", ".json")):
                        has_bibles = True
                        break
            if has_bibles:
                break

        return {"is_first_run": not has_bibles, "config": cfg}

    def download_onboarding_modules(self, modules: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Télécharge et installe les modules sélectionnés lors du premier lancement depuis open-shema-data."""
        import gzip
        import urllib.request
        import ssl
        from core.task_manager import TaskManager

        task_id = "onboarding_download"
        total_modules = len(modules)
        if total_modules == 0:
            return {"success": True, "installed": 0}

        TaskManager.start_task(
            task_id=task_id,
            title="Installation des modules",
            task_type="download",
            total=total_modules,
            detail="Initialisation du téléchargement..."
        )

        data_dir = os.path.join(current_dir, "data")
        os.makedirs(data_dir, exist_ok=True)
        installed_items = []

        try:
            bundle_root = getattr(sys, "_MEIPASS", None) or os.path.dirname(sys.executable)

            for idx, mod in enumerate(modules):
                mod_id = mod.get("id", "module")
                mod_title = mod.get("title") or mod_id
                mod_abbr = mod.get("abbreviation") or mod.get("code") or "LSG"
                mod_type = mod.get("type", "bible")
                download_url = mod.get("download_url") or mod.get("url") or ""

                if not download_url:
                    cdn_base = "https://raw.githubusercontent.com/Similarly1/open-shema-data/main"
                    rel_path = mod.get("file_path") or f"data/{mod_type}s/bible_{mod_abbr.lower()}.sqlite"
                    download_url = f"{cdn_base}/{rel_path}"

                # Déterminer le dossier de destination
                if mod_type == "bible":
                    target_dir = os.path.join(data_dir, "bibles")
                elif mod_type == "dictionary":
                    target_dir = os.path.join(data_dir, "dictionaries")
                elif mod_type == "commentary":
                    target_dir = os.path.join(data_dir, "commentaires")
                elif mod_type == "theology":
                    target_dir = os.path.join(data_dir, "theology")
                else:
                    target_dir = data_dir

                os.makedirs(target_dir, exist_ok=True)

                is_gz = download_url.endswith(".gz")
                filename = os.path.basename(download_url.split("?")[0])
                dest_filename = filename[:-3] if is_gz else filename
                dest_path = os.path.join(target_dir, dest_filename)

                # 1. Vérifier si le module existe déjà localement (prêt à l'emploi)
                already_available = False
                if os.path.exists(dest_path) and os.path.getsize(dest_path) > 100_000:
                    already_available = True
                elif mod_type == "bible":
                    # Vérifier d'autres noms canoniques possibles
                    candidates = [
                        os.path.join(target_dir, f"bible_{mod_abbr.lower()}1910.sqlite"),
                        os.path.join(target_dir, f"bible_{mod_abbr.lower()}.sqlite"),
                        os.path.join(target_dir, f"{mod_abbr}.sqlite")
                    ]
                    for cand in candidates:
                        if os.path.exists(cand) and os.path.getsize(cand) > 100_000:
                            dest_path = cand
                            already_available = True
                            break

                # 2. Si non présent dans data/, chercher dans les ressources embarquées du package
                if not already_available and bundle_root:
                    rel_sub = os.path.relpath(dest_path, data_dir)
                    bundled_candidates = [
                        os.path.join(bundle_root, "data", rel_sub),
                        os.path.join(bundle_root, "_internal", "data", rel_sub),
                        os.path.join(bundle_root, "bible_ai_app", "data", rel_sub),
                    ]
                    for bcand in bundled_candidates:
                        if os.path.exists(bcand) and os.path.getsize(bcand) > 100_000:
                            logger.info(f"Copie du module embarqué {mod_title} depuis {bcand}...")
                            shutil.copy2(bcand, dest_path)
                            already_available = True
                            break

                if already_available:
                    logger.info(f"Module {mod_title} déjà disponible localement ({dest_path}), aucun téléchargement requis.")
                    TaskManager.update_progress(
                        task_id,
                        int(((idx + 0.9) / total_modules) * 100),
                        current=idx + 1,
                        total=total_modules,
                        detail=f"{mod_title} déjà prêt localement"
                    )
                else:
                    # 3. Téléchargement progressif en flux avec notification en temps réel
                    TaskManager.update_progress(
                        task_id,
                        int((idx / total_modules) * 100),
                        current=idx,
                        total=total_modules,
                        detail=f"Connexion et téléchargement de {mod_title}..."
                    )

                    req = urllib.request.Request(
                        download_url,
                        headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) OpenShema/1.0"}
                    )

                    temp_download = os.path.join(target_dir, f"tmp_{filename}")
                    ctx = ssl.create_default_context()
                    ctx.check_hostname = False
                    ctx.verify_mode = ssl.CERT_NONE

                    with urllib.request.urlopen(req, timeout=15, context=ctx) as resp:
                        total_size = int(resp.headers.get("Content-Length", 0))
                        downloaded = 0
                        chunk_size = 65536
                        last_progress_time = time.time()

                        with open(temp_download, "wb") as out_f:
                            while True:
                                chunk = resp.read(chunk_size)
                                if not chunk:
                                    break
                                out_f.write(chunk)
                                downloaded += len(chunk)
                                now = time.time()
                                if now - last_progress_time > 0.12:
                                    last_progress_time = now
                                    if total_size > 0:
                                        pct = int((downloaded / total_size) * 100)
                                        mb_cur = downloaded / (1024 * 1024)
                                        mb_tot = total_size / (1024 * 1024)
                                        detail_text = f"Téléchargement de {mod_title} : {mb_cur:.1f} / {mb_tot:.1f} Mo ({pct}%)"
                                        prog_overall = int(((idx + (downloaded / total_size)) / total_modules) * 100)
                                    else:
                                        mb_cur = downloaded / (1024 * 1024)
                                        detail_text = f"Téléchargement de {mod_title} : {mb_cur:.1f} Mo..."
                                        prog_overall = int((idx / total_modules) * 100)

                                    TaskManager.update_progress(
                                        task_id,
                                        prog_overall,
                                        current=idx,
                                        total=total_modules,
                                        detail=detail_text
                                    )

                    if is_gz:
                        with gzip.open(temp_download, "rb") as gz_in, open(dest_path, "wb") as out_f:
                            shutil.copyfileobj(gz_in, out_f)
                        try:
                            os.remove(temp_download)
                        except OSError:
                            pass
                    else:
                        if os.path.exists(dest_path):
                            try:
                                os.remove(dest_path)
                            except OSError:
                                pass
                        os.rename(temp_download, dest_path)

                # 4. Extraction SQLite vers JSON (si Bible et pas encore extraite)
                if mod_type == "bible" and dest_path.endswith(".sqlite"):
                    dest_json_dir = os.path.join(data_dir, "bibles", mod_abbr)
                    json_already_extracted = False
                    if os.path.isdir(dest_json_dir):
                        json_files = [f for f in os.listdir(dest_json_dir) if f.endswith(".json")]
                        if len(json_files) >= 66:
                            json_already_extracted = True

                    if not json_already_extracted:
                        TaskManager.update_progress(
                            task_id,
                            int(((idx + 0.95) / total_modules) * 100),
                            current=idx + 1,
                            total=total_modules,
                            detail=f"Préparation des 66 livres de {mod_title}..."
                        )
                        try:
                            if hasattr(self, "_extract_sqlite_bible_to_json"):
                                self._extract_sqlite_bible_to_json(dest_path, mod_abbr, mod_title)
                        except Exception as ext_err:
                            logger.error(f"Erreur extraction SQLite vers JSON ({mod_title}): {ext_err}")
                            raise RuntimeError(f"Échec de l'extraction de la Bible {mod_title} : {ext_err}")

                    # Enregistrer dans metadata / library
                    try:
                        from core.bible_json_loader import BibleJsonLoader
                        BibleJsonLoader.clear_cache()
                        registry = load_books_metadata()
                        meta_dict = {
                            "name": mod_abbr,
                            "title": mod_title,
                            "type": "Bible",
                            "folder_name": mod_abbr,
                            "version_code": mod_abbr,
                            "file_path": dest_path,
                            "active": True
                        }
                        if mod_title in registry:
                            registry.pop(mod_title, None)
                        registry[mod_abbr] = meta_dict
                        save_books_metadata(registry)
                    except Exception as reg_err:
                        logger.warning(f"Avertissement enregistrement metadata Bible ({mod_title}): {reg_err}")

                installed_items.append({"id": mod_id, "title": mod_title, "path": dest_path})

            TaskManager.complete_task(task_id, message=f"{len(installed_items)} module(s) prêt(s)")
            return {"success": True, "installed": len(installed_items), "items": installed_items}

        except Exception as e:
            logger.error(f"Erreur download_onboarding_modules: {e}", exc_info=True)
            TaskManager.fail_task(task_id, str(e))
            return {"success": False, "error": str(e), "installed": len(installed_items)}

    def complete_first_run(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Finalise le premier lancement, enregistre la configuration et désactive first_run."""
        try:
            current_cfg = load_secrets_into_config(load_config())
            
            # Mettre à jour les paramètres reçus
            for k, v in payload.items():
                current_cfg[k] = v

            current_cfg["first_run"] = False
            
            # Migrer les secrets et enregistrer
            clean_cfg = migrate_secrets_from_config(current_cfg)
            save_config(clean_cfg)
            
            self.config = load_secrets_into_config(load_config())
            return {"success": True}
        except Exception as e:
            logger.error(f"Erreur complete_first_run: {e}", exc_info=True)
            return {"success": False, "error": str(e)}

    def report_error(self, title: str, message: str, details: Any = "", user_comment: str = "", user_email: str = None) -> Dict[str, Any]:
        """
        Transmet un rapport d'erreur technique vers l'alias email anonaddy configuré (0wl8a4k7@family3130.anonaddy.com).
        """
        import urllib.request
        import urllib.parse
        import json
        import datetime

        FEEDBACK_EMAIL = "0wl8a4k7@family3130.anonaddy.com"
        try:
            subject = f"[Open Shema Erreur] {title or 'Erreur Application'}"
            if isinstance(details, (dict, list)):
                details_str = json.dumps(details, indent=2, ensure_ascii=False)
            else:
                details_str = str(details or "")

            if len(details_str) > 4000:
                details_str = details_str[:4000] + "\n... [Détails tronqués]"

            payload = {
                "_subject": subject,
                "Titre_Erreur": str(title or "Non spécifié"),
                "Message_Erreur": str(message or "Non spécifié"),
                "Details_Techniques": details_str or "(Aucun détail)",
                "Commentaire_Utilisateur": str(user_comment) if user_comment else "(Signalement direct)",
                "Email_Utilisateur": str(user_email) if user_email else "Non renseigné",
                "Plateforme": f"{sys.platform} ({os.name})",
                "Date_Signalement": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "_template": "table",
                "_captcha": "false"
            }

            url = f"https://formsubmit.co/ajax/{FEEDBACK_EMAIL}"
            data = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(
                url,
                data=data,
                headers={
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) OpenShema/1.0",
                    "Referer": "https://openshema.app/",
                    "Origin": "https://openshema.app"
                }
            )
            with urllib.request.urlopen(req, timeout=12) as response:
                res_body = response.read().decode("utf-8")
                res_json = json.loads(res_body)
                if str(res_json.get("success", "")).lower() == "true":
                    return {"success": True, "message": "Rapport d'erreur transmis avec succès. Merci pour votre aide !"}
                else:
                    return {"success": True, "message": res_json.get("message", "Rapport d'erreur transmis.")}
        except Exception as e:
            logger.error(f"[SettingsMixin] Erreur transmission rapport d'erreur: {e}")
            return {"success": False, "error": str(e)}


