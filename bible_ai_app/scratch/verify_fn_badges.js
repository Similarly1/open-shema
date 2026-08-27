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

const md = fs.readFileSync('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/data/articles/content/e21/e21_1ac9a6882f00.md', 'utf8');
const html = articlesView.renderMarkdown(md);

const fnBadges = html.match(/<sup class="article-fn-badge"[^>]*>[\s\S]*?<\/sup>/g) || [];
console.log(`Found ${fnBadges.length} footnote badges:`);
fnBadges.forEach(b => console.log(" -", b));

const rawBrackets = html.match(/\[\s*\d+\s*[.,]?/g) || [];
console.log("Raw broken brackets found:", rawBrackets);
