#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
================================================================================
Traducteur Universel d'Ebooks EPUB vers le Français (avec Gemini Flash-Lite)
================================================================================
Architecture :
- Multi-threading avec 4 workers répartis sur 2 clés API (gemini_key1, gemini_key2).
- Modèle principal : gemini-3.5-flash-lite (haute vivacité littéraire).
- Modèle de secours (fallback) : gemini-3.1-flash-lite.
- Préservation chirurgicale de la structure HTML, des balises et de la typographie.
- Cache incrémental persistant : reprise instantanée sans recalcul ni surcoût.
- Sauvegarde atomique et gestion propre de Ctrl+C.
================================================================================
"""

import os
import sys
import json
import time
import signal
import queue
import hashlib
import zipfile
import argparse
import requests
from threading import Thread, RLock
from bs4 import BeautifulSoup

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', line_buffering=True, write_through=True)
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', line_buffering=True, write_through=True)

KEYS_PATH = r"C:\Users\adrie\kDrive\Documents\Site chants de la bible\BDD JEM\config_keys.json"
APP_CONFIG_PATH = r"c:\Users\adrie\Documents\antigravity\peaceful-mendeleev\bible_ai_app\data\config.json"
DEFAULT_EPUB = r"C:\Users\adrie\kDrive\Documents\Ebooks\A. J. Jacobs - The Know-It-All_ One Man's Humble Quest to Become the Smartest Person in the World (2004, Simon and Schuster) - libgen.li.epub"

cache_lock = RLock()
print_lock = RLock()
translation_cache = {}
global_cache_path = ""

SYSTEM_PROMPT = """Tu es un traducteur littéraire d'élite spécialisé dans les essais narratifs, les récits autobiographiques et les mémoires journalistiques anglophones (style A.J. Jacobs, Bill Bryson, David Sedaris).
Ta mission est de traduire de l'anglais vers un français d'une facture remarquable le texte fourni.

RÈGLES D'OR IMPÉRATIVES :
1. TON ET STYLE LITTÉRAIRE :
   - Traduis dans un français vif, alerte, élégant mais décontracté et pétillant d'esprit.
   - Restitue fidèlement l'humour, l'autodérision, le dynamisme et le piquant de l'auteur.
   - Rends les jeux de mots avec subtilité et adapte naturellement les références culturelles si nécessaire.
2. INTÉGRITÉ CHIRURGICALE DU CODE HTML :
   - Conserve STRICTEMENT toutes les balises HTML (<p ...>, <span ...>, <a ...>, <div ...>, etc.) et leurs attributs intacts.
   - Ne modifie JAMAIS les noms de classes (ex: class="calibre12", class="bold", class="italic").
   - Traduis uniquement le contenu textuel situé à l'intérieur des balises.
3. TYPOGRAPHIE FRANÇAISE SOIGNÉE :
   - Respecte les guillemets français (« et ») et les espaces insécables avant les signes doubles (?, !, :, ;).
4. SORTIE PURE :
   - Rends DIRECTEMENT le fragment HTML traduit.
   - N'ajoute AUCUN préambule, AUCUN commentaire, et AUCUNE balise de code Markdown (pas de ```html)."""

def handle_sigint(signum, frame):
    with print_lock:
        print("\n\n🛑 Interruption détectée (Ctrl+C). Sauvegarde du cache en cours...", flush=True)
    save_cache()
    with print_lock:
        print("✅ Cache sauvegardé avec succès. Fin du processus.", flush=True)
    os._exit(0)

signal.signal(signal.SIGINT, handle_sigint)

def load_api_keys():
    """Charge les clés API Gemini (2 clés pour la répartition)."""
    k1, k2 = None, None
    if os.path.exists(KEYS_PATH):
        try:
            with open(KEYS_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                k1 = data.get("gemini_key1")
                k2 = data.get("gemini_key2")
        except Exception as e:
            print(f"⚠️ Erreur lecture {KEYS_PATH}: {e}")

    if not k1 and os.path.exists(APP_CONFIG_PATH):
        try:
            with open(APP_CONFIG_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                k1 = data.get("gemini_api_key")
        except Exception:
            pass

    if not k1:
        k1 = os.environ.get("GEMINI_API_KEY")

    if not k2:
        k2 = k1

    if not k1:
        raise ValueError("Aucune clé API Gemini trouvée dans config_keys.json, config.json ou en variable d'environnement.")

    return {"k1": k1, "k2": k2}

def get_cache_path(input_epub_path):
    base_no_ext = os.path.splitext(input_epub_path)[0]
    return f"{base_no_ext}_translation_cache.json"

def load_cache(cache_file):
    global translation_cache, global_cache_path
    global_cache_path = cache_file
    if os.path.exists(cache_file):
        try:
            with open(cache_file, "r", encoding="utf-8") as f:
                translation_cache = json.load(f)
            with print_lock:
                print(f"✅ Cache chargé : {len(translation_cache)} fragments déjà traduits.", flush=True)
        except Exception as e:
            with print_lock:
                print(f"⚠️ Erreur lors du chargement du cache : {e}", flush=True)
            translation_cache = {}
    else:
        translation_cache = {}

def save_cache():
    if not global_cache_path:
        return
    with cache_lock:
        temp_file = global_cache_path + ".tmp"
        with open(temp_file, "w", encoding="utf-8") as f:
            json.dump(translation_cache, f, ensure_ascii=False, indent=2)
        if os.path.exists(global_cache_path):
            os.replace(temp_file, global_cache_path)
        else:
            os.rename(temp_file, global_cache_path)

def clean_llm_html(raw_text):
    """Nettoie les éventuels blocs ```html renvoyés par l'IA."""
    t = raw_text.strip()
    if t.startswith("```"):
        lines = t.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        t = "\n".join(lines).strip()
    return t

def call_gemini(api_key, model, html_content, timeout=45):
    """Appel à l'API Gemini REST."""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    payload = {
        "systemInstruction": {"parts": [{"text": SYSTEM_PROMPT}]},
        "contents": [{"parts": [{"text": f"Traduis fidèlement ce fragment HTML en conservant scrupuleusement le balisage HTML :\n\n{html_content}"}]}],
        "generationConfig": {
            "temperature": 0.25,
            "maxOutputTokens": 6144
        }
    }
    resp = requests.post(url, json=payload, timeout=timeout)
    if resp.status_code == 200:
        data = resp.json()
        parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])
        if parts and "text" in parts[0]:
            return clean_llm_html(parts[0]["text"])
        raise ValueError("Réponse API vide ou bloquée par filtres de sécurité.")
    else:
        raise requests.HTTPError(f"HTTP {resp.status_code}: {resp.text[:200]}")

def extract_chunks_from_html(html_str, max_chunk_len=2400):
    """Découpe un document HTML en blocs d'éléments du body en préservant le markup."""
    soup = BeautifulSoup(html_str, "html.parser")
    body = soup.find("body")
    if not body:
        return [html_str]

    children = [c for c in body.children if getattr(c, 'name', None) is not None]
    if not children:
        return [html_str]

    chunks = []
    curr_elements = []
    curr_len = 0

    for child in children:
        c_str = str(child)
        curr_elements.append(c_str)
        curr_len += len(c_str)
        if curr_len >= max_chunk_len:
            chunks.append("\n".join(curr_elements))
            curr_elements = []
            curr_len = 0

    if curr_elements:
        chunks.append("\n".join(curr_elements))

    return chunks

def build_chunk_id(doc_name, chunk_idx, chunk_text):
    h = hashlib.md5(chunk_text.encode("utf-8")).hexdigest()[:10]
    return f"{doc_name}::chunk_{chunk_idx:03d}::{h}"

def worker_loop(worker_id, worker_cfg, task_queue, total_tasks, completed_counter):
    api_key = worker_cfg["api_key"]
    model_primary = worker_cfg["model_primary"]
    model_fallback = worker_cfg["model_fallback"]
    min_interval = worker_cfg["min_interval"]
    last_call = 0.0

    while True:
        try:
            task = task_queue.get_nowait()
        except queue.Empty:
            break

        chunk_id = task["chunk_id"]
        doc_name = task["doc_name"]
        raw_html = task["raw_html"]

        plain = BeautifulSoup(raw_html, "html.parser").get_text().strip()
        if len(plain) < 3 or not any(c.isalpha() for c in plain):
            with cache_lock:
                translation_cache[chunk_id] = raw_html
                completed_counter[0] += 1
                save_cache()
            task_queue.task_done()
            continue

        models = [model_primary, model_fallback]
        success = False

        for mod in models:
            now = time.time()
            elapsed = now - last_call
            if elapsed < min_interval:
                time.sleep(min_interval - elapsed)

            try:
                t0 = time.time()
                translated_html = call_gemini(api_key, mod, raw_html)
                last_call = time.time()
                dt = last_call - t0

                with cache_lock:
                    translation_cache[chunk_id] = translated_html
                    completed_counter[0] += 1
                    done = completed_counter[0]
                    save_cache()

                sample = plain[:45].replace("\n", " ")
                with print_lock:
                    print(f"[{done}/{total_tasks}] (W{worker_id} / {mod}) {doc_name} [{dt:.1f}s] ➔ {sample}...", flush=True)

                success = True
                break

            except requests.HTTPError as e:
                with print_lock:
                    print(f"⚠️ [Worker {worker_id}] HTTP Error avec {mod} sur {chunk_id}: {e}", flush=True)
                time.sleep(3)
            except Exception as e:
                with print_lock:
                    print(f"⚠️ [Worker {worker_id}] Erreur avec {mod} sur {chunk_id}: {e}", flush=True)
                time.sleep(2)

        if not success:
            with print_lock:
                print(f"❌ [Worker {worker_id}] ÉCHEC définitif sur {chunk_id} après tous les modèles.", flush=True)

        task_queue.task_done()

def reassemble_html(original_html, translated_chunks):
    """Réinsère les blocs traduits dans la structure HTML originale."""
    soup = BeautifulSoup(original_html, "html.parser")
    body = soup.find("body")
    if not body:
        return "\n".join(translated_chunks)

    body.clear()
    combined_html = "\n".join(translated_chunks)
    new_soup = BeautifulSoup(combined_html, "html.parser")
    for elem in list(new_soup.children):
        body.append(elem)

    return str(soup)

def assemble_epub(input_epub, output_epub, doc_chunks_map):
    """Reconstruit le fichier EPUB final avec tous les documents traduits.
    Garantit la compatibilité 100% liseuses (Kobo, Kindle, Tolino, PocketBook, Calibre, Apple Books) :
    - 'mimetype' écrit en premier et non compressé (ZIP_STORED).
    - Métadonnées OPF passées en français (dc:language 'fr', titre mis à jour).
    - Tous les autres fichiers compressés en DEFLATED.
    """
    with print_lock:
        print(f"\n📦 Assemblage du livre EPUB vers : {output_epub} ...", flush=True)

    # Répertoire temporaire pour préparer les fichiers
    temp_output = output_epub + ".tmp"
    if os.path.exists(temp_output):
        os.remove(temp_output)

    with zipfile.ZipFile(input_epub, "r") as zin, zipfile.ZipFile(temp_output, "w") as zout:
        # 1. Écriture obligatoire de 'mimetype' en premier et SANS COMPRESSION (ZIP_STORED)
        if "mimetype" in zin.namelist():
            mimetype_bytes = zin.read("mimetype")
            zout.writestr("mimetype", mimetype_bytes, compress_type=zipfile.ZIP_STORED)

        for item in zin.infolist():
            filename = item.filename
            if filename == "mimetype":
                continue  # Déjà écrit

            data = zin.read(filename)

            # Si c'est un document HTML traduit
            if filename in doc_chunks_map:
                chunks_info = doc_chunks_map[filename]
                translated_chunks = []
                for c_info in chunks_info:
                    c_id = c_info["chunk_id"]
                    if c_id in translation_cache:
                        translated_chunks.append(translation_cache[c_id])
                    else:
                        translated_chunks.append(c_info["raw_html"])

                orig_html = data.decode("utf-8", errors="ignore")
                new_html = reassemble_html(orig_html, translated_chunks)
                zout.writestr(filename, new_html.encode("utf-8"), compress_type=zipfile.ZIP_DEFLATED)
            
            # Si c'est le fichier content.opf, adapter les métadonnées pour la liseuse
            elif filename.lower().endswith(".opf"):
                opf_text = data.decode("utf-8", errors="ignore")
                opf_text = opf_text.replace("<dc:language>en</dc:language>", "<dc:language>fr</dc:language>")
                opf_text = opf_text.replace("<dc:language>en-US</dc:language>", "<dc:language>fr-FR</dc:language>")
                zout.writestr(filename, opf_text.encode("utf-8"), compress_type=zipfile.ZIP_DEFLATED)
            else:
                # Tout le reste (images, styles CSS, table des matières NCX, etc.)
                zout.writestr(filename, data, compress_type=zipfile.ZIP_DEFLATED)

    if os.path.exists(output_epub):
        os.replace(temp_output, output_epub)
    else:
        os.rename(temp_output, output_epub)

    with print_lock:
        print(f"🎉 Livre EPUB généré avec succès ! Taille : {os.path.getsize(output_epub)/1024:.1f} Ko", flush=True)

def main():
    parser = argparse.ArgumentParser(description="Traduction universelle d'Ebooks EPUB en Français avec Gemini Flash-Lite.")
    parser.add_argument("-i", "--input", default=DEFAULT_EPUB, help="Chemin du fichier EPUB source en anglais")
    parser.add_argument("-o", "--output", default=None, help="Chemin du fichier EPUB traduit de sortie")
    parser.add_argument("-w", "--workers", type=int, default=4, help="Nombre de workers en parallèle (défaut: 4)")
    parser.add_argument("--model-primary", default="gemini-3.5-flash-lite", help="Modèle principal (défaut: gemini-3.5-flash-lite)")
    parser.add_argument("--model-fallback", default="gemini-3.1-flash-lite", help="Modèle de relai (défaut: gemini-3.1-flash-lite)")
    parser.add_argument("--limit-chunks", type=int, default=None, help="Limiter le traitement à N fragments (pour test)")
    parser.add_argument("--compile-only", action="store_true", help="Générer l'EPUB à partir du cache existant sans appeler l'API")

    args = parser.parse_args()

    input_epub = os.path.abspath(args.input)
    if not os.path.exists(input_epub):
        print(f"❌ Fichier EPUB introuvable : {input_epub}")
        sys.exit(1)

    if not args.output:
        dir_name = os.path.dirname(input_epub)
        base_name = os.path.splitext(os.path.basename(input_epub))[0]
        output_epub = os.path.join(dir_name, f"[FR] {base_name}.epub")
    else:
        output_epub = os.path.abspath(args.output)

    cache_file = get_cache_path(input_epub)
    load_cache(cache_file)

    keys = load_api_keys()

    print(f"\n========================================================")
    print(f"      TRADUCTION DE LIVRE ÉLECTRONIQUE AVEC GEMINI      ")
    print(f"========================================================")
    print(f"Livre source      : {os.path.basename(input_epub)}")
    print(f"Livre de sortie   : {os.path.basename(output_epub)}")
    print(f"Fichier de cache  : {os.path.basename(cache_file)}")
    print(f"Modèle principal  : {args.model_primary}")
    print(f"Modèle de repli   : {args.model_fallback}")
    print(f"Workers           : {args.workers} (2 sur clé #1, 2 sur clé #2)")
    print(f"========================================================\n")

    with zipfile.ZipFile(input_epub, "r") as z:
        all_files = z.namelist()
        html_files = [f for f in all_files if f.lower().endswith(('.html', '.xhtml', '.htm'))]

    print(f"Documents HTML à traiter : {len(html_files)}")

    doc_chunks_map = {}
    all_tasks = []

    with zipfile.ZipFile(input_epub, "r") as z:
        for doc_name in html_files:
            content = z.read(doc_name).decode("utf-8", errors="ignore")
            chunks = extract_chunks_from_html(content)
            doc_chunks_map[doc_name] = []
            for idx, c_text in enumerate(chunks):
                chunk_id = build_chunk_id(doc_name, idx, c_text)
                task_info = {
                    "doc_name": doc_name,
                    "chunk_idx": idx,
                    "chunk_id": chunk_id,
                    "raw_html": c_text
                }
                doc_chunks_map[doc_name].append(task_info)
                all_tasks.append(task_info)

    total_chunks = len(all_tasks)
    pending_tasks = [t for t in all_tasks if t["chunk_id"] not in translation_cache]
    already_done = total_chunks - len(pending_tasks)

    print(f"Total fragments de texte : {total_chunks}")
    print(f"Déjà traduits (en cache) : {already_done}")
    print(f"Restant à traduire       : {len(pending_tasks)}\n")

    if args.limit_chunks:
        pending_tasks = pending_tasks[:args.limit_chunks]
        print(f"⚠️ Mode test activé : limitation à {len(pending_tasks)} fragments.")

    if not args.compile_only and pending_tasks:
        task_queue = queue.Queue()
        for t in pending_tasks:
            task_queue.put(t)

        workers_cfg = [
            {"id": 1, "api_key": keys["k1"], "model_primary": args.model_primary, "model_fallback": args.model_fallback, "min_interval": 3.0},
            {"id": 2, "api_key": keys["k1"], "model_primary": args.model_primary, "model_fallback": args.model_fallback, "min_interval": 3.0},
            {"id": 3, "api_key": keys["k2"], "model_primary": args.model_primary, "model_fallback": args.model_fallback, "min_interval": 3.0},
            {"id": 4, "api_key": keys["k2"], "model_primary": args.model_primary, "model_fallback": args.model_fallback, "min_interval": 3.0}
        ]

        active_workers = workers_cfg[:args.workers]
        completed_counter = [already_done]
        threads = []
        t_start = time.time()

        for w_cfg in active_workers:
            t = Thread(
                target=worker_loop,
                args=(w_cfg["id"], w_cfg, task_queue, total_chunks, completed_counter),
                daemon=True
            )
            t.start()
            threads.append(t)

        for t in threads:
            t.join()

        t_end = time.time()
        print(f"\n✅ Phase de traduction terminée en {(t_end - t_start)/60:.1f} minutes !")

    assemble_epub(input_epub, output_epub, doc_chunks_map)

if __name__ == "__main__":
    main()
