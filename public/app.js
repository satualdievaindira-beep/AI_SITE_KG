const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let sb, cfg, ses, me, plans = [], tpls = {}, proj, tm;
const IN = 'w-full rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-800 px-3 py-2 text-sm';
const BT = 'rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500';
const B2 = 'rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm';
const CD = 'rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm';
const guard = f => async (...a) => { try { await f(...a); } catch (e) { alert(e.message || e); } };
const api = async (p, o = {}) => {
  const r = await fetch('/api' + p, { ...o, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (ses?.access_token || '') }, body: o.body && JSON.stringify(o.body) });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'Ошибка'); return j;
};
const A = window.A = {};
const wa = () => cfg.whatsapp + '?text=' + encodeURIComponent('Здравствуйте! Я пользуюсь KG Site AI и хочу обратиться в поддержку');
const waBtn = `<a target="_blank" rel="noopener" onclick="this.href=cfg.whatsapp+'?text='+encodeURIComponent('Здравствуйте! Я пользуюсь KG Site AI и хочу обратиться в поддержку')" class="rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white">Связаться с нами</a>`;
window.cfg = null;
const ST = { pending: 'Ожидает подтверждения', approved: 'Подтверждена', rejected: 'Отклонена', open: 'Открыто', answered: 'Есть ответ', closed: 'Закрыто', draft: 'Черновик', published: 'Опубликован', unpublished: 'Снят' };

function shell(h) {
  $('#app').innerHTML = `<nav class="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
  <b class="mr-4 text-indigo-600">KG Site AI</b><a href="#/">Мои сайты</a><a href="#/plans">Тарифы</a><a href="#/support">Поддержка</a>
  ${me?.profile.role === 'admin' ? '<a href="#/admin" class="font-semibold text-amber-600">Админ</a>' : ''}
  <span class="flex-1"></span>${waBtn}<button class="${B2}" onclick="A.theme()">🌓</button><button class="${B2}" onclick="sb.auth.signOut()">Выйти</button></nav>
  <main class="mx-auto max-w-6xl p-4">${h}</main>`;
}
A.theme = () => { document.documentElement.classList.toggle('dark'); localStorage.theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light'; };

function authView(mode = 'login') {
  const reg = mode === 'register';
  $('#app').innerHTML = `<div class="mx-auto max-w-md p-6"><h1 class="mt-10 text-4xl font-bold">KG Site AI</h1>
  <p class="mb-6 mt-2 text-slate-500">Создайте сайт для бизнеса в Кыргызстане за несколько минут: описание, AI, публикация.</p>
  <div class="${CD} space-y-3">${reg ? `<input id=nm class="${IN}" placeholder="Имя">` : ''}
  <input id=em type=email class="${IN}" placeholder="Email"><input id=pw type=password class="${IN}" placeholder="Пароль (мин. 8 символов)">
  <button class="${BT} w-full" onclick="A.auth(${reg})">${reg ? 'Зарегистрироваться' : 'Войти'}</button>
  <div class="flex justify-between text-sm"><a href="#" onclick="authView('${reg ? 'login' : 'register'}');return false">${reg ? 'Уже есть аккаунт' : 'Регистрация'}</a><a href="#" onclick="A.reset();return false">Забыли пароль?</a></div></div>
  <div class="mt-4 flex gap-2">${waBtn}<button class="${B2}" onclick="A.theme()">🌓</button></div></div>`;
}
window.authView = authView;
A.auth = guard(async reg => {
  const email = $('#em').value.trim(), password = $('#pw').value;
  if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 8) throw new Error('Проверьте email и пароль (мин. 8 символов)');
  const r = reg ? await sb.auth.signUp({ email, password, options: { data: { full_name: $('#nm').value.trim().slice(0, 80) } } }) : await sb.auth.signInWithPassword({ email, password });
  if (r.error) throw r.error; if (reg && !r.data.session) alert('Проверьте почту и подтвердите email');
});
A.reset = guard(async () => {
  const email = $('#em').value.trim(); if (!email) throw new Error('Введите email');
  const r = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin }); if (r.error) throw r.error; alert('Письмо для сброса пароля отправлено');
});
function recoveryView() {
  $('#app').innerHTML = `<div class="mx-auto max-w-md p-6"><div class="${CD} space-y-3"><h2 class="font-semibold">Новый пароль</h2><input id=pw type=password class="${IN}" placeholder="Новый пароль"><button class="${BT}" onclick="A.newpw()">Сохранить</button></div></div>`;
}
A.newpw = guard(async () => { const r = await sb.auth.updateUser({ password: $('#pw').value }); if (r.error) throw r.error; location.hash = '#/'; go(); });

async function go() {
  if (!ses) return authView();
  try {
    me = await api('/me'); tpls = await api('/templates');
    plans = (await sb.from('plans').select('*').eq('is_active', true).order('sort_order')).data;
  } catch (e) { return $('#app').innerHTML = `<div class="p-8">${esc(e.message)} ${waBtn} <button class="${B2}" onclick="sb.auth.signOut()">Выйти</button></div>`; }
  const h = location.hash.slice(2).split('/');
  await ({ edit: editView, plans: plansView, support: supportView, admin: adminView }[h[0]] || dashView)(h[1]);
}
window.addEventListener('hashchange', () => ses && go());

async function dashView() {
  const { data } = await sb.from('projects').select('*').eq('owner_id', ses.user.id).order('created_at', { ascending: false });
  shell(`<div class="${CD} mb-4">Тариф: <b>${esc(me.plan.name)}</b>${me.sub ? ' до ' + new Date(me.sub.expires_at).toLocaleDateString('ru') : ''} · Сайтов: ${data.length}/${me.plan.max_sites}</div>
  <div class="${CD} mb-6 space-y-2"><h2 class="font-semibold">Новый сайт</h2>
  <input id=n class="${IN}" placeholder="Название проекта">
  <select id=t class="${IN}">${Object.entries(tpls).map(([k, v]) => `<option value="${k}">${v.premium && !me.plan.all_templates ? '🔒 ' : ''}${esc(v.name)}</option>`).join('')}</select>
  <textarea id=pr rows=3 class="${IN}" placeholder="Опишите бизнес для AI: «Сайт цветочного магазина в Бишкеке с каталогом, ценами и WhatsApp»"></textarea>
  <div class="flex gap-2"><button class="${B2}" onclick="A.create(0)">Создать по шаблону</button><button class="${BT}" onclick="A.create(1)">✨ Создать с AI</button></div>
  ${me.plan.ai_enabled || me.profile.role === 'admin' ? '' : '<p class="text-xs text-slate-500">AI доступен на PRO и BUSINESS</p>'}</div>
  <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">${data.map(p => `<div class="${CD}"><b>${esc(p.name)}</b><div class="text-sm text-slate-500">${ST[p.status]}</div>
  ${p.status === 'published' ? `<a class="text-sm text-indigo-600" target="_blank" href="/sites/${esc(p.slug)}">/sites/${esc(p.slug)}</a>` : ''}
  <div class="mt-3 flex gap-2"><a class="${BT}" href="#/edit/${p.id}">Открыть</a><button class="${B2}" onclick="A.del('${p.id}')">Удалить</button></div></div>`).join('') || '<p class="text-slate-500">Сайтов пока нет</p>'}</div>`);
}
A.create = guard(async ai => {
  const p = await api('/projects', { method: 'POST', body: { name: $('#n').value, templateId: $('#t').value, prompt: ai ? $('#pr').value : '' } });
  location.hash = '#/edit/' + p.id;
});
A.del = guard(async id => { if (confirm('Удалить сайт?')) { await api('/projects/' + id, { method: 'DELETE' }); go(); } });

const LAB = { title: 'Заголовок', text: 'Текст', cta: 'Кнопка', img: 'Фото (ссылка https://)', name: 'Название', price: 'Цена', desc: 'Описание', phone: 'Телефон', whatsapp: 'WhatsApp (996...)', address: 'Адрес' };
const walk = p => p.split('.').reduce((o, k) => o[k], proj.content);
const NEW = { hero: { type: 'hero', title: 'Заголовок', text: '', cta: '', img: '' }, features: { type: 'features', title: 'Преимущества', items: [{ title: '', text: '' }] }, catalog: { type: 'catalog', title: 'Каталог', items: [{ name: '', price: '', desc: '', img: '' }] }, text: { type: 'text', title: 'О нас', text: '' }, contact: { type: 'contact', title: 'Контакты', phone: '', whatsapp: '', address: '' } };
function fields(o, p) {
  return Object.entries(o).map(([k, v]) => {
    if (k === 'type') return ''; const q = p + '.' + k;
    if (Array.isArray(v)) return `<div class="ml-2 border-l pl-2">${v.map((it, i) => `<div class="my-2 rounded border p-2"><button class="text-xs text-red-500" onclick="A.deli('${q}.${i}')">удалить элемент</button>${fields(it, q + '.' + i)}</div>`).join('')}<button class="text-xs text-indigo-500" onclick="A.addi('${q}')">+ элемент</button></div>`;
    return `<label class="mt-1 block text-xs">${LAB[k] || k}<input data-p="${q}" value="${esc(v)}" class="${IN}"></label>`;
  }).join('');
}
function form() {
  const c = proj.content;
  $('#form').innerHTML = `<label class="block text-xs">Название сайта<input data-p="title" value="${esc(c.title)}" class="${IN}"></label>
  <label class="mt-2 block text-xs">Цвет<input type=color data-p="color" value="${esc(c.color || '#4f46e5')}" class="h-9 w-full"></label>
  ${c.blocks.map((b, i) => `<details open class="mt-3 rounded-lg border p-2"><summary class="cursor-pointer font-medium">${b.type}<button class="float-right text-xs text-red-500" onclick="event.preventDefault();A.delb(${i})">удалить блок</button></summary>${fields(b, 'blocks.' + i)}</details>`).join('')}
  <div class="mt-3 flex gap-2"><select id=nb class="${IN}">${Object.keys(NEW).map(k => `<option>${k}</option>`).join('')}</select><button class="${B2}" onclick="A.addb()">Добавить</button></div>`;
}
const pv = () => { clearTimeout(tm); tm = setTimeout(guard(async () => { $('#pv').srcdoc = (await api('/render', { method: 'POST', body: { content: proj.content } })).html; }), 300); };
async function editView(id) {
  const { data } = await sb.from('projects').select('*').eq('id', id).eq('owner_id', ses.user.id).single();
  if (!data) return location.hash = '#/'; proj = data;
  shell(`<div class="grid gap-4 lg:grid-cols-[380px_1fr]"><div id=form class="${CD} max-h-[80vh] overflow-auto"></div><div>
  <div class="mb-2 flex flex-wrap items-center gap-2"><button class="${BT}" onclick="A.save()">Сохранить</button>
  <input id=slug placeholder="адрес-сайта" value="${esc(proj.slug || '')}" class="${IN} !w-40"><button class="${B2}" onclick="A.pub()">Опубликовать</button>
  <button class="${B2}" onclick="A.unpub()">Снять</button><button class="${B2}" onclick="A.zip()">ZIP</button>
  <button class="${B2}" onclick="$('#pv').style.maxWidth='390px'">📱</button><button class="${B2}" onclick="$('#pv').style.maxWidth='100%'">🖥</button>
  <span id=lnk class="text-sm"></span></div><iframe id=pv class="mx-auto h-[75vh] w-full rounded-xl border bg-white" sandbox></iframe></div></div>`);
  form(); pv(); showLink();
  $('#form').addEventListener('input', e => { const p = e.target.dataset.p; if (!p) return; const a = p.split('.'), l = a.pop(); a.reduce((o, k) => o[k], proj.content)[l] = e.target.value; pv(); });
}
const showLink = () => { $('#lnk').innerHTML = proj.status === 'published' ? `<a class="text-indigo-600" target="_blank" href="/sites/${esc(proj.slug)}">${location.origin}/sites/${esc(proj.slug)}</a>` : ''; };
A.deli = p => { const a = p.split('.'), i = +a.pop(); walk(a.join('.')).splice(i, 1); form(); pv(); };
A.addi = p => { const arr = walk(p), n = structuredClone(arr[arr.length - 1] || { title: '', text: '' }); for (const k in n) n[k] = ''; arr.push(n); form(); pv(); };
A.delb = i => { proj.content.blocks.splice(i, 1); form(); pv(); };
A.addb = () => { proj.content.blocks.push(structuredClone(NEW[$('#nb').value])); form(); pv(); };
A.save = guard(async () => { await api('/projects/' + proj.id, { method: 'PUT', body: { name: proj.content.title, content: proj.content } }); alert('Сохранено'); });
A.pub = guard(async () => { await api('/projects/' + proj.id, { method: 'PUT', body: { name: proj.content.title, content: proj.content } });
  const r = await api(`/projects/${proj.id}/publish`, { method: 'POST', body: { slug: $('#slug').value.trim() } }); proj.slug = $('#slug').value.trim().toLowerCase(); proj.status = 'published'; showLink(); alert('Опубликовано: ' + r.url); });
A.unpub = guard(async () => { await api(`/projects/${proj.id}/unpublish`, { method: 'POST' }); proj.status = 'unpublished'; showLink(); });
A.zip = guard(async () => {
  const html = (await api('/render', { method: 'POST', body: { content: proj.content } })).html;
  const z = new JSZip(); z.file('index.html', html); const a = document.createElement('a');
  a.href = URL.createObjectURL(await z.generateAsync({ type: 'blob' })); a.download = (proj.slug || 'site') + '.zip'; a.click();
});

async function plansView() {
  const [pays, subs] = await Promise.all([sb.from('payments').select('*').eq('user_id', ses.user.id).order('created_at', { ascending: false }), sb.from('subscriptions').select('*').eq('user_id', ses.user.id).order('created_at', { ascending: false })]);
  shell(`<div class="grid gap-4 md:grid-cols-4">${plans.map(p => `<div class="${CD} ${p.id === me.plan.id ? 'ring-2 ring-indigo-500' : ''}"><h3 class="font-bold">${esc(p.name)}</h3><div class="text-2xl">${p.price_som} сом<span class="text-sm text-slate-500">/мес</span></div>
  <ul class="my-3 text-sm text-slate-600 dark:text-slate-300"><li>Сайтов: ${p.max_sites}</li><li>Публикаций: ${p.max_published}</li><li>${p.ai_enabled ? '✓' : '✗'} AI-генерация</li><li>${p.all_templates ? '✓ Все шаблоны' : 'Базовые шаблоны'}</li></ul>
  ${p.price_som ? `<button class="${BT} w-full" onclick="A.pay('${p.id}')">Оплатить через MBANK</button>` : ''}</div>`).join('')}</div>
  <div id=pay class="my-4"></div><h2 class="mb-2 mt-6 font-semibold">История платежей</h2>
  <div class="${CD} text-sm">${pays.data.map(x => `<div class="flex justify-between border-b py-1"><span>${new Date(x.created_at).toLocaleDateString('ru')} · ${esc(x.plan_id)} · ${x.amount_som} сом</span><b>${ST[x.status]}${x.admin_note ? ' (' + esc(x.admin_note) + ')' : ''}</b></div>`).join('') || 'Платежей нет'}</div>
  <h2 class="mb-2 mt-6 font-semibold">Подписки</h2><div class="${CD} text-sm">${subs.data.map(s => `<div>${esc(s.plan_id)}: ${new Date(s.starts_at).toLocaleDateString('ru')} — ${new Date(s.expires_at).toLocaleDateString('ru')} (${s.status})</div>`).join('') || 'Нет подписок'}</div>`);
}
A.pay = id => {
  const p = plans.find(x => x.id === id);
  $('#pay').innerHTML = `<div class="${CD} space-y-2"><h3 class="font-semibold">${esc(p.name)} — ${p.price_som} сом</h3><ol class="list-decimal pl-5 text-sm"><li>Переведите <b>${p.price_som} сом</b> через MBANK на номер <b>${esc(cfg.mbank)}</b></li><li>Загрузите скриншот или чек</li><li>Отправьте заявку — статус: «Ожидает подтверждения»</li></ol>
  <input type=file id=rc accept="image/jpeg,image/png,image/webp" class="${IN}"><button class="${BT}" onclick="A.send('${id}')">Отправить заявку</button><p class="text-xs text-slate-500">Подписка включается только после ручной проверки перевода.</p></div>`;
};
A.send = guard(async id => {
  const f = $('#rc').files[0], ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[f?.type];
  if (!f) throw new Error('Загрузите чек'); if (!ext || f.size > 5e6) throw new Error('Только JPG/PNG/WEBP до 5 МБ');
  const path = `${ses.user.id}/${Date.now()}.${ext}`, u = await sb.storage.from('receipts').upload(path, f, { contentType: f.type }); if (u.error) throw u.error;
  const r = await sb.from('payments').insert({ user_id: ses.user.id, plan_id: id, amount_som: plans.find(x => x.id === id).price_som, receipt_path: path }); if (r.error) throw r.error;
  alert('Заявка отправлена. Статус: ожидает подтверждения'); plansView();
});

async function supportView() {
  const { data } = await sb.from('tickets').select('*,ticket_messages(*)').eq('user_id', ses.user.id).order('created_at', { ascending: false });
  shell(`<div class="${CD} mb-4 space-y-2"><h2 class="font-semibold">Новое обращение</h2><input id=ts class="${IN}" placeholder="Тема"><textarea id=tb rows=3 class="${IN}" placeholder="Ваш вопрос"></textarea>
  <div class="flex gap-2"><button class="${BT}" onclick="A.tnew()">Отправить</button>${waBtn}</div></div>
  ${data.map(t => `<div class="${CD} mb-3"><b>${esc(t.subject)}</b> <span class="text-sm text-slate-500">${ST[t.status]}</span>${thread(t)}
  <div class="mt-2 flex gap-2"><input id="r${t.id}" class="${IN}" placeholder="Ответить"><button class="${B2}" onclick="A.treply('${t.id}',false)">→</button></div></div>`).join('')}`);
}
const thread = t => (t.ticket_messages || []).sort((a, b) => a.created_at.localeCompare(b.created_at)).map(m => `<div class="mt-1 text-sm ${m.is_admin ? 'text-indigo-600' : ''}">${m.is_admin ? 'Поддержка' : 'Вы'}: ${esc(m.body)}</div>`).join('');
A.tnew = guard(async () => {
  const s = $('#ts').value.trim(), b = $('#tb').value.trim(); if (s.length < 3 || !b) throw new Error('Заполните тему и вопрос');
  const t = await sb.from('tickets').insert({ user_id: ses.user.id, subject: s.slice(0, 150) }).select().single(); if (t.error) throw t.error;
  const m = await sb.from('ticket_messages').insert({ ticket_id: t.data.id, author_id: ses.user.id, body: b.slice(0, 4000) }); if (m.error) throw m.error; supportView();
});
A.treply = guard(async (id, adm) => {
  const b = $('#r' + id).value.trim(); if (!b) return;
  const m = await sb.from('ticket_messages').insert({ ticket_id: id, author_id: ses.user.id, is_admin: adm, body: b.slice(0, 4000) }); if (m.error) throw m.error;
  await sb.from('tickets').update({ status: adm ? 'answered' : 'open', updated_at: new Date().toISOString() }).eq('id', id).eq(adm ? 'id' : 'user_id', adm ? id : ses.user.id);
  go();
});

async function adminView() {
  if (me.profile.role !== 'admin') return location.hash = '#/';
  const [pay, usr, prj, tk] = await Promise.all([
    sb.from('payments').select('*,profiles(full_name,email)').order('created_at', { ascending: false }),
    sb.from('profiles').select('*').order('created_at', { ascending: false }),
    sb.from('projects').select('id,name,slug,status,profiles(email)').order('created_at', { ascending: false }),
    sb.from('tickets').select('*,profiles(email),ticket_messages(*)').order('updated_at', { ascending: false })]);
  const sum = pay.data.filter(x => x.status === 'approved').reduce((s, x) => s + x.amount_som, 0);
  shell(`<div class="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">${[['Пользователи', usr.data.length], ['Сайты', prj.data.length], ['Опубликовано', prj.data.filter(p => p.status === 'published').length], ['Ожидают оплаты', pay.data.filter(p => p.status === 'pending').length], ['Выручка, сом', sum]].map(([a, b]) => `<div class="${CD}"><div class="text-xs text-slate-500">${a}</div><div class="text-2xl font-bold">${b}</div></div>`).join('')}</div>
  <h2 class="mb-2 font-semibold">Платежи</h2><div class="${CD} mb-6 text-sm">${pay.data.map(x => `<div class="flex flex-wrap items-center gap-2 border-b py-2"><span>${esc(x.profiles?.full_name || x.profiles?.email)} · ${esc(x.plan_id)} · ${x.amount_som} сом · ${new Date(x.created_at).toLocaleString('ru')} · <b>${ST[x.status]}</b></span>
  <button class="${B2}" onclick="A.rc('${esc(x.receipt_path)}')">Чек</button>${x.status === 'pending' ? `<button class="${BT}" onclick="A.rev('${x.id}','approve')">Подтвердить оплату</button><button class="${B2}" onclick="A.rev('${x.id}','reject')">Отклонить</button>` : ''}</div>`).join('')}</div>
  <h2 class="mb-2 font-semibold">Обращения</h2>${tk.data.map(t => `<div class="${CD} mb-3 text-sm"><b>${esc(t.subject)}</b> · ${esc(t.profiles?.email)} · ${ST[t.status]}${thread(t)}<div class="mt-2 flex gap-2"><input id="r${t.id}" class="${IN}" placeholder="Ответ"><button class="${BT}" onclick="A.treply('${t.id}',true)">Ответить</button><button class="${B2}" onclick="A.tclose('${t.id}')">Закрыть</button></div></div>`).join('')}
  <h2 class="mb-2 mt-6 font-semibold">Тарифы</h2><div class="${CD} mb-6 grid gap-2 text-sm">${plans.map(p => `<div class="flex flex-wrap items-center gap-2"><b class="w-20">${esc(p.name)}</b>цена<input id="pr_${p.id}" type=number value="${p.price_som}" class="${IN} !w-24">сайтов<input id="ms_${p.id}" type=number value="${p.max_sites}" class="${IN} !w-20">публ.<input id="mp_${p.id}" type=number value="${p.max_published}" class="${IN} !w-20"><label><input id="ai_${p.id}" type=checkbox ${p.ai_enabled ? 'checked' : ''}> AI</label><button class="${B2}" onclick="A.plan('${p.id}')">Сохранить</button></div>`).join('')}</div>
  <h2 class="mb-2 font-semibold">Пользователи</h2><div class="${CD} mb-6 text-sm">${usr.data.map(u => `<div class="flex items-center justify-between border-b py-1"><span>${esc(u.email)} ${esc(u.full_name)} · ${u.role}${u.is_blocked ? ' · 🚫' : ''}</span>${u.id !== ses.user.id ? `<button class="${B2}" onclick="A.blk('${u.id}',${!u.is_blocked})">${u.is_blocked ? 'Разблокировать' : 'Блокировать'}</button>` : ''}</div>`).join('')}</div>
  <h2 class="mb-2 font-semibold">Сайты</h2><div class="${CD} text-sm">${prj.data.map(p => `<div class="border-b py-1">${esc(p.name)} · ${esc(p.profiles?.email)} · ${ST[p.status]} ${p.status === 'published' ? `<a class="text-indigo-600" target="_blank" href="/sites/${esc(p.slug)}">/sites/${esc(p.slug)}</a>` : ''}</div>`).join('')}</div>`);
}
A.rc = guard(async p => { const r = await sb.storage.from('receipts').createSignedUrl(p, 120); if (r.error) throw r.error; window.open(r.data.signedUrl, '_blank'); });
A.rev = guard(async (id, action) => { const note = action === 'reject' ? prompt('Причина отказа') || '' : ''; await api('/admin/payments/' + id, { method: 'POST', body: { action, note } }); go(); });
A.blk = guard(async (id, v) => { const r = await sb.from('profiles').update({ is_blocked: v }).eq('id', id); if (r.error) throw r.error; go(); });
A.tclose = guard(async id => { await sb.from('tickets').update({ status: 'closed' }).eq('id', id); go(); });
A.plan = guard(async id => {
  const r = await sb.from('plans').update({ price_som: +$('#pr_' + id).value, max_sites: +$('#ms_' + id).value, max_published: +$('#mp_' + id).value, ai_enabled: $('#ai_' + id).checked }).eq('id', id);
  if (r.error) throw r.error; alert('Сохранено');
});

(async () => {
  cfg = window.cfg = await (await fetch('/api/config')).json();
  if (!cfg.url) return $('#app').innerHTML = '<p class="p-8">Не заданы SUPABASE_URL / SUPABASE_ANON_KEY на сервере.</p>';
  sb = window.sb = supabase.createClient(cfg.url, cfg.anon);
  ses = (await sb.auth.getSession()).data.session;
  sb.auth.onAuthStateChange((ev, s) => { ses = s; if (ev === 'PASSWORD_RECOVERY') recoveryView(); else if (ev !== 'TOKEN_REFRESHED') go(); });
  go();
})();
