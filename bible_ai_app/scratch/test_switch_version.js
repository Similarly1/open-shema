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
    getChapterData: async (bible, book, ch) => ({ bible, book, chapter: ch, verses: [] }),
    getInstalledBibles: async () => []
  },
  App: { showToast: () => {} }
};

const vm = require('vm');
vm.createContext(sandbox);
vm.runInContext(bibleCode, sandbox);

const BR = sandbox.window.BibleReader;
BR.installedBibles = [
  { name: 'Segond 21', title: 'Segond 21', version_code: 'S21', canon: 'COMPLET', total_books: 66, available_books: ['Gen', 'Exo', 'Lev', 'Mat', 'Rev'], first_book: 'Gen' },
  { name: 'Parole Vivante', title: 'Parole Vivante', version_code: 'PV', canon: 'NT', total_books: 27, available_books: ['Mat', 'Mar', 'Luk', 'Joh', 'Rev'], first_book: 'Mat' },
  { name: 'Sagesse Vivante', title: 'Sagesse Vivante', version_code: 'SV', canon: 'SAGESSE', total_books: 4, available_books: ['Job', 'Pro', 'Ecc', 'Sol'], first_book: 'Job' }
];

console.log('--- Step 1: User starts in Gen 1 in Segond 21 ---');
BR.currentBook = 'Gen';
BR.currentChapter = 1;
console.log('State:', BR.currentBible1, BR.currentBook, BR.currentChapter);

console.log('\n--- Step 2: User clicks Parole Vivante in Library ---');
BR.switchVersion('Parole Vivante');
console.log('State:', BR.currentBible1, BR.currentBook, BR.currentChapter);

console.log('\n--- Step 3: User clicks Sagesse Vivante in Library while on Parole Vivante (Mat 1) ---');
BR.switchVersion('Sagesse Vivante');
console.log('State:', BR.currentBible1, BR.currentBook, BR.currentChapter);

console.log('\n--- Step 4: User clicks Segond 21 in Library while on Sagesse Vivante (Job 1) ---');
BR.switchVersion('Segond 21');
console.log('State:', BR.currentBible1, BR.currentBook, BR.currentChapter);
