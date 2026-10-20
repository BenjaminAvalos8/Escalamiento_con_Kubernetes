const Redis = require("ioredis");

function crearClienteRedis(opciones = {}) {
  const host = process.env.REDIS_HOST || "redis-service";
  const port = process.env.REDIS_PORT || 6379;

  return new Redis({
    host,
    port: Number(port),
    lazyConnect: true,
    retryStrategy(times) {
      return Math.min(times * 100, 3000);
    },
    ...opciones,
  });
}

module.exports = { crearClienteRedis };
