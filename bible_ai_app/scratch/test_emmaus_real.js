const fs = require('fs');
const path = 'C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/data/articles/content/tpsg/tpsg_66d7e7d60d98.md';
let rawText = fs.readFileSync(path, 'utf8');

const theologyCode = fs.readFileSync('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/web/js/theology_view.js', 'utf8');
const articlesCode = fs.readFileSync('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/web/js/articles_view.js', 'utf8');

const vm = require('vm');
const sandbox = { console, window: {}, document: { addEventListener: () => {} }, API: {}, localStorage: { getItem: () => null } };
vm.createContext(sandbox);
vm.runInContext(theologyCode + '\nwindow.TheologyView = TheologyView;', sandbox);
vm.runInContext(articlesCode, sandbox);

const articlesView = sandbox.ArticlesView || sandbox.window.ArticlesView;
const output = articlesView.renderMarkdown(rawText);

const idx = output.indexOf('article-editorial-footer-card');
console.log('Found card?', idx !== -1);
if (idx !== -1) {
  console.log('CARD HTML:\n', output.slice(idx));
} else {
  console.log('END OF OUTPUT:\n', output.slice(-600));
}
