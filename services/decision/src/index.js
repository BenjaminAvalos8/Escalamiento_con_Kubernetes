const { crearClienteRedis } = require("@anthill/redis-config");
const { CANALES_REDIS, decidir } = require("@anthill/shared-core");

const redis = crearClienteRedis();
const redisCola = crearClienteRedis(); // BRPOP bloquea su conexion: va aparte para no frenar el heartbeat
const workerId = process.env.HOSTNAME || `worker-${Math.random().toString(36).substring(2, 9)}`;

// Azar derivado de tick e id (mulberry32): da igual que replica procese el lote
function azarDe(tick, id) {
  let s = (Math.imul(tick, 2654435761) ^ id) >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function procesarLotes() {
  for (;;) {
    try {
      const [, mensaje] = await redisCola.brpop(CANALES_REDIS.COLA_PENDIENTES, 0);
      const { tick, agentes, depredadores, recursos, nido } = JSON.parse(mensaje);
      const percepcion = { depredadores, recursos, nido };
      const resueltos = agentes.map((a) => decidir(a, percepcion, azarDe(tick, a.id)));
      await redis.lpush(CANALES_REDIS.COLA_RESUELTAS, JSON.stringify({ tick, agentes: resueltos }));
    } catch (err) {
      console.error("[Decision] Error procesando lote:", err.message);
    }
  }
}

console.log(`[Decision] Worker ${workerId} esperando lotes`);

setInterval(() => {
  redis.set(`heartbeat:decision:${workerId}`, "1", "EX", 5).catch(() => {});
}, 2000);

procesarLotes();
