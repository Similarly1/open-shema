let s = '- Un article de la Rébellution : [« L’[horrible] épouse de mon meilleur ami »](https://www.larebellution.com/articles/lepouse-de-mon-meilleur-ami)';
s = s.replace(/\[([^\]]*?)\[([^\]]*?)\]([^\]]*?)\]\((https?:\/\/[^\)]+)\)/g, '[$1$2$3]($4)');
s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="article-link">$1</a>');
console.log('Result:\n', s);
