#!/usr/bin/env node
// 検索エンジン向けのサイトマップ（sitemap.xml と、同じ URL を1行ずつ並べた sitemap.txt）を作る
//
// 使い方（リポジトリの一番上で）：
//   node tools/build-sitemap.js              … Supabase の今のデータで作る
//   node tools/build-sitemap.js --data a.json … 保存したデータ（loadMusicData の結果）で作る
//   node tools/build-sitemap.js --out x.xml   … 出力先（省略時はリポジトリの一番上の sitemap.xml。sitemap.txt は同じ場所に作る）
//
// トップページ・舞台で探す・全曲の詳細ページ（piece.html?id=…）の URL を並べる。
// 曲を登録・削除したら作り直して push する（Google Search Console には登録済み）。
// 非表示の分類の曲は、Supabase の読み取り権限で除かれるので入らない。

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SITE = 'https://edelkh65-png.github.io/hougaku-search/';
const ROOT = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

function parseArgs(argv) {
  const args = { out: path.join(ROOT, 'sitemap.xml') };
  for (let i = 0; i < argv.length; i++) {
    const [key, value] = [argv[i], argv[i + 1]];
    if (key === '--data') args.data = value;
    else if (key === '--out') args.out = value;
    else throw new Error(`知らないオプションです：${key}`);
    i++;
  }
  return args;
}

// config.js と db.js をそのまま動かして、画面と同じ方法でデータを読む
async function loadFromSupabase() {
  const context = vm.createContext({ window: {}, fetch, console });
  vm.runInContext(read('config.js'), context);
  vm.runInContext(`${read('db.js')}\n;globalThis.loadMusicData = loadMusicData;`, context);
  if (!context.window.MUSIC_DB || !context.window.MUSIC_DB.url) throw new Error('config.js に接続設定がありません');
  return context.loadMusicData();
}

function sitemapUrls(pieces) {
  return [SITE, `${SITE}stage.html`, ...pieces.map((p) => p.id).sort((a, b) => a - b).map((id) => `${SITE}piece.html?id=${id}`)];
}

function buildXml(urls) {
  return '<?xml version="1.0" encoding="UTF-8"?>\n'
    + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + urls.map((url) => `  <url><loc>${url}</loc></url>\n`).join('')
    + '</urlset>\n';
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const data = args.data ? JSON.parse(fs.readFileSync(args.data, 'utf8')) : await loadFromSupabase();
  const urls = sitemapUrls(data.pieces);
  const txt = args.out.replace(/\.xml$/, '') + '.txt';
  fs.writeFileSync(args.out, buildXml(urls));
  fs.writeFileSync(txt, urls.join('\n') + '\n');
  console.log(`${args.out} と ${txt} を作りました（${data.pieces.length}曲＋2ページ）`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
