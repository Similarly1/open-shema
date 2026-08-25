const fs = require('fs');
const theologyCode = fs.readFileSync('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/web/js/theology_view.js', 'utf8');
const articlesCode = fs.readFileSync('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/web/js/articles_view.js', 'utf8');

const vm = require('vm');
const sandbox = { console, window: {}, document: { addEventListener: () => {} }, API: {}, localStorage: { getItem: () => null } };
vm.createContext(sandbox);
vm.runInContext(theologyCode + '\nwindow.TheologyView = TheologyView;', sandbox);
vm.runInContext(articlesCode, sandbox);

const articlesView = sandbox.ArticlesView || sandbox.window.ArticlesView;
const raw = fs.readFileSync('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/data/articles/content/tpsg/tpsg_37db74ac4df2.md', 'utf8');
const out = articlesView.renderMarkdown(raw);

console.log('--- CHECK FNREFS IN OUTPUT ---');
for (let i = 1; i <= 7; i++) {
  const refIndex = out.indexOf(`id="article-fnref-${i}"`);
  const fnIndex = out.indexOf(`id="article-fn-${i}"`);
  const backlinkIndex = out.indexOf(`href="#article-fnref-${i}"`);
  console.log(`Note ${i}: fnref=${refIndex !== -1}, fn=${fnIndex !== -1}, backlink=${backlinkIndex !== -1}`);
}
