(function () {
  'use strict';

  const main = document.getElementById('detail');
  const status = document.getElementById('status');
  const back = document.getElementById('back');

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  // 分類の印。色は style.css の .badge[data-category] で分類ごとに変える
  function categoryBadge(category) {
    const badge = el('span', 'badge', category);
    badge.dataset.category = category;
    return badge;
  }

  function link(text, href) {
    const a = el('a', '', text);
    a.href = href;
    return a;
  }

  const searchUrl = (params) => `index.html?${new URLSearchParams(params)}`;

  // YouTube の公式アイコン（形・色は変更しない）
  const YOUTUBE_ICON = '<svg class="youtube-icon" viewBox="0 0 28 20" aria-hidden="true" focusable="false">'
    + '<path fill="#FF0000" d="M27.4 3.1A3.5 3.5 0 0 0 24.9.6C22.7 0 14 0 14 0S5.3 0 3.1.6A3.5 3.5 0 0 0 .6 3.1C0 5.3 0 10 0 10s0 4.7.6 6.9a3.5 3.5 0 0 0 2.5 2.5C5.3 20 14 20 14 20s8.7 0 10.9-.6a3.5 3.5 0 0 0 2.5-2.5C28 14.7 28 10 28 10s0-4.7-.6-6.9Z"/>'
    + '<path fill="#FFFFFF" d="m11.2 14.3 7.3-4.3-7.3-4.3v8.6Z"/></svg>';

  // 「曲名　作曲者名」（全角スペース区切り）で YouTube を検索するリンク
  function youtubeLink(piece) {
    const query = [piece.title, piece.composer].filter(Boolean).join('\u3000');
    const a = el('a', 'youtube-link');
    a.href = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.title = `YouTubeで「${query}」を検索（新しいタブで開きます）`;
    a.innerHTML = YOUTUBE_ICON;
    a.appendChild(el('span', '', 'YouTubeで探す'));
    const wrap = el('div', 'listen');
    wrap.appendChild(a);
    wrap.appendChild(el('p', 'hint', `「${query}」の検索結果を開きます`));
    return wrap;
  }

  // 検索ページから来たときは、ブラウザの「戻る」と同じ動きにして検索結果の表示を保つ
  try {
    const ref = new URL(document.referrer);
    if (ref.origin === location.origin && /\/(index\.html)?$/.test(ref.pathname)) {
      back.href = ref.href;
      back.addEventListener('click', (e) => {
        e.preventDefault();
        history.back();
      });
    }
  } catch (e) { /* 直接開いた場合は検索ページのトップへ */ }

  function showMessage(message) {
    status.textContent = message;
    status.hidden = false;
  }

  // 「箏 独+3」のように独奏とそれ以外のパートをまとめた行は、表示のときに2行に分ける
  //   独+3 → 独奏 1パート ＋ 3パート、独2+2 → 独奏 2パート ＋ 2パート、独+n・独+合奏 → 独奏 1パート ＋ パート数不明
  //   かっこ書き：独(Sop.)+3 の (Sop.) は独奏の行、独+1(AB) の (AB) は独奏以外の行、(各AB) は両方の行に付ける
  const SOLO_PATTERN = /独(\d*)(?:[(（]([^)）]*)[)）])?\+(\d+|[nｎ]|合奏)(?:[(（]([^)）]*)[)）])?\s*$/;
  function splitSolo(entry) {
    const m = entry.solo && entry.notation.match(SOLO_PATTERN);
    if (!m) return [entry];
    const soloParts = m[1] ? Number(m[1]) : 1;
    const restParts = /^\d+$/.test(m[3]) ? Number(m[3]) : null;
    // パート数の合計がデータと合わないときは分けない
    if (entry.parts && restParts !== null && soloParts + restParts !== entry.parts) return [entry];
    const trailing = m[4] || '';
    const both = trailing.startsWith('各');
    return [
      Object.assign({}, entry, { parts: soloParts, notation: m[2] || (both ? trailing.slice(1) : ''), group: 'solo' }),
      Object.assign({}, entry, {
        parts: restParts,
        solo: false,
        notation: [m[3] === '合奏' ? '合奏' : '', both ? trailing.slice(1) : trailing].filter(Boolean).join(' '),
        group: 'rest',
      }),
    ];
  }

  function render(INSTRUMENTS, piece) {
    document.title = `${piece.title} | 楽曲検索`;
    status.hidden = true;

    const article = el('article', 'panel detail-body');

    const top = el('div', 'card-top');
    top.appendChild(piece.category ? categoryBadge(piece.category) : el('span'));
    article.appendChild(top);

    const title = el('h1', 'detail-title', piece.title);
    article.appendChild(title);
    if (piece.subtitle) article.appendChild(el('p', 'detail-subtitle', piece.subtitle));
    if (piece.reading) article.appendChild(el('p', 'detail-reading', piece.reading));

    // 基本情報（札のように並べる）
    const known = piece.instruments.length > 0 && piece.instruments.every((i) => i.parts);
    const players = known ? piece.instruments.reduce((sum, i) => sum + i.parts, 0) : null;
    const year = piece.yearLabel || (piece.year ? String(piece.year) : '');
    // 数字を大きく、単位を小さく
    const withUnit = (value, unit) => {
      const span = el('span', '', value);
      span.appendChild(el('span', 'fact-unit', unit));
      return span;
    };
    const composer = piece.composer ? link(piece.composer, searchUrl({ composer: piece.composer })) : el('span', 'fact-none', '記載なし');
    const facts = [
      { label: '作曲者', value: composer, note: piece.composerReading, wide: true },
      { label: '編曲者', value: piece.arranger, wide: true },
      { label: '分類', value: piece.category },
      { label: '作曲年', value: year ? withUnit(year, '年') : el('span', 'fact-none', '不明') },
      players
        ? { label: 'パート数', value: withUnit(String(players), 'パート') }
        : { label: 'パート数', value: piece.instruments.length ? el('span', 'fact-none', '不明') : '', note: 'パート数の記載がない楽器があります' },
    ].filter((f) => f.value);
    // 編曲者がいるときは、1段目に作曲者・編曲者、2段目に残りの3つを並べる
    const dl = el('dl', piece.arranger ? 'detail-facts has-arranger' : 'detail-facts');
    facts.forEach((f) => {
      const item = el('div', f.wide ? 'fact fact-wide' : 'fact');
      item.appendChild(el('dt', '', f.label));
      const dd = el('dd');
      dd.append(f.value);
      item.appendChild(dd);
      if (f.note) item.appendChild(el('dd', 'fact-note', f.note));
      dl.appendChild(item);
    });
    article.appendChild(dl);
    article.appendChild(youtubeLink(piece));

    // 楽器編成
    const section = el('section', 'detail-section');
    section.appendChild(el('h2', '', '楽器編成'));
    if (piece.instruments.length) {
      const wrap = el('div', 'table-wrap');
      const table = el('table', 'instrument-table');
      const head = el('tr');
      ['楽器', 'パート数', '', '表記'].forEach((h) => head.appendChild(el('th', '', h)));
      table.appendChild(el('thead')).appendChild(head);
      const body = el('tbody');
      piece.instruments.flatMap(splitSolo).forEach((entry) => {
        const inst = INSTRUMENTS[entry.key] || { label: entry.key };
        const tr = el('tr', entry.group ? `is-${entry.group}` : '');
        const name = el('td');
        name.appendChild(link(inst.label, searchUrl({ inst: entry.key })));
        tr.appendChild(name);
        tr.appendChild(el('td', 'num', entry.parts ? `${entry.parts}パート` : '—'));
        const flags = el('td');
        if (entry.solo) flags.appendChild(el('span', 'flag flag-solo', '独奏'));
        if (entry.optional) flags.appendChild(el('span', 'flag', '省略可'));
        tr.appendChild(flags);
        tr.appendChild(el('td', 'notation', entry.notation));
        body.appendChild(tr);
      });
      table.appendChild(body);
      wrap.appendChild(table);
      section.appendChild(wrap);
      section.appendChild(el('p', 'hint', '楽器名を押すと、その楽器を含む曲を検索します。'));
    } else {
      section.appendChild(el('p', 'hint', '楽器編成の記載はありません。'));
    }
    article.appendChild(section);

    if (piece.remarks) {
      const remarks = el('section', 'detail-section');
      remarks.appendChild(el('h2', '', '備考'));
      remarks.appendChild(el('p', '', piece.remarks));
      article.appendChild(remarks);
    }

    // 関連する曲へのリンク
    const related = el('section', 'detail-section');
    related.appendChild(el('h2', '', '関連する曲を探す'));
    const list = el('ul', 'related');
    if (piece.composer) list.appendChild(el('li')).appendChild(link(`${piece.composer} の曲`, searchUrl({ composer: piece.composer })));
    // 楽器ごとのパート数（分かる楽器は数も条件にする）
    const parts = new Map();
    piece.instruments.forEach((i) => {
      const sum = parts.has(i.key) ? parts.get(i.key) : 0;
      parts.set(i.key, sum === null || !i.parts ? null : sum + i.parts);
    });
    if (parts.size) {
      const labels = [...parts].map(([k, n]) => (INSTRUMENTS[k] || { label: k }).label + (n || '')).join('・');
      const inst = [...parts].map(([k, n]) => (n ? `${k}:${n}` : k)).join(',');
      list.appendChild(el('li')).appendChild(link(`同じ編成の曲（${labels}）`, searchUrl({ inst, mode: 'exact' })));
    }
    if (list.children.length) {
      related.appendChild(list);
      article.appendChild(related);
    }

    main.appendChild(article);
  }

  const id = Number(new URLSearchParams(location.search).get('id'));
  if (!Number.isInteger(id) || id <= 0) {
    showMessage('曲が指定されていません。検索結果から曲を選んでください。');
    return;
  }

  loadPiece(id)
    .then(({ instruments, piece }) => {
      if (piece) render(instruments, piece);
      else showMessage('この曲は見つかりませんでした。削除された可能性があります。');
    })
    .catch((error) => {
      console.error(error);
      showMessage('曲の情報を読み込めませんでした。時間をおいて再読み込みしてください。');
    });
})();
