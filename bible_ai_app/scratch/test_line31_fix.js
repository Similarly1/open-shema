const line31 = `Le premier livre des Rois s’ouvre sur la transition entre le règne de David et celui de Salomon. Deuxièmement, au chapitre 17 du premier livre des Rois, le prophète Élie fait une entrée fracassante en scène; il devient — aux côtés de son antagoniste, le roi Achab — la figure narrative centrale pour la suite de l’ouvrage. Troisièmement, le deuxième livre des Rois commence (plus ou moins) par la transition entre Élie et son protégé, Élisée. Quatrièmement, le chapitre 17 du deuxième livre des Rois relate la destruction de Samarie et la chute du royaume du Nord. Cinquièmement, ce second livre s’achève sur l’héritier du trône de David en exil, mais qui vient de se voir accorder une place à la table du roi de Babylone. Il reste une dernière pièce du puzzle: le nombre onze, correspondant au chapitre 11 du premier livre des Rois. C’est le tournant décisif où le royaume d’Israël se divise sous le règne de Roboam, fils de Salomon, acte qui constitue un jugement de l’Éternel. Toutefois, la fidélité de Dieu à sa promesse envers David garantit que la descendance de ce dernier demeurera sur le trône à Jérusalem (voir 2 Sam. 7).`;

const abbrevs = '(?:Sam|Rois|Chron|Thess|Cor|Tim|Pierre|Jean|Gen|Ex|Lv|Nb|Dt|Jos|Jg|Rt|Ps|Pr|Ec|Ct|Es|Jr|Lm|Ez|Dn|Os|Jl|Am|Ab|Jon|Mi|Na|Ha|So|Ag|Za|Ml|Mt|Mc|Lc|Jn|Ac|Rm|Ga|Ep|Ph|Col|Tt|Phm|He|Jc|Jd|Ap|p|pp|vol|tome|chap|art|col|éd|ed|cf|ex|al|etc|dr|prof|st|ste|vs|v|vv)';
const abbrevRegex = new RegExp(`(?<!\\b${abbrevs})[.!?…»]\\s+(?!–|—)([A-ZÀ-ÖØ-ß«])`, 'g');

let sentenceCount = 0;
const processed = line31.replace(abbrevRegex, (match, nextChar, offset, str) => {
  // Check if inside open parentheses
  const prefix = str.substring(0, offset);
  const openParens = (prefix.match(/\(/g) || []).length;
  const closeParens = (prefix.match(/\)/g) || []).length;
  if (openParens > closeParens) {
    return ' ' + nextChar;
  }
  
  sentenceCount++;
  if (sentenceCount >= 3) {
    sentenceCount = 0;
    return '.\n\n' + nextChar;
  }
  return match;
});

console.log("=== PROCESSED OUTPUT ===");
console.log(processed);
console.log("\nContains '2 Sam. 7' unbroken?", processed.includes('2 Sam. 7'));
