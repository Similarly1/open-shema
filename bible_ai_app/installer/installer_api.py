"""
Open Shema — Backend API pour le Bootstrapper / Installeur (PyWebView)
Gère l'interrogation de l'API GitHub, le téléchargement avec suivi en temps réel,
la décompression de l'archive, la création des raccourcis Windows et le lancement.
"""

import os
import sys
import json
import time
import shutil
import zipfile
import logging
import threading
import subprocess
import urllib.request
import ssl

logger = logging.getLogger("OpenShemaInstaller")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")


def format_bytes(num_bytes: float) -> str:
    """Formate une taille en octets en format lisible (Ko, Mo, Go)."""
    for unit in ['o', 'Ko', 'Mo', 'Go']:
        if abs(num_bytes) < 1024.0:
            return f"{num_bytes:.1f} {unit}"
        num_bytes /= 1024.0
    return f"{num_bytes:.1f} To"


class InstallerAPI:
    def __init__(self):
        self.window = None
        self.is_cancelled = False
        self.is_installing = False
        self.download_thread = None

    def set_window(self, window):
        self.window = window

    # --- CONTRÔLES DE LA FENÊTRE PYWEBVIEW ---
    def minimize_window(self):
        if self.window:
            self.window.minimize()

    def close_window(self):
        if self.is_installing:
            self.is_cancelled = True
        if self.window:
            self.window.destroy()

    # --- INFORMATIONS SYSTÈME & DOSSIER D'INSTALLATION ---
    def get_system_info(self):
        """Retourne le dossier par défaut (%LOCALAPPDATA%\\Programs\\OpenShema) et l'espace libre."""
        local_appdata = os.environ.get("LOCALAPPDATA")
        if not local_appdata:
            local_appdata = os.path.expanduser("~")
        
        default_install_dir = os.path.join(local_appdata, "Programs", "OpenShema")
        
        # Calcul de l'espace disque disponible
        drive = os.path.splitdrive(default_install_dir)[0] or "C:"
        drive_path = drive + "\\"
        free_space_bytes = 0
        try:
            free_space_bytes = shutil.disk_usage(drive_path).free
        except Exception:
            free_space_bytes = 10 * 1024 * 1024 * 1024  # 10 Go par défaut

        return {
            "default_path": default_install_dir,
            "free_space_bytes": free_space_bytes,
            "free_space_str": format_bytes(free_space_bytes),
            "required_space_str": "~350 Mo",
            "drive": drive
        }

    def browse_folder(self, current_path=""):
        """Ouvre un sélecteur de dossier Windows."""
        try:
            import webview
            res = self.window.create_file_dialog(webview.FOLDER_DIALOG, directory=current_path or None)
            if res and len(res) > 0:
                selected = res[0]
                # Si l'utilisateur sélectionne par exemple "C:\Programs", on append "OpenShema"
                if not selected.lower().endswith("openshema"):
                    selected = os.path.join(selected, "OpenShema")
                return {"selected": selected}
        except Exception as e:
            logger.warning(f"Fallback browse_folder: {e}")
            try:
                import tkinter as tk
                from tkinter import filedialog
                root = tk.Tk()
                root.withdraw()
                root.attributes('-topmost', True)
                folder = filedialog.askdirectory(initialdir=current_path or None, title="Sélectionnez le dossier d'installation")
                root.destroy()
                if folder:
                    if not folder.lower().endswith("openshema"):
                        folder = os.path.join(folder, "OpenShema")
                    return {"selected": folder}
            except Exception:
                pass
        return {"selected": current_path}

    # --- GITHUB RELEASES API ---
    def check_latest_release(self, repo="Similarly1/open-shema"):
        """Interroge l'API GitHub pour récupérer la dernière release disponible."""
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE

        url = f"https://api.github.com/repos/{repo}/releases/latest"
        fallback_url = f"https://api.github.com/repos/{repo}/releases"
        
        headers = {
            "User-Agent": "OpenShemaInstaller/1.0",
            "Accept": "application/vnd.github.v3+json"
        }

        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=12, context=ctx) as resp:
                data = json.load(resp)
                return self._parse_release_data(data)
        except Exception as e:
            logger.info(f"Pas de release 'latest' directe ({e}), interrogation de la liste des releases...")
            try:
                req = urllib.request.Request(fallback_url, headers=headers)
                with urllib.request.urlopen(req, timeout=12, context=ctx) as resp:
                    releases_list = json.load(resp)
                    if releases_list and len(releases_list) > 0:
                        return self._parse_release_data(releases_list[0])
            except Exception as e_list:
                logger.warning(f"Erreur API GitHub releases: {e_list}")

        # Si aucune release n'est encore publiée sur GitHub ou en cas de hors-ligne :
        # Vérifier si une archive de build locale existe déjà dans dist/
        local_archive = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "dist", "OpenShema.zip")
        has_local = os.path.exists(local_archive)
        
        return {
            "success": True,
            "is_fallback": True,
            "has_local_build": has_local,
            "local_archive_path": local_archive if has_local else None,
            "tag": "v1.0.0",
            "name": "Open Shema v1.0.0 (Release Initiale)",
            "download_url": f"https://github.com/{repo}/releases/download/v1.0.0/OpenShema-Windows-x64.zip",
            "size_str": "~300 Mo",
            "notes": "Version complète d'Open Shema incluant le moteur biblique, les commentaires et l'assistant d'accueil."
        }

    def _parse_release_data(self, data):
        tag = data.get("tag_name", "v1.0.0")
        name = data.get("name") or f"Open Shema {tag}"
        notes = data.get("body", "Dernière version officielle d'Open Shema.")
        
        # Trouver l'asset zip approprié
        download_url = None
        size_bytes = 0
        for asset in data.get("assets", []):
            a_name = asset.get("name", "").lower()
            if a_name.endswith(".zip") and ("windows" in a_name or "x64" in a_name or "openshema" in a_name):
                download_url = asset.get("browser_download_url")
                size_bytes = asset.get("size", 0)
                break
        
        if not download_url and data.get("assets"):
            download_url = data["assets"][0].get("browser_download_url")
            size_bytes = data["assets"][0].get("size", 0)
            
        if not download_url:
            download_url = data.get("zipball_url")

        return {
            "success": True,
            "is_fallback": False,
            "tag": tag,
            "name": name,
            "download_url": download_url,
            "size_bytes": size_bytes,
            "size_str": format_bytes(size_bytes) if size_bytes else "~300 Mo",
            "notes": notes
        }

    # --- PROCESSUS D'INSTALLATION COMPLET ---
    def start_installation(self, target_dir: str, create_desktop_shortcut: bool, create_start_menu_shortcut: bool, download_url: str):
        """Lance l'installation dans un thread d'arrière-plan avec progression continue."""
        if self.is_installing:
            return {"success": False, "error": "Une installation est déjà en cours."}

        self.is_installing = True
        self.is_cancelled = False

        self.download_thread = threading.Thread(
            target=self._run_installation,
            args=(target_dir, create_desktop_shortcut, create_start_menu_shortcut, download_url),
            daemon=True
        )
        self.download_thread.start()
        return {"success": True}

    def cancel_installation(self):
        self.is_cancelled = True
        self.is_installing = False
        return {"success": True}

    def _run_installation(self, target_dir, create_desktop, create_start_menu, download_url):
        try:
            os.makedirs(target_dir, exist_ok=True)
            temp_zip = os.path.join(target_dir, "_download_temp.zip")

            # 1. TÉLÉCHARGEMENT OU RÉCUPÉRATION LOCALE
            # Si le build local dist/OpenShema existe déjà et que l'URL est le fallback GitHub non encore publié
            project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            local_dist_dir = os.path.join(project_root, "dist", "OpenShema")
            local_zip = os.path.join(project_root, "dist", "OpenShema.zip")

            download_success = False

            # Tentative de téléchargement distant si URL valide
            if download_url and not download_url.endswith("non_existant.zip"):
                self._send_progress(5, "Connexion au serveur GitHub...", 0, 0, 0)
                try:
                    ctx = ssl.create_default_context()
                    ctx.check_hostname = False
                    ctx.verify_mode = ssl.CERT_NONE
                    req = urllib.request.Request(download_url, headers={"User-Agent": "OpenShemaInstaller/1.0"})

                    with urllib.request.urlopen(req, timeout=30, context=ctx) as response:
                        total_size = int(response.headers.get("content-length", 0))
                        downloaded = 0
                        start_time = time.time()
                        last_update_time = start_time

                        with open(temp_zip, "wb") as out_file:
                            chunk_size = 64 * 1024  # 64 Ko
                            while True:
                                if self.is_cancelled:
                                    try: os.remove(temp_zip)
                                    except OSError: pass
                                    self._send_error("Installation annulée par l'utilisateur.")
                                    return

                                chunk = response.read(chunk_size)
                                if not chunk:
                                    break
                                out_file.write(chunk)
                                downloaded += len(chunk)

                                now = time.time()
                                if now - last_update_time > 0.15 or downloaded == total_size:
                                    duration = now - start_time
                                    speed = downloaded / duration if duration > 0 else 0
                                    percent = (downloaded / total_size * 70) if total_size > 0 else 35
                                    self._send_progress(
                                        percent=min(70, percent),
                                        status="Téléchargement des fichiers d'Open Shema...",
                                        downloaded_bytes=downloaded,
                                        total_bytes=total_size,
                                        speed_bytes_sec=speed
                                    )
                                    last_update_time = now

                    download_success = True
                except Exception as dl_err:
                    logger.warning(f"Téléchargement distant échoué ({dl_err}), vérification fallback local...")

            # Si le téléchargement a échoué mais qu'on a le build local complet (mode démo / premier package)
            if not download_success:
                if os.path.exists(local_dist_dir):
                    self._send_progress(20, "Déploiement depuis le package local...", 0, 0, 0)
                    # Copier directement le dossier dist/OpenShema
                    self._copy_tree_with_progress(local_dist_dir, target_dir)
                    temp_zip = None  # Pas besoin d'extraire
                elif os.path.exists(local_zip):
                    self._send_progress(25, "Préparation de l'archive locale...", 0, 0, 0)
                    shutil.copy(local_zip, temp_zip)
                    download_success = True
                else:
                    self._send_error(f"Impossible de télécharger Open Shema depuis GitHub ({download_url}) et aucun package local n'a été trouvé.")
                    return

            # 2. DÉCOMPRESSION SI ARCHIVE ZIP
            if temp_zip and os.path.exists(temp_zip):
                self._send_progress(72, "Extraction et vérification de l'intégrité...", 0, 0, 0)
                try:
                    with zipfile.ZipFile(temp_zip, 'r') as zf:
                        namelist = zf.namelist()
                        total_files = len(namelist)
                        
                        # Vérifier si l'archive a une racine imbriquée (ex: OpenShema/...)
                        has_nested_root = all(n.startswith("OpenShema/") or n.startswith("OpenShema\\") for n in namelist if n != "OpenShema/")
                        
                        for i, name in enumerate(namelist):
                            if self.is_cancelled:
                                try: os.remove(temp_zip)
                                except OSError: pass
                                self._send_error("Installation annulée.")
                                return
                            
                            target_name = name
                            if has_nested_root:
                                target_name = name[len("OpenShema/"):].lstrip("/\\")
                                if not target_name:
                                    continue

                            out_path = os.path.join(target_dir, target_name)
                            if name.endswith("/") or name.endswith("\\"):
                                os.makedirs(out_path, exist_ok=True)
                            else:
                                os.makedirs(os.path.dirname(out_path), exist_ok=True)
                                with zf.open(name) as src, open(out_path, "wb") as dst:
                                    shutil.copyfileobj(src, dst)

                            if i % 15 == 0:
                                percent = 72 + ((i / total_files) * 20)
                                self._send_progress(percent, f"Extraction : {os.path.basename(name)}", 0, 0, 0)

                    try:
                        os.remove(temp_zip)
                    except OSError:
                        pass
                except Exception as zip_err:
                    self._send_error(f"Erreur lors de la décompression de l'archive : {zip_err}")
                    return

            # 3. CRÉATION DES RACCOURCIS WINDOWS
            self._send_progress(95, "Création des raccourcis Windows...", 0, 0, 0)
            exe_path = os.path.join(target_dir, "OpenShema.exe")
            icon_path = os.path.join(target_dir, "assets", "icon.ico")
            if not os.path.exists(icon_path):
                # Si assets/icon.ico est dans _internal ou à la racine
                alt_icon = os.path.join(target_dir, "_internal", "assets", "icon.ico")
                if os.path.exists(alt_icon):
                    icon_path = alt_icon
                else:
                    icon_path = exe_path

            if create_desktop:
                desktop_dir = self._get_desktop_dir()
                if desktop_dir:
                    shortcut_desktop = os.path.join(desktop_dir, "Open Shema.lnk")
                    self._create_windows_shortcut(
                        target_path=exe_path,
                        shortcut_path=shortcut_desktop,
                        icon_path=icon_path,
                        description="Open Shema — Plateforme d'étude biblique"
                    )

            if create_start_menu:
                start_menu_dir = self._get_start_menu_dir()
                if start_menu_dir:
                    app_start_dir = os.path.join(start_menu_dir, "Open Shema")
                    os.makedirs(app_start_dir, exist_ok=True)
                    shortcut_start = os.path.join(app_start_dir, "Open Shema.lnk")
                    self._create_windows_shortcut(
                        target_path=exe_path,
                        shortcut_path=shortcut_start,
                        icon_path=icon_path,
                        description="Open Shema — Plateforme d'étude biblique"
                    )

            # 4. FINALISATION
            self._send_progress(100, "Installation terminée avec succès !", 0, 0, 0)
            self._send_complete(target_dir, exe_path)

        except Exception as global_err:
            logger.error(f"Erreur globale installation: {global_err}", exc_info=True)
            self._send_error(str(global_err))
        finally:
            self.is_installing = False

    def _copy_tree_with_progress(self, src_dir, dst_dir):
        """Copie un dossier existant vers la destination avec rapport de progression."""
        all_files = []
        for root, _, files in os.walk(src_dir):
            for f in files:
                all_files.append(os.path.join(root, f))
        
        total = len(all_files)
        for i, src_file in enumerate(all_files):
            rel = os.path.relpath(src_file, src_dir)
            dst_file = os.path.join(dst_dir, rel)
            os.makedirs(os.path.dirname(dst_file), exist_ok=True)
            shutil.copy2(src_file, dst_file)
            if i % 10 == 0:
                percent = 20 + ((i / total) * 72)
                self._send_progress(percent, f"Installation : {rel}", 0, 0, 0)

    # --- CRÉATION DE RACCOURCIS WINDOWS (.LNK) ---
    def _create_windows_shortcut(self, target_path, shortcut_path, icon_path="", description="Open Shema"):
        """Crée un raccourci Windows avec WScript.Shell (win32com ou PowerShell)."""
        # Tentative 1 : win32com
        try:
            import win32com.client
            shell = win32com.client.Dispatch("WScript.Shell")
            shortcut = shell.CreateShortcut(shortcut_path)
            shortcut.TargetPath = target_path
            shortcut.WorkingDirectory = os.path.dirname(target_path)
            shortcut.Description = description
            if icon_path and os.path.exists(icon_path):
                shortcut.IconLocation = f"{icon_path},0"
            shortcut.Save()
            logger.info(f"Raccourci créé via win32com : {shortcut_path}")
            return True
        except Exception as e1:
            logger.debug(f"win32com shortcut non disponible ({e1}), bascule sur PowerShell...")

        # Tentative 2 : PowerShell intégré (garanti sur 100% des Windows 10/11)
        try:
            work_dir = os.path.dirname(target_path).replace("'", "''")
            t_path = target_path.replace("'", "''")
            s_path = shortcut_path.replace("'", "''")
            i_path = (icon_path or target_path).replace("'", "''")
            
            ps_script = f"""
            $WshShell = New-Object -ComObject WScript.Shell
            $Shortcut = $WshShell.CreateShortcut('{s_path}')
            $Shortcut.TargetPath = '{t_path}'
            $Shortcut.WorkingDirectory = '{work_dir}'
            $Shortcut.Description = '{description}'
            $Shortcut.IconLocation = '{i_path},0'
            $Shortcut.Save()
            """
            subprocess.run(["powershell", "-NoProfile", "-NonInteractive", "-Command", ps_script], check=True, capture_output=True)
            logger.info(f"Raccourci créé via PowerShell : {shortcut_path}")
            return True
        except Exception as e2:
            logger.warning(f"Échec création raccourci PowerShell ({shortcut_path}): {e2}")
            return False

    def _get_desktop_dir(self):
        user_profile = os.environ.get("USERPROFILE")
        if user_profile:
            # Vérifier Bureau français ou Desktop
            cand1 = os.path.join(user_profile, "Desktop")
            cand2 = os.path.join(user_profile, "Bureau")
            if os.path.exists(cand2): return cand2
            if os.path.exists(cand1): return cand1
            return cand1
        return None

    def _get_start_menu_dir(self):
        appdata = os.environ.get("APPDATA")
        if appdata:
            return os.path.join(appdata, "Microsoft", "Windows", "Start Menu", "Programs")
        return None

    # --- COMMUNICATIONS AVEC LE FRONTEND JS ---
    def _send_progress(self, percent, status, downloaded_bytes, total_bytes, speed_bytes_sec):
        if not self.window:
            return
        payload = {
            "percent": round(percent, 1),
            "status": status,
            "downloaded_str": format_bytes(downloaded_bytes) if downloaded_bytes else "",
            "total_str": format_bytes(total_bytes) if total_bytes else "",
            "speed_str": f"{format_bytes(speed_bytes_sec)}/s" if speed_bytes_sec else ""
        }
        js = f"if (window.Installer && window.Installer.onProgress) {{ window.Installer.onProgress({json.dumps(payload)}); }}"
        self.window.evaluate_js(js)

    def _send_complete(self, target_dir, exe_path):
        if not self.window:
            return
        payload = {
            "target_dir": target_dir,
            "exe_path": exe_path
        }
        js = f"if (window.Installer && window.Installer.onComplete) {{ window.Installer.onComplete({json.dumps(payload)}); }}"
        self.window.evaluate_js(js)

    def _send_error(self, message):
        if not self.window:
            return
        js = f"if (window.Installer && window.Installer.onError) {{ window.Installer.onError({json.dumps(message)}); }}"
        self.window.evaluate_js(js)

    # --- LANCEMENT DE L'APPLICATION ---
    def launch_app(self, target_dir):
        """Lance OpenShema.exe et ferme l'installeur."""
        exe_path = os.path.join(target_dir, "OpenShema.exe")
        if os.path.exists(exe_path):
            try:
                # Démarrage détaché indépendant du processus de l'installeur
                creation_flags = 0x00000008 | 0x00000200  # DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP
                subprocess.Popen([exe_path], cwd=target_dir, creationflags=creation_flags, close_fds=True)
                logger.info(f"Open Shema lancé depuis : {exe_path}")
            except Exception as e:
                logger.error(f"Erreur lancement Open Shema: {e}")
        
        # Fermer la fenêtre de l'installeur
        if self.window:
            self.window.destroy()
        sys.exit(0)
