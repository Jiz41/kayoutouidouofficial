-- =============================================
-- 華耀東夷堂 Supabase セットアップSQL
-- Supabase Dashboard > SQL Editor に貼り付けて実行
-- =============================================

-- boards
create table if not exists boards (
  id         uuid default gen_random_uuid() primary key,
  name       text not null,
  slug       text not null unique,
  emoji      text not null default '📋',
  created_at timestamptz default now()
);

-- threads
create table if not exists threads (
  id         uuid default gen_random_uuid() primary key,
  board_id   uuid references boards(id) on delete cascade,
  title      text not null,
  post_count int  default 0,
  is_active  boolean default true,
  created_at timestamptz default now()
);

-- posts
create table if not exists posts (
  id          uuid default gen_random_uuid() primary key,
  thread_id   uuid references threads(id) on delete cascade,
  body        text not null,
  anon_id     text not null,
  post_number int  not null,
  created_at  timestamptz default now()
);

-- RLS 有効化
alter table boards  enable row level security;
alter table threads enable row level security;
alter table posts   enable row level security;

-- boards: 匿名は読み取りのみ、書き込みは認証済みユーザーのみ
drop policy if exists "public_all_boards"  on boards;
drop policy if exists "anon_read_boards"   on boards;
drop policy if exists "auth_write_boards"  on boards;
create policy "anon_read_boards"  on boards for select using (true);
create policy "auth_write_boards" on boards for all to authenticated using (true) with check (true);

-- threads: 匿名は読み取り・INSERT のみ、更新・削除は認証済みユーザーのみ
drop policy if exists "public_all_threads"   on threads;
drop policy if exists "anon_read_threads"    on threads;
drop policy if exists "anon_insert_threads"  on threads;
drop policy if exists "auth_update_threads"  on threads;
drop policy if exists "auth_delete_threads"  on threads;
create policy "anon_read_threads"   on threads for select using (true);
create policy "auth_update_threads" on threads for update to authenticated using (true);
create policy "auth_delete_threads" on threads for delete to authenticated using (true);

-- posts: 匿名は読み取りのみ、INSERT はRPC経由（security definer）、削除は認証済みのみ
drop policy if exists "public_all_posts"  on posts;
drop policy if exists "anon_read_posts"   on posts;
drop policy if exists "auth_delete_posts" on posts;
create policy "anon_read_posts"   on posts for select using (true);
create policy "auth_delete_posts" on posts for delete to authenticated using (true);

-- インデックス
create index if not exists idx_threads_board_id on threads(board_id);
create index if not exists idx_posts_thread_id  on posts(thread_id);

-- =============================================
-- Realtime設定（postgres_changes に必須）
-- =============================================
alter table posts   replica identity full;
alter table threads replica identity full;
alter table boards  replica identity full;

-- supabase_realtime パブリケーションにテーブルを追加
-- （既に追加済みの場合はエラーになるが無視してよい）
alter publication supabase_realtime add table posts;
alter publication supabase_realtime add table threads;
alter publication supabase_realtime add table boards;

-- =============================================
-- 初期板データ
-- =============================================
insert into boards (name, slug, emoji) values
  ('競輪',             'keirin',    '🚴'),
  ('競馬',             'keiba',     '🐎'),
  ('競艇',             'kyotei',    '⛵'),
  ('オートレース',     'auto',      '🏍'),
  ('パチンコ・スロット','pachislot', '🎰'),
  ('雑談',             'misc',      '💬')
on conflict (slug) do update set emoji = excluded.emoji;

-- =============================================
-- RPC: 投稿挿入（post_number 採番をアトミックに）
-- =============================================
create or replace function insert_post(
  p_thread_id uuid,
  p_body      text,
  p_anon_id   text
) returns posts as $$
declare
  v_count int;
  v_num   int;
  v_post  posts;
begin
  -- BANチェック
  if exists (select 1 from bans where anon_id = p_anon_id) then
    raise exception 'banned';
  end if;

  -- 30秒連投チェック
  if exists (
    select 1 from posts
    where anon_id = p_anon_id
      and created_at > now() - interval '30 seconds'
    limit 1
  ) then
    raise exception '連続投稿制限中です（30秒）';
  end if;

  -- スレッドをロック
  select post_count into v_count
  from threads where id = p_thread_id for update;

  if v_count >= 1000 then
    raise exception 'このスレッドは満スレです';
  end if;

  select coalesce(max(post_number), 0) + 1 into v_num
  from posts where thread_id = p_thread_id;

  insert into posts (thread_id, body, anon_id, post_number)
  values (p_thread_id, p_body, p_anon_id, v_num)
  returning * into v_post;

  update threads
  set
    post_count = post_count + 1,
    is_active  = (post_count + 1 < 1000)
  where id = p_thread_id;

  return v_post;
end;
$$ language plpgsql security definer;

-- =============================================
-- RPC: スレッド作成（first post を同時挿入）
-- =============================================
create or replace function create_thread(
  p_board_id uuid,
  p_title    text,
  p_body     text,
  p_anon_id  text
) returns threads as $$
declare
  v_thread threads;
begin
  insert into threads (board_id, title, post_count, is_active)
  values (p_board_id, p_title, 1, true)
  returning * into v_thread;

  insert into posts (thread_id, body, anon_id, post_number)
  values (v_thread.id, p_body, p_anon_id, 1);

  return v_thread;
end;
$$ language plpgsql security definer;
