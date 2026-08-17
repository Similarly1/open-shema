import os
import sys
import time

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

from core.reranker import LocalReranker

def run_test():
    print("=" * 60)
    print("TEST DU MODULE DE RERANKING LOCAL (bge-reranker-v2-m3)")
    print("=" * 60)
    
    reranker = LocalReranker.get_instance()
    
    query = "Quelle est la doctrine de la justification par la foi selon Paul ?"
    
    # 5 candidats mélangés (2 très pertinents, 1 moyennement pertinent, 2 hors sujet)
    candidates = [
        {
            "id": "doc_1",
            "text": "Les dimensions de l'arche de Noé étaient de trois cents coudées de longueur, cinquante coudées de largeur et trente coudées de hauteur.",
            "metadata": {"source": "Genèse 6:15", "type": "Bible"}
        },
        {
            "id": "doc_2",
            "text": "L'apôtre Paul enseigne que l'homme est justifié par la foi seule (sola fide), sans les œuvres de la loi, par le moyen de la rédemption qui est en Jésus-Christ.",
            "metadata": {"source": "Théologie Systématique - Chapitre 24", "type": "Théologie"}
        },
        {
            "id": "doc_3",
            "text": "Car nous pensons que l'homme est justifié par la foi, sans les œuvres de la loi. Romains 3:28 affirme ce fondement salutaire.",
            "metadata": {"source": "Romains 3:28 (BDS)", "type": "Bible"}
        },
        {
            "id": "doc_4",
            "text": "La construction du temple de Salomon nécessita l'envoi de cèdres du Liban et le travail de milliers d'ouvriers sous la direction d'Hiram.",
            "metadata": {"source": "1 Rois 5", "type": "Bible"}
        },
        {
            "id": "doc_5",
            "text": "La sanctification est l'œuvre progressive de Dieu qui transforme le croyant à l'image du Christ après qu'il a été déclaré juste.",
            "metadata": {"source": "Dictionnaire Théologique", "type": "Dictionnaire"}
        }
    ]
    
    print(f"Requête : \"{query}\"")
    print(f"Nombre de candidats en entrée : {len(candidates)}\n")
    
    start_time = time.time()
    results = reranker.rerank(query, candidates, top_k=3)
    duration_ms = (time.time() - start_time) * 1000
    
    print(f"⏱️ Temps de calcul sur CPU : {duration_ms:.1f} ms\n")
    print("Résultats après Reranking (Top 3) :")
    print("-" * 60)
    for i, res in enumerate(results, 1):
        score_pct = res["rerank_score"] * 100
        source = res["metadata"].get("source", "Inconnu")
        print(f"#{i} [Score: {score_pct:.1f}%] - Source: {source}")
        print(f"   Extrait: {res['text']}")
        print()
        
    # Vérification d'exactitude
    top_sources = [r["metadata"]["source"] for r in results]
    assert "Théologie Systématique - Chapitre 24" in top_sources[:2], "Le doc théologique clé devrait être dans le Top 2"
    assert "Romains 3:28 (BDS)" in top_sources[:2], "Le verset clé de Romains 3:28 devrait être dans le Top 2"
    print("✅ TEST VALIDÉ AVEC SUCCÈS : Les passages pertinents sont arrivés en tête !")

if __name__ == "__main__":
    run_test()
