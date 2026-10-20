const { crearClienteRedis } = require("@anthill/redis-config");

const redis = crearClienteRedis();
const workerId = process.env.HOSTNAME || `worker-${Math.random().toString(36).substring(2, 9)}`;

async function start() {
  try {
    await redis.connect();
    console.log(`[Decision] Conectado a Redis como worker ${workerId}`);
  } catch (err) {
    console.error("[Decision] Error al conectar a Redis:", err.message);
  }

  setInterval(async () => {
    try {
      await redis.set(`heartbeat:decision:${workerId}`, "1", "EX", 5);
    } catch (err) {
      // Manejo silencioso en reconexion
    }
  }, 2000);
}

start();
