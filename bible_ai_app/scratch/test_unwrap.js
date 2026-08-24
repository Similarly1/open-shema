let text = 'Lisez [Luc 24.13-35](https://toutpoursagloire.com/bible/luc-24) . C\'était un dimanche...';
text = text.replace(/\[([A-ZÀ-ÿ0-9\s.:\u2013\u2014-]+)\]\(https?:\/\/[^\)]+\)/gi, (m, label) => {
  return label;
});
console.log('Unwrapped:', text);
