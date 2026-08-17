import customtkinter as ctk
import tkinter as tk
import time
import threading
import queue
import re
from typing import Optional, Callable, Dict, Any, List

from core.search_engine import SearchEngine, CORPUS_DEFINITIONS, FRENCH_BOOK_NAMES, strip_accents
from gui.library_utils import load_books_metadata


class SearchTab(ctk.CTkFrame):
    """
    Composant complet d'espace de recherche (Bibles et Bibliothèque globale).
    - Recherche par mot-clé, phrase exacte, référence ou Strong
    - Sélection des versions (courante, actives, toutes installées, ou spécifique)
    - Filtre par corpus canonique (AT, NT, Évangiles, etc.)
    - Affichage multi-versions structuré avec mise en surbrillance
    - Accès direct en un clic vers le lecteur biblique
    """
    def __init__(
        self,
        master,
        current_bible: str = "Segond 21",
        on_navigate_callback: Optional[Callable[[str, int, Optional[int]], None]] = None,
        close_callback: Optional[Callable[[], None]] = None,
        **kwargs
    ):
        super().__init__(master, **kwargs)

        self.current_bible = current_bible or "Segond 21"
        self.on_navigate = on_navigate_callback
        self.close_callback = close_callback
        self.search_engine = SearchEngine.get_instance()

        self._active_search_thread = None
        self._is_searching = False
        self._last_results = []
        self._global_results = {}
        self._result_queue = queue.Queue()

        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(3, weight=1)

        # 1. Barre de Recherche Principale
        self._build_search_header()

        # 2. Sélecteur de Périmètre (Pills / Segmented)
        self._build_scope_selector()

        # 3. Barre de Filtres contextuels (Bibles / Corpus / Mode)
        self._build_filters_bar()

        # 4. Zone des Résultats
        self._build_results_area()

        # 5. Démarrage de la boucle de réception thread-safe
        self._poll_search_queue()

    def _poll_search_queue(self):
        """Récupère les résultats de recherche depuis le worker thread de manière 100% thread-safe."""
        try:
            while not self._result_queue.empty():
                task = self._result_queue.get_nowait()
                t_type = task[0]
                if t_type == "bible":
                    self._display_bible_results(task[1], task[2], task[3])
                elif t_type == "commentaries":
                    self._display_commentary_results(task[1], task[2], task[3])
                elif t_type == "dictionaries":
                    self._display_dictionary_results(task[1], task[2], task[3])
                elif t_type == "all":
                    self._display_global_results(task[1], task[2], task[3])
        except Exception:
            pass

        if hasattr(self, 'winfo_exists') and self.winfo_exists():
            self.after(40, self._poll_search_queue)

    def _build_search_header(self):
        header_frame = ctk.CTkFrame(self, fg_color="transparent")
        header_frame.grid(row=0, column=0, sticky="ew", padx=20, pady=(15, 8))
        header_frame.grid_columnconfigure(1, weight=1)

        # Icône Loupe
        lbl_icon = ctk.CTkLabel(header_frame, text="🔍", font=ctk.CTkFont(size=22))
        lbl_icon.grid(row=0, column=0, padx=(0, 10))

        # Champ de saisie avec cadre moderne
        self.search_var = ctk.StringVar()
        self.search_entry = ctk.CTkEntry(
            header_frame,
            textvariable=self.search_var,
            placeholder_text="Rechercher un mot, phrase exacte \"...\", référence (ex: Jean 3:16) ou Strong (ex: G26)...",
            height=40,
            font=ctk.CTkFont(size=14),
            corner_radius=8
        )
        self.search_entry.grid(row=0, column=1, sticky="ew", padx=(0, 10))
        self.search_entry.bind("<Return>", lambda e: self.launch_search())
        self.search_entry.bind("<KeyRelease>", self._on_key_release_debounce)
        self.search_entry.bind("<Escape>", lambda e: self._on_escape())
        self.bind("<Escape>", lambda e: self._on_escape())

        # Bouton Effacer ✖
        self.btn_clear = ctk.CTkButton(
            header_frame,
            text="✕",
            width=36,
            height=36,
            font=ctk.CTkFont(size=13, weight="bold"),
            fg_color=("#E2E8F0", "#334155"),
            hover_color=("#CBD5E1", "#475569"),
            text_color=("#475569", "#94A3B8"),
            corner_radius=8,
            command=self.clear_search
        )
        self.btn_clear.grid(row=0, column=2, padx=(0, 8))

        # Bouton Rechercher
        self.btn_search = ctk.CTkButton(
            header_frame,
            text="Rechercher",
            width=110,
            height=38,
            font=ctk.CTkFont(size=13, weight="bold"),
            fg_color=("#2563EB", "#1D4ED8"),
            hover_color=("#1D4ED8", "#1E40AF"),
            text_color="#FFFFFF",
            corner_radius=8,
            command=self.launch_search
        )
        self.btn_search.grid(row=0, column=3, padx=(0, 5))

    def _build_scope_selector(self):
        scope_frame = ctk.CTkFrame(self, fg_color="transparent")
        scope_frame.grid(row=1, column=0, sticky="ew", padx=20, pady=(0, 8))

        lbl_scope = ctk.CTkLabel(scope_frame, text="Périmètre :", font=ctk.CTkFont(size=12, weight="bold"), text_color=("#64748B", "#94A3B8"))
        lbl_scope.pack(side="left", padx=(0, 10))

        self.scope_var = ctk.StringVar(value="bible")
        
        scopes = [
            ("📖 Texte Biblique", "bible"),
            ("🌐 Toute la Bibliothèque", "all"),
            ("💬 Commentaires", "commentaries"),
            ("📚 Dictionnaires & Lexiques", "dictionaries")
        ]

        self.scope_buttons = {}
        for label, val in scopes:
            btn = ctk.CTkRadioButton(
                scope_frame,
                text=label,
                variable=self.scope_var,
                value=val,
                font=ctk.CTkFont(size=12),
                command=self._on_scope_changed
            )
            btn.pack(side="left", padx=8)
            self.scope_buttons[val] = btn

    def _build_filters_bar(self):
        self.filters_frame = ctk.CTkFrame(self, fg_color=("gray95", "#1E293B"), corner_radius=8)
        self.filters_frame.grid(row=2, column=0, sticky="ew", padx=20, pady=(0, 10))

        # 1. Filtre Versions
        self.lbl_version = ctk.CTkLabel(self.filters_frame, text="Version :", font=ctk.CTkFont(size=12))
        self.lbl_version.pack(side="left", padx=(12, 4), pady=8)

        # Charger la liste des versions disponibles
        registry = load_books_metadata()
        active_bibles = [name for name, meta in registry.items() if meta.get("type", "Bible") == "Bible" and meta.get("active", False)]
        all_bibles = [name for name, meta in registry.items() if meta.get("type", "Bible") == "Bible"]

        self.version_options = []
        if self.current_bible:
            self.version_options.append(f"Courante ({self.current_bible})")
        self.version_options.append("Toutes les versions actives")
        self.version_options.append("Toutes les versions installées")
        self.version_options.extend(sorted(all_bibles))

        self.version_var = ctk.StringVar(value=self.version_options[0])
        self.version_menu = ctk.CTkOptionMenu(
            self.filters_frame,
            variable=self.version_var,
            values=self.version_options,
            width=180,
            font=ctk.CTkFont(size=12),
            command=lambda _: self.launch_search()
        )
        self.version_menu.pack(side="left", padx=(0, 12), pady=8)

        # 2. Filtre Corpus Canonique
        self.lbl_corpus = ctk.CTkLabel(self.filters_frame, text="Corpus :", font=ctk.CTkFont(size=12))
        self.lbl_corpus.pack(side="left", padx=(4, 4), pady=8)

        self.corpus_labels = [label for key, (label, _) in CORPUS_DEFINITIONS.items()]
        self.corpus_key_map = {label: key for key, (label, _) in CORPUS_DEFINITIONS.items()}

        self.corpus_var = ctk.StringVar(value=self.corpus_labels[0])  # Toute la Bible
        self.corpus_menu = ctk.CTkOptionMenu(
            self.filters_frame,
            variable=self.corpus_var,
            values=self.corpus_labels,
            width=210,
            font=ctk.CTkFont(size=12),
            command=lambda _: self.launch_search()
        )
        self.corpus_menu.pack(side="left", padx=(0, 12), pady=8)

        # 3. Filtre Mode de Correspondance
        self.lbl_mode = ctk.CTkLabel(self.filters_frame, text="Mode :", font=ctk.CTkFont(size=12))
        self.lbl_mode.pack(side="left", padx=(4, 4), pady=8)

        self.modes_map = {
            "Tous les mots (ET)": "ALL_WORDS",
            "Phrase exacte (\"...\")": "EXACT_PHRASE",
            "Au moins un mot (OU)": "ANY_WORD"
        }
        self.mode_var = ctk.StringVar(value="Tous les mots (ET)")
        self.mode_menu = ctk.CTkOptionMenu(
            self.filters_frame,
            variable=self.mode_var,
            values=list(self.modes_map.keys()),
            width=170,
            font=ctk.CTkFont(size=12),
            command=lambda _: self.launch_search()
        )
        self.mode_menu.pack(side="left", padx=(0, 12), pady=8)

    def _build_results_area(self):
        # Barre d'état des résultats
        self.status_frame = ctk.CTkFrame(self, fg_color="transparent")
        self.status_frame.grid(row=3, column=0, sticky="ew", padx=20, pady=(0, 4))
        self.status_frame.grid_columnconfigure(0, weight=1)

        self.lbl_results_count = ctk.CTkLabel(
            self.status_frame,
            text="Saisissez un mot ou une phrase et appuyez sur Entrée pour rechercher.",
            font=ctk.CTkFont(size=12, slant="italic"),
            text_color=("#64748B", "#94A3B8"),
            anchor="w"
        )
        self.lbl_results_count.grid(row=0, column=0, sticky="w")

        self.btn_copy_all = ctk.CTkButton(
            self.status_frame,
            text="📋 Tout copier",
            width=110,
            height=26,
            font=ctk.CTkFont(size=11, weight="bold"),
            fg_color=("#E2E8F0", "#334155"),
            hover_color=("#CBD5E1", "#475569"),
            text_color=("#0F172A", "#F8FAFC"),
            command=self.copy_all_results
        )
        self.btn_copy_all.grid(row=0, column=1, sticky="e")
        self.btn_copy_all.grid_remove()

        # Zone scrollable des résultats
        self.results_scroll = ctk.CTkScrollableFrame(self, fg_color="transparent")
        self.results_scroll.grid(row=4, column=0, sticky="nsew", padx=20, pady=(4, 15))
        self.grid_rowconfigure(4, weight=1)

        self._show_empty_welcome_state()

    def _show_empty_welcome_state(self):
        for child in self.results_scroll.winfo_children():
            child.destroy()

        welcome_frame = ctk.CTkFrame(self.results_scroll, fg_color="transparent")
        welcome_frame.pack(fill="both", expand=True, pady=40)

        lbl_icon = ctk.CTkLabel(welcome_frame, text="📖 🔍", font=ctk.CTkFont(size=36))
        lbl_icon.pack(pady=(0, 10))

        lbl_text = ctk.CTkLabel(
            welcome_frame,
            text="Moteur de recherche biblique & théologique instantané",
            font=ctk.CTkFont(size=16, weight="bold")
        )
        lbl_text.pack(pady=(0, 5))

        lbl_sub = ctk.CTkLabel(
            welcome_frame,
            text="• Tapez un mot-clé (ex: grâce, foi, amour)\n"
                 "• Tapez une phrase exacte (ex: \"Dieu a tant aimé le monde\")\n"
                 "• Tapez une référence biblique (ex: Jean 3:16, Rom 8:28)\n"
                 "• Tapez un code Strong (ex: G26, H1254)",
            font=ctk.CTkFont(size=13),
            text_color=("#64748B", "#94A3B8"),
            justify="left"
        )
        lbl_sub.pack(pady=(10, 0))

    def _on_scope_changed(self):
        scope = self.scope_var.get()
        if scope == "bible":
            self.filters_frame.grid()
        elif scope == "all":
            self.filters_frame.grid()
        else:
            self.filters_frame.grid_remove()

        if self.search_var.get().strip():
            self.launch_search()

    def _on_key_release_debounce(self, event):
        if event.keysym in ("Return", "Escape", "Up", "Down", "Left", "Right"):
            return

    def _on_escape(self):
        if self.close_callback:
            self.close_callback()

    def clear_search(self):
        self.search_var.set("")
        self.btn_copy_all.grid_remove()
        self._show_empty_welcome_state()
        self.lbl_results_count.configure(text="Saisissez un mot ou une phrase et appuyez sur Entrée pour rechercher.")
        self.search_entry.focus()

    def focus_search(self):
        self.search_entry.focus()
        self.search_entry.select_range(0, 'end')

    def set_query_and_search(self, query: str):
        self.search_var.set(query)
        self.launch_search()

    def launch_search(self):
        query = self.search_var.get().strip()
        if not query:
            return

        scope = self.scope_var.get()
        version_choice = self.version_var.get()
        corpus_choice = self.corpus_var.get()
        mode_choice = self.modes_map.get(self.mode_var.get(), "ALL_WORDS")
        corpus_key = self.corpus_key_map.get(corpus_choice, "ALL")

        # Résoudre les versions
        versions = None
        registry = load_books_metadata()
        active_bibles = [name for name, meta in registry.items() if meta.get("type", "Bible") == "Bible" and meta.get("active", False)]
        
        if version_choice.startswith("Courante"):
            versions = [self.current_bible]
        elif version_choice == "Toutes les versions actives":
            versions = active_bibles
        elif version_choice == "Toutes les versions installées":
            versions = None
        else:
            versions = [version_choice]

        # Détection de référence directe (ex: Jean 3:16)
        from core.reference_parser import normalize_reference
        norm_ref = normalize_reference(query)
        if norm_ref and re.match(r'^([1-3]?\s*[A-Za-zÀ-ÖØ-öø-ÿ]+)\s+(\d+)(?::(\d+))?$', norm_ref.strip()):
            m = re.match(r'^([1-3]?\s*[A-Za-zÀ-ÖØ-öø-ÿ]+)\s+(\d+)(?::(\d+))?$', norm_ref.strip())
            from gui.center_panel import FRENCH_TO_CODE
            b_name = m.group(1).strip()
            ch_num = int(m.group(2))
            v_num = int(m.group(3)) if m.group(3) else None
            
            # Normalisation du nom français
            resolved_code = None
            for fr_n, c in FRENCH_TO_CODE.items():
                if strip_accents(fr_n.lower()) == strip_accents(b_name.lower()):
                    resolved_code = c
                    break

            if resolved_code and self.on_navigate:
                self.on_navigate(resolved_code, ch_num, v_num)
                if self.close_callback:
                    self.close_callback()
                return

        # Lancer la recherche en thread asynchrone
        self._is_searching = True
        self.btn_search.configure(state="disabled", text="Recherche...")
        self.lbl_results_count.configure(text="Recherche en cours...")

        def _worker():
            try:
                start_t = time.time()
                if scope == "bible":
                    results = self.search_engine.search_bibles(
                        query=query,
                        versions=versions,
                        corpus=corpus_key,
                        match_mode=mode_choice,
                        limit=500
                    )
                    elapsed_ms = int((time.time() - start_t) * 1000)
                    self._result_queue.put(("bible", query, results, elapsed_ms))
                elif scope == "commentaries":
                    results = self.search_engine.search_commentaries(
                        query=query,
                        match_mode=mode_choice,
                        limit=200
                    )
                    elapsed_ms = int((time.time() - start_t) * 1000)
                    self._result_queue.put(("commentaries", query, results, elapsed_ms))
                elif scope == "dictionaries":
                    results = self.search_engine.search_dictionaries(query=query, limit=100)
                    elapsed_ms = int((time.time() - start_t) * 1000)
                    self._result_queue.put(("dictionaries", query, results, elapsed_ms))
                else:  # "all" - Toute la bibliothèque
                    global_res = self.search_engine.search_global_library(
                        query=query,
                        active_versions=versions,
                        limit_bibles=100,
                        limit_commentaries=50,
                        limit_dictionaries=30
                    )
                    elapsed_ms = int((time.time() - start_t) * 1000)
                    self._result_queue.put(("all", query, global_res, elapsed_ms))
            except Exception as e:
                print(f"[SearchTab] Erreur recherche: {e}")
                self._result_queue.put(("bible", query, [], 0))

        self._active_search_thread = threading.Thread(target=_worker, daemon=True)
        self._active_search_thread.start()

    def _display_bible_results(self, query: str, results: List[Dict[str, Any]], elapsed_ms: int):
        self._is_searching = False
        self.btn_search.configure(state="normal", text="Rechercher")
        self._last_results = results

        for child in self.results_scroll.winfo_children():
            child.destroy()

        if not results:
            self.lbl_results_count.configure(
                text=f"Aucun verset trouvé pour « {query} » ({elapsed_ms} ms)."
            )
            self.btn_copy_all.grid_remove()
            self._show_no_results(query)
            return

        total_verses = len(results)
        self.lbl_results_count.configure(
            text=f"📊 {total_verses} verset{'s' if total_verses > 1 else ''} trouvé{'s' if total_verses > 1 else ''} en {elapsed_ms} ms pour « {query} »"
        )
        self.btn_copy_all.grid()

        # Construction des cartes de résultats (Multi-versions séquentielles)
        search_words = [w for w in re.findall(r'[\w]+', query) if len(w) > 1]

        for item in results:
            self._render_bible_verse_card(item, search_words)

    def _render_bible_verse_card(self, item: Dict[str, Any], search_words: List[str]):
        is_dark = (ctk.get_appearance_mode() == "Dark")
        card_bg = "#1E293B" if is_dark else "#FFFFFF"
        border_col = "#334155" if is_dark else "#E2E8F0"

        card = ctk.CTkFrame(
            self.results_scroll,
            fg_color=card_bg,
            border_width=1,
            border_color=border_col,
            corner_radius=8
        )
        card.pack(fill="x", expand=True, pady=4, padx=2)

        # En-tête de la carte : [Nom de la version] [Référence biblique] + Boutons d'action
        header = ctk.CTkFrame(card, fg_color="transparent")
        header.pack(fill="x", padx=12, pady=(10, 4))

        # Badge Version (Couleur distinctive)
        v_name = item.get("version_name", "Bible")
        v_badge = ctk.CTkLabel(
            header,
            text=f" {v_name} ",
            font=ctk.CTkFont(size=11, weight="bold"),
            fg_color=("#E0E7FF", "#312E81"),
            text_color=("#3730A3", "#C7D2FE"),
            corner_radius=4
        )
        v_badge.pack(side="left", padx=(0, 8))

        # Référence Biblique
        ref_text = item.get("reference", "")
        lbl_ref = ctk.CTkLabel(
            header,
            text=f"📖 {ref_text}",
            font=ctk.CTkFont(size=13, weight="bold"),
            text_color=("#0F172A", "#F8FAFC")
        )
        lbl_ref.pack(side="left")

        # Bouton Copier
        btn_copy = ctk.CTkButton(
            header,
            text="📋 Copier",
            width=70,
            height=24,
            font=ctk.CTkFont(size=11),
            fg_color=("#E2E8F0", "#334155"),
            hover_color=("#CBD5E1", "#475569"),
            text_color=("#0F172A", "#F8FAFC"),
            corner_radius=4,
            command=lambda: self.copy_verse_to_clipboard(item)
        )
        btn_copy.pack(side="right", padx=(4, 0))

        # Bouton Ouvrir dans le lecteur
        btn_open = ctk.CTkButton(
            header,
            text="👉 Ouvrir le verset",
            width=110,
            height=24,
            font=ctk.CTkFont(size=11, weight="bold"),
            fg_color=("#2563EB", "#1D4ED8"),
            hover_color=("#1D4ED8", "#1E40AF"),
            text_color="#FFFFFF",
            corner_radius=4,
            command=lambda: self._navigate_to_verse(item)
        )
        btn_open.pack(side="right", padx=4)

        # Corps du verset avec surbrillance
        raw_text = item.get("text", "")
        v_text = re.sub(r'<[^>]+>', '', raw_text).strip()
        text_box = tk.Text(
            card,
            wrap="word",
            font=("Georgia", 11),
            bg=card_bg,
            fg="#F1F5F9" if is_dark else "#0F172A",
            relief="flat",
            borderwidth=0,
            highlightthickness=0,
            padx=12,
            pady=6,
            height=self._estimate_text_height(v_text)
        )
        text_box.pack(fill="x", expand=True, padx=4, pady=(0, 8))
        text_box.insert("1.0", v_text)

        # Appliquer la surbrillance sur les termes trouvés
        highlight_bg = "#FEF08A" if not is_dark else "#854D0E"
        highlight_fg = "#713F12" if not is_dark else "#FEF9C3"
        text_box.tag_config("highlight", background=highlight_bg, foreground=highlight_fg, font=("Georgia", 11, "bold"))

        for w in search_words:
            self._highlight_pattern(text_box, w, "highlight")

        text_box.configure(state="disabled")

    def _estimate_text_height(self, text: str) -> int:
        lines = max(1, len(text) // 90 + text.count('\n') + 1)
        return min(lines, 8)

    def _highlight_pattern(self, text_widget: tk.Text, word: str, tag: str):
        if not word:
            return
        # Recherche insensible aux accents et à la casse
        text_content = text_widget.get("1.0", "end-1c")
        norm_content = strip_accents(text_content).lower()
        norm_word = strip_accents(word).lower()

        start = 0
        while True:
            idx = norm_content.find(norm_word, start)
            if idx == -1:
                break
            start_pos = f"1.0 + {idx} chars"
            end_pos = f"1.0 + {idx + len(norm_word)} chars"
            text_widget.tag_add(tag, start_pos, end_pos)
            start = idx + len(norm_word)

    def _display_commentary_results(self, query: str, results: List[Dict[str, Any]], elapsed_ms: int):
        self._is_searching = False
        self.btn_search.configure(state="normal", text="Rechercher")
        self._last_results = results

        for child in self.results_scroll.winfo_children():
            child.destroy()

        if not results:
            self.lbl_results_count.configure(text=f"Aucun commentaire trouvé pour « {query} » ({elapsed_ms} ms).")
            self.btn_copy_all.grid_remove()
            self._show_no_results(query)
            return

        total = len(results)
        self.lbl_results_count.configure(
            text=f"💬 {total} commentaire{'s' if total > 1 else ''} trouvé{'s' if total > 1 else ''} en {elapsed_ms} ms pour « {query} »"
        )
        self.btn_copy_all.grid()

        search_words = [w for w in re.findall(r'[\w]+', query) if len(w) > 1]
        is_dark = (ctk.get_appearance_mode() == "Dark")

        for item in results:
            card_bg = "#1E293B" if is_dark else "#FFFFFF"
            card = ctk.CTkFrame(self.results_scroll, fg_color=card_bg, border_width=1, border_color=("#334155" if is_dark else "#E2E8F0"), corner_radius=8)
            card.pack(fill="x", expand=True, pady=4, padx=2)

            header = ctk.CTkFrame(card, fg_color="transparent")
            header.pack(fill="x", padx=12, pady=(10, 4))

            # Auteur
            c_author = item.get("author", "Commentaire")
            lbl_auth = ctk.CTkLabel(header, text=f"💬 {c_author}", font=ctk.CTkFont(size=12, weight="bold"), text_color=("#7C3AED", "#A78BFA"))
            lbl_auth.pack(side="left", padx=(0, 10))

            # Référence
            ref = item.get("reference", "")
            lbl_r = ctk.CTkLabel(header, text=ref, font=ctk.CTkFont(size=12, weight="bold"))
            lbl_r.pack(side="left")

            btn_open = ctk.CTkButton(
                header,
                text="👉 Ouvrir le passage",
                width=120,
                height=24,
                font=ctk.CTkFont(size=11, weight="bold"),
                command=lambda it=item: self._navigate_to_verse(it)
            )
            btn_open.pack(side="right")

            # Texte
            txt_clean = re.sub(r'<[^>]+>', '', item.get("text", ""))
            snippet = txt_clean[:400] + ("..." if len(txt_clean) > 400 else "")
            
            tb = tk.Text(card, wrap="word", font=("Segoe UI", 10), bg=card_bg, fg="#F1F5F9" if is_dark else "#0F172A", relief="flat", borderwidth=0, padx=12, pady=6, height=min(6, len(snippet)//80 + 2))
            tb.pack(fill="x", expand=True, padx=4, pady=(0, 8))
            tb.insert("1.0", snippet)
            tb.tag_config("highlight", background="#FEF08A" if not is_dark else "#854D0E", foreground="#713F12" if not is_dark else "#FEF9C3", font=("Segoe UI", 10, "bold"))
            for w in search_words:
                self._highlight_pattern(tb, w, "highlight")
            tb.configure(state="disabled")

    def _display_dictionary_results(self, query: str, results: List[Dict[str, Any]], elapsed_ms: int):
        self._is_searching = False
        self.btn_search.configure(state="normal", text="Rechercher")
        self._last_results = results

        for child in self.results_scroll.winfo_children():
            child.destroy()

        if not results:
            self.lbl_results_count.configure(text=f"Aucune entrée de dictionnaire trouvée pour « {query} » ({elapsed_ms} ms).")
            self.btn_copy_all.grid_remove()
            self._show_no_results(query)
            return

        total = len(results)
        self.lbl_results_count.configure(
            text=f"📚 {total} article{'s' if total > 1 else ''} de dictionnaire trouvé{'s' if total > 1 else ''} en {elapsed_ms} ms pour « {query} »"
        )
        self.btn_copy_all.grid_remove()

        is_dark = (ctk.get_appearance_mode() == "Dark")
        for item in results:
            card_bg = "#1E293B" if is_dark else "#FFFFFF"
            card = ctk.CTkFrame(self.results_scroll, fg_color=card_bg, border_width=1, border_color=("#334155" if is_dark else "#E2E8F0"), corner_radius=8)
            card.pack(fill="x", expand=True, pady=4, padx=2)

            header = ctk.CTkFrame(card, fg_color="transparent")
            header.pack(fill="x", padx=12, pady=(10, 4))

            dict_badge = ctk.CTkLabel(header, text=f" {item.get('dict_name', 'Dictionnaire')} ", font=ctk.CTkFont(size=11, weight="bold"), fg_color=("#FEF3C7", "#78350F"), text_color=("#92400E", "#FDE68A"), corner_radius=4)
            dict_badge.pack(side="left", padx=(0, 8))

            lbl_term = ctk.CTkLabel(header, text=item.get("term", ""), font=ctk.CTkFont(size=13, weight="bold"))
            lbl_term.pack(side="left")

            defi = item.get("definition", "")
            snippet = defi[:350] + ("..." if len(defi) > 350 else "")
            tb = tk.Text(card, wrap="word", font=("Segoe UI", 10), bg=card_bg, fg="#F1F5F9" if is_dark else "#0F172A", relief="flat", borderwidth=0, padx=12, pady=6, height=min(5, len(snippet)//80 + 2))
            tb.pack(fill="x", expand=True, padx=4, pady=(0, 8))
            tb.insert("1.0", snippet)
            tb.configure(state="disabled")

    def _display_global_results(self, query: str, global_res: Dict[str, Any], elapsed_ms: int):
        self._is_searching = False
        self.btn_search.configure(state="normal", text="Rechercher")
        self._global_results = global_res

        for child in self.results_scroll.winfo_children():
            child.destroy()

        total = global_res.get("total_count", 0)
        bibles = global_res.get("bibles", [])
        commentaries = global_res.get("commentaries", [])
        dictionaries = global_res.get("dictionaries", [])

        if total == 0:
            self.lbl_results_count.configure(text=f"Aucun résultat dans la bibliothèque pour « {query} » ({elapsed_ms} ms).")
            self.btn_copy_all.grid_remove()
            self._show_no_results(query)
            return

        self.lbl_results_count.configure(
            text=f"🌐 {total} résultats trouvés en {elapsed_ms} ms (Bibles: {len(bibles)}, Commentaires: {len(commentaries)}, Dictionnaires: {len(dictionaries)})"
        )
        self.btn_copy_all.grid()

        search_words = [w for w in re.findall(r'[\w]+', query) if len(w) > 1]

        # 1. Section Bibles
        if bibles:
            sec_bibles = ctk.CTkLabel(self.results_scroll, text=f"📖 Versets Bibliques ({len(bibles)})", font=ctk.CTkFont(size=14, weight="bold"), anchor="w")
            sec_bibles.pack(fill="x", pady=(10, 4))
            for item in bibles[:20]:
                self._render_bible_verse_card(item, search_words)

        # 2. Section Commentaires
        if commentaries:
            sec_comm = ctk.CTkLabel(self.results_scroll, text=f"💬 Commentaires des Pères & Théologiens ({len(commentaries)})", font=ctk.CTkFont(size=14, weight="bold"), anchor="w")
            sec_comm.pack(fill="x", pady=(15, 4))
            is_dark = (ctk.get_appearance_mode() == "Dark")
            for item in commentaries[:15]:
                card_bg = "#1E293B" if is_dark else "#FFFFFF"
                card = ctk.CTkFrame(self.results_scroll, fg_color=card_bg, border_width=1, border_color=("#334155" if is_dark else "#E2E8F0"), corner_radius=8)
                card.pack(fill="x", expand=True, pady=4, padx=2)

                header = ctk.CTkFrame(card, fg_color="transparent")
                header.pack(fill="x", padx=12, pady=(8, 2))
                lbl_auth = ctk.CTkLabel(header, text=f"💬 {item.get('author', '')} • {item.get('reference', '')}", font=ctk.CTkFont(size=12, weight="bold"))
                lbl_auth.pack(side="left")

                btn_open = ctk.CTkButton(header, text="👉 Ouvrir", width=80, height=22, font=ctk.CTkFont(size=11), command=lambda it=item: self._navigate_to_verse(it))
                btn_open.pack(side="right")

                txt_clean = re.sub(r'<[^>]+>', '', item.get("text", ""))
                snippet = txt_clean[:250] + "..."
                tb = tk.Text(card, wrap="word", font=("Segoe UI", 10), bg=card_bg, fg="#F1F5F9" if is_dark else "#0F172A", relief="flat", borderwidth=0, padx=12, pady=4, height=3)
                tb.pack(fill="x", padx=4, pady=(0, 6))
                tb.insert("1.0", snippet)
                tb.configure(state="disabled")

        # 3. Section Dictionnaires
        if dictionaries:
            sec_dict = ctk.CTkLabel(self.results_scroll, text=f"📚 Dictionnaires & Lexiques ({len(dictionaries)})", font=ctk.CTkFont(size=14, weight="bold"), anchor="w")
            sec_dict.pack(fill="x", pady=(15, 4))
            is_dark = (ctk.get_appearance_mode() == "Dark")
            for item in dictionaries[:10]:
                card_bg = "#1E293B" if is_dark else "#FFFFFF"
                card = ctk.CTkFrame(self.results_scroll, fg_color=card_bg, border_width=1, border_color=("#334155" if is_dark else "#E2E8F0"), corner_radius=8)
                card.pack(fill="x", expand=True, pady=4, padx=2)

                header = ctk.CTkFrame(card, fg_color="transparent")
                header.pack(fill="x", padx=12, pady=(8, 2))
                lbl_t = ctk.CTkLabel(header, text=f"📚 {item.get('term', '')} ({item.get('dict_name', '')})", font=ctk.CTkFont(size=12, weight="bold"))
                lbl_t.pack(side="left")

                defi = item.get("definition", "")[:200] + "..."
                tb = tk.Text(card, wrap="word", font=("Segoe UI", 10), bg=card_bg, fg="#F1F5F9" if is_dark else "#0F172A", relief="flat", borderwidth=0, padx=12, pady=4, height=3)
                tb.pack(fill="x", padx=4, pady=(0, 6))
                tb.insert("1.0", defi)
                tb.configure(state="disabled")

    def _show_no_results(self, query: str):
        frame = ctk.CTkFrame(self.results_scroll, fg_color="transparent")
        frame.pack(fill="both", expand=True, pady=40)

        lbl_icon = ctk.CTkLabel(frame, text="🔍 ❌", font=ctk.CTkFont(size=32))
        lbl_icon.pack(pady=(0, 10))

        lbl_msg = ctk.CTkLabel(
            frame,
            text=f"Aucun résultat trouvé pour « {query} »",
            font=ctk.CTkFont(size=15, weight="bold")
        )
        lbl_msg.pack(pady=(0, 5))

        lbl_tips = ctk.CTkLabel(
            frame,
            text="Conseils pour améliorer la recherche :\n"
                 "• Vérifiez l'orthographe des mots\n"
                 "• Essayez avec des synonymes ou des mots plus généraux\n"
                 "• Élargissez le corpus (ex: sélectionnez « Toute la Bible »)\n"
                 "• Changez le mode de correspondance sur « Au moins un mot (OU) »",
            font=ctk.CTkFont(size=12),
            text_color=("#64748B", "#94A3B8"),
            justify="left"
        )
        lbl_tips.pack(pady=(10, 0))

    def _navigate_to_verse(self, item: Dict[str, Any]):
        book_code = item.get("book_code")
        chapter = item.get("chapter", 1)
        verse = item.get("verse")

        if not book_code:
            return

        if self.on_navigate:
            self.on_navigate(book_code, int(chapter), int(verse) if verse else None)

    def copy_verse_to_clipboard(self, item: Dict[str, Any]):
        ref = item.get("reference", "")
        v_name = item.get("version_name", "")
        raw_text = item.get("text", "")
        clean_text = re.sub(r'<[^>]+>', '', raw_text).strip()
        formatted = f"{clean_text}\n— {ref} ({v_name})"

        self.clipboard_clear()
        self.clipboard_append(formatted)

    def copy_all_results(self):
        if not self._last_results and not self._global_results:
            return

        lines = []
        if self._last_results:
            for item in self._last_results:
                ref = item.get("reference", "")
                v_name = item.get("version_name") or item.get("author") or ""
                clean_text = re.sub(r'<[^>]+>', '', item.get("text", "")).strip()
                lines.append(f"[{v_name}] {ref} : {clean_text}")
        elif self._global_results:
            for b in self._global_results.get("bibles", []):
                clean_t = re.sub(r'<[^>]+>', '', b.get("text", "")).strip()
                lines.append(f"[{b.get('version_name')}] {b.get('reference')} : {clean_t}")
            for c in self._global_results.get("commentaries", []):
                clean_c = re.sub(r'<[^>]+>', '', c.get("text", "")).strip()
                lines.append(f"💬 [{c.get('author')}] {c.get('reference')} : {clean_c[:200]}...")
            for d in self._global_results.get("dictionaries", []):
                clean_d = re.sub(r'<[^>]+>', '', d.get("definition", "")).strip()
                lines.append(f"📚 {d.get('term')} ({d.get('dict_name')}) : {clean_d[:200]}...")

        full_text = "\n\n".join(lines)
        self.clipboard_clear()
        self.clipboard_append(full_text)
