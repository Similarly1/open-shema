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

// Let's inspect raw text around note 8 before render
console.log("Raw lines around note 8 in md file:");
const lines = md.split('\n');
lines.slice(60, 75).forEach((l, i) => console.log(`${61+i}: ${JSON.stringify(l)}`));

const html = articlesView.renderMarkdown(md);
const sectionMatches = html.match(/<div class="article-footnotes-section">/g) || [];
console.log("\nRendered section count:", sectionMatches.length);
