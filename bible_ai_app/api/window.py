"""
WindowMixin - Extracted from BibleAppApi and handles window operations & multi-window sync.
"""
import os
import sys
import time
import logging
import json
import threading
import traceback
import webview
from typing import Dict, List, Any, Optional
import ctypes
from ctypes import wintypes

logger = logging.getLogger(__name__)

from api._utils import (
    current_dir,
    get_french_book_name,
    send_windows_toast
)

# ── Module-level Global Window State ──────────────────────────────────────────
_GLOBAL_WINDOW = None
_IS_MAXIMIZED = True
_IS_FULLSCREEN = False
_RESTORE_BOUNDS = (80, 50, 1280, 800)

_COMMENTARY_WINDOW = None
_COMMENTARY_IS_MAXIMIZED = False
_COMMENTARY_RESTORE_BOUNDS = (100, 60, 1100, 750)
_COMMENTARY_TARGET_BOUNDS = (0, 0, 1200, 800)
_LAST_ACTIVE_PASSAGE = ("Gen", 1, 1)
_COMM_LOCK = threading.Lock()
_IS_CREATING_COMM_WINDOW = False

_DETACHED_WINDOWS: Dict[str, Any] = {}
_DETACHED_MAXIMIZED: Dict[str, bool] = {}
_DETACHED_RESTORE_BOUNDS: Dict[str, tuple] = {}
_DETACHED_LOCK = threading.Lock()

def set_global_window(win):
    global _GLOBAL_WINDOW
    _GLOBAL_WINDOW = win

def get_global_window():
    global _GLOBAL_WINDOW
    return _GLOBAL_WINDOW

def get_active_window():
    return get_global_window()

def set_commentary_window(win):
    global _COMMENTARY_WINDOW
    _COMMENTARY_WINDOW = win

def get_commentary_window():
    global _COMMENTARY_WINDOW
    return _COMMENTARY_WINDOW


try:
    user32 = ctypes.windll.user32
except Exception:
    user32 = None

class RECT(ctypes.Structure):
    _fields_ = [
        ('left', wintypes.LONG),
        ('top', wintypes.LONG),
        ('right', wintypes.LONG),
        ('bottom', wintypes.LONG)
    ]

class MONITORINFO(ctypes.Structure):
    _fields_ = [
        ('cbSize', wintypes.DWORD),
        ('rcMonitor', RECT),
        ('rcWork', RECT),
        ('dwFlags', wintypes.DWORD)
    ]

def get_work_area(hwnd=None):
    try:
        if hwnd and user32:
            MONITOR_DEFAULTTONEAREST = 2
            hmonitor = user32.MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST)
            mi = MONITORINFO()
            mi.cbSize = ctypes.sizeof(MONITORINFO)
            if user32.GetMonitorInfoW(hmonitor, ctypes.byref(mi)):
                rc = mi.rcWork
                w = rc.right - rc.left
                h = rc.bottom - rc.top
                return rc.left, rc.top, (w if w > 600 else 1440), (h if h > 400 else 850)
    except Exception:
        pass
    try:
        if user32:
            rect = RECT()
            SPI_GETWORKAREA = 48
            user32.SystemParametersInfoW(SPI_GETWORKAREA, 0, ctypes.byref(rect), 0)
            w = rect.right - rect.left
            h = rect.bottom - rect.top
            return rect.left, rect.top, (w if w > 600 else 1440), (h if h > 400 else 850)
    except Exception:
        pass
    return 0, 0, 1440, 850

def get_fullscreen_bounds(hwnd=None):
    try:
        if hwnd and user32:
            MONITOR_DEFAULTTONEAREST = 2
            hmonitor = user32.MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST)
            mi = MONITORINFO()
            mi.cbSize = ctypes.sizeof(MONITORINFO)
            if user32.GetMonitorInfoW(hmonitor, ctypes.byref(mi)):
                rc = mi.rcMonitor
                w = int(rc.right - rc.left)
                h = int(rc.bottom - rc.top)
                return int(rc.left), int(rc.top), (w if w > 600 else 1920), (h if h > 400 else 1080)
    except Exception:
        pass
    try:
        if user32:
            w = user32.GetSystemMetrics(0)
            h = user32.GetSystemMetrics(1)
            return 0, 0, (w if w > 600 else 1920), (h if h > 400 else 1080)
    except Exception:
        pass
    return 0, 0, 1920, 1080

def get_monitors_layout():
    monitors = []
    def _enum_proc(hMonitor, hdcMonitor, lprcMonitor, dwData):
        try:
            mi = MONITORINFO()
            mi.cbSize = ctypes.sizeof(MONITORINFO)
            if user32 and user32.GetMonitorInfoW(hMonitor, ctypes.byref(mi)):
                rc = mi.rcWork
                is_primary = bool(mi.dwFlags & 1)
                monitors.append({
                    "x": int(rc.left),
                    "y": int(rc.top),
                    "width": int(rc.right - rc.left),
                    "height": int(rc.bottom - rc.top),
                    "is_primary": is_primary
                })
        except Exception:
            pass
        return True
    try:
        if user32:
            EnumDisplayMonitorsProc = ctypes.WINFUNCTYPE(
                wintypes.BOOL, wintypes.HMONITOR, wintypes.HDC, ctypes.POINTER(RECT), wintypes.LPARAM
            )
            user32.EnumDisplayMonitors(None, None, EnumDisplayMonitorsProc(_enum_proc), 0)
    except Exception:
        pass
    if not monitors:
        wx, wy, ww, wh = get_work_area()
        monitors.append({"x": wx, "y": wy, "width": ww, "height": wh, "is_primary": True})
    return monitors


def _apply_window_icon(hwnd):
    """Applique l'icône officielle Open Shema au HWND Windows (barre des tâches et titre)."""
    if not hwnd or not user32:
        return
    try:
        candidate_paths = [
            os.path.join(current_dir, "assets", "icon.ico"),
            os.path.join(os.path.dirname(sys.executable), "assets", "icon.ico"),
            os.path.join(getattr(sys, "_MEIPASS", ""), "assets", "icon.ico")
        ]
        icon_path = next((p for p in candidate_paths if p and os.path.exists(p)), None)
        if icon_path:
            WM_SETICON = 0x0080
            ICON_SMALL = 0
            ICON_BIG = 1
            IMAGE_ICON = 1
            LR_LOADFROMFILE = 0x00000010
            LR_DEFAULTSIZE = 0x00000040

            hicon_big = user32.LoadImageW(0, icon_path, IMAGE_ICON, 0, 0, LR_LOADFROMFILE | LR_DEFAULTSIZE)
            hicon_small = user32.LoadImageW(0, icon_path, IMAGE_ICON, 16, 16, LR_LOADFROMFILE)
            if hicon_big:
                user32.SendMessageW(hwnd, WM_SETICON, ICON_BIG, hicon_big)
            if hicon_small:
                user32.SendMessageW(hwnd, WM_SETICON, ICON_SMALL, hicon_small)
    except Exception as icon_err:
        logger.debug(f"Avertissement application icône native: {icon_err}")


def on_window_shown(*args, **kwargs):
    global _GLOBAL_WINDOW, _IS_MAXIMIZED
    try:
        if _GLOBAL_WINDOW and hasattr(_GLOBAL_WINDOW, 'native') and _GLOBAL_WINDOW.native:
            hwnd = _GLOBAL_WINDOW.native.Handle.ToInt32()
            _apply_window_icon(hwnd)
            wx, wy, ww, wh = get_work_area()
            if user32:
                user32.SetWindowPos(hwnd, 0, wx, wy, ww, wh, 0x0040)
            _IS_MAXIMIZED = True
        
        # Sécurité : neutraliser le déplacement si la fenêtre est agrandie
        if _GLOBAL_WINDOW and hasattr(_GLOBAL_WINDOW, 'move'):
            orig_move = _GLOBAL_WINDOW.move
            def safe_move(x, y):
                global _IS_MAXIMIZED, _IS_FULLSCREEN
                if _IS_MAXIMIZED or _IS_FULLSCREEN:
                    return
                try:
                    orig_move(x, y)
                except Exception as _silent_e:
                    logger.debug("Erreur ignoree : %s", _silent_e)
            _GLOBAL_WINDOW.move = safe_move
    except Exception as e:
        logger.warning(f"Erreur initialisation agrandissement: {e}")


def on_commentary_shown(*args, **kwargs):
    global _COMMENTARY_WINDOW, _COMMENTARY_IS_MAXIMIZED, _COMMENTARY_TARGET_BOUNDS, _LAST_ACTIVE_PASSAGE
    try:
        if _COMMENTARY_WINDOW and hasattr(_COMMENTARY_WINDOW, 'native') and _COMMENTARY_WINDOW.native:
            hwnd = _COMMENTARY_WINDOW.native.Handle.ToInt32()
            _apply_window_icon(hwnd)
            
            # Activer les poignées de redimensionnement natives sur les 4 bords et 4 coins
            GWL_STYLE = -16
            WS_THICKFRAME = 0x00040000
            if user32:
                current_style = user32.GetWindowLongW(hwnd, GWL_STYLE)
                user32.SetWindowLongW(hwnd, GWL_STYLE, current_style | WS_THICKFRAME)

                wx, wy, ww, wh = _COMMENTARY_TARGET_BOUNDS
                user32.SetWindowPos(hwnd, 0, wx, wy, ww, wh, 0x0040 | 0x0020)
            
            # Neutraliser le déplacement souris si la fenêtre est maximisée / plein écran
            if hasattr(_COMMENTARY_WINDOW, 'move'):
                orig_comm_move = _COMMENTARY_WINDOW.move
                def safe_comm_move(x, y):
                    global _COMMENTARY_IS_MAXIMIZED
                    if _COMMENTARY_IS_MAXIMIZED:
                        return
                    try:
                        orig_comm_move(x, y)
                    except Exception as _silent_e:
                        logger.debug("Erreur ignoree : %s", _silent_e)
                _COMMENTARY_WINDOW.move = safe_comm_move

            # Préparation et envoi asynchrone des données pour ne jamais bloquer le thread d'affichage natif
            def async_push_data():
                try:
                    b, ch, v = _LAST_ACTIVE_PASSAGE
                    from webview_app import BibleAppApi
                    api = BibleAppApi()
                    data = api.get_chapter_commentaries_grouped(b, ch)
                    json_str = json.dumps(data)
                    import base64
                    b64_str = base64.b64encode(json_str.encode('utf-8')).decode('utf-8')
                    for delay in (0.05, 0.25, 0.75):
                        time.sleep(delay)
                        if _COMMENTARY_WINDOW:
                            try:
                                _COMMENTARY_WINDOW.evaluate_js(
                                    f"window.CommentaryWindow && window.CommentaryWindow.receiveChapterDataB64('{b64_str}', {v})"
                                )
                            except Exception as _silent_e:
                                logger.debug("Erreur ignoree : %s", _silent_e)
                except Exception as ex:
                    logger.debug(f"async_push_data error: {ex}")

            threading.Thread(target=async_push_data, daemon=True).start()
    except Exception as e:
        logger.warning(f"Erreur on_commentary_shown: {e}")


class WindowMixin:
    def get_window_state(self, view_id: str = None) -> Dict[str, Any]:
        global _IS_MAXIMIZED, _IS_FULLSCREEN, _DETACHED_MAXIMIZED
        if view_id:
            clean_view = str(view_id).replace("view-", "")
            if clean_view in _DETACHED_MAXIMIZED:
                return {"is_maximized": _DETACHED_MAXIMIZED[clean_view], "is_fullscreen": False}
        return {"is_maximized": _IS_MAXIMIZED, "is_fullscreen": _IS_FULLSCREEN}

    def start_window_drag(self, view_id: str = None) -> Dict[str, Any]:
        """Déclenche le déplacement natif Windows (Aero drag) pour la fenêtre active ou détachée."""
        global _GLOBAL_WINDOW, _DETACHED_WINDOWS, _DETACHED_LOCK
        hwnd = None
        target_win = None
        if view_id:
            clean_view = str(view_id).replace("view-", "")
            with _DETACHED_LOCK:
                target_win = _DETACHED_WINDOWS.get(clean_view)

        if not target_win:
            target_win = _GLOBAL_WINDOW

        if target_win and hasattr(target_win, 'native') and target_win.native:
            try:
                hwnd = target_win.native.Handle.ToInt32()
            except Exception:
                pass

        if not hwnd and user32:
            try:
                hwnd = user32.GetForegroundWindow()
            except Exception:
                pass

        if hwnd and user32:
            try:
                user32.ReleaseCapture()
                user32.SendMessageW(hwnd, 0x00A1, 2, 0)  # WM_NCLBUTTONDOWN, HTCAPTION = 2
                return {"success": True}
            except Exception as e:
                logger.debug(f"start_window_drag error: {e}")
        return {"success": False}

    def show_system_notification(self, title: str = "Open Shema", message: str = "") -> Dict[str, Any]:
        """Affiche une notification native Windows Toast / Balloon en tâche de fond."""
        send_windows_toast(title, message)
        return {"success": True}

    def minimize_window(self):
        global _GLOBAL_WINDOW
        if _GLOBAL_WINDOW:
            try:
                _GLOBAL_WINDOW.minimize()
            except Exception as e:
                logger.warning(f"Erreur minimize: {e}")
        return {"success": True}

    def maximize_window(self):
        global _GLOBAL_WINDOW, _IS_MAXIMIZED, _RESTORE_BOUNDS
        if not _GLOBAL_WINDOW:
            return {"success": False}

        hwnd = None
        try:
            if hasattr(_GLOBAL_WINDOW, 'native') and _GLOBAL_WINDOW.native:
                hwnd = _GLOBAL_WINDOW.native.Handle.ToInt32()
        except Exception as _silent_e:
            logger.debug("Erreur ignoree : %s", _silent_e)

        if _IS_MAXIMIZED:
            # Restaurer à la taille fenêtrée
            _IS_MAXIMIZED = False
            rx, ry, rw, rh = _RESTORE_BOUNDS
            if hwnd and user32:
                user32.SetWindowPos(hwnd, 0, rx, ry, rw, rh, 0x0040)
            else:
                try:
                    _GLOBAL_WINDOW.move(rx, ry)
                    _GLOBAL_WINDOW.resize(rw, rh)
                except Exception as _silent_e:
                    logger.debug("Erreur ignoree : %s", _silent_e)
        else:
            # Sauvegarder les dimensions actuelles avant agrandissement
            if hwnd and user32:
                try:
                    curr_rect = RECT()
                    user32.GetWindowRect(hwnd, ctypes.byref(curr_rect))
                    w = curr_rect.right - curr_rect.left
                    h = curr_rect.bottom - curr_rect.top
                    if w > 600 and h > 400:
                        _RESTORE_BOUNDS = (curr_rect.left, curr_rect.top, w, h)
                except Exception as _silent_e:
                    logger.debug("Erreur ignoree : %s", _silent_e)

            # Agrandir pour occuper tout l'espace de travail (barre des tâches visible)
            wx, wy, ww, wh = get_work_area(hwnd)
            _IS_MAXIMIZED = True
            if hwnd and user32:
                user32.SetWindowPos(hwnd, 0, wx, wy, ww, wh, 0x0040)
            else:
                try:
                    _GLOBAL_WINDOW.move(wx, wy)
                    _GLOBAL_WINDOW.resize(ww, wh)
                except Exception as _silent_e:
                    logger.debug("Erreur ignoree : %s", _silent_e)
        return {"success": True, "is_maximized": _IS_MAXIMIZED}

    def toggle_fullscreen(self):
        global _GLOBAL_WINDOW, _IS_FULLSCREEN, _IS_MAXIMIZED, _RESTORE_BOUNDS
        if not _GLOBAL_WINDOW:
            return {"success": False}

        hwnd = None
        try:
            if hasattr(_GLOBAL_WINDOW, 'native') and _GLOBAL_WINDOW.native:
                hwnd = _GLOBAL_WINDOW.native.Handle.ToInt32()
        except Exception as _silent_e:
            logger.debug("Erreur ignoree : %s", _silent_e)

        if _IS_FULLSCREEN:
            # QUITTER LE PLEIN ÉCRAN
            _IS_FULLSCREEN = False
            if _IS_MAXIMIZED:
                wx, wy, ww, wh = get_work_area(hwnd)
                if hwnd and user32:
                    user32.SetWindowPos(hwnd, 0, wx, wy, ww, wh, 0x0040)
                else:
                    try:
                        _GLOBAL_WINDOW.move(wx, wy)
                        _GLOBAL_WINDOW.resize(ww, wh)
                    except Exception as _silent_e:
                        logger.debug("Erreur ignoree : %s", _silent_e)
            else:
                rx, ry, rw, rh = _RESTORE_BOUNDS
                if hwnd and user32:
                    user32.SetWindowPos(hwnd, 0, rx, ry, rw, rh, 0x0040)
                else:
                    try:
                        _GLOBAL_WINDOW.move(rx, ry)
                        _GLOBAL_WINDOW.resize(rw, rh)
                    except Exception as _silent_e:
                        logger.debug("Erreur ignoree : %s", _silent_e)
        else:
            # ENTRER EN PLEIN ÉCRAN TOTAL (Couvre la barre des tâches)
            _IS_FULLSCREEN = True
            if not _IS_MAXIMIZED and hwnd and user32:
                try:
                    curr_rect = RECT()
                    user32.GetWindowRect(hwnd, ctypes.byref(curr_rect))
                    w = curr_rect.right - curr_rect.left
                    h = curr_rect.bottom - curr_rect.top
                    if w > 600 and h > 400:
                        _RESTORE_BOUNDS = (curr_rect.left, curr_rect.top, w, h)
                except Exception as _silent_e:
                    logger.debug("Erreur ignoree : %s", _silent_e)

            fx, fy, fw, fh = get_fullscreen_bounds(hwnd)
            if hwnd and user32:
                user32.SetWindowPos(hwnd, 0, fx, fy, fw, fh, 0x0040)
            else:
                try:
                    _GLOBAL_WINDOW.move(fx, fy)
                    _GLOBAL_WINDOW.resize(fw, fh)
                except Exception as _silent_e:
                    logger.debug("Erreur ignoree : %s", _silent_e)

        return {"success": True, "is_fullscreen": _IS_FULLSCREEN}

    def close_window(self):
        global _GLOBAL_WINDOW, _COMMENTARY_WINDOW, _DETACHED_WINDOWS, _DETACHED_LOCK
        
        # Copier les références et réinitialiser l'état global
        comm_win = _COMMENTARY_WINDOW
        _COMMENTARY_WINDOW = None
        main_win = _GLOBAL_WINDOW
        _GLOBAL_WINDOW = None
        
        with _DETACHED_LOCK:
            detached_to_close = list(_DETACHED_WINDOWS.values())
            _DETACHED_WINDOWS.clear()

        def _do_async_close():
            # Laisser 50ms au callback RPC JS de pywebview pour se terminer proprement sans ObjectDisposedException
            time.sleep(0.05)
            
            for d_win in detached_to_close:
                try:
                    d_win.destroy()
                except Exception as e:
                    logger.debug("Erreur destruction fenêtre détachée: %s", e)

            if comm_win:
                try:
                    comm_win.destroy()
                except Exception as e:
                    logger.debug("Erreur destruction fenêtre secondaire: %s", e)

            if main_win:
                try:
                    main_win.destroy()
                except Exception as e:
                    logger.debug("Erreur destroy fenêtre principale: %s", e)

            # Fermeture définitive propre du process
            time.sleep(0.12)
            try:
                os._exit(0)
            except Exception:
                pass

        threading.Thread(target=_do_async_close, daemon=True).start()
        return {"success": True}

    # =========================================================================
    # GESTION MULTI-FENÊTRES (ÉCRAN 2 & COMMENTAIRES DÉTACHÉS)
    # =========================================================================

    def get_monitors_info(self) -> Dict[str, Any]:
        """Retourne la configuration des moniteurs physiques détectés."""
        monitors = get_monitors_layout()
        has_second = len(monitors) > 1
        return {
            "count": len(monitors),
            "monitors": monitors,
            "has_second_screen": has_second
        }

    def is_commentary_window_open(self) -> Dict[str, Any]:
        """Indique si la seconde fenêtre de commentaires est ouverte."""
        global _COMMENTARY_WINDOW
        return {"is_open": _COMMENTARY_WINDOW is not None}

    def open_commentary_window(self, book_code: str = "Gen", chapter: int = 1, verse: int = 1) -> Dict[str, Any]:
        """
        Ouvre ou ramène au premier plan la fenêtre de commentaires déportée.
        Cible automatiquement le second écran si présent, sinon ouvre une fenêtre companion à droite.
        Garantit strictement qu'une seule instance de fenêtre est créée (anti-doublon matériel).
        """
        global _COMMENTARY_WINDOW, _COMMENTARY_IS_MAXIMIZED, _COMMENTARY_RESTORE_BOUNDS, _COMMENTARY_TARGET_BOUNDS, _LAST_ACTIVE_PASSAGE, _IS_CREATING_COMM_WINDOW
        
        with _COMM_LOCK:
            if _COMMENTARY_WINDOW is not None:
                try:
                    _COMMENTARY_WINDOW.restore()
                    _COMMENTARY_WINDOW.show()
                    return {"success": True, "already_open": True}
                except Exception as e:
                    logger.warning(f"Erreur réactivation fenêtre commentaire: {e}")
                    _COMMENTARY_WINDOW = None

            if _IS_CREATING_COMM_WINDOW:
                return {"success": True, "in_progress": True}
            
            _IS_CREATING_COMM_WINDOW = True

        try:
            monitors = get_monitors_layout()
            second_monitor = None
            for m in monitors:
                if not m.get("is_primary"):
                    second_monitor = m
                    break

            on_second_screen = False
            if second_monitor:
                wx = second_monitor["x"]
                wy = second_monitor["y"]
                ww = second_monitor["width"]
                wh = second_monitor["height"]
                on_second_screen = True
                _COMMENTARY_IS_MAXIMIZED = True
                _COMMENTARY_RESTORE_BOUNDS = (wx + 40, wy + 40, ww - 80, wh - 80)
            else:
                main_wx, main_wy, main_ww, main_wh = get_work_area()
                ww = min(1480, max(1180, int(main_ww * 0.88)))
                wh = min(980, max(800, int(main_wh * 0.90)))
                wx = main_wx + max(0, (main_ww - ww) // 2)
                wy = main_wy + max(0, (main_wh - wh) // 2)
                on_second_screen = False
                _COMMENTARY_IS_MAXIMIZED = False
                _COMMENTARY_RESTORE_BOUNDS = (wx, wy, ww, wh)

            _COMMENTARY_TARGET_BOUNDS = (wx, wy, ww, wh)
            _LAST_ACTIVE_PASSAGE = (book_code, int(chapter), int(verse))
            html_path = os.path.join(current_dir, "web", "commentary_window.html")
            url_with_params = f"{html_path}?book={book_code}&chapter={chapter}&verse={verse}"
            
            # Détection du thème pour la couleur de fond native initiale
            bg_color = "#0F172A"
            try:
                cfg = getattr(self, 'config', {}) or {}
                theme = cfg.get('theme', 'dark')
                reading_bg = cfg.get('reading_bg', 'auto')
                if theme == 'light' or reading_bg in ('white', 'sepia'):
                    bg_color = "#F8FAFC"
            except Exception as _e:
                pass

            def on_comm_closed():
                global _COMMENTARY_WINDOW, _GLOBAL_WINDOW, _IS_CREATING_COMM_WINDOW
                _COMMENTARY_WINDOW = None
                _IS_CREATING_COMM_WINDOW = False
                logger.info("Fenêtre de commentaires détachée fermée.")
                if _GLOBAL_WINDOW:
                    try:
                        _GLOBAL_WINDOW.evaluate_js("window.MultiwindowSync && window.MultiwindowSync.handleSecondaryWindowClosed()")
                    except Exception as _silent_e:
                        logger.debug("Erreur ignoree : %s", _silent_e)

            _COMMENTARY_WINDOW = webview.create_window(
                title="Open Shema — Commentaires Exégétiques",
                url=url_with_params,
                js_api=self,
                x=wx,
                y=wy,
                width=ww,
                height=wh,
                min_size=(860, 560),
                frameless=True,
                easy_drag=False,
                background_color=bg_color
            )
            _COMMENTARY_WINDOW.events.shown += on_commentary_shown
            _COMMENTARY_WINDOW.events.closed += on_comm_closed
            return {
                "success": True,
                "created": True,
                "on_second_screen": on_second_screen,
                "bounds": {"x": wx, "y": wy, "width": ww, "height": wh}
            }
        except Exception as e:
            logger.error(f"Erreur création fenêtre de commentaires: {e}")
            return {"success": False, "error": str(e)}
        finally:
            _IS_CREATING_COMM_WINDOW = False

    def close_commentary_window(self) -> Dict[str, Any]:
        """Ferme la fenêtre de commentaires détachée."""
        global _COMMENTARY_WINDOW
        comm_win = _COMMENTARY_WINDOW
        _COMMENTARY_WINDOW = None

        if comm_win:
            def _do_close_comm():
                time.sleep(0.05)
                try:
                    comm_win.destroy()
                except Exception as e:
                    logger.debug("Erreur destruction fenêtre commentaire: %s", e)

            threading.Thread(target=_do_close_comm, daemon=True).start()
        return {"success": True}

    def minimize_commentary_window(self) -> Dict[str, Any]:
        """Minimise la fenêtre de commentaires détachée."""
        global _COMMENTARY_WINDOW
        if _COMMENTARY_WINDOW:
            try:
                _COMMENTARY_WINDOW.minimize()
            except Exception as e:
                logger.warning(f"Erreur minimize commentaire: {e}")
        return {"success": True}

    def maximize_commentary_window(self) -> Dict[str, Any]:
        """Bascule l'état maximisé de la fenêtre de commentaires sur son écran actuel."""
        global _COMMENTARY_WINDOW, _COMMENTARY_IS_MAXIMIZED, _COMMENTARY_RESTORE_BOUNDS
        if not _COMMENTARY_WINDOW:
            return {"success": False}

        hwnd = None
        try:
            if hasattr(_COMMENTARY_WINDOW, 'native') and _COMMENTARY_WINDOW.native:
                hwnd = _COMMENTARY_WINDOW.native.Handle.ToInt32()
        except Exception as _silent_e:
            logger.debug("Erreur ignoree : %s", _silent_e)

        if not hwnd or not user32:
            return {"success": False}

        MONITOR_DEFAULTTONEAREST = 2
        hmon = user32.MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST)
        mi = MONITORINFO()
        mi.cbSize = ctypes.sizeof(MONITORINFO)
        if not user32.GetMonitorInfoW(hmon, ctypes.byref(mi)):
            return {"success": False}

        rc = mi.rcWork if (mi.rcWork.right - mi.rcWork.left) > 0 else mi.rcMonitor

        if _COMMENTARY_IS_MAXIMIZED:
            _COMMENTARY_IS_MAXIMIZED = False
            if _COMMENTARY_RESTORE_BOUNDS and rc.left <= _COMMENTARY_RESTORE_BOUNDS[0] < rc.right:
                rx, ry, rw, rh = _COMMENTARY_RESTORE_BOUNDS
            else:
                mw = rc.right - rc.left
                mh = rc.bottom - rc.top
                rw = int(mw * 0.85)
                rh = int(mh * 0.85)
                rx = rc.left + int((mw - rw) / 2)
                ry = rc.top + int((mh - rh) / 2)
            user32.SetWindowPos(hwnd, 0, rx, ry, rw, rh, 0x0040 | 0x0020)
        else:
            try:
                curr_rect = RECT()
                user32.GetWindowRect(hwnd, ctypes.byref(curr_rect))
                w = curr_rect.right - curr_rect.left
                h = curr_rect.bottom - curr_rect.top
                if w > 400 and h > 300:
                    _COMMENTARY_RESTORE_BOUNDS = (curr_rect.left, curr_rect.top, w, h)
            except Exception as _silent_e:
                logger.debug("Erreur ignoree : %s", _silent_e)

            _COMMENTARY_IS_MAXIMIZED = True
            mw = rc.right - rc.left
            mh = rc.bottom - rc.top
            user32.SetWindowPos(hwnd, 0, rc.left, rc.top, mw, mh, 0x0040 | 0x0020)

        try:
            _COMMENTARY_WINDOW.evaluate_js(
                f"window.CommentaryWindow && window.CommentaryWindow.updateMaximizedState && window.CommentaryWindow.updateMaximizedState({str(_COMMENTARY_IS_MAXIMIZED).lower()})"
            )
        except Exception as _silent_e:
            logger.debug("Erreur ignoree : %s", _silent_e)

        return {"success": True, "is_maximized": _COMMENTARY_IS_MAXIMIZED}

    def toggle_secondary_window_maximize(self) -> Dict[str, Any]:
        """Alias pour maximize_commentary_window."""
        return self.maximize_commentary_window()

    def minimize_secondary_window(self) -> Dict[str, Any]:
        """Alias pour minimize_commentary_window."""
        return self.minimize_commentary_window()

    def close_secondary_window(self) -> Dict[str, Any]:
        """Alias pour close_commentary_window."""
        return self.close_commentary_window()

    def get_current_passage(self) -> Dict[str, Any]:
        """Retourne le dernier passage et verset actif du lecteur."""
        global _LAST_ACTIVE_PASSAGE
        b, ch, v = _LAST_ACTIVE_PASSAGE
        french = get_french_book_name(b)
        return {"book": b, "book_french": french, "chapter": ch, "verse": v}

    def sync_passage(self, book_code: str, book_french: str = "", chapter: int = 1, verse: int = 1) -> Dict[str, Any]:
        """Diffuse le passage actif vers la fenêtre de commentaires avec ses données complètes."""
        global _COMMENTARY_WINDOW, _LAST_ACTIVE_PASSAGE
        ch_int = int(chapter)
        v_int = int(verse) if verse else 1
        french = book_french or get_french_book_name(book_code)
        _LAST_ACTIVE_PASSAGE = (book_code, ch_int, v_int)
        if _COMMENTARY_WINDOW:
            try:
                data = self.get_chapter_commentaries_grouped(book_code, ch_int)
                json_str = json.dumps(data)
                import base64
                b64_str = base64.b64encode(json_str.encode('utf-8')).decode('utf-8')
                _COMMENTARY_WINDOW.evaluate_js(
                    f"window.CommentaryWindow && window.CommentaryWindow.receiveChapterDataB64('{b64_str}', {v_int})"
                )
            except Exception as e:
                logger.debug(f"Erreur evaluate_js sync_passage: {e}")
        return {"success": True}

    def sync_verse(self, book_code: str, chapter: int, verse: int) -> Dict[str, Any]:
        """Diffuse le verset visible vers la fenêtre de commentaires."""
        global _COMMENTARY_WINDOW, _LAST_ACTIVE_PASSAGE
        ch_int = int(chapter)
        v_int = int(verse) if verse else 1
        prev_b, prev_ch, _ = _LAST_ACTIVE_PASSAGE
        _LAST_ACTIVE_PASSAGE = (book_code, ch_int, v_int)
        if _COMMENTARY_WINDOW:
            try:
                if prev_b != book_code or prev_ch != ch_int:
                    data = self.get_chapter_commentaries_grouped(book_code, ch_int)
                    json_str = json.dumps(data)
                    import base64
                    b64_str = base64.b64encode(json_str.encode('utf-8')).decode('utf-8')
                    _COMMENTARY_WINDOW.evaluate_js(
                        f"window.CommentaryWindow && window.CommentaryWindow.receiveChapterDataB64('{b64_str}', {v_int})"
                    )
                else:
                    import json as _json
                    _safe_book = _json.dumps(str(book_code))
                    _COMMENTARY_WINDOW.evaluate_js(
                        f"window.CommentaryWindow && window.CommentaryWindow.handleVerseChanged({_safe_book}, {ch_int}, {v_int})"
                    )
            except Exception as e:
                logger.debug(f"Erreur evaluate_js sync_verse: {e}")
        return {"success": True}

    def navigate_main_from_secondary(self, book_code: str, chapter: int, verse: int = 1) -> Dict[str, Any]:
        """Permet à la fenêtre secondaire de positionner la Bible principale."""
        global _GLOBAL_WINDOW, _LAST_ACTIVE_PASSAGE
        ch_int = int(chapter)
        v_int = int(verse) if verse else 1
        _LAST_ACTIVE_PASSAGE = (book_code, ch_int, v_int)
        if _GLOBAL_WINDOW:
            try:
                import json as _json
                _safe_book = _json.dumps(str(book_code))
                js_call = f"window.BibleReader && window.BibleReader.navigateTo({_safe_book}, {ch_int}, {v_int})"
                _GLOBAL_WINDOW.evaluate_js(js_call)
            except Exception as e:
                logger.debug(f"Erreur evaluate_js navigate_main: {e}")
        return {"success": True}

    # =========================================================================
    # GESTION UNIVERSELLE DES PAGES EN FENÊTRES DÉTACHÉES (MULTI-ÉCRAN / SECOND ÉCRAN)
    # =========================================================================

    def is_detached_window_open(self, view_id: str) -> Dict[str, Any]:
        """Indique si une fenêtre détachée est déjà ouverte pour cette vue."""
        global _DETACHED_WINDOWS, _DETACHED_LOCK
        with _DETACHED_LOCK:
            return {"is_open": view_id in _DETACHED_WINDOWS}

    def open_detached_window(self, view_id: str, title: str = "") -> Dict[str, Any]:
        """
        Ouvre n'importe quelle vue de l'application dans une nouvelle fenêtre indépendante.
        Place automatiquement sur le second écran si présent, sinon en fenêtre cascade sur l'écran 1.
        Garantit l'anti-doublon pour une même vue.
        """
        global _DETACHED_WINDOWS, _DETACHED_MAXIMIZED, _DETACHED_RESTORE_BOUNDS, _DETACHED_LOCK
        if not view_id:
            return {"success": False, "error": "view_id invalide"}

        clean_view = view_id.replace("view-", "")
        with _DETACHED_LOCK:
            # 1. Vérification anti-doublon : ramener au premier plan si déjà ouverte
            if clean_view in _DETACHED_WINDOWS:
                existing_win = _DETACHED_WINDOWS[clean_view]
                try:
                    existing_win.restore()
                    existing_win.show()
                    if hasattr(existing_win, 'native') and existing_win.native and user32:
                        hwnd = existing_win.native.Handle.ToInt32()
                        user32.SetForegroundWindow(hwnd)
                    return {"success": True, "already_open": True, "view_id": clean_view}
                except Exception as ex:
                    logger.warning(f"Erreur réactivation fenêtre détachée [{clean_view}]: {ex}")
                    _DETACHED_WINDOWS.pop(clean_view, None)

        try:
            # 2. Détection des écrans
            monitors = get_monitors_layout()
            second_monitor = None
            for m in monitors:
                if not m.get("is_primary"):
                    second_monitor = m
                    break

            on_second_screen = False
            if second_monitor:
                wx = second_monitor["x"]
                wy = second_monitor["y"]
                ww = second_monitor["width"]
                wh = second_monitor["height"]
                on_second_screen = True
                _DETACHED_MAXIMIZED[clean_view] = True
                _DETACHED_RESTORE_BOUNDS[clean_view] = (wx + 40, wy + 40, ww - 80, wh - 80)
            else:
                main_wx, main_wy, main_ww, main_wh = get_work_area()
                with _DETACHED_LOCK:
                    count = len(_DETACHED_WINDOWS)
                cascade_offset = (count % 6) * 35
                ww = min(1480, max(1100, int(main_ww * 0.86)))
                wh = min(980, max(750, int(main_wh * 0.88)))
                wx = main_wx + max(0, (main_ww - ww) // 2) + cascade_offset
                wy = main_wy + max(0, (main_wh - wh) // 2) + cascade_offset
                on_second_screen = False
                _DETACHED_MAXIMIZED[clean_view] = False
                _DETACHED_RESTORE_BOUNDS[clean_view] = (wx, wy, ww, wh)

            # 3. URL de chargement en mode détaché
            import urllib.parse
            html_path = os.path.join(current_dir, "web", "index.html")
            encoded_view = urllib.parse.quote(clean_view)
            url_with_params = f"{html_path}?view={encoded_view}&mode=detached"

            # 4. Détection du thème pour le fond natif
            bg_color = "#0F172A"
            try:
                cfg = getattr(self, 'config', {}) or {}
                theme = cfg.get('theme', 'dark')
                reading_bg = cfg.get('reading_bg', 'auto')
                if theme == 'light' or reading_bg in ('white', 'sepia'):
                    bg_color = "#F8FAFC"
            except Exception:
                pass

            target_bounds = (wx, wy, ww, wh)
            display_title = f"Open Shema — {title}" if title else f"Open Shema — {clean_view.capitalize()}"

            def on_detached_shown(*args, **kwargs):
                try:
                    with _DETACHED_LOCK:
                        win = _DETACHED_WINDOWS.get(clean_view)
                    if win and hasattr(win, 'native') and win.native:
                        hwnd = win.native.Handle.ToInt32()
                        _apply_window_icon(hwnd)
                        GWL_STYLE = -16
                        WS_THICKFRAME = 0x00040000
                        if user32:
                            current_style = user32.GetWindowLongW(hwnd, GWL_STYLE)
                            user32.SetWindowLongW(hwnd, GWL_STYLE, current_style | WS_THICKFRAME)
                            twx, twy, tww, twh = target_bounds
                            user32.SetWindowPos(hwnd, 0, twx, twy, tww, twh, 0x0040 | 0x0020)
                    is_max = _DETACHED_MAXIMIZED.get(clean_view, False)
                    if win:
                        try:
                            win.evaluate_js(f"window.App && window.App.updateWindowState && window.App.updateWindowState({str(is_max).lower()})")
                        except Exception:
                            pass
                except Exception as sh_err:
                    logger.warning(f"Erreur on_detached_shown [{clean_view}]: {sh_err}")

            def on_detached_closed():
                with _DETACHED_LOCK:
                    _DETACHED_WINDOWS.pop(clean_view, None)
                    _DETACHED_MAXIMIZED.pop(clean_view, None)
                    _DETACHED_RESTORE_BOUNDS.pop(clean_view, None)
                logger.info(f"Fenêtre détachée [{clean_view}] fermée.")

            # 5. Création de la fenêtre
            new_win = webview.create_window(
                title=display_title,
                url=url_with_params,
                js_api=self,
                x=wx,
                y=wy,
                width=ww,
                height=wh,
                min_size=(750, 500),
                frameless=True,
                easy_drag=False,
                background_color=bg_color
            )
            new_win.events.shown += on_detached_shown
            new_win.events.closed += on_detached_closed

            with _DETACHED_LOCK:
                _DETACHED_WINDOWS[clean_view] = new_win

            return {
                "success": True,
                "created": True,
                "view_id": clean_view,
                "on_second_screen": on_second_screen,
                "bounds": {"x": wx, "y": wy, "width": ww, "height": wh}
            }
        except Exception as e:
            logger.error(f"Erreur création fenêtre détachée [{clean_view}]: {e}")
            return {"success": False, "error": str(e)}

    def close_detached_window(self, view_id: str) -> Dict[str, Any]:
        """Ferme la fenêtre détachée d'une vue sans quitter l'application principale."""
        global _DETACHED_WINDOWS, _DETACHED_LOCK
        clean_view = (view_id or "").replace("view-", "")
        with _DETACHED_LOCK:
            win = _DETACHED_WINDOWS.pop(clean_view, None)

        if win:
            def _do_close():
                time.sleep(0.05)
                try:
                    win.destroy()
                except Exception as e:
                    logger.debug(f"Erreur fermeture fenêtre détachée [{clean_view}]: {e}")
            threading.Thread(target=_do_close, daemon=True).start()
            return {"success": True, "closed": True}
        return {"success": False, "error": "Fenêtre introuvable"}

    def minimize_detached_window(self, view_id: str) -> Dict[str, Any]:
        """Minimise la fenêtre détachée spécifiée."""
        global _DETACHED_WINDOWS, _DETACHED_LOCK
        clean_view = (view_id or "").replace("view-", "")
        with _DETACHED_LOCK:
            win = _DETACHED_WINDOWS.get(clean_view)
        if win:
            try:
                win.minimize()
                return {"success": True}
            except Exception as e:
                logger.warning(f"Erreur minimize [{clean_view}]: {e}")
        return {"success": False}

    def maximize_detached_window(self, view_id: str) -> Dict[str, Any]:
        """Bascule l'agrandissement de la fenêtre détachée sur son écran actuel."""
        global _DETACHED_WINDOWS, _DETACHED_MAXIMIZED, _DETACHED_RESTORE_BOUNDS, _DETACHED_LOCK
        clean_view = (view_id or "").replace("view-", "")
        with _DETACHED_LOCK:
            win = _DETACHED_WINDOWS.get(clean_view)
        if not win:
            return {"success": False}

        hwnd = None
        try:
            if hasattr(win, 'native') and win.native:
                hwnd = win.native.Handle.ToInt32()
        except Exception:
            pass

        if not hwnd or not user32:
            return {"success": False}

        try:
            MONITOR_DEFAULTTONEAREST = 2
            hmon = user32.MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST)
            mi = MONITORINFO()
            mi.cbSize = ctypes.sizeof(MONITORINFO)
            if not user32.GetMonitorInfoW(hmon, ctypes.byref(mi)):
                return {"success": False}

            rc = mi.rcWork if (mi.rcWork.right - mi.rcWork.left) > 0 else mi.rcMonitor
            is_max = _DETACHED_MAXIMIZED.get(clean_view, False)

            if is_max:
                _DETACHED_MAXIMIZED[clean_view] = False
                prev_bounds = _DETACHED_RESTORE_BOUNDS.get(clean_view)
                if prev_bounds and rc.left <= prev_bounds[0] < rc.right:
                    rx, ry, rw, rh = prev_bounds
                else:
                    mw = rc.right - rc.left
                    mh = rc.bottom - rc.top
                    rw = int(mw * 0.85)
                    rh = int(mh * 0.85)
                    rx = rc.left + int((mw - rw) / 2)
                    ry = rc.top + int((mh - rh) / 2)
                user32.SetWindowPos(hwnd, 0, rx, ry, rw, rh, 0x0040 | 0x0020)
                new_state = False
            else:
                try:
                    curr_rect = RECT()
                    user32.GetWindowRect(hwnd, ctypes.byref(curr_rect))
                    w = curr_rect.right - curr_rect.left
                    h = curr_rect.bottom - curr_rect.top
                    if w > 400 and h > 300:
                        _DETACHED_RESTORE_BOUNDS[clean_view] = (curr_rect.left, curr_rect.top, w, h)
                except Exception:
                    pass

                _DETACHED_MAXIMIZED[clean_view] = True
                mw = rc.right - rc.left
                mh = rc.bottom - rc.top
                user32.SetWindowPos(hwnd, 0, rc.left, rc.top, mw, mh, 0x0040 | 0x0020)
                new_state = True

            try:
                win.evaluate_js(f"window.App && window.App.updateWindowState && window.App.updateWindowState({str(new_state).lower()})")
            except Exception:
                pass

            return {"success": True, "is_maximized": new_state}
        except Exception as e:
            logger.error(f"Erreur maximize [{clean_view}]: {e}")
            return {"success": False, "error": str(e)}
