import customtkinter as ctk
import threading
from ai.llm_client import LLMClient
from core.rag_pipeline import RAGPipeline

def insert_markdown_content(tb, text):
    """Insère du texte Markdown basique avec styles personnalisés dans un CTkTextbox."""
    import re
    lines = text.split("\n")
    for i, line in enumerate(lines):
        if line.startswith("# "):
            tb.insert("end", line[2:] + "\n", "h1")
        elif line.startswith("## "):
            tb.insert("end", line[3:] + "\n", "h2")
        elif line.startswith("### "):
            tb.insert("end", line[4:] + "\n", "h3")
        elif line.strip().startswith("- ") or line.strip().startswith("* "):
            content = line.strip()[2:]
            tb.insert("end", "• ", "bullet")
            _insert_inline_formatted(tb, content, "normal")
            tb.insert("end", "\n")
        elif re.match(r'^\d+\.\s', line.strip()):
            m = re.match(r'^(\d+\.\s)(.*)', line.strip())
            tb.insert("end", m.group(1), "bullet")
            _insert_inline_formatted(tb, m.group(2), "normal")
            tb.insert("end", "\n")
        else:
            _insert_inline_formatted(tb, line, "normal")
            tb.insert("end", "\n")

def _insert_inline_formatted(tb, text, base_tag):
    import re
    # Match bold-italic, bold, italic, code, brackets references
    pattern = r'(\*\*\*.*?\*\*\*|\*\*.*?\*\*|\*.*?\*|`.*?`|\[.*?\])'
    parts = re.split(pattern, text)
    for part in parts:
        if not part:
            continue
        if part.startswith("`") and part.endswith("`"):
            tb.insert("end", part[1:-1], "code")
        elif part.startswith("[") and part.endswith("]") and len(part) > 2:
            # Références bibliques / théologiques en gras coloré
            tb.insert("end", part, ("ref_citation", "bold"))
        elif part.startswith("***") and part.endswith("***"):
            tb.insert("end", part[3:-3], ("bold_italic", base_tag))
        elif part.startswith("**") and part.endswith("**"):
            tb.insert("end", part[2:-2], ("bold", base_tag))
        elif part.startswith("*") and part.endswith("*"):
            tb.insert("end", part[1:-1], ("italic", base_tag))
        else:
            tb.insert("end", part, base_tag)

class RightPanel(ctk.CTkFrame):
    def __init__(self, master, get_context_callback, config, db_callback=None, sources_callback=None):
        super().__init__(master)
        
        self.get_context = get_context_callback
        self.db_callback = db_callback
        self.sources_callback = sources_callback
        self.config = config
        
        chat_model = self.config.get("chat_model", "gemini-3.7-flash")
        provider = "gemini" if "gemini" in chat_model.lower() else "mistral"
        api_key = self.config.get("gemini_api_key" if provider == "gemini" else "mistral_api_key")
        self.llm = LLMClient(api_key=api_key, model=chat_model, provider=provider)
        
        self.last_answer = ""
        self.loader_active = False
        
        # Titre
        self.title_label = ctk.CTkLabel(self, text="Assistant IA", font=ctk.CTkFont(size=20, weight="bold"))
        self.title_label.pack(pady=(10, 4), padx=10)
        
        # Barre de contrôle du modèle, réflexion et RAG
        self.control_bar = ctk.CTkFrame(self, fg_color=("#F1F5F9", "#1E293B"), corner_radius=8)
        self.control_bar.pack(fill="x", padx=10, pady=(0, 6))
        
        # Ligne 1 : Sélecteur de modèle
        model_row = ctk.CTkFrame(self.control_bar, fg_color="transparent")
        model_row.pack(fill="x", padx=8, pady=(5, 2))
        
        lbl_mod = ctk.CTkLabel(model_row, text="Modèle :", font=ctk.CTkFont(size=11, weight="bold"))
        lbl_mod.pack(side="left", padx=(0, 4))
        
        self.chat_model_var = ctk.StringVar(value=self.config.get("chat_model", "gemini-3.7-flash"))
        self.model_menu = ctk.CTkOptionMenu(
            model_row,
            variable=self.chat_model_var,
            values=[
                "gemini-3.7-flash",
                "gemini-3.6-flash",
                "gemini-3.5-flash",
                "gemini-3.5-flash-lite",
                "gemini-3.1-flash-lite",
                "gemini-3-flash",
                "gemini-2.5-flash",
                "gemini-2.5-flash-lite",
                "mistral-small-latest",
                "mistral-large-latest"
            ],
            command=self.on_model_changed,
            height=26,
            font=ctk.CTkFont(size=11)
        )
        self.model_menu.pack(side="right", fill="x", expand=True)
        
        # Ligne 2 : Mode Réflexion & Niveau (Bas, Moyen, Maximum)
        thinking_row = ctk.CTkFrame(self.control_bar, fg_color="transparent")
        thinking_row.pack(fill="x", padx=8, pady=(2, 2))
        
        self.thinking_enabled_var = ctk.BooleanVar(value=self.config.get("thinking_enabled", True))
        self.thinking_switch = ctk.CTkSwitch(
            thinking_row,
            text="🧠 Réflexion",
            variable=self.thinking_enabled_var,
            command=self.on_thinking_changed,
            font=ctk.CTkFont(size=11, weight="bold"),
            width=36,
            height=18
        )
        self.thinking_switch.pack(side="left")
        
        self.thinking_level_var = ctk.StringVar(value=self.config.get("thinking_level", "Moyen"))
        self.thinking_level_menu = ctk.CTkOptionMenu(
            thinking_row,
            variable=self.thinking_level_var,
            values=["Bas", "Moyen", "Maximum"],
            command=self.on_thinking_changed,
            width=85,
            height=22,
            font=ctk.CTkFont(size=11)
        )
        self.thinking_level_menu.pack(side="right")
        
        if not self.thinking_enabled_var.get():
            self.thinking_level_menu.configure(state="disabled")

        # Ligne 3 : Mode de recherche RAG & Options
        rag_row = ctk.CTkFrame(self.control_bar, fg_color="transparent")
        rag_row.pack(fill="x", padx=8, pady=(2, 2))
        
        self.rag_mode_var = ctk.StringVar(value=self.config.get("rag_mode", "🌐 Bibliothèque (RAG)"))
        self.rag_mode_menu = ctk.CTkOptionMenu(
            rag_row,
            variable=self.rag_mode_var,
            values=["🌐 Bibliothèque (RAG)", "📖 Écran seul"],
            command=self.on_rag_mode_changed,
            width=135,
            height=22,
            font=ctk.CTkFont(size=11)
        )
        self.rag_mode_menu.pack(side="left")
        
        self.rerank_enabled_var = ctk.BooleanVar(value=self.config.get("rerank_enabled", True))
        self.rerank_switch = ctk.CTkSwitch(
            rag_row,
            text="🎯 Rerank",
            variable=self.rerank_enabled_var,
            command=self.on_rerank_changed,
            font=ctk.CTkFont(size=11, weight="bold"),
            width=36,
            height=18
        )
        self.rerank_switch.pack(side="right")
        
        # Ligne 4 : Switch pour inclure ou exclure le passage ouvert à l'écran
        screen_row = ctk.CTkFrame(self.control_bar, fg_color="transparent")
        screen_row.pack(fill="x", padx=8, pady=(2, 5))
        
        self.include_screen_var = ctk.BooleanVar(value=self.config.get("include_screen_context", True))
        self.include_screen_switch = ctk.CTkSwitch(
            screen_row,
            text="📌 Inclure passage à l'écran",
            variable=self.include_screen_var,
            command=self.on_include_screen_changed,
            font=ctk.CTkFont(size=11),
            width=36,
            height=18
        )
        self.include_screen_switch.pack(side="left")
        
        # Zone de chat
        self.chat_history = ctk.CTkTextbox(self, wrap="word")
        self.chat_history.pack(pady=6, padx=10, fill="both", expand=True)
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
        
        self.entry = ctk.CTkEntry(self.input_frame, placeholder_text="Posez une question sur vos textes ou toute la bibliothèque...")
        self.entry.pack(side="left", fill="x", expand=True, padx=(0, 10))
        self.entry.bind("<Return>", self.send_message)
        
        self.send_btn = ctk.CTkButton(self.input_frame, text="Envoyer", width=60, command=self.send_message)
        self.send_btn.pack(side="right")
        
    def on_model_changed(self, choice):
        self.config["chat_model"] = choice
        from core.config import save_config
        save_config(self.config)
        self.update_config(self.config)
        
    def on_thinking_changed(self, *args):
        is_enabled = self.thinking_enabled_var.get()
        self.thinking_level_menu.configure(state="normal" if is_enabled else "disabled")
        self.config["thinking_enabled"] = is_enabled
        self.config["thinking_level"] = self.thinking_level_var.get()
        from core.config import save_config
        save_config(self.config)

    def on_rag_mode_changed(self, choice):
        self.config["rag_mode"] = choice
        is_rag = "Bibliothèque" in choice
        self.include_screen_switch.configure(state="normal" if is_rag else "disabled")
        from core.config import save_config
        save_config(self.config)

    def on_rerank_changed(self, *args):
        self.config["rerank_enabled"] = self.rerank_enabled_var.get()
        from core.config import save_config
        save_config(self.config)

    def on_include_screen_changed(self, *args):
        self.config["include_screen_context"] = self.include_screen_var.get()
        from core.config import save_config
        save_config(self.config)

    def update_config(self, new_config):
        self.config = new_config
        chat_model = self.config.get("chat_model", "gemini-3.7-flash")
        self.chat_model_var.set(chat_model)
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
        
        context = self.get_context() if self.get_context else ""
        
        self.send_btn.configure(state="disabled")
        self.copy_btn.pack_forget()
        
        # Calculer le budget de réflexion
        thinking_budget = None
        current_model = self.config.get("chat_model", "gemini-3.7-flash")
        if "gemini" in current_model.lower():
            if self.thinking_enabled_var.get():
                lvl = self.thinking_level_var.get()
                if lvl == "Bas":
                    thinking_budget = 1024
                elif lvl == "Moyen":
                    thinking_budget = 4096
                elif lvl == "Maximum":
                    thinking_budget = 16384
                else:
                    thinking_budget = 4096
            else:
                thinking_budget = 0

        # Démarrer le loader animé
        self.start_loader()
        
        sys_prompt = self.config.get("chat_system_prompt")
        is_rag = "Bibliothèque" in self.rag_mode_var.get()
        db = self.db_callback() if self.db_callback else None
        active_sources = self.sources_callback() if self.sources_callback else None
        enable_rerank = self.rerank_enabled_var.get()
        
        # Déterminer le contexte écran effectif selon le mode et l'interrupteur
        if is_rag:
            effective_screen_context = context if self.include_screen_var.get() else None
        else:
            effective_screen_context = context

        def run_ai():
            if is_rag and db:
                pipeline = RAGPipeline(db=db, config=self.config)
                result = pipeline.execute(
                    query=user_text,
                    active_sources=active_sources,
                    screen_context=effective_screen_context,
                    top_k_raw=int(self.config.get("rag_top_k_raw", 25)),
                    top_k_final=int(self.config.get("rag_top_k_final", 7)),
                    enable_rerank=enable_rerank,
                    enable_curation=bool(self.config.get("rag_enable_curation", False)),
                    chat_model=current_model,
                    thinking_budget=thinking_budget,
                    system_prompt=sys_prompt
                )
                self.after(0, self.display_rag_result, result)
            else:
                answer = self.llm.ask_question(effective_screen_context or "", user_text, system_prompt=sys_prompt, thinking_budget=thinking_budget)
                self.after(0, self.display_answer, answer)
            
        threading.Thread(target=run_ai, daemon=True).start()
        
    def send_custom_prompt(self, prompt_text):
        """Injecte une question pré-remplie et lance l'analyse IA immédiatement"""
        self.entry.delete(0, "end")
        self.entry.insert(0, prompt_text)
        self.send_message()
        
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
        
        used_model = getattr(getattr(self.llm, "client", None), "last_used_model", self.config.get("chat_model", "gemini-3.7-flash"))
        thinking_badge = ""
        if "gemini" in str(used_model).lower():
            if self.thinking_enabled_var.get():
                thinking_badge = f" ({used_model} • 🧠 {self.thinking_level_var.get()})"
            else:
                thinking_badge = f" ({used_model} • ⚡ Direct)"
        else:
            thinking_badge = f" ({used_model})"
        
        mode_badge = " [🌐 RAG]" if "Bibliothèque" in self.rag_mode_var.get() else ""
        
        self.chat_history.configure(state="normal")
        self.chat_history.insert("end", f"Assistant{thinking_badge}{mode_badge} : ", "ai_header")
        self.chat_history.insert("end", "Recherche & Réflexion en cours...\n\n", ("loader", "italic"))
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
                for char_idx in range(line_len):
                    if 0 <= char_idx - p < 6:
                        new_line += "▓"
                    else:
                        new_line += "░"
                frame_lines.append(new_line)
                
            self.chat_history.insert(start, "\n".join(frame_lines) + "\n\n", "skeleton")
            
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
        
    def display_rag_result(self, result):
        """Affiche le résultat enrichi du pipeline RAG avec sources et métriques."""
        self.stop_loader()
        
        answer = result.get("answer", "")
        self.last_answer = answer
        sources = result.get("sources", [])
        timings = result.get("timings", {})
        
        self.chat_history.configure(state="normal")
        insert_markdown_content(self.chat_history, answer)
        self.chat_history.insert("end", "\n")
        
        # Bloc récapitulatif des sources retenues par le Reranker
        if sources:
            self.chat_history.insert("end", "📚 Sources retenues par le Reranking :\n", ("bold", "h3"))
            for s in sources:
                meta = s.get("metadata", {})
                source_name = meta.get("name") or meta.get("source") or "Document"
                book = meta.get("book", "")
                chap = meta.get("chapter", "")
                verse = meta.get("verse", "")
                ref_parts = []
                if book: ref_parts.append(str(book))
                if chap: ref_parts.append(f"{chap}:{verse}" if verse else f"Ch. {chap}")
                ref_str = f" ({' '.join(ref_parts)})" if ref_parts else ""
                
                score_val = s.get("rerank_score")
                score_txt = f" • Pertinence {int(score_val * 100)}%" if score_val is not None else ""
                
                self.chat_history.insert("end", f"  • {source_name}{ref_str}{score_txt}\n", "bullet")
            self.chat_history.insert("end", "\n")

        # Ligne de métriques temporelles discrète
        if timings:
            tot = timings.get("total_ms", 0) / 1000.0
            rerank_ms = timings.get("rerank_ms", 0)
            llm_ms = timings.get("llm_ms", 0)
            stats_str = f"⏱️ Réponse en {tot:.1f}s (Rerank CPU: {rerank_ms:.0f}ms • IA: {llm_ms/1000.0:.1f}s)\n\n"
            self.chat_history.insert("end", stats_str, "loader")
            
        self.chat_history.yview("end")
        self.chat_history.configure(state="disabled")
        
        self.send_btn.configure(state="normal")
        self.copy_btn.pack(side="right", padx=10)

    def display_answer(self, answer):
        self.stop_loader()
        self.last_answer = answer
        
        self.chat_history.configure(state="normal")
        insert_markdown_content(self.chat_history, answer)
        self.chat_history.insert("end", "\n\n")
        self.chat_history.yview("end")
        self.chat_history.configure(state="disabled")
        
        self.send_btn.configure(state="normal")
        self.copy_btn.pack(side="right", padx=10)
        
    def copy_last_answer(self):
        if self.last_answer:
            self.clipboard_clear()
            self.clipboard_append(self.last_answer)
            self.update()
            
            self.copy_btn.configure(text="✓ Copié !", fg_color=["#10B981", "#059669"], text_color="white")
            self.after(1500, self.reset_copy_btn)
            
    def reset_copy_btn(self):
        self.copy_btn.configure(text="📋 Copier", fg_color="transparent", text_color=("black", "white"))
        
    def apply_font(self, font_family, font_size):
        self.chat_history.configure(font=(font_family, font_size))
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
        tb.tag_configure("ref_citation", font=(font_family, font_size, "bold"), foreground="#6366F1")
        tb.tag_configure("loader", font=(font_family, font_size - 2, "italic"), foreground="#888888")
        tb.tag_configure("skeleton", font=(font_family, font_size), foreground="#D1D5DB", spacing1=4)
