const sample = `
Alors, aventurier courageux, maintenant que tu disposes de conseils de survie et d’une ébauche de carte fournis par ceux qui ont déjà parcouru ce terrain, il ne te reste plus qu’à trouver le cran de sauter de l’hélicoptère — ou plutôt, de «prendre et lire». Si Dieu le veut, tu pourras faire bien plus que simplement survivre dans ce paysage: tu pourras puiser abondamment dans le livre des Rois!

Ben Lattimore est marié à Bethany, a quatre enfants et vit sur la côte centrale de la Nouvelle-Galles du Sud, où il exerce la fonction de pasteur à l’église EV (Evangélique).

**SOLA** – La Coalition de l’Évangile, Québec, Canada. [Abonnez vous à notre liste d’envoi courriel](http://eepurl.com/gzkJzT) pour rester en contact et ne pas manquer nos plus récents articles, des offres exclusives pour nos conférences, des livres gratuits, des méditations et bien plus ! Pour en connaitre davantage sur SOLA, visitez notre [Site Web](https://sola.org/)
`;

function formatBioCards(text) {
  const solaImg = "https://media.thegospelcoalition.org/wp-content/uploads/sites/5/2023/03/17092830/327176131_865371428018991_2189346806125016085_n-300x300.jpg";
  
  // 1. SOLA Bio Card
  text = text.replace(/(?:^|\n)(\*\*SOLA\*\*\s*[–—-]\s*La Coalition de l’Évangile[^\n]+(?:\n(?!\n)[^\n]+)*)/gi, (match, body) => {
    return `\n\n<div class="article-author-bio-card"><div class="article-author-bio-avatar"><img src="${solaImg}" alt="SOLA" class="article-author-bio-img" loading="lazy"></div><div class="article-author-bio-content"><p>${body.trim()}</p></div></div>\n\n`;
  });

  // 2. Author Bio Card (ex: "Ben Lattimore est marié à...")
  text = text.replace(/(?:^|\n)([A-ZÀ-ÖØ-ß][a-zà-öø-ÿ]+(?:\s+[A-ZÀ-ÖØ-ß][a-zà-öø-ÿ]+){1,3}\s+est\s+(?:marié|pasteur|auteur|enseignant|théologien|directeur|fondateur|professeur|étudiant|membre|rédacteur|titulaire|responsable)[^\n]+(?:\n(?!\n)[^\n]+)*)/g, (match, body) => {
    const authorName = body.split(' est ')[0].trim();
    return `\n\n<div class="article-author-bio-card"><div class="article-author-bio-avatar"><span style="font-weight:700; font-size:18px; color:var(--accent-primary, #60a5fa);">${authorName.charAt(0)}</span></div><div class="article-author-bio-content"><p>${body.trim()}</p></div></div>\n\n`;
  });

  return text;
}

console.log(formatBioCards(sample));
