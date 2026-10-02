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
2. **Authentication → URL Configuration** を開き、次のように設定して保存します（招待・パスワード再設定のメールのリンク先になります）。
   - **Site URL**：`https://edelkh65-png.github.io/test-page/music/admin.html`
   - **Redirect URLs**：「Add URL」で同じ `https://edelkh65-png.github.io/test-page/music/admin.html` を追加
   - これを設定しないと、メールのリンクが `http://localhost:3000` に飛んでしまい開けません。
3. 登録担当者のアカウントを作ります。次のどちらかの方法で行います。
   - **招待メールを送る（おすすめ）**：**Authentication → Users** で「Add user」→「Send invitation」を選び、メールアドレスを入力します。
     受け取った人がメールの「Accept the invite」を押すと登録ページが開き、自分でパスワードを決められます。
   - **直接作る**：「Add user」→「Create new user」でメールアドレスとパスワードを入力し、「Auto Confirm User」にチェックを入れます。パスワードは本人に伝えてください。
4. SQL Editor で次を実行し、そのユーザーを登録担当者にします（メールアドレスは書き換えてください）。
   招待の場合は、招待メールを送った直後（相手が受け取る前）に実行して大丈夫です。

   ```sql
   insert into editors (user_id) select id from auth.users where email = 'you@example.com' on conflict do nothing;
   ```

5. おすすめ：**Authentication → Sign In / Providers** で「Allow new users to sign up」をオフにします。
   （オンのままでも、editors に入っていない人は登録・削除できません。オフにしても招待はできます）
6. パスワードの条件を強くします。**Authentication → Sign In / Providers → Email**（画面によっては **Authentication → Policies** や **Password security**）で次のように設定して保存します。
   - **Minimum password length**：`8`
   - **Password requirements**：「Letters and digits」（英字と数字を両方含める）
   - 登録ページの入力チェックもこの条件（8文字以上・英字と数字）に合わせています。条件を変えたときは `admin.js` の `MIN_PASSWORD_LENGTH` と、`admin.html` のパスワード欄の説明も合わせて直してください。
   - 設定前に作ったパスワードはそのまま使えます。気になる場合は「パスワードを忘れた場合」から設定し直してください。

### 招待・パスワードについて

- 招待メールのリンクの有効期限は24時間で、1回しか使えません。期限切れや使用済みのリンクを開くと、登録ページに「有効期限が切れている」と表示されます。その場合は次のどちらかで送り直してください。
  - まだ一度もリンクを開いていない人：「Add user」→「Send invitation」で同じアドレスにもう一度招待を送る
  - リンクを開いたがパスワードを決められなかった人（「already registered」などと表示されて招待できない場合）：**Authentication → Users** でそのユーザーの「…」→「Send password recovery」を送るか、本人に登録ページの「パスワードを忘れた場合」から手続きしてもらう
- パスワードを忘れたときは、登録ページのログイン欄の「パスワードを忘れた場合」から再設定のメールを送れます。メールのリンクを開くと、新しいパスワードを決める画面になります。
- Supabase 標準のメール送信には回数の上限（1時間に数通程度）があります。続けて送ると「送信回数の上限」と表示されるので、時間をおいてください。

`admin.sql` を更新したとき（例：作曲者のよみがな `composers.reading` への対応）は、SQL Editor で `admin.sql` をもう一度実行してください。何度実行しても大丈夫です。

登録担当者を外すときは `delete from editors where user_id = (select id from auth.users where email = '…');` を実行します。

登録ページでできること：
- 曲の情報（曲名・よみがな・副題・作曲者・編曲者・分類・作曲年・備考）と楽器編成の入力
- 作曲者：よみ（ひらがな）か名前を入力すると登録済みの作曲者が候補に出るので選ぶ。新しい作曲者は「〜を新しい作曲者として登録」を選ぶ（検索ページの作曲者欄と同じ操作）
- 分類：既存の一覧から選ぶか、新しく入力
- 作曲者のよみがな：登録済みの作曲者は自動で表示（変更不可）。新しい作曲者や、よみがな未登録の作曲者は入力必須（カタカナで入力してもひらがなに変換）
- 同じ曲名の曲がすでにある場合は確認を表示
- 最近登録した10曲の確認と削除
- 招待メールからのパスワード設定、パスワードを忘れたときの再設定

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

## 画面のセキュリティ設定（CSP）

3つの HTML の先頭にある `<meta http-equiv="Content-Security-Policy" …>` で、ページが読み込める先を次に限っています。万一不正なスクリプトが入り込むような不具合があっても、外部のスクリプトを読み込んだり、ほかのサイトへデータを送ったりできないようにするためのものです。

- スクリプト・画像：このサイト自身のファイルだけ
- 通信：このサイトと Supabase（`https://*.supabase.co`）だけ
- フォント：Google Fonts だけ

ほかのサイトの画像・スクリプト・サービスを使うようにした場合は、この設定にその読み込み先を追加しないと、ブラウザが読み込みを止めます。

## 画面のファイルを更新したとき

`music/index.html`・`music/piece.html`・`music/admin.html` では、CSS・JS を `style.css?v=20261002-14` のように版番号付きで読み込んでいます。
`style.css` や `*.js` を変更したら、この `v=` の値（日付など）を両方の HTML で新しい値に書き換えてください（3つの HTML すべて）。
書き換えないと、ブラウザに残っている古いファイルが使われ、表示が崩れることがあります。
