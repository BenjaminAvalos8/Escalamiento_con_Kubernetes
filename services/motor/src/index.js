const { crearClienteRedis } = require("@anthill/redis-config");
const { CANALES_REDIS } = require("@anthill/shared-core");

const N = Number(process.env.AGENTES_INICIALES ?? 100);
if (!Number.isInteger(N) || N < 0) {
    console.error(`[Motor] AGENTES_INICIALES invalido: "${process.env.AGENTES_INICIALES}"`);
    process.exit(1);
}

const ANCHO = 1000, ALTO = 1000;
const CENTRO_X = 500, CENTRO_Y = 500;

const agentes = Array.from({ length: N }, (_, id) => ({
    id,
    x: Math.max(0, Math.min(ANCHO - 1, CENTRO_X + Math.floor(Math.random() * 60) - 30)),
    y: Math.max(0, Math.min(ALTO - 1, CENTRO_Y + Math.floor(Math.random() * 60) - 30)),
}));
console.log(`[Motor] Mundo 1000x1000 creado con ${agentes.length} agentes`);

const redis = crearClienteRedis();
const redisSub = crearClienteRedis();

async function start() {
    try {
        await redis.connect();
        await redis.set("simulacion:agentes_activos", agentes.length);
        console.log("[Motor] Conectado a Redis y metrica inicial publicada");
    } catch (err) {
        console.error("[Motor] Error al conectar con Redis:", err.message);
    }

    try {
        await redisSub.connect();
        await redisSub.subscribe("canal:eventos:spawn", "canal:eventos:purge", (err) => {
            if (err) console.error("[Motor] Error al suscribirse a eventos:", err.message);
        });

        redisSub.on("message", (channel, message) => {
            if (channel === "canal:eventos:spawn") {
                try {
                    const { cantidad } = JSON.parse(message);
                    const count = Math.max(1, Number(cantidad) || 0);
                    for (let i = 0; i < count; i++) {
                        agentes.push({
                            id: agentes.length,
                            x: Math.max(0, Math.min(ANCHO - 1, CENTRO_X + Math.floor(Math.random() * 40) - 20)),
                            y: Math.max(0, Math.min(ALTO - 1, CENTRO_Y + Math.floor(Math.random() * 40) - 20)),
                        });
                    }
                    redis.set("simulacion:agentes_activos", agentes.length);
                    console.log(`[Motor] Spawn procesado: +${count} agentes. Total: ${agentes.length}`);
                } catch (e) {
                    console.error("[Motor] Error al parsear spawn:", e.message);
                }
            } else if (channel === "canal:eventos:purge") {
                try {
                    const { cantidad } = JSON.parse(message);
                    const count = Math.max(1, Number(cantidad) || 0);
                    agentes.splice(0, count);
                    redis.set("simulacion:agentes_activos", agentes.length);
                    console.log(`[Motor] Purga procesada: -${count} agentes. Total: ${agentes.length}`);
                } catch (e) {
                    console.error("[Motor] Error al parsear purge:", e.message);
                }
            }
        });
    } catch (err) {
        console.error("[Motor] Error al conectar suscriptor de eventos:", err.message);
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
