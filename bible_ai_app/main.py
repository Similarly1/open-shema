import os
import logging
os.environ["ANONYMIZED_TELEMETRY"] = "False"
os.environ["CHROMA_TELEMETRY"] = "False"
logging.getLogger("chromadb.telemetry.product.posthog").setLevel(logging.CRITICAL)

import sys

# Ajout du chemin pour permettre les imports absolus depuis la racine du projet
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from core.database import VectorDB
from gui.app import App

def main():
    print("Initialisation de la base de données ChromaDB...")
    db = VectorDB(persist_directory="./data/chroma_db")
    
    print("Lancement de l'interface graphique Bible AI Study...")
    app = App(db)
    app.mainloop()

if __name__ == "__main__":
    main()
