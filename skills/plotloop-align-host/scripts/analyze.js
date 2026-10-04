#!/usr/bin/env node
'use strict';
// Measure each narration clip: duration, inter-sentence silences, and caption-unit cue times
// snapped to real pauses in the audio.
//   node scripts/analyze.js [--project DIR]  → DIR/script/timing.json
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const L = require('./lib');

const MAX_UNIT = 24;      // characters per caption line
const SNAP_WINDOW = 1.2;  // seconds a boundary may move to reach a real silence

function silences(file) {
  const r = spawnSync(L.tool('ffmpeg'), ['-hide_banner', '-i', file, '-af', 'silencedetect=noise=-38dB:d=0.12', '-f', 'null', '-'], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`silencedetect 失败：${file}\n${(r.stderr || '').slice(-400)}`);
  const out = [];
  let start = null;
  for (const line of r.stderr.split('\n')) {
    const s = line.match(/silence_start: ([\d.]+)/); if (s) start = Number(s[1]);
    const e = line.match(/silence_end: ([\d.]+)/); if (e && start != null) { out.push({ start, end: Number(e[1]) }); start = null; }
  }
  return out;
}

// Caption units: split at 。！？；：, then split units longer than MAX_UNIT at ，.
function units(text) {
  const base = (text.match(/[^。！？；：]+[。！？；：]?/g) || [text]).map((u) => u.trim()).filter(Boolean);
  const result = [];
  for (const u of base) {
    if ([...u].length <= MAX_UNIT) { result.push(u); continue; }
    let cur = '';
    for (const p of u.match(/[^，]+，?/g)) {
      if (cur && [...cur].length + [...p].length > MAX_UNIT) { result.push(cur); cur = p; } else cur += p;
    }
    if (cur) result.push(cur);
  }
  return result;
}

function analyzeOne(row, file) {
  const dur = L.audioDuration(file);
  const sil = silences(file);
  const speechStart = sil.length && sil[0].start < 0.05 ? sil[0].end : 0;
  const speechEnd = sil.length && sil[sil.length - 1].end > dur - 0.05 ? sil[sil.length - 1].start : dur;
  const inner = sil.filter((x) => x.start > speechStart + 0.05 && x.end < speechEnd - 0.05);
  const us = units(row.text);
  const weight = (u) => [...u.replace(/[，。！？；：、]/g, '')].length;
  const total = us.reduce((a, u) => a + weight(u), 0) || 1;
  const used = new Set();
  const bounds = [];
  let acc = 0;
  for (let i = 0; i < us.length - 1; i += 1) {
    acc += weight(us[i]);
    const expected = speechStart + (speechEnd - speechStart) * (acc / total);
    const prev = bounds.length ? bounds[bounds.length - 1].at : speechStart;
    let best = null;
    inner.forEach((x, k) => {
      const mid = (x.start + x.end) / 2;
      if (used.has(k) || mid <= prev || Math.abs(mid - expected) > SNAP_WINDOW) return;
      if (!best || Math.abs(mid - expected) < Math.abs(best.mid - expected)) best = { k, mid, x };
    });
    if (best) { used.add(best.k); bounds.push({ at: best.mid, end: best.x.start, next: best.x.end, snapped: true }); }
    else bounds.push({ at: expected, end: expected, next: expected, snapped: false });
  }
  const cues = us.map((u, i) => ({
    text: u.replace(/[，。；：]$/, ''),
    start: L.round(i === 0 ? speechStart : bounds[i - 1].next),
    end: L.round(i === us.length - 1 ? speechEnd : bounds[i].end)
  }));
  return { duration: L.round(dur), speechStart, speechEnd, snapped: bounds.filter((b) => b.snapped).length, boundaries: bounds.length, cues };
}

function main(argv) {
  const root = L.projectDir(argv);
  const rows = L.loadLines(root);
  const scenes = [];
  for (const row of rows) {
    const metaPath = path.join(root, 'script/tts', `${row.id}.meta.json`);
    if (!fs.existsSync(metaPath)) throw new Error(`${row.id} 还没配音：先跑 build.js tts`);
    const meta = L.readJSON(metaPath);
    if (meta.sha !== L.sha(row.text)) throw new Error(`${row.id} 的旁白改过但音频是旧的：重跑 build.js tts`);
    const file = path.join(root, meta.audio);
    scenes.push({ id: row.id, audio: meta.audio, ...analyzeOne(row, file) });
  }
  L.writeJSON(path.join(root, 'script/timing.json'), { scenes });
  let sum = 0;
  for (const s of scenes) { sum += s.duration; console.log(`${s.id.padEnd(10)} ${s.duration.toFixed(2)}s  字幕 ${s.cues.length} 段，卡上停顿 ${s.snapped}/${s.boundaries}`); }
  console.log(`旁白合计 ${sum.toFixed(1)}s，共 ${scenes.length} 段`);
}

if (require.main === module) {
  try { main(process.argv.slice(2)); } catch (e) { console.error(e.message); process.exit(1); }
}
module.exports = { main, units };
