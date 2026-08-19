import os
import re
import yaml
import datetime
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

CURRENT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_NOTES_DIR = os.path.join(CURRENT_DIR, "data", "notes")


class NotesManager:
    """
    Gère les notes personnelles stockées sous forme de fichiers Markdown (.md) en clair sur le disque.
    Chaque note est un fichier .md indépendant avec en-tête Frontmatter YAML standard.
    """

    @classmethod
    def get_notes_directory(cls, config: Optional[Dict[str, Any]] = None) -> str:
        """Retourne le dossier actif pour les notes (dossier personnalisé ou par défaut)."""
        if config and config.get("notes_directory"):
            custom_dir = config["notes_directory"].strip()
            if custom_dir:
                try:
                    os.makedirs(custom_dir, exist_ok=True)
                    return custom_dir
                except Exception as e:
                    logger.warning(f"Impossible d'utiliser le dossier de notes personnalisé '{custom_dir}': {e}")
        
        os.makedirs(DEFAULT_NOTES_DIR, exist_ok=True)
        return DEFAULT_NOTES_DIR

    @classmethod
    def migrate_legacy_json_if_needed(cls, target_dir: str):
        """Migre automatiquement les anciennes notes du fichier monolithique data/notes.json vers des fichiers .md."""
        legacy_file = os.path.join(CURRENT_DIR, "data", "notes.json")
        if not os.path.exists(legacy_file):
            return

        try:
            import json
            with open(legacy_file, "r", encoding="utf-8") as f:
                notes = json.load(f)
            
            if isinstance(notes, list) and notes:
                for n in notes:
                    note_id = n.get("id") or datetime.datetime.now().strftime("%Y%m%d%H%M%S")
                    title = n.get("title") or "Note sans titre"
                    filename = cls._slugify_filename(title, note_id)
                    file_path = os.path.join(target_dir, filename)
                    if not os.path.exists(file_path):
                        cls.save_note_file(n, target_dir)
                
                # Renommer le JSON en .migrated pour éviter de réécraser plus tard
                os.rename(legacy_file, legacy_file + ".migrated")
                logger.info(f"Migration réussie de {len(notes)} note(s) JSON vers Markdown.")
        except Exception as e:
            logger.warning(f"Erreur lors de la migration de notes.json: {e}")

    @classmethod
    def _slugify_filename(cls, title: str, note_id: str) -> str:
        """Génère un nom de fichier lisible et sécurisé."""
        safe_title = re.sub(r'[^\w\s-]', '', title.lower(), flags=re.UNICODE)
        safe_title = re.sub(r'[-\s]+', '-', safe_title).strip('-')
        if not safe_title:
            safe_title = "note"
        safe_title = safe_title[:40].rstrip('-')
        short_id = note_id[-8:] if len(note_id) > 8 else note_id
        return f"{safe_title}-{short_id}.md"

    @classmethod
    def parse_markdown_file(cls, file_path: str) -> Optional[Dict[str, Any]]:
        """Parse un fichier .md avec ou sans en-tête Frontmatter YAML."""
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

        # Détection du Frontmatter YAML standard (--- ... ---)
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

        # Fallback extraction du titre si absent des métadonnées
        title = metadata.get("title")
        if not title:
            match = re.search(r'^#\s+(.+)$', body, flags=re.MULTILINE)
            if match:
                title = match.group(1).strip()
            else:
                base_name = os.path.splitext(os.path.basename(file_path))[0]
                title = base_name.replace("-", " ").replace("_", " ").capitalize()

        # Nettoyage du corps si le titre y est dupliqué au tout début
        clean_body = body
        if clean_body.strip().startswith(f"# {title}"):
            clean_body = re.sub(r'^#\s+' + re.escape(title) + r'\s*\n+', '', clean_body.strip())

        # ID de la note
        file_id = metadata.get("id") or os.path.splitext(os.path.basename(file_path))[0]
        
        # Tags formatting
        tags = metadata.get("tags", "")
        if isinstance(tags, list):
            tags = ", ".join(tags)

        # Date de mise à jour
        updated_at = metadata.get("updated_at")
        if not updated_at:
            mtime = os.path.getmtime(file_path)
            updated_at = datetime.datetime.fromtimestamp(mtime).strftime("%d/%m/%Y %H:%M")

        return {
            "id": file_id,
            "filename": os.path.basename(file_path),
            "file_path": file_path,
            "title": title,
            "reference": str(metadata.get("reference", "")).strip(),
            "tags": str(tags).strip(),
            "include_in_ai": bool(metadata.get("include_in_ai", True)),
            "content": clean_body.strip(),
            "updated_at": updated_at
        }

    @classmethod
    def list_notes(cls, config: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """Scanne le dossier de notes et retourne la liste de toutes les notes valides triées par date récente."""
        notes_dir = cls.get_notes_directory(config)
        cls.migrate_legacy_json_if_needed(notes_dir)

        if not os.path.exists(notes_dir):
            return []

        notes = []
        try:
            for entry in os.scandir(notes_dir):
                if entry.is_file() and entry.name.endswith(".md"):
                    parsed = cls.parse_markdown_file(entry.path)
                    if parsed:
                        notes.append(parsed)
        except Exception as e:
            logger.error(f"Erreur scan dossier notes {notes_dir}: {e}")

        def sort_key(item):
            try:
                return datetime.datetime.strptime(item.get("updated_at", ""), "%d/%m/%Y %H:%M")
            except Exception:
                return datetime.datetime.min

        notes.sort(key=sort_key, reverse=True)
        return notes

    @classmethod
    def save_note_file(cls, note: Dict[str, Any], target_dir: str) -> Dict[str, Any]:
        """Enregistre ou met à jour un fichier Markdown .md avec en-tête Frontmatter YAML standard."""
        os.makedirs(target_dir, exist_ok=True)

        note_id = note.get("id") or f"note_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}"
        title = note.get("title", "Note sans titre").strip() or "Note sans titre"
        reference = note.get("reference", "").strip()
        tags_raw = note.get("tags", "")
        include_in_ai = bool(note.get("include_in_ai", True))
        content = note.get("content", "").strip()
        updated_at = datetime.datetime.now().strftime("%d/%m/%Y %H:%M")

        # Parsing des tags
        if isinstance(tags_raw, str):
            tags_list = [t.strip() for t in tags_raw.split(",") if t.strip()]
        elif isinstance(tags_raw, list):
            tags_list = tags_raw
        else:
            tags_list = []

        existing_filename = None
        for entry in os.scandir(target_dir):
            if entry.is_file() and entry.name.endswith(".md"):
                parsed = cls.parse_markdown_file(entry.path)
                if parsed and parsed.get("id") == note_id:
                    existing_filename = entry.name
                    break

        filename = existing_filename or cls._slugify_filename(title, note_id)
        file_path = os.path.join(target_dir, filename)

        frontmatter = {
            "id": note_id,
            "title": title,
            "reference": reference,
            "tags": tags_list,
            "include_in_ai": include_in_ai,
            "updated_at": updated_at
        }

        yaml_content = yaml.dump(frontmatter, allow_unicode=True, default_flow_style=False, sort_keys=False).strip()
        md_text = f"---\n{yaml_content}\n---\n\n# {title}\n\n{content}\n"

        with open(file_path, "w", encoding="utf-8") as f:
            f.write(md_text)

        return {
            "success": True,
            "id": note_id,
            "filename": filename,
            "file_path": file_path,
            "title": title,
            "reference": reference,
            "tags": ", ".join(tags_list),
            "include_in_ai": include_in_ai,
            "content": content,
            "updated_at": updated_at
        }

    @classmethod
    def delete_note_file(cls, note_id: str, target_dir: str) -> bool:
        """Supprime le fichier .md correspondant à l'ID."""
        if not os.path.exists(target_dir):
            return False

        for entry in os.scandir(target_dir):
            if entry.is_file() and entry.name.endswith(".md"):
                parsed = cls.parse_markdown_file(entry.path)
                if parsed and (parsed.get("id") == note_id or entry.name == note_id or entry.name == f"{note_id}.md"):
                    try:
                        os.remove(entry.path)
                        return True
                    except Exception as e:
                        logger.error(f"Erreur suppression {entry.path}: {e}")
                        return False
        return False

    @classmethod
    def get_notes_for_passage(cls, book_name_or_code: str, chapter: int, verse: Optional[int] = None, config: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """Retourne toutes les notes liées à un livre, chapitre ou verset spécifique."""
        all_notes = cls.list_notes(config)
        matches = []

        clean_book = book_name_or_code.lower().strip()
        chap_str = str(chapter)
        verse_str = str(verse) if verse else None

        for n in all_notes:
            ref = n.get("reference", "").lower()
            if not ref:
                continue

            if clean_book in ref and (f" {chap_str}:" in ref or f" {chap_str} " in ref or ref.endswith(f" {chap_str}") or f"{clean_book} {chap_str}" in ref):
                if verse_str:
                    if f":{verse_str}" in ref or f" {verse_str}" in ref or ":" not in ref:
                        matches.append(n)
                else:
                    matches.append(n)
            elif clean_book in ref:
                matches.append(n)

        return matches

    @classmethod
    def build_ai_notes_context(cls, passage_ref: str = "", question: str = "", config: Optional[Dict[str, Any]] = None, max_notes: int = 5) -> str:
        """
        Extrait les notes pertinentes autorisées pour enrichir le prompt de l'Assistant IA (RAG de notes personnelles).
        Ne prend en compte que les notes ayant include_in_ai = True si l'option générale est active.
        """
        if config and not config.get("include_notes_in_ai", True):
            return ""

        notes = cls.list_notes(config)
        allowed_notes = [n for n in notes if n.get("include_in_ai", True) and n.get("content")]

        if not allowed_notes:
            return ""

        relevant: List[tuple] = []
        passage_lower = passage_ref.lower().strip()
        q_words = [w.lower() for w in re.findall(r'\w+', question) if len(w) > 3]

        for n in allowed_notes:
            score = 0
            ref_lower = n.get("reference", "").lower()
            content_lower = n.get("content", "").lower()
            title_lower = n.get("title", "").lower()

            if passage_lower and passage_lower in ref_lower:
                score += 10

            for w in q_words:
                if w in title_lower:
                    score += 4
                if w in content_lower:
                    score += 2

            if score > 0:
                relevant.append((score, n))

        relevant.sort(key=lambda x: x[0], reverse=True)
        top_notes = [item[1] for item in relevant[:max_notes]]

        if not top_notes and passage_lower:
            book_part = passage_lower.split()[0] if " " in passage_lower else passage_lower
            for n in allowed_notes:
                if book_part in n.get("reference", "").lower():
                    top_notes.append(n)
                    if len(top_notes) >= 3:
                        break

        if not top_notes:
            return ""

        context_lines = ["\n### Notes Personnelles de l'utilisateur (à intégrer à l'analyse) :"]
        for n in top_notes:
            ref_badge = f" [Réf: {n['reference']}]" if n.get("reference") else ""
            context_lines.append(f"- **Note : « {n['title']} »**{ref_badge} :\n  {n['content'][:500]}")

        return "\n".join(context_lines) + "\n"
