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
        print("\n[SUCCÈS] Build généré avec succès dans 'dist/OpenShema/' !")
        print("Pour tester : dist\\OpenShema\\OpenShema.exe\n")
    else:
        print(f"\n[ERREUR] La compilation a échoué avec le code de sortie {result.returncode}")
        sys.exit(result.returncode)

if __name__ == "__main__":
    build()
