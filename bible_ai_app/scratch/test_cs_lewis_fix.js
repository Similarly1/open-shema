const fs = require('fs');
const raw = fs.readFileSync('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/data/articles/content/tpsg/tpsg_c38c0c224a72.md', 'utf8');

let text = raw;

// 1. Nettoyer les résidus de lecteur ElevenLabs
text = text.replace(/Loading\s+the\s*(?:\[[^\]]*Elevenlabs[^\]]*\]\([^)]+\)|Elevenlabs[^\n.]*)/gi, '');
text = text.replace(/AudioNative\s+Player[\.\u2026]*/gi, '');

// Convertir les blockquotes Markdown (> Citation [– Auteur]) AVANT le découpage de phrases de step 1b
text = text.replace(/(?:^|\n)>\s*([^\n]+(?:\n(?!>|[#\n]|---)[^\n]+)*)/g, (match, bqContent) => {
  let content = bqContent.replace(/\n>\s*/g, ' ').replace(/\n/g, ' ').trim();
  
  // Séparer l'attribution d'auteur / ouvrage et le paragraphe suivant collé
  const authorMatch = content.match(/^([\s\S]+?)\s+([—–\u2013\u2014-]\s*[A-ZÀ-ÖØ-ß][^\n]*?\*(?:\[[^\]]+\]\([^)]+\)|[^*]+)\*[.,\s]*)(?:\s+([A-ZÀ-ÿ«][\s\S]*))?$/);
  if (authorMatch) {
    const quoteText = authorMatch[1].trim();
    const quoteAuthor = authorMatch[2].trim();
    const nextParagraph = authorMatch[3] ? `\n\n${authorMatch[3].trim()}` : '';
    return `\n\n<blockquote class="article-bible-quote"><p>${quoteText}</p><footer class="article-quote-author">${quoteAuthor}</footer></blockquote>${nextParagraph}\n\n`;
  }
  
  // Si attribution simple sans astérisques de livre (ex: "– C. S. Lewis.")
  const simpleAuthorMatch = content.match(/^([\s\S]+?)\s+([—–\u2013\u2014-]\s*[A-ZÀ-ÖØ-ß][a-zà-öø-ÿ.]*(?:\s+[A-ZÀ-ÖØ-ß][a-zà-öø-ÿ.]*){1,4}[.,\s]*)(?:\s+([A-ZÀ-ÿ«][\s\S]*))?$/);
  if (simpleAuthorMatch) {
    const quoteText = simpleAuthorMatch[1].trim();
    const quoteAuthor = simpleAuthorMatch[2].trim();
    const nextParagraph = simpleAuthorMatch[3] ? `\n\n${simpleAuthorMatch[3].trim()}` : '';
    return `\n\n<blockquote class="article-bible-quote"><p>${quoteText}</p><footer class="article-quote-author">${quoteAuthor}</footer></blockquote>${nextParagraph}\n\n`;
  }

  return `\n\n<blockquote class="article-bible-quote"><p>${content}</p></blockquote>\n\n`;
});

// 1b. Si l'article entier est sur une seule ligne compactée, découper proprement les paragraphes
if (!text.includes('\n\n')) {
  text = text.replace(/(?<!\b(?:pp|p|chap|ch|vol|v|vs|dr|etc|ex|cf|art|[A-ZÀ-ÿ]|\d+))\.\s+(?!–|—)([A-ZÀ-ÿ«])/g, '.\n\n$1');
  text = text.replace(/([!?…»])\s+(?!–|—)([A-ZÀ-ÿ0-9«])/g, '$1\n\n$2');
}

const idxLewis = text.indexOf('aversion pour les mêmes choses');
console.log('--- EXTRACT AT CS LEWIS ---');
console.log(text.slice(idxLewis - 40, idxLewis + 650));
