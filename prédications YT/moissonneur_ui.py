from flask import Flask, request, Response, render_template_string
import yt_dlp
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
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background-color: var(--bg-color);
            color: var(--text-primary);
            margin: 0;
            padding: 40px;
            display: flex;
            justify-content: center;
        }
        .container {
            width: 100%;
            max-width: 850px;
            background-color: var(--surface-color);
            padding: 30px;
            border-radius: 12px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.5);
            border: 1px solid var(--border-color);
        }
        h1 { margin-top: 0; color: var(--primary-color); font-weight: 500; }
        p { color: var(--text-secondary); }
        textarea {
            width: 100%;
            height: 160px;
            background-color: #2c2c2c;
            color: var(--text-primary);
            border: 1px solid var(--border-color);
            border-radius: 8px;
            padding: 12px;
            font-family: monospace;
            font-size: 13px;
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
        }
        button:hover { opacity: 0.9; }
        button:disabled { background-color: #555; color: #888; cursor: not-allowed; }
        
        #console {
            background-color: #0a0a0a;
            border: 1px solid var(--border-color);
            border-radius: 8px;
            padding: 15px;
            height: 380px;
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
    <p>Collez vos URLs de <strong>chaînes</strong> ou de <strong>playlists</strong> YouTube (une par ligne).</p>
    
    <textarea id="sources" placeholder="https://www.youtube.com/@abetupes&#10;https://www.youtube.com/playlist?list=PL7NXsb91-5lUM90DqJoHa9zXb0yEVwHxl"></textarea>
    
    <div class="row">
        <label>Vidéos cibles par source :</label>
        <input type="number" id="limite" value="10" min="1" max="50">
        <button id="startBtn" onclick="startScraping()">Lancer l'extraction</button>
    </div>

    <div id="console"></div>
    <button id="downloadBtn" onclick="downloadJSON()">💾 Télécharger le corpus (.json)</button>
</div>

<script>
    let finalCorpus = [];

    async function startScraping() {
        const textSources = document.getElementById('sources').value;
        const limite = document.getElementById('limite').value;
        const sourcesList = textSources.split('\\n').map(c => c.trim()).filter(c => c);

        if(sourcesList.length === 0) return alert("Veuillez entrer au moins un lien.");

        document.getElementById('startBtn').disabled = true;
        const consoleEl = document.getElementById('console');
        consoleEl.style.display = 'block';
        consoleEl.innerHTML = '';
        document.getElementById('downloadBtn').style.display = 'none';

        logMsg("Démarrage du moissonnage...", "log-info");

        try {
            const response = await fetch('/api/scrape', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sources: sourcesList, limite: parseInt(limite) })
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
                            logMsg(`\\n🎉 Terminé ! ${finalCorpus.length} prédications qualifiées prêtes.`, "log-info");
                            if (finalCorpus.length > 0) {
                                document.getElementById('downloadBtn').style.display = 'block';
                            }
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
            logMsg("Erreur de communication avec le serveur local.", "log-error");
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
# LOGIQUE PYTHON ROBUSTE
# ==========================================

LANGUES_FR = ['fr', 'fr-FR', 'fr-CA', 'fr-CH', 'fr-BE']

def verifier_transcription_fr(video_id: str, ydl_instance):
    """Vérifie la présence de sous-titres FR via YouTubeTranscriptApi puis yt-dlp en fallback."""
    # 1. Tentative avec youtube-transcript-api
    try:
        t = YouTubeTranscriptApi.get_transcript(video_id, languages=LANGUES_FR)
        if t and len(t) > 0:
            return True, "TranscriptApi OK"
    except Exception:
        pass

    # 2. Secours direct avec yt-dlp
    try:
        v_url = f"https://www.youtube.com/watch?v={video_id}"
        v_info = ydl_instance.extract_info(v_url, download=False, process=False)
        if not v_info:
            return False, "Non trouvé"
            
        subs = v_info.get('subtitles', {})
        auto_subs = v_info.get('automatic_captions', {})
        
        has_manual = any(code.startswith('fr') for code in subs.keys())
        has_auto = any(code.startswith('fr') for code in auto_subs.keys())
        
        if has_manual or has_auto:
            return True, "yt-dlp OK"
        return False, "Aucun sous-titre FR"
    except Exception as e:
        return False, f"Erreur ({type(e).__name__})"

def normaliser_url(url: str):
    url = url.strip()
    if "@" in url and not url.endswith("/videos") and not "playlist" in url and not "watch" in url:
        url = url.rstrip('/') + "/videos"
    return url

@app.route('/')
def home():
    return render_template_string(HTML_PAGE)

@app.route('/api/scrape', methods=['POST'])
def scrape():
    data = request.json
    sources = data.get('sources', [])
    limite = data.get('limite', 10)

    MOTS_BANNIS = ["louange", "worship", "annonce", "teaser", "direct", "concert", "short"]

    ydl_opts = {
        'extract_flat': True,
        'quiet': True,
        'no_warnings': True,
        'playlistend': 50
    }

    def generate():
        corpus = []
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            for item in sources:
                target_url = normaliser_url(item)
                yield f"data: {json.dumps({'log': f'🔍 Analyse de la source : {target_url}'})}\n\n"
                
                try:
                    info = ydl.extract_info(target_url, download=False)
                    entries = info.get('entries', []) if info else []
                    
                    if not entries and info and 'id' in info:
                        entries = [info]
                    
                    yield f"data: {json.dumps({'log': f'ℹ️ {len(entries)} vidéos listées, filtrage en cours...'})}\n\n"
                    
                    compteur = 0
                    for v in entries:
                        if compteur >= limite:
                            break
                        
                        video_id = v.get('id')
                        titre = v.get('title', '')
                        if not video_id or not titre:
                            continue

                        titre_min = titre.lower()

                        # 1. Filtre mots-clés bannis
                        if any(mot in titre_min for mot in MOTS_BANNIS):
                            yield f"data: {json.dumps({'log': f'⏭️ Ignorée (mot clé) : {titre[:45]}...'})}\n\n"
                            continue

                        # 2. Filtre durée (15 à 90 minutes) si disponible
                        duration = v.get('duration')
                        if duration:
                            minutes = duration / 60
                            if not (15 <= minutes <= 90):
                                yield f"data: {json.dumps({'log': f'⏳ Ignorée (durée {int(minutes)}m) : {titre[:45]}...'})}\n\n"
                                continue

                        # 3. Vérification des sous-titres FR
                        has_transcript, detail = verifier_transcription_fr(video_id, ydl)
                        if has_transcript:
                            vid_data = {
                                "video_id": video_id,
                                "url": f"https://www.youtube.com/watch?v={video_id}",
                                "titre": titre,
                                "source": item,
                                "duree_secondes": duration
                            }
                            corpus.append(vid_data)
                            compteur += 1
                            yield f"data: {json.dumps({'log': f'✅ Retenue ({compteur}/{limite}) : {titre[:45]}...'})}\n\n"
                        else:
                            yield f"data: {json.dumps({'log': f'❌ Rejetée ({detail}) : {titre[:45]}...'})}\n\n"

                except Exception as e:
                    yield f"data: {json.dumps({'log': f'⚠️ Erreur sur {item} : {str(e)}'})}\n\n"

        yield f"data: {json.dumps({'done': True, 'corpus': corpus})}\n\n"

    return Response(generate(), mimetype='text/event-stream')

def open_browser():
    webbrowser.open_new('http://127.0.0.1:5000/')

if __name__ == '__main__':
    Timer(1, open_browser).start()
    print("Serveur local lancé sur http://127.0.0.1:5000/")
    app.run(port=5000, debug=False)