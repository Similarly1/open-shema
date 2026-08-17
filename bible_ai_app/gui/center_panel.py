import customtkinter as ctk
import re
import difflib
from core.config import save_config
from core.reference_parser import get_french_book_name, parse_smart_book_input, resolve_book_input, strip_accents, normalize_reference
from core.strong_lexicon import StrongLexicon
from core.dictionary_manager import DictionaryManager
from gui.tooltip import BibleTooltip
from gui.bible_picker_popover import BiblePickerPopover, get_bible_cover_image, BIBLE_STYLE_MAP

BOOKS_OT = [
    ("Genèse", "Gen", 50), ("Exode", "Exo", 40), ("Lévitique", "Lev", 27), ("Nombres", "Num", 36), ("Deutéronome", "Deu", 34),
    ("Josué", "Jos", 24), ("Juges", "Jdg", 21), ("Ruth", "Rut", 4), ("1 Samuel", "1Sa", 31), ("2 Samuel", "2Sa", 24),
    ("1 Rois", "1Ki", 22), ("2 Rois", "2Ki", 25), ("1 Chroniques", "1Ch", 29), ("2 Chroniques", "2Ch", 36), ("Esdras", "Ezr", 10),
    ("Néhémie", "Neh", 13), ("Esther", "Est", 10), ("Job", "Job", 42), ("Psaumes", "Psa", 150), ("Proverbes", "Pro", 31),
    ("Ecclésiaste", "Ecc", 12), ("Cantique", "Sol", 8), ("Ésaïe", "Isa", 66), ("Jérémie", "Jer", 52), ("Lamentations", "Lam", 5),
    ("Ézéchiel", "Eze", 48), ("Daniel", "Dan", 12), ("Osée", "Hos", 14), ("Joël", "Joe", 3), ("Amos", "Amo", 9),
    ("Abdias", "Oba", 1), ("Jonas", "Jon", 4), ("Michée", "Mic", 7), ("Nahum", "Nah", 3), ("Habacuc", "Hab", 3),
    ("Sophonie", "Zep", 3), ("Aggée", "Hag", 2), ("Zacharie", "Zec", 14), ("Malachie", "Mal", 4)
]

BOOKS_NT = [
    ("Matthieu", "Mat", 28), ("Marc", "Mar", 16), ("Luc", "Luk", 24), ("Jean", "Joh", 21), ("Actes", "Act", 28),
    ("Romains", "Rom", 16), ("1 Corinthiens", "1Co", 16), ("2 Corinthiens", "2Co", 13), ("Galates", "Gal", 6),
    ("Éphésiens", "Eph", 6), ("Philippiens", "Phi", 4), ("Colossiens", "Col", 4), ("1 Thessaloniciens", "1Th", 5),
    ("2 Thessaloniciens", "2Th", 3), ("1 Timothée", "1Ti", 6), ("2 Timothée", "2Ti", 4), ("Tite", "Tit", 3),
    ("Philémon", "Phm", 1), ("Hébreux", "Heb", 13), ("Jacques", "Jam", 5), ("1 Pierre", "1Pe", 5), ("2 Pierre", "2Pe", 3),
    ("1 Jean", "1Jo", 5), ("2 Jean", "2Jo", 1), ("3 Jean", "3Jo", 1), ("Jude", "Jud", 1), ("Apocalypse", "Rev", 22)
]

BOOKS_DEUTERO = [
    ("Tobie", "Tob", 14), ("Judith", "Jdt", 16), ("Esther grec", "Esg", 16),
    ("1 Maccabées", "1Ma", 16), ("2 Maccabées", "2Ma", 15), ("3 Maccabées", "3Ma", 7),
    ("4 Maccabées", "4Ma", 18), ("Sagesse", "Wis", 19), ("Siracide", "Sir", 51),
    ("Baruch", "Bar", 6), ("Lettre de Jérémie", "Lje", 1), ("Daniel grec", "Dag", 14),
    ("3 Esdras", "1Es", 9), ("4 Esdras", "2Es", 16), ("Prière de Manassé", "Man", 1),
    ("Psaume 151", "Ps2", 1)
]

ALL_BOOKS = BOOKS_OT + BOOKS_NT + BOOKS_DEUTERO
FRENCH_TO_CODE = {b[0]: b[1] for b in ALL_BOOKS}
CODE_TO_FRENCH = {b[1]: b[0] for b in ALL_BOOKS}
CODE_TO_CH_COUNT = {b[1]: b[2] for b in ALL_BOOKS}

def format_bible_text(text, show_headings=True):
    if not text:
        return ""
    if not isinstance(text, str):
        return str(text)
        
    if not show_headings:
        matches = re.findall(r'\{\{field-on:Bible\}\}(.*?)\{\{field-off:Bible\}\}', text, re.DOTALL)
        if matches:
            text = " ".join(m.strip() for m in matches)
            
    # 1. Supprimer les balises publishing_chapter_number (avec ou sans slash)
    clean = re.sub(r'<publishing_chapter_number>.*?</?publishing_chapter_number>', '', text)
    clean = re.sub(r'</?publishing_chapter_number>', '', clean)
    clean = re.sub(r'<footnote>.*?</footnote>', '', clean, flags=re.DOTALL)
    clean = re.sub(r'<cross_reference>.*?</cross_reference>', '', clean, flags=re.DOTALL)
    
    # 2. Supprimer toutes les autres balises XML/HTML (<insert_footnote />, <dictionary_word>, etc.)
    clean = re.sub(r'<[^>]+>', '', clean)
    
    # 3. Supprimer les balises internes {{field-on:...}}
    clean = re.sub(r'\{\{field-on:.*?\}\}', '', clean)
    clean = re.sub(r'\{\{field-off:.*?\}\}', '', clean)
    
    # 4. Normaliser espaces et ponctuation
    clean = re.sub(r'[\xa0\u200b\u202f]+', ' ', clean)
    clean = re.sub(r'\s+([,.;:!?»\)])', r'\1', clean)
    clean = re.sub(r'([«\(])\s+', r'\1', clean)
    clean = re.sub(r'\s+', ' ', clean)
    return clean.strip()

class CenterPanel(ctk.CTkFrame):
    def __init__(self, master, config):
        super().__init__(master)
        
        self.config = config
        self.font_family = self.config.get("font_family", "Georgia")
        self.font_size = self.config.get("font_size", 18)
        self.show_headings = self.config.get("show_headings", True)
        self.compare_mode = self.config.get("compare_mode", False)
        
        # Options de mise en page (style Logos)
        self.show_verse_numbers = self.config.get("show_verse_numbers", True)
        self.show_chapter_numbers = self.config.get("show_chapter_numbers", True)
        self.verse_per_line = self.config.get("verse_per_line", False)
        self.show_reverse_interlinear = self.config.get("show_reverse_interlinear", False)
        self.bible_full_width = bool(self.config.get("bible_full_width", False))
        self.is_immersive_mode = False
        
        # Options de typographie et couches interlinéaire
        self.line_spacing = self.config.get("line_spacing", 6)
        self.word_spacing = self.config.get("word_spacing", 3)
        self.interlinear_show_surface = self.config.get("interlinear_show_surface", True)
        self.interlinear_show_lemma = self.config.get("interlinear_show_lemma", True)
        self.interlinear_show_translit = self.config.get("interlinear_show_translit", True)
        self.interlinear_show_strong = self.config.get("interlinear_show_strong", True)
        
        self.is_updating_breadcrumb = False
        self.all_book_names = [b[0] for b in ALL_BOOKS]
        self.current_valid_book = "Jean"
        self.loaded_book_code = None
        self.loaded_french_book = None
        self.last_tracked_ch_v = None
        self._scroll_sync_job = None
        self.last_selected_strong = None
        
        self.grid_columnconfigure(0, weight=1, uniform="equal")
        self.grid_columnconfigure(1, weight=1, uniform="equal")
        self.grid_rowconfigure(0, weight=0)
        self.grid_rowconfigure(1, weight=1)
        
        # Fil d'Ariane Interactif (ComboBox et OptionMenus)
        self.breadcrumb_frame = ctk.CTkFrame(self, fg_color="transparent")
        self.breadcrumb_frame.grid(row=0, column=0, columnspan=2, pady=(10, 5), sticky="ew", padx=15)
        
        # Sélecteur de livre sous forme de CTkComboBox éditable
        self.book_var = ctk.StringVar(value="Jean")
        self.book_menu = ctk.CTkComboBox(
            self.breadcrumb_frame, 
            variable=self.book_var, 
            values=self.all_book_names,
            command=self.on_book_changed,
            width=160
        )
        self.book_menu.pack(side="left", padx=2)
        
        # Bindings pour la saisie directe, le filtrage et l'autocomplétion
        self.book_menu._entry.bind("<FocusIn>", self.on_book_focus_in)
        self.book_menu._entry.bind("<Return>", self.on_book_entry_return)
        self.book_menu._entry.bind("<FocusOut>", self.on_book_entry_focus_out)
        self.book_menu._entry.bind("<KeyRelease>", self.on_book_key_release)
        
        self.sep1 = ctk.CTkLabel(self.breadcrumb_frame, text="➔", text_color="#888888")
        self.sep1.pack(side="left", padx=4)
        
        self.chapter_var = ctk.StringVar(value="1")
        self.chapter_menu = ctk.CTkOptionMenu(
            self.breadcrumb_frame, 
            variable=self.chapter_var, 
            values=["1"],
            command=self.on_chapter_changed,
            width=70
        )
        self.chapter_menu.pack(side="left", padx=2)
        
        self.sep2 = ctk.CTkLabel(self.breadcrumb_frame, text="➔", text_color="#888888")
        self.sep2.pack(side="left", padx=4)
        
        # Dropdown Verset
        self.verse_var = ctk.StringVar(value="Tous")
        self.verse_menu = ctk.CTkOptionMenu(
            self.breadcrumb_frame, 
            variable=self.verse_var, 
            values=["Tous"],
            command=self.on_verse_changed,
            width=80
        )
        self.verse_menu.pack(side="left", padx=2)
        
        self.sep3 = ctk.CTkLabel(self.breadcrumb_frame, text=" | ", text_color="#888888")
        self.sep3.pack(side="left", padx=10)
        
        self.compare_switch = ctk.CTkSwitch(
            self.breadcrumb_frame, 
            text="Comparaison", 
            command=self.toggle_compare_mode
        )
        if self.compare_mode:
            self.compare_switch.select()
        self.compare_switch.pack(side="left", padx=5)
        
        from gui.library_utils import load_books_metadata
        registry = load_books_metadata()
        active_bibles = [name for name, meta in registry.items() if meta.get("type", "Bible") == "Bible" and meta.get("active", False)]
        
        self.ref_bible_var = ctk.StringVar(value=self.config.get("reference_bible", active_bibles[0] if active_bibles else ""))
        
        # Popover Sélecteur de Bible Style Logos
        self.bible_picker_popover = BiblePickerPopover(self, on_select_callback=self.on_ref_bible_changed)
        
        initial_btn_txt = self.get_bible_button_label(self.ref_bible_var.get())
        self.btn_ref_bible = ctk.CTkButton(
            self.breadcrumb_frame, 
            text=f"{initial_btn_txt}  ▾", 
            command=lambda: self.open_bible_picker_popover(self.btn_ref_bible),
            height=28,
            font=ctk.CTkFont(size=12, weight="bold"),
            fg_color=("#E2E8F0", "#1E293B"),
            hover_color=("#CBD5E1", "#334155"),
            text_color=("#0F172A", "#F8FAFC"),
            border_width=1,
            border_color=("#94A3B8", "#475569"),
            corner_radius=6
        )
        self.btn_ref_bible.pack(side="left", padx=5)
        
        # Zone des Modes de Vue (Plein Écran & Pleine Largeur) - TOUJOURS VISIBLE À DROITE
        self.view_modes_frame = ctk.CTkFrame(self.breadcrumb_frame, fg_color="transparent")
        self.view_modes_frame.pack(side="right", padx=(10, 0))
        
        # Bouton Plein Écran Immersif Total (F11)
        self.btn_fullscreen = ctk.CTkButton(
            self.view_modes_frame,
            text="⛶ Plein écran",
            width=110,
            height=28,
            font=ctk.CTkFont(size=12, weight="bold"),
            fg_color=("#3B82F6", "#2563EB"),
            hover_color=("#2563EB", "#1D4ED8"),
            text_color="#FFFFFF",
            corner_radius=6,
            command=self.toggle_fullscreen_reading
        )
        self.btn_fullscreen.pack(side="right", padx=(4, 0))
        
        # Bouton Pleine Largeur (Volet unique vs 2 volets)
        wide_btn_txt = "🗗 2 Volets" if self.bible_full_width else "🗖 Pleine largeur"
        self.btn_toggle_wide = ctk.CTkButton(
            self.view_modes_frame,
            text=wide_btn_txt,
            width=120,
            height=28,
            font=ctk.CTkFont(size=12, weight="bold"),
            fg_color=("#E2E8F0", "#1E293B"),
            hover_color=("#CBD5E1", "#334155"),
            text_color=("#0F172A", "#F8FAFC"),
            border_width=1,
            border_color=("#94A3B8", "#475569"),
            corner_radius=6,
            command=self.toggle_bible_full_width
        )
        self.btn_toggle_wide.pack(side="right", padx=4)
        
        # Progress Frame (masqué par défaut, s'affiche à droite du fil d'Ariane)
        self.progress_frame = ctk.CTkFrame(self, fg_color="transparent")
        
        self.progress_label = ctk.CTkLabel(self.progress_frame, text="Indexation...", font=ctk.CTkFont(size=12))
        self.progress_label.pack(side="left", padx=5)
        
        self.progress_bar = ctk.CTkProgressBar(self.progress_frame, width=150)
        self.progress_bar.set(0)
        self.progress_bar.pack(side="left", padx=5)
        
        # Colonne Gauche / Pleine Largeur (Onglets Principaux / Bible / Modales)
        self.main_tabs = ctk.CTkTabview(self, command=self.on_main_tab_changed)
        self.main_tabs.grid(row=1, column=0, sticky="nsew", padx=(10, 5), pady=(0, 10))
        
        self.tab_lecture = self.main_tabs.add("📖 Lecture")
        
        # En-tête de lecture avec Nom de Bible à gauche et Paramètres d'affichage à droite
        self.bible_header_frame = ctk.CTkFrame(self.tab_lecture, fg_color="transparent")
        self.bible_header_frame.pack(fill="x", pady=(0, 5))
        
        self.bible_title_frame = ctk.CTkFrame(self.bible_header_frame, fg_color="transparent")
        self.bible_title_frame.pack(side="left", anchor="w")
        
        self.bible_label = ctk.CTkLabel(
            self.bible_title_frame, 
            text="📖 Texte Biblique", 
            font=ctk.CTkFont(size=13, weight="bold", slant="italic"),
            cursor="hand2"
        )
        self.bible_label.pack(side="left", anchor="w")
        self.bible_label.bind("<Button-1>", lambda e: self.open_bible_picker_popover())
        
        self.btn_header_change_bible = ctk.CTkButton(
            self.bible_title_frame,
            text="▾",
            width=22,
            height=20,
            font=ctk.CTkFont(size=10, weight="bold"),
            fg_color="transparent",
            hover_color=("#E2E8F0", "#334155"),
            text_color=("#64748B", "#94A3B8"),
            command=self.open_bible_picker_popover
        )
        self.btn_header_change_bible.pack(side="left", padx=(4, 0))
        
        # Barre de paramètres rapides (style Logos)
        self.display_settings_frame = ctk.CTkFrame(self.bible_header_frame, fg_color="transparent")
        self.display_settings_frame.pack(side="right", anchor="e")
        
        self.cb_verse_num_var = ctk.BooleanVar(value=self.show_verse_numbers)
        self.cb_verse_num = ctk.CTkCheckBox(
            self.display_settings_frame, 
            text="N° Versets", 
            variable=self.cb_verse_num_var, 
            command=self.on_toggle_verse_numbers,
            font=ctk.CTkFont(size=11), 
            checkbox_width=16, 
            checkbox_height=16
        )
        self.cb_verse_num.pack(side="left", padx=5)
        
        self.cb_chap_num_var = ctk.BooleanVar(value=self.show_chapter_numbers)
        self.cb_chap_num = ctk.CTkCheckBox(
            self.display_settings_frame, 
            text="N° Chapitres", 
            variable=self.cb_chap_num_var, 
            command=self.on_toggle_chapter_numbers,
            font=ctk.CTkFont(size=11), 
            checkbox_width=16, 
            checkbox_height=16
        )
        self.cb_chap_num.pack(side="left", padx=5)
        
        self.cb_verse_line_var = ctk.BooleanVar(value=self.verse_per_line)
        self.cb_verse_line = ctk.CTkCheckBox(
            self.display_settings_frame, 
            text="1 verset / ligne", 
            variable=self.cb_verse_line_var, 
            command=self.on_toggle_verse_per_line,
            font=ctk.CTkFont(size=11), 
            checkbox_width=16, 
            checkbox_height=16
        )
        self.cb_verse_line.pack(side="left", padx=5)
        
        self.cb_interlinear_var = ctk.BooleanVar(value=self.show_reverse_interlinear)
        self.cb_interlinear = ctk.CTkCheckBox(
            self.display_settings_frame, 
            text="🔬 Interlinéaire", 
            variable=self.cb_interlinear_var, 
            command=self.on_toggle_reverse_interlinear,
            font=ctk.CTkFont(size=11, weight="bold"), 
            checkbox_width=16, 
            checkbox_height=16
        )
        self.cb_interlinear.pack(side="left", padx=(5, 1))
        
        self.btn_interlinear_options = ctk.CTkButton(
            self.display_settings_frame, 
            text="⚙️", 
            width=22, 
            height=20, 
            font=ctk.CTkFont(size=11), 
            fg_color="transparent", 
            hover_color=("#E2E8F0", "#334155"), 
            text_color=("#64748B", "#94A3B8"), 
            command=self.open_interlinear_options_popup
        )
        self.btn_interlinear_options.pack(side="left", padx=(0, 5))
        
        self.bible_textbox = ctk.CTkTextbox(self.tab_lecture, wrap="word", fg_color=("#FAFAFA", "#1E1E1E"), text_color=("#1A1A1A", "#E2E8F0"))
        self.bible_textbox.pack(fill="both", expand=True)
        self.bible_textbox.configure(state="disabled")
        
        # Bouton flottant pour quitter le mode plein écran immersif
        self.btn_exit_fullscreen = ctk.CTkButton(
            self.tab_lecture,
            text="✕ Quitter le plein écran (Échap / F11)",
            fg_color=("#0F172A", "#0F172A"),
            hover_color="#1E293B",
            text_color="#38BDF8",
            border_width=1.5,
            border_color="#38BDF8",
            corner_radius=18,
            font=ctk.CTkFont(size=12, weight="bold"),
            height=34,
            command=self.toggle_fullscreen_reading
        )
        
        # Brancher la surveillance de défilement continu sur le composant Bible
        self._orig_yscroll = self.bible_textbox._y_scrollbar.set
        def _on_bible_yscroll(*args):
            self._orig_yscroll(*args)
            self.schedule_scroll_sync()
        self.bible_textbox._textbox.configure(yscrollcommand=_on_bible_yscroll)
        
        # Tooltip et détection dynamique au survol
        self.tooltip = BibleTooltip(self)
        self._hover_match = None
        self._strong_tag_map = {}
        
        self.bible_textbox._textbox.bind("<Motion>", self.on_bible_mouse_motion)
        self.bible_textbox._textbox.bind("<Button-1>", self.on_bible_mouse_click, add="+")
        self.bible_textbox._textbox.bind("<Leave>", self.on_bible_mouse_leave)
        
        # Colonne Droite (Onglets: Commentaires / Assistant IA / Lexique & Dictionnaires)
        self.right_tabs = ctk.CTkTabview(self)
        self.right_tabs.grid(row=1, column=1, sticky="nsew", padx=(5, 10), pady=(0, 10))
        
        self.tab_comm = self.right_tabs.add("📝 Commentaires")
        self.tab_chat = self.right_tabs.add("🤖 Assistant IA")
        self.tab_lex = self.right_tabs.add("🔍 Lexique & Dictionnaires")
        
        # Commentaires Textbox (inside tab_comm)
        self.comm_textbox = ctk.CTkTextbox(self.tab_comm, wrap="word", fg_color=("#FAFAFA", "#1E1E1E"), text_color=("#1A1A1A", "#E2E8F0"))
        self.comm_textbox.pack(fill="both", expand=True)
        self.comm_textbox.configure(state="disabled")
        
        from gui.right_panel import RightPanel
        self.right_panel = RightPanel(
            self.tab_chat, 
            self.get_text_content, 
            self.config,
            db_callback=lambda: getattr(self.master, 'db', None),
            sources_callback=lambda: getattr(self.master, 'active_sources', [])
        )
        self.right_panel.pack(fill="both", expand=True)
        
        # Lexique Strong (inside tab_lex)
        self.lex_textbox = ctk.CTkTextbox(self.tab_lex, wrap="word", fg_color=("#FAFAFA", "#1E1E1E"), text_color=("#1A1A1A", "#E2E8F0"))
        self.lex_textbox.pack(fill="both", expand=True, padx=2, pady=(2, 5))
        self.lex_textbox.configure(state="disabled")
        
        self.lex_action_frame = ctk.CTkFrame(self.tab_lex, fg_color="transparent")
        self.lex_action_frame.pack(fill="x", padx=2, pady=(0, 2))
        
        self.lex_ai_btn = ctk.CTkButton(
            self.lex_action_frame, 
            text="🤖 Analyser ce mot avec l'IA", 
            command=self.on_analyze_strong_with_ai, 
            state="disabled", 
            height=32,
            font=ctk.CTkFont(size=12, weight="bold")
        )
        self.lex_ai_btn.pack(fill="x")
        
        self.current_reference = ""
        self.current_results = None
        
        self.update_tags()
        if self.bible_full_width:
            self.set_full_width_mode(True)
        self.display_welcome()
        
    def get_bible_full_name(self, source_name):
        """Récupère le nom complet de la Bible à partir de library.json ou retourne la clé si introuvable."""
        if not source_name:
            return "Texte Biblique"
        from gui.library_utils import load_books_metadata
        registry = load_books_metadata()
        meta = registry.get(source_name, {})
        title = meta.get("title") or meta.get("description")
        if title and title.strip():
            return title.strip()
        from gui.bible_picker_popover import BIBLE_STYLE_MAP
        if source_name in BIBLE_STYLE_MAP and BIBLE_STYLE_MAP[source_name].get("full"):
            return BIBLE_STYLE_MAP[source_name]["full"]
        return source_name

    def get_bible_button_label(self, key):
        """Génère un libellé clair et compact pour le bouton de version (style Logos)."""
        if not key or key == "Aucune":
            return "Choisir une Bible"
        from gui.bible_picker_popover import BIBLE_STYLE_MAP
        style = BIBLE_STYLE_MAP.get(key, {})
        code = style.get("code") or key
        full = style.get("full") or key
        if code and code != full:
            return f"{code} ({full})" if len(full) <= 18 else code
        return key

    def open_bible_picker_popover(self, anchor=None):
        """Ouvre le popover interactif de sélection de version de Bible (style Logos)."""
        from gui.library_utils import load_books_metadata
        registry = load_books_metadata()
        active_key = self.ref_bible_var.get()
        anchor_widget = anchor or (self.btn_ref_bible if hasattr(self, 'btn_ref_bible') and self.btn_ref_bible.winfo_exists() else self.bible_label)
        self.bible_picker_popover.show(anchor_widget, active_key, registry)

    def on_toggle_verse_numbers(self):
        self.show_verse_numbers = bool(self.cb_verse_num_var.get())
        self.config["show_verse_numbers"] = self.show_verse_numbers
        save_config(self.config)
        self.refresh_current_view_position()

    def on_toggle_chapter_numbers(self):
        self.show_chapter_numbers = bool(self.cb_chap_num_var.get())
        self.config["show_chapter_numbers"] = self.show_chapter_numbers
        save_config(self.config)
        self.refresh_current_view_position()

    def on_toggle_verse_per_line(self):
        self.verse_per_line = bool(self.cb_verse_line_var.get())
        self.config["verse_per_line"] = self.verse_per_line
        save_config(self.config)
        self.refresh_current_view_position()

    def on_toggle_reverse_interlinear(self):
        self.show_reverse_interlinear = bool(self.cb_interlinear_var.get())
        self.config["show_reverse_interlinear"] = self.show_reverse_interlinear
        save_config(self.config)
        self.refresh_current_view_position()

    def on_bible_mouse_motion(self, event):
        """Détecte dynamiquement et instantanément le mot sous le curseur (<0.01ms)."""
        tb = self.bible_textbox._textbox
        try:
            pos = tb.index(f"@{event.x},{event.y}")
            # Vérifier si ce caractère possède un tag Strong
            tags = tb.tag_names(pos)
            strong_code = None
            strong_word = None
            for tag in tags:
                if tag in self._strong_tag_map:
                    strong_code, strong_word = self._strong_tag_map[tag]
                    break
                    
            word = tb.get(f"{pos} wordstart", f"{pos} wordend").strip(" ,:;.!?()«»[]\"'’\n\r\t")
            if not word and not strong_word:
                self._clear_hover()
                return
                
            query_w = strong_word or word
            match = DictionaryManager.lookup(query_w, strong_code)
            
            if match:
                start_idx = f"{pos} wordstart"
                end_idx = f"{pos} wordend"
                if not self._hover_match or self._hover_match[0] != match:
                    tb.tag_remove("hover_dict_highlight", "1.0", "end")
                    tb.tag_add("hover_dict_highlight", start_idx, end_idx)
                    tb.configure(cursor="hand2")
                    self._hover_match = (match, start_idx, end_idx)
                    
                    if self.tooltip._after_id:
                        try:
                            self.after_cancel(self.tooltip._after_id)
                        except Exception:
                            pass
                    self.tooltip._after_id = self.after(140, lambda x=event.x_root, y=event.y_root, m=match: self.tooltip.show(x, y, m))
            else:
                self._clear_hover()
        except Exception:
            pass

    def _clear_hover(self):
        if self._hover_match:
            tb = self.bible_textbox._textbox
            tb.tag_remove("hover_dict_highlight", "1.0", "end")
            tb.configure(cursor="")
            self.tooltip.hide()
            self._hover_match = None

    def on_bible_mouse_click(self, event):
        """Ouvre l'article complet dans le volet droit au clic sur un mot reconnu."""
        if self._hover_match:
            match, _, _ = self._hover_match
            self.tooltip.hide()
            self.display_dictionary_entry(match)

    def on_bible_mouse_leave(self, event=None):
        self._clear_hover()

    def display_dictionary_entry(self, match):
        """Affiche la notice complète de tous les dictionnaires correspondants dans le volet droit."""
        if not match:
            return
            
        self.right_tabs.set("🔍 Lexique & Dictionnaires")
        self.lex_textbox.configure(state="normal")
        self.lex_textbox.delete("0.0", "end")
        
        matches = match.get("matches", [])
        if not matches:
            # Fallback rétro-compatible
            matches = []
            if match.get("strong"):
                matches.append({"dict_id": "strong", "dict_name": "Strong", "badge": "■ Strong", "title": match.get("word", ""), "entry": match["strong"]})
            if match.get("calmet"):
                matches.append({"dict_id": "calmet", "dict_name": "Calmet", "badge": "📖 Dom Calmet", "title": match["calmet"].get("title", ""), "art": match["calmet"], "full_text": match["calmet"].get("text", "")})

        for idx, m in enumerate(matches):
            if idx > 0:
                self.lex_textbox.insert("end", "\n" + "─" * 32 + "\n\n", "chapter_divider")
                
            dict_id = m.get("dict_id")
            badge = m.get("badge", m.get("dict_name", "Dictionnaire"))
            title = m.get("title", "")
            
            self.lex_textbox.insert("end", f"{badge}\n", "source_name")
            if title and dict_id != "strong":
                self.lex_textbox.insert("end", f"{title}\n\n", "book_title")
                
            if dict_id == "strong":
                strong_entry = m.get("entry", {})
                code = strong_entry.get("short_code", strong_entry.get("code", ""))
                lang = "Hébreu biblique" if strong_entry.get("lang") == "hebrew" else "Grec koinè"
                lemma = strong_entry.get("lemma", "")
                definition = strong_entry.get("definition", "")
                details = strong_entry.get("details", [])
                
                self.lex_textbox.insert("end", f"{lemma}\n\n", "lex_lemma")
                self.lex_textbox.insert("end", f"Définition :\n{definition}\n\n", "body")
                
                clean_det = [re.sub(r'\[\[@Headword:.*?\]\]', '', d).strip() for d in details if d.strip()]
                if clean_det:
                    self.lex_textbox.insert("end", "Détails & Concordance :\n", "source_name")
                    det_text = "\n".join(clean_det[:4])
                    self.lex_textbox.insert("end", f"{det_text}\n\n", "lex_details")
                    
                bailly_entries = strong_entry.get("bailly", [])
                if bailly_entries:
                    self.lex_textbox.insert("end", "🏛️ Dictionnaire Grec-Français Bailly (1901) :\n", "bailly_header")
                    for b_art in bailly_entries[:3]:
                        hw = b_art.get("headword", "")
                        b_txt = b_art.get("full_text", "")
                        if hw and not b_txt.startswith(hw):
                            self.lex_textbox.insert("end", f"• {hw}\n", "bailly_headword")
                        self.lex_textbox.insert("end", f"{b_txt}\n\n", "body")
                        
            elif dict_id == "bailly":
                b_entries = m.get("entries", [])
                for b_art in b_entries:
                    hw = b_art.get("headword", "")
                    b_txt = b_art.get("full_text", "")
                    if hw and not b_txt.startswith(hw):
                        self.lex_textbox.insert("end", f"• {hw}\n", "bailly_headword")
                    self.lex_textbox.insert("end", f"{b_txt}\n\n", "body")
            else:
                full_t = m.get("full_text", "")
                self.lex_textbox.insert("end", f"{full_t}\n\n", "body")
                
        self.lex_textbox.configure(state="disabled")
        
        # Configurer le bouton d'analyse IA
        first_title = match.get("word") or match.get("title")
        self.last_selected_strong = (match.get("strong") or match, match.get("word"))
        self.lex_ai_btn.configure(state="normal", text=f"🤖 Analyser « {first_title} » avec l'IA")

    def on_strong_clicked(self, strong_codes_str, clicked_word=None):
        """Affiche la fiche lexicale complète Strong dans l'onglet dédié à droite."""
        entries = StrongLexicon.get_multiple(strong_codes_str)
        if not entries:
            return
            
        first_entry = entries[0]
        match = {
            "word": clicked_word,
            "title": clicked_word or first_entry.get("lemma", ""),
            "strong": first_entry,
            "calmet": DictionaryManager.lookup_calmet(clicked_word) if clicked_word else None
        }
        self.display_dictionary_entry(match)

    def on_analyze_strong_with_ai(self):
        """Envoie une requête exégétique ciblée à l'Assistant IA sur le mot ou sujet sélectionné."""
        if not getattr(self, 'last_selected_strong', None):
            return
        item, word = self.last_selected_strong
        
        cur_book = self.loaded_french_book or self.current_valid_book
        cur_ch = self.chapter_var.get()
        cur_v = self.verse_var.get()
        
        ref_str = f"{cur_book} {cur_ch}"
        if cur_v and cur_v != "Tous":
            ref_str += f":{cur_v}"
            
        if isinstance(item, dict) and item.get('lemma'):
            code = item.get('short_code', item.get('code', ''))
            lemma = item.get('lemma', '')
            lang = "hébreu" if item.get('lang') == 'hebrew' else "grec"
            word_clause = f" (traduit par « {word} »)" if word else ""
            bailly_info = ""
            if item.get("bailly"):
                b_sample = item["bailly"][0].get("full_text", "")[:250]
                bailly_info = f"\nNotice du dictionnaire Bailly : « {b_sample} »"
                
            prompt = (
                f"Peux-tu faire une étude linguistique, étymologique et théologique approfondie du mot {lang} "
                f"« {lemma} » (Strong {code}{word_clause}) dans le contexte de {ref_str} ?{bailly_info}"
            )
        else:
            term = word or (item.get('title') if isinstance(item, dict) else str(item))
            prompt = (
                f"Peux-tu expliquer en détail la signification historique, théologique et biblique du terme "
                f"« {term} » dans le contexte de {ref_str} ?"
            )
            
        self.right_tabs.set("🤖 Assistant IA")
        if hasattr(self, 'right_panel') and hasattr(self.right_panel, 'send_custom_prompt'):
            self.right_panel.send_custom_prompt(prompt)

    def open_interlinear_options_popup(self):
        """Ouvre une fenêtre modale élégante pour régler les couches de l'interlinéaire et les espacements (style Logos)."""
        pop = ctk.CTkToplevel(self)
        pop.title("Options Interlinéaire & Typographie")
        pop.geometry("360x440")
        pop.resizable(False, False)
        pop.attributes("-topmost", True)
        
        # Centrer la fenêtre sur le panneau central
        pop.update_idletasks()
        try:
            x = self.winfo_rootx() + (self.winfo_width() // 2) - 180
            y = self.winfo_rooty() + (self.winfo_height() // 2) - 220
            pop.geometry(f"+{x}+{y}")
        except Exception:
            pass
        
        title = ctk.CTkLabel(pop, text="🔬 Interlinéaire Inversé (Logos)", font=ctk.CTkFont(size=14, weight="bold"))
        title.pack(pady=(12, 6))
        
        # Switch Activer
        sw_var = ctk.BooleanVar(value=self.show_reverse_interlinear)
        def on_sw_toggle():
            self.show_reverse_interlinear = bool(sw_var.get())
            self.cb_interlinear_var.set(self.show_reverse_interlinear)
            self.config["show_reverse_interlinear"] = self.show_reverse_interlinear
            save_config(self.config)
            self.refresh_current_view_position()
            
        sw = ctk.CTkSwitch(pop, text="Activer l'Interlinéaire", variable=sw_var, command=on_sw_toggle, font=ctk.CTkFont(size=12, weight="bold"))
        sw.pack(padx=20, pady=6, anchor="w")
        
        sep = ctk.CTkLabel(pop, text="─" * 38, text_color="#64748B")
        sep.pack(pady=2)
        
        # Couches interlinéaires
        lbl_layers = ctk.CTkLabel(pop, text="Couches à afficher sous chaque mot :", font=ctk.CTkFont(size=11, weight="bold"))
        lbl_layers.pack(padx=20, pady=(2, 4), anchor="w")
        
        def make_layer_cb(label, attr_name):
            val_var = ctk.BooleanVar(value=getattr(self, attr_name, True))
            def on_layer_toggle():
                val = bool(val_var.get())
                setattr(self, attr_name, val)
                self.config[attr_name] = val
                save_config(self.config)
                self.refresh_current_view_position()
            cb = ctk.CTkCheckBox(pop, text=label, variable=val_var, command=on_layer_toggle, font=ctk.CTkFont(size=11), checkbox_width=16, checkbox_height=16)
            cb.pack(padx=30, pady=3, anchor="w")
            return cb
            
        make_layer_cb("Texte de surface (Français)", "interlinear_show_surface")
        make_layer_cb("Lemme original (Hébreu / Grec)", "interlinear_show_lemma")
        make_layer_cb("Translittération phonétique", "interlinear_show_translit")
        make_layer_cb("Numéro de Strong", "interlinear_show_strong")
        
        sep2 = ctk.CTkLabel(pop, text="─" * 38, text_color="#64748B")
        sep2.pack(pady=2)
        
        # Sliders Interligne & Espacement
        lbl_line = ctk.CTkLabel(pop, text=f"Interligne : {self.line_spacing} px", font=ctk.CTkFont(size=11))
        lbl_line.pack(padx=20, pady=(2, 0), anchor="w")
        
        def on_line_slide(v):
            val = int(v)
            lbl_line.configure(text=f"Interligne : {val} px")
            self.line_spacing = val
            self.config["line_spacing"] = val
            save_config(self.config)
            self.update_tags()
            self.refresh_current_view_position()
            
        s_line = ctk.CTkSlider(pop, from_=0, to=20, number_of_steps=20, command=on_line_slide)
        s_line.set(self.line_spacing)
        s_line.pack(padx=20, pady=3, fill="x")
        
        lbl_w = ctk.CTkLabel(pop, text=f"Espacement mots/colonnes : {self.word_spacing} px", font=ctk.CTkFont(size=11))
        lbl_w.pack(padx=20, pady=(2, 0), anchor="w")
        
        def on_word_slide(v):
            val = int(v)
            lbl_w.configure(text=f"Espacement mots/colonnes : {val} px")
            self.word_spacing = val
            self.config["word_spacing"] = val
            save_config(self.config)
            self.refresh_current_view_position()
            
        s_w = ctk.CTkSlider(pop, from_=1, to=10, number_of_steps=9, command=on_word_slide)
        s_w.set(self.word_spacing)
        s_w.pack(padx=20, pady=3, fill="x")

    def render_logos_interlinear(self, text, cur_ch, v_num):
        """Rend un verset sous forme de colonnes multi-étages alignées façon Logos Bible Software."""
        show_surf = getattr(self, 'interlinear_show_surface', True)
        show_lem = getattr(self, 'interlinear_show_lemma', True)
        show_tr = getattr(self, 'interlinear_show_translit', True)
        show_str = getattr(self, 'interlinear_show_strong', True)
        word_sp = getattr(self, 'word_spacing', 3)
        
        tokens = re.split(r'(<w\s+strong="[^"]*">.*?</w>)', text)
        units = []
        
        for token in tokens:
            if not token:
                continue
            m = re.match(r'<w\s+strong="([^"]*)">(.*?)</w>', token)
            if m:
                s_codes = m.group(1).strip()
                surface_word = m.group(2).strip()
                entries = StrongLexicon.get_multiple(s_codes)
                
                lemmas = []
                translits = []
                strong_nums = []
                
                for e in entries:
                    raw_lemma = e.get('lemma', '')
                    if ' - ' in raw_lemma:
                        p = raw_lemma.split(' - ')
                        lemmas.append(p[0].strip())
                        translits.append(p[1].strip())
                    else:
                        lemmas.append(raw_lemma.strip())
                        translits.append("")
                    strong_nums.append(e.get('short_code', e.get('code', '')))
                    
                units.append({
                    'surface': surface_word,
                    'lemma': " ".join(lemmas),
                    'translit': " ".join([t for t in translits if t]),
                    'strong': " ".join(strong_nums),
                    'raw_strong': s_codes
                })
            else:
                clean_t = re.sub(r'<[^>]+>', '', token).strip()
                if clean_t:
                    parts = clean_t.split()
                    for p in parts:
                        units.append({
                            'surface': p,
                            'lemma': '',
                            'translit': '',
                            'strong': '',
                            'raw_strong': ''
                        })
                        
        if not units:
            return
            
        max_line_chars = 75
        lines = []
        cur_line = []
        cur_w = 0
        
        for u_idx, u in enumerate(units):
            w_surf = len(u['surface']) if show_surf else 0
            w_lem = len(u['lemma']) if show_lem else 0
            w_tr = len(u['translit']) if show_tr else 0
            w_str = len(u['strong']) if show_str else 0
            
            col_w = max(w_surf, w_lem, w_tr, w_str)
            col_w = max(col_w, 1) + word_sp
            
            if cur_w + col_w > max_line_chars and cur_line:
                lines.append(cur_line)
                cur_line = [(u_idx, u, col_w)]
                cur_w = col_w
            else:
                cur_line.append((u_idx, u, col_w))
                cur_w += col_w
                
        if cur_line:
            lines.append(cur_line)
            
        tb = self.bible_textbox._textbox
        
        for line_idx, line in enumerate(lines):
            # 1. Rangée Texte de surface (Français)
            if show_surf:
                for u_idx, u, cw in line:
                    tag_name = f"str_{cur_ch}_{v_num}_{u_idx}"
                    cell_text = u['surface'].ljust(cw)
                    if u['raw_strong']:
                        self._strong_tag_map[tag_name] = (u['raw_strong'], u['surface'])
                        self.bible_textbox.insert("end", cell_text, ("logos_surface", tag_name))
                        tb.tag_bind(tag_name, "<Button-1>", lambda e, sc=u['raw_strong'], cw_text=u['surface']: self.on_strong_clicked(sc, cw_text))
                        tb.tag_bind(tag_name, "<Enter>", lambda e: tb.configure(cursor="hand2"))
                        tb.tag_bind(tag_name, "<Leave>", lambda e: tb.configure(cursor=""))
                    else:
                        self.bible_textbox.insert("end", cell_text, "logos_surface")
                self.bible_textbox.insert("end", "\n")
                
            # 2. Rangée Lemme original (Hébreu / Grec)
            if show_lem and any(u['lemma'] for _, u, _ in line):
                for u_idx, u, cw in line:
                    tag_name = f"str_{cur_ch}_{v_num}_{u_idx}"
                    cell_text = u['lemma'].ljust(cw)
                    if u['raw_strong']:
                        self._strong_tag_map[tag_name] = (u['raw_strong'], u['surface'])
                        self.bible_textbox.insert("end", cell_text, ("logos_lemma", tag_name))
                        tb.tag_bind(tag_name, "<Button-1>", lambda e, sc=u['raw_strong'], cw_text=u['surface']: self.on_strong_clicked(sc, cw_text))
                        tb.tag_bind(tag_name, "<Enter>", lambda e: tb.configure(cursor="hand2"))
                        tb.tag_bind(tag_name, "<Leave>", lambda e: tb.configure(cursor=""))
                    else:
                        self.bible_textbox.insert("end", cell_text, "logos_lemma")
                self.bible_textbox.insert("end", "\n")
                
            # 3. Rangée Translittération phonétique
            if show_tr and any(u['translit'] for _, u, _ in line):
                for u_idx, u, cw in line:
                    tag_name = f"str_{cur_ch}_{v_num}_{u_idx}"
                    cell_text = u['translit'].ljust(cw)
                    if u['raw_strong']:
                        self._strong_tag_map[tag_name] = (u['raw_strong'], u['surface'])
                        self.bible_textbox.insert("end", cell_text, ("logos_translit", tag_name))
                        tb.tag_bind(tag_name, "<Button-1>", lambda e, sc=u['raw_strong'], cw_text=u['surface']: self.on_strong_clicked(sc, cw_text))
                        tb.tag_bind(tag_name, "<Enter>", lambda e: tb.configure(cursor="hand2"))
                        tb.tag_bind(tag_name, "<Leave>", lambda e: tb.configure(cursor=""))
                    else:
                        self.bible_textbox.insert("end", cell_text, "logos_translit")
                self.bible_textbox.insert("end", "\n")
                
            # 4. Rangée Numéro Strong
            if show_str and any(u['strong'] for _, u, _ in line):
                for u_idx, u, cw in line:
                    tag_name = f"str_{cur_ch}_{v_num}_{u_idx}"
                    cell_text = u['strong'].ljust(cw)
                    if u['raw_strong']:
                        self._strong_tag_map[tag_name] = (u['raw_strong'], u['surface'])
                        self.bible_textbox.insert("end", cell_text, ("logos_strong", tag_name))
                        tb.tag_bind(tag_name, "<Button-1>", lambda e, sc=u['raw_strong'], cw_text=u['surface']: self.on_strong_clicked(sc, cw_text))
                        tb.tag_bind(tag_name, "<Enter>", lambda e: tb.configure(cursor="hand2"))
                        tb.tag_bind(tag_name, "<Leave>", lambda e: tb.configure(cursor=""))
                    else:
                        self.bible_textbox.insert("end", cell_text, "logos_strong")
                self.bible_textbox.insert("end", "\n")
                
            if line_idx < len(lines) - 1:
                self.bible_textbox.insert("end", "\n")

    def render_verse_content(self, raw_doc, cur_ch, v_num, is_per_line=False):
        """Rend un verset en gérant intelligemment le texte français, les tags Strong et l'interlinéaire."""
        text = raw_doc
        if v_num:
            pattern = r'^' + re.escape(str(v_num)) + r'(?!\d)[\s\xa0\u200b]*'
            text = re.sub(pattern, '', text)
            
        if '<w' in text and 'strong=' in text:
            if self.show_reverse_interlinear:
                self.render_logos_interlinear(text, cur_ch, v_num)
            else:
                tokens = re.split(r'(<w\s+strong="[^"]*">.*?</w>)', text)
                for t_idx, token in enumerate(tokens):
                    if not token:
                        continue
                    m = re.match(r'<w\s+strong="([^"]*)">(.*?)</w>', token)
                    if m:
                        s_codes = m.group(1).strip()
                        w_text = m.group(2).strip()
                        tag_name = f"str_{cur_ch}_{v_num}_{t_idx}"
                        self._strong_tag_map[tag_name] = (s_codes, w_text)
                        
                        self.bible_textbox.insert("end", f"{w_text} ", ("strong_word", tag_name))
                        
                        tb = self.bible_textbox._textbox
                        tb.tag_bind(tag_name, "<Button-1>", lambda e, sc=s_codes, cw=w_text: self.on_strong_clicked(sc, cw))
                        tb.tag_bind(tag_name, "<Enter>", lambda e: tb.configure(cursor="hand2"))
                        tb.tag_bind(tag_name, "<Leave>", lambda e: tb.configure(cursor=""))
                    else:
                        clean_t = format_bible_text(token, self.show_headings)
                        if clean_t:
                            self.bible_textbox.insert("end", f"{clean_t} ", "body")
        else:
            clean_doc = format_bible_text(text, self.show_headings)
            if clean_doc:
                self.bible_textbox.insert("end", f"{clean_doc} ", "body")
                
        if is_per_line or self.show_reverse_interlinear:
            self.bible_textbox.insert("end", "\n\n" if self.show_reverse_interlinear else "\n")

    def refresh_current_view_position(self):
        """Re-génère l'affichage en conservant exactement la position visible actuelle."""
        if self.current_results and self.current_reference:
            cur_ch = int(self.chapter_var.get()) if self.chapter_var.get().isdigit() else 1
            cur_v = int(self.verse_var.get()) if self.verse_var.get().isdigit() else None
            if self.last_tracked_ch_v:
                cur_ch, cur_v = self.last_tracked_ch_v
                
            ref_to_use = f"{self.loaded_french_book or self.current_valid_book} {cur_ch}"
            if cur_v:
                ref_to_use += f":{cur_v}"
            self.display_results(ref_to_use, self.current_results)

    def on_book_focus_in(self, event=None):
        self.after(50, lambda: self.book_menu._entry.select_range(0, 'end'))

    def on_book_key_release(self, event):
        if event.keysym in ('Return', 'Tab', 'Escape', 'Up', 'Down', 'Left', 'Right'):
            return
        typed = self.book_menu.get().strip()
        if not typed:
            self.book_menu.configure(values=self.all_book_names)
            return
            
        q = strip_accents(typed)
        filtered = [b for b in self.all_book_names if strip_accents(b).startswith(q) or q in strip_accents(b)]
        if filtered:
            self.book_menu.configure(values=filtered)
        else:
            self.book_menu.configure(values=self.all_book_names)

    def on_book_entry_return(self, event=None):
        typed = self.book_menu.get().strip()
        parsed = parse_smart_book_input(typed, self.all_book_names)
        if parsed and parsed.get("book"):
            target_book = parsed["book"]
            target_chapter = parsed.get("chapter")
            target_verse = parsed.get("verse")
            self.apply_book_selection(target_book, chapter=target_chapter, verse=target_verse)
        else:
            self.book_var.set(self.current_valid_book)
            self.book_menu.configure(values=self.all_book_names)
            
        self.book_menu._entry.selection_clear()
        self.focus_set()

    def on_book_entry_focus_out(self, event=None):
        typed = self.book_menu.get().strip()
        parsed = parse_smart_book_input(typed, self.all_book_names)
        if parsed and parsed.get("book"):
            target_book = parsed["book"]
            if target_book != self.current_valid_book:
                self.apply_book_selection(target_book, chapter=parsed.get("chapter"), verse=parsed.get("verse"))
            else:
                self.book_var.set(self.current_valid_book)
        else:
            self.book_var.set(self.current_valid_book)
        self.book_menu.configure(values=self.all_book_names)

    def apply_book_selection(self, book_name, chapter=None, verse=None):
        self.current_valid_book = book_name
        self.book_var.set(book_name)
        self.book_menu.configure(values=self.all_book_names)
        
        code = FRENCH_TO_CODE.get(book_name, "Joh")
        ch_count = CODE_TO_CH_COUNT.get(code, 1)
        
        # Si le même livre est déjà affiché dans le lecteur continu, on scrolle directement
        if self.loaded_book_code == code:
            self.is_updating_breadcrumb = True
            try:
                ch_values = [str(x) for x in range(1, ch_count + 1)]
                self.chapter_menu.configure(values=ch_values)
                if chapter and str(chapter).isdigit() and 1 <= int(chapter) <= ch_count:
                    self.chapter_var.set(str(chapter))
                else:
                    self.chapter_var.set("1")
                    
                if verse:
                    self.verse_var.set(str(verse))
                else:
                    self.verse_var.set("Tous")
            finally:
                self.is_updating_breadcrumb = False
                
            ch_target = int(self.chapter_var.get()) if self.chapter_var.get().isdigit() else 1
            v_target = int(verse) if verse and str(verse).isdigit() else None
            self.scroll_to_ref(ch_target, v_target)
            return
            
        self.is_updating_breadcrumb = True
        try:
            ch_values = [str(x) for x in range(1, ch_count + 1)]
            self.chapter_menu.configure(values=ch_values)
            
            if chapter and str(chapter).isdigit() and 1 <= int(chapter) <= ch_count:
                self.chapter_var.set(str(chapter))
            else:
                self.chapter_var.set("1")
                
            if verse:
                self.verse_menu.configure(values=["Tous", str(verse)])
                self.verse_var.set(str(verse))
            else:
                self.verse_menu.configure(values=["Tous"])
                self.verse_var.set("Tous")
        finally:
            self.is_updating_breadcrumb = False
            
        if hasattr(self.master, 'on_reference_change'):
            self.master.on_reference_change()

    def schedule_scroll_sync(self):
        """Temporise la détection de défilement pour synchroniser le fil d'Ariane et les commentaires."""
        if self._scroll_sync_job:
            try:
                self.after_cancel(self._scroll_sync_job)
            except Exception:
                pass
        self._scroll_sync_job = self.after(50, self.on_bible_scroll_tracked)

    def on_bible_scroll_tracked(self):
        """Détecte en temps réel le verset et le chapitre visibles en haut de l'écran et synchronise les panneaux."""
        if self.is_updating_breadcrumb or not self.loaded_book_code:
            return
            
        try:
            top_idx = self.bible_textbox._textbox.index("@0,10")
        except Exception:
            return
            
        tags = self.bible_textbox._textbox.tag_names(top_idx)
        ref_tags = [t for t in tags if t.startswith("ref_")]
        
        cur_ch = None
        cur_v = None
        
        if ref_tags:
            parts = ref_tags[0].split("_")
            if len(parts) >= 3:
                cur_ch = int(parts[1]) if parts[1].isdigit() else parts[1]
                cur_v = int(parts[2]) if parts[2].isdigit() else parts[2]
        else:
            prev_ref = self.bible_textbox._textbox.tag_prevrange("verse_num", top_idx)
            if prev_ref:
                prev_tags = self.bible_textbox._textbox.tag_names(prev_ref[0])
                r_tags = [t for t in prev_tags if t.startswith("ref_")]
                if r_tags:
                    parts = r_tags[0].split("_")
                    if len(parts) >= 3:
                        cur_ch = int(parts[1]) if parts[1].isdigit() else parts[1]
                        cur_v = int(parts[2]) if parts[2].isdigit() else parts[2]
                        
        if cur_ch is not None:
            if (cur_ch, cur_v) != self.last_tracked_ch_v:
                self.last_tracked_ch_v = (cur_ch, cur_v)
                
                self.is_updating_breadcrumb = True
                try:
                    if str(cur_ch) != self.chapter_var.get():
                        self.chapter_var.set(str(cur_ch))
                    if cur_v and str(cur_v) != self.verse_var.get():
                        cur_vals = self.verse_menu.cget("values")
                        if str(cur_v) in cur_vals:
                            self.verse_var.set(str(cur_v))
                finally:
                    self.is_updating_breadcrumb = False
                    
                self.sync_commentary_to_verse(cur_ch, cur_v or 1)

    def sync_commentary_to_verse(self, chapter, verse):
        """Fait défiler le panneau des commentaires vers la note correspondant au verset visible tout en haut."""
        if not self.comm_textbox._textbox.winfo_exists():
            return
            
        tag_exact = f"comm_ref_{chapter}_{verse}"
        pos = self.comm_textbox._textbox.tag_ranges(tag_exact)
        if pos:
            self.comm_textbox._textbox.yview(pos[0])
            return
            
        if isinstance(verse, int) and verse > 1:
            for prev_v in range(verse - 1, 0, -1):
                p_tag = f"comm_ref_{chapter}_{prev_v}"
                p_pos = self.comm_textbox._textbox.tag_ranges(p_tag)
                if p_pos:
                    self.comm_textbox._textbox.yview(p_pos[0])
                    return
                    
        chap_tag = f"comm_chap_{chapter}"
        c_pos = self.comm_textbox._textbox.tag_ranges(chap_tag)
        if c_pos:
            self.comm_textbox._textbox.yview(c_pos[0])

    def scroll_to_ref(self, chapter, verse=None):
        """Positionne instantanément le défilement de la Bible TOUT EN HAUT de la fenêtre sur le verset ou chapitre demandé."""
        if not self.bible_textbox._textbox.winfo_exists():
            return
            
        target_tag = None
        if verse is not None and str(verse) != "Tous":
            target_tag = f"ref_{chapter}_{verse}"
        else:
            target_tag = f"chap_header_{chapter}"
            
        pos = self.bible_textbox._textbox.tag_ranges(target_tag)
        if not pos:
            pos = self.bible_textbox._textbox.tag_ranges(f"ref_{chapter}_1")
            
        if pos:
            # Positionne le verset/chapitre TOUT EN HAUT de la fenêtre de lecture
            self.bible_textbox._textbox.yview(pos[0])
            
        v_num = int(verse) if verse and str(verse).isdigit() else 1
        self.sync_commentary_to_verse(chapter, v_num)

    def toggle_bible_full_width(self):
        """Bascule le texte biblique entre le mode 2 volets (étude) et le mode pleine largeur (volet unique)."""
        self.bible_full_width = not self.bible_full_width
        self.config["bible_full_width"] = self.bible_full_width
        save_config(self.config)
        
        btn_txt = "🗗 2 Volets" if self.bible_full_width else "🗖 Pleine largeur"
        self.btn_toggle_wide.configure(text=btn_txt)
        
        if not self.is_immersive_mode and self.main_tabs.get() == "📖 Lecture":
            self.set_full_width_mode(self.bible_full_width)

    def toggle_fullscreen_reading(self):
        """Déclenche le mode plein écran total immersif (F11 / Échap)."""
        if hasattr(self.master, 'toggle_fullscreen'):
            self.master.toggle_fullscreen()

    def enable_immersive_mode(self, enable=True):
        """Active ou désactive le mode plein écran immersif total dédié au texte biblique."""
        self.is_immersive_mode = enable
        if enable:
            self.breadcrumb_frame.grid_remove()
            self.right_tabs.grid_remove()
            self.main_tabs.grid(row=0, column=0, columnspan=2, rowspan=2, sticky="nsew", padx=0, pady=0)
            self.main_tabs.set("📖 Lecture")
            self.btn_exit_fullscreen.place(relx=0.98, rely=0.015, anchor="ne")
        else:
            self.btn_exit_fullscreen.place_forget()
            self.breadcrumb_frame.grid(row=0, column=0, columnspan=2, pady=(10, 5), sticky="w", padx=15)
            cur = self.main_tabs.get()
            if cur == "📖 Lecture":
                self.set_full_width_mode(self.bible_full_width)
            else:
                self.set_full_width_mode(True)

    def on_main_tab_changed(self):
        if self.is_immersive_mode:
            return
        current = self.main_tabs.get()
        if current == "📖 Lecture":
            self.set_full_width_mode(self.bible_full_width)
        else:
            self.set_full_width_mode(True)

    def set_full_width_mode(self, full_width=True):
        if full_width:
            self.right_tabs.grid_remove()
            self.main_tabs.grid(row=1, column=0, columnspan=2, sticky="nsew", padx=10, pady=(0, 10))
        else:
            self.main_tabs.grid(row=1, column=0, columnspan=1, sticky="nsew", padx=(10, 5), pady=(0, 10))
            self.right_tabs.grid(row=1, column=1, sticky="nsew", padx=(5, 10), pady=(0, 10))

    def open_closable_tab(self, tab_name, TabContentClass, **kwargs):
        try:
            self.main_tabs.tab(tab_name)
            self.main_tabs.set(tab_name)
            self.set_full_width_mode(True)
            return
        except ValueError:
            pass
            
        new_tab = self.main_tabs.add(tab_name)
        self.main_tabs.set(tab_name)
        self.set_full_width_mode(True)
        
        header_frame = ctk.CTkFrame(new_tab, fg_color="transparent")
        header_frame.pack(fill="x", pady=(0, 6))
        
        btn_close = ctk.CTkButton(
            header_frame, 
            text="❌ Fermer l'onglet", 
            fg_color="#EF4444", 
            hover_color="#DC2626", 
            width=130,
            height=28,
            font=ctk.CTkFont(size=12, weight="bold"),
            command=lambda: self.close_tab(tab_name)
        )
        btn_close.pack(side="right", padx=10)
        
        content = TabContentClass(new_tab, close_callback=lambda: self.close_tab(tab_name), **kwargs)
        content.pack(fill="both", expand=True)
        
    def close_tab(self, tab_name):
        try:
            self.main_tabs.delete(tab_name)
        except ValueError:
            pass
        if self.is_immersive_mode:
            return
        cur = self.main_tabs.get()
        if cur == "📖 Lecture":
            self.set_full_width_mode(self.bible_full_width)

    def show_progress(self, message, percentage=0):
        if not self.progress_frame.winfo_ismapped():
            self.progress_frame.grid(row=0, column=0, columnspan=2, sticky="e", padx=15, pady=(10, 5))
        self.progress_label.configure(text=f"{message} ({percentage}%)")
        self.progress_bar.set(percentage / 100.0)
        self.update_idletasks()
        
    def hide_progress(self):
        self.progress_frame.grid_forget()
        
    def display_status_message(self, message):
        for box in [self.bible_textbox, self.comm_textbox]:
            box.configure(state="normal")
            box.delete("0.0", "end")
            box.insert("end", f"{message}\n", "welcome")
            box.configure(state="disabled")

    def change_font_size(self, delta):
        self.font_size = max(10, min(36, self.font_size + delta))
        self.save_and_apply_font()
        
    def toggle_font(self):
        self.font_family = "Arial" if self.font_family == "Georgia" else "Georgia"
        self.save_and_apply_font()
        
    def save_and_apply_font(self):
        self.config["font_family"] = self.font_family
        self.config["font_size"] = self.font_size
        save_config(self.config)
        self.update_tags()
        if self.current_results:
            self.display_results(self.current_reference, self.current_results)
        else:
            self.display_welcome()
            
    def update_tags(self):
        is_dark = (ctk.get_appearance_mode() == "Dark")
        
        text_col = "#E2E8F0" if is_dark else "#1A1A1A"
        title_col = "#F8FAFC" if is_dark else "#0F172A"
        chap_col = "#F8FAFC" if is_dark else "#1E293B"
        verse_num_col = "#94A3B8" if is_dark else "#64748B"
        source_col = "#60A5FA" if is_dark else "#1E293B"
        divider_col = "#94A3B8" if is_dark else "#0F172A"
        welcome_col = "#94A3B8" if is_dark else "#666666"
        error_col = "#F87171" if is_dark else "#D32F2F"
        skeleton_col = "#475569" if is_dark else "#D1D5DB"
        
        verse_hdr_col = "#60A5FA" if is_dark else "#2563EB"
        bible_abbr_col = "#C084FC" if is_dark else "#7C3AED"
        diff_pct_col = "#94A3B8" if is_dark else "#888888"
        diff_add_col = "#60A5FA" if is_dark else "#2563EB"
        diff_del_col = "#F87171" if is_dark else "#EF4444"
        diff_rep_col = "#FBBF24" if is_dark else "#D97706"
        interlinear_col = "#38BDF8" if is_dark else "#0284C7"
        line_sp = getattr(self, 'line_spacing', 6)
        sp1 = max(1, line_sp // 2)
        sp2 = line_sp
        sp3 = max(1, line_sp // 2)
        
        textboxes_to_update = [self.bible_textbox, self.comm_textbox]
        if hasattr(self, 'lex_textbox'):
            textboxes_to_update.append(self.lex_textbox)
            
        for box in textboxes_to_update:
            box._textbox.tag_configure("title", font=(self.font_family, self.font_size + 4, "bold"), foreground=title_col, justify="center", spacing3=15)
            box._textbox.tag_configure("source_name", font=(self.font_family, self.font_size + 1, "bold"), foreground=source_col, spacing1=12, spacing3=4)
            box._textbox.tag_configure("verse_num", font=(self.font_family, max(9, self.font_size - 4), "bold"), offset=4, foreground=verse_num_col)
            box._textbox.tag_configure("body", font=(self.font_family, self.font_size), foreground=text_col, spacing1=sp1, spacing2=sp2, spacing3=sp3)
            box._textbox.tag_configure("welcome", font=(self.font_family, self.font_size, "italic"), foreground=welcome_col, justify="center", spacing1=20)
            box._textbox.tag_configure("error", font=(self.font_family, self.font_size, "bold"), foreground=error_col, justify="center")
            box._textbox.tag_configure("skeleton", font=(self.font_family, self.font_size), foreground=skeleton_col, spacing1=4)
            box._textbox.tag_configure("book_title", font=(self.font_family, self.font_size + 4, "bold"), justify="center", spacing1=8, spacing3=12, foreground=title_col)
            box._textbox.tag_configure("chapter_num", font=(self.font_family, self.font_size + 7, "bold"), foreground=chap_col)
            box._textbox.tag_configure("chapter_divider", font=(self.font_family, self.font_size + 2, "bold"), foreground=divider_col, justify="center", spacing1=16, spacing3=8)
            
            # Tags Strong, Lexique & Bailly
            box._textbox.tag_configure("strong_word", font=(self.font_family, self.font_size), foreground=text_col, spacing1=sp1, spacing2=sp2, spacing3=sp3)
            box._textbox.tag_configure("interlinear_gloss", font=(self.font_family, max(9, self.font_size - 5), "bold"), foreground=interlinear_col)
            box._textbox.tag_configure("lex_lemma", font=(self.font_family, self.font_size + 6, "bold"), foreground=title_col, justify="center", spacing1=4, spacing3=8)
            box._textbox.tag_configure("lex_details", font=(self.font_family, self.font_size - 2, "italic"), foreground=verse_num_col, spacing1=3)
            box._textbox.tag_configure("bailly_header", font=(self.font_family, self.font_size + 1, "bold"), foreground="#38BDF8" if is_dark else "#0284C7", spacing1=14, spacing3=4)
            box._textbox.tag_configure("bailly_headword", font=(self.font_family, self.font_size, "bold"), foreground=title_col, spacing1=4)
            
            # Tags de l'agencement Interlinéaire Inversé Logos
            box._textbox.tag_configure("logos_surface", font=(self.font_family, self.font_size, "bold"), foreground=text_col, spacing1=2, spacing2=1)
            box._textbox.tag_configure("logos_lemma", font=(self.font_family, max(10, self.font_size - 3)), foreground="#60A5FA" if is_dark else "#2563EB", spacing1=1, spacing2=1)
            box._textbox.tag_configure("logos_translit", font=(self.font_family, max(9, self.font_size - 4), "italic"), foreground="#94A3B8" if is_dark else "#64748B", spacing1=1, spacing2=1)
            box._textbox.tag_configure("logos_strong", font=(self.font_family, max(9, self.font_size - 5), "bold"), foreground="#F59E0B" if is_dark else "#D97706", spacing1=1, spacing2=4)
            
        # Tags de comparaison et d'interaction sur la zone Bible
        self.bible_textbox._textbox.tag_configure("verse_header", font=(self.font_family, self.font_size, "bold"), foreground=verse_hdr_col, spacing1=12, spacing3=4)
        self.bible_textbox._textbox.tag_configure("bible_abbr", font=(self.font_family, self.font_size - 3, "bold"), foreground=bible_abbr_col)
        self.bible_textbox._textbox.tag_configure("diff_percent", font=(self.font_family, self.font_size - 4, "italic"), foreground=diff_pct_col)
        self.bible_textbox._textbox.tag_configure("diff_added", font=(self.font_family, self.font_size), foreground=diff_add_col, underline=True)
        self.bible_textbox._textbox.tag_configure("diff_deleted", font=(self.font_family, self.font_size, "bold"), foreground=diff_del_col)
        self.bible_textbox._textbox.tag_configure("diff_replaced", font=(self.font_family, self.font_size), foreground=diff_rep_col, underline=True)
        
        # Tag de survol dynamique pour les mots des dictionnaires
        hover_bg = "#1E3A8A" if is_dark else "#E0F2FE"
        hover_fg = "#38BDF8" if is_dark else "#0284C7"
        self.bible_textbox._textbox.tag_configure("hover_dict_highlight", background=hover_bg, foreground=hover_fg, underline=True)

    def display_welcome(self):
        textboxes_to_clear = [self.bible_textbox, self.comm_textbox]
        if hasattr(self, 'lex_textbox'):
            textboxes_to_clear.append(self.lex_textbox)
            
        for box in textboxes_to_clear:
            box.configure(state="normal")
            box.delete("0.0", "end")
            box.configure(state="disabled")
            
        self.bible_textbox.configure(state="normal")
        self.bible_textbox.insert("end", "Recherchez un verset en haut (ex: Jean 3.16) pour commencer la lecture.", "welcome")
        self.bible_textbox.configure(state="disabled")
        
        self.comm_textbox.configure(state="normal")
        self.comm_textbox.insert("end", "Les commentaires liés s'afficheront ici.", "welcome")
        self.comm_textbox.configure(state="disabled")
        
        if hasattr(self, 'lex_textbox'):
            self.lex_textbox.configure(state="normal")
            self.lex_textbox.insert("end", "Cliquez sur un mot dans une Bible avec Strong (ex: Segond 1910) pour afficher sa définition hébraïque ou grecque.", "welcome")
            self.lex_textbox.configure(state="disabled")

    def start_skeleton_loader(self):
        self.stop_skeleton_loader()
        self.skeleton_active = True
        
        for box in [self.bible_textbox, self.comm_textbox]:
            box.configure(state="normal")
            box.delete("0.0", "end")
            box.insert("end", "Chargement en cours...\n", "welcome")
            box.configure(state="disabled")
            
    def stop_skeleton_loader(self):
        self.skeleton_active = False
        if getattr(self, 'skeleton_after_id', None):
            try:
                self.after_cancel(self.skeleton_after_id)
            except Exception:
                pass
            self.skeleton_after_id = None

    def on_book_changed(self, book_name):
        if self.is_updating_breadcrumb:
            return
        parsed = parse_smart_book_input(book_name, self.all_book_names)
        target_book = parsed["book"] if parsed and parsed.get("book") else book_name
        self.apply_book_selection(target_book)

    def on_chapter_changed(self, chapter):
        if self.is_updating_breadcrumb:
            return
        ch_num = int(chapter) if str(chapter).isdigit() else 1
        if self.loaded_book_code:
            self.scroll_to_ref(ch_num, None)
        else:
            if hasattr(self.master, 'on_reference_change'):
                self.master.on_reference_change()

    def on_verse_changed(self, verse):
        if self.is_updating_breadcrumb:
            return
        ch_num = int(self.chapter_var.get()) if self.chapter_var.get().isdigit() else 1
        v_num = int(verse) if str(verse).isdigit() else None
        if self.loaded_book_code:
            self.scroll_to_ref(ch_num, v_num)
        else:
            if hasattr(self.master, 'on_reference_change'):
                self.master.on_reference_change()

    def toggle_compare_mode(self):
        self.compare_mode = bool(self.compare_switch.get())
        self.config["compare_mode"] = self.compare_mode
        save_config(self.config)
        self.loaded_book_code = None
        if hasattr(self.master, 'on_reference_change'):
            self.master.on_reference_change()

    def update_ref_bibles(self):
        from gui.library_utils import load_books_metadata
        registry = load_books_metadata()
        active_bibles = [name for name, meta in registry.items() if meta.get("type", "Bible") == "Bible" and meta.get("active", False)]
        
        if not active_bibles:
            self.ref_bible_var.set("Aucune")
            if hasattr(self, 'btn_ref_bible'):
                self.btn_ref_bible.configure(text="Choisir une Bible  ▾")
        else:
            if self.ref_bible_var.get() not in active_bibles:
                self.ref_bible_var.set(active_bibles[0])
                self.config["reference_bible"] = active_bibles[0]
                save_config(self.config)
            if hasattr(self, 'btn_ref_bible'):
                cur_key = self.ref_bible_var.get()
                self.btn_ref_bible.configure(text=f"{self.get_bible_button_label(cur_key)}  ▾")

    def on_ref_bible_changed(self, choice):
        self.ref_bible_var.set(choice)
        self.config["reference_bible"] = choice
        save_config(self.config)
        if hasattr(self, 'btn_ref_bible'):
            self.btn_ref_bible.configure(text=f"{self.get_bible_button_label(choice)}  ▾")
        full_bible_name = self.get_bible_full_name(choice)
        if not self.compare_mode:
            self.bible_label.configure(text=f"📖 {full_bible_name}")
        else:
            self.bible_label.configure(text=f"📖 Comparaison des Bibles (Réf. : {full_bible_name})")
        self.loaded_book_code = None
        if hasattr(self.master, 'on_reference_change'):
            self.master.on_reference_change()

    def display_results(self, reference, results):
        self.current_reference = reference
        self.current_results = results
        
        # 1. Mise à jour synchrone du fil d'Ariane avec normalisation du code livre
        self.is_updating_breadcrumb = True
        
        norm_ref = normalize_reference(reference) or reference
        parts = norm_ref.strip().split(" ")
        raw_book = parts[0] if len(parts) > 0 else ""
        book_code = FRENCH_TO_CODE.get(raw_book, raw_book)
        chapter_verse = parts[1] if len(parts) > 1 else "1"
        
        french_book = CODE_TO_FRENCH.get(book_code, raw_book)
        self.current_valid_book = french_book
        self.loaded_book_code = book_code
        self.loaded_french_book = french_book
        
        target_chapter = 1
        target_verse = None
        if ":" in chapter_verse:
            c, v = chapter_verse.split(":")
            target_chapter = int(c) if c.isdigit() else 1
            target_verse = int(v) if v.isdigit() else None
        elif chapter_verse.isdigit():
            target_chapter = int(chapter_verse)
            
        self.book_var.set(french_book)
        self.book_menu.configure(values=self.all_book_names)
        
        ch_count = CODE_TO_CH_COUNT.get(book_code, 1)
        self.chapter_menu.configure(values=[str(x) for x in range(1, ch_count + 1)])
        self.chapter_var.set(str(target_chapter))
        
        # Extraire les versets réels dans les résultats
        all_metas = results.get('metadatas', []) if results else []
        verses_set = set()
        for m in all_metas:
            v = m.get('verse')
            if v is not None:
                verses_set.add(str(v))
                
        sorted_verses = ["Tous"] + sorted(list(verses_set), key=lambda x: int(x) if x.isdigit() else 999)
        self.verse_menu.configure(values=sorted_verses)
        self.verse_var.set(str(target_verse) if target_verse else "Tous")
        
        self.is_updating_breadcrumb = False
        
        # 2. Remplir les zones de texte
        for box in [self.bible_textbox, self.comm_textbox]:
            box.configure(state="normal")
            box.delete("0.0", "end")
            
        if not results:
            self.bible_label.configure(text="📖 Aucun texte biblique")
            self.bible_textbox.insert("end", "Aucun texte biblique trouvé.", "welcome")
            self.comm_textbox.insert("end", "Aucun commentaire trouvé.", "welcome")
            for box in [self.bible_textbox, self.comm_textbox]:
                box.configure(state="disabled")
            return
            
        documents = results.get('documents', [])
        metadatas = results.get('metadatas', [])
        
        bibles_grouped = {}
        comms_grouped = {}
        
        for doc, meta in zip(documents, metadatas):
            doc_type = meta.get('type', 'Bible')
            source = meta.get('name', 'Inconnu')
            
            if doc_type == "Bible":
                if source not in bibles_grouped:
                    bibles_grouped[source] = []
                bibles_grouped[source].append((doc, meta))
            else:
                if source not in comms_grouped:
                    comms_grouped[source] = []
                comms_grouped[source].append((doc, meta))
                
        # --- AFFICHER LES BIBLES EN FLUX CONTINU ---
        if not bibles_grouped:
            self.bible_label.configure(text="📖 Aucun texte biblique")
            self.bible_textbox.insert("end", "Aucun texte biblique trouvé.", "welcome")
        else:
            show_diff_pct = self.config.get("show_diff_percentage", True)
            show_diff_colors = self.config.get("show_diff_highlights", True)
            ref_source = self.config.get("reference_bible")
            
            active_bibles = list(bibles_grouped.keys())
            if not ref_source or ref_source not in bibles_grouped:
                ref_source = active_bibles[0] if active_bibles else None
                
            self.ref_bible_var.set(ref_source if ref_source else "")
            if hasattr(self, 'btn_ref_bible') and ref_source:
                self.btn_ref_bible.configure(text=f"{self.get_bible_button_label(ref_source)}  ▾")
            full_bible_name = self.get_bible_full_name(ref_source) if ref_source else "Texte Biblique"
            
            if not self.compare_mode:
                self.bible_label.configure(text=f"📖 {full_bible_name}")
                if ref_source and ref_source in bibles_grouped:
                    # Titre du Livre
                    self.bible_textbox.insert("end", f"{french_book.upper()}\n\n", "book_title")
                    
                    # Regrouper par chapitre
                    chapters_map = {}
                    for doc, meta in bibles_grouped[ref_source]:
                        ch = meta.get('chapter', 1)
                        if ch not in chapters_map:
                            chapters_map[ch] = []
                        chapters_map[ch].append((doc, meta))
                        
                    sorted_chaps = sorted(chapters_map.keys(), key=lambda x: int(x) if str(x).isdigit() else 999)
                    
                    for ch_idx, cur_ch in enumerate(sorted_chaps):
                        # Séparateur compact entre chapitres
                        if ch_idx > 0:
                            self.bible_textbox.insert("end", "\n\n")
                            
                        # Numéro de chapitre en grand style Bible imprimée
                        if self.show_chapter_numbers:
                            start_ch = self.bible_textbox.index("end-1c")
                            self.bible_textbox.insert("end", f"{cur_ch} ", "chapter_num")
                            end_ch = self.bible_textbox.index("end-1c")
                            self.bible_textbox._textbox.tag_add(f"chap_header_{cur_ch}", start_ch, end_ch)
                        else:
                            # Poser le tag chap_header sans insérer de chiffre visible
                            start_ch = self.bible_textbox.index("end-1c")
                            self.bible_textbox._textbox.tag_add(f"chap_header_{cur_ch}", start_ch, start_ch)
                        
                        for doc, meta in chapters_map[cur_ch]:
                            ref = meta.get('reference', '')
                            v_num = ref.split(":")[-1] if ":" in ref else str(meta.get('verse', ''))
                            
                            # Détecter si le verset marque un nouveau paragraphe (ex: préfixé par * dans Segond 21)
                            is_para_start = False
                            if doc.startswith("*") or doc.startswith("¶"):
                                is_para_start = True
                                doc = doc[1:].strip()
                                
                            if not self.verse_per_line and is_para_start and str(v_num) != "1":
                                self.bible_textbox.insert("end", "\n\n")
                                
                            start_v = self.bible_textbox.index("end-1c")
                            
                            if self.show_verse_numbers and v_num:
                                self.bible_textbox.insert("end", f"{v_num} ", "verse_num")
                                
                            self.render_verse_content(doc, cur_ch, v_num, self.verse_per_line)
                                
                            end_v = self.bible_textbox.index("end-1c")
                            
                            # Poser les tags de verset et de chapitre pour la synchronisation
                            if v_num:
                                self.bible_textbox._textbox.tag_add(f"ref_{cur_ch}_{v_num}", start_v, end_v)
                            self.bible_textbox._textbox.tag_add(f"chap_{cur_ch}", start_v, end_v)
                else:
                    self.bible_textbox.insert("end", "Aucune bible active sélectionnée comme référence.", "welcome")
            else:
                # MODE COMPARAISON CONTINU
                self.bible_label.configure(text=f"📖 Comparaison des Bibles (Réf. : {full_bible_name})")
                
                verses_map = {}
                for source, items in bibles_grouped.items():
                    for doc, meta in items:
                        ref = meta.get('reference', '')
                        if ref:
                            if ref not in verses_map:
                                verses_map[ref] = {}
                            verses_map[ref][source] = doc
                            
                def parse_ref_key(ref_str):
                    parts = ref_str.strip().split(" ")
                    if len(parts) < 2:
                        return (0, 0)
                    ch_v = parts[1]
                    if ":" in ch_v:
                        c, v = ch_v.split(":")
                        return (int(c) if c.isdigit() else 0, int(v) if v.isdigit() else 0)
                    else:
                        return (int(ch_v) if ch_v.isdigit() else 0, 0)
                        
                sorted_refs = sorted(verses_map.keys(), key=parse_ref_key)
                
                ABBR_MAP = {
                    "Chouraqui": "CHO", "Colombe": "COL", "Segond 21": "S21", "S21": "S21",
                    "Bible Segond 21": "S21", "Segond 1910": "LSG", "Louis Segond": "LSG",
                    "LSG": "LSG", "NBS": "NBS", "Nouvelle Bible Segond": "NBS", "SER": "SER",
                    "TOB 2010": "TOB", "TOB": "TOB", "Darby": "DRB", "Parole Vivante": "PV",
                    "PV": "PV", "Bible Parole Vivante": "PV", "Sagesse Vivante": "SV",
                    "SV": "SV", "JXLFR": "JXLFR", "Juxtalinéaire": "JXLFR", "Juxtalinéaire FR": "JXLFR",
                    "APEE": "APEE", "Bible de l'Épée": "APEE", "Épée": "APEE", "OST": "OST",
                    "Ostervald": "OST", "Bible d'Ostervald": "OST", "NCL": "NCL",
                    "Néo-Crampon Libre": "NCL", "Crampon": "NCL", "Parole de Vie": "PDV",
                    "Français Courant": "BFC", "Nouvelle Français Courant": "NFC", "Semeur": "BDS"
                }
                def get_abbr(name):
                    return ABBR_MAP.get(name, name[:4].upper())
                
                last_rendered_chap = None
                
                for ref_key in sorted_refs:
                    parts = ref_key.split(" ")
                    b_code = parts[0]
                    ch_v = parts[1] if len(parts) > 1 else ""
                    fr_book = CODE_TO_FRENCH.get(b_code, b_code)
                    
                    cur_ch_num = int(ch_v.split(":")[0]) if ":" in ch_v and ch_v.split(":")[0].isdigit() else (int(ch_v) if ch_v.isdigit() else 1)
                    cur_v_num = int(ch_v.split(":")[1]) if ":" in ch_v and ch_v.split(":")[1].isdigit() else 1
                    
                    # Séparateur de chapitre
                    if cur_ch_num != last_rendered_chap:
                        last_rendered_chap = cur_ch_num
                        header_tag = f"chap_header_{cur_ch_num}"
                        self.bible_textbox.insert("end", f"\n\n  ───  {fr_book} {cur_ch_num}  ───\n\n", ("chapter_divider", header_tag))
                        
                    start_vr = self.bible_textbox.index("end-1c")
                    self.bible_textbox.insert("end", f"\n{fr_book} {ch_v}\n", "verse_header")
                    
                    bible_sources = list(verses_map[ref_key].keys())
                    if not bible_sources:
                        continue
                        
                    if ref_source in bible_sources:
                        bible_sources.remove(ref_source)
                        bible_sources.insert(0, ref_source)
                        
                    actual_ref_source = bible_sources[0]
                    ref_text = format_bible_text(verses_map[ref_key][actual_ref_source], self.show_headings)
                    
                    v_num = ref_key.split(":")[-1] if ":" in ref_key else ""
                    if v_num:
                        ref_text = re.sub(r'^' + re.escape(v_num) + r'(?!\d)[\s\xa0\u200b]*', '', ref_text)
                        
                    self.bible_textbox.insert("end", f"{get_abbr(actual_ref_source)} ", "bible_abbr")
                    self.bible_textbox.insert("end", f"{ref_text} ", "body")
                    if show_diff_pct:
                        self.bible_textbox.insert("end", "  (réf.)", "diff_percent")
                    self.bible_textbox.insert("end", "\n")
                    
                    def tokenize(text):
                        return re.findall(r'[\w\'-]+|[^\w\s]|\s+', text)

                    ref_tokens = tokenize(ref_text)
                    
                    for other_source in bible_sources[1:]:
                        other_text = format_bible_text(verses_map[ref_key][other_source], self.show_headings)
                        if v_num:
                            other_text = re.sub(r'^' + re.escape(v_num) + r'(?!\d)[\s\xa0\u200b]*', '', other_text)
                            
                        self.bible_textbox.insert("end", f"{get_abbr(other_source)} ", "bible_abbr")
                        
                        if other_text == ref_text:
                            self.bible_textbox.insert("end", other_text, "body")
                            if show_diff_pct:
                                self.bible_textbox.insert("end", "  (0% de diff.)", "diff_percent")
                            self.bible_textbox.insert("end", "\n")
                            continue
                            
                        other_tokens = tokenize(other_text)
                        matcher = difflib.SequenceMatcher(None, ref_tokens, other_tokens)
                        diff_percent = int((1.0 - matcher.ratio()) * 100)
                        
                        opcodes = matcher.get_opcodes()
                        for tag, i1, i2, j1, j2 in opcodes:
                            chunk = "".join(other_tokens[j1:j2])
                            if tag == 'equal':
                                self.bible_textbox.insert("end", chunk, "body")
                            elif tag == 'insert':
                                tag_style = "diff_added" if show_diff_colors else "body"
                                self.bible_textbox.insert("end", chunk, tag_style)
                            elif tag == 'replace':
                                tag_style = "diff_replaced" if show_diff_colors else "body"
                                self.bible_textbox.insert("end", chunk, tag_style)
                            elif tag == 'delete':
                                pass
                                    
                        if show_diff_pct:
                            self.bible_textbox.insert("end", f"  ({diff_percent}% de diff.)", "diff_percent")
                        self.bible_textbox.insert("end", "\n")
                        
                    end_vr = self.bible_textbox.index("end-1c")
                    self.bible_textbox._textbox.tag_add(f"ref_{cur_ch_num}_{cur_v_num}", start_vr, end_vr)
                    self.bible_textbox._textbox.tag_add(f"chap_{cur_ch_num}", start_vr, end_vr)
                        
        # --- AFFICHER LES COMMENTAIRES STRUCTURÉS PAR CHAPITRE ET VERSET ---
        if not comms_grouped:
            self.comm_textbox.insert("end", "Aucun commentaire lié à ce passage.", "welcome")
        else:
            comms_by_chap = {}
            for source, items in comms_grouped.items():
                for doc, meta in items:
                    ch = meta.get('chapter', 1)
                    if ch not in comms_by_chap:
                        comms_by_chap[ch] = []
                    comms_by_chap[ch].append((source, doc, meta))
                    
            sorted_comm_chaps = sorted(comms_by_chap.keys(), key=lambda x: int(x) if str(x).isdigit() else 999)
            
            for ch_idx, cur_ch in enumerate(sorted_comm_chaps):
                chap_comm_tag = f"comm_chap_{cur_ch}"
                if ch_idx == 0:
                    self.comm_textbox.insert("end", f"───  Commentaires pour {french_book} {cur_ch}  ───\n\n", ("chapter_divider", chap_comm_tag))
                else:
                    self.comm_textbox.insert("end", f"\n\n───  Commentaires pour {french_book} {cur_ch}  ───\n\n", ("chapter_divider", chap_comm_tag))
                    
                for source, doc, meta in comms_by_chap[cur_ch]:
                    ref = meta.get('reference', '')
                    v_num = ref.split(":")[-1] if ":" in ref else str(meta.get('verse', ''))
                    clean_doc = format_bible_text(doc, self.show_headings)
                    
                    start_c = self.comm_textbox.index("end-1c")
                    self.comm_textbox.insert("end", f"■ {source}", "source_name")
                    if v_num:
                        self.comm_textbox.insert("end", f" (Verset {v_num})", "verse_num")
                    self.comm_textbox.insert("end", f"\n{clean_doc}\n\n", "body")
                    end_c = self.comm_textbox.index("end-1c")
                    
                    if v_num and v_num.isdigit():
                        self.comm_textbox._textbox.tag_add(f"comm_ref_{cur_ch}_{v_num}", start_c, end_c)
                    self.comm_textbox._textbox.tag_add(f"comm_chap_{cur_ch}", start_c, end_c)
                    
        for box in [self.bible_textbox, self.comm_textbox]:
            box.configure(state="disabled")
            
        # 3. Positionner immédiatement le défilement continu TOUT EN HAUT sur le chapitre et verset demandés
        self.after(50, lambda: self.scroll_to_ref(target_chapter, target_verse))

    def display_error(self, message):
        self.loaded_book_code = None
        for box in [self.bible_textbox, self.comm_textbox]:
            box.configure(state="normal")
            box.delete("0.0", "end")
            box.insert("end", f"{message}\n", "error")
            box.configure(state="disabled")
            
    def get_text_content(self):
        return f"--- TEXTE BIBLIQUE ---\n{self.bible_textbox.get('0.0', 'end')}\n\n--- COMMENTAIRES ---\n{self.comm_textbox.get('0.0', 'end')}"
