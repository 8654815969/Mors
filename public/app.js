const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = p => p ? new Intl.NumberFormat('ru-RU').format(p) + ' ₽' : 'Цена по запросу';
let cfg = {}, products = [];

let site = { cats: { men: [], women: [], kids: [] }, banner: { image: '', caption: '' } };
async function init() {
  const get = u => fetch(u).then(r => r.json()).catch(() => null);
  const [c, p, st] = await Promise.all([get('/api/config'), get('/api/products'), get('/api/site')]);
  cfg = c || { name: 'MORIS', instagram: '#' }; products = Array.isArray(p) ? p : [];
  if (st && st.labels) { site = st; SEC = st.labels; }
  for (const id of ['logo', 'fn']) $('#' + id).textContent = cfg.name;
  $('#ig').href = $('#fig').href = cfg.instagram;
  document.title = cfg.name; route();
}
let SEC = { men: 'Мужская категория', women: 'Женская категория', kids: 'Детская категория' };
function route() {
  const p = location.pathname; let m;
  if ((m = p.match(/^\/product\/([\w-]+)/))) { product(m[1]); scrollTo(0, 0); }
  else if ((m = p.match(/^\/(men|women|kids)(?:\/(.+))?$/))) {
    if (m[2]) { category(decodeURIComponent(m[2]), m[1]); scrollTo(0, 0); } else { home(m[1]); $('#catalog').scrollIntoView(); }
  }
  else if ((m = p.match(/^\/category\/(.+)/))) { category(decodeURIComponent(m[1]), ''); scrollTo(0, 0); }
  else { home(''); scrollTo(0, 0); }
}
addEventListener('popstate', route);
document.addEventListener('click', e => {
  const a = e.target.closest('a[data-link]');
  if (a) { e.preventDefault(); history.pushState(0, '', a.getAttribute('href')); route(); }
});

const card = p => `<a class="card" href="/product/${p.id}" data-link>
  <div class="im">${p.images.slice(0, 2).map(i => `<img loading="lazy" src="/uploads/${i}" alt="${esc(p.title)}">`).join('')}</div>
  <h3>${esc(p.title)}</h3><span>${money(p.price)}</span></a>`;
const pl = n => n % 10 === 1 && n % 100 !== 11 ? 'товар' : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'товара' : 'товаров';
const catLink = (c, s) => (s ? '/' + s : '/category') + '/' + encodeURIComponent(c);
const pLink = p => p.category ? catLink(p.category, p.section) : (p.section ? '/' + p.section : '/');

function rowsHTML(items, s) {
  const order = [], map = {};
  [...items].sort((x, y) => x.created - y.created).forEach(p => { const c = p.category || 'Каталог'; if (!map[c]) { map[c] = []; order.push(c); } });
  items.forEach(p => map[p.category || 'Каталог'].push(p));
  const pi = c => { const i = ((site.cats || {})[s] || []).indexOf(c); return i < 0 ? 999 : i; };
  order.sort((x, y) => pi(x) - pi(y));
  return order.map(c => `<section class="cat"><h2 class="t"><a href="${catLink(c, s)}" data-link>${esc(c)}</a><a class="all" href="${catLink(c, s)}" data-link>Смотреть все (${map[c].length}) ›</a></h2><div class="rw">
    <button class="arr l" data-dir="-1" aria-label="Назад">‹</button><div class="rs">${map[c].map(card).join('')}</div><button class="arr r" data-dir="1" aria-label="Вперёд">›</button></div></section>`).join('');
}

function home(sec) {
  const tabs = [['', 'Все'], ['men', SEC.men], ['women', SEC.women], ['kids', SEC.kids]];
  const named = products.some(p => p.section);
  const body = (sec ? [sec] : ['men', 'women', 'kids', '']).map(s => {
    const items = products.filter(p => (p.section || '') === s);
    if (!items.length) return '';
    const title = s ? SEC[s] : (named ? 'Другое' : '');
    return `<div class="sec">${title ? `<h2 class="sh">${title}</h2>` : ''}${rowsHTML(items, s)}</div>`;
  }).join('');
  $('#app').innerHTML = `<div class="top"><img class="mark" src="/logo.png" alt="" draggable="false"></div><section class="hero"><h1>Изделия из натуральной кожи</h1><p>Сделано вручную. Каждая вещь — в единственном экземпляре.</p></section>${site.banner.image ? `<div class="banner"><img src="/uploads/${site.banner.image}" alt="">${site.banner.caption ? `<span>${esc(site.banner.caption)}</span>` : ''}</div>` : ''}
    <nav class="seg" id="catalog">${tabs.map(([k, l]) => `<a class="${k === (sec || '') ? 'on' : ''}" href="${k ? '/' + k : '/'}" data-link>${l}</a>`).join('')}</nav>`
    + (body || '<p class="empty">Скоро здесь появятся изделия.</p>');
}

function category(name, sec) {
  const items = products.filter(p => (p.category || 'Каталог') === name && (p.section || '') === sec);
  document.title = name + ' — ' + cfg.name;
  $('#app').innerHTML = `<a class="back" href="${sec ? '/' + sec : '/'}" data-link>← ${sec ? SEC[sec] : 'Каталог'}</a><div class="ch">${sec ? `<div class="kick">${SEC[sec]}</div>` : ''}<h1>${esc(name)}</h1><p>${items.length} ${pl(items.length)}</p></div>`
    + (items.length ? `<div class="mp">${items.map(card).join('')}</div>` : '<p class="empty">В этой категории пока нет товаров.</p>');
}

function product(id) {
  const p = products.find(x => x.id === id);
  if (!p) return history.replaceState(0, '', '/'), home();
  document.title = p.title + ' — ' + cfg.name;
  $('#app').innerHTML = `<a class="back" href="${pLink(p)}" data-link>← ${esc(p.category || 'Каталог')}</a><div class="pg">
    <div class="gal">${p.images.map(i => `<img src="/uploads/${i}" alt="${esc(p.title)}">`).join('')}</div>
    <div class="info"><div class="kick">${SEC[p.section] || ''}</div><h1>${esc(p.title)}</h1><div class="price">${money(p.price)}</div>
    <p>${esc(p.desc)}</p>${p.sizes ? `<div class="meta">Размеры / варианты: ${esc(p.sizes)}</div>` : ''}
    <button class="btn" id="req">Оставить заявку</button></div></div>
  <dialog id="dlg"><form id="f"><h3>Заявка</h3><div class="sub">${esc(p.title)} · ${money(p.price)}<br>Мы свяжемся с вами и всё уточним.</div>
    <label>Имя</label><input name="name" required maxlength="80" autocomplete="name">
    <label>Телефон или @username</label><input name="contact" required maxlength="80">
    ${p.sizes ? `<label>Размер / вариант</label><input name="size" maxlength="60">` : ''}
    <label>Комментарий</label><textarea name="comment" rows="2" maxlength="600"></textarea>
    <input class="hp" name="website" tabindex="-1" autocomplete="off">
    <label class="chk"><input type="checkbox" name="consent" required> Согласен(на) на обработку указанных данных для связи по заявке. Данные не сохраняются на сайте.</label>
    <div class="err" id="err"></div><button class="btn" id="sb">Отправить</button>
    <button type="button" class="btn ghost" style="margin-top:8px" onclick="dlg.close()">Закрыть</button></form></dialog>`;
  $('#req').onclick = () => $('#dlg').showModal();
  $('#f').onsubmit = async e => {
    e.preventDefault(); const f = e.target, b = Object.fromEntries(new FormData(f));
    b.consent = f.consent.checked; b.productId = p.id; $('#sb').disabled = true; $('#err').textContent = '';
    try {
      const r = await fetch('/api/inquiry', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error);
      f.innerHTML = '<h3>Спасибо!</h3><div class="sub">Заявка отправлена. Мы скоро свяжемся с вами.</div><button type="button" class="btn" onclick="dlg.close()">Закрыть</button>';
    } catch (x) { $('#err').textContent = x.message || 'Ошибка'; $('#sb').disabled = false; }
  };
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-dir]');
  if (b) { const r = b.parentElement.querySelector('.rs'); r.scrollBy({ left: b.dataset.dir * r.clientWidth * .8, behavior: 'smooth' }); }
});
init();
