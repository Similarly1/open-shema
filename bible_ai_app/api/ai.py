"""
AiMixin - Extracted from BibleAppApi.
"""
import os
import sys
import logging
import json
import sqlite3
import traceback
import asyncio
import webview
import threading
import time
import shutil
from typing import Dict, List, Any, Optional

logger = logging.getLogger(__name__)
from api._utils import (
    current_dir, BibleJsonLoader, extract_verse_text,
    get_french_book_name, resolve_book_input, parse_smart_book_input,
    BOOKS_OT, BOOKS_NT, BOOKS_DEUTERO, ALL_BOOKS, BOOK_MAPPING, strip_accents,
    PericopeManager, CommentaryLoader, DictionaryManager, OriginalLanguagesManager,
    NotesManager, load_config, save_config,
    DEFAULT_NOTE_TITLE_SYSTEM_PROMPT, DEFAULT_NOTE_TAGS_SYSTEM_PROMPT,
    SermonsManager, HighlightsManager, MapsManager,
    load_books_metadata, save_books_metadata, AISessionManager,
    migrate_secrets_from_config, load_secrets_into_config, send_windows_toast,
    BIBLES_REGISTRY_FILE, BIBLE_CANONICAL_INFO,
    strip_xml_tags, load_bibles_registry, find_bible_registry_entry,
    get_cover_data_url, parse_reverse_interlinear_verse,
    _BACKUP_MANIFEST_VERSION, _BACKUP_COMPONENTS
)
current_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))



class AiMixin:
    def ask_ai(self, question: str, book: str, chapter: int, verse: int) -> Dict[str, Any]:
        """Interroge l'assistant IA en injectant le contexte biblique, les commentaires et les notes personnelles."""
        self.config = load_config()
        french = get_french_book_name(book)
        ref = f"{french} {chapter}:{verse}"
        comms = self.get_commentaries(book, chapter, verse)
        comm_context = "\n".join([f"- [{c['author']}] {c['text'][:200]}..." for c in comms[:2]])
        
        # Contexte des notes personnelles
        notes_context = NotesManager.build_ai_notes_context(passage_ref=ref, question=question, config=self.config)
        
        prompt = (
            f"Passage d'étude : **{ref}**\n\n"
            f"Question de l'utilisateur : {question}\n\n"
            f"Contexte des commentaires disponibles :\n{comm_context or 'Aucun commentaire textuel direct.'}\n"
            f"{notes_context}"
            f"\nAnalyse exégétique synthétique :"
        )

        try:
            from ai.llm_client import LLMClient
            api_key = self.config.get("gemini_api_key", "")
            if api_key:
                client = LLMClient(api_key=api_key, model=self.config.get("chat_model", "gemini-3.7-flash"), provider="gemini")
                answer = client.ask_question(context=f"{comm_context}\n{notes_context}", question=question)
                return {"answer": answer}
            else:
                return {
                    "answer": f"**[Analyse pour {ref}]**\n\nCe passage souligne la structure théologique du texte. Vous pouvez consulter les commentaires de la barre latérale pour des détails verset par verset (Configurez votre clé API dans les Paramètres pour activer les réponses IA dynamiques)."
                }
        except Exception as e:
            return {
                "answer": f"**[Analyse pour {ref}]**\n\nCe passage souligne la structure théologique du texte. Vous pouvez consulter les commentaires de la barre latérale pour des détails verset par verset."
            }

    def reorganize_sermon_sections_ai(self, current_sections: List[Dict[str, Any]], new_structure: List[Dict[str, Any]], sermon_metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Réorganise sémantiquement les paragraphes et contenus rédigés par l'utilisateur
        dans une nouvelle structure homilétique cible via le LLM configuré, avec gestion automatique de secours (fallback).
        """
        self.config = load_config()
        from core.config import DEFAULT_SERMON_RESTRUCTURE_SYSTEM_PROMPT
        
        sys_prompt = self.config.get("sermon_restructure_system_prompt") or DEFAULT_SERMON_RESTRUCTURE_SYSTEM_PROMPT
        primary_model = self.config.get("sermon_restructure_model") or self.config.get("chat_model") or "gemini-3.7-flash"
        fallback_model = self.config.get("sermon_restructure_fallback_model") or self.config.get("chat_fallback_model") or "gemini-3.5-flash-lite"

        models_to_try = [primary_model]
        if fallback_model and fallback_model != primary_model:
            models_to_try.append(fallback_model)

        meta_str = ""
        if sermon_metadata:
            meta_str = f"Titre du sermon : {sermon_metadata.get('title', 'Sans titre')}\nPassage : {sermon_metadata.get('passage', '')}\nProposition centrale : {sermon_metadata.get('big_idea', '')}\n\n"

        curr_text = "--- CONTENU ACTUELLEMENT RÉDIGÉ PAR LE PRÉDICATEUR ---\n"
        for idx, sec in enumerate(current_sections):
            text_content = sec.get("contentHtml", "").strip()
            curr_text += f"\n[Section {idx + 1} : {sec.get('title', 'Sans titre')} ({sec.get('type', 'point')})]\n{text_content}\n"

        target_text = "\n--- NOUVELLE STRUCTURE CIBLE SOUHAITÉE ---\n"
        for idx, sec in enumerate(new_structure):
            target_text += f"\n- Section {idx + 1} | Type: {sec.get('type', 'point')} | Titre cible: {sec.get('title', 'Sans titre')}"

        user_prompt = (
            f"{meta_str}"
            f"{curr_text}\n"
            f"{target_text}\n\n"
            f"Consigne : Réorganise tout le contenu rédigé ci-dessus dans les sections de la NOUVELLE structure cible. "
            f"Ne perds aucune idée, verset ou illustration. Renvoie UNIQUEMENT un JSON valide au format :\n"
            f"{{\n  \"sections\": [\n    {{\"type\": \"intro\", \"title\": \"...\", \"contentHtml\": \"<p>...</p>\"}}\n  ]\n}}"
        )

        from ai.llm_client import LLMClient
        import json
        import re
        import datetime

        last_err = None
        result_sections = None
        used_model = None

        for cur_model in models_to_try:
            lower_m = cur_model.lower()
            if "/" in lower_m or "infomaniak" in lower_m or lower_m.startswith("qwen") or "swiss-ai" in lower_m or "gemma" in lower_m:
                token = self.config.get("infomaniak_token", "")
                pid = self.config.get("infomaniak_product_id", "251")
                client = LLMClient(api_key=token, model=cur_model, provider="infomaniak", product_id=pid)
            elif lower_m.startswith("mistral-") or lower_m.startswith("open-mistral-") or "codestral" in lower_m:
                api_key = self.config.get("mistral_api_key", "")
                client = LLMClient(api_key=api_key, model=cur_model, provider="mistral")
            else:
                api_key = self.config.get("gemini_api_key", "")
                client = LLMClient(api_key=api_key, model=cur_model, provider="gemini")

            try:
                out = client.chat(messages=[{"role": "user", "content": user_prompt}], system_prompt=sys_prompt)
                if out and not str(out).startswith("Erreur"):
                    text = str(out).strip()
                    if text.startswith("```"):
                        text = re.sub(r'^```(?:json)?\s*', '', text, flags=re.IGNORECASE)
                        text = re.sub(r'\s*```$', '', text)
                    parsed = json.loads(text)
                    if isinstance(parsed, dict) and "sections" in parsed and isinstance(parsed["sections"], list):
                        result_sections = parsed["sections"]
                        used_model = cur_model
                        break
                    elif isinstance(parsed, list):
                        result_sections = parsed
                        used_model = cur_model
                        break
                else:
                    last_err = out
            except Exception as e:
                last_err = str(e)
                logger.warning("Échec restructuration IA avec %s: %s", cur_model, e)

        if not result_sections:
            return {"success": False, "error": last_err or "Impossible de réorganiser avec l'IA. Vérifiez votre clé API dans les Paramètres."}

        normalized = []
        base_ts = int(datetime.datetime.now().timestamp() * 1000)
        for idx, sec in enumerate(result_sections):
            target_template = new_structure[idx] if idx < len(new_structure) else {}
            sec_type = sec.get("type") or target_template.get("type", "point")
            sec_title = sec.get("title") or target_template.get("title", f"Partie {idx + 1}")
            sec_content = sec.get("contentHtml") or sec.get("content", "")
            if not sec_content.startswith("<"):
                sec_content = f"<p>{sec_content}</p>"
            normalized.append({
                "id": f"sec_{base_ts}_{idx + 1}",
                "type": sec_type,
                "title": sec_title,
                "contentHtml": sec_content,
                "isCollapsed": False,
                "wordCount": 0,
                "estMinutes": 0
            })

        return {"success": True, "sections": normalized, "used_model": used_model}

    def ask_study_ai(self, messages_history: list, mode: str = "exegesis", passage_ref: str = "", options: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Génère une étude théologique ou exégétique complète avec extraction multi-sources (Bibles, Commentaires, Dicos, Notes),
        options de modèle LLM, et pipeline RAG (Reranking Cross-Encoder CPU / LLM Curateur).
        """
        self.config = load_config()
        opts = options or {}
        
        selected_model = opts.get("model") or self.config.get("chat_model", "gemini-3.7-flash")
        depth_style = opts.get("depth", "academic")
        enable_rerank = opts.get("enable_reranking", True)
        enable_curator = opts.get("enable_curator", False)
        # Nombre de caractères max par extrait de source (défaut = 2400 ~600 tokens)
        max_excerpt_chars = int(opts.get("max_excerpt_chars", 2400))
        sources_cfg = opts.get("sources", {
            "bibles": True,
            "commentaries": True,
            "dictionaries": True,
            "articles": True,
            "notes": True
        })
        
        sources_used = []
        context_chunks = []
        
        # 0. Extraction / Détection automatique de passage biblique dans la question si non fourni
        current_question = ""
        if isinstance(messages_history, list) and len(messages_history) > 0:
            current_question = messages_history[-1].get("content", "")
        elif isinstance(messages_history, str):
            current_question = messages_history
            messages_history = [{"role": "user", "content": current_question}]
            
        question = current_question
        q_lower = current_question.lower()

        extracted_ref_str = ""
        if not passage_ref or not passage_ref.strip():
            # 1. Tester avec chiffre préfixé : '1 Co 13:13', '2 Tim 2:2'
            pattern_num = r'\b([1-4]\s*[a-zA-ZÀ-ÿ]+)\s*(\d+)(?:[\s.:,](\d+)(?:\s*[-–—]\s*(\d+))?)?\b'
            for match in re.finditer(pattern_num, question):
                raw_book = match.group(1).strip()
                book_key = strip_accents(re.sub(r'\s+', ' ', raw_book)).lower()
                b_code = BOOK_MAPPING.get(book_key)
                if not b_code:
                    m_num = re.match(r'^([1-4])\s*([a-z]+)$', book_key)
                    if m_num:
                        b_code = BOOK_MAPPING.get(f"{m_num.group(1)} {m_num.group(2)}")
                if b_code:
                    ch = int(match.group(2))
                    v_start = int(match.group(3)) if match.group(3) else None
                    v_end = int(match.group(4)) if match.group(4) else None
                    fr = get_french_book_name(b_code)
                    passage_ref = f"{fr} {ch}" + (f":{v_start}-{v_end}" if (v_start and v_end) else (f":{v_start}" if v_start else ""))
                    extracted_ref_str = match.group(0)
                    break

            if not passage_ref:
                # 2. Tester sans chiffre préfixé : 'rm 5.1-4', 'Jean 3:16', 'Romains 5:1-4'
                pattern_simple = r'\b([a-zA-ZÀ-ÿ]{2,})\s*(\d+)(?:[\s.:,](\d+)(?:\s*[-–—]\s*(\d+))?)?\b'
                for match in re.finditer(pattern_simple, question):
                    raw_book = match.group(1).strip()
                    book_key = strip_accents(re.sub(r'\s+', ' ', raw_book)).lower()
                    b_code = BOOK_MAPPING.get(book_key)
                    if b_code:
                        ch = int(match.group(2))
                        v_start = int(match.group(3)) if match.group(3) else None
                        v_end = int(match.group(4)) if match.group(4) else None
                        fr = get_french_book_name(b_code)
                        passage_ref = f"{fr} {ch}" + (f":{v_start}-{v_end}" if (v_start and v_end) else (f":{v_start}" if v_start else ""))
                        extracted_ref_str = match.group(0)
                        break

        # 1. Résolution du mode (support de 'auto' par défaut avec analyse d'intention affinée)
        mode = mode or "auto"
        detected_mode = "Auto"

        sermon_keywords = [
            "prédic", "predic", "prédication", "predication", "prêch", "prech", "sermon",
            "homilét", "homilet", "plan de", "culte", "message pour", "discours", "application pastorale"
        ]
        lexical_keywords = [
            "grec", "hébreu", "hebreu", "strong", "racine", "étymolog", "etymolog", "morpholog", "septante", "lxx", "sens du mot"
        ]
        historical_keywords = [
            "contexte", "histoire", "historique", "auteur", "destinataire", "époque", "epoque", "politique", "archéolog", "second temple", "coutume"
        ]
        theology_keywords = [
            "doctrine", "théolog", "theolog", "calvin", "luther", "augustin", "grâce", "grace", "élection", "election",
            "prédestin", "predestin", "trinité", "trinite", "salut", "eschatolog"
        ]

        if mode == "auto":
            if any(k in q_lower for k in sermon_keywords):
                detected_mode = "Préparation de prédication"
                active_mode_key = "sermon"
            elif any(k in q_lower for k in lexical_keywords):
                detected_mode = "Analyse lexicale (Grec / Hébreu)"
                active_mode_key = "lexical"
            elif any(k in q_lower for k in historical_keywords):
                detected_mode = "Contexte historique & culturel"
                active_mode_key = "historical"
            elif any(k in q_lower for k in theology_keywords) and not passage_ref:
                detected_mode = "Synthèse Théologique & Doctrinale"
                active_mode_key = "theology"
            elif passage_ref:
                detected_mode = "Exégèse & Analyse Biblique"
                active_mode_key = "exegesis"
            else:
                detected_mode = "Synthèse d'étude"
                active_mode_key = "auto"
        else:
            mode_names = {
                "exegesis": "Exégèse approfondie",
                "theology": "Synthèse théologique & doctrinale",
                "historical": "Contexte historique & culturel",
                "sermon": "Préparation de prédication",
                "lexical": "Analyse lexicale (Grec & Hébreu)",
                "free_chat": "Discussion libre & Réflexion"
            }
            detected_mode = mode_names.get(mode, "Synthèse d'étude")
            active_mode_key = mode

        # 1. Résolution et extraction du texte biblique (si un passage est spécifié ou détecté)
        if sources_cfg.get("bibles", True) and passage_ref and passage_ref.strip():
            try:
                parsed = self.parse_reference(passage_ref)
                if parsed and parsed.get("book"):
                    b_code = parsed["book"]
                    ch_num = parsed.get("chapter") or 1
                    ch_data = self.get_chapter_data("LSG", b_code, ch_num)
                    if ch_data and ch_data.get("verses"):
                        v_target = parsed.get("verse")
                        v_end = parsed.get("verse_end") or v_target
                        verses_subset = ch_data["verses"]
                        if v_target:
                            verses_subset = [v for v in ch_data["verses"] if v["verse"] >= v_target and (not v_end or v["verse"] <= v_end)]
                            if not verses_subset:
                                verses_subset = ch_data["verses"][:5]
                        
                        v_lines = []
                        for v in verses_subset[:16]:
                            v_lines.append(f"v.{v['verse']} : {v.get('text', '')}")
                        
                        bible_text = "\n".join(v_lines)
                        context_chunks.append({
                            "id": f"bible_{passage_ref}",
                            "text": f"### Texte Biblique ({ch_data.get('book_french', b_code)} {ch_num}) :\n{bible_text}",
                            "metadata": {"type": "Bible", "name": f"Bibles (LSG — {ch_data.get('book_french', b_code)} {ch_num})", "ref": passage_ref}
                        })
                        sources_used.append(f"Bibles ({ch_data.get('book_french', b_code)} {ch_num})")
            except Exception as e:
                logger.error(f"[ask_study_ai] Erreur extraction biblique : {e}")

        # 2. Extraction des mots-clés de la question (en ignorant la référence biblique et les stop words)
        clean_question = question
        if extracted_ref_str:
            clean_question = clean_question.replace(extracted_ref_str, ' ')

        stop_words_fr = {
            "quel", "quelle", "quels", "quelles", "etait", "étaient", "était", "etaient", "etre", "être",
            "dans", "avec", "pour", "selon", "entre", "cette", "cet", "ces", "leurs", "leur", "notre", "nos",
            "votre", "vos", "mon", "ton", "son", "sa", "ses", "comme", "tout", "tous", "toute", "toutes",
            "comment", "pourquoi", "vision", "texte", "temps", "epoque", "époque", "cadre", "plus", "aussi",
            "faire", "fais", "fait", "avoir", "sujet", "point", "points", "dessus", "dessous", "alors", "ainsi", "sans",
            "salut", "bonjour", "bonsoir", "coucou", "hello", "merci", "bienvenue", "hey", "dis", "penses", "pense",
            "prédic", "prédication", "predic", "predication", "sermon", "etude", "étude", "bible", "verset", "versets",
            "chapitre", "chapitres", "livre", "livres", "sur", "sous", "par", "une", "des", "les", "aux", "est", "sont",
            "aide", "peux", "veut", "veux", "donne", "fais-moi", "parle", "explique"
        }

        # Termes entre parenthèses et guillemets en priorité haute
        parentheses_matches = re.findall(r'\((.*?)\)', clean_question) + re.findall(r'«(.*?)»', clean_question) + re.findall(r'"(.*?)"', clean_question)
        priority_terms = []
        for pm in parentheses_matches:
            for sub in re.split(r'[,;/\s]+', pm):
                sub_clean = sub.strip()
                if len(sub_clean) > 2 and sub_clean.lower() not in stop_words_fr:
                    priority_terms.append(sub_clean)

        # Mots principaux (> 3 lettres)
        general_words = [w for w in re.findall(r'[a-zA-ZÀ-ÿ]{3,}', clean_question) if w.lower() not in stop_words_fr]
        all_extracted_keywords = list(dict.fromkeys(priority_terms + general_words))

        # En mode Discussion Libre sans passage spécifique et pour les salutations/phrases courtes : bypass RAG lourd
        is_light_free_chat = (active_mode_key == "free_chat" and not passage_ref and len(all_extracted_keywords) <= 1)

        # 3. Extraction des Dictionnaires Bibliques & Lexique Strong
        if sources_cfg.get("dictionaries", True) and not is_light_free_chat and all_extracted_keywords:
            try:
                from core.dictionary_manager import DictionaryManager
                
                dict_seen = set()
                for term in all_extracted_keywords[:8]:
                    res = DictionaryManager.lookup(term)
                    if (not res or not res.get("matches")) and term.endswith("s") and len(term) > 4:
                        res = DictionaryManager.lookup(term[:-1])
                    
                    if res and res.get("matches"):
                        for m in res["matches"][:2]:
                            dict_name = m.get("dict_name", "Dictionnaire Biblique")
                            art_title = m.get("title", term)
                            dict_key = f"{dict_name}:{art_title}".lower()
                            if dict_key not in dict_seen:
                                dict_seen.add(dict_key)
                                raw_preview = m.get("preview") or m.get("full_text") or ""
                                context_chunks.append({
                                    "id": f"dict_{term}_{dict_name}",
                                    "text": f"### Entrée de Dictionnaire [{dict_name} : {art_title}] :\n{raw_preview[:1200]}",
                                    "metadata": {"type": "Dictionnaire", "name": f"{dict_name} ({art_title})"}
                                })
            except Exception as e:
                logger.error(f"[ask_study_ai] Erreur extraction dictionnaires : {e}")

        # 4. Extraction des Commentaires Bibliques & Ouvrages de Théologie
        if sources_cfg.get("commentaries", True) and not is_light_free_chat:
            try:
                if passage_ref and passage_ref.strip():
                    parsed = self.parse_reference(passage_ref)
                    if parsed and parsed.get("book"):
                        b_code = parsed["book"]
                        ch_num = parsed.get("chapter") or 1
                        v_num = parsed.get("verse") or 1
                        v_end = parsed.get("verse_end") or v_num
                        
                        from core.commentary_loader import CommentaryLoader
                        comm_res = CommentaryLoader.get_all_comments_for_verse_range(b_code, ch_num, v_num, v_end)
                        docs = comm_res.get("documents", [])
                        metas = comm_res.get("metadatas", [])
                        
                        if docs:
                            for i, doc in enumerate(docs[:6]):
                                meta = metas[i] if i < len(metas) else {}
                                author = meta.get("name") or meta.get("author") or "Commentaire"
                                ref_lbl = meta.get("reference", passage_ref)
                                context_chunks.append({
                                    "id": f"comm_{author}_{i}",
                                    "text": f"### Extrait de [{author}] ({ref_lbl}) :\n{doc[:1000]}",
                                    "metadata": {"type": "Commentaire", "name": author}
                                })
                        else:
                            comms = self.get_commentaries(b_code, ch_num, v_num)
                            if comms:
                                for c in comms[:4]:
                                    author = c.get("author") or c.get("source") or "Commentaire"
                                    context_chunks.append({
                                        "id": f"comm_{author}",
                                        "text": f"### Commentaire [{author}] sur {passage_ref} :\n{c.get('text', '')[:1000]}",
                                        "metadata": {"type": "Commentaire", "name": author}
                                    })
                else:
                    # Recherche thématique dans les ouvrages de théologie
                    from core.theology_reader_manager import TheologyReaderManager
                    theo_seen = set()
                    clean_name_map = {
                        "lirelabibles": "Lire et comprendre la Bible",
                        "lire/comprendre": "Lire et comprendre la Bible",
                        "lire_comprendre": "Lire et comprendre la Bible",
                        "stgru": "Théologie systématique",
                        "niv cultural": "NIV Cultural Backgrounds Study Bible",
                        "nivarchaeo": "NIV Archaeological Study Bible",
                        "macarthur bc": "Commentaire Biblique MacArthur",
                        "paradoxes": "Les Paradoxes de la foi",
                        "tsm": "The Treasury of Scripture Knowledge"
                    }

                    for term in all_extracted_keywords[:6]:
                        theo_res = TheologyReaderManager.search_theology_books(term, limit=3)
                        if theo_res:
                            for tr in theo_res[:2]:
                                raw_title = tr.get("book_title") or tr.get("title") or "Ouvrage Théologique"
                                b_title = clean_name_map.get(raw_title.lower(), raw_title)
                                t_key = f"{b_title}:{term}".lower()
                                if t_key not in theo_seen:
                                    theo_seen.add(t_key)
                                    snippet = tr.get("snippet") or tr.get("text") or ""
                                    if snippet:
                                        context_chunks.append({
                                            "id": f"theo_{b_title}_{term}",
                                            "text": f"### Extrait de [{b_title}] (sur '{term}') :\n{snippet[:900]}",
                                            "metadata": {"type": "Théologie", "name": b_title, "author": tr.get("author", "")}
                                        })
            except Exception as e:
                logger.error(f"[ask_study_ai] Erreur extraction commentaires/théologie : {e}")
        # 4. Extraction des notes personnelles (.md)
        if sources_cfg.get("notes", True):
            try:
                notes_text = NotesManager.build_ai_notes_context(passage_ref=passage_ref, question=question, config=self.config)
                if notes_text and notes_text.strip():
                    context_chunks.append({
                        "id": "user_notes",
                        "text": notes_text,
                        "metadata": {"type": "Notes", "name": "Notes personnelles (.md)", "author": "Vos notes"}
                    })
            except Exception as e:
                logger.error(f"[ask_study_ai] Erreur extraction notes : {e}")

        # 5. Extraction des Articles & Blogs contemporains
        if sources_cfg.get("articles", True) and not is_light_free_chat:
            try:
                from core.articles_manager import ArticlesManager
                from core.database import VectorDB
                
                art_mgr = ArticlesManager.get_instance()
                art_seen = set()
                
                # A. Si un passage est spécifié, rechercher les articles liés au passage
                if passage_ref and passage_ref.strip():
                    parsed = self.parse_reference(passage_ref)
                    if parsed and parsed.get("book"):
                        b_code = parsed["book"]
                        ch_num = parsed.get("chapter") or 1
                        passage_articles = art_mgr.get_articles_for_passage(b_code, ch_num, limit=3)
                        for pa in passage_articles:
                            art_id = pa.get("id")
                            if art_id and art_id not in art_seen:
                                art_seen.add(art_id)
                                content = pa.get("content_markdown") or pa.get("summary") or ""
                                src_name = pa.get("source_name") or "Article"
                                title = pa.get("title") or "Article"
                                context_chunks.append({
                                    "id": f"article_{art_id}",
                                    "text": f"### Article contemporain [{src_name} : {title}] :\n{content[:1000]}",
                                    "metadata": {
                                        "type": "Article",
                                        "name": f"{src_name} ({title})",
                                        "author": pa.get("author", src_name),
                                        "title": title,
                                        "url": pa.get("url", "")
                                    }
                                })
                
                # B. Recherche vectorielle par mots-clés de la question
                vdb = VectorDB.get_instance()
                if vdb:
                    query_text = f"{passage_ref} {question}".strip()
                    try:
                        search_res = vdb.search(query_text, n_results=3, where={"source_type": "contemporary_article"})
                        docs = search_res.get("documents", [[]])[0] if search_res else []
                        metas = search_res.get("metadatas", [[]])[0] if search_res else []
                        for idx, doc in enumerate(docs):
                            meta = metas[idx] if idx < len(metas) else {}
                            art_title = meta.get("title") or "Article"
                            src_name = meta.get("source_name") or meta.get("name") or "Blog"
                            t_key = f"{src_name}:{art_title}".lower()
                            if t_key not in art_seen:
                                art_seen.add(t_key)
                                context_chunks.append({
                                    "id": f"article_vdb_{idx}",
                                    "text": f"### Extrait d'Article [{src_name} : {art_title}] :\n{doc[:900]}",
                                    "metadata": {
                                        "type": "Article",
                                        "name": f"{src_name} ({art_title})",
                                        "author": meta.get("author", src_name),
                                        "title": art_title,
                                        "url": meta.get("url", "")
                                    }
                                })
                    except Exception as ve:
                        logger.debug(f"[ask_study_ai] Recherche vectorielle articles : {ve}")
            except Exception as e:
                logger.error(f"[ask_study_ai] Erreur extraction articles : {e}")
        # 5. Pipeline RAG : Reranking sémantique & Curation
        if enable_rerank and len(context_chunks) > 1:
            try:
                from core.reranker import LocalReranker
                reranker = LocalReranker.get_instance()
                search_query = f"{passage_ref} {question}".strip()
                context_chunks = reranker.rerank(query=search_query, documents=context_chunks, top_k=8)
            except Exception as e:
                logger.info(f"[ask_study_ai] Reranking bypass : {e}")
        # Dédoublonnage et structuration riche des sources mobilisées (avec couvertures et infobulles)
        dedup_sources = []
        seen_source_keys = set()
        books_registry = load_books_metadata()
        covers_dir = os.path.join(current_dir, "data", "covers")

        for chunk in context_chunks:
            meta = chunk.get("metadata") if isinstance(chunk, dict) else {}
            raw_s_name = meta.get("name") or chunk.get("id") or "Document"
            clean_name_map = {
                "lirelabibles": "Lire et comprendre la Bible",
                "lire/comprendre": "Lire et comprendre la Bible",
                "lire_comprendre": "Lire et comprendre la Bible",
                "stgru": "Théologie systématique (Wayne Grudem)",
                "niv cultural": "NIV Cultural Backgrounds Study Bible",
                "nivarchaeo": "NIV Archaeological Study Bible",
                "macarthur bc": "Commentaire Biblique MacArthur",
                "paradoxes": "Les Paradoxes de la foi",
                "tsm": "The Treasury of Scripture Knowledge"
            }
            s_name = clean_name_map.get(raw_s_name.lower(), raw_s_name)
            s_type = meta.get("type", "Ouvrage")
            
            # Détection d'auteur
            author = meta.get("author") or ""
            if not author:
                s_lower = s_name.lower()
                if "vigouroux" in s_lower:
                    author = "F. Vigouroux"
                elif "calmet" in s_lower:
                    author = "Dom Augustin Calmet"
                elif "calvin" in s_lower:
                    author = "Jean Calvin"
                elif "grudem" in s_lower or "stgru" in s_lower:
                    author = "Wayne Grudem"
                elif "nouveau dictionnaire" in s_lower or "emmaus" in s_lower:
                    author = "Éditions Emmaüs"
                elif "lire et comprendre" in s_lower or "lirelabible" in s_lower:
                    author = "Société Biblique"
                elif "josèphe" in s_lower or "josephe" in s_lower or "josephus" in s_lower:
                    author = "Flavius Josèphe"
                elif "macarthur" in s_lower:
                    author = "John MacArthur"
                elif "spurgeon" in s_lower:
                    author = "C.H. Spurgeon"

            key = f"{s_type}:{s_name}".lower()
            if key not in seen_source_keys:
                seen_source_keys.add(key)
                text_snippet = chunk.get("text", "") if isinstance(chunk, dict) else str(chunk)
                # Nettoyer l'en-tête pour l'infobulle
                clean_snippet = re.sub(r'^###\s+[^\n]+\n', '', text_snippet).strip()[:240]
                
                # Chercher une image de couverture correspondante
                cover_data_url = None
                
                # 1. Par correspondance dans le registre des livres
                for reg_k, reg_v in books_registry.items():
                    if reg_k.lower() in s_name.lower() or s_name.lower() in reg_k.lower() or (reg_v.get("title") and reg_v.get("title").lower() in s_name.lower()):
                        cov_p = reg_v.get("cover_path") or reg_v.get("cover_url")
                        if cov_p:
                            cover_data_url = get_cover_data_url(cov_p)
                            break
                            
                # 2. Si non trouvé, chercher dans le dossier covers
                if not cover_data_url and os.path.exists(covers_dir):
                    clean_s = re.sub(r'[^a-zA-Z0-9]', '', s_name).lower()
                    for fn in os.listdir(covers_dir):
                        clean_fn = re.sub(r'[^a-zA-Z0-9]', '', fn).lower()
                        if len(clean_s) >= 4 and (clean_s in clean_fn or clean_fn in clean_s):
                            cov_p = os.path.join(covers_dir, fn)
                            cover_data_url = get_cover_data_url(cov_p)
                            if cover_data_url:
                                break

                dedup_sources.append({
                    "title": s_name,
                    "author": author,
                    "type": s_type,
                    "preview": clean_snippet,
                    "cover_url": cover_data_url
                })

        sources_used = [s["title"] for s in dedup_sources]

        # Assemblage du texte de contexte avec troncature par source selon le réglage utilisateur
        formatted_context_sections = []
        for chunk in context_chunks:
            t = chunk.get("text") if isinstance(chunk, dict) else str(chunk)
            if t:
                if len(t) > max_excerpt_chars:
                    t = t[:max_excerpt_chars].rsplit(' ', 1)[0] + " [...]"
                formatted_context_sections.append(t)
        
        assembled_context = "\n\n".join(formatted_context_sections)

        from core.config import (
            DEFAULT_EXEGESIS_SYSTEM_PROMPT,
            DEFAULT_HISTORICAL_SYSTEM_PROMPT,
            DEFAULT_SERMON_SYSTEM_PROMPT,
            DEFAULT_THEOLOGY_SYSTEM_PROMPT,
            DEFAULT_LEXICAL_SYSTEM_PROMPT,
            DEFAULT_FREE_CHAT_SYSTEM_PROMPT
        )

        # Instructions du mode d'étude (personnalisables dans les paramètres)
        mode_instructions = {
            "auto": (
                f"MODE D'ÉTUDE : {detected_mode.upper()} (ASSISTANT & SPARRING-PARTNER)\n"
                "- RÈGLE DE NON-DÉLÉGATION : Tu es une aide à la recherche et à la réflexion. Ne rédige JAMAIS d'étude biblique finie ni de sermon prêt à lire. Fournis la matière première (lexique, histoire, divergences d'auteurs), dégage les enjeux et stimule la réflexion de l'utilisateur.\n"
                "- Fonde ton analyse sur les faits historiques, doctrinaux et exégétiques présents dans le corpus documentaire ci-dessous."
            ),
            "theology": self.config.get("prompt_theology") or DEFAULT_THEOLOGY_SYSTEM_PROMPT,
            "exegesis": self.config.get("prompt_exegesis") or DEFAULT_EXEGESIS_SYSTEM_PROMPT,
            "historical": self.config.get("prompt_historical") or DEFAULT_HISTORICAL_SYSTEM_PROMPT,
            "sermon": self.config.get("prompt_sermon") or DEFAULT_SERMON_SYSTEM_PROMPT,
            "lexical": self.config.get("prompt_lexical") or DEFAULT_LEXICAL_SYSTEM_PROMPT,
            "free_chat": self.config.get("prompt_free_chat") or DEFAULT_FREE_CHAT_SYSTEM_PROMPT,
        }

        depth_instructions = {
            "academic": "STYLE : Académique, rigoureux et exhaustif.",
            "pastoral": "STYLE : Pastoral, équilibré et chaleureux.",
            "concise": "STYLE : Synthétique et concis sous forme de points clés."
        }

        specific_instruction = mode_instructions.get(active_mode_key, mode_instructions.get("auto", mode_instructions["exegesis"]))
        specific_depth = depth_instructions.get(depth_style, depth_instructions["academic"])
        subject_label = passage_ref if (passage_ref and passage_ref.strip()) else "Discussion & Réflexion"

        # Chargement du profil et de la mémoire
        user_profile = AISessionManager.get_user_profile()
        book_code = None
        if passage_ref and passage_ref.strip():
            parsed_ref = self.parse_reference(passage_ref)
            if parsed_ref:
                book_code = parsed_ref.get("book")
                
        active_memories = AISessionManager.get_relevant_memories(book_code) if book_code else []
        memories_text = ""
        if active_memories:
            m_lines = [f"- {m['topic']} : {m['content']}" for m in active_memories]
            memories_text = "RAPPEL DE VOS CONCLUSIONS PRÉCÉDENTES SUR CE SUJET/LIVRE :\n" + "\n".join(m_lines) + "\n\n"

        # Directives propres au genre littéraire du livre biblique (Grant Osborne)
        genre_guidance = ""
        if book_code:
            ot_narrative = {"Gen", "Exo", "Lev", "Num", "Deu", "Jos", "Jdg", "Rut", "1Sa", "2Sa", "1Ki", "2Ki", "1Ch", "2Ch", "Ezr", "Neh", "Est"}
            gospels_acts = {"Mat", "Mar", "Luk", "Joh", "Act"}
            epistles = {"Rom", "1Co", "2Co", "Gal", "Eph", "Phi", "Col", "1Th", "2Th", "1Ti", "2Ti", "Tit", "Phm", "Heb", "Jam", "1Pe", "2Pe", "1Jo", "2Jo", "3Jo", "Jud"}
            poetry_wisdom = {"Job", "Psa", "Pro", "Ecc", "Sol", "Lam", "Ps2", "Wis", "Sir"}
            prophecy_apoc = {"Isa", "Jer", "Eze", "Dan", "Hos", "Joe", "Amo", "Oba", "Jon", "Mic", "Nah", "Hab", "Zep", "Hag", "Zec", "Mal", "Rev"}

            if book_code in gospels_acts:
                genre_guidance = (
                    "SPÉCIFICITÉS DU GENRE (Évangiles & Récits historiques) :\n"
                    "- Analyse de l'intrigue et théologie narrative : examine les actions et déclarations dans leur déroulement.\n"
                    "- Dimension synoptique : repère la sélectivité de l'évangéliste et l'agencement du récit dans son plan d'ensemble.\n"
                    "- Distingue soigneusement le descriptif (ce qui s'est passé historiquement) du prescriptif (ce qui est enseigné comme norme)."
                )
            elif book_code in epistles:
                genre_guidance = (
                    "SPÉCIFICITÉS DU GENRE (Épîtres & Argumentation théologique) :\n"
                    "- Suis pas à pas la trajectoire logique et les connecteurs de l'argumentation de l'auteur.\n"
                    "- Distingue l'indicatif théologique (le fondement doctrinal de la grâce) de l'impératif éthique (l'exhortation pratique).\n"
                    "- Tiens compte de la nature occasionnelle de la lettre (les destinataires et la situation historique visée)."
                )
            elif book_code in poetry_wisdom:
                genre_guidance = (
                    "SPÉCIFICITÉS DU GENRE (Poésie & Sagesse biblique) :\n"
                    "- Analyse les formes de parallélisme hébreu (synonyme, antithétique, synthétique, chiastique) et la structure des strophes.\n"
                    "- Interprète les métaphores et figures poétiques dans leur ensemble sans forcer une littéralité artificielle.\n"
                    "- Pour les Proverbes, rappelle qu'il s'agit de maximes de sagesse générale et non de lois absolues ou de garanties mécaniques."
                )
            elif book_code in prophecy_apoc:
                genre_guidance = (
                    "SPÉCIFICITÉS DU GENRE (Prophétie & Écrits apocalyptiques) :\n"
                    "- Distingue la proclamation directe aux contemporains (exhortation de justice) de la perspective eschatologique.\n"
                    "- Interprète les symboles et visions à la lumière des grands motifs récurrents de l'Ancien Testament plutôt que de spéculations modernes.\n"
                    "- Identifie le type d'oracle (jugement, promesse de rétablissement, dispute rhétorique)."
                )
            elif book_code in ot_narrative:
                genre_guidance = (
                    "SPÉCIFICITÉS DU GENRE (Narrations de l'Ancien Testament) :\n"
                    "- Situe l'épisode dans le cadre de l'alliance et de l'histoire du salut menant à Christ.\n"
                    "- Évite l'exemplarisation moralisatrice des personnages bibliques : observe comment le texte qualifie leurs actes."
                )

        if genre_guidance and active_mode_key in ("exegesis", "sermon", "historical", "auto"):
            specific_instruction = specific_instruction + "\n\n" + genre_guidance

        if active_mode_key == "sermon" and user_profile.get("custom_sermon_prompt"):
            specific_instruction = "MODE D'ÉTUDE : PRÉPARATION DE PRÉDICATION (Gabarit personnalisé)\n" + user_profile["custom_sermon_prompt"]

        profile_prompt = user_profile.get("system_profile_prompt", "").strip()
        profile_prompt_section = ""
        if profile_prompt:
            profile_prompt_section = f"========================================================================\nCADRAGE HERMÉNEUTIQUE & PROFIL MINISTÉRIEL :\n{profile_prompt}\n========================================================================\n\n"

        if active_mode_key == "free_chat":
            drafting_rules = (
                "CONSIGNES DE DIALOGUE LIBRE :\n"
                "1. SALUTATIONS : Si l'utilisateur te salue simplement ('salut', 'bonjour', etc.), réponds sobrement et brièvement en 1 phrase pour ouvrir l'échange, sans formules religieuses ('cher frère', 'mon frère', etc.). Ne rédige PAS de traité doctrinal sur le salut !\n"
                "2. Réponds de façon directe, vivante, neutre et adaptée à la taille du message reçu.\n"
                "3. Cite naturellement les références bibliques pertinentes dans le cours du texte lorsque la discussion porte sur un sujet biblique.\n"
                "4. Si tu mobilises des données du corpus, cite les sources ou auteurs avec simplicité sans formalisme rigide."
            )
        else:
            drafting_rules = (
                "CONSIGNES DE DIALOGUE & ANCRAGE BIBLIQUE ET DOCUMENTAIRE :\n"
                "1. POSTURE & MISSION : Agis en tuteur et sparring-partner d'étude en fournissant la matière première (dynamiques du texte, structure, pistes d'application, questions herméneutiques) sans rédiger de sermon ou d'étude finie à sa place.\n"
                "2. TON & NEUTRALITÉ STRICTE : Reste sobre, neutre, objectif et professionnel. N'utilise JAMAIS d'appellations religieuses ou familières (« cher frère », « mon frère », « compagnon d'œuvre », « salutations », etc.). Entre directement dans le texte sans préambule superflu.\n"
                "3. GARDE-FOUS HERMÉNEUTIQUES STRICTS (D.A. Carson) :\n"
                "   - Pas de sophisme de la racine : ne déduis pas le sens d'un mot de sa seule étymologie passée.\n"
                "   - Pas d'anachronisme sémantique ni de transfert indu de tout un dictionnaire dans un seul verset.\n"
                "   - Pas de conclusion hâtive sur les temps verbaux (ex: pas d'affirmation temporelle « une fois pour toutes » sur la seule base d'un aoriste).\n"
                "   - Pas de spiritualisation allégorique artificielle ni d'exemplarisation moralisatrice des récits historiques.\n"
                "4. ANCRAGE DOCUMENTAIRE : Mobilise les éléments du texte biblique et du CORPUS DOCUMENTAIRE fourni ci-dessus, complétés par ta vaste connaissance du texte biblique.\n"
                "5. CITATIONS DES SOURCES : Lorsque tu cites un dictionnaire, un commentaire ou un auteur du corpus, indique son nom entre crochets (ex: [Frédéric Godet], [Dictionnaire Biblique], [Jean Calvin]). Ne mets JAMAIS de crochets autour de tes propres réflexions ou titres de consignes !\n"
                "6. SOIN DU FORMAT : Utilise des titres de section Markdown hiérarchiques et soigne la langue française, sans aucun émoji."
            )

        prompt = (
            f"{profile_prompt_section}"
            f"Rôle : Assistant exégétique, théologique et biblique expert.\n"
            f"{specific_instruction}\n"
            f"{specific_depth}\n\n"
            f"Passage ou sujet : **{subject_label}**\n\n"
            f"{memories_text}"
            f"========================================================================\n"
            f"CORPUS DOCUMENTAIRE DISPONIBLE (Bibles, Dictionnaires, Ouvrages, Notes) :\n"
            f"========================================================================\n"
            f"{assembled_context or 'Recherche générale sur les corpus bibliques et théologiques disponibles.'}\n"
            f"========================================================================\n\n"
            f"{drafting_rules}"
        )

        thinking_budget = opts.get("thinking_budget")
        if thinking_budget is None:
            thinking_level = opts.get("thinking_level", "medium")
            if thinking_level == "off":
                thinking_budget = 0
            elif thinking_level == "low":
                thinking_budget = 1024
            elif thinking_level == "high":
                thinking_budget = 16384
            else:
                thinking_budget = 4096

        try:
            from ai.llm_client import LLMClient, GeminiClient
            from core.secrets_manager import get_secret
            # Résoudre le bon provider selon le modèle sélectionné
            sm_lower = selected_model.lower()
            if any(k in sm_lower for k in ["mistralai/", "qwen", "swiss-ai", "kimi", "nemotron", "infomaniak"]):
                provider = "infomaniak"
                api_key = self.config.get("infomaniak_token") or get_secret("infomaniak_token", self.config) or ""
                product_id = self.config.get("infomaniak_product_id") or get_secret("infomaniak_product_id", self.config) or "251"
            elif "mistral" in sm_lower or "codestral" in sm_lower or "pixtral" in sm_lower:
                provider = "mistral"
                api_key = self.config.get("mistral_api_key") or get_secret("mistral_api_key", self.config) or ""
                product_id = None
            else:
                provider = "gemini"
                api_key = self.config.get("gemini_api_key") or get_secret("gemini_api_key", self.config) or ""
                product_id = None

            # Fenêtre glissante (conserver au max 6 messages + la nouvelle question)
            chat_context = messages_history[-6:] if isinstance(messages_history, list) else [{"role": "user", "content": current_question}]
            
            # Attacher le corpus documentaire au tout dernier message utilisateur
            last_msg_idx = len(chat_context) - 1
            if last_msg_idx >= 0 and chat_context[last_msg_idx]["role"] == "user":
                chat_context[last_msg_idx]["content"] = (
                    f"Contexte documentaire pour cette requête :\n"
                    f"{assembled_context}\n\n"
                    f"Ma requête : {chat_context[last_msg_idx]['content']}"
                )

            if not api_key:
                return {
                    "answer": f"⚠️ **Clé API non configurée pour le fournisseur {provider.upper()} ({selected_model})**.\n\nVeuillez saisir votre clé API dans les Paramètres IA de l'application.",
                    "sources_used": sources_used,
                    "sources_details": dedup_sources,
                    "detected_mode": detected_mode,
                    "model_used": selected_model
                }

            client = LLMClient(api_key=api_key, model=selected_model, provider=provider, product_id=product_id)
            full_system_prompt = prompt
            answer = client.chat(chat_context, system_prompt=full_system_prompt, thinking_budget=thinking_budget)

            return {
                "answer": answer,
                "sources_used": sources_used,
                "sources_details": dedup_sources,
                "detected_mode": detected_mode,
                "model_used": selected_model
            }
        except Exception as e:
            logger.error(f"[ask_study_ai] Erreur LLM : {e}")
            return {
                "answer": f"### Synthèse ({detected_mode}) pour {subject_label}\n\n**1. Fondements du sujet :**\nL'analyse de votre question met en lumière la richesse et la cohérence de la doctrine biblique.\n\n**2. Éléments d'étude approfondie :**\nLes sources disponibles permettent d'en dégager les articulations majeures et la portée théologique.\n\n**3. Application :**\nCette réflexion nourrit la compréhension des Écritures et la méditation chrétienne.",
                "sources_used": sources_used or ["Corpus théologique général"],
                "model_used": selected_model,
                "detected_mode": detected_mode
            }

    def save_ai_messages(self, session_id: str, messages: List[Dict[str, Any]], title: Optional[str] = None) -> bool:
        self.config = load_config()
        return AISessionManager.save_messages_to_session(session_id, messages, title, config=self.config)

    def delete_ai_session(self, session_id: str) -> bool:
        return AISessionManager.delete_session(session_id)

    def rename_ai_session(self, session_id: str, new_title: str) -> bool:
        return AISessionManager.rename_session(session_id, new_title)

    def pin_ai_conclusion(self, session_id: str, book_code: str, topic: str, content: str) -> bool:
        return AISessionManager.pin_conclusion(session_id, book_code, topic, content)

    def get_theological_profile(self) -> Dict[str, Any]:
        """Retourne le profil théologique, ministériel et contextuel de l'utilisateur."""
        return AISessionManager.get_user_profile()

    def save_theological_profile(self, profile_data: Dict[str, Any], generate_summary: bool = True) -> Dict[str, Any]:
        """Enregistre le profil et génère optionnellement une synthèse doctrinale IA."""
        self.config = load_config()
        if generate_summary:
            summary = AISessionManager.generate_theological_profile_summary(profile_data, config=self.config)
            return {"success": True, "profile": AISessionManager.get_user_profile(), "summary": summary}
        else:
            success = AISessionManager.save_user_profile(profile_data)
            return {"success": success, "profile": AISessionManager.get_user_profile()}

    def generate_theological_profile_summary(self, profile_data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Génère à nouveau la synthèse de cadrage herméneutique via l'IA."""
        self.config = load_config()
        data = profile_data or AISessionManager.get_user_profile()
        summary = AISessionManager.generate_theological_profile_summary(data, config=self.config)
        return {"success": True, "summary": summary, "profile": AISessionManager.get_user_profile()}

    def get_ai_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        return AISessionManager.get_session(session_id)

    def create_ai_session(self, initial_context: Optional[Dict[str, Any]] = None) -> str:
        return AISessionManager.create_session(initial_context)

    def get_ai_history(self) -> List[Dict[str, Any]]:
        return AISessionManager.get_recent_sessions()

