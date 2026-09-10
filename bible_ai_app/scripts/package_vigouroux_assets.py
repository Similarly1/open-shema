"""
Script de packaging des ressources du dictionnaire Vigouroux (1912).
1. Extrait l'index `vigouroux_illustrations.json` depuis l'historique Git.
2. Compresse les 2 437 gravures de `web/img/vigouroux/` en `vigouroux_images.zip`.
3. Prépare le tout dans `dist_assets/vigouroux/` pour mise en ligne sur open-shema-data.
"""

import os
import sys
import json
import zipfile
import subprocess
import shutil

def package_vigouroux():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    app_dir = os.path.dirname(script_dir)
    os.chdir(app_dir)

    print("==========================================================")
    print("  Packaging des Assets Vigouroux pour open-shema-data")
    print("==========================================================")

    out_dir = os.path.join(app_dir, "dist_assets", "vigouroux")
    os.makedirs(out_dir, exist_ok=True)

    # 1. Extraction / Vérification de vigouroux_illustrations.json
    json_dest = os.path.join(out_dir, "vigouroux_illustrations.json")
    local_dict_json = os.path.join(app_dir, "data", "dictionaries", "vigouroux_illustrations.json")

    if os.path.exists(local_dict_json):
        print("-> Copie de vigouroux_illustrations.json existant...")
        shutil.copy2(local_dict_json, json_dest)
    else:
        print("-> Extraction de vigouroux_illustrations.json depuis l'historique Git (commit 85726a0~1)...")
        try:
            cmd = ["git", "show", "85726a0~1:bible_ai_app/data/dictionaries/vigouroux_illustrations.json"]
            raw = subprocess.check_output(cmd, stderr=subprocess.DEVNULL)
            with open(json_dest, "wb") as f:
                f.write(raw)
            # Valider le JSON
            with open(json_dest, "r", encoding="utf-8") as f:
                data = json.load(f)
            print(f"   [OK] {len(data)} entrées indexées dans vigouroux_illustrations.json")
            # Sauvegarder aussi dans data/dictionaries pour usage local éventuel
            os.makedirs(os.path.dirname(local_dict_json), exist_ok=True)
            shutil.copy2(json_dest, local_dict_json)
        except Exception as e:
            print(f"   [ERREUR] Impossible d'extraire depuis git: {e}")
            return False

    # 2. Compression de web/img/vigouroux en vigouroux_images.zip
    img_dir = os.path.join(app_dir, "web", "img", "vigouroux")
    zip_dest = os.path.join(out_dir, "vigouroux_images.zip")

    if not os.path.exists(img_dir):
        print(f"   [ERREUR] Dossier d'images introuvable : {img_dir}")
        return False

    files = [f for f in os.listdir(img_dir) if os.path.isfile(os.path.join(img_dir, f))]
    print(f"-> Compression de {len(files)} images PNG vers {zip_dest}...")

    # Utiliser 7-zip si disponible pour un multithreading ultra rapide, sinon zipfile standard
    seven_zip = shutil.which("7z")
    if seven_zip:
        print("   (Utilisation de 7-Zip multithread...)")
        if os.path.exists(zip_dest):
            os.remove(zip_dest)
        subprocess.run([seven_zip, "a", "-tzip", "-mx=3", "-mmt=on", "-y", zip_dest, os.path.join(img_dir, "*")], check=True)
    else:
        print("   (Utilisation du module python zipfile...)")
        with zipfile.ZipFile(zip_dest, "w", zipfile.ZIP_DEFLATED, compresslevel=3) as zf:
            for idx, fn in enumerate(files, 1):
                fpath = os.path.join(img_dir, fn)
                zf.write(fpath, arcname=fn)
                if idx % 500 == 0 or idx == len(files):
                    print(f"   {idx}/{len(files)} compressés...")

    zip_sz_mb = os.path.getsize(zip_dest) / (1024 * 1024)
    print(f"\n[SUCCÈS] Archive prête : {zip_dest} ({zip_sz_mb:.2f} MB)")
    print(f"[SUCCÈS] Index JSON prêt : {json_dest}")
    print("\nCes deux fichiers peuvent être déposés sur le dépôt https://github.com/Similarly1/open-shema-data")
    print("dans les Releases GitHub (tag: v1.0.0 ou assets).\n")
    return True

if __name__ == "__main__":
    package_vigouroux()
