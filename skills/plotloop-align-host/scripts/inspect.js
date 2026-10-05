'use strict';
// Browser-side checks on the generated HTML scenes (no rendering needed):
//   layout — step through every scene every 0.5s and flag text overflow, boxes leaking out of their
//            card, text outside the safe area, text under the caption, overlapping blocks, orphan line wraps.
//   still  — export one scene at a given second as a clean PNG (caption and progress bar hidden).
// Uses the playwright-core and Chromium that qiaomu-cut installs (`qcut setup --only browser`).
const fs = require('fs');
const path = require('path');
const L = require('./lib');

const STEP = 0.5;
// Class names come from scenes/host.js + style.css.
const SEL = {
  caption: '.caption',
  bottom: '.bar',
  cards: '.box, .decide, .li, .pause',
  overlays: '.pause, .dim',      // intentionally drawn on top of the content
  ignore: '.bar, .caption, .dim'
};

function browserRuntime() {
  const deps = path.resolve(path.dirname(L.qcutPath()), '..', '.deps', 'node_modules', 'playwright-core');
  let pw = null;
  for (const c of [process.env.QIAOMU_PLAYWRIGHT_CORE, deps, 'playwright-core'].filter(Boolean)) {
    try { pw = require(c); break; } catch (_) { /* next */ }
  }
  if (!pw || !pw.chromium) throw new Error('找不到 playwright-core：先跑 qcut setup --only browser');
  let bundled = null;
  try { bundled = pw.chromium.executablePath(); } catch (_) { /* not installed */ }
  const exe = [process.env.QIAOMU_CHROME, bundled,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium']
    .filter(Boolean).find((p) => fs.existsSync(p));
  if (!exe) throw new Error('找不到 Chromium：先跑 qcut setup --only browser，或设置 QIAOMU_CHROME');
  return { chromium: pw.chromium, exe };
}

async function openPage(scale = 1) {
  const { chromium, exe } = browserRuntime();
  const browser = await chromium.launch({ executablePath: exe, headless: true });
  const page = await browser.newPage({ viewport: { width: L.W, height: L.H }, deviceScaleFactor: scale });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return { browser, page, errors };
}

async function gotoScene(page, root, id) {
  const file = path.join(root, 'scenes', `${id}.html`);
  if (!fs.existsSync(file)) throw new Error(`没有场景 ${id}：先跑 build.js scenes`);
  await page.goto(`file://${file}`);
  await page.waitForFunction(() => typeof window.__QIAOCUT_SET_TIME__ === 'function');
}

// Runs inside the page.
function pageCheck(arg) {
  const { SEL, W, H } = arg;
  const SAFE = 48;
  const issues = [];
  const visible = (n) => {
    for (let e = n; e && e !== document.body; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) < 0.05) return false;
    }
    return true;
  };
  const label = (n) => {
    const cls = typeof n.className === 'string' && n.className ? `.${n.className.trim().split(/\s+/).join('.')}` : '';
    const txt = (n.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 24);
    return `${n.tagName.toLowerCase()}${cls}${txt ? ` 「${txt}」` : ''}`;
  };
  const textRects = (n) => {
    const out = [];
    for (const c of n.childNodes) {
      if (c.nodeType !== 3 || !c.textContent.trim()) continue;
      for (let i = 0; i < c.textContent.length; i += 1) {
        if (!c.textContent[i].trim()) continue;
        const rg = document.createRange(); rg.setStart(c, i); rg.setEnd(c, i + 1);
        const b = rg.getBoundingClientRect(); if (b.width) out.push(b);
      }
    }
    return out;
  };
  const cap = document.querySelector(SEL.caption);
  const bar = document.querySelector(SEL.bottom);
  const capR = cap && cap.textContent.trim() && visible(cap) ? cap.getBoundingClientRect() : null;
  const bottomLimit = bar && visible(bar) ? bar.getBoundingClientRect().top : H;
  const paused = [...document.querySelectorAll(SEL.overlays)].some((o) => visible(o) && Number(getComputedStyle(o).opacity) > 0.5);
  const all = [...document.body.querySelectorAll('*')].filter((n) => !['SCRIPT', 'STYLE', 'LINK', 'BR'].includes(n.tagName) && visible(n));
  for (const n of all) {
    const r = n.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    const inBar = n.closest(SEL.bottom);
    const hasText = [...n.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim());
    if (hasText && !inBar) {
      if (n.clientWidth > 0 && n.scrollWidth > n.clientWidth + 1) issues.push({ type: 'overflow-x', el: label(n), px: n.scrollWidth - n.clientWidth });
      if (n.clientHeight > 0 && n.scrollHeight > n.clientHeight + 1) issues.push({ type: 'overflow-y', el: label(n), px: n.scrollHeight - n.clientHeight });
    }
    const card = n.parentElement && n.parentElement.closest(SEL.cards);
    if (card && !inBar) {
      const c = card.getBoundingClientRect();
      const out = Math.max(c.left - r.left, r.right - c.right, c.top - r.top, r.bottom - c.bottom);
      if (out > 1) issues.push({ type: 'outside-card', el: label(n), card: label(card), px: Math.round(out) });
    }
    if (hasText && !inBar && n !== cap) {
      const tr = textRects(n);
      const box = tr.length ? { left: Math.min(...tr.map((x) => x.left)), right: Math.max(...tr.map((x) => x.right)), top: Math.min(...tr.map((x) => x.top)), bottom: Math.max(...tr.map((x) => x.bottom)) } : r;
      const out = Math.max(SAFE - box.left, box.right - (W - SAFE), SAFE * 0.5 - box.top, box.bottom - bottomLimit);
      if (out > 1) issues.push({ type: 'outside-safe', el: label(n), px: Math.round(out) });
    }
    if (capR && hasText && !cap.contains(n) && !inBar && !(paused && n.closest(SEL.overlays))) {
      const ix = Math.min(r.right, capR.right) - Math.max(r.left, capR.left);
      const iy = Math.min(r.bottom, capR.bottom) - Math.max(r.top, capR.top);
      if (ix > 1 && iy > 1) issues.push({ type: 'under-caption', el: label(n), px: Math.round(Math.min(ix, iy)) });
    }
    if (hasText && n.children.length === 0 && !inBar && n !== cap) {
      const rects = textRects(n);
      const tops = [...new Set(rects.map((x) => Math.round(x.top)))];
      if (tops.length >= 2) {
        const lastTop = Math.max(...tops);
        const last = rects.filter((x) => Math.round(x.top) === lastTop).reduce((a, x) => a + x.width, 0);
        if (last > 0 && last < parseFloat(getComputedStyle(n).fontSize) * 2.6) issues.push({ type: 'orphan-wrap', el: label(n), px: Math.round(last) });
      }
    }
  }
  // Top-level blocks must not overlap each other (overlays are meant to sit on top).
  const blocks = [...document.body.children].filter((n) => !['SCRIPT', 'STYLE', 'LINK'].includes(n.tagName) && visible(n) && !n.matches(SEL.ignore) && !n.matches(SEL.overlays));
  for (let i = 0; i < blocks.length; i += 1) for (let j = i + 1; j < blocks.length; j += 1) {
    const a = blocks[i].getBoundingClientRect(), b = blocks[j].getBoundingClientRect();
    const ix = Math.min(a.right, b.right) - Math.max(a.left, b.left);
    const iy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    if (ix > 1 && iy > 1) issues.push({ type: 'blocks-overlap', el: label(blocks[i]), other: label(blocks[j]), px: Math.round(Math.min(ix, iy)) });
  }
  return issues;
}

function sceneList(root, only) {
  const spec = path.join(root, 'scenes-batch.json');
  if (!fs.existsSync(spec)) throw new Error('先跑 build.js scenes');
  const scenes = L.readJSON(spec).scenes.map((s) => ({ id: path.basename(s.source, '.html'), duration: s.duration }));
  return only.length ? scenes.filter((s) => only.includes(s.id)) : scenes;
}

async function layout(root, argv) {
  const only = argv.slice(1).filter((a) => !a.startsWith('--') && a !== L.flag(argv, '--project'));
  const { browser, page, errors } = await openPage();
  const report = [];
  try {
    for (const { id, duration } of sceneList(root, only)) {
      await gotoScene(page, root, id);
      const seen = new Map();
      for (let t = 0; t <= duration + 1e-6; t += STEP) {
        await page.evaluate(async (ms) => { await window.__QIAOCUT_SET_TIME__(ms); }, Math.round(t * 1000));
        for (const it of await page.evaluate(pageCheck, { SEL, W: L.W, H: L.H })) {
          const key = `${it.type}|${it.el}|${it.other || ''}`;
          const prev = seen.get(key);
          if (!prev) seen.set(key, { scene: id, ...it, first: Number(t.toFixed(1)), last: Number(t.toFixed(1)), maxPx: it.px });
          else { prev.last = Number(t.toFixed(1)); prev.maxPx = Math.max(prev.maxPx, it.px); }
        }
      }
      report.push(...seen.values());
    }
  } finally { await browser.close(); }
  if (errors.length) throw new Error(`场景脚本报错：${[...new Set(errors)].join('; ')}`);
  L.writeJSON(path.join(root, 'reports/layout-check.json'), { issues: report.length, items: report });
  for (const r of report) console.log(`${r.scene.padEnd(8)} ${String(r.first).padStart(5)}–${String(r.last).padEnd(5)} ${r.type.padEnd(14)} ${r.maxPx}px  ${r.el}${r.other ? `  ↔ ${r.other}` : ''}${r.card ? `  in ${r.card}` : ''}`);
  console.log(`排版检查：${report.length} 个问题（reports/layout-check.json）`);
  if (report.length) process.exitCode = 1;
}

async function still(root, argv) {
  const id = argv[1] && !argv[1].startsWith('--') ? argv[1] : null;
  if (!id) throw new Error('用法：build.js still <场景id> [--at 秒] [--out 文件.png] [--4k] [--project DIR]');
  const scene = sceneList(root, [id])[0];
  if (!scene) throw new Error(`没有场景 ${id}`);
  const at = L.flag(argv, '--at') != null ? Number(L.flag(argv, '--at')) : scene.duration - 0.3;
  const out = path.resolve(root, L.flag(argv, '--out') || `out/still-${id}.png`);
  const { browser, page, errors } = await openPage(argv.includes('--4k') ? 2 : 1);
  try {
    await gotoScene(page, root, id);
    await page.evaluate(async ({ ms, hide }) => {
      await window.__QIAOCUT_SET_TIME__(ms);
      document.querySelectorAll(hide).forEach((n) => { n.style.display = 'none'; });
    }, { ms: Math.round(at * 1000), hide: `${SEL.caption}, ${SEL.bottom}` });
    fs.mkdirSync(path.dirname(out), { recursive: true });
    await page.screenshot({ path: out });
  } finally { await browser.close(); }
  if (errors.length) throw new Error(`场景脚本报错：${[...new Set(errors)].join('; ')}`);
  console.log(`静帧：${path.relative(root, out)}（${id} @ ${at.toFixed(1)}s）`);
}

module.exports = { layout, still, browserRuntime };
