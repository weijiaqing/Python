#!/usr/bin/env node
/* Bundle src/ into a single-file app.
   - dist/index.html   full document (GitHub Pages / PWA install)
   - dist/artifact.html body fragment (Claude Artifact publish)          */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, "src");
const dist = join(here, "dist");
mkdirSync(dist, { recursive: true });

const css = readFileSync(join(src, "styles.css"), "utf8");
const app = readFileSync(join(src, "app.js"), "utf8");
const shell = readFileSync(join(src, "shell.html"), "utf8");

const contentDir = join(src, "content");
const files = readdirSync(contentDir).filter((f) => f.endsWith(".js")).sort();
const content = files.map((f) => readFileSync(join(contentDir, f), "utf8")).join("\n");

const fragment = shell
  .replace("/*__CSS__*/", css)
  .replace("/*__CONTENT__*/", content)
  .replace("/*__APP__*/", app);

writeFileSync(join(dist, "artifact.html"), fragment);

const full = `<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1">
<meta name="description" content="從零開始的韓文每日練習：52 週課程、間隔重複記憶卡、發音與文法。">
<meta name="theme-color" content="#0E6E62" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0F1312" media="(prefers-color-scheme: dark)">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="한글 365">
<link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="icon-180.png">
<style>html{color-scheme:light dark}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style>
${fragment}
<script>
if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("sw.js").catch(function () {});
  });
}
</script>
</body>
</html>
`;
writeFileSync(join(dist, "index.html"), full);

/* static PWA files ride along unchanged */
const pub = join(here, "public");
if (existsSync(pub)) {
  for (const f of readdirSync(pub)) copyFileSync(join(pub, f), join(dist, f));
}

const weeks = (content.match(/^\s*W\(/gm) || []).length;
console.log(
  `built ${weeks} weeks from ${files.length} content files -> ` +
  `dist/index.html (${(full.length / 1024).toFixed(0)} KB), dist/artifact.html (${(fragment.length / 1024).toFixed(0)} KB)`
);
