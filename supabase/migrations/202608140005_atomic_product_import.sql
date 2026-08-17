create or replace function public.import_product_export(
  p_source_filename text,
  p_content_hash text,
  p_captured_at timestamptz,
  p_products jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_import_run_id uuid;
  v_product_id uuid;
  v_product jsonb;
  v_row_count integer := jsonb_array_length(p_products);
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_source_filename is null or btrim(p_source_filename) = '' or length(p_source_filename) > 500 then raise exception 'INVALID_FILENAME'; end if;
  if p_content_hash !~ '^[a-f0-9]{64}$' then raise exception 'INVALID_CONTENT_HASH'; end if;
  if jsonb_typeof(p_products) <> 'array' or v_row_count < 1 or v_row_count > 5000 then raise exception 'INVALID_PRODUCT_PAYLOAD'; end if;

  select id into v_import_run_id from public.import_runs
    where user_id = v_user_id and content_hash = p_content_hash;
  if v_import_run_id is not null then
    return jsonb_build_object('importRunId', v_import_run_id, 'duplicate', true, 'rowCount', v_row_count);
  end if;

  insert into public.import_runs(user_id, import_type, source_filename, content_hash, row_count, status, imported_at)
  values (v_user_id, 'PRODUCT_EXPORT', p_source_filename, p_content_hash, v_row_count, 'PROCESSING', p_captured_at)
  returning id into v_import_run_id;

  for v_product in select value from jsonb_array_elements(p_products) loop
    if coalesce(v_product->>'id','') = '' or coalesce(v_product->>'name','') = '' then raise exception 'INVALID_PRODUCT_ROW'; end if;
    insert into public.products(user_id, source, item_id, shop_name, title, category, product_url, affiliate_eligible, last_seen_at)
    values (v_user_id, 'SHOPEE', v_product->>'id', nullif(v_product->>'shopName',''), v_product->>'name', nullif(v_product->>'category',''), nullif(v_product->>'productUrl',''), coalesce(v_product->>'affiliateUrl','') <> '', p_captured_at)
    on conflict (user_id, source, item_id) do update set
      shop_name = excluded.shop_name, title = excluded.title, category = excluded.category,
      product_url = excluded.product_url, affiliate_eligible = excluded.affiliate_eligible,
      last_seen_at = excluded.last_seen_at
    returning id into v_product_id;

    insert into public.product_snapshots(user_id, product_id, import_run_id, price, sold, commission_rate, commission_amount, source, captured_at, raw_data)
    values (v_user_id, v_product_id, v_import_run_id, coalesce((v_product->>'price')::numeric,0), nullif(v_product->>'sold','')::bigint, coalesce((v_product->>'commissionRate')::numeric,0), coalesce((v_product->>'commissionAmount')::numeric,0), 'AFFILIATE_EXPORT', p_captured_at, v_product - 'affiliateUrl')
    on conflict (product_id, captured_at) do update set
      import_run_id = excluded.import_run_id, price = excluded.price, sold = excluded.sold,
      commission_rate = excluded.commission_rate, commission_amount = excluded.commission_amount,
      raw_data = excluded.raw_data;

    if coalesce(v_product->>'affiliateUrl','') <> '' then
      insert into public.affiliate_links(user_id, product_id, original_url, affiliate_url, source, status)
      values (v_user_id, v_product_id, coalesce(nullif(v_product->>'productUrl',''), v_product->>'affiliateUrl'), v_product->>'affiliateUrl', 'AFFILIATE_EXPORT', 'UNKNOWN')
      on conflict (user_id, affiliate_url) do update set product_id = excluded.product_id, original_url = excluded.original_url;
    end if;
  end loop;

  update public.import_runs set status = 'COMPLETED' where id = v_import_run_id;
  insert into public.audit_logs(user_id, action, entity_type, entity_id, metadata)
  values (v_user_id, 'PRODUCT_EXPORT_IMPORTED', 'import_run', v_import_run_id::text, jsonb_build_object('row_count', v_row_count, 'content_hash', p_content_hash));
  return jsonb_build_object('importRunId', v_import_run_id, 'duplicate', false, 'rowCount', v_row_count);
end;
$$;

revoke all on function public.import_product_export(text,text,timestamptz,jsonb) from public;
grant execute on function public.import_product_export(text,text,timestamptz,jsonb) to authenticated;
