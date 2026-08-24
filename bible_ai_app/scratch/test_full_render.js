const fs = require('fs');
const path = 'C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/data/articles/content/tpsg/tpsg_70dd88f360e3.md';
let rawText = fs.readFileSync(path, 'utf8');

const ArticlesView = {
  fixMojibake(str) { return str; },
  getEditorialBadgeLabel(text) {
    if (!text) return 'CONTEXTE & PROVENANCE';
    const lower = text.toLowerCase();
    if (/extrait\s+du\s+livre|tiré\s+du\s+livre|chapitre\s+\d+|éditions|editions|éditeur|editeur|ouvrage|pp\.\s*\d+|méditation\s+\d+/i.test(lower)) {
      return 'EXTRAIT D’OUVRAGE';
    }
    if (/série\s+de|série\s+sur|épisode\s+\d+|partie\s+\d+|série\s+d’articles|série\s+d'articles/i.test(lower)) {
      return 'SÉRIE THÉMATIQUE';
    }
    if (/travail\s+de\s+recherche|thèse|mémoire|séminaire|seminary|académique|theological\s+seminary/i.test(lower)) {
      return 'RECHERCHE & SÉMINAIRE';
    }
    if (/traduction|traduit\s+de|autoris|droits\s+réservés|reproduit\s+avec/i.test(lower)) {
      return 'NOTE ÉDITORIALE';
    }
    return 'CONTEXTE & PROVENANCE';
  },
  renderMarkdown(md) {
    if (!md) return '';
    let text = this.fixMojibake(md);

    // 1. Nettoyer les résidus de lecteur ElevenLabs audio sans déborder sur le texte
    text = text.replace(/Loading\s+the\s*(?:\[[^\]]*Elevenlabs[^\]]*\]\([^)]+\)|Elevenlabs[^\n.]*)/gi, '');
    text = text.replace(/AudioNative\s+Player[\.\u2026]*/gi, '');

    // 1b. Si l'article entier est sur une seule ligne compactée, découper proprement les paragraphes (sans couper les abréviations comme pp., p., chap., etc.)
    if (!text.includes('\n\n')) {
      text = text.replace(/(?<!\b(?:pp|p|chap|ch|vol|v|vs|dr|etc|ex|cf|art))\.\s+([A-ZÀ-ÿ—–«])/gi, '.\n\n$1');
      text = text.replace(/([!?…»])\s+([A-ZÀ-ÿ0-9—–«])/g, '$1\n\n$2');
    }

    // 2. Nettoyer les blocs promotionnels et parcours e-mail de fin d'article
    text = text.replace(/(?:#+\s*)?Parcours\s+e-?mail[\s\S]*$/gi, '');
    text = text.replace(/Pour\s+aller\s+plus\s+loin,\s+inscris-toi[\s\S]*$/gi, '');
    text = text.replace(/(?:#+\s*)?Inscrivez-vous\s+à\s+notre\s+newsletter[\s\S]*$/gi, '');

    // 3. Nettoyer tout bloc d'en-tête redondant
    text = text.replace(/^(#\s+[^\n]+\n+)?/gi, '');
    text = text.replace(/^(\*\*(?:Auteur|Source|Date|Publié le|Podcast)\s*:\*\*[^\n]*\n*|\*\*Podcast\*\*\s*\n*|Podcast\s*\n*|Auteur\s*:[^\n]*\n*|Source\s*:[^\n]*\n*|Date\s*:[^\n]*\n*|Publié\s+le[^\n]*\n*|---\n*)+/gim, '');
    text = text.replace(/^(?:\[[A-ZÉÈÊÀ\s\-]+\]\(https?:\/\/[^\)]+\)\s*)+(?:\d+\s*min\s+de\s+lecture)?[^\n]*\n+/gim, '');

    // 4. Formater les callouts d'information
    text = text.replace(/(?:ℹ️|ℹ)\s*([^\n]+)/gi, '\n\n<div class="article-info-callout"><span>ℹ️</span><div>$1</div></div>\n\n');

    // 5. Nettoyer les tirets initiaux sur les mentions éditoriales
    text = text.replace(/(?:^|\n)\s*[—–-]\s*(Cet article\s+(?:est extrait|fait partie|est tiré|a été publié|provient|est une adaptation))/gi, '\n\n$1');

    // 5b. Détection et mise en valeur du cartouche éditorial de fin d'article (AVANT les dialogues)
    text = text.replace(
      /(?:^|\n\n+)((?:Cet article\s+(?:fait partie|est extrait|est tiré|a été publié|provient|est une adaptation|est la traduction|est une traduction|est le premier|est le second|est le troisième|est basé)|Extrait du livre|Tiré du livre|Publié avec l[’']autorisation)[^\n]+(?:\n[^\n]+)*)(?=\s*$)/gi,
      (match, content) => {
        const badge = this.getEditorialBadgeLabel(content);
        return `\n\n<div class="article-editorial-footer-card"><div class="article-editorial-footer-header"><span class="article-editorial-badge">${badge}</span></div><div class="article-editorial-footer-content">${content.trim()}</div></div>\n\n`;
      }
    );

    // 5c. Formater les dialogues et transcriptions de podcast (intervenants multiples)
    text = text.replace(/(?<!\n)\s*\*\*([A-ZÀ-ÖØ-ß][a-zà-öø-ÿ]+(?:\s+[A-ZÀ-ÖØ-ß][a-zà-öø-ÿ]+)?)\*\*\s*:?\s*/g, '\n\n**$1 :** ');
    text = text.replace(/(?:^|\n)\*\*([A-ZÀ-ÖØ-ß][a-zà-öø-ÿ]+(?:\s+[A-ZÀ-ÖØ-ß][a-zà-öø-ÿ]+)?)\s*:\*\*\s*([^\n]+)/g, '\n\n<div class="article-speaker-turn"><span class="article-speaker-badge">$1</span><p class="article-speaker-speech">$2</p></div>\n\n');

    // 5d. Structurer les sous-titres et directives bibliques
    text = text.replace(/(?:^|\n)([A-ZÀ-ÿ][^\n*]+?)\s+(\*\*Lisez\s+[^*]+\*\*)/gim, '\n\n### $1\n\n$2\n\n');
    text = text.replace(/(\*\*[^*]+\*\*)\s+([A-ZÀ-ÿ])/g, '$1\n\n$2');

    // 5e. Découpage et mise en page soignée des dialogues au tiret cadratin
    text = text.replace(/([:!?…»])\s*([—–\u2013\u2014]\s*)/g, '$1\n\n$2');
    text = text.replace(/\.\s+([—–\u2013\u2014]\s*[A-ZÀ-ÿ])/g, '.\n\n$1');

    text = text.replace(/(?:^|\n)\s*([—–\u2013\u2014]\s*[^\n]+)/g, '\n\n<div class="article-speaker-turn"><p class="article-speaker-speech">$1</p></div>\n\n');

    // 5f. Convertir les citations bibliques avec tiret de référence
    text = text.replace(/(?:^|\n)«\s*([^»]+?)\s*»\s*([–—\u2013\u2014-]\s*[A-ZÀ-ÿ0-9.:\s-]+)/g, '\n\n<blockquote class="article-bible-quote"><p>« $1 » $2</p></blockquote>\n\n');

    text = text.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1FA70}-\u{1FAFF}]/gu, '');
    text = text.replace(/---\s*$/gi, '');

    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/&lt;(\/?(?:div|table|thead|tbody|tr|th|td|blockquote|p|sup|span)(?:\s+class="[^"]*")?)&gt;/gi, '<$1>')
      .replace(/^#### (.*$)/gim, '<h4 class="article-h4">$1</h4>')
      .replace(/^### (.*$)/gim, '<h3 class="article-h3">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="article-h2">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="article-h1">$1</h1>')
      .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/gim, '<em>$1</em>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2" target="_blank" class="article-link">$1</a>')
      .replace(/^---\s*$/gim, '<div class="article-ornamental-divider"><span class="article-ornamental-divider-icon">❦</span></div>')
      .replace(/([⁰¹²³⁴⁵⁶⁷⁸⁹]+)/g, '<sup class="verse-sup">$1</sup>')
      .replace(/\n\n+/gim, '</p><p>')
      .replace(/\n/gim, '<br>');

    return `<div class="article-markdown-body"><p>${html}</p></div>`;
  }
};

const result = ArticlesView.renderMarkdown(rawText);
console.log('\n--- RENDERED HTML END ---\n');
console.log(result.slice(-1000));
