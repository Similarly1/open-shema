import customtkinter as ctk

class ProgressOverlay(ctk.CTkFrame):
    def __init__(self, master, **kwargs):
        # We specify a fixed width of 420 and height of 110, and disable pack propagation
        # to ensure the window geometry remains exactly as requested.
        super().__init__(master, width=420, height=110, fg_color=("#F2F2F2", "#1E1E1E"), corner_radius=12, border_width=1, border_color=("#CCCCCC", "#333333"), **kwargs)
        self.pack_propagate(False)
        
        self.title_lbl = ctk.CTkLabel(self, text="Suivi des tâches en cours", font=ctk.CTkFont(weight="bold", size=14), anchor="w")
        self.title_lbl.pack(pady=(12, 8), padx=15, fill="x")
        
        self.tasks_frame = ctk.CTkFrame(self, fg_color="transparent")
        self.tasks_frame.pack(fill="both", expand=True, padx=15, pady=(0, 12))
        
        self.tasks = {}  # dict of name -> dict with widgets
        
    def add_or_update_task(self, name, percentage, status_text=""):
        if name not in self.tasks:
            # We want to make sure the overlay frame grows in height if there are multiple tasks
            # but for a single task, 110px is perfect.
            task_count = len(self.tasks) + 1
            if task_count > 1:
                self.configure(height=110 + (task_count - 1) * 35)
                
            frame = ctk.CTkFrame(self.tasks_frame, fg_color="transparent")
            frame.pack(fill="x", pady=4)
            
            # Configure columns: col 1 takes all available space
            frame.grid_columnconfigure(1, weight=1)
            
            check_lbl = ctk.CTkLabel(frame, text="⏳", font=ctk.CTkFont(size=14))
            check_lbl.grid(row=0, column=0, padx=(0, 8), sticky="w")
            
            short_name = name[:20] + "..." if len(name) > 23 else name
            text_lbl = ctk.CTkLabel(frame, text=short_name, font=ctk.CTkFont(size=12), anchor="w")
            text_lbl.grid(row=0, column=1, sticky="ew")
            
            pbar = ctk.CTkProgressBar(frame, width=120, height=8)
            pbar.set(0)
            pbar.grid(row=0, column=2, padx=10, sticky="e")
            
            pct_lbl = ctk.CTkLabel(frame, text="0%", font=ctk.CTkFont(size=12, weight="bold"), width=35, anchor="e")
            pct_lbl.grid(row=0, column=3, sticky="e")
            
            self.tasks[name] = {
                "frame": frame,
                "check": check_lbl,
                "text": text_lbl,
                "pct": pct_lbl,
                "pbar": pbar
            }
            
        task = self.tasks[name]
        
        # Format the display name (e.g. "CHO (Importation...)")
        display_name = name
        if status_text:
            display_name = f"{name} ({status_text})"
        if len(display_name) > 23:
            display_name = display_name[:20] + "..."
            
        task["text"].configure(text=display_name)
        task["pct"].configure(text=f"{int(percentage)}%")
        task["pbar"].set(percentage / 100.0)
        
        if percentage >= 100:
            task["check"].configure(text="✅", text_color="green")
        else:
            task["check"].configure(text="⏳", text_color="gray")
            
    def remove_task(self, name):
        if name in self.tasks:
            self.tasks[name]["frame"].destroy()
            del self.tasks[name]
            
            # Recalculate height
            task_count = len(self.tasks)
            self.configure(height=max(110, 110 + (task_count - 1) * 35))
            
        if not self.tasks:
            self.place_forget()
