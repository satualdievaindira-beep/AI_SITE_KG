# KG Site AI

## Запуск
1. Supabase → SQL Editor: выполнить `supabase/migrations/001_init.sql`, затем `002_server_writes.sql`.
2. Supabase → Authentication → URL Configuration: добавить адрес сайта (Render) в Site URL / Redirect URLs.
3. `cp .env.example .env`, заполнить ключи (Settings → API). `ANTHROPIC_API_KEY` — с console.anthropic.com.
4. `npm install` и `node --env-file=.env server/index.js` → http://localhost:3000
5. Зарегистрируйтесь, затем в SQL Editor: `update public.profiles set role='admin' where email='ВАШ_EMAIL';`

## Деплой (GitHub + Render)
Залить папку в GitHub → Render → New → Blueprint (читает `render.yaml`) → указать переменные из `.env.example`.
Сайты клиентов: `https://ВАШ-ДОМЕН/sites/<адрес>`.
