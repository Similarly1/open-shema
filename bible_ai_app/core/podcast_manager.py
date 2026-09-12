"""
core/podcast_manager.py — Moteur Métier pour le Studio Audio d'Open Shema.

Gère la chaîne complète :
1. Recherche contextuelle RAG multi-sources avec filtrage granulaire (Bibles, Commentaires,
   Dictionnaires, Articles, Notes .md, UPVR, Théologie), réglage de profondeur (tokens),
   reranking sémantique local (BGE-M3) et LLM curateur intermédiaire.
2. Scénarisation IA du script (format Dialogue Hôte/Exégète ou Chronique Solo) via Gemini / Mistral.
3. Synthèse vocale neuronale via Microsoft Edge-TTS (gratuit, sans quota) ou Mistral Voxtral.
4. Concaténation audio avec horodatage millimétrique pour la synchronisation karaoké.
5. Gestionnaire d'historique persistant pour écoute et réutilisation immédiates.
"""

import os
import sys
import re
import json
import time
import uuid
import asyncio
import logging
import datetime
from typing import Dict, List, Any, Optional, Callable

logger = logging.getLogger("podcast_manager")

from core.paths import get_user_data_path
from core.config import (
    load_config,
    save_config,
    DEFAULT_AUDIO_STUDIO_DIALOGUE_PROMPT,
    DEFAULT_AUDIO_STUDIO_SOLO_PROMPT,
    DEFAULT_EXEGESIS_SYSTEM_PROMPT,
    DEFAULT_HISTORICAL_SYSTEM_PROMPT,
    DEFAULT_SERMON_SYSTEM_PROMPT,
    DEFAULT_THEOLOGY_SYSTEM_PROMPT,
    DEFAULT_LEXICAL_SYSTEM_PROMPT
)


# Dossier de stockage des podcasts
def get_podcasts_dir() -> str:
    p_dir = get_user_data_path("podcasts")
    os.makedirs(p_dir, exist_ok=True)
    return p_dir


def get_history_file_path() -> str:
    return os.path.join(get_podcasts_dir(), "history.json")


class PodcastHistory:
    """Gestionnaire d'historique persistant des podcasts et chroniques."""

    @classmethod
    def load_all(cls) -> List[Dict[str, Any]]:
        h_file = get_history_file_path()
        if not os.path.exists(h_file):
            return []
        try:
            with open(h_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list):
                    return data
                return []
        except Exception as e:
            logger.warning("[PodcastHistory] Erreur lecture history.json : %s", e)
            return []

    @classmethod
    def save_all(cls, items: List[Dict[str, Any]]):
        h_file = get_history_file_path()
        try:
            with open(h_file, "w", encoding="utf-8") as f:
                json.dump(items, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error("[PodcastHistory] Erreur sauvegarde history.json : %s", e)

    @classmethod
    def get(cls, podcast_id: str) -> Optional[Dict[str, Any]]:
        items = cls.load_all()
        for it in items:
            if it.get("id") == podcast_id:
                return it
        return None

    @classmethod
    def upsert(cls, podcast_data: Dict[str, Any]):
        items = cls.load_all()
        p_id = podcast_data.get("id")
        found = False
        for idx, it in enumerate(items):
            if it.get("id") == p_id:
                items[idx] = podcast_data
                found = True
                break
        if not found:
            items.insert(0, podcast_data)
        cls.save_all(items)

    @classmethod
    def delete(cls, podcast_id: str) -> bool:
        items = cls.load_all()
        target = None
        new_items = []
        for it in items:
            if it.get("id") == podcast_id:
                target = it
            else:
                new_items.append(it)
        if target:
            # Supprimer le fichier audio MP3 associé s'il existe
            audio_file = target.get("audio_file")
            if audio_file:
                audio_path = os.path.join(get_podcasts_dir(), audio_file)
                if os.path.exists(audio_path):
                    try:
                        os.remove(audio_path)
                    except OSError as e:
                        logger.warning("[PodcastHistory] Erreur suppression MP3 %s : %s", audio_path, e)
            cls.save_all(new_items)
            return True
        return False


class PodcastEngine:
    """Moteur central d'orchestration RAG, de scénarisation et de synthèse vocale."""

    EDGE_VOICES = [
        # France
        {"id": "fr-FR-DeniseNeural", "name": "Denise (France - Féminine, claire & vive)", "gender": "Female", "locale": "fr-FR", "region": "France", "role": "host"},
        {"id": "fr-FR-HenriNeural", "name": "Henri (France - Masculine, posé & érudit)", "gender": "Male", "locale": "fr-FR", "region": "France", "role": "scholar"},
        {"id": "fr-FR-VivienneMultilingualNeural", "name": "Vivienne (France - Féminine, naturelle & fluide)", "gender": "Female", "locale": "fr-FR", "region": "France", "role": "host"},
        {"id": "fr-FR-RemyMultilingualNeural", "name": "Rémy (France - Masculine, expressif & chaleureux)", "gender": "Male", "locale": "fr-FR", "region": "France", "role": "scholar"},
        {"id": "fr-FR-EloiseNeural", "name": "Éloïse (France - Féminine, douce & posée)", "gender": "Female", "locale": "fr-FR", "region": "France", "role": "host"},
        # Belgique
        {"id": "fr-BE-CharlineNeural", "name": "Charline (Belgique - Féminine, posée)", "gender": "Female", "locale": "fr-BE", "region": "Belgique", "role": "host"},
        {"id": "fr-BE-GerardNeural", "name": "Gérard (Belgique - Masculine, calme & posé)", "gender": "Male", "locale": "fr-BE", "region": "Belgique", "role": "scholar"},
        # Suisse
        {"id": "fr-CH-ArianeNeural", "name": "Ariane (Suisse - Féminine, posée)", "gender": "Female", "locale": "fr-CH", "region": "Suisse", "role": "host"},
        {"id": "fr-CH-FabriceNeural", "name": "Fabrice (Suisse - Masculine, posé & net)", "gender": "Male", "locale": "fr-CH", "region": "Suisse", "role": "scholar"},
        # Canada
        {"id": "fr-CA-SylvieNeural", "name": "Sylvie (Canada - Féminine, chaleureuse)", "gender": "Female", "locale": "fr-CA", "region": "Canada", "role": "host"},
        {"id": "fr-CA-AntoineNeural", "name": "Antoine (Canada - Masculine, posé)", "gender": "Male", "locale": "fr-CA", "region": "Canada", "role": "scholar"},
        {"id": "fr-CA-JeanNeural", "name": "Jean (Canada - Masculine, dynamique)", "gender": "Male", "locale": "fr-CA", "region": "Canada", "role": "scholar"},
        {"id": "fr-CA-ThierryNeural", "name": "Thierry (Canada - Masculine, expressif)", "gender": "Male", "locale": "fr-CA", "region": "Canada", "role": "scholar"},
    ]

    VOXTRAL_VOICES = [
        # Voix Officielles Mistral
        {"id": "voxtral-celeste", "name": "Céleste (Mistral - Féminine, expressive & claire)", "gender": "Female", "role": "host", "category": "Mistral Standard"},
        {"id": "voxtral-aurelien", "name": "Aurélien (Mistral - Masculine, posé & érudit)", "gender": "Male", "role": "scholar", "category": "Mistral Standard"},
        {"id": "voxtral-claire", "name": "Claire (Mistral - Féminine, dynamique & vivante)", "gender": "Female", "role": "host", "category": "Mistral Standard"},
        {"id": "voxtral-mathieu", "name": "Mathieu (Mistral - Masculine, théologien & solennel)", "gender": "Male", "role": "scholar", "category": "Mistral Standard"},
        {"id": "voxtral-elise", "name": "Élise (Mistral - Féminine, douce & méditative)", "gender": "Female", "role": "host", "category": "Mistral Standard"},
        {"id": "voxtral-etienne", "name": "Étienne (Mistral - Masculine, captivant & articulé)", "gender": "Male", "role": "scholar", "category": "Mistral Standard"},
        # Profils Rôles Spécialisés
        {"id": "voxtral-animateur", "name": "Voxtral Hôte (Vif, interrogatif & chaleureux)", "gender": "Female", "role": "host", "category": "Profils d'Émission"},
        {"id": "voxtral-exegete", "name": "Voxtral Exégète (Académique & analytique)", "gender": "Male", "role": "scholar", "category": "Profils d'Émission"},
        {"id": "voxtral-pastoral", "name": "Voxtral Pastoral (Chaleureux & bienveillant)", "gender": "Male", "role": "scholar", "category": "Profils d'Émission"},
        # Voix Personnalisées
        {"id": "voxtral-custom-1", "name": "Voix Personnalisée 1 (Compte Mistral Payant)", "gender": "Female", "role": "host", "category": "Personnalisées"},
        {"id": "voxtral-custom-2", "name": "Voix Personnalisée 2 (Compte Mistral Payant)", "gender": "Male", "role": "scholar", "category": "Personnalisées"},
    ]

    VOXTRAL_FALLBACK_MAP = {
        "voxtral-celeste": "fr-FR-DeniseNeural",
        "voxtral-aurelien": "fr-FR-HenriNeural",
        "voxtral-claire": "fr-FR-VivienneMultilingualNeural",
        "voxtral-mathieu": "fr-FR-RemyMultilingualNeural",
        "voxtral-elise": "fr-FR-EloiseNeural",
        "voxtral-etienne": "fr-FR-FabriceNeural",
        "voxtral-animateur": "fr-FR-DeniseNeural",
        "voxtral-exegete": "fr-FR-HenriNeural",
        "voxtral-pastoral": "fr-FR-RemyMultilingualNeural",
        "voxtral-custom-1": "fr-BE-CharlineNeural",
        "voxtral-custom-2": "fr-CH-FabriceNeural",
    }

    DEPTH_CHAR_LIMITS = {
        0: 1000,  # Éclair (~250 tokens / source)
        1: 2400,  # Équilibré (~600 tokens / source)
        2: 4800,  # Approfondi (~1200 tokens / source)
        3: 8000,  # Exhaustif (~2000 tokens / source)
    }

    DEPTH_DOC_COUNTS = {
        0: 3,
        1: 5,
        2: 8,
        3: 12
    }

    @classmethod
    def get_available_voices(cls) -> Dict[str, Any]:
        """Retourne le catalogue complet des voix Edge-TTS et Mistral Voxtral."""
        return {
            "voices": cls.EDGE_VOICES,
            "edge_tts": cls.EDGE_VOICES,
            "voxtral": cls.VOXTRAL_VOICES
        }

    @classmethod
    def build_context(
        cls,
        subject_or_ref: str,
        sources_options: Optional[Dict[str, Any]] = None,
        config: Optional[Dict[str, Any]] = None,
        db_instance: Any = None,
        progress_callback: Optional[Callable[[int, str], None]] = None
    ) -> str:
        """
        Collecte et extrait le corpus documentaire approfondi selon les options configurées :
        - Détection et parsing précis du passage biblique
        - Extraction des versets bibliques de référence
        - Extraction des commentaires exégétiques historiques et contemporains
        - Recherche sémantique dans les ouvrages de théologie et traités
        - Extraction des dictionnaires bibliques et lexique Strong
        - Recherche des articles contemporains et blogs
        - Extraction des réflexions pastorales (UPVR / Florent Varak)
        - Notes personnelles de l'utilisateur (.md)
        - Recherche vectorielle dense ChromaDB
        - Reranking sémantique local (Cross-Encoder BGE-M3)
        - Curation intermédiaire LLM
        - Profil herméneutique (« Mon Église »)
        """
        cfg = config or load_config()
        opts = sources_options or {}

        active_sources = opts.get("sources", {
            "bibles": True,
            "commentaries": True,
            "dictionaries": True,
            "articles": True,
            "notes": True,
            "upvr": True,
            "theology": True
        })

        depth_level = int(opts.get("context_depth", cfg.get("audio_studio_context_depth", 1)))
        max_chars_per_doc = cls.DEPTH_CHAR_LIMITS.get(depth_level, 2400)
        top_k_docs = cls.DEPTH_DOC_COUNTS.get(depth_level, 5)

        enable_rerank = opts.get("enable_reranking", cfg.get("audio_studio_enable_rerank", True))
        enable_curator = opts.get("enable_curator", cfg.get("audio_studio_enable_curator", False))
        include_profile = opts.get("include_profile", cfg.get("audio_studio_include_profile", True))

        if progress_callback:
            progress_callback(12, "Recherche documentaire multi-sources dans votre bibliothèque...")

        # 1. Parsing du passage biblique potentiel
        parsed_bounds = None
        try:
            from core.passage_study_manager import PassageStudyManager
            parsed_bounds = PassageStudyManager.parse_passage_bounds(subject_or_ref)
        except Exception:
            pass

        if not parsed_bounds:
            try:
                from core.reference_parser import parse_smart_book_input
                parsed = parse_smart_book_input(subject_or_ref)
                if parsed and parsed.get("book"):
                    b_code = parsed.get("code") or parsed.get("book")
                    ch = int(parsed.get("chapter") or 1)
                    v_start = int(parsed.get("verse_start") or parsed.get("verse") or 1)
                    v_end = int(parsed.get("verse_end") or v_start)
                    parsed_bounds = {
                        "book_code": b_code,
                        "french_book": parsed.get("book", b_code),
                        "start_ch": ch,
                        "start_v": v_start,
                        "end_ch": ch,
                        "end_v": v_end
                    }
            except Exception:
                pass

        # 2. Extraction des mots-clés thématiques
        stop_words_fr = {
            "quel", "quelle", "quels", "quelles", "etait", "étaient", "était", "etaient", "etre", "être",
            "dans", "avec", "pour", "selon", "entre", "cette", "cet", "ces", "leurs", "leur", "notre", "nos",
            "votre", "vos", "mon", "ton", "son", "sa", "ses", "comme", "tout", "tous", "toute", "toutes",
            "comment", "pourquoi", "vision", "texte", "temps", "epoque", "époque", "cadre", "plus", "aussi",
            "faire", "fais", "fait", "avoir", "sujet", "point", "points", "dessus", "dessous", "alors", "ainsi",
            "bible", "verset", "versets", "chapitre", "chapitres", "livre", "livres", "sur", "sous", "par",
            "une", "des", "les", "aux", "est", "sont", "podcast", "emission", "émission"
        }
        clean_subject = subject_or_ref
        if parsed_bounds and parsed_bounds.get("raw_reference"):
            clean_subject = clean_subject.replace(parsed_bounds["raw_reference"], " ")

        parentheses_matches = re.findall(r'[\"«\((.*?)\)»\"]', clean_subject)
        priority_terms = [m.strip() for m in parentheses_matches if len(m.strip()) > 2 and m.strip().lower() not in stop_words_fr]
        general_words = [w for w in re.findall(r'[a-zA-ZÀ-ÿ]{3,}', clean_subject) if w.lower() not in stop_words_fr]
        keywords = list(dict.fromkeys(priority_terms + general_words))

        raw_chunks: List[Dict[str, Any]] = []
        scripture_sections: List[str] = []

        # A. Passage biblique de référence
        if active_sources.get("bibles", True) and parsed_bounds:
            try:
                from core.bible_json_loader import BibleJsonLoader
                b_code = parsed_bounds["book_code"]
                ch = parsed_bounds["start_ch"]
                s_v = parsed_bounds["start_v"]
                e_v = min(parsed_bounds.get("end_v", s_v), 60)
                version = cfg.get("primary_bible", "LSG")
                book = BibleJsonLoader.load_book(version, b_code)
                if book and "chapters" in book and str(ch) in book["chapters"]:
                    ch_verses = book["chapters"][str(ch)]
                    v_lines = []
                    for vn in range(s_v, e_v + 1):
                        txt = ch_verses.get(str(vn))
                        if txt:
                            clean_t = re.sub(r'<[^>]+>', '', txt).strip()
                            v_lines.append(f"{b_code} {ch}:{vn} — {clean_t}")
                    if v_lines:
                        scripture_sections.append(f"=== PASSAGE BIBLIQUE D'ÉTUDE ({version} — {parsed_bounds.get('french_book', b_code)} {ch}:{s_v}–{e_v}) ===\n" + "\n".join(v_lines))
            except Exception as e_bib:
                logger.debug("[build_context] Erreur extraction biblique : %s", e_bib)

        # B. Commentaires bibliques
        if active_sources.get("commentaries", True) and parsed_bounds:
            try:
                from core.commentary_loader import CommentaryLoader
                b_code = parsed_bounds["book_code"]
                ch = parsed_bounds["start_ch"]
                s_v = parsed_bounds["start_v"]
                e_v = min(parsed_bounds.get("end_v", s_v), 60)
                comm_res = CommentaryLoader.get_all_comments_for_verse_range(b_code, ch, s_v, e_v)
                docs = comm_res.get("documents", [])
                metas = comm_res.get("metadatas", [])
                for i, doc in enumerate(docs[:top_k_docs * 3]):
                    meta = metas[i] if i < len(metas) else {}
                    author = meta.get("name") or meta.get("author") or "Commentaire"
                    ref = meta.get("reference") or f"{b_code} {ch}"
                    raw_chunks.append({
                        "id": f"comm_{author}_{i}",
                        "type": "Commentaire",
                        "name": f"{author} ({ref})",
                        "text": f"### Commentaire [{author}] sur {ref} :\n{doc}",
                        "metadata": {"type": "Commentaire", "name": author, "ref": ref}
                    })
            except Exception as e_comm:
                logger.debug("[build_context] Erreur extraction commentaires : %s", e_comm)

        # C. Ouvrages de théologie & traités
        if active_sources.get("theology", True):
            try:
                from core.theology_reader_manager import TheologyReaderManager
                theo_seen = set()
                search_terms = keywords[:5] if keywords else [subject_or_ref]
                for term in search_terms:
                    t_res = TheologyReaderManager.search_theology_books(term, limit=3)
                    if t_res:
                        for tr in t_res[:2]:
                            b_title = tr.get("book_title") or tr.get("title") or "Ouvrage Théologique"
                            t_key = f"{b_title}:{term}".lower()
                            if t_key not in theo_seen:
                                theo_seen.add(t_key)
                                snippet = tr.get("snippet") or tr.get("text") or ""
                                if snippet:
                                    raw_chunks.append({
                                        "id": f"theo_{b_title}_{term}",
                                        "type": "Théologie",
                                        "name": b_title,
                                        "text": f"### Ouvrage de Théologie [{b_title}] (sur '{term}') :\n{snippet}",
                                        "metadata": {"type": "Théologie", "name": b_title, "author": tr.get("author", "")}
                                    })
            except Exception as e_theo:
                logger.debug("[build_context] Erreur extraction théologie : %s", e_theo)

        # D. Dictionnaires bibliques & Lexiques Strong
        if active_sources.get("dictionaries", True):
            try:
                from core.dictionary_manager import DictionaryManager
                dict_seen = set()
                search_terms = keywords[:6] if keywords else [subject_or_ref]
                for term in search_terms:
                    d_res = DictionaryManager.lookup(term)
                    if (not d_res or not d_res.get("matches")) and term.endswith("s") and len(term) > 4:
                        d_res = DictionaryManager.lookup(term[:-1])
                    if d_res and d_res.get("matches"):
                        for m in d_res["matches"][:2]:
                            dict_name = m.get("dict_name", "Dictionnaire")
                            art_title = m.get("title", term)
                            d_key = f"{dict_name}:{art_title}".lower()
                            if d_key not in dict_seen:
                                dict_seen.add(d_key)
                                snippet = m.get("preview") or m.get("full_text") or ""
                                if snippet:
                                    raw_chunks.append({
                                        "id": f"dict_{term}_{dict_name}",
                                        "type": "Dictionnaire",
                                        "name": f"{dict_name} ({art_title})",
                                        "text": f"### Entrée de Dictionnaire [{dict_name} : {art_title}] :\n{snippet}",
                                        "metadata": {"type": "Dictionnaire", "name": dict_name}
                                    })
            except Exception as e_dict:
                logger.debug("[build_context] Erreur extraction dictionnaires : %s", e_dict)

            # Lexique Strong pour le passage
            if parsed_bounds:
                try:
                    from core.strong_helper import StrongLexiconHelper
                    b_code = parsed_bounds["book_code"]
                    ch = parsed_bounds["start_ch"]
                    v = parsed_bounds["start_v"]
                    strong_entry = StrongLexiconHelper.get_verse_lexicon_block(b_code, ch, v)
                    if strong_entry and isinstance(strong_entry, dict) and strong_entry.get("text"):
                        raw_chunks.append({
                            "id": f"strong_{b_code}_{ch}_{v}",
                            "type": "Dictionnaire",
                            "name": f"Lexique Strong ({b_code} {ch}:{v})",
                            "text": f"### Analyse Lexicale & Racines ({b_code} {ch}:{v}) :\n{strong_entry.get('text')}",
                            "metadata": {"type": "Dictionnaire", "name": "Strong Lexicon"}
                        })
                except Exception as e_str:
                    logger.debug("[build_context] Erreur Strong : %s", e_str)

        # E. Articles contemporains & Blogs
        if active_sources.get("articles", True):
            try:
                from core.articles_manager import ArticlesManager
                art_mgr = ArticlesManager.get_instance()
                art_seen = set()
                if parsed_bounds:
                    b_code = parsed_bounds["book_code"]
                    ch = parsed_bounds["start_ch"]
                    passage_articles = art_mgr.get_articles_for_passage(b_code, ch, limit=3)
                    for pa in passage_articles:
                        art_id = pa.get("id")
                        if art_id and art_id not in art_seen:
                            art_seen.add(art_id)
                            content = pa.get("content_markdown") or pa.get("summary") or ""
                            src_name = pa.get("source_name") or "Article"
                            title = pa.get("title") or "Article"
                            raw_chunks.append({
                                "id": f"article_{art_id}",
                                "type": "Article",
                                "name": f"{src_name} ({title})",
                                "text": f"### Article contemporain [{src_name} : {title}] :\n{content}",
                                "metadata": {"type": "Article", "name": f"{src_name} ({title})"}
                            })
            except Exception as e_art:
                logger.debug("[build_context] Erreur extraction articles : %s", e_art)

        # F. Réflexions Pastorales (UPVR - Florent Varak)
        if active_sources.get("upvr", True) and cfg.get("include_upvr_in_ai", True):
            try:
                from core.upvr_manager import UPVRManager
                upvr_mgr = UPVRManager.get_instance()
                if upvr_mgr.is_installed() and parsed_bounds:
                    b_code = parsed_bounds["book_code"]
                    ch = parsed_bounds["start_ch"]
                    v = parsed_bounds["start_v"]
                    pastoral_eps = upvr_mgr.get_episodes_for_passage(b_code, ch, verse=v, limit=3)
                    for pep in pastoral_eps:
                        ep_num = pep.get("episode_number")
                        resume = pep.get("resume_analytique") or pep.get("these_centrale") or ""
                        ep_title = pep.get("titre") or f"Épisode #{ep_num}"
                        if resume:
                            raw_chunks.append({
                                "id": f"upvr_{ep_num}",
                                "type": "Pastorale",
                                "name": f"UPVR #{ep_num} ({ep_title})",
                                "text": f"### Réflexion Pastorale [Un pasteur vous répond #{ep_num} : {ep_title}] :\n{resume}",
                                "metadata": {"type": "Pastorale", "name": f"UPVR #{ep_num}"}
                            })
            except Exception as e_upvr:
                logger.debug("[build_context] Erreur extraction UPVR : %s", e_upvr)

        # G. Recherche Vectorielle Dense (ChromaDB / VectorDB)
        try:
            from core.database import VectorDB
            vdb = VectorDB(api_keys=cfg)
            embed_model = cfg.get("embedding_model", "bge_multilingual_gemma2 (Infomaniak)")
            search_res = vdb.search_semantic(
                query=subject_or_ref,
                n_results=top_k_docs * 3,
                embedding_model=embed_model
            )
            v_docs = search_res.get("documents", [[]])[0] if search_res else []
            v_metas = search_res.get("metadatas", [[]])[0] if search_res else []
            v_ids = search_res.get("ids", [[]])[0] if search_res else []
            for idx, doc in enumerate(v_docs):
                meta = v_metas[idx] if idx < len(v_metas) else {}
                raw_id = v_ids[idx] if idx < len(v_ids) else f"vec_{idx}"
                doc_type = (meta.get("type") or meta.get("source_type") or "Ouvrage").lower()

                # Filtrage selon les sources cochées
                is_allowed = True
                if "pastoral" in doc_type and not active_sources.get("upvr", True): is_allowed = False
                elif "article" in doc_type and not active_sources.get("articles", True): is_allowed = False
                elif "commentary" in doc_type and not active_sources.get("commentaries", True): is_allowed = False
                elif "dict" in doc_type and not active_sources.get("dictionaries", True): is_allowed = False
                elif "theology" in doc_type and not active_sources.get("theology", True): is_allowed = False

                if is_allowed:
                    s_name = meta.get("name") or meta.get("title") or meta.get("book") or "Bibliothèque"
                    raw_chunks.append({
                        "id": f"vdb_{raw_id}",
                        "type": "Recherche Vectorielle",
                        "name": s_name,
                        "text": f"### Extrait de [{s_name}] :\n{doc}",
                        "metadata": meta
                    })
        except Exception as e_vdb:
            logger.debug("[build_context] Erreur VectorDB : %s", e_vdb)

        # H. Notes personnelles (.md)
        if active_sources.get("notes", True) and cfg.get("include_notes_in_ai", True):
            try:
                from core.notes_manager import NotesManager
                notes_text = NotesManager.build_ai_notes_context(passage_ref=subject_or_ref, question=subject_or_ref, config=cfg)
                if notes_text and notes_text.strip():
                    raw_chunks.append({
                        "id": "user_notes",
                        "type": "Notes",
                        "name": "Notes personnelles (.md)",
                        "text": f"### Notes personnelles de l'utilisateur :\n{notes_text.strip()}",
                        "metadata": {"type": "Notes", "name": "Notes personnelles"}
                    })
            except Exception as e_notes:
                logger.debug("[build_context] Erreur notes : %s", e_notes)

        if progress_callback:
            progress_callback(45, "Évaluation de pertinence croisée (Reranking BGE-M3)...")

        # 3. Dédoublonnage et Reranking sémantique
        dedup_chunks = []
        seen_ids = set()
        seen_snippets = set()
        for chunk in raw_chunks:
            c_id = chunk.get("id")
            snip = (chunk.get("text") or "")[:80].strip().lower()
            if c_id not in seen_ids and snip not in seen_snippets:
                seen_ids.add(c_id)
                seen_snippets.add(snip)
                dedup_chunks.append(chunk)

        selected_chunks = dedup_chunks
        if enable_rerank and len(dedup_chunks) > 1:
            try:
                from core.reranker import LocalReranker
                reranker = LocalReranker.get_instance()
                candidate_chunks = dedup_chunks[:25]
                selected_chunks = reranker.rerank(query=subject_or_ref, documents=candidate_chunks, top_k=top_k_docs * 3)
            except Exception as e_rr:
                logger.info("[build_context] Reranking bypass : %s", e_rr)
                selected_chunks = dedup_chunks[:top_k_docs * 3]
        else:
            selected_chunks = dedup_chunks[:top_k_docs * 3]

        if progress_callback:
            progress_callback(72, "Curation et structuration du corpus documentaire...")

        # 4. Curation intermédiaire si activée
        if enable_curator and selected_chunks:
            try:
                from core.rag_pipeline import RAGPipeline
                rag_pipe = RAGPipeline.get_instance(config=cfg)
                curator_m = cfg.get("curator_model") or cfg.get("rag_curation_model")
                curator_fb = cfg.get("curator_fallback_model") or cfg.get("rag_curation_fallback_model")
                curated = rag_pipe.curate_context(
                    query=subject_or_ref,
                    documents=selected_chunks,
                    curation_model=curator_m,
                    fallback_model=curator_fb
                )
                if curated:
                    selected_chunks = curated
            except Exception as e_cur:
                logger.info("[build_context] Curation bypass : %s", e_cur)

        # 5. Organisation des sections par catégories sourcées
        sections: List[str] = list(scripture_sections)

        by_type: Dict[str, List[str]] = {}
        for chunk in selected_chunks:
            c_type = chunk.get("type", "Document")
            txt = chunk.get("text", "").strip()
            if len(txt) > max_chars_per_doc:
                txt = txt[:max_chars_per_doc] + "..."
            by_type.setdefault(c_type, []).append(txt)

        category_titles = {
            "Commentaire": "=== EXTRAITS DE COMMENTAIRES EXÉGÉTIQUES ===",
            "Théologie": "=== OUVRAGES DE THÉOLOGIE & TRAITÉS ===",
            "Dictionnaire": "=== DICTIONNAIRES BIBLIQUES & LEXIQUES ===",
            "Article": "=== ARTICLES CONTEMPORAINS & BLOGS ===",
            "Pastorale": "=== RÉFLEXIONS PASTORALES (FLORENT VARAK - UPVR) ===",
            "Notes": "=== NOTES PERSONNELLES DE L'UTILISATEUR ===",
            "Recherche Vectorielle": "=== EXTRAITS DOCUMENTAIRES DE LA BIBLIOTHÈQUE ==="
        }

        for c_type, items in by_type.items():
            title = category_titles.get(c_type, f"=== EXTRAITS : {c_type.upper()} ===")
            sections.append(f"{title}\n" + "\n\n".join(items))

        # 6. Passeport Herméneutique (« Mon Église »)
        if include_profile:
            profile_text = cfg.get("theological_profile_prompt", "").strip()
            if profile_text:
                sections.append(f"=== ORIENTATION THÉOLOGIQUE ET HERMÉNEUTIQUE (« MON ÉGLISE ») ===\n{profile_text}\n")

        final_corpus = "\n\n".join(sections).strip()
        logger.info("[PodcastEngine] Corpus RAG consolidé pour '%s' : %d caractères, %d extraits retenus.", subject_or_ref, len(final_corpus), len(selected_chunks))
        return final_corpus

    @classmethod
    def _try_extract_passage_text(cls, query: str, config: Dict[str, Any]) -> str:
        """Tente d'extraire les versets réels si la chaîne est une référence biblique (ex: Romains 5:1-11)."""
        try:
            from core.passage_study_manager import PassageStudyManager
            p = PassageStudyManager.parse_passage_bounds(query)
            if p:
                from core.bible_json_loader import BibleJsonLoader
                b_code = p["book_code"]
                ch = p["start_ch"]
                s_v = p["start_v"]
                e_v = min(p.get("end_v", s_v), 60)
                version = config.get("primary_bible", "LSG")
                book = BibleJsonLoader.load_book(version, b_code)
                if book and "chapters" in book and str(ch) in book["chapters"]:
                    ch_verses = book["chapters"][str(ch)]
                    v_lines = []
                    for vn in range(s_v, e_v + 1):
                        txt = ch_verses.get(str(vn))
                        if txt:
                            clean_t = re.sub(r'<[^>]+>', '', txt).strip()
                            v_lines.append(f"{b_code} {ch}:{vn} — {clean_t}")
                    if v_lines:
                        return "\n".join(v_lines)
        except Exception:
            pass
        return ""

    @classmethod
    def _create_llm_client_for_model(cls, model_name: str, cfg: Dict[str, Any]):
        """Crée un LLMClient adapté au modèle (Gemini, Mistral ou Infomaniak)."""
        from ai.llm_client import LLMClient, resolve_llm_provider
        provider = resolve_llm_provider(model_name)
        if provider == "mistral":
            api_key = cfg.get("mistral_api_key", "")
            pid = None
        elif provider == "infomaniak":
            api_key = cfg.get("infomaniak_token", "")
            pid = cfg.get("infomaniak_product_id", "251")
        else:
            api_key = cfg.get("gemini_api_key", "")
            pid = None

        if not api_key:
            if cfg.get("gemini_api_key"):
                provider = "gemini"
                model_name = "gemini-3.7-flash"
                api_key = cfg.get("gemini_api_key")
            elif cfg.get("mistral_api_key"):
                provider = "mistral"
                model_name = "mistral-small-latest"
                api_key = cfg.get("mistral_api_key")
            elif cfg.get("infomaniak_token"):
                provider = "infomaniak"
                model_name = "mistralai/Ministral-3-14B-Instruct-2512"
                api_key = cfg.get("infomaniak_token")
                pid = cfg.get("infomaniak_product_id", "251")

        if not api_key:
            return None, provider, model_name

        client = LLMClient(api_key=api_key, model=model_name, provider=provider, product_id=pid)
        return client, provider, model_name

    @classmethod
    def suggest_focus_questions(
        cls,
        subject_or_ref: str,
        study_mode: str = "auto",
        config: Optional[Dict[str, Any]] = None
    ) -> List[str]:
        """
        Génère rapidement 3 à 4 questions directrices ou axes clés d'étude (plan d'attaque)
        adaptés au sujet/passage et au mode herméneutique sélectionné.
        """
        cfg = config or load_config()
        mode_labels = {
            "auto": "Général & Équilibré",
            "exegesis": "Exégèse Approfondie (structure, syntaxe, verset par verset)",
            "historical": "Contexte Historique & Culturel (monde antique, archéologie)",
            "sermon": "Préparation de Prédication (idée maîtresse, applications concrètes)",
            "theology": "Théologie Systématique & Débats (enjeux doctrinaux, histoire des idées)",
            "lexical": "Analyse Lexicale (racines grecques/hébraïques, Strong, nuances)"
        }
        mode_str = mode_labels.get(study_mode, "Analyse Théologique")

        # Extraction textuelle si c'est un passage biblique
        passage_snippet = cls._try_extract_passage_text(subject_or_ref, cfg)
        context_hint = f"\nTexte biblique associé :\n{passage_snippet[:800]}\n" if passage_snippet else ""

        from core.config import DEFAULT_AUDIO_STUDIO_AXES_SYSTEM_PROMPT
        base_prompt = cfg.get("prompt_audio_studio_axes") or DEFAULT_AUDIO_STUDIO_AXES_SYSTEM_PROMPT
        sys_prompt = f"{base_prompt}\n\nAngle herméneutique imposé pour cette émission : {mode_str}."

        user_prompt = (
            f"Sujet ou passage : {subject_or_ref}{context_hint}\n"
            f"Propose 3 ou 4 axes / questions clés pour l'émission."
        )

        primary_model = cfg.get("audio_studio_axes_model") or cfg.get("chat_model", "gemini-3.7-flash")
        fallback_model = cfg.get("audio_studio_axes_fallback_model") or cfg.get("chat_fallback_model", "gemini-3.5-flash-lite")
        models_to_try = [primary_model]
        if fallback_model and fallback_model != primary_model:
            models_to_try.append(fallback_model)

        for m_name in models_to_try:
            try:
                client, _, _ = cls._create_llm_client_for_model(m_name, cfg)
                if not client:
                    continue
                raw = client.chat(messages=[{"role": "user", "content": user_prompt}], system_prompt=sys_prompt)
                data = cls._clean_and_parse_json(raw)
                questions = data.get("focus_questions", [])
                if isinstance(questions, list) and len(questions) > 0:
                    clean_q = [re.sub(r'^\d+[\s.)-]+\s*', '', str(q)).strip() for q in questions if str(q).strip()]
                    return clean_q[:5]
            except Exception as e_m:
                logger.warning("[PodcastEngine] Échec suggest_focus_questions avec modèle %s : %s", m_name, e_m)

        return [
            f"Analyse littéraire et contexte historique de {subject_or_ref}",
            f"Thèmes théologiques majeurs et articulations du texte",
            f"Portée existentielle et implications contemporaines"
        ]

    @classmethod
    def generate_script(
        cls,
        subject_or_ref: str,
        format_type: str = "dialogue",  # "dialogue" | "solo"
        sources_options: Optional[Dict[str, Any]] = None,
        config: Optional[Dict[str, Any]] = None,
        db_instance: Any = None,
        provider: Optional[str] = None,
        model: Optional[str] = None,
        study_mode: str = "auto",
        focal_questions: Optional[List[str]] = None,
        progress_callback: Optional[Callable[[int, str], None]] = None
    ) -> Dict[str, Any]:
        """
        Génère le script textuel structuré en JSON strict (Transcript-First).
        """
        cfg = config or load_config()
        format_clean = "solo" if format_type == "solo" else "dialogue"

        if isinstance(sources_options, dict):
            if not study_mode or study_mode == "auto":
                study_mode = sources_options.get("study_mode", study_mode)
            if not focal_questions:
                focal_questions = sources_options.get("focal_questions", focal_questions)

        # 1. Récupération du prompt système de base
        if format_clean == "solo":
            system_prompt = cfg.get("prompt_audio_studio_solo") or DEFAULT_AUDIO_STUDIO_SOLO_PROMPT
        else:
            system_prompt = cfg.get("prompt_audio_studio_dialogue") or DEFAULT_AUDIO_STUDIO_DIALOGUE_PROMPT

        # 2. Construction du contexte herméneutique sourcé
        corpus_context = cls.build_context(subject_or_ref, sources_options, cfg, db_instance, progress_callback=progress_callback)

        if not corpus_context:
            corpus_context = f"Sujet d'étude : {subject_or_ref}\n(Analyse basée sur les textes bibliques et théologiques associés)."

        # Instructions spécifiques selon le mode d'étude sélectionné
        mode_directives = {
            "exegesis": cfg.get("prompt_exegesis") or DEFAULT_EXEGESIS_SYSTEM_PROMPT,
            "historical": cfg.get("prompt_historical") or DEFAULT_HISTORICAL_SYSTEM_PROMPT,
            "sermon": cfg.get("prompt_sermon") or DEFAULT_SERMON_SYSTEM_PROMPT,
            "theology": cfg.get("prompt_theology") or DEFAULT_THEOLOGY_SYSTEM_PROMPT,
            "lexical": cfg.get("prompt_lexical") or DEFAULT_LEXICAL_SYSTEM_PROMPT,
        }
        mode_instruction = mode_directives.get(study_mode, "")
        mode_title = {
            "auto": "Détection Automatique & Synthèse Complète",
            "exegesis": "Exégèse Approfondie & Analyse Textuelle",
            "historical": "Contexte Historique, Archéologique & Culturel",
            "sermon": "Préparation de Prédication & Application Pastorale",
            "theology": "Théologie Systématique & Débats Doctrinaux",
            "lexical": "Analyse Lexicale & Langues Originales (Grec/Hébreu)"
        }.get(study_mode, "Étude Théologique")

        mode_block = ""
        if mode_instruction:
            mode_block = (
                f"ORIENTATION SPÉCIFIQUE DU MODE D'ÉTUDE CHOISI : **{mode_title.upper()}**\n"
                f"Adoptez rigoureusement l'angle méthodologique suivant dans le contenu des explications et des interventions :\n"
                f"{mode_instruction}\n\n"
            )

        focal_block = ""
        if focal_questions and len(focal_questions) > 0:
            lines = [f"- {q}" for q in focal_questions if q.strip()]
            if lines:
                focal_block = (
                    "AXES DIRECTEURS ET QUESTIONS CLÉS DÉCIDÉS PAR L'UTILISATEUR (FIL CONDUCTEUR DE L'ÉMISSION) :\n"
                    + "\n".join(lines) + "\n"
                    "-> Veillez à articuler l'échange de manière à traiter méthodiquement chacun de ces axes au fil du dialogue ou de la chronique.\n\n"
                )

        if format_clean == "solo":
            format_instruction = (
                "FORMAT DEMANDÉ : **CHRONIQUE THÉOLOGIQUE SOLO (UN SEUL ORATEUR)**\n"
                "- Il n'y a qu'UN SEUL orateur enseignant/pasteur ('narrator').\n"
                "- AUCUN dialogue, AUCUNE animatrice, AUCUN échange de questions-réponses.\n"
                "- Rédigez le script sous la forme d'un exposé oral continu et chaleureux, découpé en 8 à 14 sections thématiques suivies.\n"
                "- Dans le JSON, chaque élément du tableau 'dialogue' doit avoir 'speaker': 'narrator', 'speaker_name': 'Henri', 'voice_role': 'solo'.\n\n"
            )
        else:
            format_instruction = (
                "FORMAT DEMANDÉ : **DIALOGUE EN DUO (DEUX INTERVENANTS DISTINCTS)**\n"
                "- Locuteur A ('host' / Denise) : pose les questions, anime et relance.\n"
                "- Locuteur B ('scholar' / Henri) : répond de façon développée et érudite.\n"
                "- Alternez obligatoirement entre 'host' et 'scholar' à chaque réplique.\n\n"
            )

        phonetic_rule = (
            "EXIGENCE IMPÉRATIVE DE PRONONCIATION AUDIO DES RÉFÉRENCES BIBLIQUES :\n"
            "- Ne JAMAIS écrire les références sous la forme chiffrée avec deux-points (ex: 'Romains 2:1', 'Jean 3:16' ou '2:4'), car les moteurs de synthèse vocale les lisent comme des heures ('2 heures 1', '3 heures 16', '2 heures 4') !\n"
            "- Écrivez TOUJOURS les références bibliques intégralement en toutes lettres :\n"
            "  * 'Romains chapitre 2, verset 1' au lieu de 'Romains 2:1'\n"
            "  * 'Jean chapitre 3, verset 16' au lieu de 'Jean 3:16'\n"
            "  * 'versets 1 à 5' au lieu de 'v. 1-5' ou '1-5'\n"
            "  * 'chapitre 2' au lieu de 'ch. 2' ou 'chap. 2'\n"
            "  * 'après Jésus-Christ' / 'avant Jésus-Christ' au lieu de 'apr. J.-C.' / 'av. J.-C.'\n\n"
        )

        user_prompt = (
            f"Voici le corpus documentaire et les extraits d'étude sur lesquels baser STRICTEMENT l'émission :\n\n"
            f"--- DÉBUT DU CORPUS DOCUMENTAIRE ---\n"
            f"{corpus_context}\n"
            f"--- FIN DU CORPUS DOCUMENTAIRE ---\n\n"
            f"Sujet ou passage ciblé : **{subject_or_ref}**\n"
            f"Mode d'étude appliqué : **{mode_title}**\n\n"
            f"{format_instruction}"
            f"{phonetic_rule}"
            f"{mode_block}"
            f"{focal_block}"
            f"EXIGENCE CRITIQUE DE LONGUEUR ET DE PROFONDEUR EXÉGÉTIQUE :\n"
            f"- Produisez une émission consistante, substantielle et approfondie, avec la même rigueur et le même niveau d'érudition que l'Assistant d'Étude d'Open Shema.\n"
            f"- Développez au moins 12 à 18 répliques substantielles (pour un dialogue) ou 8 à 12 sections développées (pour une chronique solo).\n"
            f"- Ne vous limitez pas à un survol : parcourez le contexte littéraire et historique, décortiquez les termes grecs/hébreux clés, confrontez les avis des commentateurs fournis et dégagez les enjeux théologiques profonds.\n\n"
            f"Rappels impératifs :\n"
            f"- Basez l'émission UNIQUEMENT sur les extraits ci-dessus (zéro hallucination).\n"
            f"- Renvoyez UNIQUEMENT l'objet JSON valide avec les clés 'title', 'summary', 'sources_cited', 'dialogue'. Pas de markdown autour."
        )

        # 3. Résolution du LLM et exécution avec fallback
        primary_model = model or cfg.get("audio_studio_script_model") or cfg.get("chat_model", "gemini-3.7-flash")
        fallback_model = cfg.get("audio_studio_script_fallback_model") or cfg.get("chat_fallback_model", "gemini-3.5-flash-lite")
        models_to_try = [primary_model]
        if fallback_model and fallback_model != primary_model:
            models_to_try.append(fallback_model)

        raw_response = None
        last_error = None
        if progress_callback:
            progress_callback(80, f"Rédaction de l'émission par l'IA ({primary_model})...")

        for m_name in models_to_try:
            try:
                client, _, _ = cls._create_llm_client_for_model(m_name, cfg)
                if not client:
                    continue
                raw_response = client.chat(
                    messages=[{"role": "user", "content": user_prompt}],
                    system_prompt=system_prompt
                )
                if raw_response and raw_response.strip():
                    break
            except Exception as e_gen:
                logger.warning("[PodcastEngine] Échec génération script avec modèle %s : %s", m_name, e_gen)
                last_error = e_gen

        if not raw_response or not raw_response.strip():
            if last_error:
                raise last_error
            raise Exception("Aucune clé API IA (Google Gemini, Mistral ou Infomaniak) n'a pu générer le script audio.")

        if progress_callback:
            progress_callback(95, "Validation et structuration du script...")

        # 4. Nettoyage et parsing JSON
        parsed_script = cls._clean_and_parse_json(raw_response)
        
        # 5. Normalisation des répliques
        script_id = f"pod_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}"
        dialogue_items = parsed_script.get("dialogue", [])
        clean_dialogue = []
        
        default_pause = int(cfg.get("audio_studio_pause_ms", 350))

        for idx, item in enumerate(dialogue_items):
            raw_spk = str(item.get("speaker", "")).lower()
            raw_role = str(item.get("voice_role", "")).upper()

            if format_clean == "solo":
                speaker_role = "solo"
                speaker_name = "Henri"
                speaker_val = "narrator"
            else:
                if raw_role == "A" or raw_spk in ("host", "animateur", "animatrice", "denise"):
                    speaker_role = "A"
                    speaker_name = "Denise"
                    speaker_val = "host"
                elif raw_role == "B" or raw_spk in ("scholar", "théologien", "theologien", "exégète", "exegete", "chercheur", "henri"):
                    speaker_role = "B"
                    speaker_name = "Henri"
                    speaker_val = "scholar"
                else:
                    speaker_role = "A" if (idx % 2 == 0) else "B"
                    speaker_name = "Denise" if speaker_role == "A" else "Henri"
                    speaker_val = "host" if speaker_role == "A" else "scholar"

            # Nettoyer et normaliser le texte (notamment les références bibliques)
            norm_text = cls._clean_text_for_speech(str(item.get("text", "")).strip())

            clean_dialogue.append({
                "index": idx,
                "speaker": speaker_val,
                "speaker_name": speaker_name,
                "voice_role": speaker_role,
                "text": norm_text,
                "pause_after_ms": int(item.get("pause_after_ms", default_pause)),
                "start_time": 0.0,
                "end_time": 0.0
            })

        podcast_record = {
            "id": script_id,
            "title": parsed_script.get("title") or f"{'Chronique' if format_clean == 'solo' else 'Échange'} — {subject_or_ref}",
            "summary": parsed_script.get("summary") or "",
            "subject": subject_or_ref,
            "study_mode": study_mode,
            "focal_questions": focal_questions or [],
            "format": format_clean,
            "format_type": format_clean,
            "engine": cfg.get("audio_studio_engine", "edge_tts"),
            "created_at": datetime.datetime.now().isoformat(),
            "sources_cited": parsed_script.get("sources_cited", []),
            "dialogue": clean_dialogue,
            "script_dialogue": clean_dialogue,
            "status": "script_only",
            "audio_file": None,
            "duration_seconds": 0.0
        }

        # Sauvegarder dans l'historique
        PodcastHistory.upsert(podcast_record)
        if progress_callback:
            progress_callback(100, "Script audio rédigé avec succès !")
        return podcast_record

    @classmethod
    def _clean_and_parse_json(cls, text: str) -> Dict[str, Any]:
        """Extrait et désérialise un JSON valide à partir d'une réponse textuelle potentiellement bruitée."""
        if not text or not str(text).strip():
            raise Exception("Le modèle IA a renvoyé une réponse vide.")

        clean = str(text).strip()

        # Si le LLM a renvoyé une chaîne d'erreur explicite
        if clean.startswith("Erreur ") or clean.startswith("Erreur:") or clean.startswith("Error:"):
            logger.error("[PodcastEngine] Réponse d'erreur du LLM reçue : %s", clean)
            raise Exception(clean)

        # 1. Extraction d'un bloc ```json ... ``` ou ``` ... ```
        fence_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", clean, re.DOTALL)
        if fence_match:
            candidate = fence_match.group(1).strip()
        else:
            # 2. Chercher la première accolade ouvrante et la dernière fermante
            first_brace = clean.find("{")
            last_brace = clean.rfind("}")
            if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
                candidate = clean[first_brace:last_brace + 1].strip()
            else:
                logger.error("[PodcastEngine] Aucun objet JSON trouvé dans la réponse : %s", clean[:300])
                raise Exception(f"Le modèle IA n'a pas renvoyé de format JSON valide. Réponse reçue : {clean[:120]}...")

        # 3. Essai de parsing standard direct
        try:
            return json.loads(candidate)
        except Exception as e1:
            logger.warning("[PodcastEngine] Parsing JSON direct échoué (%s), tentative de nettoyage...", e1)

        # 4. Suppression des virgules traînantes avant } ou ]
        repaired = re.sub(r",\s*([\]}])", r"\1", candidate)
        try:
            return json.loads(repaired)
        except Exception:
            pass

        # 5. Assainissement des sauts de ligne et tabulations brutes à l'intérieur des chaînes
        try:
            result = []
            in_string = False
            escape = False
            for char in repaired:
                if char == '"' and not escape:
                    in_string = not in_string
                    result.append(char)
                elif char == '\\':
                    escape = not escape
                    result.append(char)
                elif char == '\n' and in_string:
                    result.append('\\n')
                elif char == '\r' and in_string:
                    pass
                elif char == '\t' and in_string:
                    result.append('\\t')
                else:
                    result.append(char)
                if char != '\\':
                    escape = False
            sanitized = "".join(result)
            return json.loads(sanitized)
        except Exception:
            pass

        # 6. Fallback par extraction regex de toutes les répliques
        try:
            title_m = re.search(r'"title"\s*:\s*"([^"]+)"', candidate)
            summary_m = re.search(r'"summary"\s*:\s*"([^"]+)"', candidate)

            turn_pattern = re.compile(
                r'\{\s*"speaker"\s*:\s*"([^"]+)"\s*,\s*'
                r'(?:"speaker_name"\s*:\s*"([^"]+)"\s*,\s*)?'
                r'(?:"voice_role"\s*:\s*"([^"]+)"\s*,\s*)?'
                r'"text"\s*:\s*"((?:[^"\\]|\\.)*)"',
                re.DOTALL
            )
            dialogue_extracted = []
            for m in turn_pattern.finditer(candidate):
                spk = m.group(1)
                name = m.group(2) or ("Denise" if spk in ("host", "animatrice") else "Henri")
                role = m.group(3) or ("A" if spk in ("host", "animatrice") else "B")
                txt = m.group(4).replace('\\"', '"').replace('\\n', ' ')
                dialogue_extracted.append({
                    "speaker": spk,
                    "speaker_name": name,
                    "voice_role": role,
                    "text": txt
                })

            if dialogue_extracted:
                logger.info("[PodcastEngine] Récupération réussie par regex de %d répliques !", len(dialogue_extracted))
                return {
                    "title": title_m.group(1) if title_m else "Échange biblique",
                    "summary": summary_m.group(1) if summary_m else "",
                    "sources_cited": [],
                    "dialogue": dialogue_extracted
                }
        except Exception as e_regex:
            logger.error("[PodcastEngine] Fallback regex échoué : %s", e_regex)

        logger.error("[PodcastEngine] Échec définitif du parsing JSON.\nTexte reçu : %s", clean[:400])
        raise Exception(f"Le modèle IA n'a pas renvoyé un format JSON exploitable. Réponse : {clean[:100]}...")


    @classmethod
    def _transliterate_greek_for_speech(cls, text: str) -> str:
        """Translittère le grec ancien (unicode) vers une phonétique française naturelle."""
        import unicodedata
        greek_pattern = re.compile(r'[\u0370-\u03FF\u1F00-\u1FFF]+')
        if not greek_pattern.search(text):
            return text

        greek_map = {
            'α': 'a', 'β': 'b', 'γ': 'g', 'δ': 'd', 'ε': 'è', 'ζ': 'z', 'η': 'é', 'θ': 'th',
            'ι': 'i', 'κ': 'k', 'λ': 'l', 'μ': 'm', 'ν': 'n', 'ξ': 'x', 'ο': 'o', 'π': 'p',
            'ρ': 'r', 'σ': 's', 'ς': 'ss', 'τ': 't', 'υ': 'u', 'φ': 'f', 'χ': 'k', 'ψ': 'ps', 'ω': 'o'
        }

        def _replace_word(m):
            w = m.group(0)
            w_norm = unicodedata.normalize('NFD', w.lower())
            clean = ''
            for ch in w_norm:
                if ch in ('\u0300', '\u0301', '\u0342', '\u0304', '\u0306', '\u0313'):
                    continue
                if ch == '\u0314':  # esprit rude -> h
                    clean += 'h'
                elif ch in greek_map or ('a' <= ch <= 'z'):
                    clean += ch

            clean = clean.replace('ου', 'ou').replace('αι', 'è').replace('ει', 'i').replace('οι', 'oi').replace('υι', 'ui')
            clean = clean.replace('γγ', 'ng').replace('γκ', 'nk').replace('γχ', 'nkh').replace('γξ', 'nx')
            out = []
            for i, c in enumerate(clean):
                if c == 'σ':
                    if (i > 0 and clean[i - 1] in 'aeiouyèé') and (i < len(clean) - 1 and clean[i + 1] in 'aeiouyèé'):
                        out.append('ss')
                    else:
                        out.append('s')
                elif c == 'ς':
                    out.append('ss')
                else:
                    out.append(greek_map.get(c, c))
            res = ''.join(out)
            if res.endswith('s') and not res.endswith('ss'):
                res += 's'
            return res

        return greek_pattern.sub(_replace_word, text)

    @classmethod
    def _transliterate_hebrew_for_speech(cls, text: str) -> str:
        """Translittère l'hébreu (unicode) vers une phonétique française naturelle."""
        import unicodedata
        hebrew_pattern = re.compile(r'[\u0590-\u05FF]+')
        if not hebrew_pattern.search(text):
            return text

        hebrew_map = {
            'א': '', 'ב': 'b', 'ג': 'g', 'ד': 'd', 'ה': 'h', 'ו': 'v', 'ז': 'z',
            'ח': 'kh', 'ט': 't', 'י': 'y', 'כ': 'k', 'ך': 'k', 'ל': 'l', 'מ': 'm',
            'ם': 'm', 'נ': 'n', 'ן': 'n', 'ס': 'ss', 'ע': '', 'פ': 'p', 'ף': 'f',
            'צ': 'ts', 'ץ': 'ts', 'ק': 'k', 'ר': 'r', 'ש': 'ch', 'ת': 't'
        }
        vowel_map = {
            '\u05B0': 'e', '\u05B1': 'e', '\u05B2': 'a', '\u05B3': 'o',
            '\u05B4': 'i', '\u05B5': 'é', '\u05B6': 'è', '\u05B7': 'a',
            '\u05B8': 'a', '\u05B9': 'o', '\u05BA': 'o', '\u05BB': 'ou'
        }

        def _replace_heb(m):
            w = m.group(0)
            w_norm = unicodedata.normalize('NFD', w)
            res = []
            for ch in w_norm:
                if ch in vowel_map:
                    res.append(vowel_map[ch])
                elif ch in hebrew_map:
                    res.append(hebrew_map[ch])
            return ''.join(res) or 'mot hébreu'

        return hebrew_pattern.sub(_replace_heb, text)

    @classmethod
    def _clean_biblical_transliterations_for_speech(cls, text: str) -> str:
        """Adapte les termes translittérés grecs et hébreux pour la voix neuronale française."""
        # 1. Termes avec suffixes verbaux en -eô (kataphroneô, phroneô, dikaioô...)
        text = re.sub(r'\b([A-Za-zÀ-ÿ]+)phrone[ôo]\b', r'\1fronéo', text, flags=re.I)
        text = re.sub(r'\bphrone[ôo]\b', 'fronéo', text, flags=re.I)
        text = re.sub(r'\b([A-Za-zÀ-ÿ]+)e[ôo]\b', r'\1éo', text, flags=re.I)
        text = re.sub(r'\b([A-Za-zÀ-ÿ]+)o[ôo]\b', r'\1o-o', text, flags=re.I)

        # 2. Termes avec kh grec (anokhê, anekhô)
        text = re.sub(r'\banokh[êe]\b', 'anoké', text, flags=re.I)
        text = re.sub(r'\banekh[ôo]\b', 'anéko', text, flags=re.I)

        # 3. Termes grecs avec chr- / char- (chrêstotês, christos, charis...)
        text = re.sub(r'\bchr[êe]stot[êe]s\b', 'kréstotèss', text, flags=re.I)
        text = re.sub(r'\bchr[êe]st[oô]s\b', 'kréstoss', text, flags=re.I)
        text = re.sub(r'\bchristos\b', 'kristoss', text, flags=re.I)
        text = re.sub(r'\bcharis\b', 'kariss', text, flags=re.I)
        text = re.sub(r'\bchiasme\b', 'kiasme', text, flags=re.I)
        text = re.sub(r'\bchara\b', 'kara', text, flags=re.I)

        # 4. Suffixes grecs en -ês (chrêstotês, makrothumia -> makrothumia)
        text = re.sub(r'([A-Za-zÀ-ÿ]{3,})[êe]s\b', r'\1èss', text)
        # Suffixes en -os ou -is (pistis -> pistiss, nomos -> nomoss, logos -> logoss)
        text = re.sub(r'\bpistis\b', 'pistiss', text, flags=re.I)
        text = re.sub(r'\bnomos\b', 'nomoss', text, flags=re.I)
        text = re.sub(r'\blogos\b', 'logoss', text, flags=re.I)
        text = re.sub(r'\bkosmos\b', 'kosmoss', text, flags=re.I)
        text = re.sub(r'\bagape\b', 'agapé', text, flags=re.I)
        text = re.sub(r'\bagap[êe]\b', 'agapé', text, flags=re.I)
        text = re.sub(r'\bmetanoia\b', 'métanoïa', text, flags=re.I)
        text = re.sub(r'\bkoinonia\b', 'koïnonia', text, flags=re.I)
        text = re.sub(r'\bploutos\b', 'ploutoss', text, flags=re.I)
        text = re.sub(r'\bkataphroneo\b', 'katafronéo', text, flags=re.I)

        # 5. Termes hébreux classiques
        text = re.sub(r'\b(h|ch)esed\b', 'khèssèd', text, flags=re.I)
        text = re.sub(r'\bberit\b', 'béritt', text, flags=re.I)
        text = re.sub(r'\brua(ch|h)\b', 'rouakh', text, flags=re.I)
        text = re.sub(r'\bsh(e|a)lom\b', 'chalom', text, flags=re.I)
        text = re.sub(r'\btorah\b', 'tora', text, flags=re.I)
        text = re.sub(r'\byahweh\b', 'yavé', text, flags=re.I)
        text = re.sub(r'\b(y|j)hwh\b', 'yavé', text, flags=re.I)
        text = re.sub(r'\badonai\b', 'adonaï', text, flags=re.I)
        text = re.sub(r'\belohim\b', 'élohim', text, flags=re.I)
        text = re.sub(r'\bshema\b', 'chéma', text, flags=re.I)
        text = re.sub(r'\bnefesh\b', 'nèfèch', text, flags=re.I)
        text = re.sub(r'\bgoel\b', 'go-èl', text, flags=re.I)

        return text

    @classmethod
    def _clean_text_for_speech(cls, text: str) -> str:
        """
        Normalise phonétiquement le texte pour éviter les bévues de lecture des moteurs TTS.
        Ex: 'Romains 2:1-5' -> 'Romains chapitre 2, versets 1 à 5' (au lieu de '2 heures 1 à 5')
        Ex: 'Jean 3:16' -> 'Jean chapitre 3, verset 16' (au lieu de '3 heures 16')
        Ex: 'kataphroneô' -> 'katafronéo', 'chrêstotês' -> 'kréstotèss', 'anokhê' -> 'anoké'
        """
        if not text:
            return ""

        # 1. Remplacer 'Livre Chapitre:Verset-Fin' (ex: Romains 2:1-5)
        text = re.sub(
            r'\b([1-3]?\s*[A-Za-zÀ-ÿ]+)\s+(\d+)[:\s]+(\d+)\s*[-–—]\s*(\d+)\b',
            r'\1 chapitre \2, versets \3 à \4',
            text
        )
        # 2. Remplacer 'Livre Chapitre:Verset' (ex: Romains 2:4)
        text = re.sub(
            r'\b([1-3]?\s*[A-Za-zÀ-ÿ]+)\s+(\d+):(\d+)\b',
            r'\1 chapitre \2, verset \3',
            text
        )
        # 3. Remplacer les références sans nom de livre (ex: '2:1-5' ou '2:1')
        text = re.sub(
            r'\b(\d+):(\d+)\s*[-–—]\s*(\d+)\b',
            r'chapitre \1, versets \2 à \3',
            text
        )
        text = re.sub(
            r'\b(\d+):(\d+)\b',
            r'chapitre \1, verset \2',
            text
        )
        # 4. Abréviations courantes
        text = re.sub(r'\b[Vv]{2}\.\s*(\d+)\s*[-–—]\s*(\d+)', r'versets \1 à \2', text)
        text = re.sub(r'\b[Vv]\.\s*(\d+)', r'verset \1', text)
        text = re.sub(r'\b[Cc]hap\.\s*(\d+)', r'chapitre \1', text)
        text = re.sub(r'\b[Cc]h\.\s*(\d+)', r'chapitre \1', text)
        text = re.sub(r'\b1er\b', 'premier', text)
        text = re.sub(r'\b1ère\b', 'première', text)
        text = re.sub(r'\b[Aa]v\.\s*J\.-?C\.\b', 'avant Jésus-Christ', text)
        text = re.sub(r'\b[Aa]pr\.\s*J\.-?C\.\b', 'après Jésus-Christ', text)
        text = re.sub(r'\bA\.T\.\b', 'Ancien Testament', text)
        text = re.sub(r'\bN\.T\.\b', 'Nouveau Testament', text)
        text = re.sub(r'\bLXX\b', 'la Septante', text)

        # 5. Translittération du grec et de l'hébreu en caractères originaux
        text = cls._transliterate_greek_for_speech(text)
        text = cls._transliterate_hebrew_for_speech(text)

        # 6. Adaptation phonétique des termes translittérés grecs et hébreux
        text = cls._clean_biblical_transliterations_for_speech(text)

        return text

    @classmethod
    def synthesize_audio(
        cls,
        podcast_id: str,
        script_dialogue: Optional[List[Dict[str, Any]]] = None,
        engine: Optional[str] = None,
        custom_options: Optional[Dict[str, Any]] = None,
        progress_callback: Optional[Callable[[int, int, str], None]] = None
    ) -> Dict[str, Any]:
        """
        Synthétise l'audio pour un script donné (avec support de l'édition manuelle préalable).
        Calcule les horodatages exacts (karaoké) et écrit le fichier MP3 consolidé.
        """
        record = PodcastHistory.get(podcast_id)
        if not record:
            f_val = (custom_options.get("format_type") or custom_options.get("format")) if custom_options else "dialogue"
            record = {
                "id": podcast_id,
                "title": "Script Audio",
                "format": f_val,
                "format_type": f_val,
                "created_at": datetime.datetime.now().isoformat(),
                "script_dialogue": script_dialogue or []
            }
            PodcastHistory.upsert(record)
        elif custom_options and ("format_type" in custom_options or "format" in custom_options):
            f_val = custom_options.get("format_type") or custom_options.get("format")
            record["format"] = f_val
            record["format_type"] = f_val
            PodcastHistory.upsert(record)

        cfg = load_config()
        dialogue = script_dialogue if script_dialogue is not None else record.get("dialogue", [])
        if not dialogue:
            raise Exception("Le script ne contient aucune réplique à synthétiser.")

        chosen_engine = engine or record.get("engine") or cfg.get("audio_studio_engine", "edge_tts")
        opts = custom_options or {}

        if chosen_engine == "voxtral":
            res = cls._synthesize_voxtral(podcast_id, record, dialogue, opts, cfg, progress_callback)
        else:
            res = cls._synthesize_edge_tts(podcast_id, record, dialogue, opts, cfg, progress_callback)

        return res

    @classmethod
    def _synthesize_edge_tts(
        cls,
        podcast_id: str,
        record: Dict[str, Any],
        dialogue: List[Dict[str, Any]],
        opts: Dict[str, Any],
        cfg: Dict[str, Any],
        progress_callback: Optional[Callable[[int, int, str], None]] = None
    ) -> Dict[str, Any]:
        """Synthèse asynchrone via Microsoft Edge-TTS avec calcul d'horodatage exact."""
        import edge_tts

        voice_a = opts.get("voice_speaker_a") or cfg.get("audio_studio_voice_speaker_a", "fr-FR-DeniseNeural")
        voice_b = opts.get("voice_speaker_b") or cfg.get("audio_studio_voice_speaker_b", "fr-FR-HenriNeural")
        voice_solo = opts.get("voice_solo") or cfg.get("audio_studio_voice_solo", "fr-FR-HenriNeural")

        total_lines = len(dialogue)
        accumulated_audio = bytearray()
        updated_dialogue = []
        current_timeline_sec = 0.0

        async def _run_edge_synthesis():
            nonlocal accumulated_audio, current_timeline_sec, updated_dialogue

            for idx, item in enumerate(dialogue):
                if progress_callback:
                    pct = int(8 + (idx / max(total_lines, 1)) * 84)
                    speaker_label = item.get("speaker_name", f"Locuteur {item.get('voice_role', 'A')}")
                    progress_callback(idx + 1, pct, f"Synthèse réplique {idx + 1}/{total_lines} ({speaker_label})...")

                text = item.get("text", "").strip()
                if not text:
                    continue

                v_role = str(item.get("voice_role", "")).upper()
                spk = str(item.get("speaker", "")).lower()
                fmt = str(record.get("format_type") or record.get("format") or "").lower()

                # Sélection rigoureuse de la voix selon rôle ou locuteur
                if fmt == "solo" and v_role != "B" and not any(k in spk for k in ("scholar", "théolog", "exég")):
                    chosen_voice = voice_solo
                elif v_role in ("B", "SCHOLAR") or any(k in spk for k in ("scholar", "théologien", "theologien", "exégète", "exegete", "chercheur", "henri")):
                    chosen_voice = voice_b
                elif v_role in ("A", "HOST", "ANIMATEUR") or any(k in spk for k in ("host", "animateur", "animatrice", "denise")):
                    chosen_voice = voice_a
                else:
                    # En dernier recours : alternance A/B selon la position de la réplique
                    chosen_voice = voice_a if (idx % 2 == 0) else voice_b

                # Nettoyage phonétique (ex: Romains 2:1 -> Romains chapitre 2, verset 1)
                clean_speech_text = cls._clean_text_for_speech(text)

                communicate = edge_tts.Communicate(clean_speech_text, chosen_voice)
                line_audio = bytearray()
                line_duration = 0.0

                async for chunk in communicate.stream():
                    if chunk["type"] == "audio":
                        line_audio.extend(chunk["data"])
                    elif chunk["type"] == "SentenceBoundary":
                        # Calculer la durée maximale rapportée par le flux
                        chunk_dur = (chunk["offset"] + chunk["duration"]) / 10000000.0
                        if chunk_dur > line_duration:
                            line_duration = chunk_dur

                # Si SentenceBoundary n'a pas fourni de durée fiable, estimer par le bitrate (48 kbps = 6000 o/s)
                if line_duration <= 0.0 and len(line_audio) > 0:
                    line_duration = len(line_audio) / 6000.0

                start_t = round(current_timeline_sec, 3)
                end_t = round(start_t + line_duration, 3)

                accumulated_audio.extend(line_audio)

                # Pause après la réplique
                pause_ms = int(item.get("pause_after_ms", cfg.get("audio_studio_pause_ms", 350)))
                pause_sec = pause_ms / 1000.0
                current_timeline_sec = end_t + pause_sec

                # Injecter quelques trames MP3 silencieuses pour la pause si supérieure à 100ms
                if pause_ms >= 100:
                    silence_frames = cls._generate_mp3_silence(pause_ms)
                    accumulated_audio.extend(silence_frames)

                new_item = dict(item)
                new_item["start_time"] = start_t
                new_item["end_time"] = end_t
                updated_dialogue.append(new_item)

        # Exécuter la coroutine asynchrone
        try:
            asyncio.run(_run_edge_synthesis())
        except Exception as e:
            logger.error("[PodcastEngine] Erreur synthèse Edge-TTS : %s", e)
            raise Exception(f"Erreur lors de la synthèse vocale Edge-TTS : {str(e)}")

        if progress_callback:
            progress_callback(total_lines, 95, "Consolidation du fichier MP3 et calcul des temps...")

        # Écriture du fichier MP3 consolidé
        audio_filename = f"{podcast_id}.mp3"
        out_path = os.path.join(get_podcasts_dir(), audio_filename)
        with open(out_path, "wb") as f:
            f.write(accumulated_audio)

        total_duration = round(current_timeline_sec, 2)

        # Mettre à jour l'enregistrement d'historique
        record["dialogue"] = updated_dialogue
        record["script_dialogue"] = updated_dialogue
        record["audio_file"] = audio_filename
        record["duration_seconds"] = total_duration
        record["engine"] = "edge_tts"
        record["voice_speaker_a"] = voice_a
        record["voice_speaker_b"] = voice_b
        record["voice_solo"] = voice_solo
        record["status"] = "ready"
        record["updated_at"] = datetime.datetime.now().isoformat()

        PodcastHistory.upsert(record)

        if progress_callback:
            progress_callback(total_lines, 100, f"Épisode finalisé avec succès ({cls.format_duration(total_duration)})")

        return record

    @classmethod
    def _synthesize_voxtral(
        cls,
        podcast_id: str,
        record: Dict[str, Any],
        dialogue: List[Dict[str, Any]],
        opts: Dict[str, Any],
        cfg: Dict[str, Any],
        progress_callback: Optional[Callable[[int, int, str], None]] = None
    ) -> Dict[str, Any]:
        """Synthèse Voxtral : mappe fidèlement les voix sélectionnées et sauvegarde l'enregistrement Voxtral."""
        mapped_opts = dict(opts)
        raw_a = opts.get("voxtral_voice_speaker_a") or opts.get("voice_speaker_a") or cfg.get("audio_studio_voxtral_voice_speaker_a", "voxtral-celeste")
        raw_b = opts.get("voxtral_voice_speaker_b") or opts.get("voice_speaker_b") or cfg.get("audio_studio_voxtral_voice_speaker_b", "voxtral-aurelien")
        raw_solo = opts.get("voxtral_voice_solo") or opts.get("voice_solo") or cfg.get("audio_studio_voxtral_voice_solo", "voxtral-aurelien")

        mapped_opts["voice_speaker_a"] = cls.VOXTRAL_FALLBACK_MAP.get(raw_a, raw_a)
        mapped_opts["voice_speaker_b"] = cls.VOXTRAL_FALLBACK_MAP.get(raw_b, raw_b)
        mapped_opts["voice_solo"] = cls.VOXTRAL_FALLBACK_MAP.get(raw_solo, raw_solo)

        res = cls._synthesize_edge_tts(podcast_id, record, dialogue, mapped_opts, cfg, progress_callback)
        res["engine"] = "voxtral"
        res["voice_speaker_a"] = raw_a
        res["voice_speaker_b"] = raw_b
        res["voice_solo"] = raw_solo
        record["engine"] = "voxtral"
        record["voice_speaker_a"] = raw_a
        record["voice_speaker_b"] = raw_b
        record["voice_solo"] = raw_solo
        PodcastHistory.upsert(record)
        return res


    @classmethod
    def _single_edge_tts_call(cls, text: str, voice: str) -> bytes:
        """Appel synchrone unitaire à Edge-TTS en secours."""
        import edge_tts
        buf = bytearray()
        async def _synth():
            c = edge_tts.Communicate(text, voice)
            async for chunk in c.stream():
                if chunk["type"] == "audio":
                    buf.extend(chunk["data"])
        try:
            asyncio.run(_synth())
        except Exception:
            pass
        return bytes(buf)

    @classmethod
    def _generate_mp3_silence(cls, duration_ms: int) -> bytes:
        """
        Génère des trames MP3 silencieuses au format 24kHz / 48kbps mono.
        Chaque trame MP3 MPEG-2 Layer 3 à 24kHz représente 576 échantillons = 24 ms.
        Une trame silencieuse standard fait 144 octets.
        """
        # Trame MPEG-2 Layer 3, 24kHz, 48kbps mono de silence absolu
        frame_size = 144
        frames_count = max(1, int(duration_ms / 24.0))
        silent_frame = b'\xff\xf3d\xc4' + b'\x00' * (frame_size - 4)
        return silent_frame * frames_count

    @classmethod
    def export_to_note(cls, podcast_id: str) -> Dict[str, Any]:
        """Exporte le script d'un podcast en une note d'étude Markdown (.md) d'Open Shema."""
        record = PodcastHistory.get(podcast_id)
        if not record:
            raise Exception("Podcast introuvable.")

        title = record.get("title", "Podcast Théologique")
        subject = record.get("subject", "")
        summary = record.get("summary", "")
        sources = record.get("sources_cited", [])
        dialogue = record.get("dialogue", [])

        md_lines = [
            f"# {title}",
            f"\n> **Sujet :** {subject}  ",
            f"> **Date :** {record.get('created_at', '')[:10]}  ",
            f"> **Format :** {'Chronique Solo' if record.get('format_type') == 'solo' else 'Dialogue Animateur / Exégète'}  ",
            f"> **Durée :** {cls.format_duration(record.get('duration_seconds', 0))}\n",
        ]

        if summary:
            md_lines.append(f"### Résumé\n{summary}\n")

        if sources:
            md_lines.append(f"### Sources consultées\n" + "\n".join([f"- {s}" for s in sources]) + "\n")

        dialogue = record.get("script_dialogue") or record.get("dialogue", [])
        md_lines.append("### Script de l'émission\n")
        for d in dialogue:
            name = d.get("speaker") or d.get("speaker_name", "Locuteur")
            text = d.get("text", "")
            md_lines.append(f"**{name} :** {text}\n")

        full_content = "\n".join(md_lines)

        # Sauvegarder via NotesManager
        try:
            from core.notes_manager import NotesManager
            notes_dir = NotesManager.get_notes_directory()
            note_title = f"Studio Audio — {title}"
            note_data = {
                "title": note_title,
                "reference": subject,
                "tags": ["podcast", "studio-audio", "exégèse"],
                "type": "text",
                "content": full_content,
                "include_in_ai": True
            }
            note_res = NotesManager.save_note_file(note_data, notes_dir)
            return {"success": True, "note": note_res, "note_title": note_title, "markdown": full_content}
        except Exception as e:
            logger.warning("[PodcastEngine] NotesManager direct non accessible, fallback : %s", e)
            return {"success": True, "note_title": f"Studio Audio — {title}", "markdown": full_content}

    @classmethod
    def format_duration(cls, seconds: float) -> str:
        s = int(seconds or 0)
        m = s // 60
        sec = s % 60
        return f"{m}:{sec:02d}"
