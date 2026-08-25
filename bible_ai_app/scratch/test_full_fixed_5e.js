const fs = require('fs');
const raw = fs.readFileSync('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/data/articles/content/tpsg/tpsg_37db74ac4df2.md', 'utf8');

const theologyCode = fs.readFileSync('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/web/js/theology_view.js', 'utf8');
let articlesCode = fs.readFileSync('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/web/js/articles_view.js', 'utf8');

// Replace step 5e with the safe uppercase requirement:
articlesCode = articlesCode.replace(
  'text = text.replace(/([:!?…»])\\s*([—–\\u2013\\u2014]\\s*)/g, \'$1\\n\\n$2\');',
  'text = text.replace(/([:!?…»])\\s*([—–\\u2013\\u2014]\\s+[A-ZÀ-ÿ])/g, \'$1\\n\\n$2\');'
);
articlesCode = articlesCode.replace(
  'text = new RegExp(`(?:^|\\\\n)\\\\s*([—–\\\\u2013\\\\u2014]${notBibleRefAhead}\\\\s*[^\\\\n]+)`, \'g\')[Symbol.replace](text, \'\\n\\n<div class="article-speaker-turn"><p class="article-speaker-speech">$1</p></div>\\n\\n\');',
  'text = new RegExp(`(?:^|\\\\n)\\\\s*([—–\\\\u2013\\\\u2014]${notBibleRefAhead}\\\\s+[A-ZÀ-ÿ][^\\\\n]+)`, \'g\')[Symbol.replace](text, \'\\n\\n<div class="article-speaker-turn"><p class="article-speaker-speech">$1</p></div>\\n\\n\');'
);

const vm = require('vm');
const sandbox = { console, window: {}, document: { addEventListener: () => {} }, API: {}, localStorage: { getItem: () => null } };
vm.createContext(sandbox);
vm.runInContext(theologyCode + '\nwindow.TheologyView = TheologyView;', sandbox);
vm.runInContext(articlesCode, sandbox);

const articlesView = sandbox.ArticlesView || sandbox.window.ArticlesView;
const out = articlesView.renderMarkdown(raw);

console.log('--- ALL FOOTNOTES INTEGRITY TEST ---');
const table = [];
for (let i = 1; i <= 7; i++) {
  const inText = out.includes(`id="article-fnref-${i}"`);
  const atBottom = out.includes(`id="article-fn-${i}"`);
  const backlink = out.includes(`href="#article-fnref-${i}"`);
  table.push({ note: i, inText, atBottom, backlink });
}
console.table(table);
