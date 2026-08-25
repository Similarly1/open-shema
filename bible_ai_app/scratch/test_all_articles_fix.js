const fs = require('fs');
const theologyCode = fs.readFileSync('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/web/js/theology_view.js', 'utf8');
let articlesCode = fs.readFileSync('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/web/js/articles_view.js', 'utf8');

// Appliquer nos améliorations sur articlesCode
articlesCode = articlesCode.replace(
  `text = text.replace(/([.!?…»]|\\))\\s*([A-ZÀ-ÖØ-ß][a-zà-öø-ÿ]+(?:\\s+[A-ZÀ-ÖØ-ß][a-zà-öø-ÿ]+)?,\\s*\\*?\\[[^\\]]+\\])/g, '$1\\n- $2');`,
  `text = text.replace(/(?<=### Pour aller plus loin[\\s\\S]*?)(?:\\n|[.!?…»]|\\))\\s*([A-ZÀ-ÖØ-ß][a-zà-öø-ÿ]+(?:\\s+[A-ZÀ-ÖØ-ß][a-zà-öø-ÿ]+)?,\\s*\\*?\\[[^\\]]+\\])/g, '\\n- $1');`
);

articlesCode = articlesCode.replace(
  `    // 1b. Si l'article entier est sur une seule ligne compactée, découper proprement les paragraphes (sans couper les listes 1., 2. ni les abréviations)
    if (!text.includes('\\n\\n')) {
      text = text.replace(/(?<!\\b(?:pp|p|chap|ch|vol|v|vs|dr|etc|ex|cf|art|\\d+))\\.\\s+([A-ZÀ-ÿ—–«])/gi, '.\\n\\n$1');
      text = text.replace(/([!?…»])\\s+([A-ZÀ-ÿ0-9—–«])/g, '$1\\n\\n$2');
    }`,
  `    // Convertir les blockquotes Markdown (> Citation [– Auteur]) AVANT le découpage de phrases
    text = text.replace(/(?:^|\\n)>\\s*([^\\n]+(?:\\n(?!>|[#\\n]|---)[^\\n]+)*)/g, (match, bqContent) => {
      let content = bqContent.replace(/\\n>\\s*/g, ' ').replace(/\\n/g, ' ').trim();
      
      const authorMatch = content.match(/^([\\s\\S]+?)\\s+([—–\\u2013\\u2014-]\\s*[A-ZÀ-ÖØ-ß][^\\n]*?\\*(?:\\[[^\\]]+\\]\\([^)]+\\)|[^*]+)\\*[.,\\s]*)(?:\\s+([A-ZÀ-ÿ«][\\s\\S]*))?$/);
      if (authorMatch) {
        const quoteText = authorMatch[1].trim();
        const quoteAuthor = authorMatch[2].trim();
        const nextParagraph = authorMatch[3] ? \`\\n\\n\${authorMatch[3].trim()}\` : '';
        return \`\\n\\n<blockquote class="article-bible-quote"><p>\${quoteText}</p><footer class="article-quote-author">\${quoteAuthor}</footer></blockquote>\${nextParagraph}\\n\\n\`;
      }
      
      const simpleAuthorMatch = content.match(/^([\\s\\S]+?)\\s+([—–\\u2013\\u2014-]\\s*[A-ZÀ-ÖØ-ß][a-zà-öø-ÿ.]*(?:\\s+[A-ZÀ-ÖØ-ß][a-zà-öø-ÿ.]*){1,4}[.,\\s]*)(?:\\s+([A-ZÀ-ÿ«][\\s\\S]*))?$/);
      if (simpleAuthorMatch) {
        const quoteText = simpleAuthorMatch[1].trim();
        const quoteAuthor = simpleAuthorMatch[2].trim();
        const nextParagraph = simpleAuthorMatch[3] ? \`\\n\\n\${simpleAuthorMatch[3].trim()}\` : '';
        return \`\\n\\n<blockquote class="article-bible-quote"><p>\${quoteText}</p><footer class="article-quote-author">\${quoteAuthor}</footer></blockquote>\${nextParagraph}\\n\\n\`;
      }

      return \`\\n\\n<blockquote class="article-bible-quote"><p>\${content}</p></blockquote>\\n\\n\`;
    });

    // 1b. Si l'article entier est sur une seule ligne compactée, découper proprement les paragraphes (sans couper les initiales C., S., etc.)
    if (!text.includes('\\n\\n')) {
      text = text.replace(/(?<!\\b(?:pp|p|chap|ch|vol|v|vs|dr|etc|ex|cf|art|[A-ZÀ-ÿ]|\\d+))\\.\\s+(?!–|—)([A-ZÀ-ÿ«])/g, '.\\n\\n$1');
      text = text.replace(/([!?…»])\\s+(?!–|—)([A-ZÀ-ÿ0-9«])/g, '$1\\n\\n$2');
    }`
);

// Mettre à jour 5f
articlesCode = articlesCode.replace(
  `text = text.replace(/(?:^|\\n)«\\s*([^»]+?)\\s*»\\s*([–—\\u2013\\u2014-]\\s*[A-ZÀ-ÿ0-9.:\\s-]+)/g, '\\n\\n<blockquote class="article-bible-quote"><p>« $1 » $2</p></blockquote>\\n\\n');`,
  `text = text.replace(/(?:^|\\n)«\\s*([^»]+?)\\s*»\\s*([–—\\u2013\\u2014-]\\s*[A-ZÀ-ÿ0-9.:\\s-]+)/g, (match, quote, author) => \`\\n\\n<blockquote class="article-bible-quote"><p>« \${quote} »</p><footer class="article-quote-author">\${author.trim()}</footer></blockquote>\\n\\n\`);`
);

// Mettre à jour step 10 pour autoriser <footer>
articlesCode = articlesCode.replace(
  `replace(/&lt;(\\/?(?:div|table|thead|tbody|tr|th|td|blockquote|p|sup|span|a)`,
  `replace(/&lt;(\\/?(?:div|table|thead|tbody|tr|th|td|blockquote|footer|cite|p|sup|span|a)`
);

const vm = require('vm');
const sandbox = { console, window: {}, document: { addEventListener: () => {} }, API: {}, localStorage: { getItem: () => null } };
vm.createContext(sandbox);
vm.runInContext(theologyCode + '\nwindow.TheologyView = TheologyView;', sandbox);
vm.runInContext(articlesCode, sandbox);

const articlesView = sandbox.ArticlesView || sandbox.window.ArticlesView;

// Test 1: CS Lewis
const rawLewis = fs.readFileSync('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/data/articles/content/tpsg/tpsg_c38c0c224a72.md', 'utf8');
const outLewis = articlesView.renderMarkdown(rawLewis);
const idxLewis = outLewis.indexOf('aversion pour les mêmes choses');
console.log('=== TEST 1: CS LEWIS QUOTE ===');
console.log(outLewis.slice(idxLewis - 40, idxLewis + 650));

// Test 2: Church hurt recommendations
const rawChurch = fs.readFileSync('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/data/articles/content/tpsg/tpsg_a060357a99da.md', 'utf8');
const outChurch = articlesView.renderMarkdown(rawChurch);
const idxChurch = outChurch.indexOf('Pour aller plus loin');
console.log('\n=== TEST 2: RECS AT END ===');
console.log(outChurch.slice(idxChurch - 50));
