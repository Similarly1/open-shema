const fs = require('fs');

const theologyCode = fs.readFileSync('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/web/js/theology_view.js', 'utf8');
let articlesCode = fs.readFileSync('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/web/js/articles_view.js', 'utf8');

// Insert new transcription & series parsing and long-line sentence grouping
articlesCode = articlesCode.replace(
  `    // 1b-2. Si l'article entier est sur une seule ligne compactée, découper proprement les paragraphes (sans couper les initiales d'auteurs C., S., J., etc., ni abréviations)
    if (!text.includes('\\n\\n')) {
      text = text.replace(/(?<!\\b(?:pp|p|chap|ch|vol|v|vs|dr|etc|ex|cf|art|[A-ZÀ-ÿ]|\\d+))\\.\\s+(?!–|—)([A-ZÀ-ÿ«])/g, '.\\n\\n$1');
      text = text.replace(/([!?…»])\\s+(?!–|—)([A-ZÀ-ÿ0-9«])/g, '$1\\n\\n$2');
    }`,
  `    // 1b-2. Structurer "Transcription de la prédication" et son avertissement
    text = text.replace(/\\s*Transcription\\s+de\\s+la\\s+prédication\\s*:?\\s*(?:\\*?ℹ️\\s*([^*]+)\\*?)?/gi, (match, note) => {
      const noteHtml = note ? \`\\n\\n<div class="article-info-callout"><span>ℹ️</span><div>\${note.trim()}</div></div>\\n\\n\` : '';
      return \`\\n\\n### Transcription de la prédication\\n\\n\${noteHtml}\`;
    });

    // 1b-3. Structurer "Dans la même série"
    text = text.replace(/(?:^|\\n|[.!?…»])\\s*(Dans\\s+la\\s+même\\s+série\\s*:?)\\s*(\\[|[A-ZÀ-ÿ])/gi, '\\n\\n### Dans la même série\\n\\n- $2');
    text = text.replace(/(?<=### Dans la même série[\\s\\S]*?)(?<=\\))\\s*([—–\\u2013\\u2014-]\\s*[A-ZÀ-ÿ][^\\n\\[]+?)\\s+(\\[[^\\]]+\\]\\([^)]+\\))/g, '$1\\n- $2');
    text = text.replace(/(?<=### Dans la même série[\\s\\S]*?)(?<=\\))\\s+(\\[[^\\]]+\\]\\([^)]+\\))/g, '\\n- $1');

    // 1b-4. Découper les lignes excessivement longues (transcriptions ou articles compactés) en paragraphes de 2-3 phrases
    const lines = text.split('\\n');
    const processedLines = lines.map(line => {
      if (line.startsWith('#') || line.startsWith('>') || line.startsWith('-') || line.startsWith('<') || line.length < 350) {
        return line;
      }
      let sentenceCount = 0;
      return line.replace(/(?<=[.!?…»])\\s+(?!–|—)([A-ZÀ-ÿ«0-9])/g, (match, nextChar) => {
        sentenceCount++;
        if (sentenceCount >= 2) {
          sentenceCount = 0;
          return '\\n\\n' + nextChar;
        }
        return ' ' + nextChar;
      });
    });
    text = processedLines.join('\\n');`
);

const vm = require('vm');
const sandbox = { console, window: {}, document: { addEventListener: () => {} }, API: {}, localStorage: { getItem: () => null } };
vm.createContext(sandbox);
vm.runInContext(theologyCode + '\nwindow.TheologyView = TheologyView;', sandbox);
vm.runInContext(articlesCode, sandbox);

const articlesView = sandbox.ArticlesView || sandbox.window.ArticlesView;

// Test 1: Sermon transcription
const rawSermon = fs.readFileSync('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/data/articles/content/tpsg/tpsg_d462a3a395d3.md', 'utf8');
const outSermon = articlesView.renderMarkdown(rawSermon);
const idxSermon = outSermon.indexOf('Dans la même série');
console.log('=== TEST 1: SERMON TRANSCRIPTION ===');
console.log(outSermon.slice(idxSermon, idxSermon + 1200));

// Test 2: Warfield Footnotes
const rawWarfield = fs.readFileSync('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/data/articles/content/tpsg/tpsg_37db74ac4df2.md', 'utf8');
const outWarfield = articlesView.renderMarkdown(rawWarfield);
const tableWarfield = [];
for (let i = 1; i <= 7; i++) {
  tableWarfield.push({ note: i, inText: outWarfield.includes(`id="article-fnref-${i}"`), atBottom: outWarfield.includes(`id="article-fn-${i}"`) });
}
console.log('\n=== TEST 2: WARFIELD FOOTNOTES ===');
console.table(tableWarfield);

// Test 3: CS Lewis Quote
const rawLewis = fs.readFileSync('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/data/articles/content/tpsg/tpsg_c38c0c224a72.md', 'utf8');
const outLewis = articlesView.renderMarkdown(rawLewis);
const idxLewis = outLewis.indexOf('aversion pour les mêmes choses');
console.log('\n=== TEST 3: CS LEWIS QUOTE ===');
console.log(outLewis.slice(idxLewis - 40, idxLewis + 400));
