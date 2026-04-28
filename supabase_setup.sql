-- =============================================
-- 華耀東夷堂 Supabase セットアップSQL
-- Supabase Dashboard > SQL Editor に貼り付けて実行
-- =============================================

-- boards
create table if not exists boards (
  id         uuid default gen_random_uuid() primary key,
  name       text not null,
  slug       text not null unique,
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

-- RLS 無効化（パブリックBBS）
alter table boards  disable row level security;
alter table threads disable row level security;
alter table posts   disable row level security;

-- インデックス
create index if not exists idx_threads_board_id on threads(board_id);
create index if not exists idx_posts_thread_id  on posts(thread_id);

-- =============================================
-- 初期板データ
-- =============================================
insert into boards (name, slug) values
  ('競輪',       'keirin'),
  ('競馬',       'keiba'),
  ('競艇',       'kyotei'),
  ('オートレース','auto'),
  ('パチンコ・スロット','pachislot'),
  ('雑談',       'misc')
on conflict (slug) do nothing;

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
