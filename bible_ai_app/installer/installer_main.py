"""
Open Shema — Point d'entrée du Programme d'Installation (PyWebView)
"""

import os
import sys
import threading
import ctypes

# 1. Définir impérativement l'AppUserModelID pour que la barre des tâches Windows affiche l'icône officielle
try:
    ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID("Similarly.OpenShema.Installer.v1")
except Exception:
    pass

import webview

# Assurer l'accès aux modules locaux
installer_dir = os.path.dirname(os.path.abspath(__file__))
if installer_dir not in sys.path:
    sys.path.insert(0, installer_dir)

from installer_api import InstallerAPI


def get_web_dir():
    """Résout le chemin du dossier web aussi bien en développement qu'en exécutable PyInstaller (--onefile)."""
    if hasattr(sys, '_MEIPASS'):
        return os.path.join(sys._MEIPASS, "web")
    return os.path.join(installer_dir, "web")


def get_icon_path():
    """Localise le fichier icon.ico officiel avec le logo Open Shema."""
    candidates = [
        os.path.join(get_web_dir(), "img", "icon.ico"),
        os.path.join(getattr(sys, '_MEIPASS', ''), "assets", "icon.ico"),
        os.path.join(getattr(sys, '_MEIPASS', ''), "web", "img", "icon.ico"),
        os.path.join(installer_dir, "assets", "icon.ico"),
        os.path.join(installer_dir, "web", "img", "icon.ico"),
        os.path.join(os.path.dirname(installer_dir), "assets", "icon.ico"),
        os.path.join(os.path.dirname(sys.executable), "assets", "icon.ico")
    ]
    for p in candidates:
        if p and os.path.exists(p):
            return os.path.abspath(p)
    return None


def apply_window_icon(window):
    """Applique l'icône officielle Open Shema au HWND et à la barre des tâches Windows."""
    try:
        icon_path = get_icon_path()
        if not icon_path:
            return

        # 1. WinForms Form Icon (.NET)
        if hasattr(window, 'native') and window.native:
            try:
                import System.Drawing
                window.native.Icon = System.Drawing.Icon(icon_path)
                window.native.ShowIcon = True
            except Exception:
                pass

            hwnd = None
            if hasattr(window.native, 'Handle'):
                hwnd = window.native.Handle.ToInt32()
            elif isinstance(window.native, int):
                hwnd = window.native

            # 2. Win32 WM_SETICON (sur le HWND natif pour la barre des tâches)
            if hwnd and ctypes:
                user32 = ctypes.windll.user32
                WM_SETICON = 0x0080
                ICON_SMALL = 0
                ICON_BIG = 1
                IMAGE_ICON = 1
                LR_LOADFROMFILE = 0x00000010
                LR_DEFAULTSIZE = 0x00000040

                hicon_big = user32.LoadImageW(0, icon_path, IMAGE_ICON, 0, 0, LR_LOADFROMFILE | LR_DEFAULTSIZE)
                hicon_small = user32.LoadImageW(0, icon_path, IMAGE_ICON, 16, 16, LR_LOADFROMFILE)
                if hicon_big:
                    user32.SendMessageW(hwnd, WM_SETICON, ICON_BIG, hicon_big)
                if hicon_small:
                    user32.SendMessageW(hwnd, WM_SETICON, ICON_SMALL, hicon_small)
    except Exception:
        pass


def main():
    web_dir = get_web_dir()
    index_html = os.path.join(web_dir, "index.html")

    api = InstallerAPI()

    # Centrage précis de la fenêtre sur l'écran principal
    width = 740
    height = 540
    x = None
    y = None
    try:
        if webview.screens and len(webview.screens) > 0:
            screen = webview.screens[0]
            x = max(0, (screen.width - width) // 2)
            y = max(0, (screen.height - height) // 2)
    except Exception:
        pass

    # Configuration de la fenêtre PyWebView (moderne, sans bordure native, draggable, centrée)
    window = webview.create_window(
        title="Installation d'Open Shema",
        url=index_html,
        js_api=api,
        width=width,
        height=height,
        x=x,
        y=y,
        resizable=False,
        frameless=True,
        easy_drag=True,
        text_select=False,
        background_color='#F8FAFC'
    )
    api._set_window(window)

    def on_window_shown(*args, **kwargs):
        apply_window_icon(window)
        # Répétition préventive pour s'assurer que WebView2 a fini d'initialiser son HWND
        threading.Timer(0.15, lambda: apply_window_icon(window)).start()
        threading.Timer(0.5, lambda: apply_window_icon(window)).start()
        threading.Timer(1.2, lambda: apply_window_icon(window)).start()

    window.events.shown += on_window_shown

    def handle_exception(exc_type, exc_value, exc_traceback):
        import logging
        logging.getLogger("OpenShemaInstaller").critical("Exception non interceptée :", exc_info=(exc_type, exc_value, exc_traceback))

    sys.excepthook = handle_exception

    webview.start(debug=False)


if __name__ == "__main__":
    main()
