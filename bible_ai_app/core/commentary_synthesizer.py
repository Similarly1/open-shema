import re
import os
import json
import logging
from typing import Dict, List, Any, Optional, Tuple

from core.config import load_config
from core.commentary_loader import CommentaryLoader
from core.reference_parser import get_french_book_name
from core.bible_json_loader import BibleJsonLoader, extract_verse_text
from core.notes_manager import NotesManager
from ai.llm_client import LLMClient

logger = logging.getLogger(__name__)

class CommentarySynthesizer:
    """
    Moteur de Synthèse Exégétique Multi-Commentaires par Intelligence Artificielle.
    Extrait les commentaires bibliques sur une plage de versets, applique une curation / re-ranking
    optionnelle et produit une synthèse théologique et pastorale comparative.
    """

    @classmethod
    def get_scripture_text(cls, book_code: str, chapter: int, v_start: int, v_end: int, bible_name: str = "LSG") -> str:
        """Récupère le texte biblique des versets sélectionnés."""
        try:
            book_data = BibleJsonLoader.load_book(bible_name, book_code)
            if not book_data or "chapters" not in book_data:
                bibles = BibleJsonLoader.list_installed_bibles()
                if bibles:
                    book_data = BibleJsonLoader.load_book(bibles[0], book_code)
                    
            if not book_data:
                return ""

            verses_dict = book_data.get("chapters", {}).get(str(chapter), {})
            lines = []
            for v_num in range(v_start, v_end + 1):
                raw_v = verses_dict.get(str(v_num))
                if raw_v:
                    txt = extract_verse_text(raw_v)
                    clean_txt = re.sub(r'<[^>]+>', '', txt).strip()
                    lines.append(f"{v_num}. {clean_txt}")
            return "\n".join(lines)
        except Exception as e:
            logger.warning("Impossible d'extraire le texte biblique pour la synthèse: %s", e)
            return ""

    @classmethod
    def synthesize(
        cls,
        book_code: str,
        chapter: int,
        verse_start: int,
        verse_end: Optional[int] = None,
        model: Optional[str] = None,
        bible_name: str = "LSG"
    ) -> Dict[str, Any]:
        """
        Exécute la synthèse exégétique complète pour la plage de versets spécifiée
        en transmettant directement l'intégralité des commentaires extraits au LLM.
        """
        config = load_config()
        ch_int = int(chapter)
        v_start = min(int(verse_start), int(verse_end or verse_start))
        v_end = max(int(verse_start), int(verse_end or verse_start))

        # Respect strict du plafond de versets configuré
        max_allowed = int(config.get("synthesis_max_verses", 5))
        span = (v_end - v_start + 1)
        if span > max_allowed:
            v_end = v_start + max_allowed - 1
            span = max_allowed

        french_book = get_french_book_name(book_code)
        ref_label = f"{french_book} {ch_int}:{v_start}-{v_end}" if v_start != v_end else f"{french_book} {ch_int}:{v_start}"

        # 1. Extraction du texte biblique
        scripture = cls.get_scripture_text(book_code, ch_int, v_start, v_end, bible_name=bible_name)

        # 2. Extraction des commentaires dans la base SQLite
        comm_data = CommentaryLoader.get_all_comments_for_verse_range(book_code, ch_int, v_start, v_end)
        documents = comm_data.get("documents", [])
        metadatas = comm_data.get("metadatas", [])

        raw_comments = []
        sources_set = set()
        for i, doc in enumerate(documents):
            meta = metadatas[i] if i < len(metadatas) else {}
            auth = meta.get("name") or meta.get("author") or "Commentaire"
            sources_set.add(auth)
            raw_comments.append({
                "author": auth,
                "reference": meta.get("reference", ref_label),
                "text": doc
            })

        if not raw_comments:
            return {
                "success": False,
                "error": f"Aucun commentaire exégétique trouvé dans la base locale pour {ref_label}.",
                "reference": ref_label,
                "book_code": book_code,
                "chapter": ch_int,
                "verse_start": v_start,
                "verse_end": v_end,
                "sources_count": 0,
                "sources": []
            }

        # 3. Formatage direct de tous les commentaires extraits
        formatted = []
        for c in raw_comments:
            formatted.append(f"### Source : {c.get('author', 'Commentaire')} ({c.get('reference', ref_label)})\n{c.get('text', '').strip()}")
        context_text = "\n\n".join(formatted)

        # 4. Contexte des notes personnelles d'étude
        notes_context = NotesManager.build_ai_notes_context(passage_ref=ref_label, question="Synthèse des commentaires", config=config)

        # 5. Sélection du modèle LLM final
        target_model = model or config.get("synthesis_model") or config.get("chat_model") or "gemini-3.7-flash"
        gemini_key = config.get("gemini_api_key", "")
        mistral_key = config.get("mistral_api_key", "")
        infomaniak_token = config.get("infomaniak_token", "")

        provider = "gemini"
        api_key = gemini_key

        if target_model.startswith("mistral") and mistral_key:
            provider = "mistral"
            api_key = mistral_key
        elif "mistralai/" in target_model or "infomaniak" in target_model.lower():
            provider = "infomaniak"
            api_key = infomaniak_token
        elif not api_key and mistral_key:
            provider = "mistral"
            api_key = mistral_key
        elif not api_key and infomaniak_token:
            provider = "infomaniak"
            api_key = infomaniak_token

        if not api_key:
            # Réponse pédagogique formatée si aucune clé API n'est configurée
            synthesis_mock = (
                f"# ✨ Synthèse Exégétique : {ref_label}\n\n"
                f"> [!NOTE]\n"
                f"> **Mode Démonstration** : Aucune clé API active n'a été détectée dans vos Paramètres. "
                f"Voici la structure type générée par l'IA à partir de vos **{len(sources_set)} ouvrages de référence**.\n\n"
                f"### 📜 Texte Biblique ({bible_name})\n"
                f"*{scripture}*\n\n"
                f"### 📌 1. Consensus Exégétique & Sens Littéral\n"
                f"L'ensemble des commentateurs consultés ({', '.join(list(sources_set)[:4])}...) s'accordent sur le rôle fondamental de ce passage dans l'économie du texte. Le sens grammatical et historique met en lumière la souveraineté divine et l'intention rédemptrice.\n\n"
                f"### 🔍 2. Nuances, Divergences & Traditions Théologiques\n"
                f"- **Perspective Réformée & Historique** : Met l'accent sur l'alliance de grâce et la portée typologique.\n"
                f"- **Perspective Exégétique & Littérale** : Détaille les racines des termes originaux et la chronologie des événements.\n"
                f"- **Nuances pastorales** : Souligne la dimension pratique et spirituelle immédiate pour le croyant.\n\n"
                f"### 💡 3. Clés Textuelles & Applications Pastorales\n"
                f"1. **Vérité centrale** : Une affirmation d'espérance et de sanctification.\n"
                f"2. **Application concrète** : Vivre en conformité avec cette révélation dans la prière et l'action.\n\n"
                f"---\n"
                f"📚 **Sources analysées ({len(sources_set)})** : {', '.join(sorted(sources_set))}"
            )
            return {
                "success": True,
                "reference": ref_label,
                "book_code": book_code,
                "chapter": ch_int,
                "verse_start": v_start,
                "verse_end": v_end,
                "verse_count": span,
                "sources_count": len(sources_set),
                "sources": sorted(list(sources_set)),
                "reranking_applied": False,
                "model_used": "Démo locale (Clé API requise)",
                "synthesis": synthesis_mock,
                "scripture_text": scripture
            }

        # 6. Prompt de Synthèse Multi-Commentaires Haute Fidélité (Modifiable dans les paramètres)
        from core.config import DEFAULT_SYNTHESIS_SYSTEM_PROMPT
        system_instruction = config.get("synthesis_system_prompt") or DEFAULT_SYNTHESIS_SYSTEM_PROMPT

        user_content = (
            f"### PASSAGE BIBLIQUE ÉTUDIÉ : **{ref_label}**\n\n"
            f"**Texte biblique ({bible_name}) :**\n{scripture}\n\n"
            f"**EXTRAITS DES {len(sources_set)} COMMENTAIRES DISPONIBLES :**\n"
            f"{context_text}\n\n"
            f"{notes_context}\n\n"
            f"Rédigez la synthèse exégétique comparative selon le plan demandé :"
        )

        try:
            models_to_try = [target_model]
            fallback_model = config.get("synthesis_fallback_model")
            if fallback_model and fallback_model != target_model:
                models_to_try.append(fallback_model)

            synthesis_text = None
            used_model_name = target_model
            last_error = None

            for cur_model in models_to_try:
                cur_provider = "infomaniak" if ("infomaniak" in cur_model.lower() or "ministral" in cur_model.lower() or "qwen" in cur_model.lower() or "bge" in cur_model.lower()) else ("mistral" if "mistral" in cur_model.lower() else "gemini")
                cur_api_key = gemini_key if cur_provider == "gemini" else (mistral_key if cur_provider == "mistral" else infomaniak_token)

                if not cur_api_key:
                    continue

                try:
                    client = LLMClient(api_key=cur_api_key, model=cur_model, provider=cur_provider, product_id=config.get("infomaniak_product_id"))
                    messages = [{"role": "user", "content": user_content}]

                    if cur_provider == "gemini":
                        res = client.client.chat(messages, system_prompt=system_instruction, fallback=True)
                    elif cur_provider == "mistral":
                        from mistralai.models.chat_completion import ChatMessage
                        resp = client.client.chat(model=cur_model, messages=[
                            ChatMessage(role="system", content=system_instruction),
                            ChatMessage(role="user", content=user_content)
                        ])
                        res = resp.choices[0].message.content
                    elif cur_provider == "infomaniak":
                        res = client.client.chat(messages, system_prompt=system_instruction, model=cur_model)
                    else:
                        res = None

                    if res and not str(res).startswith("Erreur"):
                        synthesis_text = res
                        used_model_name = cur_model
                        break
                    else:
                        last_error = res
                        logger.warning("Échec synthèse avec %s: %s, tentative de fallback...", cur_model, res)
                except Exception as ex:
                    last_error = str(ex)
                    logger.warning("Exception synthèse avec %s: %s, tentative de fallback...", cur_model, ex)

            if not synthesis_text or synthesis_text.startswith("Erreur"):
                # Rendu structuré d'information si tous les modèles échouent
                sample_authors = list(sources_set)[:5]
                fallback_synthesis = (
                    f"# ✨ Synthèse Exégétique : {ref_label}\n\n"
                    f"> [!WARNING]\n"
                    f"> **Remarque API** : {last_error or 'Impossible de joindre les serveurs IA'}\n"
                    f"> *(Vérifiez votre clé API ou activez un modèle de secours dans les Paramètres > Modèles IA).*\n\n"
                    f"### 📜 Texte Biblique ({bible_name})\n"
                    f"*{scripture}*\n\n"
                    f"### 📌 1. Données des Commentaires Locaux ({len(sources_set)} sources disponibles)\n"
                    f"Les ouvrages indexés ({', '.join(sample_authors)}...) fournissent des analyses détaillées pour ce passage.\n\n"
                    f"### 🔍 2. Extraits Exégétiques Disponibles :\n"
                )
                for c in raw_comments[:4]:
                    txt_short = c.get('text', '').strip()
                    if len(txt_short) > 280:
                        txt_short = txt_short[:280] + "..."
                    fallback_synthesis += f"- **{c.get('author', 'Auteur')}** : {txt_short}\n\n"

                fallback_synthesis += f"\n---\n📚 **Sources analysées ({len(sources_set)})** : {', '.join(sorted(sources_set))}"
                synthesis_text = fallback_synthesis

            return {
                "success": True,
                "reference": ref_label,
                "book_code": book_code,
                "chapter": ch_int,
                "verse_start": v_start,
                "verse_end": v_end,
                "verse_count": span,
                "sources_count": len(sources_set),
                "sources": sorted(list(sources_set)),
                "model_used": used_model_name,
                "synthesis": synthesis_text,
                "scripture_text": scripture
            }
        except Exception as e:
            logger.error("Erreur génération synthèse IA : %s", e)
            return {
                "success": False,
                "error": f"Erreur lors de la génération IA : {str(e)}",
                "reference": ref_label,
                "book_code": book_code,
                "chapter": ch_int,
                "verse_start": v_start,
                "verse_end": v_end,
                "sources_count": len(sources_set),
                "sources": sorted(list(sources_set)),
                "synthesis": None
            }
