-- Hai chương trình affiliate song song với hai cơ chế attribution khác nhau:
--   SHOPEE      → SUB_ID: bạn tự gắn mã, báo cáo trả về mã đó.
--   TIKTOK_SHOP → NATIVE_CONTENT: TikTok tự quy đơn về video/showcase, không có mã tự đặt.
-- Vì vậy publish gate và lưu báo cáo phải phân biệt theo chương trình.

alter table public.products
  add column if not exists affiliate_program text not null default 'SHOPEE'
    check (affiliate_program in ('SHOPEE','TIKTOK_SHOP'));

alter table public.content_experiments
  add column if not exists affiliate_program text not null default 'SHOPEE'
    check (affiliate_program in ('SHOPEE','TIKTOK_SHOP'));

alter table public.publish_attempts
  add column if not exists affiliate_program text not null default 'SHOPEE'
    check (affiliate_program in ('SHOPEE','TIKTOK_SHOP')),
  add column if not exists showcase_product_id text,
  add column if not exists link_strategy text
    check (link_strategy is null or link_strategy in ('IN_DESCRIPTION','BIO_REDIRECT','NATIVE_SHOWCASE'));

-- TikTok Shop không có Sub_id nên tracking_key rỗng là hợp lệ với chương trình đó,
-- nhưng khi ấy bắt buộc phải có sản phẩm gắn vào video.
alter table public.publish_attempts drop constraint if exists publish_attempts_attribution_check;
alter table public.publish_attempts add constraint publish_attempts_attribution_check check (
  (affiliate_program = 'SHOPEE' and coalesce(btrim(tracking_key), '') <> '')
  or (affiliate_program = 'TIKTOK_SHOP' and coalesce(btrim(showcase_product_id), '') <> '')
);

alter table public.import_runs drop constraint if exists import_runs_import_type_check;
alter table public.import_runs add constraint import_runs_import_type_check check (
  import_type in ('PRODUCT_EXPORT','CLICK_REPORT','CONVERSION_REPORT','TIKTOK_SHOP_REPORT')
);

-- Attribution theo nội dung cho TikTok Shop. Khoá là mã video do TikTok cấp.
create table if not exists public.content_attributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  import_run_id uuid not null references public.import_runs(id) on delete cascade,
  affiliate_program text not null check (affiliate_program in ('TIKTOK_SHOP')),
  content_key text not null,
  orders bigint not null default 0 check (orders >= 0),
  valid_orders bigint not null default 0 check (valid_orders >= 0),
  validated_commission numeric(16,2) not null default 0 check (validated_commission >= 0),
  pending_commission numeric(16,2) not null default 0 check (pending_commission >= 0),
  revenue numeric(16,2) not null default 0 check (revenue >= 0),
  period_start date not null,
  period_end date not null,
  created_at timestamptz not null default now(),
  unique (user_id, import_run_id, content_key),
  check (valid_orders <= orders),
  check (period_start <= period_end)
);
create index if not exists content_attributions_user_content_idx
  on public.content_attributions(user_id, content_key, period_end desc);

alter table public.content_attributions enable row level security;
drop policy if exists owner_all on public.content_attributions;
create policy owner_all on public.content_attributions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Lưu báo cáo TikTok Shop: chỉ giữ hash + tổng hợp, không lưu nguyên file.
create or replace function public.import_tiktok_shop_report(
  p_source_filename text, p_content_hash text, p_period_start date, p_period_end date,
  p_summary jsonb, p_groups jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_import_run_id uuid;
  v_group jsonb;
  v_row_count integer := jsonb_array_length(coalesce(p_groups, '[]'::jsonb));
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_content_hash !~ '^[a-f0-9]{64}$' then raise exception 'INVALID_CONTENT_HASH'; end if;
  if p_period_start > p_period_end or p_period_end - p_period_start > 366 then raise exception 'INVALID_REPORTING_PERIOD'; end if;

  select id into v_import_run_id from public.import_runs
    where user_id = v_user_id and content_hash = p_content_hash;
  if v_import_run_id is not null then
    return jsonb_build_object('importRunId', v_import_run_id, 'duplicate', true, 'rowCount', v_row_count);
  end if;

  insert into public.import_runs(user_id, import_type, source_filename, content_hash, row_count, status, parsed_summary)
  values (v_user_id, 'TIKTOK_SHOP_REPORT', p_source_filename, p_content_hash, v_row_count, 'PROCESSING',
    coalesce(p_summary, '{}'::jsonb) || jsonb_build_object('periodStart', p_period_start::text, 'periodEnd', p_period_end::text))
  returning id into v_import_run_id;

  for v_group in select value from jsonb_array_elements(coalesce(p_groups, '[]'::jsonb)) loop
    if coalesce(btrim(v_group->>'contentKey'), '') = '' then raise exception 'INVALID_CONTENT_KEY'; end if;
    insert into public.content_attributions(
      user_id, import_run_id, affiliate_program, content_key, orders, valid_orders,
      validated_commission, pending_commission, revenue, period_start, period_end
    ) values (
      v_user_id, v_import_run_id, 'TIKTOK_SHOP', v_group->>'contentKey',
      coalesce((v_group->>'orders')::bigint, 0), coalesce((v_group->>'validOrders')::bigint, 0),
      coalesce((v_group->>'validatedCommission')::numeric, 0), coalesce((v_group->>'pendingCommission')::numeric, 0),
      coalesce((v_group->>'revenue')::numeric, 0), p_period_start, p_period_end
    ) on conflict (user_id, import_run_id, content_key) do nothing;
  end loop;

  update public.import_runs set status = 'COMPLETED' where id = v_import_run_id;
  insert into public.audit_logs(user_id, action, entity_type, entity_id, metadata)
  values (v_user_id, 'TIKTOK_SHOP_REPORT_IMPORTED', 'import_run', v_import_run_id::text,
    jsonb_build_object('row_count', v_row_count, 'period_start', p_period_start, 'period_end', p_period_end));
  return jsonb_build_object('importRunId', v_import_run_id, 'duplicate', false, 'rowCount', v_row_count);
end;
$$;

revoke all on function public.import_tiktok_shop_report(text,text,date,date,jsonb,jsonb) from public;
grant execute on function public.import_tiktok_shop_report(text,text,date,date,jsonb,jsonb) to authenticated;

-- record_publish_attempt phải hiểu chương trình nào cần gì.
create or replace function public.record_publish_attempt(
  p_asset_id uuid, p_platform text, p_mode text, p_media_kind text,
  p_external_id text, p_status text, p_tracking_key text,
  p_affiliate_url text, p_caption text, p_failure_reason text,
  p_affiliate_program text, p_showcase_product_id text, p_link_strategy text
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
  if p_affiliate_program not in ('SHOPEE','TIKTOK_SHOP') then raise exception 'UNSUPPORTED_PROGRAM'; end if;
  if p_affiliate_program = 'TIKTOK_SHOP' and p_platform <> 'TIKTOK' then raise exception 'PROGRAM_PLATFORM_MISMATCH'; end if;

  if p_affiliate_program = 'SHOPEE' then
    if coalesce(btrim(p_tracking_key), '') = '' then raise exception 'TRACKING_KEY_REQUIRED'; end if;
    if coalesce(btrim(p_affiliate_url), '') = '' then raise exception 'AFFILIATE_URL_REQUIRED'; end if;
  elsif coalesce(btrim(p_showcase_product_id), '') = '' then
    raise exception 'SHOWCASE_PRODUCT_REQUIRED';
  end if;

  select review_status into v_review_status from public.content_assets
    where id = p_asset_id and user_id = v_user_id;
  if v_review_status is null then raise exception 'CONTENT_ASSET_NOT_FOUND'; end if;
  if v_review_status <> 'APPROVED' then raise exception 'CONTENT_REVIEW_REQUIRED'; end if;

  insert into public.publish_attempts(
    user_id, content_asset_id, platform, mode, media_kind, external_id,
    status, tracking_key, affiliate_url, caption, failure_reason,
    affiliate_program, showcase_product_id, link_strategy
  ) values (
    v_user_id, p_asset_id, p_platform, p_mode, p_media_kind, p_external_id,
    p_status, coalesce(p_tracking_key, ''), coalesce(p_affiliate_url, ''), p_caption, p_failure_reason,
    p_affiliate_program, nullif(btrim(p_showcase_product_id), ''), p_link_strategy
  ) returning id into v_attempt_id;

  insert into public.audit_logs(user_id, action, entity_type, entity_id, metadata)
  values (v_user_id, 'CONTENT_PUBLISHED', 'publish_attempt', v_attempt_id::text,
    jsonb_build_object('platform', p_platform, 'program', p_affiliate_program, 'mode', p_mode,
      'status', p_status, 'tracking_key', p_tracking_key, 'external_id', p_external_id));
  return v_attempt_id;
end;
$$;

drop function if exists public.record_publish_attempt(uuid,text,text,text,text,text,text,text,text,text);

create or replace function public.profitos_schema_version()
returns integer
language sql
stable
security definer
set search_path = public
as $$ select 12 $$;

revoke all on function public.profitos_schema_version() from public;
grant execute on function public.profitos_schema_version() to anon, authenticated;
