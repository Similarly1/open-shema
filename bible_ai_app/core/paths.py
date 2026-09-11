"""
core/paths.py — Gestionnaire centralisé des chemins Open Shema.

Garantit la compatibilité totale entre :
1. Le mode développement Git local (utilise bible_ai_app/data/).
2. Le mode binaire portable (si un fichier .portable est présent à côté de l'exécutable).
3. Le mode installateur standard Windows (%LOCALAPPDATA%/OpenShema).
4. Le mode conteneurisé Microsoft Store MSIX (dossier d'installation en lecture seule stricte).

Thread-safe et robuste.
"""

import os
import sys
import shutil
import logging
from typing import Optional

logger = logging.getLogger("core_paths")

_IS_PACKAGE_CACHED: Optional[bool] = None
_USER_DATA_DIR_CACHED: Optional[str] = None
_BUNDLE_DATA_DIR_CACHED: Optional[str] = None


def is_running_as_package() -> bool:
    """
    Détecte de manière fiable si le processus courant s'exécute au sein
    d'un conteneur d'application Windows MSIX / AppX (Desktop Bridge).
    Interroge l'API native GetCurrentPackageFullName de kernel32.
    """
    global _IS_PACKAGE_CACHED
    if _IS_PACKAGE_CACHED is not None:
        return _IS_PACKAGE_CACHED

    # Forçage possible par variable d'environnement ou marqueur
    if os.environ.get("OPENSHEMA_STORE_MODE", "").lower() in ("1", "true", "yes"):
        _IS_PACKAGE_CACHED = True
        return True

    # Marqueur optionnel présent dans le bundle MSIX
    bundle_dir = get_bundle_dir()
    if os.path.exists(os.path.join(bundle_dir, "AppxManifest.xml")) or os.path.exists(os.path.join(bundle_dir, "_store_marker")):
        _IS_PACKAGE_CACHED = True
        return True

    if os.name != "nt":
        _IS_PACKAGE_CACHED = False
        return False

    try:
        import ctypes
        from ctypes import wintypes

        kernel32 = ctypes.windll.kernel32
        GetCurrentPackageFullName = getattr(kernel32, "GetCurrentPackageFullName", None)
        if not GetCurrentPackageFullName:
            _IS_PACKAGE_CACHED = False
            return False

        length = wintypes.UINT(0)
        # 122 = ERROR_INSUFFICIENT_BUFFER -> Indique que le processus APPARTIENT à un package!
        # 15700 (0x3D54) = APPMODEL_ERROR_NO_PACKAGE
        rc = GetCurrentPackageFullName(ctypes.byref(length), None)
        _IS_PACKAGE_CACHED = (rc == 122)
    except Exception as e:
        logger.debug("Erreur détection GetCurrentPackageFullName : %s", e)
        _IS_PACKAGE_CACHED = False

    return _IS_PACKAGE_CACHED


def is_frozen() -> bool:
    """Indique si l'application s'exécute compilée (PyInstaller) ou via l'interpréteur Python."""
    return getattr(sys, "frozen", False)


def get_bundle_dir() -> str:
    """
    Retourne la racine du bundle de l'application (en lecture seule une fois compilée).
    - Mode PyInstaller frozen : dossier contenant OpenShema.exe
    - Mode développement : dossier racine bible_ai_app/
    """
    if is_frozen():
        return os.path.dirname(os.path.abspath(sys.executable))
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def get_bundle_data_dir() -> str:
    """
    Retourne le dossier data/ embarqué dans le bundle d'installation.
    Contient les bases permanentes (original_languages.db, strong_lexicon.json, etc.).
    """
    global _BUNDLE_DATA_DIR_CACHED
    if _BUNDLE_DATA_DIR_CACHED is not None:
        return _BUNDLE_DATA_DIR_CACHED

    b_dir = get_bundle_dir()
    candidates = []
    if is_frozen():
        candidates.append(os.path.join(b_dir, "_internal", "data"))
        candidates.append(os.path.join(b_dir, "data"))
    if hasattr(sys, "_MEIPASS"):
        candidates.append(os.path.join(sys._MEIPASS, "data"))
    candidates.append(os.path.join(b_dir, "data"))

    for c in candidates:
        if os.path.exists(c):
            _BUNDLE_DATA_DIR_CACHED = c
            return c

    default_data = os.path.join(b_dir, "data")
    _BUNDLE_DATA_DIR_CACHED = default_data
    return default_data


def get_user_data_dir() -> str:
    """
    Retourne le dossier des données utilisateur modifiables (lecture / écriture).
    
    Règles de résolution :
    1. Mode développement Python pur (non-frozen) :
       Utilise le dossier local data/ de l'arborescence du projet pour ne pas polluer l'OS.
    2. Mode portable (fichier .portable présent à côté de l'exécutable) :
       Utilise le dossier data/ à côté de l'exécutable.
    3. Mode MSIX Store ou Installation Windows :
       Utilise %LOCALAPPDATA%\\OpenShema\\data (ou %APPDATA%\\OpenShema\\data).
    """
    global _USER_DATA_DIR_CACHED
    if _USER_DATA_DIR_CACHED is not None:
        return _USER_DATA_DIR_CACHED

    # 1. En mode développement non compilé, conserver data/ local
    if not is_frozen() and not os.environ.get("OPENSHEMA_FORCE_APPDATA"):
        dev_data = os.path.join(get_bundle_dir(), "data")
        os.makedirs(dev_data, exist_ok=True)
        _USER_DATA_DIR_CACHED = dev_data
        return dev_data

    # 2. Mode portable : présence du marqueur .portable OU présence d'un dossier data/ local à côté de l'exécutable (hors conteneur MSIX)
    b_dir = get_bundle_dir()
    portable_marker = os.path.join(b_dir, ".portable")
    local_data = os.path.join(b_dir, "data")
    if (os.path.exists(portable_marker) or os.path.exists(local_data)) and not is_running_as_package():
        os.makedirs(local_data, exist_ok=True)
        _USER_DATA_DIR_CACHED = local_data
        return local_data

    # 3. Mode Standard ou Store MSIX -> %LOCALAPPDATA%\OpenShema\data
    local_appdata = os.environ.get("LOCALAPPDATA")
    if not local_appdata:
        appdata = os.environ.get("APPDATA")
        if appdata:
            local_appdata = appdata
        else:
            local_appdata = os.path.expanduser("~")

    user_data = os.path.join(local_appdata, "OpenShema", "data")
    os.makedirs(user_data, exist_ok=True)
    _USER_DATA_DIR_CACHED = user_data
    return user_data


def get_user_data_path(*subpaths: str) -> str:
    """Retourne un chemin absolu à l'intérieur du dossier des données utilisateur."""
    return os.path.join(get_user_data_dir(), *subpaths)


def get_bundle_data_path(*subpaths: str) -> str:
    """Retourne un chemin absolu à l'intérieur du dossier data embarqué (bundle)."""
    return os.path.join(get_bundle_data_dir(), *subpaths)


def resolve_data_path(*subpaths: str) -> str:
    """
    Résolution hiérarchique d'un fichier de données :
    1. Vérifie si le fichier existe dans user_data_dir (ex: version modifiée/téléchargée).
    2. Sinon, vérifie s'il existe dans bundle_data_dir (ex: version fournie de base).
    3. Si inexistant, renvoie l'emplacement cible dans user_data_dir (prêt pour écriture).
    """
    user_p = get_user_data_path(*subpaths)
    if os.path.exists(user_p):
        return user_p

    bundle_p = get_bundle_data_path(*subpaths)
    if os.path.exists(bundle_p):
        return bundle_p

    return user_p


def ensure_data_directories() -> None:
    """
    Initialise les dossiers et fichiers nécessaires dans user_data_dir au premier lancement.
    Copie le config.example.json vers config.json si absent.
    Crée un library.json minimal si absent.
    """
    u_dir = get_user_data_dir()
    os.makedirs(u_dir, exist_ok=True)

    # Création des sous-dossiers de données
    for sub in [
        "bibles",
        "commentaires",
        "theology",
        "dictionaries",
        "personal_books",
        "sermons",
        "notes",
        "covers",
        "conversations",
        "illustrations",
        "mindmap_images",
        "articles"
    ]:
        os.makedirs(os.path.join(u_dir, sub), exist_ok=True)

    # 1. Initialisation de config.json
    cfg_target = os.path.join(u_dir, "config.json")
    if not os.path.exists(cfg_target):
        cfg_example = resolve_data_path("config.example.json")
        if os.path.exists(cfg_example):
            try:
                shutil.copy2(cfg_example, cfg_target)
            except Exception as e:
                logger.warning("Échec de copie config.example.json : %s", e)

    # 2. Initialisation de library.json
    lib_target = os.path.join(u_dir, "library.json")
    if not os.path.exists(lib_target):
        bundle_lib = get_bundle_data_path("library.json")
        if os.path.exists(bundle_lib) and os.path.getsize(bundle_lib) > 2:
            try:
                shutil.copy2(bundle_lib, lib_target)
            except Exception as e:
                logger.warning("Échec de copie library.json : %s", e)
        else:
            try:
                with open(lib_target, "w", encoding="utf-8") as lf:
                    lf.write("{}\n")
            except Exception as e:
                logger.warning("Échec d'initialisation library.json : %s", e)
