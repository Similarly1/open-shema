"""
Open Shema — Script de Packaging de l'Installeur (PyInstaller)
Compile installer_main.py en un exécutable autonome OpenShemaSetup.exe (--onefile).
"""

import os
import sys
import subprocess
import shutil

def build():
    installer_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(installer_dir)
    os.chdir(project_root)

    print("==========================================================")
    print("  Construction de l'Installeur Open Shema (OpenShemaSetup)")
    print("==========================================================")

    web_data = os.path.join("installer", "web")
    icon_path = os.path.join("assets", "icon.ico")
    main_script = os.path.join("installer", "installer_main.py")

    args = [
        sys.executable,
        "-m", "PyInstaller",
        "--name=OpenShemaSetup",
        "--noconsole",
        "--onefile",
        "--clean",
        "--noconfirm",
        "--paths=installer",
        f"--add-data={web_data};web",
        "--hidden-import=installer_api",
        "--hidden-import=win32com",
        "--hidden-import=win32com.client",
        "--hidden-import=webview",
        # Exclusions ciblées de bibliothèques lourdes inutiles à l'installeur
        "--exclude-module=tkinter",
        "--exclude-module=_tkinter",
        "--exclude-module=tcl",
        "--exclude-module=tk",
        "--exclude-module=unittest",
        "--exclude-module=sqlite3",
        "--exclude-module=_sqlite3",
        "--exclude-module=cryptography",
        "--exclude-module=bcrypt",
        "--exclude-module=email",
        "--exclude-module=xmlrpc",
        "--exclude-module=setuptools",
        "--exclude-module=pip",
        "--exclude-module=jinja2",
        "--exclude-module=difflib",
        "--exclude-module=pydoc",
        "--exclude-module=doctest",
    ]

    if os.path.exists(icon_path):
        args.append(f"--icon={icon_path}")

    args.append(main_script)

    print(f"-> Commande de compilation :\n{' '.join(args)}\n")
    res = subprocess.run(args)
    if res.returncode == 0:
        print("\n[SUCCÈS] Installeur compilé avec succès !")
        print(f"Exécutable disponible : {os.path.abspath(os.path.join('dist', 'OpenShemaSetup.exe'))}\n")
    else:
        print(f"\n[ERREUR] La compilation a échoué avec le code {res.returncode}")
        sys.exit(res.returncode)

if __name__ == "__main__":
    build()
