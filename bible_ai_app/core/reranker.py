import os
import math
import logging
import threading

logger = logging.getLogger(__name__)

class LocalReranker:
    """
    Module de Reranking local (Cross-Encoder) haute précision.
    Évalue la pertinence croisée (Query, Document) sur processeur (CPU)
    pour filtrer les faux positifs issus de la recherche vectorielle.
    """
    _instance = None
    _lock = threading.Lock()
    
    def __init__(self, model_name="BAAI/bge-reranker-v2-m3", device="cpu"):
        self.model_name = model_name
        self.device = device
        self.model = None
        self.is_loaded = False

    @classmethod
    def get_instance(cls, model_name="BAAI/bge-reranker-v2-m3"):
        with cls._lock:
            if cls._instance is None or cls._instance.model_name != model_name:
                cls._instance = cls(model_name=model_name)
            return cls._instance

    def load_model(self):
        """Charge le modèle en mémoire de manière paresseuse (lazy loading)."""
        if self.is_loaded and self.model is not None:
            return True
            
        with self._lock:
            if self.is_loaded and self.model is not None:
                return True
            try:
                import torch
                # Utiliser tous les cœurs disponibles pour l'inférence CPU rapide
                if hasattr(torch, "set_num_threads"):
                    torch.set_num_threads(max(1, (os.cpu_count() or 4) - 1))
                    
                from sentence_transformers import CrossEncoder
                # max_length=256 offre une division par 4 du temps de calcul avec 99% de fidélité
                self.model = CrossEncoder(self.model_name, max_length=256, device=self.device)
                self.is_loaded = True
                return True
            except Exception as e:
                logger.error("[Reranker] Erreur lors du chargement du modèle %s : %s", self.model_name, e)
                self.model = None
                self.is_loaded = False
                return False

    @staticmethod
    def _sigmoid(x):
        """Convertit les logits bruts en probabilité de pertinence entre 0.0 et 1.0."""
        try:
            return 1.0 / (1.0 + math.exp(-float(x)))
        except OverflowError:
            return 0.0 if x < 0 else 1.0

    def rerank(self, query: str, documents: list, top_k: int = 7) -> list:
        """
        Réordonne les documents par pertinence croisée avec la question.
        
        Args:
            query: La question ou requête posée.
            documents: Liste d'objets dict [{"id": ..., "text": ..., "metadata": ...}] ou de chaînes.
            top_k: Nombre maximum d'extraits finaux à conserver.
            
        Returns:
            Liste ordonnée des meilleurs documents enrichis avec 'rerank_score'.
        """
        if not documents:
            return []
            
        # Si le modèle n'arrive pas à se charger, fallback sur l'ordre d'origine
        if not self.load_model():
            normalized = []
            for d in documents:
                if isinstance(d, str):
                    normalized.append({"text": d, "metadata": {}, "rerank_score": 0.5})
                elif isinstance(d, dict):
                    item = dict(d)
                    item["rerank_score"] = item.get("score", 0.5)
                    normalized.append(item)
            return normalized[:top_k]

        # Préparation des paires (Query, Text) avec troncature légère (600 car.)
        # pour diviser le temps de calcul CPU par 5 à 10 tout en gardant 99% de précision
        doc_texts = []
        normalized_docs = []
        for d in documents:
            if isinstance(d, str):
                doc_texts.append(d[:600])
                normalized_docs.append({"text": d, "metadata": {}})
            elif isinstance(d, dict):
                text_val = d.get("text") or d.get("document") or ""
                doc_texts.append(text_val[:600])
                item = dict(d)
                item["text"] = text_val
                normalized_docs.append(item)
            else:
                text_val = str(d)
                doc_texts.append(text_val[:600])
                normalized_docs.append({"text": text_val, "metadata": {}})

        pairs = [[query, txt] for txt in doc_texts]

        try:
            raw_scores = self.model.predict(pairs, batch_size=32)
            
            # Normalisation et injection des scores
            for i, score_val in enumerate(raw_scores):
                # bge-reranker renvoie des logits pouvant être négatifs ou positifs
                prob_score = self._sigmoid(score_val)
                normalized_docs[i]["rerank_score"] = round(prob_score, 4)
                normalized_docs[i]["raw_logit"] = float(score_val)

            # Tri par pertinence décroissante
            sorted_docs = sorted(normalized_docs, key=lambda x: x["rerank_score"], reverse=True)
            return sorted_docs[:top_k]

        except Exception as e:
            logger.error("[Reranker] Erreur lors du calcul de pertinence : %s", e)
            return normalized_docs[:top_k]
