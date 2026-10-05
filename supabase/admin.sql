-- 楽曲登録ページ（admin.html）用の設定
-- schema.sql の後に、SQL Editor で実行してください（何度実行しても大丈夫です）。
-- 登録できるのは editors テーブルに入っているユーザーだけです（最後の手順を参照）。

-- 作曲者名の読み（ひらがな）。すでに追加済みなら何もしない
alter table composers add column if not exists reading text;

-- ---- 分類のマスタ（categories） ----
-- 以前の pieces.category（文字の列）から移行する。すでに移行済みなら何もしない
create table if not exists categories (
  id         bigint generated always as identity primary key,
  name       text not null unique,
  color      text not null default 'gray' check (color in
               ('vermilion', 'indigo', 'green', 'purple', 'ochre', 'gray')),
  sort_order int not null default 0,
  hidden     boolean not null default false
);
alter table categories enable row level security;
drop policy if exists "public read" on categories;
create policy "public read" on categories for select to anon, authenticated using (true);

-- 最初の分類（すでにある分類の色・表示設定は変えない）
insert into categories (name, color, sort_order, hidden) values
  ('古典', 'indigo', 1, false),
  ('明治新曲', 'ochre', 2, false),
  ('新曲', 'purple', 3, false),
  ('現代曲', 'vermilion', 4, false),
  ('編曲', 'green', 5, false),
  ('SG', 'gray', 6, true)
on conflict (name) do nothing;

alter table pieces add column if not exists category_id bigint references categories (id);
create index if not exists pieces_category_id_idx on pieces (category_id);

-- 以前の category 列があれば、その分類をマスタに追加して category_id に移す
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'pieces' and column_name = 'category') then
    execute $m$
      insert into categories (name, sort_order)
      select distinct category, 100 from pieces where nullif(btrim(category), '') is not null
      on conflict (name) do nothing;
      update pieces p set category_id = c.id
      from categories c where c.name = p.category and p.category_id is null;
    $m$;
  end if;
end $$;

-- 非表示（hidden）の分類の曲は、検索ページ・詳細ページから読めないようにする
drop policy if exists "public read" on pieces;
create policy "public read" on pieces for select to anon, authenticated
  using (category_id is null or category_id not in (select id from categories where hidden));

create table if not exists editors (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table editors enable row level security;
drop policy if exists "read own row" on editors;
create policy "read own row" on editors for select to authenticated using (user_id = auth.uid());

-- ログイン中のユーザーが登録担当者かどうか
create or replace function is_editor() returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from editors where user_id = auth.uid());
$$;

-- 登録担当者だけが追加・変更・削除できる
do $$
declare t text;
begin
  foreach t in array array['categories', 'composers', 'pieces', 'piece_instruments'] loop
    execute format('drop policy if exists "editors write" on %I', t);
    execute format('create policy "editors write" on %I for all to authenticated using (is_editor()) with check (is_editor())', t);
  end loop;
end $$;

-- 1曲分（曲の情報と楽器編成）をまとめて登録する。途中で失敗した場合は何も登録されない。
-- piece の例：
--   {"title": "春の海", "reading": "はるのうみ", "category": "現代曲", "composer": "宮城道雄", "composer_reading": "みやぎみちお", "year": 1929,
--    "instruments": [{"key": "koto", "parts": 1}, {"key": "shakuhachi", "parts": 1}]}
create or replace function add_piece(piece jsonb) returns bigint
language plpgsql security invoker set search_path = public
as $$
declare
  v_composer_name text := nullif(btrim(piece->>'composer'), '');
  v_composer_reading text := nullif(btrim(piece->>'composer_reading'), '');
  v_category_name text := nullif(btrim(piece->>'category'), '');
  v_category_id   bigint;
  v_composer_id   bigint;
  v_piece_id      bigint;
  v_unknown       text;
begin
  if not is_editor() then
    raise exception '登録する権限がありません' using errcode = '42501';
  end if;
  if coalesce(btrim(piece->>'title'), '') = '' then
    raise exception '曲名を入力してください' using errcode = '22023';
  end if;

  select string_agg(e->>'key', ', ') into v_unknown
  from jsonb_array_elements(coalesce(piece->'instruments', '[]')) as e
  where not exists (select 1 from instruments i where i.key = e->>'key');
  if v_unknown is not null then
    raise exception '登録されていない楽器があります: %', v_unknown using errcode = '22023';
  end if;

  -- 分類はマスタ（categories）にあるものだけ選べる
  if v_category_name is not null then
    select id into v_category_id from categories where name = v_category_name;
    if v_category_id is null then
      raise exception '登録されていない分類です: %', v_category_name using errcode = '22023';
    end if;
  end if;

  -- 新しい作曲者は読みと一緒に追加。登録済みの作曲者は、読みが未登録のときだけ読みを補う
  if v_composer_name is not null then
    insert into composers (name, reading) values (v_composer_name, v_composer_reading) on conflict (name) do nothing;
    select id into v_composer_id from composers where name = v_composer_name;
    if v_composer_reading is not null then
      update composers set reading = v_composer_reading
      where id = v_composer_id and coalesce(reading, '') = '';
    end if;
  end if;

  insert into pieces (title, reading, subtitle, category_id, composer_id, arranger, year, year_label, remarks)
  values (
    btrim(piece->>'title'),
    coalesce(btrim(piece->>'reading'), ''),
    coalesce(btrim(piece->>'subtitle'), ''),
    v_category_id,
    v_composer_id,
    coalesce(btrim(piece->>'arranger'), ''),
    (piece->>'year')::int,
    coalesce(btrim(piece->>'year_label'), ''),
    coalesce(btrim(piece->>'remarks'), '')
  )
  returning id into v_piece_id;

  insert into piece_instruments (piece_id, instrument_id, parts, is_solo, is_optional, notation, position)
  select v_piece_id, i.id, (e->>'parts')::int,
         coalesce((e->>'solo')::boolean, false), coalesce((e->>'optional')::boolean, false),
         coalesce(btrim(e->>'notation'), ''), (t.ord - 1)::int
  from jsonb_array_elements(coalesce(piece->'instruments', '[]')) with ordinality as t (e, ord)
  join instruments i on i.key = t.e->>'key';

  return v_piece_id;
end;
$$;

revoke execute on function add_piece(jsonb) from public, anon;
grant execute on function add_piece(jsonb) to authenticated;

-- 登録担当者の追加：
--   1. Authentication → Users → 「Add user」でメールアドレスとパスワードを登録（Auto Confirm User にチェック）
--   2. 次の SQL のメールアドレスを書き換えて実行
-- insert into editors (user_id) select id from auth.users where email = 'you@example.com' on conflict do nothing;
