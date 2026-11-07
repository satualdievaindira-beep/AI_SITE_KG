const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const url = u => /^https:\/\//.test(u || '') ? esc(encodeURI(u).replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/'/g, '%27')) : '';
const digits = s => String(s || '').replace(/\D/g, '');

export const TEMPLATES = {
  flowers: { name: 'Цветочный магазин', premium: false, content: { title: 'Цветы Бишкек', color: '#e11d6a', blocks: [
    { type: 'hero', title: 'Свежие цветы с доставкой по Бишкеку', text: 'Букеты на любой повод. Доставка за 2 часа.', cta: 'Заказать', img: '' },
    { type: 'catalog', title: 'Каталог', items: [{ name: 'Розы 11 шт', price: '1500 сом', desc: 'Красные розы', img: '' }, { name: 'Тюльпаны 15 шт', price: '1200 сом', desc: 'Весенний букет', img: '' }] },
    { type: 'contact', title: 'Контакты', phone: '+996 700 000 000', whatsapp: '996700000000', address: 'г. Бишкек' }] } },
  cafe: { name: 'Кафе', premium: false, content: { title: 'Кафе Уют', color: '#b45309', blocks: [
    { type: 'hero', title: 'Домашняя кухня в центре города', text: 'Завтраки, обеды, десерты.', cta: 'Связаться', img: '' },
    { type: 'features', title: 'Почему мы', items: [{ title: 'Свежие продукты', text: 'Готовим каждый день' }, { title: 'Уютно', text: 'Приходите с семьёй' }] },
    { type: 'contact', title: 'Контакты', phone: '', whatsapp: '', address: '' }] } },
  services: { name: 'Услуги', premium: true, content: { title: 'Мастер на час', color: '#2563eb', blocks: [
    { type: 'hero', title: 'Решаем бытовые задачи быстро', text: 'Ремонт, сборка, установка.', cta: 'Позвонить', img: '' },
    { type: 'catalog', title: 'Цены', items: [{ name: 'Выезд мастера', price: 'от 500 сом', desc: '', img: '' }] },
    { type: 'contact', title: 'Контакты', phone: '', whatsapp: '', address: '' }] } },
  portfolio: { name: 'Портфолио', premium: true, content: { title: 'Моё портфолио', color: '#0f172a', blocks: [
    { type: 'hero', title: 'Привет, я фотограф', text: 'Съёмки, свадьбы, портреты.', cta: 'Написать', img: '' },
    { type: 'text', title: 'Обо мне', text: 'Расскажите о себе.' },
    { type: 'contact', title: 'Контакты', phone: '', whatsapp: '', address: '' }] } }
};

export const BLOCK_TYPES = ['hero', 'features', 'catalog', 'text', 'contact'];

export function render(c) {
  const col = /^#[0-9a-f]{6}$/i.test(c?.color) ? c.color : '#4f46e5';
  const B = {
    hero: b => `<header class="hero"${b.img ? ` style="background-image:linear-gradient(#0009,#0009),url(${url(b.img)})"` : ''}><h1>${esc(b.title)}</h1><p>${esc(b.text)}</p>${b.cta ? `<a class="btn" href="#contact">${esc(b.cta)}</a>` : ''}</header>`,
    features: b => `<section><h2>${esc(b.title)}</h2><div class="grid">${(b.items || []).map(i => `<div class="card"><h3>${esc(i.title)}</h3><p>${esc(i.text)}</p></div>`).join('')}</div></section>`,
    catalog: b => `<section><h2>${esc(b.title)}</h2><div class="grid">${(b.items || []).map(i => `<div class="card">${i.img ? `<img src="${url(i.img)}" alt="${esc(i.name)}" loading="lazy">` : ''}<h3>${esc(i.name)}</h3><p>${esc(i.desc)}</p><b>${esc(i.price)}</b></div>`).join('')}</div></section>`,
    text: b => `<section><h2>${esc(b.title)}</h2><p>${esc(b.text)}</p></section>`,
    contact: b => `<section id="contact"><h2>${esc(b.title)}</h2>${b.phone ? `<p><a href="tel:${esc(String(b.phone).replace(/[^\d+]/g, ''))}">${esc(b.phone)}</a></p>` : ''}${b.address ? `<p>${esc(b.address)}</p>` : ''}${digits(b.whatsapp) ? `<a class="btn" href="https://wa.me/${digits(b.whatsapp)}">WhatsApp</a>` : ''}</section>`
  };
  const body = (c?.blocks || []).map(b => (B[b.type] || (() => ''))(b)).join('');
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(c?.title)}</title><style>
:root{--c:${col};--bg:#fff;--fg:#0f172a;--card:#f8fafc}@media(prefers-color-scheme:dark){:root{--bg:#0b1120;--fg:#e2e8f0;--card:#1e293b}}
*{box-sizing:border-box}body{margin:0;font-family:system-ui,sans-serif;background:var(--bg);color:var(--fg);line-height:1.6}
section{max-width:1000px;margin:auto;padding:48px 20px}.hero{background:var(--c) center/cover;color:#fff;text-align:center;padding:96px 20px}.hero h1{font-size:clamp(28px,6vw,52px);margin:0 0 12px}
.btn{display:inline-block;background:var(--c);color:#fff;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:600;margin-top:12px}.hero .btn{background:#fff;color:var(--c)}
.grid{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}.card{background:var(--card);border-radius:16px;padding:16px}.card img{width:100%;border-radius:12px;aspect-ratio:4/3;object-fit:cover}h2{color:var(--c)}a{color:var(--c)}
</style></head><body>${body}</body></html>`;
}
