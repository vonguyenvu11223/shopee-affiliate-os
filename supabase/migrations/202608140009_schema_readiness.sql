create or replace function public.profitos_schema_version()
returns integer
language sql
stable
security definer
set search_path = public
as $$ select 9 $$;

revoke all on function public.profitos_schema_version() from public;
grant execute on function public.profitos_schema_version() to anon, authenticated;
