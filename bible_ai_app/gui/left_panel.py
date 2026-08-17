import customtkinter as ctk

class LeftPanel(ctk.CTkFrame):
    def __init__(self, master, width=250, **kwargs):
        super().__init__(master, width=width, **kwargs)
        
        self.grid_rowconfigure(0, weight=0)
        self.grid_rowconfigure(1, weight=1)
        self.grid_rowconfigure(2, weight=0)
        
        lbl_title = ctk.CTkLabel(self, text="Bible AI Study", font=ctk.CTkFont(size=20, weight="bold"))
        lbl_title.grid(row=0, column=0, padx=20, pady=20)
        
        # Tools frame
        self.tools_frame = ctk.CTkFrame(self, fg_color="transparent")
        self.tools_frame.grid(row=1, column=0, sticky="new", padx=20)
        
        self.btn_search = ctk.CTkButton(self.tools_frame, text="🔍 Recherche (Ctrl+F)")
        self.btn_search.pack(pady=8, fill="x")

        self.btn_library = ctk.CTkButton(self.tools_frame, text="📚 Bibliothèque")
        self.btn_library.pack(pady=8, fill="x")

        self.btn_import = ctk.CTkButton(self.tools_frame, text="📥 Importer Livre")
        self.btn_import.pack(pady=8, fill="x")
        
        # Bottom frame
        self.bottom_frame = ctk.CTkFrame(self, fg_color="transparent")
        self.bottom_frame.grid(row=2, column=0, sticky="sew", padx=20, pady=20)
        
        self.btn_settings = ctk.CTkButton(self.bottom_frame, text="⚙️ Paramètres", fg_color="transparent", border_width=1, text_color=("gray10", "gray90"))
        self.btn_settings.pack(pady=10, fill="x")
