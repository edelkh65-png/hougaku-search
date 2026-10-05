// claude.ai 版（tools/build-artifact.js で作る1ファイルの HTML）のテスト
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');
const { loadDb, MUSIC } = require('./helpers');

// テスト用データを、画面と同じ db.js の変換で loadMusicData の結果の形にする
function embeddedData() {
  const db = loadDb();
  const context = vm.createContext({ window: {} });
  vm.runInContext(`${fs.readFileSync(path.join(MUSIC, 'db.js'), 'utf8')}\n;globalThis.pieceFromDbRow = pieceFromDbRow;`, context);
  const hidden = new Set(db.categories.filter((c) => c.hidden).map((c) => c.id));
  const instruments = Object.fromEntries(db.instruments.map((i) => [i.key, { label: i.label, family: i.family, aliases: i.aliases }]));
  return { instruments, pieces: db.pieces.filter((p) => !hidden.has(p.category_id)).map((p) => context.pieceFromDbRow(p)) };
}

describe('claude.ai 版', () => {
  let browser;
  let html;
  before(async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'music-artifact-'));
    const data = path.join(dir, 'data.json');
    const out = path.join(dir, 'music-search.html');
    fs.writeFileSync(data, JSON.stringify(embeddedData()));
    execFileSync(process.execPath, [path.join(MUSIC, 'tools', 'build-artifact.js'), '--data', data, '--out', out]);
    html = fs.readFileSync(out, 'utf8');
    browser = await chromium.launch();
  });
  after(async () => { await browser.close(); });

  it('1ファイルで検索・詳細・検索への戻りが動く', async () => {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ contentType: 'text/css', body: '' }));
    await page.route('http://artifact.test/', (r) => r.fulfill({ contentType: 'text/html; charset=utf-8', body: html }));
    await page.goto('http://artifact.test/');
    await page.waitForSelector('.card');
    assert.strictEqual(await page.textContent('#count'), '5件 / 全5曲');

    // 曲を押すと、同じページ内に詳細が出る
    await page.fill('#q', '二つの群');
    await page.click('.card-link');
    await page.waitForSelector('#detail-view .detail-facts');
    assert.strictEqual(await page.isVisible('.layout'), false);
    assert.strictEqual(await page.$$eval('.instrument-table tbody tr', (trs) => trs.length), 4);

    // 作曲者を押すと、その作曲者で絞り込んだ一覧に戻る
    await page.click('.fact a');
    await page.waitForSelector('.layout:not([hidden])');
    assert.strictEqual(await page.textContent('#count'), '2件 / 全5曲');
    assert.deepStrictEqual(errors, []);
  });
});
