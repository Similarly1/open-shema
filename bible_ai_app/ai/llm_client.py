import base64
import requests
from mistralai.client import MistralClient
from mistralai.models.chat_completion import ChatMessage

class GeminiClient:
    CHAT_CASCADE = [
        "gemini-3.7-flash",
        "gemini-3.6-flash",
        "gemini-3.5-flash",
        "gemini-3-flash",
        "gemini-2.5-flash",
        "gemini-2.5-flash-lite",
        "gemini-3.5-flash-lite",
        "gemini-3.1-flash-lite"
    ]
    
    EMBEDDING_MODELS = [
        "gemini-embedding-2-preview",
        "gemini-embedding-2",
        "gemini-embedding-001"
    ]

    def __init__(self, api_key, model="gemini-3.7-flash"):
        self.api_key = api_key
        self.model = model
        self.base_url = "https://generativelanguage.googleapis.com/v1beta/models"

    def chat(self, messages, system_prompt=None, fallback=True):
        # Définir l'ordre d'essai : le modèle configuré en premier, puis la cascade
        models_to_try = [self.model]
        if fallback:
            for m in self.CHAT_CASCADE:
                if m not in models_to_try:
                    models_to_try.append(m)

        contents = []
        for msg in messages:
            role = "user" if msg["role"] == "user" else "model"
            parts = []
            if isinstance(msg["content"], str):
                parts.append({"text": msg["content"]})
            elif isinstance(msg["content"], list):
                for part in msg["content"]:
                    if "type" in part and part["type"] == "text":
                        parts.append({"text": part["text"]})
                    elif "type" in part and part["type"] == "image_url":
                        url_data = part["image_url"]["url"] if isinstance(part["image_url"], dict) else part["image_url"]
                        if url_data.startswith("data:image"):
                            header, b64_data = url_data.split(",", 1)
                            mime_type = header.split(";")[0].split(":")[1]
                            parts.append({
                                "inline_data": {
                                    "mime_type": mime_type,
                                    "data": b64_data
                                }
                            })
            contents.append({"role": role, "parts": parts})
            
        payload = {"contents": contents}
        if system_prompt:
            payload["system_instruction"] = {"parts": [{"text": system_prompt}]}

        last_error = None
        for current_model in models_to_try:
            url = f"{self.base_url}/{current_model}:generateContent?key={self.api_key}"
            try:
                response = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=60)
                if response.status_code == 429:
                    last_error = f"Quota 429 atteint pour {current_model}"
                    continue
                response.raise_for_status()
                data = response.json()
                try:
                    return data["candidates"][0]["content"]["parts"][0]["text"]
                except (KeyError, IndexError):
                    return "Erreur lors de la lecture de la réponse Gemini."
            except requests.exceptions.HTTPError as e:
                if response.status_code == 429:
                    last_error = f"Quota 429 atteint pour {current_model}"
                    continue
                last_error = str(e)
            except Exception as e:
                last_error = str(e)

        return f"Erreur Gemini (tous les modèles ont échoué ou quotas journaliers épuisés) : {last_error}"

    def embeddings(self, texts, model="gemini-embedding-2"):
        import time
        # Découpage en sous-lots de 20 pour respecter la limite de 30k TPM
        sub_batch_size = 20
        all_embeddings = []
        
        # Résolution du nom réel du modèle Gemini
        clean_model = model
        if model in ["gemini-embedding-1", "gemini-embedding-001"]:
            clean_model = "gemini-embedding-001"
        elif model in ["gemini-embedding-2", "gemini-embedding-2-preview"]:
            clean_model = "gemini-embedding-2-preview"
            
        models_to_try = [clean_model]
        for em in self.EMBEDDING_MODELS:
            if em not in models_to_try:
                models_to_try.append(em)

        for i in range(0, len(texts), sub_batch_size):
            batch = texts[i:i + sub_batch_size]
            batch_success = False
            last_err = None

            for current_model in models_to_try:
                url = f"{self.base_url}/{current_model}:batchEmbedContents?key={self.api_key}"
                requests_list = [{"model": f"models/{current_model}", "content": {"parts": [{"text": t}]}} for t in batch]
                payload = {"requests": requests_list}
                
                # Tentatives avec pause progressive en cas de limitation TPM temporaire
                for attempt in range(3):
                    try:
                        response = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=60)
                        if response.status_code == 429:
                            last_err = f"Quota 429 sur {current_model} (attente 3s...)"
                            time.sleep(3 * (attempt + 1))
                            continue
                        response.raise_for_status()
                        data = response.json()
                        embs = [emb["values"] for emb in data.get("embeddings", [])]
                        all_embeddings.extend(embs)
                        batch_success = True
                        break
                    except Exception as e:
                        last_err = str(e)
                        time.sleep(2)
                
                if batch_success:
                    break

            if not batch_success:
                raise Exception(f"Erreur d'embedding Gemini : {last_err}")
                
            # Courte pause entre les lots pour fluidifier le débit TPM
            time.sleep(0.2)

        return all_embeddings

class LLMClient:
    def __init__(self, api_key, model="gemini-3.7-flash", provider="gemini"):
        self.api_key = api_key
        self.model = model
        self.provider = provider
        
        if self.provider == "mistral":
            self.client = MistralClient(api_key=self.api_key) if self.api_key else None
        elif self.provider == "gemini":
            self.client = GeminiClient(api_key=self.api_key, model=self.model) if self.api_key else None
        else:
            self.client = None
            
    def ask_question(self, context, question, system_prompt=None):
        if not self.client:
            return f"Erreur : Clé API manquante pour {self.provider}."
            
        if not system_prompt:
            system_prompt = (
                "Vous êtes un assistant d'étude biblique théologique et analytique.\n"
                "Votre rôle est d'aider l'utilisateur à analyser et comprendre les textes sacrés et leurs commentaires associés.\n\n"
                "CONSIGNES CRITIQUES :\n"
                "1. Basez TOUJOURS vos réponses UNIQUEMENT sur le contexte fourni (Textes bibliques et Commentaires).\n"
                "2. Vous DEVEZ citer explicitement vos sources d'information à la manière de NotebookLM. Utilisez des références claires sous forme de crochets en gras comme **[Nom du document, Verset]** (ex: **[Chouraqui, Pro 1:1]** ou **[Commentaire Kathleen Nielson, Note 1-7]**) à la fin de vos phrases ou de vos paragraphes pour chaque affirmation basée sur les textes.\n"
                "3. Rédigez vos citations de manière très visible pour que l'utilisateur puisse s'y référer facilement."
            )
        user_prompt = f"Contexte :\n{context}\n\nQuestion : {question}"
        
        if self.provider == "mistral":
            messages = [
                ChatMessage(role="system", content=system_prompt),
                ChatMessage(role="user", content=user_prompt)
            ]
            try:
                response = self.client.chat(model=self.model, messages=messages)
                return response.choices[0].message.content
            except Exception as e:
                return f"Erreur de communication avec l'API Mistral : {str(e)}"
                
        elif self.provider == "gemini":
            messages = [{"role": "user", "content": user_prompt}]
            try:
                return self.client.chat(messages, system_prompt=system_prompt)
            except Exception as e:
                return f"Erreur de communication avec l'API Gemini : {str(e)}"

    def get_embeddings(self, texts, model=None):
        if not self.client:
            raise Exception(f"Clé API manquante pour {self.provider}")
            
        if self.provider == "mistral":
            try:
                # Sub-batching to respect Mistral's overall token and chunk limits (max 16,384 tokens or 1024 texts)
                sub_batch_size = 32
                embeddings = []
                for i in range(0, len(texts), sub_batch_size):
                    batch = texts[i:i+sub_batch_size]
                    response = self.client.embeddings(model=model or "mistral-embed", input=batch)
                    embeddings.extend([data.embedding for data in response.data])
                return embeddings
            except Exception as e:
                raise Exception(f"Erreur d'embedding Mistral : {str(e)}")
                
        elif self.provider == "gemini":
            try:
                return self.client.embeddings(texts, model=model or "gemini-embedding-2")
            except Exception as e:
                raise Exception(f"Erreur d'embedding Gemini : {str(e)}")


    def analyze_image_ocr(self, image_path, prompt=None):
        if not self.client:
            return "Erreur : Clé API manquante."
            
        if not prompt:
            prompt = "Extrais le texte de cette image."
            
        # Encoder l'image en base64
        with open(image_path, "rb") as f:
            b64_data = base64.b64encode(f.read()).decode('utf-8')
            
        ext = image_path.split('.')[-1].lower()
        mime_type = f"image/{'jpeg' if ext in ['jpg', 'jpeg'] else ext}"
        url_data = f"data:{mime_type};base64,{b64_data}"
        
        content = [
            {"type": "text", "text": prompt},
            {"type": "image_url", "image_url": url_data}
        ]
        
        if self.provider == "mistral":
            try:
                import requests
                headers = {
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                }
                payload = {
                    "model": "pixtral-12b-2409",
                    "messages": [{"role": "user", "content": content}]
                }
                resp = requests.post("https://api.mistral.ai/v1/chat/completions", json=payload, headers=headers)
                resp.raise_for_status()
                return resp.json()["choices"][0]["message"]["content"]
            except Exception as e:
                return f"Erreur OCR Mistral : {str(e)}"
        elif self.provider == "gemini":
            try:
                messages = [{"role": "user", "content": content}]
                return self.client.chat(messages)
            except Exception as e:
                return f"Erreur OCR Gemini : {str(e)}"

    def extract_cover_info(self, image_path):
        prompt = (
            "Extrais les informations de ce livre depuis cette image de couverture ou de page de garde. "
            "Renvoie UNIQUEMENT un objet JSON valide avec les clés exactes : 'title', 'author', 'description', 'year'. "
            "Ne renvoie absolument aucun autre texte ni mise en forme markdown autour du JSON. Si une information est introuvable, mets une chaîne vide."
        )
        response = self.analyze_image_ocr(image_path, prompt)
        
        import json
        import re
        
        try:
            clean_json = re.sub(r'```(?:json)?', '', response).strip()
            return json.loads(clean_json)
        except Exception as e:
            raise Exception(f"Impossible de lire le JSON renvoyé par le LLM.\nErreur : {str(e)}\nRéponse brute : {response}")
