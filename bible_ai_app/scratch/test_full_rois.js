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

const fullMd = fs.readFileSync('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/data/articles/content/e21/e21_8ca9889054b3.md', 'utf8');
const out = articlesView.renderMarkdown(fullMd);

const samIdx = out.indexOf('2 Sam');
if (samIdx !== -1) {
  console.log("=== 2 SAM CONTEXT IN RENDERED OUTPUT ===");
  console.log(out.substring(samIdx - 150, samIdx + 150));
} else {
  console.log("2 Sam NOT FOUND!");
}
