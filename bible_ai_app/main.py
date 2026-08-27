import os
import sys
import logging
import traceback

os.environ["ANONYMIZED_TELEMETRY"] = "False"
os.environ["CHROMA_TELEMETRY"] = "False"
logging.getLogger("chromadb").setLevel(logging.CRITICAL)
logging.getLogger("posthog").setLevel(logging.CRITICAL)

# Ajout du chemin pour permettre les imports absolus depuis la racine du projet
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

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
