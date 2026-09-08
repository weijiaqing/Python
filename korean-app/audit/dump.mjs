import { load, corpus } from "./harness.mjs";
const { weeks, KO } = load();
const { vocab } = corpus(weeks);
const from = +process.argv[2], to = +process.argv[3];
let cur = "";
vocab.filter(v => { const w = +v.at.match(/W(\d+)/)[1]; return w >= from && w <= to; })
  .forEach(v => {
    if (v.at !== cur) { cur = v.at; console.log("\n-- " + cur); }
    const r = KO.readingOf(v.ko);
    console.log(`${v.ko}\t${KO.romanize(v.ko)}${r ? " [" + r + "]" : ""}\t${v.zh}`);
  });
