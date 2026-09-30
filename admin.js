(function () {
  'use strict';

  const config = window.MUSIC_DB || {};
  const SESSION_KEY = 'music-admin-session';

  const $ = (id) => document.getElementById(id);
  const els = {
    notice: $('notice'),
    loginSection: $('login-section'),
    loginForm: $('login-form'),
    loginError: $('login-error'),
    editorSection: $('editor-section'),
    accountEmail: $('account-email'),
    logout: $('logout'),
    form: $('piece-form'),
    rows: $('instrument-rows'),
    addInstrument: $('add-instrument'),
    formError: $('form-error'),
    duplicate: $('duplicate-warning'),
    save: $('save'),
    clear: $('clear'),
    recent: $('recent'),
    composerList: $('composer-list'),
    categoryList: $('category-list'),
    rowTemplate: $('instrument-row'),
  };

  let session = readSession();
  let instruments = [];
  let confirmedDuplicate = false;

  // ---- 共通 ----
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function showNotice(message, kind, link) {
    els.notice.replaceChildren(document.createTextNode(message));
    if (link) {
      const a = el('a', '', link.text);
      a.href = link.href;
      els.notice.append(' ', a);
    }
    els.notice.className = `notice notice-${kind}`;
    els.notice.hidden = false;
  }

  function showError(target, message) {
    target.textContent = message;
    target.hidden = !message;
  }

  function readSession() {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)); } catch (e) { return null; }
  }

  function saveSession(value) {
    session = value;
    try {
      if (value) sessionStorage.setItem(SESSION_KEY, JSON.stringify(value));
      else sessionStorage.removeItem(SESSION_KEY);
    } catch (e) { /* 保存できなくても、このタブを開いている間はログインしたまま使える */ }
  }

  // ---- Supabase との通信 ----
  const baseUrl = (config.url || '').replace(/\/+$/, '');

  class ApiError extends Error {
    constructor(message, status, data) {
      super(message);
      this.status = status;
      this.data = data;
    }
  }

  async function send(path, { method = 'GET', body, token, headers = {} } = {}) {
    const h = Object.assign({ apikey: config.key }, headers);
    if (body !== undefined) h['Content-Type'] = 'application/json';
    if (token) h.Authorization = `Bearer ${token}`;
    const res = await fetch(baseUrl + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
    if (!res.ok) {
      const message = (data && (data.message || data.msg || data.error_description || data.error)) || `エラー（${res.status}）`;
      throw new ApiError(message, res.status, data);
    }
    return data;
  }

  function toSession(data) {
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at || Math.floor(Date.now() / 1000) + data.expires_in,
      email: data.user && data.user.email,
    };
  }

  async function login(email, password) {
    const data = await send('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } });
    saveSession(toSession(data));
  }

  // ログインの有効期限（通常1時間）が近ければ更新する
  async function accessToken() {
    if (!session) throw new ApiError('ログインしてください', 401);
    if (session.expires_at - 60 > Date.now() / 1000) return session.access_token;
    try {
      const data = await send('/auth/v1/token?grant_type=refresh_token', {
        method: 'POST', body: { refresh_token: session.refresh_token },
      });
      saveSession(Object.assign(toSession(data), { email: session.email }));
      return session.access_token;
    } catch (e) {
      throw new ApiError('ログインの有効期限が切れました。もう一度ログインしてください。', 401);
    }
  }

  async function api(path, options = {}) {
    try {
      return await send(`/rest/v1/${path}`, Object.assign({}, options, { token: await accessToken() }));
    } catch (e) {
      if (e.status === 401) {
        saveSession(null);
        showLogin(e.message.includes('ログイン') ? e.message : 'ログインの有効期限が切れました。もう一度ログインしてください。');
      }
      throw e;
    }
  }

  // ---- 画面の切り替え ----
  function showLogin(message) {
    els.editorSection.hidden = true;
    els.loginSection.hidden = false;
    showError(els.loginError, message || '');
  }

  async function showEditor() {
    els.loginSection.hidden = true;
    els.accountEmail.textContent = session.email ? `${session.email} でログイン中` : 'ログイン中';

    const editor = await api('editors?select=user_id');
    if (!editor.length) {
      els.editorSection.hidden = false;
      els.form.hidden = true;
      els.recent.closest('.panel').hidden = true;
      showNotice('このアカウントには登録の権限がありません。管理者に登録担当者（editors）への追加を依頼してください。', 'error');
      return;
    }

    const [instrumentRows, composerRows, categoryRows] = await Promise.all([
      api('instruments?select=key,label,family&order=sort_order,id'),
      api('composers?select=name&order=name'),
      api('pieces?select=category&category=not.is.null&limit=10000'),
    ]);
    instruments = instrumentRows;
    fillDatalist(els.composerList, composerRows.map((r) => r.name));
    fillDatalist(els.categoryList, [...new Set(categoryRows.map((r) => r.category))]);

    els.form.hidden = false;
    els.recent.closest('.panel').hidden = false;
    els.editorSection.hidden = false;
    if (!els.rows.children.length) addInstrumentRow();
    loadRecent();
  }

  function fillDatalist(list, values) {
    const collator = new Intl.Collator('ja');
    list.replaceChildren(...values.sort(collator.compare).map((v) => new Option(v)));
  }

  // ---- 楽器編成の入力行 ----
  function addInstrumentRow() {
    const row = els.rowTemplate.content.firstElementChild.cloneNode(true);
    const select = row.querySelector('select');
    select.add(new Option('楽器を選択', ''));
    FAMILIES.forEach((family) => {
      const group = document.createElement('optgroup');
      group.label = family.label;
      instruments.filter((i) => i.family === family.key).forEach((i) => group.appendChild(new Option(i.label, i.key)));
      if (group.children.length) select.appendChild(group);
    });
    els.rows.appendChild(row);
    return row;
  }

  els.addInstrument.addEventListener('click', () => addInstrumentRow().querySelector('select').focus());
  els.rows.addEventListener('click', (e) => {
    if (e.target.closest('.remove')) e.target.closest('.instrument-row').remove();
  });

  // ---- 入力の読み取りと確認 ----
  function readForm() {
    const f = els.form.elements;
    const value = (name) => f[name].value.trim();
    const piece = {
      title: value('title'),
      reading: value('reading'),
      subtitle: value('subtitle'),
      category: value('category'),
      composer: value('composer'),
      arranger: value('arranger'),
      remarks: value('remarks'),
      year: null,
      year_label: '',
      instruments: [],
    };

    if (!piece.title) return { error: '曲名を入力してください。', focus: f.title };
    if (!piece.reading) return { error: 'よみがなを入力してください。', focus: f.reading };

    const yearText = value('year');
    if (yearText) {
      const m = yearText.match(/\d{4}/);
      if (!m) return { error: '作曲年は4桁の数字を含めて入力してください（例：1985、2020-22）。', focus: f.year };
      piece.year = Number(m[0]);
      piece.year_label = yearText === m[0] ? '' : yearText;
    }

    for (const row of els.rows.querySelectorAll('.instrument-row')) {
      const key = row.querySelector('[name="key"]').value;
      const partsInput = row.querySelector('[name="parts"]');
      const notation = row.querySelector('[name="notation"]').value.trim();
      if (!key) {
        if (partsInput.value || notation) return { error: '楽器を選んでください（不要な行は × で削除できます）。', focus: row.querySelector('select') };
        continue;
      }
      const parts = partsInput.value ? Number(partsInput.value) : null;
      if (parts !== null && !(Number.isInteger(parts) && parts > 0)) {
        return { error: '人数は1以上の整数で入力してください（分からない場合は空欄）。', focus: partsInput };
      }
      piece.instruments.push({
        key,
        parts,
        solo: row.querySelector('[name="solo"]').checked,
        optional: row.querySelector('[name="optional"]').checked,
        notation,
      });
    }
    return { piece };
  }

  async function findDuplicates(piece) {
    const rows = await api(`pieces?select=title,subtitle,composer:composers(name)&title=eq.${encodeURIComponent(piece.title)}`);
    return rows.map((r) => [r.title, r.subtitle && `（${r.subtitle}）`, r.composer && `／${r.composer.name}`].filter(Boolean).join(''));
  }

  // ---- 登録 ----
  els.form.addEventListener('input', () => {
    confirmedDuplicate = false;
    els.duplicate.hidden = true;
  });

  els.form.addEventListener('submit', async (e) => {
    e.preventDefault();
    showError(els.formError, '');
    const { piece, error, focus } = readForm();
    if (error) {
      showError(els.formError, error);
      focus.focus();
      return;
    }

    els.save.disabled = true;
    els.save.textContent = '登録中…';
    try {
      if (!confirmedDuplicate) {
        const duplicates = await findDuplicates(piece);
        if (duplicates.length) {
          els.duplicate.replaceChildren(
            el('p', '', `同じ曲名の曲がすでに${duplicates.length}件登録されています：${duplicates.join('、')}`),
            el('p', '', '別の曲であれば、もう一度「登録する」を押すと登録します。'),
          );
          els.duplicate.hidden = false;
          confirmedDuplicate = true;
          return;
        }
      }

      await api('rpc/add_piece', { method: 'POST', body: { piece } });
      showNotice(`「${piece.title}」を登録しました。`, 'success',
        { text: '検索ページで確認する', href: `index.html?q=${encodeURIComponent(piece.title)}` });
      if (piece.composer && ![...els.composerList.options].some((o) => o.value === piece.composer)) {
        els.composerList.appendChild(new Option(piece.composer));
      }
      if (piece.category && ![...els.categoryList.options].some((o) => o.value === piece.category)) {
        els.categoryList.appendChild(new Option(piece.category));
      }
      clearForm();
      loadRecent();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      if (err.status !== 401) showError(els.formError, `登録できませんでした：${err.message}`);
    } finally {
      els.save.disabled = false;
      els.save.textContent = '登録する';
    }
  });

  function clearForm() {
    els.form.reset();
    els.rows.replaceChildren();
    addInstrumentRow();
    confirmedDuplicate = false;
    els.duplicate.hidden = true;
    showError(els.formError, '');
  }
  els.clear.addEventListener('click', clearForm);

  // ---- 最近登録した曲 ----
  async function loadRecent() {
    try {
      const rows = await api('pieces?select=id,title,subtitle,composer:composers(name),piece_instruments(count)&order=id.desc&limit=10');
      els.recent.replaceChildren(...rows.map(renderRecent));
    } catch (e) {
      if (e.status !== 401) els.recent.replaceChildren(el('li', 'hint', `読み込めませんでした：${e.message}`));
    }
  }

  function renderRecent(row) {
    const li = el('li', 'recent-item');
    const info = el('div', 'recent-info');
    const title = el('strong', '', row.title);
    if (row.subtitle) title.appendChild(el('span', 'hint', ` ${row.subtitle}`));
    info.appendChild(title);
    const count = row.piece_instruments[0] ? row.piece_instruments[0].count : 0;
    info.appendChild(el('span', 'hint', [row.composer && row.composer.name, `楽器${count}件`].filter(Boolean).join('・')));
    li.appendChild(info);

    const del = el('button', 'danger-button', '削除');
    del.type = 'button';
    const cancel = el('button', 'link-button', 'やめる');
    cancel.type = 'button';
    cancel.hidden = true;

    del.addEventListener('click', async () => {
      if (!del.classList.contains('is-confirming')) {
        del.classList.add('is-confirming');
        del.textContent = '本当に削除する';
        cancel.hidden = false;
        return;
      }
      del.disabled = true;
      try {
        const deleted = await api(`pieces?id=eq.${row.id}`, { method: 'DELETE', headers: { Prefer: 'return=representation' } });
        if (!deleted.length) throw new Error('削除する権限がありません');
        showNotice(`「${row.title}」を削除しました。`, 'success');
        loadRecent();
      } catch (e) {
        del.disabled = false;
        if (e.status !== 401) showNotice(`削除できませんでした：${e.message}`, 'error');
      }
    });
    cancel.addEventListener('click', () => {
      del.classList.remove('is-confirming');
      del.textContent = '削除';
      cancel.hidden = true;
    });

    const buttons = el('div', 'recent-actions');
    buttons.append(cancel, del);
    li.appendChild(buttons);
    return li;
  }

  // ---- ログイン・ログアウト ----
  els.loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const button = els.loginForm.querySelector('button');
    button.disabled = true;
    showError(els.loginError, '');
    try {
      await login(els.loginForm.elements.email.value.trim(), els.loginForm.elements.password.value);
      els.loginForm.reset();
      await showEditor();
    } catch (err) {
      const invalid = err.status === 400 || (err.data && err.data.error_code === 'invalid_credentials');
      showError(els.loginError, invalid ? 'メールアドレスかパスワードが違います。' : `ログインできませんでした：${err.message}`);
    } finally {
      button.disabled = false;
    }
  });

  els.logout.addEventListener('click', () => {
    if (session) send('/auth/v1/logout', { method: 'POST', token: session.access_token }).catch(() => {});
    saveSession(null);
    els.notice.hidden = true;
    showLogin();
  });

  // ---- 起動 ----
  if (!config.url || !config.key) {
    showNotice('Supabase の接続設定（config.js）がないため、登録ページは使えません。', 'error');
    return;
  }
  if (session) {
    showEditor().catch((e) => {
      if (e.status !== 401) showNotice(`読み込めませんでした：${e.message}`, 'error');
    });
  } else {
    showLogin();
  }
})();
