function annotateSafe(text) {
  if (!text) return '';
  
  // Safe tag-skipping replacer helper
  function replaceOutsideTags(str, regex, replacerFn) {
    return str.replace(regex, (match, ...args) => {
      const fullStr = args[args.length - 1];
      const offset = args[args.length - 2];
      const preceding = fullStr.slice(0, offset);
      const lastOpen = preceding.lastIndexOf('<');
      const lastClose = preceding.lastIndexOf('>');
      if (lastOpen > lastClose) return match; // We are inside <...tag...>
      return replacerFn(match, ...args);
    });
  }

  let res = text;

  // 1. Détection des tomes/colonnes combinés
  const volColRegex = /\b(?:(l\.|lib\.|livre)\s+([IVXLCDM\d]+)\s*,\s*)?(?:(t\.|tome)\s+([IVXLCDM\d]+))\s*,\s*(?:(col\.|colonne|p\.|page)\s*(\d+(?:\s+\d+)?))\b/gi;
  res = replaceOutsideTags(res, volColRegex, (match, lPrefix, lNum, tPrefix, tNum, cPrefix, cNum) => {
    const cleanCol = cNum.replace(/\s+/g, '');
    const isCol = (cPrefix || '').toLowerCase().startsWith('col');
    const unitLabel = isCol ? 'colonne' : 'page';
    const category = isCol ? 'Volume &amp; Colonne' : 'Volume &amp; Page';
    const libPart = lNum ? `Livre ${lNum}, ` : '';
    const titleAttr = `${libPart}Tome ${tNum}, ${unitLabel} ${cleanCol}`;
    const descAttr = `Référence au tome ${tNum}, ${unitLabel} ${cleanCol} de l'ouvrage cité.`;
    return `<span class="theol-latin-gloss" data-gloss-term="${match}" data-gloss-full="${titleAttr}" data-gloss-cat="${category}" data-gloss-desc="${descAttr}">${match}</span>`;
  });

  return res;
}

// Test with already tagged string
const testInput = '<span class="dict-see-meta"><span class="theol-latin-gloss" data-gloss-term="tome 1, colonne 325" data-gloss-full="Tome 1, colonne 325" data-gloss-cat="Volume &amp; Colonne" data-gloss-desc="Référence au tome 1, colonne 325 de l\'ouvrage cité.">tome 1, colonne 325</span></span>';

console.log("Single pass:");
const once = annotateSafe(testInput);
console.log(once);

console.log("\nSecond pass (should NOT corrupt):");
const twice = annotateSafe(once);
console.log(twice);

if (once === twice) {
  console.log("\n SUCCESS: Idempotent and safe against tag corruption!");
} else {
  console.log("\n FAILURE: Corrupted!");
}
