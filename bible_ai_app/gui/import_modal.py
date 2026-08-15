import customtkinter as ctk
from tkinter import messagebox
from gui import native_dialog as filedialog
import re
import os
import shutil
import json
from PIL import Image
from core.bible_json_loader import BibleJsonLoader

class ImportTab(ctk.CTkFrame):
    def __init__(self, master, close_callback=None, on_import_callback=None, edit_mode=False, edit_meta=None, **kwargs):
        super().__init__(master, **kwargs)
        
        self.close_callback = close_callback
        self.on_import_callback = on_import_callback
        self.edit_mode = edit_mode
        self.edit_meta = edit_meta or {}
        
        self.file_path = None
        self.folder_path = None
        self.cover_path = self.edit_meta.get("cover_path", None)
        
        # BOTTOM FRAME: File & Submit
        bottom_frame = ctk.CTkFrame(self, fg_color="transparent")
        bottom_frame.pack(side="bottom", fill="x", padx=20, pady=(0,10))
        
        # TOP FRAME: Contains left and right columns
        top_frame = ctk.CTkFrame(self, fg_color="transparent")
        top_frame.pack(fill="both", expand=True)
        
        # LEFT FRAME: Fields
        left_frame = ctk.CTkFrame(top_frame, fg_color="transparent")
        left_frame.pack(side="left", fill="both", expand=True, padx=20, pady=20)
        
        lbl = ctk.CTkLabel(left_frame, text="Titre court (Identifiant) :")
        lbl.pack(pady=(5,0), anchor="w")
        self.name_entry = ctk.CTkEntry(left_frame, width=300)
        self.name_entry.pack(pady=5, anchor="w")
        
        lbl_title = ctk.CTkLabel(left_frame, text="Titre complet :")
        lbl_title.pack(pady=(5,0), anchor="w")
        self.title_entry = ctk.CTkEntry(left_frame, width=300)
        self.title_entry.pack(pady=5, anchor="w")
        self.title_entry.insert(0, self.edit_meta.get("title", ""))
        
        lbl_author = ctk.CTkLabel(left_frame, text="Auteur :")
        lbl_author.pack(pady=(5,0), anchor="w")
        self.author_entry = ctk.CTkEntry(left_frame, width=300)
        self.author_entry.pack(pady=5, anchor="w")
        self.author_entry.insert(0, self.edit_meta.get("author", ""))
        
        lbl_desc = ctk.CTkLabel(left_frame, text="Description :")
        lbl_desc.pack(pady=(5,0), anchor="w")
        self.desc_entry = ctk.CTkTextbox(left_frame, width=300, height=80)
        self.desc_entry.pack(pady=5, anchor="w")
        self.desc_entry.insert("1.0", self.edit_meta.get("description", ""))
        
        lbl_year = ctk.CTkLabel(left_frame, text="Année :")
        lbl_year.pack(pady=(5,0), anchor="w")
        self.year_entry = ctk.CTkEntry(left_frame, width=150)
        self.year_entry.pack(pady=5, anchor="w")
        self.year_entry.insert(0, self.edit_meta.get("year", ""))
        
        lbl_type = ctk.CTkLabel(left_frame, text="Type d'ouvrage :")
        lbl_type.pack(pady=(10,0), anchor="w")
        self.type_var = ctk.StringVar(value=self.edit_meta.get("type", "Théologie"))
        self.type_menu = ctk.CTkOptionMenu(
            left_frame, 
            variable=self.type_var, 
            values=["Bible", "Théologie", "Commentaire", "Dictionnaire", "Livre / Autre"]
        )
        self.type_menu.pack(pady=5, anchor="w")
        
        lbl_embed = ctk.CTkLabel(left_frame, text="Modèle d'embedding (Recherche IA) :")
        lbl_embed.pack(pady=(10,0), anchor="w")
        self.embed_var = ctk.StringVar(value=self.edit_meta.get("embedding_model", "study_library"))
        self.embed_menu = ctk.CTkOptionMenu(left_frame, variable=self.embed_var, values=["study_library", "gemini-embedding-2", "gemini-embedding-1", "mistral-embed"])
        self.embed_menu.pack(pady=5, anchor="w")
        
        # Populate identifiant
        name_val = self.edit_meta.get("name", "") if self.edit_mode else ""
        self.name_entry.insert(0, name_val)
        
        # RIGHT FRAME: Cover & OCR
        right_frame = ctk.CTkFrame(top_frame)
        right_frame.pack(side="right", fill="y", padx=20, pady=20)
        
        lbl_cover = ctk.CTkLabel(right_frame, text="Image de couverture", font=ctk.CTkFont(weight="bold"))
        lbl_cover.pack(pady=10)
        
        self.cover_lbl = ctk.CTkLabel(right_frame, text="Aucune image\n(Générée automatiquement)", width=200, height=300, fg_color="gray20", corner_radius=8)
        self.cover_lbl.pack(pady=10)
        
        btn_choose_cover = ctk.CTkButton(right_frame, text="Choisir une image", command=self.choose_cover)
        btn_choose_cover.pack(pady=5)
        
        btn_ocr = ctk.CTkButton(right_frame, text="✨ Auto-remplir (Gemini OCR)", command=self.do_ocr, fg_color="#4285F4")
        btn_ocr.pack(pady=20)
          # Selection boutons fichiers/dossiers
        if not self.edit_mode:
            buttons_row = ctk.CTkFrame(bottom_frame, fg_color="transparent")
            buttons_row.pack(pady=5)
            
            self.btn_file = ctk.CTkButton(
                buttons_row, 
                text="📂 Choisir un document (.docx, .json)", 
                command=self.choose_file,
                fg_color="#4F46E5",
                hover_color="#4338CA",
                height=36,
                font=ctk.CTkFont(weight="bold")
            )
            self.btn_file.pack(side="left", padx=5)

            self.btn_folder = ctk.CTkButton(
                buttons_row, 
                text="📁 Ou dossier (66 JSON)", 
                command=self.choose_folder,
                fg_color="gray30",
                hover_color="gray40",
                height=36
            )
            self.btn_folder.pack(side="left", padx=5)
            
            self.file_lbl = ctk.CTkLabel(bottom_frame, text="Aucune source sélectionnée", font=ctk.CTkFont(slant="italic"))
            self.file_lbl.pack(pady=2)
            
        btn_text = "Mettre à jour les métadonnées" if self.edit_mode else "Lancer l'import"
        self.btn_import = ctk.CTkButton(bottom_frame, text=btn_text, command=self.save, fg_color="#34A853", hover_color="#2E9247", height=40)
        self.btn_import.pack(pady=5)
        
        self.load_cover_preview()
        
    def load_cover_preview(self):
        if self.cover_path and os.path.exists(self.cover_path):
            img = Image.open(self.cover_path)
            ctk_img = ctk.CTkImage(img, size=(200, 300))
            self.cover_lbl.configure(image=ctk_img, text="")
            
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
        if not config.get("mistral_api_key"):
            messagebox.showerror("Erreur", "Veuillez configurer la clé API Mistral dans les Paramètres pour utiliser l'OCR.")
            return
            
        def run_ocr():
            try:
                self.after(0, lambda: self.name_entry.delete(0, "end"))
                self.after(0, lambda: self.name_entry.insert(0, "Analyse en cours..."))
                
                res = analyze_image_ocr(self.cover_path, config)
                
                self.after(0, self.fill_ocr_results, res)
            except Exception as e:
                self.after(0, lambda: self.name_entry.delete(0, "end"))
                self.after(0, lambda err=e: messagebox.showerror("Erreur OCR", str(err)))
                
        threading.Thread(target=run_ocr, daemon=True).start()
        
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
