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
        
        # État de progression exposé au frontend (polling 100% thread-safe)
        self.progress_state = {
            "percent": 0,
            "status": "Initialisation...",
            "downloaded_str": "",
            "total_str": "",
            "speed_str": "",
            "is_complete": False,
            "error": None,
            "target_dir": "",
            "exe_path": ""
        }

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
        
        drive = os.path.splitdrive(default_install_dir)[0] or "C:"
        drive_path = drive + "\\"
        free_space_bytes = 0
        try:
            free_space_bytes = shutil.disk_usage(drive_path).free
        except Exception:
            free_space_bytes = 10 * 1024 * 1024 * 1024

        return {
            "default_path": default_install_dir,
            "free_space_bytes": free_space_bytes,
            "free_space_str": format_bytes(free_space_bytes),
            "required_space_str": "~350 Mo",
            "drive": drive
        }

    def browse_folder(self, current_path=""):
        """Ouvre un sélecteur de dossier Windows natif sans charger Tkinter."""
        # 1. Via PyWebView create_file_dialog si disponible
        try:
            import webview
            if self.window:
                res = self.window.create_file_dialog(webview.FOLDER_DIALOG, directory=current_path or None)
                if res and len(res) > 0:
                    selected = res[0]
                    if not selected.lower().endswith("openshema"):
                        selected = os.path.join(selected, "OpenShema")
                    return {"selected": selected}
        except Exception as e:
            logger.debug(f"PyWebView create_file_dialog: {e}")

        # 2. Via Windows Shell COM natif (zéro bibliothèque externe)
        try:
            import win32com.client
            shell = win32com.client.Dispatch("Shell.Application")
            folder = shell.BrowseForFolder(0, "Sélectionnez le dossier d'installation d'Open Shema", 0, current_path or 0)
            if folder:
                selected = folder.Self.Path
                if not selected.lower().endswith("openshema"):
                    selected = os.path.join(selected, "OpenShema")
                return {"selected": selected}
        except Exception as e:
            logger.debug(f"Shell.Application BrowseForFolder: {e}")

        # 3. Via PowerShell FolderBrowserDialog natif
        try:
            ps_cmd = '[System.Reflection.Assembly]::LoadWithPartialName("System.Windows.Forms") | Out-Null; $f = New-Object System.Windows.Forms.FolderBrowserDialog; if ($f.ShowDialog() -eq "OK") { Write-Output $f.SelectedPath }'
            proc = subprocess.run(["powershell", "-NoProfile", "-NonInteractive", "-Command", ps_cmd], capture_output=True, text=True)
            selected = proc.stdout.strip()
            if selected:
                if not selected.lower().endswith("openshema"):
                    selected = os.path.join(selected, "OpenShema")
                return {"selected": selected}
        except Exception as e:
            logger.debug(f"PowerShell FolderBrowserDialog: {e}")

        return {"selected": current_path}

    def get_install_progress(self):
        """Méthode de polling appelée par le frontend pour suivre la progression sans blocage."""
        return self.progress_state

    # --- GITHUB RELEASES API & DÉTECTION DU PACKAGE ---
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
            with urllib.request.urlopen(req, timeout=10, context=ctx) as resp:
                data = json.load(resp)
                return self._parse_release_data(data)
        except Exception as e:
            logger.info(f"Pas de release 'latest' ({e}), tentative liste des releases...")
            try:
                req = urllib.request.Request(fallback_url, headers=headers)
                with urllib.request.urlopen(req, timeout=10, context=ctx) as resp:
                    releases_list = json.load(resp)
                    if releases_list and len(releases_list) > 0:
                        return self._parse_release_data(releases_list[0])
            except Exception as e_list:
                logger.warning(f"Erreur API GitHub releases: {e_list}")

        # Si aucune release n'est trouvée sur GitHub : recherche d'une archive locale
        local_pkg = self._find_local_package()
        has_local = bool(local_pkg)
        
        return {
            "success": True,
            "is_fallback": True,
            "has_local_build": has_local,
            "local_archive_path": local_pkg if has_local else None,
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

    def _find_local_package(self):
        """Trouve l'archive zip ou le dossier OpenShema local."""
        exe_dir = os.path.dirname(os.path.abspath(sys.executable))
        curr_dir = os.path.abspath(os.getcwd())
        file_dir = os.path.dirname(os.path.abspath(__file__))

        candidates = [
            # À côté de l'exécutable (ex: dist/OpenShema.zip)
            os.path.join(exe_dir, "OpenShema.zip"),
            os.path.join(exe_dir, "OpenShema"),
            # Dans dist/ par rapport au dossier courant
            os.path.join(curr_dir, "dist", "OpenShema.zip"),
            os.path.join(curr_dir, "dist", "OpenShema"),
            os.path.join(curr_dir, "OpenShema.zip"),
            # En mode dev par rapport à installer/
            os.path.join(os.path.dirname(file_dir), "dist", "OpenShema.zip"),
            os.path.join(os.path.dirname(file_dir), "dist", "OpenShema"),
        ]

        for cand in candidates:
            if os.path.exists(cand):
                return cand
        return None

    # --- PROCESSUS D'INSTALLATION COMPLET ---
    def start_installation(self, target_dir: str, create_desktop_shortcut: bool, create_start_menu_shortcut: bool, download_url: str):
        """Lance l'installation dans un thread d'arrière-plan avec progression continue."""
        if self.is_installing:
            return {"success": False, "error": "Une installation est déjà en cours."}

        self.is_installing = True
        self.is_cancelled = False

        self.progress_state = {
            "percent": 0,
            "status": "Démarrage de l'installation...",
            "downloaded_str": "",
            "total_str": "",
            "speed_str": "",
            "is_complete": False,
            "error": None,
            "target_dir": target_dir,
            "exe_path": os.path.join(target_dir, "OpenShema.exe")
        }

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
        self.progress_state["error"] = "Installation annulée par l'utilisateur."
        return {"success": True}

    def _run_installation(self, target_dir, create_desktop, create_start_menu, download_url):
        try:
            os.makedirs(target_dir, exist_ok=True)
            temp_zip = os.path.join(target_dir, "_download_temp.zip")

            download_success = False

            # 1. TENTATIVE DE TÉLÉCHARGEMENT GITHUB
            if download_url and not download_url.endswith("non_existant.zip"):
                self._update_progress(5, "Connexion au serveur GitHub...")
                try:
                    ctx = ssl.create_default_context()
                    ctx.check_hostname = False
                    ctx.verify_mode = ssl.CERT_NONE
                    req = urllib.request.Request(download_url, headers={"User-Agent": "OpenShemaInstaller/1.0"})

                    with urllib.request.urlopen(req, timeout=15, context=ctx) as response:
                        total_size = int(response.headers.get("content-length", 0))
                        downloaded = 0
                        start_time = time.time()
                        last_update_time = start_time

                        with open(temp_zip, "wb") as out_file:
                            chunk_size = 64 * 1024
                            while True:
                                if self.is_cancelled:
                                    try: os.remove(temp_zip)
                                    except OSError: pass
                                    return

                                chunk = response.read(chunk_size)
                                if not chunk:
                                    break
                                out_file.write(chunk)
                                downloaded += len(chunk)

                                now = time.time()
                                if now - last_update_time > 0.12 or downloaded == total_size:
                                    duration = now - start_time
                                    speed = downloaded / duration if duration > 0 else 0
                                    percent = (downloaded / total_size * 70) if total_size > 0 else 35
                                    self._update_progress(
                                        percent=min(70, percent),
                                        status="Téléchargement des fichiers d'Open Shema...",
                                        downloaded_bytes=downloaded,
                                        total_bytes=total_size,
                                        speed_bytes_sec=speed
                                    )
                                    last_update_time = now

                    download_success = True
                except Exception as dl_err:
                    logger.info(f"Téléchargement distant non disponible ({dl_err}), bascule sur le package local...")

            # 2. FALLBACK PACKAGE LOCAL SI LE REPO GITHUB N'A PAS ENCORE D'ASSET EN LIGNE
            if not download_success:
                local_pkg = self._find_local_package()
                if local_pkg:
                    if os.path.isdir(local_pkg):
                        self._update_progress(15, "Déploiement depuis le package local...")
                        self._copy_tree_with_progress(local_pkg, target_dir)
                        temp_zip = None
                    elif os.path.isfile(local_pkg) and local_pkg.endswith(".zip"):
                        self._update_progress(20, "Préparation de l'archive...")
                        shutil.copy(local_pkg, temp_zip)
                        download_success = True
                else:
                    err_msg = "La release n'est pas encore publiée sur GitHub et aucune archive locale n'a été trouvée dans le dossier."
                    self.progress_state["error"] = err_msg
                    self.is_installing = False
                    return

            # 3. EXTRACTION DE L'ARCHIVE ZIP
            if temp_zip and os.path.exists(temp_zip):
                self._update_progress(70, "Extraction des composants d'Open Shema...")
                try:
                    with zipfile.ZipFile(temp_zip, 'r') as zf:
                        infolist = zf.infolist()
                        total_bytes = sum(info.file_size for info in infolist)
                        extracted_bytes = 0
                        start_time = time.time()
                        last_update = start_time
                        
                        has_nested_root = all(n.filename.startswith("OpenShema/") or n.filename.startswith("OpenShema\\") for n in infolist if n.filename != "OpenShema/")

                        for info in infolist:
                            if self.is_cancelled:
                                try: os.remove(temp_zip)
                                except OSError: pass
                                return
                            
                            target_name = info.filename
                            if has_nested_root:
                                target_name = info.filename[len("OpenShema/"):].lstrip("/\\")
                                if not target_name:
                                    continue

                            out_path = os.path.join(target_dir, target_name)
                            if info.is_dir():
                                os.makedirs(out_path, exist_ok=True)
                            else:
                                os.makedirs(os.path.dirname(out_path), exist_ok=True)
                                with zf.open(info) as src, open(out_path, "wb") as dst:
                                    shutil.copyfileobj(src, dst)

                            extracted_bytes += info.file_size
                            now = time.time()
                            if (now - last_update > 0.1) or (extracted_bytes == total_bytes):
                                elapsed = now - start_time
                                speed = extracted_bytes / elapsed if elapsed > 0 else 0
                                percent = 70 + ((extracted_bytes / total_bytes) * 23) if total_bytes > 0 else 70
                                self._update_progress(
                                    percent=percent,
                                    status=f"Extraction : {os.path.basename(info.filename)}",
                                    downloaded_bytes=extracted_bytes,
                                    total_bytes=total_bytes,
                                    speed_bytes_sec=speed
                                )
                                last_update = now

                    try:
                        os.remove(temp_zip)
                    except OSError:
                        pass
                except Exception as zip_err:
                    self.progress_state["error"] = f"Erreur décompression : {zip_err}"
                    self.is_installing = False
                    return

            # 4. CRÉATION DES RACCOURCIS WINDOWS
            self._update_progress(94, "Création des raccourcis Windows...")
            exe_path = os.path.join(target_dir, "OpenShema.exe")
            icon_path = os.path.join(target_dir, "assets", "icon.ico")
            if not os.path.exists(icon_path):
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

            # 5. FINALISATION
            self._update_progress(100, "Installation terminée avec succès !")
            self.progress_state["is_complete"] = True
            self.progress_state["target_dir"] = target_dir
            self.progress_state["exe_path"] = exe_path

        except Exception as global_err:
            logger.error(f"Erreur globale installation: {global_err}", exc_info=True)
            self.progress_state["error"] = str(global_err)
        finally:
            self.is_installing = False

    def _copy_tree_with_progress(self, src_dir, dst_dir):
        """Copie un dossier existant vers la destination avec rapport précis de volume et vitesse."""
        all_files = []
        total_bytes = 0
        for root, _, files in os.walk(src_dir):
            for f in files:
                full_p = os.path.join(root, f)
                all_files.append(full_p)
                try:
                    total_bytes += os.path.getsize(full_p)
                except OSError:
                    pass
        
        total_files = len(all_files)
        copied_bytes = 0
        start_time = time.time()
        last_update = start_time

        for i, src_file in enumerate(all_files):
            if self.is_cancelled:
                return
            rel = os.path.relpath(src_file, src_dir)
            dst_file = os.path.join(dst_dir, rel)
            os.makedirs(os.path.dirname(dst_file), exist_ok=True)
            shutil.copy2(src_file, dst_file)

            try:
                copied_bytes += os.path.getsize(src_file)
            except OSError:
                pass

            now = time.time()
            if (now - last_update > 0.1) or (i == total_files - 1):
                elapsed = now - start_time
                speed = copied_bytes / elapsed if elapsed > 0 else 0
                percent = 15 + ((copied_bytes / total_bytes) * 78) if total_bytes > 0 else 15 + ((i / total_files) * 78)
                self._update_progress(
                    percent=percent,
                    status=f"Installation : {rel}",
                    downloaded_bytes=copied_bytes,
                    total_bytes=total_bytes,
                    speed_bytes_sec=speed
                )
                last_update = now

    def _create_windows_shortcut(self, target_path, shortcut_path, icon_path="", description="Open Shema"):
        """Crée un raccourci Windows avec WScript.Shell (win32com ou PowerShell)."""
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

    def _update_progress(self, percent, status, downloaded_bytes=0, total_bytes=0, speed_bytes_sec=0):
        self.progress_state["percent"] = round(percent, 1)
        self.progress_state["status"] = status
        if downloaded_bytes:
            self.progress_state["downloaded_str"] = format_bytes(downloaded_bytes)
        if total_bytes:
            self.progress_state["total_str"] = format_bytes(total_bytes)
        if speed_bytes_sec:
            self.progress_state["speed_str"] = f"{format_bytes(speed_bytes_sec)}/s"

    def launch_app(self, target_dir):
        """Lance OpenShema.exe et ferme l'installeur."""
        exe_path = os.path.join(target_dir, "OpenShema.exe")
        if os.path.exists(exe_path):
            try:
                creation_flags = 0x00000008 | 0x00000200
                subprocess.Popen([exe_path], cwd=target_dir, creationflags=creation_flags, close_fds=True)
                logger.info(f"Open Shema lancé depuis : {exe_path}")
            except Exception as e:
                logger.error(f"Erreur lancement Open Shema: {e}")
        
        if self.window:
            self.window.destroy()
        sys.exit(0)
