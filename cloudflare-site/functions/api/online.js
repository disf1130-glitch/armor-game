// Pages Function: счётчик онлайна.
// POST /api/online {id} -> heartbeat, отвечает {online: N}
// GET  /api/online            -> {online: N}
// С KV (binding AGKV): ключи online:<id> с TTL 40 сек — честный счётчик.
// Без KV: in-memory fallback (примерный, в пределах изолята).

const TTL = 40;
let memSeen = new Map(); // id -> timestamp (fallback)

export async function onRequestGet({ env }) {
  return json({ online: await count(env) });
}

export async function onRequestPost({ request, env }) {
  let id = '';
  try { id = String((await request.json()).id || ''); } catch (_) {}
  if (!id) return json({ error: 'no id' }, 400);

  try {
    if (env.AGKV) {
      await env.AGKV.put('online:' + id.slice(0, 32), '1', { expirationTtl: TTL });
      return json({ online: await count(env) });
    }
  } catch (_) {}
  memSeen.set(id, Date.now());
  return json({ online: await count(env) });
}

async function count(env) {
  const now = Date.now();
  try {
    if (env.AGKV) {
      const list = await env.AGKV.list({ prefix: 'online:' });
      return list.keys.length || 1;
    }
  } catch (_) {}
  for (const [k, t] of memSeen) if (now - t > TTL * 1000) memSeen.delete(k);
  return memSeen.size || 1;
}

function json(o, status = 200) {
  return new Response(JSON.stringify(o), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
  });
}
