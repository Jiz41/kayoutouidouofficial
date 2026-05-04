-- =============================================
-- 華耀東夷堂 管理機能 追加SQL
-- Supabase Dashboard > SQL Editor で実行
-- =============================================

-- boards に表示順カラム追加
alter table boards add column if not exists sort_order int default 0;
update boards set sort_order = 0 where sort_order is null;

-- bans テーブル（anon_id BAN）
create table if not exists bans (
  id         uuid default gen_random_uuid() primary key,
  anon_id    text not null unique,
  reason     text,
  created_at timestamptz default now()
);

-- reports テーブル（通報）
create table if not exists reports (
  id          uuid default gen_random_uuid() primary key,
  post_id     uuid references posts(id) on delete cascade,
  thread_id   uuid references threads(id) on delete cascade,
  reason      text not null,
  reporter_id text,
  is_resolved boolean default false,
  created_at  timestamptz default now()
);

-- RLS
alter table bans    enable row level security;
alter table reports enable row level security;

-- bans: 匿名は読み取りのみ（insert_post RPCのBANチェックに必要）、書き込みは認証済みのみ
drop policy if exists "public_all_bans"  on bans;
drop policy if exists "anon_read_bans"   on bans;
drop policy if exists "auth_write_bans"  on bans;
create policy "anon_read_bans"  on bans for select using (true);
create policy "auth_write_bans" on bans for all to authenticated using (true) with check (true);

-- reports: 匿名はINSERTのみ（通報機能）、読み取り・更新・削除は認証済みのみ
drop policy if exists "public_all_reports"  on reports;
drop policy if exists "anon_insert_reports" on reports;
drop policy if exists "auth_write_reports"  on reports;
create policy "anon_insert_reports" on reports for insert with check (true);
create policy "auth_write_reports"  on reports for all to authenticated using (true) with check (true);

-- インデックス
create index if not exists idx_bans_anon_id       on bans(anon_id);
create index if not exists idx_reports_post_id    on reports(post_id);
create index if not exists idx_reports_is_resolved on reports(is_resolved);

-- Realtime
alter table bans    replica identity full;
alter table reports replica identity full;
