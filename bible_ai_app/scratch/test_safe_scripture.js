// Test scripture highlighting safely on HTML without touching tags/attributes
function safeHighlightScripture(html, highlightFn) {
  // Découper par balises HTML
  const parts = html.split(/(<[^>]+>)/g);
  return parts.map(part => {
    // Si c'est une balise HTML (<a ...>, <span ...>, <div ...>), ne pas y toucher !
    if (part.startsWith('<') && part.endsWith('>')) {
      return part;
    }
    // Si c'est du texte libre entre les balises, appliquer la détection scripturaire
    return highlightFn(part);
  }).join('');
}

const testHtml = '<a href="#f37cb7cf-fe9c-40d5-ab75-f586c7d01ece-link" class="article-link">↩︎</a> and <a href="https://example.com/da3d">lien</a> but here is Daniel 3 and Abdias 1 in text.';

function dummyHighlighter(text) {
  return text.replace(/\b(Daniel\s*3|Abdias\s*1)\b/gi, '<span class="ref">$1</span>');
}

console.log('SAFE OUTPUT:\n', safeHighlightScripture(testHtml, dummyHighlighter));
