import os
import sys
import sqlite3

# Assurer l'accès au répertoire bible_ai_app
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

from core.translation_manager import TranslationManager, AVAILABLE_TRANSLATION_MODELS
from core.config import load_config

def test_language_detection():
    print("--- 1. Test de Détection de Langue ---")
    
    fr_sample = "Ceci est un commentaire théologique en français expliquant le verset de Genèse 1:1."
    en_sample = "This is an in-depth commentary on the creation of the heavens and the earth according to Genesis 1:1."
    de_sample = "Im Anfang schuf Gott die Himmel und die Erde. Dieser theologische Kommentar befasst sich mit dem Text."
    es_sample = "En el principio creó Dios los cielos y la tierra. Este comentario bíblico explica la salvación por la fe."
    
    lang_fr = TranslationManager.detect_language(fr_sample)
    lang_en = TranslationManager.detect_language(en_sample)
    lang_de = TranslationManager.detect_language(de_sample)
    lang_es = TranslationManager.detect_language(es_sample)
    
    print(f"FR sample -> détecté: {lang_fr} (is_french: {TranslationManager.is_french(fr_sample)})")
    print(f"EN sample -> détecté: {lang_en} (is_french: {TranslationManager.is_french(en_sample)})")
    print(f"DE sample -> détecté: {lang_de} (is_french: {TranslationManager.is_french(de_sample)})")
    print(f"ES sample -> détecté: {lang_es} (is_french: {TranslationManager.is_french(es_sample)})")
    
    assert TranslationManager.is_french(fr_sample) == True, "Erreur détection français"
    assert TranslationManager.is_french(en_sample) == False, "Erreur détection anglais"
    assert TranslationManager.is_french(de_sample) == False, "Erreur détection allemand"
    assert TranslationManager.is_french(es_sample) == False, "Erreur détection espagnol"
    print("✅ Détection de langue validée avec succès !")

def test_cache_storage():
    print("\n--- 2. Test du Cache SQLite Translations ---")
    
    item_type = "commentary"
    item_id = "test_author:Genèse:1:1"
    orig_text = "In the beginning God created the heaven and the earth."
    trans_text = "Au commencement, Dieu créa les cieux et la terre."
    model_used = "gemini-3.5-flash-lite"
    
    # Sauvegarde
    ok = TranslationManager.save_translation(
        item_type=item_type,
        item_id=item_id,
        translated_text=trans_text,
        model_used=model_used,
        source_lang="en",
        target_lang="fr",
        original_text=orig_text
    )
    assert ok == True, "Erreur sauvegarde dans le cache SQLite"
    
    # Lecture
    cached = TranslationManager.get_translation(item_type, item_id, "fr")
    assert cached is not None, "Erreur récupération de la traduction en cache"
    assert cached["translated_text"] == trans_text, "Texte traduit corrompu dans le cache"
    assert cached["model_used"] == model_used, "Modèle utilisé incorrect"
    assert cached["original_text"] == orig_text, "Texte original corrompu"
    
    print(f"✅ Cache SQLite validé avec succès (Stocké pour item_id='{item_id}', modèle='{model_used}') !")

def test_config():
    print("\n--- 3. Test de Configuration ---")
    cfg = load_config()
    trans_model = cfg.get("translation_model")
    print(f"Modèle de traduction par défaut dans config : {trans_model}")
    assert trans_model == "gemini-3.5-flash-lite", f"Attendu 'gemini-3.5-flash-lite', reçu '{trans_model}'"
    print(f"Modèles actifs disponibles : {len(AVAILABLE_TRANSLATION_MODELS)} modèles")
    print("✅ Configuration validée avec succès !")

if __name__ == "__main__":
    test_language_detection()
    test_cache_storage()
    test_config()
    print("\n🎉 TOUS LES TESTS SONT PASSÉS AVEC SUCCÈS !")
