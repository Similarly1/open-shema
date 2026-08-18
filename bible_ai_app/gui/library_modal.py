import customtkinter as ctk
from tkinter import messagebox
import os
from PIL import Image, ImageDraw, ImageFont
from gui.library_utils import load_books_metadata, save_books_metadata

# Design Tokens (Harmonisés style Logos & Linear)
C_CARD_BG = ("#FFFFFF", "#1E293B")
C_BORDER = ("#E2E8F0", "#334155")
C_TEXT_PRIMARY = ("#0F172A", "#F8FAFC")
C_TEXT_MUTED = ("#64748B", "#94A3B8")
C_ACCENT = ("#2563EB", "#38BDF8")

# Cache global mémoire pour un affichage instantané
_CTK_IMAGE_CACHE = {}
_PIL_IMAGE_CACHE = {}

try:
    _FONT_INITIALS = ImageFont.truetype("arial.ttf", 60)
    _FONT_TITLE = ImageFont.truetype("arial.ttf", 15)
except Exception:
    _FONT_INITIALS = ImageFont.load_default()
    _FONT_TITLE = ImageFont.load_default()

_COVER_COLORS = [
    "#1E293B", "#0F766E", "#1D4ED8", "#6D28D9",
    "#334155", "#B45309", "#C2410C", "#991B1B",
    "#0369A1", "#047857", "#4338CA", "#374151"
]


def get_or_create_cover_ctk_image(title, cover_path=None, size=(130, 195)):
    """Retourne immédiatement un CTkImage mis en cache en mémoire."""
    cache_key = f"{title}_{cover_path}_{size[0]}_{size[1]}"
    if cache_key in _CTK_IMAGE_CACHE:
        return _CTK_IMAGE_CACHE[cache_key]

    pil_img = None
    if cover_path and os.path.exists(cover_path):
        try:
            pil_img = Image.open(cover_path)
        except Exception:
            pass

    if pil_img is None:
        if title in _PIL_IMAGE_CACHE:
            pil_img = _PIL_IMAGE_CACHE[title]
        else:
            initials = "".join([w[0] for w in title.split()[:2]]).upper()
            if not initials:
                initials = "B"

            color = _COVER_COLORS[hash(title) % len(_COVER_COLORS)]
            pil_img = Image.new('RGB', (180, 270), color=color)
            draw = ImageDraw.Draw(pil_img)

            bbox = draw.textbbox((0, 0), initials, font=_FONT_INITIALS)
            tw = bbox[2] - bbox[0]
            th = bbox[3] - bbox[1]
            draw.text(((180 - tw) / 2, (270 - th) / 2 - 20), initials, fill="white", font=_FONT_INITIALS)

            t_short = title[:22] + "..." if len(title) > 22 else title
            draw.text((10, 230), t_short, fill="#F8FAFC", font=_FONT_TITLE)

            _PIL_IMAGE_CACHE[title] = pil_img

    ctk_img = ctk.CTkImage(light_image=pil_img, dark_image=pil_img, size=size)
    _CTK_IMAGE_CACHE[cache_key] = ctk_img
    return ctk_img


class LibraryTab(ctk.CTkFrame):
    def __init__(self, master, db=None, close_callback=None, on_update_callback=None, edit_callback=None, **kwargs):
        super().__init__(master, fg_color="transparent", **kwargs)

        self.close_callback = close_callback
        self.on_update_callback = on_update_callback
        self.open_edit_callback = edit_callback
        self.db = db

        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(1, weight=1)

        # ------------------------------------------------------------------
        # Header avec Barre de Recherche & Filtre rapide
        # ------------------------------------------------------------------
        header_frame = ctk.CTkFrame(self, fg_color="transparent")
        header_frame.grid(row=0, column=0, sticky="ew", padx=20, pady=(10, 8))
        header_frame.grid_columnconfigure(0, weight=1)
        header_frame.grid_columnconfigure(1, weight=0)

        title_box = ctk.CTkFrame(header_frame, fg_color="transparent")
        title_box.grid(row=0, column=0, sticky="w")

        lbl_title = ctk.CTkLabel(
            title_box,
            text="BIBLIOTHÈQUE",
            font=ctk.CTkFont(size=18, weight="bold"),
            text_color=C_TEXT_PRIMARY
        )
        lbl_title.pack(anchor="w")

        self.lbl_subtitle = ctk.CTkLabel(
            title_box,
            text="Gérez vos versions bibliques, commentaires, dictionnaires et ouvrages de théologie.",
            font=ctk.CTkFont(size=11),
            text_color=C_TEXT_MUTED
        )
        self.lbl_subtitle.pack(anchor="w", pady=(1, 0))

        # Barre de recherche & filtre rapide
        filter_box = ctk.CTkFrame(header_frame, fg_color="transparent")
        filter_box.grid(row=0, column=1, sticky="e")

        self.search_filter_var = ctk.StringVar()
        self.search_filter_var.trace_add("write", lambda *args: self.apply_filter())

        self.search_entry = ctk.CTkEntry(
            filter_box,
            placeholder_text="🔍  Filtrer par titre, auteur...",
            textvariable=self.search_filter_var,
            width=220,
            height=30,
            font=ctk.CTkFont(size=11),
            corner_radius=6
        )
        self.search_entry.pack(side="left", padx=(0, 8))

        self.type_filter_var = ctk.StringVar(value="Tous")
        self.type_filter_menu = ctk.CTkOptionMenu(
            filter_box,
            variable=self.type_filter_var,
            values=["Tous", "Bible", "Commentaire", "Dictionnaire", "Théologie"],
            width=130,
            height=30,
            font=ctk.CTkFont(size=11),
            command=lambda _: self.apply_filter()
        )
        self.type_filter_menu.pack(side="left")

        # ------------------------------------------------------------------
        # Animation de chargement interactive
        # ------------------------------------------------------------------
        self.loader_frame = ctk.CTkFrame(self, fg_color="transparent")
        self.loader_frame.grid(row=1, column=0, sticky="nsew")

        loader_box = ctk.CTkFrame(self.loader_frame, fg_color="transparent")
        loader_box.place(relx=0.5, rely=0.45, anchor="center")

        lbl_icon = ctk.CTkLabel(loader_box, text="📚", font=ctk.CTkFont(size=36))
        lbl_icon.pack(pady=(0, 8))

        self.lbl_load_status = ctk.CTkLabel(
            loader_box,
            text="Chargement de votre bibliothèque...",
            font=ctk.CTkFont(size=13, weight="bold"),
            text_color=C_TEXT_PRIMARY
        )
        self.lbl_load_status.pack(pady=(0, 10))

        self.progress_bar = ctk.CTkProgressBar(
            loader_box,
            width=220,
            height=6,
            corner_radius=3,
            progress_color=("#2563EB", "#38BDF8")
        )
        self.progress_bar.pack()
        self.progress_bar.set(0.05)

        # ------------------------------------------------------------------
        # Grille scrollable
        # ------------------------------------------------------------------
        self.scroll_frame = ctk.CTkScrollableFrame(self, fg_color="transparent")
        self.columns_count = 5
        for i in range(self.columns_count):
            self.scroll_frame.grid_columnconfigure(i, weight=1)

        self.all_sources = []
        self.sources = []
        self.book_widgets = []

        # Lancer l'animation par étapes fluides
        self.after(20, self._step_load_1)

    def _step_load_1(self):
        self.progress_bar.set(0.35)
        raw_books = load_books_metadata()
        self.all_sources = []
        for name, meta in raw_books.items():
            book_meta = meta.copy()
            book_meta["name"] = name
            self.all_sources.append(book_meta)

        self.lbl_subtitle.configure(
            text=f"{len(self.all_sources)} ouvrages indexés dans votre bibliothèque locale."
        )
        self.after(20, self._step_load_2)

    def _step_load_2(self):
        self.progress_bar.set(0.75)
        self.apply_filter()
        self.after(20, self._step_load_3)

    def _step_load_3(self):
        self.progress_bar.set(1.0)
        try:
            self.loader_frame.grid_forget()
            self.loader_frame.destroy()
        except Exception:
            pass
        self.scroll_frame.grid(row=1, column=0, padx=12, pady=(0, 10), sticky="nsew")

    def refresh_library(self):
        raw_books = load_books_metadata()
        self.all_sources = []
        for name, meta in raw_books.items():
            book_meta = meta.copy()
            book_meta["name"] = name
            self.all_sources.append(book_meta)

        self.lbl_subtitle.configure(
            text=f"{len(self.all_sources)} ouvrages indexés dans votre bibliothèque locale."
        )
        self.apply_filter()

    def apply_filter(self):
        query = self.search_filter_var.get().strip().lower()
        selected_type = self.type_filter_var.get()

        filtered = []
        for s in self.all_sources:
            if selected_type != "Tous" and s.get("type") != selected_type:
                continue
            if query:
                title = s.get("title", s.get("name", "")).lower()
                author = s.get("author", "").lower()
                name = s.get("name", "").lower()
                if query not in title and query not in author and query not in name:
                    continue
            filtered.append(s)

        self.sources = filtered

        # Nettoyer les widgets
        if hasattr(self, 'book_widgets'):
            for widget in self.book_widgets:
                try:
                    widget.destroy()
                except Exception:
                    pass
        self.book_widgets = []

        if not self.sources:
            lbl_empty = ctk.CTkLabel(
                self.scroll_frame,
                text="Aucun ouvrage ne correspond à vos critères." if self.all_sources else "Votre bibliothèque est vide.",
                font=ctk.CTkFont(size=13),
                text_color=C_TEXT_MUTED
            )
            lbl_empty.grid(row=0, column=0, columnspan=self.columns_count, pady=40)
            self.book_widgets.append(lbl_empty)
            return

        # Rendu des cartes
        for i, source in enumerate(self.sources):
            row = i // self.columns_count
            col = i % self.columns_count

            book_name = source.get("name", f"Livre {i+1}")
            title = source.get("title", book_name)
            is_active = source.get("active", True)
            cover_path = source.get("cover_path")

            book_card = ctk.CTkFrame(
                self.scroll_frame,
                fg_color=C_CARD_BG,
                border_color=C_BORDER,
                border_width=1,
                corner_radius=8
            )
            book_card.grid(row=row, column=col, padx=8, pady=8, sticky="nsew")
            self.book_widgets.append(book_card)

            ctk_img = get_or_create_cover_ctk_image(title, cover_path, size=(130, 195))
            cover_lbl = ctk.CTkLabel(book_card, image=ctk_img, text="", corner_radius=4)
            cover_lbl.pack(padx=8, pady=(8, 4))

            title_lbl = ctk.CTkLabel(
                book_card,
                text=title,
                font=ctk.CTkFont(size=12, weight="bold"),
                text_color=C_TEXT_PRIMARY,
                wraplength=140,
                justify="center"
            )
            title_lbl.pack(padx=6, pady=(2, 0))

            author = source.get("author", "")
            if author:
                author_lbl = ctk.CTkLabel(
                    book_card,
                    text=author,
                    font=ctk.CTkFont(size=10),
                    text_color=C_TEXT_MUTED,
                    wraplength=140,
                    justify="center"
                )
                author_lbl.pack(padx=6, pady=(0, 2))

            tags_frame = ctk.CTkFrame(book_card, fg_color="transparent")
            tags_frame.pack(pady=(2, 4))

            b_type = source.get("type", "")
            if b_type:
                ctk.CTkLabel(
                    tags_frame,
                    text=b_type,
                    font=ctk.CTkFont(size=9, weight="bold"),
                    fg_color=("#E2E8F0", "#334155"),
                    text_color=C_TEXT_PRIMARY,
                    corner_radius=4,
                    padx=4,
                    height=16
                ).pack(side="left", padx=1)

            scope = source.get("corpus_scope")
            if scope:
                s_color = "#EA580C" if scope == "OT" else ("#0284C7" if scope == "NT" else "#7C3AED")
                ctk.CTkLabel(
                    tags_frame,
                    text=scope,
                    font=ctk.CTkFont(size=9, weight="bold"),
                    fg_color=s_color,
                    text_color="white",
                    corner_radius=4,
                    padx=4,
                    height=16
                ).pack(side="left", padx=1)

            nb_ch = source.get("chapters_count")
            if nb_ch:
                ctk.CTkLabel(
                    tags_frame,
                    text=f"{nb_ch} ch.",
                    font=ctk.CTkFont(size=9),
                    text_color=C_TEXT_MUTED,
                    height=16
                ).pack(side="left", padx=1)

            actions_frame = ctk.CTkFrame(book_card, fg_color="transparent")
            actions_frame.pack(fill="x", padx=8, pady=(2, 8))

            switch_var = ctk.StringVar(value="on" if is_active else "off")
            switch = ctk.CTkSwitch(
                actions_frame,
                text="Actif",
                variable=switch_var,
                onvalue="on",
                offvalue="off",
                font=ctk.CTkFont(size=11),
                command=lambda name=book_name, var=switch_var: self.toggle_source(name, var.get())
            )
            switch.pack(side="left")

            btn_del = ctk.CTkButton(
                actions_frame,
                text="🗑️",
                width=24,
                height=24,
                font=ctk.CTkFont(size=10),
                fg_color="transparent",
                hover_color=("#FEE2E2", "#450A0A"),
                text_color="#EF4444",
                command=lambda name=book_name: self.delete_source(name)
            )
            btn_del.pack(side="right", padx=(2, 0))

            btn_edit = ctk.CTkButton(
                actions_frame,
                text="✏️",
                width=24,
                height=24,
                font=ctk.CTkFont(size=10),
                fg_color="transparent",
                hover_color=("#E2E8F0", "#334155"),
                text_color=C_TEXT_PRIMARY,
                command=lambda name=book_name, meta=source: self.open_edit_callback(name, meta)
            )
            btn_edit.pack(side="right", padx=1)

    def toggle_source(self, name, state):
        active = state == "on"
        raw_books = load_books_metadata()
        if name in raw_books:
            raw_books[name]["active"] = active
            save_books_metadata(raw_books)
        self.on_update_callback()

    def delete_source(self, name):
        if messagebox.askyesno("Confirmation", f"Êtes-vous sûr de vouloir supprimer définitivement '{name}' ?"):
            raw_books = load_books_metadata()
            if name in raw_books:
                book_info = raw_books[name]
                folder_name = book_info.get("folder_name", name.replace(" ", "_"))
                json_dir = os.path.join("data", "bibles", folder_name)
                if os.path.exists(json_dir):
                    try:
                        import shutil
                        shutil.rmtree(json_dir)
                    except Exception as e:
                        print(f"Erreur suppression dossier JSON {json_dir}: {e}")

                from core.bible_json_loader import BibleJsonLoader
                BibleJsonLoader._cache.clear()
                BibleJsonLoader._metadata_cache.clear()

                model = book_info.get("embedding_model", "study_library")
                try:
                    if self.db:
                        collection = self.db.get_collection(model)
                        collection.delete(where={"name": name})
                except Exception as e:
                    print(f"Error deleting from ChromaDB: {e}")

                del raw_books[name]
                save_books_metadata(raw_books)

            self.refresh_library()
            self.on_update_callback()
