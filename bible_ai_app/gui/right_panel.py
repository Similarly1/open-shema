import customtkinter as ctk
import threading
import re
from ai.llm_client import LLMClient

def insert_markdown_content(textbox, text):
    """Parse et insère du texte formaté Markdown dans un CTkTextbox"""
    tb = textbox._textbox
    
    # Configuration des tags de style déjà définie dynamiquement dans apply_font()
    
    lines = text.split("\n")
    for line in lines:
        line_strip = line.strip()
        
        # Titres
        if line_strip.startswith("### "):
            clean_line = line_strip[4:]
            insert_inline_styles(tb, clean_line, "h3")
            tb.insert("end", "\n")
        elif line_strip.startswith("## "):
            clean_line = line_strip[3:]
            insert_inline_styles(tb, clean_line, "h2")
            tb.insert("end", "\n")
        elif line_strip.startswith("# "):
            clean_line = line_strip[2:]
            insert_inline_styles(tb, clean_line, "h1")
            tb.insert("end", "\n")
        # Listes à puces
        elif line_strip.startswith("- ") or line_strip.startswith("* "):
            clean_line = "• " + line_strip[2:]
            insert_inline_styles(tb, clean_line, "bullet")
            tb.insert("end", "\n")
        # Séparateurs
        elif line_strip == "---":
            tb.insert("end", "─" * 35 + "\n", "normal")
        # Tableaux (police monospacée)
        elif line_strip.startswith("|") and line_strip.endswith("|"):
            insert_inline_styles(tb, line, "code")
            tb.insert("end", "\n")
        # Ligne normale
        else:
            insert_inline_styles(tb, line, "normal")
            tb.insert("end", "\n")

def insert_inline_styles(tb, line_text, base_tag):
    """Regex pour appliquer le gras et l'italique inline à l'intérieur d'une ligne"""
    pattern = re.compile(r'(\*\*\*.*?\*\*\*|\*\*.*?\*\*|\*.*?\*)')
    parts = pattern.split(line_text)
    
    for part in parts:
        if part.startswith("***") and part.endswith("***"):
            tb.insert("end", part[3:-3], ("bold_italic", base_tag))
        elif part.startswith("**") and part.endswith("**"):
            tb.insert("end", part[2:-2], ("bold", base_tag))
        elif part.startswith("*") and part.endswith("*"):
            tb.insert("end", part[1:-1], ("italic", base_tag))
        else:
            tb.insert("end", part, base_tag)

class RightPanel(ctk.CTkFrame):
    def __init__(self, master, get_context_callback, config):
        super().__init__(master)
        
        self.get_context = get_context_callback
        self.config = config
        chat_model = self.config.get("chat_model", "mistral-small-latest")
        provider = "gemini" if "gemini" in chat_model.lower() else "mistral"
        api_key = self.config.get("gemini_api_key" if provider == "gemini" else "mistral_api_key")
        self.llm = LLMClient(api_key=api_key, model=chat_model, provider=provider)
        
        self.last_answer = ""
        self.loader_active = False
        
        # Titre
        self.title_label = ctk.CTkLabel(self, text="Assistant IA", font=ctk.CTkFont(size=20, weight="bold"))
        self.title_label.pack(pady=(10, 15), padx=10)
        
        # Zone de chat
        self.chat_history = ctk.CTkTextbox(self, wrap="word")
        self.chat_history.pack(pady=10, padx=10, fill="both", expand=True)
        self.chat_history.configure(state="disabled")
        
        # Appliquer la police initiale depuis la config
        self.apply_font(self.config.get("font_family", "Georgia"), self.config.get("font_size", 18))
        
        # Frame d'actions rapides (Copier)
        self.action_frame = ctk.CTkFrame(self, fg_color="transparent")
        self.action_frame.pack(fill="x", padx=10, pady=(0, 2))
        
        self.copy_btn = ctk.CTkButton(
            self.action_frame, 
            text="📋 Copier", 
            width=80, 
            height=28, 
            fg_color="transparent", 
            border_width=1,
            text_color=("black", "white"),
            command=self.copy_last_answer
        )
        # Caché au début car pas de réponse
        self.copy_btn.pack_forget()
        
        # Zone d'écriture
        self.input_frame = ctk.CTkFrame(self)
        self.input_frame.pack(fill="x", padx=10, pady=10)
        
        self.entry = ctk.CTkEntry(self.input_frame, placeholder_text="Posez une question sur le texte...")
        self.entry.pack(side="left", fill="x", expand=True, padx=(0, 10))
        self.entry.bind("<Return>", self.send_message)
        
        self.send_btn = ctk.CTkButton(self.input_frame, text="Envoyer", width=60, command=self.send_message)
        self.send_btn.pack(side="right")
        
    def update_config(self, new_config):
        self.config = new_config
        chat_model = self.config.get("chat_model", "mistral-small-latest")
        provider = "gemini" if "gemini" in chat_model.lower() else "mistral"
        api_key = self.config.get("gemini_api_key" if provider == "gemini" else "mistral_api_key")
        self.llm = LLMClient(api_key=api_key, model=chat_model, provider=provider)
        
    def send_message(self, event=None):
        user_text = self.entry.get()
        if not user_text.strip():
            return
            
        self.entry.delete(0, "end")
        
        # Afficher la question utilisateur
        self.chat_history.configure(state="normal")
        self.chat_history.insert("end", "Vous : ", "user_header")
        self.chat_history.insert("end", f"{user_text}\n\n", "normal")
        self.chat_history.configure(state="disabled")
        self.chat_history.yview("end")
        
        context = self.get_context()
        
        self.send_btn.configure(state="disabled")
        self.copy_btn.pack_forget() # Masquer le bouton de copie pendant le chargement
        
        # Démarrer le loader animé
        self.start_loader()
        
        sys_prompt = self.config.get("chat_system_prompt")
        def run_ai():
            answer = self.llm.ask_question(context, user_text, system_prompt=sys_prompt)
            self.after(0, self.display_answer, answer)
            
        threading.Thread(target=run_ai, daemon=True).start()
        
    def send_custom_prompt(self, prompt_text):
        """Injecte une question pré-remplie et lance l'analyse IA immédiatement"""
        self.input_entry.delete("0.0", "end")
        self.input_entry.insert("0.0", prompt_text)
        self.on_send()
        
    def start_loader(self):
        if getattr(self, 'loader_after_id', None):
            self.after_cancel(self.loader_after_id)
            self.loader_after_id = None
            
        self.loader_active = True
        self.skeleton_lines = [
            "████████████████████████████████████",
            "████████████████████████████",
            "████████████████████████████████"
        ]
        self.loader_index = 0
        
        self.chat_history.configure(state="normal")
        self.chat_history.insert("end", "IA : ", "ai_header")
        self.chat_history.insert("end", "Réflexion en cours...\n\n", ("loader", "italic"))
        self.chat_history.insert("end", "\n".join(self.skeleton_lines) + "\n\n", "skeleton")
        self.chat_history.configure(state="disabled")
        self.chat_history.yview("end")
        
        self.animate_loader()
        
    def animate_loader(self):
        if not getattr(self, 'loader_active', False):
            return
            
        self.loader_index = (self.loader_index + 1) % 60
        
        self.chat_history.configure(state="normal")
        ranges = self.chat_history._textbox.tag_ranges("skeleton")
        if ranges:
            start, end = ranges[0], ranges[1]
            self.chat_history._textbox.delete(start, end)
            
            frame_lines = []
            for line_idx, line_len in enumerate([36, 28, 32]):
                p = (self.loader_index - line_idx * 6) % (line_len + 15) - 5
                new_line = ""
                for i in range(line_len):
                    if p <= i <= p + 4:
                        new_line += "░"
                    else:
                        new_line += "█"
                frame_lines.append(new_line)
                
            self.chat_history._textbox.insert(start, "\n".join(frame_lines) + "\n\n", "skeleton")
            
        self.chat_history.configure(state="disabled")
        self.loader_after_id = self.after(50, self.animate_loader)
        
    def stop_loader(self):
        self.loader_active = False
        if getattr(self, 'loader_after_id', None):
            self.after_cancel(self.loader_after_id)
            self.loader_after_id = None
            
        self.chat_history.configure(state="normal")
        
        ranges = self.chat_history._textbox.tag_ranges("loader")
        if ranges:
            start, end = ranges[0], ranges[1]
            self.chat_history._textbox.delete(start, end)
            
        ranges_skel = self.chat_history._textbox.tag_ranges("skeleton")
        if ranges_skel:
            start, end = ranges_skel[0], ranges_skel[1]
            self.chat_history._textbox.delete(start, end)
            
        self.chat_history.configure(state="disabled")
        
    def display_answer(self, answer):
        self.stop_loader()
        
        self.last_answer = answer
        
        # Afficher la réponse formatee
        self.chat_history.configure(state="normal")
        insert_markdown_content(self.chat_history, answer)
        self.chat_history.insert("end", "\n")
        self.chat_history.yview("end")
        self.chat_history.configure(state="disabled")
        
        # Réactiver les contrôles et afficher le bouton de copie
        self.send_btn.configure(state="normal")
        self.copy_btn.pack(side="right", padx=10)
        
    def copy_last_answer(self):
        if self.last_answer:
            self.clipboard_clear()
            self.clipboard_append(self.last_answer)
            self.update()
            
            # Effet visuel temporaire sur le bouton
            self.copy_btn.configure(text="✓ Copié !", fg_color=["#10B981", "#059669"], text_color="white")
            self.after(1500, self.reset_copy_btn)
            
    def reset_copy_btn(self):
        self.copy_btn.configure(text="📋 Copier", fg_color="transparent", text_color=("black", "white"))
        
    def apply_font(self, font_family, font_size):
        # Ajuster la police globale de la zone de chat
        self.chat_history.configure(font=(font_family, font_size))
        
        # Mettre à jour tous les tags de style du textbox pour suivre la taille
        tb = self.chat_history._textbox
        tb.tag_configure("bold", font=(font_family, font_size, "bold"))
        tb.tag_configure("italic", font=(font_family, font_size, "italic"))
        tb.tag_configure("bold_italic", font=(font_family, font_size, "bold", "italic"))
        tb.tag_configure("h1", font=(font_family, font_size + 4, "bold"), spacing1=12, spacing3=6)
        tb.tag_configure("h2", font=(font_family, font_size + 2, "bold"), spacing1=10, spacing3=5)
        tb.tag_configure("h3", font=(font_family, font_size, "bold"), spacing1=8, spacing3=4)
        tb.tag_configure("bullet", lmargin1=20, lmargin2=30, spacing1=3)
        tb.tag_configure("normal", font=(font_family, font_size), spacing1=3, spacing2=2)
        tb.tag_configure("code", font=("Courier New", font_size - 2), background="#F0F0F0")
        tb.tag_configure("user_header", font=(font_family, font_size, "bold"), foreground="#3B82F6", spacing1=10)
        tb.tag_configure("ai_header", font=(font_family, font_size, "bold"), foreground="#10B981", spacing1=10)
        tb.tag_configure("loader", font=(font_family, font_size, "italic"), foreground="#888888")
        tb.tag_configure("skeleton", font=(font_family, font_size), foreground="#D1D5DB", spacing1=4)
