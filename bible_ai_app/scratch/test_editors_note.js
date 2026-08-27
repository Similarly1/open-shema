const sample1 = `
Editors’ note:

Initialement publié le 3 février 2022

#### La théologie biblique

Nous commencerons par la théologie biblique, puisque c’est ce dont nous parlons, plus ou moins, depuis l’introduction.
`;

const sample2 = `
**Editors' note:** Initialement publié le 15 mai 2023.

Cet article est le premier d'une série.
`;

const sample3 = `
Note de l’éditeur : Initialement publié le 10 janvier 2021 sur TGC.
`;

function formatEditorsNote(text) {
  text = text.replace(/(?:^|\n)(?:(?:\*\*)?\s*(?:Editors[’']\s*note|Note\s+de\s+l[’']éditeur|Editor[’']s\s+note|Note\s+de\s+la\s+rédaction|NDLR)\s*(?:\*\*)?\s*:?\s*\n*)+(?:\*\*)?\s*(Initialement\s+publié\s+le[^\n*]+|[^\n]+?)\s*(?:\*\*)?(?=\n|$)/gi, (match, noteContent) => {
    let clean = noteContent.replace(/^\*+\s*/, '').replace(/\*+$/, '').trim();
    return `\n\n<div class="article-editors-note-banner"><strong>Editors’ note:</strong> ${clean}</div>\n\n`;
  });
  return text;
}

console.log("=== SAMPLE 1 ===");
console.log(formatEditorsNote(sample1));

console.log("=== SAMPLE 2 ===");
console.log(formatEditorsNote(sample2));

console.log("=== SAMPLE 3 ===");
console.log(formatEditorsNote(sample3));
