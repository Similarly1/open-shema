import os
import json
import datetime
import uuid
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

CURRENT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(CURRENT_DIR, "data")
CONVERSATIONS_DIR = os.path.join(DATA_DIR, "conversations")
AI_MEMORY_FILE = os.path.join(DATA_DIR, "ai_memory.json")
USER_PROFILE_FILE = os.path.join(DATA_DIR, "user_profile.json")

class AISessionManager:
    """
    Gère les sessions de conversation de l'assistant IA, le registre des mémoires 
    (conclusions épinglées) et le profil théologique de l'utilisateur.
    """

    @classmethod
    def initialize(cls):
        """S'assure que les dossiers et fichiers de base existent."""
        os.makedirs(CONVERSATIONS_DIR, exist_ok=True)
        
        if not os.path.exists(AI_MEMORY_FILE):
            with open(AI_MEMORY_FILE, 'w', encoding='utf-8') as f:
                json.dump({"version": "1.0", "memories": []}, f, indent=2, ensure_ascii=False)
                
        if not os.path.exists(USER_PROFILE_FILE):
            default_profile = {
                "tradition": "Neutre / Académique",
                "greek_level": "moderate",
                "memory_active": True,
                "custom_sermon_prompt": ""
            }
            with open(USER_PROFILE_FILE, 'w', encoding='utf-8') as f:
                json.dump(default_profile, f, indent=2, ensure_ascii=False)

    # --- Gestion du Profil Utilisateur ---

    @classmethod
    def get_user_profile(cls) -> Dict[str, Any]:
        cls.initialize()
        try:
            with open(USER_PROFILE_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Erreur lecture profil : {e}")
            return {}

    @classmethod
    def save_user_profile(cls, profile_data: Dict[str, Any]) -> bool:
        cls.initialize()
        try:
            with open(USER_PROFILE_FILE, 'w', encoding='utf-8') as f:
                json.dump(profile_data, f, indent=2, ensure_ascii=False)
            return True
        except Exception as e:
            logger.error(f"Erreur sauvegarde profil : {e}")
            return False

    # --- Gestion des Sessions de Chat ---

    @classmethod
    def create_session(cls, initial_context: Optional[Dict[str, Any]] = None) -> str:
        cls.initialize()
        session_id = f"conv_{datetime.datetime.now().strftime('%Y%m%d%H%M%S')}_{uuid.uuid4().hex[:6]}"
        session_data = {
            "id": session_id,
            "title": "Nouvelle étude",
            "created_at": datetime.datetime.now().isoformat(),
            "updated_at": datetime.datetime.now().isoformat(),
            "context": initial_context or {},
            "messages": []
        }
        cls._save_session(session_data)
        return session_id

    @classmethod
    def get_session(cls, session_id: str) -> Optional[Dict[str, Any]]:
        file_path = os.path.join(CONVERSATIONS_DIR, f"{session_id}.json")
        if not os.path.exists(file_path):
            return None
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Erreur lecture session {session_id} : {e}")
            return None

    @classmethod
    def _save_session(cls, session_data: Dict[str, Any]) -> bool:
        cls.initialize()
        session_id = session_data.get("id")
        if not session_id:
            return False
            
        session_data["updated_at"] = datetime.datetime.now().isoformat()
        file_path = os.path.join(CONVERSATIONS_DIR, f"{session_id}.json")
        try:
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(session_data, f, indent=2, ensure_ascii=False)
            return True
        except Exception as e:
            logger.error(f"Erreur sauvegarde session {session_id} : {e}")
            return False

    @classmethod
    def save_messages_to_session(cls, session_id: str, new_messages: List[Dict[str, Any]], title: Optional[str] = None) -> bool:
        session = cls.get_session(session_id)
        if not session:
            # Créer la session à la volée si elle n'existe pas (fallback)
            session = {
                "id": session_id,
                "title": title or "Nouvelle étude",
                "created_at": datetime.datetime.now().isoformat(),
                "messages": []
            }
            
        # Remplacer les anciens messages ou mettre à jour l'historique complet fourni par le front
        # Dans ce workflow, le JS garde la source de vérité et l'envoie en entier
        session["messages"] = new_messages
        if title and session.get("title") == "Nouvelle étude":
            session["title"] = title
            
        return cls._save_session(session)

    @classmethod
    def get_recent_sessions(cls, limit: int = 50) -> List[Dict[str, Any]]:
        cls.initialize()
        sessions = []
        try:
            for filename in os.listdir(CONVERSATIONS_DIR):
                if filename.endswith(".json"):
                    filepath = os.path.join(CONVERSATIONS_DIR, filename)
                    with open(filepath, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                        sessions.append({
                            "id": data.get("id"),
                            "title": data.get("title", "Sans titre"),
                            "updated_at": data.get("updated_at"),
                            "context": data.get("context", {})
                        })
                        
            # Trier du plus récent au plus ancien
            sessions.sort(key=lambda x: x.get("updated_at", ""), reverse=True)
            return sessions[:limit]
        except Exception as e:
            logger.error(f"Erreur listage sessions : {e}")
            return []

    @classmethod
    def delete_session(cls, session_id: str) -> bool:
        file_path = os.path.join(CONVERSATIONS_DIR, f"{session_id}.json")
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
                return True
            except Exception:
                return False
        return False

    @classmethod
    def rename_session(cls, session_id: str, new_title: str) -> bool:
        session = cls.get_session(session_id)
        if session:
            session["title"] = new_title
            return cls._save_session(session)
        return False

    # --- Gestion du Registre de Mémoire (Conclusions) ---

    @classmethod
    def pin_conclusion(cls, session_id: str, book_code: str, topic: str, content: str) -> bool:
        cls.initialize()
        try:
            with open(AI_MEMORY_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                
            mem_id = f"mem_{uuid.uuid4().hex[:8]}"
            new_memory = {
                "id": mem_id,
                "session_id": session_id,
                "book_code": book_code,
                "topic": topic,
                "content": content,
                "timestamp": datetime.datetime.now().isoformat(),
                "is_active": True
            }
            
            data["memories"].append(new_memory)
            
            with open(AI_MEMORY_FILE, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            return True
        except Exception as e:
            logger.error(f"Erreur épinglage conclusion : {e}")
            return False

    @classmethod
    def get_relevant_memories(cls, book_code: Optional[str] = None) -> List[Dict[str, Any]]:
        cls.initialize()
        try:
            with open(AI_MEMORY_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                
            memories = data.get("memories", [])
            active_mems = [m for m in memories if m.get("is_active", True)]
            
            if book_code:
                # Retenir les mémoires générales (pas de livre) et celles liées au livre
                return [m for m in active_mems if not m.get("book_code") or m.get("book_code") == book_code]
            return active_mems
        except Exception as e:
            logger.error(f"Erreur lecture mémoires : {e}")
            return []
