import os
import sys
import logging
import traceback

os.environ["ANONYMIZED_TELEMETRY"] = "False"
os.environ["CHROMA_TELEMETRY"] = "False"
logging.getLogger("chromadb").setLevel(logging.CRITICAL)
logging.getLogger("posthog").setLevel(logging.CRITICAL)

# Ajout du chemin pour permettre les imports absolus depuis la racine du projet
_ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.append(_ROOT)

def _purge_stale_pyc_caches(root: str):
    """
    Supprime les dossiers __pycache__ dont au moins un .pyc est plus ancien
    que son fichier source .py correspondant.
    Evite les crashs causés par du bytecode compilé depuis une version obsolète du source.
    """
    import glob, importlib.util
    for pyc_path in glob.glob(os.path.join(root, "**", "__pycache__", "*.pyc"), recursive=True):
        # Retrouver le .py source correspondant
        cache_dir = os.path.dirname(pyc_path)
        pkg_dir = os.path.dirname(cache_dir)
        basename = os.path.basename(pyc_path).split(".")[0]  # ex: center_panel
        py_path = os.path.join(pkg_dir, basename + ".py")
        if os.path.exists(py_path):
            py_mtime = os.path.getmtime(py_path)
            pyc_mtime = os.path.getmtime(pyc_path)
            if py_mtime > pyc_mtime:
                try:
                    os.remove(pyc_path)
                except OSError:
                    pass

_purge_stale_pyc_caches(_ROOT)

from core.database import VectorDB
from gui.app import App

def main():
    try:
        print("Initialisation de la base de données...")
        db = VectorDB(persist_directory="./data/chroma_db")
        
        print("Lancement de l'interface Open Shema...")
        app = App(db)
        app.mainloop()
    except Exception as e:
        err_msg = traceback.format_exc()
        print(f"ERREUR FATALE AU LANCEMENT : {err_msg}")
        try:
            with open("error.log", "w", encoding="utf-8") as f:
                f.write(err_msg)
        except Exception:
            pass
        try:
            import tkinter as tk
            from tkinter import messagebox
            root = tk.Tk()
            root.withdraw()
            messagebox.showerror("Erreur de lancement", f"Une erreur est survenue lors du démarrage :\n\n{e}\n\nConsultez le fichier error.log pour plus de détails.")
            root.destroy()
        except Exception:
            pass

if __name__ == "__main__":
    main()
