"""
Open Shema — Script de Packaging Windows (PyInstaller)
Permet de générer l'exécutable autonome OpenShema.exe avec tous ses assets web et dépendances.
"""

import os
import sys
import shutil
import subprocess

def build():
    current_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(current_dir)

    print("==================================================")
    print("  Construction de l'exécutable Open Shema (Windows)")
    print("==================================================")

    # Fermeture de tout processus OpenShema en cours pour éviter les verrous de fichiers
    os.system("taskkill /f /im OpenShema.exe >nul 2>&1")
    os.system("taskkill /f /im OpenShemaSetup.exe >nul 2>&1")

    # Nettoyage des précédents builds
    for folder in ["build", "dist"]:
        fpath = os.path.join(current_dir, folder)
        if os.path.exists(fpath):
            print(f"-> Nettoyage de {folder}/...")
            try:
                shutil.rmtree(fpath)
            except Exception as e:
                print(f"Avertissement lors du nettoyage : {e}")

    # Configuration des arguments PyInstaller
    args = [
        sys.executable,
        "-m", "PyInstaller",
        "--name=OpenShema",
        "--noconsole",
        "--onedir",
        "--clean",
        "--noconfirm",
        # Inclure les assets web statiques et graphiques
        "--add-data=web;web",
        "--add-data=assets;assets",
        f"--icon={os.path.join('assets', 'icon.ico')}",
        # Imports cachés critiques pour uvicorn / fastapi / pywebview
        "--hidden-import=uvicorn.logging",
        "--hidden-import=uvicorn.loops",
        "--hidden-import=uvicorn.loops.auto",
        "--hidden-import=uvicorn.protocols",
        "--hidden-import=uvicorn.protocols.http",
        "--hidden-import=uvicorn.protocols.http.auto",
        "--hidden-import=uvicorn.protocols.websockets",
        "--hidden-import=uvicorn.protocols.websockets.auto",
        "--hidden-import=uvicorn.lifespans",
        "--hidden-import=uvicorn.lifespans.on",
        "--hidden-import=uvicorn.lifespans.off",
        "--hidden-import=engineio.async_drivers.threading",
        "--hidden-import=sqlite3",
        "--hidden-import=webview",
        "webview_app.py"
    ]

    print(f"-> Lancement de PyInstaller avec la commande :\n{' '.join(args)}\n")
    result = subprocess.run(args)

    if result.returncode == 0:
        print("-> Copie des données applicatives embarquées (data/)...")
        dist_app_dir = os.path.join(current_dir, "dist", "OpenShema")
        src_data_dir = os.path.join(current_dir, "data")

        for dest_data_dir in [
            os.path.join(dist_app_dir, "data"),
            os.path.join(dist_app_dir, "_internal", "data")
        ]:
            os.makedirs(dest_data_dir, exist_ok=True)

            essential_files = [
                "biblical_places.db",
                "illustrations_processed_cache.json",
                "library.json",
                "catalog.json",
                "bibles_registry.json",
                "gospel_parallels.json",
                "french_accent_map.json",
                "french_words.json",
                "strong_lexicon.json",
                "bailly_lexicon.json",
                "calmet_dict.json",
                "vigouroux_dict.json",
                "ccel_theology_books.json",
                "gutenberg_theology_books.json",
                "logos_community_books.json",
                "config.example.json",
                "config.json",
                "user_profile.json"
            ]
            for fname in essential_files:
                src_f = os.path.join(src_data_dir, fname)
                if os.path.exists(src_f):
                    shutil.copy2(src_f, os.path.join(dest_data_dir, fname))

            # 1. Bibles officielles du pack gratuit Open Shema Data uniquement
            dest_bibles = os.path.join(dest_data_dir, "bibles")
            os.makedirs(dest_bibles, exist_ok=True)
            pack_bibles = ["LSG", "DARBY", "OST", "STAPFER", "GIG", "NCL"]
            src_bibles = os.path.join(src_data_dir, "bibles")
            for b_name in pack_bibles:
                s_dir = os.path.join(src_bibles, b_name)
                d_dir = os.path.join(dest_bibles, b_name)
                if os.path.exists(s_dir):
                    if os.path.exists(d_dir):
                        shutil.rmtree(d_dir)
                    shutil.copytree(s_dir, d_dir)

            # 2. Commentaires du pack officiel (Calvin)
            dest_comm = os.path.join(dest_data_dir, "commentaires")
            os.makedirs(dest_comm, exist_ok=True)
            for calvin_f in ["comm_calvin.sqlite", "comm_comm_calvin.sqlite"]:
                src_c = os.path.join(src_data_dir, "commentaires", calvin_f)
                if os.path.exists(src_c):
                    shutil.copy2(src_c, os.path.join(dest_comm, "comm_calvin.sqlite"))

            # 3. Autres sous-dossiers du pack
            for sub in ["covers", "dictionaries", "theology"]:
                src_sub = os.path.join(src_data_dir, sub)
                if os.path.exists(src_sub):
                    dest_sub = os.path.join(dest_data_dir, sub)
                    if os.path.exists(dest_sub):
                        shutil.rmtree(dest_sub)
                    shutil.copytree(src_sub, dest_sub)

        print("\n[SUCCÈS] Build généré avec succès dans 'dist/OpenShema/' !")
        print("Pour tester : dist\\OpenShema\\OpenShema.exe\n")
    else:
        print(f"\n[ERREUR] La compilation a échoué avec le code de sortie {result.returncode}")
        sys.exit(result.returncode)

if __name__ == "__main__":
    build()
