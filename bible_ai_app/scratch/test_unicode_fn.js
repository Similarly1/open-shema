const fs = require('fs');

let line = `1. APJ 1579 : « Pourquoi Dieu nous a-t-il créés ? » (25 janvier 2021) [↩︎](#7a0e0617-8c59-49cb-b064-9704dc8a5b65-link)`;

// Nettoyage complet des liens d'ancres de retour WordPress
line = line.replace(/\[[\s\u21A9\uFE0E\uFE0F↩︎↩]*\]\(#[^)]*\)/gi, '');
line = line.replace(/\[\s*\]\([^)]*\)/gi, '');
line = line.replace(/[\u21A9\uFE0E\uFE0F↩︎↩]/g, '');

console.log("Cleaned line:");
console.log(JSON.stringify(line.trim()));
