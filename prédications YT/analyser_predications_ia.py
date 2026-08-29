#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script d'Analyse Homilétique IA des Prédications YouTube (Open Shema).
Modèle : Gemini 3.5 Flash-Lite
Quotas respectés : Max 15 RPM et 250k TPM (Régulation Leaky Bucket 4.5s/call).
Fonctionnalités :
- Analyse homilétique complète (Passage, Big Idea/PMT, Tension, Plan, Applications).
- Extraction automatique des illustrations vécues et injection directe dans bible_ai_app/data/illustrations/.
- Arrêt propre Ctrl+C et reprise automatique sans recalcul.
"""

import os
import sys
import json
import re
import time
import signal
import glob
import requests
from threading import Lock
from typing import List, Dict, Any, Tuple

# Configuration console Windows UTF-8
sys.stdout.reconfigure(encoding='utf-8')

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(CURRENT_DIR)
APP_DIR = os.path.join(PROJECT_ROOT, "bible_ai_app")
TRANS_DIR = os.path.join(CURRENT_DIR, "transcriptions")
OUTPUT_ANALYSIS_DIR = os.path.join(CURRENT_DIR, "analyses")
CACHE_FILE = os.path.join(CURRENT_DIR, "analyses_cache.json")
APP_ILLUSTRATIONS_DIR = os.path.join(CURRENT_DIR, "illustrations_extraites")

SYSTEM_PROMPT = """Tu es un théologien réformé et professeur d'homilétique expert dans l'analyse de prédications chrétiennes évangéliques.
Ta mission est d'analyser la transcription intégrale d'une prédication pour en extraire sa structure homilétique exacte et ses illustrations marquantes.

CONSIGNES STRICTES D'ANALYSE :
1. **Passage Biblique** : Identifie avec précision le texte biblique principal prêché (ex: "Luc 11.1-13", "Colossiens 4.2-6").
2. **Proposition Centrale (Big Idea / PMT)** : Résume en une seule phrase forte, mémorable et théocentrique la vérité directrice du message.
3. **Tension Contemporaine** : Identifie le besoin spirituel, le problème existentiel ou le dilemme humain auquel le message répond.
4. **Plan Homilétique** :
   - Introduction (Accroche et contextualisation)
   - 2 à 4 Points majeurs (Titre percutant + versets analysés + synthèse exégétique)
   - Conclusion & Appel
5. **Illustrations Réelles Extraites** :
   - Repère toute anecdote personnelle, récit historique, métaphore du quotidien ou analogie marquante racontée par le prédicateur.
   - Pour chaque illustration :
     * `titre` : Titre évocateur (max 8 mots).
     * `categorie` : OBLIGATOIREMENT une parmi : "Grâce & Salut", "Foi & Confiance", "Pardon & Réconciliation", "Épreuve & Souffrance", "Amour & Compassion", "Prière & Intimité", "Mariage & Famille", "Argent & Générosité", "Évangélisation & Mission", "Sainteté & Obéissance", "Espérance & Éternité".
     * `type` : "Histoire vraie", "Métaphore & Vie courante", "Citation" ou "Personnel".
     * `recit` : Récit condensé en bon français (1 à 2 paragraphes).
     * `lecon_homiletique` : Application pastorale pour l'auditeur.
     * `tags` : 3 à 4 mots-clés.
6. **Applications Pratiques** : 3 actions ou attitudes concrètes demandées à l'assemblée.

RÉPONDS UNIQUEMENT SOUS LA FORME D'UN OBJET JSON VALIDE STRICTEMENT CONFORME À CE SCHÉMA :
{
  "passage_reference": "Livre Chapitre.Verset-Verset",
  "theme_general": "Thème principal",
  "big_idea": "La proposition centrale en une phrase claire",
  "contemporary_tension": "La tension contemporaine / question de départ",
  "outline": [
    {
      "section_type": "introduction | point_1 | point_2 | point_3 | conclusion",
      "titre": "Titre du point",
      "passages": ["Ref1"],
      "synthese": "Explication de la pensée du prédicateur"
    }
  ],
  "illustrations": [
    {
      "titre": "Titre de l'anecdote",
      "categorie": "Grâce & Salut",
      "type": "Histoire vraie",
      "recit": "Texte de l'anecdote",
      "lecon_homiletique": "La leçon pastorale",
      "tags": ["Tag1", "Tag2"]
    }
  ],
  "applications": [
    "Application concrète 1",
    "Application concrète 2"
  ]
}
"""

_cache_data: Dict[str, Any] = {}
_cache_lock = Lock()


def load_cache() -> Dict[str, Any]:
    global _cache_data
    with _cache_lock:
        if _cache_data:
            return _cache_data
        if os.path.exists(CACHE_FILE):
            try:
                with open(CACHE_FILE, "r", encoding="utf-8") as f:
                    _cache_data = json.load(f)
                    return _cache_data
            except Exception as e:
                print(f"⚠️ Erreur chargement cache : {e}")
        _cache_data = {}
        return _cache_data


def save_cache():
    global _cache_data
    with _cache_lock:
        os.makedirs(os.path.dirname(CACHE_FILE), exist_ok=True)
        try:
            with open(CACHE_FILE, "w", encoding="utf-8") as f:
                json.dump(_cache_data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"⚠️ Erreur sauvegarde cache : {e}")


def handle_sigint(signum, frame):
    print("\n\n🛑 Interruption immédiate (Ctrl+C). Sauvegarde du cache...")
    save_cache()
    print("✅ Cache sauvegardé avec succès ! Sortie.")
    os._exit(0)


signal.signal(signal.SIGINT, handle_sigint)


def load_all_keys() -> Dict[str, str]:
    kdrive_path = r"C:\Users\adrie\kDrive\Documents\Site chants de la bible\BDD JEM\config_keys.json"
    ext_keys = {}
    if os.path.exists(kdrive_path):
        try:
            with open(kdrive_path, "r", encoding="utf-8") as f:
                ext_keys = json.load(f)
        except Exception:
            pass

    # Local fallback
    local_cfg_path = os.path.join(APP_DIR, "data", "config.json")
    local_cfg = {}
    if os.path.exists(local_cfg_path):
        try:
            with open(local_cfg_path, "r", encoding="utf-8") as f:
                local_cfg = json.load(f)
        except Exception:
            pass

    k1 = ext_keys.get("gemini_key1") or local_cfg.get("gemini_api_key")
    k2 = ext_keys.get("gemini_key2")
    return {"gemini_key1": k1, "gemini_key2": k2}


class EndpointRateLimiter:
    """Régulateur Leaky Bucket garantissant max 15 RPM et max 250k TPM."""
    def __init__(self, min_interval: float = 4.5):
        self.min_interval = min_interval
        self.next_allowed_time = 0.0
        self.lock = Lock()

    def acquire(self):
        with self.lock:
            now = time.time()
            target_time = max(now, self.next_allowed_time)
            self.next_allowed_time = target_time + self.min_interval

        sleep_time = target_time - now
        if sleep_time > 0:
            time.sleep(sleep_time)


def build_gemini_pool(keys: Dict[str, str]) -> List[Dict[str, Any]]:
    pool = []
    if keys.get("gemini_key1"):
        pool.append({
            "id": "gemini_k1_3.5",
            "name": "Gemini 3.5 Lite (Clé 1)",
            "model": "gemini-3.5-flash-lite",
            "key": keys["gemini_key1"],
            "limiter": EndpointRateLimiter(min_interval=4.5)
        })
    if keys.get("gemini_key2"):
        pool.append({
            "id": "gemini_k2_3.5",
            "name": "Gemini 3.5 Lite (Clé 2)",
            "model": "gemini-3.5-flash-lite",
            "key": keys["gemini_key2"],
            "limiter": EndpointRateLimiter(min_interval=4.5)
        })
    return pool


def call_gemini_analysis(transcript_meta: Dict[str, Any], transcript_text: str, endpoint: Dict[str, Any]) -> Tuple[bool, Dict[str, Any], Dict[str, Any], str]:
    endpoint["limiter"].acquire()
    model_name = endpoint["model"]
    api_key = endpoint["key"]
    
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
    
    user_payload = f"""TITRE DE LA PRÉDICATION : {transcript_meta.get('titre', '')}
DURÉE : {transcript_meta.get('duree_formatee', '')}
URL : {transcript_meta.get('url', '')}

TRANSCRIPTION INTÉGRALE :
{transcript_text[:35000]}
"""

    body_req = {
        "systemInstruction": {"parts": [{"text": SYSTEM_PROMPT}]},
        "contents": [{"role": "user", "parts": [{"text": user_payload}]}],
        "generationConfig": {
            "temperature": 0.2,
            "responseMimeType": "application/json"
        }
    }

    try:
        resp = requests.post(url, json=body_req, timeout=(10, 60))
        if resp.status_code == 200:
            data = resp.json()
            candidates = data.get("candidates", [])
            usage = data.get("usageMetadata", {})
            u_dict = {
                "prompt_tokens": usage.get("promptTokenCount", 0),
                "completion_tokens": usage.get("candidatesTokenCount", 0),
                "total_tokens": usage.get("totalTokenCount", 0)
            }
            if candidates and "content" in candidates[0]:
                parts = candidates[0]["content"].get("parts", [])
                if parts and "text" in parts[0]:
                    raw_json_txt = parts[0]["text"].strip()
                    parsed = json.loads(raw_json_txt)
                    if isinstance(parsed, dict):
                        return True, parsed, u_dict, ""
            return False, {}, u_dict, "JSON manquant ou invalide"
        else:
            return False, {}, {}, f"HTTP {resp.status_code} : {resp.text[:200]}"
    except Exception as e:
        return False, {}, {}, str(e)


def save_extracted_illustration_to_app(ill: Dict[str, Any], sermon_meta: Dict[str, Any], target_dir: str = APP_ILLUSTRATIONS_DIR):
    """Injecte directement l'illustration extraite dans la banque d'illustrations de l'application."""
    import yaml
    os.makedirs(target_dir, exist_ok=True)
    
    title = ill.get("titre") or "Illustration pastorale"
    safe_title = re.sub(r'[^\w\s-]', '', title.lower(), flags=re.UNICODE)
    safe_title = re.sub(r'[-\s]+', '-', safe_title).strip('-')[:35].rstrip('-')
    if not safe_title:
        safe_title = "illustration"
        
    ill_id = f"yt-{sermon_meta.get('video_id', 'vid')}-{abs(hash(title)) % 1000:03d}"
    filename = f"{safe_title}-{ill_id}.md"
    file_path = os.path.join(target_dir, filename)

    recit = ill.get("recit", "").strip()
    lecon = ill.get("lecon_homiletique", "").strip()
    body_text = f"{recit}\n\n> **Leçon homilétique :** {lecon}" if lecon else recit

    frontmatter = {
        "id": ill_id,
        "title": title,
        "category": ill.get("categorie", "Foi & Confiance"),
        "type": ill.get("type", "Histoire vraie"),
        "tags": ill.get("tags", []),
        "passages_associes": [sermon_meta.get("passage_reference", "")] if sermon_meta.get("passage_reference") else [],
        "source": f"Prédication : {sermon_meta.get('titre', '')}",
        "author": sermon_meta.get("source", "Prédicateur francophone"),
        "usage_history": [],
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "updated_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
    }

    content = f"---\n{yaml.dump(frontmatter, allow_unicode=True, sort_keys=False, default_flow_style=False)}---\n\n{body_text}\n"
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)


def save_sermon_analysis_md(analysis: Dict[str, Any], meta: Dict[str, Any], target_dir: str = OUTPUT_ANALYSIS_DIR):
    """Enregistre le rapport d'analyse homilétique en Markdown."""
    import yaml
    os.makedirs(target_dir, exist_ok=True)
    v_id = meta.get("video_id", "sermon")
    title = meta.get("titre", "Analyse")
    safe_title = re.sub(r'[^\w\s-]', '', title.lower(), flags=re.UNICODE)
    safe_title = re.sub(r'[-\s]+', '-', safe_title).strip('-')[:45].rstrip('-')
    
    fname = f"analyse_{safe_title}_{v_id}.md"
    fpath = os.path.join(target_dir, fname)

    # Construction du plan
    outline_lines = []
    for item in analysis.get("outline", []):
        t = item.get("titre", "Point")
        passages_str = f" *({', '.join(item.get('passages', []))})*" if item.get("passages") else ""
        outline_lines.append(f"### {t}{passages_str}\n{item.get('synthese', '')}\n")

    # Illustrations
    ill_lines = []
    for ill in analysis.get("illustrations", []):
        ill_lines.append(f"- **{ill.get('titre', 'Illustration')}** *[{ill.get('categorie', '')} / {ill.get('type', '')}]* :\n  > {ill.get('recit', '')}\n  > **Leçon :** {ill.get('lecon_homiletique', '')}\n")

    # Applications
    app_lines = [f"- {app}" for app in analysis.get("applications", [])]

    md_content = f"""---
video_id: "{v_id}"
titre: "{title}"
passage: "{analysis.get('passage_reference', '')}"
theme: "{analysis.get('theme_general', '')}"
url: "{meta.get('url', '')}"
duree: "{meta.get('duree_formatee', '')}"
date_analyse: "{time.strftime('%Y-%m-%d %H:%M:%S')}"
---

# 📖 Analyse Homilétique : {title}
- **Passage biblique central :** `{analysis.get('passage_reference', 'Non spécifié')}`
- **Proposition Centrale (PMT / Big Idea) :**  
  > 💡 **« {analysis.get('big_idea', '')} »**
- **Tension contemporaine :** *{analysis.get('contemporary_tension', '')}*

---

## 🏛️ Plan Homilétique Structuré

{chr(10).join(outline_lines)}

---

## 🎨 Illustrations & Récits Pastoraux Détectés ({len(analysis.get('illustrations', []))})

{chr(10).join(ill_lines) if ill_lines else "_Aucune illustration spécifique isolée dans ce message._"}

---

## 🎯 Applications Pratiques & Défis

{chr(10).join(app_lines)}
"""
    with open(fpath, "w", encoding="utf-8") as f:
        f.write(md_content)


def main():
    files = sorted(glob.glob(os.path.join(TRANS_DIR, "*.md")))
    total_files = len(files)
    if total_files == 0:
        print(f"❌ Aucune transcription trouvée dans {TRANS_DIR}")
        sys.exit(1)

    keys = load_all_keys()
    pool = build_gemini_pool(keys)
    if not pool:
        print("❌ Aucune clé Gemini valide trouvée.")
        sys.exit(1)

    print("=" * 80)
    print("🧠 ANALYSE HOMILÉTIQUE IA DES PRÉDICATIONS YOUTUBE (OPEN SHEMA)")
    print("=" * 80)
    print(f"⚡ Modèle : Gemini 3.5 Flash-Lite (Max 15 RPM / 250k TPM)")
    print(f"🔑 Points d'accès configurés ({len(pool)}) : {[p['name'] for p in pool]}")
    print(f"📚 Total transcriptions à analyser : {total_files}")
    print(f"📁 Rapports d'analyse sauvegardés dans : {OUTPUT_ANALYSIS_DIR}")
    print(f"🎨 Illustrations exportées directement dans : {APP_ILLUSTRATIONS_DIR}")
    print("=" * 80)

    cache = load_cache()
    to_process = []

    for fpath in files:
        with open(fpath, "r", encoding="utf-8", errors="ignore") as fp:
            txt = fp.read()
        v_id_match = re.search(r'video_id:\s*"([^"]+)"', txt)
        v_id = v_id_match.group(1) if v_id_match else os.path.splitext(os.path.basename(fpath))[0]
        t_match = re.search(r'titre:\s*"([^"]+)"', txt)
        u_match = re.search(r'url:\s*"([^"]+)"', txt)
        d_match = re.search(r'duree_formatee:\s*"([^"]+)"', txt)
        
        meta = {
            "video_id": v_id,
            "titre": t_match.group(1) if t_match else "Prédication",
            "url": u_match.group(1) if u_match else f"https://www.youtube.com/watch?v={v_id}",
            "duree_formatee": d_match.group(1) if d_match else "35:00",
            "file_path": fpath
        }
        if v_id in cache:
            continue
        to_process.append((meta, txt))

    already_done = total_files - len(to_process)
    print(f"✅ Déjà analysées (en cache) : {already_done} / {total_files}")
    print(f"🎯 Restantes à traiter        : {len(to_process)}")
    print("=" * 80)

    if not to_process:
        print("🎉 Toutes les prédications du dossier sont déjà analysées !")
        sys.exit(0)

    import itertools
    pool_cycle = itertools.cycle(pool)
    start_time = time.time()
    success_count = 0
    fail_count = 0
    total_tokens = 0
    total_extracted_illustrations = 0

    for idx, (meta, txt) in enumerate(to_process, 1):
        ep = next(pool_cycle)
        v_id = meta["video_id"]
        title_short = meta["titre"][:32]

        ok, result, usage, err = call_gemini_analysis(meta, txt, ep)

        if ok:
            success_count += 1
            total_tokens += usage.get("total_tokens", 0)
            cache[v_id] = result
            
            # 1. Sauvegarder le rapport d'analyse
            save_sermon_analysis_md(result, meta)
            
            # 2. Extraire et injecter chaque illustration dans l'app
            for ill in result.get("illustrations", []):
                try:
                    save_extracted_illustration_to_app(ill, meta)
                    total_extracted_illustrations += 1
                except Exception:
                    pass
        else:
            fail_count += 1
            print(f"\n⚠️ Échec {v_id} ({title_short}) : {err}", flush=True)

        if idx % 5 == 0:
            save_cache()

        percent = ((already_done + idx) / total_files) * 100
        elapsed = time.time() - start_time
        speed = (idx / elapsed) * 60 if elapsed > 0 else 0
        rem_sec = ((len(to_process) - idx) / (idx / elapsed)) if elapsed > 0 and idx > 0 else 0
        rem_m = int(rem_sec // 60)
        rem_s = int(rem_sec % 60)

        status_line = (
            f"\r[{percent:5.1f}%] {already_done + idx:2d}/{total_files} "
            f"| ✅ {success_count} "
            f"| 🎨 +{total_extracted_illustrations} ill. "
            f"| ⚡ {speed:4.1f} sér/min "
            f"| ⏳ {rem_m:02d}m{rem_s:02d}s "
            f"| {title_short}"
        )
        sys.stdout.write(status_line.ljust(95))
        sys.stdout.flush()

    save_cache()
    total_elapsed = time.time() - start_time
    print("\n\n" + "=" * 80)
    print("🎉 ANALYSE HOMILÉTIQUE TERMINÉE AVEC SUCCÈS !")
    print("=" * 80)
    print(f"⏱️ Durée totale : {int(total_elapsed//60)} min {int(total_elapsed%60)} s")
    print(f"✅ Prédications analysées : {success_count} / {len(to_process)}")
    print(f"🎨 Nouvelles illustrations extraites et injectées dans l'App : +{total_extracted_illustrations}")
    print(f"🔤 Jetons consommés : {total_tokens:,} tokens")
    print(f"📁 Rapports complets : {OUTPUT_ANALYSIS_DIR}")
    print("=" * 80)


if __name__ == "__main__":
    main()
