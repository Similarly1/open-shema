const fs = require('fs');

const fullMd = fs.readFileSync('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/data/articles/content/e21/e21_8ca9889054b3.md', 'utf8');

const rawFunction = fs.readFileSync('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/web/js/articles_view.js', 'utf8');

// Let's extract renderMarkdown lines and test line by line
const fnStart = rawFunction.indexOf('renderMarkdown(md) {');
const fnEnd = rawFunction.indexOf('async loadDrawerArticles', fnStart);
const fnBody = rawFunction.substring(fnStart, fnEnd);

console.log("fnBody length:", fnBody.length);

// Let's run the actual function with intermediate inspection
let text = fullMd;

const steps = fnBody.split('text = ');
console.log("Total text assignment steps:", steps.length);

for (let i = 1; i < steps.length; i++) {
  const stepCode = 'text = ' + steps[i].split(';\n')[0] + ';';
  try {
    const fn = new Function('text', 'normalizeSuperscripts', 'bibleBooksPattern', 'notBibleRefAhead', 'solaImg', `${stepCode}; return text;`);
    const supToNum = { '⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9' };
    const normalizeSuperscripts = (str) => String(str).replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, ch => supToNum[ch] || ch);
    const bibleBooksPattern = '(?:Actes|Genèse|Exode|Lévitique|Nombres|Deutéronome|Josué|Juges|Ruth|Samuel|Rois|Chroniques|Esdras|Néhémie|Esther|Job|Psaumes?|Proverbes?|Ecclésiaste|Cantique|Ésaïe|Jérémie|Lamentations|Ézéchiel|Daniel|Osée|Joël|Amos|Abdias|Jonas|Michée|Nahum|Habacuc|Sophonie|Aggée|Zacharie|Malachie|Matthieu|Marc|Luc|Jean|Romains|Corinthiens|Galates|Éphésiens|Philippiens|Colossiens|Thessaloniciens|Timothée|Tite|Philémon|Hébreux|Jacques|Pierre|Jude|Apocalypse|[123]\\s*[A-Za-zÀ-ÿ]+|Gen|Ex|Lv|Nb|Dt|Jos|Jg|Rt|1S|2S|1R|2R|1Ch|2Ch|Esd|Ne|Est|Jb|Ps|Pr|Ec|Ct|Es|Jr|Lm|Ez|Dn|Os|Jl|Am|Ab|Jon|Mi|Na|Ha|So|Ag|Za|Ml|Mt|Mc|Lc|Jn|Ac|Rm|1Co|2Co|Ga|Ep|Ph|Col|1Th|2Th|1Tm|2Tm|Tt|Phm|He|Jc|1P|2P|1Jn|2Jn|3Jn|Jd|Ap)';
    const notBibleRefAhead = `(?!(?:\\s*${bibleBooksPattern}\\.?\\s*[0-9⁰¹²³⁴⁵⁶⁷⁸⁹]))`;
    const solaImg = '';
    const before = text;
    text = fn(text, normalizeSuperscripts, bibleBooksPattern, notBibleRefAhead, solaImg);
    if (!before.includes('2 Sam.\n') && (text.includes('2 Sam.\n') || text.includes('2 Sam.</p>'))) {
      console.log(`\n!!! SPLIT HAPPENED AT STEP ${i} !!!`);
      console.log("Code:", stepCode.substring(0, 300));
      const m = text.match(/2 Sam[^\n]*\n+[^\n]*7/);
      if (m) console.log("Matched:", JSON.stringify(m[0]));
    }
  } catch (e) {
    // console.log(`Step ${i} error:`, e.message);
  }
}
