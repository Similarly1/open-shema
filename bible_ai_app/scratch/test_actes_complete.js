const fs = require('fs');
const path = 'C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/data/articles/content/tpsg/tpsg_3eb78d8e58b0.md';
let rawText = fs.readFileSync(path, 'utf8');

const theologyCode = fs.readFileSync('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/web/js/theology_view.js', 'utf8');

const vm = require('vm');
const sandbox = { console, window: {}, document: { addEventListener: () => {} }, API: {}, localStorage: { getItem: () => null } };
vm.createContext(sandbox);
vm.runInContext(theologyCode + '\nwindow.TheologyView = TheologyView;', sandbox);

const supToNum = { '⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9' };
const normalizeSuperscripts = (str) => str.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, ch => supToNum[ch] || ch);

function renderMarkdownTest(md) {
  let text = md;

  // Normaliser les exposants dans les références scripturaires
  text = text.replace(/(\b(?:Actes|Genèse|Exode|Lévitique|Nombres|Deutéronome|Josué|Juges|Ruth|Samuel|Rois|Chroniques|Esdras|Néhémie|Esther|Job|Psaumes?|Proverbes?|Ecclésiaste|Cantique|Ésaïe|Jérémie|Lamentations|Ézéchiel|Daniel|Osée|Joël|Amos|Abdias|Jonas|Michée|Nahum|Habacuc|Sophonie|Aggée|Zacharie|Malachie|Matthieu|Marc|Luc|Jean|Romains|Corinthiens|Galates|Éphésiens|Philippiens|Colossiens|Thessaloniciens|Timothée|Tite|Philémon|Hébreux|Jacques|Pierre|Jude|Apocalypse|[123]\s*[A-Za-zÀ-ÿ]+|[A-ZÀ-ÿ]{2,6})\.?)\s*([⁰¹²³⁴⁵⁶⁷⁸⁹]+(?:[\s.:,/-]+[⁰¹²³⁴⁵⁶⁷⁸⁹0-9]+)*)/gi, (match, book, sups) => {
    return book + ' ' + normalizeSuperscripts(sups);
  });

  // Normaliser les espaces manquants après les mots clés d'attribution
  text = text.replace(/(livre|ouvrage|série|revue|magazine|journal)([A-ZÀ-ÿ])/gi, '$1 $2');
  text = text.replace(/([.!?…»])\s*(Cet article\s+(?:fait partie|est extrait|est tiré|a été publié|provient|est une adaptation|est la traduction|est une traduction|est le premier|est le second|est le troisième|est basé)|Extrait du livre|Tiré du livre)/gi, '$1\n\n$2');

  // Convertir les blockquotes
  text = text.replace(/((?:^>[^\n]*\r?\n?)+)/gm, (match) => {
    const bqLines = match.split('\n').map(l => l.replace(/^>\s?/, '').trim()).filter(l => l.length > 0);
    const bqContent = bqLines.join(' ');
    return `\n<blockquote class="article-bible-quote"><p>${bqContent}</p></blockquote>\n\n`;
  });

  // Normaliser les années et plages de pages
  text = text.replace(/(pp?\.\s*|[0-9]+[\s-]*)([⁰¹²³⁴⁵⁶⁷⁸⁹]+)/gi, (match, prefix, sups) => {
    return prefix + normalizeSuperscripts(sups);
  });
  text = text.replace(/([⁰¹²³⁴⁵⁶⁷⁸⁹]{3,})/g, (match) => normalizeSuperscripts(match));

  // Vrais appels de note
  text = text.replace(/\[\^(\d+)\]/g, (match, num) => {
    return `<sup class="article-fn-badge" id="article-fnref-${num}"><a href="#article-fn-${num}" title="Note ${num}">${num}</a></sup>`;
  });
  text = text.replace(/([a-zA-ZÀ-ÿ»"'\).,;!?])\s*([⁰¹²³⁴⁵⁶⁷⁸⁹]{1,2})(?!\w)/g, (match, prevChar, sups) => {
    const num = parseInt(normalizeSuperscripts(sups), 10);
    if (num <= 50) {
      return `${prevChar}<sup class="article-fn-badge" id="article-fnref-${num}"><a href="#article-fn-${num}" title="Note ${num}">${num}</a></sup>`;
    }
    return `${prevChar}${num}`;
  });
  text = text.replace(/([⁰¹²³⁴⁵⁶⁷⁸⁹]+)/g, (match) => normalizeSuperscripts(match));

  // Markdown vers HTML
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/&lt;(\/?(?:div|table|thead|tbody|tr|th|td|blockquote|p|sup|span|a)(?:\s+[a-zA-Z0-9_\-]+="[^"]*")*)(\s*\/)?&gt;/gi, '<$1$2>')
    .replace(/\n\n+/gim, '</p><p>')
    .replace(/\n/gim, '<br>');

  if (sandbox.window.TheologyView && sandbox.window.TheologyView.highlightScriptureReferences) {
    html = sandbox.window.TheologyView.highlightScriptureReferences(html);
  }

  return html;
}

const out = renderMarkdownTest(rawText);
const idx = out.indexOf('Mais vous recevrez');
console.log('--- OUTPUT WITH ACTES ---\n', out.slice(idx - 50, idx + 750));
