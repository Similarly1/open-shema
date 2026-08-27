const fs = require('fs');

const raw = fs.readFileSync('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/data/articles/content/tpsg/tpsg_d462a3a395d3.md', 'utf8');

const testFunction = (md) => {
  let text = md;

  // 1. Nettoyer Elevenlabs
  text = text.replace(/Loading\s+the\s*(?:\[[^\]]*Elevenlabs[^\]]*\]\([^)]+\)|Elevenlabs[^\n.]*)/gi, '');
  text = text.replace(/AudioNative\s+Player[\.\u2026]*/gi, '');

  // 2. Structurer "Transcription de la prédication" et son avertissement
  text = text.replace(/\s*Transcription\s+de\s+la\s+prédication\s*:?\s*(?:\*?ℹ️\s*([^*]+)\*?)?/gi, (match, note) => {
    const noteHtml = note ? `\n\n<div class="article-editorial-callout"><span class="article-callout-badge">TRANSCRIPTION</span><p class="article-callout-text">ℹ️ ${note.trim()}</p></div>\n\n` : '';
    return `\n\n### Transcription de la prédication\n\n${noteHtml}`;
  });

  // 3. Structurer "Dans la même série"
  text = text.replace(/(?:^|\n|[.!?…»])\s*(Dans\s+la\s+même\s+série\s*:?)\s*(\[|[A-ZÀ-ÿ])/gi, '\n\n### Dans la même série\n\n- $2');
  text = text.replace(/(?<=### Dans la même série[\s\S]*?)(?<=\))\s*([–—-]\s*[A-ZÀ-ÿ][^\n\[]+?)\s+(\[[^\]]+\]\([^)]+\))/g, '$1\n- $2');
  text = text.replace(/(?<=### Dans la même série[\s\S]*?)(?<=\))\s+(\[[^\]]+\]\([^)]+\))/g, '\n- $1');

  // 4. Découper les lignes excessivement longues (ex: transcriptions compactées sans saut de ligne)
  const lines = text.split('\n');
  const processedLines = lines.map(line => {
    if (line.startsWith('#') || line.startsWith('>') || line.startsWith('-') || line.startsWith('<') || line.length < 350) {
      return line;
    }
    let sentenceCount = 0;
    return line.replace(/(?<=[.!?…»])\s+(?!–|—)([A-ZÀ-ÿ«0-9])/g, (match, nextChar) => {
      sentenceCount++;
      if (sentenceCount >= 2) {
        sentenceCount = 0;
        return '\n\n' + nextChar;
      }
      return ' ' + nextChar;
    });
  });
  text = processedLines.join('\n');

  return text;
};

const result = testFunction(raw);
console.log('--- EXTRACT OF PARSED TRANSCRIPTION ARTICLE ---');
const idxSeries = result.indexOf('### Dans la même série');
console.log(result.slice(idxSeries, idxSeries + 1800));
