-- Все изменения проектов идут через backend (проверка лимитов тарифа и владельца)
drop policy if exists "projects insert" on public.projects;
drop policy if exists "projects update" on public.projects;
drop policy if exists "projects delete" on public.projects;
