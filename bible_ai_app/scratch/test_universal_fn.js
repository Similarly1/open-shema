const samples = [
  'invitation à la conversation». [[[^1]](#fn1) . Les parents',
  'la perfection». [[[^2]](#fn2) . Cette distinction',
  'idées séculières». [[[^3]](#fn3) Les parents',
  'notre Sauveur est fort». [[^4]]](#fn4) L’espérance',
  'texte [^5] suite',
  'texte [[6]](#fn6) suite',
  'texte [7](#fn7) suite',
  'texte [[¹]](#fn1) suite'
];

const supToNum = { '⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9' };
const normalizeSuperscripts = (str) => String(str).replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, ch => supToNum[ch] || ch);

function convertFootnotes(text) {
  text = text.replace(/\[+(?:\^)?([0-9¹²³⁴⁵⁶⁷⁸⁹]+)\]+(?:\(#(?:fn|article-fn|note|ftnt)[^)]*\))?\]*/gi, (match, n) => {
    const num = parseInt(normalizeSuperscripts(n), 10);
    if (num >= 1 && num <= 99) {
      return `<sup class="article-fn-badge" id="article-fnref-${num}"><a href="#article-fn-${num}" title="Note ${num}">${num}</a></sup>`;
    }
    return match;
  });

  // Nettoyer les espaces avant ponctuation
  text = text.replace(/<\/sup>\s+([.,;:!?])/g, '</sup>$1');
  return text;
}

samples.forEach((s, idx) => {
  console.log(`\n--- Sample ${idx+1} ---`);
  console.log("Original :", s);
  console.log("Converted:", convertFootnotes(s));
});
