// 舞台で探す（stage.html）
// 舞台に置いた楽器と人数で曲を絞り込み、年代でさらに絞る。
// URL：stage.html?inst=koto:2,shakuhachi:1&cmp=gte&mode=exact&from=1980&to=2000
(function () {
  'use strict';

  const MAX_PARTS = 99;
  const PAGE = 20;
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const $ = (id) => document.getElementById(id);
  const els = {
    stage: $('stage'),
    stageEmpty: $('stage-empty'),
    stageClear: $('stage-clear'),
    palette: $('palette'),
    decades: $('decades'),
    yearsText: $('years-text'),
    yearsClear: $('years-clear'),
    count: $('stage-count'),
    list: $('stage-list'),
    more: $('stage-more'),
    openSearch: $('open-search'),
  };

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function svg(tag, attrs, text) {
    const node = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs || {}).forEach(([k, v]) => node.setAttribute(k, v));
    if (text !== undefined) node.textContent = text;
    return node;
  }

  let INSTRUMENTS = {};
  let pieces = [];
  const placed = new Map(); // 楽器キー → 人数（置いた順）
  let from = null; // 年代の範囲（1980 のような10年単位。null は指定なし）
  let to = null;
  let results = [];
  let shown = 0;
  const collator = new Intl.Collator('ja');
  const form = () => ({
    mode: document.querySelector('input[name="mode"]:checked').value,
    cmp: document.querySelector('input[name="cmp"]:checked').value,
  });
  const family = (key) => (INSTRUMENTS[key] ? INSTRUMENTS[key].family : 'other');
  const decadeOf = (year) => Math.floor(year / 10) * 10;

  // ---- 舞台（置いた楽器の奏者を半円に並べる） ----
  // 奏者が多いときは、前の列から順に何列かに分けて並べる
  function seatPositions(n) {
    const rows = [];
    let rest = n;
    for (const cap of [7, 9, 11, 13]) {
      if (rest <= 0) break;
      rows.push(Math.min(cap, rest));
      rest -= cap;
    }
    if (rest > 0) rows[rows.length - 1] += rest;
    const out = [];
    rows.forEach((count, r) => {
      const radius = 150 + r * 52;
      for (let i = 0; i < count; i++) {
        const t = count === 1 ? 0.5 : i / (count - 1);
        const a = Math.PI * (0.16 + 0.68 * t);
        out.push({ x: 320 - Math.cos(a) * radius * 1.35, y: 214 - Math.sin(a) * radius * 0.8 - r * 4 });
      }
    });
    return out;
  }

  function renderStage() {
    const seats = [];
    placed.forEach((count, key) => {
      for (let i = 0; i < count; i++) seats.push({ key, first: i === 0, count });
    });
    const pos = seatPositions(seats.length);
    // スマホでは舞台が小さく表示されるので、奏者の丸と文字を大きくする
    const narrow = els.stage.clientWidth > 0 && els.stage.clientWidth < 500;
    els.stage.classList.toggle('is-narrow', narrow);
    const r = (seats.length > 16 ? 15 : 20) * (narrow ? 1.5 : 1);
    els.stage.replaceChildren(
      svg('line', { x1: 40, y1: 236, x2: 600, y2: 236, class: 'stage-floor' }),
      svg('text', { x: 320, y: 254, 'text-anchor': 'middle', class: 'stage-audience' }, '客席'),
    );
    seats.forEach((seat, i) => {
      const inst = INSTRUMENTS[seat.key];
      const { x, y } = pos[i];
      const g = svg('g', { class: `seat fam-${family(seat.key)}`, tabindex: 0, role: 'button', 'data-key': seat.key, 'aria-label': `${inst.label}を1人下げる` });
      g.append(
        svg('circle', { cx: x.toFixed(1), cy: y.toFixed(1), r }),
        svg('text', { x: x.toFixed(1), y: (y + r * 0.3).toFixed(1), 'text-anchor': 'middle', class: 'seat-char' }, inst.label[0]),
      );
      if (seat.first) {
        g.appendChild(svg('text', { x: x.toFixed(1), y: (y + r * 1.75).toFixed(1), 'text-anchor': 'middle', class: 'seat-label' },
          seat.count > 1 ? `${inst.label} ×${seat.count}` : inst.label));
      }
      els.stage.appendChild(g);
    });
    els.stageEmpty.hidden = seats.length > 0;
    els.stageClear.hidden = seats.length === 0;
  }

  // ---- 楽器のパレット（使われている楽器だけ、ジャンルごと。検索ページと同じく折りたためる） ----
  function buildPalette() {
    const used = new Map();
    pieces.forEach((p) => p.keys.forEach((k) => used.set(k, (used.get(k) || 0) + 1)));
    FAMILIES.forEach((fam) => {
      const keys = Object.keys(INSTRUMENTS).filter((k) => INSTRUMENTS[k].family === fam.key && used.get(k));
      if (!keys.length) return;
      const group = el('details', 'chip-group');
      group.dataset.family = fam.key;
      group.open = Boolean(fam.open);
      const summary = el('summary', 'chip-group-label');
      const badge = el('span', 'chip-group-selected');
      badge.hidden = true;
      summary.append(el('span', 'chip-group-name', fam.label),
        el('span', 'chip-group-preview', keys.map((k) => INSTRUMENTS[k].label).join('・')), badge);
      const chips = el('div', 'chips');
      group.append(summary, chips);
      keys.forEach((key) => {
        const btn = el('button', `stage-chip fam-${fam.key}`);
        btn.type = 'button';
        btn.dataset.key = key;
        btn.title = `${INSTRUMENTS[key].label}を舞台に1人置く`;
        btn.append(el('span', 'chip-dot', INSTRUMENTS[key].label[0]), el('span', 'chip-name', INSTRUMENTS[key].label), el('span', 'chip-n'));
        chips.appendChild(btn);
      });
      els.palette.appendChild(group);
    });
  }

  function renderPalette() {
    els.palette.querySelectorAll('.stage-chip').forEach((btn) => {
      const n = placed.get(btn.dataset.key) || 0;
      btn.classList.toggle('is-on', n > 0);
      btn.querySelector('.chip-n').textContent = n ? `×${n}` : '';
    });
    // 閉じたジャンルに置いた楽器があれば、見出しに人数を出す。URL から置いたときはジャンルを開く
    els.palette.querySelectorAll('.chip-group').forEach((group) => {
      const n = [...group.querySelectorAll('.stage-chip')].reduce((s, b) => s + (placed.get(b.dataset.key) || 0), 0);
      const badge = group.querySelector('.chip-group-selected');
      badge.textContent = `${n}人`;
      badge.hidden = n === 0;
    });
  }

  // ---- 絞り込み ----
  function matchesStage(piece, { mode, cmp }) {
    for (const [key, count] of placed) {
      if (!piece.keys.has(key)) return false;
      if (cmp === 'any') continue;
      // 人数で絞るときは、人数の記載がない楽器は当てはまらない扱い
      const parts = piece.partsByKey.get(key);
      if (parts === null) return false;
      if (cmp === 'gte' ? parts < count : parts !== count) return false;
    }
    if (mode === 'exact' && placed.size && piece.keys.size !== placed.size) return false;
    return true;
  }
  const inYears = (piece) => from === null || (piece.year && decadeOf(piece.year) >= from && decadeOf(piece.year) <= to);

  // ---- 年代の棒グラフ ----
  let decadeRange = [];
  function buildDecades() {
    const years = pieces.filter((p) => p.year).map((p) => decadeOf(p.year));
    const min = Math.min(...years);
    const max = Math.max(...years);
    for (let d = min; d <= max; d += 10) decadeRange.push(d);
    decadeRange.forEach((d) => {
      const btn = el('button', 'decade');
      btn.type = 'button';
      btn.dataset.decade = d;
      btn.append(el('span', 'decade-count'), el('span', 'bar'), el('span', 'decade-label', `${String(d).slice(2)}年代`));
      els.decades.appendChild(btn);
    });
  }

  function renderDecades(matched) {
    const counts = new Map(decadeRange.map((d) => [d, 0]));
    matched.forEach((p) => { if (p.year) counts.set(decadeOf(p.year), counts.get(decadeOf(p.year)) + 1); });
    const max = Math.max(1, ...counts.values());
    els.decades.querySelectorAll('.decade').forEach((btn) => {
      const d = Number(btn.dataset.decade);
      const n = counts.get(d);
      const h = n ? Math.max(4, (n / max) * 80) : 1;
      btn.querySelector('.bar').style.height = `${h}px`;
      const label = btn.querySelector('.decade-count');
      label.textContent = n || '';
      label.style.bottom = `${h + 2}px`;
      btn.classList.toggle('is-on', from !== null && d >= from && d <= to);
      btn.setAttribute('aria-pressed', String(from !== null && d >= from && d <= to));
      btn.setAttribute('aria-label', `${d}年代（${n}曲）`);
    });
    const noYear = matched.filter((p) => !p.year).length;
    if (from === null) {
      els.yearsText.textContent = `年代は指定していません（作曲年の記載がない曲 ${noYear}曲も含みます）`;
    } else {
      els.yearsText.replaceChildren('選択中：', el('b', '', from === to ? `${from}年代` : `${from}〜${to + 9}年`),
        `　（作曲年の記載がない ${noYear}曲は除いています）`);
    }
    els.yearsClear.hidden = from === null;
  }

  // 押した年代を選ぶ。1つ選んである状態で別の年代を押すと範囲にする。同じ年代をもう一度押すと解除
  function pickDecade(d, extend) {
    if (extend && from !== null) {
      from = Math.min(from, d);
      to = Math.max(to, d);
    } else if (from === d && to === d) {
      from = null;
      to = null;
    } else {
      from = d;
      to = d;
    }
  }

  // ---- 結果 ----
  function players(p) {
    return p.players ? String(p.players) : '';
  }

  function miniStage(piece) {
    const dots = [];
    piece.instruments.forEach((i) => {
      for (let k = 0; k < (i.parts || 1); k++) dots.push({ fam: family(i.key), unknown: !i.parts });
    });
    const s = svg('svg', { viewBox: '0 0 96 38', class: 'mini', 'aria-hidden': 'true' });
    s.appendChild(svg('line', { x1: 4, y1: 36, x2: 92, y2: 36 }));
    const n = dots.length;
    const r = n > 12 ? 2.6 : 3.4;
    dots.forEach((d, i) => {
      const t = n === 1 ? 0.5 : i / (n - 1);
      const a = Math.PI * (0.1 + 0.8 * t);
      const rr = n > 8 ? (i % 2 ? 0.62 : 0.88) : 0.8;
      s.appendChild(svg('circle', {
        cx: (48 - Math.cos(a) * 42 * rr).toFixed(1),
        cy: (34 - Math.sin(a) * 28 * rr).toFixed(1),
        r,
        class: `fam-${d.fam}${d.unknown ? ' is-unknown' : ''}`,
        'stroke-width': 1.2,
      }));
    });
    return s;
  }

  function renderItem(p) {
    const li = el('li', 'stage-item');
    const mark = el('span', 'mark');
    mark.dataset.color = p.categoryColor || 'gray';
    if (p.category) mark.title = p.category;
    const a = el('a', '', p.title);
    a.href = `piece.html?id=${p.id}`;
    if (p.reading) a.appendChild(el('span', 'reading', p.reading));
    const n = el('span', 'n');
    if (p.players) n.textContent = players(p);
    else n.appendChild(el('small', '', '不明'));
    li.append(mark, a, el('span', 'year', p.yearLabel || (p.year ? String(p.year) : '')),
      el('span', 'who', [p.composer, p.arranger && `編曲：${p.arranger}`].filter(Boolean).join('　')), miniStage(p), n);
    return li;
  }

  function showMore() {
    const next = results.slice(shown, shown + PAGE);
    els.list.append(...next.map(renderItem));
    shown += next.length;
    const rest = results.length - shown;
    els.more.hidden = rest <= 0;
    els.more.textContent = `さらに${Math.min(PAGE, rest)}曲表示（残り${rest}曲）`;
  }

  // ---- URL ----
  function writeUrl(state) {
    const params = new URLSearchParams();
    if (placed.size) params.set('inst', [...placed].map(([k, n]) => `${k}:${n}`).join(','));
    if (state.cmp !== 'eq') params.set('cmp', state.cmp);
    if (state.mode !== 'include') params.set('mode', state.mode);
    if (from !== null) { params.set('from', from); params.set('to', to); }
    const query = params.toString();
    try { history.replaceState(null, '', query ? `?${query}` : location.pathname); } catch (e) { /* 失敗しても検索は続ける */ }

    // 検索ページで同じ編成を開くリンク（年代は検索ページにないので含めない）
    const search = new URLSearchParams();
    if (placed.size) search.set('inst', [...placed].map(([k, n]) => (state.cmp === 'any' ? k : `${k}:${n}`)).join(','));
    if (state.cmp === 'gte') search.set('cmp', 'gte');
    if (state.mode === 'exact') search.set('mode', 'exact');
    els.openSearch.href = `index.html${search.toString() ? `?${search}` : ''}`;
    els.openSearch.hidden = placed.size === 0;
  }

  function readUrl() {
    const params = new URLSearchParams(location.search);
    (params.get('inst') || '').split(',').forEach((item) => {
      const [key, n] = item.split(':');
      if (!INSTRUMENTS[key]) return;
      const count = parseInt(n, 10);
      placed.set(key, count > 0 ? Math.min(count, MAX_PARTS) : 1);
      const chip = els.palette.querySelector(`.stage-chip[data-key="${key}"]`);
      if (chip) chip.closest('.chip-group').open = true;
    });
    if (['gte', 'any'].includes(params.get('cmp'))) document.querySelector(`input[name="cmp"][value="${params.get('cmp')}"]`).checked = true;
    if (params.get('mode') === 'exact') document.querySelector('input[name="mode"][value="exact"]').checked = true;
    const f = parseInt(params.get('from'), 10);
    const t = parseInt(params.get('to'), 10);
    if (decadeRange.includes(f) && decadeRange.includes(t) && f <= t) { from = f; to = t; }
  }

  // ---- 全体の更新 ----
  function update() {
    const state = form();
    const matched = pieces.filter((p) => matchesStage(p, state));
    results = matched.filter(inYears).sort((a, b) => collator.compare(a.reading || a.title, b.reading || b.title));
    renderStage();
    renderPalette();
    renderDecades(matched);
    shown = 0;
    els.list.replaceChildren();
    showMore();
    els.count.replaceChildren(el('b', '', String(results.length)), placed.size || from !== null
      ? `曲 / 全${pieces.length}曲`
      : `曲（楽器を舞台に置くと絞り込みます）`);
    writeUrl(state);
  }

  function addPlayer(key) {
    placed.set(key, Math.min((placed.get(key) || 0) + 1, MAX_PARTS));
    update();
  }
  function removePlayer(key) {
    const n = (placed.get(key) || 0) - 1;
    if (n > 0) placed.set(key, n);
    else placed.delete(key);
    update();
  }

  function bindEvents() {
    // 画面の幅が変わったら、舞台の奏者の大きさを合わせ直す
    let resizeTimer = null;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(renderStage, 150);
    });
    els.palette.addEventListener('click', (e) => {
      const chip = e.target.closest('.stage-chip');
      if (chip) addPlayer(chip.dataset.key);
    });
    els.stage.addEventListener('click', (e) => {
      const seat = e.target.closest('.seat');
      if (seat) removePlayer(seat.dataset.key);
    });
    els.stage.addEventListener('keydown', (e) => {
      const seat = e.target.closest('.seat');
      if (!seat || !['Enter', ' '].includes(e.key)) return;
      e.preventDefault();
      const key = seat.dataset.key;
      removePlayer(key);
      // 同じ楽器の奏者が残っていれば、そこへフォーカスを戻す
      const next = els.stage.querySelector(`.seat[data-key="${key}"]`);
      if (next) next.focus();
    });
    els.stageClear.addEventListener('click', () => { placed.clear(); update(); });
    document.querySelectorAll('.stage-options input').forEach((input) => input.addEventListener('change', update));
    els.more.addEventListener('click', showMore);
    els.yearsClear.addEventListener('click', () => { from = null; to = null; update(); });

    // 年代：押す、Shift を押しながら押す／続けて押すと範囲、なぞると範囲
    let dragFrom = null;
    const decadeAt = (x, y) => {
      const btn = document.elementFromPoint(x, y);
      return btn && btn.closest ? btn.closest('.decade') : null;
    };
    els.decades.addEventListener('pointerdown', (e) => {
      const btn = e.target.closest('.decade');
      if (!btn) return;
      const d = Number(btn.dataset.decade);
      const single = from !== null && from === to;
      pickDecade(d, e.shiftKey || (single && from !== d));
      dragFrom = d;
      update();
    });
    els.decades.addEventListener('pointermove', (e) => {
      if (dragFrom === null || !e.buttons) return;
      const btn = decadeAt(e.clientX, e.clientY);
      if (!btn) return;
      const d = Number(btn.dataset.decade);
      const f = Math.min(dragFrom, d);
      const t = Math.max(dragFrom, d);
      if (f !== from || t !== to) { from = f; to = t; update(); }
    });
    window.addEventListener('pointerup', () => { dragFrom = null; });
    // キーボードで押したとき（pointerdown が起きない）
    els.decades.addEventListener('click', (e) => {
      if (e.detail !== 0) return;
      const btn = e.target.closest('.decade');
      if (!btn) return;
      pickDecade(Number(btn.dataset.decade), e.shiftKey);
      update();
    });
  }

  // ---- 起動 ----
  loadMusicData()
    .then((data) => {
      INSTRUMENTS = data.instruments;
      pieces = data.pieces.map((p) => {
        const instruments = p.instruments.filter((i) => INSTRUMENTS[i.key]);
        const known = instruments.length > 0 && instruments.every((i) => i.parts);
        const partsByKey = new Map();
        instruments.forEach((i) => {
          const sum = partsByKey.has(i.key) ? partsByKey.get(i.key) : 0;
          partsByKey.set(i.key, sum === null || !i.parts ? null : sum + i.parts);
        });
        return Object.assign({}, p, {
          instruments,
          keys: new Set(instruments.map((i) => i.key)),
          partsByKey,
          players: known ? instruments.reduce((s, i) => s + i.parts, 0) : null,
        });
      });
      buildPalette();
      buildDecades();
      readUrl();
      bindEvents();
      update();
    })
    .catch((error) => {
      console.error(error);
      els.count.textContent = '楽曲データを読み込めませんでした。時間をおいて再読み込みしてください。';
    });
})();
