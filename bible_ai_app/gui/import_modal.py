import customtkinter as ctk
from tkinter import messagebox
from gui import native_dialog as filedialog
import re
import os
import shutil
import json
from PIL import Image
from core.bible_json_loader import BibleJsonLoader
from core.epub_loader import EpubLoader
from core.book_classifier import BookClassifier
from core.reference_parser import REVERSE_BOOK_MAPPING, BOOK_MAPPING
from gui.google_books_picker import BookMetadataPickerModal

class ImportTab(ctk.CTkScrollableFrame):
    """
    Interface plein écran pour l'importation et l'édition d'ouvrages,
    avec agencement spacieux en 2 colonnes, défilement fluide et design soigné.
    Supporte les EPUBs, Bibles JSON/CSV, DOCX et documents généraux avec auto-classification par chapitre.
    """
    def __init__(self, master, close_callback=None, on_import_callback=None, edit_mode=False, edit_meta=None, **kwargs):
        super().__init__(master, fg_color="transparent", **kwargs)
        
        self.close_callback = close_callback
        self.on_import_callback = on_import_callback
        self.edit_mode = edit_mode
        self.edit_meta = edit_meta or {}
        
        self.file_path = None
        self.folder_path = None
        self.cover_path = self.edit_meta.get("cover_path", None)
        self.epub_chapters = []
        self.chapter_check_vars = {}
        
        # 1. EN-TÊTE PRINCIPAL
        header_frame = ctk.CTkFrame(self, fg_color="transparent")
        header_frame.pack(fill="x", padx=20, pady=(10, 15))
        
        title_text = "✏️ Modifier les Métadonnées de l'Ouvrage" if self.edit_mode else "📥 Importer un Nouvel Ouvrage dans la Bibliothèque"
        lbl_main_title = ctk.CTkLabel(
            header_frame, 
            text=title_text, 
            font=ctk.CTkFont(size=20, weight="bold"),
            anchor="w"
        )
        lbl_main_title.pack(fill="x", anchor="w")
        
        lbl_subtitle = ctk.CTkLabel(
            header_frame,
            text="Renseignez les métadonnées, associez une image de couverture et sélectionnez votre fichier source (.epub, .docx, .json, .csv ou dossier complet de Bible).",
            font=ctk.CTkFont(size=12),
            text_color=("#64748B", "#94A3B8"),
            anchor="w"
        )
        lbl_subtitle.pack(fill="x", anchor="w", pady=(2, 0))

        # 2. CONTENEUR PRINCIPAL EN 2 COLONNES SPACIEUSES
        columns_frame = ctk.CTkFrame(self, fg_color="transparent")
        columns_frame.pack(fill="both", expand=True, padx=20, pady=5)
        columns_frame.grid_columnconfigure(0, weight=3, uniform="cols")
        columns_frame.grid_columnconfigure(1, weight=3, uniform="cols")
        
        # ==========================================
        # COLONNE GAUCHE : MÉTADONNÉES & CLASSIFICATION
        # ==========================================
        left_card = ctk.CTkFrame(
            columns_frame, 
            fg_color=("#F8FAFC", "#1E293B"), 
            border_color=("#CBD5E1", "#334155"), 
            border_width=1, 
            corner_radius=12
        )
        left_card.grid(row=0, column=0, sticky="nsew", padx=(0, 10), pady=0)
        
        # En-tête de la carte gauche : Titre & Bouton de Recherche Google Books
        card_left_header = ctk.CTkFrame(left_card, fg_color="transparent")
        card_left_header.pack(fill="x", padx=20, pady=(16, 10))
        card_left_header.grid_columnconfigure(0, weight=1)
        
        card_left_title = ctk.CTkLabel(
            card_left_header, 
            text="📋 Informations Générales", 
            font=ctk.CTkFont(size=15, weight="bold"), 
            text_color=("#2563EB", "#38BDF8")
        )
        card_left_title.grid(row=0, column=0, sticky="w")
        
        self.btn_search_meta = ctk.CTkButton(
            card_left_header,
            text="🔍 Google Books",
            command=self.open_metadata_search,
            fg_color="#0284C7",
            hover_color="#0369A1",
            height=30,
            font=ctk.CTkFont(size=12, weight="bold")
        )
        self.btn_search_meta.grid(row=0, column=1, sticky="e")
        
        # Champ Identifiant (Titre court)
        lbl_id = ctk.CTkLabel(left_card, text="Titre court / Identifiant unique (ex: S21, Alexander, Calmet) :", font=ctk.CTkFont(weight="bold"))
        lbl_id.pack(padx=20, pady=(4, 2), anchor="w")
        self.name_entry = ctk.CTkEntry(left_card, placeholder_text="Ex: Segond 21, Alexander, Calmet...", height=34)
        self.name_entry.pack(fill="x", padx=20, pady=(0, 8))
        if self.edit_mode:
            self.name_entry.insert(0, self.edit_meta.get("name", ""))
        
        # Champ Titre complet
        lbl_title = ctk.CTkLabel(left_card, text="Titre complet de l'ouvrage :", font=ctk.CTkFont(weight="bold"))
        lbl_title.pack(padx=20, pady=(4, 2), anchor="w")
        self.title_entry = ctk.CTkEntry(left_card, placeholder_text="Ex: Lire et comprendre la Bible...", height=34)
        self.title_entry.pack(fill="x", padx=20, pady=(0, 8))
        self.title_entry.insert(0, self.edit_meta.get("title", ""))
        
        # Champ Auteur / Traducteur
        lbl_author = ctk.CTkLabel(left_card, text="Auteur / Traducteur / Éditeur :", font=ctk.CTkFont(weight="bold"))
        lbl_author.pack(padx=20, pady=(4, 2), anchor="w")
        self.author_entry = ctk.CTkEntry(left_card, placeholder_text="Ex: J.H. Alexander, Alfred Kuen...", height=34)
        self.author_entry.pack(fill="x", padx=20, pady=(0, 8))
        self.author_entry.insert(0, self.edit_meta.get("author", ""))
        
        # Champ Description
        lbl_desc = ctk.CTkLabel(left_card, text="Description & Notes d'étude :", font=ctk.CTkFont(weight="bold"))
        lbl_desc.pack(padx=20, pady=(4, 2), anchor="w")
        self.desc_entry = ctk.CTkTextbox(left_card, height=70, corner_radius=8)
        self.desc_entry.pack(fill="x", padx=20, pady=(0, 8))
        self.desc_entry.insert("1.0", self.edit_meta.get("description", ""))
        
        # Ligne Année & Type d'ouvrage
        row_type_year = ctk.CTkFrame(left_card, fg_color="transparent")
        row_type_year.pack(fill="x", padx=20, pady=(4, 8))
        row_type_year.grid_columnconfigure(0, weight=1)
        row_type_year.grid_columnconfigure(1, weight=1)
        
        # Type
        frame_type = ctk.CTkFrame(row_type_year, fg_color="transparent")
        frame_type.grid(row=0, column=0, sticky="nsew", padx=(0, 8))
        lbl_type = ctk.CTkLabel(frame_type, text="Type de ressource :", font=ctk.CTkFont(weight="bold"))
        lbl_type.pack(anchor="w", pady=(0, 2))
        self.type_var = ctk.StringVar(value=self.edit_meta.get("type", "Théologie" if not self.edit_mode else "Théologie"))
        self.type_menu = ctk.CTkOptionMenu(
            frame_type, 
            variable=self.type_var, 
            values=["Théologie", "Bible", "Commentaire", "Dictionnaire", "Livre / Autre"],
            height=34
        )
        self.type_menu.pack(fill="x")
        
        # Année
        frame_year = ctk.CTkFrame(row_type_year, fg_color="transparent")
        frame_year.grid(row=0, column=1, sticky="nsew", padx=(8, 0))
        lbl_year = ctk.CTkLabel(frame_year, text="Année d'édition :", font=ctk.CTkFont(weight="bold"))
        lbl_year.pack(anchor="w", pady=(0, 2))
        self.year_entry = ctk.CTkEntry(frame_year, placeholder_text="Ex: 2007", height=34)
        self.year_entry.pack(fill="x")
        self.year_entry.insert(0, str(self.edit_meta.get("year", "")))
        
        # ==========================================
        # SECTION CLASSIFICATION RAG TRI-FLUX
        # ==========================================
        rag_box = ctk.CTkFrame(left_card, fg_color=("#EEF2F6", "#0F172A"), corner_radius=8, border_color=("#CBD5E1", "#334155"), border_width=1)
        rag_box.pack(fill="x", padx=20, pady=(6, 12))
        
        rag_header = ctk.CTkFrame(rag_box, fg_color="transparent")
        rag_header.pack(fill="x", padx=12, pady=(8, 4))
        rag_header.grid_columnconfigure(0, weight=1)
        
        lbl_rag_title = ctk.CTkLabel(
            rag_header, 
            text="🎯 Classification RAG Tri-Flux", 
            font=ctk.CTkFont(size=13, weight="bold"), 
            text_color=("#7C3AED", "#A78BFA")
        )
        lbl_rag_title.grid(row=0, column=0, sticky="w")
        
        self.btn_auto_classify = ctk.CTkButton(
            rag_header,
            text="✨ Auto-classifier (IA)",
            command=self.run_auto_classify,
            fg_color="#7C3AED",
            hover_color="#6D28D9",
            height=26,
            font=ctk.CTkFont(size=11, weight="bold")
        )
        self.btn_auto_classify.grid(row=0, column=1, sticky="e")
        
        row_rag_fields = ctk.CTkFrame(rag_box, fg_color="transparent")
        row_rag_fields.pack(fill="x", padx=12, pady=(0, 8))
        row_rag_fields.grid_columnconfigure(0, weight=1)
        row_rag_fields.grid_columnconfigure(1, weight=1)
        
        # Scope / Testament
        f_scope = ctk.CTkFrame(row_rag_fields, fg_color="transparent")
        f_scope.grid(row=0, column=0, sticky="nsew", padx=(0, 6))
        lbl_scope = ctk.CTkLabel(f_scope, text="Portée du corpus :", font=ctk.CTkFont(size=11, weight="bold"))
        lbl_scope.pack(anchor="w")
        raw_scope = self.edit_meta.get("corpus_scope", "GLOBAL")
        init_scope = "AT" if raw_scope == "OT" else ("AT+NT" if raw_scope == "BOTH" else ("APO" if raw_scope in ["APOCRYPHA", "APO"] else raw_scope))
        self.corpus_scope_var = ctk.StringVar(value=init_scope)
        self.scope_menu = ctk.CTkOptionMenu(
            f_scope,
            variable=self.corpus_scope_var,
            values=["GLOBAL", "AT", "NT", "AT+NT", "INTER", "APO"],
            height=30
        )
        self.scope_menu.pack(fill="x", pady=(2, 0))
        
        # Source Type
        f_stype = ctk.CTkFrame(row_rag_fields, fg_color="transparent")
        f_stype.grid(row=0, column=1, sticky="nsew", padx=(6, 0))
        lbl_stype = ctk.CTkLabel(f_stype, text="Type de source RAG :", font=ctk.CTkFont(size=11, weight="bold"))
        lbl_stype.pack(anchor="w")
        self.source_type_var = ctk.StringVar(value=self.edit_meta.get("source_type", "general"))
        self.stype_menu = ctk.CTkOptionMenu(
            f_stype,
            variable=self.source_type_var,
            values=[
                "general",
                "book_intro",
                "biblical_theology",
                "systematic_theology",
                "ot_context",
                "nt_context",
                "commentary_verse",
                "dictionary"
            ],
            height=30
        )
        self.stype_menu.pack(fill="x", pady=(2, 0))
        
        # Livre biblique cible (Optionnel)
        f_bcode = ctk.CTkFrame(rag_box, fg_color="transparent")
        f_bcode.pack(fill="x", padx=12, pady=(0, 10))
        lbl_bcode = ctk.CTkLabel(f_bcode, text="Livre biblique concerné (si spécifique) :", font=ctk.CTkFont(size=11, weight="bold"))
        lbl_bcode.pack(anchor="w")
        
        bible_book_options = ["(Aucun - Thème transversal ou multi-livres)"]
        for code, fr_name in sorted(REVERSE_BOOK_MAPPING.items(), key=lambda x: x[1]):
            bible_book_options.append(f"{code} - {fr_name}")
            
        cur_bcode = self.edit_meta.get("book_code")
        default_bcode_val = "(Aucun - Thème transversal ou multi-livres)"
        if cur_bcode and cur_bcode in REVERSE_BOOK_MAPPING:
            default_bcode_val = f"{cur_bcode} - {REVERSE_BOOK_MAPPING[cur_bcode]}"
            
        self.book_code_var = ctk.StringVar(value=default_bcode_val)
        self.bcode_menu = ctk.CTkOptionMenu(
            f_bcode,
            variable=self.book_code_var,
            values=bible_book_options,
            height=30
        )
        self.bcode_menu.pack(fill="x", pady=(2, 0))

        # Modèle d'Embedding (Vectorisation IA)
        lbl_embed = ctk.CTkLabel(left_card, text="Modèle d'embedding vectoriel (Recherche IA) :", font=ctk.CTkFont(weight="bold"))
        lbl_embed.pack(padx=20, pady=(2, 2), anchor="w")
        self.embed_var = ctk.StringVar(value=self.edit_meta.get("embedding_model", "bge_multilingual_gemma2 (Infomaniak)"))
        self.embed_menu = ctk.CTkOptionMenu(
            left_card, 
            variable=self.embed_var, 
            values=[
                "bge_multilingual_gemma2 (Infomaniak)",
                "mini_lm_l12_v2 (Infomaniak)",
                "gemini-embedding-2",
                "gemini-embedding-1",
                "study_library",
                "mistral-embed"
            ],
            height=34
        )
        self.embed_menu.pack(fill="x", padx=20, pady=(0, 16))

        # ==========================================
        # COLONNE DROITE : COUVERTURE & SOURCE / CHAPITRES
        # ==========================================
        right_card = ctk.CTkFrame(
            columns_frame, 
            fg_color=("#F8FAFC", "#1E293B"), 
            border_color=("#CBD5E1", "#334155"), 
            border_width=1, 
            corner_radius=12
        )
        right_card.grid(row=0, column=1, sticky="nsew", padx=(10, 0), pady=0)
        
        card_right_title = ctk.CTkLabel(
            right_card, 
            text="🖼️ Couverture & Source de Données", 
            font=ctk.CTkFont(size=15, weight="bold"), 
            text_color=("#2563EB", "#38BDF8")
        )
        card_right_title.pack(anchor="w", padx=20, pady=(16, 10))
        
        # Zone Image de Couverture
        cover_container = ctk.CTkFrame(right_card, fg_color="transparent")
        cover_container.pack(fill="x", padx=20, pady=(0, 10))
        
        self.cover_lbl = ctk.CTkLabel(
            cover_container, 
            text="Aucune image\n(Générée automatiquement)", 
            width=160, 
            height=200, 
            fg_color=("#E2E8F0", "#0F172A"), 
            corner_radius=8,
            font=ctk.CTkFont(size=12, slant="italic")
        )
        self.cover_lbl.pack(pady=(0, 8))
        
        cover_btns_row = ctk.CTkFrame(cover_container, fg_color="transparent")
        cover_btns_row.pack(fill="x")
        cover_btns_row.grid_columnconfigure(0, weight=1)
        cover_btns_row.grid_columnconfigure(1, weight=1)
        
        btn_choose_cover = ctk.CTkButton(
            cover_btns_row, 
            text="🖼️ Image locale", 
            command=self.choose_cover,
            height=30
        )
        btn_choose_cover.grid(row=0, column=0, sticky="ew", padx=(0, 4))
        
        btn_ocr = ctk.CTkButton(
            cover_btns_row, 
            text="✨ Gemini OCR", 
            command=self.do_ocr, 
            fg_color="#3B82F6",
            hover_color="#2563EB",
            height=30
        )
        btn_ocr.grid(row=0, column=1, sticky="ew", padx=(4, 0))
        
        # Séparateur subtil
        sep = ctk.CTkLabel(right_card, text="─" * 40, text_color=("#CBD5E1", "#334155"))
        sep.pack(pady=2)
        
        # Zone Fichier Source (si nouveau import)
        if not self.edit_mode:
            lbl_src_title = ctk.CTkLabel(right_card, text="Document source à importer :", font=ctk.CTkFont(weight="bold"))
            lbl_src_title.pack(anchor="w", padx=20, pady=(2, 4))
            
            src_btns_row = ctk.CTkFrame(right_card, fg_color="transparent")
            src_btns_row.pack(fill="x", padx=20, pady=(0, 6))
            src_btns_row.grid_columnconfigure(0, weight=1)
            src_btns_row.grid_columnconfigure(1, weight=1)
            
            self.btn_file = ctk.CTkButton(
                src_btns_row, 
                text="📂 Document (.epub, .docx, .json)", 
                command=self.choose_file,
                fg_color="#4F46E5",
                hover_color="#4338CA",
                height=36,
                font=ctk.CTkFont(weight="bold")
            )
            self.btn_file.grid(row=0, column=0, sticky="ew", padx=(0, 4))

            self.btn_folder = ctk.CTkButton(
                src_btns_row, 
                text="📁 Dossier Bible JSON", 
                command=self.choose_folder,
                fg_color=("#64748B", "#334155"),
                hover_color=("#475569", "#475569"),
                height=36
            )
            self.btn_folder.grid(row=0, column=1, sticky="ew", padx=(4, 0))
            
            self.file_lbl = ctk.CTkLabel(
                right_card, 
                text="Aucune source sélectionnée", 
                font=ctk.CTkFont(size=11, slant="italic"),
                text_color=("#64748B", "#94A3B8")
            )
            self.file_lbl.pack(padx=20, pady=(0, 8), anchor="w")

        # Zone d'inspection de la Table des Matières / Chapitres EPUB
        self.chapters_frame = ctk.CTkFrame(right_card, fg_color="transparent")
        self.chapters_frame.pack(fill="both", expand=True, padx=20, pady=(0, 16))

        # 3. BARRE D'ACTIONS INFÉRIEURE
        action_frame = ctk.CTkFrame(self, fg_color="transparent")
        action_frame.pack(fill="x", padx=20, pady=(15, 20))
        
        btn_text = "💾 Enregistrer les Modifications" if self.edit_mode else "🚀 Lancer l'Importation & l'Indexation"
        self.btn_import = ctk.CTkButton(
            action_frame, 
            text=btn_text, 
            command=self.save, 
            fg_color="#10B981", 
            hover_color="#059669", 
            height=44,
            font=ctk.CTkFont(size=14, weight="bold"),
            corner_radius=8
        )
        self.btn_import.pack(fill="x")
        
        self.load_cover_preview()
        
    def load_cover_preview(self):
        if self.cover_path and os.path.exists(self.cover_path):
            try:
                img = Image.open(self.cover_path)
                ctk_img = ctk.CTkImage(img, size=(160, 200))
                self.cover_lbl.configure(image=ctk_img, text="")
            except Exception:
                pass
            
    def choose_cover(self):
        def _open():
            path = filedialog.askopenfilename(
                title="Sélectionner une image de couverture",
                filetypes=[("Images (*.jpg, *.png)", "*.jpg *.png *.jpeg"), ("Tous les fichiers", "*.*")]
            )
            if path:
                self.cover_path = path
                self.load_cover_preview()
        self.after(100, _open)
            
    def do_ocr(self):
        if not self.cover_path or not os.path.exists(self.cover_path):
            self.choose_cover()
            
        if not self.cover_path or not os.path.exists(self.cover_path):
            return
            
        import threading
        from ai.llm_client import analyze_image_ocr
        from core.config import load_config
        
        config = load_config()
        if not config.get("mistral_api_key") and not config.get("gemini_api_key"):
            messagebox.showerror("Erreur", "Veuillez configurer votre clé API dans les Paramètres pour utiliser l'OCR.")
            return
            
        def run_ocr():
            try:
                self.after(0, lambda: self.name_entry.delete(0, "end"))
                self.after(0, lambda: self.name_entry.insert(0, "Analyse OCR en cours..."))
                
                res = analyze_image_ocr(self.cover_path, config)
                
                self.after(0, self.fill_ocr_results, res)
            except Exception as e:
                self.after(0, lambda: self.name_entry.delete(0, "end"))
                self.after(0, lambda err=e: messagebox.showerror("Erreur OCR", str(err)))
                
        threading.Thread(target=run_ocr, daemon=True).start()

    def run_auto_classify(self):
        """Déclenche la classification IA ou heuristique du livre."""
        title = self.title_entry.get().strip() or self.name_entry.get().strip()
        desc = self.desc_entry.get("1.0", "end-1c").strip()
        
        if not title:
            messagebox.showwarning("Attention", "Veuillez saisir au moins un titre ou choisir un document avant de lancer la classification.")
            return

        from core.config import load_config
        config = load_config()
        api_keys = {
            "gemini_api_key": config.get("gemini_api_key", ""),
            "mistral_api_key": config.get("mistral_api_key", ""),
            "infomaniak_token": config.get("infomaniak_token", ""),
            "infomaniak_product_id": config.get("infomaniak_product_id", "251")
        }

        # 1. Classification locale heuristique immédiate
        h_res = BookClassifier.heuristic_classify(title, desc)
        self.apply_classification_dict(h_res)

        # 2. Si clé API disponible, affiner avec le LLM en arrière-plan
        if api_keys.get("gemini_api_key") or api_keys.get("mistral_api_key") or api_keys.get("infomaniak_token"):
            import threading
            def _async_classify():
                res = BookClassifier.classify_metadata(title, desc, api_keys)
                self.after(0, lambda: self.apply_classification_dict(res))
            threading.Thread(target=_async_classify, daemon=True).start()

    def apply_classification_dict(self, res):
        if not res:
            return
        if "corpus_scope" in res and res["corpus_scope"]:
            raw_s = res["corpus_scope"]
            disp_s = "AT" if raw_s == "OT" else ("AT+NT" if raw_s == "BOTH" else ("APO" if raw_s in ["APOCRYPHA", "APO"] else raw_s))
            self.corpus_scope_var.set(disp_s)
        if "source_type" in res and res["source_type"]:
            self.source_type_var.set(res["source_type"])
        if "book_code" in res:
            b_code = res["book_code"]
            if b_code and b_code in REVERSE_BOOK_MAPPING:
                self.book_code_var.set(f"{b_code} - {REVERSE_BOOK_MAPPING[b_code]}")
            else:
                self.book_code_var.set("(Aucun - Thème transversal ou multi-livres)")
        
    def open_metadata_search(self):
        """Ouvre la modale de recherche de métadonnées Google Books & Open Library."""
        initial_title = self.title_entry.get().strip() or self.name_entry.get().strip()
        initial_author = self.author_entry.get().strip()
        
        if not initial_title and not initial_author and self.file_path:
            base = os.path.splitext(os.path.basename(self.file_path))[0]
            initial_title = re.sub(r'\(.*?\)', '', base).replace("_", " ").replace("-", " ").strip()
            
        current_data = {
            "name": self.name_entry.get().strip(),
            "title": self.title_entry.get().strip(),
            "author": self.author_entry.get().strip(),
            "year": self.year_entry.get().strip(),
            "description": self.desc_entry.get("1.0", "end-1c").strip(),
            "cover_path": self.cover_path
        }
        
        BookMetadataPickerModal(
            self,
            initial_query=initial_title,
            initial_author=initial_author,
            current_data=current_data,
            on_apply_callback=self.apply_metadata_diff
        )

    def apply_metadata_diff(self, applied_data):
        """Applique les métadonnées sélectionnées depuis le comparatif."""
        if not applied_data:
            return
            
        if "name" in applied_data and applied_data["name"]:
            self.name_entry.delete(0, "end")
            self.name_entry.insert(0, applied_data["name"])
            
        if "title" in applied_data and applied_data["title"]:
            self.title_entry.delete(0, "end")
            self.title_entry.insert(0, applied_data["title"])
            
        if "author" in applied_data and applied_data["author"]:
            self.author_entry.delete(0, "end")
            self.author_entry.insert(0, applied_data["author"])
            
        if "year" in applied_data and applied_data["year"]:
            self.year_entry.delete(0, "end")
            self.year_entry.insert(0, str(applied_data["year"]))
            
        if "description" in applied_data and applied_data["description"]:
            self.desc_entry.delete("1.0", "end")
            self.desc_entry.insert("1.0", applied_data["description"])
            
        if "cover_path" in applied_data and applied_data["cover_path"]:
            self.cover_path = applied_data["cover_path"]
            self.load_cover_preview()

        # Auto-classifier
        self.run_auto_classify()
            
    def fill_ocr_results(self, res):
        self.name_entry.delete(0, "end")
        self.name_entry.insert(0, res.get("id", ""))
        self.title_entry.delete(0, "end")
        self.title_entry.insert(0, res.get("title", ""))
        self.author_entry.delete(0, "end")
        self.author_entry.insert(0, res.get("author", ""))
        self.year_entry.delete(0, "end")
        self.year_entry.insert(0, res.get("year", ""))
        self.desc_entry.delete("1.0", "end")
        self.desc_entry.insert("1.0", res.get("description", ""))
        self.run_auto_classify()
        
    def choose_folder(self):
        def _open():
            folder = filedialog.askdirectory(
                title="Sélectionner le dossier contenant les fichiers JSON de la Bible (ex: data_segond_21)"
            )
            if folder:
                json_files = [f for f in os.listdir(folder) if f.endswith(".json")]
                if not json_files:
                    messagebox.showerror("Erreur", "Aucun fichier .json trouvé dans le dossier sélectionné.")
                    return
                self.folder_path = folder
                self.file_path = None
                self.epub_chapters = []
                self.render_chapters_inspector([])
                self.file_lbl.configure(text=f"📁 Dossier Bible JSON ({len(json_files)} livres) : {os.path.basename(folder)}")
                
                try:
                    with open(os.path.join(folder, json_files[0]), "r", encoding="utf-8") as fp:
                        data = json.load(fp)
                    version_code = data.get("version", "")
                    version_fullname = data.get("version_fullname", "")
                    
                    id_name = "Segond 21" if version_code.upper() == "S21" else (version_code or os.path.basename(folder))
                    self.name_entry.delete(0, "end")
                    self.name_entry.insert(0, id_name)
                    
                    self.title_entry.delete(0, "end")
                    self.title_entry.insert(0, id_name)
                    
                    self.author_entry.delete(0, "end")
                    if version_code.upper() == "S21":
                        self.author_entry.insert(0, "Société Biblique de Genève")
                        
                    self.year_entry.delete(0, "end")
                    if version_code.upper() == "S21":
                        self.year_entry.insert(0, "2007")
                        
                    self.desc_entry.delete("1.0", "end")
                    self.desc_entry.insert("1.0", version_fullname or f"Bible {id_name}")
                    
                    self.type_var.set("Bible")
                except Exception as e:
                    print("Erreur auto-remplissage JSON :", e)
        self.after(100, _open)

    def choose_file(self):
        def _open():
            path = filedialog.askopenfilename(
                title="Sélectionner un ouvrage (.epub, .docx, .json, .csv)",
                filetypes=[
                    ("Ouvrages & Documents (*.epub, *.docx, *.json, *.csv)", "*.epub *.docx *.json *.csv"),
                    ("Ebooks EPUB (*.epub)", "*.epub"),
                    ("Documents Word (*.docx)", "*.docx"),
                    ("Fichiers JSON (*.json)", "*.json"),
                    ("Bibles CSV (*.csv)", "*.csv"),
                    ("Tous les fichiers (*.*)", "*.*")
                ]
            )
            if path:
                self.file_path = path
                self.folder_path = None
                self.file_lbl.configure(text=f"📄 Fichier : {os.path.basename(path)}")
                
                # CAS 1 : EPUB (Livres de théologie générale, commentaires, manuels)
                if path.lower().endswith(".epub"):
                    try:
                        res = EpubLoader.inspect_epub(path)
                        
                        # Remplir le titre
                        title_val = res.get("title") or os.path.splitext(os.path.basename(path))[0]
                        short_id = re.sub(r'[^a-zA-Z0-9]', '', title_val)[:12]
                        
                        self.name_entry.delete(0, "end")
                        self.name_entry.insert(0, short_id)
                        
                        self.title_entry.delete(0, "end")
                        self.title_entry.insert(0, title_val)
                        
                        if res.get("author"):
                            self.author_entry.delete(0, "end")
                            self.author_entry.insert(0, res["author"])
                            
                        if res.get("year"):
                            self.year_entry.delete(0, "end")
                            self.year_entry.insert(0, res["year"])
                            
                        if res.get("description"):
                            self.desc_entry.delete("1.0", "end")
                            self.desc_entry.insert("1.0", res["description"])
                            
                        if res.get("cover_path") and os.path.exists(res["cover_path"]):
                            self.cover_path = res["cover_path"]
                            self.load_cover_preview()
                            
                        self.type_var.set("Théologie")
                        
                        # Classification globale
                        h_res = BookClassifier.heuristic_classify(title_val, res.get("description", ""))
                        self.apply_classification_dict(h_res)
                        
                        # Afficher les chapitres dans l'inspecteur
                        self.epub_chapters = res.get("chapters", [])
                        self.render_chapters_inspector(self.epub_chapters)
                        
                    except Exception as e:
                        messagebox.showerror("Erreur EPUB", f"Impossible d'analyser l'EPUB : {e}")

                # CAS 2 : CSV Bible
                elif path.lower().endswith(".csv"):
                    self.epub_chapters = []
                    self.render_chapters_inspector([])
                    try:
                        filename_base = os.path.splitext(os.path.basename(path))[0]
                        detected_title = filename_base.replace("_", " ").replace("-", " ").title()
                        detected_id = re.sub(r'[^a-zA-Z0-9]', '', detected_title)[:6].upper()
                        self.name_entry.delete(0, "end")
                        self.name_entry.insert(0, detected_id)
                        self.title_entry.delete(0, "end")
                        self.title_entry.insert(0, detected_title)
                        self.desc_entry.delete("1.0", "end")
                        self.desc_entry.insert("1.0", f"Bible {detected_title} (Interlinéaire / Strong)")
                        self.type_var.set("Bible")
                    except Exception as e:
                        print("Erreur auto-remplissage CSV :", e)
                
                # CAS 3 : Fichier JSON unique de Bible
                elif path.lower().endswith(".json"):
                    self.epub_chapters = []
                    self.render_chapters_inspector([])
                    try:
                        filename_base = os.path.splitext(os.path.basename(path))[0]
                        detected_title = filename_base.replace("_", " ").title()
                        detected_id = detected_title[:4].upper().strip()
                        self.name_entry.delete(0, "end")
                        self.name_entry.insert(0, detected_id)
                        self.title_entry.delete(0, "end")
                        self.title_entry.insert(0, detected_title)
                        self.desc_entry.delete("1.0", "end")
                        self.desc_entry.insert("1.0", f"Bible {detected_title}")
                        self.type_var.set("Bible")
                    except Exception as e:
                        print("Erreur auto-remplissage single JSON:", e)

                # CAS 4 : Autre document (DOCX, TXT)
                else:
                    self.epub_chapters = []
                    self.render_chapters_inspector([])
                    filename_base = os.path.splitext(os.path.basename(path))[0]
                    clean_t = filename_base.replace("_", " ").replace("-", " ").title()
                    self.name_entry.delete(0, "end")
                    self.name_entry.insert(0, clean_t[:10])
                    self.title_entry.delete(0, "end")
                    self.title_entry.insert(0, clean_t)
                    self.type_var.set("Théologie")
                    self.run_auto_classify()

        self.after(100, _open)

    def render_chapters_inspector(self, chapters):
        """Affiche le tableau interactif d'inspection des chapitres et de leur classification."""
        for widget in self.chapters_frame.winfo_children():
            widget.destroy()

        self.chapter_check_vars = {}

        if not chapters:
            return

        # En-tête de l'inspecteur
        header_row = ctk.CTkFrame(self.chapters_frame, fg_color="transparent")
        header_row.pack(fill="x", pady=(0, 4))
        
        lbl_info = ctk.CTkLabel(
            header_row, 
            text=f"📑 Table des Matières ({len(chapters)} chapitres détectés)", 
            font=ctk.CTkFont(size=13, weight="bold"),
            text_color=("#2563EB", "#38BDF8")
        )
        lbl_info.pack(side="left")

        # Boutons de sélection rapide
        btn_box = ctk.CTkFrame(header_row, fg_color="transparent")
        btn_box.pack(side="right")

        btn_all = ctk.CTkButton(
            btn_box, 
            text="Tout cocher", 
            width=70, 
            height=24, 
            font=ctk.CTkFont(size=10),
            command=lambda: self.toggle_all_chapters(True)
        )
        btn_all.pack(side="left", padx=2)

        btn_none = ctk.CTkButton(
            btn_box, 
            text="Tout décocher", 
            width=75, 
            height=24, 
            font=ctk.CTkFont(size=10),
            fg_color=("#94A3B8", "#475569"),
            command=lambda: self.toggle_all_chapters(False)
        )
        btn_none.pack(side="left", padx=2)

        btn_auto = ctk.CTkButton(
            btn_box, 
            text="RAG Seul", 
            width=65, 
            height=24, 
            font=ctk.CTkFont(size=10, weight="bold"),
            fg_color="#7C3AED",
            hover_color="#6D28D9",
            command=self.select_rag_only_chapters
        )
        btn_auto.pack(side="left", padx=2)

        # Zone scrollable des chapitres
        scroll_chapters = ctk.CTkScrollableFrame(
            self.chapters_frame, 
            height=240, 
            fg_color=("#FFFFFF", "#0F172A"),
            border_color=("#CBD5E1", "#334155"),
            border_width=1,
            corner_radius=8
        )
        scroll_chapters.pack(fill="both", expand=True, pady=(2, 0))

        # En-tête des colonnes du tableau
        cols_header = ctk.CTkFrame(scroll_chapters, fg_color=("#F1F5F9", "#1E293B"), height=24)
        cols_header.pack(fill="x", pady=(0, 4))
        cols_header.grid_columnconfigure(1, weight=1)

        ctk.CTkLabel(cols_header, text="Inc.", font=ctk.CTkFont(size=10, weight="bold"), width=28).grid(row=0, column=0, padx=2)
        ctk.CTkLabel(cols_header, text="Titre du Chapitre", font=ctk.CTkFont(size=10, weight="bold"), anchor="w").grid(row=0, column=1, padx=4, sticky="w")
        ctk.CTkLabel(cols_header, text="Portée", font=ctk.CTkFont(size=10, weight="bold"), width=68).grid(row=0, column=2, padx=2)
        ctk.CTkLabel(cols_header, text="Livre", font=ctk.CTkFont(size=10, weight="bold"), width=60).grid(row=0, column=3, padx=2)
        ctk.CTkLabel(cols_header, text="Type RAG", font=ctk.CTkFont(size=10, weight="bold"), width=88).grid(row=0, column=4, padx=2)

        book_options = ["—"] + [
            "Gen", "Exo", "Lev", "Num", "Deu", "Jos", "Jdg", "Rut", "1Sa", "2Sa",
            "1Ki", "2Ki", "1Ch", "2Ch", "Ezr", "Neh", "Est", "Job", "Psa", "Pro",
            "Ecc", "Sol", "Isa", "Jer", "Lam", "Eze", "Dan", "Hos", "Joe", "Amo",
            "Oba", "Jon", "Mic", "Nah", "Hab", "Zep", "Hag", "Zec", "Mal",
            "Mat", "Mar", "Luk", "Joh", "Act", "Rom", "1Co", "2Co", "Gal", "Eph",
            "Phi", "Col", "1Th", "2Th", "1Ti", "2Ti", "Tit", "Phm", "Heb", "Jam",
            "1Pe", "2Pe", "1Jo", "2Jo", "3Jo", "Jud", "Rev"
        ]

        type_display_to_raw = {
            "📖 Intro": "book_intro",
            "💡 Théol.": "biblical_theology",
            "🏛️ Context": "ot_context",
            "📄 Général": "general",
            "⚙️ Annexe": "appendix"
        }

        for ch in chapters:
            ch_id = ch["id"]
            var = ctk.BooleanVar(value=ch.get("include", True))
            self.chapter_check_vars[ch_id] = var

            row_f = ctk.CTkFrame(scroll_chapters, fg_color="transparent")
            row_f.pack(fill="x", pady=2)
            row_f.grid_columnconfigure(1, weight=1)

            # Checkbox
            cb = ctk.CTkCheckBox(row_f, text="", variable=var, width=20, height=20)
            cb.grid(row=0, column=0, padx=2)

            # Titre
            t_short = ch["title"]
            if len(t_short) > 30:
                t_short = t_short[:28] + "..."
            lbl_t = ctk.CTkLabel(row_f, text=t_short, font=ctk.CTkFont(size=11), anchor="w")
            lbl_t.grid(row=0, column=1, padx=4, sticky="w")

            # Menu déroulant Portée (Interactif)
            raw_cur_scope = ch.get("corpus_scope", "GLOBAL")
            disp_cur_scope = "AT" if raw_cur_scope == "OT" else ("APO" if raw_cur_scope in ["APOCRYPHA", "APO"] else ("AT+NT" if raw_cur_scope == "BOTH" else raw_cur_scope))
            scope_var = ctk.StringVar(value=disp_cur_scope)
            menu_scope = ctk.CTkOptionMenu(
                row_f,
                variable=scope_var,
                values=["GLOBAL", "AT", "NT", "INTER", "APO"],
                width=68,
                height=22,
                font=ctk.CTkFont(size=9, weight="bold"),
                command=lambda val, target_ch=ch: target_ch.update({"corpus_scope": "OT" if val == "AT" else ("APOCRYPHA" if val == "APO" else val)})
            )
            menu_scope.grid(row=0, column=2, padx=2)

            # Menu déroulant Livre Biblique (Interactif)
            cur_bcode = ch.get("book_code") or "—"
            if cur_bcode not in book_options:
                cur_bcode = "—"
            bcode_var = ctk.StringVar(value=cur_bcode)
            menu_bcode = ctk.CTkOptionMenu(
                row_f,
                variable=bcode_var,
                values=book_options,
                width=60,
                height=22,
                font=ctk.CTkFont(size=9, weight="bold"),
                command=lambda val, target_ch=ch: target_ch.update({"book_code": None if val == "—" else val})
            )
            menu_bcode.grid(row=0, column=3, padx=2)

            # Menu déroulant Type RAG (Interactif)
            cur_stype = ch.get("source_type", "general")
            cur_display_stype = "📖 Intro" if cur_stype == "book_intro" else (
                "💡 Théol." if "theology" in cur_stype else (
                    "🏛️ Context" if "context" in cur_stype else (
                        "⚙️ Annexe" if cur_stype == "appendix" else "📄 Général"
                    )
                )
            )
            stype_var = ctk.StringVar(value=cur_display_stype)
            menu_stype = ctk.CTkOptionMenu(
                row_f,
                variable=stype_var,
                values=["📖 Intro", "💡 Théol.", "🏛️ Context", "📄 Général", "⚙️ Annexe"],
                width=88,
                height=22,
                font=ctk.CTkFont(size=9),
                command=lambda val, target_ch=ch: target_ch.update({"source_type": type_display_to_raw.get(val, "general")})
            )
            menu_stype.grid(row=0, column=4, padx=2)

    def toggle_all_chapters(self, state: bool):
        for var in self.chapter_check_vars.values():
            var.set(state)

    def select_rag_only_chapters(self):
        for ch in self.epub_chapters:
            ch_id = ch["id"]
            if ch_id in self.chapter_check_vars:
                stype = ch.get("source_type", "")
                is_app = stype == "appendix" or ch.get("size_chars", 0) < 60
                self.chapter_check_vars[ch_id].set(not is_app)

    def save(self):
        name = self.name_entry.get().strip()
        if not name:
            messagebox.showerror("Erreur", "Veuillez entrer un nom court (identifiant).")
            return

        # Résolution du code de livre cible
        selected_bcode_raw = self.book_code_var.get()
        target_bcode = None
        if " - " in selected_bcode_raw:
            target_bcode = selected_bcode_raw.split(" - ")[0].strip()
            
        scope_disp = self.corpus_scope_var.get()
        raw_scope = "OT" if scope_disp == "AT" else ("BOTH" if scope_disp == "AT+NT" else ("APOCRYPHA" if scope_disp == "APO" else scope_disp))

        metadata = {
            "title": self.title_entry.get().strip() or name,
            "author": self.author_entry.get().strip(),
            "description": self.desc_entry.get("1.0", "end-1c").strip(),
            "year": self.year_entry.get().strip(),
            "cover_path": self.cover_path,
            "type": self.type_var.get(),
            "corpus_scope": raw_scope,
            "source_type": self.source_type_var.get(),
            "book_code": target_bcode,
            "embedding_model": self.embed_var.get()
        }
            
        if self.edit_mode:
            old_name = self.edit_meta.get("name", name)
            self.master.after(100, lambda: self.on_import_callback(name, None, metadata, edit_mode=True, old_name=old_name))
            if self.close_callback:
                self.close_callback()
            return
            
        # CAS 1 : Importation directe d'un dossier Bible JSON (66 fichiers)
        if self.folder_path:
            try:
                b_name, b_meta = BibleJsonLoader.import_bible_folder(
                    self.folder_path, 
                    custom_name=name, 
                    custom_metadata=metadata
                )
                self.master.after(100, lambda: self.on_import_callback(b_name, [], b_meta, edit_mode=False))
                if self.close_callback:
                    self.close_callback()
                return
            except Exception as e:
                messagebox.showerror("Erreur d'import", f"Impossible d'importer le dossier JSON : {e}")
                return

        # CAS 2 : Fichier JSON unique de Bible
        if self.file_path and self.file_path.lower().endswith(".json"):
            try:
                b_name, b_meta = BibleJsonLoader.import_single_bible_json(
                    self.file_path,
                    custom_name=name,
                    custom_metadata=metadata
                )
                self.master.after(100, lambda: self.on_import_callback(b_name, [], b_meta, edit_mode=False))
                if self.close_callback:
                    self.close_callback()
                return
            except Exception as e:
                messagebox.showerror("Erreur d'import", f"Impossible d'importer le fichier JSON : {e}")
                return

        # CAS 2.5 : Fichier CSV de Bible (Interlinéaire inversé / Strong)
        if self.file_path and self.file_path.lower().endswith(".csv") and self.type_var.get() == "Bible":
            try:
                b_name, b_meta = BibleJsonLoader.import_bible_csv(
                    self.file_path,
                    custom_name=name,
                    custom_metadata=metadata
                )
                self.master.after(100, lambda: self.on_import_callback(b_name, [], b_meta, edit_mode=False))
                if self.close_callback:
                    self.close_callback()
                return
            except Exception as e:
                messagebox.showerror("Erreur d'import", f"Impossible d'importer le fichier CSV de Bible : {e}")
                return

        # CAS 3 : Fichier EPUB (Ouvrage de théologie générale ou commentaire)
        if self.file_path and self.file_path.lower().endswith(".epub"):
            # Synchroniser les checkboxes des chapitres
            for ch in self.epub_chapters:
                ch_id = ch["id"]
                if ch_id in self.chapter_check_vars:
                    ch["include"] = self.chapter_check_vars[ch_id].get()

            included_chapters = [ch for ch in self.epub_chapters if ch.get("include", True)]
            if not included_chapters:
                messagebox.showerror("Erreur", "Veuillez cocher au moins un chapitre à importer.")
                return

            metadata["chapters_count"] = len(included_chapters)
            metadata["format"] = "epub"

            try:
                chunks = EpubLoader.extract_chapters_and_chunks(
                    self.file_path,
                    self.epub_chapters,
                    custom_name=name,
                    metadata=metadata
                )
                if not chunks:
                    messagebox.showerror("Erreur", "Aucun texte n'a pu être extrait des chapitres sélectionnés.")
                    return

                self.master.after(100, lambda: self.on_import_callback(name, chunks, metadata, edit_mode=False))
                if self.close_callback:
                    self.close_callback()
                return
            except Exception as e:
                messagebox.showerror("Erreur d'extraction EPUB", f"Erreur lors de l'extraction de l'EPUB : {e}")
                return

        # CAS 4 : Ouvrages DOCX, CSV ou texte
        if not self.file_path:
            messagebox.showerror("Erreur", "Veuillez choisir un fichier ou un dossier Bible JSON/CSV à importer.")
            return
            
        chunks = self.extract_and_chunk(self.file_path, name, self.type_var.get())
        if not chunks:
            return
            
        # Si le fichier contient des entrées de dictionnaire / glossaire / sujets (ex: balises [[@Headword:...]]),
        # on l'indexe aussi automatiquement dans le gestionnaire de dictionnaires en une seule fois !
        try:
            from core.dictionary_manager import DictionaryManager
            dict_res = DictionaryManager.import_dictionary(self.file_path, custom_name=metadata.get("title") or name)
            if dict_res.get("success"):
                print(f"Indexation dictionnaire automatique réussie ({dict_res.get('count')} articles)")
        except Exception as e:
            pass
            
        self.master.after(100, lambda: self.on_import_callback(name, chunks, metadata, edit_mode=False))
        if self.close_callback:
            self.close_callback()
        
    def extract_and_chunk(self, path, name, doc_type):
        text = ""
        if path.lower().endswith(".pdf"):
            messagebox.showerror("Non supporté", "Veuillez convertir le PDF en Markdown ou texte.")
            return []
        elif path.lower().endswith(".docx"):
            try:
                import docx
                doc = docx.Document(path)
                text = "\n".join([p.text for p in doc.paragraphs])
            except Exception as e:
                messagebox.showerror("Erreur", f"Impossible de lire le fichier DOCX : {e}")
                return []
        else:
            try:
                with open(path, "r", encoding="utf-8") as f:
                    text = f.read()
            except UnicodeDecodeError:
                try:
                    with open(path, "r", encoding="mbcs") as f:
                        text = f.read()
                except Exception as e:
                    messagebox.showerror("Erreur", f"Impossible de lire le fichier (problème d'encodage) : {e}")
                    return []
            except Exception as e:
                messagebox.showerror("Erreur", f"Impossible de lire le fichier : {e}")
                return []
                
        chunks = []
        lines = text.split('\n')
        current_ref = "Inconnu"
        
        def split_large_text(txt, max_chars=3000, overlap=300):
            if len(txt) <= max_chars:
                return [txt]
            parts = []
            start = 0
            while start < len(txt):
                end = start + max_chars
                parts.append(txt[start:end])
                start += max_chars - overlap
            return parts

        chunk_idx = 0
        for line in lines:
            line = line.strip()
            if not line:
                continue
                
            m = re.match(r'^([1-3]?\s*[A-Za-zÀ-ÖØ-öø-ÿ]+ \d+:\d+)', line)
            if m:
                current_ref = m.group(1)
                
            meta_dict = {
                "name": name,
                "type": doc_type,
                "reference": current_ref,
                "corpus_scope": self.corpus_scope_var.get(),
                "source_type": self.source_type_var.get()
            }
            if current_ref != "Inconnu":
                ref_match = re.match(r'^([1-3]?\s*[A-Za-zÀ-ÖØ-öø-ÿ]+)\s+(\d+):(\d+)$', current_ref.strip())
                if ref_match:
                    meta_dict["book"] = ref_match.group(1)
                    meta_dict["chapter"] = int(ref_match.group(2))
                    meta_dict["verse"] = int(ref_match.group(3))
                    
            sub_lines = split_large_text(line)
            for sub_line in sub_lines:
                chunks.append({
                    "id": f"{name}_{chunk_idx}",
                    "text": sub_line,
                    "metadata": meta_dict
                })
                chunk_idx += 1
            
        return chunks
