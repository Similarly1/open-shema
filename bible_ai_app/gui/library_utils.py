import os
import json
import shutil

def load_books_metadata():
    path = 'data/library.json'
    registry = {}
    if os.path.exists(path):
        try:
            with open(path, 'r', encoding='utf-8') as f:
                registry = json.load(f)
        except Exception:
            pass
            
    return registry

def recover_books_metadata():
    path = 'data/library.json'
    registry = load_books_metadata()
    changed = False

    # 1. Vérifier les Bibles JSON dans data/bibles/
    bibles_dir = 'data/bibles'
    if os.path.exists(bibles_dir):
        for entry in os.listdir(bibles_dir):
            entry_path = os.path.join(bibles_dir, entry)
            if os.path.isdir(entry_path):
                # Trouver si déjà dans registry
                found = False
                for name, meta in registry.items():
                    if meta.get("folder_name") == entry or name.lower().replace(" ", "_") == entry.lower():
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
                                "version_code": d.get("version", "BIBLE"),
                                "total_books": len(json_files),
                                "embedding_model": "study_library",
                                "active": True
                            }
                            changed = True
                        except Exception as e:
                            print(f"Erreur recovery Bible JSON {entry}: {e}")

    # 2. Vérifier les collections ChromaDB
    try:
        import chromadb
        client = chromadb.PersistentClient(path='./data/chroma_db')
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
        print(f"Error during auto-recovery: {e}")
        
    if changed:
        save_books_metadata(registry)
        
    return registry

def save_books_metadata(data):
    os.makedirs('data', exist_ok=True)
    with open('data/library.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
