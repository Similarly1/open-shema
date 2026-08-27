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

const line31 = `Le premier livre des Rois s’ouvre sur la transition entre le règne de David et celui de Salomon. Deuxièmement, au chapitre 17 du premier livre des Rois, le prophète Élie fait une entrée fracassante en scène; il devient — aux côtés de son antagoniste, le roi Achab — la figure narrative centrale pour la suite de l’ouvrage. Troisièmement, le deuxième livre des Rois commence (plus ou moins) par la transition entre Élie et son protégé, Élisée. Quatrièmement, le chapitre 17 du deuxième livre des Rois relate la destruction de Samarie et la chute du royaume du Nord. Cinquièmement, ce second livre s’achève sur l’héritier du trône de David en exil, mais qui vient de se voir accorder une place à la table du roi de Babylone. Il reste une dernière pièce du puzzle: le nombre onze, correspondant au chapitre 11 du premier livre des Rois. C’est le tournant décisif où le royaume d’Israël se divise sous le règne de Roboam, fils de Salomon, acte qui constitue un jugement de l’Éternel. Toutefois, la fidélité de Dieu à sa promesse envers David garantit que la descendance de ce dernier demeurera sur le trône à Jérusalem (voir 2 Sam. 7).`;

const res = articlesView.renderMarkdown(line31);
console.log("=== RENDERED LINE 31 ===");
console.log(res);
