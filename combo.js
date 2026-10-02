// 作曲者の入力欄（よみ・名前を入力すると候補を出して選ぶ）。検索ページと登録ページで共通
//
// createComposerPicker(elements, options)
//   elements: { input, list, selected, clear }
//     selected の中に .combo-name と .combo-read を置く
//   options:
//     composers   … [{ name, reading, count }]（count は省略可）
//     extraOption … 未入力のときに出す選択肢 { name, value, count, className }（例：作曲者の記載なし）
//     allowNew    … true なら、入力した名前を「新しい作曲者」として選べる
//     onChange(value, choice) … 選んだとき・解除したとき（解除は value が ''、choice が null）
//   戻り値: { setValue(value, notify), setComposers(list), pendingText() }

// カタカナはひらがなに、全角英数は半角に、空白は取り除く
function toKana(text) {
  return String(text).normalize('NFKC').replace(/\s+/g, '')
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

function createComposerPicker(elements, options) {
  const { input, list, selected, clear } = elements;
  const collator = new Intl.Collator('ja');
  let composers = options.composers || [];
  let choices = [];
  let active = -1;

  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  // 読みの五十音順（読みがない作曲者は名前で並べる）
  const byKey = (x, y) => collator.compare(x.reading || x.name, y.reading || y.name) || collator.compare(x.name, y.name);

  // よみは先頭一致、名前は途中一致。よみで当たった作曲者を先に、それぞれ五十音順
  function find(text) {
    const q = toKana(text);
    if (!q) return [];
    const byReading = composers.filter((c) => c.reading && c.reading.startsWith(q)).sort(byKey);
    const byName = composers.filter((c) => !byReading.includes(c) && toKana(c.name).includes(q)).sort(byKey);
    return [...byReading, ...byName].map((c) => Object.assign({ value: c.name, match: byReading.includes(c) ? q.length : 0 }, c));
  }

  function render() {
    const text = input.value.trim();
    list.replaceChildren();
    choices = [];
    if (!toKana(text)) {
      list.appendChild(make('p', 'combo-note', options.allowNew
        ? 'よみ（ひらがな）か名前を入力すると候補が出ます。新しい作曲者は名前を入力してください'
        : 'よみ（ひらがな）か名前を入力すると候補が出ます'));
      if (options.extraOption) choices = [Object.assign({ reading: '', match: 0 }, options.extraOption)];
    } else {
      choices = find(text);
      const exists = composers.some((c) => c.name === text);
      if (!choices.length) {
        list.appendChild(make('p', 'combo-empty', options.allowNew
          ? `「${text}」は登録済みの作曲者に見つかりませんでした`
          : `「${text}」に当てはまる作曲者は見つかりませんでした`));
      }
      if (options.allowNew && !exists) {
        choices.push({ name: text, value: text, reading: '', match: 0, isNew: true, className: 'is-new' });
      }
    }
    choices.forEach((c, i) => {
      const opt = make('div', 'combo-option' + (c.className ? ` ${c.className}` : ''));
      opt.id = `${input.id}-option-${i}`;
      opt.setAttribute('role', 'option');
      opt.dataset.index = String(i);
      opt.appendChild(make('span', 'combo-name', c.isNew ? `「${c.name}」を新しい作曲者として登録` : c.name));
      const read = make('span', 'combo-read');
      if (c.match) read.appendChild(make('mark', '', c.reading.slice(0, c.match)));
      read.append(c.reading.slice(c.match));
      opt.appendChild(read);
      if (c.count !== undefined) opt.appendChild(make('span', 'combo-count', `${c.count}曲`));
      list.appendChild(opt);
    });
    // 最初はどの候補も選ばない（Enter で決まるのは ↑↓ で選んだときだけ）
    setActive(-1);
  }

  function setActive(i) {
    active = i;
    list.querySelectorAll('.combo-option').forEach((opt, n) => {
      opt.classList.toggle('is-active', n === i);
      opt.setAttribute('aria-selected', String(n === i));
      if (n === i) opt.scrollIntoView({ block: 'nearest' });
    });
    if (i >= 0) input.setAttribute('aria-activedescendant', `${input.id}-option-${i}`);
    else input.removeAttribute('aria-activedescendant');
  }

  function open() {
    render();
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }

  function close() {
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    setActive(-1);
  }

  // 値から表示用の情報を探す（登録済み → 追加の選択肢 → それ以外は名前だけ）
  function describe(value) {
    return composers.find((c) => c.name === value)
      || (options.extraOption && options.extraOption.value === value ? options.extraOption : null)
      || { name: value, reading: '' };
  }

  function show(value, choice) {
    const on = Boolean(value);
    selected.hidden = !on;
    input.hidden = on;
    if (on) {
      const c = choice || describe(value);
      selected.querySelector('.combo-name').textContent = c.name;
      selected.querySelector('.combo-read').textContent = c.isNew ? '新しい作曲者' : c.reading || '';
      selected.classList.toggle('is-new', Boolean(c.isNew));
    }
    input.value = '';
    close();
  }

  function choose(choice) {
    show(choice.value, choice);
    options.onChange(choice.value, choice);
  }

  // 入力中はページ側の処理を動かさない（作曲者を決めたときだけ onChange）
  input.addEventListener('input', (e) => {
    e.stopPropagation();
    open();
  });
  input.addEventListener('focus', open);
  input.addEventListener('blur', close);

  // 日本語入力の変換中・変換を確定した直後のキー操作は、候補の操作として扱わない
  //   isComposing：Chrome・Firefox など／keyCode 229：Safari など（確定の Enter が変換後に届く）
  let compositionEndedAt = 0;
  input.addEventListener('compositionend', () => { compositionEndedAt = Date.now(); });
  const isImeKey = (e) => e.isComposing || e.keyCode === 229 || Date.now() - compositionEndedAt < 50;

  input.addEventListener('keydown', (e) => {
    if (isImeKey(e)) return;
    const n = choices.length;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (list.hidden) open();
      if (!n) return;
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive(active < 0 ? (step > 0 ? 0 : n - 1) : (active + step + n) % n);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (active >= 0) choose(choices[active]);
    } else if (e.key === 'Escape') {
      close();
    }
  });
  // mousedown で決める（クリックで入力欄からフォーカスが外れて一覧が閉じる前に）
  list.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const opt = e.target.closest('.combo-option');
    if (opt) choose(choices[Number(opt.dataset.index)]);
  });
  clear.addEventListener('click', () => {
    show('');
    options.onChange('', null);
    input.focus();
  });

  return {
    // 値を外から設定する（notify が true なら onChange も呼ぶ）
    setValue(value, notify = false) {
      show(value);
      if (notify) options.onChange(value, value ? describe(value) : null);
    },
    setComposers(next) {
      composers = next;
      if (!list.hidden) render();
    },
    // 入力したまま、まだ候補を選んでいない文字
    pendingText() {
      return input.hidden ? '' : input.value.trim();
    },
  };
}
