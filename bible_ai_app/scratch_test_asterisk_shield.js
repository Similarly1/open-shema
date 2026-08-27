const sample1 = "Lors des repas solennels ou importants, on voyait figurer des viandes de toutes sortes (Matthieu 22.4 *).";
const sample2 = "Les poissons, qu'ils fussent séchés ou frais (Matthieu 7.10 ; 14:17 ; 15:36 ; Marc 6.38 ; Luc 9.13 ; 11:11 ; 24:42 ; Jean 6.9 ; 21:9 , 13 *).";
const sample3 = "Les œufs (Matthieu 7.9 ; Luc 11.11 *). Le miel (Matthieu 3.4 ; Luc 24.42 *).";
const sample4 = "Les sauterelles (Matthieu 3.4 *, etc.).";

function cleanAsterisks(text) {
  let s = text;
  // 1. Clean asterisk attached to numbers, verses, parentheses or punctuation
  s = s.replace(/(?<=[0-9\.,;\s\(\[])\*(?=[0-9\.,;\s\)\]]|$)/g, '');
  s = s.replace(/\s*\*\s*([\)\]\.,;:])/g, '$1');
  s = s.replace(/\(\s*([^\)\n]+?)\s*\*\s*\)/g, '($1)');
  s = s.replace(/\s+\*\s+/g, ' ');

  // 2. Standard markdown bold and italic
  s = s.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*(.*?)\*/g, '<em>$1</em>');

  // 3. Post-cleanup for any remaining stray asterisks
  s = s.replace(/(?<!<[^>]*)\*/g, '');
  return s;
}

console.log("Sample 1:", cleanAsterisks(sample1));
console.log("Sample 2:", cleanAsterisks(sample2));
console.log("Sample 3:", cleanAsterisks(sample3));
console.log("Sample 4:", cleanAsterisks(sample4));
