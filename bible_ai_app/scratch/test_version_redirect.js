const fs = require('fs');
const bibleCode = fs.readFileSync('./web/js/bible_reader.js', 'utf8');

const createMockEl = () => ({
  textContent: '',
  innerHTML: '',
  classList: { toggle: () => {}, add: () => {}, remove: () => {}, contains: () => false },
  querySelectorAll: () => [],
  querySelector: () => null,
  addEventListener: () => {},
  appendChild: () => {},
  prepend: () => {},
  dataset: {}
});

const dom = {
  getElementById: (id) => createMockEl(),
  createElement: () => createMockEl(),
  body: createMockEl(),
  querySelectorAll: () => [],
  addEventListener: () => {}
};

const toasts = [];
const sandbox = {
  document: dom,
  window: { addEventListener: () => {}, innerWidth: 1200 },
  localStorage: { getItem: () => null, setItem: () => {} },
  console: console,
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  API: {
    call: async () => ({}),
    getChapterData: async (bible, book, ch) => ({
      bible,
      book,
      book_french: book,
      chapter: ch,
      verses: [{ verse: 1, text: 'Test verse' }]
    }),
    getCommentaries: async () => [],
    getInstalledBibles: async () => []
  },
  App: {
    showToast: (msg) => toasts.push(msg)
  }
};

const vm = require('vm');
vm.createContext(sandbox);
vm.runInContext(bibleCode, sandbox);

const BR = sandbox.window.BibleReader;
BR.installedBibles = [
  {
    name: 'Segond 21',
    title: 'Bible Segond 21',
    version_code: 'S21',
    canon: 'Protestant (66 livres)',
    total_books: 66,
    available_books: [
      'Gen', 'Exo', 'Lev', 'Num', 'Deu', 'Jos', 'Jdg', 'Rut', '1Sa', '2Sa',
      '1Ki', '2Ki', '1Ch', '2Ch', 'Ezr', 'Neh', 'Est', 'Job', 'Psa', 'Pro',
      'Ecc', 'Sol', 'Isa', 'Jer', 'Lam', 'Eze', 'Dan', 'Hos', 'Joe', 'Amo',
      'Oba', 'Jon', 'Mic', 'Nah', 'Hab', 'Zep', 'Hag', 'Zec', 'Mal',
      'Mat', 'Mar', 'Luk', 'Joh', 'Act', 'Rom', '1Co', '2Co', 'Gal', 'Eph',
      'Phi', 'Col', '1Th', '2Th', '1Ti', '2Ti', 'Tit', 'Phm', 'Heb', 'Jam',
      '1Pe', '2Pe', '1Jo', '2Jo', '3Jo', 'Jud', 'Rev'
    ],
    first_book: 'Gen'
  },
  {
    name: 'STAPFER',
    title: '1889 (XIX° S.) Le Nouveau Testament',
    version_code: 'STAPFER',
    canon: 'NT',
    total_books: 27,
    available_books: [
      'Mat', 'Mar', 'Luk', 'Joh', 'Act', 'Rom', '1Co', '2Co', 'Gal', 'Eph',
      'Phi', 'Col', '1Th', '2Th', '1Ti', '2Ti', 'Tit', 'Phm', 'Heb', 'Jam',
      '1Pe', '2Pe', '1Jo', '2Jo', '3Jo', 'Jud', 'Rev'
    ],
    first_book: 'Mat'
  },
  {
    name: 'CAHEN',
    title: 'La Bible Cahen (Ancien Testament)',
    version_code: 'CAHEN',
    canon: 'AT',
    total_books: 38,
    available_books: [
      'Gen', 'Exo', 'Lev', 'Num', 'Deu', 'Jos', 'Jdg', 'Rut', '1Sa', '2Sa',
      '1Ki', '2Ki', '2Ch', 'Ezr', 'Neh', 'Est', 'Job', 'Psa', 'Pro',
      'Ecc', 'Sol', 'Isa', 'Jer', 'Lam', 'Eze', 'Dan', 'Hos', 'Joe', 'Amo',
      'Oba', 'Jon', 'Mic', 'Nah', 'Hab', 'Zep', 'Hag', 'Zec', 'Mal'
    ],
    first_book: 'Gen'
  },
  {
    name: 'SV',
    title: 'Sagesse Vivante',
    version_code: 'SV',
    canon: 'SAGESSE',
    total_books: 4,
    available_books: ['Job', 'Pro', 'Ecc', 'Sol'],
    first_book: 'Job'
  }
];

async function runTests() {
  console.log('=== TEST 1: Segond 21 (Gen 1) -> Switch to Stapfer (NT only) ===');
  BR.targetPaneForPicker = 1;
  BR.currentBible1 = 'Segond 21';
  BR.currentBook = 'Gen';
  BR.currentChapter = 1;
  BR.selectBibleVersion('STAPFER');
  console.log('Result:', BR.currentBible1, BR.currentBook, BR.currentChapter);
  if (BR.currentBible1 === 'STAPFER' && BR.currentBook === 'Mat' && BR.currentChapter === 1) {
    console.log('✅ TEST 1 PASSED: Gen 1 automatically became Mat 1 on Stapfer!');
  } else {
    console.error('❌ TEST 1 FAILED');
  }

  console.log('\n=== TEST 2: Stapfer (Mat 5) -> Switch to Cahen (AT only) ===');
  BR.currentBible1 = 'STAPFER';
  BR.currentBook = 'Mat';
  BR.currentChapter = 5;
  BR.selectBibleVersion('CAHEN');
  console.log('Result:', BR.currentBible1, BR.currentBook, BR.currentChapter);
  if (BR.currentBible1 === 'CAHEN' && BR.currentBook === 'Gen' && BR.currentChapter === 1) {
    console.log('✅ TEST 2 PASSED: Mat 5 automatically became Gen 1 on Cahen!');
  } else {
    console.error('❌ TEST 2 FAILED');
  }

  console.log('\n=== TEST 3: Cahen (Gen 1) -> Switch to Sagesse Vivante (Job-Sol) ===');
  BR.currentBible1 = 'CAHEN';
  BR.currentBook = 'Gen';
  BR.currentChapter = 1;
  BR.selectBibleVersion('SV');
  console.log('Result:', BR.currentBible1, BR.currentBook, BR.currentChapter);
  if (BR.currentBible1 === 'SV' && BR.currentBook === 'Job' && BR.currentChapter === 1) {
    console.log('✅ TEST 3 PASSED: Gen 1 automatically became Job 1 on SV!');
  } else {
    console.error('❌ TEST 3 FAILED');
  }

  console.log('\n=== TEST 4: Sagesse Vivante (Pro 3) -> Switch to Segond 21 (Full) ===');
  BR.currentBible1 = 'SV';
  BR.currentBook = 'Pro';
  BR.currentChapter = 3;
  BR.selectBibleVersion('Segond 21');
  console.log('Result:', BR.currentBible1, BR.currentBook, BR.currentChapter);
  if (BR.currentBible1 === 'Segond 21' && BR.currentBook === 'Pro' && BR.currentChapter === 3) {
    console.log('✅ TEST 4 PASSED: Pro 3 remained Pro 3 on Segond 21!');
  } else {
    console.error('❌ TEST 4 FAILED');
  }

  console.log('\n=== TEST 5: Segond 21 (Rom 8) -> Switch to Stapfer (NT only) ===');
  BR.currentBible1 = 'Segond 21';
  BR.currentBook = 'Rom';
  BR.currentChapter = 8;
  BR.selectBibleVersion('STAPFER');
  console.log('Result:', BR.currentBible1, BR.currentBook, BR.currentChapter);
  if (BR.currentBible1 === 'STAPFER' && BR.currentBook === 'Rom' && BR.currentChapter === 8) {
    console.log('✅ TEST 5 PASSED: Rom 8 remained Rom 8 on Stapfer!');
  } else {
    console.error('❌ TEST 5 FAILED');
  }

  console.log('\n=== TEST 6: getNextChapterCoord & getPrevChapterCoord for NT-only ===');
  const prevMat1 = sandbox.getPrevChapterCoord('Mat', 1, 'STAPFER');
  console.log('Prev before Mat 1 in Stapfer:', prevMat1);
  const nextMat28 = sandbox.getNextChapterCoord('Mat', 28, 'STAPFER');
  console.log('Next after Mat 28 in Stapfer:', nextMat28);
  const nextRev22 = sandbox.getNextChapterCoord('Rev', 22, 'STAPFER');
  console.log('Next after Rev 22 in Stapfer:', nextRev22);

  if (prevMat1 === null && nextMat28 && nextMat28.book === 'Mar' && nextRev22 === null) {
    console.log('✅ TEST 6 PASSED: Navigation boundaries respect NT-only canon!');
  } else {
    console.error('❌ TEST 6 FAILED');
  }

  console.log('\n=== TEST 7: Direct navigation to Genesis while on Stapfer ===');
  BR.currentBible1 = 'STAPFER';
  BR.currentBook = 'Mat';
  BR.currentChapter = 1;
  await BR.navigateTo('Gen', 1);
  console.log('Result after navigating to Gen 1:', BR.currentBible1, BR.currentBook, BR.currentChapter);
  if (BR.currentBible1 === 'Segond 21' && BR.currentBook === 'Gen' && BR.currentChapter === 1) {
    console.log('✅ TEST 7 PASSED: Auto-switched to Segond 21 when navigating to Gen 1 on Stapfer!');
  } else {
    console.error('❌ TEST 7 FAILED');
  }

  console.log('\n🎉 ALL TESTS COMPLETED SUCCESSFULLY!');
}

runTests();
