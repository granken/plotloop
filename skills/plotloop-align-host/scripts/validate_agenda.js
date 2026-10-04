#!/usr/bin/env node
'use strict';
// Validate a plotloop-align-host agenda.json before any narration/TTS work.
//   node scripts/validate_agenda.js agenda.json [--json]
// Exit 1 on errors; warnings never fail.
const fs = require('fs');

const FIVE = ['req', 'dev', 'risk', 'fix', 'decide'];
const MAX_FIELD = 60, MAX_TITLE = 12, MAX_LABEL = 8;

function validate(a) {
  const errors = [], warnings = [];
  const err = (m) => errors.push(m), warn = (m) => warnings.push(m);

  if (a.schema !== 'align-host.agenda.v1') warn(`schema 应为 align-host.agenda.v1，实际 ${a.schema}`);
  const m = a.meeting || {};
  if (!m.title) err('meeting.title 缺失');
  if (!(m.minutes > 0)) err('meeting.minutes 缺失或不是正数');
  if (!Array.isArray(m.rules) || !m.rules.length) err('meeting.rules 至少一条（写清哪些已定不再投票）');

  const sections = a.sections || [];
  if (!sections.length) err('sections 为空');
  const secIds = new Set();
  for (const s of sections) {
    if (!s.id || !s.label || !s.title) err(`section ${s.id || '?'}：id/label/title 必填`);
    if (secIds.has(s.id)) err(`section id 重复：${s.id}`);
    secIds.add(s.id);
    if (!(s.minutes > 0)) err(`section ${s.id}：minutes 必填`);
    if (s.label && [...s.label].length > MAX_LABEL) warn(`section ${s.id}：label 超过 ${MAX_LABEL} 字，进度条放不下`);
  }

  const items = a.items || [];
  if (!items.length) err('items 为空');
  const ids = new Set();
  const perSection = {};
  for (const it of items) {
    const tag = `item ${it.id || '?'}`;
    if (!it.id) { err(`${tag}：id 缺失`); continue; }
    if (ids.has(it.id)) err(`item id 重复：${it.id}`);
    ids.add(it.id);
    if (!secIds.has(it.section)) err(`${tag}：section ${it.section} 不存在`);
    if (!it.title) err(`${tag}：title 缺失`);
    else if ([...it.title].length > MAX_TITLE) warn(`${tag}：title 超过 ${MAX_TITLE} 字`);
    if (it.status === 'closed') continue;
    for (const f of FIVE) {
      if (!it[f]) err(`${tag}：五要素缺 ${f}`);
      else if ([...it[f]].length > MAX_FIELD) warn(`${tag}：${f} ${[...it[f]].length} 字，超过 ${MAX_FIELD}，单屏会挤`);
    }
    if (it.fix && /决定|已确定|必须/.test(it.fix)) warn(`${tag}：fix 读起来像决定（含“决定/已确定/必须”），它只能是建议`);
    (perSection[it.section] = perSection[it.section] || []).push(it);
  }

  const challenges = a.challenges || [];
  for (const g of challenges) {
    if (!g.id || !g.question) err(`challenge ${g.id || '?'}：id/question 必填`);
    if (ids.has(g.id)) err(`challenge id 与 item 重复：${g.id}`);
    if (g.attachTo && !ids.has(g.attachTo)) err(`challenge ${g.id}：attachTo ${g.attachTo} 不存在`);
  }

  // Time budget.
  const secSum = sections.reduce((n, s) => n + (s.minutes || 0), 0);
  if (m.minutes && secSum !== m.minutes) warn(`各节分钟合计 ${secSum}，与 meeting.minutes ${m.minutes} 不一致`);
  for (const s of sections) {
    const list = perSection[s.id] || [];
    if (!list.length) warn(`section ${s.id} 没有待议条目`);
    const itemSum = list.reduce((n, it) => n + (it.minutes || 0), 0);
    if (itemSum && itemSum > s.minutes) warn(`section ${s.id}：条目分钟合计 ${itemSum} 超过本节 ${s.minutes}`);
  }

  const open = items.filter((it) => it.status !== 'closed');
  const pauses = open.length + challenges.length;
  const stats = {
    sections: sections.length,
    items: items.length,
    open: open.length,
    closed: items.length - open.length,
    challenges: challenges.length,
    pauses,
    minutes: m.minutes || 0,
    // Calibrated on a real 20-item run (23 pauses → 11:42): ~120 chars per pause at ~6 chars/s,
    // ~4.5 s hold after each pause card, ~20 chars per section card, ~350 chars of open/close.
    estVideoMinutes: Number((((pauses * 120 + sections.length * 20 + 350) / 6 + pauses * 4.5) / 60).toFixed(1))
  };
  return { errors, warnings, stats };
}

if (require.main === module) {
  const file = process.argv[2];
  if (!file) { console.error('用法：node scripts/validate_agenda.js agenda.json [--json]'); process.exit(2); }
  let agenda;
  try { agenda = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { console.error(`读不了 ${file}：${e.message}`); process.exit(2); }
  const r = validate(agenda);
  if (process.argv.includes('--json')) console.log(JSON.stringify(r, null, 2));
  else {
    const s = r.stats;
    console.log(`节 ${s.sections} · 条目 ${s.items}（待议 ${s.open}，已关 ${s.closed}）· 挑战题 ${s.challenges} · 暂停点 ${s.pauses} · 会长 ${s.minutes} 分钟 · 视频约 ${s.estVideoMinutes} 分钟`);
    for (const e of r.errors) console.log(`  ✗ ${e}`);
    for (const w of r.warnings) console.log(`  ⚠ ${w}`);
    console.log(r.errors.length ? `${r.errors.length} 个错误，先修再往下走` : '通过');
  }
  process.exit(r.errors.length ? 1 : 0);
}

module.exports = { validate };
