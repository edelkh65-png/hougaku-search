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
-- （列がない新しい環境では、if の中は実行されない）
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'pieces' and column_name = 'category') then
    insert into categories (name, sort_order)
    select distinct category, 100 from pieces where nullif(btrim(category), '') is not null
    on conflict (name) do nothing;
    update pieces p set category_id = c.id
    from categories c where c.name = p.category and p.category_id is null;
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

-- ---- 曲の登録・修正 ----
-- piece の例：
--   {"title": "春の海", "reading": "はるのうみ", "category": "現代曲", "composer": "宮城道雄", "composer_reading": "みやぎみちお", "year": 1929,
--    "instruments": [{"key": "koto", "parts": 1}, {"key": "shakuhachi", "parts": 1}]}
-- ※ 変数への代入は「変数 := (select …)」の形で書く。
--    SELECT 文で直接変数に入れる書き方は、Supabase の SQL Editor が表の作成と誤認し、実行できなくなるため

-- 曲名と楽器を確認する（登録・修正で共通）
create or replace function check_piece(piece jsonb) returns void
language plpgsql stable security invoker set search_path = public
as $$
declare
  v_unknown text;
begin
  if not is_editor() then
    raise exception '登録・修正する権限がありません' using errcode = '42501';
  end if;
  if coalesce(btrim(piece->>'title'), '') = '' then
    raise exception '曲名を入力してください' using errcode = '22023';
  end if;
  v_unknown := (
    select string_agg(e->>'key', ', ')
    from jsonb_array_elements(coalesce(piece->'instruments', '[]')) as e
    where not exists (select 1 from instruments i where i.key = e->>'key')
  );
  if v_unknown is not null then
    raise exception '登録されていない楽器があります: %', v_unknown using errcode = '22023';
  end if;
end;
$$;

-- 分類名 → 分類の id（マスタ categories にある分類だけ選べる）
create or replace function piece_category_id(p_name text) returns bigint
language plpgsql stable security invoker set search_path = public
as $$
declare
  v_id bigint;
begin
  if nullif(btrim(p_name), '') is null then
    return null;
  end if;
  v_id := (select id from categories where name = btrim(p_name));
  if v_id is null then
    raise exception '登録されていない分類です: %', p_name using errcode = '22023';
  end if;
  return v_id;
end;
$$;

-- 作曲者名 → 作曲者の id。新しい作曲者は読みと一緒に追加し、
-- 登録済みの作曲者は、読みが未登録のときだけ読みを補う
create or replace function piece_composer_id(p_name text, p_reading text) returns bigint
language plpgsql security invoker set search_path = public
as $$
declare
  v_name text := nullif(btrim(p_name), '');
  v_reading text := nullif(btrim(p_reading), '');
  v_id bigint;
begin
  if v_name is null then
    return null;
  end if;
  insert into composers (name, reading) values (v_name, v_reading) on conflict (name) do nothing;
  v_id := (select id from composers where name = v_name);
  if v_reading is not null then
    update composers set reading = v_reading where id = v_id and coalesce(reading, '') = '';
  end if;
  return v_id;
end;
$$;

-- 曲の楽器編成を、piece の instruments の順に追加する
create or replace function insert_piece_instruments(p_piece_id bigint, piece jsonb) returns void
language sql security invoker set search_path = public
as $$
  insert into piece_instruments (piece_id, instrument_id, parts, is_solo, is_optional, notation, position)
  select p_piece_id, i.id, (t.e->>'parts')::int,
         coalesce((t.e->>'solo')::boolean, false), coalesce((t.e->>'optional')::boolean, false),
         coalesce(btrim(t.e->>'notation'), ''), (t.ord - 1)::int
  from jsonb_array_elements(coalesce(piece->'instruments', '[]')) with ordinality as t (e, ord)
  join instruments i on i.key = t.e->>'key';
$$;

-- 1曲分（曲の情報と楽器編成）をまとめて登録する。途中で失敗した場合は何も登録されない
create or replace function add_piece(piece jsonb) returns bigint
language plpgsql security invoker set search_path = public
as $$
declare
  v_category_id bigint;
  v_composer_id bigint;
  v_piece_id    bigint;
begin
  perform check_piece(piece);
  v_category_id := piece_category_id(piece->>'category');
  v_composer_id := piece_composer_id(piece->>'composer', piece->>'composer_reading');

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

  perform insert_piece_instruments(v_piece_id, piece);
  return v_piece_id;
end;
$$;

-- 登録済みの1曲（target_id）の情報と楽器編成をまとめて修正する。途中で失敗した場合は何も変わらない
-- 楽器編成は、いったん消してから piece の内容で入れ直す
create or replace function update_piece(target_id bigint, piece jsonb) returns bigint
language plpgsql security invoker set search_path = public
as $$
declare
  v_category_id bigint;
  v_composer_id bigint;
begin
  perform check_piece(piece);
  v_category_id := piece_category_id(piece->>'category');
  v_composer_id := piece_composer_id(piece->>'composer', piece->>'composer_reading');

  update pieces set
    title       = btrim(piece->>'title'),
    reading     = coalesce(btrim(piece->>'reading'), ''),
    subtitle    = coalesce(btrim(piece->>'subtitle'), ''),
    category_id = v_category_id,
    composer_id = v_composer_id,
    arranger    = coalesce(btrim(piece->>'arranger'), ''),
    year        = (piece->>'year')::int,
    year_label  = coalesce(btrim(piece->>'year_label'), ''),
    remarks     = coalesce(btrim(piece->>'remarks'), '')
  where id = target_id;
  if not found then
    raise exception '修正する曲が見つかりません（id: %）', target_id using errcode = 'P0002';
  end if;

  delete from piece_instruments where piece_instruments.piece_id = target_id;
  perform insert_piece_instruments(target_id, piece);
  return target_id;
end;
$$;

-- ログインしていない人は、登録・修正の関数を使えない
revoke execute on function check_piece(jsonb) from public, anon;
revoke execute on function piece_category_id(text) from public, anon;
revoke execute on function piece_composer_id(text, text) from public, anon;
revoke execute on function insert_piece_instruments(bigint, jsonb) from public, anon;
revoke execute on function add_piece(jsonb) from public, anon;
revoke execute on function update_piece(bigint, jsonb) from public, anon;
grant execute on function check_piece(jsonb) to authenticated;
grant execute on function piece_category_id(text) to authenticated;
grant execute on function piece_composer_id(text, text) to authenticated;
grant execute on function insert_piece_instruments(bigint, jsonb) to authenticated;
grant execute on function add_piece(jsonb) to authenticated;
grant execute on function update_piece(bigint, jsonb) to authenticated;

-- 登録担当者の追加：
--   1. Authentication → Users → 「Add user」でメールアドレスとパスワードを登録（Auto Confirm User にチェック）
--   2. 次の SQL のメールアドレスを書き換えて実行
-- insert into editors (user_id) select id from auth.users where email = 'you@example.com' on conflict do nothing;
