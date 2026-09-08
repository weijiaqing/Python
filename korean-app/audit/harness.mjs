/* Loads the app's phonology engine and all lesson data outside the browser,
   so pronunciations and glosses can be checked in bulk. */
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

export function load() {
  const win = { KO_WEEKS: [], KO_HANGUL: {} };
  const doc = {
    readyState: "loading", addEventListener() {},
    documentElement: { removeAttribute() {}, setAttribute() {} },
    querySelectorAll: () => [], getElementById: () => null,
    createElement: () => ({ style: {}, classList: { toggle() {}, add() {} } })
  };
  const store = { getItem: () => null, setItem() {} };

  const dir = join(root, "src/content");
  for (const f of readdirSync(dir).sort()) {
    new Function("window", readFileSync(join(dir, f), "utf8"))(win);
  }
  new Function("window", "document", "localStorage",
    readFileSync(join(root, "src/app.js"), "utf8"))(win, doc, store);

  return { weeks: win.KO_WEEKS, hangul: win.KO_HANGUL, KO: win.KO };
}

/* every Korean string the learner can see, with where it came from */
export function corpus(weeks) {
  const vocab = [], sents = [], letters = [];
  weeks.forEach((w) => w.d.forEach((d, j) => {
    const at = `W${w.n}D${j + 1}`;
    (d.v || []).forEach((v) => vocab.push({ at, ko: v[0], zh: v[1], note: v[2] || "" }));
    (d.s || []).forEach((s) => sents.push({ at, ko: s[0], zh: s[1] }));
    (d.letters || []).forEach((L) => letters.push({ at, glyph: L[0], ro: L[1], say: L[2], note: L[3] || "" }));
  }));
  return { vocab, sents, letters };
}
