// 登録ページ（admin.html）のテスト
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const { setup, EDITOR } = require('./helpers');

describe('登録ページ', () => {
  let t;
  before(async () => { t = await setup(); });
  after(async () => { await t.close(); });

  async function login(s) {
    await s.page.goto(`${t.base}admin.html`);
    await s.page.fill('#email', EDITOR.email);
    await s.page.fill('#password', EDITOR.password);
    await s.page.click('#login-form button[type="submit"]');
    await s.page.waitForSelector('#piece-form:not([hidden])');
  }

  it('パスワードが違うとログインできない', async () => {
    const { page } = await t.newPage();
    await page.goto(`${t.base}admin.html`);
    await page.fill('#email', EDITOR.email);
    await page.fill('#password', 'wrong');
    await page.click('#login-form button[type="submit"]');
    await page.waitForSelector('#login-error:not([hidden])');
    assert.strictEqual(await page.textContent('#login-error'), 'メールアドレスかパスワードが違います。');
  });

  it('分類の選択肢はマスタから。非表示の分類（SG）は出さない', async () => {
    const s = await t.newPage();
    await login(s);
    const options = await s.page.$$eval('#category option', (os) => os.map((o) => o.textContent));
    assert.deepStrictEqual(options, ['（なし）', '古典', '現代曲', '編曲']);
    assert.deepStrictEqual(s.errors, []);
  });

  it('新しい作曲者はよみがなが必須で、分類つきで登録できる', async () => {
    const s = await t.newPage();
    await login(s);
    const { page, log } = s;
    await page.fill('#title', 'テスト登録曲');
    await page.fill('#reading', 'てすととうろくきょく');
    await page.selectOption('#category', '古典');
    await page.fill('#composer-input', '新しい作曲家');
    await page.click('#composer-list .combo-option.is-new');
    await page.locator('.instrument-row select').first().selectOption('koto');
    await page.click('#save');
    assert.strictEqual(await page.textContent('#form-error'), '作曲者のよみがなを入力してください。');
    await page.fill('#composer-reading', 'アタラシイ');
    await page.click('#save');
    await page.waitForSelector('.notice-success');
    assert.deepStrictEqual(
      { title: log.addPiece[0].title, category: log.addPiece[0].category, composer: log.addPiece[0].composer, reading: log.addPiece[0].composer_reading },
      { title: 'テスト登録曲', category: '古典', composer: '新しい作曲家', reading: 'あたらしい' },
    );
    // 最近登録した曲に出る
    await page.waitForFunction(() => document.querySelector('#recent li strong') && document.querySelector('#recent li strong').textContent.startsWith('テスト登録曲'));
  });

  it('招待のリンクから開くと、パスワードを決めて登録画面に進む', async () => {
    const { page, log } = await t.newPage();
    await page.goto(`${t.base}admin.html#access_token=a&refresh_token=r&expires_in=3600&type=invite`);
    await page.waitForSelector('#password-section:not([hidden])');
    assert.ok(!page.url().includes('access_token'), 'URL からログイン情報を消す');
    await page.fill('#new-password', 'abcdefgh');
    await page.fill('#new-password-confirm', 'abcdefgh');
    await page.$eval('#password-form', (f) => f.dispatchEvent(new Event('submit', { cancelable: true })));
    assert.match(await page.textContent('#password-error'), /英字と数字を両方/);
    await page.fill('#new-password', 'abcd1234');
    await page.fill('#new-password-confirm', 'abcd1234');
    await page.click('#password-form button[type="submit"]');
    await page.waitForSelector('#piece-form:not([hidden])');
    assert.deepStrictEqual(log.passwords, ['abcd1234']);
  });

  it('期限切れのリンクは案内を表示する', async () => {
    const { page } = await t.newPage();
    await page.goto(`${t.base}admin.html#error=access_denied&error_code=otp_expired&error_description=expired`);
    await page.waitForSelector('#login-error:not([hidden])');
    assert.match(await page.textContent('#login-error'), /有効期限が切れている/);
  });

  it('パスワードを忘れた場合は再設定メールを送る', async () => {
    const { page, log } = await t.newPage();
    await page.goto(`${t.base}admin.html`);
    await page.fill('#email', EDITOR.email);
    await page.click('#show-recover');
    await page.click('#recover-form button[type="submit"]');
    await page.waitForSelector('.notice-success');
    assert.deepStrictEqual(log.recover, [EDITOR.email]);
  });
});
