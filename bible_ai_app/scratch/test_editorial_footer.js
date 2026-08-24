function getEditorialBadgeLabel(text) {
  const lower = text.toLowerCase();
  if (/extrait\s+du\s+livre|tiré\s+du\s+livre|chapitre\s+\d+|éditions|editions|éditeur|ouvrage/i.test(lower)) {
    return 'EXTRAIT D’OUVRAGE';
  }
  if (/série\s+de|série\s+sur|épisode\s+\d+|partie\s+\d+|série/i.test(lower)) {
    return 'SÉRIE THÉMATIQUE';
  }
  if (/travail\s+de\s+recherche|thèse|mémoire|séminaire|seminary|académique/i.test(lower)) {
    return 'RECHERCHE & SÉMINAIRE';
  }
  if (/traduction|traduit\s+de|autoris|droits\s+réservés/i.test(lower)) {
    return 'NOTE ÉDITORIALE';
  }
  return 'CONTEXTE & PROVENANCE';
}

function processEditorialFooter(text) {
  return text.replace(
    /(?:^|\n\n+)((?:Cet article\s+(?:fait partie|est extrait|est tiré|a été publié|provient|est une adaptation|est la traduction|est une traduction)|Extrait du livre|Tiré du livre|Publié avec l[’']autorisation)[^\n]+(?:\n[^\n]+)*)(?=\s*$)/gi,
    (match, content) => {
      const badge = getEditorialBadgeLabel(content);
      return `\n\n<div class="article-editorial-footer-card"><div class="article-editorial-footer-header"><span class="article-editorial-badge">${badge}</span></div><div class="article-editorial-footer-content">${content.trim()}</div></div>\n\n`;
    }
  );
}

const sample1 = `Gardons les yeux fixés sur Christ.

Cet article fait partie d’une série de trois sur la Bible et la tradition. Ils sont tirés et adaptés d’un travail de recherche effectué par Derek sous la direction de Dr Kyle Claunch au [Southern Baptist Theological Seminary](https://www.sbts.edu/) en octobre 2021.`;

const sample2 = `La grâce de Dieu est suffisante pour chacun de nous.

Cet article est extrait du livre [Où est ta foi ?](https://blfstore.com/collections/all/products/ou-est-ta-foi/?bg_ref=f5HKGMgR9Q) , de Jon Bloom, BLF Éditions, 2016, chapitre 26, pp. 166-170. Publié avec l’autorisation de l’éditeur. Tous droits réservés.`;

console.log('--- SAMPLE 1 ---');
console.log(processEditorialFooter(sample1));

console.log('\n--- SAMPLE 2 ---');
console.log(processEditorialFooter(sample2));
