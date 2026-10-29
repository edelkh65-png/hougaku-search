// サイトマップ（tools/build-sitemap.js で作る sitemap.xml）のテスト
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { MUSIC } = require('./helpers');

describe('サイトマップ', () => {
  it('トップページ・舞台で探す・各曲の詳細ページを id 順に並べる', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'music-sitemap-'));
    const data = path.join(dir, 'data.json');
    const out = path.join(dir, 'sitemap.xml');
    fs.writeFileSync(data, JSON.stringify({ instruments: {}, pieces: [{ id: 12 }, { id: 3 }] }));
    execFileSync(process.execPath, [path.join(MUSIC, 'tools', 'build-sitemap.js'), '--data', data, '--out', out]);
    const urls = [...fs.readFileSync(out, 'utf8').matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
    const site = 'https://edelkh65-png.github.io/hougaku-search/';
    assert.deepStrictEqual(urls, [site, `${site}stage.html`, `${site}piece.html?id=3`, `${site}piece.html?id=12`]);
    // テキスト形式（sitemap.txt）は同じ URL を1行に1つ
    assert.strictEqual(fs.readFileSync(path.join(dir, 'sitemap.txt'), 'utf8'), urls.join('\n') + '\n');
  });
});
