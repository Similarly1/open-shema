const fs = require('fs');

const sampleMd = `
Paul David Tripp rappelle alors que «le doute, au lieu d’être une tragédie, est une occasion. Si un enfant vous dit: “Je ne crois pas cela”, c’est une invitation à la conversation». [[¹]](#fn1) .

Comme l’écrit John Zacchio Jr., «au lieu d’appeler les jeunes à s’approprier leur foi, appelons-les à répondre à Christ, l’auteur de leur foi et celui qui la mène à la perfection». [[²]](#fn2) .

Kevin DeYoung recommande que les adolescents rencontrent, «dans le cadre sécurisant de la famille et de l’Église, les meilleures versions des idées séculières». [[³]](#fn3)

Rebecca McLaughlin a écrit: «notre foi peut être faible, mais notre Sauveur est fort». [[⁴]](#fn4)
---

1.
Paul David Tripp, « Podcast: What Your Teenager Needs Most (Paul Tripp) », Crossway, le 25 mars 2024 [https://www.crossway.org/articles/podcast-what-your-teenager-needs-most-paul-tripp/?srsltid=AfmBOoqKZm7Rr6rCfhaCHtCzOCMVgBzwDzUpYQMMcO0YvSWCs1Yijbqb] (page consultée le 29 juillet 2026).
↩
2.
John Zacchio Jr., « Stop Telling Teens to “Make Their Faith Their Own” », The Gospel Coalition, le 7 mars 2026 [https://www.thegospelcoalition.org/article/teens-make-faith-own/] (page consultée le 29 juillet 2026).
↩
3.
Kevin DeYoung, « Podcast: If You Don’t Catechize Your Kids, the World Will (Kevin DeYoung) », Crossway, le 28 mars 2022 [https://www.crossway.org/articles/podcast-if-you-dont-catechize-your-kids-the-world-will-kevin-deyoung/?srsltid=AfmBOopoODk1kh1MQM0J3RyX-WHLyaZ-7EBe3WAoPeZNQBsKvUjtlw7r] (page consultée le 4 août 2026).
↩
4.
Rebecca McLaughlin, « An Open Letter to Teens Facing Doubts about Christianity », Crossway, le 1er mai 2023 [https://www.crossway.org/articles/an-open-letter-to-teens-facing-doubt-about-christianity/?srsltid=AfmBOoqH8cMpbUbGAtEE4ba2hCsPfG9HbSEy__s6iibtQ9vz3PY8qgR1] (page consultée le 4 août 2026).
↩

**SOLA** – La Coalition de l’Évangile, Québec, Canada. [Abonnez vous à notre liste d’envoi courriel](http://eepurl.com/gzkJzT) pour rester en contact et ne pas manquer nos plus récents articles.
`;

const supToNum = { '⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9' };
const normalizeSuperscripts = (str) => String(str).replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, ch => supToNum[ch] || ch);

function processText(text) {
  // 1. Remplacer les appels de notes de type [[1]](#fn1), [[¹]](#fn1), [¹](#fn1), [1](#fn1) ou [^1]
  text = text.replace(/\[(?:\[)?([0-9¹²³⁴⁵⁶⁷⁸⁹]+)\](?:\])?\(#(?:fn|article-fn|note)[^)]*\)/gi, (match, n) => {
    const num = parseInt(normalizeSuperscripts(n), 10);
    return `<sup class="article-fn-badge" id="article-fnref-${num}"><a href="#article-fn-${num}" title="Note ${num}">${num}</a></sup>`;
  });

  // Nettoyer les espaces résiduels avant la ponctuation suivante (ex: </sup> . -> </sup>.)
  text = text.replace(/<\/sup>\s+([.,;:!?])/g, '</sup>$1');

  // 2. Joindre les numéros de notes séparés de leur texte par un saut de ligne (ex: "1.\nPaul David...")
  text = text.replace(/(?:^|\n)(\d+)\.\s*\n+([^\n]+)/g, '\n$1. $2');

  // 3. Formater et nettoyer les liens d'URLs brutes dans les notes (ex: [https://...])
  text = text.replace(/\[(https?:\/\/[^\]]+)\]/g, (match, url) => {
    try {
      const cleanUrl = url.split('?')[0]; // Supprimer paramètres de tracking (ex: srsltid)
      const u = new URL(cleanUrl);
      const host = u.hostname.replace(/^www\./, '');
      return `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer" class="article-footnote-link">${host}</a>`;
    } catch (e) {
      return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="article-footnote-link">consulter la source</a>`;
    }
  });

  // 4. Détecter et structurer les notes de bas de page numérotées
  // Éliminer les symboles ↩ isolés sur leur propre ligne
  text = text.replace(/(?:^|\n)\s*↩\s*(?=\n|$)/g, '\n');

  text = text.replace(/(?:^|\n)(\d+)\.\s+([^\n]+(?:\n(?!\d+\.|\s*#|\s*---|\s*$)[^\n]+)*)/g, (match, num, body) => {
    let cleanBody = body.replace(/\s*↩\s*$/g, '').trim();
    return `\n\n<div class="article-footnote-item" id="article-fn-${num}"><span class="article-footnote-num">${num}.</span><span class="article-footnote-text">${cleanBody}</span> <a href="#article-fnref-${num}" class="article-footnote-backlink" title="Retour au texte">↩</a></div>\n\n`;
  });

  // 5. Envelopper la suite de <div class="article-footnote-item"> dans un bloc structuré
  text = text.replace(/(?:<div class="article-footnote-item"[\s\S]+?<\/div>(?:\s*|\n*))+/g, (match) => {
    return `\n\n<div class="article-footnotes-section"><div class="article-footnotes-title"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 1-2 2v16a2 2 0 0 1 2 2h12a2 2 0 0 1 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg><span>Notes de bas de page</span></div><div class="article-footnotes-list">${match.trim()}</div></div>\n\n`;
  });

  return text;
}

const res = processText(sampleMd);
console.log("=== PROCESSED OUTPUT ===");
console.log(res);
