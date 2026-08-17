import customtkinter as ctk
from tkinter import messagebox
import os
import threading
import io
from PIL import Image, ImageDraw, ImageFont
from typing import Optional, Dict, Any, Callable
from core.book_metadata_client import BookMetadataClient
from core.config import load_config
import requests

def generate_smart_cover(title: str, author: str = "", width: int = 65, height: int = 90) -> ctk.CTkImage:
    """Génère une couverture élégante et lisible pour les livres sans image officielle."""
    palettes = {
        "navy": ((15, 23, 42), (30, 58, 138), (147, 197, 253)),
        "burgundy": ((69, 10, 10), (127, 29, 29), (254, 202, 202)),
        "emerald": ((6, 78, 59), (4, 120, 87), (167, 243, 208)),
        "slate": ((30, 41, 59), (51, 65, 85), (203, 213, 225)),
        "amber": ((69, 26, 3), (120, 53, 15), (253, 230, 138))
    }
    
    theme_keys = list(palettes.keys())
    theme_idx = abs(hash(title)) % len(theme_keys)
    c_bg_dark, c_bg_mid, c_text = palettes[theme_keys[theme_idx]]
    
    scale = 2
    w_px, h_px = width * scale, height * scale
    img = Image.new("RGB", (w_px, h_px), c_bg_dark)
    draw = ImageDraw.Draw(img)
    
    # Dégradé vertical subtil
    for y in range(h_px):
        ratio = y / h_px
        r = int(c_bg_dark[0] * (1 - ratio) + c_bg_mid[0] * ratio)
        g = int(c_bg_dark[1] * (1 - ratio) + c_bg_mid[1] * ratio)
        b = int(c_bg_dark[2] * (1 - ratio) + c_bg_mid[2] * ratio)
        draw.line([(0, y), (w_px, y)], fill=(r, g, b))
        
    # Bordure dorée / élégante
    draw.rectangle([(3 * scale, 3 * scale), (w_px - 4 * scale, h_px - 4 * scale)], outline=(200, 170, 110), width=1 * scale)
    
    # Trame de reliure sur la gauche
    draw.line([(6 * scale, 0), (6 * scale, h_px)], fill=(0, 0, 0), width=2 * scale)
    draw.line([(8 * scale, 0), (8 * scale, h_px)], fill=(255, 255, 255), width=1 * scale)
    
    # Titre abrégé
    clean_title = title.strip()
    words = clean_title.split()
    lines = []
    curr = ""
    for word in words:
        if len(curr + " " + word) <= 11:
            curr = (curr + " " + word).strip()
        else:
            if curr: lines.append(curr)
            curr = word[:11]
        if len(lines) >= 3:
            break
    if curr and len(lines) < 3:
        lines.append(curr)
        
    y_text = 22 * scale
    for line in lines:
        draw.text((w_px // 2, y_text), line, fill=(255, 255, 255), anchor="mm")
        y_text += 13 * scale
        
    # Auteur en bas
    if author:
        short_author = (author[:10] + "..") if len(author) > 10 else author
        draw.text((w_px // 2, h_px - 14 * scale), short_author, fill=c_text, anchor="mm")
    else:
        draw.text((w_px // 2, h_px - 14 * scale), "BIBLE / LIVRE", fill=c_text, anchor="mm")
        
    pil_thumb = img.resize((width, height), Image.Resampling.LANCZOS)
    return ctk.CTkImage(pil_thumb, size=(width, height))

class BookMetadataPickerModal(ctk.CTkToplevel):
    """
    Fenêtre modale de recherche de métadonnées bibliographiques (Google Books / Open Library)
    avec vue en liste des résultats et panneau comparatif (Diff / Fusion) avant application.
    """
    def __init__(
        self,
        master,
        initial_query: str = "",
        initial_author: str = "",
        current_data: Optional[Dict[str, Any]] = None,
        on_apply_callback: Optional[Callable[[Dict[str, Any]], None]] = None
    ):
        super().__init__(master)
        self.title("🔍 Recherche & Enrichissement des Métadonnées")
        self.geometry("820x660")
        self.minsize(720, 560)
        
        self.current_data = current_data or {}
        self.on_apply_callback = on_apply_callback
        self.results = []
        self.selected_book = None
        self.thumbnail_cache = {}
        
        # Mettre au premier plan
        self.transient(master)
        self.grab_set()
        
        # Structure de l'interface
        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(1, weight=1)
        
        # 1. EN-TÊTE & BARRE DE RECHERCHE
        self._build_header(initial_query, initial_author)
        
        # 2. CONTENEUR PRINCIPAL
        self.main_container = ctk.CTkFrame(self, fg_color="transparent")
        self.main_container.grid(row=1, column=0, sticky="nsew", padx=16, pady=(0, 12))
        self.main_container.grid_columnconfigure(0, weight=1)
        self.main_container.grid_rowconfigure(0, weight=1)
        
        # Vue A: Liste des résultats
        self.results_scroll = ctk.CTkScrollableFrame(self.main_container)
        self.results_scroll.grid(row=0, column=0, sticky="nsew")
        self.results_scroll.grid_columnconfigure(0, weight=1)
        
        # Vue B: Comparatif (Diff)
        self.diff_frame = ctk.CTkScrollableFrame(self.main_container)
        
        # Lancer la recherche initiale si un terme est fourni
        query_text = (initial_query or initial_author).strip()
        if query_text:
            self.after(200, self.do_search)

    def _build_header(self, initial_query: str, initial_author: str):
        header_frame = ctk.CTkFrame(self, fg_color=("#F1F5F9", "#1E293B"), corner_radius=10)
        header_frame.grid(row=0, column=0, sticky="ew", padx=16, pady=(12, 8))
        header_frame.grid_columnconfigure(0, weight=1)
        
        # Ligne de recherche
        search_row = ctk.CTkFrame(header_frame, fg_color="transparent")
        search_row.pack(fill="x", padx=12, pady=10)
        search_row.grid_columnconfigure(0, weight=3)
        search_row.grid_columnconfigure(1, weight=2)
        
        # Champ Titre / Mots-clés
        self.search_title_entry = ctk.CTkEntry(
            search_row,
            placeholder_text="Titre de l'ouvrage ou mot-clé...",
            height=36
        )
        self.search_title_entry.grid(row=0, column=0, sticky="ew", padx=(0, 6))
        if initial_query:
            self.search_title_entry.insert(0, initial_query)
        self.search_title_entry.bind("<Return>", lambda e: self.do_search())
        
        # Champ Auteur
        self.search_author_entry = ctk.CTkEntry(
            search_row,
            placeholder_text="Auteur (facultatif)...",
            height=36
        )
        self.search_author_entry.grid(row=0, column=1, sticky="ew", padx=(0, 6))
        if initial_author:
            self.search_author_entry.insert(0, initial_author)
        self.search_author_entry.bind("<Return>", lambda e: self.do_search())
        
        # Bouton Rechercher
        self.btn_search = ctk.CTkButton(
            search_row,
            text="🔍 Rechercher",
            command=self.do_search,
            fg_color="#2563EB",
            hover_color="#1D4ED8",
            height=36,
            width=110,
            font=ctk.CTkFont(weight="bold")
        )
        self.btn_search.grid(row=0, column=2, sticky="ew")
        
        # Ligne Statut
        self.status_lbl = ctk.CTkLabel(
            header_frame,
            text="💡 Saisissez un titre ou un auteur pour rechercher sur Google Books & Open Library.",
            font=ctk.CTkFont(size=12),
            text_color=("#64748B", "#94A3B8")
        )
        self.status_lbl.pack(anchor="w", padx=12, pady=(0, 8))

    def do_search(self):
        title = self.search_title_entry.get().strip()
        author = self.search_author_entry.get().strip()
        
        if not title and not author:
            self.status_lbl.configure(text="⚠️ Veuillez saisir au moins un titre ou un nom d'auteur.", text_color="#EF4444")
            return
            
        self.btn_search.configure(state="disabled", text="⏳ Recherche...")
        self.status_lbl.configure(text="🔍 Recherche en cours sur Google Books & Open Library...", text_color=("#2563EB", "#38BDF8"))
        
        # Nettoyer l'affichage précédent
        for widget in self.results_scroll.winfo_children():
            widget.destroy()
            
        def _bg_search():
            config = load_config()
            api_key = config.get("google_books_api_key", "").strip() or None
            
            try:
                results = BookMetadataClient.search_books(
                    query=f"{title} {author}".strip(),
                    title=title,
                    author=author,
                    api_key=api_key,
                    limit=12
                )
            except Exception as e:
                results = []
                print("Erreur de recherche :", e)
                
            self.after(0, lambda: self._render_results(results))
            
        threading.Thread(target=_bg_search, daemon=True).start()

    def _render_results(self, results):
        self.btn_search.configure(state="normal", text="🔍 Rechercher")
        self.results = results
        
        # Basculer vers la vue résultats si on était sur le diff
        self.diff_frame.grid_forget()
        self.results_scroll.grid(row=0, column=0, sticky="nsew")
        
        if not results:
            self.status_lbl.configure(
                text="❌ Aucun ouvrage correspondant trouvé. Essayez avec un mot-clé plus simple.",
                text_color="#EF4444"
            )
            lbl_empty = ctk.CTkLabel(
                self.results_scroll,
                text="Aucun résultat trouvé.\n\nConseils :\n• Vérifiez l'orthographe\n• Utilisez uniquement les mots principaux du titre",
                font=ctk.CTkFont(size=13),
                text_color="gray"
            )
            lbl_empty.pack(pady=40)
            return

        self.status_lbl.configure(
            text=f"✅ {len(results)} ouvrage(s) trouvé(s). Cliquez sur 'Sélectionner' pour prévisualiser et fusionner.",
            text_color=("#059669", "#34D399")
        )
        
        for idx, book in enumerate(results):
            self._render_book_card(book, idx)

    def _render_book_card(self, book: Dict[str, Any], idx: int):
        card = ctk.CTkFrame(
            self.results_scroll,
            fg_color=("#FFFFFF", "#1E293B"),
            border_color=("#E2E8F0", "#334155"),
            border_width=1,
            corner_radius=8
        )
        card.pack(fill="x", pady=6, padx=4)
        card.grid_columnconfigure(1, weight=1)
        
        # Miniature par défaut intelligente (titre, auteur, reliure)
        smart_thumb = generate_smart_cover(
            title=book.get("title", "Livre"),
            author=book.get("author_str", ""),
            width=65,
            height=90
        )
        
        thumb_lbl = ctk.CTkLabel(
            card,
            text="",
            image=smart_thumb,
            width=65,
            height=90,
            fg_color="transparent",
            corner_radius=4
        )
        thumb_lbl.grid(row=0, column=0, rowspan=2, padx=10, pady=8, sticky="n")
        
        # Si une URL de couverture officielle existe, la charger en arrière-plan
        cover_url = book.get("cover_url")
        if cover_url:
            self._load_async_thumbnail(cover_url, thumb_lbl, width=65, height=90)
            
        # Infos principales
        info_frame = ctk.CTkFrame(card, fg_color="transparent")
        info_frame.grid(row=0, column=1, sticky="nsew", padx=(0, 10), pady=(8, 4))
        
        title_lbl = ctk.CTkLabel(
            info_frame,
            text=book.get("title", "Sans titre"),
            font=ctk.CTkFont(size=14, weight="bold"),
            anchor="w",
            wraplength=480,
            justify="left"
        )
        title_lbl.pack(fill="x", anchor="w")
        
        # Auteur & Éditeur & Année
        details = []
        if book.get("author_str"):
            details.append(f"✍️ {book['author_str']}")
        if book.get("year"):
            details.append(f"📅 {book['year']}")
        if book.get("publisher"):
            details.append(f"🏢 {book['publisher']}")
            
        meta_str = "  •  ".join(details)
        if meta_str:
            meta_lbl = ctk.CTkLabel(
                info_frame,
                text=meta_str,
                font=ctk.CTkFont(size=11),
                text_color=("#2563EB", "#38BDF8"),
                anchor="w"
            )
            meta_lbl.pack(fill="x", anchor="w", pady=(2, 0))
            
        # Description courte
        desc = book.get("description", "")
        if desc:
            short_desc = (desc[:130] + "...") if len(desc) > 130 else desc
            desc_lbl = ctk.CTkLabel(
                info_frame,
                text=short_desc,
                font=ctk.CTkFont(size=11),
                text_color=("#64748B", "#94A3B8"),
                anchor="w",
                wraplength=480,
                justify="left"
            )
            desc_lbl.pack(fill="x", anchor="w", pady=(2, 0))
            
        # Source badge & Bouton Sélectionner
        action_frame = ctk.CTkFrame(card, fg_color="transparent")
        action_frame.grid(row=0, column=2, rowspan=2, padx=10, pady=8, sticky="e")
        
        source_badge = ctk.CTkLabel(
            action_frame,
            text=book.get("source", "Livre"),
            font=ctk.CTkFont(size=10, weight="bold"),
            text_color="gray60"
        )
        source_badge.pack(anchor="e", pady=(0, 4))
        
        btn_select = ctk.CTkButton(
            action_frame,
            text="✨ Choisir",
            command=lambda b=book: self._open_diff_view(b),
            fg_color="#10B981",
            hover_color="#059669",
            height=32,
            width=90,
            font=ctk.CTkFont(size=12, weight="bold")
        )
        btn_select.pack(anchor="e")

    def _load_async_thumbnail(self, url: str, label_widget: ctk.CTkLabel, width: int = 65, height: int = 90):
        """Charge une miniature de couverture en arrière-plan sans bloquer l'UI."""
        cache_key = f"{url}_{width}x{height}"
        if cache_key in self.thumbnail_cache:
            label_widget.configure(image=self.thumbnail_cache[cache_key], text="")
            return

        def _fetch():
            try:
                headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
                resp = requests.get(url, headers=headers, timeout=6)
                # Vérifier que ce n'est pas un pixel transparent ou une réponse vide
                if resp.status_code == 200 and len(resp.content) > 600:
                    raw_img = Image.open(io.BytesIO(resp.content))
                    if raw_img.width > 20 and raw_img.height > 20:
                        raw_img = raw_img.convert("RGB")
                        ctk_img = ctk.CTkImage(raw_img, size=(width, height))
                        self.thumbnail_cache[cache_key] = ctk_img
                        self.after(0, lambda: label_widget.configure(image=ctk_img, text=""))
            except Exception:
                pass

        threading.Thread(target=_fetch, daemon=True).start()

    # ==========================================
    # VUE COMPARATIF (DIFF / FUSION INTELLIGENTE)
    # ==========================================
    def _open_diff_view(self, book: Dict[str, Any]):
        self.selected_book = book
        self.results_scroll.grid_forget()
        self.diff_frame.grid(row=0, column=0, sticky="nsew")
        
        for widget in self.diff_frame.winfo_children():
            widget.destroy()
            
        self.status_lbl.configure(
            text="📋 Vérifiez et cochez les métadonnées que vous souhaitez intégrer à votre ouvrage.",
            text_color=("#2563EB", "#38BDF8")
        )
        
        # En-tête retour
        top_bar = ctk.CTkFrame(self.diff_frame, fg_color="transparent")
        top_bar.pack(fill="x", padx=10, pady=(4, 10))
        
        btn_back = ctk.CTkButton(
            top_bar,
            text="⬅️ Revenir aux résultats",
            command=lambda: [self.diff_frame.grid_forget(), self.results_scroll.grid(row=0, column=0, sticky="nsew")],
            fg_color=("#64748B", "#475569"),
            hover_color=("#475569", "#334155"),
            height=30,
            width=160
        )
        btn_back.pack(side="left")
        
        # Conteneur en 2 colonnes : Couverture à gauche, Champs à droite
        body_row = ctk.CTkFrame(self.diff_frame, fg_color="transparent")
        body_row.pack(fill="both", expand=True, padx=10, pady=5)
        body_row.grid_columnconfigure(0, weight=1)
        body_row.grid_columnconfigure(1, weight=3)
        
        # --- COLONNE GAUCHE : COUVERTURE ---
        cover_card = ctk.CTkFrame(body_row, fg_color=("#F8FAFC", "#1E293B"), corner_radius=8)
        cover_card.grid(row=0, column=0, sticky="nsew", padx=(0, 10), pady=0)
        
        lbl_cov_title = ctk.CTkLabel(cover_card, text="🖼️ Couverture", font=ctk.CTkFont(size=13, weight="bold"))
        lbl_cov_title.pack(pady=(10, 6))
        
        large_smart_cover = generate_smart_cover(
            title=book.get("title", "Livre"),
            author=book.get("author_str", ""),
            width=140,
            height=190
        )
        
        self.diff_cover_lbl = ctk.CTkLabel(
            cover_card,
            text="",
            image=large_smart_cover,
            width=140,
            height=190,
            fg_color="transparent",
            corner_radius=6
        )
        self.diff_cover_lbl.pack(pady=4, padx=12)
        
        cover_url = book.get("cover_url")
        self.apply_cover_var = ctk.BooleanVar(value=bool(cover_url))
        
        if cover_url:
            self._load_large_cover_preview(cover_url, self.diff_cover_lbl, book.get("title", ""), book.get("author_str", ""))
            cb_cover = ctk.CTkCheckBox(
                cover_card,
                text="Utiliser cette image",
                variable=self.apply_cover_var,
                font=ctk.CTkFont(size=12)
            )
            cb_cover.pack(pady=(8, 12))
        else:
            lbl_no_cov = ctk.CTkLabel(cover_card, text="Couverture générée", font=ctk.CTkFont(size=11), text_color=("#2563EB", "#38BDF8"))
            lbl_no_cov.pack(pady=(8, 12))
            lbl_no_cov.pack(pady=(4, 12))

        # --- COLONNE DROITE : CHAMPS DE TEXTE & DIFF ---
        fields_card = ctk.CTkFrame(body_row, fg_color=("#F8FAFC", "#1E293B"), corner_radius=8)
        fields_card.grid(row=0, column=1, sticky="nsew", padx=(10, 0), pady=0)
        fields_card.grid_columnconfigure(1, weight=1)
        
        # Définition des champs à comparer
        fields_to_compare = [
            ("name", "Identifiant / Nom court", book.get("short_title", "")),
            ("title", "Titre complet", book.get("title", "")),
            ("author", "Auteur(s) / Éditeur", book.get("author_str", "")),
            ("year", "Année d'édition", book.get("year", "")),
            ("description", "Description / Résumé", book.get("description", "")),
        ]
        
        self.field_vars = {}
        row_idx = 0
        
        for key, label_text, new_val in fields_to_compare:
            current_val = str(self.current_data.get(key, "") or "").strip()
            new_val_str = str(new_val or "").strip()
            
            # Déterminer si on coche par défaut :
            # - Si champ actuel vide et nouvelle valeur disponible -> OUI
            # - Si champ actuel identique -> OUI
            # - Si champ actuel différent mais nouvelle valeur riche -> OUI
            default_checked = bool(new_val_str)
            
            var = ctk.BooleanVar(value=default_checked)
            self.field_vars[key] = (var, new_val_str)
            
            field_box = ctk.CTkFrame(fields_card, fg_color=("#FFFFFF", "#0F172A"), corner_radius=6)
            field_box.pack(fill="x", padx=12, pady=6)
            
            # Ligne En-tête du champ avec checkbox
            hdr_line = ctk.CTkFrame(field_box, fg_color="transparent")
            hdr_line.pack(fill="x", padx=8, pady=(6, 2))
            
            cb = ctk.CTkCheckBox(
                hdr_line,
                text=label_text,
                variable=var,
                font=ctk.CTkFont(size=12, weight="bold"),
                checkbox_width=20,
                checkbox_height=20
            )
            cb.pack(side="left")
            
            # Badge de statut (Nouveau / Remplacement)
            if not current_val and new_val_str:
                badge = ctk.CTkLabel(hdr_line, text="✨ NOUVEAU", font=ctk.CTkFont(size=9, weight="bold"), text_color="#10B981")
                badge.pack(side="right")
            elif current_val and new_val_str and current_val != new_val_str:
                badge = ctk.CTkLabel(hdr_line, text="🔄 MODIFICATION", font=ctk.CTkFont(size=9, weight="bold"), text_color="#F59E0B")
                badge.pack(side="right")
                
            # Affichage comparatif (Actuel vs Nouveau)
            vals_frame = ctk.CTkFrame(field_box, fg_color="transparent")
            vals_frame.pack(fill="x", padx=8, pady=(2, 6))
            
            if current_val and current_val != new_val_str:
                curr_lbl = ctk.CTkLabel(
                    vals_frame,
                    text=f"Actuel : {current_val[:140] + ('...' if len(current_val) > 140 else '')}",
                    font=ctk.CTkFont(size=11),
                    text_color="#94A3B8",
                    anchor="w",
                    justify="left",
                    wraplength=420
                )
                curr_lbl.pack(fill="x", anchor="w")
                
            val_display = new_val_str if new_val_str else "(Vide / Non renseigné)"
            new_lbl = ctk.CTkLabel(
                vals_frame,
                text=f"Trouvé : {val_display[:180] + ('...' if len(val_display) > 180 else '')}",
                font=ctk.CTkFont(size=11, weight="bold" if new_val_str else "normal"),
                text_color=("#2563EB", "#38BDF8") if new_val_str else "gray",
                anchor="w",
                justify="left",
                wraplength=420
            )
            new_lbl.pack(fill="x", anchor="w", pady=(2, 0))

        # --- BARRE D'ACTIONS INFÉRIEURE ---
        action_bar = ctk.CTkFrame(self.diff_frame, fg_color="transparent")
        action_bar.pack(fill="x", padx=10, pady=(15, 10))
        
        btn_apply = ctk.CTkButton(
            action_bar,
            text="✅ Appliquer les métadonnées sélectionnées",
            command=self._apply_and_close,
            fg_color="#10B981",
            hover_color="#059669",
            height=40,
            font=ctk.CTkFont(size=13, weight="bold")
        )
        btn_apply.pack(fill="x")

    def _load_large_cover_preview(self, url: str, label_widget: ctk.CTkLabel, title: str = "", author: str = ""):
        def _fetch():
            try:
                headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
                resp = requests.get(url, headers=headers, timeout=6)
                if resp.status_code == 200 and len(resp.content) > 600:
                    raw_img = Image.open(io.BytesIO(resp.content))
                    if raw_img.width > 20 and raw_img.height > 20:
                        raw_img = raw_img.convert("RGB")
                        ctk_img = ctk.CTkImage(raw_img, size=(140, 190))
                        self.after(0, lambda: label_widget.configure(image=ctk_img, text=""))
            except Exception:
                pass
        threading.Thread(target=_fetch, daemon=True).start()

    def _apply_and_close(self):
        if not self.selected_book:
            return
            
        applied_data = {}
        for key, (var, val) in self.field_vars.items():
            if var.get() and val:
                applied_data[key] = val
                
        # Télécharger ou sauvegarder la couverture si demandée
        if self.apply_cover_var.get():
            title_hint = applied_data.get("name") or applied_data.get("title") or "cover"
            cover_path = None
            if self.selected_book.get("cover_url"):
                cover_path = BookMetadataClient.download_cover_image(
                    self.selected_book["cover_url"],
                    title_hint=title_hint
                )
            if not cover_path:
                from core.book_metadata_client import COVERS_DIR
                os.makedirs(COVERS_DIR, exist_ok=True)
                safe_name = BookMetadataClient._sanitize_filename(title_hint)
                dest_path = os.path.join(COVERS_DIR, f"{safe_name}.jpg")
                try:
                    smart_img = generate_smart_cover(title_hint, applied_data.get("author", ""), width=300, height=420)
                    if hasattr(smart_img, '_light_image') and smart_img._light_image:
                        smart_img._light_image.save(dest_path, "JPEG", quality=92)
                        applied_data["cover_path"] = dest_path
                except Exception as e:
                    print(f"Erreur sauvegarde couverture générée : {e}")
            else:
                applied_data["cover_path"] = cover_path
                
        if self.on_apply_callback:
            self.on_apply_callback(applied_data)
            
        self.destroy()
