/* In the Hangul weeks a word must only use letters already introduced,
   otherwise the learner is asked to read something they cannot yet decode. */
import { load } from "./harness.mjs";
const { weeks } = load();

const L = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
const V = "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ";
const T = "_ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ";

const known = new Set(["ㅇ"]);          // the silent placeholder is given on day 1
const codaOK = () => known.has("__batchim__");

let problems = 0;
for (const w of weeks.slice(0, 3)) {          // weeks 1-3 are the decoding stage
  for (const [i, d] of w.d.entries()) {
    (d.letters || []).forEach((x) => {
      for (const ch of x[0]) if (L.includes(ch) || V.includes(ch) || T.includes(ch)) known.add(ch);
      if (/받침|겹받침/.test(w.k) || x[1].startsWith("-") || x[1].startsWith("→")) known.add("__batchim__");
    });
    if (w.n === 2 && i >= 3) known.add("__batchim__");   // batchim taught from W2D4
    for (const [ko] of (d.v || [])) {
      for (const ch of ko) {
        const c = ch.charCodeAt(0) - 0xac00;
        if (c < 0 || c > 11171) continue;
        const l = L[Math.floor(c / 588)], v = V[Math.floor((c % 588) / 28)], t = T[c % 28];
        const missing = [];
        if (!known.has(l)) missing.push(l);
        if (!known.has(v)) missing.push(v);
        if (t !== "_" && !codaOK()) missing.push("받침 " + t);
        else if (t !== "_" && !known.has(t)) missing.push("받침 " + t);
        if (missing.length) { problems++; console.log(`W${w.n}D${i + 1}  ${ko}  uses untaught: ${missing.join(" ")}`); }
      }
    }
  }
}
console.log(problems ? `\n${problems} out-of-sequence letters` : "\nevery word is decodable when introduced");
