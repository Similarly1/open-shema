import tkinter as tk
import customtkinter as ctk

class BibleTooltip:
    """
    Info-bulle (Tooltip) flottante moderne et ultra-légère.
    S'adapte dynamiquement au thème (Sombre/Clair) et se positionne intelligemment.
    """
    def __init__(self, master=None):
        self.master = master
        self.tw = None
        self._current_word = None
        self._after_id = None

    def show(self, x, y, data):
        """Affiche l'info-bulle aux coordonnées écran spécifiées avec les données du dictionnaire."""
        if not data:
            self.hide()
            return
            
        word = data.get("word", "")
        if self.tw and self._current_word == word:
            return
            
        self.hide()
        self._current_word = word
        
        is_dark = (ctk.get_appearance_mode() == "Dark")
        bg_color = "#0F172A" if is_dark else "#FFFFFF"
        border_color = "#38BDF8" if is_dark else "#0284C7"
        text_color = "#F8FAFC" if is_dark else "#0F172A"
        badge_color = "#38BDF8" if is_dark else "#0284C7"
        hint_color = "#94A3B8" if is_dark else "#64748B"
        
        # Tailles proportionnelles et confortables pour la lecture
        base_size = getattr(self.master, 'font_size', 18)
        f_badge = max(11, base_size - 6)
        f_title = max(16, base_size - 1)
        f_body = max(13, base_size - 4)
        f_hint = max(11, base_size - 6)
        wrap_w = max(520, min(650, int(base_size * 30)))
        
        self.tw = tk.Toplevel(self.master)
        self.tw.wm_overrideredirect(True)
        self.tw.wm_attributes("-topmost", True)
        
        # Conteneur avec bordure soignée et généreuse
        container = tk.Frame(
            self.tw, 
            bg=bg_color, 
            highlightbackground=border_color, 
            highlightthickness=2,
            padx=20, 
            pady=16
        )
        container.pack(fill="both", expand=True)
        
        # En-tête : Badge Source & Titre
        source_lbl = tk.Label(
            container, 
            text=data.get("source", ""), 
            font=("Segoe UI", f_badge, "bold"), 
            fg=badge_color, 
            bg=bg_color,
            anchor="w"
        )
        source_lbl.pack(fill="x", anchor="w")
        
        title_lbl = tk.Label(
            container, 
            text=data.get("title", ""), 
            font=("Georgia", f_title, "bold"), 
            fg=text_color, 
            bg=bg_color,
            anchor="w",
            wraplength=wrap_w,
            justify="left"
        )
        title_lbl.pack(fill="x", anchor="w", pady=(4, 8))
        
        # Corps : Aperçu de la définition
        preview_text = data.get("preview", "").strip()
        if preview_text:
            body_lbl = tk.Label(
                container, 
                text=preview_text, 
                font=("Segoe UI", f_body), 
                fg=text_color, 
                bg=bg_color,
                anchor="w",
                wraplength=wrap_w,
                justify="left"
            )
            body_lbl.pack(fill="x", anchor="w", pady=(0, 10))
            
        # Pied : Indication de clic
        hint_lbl = tk.Label(
            container, 
            text="🖱️ Cliquer pour voir tout l'article dans le volet droit", 
            font=("Segoe UI", f_hint, "italic"), 
            fg=hint_color, 
            bg=bg_color,
            anchor="w"
        )
        hint_lbl.pack(fill="x", anchor="w", pady=(4, 0))
        
        # Calcul de la position intelligente
        self.tw.update_idletasks()
        w = self.tw.winfo_reqwidth()
        h = self.tw.winfo_reqheight()
        
        screen_w = self.tw.winfo_screenwidth()
        screen_h = self.tw.winfo_screenheight()
        
        pos_x = x + 16
        pos_y = y + 20
        
        if pos_x + w > screen_w - 20:
            pos_x = screen_w - w - 20
        if pos_y + h > screen_h - 20:
            pos_y = y - h - 20
            
        self.tw.wm_geometry(f"+{pos_x}+{pos_y}")

    def hide(self):
        """Masque et détruit l'info-bulle active."""
        if self._after_id and self.master:
            try:
                self.master.after_cancel(self._after_id)
            except Exception:
                pass
            self._after_id = None
            
        if self.tw:
            try:
                self.tw.destroy()
            except Exception:
                pass
            self.tw = None
            self._current_word = None
