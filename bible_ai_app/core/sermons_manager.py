import os
import re
import yaml
import datetime
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

CURRENT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_SERMONS_DIR = os.path.join(CURRENT_DIR, "data", "sermons")
DEFAULT_ILLUSTRATIONS_DIR = os.path.join(CURRENT_DIR, "data", "illustrations")


class SermonsManager:
    """
    Gère les sermons et le réservoir d'illustrations stockés sous forme de fichiers
    Markdown (.md) standard avec métadonnées Frontmatter YAML.
    """

    @classmethod
    def get_sermons_directory(cls, config: Optional[Dict[str, Any]] = None) -> str:
        """Retourne le dossier actif pour les sermons."""
        if config and config.get("sermons_directory"):
            custom_dir = config["sermons_directory"].strip()
            if custom_dir:
                try:
                    os.makedirs(custom_dir, exist_ok=True)
                    return custom_dir
                except Exception as e:
                    logger.warning(f"Impossible d'utiliser le dossier de sermons personnalisé '{custom_dir}': {e}")
        
        os.makedirs(DEFAULT_SERMONS_DIR, exist_ok=True)
        return DEFAULT_SERMONS_DIR

    @classmethod
    def get_illustrations_directory(cls, config: Optional[Dict[str, Any]] = None) -> str:
        """Retourne le dossier actif pour le réservoir d'illustrations."""
        if config and config.get("illustrations_directory"):
            custom_dir = config["illustrations_directory"].strip()
            if custom_dir:
                try:
                    os.makedirs(custom_dir, exist_ok=True)
                    return custom_dir
                except Exception as e:
                    logger.warning(f"Impossible d'utiliser le dossier d'illustrations personnalisé '{custom_dir}': {e}")
        
        os.makedirs(DEFAULT_ILLUSTRATIONS_DIR, exist_ok=True)
        return DEFAULT_ILLUSTRATIONS_DIR

    @classmethod
    def _slugify_filename(cls, title: str, item_id: str, prefix: str = "sermon") -> str:
        """Génère un nom de fichier lisible et propre."""
        safe_title = re.sub(r'[^\w\s-]', '', title.lower(), flags=re.UNICODE)
        safe_title = re.sub(r'[-\s]+', '-', safe_title).strip('-')
        if not safe_title:
            safe_title = prefix
        safe_title = safe_title[:45].rstrip('-')
        short_id = item_id[-8:] if len(item_id) > 8 else item_id
        return f"{safe_title}-{short_id}.md"

    @classmethod
    def _sanitize_for_json(cls, obj: Any) -> Any:
        """Convertit récursivement les objets date/datetime en chaînes ISO pour json.dumps."""
        if isinstance(obj, (datetime.date, datetime.datetime)):
            return obj.isoformat()
        elif isinstance(obj, dict):
            return {k: cls._sanitize_for_json(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [cls._sanitize_for_json(item) for item in obj]
        return obj

    # =========================================================================
    # 1. PARSING & SÉRIALISATION MARKDOWN / YAML
    # =========================================================================

    @classmethod
    def parse_markdown_sermon(cls, file_path: str) -> Optional[Dict[str, Any]]:
        """Parse un fichier sermon .md avec en-tête Frontmatter YAML."""
        if not os.path.exists(file_path) or not file_path.endswith(".md"):
            return None

        try:
            with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                raw_content = f.read()
        except Exception as e:
            logger.error(f"Impossible de lire {file_path}: {e}")
            return None

        metadata: Dict[str, Any] = {}
        body = raw_content

        if raw_content.startswith("---"):
            parts = raw_content.split("---", 2)
            if len(parts) >= 3:
                yaml_str = parts[1].strip()
                body = parts[2].lstrip("\r\n")
                try:
                    loaded_meta = yaml.safe_load(yaml_str)
                    if isinstance(loaded_meta, dict):
                        metadata = loaded_meta
                except Exception as e:
                    logger.warning(f"Erreur parsing YAML dans {file_path}: {e}")

        stat = os.stat(file_path)
        item_id = metadata.get("id") or os.path.splitext(os.path.basename(file_path))[0]
        title = metadata.get("title") or "Sermon sans titre"
        date_str = metadata.get("date_planned") or datetime.datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d")

        # Calcul automatique du nombre de mots et temps estimé
        clean_text_for_count = re.sub(r'^\s*>\s*\[!cue\b.*?$', '', body, flags=re.MULTILINE | re.IGNORECASE)
        clean_text_for_count = re.sub(r'^\s*>\s*\[!.*?\].*?$', '', clean_text_for_count, flags=re.MULTILINE)
        clean_text_for_count = re.sub(r'[#*`_~\[\]()>-]', ' ', clean_text_for_count)
        words = [w for w in clean_text_for_count.split() if w.strip()]
        word_count = len(words)
        
        wpm = metadata.get("timing", {}).get("words_per_minute", 135) if isinstance(metadata.get("timing"), dict) else 135
        if not wpm or wpm <= 0:
            wpm = 135
        est_minutes = round(word_count / wpm, 1)

        result = {
            "id": str(item_id),
            "filename": os.path.basename(file_path),
            "file_path": file_path,
            "title": str(title),
            "type": str(metadata.get("type", "sermon")),
            "status": str(metadata.get("status", "draft")),
            "church": str(metadata.get("church", "")),
            "event_occasion": str(metadata.get("event_occasion", "Culte dominical")),
            "date_planned": str(date_str),
            "series": metadata.get("series", {}),
            "passage": metadata.get("passage", {}),
            "big_idea": str(metadata.get("big_idea", "")),
            "pmt": str(metadata.get("pmt") or metadata.get("big_idea") or ""),
            "pms": str(metadata.get("pms") or ""),
            "contemporary_tension": str(metadata.get("contemporary_tension") or ""),
            "redemptive_era": str(metadata.get("redemptive_era") or "christ"),
            "goal": str(metadata.get("goal", "")),
            "theme_tags": metadata.get("theme_tags", []),
            "timing": metadata.get("timing", {
                "target_duration_min": 35,
                "words_per_minute": wpm
            }),
            "delivery_history": metadata.get("delivery_history", []),
            "word_count": word_count,
            "estimated_minutes": est_minutes,
            "body": body,
            "created_at": str(metadata.get("created_at") or datetime.datetime.fromtimestamp(stat.st_ctime).isoformat()),
            "updated_at": datetime.datetime.fromtimestamp(stat.st_mtime).isoformat(),
        }
        return cls._sanitize_for_json(result)

    # =========================================================================
    # 2. GESTION DES SERMONS (CRUD)
    # =========================================================================

    @classmethod
    def list_sermons(cls, config: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """Liste tous les sermons disponibles sur le disque."""
        target_dir = cls.get_sermons_directory(config)
        sermons = []

        cls._ensure_initial_sample_sermon(target_dir)

        try:
            filenames = sorted(os.listdir(target_dir), reverse=True)
            for fname in filenames:
                if fname.endswith(".md"):
                    full_path = os.path.join(target_dir, fname)
                    sermon_data = cls.parse_markdown_sermon(full_path)
                    if sermon_data:
                        summary_item = {k: v for k, v in sermon_data.items() if k != "body"}
                        summary_item["body_preview"] = sermon_data["body"][:250].replace("\n", " ").strip()
                        sermons.append(summary_item)
        except Exception as e:
            logger.error(f"Erreur lors du listing des sermons dans {target_dir}: {e}")

        return sermons

    @classmethod
    def get_sermon(cls, sermon_id: str, config: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
        """Récupère un sermon complet par son ID ou nom de fichier."""
        target_dir = cls.get_sermons_directory(config)
        
        # 1. Recherche directe par nom de fichier
        direct_path = os.path.join(target_dir, sermon_id if sermon_id.endswith(".md") else f"{sermon_id}.md")
        if os.path.exists(direct_path):
            return cls.parse_markdown_sermon(direct_path)

        # 2. Recherche par ID dans les métadonnées
        for fname in os.listdir(target_dir):
            if fname.endswith(".md"):
                full_path = os.path.join(target_dir, fname)
                s = cls.parse_markdown_sermon(full_path)
                if s and s["id"] == sermon_id:
                    return s

        return None

    @classmethod
    def save_sermon(cls, sermon: Dict[str, Any], config: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Sauvegarde un sermon au format Markdown + YAML."""
        target_dir = cls.get_sermons_directory(config)
        sermon_id = sermon.get("id") or datetime.datetime.now().strftime("%Y%m%d%H%M%S")
        title = sermon.get("title") or "Sermon sans titre"
        body = sermon.get("body", "")

        existing_filename = sermon.get("filename")
        if existing_filename:
            fpath = os.path.join(target_dir, existing_filename)
            if os.path.exists(fpath):
                s_meta = cls.parse_markdown_sermon(fpath)
                if not s_meta or str(s_meta.get("id")) != str(sermon_id):
                    existing_filename = None
            else:
                existing_filename = None

        if not existing_filename:
            try:
                for fname in os.listdir(target_dir):
                    if fname.endswith(".md"):
                        fpath = os.path.join(target_dir, fname)
                        s_meta = cls.parse_markdown_sermon(fpath)
                        if s_meta and str(s_meta.get("id")) == str(sermon_id):
                            existing_filename = fname
                            break
            except Exception as _silent_e:
                logger.debug("Erreur ignoree : %s", _silent_e)

        if existing_filename and os.path.exists(os.path.join(target_dir, existing_filename)):
            file_path = os.path.join(target_dir, existing_filename)
        else:
            filename = cls._slugify_filename(title, sermon_id, prefix="sermon")
            file_path = os.path.join(target_dir, filename)

        frontmatter: Dict[str, Any] = {
            "id": sermon_id,
            "title": title,
            "type": sermon.get("type", "sermon"),
            "status": sermon.get("status", "draft"),
            "church": sermon.get("church", ""),
            "event_occasion": sermon.get("event_occasion", "Culte dominical"),
            "date_planned": str(sermon.get("date_planned", datetime.date.today().isoformat())),
            "series": sermon.get("series", {}),
            "passage": sermon.get("passage", {}),
            "big_idea": sermon.get("big_idea", ""),
            "pmt": sermon.get("pmt") or sermon.get("big_idea") or "",
            "pms": sermon.get("pms", ""),
            "contemporary_tension": sermon.get("contemporary_tension", ""),
            "redemptive_era": sermon.get("redemptive_era", "christ"),
            "goal": sermon.get("goal", ""),
            "theme_tags": sermon.get("theme_tags", []),
            "timing": sermon.get("timing", {
                "target_duration_min": 35,
                "words_per_minute": 135
            }),
            "delivery_history": sermon.get("delivery_history", []),
            "created_at": sermon.get("created_at") or datetime.datetime.now().isoformat(),
            "updated_at": datetime.datetime.now().isoformat(),
        }

        try:
            yaml_dump = yaml.dump(frontmatter, allow_unicode=True, sort_keys=False, default_flow_style=False)
            content = f"---\n{yaml_dump}---\n\n{body.lstrip()}"
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(content)
            
            cls._update_illustrations_usage(sermon, body, config)

            logger.info(f"Sermon '{title}' sauvegardé avec succès dans {file_path}")
            return {"success": True, "sermon": cls.parse_markdown_sermon(file_path)}
        except Exception as e:
            logger.error(f"Erreur lors de la sauvegarde du sermon {file_path}: {e}")
            return {"success": False, "error": str(e)}

    @classmethod
    def import_sermon_file(cls, file_path: str, config: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Importe intelligemment un fichier Word (.docx) ou Markdown (.md) et crée un nouveau sermon structuré."""
        if not os.path.exists(file_path):
            return {"success": False, "error": f"Fichier introuvable : {file_path}"}

        ext = os.path.splitext(file_path)[1].lower()
        title = os.path.splitext(os.path.basename(file_path))[0]
        passage_ref = ""
        church = ""
        date_planned = datetime.datetime.now().strftime("%Y-%m-%d")
        big_idea = ""
        body_lines = []

        if ext == ".docx":
            try:
                import zipfile, xml.etree.ElementTree as ET
                w_ns = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
                with zipfile.ZipFile(file_path) as z:
                    xml_content = z.read('word/document.xml')
                tree = ET.fromstring(xml_content)
                
                raw_paragraphs = []
                for p in tree.iter(f'{{{w_ns}}}p'):
                    runs = []
                    for r in p.iter(f'{{{w_ns}}}r'):
                        t_elems = r.findall(f'{{{w_ns}}}t')
                        r_text = ''.join([t.text for t in t_elems if t.text])
                        is_bold = r.find(f'{{{w_ns}}}rPr/{{{w_ns}}}b') is not None
                        is_italic = r.find(f'{{{w_ns}}}rPr/{{{w_ns}}}i') is not None
                        
                        if r_text:
                            if is_bold:
                                runs.append(f'**{r_text}**')
                            elif is_italic:
                                runs.append(f'*{r_text}*')
                            else:
                                runs.append(r_text)
                    full_p = ''.join(runs).strip()
                    full_p = re.sub(r'\*\*\s*\*\*', '', full_p)
                    if full_p:
                        raw_paragraphs.append(full_p)
            except Exception as e:
                logger.error(f"Erreur lecture docx {file_path}: {e}")
                return {"success": False, "error": f"Erreur lecture docx : {e}"}
        else:
            # Fichier Markdown / texte
            try:
                with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                    raw_paragraphs = [l.strip() for l in f.readlines() if l.strip()]
            except Exception as e:
                return {"success": False, "error": f"Erreur lecture fichier : {e}"}

        # Détection heuristique des métadonnées
        bible_books_pattern = r'\b(?:Genèse|Exode|Lévitique|Nombres|Deutéronome|Josué|Juges|Ruth|1\s*Samuel|2\s*Samuel|1\s*Rois|2\s*Rois|1\s*Chroniques|2\s*Chroniques|Esdras|Néhémie|Esther|Job|Psaumes?|Proverbes?|Ecclésiaste|Cantique|Ésaïe|Esaïe|Jérémie|Lamentations|Ézéchiel|Ezechiel|Daniel|Osée|Joël|Amos|Abdias|Jonas|Michée|Nahum|Habacuc|Sophonie|Aggée|Zacharie|Malachie|Matthieu|Marc|Luc|Jean|Actes|Romains?|1\s*Corinthiens?|2\s*Corinthiens?|Galates?|Éphésiens?|Ephesiens?|Philippiens?|Colossiens?|1\s*Thessaloniciens?|2\s*Thessaloniciens?|1\s*Timothée|2\s*Timothée|Tite|Philémon|Hébreux|Jacques|1\s*Pierre|2\s*Pierre|1\s*Jean|2\s*Jean|3\s*Jean|Jude|Apocalypse|Gn|Ex|Lv|Nb|Dt|Jos|Jg|Rt|1\s*S|2\s*S|1\s*R|2\s*R|1\s*Ch|2\s*Ch|Esd|Né|Est|Jb|Ps|Pr|Ec|Ct|És|Es|Jér|Lam|Éz|Ez|Da|Os|Jl|Am|Ab|Jon|Mi|Na|Ha|So|Ag|Za|Mal|Mt|Mc|Lc|Jn|Ac|Rm|Rom|1\s*Co|2\s*Co|Ga|Gal|Ép|Ep|Ph|Col|1\s*Th|2\s*Th|1\s*Tm|2\s*Tm|Tt|Phm|Hé|He|Jc|1\s*P|2\s*P|1\s*Jn|2\s*Jn|3\s*Jn|Jud|Ap)\.?\s*\d+(?:[\s.,:-]+\d+)*'
        
        body_start_idx = 0
        header_candidates = raw_paragraphs[:6]

        for idx, p in enumerate(header_candidates):
            clean = re.sub(r'[*_#]', '', p).strip()

            # Passage biblique
            b_match = re.search(bible_books_pattern, clean, re.IGNORECASE)
            if b_match and not passage_ref:
                passage_ref = b_match.group(0).strip()
                body_start_idx = max(body_start_idx, idx + 1)
                continue

            # Église & Date (ex: AMD, le 22 mars 2026 ou (AMD, le 05.03.2023))
            c_match = re.search(r'(?:\(([^,)]+),\s*(?:le\s*)?(\d{1,2}[./\s\w]+\d{2,4})\)|([A-ZÉÈÀÂÊÎÔÛ]{2,10}),\s*(?:le\s*)?(\d{1,2}[./\s\w]+\d{2,4}))', clean)
            if c_match:
                church = (c_match.group(1) or c_match.group(3) or '').strip()
                raw_date = (c_match.group(2) or c_match.group(4) or '').strip()
                # Normalisation date
                d_match = re.search(r'(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})', raw_date)
                if d_match:
                    day, month, year = d_match.groups()
                    if len(year) == 2: year = f"20{year}"
                    date_planned = f"{year}-{int(month):02d}-{int(day):02d}"
                body_start_idx = max(body_start_idx, idx + 1)
                continue

            if not title or title.startswith("Prédic") or title.startswith("Prédication"):
                if len(clean) > 3 and not clean.lower().startswith('intro'):
                    title = clean
                    body_start_idx = max(body_start_idx, idx + 1)
                    continue

            if not big_idea and len(clean) > 15 and not clean.lower().startswith('intro'):
                big_idea = clean
                body_start_idx = max(body_start_idx, idx + 1)
                continue

        # Formatage du corps avec structuration des titres et repères de diapositive [_]
        for p in raw_paragraphs[body_start_idx:]:
            p_clean = re.sub(r'[*_#]', '', p).strip()

            # Titres de sections 1 - ..., 2 - ..., Introduction, Conclusion
            if re.match(r'^(?:\d+\s*[-–.]|[I|V|X]+\s*[-–.]|Introduction|Conclusion)\s+', p_clean, re.IGNORECASE) or p_clean.lower() in ['introduction', 'conclusion']:
                body_lines.append(f"\n# {p_clean}\n")
            # Sous-titres 1.1, 1.2, 2.1...
            elif re.match(r'^\d+\.\d+\s+', p_clean):
                body_lines.append(f"\n## {p_clean}\n")
            # Repères de diapositive [_] ou [ _ ]
            elif '[_]' in p or '[ _ ]' in p:
                p_formatted = re.sub(r'\[\s*_\s*\]', '\n> [!cue] Projeter diapositive\n', p)
                body_lines.append(p_formatted)
            else:
                body_lines.append(p)

        body_content = "\n\n".join(body_lines)

        sermon_obj = {
            "id": f"sermon-{int(datetime.datetime.now().timestamp())}",
            "title": title or "Prédication importée",
            "church": church or "",
            "date_planned": str(date_planned),
            "status": "draft",
            "series": {"title": ""},
            "passage": {"reference": passage_ref or ""},
            "big_idea": big_idea or "",
            "goal": "",
            "timing": {"target_duration_min": 35, "words_per_minute": 135},
            "body": body_content
        }

        save_res = cls.save_sermon(sermon_obj, config)
        return save_res

    @classmethod
    def delete_sermon(cls, sermon_id: str, config: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Supprime un sermon."""
        target_dir = cls.get_sermons_directory(config)
        sermon = cls.get_sermon(sermon_id, config)
        if not sermon:
            return {"success": False, "error": "Sermon introuvable"}

        try:
            if os.path.exists(sermon["file_path"]):
                os.remove(sermon["file_path"])
                logger.info(f"Sermon supprimé : {sermon['file_path']}")
                return {"success": True, "id": sermon_id}
            return {"success": False, "error": "Fichier physique introuvable"}
        except Exception as e:
            logger.error(f"Erreur lors de la suppression du sermon {sermon_id}: {e}")
            return {"success": False, "error": str(e)}

    # =========================================================================
    # 3. RÉSERVOIR D'ILLUSTRATIONS
    # =========================================================================

    @classmethod
    def parse_illustration_file(cls, file_path: str) -> Optional[Dict[str, Any]]:
        """Parse une fiche d'illustration .md."""
        if not os.path.exists(file_path) or not file_path.endswith(".md"):
            return None

        try:
            with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                raw_content = f.read()
        except Exception as e:
            logger.error(f"Impossible de lire {file_path}: {e}")
            return None

        metadata: Dict[str, Any] = {}
        body = raw_content

        if raw_content.startswith("---"):
            parts = raw_content.split("---", 2)
            if len(parts) >= 3:
                yaml_str = parts[1].strip()
                body = parts[2].lstrip("\r\n")
                try:
                    loaded_meta = yaml.safe_load(yaml_str)
                    if isinstance(loaded_meta, dict):
                        metadata = loaded_meta
                except Exception as e:
                    logger.warning(f"Erreur parsing YAML illustration dans {file_path}: {e}")

        stat = os.stat(file_path)
        item_id = metadata.get("id") or os.path.splitext(os.path.basename(file_path))[0]
        title = metadata.get("title") or "Illustration sans titre"

        res = {
            "id": str(item_id),
            "filename": os.path.basename(file_path),
            "file_path": file_path,
            "title": str(title),
            "category": str(metadata.get("category", "Général")),
            "type": str(metadata.get("type", "Histoire vraie")),
            "tags": metadata.get("tags", []),
            "passages_associes": metadata.get("passages_associes", []),
            "source": str(metadata.get("source", "")),
            "author": str(metadata.get("author", "")),
            "usage_history": metadata.get("usage_history", []),
            "body": body.strip(),
            "created_at": str(metadata.get("created_at") or datetime.datetime.fromtimestamp(stat.st_ctime).isoformat()),
            "updated_at": datetime.datetime.fromtimestamp(stat.st_mtime).isoformat(),
        }
        return cls._sanitize_for_json(res)

    _cached_illustrations: Optional[List[Dict[str, Any]]] = None
    _cached_illustrations_mtime: float = 0.0

    @classmethod
    def invalidate_illustrations_cache(cls):
        cls._cached_illustrations = None

    @classmethod
    def list_illustrations(cls, config: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """Liste toutes les illustrations du réservoir global avec cache en mémoire ultra-rapide."""
        target_dir = cls.get_illustrations_directory(config)
        cls._ensure_initial_sample_illustrations(target_dir)

        if not os.path.exists(target_dir):
            return []

        try:
            current_mtime = os.path.getmtime(target_dir)
        except Exception:
            current_mtime = 0.0

        if cls._cached_illustrations is not None and current_mtime == cls._cached_illustrations_mtime:
            return cls._cached_illustrations

        cache_json_file = os.path.join(CURRENT_DIR, "data", "illustrations_processed_cache.json")
        illustrations_map: Dict[str, Dict[str, Any]] = {}
        loaded_from_json = False

        if os.path.exists(cache_json_file):
            try:
                import json
                with open(cache_json_file, "r", encoding="utf-8") as f:
                    cache_raw = json.load(f)
                for k, item in cache_raw.items():
                    if isinstance(item, dict) and item.get("id"):
                        i_id = str(item["id"])
                        illustrations_map[i_id] = {
                            "id": i_id,
                            "filename": f"{i_id}.md",
                            "file_path": os.path.join(target_dir, f"{i_id}.md"),
                            "title": str(item.get("title") or "Illustration sans titre"),
                            "category": str(item.get("category", "Général")),
                            "type": str(item.get("type", "Histoire vraie")),
                            "tags": item.get("tags", []),
                            "passages_associes": item.get("passages_associes", []),
                            "source": str(item.get("source", "")),
                            "author": str(item.get("author", "")),
                            "usage_history": item.get("usage_history", []),
                            "body": str(item.get("body", "")).strip(),
                            "created_at": item.get("created_at") or datetime.datetime.now().isoformat(),
                            "updated_at": item.get("updated_at") or datetime.datetime.now().isoformat(),
                        }
                loaded_from_json = True
            except Exception as e:
                logger.warning(f"Impossible de précharger le cache JSON illustrations : {e}")

        try:
            md_files = [f for f in os.listdir(target_dir) if f.endswith(".md")]
            
            # Si le dossier correspond au cache JSON, retour instantané !
            if loaded_from_json and len(illustrations_map) > 0 and abs(len(md_files) - len(illustrations_map)) < 30:
                cls._cached_illustrations = list(illustrations_map.values())
                cls._cached_illustrations_mtime = current_mtime
                return cls._cached_illustrations

            illustrations = []
            for fname in sorted(md_files):
                full_path = os.path.join(target_dir, fname)
                ill = cls.parse_illustration_file(full_path)
                if ill:
                    illustrations.append(ill)

            cls._cached_illustrations = illustrations if illustrations else list(illustrations_map.values())
            cls._cached_illustrations_mtime = current_mtime
            return cls._cached_illustrations
        except Exception as e:
            logger.error(f"Erreur lors du listing des illustrations: {e}")
            return list(illustrations_map.values()) if loaded_from_json else []

    @classmethod
    def save_illustration(cls, data: Dict[str, Any], config: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Sauvegarde ou met à jour une illustration."""
        cls.invalidate_illustrations_cache()
        target_dir = cls.get_illustrations_directory(config)
        ill_id = data.get("id") or f"ill-{datetime.datetime.now().strftime('%Y%m%d%H%M%S')}"
        title = data.get("title") or "Illustration sans titre"
        body = data.get("body", "")

        existing_filename = data.get("filename")
        if existing_filename and os.path.exists(os.path.join(target_dir, existing_filename)):
            file_path = os.path.join(target_dir, existing_filename)
        else:
            filename = cls._slugify_filename(title, ill_id, prefix="ill")
            file_path = os.path.join(target_dir, filename)

        frontmatter: Dict[str, Any] = {
            "id": ill_id,
            "title": title,
            "category": data.get("category", "Général"),
            "type": data.get("type", "Histoire vraie"),
            "tags": data.get("tags", []),
            "passages_associes": data.get("passages_associes", []),
            "source": data.get("source", ""),
            "author": data.get("author", ""),
            "usage_history": data.get("usage_history", []),
            "created_at": data.get("created_at") or datetime.datetime.now().isoformat(),
            "updated_at": datetime.datetime.now().isoformat(),
        }

        try:
            yaml_dump = yaml.dump(frontmatter, allow_unicode=True, sort_keys=False, default_flow_style=False)
            content = f"---\n{yaml_dump}---\n\n{body.strip()}"
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(content)
            
            return {"success": True, "illustration": cls.parse_illustration_file(file_path)}
        except Exception as e:
            logger.error(f"Erreur sauvegarde illustration {file_path}: {e}")
            return {"success": False, "error": str(e)}

    @classmethod
    def _update_illustrations_usage(cls, sermon: Dict[str, Any], body: str, config: Optional[Dict[str, Any]] = None):
        """Enregistre automatiquement l'utilisation des illustrations dans leurs fiches respectives."""
        ill_ids = re.findall(r'>\s*\[!illustration(?:\|id=([a-zA-Z0-9_-]+))?', body, flags=re.IGNORECASE)
        church = sermon.get("church", "")
        date_str = sermon.get("date_planned", datetime.date.today().isoformat())
        sermon_id = sermon.get("id")

        if not ill_ids or not church:
            return

        illustrations = cls.list_illustrations(config)
        for ill in illustrations:
            if ill["id"] in ill_ids:
                history = ill.get("usage_history", [])
                already_logged = any(h.get("sermon_id") == sermon_id and h.get("church") == church for h in history)
                if not already_logged:
                    history.append({
                        "sermon_id": sermon_id,
                        "sermon_title": sermon.get("title", ""),
                        "church": church,
                        "date": str(date_str)
                    })
                    ill["usage_history"] = history
                    cls.save_illustration(ill, config)

    # =========================================================================
    # 4. ÉCHANTILLONS GÉNERÉS PAR DÉFAUT
    # =========================================================================

    @classmethod
    def _ensure_initial_sample_sermon(cls, target_dir: str):
        """Crée un sermon modèle complet si aucun sermon n'existe."""
        if os.path.exists(target_dir) and any(f.endswith(".md") for f in os.listdir(target_dir)):
            return

        sample_file = os.path.join(target_dir, "plus-que-vainqueurs-romains8.md")
        sample_content = """---
id: "sermon-sample-romains8"
title: "Plus que vainqueurs face à l'épreuve"
type: "sermon"
status: "ready"
church: "Église Évangélique de Lyon"
event_occasion: "Culte dominical"
date_planned: 2026-08-30
series:
  id: "romains-vie-esprit"
  title: "Romains : La vie dans l'Esprit"
  part: 4
  total_parts: 6
passage:
  reference: "Romains 8:28-39"
  osis: "Rom.8.28-Rom.8.39"
  primary_version: "NEG79"
big_idea: "Rien ne peut séparer le croyant de l'amour de Dieu, même au cœur de la souffrance la plus vive."
goal: "Amener l'auditeur à trouver une sécurité absolue en Christ face aux épreuves présentes."
theme_tags:
  - "assurance"
  - "amour de Dieu"
  - "souffrance"
  - "victoire"
timing:
  target_duration_min: 35
  words_per_minute: 135
delivery_history:
  - church: "Église Évangélique de Lyon"
    date: 2026-08-30
    occasion: "Culte dominical"
    actual_duration_min: null
    notes: ""
---

# Introduction : L'illusion de la sécurité fragile

> [!cue] Régie : Diapositive Titre + Musique d'accueil off
> Chrono cible : 00:00 - 04:30 (4.5 min)

Dans un monde où une simple mauvaise nouvelle médicale, économique ou familiale peut pulvériser notre tranquillité en quelques secondes, sur quoi repose véritablement votre sécurité ?

> [!illustration|id=ill-ancre-tempete]
> **L'ancre des navires de haute mer**
> Lorsque l'ouragan frappe et que les lames de fond atteignent quinze mètres, le capitaine ne compte pas sur la force de la coque. L'ancre est jetée : elle ne s'accroche pas à l'eau mouvante, mais mord la roche invisible tout au fond.
> *Source : Carnet maritime — Tags : foi, épreuve, sécurité*

Notre texte de ce matin dans Romains 8 ne promet pas une traversée sans vagues, mais il nous montre l'Ancre éternelle de notre âme.

---

# I. La certitude du dessein divin (v. 28-30)

> [!cue] Projeter Romains 8:28 à l'écran

> [!scripture|ref=Rom.8.28|version=NEG79]
> « Nous savons, du reste, que toutes choses concourent au bien de ceux qui aiment Dieu, de ceux qui sont appelés selon son dessein. »

> [!exegesis|key=synergei]
> **Analyse du verbe sunergei (συνεργεῖ) :**
> - Présent actif indicatif : Action constante et ininterrompue de Dieu.
> - Ce n'est pas un optimisme naïf ("tout est bien"), mais l'affirmation que Dieu tisse même nos larmes dans son plan éternel de gloire.

Regardez la chaîne d'or du verset 29 et 30 : Connus d'avance, prédestinés, appelés, justifiés, glorifiés. Pas un seul maillon ne peut se rompre !

> [!application]
> **Question pour notre cœur :**
> Quand la tempête frappe, interprétez-vous l'amour de Dieu à travers vos circonstances, ou interprétez-vous vos circonstances à travers l'amour inconditionnel de Dieu à la croix ?

---

# II. L'avocat souverain face à toute accusation (v. 31-34)

> [!scripture|ref=Rom.8.31-32|version=NEG79]
> « Si Dieu est pour nous, qui sera contre nous ? Lui qui n'a point épargné son propre Fils, mais qui l'a livré pour nous tous... »

> [!cue] Insister sur le silence après la question : regarder l'assemblée

Paul pose une question judiciaire. Qui accusera les élus de Dieu ? C'est Dieu qui justifie ! Qui les condamnera ? Christ est mort, bien plus, il est ressuscité et il intercède à la droite de Dieu pour nous.

> [!illustration|id=ill-tapisserie-envers]
> **La tapisserie vue d'en bas**
> Vue par en dessous, une broderie flamande n'est qu'un enchevêtrement chaotique de fils sombres et de nœuds rugueux. Mais lorsque l'artisan la retourne à la lumière, le chef-d'œuvre apparaît.
> *Tags : providence, souveraineté, confiance*

---

# Conclusion & Défi pratique

> [!cue] Projeter le final Romains 8:38-39 avec fond sombre épuré

> [!scripture|ref=Rom.8.38-39|version=NEG79]
> « Car j'ai l'assurance que ni la mort ni la vie, ni les anges ni les dominations, ni les choses présentes ni les choses à venir... ne pourra nous séparer de l'amour de Dieu manifesté en Jésus-Christ notre Seigneur. »

> [!application]
> Ce matin, apportez au pied de la croix ce fardeau que vous portiez en secret. Rien, absolument rien, ne peut vous arracher des mains du Père. Prions ensemble.
"""
        with open(sample_file, "w", encoding="utf-8") as f:
            f.write(sample_content)

    @classmethod
    def _ensure_initial_sample_illustrations(cls, target_dir: str):
        """Crée des illustrations d'exemple si le réservoir est vide."""
        if os.path.exists(target_dir) and any(f.endswith(".md") for f in os.listdir(target_dir)):
            return

        ill1_file = os.path.join(target_dir, "ill-ancre-tempete.md")
        ill1_content = """---
id: "ill-ancre-tempete"
title: "L'ancre des navires de haute mer"
category: "Nature & Maritime"
tags:
  - "sécurité"
  - "foi"
  - "épreuve"
  - "espérance"
passages_associes:
  - "Rom.8.28"
  - "Heb.6.19"
source: "Récit maritime traditionnel"
author: "Inconnu"
usage_history:
  - church: "Église Évangélique de Lyon"
    sermon_id: "sermon-sample-romains8"
    sermon_title: "Plus que vainqueurs face à l'épreuve"
    date: "2026-08-30"
---

Lorsque l'ouragan frappe et que les lames de fond atteignent quinze mètres, le capitaine ne compte pas sur la force de la coque. L'ancre est jetée : elle ne s'accroche pas à l'eau mouvante, mais mord la roche invisible tout au fond.
"""
        with open(ill1_file, "w", encoding="utf-8") as f:
            f.write(ill1_content)

        ill2_file = os.path.join(target_dir, "ill-tapisserie-envers.md")
        ill2_content = """---
id: "ill-tapisserie-envers"
title: "La tapisserie vue d'en bas"
category: "Allégories & Objets"
tags:
  - "providence"
  - "souveraineté"
  - "confiance"
  - "épreuve"
passages_associes:
  - "Rom.8.28"
  - "1Cor.13.12"
source: "Poème traditionnel / Corrie ten Boom"
author: "Corrie ten Boom"
usage_history: []
---

Vue par en dessous, une broderie n'est qu'un enchevêtrement chaotique de fils sombres et de nœuds rugueux. Mais lorsque l'artisan la retourne à la lumière, le chef-d'œuvre apparaît avec une harmonie parfaite.
"""
        with open(ill2_file, "w", encoding="utf-8") as f:
            f.write(ill2_content)
