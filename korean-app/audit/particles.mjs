/* Korean selects these by whether the preceding syllable has a coda, which is
   mechanical — so a mismatch is always an error. Word-final syllables that
   merely look like particles (곰팡이, 추가) are filtered by requiring the
   particle to be followed by more text. */
import { load, corpus } from "./harness.mjs";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
const { weeks } = load();
const { vocab, sents } = corpus(weeks);

const coda = (ch) => { const c = ch.charCodeAt(0) - 0xac00; return c >= 0 && c <= 11171 && c % 28 !== 0; };
const isRieul = (ch) => { const c = ch.charCodeAt(0) - 0xac00; return c >= 0 && c % 28 === 8; };

/* [regex, requires a coda, correct form when it doesn't fit] */
const RULES = [
  /* "-에요" is not a spelling of the copula at all: it is 이에요 or 예요.
     Only 아니에요 (from the verb 아니다) legitimately ends that way. */
  [/([가-힣])에요/g,   "NEVER", "이에요/예요"],
  [/([가-힣])이에요/g, true,  "예요"],
  [/([가-힣])예요/g,   false, "이에요"],
  [/([가-힣])이었어요/g, true, "였어요"],
  [/([가-힣])였어요/g, false, "이었어요"],
  [/([가-힣])(은|는)\s/g,  null, "은/는"],
  [/([가-힣])(이|가)\s/g,  null, "이/가"],
  [/([가-힣])(을|를)\s/g,  null, "을/를"],
  [/([가-힣])(와|과)\s/g,  null, "와/과"],
  [/([가-힣])(으로|로)\s/g, null, "(으)로"]
];
const PAIR = { "은": true, "는": false, "이": true, "가": false, "을": true, "를": false,
               "과": true, "와": false, "으로": true, "로": false };

let bad = 0;
function check(where, s) {
  RULES.forEach(([re, need, right]) => {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(s))) {
      if (m.index === 0) continue;
      const prev = m[1], form = m[2];
      if (need === "NEVER") {
        if (prev === "이") continue;   /* the 이에요 form itself */
        if (prev === "니") continue;   /* 아니에요, from the verb 아니다 */
        bad++;
        console.log(`${where}  ${s}\n    "${prev}에요" is not a valid copula spelling` +
          ` -> ${prev}${coda(prev) ? "이에요" : "예요"}`);
        continue;
      }
      const wants = form !== undefined ? PAIR[form] : need;
      if (wants === undefined) continue;
      /* 로 also takes a bare ㄹ coda */
      if ((form === "로" || form === "으로") && isRieul(prev)) {
        if (form === "으로") { bad++; console.log(`${where}  ${s}\n    "${prev}으로" should be ${prev}로`); }
        continue;
      }
      if (coda(prev) === wants) continue;
      bad++;
      const fix = form !== undefined
        ? prev + (wants ? right.split("/")[1] : right.split("/")[0])
        : prev + right;
      console.log(`${where}  ${s}\n    "${prev}${form || m[0].slice(1)}" should be ${fix}`);
    }
  });
}

sents.forEach(s => check(s.at, s.ko));
vocab.filter(v => /\s/.test(v.ko)).forEach(v => check(v.at, v.ko));
for (const f of readdirSync("src/content")) {
  const txt = readFileSync(join("src/content", f), "utf8");
  (txt.match(/<code>[^<]*<\/code>/g) || []).forEach((c) => {
    const inner = c.replace(/<\/?code>/g, "");
    if (/[가-힣]/.test(inner) && !/[-()ㄱ-ㅎㅏ-ㅣ]/.test(inner)) check(f.slice(3, 9), inner);
  });
}
console.log(bad ? `\n${bad} particle mismatches` : "\nevery particle agrees with its stem");
