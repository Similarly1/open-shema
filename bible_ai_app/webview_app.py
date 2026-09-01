import os
os.environ["ANONYMIZED_TELEMETRY"] = "False"
import sys
import re
import html
import json
import shutil
import zipfile
import datetime
import threading
import logging
import requests

logger = logging.getLogger("webview_app")

try:
    import webview
except ImportError:
    webview = None
from typing import Dict, List, Any, Optional

# Ajouter le répertoire racine au PYTHONPATH
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

# Purge préventive des .pyc périmés (évite les crashs sur bytecode obsolète après modifications sources)
def _purge_stale_pyc_caches(root: str):
    import glob
    for pyc_path in glob.glob(os.path.join(root, "**", "__pycache__", "*.pyc"), recursive=True):
        cache_dir = os.path.dirname(pyc_path)
        pkg_dir = os.path.dirname(cache_dir)
        basename = os.path.basename(pyc_path).split(".")[0]
        py_path = os.path.join(pkg_dir, basename + ".py")
        if os.path.exists(py_path) and os.path.getmtime(py_path) > os.path.getmtime(pyc_path):
            try:
                os.remove(pyc_path)
            except OSError:
                pass

_purge_stale_pyc_caches(current_dir)

from core.bible_json_loader import BibleJsonLoader, extract_verse_text
from core.reference_parser import (
    get_french_book_name,
    resolve_book_input,
    parse_smart_book_input,
    BOOKS_OT,
    BOOKS_NT,
    BOOKS_DEUTERO,
    ALL_BOOKS,
    BOOK_MAPPING,
    strip_accents
)
from core.pericope_manager import PericopeManager
from core.commentary_loader import CommentaryLoader
from core.dictionary_manager import DictionaryManager
from core.original_languages_manager import OriginalLanguagesManager
from core.notes_manager import NotesManager
from core.config import (
    load_config,
    save_config,
    DEFAULT_NOTE_TITLE_SYSTEM_PROMPT,
    DEFAULT_NOTE_TAGS_SYSTEM_PROMPT
)
from core.sermons_manager import SermonsManager
from core.highlights_manager import HighlightsManager
from core.maps_manager import MapsManager
from gui.library_utils import load_books_metadata, save_books_metadata
from core.ai_session_manager import AISessionManager
from core.secrets_manager import migrate_secrets_from_config, load_secrets_into_config
from core.native_notifications import send_windows_toast

from api._utils import (
    strip_xml_tags,
    parse_reverse_interlinear_verse,
    load_bibles_registry,
    find_bible_registry_entry,
    get_cover_data_url,
    BIBLES_REGISTRY_FILE,
    BIBLE_CANONICAL_INFO
)
from api.window import (
    set_global_window,
    get_global_window,
    on_window_shown,
    on_commentary_shown,
    get_work_area,
    get_fullscreen_bounds,
    get_monitors_layout
)

def get_active_window():
    return get_global_window()

# Mixin imports
from api.bible_reader import BibleReaderMixin
from api.commentary import CommentaryMixin
from api.study import StudyMixin
from api.ai import AiMixin
from api.library import LibraryMixin
from api.import_mgr import ImportMixin
from api.settings import SettingsMixin
from api.window import WindowMixin
from api.content import ContentMixin


class BibleAppApi(BibleReaderMixin, CommentaryMixin, StudyMixin, AiMixin,
                  LibraryMixin, ImportMixin, SettingsMixin, WindowMixin, ContentMixin):
    """
    API Bridge exposée au Frontend Webview JavaScript.
    Chaque méthode publique est directement invocable via window.pywebview.api.<nom_methode>(...).
    """

    def __init__(self):
        raw_config = load_config()
        raw_config = migrate_secrets_from_config(raw_config)
        self.config = load_secrets_into_config(raw_config)


def push_task_update(event_type: str, task_data: dict):
    win = get_global_window()
    try:
        if win:
            json_str = json.dumps(task_data)
            win.evaluate_js(f"window.TaskManager && window.TaskManager.handleTaskEvent('{event_type}', {json_str})")
    except Exception as e:
        logger.debug(f"push_task_update error: {e}")


def main():
    from core.task_manager import TaskManager
    TaskManager.set_window_callback(push_task_update)

    api = BibleAppApi()
    
    html_path = os.path.join(current_dir, "web", "index.html")
    wx, wy, ww, wh = get_work_area()
    
    win = webview.create_window(
        title="Open Shema — Lecteur & Assistant d'Étude Biblique",
        url=html_path,
        js_api=api,
        x=wx,
        y=wy,
        width=ww,
        height=wh,
        min_size=(1050, 680),
        frameless=True,
        easy_drag=False,
        background_color="#0F172A"
    )
    set_global_window(win)
    win.events.shown += on_window_shown
    
    # Lancement avec Edge WebView2
    webview.start(debug=False)


if __name__ == "__main__":
    main()
