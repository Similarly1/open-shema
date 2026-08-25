const fs = require('fs');
const theologyCode = fs.readFileSync('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/web/js/theology_view.js', 'utf8');
const articlesCode = fs.readFileSync('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/web/js/articles_view.js', 'utf8');

const vm = require('vm');
const sandbox = { console, window: {}, document: { addEventListener: () => {} }, API: {}, localStorage: { getItem: () => null } };
vm.createContext(sandbox);
vm.runInContext(theologyCode + '\nwindow.TheologyView = TheologyView;', sandbox);
vm.runInContext(articlesCode, sandbox);

const articlesView = sandbox.ArticlesView || sandbox.window.ArticlesView;

// Test 1: CS Lewis quote
const rawLewis = fs.readFileSync('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/data/articles/content/tpsg/tpsg_c38c0c224a72.md', 'utf8');
const outLewis = articlesView.renderMarkdown(rawLewis);
const idxLewis = outLewis.indexOf('aversion pour les mêmes choses');
console.log('=== TEST 1: CS LEWIS QUOTE ===');
console.log(outLewis.slice(idxLewis - 40, idxLewis + 650));

// Test 2: Warfield Footnotes
const rawWarfield = fs.readFileSync('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/data/articles/content/tpsg/tpsg_37db74ac4df2.md', 'utf8');
const outWarfield = articlesView.renderMarkdown(rawWarfield);
const tableWarfield = [];
for (let i = 1; i <= 7; i++) {
  tableWarfield.push({ note: i, inText: outWarfield.includes(`id="article-fnref-${i}"`), atBottom: outWarfield.includes(`id="article-fn-${i}"`) });
}
console.log('\n=== TEST 2: WARFIELD FOOTNOTES ===');
console.table(tableWarfield);

// Test 3: Church hurt recommendations
const rawChurch = fs.readFileSync('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/data/articles/content/tpsg/tpsg_a060357a99da.md', 'utf8');
const outChurch = articlesView.renderMarkdown(rawChurch);
const idxChurch = outChurch.indexOf('Pour aller plus loin');
console.log('\n=== TEST 3: CHURCH HURT RECS ===');
console.log(outChurch.slice(idxChurch - 50));
