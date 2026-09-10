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
        "--hidden-import=pymupdf",
        "--hidden-import=fitz",
        "--hidden-import=core.paths",
        "webview_app.py"
    ]

    # Mise à l'écart temporaire des gravures Vigouroux (193 Mo) pour ne pas gonfler le build de base
    vigouroux_img_dir = os.path.join(current_dir, "web", "img", "vigouroux")
    temp_vigouroux_dir = os.path.join(current_dir, "web", "img", "_vigouroux_staged_temp")
    has_vigouroux_backup = False

    if os.path.exists(vigouroux_img_dir):
        print("-> Mise à l'écart temporaire des 2 437 gravures Vigouroux (téléchargeables via le Store)...")
        try:
            if os.path.exists(temp_vigouroux_dir):
                shutil.rmtree(temp_vigouroux_dir)
            os.rename(vigouroux_img_dir, temp_vigouroux_dir)
            os.makedirs(vigouroux_img_dir, exist_ok=True)
            has_vigouroux_backup = True
        except Exception as e:
            print(f"Avertissement mise à l'écart Vigouroux : {e}")

    try:
        print(f"-> Lancement de PyInstaller avec la commande :\n{' '.join(args)}\n")
        result = subprocess.run(args)
    finally:
        # Restauration immédiate et garantie du dossier des gravures sources
        if has_vigouroux_backup and os.path.exists(temp_vigouroux_dir):
            if os.path.exists(vigouroux_img_dir):
                try:
                    shutil.rmtree(vigouroux_img_dir)
                except Exception:
                    pass
            os.rename(temp_vigouroux_dir, vigouroux_img_dir)
            print("-> Restauration locale du dossier web/img/vigouroux effectuée.")

    if result.returncode == 0:
        print("-> Copie des données applicatives embarquées (data/)...")
        dist_app_dir = os.path.join(current_dir, "dist", "OpenShema")
        src_data_dir = os.path.join(current_dir, "data")
        internal_data_dir = os.path.join(dist_app_dir, "_internal", "data")
        root_data_dir = os.path.join(dist_app_dir, "data")

        os.makedirs(internal_data_dir, exist_ok=True)
        os.makedirs(root_data_dir, exist_ok=True)

        # 1. Fichiers permanents lourds copiés UNIQUEMENT dans _internal/data/ (évite 93 Mo de doublon !)
        essential_files = [
            "biblical_places.db",                 # Cartes géospatiales
            "original_languages.db",              # Textes originaux complets (Hébreu AT + Grec NT avec morpho & Strong)
            "strong_lexicon.json",                # Lexique James Strong Hébreu & Grec
            "bailly_lexicon.json",                # Dictionnaire Grec-Français Anatole Bailly
            "illustrations_processed_cache.json", # Index rapide des illustrations
            "catalog.json",                       # Catalogue officiel Open Shema Store & First Run Wizard
            "bibles_registry.json",               # Métadonnées canoniques
            "gospel_parallels.json",              # Harmonie des évangiles
            "french_accent_map.json",             # Traitement linguistique
            "french_words.json",
            "config.example.json",
            "bibleproject_fr.json"
        ]
        for fname in essential_files:
            src_f = os.path.join(src_data_dir, fname)
            if os.path.exists(src_f):
                shutil.copy2(src_f, os.path.join(internal_data_dir, fname))

        # Dossier permanent des récits / illustrations (4 275 récits) dans _internal/data/
        src_illus = os.path.join(src_data_dir, "illustrations")
        dest_illus = os.path.join(internal_data_dir, "illustrations")
        if os.path.exists(src_illus):
            if os.path.exists(dest_illus):
                shutil.rmtree(dest_illus)
            shutil.copytree(src_illus, dest_illus)

        # 2. Configuration et dossiers de travail initialisés dans les deux emplacements
        for target_dir in [internal_data_dir, root_data_dir]:
            src_cfg_ex = os.path.join(src_data_dir, "config.example.json")
            dest_cfg = os.path.join(target_dir, "config.json")
            if os.path.exists(src_cfg_ex) and not os.path.exists(dest_cfg):
                shutil.copy2(src_cfg_ex, dest_cfg)

            lib_path = os.path.join(target_dir, "library.json")
            if not os.path.exists(lib_path):
                with open(lib_path, "w", encoding="utf-8") as lf:
                    lf.write("{}\n")

            for empty_sub in ["bibles", "commentaires", "theology", "dictionaries", "sermons", "notes", "conversations", "covers"]:
                os.makedirs(os.path.join(target_dir, empty_sub), exist_ok=True)

        # Création du dossier cible pour les gravures Vigouroux dans _internal/web/img/vigouroux
        os.makedirs(os.path.join(dist_app_dir, "_internal", "web", "img", "vigouroux"), exist_ok=True)

        # Copie de assets/ à la racine de dist/OpenShema pour les icônes de raccourcis
        src_assets = os.path.join(current_dir, "assets")
        dest_assets = os.path.join(dist_app_dir, "assets")
        if os.path.exists(src_assets):
            if os.path.exists(dest_assets):
                shutil.rmtree(dest_assets)
            shutil.copytree(src_assets, dest_assets)

        print("\n[SUCCÈS] Build généré avec succès dans 'dist/OpenShema/' !")
        print("Pour tester : dist\\OpenShema\\OpenShema.exe\n")
    else:
        print(f"\n[ERREUR] La compilation a échoué avec le code de sortie {result.returncode}")
        sys.exit(result.returncode)

if __name__ == "__main__":
    build()
