import customtkinter as ctk
import os
from gui.left_panel import LeftPanel
from gui.center_panel import CenterPanel
from gui.right_panel import RightPanel

from gui.progress_overlay import ProgressOverlay
from core.database import VectorDB
from core.config import load_config
from tkinter import messagebox

class App(ctk.CTk):
    def __init__(self, db):
        super().__init__()
        self.title("Assistant Biblique & Théologique")
        self.geometry("1400x800")
        
        def maximize():
            try:
                self.state('zoomed')
            except Exception:
                self.attributes('-zoomed', True)
            self.lift()
            self.attributes('-topmost', True)
            self.after(500, lambda: self.attributes('-topmost', False))
            self.focus_force()
                
        self.after(100, maximize)
        
        self.db = db
        self.config = load_config()
        theme = self.config.get("theme", "dark")
        ctk.set_appearance_mode(theme)
        
        self.db.api_keys = {
            "mistral": self.config.get("mistral_api_key", ""),
            "gemini": self.config.get("gemini_api_key", "")
        }
        
        self.active_sources = []
        
        # Grid layout
        self.grid_columnconfigure(0, weight=0) # Left panel
        self.grid_columnconfigure(1, weight=1) # Center/Main panel
        self.grid_rowconfigure(0, weight=1)
        
        # Panels
        self.left_panel = LeftPanel(self, width=250)
        self.left_panel.grid(row=0, column=0, sticky="nsew")
        
        self.center_panel = CenterPanel(self, self.config)
        self.center_panel.grid(row=0, column=1, sticky="nsew")
        
        # Bindings left panel
        self.left_panel.btn_import.configure(command=self.open_import)
        self.left_panel.btn_library.configure(command=self.open_library)
        self.left_panel.btn_settings.configure(command=self.open_settings)
        
        # Bindings center panel
        self.center_panel.book_var.trace_add("write", self.on_reference_change)
        self.center_panel.chapter_var.trace_add("write", self.on_reference_change)
        self.center_panel.verse_var.trace_add("write", self.on_reference_change)
        
        self.progress_overlay = ProgressOverlay(self)
        
        # Load active books
        self.after(100, self.init_sources_and_load_default)

    def init_sources_and_load_default(self):
        from gui.library_utils import load_books_metadata
        registry = load_books_metadata()
        self.active_sources = [name for name, meta in registry.items() if meta.get("active", False)]
        self.center_panel.update_ref_bibles()
        self.perform_search("Genèse 1", self.active_sources)

    def on_reference_change(self, *args):
        if getattr(self.center_panel, 'is_updating_breadcrumb', False):
            return
            
        book = self.center_panel.book_var.get().strip()
        chapter = self.center_panel.chapter_var.get().strip()
        verse = self.center_panel.verse_var.get().strip()
        
        if not book or not chapter:
            return
            
        from gui.center_panel import FRENCH_TO_CODE
        if book not in FRENCH_TO_CODE:
            return
            
        book_code = FRENCH_TO_CODE[book]
        ch_num = int(chapter) if chapter.isdigit() else 1
        v_num = int(verse) if verse.isdigit() else None
        
        # Si le livre est déjà chargé dans le lecteur continu, on scrolle instantanément !
        if getattr(self.center_panel, 'loaded_book_code', None) == book_code:
            self.center_panel.scroll_to_ref(ch_num, v_num)
            return
            
        if verse == "Tous":
            ref = f"{book} {chapter}"
        else:
            ref = f"{book} {chapter}:{verse}"
            
        self.perform_search(ref, self.active_sources)

    def perform_search(self, reference, active_sources):
        if not reference or not active_sources:
            return
            
        if getattr(self, '_current_searching_ref', None) == reference:
            return
            
        self._current_searching_ref = reference
        from gui.library_utils import load_books_metadata
        registry = load_books_metadata()
        active_sources_info = [{"name": name, "embedding_model": registry.get(name, {}).get("embedding_model", "study_library")} for name in active_sources]
        
        self.center_panel.start_skeleton_loader()
        
        from core.reference_parser import normalize_reference
        norm_ref = normalize_reference(reference) or reference
        book_code = norm_ref.split(" ")[0] if " " in norm_ref else norm_ref
        
        def do_search():
            try:
                # Charger l'ensemble du livre pour le défilement continu
                results = self.db.get_by_reference(book_code, active_sources=active_sources_info)
            except Exception as e:
                print(f"Error in do_search for {reference}: {e}")
                results = None
            finally:
                self._current_searching_ref = None
                self.after(0, self.finish_search, reference, results)
            
        import threading
        threading.Thread(target=do_search, daemon=True).start()
        
    def finish_search(self, reference, results):
        self.center_panel.stop_skeleton_loader()
        if results and results.get('documents') and len(results['documents']) > 0:
            self.center_panel.display_results(reference, results)
        else:
            self.center_panel.display_error(f"Aucun résultat trouvé pour {reference}")

    def open_import(self):
        from gui.import_modal import ImportTab
        self.center_panel.open_closable_tab("📥 Importer Livre", ImportTab, on_import_callback=self.on_import_document)
        
    def open_library(self):
        from gui.library_modal import LibraryTab
        self.center_panel.open_closable_tab("📚 Bibliothèque", LibraryTab, on_update_callback=self.on_library_update, edit_callback=self.open_edit_flow, db=self.db)
        
    def open_settings(self):
        from gui.settings_modal import SettingsTab
        self.center_panel.open_closable_tab("⚙️ Paramètres", SettingsTab, on_save_callback=self.on_settings_update)
        
    def open_edit_flow(self, book_name, book_meta):
        from gui.import_modal import ImportTab
        full_edit_meta = {"name": book_name, **book_meta}
        self.center_panel.open_closable_tab(f"✏️ Éditer {book_name}", ImportTab, on_import_callback=self.on_edit_document, edit_mode=True, edit_meta=full_edit_meta)
        
    def on_library_update(self):
        self.init_sources_and_load_default()
        
    def on_settings_update(self, new_config):
        self.config = new_config
        theme = self.config.get("theme", "dark")
        ctk.set_appearance_mode(theme)
        
        self.db.api_keys = {
            "mistral": self.config.get("mistral_api_key", ""),
            "gemini": self.config.get("gemini_api_key", "")
        }
        self.center_panel.config = new_config
        self.center_panel.font_family = new_config.get("font_family", "Georgia")
        self.center_panel.font_size = new_config.get("font_size", 18)
        self.center_panel.line_spacing = new_config.get("line_spacing", 6)
        self.center_panel.word_spacing = new_config.get("word_spacing", 3)
        self.center_panel.interlinear_show_surface = new_config.get("interlinear_show_surface", True)
        self.center_panel.interlinear_show_lemma = new_config.get("interlinear_show_lemma", True)
        self.center_panel.interlinear_show_translit = new_config.get("interlinear_show_translit", True)
        self.center_panel.interlinear_show_strong = new_config.get("interlinear_show_strong", True)
        self.center_panel.save_and_apply_font()
        self.center_panel.refresh_current_view_position()
        self.right_panel.update_config(new_config)
        self.right_panel.apply_font(new_config.get("font_family", "Georgia"), new_config.get("font_size", 18))

    def on_import_document(self, doc_name, chunks, metadata, edit_mode=False):
        from gui.library_utils import load_books_metadata, save_books_metadata
        registry = load_books_metadata()
        
        # Check if exists
        if doc_name in registry and metadata.get("format") != "json":
            resp = messagebox.askyesno("Livre existant", f"Le livre '{doc_name}' est déjà importé. Voulez-vous reprendre/analyser les différences ?", parent=self)
            if not resp:
                return
                
        # Update metadata immediately to show in library
        metadata["active"] = True
        registry[doc_name] = metadata
        save_books_metadata(registry)
        
        # Pour les Bibles JSON déjà copiées dans data/bibles/, l'import est direct et instantané
        if metadata.get("format") == "json" or not chunks:
            total_b = metadata.get("total_books", 66)
            messagebox.showinfo("Import terminé", f"La Bible '{doc_name}' ({total_b} livres) a été intégrée avec succès !", parent=self)
            self.on_library_update()
            return
            
        self.progress_overlay.place(relx=0.98, rely=0.98, anchor="se")
        self.progress_overlay.add_or_update_task(doc_name, 0, "Analyse...")
        self.update_idletasks()
        
        def progress_cb(pct):
            self.progress_overlay.add_or_update_task(doc_name, pct, "Importation...")
            self.update_idletasks()
            
        try:
            self.db.add_chunks(chunks, embedding_model=metadata.get("embedding_model", "study_library"), progress_callback=progress_cb)
            self.progress_overlay.add_or_update_task(doc_name, 100, "Terminé")
            self.update_idletasks()
            
            messagebox.showinfo("Import terminé", f"Importation terminée pour '{doc_name}'.\n{len(chunks)} versets traités.", parent=self)
            self.progress_overlay.remove_task(doc_name)
            self.on_library_update()
        except Exception as e:
            messagebox.showerror("Erreur d'import", f"Erreur lors de l'importation : {str(e)}", parent=self)
            self.progress_overlay.remove_task(doc_name)

    def on_edit_document(self, doc_name, chunks, metadata, edit_mode=True, old_name=None):
        from gui.library_utils import load_books_metadata, save_books_metadata
        registry = load_books_metadata()
        target_old_name = old_name or doc_name
        
        old_meta = registry.pop(target_old_name, {})
        old_model = old_meta.get("embedding_model", "study_library")
        embedding_model = metadata.get("embedding_model", old_model)
        
        # Conserver tous les champs existants (format, folder_name, version_code, total_books, active)
        merged_meta = dict(old_meta)
        merged_meta.update(metadata)
        
        # Si le nom (identifiant) a changé
        if target_old_name != doc_name:
            if self.config.get("reference_bible") == target_old_name:
                self.config["reference_bible"] = doc_name
                from core.config import save_config
                save_config(self.config)
                
            # Mettre à jour ChromaDB si document textuel
            if old_meta.get("format") != "json":
                try:
                    coll = self.db.get_collection(old_model)
                    coll_data = coll.get(where={"name": target_old_name}, include=["metadatas"])
                    if coll_data and coll_data["ids"]:
                        new_metas = []
                        for m in coll_data["metadatas"]:
                            m["name"] = doc_name
                            new_metas.append(m)
                        coll.update(ids=coll_data["ids"], metadatas=new_metas)
                except Exception as e:
                    print(f"Erreur renommage ChromaDB: {e}")
                    
            from core.bible_json_loader import BibleJsonLoader
            BibleJsonLoader.clear_cache()
            
        registry[doc_name] = merged_meta
        save_books_metadata(registry)
        
        if chunks:
            self.progress_overlay.place(relx=0.98, rely=0.98, anchor="se")
            self.progress_overlay.add_or_update_task(doc_name, 0, "Analyse...")
            self.update_idletasks()
            
            def progress_cb(pct):
                self.progress_overlay.add_or_update_task(doc_name, pct, "Mise à jour...")
                self.update_idletasks()
                
            try:
                self.db.add_chunks(chunks, embedding_model=embedding_model, progress_callback=progress_cb)
                self.progress_overlay.add_or_update_task(doc_name, 100, "Terminé")
                self.update_idletasks()
                
                messagebox.showinfo("Édition terminée", f"Mise à jour terminée pour '{doc_name}'.", parent=self)
                self.progress_overlay.remove_task(doc_name)
            except Exception as e:
                messagebox.showerror("Erreur", f"Erreur lors de la mise à jour : {str(e)}", parent=self)
                self.progress_overlay.remove_task(doc_name)
        else:
            messagebox.showinfo("Édition terminée", f"Métadonnées mises à jour pour '{doc_name}'.", parent=self)
            
        self.on_library_update()
