const { crearClienteRedis } = require("@anthill/redis-config");
const { CANALES_REDIS, ESTADOS } = require("@anthill/shared-core");

const N = Number(process.env.AGENTES_INICIALES ?? 100);
if (!Number.isInteger(N) || N < 0) {
    console.error(`[Motor] AGENTES_INICIALES invalido: "${process.env.AGENTES_INICIALES}"`);
    process.exit(1);
}

const ANCHO = 1000, ALTO = 1000;
const CENTRO_X = 500, CENTRO_Y = 500;
const NIDO = { x: CENTRO_X, y: CENTRO_Y, radio: 20 };
const TICK_MS = 100;
const TAM_LOTE = 500;
const ESPERA_LOTES_MS = 1000; // Si un worker muere, sus hormigas se quedan quietas ese tick
const segundosATicks = (seg) => Math.ceil((seg * 1000) / TICK_MS);

// Inicializacion de agentes con estado
const agentes = Array.from({ length: N }, (_, id) => ({
    id,
    x: Math.max(0, Math.min(ANCHO - 1, CENTRO_X + Math.floor(Math.random() * 60) - 30)),
    y: Math.max(0, Math.min(ALTO - 1, CENTRO_Y + Math.floor(Math.random() * 60) - 30)),
    est: ESTADOS.EXPLORANDO,
    e: 100,
    c: false,
}));
let siguienteId = N;
console.log(`[Motor] Mundo 1000x1000 creado con ${agentes.length} agentes`);

// Generacion inicial de recursos (alimento / parches de comida)
function generarRecursosIniciales(total = 250) {
    const lista = [];
    let idRec = 1;
    const focos = [
        { x: 500, y: 500, dispersion: 110, cant: Math.floor(total * 0.45) }, // Zona central
        { x: 280, y: 280, dispersion: 70, cant: Math.floor(total * 0.15) },
        { x: 720, y: 280, dispersion: 70, cant: Math.floor(total * 0.15) },
        { x: 300, y: 720, dispersion: 70, cant: Math.floor(total * 0.12) },
        { x: 720, y: 720, dispersion: 70, cant: Math.floor(total * 0.13) },
    ];
    for (const f of focos) {
        for (let i = 0; i < f.cant; i++) {
            lista.push({
                id: idRec++,
                x: Math.max(0, Math.min(ANCHO - 1, Math.round(f.x + (Math.random() * 2 - 1) * f.dispersion))),
                y: Math.max(0, Math.min(ALTO - 1, Math.round(f.y + (Math.random() * 2 - 1) * f.dispersion))),
                valor: 1,
            });
        }
    }
    return lista;
}

let recursos = generarRecursosIniciales(250);
let eventosActivos = [];
let depredadores = []; // HU16: Depredadores temporales activos

const redis = crearClienteRedis();
const redisSub = crearClienteRedis();
const redisCola = crearClienteRedis(); // BRPOP bloquea su conexion

async function start() {
    try {
        await redis.set("simulacion:agentes_activos", agentes.length);
        console.log("[Motor] Conectado a Redis y metrica inicial publicada");
    } catch (err) {
        console.error("[Motor] Error al conectar con Redis:", err.message);
    }

    try {
        const canalSequia = CANALES_REDIS.EVENTO_SEQUIA || "canal:eventos:sequia";
        const canalDepredador = CANALES_REDIS.EVENTO_DEPREDADOR || "canal:eventos:depredador";
        const canalAbundancia = CANALES_REDIS.EVENTO_ABUNDANCIA || "canal:eventos:abundancia";

        await redisSub.subscribe("canal:eventos:spawn", "canal:eventos:purge", canalSequia, canalDepredador, canalAbundancia, (err) => {
            if (err) console.error("[Motor] Error al suscribirse a eventos:", err.message);
        });

        redisSub.on("message", (channel, message) => {
            if (channel === "canal:eventos:spawn") {
                try {
                    const { cantidad } = JSON.parse(message);
                    const count = Math.max(1, Number(cantidad) || 0);
                    for (let i = 0; i < count; i++) {
                        agentes.push({
                            id: siguienteId++,
                            x: Math.max(0, Math.min(ANCHO - 1, CENTRO_X + Math.floor(Math.random() * 40) - 20)),
                            y: Math.max(0, Math.min(ALTO - 1, CENTRO_Y + Math.floor(Math.random() * 40) - 20)),
                            est: ESTADOS.EXPLORANDO,
                            e: 100,
                            c: false,
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
            } else if (channel === canalSequia) {
                // HU15: Manejo del evento de Sequia
                try {
                    const data = JSON.parse(message);
                    const zx = data?.zona?.x ?? 500;
                    const zy = data?.zona?.y ?? 500;
                    const zRadio = data?.zona?.radio ?? 150;

                    const antes = recursos.length;
                    recursos = recursos.filter(r => {
                        const dSq = (r.x - zx) ** 2 + (r.y - zy) ** 2;
                        return dSq > zRadio ** 2;
                    });
                    const eliminados = antes - recursos.length;
                    console.log(`[Motor] Sequia aplicada en (${zx}, ${zy}, r=${zRadio}): ${eliminados} recursos eliminados`);

                    eventosActivos.push({ tipo: 'sequia', x: zx, y: zy, radio: zRadio, ticksRestantes: segundosATicks(data?.duracionSegundos ?? 10) });
                } catch (e) {
                    console.error("[Motor] Error al procesar sequia:", e.message);
                }
            } else if (channel === canalDepredador) {
                // HU16: Manejo del evento de Depredador
                try {
                    const data = JSON.parse(message);
                    const cant = Math.max(1, Math.min(5, Number(data?.cantidad) || 3));
                    const zx = data?.zona?.x ?? 500;
                    const zy = data?.zona?.y ?? 500;
                    const zRadio = data?.zona?.radio ?? 200;
                    const duracion = segundosATicks(data?.duracionSegundos ?? 12);

                    for (let i = 0; i < cant; i++) {
                        const angulo = Math.random() * Math.PI * 2;
                        const dist = Math.random() * zRadio * 0.6;
                        depredadores.push({
                            id: `dep-${Date.now()}-${i}`,
                            x: Math.max(0, Math.min(ANCHO - 1, Math.round(zx + Math.cos(angulo) * dist))),
                            y: Math.max(0, Math.min(ALTO - 1, Math.round(zy + Math.sin(angulo) * dist))),
                            ticksRestantes: duracion,
                            radioAmenaza: 80,
                        });
                    }
                    console.log(`[Motor] ${cant} depredadores generados en (${zx}, ${zy}). Total activos: ${depredadores.length}`);

                    eventosActivos.push({ tipo: 'depredador', x: zx, y: zy, radio: zRadio, ticksRestantes: duracion });
                } catch (e) {
                    console.error("[Motor] Error al procesar depredador:", e.message);
                }
            } else if (channel === canalAbundancia) {
                // HU17: Manejo del evento de Abundancia de Recursos
                try {
                    const data = JSON.parse(message);
                    const cant = Math.max(20, Math.min(300, Number(data?.cantidad) || 120));
                    const zx = data?.zona?.x ?? 500;
                    const zy = data?.zona?.y ?? 500;
                    const zRadio = data?.zona?.radio ?? 180;
                    const duracion = segundosATicks(data?.duracionSegundos ?? 15);

                    let nextId = recursos.reduce((max, r) => Math.max(max, r.id), 0) + 1;
                    for (let i = 0; i < cant; i++) {
                        const ang = Math.random() * Math.PI * 2;
                        const dist = Math.random() * zRadio;
                        recursos.push({
                            id: nextId++,
                            x: Math.max(0, Math.min(ANCHO - 1, Math.round(zx + Math.cos(ang) * dist))),
                            y: Math.max(0, Math.min(ALTO - 1, Math.round(zy + Math.sin(ang) * dist))),
                            valor: 1,
                        });
                    }
                    console.log(`[Motor] Abundancia aplicada: +${cant} recursos creados en (${zx}, ${zy}). Total recursos: ${recursos.length}`);

                    eventosActivos.push({ tipo: 'abundancia', x: zx, y: zy, radio: zRadio, ticksRestantes: duracion });
                } catch (e) {
                    console.error("[Motor] Error al procesar abundancia:", e.message);
                }
            }
        });
    } catch (err) {
        console.error("[Motor] Error al conectar suscriptor de eventos:", err.message);
    }

    let tick = 0;
    let comidaNido = 0;

    // Reparte los agentes en lotes (scatter) y espera las respuestas (gather)
    async function repartirYRecoger() {
        const lotes = [];
        const percepcion = {
            depredadores: depredadores.map(({ x, y }) => ({ x, y })),
            recursos: recursos.map(({ id, x, y }) => ({ id, x, y })),
            nido: NIDO,
        };
        for (let i = 0; i < agentes.length; i += TAM_LOTE) {
            lotes.push(JSON.stringify({ tick, agentes: agentes.slice(i, i + TAM_LOTE), ...percepcion }));
        }

        // Lo que quedo de un tick anterior ya no sirve
        await redis.del(CANALES_REDIS.COLA_PENDIENTES, CANALES_REDIS.COLA_RESUELTAS);
        if (lotes.length) await redis.lpush(CANALES_REDIS.COLA_PENDIENTES, ...lotes);

        const decisiones = new Map();
        const limite = performance.now() + ESPERA_LOTES_MS;
        let pendientes = lotes.length;
        while (pendientes > 0) {
            const resta = limite - performance.now();
            if (resta <= 0) break;
            const respuesta = await redisCola.brpop(CANALES_REDIS.COLA_RESUELTAS, Math.max(resta / 1000, 0.01));
            if (!respuesta) break;
            const lote = JSON.parse(respuesta[1]);
            if (lote.tick !== tick) continue;
            for (const a of lote.agentes) decisiones.set(a.id, a);
            pendientes--;
        }
        return decisiones;
    }

    // El motor es la autoridad: aplica en orden fijo y resuelve quien se lleva la comida
    function aplicarDecisiones(decisiones) {
        const porId = new Map(recursos.map((r) => [r.id, r]));
        for (const a of agentes) {
            const decision = decisiones.get(a.id);
            if (!decision) continue;
            const { recoge, entrega, ...nuevo } = decision;
            if (recoge !== undefined) {
                const recurso = porId.get(recoge);
                if (recurso) {
                    if (--recurso.valor <= 0) porId.delete(recoge);
                } else {
                    // Otra hormiga se llevo la ultima unidad en este mismo tick
                    nuevo.c = false;
                    nuevo.e = a.e;
                    nuevo.est = ESTADOS.EXPLORANDO;
                }
            }
            if (entrega) comidaNido++;
            Object.assign(a, nuevo);
        }
        recursos = [...porId.values()];
    }

    async function ejecutarTick() {
        const tInicio = performance.now();
        tick++;

        // Actualizar duracion de eventos activos
        if (eventosActivos.length > 0) {
            eventosActivos = eventosActivos
                .map(ev => ({ ...ev, ticksRestantes: ev.ticksRestantes - 1 }))
                .filter(ev => ev.ticksRestantes > 0);
        }

        // HU16: Mover depredadores y decrementar su vida
        if (depredadores.length > 0) {
            for (const dep of depredadores) {
                dep.ticksRestantes -= 1;
                const dx = Math.floor(Math.random() * 7) - 3;
                const dy = Math.floor(Math.random() * 7) - 3;
                dep.x = Math.max(0, Math.min(ANCHO - 1, dep.x + dx));
                dep.y = Math.max(0, Math.min(ALTO - 1, dep.y + dy));
            }
            depredadores = depredadores.filter(dep => dep.ticksRestantes > 0);
        }

        aplicarDecisiones(await repartirYRecoger());

        const duracionTickMs = Math.round(performance.now() - tInicio);
        const payload = JSON.stringify({
            tick,
            agentes: agentes.map(({ id, x, y, est }) => ({ id, x, y, est })),
            recursos,
            comidaNido,
            depredadores,
            eventosActivos,
            duracionTickMs,
        });
        await redis.publish(CANALES_REDIS.MUNDO_ESTADO, payload);
        return performance.now() - tInicio;
    }

    // Un tick no arranca hasta que termina el anterior: si se satura, baja la cadencia
    async function bucleTicks() {
        let duracion = 0;
        try {
            duracion = await ejecutarTick();
        } catch (err) {
            console.error("[Motor] Error en el tick:", err.message);
        }
        setTimeout(bucleTicks, Math.max(0, TICK_MS - duracion));
    }
    bucleTicks();
}

start();
