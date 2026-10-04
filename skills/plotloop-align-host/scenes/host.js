/* plotloop-align-host scene renderer. Deterministic: pixels are a pure function of scene time t.
   Reads window.SEG (written by build.js scenes); exposes window.__QIAOCUT_SET_TIME__(ms) for qiaomu-cut.
   No meeting-specific text lives here — everything comes from agenda.json via SEG. */
(function () {
  const G = window.SEG, TL = G.timeline, M = G.meeting;
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const ease = (x) => 1 - Math.pow(1 - clamp(x), 3);
  const ramp = (t, at, d = 0.45) => ease((t - at) / d);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const mk = (cls, html, parent = document.body) => { const n = document.createElement('div'); if (cls) n.className = cls; if (html != null) n.innerHTML = html; parent.appendChild(n); return n; };
  const fade = (n, p, dy = 14) => { n.style.opacity = p; n.style.transform = `translateY(${(1 - p) * dy}px)`; };
  const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const anim = [];
  const phrase = (tpl, id) => esc(tpl).replace(/\{id\}/g, esc(id));
  const P = M.phrase || {};
  const DECIDED = P.decided || '「{id}，决定：……；理由：……；负责人：……；下一步证据：……」';
  const PENDING = P.pending || '「{id}，暂缓；在等：……」';

  mk('top', `<span><b>${esc(M.title)}</b>${M.version ? ` · ${esc(M.version)}` : ''}</span><span>${esc(G.brand)}</span>`);

  const center = (html, top) => { const c = mk('center', html); c.style.top = `${top}px`; anim.push([c, 0.05]); return c; };
  const list = (top, cls = 'list') => { const l = mk(cls); l.style.top = `${top}px`; return l; };

  if (G.kind === 'item') {
    const I = G.item, C = G.challenge;
    const refs = I.refs ? [I.refs.req, I.refs.dev].filter(Boolean).join(' · ') : '';  // refs 自带文档名，见 agenda-format.md
    anim.push([mk('ih', `<div class="sec">${esc(G.sectionInfo.title)}</div><div class="t"><span>${esc(I.id)}</span>${esc(I.title)}</div>
      <div class="chips">${I.nature ? `<span class="chip n">${esc(I.nature)}</span>` : ''}${C ? `<span class="chip g">挑战题 ${esc(C.id)}</span>` : ''}${G.minutes ? `<span class="chip m">建议讨论 ${G.minutes} 分钟</span>` : ''}${I.roles ? `<span class="chip">参与：${esc([].concat(I.roles).join(' / '))}</span>` : ''}${refs ? `<span class="chip">${esc(refs)}</span>` : ''}</div>`), 0.05]);
    const grid = mk('grid');
    [['req', '需求方怎么说', I.req], ['dev', '研发怎么理解', I.dev], ['risk', '风险', I.risk], ['fix', '最小对齐动作 · 建议，非共识', I.fix]]
      .forEach(([c, t, p], i) => anim.push([mk(`box ${c}`, `<h5>${t}</h5><p>${esc(p)}</p>`, grid), 0.25 + i * 0.25]));
    anim.push([mk('decide', `<b>本次要定</b>${esc(I.decide)}${I.verify ? `<br><b>验证证据</b>${esc(I.verify)}` : ''}`), 1.4]);
  } else if (G.kind === 'grill') {
    const C = G.challenge;
    anim.push([mk('ih', `<div class="sec">${esc(G.sectionInfo.title)} · 挑战题${C.attachTo ? ` · 结论归 ${esc(C.attachTo)}` : ''}</div><div class="t"><span>${esc(C.id)}</span>${esc(C.title || '挑战题')}</div>${G.minutes ? `<div class="chips"><span class="chip m">建议讨论 ${G.minutes} 分钟</span></div>` : ''}`), 0.05]);
    const grid = mk('grid one');
    anim.push([mk('box req', `<h5>挑战问题</h5><p class="big">${esc(C.question)}</p>`, grid), 0.3]);
    if (C.why) anim.push([mk('box risk', `<h5>为什么要问</h5><p class="big">${esc(C.why)}</p>`, grid), 0.7]);
  } else if (G.kind === 'section') {
    const n = G.sectionInfo;
    const total = G.sectionItems.reduce((a, x) => a + x.minutes, 0);
    center(`<div class="eyebrow">${esc(n.label)}</div><div class="h1">${esc(n.title)}</div><div class="sub">建议 ${n.minutes || total} 分钟 · ${G.sectionItems.length} 个暂停点</div>`, 150);
    const l = list(400);
    G.sectionItems.forEach((x, i) => anim.push([mk('li', `${esc(x.title)}<span>${x.minutes ? `${x.minutes} 分钟` : ''}</span>`, l), 0.5 + i * 0.18]));
  } else if (G.kind === 'delta') {
    const D = G.delta || {};
    center(`<div class="eyebrow">${esc(D.from || '上一版')} → ${esc(M.version || '本版')}</div><div class="h1">本轮变化</div>`, 110);
    const l = list(330); l.style.left = '200px'; l.style.right = '200px';
    const rows = [
      ...(D.closed || []).map((x) => ['✓ 关闭', `${x.id}：${x.reason || ''}`, 'var(--accent2)']),
      ...(D.added || []).map((x) => ['＋ 新增', `${x.id}：${x.note || x.reason || ''}`, 'var(--text)']),
      ...(D.changed || []).map((x) => ['↻ 改动', `${x.id}：${x.note || ''}`, '#a9c2ff']),
      ...(D.unchanged ? [['＝ 未变', D.unchanged, 'var(--warn)']] : [])
    ];
    rows.forEach(([k, v, c], i) => anim.push([mk('li row', `<span class="k" style="color:${c}">${k}</span><div>${esc(v)}</div>`, l), 0.6 + i * 1.6]));
  } else if (G.kind === 'phrase') {
    center(`<div class="h1">结论口令：说给录音听</div><div class="sub">会后 AI 按编号从录音转写里抽取决定，回填决策表</div>`, 130);
    const l = list(360);
    const id = (G.ids && G.ids[0]) || 'A01';
    [['已定', phrase(DECIDED, id)], ['未定', phrase(PENDING, id)], ['会后', '录音转文字 → AI 回填决策表并标出没说清的 → 人确认后再更新文档']]
      .forEach(([k, v], i) => anim.push([mk('li row', `<span class="k">${k}</span><div>${v}</div>`, l), 0.6 + i * 1.6]));
  } else if (G.kind === 'close') {
    center(`<div class="h1">会后闭环</div>`, 120);
    const l = list(290);
    [['1', '录音转文字，保留时间戳'],
     ['2', 'AI 按编号回填决策表，标出没说清、互相矛盾的，交人确认'],
     ['3', '只把已确认的写进需求文档和开发计划；没定的保留为阻塞项'],
     ['4', G.hasVerify ? '按验证证据逐条跑出真实结果，没跑的保持“未运行”' : '每条已定结论补一条验证证据，再逐条跑']]
      .forEach(([k, v], i) => anim.push([mk('li row', `<span class="k warn">${k}</span><div>${v}</div>`, l), 0.6 + i * 2.2]));
    anim.push([mk('sign', esc(G.brand)), 1.2]);
  } else {
    const S = M.stats;
    center(`<div class="eyebrow">会议主持视频 · 跟着进度讨论</div><div class="h1">${esc(M.title)}</div><div class="sub">${S.closed ? `${S.closed} 项已关闭 · ` : ''}${S.open} 项待议 · ${S.sections} 节 · ${S.pauses} 个暂停点${M.minutes ? ` · 建议 ${M.minutes} 分钟` : ''}</div>`, 130);
    const l = list(420);
    ['看到 ⏸ 暂停提示：暂停视频，讨论出结论再继续', ...(M.rules || [])].forEach((x, i) => anim.push([mk('li', esc(x), l), 1.2 + i * 0.5]));
  }

  // Pause overlay
  let dim = null, pause = null;
  if (G.pauseAt != null) {
    dim = mk('dim');
    pause = mk('pause', `<div class="k">⏸ 请暂停视频</div><div class="w">讨论：${esc(G.label)}</div><div class="m">${G.minutes ? `建议 ${G.minutes} 分钟 · ` : ''}讨论出结论后再继续播放</div>
      <div class="fmt"><b>已定：</b>${phrase(DECIDED, G.id)}<br><b>未定：</b>${phrase(PENDING, G.id)}</div>`);
  }

  // Progress bar
  const bar = mk('bar'); const BW = 1840;
  const x = (s) => (s / TL.total) * BW;
  const segs = TL.sections.map((s) => { const n = mk('seg', `<div class="fill"></div><div class="lb">${esc(s.label)}${s.minutes ? ` · ${s.minutes}′` : ''}</div>`, bar); n.style.left = `${x(s.start) + 2}px`; n.style.width = `${x(s.end) - x(s.start) - 4}px`; return n; });
  const ticks = TL.pauses.map((p) => { const n = mk('tick', '', bar); n.style.left = `${x(p.at) - 1}px`; return n; });
  const head = mk('head', '', bar); const now = mk('now', '', bar);
  const cap = mk('caption');

  // Spoken codes back to written ids: "A零七" → A07, "G二" → G2. Width follows the agenda's own ids.
  const DIG = '一二三四五六七八九';
  const cn = (s) => {
    if (/^零[一二三四五六七八九]$/.test(s)) return DIG.indexOf(s[1]) + 1;
    if (s === '十') return 10;
    let m = s.match(/^十([一二三四五六七八九])$/); if (m) return 10 + DIG.indexOf(m[1]) + 1;
    m = s.match(/^([一二三四五六七八九])十([一二三四五六七八九])?$/); if (m) return (DIG.indexOf(m[1]) + 1) * 10 + (m[2] ? DIG.indexOf(m[2]) + 1 : 0);
    if (/^[一二三四五六七八九]$/.test(s)) return DIG.indexOf(s) + 1;
    return null;
  };
  const known = new Set(G.ids || []);
  const toCode = (s) => s.replace(/([A-Z])([零一二三四五六七八九十]{1,3})/g, (all, L, n) => {
    const v = cn(n); if (v == null) return all;
    const padded = L + String(v).padStart(2, '0');
    return known.has(padded) ? padded : known.has(L + v) ? L + v : padded;
  });

  window.__QIAOCUT_SET_TIME__ = (ms) => {
    const t = ms / 1000, gt = G.start + t;
    anim.forEach(([n, at]) => fade(n, ramp(t, at, 0.5)));
    if (pause) { const p = ramp(t, G.pauseAt, 0.35); dim.style.opacity = p; pause.style.opacity = p; pause.style.transform = `translateX(-50%) scale(${0.96 + 0.04 * p})`; }
    TL.sections.forEach((s, i) => { const n = segs[i]; const on = gt >= s.start && gt < s.end; n.className = 'seg' + (on ? ' on' : gt >= s.end ? ' done' : ''); n.firstChild.style.width = `${clamp((gt - s.start) / (s.end - s.start)) * 100}%`; });
    ticks.forEach((n, i) => n.classList.toggle('past', gt >= TL.pauses[i].at));
    head.style.left = `${x(gt) - 1}px`;
    now.style.left = `${clamp(x(gt), 60, BW - 60)}px`; now.textContent = `${mmss(gt)} / ${mmss(TL.total)}`;
    let text = '';
    G.cues.forEach((c, i) => { const n = G.cues[i + 1]; const until = n ? Math.min(n.start - 0.05, c.end + 0.9) : c.end + 0.45; if (t >= c.start - 0.08 && t < until) text = c.text; });
    if (G.pauseAt != null && t >= G.pauseAt) text = '';
    cap.textContent = toCode(text);
  };
  window.__QIAOCUT_SET_TIME__(0);
})();
