-- AI video assets (TopView URL-to-Video và các nguồn AI khác).
-- Mọi asset do AI sinh ra đều mang provenance AI_GENERATED_UNVERIFIED và bị chặn
-- cho tới khi một người thật duyệt từng claim. Gate được cưỡng chế tại DB,
-- không chỉ ở UI, giống cách save_performance_decision chặn lineage báo cáo.

create table if not exists public.content_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  content_variant_id uuid references public.content_variants(id) on delete set null,
  provenance text not null check (provenance in ('USER_AUTHORED','AI_ASSISTED','AI_GENERATED_UNVERIFIED')),
  generator text not null check (generator in ('TOPVIEW_API','TOPVIEW_WEB_MANUAL','OTHER_MANUAL')),
  provider_task_id text,
  source_url text,
  video_url text,
  generated_script text,
  detected_claims jsonb not null default '[]'::jsonb,
  claim_reviews jsonb not null default '[]'::jsonb,
  review_status text not null default 'AI_DRAFT'
    check (review_status in ('GENERATING','AI_DRAFT','UNDER_REVIEW','APPROVED','REJECTED','FAILED')),
  aigc_label_required boolean not null default true,
  aigc_label_acknowledged boolean not null default false,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  review_note text,
  credit_cost numeric(10,2) not null default 0 check (credit_cost >= 0),
  cost_vnd numeric(16,2) not null default 0 check (cost_vnd >= 0),
  duration_seconds integer check (duration_seconds is null or duration_seconds > 0),
  content_hash text not null,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, content_hash)
);
create index if not exists content_assets_user_status_idx on public.content_assets(user_id, review_status, created_at desc);
create index if not exists content_assets_task_idx on public.content_assets(user_id, provider_task_id) where provider_task_id is not null;

alter table public.content_assets enable row level security;
drop policy if exists owner_all on public.content_assets;
create policy owner_all on public.content_assets for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop trigger if exists set_updated_at on public.content_assets;
create trigger set_updated_at before update on public.content_assets
  for each row execute function public.set_updated_at();

-- Ghi nhận một asset mới. Script do AI sinh và danh sách claim phát hiện được
-- lưu nguyên trạng để người duyệt đọc lại đúng thứ đã được tạo ra.
create or replace function public.save_content_asset(
  p_product_item_id text, p_generator text, p_provenance text, p_source_url text,
  p_video_url text, p_generated_script text, p_detected_claims jsonb,
  p_duration_seconds integer, p_credit_cost numeric, p_cost_vnd numeric,
  p_provider_task_id text, p_review_status text, p_content_hash text
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_product_id uuid;
  v_asset_id uuid;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_provenance not in ('USER_AUTHORED','AI_ASSISTED','AI_GENERATED_UNVERIFIED') then raise exception 'INVALID_PROVENANCE'; end if;
  if p_review_status not in ('GENERATING','AI_DRAFT') then raise exception 'INVALID_INITIAL_REVIEW_STATUS'; end if;
  if p_provenance = 'AI_GENERATED_UNVERIFIED' and p_review_status = 'AI_DRAFT'
     and coalesce(btrim(p_generated_script), '') = '' then
    raise exception 'SCRIPT_REQUIRED_FOR_AI_CONTENT';
  end if;

  select id into v_product_id from public.products
    where user_id = v_user_id and item_id = p_product_item_id;
  if v_product_id is null then raise exception 'PRODUCT_NOT_FOUND'; end if;

  insert into public.content_assets(
    user_id, product_id, provenance, generator, provider_task_id, source_url, video_url,
    generated_script, detected_claims, review_status, aigc_label_required,
    duration_seconds, credit_cost, cost_vnd, content_hash
  ) values (
    v_user_id, v_product_id, p_provenance, p_generator, p_provider_task_id, p_source_url, p_video_url,
    p_generated_script, coalesce(p_detected_claims, '[]'::jsonb), p_review_status,
    p_provenance <> 'USER_AUTHORED', p_duration_seconds,
    coalesce(p_credit_cost, 0), coalesce(p_cost_vnd, 0), p_content_hash
  )
  on conflict (user_id, content_hash) do nothing
  returning id into v_asset_id;

  if v_asset_id is null then
    select id into v_asset_id from public.content_assets
      where user_id = v_user_id and content_hash = p_content_hash;
    return v_asset_id;
  end if;

  insert into public.audit_logs(user_id, action, entity_type, entity_id, metadata)
  values (v_user_id, 'CONTENT_ASSET_CREATED', 'content_asset', v_asset_id::text,
    jsonb_build_object('generator', p_generator, 'provenance', p_provenance,
      'claim_count', jsonb_array_length(coalesce(p_detected_claims, '[]'::jsonb)), 'cost_vnd', coalesce(p_cost_vnd, 0)));
  return v_asset_id;
end;
$$;

-- Review gate. Không duyệt thì asset không bao giờ ra được experiment.
create or replace function public.review_content_asset(
  p_asset_id uuid, p_decision text, p_claim_reviews jsonb,
  p_aigc_label_acknowledged boolean, p_review_note text
) returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_asset public.content_assets%rowtype;
  v_unresolved integer;
  v_next_status text;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_decision not in ('APPROVE','REJECT') then raise exception 'INVALID_REVIEW_DECISION'; end if;

  select * into v_asset from public.content_assets
    where id = p_asset_id and user_id = v_user_id for update;
  if v_asset.id is null then raise exception 'CONTENT_ASSET_NOT_FOUND'; end if;
  if v_asset.review_status in ('GENERATING','FAILED') then raise exception 'CONTENT_NOT_REVIEWABLE'; end if;

  v_next_status := case when p_decision = 'APPROVE' then 'APPROVED' else 'REJECTED' end;

  if p_decision = 'REJECT' and coalesce(btrim(p_review_note), '') = '' then
    raise exception 'REVIEW_NOTE_REQUIRED';
  end if;

  if p_decision = 'APPROVE' then
    if v_asset.aigc_label_required and coalesce(p_aigc_label_acknowledged, false) = false then
      raise exception 'AIGC_LABEL_NOT_ACKNOWLEDGED';
    end if;
    if v_asset.provenance = 'AI_GENERATED_UNVERIFIED' then
      if coalesce(btrim(v_asset.generated_script), '') = '' then raise exception 'NO_SCRIPT_TO_REVIEW'; end if;
      if coalesce(btrim(p_review_note), '') = '' then raise exception 'REVIEW_NOTE_REQUIRED'; end if;
      if jsonb_array_length(coalesce(p_claim_reviews, '[]'::jsonb)) <> jsonb_array_length(v_asset.detected_claims) then
        raise exception 'CLAIM_COUNT_MISMATCH';
      end if;
      select count(*) into v_unresolved
        from jsonb_array_elements(coalesce(p_claim_reviews, '[]'::jsonb)) as entry
        where entry->>'risk' = 'HIGH' and entry->>'verdict' = 'UNVERIFIED';
      if v_unresolved > 0 then raise exception 'UNRESOLVED_HIGH_RISK_CLAIM'; end if;
    end if;
  end if;

  update public.content_assets set
    review_status = v_next_status,
    claim_reviews = coalesce(p_claim_reviews, '[]'::jsonb),
    aigc_label_acknowledged = coalesce(p_aigc_label_acknowledged, false),
    review_note = nullif(btrim(p_review_note), ''),
    reviewed_by = v_user_id,
    reviewed_at = now()
  where id = p_asset_id;

  insert into public.audit_logs(user_id, action, entity_type, entity_id, metadata)
  values (v_user_id, 'CONTENT_ASSET_REVIEWED', 'content_asset', p_asset_id::text,
    jsonb_build_object('decision', p_decision, 'status', v_next_status,
      'provenance', v_asset.provenance, 'claim_count', jsonb_array_length(v_asset.detected_claims)));
  return v_next_status;
end;
$$;

-- Chỉ asset đã APPROVED mới được gắn vào content variant/experiment để lấy tracking link.
create or replace function public.attach_content_asset(
  p_asset_id uuid, p_content_variant_id uuid
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_status text;
  v_variant uuid;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  select review_status into v_status from public.content_assets
    where id = p_asset_id and user_id = v_user_id;
  if v_status is null then raise exception 'CONTENT_ASSET_NOT_FOUND'; end if;
  if v_status <> 'APPROVED' then raise exception 'CONTENT_REVIEW_REQUIRED'; end if;

  select id into v_variant from public.content_variants
    where id = p_content_variant_id and user_id = v_user_id;
  if v_variant is null then raise exception 'CONTENT_VARIANT_NOT_FOUND'; end if;

  update public.content_assets set content_variant_id = v_variant where id = p_asset_id;

  insert into public.audit_logs(user_id, action, entity_type, entity_id, metadata)
  values (v_user_id, 'CONTENT_ASSET_ATTACHED', 'content_asset', p_asset_id::text,
    jsonb_build_object('content_variant_id', v_variant));
end;
$$;

create or replace function public.profitos_schema_version()
returns integer
language sql
stable
security definer
set search_path = public
as $$ select 10 $$;

revoke all on function public.profitos_schema_version() from public;
grant execute on function public.profitos_schema_version() to anon, authenticated;
