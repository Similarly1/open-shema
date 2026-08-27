function parseBullets(text) {
  const lines = text.split(/\r?\n/);
  const out = [];
  let inUlList = false;
  let inCategoryHeader = false;

  lines.forEach(line => {
    const raw = line.trim();
    if (!raw) {
      if (inUlList) { out.push('</ul>'); inUlList = false; }
      inCategoryHeader = false;
      return;
    }

    const bulletMatch = line.match(/^(\s*)[*•-]\s+(.+)$/);
    if (bulletMatch) {
      if (!inUlList) {
        out.push('<ul class="dict-bullet-list">');
        inUlList = true;
      }

      const spaces = bulletMatch[1].length;
      let itemContent = bulletMatch[2].trim();
      
      const isHeaderOnly = /^\*\*[^*]+:\*\*\s*$/.test(itemContent) || /^\*\*[^*]+\*\*\s*:\s*$/.test(itemContent);
      
      let isNested = (spaces >= 2);
      if (!isNested && inCategoryHeader && !isHeaderOnly) {
        isNested = true;
      }

      if (isHeaderOnly) {
        inCategoryHeader = true;
      } else if (spaces === 0 && !isHeaderOnly && (itemContent.includes('. ') || itemContent.length > 80)) {
        inCategoryHeader = false;
      }

      const itemFormatted = itemContent
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>');

      const nestedClass = isNested ? ' dict-bullet-nested' : (isHeaderOnly ? ' dict-bullet-category' : '');
      out.push(`  <li class="dict-bullet-item${nestedClass}">${itemFormatted}</li>`);
      return;
    } else {
      if (inUlList) { out.push('</ul>'); inUlList = false; }
      inCategoryHeader = false;
    }

    out.push(`<p>${raw}</p>`);
  });

  if (inUlList) out.push('</ul>');
  return out.join('\n');
}

const sample = `### 4. Représentations iconographiques
Les Apôtres ont été très tôt représentés dans l'art chrétien, notamment dans les catacombes et sur les sarcophages.
*   **Attributs vestimentaires :** Ils sont généralement vêtus d'une longue tunique et d'un pallium.
*   **Symbolisme :** Ils portent souvent un rouleau (la parole divine) ou une couronne (récompense céleste).
*   **Attributs individuels :**
    *   S. Pierre : les clefs.
    *   S. Paul : le glaive.
    *   S. André : la croix en X.
`;

console.log(parseBullets(sample));
