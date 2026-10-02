function startMusicSearch(INSTRUMENTS, PIECES) {
  'use strict';

  const NO_VALUE = '__none'; // 「作曲者の記載なし」の選択肢

  // 表記ゆれを吸収：全角/半角、大文字/小文字、カタカナ/ひらがな、ヴァ/バ、絃/弦、空白や記号
  function normalize(text) {
    return String(text)
      .normalize('NFKC')
      .toLowerCase()
      .replace(/ヴァ/g, 'バ').replace(/ヴィ/g, 'ビ').replace(/ヴェ/g, 'ベ').replace(/ヴォ/g, 'ボ').replace(/ヴ/g, 'ブ')
      .replace(/ゔ/g, 'ぶ')
      .replace(/絃/g, '弦')
      .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
      .replace(/[\s・.,、。「」『』()（）\-]/g, '');
  }

  function instrumentText(entry) {
    if (entry.notation) return entry.notation;
    const label = INSTRUMENTS[entry.key].label;
    return entry.parts > 1 ? `${label}×${entry.parts}` : label;
  }

  // 検索用の値を事前に計算しておく
  const pieces = PIECES.map((p, index) => {
    const instruments = p.instruments.filter((i) => INSTRUMENTS[i.key]);
    const known = instruments.length > 0 && instruments.every((i) => i.parts);
    const piece = Object.assign({}, p, {
      index,
      instruments,
      keys: new Set(instruments.map((i) => i.key)),
      players: known ? instruments.reduce((sum, i) => sum + i.parts, 0) : null,
      partsByKey: new Map(),
    });
    // 楽器ごとのパート数の合計（独奏とセクションなど同じ楽器が複数あれば足す。不明が含まれれば null）
    instruments.forEach((i) => {
      const sum = piece.partsByKey.has(i.key) ? piece.partsByKey.get(i.key) : 0;
      piece.partsByKey.set(i.key, sum === null || !i.parts ? null : sum + i.parts);
    });
    const instrumentWords = instruments.flatMap((i) =>
      [INSTRUMENTS[i.key].label, ...INSTRUMENTS[i.key].aliases, i.notation]);
    piece.haystack = normalize([p.title, p.reading, p.subtitle, p.category, p.composer, p.composerReading, p.arranger,
      p.yearLabel, p.remarks, ...instrumentWords].join(' '));
    return piece;
  });

  const els = {
    form: document.getElementById('search-form'),
    q: document.getElementById('q'),
    groups: document.getElementById('instrument-groups'),
    composer: document.getElementById('composer'),
    min: document.getElementById('min'),
    max: document.getElementById('max'),
    sort: document.getElementById('sort'),
    order: document.getElementById('order'),
    perPage: document.getElementById('per-page'),
    reset: document.getElementById('reset-button'),
    list: document.getElementById('list'),
    count: document.getElementById('count'),
    more: document.getElementById('more'),
    empty: document.getElementById('empty'),
    advanced: document.getElementById('advanced'),
    advancedCount: document.getElementById('advanced-count'),
    countMode: document.getElementById('count-mode'),
    composerInput: document.getElementById('composer-input'),
    composerSelected: document.getElementById('composer-selected'),
    composerList: document.getElementById('composer-list'),
    composerClear: document.getElementById('composer-clear'),
    instSummary: document.getElementById('inst-summary'),
  };

  const PER_PAGE_KEY = 'music-search-per-page';
  const RESTORE_KEY = 'music-search-restore';

  // ランダム表示の並び。開くたびに新しい種で並べ、詳細ページから戻ったときだけ同じ種で並べ直す
  const savedView = (() => {
    try { return JSON.parse(sessionStorage.getItem(RESTORE_KEY)); } catch (e) { return null; }
  })();
  const randomSeed = savedView && savedView.url === location.href && savedView.seed
    ? savedView.seed
    : Math.floor(Math.random() * 2 ** 31) + 1;
  (function assignRandomOrder(seed) {
    // 種から同じ乱数列を作る（mulberry32）
    let t = seed;
    const next = () => {
      t = (t + 0x6d2b79f5) | 0;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
    pieces.forEach((p) => { p.rand = next(); });
  })(randomSeed);
  // 並び順を自分で選んだかどうか。選んでいなければ、条件なし→ランダム、条件あり→五十音順
  let sortChosen = false;
  const MAX_PARTS = 99;
  // 選んだ楽器 → 指定したパート数（null は指定なし）
  const selected = new Map();
  let results = [];
  let shown = 0;

  // ---- 検索フォームの構築 ----
  function countBy(fn) {
    const counts = new Map();
    pieces.forEach((p) => [].concat(fn(p)).forEach((v) => counts.set(v, (counts.get(v) || 0) + 1)));
    return counts;
  }

  function buildForm() {
    const usage = countBy((p) => [...p.keys]);

    FAMILIES.forEach((family) => {
      const keys = Object.keys(INSTRUMENTS).filter((k) => INSTRUMENTS[k].family === family.key && usage.get(k));
      if (!keys.length) return;

      const group = el('div', 'chip-group');
      group.appendChild(el('p', 'chip-group-label', family.label));

      const chips = el('div', 'chips');
      keys.forEach((key) => {
        const label = INSTRUMENTS[key].label;
        const wrap = el('span', 'chip-wrap');
        wrap.dataset.key = key;
        const btn = el('button', 'chip', label);
        btn.type = 'button';
        btn.dataset.key = key;
        btn.setAttribute('aria-pressed', 'false');
        btn.appendChild(el('span', 'chip-count', String(usage.get(key))));
        const stepper = el('span', 'stepper');
        stepper.hidden = true;
        const minus = el('button', 'step', '−');
        minus.type = 'button';
        minus.dataset.step = '-1';
        minus.setAttribute('aria-label', `${label}のパート数を減らす`);
        const value = el('span', 'step-value');
        value.setAttribute('aria-live', 'polite');
        const plus = el('button', 'step', '＋');
        plus.type = 'button';
        plus.dataset.step = '1';
        plus.setAttribute('aria-label', `${label}のパート数を増やす`);
        stepper.append(minus, value, plus);
        wrap.append(btn, stepper);
        chips.appendChild(wrap);
      });
      group.appendChild(chips);
      els.groups.appendChild(group);
    });

    PAGE_SIZES.forEach((n) => els.perPage.add(new Option(`${n}曲`, String(n))));
    els.perPage.value = String(DEFAULT_PAGE_SIZE);
  }

  // ---- 作曲者の入力欄（よみ・名前で候補を出して選ぶ。部品は combo.js） ----
  const composerCounts = countBy((p) => p.composer);
  const composerReadings = new Map(pieces.map((p) => [p.composer, p.composerReading]));
  const composerPicker = createComposerPicker({
    input: els.composerInput,
    list: els.composerList,
    selected: els.composerSelected,
    clear: els.composerClear,
  }, {
    composers: [...composerCounts.keys()].filter(Boolean)
      .map((name) => ({ name, reading: composerReadings.get(name) || '', count: composerCounts.get(name) })),
    extraOption: composerCounts.get('')
      ? { name: '作曲者の記載なし', value: NO_VALUE, count: composerCounts.get(''), className: 'is-none' }
      : null,
    onChange: (value) => {
      els.composer.value = value;
      update();
    },
  });

  // 作曲者を決める（'' は指定なし、NO_VALUE は記載なし）。refresh が true なら検索をやり直す
  function setComposer(value, refresh = true) {
    els.composer.value = value;
    composerPicker.setValue(value);
    if (refresh) update();
  }

  // count を渡すとパート数も設定する（省略時は、選択済みならそのまま、新しく選ぶなら指定なし）
  function toggleInstrument(key, force, count) {
    const on = force === undefined ? !selected.has(key) : force;
    if (!on) selected.delete(key);
    else if (count !== undefined || !selected.has(key)) selected.set(key, count === undefined ? null : count);
    renderChip(key);
  }

  // パート数を1つ増減する。指定なし → 1 → 2 …、1 から減らすと指定なし
  function stepCount(key, delta) {
    const current = selected.get(key);
    let next = (current || 0) + delta;
    if (next < 1) next = null;
    if (next > MAX_PARTS) next = MAX_PARTS;
    selected.set(key, next);
    renderChip(key);
  }

  function renderChip(key) {
    const wrap = els.groups.querySelector(`.chip-wrap[data-key="${key}"]`);
    if (!wrap) return;
    const on = selected.has(key);
    const count = on ? selected.get(key) : null;
    wrap.classList.toggle('is-on', on);
    wrap.querySelector('.chip').setAttribute('aria-pressed', String(on));
    wrap.querySelector('.stepper').hidden = !on;
    const value = wrap.querySelector('.step-value');
    value.textContent = count ? String(count) : '指定なし';
    value.classList.toggle('any', !count);
    wrap.querySelector('[data-step="-1"]').disabled = !count;
    wrap.querySelector('[data-step="1"]').disabled = count === MAX_PARTS;
  }

  // 「箏2・十七絃・尺八1」のような、選んだ楽器の要約
  function instrumentSummary(state) {
    const suffix = state.cmp === 'gte' ? '以上' : '';
    const text = [...selected].map(([key, count]) => INSTRUMENTS[key].label + (count ? `${count}${suffix}` : '')).join('・');
    return state.mode === 'exact' ? `${text} だけ` : text;
  }

  // ---- 検索 ----
  function readState() {
    return {
      q: els.q.value.trim(),
      mode: els.form.elements.mode.value,
      cmp: els.form.elements.cmp.value,
      composer: els.composer.value,
      min: parseInt(els.min.value, 10) || null,
      max: parseInt(els.max.value, 10) || null,
      sort: els.sort.value,
      order: els.order.value,
    };
  }

  function matchesSelect(value, filter) {
    if (!filter) return true;
    return filter === NO_VALUE ? !value : value === filter;
  }

  function matches(piece, state) {
    if (state.q) {
      const words = state.q.split(/[\s　]+/).map(normalize).filter(Boolean);
      if (!words.every((w) => piece.haystack.includes(w))) return false;
    }

    if (selected.size) {
      for (const [key, count] of selected) {
        if (!piece.keys.has(key)) return false;
        if (count === null) continue;
        // パート数を指定したときは、パート数が不明な楽器は当てはまらない扱い
        const parts = piece.partsByKey.get(key);
        if (parts === null) return false;
        if (state.cmp === 'gte' ? parts < count : parts !== count) return false;
      }
      if (state.mode === 'exact' && piece.keys.size !== selected.size) return false;
    }

    if (!matchesSelect(piece.composer, state.composer)) return false;

    if (state.min || state.max) {
      if (piece.players === null) return false;
      if (state.min && piece.players < state.min) return false;
      if (state.max && piece.players > state.max) return false;
    }
    return true;
  }

  const collator = new Intl.Collator('ja');
  const byReading = (a, b) => collator.compare(a.reading || a.title, b.reading || b.title);
  // 値のない曲（作曲年・作曲者・パート数が不明）は最後に並べる
  const last = (v) => (v === null || v === '' ? 1 : 0);
  // 作曲者は読みの五十音順。読みがない作曲者は名前で並べる（ひらがなの後ろに来る）
  function composerSortKey(name, reading) {
    return reading || name;
  }
  const byComposer = (a, b) => collator.compare(composerSortKey(a.composer, a.composerReading), composerSortKey(b.composer, b.composerReading))
    || collator.compare(a.composer, b.composer);
  // 並び順ごとの比較（dir：1 は昇順、-1 は降順）。値のない曲はどちらの向きでも最後
  const sorters = {
    random: () => (a, b) => a.rand - b.rand,
    reading: (dir) => (a, b) => dir * byReading(a, b),
    year: (dir) => (a, b) => last(a.year) - last(b.year) || dir * (a.year - b.year) || byReading(a, b),
    composer: (dir) => (a, b) => last(a.composer) - last(b.composer) || dir * byComposer(a, b) || byReading(a, b),
    players: (dir) => (a, b) => last(a.players) - last(b.players) || dir * (a.players - b.players) || byReading(a, b),
  };
  // 昇順・降順の表示名（並び順に合わせて言い換える）
  const ORDER_LABELS = {
    random: ['', ''],
    reading: ['あ→ん', 'ん→あ'],
    year: ['古い順', '新しい順'],
    composer: ['あ→ん', 'ん→あ'],
    players: ['少ない順', '多い順'],
  };
  function updateOrderLabels() {
    // ランダムのときは向きの欄を隠す
    els.order.hidden = els.sort.value === 'random';
    const [asc, desc] = ORDER_LABELS[els.sort.value];
    els.order.options[0].textContent = asc;
    els.order.options[1].textContent = desc;
  }

  // ---- 表示 ----
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function renderCard(piece) {
    const li = el('li', 'card');

    const top = el('div', 'card-top');
    top.appendChild(piece.category ? el('span', 'badge', piece.category) : el('span'));
    const meta = [];
    const year = piece.yearLabel || (piece.year ? String(piece.year) : '');
    if (year) meta.push(`${year}年`);
    if (piece.players) meta.push(`${piece.players}パート`);
    top.appendChild(el('span', 'meta', meta.join('・')));
    li.appendChild(top);

    // 曲名のリンクがカード全体を覆い、どこを押しても詳細ページへ移る（楽器名のボタンは除く）
    const title = el('h2', 'card-title');
    const link = el('a', 'card-link', piece.title);
    link.href = `piece.html?id=${piece.id}`;
    title.appendChild(link);
    if (piece.subtitle) title.appendChild(el('span', 'card-subtitle', piece.subtitle));
    li.appendChild(title);
    if (piece.reading) li.appendChild(el('p', 'card-reading', piece.reading));

    const people = [];
    if (piece.composer) people.push(piece.composer);
    if (piece.arranger) people.push(`編曲：${piece.arranger}`);
    if (people.length) li.appendChild(el('p', 'card-composer', people.join('　')));

    if (piece.instruments.length) {
      const tags = el('ul', 'tags');
      tags.setAttribute('aria-label', '楽器編成');
      piece.instruments.forEach((entry) => {
        const item = el('li');
        let text = instrumentText(entry);
        if (entry.optional && !/[(（]|省略可/.test(text)) text += '（省略可）';
        const btn = el('button', 'tag' + (entry.solo ? ' tag-solo' : ''), text);
        btn.type = 'button';
        btn.dataset.key = entry.key;
        btn.title = `「${INSTRUMENTS[entry.key].label}」で絞り込む`;
        if (selected.has(entry.key)) btn.classList.add('is-selected');
        item.appendChild(btn);
        tags.appendChild(item);
      });
      li.appendChild(tags);
    } else {
      li.appendChild(el('p', 'card-note', '楽器編成の記載なし'));
    }

    if (piece.remarks) li.appendChild(el('p', 'card-note', piece.remarks));
    return li;
  }

  function pageSize() {
    return Number(els.perPage.value) || DEFAULT_PAGE_SIZE;
  }

  function showMore() {
    const next = results.slice(shown, shown + pageSize());
    els.list.append(...next.map(renderCard));
    shown += next.length;
    const rest = results.length - shown;
    els.more.hidden = rest <= 0;
    els.more.textContent = `さらに${Math.min(pageSize(), rest)}曲表示（残り${rest}曲）`;
  }

  function writeUrl(state) {
    const params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    // inst=koto:2,shakuhachi:1,jushichigen（数のない楽器は指定なし）
    if (selected.size) params.set('inst', [...selected].map(([k, c]) => (c ? `${k}:${c}` : k)).join(','));
    if (state.cmp === 'gte' && [...selected.values()].some(Boolean)) params.set('cmp', 'gte');
    if (state.mode !== 'include') params.set('mode', state.mode);
    if (state.composer) params.set('composer', state.composer);
    if (state.min) params.set('min', state.min);
    if (state.max) params.set('max', state.max);
    if (state.sort !== autoSort(state)) params.set('sort', state.sort);
    if (state.order === 'desc' && state.sort !== 'random') params.set('order', 'desc');
    if (pageSize() !== DEFAULT_PAGE_SIZE) params.set('per', pageSize());
    const query = params.toString();
    try {
      history.replaceState(null, '', query ? `?${query}` : location.pathname);
    } catch (e) { /* file:// などで失敗しても検索は続行 */ }
  }

  function readUrl() {
    const params = new URLSearchParams(location.search);
    els.q.value = params.get('q') || '';
    (params.get('inst') || '').split(',').forEach((item) => {
      const [key, n] = item.split(':');
      if (!INSTRUMENTS[key]) return;
      const count = parseInt(n, 10);
      toggleInstrument(key, true, count > 0 ? Math.min(count, MAX_PARTS) : null);
    });
    if (params.get('cmp') === 'gte') els.form.elements.cmp.value = 'gte';
    if (params.get('mode') === 'exact') els.form.elements.mode.value = 'exact';
    setComposer(params.get('composer') || '', false);
    els.min.value = params.get('min') || '';
    els.max.value = params.get('max') || '';
    if (sorters[params.get('sort')]) {
      els.sort.value = params.get('sort');
      sortChosen = true;
    }
    els.order.value = params.get('order') === 'desc' ? 'desc' : 'asc';
    updateOrderLabels();
    // 詳細検索の条件が URL に入っていれば、最初から開いておく
    if (['inst', 'composer', 'min', 'max'].some((k) => params.get(k))) els.advanced.open = true;

    // 表示件数：URL の指定 → 前回選んだ件数 → 初期値 の順
    let per = params.get('per');
    if (!per) {
      try { per = localStorage.getItem(PER_PAGE_KEY); } catch (e) { per = null; }
    }
    if (PAGE_SIZES.includes(Number(per))) els.perPage.value = String(Number(per));
  }

  // 折りたたんだ詳細検索にも、設定中の条件数を表示する
  function showAdvancedCount(state) {
    const count = selected.size + [state.composer, state.min || state.max].filter(Boolean).length;
    els.advancedCount.textContent = `${count}件の条件`;
    els.advancedCount.hidden = count === 0;
  }

  // 検索条件（キーワード・楽器・作曲者・パート数）が1つでもあるか
  function hasConditions(state) {
    return Boolean(state.q || selected.size || state.composer || state.min || state.max);
  }
  // 並び順を選んでいないときの並び：条件なしはランダム、条件ありは五十音順
  function autoSort(state) {
    return hasConditions(state) ? 'reading' : 'random';
  }

  function update() {
    const state = readState();
    if (!sortChosen && state.sort !== autoSort(state)) {
      state.sort = autoSort(state);
      els.sort.value = state.sort;
      updateOrderLabels();
    }
    showAdvancedCount(state);
    // 「ちょうど／以上」は、パート数を指定したときだけ表示する
    els.countMode.hidden = ![...selected.values()].some(Boolean);
    els.instSummary.textContent = instrumentSummary(state);
    els.instSummary.hidden = selected.size === 0;
    results = pieces.filter((p) => matches(p, state)).sort(sorters[state.sort](state.order === 'desc' ? -1 : 1));
    shown = 0;
    els.list.replaceChildren();
    showMore();
    els.count.textContent = `${results.length}件 / 全${pieces.length}曲`;
    els.empty.hidden = results.length > 0;
    writeUrl(state);
  }

  // ---- イベント ----
  buildForm();
  readUrl();

  els.form.addEventListener('input', update);
  els.form.addEventListener('submit', (e) => { e.preventDefault(); update(); });
  els.sort.addEventListener('change', () => {
    sortChosen = true;
    updateOrderLabels();
    update();
  });
  els.order.addEventListener('change', update);
  els.perPage.addEventListener('change', () => {
    try { localStorage.setItem(PER_PAGE_KEY, els.perPage.value); } catch (e) { /* 保存できなくても表示は切り替わる */ }
    update();
  });
  els.more.addEventListener('click', showMore);

  els.groups.addEventListener('click', (e) => {
    const step = e.target.closest('.step');
    if (step) {
      stepCount(step.closest('.chip-wrap').dataset.key, Number(step.dataset.step));
      update();
      return;
    }
    const chip = e.target.closest('.chip');
    if (!chip) return;
    toggleInstrument(chip.dataset.key);
    update();
  });

  els.list.addEventListener('click', (e) => {
    // 詳細ページへ移る前に、表示中の件数とスクロール位置を覚えておく
    if (e.target.closest('.card-link')) {
      try {
        sessionStorage.setItem(RESTORE_KEY, JSON.stringify({ url: location.href, shown, y: window.scrollY, seed: randomSeed }));
      } catch (err) { /* 保存できなくても移動はできる */ }
      return;
    }
    const tag = e.target.closest('.tag');
    if (!tag) return;
    toggleInstrument(tag.dataset.key);
    els.advanced.open = true;
    update();
  });

  els.reset.addEventListener('click', () => {
    els.form.reset();
    setComposer('', false);
    [...selected.keys()].forEach((k) => toggleInstrument(k, false));
    sortChosen = false;
    els.order.value = 'asc';
    update();
  });

  update();
  restoreView();

  // 詳細ページから戻ったとき、「さらに表示」で出していた件数とスクロール位置を戻す
  function restoreView() {
    let saved = null;
    try {
      saved = JSON.parse(sessionStorage.getItem(RESTORE_KEY));
      sessionStorage.removeItem(RESTORE_KEY);
    } catch (e) { return; }
    if (!saved || saved.url !== location.href) return;
    while (shown < saved.shown && shown < results.length) showMore();
    window.scrollTo(0, saved.y);
  }
}

(function () {
  const count = document.getElementById('count');
  count.textContent = '読み込み中…';
  loadMusicData()
    .then(({ instruments, pieces }) => startMusicSearch(instruments, pieces))
    .catch((error) => {
      console.error(error);
      count.textContent = '楽曲データを読み込めませんでした';
      const empty = document.getElementById('empty');
      empty.textContent = '時間をおいて再読み込みしてください。続く場合は config.js の接続設定を確認してください。';
      empty.hidden = false;
    });
})();
