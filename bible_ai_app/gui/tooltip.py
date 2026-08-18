import tkinter as tk
import customtkinter as ctk

class BibleTooltip:
    """
    Info-bulle (Tooltip) flottante ultra-rapide et réutilisable.
    Réutilise une unique fenêtre Toplevel (withdraw/deiconify) pour 0 latence,
    aucun clignotement et un positionnement direct au-dessus ou au-dessous du mot.
    """
    def __init__(self, master=None):
        self.master = master
        self.tw = None
        self._current_word = None
        self._after_id = None
        self._init_window()

    def _init_window(self):
        """Initialise la fenêtre toplevel unique réutilisable."""
        try:
            self.tw = tk.Toplevel(self.master)
            self.tw.wm_overrideredirect(True)
            self.tw.wm_attributes("-topmost", True)
            self.tw.withdraw()
            
            # Conteneur principal
            self.container = tk.Frame(
                self.tw,
                highlightthickness=2,
                padx=16,
                pady=12
            )
            self.container.pack(fill="both", expand=True)
            
            # En-tête : Badge Source
            self.source_lbl = tk.Label(
                self.container,
                text="",
                font=("Segoe UI", 10, "bold"),
                anchor="w"
            )
            self.source_lbl.pack(fill="x", anchor="w")
            
            # Titre : Mot original / Translittération / Français
            self.title_lbl = tk.Label(
                self.container,
                text="",
                font=("Segoe UI", 14, "bold"),
                anchor="w",
                justify="left",
                wraplength=400
            )
            self.title_lbl.pack(fill="x", anchor="w", pady=(3, 6))
            
            # Corps : Morphologie, sens, lemmes, définitions
            self.body_lbl = tk.Label(
                self.container,
                text="",
                font=("Segoe UI", 11),
                anchor="w",
                justify="left",
                wraplength=400
            )
            self.body_lbl.pack(fill="x", anchor="w", pady=(0, 6))
            
            # Pied : Indication
            self.hint_lbl = tk.Label(
                self.container,
                text="🖱️ Cliquer pour voir tout l'article dans le volet droit",
                font=("Segoe UI", 9, "italic"),
                anchor="w"
            )
            self.hint_lbl.pack(fill="x", anchor="w", pady=(2, 0))
        except Exception:
            pass

    def show(self, x, y, data, target_rect=None, prefer_side=None):
        """Affiche l'info-bulle directement à côté ou au-dessus/au-dessous du mot/lien survolé."""
        if not data:
            self.hide()
            return
            
        word = data.get("word", "") or data.get("title", "")
        if not self.tw or not self.tw.winfo_exists():
            self._init_window()
            
        is_dark = (ctk.get_appearance_mode() == "Dark")
        bg_color = "#0F172A" if is_dark else "#FFFFFF"
        border_color = "#38BDF8" if is_dark else "#0284C7"
        text_color = "#F8FAFC" if is_dark else "#0F172A"
        badge_color = "#38BDF8" if is_dark else "#0284C7"
        hint_color = "#94A3B8" if is_dark else "#64748B"
        
        base_size = getattr(self.master, 'font_size', 18)
        f_badge = max(10, base_size - 7)
        f_title = max(14, base_size - 2)
        f_body = max(11, base_size - 5)
        f_hint = max(9, base_size - 8)
        wrap_w = max(340, min(420, int(base_size * 20)))
        
        # Mettre à jour les couleurs et textes
        self.container.configure(
            bg=bg_color,
            highlightbackground=border_color,
            highlightcolor=border_color
        )
        
        source_text = data.get("source", "📖 Notice Théologique")
        self.source_lbl.configure(
            text=source_text,
            font=("Segoe UI", f_badge, "bold"),
            fg=badge_color,
            bg=bg_color
        )
        
        title_text = data.get("title", word)
        self.title_lbl.configure(
            text=title_text,
            font=("Segoe UI", f_title, "bold"),
            fg=text_color,
            bg=bg_color,
            wraplength=wrap_w
        )
        
        preview_text = data.get("preview", "").strip()
        if preview_text:
            self.body_lbl.configure(
                text=preview_text,
                font=("Segoe UI", f_body),
                fg=text_color,
                bg=bg_color,
                wraplength=wrap_w
            )
            self.body_lbl.pack(fill="x", anchor="w", pady=(0, 6))
        else:
            self.body_lbl.pack_forget()
            
        hint_text = data.get("hint", "🖱️ Cliquer pour voir tout l'article dans le volet droit")
        self.hint_lbl.configure(
            text=hint_text,
            font=("Segoe UI", f_hint, "italic"),
            fg=hint_color,
            bg=bg_color
        )
        
        # Calcul des dimensions et position
        self.tw.update_idletasks()
        w = self.tw.winfo_reqwidth()
        h = self.tw.winfo_reqheight()
        
        screen_w = self.tw.winfo_screenwidth()
        screen_h = self.tw.winfo_screenheight()
        
        if target_rect:
            t_left, t_top, t_w, t_h = target_rect
            t_bottom = t_top + t_h
            t_right = t_left + t_w
            t_center_x = t_left + (t_w / 2.0)
        else:
            t_left = x
            t_top = y
            t_bottom = y + 20
            t_right = x + 40
            t_center_x = x
            
        # Positionnement selon la préférence
        if prefer_side in ("left", "right", "auto_side") and target_rect:
            side = prefer_side
            if side == "auto_side":
                side = "left" if t_left > screen_w * 0.5 else "right"
                
            if side == "left":
                pos_x = int(t_left - w - 10)
                pos_y = int(max(10, min(t_top - 4, screen_h - h - 10)))
                if pos_x < 10:
                    pos_x = int(max(10, min(t_left, screen_w - w - 10)))
                    pos_y = int(t_bottom + 6)
                    if pos_y + h > screen_h - 10:
                        pos_y = int(t_top - h - 6)
            else: # right
                pos_x = int(t_right + 10)
                pos_y = int(max(10, min(t_top - 4, screen_h - h - 10)))
                if pos_x + w > screen_w - 10:
                    pos_x = int(max(10, min(t_left, screen_w - w - 10)))
                    pos_y = int(t_bottom + 6)
                    if pos_y + h > screen_h - 10:
                        pos_y = int(t_top - h - 6)
        else:
            # Position horizontale centrée sur le mot
            pos_x = int(t_center_x - (w / 2.0))
            pos_x = max(10, min(pos_x, screen_w - w - 10))
            
            # Position verticale : en priorité DESSOUS du mot, sinon DESSUS
            pos_y = int(max(t_bottom + 6, y + 16))
            if pos_y + h > screen_h - 10:
                pos_y = int(min(t_top - h - 6, y - h - 16))
                
        if pos_y < 10:
            pos_y = max(10, min(pos_y, screen_h - h - 10))
            
        self.tw.wm_geometry(f"+{pos_x}+{pos_y}")
        self.tw.deiconify()
        self.tw.lift()
        self._current_word = word

    def hide(self):
        """Masque l'info-bulle sans détruire la fenêtre."""
        if self._after_id and self.master:
            try:
                self.master.after_cancel(self._after_id)
            except Exception:
                pass
            self._after_id = None
            
        if self.tw and self.tw.winfo_exists():
            try:
                self.tw.withdraw()
            except Exception:
                pass
        self._current_word = None


class WidgetTooltip:
    """Info-bulle au survol d'un widget (bouton, icône, etc.)."""
    def __init__(self, widget, text: str):
        self.widget = widget
        self.text = text
        self.tw = None
        self.widget.bind("<Enter>", self.show)
        self.widget.bind("<Leave>", self.hide)

    def show(self, event=None):
        if self.tw or not self.text:
            return
        x = self.widget.winfo_rootx() + 10
        y = self.widget.winfo_rooty() + self.widget.winfo_height() + 5

        self.tw = tk.Toplevel(self.widget)
        self.tw.wm_overrideredirect(True)
        self.tw.wm_attributes("-topmost", True)
        self.tw.geometry(f"+{x}+{y}")

        is_dark = (ctk.get_appearance_mode() == "Dark")
        bg_color = "#1E293B" if is_dark else "#F8FAFC"
        border_color = "#475569" if is_dark else "#CBD5E1"
        text_color = "#F8FAFC" if is_dark else "#0F172A"

        frame = tk.Frame(self.tw, bg=bg_color, highlightbackground=border_color, highlightthickness=1, padx=8, pady=4)
        frame.pack()
        lbl = tk.Label(frame, text=self.text, font=("Segoe UI", 9), fg=text_color, bg=bg_color)
        lbl.pack()

    def hide(self, event=None):
        if self.tw:
            try:
                self.tw.destroy()
            except Exception:
                pass
            self.tw = None
