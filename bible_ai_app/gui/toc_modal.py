import customtkinter as ctk

BOOKS_OT = [
    ("Genèse", "Gen", 50), ("Exode", "Exo", 40), ("Lévitique", "Lev", 27), ("Nombres", "Num", 36), ("Deutéronome", "Deu", 34),
    ("Josué", "Jos", 24), ("Juges", "Jdg", 21), ("Ruth", "Rut", 4), ("1 Samuel", "1Sa", 31), ("2 Samuel", "2Sa", 24),
    ("1 Rois", "1Ki", 22), ("2 Rois", "2Ki", 25), ("1 Chroniques", "1Ch", 29), ("2 Chroniques", "2Ch", 36), ("Esdras", "Ezr", 10),
    ("Néhémie", "Neh", 13), ("Esther", "Est", 10), ("Job", "Job", 42), ("Psaumes", "Psa", 150), ("Proverbes", "Pro", 31),
    ("Ecclésiaste", "Ecc", 12), ("Cantique", "Sol", 8), ("Ésaïe", "Isa", 66), ("Jérémie", "Jer", 52), ("Lamentations", "Lam", 5),
    ("Ézéchiel", "Eze", 48), ("Daniel", "Dan", 12), ("Osée", "Hos", 14), ("Joël", "Joe", 3), ("Amos", "Amo", 9),
    ("Abdias", "Oba", 1), ("Jonas", "Jon", 4), ("Michée", "Mic", 7), ("Nahum", "Nah", 3), ("Habacuc", "Hab", 3),
    ("Sophonie", "Zep", 3), ("Aggée", "Hag", 2), ("Zacharie", "Zec", 14), ("Malachie", "Mal", 4)
]

BOOKS_NT = [
    ("Matthieu", "Mat", 28), ("Marc", "Mar", 16), ("Luc", "Luk", 24), ("Jean", "Joh", 21), ("Actes", "Act", 28),
    ("Romains", "Rom", 16), ("1 Corinthiens", "1Co", 16), ("2 Corinthiens", "2Co", 13), ("Galates", "Gal", 6),
    ("Éphésiens", "Eph", 6), ("Philippiens", "Phi", 4), ("Colossiens", "Col", 4), ("1 Thessaloniciens", "1Th", 5),
    ("2 Thessaloniciens", "2Th", 3), ("1 Timothy", "1Ti", 6), ("2 Timothy", "2Ti", 4), ("Titus", "Tit", 3),
    ("Philemon", "Phm", 1), ("Hébreux", "Heb", 13), ("Jacques", "Jam", 5), ("1 Pierre", "1Pe", 5), ("2 Pierre", "2Pe", 3),
    ("1 Jean", "1Jo", 5), ("2 Jean", "2Jo", 1), ("3 Jean", "3Jo", 1), ("Jude", "Jud", 1), ("Apocalypse", "Rev", 22)
]

class TOCModal(ctk.CTkToplevel):
    def __init__(self, master, on_select_callback):
        super().__init__(master)
        
        self.on_select_callback = on_select_callback
        
        self.title("Table des Matières")
        self.geometry("600x550")
        self.transient(master)
        self.grab_set()
        
        # Grid Layout : Colonne Gauche (Livres), Colonne Droite (Chapitres)
        self.grid_columnconfigure(0, weight=2)
        self.grid_columnconfigure(1, weight=1)
        self.grid_rowconfigure(0, weight=1)
        
        # 1. Conteneur Livres (Scrollable)
        self.books_frame = ctk.CTkScrollableFrame(self)
        self.books_frame.grid(row=0, column=0, sticky="nsew", padx=10, pady=10)
        
        # Titre Ancien Testament
        at_lbl = ctk.CTkLabel(self.books_frame, text="📜 Ancien Testament", font=ctk.CTkFont(size=14, weight="bold"))
        at_lbl.pack(anchor="w", pady=(10, 5), padx=5)
        
        for name, code, ch_count in BOOKS_OT:
            btn = ctk.CTkButton(
                self.books_frame, 
                text=name, 
                fg_color="transparent", 
                text_color=("black", "white"),
                hover_color=("#E5E7EB", "#374151"),
                anchor="w",
                command=lambda n=name, c=code, cc=ch_count: self.select_book(n, c, cc)
            )
            btn.pack(fill="x", padx=5, pady=1)
            
        # Titre Nouveau Testament
        nt_lbl = ctk.CTkLabel(self.books_frame, text="📖 Nouveau Testament", font=ctk.CTkFont(size=14, weight="bold"))
        nt_lbl.pack(anchor="w", pady=(20, 5), padx=5)
        
        for name, code, ch_count in BOOKS_NT:
            btn = ctk.CTkButton(
                self.books_frame, 
                text=name, 
                fg_color="transparent", 
                text_color=("black", "white"),
                hover_color=("#E5E7EB", "#374151"),
                anchor="w",
                command=lambda n=name, c=code, cc=ch_count: self.select_book(n, c, cc)
            )
            btn.pack(fill="x", padx=5, pady=1)
            
        # 2. Conteneur Chapitres (Scrollable)
        self.chapters_frame = ctk.CTkScrollableFrame(self)
        self.chapters_frame.grid(row=0, column=1, sticky="nsew", padx=10, pady=10)
        
        self.selected_book_label = ctk.CTkLabel(self.chapters_frame, text="Choisissez un livre", font=ctk.CTkFont(size=14, weight="bold"))
        self.selected_book_label.pack(pady=10)
        
        self.chapters_grid_frame = ctk.CTkFrame(self.chapters_frame, fg_color="transparent")
        self.chapters_grid_frame.pack(fill="both", expand=True)
        
        self.selected_book_code = ""

    def select_book(self, name, code, ch_count):
        self.selected_book_code = code
        self.selected_book_label.configure(text=name)
        
        # Nettoyer la grille des chapitres précédente
        for widget in self.chapters_grid_frame.winfo_children():
            widget.destroy()
            
        # Recréer la grille de chapitres
        # On fait une grille de 3 ou 4 colonnes pour les nombres de chapitres
        cols = 3
        for i in range(cols):
            self.chapters_grid_frame.grid_columnconfigure(i, weight=1)
            
        for ch in range(1, ch_count + 1):
            row = (ch - 1) // cols
            col = (ch - 1) % cols
            
            btn = ctk.CTkButton(
                self.chapters_grid_frame,
                text=str(ch),
                width=35,
                height=35,
                command=lambda c=ch: self.select_chapter(c)
            )
            btn.grid(row=row, column=col, padx=4, pady=4, sticky="nsew")

    def select_chapter(self, chapter):
        # Déclenche le callback de recherche avec la référence du chapitre
        ref = f"{self.selected_book_code} {chapter}"
        self.on_select_callback(ref)
        self.destroy()
