# 邦楽 楽曲検索

箏・尺八・三絃などの邦楽曲を、曲名・よみがな・作曲者・楽器編成から検索できる Web アプリです。
HTML・CSS・JavaScript だけで作り、データは Supabase で管理しています。

- 公開ページ：https://edelkh65-png.github.io/hougaku-search/
- 舞台で探す：https://edelkh65-png.github.io/hougaku-search/stage.html
- 曲の登録ページ：https://edelkh65-png.github.io/hougaku-search/admin.html

## ファイル

| ファイル | 内容 |
|---|---|
| `index.html`・`app.js` | 検索ページ |
| `piece.html`・`piece.js` | 曲の詳細ページ |
| `stage.html`・`stage.js`・`stage.css` | 舞台で探すページ（舞台に楽器を置いて編成で探す・年代で絞る） |
| `admin.html`・`admin.js` | 曲の登録ページ（登録担当者のみ） |
| `db.js` | Supabase からの読み込み |
| `combo.js` | 作曲者の入力欄（検索ページと登録ページで共通） |
| `constants.js` | 楽器のジャンル・表示件数などの設定 |
| `config.js` | Supabase の接続先 |
| `style.css` | 見た目 |
| `supabase/` | データベースの設定と運用手順（[supabase/README.md](supabase/README.md)） |
| `tools/` | claude.ai 版を作るスクリプト |
| `tests/` | 動作確認のテスト |

運用の手順（登録担当者の追加・分類の管理・バックアップ・claude.ai 版の更新・テストの実行など）は [supabase/README.md](supabase/README.md) にまとめています。
