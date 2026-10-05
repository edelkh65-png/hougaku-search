#!/usr/bin/env node
// claude.ai 版の楽曲検索ページ（1ファイルの HTML）を作る
//
// 使い方（リポジトリの一番上で）：
//   node tools/build-artifact.js              … Supabase の今のデータで作る
//   node tools/build-artifact.js --data a.json … 保存したデータ（loadMusicData の結果）で作る
//   node tools/build-artifact.js --out x.html  … 出力先（省略時は tools/out/music-search.html）
//   node tools/build-artifact.js --save-data a.json … Supabase から読んだデータを保存する
//
// 作ったファイルを claude.ai のアーティファクトとして公開する。
// 中身：index.html の画面 ＋ style.css ＋ 各 JS ＋ 曲データ（埋め込み）＋ artifact-shim.js（中に piece.js）
// claude.ai 版は Supabase に直接つながらないので、作った時点のデータが入る。

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const MUSIC = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(MUSIC, file), 'utf8');

function parseArgs(argv) {
  const args = { out: path.join(__dirname, 'out', 'music-search.html') };
  for (let i = 0; i < argv.length; i++) {
    const [key, value] = [argv[i], argv[i + 1]];
    if (key === '--data') args.data = value;
    else if (key === '--out') args.out = value;
    else if (key === '--save-data') args.saveData = value;
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

function build(data) {
  const index = read('index.html');
  // 見出しまわり：タイトルとフォントだけ（CSP・ファビコン・スクリプトは claude.ai 版では使わない）
  const head = [
    index.match(/<title>[\s\S]*?<\/title>/)[0],
    ...index.match(/<link rel="preconnect"[^>]*>|<link rel="stylesheet" href="https:\/\/fonts[^>]*>/g),
  ].join('\n');
  // 本文：フッター（登録ページへのリンクなど）とスクリプトは除く
  const body = index.slice(index.indexOf('<body>') + '<body>'.length, index.indexOf('<footer')).trim();
  const shim = read('tools/artifact-shim.js');
  if (shim.split('/* PIECE_JS */').length !== 2) throw new Error('artifact-shim.js に /* PIECE_JS */ がちょうど1つ必要です');
  const scripts = [
    read('constants.js'),
    `// 曲データ（${new Date().toISOString().slice(0, 10)} 時点。tools/build-artifact.js で埋め込み）\n`
      + `const MUSIC_EMBEDDED_DATA = ${JSON.stringify(data)};\n`,
    read('db.js'),
    read('combo.js'),
    read('app.js'),
    shim.replace('/* PIECE_JS */', () => read('piece.js').trim()),
  ].join('\n');
  // </script> が文字列に含まれると HTML が途中で切れるので、念のため確認する
  if (/<\/script/i.test(scripts)) throw new Error('スクリプトの中に </script> が含まれています');
  return `${head}\n<style>\n${read('style.css')}</style>\n\n${body}\n\n<div id="detail-view" hidden></div>\n\n<script>\n${scripts}</script>\n`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const data = args.data ? JSON.parse(fs.readFileSync(args.data, 'utf8')) : await loadFromSupabase();
  if (args.saveData) fs.writeFileSync(args.saveData, JSON.stringify(data));
  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, build(data));
  console.log(`${args.out} を作りました（${data.pieces.length}曲、${Math.round(fs.statSync(args.out).size / 1024)}KB）`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
