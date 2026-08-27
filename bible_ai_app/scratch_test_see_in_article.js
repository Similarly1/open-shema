const testLine = "Voir la description de l'aire de l'aigle dans l'article AIGLE 1, col. 300-301.";

function parseSeeLine(raw) {
  const voirMatch = raw.match(/^[*•-]?\s*(?:\*+|_+)?\s*(?:Voir|Voyez)(?:\s+(?:aussi|également))?\s*(?:\*+|_+)?\s*:?\s*(.*)$/i);
  if (!voirMatch) return null;

  let candidate = voirMatch[1].trim();

  // Pattern: "Voir [intro] dans l'article (de) [WORD] [meta/qualifier]"
  const inArticleMatch = candidate.match(/^(.*?)\s+(?:dans|à|sous)\s+l['’]article(?:\s+de)?\s+([A-ZÉÈÊËÀÂÄÎÏÔÖÙÛÜÇ\-\s]+?)(?:\s+([0-9IVXLCDM]+.*|[,\.\(].*))?$/i);
  if (inArticleMatch) {
    const introText = inArticleMatch[1].trim();
    const word = inArticleMatch[2].trim();
    const extraMeta = inArticleMatch[3] ? inArticleMatch[3].trim() : '';

    return {
      type: 'inArticle',
      intro: introText,
      word: word,
      meta: extraMeta
    };
  }

  return { type: 'standard', text: candidate };
}

console.log("=== PARSED RESULT ===");
console.log(parseSeeLine(testLine));
