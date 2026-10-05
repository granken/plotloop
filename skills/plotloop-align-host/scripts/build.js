#!/usr/bin/env node
'use strict';
// plotloop-align-host build pipeline.
//   node scripts/build.js <step> [--project DIR] [options]
// Run steps in order; each writes files the next one reads, so a failed step is rerun alone.
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const L = require('./lib');

const STEPS = {
  init:     '建工程目录（qiaomu-cut scaffold）并放入 agenda.json：init --project DIR --agenda FILE',
  check:    '校验 agenda.json + 旁白与清单是否对得上（配音前必跑）',
  tts:      '逐行配音；文本没变的跳过。--tts volc|listenhub|file  [--voice 音色名]',
  analyze:  '测每段旁白的时长和句间停顿 → script/timing.json',
  scenes:   '生成每段的 HTML 场景 + 渲染清单（全量 / 草稿）；--4k 按 2 倍像素出 3840×2160，后续 timeline / final 自动跟随',
  layout:   '排版检查：每段每 0.5s 查溢出、出框、出安全区、压字幕、互相重叠、孤字折行 → reports/layout-check.json',
  still:    '导出一帧干净静帧（去字幕和进度条）：still <段id> [--at 秒] [--out 文件.png] [--4k]',
  draft:    '低帧率半分辨率渲染，每段抽 3 帧拼成 review/<id>.png',
  timeline: '旁白混音 + qiaomu-cut 时间轴 timeline.json',
  chapters: 'MP4 章节 + out/chapters.json（小节、暂停点）',
  final:    '后台全量渲染（独立进程），完成后写 out/.final.done；--foreground 前台跑',
  verify:   '核对成片：时长、旁白起点对齐、章节数',
  player:   '生成网页播放器 out/player.html',
  prompt:   '生成会后 AI 处理指令 out/post-meeting.md',
  all:      'check → tts → analyze → scenes → timeline → chapters → player → prompt（不含渲染）'
};

const OUT_VIDEO = 'out/align-host.mp4';

// ---------- init / check ----------

function init(root, argv) {
  const agendaSrc = L.flag(argv, '--agenda');
  if (!fs.existsSync(path.join(root, 'timeline.json')) && !fs.existsSync(path.join(root, 'qiaocut-ir.json'))) {
    L.qcut(['scaffold', root, '--brief', '对齐会主持视频（plotloop-align-host）', '--json']);
  }
  for (const d of ['script/tts', 'scenes/data', 'assets/scenes', 'out', 'review', 'reports']) fs.mkdirSync(path.join(root, d), { recursive: true });
  if (agendaSrc) fs.copyFileSync(path.resolve(agendaSrc), path.join(root, 'agenda.json'));
  console.log(`工程就绪：${root}\n下一步：写 script/lines.tsv（见 references/narration-guide.md），然后 build.js check`);
}

function check(root) {
  const { validate } = require('./validate_agenda');
  const agenda = L.loadAgenda(root);
  const r = validate(agenda);
  const rows = fs.existsSync(path.join(root, 'script/lines.tsv')) ? L.loadLines(root) : null;
  const problems = rows ? L.checkLines(rows, agenda) : ['还没有 script/lines.tsv'];
  for (const e of r.errors) console.log(`  ✗ ${e}`);
  for (const p of problems) console.log(`  ✗ ${p}`);
  for (const w of r.warnings) console.log(`  ⚠ ${w}`);
  if (rows) {
    const chars = rows.reduce((n, x) => n + [...x.text].length, 0);
    console.log(`旁白 ${rows.length} 段，${chars} 字，约 ${(chars / 6 / 60).toFixed(1)} 分钟语音（不含暂停停留）`);
  }
  const bad = r.errors.length + problems.length;
  if (bad) throw new Error(`${bad} 个问题，修好再配音`);
  console.log('通过');
}

// ---------- tts ----------

const TTS = {
  volc: { ingest: 'volcengine', args: (txt, root, voice) => ['tts', 'volc', '--text-file', txt, '--qcut-project', root, '--yes', '--json', ...(voice ? ['--voice-name', voice] : [])] },
  listenhub: { ingest: 'listenhub', args: (txt, root, voice) => ['listenhub', 'narration', '--text-file', txt, '--qcut-project', root, '--yes', '--json', ...(voice ? ['--voice-name', voice] : [])] }
};

function tts(root, argv) {
  const provider = L.flag(argv, '--tts', process.env.ALIGN_HOST_TTS || 'volc');
  const voice = L.flag(argv, '--voice', process.env.ALIGN_HOST_VOICE);
  if (provider !== 'file' && !TTS[provider]) throw new Error(`--tts 只支持 volc / listenhub / file，收到 ${provider}`);
  const rows = L.loadLines(root);
  let made = 0, kept = 0;
  for (const row of rows) {
    const metaPath = path.join(root, 'script/tts', `${row.id}.meta.json`);
    const want = L.sha(row.text);
    if (fs.existsSync(metaPath)) {
      const meta = L.readJSON(metaPath);
      if (meta.sha === want && fs.existsSync(path.join(root, meta.audio))) { kept += 1; continue; }
    }
    let audio;
    if (provider === 'file') {
      const hit = ['mp3', 'wav', 'm4a'].map((e) => `script/audio/${row.id}.${e}`).find((p) => fs.existsSync(path.join(root, p)));
      if (!hit) throw new Error(`--tts file：没找到 script/audio/${row.id}.mp3|wav|m4a`);
      audio = hit;
      L.audioDuration(path.join(root, audio));
    } else {
      const txt = `script/tts/${row.id}.txt`;
      fs.writeFileSync(path.join(root, txt), `${row.text}\n`);
      const res = JSON.parse(L.qcut(TTS[provider].args(txt, root, voice)));
      audio = res.localPath || (res.asset && res.asset.localPath);
      if (!audio) throw new Error(`${row.id}：配音返回里没有音频路径`);
      L.audioDuration(path.join(root, audio));
      L.writeJSON(path.join(root, 'script/tts', `${row.id}.json`), res);
    }
    L.writeJSON(metaPath, { sha: want, audio, provider: provider === 'file' ? 'local' : TTS[provider].ingest });
    made += 1;
    console.log(`  ✓ ${row.id}`);
  }
  console.log(`配音：新合成 ${made} 段，沿用 ${kept} 段`);
}

// ---------- scenes ----------

function scenes(root, argv = []) {
  const uhd = argv.includes('--4k');
  const P = L.plan(root);
  const { agenda, segs, total, sections, pauses } = P;
  const { items, challenges, challengeOf } = L.lookup(agenda);
  const ids = [...(agenda.items || []).map((i) => i.id), ...(agenda.challenges || []).map((g) => g.id)];
  const timeline = { total, sections, pauses };
  for (const f of ['host.js', 'style.css']) fs.copyFileSync(path.join(L.SKILL, 'scenes', f), path.join(root, 'scenes', f));
  fs.mkdirSync(path.join(root, 'scenes/data'), { recursive: true });
  const open = (agenda.items || []).filter((i) => i.status !== 'closed');
  const meeting = { ...agenda.meeting, stats: { open: open.length, closed: (agenda.items || []).length - open.length, sections: agenda.sections.length, pauses: pauses.length } };
  for (const g of segs) {
    const data = {
      ...g, brand: L.BRAND, meeting, ids, timeline,
      item: g.kind === 'item' ? items[g.id] : null,
      challenge: g.kind === 'grill' ? challenges[g.id] : g.kind === 'item' ? challengeOf[g.id] || null : null,
      sectionInfo: agenda.sections.find((s) => s.id === g.section) || null,
      sectionItems: g.kind === 'section' ? segs.filter((x) => x.section === g.section && L.PAUSE_KINDS.has(x.kind)).map((x) => ({ title: x.label, minutes: x.minutes })) : null,
      delta: g.kind === 'delta' ? agenda.delta || null : null,
      hasVerify: open.some((i) => i.verify)
    };
    fs.writeFileSync(path.join(root, 'scenes/data', `${g.id}.js`), `window.SEG=${JSON.stringify(data)};\n`);
    fs.writeFileSync(path.join(root, 'scenes', `${g.id}.html`), `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><link rel="stylesheet" href="style.css"></head><body>\n<script src="data/${g.id}.js"></script><script src="host.js"></script></body></html>\n`);
  }
  // 4K：同一套 1920 布局按 2 倍像素密度渲染（文字原生重绘，不是放大），场景另存 assets/scenes-4k
  const spec = (draft) => ({ scenes: segs.map((g) => ({
    source: `scenes/${g.id}.html`, engine: 'html', output: `assets/${draft ? 'draft' : uhd ? 'scenes-4k' : 'scenes'}/${g.id}.mp4`,
    width: L.W, height: L.H, fps: draft ? 2 : L.FPS, duration: g.duration, force: true, ...(draft ? { scale: 0.5 } : uhd ? { scale: 2 } : {})
  })) });
  L.writeJSON(path.join(root, 'build/output.json'), { uhd });
  L.writeJSON(path.join(root, 'scenes-batch.json'), spec(false));
  L.writeJSON(path.join(root, 'scenes-batch-draft.json'), spec(true));
  L.writeJSON(path.join(root, 'reports/agenda-plan.json'), timeline);
  const mm = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
  console.log(`场景 ${segs.length} 段，全片 ${mm(total)}，暂停点 ${pauses.length} 个${uhd ? '（4K）' : ''}`);
  for (const s of sections) console.log(`  ${s.label.padEnd(10)} ${mm(s.end - s.start)}`);
}

// ---------- draft ----------

function draft(root) {
  const { segs } = L.plan(root);
  if (!fs.existsSync(path.join(root, 'scenes-batch-draft.json'))) throw new Error('先跑 build.js scenes');
  L.qcut(['scene', 'batch', root, 'scenes-batch-draft.json', '--force', '--json']);
  const ff = L.tool('ffmpeg');
  fs.mkdirSync(path.join(root, 'review'), { recursive: true });
  const missing = [];
  for (const g of segs) {
    const src = path.join(root, 'assets/draft', `${g.id}.mp4`);
    // Draft fps rounds the clip length down, so sample against the real draft duration.
    const real = Number(L.run(L.tool('ffprobe'), ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', src]).trim());
    const last = Math.max(0, real - 0.6);
    const shots = (g.pauseAt != null
      ? [Math.min(2.5, g.pauseAt * 0.4), Math.max(0.5, g.pauseAt - 0.3), g.pauseAt + 0.8]
      : [Math.min(2.5, g.duration * 0.3), g.duration * 0.65, g.duration]).map((t) => Math.min(t, last));
    const out = path.join(root, 'review', `${g.id}.png`);
    if (fs.existsSync(out)) fs.unlinkSync(out);
    const args = ['-v', 'error', '-y'];
    shots.forEach((t) => args.push('-ss', t.toFixed(2), '-i', src));
    args.push('-filter_complex', `${shots.map((_, i) => `[${i}:v]scale=640:-2,setsar=1[f${i}]`).join(';')};${shots.map((_, i) => `[f${i}]`).join('')}hstack=inputs=${shots.length}`, '-frames:v', '1', '-update', '1', out);
    L.run(ff, args);
    // ffmpeg exits 0 even when no frame was decoded; check the file instead of trusting the exit code.
    if (!fs.existsSync(out) || fs.statSync(out).size === 0) missing.push(g.id);
  }
  if (missing.length) throw new Error(`${missing.length} 张审阅图没生成：${missing.join(', ')}`);
  console.log(`审阅图 ${segs.length} 张：${path.join(root, 'review')}（每张三帧：入场 / 内容齐 / 暂停卡或结尾）`);
}

// ---------- timeline / chapters ----------

function timelineStep(root) {
  const { agenda, segs, total } = L.plan(root);
  const ff = L.tool('ffmpeg');
  fs.mkdirSync(path.join(root, 'build'), { recursive: true });
  const mixed = path.join(root, 'build/narration-mix.wav');
  const args = ['-v', 'error', '-y'];
  segs.forEach((g) => args.push('-i', path.join(root, g.audio)));
  const f = segs.map((g, i) => `[${i}:a]aresample=48000,aformat=channel_layouts=mono,adelay=${Math.round((g.start + L.LEAD) * 1000)}:all=1[a${i}]`);
  f.push(`${segs.map((_, i) => `[a${i}]`).join('')}amix=inputs=${segs.length}:normalize=0:duration=longest,apad=whole_dur=${total}[o]`);
  args.push('-filter_complex', f.join(';'), '-map', '[o]', '-t', String(total), '-c:a', 'pcm_s16le', mixed);
  L.run(ff, args);
  const provider = L.readJSON(path.join(root, 'script/tts', `${segs[0].id}.meta.json`)).provider;
  const imp = JSON.parse(L.qcut(['ingest', root, mixed, '--kind', 'audio', '--provider', provider, '--json']));
  const asset = imp.asset || imp;
  const outFile = path.join(root, 'build/output.json');
  const uhd = fs.existsSync(outFile) && L.readJSON(outFile).uhd === true;
  // H.264 level 4.2 只到 1080p，4K 必须 5.1；码率顺带提高（CRF 14）
  const res = uhd ? { width: L.W * 2, height: L.H * 2, level: '5.1', crf: 14, intermediateCrf: 14 } : { width: L.W, height: L.H };
  const timeline = {
    schema: 'qiaocut.timeline.v1',
    title: `${agenda.meeting.title} ${agenda.meeting.version || ''}`.trim(),
    output: { ...res, fps: L.FPS, duration: total, loudnessLufs: -16, truePeakDb: -1.5, file: 'renders/final.mp4' },
    narration: { engine: 'file', path: imp.localPath || asset.localPath, provider, assetId: asset.id, start: 0, trim: 0, gain: 1 },
    music: false,
    shots: segs.map((g) => ({ id: g.id, kind: 'video', path: `assets/${uhd ? 'scenes-4k' : 'scenes'}/${g.id}.mp4`, duration: g.duration, fit: 'cover' }))
  };
  L.writeJSON(path.join(root, 'timeline.json'), timeline);
  L.writeJSON(path.join(root, 'reports/narration-placement.json'), { total, placements: segs.map((g) => ({ id: g.id, at: L.round(g.start + L.LEAD), duration: g.audioDuration })) });
  console.log(`时间轴 ${segs.length} 段，${total.toFixed(1)}s，${res.width}×${res.height}`);
}

function chapters(root) {
  const { agenda, segs, total, sections, pauses } = L.plan(root);
  const esc = (s) => s.replace(/[=;#\\\n]/g, ' ');
  let meta = `;FFMETADATA1\ntitle=${esc(agenda.meeting.title)}\n`;
  for (const g of segs) meta += `\n[CHAPTER]\nTIMEBASE=1/1000\nSTART=${Math.round(g.start * 1000)}\nEND=${Math.round((g.start + g.duration) * 1000)}\ntitle=${esc(g.label)}\n`;
  fs.mkdirSync(path.join(root, 'build'), { recursive: true });
  fs.writeFileSync(path.join(root, 'build/chapters.ffmeta'), meta);
  const player = {
    title: agenda.meeting.title, version: agenda.meeting.version || '', minutes: agenda.meeting.minutes,
    phrase: phrases(agenda), total, sections, pauses,
    segments: segs.map((g) => ({ id: g.id, kind: g.kind, section: g.section, start: g.start, end: L.round(g.start + g.duration), title: g.label, minutes: L.PAUSE_KINDS.has(g.kind) ? g.minutes : 0 }))
  };
  L.writeJSON(path.join(root, 'out/chapters.json'), player);
  console.log(`章节 ${segs.length} 个，暂停点 ${pauses.length} 个`);
}

function phrases(agenda) {
  const p = agenda.meeting.phrase || {};
  return {
    decided: p.decided || '「{id}，决定：……；理由：……；负责人：……；下一步证据：……」',
    pending: p.pending || '「{id}，暂缓；在等：……」'
  };
}

// ---------- final / verify ----------

function final(root, argv) {
  for (const f of ['scenes-batch.json', 'timeline.json', 'build/chapters.ffmeta']) {
    if (!fs.existsSync(path.join(root, f))) throw new Error(`缺 ${f}：先跑 scenes / timeline / chapters`);
  }
  const done = path.join(root, 'out/.final.done');
  if (fs.existsSync(done)) fs.unlinkSync(done);
  if (argv.includes('--foreground')) return finalWorker(root);
  const log = path.join(root, 'out/final.log');
  const fd = fs.openSync(log, 'w');
  const child = spawn(process.execPath, [__filename, '_final', '--project', root], { detached: true, stdio: ['ignore', fd, fd] });
  child.unref();
  fs.writeFileSync(path.join(root, 'out/.final.pid'), String(child.pid));
  console.log(`后台渲染已启动（pid ${child.pid}）。日志：${log}\n完成标记：${done}（内容 ok:true 即成功）`);
}

function finalWorker(root) {
  const done = path.join(root, 'out/.final.done');
  const stamp = (m) => console.log(`[${new Date().toISOString()}] ${m}`);
  try {
    stamp('渲染全部场景');
    L.qcut(['scene', 'batch', root, 'scenes-batch.json', '--force', '--json']);
    stamp('合成成片');
    L.qcut(['render', root, '--profile', 'final', '--force', '--json']);
    stamp('写入章节');
    L.run(L.tool('ffmpeg'), ['-v', 'error', '-y', '-i', path.join(root, 'renders/final.mp4'), '-i', path.join(root, 'build/chapters.ffmeta'),
      '-map', '0', '-map_metadata', '1', '-map_chapters', '1', '-c', 'copy', '-movflags', '+faststart', path.join(root, OUT_VIDEO)]);
    L.writeJSON(done, { ok: true, video: OUT_VIDEO, at: new Date().toISOString() });
    stamp(`完成：${OUT_VIDEO}`);
  } catch (e) {
    L.writeJSON(done, { ok: false, error: e.message, at: new Date().toISOString() });
    stamp(`失败：${e.message}`);
    process.exitCode = 1;
  }
}

function verify(root) {
  const { segs, total } = L.plan(root);
  const timing = L.loadTiming(root);
  const video = path.join(root, OUT_VIDEO);
  if (!fs.existsSync(video)) throw new Error(`没有 ${OUT_VIDEO}：先跑 final`);
  const probe = JSON.parse(L.run(L.tool('ffprobe'), ['-v', 'error', '-show_entries', 'format=duration', '-show_chapters', '-of', 'json', video]));
  const dur = Number(probe.format.duration);
  const { spawnSync } = require('child_process');
  const r = spawnSync(L.tool('ffmpeg'), ['-hide_banner', '-i', video, '-af', 'silencedetect=noise=-35dB:d=0.25', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const ends = [...(r.stderr || '').matchAll(/silence_end: ([\d.]+)/g)].map((m) => Number(m[1]));
  const drifts = segs.map((g) => {
    const expect = g.start + L.LEAD + timing[g.id].speechStart;
    const near = ends.reduce((b, e) => (Math.abs(e - expect) < Math.abs(b - expect) ? e : b), Infinity);
    return { id: g.id, drift: Math.abs(near - expect) };
  });
  const worst = drifts.reduce((a, b) => (b.drift > a.drift ? b : a));
  const missing = drifts.filter((d) => d.drift > 0.5);
  const lines = [
    `时长 ${dur.toFixed(2)}s（计划 ${total.toFixed(2)}s，差 ${(dur - total).toFixed(2)}s）`,
    `章节 ${probe.chapters.length} 个（计划 ${segs.length}）`,
    `旁白起点最大偏差 ${(worst.drift * 1000).toFixed(0)}ms（${worst.id}）`,
    missing.length ? `⚠ ${missing.length} 段起点偏差超过 500ms：${missing.map((d) => d.id).join(', ')}` : '各段旁白起点都对上了'
  ];
  lines.forEach((l) => console.log(l));
  const ok = Math.abs(dur - total) < 0.5 && probe.chapters.length === segs.length && !missing.length;
  L.writeJSON(path.join(root, 'reports/verify.json'), { ok, duration: dur, planned: total, chapters: probe.chapters.length, worstDriftMs: Math.round(worst.drift * 1000), missing: missing.map((d) => d.id) });
  if (!ok) throw new Error('核对没通过，见上');
}

// ---------- player / prompt ----------

function player(root) {
  const chPath = path.join(root, 'out/chapters.json');
  if (!fs.existsSync(chPath)) throw new Error('先跑 build.js chapters');
  const ch = L.readJSON(chPath);
  const html = fs.readFileSync(path.join(L.SKILL, 'templates/player.html'), 'utf8')
    .replace('/*__CHAPTERS__*/null', JSON.stringify(ch))
    .replace(/__VIDEO__/g, path.basename(OUT_VIDEO))
    .replace(/__TITLE__/g, `${ch.title}${ch.version ? ' ' + ch.version : ''}`)
    .replace(/__BRAND__/g, L.BRAND);
  fs.writeFileSync(path.join(root, 'out/player.html'), html);
  console.log(`播放器：out/player.html（和 ${path.basename(OUT_VIDEO)} 放在同一个文件夹里打开）`);
}

const span = (xs) => (!xs.length ? '' : xs.length === 1 ? xs[0] : `${xs[0]}—${xs[xs.length - 1]}`);

function prompt(root) {
  const { agenda, pauses } = L.plan(root);
  const m = agenda.meeting;
  const open = (agenda.items || []).filter((i) => i.status !== 'closed');
  const ids = open.map((i) => i.id);
  const gs = agenda.challenges || [];
  const ph = phrases(agenda);
  const mapping = gs.filter((g) => g.attachTo).map((g) => `${g.id} 的结论归到 ${g.attachTo}`).join('；');
  const verifyItems = open.filter((i) => i.verify);
  const verifySection = verifyItems.length
    ? `按下面的验证项逐条跑出真实结果，填上平台和版本、操作、实际结果、证据、结论：\n\n${verifyItems.map((i) => `- **${i.id} ${i.title}**：${i.verify}`).join('\n')}`
    : '本次清单没有写验证项。已定的条目，各自补一条"用什么证据证明做到了"，再逐条跑。';
  const vars = {
    'meeting.title': m.title, 'meeting.version': m.version || '',
    openCount: String(open.length), pauseCount: String(pauses.length),
    'phrase.decided': ph.decided.replace(/\{id\}/g, ids[0] || 'A01'), 'phrase.pending': ph.pending.replace(/\{id\}/g, ids[0] || 'A01'),
    glossary: (m.glossary || [...ids, ...gs.map((g) => g.id)]).join(' '),
    idRange: [span(ids), span(gs.map((g) => g.id))].filter(Boolean).join('、'),
    challengeMapping: mapping ? `${mapping}。` : '',
    verifySection
  };
  const tpl = fs.readFileSync(path.join(L.SKILL, 'references/post-meeting-prompt.md'), 'utf8').split('\n---\n').slice(1).join('\n---\n').trim();
  const out = tpl.replace(/\{\{([\w.]+)\}\}/g, (_, k) => (k in vars ? vars[k] : `{{${k}}}`));
  const left = out.match(/\{\{[\w.]+\}\}/g);
  if (left) throw new Error(`会后指令模板里有没填上的变量：${[...new Set(left)].join(' ')}`);
  fs.mkdirSync(path.join(root, 'out'), { recursive: true });
  fs.writeFileSync(path.join(root, 'out/post-meeting.md'), `${out}\n`);
  console.log('会后 AI 处理指令：out/post-meeting.md');
}

// ---------- main ----------

function main(argv) {
  const step = argv[0];
  const root = L.projectDir(argv);
  const map = {
    init: () => init(root, argv), check: () => check(root), tts: () => tts(root, argv),
    analyze: () => require('./analyze').main(argv), scenes: () => scenes(root, argv), draft: () => draft(root),
    layout: () => require('./inspect').layout(root, argv), still: () => require('./inspect').still(root, argv),
    timeline: () => timelineStep(root), chapters: () => chapters(root), final: () => final(root, argv),
    _final: () => finalWorker(root), verify: () => verify(root), player: () => player(root), prompt: () => prompt(root),
    all: () => { check(root); tts(root, argv); require('./analyze').main(argv); scenes(root, argv); timelineStep(root); chapters(root); player(root); prompt(root); }
  };
  if (!map[step]) {
    console.log('用法：node scripts/build.js <step> [--project DIR]\n');
    for (const [k, v] of Object.entries(STEPS)) console.log(`  ${k.padEnd(9)} ${v}`);
    process.exit(step ? 2 : 0);
  }
  return map[step]();
}

if (require.main === module) {
  const fail = (e) => { console.error(`✗ ${e.message}`); process.exit(1); };
  try { Promise.resolve(main(process.argv.slice(2))).catch(fail); } catch (e) { fail(e); }
}
