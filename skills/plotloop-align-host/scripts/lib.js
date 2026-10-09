'use strict';
// Shared helpers for plotloop-align-host: project paths, tools, agenda + narration + timing loading,
// and the segment plan (one segment per lines.tsv row; hard cuts, so the burned-in progress bar
// maps 1:1 to video time).
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const SKILL = path.resolve(__dirname, '..');
const BRAND = 'plotloop · align-host';
const W = 1920, H = 1080, FPS = 10;
const LEAD = 0.5, PAUSE_HOLD = 4.5, TAIL = 0.6, SECTION_TAIL = 1.0, CLOSE_TAIL = 5;
const KINDS = ['open', 'phrase', 'delta', 'section', 'item', 'grill', 'close'];
const PAUSE_KINDS = new Set(['item', 'grill']);
const round = (x) => Number(x.toFixed(3));

function projectDir(argv) {
  const i = argv.indexOf('--project');
  return path.resolve(i >= 0 ? argv[i + 1] : process.cwd());
}

function flag(argv, name, fallback) {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : fallback;
}

// ffmpeg/ffprobe from $FFMPEG_DIR, else PATH. Never hardcode an install location.
function tool(name) {
  if (process.env.FFMPEG_DIR) return path.join(process.env.FFMPEG_DIR, name);
  const r = spawnSync('sh', ['-c', `command -v ${name}`], { encoding: 'utf8' });
  if (r.status !== 0 || !r.stdout.trim()) throw new Error(`找不到 ${name}：装好 ffmpeg，或设置 FFMPEG_DIR`);
  return r.stdout.trim();
}

// qiaomu-cut CLI from $QCUT, else the usual skill install locations.
function qcutPath() {
  const candidates = [
    process.env.QCUT,
    path.join(os.homedir(), '.claude/skills/qiaomu-cut/scripts/qcut.js'),
    path.join(os.homedir(), '.agents/skills/qiaomu-cut/scripts/qcut.js'),
    // plotloop-video-cut: plotloop's modified fork of qiaomu-cut (same CLI)
    path.join(os.homedir(), '.claude/skills/plotloop-video-cut/scripts/qcut.js'),
    path.join(os.homedir(), '.agents/skills/plotloop-video-cut/scripts/qcut.js')
  ].filter(Boolean);
  const hit = candidates.find((p) => fs.existsSync(p));
  if (!hit) throw new Error('找不到 qiaomu-cut：先安装 https://github.com/joeseesun/qiaomu-cut-skill，或设置 QCUT=/path/to/qcut.js');
  return hit;
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...opts });
  if (r.status !== 0) {
    const msg = (r.stderr || r.stdout || '').trim().split('\n').slice(-12).join('\n');
    throw new Error(`${path.basename(cmd)} ${args.slice(0, 3).join(' ')} 失败（exit ${r.status}）\n${msg}`);
  }
  return r.stdout;
}

// Audio length in seconds; throws on empty or unreadable files so NaN never reaches timing.json.
function audioDuration(file) {
  const out = run(tool('ffprobe'), ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).trim();
  const d = Number(out);
  if (!Number.isFinite(d) || d < 0.3) throw new Error(`音频无效（时长 ${out || '读不出'}）：${file}`);
  return d;
}

function qcut(args) {
  return run(process.execPath, [qcutPath(), ...args]);
}

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const readJSON = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const writeJSON = (p, v) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, `${JSON.stringify(v, null, 2)}\n`); };

function loadAgenda(root) {
  const p = path.join(root, 'agenda.json');
  if (!fs.existsSync(p)) throw new Error(`没有 ${p}：先写 agenda.json（见 references/agenda-format.md）`);
  return readJSON(p);
}

// lines.tsv: id<TAB>kind<TAB>section<TAB>minutes<TAB>text
function loadLines(root) {
  const p = path.join(root, 'script/lines.tsv');
  if (!fs.existsSync(p)) throw new Error(`没有 ${p}：先按 references/narration-guide.md 写旁白`);
  const rows = fs.readFileSync(p, 'utf8').split('\n').map((l) => l.replace(/\r$/, '')).filter((l) => l.trim() && !l.startsWith('#'));
  const seen = new Set();
  return rows.map((l, n) => {
    const [id, kind, section, minutes, ...rest] = l.split('\t');
    const text = rest.join('\t').trim();
    if (!id || !KINDS.includes(kind) || !text) throw new Error(`lines.tsv 第 ${n + 1} 行格式不对：需要 id、kind（${KINDS.join('/')}）、text`);
    if (seen.has(id)) throw new Error(`lines.tsv 里 id 重复：${id}`);
    seen.add(id);
    const sec = section || (kind === 'close' ? 'CLOSE' : ['open', 'phrase', 'delta'].includes(kind) ? 'OPEN' : '');
    return { id, kind, section: sec, minutes: Number(minutes) || 0, text };
  });
}

function loadTiming(root) {
  const p = path.join(root, 'script/timing.json');
  if (!fs.existsSync(p)) throw new Error('没有 script/timing.json：先跑 build.js analyze');
  return Object.fromEntries(readJSON(p).scenes.map((s) => [s.id, s]));
}

// All progress-bar sections: OPEN + agenda sections + CLOSE.
function barSections(agenda) {
  return [
    { id: 'OPEN', label: '开场', title: '开场与规则' },
    ...agenda.sections.map((s) => ({ id: s.id, label: s.label, title: s.title })),
    { id: 'CLOSE', label: '会后', title: '会后闭环' }
  ];
}

function lookup(agenda) {
  const items = Object.fromEntries((agenda.items || []).map((i) => [i.id, i]));
  const challenges = Object.fromEntries((agenda.challenges || []).map((g) => [g.id, g]));
  const challengeOf = {};
  for (const g of agenda.challenges || []) if (g.attachTo) challengeOf[g.attachTo] = g;
  return { items, challenges, challengeOf };
}

function label(row, agenda) {
  const { items, challenges } = lookup(agenda);
  if (row.kind === 'item' && items[row.id]) return `${row.id} ${items[row.id].title}`;
  if (row.kind === 'grill' && challenges[row.id]) return `${row.id} ${challenges[row.id].title || '挑战题'}`;
  if (row.kind === 'section') return (agenda.sections.find((s) => s.id === row.section) || {}).title || row.section;
  if (row.kind === 'delta') return `${agenda.meeting.version || '本轮'} 变化`;
  if (row.kind === 'phrase') return '结论口令';
  if (row.kind === 'close') return '会后闭环';
  return '开场与规则';
}

// Cross-check narration rows against the agenda before spending TTS money.
function checkLines(rows, agenda) {
  const { items, challenges } = lookup(agenda);
  const secIds = new Set(agenda.sections.map((s) => s.id));
  const problems = [];
  for (const r of rows) {
    if (r.kind === 'item' && !items[r.id]) problems.push(`${r.id}：kind=item 但 agenda 里没有这个条目`);
    if (r.kind === 'grill' && !challenges[r.id]) problems.push(`${r.id}：kind=grill 但 agenda 里没有这道挑战题`);
    if (['item', 'grill', 'section'].includes(r.kind) && !secIds.has(r.section)) problems.push(`${r.id}：section ${r.section} 不在 agenda.sections 里`);
  }
  const narrated = new Set(rows.map((r) => r.id));
  for (const it of agenda.items || []) if (it.status !== 'closed' && !narrated.has(it.id)) problems.push(`${it.id}：待议条目没有旁白`);
  for (const g of agenda.challenges || []) if (!narrated.has(g.id)) problems.push(`${g.id}：挑战题没有旁白`);
  return problems;
}

function plan(root) {
  const agenda = loadAgenda(root);
  const rows = loadLines(root);
  const timing = loadTiming(root);
  const { items, challenges } = lookup(agenda);
  let cursor = 0;
  const segs = rows.map((r) => {
    const tm = timing[r.id];
    if (!tm) throw new Error(`timing.json 里没有 ${r.id}：重跑 build.js tts 和 analyze`);
    const pause = PAUSE_KINDS.has(r.kind);
    const tail = r.kind === 'close' ? CLOSE_TAIL : r.kind === 'section' ? SECTION_TAIL : TAIL;
    const minutes = r.minutes || (r.kind === 'item' ? (items[r.id] || {}).minutes : r.kind === 'grill' ? (challenges[r.id] || {}).minutes : 0) || 0;
    const pauseAt = pause ? round(LEAD + tm.duration + 0.2) : null;
    const duration = round(LEAD + tm.duration + (pause ? PAUSE_HOLD : 0) + tail);
    const seg = {
      ...r, minutes, label: label(r, agenda), start: round(cursor), duration, pauseAt,
      audio: tm.audio, audioDuration: tm.duration,
      cues: tm.cues.map((q) => ({ text: q.text, start: round(LEAD + q.start), end: round(LEAD + q.end) }))
    };
    cursor += duration;
    return seg;
  });
  const total = round(cursor);
  const sections = barSections(agenda).map((s) => {
    const own = segs.filter((g) => g.section === s.id);
    if (!own.length) return null;
    const last = own[own.length - 1];
    const planned = (agenda.sections.find((x) => x.id === s.id) || {}).minutes;
    return { ...s, start: own[0].start, end: round(last.start + last.duration), minutes: planned || own.reduce((a, g) => a + (PAUSE_KINDS.has(g.kind) ? g.minutes : 0), 0) };
  }).filter(Boolean);
  const pauses = segs.filter((g) => g.pauseAt != null).map((g) => ({ id: g.id, at: round(g.start + g.pauseAt), minutes: g.minutes, title: g.label }));
  return { agenda, segs, total, sections, pauses };
}

module.exports = {
  SKILL, BRAND, W, H, FPS, LEAD, PAUSE_KINDS, KINDS, round,
  projectDir, flag, tool, qcutPath, run, audioDuration, qcut, sha, readJSON, writeJSON,
  loadAgenda, loadLines, loadTiming, barSections, lookup, label, checkLines, plan
};
