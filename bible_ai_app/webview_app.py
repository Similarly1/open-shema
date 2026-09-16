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

# Ajouter le repertoire racine au PYTHONPATH
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

import core.chroma_silencer

# Definir l'AppUserModelID explicite pour que la barre des taches Windows affiche l'icone officielle
try:
    import ctypes
    ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID("Similarly.OpenShema.BibleApp.v1")
except Exception:
    pass

logger = logging.getLogger("webview_app")

try:
    import webview
    import webview.util
    _orig_interop = webview.util.interop_dll_path
    def _safe_interop_dll_path(dll_name: str) -> str:
        try:
            return _orig_interop(dll_name)
        except FileNotFoundError:
            # Securite anti-crash pour les sondes multi-plateformes (win-arm64, win-x86)
            app_root = os.path.dirname(os.path.abspath(__file__))
            fallback_dir = os.path.join(app_root, "_internal", "webview", "lib")
            if os.path.exists(fallback_dir):
                return fallback_dir
            return app_root
    webview.util.interop_dll_path = _safe_interop_dll_path

    # Patch de securisation du pont JavaScript pywebview contre les TypeError sur callbacks orphelins
    def _patch_pywebview_js_bridge():
        try:
            import json as _json
            import traceback as _traceback
            from threading import Thread as _Thread
            import urllib.parse as _urllib_parse

            def _safe_js_bridge_call(window, func_name: str, param, value_id: str) -> None:
                def _call():
                    try:
                        result = func(*func_params)
                        result = _json.dumps(result).replace('\\', '\\\\').replace("'", "\\'")
                        retval = f"{{value: '{result}'}}"
                    except Exception as e:
                        logger.error(_traceback.format_exc())
                        error = {'message': str(e), 'name': type(e).__name__, 'stack': _traceback.format_exc()}
                        result = _json.dumps(error).replace('\\', '\\\\').replace("'", "\\'")
                        retval = f"{{isError: true, value: '{result}'}}"

                    try:
                        # Verifier l'existence de la fonction callback JS avant invocation
                        safe_js = (
                            f'if (window.pywebview && window.pywebview._returnValuesCallbacks && '
                            f'window.pywebview._returnValuesCallbacks["{func_name}"] && '
                            f'typeof window.pywebview._returnValuesCallbacks["{func_name}"]["{value_id}"] === "function") {{ '
                            f'window.pywebview._returnValuesCallbacks["{func_name}"]["{value_id}"]({retval}); '
                            f'}}'
                        )
                        window.evaluate_js(safe_js)
                    except Exception as eval_err:
                        logger.debug("Pywebview callback dropped (%s): %s", func_name, eval_err)

                def get_nested_attribute(obj: object, attr_str: str):
                    attributes = attr_str.split('.')
                    for attr in attributes:
                        obj = getattr(obj, attr, None)
                        if obj is None:
                            return None
                    return obj

                if func_name == 'pywebviewMoveWindow':
                    window.move(*param)
                    return

                if func_name == 'pywebviewEventHandler':
                    event = param['event']
                    node_id = param['nodeId']
                    element = window.dom._elements.get(node_id)
                    if not element:
                        return
                    if event['type'] == 'drop':
                        files = event['dataTransfer'].get('files', [])
                        for file in files:
                            path = [
                                item
                                for item in webview.util._dnd_state['paths']
                                if _urllib_parse.unquote(item[0]) == file['name']
                            ]
                            if len(path) == 0:
                                continue
                            file['pywebviewFullPath'] = _urllib_parse.unquote(path[0][1])
                            webview.util._dnd_state['paths'].remove(path[0])

                    for handler in element._event_handlers.get(event['type'], []):
                        thread = _Thread(target=handler, args=(event,))
                        thread.start()
                    return

                if func_name == 'pywebviewAsyncCallback':
                    value = _json.loads(param) if param is not None else None
                    if callable(window._callbacks[value_id]):
                        window._callbacks[value_id](value)
                    else:
                        logger.error(
                            f'Async function executed and callback is not callable. Returned value {value}'
                        )
                    del window._callbacks[value_id]
                    return

                if func_name == 'pywebviewStateUpdate':
                    window.state.__setattr__(param['key'], param['value'], False)
                    return

                if func_name == 'pywebviewStateDelete':
                    special_key = '__pywebviewHaltUpdate__' + param
                    delattr(window.state, special_key)
                    return

                func = window._functions.get(func_name) or get_nested_attribute(window._js_api, func_name)
                if func is not None:
                    try:
                        func_params = param
                        thread = _Thread(target=_call)
                        thread.start()
                    except Exception:
                        logger.exception('Error occurred while evaluating function %s', func_name)
                else:
                    logger.error('Function %s() does not exist', func_name)

            webview.util.js_bridge_call = _safe_js_bridge_call
            try:
                import webview.platforms.edgechromium as ec
                ec.js_bridge_call = _safe_js_bridge_call
            except Exception:
                pass
        except Exception as _patch_e:
            logger.warning("Erreur securisation pont pywebview : %s", _patch_e)

    _patch_pywebview_js_bridge()
except ImportError:
    webview = None
from typing import Dict, List, Any, Optional

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
from api.updater import UpdaterMixin
from api.audio_studio import AudioStudioMixin


class BibleAppApi(BibleReaderMixin, CommentaryMixin, StudyMixin, AiMixin,
                  LibraryMixin, ImportMixin, SettingsMixin, WindowMixin, ContentMixin,
                  UpdaterMixin, AudioStudioMixin):
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
            # json.dumps() produit un littéral JS sûr avec guillemets doubles et
            # échappe tous les caractères spéciaux — élimine tout risque d'injection JS.
            safe_event_type = json.dumps(str(event_type))
            json_str = json.dumps(task_data)
            win.evaluate_js(f"window.TaskManager && window.TaskManager.handleTaskEvent({safe_event_type}, {json_str})")
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
