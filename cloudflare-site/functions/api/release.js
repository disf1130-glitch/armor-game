// Pages Function: общий дедлайн релиза (таймер 30 минут один для всех).
// GET /api/release -> {deadline: <ms>}
// Первый, кто откроет сайт, стартует отсчёт 30:00 для всех остальных.
// С KV (AGKV) дедлайн общий между визитами. Без KV — in-memory fallback.

const MINUTES = 30;
let memDeadline = 0;

export async function onRequestGet({ env }) {
  try {
    if (env.AGKV) {
      let d = +(await env.AGKV.get('release_deadline') || 0);
      if (!d || d < Date.now()) {
        d = Date.now() + MINUTES * 60 * 1000;
        await env.AGKV.put('release_deadline', String(d));
      }
      return json({ deadline: d });
    }
  } catch (_) {}
  if (!memDeadline || memDeadline < Date.now()) memDeadline = Date.now() + MINUTES * 60 * 1000;
  return json({ deadline: memDeadline });
}

function json(o) {
  return new Response(JSON.stringify(o), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
  });
}
