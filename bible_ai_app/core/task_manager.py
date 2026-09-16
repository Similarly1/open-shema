import threading
import json
import logging
from typing import Dict, List, Any, Optional, Callable

logger = logging.getLogger(__name__)

class TaskManager:
    """
    Gestionnaire central des tâches asynchrones d'arrière-plan (ex: indexation RAG, embeddings).
    Fournit le suivi d'avancement et la notification en temps réel à l'interface pywebview.
    """
    _tasks: Dict[str, Dict[str, Any]] = {}
    _lock = threading.RLock()
    _window_callback: Optional[Callable[[str, Dict[str, Any]], None]] = None

    @classmethod
    def set_window_callback(cls, callback: Callable[[str, Dict[str, Any]], None]):
        cls._window_callback = callback

    @classmethod
    def start_task(
        cls, 
        task_id: str, 
        title: str, 
        task_type: str = "rag_indexing", 
        total: int = 100, 
        detail: str = ""
    ) -> Dict[str, Any]:
        with cls._lock:
            task = {
                "id": task_id,
                "title": title,
                "type": task_type,
                "status": "running",
                "progress": 0,
                "current": 0,
                "total": total,
                "detail": detail or f"Préparation de l'indexation (0/{total})...",
                "error": None
            }
            cls._tasks[task_id] = task
            cls._notify("task_updated", task)
            return task

    @classmethod
    def update_progress(
        cls, 
        task_id: str, 
        progress: int, 
        current: int = 0, 
        total: int = 0, 
        detail: str = ""
    ):
        with cls._lock:
            if task_id in cls._tasks:
                task = cls._tasks[task_id]
                task["progress"] = min(100, max(0, int(progress)))
                if current: 
                    task["current"] = current
                if total: 
                    task["total"] = total
                if detail:
                    task["detail"] = detail
                else:
                    cur = task.get("current", 0)
                    tot = task.get("total", 0)
                    if tot > 0:
                        task["detail"] = f"Indexation vectorielle : {task['progress']}% ({cur}/{tot} fragments)"
                    else:
                        task["detail"] = f"Indexation vectorielle : {task['progress']}%"
                cls._notify("task_updated", task)

    @classmethod
    def complete_task(cls, task_id: str, message: str = "Indexation terminée avec succès !"):
        with cls._lock:
            if task_id in cls._tasks:
                task = cls._tasks[task_id]
                task["progress"] = 100
                task["status"] = "completed"
                task["detail"] = message
                cls._notify("task_updated", task)

    @classmethod
    def fail_task(cls, task_id: str, error_msg: str):
        with cls._lock:
            if task_id in cls._tasks:
                task = cls._tasks[task_id]
                task["status"] = "error"
                task["error"] = str(error_msg)
                task["detail"] = f"Erreur : {error_msg}"
                cls._notify("task_updated", task)

    @classmethod
    def dismiss_task(cls, task_id: str):
        with cls._lock:
            cls._tasks.pop(task_id, None)

    @classmethod
    def get_all_tasks(cls) -> List[Dict[str, Any]]:
        with cls._lock:
            return list(cls._tasks.values())

    @classmethod
    def push_event(cls, event_type: str, data: dict):
        """Envoie un événement générique à l'interface WebView.

        Alias de compatibilité utilisé par audio_studio.py pour signaler la
        progression des tâches longues (génération de script, synthèse audio).
        Crée automatiquement la tâche si elle n'existe pas encore.

        Args:
            event_type: Type d'événement (ex: ``"task_progress"``).
            data:       Dictionnaire de données de l'événement. Champs reconnus :
                        ``task_id``, ``title``, ``progress`` (int 0-100), ``message`` (str).
        """
        task_id = data.get("task_id", "audio_studio")
        with cls._lock:
            if task_id not in cls._tasks:
                cls.start_task(task_id, data.get("title", task_id))
            task = cls._tasks.get(task_id)
            if task:
                if "progress" in data:
                    task["progress"] = min(100, max(0, int(data["progress"])))
                if "message" in data:
                    task["detail"] = data["message"]
                cls._notify(event_type, task)

    @classmethod
    def _notify(cls, event_type: str, task: Dict[str, Any]):
        if cls._window_callback:
            try:
                cls._window_callback(event_type, task)
            except Exception as e:
                logger.debug("[TaskManager] Erreur notification window: %s", e)
