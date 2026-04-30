-- =============================================
-- 華耀東夷堂 画像ストレージ セットアップSQL
-- Supabase Dashboard > SQL Editor で実行
-- =============================================

-- post-images バケット作成（公開・5MB制限）
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'post-images',
  'post-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
)
on conflict (id) do nothing;

-- アップロードポリシー（匿名含む全ユーザー）
drop policy if exists "allow public upload post-images" on storage.objects;
create policy "allow public upload post-images"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'post-images');

-- 読み取りポリシー
drop policy if exists "allow public read post-images" on storage.objects;
create policy "allow public read post-images"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'post-images');
