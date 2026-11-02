const express = require('express'), multer = require('multer'), sharp = require('sharp');
const crypto = require('crypto'), fs = require('fs'), path = require('path');
const E = process.env;
const { PORT = 3000, DATA_DIR = path.join(__dirname, 'data'), ADMIN_PASSWORD, MAX_BOT_TOKEN, MAX_USER_ID,
  TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, SITE_NAME = 'ATELIER', INSTAGRAM_URL = 'https://instagram.com/' } = E;
if (!ADMIN_PASSWORD) { console.error('Задайте ADMIN_PASSWORD'); process.exit(1); }
const SECRET = E.SESSION_SECRET || ADMIN_PASSWORD;
const UP = path.join(DATA_DIR, 'uploads'), DB = path.join(DATA_DIR, 'products.json');
fs.mkdirSync(UP, { recursive: true });

const load = () => { try { return JSON.parse(fs.readFileSync(DB, 'utf8')); } catch { return []; } };
const save = p => { fs.writeFileSync(DB + '.tmp', JSON.stringify(p)); fs.renameSync(DB + '.tmp', DB); };
const TOKEN = crypto.createHmac('sha256', SECRET).update('admin').digest('hex');
const same = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
const isAdmin = req => { const m = (req.headers.cookie || '').match(/(?:^|; )adm=([a-f0-9]+)/); return !!m && same(m[1], TOKEN); };
const guard = (q, s, n) => isAdmin(q) ? n() : s.status(401).json({ error: 'auth' });
const wrap = f => (q, s) => f(q, s).catch(e => { console.error(e.message); s.status(500).json({ error: 'Ошибка сервера' }); });

// простые ограничения частоты (только в памяти, ничего не пишется на диск)
const hits = new Map();
const limited = (key, max, ms) => {
  const now = Date.now(), a = (hits.get(key) || []).filter(t => now - t < ms);
  a.push(now); hits.set(key, a); return a.length > max;
};

async function notify(text) {
  const jobs = [];
  if (MAX_BOT_TOKEN && MAX_USER_ID) jobs.push(fetch(`https://platform-api.max.ru/messages?user_id=${MAX_USER_ID}`, {
    method: 'POST', headers: { Authorization: MAX_BOT_TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ text })
  }).then(r => { if (!r.ok) throw new Error('MAX ' + r.status); }));
  if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) jobs.push(fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text })
  }).then(r => { if (!r.ok) throw new Error('TG ' + r.status); }));
  if (!jobs.length) throw new Error('Не настроен ни MAX, ни Telegram');
  const res = await Promise.allSettled(jobs);
  if (res.every(r => r.status === 'rejected')) throw new Error(res[0].reason.message);
}

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '20kb' }));
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20e6, files: 12 } });
const clip = (s, n) => String(s || '').trim().slice(0, n);

app.get('/api/config', (q, s) => s.json({ name: SITE_NAME, instagram: INSTAGRAM_URL }));
app.get('/api/products', (q, s) => s.json(load()));
app.get('/api/me', (q, s) => s.json({ admin: isAdmin(q) }));

app.post('/api/login', (q, s) => {
  if (limited('login' + q.ip, 8, 15 * 60e3)) return s.status(429).json({ error: 'Слишком много попыток' });
  const ok = same(crypto.createHash('sha256').update(String(q.body.password || '')).digest('hex'),
                  crypto.createHash('sha256').update(ADMIN_PASSWORD).digest('hex'));
  if (!ok) return s.status(401).json({ error: 'Неверный пароль' });
  // вход один раз: cookie живёт 1 год
  s.setHeader('Set-Cookie', `adm=${TOKEN}; Max-Age=31536000; Path=/; HttpOnly; SameSite=Strict${q.secure ? '; Secure' : ''}`);
  s.json({ ok: true });
});

async function saveImages(files) {
  const names = [];
  for (const f of files || []) {
    const n = crypto.randomUUID() + '.webp';
    await sharp(f.buffer).rotate().resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 82 }).toFile(path.join(UP, n));
    names.push(n);
  }
  return names;
}
const fields = b => ({ title: clip(b.title, 120), price: Math.max(0, parseInt(b.price) || 0), sizes: clip(b.sizes, 120), desc: clip(b.desc, 4000) });

app.post('/api/products', guard, upload.array('images', 12), wrap(async (q, s) => {
  const p = { id: crypto.randomBytes(5).toString('hex'), ...fields(q.body), images: await saveImages(q.files), created: Date.now() };
  if (!p.title) return s.status(400).json({ error: 'Укажите название' });
  const all = load(); all.unshift(p); save(all); s.json(p);
}));

app.put('/api/products/:id', guard, upload.array('images', 12), wrap(async (q, s) => {
  const all = load(), p = all.find(x => x.id === q.params.id);
  if (!p) return s.status(404).json({ error: 'Не найдено' });
  let keep = []; try { keep = JSON.parse(q.body.keep || '[]'); } catch {}
  keep = keep.filter(n => p.images.includes(n)); // в нужном порядке; первое = обложка
  p.images.filter(n => !keep.includes(n)).forEach(n => fs.rm(path.join(UP, n), () => {}));
  Object.assign(p, fields(q.body), { images: [...keep, ...await saveImages(q.files)] });
  save(all); s.json(p);
}));

app.delete('/api/products/:id', guard, (q, s) => {
  const all = load(), p = all.find(x => x.id === q.params.id);
  if (p) { p.images.forEach(n => fs.rm(path.join(UP, n), () => {})); save(all.filter(x => x !== p)); }
  s.json({ ok: true });
});

app.post('/api/test-notify', guard, wrap(async (q, s) => {
  try { await notify('✅ Проверка связи: уведомления с сайта работают.'); s.json({ ok: true }); }
  catch (e) { s.status(400).json({ error: e.message }); }
}));

// Заявка: отправляется в мессенджер и НЕ сохраняется нигде
app.post('/api/inquiry', wrap(async (q, s) => {
  const b = q.body || {};
  if (b.website) return s.json({ ok: true }); // ловушка для ботов
  if (limited('inq' + q.ip, 5, 3600e3)) return s.status(429).json({ error: 'Слишком много заявок, попробуйте позже' });
  const name = clip(b.name, 80), contact = clip(b.contact, 80);
  if (!name || !contact || !b.consent) return s.status(400).json({ error: 'Заполните имя, контакт и согласие' });
  const p = load().find(x => x.id === b.productId);
  const text = ['🛍 Новая заявка', p ? `Товар: ${p.title}${p.price ? ' — ' + p.price + ' ₽' : ''}` : 'Товар: не указан',
    `Имя: ${name}`, `Контакт: ${contact}`, b.size ? `Размер/вариант: ${clip(b.size, 60)}` : '', b.comment ? `Комментарий: ${clip(b.comment, 600)}` : '']
    .filter(Boolean).join('\n');
  try { await notify(text); s.json({ ok: true }); }
  catch (e) { console.error('notify:', e.message); s.status(502).json({ error: 'Не удалось отправить, напишите нам в Instagram' }); }
}));

app.use('/uploads', express.static(UP, { maxAge: '30d', immutable: true }));
app.use('/fonts', express.static(path.join(__dirname, 'node_modules/@fontsource/jost/files'), { maxAge: '1y' }));
app.use(express.static(path.join(__dirname, 'public')));
app.get('/admin', (q, s) => s.sendFile(path.join(__dirname, 'public/admin.html')));
app.get('/product/:id', (q, s) => s.sendFile(path.join(__dirname, 'public/index.html')));
app.listen(PORT, () => console.log('http://localhost:' + PORT));
