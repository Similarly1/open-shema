import customtkinter as ctk
import shutil
import os
from tkinter import messagebox
from gui import native_dialog as filedialog
from core.config import load_config, save_config
from core.dictionary_manager import DictionaryManager

FONTS_PRESETS = [
    ("Georgia (Serif - Classique)", "Georgia"),
    ("Palatino Linotype (Serif - Édition)", "Palatino Linotype"),
    ("Segoe UI (Sans-serif - Moderne)", "Segoe UI"),
    ("Calibri (Sans-serif - Épurée)", "Calibri"),
]
DISPLAY_TO_FONT = {p[0]: p[1] for p in FONTS_PRESETS}
FONT_TO_DISPLAY = {p[1]: p[0] for p in FONTS_PRESETS}

THEMES_PRESETS = [
    ("Sombre (Dark)", "dark"),
    ("Clair (Light)", "light"),
    ("Système", "system"),
]
DISPLAY_TO_THEME = {t[0]: t[1] for t in THEMES_PRESETS}
THEME_TO_DISPLAY = {t[1]: t[0] for t in THEMES_PRESETS}

class SettingsTab(ctk.CTkScrollableFrame):
    def __init__(self, master, close_callback=None, on_save_callback=None, **kwargs):
        super().__init__(master, **kwargs)
        self.close_callback = close_callback
        self.on_save_callback = on_save_callback
        self.config = load_config()
        
        # Titre Principal
        self.title_label = ctk.CTkLabel(self, text="Paramètres de l'Application", font=ctk.CTkFont(size=20, weight="bold"))
        self.title_label.pack(pady=(10, 15))
        
        # ==========================================
        # 1. APPARENCE & TYPOGRAPHIE
        # ==========================================
        self.sect_apparence = ctk.CTkLabel(self, text="🎨 Apparence & Typographie", font=ctk.CTkFont(size=14, weight="bold"), text_color="#3B82F6")
        self.sect_apparence.pack(anchor="w", padx=20, pady=(10, 5))
        
        # Thème (Sombre / Clair / Système)
        self.theme_label = ctk.CTkLabel(self, text="Thème de l'interface :")
        self.theme_label.pack(anchor="w", padx=20, pady=(4, 0))
        
        current_theme_val = self.config.get("theme", "dark")
        current_theme_disp = THEME_TO_DISPLAY.get(current_theme_val, "Sombre (Dark)")
        self.theme_var = ctk.StringVar(value=current_theme_disp)
        self.theme_menu = ctk.CTkOptionMenu(
            self,
            variable=self.theme_var,
            values=[t[0] for t in THEMES_PRESETS],
            command=self.on_theme_preview
        )
        self.theme_menu.pack(fill="x", padx=20, pady=5)
        
        # Police de lecture (2 Serif + 2 Sans-Serif)
        self.font_label = ctk.CTkLabel(self, text="Police de lecture (Texte Biblique) :")
        self.font_label.pack(anchor="w", padx=20, pady=(6, 0))
        
        current_font_val = self.config.get("font_family", "Georgia")
        current_font_disp = FONT_TO_DISPLAY.get(current_font_val, "Georgia (Serif - Classique)")
        self.font_var = ctk.StringVar(value=current_font_disp)
        self.font_menu = ctk.CTkOptionMenu(
            self,
            variable=self.font_var,
            values=[p[0] for p in FONTS_PRESETS]
        )
        self.font_menu.pack(fill="x", padx=20, pady=5)
        
        # Taille de police
        self.font_size_label = ctk.CTkLabel(self, text=f"Taille de police : {self.config.get('font_size', 18)} pt")
        self.font_size_label.pack(anchor="w", padx=20, pady=(6, 0))
        
        self.font_size_var = ctk.IntVar(value=self.config.get("font_size", 18))
        self.font_size_slider = ctk.CTkSlider(
            self, 
            from_=12, 
            to=32, 
            number_of_steps=20,
            variable=self.font_size_var,
            command=self.on_font_size_change
        )
        self.font_size_slider.pack(fill="x", padx=20, pady=5)
        
        # Interligne (Line Spacing)
        self.line_spacing_label = ctk.CTkLabel(self, text=f"Interligne : {self.config.get('line_spacing', 6)} px")
        self.line_spacing_label.pack(anchor="w", padx=20, pady=(6, 0))
        
        self.line_spacing_var = ctk.IntVar(value=self.config.get("line_spacing", 6))
        self.line_spacing_slider = ctk.CTkSlider(
            self,
            from_=0,
            to=20,
            number_of_steps=20,
            variable=self.line_spacing_var,
            command=lambda v: self.line_spacing_label.configure(text=f"Interligne : {int(v)} px")
        )
        self.line_spacing_slider.pack(fill="x", padx=20, pady=5)
        
        # Espacement des mots & colonnes (Word Spacing)
        self.word_spacing_label = ctk.CTkLabel(self, text=f"Espacement des mots / colonnes : {self.config.get('word_spacing', 3)} px")
        self.word_spacing_label.pack(anchor="w", padx=20, pady=(6, 0))
        
        self.word_spacing_var = ctk.IntVar(value=self.config.get("word_spacing", 3))
        self.word_spacing_slider = ctk.CTkSlider(
            self,
            from_=1,
            to=10,
            number_of_steps=9,
            variable=self.word_spacing_var,
            command=lambda v: self.word_spacing_label.configure(text=f"Espacement des mots / colonnes : {int(v)} px")
        )
        self.word_spacing_slider.pack(fill="x", padx=20, pady=5)
        
        # ==========================================
        # 2. OPTIONS DE LECTURE & COMPARAISON
        # ==========================================
        self.sect_lecture = ctk.CTkLabel(self, text="📖 Options Bibliques & Comparaison", font=ctk.CTkFont(size=14, weight="bold"), text_color="#3B82F6")
        self.sect_lecture.pack(anchor="w", padx=20, pady=(15, 5))
        
        self.show_diff_pct_var = ctk.BooleanVar(value=self.config.get("show_diff_percentage", True))
        self.show_diff_pct_cb = ctk.CTkCheckBox(self, text="Afficher le pourcentage de différence", variable=self.show_diff_pct_var)
        self.show_diff_pct_cb.pack(anchor="w", padx=30, pady=4)
        
        self.show_diff_colors_var = ctk.BooleanVar(value=self.config.get("show_diff_highlights", True))
        self.show_diff_colors_cb = ctk.CTkCheckBox(self, text="Surligner/Colorer les différences textuelles", variable=self.show_diff_colors_var)
        self.show_diff_colors_cb.pack(anchor="w", padx=30, pady=4)
        
        # Sous-section Interlinéaire Inversé (style Logos)
        self.sect_interlinear = ctk.CTkLabel(self, text="🔬 Couches de l'Interlinéaire Inversé :", font=ctk.CTkFont(size=12, weight="bold"))
        self.sect_interlinear.pack(anchor="w", padx=25, pady=(10, 4))
        
        self.inter_surf_var = ctk.BooleanVar(value=self.config.get("interlinear_show_surface", True))
        self.inter_surf_cb = ctk.CTkCheckBox(self, text="Texte de surface (Français)", variable=self.inter_surf_var)
        self.inter_surf_cb.pack(anchor="w", padx=40, pady=3)
        
        self.inter_lem_var = ctk.BooleanVar(value=self.config.get("interlinear_show_lemma", True))
        self.inter_lem_cb = ctk.CTkCheckBox(self, text="Lemme original (Hébreu / Grec)", variable=self.inter_lem_var)
        self.inter_lem_cb.pack(anchor="w", padx=40, pady=3)
        
        self.inter_tr_var = ctk.BooleanVar(value=self.config.get("interlinear_show_translit", True))
        self.inter_tr_cb = ctk.CTkCheckBox(self, text="Translittération phonétique", variable=self.inter_tr_var)
        self.inter_tr_cb.pack(anchor="w", padx=40, pady=3)
        
        self.inter_str_var = ctk.BooleanVar(value=self.config.get("interlinear_show_strong", True))
        self.inter_str_cb = ctk.CTkCheckBox(self, text="Numéro Strong (H... / G...)", variable=self.inter_str_var)
        self.inter_str_cb.pack(anchor="w", padx=40, pady=3)
        
        # Sélection de la Bible de référence (Style Logos)
        self.ref_bible_label = ctk.CTkLabel(self, text="Bible de référence par défaut :")
        self.ref_bible_label.pack(anchor="w", padx=20, pady=(8, 0))
        
        from gui.library_utils import load_books_metadata
        from gui.bible_picker_popover import BiblePickerPopover, BIBLE_STYLE_MAP
        registry = load_books_metadata()
        available_bibles = [name for name, meta in registry.items() if meta.get("type") == "Bible"]
        if not available_bibles:
            available_bibles = ["Aucune Bible disponible"]
            
        default_ref = self.config.get("reference_bible", "")
        if default_ref not in available_bibles:
            default_ref = available_bibles[0]
            
        self.ref_bible_var = ctk.StringVar(value=default_ref)
        self.settings_bible_popover = BiblePickerPopover(self, on_select_callback=self.on_settings_ref_bible_selected)
        
        self.btn_settings_ref_bible = ctk.CTkButton(
            self,
            text=f"📖 {self.get_settings_bible_label(self.ref_bible_var.get())}  ▾",
            command=self.open_settings_bible_picker,
            height=34,
            font=ctk.CTkFont(size=12, weight="bold"),
            fg_color=("#F1F5F9", "#1E293B"),
            hover_color=("#E2E8F0", "#334155"),
            text_color=("#0F172A", "#F8FAFC"),
            border_width=1,
            border_color=("#CBD5E1", "#475569"),
            corner_radius=8,
            anchor="w"
        )
        self.btn_settings_ref_bible.pack(fill="x", padx=20, pady=5)
        
        # ==========================================
        # 3. DICTIONNAIRES, LEXIQUES & PRIORITÉS
        # ==========================================
        self.sect_dict = ctk.CTkLabel(self, text="📚 Dictionnaires & Priorités de Recherche", font=ctk.CTkFont(size=14, weight="bold"), text_color="#3B82F6")
        self.sect_dict.pack(anchor="w", padx=20, pady=(15, 5))
        
        self.dict_desc = ctk.CTkLabel(
            self, 
            text="Activez les dictionnaires pour le survol et ordonnez leur priorité (le 1er apparaît en tête de l'info-bulle) :",
            font=ctk.CTkFont(size=11),
            text_color=("#64748B", "#94A3B8"),
            wraplength=480,
            justify="left"
        )
        self.dict_desc.pack(anchor="w", padx=20, pady=(0, 6))
        
        self.dict_list_frame = ctk.CTkFrame(self, fg_color=("#F1F5F9", "#1E293B"), corner_radius=8)
        self.dict_list_frame.pack(fill="x", padx=20, pady=5)
        
        self.dict_registry = [dict(d) for d in DictionaryManager.load_registry()]
        self.dict_registry.sort(key=lambda x: x.get("priority", 99))
        self.dict_vars = {}
        
        self.render_dict_list()
        
        # Bouton d'import de dictionnaire
        self.btn_import_dict = ctk.CTkButton(
            self, 
            text="📥 Importer un Dictionnaire (.docx, .json, .csv)", 
            font=ctk.CTkFont(size=12, weight="bold"),
            fg_color="#0284C7",
            hover_color="#0369A1",
            command=self.on_import_dictionary
        )
        self.btn_import_dict.pack(fill="x", padx=20, pady=(6, 12))
        self.sect_ai = ctk.CTkLabel(self, text="🤖 Assistant IA & Clés API", font=ctk.CTkFont(size=14, weight="bold"), text_color="#3B82F6")
        self.sect_ai.pack(anchor="w", padx=20, pady=(15, 5))
        
        # Modèle de Chat
        self.chat_model_label = ctk.CTkLabel(self, text="Modèle de Chat :")
        self.chat_model_label.pack(anchor="w", padx=20, pady=(4, 0))
        self.chat_model_var = ctk.StringVar(value=self.config.get("chat_model", "gemini-3.7-flash"))
        self.chat_model_menu = ctk.CTkOptionMenu(
            self, 
            variable=self.chat_model_var, 
            values=[
                "gemini-3.7-flash",
                "gemini-3.6-flash",
                "gemini-3.5-flash",
                "gemini-3.5-flash-lite",
                "gemini-3.1-flash-lite",
                "gemini-3-flash",
                "gemini-2.5-flash",
                "gemini-2.5-flash-lite",
                "mistral-small-latest",
                "mistral-large-latest"
            ]
        )
        self.chat_model_menu.pack(fill="x", padx=20, pady=5)
        
        self.model_info_lbl = ctk.CTkLabel(
            self, 
            text="💡 Flash (20 req/j) : Haute précision avec bascule automatique | Flash Lite (500 req/j) : Usage intensif", 
            font=ctk.CTkFont(size=11), 
            text_color="gray60"
        )
        self.model_info_lbl.pack(anchor="w", padx=20, pady=(0, 5))
        
        self.api_key_label = ctk.CTkLabel(self, text="Clé API Mistral :")
        self.api_key_label.pack(anchor="w", padx=20, pady=(4, 0))
        self.api_key_entry = ctk.CTkEntry(self, show="*")
        self.api_key_entry.pack(fill="x", padx=20, pady=5)
        if self.config.get("mistral_api_key"):
            self.api_key_entry.insert(0, self.config["mistral_api_key"])
            
        # Clé API Gemini
        self.gemini_key_label = ctk.CTkLabel(self, text="Clé API Gemini :")
        self.gemini_key_label.pack(anchor="w", padx=20, pady=(4, 0))
        self.gemini_key_entry = ctk.CTkEntry(self, show="*")
        self.gemini_key_entry.pack(fill="x", padx=20, pady=5)
        if self.config.get("gemini_api_key"):
            self.gemini_key_entry.insert(0, self.config["gemini_api_key"])
            
        # Token & Product ID Infomaniak AI
        self.infomaniak_token_label = ctk.CTkLabel(self, text="Token API Infomaniak AI (Embeddings / RAG) :")
        self.infomaniak_token_label.pack(anchor="w", padx=20, pady=(4, 0))
        self.infomaniak_token_entry = ctk.CTkEntry(self, show="*")
        self.infomaniak_token_entry.pack(fill="x", padx=20, pady=5)
        if self.config.get("infomaniak_token"):
            self.infomaniak_token_entry.insert(0, self.config["infomaniak_token"])
            
        self.infomaniak_pid_label = ctk.CTkLabel(self, text="Product ID Infomaniak (ex: 251) :")
        self.infomaniak_pid_label.pack(anchor="w", padx=20, pady=(4, 0))
        self.infomaniak_pid_entry = ctk.CTkEntry(self, placeholder_text="251")
        self.infomaniak_pid_entry.pack(fill="x", padx=20, pady=5)
        if self.config.get("infomaniak_product_id"):
            self.infomaniak_pid_entry.insert(0, str(self.config["infomaniak_product_id"]))
            
        # Prompt système de l'assistant
        self.prompt_label = ctk.CTkLabel(self, text="Prompt Système de l'Assistant IA :")
        self.prompt_label.pack(anchor="w", padx=20, pady=(8, 0))
        
        self.prompt_text = ctk.CTkTextbox(self, height=110, font=("Arial", 12))
        self.prompt_text.pack(fill="both", padx=20, pady=5)
        
        default_prompt = (
            "Vous êtes un assistant d'étude biblique théologique et analytique.\n"
            "Votre rôle est d'aider l'utilisateur à analyser et comprendre les textes sacrés et leurs commentaires associés.\n\n"
            "CONSIGNES CRITIQUES :\n"
            "1. Basez TOUJOURS vos réponses UNIQUEMENT sur le contexte fourni (Textes bibliques et Commentaires).\n"
            "2. Vous DEVEZ citer explicitement vos sources d'information à la manière de NotebookLM. Utilisez des références claires sous forme de crochets en gras comme **[Nom du document, Verset]** (ex: **[Chouraqui, Pro 1:1]** ou **[Commentaire Kathleen Nielson, Note 1-7]**) à la fin de vos phrases ou de vos paragraphes pour chaque affirmation basée sur les textes.\n"
            "3. Rédigez vos citations de manière très visible pour que l'utilisateur puisse s'y référer facilement."
        )
        self.prompt_text.insert("0.0", self.config.get("chat_system_prompt", default_prompt))
        
        # Configuration RAG & Reranking Local
        self.sect_rag = ctk.CTkLabel(self, text="🧠 Pipeline RAG & Reranking Local", font=ctk.CTkFont(size=14, weight="bold"), text_color="#3B82F6")
        self.sect_rag.pack(anchor="w", padx=20, pady=(12, 4))
        
        rag_cfg_frame = ctk.CTkFrame(self, fg_color=("#F8FAFC", "#1E293B"), corner_radius=8)
        rag_cfg_frame.pack(fill="x", padx=20, pady=4)
        
        k_row = ctk.CTkFrame(rag_cfg_frame, fg_color="transparent")
        k_row.pack(fill="x", padx=12, pady=6)
        
        lbl_k_raw = ctk.CTkLabel(k_row, text="Extraits bruts (Top-K Initial) :", font=ctk.CTkFont(size=12))
        lbl_k_raw.pack(side="left")
        self.top_k_raw_entry = ctk.CTkEntry(k_row, width=50)
        self.top_k_raw_entry.pack(side="left", padx=(6, 16))
        self.top_k_raw_entry.insert(0, str(self.config.get("rag_top_k_raw", 25)))
        
        lbl_k_final = ctk.CTkLabel(k_row, text="Extraits retenus (Top-K Reranker) :", font=ctk.CTkFont(size=12))
        lbl_k_final.pack(side="left")
        self.top_k_final_entry = ctk.CTkEntry(k_row, width=50)
        self.top_k_final_entry.pack(side="left", padx=(6, 0))
        self.top_k_final_entry.insert(0, str(self.config.get("rag_top_k_final", 7)))
        
        self.curation_var = ctk.BooleanVar(value=self.config.get("rag_enable_curation", False))
        self.curation_switch = ctk.CTkSwitch(
            rag_cfg_frame,
            text="Épuration / Curation automatique du contexte (Étape 3)",
            variable=self.curation_var,
            font=ctk.CTkFont(size=12)
        )
        self.curation_switch.pack(anchor="w", padx=12, pady=(2, 4))
        
        # Sélecteur de modèle curateur
        cur_row = ctk.CTkFrame(rag_cfg_frame, fg_color="transparent")
        cur_row.pack(fill="x", padx=12, pady=(2, 8))
        
        lbl_cur_mod = ctk.CTkLabel(cur_row, text="Modèle Curateur :", font=ctk.CTkFont(size=11))
        lbl_cur_mod.pack(side="left", padx=(0, 6))
        
        self.curation_model_var = ctk.StringVar(value=self.config.get("rag_curation_model", "mistralai/Ministral-3-14B-Instruct-2512"))
        self.curation_model_menu = ctk.CTkOptionMenu(
            cur_row,
            variable=self.curation_model_var,
            values=[
                "mistralai/Ministral-3-14B-Instruct-2512",
                "mistral-small-latest",
                "gemini-3.1-flash-lite",
                "gemini-3.5-flash-lite",
                "Qwen/Qwen3.5-122B-A10B-FP8"
            ],
            height=24,
            font=ctk.CTkFont(size=11)
        )
        self.curation_model_menu.pack(side="right", fill="x", expand=True)
        
        # ==========================================
        # 4. SAUVEGARDE DE LA BASE VECTORIELLE
        # ==========================================
        self.sect_db = ctk.CTkLabel(self, text="💾 Sauvegarde Base Vectorielle", font=ctk.CTkFont(size=14, weight="bold"), text_color="#3B82F6")
        self.sect_db.pack(anchor="w", padx=20, pady=(15, 5))
        
        self.backup_frame = ctk.CTkFrame(self, fg_color="transparent")
        self.backup_frame.pack(fill="x", padx=20, pady=5)
        
        self.export_btn = ctk.CTkButton(self.backup_frame, text="Exporter (ZIP)", command=self.export_db)
        self.export_btn.pack(side="left", padx=(0, 10))
        
        self.import_btn = ctk.CTkButton(self.backup_frame, text="Importer (ZIP)", command=self.import_db)
        self.import_btn.pack(side="left")
        
        # Bouton Enregistrer
        self.save_btn = ctk.CTkButton(self, text="💾 Enregistrer les Paramètres", font=ctk.CTkFont(size=14, weight="bold"), height=36, command=self.save_settings)
        self.save_btn.pack(pady=25)
        
    def render_dict_list(self):
        """Affiche la liste des dictionnaires avec boutons de priorité et cases à cocher."""
        for widget in self.dict_list_frame.winfo_children():
            widget.destroy()
            
        for idx, d in enumerate(self.dict_registry):
            d_id = d["id"]
            if d_id not in self.dict_vars:
                self.dict_vars[d_id] = ctk.BooleanVar(value=d.get("enabled", True))
                
            row = ctk.CTkFrame(self.dict_list_frame, fg_color="transparent")
            row.pack(fill="x", padx=10, pady=4)
            
            # Priorité badge
            prio_lbl = ctk.CTkLabel(
                row, 
                text=f"#{idx + 1}", 
                font=ctk.CTkFont(size=11, weight="bold"),
                width=24,
                text_color="#38BDF8"
            )
            prio_lbl.pack(side="left", padx=(0, 5))
            
            # Boutons Haut / Bas
            btn_up = ctk.CTkButton(
                row, 
                text="▲", 
                width=22, 
                height=22, 
                font=ctk.CTkFont(size=10),
                fg_color="transparent",
                hover_color=("#CBD5E1", "#334155"),
                command=lambda i=idx: self.move_dict(i, -1)
            )
            btn_up.pack(side="left", padx=1)
            if idx == 0:
                btn_up.configure(state="disabled")
                
            btn_down = ctk.CTkButton(
                row, 
                text="▼", 
                width=22, 
                height=22, 
                font=ctk.CTkFont(size=10),
                fg_color="transparent",
                hover_color=("#CBD5E1", "#334155"),
                command=lambda i=idx: self.move_dict(i, 1)
            )
            btn_down.pack(side="left", padx=1)
            if idx == len(self.dict_registry) - 1:
                btn_down.configure(state="disabled")
                
            # Checkbox nom et count
            count_str = f" ({d.get('count', 0):,} art.)".replace(",", " ") if d.get("count") else ""
            cb = ctk.CTkCheckBox(
                row, 
                text=f"{d['name']}{count_str}", 
                variable=self.dict_vars[d_id],
                font=ctk.CTkFont(size=12)
            )
            cb.pack(side="left", padx=(8, 0), fill="x", expand=True)

    def move_dict(self, idx, direction):
        """Réordonne la priorité d'un dictionnaire vers le haut ou vers le bas."""
        new_idx = idx + direction
        if 0 <= new_idx < len(self.dict_registry):
            self.dict_registry[idx], self.dict_registry[new_idx] = self.dict_registry[new_idx], self.dict_registry[idx]
            for i, d in enumerate(self.dict_registry):
                d["priority"] = i + 1
            self.render_dict_list()

    def on_import_dictionary(self):
        """Ouvre un sélecteur de fichier pour importer un nouveau dictionnaire."""
        file_path = filedialog.askopenfilename(
            title="Sélectionner un dictionnaire (.docx, .json, .csv)",
            filetypes=[
                ("Dictionnaires bibliques", "*.docx *.json *.csv"),
                ("Documents Word (.docx)", "*.docx"),
                ("Fichiers JSON (.json)", "*.json"),
                ("Fichiers CSV (.csv)", "*.csv"),
                ("Tous les fichiers", "*.*")
            ]
        )
        if not file_path:
            return
            
        res = DictionaryManager.import_dictionary(file_path)
        if res.get("success"):
            messagebox.showinfo(
                "Import Réussi", 
                f"Le dictionnaire « {res.get('name')} » a été importé avec succès !\n\n"
                f"Nombre d'articles extraits et indexés : {res.get('count'):,} articles.".replace(",", " ")
            )
            self.dict_registry = [dict(d) for d in DictionaryManager.load_registry()]
            self.dict_registry.sort(key=lambda x: x.get("priority", 99))
            self.render_dict_list()
        else:
            messagebox.showerror("Erreur d'import", f"Impossible d'importer le dictionnaire :\n{res.get('error')}")

    def get_settings_bible_label(self, key):
        if not key or key == "Aucune":
            return "Sélectionner une Bible de référence"
        from gui.bible_picker_popover import BIBLE_STYLE_MAP
        style = BIBLE_STYLE_MAP.get(key, {})
        full = style.get("full") or key
        code = style.get("code") or key
        if code and code != full:
            return f"{full} ({code})"
        return full

    def open_settings_bible_picker(self):
        from gui.library_utils import load_books_metadata
        registry = load_books_metadata()
        active_key = self.ref_bible_var.get()
        self.settings_bible_popover.show(self.btn_settings_ref_bible, active_key, registry)

    def on_settings_ref_bible_selected(self, bible_key):
        self.ref_bible_var.set(bible_key)
        self.btn_settings_ref_bible.configure(text=f"📖 {self.get_settings_bible_label(bible_key)}  ▾")

    def on_theme_preview(self, choice):
        theme_val = DISPLAY_TO_THEME.get(choice, "dark")
        ctk.set_appearance_mode(theme_val)
        
    def on_font_size_change(self, value):
        val_int = int(value)
        self.font_size_label.configure(text=f"Taille de police : {val_int} pt")
        
    def save_settings(self):
        # 1. Sauvegarder les dictionnaires et priorités
        for idx, d in enumerate(self.dict_registry):
            d_id = d["id"]
            if d_id in self.dict_vars:
                d["enabled"] = bool(self.dict_vars[d_id].get())
            d["priority"] = idx + 1
        DictionaryManager.save_registry(self.dict_registry)
        
        # 2. Sauvegarder la configuration générale
        theme_choice = self.theme_var.get()
        theme_val = DISPLAY_TO_THEME.get(theme_choice, "dark")
        self.config["theme"] = theme_val
        ctk.set_appearance_mode(theme_val)
        
        font_choice = self.font_var.get()
        font_val = DISPLAY_TO_FONT.get(font_choice, "Georgia")
        self.config["font_family"] = font_val
        self.config["font_size"] = int(self.font_size_var.get())
        
        self.config["line_spacing"] = int(self.line_spacing_var.get())
        self.config["word_spacing"] = int(self.word_spacing_var.get())
        
        self.config["interlinear_show_surface"] = bool(self.inter_surf_var.get())
        self.config["interlinear_show_lemma"] = bool(self.inter_lem_var.get())
        self.config["interlinear_show_translit"] = bool(self.inter_tr_var.get())
        self.config["interlinear_show_strong"] = bool(self.inter_str_var.get())
        
        self.config["mistral_api_key"] = self.api_key_entry.get().strip()
        self.config["gemini_api_key"] = self.gemini_key_entry.get().strip()
        self.config["infomaniak_token"] = self.infomaniak_token_entry.get().strip()
        self.config["infomaniak_product_id"] = self.infomaniak_pid_entry.get().strip() or "251"
        self.config["chat_model"] = self.chat_model_var.get()
        self.config["show_diff_percentage"] = self.show_diff_pct_var.get()
        self.config["show_diff_highlights"] = self.show_diff_colors_var.get()
        self.config["reference_bible"] = self.ref_bible_var.get()
        self.config["chat_system_prompt"] = self.prompt_text.get("0.0", "end-1c").strip()
        
        try:
            self.config["rag_top_k_raw"] = int(self.top_k_raw_entry.get().strip())
        except ValueError:
            self.config["rag_top_k_raw"] = 25
            
        try:
            self.config["rag_top_k_final"] = int(self.top_k_final_entry.get().strip())
        except ValueError:
            self.config["rag_top_k_final"] = 7
            
        self.config["rag_enable_curation"] = bool(self.curation_var.get())
        self.config["rag_curation_model"] = self.curation_model_var.get()
        
        save_config(self.config)
        
        if self.on_save_callback:
            self.on_save_callback(self.config)
            
        if self.close_callback:
            self.close_callback()
        
    def export_db(self):
        def _export():
            save_path = filedialog.asksaveasfilename(
                defaultextension=".zip",
                filetypes=[("Archive ZIP", "*.zip")],
                title="Exporter la base de données"
            )
            if save_path:
                try:
                    db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "chroma_db")
                    if not os.path.exists(db_path) or not os.listdir(db_path):
                        messagebox.showinfo("Export", "La base de données est vide. Rien à exporter.")
                        return
                    shutil.make_archive(save_path.replace(".zip", ""), 'zip', db_path)
                    messagebox.showinfo("Export", "Sauvegarde effectuée avec succès !")
                except Exception as e:
                    messagebox.showerror("Erreur", f"Une erreur est survenue : {str(e)}")
        self.after(100, _export)
                
    def import_db(self):
        def _import():
            zip_path = filedialog.askopenfilename(
                filetypes=[("Base ChromaDB", "*.zip")],
                title="Importer une base de données"
            )
            if zip_path:
                if messagebox.askyesno("Attention", "L'importation remplacera votre base de données actuelle. Vous devrez redémarrer l'application. Continuer ?"):
                    try:
                        db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "chroma_db")
                        if os.path.exists(db_path):
                            shutil.rmtree(db_path, ignore_errors=True)
                        os.makedirs(db_path, exist_ok=True)
                        shutil.unpack_archive(zip_path, db_path, "zip")
                        messagebox.showinfo("Import", "Restauration effectuée avec succès ! Veuillez fermer et relancer l'application pour charger les données.")
                    except Exception as e:
                        messagebox.showerror("Erreur", f"Impossible d'importer la base. Fermez l'application principale si elle bloque le fichier, puis réessayez. Détails : {str(e)}")
        self.after(100, _import)
