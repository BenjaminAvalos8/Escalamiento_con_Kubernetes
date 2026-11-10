const { crearClienteRedis } = require("@anthill/redis-config");
const { CANALES_REDIS, TICKS_POR_PASO, decidir, crearAzar } = require("@anthill/shared-core");

const redis = crearClienteRedis();
const redisCola = crearClienteRedis(); // BRPOP bloquea su conexion: va aparte para no frenar el heartbeat
const workerId = process.env.HOSTNAME || `worker-${Math.random().toString(36).substring(2, 9)}`;

let cerrando = false;

async function procesarLotes() {
  while (!cerrando) {
    try {
      const [, mensaje] = await redisCola.brpop(CANALES_REDIS.COLA_PENDIENTES, 0);
      const { tick, agentes, depredadores, recursos, nido, sequias, rastro, avisosSequia, semilla = 0 } = JSON.parse(mensaje);
      const percepcion = { depredadores, recursos, nido, sequias, rastro, avisosSequia };
      // El azar de cada hormiga es independiente de la replica que tome el lote.
      const semillaTick = semilla ^ Math.imul(tick, 2654435761);
      const resueltos = agentes.map((a) =>
        // Sumar el id reparte los pasos entre ticks: no avanzan todas a la vez
        decidir(a, percepcion, crearAzar(semillaTick ^ a.id), (tick + a.id) % TICKS_POR_PASO === 0)
      );
      await redis.lpush(CANALES_REDIS.COLA_RESUELTAS, JSON.stringify({ tick, agentes: resueltos }));
    } catch (err) {
      if (!cerrando) console.error("[Decision] Error procesando lote:", err.message);
    }
  }
}

console.log(`[Decision] Worker ${workerId} esperando lotes`);

function publicarHeartbeat() {
  redis.set(`heartbeat:decision:${workerId}`, "1", "EX", 5).catch(() => {});
}
publicarHeartbeat();
const heartbeat = setInterval(publicarHeartbeat, 2000);

async function cerrar() {
  if (cerrando) return;
  cerrando = true;
  clearInterval(heartbeat);
  redisCola.disconnect();
  const limite = setTimeout(() => redis.disconnect(), 2000);
  await tarea;
  clearTimeout(limite);
  redis.disconnect();
}
process.once("SIGTERM", cerrar);
process.once("SIGINT", cerrar);

const tarea = procesarLotes();
