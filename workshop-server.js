// Воркшоп-сервер: общий для всех в локалке.
// Запуск: node workshop-server.js  (или start-workshop.bat)
// Открыть: http://localhost:3000  (с другого ПК: http://<IP-этого-ПК>:3000)
// Без зависимостей, только встроенные модули Node.
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
// путь базы: WORKSHOP_DB (диск Render) → /data (примонтированный диск) → локальный файл
const DB = process.env.WORKSHOP_DB
  || (fs.existsSync('/data') ? '/data/workshop-db.json' : path.join(ROOT, 'workshop-db.json'));

function loadDB() {
  try {
    const raw = fs.readFileSync(DB, 'utf8');
    const d = JSON.parse(raw);
    if (Array.isArray(d)) return { seq: d.length, items: d };
    return d;
  } catch (e) { return { seq: 0, items: [] }; }
}
function saveDB(db) {
  fs.writeFileSync(DB, JSON.stringify(db, null, 1), 'utf8');
}
let db = loadDB();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
};

function send(res, code, body, type) {
  res.writeHead(code, {
    'Content-Type': type || 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(body);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let s = '';
    req.on('data', (c) => { s += c; if (s.length > 2_000_000) { reject(new Error('too big')); req.destroy(); } });
    req.on('end', () => resolve(s));
    req.on('error', reject);
  });
}
function validItem(o) {
  if (!o || typeof o !== 'object') return false;
  if (o.type !== 'proj' && o.type !== 'build') return false;
  if (!o.data || typeof o.data !== 'object') return false;
  if (o.type === 'proj') {
    if (!Array.isArray(o.data.shape) || !o.data.shape.length || o.data.shape.length > 40) return false;
    if (String(o.data.shape[0]).length > 80) return false;
  } else {
    if (!Array.isArray(o.data.cells) || !o.data.cells.length || o.data.cells.length > 8000) return false;
  }
  return true;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (req.method === 'OPTIONS') return send(res, 204, '', 'text/plain');

  // --- API ---
  if (url.pathname === '/api/ping') return send(res, 200, JSON.stringify({ ok: true, n: db.items.length }));
  if (url.pathname === '/api/items' && req.method === 'GET') {
    const type = url.searchParams.get('type');
    const items = (type ? db.items.filter((i) => i.type === type) : db.items).slice(-300);
    return send(res, 200, JSON.stringify(items));
  }
  if (url.pathname === '/api/items' && req.method === 'POST') {
    try {
      const o = JSON.parse(await readBody(req));
      if (!validItem(o)) return send(res, 400, JSON.stringify({ error: 'bad item' }));
      const id = 's' + (++db.seq).toString(36) + Date.now().toString(36).slice(-4);
      const item = {
        id, type: o.type,
        name: String(o.name || 'Без названия').slice(0, 40),
        author: String(o.author || 'anon').slice(0, 20),
        date: Date.now(), likes: 0, data: o.data,
      };
      db.items.push(item);
      if (db.items.length > 1000) db.items = db.items.slice(-1000);
      saveDB(db);
      return send(res, 200, JSON.stringify(item));
    } catch (e) { return send(res, 400, JSON.stringify({ error: 'bad json' })); }
  }
  let m = url.pathname.match(/^\/api\/items\/([^/]+)\/like$/);
  if (m && req.method === 'POST') {
    const it = db.items.find((i) => i.id === m[1]);
    if (!it) return send(res, 404, JSON.stringify({ error: 'not found' }));
    it.likes = (it.likes || 0) + 1; saveDB(db);
    return send(res, 200, JSON.stringify(it));
  }
  m = url.pathname.match(/^\/api\/items\/([^/]+)$/);
  if (m && req.method === 'DELETE') {
    const n = db.items.length;
    db.items = db.items.filter((i) => i.id !== m[1]);
    if (db.items.length === n) return send(res, 404, JSON.stringify({ error: 'not found' }));
    saveDB(db);
    return send(res, 200, JSON.stringify({ ok: true }));
  }

  // --- статика: раздаём папку das ---
  let p = decodeURIComponent(url.pathname);
  if (p === '/') p = '/armor-simulation-3.html';
  const file = path.normalize(path.join(ROOT, p));
  if (!file.startsWith(ROOT)) return send(res, 403, 'forbidden', 'text/plain');
  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, 'not found', 'text/plain');
    send(res, 200, data, MIME[path.extname(file).toLowerCase()] || 'application/octet-stream');
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('Workshop: http://localhost:' + PORT);
  console.log('Для других ПК в Wi-Fi: http://<IP-этого-ПК>:' + PORT);
});
