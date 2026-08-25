const fs = require('fs');
const raw = fs.readFileSync('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/data/articles/content/tpsg/tpsg_37db74ac4df2.md', 'utf8');

const supToNum = { '⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9' };
const normalizeSuperscripts = (str) => str.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, ch => supToNum[ch] || ch);

let text = raw;

// 1. Découpage des paragraphes si une seule ligne
if (!text.includes('\n\n')) {
  text = text.replace(/(?<!\b(?:pp|p|chap|ch|vol|v|vs|dr|etc|ex|cf|art|\d+))\.\s+([A-ZÀ-ÿ—–«])/gi, '.\n\n$1');
  text = text.replace(/([!?…»])\s+([A-ZÀ-ÿ0-9—–«])/g, '$1\n\n$2');
}

// 5a-1. Strict Bible book list for superscript normalization (e.g. Actes ¹.⁸-¹¹ -> Actes 1.8-11, Éphésiens ³.¹⁴-¹⁵)
const bibleBooks = '(?:Actes|Genèse|Exode|Lévitique|Nombres|Deutéronome|Josué|Juges|Ruth|Samuel|Rois|Chroniques|Esdras|Néhémie|Esther|Job|Psaumes?|Proverbes?|Ecclésiaste|Cantique|Ésaïe|Jérémie|Lamentations|Ézéchiel|Daniel|Osée|Joël|Amos|Abdias|Jonas|Michée|Nahum|Habacuc|Sophonie|Aggée|Zacharie|Malachie|Matthieu|Marc|Luc|Jean|Romains|Corinthiens|Galates|Éphésiens|Philippiens|Colossiens|Thessaloniciens|Timothée|Tite|Philémon|Hébreux|Jacques|Pierre|Jude|Apocalypse|[123]\\s*[A-Za-zÀ-ÿ]+|Gen|Ex|Lv|Nb|Dt|Jos|Jg|Rt|1S|2S|1R|2R|1Ch|2Ch|Esd|Ne|Est|Jb|Ps|Pr|Ec|Ct|Es|Jr|Lm|Ez|Dn|Os|Jl|Am|Ab|Jon|Mi|Na|Ha|So|Ag|Za|Ml|Mt|Mc|Lc|Jn|Ac|Rm|1Co|2Co|Ga|Ep|Ph|Col|1Th|2Th|1Tm|2Tm|Tt|Phm|He|Jc|1P|2P|1Jn|2Jn|3Jn|Jd|Ap)';

text = text.replace(new RegExp(`(\\b${bibleBooks}\\.?)\\s*([⁰¹²³⁴⁵⁶⁷⁸⁹]+(?:[\\s.:,/-]+[⁰¹²³⁴⁵⁶⁷⁸⁹0-9]+)*)`, 'gi'), (match, book, sups) => {
  return book + ' ' + normalizeSuperscripts(sups);
});

console.log('After strict 5a-1: ² exists?', text.includes('²'));
console.log('After strict 5a-1: ⁷ exists?', text.includes('⁷'));

// 5g. Détecter et formater les blocs de notes de bas de page avec ancres de retour [↩︎](#...)
const backlinkRegex = /\[(?:↩︎|↩)\]\(#[^)]+\)/;
if (backlinkRegex.test(text)) {
  text = text.replace(/Dans\s+la\s+même\s+série[\s\S]*$/gi, '');
  const segments = text.split(/\[(?:↩︎|↩)\]\(#[^)]+\)/);
  let mainBody = segments[0];
  let firstNote = '';
  
  const fnBoundaryMatch = mainBody.match(/^([\s\S]*[a-zA-ZÀ-ÿ]{2,}[.!?…»])\s+((?:[A-ZÀ-ÖØ-ß][a-zà-öø-ÿ]+(?:\s+[A-ZÀ-ÖØ-ß]\.?)?\s+[A-ZÀ-ÖØ-ß][a-zà-öø-ÿ]+|[A-ZÀ-ÿ*«]|Ibid)[^\n]*?(?:ibid|éditions|editions|editor|publisher|press|university|chapitre|vol\.|tome|trad\.|pp?\.\s*\d+|p\.\s*\d+|19\d\d|20\d\d|op\.\s*cit|loc\.\s*cit)[\s\S]*)$/i);
  if (fnBoundaryMatch) {
    mainBody = fnBoundaryMatch[1];
    firstNote = fnBoundaryMatch[2];
  }
  
  const notes = [firstNote, ...segments.slice(1, -1)].map(s => s.trim()).filter(s => s.length > 0);
  const trailing = segments[segments.length - 1] || '';
  
  const formattedNotes = notes.map((noteText, idx) => {
    const num = idx + 1;
    const cleanBody = normalizeSuperscripts(noteText.trim());
    return `<div class="article-footnote-item" id="article-fn-${num}"><span class="article-footnote-num">${num}.</span><span class="article-footnote-text">${cleanBody}</span> <a href="#article-fnref-${num}" class="article-footnote-backlink" title="Retour au texte">↩</a></div>`;
  }).join('\n\n');
  
  text = `${mainBody}\n\n${formattedNotes}\n\n${trailing}`;
}

// 5j. Remplacer les vrais appels de note
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

console.log('--- VERIFICATION DES 7 NOTES ---');
const res = [];
for (let i = 1; i <= 7; i++) {
  const inText = text.includes(`id="article-fnref-${i}"`);
  const atBottom = text.includes(`id="article-fn-${i}"`);
  const backlink = text.includes(`href="#article-fnref-${i}"`);
  res.push({ note: i, inText, atBottom, backlink });
}
console.table(res);
