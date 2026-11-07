-- KG Site AI: схема, RLS, начальные данные
create extension if not exists pgcrypto;

-- ===== Профили и роли =====
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  phone text,
  role text not null default 'user' check (role in ('user','admin')),
  is_blocked boolean not null default false,
  lang text not null default 'ru' check (lang in ('ru','ky')),
  created_at timestamptz not null default now()
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and not is_blocked);
$$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name',''));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Запрет самостоятельной смены role / is_blocked / email
create or replace function public.guard_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.role := old.role; new.is_blocked := old.is_blocked; new.email := old.email;
  end if;
  return new;
end $$;
create trigger guard_profile_trg before update on public.profiles
  for each row execute function public.guard_profile();

-- ===== Тарифы (редактируются в админке) =====
create table public.plans (
  id text primary key,                       -- free | starter | pro | business
  name text not null,
  price_som int not null default 0,
  duration_days int not null default 30,
  max_sites int not null default 1,
  max_published int not null default 0,
  ai_enabled boolean not null default false,
  all_templates boolean not null default false,
  advanced_editor boolean not null default false,
  sort_order int not null default 0,
  is_active boolean not null default true
);
insert into public.plans values
 ('free','FREE',0,30,3,0,false,false,false,0,true),
 ('starter','STARTER',299,30,3,1,false,true,false,1,true),
 ('pro','PRO',599,30,5,5,true,true,true,2,true),
 ('business','BUSINESS',999,30,20,20,true,true,true,3,true);

-- ===== Подписки =====
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan_id text not null references public.plans(id),
  status text not null default 'active' check (status in ('active','expired','cancelled')),
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index on public.subscriptions (user_id, status, expires_at);

-- ===== Шаблоны =====
create table public.templates (
  id text primary key,
  name_ru text not null,
  name_ky text not null,
  category text not null,
  is_premium boolean not null default false,
  is_active boolean not null default true,
  content jsonb not null default '{}'::jsonb,   -- блоки и тема
  sort_order int not null default 0
);

-- ===== Проекты (сайты) =====
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  slug text unique check (slug ~ '^[a-z0-9]([a-z0-9-]{1,38})[a-z0-9]$'),
  template_id text references public.templates(id),
  content jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft','published','unpublished')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.projects (owner_id);

-- ===== Платежи (ручной MBANK) =====
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan_id text not null references public.plans(id),
  amount_som int not null,
  receipt_path text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  admin_note text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.payments (user_id, created_at desc);

-- ===== Поддержка =====
create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  subject text not null check (char_length(subject) between 3 and 150),
  status text not null default 'open' check (status in ('open','answered','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  is_admin boolean not null default false,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

-- ===== Лимит AI-запросов =====
create table public.ai_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.ai_usage (user_id, created_at desc);

-- ===== RLS =====
alter table public.profiles enable row level security;
alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.templates enable row level security;
alter table public.projects enable row level security;
alter table public.payments enable row level security;
alter table public.tickets enable row level security;
alter table public.ticket_messages enable row level security;
alter table public.ai_usage enable row level security;

-- profiles
create policy "own profile read" on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "own profile update" on public.profiles for update using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());

-- plans / templates: читают все, правит админ
create policy "plans read" on public.plans for select using (true);
create policy "plans admin" on public.plans for all using (public.is_admin()) with check (public.is_admin());
create policy "templates read" on public.templates for select using (is_active or public.is_admin());
create policy "templates admin" on public.templates for all using (public.is_admin()) with check (public.is_admin());

-- subscriptions: только чтение своих; запись делает backend (service role)
create policy "subs read" on public.subscriptions for select using (user_id = auth.uid() or public.is_admin());

-- projects: только владелец; админ видит все
create policy "projects read" on public.projects for select using (owner_id = auth.uid() or public.is_admin());
create policy "projects insert" on public.projects for insert with check (owner_id = auth.uid());
create policy "projects update" on public.projects for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "projects delete" on public.projects for delete using (owner_id = auth.uid() or public.is_admin());

-- payments: клиент создаёт только pending и видит свои; статус меняет только backend
create policy "payments read" on public.payments for select using (user_id = auth.uid() or public.is_admin());
create policy "payments insert" on public.payments for insert with check (user_id = auth.uid() and status = 'pending');

-- tickets
create policy "tickets read" on public.tickets for select using (user_id = auth.uid() or public.is_admin());
create policy "tickets insert" on public.tickets for insert with check (user_id = auth.uid());
create policy "tickets update admin" on public.tickets for update using (public.is_admin());
create policy "tmsg read" on public.ticket_messages for select using (
  exists (select 1 from public.tickets t where t.id = ticket_id and (t.user_id = auth.uid() or public.is_admin())));
create policy "tmsg insert" on public.ticket_messages for insert with check (
  author_id = auth.uid() and (
    (not is_admin and exists (select 1 from public.tickets t where t.id = ticket_id and t.user_id = auth.uid()))
    or (is_admin and public.is_admin())));

-- ai_usage: клиент не пишет и не читает; считает backend
create policy "ai_usage admin read" on public.ai_usage for select using (public.is_admin());

-- ===== Storage =====
insert into storage.buckets (id, name, public) values ('sites','sites',true) on conflict do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('receipts','receipts',false,5242880, array['image/jpeg','image/png','image/webp']) on conflict do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('project-images','project-images',true,3145728, array['image/jpeg','image/png','image/webp']) on conflict do nothing;

create policy "receipts own upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "receipts read" on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
create policy "images own upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'project-images' and (storage.foldername(name))[1] = auth.uid()::text);

-- Чтобы сделать себя админом (выполнить один раз вручную в SQL Editor):
-- update public.profiles set role = 'admin' where email = 'ВАШ_EMAIL';
