"""
Open Shema — Module de Mise à Jour Automatique In-App
Gère l'interrogation de l'API GitHub Releases, le téléchargement non bloquant
en arrière-plan, l'extraction temporaire et le redémarrage à chaud.
Zéro emoji, architecture 100% thread-safe et robuste sous Windows.
"""

import os
import sys
import time
import json
import ssl
import shutil
import zipfile
import logging
import tempfile
import threading
import subprocess
import urllib.request
from typing import Dict, Any, Optional, Tuple

logger = logging.getLogger("open_shema_updater")

APP_VERSION = "1.0.0"
GITHUB_REPO = "Similarly1/open-shema"

# État global thread-safe
_state_lock = threading.Lock()
_update_state: Dict[str, Any] = {
    "status": "idle",       # idle | checking | available | downloading | ready_to_restart | error
    "percent": 0.0,
    "speed_str": "",
    "downloaded_str": "",
    "total_str": "",
    "error": None,
    "current_version": APP_VERSION,
    "latest_version": "",
    "release_name": "",
    "release_notes": "",
    "published_at": "",
    "download_url": "",
    "download_size": 0
}

_download_thread: Optional[threading.Thread] = None


def format_bytes(num_bytes: float) -> str:
    """Formatte une taille en octets en chaîne lisible."""
    if not num_bytes or num_bytes <= 0:
        return "0 Mo"
    for unit in ["o", "Ko", "Mo", "Go"]:
        if abs(num_bytes) < 1024.0:
            return f"{num_bytes:.1f} {unit}"
        num_bytes /= 1024.0
    return f"{num_bytes:.1f} To"


def parse_version_tuple(v_str: str) -> Tuple[int, ...]:
    """Convertit une chaîne de version ('v1.0.2', '1.0.0') en tuple d'entiers pour comparaison."""
    if not v_str:
        return (0, 0, 0)
    cleaned = v_str.strip().lstrip("vV")
    parts = []
    for chunk in cleaned.split("."):
        digits = "".join(c for c in chunk if c.isdigit())
        parts.append(int(digits) if digits else 0)
    while len(parts) < 3:
        parts.append(0)
    return tuple(parts)


def get_update_state() -> Dict[str, Any]:
    """Retourne une copie de l'état actuel de la mise à jour."""
    with _state_lock:
        return dict(_update_state)


def _set_update_state(**kwargs):
    """Met à jour les clés de l'état global."""
    with _state_lock:
        for k, v in kwargs.items():
            _update_state[k] = v


def check_for_updates(repo: str = GITHUB_REPO, timeout: int = 6) -> Dict[str, Any]:
    """
    Interroge l'API GitHub pour récupérer la dernière version stable publiée.
    Compare sémantiquement avec APP_VERSION.
    """
    _set_update_state(status="checking", error=None)

    url = f"https://api.github.com/repos/{repo}/releases/latest"
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": f"OpenShema/{APP_VERSION} (Windows)",
            "Accept": "application/vnd.github.v3+json"
        }
    )

    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    try:
        with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
            data = json.loads(resp.read().decode("utf-8"))

        tag_name = data.get("tag_name", "").strip()
        release_name = data.get("name") or tag_name
        release_notes = data.get("body", "")
        published_at = data.get("published_at", "")

        remote_tuple = parse_version_tuple(tag_name)
        current_tuple = parse_version_tuple(APP_VERSION)

        update_available = remote_tuple > current_tuple

        # Recherche de l'asset zip principal
        assets = data.get("assets", [])
        download_url = ""
        download_size = 0

        # Priorité : archive zip d'application complète
        for a in assets:
            name = a.get("name", "").lower()
            if name.endswith(".zip") and ("openshema" in name or "windows" in name):
                download_url = a.get("browser_download_url", "")
                download_size = a.get("size", 0)
                break

        if not download_url:
            for a in assets:
                if a.get("name", "").lower().endswith(".zip"):
                    download_url = a.get("browser_download_url", "")
                    download_size = a.get("size", 0)
                    break

        new_status = "available" if update_available else "idle"

        _set_update_state(
            status=new_status,
            current_version=APP_VERSION,
            latest_version=tag_name,
            release_name=release_name,
            release_notes=release_notes,
            published_at=published_at,
            download_url=download_url,
            download_size=download_size,
            error=None
        )

        return {
            "success": True,
            "update_available": update_available,
            "current_version": APP_VERSION,
            "latest_version": tag_name,
            "release_name": release_name,
            "release_notes": release_notes,
            "published_at": published_at,
            "download_url": download_url,
            "download_size": download_size,
            "download_size_str": format_bytes(download_size)
        }

    except urllib.error.HTTPError as he:
        if he.code == 404:
            # Aucune release encore publiée sur GitHub
            _set_update_state(status="idle", error=None)
            return {
                "success": True,
                "update_available": False,
                "current_version": APP_VERSION,
                "latest_version": APP_VERSION,
                "message": "Vous disposez de la dernière version."
            }
        err = f"Erreur serveur GitHub ({he.code})"
        _set_update_state(status="error", error=err)
        return {"success": False, "error": err, "current_version": APP_VERSION}

    except Exception as e:
        logger.debug(f"Vérification mise à jour impossible : {e}")
        _set_update_state(status="idle", error=None)
        return {
            "success": False,
            "error": "Impossible de contacter le serveur de mise à jour.",
            "current_version": APP_VERSION
        }


def _run_download_and_stage(download_url: str, target_version: str):
    """
    Télécharge l'archive de mise à jour dans %TEMP% et l'extrait dans un dossier temporaire
    sans bloquer le thread principal ni l'UI de l'application.
    """
    logger.info(f"Démarrage téléchargement mise à jour : {download_url}")
    temp_dir = os.path.join(tempfile.gettempdir(), "openshema_update")
    os.makedirs(temp_dir, exist_ok=True)

    zip_path = os.path.join(temp_dir, "update.zip")
    staged_dir = os.path.join(temp_dir, "staged")

    try:
        if os.path.exists(staged_dir):
            shutil.rmtree(staged_dir, ignore_errors=True)
        os.makedirs(staged_dir, exist_ok=True)

        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        req = urllib.request.Request(
            download_url,
            headers={"User-Agent": f"OpenShema/{APP_VERSION} (Windows)"}
        )

        with urllib.request.urlopen(req, timeout=15, context=ctx) as response:
            total_size = int(response.headers.get("content-length", 0))
            downloaded = 0
            start_time = time.time()
            last_update_time = start_time

            with open(zip_path, "wb") as out_file:
                chunk_size = 128 * 1024
                while True:
                    chunk = response.read(chunk_size)
                    if not chunk:
                        break
                    out_file.write(chunk)
                    downloaded += len(chunk)

                    now = time.time()
                    if now - last_update_time > 0.1 or downloaded == total_size:
                        duration = now - start_time
                        speed = downloaded / duration if duration > 0 else 0
                        percent = (downloaded / total_size * 90.0) if total_size > 0 else 50.0

                        _set_update_state(
                            percent=round(percent, 1),
                            speed_str=f"{format_bytes(speed)}/s",
                            downloaded_str=format_bytes(downloaded),
                            total_str=format_bytes(total_size)
                        )
                        last_update_time = now

        # Décompression dans le dossier staged
        _set_update_state(percent=92.0, speed_str="", downloaded_str="Décompression...")
        with zipfile.ZipFile(zip_path, "r") as zf:
            zf.extractall(staged_dir)

        # Vérification si les fichiers sont encapsulés dans un sous-dossier OpenShema/
        subdirs = os.listdir(staged_dir)
        if len(subdirs) == 1 and os.path.isdir(os.path.join(staged_dir, subdirs[0])):
            nested = os.path.join(staged_dir, subdirs[0])
            for item in os.listdir(nested):
                src = os.path.join(nested, item)
                dst = os.path.join(staged_dir, item)
                if not os.path.exists(dst):
                    shutil.move(src, dst)
            shutil.rmtree(nested, ignore_errors=True)

        _set_update_state(
            status="ready_to_restart",
            percent=100.0,
            speed_str="",
            error=None
        )
        logger.info("Mise à jour téléchargée et prête pour le redémarrage.")

    except Exception as e:
        logger.error(f"Erreur lors du téléchargement de la mise à jour: {e}", exc_info=True)
        _set_update_state(
            status="error",
            error=f"Échec du téléchargement : {e}"
        )


def start_background_download() -> Dict[str, Any]:
    """Déclenche le téléchargement en arrière-plan."""
    global _download_thread

    state = get_update_state()
    download_url = state.get("download_url")
    target_version = state.get("latest_version")

    if not download_url:
        return {"success": False, "error": "Aucune URL de téléchargement disponible."}

    if state.get("status") in ["downloading", "ready_to_restart"]:
        return {"success": True, "status": state.get("status")}

    _set_update_state(
        status="downloading",
        percent=1.0,
        speed_str="",
        downloaded_str="Démarrage...",
        error=None
    )

    _download_thread = threading.Thread(
        target=_run_download_and_stage,
        args=(download_url, target_version),
        daemon=True
    )
    _download_thread.start()

    return {"success": True}


def apply_update_and_restart() -> Dict[str, Any]:
    """
    Prépare et exécute le script de mise à jour Windows autonome, puis quitte Open Shema.
    Le script PowerShell attend que le processus actuel se termine, synchronise les fichiers
    dans le dossier d'installation avec robocopy, et relance OpenShema.exe.
    """
    temp_dir = os.path.join(tempfile.gettempdir(), "openshema_update")
    staged_dir = os.path.join(temp_dir, "staged")

    if not os.path.exists(staged_dir) or not os.listdir(staged_dir):
        return {"success": False, "error": "Les fichiers de mise à jour sont introuvables."}

    # Détection du dossier d'installation cible
    if getattr(sys, "frozen", False):
        install_dir = os.path.dirname(os.path.abspath(sys.executable))
    else:
        local_appdata = os.environ.get("LOCALAPPDATA", "")
        install_dir = os.path.join(local_appdata, "Programs", "OpenShema")

    exe_target = os.path.join(install_dir, "OpenShema.exe")
    current_pid = os.getpid()

    # Script PowerShell de bascule sécurisée
    ps_script = f"""
$pidToWait = {current_pid}
$sourceDir = '{staged_dir.replace("'", "''")}'
$targetDir = '{install_dir.replace("'", "''")}'
$exePath = '{exe_target.replace("'", "''")}'

# 1. Attente de la fin du processus principal Open Shema
try {{
    Wait-Process -Id $pidToWait -Timeout 15 -ErrorAction SilentlyContinue
}} catch {{}}
Start-Sleep -Milliseconds 600

# 2. Synchronisation rapide des fichiers via robocopy natif
robocopy "$sourceDir" "$targetDir" /E /MT:8 /R:3 /W:1 /NP /NFL /NDL

# 3. Nettoyage temporaire du zip
Remove-Item -Path "$sourceDir" -Recurse -Force -ErrorAction SilentlyContinue

# 4. Relance d'Open Shema en version mise à jour
if (Test-Path "$exePath") {{
    Start-Process -FilePath "$exePath" -WorkingDirectory "$targetDir"
}}
"""

    script_path = os.path.join(temp_dir, "apply_update.ps1")
    with open(script_path, "w", encoding="utf-8") as f:
        f.write(ps_script)

    try:
        # Lancement en arrière-plan totalement détaché
        creation_flags = 0x08000000 | 0x00000200  # CREATE_NO_WINDOW | CREATE_NEW_PROCESS_GROUP
        subprocess.Popen(
            ["powershell", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden", "-File", script_path],
            creationflags=creation_flags,
            close_fds=True
        )
        logger.info("Script de relance détaché déclenché avec succès.")
        return {"success": True}
    except Exception as e:
        logger.error(f"Échec du lancement du script de mise à jour: {e}")
        return {"success": False, "error": str(e)}
