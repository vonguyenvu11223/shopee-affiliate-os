create or replace function public.enforce_performance_report_lineage()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_period_start date;
  v_period_end date;
  v_import_type text;
  v_import_status text;
  v_report_start text;
  v_report_end text;
begin
  select pm.period_start, pm.period_end, ir.import_type, ir.status,
         ir.parsed_summary->>'periodStart', ir.parsed_summary->>'periodEnd'
    into v_period_start, v_period_end, v_import_type, v_import_status, v_report_start, v_report_end
    from public.performance_metrics pm
    join public.import_runs ir on ir.id = new.import_run_id
    where pm.id = new.performance_metric_id
      and pm.user_id = new.user_id
      and ir.user_id = new.user_id;

  if not found then raise exception 'LINEAGE_OWNER_MISMATCH'; end if;
  if v_import_status <> 'COMPLETED' then raise exception 'REPORT_NOT_COMPLETED'; end if;
  if (new.report_role = 'CLICK' and v_import_type <> 'CLICK_REPORT')
     or (new.report_role = 'CONVERSION' and v_import_type <> 'CONVERSION_REPORT') then
    raise exception 'REPORT_ROLE_MISMATCH';
  end if;
  if v_report_start is null or v_report_end is null
     or v_report_start <> v_period_start::text
     or v_report_end <> v_period_end::text then
    raise exception 'REPORT_PERIOD_MISMATCH';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_performance_report_lineage on public.performance_metric_import_runs;
create trigger enforce_performance_report_lineage
before insert or update on public.performance_metric_import_runs
for each row execute function public.enforce_performance_report_lineage();
