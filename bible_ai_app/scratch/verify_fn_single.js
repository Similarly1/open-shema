const fs = require('fs');
const vm = require('vm');

const theologyCode = fs.readFileSync('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/web/js/theology_view.js', 'utf8');
const articlesCode = fs.readFileSync('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/web/js/articles_view.js', 'utf8');

const sandbox = {
  console,
  window: {},
  document: { addEventListener: () => {}, getElementById: () => null },
  API: {},
  localStorage: { getItem: () => null }
};

vm.createContext(sandbox);
vm.runInContext(theologyCode + '\nwindow.TheologyView = TheologyView;', sandbox);
vm.runInContext(articlesCode, sandbox);

const articlesView = sandbox.ArticlesView || sandbox.window.ArticlesView;

const md = fs.readFileSync('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/data/articles/content/e21/e21_0ecdb60028ad.md', 'utf8');
const html = articlesView.renderMarkdown(md);

const sectionCount = (html.match(/<div class="article-footnotes-section">/g) || []).length;
console.log(`Footnote section containers count: ${sectionCount}`);

const fnItems = html.match(/<div class="article-footnote-item" id="article-fn-\d+">[\s\S]*?<\/div>/g) || [];
console.log(`Footnote items count: ${fnItems.length}`);
fnItems.forEach(item => {
  const numMatch = item.match(/article-fn-(\d+)/);
  const textMatch = item.match(/<span class="article-footnote-text">([\s\S]*?)<\/span>/);
  console.log(` - Note ${numMatch ? numMatch[1] : '?'}: ${textMatch ? textMatch[1].substring(0, 90) : ''}...`);
});
