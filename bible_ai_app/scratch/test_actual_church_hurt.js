const fs = require('fs');
const theologyCode = fs.readFileSync('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/web/js/theology_view.js', 'utf8');
const articlesCode = fs.readFileSync('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/web/js/articles_view.js', 'utf8');

const vm = require('vm');
const sandbox = { console, window: {}, document: { addEventListener: () => {} }, API: {}, localStorage: { getItem: () => null } };
vm.createContext(sandbox);
vm.runInContext(theologyCode + '\nwindow.TheologyView = TheologyView;', sandbox);
vm.runInContext(articlesCode, sandbox);

const articlesView = sandbox.ArticlesView || sandbox.window.ArticlesView;
const raw = fs.readFileSync('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/data/articles/content/tpsg/tpsg_a060357a99da.md', 'utf8');
const out = articlesView.renderMarkdown(raw);

const idxCard = out.indexOf('article-editorial-footer-card');
console.log('--- EDITORIAL FOOTER CARD FOUND?', idxCard !== -1);
if (idxCard !== -1) {
  console.log('\n--- OUTPUT AT END ---\n', out.slice(idxCard));
} else {
  console.log('\n--- END OF ARTICLE ---\n', out.slice(-600));
}
