import os
import json
import datetime
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

CURRENT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_HIGHLIGHTS_FILE = os.path.join(CURRENT_DIR, "data", "highlights.json")


class HighlightsManager:
    """
    Gère les surlignages personnels stockés sous forme de fichier JSON.
    Chaque surlignage peut être lié (optionnellement) à une note Markdown.
    """

    @classmethod
    def get_highlights_file(cls, config: Optional[Dict[str, Any]] = None) -> str:
        """Retourne le chemin vers le fichier de surlignages."""
        if config and config.get("highlights_file"):
            custom_file = config["highlights_file"].strip()
            if custom_file:
                try:
                    os.makedirs(os.path.dirname(custom_file), exist_ok=True)
                    return custom_file
                except Exception as e:
                    logger.warning(f"Impossible d'utiliser le fichier de surlignages personnalisé '{custom_file}': {e}")
        
        os.makedirs(os.path.dirname(DEFAULT_HIGHLIGHTS_FILE), exist_ok=True)
        return DEFAULT_HIGHLIGHTS_FILE

    @classmethod
    def _load_all(cls, filepath: str) -> List[Dict[str, Any]]:
        if not os.path.exists(filepath):
            return []
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Erreur de lecture du fichier de surlignages {filepath}: {e}")
            return []

    @classmethod
    def _save_all(cls, filepath: str, data: List[Dict[str, Any]]) -> bool:
        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            return True
        except Exception as e:
            logger.error(f"Erreur d'écriture du fichier de surlignages {filepath}: {e}")
            return False

    @classmethod
    def get_all_highlights(cls, config: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """Retourne tous les surlignages."""
        return cls._load_all(cls.get_highlights_file(config))

    @classmethod
    def get_highlights_for_chapter(cls, book: str, chapter: int, config: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """Retourne les surlignages pour un chapitre précis."""
        all_hl = cls.get_all_highlights(config)
        clean_book = book.lower().strip()
        
        results = []
        for hl in all_hl:
            if hl.get("book", "").lower() == clean_book and hl.get("chapter") == int(chapter):
                results.append(hl)
        return results

    @classmethod
    def save_highlight(cls, highlight_data: Dict[str, Any], config: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Ajoute ou met à jour un surlignage."""
        filepath = cls.get_highlights_file(config)
        all_hl = cls._load_all(filepath)
        
        hl_id = highlight_data.get("id")
        if not hl_id:
            hl_id = f"hl_{datetime.datetime.now().strftime('%Y%m%d%H%M%S')}_{os.urandom(4).hex()}"
            highlight_data["id"] = hl_id
            
        highlight_data["updated_at"] = datetime.datetime.now().isoformat()
        if "created_at" not in highlight_data:
            highlight_data["created_at"] = highlight_data["updated_at"]

        # Mise à jour ou ajout
        updated = False
        for i, hl in enumerate(all_hl):
            if hl.get("id") == hl_id:
                # Conserver la date de création originale
                highlight_data["created_at"] = hl.get("created_at", highlight_data["created_at"])
                all_hl[i] = highlight_data
                updated = True
                break
                
        if not updated:
            all_hl.append(highlight_data)
            
        cls._save_all(filepath, all_hl)
        return highlight_data

    @classmethod
    def delete_highlight(cls, hl_id: str, config: Optional[Dict[str, Any]] = None) -> bool:
        """Supprime un surlignage par son ID."""
        filepath = cls.get_highlights_file(config)
        all_hl = cls._load_all(filepath)
        
        initial_len = len(all_hl)
        all_hl = [hl for hl in all_hl if hl.get("id") != hl_id]
        
        if len(all_hl) < initial_len:
            cls._save_all(filepath, all_hl)
            return True
        return False
        
    @classmethod
    def link_note(cls, hl_id: str, note_id: str, config: Optional[Dict[str, Any]] = None) -> bool:
        """Associe un ID de note à un surlignage existant."""
        filepath = cls.get_highlights_file(config)
        all_hl = cls._load_all(filepath)
        
        updated = False
        for hl in all_hl:
            if hl.get("id") == hl_id:
                hl["note_id"] = note_id
                hl["updated_at"] = datetime.datetime.now().isoformat()
                updated = True
                break
                
        if updated:
            cls._save_all(filepath, all_hl)
            return True
        return False
