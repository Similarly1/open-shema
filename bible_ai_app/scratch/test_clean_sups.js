const supToNum = { '⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9' };

function normalizeSuperscriptDigits(str) {
  return str.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, ch => supToNum[ch] || ch);
}

let sample = "Cet article est extrait du livreIl t’offre sa grâce : ³⁰ méditations pour les défis de la vie de maman, de Linda Green et Sarah Walton, BLF Éditions, ²⁰²⁵, pp. ¹⁵³-¹⁵⁶.";

// 1. Normaliser les espaces manquants après les mots clés d'attribution (ex: "livreIl" -> "livre Il")
sample = sample.replace(/(livre|ouvrage|série|revue|magazine|journal)([A-ZÀ-ÿ])/gi, '$1 $2');

// 2. Dans les blocs d'attribution éditoriale / bibliographique, convertir tous les exposants en chiffres normaux
sample = sample.replace(/(?:Cet article|Extrait du livre|Tiré du livre|Publié avec)[^\n]+/gi, (match) => {
  return normalizeSuperscriptDigits(match);
});

// 3. Partout dans le texte, normaliser les années (ex: ²⁰²⁵ -> 2025) et numéros de pages (ex: pp. ¹⁵³ -> pp. 153)
sample = sample.replace(/(pp?\.\s*|[0-9]+-)([⁰¹²³⁴⁵⁶⁷⁸⁹]+)/gi, (match, prefix, sups) => {
  return prefix + normalizeSuperscriptDigits(sups);
});
sample = sample.replace(/([⁰¹²³⁴⁵⁶⁷⁸⁹]{4})/g, (match) => {
  return normalizeSuperscriptDigits(match);
});

console.log('CLEANED:\n', sample);
