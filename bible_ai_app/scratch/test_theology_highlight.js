const fs = require('fs');
const vm = require('vm');

const theologyCode = fs.readFileSync('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/web/js/theology_view.js', 'utf8');

const sandbox = {
  console,
  window: {},
  document: { addEventListener: () => {}, getElementById: () => null },
  API: {},
  localStorage: { getItem: () => null }
};

vm.createContext(sandbox);
vm.runInContext(theologyCode, sandbox);

const theologyView = sandbox.TheologyView || sandbox.window.TheologyView;

const sample = `Toutefois, la fidélité de Dieu à sa promesse envers David garantit que la descendance de ce dernier demeurera sur le trône à Jérusalem (voir 2 Sam. 7).

C’est cette tension — entre la fidélité...`;

console.log("Before highlightScriptureReferences:");
console.log(sample);

const highlighted = theologyView.highlightScriptureReferences(sample);

console.log("\nAfter highlightScriptureReferences:");
console.log(highlighted);
