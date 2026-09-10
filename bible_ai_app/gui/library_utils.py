import os
import sys
import json
import logging
import shutil

logger = logging.getLogger(__name__)

from core.paths import (
    get_user_data_dir,
    get_bundle_data_dir,
    get_user_data_path,
    get_bundle_data_path,
    resolve_data_path,
    ensure_data_directories
)

# Chemin absolu calculé depuis l'emplacement du fichier — indépendant du CWD
_APP_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Cache en mémoire pour éviter de relire library.json à chaque navigation de verset.
# Invalidé automatiquement par save_books_metadata().
_LIBRARY_CACHE: dict | None = None

def get_library_path() -> str:
    """Résout l'emplacement d'écriture de library.json dans l'espace utilisateur."""
    return get_user_data_path("library.json")

def load_books_metadata() -> dict:
    global _LIBRARY_CACHE
    if _LIBRARY_CACHE is not None:
        return _LIBRARY_CACHE
    registry = {}
    path = resolve_data_path("library.json")
    if not os.path.exists(path):
        ensure_data_directories()
        path = resolve_data_path("library.json")

    if os.path.exists(path):
        try:
            with open(path, 'r', encoding='utf-8') as f:
                registry = json.load(f)
        except Exception as _silent_e:
            logger.debug("Erreur lecture library.json : %s", _silent_e)

    # Filet de sécurité : vérifier si un backup complet existe et fusionner si besoin
    backup_path = resolve_data_path("library_user_full_backup.json")
    if not os.path.exists(backup_path):
        # Chercher également dans la racine de l'app si non trouvé dans les chemins résolus
        app_bkp = os.path.join(_APP_ROOT, "data", "library_user_full_backup.json")
        if os.path.exists(app_bkp):
            backup_path = app_bkp

    if os.path.exists(backup_path):
        try:
            with open(backup_path, 'r', encoding='utf-8') as f:
                backup_registry = json.load(f)
            if isinstance(backup_registry, dict) and len(backup_registry) > len(registry):
                for k, v in backup_registry.items():
                    if k not in registry:
                        registry[k] = v
                save_books_metadata(registry)
        except Exception as _bkp_e:
            logger.debug("Erreur lecture backup library: %s", _bkp_e)
    
    # Si le registre est introuvable ou vide, lancer automatiquement la récupération
    if not registry:
        registry = recover_books_metadata()

    _LIBRARY_CACHE = registry
    return registry

def invalidate_library_cache():
    """Force le rechargement de library.json au prochain appel de load_books_metadata()."""
    global _LIBRARY_CACHE
    _LIBRARY_CACHE = None

def recover_books_metadata():
    path = get_library_path()
    registry = {}
    if os.path.exists(path):
        try:
            with open(path, 'r', encoding='utf-8') as f:
                registry = json.load(f)
        except Exception:
            registry = {}
    changed = False

    # 1. Vérifier les Bibles JSON dans bibles/ (espace utilisateur et bundle)
    bibles_dirs = []
    u_b = get_user_data_path('bibles')
    if os.path.exists(u_b):
        bibles_dirs.append(u_b)
    b_b = get_bundle_data_path('bibles')
    if os.path.exists(b_b) and b_b not in bibles_dirs:
        bibles_dirs.append(b_b)

    for bibles_dir in bibles_dirs:
        for entry in os.listdir(bibles_dir):
            entry_path = os.path.join(bibles_dir, entry)
            if os.path.isdir(entry_path):
                # Trouver si déjà dans registry
                found = False
                for name, meta in registry.items():
                    if meta.get("folder_name") == entry or name.lower().replace(" ", "_") == entry.lower() or meta.get("version_code") == entry:
                        found = True
                        break
                if not found:
                    # Lire le premier fichier pour inspecter
                    json_files = sorted([f for f in os.listdir(entry_path) if f.endswith(".json")])
                    if json_files:
                        try:
                            with open(os.path.join(entry_path, json_files[0]), 'r', encoding='utf-8') as fp:
                                d = json.load(fp)
                            v_name = d.get("version_fullname") or d.get("version") or entry
                            b_name = "Segond 21" if d.get("version") == "S21" else (d.get("name") or entry)
                            registry[b_name] = {
                                "title": b_name,
                                "author": "Société Biblique de Genève" if d.get("version") == "S21" else "",
                                "description": v_name,
                                "year": "2007" if d.get("version") == "S21" else "",
                                "cover_path": None,
                                "type": "Bible",
                                "format": "json",
                                "folder_name": entry,
                                "version_code": d.get("version", entry),
                                "total_books": len(json_files),
                                "embedding_model": "study_library",
                                "active": True
                            }
                            changed = True
                        except Exception as e:
                            logger.error(f"Erreur recovery Bible JSON {entry}: {e}")

    # 2. Vérifier les collections ChromaDB si disponibles
    try:
        chroma_path = resolve_data_path('chroma_db')
        if os.path.exists(chroma_path):
            import chromadb
            client = chromadb.PersistentClient(path=chroma_path)
            for col in client.list_collections():
                if col.name == "study_library" or col.name.startswith("bible_study_"):
                    results = col.get(include=['metadatas'])
                    metas = results.get('metadatas', [])
                    for m in metas:
                        if m and 'name' in m:
                            name = m['name']
                            if name not in registry:
                                model = "study_library"
                                if col.name.startswith("bible_study_"):
                                    model = col.name.replace("bible_study_", "").replace("_", "-")
                                    
                                registry[name] = {
                                    "title": m.get("title", name),
                                    "author": m.get("author", ""),
                                    "description": m.get("description", ""),
                                    "year": m.get("year", ""),
                                    "cover_path": m.get("cover_path", None),
                                    "type": m.get("type", "Bible"),
                                    "embedding_model": model,
                                    "active": True
                                }
                                changed = True
    except Exception as e:
        logger.debug(f"Error during auto-recovery chroma: {e}")
        
    if changed:
        save_books_metadata(registry)
        
    return registry

def save_books_metadata(data):
    global _LIBRARY_CACHE
    path = get_library_path()
    dir_name = os.path.dirname(path)
    if dir_name:
        os.makedirs(dir_name, exist_ok=True)
    try:
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logger.error(f"Erreur lors de la sauvegarde de {path}: {e}")
    _LIBRARY_CACHE = None  # Invalider le cache après toute écriture
