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

const input = `C’est le tournant décisif où le royaume d’Israël se divise sous le règne de Roboam, fils de Salomon, acte qui constitue un jugement de l’Éternel. Toutefois, la fidélité de Dieu à sa promesse envers David garantit que la descendance de ce dernier demeurera sur le trône à Jérusalem (voir 2 Sam. 7).

C’est cette tension — entre la fidélité de l’Éternel envers la maison de David et les malédictions annoncées dans l’alliance mosaïque — qui sous-tend le récit des Rois.`;

const out = articlesView.renderMarkdown(input);
console.log("=== OUTPUT ===");
console.log(out);
