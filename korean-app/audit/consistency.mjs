import { load, corpus } from "./harness.mjs";
const { weeks, KO } = load();
const { vocab, sents } = corpus(weeks);

/* same headword glossed two different ways = one of them is wrong */
const byKo = new Map();
vocab.forEach((v) => {
  if (!byKo.has(v.ko)) byKo.set(v.ko, new Set());
  byKo.get(v.ko).add(v.zh);
});
console.log("=== same word, different gloss ===");
let n = 0;
for (const [ko, set] of byKo) {
  if (set.size > 1) { n++; console.log(`${ko}  ->  ${[...set].join("   |   ")}`); }
}
console.log(n ? `${n} conflicts` : "none");

/* anything that isn't Hangul/space/basic punctuation is suspicious */
const ODD = /[^가-힣ㄱ-ㅎㅏ-ㅣ0-9A-Za-z\s.,!?~·—()\-'"/]/;
console.log("\n=== unexpected characters in Korean fields ===");
[...vocab.map(v => ({ at: v.at, s: v.ko })), ...sents.map(s => ({ at: s.at, s: s.ko }))]
  .filter(x => ODD.test(x.s)).forEach(x => console.log(x.at, JSON.stringify(x.s)));

/* sentences should end with terminal punctuation */
console.log("\n=== sentences without final punctuation ===");
sents.filter(s => !/[.!?~]$/.test(s.ko.trim())).forEach(s => console.log(s.at, s.ko));

/* a gloss that is empty or suspiciously long */
console.log("\n=== empty or overlong glosses ===");
vocab.filter(v => !v.zh || v.zh.length > 18).forEach(v => console.log(v.at, v.ko, "|", v.zh));

console.log("\n=== totals ===");
console.log("vocab", vocab.length, "unique", byKo.size, "| sentences", sents.length);
