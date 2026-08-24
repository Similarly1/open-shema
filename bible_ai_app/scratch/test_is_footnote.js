function isFootnoteBody(body) {
  return /ibid|éditions|editions|editor|publisher|press|university|chapitre|vol\.|tome|trad\.|pp\.\s*\d+|p\.\s*\d+|19\d\d|20\d\d|op\.\s*cit|loc\.\s*cit/i.test(body);
}

const outline1 = "Le message de la croix est une folie que nous devons annoncer (1Co 3.1-4.2).";
const footnote1 = "Jordan B. Peterson, 12 rules for life : an antidote to chaos, New York, Penguin Books, 2018, pp. 133-134.";
const footnote2 = "Ibid., pp. 163-165.";

console.log('Outline is footnote?', isFootnoteBody(outline1)); // false
console.log('Peterson is footnote?', isFootnoteBody(footnote1)); // true
console.log('Ibid is footnote?', isFootnoteBody(footnote2)); // true
