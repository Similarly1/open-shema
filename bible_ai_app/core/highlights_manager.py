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
    def get_highlights_for_chapter(cls, book: str, chapter: int, version: Optional[str] = None, config: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """Retourne les surlignages pour un chapitre précis, filtrés par version si spécifiée."""
        all_hl = cls.get_all_highlights(config)
        clean_book = (book or "").lower().strip()
        ch_num = int(chapter)
        clean_ver = (version or "").lower().strip()
        
        results = []
        for hl in all_hl:
            if (hl.get("book") or "").lower().strip() == clean_book and int(hl.get("chapter", 0)) == ch_num:
                hl_ver = (hl.get("version") or "").lower().strip()
                if clean_ver and hl_ver and hl_ver != clean_ver:
                    continue
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
    def delete_highlights_for_passage(cls, book: str, chapter: int, verse_start: int, verse_end: int, version: Optional[str] = None, config: Optional[Dict[str, Any]] = None) -> int:
        """Supprime tous les surlignages qui chevauchent la plage de versets spécifiée."""
        filepath = cls.get_highlights_file(config)
        all_hl = cls._load_all(filepath)
        clean_book = (book or "").lower().strip()
        ch_num = int(chapter)
        v_start = int(verse_start)
        v_end = int(verse_end)
        clean_ver = (version or "").lower().strip()

        remaining = []
        deleted_count = 0
        for hl in all_hl:
            hl_book = (hl.get("book") or "").lower().strip()
            hl_chap = int(hl.get("chapter", 0))
            hl_vs = int(hl.get("verse_start", 0))
            hl_ve = int(hl.get("verse_end", hl_vs))
            hl_ver = (hl.get("version") or "").lower().strip()

            # Si c'est le même livre et chapitre et qu'il y a chevauchement
            if hl_book == clean_book and hl_chap == ch_num and (hl_vs <= v_end and hl_ve >= v_start):
                if clean_ver and hl_ver and hl_ver != clean_ver:
                    remaining.append(hl)
                else:
                    deleted_count += 1
            else:
                remaining.append(hl)

        if deleted_count > 0:
            cls._save_all(filepath, remaining)
        return deleted_count
        
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

    @classmethod
    def export_to_json(cls, config: Optional[Dict[str, Any]] = None) -> str:
        """Exporte tous les surlignages sous forme de chaîne JSON indentée."""
        highlights = cls.get_all_highlights(config)
        return json.dumps(highlights, ensure_ascii=False, indent=2)

    @classmethod
    def export_to_markdown(cls, config: Optional[Dict[str, Any]] = None) -> str:
        """Exporte tous les surlignages dans un format Markdown structuré et très lisible pour un humain."""
        highlights = cls.get_all_highlights(config)
        if not highlights:
            return "# Mes Surlignages Bibliques\n\n*Aucun surlignage enregistré.*"

        color_labels = {
            'yellow': 'Jaune Solaire',
            'green': 'Vert Sauge',
            'blue': 'Bleu Céleste',
            'amber': 'Ambre Doré',
            'purple': 'Lavande Douce',
            'rose': 'Rose Corail'
        }

        # Trier par livre, chapitre, verse_start
        sorted_hl = sorted(
            highlights,
            key=lambda h: (str(h.get("book", "")).lower(), int(h.get("chapter", 0)), int(h.get("verse_start", 0)))
        )

        now_str = datetime.datetime.now().strftime('%d/%m/%Y à %H:%M')
        lines = [
            "# Mes Surlignages Bibliques",
            f"*Exporté le {now_str} — {len(sorted_hl)} surlignage(s)*\n",
            "---",
            ""
        ]

        current_group = None
        for hl in sorted_hl:
            book = str(hl.get("book", "")).capitalize()
            chap = hl.get("chapter", 1)
            v_start = hl.get("verse_start", 1)
            v_end = hl.get("verse_end", v_start)
            version = (hl.get("version") or "LSG").upper()
            color = color_labels.get(hl.get("color", "yellow"), hl.get("color", "Jaune"))
            text = (hl.get("selected_text") or "").strip()

            ref = f"{book} {chap}:{v_start}" if v_start == v_end else f"{book} {chap}:{v_start}-{v_end}"
            group_key = f"{book} {chap}"

            if group_key != current_group:
                current_group = group_key
                lines.append(f"## {current_group}\n")

            meta = f"**{ref}** *({version} • {color})*"
            if text:
                lines.append(f"- {meta}\n  > « {text} »\n")
            else:
                lines.append(f"- {meta}\n")

        return "\n".join(lines)

    @classmethod
    def import_from_json(cls, data_or_str: Any, mode: str = "merge", config: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Importe des surlignages depuis une liste de dictionnaires ou une chaîne JSON.
        Mode 'merge': fusionne sans effacer les existants.
        Mode 'replace': remplace la liste actuelle.
        """
        filepath = cls.get_highlights_file(config)
        existing = cls._load_all(filepath)

        if isinstance(data_or_str, str):
            try:
                incoming = json.loads(data_or_str)
            except Exception as e:
                return {"success": False, "error": f"JSON invalide: {e}"}
        elif isinstance(data_or_str, list):
            incoming = data_or_str
        else:
            return {"success": False, "error": "Format de données invalide."}

        if not isinstance(incoming, list):
            return {"success": False, "error": "Le document doit être une liste de surlignages JSON."}

        if mode == "replace":
            final_hl = incoming
            imported_count = len(incoming)
        else:
            # Merge par identifiant
            existing_map = {hl.get("id"): hl for hl in existing if hl.get("id")}
            imported_count = 0
            for item in incoming:
                hl_id = item.get("id")
                if not hl_id:
                    hl_id = f"hl_{datetime.datetime.now().strftime('%Y%m%d%H%M%S')}_{os.urandom(4).hex()}"
                    item["id"] = hl_id
                existing_map[hl_id] = item
                imported_count += 1
            final_hl = list(existing_map.values())

        cls._save_all(filepath, final_hl)
        return {
            "success": True,
            "imported_count": imported_count,
            "total_count": len(final_hl)
        }
