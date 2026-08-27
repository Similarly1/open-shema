const fs = require('fs');

const line31 = `Le premier livre des Rois s’ouvre sur la transition entre le règne de David et celui de Salomon. Deuxièmement, au chapitre 17 du premier livre des Rois, le prophète Élie fait une entrée fracassante en scène; il devient — aux côtés de son antagoniste, le roi Achab — la figure narrative centrale pour la suite de l’ouvrage. Troisièmement, le deuxième livre des Rois commence (plus ou moins) par la transition entre Élie et son protégé, Élisée. Quatrièmement, le chapitre 17 du deuxième livre des Rois relate la destruction de Samarie et la chute du royaume du Nord. Cinquièmement, ce second livre s’achève sur l’héritier du trône de David en exil, mais qui vient de se voir accorder une place à la table du roi de Babylone. Il reste une dernière pièce du puzzle: le nombre onze, correspondant au chapitre 11 du premier livre des Rois. C’est le tournant décisif où le royaume d’Israël se divise sous le règne de Roboam, fils de Salomon, acte qui constitue un jugement de l’Éternel. Toutefois, la fidélité de Dieu à sa promesse envers David garantit que la descendance de ce dernier demeurera sur le trône à Jérusalem (voir 2 Sam. 7).`;

const code = fs.readFileSync('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/web/js/articles_view.js', 'utf8');

const fnStart = code.indexOf('renderMarkdown(md) {');
const fnEnd = code.indexOf('async loadDrawerArticles', fnStart);
const fnBody = code.substring(fnStart, fnEnd);

// Let's execute the lines of fnBody one by one
const lines = fnBody.split('\n');
let currentText = line31;

const supToNum = { '⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9' };
const normalizeSuperscripts = (str) => String(str).replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, ch => supToNum[ch] || ch);
const bibleBooksPattern = '(?:Actes|Genèse|Exode|Lévitique|Nombres|Deutéronome|Josué|Juges|Ruth|Samuel|Rois|Chroniques|Esdras|Néhémie|Esther|Job|Psaumes?|Proverbes?|Ecclésiaste|Cantique|Ésaïe|Jérémie|Lamentations|Ézéchiel|Daniel|Osée|Joël|Amos|Abdias|Jonas|Michée|Nahum|Habacuc|Sophonie|Aggée|Zacharie|Malachie|Matthieu|Marc|Luc|Jean|Romains|Corinthiens|Galates|Éphésiens|Philippiens|Colossiens|Thessaloniciens|Timothée|Tite|Philémon|Hébreux|Jacques|Pierre|Jude|Apocalypse|[123]\\s*[A-Za-zÀ-ÿ]+|Gen|Ex|Lv|Nb|Dt|Jos|Jg|Rt|1S|2S|1R|2R|1Ch|2Ch|Esd|Ne|Est|Jb|Ps|Pr|Ec|Ct|Es|Jr|Lm|Ez|Dn|Os|Jl|Am|Ab|Jon|Mi|Na|Ha|So|Ag|Za|Ml|Mt|Mc|Lc|Jn|Ac|Rm|1Co|2Co|Ga|Ep|Ph|Col|1Th|2Th|1Tm|2Tm|Tt|Phm|He|Jc|1P|2P|1Jn|2Jn|3Jn|Jd|Ap)';
const notBibleRefAhead = `(?!(?:\\s*${bibleBooksPattern}\\.?\\s*[0-9⁰¹²³⁴⁵⁶⁷⁸⁹]))`;

let acc = '';
for (let i = 0; i < lines.length; i++) {
  acc += lines[i] + '\n';
  if (lines[i].includes('text =') || lines[i].includes('text.replace') || lines[i].includes('html =')) {
    try {
      const fn = new Function('text', 'normalizeSuperscripts', 'bibleBooksPattern', 'notBibleRefAhead', `
        let solaImg = '';
        let TheologyView = { highlightScriptureReferences: (h) => h };
        ${acc}
        return typeof html !== 'undefined' ? html : text;
      `);
      const res = fn(line31, normalizeSuperscripts, bibleBooksPattern, notBibleRefAhead);
      if (res && (res.includes('2 Sam.\n') || res.includes('2 Sam.</p>') || res.includes('2 Sam.<br>'))) {
        console.log(`\n===========================================`);
        console.log(`SPLIT DETECTED AT LINE ${i} (${lines[i].trim()})`);
        console.log(`Accumulated snippet:\n`, lines.slice(Math.max(0, i-5), i+1).join('\n'));
        console.log(`===========================================`);
        break;
      }
    } catch(e) {}
  }
}
