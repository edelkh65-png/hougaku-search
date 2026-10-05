// 検索ページ（index.html）のテスト
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const { setup } = require('./helpers');

describe('検索ページ', () => {
  let t;
  before(async () => { t = await setup(); });
  after(async () => { await t.close(); });

  async function open(query = '') {
    const s = await t.newPage();
    await s.page.goto(`${t.base}index.html${query}`);
    await s.page.waitForSelector('.card');
    return s;
  }
  const count = (page) => page.textContent('#count');
  const titles = (page) => page.$$eval('.card-link', (as) => as.map((a) => a.textContent).sort());

  it('全曲を表示し、非表示の分類（SG）の曲は出さない', async () => {
    const { page, errors } = await open();
    assert.strictEqual(await count(page), '5件 / 全5曲');
    assert.ok(!(await titles(page)).includes('隠し曲'));
    assert.strictEqual(await page.inputValue('#sort'), 'random');
    assert.deepStrictEqual(errors, []);
  });

  it('分類の印は分類マスタの色で表示する', async () => {
    const { page } = await open('?q=' + encodeURIComponent('六段'));
    assert.strictEqual(await page.$eval('.badge', (b) => b.dataset.color), 'indigo');
    await page.fill('#q', '春の海');
    await page.waitForFunction(() => document.querySelectorAll('.card').length === 1 && document.querySelector('.card-link').textContent === '春の海');
    assert.strictEqual(await page.$eval('.badge', (b) => b.dataset.color), 'vermilion');
  });

  it('キーワードは表記ゆれを吸収する（ヴァ／ば、絃／弦、カタカナ／ひらがな）', async () => {
    const { page } = await open();
    await page.fill('#q', 'ばいおれっと');
    await page.waitForFunction(() => document.getElementById('count').textContent.startsWith('1件'));
    assert.deepStrictEqual(await titles(page), ['ヴァイオレット']);
    await page.fill('#q', '十七弦');
    await page.waitForFunction(() => document.getElementById('count').textContent.startsWith('2件'));
    assert.deepStrictEqual(await titles(page), ['ヴァイオレット', '二つの群の為に']);
    // 条件を入れると五十音順になる
    assert.strictEqual(await page.inputValue('#sort'), 'reading');
  });

  it('楽器とパート数で絞り込み、URL に条件を残す', async () => {
    const { page } = await open();
    await page.click('#advanced summary');
    await page.click('.chip[data-key="koto"]');
    assert.strictEqual(await count(page), '4件 / 全5曲');
    await page.click('.chip-wrap[data-key="koto"] [data-step="1"]');
    assert.strictEqual(await count(page), '2件 / 全5曲');
    assert.deepStrictEqual(await titles(page), ['春の海', '赤とんぼ']);
    assert.match(page.url(), /inst=koto%3A1/);
    // 「以上」にすると、箏が1パート以上の曲（パート数不明の六段の調は除く）
    await page.check('input[name="cmp"][value="gte"]');
    assert.strictEqual(await count(page), '3件 / 全5曲');
    await page.click('#reset-button');
    assert.strictEqual(await count(page), '5件 / 全5曲');
  });

  it('楽器のジャンルは折りたためる。箏・三絃・尺八は開き、ほかは閉じておく', async () => {
    const { page } = await open();
    await page.click('#advanced summary');
    const groups = () => page.$$eval('.chip-group', (gs) => gs.map((g) => `${g.dataset.family}:${g.open ? '開' : '閉'}`));
    assert.deepStrictEqual(await groups(), ['koto:開', 'shamisen:開', 'kan:開', 'voice:閉']);
    // 閉じたジャンルの見出しには中の楽器名を出す
    assert.strictEqual(await page.textContent('.chip-group[data-family="voice"] .chip-group-preview'), '歌');
    assert.strictEqual(await page.isVisible('.chip[data-key="voice"]'), false);
    // 見出しを押すと開き、選んでから閉じると「1つ選択中」
    await page.click('.chip-group[data-family="voice"] > summary');
    await page.click('.chip[data-key="voice"]');
    await page.click('.chip-group[data-family="voice"] > summary');
    assert.strictEqual(await page.textContent('.chip-group[data-family="voice"] .chip-group-selected'), '1つ選択中');
    assert.strictEqual(await page.isVisible('.chip-group[data-family="voice"] .chip-group-selected'), true);
    assert.strictEqual(await count(page), '1件 / 全5曲');
  });

  it('検索結果の楽器名や URL で閉じたジャンルの楽器を選ぶと、そのジャンルを開く', async () => {
    const { page } = await open('?inst=voice');
    assert.strictEqual(await page.$eval('.chip-group[data-family="voice"]', (g) => g.open), true);
    const s = await open('?q=' + encodeURIComponent('ヴァイオレット'));
    await s.page.click('.tag[data-key="voice"]');
    assert.strictEqual(await s.page.$eval('.chip-group[data-family="voice"]', (g) => g.open), true);
    assert.strictEqual(await s.page.getAttribute('.chip[data-key="voice"]', 'aria-pressed'), 'true');
  });

  it('作曲者をよみで探して選ぶ', async () => {
    const { page } = await open();
    await page.click('#advanced summary');
    await page.fill('#composer-input', 'さわい');
    await page.click('#composer-list .combo-option >> nth=0');
    assert.strictEqual(await page.textContent('#composer-selected .combo-name'), '沢井忠夫');
    assert.deepStrictEqual(await titles(page), ['ヴァイオレット', '二つの群の為に']);
  });

  it('URL の条件から検索を再現する', async () => {
    const { page } = await open('?composer=' + encodeURIComponent('宮城道雄'));
    assert.deepStrictEqual(await titles(page), ['春の海']);
    assert.ok(await page.$eval('#advanced', (d) => d.open));
  });
});
