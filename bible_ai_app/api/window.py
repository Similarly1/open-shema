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

def set_global_window(win):
    global _GLOBAL_WINDOW
    _GLOBAL_WINDOW = win

def get_global_window():
    global _GLOBAL_WINDOW
    return _GLOBAL_WINDOW

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


def on_window_shown(*args, **kwargs):
    global _GLOBAL_WINDOW, _IS_MAXIMIZED
    try:
        if _GLOBAL_WINDOW and hasattr(_GLOBAL_WINDOW, 'native') and _GLOBAL_WINDOW.native:
            hwnd = _GLOBAL_WINDOW.native.Handle.ToInt32()
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
    def get_window_state(self):
        global _IS_MAXIMIZED, _IS_FULLSCREEN
        return {"is_maximized": _IS_MAXIMIZED, "is_fullscreen": _IS_FULLSCREEN}

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
        global _GLOBAL_WINDOW, _COMMENTARY_WINDOW
        
        # 1. Fermer d'abord la fenêtre secondaire si elle est ouverte
        if _COMMENTARY_WINDOW:
            try:
                _COMMENTARY_WINDOW.destroy()
            except Exception as e:
                logger.debug("Erreur destruction fenêtre secondaire: %s", e)
            _COMMENTARY_WINDOW = None

        # 2. Fermer la fenêtre principale
        win = _GLOBAL_WINDOW
        _GLOBAL_WINDOW = None
        
        if win:
            # Essayer d'abord un envoi WM_CLOSE natif au HWND si disponible
            try:
                if hasattr(win, 'native') and win.native and user32:
                    hwnd = win.native.Handle.ToInt32()
                    if hwnd:
                        WM_CLOSE = 0x0010
                        user32.PostMessageW(hwnd, WM_CLOSE, 0, 0)
            except Exception as e:
                logger.debug("Erreur WM_CLOSE: %s", e)

            # Puis appeler destroy() de pywebview
            try:
                win.destroy()
            except Exception as e:
                logger.warning(f"Erreur destroy fenêtre principale: {e}")

        # 3. Sécurité absolue : garantir la fin du processus si des threads de fond subsistent
        def _terminate_process():
            time.sleep(0.3)
            try:
                os._exit(0)
            except Exception:
                pass

        threading.Thread(target=_terminate_process, daemon=True).start()
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
        """
        global _COMMENTARY_WINDOW, _COMMENTARY_IS_MAXIMIZED, _COMMENTARY_RESTORE_BOUNDS, _COMMENTARY_TARGET_BOUNDS, _LAST_ACTIVE_PASSAGE
        
        if _COMMENTARY_WINDOW is not None:
            try:
                _COMMENTARY_WINDOW.restore()
                _COMMENTARY_WINDOW.show()
                return {"success": True, "already_open": True}
            except Exception as e:
                logger.warning(f"Erreur réactivation fenêtre commentaire: {e}")
                _COMMENTARY_WINDOW = None

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
        
        def on_comm_closed():
            global _COMMENTARY_WINDOW, _GLOBAL_WINDOW
            _COMMENTARY_WINDOW = None
            logger.info("Fenêtre de commentaires détachée fermée.")
            if _GLOBAL_WINDOW:
                try:
                    _GLOBAL_WINDOW.evaluate_js("window.MultiwindowSync && window.MultiwindowSync.handleSecondaryWindowClosed()")
                except Exception as _silent_e:
                    logger.debug("Erreur ignoree : %s", _silent_e)

        try:
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
                background_color="#0F172A"
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

    def close_commentary_window(self) -> Dict[str, Any]:
        """Ferme la fenêtre de commentaires détachée."""
        global _COMMENTARY_WINDOW
        if _COMMENTARY_WINDOW:
            try:
                _COMMENTARY_WINDOW.destroy()
            except Exception as e:
                logger.warning(f"Erreur destruction fenêtre commentaire: {e}")
            _COMMENTARY_WINDOW = None
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
                    _COMMENTARY_WINDOW.evaluate_js(
                        f"window.CommentaryWindow && window.CommentaryWindow.handleVerseChanged('{book_code}', {ch_int}, {v_int})"
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
                js_call = f"window.BibleReader && window.BibleReader.navigateTo('{book_code}', {ch_int}, {v_int})"
                _GLOBAL_WINDOW.evaluate_js(js_call)
            except Exception as e:
                logger.debug(f"Erreur evaluate_js navigate_main: {e}")
        return {"success": True}
