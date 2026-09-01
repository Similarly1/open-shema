import logging
logger = logging.getLogger(__name__)
import base64
import requests

try:
    from mistralai.client import MistralClient
    from mistralai.models.chat_completion import ChatMessage
except ImportError:
    try:
        from mistralai import Mistral as MistralClient
        class ChatMessage:
            def __init__(self, role, content):
                self.role = role
                self.content = content
    except ImportError:
        MistralClient = None
        ChatMessage = None

def resolve_llm_provider(model_name: str) -> str:
    """Détermine le fournisseur (provider) en fonction du nom du modèle."""
    m = model_name.lower()
    if "infomaniak" in m or "ministral" in m or "qwen" in m or "bge" in m or "llama" in m:
        return "infomaniak"
    elif "mistral" in m:
        return "mistral"
    return "gemini"

class GeminiClient:
    CHAT_CASCADE = [
        "gemini-2.5-flash",
        "gemini-3.7-flash",
        "gemini-3.6-flash",
        "gemini-3.5-flash",
        "gemini-3.5-flash-lite",
        "gemini-3.1-flash-lite",
        "gemini-3.1-pro-preview",
        "gemini-3-flash-preview",
        "gemini-2.5-pro",
        "gemini-2.5-flash-lite",
        "gemini-2.0-flash",
        "gemini-2.0-flash-lite",
        "gemini-1.5-flash",
        "gemini-1.5-pro",
        "gemini-1.5-flash-8b"
    ]
    
    EMBEDDING_MODELS = [
        "gemini-embedding-2-preview",
        "gemini-embedding-2",
        "gemini-embedding-001"
    ]

    def __init__(self, api_key, model="gemini-2.5-flash"):
        self.api_key = api_key
        self.model = model
        self.last_used_model = model
        self.base_url = "https://generativelanguage.googleapis.com/v1beta/models"

    def chat(self, messages, system_prompt=None, fallback=True, thinking_budget=None):
        if not self.api_key or not str(self.api_key).strip():
            return "Erreur Gemini : Clé API Google Gemini non configurée. Veuillez renseigner votre clé API dans les Paramètres IA de l'application."

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
            
        base_payload = {"contents": contents}
        if system_prompt:
            base_payload["system_instruction"] = {"parts": [{"text": system_prompt}]}

        last_error = None
        for current_model in models_to_try:
            url = f"{self.base_url}/{current_model}:generateContent"
            payload = dict(base_payload)
            if thinking_budget is not None and ("2.5" in current_model or "2.0" in current_model or "3." in current_model):
                payload["generationConfig"] = {
                    "thinkingConfig": {
                        "thinkingBudget": thinking_budget
                    }
                }

            try:
                response = requests.post(url, json=payload, headers={"Content-Type": "application/json", "x-goog-api-key": self.api_key}, timeout=90)
                
                if response.status_code != 200:
                    err_msg = ""
                    try:
                        err_json = response.json()
                        if "error" in err_json and "message" in err_json["error"]:
                            err_msg = err_json["error"]["message"]
                    except Exception:
                        pass

                    # Erreur d'authentification ou de clé API invalide
                    if response.status_code in [401, 403] or any(k in err_msg.lower() for k in ["api key", "unregistered caller", "permission_denied", "api_key"]):
                        return f"Erreur Google API ({response.status_code}) sur {current_model} : {err_msg or 'Clé API invalide ou non autorisée'}. Veuillez vérifier votre clé API Google dans les Paramètres IA."

                    if response.status_code in [404, 429, 500, 502, 503, 504]:
                        last_error = f"Status {response.status_code} ({err_msg}) pour {current_model}"
                        continue
                response.raise_for_status()
                data = response.json()
                try:
                    self.last_used_model = current_model
                    return data["candidates"][0]["content"]["parts"][0]["text"]
                except (KeyError, IndexError):
                    return "Erreur lors de la lecture de la réponse Gemini."
            except requests.exceptions.Timeout as e:
                last_error = f"Délai d'attente dépassé (timeout 90s) sur {current_model}"
                continue
            except requests.exceptions.HTTPError as e:
                if hasattr(e, 'response') and e.response is not None and e.response.status_code in [404, 429, 500, 502, 503, 504]:
                    last_error = f"Erreur {e.response.status_code} sur {current_model}"
                    continue
                last_error = str(e)
                continue
            except Exception as e:
                last_error = str(e)
                continue

        return f"Erreur Gemini ({last_error})"

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
                url = f"{self.base_url}/{current_model}:batchEmbedContents"
                requests_list = [{"model": f"models/{current_model}", "content": {"parts": [{"text": t}]}} for t in batch]
                payload = {"requests": requests_list}
                
                # Tentatives avec pause progressive en cas de limitation TPM temporaire
                for attempt in range(3):
                    try:
                        response = requests.post(url, json=payload, headers={"Content-Type": "application/json", "x-goog-api-key": self.api_key}, timeout=60)
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

class InfomaniakClient:
    def __init__(self, token, product_id="251"):
        self.token = token
        self.product_id = product_id or "251"
        self.base_url = f"https://api.infomaniak.com/2/ai/{self.product_id}/openai/v1"
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
        self.session = requests.Session()

    def chat(self, messages, system_prompt=None, model="mistralai/Ministral-3-14B-Instruct-2512"):
        url = f"{self.base_url}/chat/completions"
        all_messages = []
        if system_prompt:
            all_messages.append({"role": "system", "content": system_prompt})
        for m in messages:
            all_messages.append({"role": m.get("role", "user"), "content": m.get("content", "")})
            
        clean_model = model.replace("infomaniak/", "").replace(" (Infomaniak)", "").strip()
        payload = {
            "model": clean_model or "mistralai/Ministral-3-14B-Instruct-2512",
            "messages": all_messages
        }
        try:
            response = self.session.post(url, headers=self.headers, json=payload, timeout=60)
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"]
        except Exception as e:
            raise Exception(f"Erreur de communication avec l'API Infomaniak ({clean_model}) : {str(e)}")

    def embeddings(self, texts, model="bge_multilingual_gemma2"):
        import time
        sub_batch_size = 20
        all_embeddings = []
        clean_model = model.replace("infomaniak/", "").replace(" (Infomaniak)", "").strip()
        if not clean_model:
            clean_model = "bge_multilingual_gemma2"
            
        url = f"{self.base_url}/embeddings"
        for i in range(0, len(texts), sub_batch_size):
            batch = texts[i:i + sub_batch_size]
            payload = {
                "model": clean_model,
                "input": batch
            }
            
            success = False
            last_err = None
            for attempt in range(5):
                try:
                    response = self.session.post(url, headers=self.headers, json=payload, timeout=60)
                    response.raise_for_status()
                    data = response.json()
                    embs = [item["embedding"] for item in data.get("data", [])]
                    all_embeddings.extend(embs)
                    success = True
                    break
                except Exception as e:
                    last_err = str(e)
                    time.sleep(1.5 * (attempt + 1))
                    # Réinitialiser la session HTTP en cas de socket interrompu
                    try:
                        self.session.close()
                    except Exception as _silent_e:
                        logger.debug("Erreur ignoree : %s", _silent_e)
                    self.session = requests.Session()
                    
            if not success:
                raise Exception(f"Erreur d'embedding Infomaniak ({clean_model}) après 5 tentatives : {last_err}")
                
            time.sleep(0.1)
                
        return all_embeddings

class LLMClient:
    def __init__(self, api_key, model="gemini-2.5-flash", provider="gemini", product_id=None):
        self.api_key = api_key
        self.model = model
        self.provider = provider
        self.product_id = product_id or "251"
        
        if self.provider == "mistral":
            self.client = MistralClient(api_key=self.api_key) if self.api_key else None
        elif self.provider == "gemini":
            self.client = GeminiClient(api_key=self.api_key, model=self.model) if self.api_key else None
        elif self.provider == "infomaniak":
            self.client = InfomaniakClient(token=self.api_key, product_id=self.product_id) if self.api_key else None
        else:
            self.client = None

    def chat(self, messages, system_prompt=None, **kwargs):
        """Méthode unifiée de conversation/complétion avec le LLM selon le provider configuré."""
        if not self.client:
            raise Exception(f"Clé API manquante pour {self.provider}")
            
        if self.provider == "mistral":
            try:
                mistral_messages = []
                if system_prompt:
                    mistral_messages.append(ChatMessage(role="system", content=system_prompt))
                for m in messages:
                    mistral_messages.append(ChatMessage(role=m.get("role", "user"), content=m.get("content", "")))
                response = self.client.chat(model=self.model, messages=mistral_messages)
                return response.choices[0].message.content
            except Exception as e:
                raise Exception(f"Erreur de communication avec l'API Mistral : {str(e)}")
                
        elif self.provider == "gemini":
            try:
                return self.client.chat(messages, system_prompt=system_prompt, **kwargs)
            except Exception as e:
                raise Exception(f"Erreur de communication avec l'API Gemini : {str(e)}")

        elif self.provider == "infomaniak":
            try:
                return self.client.chat(messages, system_prompt=system_prompt, model=self.model)
            except Exception as e:
                raise Exception(f"Erreur de communication avec l'API Infomaniak : {str(e)}")
        else:
            raise Exception(f"Provider inconnu : {self.provider}")

    def ask_question(self, context, question, system_prompt=None, thinking_budget=None):
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
                return self.client.chat(messages, system_prompt=system_prompt, thinking_budget=thinking_budget)
            except Exception as e:
                return f"Erreur de communication avec l'API Gemini : {str(e)}"

        elif self.provider == "infomaniak":
            messages = [{"role": "user", "content": user_prompt}]
            try:
                return self.client.chat(messages, system_prompt=system_prompt, model=self.model)
            except Exception as e:
                return f"Erreur de communication avec l'API Infomaniak : {str(e)}"

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
                
        elif self.provider == "infomaniak":
            try:
                return self.client.embeddings(texts, model=model or "bge_multilingual_gemma2")
            except Exception as e:
                raise Exception(f"Erreur d'embedding Infomaniak : {str(e)}")


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
