const supToNum = { '⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9' };

function normalizeSuperscriptDigits(str) {
  return str.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, ch => supToNum[ch] || ch);
}

function processSuperscripts(text) {
  // 1. Normaliser les espaces manquants après les mots clés d'attribution (ex: "livreIl" -> "livre Il")
  text = text.replace(/(livre|ouvrage|série|revue|magazine|journal)([A-ZÀ-ÿ])/gi, '$1 $2');

  // 2. Dans les blocs d'attribution éditoriale / bibliographique, convertir tous les exposants en chiffres normaux
  text = text.replace(/(?:Cet article|Extrait du livre|Tiré du livre|Publié avec)[^\n]+/gi, (match) => {
    return normalizeSuperscriptDigits(match);
  });

  // 3. Normaliser les plages de pages et années avec exposants
  text = text.replace(/(pp?\.\s*|[0-9]+[\s-]*)([⁰¹²³⁴⁵⁶⁷⁸⁹]+)/gi, (match, prefix, sups) => {
    return prefix + normalizeSuperscriptDigits(sups);
  });
  text = text.replace(/([⁰¹²³⁴⁵⁶⁷⁸⁹]{3,})/g, (match) => {
    return normalizeSuperscriptDigits(match);
  });

  // 4. Convertir les vrais appels de note explicites [^1]
  text = text.replace(/\[\^(\d+)\]/g, (match, num) => {
    return `<sup class="article-fn-badge" id="article-fnref-${num}"><a href="#article-fn-${num}" title="Note ${num}">${num}</a></sup>`;
  });

  // 5. Convertir les exposants restants en vrais appels de note uniquement si valeur <= 50 et pas précédé de caractères de mesure
  text = text.replace(/([a-zA-ZÀ-ÿ»"'\).,;!?])\s*([⁰¹²³⁴⁵⁶⁷⁸⁹]{1,2})(?!\w)/g, (match, prevChar, sups) => {
    const num = parseInt(normalizeSuperscriptDigits(sups), 10);
    if (num <= 50) {
      return `${prevChar}<sup class="article-fn-badge" id="article-fnref-${num}"><a href="#article-fn-${num}" title="Note ${num}">${num}</a></sup>`;
    }
    return `${prevChar}${num}`;
  });

  // Pour tout exposant résiduel non associé à une fin de mot/phrase, normaliser en chiffre
  text = text.replace(/([⁰¹²³⁴⁵⁶⁷⁸⁹]+)/g, (match) => {
    return normalizeSuperscriptDigits(match);
  });

  return text;
}

const tests = [
  "la grâce de la vie nouvelle ⁹ .",
  "Jordan B. Peterson, 12 rules for life... Penguin Books, 2018, pp. 133-134. [↩︎](#...)",
  "Cet article est extrait du livreIl t’offre sa grâce : ³⁰ méditations pour les défis de la vie de maman, de Linda Green et Sarah Walton, BLF Éditions, ²⁰²⁵, pp. ¹⁵³-¹⁵⁶.",
  "Dans le 1er siècle, vers l'an 50..."
];

tests.forEach((t, i) => {
  console.log(`\n--- Test ${i+1} ---`);
  console.log(processSuperscripts(t));
});
