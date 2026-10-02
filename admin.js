(function () {
  'use strict';

  const config = window.MUSIC_DB || {};
  const SESSION_KEY = 'music-admin-session';
  // Supabase の Authentication の設定（最低文字数・英字と数字）と合わせる
  const MIN_PASSWORD_LENGTH = 8;

  const $ = (id) => document.getElementById(id);
  const els = {
    notice: $('notice'),
    loginSection: $('login-section'),
    loginForm: $('login-form'),
    loginError: $('login-error'),
    showRecover: $('show-recover'),
    recoverSection: $('recover-section'),
    recoverForm: $('recover-form'),
    recoverError: $('recover-error'),
    backToLogin: $('back-to-login'),
    passwordSection: $('password-section'),
    passwordLead: $('password-lead'),
    passwordForm: $('password-form'),
    passwordError: $('password-error'),
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
    composer: $('composer'),
    composerInput: $('composer-input'),
    composerList: $('composer-list'),
    composerSelected: $('composer-selected'),
    composerClear: $('composer-clear'),
    composerReading: $('composer-reading'),
    composerReadingHint: $('composer-reading-hint'),
    composerReadingRequired: $('composer-reading-required'),
    categoryList: $('category-list'),
    rowTemplate: $('instrument-row'),
  };

  let session = readSession();
  let instruments = [];
  let composers = new Map(); // 作曲者名 → よみがな（未登録は ''）
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
  function showSection(section) {
    [els.loginSection, els.recoverSection, els.passwordSection, els.editorSection].forEach((s) => {
      s.hidden = s !== section;
    });
  }

  function showLogin(message) {
    showSection(els.loginSection);
    showError(els.loginError, message || '');
  }

  function showPasswordForm(kind) {
    els.passwordLead.textContent = kind === 'invite'
      ? '登録担当者として招待されました。パスワードを決めてください。次回からはメールアドレスとこのパスワードでログインします。'
      : '新しいパスワードを決めてください。次回からはメールアドレスとこのパスワードでログインします。';
    els.passwordForm.elements.username.value = session.email || '';
    showError(els.passwordError, '');
    showSection(els.passwordSection);
    els.passwordForm.elements.password.focus();
  }

  async function showEditor() {
    showSection(null);
    els.accountEmail.textContent = session.email ? `${session.email} でログイン中` : 'ログイン中';

    const editor = await api('editors?select=user_id');
    if (!editor.length) {
      showSection(els.editorSection);
      els.form.hidden = true;
      els.recent.closest('.panel').hidden = true;
      showNotice('このアカウントには登録の権限がありません。管理者に登録担当者（editors）への追加を依頼してください。', 'error');
      return;
    }

    const [instrumentRows, composerRows, categoryRows] = await Promise.all([
      api('instruments?select=key,label,family&order=sort_order,id'),
      api('composers?select=name,reading&order=name'),
      api('pieces?select=category&category=not.is.null&limit=10000'),
    ]);
    instruments = instrumentRows;
    composers = new Map(composerRows.map((r) => [r.name, r.reading || '']));
    composerPicker.setComposers(composerList());
    syncComposerReading();
    fillDatalist(els.categoryList, [...new Set(categoryRows.map((r) => r.category))]);

    els.form.hidden = false;
    els.recent.closest('.panel').hidden = false;
    showSection(els.editorSection);
    if (!els.rows.children.length) addInstrumentRow();
    loadRecent();
  }

  function fillDatalist(list, values) {
    const collator = new Intl.Collator('ja');
    list.replaceChildren(...values.sort(collator.compare).map((v) => new Option(v)));
  }

  // ---- 作曲者（よみ・名前で候補を出して選ぶ。部品は combo.js） ----
  // 登録済みの作曲者に加えて、入力した名前を「新しい作曲者」として選べる
  const composerList = () => [...composers].map(([name, reading]) => ({ name, reading }));
  const composerPicker = createComposerPicker({
    input: els.composerInput,
    list: els.composerList,
    selected: els.composerSelected,
    clear: els.composerClear,
  }, {
    composers: [],
    allowNew: true,
    onChange: (value) => {
      els.composer.value = value;
      syncComposerReading();
      confirmedDuplicate = false;
      els.duplicate.hidden = true;
    },
  });

  // ---- 作曲者のよみがな ----

  // 作曲者の入力に合わせて、よみがな欄の状態を切り替える
  //   登録済みでよみがなあり → 自動で表示して変更不可
  //   登録済みでよみがななし／新しい作曲者 → 入力必須
  function syncComposerReading() {
    const input = els.composerReading;
    const name = els.composer.value;
    const known = composers.has(name);
    const registered = known ? composers.get(name) : '';
    if (input.dataset.auto === '1' && !(known && registered)) input.value = '';

    let hint;
    if (!name) {
      input.value = '';
      hint = '作曲者を選ぶと入力できます';
    } else if (registered) {
      input.value = registered;
      input.dataset.auto = '1';
      hint = '登録済みの作曲者です（よみがなは変更できません）';
    } else if (known) {
      hint = 'よみがなが未登録の作曲者です。入力すると登録されます';
    } else {
      hint = '新しい作曲者として登録されます';
    }
    if (!(known && registered)) input.dataset.auto = '';
    input.disabled = !name;
    input.readOnly = Boolean(registered);
    els.composerReadingRequired.hidden = !name || Boolean(registered);
    els.composerReadingHint.textContent = hint;
  }

  els.composerReading.addEventListener('input', () => { els.composerReading.dataset.auto = ''; });
  els.composerReading.addEventListener('change', () => {
    els.composerReading.value = toKana(els.composerReading.value);
  });

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

    // 作曲者欄に入力したまま候補を選んでいない
    if (composerPicker.pendingText()) {
      return { error: '作曲者は候補から選んでください（新しい作曲者は「〜を新しい作曲者として登録」を選びます）。', focus: els.composerInput };
    }

    if (piece.composer) {
      const reading = toKana(els.composerReading.value);
      els.composerReading.value = reading;
      if (!reading) return { error: '作曲者のよみがなを入力してください。', focus: els.composerReading };
      if (!/^[\u3041-\u3096\u309d\u309eー・]+$/.test(reading)) {
        return { error: '作曲者のよみがなは、ひらがなで入力してください。', focus: els.composerReading };
      }
      piece.composer_reading = reading;
    }

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
      if (piece.composer && !composers.get(piece.composer)) {
        composers.set(piece.composer, piece.composer_reading);
        composerPicker.setComposers(composerList());
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
    els.composer.value = '';
    composerPicker.setValue('');
    syncComposerReading();
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

  // ---- パスワードの再設定（メールでリンクを送る） ----
  els.showRecover.addEventListener('click', () => {
    els.recoverForm.elements.email.value = els.loginForm.elements.email.value.trim();
    showError(els.recoverError, '');
    els.notice.hidden = true;
    showSection(els.recoverSection);
    els.recoverForm.elements.email.focus();
  });
  els.backToLogin.addEventListener('click', () => showLogin());

  els.recoverForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const button = els.recoverForm.querySelector('button[type="submit"]');
    const email = els.recoverForm.elements.email.value.trim();
    button.disabled = true;
    showError(els.recoverError, '');
    try {
      // メールのリンクからこのページに戻ってくるようにする（Supabase の Redirect URLs に登録が必要）
      const redirect = location.origin + location.pathname;
      await send(`/auth/v1/recover?redirect_to=${encodeURIComponent(redirect)}`, { method: 'POST', body: { email } });
      els.loginForm.elements.email.value = email;
      showLogin();
      showNotice(`${email} にパスワード再設定のメールを送りました（登録担当者のアドレスの場合のみ届きます）。メールのリンクを開いて、新しいパスワードを設定してください。`, 'success');
    } catch (err) {
      showError(els.recoverError, err.status === 429
        ? 'メールの送信回数の上限に達しました。しばらく時間をおいてから、もう一度お試しください。'
        : `メールを送れませんでした：${err.message}`);
    } finally {
      button.disabled = false;
    }
  });

  // ---- パスワードの設定（招待・再設定のリンクから開いたとき） ----
  els.passwordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = els.passwordForm.elements;
    const button = els.passwordForm.querySelector('button[type="submit"]');
    showError(els.passwordError, '');
    const password = f.password.value;
    if (password.length < MIN_PASSWORD_LENGTH || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      showError(els.passwordError, `パスワードは${MIN_PASSWORD_LENGTH}文字以上で、英字と数字を両方含めてください。`);
      f.password.focus();
      return;
    }
    if (f.password.value !== f.confirm.value) {
      showError(els.passwordError, '確認のパスワードが一致しません。');
      f.confirm.focus();
      return;
    }
    button.disabled = true;
    try {
      await send('/auth/v1/user', { method: 'PUT', body: { password: f.password.value }, token: await accessToken() });
      saveSession(Object.assign({}, session, { mustSetPassword: false }));
      els.passwordForm.reset();
      showNotice('パスワードを設定しました。次回からはメールアドレスとこのパスワードでログインできます。', 'success');
      await showEditor();
    } catch (err) {
      if (err.status === 401) {
        saveSession(null);
        showLogin('リンクの有効期限が切れました。もう一度、招待またはパスワード再設定のメールを送ってもらってください。');
        return;
      }
      const code = err.data && err.data.error_code;
      showError(els.passwordError,
        code === 'same_password' ? '今までと同じパスワードは使えません。別のパスワードにしてください。'
          : code === 'weak_password' ? 'パスワードが簡単すぎます。もっと長く、英字と数字を組み合わせたパスワードにしてください。'
            : `パスワードを設定できませんでした：${err.message}`);
    } finally {
      button.disabled = false;
    }
  });

  // 招待・パスワード再設定のメールのリンクから来たときは、URL の # 以降にログイン情報かエラーが付いている
  //   成功：#access_token=…&refresh_token=…&expires_in=3600&type=invite
  //   失敗：#error=access_denied&error_code=otp_expired&error_description=…
  function readAuthRedirect() {
    const params = new URLSearchParams(location.hash.replace(/^#/, ''));
    if (!params.has('access_token') && !params.has('error') && !params.has('error_code')) return null;
    // ログイン情報をアドレスバーや履歴に残さない
    history.replaceState(null, '', location.pathname + location.search);
    return params;
  }

  async function acceptAuthRedirect(params) {
    if (!params.get('access_token')) {
      const expired = params.get('error_code') === 'otp_expired';
      showLogin(expired
        ? 'メールのリンクの有効期限が切れているか、すでに使われています。招待の場合は管理者に招待メールの再送を依頼してください。パスワード再設定の場合は「パスワードを忘れた場合」からもう一度メールを送ってください。'
        : `メールのリンクを確認できませんでした：${params.get('error_description') || params.get('error')}`);
      return;
    }
    const type = params.get('type');
    saveSession(Object.assign(toSession({
      access_token: params.get('access_token'),
      refresh_token: params.get('refresh_token'),
      expires_at: Number(params.get('expires_at')) || 0,
      expires_in: Number(params.get('expires_in')) || 3600,
    }), { mustSetPassword: type === 'invite' || type === 'recovery' }));
    try {
      const user = await send('/auth/v1/user', { token: session.access_token });
      saveSession(Object.assign({}, session, { email: user.email }));
    } catch (e) { /* メールアドレスが分からなくても続けられる */ }
    if (session.mustSetPassword) showPasswordForm(type);
    else await showEditor();
  }

  // ---- 起動 ----
  if (!config.url || !config.key) {
    showNotice('Supabase の接続設定（config.js）がないため、登録ページは使えません。', 'error');
    return;
  }
  const onStartError = (e) => {
    if (e.status !== 401) showNotice(`読み込めませんでした：${e.message}`, 'error');
  };
  const redirect = readAuthRedirect();
  if (redirect) {
    acceptAuthRedirect(redirect).catch(onStartError);
  } else if (session && session.mustSetPassword) {
    // パスワードを設定する前にページを再読み込みした
    showPasswordForm();
  } else if (session) {
    showEditor().catch(onStartError);
  } else {
    showLogin();
  }
})();
