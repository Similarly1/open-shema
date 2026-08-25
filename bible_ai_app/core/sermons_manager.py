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

        return {
            "id": item_id,
            "filename": os.path.basename(file_path),
            "file_path": file_path,
            "title": title,
            "type": metadata.get("type", "sermon"),
            "status": metadata.get("status", "draft"),
            "church": metadata.get("church", ""),
            "event_occasion": metadata.get("event_occasion", "Culte dominical"),
            "date_planned": str(date_str),
            "series": metadata.get("series", {}),
            "passage": metadata.get("passage", {}),
            "big_idea": metadata.get("big_idea", ""),
            "goal": metadata.get("goal", ""),
            "theme_tags": metadata.get("theme_tags", []),
            "timing": metadata.get("timing", {
                "target_duration_min": 35,
                "words_per_minute": wpm
            }),
            "delivery_history": metadata.get("delivery_history", []),
            "word_count": word_count,
            "estimated_minutes": est_minutes,
            "body": body,
            "created_at": metadata.get("created_at") or datetime.datetime.fromtimestamp(stat.st_ctime).isoformat(),
            "updated_at": datetime.datetime.fromtimestamp(stat.st_mtime).isoformat(),
        }

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

        return {
            "id": item_id,
            "filename": os.path.basename(file_path),
            "file_path": file_path,
            "title": title,
            "category": metadata.get("category", "Général"),
            "tags": metadata.get("tags", []),
            "passages_associes": metadata.get("passages_associes", []),
            "source": metadata.get("source", ""),
            "author": metadata.get("author", ""),
            "usage_history": metadata.get("usage_history", []),
            "body": body.strip(),
            "created_at": metadata.get("created_at") or datetime.datetime.fromtimestamp(stat.st_ctime).isoformat(),
            "updated_at": datetime.datetime.fromtimestamp(stat.st_mtime).isoformat(),
        }

    @classmethod
    def list_illustrations(cls, config: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """Liste toutes les illustrations du réservoir global."""
        target_dir = cls.get_illustrations_directory(config)
        cls._ensure_initial_sample_illustrations(target_dir)

        illustrations = []
        try:
            for fname in sorted(os.listdir(target_dir)):
                if fname.endswith(".md"):
                    full_path = os.path.join(target_dir, fname)
                    ill = cls.parse_illustration_file(full_path)
                    if ill:
                        illustrations.append(ill)
        except Exception as e:
            logger.error(f"Erreur lors du listing des illustrations: {e}")

        return illustrations

    @classmethod
    def save_illustration(cls, data: Dict[str, Any], config: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Sauvegarde ou met à jour une illustration."""
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
