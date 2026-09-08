/* =========================================================
   한글 365 — engine
   ========================================================= */
(function () {
  "use strict";

  var WEEKS = window.KO_WEEKS || [];
  var HANGUL = window.KO_HANGUL || {};

  var PHASES = [
    { n: 1, zh: "文字基礎", ko: "한글", from: 1, to: 4 },
    { n: 2, zh: "生存韓語", ko: "생존 한국어", from: 5, to: 13 },
    { n: 3, zh: "基礎會話", ko: "기초 회화", from: 14, to: 26 },
    { n: 4, zh: "自然口語", ko: "자연스러운 말", from: 27, to: 39 },
    { n: 5, zh: "實戰溝通", ko: "실전 소통", from: 40, to: 52 }
  ];

  /* ---------- Revised Romanization ---------- */

  var ONS = ["g","kk","n","d","tt","r","m","b","pp","s","ss","","j","jj","ch","k","t","p","h"];
  var VOW = ["a","ae","ya","yae","eo","e","yeo","ye","o","wa","wae","oe","yo","u","wo","we","wi","yu","eu","ui","i"];
  var COD = ["","k","k","k","n","n","n","t","l","k","m","l","l","l","p","l","m","p","p","t","t","ng","t","t","k","t","p","t"];

  // jamo index tables for rule work
  var L_G=0,L_KK=1,L_N=2,L_D=3,L_TT=4,L_R=5,L_M=6,L_B=7,L_PP=8,L_S=9,L_SS=10,L_NG=11,
      L_J=12,L_JJ=13,L_CH=14,L_K=15,L_T=16,L_P=17,L_H=18;
  var T_NONE=0,T_G=1,T_KK=2,T_GS=3,T_N=4,T_NJ=5,T_NH=6,T_D=7,T_L=8,T_LG=9,T_LM=10,
      T_LB=11,T_LS=12,T_LT=13,T_LP=14,T_LH=15,T_M=16,T_B=17,T_BS=18,T_S=19,T_SS=20,
      T_NG=21,T_J=22,T_CH=23,T_K=24,T_T=25,T_P=26,T_H=27;

  // representative sound of a final (칠종성) -> group
  function codaGroup(t) {
    if ([T_G,T_KK,T_GS,T_LG,T_K].indexOf(t) >= 0) return "k";
    if ([T_D,T_S,T_SS,T_J,T_CH,T_T,T_H].indexOf(t) >= 0) return "t";
    if ([T_B,T_BS,T_LP,T_P].indexOf(t) >= 0) return "p";
    if ([T_N,T_NJ,T_NH].indexOf(t) >= 0) return "n";
    if ([T_L,T_LM,T_LB,T_LS,T_LT,T_LH].indexOf(t) >= 0) return t === T_LM ? "m" : "l";
    if (t === T_M) return "m";
    if (t === T_NG) return "ng";
    return "";
  }

  // when a final splits on liaison: [stays, moves]
  var SPLIT = {};
  SPLIT[T_GS] = [T_G, L_S];   SPLIT[T_NJ] = [T_N, L_J];   SPLIT[T_NH] = [T_N, L_H];
  SPLIT[T_LG] = [T_L, L_G];   SPLIT[T_LM] = [T_L, L_M];   SPLIT[T_LB] = [T_L, L_B];
  SPLIT[T_LS] = [T_L, L_S];   SPLIT[T_LT] = [T_L, L_T];   SPLIT[T_LP] = [T_L, L_P];
  SPLIT[T_LH] = [T_L, L_H];   SPLIT[T_BS] = [T_B, L_S];
  // single finals moving wholesale
  var MOVE = {};
  MOVE[T_G]=L_G; MOVE[T_KK]=L_KK; MOVE[T_N]=L_N; MOVE[T_D]=L_D; MOVE[T_L]=L_R;
  MOVE[T_M]=L_M; MOVE[T_B]=L_B; MOVE[T_S]=L_S; MOVE[T_SS]=L_SS; MOVE[T_J]=L_J;
  MOVE[T_CH]=L_CH; MOVE[T_K]=L_K; MOVE[T_T]=L_T; MOVE[T_P]=L_P;

  function decompose(word) {
    var out = [], i, c, code;
    for (i = 0; i < word.length; i++) {
      c = word.charCodeAt(i);
      if (c >= 0xAC00 && c <= 0xD7A3) {
        code = c - 0xAC00;
        out.push({ l: Math.floor(code / 588), v: Math.floor((code % 588) / 28), t: code % 28 });
      } else {
        out.push({ raw: word[i] });
      }
    }
    return out;
  }

  /* Bound nouns that follow the 관형형 ending -(으)ㄹ. After that ㄹ they are
     always tense (갈 거 [갈 꺼], 할 수 [할 쑤]) — unlike a plain ㄹ-final word,
     where nothing happens (잘 가, 줄 서다). */
  var BOUND = { "거": 1, "것": 1, "게": 1, "걸": 1, "데": 1, "수": 1, "줄": 1, "지": 1, "바": 1, "적": 1 };
  function isBound(s) {
    return BOUND[String.fromCharCode(0xAC00 + (s.l * 21 + s.v) * 28 + s.t)] === 1;
  }

  function applyRules(sy, tense) {
    var i, a, b, g, gap, seq = [];
    for (i = 0; i < sy.length; i++) if (!sy[i].raw) seq.push(i);

    for (var k = 0; k < seq.length - 1; k++) {
      a = sy[seq[k]]; b = sy[seq[k + 1]];
      /* a space between two syllables blocks liaison — 옷 안 is [오단], not
         [오산] — but not nasalisation or tensing, which cross it freely. */
      gap = seq[k + 1] !== seq[k] + 1;
      if (gap) {
        g = codaGroup(a.t);
        if (b.l === L_N || b.l === L_M) {
          if (g === "k") a.t = T_NG;
          else if (g === "t") a.t = T_N;
          else if (g === "p") a.t = T_M;
          continue;
        }
        if (tense && (g === "k" || g === "t" || g === "p" || (g === "l" && isBound(b)))) {
          if (b.l === L_G) b.l = L_KK;
          else if (b.l === L_D) b.l = L_TT;
          else if (b.l === L_B) b.l = L_PP;
          else if (b.l === L_S) b.l = L_SS;
          else if (b.l === L_J) b.l = L_JJ;
        }
        continue;
      }

      /* 1. ㅎ 축약 (aspiration) */
      if (a.t === T_H || a.t === T_NH || a.t === T_LH) {
        if (b.l === L_G) { b.l = L_K; a.t = a.t === T_NH ? T_N : a.t === T_LH ? T_L : T_NONE; continue; }
        if (b.l === L_D) { b.l = L_T; a.t = a.t === T_NH ? T_N : a.t === T_LH ? T_L : T_NONE; continue; }
        if (b.l === L_J) { b.l = L_CH; a.t = a.t === T_NH ? T_N : a.t === T_LH ? T_L : T_NONE; continue; }
        if (b.l === L_S) { b.l = L_SS; a.t = a.t === T_NH ? T_N : a.t === T_LH ? T_L : T_NONE; continue; }
        if (b.l === L_NG) { a.t = a.t === T_NH ? T_N : a.t === T_LH ? T_L : T_NONE; }
        if (b.l === L_N) { a.t = a.t === T_NH ? T_N : a.t === T_LH ? T_L : T_N; }
      }
      if (b.l === L_H) {
        if (a.t === T_G || a.t === T_LG) { b.l = L_K; a.t = a.t === T_LG ? T_L : T_NONE; continue; }
        if (a.t === T_D || a.t === T_S || a.t === T_SS) { b.l = L_T; a.t = T_NONE; continue; }
        if (a.t === T_B || a.t === T_LB) { b.l = L_P; a.t = a.t === T_LB ? T_L : T_NONE; continue; }
        if (a.t === T_J || a.t === T_NJ) { b.l = L_CH; a.t = a.t === T_NJ ? T_N : T_NONE; continue; }
      }

      /* 2. 연음 (liaison) into a following ㅇ */
      if (b.l === L_NG && a.t !== T_NONE && a.t !== T_NG) {
        /* 구개음화: ㄷ/ㅌ + 이/히-계열 */
        if ((a.t === T_D) && b.v === 20) { b.l = L_J; a.t = T_NONE; continue; }
        if ((a.t === T_T || a.t === T_LT) && b.v === 20) { b.l = L_CH; a.t = a.t === T_LT ? T_L : T_NONE; continue; }
        if (SPLIT[a.t]) {
          b.l = SPLIT[a.t][1];
          a.t = SPLIT[a.t][0];
          /* 제14항: the ㅅ freed from a cluster is tense — 값이 [갑씨] */
          if (tense && b.l === L_S) b.l = L_SS;
          continue;
        }
        if (MOVE[a.t] !== undefined) { b.l = MOVE[a.t]; a.t = T_NONE; continue; }
      }

      /* 3. 유음화 (lateralization) */
      if ((a.t === T_N) && b.l === L_R) { a.t = T_L; continue; }
      if ((a.t === T_L || a.t === T_LT || a.t === T_LH) && b.l === L_N) { b.l = L_R; continue; }

      /* 4. ㄹ 비음화: 받침(ㄱ/ㅂ/ㅁ/ㅇ) + ㄹ → ㄴ */
      g = codaGroup(a.t);
      if (b.l === L_R && (g === "k" || g === "p" || g === "m" || g === "ng")) b.l = L_N;

      /* 5. 비음화 (obstruent nasalisation before ㄴ/ㅁ) */
      g = codaGroup(a.t);
      if (b.l === L_N || b.l === L_M) {
        if (g === "k") a.t = T_NG;
        else if (g === "t") a.t = T_N;
        else if (g === "p") a.t = T_M;
        continue;
      }

      /* 6. 경음화 — an obstruent coda always tenses a following ㄱㄷㅂㅅㅈ.
         Revised Romanization deliberately leaves this unmarked (학교 is
         romanized Hakgyo), so it runs only for the phonetic reading. */
      if (tense) {
        g = codaGroup(a.t);
        if (g === "k" || g === "t" || g === "p") {
          if (b.l === L_G) b.l = L_KK;
          else if (b.l === L_D) b.l = L_TT;
          else if (b.l === L_B) b.l = L_PP;
          else if (b.l === L_S) b.l = L_SS;
          else if (b.l === L_J) b.l = L_JJ;
        }
      }
    }
    return sy;
  }

  /* Words whose real pronunciation depends on morphology the code cannot see:
     ㄴ-insertion needs a compound boundary (십육 → 심뉵, not 시뷱), and a verb
     stem in ㄴ/ㅁ tenses its ending (앉다 → 안따) while the same shape in a
     noun does not (신고 stays 신고). Values are written with those changes
     applied; the regular rules above then run over them as usual. */
  var PHON = {
    /* ㄴ 첨가 — needs a compound boundary the code cannot see */
    "십육": "십뉵", "육십육": "육십뉵", "서울역": "서울녁", "색연필": "색년필",
    "담요": "담뇨", "꽃잎": "꽃닙", "한여름": "한녀름", "알약": "알냑",
    "그럼요": "그럼뇨", "잠깐만요": "잠깐만뇨", "무슨 일": "무슨 닐",
    /* a verb stem in ㄴ/ㅁ tenses its ending; the same shape in a noun does not */
    "앉다": "안따", "얹다": "언따", "신다": "신따", "감다": "감따",
    "젊다": "점따", "닮다": "담따", "껴안다": "껴안따",
    /* ㄼ/ㄾ stems tense their ending (제25항); 밟- is the standing exception
       to ㄼ being read [ㄹ] at all */
    "넓다": "널따", "짧다": "짤따", "얇다": "얄따", "핥다": "할따",
    "밟다": "밥따", "갈게": "갈께", "될지": "될찌",
    "문법": "문뻡", "맞춤법": "맏춤뻡", "높임법": "노핌뻡", "발이 넓다": "바리 널따", "입이 짧다": "이비 짤따",
    /* 맛없다 takes the neutralised coda before a full morpheme (제15항),
       unlike 맛있다 which is commonly [마시따] */
    "맛없다": "맏없다", "맛없어요": "맏없어요", "맛없는": "맏없는",
    /* ㄴ 첨가 at a compound seam */
    "지하철역": "지하철녁", "집안일": "집안닐", "별일": "별닐",
    "별일 없어요": "별닐 없어요", "할 일": "할 릴",
    /* assimilation across a space */
    "일 년": "일 련", "몇 월": "며 둴", "못 해요": "모 태요",
    /* 관형형 -(으)ㄹ tenses the bound noun after it: 갈 거 [갈 꺼] */
    /* 의 as the possessive particle is said [에] */
    "하늘의 별 따기": "하느레 별 따기"
  };

  /* The endings -(으)ㄹ게(요) and -(으)ㄹ걸 are tense (할게요 [할께요]); a stem
     in ㄹ plus -게 is not (알게 되다), so only the shapes that can only be the
     ending are rewritten here. */
  function tenseEndings(text) {
    return text.replace(/([가-힣])(게요|걸요|걸)(?=$|[\s.,!?~])/g, function (m, prev, end) {
      var p = prev.charCodeAt(0) - 0xAC00;
      if (p < 0 || p % 28 !== T_L) return m;
      return prev + (end.charAt(0) === "게" ? "께" : "껄") + end.slice(1);
    });
  }

  /* The whole phrase is decomposed at once — spaces stay in the array as raw
     entries, so applyRules can see across them where the language does. */
  function phonemes(text, tense) {
    var src = PHON[text];
    if (!src) {
      /* exceptions are looked up per word, but the rules then run over the
         whole phrase so assimilation can cross a space */
      src = String(text).split(/(\s+)/).map(function (w) {
        if (/^\s*$/.test(w)) return w;
        var bare = w.replace(/[^가-힣]/g, "");
        if (PHON[bare]) return w.replace(bare, PHON[bare]);
        return tense ? tenseEndings(w) : w;
      }).join("");
    }
    return applyRules(decompose(src), tense);
  }

  function romanize(text) {
    if (!text) return "";
    var sy = phonemes(text, false), out = "", prev = "", i, s, on;
    for (i = 0; i < sy.length; i++) {
      s = sy[i];
      /* a space does not break the ll of 일 년; other raw characters do */
      if (s.raw !== undefined) { out += s.raw; if (!/\s/.test(s.raw)) prev = ""; continue; }
      on = ONS[s.l];
      /* RR: ㄹ is "r" at onset but "ll" after an l-coda */
      if (s.l === L_R && prev === "l") on = "l";
      out += on + VOW[s.v] + COD[s.t];
      prev = COD[s.t];
    }
    return out;
  }

  /* 음절의 끝소리 규칙: whatever is written, only these seven sounds can
     actually close a syllable — 옷 is said [옫], 닭 is said [닥]. */
  var NEUTRAL = { k: T_G, n: T_N, t: T_D, l: T_L, m: T_M, p: T_B, ng: T_NG };
  var V_UI = 19, V_I = 20;
  /* ㅑ→ㅏ ㅒ→ㅐ ㅕ→ㅓ ㅖ→ㅔ ㅛ→ㅗ ㅠ→ㅜ */
  var DEGLIDE = { 2: 0, 3: 1, 6: 4, 7: 5, 12: 8, 17: 13 };

  function pronounce(text) {
    if (!text) return "";
    var sy = phonemes(text, true), out = "", i, s, tt, v;
    for (i = 0; i < sy.length; i++) {
      s = sy[i];
      if (s.raw !== undefined) { out += s.raw; continue; }
      tt = s.t && NEUTRAL[codaGroup(s.t)] !== undefined ? NEUTRAL[codaGroup(s.t)] : s.t;
      /* 제5항 다만3: ㅢ after a real consonant is said [ㅣ] — 저희 [저히].
         RR still writes it "ui", so this is phonetic only. */
      v = (s.v === V_UI && s.l !== L_NG) ? V_I : s.v;
      /* Korean has no glide after an affricate: 죠 is said [조], 쳐 is [처]
         (제5항 다만1). Written that way, spoken without the y. */
      if (s.l === L_J || s.l === L_JJ || s.l === L_CH) v = DEGLIDE[v] !== undefined ? DEGLIDE[v] : v;
      out += String.fromCharCode(0xAC00 + (s.l * 21 + v) * 28 + tt);
    }
    return out;
  }

  function readingOf(text) {
    /* grammar patterns like -(으)ㄹ 것 같다 aren't words; bracketing a
       reading for them is noise, not help */
    if (!text || /[-()/]/.test(text)) return "";
    var p = pronounce(text);
    return p !== text ? p : "";
  }

  /* ---------- storage ---------- */

  var KEY = "hangul365.v1";
  var S = load();

  function fresh() {
    return {
      v: 1, day: 1, done: {}, streak: { n: 0, last: "" },
      srs: {}, opt: { ro: true, rate: 0.85, theme: "auto" },
      stats: { correct: 0, total: 0 }
    };
  }
  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return fresh();
      var s = JSON.parse(raw), f = fresh(), k;
      for (k in f) if (!(k in s)) s[k] = f[k];
      for (k in f.opt) if (!(k in s.opt)) s.opt[k] = f.opt[k];
      return s;
    } catch (e) { return fresh(); }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {}
  }

  function today() {
    var d = new Date();
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }
  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function daysBetween(a, b) {
    return Math.round((new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 86400000);
  }
  function touchStreak() {
    var t = today();
    if (S.streak.last === t) return;
    if (S.streak.last && daysBetween(S.streak.last, t) === 1) S.streak.n += 1;
    else S.streak.n = 1;
    S.streak.last = t;
  }

  /* ---------- curriculum helpers ---------- */

  function totalDays() { return WEEKS.length * 7; }
  function weekOf(day) { return Math.ceil(day / 7); }
  function idxOf(day) { return (day - 1) % 7; }
  function getWeek(n) { return WEEKS[n - 1]; }
  function getDay(day) {
    var w = getWeek(weekOf(day));
    if (!w) return null;
    return w.d[idxOf(day)] || null;
  }
  function phaseOf(week) {
    for (var i = 0; i < PHASES.length; i++)
      if (week >= PHASES[i].from && week <= PHASES[i].to) return PHASES[i];
    return PHASES[0];
  }
  function weekVocab(wn) {
    var w = getWeek(wn), out = [], i, j;
    if (!w) return out;
    for (i = 0; i < w.d.length; i++) {
      var d = w.d[i];
      if (!d || !d.v) continue;
      for (j = 0; j < d.v.length; j++)
        out.push({ id: "w" + wn + "d" + (i + 1) + "v" + j, ko: d.v[j][0], zh: d.v[j][1], note: d.v[j][2] || "" });
    }
    return out;
  }
  function weekSents(wn) {
    var w = getWeek(wn), out = [], i, j;
    if (!w) return out;
    for (i = 0; i < w.d.length; i++) {
      var d = w.d[i];
      if (!d || !d.s) continue;
      for (j = 0; j < d.s.length; j++) out.push({ ko: d.s[j][0], zh: d.s[j][1] });
    }
    return out;
  }
  function dayVocab(day) {
    var d = getDay(day), wn = weekOf(day), di = idxOf(day) + 1, out = [], j;
    if (!d) return out;
    if (d.review) return weekVocab(wn);
    if (!d.v) return out;
    for (j = 0; j < d.v.length; j++)
      out.push({ id: "w" + wn + "d" + di + "v" + j, ko: d.v[j][0], zh: d.v[j][1], note: d.v[j][2] || "" });
    return out;
  }
  function daySents(day) {
    var d = getDay(day);
    if (!d) return [];
    if (d.review) return weekSents(weekOf(day));
    return (d.s || []).map(function (x) { return { ko: x[0], zh: x[1] }; });
  }
  function heroOf(day) {
    var d = getDay(day);
    if (!d) return { ko: "", zh: "" };
    if (d.hero) return { ko: d.hero, zh: d.heroZh || "" };
    if (d.review) return { ko: "복습", zh: "本週複習" };
    if (d.letters && d.letters.length) return { ko: d.letters.map(function (x) { return x[0]; }).slice(0, 4).join(""), zh: d.t };
    if (d.v && d.v.length) return { ko: d.v[0][0], zh: d.v[0][1] };
    return { ko: d.k || "", zh: d.t || "" };
  }

  /* ---------- tts ---------- */

  var voices = [];
  function loadVoices() {
    try { voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : []; } catch (e) { voices = []; }
  }
  if (window.speechSynthesis) {
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }
  function speak(text) {
    if (!window.speechSynthesis || !text) return;
    try {
      window.speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(String(text));
      u.lang = "ko-KR";
      u.rate = S.opt.rate;
      if (!voices.length) loadVoices();
      var v = voices.filter(function (x) { return /^ko/i.test(x.lang); })[0];
      if (v) u.voice = v;
      window.speechSynthesis.speak(u);
    } catch (e) {}
  }

  /* ---------- letters ---------- */

  /* A bare consonant can't be pronounced on its own, so Korean gives each one
     a name — ㄱ is 기역. Speaking that name is what a Korean would say, but a
     learner tapping ㄱ on day two wants the *sound*, and hears two unexplained
     syllables instead. So tapping plays the letter in a syllable (ㄱ → 가) and
     the name stays visible in the cell, where it belongs. */
  var LETTER_NAMES = {
    "기역": "가", "니은": "나", "디귿": "다", "리을": "라", "미음": "마",
    "비읍": "바", "시옷": "사", "이응": "아", "지읒": "자", "치읓": "차",
    "키읔": "카", "티읕": "타", "피읖": "파", "히읗": "하",
    "쌍기역": "까", "쌍디귿": "따", "쌍비읍": "빠", "쌍시옷": "싸", "쌍지읒": "짜"
  };

  function letterSay(L) { return LETTER_NAMES[L[2]] || L[2] || L[0]; }
  function letterName(L) { return LETTER_NAMES[L[2]] ? L[2] : ""; }

  function letterCell(L) {
    var c = el("button", "lcell");
    var say = letterSay(L), name = letterName(L);
    c.innerHTML = '<span class="g">' + esc(L[0]) + "</span>" +
      '<span class="r">' + esc(L[1]) + "</span>" +
      (name ? '<span class="nm">' + esc(say) + '<i>' + esc(name) + "</i></span>" : "") +
      (L[3] ? '<span class="n">' + esc(L[3]) + "</span>" : "");
    c.setAttribute("aria-label", L[0] + " " + say + (name ? " " + name : ""));
    c.onclick = function () { speak(say); };
    return c;
  }

  /* ---------- dom helpers ---------- */

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1)), t = a[i];
      a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function sample(arr, n, exclude) {
    var pool = arr.filter(function (x) { return !exclude || exclude.indexOf(x) < 0; });
    return shuffle(pool).slice(0, n);
  }
  var SPK = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a9 9 0 0 1 0 14"/></svg>';

  /* =========================================================
     views
     ========================================================= */

  var root, tabs, quizState = null;

  function setView(name) {
    document.querySelectorAll(".view").forEach(function (v) { v.classList.toggle("on", v.id === "v-" + name); });
    document.querySelectorAll(".tabbar button").forEach(function (b) {
      b.setAttribute("aria-selected", b.dataset.tab === name ? "true" : "false");
    });
    window.scrollTo(0, 0);
    if (name === "today") renderToday();
    if (name === "hangul") renderHangul();
    if (name === "cards") renderCards();
    if (name === "plan") renderPlan();
    if (name === "progress") renderProgress();
    updateTop();
  }

  function updateTop() {
    var w = weekOf(S.day), p = phaseOf(w);
    document.getElementById("bar-title").textContent = "한글 365";
    document.getElementById("bar-sub").textContent = "第 " + S.day + " 天 · 第 " + w + " 週 · " + p.zh;
    document.getElementById("bar-streak").innerHTML = "連續 <b>" + S.streak.n + "</b> 天";
  }

  /* ---------- TODAY ---------- */

  function renderToday(day) {
    var d = day || S.day;
    var v = document.getElementById("v-today");
    v.innerHTML = "";
    var data = getDay(d);
    if (!data) { v.appendChild(el("div", "empty", '<span class="gl">끝</span><p>課程已全部完成。</p>')); return; }

    var w = weekOf(d), wk = getWeek(w), p = phaseOf(w), hero = heroOf(d);

    var card = el("div", "block-card");
    card.appendChild(el("div", "eyebrow", "DAY " + d + " / " + totalDays()));
    var pt = el("div", "", '<span class="phase-tag">階段 ' + p.n + " · " + p.zh + "</span>");
    pt.style.marginTop = "8px";
    card.appendChild(pt);
    var n = hero.ko.length;
    var hw = el("div", "hero-word" + (n >= 10 ? " len-l" : n >= 6 ? " len-m" : ""), esc(hero.ko));
    hw.onclick = function () { speak(hero.ko); };
    card.appendChild(hw);
    card.appendChild(el("div", "hero-ro", esc(romanize(hero.ko))));
    if (hero.zh) card.appendChild(el("div", "hero-zh", esc(hero.zh)));
    card.appendChild(el("div", "hero-title", esc(data.t || "")));
    if (data.k) card.appendChild(el("div", "hero-ro", esc(data.k)));

    var strip = el("div", "weekstrip");
    for (var i = 1; i <= 7; i++) {
      (function (dayNum, i) {
        var b = el("button", "wsq");
        var h = heroOf(dayNum);
        b.textContent = i === 7 ? "복" : (h.ko ? h.ko[0] : i);
        if (S.done[dayNum]) b.classList.add("done");
        if (dayNum === d) b.classList.add("today");
        b.setAttribute("aria-label", "第 " + dayNum + " 天");
        b.onclick = function () { S.day = dayNum; save(); renderToday(); updateTop(); };
        strip.appendChild(b);
      })((w - 1) * 7 + i, i);
    }
    card.appendChild(strip);
    v.appendChild(card);

    if (wk) {
      var wl = el("div", "tip", "<b>本週主題</b>　" + esc(wk.t) + "　<span style='font-family:var(--font-ko)'>" + esc(wk.k) + "</span>");
      v.appendChild(wl);
    }

    if (data.g) v.appendChild(section("文法重點", el("div", "grammar", data.g)));
    if (data.c) v.appendChild(section("文化筆記", el("div", "grammar culture", data.c)));

    if (data.letters && data.letters.length) {
      var lg = el("div", "lgrid");
      data.letters.forEach(function (L) { lg.appendChild(letterCell(L)); });
      var lw = el("div");
      lw.appendChild(lg);
      lw.appendChild(el("div", "tip", "點格子聽發音。子音會唸成<b>帶 ㅏ 的音節</b>（ㄱ→가），因為子音單獨無法發音；綠色小字是<b>那個字母的名字</b>，韓國人拼字時會用到。"));
      v.appendChild(section("字母", lw));
    }

    var vocab = data.review ? weekVocab(w) : dayVocab(d);
    if (vocab.length) {
      var vl = el("div", "vlist");
      vocab.forEach(function (x) {
        var r = el("button", "vrow");
        var rd = readingOf(x.ko);
        r.innerHTML = '<span class="kv"><span class="ko">' + esc(x.ko) +
          (rd ? ' <b class="rd">[' + esc(rd) + "]</b>" : "") + "</span>" +
          '<span class="ro">' + esc(romanize(x.ko)) + "</span>" +
          '<div class="zh">' + esc(x.zh) + "</div>" +
          (x.note ? '<div class="note">' + esc(x.note) + "</div>" : "") + "</span>" +
          '<span class="spk">' + SPK + "</span>";
        r.onclick = function () { speak(x.ko); };
        vl.appendChild(r);
      });
      v.appendChild(section("單字", vl, vocab.length + " 個"));
    }

    var sents = data.review ? weekSents(w) : daySents(d);
    if (sents.length) {
      var sl = el("div", "slist");
      sents.forEach(function (x) {
        var r = el("div", "sitem");
        r.innerHTML = '<div class="ko">' + esc(x.ko) + "</div>" +
          '<div class="ro">' + esc(romanize(x.ko)) + "</div>" +
          '<div class="zh">' + esc(x.zh) + "</div>";
        r.onclick = function () { speak(x.ko); };
        sl.appendChild(r);
      });
      v.appendChild(section("例句", sl, sents.length + " 句"));
    }

    var btn = el("button", "btn", S.done[d] ? "再練習一次" : "開始今日練習");
    btn.style.marginTop = "22px";
    btn.onclick = function () { startQuiz(d); };
    v.appendChild(btn);

    if (S.done[d] && d < totalDays()) {
      var nx = el("button", "btn quiet", "前往第 " + (d + 1) + " 天 →");
      nx.style.marginTop = "10px";
      nx.onclick = function () { S.day = d + 1; save(); renderToday(); updateTop(); };
      v.appendChild(nx);
    }
    applyRoPref();
  }

  function section(title, node, count) {
    var s = el("div", "sec");
    var h = el("div", "sec-h");
    h.appendChild(el("h2", "", esc(title)));
    h.appendChild(el("div", "rule"));
    if (count) h.appendChild(el("div", "count", esc(count)));
    s.appendChild(h);
    s.appendChild(node);
    return s;
  }

  function applyRoPref() {
    document.getElementById("app").classList.toggle("hide-ro", !S.opt.ro);
  }

  /* ---------- QUIZ ---------- */

  function buildQuestions(day) {
    var d = getDay(day), wn = weekOf(day);
    var vocab = d && d.review ? weekVocab(wn) : dayVocab(day);
    var sents = d && d.review ? weekSents(wn) : daySents(day);
    var poolV = weekVocab(wn);
    if (poolV.length < 8) {
      for (var k = Math.max(1, wn - 2); k < wn; k++) poolV = poolV.concat(weekVocab(k));
    }
    if (poolV.length < 8) poolV = poolV.concat(weekVocab(Math.min(WEEKS.length, wn + 1)));
    var qs = [];

    /* letter questions for hangul days */
    if (d && d.letters && d.letters.length) {
      var lp = [];
      for (var w2 = 1; w2 <= Math.max(wn, 1); w2++) {
        var ww = getWeek(w2);
        if (!ww) continue;
        ww.d.forEach(function (dd) { if (dd && dd.letters) lp = lp.concat(dd.letters); });
      }
      shuffle(d.letters).slice(0, 5).forEach(function (L) {
        var others = sample(lp.filter(function (x) { return x[1] !== L[1]; }), 3);
        qs.push({
          type: "letter", label: "這個字母怎麼唸？", prompt: L[0], ko: true,
          options: shuffle([L].concat(others)).map(function (x) { return { text: x[1], ok: x[1] === L[1], mono: true }; }),
          answer: L[1], say: letterSay(L),
          note: (letterName(L) ? "字母名稱：" + letterName(L) + "　" : "") + (L[3] || "")
        });
      });
    }

    /* zh -> ko */
    shuffle(vocab).slice(0, 4).forEach(function (x) {
      var others = sample(poolV.filter(function (y) { return y.ko !== x.ko && y.zh !== x.zh; }), 3);
      qs.push({
        type: "z2k", label: "選出正確的韓文", prompt: x.zh,
        options: shuffle([x].concat(others)).map(function (y) { return { text: y.ko, ok: y.ko === x.ko, ko: true }; }),
        answer: x.ko, say: x.ko
      });
    });

    /* ko -> zh */
    shuffle(vocab).slice(0, 3).forEach(function (x) {
      var others = sample(poolV.filter(function (y) { return y.zh !== x.zh; }), 3);
      qs.push({
        type: "k2z", label: "這個單字是什麼意思？", prompt: x.ko, ko: true, sub: romanize(x.ko),
        options: shuffle([x].concat(others)).map(function (y) { return { text: y.zh, ok: y.zh === x.zh }; }),
        answer: x.zh, say: x.ko
      });
    });

    /* listening */
    shuffle(vocab).slice(0, 2).forEach(function (x) {
      var others = sample(poolV.filter(function (y) { return y.zh !== x.zh; }), 3);
      qs.push({
        type: "listen", label: "聽力：這是哪個單字？", prompt: "🔊", listen: x.ko,
        options: shuffle([x].concat(others)).map(function (y) { return { text: y.ko + "　" + y.zh, ok: y.ko === x.ko, ko: true }; }),
        answer: x.ko + "　" + x.zh, say: x.ko
      });
    });

    /* sentence assembly */
    shuffle(sents).filter(function (s) { return s.ko.split(/\s+/).length >= 2 && s.ko.split(/\s+/).length <= 8; })
      .slice(0, 3).forEach(function (s) {
        qs.push({ type: "build", label: "把句子組合起來", prompt: s.zh, target: s.ko, say: s.ko });
      });

    /* cloze */
    shuffle(sents).filter(function (s) { return s.ko.split(/\s+/).length >= 3; }).slice(0, 2).forEach(function (s) {
      var parts = s.ko.split(/\s+/);
      var i = Math.floor(Math.random() * parts.length);
      var missing = parts[i];
      var blanked = parts.map(function (p, j) { return j === i ? "____" : p; }).join(" ");
      var distract = sample(
        poolV.map(function (y) { return y.ko; })
          .concat(weekSents(wn).reduce(function (a, ss) { return a.concat(ss.ko.split(/\s+/)); }, []))
          .filter(function (t) { return t !== missing && t.length > 1; }), 3);
      if (distract.length < 3) return;
      qs.push({
        type: "cloze", label: "填入正確的字", prompt: blanked, ko: true, sub: s.zh,
        options: shuffle([missing].concat(distract)).map(function (t) { return { text: t, ok: t === missing, ko: true }; }),
        answer: missing, say: s.ko
      });
    });

    return shuffle(qs).slice(0, 12);
  }

  function startQuiz(day) {
    var qs = buildQuestions(day);
    if (!qs.length) { markDone(day); renderToday(day); return; }
    quizState = { day: day, qs: qs, i: 0, right: 0, wrong: [] };
    document.getElementById("v-quiz").classList.add("on");
    document.querySelectorAll(".view").forEach(function (v) { if (v.id !== "v-quiz") v.classList.remove("on"); });
    window.scrollTo(0, 0);
    renderQuestion();
  }

  function exitQuiz() {
    quizState = null;
    setView("today");
  }

  function renderQuestion() {
    var v = document.getElementById("v-quiz");
    v.innerHTML = "";
    var q = quizState.qs[quizState.i];

    var head = el("div", "qhead");
    var back = el("button", "iconbtn", "✕");
    back.setAttribute("aria-label", "離開練習");
    back.onclick = exitQuiz;
    head.appendChild(back);
    var bar = el("div", "qbar", "<i></i>");
    bar.querySelector("i").style.width = (quizState.i / quizState.qs.length * 100) + "%";
    head.appendChild(bar);
    head.appendChild(el("div", "qcount", (quizState.i + 1) + " / " + quizState.qs.length));
    v.appendChild(head);

    v.appendChild(el("div", "qtype", esc(q.label)));

    if (q.type === "listen") {
      var lb = el("button", "btn ghost", SPK + " 播放發音");
      lb.onclick = function () { speak(q.listen); };
      v.appendChild(lb);
      setTimeout(function () { speak(q.listen); }, 260);
    } else {
      var p = el("div", "qprompt" + (q.ko ? " ko" : ""), esc(q.prompt));
      v.appendChild(p);
      if (q.sub) v.appendChild(el("div", "qsub", esc(q.sub)));
    }

    if (q.type === "build") buildTask(v, q);
    else choiceTask(v, q);
  }

  function choiceTask(v, q) {
    var opts = el("div", "opts"), answered = false;
    q.options.forEach(function (o) {
      var b = el("button", "opt");
      b.innerHTML = '<span class="' + (o.ko ? "kotext" : o.mono ? "mono" : "") + '">' + esc(o.text) + "</span>";
      if (o.mono) b.querySelector("span").style.fontFamily = "var(--font-mono)";
      b.onclick = function () {
        if (answered) return;
        answered = true;
        S.stats.total++;
        if (o.ok) { S.stats.correct++; quizState.right++; b.classList.add("right"); }
        else {
          b.classList.add("wrong");
          quizState.wrong.push(q);
          opts.querySelectorAll(".opt").forEach(function (x, i) {
            if (q.options[i].ok) x.classList.add("right");
          });
        }
        opts.querySelectorAll(".opt").forEach(function (x) { if (!x.classList.contains("right") && !x.classList.contains("wrong")) x.classList.add("dim"); });
        if (q.say) speak(q.say);
        showFeedback(v, o.ok, q);
        save();
      };
      opts.appendChild(b);
    });
    v.appendChild(opts);
  }

  function buildTask(v, q) {
    var words = q.target.split(/\s+/);
    var pool = shuffle(words.map(function (w, i) { return { w: w, i: i }; }));
    var picked = [];
    var ans = el("div", "bank-answer");
    var bank = el("div", "bank-pool");
    var answered = false;

    function paint() {
      ans.innerHTML = "";
      picked.forEach(function (item, idx) {
        var c = el("button", "chip", esc(item.w));
        c.onclick = function () {
          if (answered) return;
          picked.splice(idx, 1);
          paint();
        };
        ans.appendChild(c);
      });
      bank.querySelectorAll(".chip").forEach(function (c, i) {
        c.classList.toggle("used", picked.indexOf(pool[i]) >= 0);
      });
      chk.disabled = picked.length !== words.length || answered;
    }

    pool.forEach(function (item) {
      var c = el("button", "chip", esc(item.w));
      c.onclick = function () {
        if (answered || picked.indexOf(item) >= 0) return;
        picked.push(item);
        paint();
      };
      bank.appendChild(c);
    });

    v.appendChild(ans);
    v.appendChild(bank);

    var chk = el("button", "btn", "確認");
    chk.style.marginTop = "18px";
    chk.disabled = true;
    chk.onclick = function () {
      if (answered) return;
      answered = true;
      var got = picked.map(function (x) { return x.w; }).join(" ");
      var ok = got === q.target;
      S.stats.total++;
      if (ok) { S.stats.correct++; quizState.right++; ans.classList.add("right"); }
      else { ans.classList.add("wrong"); quizState.wrong.push(q); }
      chk.disabled = true;
      speak(q.target);
      showFeedback(v, ok, q);
      save();
    };
    v.appendChild(chk);
    paint();
  }

  function showFeedback(v, ok, q) {
    var f = el("div", "feedback " + (ok ? "ok" : "no"));
    var ansText = q.target || q.answer || "";
    f.innerHTML = (ok ? "<b>正確</b>" : "<b>再看一次</b>") +
      '<span class="fko" style="margin-top:6px">' + esc(ansText) + "</span>" +
      '<span style="font-family:var(--font-mono);font-size:12px;opacity:.85">' + esc(romanize(ansText)) + "</span>" +
      (q.note ? "<div style='margin-top:6px'>" + esc(q.note) + "</div>" : "") +
      (q.sub && q.type === "build" ? "" : "");
    v.appendChild(f);

    var next = el("button", "btn", quizState.i + 1 >= quizState.qs.length ? "完成" : "下一題 →");
    next.style.marginTop = "12px";
    next.onclick = function () {
      quizState.i++;
      if (quizState.i >= quizState.qs.length) finishQuiz();
      else renderQuestion();
    };
    v.appendChild(next);
    next.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function markDone(day) {
    if (!S.done[day]) {
      S.done[day] = Date.now();
      dayVocab(day).forEach(function (x) {
        if (!S.srs[x.id]) S.srs[x.id] = { d: Date.now(), i: 0, e: 2.5, r: 0, ko: x.ko, zh: x.zh };
      });
    }
    touchStreak();
    if (S.day === day && day < totalDays()) S.day = day + 1;
    save();
  }

  function finishQuiz() {
    var st = quizState, v = document.getElementById("v-quiz");
    markDone(st.day);
    v.innerHTML = "";
    var pct = Math.round(st.right / st.qs.length * 100);
    var b = el("div", "done-banner");
    b.innerHTML = '<div class="seal">잘함</div>' +
      "<h2>第 " + st.day + " 天完成</h2>" +
      "<p>" + (pct >= 80 ? "掌握得很好，繼續保持。" : pct >= 50 ? "有進步，明天複習一次會更穩。" : "先別急，重做一次會更有感覺。") + "</p>" +
      '<div class="score">答對 ' + st.right + " / " + st.qs.length + "　·　連續 " + S.streak.n + " 天</div>";
    v.appendChild(b);

    if (st.wrong.length) {
      var list = el("div", "slist");
      var seen = {};
      st.wrong.forEach(function (q) {
        var t = q.target || q.answer;
        if (seen[t]) return;
        seen[t] = 1;
        var r = el("div", "sitem");
        r.innerHTML = '<div class="ko">' + esc(t) + "</div><div class=\"ro\">" + esc(romanize(t)) + "</div>";
        r.onclick = function () { speak(t); };
        list.appendChild(r);
      });
      b.appendChild(section("需要再看的", list));
    }

    var again = el("button", "btn ghost", "再練一次");
    again.style.marginTop = "18px";
    again.onclick = function () { startQuiz(st.day); };
    v.appendChild(again);

    var next = el("button", "btn", st.day < totalDays() ? "前往第 " + (st.day + 1) + " 天" : "回到首頁");
    next.style.marginTop = "10px";
    next.onclick = function () { if (st.day < totalDays()) S.day = st.day + 1; save(); exitQuiz(); };
    v.appendChild(next);
    quizState = null;
    window.scrollTo(0, 0);
  }

  /* ---------- HANGUL REFERENCE ---------- */

  function renderHangul() {
    var v = document.getElementById("v-hangul");
    v.innerHTML = "";
    var intro = el("div", "grammar");
    intro.innerHTML = "<h3>한글 · 韓文字母</h3><p>韓文有 <b>14 個基本子音</b>、<b>10 個基本母音</b>，再加上雙子音與複合母音。字母不是橫著排，而是<b>拼成方塊</b>：<code>ㅎ + ㅏ + ㄴ = 한</code>。先熟記字母表，再練發音變化，之後所有課程都會順很多。</p>";
    v.appendChild(intro);

    (HANGUL.groups || []).forEach(function (g) {
      var grid = el("div", "lgrid");
      g.items.forEach(function (L) { grid.appendChild(letterCell(L)); });
      var wrap = el("div");
      if (g.note) {
        var nt = el("div", "tip", g.note);
        nt.style.marginBottom = "10px";
        wrap.appendChild(nt);
      }
      wrap.appendChild(grid);
      v.appendChild(section(g.title, wrap, g.items.length + " 個"));
    });

    if (HANGUL.rules) {
      var rl = el("div", "rules-list");
      HANGUL.rules.forEach(function (r) {
        var c = el("div", "rule-card");
        c.innerHTML = "<b>" + esc(r.t) + "</b><p>" + r.d + "</p>" +
          '<div class="ex">' + r.ex + "</div>" +
          '<div class="ro" style="font-family:var(--font-mono);font-size:12px;color:var(--ink-3)">' + esc(r.ro || "") + "</div>";
        c.onclick = function () { speak(r.say || ""); };
        c.style.cursor = "pointer";
        rl.appendChild(c);
      });
      v.appendChild(section("發音變化規則", rl));
    }

    var tool = el("div", "card");
    tool.innerHTML = '<div style="font-size:13px;font-weight:600;margin-bottom:8px">發音對照工具</div>' +
      '<input id="ro-in" placeholder="輸入韓文，例如：좋아요" style="width:100%;padding:11px 12px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--ink);font-family:var(--font-ko);font-size:17px;font-weight:700" />' +
      '<div id="rd-out" style="font-family:var(--font-ko);font-size:19px;font-weight:700;color:var(--vermilion);margin-top:10px;min-height:24px"></div>' +
      '<div id="ro-out" style="font-family:var(--font-mono);font-size:14px;color:var(--ink-3);min-height:20px"></div>' +
      '<div class="tip"><b>紅字是實際發音</b>，套用連音、鼻音化、流音化、激音化、硬音化、口蓋音化等規則。' +
      '灰字是<b>羅馬拼音</b>（國際標準寫法）——依規定<b>不標硬音化</b>，所以 학교 拼作 hakgyo 卻唸 [학꾜]。' +
      '路牌和護照上看到的是灰字那一種。</div>';
    v.appendChild(section("發音與拼音", tool));
    var inp = tool.querySelector("#ro-in"), out = tool.querySelector("#ro-out"), rd = tool.querySelector("#rd-out");
    inp.addEventListener("input", function () {
      var s = inp.value;
      rd.textContent = s ? "[" + pronounce(s) + "]" : "";
      out.textContent = romanize(s);
    });
    inp.addEventListener("keydown", function (e) { if (e.key === "Enter") speak(inp.value); });
  }

  /* ---------- FLASHCARDS (SRS) ---------- */

  var fc = null;

  function dueCards() {
    var now = Date.now(), out = [], id;
    for (id in S.srs) if (S.srs[id].d <= now) out.push(S.srs[id]);
    return shuffle(out);
  }

  function renderCards() {
    var v = document.getElementById("v-cards");
    v.innerHTML = "";
    var all = Object.keys(S.srs).length;
    var due = dueCards();

    var stats = el("div", "stats");
    stats.innerHTML =
      '<div class="stat"><b>' + due.length + '</b><span>待複習</span></div>' +
      '<div class="stat"><b>' + all + '</b><span>卡片總數</span></div>' +
      '<div class="stat"><b>' + Object.keys(S.srs).filter(function (k) { return S.srs[k].i >= 21; }).length + '</b><span>已熟記</span></div>';
    v.appendChild(stats);

    if (!all) {
      v.appendChild(el("div", "empty", '<span class="gl">낱말</span><p>完成第一天的課程後，<br>單字會自動變成記憶卡。</p>'));
      return;
    }
    if (!due.length) {
      v.appendChild(el("div", "empty", '<span class="gl">쉼</span><p>今天的卡片都複習完了。</p><p style="font-size:13px">間隔重複會在最佳時機把單字再拿出來考你。</p>'));
      var mix = el("button", "btn quiet", "隨機複習 20 張");
      mix.onclick = function () { fc = { queue: shuffle(Object.keys(S.srs).map(function (k) { return S.srs[k]; })).slice(0, 20), i: 0, flipped: false, free: true }; drawCard(); };
      v.appendChild(mix);
      return;
    }

    var go = el("button", "btn", "開始複習 " + due.length + " 張");
    go.style.marginTop = "16px";
    go.onclick = function () { fc = { queue: due, i: 0, flipped: false }; drawCard(); };
    v.appendChild(go);
    v.appendChild(el("div", "tip", "點卡片翻面聽發音，再依照記得的程度評分。答錯的字會很快再出現，記熟的字間隔會越拉越長。"));
  }

  function drawCard() {
    var v = document.getElementById("v-cards");
    v.innerHTML = "";
    if (!fc || fc.i >= fc.queue.length) {
      v.innerHTML = "";
      var b = el("div", "done-banner");
      b.innerHTML = '<div class="seal">완료</div><h2>複習完成</h2><p>' + (fc ? fc.queue.length : 0) + " 張卡片已更新記憶排程。</p>";
      v.appendChild(b);
      var back = el("button", "btn", "回到卡片");
      back.onclick = function () { fc = null; renderCards(); };
      v.appendChild(back);
      fc = null;
      save();
      return;
    }
    var c = fc.queue[fc.i];

    var head = el("div", "qhead");
    var x = el("button", "iconbtn", "✕");
    x.onclick = function () { fc = null; renderCards(); };
    head.appendChild(x);
    var bar = el("div", "qbar", "<i></i>");
    bar.querySelector("i").style.width = (fc.i / fc.queue.length * 100) + "%";
    head.appendChild(bar);
    head.appendChild(el("div", "qcount", (fc.i + 1) + " / " + fc.queue.length));
    v.appendChild(head);

    var card = el("div", "fcard");
    card.style.marginTop = "16px";
    if (!fc.flipped) {
      card.innerHTML = '<div class="big">' + esc(c.ko) + '</div><div class="hint">點一下看意思</div>';
      card.onclick = function () { fc.flipped = true; speak(c.ko); drawCard(); };
      v.appendChild(card);
    } else {
      var crd = readingOf(c.ko);
      card.innerHTML = '<div class="big">' + esc(c.ko) + "</div>" +
        (crd ? '<div class="rd">[' + esc(crd) + "]</div>" : "") +
        '<div class="ro">' + esc(romanize(c.ko)) + "</div>" +
        '<div class="mid">' + esc(c.zh) + "</div>";
      card.onclick = function () { speak(c.ko); };
      v.appendChild(card);

      var grades = el("div", "grades");
      [["忘了", 0, "10 分"], ["有點難", 1, ""], ["記得", 2, ""], ["很簡單", 3, ""]].forEach(function (g) {
        var b = el("button", "grade g" + g[1]);
        b.innerHTML = "<b>" + g[0] + "</b><span>" + esc(g[2] || nextLabel(c, g[1])) + "</span>";
        b.onclick = function () { gradeCard(c, g[1]); };
        grades.appendChild(b);
      });
      v.appendChild(grades);
    }
  }

  function nextIvl(c, g) {
    if (g === 0) return 0;
    if (c.i === 0) return g === 1 ? 1 : g === 2 ? 2 : 4;
    if (g === 1) return Math.max(1, Math.round(c.i * 1.2));
    if (g === 2) return Math.max(1, Math.round(c.i * (c.e || 2.5)));
    return Math.max(1, Math.round(c.i * (c.e || 2.5) * 1.4));
  }
  function nextLabel(c, g) {
    var d = nextIvl(c, g);
    if (d === 0) return "10 分";
    if (d === 1) return "1 天";
    if (d < 30) return d + " 天";
    return Math.round(d / 30) + " 個月";
  }
  function gradeCard(c, g) {
    var d = nextIvl(c, g);
    c.e = Math.max(1.3, (c.e || 2.5) + (g === 0 ? -0.25 : g === 1 ? -0.1 : g === 3 ? 0.1 : 0));
    c.i = d;
    c.r = (c.r || 0) + 1;
    c.d = Date.now() + (d === 0 ? 10 * 60000 : d * 86400000);
    if (g === 0 && !fc.free) fc.queue.push(c);
    fc.i++;
    fc.flipped = false;
    save();
    drawCard();
  }

  /* ---------- PLAN ---------- */

  function renderPlan() {
    var v = document.getElementById("v-plan");
    v.innerHTML = "";
    PHASES.forEach(function (p) {
      var head = el("div", "sec");
      var h = el("div", "sec-h");
      h.appendChild(el("h2", "", "階段 " + p.n + " · " + p.zh));
      h.appendChild(el("div", "rule"));
      h.appendChild(el("div", "count", "第 " + p.from + "–" + p.to + " 週"));
      head.appendChild(h);

      var list = el("div", "wklist");
      for (var n = p.from; n <= p.to; n++) {
        (function (n) {
          var w = getWeek(n);
          if (!w) return;
          var box = el("div", "wk");
          var hb = el("button", "wk-h");
          var dots = "";
          for (var i = 1; i <= 7; i++) dots += '<i class="' + (S.done[(n - 1) * 7 + i] ? "on" : "") + '"></i>';
          hb.innerHTML = '<span class="num">W' + n + '</span><span class="tt"><b>' + esc(w.t) + "</b><span>" + esc(w.k) + '</span></span><span class="dots">' + dots + "</span>";
          hb.onclick = function () { box.classList.toggle("open"); };
          box.appendChild(hb);

          var days = el("div", "wk-days");
          for (var i2 = 1; i2 <= 7; i2++) {
            (function (dayNum, i2) {
              var dd = w.d[i2 - 1];
              if (!dd) return;
              var r = el("button", "dayrow");
              r.innerHTML = '<span class="dn">D' + dayNum + '</span><span class="dt">' + esc(dd.t || "") +
                (dd.k ? ' <span class="dk">' + esc(dd.k) + "</span>" : "") + "</span>" +
                '<span class="ck">' + (S.done[dayNum] ? "✓" : "") + "</span>";
              r.onclick = function () { S.day = dayNum; save(); setView("today"); };
              days.appendChild(r);
            })((n - 1) * 7 + i2, i2);
          }
          box.appendChild(days);
          if (n === weekOf(S.day)) box.classList.add("open");
          list.appendChild(box);
        })(n);
      }
      head.appendChild(list);
      v.appendChild(head);
    });
  }

  /* ---------- PROGRESS ---------- */

  function renderProgress() {
    var v = document.getElementById("v-progress");
    v.innerHTML = "";
    var doneCount = Object.keys(S.done).length;
    var words = Object.keys(S.srs).length;
    var acc = S.stats.total ? Math.round(S.stats.correct / S.stats.total * 100) : 0;

    var stats = el("div", "stats");
    stats.innerHTML =
      '<div class="stat"><b>' + S.streak.n + '</b><span>連續天數</span></div>' +
      '<div class="stat"><b>' + doneCount + '</b><span>完成天數</span></div>' +
      '<div class="stat"><b>' + words + '</b><span>學過的單字</span></div>';
    v.appendChild(stats);

    var c = el("div", "card");
    c.style.marginTop = "12px";
    c.innerHTML = '<div style="display:flex;justify-content:space-between;font-size:13px"><span>整體進度</span>' +
      '<span style="font-family:var(--font-mono)">' + doneCount + " / " + totalDays() + "</span></div>" +
      '<div class="pbar"><i style="width:' + (doneCount / totalDays() * 100) + '%"></i></div>' +
      '<div class="tip">答題正確率 ' + acc + "%（" + S.stats.correct + " / " + S.stats.total + " 題）</div>";
    v.appendChild(c);

    /* 원고지 sheet */
    var sheet = el("div", "wongo");
    for (var d = 1; d <= totalDays(); d++) {
      var cell = el("div", "wcell");
      if (S.done[d]) {
        cell.classList.add("done");
        var h = heroOf(d);
        cell.textContent = h.ko ? h.ko[0] : "";
      } else if (d === S.day) {
        cell.classList.add("now");
        cell.textContent = "今";
      }
      cell.title = "第 " + d + " 天";
      sheet.appendChild(cell);
    }
    var sw = el("div");
    sw.appendChild(sheet);
    sw.appendChild(el("div", "tip", "每格是一天，寫上那天的第一個字 — 像韓國學生用的原稿紙一樣，一格一字填滿一年。"));
    v.appendChild(section("一年原稿紙", sw));

    var pl = el("div", "card");
    PHASES.forEach(function (p) {
      var total = (p.to - p.from + 1) * 7, done = 0;
      for (var d2 = (p.from - 1) * 7 + 1; d2 <= p.to * 7; d2++) if (S.done[d2]) done++;
      var r = el("div", "phaserow");
      r.innerHTML = '<span class="pn">0' + p.n + '</span><span class="pt"><b>' + esc(p.zh) + "</b><span>" + esc(p.ko) +
        "　第 " + p.from + "–" + p.to + ' 週</span></span><span class="pv">' + done + "/" + total + "</span>";
      pl.appendChild(r);
    });
    v.appendChild(section("五個階段", pl));

    var goal = el("div", "grammar");
    goal.innerHTML = "<h3>一年後你會到哪裡</h3>" +
      "<p>照這份課表走完 52 週，你會累積約 <b>1,900 個常用單字</b>與 <b>TOPIK 2–3 級</b>的文法量。" +
      "那代表：能自我介紹與閒聊、點餐購物搭車看醫生、用 <code>-는데</code>／<code>-니까</code>／<code>-(으)면</code> 連起長句子、聽懂日常對話與韓劇裡的常用句、" +
      "也知道什麼時候該用敬語、什麼時候可以講반말。</p>" +
      "<p>關鍵不是一次學很多，而是<b>每天都出現</b>。連續比份量重要。</p>";
    v.appendChild(section("目標", goal));

    var rb = el("button", "btn quiet", "設定與資料");
    rb.style.marginTop = "18px";
    rb.onclick = openSettings;
    v.appendChild(rb);
  }

  /* ---------- SETTINGS ---------- */

  function openSettings() {
    var sh = document.getElementById("sheet");
    var in_ = sh.querySelector(".sheet-in");
    in_.innerHTML = "";
    in_.appendChild(el("h2", "", "設定"))
      .style.cssText = "margin:0 0 4px;font-size:18px";

    function row(title, sub, control) {
      var r = el("div", "setrow");
      r.innerHTML = '<span class="st"><b>' + esc(title) + "</b><span>" + esc(sub) + "</span></span>";
      r.appendChild(control);
      in_.appendChild(r);
    }

    var t1 = el("button", "toggle");
    t1.setAttribute("aria-checked", S.opt.ro ? "true" : "false");
    t1.onclick = function () {
      S.opt.ro = !S.opt.ro;
      t1.setAttribute("aria-checked", S.opt.ro ? "true" : "false");
      applyRoPref(); save();
    };
    row("顯示羅馬拼音", "熟悉字母後建議關掉，才不會依賴拼音", t1);

    var seg = el("div", "seg");
    [["慢", 0.7], ["正常", 0.85], ["原速", 1.0]].forEach(function (o) {
      var b = el("button", "", o[0]);
      b.setAttribute("aria-pressed", S.opt.rate === o[1] ? "true" : "false");
      b.onclick = function () {
        S.opt.rate = o[1]; save();
        seg.querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-pressed", "false"); });
        b.setAttribute("aria-pressed", "true");
        speak("안녕하세요");
      };
      seg.appendChild(b);
    });
    row("發音速度", "初學建議用「慢」", seg);

    var seg2 = el("div", "seg");
    [["自動", "auto"], ["淺色", "light"], ["深色", "dark"]].forEach(function (o) {
      var b = el("button", "", o[0]);
      b.setAttribute("aria-pressed", S.opt.theme === o[1] ? "true" : "false");
      b.onclick = function () {
        S.opt.theme = o[1]; save(); applyTheme();
        seg2.querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-pressed", "false"); });
        b.setAttribute("aria-pressed", "true");
      };
      seg2.appendChild(b);
    });
    row("外觀", "預設跟隨手機設定", seg2);

    var jump = el("input");
    jump.type = "number"; jump.min = 1; jump.max = totalDays(); jump.value = S.day;
    jump.style.cssText = "width:78px;padding:8px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--ink);font-family:var(--font-mono);text-align:center";
    jump.onchange = function () {
      var n = Math.min(totalDays(), Math.max(1, parseInt(jump.value, 10) || 1));
      S.day = n; save(); updateTop();
    };
    row("跳到第幾天", "1 – " + totalDays(), jump);

    var exp = el("button", "btn quiet", "匯出進度");
    exp.style.width = "auto";
    exp.onclick = function () {
      var txt = JSON.stringify(S);
      navigator.clipboard && navigator.clipboard.writeText(txt);
      exp.textContent = "已複製到剪貼簿";
      setTimeout(function () { exp.textContent = "匯出進度"; }, 1800);
    };
    row("備份", "複製進度 JSON，換手機時貼回來", exp);

    var imp = el("button", "btn quiet", "匯入");
    imp.style.width = "auto";
    imp.onclick = function () {
      var t = prompt("貼上先前匯出的進度 JSON：");
      if (!t) return;
      try {
        var o = JSON.parse(t);
        if (!o || typeof o !== "object" || !("day" in o)) throw 0;
        S = o; save(); closeSheet(); setView("today");
      } catch (e) { alert("這段內容看起來不是有效的進度備份。"); }
    };
    row("還原", "貼上備份 JSON 覆蓋目前進度", imp);

    var rst = el("button", "btn warn", "清除全部進度");
    rst.style.marginTop = "18px";
    rst.onclick = function () {
      if (!confirm("這會刪掉所有學習紀錄與記憶卡排程，確定嗎？")) return;
      S = fresh(); save(); closeSheet(); setView("today");
    };
    in_.appendChild(rst);

    var cls = el("button", "btn ghost", "關閉");
    cls.style.marginTop = "10px";
    cls.onclick = closeSheet;
    in_.appendChild(cls);

    sh.classList.add("on");
  }
  function closeSheet() { document.getElementById("sheet").classList.remove("on"); }

  function applyTheme() {
    if (S.opt.theme === "auto") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", S.opt.theme);
  }

  /* ---------- boot ---------- */

  function boot() {
    root = document.getElementById("app");
    document.querySelectorAll(".tabbar button").forEach(function (b) {
      b.onclick = function () { setView(b.dataset.tab); };
    });
    document.getElementById("bar-set").onclick = openSettings;
    document.getElementById("sheet").onclick = function (e) {
      if (e.target.id === "sheet") closeSheet();
    };
    applyTheme();
    applyRoPref();
    if (S.day > totalDays()) S.day = totalDays();
    setView("today");
  }

  window.KO = { romanize: romanize, pronounce: pronounce, readingOf: readingOf, speak: speak };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
