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

const sections = html.split('<div class="article-footnotes-section">');
console.log(`Total sections: ${sections.length - 1}`);
for (let i = 1; i < sections.length; i++) {
  console.log(`\n=== SECTION ${i} PREVIEW ===`);
  console.log(sections[i].substring(0, 300));
}
