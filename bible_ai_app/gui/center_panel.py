import customtkinter as ctk
import re
import difflib
import threading
import webbrowser
from typing import Optional, Dict, Any, List
from core.config import save_config
from core.reference_parser import get_french_book_name, parse_smart_book_input, resolve_book_input, strip_accents, normalize_reference, REVERSE_BOOK_MAPPING, BOOK_MAPPING
from core.strong_lexicon import StrongLexicon
from core.dictionary_manager import DictionaryManager
from core.dictionary_polisher import DictionaryPolisher, AVAILABLE_POLISH_MODELS
from core.wikipedia_client import WikipediaClient
from gui.tooltip import BibleTooltip, WidgetTooltip
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

def clean_and_reflow_commentary_paragraphs(text):
    """
    Nettoie et reconstitue intelligemment le flux typographique d'un commentaire :
    - Préserve les listes à puces (- ..., • ...)
    - Isole proprement les titres et sous-titres (CHAPITRE I, etc.)
    - Raccorde les phrases coupées en plein milieu par les sauts de ligne OCR
    - Sépare proprement les vrais paragraphes
    """
    if not text:
        return []
    if not isinstance(text, str):
        text = str(text)
        
    clean = re.sub(r'<[^>]+>', '', text)
    clean = re.sub(r'\{\{field-on:.*?\}\}', '', clean)
    clean = re.sub(r'\{\{field-off:.*?\}\}', '', clean)
    clean = clean.replace('\xa0', ' ').replace('\u202f', ' ').replace('\u200b', '')
    
    raw_lines = [l.strip() for l in clean.split('\n') if l.strip()]
    
    paragraphs = []
    current_para = []
    
    for line in raw_lines:
        # 1. Si la ligne est une puce (- ou • ou *)
        if line.startswith(('-', '•', '*')):
            if current_para:
                paragraphs.append(" ".join(current_para))
                current_para = []
            paragraphs.append(line)
            continue
            
        # 2. Si la ligne est un titre autonome (ex: CHAPITRE I, LE PREMIER LIVRE..., NOTES SUR LE CHAPITRE...)
        if (line.isupper() and len(line) < 80) or line.startswith(('CHAPITRE ', 'NOTES SUR LE CHAPITRE', 'NOTES SUR LE CHAPITRE.')):
            if current_para:
                paragraphs.append(" ".join(current_para))
                current_para = []
            paragraphs.append(line)
            continue
            
        # 3. Si la ligne commence par un sous-titre de travail ou marqueur de verset
        if line.startswith(('Travail du premier jour', 'Travail du deuxième jour', 'Travail du troisième jour', 'Travail du quatrième jour', 'Travail du cinquième jour', 'Travail du sixième jour', 'Cinquième jour', 'Sixième jour', 'De la lumière et', 'Verset ')):
            if current_para:
                paragraphs.append(" ".join(current_para))
                current_para = []
            current_para.append(line)
            continue
            
        # 4. Fusion intelligente si la ligne continue une phrase en cours
        if not current_para:
            current_para.append(line)
        else:
            prev_line = current_para[-1]
            prev_ends_no_punct = not prev_line.endswith(('.', '!', '?', ':', '»', '"', ';'))
            starts_lowercase = line[0].islower() or line.startswith((',', ';', ')', ']'))
            
            if prev_ends_no_punct or starts_lowercase:
                current_para.append(line)
            else:
                paragraphs.append(" ".join(current_para))
                current_para = [line]
                
    if current_para:
        paragraphs.append(" ".join(current_para))
        
    formatted_paras = []
    for p in paragraphs:
        p = re.sub(r'[ \t]+([,.;:!?»\)])', r'\1', p)
        p = re.sub(r'([«\(])[ \t]+', r'\1', p)
        p = re.sub(r'[ \t]+', ' ', p)
        formatted_paras.append(p.strip())
        
    return formatted_paras

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
        
        # Fil d'Ariane Interactif (Boutons Historique, ComboBox et OptionMenus)
        self.breadcrumb_frame = ctk.CTkFrame(self, fg_color="transparent")
        self.breadcrumb_frame.grid(row=0, column=0, columnspan=2, pady=(10, 5), sticky="ew", padx=15)
        
        # Piles d'Historique de Navigation
        self.history_back = []
        self.history_forward = []
        self._is_navigating_history = False
        self.last_pushed_ref = None
        
        self.history_frame = ctk.CTkFrame(self.breadcrumb_frame, fg_color="transparent")
        self.history_frame.pack(side="left", padx=(0, 6))
        
        self.btn_history_back = ctk.CTkButton(
            self.history_frame,
            text="◀",
            width=28,
            height=28,
            font=ctk.CTkFont(size=12, weight="bold"),
            fg_color=("#E2E8F0", "#1E293B"),
            hover_color=("#CBD5E1", "#334155"),
            text_color=("#94A3B8", "#64748B"),
            state="disabled",
            command=self.navigate_history_back
        )
        self.btn_history_back.pack(side="left", padx=1)
        
        self.btn_history_forward = ctk.CTkButton(
            self.history_frame,
            text="▶",
            width=28,
            height=28,
            font=ctk.CTkFont(size=12, weight="bold"),
            fg_color=("#E2E8F0", "#1E293B"),
            hover_color=("#CBD5E1", "#334155"),
            text_color=("#94A3B8", "#64748B"),
            state="disabled",
            command=self.navigate_history_forward
        )
        self.btn_history_forward.pack(side="left", padx=1)
        
        # Raccourcis clavier pour l'historique
        try:
            self.master.bind("<Alt-Left>", self.navigate_history_back)
            self.master.bind("<Alt-Right>", self.navigate_history_forward)
        except Exception:
            pass
        
        # Sélecteur de livre sous forme de CTkComboBox éditable
        self.book_var = ctk.StringVar(value="Genèse")
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
        
        # Boutons Verset Précédent / Verset Suivant
        self.btn_prev_verse = ctk.CTkButton(
            self.breadcrumb_frame,
            text="▲",
            width=26,
            height=28,
            font=ctk.CTkFont(size=11, weight="bold"),
            fg_color=("#E2E8F0", "#1E293B"),
            hover_color=("#CBD5E1", "#334155"),
            text_color=("#0F172A", "#F8FAFC"),
            border_width=1,
            border_color=("#94A3B8", "#475569"),
            corner_radius=6,
            command=self.nav_prev_verse
        )
        self.btn_prev_verse.pack(side="left", padx=(3, 1))
        WidgetTooltip(self.btn_prev_verse, "Verset précédent (Flèche ↑)")
        
        self.btn_next_verse = ctk.CTkButton(
            self.breadcrumb_frame,
            text="▼",
            width=26,
            height=28,
            font=ctk.CTkFont(size=11, weight="bold"),
            fg_color=("#E2E8F0", "#1E293B"),
            hover_color=("#CBD5E1", "#334155"),
            text_color=("#0F172A", "#F8FAFC"),
            border_width=1,
            border_color=("#94A3B8", "#475569"),
            corner_radius=6,
            command=self.nav_next_verse
        )
        self.btn_next_verse.pack(side="left", padx=(1, 5))
        WidgetTooltip(self.btn_next_verse, "Verset suivant (Flèche ↓)")
        
        self.sep3 = ctk.CTkLabel(self.breadcrumb_frame, text=" | ", text_color="#888888")
        self.sep3.pack(side="left", padx=6)
        
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
        
        # Bouton Loupe (🔍) pour afficher/masquer l'espace de recherche (Ctrl+F)
        self.btn_search_toggle = ctk.CTkButton(
            self.breadcrumb_frame,
            text="🔍",
            width=32,
            height=28,
            font=ctk.CTkFont(size=13),
            fg_color=("#E2E8F0", "#1E293B"),
            hover_color=("#CBD5E1", "#334155"),
            text_color=("#0F172A", "#F8FAFC"),
            border_width=1,
            border_color=("#94A3B8", "#475569"),
            corner_radius=6,
            command=self.toggle_search_tab
        )
        self.btn_search_toggle.pack(side="left", padx=3)
        WidgetTooltip(self.btn_search_toggle, "Rechercher dans la Bible & Bibliothèque (Ctrl+F)")
        
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
        self._hover_comm_ref = None
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
        
        # Barre d'outils du panneau des commentaires (sélecteur d'auteur + synchronisation + navigation)
        self.comm_top_bar = ctk.CTkFrame(self.tab_comm, fg_color=("gray92", "#1E293B"), corner_radius=6, height=34)
        self.comm_top_bar.pack(fill="x", padx=2, pady=(2, 6))
        
        lbl_comm_author = ctk.CTkLabel(self.comm_top_bar, text="Auteur :", font=ctk.CTkFont(size=11, weight="bold"))
        lbl_comm_author.pack(side="left", padx=(8, 4))
        
        self.selected_comm_author_var = ctk.StringVar(value="")
        self.comm_author_menu = ctk.CTkOptionMenu(
            self.comm_top_bar,
            variable=self.selected_comm_author_var,
            values=["Aucun commentaire"],
            command=self.on_comm_author_changed,
            height=26,
            font=ctk.CTkFont(size=11)
        )
        self.comm_author_menu.pack(side="left", fill="x", expand=True, padx=(0, 4))
        
        # Bouton de synchronisation / verrouillage (🔗 Lié vs 🔓 Libre)
        self.is_commentary_locked = True
        self.btn_sync_lock = ctk.CTkButton(
            self.comm_top_bar,
            text="🔗 Lié",
            width=58,
            height=26,
            font=ctk.CTkFont(size=11, weight="bold"),
            fg_color=("#E0F2FE", "#0F2B48"),
            hover_color=("#BAE6FD", "#1E3A8A"),
            text_color=("#0284C7", "#38BDF8"),
            command=self.toggle_sync_lock
        )
        self.btn_sync_lock.pack(side="left", padx=(0, 4))
        
        # Navigation rapide de verset dans le commentaire
        self.comm_nav_frame = ctk.CTkFrame(self.comm_top_bar, fg_color="transparent")
        self.comm_nav_frame.pack(side="right", padx=(0, 6))
        
        self.btn_comm_intro = ctk.CTkButton(
            self.comm_nav_frame,
            text="📖 Intro",
            width=52,
            height=24,
            font=ctk.CTkFont(size=10, weight="bold"),
            fg_color="transparent",
            hover_color=("#E2E8F0", "#334155"),
            text_color=("#64748B", "#94A3B8"),
            command=self.on_toggle_intro_view
        )
        self.btn_comm_intro.pack(side="left", padx=(0, 3))
        
        self.btn_comm_prev = ctk.CTkButton(self.comm_nav_frame, text="◀", width=26, height=24, font=ctk.CTkFont(size=10), command=self.on_prev_comm_verse)
        self.btn_comm_prev.pack(side="left", padx=1)
        
        self.lbl_comm_verse_badge = ctk.CTkLabel(self.comm_nav_frame, text="V. 1", font=ctk.CTkFont(size=11, weight="bold"), width=44)
        self.lbl_comm_verse_badge.pack(side="left", padx=2)
        
        self.btn_comm_next = ctk.CTkButton(self.comm_nav_frame, text="▶", width=26, height=24, font=ctk.CTkFont(size=10), command=self.on_next_comm_verse)
        self.btn_comm_next.pack(side="left", padx=1)
        
        # Commentaires Textbox (inside tab_comm)
        self.comm_textbox = ctk.CTkTextbox(self.tab_comm, wrap="word", fg_color=("#FAFAFA", "#1E1E1E"), text_color=("#1A1A1A", "#E2E8F0"))
        self.comm_textbox.pack(fill="both", expand=True)
        self.comm_textbox.configure(state="disabled")
        
        self.comm_textbox._textbox.bind("<Motion>", self.on_comm_mouse_motion)
        self.comm_textbox._textbox.bind("<Leave>", self.on_comm_mouse_leave)
        self.comm_textbox._textbox.bind("<Button-1>", self.on_comm_mouse_click, add="+")
        
        self.current_comms_grouped = {}
        self.current_french_book = ""
        self.current_active_chapter = 1
        self.current_active_verse = 1
        
        from gui.right_panel import RightPanel
        self.right_panel = RightPanel(
            self.tab_chat, 
            self.get_text_content, 
            self.config,
            db_callback=lambda: getattr(self.master, 'db', None),
            sources_callback=lambda: getattr(self.master, 'active_sources', [])
        )
        self.right_panel.pack(fill="both", expand=True)
        
        # Lexique & Dictionnaires (inside tab_lex)
        self.lex_top_bar = ctk.CTkFrame(self.tab_lex, fg_color=("gray92", "#1E293B"), corner_radius=6, height=34)
        self.lex_top_bar.pack(fill="x", padx=2, pady=(2, 6))
        
        lbl_lex_dict = ctk.CTkLabel(self.lex_top_bar, text="Dictionnaire :", font=ctk.CTkFont(size=11, weight="bold"))
        lbl_lex_dict.pack(side="left", padx=(8, 4))
        
        self.selected_lex_dict_var = ctk.StringVar(value="")
        self.lex_dict_menu = ctk.CTkOptionMenu(
            self.lex_top_bar,
            variable=self.selected_lex_dict_var,
            values=["Aucun dictionnaire"],
            command=self.on_lex_dict_changed,
            height=26,
            font=ctk.CTkFont(size=11)
        )
        self.lex_dict_menu.pack(side="left", fill="x", expand=True, padx=(0, 4))
        
        self.lbl_lex_count_badge = ctk.CTkLabel(
            self.lex_top_bar, 
            text="0 dico", 
            font=ctk.CTkFont(size=10, weight="bold"), 
            width=52
        )
        self.lbl_lex_count_badge.pack(side="right", padx=(0, 8))
        
        self.lex_textbox = ctk.CTkTextbox(self.tab_lex, wrap="word", fg_color=("#FAFAFA", "#1E1E1E"), text_color=("#1A1A1A", "#E2E8F0"))
        self.lex_textbox.pack(fill="both", expand=True, padx=2, pady=(2, 5))
        self.lex_textbox.configure(state="disabled")
        
        self.current_dict_matches = {}
        self.current_wiki_url = None
        self.lex_action_frame = ctk.CTkFrame(self.tab_lex, fg_color="transparent")
        self.lex_action_frame.pack(fill="x", padx=2, pady=(0, 2))
        
        # Frame pour le bouton de polissage IA + sélecteur de modèle
        self.lex_polish_frame = ctk.CTkFrame(self.lex_action_frame, fg_color="transparent")
        self.lex_polish_frame.pack(fill="x", pady=(0, 3))
        
        self.lex_polish_btn = ctk.CTkButton(
            self.lex_polish_frame,
            text="✨ Polir / Restructurer avec l'IA",
            command=self.on_polish_dictionary_with_ai,
            height=30,
            font=ctk.CTkFont(size=11, weight="bold"),
            fg_color=("#8B5CF6", "#6D28D9"),
            hover_color=("#7C3AED", "#5B21B6"),
            text_color="#FFFFFF"
        )
        self.lex_polish_btn.pack(side="left", fill="x", expand=True, padx=(0, 4))
        
        polish_model_names = [m[0] for m in AVAILABLE_POLISH_MODELS]
        default_model = self.config.get("dict_polish_model", "gemini-2.5-flash")
        if default_model not in polish_model_names:
            default_model = "gemini-2.5-flash"
        self.lex_polish_model_var = ctk.StringVar(value=default_model)
        self.lex_polish_model_menu = ctk.CTkOptionMenu(
            self.lex_polish_frame,
            variable=self.lex_polish_model_var,
            values=polish_model_names,
            command=self.on_polish_model_changed,
            height=30,
            width=175,
            font=ctk.CTkFont(size=10, weight="bold")
        )
        self.lex_polish_model_menu.pack(side="right")
        
        self.lex_ai_btn = ctk.CTkButton(
            self.lex_action_frame, 
            text="🤖 Analyser ce mot avec l'IA", 
            command=self.on_analyze_strong_with_ai, 
            state="disabled", 
            height=32,
            font=ctk.CTkFont(size=12, weight="bold")
        )
        self.lex_ai_btn.pack(fill="x", pady=(0, 3))
        
        self.lex_wiki_btn = ctk.CTkButton(
            self.lex_action_frame,
            text="🌐 Ouvrir l'article Wikipédia ↗",
            command=self.on_open_wikipedia_web,
            height=30,
            font=ctk.CTkFont(size=11, weight="bold"),
            fg_color=("#E0F2FE", "#0F2B48"),
            hover_color=("#BAE6FD", "#1E3A8A"),
            text_color=("#0284C7", "#38BDF8")
        )
        
        self.lex_wiki_variant_frame = ctk.CTkFrame(self.lex_action_frame, fg_color="transparent")
        lbl_wiki_var = ctk.CTkLabel(
            self.lex_wiki_variant_frame,
            text="🔀 Article :",
            font=ctk.CTkFont(size=11, weight="bold")
        )
        lbl_wiki_var.pack(side="left", padx=(2, 4))
        
        self.lex_wiki_variant_var = ctk.StringVar(value="")
        self.lex_wiki_variant_menu = ctk.CTkOptionMenu(
            self.lex_wiki_variant_frame,
            variable=self.lex_wiki_variant_var,
            values=["Article principal"],
            command=self.on_wiki_variant_selected,
            height=28,
            font=ctk.CTkFont(size=11)
        )
        self.lex_wiki_variant_menu.pack(side="left", fill="x", expand=True, padx=(0, 4))
        
        self.btn_wiki_custom_search = ctk.CTkButton(
            self.lex_wiki_variant_frame,
            text="🔍 Autre mot",
            width=80,
            height=28,
            font=ctk.CTkFont(size=11),
            command=self.on_search_custom_wikipedia
        )
        self.btn_wiki_custom_search.pack(side="right")
        
        # 4. Langues Originales (inside tab_orig)
        self.tab_orig = self.right_tabs.add("📜 Langues Originales")
        
        self.orig_top_bar = ctk.CTkFrame(self.tab_orig, fg_color=("gray92", "#1E293B"), corner_radius=6, height=34)
        self.orig_top_bar.pack(fill="x", padx=2, pady=(2, 6))
        
        self.lbl_orig_title = ctk.CTkLabel(
            self.orig_top_bar, 
            text="📜 Texte Original & Interlinéaire", 
            font=ctk.CTkFont(size=12, weight="bold"),
            text_color=("#4F46E5", "#818CF8")
        )
        self.lbl_orig_title.pack(side="left", padx=(8, 4))
        
        self.lbl_orig_verse_badge = ctk.CTkLabel(
            self.orig_top_bar, 
            text="V. 1", 
            font=ctk.CTkFont(size=11, weight="bold"), 
            width=50
        )
        self.lbl_orig_verse_badge.pack(side="right", padx=(0, 8))
        
        self.orig_textbox = ctk.CTkTextbox(
            self.tab_orig, 
            wrap="word", 
            fg_color=("#FAFAFA", "#1E1E1E"), 
            text_color=("#1A1A1A", "#E2E8F0")
        )
        self.orig_textbox.pack(fill="both", expand=True, padx=2, pady=(2, 5))
        self.orig_textbox.configure(state="disabled")
        
        self.orig_textbox._textbox.bind("<Motion>", self.on_orig_mouse_motion)
        self.orig_textbox._textbox.bind("<Leave>", self.on_orig_mouse_leave)
        self.orig_textbox._textbox.bind("<Button-1>", self.on_orig_mouse_click, add="+")
        
        self.orig_action_frame = ctk.CTkFrame(self.tab_orig, fg_color="transparent")
        self.orig_action_frame.pack(fill="x", padx=2, pady=(0, 2))
        
        self.orig_ai_btn = ctk.CTkButton(
            self.orig_action_frame, 
            text="🤖 Analyser ce verset original avec l'IA", 
            command=self.on_analyze_orig_with_ai, 
            height=32,
            font=ctk.CTkFont(size=12, weight="bold")
        )
        self.orig_ai_btn.pack(fill="x")
        
        self._orig_words_map = {}
        self._last_orig_hover_tag = None
        self._orig_tooltip_job = None
        
        # Liaison directe des touches de navigation pour tous les textboxes de lecture
        for tb in [self.bible_textbox._textbox, self.comm_textbox._textbox, self.lex_textbox._textbox, self.orig_textbox._textbox]:
            tb.bind("<Down>", lambda e: (self.nav_next_verse(), "break")[1])
            tb.bind("<Up>", lambda e: (self.nav_prev_verse(), "break")[1])
            tb.bind("<Right>", lambda e: (self.nav_next_chapter(), "break")[1])
            tb.bind("<Left>", lambda e: (self.nav_prev_chapter(), "break")[1])
        
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
        """Détecte dynamiquement le mot sous le curseur avec debounce fluide et 0 surcharge CPU."""
        tb = self.bible_textbox._textbox
        try:
            pos = tb.index(f"@{event.x},{event.y}")
            start_idx = tb.index(f"{pos} wordstart")
            end_idx = tb.index(f"{pos} wordend")
            
            # Si le curseur est toujours sur le même mot déjà actif, on ne recalcule rien
            if self._hover_match and self._hover_match[1] == start_idx and self._hover_match[2] == end_idx:
                return
                
            # Vérifier si ce caractère possède un tag Strong
            tags = tb.tag_names(pos)
            strong_code = None
            strong_word = None
            for tag in tags:
                if tag in self._strong_tag_map:
                    strong_code, strong_word = self._strong_tag_map[tag]
                    break
                    
            word = tb.get(start_idx, end_idx).strip(" ,:;.!?()«»[]\"'’\n\r\t")
            if not word and not strong_word:
                self._clear_hover()
                return
                
            query_w = strong_word or word
            match = DictionaryManager.lookup(query_w, strong_code)
            
            if match:
                self._hover_match = (match, start_idx, end_idx)
                tb.tag_remove("hover_dict_highlight", "1.0", "end")
                tb.tag_add("hover_dict_highlight", start_idx, end_idx)
                tb.configure(cursor="hand2")
                
                bb = tb.bbox(start_idx)
                if bb:
                    bx, by, bw, bh = bb
                    root_x = tb.winfo_rootx() + bx
                    root_y = tb.winfo_rooty() + by
                    target_rect = (root_x, root_y, bw, bh)
                else:
                    target_rect = (event.x_root, event.y_root, 20, 20)
                    
                if self.tooltip._after_id:
                    try:
                        self.after_cancel(self.tooltip._after_id)
                    except Exception:
                        pass
                self.tooltip._after_id = self.after(100, lambda rx=target_rect[0], ry=target_rect[1], m=match, tr=target_rect: self.tooltip.show(rx, ry, m, target_rect=tr))
            else:
                self._clear_hover()
        except Exception:
            self._clear_hover()

    def _clear_hover(self):
        """Nettoie instantanément le survol et masque l'infobulle."""
        if hasattr(self, 'tooltip') and self.tooltip._after_id:
            try:
                self.after_cancel(self.tooltip._after_id)
            except Exception:
                pass
            self.tooltip._after_id = None
            
        if hasattr(self, 'bible_textbox') and self.bible_textbox._textbox.winfo_exists():
            tb = self.bible_textbox._textbox
            try:
                tb.tag_remove("hover_dict_highlight", "1.0", "end")
                tb.configure(cursor="")
            except Exception:
                pass
                
        if hasattr(self, 'tooltip'):
            self.tooltip.hide()
            
        self._hover_match = None

    def on_bible_mouse_click(self, event):
        """Ouvre l'article complet dans le volet droit au clic sur un mot reconnu et synchronise le commentaire sur le verset cliqué."""
        # 1. Détecter le verset cliqué pour synchroniser le commentaire
        try:
            click_idx = self.bible_textbox._textbox.index(f"@{event.x},{event.y}")
            tags = self.bible_textbox._textbox.tag_names(click_idx)
            ref_tags = [t for t in tags if t.startswith("ref_")]
            if ref_tags:
                parts = ref_tags[0].split("_")
                if len(parts) >= 3 and parts[1].isdigit() and parts[2].isdigit():
                    ch = int(parts[1])
                    v = int(parts[2])
                    if getattr(self, 'is_commentary_locked', True):
                        self.sync_commentary_to_verse(ch, v)
        except Exception:
            pass

        # 2. Ouvrir le dictionnaire si un mot survolé a été cliqué
        if self._hover_match:
            match, _, _ = self._hover_match
            self._clear_hover()
            self.display_dictionary_entry(match)
        else:
            try:
                tb = self.bible_textbox._textbox
                click_pos = tb.index(f"@{event.x},{event.y}")
                start_w = tb.index(f"{click_pos} wordstart")
                end_w = tb.index(f"{click_pos} wordend")
                clicked_word = tb.get(start_w, end_w).strip(" ,:;.!?()«»[]\"'’\n\r\t")
                if clicked_word and len(clicked_word) >= 2 and not clicked_word.isdigit():
                    lookup_res = DictionaryManager.lookup(clicked_word)
                    if lookup_res:
                        self.display_dictionary_entry(lookup_res)
                    else:
                        self.display_dictionary_entry({"word": clicked_word, "title": clicked_word})
            except Exception:
                pass

    def on_bible_mouse_leave(self, event=None):
        self._clear_hover()

    def on_lex_dict_changed(self, choice):
        """Met à jour instantanément la vue du dictionnaire sélectionné."""
        self.render_selected_dictionary_view()

    def display_dictionary_entry(self, match):
        """Met à jour la liste des dictionnaires disponibles pour ce mot et affiche le premier selon la priorité."""
        if not match:
            return
            
        self.right_tabs.set("🔍 Lexique & Dictionnaires")
        self.current_dict_match_obj = match
        
        matches = list(match.get("matches", []))
        if not matches:
            # Fallback rétro-compatible
            matches = []
            if match.get("strong"):
                matches.append({"dict_id": "strong", "dict_name": "Lexique Hébreu & Grec Strong", "badge": "■ Strong", "title": match.get("word", ""), "entry": match["strong"]})
            if match.get("calmet"):
                matches.append({"dict_id": "calmet", "dict_name": "Dictionnaire Dom Calmet", "badge": "📖 Dom Calmet", "title": match["calmet"].get("title", ""), "art": match["calmet"], "full_text": match["calmet"].get("text", "")})
            if match.get("vigouroux"):
                matches.append({"dict_id": "vigouroux", "dict_name": "Dictionnaire F. Vigouroux", "badge": "📖 Vigouroux", "title": match["vigouroux"].get("title", ""), "art": match["vigouroux"], "full_text": match["vigouroux"].get("text", "")})
            if match.get("bailly"):
                matches.append({"dict_id": "bailly", "dict_name": "Dictionnaire Bailly", "badge": "📖 Bailly", "title": match.get("word", ""), "entries": match.get("bailly", [])})

        # Extraire le terme de recherche pour Wikipédia
        search_term = ""
        if match.get("word"):
            search_term = match["word"].strip()
        elif match.get("title"):
            search_term = match["title"].strip()
        elif matches:
            search_term = matches[0].get("title", "").strip()

        clean_search_term = re.sub(r'[\(\[\{].*?[\)\]\}]', '', search_term).strip(" ,:;.!?«»\"'’\n\r\t")
        if clean_search_term and len(clean_search_term) >= 2:
            matches.append({
                "dict_id": "wikipedia",
                "dict_name": "🌐 Wikipédia (En ligne)",
                "badge": "🌐 Wikipédia (Encyclopédie)",
                "title": clean_search_term,
                "search_term": clean_search_term,
                "loaded": False,
                "data": None
            })

        self.current_dict_matches = {}
        dict_names = []
        for m in matches:
            name = m.get("dict_name") or m.get("badge") or m.get("dict_id") or "Dictionnaire"
            key = name
            c = 2
            while key in self.current_dict_matches:
                key = f"{name} ({c})"
                c += 1
            self.current_dict_matches[key] = m
            dict_names.append(key)
            
        if not dict_names:
            self.selected_lex_dict_var.set("Aucun dictionnaire")
            self.lex_dict_menu.configure(values=["Aucun dictionnaire"])
            self.lbl_lex_count_badge.configure(text="0 dico")
            self.lex_textbox.configure(state="normal")
            self.lex_textbox.delete("0.0", "end")
            self.lex_textbox.insert("end", "Aucune notice de dictionnaire trouvée pour ce terme.", "body")
            self.lex_textbox.configure(state="disabled")
            self.lex_ai_btn.configure(state="disabled")
            if hasattr(self, 'lex_wiki_btn'):
                self.lex_wiki_btn.pack_forget()
            return
            
        self.lex_dict_menu.configure(values=dict_names)
        self.lbl_lex_count_badge.configure(text=f"{len(dict_names)} dico{'s' if len(dict_names) > 1 else ''}")
        
        cur_sel = self.selected_lex_dict_var.get()
        if cur_sel in dict_names:
            chosen = cur_sel
        else:
            chosen = dict_names[0]
            self.selected_lex_dict_var.set(chosen)
            
        self.render_selected_dictionary_view()

    def render_selected_dictionary_view(self):
        """Affiche instantanément uniquement la notice du dictionnaire sélectionné dans le menu déroulant."""
        self.lex_textbox.configure(state="normal")
        self.lex_textbox.delete("0.0", "end")
        
        selected_dict_name = self.selected_lex_dict_var.get()
        if not selected_dict_name or selected_dict_name not in self.current_dict_matches:
            if self.current_dict_matches:
                selected_dict_name = list(self.current_dict_matches.keys())[0]
                self.selected_lex_dict_var.set(selected_dict_name)
            else:
                self.lex_textbox.insert("end", "Aucune notice sélectionnée.", "body")
                self.lex_textbox.configure(state="disabled")
                if hasattr(self, 'lex_wiki_btn'):
                    self.lex_wiki_btn.pack_forget()
                if hasattr(self, 'lex_wiki_variant_frame'):
                    self.lex_wiki_variant_frame.pack_forget()
                if hasattr(self, 'lex_polish_frame'):
                    self.lex_polish_frame.pack_forget()
                return
                
        m = self.current_dict_matches[selected_dict_name]
        dict_id = m.get("dict_id")
        badge = m.get("badge", m.get("dict_name", "Dictionnaire"))
        title = m.get("title", "")
        
        if dict_id == "wikipedia":
            if hasattr(self, 'lex_polish_frame'):
                self.lex_polish_frame.pack_forget()
            self._render_wikipedia_entry(m)
            return

        if hasattr(self, 'lex_wiki_btn'):
            self.lex_wiki_btn.pack_forget()
        if hasattr(self, 'lex_wiki_variant_frame'):
            self.lex_wiki_variant_frame.pack_forget()
            
        self.lex_textbox.insert("end", f"{badge}\n", "source_name")
        if title and dict_id != "strong":
            self.lex_textbox.insert("end", f"{title}\n\n", "book_title")
            
        if dict_id == "strong":
            if hasattr(self, 'lex_polish_frame'):
                self.lex_polish_frame.pack_forget()
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
            if hasattr(self, 'lex_polish_frame'):
                self.lex_polish_frame.pack_forget()
            b_entries = m.get("entries", [])
            for b_art in b_entries:
                hw = b_art.get("headword", "")
                b_txt = b_art.get("full_text", "")
                if hw and not b_txt.startswith(hw):
                    self.lex_textbox.insert("end", f"• {hw}\n", "bailly_headword")
                self.lex_textbox.insert("end", f"{b_txt}\n\n", "body")
        else:
            # Dictionnaires textuels (Vigouroux, Calmet, etc.)
            if hasattr(self, 'lex_polish_frame'):
                self.lex_polish_frame.pack(fill="x", pady=(0, 3), before=self.lex_ai_btn)
                
            full_t = m.get("full_text", "")
            raw_t = m.get("raw_text") or full_t
            m["raw_text"] = raw_t
            
            # Vérifier si l'article est déjà restauré dans le cache local
            cached = DictionaryPolisher.get_polished_entry(dict_id, title or m.get("search_term") or "")
            if cached and cached.get("text"):
                c_model = cached.get("model", "Gemini")
                self.lex_textbox.insert("end", f"✨ Notice restaurée & structurée par IA ({c_model})\n\n", "polish_badge")
                self._render_dictionary_markdown(cached['text'], dict_id=dict_id)
                self.lex_polish_btn.configure(text="🔄 Re-polir avec l'IA", state="normal")
            else:
                self._render_dictionary_markdown(full_t, dict_id=dict_id)
                self.lex_polish_btn.configure(text="✨ Polir / Restructurer avec l'IA", state="normal")
            
        self.lex_textbox.configure(state="disabled")
        
        # Configurer le bouton d'analyse IA
        match_obj = getattr(self, 'current_dict_match_obj', m)
        first_title = (match_obj.get("word") if isinstance(match_obj, dict) else None) or title or selected_dict_name
        self.last_selected_strong = (m.get("entry") or m, first_title)
        self.lex_ai_btn.configure(state="normal", text=f"🤖 Analyser « {first_title} » avec l'IA")

    def on_polish_model_changed(self, choice):
        """Sauvegarde le modèle de polissage choisi."""
        self.config["dict_polish_model"] = choice
        save_config(self.config)

    def on_polish_dictionary_with_ai(self):
        """Lance la restauration philologique de l'article de dictionnaire courant."""
        selected_dict_name = self.selected_lex_dict_var.get()
        if not selected_dict_name or selected_dict_name not in self.current_dict_matches:
            return
            
        m = self.current_dict_matches[selected_dict_name]
        dict_id = m.get("dict_id", "custom")
        title = m.get("title", "")
        raw_text = m.get("raw_text") or m.get("full_text", "")
        if not raw_text:
            return
            
        model = self.lex_polish_model_var.get() or self.config.get("dict_polish_model", "gemini-2.5-flash")
        
        # Vérification préalable des clés selon le fournisseur sélectionné
        clean_m = model.lower()
        if (clean_m.startswith("mistral-") or clean_m.startswith("open-mistral-") or clean_m.startswith("codestral-")) and not self.config.get("mistral_api_key"):
            from gui.settings_modal import SettingsModal
            SettingsModal(self, self.config, on_save_callback=self._on_settings_saved)
            return
        elif ("/" in clean_m or "infomaniak" in clean_m) and not self.config.get("infomaniak_token"):
            from gui.settings_modal import SettingsModal
            SettingsModal(self, self.config, on_save_callback=self._on_settings_saved)
            return
        elif clean_m.startswith("gemini-") and not self.config.get("gemini_api_key"):
            from gui.settings_modal import SettingsModal
            SettingsModal(self, self.config, on_save_callback=self._on_settings_saved)
            return
            
        self.lex_polish_btn.configure(state="disabled", text="⏳ Polissage IA en cours...")
        threading.Thread(
            target=self._polish_dictionary_thread,
            args=(m, dict_id, title, raw_text, model),
            daemon=True
        ).start()

    def _polish_dictionary_thread(self, m, dict_id, title, raw_text, model):
        """Thread d'arrière-plan pour restaurer le texte sans bloquer l'interface."""
        ok, result = DictionaryPolisher.polish_article(raw_text, title=title, model=model, config=self.config)
        if ok:
            slug = m.get("slug") or title
            DictionaryPolisher.set_polished_entry(dict_id, title, title, result, model, slug=slug)
            m["full_text"] = result
            m["is_polished"] = True
            m["polished_model"] = model
            self.after(0, self.render_selected_dictionary_view)
        else:
            self.after(0, lambda: self._on_polish_error(result))

    def _on_polish_error(self, err_msg):
        """Affiche l'état d'erreur sur le bouton."""
        self.lex_polish_btn.configure(state="normal", text="⚠️ Échec - Réessayer")
        print(f"Erreur polissage : {err_msg}")

    def on_dictionary_cross_reference_clicked(self, target_word):
        """Ouvre directement l'article du dictionnaire lié au lien cliqué."""
        if not target_word:
            return
            
        clean_word = re.sub(r'[\d\.\(\)]+', '', target_word).strip(" \t\n\r,;:.*«»[]\"'")
        if not clean_word:
            clean_word = target_word.strip()
            
        results = DictionaryManager.lookup(clean_word)
        if results and results.get("matches"):
            self.current_dict_match_obj = results
            self.display_dictionary_entry(results)
        else:
            # Essayer avec le mot brut ou normalisé
            results = DictionaryManager.lookup(target_word.strip())
            if results and results.get("matches"):
                self.current_dict_match_obj = results
                self.display_dictionary_entry(results)

    def _render_dictionary_markdown(self, text, dict_id="custom"):
        """
        Rend le texte Markdown de manière riche dans self.lex_textbox :
        - Tous les niveaux de titres #, ##, ###, ####, #####, ###### (sans afficher les dièses)
        - Séparateurs horizontaux --- avec une ligne esthétique
        - Listes à puces avec puces stylisées et indentation multi-niveaux
        - Citations en bloc >
        - Gras et Italique inline
        - Références bibliques anciennes et modernes cliquables avec infobulle de verset
        - Mots en langues originales (hébreu, grec) cliquables avec infobulle Strong
        - Liens interactifs cliquables pour les renvois d'articles (*Voir* : **MOT**, 🔗 MOT, [[MOT]])
        """
        if not text:
            return
            
        ROMAN_NUMS = {
            'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
            'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX',
            'XXI', 'XXII', 'XXIII', 'XXIV', 'XXV', 'XXVI', 'XXVII', 'XXVIII', 'XXIX', 'XXX'
        }
        
        RE_HEADER = re.compile(r'^(#{1,6})\s+(.+)$')
        RE_HR = re.compile(r'^[-*_]{3,}\s*$')
        RE_BULLET = re.compile(r'^(\s*)[-*•]\s+(.+)$')
        RE_ORDERED = re.compile(r'^(\s*)([0-9]+\.|\([0-9]+\)|[a-z]\))\s+(.+)$')
        RE_QUOTE = re.compile(r'^>\s*(.+)$')
        
        lines = text.strip().splitlines()
        in_voir_section = False
        
        for raw_line in lines:
            line_s = raw_line.strip()
            if not line_s:
                self.lex_textbox.insert("end", "\n")
                continue
                
            # Détecter si on entre ou sort d'une section de renvois ("Voir :" ou "Voir aussi :")
            if re.match(r'^(?:Voir(?:\s+aussi)?)\s*:\s*$', line_s, re.IGNORECASE):
                in_voir_section = True
            elif line_s.startswith('---') or line_s.startswith('#'):
                in_voir_section = False
                
            # Séparateur horizontal
            if RE_HR.match(line_s):
                self.lex_textbox.insert("end", "────────────────────────────────────────\n\n", "lex_hr")
                continue
                
            # Titres tous niveaux (H1 à H6)
            m_h = RE_HEADER.match(line_s)
            if m_h:
                level = len(m_h.group(1))
                content = m_h.group(2).strip()
                tag_name = f"lex_h{min(level, 6)}"
                self._insert_markdown_spans(content, base_tag=tag_name, ROMAN_NUMS=ROMAN_NUMS, in_voir_section=False)
                self.lex_textbox.insert("end", "\n\n")
                continue
                
            # Citations en bloc (> texte)
            m_q = RE_QUOTE.match(line_s)
            if m_q:
                content = m_q.group(1).strip()
                self.lex_textbox.insert("end", "│ ", "lex_quote_bar")
                self._insert_markdown_spans(content, base_tag="lex_quote", ROMAN_NUMS=ROMAN_NUMS, in_voir_section=False)
                self.lex_textbox.insert("end", "\n\n")
                continue
                
            # Puce de liste avec détection du niveau d'indentation
            m_bul = RE_BULLET.match(raw_line)
            if m_bul:
                indent = len(m_bul.group(1))
                content = m_bul.group(2).strip()
                if indent >= 4:
                    bullet_prefix = "      ◦  "
                    list_tag = "lex_sub_sub_list_item"
                elif indent >= 2:
                    bullet_prefix = "    •  "
                    list_tag = "lex_sub_list_item"
                else:
                    bullet_prefix = "  •  "
                    list_tag = "lex_list_item"
                    
                self.lex_textbox.insert("end", bullet_prefix, "lex_bullet_dot")
                self._insert_markdown_spans(content, base_tag=list_tag, ROMAN_NUMS=ROMAN_NUMS, in_voir_section=in_voir_section)
                self.lex_textbox.insert("end", "\n")
                continue
                
            # Numéro ordonné (1. ou a))
            m_ord = RE_ORDERED.match(raw_line)
            if m_ord:
                indent = len(m_ord.group(1))
                lead = m_ord.group(2).strip()
                content = m_ord.group(3).strip()
                lead_prefix = f"{' ' * indent}  {lead} "
                list_tag = "lex_sub_list_item" if indent >= 2 else "lex_list_item"
                self.lex_textbox.insert("end", lead_prefix, "lex_lead_num")
                self._insert_markdown_spans(content, base_tag=list_tag, ROMAN_NUMS=ROMAN_NUMS, in_voir_section=in_voir_section)
                self.lex_textbox.insert("end", "\n")
                continue
                
            # Paragraphe standard
            self._insert_markdown_spans(line_s, base_tag="body", ROMAN_NUMS=ROMAN_NUMS, in_voir_section=in_voir_section)
            self.lex_textbox.insert("end", "\n\n")

    def _insert_markdown_spans(self, line_text, base_tag="body", ROMAN_NUMS=None, in_voir_section=False):
        """Parse les éléments inline (gras, italique, versets bibliques, langues originales, renvois) et les insère dans lex_textbox."""
        if not line_text:
            return
            
        if ROMAN_NUMS is None:
            ROMAN_NUMS = set()
            
        ANCIENT_BOOK_ALIASES = {
            "gen": "Gen", "genese": "Gen", "ge": "Gen", "gn": "Gen",
            "exod": "Exo", "exode": "Exo", "ex": "Exo",
            "lev": "Lev", "levitique": "Lev", "lv": "Lev",
            "num": "Num", "nombres": "Num", "nb": "Num",
            "deut": "Deu", "deuteronome": "Deu", "dt": "Deu",
            "jos": "Jos", "josue": "Jos",
            "jug": "Jdg", "juges": "Jdg", "jg": "Jdg",
            "ruth": "Rut", "rt": "Rut",
            "i sam": "1Sa", "ii sam": "2Sa", "1 sam": "1Sa", "2 sam": "2Sa", "1s": "1Sa", "2s": "2Sa",
            "i reg": "1Sa", "ii reg": "2Sa", "iii reg": "1Ki", "iv reg": "2Ki", "1 reg": "1Sa", "2 reg": "2Sa", "3 reg": "1Ki", "4 reg": "2Ki",
            "i rois": "1Ki", "ii rois": "2Ki", "1 rois": "1Ki", "2 rois": "2Ki", "1r": "1Ki", "2r": "2Ki",
            "i par": "1Ch", "ii par": "2Ch", "1 par": "1Ch", "2 par": "2Ch", "1 ch": "1Ch", "2 ch": "2Ch", "1ch": "1Ch", "2ch": "2Ch",
            "esd": "Ezr", "esdras": "Ezr",
            "neh": "Neh", "nehemie": "Neh",
            "esth": "Est", "esther": "Est",
            "job": "Job", "jb": "Job",
            "ps": "Psa", "psa": "Psa", "psaumes": "Psa", "psaume": "Psa", "pss": "Psa",
            "prov": "Pro", "proverbes": "Pro", "pr": "Pro",
            "eccl": "Ecc", "ecclesiaste": "Ecc", "ec": "Ecc", "ecc": "Ecc",
            "cant": "Sol", "cantique": "Sol", "ct": "Sol",
            "is": "Isa", "isa": "Isa", "esaie": "Isa", "isaie": "Isa", "es": "Isa",
            "jer": "Jer", "jeremie": "Jer", "jr": "Jer",
            "lam": "Lam", "lamentations": "Lam",
            "ezech": "Eze", "eze": "Eze", "ezechiel": "Eze", "ez": "Eze",
            "dan": "Dan", "daniel": "Dan", "da": "Dan",
            "os": "Hos", "osee": "Hos",
            "joel": "Joe", "jl": "Joe",
            "am": "Amo", "amos": "Amo",
            "abd": "Oba", "abdias": "Oba",
            "jon": "Jon", "jonas": "Jon",
            "mich": "Mic", "michee": "Mic", "mi": "Mic",
            "nah": "Nah", "nahum": "Nah", "na": "Nah",
            "hab": "Hab", "habacuc": "Hab", "ha": "Hab",
            "soph": "Zep", "sophonie": "Zep", "so": "Zep",
            "agg": "Hag", "aggee": "Hag", "ag": "Hag",
            "zach": "Zec", "zacharie": "Zec", "za": "Zec",
            "mal": "Mal", "malachie": "Mal", "ml": "Mal",
            "matth": "Mat", "matt": "Mat", "mat": "Mat", "matthieu": "Mat", "mt": "Mat",
            "marc": "Mar", "mar": "Mar", "mc": "Mar",
            "luc": "Luk", "lc": "Luk",
            "jean": "Joh", "jn": "Joh",
            "act": "Act", "actes": "Act", "ac": "Act",
            "rom": "Rom", "romains": "Rom", "ro": "Rom", "rm": "Rom",
            "i cor": "1Co", "ii cor": "2Co", "1 cor": "1Co", "2 cor": "2Co", "1co": "1Co", "2co": "2Co",
            "gal": "Gal", "galates": "Gal", "ga": "Gal",
            "eph": "Eph", "ephesiens": "Eph", "ep": "Eph",
            "phil": "Phi", "philippiens": "Phi", "php": "Phi",
            "col": "Col", "colossiens": "Col",
            "i thes": "1Th", "ii thes": "2Th", "1 thes": "1Th", "2 thes": "2Th", "1th": "1Th", "2th": "2Th",
            "i tim": "1Ti", "ii tim": "2Ti", "1 tim": "1Ti", "2 tim": "2Ti", "1ti": "1Ti", "2ti": "2Ti",
            "tit": "Tit", "tite": "Tit",
            "philm": "Phm", "philemon": "Phm", "phm": "Phm",
            "heb": "Heb", "hebreux": "Heb", "he": "Heb",
            "jacq": "Jam", "jacques": "Jam", "ja": "Jam", "jas": "Jam",
            "i pierre": "1Pe", "ii pierre": "2Pe", "1 pierre": "1Pe", "2 pierre": "2Pe", "1pe": "1Pe", "2pe": "2Pe", "1p": "1Pe", "2p": "2Pe",
            "i jean": "1Jo", "ii jean": "2Jo", "iii jean": "3Jo", "1 jean": "1Jo", "2 jean": "2Jo", "3 jean": "3Jo", "1jo": "1Jo", "2jo": "2Jo", "3jo": "3Jo",
            "jud": "Jud", "jude": "Jud", "jd": "Jud",
            "apoc": "Rev", "apocalypse": "Rev", "rev": "Rev", "apo": "Rev",
            "tob": "Tob", "tobie": "Tob", "tb": "Tob",
            "judith": "Jdt", "jdt": "Jdt",
            "sagesse": "Wis", "sap": "Wis", "wis": "Wis",
            "sir": "Sir", "ecclesiastique": "Sir", "si": "Sir",
            "bar": "Bar", "baruch": "Bar", "ba": "Bar",
            "i mac": "1Ma", "ii mac": "2Ma", "1 mac": "1Ma", "2 mac": "2Ma"
        }
        
        ROMAN_NUMS_EXT = {
            'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5, 'VI': 6, 'VII': 7, 'VIII': 8, 'IX': 9, 'X': 10,
            'XI': 11, 'XII': 12, 'XIII': 13, 'XIV': 14, 'XV': 15, 'XVI': 16, 'XVII': 17, 'XVIII': 18, 'XIX': 19, 'XX': 20,
            'XXI': 21, 'XXII': 22, 'XXIII': 23, 'XXIV': 24, 'XXV': 25, 'XXVI': 26, 'XXVII': 27, 'XXVIII': 28, 'XXIX': 29, 'XXX': 30,
            'XXXI': 31, 'XXXII': 32, 'XXXIII': 33, 'XXXIV': 34, 'XXXV': 35, 'XXXVI': 36, 'XXXVII': 37, 'XXXVIII': 38, 'XXXIX': 39, 'XL': 40,
            'XLI': 41, 'XLII': 42, 'XLIII': 43, 'XLIV': 44, 'XLV': 45, 'XLVI': 46, 'XLVII': 47, 'XLVIII': 48, 'XLIX': 49, 'L': 50,
            'LI': 51, 'LII': 52, 'LIII': 53, 'LIV': 54, 'LV': 55, 'LVI': 56, 'LVII': 57, 'LVIII': 58, 'LIX': 59, 'LX': 60,
            'LXI': 61, 'LXII': 62, 'LXIII': 63, 'LXIV': 64, 'LXV': 65, 'LXVI': 66, 'LXVII': 67, 'LXVIII': 68, 'LXIX': 69, 'LXX': 70,
            'LXXI': 71, 'LXXII': 72, 'LXXIII': 73, 'LXXIV': 74, 'LXXV': 75, 'LXXVI': 76, 'LXXVII': 77, 'LXXVIII': 78, 'LXXIX': 79, 'LXXX': 80,
            'LXXXI': 81, 'LXXXII': 82, 'LXXXIII': 83, 'LXXXIV': 84, 'LXXXV': 85, 'LXXXVI': 86, 'LXXXVII': 87, 'LXXXVIII': 88, 'LXXXIX': 89, 'XC': 90,
            'XCI': 91, 'XCII': 92, 'XCIII': 93, 'XCIV': 94, 'XCV': 95, 'XCVI': 96, 'XCVII': 97, 'XCVIII': 98, 'XCIX': 99, 'C': 100,
            'CI': 101, 'CII': 102, 'CIII': 103, 'CIV': 104, 'CV': 105, 'CVI': 106, 'CVII': 107, 'CVIII': 108, 'CIX': 109, 'CX': 110,
            'CXI': 111, 'CXII': 112, 'CXIII': 113, 'CXIV': 114, 'CXV': 115, 'CXVI': 116, 'CXVII': 117, 'CXVIII': 118, 'CXIX': 119, 'CXX': 120,
            'CXXI': 121, 'CXXII': 122, 'CXXIII': 123, 'CXXIV': 124, 'CXXV': 125, 'CXXVI': 126, 'CXXVII': 127, 'CXXVIII': 128, 'CXXIX': 129, 'CXXX': 130,
            'CXXXI': 131, 'CXXXII': 132, 'CXXXIII': 133, 'CXXXIV': 134, 'CXXXV': 135, 'CXXXVI': 136, 'CXXXVII': 137, 'CXXXVIII': 138, 'CXXXIX': 139, 'CXL': 140,
            'CXLI': 141, 'CXLII': 142, 'CXLIII': 143, 'CXLIV': 144, 'CXLV': 145, 'CXLVI': 146, 'CXLVII': 147, 'CXLVIII': 148, 'CXLIX': 149, 'CL': 150
        }
        
        def parse_chap(s):
            if not s: return None
            s = s.strip()
            if s.isdigit(): return int(s)
            return ROMAN_NUMS_EXT.get(s.upper())

        tokens = []
        
        # 0. Liens préfixés par emoji 🔗 (ex: 🔗 PHÉNICIENS, 🔗 SCARABÉE)
        for m in re.finditer(r'🔗\s*([A-ZÉÈÊËÀÂÄÎÏÔÖÙÛÜÇ\s–-]+(?:\s*\([^)]*\))?)', line_text):
            raw_w = m.group(1).strip()
            clean_w = re.sub(r'[\(\[\{].*?[\)\]\}]', '', raw_w).strip()
            if len(clean_w) >= 2:
                tokens.append((m.start(), m.end(), 'DICT_LINK', raw_w, clean_w))
        
        # 1. [[WORD]] ou [[WORD|LABEL]]
        for m in re.finditer(r'\[\[([^\]|]+)(?:\|([^\]]+))?\]\]', line_text):
            target = m.group(1).strip()
            label = (m.group(2) or target).strip()
            tokens.append((m.start(), m.end(), 'DICT_LINK', label, target))
            
        # 2. *Voir* : **WORD** ou Voir : WORD ou *Voir aussi* : ...
        for m in re.finditer(r'(\*+Voir(?:\s+aussi)?\*+|Voir(?:\s+aussi)?)\s*:\s*([^\n]+)', line_text, re.IGNORECASE):
            tail_str = m.group(2)
            tail_start = m.start(2)
            for wm in re.finditer(r'\*\*([^*]+)\*\*|([A-ZÉÈÊËÀÂÄÎÏÔÖÙÛÜÇ]{2,}(?:\s+[A-ZÉÈÊËÀÂÄÎÏÔÖÙÛÜÇ]{2,})*)', tail_str):
                target = (wm.group(1) or wm.group(2)).strip()
                if target.upper() in ROMAN_NUMS or target.upper() in {'COL', 'PAGE', 'P', 'T', 'ED', 'EDIT'}:
                    continue
                if len(target) >= 2:
                    w_start = tail_start + wm.start()
                    w_end = tail_start + wm.end()
                    tokens.append((w_start, w_end, 'DICT_LINK', target, target))

        # 3. "Voir PARADIS TERRESTRE" (mots majuscules après Voir)
        for m in re.finditer(r'\bVoir\s+([A-ZÉÈÊËÀÂÄÎÏÔÖÙÛÜÇ]{2,}(?:\s+[A-ZÉÈÊËÀÂÄÎÏÔÖÙÛÜÇ]{2,})*(?:\s+[0-9]+)?)', line_text):
            target = m.group(1).strip()
            if target.upper() in ROMAN_NUMS or target.lower().startswith('t.') or target.lower().startswith('col.'):
                continue
            if len(target) >= 2:
                tokens.append((m.start(1), m.end(1), 'DICT_LINK', target, target))

        # 4. Liste directe dans section Voir (ex: • COLONNE DE NUÉE)
        if in_voir_section:
            clean_l = line_text.strip()
            if re.match(r'^[A-ZÉÈÊËÀÂÄÎÏÔÖÙÛÜÇ\s–-]{2,}$', clean_l):
                tokens.append((0, len(line_text), 'DICT_LINK', clean_l, clean_l))

        # 5. Références bibliques anciennes & romaines (ex: Gen., I, 2 ; *Gen.*, I, 1 ; II Cor., VI, 14 ; Ps. CIV (CIII), 20)
        RE_ANCIENT_BIBLE = re.compile(
            r'(?:\*+)?\b((?:I{1,3}|IV|[1-4])\s*[A-Za-zÉÈÊËÀÂÄÎÏÔÖÙÛÜÇéèêëàâäîïôöùûüç]+|[A-Za-zÉÈÊËÀÂÄÎÏÔÖÙÛÜÇéèêëàâäîïôöùûüç]+)\.?(?:\*+)?\s*[,:]?\s*([IVXLCDM0-9]+)(?:\s*\([A-Z0-9]+\))?\s*[,:]\s*([0-9]+(?:\s*[\-–]\s*[0-9]+)?)',
            re.IGNORECASE
        )
        for m in RE_ANCIENT_BIBLE.finditer(line_text):
            b_clean = strip_accents(m.group(1).strip()).rstrip('.')
            code = ANCIENT_BOOK_ALIASES.get(b_clean) or BOOK_MAPPING.get(b_clean)
            ch_num = parse_chap(m.group(2).strip())
            if code and ch_num:
                v_clean = m.group(3).strip().replace('–', '-').replace(' ', '') if m.group(3) else None
                tokens.append((m.start(), m.end(), 'BIBLE_REF', m.group(0), {
                    "book_code": code,
                    "book_name": REVERSE_BOOK_MAPPING.get(code, code),
                    "chapter": ch_num,
                    "verse": v_clean
                }))

        # 6. Mots en langues originales (Hébreu et Grec) reliés au Lexique Strong
        for m in re.finditer(r'[\u0590-\u05FF]{2,}', line_text):
            raw_h = m.group(0)
            entry = StrongLexicon.find_by_original_word(raw_h)
            if entry:
                tokens.append((m.start(), m.end(), 'ORIG_WORD', raw_h, {
                    "code": entry.get("code"),
                    "lang": "hebrew",
                    "lemma": entry.get("lemma"),
                    "definition": entry.get("definition")
                }))

        for m in re.finditer(r'[\u0370-\u03FF\u1F00-\u1FFF]{2,}', line_text):
            raw_g = m.group(0)
            entry = StrongLexicon.find_by_original_word(raw_g)
            if entry:
                tokens.append((m.start(), m.end(), 'ORIG_WORD', raw_g, {
                    "code": entry.get("code"),
                    "lang": "greek",
                    "lemma": entry.get("lemma"),
                    "definition": entry.get("definition")
                }))

        # 7. Gras **texte**
        for m in re.finditer(r'\*\*([^*]+)\*\*', line_text):
            tokens.append((m.start(), m.end(), 'BOLD', m.group(1), None))
            
        # 8. Italique *texte*
        for m in re.finditer(r'(?<!\*)\*([^*]+)\*(?!\*)', line_text):
            tokens.append((m.start(), m.end(), 'ITALIC', m.group(1), None))

        tokens.sort(key=lambda x: (x[0], -(x[1] - x[0])))
        
        clean_tokens = []
        last_end = 0
        for tok in tokens:
            start, end, t_type, content, extra = tok
            if start >= last_end:
                clean_tokens.append(tok)
                last_end = end
                
        curr = 0
        if not hasattr(self, '_link_counter'):
            self._link_counter = 0
            
        for tok in clean_tokens:
            start, end, t_type, content, extra = tok
            if start > curr:
                self.lex_textbox.insert("end", line_text[curr:start], base_tag)
                
            if t_type == 'DICT_LINK':
                self._link_counter += 1
                unique_tag = f"dict_link_{self._link_counter}"
                link_text = f"🔗 {content}"
                self.lex_textbox.insert("end", link_text, (unique_tag, "lex_dict_link_base"))
                target_word = extra or content
                self.lex_textbox._textbox.tag_bind(unique_tag, "<Button-1>", lambda e, w=target_word: self.on_dictionary_cross_reference_clicked(w))
                self.lex_textbox._textbox.tag_bind(unique_tag, "<Enter>", lambda e: self.lex_textbox._textbox.config(cursor="hand2"))
                self.lex_textbox._textbox.tag_bind(unique_tag, "<Leave>", lambda e: self.lex_textbox._textbox.config(cursor=""))
            elif t_type == 'BIBLE_REF':
                self._link_counter += 1
                b_code = extra["book_code"]
                ch = extra["chapter"]
                v_val = extra["verse"] or "0"
                v_num = int(v_val.split("-")[0]) if v_val and v_val.split("-")[0].isdigit() else (int(v_val) if v_val and v_val.isdigit() else None)
                unique_tag = f"bref_{self._link_counter}_{b_code}_{ch}_{v_val}"
                self.lex_textbox.insert("end", content, (base_tag, "bible_ref_link", unique_tag))
                
                fr_book = extra.get("book_name", b_code)
                self.lex_textbox._textbox.tag_bind(unique_tag, "<Button-1>", lambda e, bk=fr_book, c=ch, vn=v_num: self._on_click_bref(bk, c, vn))
                self.lex_textbox._textbox.tag_bind(unique_tag, "<Enter>", lambda e, bc=b_code, c=ch, v=v_val, tg=unique_tag: self._on_hover_bref(e, bc, c, v, tg))
                self.lex_textbox._textbox.tag_bind(unique_tag, "<Leave>", lambda e: self._on_leave_tooltip(e))
            elif t_type == 'ORIG_WORD':
                self._link_counter += 1
                code = extra.get("code", "HEB")
                lang_tag = "lex_orig_word_hebrew" if extra.get("lang") == "hebrew" else "lex_orig_word_greek"
                unique_tag = f"orig_{self._link_counter}_{code}"
                self.lex_textbox.insert("end", content, (base_tag, lang_tag, unique_tag))
                
                self.lex_textbox._textbox.tag_bind(unique_tag, "<Button-1>", lambda e, cd=code, lem=content: self._on_click_orig_word(cd, lem))
                self.lex_textbox._textbox.tag_bind(unique_tag, "<Enter>", lambda e, ext=extra, tg=unique_tag: self._on_hover_orig_word(e, ext, tg))
                self.lex_textbox._textbox.tag_bind(unique_tag, "<Leave>", lambda e: self._on_leave_tooltip(e))
            elif t_type == 'BOLD':
                bold_tag = "lex_h1_bold" if "h1" in base_tag else ("lex_h2_bold" if "h2" in base_tag else ("lex_h3_bold" if "h3" in base_tag else "lex_bold"))
                self.lex_textbox.insert("end", content, (bold_tag, base_tag))
            elif t_type == 'ITALIC':
                self.lex_textbox.insert("end", content, ("lex_italic", base_tag))
            else:
                self.lex_textbox.insert("end", content, base_tag)
                
            curr = end
            
        if curr < len(line_text):
            self.lex_textbox.insert("end", line_text[curr:], base_tag)

    def _on_hover_bref(self, event, b_code, ch, v_str, tag_name):
        """Affiche le verset biblique au survol dans le lexique."""
        try:
            self.lex_textbox._textbox.config(cursor="hand2")
            if getattr(self, '_hover_lex_ref', None) == tag_name and getattr(self.tooltip, 'tw', None):
                return
            self._hover_lex_ref = tag_name
            
            ref_bible = self.config.get("reference_bible", "Segond 21")
            from core.bible_reference_detector import get_bible_passage_preview
            ref_title, preview_txt = get_bible_passage_preview(ref_bible, b_code, ch, v_str if v_str != "0" else None)
            
            x = self.lex_textbox._textbox.winfo_rootx() + event.x + 10
            y = self.lex_textbox._textbox.winfo_rooty() + event.y + 10
            
            tooltip_data = {
                "word": tag_name,
                "source": f"📖 {ref_bible}",
                "title": ref_title,
                "preview": preview_txt,
                "hint": "🖱️ Cliquer pour ouvrir ce passage dans la Bible"
            }
            self.tooltip.show(x, y, tooltip_data)
        except Exception:
            pass

    def _on_click_bref(self, fr_book, ch, v_num):
        """Navigue directement vers le verset cliqué."""
        try:
            if self.tooltip:
                self.tooltip.hide()
            self._hover_lex_ref = None
            if self.main_tabs.get() != "📖 Lecture":
                self.main_tabs.set("📖 Lecture")
            self.apply_book_selection(fr_book, chapter=ch, verse=v_num)
        except Exception as e:
            print(f"Erreur navigation verset lexique : {e}")

    def _on_hover_orig_word(self, event, extra, tag_name):
        """Affiche l'infobulle Strong / Bailly au survol d'un mot en langue originale."""
        try:
            self.lex_textbox._textbox.config(cursor="hand2")
            if getattr(self, '_hover_lex_orig', None) == tag_name and getattr(self.tooltip, 'tw', None):
                return
            self._hover_lex_orig = tag_name
            
            code = extra.get("code", "")
            lemma = extra.get("lemma", "")
            definition = extra.get("definition", "")
            lang_name = "Hébreu" if extra.get("lang") == "hebrew" else "Grec"
            
            if code and code not in {"HEB", "GRK"}:
                ent = StrongLexicon.get(code)
                if ent:
                    lemma = ent.get("lemma", lemma)
                    definition = ent.get("definition", definition)
                    
            x = self.lex_textbox._textbox.winfo_rootx() + event.x + 10
            y = self.lex_textbox._textbox.winfo_rooty() + event.y + 10
            
            title_txt = f"[{code}] {lemma}" if code and code not in {"HEB", "GRK"} else lemma
            tooltip_data = {
                "word": tag_name,
                "source": f"📖 Lexique Strong ({lang_name})",
                "title": title_txt,
                "preview": definition,
                "hint": "🖱️ Cliquer pour ouvrir la fiche complète dans le Lexique"
            }
            self.tooltip.show(x, y, tooltip_data)
        except Exception:
            pass

    def _on_click_orig_word(self, code, lemma):
        """Ouvre la fiche Strong ou lexicale au clic sur un mot en langue originale."""
        try:
            if self.tooltip:
                self.tooltip.hide()
            self._hover_lex_orig = None
            
            query = code if code and code not in {"HEB", "GRK"} else lemma
            results = DictionaryManager.lookup(query)
            if results and results.get("matches"):
                self.current_dict_match_obj = results
                self.display_dictionary_entry(results)
            else:
                results = DictionaryManager.lookup(lemma)
                if results and results.get("matches"):
                    self.current_dict_match_obj = results
                    self.display_dictionary_entry(results)
        except Exception as e:
            print(f"Erreur consultation mot original lexique : {e}")

    def _on_leave_tooltip(self, event):
        """Masque l'infobulle et réinitialise le curseur."""
        try:
            self._hover_lex_ref = None
            self._hover_lex_orig = None
            self.lex_textbox._textbox.config(cursor="")
            if self.tooltip:
                self.tooltip.hide()
        except Exception:
            pass

    def _render_wikipedia_entry(self, m):
        """Rend l'article Wikipédia sélectionné, en le chargeant en arrière-plan si nécessaire."""
        search_term = m.get("search_term") or m.get("title", "")
        exact_title = m.get("exact_title")
        self.lex_textbox.insert("end", "🌐 WIKIPÉDIA (ENCYCLOPÉDIE EN LIGNE)\n", "wiki_header")
        
        if not m.get("loaded"):
            display_title = exact_title or search_term
            self.lex_textbox.insert("end", f"{display_title}\n\n", "book_title")
            self.lex_textbox.insert("end", "⏳ Recherche de l'article sur Wikipédia en ligne...\n", "wiki_loading")
            self.lex_textbox.configure(state="disabled")
            if hasattr(self, 'lex_wiki_btn'):
                self.lex_wiki_btn.pack_forget()
            if hasattr(self, 'lex_wiki_variant_frame'):
                self.lex_wiki_variant_frame.pack_forget()
            
            # Lancement asynchrone non bloquant
            threading.Thread(target=self._fetch_wikipedia_thread, args=(m,), daemon=True).start()
            return
            
        data = m.get("data") or {}
        if data.get("found"):
            page_title = data.get("title", exact_title or search_term)
            desc = data.get("description", "")
            extract = data.get("extract", "")
            url = data.get("url", "")
            self.current_wiki_url = url
            candidates = data.get("candidates", [])
            
            self.lex_textbox.insert("end", f"{page_title}\n", "book_title")
            if desc:
                self.lex_textbox.insert("end", f"{desc}\n\n", "wiki_desc")
            else:
                self.lex_textbox.insert("end", "\n", "body")
                
            self.lex_textbox.insert("end", f"{extract}\n\n", "body")
            
            if url:
                self.lex_textbox.insert("end", "🔗 Ouvrir cet article complet sur fr.wikipedia.org ↗\n\n", "wiki_link")
                
            # Section d'homonymes / variantes d'articles si disponibles
            if candidates:
                self.lex_textbox.insert("end", "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n", "wiki_sep")
                self.lex_textbox.insert("end", "🔀 Autres articles correspondants (Homonymes) :\n\n", "wiki_header")
                
                # Nettoyer les anciens binds dynamiques
                for tag in self.lex_textbox._textbox.tag_names():
                    if tag.startswith("wiki_cand_"):
                        self.lex_textbox._textbox.tag_delete(tag)
                        
                for i, cand in enumerate(candidates[:6]):
                    c_title = cand.get("title", "")
                    c_snip = cand.get("snippet", "").strip()
                    tag_name = f"wiki_cand_{i}"
                    
                    self.lex_textbox.insert("end", f"👉 {c_title}\n", tag_name)
                    if c_snip:
                        self.lex_textbox.insert("end", f"   {c_snip}\n\n", "wiki_cand_snippet")
                    else:
                        self.lex_textbox.insert("end", "\n", "body")
                        
                    self.lex_textbox._textbox.tag_configure(
                        tag_name, 
                        font=(self.font_family, self.font_size, "bold"), 
                        foreground="#38BDF8" if (ctk.get_appearance_mode() == "Dark") else "#0284C7", 
                        underline=True
                    )
                    self.lex_textbox._textbox.tag_bind(tag_name, "<Button-1>", lambda e, ct=c_title: self.on_switch_wikipedia_candidate(m, ct))
                    self.lex_textbox._textbox.tag_bind(tag_name, "<Enter>", lambda e: self.lex_textbox._textbox.config(cursor="hand2"))
                    self.lex_textbox._textbox.tag_bind(tag_name, "<Leave>", lambda e: self.lex_textbox._textbox.config(cursor=""))
                    
            self.lex_textbox.configure(state="disabled")
            
            # Afficher la barre de boutons d'action
            if hasattr(self, 'lex_wiki_btn'):
                self.lex_wiki_btn.pack(fill="x", pady=(4, 0))
                btn_lbl = f"🌐 Ouvrir « {page_title} » sur Wikipédia ↗"
                if len(btn_lbl) > 40:
                    btn_lbl = "🌐 Ouvrir l'article Wikipédia ↗"
                self.lex_wiki_btn.configure(state="normal", text=btn_lbl)
                
            if hasattr(self, 'lex_wiki_variant_frame'):
                if candidates:
                    var_values = [page_title] + [c["title"] for c in candidates[:6]]
                    self.lex_wiki_variant_var.set(page_title)
                    self.lex_wiki_variant_menu.configure(values=var_values)
                    self.lex_wiki_variant_frame.pack(fill="x", pady=(4, 0))
                else:
                    self.lex_wiki_variant_frame.pack_forget()
        else:
            self.lex_textbox.insert("end", f"{search_term}\n\n", "book_title")
            err = data.get("error") or f"Aucun article trouvé sur Wikipédia pour « {search_term} »."
            self.lex_textbox.insert("end", f"{err}\n\n", "body")
            
            candidates = data.get("candidates", [])
            if candidates:
                self.lex_textbox.insert("end", "Suggestions d'articles proches :\n\n", "wiki_header")
                for i, cand in enumerate(candidates[:6]):
                    c_title = cand.get("title", "")
                    tag_name = f"wiki_cand_{i}"
                    self.lex_textbox.insert("end", f"👉 {c_title}\n\n", tag_name)
                    self.lex_textbox._textbox.tag_configure(
                        tag_name, 
                        font=(self.font_family, self.font_size, "bold"), 
                        foreground="#38BDF8" if (ctk.get_appearance_mode() == "Dark") else "#0284C7", 
                        underline=True
                    )
                    self.lex_textbox._textbox.tag_bind(tag_name, "<Button-1>", lambda e, ct=c_title: self.on_switch_wikipedia_candidate(m, ct))
                    self.lex_textbox._textbox.tag_bind(tag_name, "<Enter>", lambda e: self.lex_textbox._textbox.config(cursor="hand2"))
                    self.lex_textbox._textbox.tag_bind(tag_name, "<Leave>", lambda e: self.lex_textbox._textbox.config(cursor=""))
            else:
                self.lex_textbox.insert("end", "💡 Conseil : Vous pouvez vérifier l'orthographe ou utiliser le bouton « Autre mot ».\n", "lex_details")
                
            self.lex_textbox.configure(state="disabled")
            if hasattr(self, 'lex_wiki_btn'):
                self.lex_wiki_btn.pack_forget()
            if hasattr(self, 'lex_wiki_variant_frame'):
                self.lex_wiki_variant_frame.pack_forget()
                
        # Configurer le bouton d'analyse IA
        first_title = (data.get("title") if data.get("found") else None) or search_term
        self.last_selected_strong = (m, first_title)
        self.lex_ai_btn.configure(state="normal", text=f"🤖 Analyser « {first_title} » avec l'IA")

    def _fetch_wikipedia_thread(self, m):
        """Thread travailleur pour interroger Wikipédia sans ralentir l'UI."""
        try:
            term = m.get("search_term") or m.get("title", "")
            exact = m.get("exact_title")
            res = WikipediaClient.get_summary(term, exact_title=exact)
            m["data"] = res
            m["loaded"] = True
        except Exception as e:
            m["data"] = {"found": False, "error": f"Erreur : {e}"}
            m["loaded"] = True
            
        self.after(0, lambda: self._on_wikipedia_loaded(m))

    def _on_wikipedia_loaded(self, m):
        """Callback UI après le chargement des données Wikipédia."""
        current_selection = self.selected_lex_dict_var.get()
        if current_selection in self.current_dict_matches and self.current_dict_matches[current_selection] is m:
            self.render_selected_dictionary_view()

    def on_switch_wikipedia_candidate(self, m, chosen_title):
        """Bascule immédiatement l'affichage vers un autre article Wikipédia candidat."""
        if not chosen_title or chosen_title == m.get("data", {}).get("title"):
            return
        m["exact_title"] = chosen_title
        m["loaded"] = False
        m["data"] = None
        self.render_selected_dictionary_view()

    def on_wiki_variant_selected(self, choice):
        """Appelé lors de la sélection d'une variante d'article dans le menu déroulant."""
        selected_dict_name = self.selected_lex_dict_var.get()
        if selected_dict_name in self.current_dict_matches:
            m = self.current_dict_matches[selected_dict_name]
            self.on_switch_wikipedia_candidate(m, choice)

    def on_search_custom_wikipedia(self):
        """Ouvre un dialogue rapide pour rechercher n'importe quel terme sur Wikipédia."""
        dialog = ctk.CTkInputDialog(text="Entrez le mot ou sujet à chercher sur Wikipédia :", title="Recherche Wikipédia")
        val = dialog.get_input()
        if val and val.strip():
            clean_v = val.strip()
            match_data = {"word": clean_v, "title": clean_v}
            self.display_dictionary_entry(match_data)
            wiki_key = None
            for k in self.current_dict_matches:
                if self.current_dict_matches[k].get("dict_id") == "wikipedia":
                    wiki_key = k
                    break
            if wiki_key:
                self.selected_lex_dict_var.set(wiki_key)
                self.render_selected_dictionary_view()

    def on_open_wikipedia_web(self):
        """Ouvre l'URL de l'article Wikipédia courant dans le navigateur par défaut."""
        url = getattr(self, 'current_wiki_url', None)
        if url:
            try:
                webbrowser.open(url)
            except Exception as e:
                print(f"Erreur ouverture navigateur Wikipédia : {e}")

    def on_strong_clicked(self, strong_codes_str, clicked_word=None):
        """Affiche la fiche lexicale complète Strong et les dictionnaires associés dans l'onglet dédié à droite."""
        entries = StrongLexicon.get_multiple(strong_codes_str)
        if not entries:
            return
            
        first_entry = entries[0]
        code = first_entry.get("short_code", first_entry.get("code", ""))
        lookup_res = DictionaryManager.lookup(clicked_word, code) if (clicked_word or code) else None
        if lookup_res:
            self.display_dictionary_entry(lookup_res)
        else:
            match = {
                "word": clicked_word,
                "title": clicked_word or first_entry.get("lemma", ""),
                "strong": first_entry
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

    def sync_original_tab_to_verse(self, chapter, verse):
        """Met à jour le contenu de l'onglet Langues Originales pour le verset actif."""
        ch = int(chapter) if str(chapter).isdigit() else 1
        v = int(verse) if str(verse).isdigit() and str(verse) != "0" else 1
        if hasattr(self, 'lbl_orig_verse_badge'):
            self.lbl_orig_verse_badge.configure(text=f"V. {v}")
        self.render_original_languages_view()

    def render_original_languages_view(self):
        """Rend le texte original (Hébreu/Grec) avec balises interactives et décomposition exégétique."""
        if not hasattr(self, 'orig_textbox'):
            return
            
        cur_book = self.loaded_french_book or self.current_valid_book or self.book_var.get()
        if not cur_book:
            return
            
        from core.reference_parser import get_standard_book_code
        from core.original_languages_manager import OriginalLanguagesManager
        
        b_code = get_standard_book_code(cur_book)
        ch = getattr(self, 'current_active_chapter', 1)
        v = getattr(self, 'current_active_verse', 1)
        if v == 0:
            v = 1
            
        orig_mgr = OriginalLanguagesManager.get_instance()
        words = orig_mgr.get_verse_original_words(b_code, ch, v)
        rev_interlinear = orig_mgr.get_verse_reverse_interlinear(b_code, ch, v)
        
        self.orig_textbox.configure(state="normal")
        self.orig_textbox.delete("0.0", "end")
        self._orig_words_map.clear()
        
        if not words:
            self.orig_textbox.insert("end", f"\nDonnées originales non disponibles pour {cur_book} {ch}:{v}.\n", "welcome")
            if not orig_mgr.is_installed():
                self.orig_textbox.insert("end", "\nPour installer la base originale (STEPBible), rendez-vous dans les Réglages pour télécharger les données.\n", "body")
            self.orig_textbox.configure(state="disabled")
            return
            
        is_hebrew = words[0]["lang"] == "hebrew"
        lang_label = "Hébreu (Ancien Testament - WLC)" if is_hebrew else "Grec (Nouveau Testament - NA28/SBLGNT)"
        
        # En-tête
        self.orig_textbox.insert("end", f"📜 {cur_book} {ch}:{v}\n", "book_title")
        self.orig_textbox.insert("end", f"Édition : {lang_label}\n\n", "source_name")
        
        # Verset complet dans la langue originale avec tags interactifs mot par mot
        for i, w in enumerate(words):
            tag_name = f"orig_w_{i}"
            self._orig_words_map[tag_name] = w
            self.orig_textbox.insert("end", f"{w['text']} ", (tag_name, "orig_word"))
        self.orig_textbox.insert("end", "\n\n", "body")
            
        # Séparateur
        self.orig_textbox.insert("end", "─" * 36 + "\n\n", "chapter_divider")
        
        # Interlinéaire inversé Segond 1910
        if rev_interlinear:
            self.orig_textbox.insert("end", "📖 Segond 1910 (Interlinéaire Inversé) :\n", "comm_section_title")
            self.orig_textbox.insert("end", f"{rev_interlinear}\n\n", "comm_body")
            self.orig_textbox.insert("end", "─" * 36 + "\n\n", "chapter_divider")
            
        # Décomposition mot-à-mot
        self.orig_textbox.insert("end", "🔍 Décomposition Mot-à-Mot & Morphologie :\n\n", "comm_section_title")
        for i, w in enumerate(words, 1):
            tag_name = f"orig_w_{i-1}"
            trans = f" ({w['transliteration']})" if w['transliteration'] else ""
            self.orig_textbox.insert("end", f"• {i}. {w['text']}{trans}\n", "orig_word")
            
            lemma_str = f"Lemme : {w['lemma']}" if w['lemma'] else ""
            strong_str = f"Strong : {w['strong']}" if w['strong'] else ""
            hdr_parts = [p for p in [lemma_str, strong_str] if p]
            if hdr_parts:
                self.orig_textbox.insert("end", f"   {' | '.join(hdr_parts)}\n", "logos_lemma")
                
            if w.get('morph_desc_fr') or w.get('morph_code'):
                morph_txt = w.get('morph_desc_fr') or w.get('morph_code')
                self.orig_textbox.insert("end", f"   Morphologie : {morph_txt}\n", "orig_morph")
                
            if w.get('gloss'):
                self.orig_textbox.insert("end", f"   Sens littéral : \"{w['gloss']}\"\n", "orig_gloss")
                
            if w.get('strong_def_fr'):
                s_def = w['strong_def_fr']
                if len(s_def) > 100:
                    s_def = s_def[:100].strip() + "..."
                self.orig_textbox.insert("end", f"   Définition : {s_def}\n", "lex_details")
                
            self.orig_textbox.insert("end", "\n", "body")
            
        self.orig_textbox.configure(state="disabled")

    def on_orig_mouse_motion(self, event):
        """Gère le survol des mots dans le panneau de langues originales."""
        try:
            index_at_mouse = self.orig_textbox._textbox.index(f"@{event.x},{event.y}")
            tags = self.orig_textbox._textbox.tag_names(index_at_mouse)
            
            orig_tag = None
            for t in tags:
                if t.startswith("orig_w_") and t in self._orig_words_map:
                    orig_tag = t
                    break
                    
            if orig_tag:
                if self._last_orig_hover_tag != orig_tag:
                    self._last_orig_hover_tag = orig_tag
                    w = self._orig_words_map[orig_tag]
                    lang_title = "Hébreu (WLC)" if w["lang"] == "hebrew" else "Grec (NA28)"
                    
                    tooltip_data = {
                        "source": f"📜 {lang_title} • {w.get('strong', '')}",
                        "title": f"{w.get('text', '')} ({w.get('transliteration', '')})" if w.get('transliteration') else w.get('text', ''),
                        "preview": (
                            f"• Lemme : {w.get('lemma', '')}\n"
                            f"• Morphologie : {w.get('morph_desc_fr') or w.get('morph_code', '')}\n"
                            f"• Sens : \"{w.get('gloss', '')}\"\n"
                            f"• Définition Strong : {w.get('strong_def_fr', '')}"
                        ),
                        "hint": "🔍 Cliquer pour explorer ce mot dans le lexique"
                    }
                    
                    bb = self.orig_textbox._textbox.bbox(index_at_mouse)
                    if bb:
                        bx, by, bw, bh = bb
                        root_x = self.orig_textbox._textbox.winfo_rootx() + bx
                        root_y = self.orig_textbox._textbox.winfo_rooty() + by
                        target_rect = (root_x, root_y, bw, bh)
                    else:
                        root_x = self.orig_textbox._textbox.winfo_rootx() + event.x
                        root_y = self.orig_textbox._textbox.winfo_rooty() + event.y
                        target_rect = (root_x, root_y, 20, 20)
                        
                    if hasattr(self, '_orig_tooltip_job') and self._orig_tooltip_job:
                        try:
                            self.after_cancel(self._orig_tooltip_job)
                        except Exception:
                            pass
                    self._orig_tooltip_job = self.after(90, lambda rx=root_x, ry=root_y, td=tooltip_data, tr=target_rect: self.tooltip.show(rx, ry, td, target_rect=tr))
                    self.orig_textbox._textbox.config(cursor="hand2")
            else:
                self.on_orig_mouse_leave()
        except Exception:
            pass

    def on_orig_mouse_leave(self, event=None):
        """Ferme l'infobulle lors de la sortie de la zone originale."""
        if hasattr(self, '_orig_tooltip_job') and self._orig_tooltip_job:
            try:
                self.after_cancel(self._orig_tooltip_job)
            except Exception:
                pass
            self._orig_tooltip_job = None
        self._last_orig_hover_tag = None
        if hasattr(self, 'tooltip'):
            self.tooltip.hide()
        if hasattr(self, 'orig_textbox') and self.orig_textbox._textbox.winfo_exists():
            self.orig_textbox._textbox.config(cursor="")

    def on_orig_mouse_click(self, event):
        """Ouvre le mot Strong cliqué dans l'onglet Lexique."""
        try:
            index_at_mouse = self.orig_textbox._textbox.index(f"@{event.x},{event.y}")
            tags = self.orig_textbox._textbox.tag_names(index_at_mouse)
            
            for t in tags:
                if t.startswith("orig_w_") and t in self._orig_words_map:
                    w = self._orig_words_map[t]
                    strong_code = w.get("strong")
                    if strong_code:
                        match = {"code": strong_code, "strong": strong_code, "word": w.get("text")}
                        self.right_tabs.set("🔍 Lexique & Dictionnaires")
                        self.display_dictionary_entry(match)
                    break
        except Exception:
            pass

    def on_analyze_orig_with_ai(self):
        """Lance une analyse exégétique ciblée sur le verset original."""
        cur_book = self.loaded_french_book or self.current_valid_book or self.book_var.get()
        ch = getattr(self, 'current_active_chapter', 1)
        v = getattr(self, 'current_active_verse', 1)
        if v == 0:
            v = 1
            
        prompt = f"Peux-tu faire une analyse exégétique approfondie de {cur_book} {ch}:{v} en t'appuyant sur le texte original (vocabulaire, morphologie et syntaxe) ?"
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

    def push_history(self, book, chapter, verse=None):
        """Mémorise un changement de passage dans la pile d'historique de navigation."""
        if self._is_navigating_history:
            return
        v = verse if verse and str(verse) != "Tous" else None
        state = (book, int(chapter) if str(chapter).isdigit() else 1, int(v) if v and str(v).isdigit() else None)
        
        if self.last_pushed_ref == state:
            return
            
        if self.last_pushed_ref is not None:
            self.history_back.append(self.last_pushed_ref)
            self.history_forward.clear()
            if len(self.history_back) > 50:
                self.history_back.pop(0)
                
        self.last_pushed_ref = state
        self.update_history_buttons()

    def navigate_history_back(self, event=None):
        """Revient au passage biblique précédent dans l'historique (Alt + Flèche Gauche)."""
        if not self.history_back:
            return "break"
        target = self.history_back.pop()
        if self.last_pushed_ref:
            self.history_forward.append(self.last_pushed_ref)
        self.last_pushed_ref = target
        
        self._is_navigating_history = True
        try:
            b, c, v = target
            self.apply_book_selection(b, chapter=c, verse=v)
        finally:
            self._is_navigating_history = False
        self.update_history_buttons()
        return "break"

    def navigate_history_forward(self, event=None):
        """Avance au passage biblique suivant dans l'historique (Alt + Flèche Droite)."""
        if not self.history_forward:
            return "break"
        target = self.history_forward.pop()
        if self.last_pushed_ref:
            self.history_back.append(self.last_pushed_ref)
        self.last_pushed_ref = target
        
        self._is_navigating_history = True
        try:
            b, c, v = target
            self.apply_book_selection(b, chapter=c, verse=v)
        finally:
            self._is_navigating_history = False
        self.update_history_buttons()
        return "break"

    def update_history_buttons(self):
        """Active ou grise dynamiquement les boutons d'historique ◀ et ▶."""
        if hasattr(self, 'btn_history_back'):
            state_b = "normal" if self.history_back else "disabled"
            txt_b = ("#0F172A", "#F8FAFC") if self.history_back else ("#94A3B8", "#64748B")
            self.btn_history_back.configure(state=state_b, text_color=txt_b)
            
        if hasattr(self, 'btn_history_forward'):
            state_f = "normal" if self.history_forward else "disabled"
            txt_f = ("#0F172A", "#F8FAFC") if self.history_forward else ("#94A3B8", "#64748B")
            self.btn_history_forward.configure(state=state_f, text_color=txt_f)

    def apply_book_selection(self, book_name, chapter=None, verse=None):
        self.push_history(book_name, chapter or 1, verse)
        self.current_valid_book = book_name
        self.book_var.set(book_name)
        self.book_menu.configure(values=self.all_book_names)
        
        code = FRENCH_TO_CODE.get(book_name, "Joh")
        ch_count = CODE_TO_CH_COUNT.get(code, 1)
        
        ch_val = int(chapter) if chapter and str(chapter).isdigit() else 1
        v_val = int(verse) if verse and str(verse).isdigit() else 1
        self.current_active_chapter = ch_val
        self.current_active_verse = v_val
        
        # Si le même livre est déjà affiché dans le lecteur continu, on scrolle directement
        if self.loaded_book_code == code:
            self.is_updating_breadcrumb = True
            try:
                ch_values = [str(x) for x in range(1, ch_count + 1)]
                self.chapter_menu.configure(values=ch_values)
                self.chapter_var.set(str(ch_val))
                    
                if verse:
                    self.verse_var.set(str(verse))
                else:
                    self.verse_var.set("Tous")
            finally:
                self.is_updating_breadcrumb = False
                
            self.scroll_to_ref(ch_val, v_val if verse else None)
            return
            
        self.is_updating_breadcrumb = True
        try:
            ch_values = [str(x) for x in range(1, ch_count + 1)]
            self.chapter_menu.configure(values=ch_values)
            self.chapter_var.set(str(ch_val))
                
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
                    
                if self.is_commentary_locked:
                    self.sync_commentary_to_verse(cur_ch, cur_v or 1)

    def toggle_sync_lock(self):
        """Active ou désactive la synchronisation automatique entre la Bible et le commentaire."""
        self.is_commentary_locked = not self.is_commentary_locked
        if self.is_commentary_locked:
            self.btn_sync_lock.configure(
                text="🔗 Lié", 
                fg_color=("#E0F2FE", "#0F2B48"), 
                text_color=("#0284C7", "#38BDF8"),
                hover_color=("#BAE6FD", "#1E3A8A")
            )
            self.sync_commentary_to_verse(self.current_active_chapter, self.current_active_verse)
        else:
            self.btn_sync_lock.configure(
                text="🔓 Libre", 
                fg_color=("#FEF3C7", "#3B2506"), 
                text_color=("#D97706", "#FBBF24"),
                hover_color=("#FDE68A", "#451A03")
            )

    def on_toggle_intro_view(self):
        """Bascule directement entre l'introduction du livre et le commentaire de verset."""
        ch = getattr(self, 'current_active_chapter', 1)
        if getattr(self, 'current_active_verse', 1) == 0:
            if self.is_commentary_locked:
                self.scroll_to_ref(ch, 1)
            else:
                self.sync_commentary_to_verse(ch, 1)
        else:
            self.sync_commentary_to_verse(ch, 0)

    def on_prev_comm_verse(self):
        """Passe au verset précédent (ou à l'Introduction si verset 1)."""
        cur_v = getattr(self, 'current_active_verse', 1)
        ch = getattr(self, 'current_active_chapter', 1)
        
        target_v = max(0, cur_v - 1)
        if target_v == cur_v:
            return
            
        if self.is_commentary_locked and target_v >= 1:
            self.scroll_to_ref(ch, target_v)
        else:
            self.sync_commentary_to_verse(ch, target_v)
        
    def on_next_comm_verse(self):
        """Passe au verset suivant."""
        cur_v = getattr(self, 'current_active_verse', 1)
        ch = getattr(self, 'current_active_chapter', 1)
        
        target_v = cur_v + 1
        if self.is_commentary_locked:
            self.scroll_to_ref(ch, target_v)
        else:
            self.sync_commentary_to_verse(ch, target_v)

    def sync_commentary_to_verse(self, chapter, verse):
        """Met à jour instantanément le panneau des commentaires pour n'afficher strictement que le verset ou l'introduction actif."""
        ch = int(chapter) if str(chapter).isdigit() else 1
        v = int(verse) if str(verse).isdigit() else (0 if str(verse) == "0" else 1)
        
        self.current_active_chapter = ch
        self.current_active_verse = v
        
        if hasattr(self, 'lbl_comm_verse_badge'):
            if v == 0:
                self.lbl_comm_verse_badge.configure(text="Intro")
            else:
                self.lbl_comm_verse_badge.configure(text=f"V. {v}")
                
        if hasattr(self, 'btn_comm_intro'):
            if v == 0:
                self.btn_comm_intro.configure(text="📖 Verset 1", fg_color=("#E0F2FE", "#0F2B48"), text_color=("#0284C7", "#38BDF8"))
            else:
                self.btn_comm_intro.configure(text="📖 Intro", fg_color="transparent", text_color=("#64748B", "#94A3B8"))
            
        self.render_commentaries_view()
        if hasattr(self, 'sync_original_tab_to_verse'):
            self.sync_original_tab_to_verse(ch, v)

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
            self.bible_textbox._textbox.see(pos[0])
            self.bible_textbox._textbox.yview(pos[0])
            self.bible_textbox._textbox.tag_remove("active_verse_highlight", "1.0", "end")
            if len(pos) >= 2:
                self.bible_textbox._textbox.tag_add("active_verse_highlight", pos[0], pos[1])
            
        v_num = int(verse) if verse and str(verse).isdigit() else 1
        if self.is_commentary_locked:
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
        if not hasattr(self, '_open_tab_instances'):
            self._open_tab_instances = {}
            
        try:
            self.main_tabs.tab(tab_name)
            self.main_tabs.set(tab_name)
            self.set_full_width_mode(True)
            return self._open_tab_instances.get(tab_name)
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
        self._open_tab_instances[tab_name] = content
        return content
        
    def close_tab(self, tab_name):
        if hasattr(self, '_open_tab_instances') and tab_name in self._open_tab_instances:
            try:
                del self._open_tab_instances[tab_name]
            except Exception:
                pass
        try:
            self.main_tabs.delete(tab_name)
        except ValueError:
            pass
        if self.is_immersive_mode:
            return
        cur = self.main_tabs.get()
        if cur == "📖 Lecture":
            self.set_full_width_mode(self.bible_full_width)

    def toggle_search_tab(self, initial_query=None):
        """Affiche ou masque l'espace de recherche (Ctrl+F)."""
        tab_name = "🔍 Recherche"
        try:
            cur = self.main_tabs.get()
        except Exception:
            cur = ""

        # Si l'onglet recherche est déjà sélectionné, on le ferme et on revient à la lecture
        if cur == tab_name:
            self.close_tab(tab_name)
            try:
                self.main_tabs.set("📖 Lecture")
            except Exception:
                pass
            return

        from gui.search_tab import SearchTab
        search_instance = self.open_closable_tab(
            tab_name,
            SearchTab,
            current_bible=self.ref_bible_var.get(),
            on_navigate_callback=self.navigate_from_search
        )
        if search_instance:
            if initial_query:
                search_instance.set_query_and_search(initial_query)
            else:
                self.after(50, search_instance.focus_search)

    def navigate_from_search(self, book_code: str, chapter: int, verse: Optional[int] = None):
        """Bascule vers le lecteur biblique et scrolle directement au verset avec surbrillance."""
        # 1. Revenir à l'onglet Lecture
        try:
            self.main_tabs.set("📖 Lecture")
        except Exception:
            pass
        if not self.is_immersive_mode:
            self.set_full_width_mode(self.bible_full_width)

        fr_name = CODE_TO_FRENCH.get(book_code, book_code)
        self.apply_book_selection(fr_name, chapter=chapter, verse=verse)
        self.after(300, lambda: self.flash_verse_highlight(chapter, verse))

    def flash_verse_highlight(self, chapter: int, verse: Optional[int] = None):
        """Met en valeur visuelle temporaire le verset ciblé (flash doux)."""
        if verse is None:
            return
        try:
            tb = self.bible_textbox._textbox
            tag = f"ref_{chapter}_{verse}"
            ranges = tb.tag_ranges(tag)
            if not ranges:
                return

            is_dark = (ctk.get_appearance_mode() == "Dark")
            flash_bg = "#854D0E" if is_dark else "#FEF08A"
            flash_fg = "#FEF9C3" if is_dark else "#713F12"

            tb.tag_config("search_flash", background=flash_bg, foreground=flash_fg)
            tb.tag_add("search_flash", ranges[0], ranges[1])

            def _clear_flash():
                try:
                    tb.tag_remove("search_flash", "1.0", "end")
                except Exception:
                    pass

            self.after(2500, _clear_flash)
        except Exception:
            pass

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
        if hasattr(self, 'orig_textbox'):
            textboxes_to_update.append(self.orig_textbox)
            self.orig_textbox._textbox.tag_configure("orig_word", font=(self.font_family, self.font_size + 2, "bold"), foreground="#60A5FA" if is_dark else "#2563EB")
            self.orig_textbox._textbox.tag_configure("orig_gloss", font=(self.font_family, max(9, self.font_size - 2), "italic"), foreground=verse_num_col)
            self.orig_textbox._textbox.tag_configure("orig_morph", font=(self.font_family, max(9, self.font_size - 3)), foreground="#10B981" if is_dark else "#059669")
            
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
            
            # Tags typographiques riches pour les Commentaires Bibliques
            box._textbox.tag_configure("comm_section_title", font=(self.font_family, self.font_size + 1, "bold"), foreground="#38BDF8" if is_dark else "#0284C7", spacing1=14, spacing3=6)
            box._textbox.tag_configure("comm_list_item", font=(self.font_family, self.font_size), foreground=text_col, lmargin1=16, lmargin2=28, spacing1=3, spacing3=3)
            box._textbox.tag_configure("comm_verse_lead", font=(self.font_family, self.font_size, "bold"), foreground="#F59E0B" if is_dark else "#D97706")
            box._textbox.tag_configure("comm_body", font=(self.font_family, self.font_size), foreground=text_col, spacing1=3, spacing2=sp2, spacing3=8)
            box._textbox.tag_configure("bible_ref_link", foreground="#38BDF8" if is_dark else "#0284C7", underline=True, font=(self.font_family, self.font_size, "bold"))
            
        # Tags de comparaison et d'interaction sur la zone Bible
        self.bible_textbox._textbox.tag_configure("verse_header", font=(self.font_family, self.font_size, "bold"), foreground=verse_hdr_col, spacing1=12, spacing3=4)
        self.bible_textbox._textbox.tag_configure("bible_abbr", font=(self.font_family, self.font_size - 3, "bold"), foreground=bible_abbr_col)
        self.bible_textbox._textbox.tag_configure("diff_percent", font=(self.font_family, self.font_size - 4, "italic"), foreground=diff_pct_col)
        self.bible_textbox._textbox.tag_configure("diff_added", font=(self.font_family, self.font_size), foreground=diff_add_col, underline=True)
        self.bible_textbox._textbox.tag_configure("diff_deleted", font=(self.font_family, self.font_size, "bold"), foreground=diff_del_col)
        self.bible_textbox._textbox.tag_configure("diff_replaced", font=(self.font_family, self.font_size), foreground=diff_rep_col, underline=True)
        
        # Tags spécifiques à Wikipédia
        wiki_hdr_col = "#38BDF8" if is_dark else "#0284C7"
        wiki_desc_col = "#94A3B8" if is_dark else "#64748B"
        wiki_link_col = "#38BDF8" if is_dark else "#0284C7"
        wiki_loading_col = "#94A3B8" if is_dark else "#64748B"
        
        if hasattr(self, 'lex_textbox'):
            self.lex_textbox._textbox.tag_configure("wiki_header", font=(self.font_family, self.font_size + 1, "bold"), foreground=wiki_hdr_col, spacing1=12, spacing3=6)
            self.lex_textbox._textbox.tag_configure("wiki_desc", font=(self.font_family, max(10, self.font_size - 2), "italic"), foreground=wiki_desc_col, justify="center", spacing1=2, spacing3=8)
            self.lex_textbox._textbox.tag_configure("wiki_link", font=(self.font_family, self.font_size, "bold"), foreground=wiki_link_col, underline=True, spacing1=8, spacing3=8)
            self.lex_textbox._textbox.tag_configure("wiki_loading", font=(self.font_family, self.font_size, "italic"), foreground=wiki_loading_col, spacing1=8)
            
            wiki_cand_snip_col = "#94A3B8" if is_dark else "#64748B"
            wiki_sep_col = "#475569" if is_dark else "#CBD5E1"
            self.lex_textbox._textbox.tag_configure("wiki_cand_snippet", font=(self.font_family, max(9, self.font_size - 3), "italic"), foreground=wiki_cand_snip_col, spacing1=1, spacing3=4)
            self.lex_textbox._textbox.tag_configure("wiki_sep", foreground=wiki_sep_col, justify="center")
            
            polish_badge_col = "#C084FC" if is_dark else "#7C3AED"
            self.lex_textbox._textbox.tag_configure("polish_badge", font=(self.font_family, max(9, self.font_size - 3), "bold"), foreground=polish_badge_col, justify="center", spacing1=4, spacing3=10)
            
            # Styles riches pour le Markdown du Lexique & Dictionnaires
            lex_h1_col = title_col
            lex_h2_col = "#38BDF8" if is_dark else "#0284C7"
            lex_h3_col = "#F59E0B" if is_dark else "#D97706"
            lex_link_col = "#38BDF8" if is_dark else "#0284C7"
            lex_hr_col = "#475569" if is_dark else "#CBD5E1"
            lex_bullet_col = "#38BDF8" if is_dark else "#0284C7"
            lex_lead_col = "#F59E0B" if is_dark else "#D97706"
            lex_it_col = "#94A3B8" if is_dark else "#64748B"
            
            self.lex_textbox._textbox.tag_configure("lex_h1", font=(self.font_family, self.font_size + 3, "bold"), foreground=lex_h1_col, justify="center", spacing1=10, spacing3=12)
            self.lex_textbox._textbox.tag_configure("lex_h2", font=(self.font_family, self.font_size + 1, "bold"), foreground=lex_h2_col, spacing1=14, spacing3=6)
            self.lex_textbox._textbox.tag_configure("lex_h3", font=(self.font_family, self.font_size, "bold"), foreground=lex_h3_col, spacing1=10, spacing3=4)
            self.lex_textbox._textbox.tag_configure("lex_h4", font=(self.font_family, self.font_size, "bold"), foreground="#60A5FA" if is_dark else "#2563EB", spacing1=8, spacing3=3)
            self.lex_textbox._textbox.tag_configure("lex_h5", font=(self.font_family, max(10, self.font_size - 1), "bold"), foreground="#38BDF8" if is_dark else "#0284C7", spacing1=6, spacing3=2)
            self.lex_textbox._textbox.tag_configure("lex_h6", font=(self.font_family, max(9, self.font_size - 2), "bold", "italic"), foreground=text_col, spacing1=4, spacing3=2)
            self.lex_textbox._textbox.tag_configure("lex_hr", font=(self.font_family, max(8, self.font_size - 4)), foreground=lex_hr_col, justify="center", spacing1=6, spacing3=6)
            self.lex_textbox._textbox.tag_configure("lex_bullet_dot", font=(self.font_family, self.font_size, "bold"), foreground=lex_bullet_col)
            self.lex_textbox._textbox.tag_configure("lex_lead_num", font=(self.font_family, self.font_size, "bold"), foreground=lex_lead_col)
            self.lex_textbox._textbox.tag_configure("lex_list_item", font=(self.font_family, self.font_size), foreground=text_col, lmargin1=14, lmargin2=26, spacing1=2, spacing3=2)
            self.lex_textbox._textbox.tag_configure("lex_sub_list_item", font=(self.font_family, self.font_size), foreground=text_col, lmargin1=26, lmargin2=38, spacing1=1, spacing3=1)
            self.lex_textbox._textbox.tag_configure("lex_sub_sub_list_item", font=(self.font_family, self.font_size), foreground=text_col, lmargin1=38, lmargin2=50, spacing1=1, spacing3=1)
            self.lex_textbox._textbox.tag_configure("lex_quote", font=(self.font_family, self.font_size, "italic"), foreground="#94A3B8" if is_dark else "#64748B", lmargin1=16, lmargin2=16, spacing1=3, spacing3=3)
            self.lex_textbox._textbox.tag_configure("lex_quote_bar", font=(self.font_family, self.font_size, "bold"), foreground="#38BDF8" if is_dark else "#0284C7")
            self.lex_textbox._textbox.tag_configure("lex_bold", font=(self.font_family, self.font_size, "bold"), foreground=text_col)
            self.lex_textbox._textbox.tag_configure("lex_h1_bold", font=(self.font_family, self.font_size + 3, "bold"), foreground=lex_h1_col)
            self.lex_textbox._textbox.tag_configure("lex_h2_bold", font=(self.font_family, self.font_size + 1, "bold"), foreground=lex_h2_col)
            self.lex_textbox._textbox.tag_configure("lex_h3_bold", font=(self.font_family, self.font_size, "bold"), foreground=lex_h3_col)
            self.lex_textbox._textbox.tag_configure("lex_h4_bold", font=(self.font_family, self.font_size, "bold"), foreground="#60A5FA" if is_dark else "#2563EB")
            self.lex_textbox._textbox.tag_configure("lex_h5_bold", font=(self.font_family, max(10, self.font_size - 1), "bold"), foreground="#38BDF8" if is_dark else "#0284C7")
            self.lex_textbox._textbox.tag_configure("lex_italic", font=(self.font_family, self.font_size, "italic"), foreground=lex_it_col)
            self.lex_textbox._textbox.tag_configure("lex_dict_link_base", font=(self.font_family, self.font_size, "bold"), foreground=lex_link_col, underline=True)
            self.lex_textbox._textbox.tag_configure("lex_orig_word_hebrew", font=(self.font_family, self.font_size + 1, "bold"), foreground="#60A5FA" if is_dark else "#2563EB", underline=True)
            self.lex_textbox._textbox.tag_configure("lex_orig_word_greek", font=(self.font_family, self.font_size + 1, "bold"), foreground="#10B981" if is_dark else "#059669", underline=True)
            
            self.lex_textbox._textbox.bind("<Leave>", lambda e: (self.tooltip.hide() if getattr(self, 'tooltip', None) else None, self.lex_textbox._textbox.config(cursor="")))
            
            self.lex_textbox._textbox.tag_bind("wiki_link", "<Button-1>", lambda e: self.on_open_wikipedia_web())
            self.lex_textbox._textbox.tag_bind("wiki_link", "<Enter>", lambda e: self.lex_textbox._textbox.config(cursor="hand2"))
            self.lex_textbox._textbox.tag_bind("wiki_link", "<Leave>", lambda e: self.lex_textbox._textbox.config(cursor=""))
            
        # Tag de survol dynamique pour les mots des dictionnaires
        hover_bg = "#1E3A8A" if is_dark else "#E0F2FE"
        hover_fg = "#38BDF8" if is_dark else "#0284C7"
        self.bible_textbox._textbox.tag_configure("hover_dict_highlight", background=hover_bg, foreground=hover_fg, underline=True)
        self.bible_textbox._textbox.tag_configure("active_verse_highlight", background="#1E293B" if is_dark else "#F1F5F9")

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

    def nav_next_verse(self):
        """Passe au verset suivant (ou chapitre/livre suivant si fin de chapitre)."""
        cur_book = self.loaded_french_book or self.current_valid_book or self.book_var.get()
        if not cur_book:
            return
            
        from core.reference_parser import get_standard_book_code
        from core.original_languages_manager import OriginalLanguagesManager
        
        b_code = get_standard_book_code(cur_book)
        ch_count = CODE_TO_CH_COUNT.get(b_code, 1)
        ch = int(self.chapter_var.get()) if self.chapter_var.get().isdigit() else 1
        
        v = getattr(self, 'current_active_verse', 1)
        if self.verse_var.get().isdigit():
            v = int(self.verse_var.get())
        if v == 0:
            v = 1
            
        orig_mgr = OriginalLanguagesManager.get_instance()
        max_v = orig_mgr.get_chapter_verse_count(b_code, ch)
        
        target_book = cur_book
        target_ch = ch
        target_v = v + 1
        
        if target_v > max_v:
            if ch < ch_count:
                target_ch = ch + 1
                target_v = 1
            else:
                if cur_book in self.all_book_names:
                    idx = self.all_book_names.index(cur_book)
                    if idx + 1 < len(self.all_book_names):
                        target_book = self.all_book_names[idx + 1]
                        target_ch = 1
                        target_v = 1
                    else:
                        return
                        
        self._navigate_to_passage(target_book, target_ch, target_v)

    def nav_prev_verse(self):
        """Passe au verset précédent (ou chapitre/livre précédent si verset 1)."""
        cur_book = self.loaded_french_book or self.current_valid_book or self.book_var.get()
        if not cur_book:
            return
            
        from core.reference_parser import get_standard_book_code
        from core.original_languages_manager import OriginalLanguagesManager
        
        b_code = get_standard_book_code(cur_book)
        ch = int(self.chapter_var.get()) if self.chapter_var.get().isdigit() else 1
        
        v = getattr(self, 'current_active_verse', 1)
        if self.verse_var.get().isdigit():
            v = int(self.verse_var.get())
        if v == 0:
            v = 1
            
        orig_mgr = OriginalLanguagesManager.get_instance()
        
        target_book = cur_book
        target_ch = ch
        target_v = v - 1
        
        if target_v < 1:
            if ch > 1:
                target_ch = ch - 1
                target_v = orig_mgr.get_chapter_verse_count(b_code, target_ch)
            else:
                if cur_book in self.all_book_names:
                    idx = self.all_book_names.index(cur_book)
                    if idx > 0:
                        target_book = self.all_book_names[idx - 1]
                        prev_b_code = get_standard_book_code(target_book)
                        target_ch = CODE_TO_CH_COUNT.get(prev_b_code, 1)
                        target_v = orig_mgr.get_chapter_verse_count(prev_b_code, target_ch)
                    else:
                        return
                        
        self._navigate_to_passage(target_book, target_ch, target_v)

    def nav_next_chapter(self):
        """Passe au chapitre suivant (ou livre suivant si dernier chapitre)."""
        cur_book = self.loaded_french_book or self.current_valid_book or self.book_var.get()
        if not cur_book:
            return
            
        from core.reference_parser import get_standard_book_code
        b_code = get_standard_book_code(cur_book)
        ch_count = CODE_TO_CH_COUNT.get(b_code, 1)
        ch = int(self.chapter_var.get()) if self.chapter_var.get().isdigit() else 1
        
        target_book = cur_book
        target_ch = ch + 1
        
        if target_ch > ch_count:
            if cur_book in self.all_book_names:
                idx = self.all_book_names.index(cur_book)
                if idx + 1 < len(self.all_book_names):
                    target_book = self.all_book_names[idx + 1]
                    target_ch = 1
                else:
                    return
                    
        self._navigate_to_passage(target_book, target_ch, 1)

    def nav_prev_chapter(self):
        """Passe au chapitre précédent (ou livre précédent si chapitre 1)."""
        cur_book = self.loaded_french_book or self.current_valid_book or self.book_var.get()
        if not cur_book:
            return
            
        from core.reference_parser import get_standard_book_code
        b_code = get_standard_book_code(cur_book)
        ch = int(self.chapter_var.get()) if self.chapter_var.get().isdigit() else 1
        
        target_book = cur_book
        target_ch = ch - 1
        
        if target_ch < 1:
            if cur_book in self.all_book_names:
                idx = self.all_book_names.index(cur_book)
                if idx > 0:
                    target_book = self.all_book_names[idx - 1]
                    prev_b_code = get_standard_book_code(target_book)
                    target_ch = CODE_TO_CH_COUNT.get(prev_b_code, 1)
                else:
                    return
                    
        self._navigate_to_passage(target_book, target_ch, 1)

    def _navigate_to_passage(self, book_name, chapter, verse):
        """Navigue fluidement vers un livre, chapitre et verset précis."""
        from core.reference_parser import get_standard_book_code
        from core.original_languages_manager import OriginalLanguagesManager
        
        b_code = get_standard_book_code(book_name)
        ch_count = CODE_TO_CH_COUNT.get(b_code, 1)
        orig_mgr = OriginalLanguagesManager.get_instance()
        max_v = orig_mgr.get_chapter_verse_count(b_code, chapter)
        
        if self.loaded_book_code == b_code:
            self.is_updating_breadcrumb = True
            try:
                self.chapter_menu.configure(values=[str(x) for x in range(1, ch_count + 1)])
                self.chapter_var.set(str(chapter))
                self.verse_menu.configure(values=["Tous"] + [str(x) for x in range(1, max_v + 1)])
                self.verse_var.set(str(verse))
            finally:
                self.is_updating_breadcrumb = False
                
            self.current_active_chapter = chapter
            self.current_active_verse = verse
            self.scroll_to_ref(chapter, verse)
        else:
            self.apply_book_selection(book_name, chapter=chapter, verse=verse)

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
                        
        # --- INITIALISER LE COMMENTAIRE POUR LE VERSET ACTIF ---
        self.current_french_book = french_book
        self.current_comms_grouped = comms_grouped
        self.current_active_chapter = target_chapter
        self.current_active_verse = target_verse if target_verse else 1
        self.push_history(french_book, target_chapter, target_verse)
        
        # Mettre à jour la liste déroulante des auteurs de commentaires disponibles
        if comms_grouped:
            available_authors = sorted(list(comms_grouped.keys()))
            self.comm_author_menu.configure(values=available_authors)
            current_choice = self.selected_comm_author_var.get()
            
            if current_choice not in available_authors:
                matched = None
                if current_choice:
                    for a in available_authors:
                        if current_choice.lower() in a.lower() or a.lower() in current_choice.lower():
                            matched = a
                            break
                self.selected_comm_author_var.set(matched if matched else available_authors[0])
        else:
            self.comm_author_menu.configure(values=["Aucun commentaire"])
            self.selected_comm_author_var.set("Aucun commentaire")
            
        if hasattr(self, 'lbl_comm_verse_badge'):
            self.lbl_comm_verse_badge.configure(text=f"V. {self.current_active_verse}")
            
        self.render_commentaries_view()
        
        for box in [self.bible_textbox, self.comm_textbox]:
            box.configure(state="disabled")
            
        # 3. Positionner immédiatement le défilement continu TOUT EN HAUT sur le chapitre et verset demandés
        self.after(50, lambda: self.scroll_to_ref(target_chapter, target_verse))

    def on_comm_author_changed(self, choice):
        """Met à jour instantanément l'affichage lors du changement d'auteur dans la liste déroulante."""
        self.render_commentaries_view()

    def render_commentaries_view(self):
        """Affiche instantanément uniquement le commentaire du verset actif (0 latence)."""
        self.comm_textbox.configure(state="normal")
        self.comm_textbox.delete("0.0", "end")
        
        if not hasattr(self, 'current_comms_grouped') or not self.current_comms_grouped:
            self.comm_textbox.insert("end", "Aucun commentaire lié à ce passage.", "welcome")
            self.comm_textbox.configure(state="disabled")
            return
            
        selected_author = self.selected_comm_author_var.get()
        french_book = getattr(self, 'current_french_book', "Ce livre")
        cur_ch = getattr(self, 'current_active_chapter', 1)
        cur_v = getattr(self, 'current_active_verse', 1)
        
        # Filtrer pour l'auteur sélectionné
        author_items = []
        if selected_author in self.current_comms_grouped:
            author_items = self.current_comms_grouped[selected_author]
        else:
            for k, v in self.current_comms_grouped.items():
                if selected_author.lower() in k.lower() or k.lower() in selected_author.lower():
                    author_items = v
                    selected_author = k
                    self.selected_comm_author_var.set(k)
                    break
            if not author_items and self.current_comms_grouped:
                first_key = sorted(list(self.current_comms_grouped.keys()))[0]
                author_items = self.current_comms_grouped[first_key]
                selected_author = first_key
                self.selected_comm_author_var.set(first_key)
                
        # Trouver les notes couvrant le verset actif ou l'introduction (cur_v == 0)
        matched_comments = []
        has_intro = False
        
        for doc, meta in author_items:
            ch = meta.get('chapter', 1)
            v_start = meta.get('verse')
            v_end = meta.get('verse_end', v_start)
            ref = meta.get('reference', '')
            
            if ch == 0 or v_start == 0 or 'Intro' in ref or 'Préface' in ref:
                has_intro = True
                if cur_v == 0:
                    matched_comments.append((doc, meta))
                    continue
                    
            if cur_v == 0:
                continue
                
            if ch != cur_ch:
                continue
            
            is_match = False
            if v_start is not None:
                if str(v_start).isdigit():
                    v_s_num = int(v_start)
                    v_e_num = int(v_end) if str(v_end).isdigit() else v_s_num
                    if v_s_num <= cur_v <= v_e_num:
                        is_match = True
                elif isinstance(v_start, str) and "-" in v_start:
                    parts = v_start.split("-")
                    if parts[0].isdigit() and parts[1].isdigit():
                        if int(parts[0]) <= cur_v <= int(parts[1]):
                            is_match = True
                            
            if not is_match:
                if f":{cur_v}" in ref:
                    is_match = True
                    
            if is_match:
                matched_comments.append((doc, meta))
                
        # Option B : Si on est sur le Verset 1 et qu'une introduction existe, afficher un bandeau cliquable
        if cur_v == 1 and has_intro:
            self.comm_textbox.insert("end", "📘 ", "comm_verse_lead")
            self.comm_textbox.insert("end", f"Lire l'introduction générale de {french_book} ({selected_author})\n\n", ("comm_body", "bible_ref_link", f"cmd_intro_{french_book}"))
            self.comm_textbox.insert("end", "─" * 28 + "\n\n", "chapter_divider")
                
        if matched_comments:
            for idx, (doc, meta) in enumerate(matched_comments):
                if cur_v == 0:
                    ref = f"{french_book} - Introduction générale"
                else:
                    ref = meta.get('reference', f"{french_book} {cur_ch}:{cur_v}")
                
                if idx > 0:
                    self.comm_textbox.insert("end", "\n" + "─" * 28 + "\n\n", "chapter_divider")
                elif cur_v != 1 or not has_intro:
                    self.comm_textbox.insert("end", f"───  {selected_author}  ───\n\n", "chapter_divider")
                    
                self.comm_textbox.insert("end", f"📍 {ref}\n\n", "book_title")
                
                # Mise en page riche et aérée (paragraphes continus, listes à puces, titres avec liens bibliques)
                paras = clean_and_reflow_commentary_paragraphs(doc)
                
                for p in paras:
                    if not p:
                        continue
                        
                    # Ligne de puce (- ou • ou *)
                    if p.startswith(('-', '•', '*')):
                        self.insert_text_with_bible_links(p, "comm_list_item", end_newline="\n")
                        continue
                        
                    # Titre de section ou sous-chapitre autonome
                    if (p.isupper() and len(p) < 80) or p.startswith(('CHAPITRE ', 'NOTES SUR LE CHAPITRE', 'NOTES SUR LE CHAPITRE.')):
                        self.comm_textbox.insert("end", f"{p}\n\n", "comm_section_title")
                        continue
                        
                    # Sous-titres avec préfixe (ex: Travail du sixième jour - ...)
                    if p.startswith(('Travail du', 'Cinquième jour', 'Sixième jour', 'De la lumière et')):
                        if ' - ' in p or '- ' in p:
                            parts = re.split(r'\s*-\s*', p, maxsplit=1)
                            self.comm_textbox.insert("end", f"• {parts[0]} : ", "comm_verse_lead")
                            if len(parts) > 1:
                                self.insert_text_with_bible_links(parts[1], "comm_body", end_newline="\n\n")
                            else:
                                self.comm_textbox.insert("end", "\n\n")
                        else:
                            self.insert_text_with_bible_links(p, "comm_body", end_newline="\n\n")
                        continue
                        
                    # Paragraphe commençant par un numéro ou mention de verset
                    match_lead = re.match(r'^(Verset\s+[\w\s\.:\d]+[\.:]?|\d+[\.,]\s*|\d+-\d+[\.,]\s*)(.*)$', p, re.DOTALL)
                    if match_lead:
                        lead = match_lead.group(1)
                        rest = match_lead.group(2)
                        self.comm_textbox.insert("end", lead, "comm_verse_lead")
                        self.insert_text_with_bible_links(rest, "comm_body", end_newline="\n\n")
                        continue
                        
                    # Corps de paragraphe standard avec détection de liens bibliques interactifs
                    self.insert_text_with_bible_links(p, "comm_body", end_newline="\n\n")
        else:
            self.comm_textbox.insert("end", f"───  {selected_author}  ───\n\n", "chapter_divider")
            self.comm_textbox.insert("end", f"📍 {french_book} {cur_ch}:{cur_v}\n\n", "book_title")
            self.comm_textbox.insert("end", "(Aucun commentaire spécifique pour ce verset chez cet auteur)\n\n", "welcome")
            
            # Trouver les autres auteurs qui ont commenté ce verset précis
            other_authors = []
            for a_name, items in self.current_comms_grouped.items():
                if a_name == selected_author:
                    continue
                for doc, meta in items:
                    ch = meta.get('chapter', 1)
                    if cur_v == 0:
                        if ch == 0 or meta.get('verse') == 0 or 'Intro' in meta.get('reference', '') or 'Préface' in meta.get('reference', ''):
                            other_authors.append((a_name, "Introduction générale"))
                            break
                    else:
                        if ch != cur_ch:
                            continue
                        v_start = meta.get('verse')
                        v_end = meta.get('verse_end', v_start)
                        is_m = False
                        if v_start is not None:
                            if str(v_start).isdigit():
                                v_s = int(v_start)
                                v_e = int(v_end) if str(v_end).isdigit() else v_s
                                if v_s <= cur_v <= v_e:
                                    is_m = True
                            elif isinstance(v_start, str) and "-" in v_start:
                                parts = v_start.split("-")
                                if parts[0].isdigit() and parts[1].isdigit():
                                    if int(parts[0]) <= cur_v <= int(parts[1]):
                                        is_m = True
                        if not is_m and f":{cur_v}" in meta.get('reference', ''):
                            is_m = True
                            
                        if is_m:
                            ref_str = meta.get('reference', '')
                            other_authors.append((a_name, ref_str))
                            break
                            
            if other_authors:
                self.comm_textbox.insert("end", "💡 D'autres auteurs ont commenté ce passage :\n\n", "comm_section_title")
                for a_name, ref_note in other_authors:
                    clean_ref = f" ({ref_note})" if ref_note and ref_note != f"{french_book} {cur_ch}:{cur_v}" and ref_note != "Introduction générale" else ""
                    self.comm_textbox.insert("end", "   • 📝 ", "comm_list_item")
                    author_tag = f"cmd_switch_author_{a_name}"
                    self.comm_textbox.insert("end", f"{a_name}{clean_ref}\n", ("comm_list_item", "bible_ref_link", author_tag))
                self.comm_textbox.insert("end", "\n")
            
        self.comm_textbox.configure(state="disabled")

    def insert_text_with_bible_links(self, text, base_tag, end_newline="\n\n"):
        """Insère du texte dans comm_textbox en transformant automatiquement chaque référence biblique en lien cliquable avec infobulle."""
        from core.bible_reference_detector import find_bible_references
        refs = find_bible_references(text)
        
        if not refs:
            self.comm_textbox.insert("end", f"{text}{end_newline}", base_tag)
            return
            
        last_idx = 0
        for r in refs:
            s = r["start"]
            e = r["end"]
            
            # Insérer le texte avant la référence
            if s > last_idx:
                self.comm_textbox.insert("end", text[last_idx:s], base_tag)
                
            # Insérer la référence stylisée en lien interactif
            v_val = r["verse"] if r["verse"] else "0"
            ref_tag = f"bref_{r['book_code']}_{r['chapter']}_{v_val}"
            tags = (base_tag, "bible_ref_link", ref_tag) if base_tag else ("bible_ref_link", ref_tag)
            self.comm_textbox.insert("end", r["raw"], tags)
            
            last_idx = e
            
        # Insérer le reste du texte
        if last_idx < len(text):
            self.comm_textbox.insert("end", text[last_idx:], base_tag)
            
        if end_newline:
            self.comm_textbox.insert("end", end_newline, base_tag)

    def on_comm_mouse_motion(self, event):
        """Affiche une infobulle (tooltip) au survol d'un lien de verset biblique dans les commentaires."""
        try:
            idx = self.comm_textbox._textbox.index(f"@{event.x},{event.y}")
            tags = self.comm_textbox._textbox.tag_names(idx)
            
            if any(t.startswith("cmd_intro_") or t.startswith("cmd_switch_author_") for t in tags):
                self.comm_textbox._textbox.config(cursor="hand2")
                return
                
            bref_tags = [t for t in tags if t.startswith("bref_")]
            
            if bref_tags:
                self.comm_textbox._textbox.config(cursor="hand2")
                tag_name = bref_tags[0]
                
                if getattr(self, '_hover_comm_ref', None) == tag_name and getattr(self.tooltip, 'tw', None):
                    return
                self._hover_comm_ref = tag_name
                
                parts = tag_name.split("_")
                b_code = parts[1]
                ch = int(parts[2]) if parts[2].isdigit() else 1
                v_str = parts[3] if len(parts) > 3 and parts[3] != '0' else None
                
                ref_bible = self.config.get("reference_bible", "Segond 21")
                from core.bible_reference_detector import get_bible_passage_preview
                ref_title, preview_txt = get_bible_passage_preview(ref_bible, b_code, ch, v_str)
                
                x = self.comm_textbox._textbox.winfo_rootx() + event.x + 10
                y = self.comm_textbox._textbox.winfo_rooty() + event.y + 10
                
                tooltip_data = {
                    "word": tag_name,
                    "source": f"📖 {ref_bible}",
                    "title": ref_title,
                    "preview": preview_txt,
                    "hint": "🖱️ Cliquer pour naviguer vers ce passage dans la Bible"
                }
                self.tooltip.show(x, y, tooltip_data)
            else:
                if getattr(self, '_hover_comm_ref', None):
                    self._hover_comm_ref = None
                    self.comm_textbox._textbox.config(cursor="")
                    if self.tooltip:
                        self.tooltip.hide()
        except Exception:
            pass

    def on_comm_mouse_leave(self, event=None):
        """Masque l'infobulle lorsque le curseur quitte la zone de commentaire."""
        self._hover_comm_ref = None
        try:
            self.comm_textbox._textbox.config(cursor="")
        except Exception:
            pass
        if self.tooltip:
            self.tooltip.hide()

    def on_comm_mouse_click(self, event):
        """Au clic sur un lien de verset biblique, d'intro ou d'auteur suggéré, exécute l'action."""
        try:
            idx = self.comm_textbox._textbox.index(f"@{event.x},{event.y}")
            tags = self.comm_textbox._textbox.tag_names(idx)
            
            # Clic sur le bandeau d'introduction générale
            if any(t.startswith("cmd_intro_") for t in tags):
                self.sync_commentary_to_verse(1, 0)
                return
                
            # Clic sur un auteur suggéré
            for t in tags:
                if t.startswith("cmd_switch_author_"):
                    target_author = t.replace("cmd_switch_author_", "")
                    if target_author in self.current_comms_grouped:
                        self.selected_comm_author_var.set(target_author)
                        self.render_commentaries_view()
                        return
                
            bref_tags = [t for t in tags if t.startswith("bref_")]
            
            # Fallback si l'index direct est imprécis mais qu'on était en survol sur ce tag
            if not bref_tags and getattr(self, '_hover_comm_ref', None):
                bref_tags = [self._hover_comm_ref]
                
            if bref_tags:
                parts = bref_tags[0].split("_")
                b_code = parts[1]
                ch = int(parts[2]) if parts[2].isdigit() else 1
                v_str = parts[3] if len(parts) > 3 and parts[3] != '0' else None
                v_num = int(v_str.split("-")[0]) if v_str and v_str.split("-")[0].isdigit() else (int(v_str) if v_str and v_str.isdigit() else None)
                
                if self.tooltip:
                    self.tooltip.hide()
                self._hover_comm_ref = None
                
                fr_book = REVERSE_BOOK_MAPPING.get(b_code, b_code)
                
                # Basculer l'onglet principal vers la lecture si on était dans la recherche
                if self.main_tabs.get() != "📖 Lecture":
                    self.main_tabs.set("📖 Lecture")
                    
                # Appliquer la navigation proprement vers le livre, chapitre et verset cibles
                self.apply_book_selection(fr_book, chapter=ch, verse=v_num)
        except Exception as e:
            print(f"Erreur clic lien commentaire : {e}")

    def display_error(self, message):
        self.loaded_book_code = None
        for box in [self.bible_textbox, self.comm_textbox]:
            box.configure(state="normal")
            box.delete("0.0", "end")
            box.insert("end", f"{message}\n", "error")
            box.configure(state="disabled")
            
    def get_text_content(self):
        return f"--- TEXTE BIBLIQUE ---\n{self.bible_textbox.get('0.0', 'end')}\n\n--- COMMENTAIRES ---\n{self.comm_textbox.get('0.0', 'end')}"
