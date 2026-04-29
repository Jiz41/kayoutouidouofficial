-- =============================================
-- 華耀東夷堂 カテゴリ機能 追加SQL
-- Supabase Dashboard > SQL Editor で実行
-- =============================================

-- categories テーブル
create table if not exists categories (
  id         uuid default gen_random_uuid() primary key,
  name       text not null,
  sort_order int  default 0,
  created_at timestamptz default now()
);

-- boards に category_id を追加（NULL = 未分類）
alter table boards add column if not exists category_id uuid references categories(id) on delete set null;

-- RLS
alter table categories enable row level security;
drop policy if exists "public_all_categories" on categories;
create policy "public_all_categories" on categories for all using (true) with check (true);

-- インデックス
create index if not exists idx_boards_category_id on boards(category_id);

-- Realtime
alter table categories replica identity full;
alter publication supabase_realtime add table categories;

-- =============================================
-- 初期カテゴリデータ
-- =============================================
insert into categories (name, sort_order) values
  ('公営競技', 1),
  ('ギャンブル', 2),
  ('雑談', 3)
on conflict do nothing;

-- 既存板をカテゴリに紐付け（slugで判定）
update boards set category_id = (select id from categories where name = '公営競技' limit 1)
  where slug in ('keirin', 'keiba', 'kyotei', 'auto');

update boards set category_id = (select id from categories where name = 'ギャンブル' limit 1)
  where slug = 'pachislot';

update boards set category_id = (select id from categories where name = '雑談' limit 1)
  where slug = 'misc';
