import { load, corpus } from "./harness.mjs";
const { weeks, KO } = load();
const { sents } = corpus(weeks);
const from = +process.argv[2], to = +process.argv[3];
sents.filter(s => { const w = +s.at.match(/W(\d+)/)[1]; return w >= from && w <= to; })
  .forEach(s => console.log(`${s.at}  ${s.ko}\n        ${s.zh}`));
