const fs = require('fs');
const raw = fs.readFileSync('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/data/articles/content/tpsg/tpsg_37db74ac4df2.md', 'utf8');

const theologyCode = fs.readFileSync('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/web/js/theology_view.js', 'utf8');
const articlesCode = fs.readFileSync('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/web/js/articles_view.js', 'utf8');

// Let's modify renderMarkdown to log where ² disappears
let modifiedArticlesCode = articlesCode.replace(/let text = this\.fixMojibake\(md\);/, `
let text = this.fixMojibake(md);
const checkSup = (step) => console.log('Step ' + step + ' has ² ?', text.includes('²'), 'has ⁷ ?', text.includes('⁷'));
checkSup('0 - start');
`);

// Add checkSup after each step
for (let i = 1; i <= 10; i++) {
  modifiedArticlesCode = modifiedArticlesCode.replace(new RegExp(`// ${i}\\.`), `checkSup('before ${i}');\n// ${i}.`);
}
for (let sub of ['5a-1', '5a-2', '5b', '5c', '5d', '5e', '5f', '5g', '5h', '5i', '5j']) {
  modifiedArticlesCode = modifiedArticlesCode.replace(new RegExp(`// ${sub}\\.`), `checkSup('before ${sub}');\n// ${sub}.`);
}

const vm = require('vm');
const sandbox = { console, window: {}, document: { addEventListener: () => {} }, API: {}, localStorage: { getItem: () => null } };
vm.createContext(sandbox);
vm.runInContext(theologyCode + '\nwindow.TheologyView = TheologyView;', sandbox);
vm.runInContext(modifiedArticlesCode, sandbox);

const articlesView = sandbox.ArticlesView || sandbox.window.ArticlesView;
articlesView.renderMarkdown(raw);
