from flask import Flask, request, Response, render_template_string
import scrapetube
from youtube_transcript_api import YouTubeTranscriptApi
import json
import webbrowser
from threading import Timer

app = Flask(__name__)

# ==========================================
# INTERFACE HTML / CSS (Dark Mode) / JS
# ==========================================
HTML_PAGE = """
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Open Schéma - Moissonneur YouTube</title>
    <style>
        :root {
            --bg-color: #121212;
            --surface-color: #1e1e1e;
            --primary-color: #bb86fc;
            --text-primary: #e0e0e0;
            --text-secondary: #a0a0a0;
            --border-color: #333333;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background-color: var(--bg-color);
            color: var(--text-primary);
            margin: 0;
            padding: 40px;
            display: flex;
            justify-content: center;
        }
        .container {
            width: 100%;
            max-width: 800px;
            background-color: var(--surface-color);
            padding: 30px;
            border-radius: 12px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.5);
            border: 1px solid var(--border-color);
        }
        h1 { margin-top: 0; color: var(--primary-color); font-weight: 500; letter-spacing: -0.5px;}
        p { color: var(--text-secondary); }
        textarea {
            width: 100%;
            height: 150px;
            background-color: #2c2c2c;
            color: var(--text-primary);
            border: 1px solid var(--border-color);
            border-radius: 8px;
            padding: 12px;
            font-family: monospace;
            font-size: 14px;
            resize: vertical;
            box-sizing: border-box;
            margin-bottom: 20px;
        }
        textarea:focus { outline: none; border-color: var(--primary-color); }
        .row { display: flex; gap: 15px; margin-bottom: 20px; align-items: center;}
        input[type="number"] {
            background-color: #2c2c2c; color: var(--text-primary);
            border: 1px solid var(--border-color); padding: 10px; border-radius: 6px; width: 80px;
        }
        button {
            background-color: var(--primary-color);
            color: #000;
            border: none;
            padding: 12px 24px;
            font-size: 16px;
            font-weight: 600;
            border-radius: 6px;
            cursor: pointer;
            transition: opacity 0.2s;
        }
        button:hover { opacity: 0.9; }
        button:disabled { background-color: #555; color: #888; cursor: not-allowed; }
        
        #console {
            background-color: #0a0a0a;
            border: 1px solid var(--border-color);
            border-radius: 8px;
            padding: 15px;
            height: 350px;
            overflow-y: auto;
            font-family: monospace;
            font-size: 13px;
            color: #4af626;
            margin-bottom: 20px;
            display: none;
            line-height: 1.5;
        }
        .log-error { color: #ff5555; }
        .log-info { color: #8be9fd; }
        .log-skip { color: #f1fa8c; }
        
        #downloadBtn { display: none; background-color: #50fa7b; color: #000; width: 100%; }
    </style>
</head>
<body>

<div class="container">
    <h1>Atelier Open Schéma : Moissonneur</h1>
    <p>Collez les URLs des chaînes YouTube (une par ligne). Le script ignorera automatiquement les cultes entiers, les annonces et les temps de louange.</p>
    
    <textarea id="chaines" placeholder="https://www.youtube.com/@EgliseLyonGerland\nhttps://www.youtube.com/@EgliseLaChapelle"></textarea>
    
    <div class="row">
        <label>Vidéos cibles par chaîne :</label>
        <input type="number" id="limite" value="10" min="1" max="50">
        <button id="startBtn" onclick="startScraping()">Lancer l'extraction</button>
    </div>

    <div id="console"></div>
    <button id="downloadBtn" onclick="downloadJSON()">💾 Télécharger le corpus (.json)</button>
</div>

<script>
    let finalCorpus = [];

    async function startScraping() {
        const textChaines = document.getElementById('chaines').value;
        const limite = document.getElementById('limite').value;
        const chainesList = textChaines.split('\\n').map(c => c.trim()).filter(c => c);

        if(chainesList.length === 0) return alert("Veuillez entrer au moins une chaîne.");

        document.getElementById('startBtn').disabled = true;
        const consoleEl = document.getElementById('console');
        consoleEl.style.display = 'block';
        consoleEl.innerHTML = '';
        document.getElementById('downloadBtn').style.display = 'none';

        logMsg("Démarrage du processus de filtrage intelligent...", "log-info");

        try {
            const response = await fetch('/api/scrape', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chaines: chainesList, limite: parseInt(limite) })
            });

            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\\n\\n');
                
                for (let line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = JSON.parse(line.replace('data: ', ''));
                        
                        if (data.done) {
                            finalCorpus = data.corpus;
                            logMsg(`\\n🎉 Terminé ! ${finalCorpus.length} prédications valides trouvées.`, "log-info");
                            document.getElementById('downloadBtn').style.display = 'block';
                            document.getElementById('startBtn').disabled = false;
                        } else if (data.log) {
                            let className = "";
                            if (data.log.includes('❌') || data.log.includes('⚠️')) className = 'log-error';
                            else if (data.log.includes('🔍')) className = 'log-info';
                            else if (data.log.includes('⏭️') || data.log.includes('⏳')) className = 'log-skip';
                            
                            logMsg(data.log, className);
                        }
                    }
                }
            }
        } catch (e) {
            logMsg("Erreur de connexion avec le serveur local.", "log-error");
            document.getElementById('startBtn').disabled = false;
        }
    }

    function logMsg(msg, className = "") {
        const consoleEl = document.getElementById('console');
        const span = document.createElement('div');
        if (className) span.className = className;
        span.innerText = msg;
        consoleEl.appendChild(span);
        consoleEl.scrollTop = consoleEl.scrollHeight;
    }

    function downloadJSON() {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(finalCorpus, null, 2));
        const anchor = document.createElement('a');
        anchor.setAttribute("href", dataStr);
        anchor.setAttribute("download", `corpus_predications_${finalCorpus.length}.json`);
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
    }
</script>

</body>
</html>
"""

# ==========================================
# LOGIQUE PYTHON (API & Scraping)
# ==========================================

@app.route('/')
def home():
    return render_template_string(HTML_PAGE)

@app.route('/api/scrape', methods=['POST'])
def scrape():
    data = request.json
    chaines = data.get('chaines', [])
    limite = data.get('limite', 10)

    # Mots-clés qui indiquent que ce n'est PAS une prédication
    MOTS_BANNIS = ["louange", "worship", "annonce", "teaser", "live", "direct", "culte entier", "concert", "intégral", "baptême"]

    def generate():
        corpus = []
        for url in chaines:
            yield f"data: {json.dumps({'log': f'🔍 Analyse de la chaîne : {url}'})}\n\n"
            try:
                videos = scrapetube.get_channel(channel_url=url, sort_by="newest")
                compteur = 0
                
                for v in videos:
                    if compteur >= limite:
                        break
                    
                    video_id = v['videoId']
                    titre = v.get('title', {}).get('runs', [{}])[0].get('text', '')
                    titre_min = titre.lower()
                    
                    # 1. Filtre par mot-clé
                    if any(mot in titre_min for mot in MOTS_BANNIS):
                        yield f"data: {json.dumps({'log': f'⏭️ Ignorée (mot banni) : {titre[:45]}...'})}\n\n"
                        continue

                    # 2. Filtre par durée (20 à 65 minutes)
                    duree_str = v.get('lengthText', {}).get('simpleText', '0:00')
                    parties = duree_str.split(':')
                    
                    if len(parties) == 3: # H:MM:SS
                        minutes = int(parties[0]) * 60 + int(parties[1])
                    elif len(parties) == 2: # MM:SS
                        minutes = int(parties[0])
                    else:
                        minutes = 0

                    if not (20 <= minutes <= 65):
                        yield f"data: {json.dumps({'log': f'⏳ Ignorée (durée {duree_str}) : {titre[:45]}...'})}\n\n"
                        continue

                    # 3. Vérification des sous-titres FR
                    try:
                        transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)
                        transcript_list.find_transcript(['fr', 'fr-FR', 'fr-CA'])
                        
                        vid_data = {
                            "video_id": video_id,
                            "url": f"https://www.youtube.com/watch?v={video_id}",
                            "titre": titre,
                            "chaine": url,
                            "duree": duree_str
                        }
                        corpus.append(vid_data)
                        compteur += 1
                        yield f"data: {json.dumps({'log': f'✅ Retenue : {titre[:45]}...'})}\n\n"
                    except Exception:
                        yield f"data: {json.dumps({'log': f'❌ Ignorée (pas de sous-titre FR) : {titre[:45]}...'})}\n\n"
                        
            except Exception as e:
                yield f"data: {json.dumps({'log': f'⚠️ Erreur sur la chaîne {url} : {str(e)}'})}\n\n"
        
        # Envoi final au navigateur pour déclencher le téléchargement
        yield f"data: {json.dumps({'done': True, 'corpus': corpus})}\n\n"

    return Response(generate(), mimetype='text/event-stream')

def open_browser():
    webbrowser.open_new('http://127.0.0.1:5000/')

if __name__ == '__main__':
    Timer(1, open_browser).start()
    print("Serveur local lancé. L'interface s'ouvre dans votre navigateur...")
    app.run(port=5000, debug=False)