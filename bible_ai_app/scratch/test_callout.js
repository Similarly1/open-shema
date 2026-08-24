let text = `*ℹ️ Prédication publiée pour la première fois le 16 Juillet 2022, remise en avant pour atteindre une nouvelle génération d’auditeurs.*

**Lecture : 1 Corinthiens 3-4.**

### Découpage du passage en 2 sections :

1. Le message de la croix est une folie que nous devons annoncer (1Co 3.1-4.2).
2. Le chemin de la croix est une faiblesse que nous devons emprunter (1Co 4.3-21).`;

// Nettoyage des callouts d'information avec astérisques ou émojis
text = text.replace(/(?:^|\n)\s*\*?\s*(?:ℹ️|ℹ)\s*([^\n*]+?)\*?\s*(?=\n|$)/gi, '\n\n<div class="article-info-callout"><span>ℹ️</span><div>$1</div></div>\n\n');
text = text.replace(/(?:^|\n)\s*\*\s*(?=\n|$)/g, '\n');

console.log('OUTPUT:\n', text);
