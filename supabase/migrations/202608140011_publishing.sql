-- Auto-publish sang YouTube (công khai) và TikTok (nháp trong inbox người dùng).
-- Token OAuth KHÔNG được đọc bằng session của browser: bảng bật RLS và cố tình
-- không có policy nào, nên chỉ service-role key phía server chạm được. Trạng thái
-- kết nối hiển thị cho UI qua view riêng không chứa secret.

create table if not exists public.platform_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('YOUTUBE','TIKTOK')),
  external_account_id text,
  external_account_name text,
  access_token text not null,
  refresh_token text,
  scopes text[] not null default '{}',
  expires_at timestamptz,
  status text not null default 'CONNECTED' check (status in ('CONNECTED','EXPIRED','REVOKED')),
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, platform)
);

alter table public.platform_connections enable row level security;
-- Không tạo policy: authenticated/anon không đọc hay ghi được token.
drop policy if exists owner_all on public.platform_connections;

drop trigger if exists set_updated_at on public.platform_connections;
create trigger set_updated_at before update on public.platform_connections
  for each row execute function public.set_updated_at();

create or replace view public.platform_connection_status
with (security_invoker = true) as
  select user_id, platform, external_account_name, status, expires_at, connected_at
  from public.platform_connections
  where user_id = auth.uid();
grant select on public.platform_connection_status to authenticated;

create table if not exists public.publish_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content_asset_id uuid not null references public.content_assets(id) on delete cascade,
  platform text not null check (platform in ('YOUTUBE','TIKTOK')),
  mode text not null check (mode in ('DIRECT_PUBLIC','DRAFT_INBOX')),
  media_kind text not null check (media_kind in ('VIDEO','PHOTO')),
  external_id text,
  status text not null check (status in ('SUBMITTED','PROCESSING','PUBLISHED','FAILED')),
  tracking_key text not null,
  affiliate_url text not null,
  caption text,
  failure_reason text,
  created_at timestamptz not null default now()
);
create index if not exists publish_attempts_user_time_idx on public.publish_attempts(user_id, created_at desc);

alter table public.publish_attempts enable row level security;
drop policy if exists owner_all on public.publish_attempts;
create policy owner_all on public.publish_attempts for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Chỉ asset đã APPROVED và có link affiliate gắn Sub_id mới được đăng.
-- Đăng mà không có attribution thì bước tính lãi sau đó vô nghĩa.
create or replace function public.record_publish_attempt(
  p_asset_id uuid, p_platform text, p_mode text, p_media_kind text,
  p_external_id text, p_status text, p_tracking_key text,
  p_affiliate_url text, p_caption text, p_failure_reason text
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_review_status text;
  v_attempt_id uuid;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_platform not in ('YOUTUBE','TIKTOK') then raise exception 'UNSUPPORTED_PLATFORM'; end if;
  if coalesce(btrim(p_tracking_key), '') = '' then raise exception 'TRACKING_KEY_REQUIRED'; end if;
  if coalesce(btrim(p_affiliate_url), '') = '' then raise exception 'AFFILIATE_URL_REQUIRED'; end if;

  select review_status into v_review_status from public.content_assets
    where id = p_asset_id and user_id = v_user_id;
  if v_review_status is null then raise exception 'CONTENT_ASSET_NOT_FOUND'; end if;
  if v_review_status <> 'APPROVED' then raise exception 'CONTENT_REVIEW_REQUIRED'; end if;

  insert into public.publish_attempts(
    user_id, content_asset_id, platform, mode, media_kind, external_id,
    status, tracking_key, affiliate_url, caption, failure_reason
  ) values (
    v_user_id, p_asset_id, p_platform, p_mode, p_media_kind, p_external_id,
    p_status, p_tracking_key, p_affiliate_url, p_caption, p_failure_reason
  ) returning id into v_attempt_id;

  insert into public.audit_logs(user_id, action, entity_type, entity_id, metadata)
  values (v_user_id, 'CONTENT_PUBLISHED', 'publish_attempt', v_attempt_id::text,
    jsonb_build_object('platform', p_platform, 'mode', p_mode, 'status', p_status,
      'tracking_key', p_tracking_key, 'external_id', p_external_id));
  return v_attempt_id;
end;
$$;

-- Kho media: browser upload thẳng lên Storage để không chạm giới hạn body của
-- serverless function. Mỗi người chỉ ghi/xoá được trong thư mục mang id của mình.
insert into storage.buckets (id, name, public)
values ('content-media', 'content-media', true)
on conflict (id) do nothing;

drop policy if exists content_media_read on storage.objects;
create policy content_media_read on storage.objects for select
  using (bucket_id = 'content-media');

drop policy if exists content_media_write on storage.objects;
create policy content_media_write on storage.objects for insert to authenticated
  with check (bucket_id = 'content-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists content_media_delete on storage.objects;
create policy content_media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'content-media' and (storage.foldername(name))[1] = auth.uid()::text);

create or replace function public.profitos_schema_version()
returns integer
language sql
stable
security definer
set search_path = public
as $$ select 11 $$;

revoke all on function public.profitos_schema_version() from public;
grant execute on function public.profitos_schema_version() to anon, authenticated;
