alter table public.import_runs
  add column if not exists parsed_summary jsonb not null default '{}'::jsonb;

create table if not exists public.performance_metric_import_runs (
  user_id uuid not null references auth.users(id) on delete cascade,
  performance_metric_id uuid not null references public.performance_metrics(id) on delete cascade,
  import_run_id uuid not null references public.import_runs(id) on delete restrict,
  report_role text not null check (report_role in ('CLICK','CONVERSION')),
  created_at timestamptz not null default now(),
  primary key (performance_metric_id, import_run_id),
  unique (performance_metric_id, report_role)
);

alter table public.performance_metric_import_runs enable row level security;
drop policy if exists owner_all on public.performance_metric_import_runs;
create policy owner_all on public.performance_metric_import_runs for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop function if exists public.save_performance_decision(uuid,date,bigint,bigint,bigint,bigint,numeric,numeric,text,text,text,numeric,jsonb);

create or replace function public.save_performance_decision(
  p_experiment_id uuid,
  p_metric_date date,
  p_views bigint,
  p_clicks bigint,
  p_orders bigint,
  p_valid_orders bigint,
  p_pending_commission numeric,
  p_validated_commission numeric,
  p_state text,
  p_diagnosis text,
  p_next_best_action text,
  p_confidence numeric,
  p_metrics_snapshot jsonb,
  p_click_import_run_id uuid,
  p_conversion_import_run_id uuid
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_decision_id uuid;
  v_metric_id uuid;
  v_tracking_key text;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_state not in ('TESTING','VALIDATED','SCALING','DECLINING','KILLED') then raise exception 'INVALID_STATE'; end if;
  if p_clicks < 0 or p_orders < 0 or p_valid_orders < 0 or p_orders > p_clicks or p_valid_orders > p_orders then raise exception 'INVALID_FUNNEL_COUNTS'; end if;
  if p_views is not null and (p_views < 0 or p_clicks > p_views) then raise exception 'INVALID_VIEW_COUNT'; end if;
  select cv.tracking_key into v_tracking_key
    from public.content_experiments ce
    join public.content_variants cv on cv.id = ce.content_variant_id
    where ce.id = p_experiment_id and ce.user_id = v_user_id;
  if v_tracking_key is null then raise exception 'EXPERIMENT_OR_TRACKING_NOT_FOUND'; end if;
  if p_click_import_run_id is not null and not exists (
    select 1 from public.import_runs where id = p_click_import_run_id and user_id = v_user_id
      and import_type = 'CLICK_REPORT' and status = 'COMPLETED'
      and parsed_summary->'attributionGroups' @> jsonb_build_array(jsonb_build_object('trackingKey', v_tracking_key))
  ) then raise exception 'INVALID_CLICK_REPORT_ATTRIBUTION'; end if;
  if p_conversion_import_run_id is not null and not exists (
    select 1 from public.import_runs where id = p_conversion_import_run_id and user_id = v_user_id
      and import_type = 'CONVERSION_REPORT' and status = 'COMPLETED'
      and parsed_summary->'attributionGroups' @> jsonb_build_array(jsonb_build_object('trackingKey', v_tracking_key))
  ) then raise exception 'INVALID_CONVERSION_REPORT_ATTRIBUTION'; end if;

  insert into public.performance_metrics(user_id, experiment_id, metric_date, views, clicks, orders, valid_orders, pending_commission, validated_commission, source)
  values (v_user_id, p_experiment_id, p_metric_date, p_views, p_clicks, p_orders, p_valid_orders, p_pending_commission, p_validated_commission, 'USER_INPUT')
  on conflict (user_id, experiment_id, metric_date, source) do update set views = excluded.views, clicks = excluded.clicks, orders = excluded.orders, valid_orders = excluded.valid_orders, pending_commission = excluded.pending_commission, validated_commission = excluded.validated_commission
  returning id into v_metric_id;

  delete from public.performance_metric_import_runs where performance_metric_id = v_metric_id;
  if p_click_import_run_id is not null then insert into public.performance_metric_import_runs(user_id, performance_metric_id, import_run_id, report_role) values (v_user_id, v_metric_id, p_click_import_run_id, 'CLICK'); end if;
  if p_conversion_import_run_id is not null then insert into public.performance_metric_import_runs(user_id, performance_metric_id, import_run_id, report_role) values (v_user_id, v_metric_id, p_conversion_import_run_id, 'CONVERSION'); end if;

  update public.content_experiments set state = p_state, started_at = coalesce(started_at, now()), ended_at = case when p_state = 'KILLED' then now() else null end where id = p_experiment_id and user_id = v_user_id;
  insert into public.performance_decisions(user_id, entity_type, entity_id, decision, reason, metrics_snapshot, confidence, diagnosis, next_best_action)
  values (v_user_id, 'CONTENT_EXPERIMENT', p_experiment_id, p_state, p_diagnosis || ': ' || p_next_best_action, p_metrics_snapshot, p_confidence, p_diagnosis, p_next_best_action)
  returning id into v_decision_id;
  insert into public.audit_logs(user_id, action, entity_type, entity_id, metadata)
  values (v_user_id, 'PERFORMANCE_RECORDED', 'content_experiment', p_experiment_id::text, jsonb_build_object('decision_id', v_decision_id, 'metric_id', v_metric_id, 'metric_date', p_metric_date, 'state', p_state));
  return v_decision_id;
end;
$$;

revoke all on function public.save_performance_decision(uuid,date,bigint,bigint,bigint,bigint,numeric,numeric,text,text,text,numeric,jsonb,uuid,uuid) from public;
grant execute on function public.save_performance_decision(uuid,date,bigint,bigint,bigint,bigint,numeric,numeric,text,text,text,numeric,jsonb,uuid,uuid) to authenticated;
