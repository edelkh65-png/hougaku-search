-- 楽曲検索アプリのテーブル定義
-- Supabase の SQL Editor に貼り付けて実行してください（最初に1回だけ）。

create table composers (
  id            bigint generated always as identity primary key,
  name          text not null,              -- 日本語表記（例：ブラームス）
  name_original text not null default '',   -- 原語表記（例：Johannes Brahms）
  unique (name, name_original)
);

create table instruments (
  id         bigint generated always as identity primary key,
  key        text not null unique,          -- アプリ内で使う識別子（例：violin）
  label      text not null,                 -- 表示名（例：ヴァイオリン）
  family     text not null check (family in
               ('strings', 'keyboard', 'woodwind', 'brass', 'percussion', 'plucked', 'japanese', 'voice')),
  aliases    text[] not null default '{}',  -- 検索用の別名（例：{バイオリン,violin}）
  sort_order int not null default 0         -- 検索画面での並び順
);

create table pieces (
  id          bigint generated always as identity primary key,
  title       text not null,
  original    text not null default '',     -- 原題・作品番号
  composer_id bigint not null references composers (id),
  year        int,
  era         text check (era in ('バロック', '古典派', 'ロマン派', '近現代')),
  setting     text not null check (setting in ('chamber', 'concerto', 'orchestra', 'band')),
  note        text,
  created_at  timestamptz not null default now()
);

-- 楽曲ごとの楽器編成
create table piece_instruments (
  piece_id      bigint not null references pieces (id) on delete cascade,
  instrument_id bigint not null references instruments (id),
  count         int check (count > 0),      -- 人数。空欄はセクション扱い（オーケストラ等）
  is_solo       boolean not null default false,  -- 協奏曲の独奏楽器
  position      int not null default 0,     -- 表示順
  primary key (piece_id, instrument_id, is_solo)  -- 独奏とセクションで同じ楽器が並ぶ協奏曲に対応
);

create index on pieces (composer_id);
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
