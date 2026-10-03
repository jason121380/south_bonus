-- 在 Supabase SQL Editor 執行一次即可。
-- 這份 RLS 會要求每次 REST 請求帶入正確的 x-workspace-key，避免其他 anon 使用者列出別人的資料。

create table if not exists public.salon_app_state (
  workspace_key uuid primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.salon_app_state enable row level security;

grant select, insert, update on table public.salon_app_state to anon;

drop policy if exists "workspace select" on public.salon_app_state;
create policy "workspace select" on public.salon_app_state
for select to anon
using (
  workspace_key::text = coalesce(
    (current_setting('request.headers', true)::json ->> 'x-workspace-key'),
    ''
  )
);

drop policy if exists "workspace insert" on public.salon_app_state;
create policy "workspace insert" on public.salon_app_state
for insert to anon
with check (
  workspace_key::text = coalesce(
    (current_setting('request.headers', true)::json ->> 'x-workspace-key'),
    ''
  )
);

drop policy if exists "workspace update" on public.salon_app_state;
create policy "workspace update" on public.salon_app_state
for update to anon
using (
  workspace_key::text = coalesce(
    (current_setting('request.headers', true)::json ->> 'x-workspace-key'),
    ''
  )
)
with check (
  workspace_key::text = coalesce(
    (current_setting('request.headers', true)::json ->> 'x-workspace-key'),
    ''
  )
);
