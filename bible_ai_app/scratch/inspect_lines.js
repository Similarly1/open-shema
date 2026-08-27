const fs = require('fs');

const fullMd = fs.readFileSync('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/data/articles/content/e21/e21_8ca9889054b3.md', 'utf8');

// Let's inspect all occurrences of 2 Sam in the file and lines around it
const lines = fullMd.split('\n');
lines.forEach((l, i) => {
  if (l.includes('2 Sam')) {
    console.log(`Line ${i+1}:`, l);
  }
});
