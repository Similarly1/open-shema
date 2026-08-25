const fs = require('fs');
const theologyCode = fs.readFileSync('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/web/js/theology_view.js', 'utf8');

const vm = require('vm');
const sandbox = { console, window: {}, document: {} };
vm.createContext(sandbox);
vm.runInContext(theologyCode + '\nwindow.TheologyView = TheologyView;', sandbox);

const sampleHtml = `<blockquote class="article-bible-quote"><p>« Ce même jour, deux disciples se rendaient à un village appelé Emmaüs, éloigné de Jérusalem d’une douzaine de kilomètres. Ils discutaient ensemble de tout ce qui s’était passé. Pendant qu’ils parlaient et discutaient, Jésus lui-même s’approcha et fit route avec eux, mais leurs yeux étaient empêchés de le reconnaître. » – Luc 24.13-16</p></blockquote>`;

const res = sandbox.window.TheologyView.highlightScriptureReferences(sampleHtml);
console.log('RESULT:\n', res);
