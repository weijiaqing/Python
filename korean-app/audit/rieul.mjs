/* ㄹ + ㄱㄷㅂㅅㅈ tenses only when the ㄹ is the ending -(으)ㄹ, not when it
   belongs to the stem: 할게요 [할께요] but 알게 되다 [알게 되다].
   No rule can tell those apart, so every occurrence is listed for a decision. */
import { load, corpus } from "./harness.mjs";
const { weeks, KO } = load();
const { vocab, sents } = corpus(weeks);

const dec = (ch) => { const c = ch.charCodeAt(0) - 0xac00; return c < 0 || c > 11171 ? null
  : { l: Math.floor(c / 588), v: Math.floor((c % 588) / 28), t: c % 28 }; };
const LAX = [0, 3, 7, 9, 12];   // ㄱ ㄷ ㅂ ㅅ ㅈ

const hits = new Map();
const scan = (at, s) => {
  const c = s.replace(/\s/g, "");
  for (let i = 0; i < c.length - 1; i++) {
    const a = dec(c[i]), b = dec(c[i + 1]);
    if (!a || !b || a.t !== 8 || !LAX.includes(b.l)) continue;   // coda ㄹ
    const key = c.slice(Math.max(0, i - 1), i + 3);
    if (!hits.has(key)) hits.set(key, { at, ex: s, n: 0 });
    hits.get(key).n++;
  }
};
vocab.forEach(v => scan(v.at, v.ko));
sents.forEach(s => scan(s.at, s.ko));

[...hits.entries()].sort().forEach(([k, v]) =>
  console.log(`${k}\tx${v.n}\t${v.at}\t${v.ex}\t-> [${KO.pronounce(v.ex)}]`));
console.log("\n" + hits.size + " distinct ㄹ+lax-consonant sites");
