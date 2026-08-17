create unique index if not exists affiliate_links_user_url_uidx
  on public.affiliate_links(user_id, affiliate_url);

alter table public.content_variants
  add column if not exists tracking_key text,
  add column if not exists brief jsonb not null default '{}'::jsonb,
  add column if not exists ai_metadata jsonb not null default '{}'::jsonb;

create index if not exists content_variants_tracking_idx
  on public.content_variants(user_id, tracking_key);

alter table public.performance_decisions
  add column if not exists diagnosis text,
  add column if not exists next_best_action text;

create index if not exists performance_metrics_experiment_date_idx
  on public.performance_metrics(experiment_id, metric_date desc);
