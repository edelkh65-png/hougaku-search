# Supabase で楽曲データを管理する

楽曲検索アプリ（`music/`）のデータを Supabase のデータベースで管理するための手順です。
`config.js` が空欄のあいだは `music/data.js` のデータで動くので、途中の段階でもアプリは壊れません。

## 1. プロジェクトを作る

1. https://supabase.com でアカウントを作り、「New project」でプロジェクトを作成します。
   - Region は日本から使うなら「Northeast Asia (Tokyo)」がおすすめです。
2. 作成が終わるまで1〜2分待ちます。

## 2. テーブルを作ってデータを入れる

1. 左メニューの **SQL Editor** を開きます。
2. `schema.sql` の中身をすべて貼り付けて **Run** を押します（テーブル作成）。
   - 以前のテーブルがある場合は、削除して作り直します。
3. 新しいクエリを開き、`seed.sql` の中身をすべて貼り付けて **Run** を押します（1,322曲の登録）。
4. 左メニューの **Table Editor** で `pieces` を開き、1322行あれば成功です。

`seed.sql` は schema.sql の直後に1回だけ実行します（2回実行すると id が重複してエラーになります。その場合は schema.sql からやり直してください）。

## 3. アプリと接続する

1. 左メニューの **Project Settings → API Keys** を開きます。
2. 次の2つを `music/config.js` に書き込みます。
   - **Project URL**（`https://xxxxxxxx.supabase.co`）→ `url`
   - **Publishable key**（`sb_publishable_...`。古いプロジェクトでは `anon` `public` キー）→ `key`
3. `music/index.html` をブラウザで開き、1322曲が表示されれば接続完了です。

```js
window.MUSIC_DB = {
  url: 'https://xxxxxxxx.supabase.co',
  key: 'sb_publishable_xxxxxxxxxxxxxxxx',
};
```

Publishable key は公開して問題ないキーです。`schema.sql` で「誰でも読めるが、書き込みはできない」設定（Row Level Security）にしているため、このキーでデータを変更することはできません。
**secret キー / service_role キーは絶対に config.js に入れないでください**（全データを書き換えられてしまいます）。

## 4. 楽曲登録ページを使えるようにする

`music/admin.html` から、ログインした登録担当者が曲を追加・削除できます。

1. SQL Editor で `admin.sql` の中身をすべて貼り付けて **Run** を押します。
   - `schema.sql` を実行し直したときは、`admin.sql` も実行し直してください。
2. 左メニューの **Authentication → Users** で「Add user」→「Create new user」を選び、登録担当者のメールアドレスとパスワードを入力します。
   「Auto Confirm User」にチェックを入れてください。
3. SQL Editor で次を実行し、そのユーザーを登録担当者にします（メールアドレスは書き換えてください）。

   ```sql
   insert into editors (user_id) select id from auth.users where email = 'you@example.com' on conflict do nothing;
   ```

4. おすすめ：**Authentication → Sign In / Providers** で「Allow new users to sign up」をオフにします。
   （オンのままでも、editors に入っていない人は登録・削除できません）

登録担当者を外すときは `delete from editors where user_id = (select id from auth.users where email = '…');` を実行します。

登録ページでできること：
- 曲の情報（曲名・よみがな・副題・作曲者・編曲者・分類・作曲年・備考）と楽器編成の入力
- 作曲者・分類は既存の一覧から選ぶか、新しく入力（新しい作曲者は自動で追加）
- 同じ曲名の曲がすでにある場合は確認を表示
- 最近登録した10曲の確認と削除

## 5. 楽曲を追加・編集する（その他の方法）

### まとめて更新する（CSV から作り直す）

1. Excel などで `songs.csv` を編集します（列の並びは今のまま。Shift_JIS / UTF-8 どちらで保存しても読めます）。
2. `node music/supabase/import-csv.js` を実行すると、`seed.sql` と `music/data.js` が作り直されます。
3. SQL Editor で `schema.sql` → `seed.sql` の順に実行し直します。

この方法では、Table Editor で直接追加・編集した内容は消えます。どちらか一方の方法で管理してください。

### 1曲ずつ追加する（Table Editor）

1. **composers**：作曲者がまだいなければ追加（`name`）
2. **pieces**：楽曲を追加
   - `title`（曲名）、`reading`（よみがな）、`subtitle`（副題）、`category`（古典・新曲・編曲・SG など、空欄可）
   - `composer_id`：作曲者の `id`（不明なら空欄）
   - `arranger`（編曲者）、`year`（作曲年）、`remarks`（備考）
3. **piece_instruments**：楽器を1つずつ追加
   - `piece_id`：上で追加した楽曲の `id`
   - `instrument_id`：`instruments` テーブルの楽器の `id`
   - `parts`：人数（不明なら空欄。空欄の楽器がある曲は人数での絞り込みの対象外になります）
   - `is_solo`：独奏パートを含むなら `true`、`is_optional`：省略可なら `true`
   - `notation`：画面での表記（例：`箏 独+2`）。空欄なら「箏×2」のように楽器名と人数から表示します
   - `position`：表示順（0, 1, 2 …）

変更はページを再読み込みすると反映されます。

## CSV の楽器欄の読み取り方

| 書き方 | 意味 | 人数 |
|---|---|---|
| `2` | 2パート | 2 |
| `●` | 使用（人数の記載なし。古典曲など） | 不明 |
| `独+2` | 独奏＋2パート | 3 |
| `独` | 独奏 | 1 |
| `(1)` | 省略可 | 1 |
| `2(各AB)` `1(十八絃)` など | 最初の数字を人数とし、表記はそのまま表示 | 2, 1 |
| `本,替` | 本手・替手 | 2 |
| `合奏` `独+n` | 人数不定 | 不明 |

「笛」「他楽器」列の記述（Vc、締太鼓、唄 など）は、`import-csv.js` の `TOKEN_RULES` で楽器に対応づけています。どれにも当てはまらないものは「その他」になり、スクリプト実行時に一覧が表示されます。

## ファイル

| ファイル | 内容 |
|---|---|
| `songs.csv` | 楽曲リストの元データ |
| `import-csv.js` | CSV から `seed.sql` と `../data.js` を生成するスクリプト |
| `schema.sql` | テーブル定義と閲覧権限の設定 |
| `admin.sql` | 登録ページ用の設定（登録担当者・書き込み権限・登録用の関数） |
| `seed.sql` | 楽曲データの登録用 SQL（自動生成） |
