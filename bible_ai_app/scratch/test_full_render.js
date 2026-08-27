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

console.log("HTML length:", html.length);
console.log("Has article-fn-badge?", html.includes('article-fn-badge'));
console.log("Has article-footnotes-section?", html.includes('article-footnotes-section'));
console.log("Has raw [[1]]?", html.includes('[[1]]') || html.includes('[[¹]]'));

const fnMatches = html.match(/<sup class="article-fn-badge"[\s\S]*?<\/sup>/g);
console.log("Footnote call badges found:", fnMatches ? fnMatches.length : 0);
if (fnMatches) {
  fnMatches.forEach(m => console.log(" -", m));
}

const sectionStart = html.indexOf('<div class="article-footnotes-section">');
if (sectionStart !== -1) {
  console.log("\n=== FOOTNOTES SECTION PREVIEW ===");
  console.log(html.substring(sectionStart, sectionStart + 1200));
}
