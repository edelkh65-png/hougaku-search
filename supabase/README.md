# Supabase で楽曲データを管理する

楽曲検索アプリ（`music/`）のデータは、Supabase のデータベースで管理しています。
曲の追加・削除は登録ページ（`music/admin.html`）か、Supabase の **Table Editor** で行います。

## 1. 今の構成

| テーブル | 内容 |
|---|---|
| `pieces` | 楽曲（曲名・よみがな・副題・分類・作曲者・編曲者・作曲年・備考） |
| `piece_instruments` | 楽曲ごとの楽器編成 |
| `instruments` | 楽器のマスタ（検索画面の楽器の並び・別名） |
| `composers` | 作曲者のマスタ（名前・よみがな） |
| `categories` | 分類のマスタ（名前・印の色・並び順・非表示）。→「4. 分類を管理する」 |
| `editors` | 登録担当者（登録ページで追加・削除できる人） |

- `schema.sql` はテーブルの定義の控えです。**実行すると全データが消える**ので、ゼロから作り直すとき以外は実行しないでください。
- `admin.sql` は権限・登録用の関数・分類マスタの設定です。何度実行しても大丈夫で、変更があったときは SQL Editor で実行し直します。

## 2. アプリとの接続（config.js）

`music/config.js` に、Supabase の **Project Settings → API Keys** にある次の2つを書いています。

- **Project URL**（`https://xxxxxxxx.supabase.co`）→ `url`
- **Publishable key**（`sb_publishable_...`。古いプロジェクトでは `anon` `public` キー）→ `key`

```js
window.MUSIC_DB = {
  url: 'https://xxxxxxxx.supabase.co',
  key: 'sb_publishable_xxxxxxxxxxxxxxxx',
};
```

Publishable key は公開して問題ないキーです。「誰でも読めるが、書き込みは登録担当者だけ」という設定（Row Level Security）にしているため、このキーでデータを変更することはできません。
**secret キー / service_role キーは絶対に config.js に入れないでください**（全データを書き換えられてしまいます）。

## 3. 楽曲登録ページを使えるようにする

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
- 分類：分類のマスタ（categories）から選ぶ（分類の追加・変更は下の「分類を管理する」）
- 作曲者のよみがな：登録済みの作曲者は自動で表示（変更不可）。新しい作曲者や、よみがな未登録の作曲者は入力必須（カタカナで入力してもひらがなに変換）
- 同じ曲名の曲がすでにある場合は確認を表示
- 最近登録した10曲の確認と削除
- 招待メールからのパスワード設定、パスワードを忘れたときの再設定

## 4. 分類を管理する（categories）

曲の分類（古典・現代曲など）は `categories` テーブルで管理しています。曲（`pieces`）は `category_id` で分類を指しているので、分類の名前や色を変えると、その分類の曲すべてに反映されます。

| 列 | 内容 |
|---|---|
| `name` | 分類名（例：古典）。重複は不可 |
| `color` | 検索ページ・詳細ページの印の色。`vermilion`（朱）・`indigo`（藍）・`green`（千歳緑）・`purple`（古代紫）・`ochre`（黄土）・`gray`（鈍色）のどれか |
| `sort_order` | 登録ページの選択肢の並び順（小さい順） |
| `hidden` | `true` にすると、その分類の曲は検索ページ・詳細ページに出なくなり、登録ページの分類の選択肢からも外れます（データは残り、登録ページの「最近登録した曲」には出ます） |

変更は **Table Editor** の `categories` で行います。

- **分類を追加する**：「Insert row」で `name` と `color` を入れる。登録ページの分類の選択肢に出てきます
- **名前・色を変える**：その行の `name`・`color` を書き換える
- **分類の曲を隠す／戻す**：`hidden` を `true`／`false` にする（今は「SG」が `true`）
- **分類を削除する**：その分類の曲がある間は削除できません。先に曲の分類を別のものに変えるか、`hidden` を使ってください

印の色を増やしたいときは、`style.css` の `--cat-…` と `.badge[data-color="…"]`、`schema.sql`・`admin.sql` の `color` の選択肢を合わせて追加します。

### 以前の `pieces.category` 列について

`admin.sql` を実行すると、以前の `pieces.category`（分類名の文字の列）から `categories` と `pieces.category_id` に移行します。新しい画面は `category_id` だけを使います。
移行後、検索ページで分類が正しく表示されることを確認したら、次の SQL で古い列を削除できます（削除しなくても動作に影響はありません）。

```sql
alter table pieces drop column if exists category;
```

## 5. Table Editor で直接編集する

登録ページでできないこと（曲の内容の修正など）は、Supabase の **Table Editor** で行います。


1. **composers**：作曲者がまだいなければ追加（`name`）
2. **pieces**：楽曲を追加
   - `title`（曲名）、`reading`（よみがな）、`subtitle`（副題）
   - `category_id`：分類の `id`（`categories` テーブル。空欄可）
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

### バックアップ

曲のデータは Supabase にしかありません。ときどき **Table Editor** で各テーブル（`pieces`・`piece_instruments`・`composers`・`categories`）を開き、「Export → Export table as CSV」で手元に保存しておくと安心です。

## 6. claude.ai 版を更新する

claude.ai のページ（1ファイルの HTML）は、`music/tools/build-artifact.js` で作ります。claude.ai 版は Supabase に直接つながらないので、作った時点のデータが埋め込まれます。

```sh
node music/tools/build-artifact.js
```

- `music/tools/out/music-search.html` ができるので、それを claude.ai のアーティファクトとして公開します。
- 中身は `index.html` の画面・`style.css`・各 JS に、曲データと `music/tools/artifact-shim.js`（曲の詳細を同じページ内に表示する部品）を加えたものです。

## 7. 動作確認のテスト

`music/tests/` に、ブラウザで画面を動かして確認するテストがあります。データは本物の Supabase ではなく、`music/tests/fixtures/` のテスト用データを使います。

```sh
cd music/tests
npm install          # 初回のみ（Playwright を入れる）
npx playwright install chromium   # 初回のみ（テスト用のブラウザ）
npm test
```

画面や JS を変えたあとに実行して、すべて「ok」になることを確認します。

## ファイル

| ファイル | 内容 |
|---|---|
| `schema.sql` | テーブル定義の控え（実行すると全データが消える） |
| `admin.sql` | 権限・登録用の関数・分類マスタの設定（何度実行しても可） |
| `songs.csv` | 最初に登録した楽曲リストの元データ（記録として保管。今は使っていません） |
| `../tools/build-artifact.js` | claude.ai 版を作るスクリプト |
| `../tools/artifact-shim.js` | claude.ai 版だけで使う部品 |
| `../tests/` | 動作確認のテスト |

## 画面のセキュリティ設定（CSP）

3つの HTML の先頭にある `<meta http-equiv="Content-Security-Policy" …>` で、ページが読み込める先を次に限っています。万一不正なスクリプトが入り込むような不具合があっても、外部のスクリプトを読み込んだり、ほかのサイトへデータを送ったりできないようにするためのものです。

- スクリプト・画像：このサイト自身のファイルだけ
- 通信：このサイトと Supabase（`https://*.supabase.co`）だけ
- フォント：Google Fonts だけ

ほかのサイトの画像・スクリプト・サービスを使うようにした場合は、この設定にその読み込み先を追加しないと、ブラウザが読み込みを止めます。

## 画面のファイルを更新したとき

`music/index.html`・`music/piece.html`・`music/admin.html` では、CSS・JS を `style.css?v=20261006-1` のように版番号付きで読み込んでいます。
`style.css` や `*.js` を変更したら、この `v=` の値（日付など）を3つの HTML すべてで新しい値に書き換えてください。
書き換えないと、ブラウザに残っている古いファイルが使われ、表示が崩れることがあります。
