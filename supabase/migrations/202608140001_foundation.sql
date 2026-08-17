create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.import_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  import_type text not null check (import_type in ('PRODUCT_EXPORT','CLICK_REPORT','CONVERSION_REPORT')),
  source_filename text not null,
  content_hash text not null,
  row_count integer not null default 0 check (row_count >= 0),
  status text not null check (status in ('PROCESSING','COMPLETED','FAILED')),
  error_message text,
  imported_at timestamptz not null default now(),
  unique (user_id, content_hash)
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null default 'SHOPEE',
  item_id text not null,
  shop_id text,
  shop_name text,
  title text not null,
  category text,
  product_url text,
  image_url text,
  affiliate_eligible boolean,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, source, item_id)
);

create table if not exists public.product_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  import_run_id uuid references public.import_runs(id) on delete set null,
  price numeric(16,2),
  original_price numeric(16,2),
  sold bigint,
  rating numeric(4,2),
  review_count bigint,
  commission_rate numeric(7,4),
  commission_amount numeric(16,2),
  stock bigint,
  product_status text,
  source text not null check (source in ('SHOPEE_API','AFFILIATE_API','AFFILIATE_EXPORT','USER_INPUT')),
  raw_data jsonb,
  captured_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (product_id, captured_at)
);
create index if not exists product_snapshots_product_time_idx on public.product_snapshots(product_id, captured_at desc);

create table if not exists public.product_trend_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  metric_window text not null,
  sales_velocity numeric(18,4),
  sales_acceleration numeric(18,4),
  trend_score numeric(6,2),
  trend_stage text,
  urgency_score numeric(6,2),
  confidence_score numeric(6,2),
  data_quality_score numeric(6,2),
  scoring_version text not null,
  calculated_at timestamptz not null default now(),
  unique (product_id, metric_window, calculated_at)
);
create index if not exists product_trend_metrics_product_time_idx on public.product_trend_metrics(product_id, calculated_at desc);

create table if not exists public.affiliate_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  original_url text not null,
  affiliate_url text not null,
  sub_ids jsonb not null default '[]'::jsonb,
  status text not null default 'UNKNOWN' check (status in ('ACTIVE','INVALID','EXPIRED','PRODUCT_REMOVED','AFFILIATE_DISABLED','UNKNOWN')),
  source text not null,
  created_at timestamptz not null default now(),
  last_validated_at timestamptz
);

create table if not exists public.content_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  title text not null,
  platform text not null,
  content_cost numeric(16,2) not null default 0 check (content_cost >= 0),
  status text not null default 'DRAFT',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.content_variants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content_project_id uuid not null references public.content_projects(id) on delete cascade,
  hook text,
  cta text,
  duration_seconds integer,
  script text,
  content_hash text,
  created_at timestamptz not null default now(),
  unique (user_id, content_hash)
);

create table if not exists public.content_experiments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  content_variant_id uuid references public.content_variants(id) on delete set null,
  affiliate_link_id uuid references public.affiliate_links(id) on delete set null,
  state text not null default 'TESTING' check (state in ('TESTING','VALIDATED','SCALING','DECLINING','KILLED')),
  budget numeric(16,2) not null default 0 check (budget >= 0),
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.performance_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  experiment_id uuid references public.content_experiments(id) on delete cascade,
  import_run_id uuid references public.import_runs(id) on delete set null,
  metric_date date not null,
  views bigint,
  clicks bigint not null default 0,
  orders bigint not null default 0,
  valid_orders bigint not null default 0,
  pending_commission numeric(16,2) not null default 0,
  validated_commission numeric(16,2) not null default 0,
  source text not null,
  created_at timestamptz not null default now(),
  unique (user_id, experiment_id, metric_date, source)
);

create table if not exists public.commission_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  external_order_id text,
  product_id uuid references public.products(id) on delete set null,
  affiliate_link_id uuid references public.affiliate_links(id) on delete set null,
  status text not null,
  order_value numeric(16,2),
  commission_amount numeric(16,2),
  sub_ids jsonb not null default '[]'::jsonb,
  ordered_at timestamptz,
  completed_at timestamptz,
  raw_data jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, external_order_id, product_id)
);

create table if not exists public.performance_decisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  decision text not null,
  reason text not null,
  metrics_snapshot jsonb not null,
  confidence numeric(6,2),
  executed boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.scoring_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  version text not null,
  weights jsonb not null,
  active boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, version)
);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  entity_type text,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_user_time_idx on public.audit_logs(user_id, created_at desc);

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array['profiles','products','content_projects','content_experiments'] loop
    execute format('drop trigger if exists set_updated_at on public.%I', table_name);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name);
  end loop;
end $$;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'import_runs','products','product_snapshots','product_trend_metrics','affiliate_links',
    'content_projects','content_variants','content_experiments','performance_metrics','commission_events',
    'performance_decisions','scoring_versions','audit_logs'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists owner_all on public.%I', table_name);
    execute format('create policy owner_all on public.%I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', table_name);
  end loop;
end $$;

alter table public.profiles enable row level security;
drop policy if exists owner_all on public.profiles;
create policy owner_all on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, display_name) values (new.id, coalesce(new.raw_user_meta_data->>'display_name', new.email));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
