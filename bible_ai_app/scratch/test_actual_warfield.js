const fs = require('fs');
const raw = fs.readFileSync('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/data/articles/content/tpsg/tpsg_37db74ac4df2.md', 'utf8');

const theologyCode = fs.readFileSync('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/web/js/theology_view.js', 'utf8');
const articlesCode = fs.readFileSync('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/web/js/articles_view.js', 'utf8');

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
