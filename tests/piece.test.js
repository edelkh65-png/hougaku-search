// 曲の詳細ページ（piece.html）のテスト
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const { setup } = require('./helpers');

describe('曲の詳細ページ', () => {
  let t;
  before(async () => { t = await setup(); });
  after(async () => { await t.close(); });

  async function open(id) {
    const s = await t.newPage();
    await s.page.goto(`${t.base}piece.html?id=${id}`);
    await s.page.waitForSelector('.detail-facts, #status:not([hidden]):not(:empty)');
    return s;
  }
  const facts = (page) => page.$$eval('.fact', (fs) => fs.map((f) => f.innerText.replace(/\s+/g, ' ').trim()));
  const rows = (page) => page.$$eval('.instrument-table tbody tr',
    (trs) => trs.map((tr) => [...tr.cells].map((c) => c.innerText.trim()).filter(Boolean).join(' ')));

  it('基本情報を札で表示する（作曲者のよみ・作曲年の不明）', async () => {
    const { page, errors } = await open(3);
    assert.strictEqual(await page.textContent('h1'), '二つの群の為に');
    assert.deepStrictEqual(await facts(page), ['作曲者 沢井忠夫 さわいただお', '分類 現代曲', '作曲年 不明', 'パート数 7パート']);
    assert.deepStrictEqual(errors, []);
  });

  it('独奏とそれ以外のパートを分けて表示する（箏 独+3 → 1パート独奏 ＋ 3パート）', async () => {
    const { page } = await open(3);
    assert.deepStrictEqual(await rows(page), ['箏 1パート 独奏', '箏 3パート', '十七絃 1パート 独奏', '十七絃 2パート']);
  });

  it('作曲者なし・編曲者ありの曲', async () => {
    const { page } = await open(4);
    assert.deepStrictEqual(await facts(page), ['作曲者 記載なし', '編曲者 テスト編曲者', '分類 編曲', '作曲年 不明', 'パート数 1パート']);
  });

  it('作曲年の範囲表記と、省略可の楽器', async () => {
    const { page } = await open(5);
    assert.ok((await facts(page)).includes('作曲年 2020-22年'));
    assert.deepStrictEqual(await rows(page), ['十七絃 2パート', '歌 1パート 省略可']);
  });

  it('YouTube へのリンクは「曲名　作曲者名」で検索する', async () => {
    const { page } = await open(1);
    const href = await page.getAttribute('.youtube-link', 'href');
    assert.strictEqual(decodeURIComponent(href.split('search_query=')[1]), '春の海　宮城道雄');
  });

  it('非表示の分類の曲は「見つかりませんでした」', async () => {
    const { page } = await open(6);
    assert.match(await page.textContent('#status'), /見つかりませんでした/);
  });
});
