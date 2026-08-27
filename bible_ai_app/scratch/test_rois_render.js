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

const sample = `
Alors, aventurier courageux, maintenant que tu disposes de conseils de survie et d’une ébauche de carte fournis par ceux qui ont déjà parcouru ce terrain, il ne te reste plus qu’à trouver le cran de sauter de l’hélicoptère — ou plutôt, de «prendre et lire». Si Dieu le veut, tu pourras faire bien plus que simplement survivre dans ce paysage: tu pourras puiser abondamment dans le livre des Rois!

Ben Lattimore est marié à Bethany, a quatre enfants et vit sur la côte centrale de la Nouvelle-Galles du Sud, où il exerce la fonction de pasteur à l’église EV (Evangélique).

**SOLA** – La Coalition de l’Évangile, Québec, Canada. [Abonnez vous à notre liste d’envoi courriel](http://eepurl.com/gzkJzT) pour rester en contact et ne pas manquer nos plus récents articles, des offres exclusives pour nos conférences, des livres gratuits, des méditations et bien plus ! Pour en connaitre davantage sur SOLA, visitez notre [Site Web](https://sola.org/)
`;

const rendered = articlesView.renderMarkdown(sample);
console.log("=== RENDERED RESULT ===");
console.log(rendered);
