function startMusicSearch(INSTRUMENTS, PIECES) {
  'use strict';

  const KANJI_NUM = ['', '独奏', '二重奏', '三重奏', '四重奏', '五重奏', '六重奏', '七重奏', '八重奏', '九重奏'];

  const SETTING_OPTIONS = [
    { value: 'solo',      label: '独奏' },
    { value: 'chamber',   label: '室内楽（2人以上）' },
    { value: 'concerto',  label: SETTINGS.concerto },
    { value: 'orchestra', label: SETTINGS.orchestra },
    { value: 'band',      label: SETTINGS.band },
  ];

  // 表記ゆれを吸収：全角/半角、大文字/小文字、カタカナ/ひらがな、ヴァ/バ、空白や記号
  function normalize(text) {
    return String(text)
      .normalize('NFKC')
      .toLowerCase()
      .replace(/ヴァ/g, 'バ').replace(/ヴィ/g, 'ビ').replace(/ヴェ/g, 'ベ').replace(/ヴォ/g, 'ボ').replace(/ヴ/g, 'ブ')
      .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
      .replace(/[\s・.,、。「」『』()（）\-]/g, '');
  }

  function ensembleLabel(piece) {
    if (piece.setting !== 'chamber') return SETTINGS[piece.setting];
    const n = piece.players;
    return KANJI_NUM[n] || `${n}人のアンサンブル`;
  }

  // 検索用の値を事前に計算しておく
  const pieces = PIECES.map((p, index) => {
    const keys = p.instruments.map(([key]) => key);
    const players = p.setting === 'chamber'
      ? p.instruments.reduce((sum, [, n]) => sum + (n || 0), 0)
      : null;
    const instrumentWords = keys.flatMap((k) => [INSTRUMENTS[k].label, ...INSTRUMENTS[k].aliases]);
    const piece = Object.assign({}, p, { index, keys: new Set(keys), players });
    piece.ensemble = ensembleLabel(piece);
    piece.haystack = normalize([p.title, p.original, p.composer, p.composerOriginal, p.note || '',
      piece.ensemble, ...instrumentWords].join(' '));
    return piece;
  });

  const els = {
    form: document.getElementById('search-form'),
    q: document.getElementById('q'),
    groups: document.getElementById('instrument-groups'),
    setting: document.getElementById('setting'),
    era: document.getElementById('era'),
    min: document.getElementById('min'),
    max: document.getElementById('max'),
    sort: document.getElementById('sort'),
    reset: document.getElementById('reset-button'),
    list: document.getElementById('list'),
    count: document.getElementById('count'),
    empty: document.getElementById('empty'),
  };

  const selected = new Set();

  // ---- 検索フォームの構築 ----
  function buildForm() {
    const usage = {};
    pieces.forEach((p) => p.keys.forEach((k) => { usage[k] = (usage[k] || 0) + 1; }));

    FAMILIES.forEach((family) => {
      const keys = Object.keys(INSTRUMENTS).filter((k) => INSTRUMENTS[k].family === family.key && usage[k]);
      if (!keys.length) return;

      const group = document.createElement('div');
      group.className = 'chip-group';
      const heading = document.createElement('p');
      heading.className = 'chip-group-label';
      heading.textContent = family.label;
      group.appendChild(heading);

      const chips = document.createElement('div');
      chips.className = 'chips';
      keys.forEach((key) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'chip';
        btn.dataset.key = key;
        btn.setAttribute('aria-pressed', 'false');
        btn.textContent = INSTRUMENTS[key].label;
        const num = document.createElement('span');
        num.className = 'chip-count';
        num.textContent = usage[key];
        btn.appendChild(num);
        chips.appendChild(btn);
      });
      group.appendChild(chips);
      els.groups.appendChild(group);
    });

    SETTING_OPTIONS.forEach(({ value, label }) => els.setting.add(new Option(label, value)));
    ERAS.forEach((era) => els.era.add(new Option(era, era)));
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
      setting: els.setting.value,
      era: els.era.value,
      min: parseInt(els.min.value, 10) || null,
      max: parseInt(els.max.value, 10) || null,
      sort: els.sort.value,
    };
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

    if (state.setting) {
      if (state.setting === 'solo' && !(piece.setting === 'chamber' && piece.players === 1)) return false;
      if (state.setting === 'chamber' && !(piece.setting === 'chamber' && piece.players >= 2)) return false;
      if (['concerto', 'orchestra', 'band'].includes(state.setting) && piece.setting !== state.setting) return false;
    }

    if (state.era && piece.era !== state.era) return false;

    if (state.min || state.max) {
      if (piece.players === null) return false;
      if (state.min && piece.players < state.min) return false;
      if (state.max && piece.players > state.max) return false;
    }
    return true;
  }

  const collator = new Intl.Collator('ja');
  const sorters = {
    year: (a, b) => a.year - b.year || collator.compare(a.title, b.title),
    title: (a, b) => collator.compare(a.title, b.title),
    composer: (a, b) => collator.compare(a.composer, b.composer) || a.year - b.year,
    // 管弦楽などの人数未定の曲は最後に並べる
    players: (a, b) => (a.players ?? Infinity) - (b.players ?? Infinity) || a.year - b.year,
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
    top.appendChild(el('span', `badge badge-${piece.setting}`, piece.ensemble));
    const meta = [piece.year ? `${piece.year}年` : '', piece.era || ''].filter(Boolean).join('・');
    top.appendChild(el('span', 'meta', meta));
    li.appendChild(top);

    li.appendChild(el('h2', 'card-title', piece.title));
    li.appendChild(el('p', 'card-original', piece.original));
    li.appendChild(el('p', 'card-composer', `${piece.composer}（${piece.composerOriginal}）`));

    const tags = el('ul', 'tags');
    tags.setAttribute('aria-label', '楽器編成');
    piece.instruments.forEach(([key, n, role]) => {
      const item = el('li');
      let text = INSTRUMENTS[key].label;
      if (n > 1) text += ` ×${n}`;
      const btn = el('button', 'tag' + (role === 'solo' ? ' tag-solo' : ''), (role === 'solo' ? '独奏 ' : '') + text);
      btn.type = 'button';
      btn.dataset.key = key;
      btn.title = `「${INSTRUMENTS[key].label}」で絞り込む`;
      if (selected.has(key)) btn.classList.add('is-selected');
      item.appendChild(btn);
      tags.appendChild(item);
    });
    li.appendChild(tags);

    if (piece.note) li.appendChild(el('p', 'card-note', piece.note));
    return li;
  }

  function writeUrl(state) {
    const params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (selected.size) params.set('inst', [...selected].join(','));
    if (state.mode !== 'include') params.set('mode', state.mode);
    if (state.setting) params.set('setting', state.setting);
    if (state.era) params.set('era', state.era);
    if (state.min) params.set('min', state.min);
    if (state.max) params.set('max', state.max);
    if (state.sort !== 'year') params.set('sort', state.sort);
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
    els.setting.value = params.get('setting') || '';
    els.era.value = params.get('era') || '';
    els.min.value = params.get('min') || '';
    els.max.value = params.get('max') || '';
    if (sorters[params.get('sort')]) els.sort.value = params.get('sort');
  }

  function update() {
    const state = readState();
    const results = pieces.filter((p) => matches(p, state)).sort(sorters[state.sort]);

    els.list.replaceChildren(...results.map(renderCard));
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
    els.sort.value = 'year';
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
