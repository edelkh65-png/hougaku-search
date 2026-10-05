// 舞台で探す（stage.html）のテスト
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const { setup } = require('./helpers');

describe('舞台で探す', () => {
  let t;
  before(async () => { t = await setup(); });
  after(async () => { await t.close(); });

  async function open(query = '') {
    const s = await t.newPage();
    await s.page.goto(`${t.base}stage.html${query}`);
    await s.page.waitForSelector('.stage-item');
    return s;
  }
  const count = (page) => page.$eval('#stage-count b', (b) => Number(b.textContent));
  const titles = (page) => page.$$eval('.stage-item a', (as) => as.map((a) => a.firstChild.textContent).sort());

  it('検索ページの見出しから開ける', async () => {
    const { page } = await t.newPage();
    await page.goto(`${t.base}index.html`);
    await page.waitForSelector('.card');
    await page.click('.header-link');
    await page.waitForSelector('.stage-item');
    assert.match(page.url(), /stage\.html$/);
  });

  it('最初は全曲（非表示の分類を除く）', async () => {
    const { page, errors } = await open();
    assert.strictEqual(await count(page), 5);
    assert.strictEqual(await page.isVisible('#stage-empty'), true);
    assert.deepStrictEqual(errors, []);
  });

  it('楽器を置くと人数で絞り込む（ちょうど／以上／問わない）', async () => {
    const { page } = await open();
    await page.click('.stage-chip[data-key="koto"]');
    assert.strictEqual(await page.$$eval('.seat', (s) => s.length), 1);
    assert.deepStrictEqual(await titles(page), ['春の海', '赤とんぼ']);
    await page.check('input[name="cmp"][value="gte"]');
    assert.deepStrictEqual(await titles(page), ['二つの群の為に', '春の海', '赤とんぼ']);
    await page.check('input[name="cmp"][value="any"]');
    assert.strictEqual(await count(page), 4);
    assert.match(page.url(), /inst=koto%3A1/);
  });

  it('複数の楽器と「置いた楽器だけ」、奏者を押すと1人下がる', async () => {
    const { page } = await open();
    await page.click('.stage-chip[data-key="koto"]');
    await page.click('.stage-chip[data-key="shakuhachi"]');
    assert.deepStrictEqual(await titles(page), ['春の海']);
    await page.check('input[name="mode"][value="exact"]');
    assert.deepStrictEqual(await titles(page), ['春の海']);
    await page.click('.seat[data-key="shakuhachi"]');
    assert.strictEqual(await page.$$eval('.seat', (s) => s.length), 1);
    // 置いた楽器だけ（箏1人）の曲は赤とんぼだけ
    assert.deepStrictEqual(await titles(page), ['赤とんぼ']);
    await page.click('#stage-clear');
    assert.strictEqual(await count(page), 5);
  });

  it('年代の棒を押すとその年代に、続けて押すと範囲に絞る', async () => {
    const { page } = await open();
    await page.click('.decade[data-decade="2020"]');
    assert.deepStrictEqual(await titles(page), ['ヴァイオレット']);
    await page.click('.decade[data-decade="1920"]');
    assert.deepStrictEqual(await titles(page), ['ヴァイオレット', '春の海']);
    assert.match(await page.textContent('#years-text'), /1920〜2029年/);
    await page.click('#years-clear');
    assert.strictEqual(await count(page), 5);
  });

  it('URL の条件を再現し、検索ページへのリンクに編成を渡す', async () => {
    const { page } = await open('?inst=koto:1&cmp=gte');
    assert.strictEqual(await count(page), 3);
    assert.strictEqual(await page.isChecked('input[name="cmp"][value="gte"]'), true);
    assert.strictEqual(await page.getAttribute('#open-search', 'href'), 'index.html?inst=koto%3A1&cmp=gte');
  });

  it('曲を押すと詳細ページへ。詳細の「戻る」は舞台のページに戻る', async () => {
    const { page } = await open('?inst=koto:1');
    await page.click('.stage-item a >> nth=0');
    await page.waitForSelector('.detail-facts');
    assert.match(await page.getAttribute('#back', 'href'), /stage\.html\?inst=koto%3A1/);
  });
});
