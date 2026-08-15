import customtkinter as ctk
from tkinter import messagebox
import os
from PIL import Image, ImageDraw, ImageFont
from gui.library_utils import load_books_metadata, save_books_metadata

class LibraryTab(ctk.CTkFrame):
    def __init__(self, master, db=None, close_callback=None, on_update_callback=None, edit_callback=None, **kwargs):
        super().__init__(master, **kwargs)
        
        self.close_callback = close_callback
        self.on_update_callback = on_update_callback
        self.open_edit_callback = edit_callback
        self.db = db
        
        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(1, weight=1)
        
        lbl_title = ctk.CTkLabel(self, text="Votre Bibliothèque", font=ctk.CTkFont(size=24, weight="bold"))
        lbl_title.grid(row=0, column=0, pady=20)
        
        self.scroll_frame = ctk.CTkScrollableFrame(self)
        self.scroll_frame.grid(row=1, column=0, padx=20, pady=10, sticky="nsew")
        
        # Grid parameters (adapté au plein écran)
        self.columns_count = 5
        for i in range(self.columns_count):
            self.scroll_frame.grid_columnconfigure(i, weight=1)
            
        self.refresh_library()
        
    def generate_default_cover(self, title):
        initials = "".join([w[0] for w in title.split()[:2]]).upper()
        if not initials:
            initials = "B"
            
        colors = ["#1abc9c", "#2ecc71", "#3498db", "#9b59b6", "#34495e", "#f1c40f", "#e67e22", "#e74c3c"]
        color = colors[hash(title) % len(colors)]
        
        img = Image.new('RGB', (200, 300), color=color)
        draw = ImageDraw.Draw(img)
        
        try:
            font = ImageFont.truetype("arial.ttf", 80)
        except:
            font = ImageFont.load_default()
            
        text_bbox = draw.textbbox((0, 0), initials, font=font)
        text_w = text_bbox[2] - text_bbox[0]
        text_h = text_bbox[3] - text_bbox[1]
        draw.text(((200 - text_w) / 2, (300 - text_h) / 2 - 20), initials, fill="white", font=font)
        
        try:
            font_small = ImageFont.truetype("arial.ttf", 20)
        except:
            font_small = ImageFont.load_default()
            
        title_short = title[:20] + "..." if len(title) > 20 else title
        draw.text((10, 250), title_short, fill="white", font=font_small)
        
        return img
        
    def refresh_library(self):
        # Clear existing widgets
        if hasattr(self, 'book_widgets'):
            for widget in self.book_widgets:
                try:
                    widget.destroy()
                except:
                    pass
        self.book_widgets = []
        self.book_images = []
            
        raw_books = load_books_metadata()
        self.sources = []
        for name, meta in raw_books.items():
            book_meta = meta.copy()
            book_meta["name"] = name
            self.sources.append(book_meta)
        
        if not self.sources:
            lbl_empty = ctk.CTkLabel(self.scroll_frame, text="Votre bibliothèque est vide.")
            lbl_empty.grid(row=0, column=0, pady=20)
            self.book_widgets.append(lbl_empty)
            return
            
        row = 0
        col = 0
        for i, source in enumerate(self.sources):
            book_name = source.get("name", f"Livre {i+1}")
            title = source.get("title", book_name)
            is_active = source.get("active", True)
            cover_path = source.get("cover_path")
            
            book_frame = ctk.CTkFrame(self.scroll_frame, fg_color="transparent")
            book_frame.grid(row=row, column=col, padx=15, pady=20, sticky="n")
            self.book_widgets.append(book_frame)
            
            img = None
            if cover_path and os.path.exists(cover_path):
                try:
                    img = Image.open(cover_path)
                except:
                    pass
            
            if img is None:
                img = self.generate_default_cover(title)
                
            ctk_img = ctk.CTkImage(img, size=(160, 240))
            if not hasattr(self, 'book_images'):
                self.book_images = []
            self.book_images.append(ctk_img)
            
            cover_lbl = ctk.CTkLabel(book_frame, image=ctk_img, text="")
            cover_lbl.pack(pady=5)
            
            title_lbl = ctk.CTkLabel(book_frame, text=title, font=ctk.CTkFont(weight="bold"), wraplength=160)
            title_lbl.pack(pady=2)
            
            author = source.get("author", "")
            if author:
                author_lbl = ctk.CTkLabel(book_frame, text=author, font=ctk.CTkFont(size=11), text_color="gray")
                author_lbl.pack()
            
            actions_frame = ctk.CTkFrame(book_frame, fg_color="transparent")
            actions_frame.pack(pady=5)
            
            switch_var = ctk.StringVar(value="on" if is_active else "off")
            switch = ctk.CTkSwitch(actions_frame, text="Actif", variable=switch_var, onvalue="on", offvalue="off", 
                                   command=lambda name=book_name, var=switch_var: self.toggle_source(name, var.get()))
            switch.pack(side="left", padx=5)
            
            btn_edit = ctk.CTkButton(actions_frame, text="✏️", width=30, height=30, 
                                     command=lambda name=book_name, meta=source: self.open_edit_callback(name, meta))
            btn_edit.pack(side="left", padx=2)
            
            btn_del = ctk.CTkButton(actions_frame, text="🗑️", width=30, height=30, fg_color="red", hover_color="darkred",
                                    command=lambda name=book_name: self.delete_source(name))
            btn_del.pack(side="left", padx=2)
            
            col += 1
            if col >= self.columns_count:
                col = 0
                row += 1

    def toggle_source(self, name, state):
        active = state == "on"
        raw_books = load_books_metadata()
        if name in raw_books:
            raw_books[name]["active"] = active
            save_books_metadata(raw_books)
        self.on_update_callback()
        
    def delete_source(self, name):
        if messagebox.askyesno("Confirmation", f"Êtes-vous sûr de vouloir supprimer définitivement '{name}' ?"):
            raw_books = load_books_metadata()
            if name in raw_books:
                book_info = raw_books[name]
                # 1. Supprimer le dossier JSON si présent
                folder_name = book_info.get("folder_name", name.replace(" ", "_"))
                json_dir = os.path.join("data", "bibles", folder_name)
                if os.path.exists(json_dir):
                    try:
                        import shutil
                        shutil.rmtree(json_dir)
                    except Exception as e:
                        print(f"Erreur suppression dossier JSON {json_dir}: {e}")
                        
                from core.bible_json_loader import BibleJsonLoader
                BibleJsonLoader._cache.clear()
                BibleJsonLoader._metadata_cache.clear()

                # 2. Supprimer les vecteurs de ChromaDB si présents
                model = book_info.get("embedding_model", "study_library")
                try:
                    if self.db:
                        collection = self.db.get_collection(model)
                        collection.delete(where={"name": name})
                except Exception as e:
                    print(f"Error deleting from ChromaDB: {e}")
                
                del raw_books[name]
                save_books_metadata(raw_books)
                
            self.refresh_library()
            self.on_update_callback()
