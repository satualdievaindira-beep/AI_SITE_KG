import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { render, TEMPLATES, BLOCK_TYPES } from './render.js';

const E = process.env;
const sb = createClient(E.SUPABASE_URL, E.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const here = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: '1mb' }));

// Простая защита от спама: 120 запросов/мин с IP
const hits = new Map();
app.use('/api', (req, res, next) => {
  const k = req.ip, now = Date.now(), a = (hits.get(k) || []).filter(t => now - t < 60000);
  if (a.length >= 120) return res.status(429).json({ error: 'Слишком много запросов' });
  a.push(now); hits.set(k, a); next();
});

const wrap = f => (req, res) => f(req, res).catch(e => res.status(e.code || 500).json({ error: e.message }));
const fail = (m, code = 400) => { const e = new Error(m); e.code = code; throw e; };

async function auth(req, res, next) {
  try {
    const { data: { user } } = await sb.auth.getUser((req.headers.authorization || '').slice(7));
    if (!user) return res.status(401).json({ error: 'Войдите в аккаунт' });
    const { data: p } = await sb.from('profiles').select('*').eq('id', user.id).single();
    if (!p || p.is_blocked) return res.status(403).json({ error: 'Аккаунт заблокирован. Свяжитесь с поддержкой.' });
    req.user = user; req.profile = p; next();
  } catch (e) { res.status(401).json({ error: 'Ошибка авторизации' }); }
}
const admin = (req, res, next) => req.profile.role === 'admin' ? next() : res.status(403).json({ error: 'Только для администратора' });

async function planOf(uid) {
  const { data: s } = await sb.from('subscriptions').select('*').eq('user_id', uid).eq('status', 'active')
    .gt('expires_at', new Date().toISOString()).order('expires_at', { ascending: false }).limit(1);
  const { data: plan } = await sb.from('plans').select('*').eq('id', s?.[0]?.plan_id || 'free').single();
  return { plan, sub: s?.[0] || null };
}
const own = async (req, id) => {
  const { data } = await sb.from('projects').select('*').eq('id', id).eq('owner_id', req.user.id).single();
  return data || fail('Проект не найден', 404);
};
function cleanContent(c) {
  if (!c || typeof c !== 'object' || !Array.isArray(c.blocks) || c.blocks.length > 30) fail('Некорректное содержимое сайта');
  if (JSON.stringify(c).length > 200000) fail('Сайт слишком большой');
  return c;
}

async function generateWithAI(prompt) {
  if (!E.ANTHROPIC_API_KEY) fail('AI недоступен: на сервере не задан ANTHROPIC_API_KEY. Используйте готовые шаблоны.', 503);
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': E.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: E.ANTHROPIC_MODEL || 'claude-sonnet-4-6', max_tokens: 3000,
      system: `Ты создаёшь сайты для бизнеса в Кыргызстане. Верни ТОЛЬКО JSON без пояснений: {"title":string,"color":"#rrggbb","blocks":[...]}. Типы блоков: hero{title,text,cta,img}, features{title,items:[{title,text}]}, catalog{title,items:[{name,price,desc,img}]}, text{title,text}, contact{title,phone,whatsapp,address}. Поле img оставляй пустой строкой. Пиши на языке запроса. 4-7 блоков, первый hero, последний contact.`,
      messages: [{ role: 'user', content: String(prompt).slice(0, 2000) }]
    })
  });
  const j = await r.json();
  if (!r.ok) fail('Ошибка Claude API: ' + (j.error?.message || r.status), 502);
  const t = j.content?.map(x => x.text || '').join('') || '';
  try { return cleanContent(JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1))); }
  catch { fail('AI вернул некорректный ответ, попробуйте ещё раз', 502); }
}

app.get('/api/health', (q, s) => s.json({ ok: true }));
app.get('/api/config', (q, s) => s.json({
  url: E.SUPABASE_URL, anon: E.SUPABASE_ANON_KEY, ai: !!E.ANTHROPIC_API_KEY,
  whatsapp: 'https://wa.me/996704721515', mbank: '+996557001436'
}));
app.get('/api/templates', auth, (q, s) => s.json(Object.fromEntries(Object.entries(TEMPLATES).map(([k, v]) => [k, { name: v.name, premium: v.premium }]))));
app.get('/api/me', auth, wrap(async (req, res) => res.json({ profile: req.profile, ...(await planOf(req.user.id)) })));
app.post('/api/render', auth, (req, res) => { try { res.json({ html: render(cleanContent(req.body.content)) }); } catch (e) { res.status(400).json({ error: e.message }); } });

app.post('/api/projects', auth, wrap(async (req, res) => {
  const { plan } = await planOf(req.user.id), isAdmin = req.profile.role === 'admin';
  const name = String(req.body.name || '').trim().slice(0, 80) || 'Мой сайт';
  const { count } = await sb.from('projects').select('id', { count: 'exact', head: true }).eq('owner_id', req.user.id);
  if (count >= plan.max_sites && !isAdmin) fail(`Лимит тарифа ${plan.name}: ${plan.max_sites} сайтов`, 403);
  let content;
  if (req.body.prompt) {
    if (!plan.ai_enabled && !isAdmin) fail('AI-генерация доступна на тарифах PRO и BUSINESS', 403);
    const since = new Date(Date.now() - 3600e3).toISOString();
    const { count: used } = await sb.from('ai_usage').select('id', { count: 'exact', head: true }).eq('user_id', req.user.id).gt('created_at', since);
    if (used >= +(E.AI_RATE_LIMIT_PER_HOUR || 10)) fail('Лимит AI-запросов в час исчерпан', 429);
    await sb.from('ai_usage').insert({ user_id: req.user.id });
    content = await generateWithAI(req.body.prompt);
  } else {
    const t = TEMPLATES[req.body.templateId] || fail('Выберите шаблон');
    if (t.premium && !plan.all_templates && !isAdmin) fail('Этот шаблон доступен на платных тарифах', 403);
    content = structuredClone(t.content);
  }
  const { data, error } = await sb.from('projects').insert({ owner_id: req.user.id, name, content }).select().single();
  if (error) fail(error.message);
  res.json(data);
}));
app.put('/api/projects/:id', auth, wrap(async (req, res) => {
  await own(req, req.params.id);
  const { error } = await sb.from('projects').update({
    name: String(req.body.name || 'Сайт').slice(0, 80), content: cleanContent(req.body.content), updated_at: new Date().toISOString()
  }).eq('id', req.params.id);
  if (error) fail(error.message); res.json({ ok: true });
}));
app.delete('/api/projects/:id', auth, wrap(async (req, res) => {
  await own(req, req.params.id); await sb.from('projects').delete().eq('id', req.params.id); res.json({ ok: true });
}));
app.post('/api/projects/:id/publish', auth, wrap(async (req, res) => {
  const p = await own(req, req.params.id), { plan } = await planOf(req.user.id);
  const slug = String(req.body.slug || '').toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(slug)) fail('Адрес: 3-40 символов, латиница, цифры и дефис');
  if (!plan.max_published && req.profile.role !== 'admin') fail('Публикация недоступна на тарифе FREE. Выберите тариф.', 403);
  const { count } = await sb.from('projects').select('id', { count: 'exact', head: true }).eq('owner_id', req.user.id).eq('status', 'published').neq('id', p.id);
  if (count >= plan.max_published && req.profile.role !== 'admin') fail(`Лимит опубликованных сайтов: ${plan.max_published}`, 403);
  const { error } = await sb.from('projects').update({ slug, status: 'published', published_at: new Date().toISOString() }).eq('id', p.id);
  if (error) fail(error.code === '23505' ? 'Этот адрес уже занят' : error.message);
  res.json({ url: `${req.protocol}://${req.get('host')}/sites/${slug}` });
}));
app.post('/api/projects/:id/unpublish', auth, wrap(async (req, res) => {
  await own(req, req.params.id); await sb.from('projects').update({ status: 'unpublished' }).eq('id', req.params.id); res.json({ ok: true });
}));

// Админ: подтверждение/отклонение платежа (подписка активируется только здесь)
app.post('/api/admin/payments/:id', auth, admin, wrap(async (req, res) => {
  const { data: pay } = await sb.from('payments').select('*').eq('id', req.params.id).single();
  if (!pay || pay.status !== 'pending') fail('Заявка не найдена или уже обработана');
  const ok = req.body.action === 'approve';
  if (ok) {
    const { data: plan } = await sb.from('plans').select('*').eq('id', pay.plan_id).single();
    await sb.from('subscriptions').update({ status: 'cancelled' }).eq('user_id', pay.user_id).eq('status', 'active');
    await sb.from('subscriptions').insert({ user_id: pay.user_id, plan_id: pay.plan_id, expires_at: new Date(Date.now() + plan.duration_days * 864e5).toISOString() });
  }
  await sb.from('payments').update({ status: ok ? 'approved' : 'rejected', admin_note: String(req.body.note || '').slice(0, 300), reviewed_by: req.user.id, reviewed_at: new Date().toISOString() }).eq('id', pay.id);
  res.json({ ok: true });
}));

// Опубликованные сайты: статический HTML, без регистрации
app.get('/sites/:slug', wrap(async (req, res) => {
  const { data } = await sb.from('projects').select('content').eq('slug', req.params.slug).eq('status', 'published').single();
  if (!data) return res.status(404).send('Сайт не найден или снят с публикации');
  res.set('Cache-Control', 'public, max-age=60').type('html').send(render(data.content));
}));

app.use(express.static(path.join(here, '../public')));
app.get('*', (q, s) => s.sendFile(path.join(here, '../public/index.html')));
app.listen(E.PORT || 3000, () => console.log('KG Site AI запущен'));
