const { crearClienteRedis } = require("@anthill/redis-config");

console.log("=========================================");
console.log("🧠 INICIANDO SERVICIO DE DECISIÓN");
console.log("=========================================");

const redis = crearClienteRedis();

async function start() {
  try {
    await redis.connect();
    console.log("✅ [Decisión] Conexión exitosa con la instancia de Redis.");
  } catch (err) {
    console.error("⚠️ [Decisión] Esperando o reintentando conexión a Redis...", err.message);
  }

  // Loop de procesamiento de decisiones
  setInterval(() => {
    // ponytail: ping simple de worker
  }, 1000);
}

start();
