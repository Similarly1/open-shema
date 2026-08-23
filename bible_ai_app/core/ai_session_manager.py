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
                "onboarding_completed": False,
                "user_role": "predication",
                "preferred_bibles": ["LSG1910", "NBS"],
                "greek_hebrew_level": "intermediaire",
                "ai_posture": "pastoral_sparring",
                "country_culture": "France (Métropole & Outre-mer)",
                "cultural_notes": "",
                "tradition": "Évangélique / Réformée",
                "church_confession_raw": "",
                "system_profile_prompt": "",
                "custom_sermon_prompt": "",
                "memory_active": True
            }
            with open(USER_PROFILE_FILE, 'w', encoding='utf-8') as f:
                json.dump(default_profile, f, indent=2, ensure_ascii=False)

    # --- Gestion du Profil Utilisateur & Cadrage Herméneutique ---

    @classmethod
    def get_user_profile(cls) -> Dict[str, Any]:
        cls.initialize()
        try:
            with open(USER_PROFILE_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return data
        except Exception as e:
            logger.error(f"Erreur lecture profil : {e}")
            return {}

    @classmethod
    def save_user_profile(cls, profile_data: Dict[str, Any]) -> bool:
        cls.initialize()
        try:
            # Conserver les champs existants non écrasés
            current = cls.get_user_profile()
            current.update(profile_data)
            with open(USER_PROFILE_FILE, 'w', encoding='utf-8') as f:
                json.dump(current, f, indent=2, ensure_ascii=False)
            return True
        except Exception as e:
            logger.error(f"Erreur sauvegarde profil : {e}")
            return False

    @classmethod
    def generate_theological_profile_summary(cls, profile_data: Dict[str, Any], config: Optional[Dict[str, Any]] = None) -> str:
        """
        Envoie les réponses du questionnaire à l'IA pour synthétiser un 
        « Passeport Herméneutique » condensé (150 à 250 mots).
        """
        from ai.llm_client import LLMClient
        from core.config import load_config
        
        cfg = config or load_config()
        
        role_labels = {
            "predication": "Prédication & Ministère pastoral (préparation de sermons)",
            "enseignement": "Enseignement biblique, formation & groupes de maison",
            "etude_perso": "Étude personnelle approfondie & dévotion",
            "academique": "Recherche académique, exégétique et théologique"
        }
        
        level_labels = {
            "debutant": "Débutant (traductions simples, translittérations, sans jargon grammatical lourd)",
            "intermediaire": "Intermédiaire (codes Strong, lemmes, morphologie et nuances sémantiques)",
            "avance": "Avancé (analyse syntaxique précise, critique textuelle, temps/voix/modes grecs et hébreux)"
        }
        
        posture_labels = {
            "pastoral_sparring": "Pastoral & Sparring-partner (chaleureux mais challenge les arguments pour tester la cohérence)",
            "pastoral": "Pastoral & Équilibré (chaleureux, édifiant, orienté vers le cœur)",
            "academique": "Académique & Rigoureux (neutre, factuel, historique et scientifique)",
            "pedagogique": "Pédagogique (didactique, clair, vulgarisé avec structure logique)"
        }
        
        user_role_str = role_labels.get(profile_data.get("user_role", ""), profile_data.get("user_role", ""))
        greek_level_str = level_labels.get(profile_data.get("greek_hebrew_level", ""), profile_data.get("greek_hebrew_level", ""))
        posture_str = posture_labels.get(profile_data.get("ai_posture", ""), profile_data.get("ai_posture", ""))
        bibles_str = ", ".join(profile_data.get("preferred_bibles", ["Segond 1910"]))
        country_str = profile_data.get("country_culture", "Non précisé")
        cultural_notes = profile_data.get("cultural_notes", "").strip()
        tradition_str = profile_data.get("tradition", "Évangélique / Réformée")
        confession_raw = profile_data.get("church_confession_raw", "").strip()
        
        meta_prompt = (
            "Tu es un théologien expert et conseiller herméneutique chrétien.\n"
            "Analyse les éléments suivants du profil d'un utilisateur d'Open Shema pour rédiger son "
            "« Guide de Personnalisation & Cadrage Herméneutique » sous forme de directives claires et directes.\n\n"
            "DONNÉES DU QUESTIONNAIRE UTILISATEUR :\n"
            f"- Rôle / Cadre d'utilisation : {user_role_str}\n"
            f"- Versions bibliques de prédilection : {bibles_str}\n"
            f"- Niveau en langues originales (Grec/Hébreu) : {greek_level_str}\n"
            f"- Posture souhaitée pour l'IA : {posture_str}\n"
            f"- Contexte géographique & culturel : {country_str}" + (f" ({cultural_notes})" if cultural_notes else "") + "\n"
            f"- Tradition ecclésiale : {tradition_str}\n"
        )
        
        if confession_raw:
            meta_prompt += f"- Confession de foi locale ou texte de référence :\n\"\"\"{confession_raw[:3000]}\"\"\"\n\n"
        else:
            meta_prompt += "- Confession de foi locale : Aucune confession spécifique fournie (se baser sur la tradition indiquée).\n\n"
            
        meta_prompt += (
            "CONSIGNE DE RÉDACTION :\n"
            "Rédige un texte condensé (150 à 250 mots maximum en français) sous forme de 4 points clés structurés :\n"
            "1. CADRE MINISTÉRIEL : Pour qui et dans quel but l'IA assiste l'utilisateur.\n"
            "2. POSTURE & TON : Comment l'IA doit s'exprimer (chaleur pastorale, rigueur, questionnement éventuel).\n"
            "3. NIVEAU LINGUISTIQUE : Façon d'intégrer le grec, l'hébreu et les codes Strong selon son niveau.\n"
            "4. CONTEXTUALISATION & ANCRAGE DOCTRINAL : Boussole théologique à respecter (salut par grâce, autorité des Écritures, christocentrisme) et adaptation aux réalités culturelles/sociétales du pays indiqué.\n\n"
            "Formule ce texte directement à destination de l'IA (en utilisant des impératifs : 'Adopte...', 'Respecte...', 'Explique...'). Ne mets AUCUN préambule ni conclusion."
        )
        
        try:
            # Modèle rapide pour la synthèse (Gemini 3.7 Flash par défaut)
            model_to_use = cfg.get("chat_model") or "gemini-3.7-flash"
            if "mistral" in model_to_use.lower():
                provider = "mistral"
                api_key = cfg.get("mistral_api_key", "")
            elif "infomaniak" in model_to_use.lower() or "ministral" in model_to_use.lower():
                provider = "infomaniak"
                api_key = cfg.get("infomaniak_token", "")
            else:
                provider = "gemini"
                api_key = cfg.get("gemini_api_key", "")
                
            client = LLMClient(provider=provider, api_key=api_key, model=model_to_use)
            summary = client.ask_question(context="", question=meta_prompt)
            
            # Nettoyer et stocker
            summary = summary.strip()
            profile_data["system_profile_prompt"] = summary
            profile_data["onboarding_completed"] = True
            cls.save_user_profile(profile_data)
            return summary
        except Exception as e:
            logger.error(f"Erreur génération synthèse profil : {e}")
            fallback_summary = (
                f"DIRECTIVES DE PERSONNALISATION UTILISATEUR :\n"
                f"- Cadre : {user_role_str}\n"
                f"- Posture : {posture_str}\n"
                f"- Langues originales : {greek_level_str}\n"
                f"- Contexte & Doctrine : Respecter la tradition {tradition_str} et le contexte {country_str}."
            )
            profile_data["system_profile_prompt"] = fallback_summary
            profile_data["onboarding_completed"] = True
            cls.save_user_profile(profile_data)
            return fallback_summary

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
