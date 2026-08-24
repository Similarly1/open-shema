const fs = require('fs');
const path = 'C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/data/articles/content/tpsg/tpsg_70dd88f360e3.md';
let rawText = fs.readFileSync(path, 'utf8');

let t = rawText;
console.log('Step 0 (raw):', t.length);

t = t.replace(/Loading\s+the\s*(?:\[[^\]]*Elevenlabs[^\]]*\]\([^)]+\)|Elevenlabs[^\n.]*)/gi, '');
console.log('Step 1 (Elevenlabs fixed):', t.length);

t = t.replace(/AudioNative\s+Player[\.\u2026]*/gi, '');
console.log('Step 2 (AudioNative):', t.length);

// Découpage automatique des phrases et paragraphes quand tout est sur une seule ligne
t = t.replace(/([.!?…»])\s+([A-ZÀ-ÿ0-9—–«])/g, '$1\n\n$2');
console.log('Step 2b (Auto paragraph break):', t.length);

t = t.replace(/(?:#+\s*)?Parcours\s+e-?mail[\s\S]*$/gi, '');
t = t.replace(/Pour\s+aller\s+plus\s+loin,\s+inscris-toi[\s\S]*$/gi, '');
t = t.replace(/(?:#+\s*)?Inscrivez-vous\s+à\s+notre\s+newsletter[\s\S]*$/gi, '');
console.log('Step 3-5 (Promos):', t.length);

t = t.replace(/^(#\s+[^\n]+\n+)?/gi, '');
t = t.replace(/^(\*\*(?:Auteur|Source|Date|Publié le|Podcast)\s*:\*\*[^\n]*\n*|\*\*Podcast\*\*\s*\n*|Podcast\s*\n*|Auteur\s*:[^\n]*\n*|Source\s*:[^\n]*\n*|Date\s*:[^\n]*\n*|Publié\s+le[^\n]*\n*|---\n*)+/gim, '');
t = t.replace(/^(?:\[[A-ZÉÈÊÀ\s\-]+\]\(https?:\/\/[^\)]+\)\s*)+(?:\d+\s*min\s+de\s+lecture)?[^\n]*\n+/gim, '');
console.log('Step 6-8 (Headers):', t.length);

console.log('\n--- FINAL TEXT PREVIEW ---:\n', t.slice(0, 1000));
