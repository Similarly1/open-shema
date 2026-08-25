const fs = require('fs');
const raw = fs.readFileSync('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/data/articles/content/tpsg/tpsg_37db74ac4df2.md', 'utf8');

const theologyCode = fs.readFileSync('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/web/js/theology_view.js', 'utf8');
const articlesCode = fs.readFileSync('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/web/js/articles_view.js', 'utf8');

const targetStr = "const segments = text.split(/\\[(?:↩︎|↩)\\]\\(#[^)]+\\)/);";
const replacementStr = `
const segments = text.split(/\\[(?:↩︎|↩)\\]\\(#[^)]+\\)/);
console.log('INSIDE 5g: segments length =', segments.length);
segments.forEach((s, idx) => console.log('Seg ' + idx + ' (len ' + s.length + '):', s.slice(0, 50)));
`;

const modifiedArticlesCode = articlesCode.replace(targetStr, replacementStr);

const vm = require('vm');
const sandbox = { console, window: {}, document: { addEventListener: () => {} }, API: {}, localStorage: { getItem: () => null } };
vm.createContext(sandbox);
vm.runInContext(theologyCode + '\nwindow.TheologyView = TheologyView;', sandbox);
vm.runInContext(modifiedArticlesCode, sandbox);

const articlesView = sandbox.ArticlesView || sandbox.window.ArticlesView;
articlesView.renderMarkdown(raw);
