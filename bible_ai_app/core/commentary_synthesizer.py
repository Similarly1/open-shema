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
    def curate_and_rerank_commentaries(
        cls,
        raw_comments: List[Dict[str, Any]],
        passage_ref: str,
        scripture_text: str,
        config: Dict[str, Any]
    ) -> Tuple[str, bool]:
        """
        Filtre, condense et classe les commentaires bruts pour éliminer les répétitions textuelles
        et extraire la quintessence théologique avant l'envoi au modèle de synthèse.
        """
        if not raw_comments:
            return "", False

        # Si le volume de texte total est modéré (< 2500 caractères), pas besoin d'une passe de re-ranking lourde
        total_len = sum(len(c.get("text", "")) for c in raw_comments)
        if total_len < 2500:
            formatted = []
            for c in raw_comments:
                formatted.append(f"### Source : {c.get('author', 'Commentaire')} ({c.get('reference', passage_ref)})\n{c.get('text', '').strip()}")
            return "\n\n".join(formatted), False

        curation_model = config.get("synthesis_curation_model") or "gemini-2.5-flash-lite"
        gemini_key = config.get("gemini_api_key", "")
        mistral_key = config.get("mistral_api_key", "")
        infomaniak_token = config.get("infomaniak_token", "")

        provider = "gemini"
        api_key = gemini_key

        if curation_model.startswith("mistral") and mistral_key:
            provider = "mistral"
            api_key = mistral_key
        elif "mistralai/" in curation_model or "infomaniak" in curation_model.lower():
            provider = "infomaniak"
            api_key = infomaniak_token
        elif not api_key and mistral_key:
            provider = "mistral"
            api_key = mistral_key
            curation_model = "mistral-small-latest"
        elif not api_key and infomaniak_token:
            provider = "infomaniak"
            api_key = infomaniak_token
            curation_model = "mistralai/Ministral-3-14B-Instruct-2512"

        if not api_key:
            # Fallback direct sans appel API si pas de clé
            formatted = []
            for c in raw_comments[:12]:
                text = c.get('text', '').strip()
                if len(text) > 800:
                    text = text[:800] + "..."
                formatted.append(f"### Source : {c.get('author', 'Commentaire')} ({c.get('reference', passage_ref)})\n{text}")
            return "\n\n".join(formatted), False

        # Préparation du prompt de curation
        sources_text = ""
        for i, c in enumerate(raw_comments):
            sources_text += f"\n[SOURCE {i+1}: {c.get('author', 'Auteur')} - Réf: {c.get('reference', passage_ref)}]\n{c.get('text', '')[:1200]}\n"

        curation_prompt = (
            f"Tu es un assistant exégétique expert chargé de la curation et du re-ranking de commentaires bibliques.\n"
            f"Passage : {passage_ref}\n"
            f"Texte biblique :\n{scripture_text}\n\n"
            f"Voici les extraits bruts de {len(raw_comments)} commentaires bibliques :\n{sources_text}\n\n"
            f"TÂCHE :\n"
            f"1. Élimine les redondances et les formules introductives creuses.\n"
            f"2. Conserve UNIQUEMENT les arguments exégétiques les plus forts, les explications des mots hébreux/grecs, les nuances d'interprétation et les points théologiques saillants de chaque auteur.\n"
            f"3. Restitue chaque extrait curé sous forme claire : `### [Nom de l'auteur / Source]` suivi des 2 à 4 points clés substantiels."
        )

        try:
            client = LLMClient(api_key=api_key, model=curation_model, provider=provider, product_id=config.get("infomaniak_product_id"))
            messages = [{"role": "user", "content": curation_prompt}]
            
            if provider == "gemini":
                curated_result = client.client.chat(messages, fallback=True)
            elif provider == "mistral":
                from mistralai.models.chat_completion import ChatMessage
                resp = client.client.chat(model=curation_model, messages=[ChatMessage(role="user", content=curation_prompt)])
                curated_result = resp.choices[0].message.content
            elif provider == "infomaniak":
                curated_result = client.client.chat(messages, model=curation_model)
            else:
                curated_result = None

            if curated_result and len(curated_result.strip()) > 100:
                return curated_result.strip(), True
        except Exception as e:
            logger.warning("Erreur lors de la passe de curation LLM (%s), utilisation du mode standard: %s", curation_model, e)

        # Repli si la curation échoue
        formatted = []
        for c in raw_comments:
            formatted.append(f"### Source : {c.get('author', 'Commentaire')} ({c.get('reference', passage_ref)})\n{c.get('text', '').strip()}")
        return "\n\n".join(formatted), False

    @classmethod
    def synthesize(
        cls,
        book_code: str,
        chapter: int,
        verse_start: int,
        verse_end: Optional[int] = None,
        enable_reranking: Optional[bool] = None,
        model: Optional[str] = None,
        bible_name: str = "LSG"
    ) -> Dict[str, Any]:
        """
        Exécute la synthèse exégétique complète pour la plage de versets spécifiée.
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

        # 3. Curation & Re-ranking optionnels
        should_rerank = enable_reranking if enable_reranking is not None else config.get("synthesis_enable_reranking", True)
        rerank_applied = False

        if should_rerank:
            context_text, rerank_applied = cls.curate_and_rerank_commentaries(raw_comments, ref_label, scripture, config)
        else:
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

        # 6. Prompt de Synthèse Multi-Commentaires Haute Fidélité
        system_instruction = (
            "Vous êtes un éminent professeur de théologie et un exégète biblique chevronné.\n"
            "Votre mission est de rédiger une SYNTHÈSE EXÉGÉTIQUE COMPARATIVE d'excellence à partir des extraits de commentaires fournis.\n\n"
            "RÈGLES CRITIQUES DE RÉDACTION :\n"
            "1. Basez votre analyse rigoureusement sur les commentaires fournis. Ne spéculez pas.\n"
            "2. Citez nommément et explicitement les auteurs ou ouvrages entre crochets gras (ex: **[John MacArthur]**, **[Matthew Henry]**, **[J.N. Darby]**, **[Bible Annotée]**) lorsque vous rapportez une idée ou une nuance distinctive.\n"
            "3. Structurez impérativement votre réponse avec les 4 sections suivantes en Markdown impeccable :\n"
            "   - ## 📌 1. Consensus Exégétique & Thèmes Communs (Ce sur quoi tous les auteurs s'accordent, doctrine principale, sens direct)\n"
            "   - ## 🔍 2. Nuances, Divergences & Perspectives Particulières (Comparaison des points de vue, différences d'accentuation : typologie, dispensation, christocentrisme, analyse grammaticale/mots originaux)\n"
            "   - ## 💡 3. Clés Textuelles & Applications Pratiques (Enseignements théologiques majeurs, implications pastorales et pour la vie de foi)\n"
            "   - ## 📚 4. Synthèse des Sources Étudiées (Bref résumé récapitulatif des apports uniques de chaque commentateur cité)\n"
            "4. Rédigez en français élégant, clair, précis et théologiquement rigoureux."
        )

        user_content = (
            f"### PASSAGE BIBLIQUE ÉTUDIÉ : **{ref_label}**\n\n"
            f"**Texte biblique ({bible_name}) :**\n{scripture}\n\n"
            f"**EXTRAITS DES {len(sources_set)} COMMENTAIRES DISPONIBLES :**\n"
            f"{context_text}\n\n"
            f"{notes_context}\n\n"
            f"Rédigez la synthèse exégétique comparative selon le plan demandé :"
        )

        try:
            client = LLMClient(api_key=api_key, model=target_model, provider=provider, product_id=config.get("infomaniak_product_id"))
            messages = [{"role": "user", "content": user_content}]

            if provider == "gemini":
                synthesis_text = client.client.chat(messages, system_prompt=system_instruction, fallback=True)
            elif provider == "mistral":
                from mistralai.models.chat_completion import ChatMessage
                resp = client.client.chat(model=target_model, messages=[
                    ChatMessage(role="system", content=system_instruction),
                    ChatMessage(role="user", content=user_content)
                ])
                synthesis_text = resp.choices[0].message.content
            if synthesis_text and synthesis_text.startswith("Erreur"):
                # Générer un rendu de secours structuré à partir des commentaires locaux
                sample_authors = list(sources_set)[:5]
                fallback_synthesis = (
                    f"# ✨ Synthèse Exégétique : {ref_label}\n\n"
                    f"> [!WARNING]\n"
                    f"> **Remarque API ({provider.capitalize()})** : {synthesis_text}\n"
                    f"> *(Vérifiez la validité de votre clé API ou votre quota dans les Paramètres > Modèles IA).*\n\n"
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
                    fallback_synthesis += f"- **[{c.get('author')}]** : {txt_short}\n\n"

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
                "reranking_applied": rerank_applied,
                "model_used": target_model,
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
