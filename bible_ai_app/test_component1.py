from core.parser import chunk_by_logos_tags
from core.reference_parser import normalize_reference

def test_parser():
    # Test Bible
    bible_text = "[[@Bible:Gen 1:1]]1{{field-on:Bible}} ENTÊTE Elohîms créait les ciels et la terre, {{field-off:Bible}}[[@Bible:Gen 1:2]]2{{field-on:Bible}} la terre était tohu–et–bohu..."
    bible_chunks = chunk_by_logos_tags(bible_text, doc_type="Bible", doc_name="Chouraqui")
    print("--- Test Bible ---")
    for c in bible_chunks:
        print(f"Ref: {c['metadata']['reference']} | Text: {c['text']}")
        
    # Test Commentaire
    commentary_text = "1:3–5[[@Bible:Phil 1.3-5 ]] Comme il le fait dans sept autres lettres, Paul commence par l'action de grâce..."
    commentary_chunks = chunk_by_logos_tags(commentary_text, doc_type="Commentaire", doc_name="MacArthur")
    print("\n--- Test Commentaire ---")
    for c in commentary_chunks:
        print(f"Ref: {c['metadata']['reference']} | Text: {c['text']}")

    # Test Dictionnaire
    dict_text = "Épisode 1 - Un chrétien peut-il se suicider? [[@Headword:suicide]]\nLa question est posée : quelqu'un qui se suicide est-il condamné d'après la Bible ?"
    dict_chunks = chunk_by_logos_tags(dict_text, doc_type="Dictionnaire", doc_name="FAQ")
    print("\n--- Test Dictionnaire ---")
    for c in dict_chunks:
        print(f"Mot-clé: {c['metadata']['reference']} | Text: {c['text']}")

def test_reference_parser():
    print("\n--- Test Normalisation Références ---")
    inputs = ["Jean 3.16", "Jn 3:16", "1 Jean 3:16", "Genèse 1:1-2", "gen 1"]
    for i in inputs:
        print(f"'{i}' -> '{normalize_reference(i)}'")

if __name__ == '__main__':
    test_parser()
    test_reference_parser()
