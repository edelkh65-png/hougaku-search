# Supabase で楽曲データを管理する

楽曲検索アプリ（`music/`）のデータを Supabase のデータベースで管理するための手順です。
`config.js` が空欄のあいだは `data.js` のサンプルデータで動くので、途中の段階でもアプリは壊れません。

## 1. プロジェクトを作る

1. https://supabase.com でアカウントを作り、「New project」でプロジェクトを作成します。
   - Region は日本から使うなら「Northeast Asia (Tokyo)」がおすすめです。
   - Database Password は管理画面へのログインには使いませんが、控えておいてください。
2. 作成が終わるまで1〜2分待ちます。

## 2. テーブルを作ってデータを入れる

1. 左メニューの **SQL Editor** を開きます。
2. `schema.sql` の中身をすべて貼り付けて **Run** を押します（テーブル作成）。
3. 新しいクエリを開き、`seed.sql` の中身をすべて貼り付けて **Run** を押します（サンプル41曲の登録）。
4. 左メニューの **Table Editor** で `pieces` を開き、41行あれば成功です。

どちらも最初に1回だけ実行します。`seed.sql` を2回実行すると楽曲が重複します。

## 3. アプリと接続する

1. 左メニューの **Project Settings → API Keys**（または **Data API**）を開きます。
2. 次の2つを `music/config.js` に書き込みます。
   - **Project URL**（`https://xxxxxxxx.supabase.co`）→ `url`
   - **Publishable key**（`sb_publishable_...`。古いプロジェクトでは `anon` `public` キー）→ `key`
3. `music/index.html` をブラウザで開き、41曲が表示されれば接続完了です。

```js
window.MUSIC_DB = {
  url: 'https://xxxxxxxx.supabase.co',
  key: 'sb_publishable_xxxxxxxxxxxxxxxx',
};
```

Publishable key は公開して問題ないキーです。`schema.sql` で「誰でも読めるが、書き込みはできない」設定（Row Level Security）にしているため、このキーでデータを変更することはできません。
**secret キー / service_role キーは絶対に config.js に入れないでください**（全データを書き換えられてしまいます）。

## 4. 楽曲を追加・編集する

Table Editor から行を追加します。楽曲1曲につき、次の順に登録します。

1. **composers**：作曲者がまだいなければ追加（`name` と `name_original`）
2. **pieces**：楽曲を追加。`composer_id` は作曲者の `id` を選びます
   - `setting`：`chamber`（独奏・室内楽）/ `concerto`（協奏曲）/ `orchestra`（管弦楽）/ `band`（吹奏楽）
   - `era`：`バロック` / `古典派` / `ロマン派` / `近現代`
3. **piece_instruments**：楽器を1つずつ追加
   - `piece_id`：上で追加した楽曲の `id`
   - `instrument_id`：`instruments` テーブルの楽器の `id`
   - `count`：人数（オーケストラのセクションなど人数を決めない場合は空欄）
   - `is_solo`：協奏曲の独奏楽器なら `true`
   - `position`：表示順（0, 1, 2 …）

新しい楽器が必要な場合は **instruments** に追加します。`family` は
`strings`（弦）/ `keyboard`（鍵盤）/ `woodwind`（木管）/ `brass`（金管）/ `percussion`（打楽器）/ `plucked`（撥弦）/ `japanese`（和楽器）/ `voice`（声楽）のいずれかです。

変更はページを再読み込みすると反映されます。

## ファイル

| ファイル | 内容 |
|---|---|
| `schema.sql` | テーブル定義と閲覧権限の設定 |
| `seed.sql` | サンプル41曲の登録データ |
| `generate-seed.js` | `data.js` から `seed.sql` を作り直すスクリプト（`node music/supabase/generate-seed.js > music/supabase/seed.sql`） |
