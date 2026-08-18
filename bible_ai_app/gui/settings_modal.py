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
from core.translation_manager import AVAILABLE_TRANSLATION_MODELS

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

# Design Tokens (Style Logos & Linear)
C_CARD_BG = ("#F8FAFC", "#1E293B")
C_BORDER = ("#E2E8F0", "#334155")
C_TEXT_PRIMARY = ("#0F172A", "#F8FAFC")
C_TEXT_MUTED = ("#64748B", "#94A3B8")
C_ACCENT = ("#2563EB", "#38BDF8")


class SettingsTab(ctk.CTkScrollableFrame):
    def __init__(self, master, close_callback=None, on_save_callback=None, **kwargs):
        super().__init__(master, fg_color="transparent", **kwargs)
        self.close_callback = close_callback
        self.on_save_callback = on_save_callback
        self.config = load_config()

        # ------------------------------------------------------------------
        # Header avec Titre & Bouton Enregistrer rapide en haut
        # ------------------------------------------------------------------
        header_frame = ctk.CTkFrame(self, fg_color="transparent")
        header_frame.pack(fill="x", padx=16, pady=(12, 10))
        header_frame.grid_columnconfigure(0, weight=1)
        header_frame.grid_columnconfigure(1, weight=0)

        title_box = ctk.CTkFrame(header_frame, fg_color="transparent")
        title_box.grid(row=0, column=0, sticky="w")

        title_lbl = ctk.CTkLabel(
            title_box,
            text="PARAMÈTRES",
            font=ctk.CTkFont(size=18, weight="bold"),
            text_color=C_TEXT_PRIMARY
        )
        title_lbl.pack(anchor="w")

        subtitle_lbl = ctk.CTkLabel(
            title_box,
            text="Personnalisez la typographie, l'affichage biblique, les modèles d'IA et la sauvegarde.",
            font=ctk.CTkFont(size=11),
            text_color=C_TEXT_MUTED
        )
        subtitle_lbl.pack(anchor="w", pady=(1, 0))

        # Bouton Enregistrer rapide en haut
        self.top_save_btn = ctk.CTkButton(
            header_frame,
            text="💾  Enregistrer",
            font=ctk.CTkFont(size=12, weight="bold"),
            fg_color=("#2563EB", "#1D4ED8"),
            hover_color=("#1D4ED8", "#1E40AF"),
            text_color="#FFFFFF",
            height=32,
            width=130,
            corner_radius=6,
            command=self.save_settings
        )
        self.top_save_btn.grid(row=0, column=1, sticky="e")

        # ------------------------------------------------------------------
        # Sections
        # ------------------------------------------------------------------
        self._build_section_apparence()
        self._build_section_lecture()
        self._build_section_stepbible()
        self._build_section_dictionnaires()
        self._build_section_ai()
        self._build_section_backup()

        # Bouton Enregistrer en bas
        bot_frame = ctk.CTkFrame(self, fg_color="transparent")
        bot_frame.pack(fill="x", padx=16, pady=(16, 24))

        self.save_btn = ctk.CTkButton(
            bot_frame,
            text="💾  Enregistrer tous les paramètres",
            font=ctk.CTkFont(size=13, weight="bold"),
            fg_color=("#2563EB", "#1D4ED8"),
            hover_color=("#1D4ED8", "#1E40AF"),
            text_color="#FFFFFF",
            height=38,
            corner_radius=8,
            command=self.save_settings
        )
        self.save_btn.pack(fill="x")

    def _create_section_header(self, title_text):
        hdr = ctk.CTkFrame(self, fg_color="transparent")
        hdr.pack(fill="x", padx=16, pady=(16, 6))

        accent = ctk.CTkFrame(hdr, width=3, height=14, fg_color=C_ACCENT, corner_radius=2)
        accent.pack(side="left", padx=(0, 8))
        accent.pack_propagate(False)

        lbl = ctk.CTkLabel(
            hdr,
            text=title_text.upper(),
            font=ctk.CTkFont(size=11, weight="bold"),
            text_color=C_ACCENT
        )
        lbl.pack(side="left")

    def _create_card(self):
        card = ctk.CTkFrame(
            self,
            fg_color=C_CARD_BG,
            border_color=C_BORDER,
            border_width=1,
            corner_radius=8
        )
        card.pack(fill="x", padx=16, pady=(0, 4))
        return card

    # ==================================================================
    # 1. APPARENCE & TYPOGRAPHIE
    # ==================================================================
    def _build_section_apparence(self):
        self._create_section_header("Apparence & Typographie")
        card = self._create_card()

        row1 = ctk.CTkFrame(card, fg_color="transparent")
        row1.pack(fill="x", padx=16, pady=(12, 8))
        row1.grid_columnconfigure((0, 1), weight=1)

        f_theme = ctk.CTkFrame(row1, fg_color="transparent")
        f_theme.grid(row=0, column=0, sticky="ew", padx=(0, 8))
        ctk.CTkLabel(f_theme, text="Thème :", font=ctk.CTkFont(size=11, weight="bold"), text_color=C_TEXT_PRIMARY).pack(anchor="w", pady=(0, 3))
        current_theme_val = self.config.get("theme", "dark")
        current_theme_disp = THEME_TO_DISPLAY.get(current_theme_val, "Sombre (Dark)")
        self.theme_var = ctk.StringVar(value=current_theme_disp)
        self.theme_menu = ctk.CTkOptionMenu(
            f_theme,
            variable=self.theme_var,
            values=[t[0] for t in THEMES_PRESETS],
            height=30,
            command=self.on_theme_preview
        )
        self.theme_menu.pack(fill="x")

        f_font = ctk.CTkFrame(row1, fg_color="transparent")
        f_font.grid(row=0, column=1, sticky="ew", padx=(8, 0))
        ctk.CTkLabel(f_font, text="Police de lecture :", font=ctk.CTkFont(size=11, weight="bold"), text_color=C_TEXT_PRIMARY).pack(anchor="w", pady=(0, 3))
        current_font_val = self.config.get("font_family", "Georgia")
        current_font_disp = FONT_TO_DISPLAY.get(current_font_val, "Georgia (Serif - Classique)")
        self.font_var = ctk.StringVar(value=current_font_disp)
        self.font_menu = ctk.CTkOptionMenu(
            f_font,
            variable=self.font_var,
            values=[p[0] for p in FONTS_PRESETS],
            height=30
        )
        self.font_menu.pack(fill="x")

        div = ctk.CTkFrame(card, height=1, fg_color=C_BORDER)
        div.pack(fill="x", padx=16, pady=8)

        self.font_size_var = ctk.IntVar(value=self.config.get("font_size", 18))
        self._add_slider_row(
            card,
            label="Taille de police",
            var=self.font_size_var,
            from_=12, to=32, steps=20, unit="pt",
            callback=self.on_font_size_change
        )

        self.line_spacing_var = ctk.IntVar(value=self.config.get("line_spacing", 6))
        self._add_slider_row(
            card,
            label="Interligne",
            var=self.line_spacing_var,
            from_=0, to=20, steps=20, unit="px"
        )

        self.word_spacing_var = ctk.IntVar(value=self.config.get("word_spacing", 3))
        self._add_slider_row(
            card,
            label="Espacement des mots / colonnes",
            var=self.word_spacing_var,
            from_=1, to=10, steps=9, unit="px",
            is_last=True
        )

    def _add_slider_row(self, parent, label, var, from_, to, steps, unit, callback=None, is_last=False):
        row = ctk.CTkFrame(parent, fg_color="transparent")
        row.pack(fill="x", padx=16, pady=(4, 12 if is_last else 6))
        row.grid_columnconfigure(1, weight=1)

        lbl = ctk.CTkLabel(row, text=label, font=ctk.CTkFont(size=12), text_color=C_TEXT_PRIMARY, width=180, anchor="w")
        lbl.grid(row=0, column=0, sticky="w")

        val_badge = ctk.CTkLabel(
            row,
            text=f"{int(var.get())} {unit}",
            font=ctk.CTkFont(size=11, weight="bold"),
            text_color=C_ACCENT,
            width=55,
            anchor="e"
        )
        val_badge.grid(row=0, column=2, sticky="e")

        def _on_change(v):
            val_badge.configure(text=f"{int(v)} {unit}")
            if callback:
                callback(v)

        slider = ctk.CTkSlider(
            row,
            from_=from_,
            to=to,
            number_of_steps=steps,
            variable=var,
            command=_on_change,
            height=16
        )
        slider.grid(row=0, column=1, sticky="ew", padx=12)

    # ==================================================================
    # 2. OPTIONS DE LECTURE & COMPARAISON
    # ==================================================================
    def _build_section_lecture(self):
        self._create_section_header("Options Bibliques & Comparaison")
        card = self._create_card()

        opt_frame = ctk.CTkFrame(card, fg_color="transparent")
        opt_frame.pack(fill="x", padx=16, pady=(12, 6))

        self.show_diff_pct_var = ctk.BooleanVar(value=self.config.get("show_diff_percentage", True))
        self.show_diff_pct_cb = ctk.CTkCheckBox(
            opt_frame, text="Afficher le pourcentage de différence textuelle",
            variable=self.show_diff_pct_var, font=ctk.CTkFont(size=12)
        )
        self.show_diff_pct_cb.pack(anchor="w", pady=3)

        self.show_diff_colors_var = ctk.BooleanVar(value=self.config.get("show_diff_highlights", True))
        self.show_diff_colors_cb = ctk.CTkCheckBox(
            opt_frame, text="Surligner/Colorer les différences textuelles entre versions",
            variable=self.show_diff_colors_var, font=ctk.CTkFont(size=12)
        )
        self.show_diff_colors_cb.pack(anchor="w", pady=3)

        sub_card = ctk.CTkFrame(card, fg_color=("#FFFFFF", "#0F172A"), border_color=C_BORDER, border_width=1, corner_radius=6)
        sub_card.pack(fill="x", padx=16, pady=8)

        ctk.CTkLabel(
            sub_card,
            text="🔬  Couches actives de l'Interlinéaire Inversé :",
            font=ctk.CTkFont(size=11, weight="bold"),
            text_color=C_TEXT_PRIMARY
        ).pack(anchor="w", padx=12, pady=(8, 4))

        layers_grid = ctk.CTkFrame(sub_card, fg_color="transparent")
        layers_grid.pack(fill="x", padx=12, pady=(0, 8))
        layers_grid.grid_columnconfigure((0, 1), weight=1)

        self.inter_surf_var = ctk.BooleanVar(value=self.config.get("interlinear_show_surface", True))
        self.inter_surf_cb = ctk.CTkCheckBox(layers_grid, text="Texte français (Surface)", variable=self.inter_surf_var, font=ctk.CTkFont(size=11))
        self.inter_surf_cb.grid(row=0, column=0, sticky="w", pady=2)

        self.inter_lem_var = ctk.BooleanVar(value=self.config.get("interlinear_show_lemma", True))
        self.inter_lem_cb = ctk.CTkCheckBox(layers_grid, text="Lemme original (Hébreu/Grec)", variable=self.inter_lem_var, font=ctk.CTkFont(size=11))
        self.inter_lem_cb.grid(row=0, column=1, sticky="w", pady=2)

        self.inter_tr_var = ctk.BooleanVar(value=self.config.get("interlinear_show_translit", True))
        self.inter_tr_cb = ctk.CTkCheckBox(layers_grid, text="Translittération phonétique", variable=self.inter_tr_var, font=ctk.CTkFont(size=11))
        self.inter_tr_cb.grid(row=1, column=0, sticky="w", pady=2)

        self.inter_str_var = ctk.BooleanVar(value=self.config.get("interlinear_show_strong", True))
        self.inter_str_cb = ctk.CTkCheckBox(layers_grid, text="Numéro Strong (H... / G...)", variable=self.inter_str_var, font=ctk.CTkFont(size=11))
        self.inter_str_cb.grid(row=1, column=1, sticky="w", pady=2)

        ref_row = ctk.CTkFrame(card, fg_color="transparent")
        ref_row.pack(fill="x", padx=16, pady=(4, 14))

        ctk.CTkLabel(ref_row, text="Bible de référence par défaut :", font=ctk.CTkFont(size=12), text_color=C_TEXT_PRIMARY).pack(anchor="w", pady=(0, 3))

        from gui.library_utils import load_books_metadata
        from gui.bible_picker_popover import BiblePickerPopover
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
            ref_row,
            text=f"📖 {self.get_settings_bible_label(self.ref_bible_var.get())}  ▾",
            command=self.open_settings_bible_picker,
            height=32,
            font=ctk.CTkFont(size=12),
            fg_color=("#FFFFFF", "#0F172A"),
            hover_color=("#F1F5F9", "#334155"),
            text_color=C_TEXT_PRIMARY,
            border_width=1,
            border_color=C_BORDER,
            corner_radius=6,
            anchor="w"
        )
        self.btn_settings_ref_bible.pack(fill="x")

    # ==================================================================
    # 3. LANGUES ORIGINALES & EXÉGÈSE (STEPBIBLE)
    # ==================================================================
    def _build_section_stepbible(self):
        self._create_section_header("Langues Originales & Exégèse (STEPBible)")
        card = self._create_card()

        self.max_orig_verses_var = ctk.IntVar(value=self.config.get("max_original_verses_for_llm", 10))
        self._add_slider_row(
            card,
            label="Max versets originaux pour le LLM",
            var=self.max_orig_verses_var,
            from_=1, to=30, steps=29, unit="vers."
        )

        bot_row = ctk.CTkFrame(card, fg_color="transparent")
        bot_row.pack(fill="x", padx=16, pady=(4, 12))

        try:
            from core.original_languages_manager import OriginalLanguagesManager
            orig_stats = OriginalLanguagesManager.get_instance().get_stats()
            status_txt = f"Base STEPBible installée : {orig_stats['total_words']:,} mots (AT : {orig_stats['ot_words']:,}, NT : {orig_stats['nt_words']:,})".replace(",", " ") if orig_stats.get("installed") else "Base STEPBible non installée"
            status_col = "#10B981" if orig_stats.get("installed") else "#F59E0B"
        except Exception:
            status_txt = "État de la base indisponible"
            status_col = "#F59E0B"

        self.lbl_orig_db_status = ctk.CTkLabel(
            bot_row,
            text=f"● {status_txt}",
            font=ctk.CTkFont(size=11, weight="bold"),
            text_color=status_col
        )
        self.lbl_orig_db_status.pack(anchor="w", pady=(0, 6))

        self.btn_download_orig = ctk.CTkButton(
            bot_row,
            text="📥  Mettre à jour les données STEPBible",
            font=ctk.CTkFont(size=11, weight="bold"),
            fg_color=("#0284C7", "#0369A1"),
            hover_color=("#0369A1", "#075985"),
            height=28,
            corner_radius=6,
            command=self.on_reindex_orig_db
        )
        self.btn_download_orig.pack(anchor="w")

    # ==================================================================
    # 4. DICTIONNAIRES, LEXIQUES & PRIORITÉS
    # ==================================================================
    def _build_section_dictionnaires(self):
        self._create_section_header("Dictionnaires & Priorités de Recherche")
        card = self._create_card()

        ctk.CTkLabel(
            card,
            text="Activez les dictionnaires pour le survol et définissez leur ordre d'apparition dans l'info-bulle :",
            font=ctk.CTkFont(size=11),
            text_color=C_TEXT_MUTED,
            wraplength=520,
            justify="left"
        ).pack(anchor="w", padx=16, pady=(10, 4))

        self.dict_list_frame = ctk.CTkFrame(card, fg_color=("#FFFFFF", "#0F172A"), border_color=C_BORDER, border_width=1, corner_radius=6)
        self.dict_list_frame.pack(fill="x", padx=16, pady=6)

        self.dict_registry = [dict(d) for d in DictionaryManager.load_registry()]
        self.dict_registry.sort(key=lambda x: x.get("priority", 99))
        self.dict_vars = {}
        self.render_dict_list()

        self.btn_import_dict = ctk.CTkButton(
            card,
            text="📥  Importer un Dictionnaire (.docx, .json, .csv)",
            font=ctk.CTkFont(size=11, weight="bold"),
            fg_color=("#0284C7", "#0369A1"),
            hover_color=("#0369A1", "#075985"),
            height=28,
            corner_radius=6,
            command=self.on_import_dictionary
        )
        self.btn_import_dict.pack(anchor="w", padx=16, pady=(4, 12))

    # ==================================================================
    # 5. ASSISTANT IA & CLÉS API
    # ==================================================================
    def _build_section_ai(self):
        self._create_section_header("Assistant IA & Clés API")
        card = self._create_card()

        m_frame = ctk.CTkFrame(card, fg_color="transparent")
        m_frame.pack(fill="x", padx=16, pady=(12, 4))

        self._create_field_label(m_frame, "Modèle de Chat principal :")
        self.chat_model_var = ctk.StringVar(value=self.config.get("chat_model", "gemini-3.7-flash"))
        self.chat_model_menu = ctk.CTkOptionMenu(
            m_frame,
            variable=self.chat_model_var,
            values=[
                "gemini-3.7-flash", "gemini-3.6-flash", "gemini-3.5-flash",
                "gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3-flash",
                "gemini-2.5-flash", "gemini-2.5-flash-lite",
                "mistral-small-latest", "mistral-large-latest", "open-mistral-nemo",
                "codestral-latest", "mistralai/Ministral-3-14B-Instruct-2512",
                "mistralai/Mistral-Small-4-119B-2603", "swiss-ai/Apertus-v1.5-70B",
                "google/gemma-4-31B-it", "moonshotai/Kimi-K2.6",
                "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B-FP8",
                "Qwen/Qwen3.5-122B-A10B-FP8", "Qwen/Qwen3.5-397B-A17B-FP8"
            ],
            height=30
        )
        self.chat_model_menu.pack(fill="x", pady=(0, 8))

        sub_m_grid = ctk.CTkFrame(m_frame, fg_color="transparent")
        sub_m_grid.pack(fill="x", pady=(0, 6))
        sub_m_grid.grid_columnconfigure((0, 1), weight=1)

        f_pol = ctk.CTkFrame(sub_m_grid, fg_color="transparent")
        f_pol.grid(row=0, column=0, sticky="ew", padx=(0, 6))
        self._create_field_label(f_pol, "Restauration Dictionnaires :")
        self.dict_polish_model_var = ctk.StringVar(value=self.config.get("dict_polish_model", "gemini-2.5-flash"))
        self.dict_polish_model_menu = ctk.CTkOptionMenu(
            f_pol,
            variable=self.dict_polish_model_var,
            values=[m[0] for m in AVAILABLE_POLISH_MODELS],
            height=28
        )
        self.dict_polish_model_menu.pack(fill="x")

        f_trans = ctk.CTkFrame(sub_m_grid, fg_color="transparent")
        f_trans.grid(row=0, column=1, sticky="ew", padx=(6, 0))
        self._create_field_label(f_trans, "Traduction Commentaires :")
        self.trans_model_var = ctk.StringVar(value=self.config.get("translation_model", "gemini-3.5-flash-lite"))
        self.trans_model_menu = ctk.CTkOptionMenu(
            f_trans,
            variable=self.trans_model_var,
            values=[m[0] for m in AVAILABLE_TRANSLATION_MODELS],
            height=28
        )
        self.trans_model_menu.pack(fill="x")

        ctk.CTkFrame(card, height=1, fg_color=C_BORDER).pack(fill="x", padx=16, pady=8)

        api_grid = ctk.CTkFrame(card, fg_color="transparent")
        api_grid.pack(fill="x", padx=16, pady=(0, 8))
        api_grid.grid_columnconfigure(0, weight=0, minsize=170)
        api_grid.grid_columnconfigure(1, weight=1)

        self.api_key_entry = self._create_api_entry(api_grid, row=0, label="Clé API Mistral :", val=self.config.get("mistral_api_key", ""))
        self.gemini_key_entry = self._create_api_entry(api_grid, row=1, label="Clé API Gemini :", val=self.config.get("gemini_api_key", ""))
        self.infomaniak_token_entry = self._create_api_entry(api_grid, row=2, label="Token Infomaniak AI :", val=self.config.get("infomaniak_token", ""))
        self.infomaniak_pid_entry = self._create_api_entry(api_grid, row=3, label="Product ID Infomaniak :", val=str(self.config.get("infomaniak_product_id", "")), mask=False, placeholder="ex: 251")
        self.google_books_key_entry = self._create_api_entry(api_grid, row=4, label="Clé Google Books (opt.) :", val=self.config.get("google_books_api_key", ""), placeholder="Optionnelle")

        ctk.CTkFrame(card, height=1, fg_color=C_BORDER).pack(fill="x", padx=16, pady=8)

        p_frame = ctk.CTkFrame(card, fg_color="transparent")
        p_frame.pack(fill="x", padx=16, pady=(0, 8))
        self._create_field_label(p_frame, "Prompt Système de l'Assistant IA :")
        self.prompt_text = ctk.CTkTextbox(
            p_frame,
            height=90,
            font=("Arial", 11),
            fg_color=("#FFFFFF", "#0F172A"),
            border_color=C_BORDER,
            border_width=1,
            corner_radius=6
        )
        self.prompt_text.pack(fill="both", pady=(2, 6))

        default_prompt = (
            "Vous êtes un assistant d'étude biblique théologique et analytique.\n"
            "Votre rôle est d'aider l'utilisateur à analyser et comprendre les textes sacrés et leurs commentaires associés.\n\n"
            "CONSIGNES CRITIQUES :\n"
            "1. Basez TOUJOURS vos réponses UNIQUEMENT sur le contexte fourni (Textes bibliques et Commentaires).\n"
            "2. Vous DEVEZ citer explicitement vos sources d'information à la manière de NotebookLM. Utilisez des références claires sous forme de crochets en gras comme **[Nom du document, Verset]** (ex: **[Chouraqui, Pro 1:1]** ou **[Commentaire Kathleen Nielson, Note 1-7]**) à la fin de vos phrases ou de vos paragraphes pour chaque affirmation basée sur les textes.\n"
            "3. Rédigez vos citations de manière très visible pour que l'utilisateur puisse s'y référer facilement."
        )
        self.prompt_text.insert("0.0", self.config.get("chat_system_prompt", default_prompt))

        rag_card = ctk.CTkFrame(card, fg_color=("#FFFFFF", "#0F172A"), border_color=C_BORDER, border_width=1, corner_radius=6)
        rag_card.pack(fill="x", padx=16, pady=(0, 12))

        rag_hdr = ctk.CTkFrame(rag_card, fg_color="transparent")
        rag_hdr.pack(fill="x", padx=12, pady=(8, 4))
        ctk.CTkLabel(rag_hdr, text="🧠  Pipeline RAG & Curation :", font=ctk.CTkFont(size=11, weight="bold"), text_color=C_TEXT_PRIMARY).pack(side="left")

        rag_row = ctk.CTkFrame(rag_card, fg_color="transparent")
        rag_row.pack(fill="x", padx=12, pady=4)

        ctk.CTkLabel(rag_row, text="Extraits bruts (Initial) :", font=ctk.CTkFont(size=11), text_color=C_TEXT_MUTED).pack(side="left")
        self.top_k_raw_entry = ctk.CTkEntry(rag_row, width=45, height=26, font=ctk.CTkFont(size=11))
        self.top_k_raw_entry.pack(side="left", padx=(4, 16))
        self.top_k_raw_entry.insert(0, str(self.config.get("rag_top_k_raw", 25)))

        ctk.CTkLabel(rag_row, text="Extraits retenus (Rerank) :", font=ctk.CTkFont(size=11), text_color=C_TEXT_MUTED).pack(side="left")
        self.top_k_final_entry = ctk.CTkEntry(rag_row, width=45, height=26, font=ctk.CTkFont(size=11))
        self.top_k_final_entry.pack(side="left", padx=(4, 0))
        self.top_k_final_entry.insert(0, str(self.config.get("rag_top_k_final", 7)))

        cur_row = ctk.CTkFrame(rag_card, fg_color="transparent")
        cur_row.pack(fill="x", padx=12, pady=(4, 8))

        self.curation_var = ctk.BooleanVar(value=self.config.get("rag_enable_curation", False))
        self.curation_switch = ctk.CTkSwitch(
            cur_row,
            text="Curation LLM du contexte",
            variable=self.curation_var,
            font=ctk.CTkFont(size=11)
        )
        self.curation_switch.pack(side="left", padx=(0, 10))

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
            height=26,
            font=ctk.CTkFont(size=11)
        )
        self.curation_model_menu.pack(side="right", fill="x", expand=True)

    def _create_field_label(self, parent, text):
        lbl = ctk.CTkLabel(parent, text=text, font=ctk.CTkFont(size=11, weight="bold"), text_color=C_TEXT_PRIMARY)
        lbl.pack(anchor="w", pady=(0, 2))
        return lbl

    def _create_api_entry(self, grid_parent, row, label, val="", mask=True, placeholder=""):
        lbl = ctk.CTkLabel(grid_parent, text=label, font=ctk.CTkFont(size=11), text_color=C_TEXT_PRIMARY, anchor="w")
        lbl.grid(row=row, column=0, sticky="w", pady=3)

        entry = ctk.CTkEntry(
            grid_parent,
            show="*" if mask else "",
            placeholder_text=placeholder,
            height=28,
            font=ctk.CTkFont(size=11)
        )
        entry.grid(row=row, column=1, sticky="ew", pady=3)
        if val:
            entry.insert(0, val)
        return entry

    # ==================================================================
    # 6. SAUVEGARDE & RESTAURATION COMPLÈTE
    # ==================================================================
    def _build_section_backup(self):
        self._create_section_header("Sauvegarde & Restauration Complète")
        card = self._create_card()

        included_txt = "  ".join(label for _, label in _BACKUP_COMPONENTS)
        lbl_inc = ctk.CTkLabel(
            card,
            text=f"Inclus dans l'archive ZIP : {included_txt}",
            font=ctk.CTkFont(size=10),
            text_color=C_TEXT_MUTED,
            wraplength=520,
            justify="left"
        )
        lbl_inc.pack(anchor="w", padx=16, pady=(12, 6))

        btn_frame = ctk.CTkFrame(card, fg_color="transparent")
        btn_frame.pack(fill="x", padx=16, pady=(0, 6))

        self.export_btn = ctk.CTkButton(
            btn_frame,
            text="📤  Exporter tout (ZIP)",
            width=150,
            height=32,
            font=ctk.CTkFont(size=12, weight="bold"),
            fg_color=("#2563EB", "#1D4ED8"),
            hover_color=("#1D4ED8", "#1E40AF"),
            text_color="#FFFFFF",
            corner_radius=6,
            command=self.export_db
        )
        self.export_btn.pack(side="left", padx=(0, 10))

        self.import_btn = ctk.CTkButton(
            btn_frame,
            text="📥  Restaurer depuis ZIP",
            width=160,
            height=32,
            font=ctk.CTkFont(size=12, weight="bold"),
            fg_color=("#FFFFFF", "#0F172A"),
            hover_color=("#F1F5F9", "#334155"),
            text_color=C_TEXT_PRIMARY,
            border_width=1,
            border_color=C_BORDER,
            corner_radius=6,
            command=self.import_db
        )
        self.import_btn.pack(side="left")

        self.backup_status_label = ctk.CTkLabel(
            card,
            text="",
            font=ctk.CTkFont(size=11),
            text_color=C_TEXT_MUTED
        )
        self.backup_status_label.pack(anchor="w", padx=16, pady=(0, 10))

    # ==================================================================
    # Logique Dictionnaires
    # ==================================================================
    def render_dict_list(self):
        for widget in self.dict_list_frame.winfo_children():
            widget.destroy()

        for idx, d in enumerate(self.dict_registry):
            d_id = d["id"]
            if d_id not in self.dict_vars:
                self.dict_vars[d_id] = ctk.BooleanVar(value=d.get("enabled", True))

            row = ctk.CTkFrame(self.dict_list_frame, fg_color="transparent")
            row.pack(fill="x", padx=8, pady=3)

            prio_lbl = ctk.CTkLabel(
                row,
                text=f"#{idx + 1}",
                font=ctk.CTkFont(size=11, weight="bold"),
                width=24,
                text_color=C_ACCENT
            )
            prio_lbl.pack(side="left", padx=(0, 4))

            btn_up = ctk.CTkButton(
                row,
                text="▲",
                width=20,
                height=20,
                font=ctk.CTkFont(size=9),
                fg_color="transparent",
                hover_color=("#E2E8F0", "#334155"),
                text_color=C_TEXT_PRIMARY,
                command=lambda i=idx: self.move_dict(i, -1)
            )
            btn_up.pack(side="left", padx=1)
            if idx == 0:
                btn_up.configure(state="disabled")

            btn_down = ctk.CTkButton(
                row,
                text="▼",
                width=20,
                height=20,
                font=ctk.CTkFont(size=9),
                fg_color="transparent",
                hover_color=("#E2E8F0", "#334155"),
                text_color=C_TEXT_PRIMARY,
                command=lambda i=idx: self.move_dict(i, 1)
            )
            btn_down.pack(side="left", padx=1)
            if idx == len(self.dict_registry) - 1:
                btn_down.configure(state="disabled")

            count_str = f" ({d.get('count', 0):,} art.)".replace(",", " ") if d.get("count") else ""
            cb = ctk.CTkCheckBox(
                row,
                text=f"{d['name']}{count_str}",
                variable=self.dict_vars[d_id],
                font=ctk.CTkFont(size=11)
            )
            cb.pack(side="left", padx=(6, 0), fill="x", expand=True)

    def move_dict(self, idx, direction):
        new_idx = idx + direction
        if 0 <= new_idx < len(self.dict_registry):
            self.dict_registry[idx], self.dict_registry[new_idx] = self.dict_registry[new_idx], self.dict_registry[idx]
            for i, d in enumerate(self.dict_registry):
                d["priority"] = i + 1
            self.render_dict_list()

    def on_import_dictionary(self):
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

    # ==================================================================
    # Callbacks & Helpers
    # ==================================================================
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
        pass

    def on_reindex_orig_db(self):
        self.btn_download_orig.configure(state="disabled", text="⏳ Indexation en cours...")

        def _task():
            from core.original_languages_manager import OriginalLanguagesManager
            mgr = OriginalLanguagesManager.get_instance()

            def _cb(msg, frac):
                self.after(0, lambda: self.lbl_orig_db_status.configure(text=f"⏳ [{int(frac*100)}%] {msg}", text_color="#38BDF8"))

            success = mgr.download_and_import(progress_callback=_cb)
            if success:
                st = mgr.get_stats()
                txt = f"Base STEPBible installée : {st['total_words']:,} mots (AT : {st['ot_words']:,}, NT : {st['nt_words']:,})".replace(",", " ")
                self.after(0, lambda: [
                    self.lbl_orig_db_status.configure(text=f"● {txt}", text_color="#10B981"),
                    self.btn_download_orig.configure(state="normal", text="📥  Mettre à jour les données STEPBible"),
                    messagebox.showinfo("Succès", "La base de données des textes originaux (Hébreu & Grec STEPBible) a été indexée avec succès !")
                ])
            else:
                self.after(0, lambda: [
                    self.lbl_orig_db_status.configure(text="● Erreur lors de l'indexation", text_color="#EF4444"),
                    self.btn_download_orig.configure(state="normal", text="📥  Mettre à jour les données STEPBible")
                ])

        threading.Thread(target=_task, daemon=True).start()

    def save_settings(self):
        # 1. Sauvegarder les dictionnaires
        for idx, d in enumerate(self.dict_registry):
            d_id = d["id"]
            if d_id in self.dict_vars:
                d["enabled"] = bool(self.dict_vars[d_id].get())
            d["priority"] = idx + 1
        DictionaryManager.save_registry(self.dict_registry)

        # 2. Sauvegarder la configuration
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
        self.config["translation_model"] = self.trans_model_var.get()
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

    # ==================================================================
    # Sauvegarde complète & Restauration (Export / Import)
    # ==================================================================
    def _set_backup_status(self, text, color=C_TEXT_MUTED[1]):
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
        self._set_backup_buttons(False)
        data_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
        tmp_zip = save_path + ".tmp"

        try:
            manifest = {
                "version": _BACKUP_MANIFEST_VERSION,
                "created_at": datetime.datetime.now().isoformat(),
                "components": []
            }

            with zipfile.ZipFile(tmp_zip, "w", compression=zipfile.ZIP_DEFLATED, allowZip64=True) as zf:
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
                        for root, _, files in os.walk(src):
                            for fname in files:
                                full = os.path.join(root, fname)
                                rel = os.path.relpath(full, data_dir)
                                zf.write(full, os.path.join("data", rel))
                        manifest["components"].append(folder_or_file)

                zf.writestr("backup_manifest.json", json.dumps(manifest, ensure_ascii=False, indent=2))

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
                f"dictionnaires, couvertures et paramètres."
            ))
        except Exception as e:
            if os.path.exists(tmp_zip):
                try: os.remove(tmp_zip)
                except OSError: pass
            self._set_backup_status(f"❌ Erreur : {e}", color="#EF4444")
            self.after(0, lambda: messagebox.showerror("Erreur d'export", f"La sauvegarde a échoué :\n{e}"))
        finally:
            self._set_backup_buttons(True)

    def import_db(self):
        def _pick_and_import():
            zip_path = filedialog.askopenfilename(
                filetypes=[("Sauvegarde Bible AI", "*.zip"), ("Tous les fichiers", "*.*")],
                title="Sélectionner la sauvegarde à restaurer"
            )
            if not zip_path:
                return

            try:
                with zipfile.ZipFile(zip_path, "r") as zf:
                    names = zf.namelist()
                    if "backup_manifest.json" not in names or not any(n.startswith("data/") for n in names):
                        messagebox.showerror(
                            "Fichier invalide",
                            "Ce fichier ZIP ne semble pas être une sauvegarde Bible AI valide."
                        )
                        return
                    manifest = json.loads(zf.read("backup_manifest.json"))
                    created = manifest.get("created_at", "inconnue")[:19].replace("T", " ")
                    components = manifest.get("components", [])
                    comp_str = ", ".join(components)
            except Exception as e:
                messagebox.showerror("Erreur", f"Lecture du fichier impossible : {e}")
                return

            confirmed = messagebox.askyesno(
                "Confirmer la restauration",
                f"Sauvegarde du : {created}\n"
                f"Composants   : {comp_str}\n\n"
                "⚠️ Cette opération REMPLACERA toutes vos données actuelles par celles de la sauvegarde.\n\n"
                "L'application devra être redémarrée après.\n\nContinuer ?"
            )
            if confirmed:
                threading.Thread(target=self._do_import, args=(zip_path,), daemon=True).start()

        self.after(100, _pick_and_import)

    def _do_import(self, zip_path: str):
        self._set_backup_buttons(False)
        data_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")

        try:
            with zipfile.ZipFile(zip_path, "r") as zf:
                manifest = json.loads(zf.read("backup_manifest.json"))
                components = manifest.get("components", [])

                for component in components:
                    label = next((lbl for key, lbl in _BACKUP_COMPONENTS if key == component), component)
                    self._set_backup_status(f"⏳ Restauration : {label}…")

                    dest = os.path.join(data_dir, component)
                    if os.path.isdir(dest):
                        shutil.rmtree(dest, ignore_errors=True)
                    elif os.path.isfile(dest):
                        os.remove(dest)

                    prefix = f"data/{component}"
                    entries = [n for n in zf.namelist() if n.startswith(prefix)]
                    for entry in entries:
                        target = os.path.join(data_dir, os.path.relpath(entry, "data"))
                        if entry.endswith("/"):
                            os.makedirs(target, exist_ok=True)
                        else:
                            os.makedirs(os.path.dirname(target), exist_ok=True)
                            with zf.open(entry) as src_f, open(target, "wb") as dst_f:
                                shutil.copyfileobj(src_f, dst_f)

            self._set_backup_status("✅ Restauration terminée — redémarrez l'application.", color="#10B981")
            self.after(0, lambda: messagebox.showinfo(
                "Restauration terminée",
                "Toutes vos données ont été restaurées avec succès !\n\n"
                "Fermez et relancez l'application pour charger la configuration restaurée."
            ))
        except Exception as e:
            self._set_backup_status(f"❌ Erreur de restauration : {e}", color="#EF4444")
            self.after(0, lambda: messagebox.showerror("Erreur de restauration", f"La restauration a échoué :\n{e}"))
        finally:
            self._set_backup_buttons(True)
