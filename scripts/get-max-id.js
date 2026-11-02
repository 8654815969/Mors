// Запуск: MAX_BOT_TOKEN=... npm run max-id  → затем напишите своему боту в MAX любое сообщение
const T = process.env.MAX_BOT_TOKEN;
if (!T) { console.error('Задайте MAX_BOT_TOKEN'); process.exit(1); }
(async () => {
  console.log('Жду сообщение боту... (Ctrl+C для выхода)');
  let marker;
  for (;;) {
    const r = await fetch('https://platform-api.max.ru/updates?timeout=30&types=message_created,bot_started' + (marker ? '&marker=' + marker : ''), { headers: { Authorization: T } });
    if (!r.ok) { console.error('Ошибка', r.status); process.exit(1); }
    const d = await r.json(); marker = d.marker;
    for (const u of d.updates || []) {
      const id = u.user?.user_id ?? u.message?.sender?.user_id;
      if (id) { console.log('\nВаш MAX_USER_ID =', id); process.exit(0); }
    }
  }
})();
