-- 楽曲検索アプリのテーブル定義
-- Supabase の SQL Editor に貼り付けて実行してください。
-- 注意：既存の楽曲テーブル（composers / instruments / pieces / piece_instruments）を削除して作り直します。
-- 登録ページを使う場合は、続けて admin.sql も実行してください。

drop table if exists piece_instruments, pieces, instruments, composers cascade;

create table composers (
  id   bigint generated always as identity primary key,
  name text not null unique
);

create table instruments (
  id         bigint generated always as identity primary key,
  key        text not null unique,          -- アプリ内で使う識別子（例：koto）
  label      text not null,                 -- 表示名（例：箏）
  family     text not null check (family in
               ('koto', 'shamisen', 'kan', 'percussion', 'voice', 'western', 'other')),
  aliases    text[] not null default '{}',  -- 検索用の別名（例：{琴,こと}）
  sort_order int not null default 0         -- 検索画面での並び順
);

create table pieces (
  id          bigint generated always as identity primary key,
  title       text not null,
  reading     text not null default '',     -- よみがな（五十音順の並び替えに使用）
  subtitle    text not null default '',     -- 副題
  category    text,                         -- 分類（古典・新曲・編曲・SG など。空欄可）
  composer_id bigint references composers (id),
  arranger    text not null default '',     -- 編曲者
  year        int,                          -- 作曲年（並び替え用）
  year_label  text not null default '',     -- 作曲年の表記が年だけでない場合（例：2020-22）
  remarks     text not null default '',     -- 備考
  created_at  timestamptz not null default now()
);

-- 楽曲ごとの楽器編成
create table piece_instruments (
  id            bigint generated always as identity primary key,
  piece_id      bigint not null references pieces (id) on delete cascade,
  instrument_id bigint not null references instruments (id),
  parts         int check (parts > 0),     -- 人数。空欄は不明（「●」やオーケストラなど）
  is_solo       boolean not null default false,  -- 独奏パートを含む
  is_optional   boolean not null default false,  -- 省略可
  notation      text not null default '',  -- 画面での表記（例：箏 独+2）。空欄なら「楽器名×人数」
  position      int not null default 0     -- 表示順
);

create index on pieces (composer_id);
create index on piece_instruments (piece_id);
create index on piece_instruments (instrument_id);

-- 閲覧は誰でも可能、書き込みは管理画面（ログインした管理者）からのみ
alter table composers         enable row level security;
alter table instruments       enable row level security;
alter table pieces            enable row level security;
alter table piece_instruments enable row level security;

create policy "public read" on composers         for select to anon, authenticated using (true);
create policy "public read" on instruments       for select to anon, authenticated using (true);
create policy "public read" on pieces            for select to anon, authenticated using (true);
create policy "public read" on piece_instruments for select to anon, authenticated using (true);
