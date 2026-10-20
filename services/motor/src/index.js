const { crearClienteRedis } = require("@anthill/redis-config");
const { CANALES_REDIS } = require("@anthill/shared-core");

const N = Number(process.env.AGENTES_INICIALES ?? 100);
if (!Number.isInteger(N) || N < 0) {
    console.error(`[Motor] AGENTES_INICIALES invalido: "${process.env.AGENTES_INICIALES}"`);
    process.exit(1);
}

const ANCHO = 100, ALTO = 100;
const agentes = Array.from({ length: N }, (_, id) => ({
    id,
    x: Math.floor(Math.random() * ANCHO),
    y: Math.floor(Math.random() * ALTO),
}));
console.log(`[Motor] Mundo creado con ${agentes.length} agentes`);

const redis = crearClienteRedis();

async function start() {
    try {
        await redis.connect();
        console.log("[Motor] Conectado a Redis");
    } catch (err) {
        console.error("[Motor] Error al conectar con Redis:", err.message);
    }

    let tick = 0;
    setInterval(() => {
        tick++;
        for (const a of agentes) {
            const dx = Math.floor(Math.random() * 3) - 1;
            const dy = Math.floor(Math.random() * 3) - 1;
            a.x = Math.max(0, Math.min(ANCHO - 1, a.x + dx));
            a.y = Math.max(0, Math.min(ALTO - 1, a.y + dy));
        }

        const payload = JSON.stringify({ tick, agentes });
        redis.publish(CANALES_REDIS.MUNDO_ESTADO, payload).catch((err) => {
            console.error("[Motor] Error al publicar tick:", err.message);
        });
    }, 500);
}

start();
