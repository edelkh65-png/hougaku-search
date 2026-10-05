// claude.ai 版だけで使う部品（tools/build-artifact.js がページの最後に埋め込む）
// claude.ai のページは1ファイルなので、曲の詳細を別ページ（piece.html）ではなく同じページ内に表示する。
// runPiece の中の目印（PIECE_JS と書いたコメント）の位置に、piece.js の中身がそのまま入る。
// ---- claude.ai 版：詳細ページを同じページ内で切り替えて表示する ----
(function () {
  const listView = document.querySelector('.layout');
  const detailView = document.getElementById('detail-view');
  const DETAIL_HTML = '<main class="detail" id="detail"><p><a href="#" id="back" class="back-link">検索結果に戻る</a></p>'
    + '<p id="status" class="hint">読み込み中…</p></main>';
  let savedY = 0;

  function showList(y) {
    detailView.hidden = true;
    detailView.replaceChildren();
    listView.hidden = false;
    document.title = '楽曲検索';
    window.scrollTo(0, y === undefined ? savedY : y);
  }

  function showPiece(id) {
    savedY = window.scrollY;
    listView.hidden = true;
    detailView.innerHTML = DETAIL_HTML;
    detailView.hidden = false;
    window.scrollTo(0, 0);
    runPiece(id);
  }

  // 本番の piece.js をそのまま動かす（URL と「戻る」だけをこのページ用に差し替え）
  function runPiece(id) {
    const location = { search: `?id=${id}`, origin: '', href: '' };
    const history = { back: () => showList() };
    /* PIECE_JS */
  }

  // 詳細ページのリンク（作曲者・楽器・同じ編成）は、検索条件に入れて一覧に戻る
  function applySearch(params) {
    showList(0);
    document.getElementById('reset-button').click();
    const form = document.getElementById('search-form');
    if (params.get('q')) document.getElementById('q').value = params.get('q');
    // inst=koto:2,shakuhachi:1 → 楽器を選び、＋を押してパート数を合わせる
    (params.get('inst') || '').split(',').filter(Boolean).forEach((item) => {
      const [k, n] = item.split(':');
      const wrap = document.querySelector(`.chip-wrap[data-key="${k}"]`);
      if (!wrap) return;
      const chip = wrap.querySelector('.chip');
      if (chip.getAttribute('aria-pressed') !== 'true') chip.click();
      const count = parseInt(n, 10) || 0;
      for (let i = 0; i < count; i++) wrap.querySelector('[data-step="1"]').click();
    });
    if (params.get('cmp') === 'gte') form.elements.cmp.value = 'gte';
    if (params.get('mode') === 'exact') form.elements.mode.value = 'exact';
    // 作曲者：入力欄に名前を入れ、候補から同じ名前を選ぶ
    if (params.get('composer')) {
      const name = params.get('composer');
      const input = document.getElementById('composer-input');
      input.value = name;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      const option = [...document.querySelectorAll('#composer-list .combo-option')]
        .find((o) => o.querySelector('.combo-name').textContent === name);
      if (option) option.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    }
    if (['inst', 'composer'].some((k) => params.get(k))) document.getElementById('advanced').open = true;
    document.getElementById('q').dispatchEvent(new Event('input', { bubbles: true }));
  }

  document.addEventListener('click', (e) => {
    const card = e.target.closest('.card-link');
    if (card) {
      e.preventDefault();
      showPiece(Number(new URL(card.getAttribute('href'), 'https://example.invalid/').searchParams.get('id')));
      return;
    }
    const a = e.target.closest('#detail-view a');
    if (!a) return;
    // YouTube などの外部リンクは、そのまま新しいタブで開く
    if (/^https?:/.test(a.getAttribute('href') || '')) return;
    e.preventDefault();
    if (a.id === 'back') { showList(); return; }
    const href = a.getAttribute('href') || '';
    if (href.startsWith('index.html')) applySearch(new URLSearchParams(href.split('?')[1] || ''));
  });
})();

