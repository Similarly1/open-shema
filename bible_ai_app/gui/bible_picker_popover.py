import os
import re
import tkinter as tk
import customtkinter as ctk
from PIL import Image, ImageDraw, ImageFont

BIBLE_STYLE_MAP = {
    "NBS": {"code": "NBS", "color": "#881337", "full": "La Nouvelle Bible Segond", "meta": "Société Biblique Française • 2002 • Étude"},
    "LSG": {"code": "LSG", "color": "#1E3A8A", "full": "La Bible Louis Segond 1910", "meta": "Louis Segond • 1910 • Avec codes Strong"},
    "Segond 21": {"code": "S21", "color": "#065F46", "full": "Bible Segond 21", "meta": "Société Biblique de Genève • 2007 • Texte d'étude"},
    "BDS": {"code": "BDS", "color": "#0F766E", "full": "La Bible du Semeur 2015", "meta": "Biblica • 2015 • Langage contemporain"},
    "TOB": {"code": "TOB", "color": "#B45309", "full": "Traduction Œcuménique de la Bible (TOB)", "meta": "SBF / Cerf • 2010 • Œcuménique"},
    "NFC": {"code": "NFC", "color": "#2563EB", "full": "Nouvelle Français Courant", "meta": "Société Biblique Française • 2019 • Dynamique"},
    "PDV2017": {"code": "PDV", "color": "#0284C7", "full": "La Bible Parole de Vie", "meta": "Société Biblique Française • 2017 • Accessible"},
    "NEG79": {"code": "NEG", "color": "#4338CA", "full": "Nouvelle Édition de Genève 1979", "meta": "Société Biblique de Genève • 1979"},
    "PV": {"code": "PV", "color": "#3F6212", "full": "Bible Parole Vivante", "meta": "Alfred Kuen • 1976 • Transcription dynamique"},
    "NCL": {"code": "NCL", "color": "#7E22CE", "full": "Sainte Bible Néo-Crampon Libre", "meta": "Fraternité de Tibériade • 2022"},
    "SV": {"code": "SV", "color": "#9D174D", "full": "Bible Sagesse Vivante", "meta": "Alfred Kuen • 1988 • Livres poétiques"},
    "BENFS": {"code": "BFS", "color": "#15803D", "full": "Bible en Français Simple", "meta": "MissionAssist • 2023 • Français facile"},
    "JXLFR": {"code": "JXL", "color": "#1E40AF", "full": "Nouveau Testament Juxtalinéaire", "meta": "Xenizo • 2026 • Grec-Français"},
    "APEE": {"code": "APEE", "color": "#991B1B", "full": "Bible de l'Épée", "meta": "APEE • 2010 • Texte traditionnel"},
    "OST": {"code": "OST", "color": "#78350F", "full": "Sainte Bible d'Ostervald", "meta": "J.-F. Ostervald • 1877 • Référence"},
    "DARBY": {"code": "DRB", "color": "#334155", "full": "Bible J.N. Darby", "meta": "J.N. Darby • 1885 • Littérale avec Strong"},
    "Colombe": {"code": "COL", "color": "#475569", "full": "Nouvelle Version Segond Révisée (Colombe)", "meta": "Société Biblique Française • 1978"},
    "Chouraqui": {"code": "ACH", "color": "#9A3412", "full": "La Bible André Chouraqui", "meta": "André Chouraqui • 1977 • Hébraïsante"},
    "ESV": {"code": "ESV", "color": "#EA580C", "full": "English Standard Version", "meta": "Crossway • 2001 • Littérale"},
    "KJV": {"code": "KJV", "color": "#701A75", "full": "King James Version", "meta": "1611 • Traditionnelle anglophone"},
    "NASB": {"code": "NASB", "color": "#1E40AF", "full": "New American Standard Bible", "meta": "Lockman Foundation • 1995"},
    "NIV": {"code": "NIV", "color": "#0284C7", "full": "New International Version", "meta": "Biblica • 2011"}
}

_COVER_CACHE = {}

def get_bible_cover_image(key, meta=None, width=30, height=42):
    """Génère ou récupère une vignette de livre élégante style Logos."""
    cache_key = f"{key}_{width}_{height}"
    if cache_key in _COVER_CACHE:
        return _COVER_CACHE[cache_key]
        
    meta = meta or {}
    cover_path = meta.get("cover_path")
    if cover_path and os.path.exists(cover_path):
        try:
            with Image.open(cover_path) as raw_img:
                raw_img = raw_img.convert("RGBA")
                raw_img.thumbnail((width, height), Image.Resampling.LANCZOS)
                ctk_img = ctk.CTkImage(light_image=raw_img, dark_image=raw_img, size=(raw_img.width, raw_img.height))
                _COVER_CACHE[cache_key] = ctk_img
                return ctk_img
        except Exception:
            pass

    # Génération procédurale du dos de livre avec reliure & dorures
    style = BIBLE_STYLE_MAP.get(key, {})
    code = style.get("code") or meta.get("version_code") or key[:4].upper().strip()
    color_hex = style.get("color", "#334155")
    
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Couverture arrondie
    draw.rounded_rectangle([0, 0, width - 1, height - 1], radius=4, fill=color_hex)
    
    # Reliure / ombre du dos de livre à gauche
    draw.rectangle([0, 0, 4, height - 1], fill=(0, 0, 0, 70))
    draw.line([(5, 0), (5, height - 1)], fill=(255, 255, 255, 80), width=1)
    
    # Filets dorés horizontaux en haut et en bas
    draw.line([(6, 5), (width - 6, 5)], fill=(234, 179, 8, 200), width=1)
    draw.line([(6, height - 6), (width - 6, height - 6)], fill=(234, 179, 8, 200), width=1)
    
    # Sigle au centre
    font_size = 8 if len(code) > 4 else (9 if len(code) == 4 else 10)
    try:
        font = ImageFont.truetype("arialbd.ttf", font_size)
    except Exception:
        try:
            font = ImageFont.truetype("DejaVuSans-Bold.ttf", font_size)
        except Exception:
            font = ImageFont.load_default()
            
    bbox = draw.textbbox((0, 0), code, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    tx = max(6, (width + 5 - tw) // 2)
    ty = (height - th) // 2
    draw.text((tx, ty), code, fill=(255, 255, 255, 240), font=font)
    
    ctk_img = ctk.CTkImage(light_image=img, dark_image=img, size=(width, height))
    _COVER_CACHE[cache_key] = ctk_img
    return ctk_img


class BiblePickerPopover:
    """
    Menu déroulant / Popover interactif pour le choix de la version de la Bible,
    inspiré de Logos Bible Software avec barre de recherche, vignettes de couvertures,
    titres complets et navigation clavier ultra-fluide.
    """
    def __init__(self, master, on_select_callback=None):
        self.master = master
        self.on_select_callback = on_select_callback
        self.tw = None
        self.search_entry = None
        self.scroll_frame = None
        self.bibles_data = []
        self.filtered_bibles = []
        self.active_key = None
        self.highlighted_index = 0
        self.row_widgets = []
        self._outside_click_bind = None

    def show(self, button_widget, active_key, all_bibles_registry):
        """Ouvre le popover sous le bouton spécifié."""
        self.hide()
        self.active_key = active_key
        
        # 1. Préparer les données des Bibles
        self.bibles_data = []
        for key, meta in all_bibles_registry.items():
            if meta.get("type", "Bible") != "Bible" or not meta.get("active", True):
                continue
                
            style = BIBLE_STYLE_MAP.get(key, {})
            full_title = meta.get("title") or style.get("full") or key
            if full_title == key and style.get("full"):
                full_title = style.get("full")
                
            code = style.get("code") or meta.get("version_code") or key[:4].upper().strip()
            
            # Sous-titre descriptif
            meta_parts = []
            if code and code != key:
                meta_parts.append(code)
            year = meta.get("year")
            if year:
                meta_parts.append(str(year))
            author = meta.get("author")
            if author:
                meta_parts.append(author)
            elif style.get("meta"):
                meta_parts.append(style["meta"].split("•")[0].strip())
                
            if meta.get("has_strongs") or "strong" in (meta.get("description", "").lower() + key.lower()):
                meta_parts.append("Strongs")
                
            books_count = meta.get("total_books")
            if books_count:
                meta_parts.append(f"{books_count} livres")
                
            sub_text = " • ".join(meta_parts) if meta_parts else (style.get("meta") or "Texte Biblique")
            
            self.bibles_data.append({
                "key": key,
                "title": full_title,
                "subtitle": sub_text,
                "code": code,
                "meta": meta,
                "is_active": (key == active_key)
            })
            
        # Tri : Bible active en premier puis ordre alphabétique
        self.bibles_data.sort(key=lambda x: (not x["is_active"], x["title"].lower()))
        self.filtered_bibles = list(self.bibles_data)
        
        # 2. Coordonnées écran du bouton avec rafraîchissement géométrique
        try:
            button_widget.winfo_toplevel().update_idletasks()
        except Exception:
            pass
        button_widget.update_idletasks()
        
        bx = button_widget.winfo_rootx()
        by = button_widget.winfo_rooty() + button_widget.winfo_height() + 4
        bw = button_widget.winfo_width()
        
        pop_w = 540
        pop_h = 620
        
        # S'assurer que le popover reste dans l'écran et s'aligne proprement sous le bouton
        screen_w = button_widget.winfo_screenwidth()
        screen_h = button_widget.winfo_screenheight()
        
        if bx + pop_w > screen_w - 20:
            bx = max(10, bx + bw - pop_w)
        else:
            bx = max(10, bx)
            
        if by + pop_h > screen_h - 40:
            by = max(10, button_widget.winfo_rooty() - pop_h - 4)
            
        is_dark = (ctk.get_appearance_mode() == "Dark")
        bg_color = "#0F172A" if is_dark else "#FFFFFF"
        border_color = "#334155" if is_dark else "#CBD5E1"
        
        # 3. Fenêtre Toplevel sans bordures
        self.tw = tk.Toplevel(self.master)
        self.tw.wm_overrideredirect(True)
        self.tw.wm_attributes("-topmost", True)
        self.tw.geometry(f"{pop_w}x{pop_h}+{bx}+{by}")
        
        # Conteneur principal
        container = ctk.CTkFrame(
            self.tw,
            fg_color=bg_color,
            border_color=border_color,
            border_width=1.5,
            corner_radius=10
        )
        container.pack(fill="both", expand=True, padx=0, pady=0)
        
        # 4. Barre de Recherche supérieure (Logos style)
        search_frame = ctk.CTkFrame(container, fg_color="transparent")
        search_frame.pack(fill="x", padx=14, pady=(12, 6))
        
        self.search_entry = ctk.CTkEntry(
            search_frame,
            placeholder_text="🔍 Rechercher une version de la Bible...",
            height=36,
            font=ctk.CTkFont(size=13),
            corner_radius=8
        )
        self.search_entry.pack(side="left", fill="x", expand=True)
        self.search_entry.bind("<KeyRelease>", self.on_search_key_release)
        self.search_entry.bind("<Down>", self.on_key_down)
        self.search_entry.bind("<Up>", self.on_key_up)
        self.search_entry.bind("<Return>", self.on_key_return)
        self.search_entry.bind("<Escape>", lambda e: self.hide())
        
        # Compteur discret
        self.count_lbl = ctk.CTkLabel(
            container, 
            text=f"{len(self.bibles_data)} versions disponibles", 
            font=ctk.CTkFont(size=11), 
            text_color=("#64748B", "#94A3B8"),
            anchor="w"
        )
        self.count_lbl.pack(fill="x", padx=18, pady=(0, 4))
        
        # 5. Zone défilable pour la liste des versions
        self.scroll_frame = ctk.CTkScrollableFrame(
            container, 
            fg_color="transparent",
            corner_radius=6
        )
        self.scroll_frame.pack(fill="both", expand=True, padx=8, pady=(0, 8))
        
        self.render_bible_list()
        
        # Focus immédiat sur la recherche
        self.tw.after(60, lambda: self.search_entry.focus_set())
        
        # Fermeture au clic extérieur
        self.tw.after(100, self._bind_outside_click)

    def _bind_outside_click(self):
        try:
            root = self.master.winfo_toplevel()
            self._outside_click_bind = root.bind("<Button-1>", self._check_outside_click, add="+")
        except Exception:
            pass

    def _check_outside_click(self, event):
        if not self.tw or not self.tw.winfo_exists():
            return
        try:
            x, y = event.x_root, event.y_root
            wx = self.tw.winfo_rootx()
            wy = self.tw.winfo_rooty()
            ww = self.tw.winfo_width()
            wh = self.tw.winfo_height()
            
            if not (wx <= x <= wx + ww and wy <= y <= wy + wh):
                self.hide()
        except Exception:
            pass

    def hide(self):
        """Ferme et détruit proprement le popover."""
        if self._outside_click_bind:
            try:
                root = self.master.winfo_toplevel()
                root.unbind("<Button-1>", self._outside_click_bind)
            except Exception:
                pass
            self._outside_click_bind = None
            
        if self.tw and self.tw.winfo_exists():
            self.tw.destroy()
        self.tw = None

    def on_search_key_release(self, event=None):
        if event and event.keysym in ("Down", "Up", "Return", "Escape"):
            return
            
        query = self.search_entry.get().strip().lower()
        if not query:
            self.filtered_bibles = list(self.bibles_data)
        else:
            q_clean = re.sub(r'[\s\-_]+', '', query)
            self.filtered_bibles = []
            for b in self.bibles_data:
                target_str = f"{b['key']} {b['title']} {b['subtitle']} {b['code']}".lower()
                target_clean = re.sub(r'[\s\-_]+', '', target_str)
                if query in target_str or q_clean in target_clean:
                    self.filtered_bibles.append(b)
                    
        self.highlighted_index = 0
        self.count_lbl.configure(text=f"{len(self.filtered_bibles)} version(s) trouvée(s)")
        self.render_bible_list()

    def render_bible_list(self):
        """Régénère la liste visuelle des versions de Bible."""
        for w in self.scroll_frame.winfo_children():
            w.destroy()
            
        self.row_widgets = []
        is_dark = (ctk.get_appearance_mode() == "Dark")
        hover_bg = "#1E293B" if is_dark else "#F1F5F9"
        active_border = "#38BDF8" if is_dark else "#0284C7"
        
        if not self.filtered_bibles:
            empty_lbl = ctk.CTkLabel(
                self.scroll_frame,
                text="Aucune version trouvée\npour cette recherche.",
                font=ctk.CTkFont(size=13, slant="italic"),
                text_color=("#94A3B8", "#64748B"),
                justify="center"
            )
            empty_lbl.pack(pady=40)
            return

        for idx, b in enumerate(self.filtered_bibles):
            key = b["key"]
            is_active = (key == self.active_key)
            is_hl = (idx == self.highlighted_index)
            
            row_fg = hover_bg if is_hl else "transparent"
            row_border = active_border if is_active else ("#334155" if is_dark else "#E2E8F0")
            
            row = ctk.CTkFrame(
                self.scroll_frame,
                fg_color=row_fg,
                border_color=row_border,
                border_width=1.5 if is_active else 0,
                corner_radius=8,
                height=54
            )
            row.pack(fill="x", padx=4, pady=2)
            row.pack_propagate(False)
            
            # Vignette / Couverture 3D
            cover_img = get_bible_cover_image(key, b["meta"], width=30, height=42)
            cover_lbl = ctk.CTkLabel(row, image=cover_img, text="", width=36)
            cover_lbl.pack(side="left", padx=(8, 10))
            
            # Colonne Texte (Titre + Sous-titre)
            txt_frame = ctk.CTkFrame(row, fg_color="transparent")
            txt_frame.pack(side="left", fill="both", expand=True, pady=4)
            
            t_color = "#38BDF8" if is_active and is_dark else ("#0284C7" if is_active else ("#F8FAFC" if is_dark else "#0F172A"))
            
            title_lbl = ctk.CTkLabel(
                txt_frame,
                text=b["title"],
                font=ctk.CTkFont(size=13, weight="bold"),
                text_color=t_color,
                anchor="w"
            )
            title_lbl.pack(fill="x", anchor="w")
            
            sub_lbl = ctk.CTkLabel(
                txt_frame,
                text=b["subtitle"],
                font=ctk.CTkFont(size=11),
                text_color=("#64748B", "#94A3B8"),
                anchor="w"
            )
            sub_lbl.pack(fill="x", anchor="w")
            
            # Badge Actuelle à droite
            if is_active:
                badge_lbl = ctk.CTkLabel(
                    row,
                    text="✓ Actuelle",
                    font=ctk.CTkFont(size=11, weight="bold"),
                    text_color="#10B981" if is_dark else "#059669"
                )
                badge_lbl.pack(side="right", padx=14)
                
            self.row_widgets.append(row)
            
            # Bindings d'interaction sur chaque widget de la ligne
            for widget in (row, cover_lbl, txt_frame, title_lbl, sub_lbl):
                widget.bind("<Enter>", lambda e, r=row, i=idx: self._on_row_enter(r, i))
                widget.bind("<Leave>", lambda e, r=row, i=idx: self._on_row_leave(r, i))
                widget.bind("<Button-1>", lambda e, k=key: self._on_row_click(k))
                widget.configure(cursor="hand2")

    def _on_row_enter(self, row_frame, idx):
        self.highlighted_index = idx
        is_dark = (ctk.get_appearance_mode() == "Dark")
        hover_bg = "#1E293B" if is_dark else "#F1F5F9"
        row_frame.configure(fg_color=hover_bg)

    def _on_row_leave(self, row_frame, idx):
        if idx != self.highlighted_index:
            row_frame.configure(fg_color="transparent")

    def _on_row_click(self, bible_key):
        self.hide()
        if self.on_select_callback:
            self.on_select_callback(bible_key)

    def on_key_down(self, event=None):
        if self.filtered_bibles:
            self.highlighted_index = (self.highlighted_index + 1) % len(self.filtered_bibles)
            self._update_highlight()
            return "break"

    def on_key_up(self, event=None):
        if self.filtered_bibles:
            self.highlighted_index = (self.highlighted_index - 1) % len(self.filtered_bibles)
            self._update_highlight()
            return "break"

    def on_key_return(self, event=None):
        if self.filtered_bibles and 0 <= self.highlighted_index < len(self.filtered_bibles):
            chosen = self.filtered_bibles[self.highlighted_index]
            self._on_row_click(chosen["key"])
            return "break"

    def _update_highlight(self):
        is_dark = (ctk.get_appearance_mode() == "Dark")
        hover_bg = "#1E293B" if is_dark else "#F1F5F9"
        for idx, row in enumerate(self.row_widgets):
            if idx == self.highlighted_index:
                row.configure(fg_color=hover_bg)
            else:
                row.configure(fg_color="transparent")
