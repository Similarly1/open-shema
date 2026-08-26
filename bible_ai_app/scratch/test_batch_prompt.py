import sys
import os
import json
import requests

sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from batch_polish_vigouroux import load_all_keys

keys = load_all_keys()
g_key = keys.get('gemini_key1')

with open(r'c:\Users\adrie\Documents\antigravity\peaceful-mendeleev\bible_ai_app\data\illustrations_raw\raw_cyclopedia.json', 'r', encoding='utf-8') as f:
    cyclo_samples = json.load(f)[1:4] # cyclo-0002, 0003, 0004

SYSTEM_PROMPT = """Tu es un théologien expert en homilétique et prédication chrétienne évangélique.
Ta mission est d'adapter, traduire (si le texte est en anglais) et classifier des illustrations pour enrichir la banque pastorale d'Open Shema.

CONSIGNES STRICTES :
1. Catégorie OBLIGATOIREMENT choisie parmi ces 11 catégories exactes :
   - "Grâce & Salut"
   - "Foi & Confiance"
   - "Pardon & Réconciliation"
   - "Épreuve & Souffrance"
   - "Amour & Compassion"
   - "Prière & Intimité"
   - "Mariage & Famille"
   - "Argent & Générosité"
   - "Évangélisation & Mission"
   - "Sainteté & Obéissance"
   - "Espérance & Éternité"

2. Type OBLIGATOIREMENT choisi parmi ces 5 genres exacts :
   - "Histoire vraie"
   - "Métaphore & Vie courante"
   - "Science & Nature"
   - "Citation"
   - "Personnel"

3. Titre : Un titre clair, percutant et évocateur en français (Max 8 mots).
4. Corps (body) :
   - Récit traduit en français élégant, naturel et vivant (sans tournures lourdes).
   - Terminer obligatoirement par une phrase de leçon pastorale en exergue :
     > **Leçon homilétique :** [Application concrète pour le prédicateur et l'assemblée]
5. Passages associés : 1 à 3 références bibliques pertinentes au format compact (ex: ["Mt 18.21-35", "Pr 16.18"]).
6. Tags : 3 à 5 mots-clés théologiques ou éthiques en français.

FORMAT DE SORTIE JSON ATTENDU :
{
  "results": [
    {
      "id": "<id_fourni>",
      "title": "<Titre en français>",
      "category": "<une des 11 catégories>",
      "type": "<un des 5 types>",
      "tags": ["Tag1", "Tag2", "Tag3"],
      "passages_associes": ["Ref1", "Ref2"],
      "body": "<Texte traduit et formaté en Markdown avec la leçon homilétique>"
    }
  ]
}
"""

user_content = json.dumps(cyclo_samples, ensure_ascii=False)

url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key={g_key}"
payload = {
    "systemInstruction": {"parts": [{"text": SYSTEM_PROMPT}]},
    "contents": [{"role": "user", "parts": [{"text": user_content}]}],
    "generationConfig": {
        "temperature": 0.2,
        "responseMimeType": "application/json"
    }
}

resp = requests.post(url, json=payload, timeout=30)
print("Status Code:", resp.status_code)
if resp.status_code == 200:
    data = resp.json()
    text = data["candidates"][0]["content"]["parts"][0]["text"]
    parsed = json.loads(text)
    print("Tokens prompt:", data.get("usageMetadata", {}).get("promptTokenCount"))
    print("Tokens output:", data.get("usageMetadata", {}).get("candidatesTokenCount"))
    print("=" * 70)
    print(json.dumps(parsed, ensure_ascii=False, indent=2))
else:
    print("Error:", resp.text)
