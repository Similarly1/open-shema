import customtkinter as ctk
import shutil
import os
import json
import threading
import zipfile
import datetime
from tkinter import messagebox
from gui import native_dialog as filedialog
from core.config import load_config, save_config
from core.dictionary_manager import DictionaryManager
from core.dictionary_polisher import AVAILABLE_POLISH_MODELS

# Composants inclus dans la sauvegarde complète
_BACKUP_MANIFEST_VERSION = "1.0"
_BACKUP_COMPONENTS = [
    ("chroma_db",      "📦 Vecteurs ChromaDB"),
    ("commentaires",   "📝 Commentaires bibliques"),
    ("bibles",         "📖 Bibles JSON"),
    ("covers",         "🖼️ Couvertures"),
    ("dictionaries",   "📚 Dictionnaires"),
    ("library.json",   "🗂️ Registre (library.json)"),
    ("config.json",    "⚙️ Paramètres (config.json)"),
]

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
        
        # Modèle de Restauration Dictionnaires (Vigouroux / Calmet)
        self.dict_polish_model_label = ctk.CTkLabel(self, text="Modèle de Restauration Dictionnaires (Vigouroux / Calmet) :")
        self.dict_polish_model_label.pack(anchor="w", padx=20, pady=(8, 0))
        self.dict_polish_model_var = ctk.StringVar(value=self.config.get("dict_polish_model", "gemini-2.5-flash"))
        self.dict_polish_model_menu = ctk.CTkOptionMenu(
            self,
            variable=self.dict_polish_model_var,
            values=[m[0] for m in AVAILABLE_POLISH_MODELS]
        )
        self.dict_polish_model_menu.pack(fill="x", padx=20, pady=5)
        
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

        # Clé API Google Books (Optionnelle)
        self.google_books_key_label = ctk.CTkLabel(self, text="Clé API Google Books (Optionnelle pour recherche de métadonnées) :")
        self.google_books_key_label.pack(anchor="w", padx=20, pady=(4, 0))
        self.google_books_key_entry = ctk.CTkEntry(self, show="*", placeholder_text="Laisser vide pour mode public & Open Library")
        self.google_books_key_entry.pack(fill="x", padx=20, pady=5)
        if self.config.get("google_books_api_key"):
            self.google_books_key_entry.insert(0, self.config["google_books_api_key"])
            
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
        # 4. SAUVEGARDE COMPLÈTE
        # ==========================================
        # 4. LANGUES ORIGINALES & EXÉGÈSE
        # ==========================================
        self.sect_orig = ctk.CTkLabel(self, text="📜 Langues Originales & Exégèse (STEPBible)", font=ctk.CTkFont(size=14, weight="bold"), text_color="#3B82F6")
        self.sect_orig.pack(anchor="w", padx=20, pady=(15, 4))
        
        orig_cfg_frame = ctk.CTkFrame(self, fg_color=("#F8FAFC", "#1E293B"), corner_radius=8)
        orig_cfg_frame.pack(fill="x", padx=20, pady=4)
        
        v_orig_row = ctk.CTkFrame(orig_cfg_frame, fg_color="transparent")
        v_orig_row.pack(fill="x", padx=12, pady=(8, 4))
        
        self.lbl_max_orig_v = ctk.CTkLabel(
            v_orig_row, 
            text=f"Nombre max de versets originaux envoyés au LLM : {self.config.get('max_original_verses_for_llm', 10)}", 
            font=ctk.CTkFont(size=12)
        )
        self.lbl_max_orig_v.pack(side="left")
        
        self.max_orig_verses_var = ctk.IntVar(value=self.config.get("max_original_verses_for_llm", 10))
        def on_max_orig_change(val):
            v_int = int(val)
            self.lbl_max_orig_v.configure(text=f"Nombre max de versets originaux envoyés au LLM : {v_int}")
            
        self.max_orig_slider = ctk.CTkSlider(
            orig_cfg_frame,
            from_=1,
            to=30,
            number_of_steps=29,
            variable=self.max_orig_verses_var,
            command=on_max_orig_change
        )
        self.max_orig_slider.pack(fill="x", padx=12, pady=(2, 6))
        
        from core.original_languages_manager import OriginalLanguagesManager
        orig_stats = OriginalLanguagesManager.get_instance().get_stats()
        
        status_txt = f"✅ Base installée : {orig_stats['total_words']:,} mots (AT Hébreu : {orig_stats['ot_words']:,}, NT Grec : {orig_stats['nt_words']:,})".replace(",", " ") if orig_stats["installed"] else "⚠️ Base non installée"
        status_col = "#10B981" if orig_stats["installed"] else "#F59E0B"
        
        self.lbl_orig_db_status = ctk.CTkLabel(
            orig_cfg_frame,
            text=status_txt,
            font=ctk.CTkFont(size=11, weight="bold"),
            text_color=status_col
        )
        self.lbl_orig_db_status.pack(anchor="w", padx=12, pady=(2, 6))
        
        self.btn_download_orig = ctk.CTkButton(
            orig_cfg_frame,
            text="📥 Réindexer / Mettre à jour les données STEPBible",
            font=ctk.CTkFont(size=11, weight="bold"),
            fg_color=("#0284C7", "#0369A1"),
            hover_color=("#0369A1", "#075985"),
            height=28,
            command=self.on_reindex_orig_db
        )
        self.btn_download_orig.pack(anchor="w", padx=12, pady=(0, 8))

        # ==========================================
        # 5. SAUVEGARDE & RESTAURATION COMPLÈTE
        # ==========================================
        self.sect_db = ctk.CTkLabel(
            self, text="💾 Sauvegarde & Restauration Complète",
            font=ctk.CTkFont(size=14, weight="bold"), text_color="#3B82F6"
        )
        self.sect_db.pack(anchor="w", padx=20, pady=(15, 3))

        # Description des éléments inclus
        included_txt = "  ".join(label for _, label in _BACKUP_COMPONENTS)
        lbl_included = ctk.CTkLabel(
            self, text=f"Inclus : {included_txt}",
            font=ctk.CTkFont(size=10), text_color=("#64748B", "#94A3B8"),
            wraplength=560, justify="left", anchor="w"
        )
        lbl_included.pack(fill="x", padx=20, pady=(0, 6))

        self.backup_frame = ctk.CTkFrame(self, fg_color="transparent")
        self.backup_frame.pack(fill="x", padx=20, pady=(0, 4))

        self.export_btn = ctk.CTkButton(
            self.backup_frame, text="📤 Exporter tout (ZIP)",
            width=160, command=self.export_db,
            fg_color=("#2563EB", "#1D4ED8"), hover_color=("#1D4ED8", "#1E40AF"),
            text_color="#FFFFFF", font=ctk.CTkFont(size=12, weight="bold")
        )
        self.export_btn.pack(side="left", padx=(0, 10))

        self.import_btn = ctk.CTkButton(
            self.backup_frame, text="📥 Restaurer depuis ZIP",
            width=160, command=self.import_db,
            fg_color=("#E2E8F0", "#1E293B"),
            hover_color=("#CBD5E1", "#334155"),
            text_color=("#0F172A", "#F8FAFC"),
            border_width=1, border_color=("#94A3B8", "#475569"),
            font=ctk.CTkFont(size=12, weight="bold")
        )
        self.import_btn.pack(side="left")

        # Label de statut (affiché pendant l'opération)
        self.backup_status_label = ctk.CTkLabel(
            self, text="", font=ctk.CTkFont(size=11),
            text_color=("#64748B", "#94A3B8")
        )
        self.backup_status_label.pack(anchor="w", padx=20)
        
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
        self.config["google_books_api_key"] = self.google_books_key_entry.get().strip()
        self.config["chat_model"] = self.chat_model_var.get()
        self.config["dict_polish_model"] = self.dict_polish_model_var.get()
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
        if hasattr(self, 'max_orig_verses_var'):
            self.config["max_original_verses_for_llm"] = int(self.max_orig_verses_var.get())
        
        save_config(self.config)
        
        if self.on_save_callback:
            self.on_save_callback(self.config)
            
        if self.close_callback:
            self.close_callback()

    def on_reindex_orig_db(self):
        """Lance l'indexation des langues originales en arrière-plan."""
        self.btn_download_orig.configure(state="disabled", text="⏳ Indexation en cours...")
        
        def _task():
            from core.original_languages_manager import OriginalLanguagesManager
            mgr = OriginalLanguagesManager.get_instance()
            
            def _cb(msg, frac):
                self.after(0, lambda: self.lbl_orig_db_status.configure(text=f"⏳ [{int(frac*100)}%] {msg}", text_color="#38BDF8"))
                
            success = mgr.download_and_import(progress_callback=_cb)
            if success:
                st = mgr.get_stats()
                txt = f"✅ Base installée : {st['total_words']:,} mots (AT : {st['ot_words']:,}, NT : {st['nt_words']:,})".replace(",", " ")
                self.after(0, lambda: [
                    self.lbl_orig_db_status.configure(text=txt, text_color="#10B981"),
                    self.btn_download_orig.configure(state="normal", text="📥 Réindexer / Mettre à jour les données STEPBible"),
                    messagebox.showinfo("Succès", "La base de données des textes originaux (Hébreu & Grec STEPBible) a été indexée avec succès !")
                ])
            else:
                self.after(0, lambda: [
                    self.lbl_orig_db_status.configure(text="❌ Erreur lors de l'indexation", text_color="#EF4444"),
                    self.btn_download_orig.configure(state="normal", text="📥 Réindexer / Mettre à jour les données STEPBible")
                ])
                
        threading.Thread(target=_task, daemon=True).start()
        
    # ------------------------------------------------------------------
    # Sauvegarde complète (export)
    # ------------------------------------------------------------------

    def _set_backup_status(self, text, color="#64748B"):
        """Met à jour le label de statut depuis n'importe quel thread."""
        self.after(0, lambda: self.backup_status_label.configure(
            text=text, text_color=color
        ))

    def _set_backup_buttons(self, enabled: bool):
        state = "normal" if enabled else "disabled"
        self.after(0, lambda: [
            self.export_btn.configure(state=state),
            self.import_btn.configure(state=state)
        ])

    def export_db(self):
        def _pick_and_export():
            save_path = filedialog.asksaveasfilename(
                defaultextension=".zip",
                filetypes=[("Archive ZIP", "*.zip")],
                initialfile=f"backup_bible_ai_{datetime.datetime.now().strftime('%Y%m%d_%H%M')}.zip",
                title="Choisir l'emplacement de la sauvegarde complète"
            )
            if not save_path:
                return
            threading.Thread(target=self._do_export, args=(save_path,), daemon=True).start()

        self.after(100, _pick_and_export)

    def _do_export(self, save_path: str):
        """Construit le ZIP complet en arrière-plan."""
        self._set_backup_buttons(False)
        data_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
        tmp_zip = save_path + ".tmp"

        try:
            manifest = {
                "version": _BACKUP_MANIFEST_VERSION,
                "created_at": datetime.datetime.now().isoformat(),
                "components": []
            }

            with zipfile.ZipFile(tmp_zip, "w", compression=zipfile.ZIP_DEFLATED,
                                 allowZip64=True) as zf:

                for folder_or_file, label in _BACKUP_COMPONENTS:
                    src = os.path.join(data_dir, folder_or_file)
                    if not os.path.exists(src):
                        continue

                    self._set_backup_status(f"⏳ Compression : {label}…")

                    if os.path.isfile(src):
                        arcname = os.path.join("data", folder_or_file)
                        zf.write(src, arcname)
                        manifest["components"].append(folder_or_file)
                    else:
                        # Dossier : parcourir récursivement
                        for root, _, files in os.walk(src):
                            for fname in files:
                                full = os.path.join(root, fname)
                                rel  = os.path.relpath(full, data_dir)
                                zf.write(full, os.path.join("data", rel))
                        manifest["components"].append(folder_or_file)

                # Ajouter le manifeste en dernier
                zf.writestr("backup_manifest.json", json.dumps(manifest, ensure_ascii=False, indent=2))

            # Renommer le fichier temporaire en destination finale
            if os.path.exists(save_path):
                os.remove(save_path)
            os.rename(tmp_zip, save_path)

            size_mb = os.path.getsize(save_path) / (1024 * 1024)
            self._set_backup_status(
                f"✅ Sauvegarde terminée ({size_mb:.0f} Mo) — {os.path.basename(save_path)}",
                color="#10B981"
            )
            self.after(0, lambda: messagebox.showinfo(
                "Sauvegarde complète",
                f"Sauvegarde effectuée avec succès !\n\n"
                f"Fichier : {save_path}\n"
                f"Taille  : {size_mb:.0f} Mo\n\n"
                f"Ce fichier contient vos vecteurs, commentaires, bibles, "
                f"dictionnaires, couvertures et paramètres.\n"
                f"Conservez-le en lieu sûr."
            ))

        except Exception as e:
            # Nettoyer le fichier temporaire en cas d'erreur
            if os.path.exists(tmp_zip):
                try: os.remove(tmp_zip)
                except OSError: pass
            self._set_backup_status(f"❌ Erreur : {e}", color="#EF4444")
            self.after(0, lambda: messagebox.showerror(
                "Erreur d'export",
                f"La sauvegarde a échoué :\n{e}"
            ))
        finally:
            self._set_backup_buttons(True)

    # ------------------------------------------------------------------
    # Restauration complète (import)
    # ------------------------------------------------------------------

    def import_db(self):
        def _pick_and_import():
            zip_path = filedialog.askopenfilename(
                filetypes=[("Sauvegarde Bible AI", "*.zip"), ("Tous les fichiers", "*.*")],
                title="Sélectionner la sauvegarde à restaurer"
            )
            if not zip_path:
                return

            # Vérifier que c'est bien une sauvegarde Bible AI
            try:
                with zipfile.ZipFile(zip_path, "r") as zf:
                    names = zf.namelist()
                    has_manifest = "backup_manifest.json" in names
                    has_data = any(n.startswith("data/") for n in names)
                    if not has_manifest or not has_data:
                        messagebox.showerror(
                            "Fichier invalide",
                            "Ce fichier ZIP ne semble pas être une sauvegarde Bible AI valide.\n"
                            "Assurez-vous d'utiliser un fichier créé par la fonction \"Exporter tout\"."
                        )
                        return
                    # Lire le manifeste pour informer l'utilisateur
                    manifest = json.loads(zf.read("backup_manifest.json"))
                    created = manifest.get("created_at", "inconnue")[:19].replace("T", " ")
                    components = manifest.get("components", [])
                    comp_str = ", ".join(components)
            except zipfile.BadZipFile:
                messagebox.showerror("Fichier invalide", "Impossible d'ouvrir ce fichier ZIP.")
                return
            except Exception as e:
                messagebox.showerror("Erreur", f"Lecture du fichier impossible : {e}")
                return

            confirmed = messagebox.askyesno(
                "Confirmer la restauration",
                f"Sauvegarde du : {created}\n"
                f"Composants   : {comp_str}\n\n"
                "⚠️  Cette opération REMPLACERA toutes vos données actuelles "
                "(vecteurs, bibles, commentaires, paramètres) par ceux de la sauvegarde.\n\n"
                "L'application devra être redémarrée après la restauration.\n\n"
                "Continuer ?"
            )
            if confirmed:
                threading.Thread(
                    target=self._do_import, args=(zip_path,), daemon=True
                ).start()

        self.after(100, _pick_and_import)

    def _do_import(self, zip_path: str):
        """Restaure le ZIP complet en arrière-plan."""
        self._set_backup_buttons(False)
        data_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")

        try:
            with zipfile.ZipFile(zip_path, "r") as zf:
                manifest = json.loads(zf.read("backup_manifest.json"))
                components = manifest.get("components", [])

                for component in components:
                    label = next(
                        (lbl for key, lbl in _BACKUP_COMPONENTS if key == component),
                        component
                    )
                    self._set_backup_status(f"⏳ Restauration : {label}…")

                    dest = os.path.join(data_dir, component)

                    if os.path.isdir(dest):
                        shutil.rmtree(dest, ignore_errors=True)
                    elif os.path.isfile(dest):
                        os.remove(dest)

                    # Extraire uniquement les entrées de ce composant
                    prefix = f"data/{component}"
                    entries = [n for n in zf.namelist() if n.startswith(prefix)]
                    for entry in entries:
                        target = os.path.join(
                            data_dir,
                            os.path.relpath(entry, "data")
                        )
                        if entry.endswith("/"):
                            os.makedirs(target, exist_ok=True)
                        else:
                            os.makedirs(os.path.dirname(target), exist_ok=True)
                            with zf.open(entry) as src_f, open(target, "wb") as dst_f:
                                shutil.copyfileobj(src_f, dst_f)

            self._set_backup_status(
                "✅ Restauration terminée — redémarrez l'application.",
                color="#10B981"
            )
            self.after(0, lambda: messagebox.showinfo(
                "Restauration terminée",
                "Toutes vos données ont été restaurées avec succès !\n\n"
                "Fermez et relancez l'application pour charger la configuration restaurée."
            ))

        except Exception as e:
            self._set_backup_status(f"❌ Erreur de restauration : {e}", color="#EF4444")
            self.after(0, lambda: messagebox.showerror(
                "Erreur de restauration",
                f"La restauration a échoué :\n{e}\n\n"
                "Vos données actuelles peuvent être dans un état partiel. "
                "Vérifiez le dossier data/ manuellement."
            ))
        finally:
            self._set_backup_buttons(True)
