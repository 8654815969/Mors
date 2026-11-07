const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = p => p ? new Intl.NumberFormat('ru-RU').format(p) + ' ₽' : 'Цена по запросу';
let cfg = {}, products = [];

async function init() {
  [cfg, products] = await Promise.all([fetch('/api/config').then(r => r.json()), fetch('/api/products').then(r => r.json())]);
  for (const id of ['logo', 'fn']) $('#' + id).textContent = cfg.name;
  $('#ig').href = $('#fig').href = cfg.instagram;
  document.title = cfg.name; route();
}
function route() {
  const m = location.pathname.match(/^\/product\/([\w-]+)/);
  m ? product(m[1]) : home(); scrollTo(0, 0);
}
addEventListener('popstate', route);
document.addEventListener('click', e => {
  const a = e.target.closest('a[data-link]');
  if (a) { e.preventDefault(); history.pushState(0, '', a.getAttribute('href')); route(); }
});

function home() {
  const order = [], map = {};
  [...products].sort((x, y) => x.created - y.created).forEach(p => { const c = p.category || 'Каталог'; if (!map[c]) { map[c] = []; order.push(c); } });
  products.forEach(p => map[p.category || 'Каталог'].push(p));
  const card = p => `<a class="card" href="/product/${p.id}" data-link>
    <div class="im">${p.images.slice(0, 2).map(i => `<img loading="lazy" src="/uploads/${i}" alt="${esc(p.title)}">`).join('')}</div>
    <h3>${esc(p.title)}</h3><span>${money(p.price)}</span></a>`;
  $('#app').innerHTML = `<section class="hero"><img class="mark" src="/logo.png" alt="" draggable="false"><h1>Изделия из натуральной кожи</h1><p>Сделано вручную. Каждая вещь — в единственном экземпляре.</p></section><div id="catalog"></div>`
    + (products.length ? order.map(c => `<section class="cat"><h2 class="t">${esc(c)}</h2><div class="rw">
      <button class="arr l" data-dir="-1" aria-label="Назад">‹</button><div class="rs">${map[c].map(card).join('')}</div><button class="arr r" data-dir="1" aria-label="Вперёд">›</button></div></section>`).join('')
      : `<p class="empty">Скоро здесь появятся первые изделия.</p>`);
}

function product(id) {
  const p = products.find(x => x.id === id);
  if (!p) return history.replaceState(0, '', '/'), home();
  document.title = p.title + ' — ' + cfg.name;
  $('#app').innerHTML = `<a class="back" href="/" data-link>← Каталог</a><div class="pg">
    <div class="gal">${p.images.map(i => `<img src="/uploads/${i}" alt="${esc(p.title)}">`).join('')}</div>
    <div class="info"><h1>${esc(p.title)}</h1><div class="price">${money(p.price)}</div>
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
