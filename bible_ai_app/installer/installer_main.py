"""
Open Shema — Point d'entrée du Programme d'Installation (PyWebView)
"""

import os
import sys
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

    def handle_exception(exc_type, exc_value, exc_traceback):
        import logging
        logging.getLogger("OpenShemaInstaller").critical("Exception non interceptée :", exc_info=(exc_type, exc_value, exc_traceback))

    sys.excepthook = handle_exception

    webview.start(debug=False)


if __name__ == "__main__":
    main()
