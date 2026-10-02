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

  function link(text, href) {
    const a = el('a', '', text);
    a.href = href;
    return a;
  }

  const searchUrl = (params) => `index.html?${new URLSearchParams(params)}`;

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

  function render(INSTRUMENTS, piece) {
    document.title = `${piece.title} | 楽曲検索`;
    status.hidden = true;

    const article = el('article', 'panel detail-body');

    const top = el('div', 'card-top');
    top.appendChild(piece.category ? el('span', 'badge', piece.category) : el('span'));
    article.appendChild(top);

    const title = el('h1', 'detail-title', piece.title);
    article.appendChild(title);
    if (piece.subtitle) article.appendChild(el('p', 'detail-subtitle', piece.subtitle));
    if (piece.reading) article.appendChild(el('p', 'detail-reading', piece.reading));

    // 基本情報
    const known = piece.instruments.length > 0 && piece.instruments.every((i) => i.parts);
    const players = known ? piece.instruments.reduce((sum, i) => sum + i.parts, 0) : null;
    const year = piece.yearLabel || (piece.year ? String(piece.year) : '');
    const rows = [
      ['作曲者', piece.composer ? link(piece.composer, searchUrl({ composer: piece.composer })) : '記載なし'],
      ['編曲者', piece.arranger],
      ['分類', piece.category ? link(piece.category, searchUrl({ category: piece.category })) : ''],
      ['作曲年', year && `${year}年`],
      ['パート数', players ? `${players}パート` : (piece.instruments.length ? '不明（パート数の記載がない楽器があります）' : '')],
    ].filter(([, value]) => value);
    const dl = el('dl', 'detail-info');
    rows.forEach(([label, value]) => {
      dl.appendChild(el('dt', '', label));
      const dd = el('dd');
      dd.append(value);
      dl.appendChild(dd);
    });
    article.appendChild(dl);

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
      piece.instruments.forEach((entry) => {
        const inst = INSTRUMENTS[entry.key] || { label: entry.key };
        const tr = el('tr');
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
    const keys = [...new Set(piece.instruments.map((i) => i.key))];
    if (keys.length) {
      const labels = keys.map((k) => (INSTRUMENTS[k] || { label: k }).label).join('・');
      list.appendChild(el('li')).appendChild(link(`同じ編成の曲（${labels}）`, searchUrl({ inst: keys.join(','), mode: 'exact' })));
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
