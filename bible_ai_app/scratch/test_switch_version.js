const fs = require('fs');
const bibleCode = fs.readFileSync('./web/js/bible_reader.js', 'utf8');

const createMockEl = () => ({
  textContent: '',
  innerHTML: '',
  classList: { toggle: () => {}, add: () => {}, remove: () => {}, contains: () => false },
  querySelectorAll: () => [],
  querySelector: () => null,
  addEventListener: () => {},
  appendChild: () => {}
});

const dom = {
  getElementById: (id) => createMockEl(),
  createElement: () => createMockEl(),
  body: createMockEl(),
  querySelectorAll: () => [],
  addEventListener: () => {}
};

const sandbox = {
  document: dom,
  window: { addEventListener: () => {}, innerWidth: 1200 },
  localStorage: { getItem: () => null, setItem: () => {} },
  console: console,
  API: {
    call: async () => ({}),
    getChapterData: async () => ({ book: 'Mat', chapter: 1, verses: [] }),
    getInstalledBibles: async () => []
  },
  App: { showToast: () => {} }
};

const vm = require('vm');
vm.createContext(sandbox);
vm.runInContext(bibleCode, sandbox);

const BR = sandbox.window.BibleReader || sandbox.BibleReader;
BR.installedBibles = [
  { name: 'Segond 21', title: 'Segond 21', version_code: 'S21', canon: 'COMPLET', total_books: 66 },
  { name: 'Parole_Vivante', title: 'Parole Vivante', version_code: 'PV', canon: 'NT', total_books: 27 }
];

console.log('--- Test 1: Start at Gen 1, switch to Parole Vivante ---');
BR.currentBook = 'Gen';
BR.currentChapter = 1;
BR.switchVersion('Parole Vivante');
console.log('Active Bible:', BR.currentBible1, '| Active Book:', BR.currentBook, '| Active Chapter:', BR.currentChapter);

console.log('\n--- Test 2: Switch back to Segond 21 ---');
BR.switchVersion('Segond 21');
console.log('Active Bible:', BR.currentBible1, '| Active Book:', BR.currentBook, '| Active Chapter:', BR.currentChapter);
