import os
import re
import time
import datetime
import tkinter as tk
import customtkinter as ctk
import threading
from ai.llm_client import LLMClient
from core.rag_pipeline import RAGPipeline

active_citation_tooltips = []

def _find_matching_source(citation_text, sources):
    """Retrouve l'extrait le plus pertinent correspondant à une citation textuelle."""
    if not sources:
        return None
    c_lower = citation_text.lower()
    for s in sources:
        meta = s.get("metadata", {})
        name = (meta.get("name") or meta.get("source") or "").lower()
        book = (meta.get("book") or "").lower()
        chap = str(meta.get("chapter") or "").lower()
        
        if (name and name in c_lower) or (book and book in c_lower):
            if chap and chap in c_lower:
                return s
    for s in sources:
        meta = s.get("metadata", {})
        name = (meta.get("name") or meta.get("source") or "").lower()
        book = (meta.get("book") or "").lower()
        if (name and name in c_lower) or (book and book in c_lower):
            return s
    return sources[0] if sources else None

def _bind_citation_tooltip(tb, tag_name, citation_text, doc):
    """Attache une infobulle flottante au survol d'une citation dans le texte."""
    def on_enter(event):
        try:
            # Fermer les anciennes infobulles
            for tw in list(active_citation_tooltips):
                try: tw.destroy()
                except Exception: pass
            active_citation_tooltips.clear()
            
            x = tb.winfo_rootx() + event.x + 10
            y = tb.winfo_rooty() + event.y - 125
            
            tw = tk.Toplevel(tb)
            tw.wm_overrideredirect(True)
            tw.wm_attributes("-topmost", True)
            tw.geometry(f"+{max(10, x)}+{max(10, y)}")
            
            is_dark = (ctk.get_appearance_mode() == "Dark")
            bg_color = "#0F172A" if is_dark else "#FFFFFF"
            border_color = "#6366F1" if is_dark else "#4F46E5"
            text_color = "#F8FAFC" if is_dark else "#0F172A"
            
            frame = tk.Frame(tw, bg=bg_color, highlightbackground=border_color, highlightthickness=1.5, padx=12, pady=10)
            frame.pack(fill="both", expand=True)
            
            header_title = citation_text
            score_txt = ""
            snippet = "Extrait indexé dans votre bibliothèque."
            if doc:
                meta = doc.get("metadata", {})
                t = meta.get("name") or meta.get("source")
                score = doc.get("rerank_score")
                if score is not None:
                    score_txt = f" • Pertinence {int(score * 100)}%"
                snippet = doc.get("text", "")
                if len(snippet) > 300:
                    snippet = snippet[:300].strip() + "..."
                    
            lbl_h = tk.Label(frame, text=f"📖 {header_title}{score_txt}", font=("Segoe UI", 10, "bold"), fg="#6366F1", bg=bg_color, anchor="w")
            lbl_h.pack(fill="x", pady=(0, 4))
            
            lbl_b = tk.Label(frame, text=snippet, font=("Segoe UI", 9), fg=text_color, bg=bg_color, wraplength=420, justify="left")
            lbl_b.pack(fill="x")
            
            active_citation_tooltips.append(tw)
        except Exception:
            pass
            
    def on_leave(event):
        for tw in list(active_citation_tooltips):
            try: tw.destroy()
            except Exception: pass
        active_citation_tooltips.clear()

    inner_tb = tb._textbox if hasattr(tb, '_textbox') else tb
    inner_tb.tag_bind(tag_name, "<Enter>", on_enter)
    inner_tb.tag_bind(tag_name, "<Leave>", on_leave)

def insert_markdown_content(tb, text, sources=None):
    """Insère du texte Markdown avec liens de citations interactifs."""
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
            tb.insert("end", "  • ", "bullet")
            _insert_inline_formatted(tb, content, "normal", sources=sources)
            tb.insert("end", "\n")
        elif re.match(r'^\d+\.\s', line.strip()):
            m = re.match(r'^(\d+\.\s)(.*)', line.strip())
            tb.insert("end", f"  {m.group(1)}", "bullet")
            _insert_inline_formatted(tb, m.group(2), "normal", sources=sources)
            tb.insert("end", "\n")
        else:
            _insert_inline_formatted(tb, line, "normal", sources=sources)
            tb.insert("end", "\n")

def _insert_inline_formatted(tb, text, base_tag, sources=None):
    pattern = r'(\*\*\*.*?\*\*\*|\*\*.*?\*\*|\*.*?\*|`.*?`|\[.*?\])'
    parts = re.split(pattern, text)
    for part in parts:
        if not part:
            continue
        if part.startswith("`") and part.endswith("`"):
            tb.insert("end", part[1:-1], "code")
        elif part.startswith("[") and part.endswith("]") and len(part) > 2:
            citation_content = part[1:-1].strip()
            # Créer un tag unique pour la citation
            tag_name = f"cite_tag_{abs(hash(part))}_{time.time_ns()}"
            tb.insert("end", part, (tag_name, "ref_citation", "bold"))
            matched_doc = _find_matching_source(citation_content, sources)
            _bind_citation_tooltip(tb, tag_name, citation_content, matched_doc)
        elif part.startswith("***") and part.endswith("***"):
            tb.insert("end", part[3:-3], ("bold_italic", base_tag))
        elif part.startswith("**") and part.endswith("**"):
            tb.insert("end", part[2:-2], ("bold", base_tag))
        elif part.startswith("*") and part.endswith("*"):
            tb.insert("end", part[1:-1], ("italic", base_tag))
        else:
            tb.insert("end", part, base_tag)


class SourceTooltip:
    """Infobulle flottante légère affichant l'extrait et la source au survol d'un badge de pied de page."""
    def __init__(self, widget, source_data):
        self.widget = widget
        self.data = source_data
        self.tw = None
        self.widget.bind("<Enter>", self.show)
        self.widget.bind("<Leave>", self.hide)

    def show(self, event=None):
        if self.tw:
            return
        x = self.widget.winfo_rootx() - 10
        y = self.widget.winfo_rooty() - 120
        
        self.tw = tk.Toplevel(self.widget)
        self.tw.wm_overrideredirect(True)
        self.tw.wm_attributes("-topmost", True)
        self.tw.geometry(f"+{max(10, x)}+{max(10, y)}")
        
        is_dark = (ctk.get_appearance_mode() == "Dark")
        bg_color = "#0F172A" if is_dark else "#FFFFFF"
        border_color = "#6366F1" if is_dark else "#4F46E5"
        text_color = "#F8FAFC" if is_dark else "#0F172A"
        
        frame = tk.Frame(self.tw, bg=bg_color, highlightbackground=border_color, highlightthickness=1.5, padx=12, pady=10)
        frame.pack(fill="both", expand=True)
        
        meta = self.data.get("metadata", {})
        title = meta.get("name") or meta.get("source") or "Ouvrage"
        book = meta.get("book", "")
        chap = meta.get("chapter", "")
        verse = meta.get("verse", "")
        ref_parts = []
        if book: ref_parts.append(str(book))
        if chap: ref_parts.append(f"{chap}:{verse}" if verse else f"Ch. {chap}")
        ref_str = f" ({' '.join(ref_parts)})" if ref_parts else ""
        
        score = self.data.get("rerank_score")
        score_str = f" • Pertinence {int(score * 100)}%" if score is not None else ""
        
        lbl_head = tk.Label(frame, text=f"📖 {title}{ref_str}{score_str}", font=("Segoe UI", 10, "bold"), fg="#6366F1", bg=bg_color, anchor="w")
        lbl_head.pack(fill="x", pady=(0, 4))
        
        text_snippet = self.data.get("text", "")
        if len(text_snippet) > 280:
            text_snippet = text_snippet[:280].strip() + "..."
            
        lbl_body = tk.Label(frame, text=text_snippet, font=("Segoe UI", 9), fg=text_color, bg=bg_color, wraplength=380, justify="left")
        lbl_body.pack(fill="x")

    def hide(self, event=None):
        if self.tw:
            try:
                self.tw.destroy()
            except Exception:
                pass
            self.tw = None


class MessageFooterFrame(ctk.CTkFrame):
    """Pied de message interactif : bouton ⋯ (options), badges de sources avec infobulles, heure et bouton copier."""
    def __init__(self, master, result_dict, answer_text, on_show_details=None):
        super().__init__(master, fg_color="transparent")
        self.result_dict = result_dict
        self.answer_text = answer_text
        self.on_show_details = on_show_details
        
        # 1. Bouton "⋯" (Plus d'options / détails techniques)
        self.btn_options = ctk.CTkButton(
            self, 
            text="⋯", 
            width=28, 
            height=24, 
            fg_color=("gray90", "#334155"), 
            hover_color=("gray80", "#475569"),
            text_color=("black", "white"),
            font=ctk.CTkFont(size=13, weight="bold"),
            corner_radius=6,
            command=self._open_details
        )
        self.btn_options.pack(side="left", padx=(0, 6), pady=2)
        
        # 2. Badges des sources retenues (chips interactifs)
        sources = self.result_dict.get("sources", []) if isinstance(self.result_dict, dict) else []
        if sources:
            for s in sources[:4]:
                meta = s.get("metadata", {})
                source_name = meta.get("name") or meta.get("source") or "Ouvrage"
                book = meta.get("book", "")
                label_txt = f"📖 {source_name}" if not book else f"📖 {book}"
                score = s.get("rerank_score")
                if score is not None:
                    label_txt += f" {int(score * 100)}%"
                    
                chip = ctk.CTkButton(
                    self, 
                    text=label_txt, 
                    height=24, 
                    fg_color=("gray92", "#1E293B"), 
                    hover_color=("gray85", "#334155"),
                    border_color=("#CBD5E1", "#475569"),
                    border_width=1,
                    text_color=("#334155", "#CBD5E1"),
                    font=ctk.CTkFont(size=10),
                    corner_radius=12
                )
                chip.pack(side="left", padx=(0, 4), pady=2)
                SourceTooltip(chip, s)
                
            if len(sources) > 4:
                lbl_more = ctk.CTkLabel(self, text=f"+{len(sources)-4}", font=ctk.CTkFont(size=10), text_color="gray")
                lbl_more.pack(side="left", padx=(2, 4))
                
        # 3. Bouton Copier (à droite)
        self.copy_btn = ctk.CTkButton(
            self, 
            text="📋", 
            width=28, 
            height=24, 
            fg_color="transparent", 
            hover_color=("gray85", "#334155"),
            text_color=("black", "white"),
            font=ctk.CTkFont(size=12),
            corner_radius=6,
            command=self._copy_answer
        )
        self.copy_btn.pack(side="right", padx=(4, 0), pady=2)
        
        # 4. Heure exacte du message
        now_str = datetime.datetime.now().strftime("%H:%M")
        self.time_lbl = ctk.CTkLabel(
            self, 
            text=now_str, 
            font=ctk.CTkFont(size=10), 
            text_color=("gray60", "gray50")
        )
        self.time_lbl.pack(side="right", padx=(4, 4))

    def _open_details(self):
        if self.on_show_details and isinstance(self.result_dict, dict):
            self.on_show_details(self.result_dict)

    def _copy_answer(self):
        if self.answer_text:
            self.clipboard_clear()
            self.clipboard_append(self.answer_text)
            self.update()
            self.copy_btn.configure(text="✓", fg_color=["#10B981", "#059669"], text_color="white")
            self.after(1500, lambda: self.copy_btn.configure(text="📋", fg_color="transparent", text_color=("black", "white")))


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
        self.step_tracker_active = False
        
        # En-tête sobre
        self.title_label = ctk.CTkLabel(self, text="Assistant IA", font=ctk.CTkFont(size=18, weight="bold"))
        self.title_label.pack(pady=(10, 6), padx=10)
        
        # Barre de contrôle compacte
        self.control_bar = ctk.CTkFrame(self, fg_color=("#F1F5F9", "#1E293B"), corner_radius=8)
        self.control_bar.pack(fill="x", padx=10, pady=(0, 6))
        
        # Ligne 1 : Modèle
        model_row = ctk.CTkFrame(self.control_bar, fg_color="transparent")
        model_row.pack(fill="x", padx=8, pady=(4, 2))
        
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
                "mistral-large-latest",
                "Qwen/Qwen3.5-397B-A17B-FP8"
            ],
            command=self.on_model_changed,
            height=24,
            font=ctk.CTkFont(size=11)
        )
        self.model_menu.pack(side="right", fill="x", expand=True)
        
        # Ligne 2 : Mode Réflexion (Thinking Mode)
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

        # Ligne 3 : Mode RAG & Reranker
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
        
        # Ligne 4 : Switch passage à l'écran
        screen_row = ctk.CTkFrame(self.control_bar, fg_color="transparent")
        screen_row.pack(fill="x", padx=8, pady=(2, 4))
        
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
        self.chat_history.pack(pady=4, padx=10, fill="both", expand=True)
        self.chat_history.configure(state="disabled")
        
        # Calibrage typographique harmonisé (15px)
        self.apply_font(self.config.get("font_family", "Segoe UI"), 15)
        
        # Zone d'écriture
        self.input_frame = ctk.CTkFrame(self)
        self.input_frame.pack(fill="x", padx=10, pady=8)
        
        self.entry = ctk.CTkEntry(self.input_frame, placeholder_text="Posez une question à l'assistant...", height=34)
        self.entry.pack(side="left", fill="x", expand=True, padx=(0, 8))
        self.entry.bind("<Return>", self.send_message)
        
        self.send_btn = ctk.CTkButton(self.input_frame, text="Envoyer", width=65, height=34, command=self.send_message)
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
        self.rerank_switch.configure(state="normal" if is_rag else "disabled")
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
        provider = "infomaniak" if ("infomaniak" in chat_model.lower() or "ministral" in chat_model.lower() or "qwen" in chat_model.lower()) else ("mistral" if "mistral" in chat_model else "gemini")
        api_key = self.config.get(f"{provider}_api_key" if provider != "infomaniak" else "infomaniak_token", "")
        product_id = self.config.get("infomaniak_product_id", "251") if provider == "infomaniak" else None
        self.llm = LLMClient(api_key=api_key, model=chat_model, provider=provider, product_id=product_id)
        
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
        
        # Calcul du budget de réflexion
        thinking_budget = None
        current_model = self.config.get("chat_model", "gemini-3.7-flash")
        if "gemini" in current_model.lower():
            if self.thinking_enabled_var.get():
                lvl = self.thinking_level_var.get()
                thinking_budget = 1024 if lvl == "Bas" else (16384 if lvl == "Maximum" else 4096)
            else:
                thinking_budget = 0

        is_rag = "Bibliothèque" in self.rag_mode_var.get()
        db = self.db_callback() if self.db_callback else None
        active_sources = self.sources_callback() if self.sources_callback else None
        enable_rerank = self.rerank_enabled_var.get()
        enable_curation = bool(self.config.get("rag_enable_curation", False))
        curation_model = self.config.get("rag_curation_model", "mistralai/Ministral-3-14B-Instruct-2512")
        
        effective_screen_context = context if (self.include_screen_var.get() or not is_rag) else None

        # Démarrer le tracker d'étapes sobre
        self.start_step_tracker(is_rag=is_rag, has_curation=enable_curation)
        
        sys_prompt = self.config.get("chat_system_prompt")

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
                    enable_curation=enable_curation,
                    curation_model=curation_model,
                    chat_model=current_model,
                    thinking_budget=thinking_budget,
                    system_prompt=sys_prompt,
                    step_callback=lambda sid, lbl, st: self.after(0, self.update_step_tracker, sid, lbl, st)
                )
                self.after(0, self.display_final_result, result)
            else:
                self.after(0, self.update_step_tracker, "writing", "Rédaction de l'exégèse en cours...", "running")
                answer = self.llm.ask_question(effective_screen_context or "", user_text, system_prompt=sys_prompt, thinking_budget=thinking_budget)
                self.after(0, self.display_final_result, {"answer": answer, "sources": [], "model_used": current_model, "timings": {}})

        threading.Thread(target=run_ai, daemon=True).start()

    def start_step_tracker(self, is_rag=True, has_curation=False):
        """Initialise le suivi sobre d'étapes dans la zone de chat."""
        self.chat_history.configure(state="normal")
        self.chat_history.insert("end", "Assistant IA : \n", "ai_header")
        
        if is_rag:
            if has_curation:
                init_text = "  ⏳ 1. Recherche dans la bibliothèque...\n  ⏳ 2. Tri de pertinence croisée (Reranker)...\n  ⏳ 3. Curation du contexte (Mistral 14B)...\n  ⏳ 4. Rédaction de l'exégèse...\n\n"
            else:
                init_text = "  ⏳ 1. Recherche dans la bibliothèque...\n  ⏳ 2. Tri de pertinence croisée (Reranker)...\n  ⏳ 3. Rédaction de l'exégèse...\n\n"
        else:
            init_text = "  ⏳ Rédaction de l'exégèse en cours...\n\n"
            
        self.chat_history.insert("end", init_text, "tracker")
        self.chat_history.configure(state="disabled")
        self.chat_history.yview("end")
        
    def update_step_tracker(self, step_id, label, status):
        """Met à jour une étape avec un indicateur visuel épuré."""
        self.chat_history.configure(state="normal")
        ranges = self.chat_history._textbox.tag_ranges("tracker")
        if ranges:
            start, end = ranges[0], ranges[1]
            self.chat_history._textbox.delete(start, end)
            
            icon = "✓" if status == "done" else "⏳"
            step_text = f"  {icon} {label}\n\n"
            self.chat_history.insert(start, step_text, "tracker")
            
        self.chat_history.configure(state="disabled")
        self.chat_history.yview("end")

    def display_final_result(self, result):
        """Affiche la réponse rédigée et insère le pied de message interactif."""
        self.chat_history.configure(state="normal")
        
        # Supprimer le bloc de suivi d'étapes
        ranges = self.chat_history._textbox.tag_ranges("tracker")
        if ranges:
            start, end = ranges[0], ranges[1]
            self.chat_history._textbox.delete(start, end)
            
        answer = result.get("answer", "")
        self.last_answer = answer
        sources = result.get("sources", [])
        
        # Insérer la réponse formatée avec infobulles sur chaque citation
        insert_markdown_content(self.chat_history, answer, sources=sources)
        self.chat_history.insert("end", "\n")
        
        # Insérer le composant interactif de pied de message (⋯, badges de sources, heure, copier)
        footer_widget = MessageFooterFrame(
            master=self.chat_history,
            result_dict=result,
            answer_text=answer,
            on_show_details=self.show_details_popup
        )
        self.chat_history._textbox.window_create("end", window=footer_widget)
        self.chat_history.insert("end", "\n\n")
        
        self.chat_history.yview("end")
        self.chat_history.configure(state="disabled")
        self.send_btn.configure(state="normal")

    def show_details_popup(self, result_dict):
        """Affiche un popover moderne et épuré avec toutes les métadonnées techniques."""
        pop = ctk.CTkToplevel(self)
        pop.title("Détails de l'analyse")
        pop.geometry("400x360")
        pop.resizable(False, False)
        pop.attributes("-topmost", True)
        pop.grab_set()
        
        pop.update_idletasks()
        x = self.winfo_rootx() + (self.winfo_width() // 2) - 200
        y = self.winfo_rooty() + (self.winfo_height() // 2) - 180
        pop.geometry(f"+{x}+{y}")
        
        card = ctk.CTkFrame(pop, fg_color=("#F8FAFC", "#0F172A"), corner_radius=10)
        card.pack(fill="both", expand=True, padx=12, pady=12)
        
        lbl_t = ctk.CTkLabel(card, text="⚙️ Métadonnées & Exécution", font=ctk.CTkFont(size=14, weight="bold"))
        lbl_t.pack(pady=(10, 8))
        
        model_used = result_dict.get("model_used", self.config.get("chat_model", "gemini-3.7-flash"))
        budget = result_dict.get("thinking_budget")
        mode_str = "🌐 Bibliothèque RAG" if result_dict.get("raw_count", 0) > 0 else "📖 Écran seul"
        
        timings = result_dict.get("timings", {})
        total_s = timings.get("total_ms", 0) / 1000.0
        rerank_ms = timings.get("rerank_ms", 0)
        curation_ms = timings.get("curation_ms", 0)
        llm_s = timings.get("llm_ms", 0) / 1000.0
        retrieval_ms = timings.get("retrieval_ms", 0)
        
        curation_model = result_dict.get("curation_model")
        curation_label = f"{curation_model.split('/')[-1]} ({curation_ms:.0f} ms)" if curation_model else "Désactivée"
        
        details = [
            ("🤖 Modèle IA", f"{model_used}"),
            ("🧠 Mode Réflexion", f"Budget {budget} tokens" if budget else "Direct (sans réflexion)"),
            ("🌐 Mode de Recherche", f"{mode_str}"),
            ("🎯 Reranker Local", "BAAI/bge-reranker-v2-m3 (CPU)"),
            ("✨ Curation IA", curation_label),
            ("📚 Extraits Filtrés", f"{result_dict.get('raw_count', 0)} bruts ➔ {result_dict.get('final_count', 0)} retenus"),
            ("⏱️ Temps Total", f"{total_s:.2f} s"),
            ("  • Rerank CPU", f"{rerank_ms:.0f} ms"),
            ("  • Rédaction IA", f"{llm_s:.2f} s")
        ]
        
        for k, v in details:
            row = ctk.CTkFrame(card, fg_color="transparent")
            row.pack(fill="x", padx=16, pady=2)
            tk_lbl = ctk.CTkLabel(row, text=k, font=ctk.CTkFont(size=11, weight="bold"), text_color=("gray40", "gray70"))
            tk_lbl.pack(side="left")
            val_lbl = ctk.CTkLabel(row, text=v, font=ctk.CTkFont(size=11))
            val_lbl.pack(side="right")
            
        btn_close = ctk.CTkButton(card, text="Fermer", height=28, width=90, command=pop.destroy)
        btn_close.pack(pady=(12, 6))

    def apply_font(self, font_family, font_size):
        base_size = 15
        self.chat_history.configure(font=(font_family, base_size))
        tb = self.chat_history._textbox
        tb.tag_configure("bold", font=(font_family, base_size, "bold"))
        tb.tag_configure("italic", font=(font_family, base_size, "italic"))
        tb.tag_configure("bold_italic", font=(font_family, base_size, "bold", "italic"))
        tb.tag_configure("h1", font=(font_family, base_size + 4, "bold"), spacing1=12, spacing3=4)
        tb.tag_configure("h2", font=(font_family, base_size + 2, "bold"), spacing1=10, spacing3=3)
        tb.tag_configure("h3", font=(font_family, base_size + 1, "bold"), spacing1=8, spacing3=2)
        tb.tag_configure("bullet", lmargin1=16, lmargin2=26, spacing1=2)
        tb.tag_configure("normal", font=(font_family, base_size), spacing1=2, spacing2=2)
        tb.tag_configure("code", font=("Courier New", base_size - 2), background="#F0F0F0")
        tb.tag_configure("user_header", font=(font_family, base_size, "bold"), foreground="#3B82F6", spacing1=10)
        tb.tag_configure("ai_header", font=(font_family, base_size, "bold"), foreground="#10B981", spacing1=10)
        tb.tag_configure("ref_citation", font=(font_family, base_size, "bold"), foreground="#6366F1", underline=True)
        tb.tag_configure("tracker", font=(font_family, base_size - 1, "italic"), foreground="#888888", spacing1=2)
