/* Two things the per-word engine cannot see on its own:
   assimilation across a space, and ㄴ-insertion at a compound seam.
   Both are listed here so every case gets a human decision. */
import { load, corpus } from "./harness.mjs";
const { weeks, KO } = load();
const { vocab } = corpus(weeks);

const L = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
const V = "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ";
const dec = (ch) => { const c = ch.charCodeAt(0) - 0xac00; return c < 0 || c > 11171 ? null
  : { l: Math.floor(c / 588), v: Math.floor((c % 588) / 28), t: c % 28 }; };

const seen = new Set();
console.log("=== space with a coda before it (assimilation may cross) ===");
vocab.forEach((x) => {
  const m = x.ko.match(/([가-힣]) ([가-힣])/g) || [];
  m.forEach(() => {});
  const parts = x.ko.split(/\s+/);
  if (parts.length < 2) return;
  for (let i = 0; i < parts.length - 1; i++) {
    const a = dec(parts[i].slice(-1)), b = dec(parts[i + 1][0]);
    if (!a || !b || !a.t) continue;
    if (seen.has(x.ko)) return;
    seen.add(x.ko);
    console.log(`${x.at}  ${x.ko}   -> now [${KO.pronounce(x.ko)}]`);
  }
});

console.log("\n=== possible ㄴ-insertion seams (coda + 이/야/여/요/유) ===");
const YV = [20, 2, 6, 12, 17];   // ㅣ ㅑ ㅕ ㅛ ㅠ
const shown = new Set();
vocab.forEach((x) => {
  const s = x.ko.replace(/\s/g, "");
  for (let i = 0; i < s.length - 1; i++) {
    const a = dec(s[i]), b = dec(s[i + 1]);
    if (!a || !b || !a.t) continue;
    if (b.l !== 11 || !YV.includes(b.v)) continue;   // next starts with ㅇ + y-vowel
    if (shown.has(x.ko)) break;
    shown.add(x.ko);
    console.log(`${x.at}  ${x.ko}\t-> now [${KO.pronounce(x.ko)}]\t${x.zh}`);
  }
});
