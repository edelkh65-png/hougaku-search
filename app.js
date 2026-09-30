function startMusicSearch(INSTRUMENTS, PIECES) {
  'use strict';

  const NO_VALUE = '__none'; // 「分類なし」「作曲者の記載なし」の選択肢

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
    });
    const instrumentWords = instruments.flatMap((i) =>
      [INSTRUMENTS[i.key].label, ...INSTRUMENTS[i.key].aliases, i.notation]);
    piece.haystack = normalize([p.title, p.reading, p.subtitle, p.category, p.composer, p.arranger,
      p.yearLabel, p.remarks, ...instrumentWords].join(' '));
    return piece;
  });

  const els = {
    form: document.getElementById('search-form'),
    q: document.getElementById('q'),
    groups: document.getElementById('instrument-groups'),
    category: document.getElementById('category'),
    composer: document.getElementById('composer'),
    min: document.getElementById('min'),
    max: document.getElementById('max'),
    sort: document.getElementById('sort'),
    reset: document.getElementById('reset-button'),
    list: document.getElementById('list'),
    count: document.getElementById('count'),
    more: document.getElementById('more'),
    empty: document.getElementById('empty'),
  };

  const selected = new Set();
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
        const btn = el('button', 'chip', INSTRUMENTS[key].label);
        btn.type = 'button';
        btn.dataset.key = key;
        btn.setAttribute('aria-pressed', 'false');
        btn.appendChild(el('span', 'chip-count', String(usage.get(key))));
        chips.appendChild(btn);
      });
      group.appendChild(chips);
      els.groups.appendChild(group);
    });

    function fillSelect(select, counts, noneLabel) {
      [...counts.keys()].filter(Boolean).sort(collator.compare)
        .forEach((v) => select.add(new Option(`${v}（${counts.get(v)}）`, v)));
      if (counts.get('')) select.add(new Option(`${noneLabel}（${counts.get('')}）`, NO_VALUE));
    }
    fillSelect(els.category, countBy((p) => p.category), '分類なし');
    fillSelect(els.composer, countBy((p) => p.composer), '記載なし');
  }

  function toggleInstrument(key, force) {
    const on = force === undefined ? !selected.has(key) : force;
    if (on) selected.add(key); else selected.delete(key);
    const chip = els.groups.querySelector(`.chip[data-key="${key}"]`);
    if (chip) chip.setAttribute('aria-pressed', String(on));
  }

  // ---- 検索 ----
  function readState() {
    return {
      q: els.q.value.trim(),
      mode: els.form.elements.mode.value,
      category: els.category.value,
      composer: els.composer.value,
      min: parseInt(els.min.value, 10) || null,
      max: parseInt(els.max.value, 10) || null,
      sort: els.sort.value,
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
      for (const key of selected) if (!piece.keys.has(key)) return false;
      if (state.mode === 'exact' && piece.keys.size !== selected.size) return false;
    }

    if (!matchesSelect(piece.category, state.category)) return false;
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
  // 値のない曲（作曲年・作曲者・人数が不明）は最後に並べる
  const last = (v) => (v === null || v === '' ? 1 : 0);
  const sorters = {
    reading: byReading,
    year: (a, b) => last(a.year) - last(b.year) || a.year - b.year || byReading(a, b),
    composer: (a, b) => last(a.composer) - last(b.composer) || collator.compare(a.composer, b.composer) || byReading(a, b),
    players: (a, b) => last(a.players) - last(b.players) || a.players - b.players || byReading(a, b),
  };

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
    if (piece.players) meta.push(`${piece.players}人`);
    top.appendChild(el('span', 'meta', meta.join('・')));
    li.appendChild(top);

    const title = el('h2', 'card-title', piece.title);
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

  function showMore() {
    const next = results.slice(shown, shown + PAGE_SIZE);
    els.list.append(...next.map(renderCard));
    shown += next.length;
    const rest = results.length - shown;
    els.more.hidden = rest <= 0;
    els.more.textContent = `さらに表示（残り${rest}曲）`;
  }

  function writeUrl(state) {
    const params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (selected.size) params.set('inst', [...selected].join(','));
    if (state.mode !== 'include') params.set('mode', state.mode);
    if (state.category) params.set('category', state.category);
    if (state.composer) params.set('composer', state.composer);
    if (state.min) params.set('min', state.min);
    if (state.max) params.set('max', state.max);
    if (state.sort !== 'reading') params.set('sort', state.sort);
    const query = params.toString();
    try {
      history.replaceState(null, '', query ? `?${query}` : location.pathname);
    } catch (e) { /* file:// などで失敗しても検索は続行 */ }
  }

  function readUrl() {
    const params = new URLSearchParams(location.search);
    els.q.value = params.get('q') || '';
    (params.get('inst') || '').split(',').filter((k) => INSTRUMENTS[k]).forEach((k) => toggleInstrument(k, true));
    if (params.get('mode') === 'exact') els.form.elements.mode.value = 'exact';
    els.category.value = params.get('category') || '';
    els.composer.value = params.get('composer') || '';
    els.min.value = params.get('min') || '';
    els.max.value = params.get('max') || '';
    if (sorters[params.get('sort')]) els.sort.value = params.get('sort');
  }

  function update() {
    const state = readState();
    results = pieces.filter((p) => matches(p, state)).sort(sorters[state.sort]);
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
  els.sort.addEventListener('change', update);
  els.more.addEventListener('click', showMore);

  els.groups.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    toggleInstrument(chip.dataset.key);
    update();
  });

  els.list.addEventListener('click', (e) => {
    const tag = e.target.closest('.tag');
    if (!tag) return;
    toggleInstrument(tag.dataset.key);
    update();
  });

  els.reset.addEventListener('click', () => {
    els.form.reset();
    [...selected].forEach((k) => toggleInstrument(k, false));
    els.sort.value = 'reading';
    update();
  });

  update();
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
