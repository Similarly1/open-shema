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

    # Configuration de la fenêtre PyWebView (moderne, sans bordure native, draggable)
    window = webview.create_window(
        title="Installation d'Open Shema",
        url=index_html,
        js_api=api,
        width=740,
        height=540,
        resizable=False,
        frameless=True,
        easy_drag=True,
        text_select=False,
        background_color='#F8FAFC'
    )
    api.set_window(window)

    webview.start(debug=False)


if __name__ == "__main__":
    main()
