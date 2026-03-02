create extension if not exists pgcrypto;

create table if not exists public.daily_brief (
  id uuid primary key default gen_random_uuid(),
  brief_date date not null,
  brief_tz text not null default 'Asia/Shanghai',
  window_start timestamptz,
  window_end timestamptz,
  headline text not null,
  one_liner text not null,
  top_drivers jsonb not null default '[]'::jsonb,
  impacts jsonb not null default '{}'::jsonb,
  actions jsonb not null default '[]'::jsonb,
  citations jsonb not null default '[]'::jsonb,
  stats jsonb not null default '{}'::jsonb,
  model text,
  prompt_version text not null default 'v1',
  usage jsonb default '{}'::jsonb,
  generated_at timestamptz not null default now()
);

create unique index if not exists daily_brief_brief_date_prompt_version_uidx
  on public.daily_brief (brief_date, prompt_version);

create index if not exists daily_brief_generated_at_idx
  on public.daily_brief (generated_at desc);
