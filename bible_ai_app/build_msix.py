"""
Open Shema — Script de Packaging Windows Store (MSIX)

Génère automatiquement le paquet .msix officiel pour le Microsoft Partner Center :
1. Vérifie ou lance la compilation du moteur autonome OpenShema (PyInstaller).
2. Génère tous les assets graphiques requis par le Store (tuiles, logos carrés, splashscreen).
3. Produit le manifeste officiel AppxManifest.xml avec l'identité certifiée du Store.
4. Empaquette le tout via MakeAppx.exe (Windows SDK).
"""

import os
import sys
import glob
import shutil
import subprocess
from PIL import Image

# ── Identité Officielle Microsoft Partner Center ─────────────────────────────
PACKAGE_NAME = "OpenShema.OpenShema"
PUBLISHER_ID = "CN=EE79AB15-04CF-49DC-868E-EEEB85DD3708"
PUBLISHER_DISPLAY_NAME = "Open Shema"
DISPLAY_NAME = "Open Shema"
PACKAGE_VERSION = "0.2.0.0"  # Format Quad: Major.Minor.Build.Revision
STORE_ID = "9NXC16S8DHT3"
BG_COLOR = "#0F172A"

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
DIST_DIR = os.path.join(CURRENT_DIR, "dist")
APP_DIR = os.path.join(DIST_DIR, "OpenShema")
ASSETS_DIR = os.path.join(APP_DIR, "Assets")
OUTPUT_MSIX = os.path.join(DIST_DIR, "OpenShema.msix")


def find_makeappx() -> str:
    """Localise makeappx.exe sur le système (Windows SDK)."""
    # 1. Dans PATH
    which_cmd = shutil.which("makeappx.exe")
    if which_cmd and os.path.exists(which_cmd):
        return which_cmd

    # 2. Emplacements Windows Kits standards (x64)
    patterns = [
        r"C:\Program Files (x86)\Windows Kits\10\bin\*\x64\makeappx.exe",
        r"C:\Program Files\Windows Kits\10\bin\*\x64\makeappx.exe",
        r"C:\Program Files (x86)\Windows Kits\10\App Certification Kit\makeappx.exe"
    ]
    for pattern in patterns:
        matches = sorted(glob.glob(pattern), reverse=True)
        if matches:
            return matches[0]

    raise FileNotFoundError(
        "L'outil makeappx.exe est introuvable. Veuillez vérifier l'installation du Windows SDK 10/11."
    )


def generate_store_assets():
    """Génère les icônes et visuels aux dimensions requises par le Microsoft Store."""
    os.makedirs(ASSETS_DIR, exist_ok=True)

    # Image source haute résolution
    src_img_path = os.path.join(CURRENT_DIR, "web", "img", "logo open shema.png")
    if not os.path.exists(src_img_path):
        src_img_path = os.path.join(CURRENT_DIR, "assets", "icon.ico")

    if not os.path.exists(src_img_path):
        raise FileNotFoundError(f"Image source introuvable : {src_img_path}")

    print(f"-> Génération des visuels Store depuis {os.path.basename(src_img_path)}...")
    source = Image.open(src_img_path).convert("RGBA")

    # Hex to RGBA pour le fond
    bg_hex = BG_COLOR.lstrip("#")
    bg_rgba = tuple(int(bg_hex[i:i+2], 16) for i in (0, 2, 4)) + (255,)

    # 1. Tuiles carrées simples (redimensionnement haute qualité)
    square_specs = {
        "Square44x44Logo.png": 44,
        "Square71x71Logo.png": 71,
        "Square150x150Logo.png": 150,
        "Square310x310Logo.png": 310,
        "StoreLogo.png": 50
    }
    for filename, size in square_specs.items():
        resized = source.resize((size, size), Image.Resampling.LANCZOS)
        out_p = os.path.join(ASSETS_DIR, filename)
        resized.save(out_p, format="PNG")

    # 2. Format large Wide310x150Logo (310x150, icône centrée sur fond de marque)
    wide_img = Image.new("RGBA", (310, 150), bg_rgba)
    icon_h = 110
    aspect = source.width / source.height
    icon_w = int(icon_h * aspect)
    scaled_icon = source.resize((icon_w, icon_h), Image.Resampling.LANCZOS)
    x_pos = (310 - icon_w) // 2
    y_pos = (150 - icon_h) // 2
    wide_img.paste(scaled_icon, (x_pos, y_pos), scaled_icon)
    wide_img.save(os.path.join(ASSETS_DIR, "Wide310x150Logo.png"), format="PNG")

    # 3. Écran de démarrage SplashScreen (620x300, icône centrée sur fond)
    splash_img = Image.new("RGBA", (620, 300), bg_rgba)
    splash_icon_h = 160
    splash_icon_w = int(splash_icon_h * aspect)
    scaled_splash_icon = source.resize((splash_icon_w, splash_icon_h), Image.Resampling.LANCZOS)
    sx_pos = (620 - splash_icon_w) // 2
    sy_pos = (300 - splash_icon_h) // 2
    splash_img.paste(scaled_splash_icon, (sx_pos, sy_pos), scaled_splash_icon)
    splash_img.save(os.path.join(ASSETS_DIR, "SplashScreen.png"), format="PNG")

    print(f"-> 7 visuels générés avec succès dans {ASSETS_DIR}")


def generate_appx_manifest():
    """Crée le fichier AppxManifest.xml conforme au schéma Windows 10/11."""
    manifest_path = os.path.join(APP_DIR, "AppxManifest.xml")

    content = f"""<?xml version="1.0" encoding="utf-8"?>
<Package
  xmlns="http://schemas.microsoft.com/appx/manifest/foundation/windows10"
  xmlns:uap="http://schemas.microsoft.com/appx/manifest/uap/windows10"
  xmlns:rescap="http://schemas.microsoft.com/appx/manifest/foundation/windows10/restrictedcapabilities"
  IgnorableNamespaces="uap rescap">

  <Identity
    Name="{PACKAGE_NAME}"
    Publisher="{PUBLISHER_ID}"
    Version="{PACKAGE_VERSION}"
    ProcessorArchitecture="x64" />

  <Properties>
    <DisplayName>{DISPLAY_NAME}</DisplayName>
    <PublisherDisplayName>{PUBLISHER_DISPLAY_NAME}</PublisherDisplayName>
    <Logo>Assets\\StoreLogo.png</Logo>
    <Description>Open Shema — Lecteur et Assistant d'Étude Biblique et Exégétique</Description>
  </Properties>

  <Dependencies>
    <TargetDeviceFamily Name="Windows.Desktop" MinVersion="10.0.17763.0" MaxVersionTested="10.0.26100.0" />
  </Dependencies>

  <Resources>
    <Resource Language="fr-FR" />
    <Resource Language="en-US" />
  </Resources>

  <Applications>
    <Application Id="App"
      Executable="OpenShema.exe"
      EntryPoint="Windows.FullTrustApplication">
      <uap:VisualElements
        DisplayName="{DISPLAY_NAME}"
        Description="Open Shema — Lecteur et Assistant d'Étude Biblique"
        BackgroundColor="{BG_COLOR}"
        Square150x150Logo="Assets\\Square150x150Logo.png"
        Square44x44Logo="Assets\\Square44x44Logo.png">
        <uap:DefaultTile
          Wide310x150Logo="Assets\\Wide310x150Logo.png"
          Square310x310Logo="Assets\\Square310x310Logo.png"
          Square71x71Logo="Assets\\Square71x71Logo.png">
          <uap:ShowNameOnTiles>
            <uap:ShowOn Tile="square150x150Logo" />
            <uap:ShowOn Tile="wide310x150Logo" />
          </uap:ShowNameOnTiles>
        </uap:DefaultTile>
        <uap:SplashScreen Image="Assets\\SplashScreen.png" BackgroundColor="{BG_COLOR}" />
      </uap:VisualElements>
    </Application>
  </Applications>

  <Capabilities>
    <rescap:Capability Name="runFullTrust" />
  </Capabilities>
</Package>
"""
    with open(manifest_path, "w", encoding="utf-8") as f:
        f.write(content)

    print(f"-> Manifeste Store généré avec succès dans {manifest_path}")


def build_msix(rebuild_binary=False):
    """Orchestre la création intégrale du paquet MSIX."""
    print("==================================================")
    print("  Construction du Paquet Microsoft Store (MSIX)")
    print("  Application : Open Shema")
    print(f"  Identité   : {PACKAGE_NAME}")
    print(f"  Version    : {PACKAGE_VERSION}")
    print("==================================================")

    makeappx_exe = find_makeappx()
    print(f"-> MakeAppx détecté : {makeappx_exe}")

    exe_path = os.path.join(APP_DIR, "OpenShema.exe")
    if rebuild_binary or not os.path.exists(exe_path):
        print("-> Compilation préalable du binaire OpenShema via build_executable.py...")
        from build_executable import build as run_pyinstaller
        run_pyinstaller()

    if not os.path.exists(exe_path):
        raise FileNotFoundError(f"L'exécutable compilé est introuvable : {exe_path}")

    # Injection du marqueur de Store pour identification immédiate
    store_marker = os.path.join(APP_DIR, "_store_marker")
    with open(store_marker, "w", encoding="utf-8") as f:
        f.write(STORE_ID)

    # Génération des assets et du manifest
    generate_store_assets()
    generate_appx_manifest()

    # Appel de MakeAppx pack
    if os.path.exists(OUTPUT_MSIX):
        try:
            os.remove(OUTPUT_MSIX)
        except OSError:
            pass

    cmd = [
        makeappx_exe,
        "pack",
        "/v",
        "/h", "SHA256",
        "/o",
        "/d", APP_DIR,
        "/p", OUTPUT_MSIX
    ]
    print(f"\n-> Lancement de l'empaquetage MSIX :\n{' '.join(cmd)}\n")
    res = subprocess.run(cmd)

    if res.returncode == 0 and os.path.exists(OUTPUT_MSIX):
        size_mb = os.path.getsize(OUTPUT_MSIX) / (1024 * 1024)
        print("\n==================================================")
        print(" [SUCCÈS] Paquet MSIX créé avec succès !")
        print(f" Emplacement : {OUTPUT_MSIX}")
        print(f" Taille      : {size_mb:.1f} Mo")
        print("==================================================")
        print("-> Ce fichier est prêt à être téléversé dans votre Espace Développeur (Partner Center).")
        print("-> Microsoft se charge de le signer cryptographiquement pour les utilisateurs finaux.\n")
    else:
        print(f"\n[ERREUR] MakeAppx a échoué avec le code de sortie {res.returncode}")
        sys.exit(res.returncode)


if __name__ == "__main__":
    rebuild = "--rebuild" in sys.argv
    build_msix(rebuild_binary=rebuild)
