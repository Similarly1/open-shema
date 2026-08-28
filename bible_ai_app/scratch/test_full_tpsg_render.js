const fs = require('fs');
const vm = require('vm');

let articlesCode = fs.readFileSync('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/web/js/articles_view.js', 'utf8');

// Apply modifications to test
articlesCode = articlesCode.replace(
  `const notBibleRefAhead = \`(?!(?:\\\\s*\${bibleBooksPattern}\\\\.?\\\\s*[0-9⁰¹²³⁴⁵⁶⁷⁸⁹]))\`;`,
  `const notBibleRefAhead = \`(?!(?:\\\\s*Ndlr|\\\\s*NDLR|\\\\s*ndlr|\\\\s*\${bibleBooksPattern}\\\\.?\\\\s*[0-9⁰¹²³⁴⁵⁶⁷⁸⁹]))\`;`
);

articlesCode = articlesCode.replace(
  `(?=\\n\\n###|\\n\\n<|\\s*$)`,
  `(?=\\n\\n\\d+\\.|\\n\\n###|\\n\\n<|\\s*$)`
);

articlesCode = articlesCode.replace(
  `text = text.replace(/[↩︎↩]/g, '');`,
  `text = text.replace(/\\[\\s*[↩︎↩]?\\s*\\]\\(#[^)]*\\)/gi, '');\n    text = text.replace(/\\[\\s*\\]\\([^)]*\\)/gi, '');\n    text = text.replace(/[↩︎↩]/g, '');`
);

const theologyCode = fs.readFileSync('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/web/js/theology_view.js', 'utf8');

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

const md = fs.readFileSync('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/data/articles/content/tpsg/tpsg_5dff503fa7df.md', 'utf8');
const html = articlesView.renderMarkdown(md);

console.log("=== FINAL RENDERED HTML ===");
const idx = html.indexOf('<div class="article-editorial-footer-card">');
console.log(html.substring(idx));
