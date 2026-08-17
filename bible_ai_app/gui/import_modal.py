import customtkinter as ctk
from tkinter import messagebox
from gui import native_dialog as filedialog
import re
import os
import shutil
import json
from PIL import Image
from core.bible_json_loader import BibleJsonLoader
from gui.google_books_picker import BookMetadataPickerModal

class ImportTab(ctk.CTkScrollableFrame):
    """
    Interface plein écran pour l'importation et l'édition d'ouvrages,
    avec agencement spacieux en 2 colonnes, défilement fluide et design soigné.
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
            text="Renseignez les métadonnées, associez une image de couverture et sélectionnez votre fichier source (.docx, .json, .csv ou dossier complet de Bible).",
            font=ctk.CTkFont(size=12),
            text_color=("#64748B", "#94A3B8"),
            anchor="w"
        )
        lbl_subtitle.pack(fill="x", anchor="w", pady=(2, 0))

        # 2. CONTENEUR PRINCIPAL EN 2 COLONNES SPACIEUSES
        columns_frame = ctk.CTkFrame(self, fg_color="transparent")
        columns_frame.pack(fill="both", expand=True, padx=20, pady=5)
        columns_frame.grid_columnconfigure(0, weight=3, uniform="cols")
        columns_frame.grid_columnconfigure(1, weight=2, uniform="cols")
        
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
        left_card.grid(row=0, column=0, sticky="nsew", padx=(0, 12), pady=0)
        
        # En-tête de la carte gauche : Titre & Bouton de Recherche Google Books
        card_left_header = ctk.CTkFrame(left_card, fg_color="transparent")
        card_left_header.pack(fill="x", padx=20, pady=(16, 10))
        card_left_header.grid_columnconfigure(0, weight=1)
        
        card_left_title = ctk.CTkLabel(
            card_left_header, 
            text="📋 Informations & Classification", 
            font=ctk.CTkFont(size=15, weight="bold"), 
            text_color=("#2563EB", "#38BDF8")
        )
        card_left_title.grid(row=0, column=0, sticky="w")
        
        self.btn_search_meta = ctk.CTkButton(
            card_left_header,
            text="🔍 Rechercher métadonnées",
            command=self.open_metadata_search,
            fg_color="#0284C7",
            hover_color="#0369A1",
            height=30,
            font=ctk.CTkFont(size=12, weight="bold")
        )
        self.btn_search_meta.grid(row=0, column=1, sticky="e")
        
        # Champ Identifiant (Titre court)
        lbl_id = ctk.CTkLabel(left_card, text="Titre court / Identifiant unique (ex: S21, BDS, Calmet) :", font=ctk.CTkFont(weight="bold"))
        lbl_id.pack(padx=20, pady=(4, 2), anchor="w")
        self.name_entry = ctk.CTkEntry(left_card, placeholder_text="Ex: Segond 21, TOB, Calmet...", height=34)
        self.name_entry.pack(fill="x", padx=20, pady=(0, 8))
        if self.edit_mode:
            self.name_entry.insert(0, self.edit_meta.get("name", ""))
        
        # Champ Titre complet
        lbl_title = ctk.CTkLabel(left_card, text="Titre complet de l'ouvrage :", font=ctk.CTkFont(weight="bold"))
        lbl_title.pack(padx=20, pady=(4, 2), anchor="w")
        self.title_entry = ctk.CTkEntry(left_card, placeholder_text="Ex: La Bible Segond 21 avec notes d'étude...", height=34)
        self.title_entry.pack(fill="x", padx=20, pady=(0, 8))
        self.title_entry.insert(0, self.edit_meta.get("title", ""))
        
        # Champ Auteur / Traducteur
        lbl_author = ctk.CTkLabel(left_card, text="Auteur / Traducteur / Éditeur :", font=ctk.CTkFont(weight="bold"))
        lbl_author.pack(padx=20, pady=(4, 2), anchor="w")
        self.author_entry = ctk.CTkEntry(left_card, placeholder_text="Ex: Société Biblique de Genève, Alfred Kuen...", height=34)
        self.author_entry.pack(fill="x", padx=20, pady=(0, 8))
        self.author_entry.insert(0, self.edit_meta.get("author", ""))
        
        # Champ Description
        lbl_desc = ctk.CTkLabel(left_card, text="Description & Notes d'étude :", font=ctk.CTkFont(weight="bold"))
        lbl_desc.pack(padx=20, pady=(4, 2), anchor="w")
        self.desc_entry = ctk.CTkTextbox(left_card, height=80, corner_radius=8)
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
        lbl_type = ctk.CTkLabel(frame_type, text="Type d'ouvrage :", font=ctk.CTkFont(weight="bold"))
        lbl_type.pack(anchor="w", pady=(0, 2))
        self.type_var = ctk.StringVar(value=self.edit_meta.get("type", "Bible" if not self.edit_mode else "Théologie"))
        self.type_menu = ctk.CTkOptionMenu(
            frame_type, 
            variable=self.type_var, 
            values=["Bible", "Théologie", "Commentaire", "Dictionnaire", "Livre / Autre"],
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
        
        # Modèle d'Embedding (Vectorisation IA)
        lbl_embed = ctk.CTkLabel(left_card, text="Modèle d'embedding vectoriel (Recherche IA) :", font=ctk.CTkFont(weight="bold"))
        lbl_embed.pack(padx=20, pady=(4, 2), anchor="w")
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
        # COLONNE DROITE : COUVERTURE & SOURCE
        # ==========================================
        right_card = ctk.CTkFrame(
            columns_frame, 
            fg_color=("#F8FAFC", "#1E293B"), 
            border_color=("#CBD5E1", "#334155"), 
            border_width=1, 
            corner_radius=12
        )
        right_card.grid(row=0, column=1, sticky="nsew", padx=(12, 0), pady=0)
        
        card_right_title = ctk.CTkLabel(
            right_card, 
            text="🖼️ Couverture & Source de Données", 
            font=ctk.CTkFont(size=15, weight="bold"), 
            text_color=("#2563EB", "#38BDF8")
        )
        card_right_title.pack(anchor="w", padx=20, pady=(16, 12))
        
        # Zone Image de Couverture
        cover_container = ctk.CTkFrame(right_card, fg_color="transparent")
        cover_container.pack(fill="x", padx=20, pady=(0, 10))
        
        self.cover_lbl = ctk.CTkLabel(
            cover_container, 
            text="Aucune image\n(Générée automatiquement)", 
            width=180, 
            height=240, 
            fg_color=("#E2E8F0", "#0F172A"), 
            corner_radius=8,
            font=ctk.CTkFont(size=12, slant="italic")
        )
        self.cover_lbl.pack(pady=(0, 10))
        
        cover_btns_row = ctk.CTkFrame(cover_container, fg_color="transparent")
        cover_btns_row.pack(fill="x")
        cover_btns_row.grid_columnconfigure(0, weight=1)
        cover_btns_row.grid_columnconfigure(1, weight=1)
        
        btn_choose_cover = ctk.CTkButton(
            cover_btns_row, 
            text="🖼️ Choisir image", 
            command=self.choose_cover,
            height=32
        )
        btn_choose_cover.grid(row=0, column=0, sticky="ew", padx=(0, 4))
        
        btn_ocr = ctk.CTkButton(
            cover_btns_row, 
            text="✨ Gemini OCR", 
            command=self.do_ocr, 
            fg_color="#3B82F6",
            hover_color="#2563EB",
            height=32
        )
        btn_ocr.grid(row=0, column=1, sticky="ew", padx=(4, 0))
        
        btn_find_cover = ctk.CTkButton(
            cover_container,
            text="🔍 Rechercher en ligne (Google Books)",
            command=self.open_metadata_search,
            fg_color="#0284C7",
            hover_color="#0369A1",
            height=30,
            font=ctk.CTkFont(size=12, weight="bold")
        )
        btn_find_cover.pack(fill="x", pady=(6, 0))
        
        # Séparateur subtil
        sep = ctk.CTkLabel(right_card, text="─" * 40, text_color=("#CBD5E1", "#334155"))
        sep.pack(pady=4)
        
        # Zone Fichier Source (si nouveau import)
        if not self.edit_mode:
            lbl_src_title = ctk.CTkLabel(right_card, text="Source du document à importer :", font=ctk.CTkFont(weight="bold"))
            lbl_src_title.pack(anchor="w", padx=20, pady=(2, 4))
            
            src_btns_row = ctk.CTkFrame(right_card, fg_color="transparent")
            src_btns_row.pack(fill="x", padx=20, pady=(0, 6))
            src_btns_row.grid_columnconfigure(0, weight=1)
            src_btns_row.grid_columnconfigure(1, weight=1)
            
            self.btn_file = ctk.CTkButton(
                src_btns_row, 
                text="📂 Document (.docx, .json, .csv)", 
                command=self.choose_file,
                fg_color="#4F46E5",
                hover_color="#4338CA",
                height=36,
                font=ctk.CTkFont(weight="bold")
            )
            self.btn_file.grid(row=0, column=0, sticky="ew", padx=(0, 4))

            self.btn_folder = ctk.CTkButton(
                src_btns_row, 
                text="📁 Dossier (66 JSON)", 
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
            self.file_lbl.pack(padx=20, pady=(0, 16), anchor="w")

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
                ctk_img = ctk.CTkImage(img, size=(180, 240))
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
        
    def open_metadata_search(self):
        """Ouvre la modale de recherche de métadonnées Google Books & Open Library."""
        # Récupérer les données initiales
        initial_title = self.title_entry.get().strip() or self.name_entry.get().strip()
        initial_author = self.author_entry.get().strip()
        
        # Si aucun titre ni auteur n'est saisi mais qu'un fichier est sélectionné, utiliser son nom
        if not initial_title and not initial_author and self.file_path:
            base = os.path.splitext(os.path.basename(self.file_path))[0]
            initial_title = base.replace("_", " ").replace("-", " ")
            
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
                self.file_lbl.configure(text=f"📁 Dossier Bible JSON ({len(json_files)} livres) : {os.path.basename(folder)}")
                
                # Auto-remplissage depuis le premier fichier
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
                title="Sélectionner un fichier (.docx, .json, .csv)",
                filetypes=[
                    ("Documents & Bibles (*.docx, *.json, *.csv)", "*.docx *.json *.csv"),
                    ("Bibles CSV (*.csv)", "*.csv"),
                    ("Fichiers JSON (*.json)", "*.json"),
                    ("Documents Word (*.docx)", "*.docx"),
                    ("Tous les fichiers (*.*)", "*.*")
                ]
            )
            if path:
                self.file_path = path
                self.folder_path = None
                self.file_lbl.configure(text=f"📄 Fichier : {os.path.basename(path)}")
                
                # Si c'est un fichier CSV de Bible
                if path.lower().endswith(".csv"):
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
                
                # Si c'est un fichier JSON unique de Bible
                if path.lower().endswith(".json"):
                    try:
                        filename_base = os.path.splitext(os.path.basename(path))[0]
                        if "apee" in filename_base.lower() or "epee" in filename_base.lower():
                            self.name_entry.delete(0, "end")
                            self.name_entry.insert(0, "APEE")
                            self.title_entry.delete(0, "end")
                            self.title_entry.insert(0, "Bible de l'Épée (APEE 2010)")
                            self.author_entry.delete(0, "end")
                            self.author_entry.insert(0, "APEE")
                            self.year_entry.delete(0, "end")
                            self.year_entry.insert(0, "2010")
                            self.desc_entry.delete("1.0", "end")
                            self.desc_entry.insert("1.0", "Bible de l'Épée - Version APEE 2010")
                            self.type_var.set("Bible")
                        elif "ostervald" in filename_base.lower() or "fob" in filename_base.lower():
                            self.name_entry.delete(0, "end")
                            self.name_entry.insert(0, "OST")
                            self.title_entry.delete(0, "end")
                            self.title_entry.insert(0, "Ostervald 1877")
                            self.author_entry.delete(0, "end")
                            self.author_entry.insert(0, "J.-F. Ostervald")
                            self.year_entry.delete(0, "end")
                            self.year_entry.insert(0, "1877")
                            self.desc_entry.delete("1.0", "end")
                            self.desc_entry.insert("1.0", "Sainte Bible d'Ostervald révisée")
                            self.type_var.set("Bible")
                        elif "crampon" in filename_base.lower() or "ncl" in filename_base.lower():
                            self.name_entry.delete(0, "end")
                            self.name_entry.insert(0, "NCL")
                            self.title_entry.delete(0, "end")
                            self.title_entry.insert(0, "Néo-Crampon Libre")
                            self.author_entry.delete(0, "end")
                            self.author_entry.insert(0, "Fraternité de Tibériade")
                            self.year_entry.delete(0, "end")
                            self.year_entry.insert(0, "2022")
                            self.desc_entry.delete("1.0", "end")
                            self.desc_entry.insert("1.0", "Sainte Bible néo-Crampon Libre (avec deutérocanoniques)")
                            self.type_var.set("Bible")
                        elif "tob" in filename_base.lower():
                            self.name_entry.delete(0, "end")
                            self.name_entry.insert(0, "TOB")
                            self.title_entry.delete(0, "end")
                            self.title_entry.insert(0, "TOB 2010")
                            self.author_entry.delete(0, "end")
                            self.author_entry.insert(0, "Société Biblique Française / Cerf")
                            self.year_entry.delete(0, "end")
                            self.year_entry.insert(0, "2010")
                            self.desc_entry.delete("1.0", "end")
                            self.desc_entry.insert("1.0", "Traduction Œcuménique de la Bible (TOB 2010 avec deutérocanoniques)")
                            self.type_var.set("Bible")
                        elif "sagesse_vivante" in filename_base.lower() or "sagesse vivante" in filename_base.lower():
                            self.name_entry.delete(0, "end")
                            self.name_entry.insert(0, "SV")
                            self.title_entry.delete(0, "end")
                            self.title_entry.insert(0, "Sagesse Vivante")
                            self.author_entry.delete(0, "end")
                            self.author_entry.insert(0, "Alfred Kuen")
                            self.year_entry.delete(0, "end")
                            self.year_entry.insert(0, "1988")
                            self.desc_entry.delete("1.0", "end")
                            self.desc_entry.insert("1.0", "Bible Sagesse Vivante - Livres poétiques et de sagesse (Alfred Kuen)")
                            self.type_var.set("Bible")
                        elif "parole_vivante" in filename_base.lower() or "parole vivante" in filename_base.lower():
                            self.name_entry.delete(0, "end")
                            self.name_entry.insert(0, "PV")
                            self.title_entry.delete(0, "end")
                            self.title_entry.insert(0, "Parole Vivante")
                            self.author_entry.delete(0, "end")
                            self.author_entry.insert(0, "Alfred Kuen")
                            self.year_entry.delete(0, "end")
                            self.year_entry.insert(0, "1976")
                            self.desc_entry.delete("1.0", "end")
                            self.desc_entry.insert("1.0", "Bible Parole Vivante - Transcription dynamique (Alfred Kuen)")
                            self.type_var.set("Bible")
                        else:
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
        self.after(100, _open)
            
    def save(self):
        name = self.name_entry.get().strip()
        if not name:
            messagebox.showerror("Erreur", "Veuillez entrer un nom court (identifiant).")
            return
            
        metadata = {
            "title": self.title_entry.get().strip() or name,
            "author": self.author_entry.get().strip(),
            "description": self.desc_entry.get("1.0", "end-1c").strip(),
            "year": self.year_entry.get().strip(),
            "cover_path": self.cover_path,
            "type": self.type_var.get(),
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

        # CAS 3 : Ouvrages de Théologie, Commentaires, Dictionnaires ou Livres (Vectorisés pour l'IA)
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
                "reference": current_ref
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
