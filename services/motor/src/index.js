const { crearClienteRedis } = require("@anthill/redis-config");
const { CANALES_REDIS, ESTADOS, RADIO_PANICO, crearAzar } = require("@anthill/shared-core");
const { moverYCapturar, distancia } = require("./depredadores");

const N = Number(process.env.AGENTES_INICIALES ?? 100);
if (!Number.isInteger(N) || N < 0) {
    console.error(`[Motor] AGENTES_INICIALES invalido: "${process.env.AGENTES_INICIALES}"`);
    process.exit(1);
}

const semillaTexto = process.env.SEMILLA_SIMULACION;
const semilla = semillaTexto === undefined ? undefined : Number(semillaTexto);
if (semilla !== undefined && (!/^\d+$/.test(semillaTexto) || semilla > 0xffffffff)) {
    console.error("[Motor] SEMILLA_SIMULACION debe ser un entero de 0 a 4294967295");
    process.exit(1);
}
const azar = semilla === undefined ? Math.random : crearAzar(semilla);

const ANCHO = 1000, ALTO = 1000;
const CENTRO_X = 500, CENTRO_Y = 500;
const NIDO = { x: CENTRO_X, y: CENTRO_Y, radio: 20 };
const TICK_MS = 100;
const MAX_DEPREDADORES = 5;
const PARCHES_ABUNDANCIA = 120;
const UNIDADES_POR_PARCHE = 5;
const UNIDADES_POR_AVE = 300;
const DURACION_RASTRO_TICKS = 300;
const TAM_LOTE = 500;
const ESPERA_LOTES_MS = 1000; // Si un worker muere, sus hormigas se quedan quietas ese tick
const segundosATicks = (seg) => Math.ceil((seg * 1000) / TICK_MS);

// Inicializacion de agentes con estado
const agentes = Array.from({ length: N }, (_, id) => ({
    id,
    x: CENTRO_X + Math.floor(azar() * 60) - 30,
    y: CENTRO_Y + Math.floor(azar() * 60) - 30,
    est: ESTADOS.EXPLORANDO,
    e: 100,
    c: false,
}));
let siguienteId = N;
console.log(`[Motor] Mundo 1000x1000 creado con ${agentes.length} agentes. Semilla: ${semilla ?? "aleatoria"}`);

// Segun la matriz, la comida solo aparece con el evento de abundancia
let recursos = [];
let eventosActivos = [];
let depredadores = []; // HU16: Depredadores temporales activos
let siguienteRecursoId = 1;
let siguienteDepredadorId = 1;
let siguienteSequiaId = 1;
const feromonas = new Map();
const avisosSequia = new Map();
const mensajes = [];

const redis = crearClienteRedis();
const redisSub = crearClienteRedis();
const redisCola = crearClienteRedis(); // BRPOP bloquea su conexion
let cerrando = false;
let temporizador;
function cerrar() {
    if (cerrando) return;
    cerrando = true;
    clearTimeout(temporizador);
    for (const cliente of [redisCola, redisSub, redis]) cliente.disconnect();
}
process.once("SIGTERM", cerrar);
process.once("SIGINT", cerrar);

async function start() {
    try {
        await redis.set("simulacion:agentes_activos", agentes.length);
        console.log("[Motor] Conectado a Redis y metrica inicial publicada");
    } catch (err) {
        if (!cerrando) console.error("[Motor] Error al conectar con Redis:", err.message);
    }
    if (cerrando) return;

    const canalSequia = CANALES_REDIS.EVENTO_SEQUIA;
    const canalDepredador = CANALES_REDIS.EVENTO_DEPREDADOR;
    const canalAbundancia = CANALES_REDIS.EVENTO_ABUNDANCIA;

    try {
        redisSub.on("message", (channel, message) => mensajes.push([channel, message]));
        await redisSub.subscribe("canal:eventos:spawn", "canal:eventos:purge", canalSequia, canalDepredador, canalAbundancia);
    } catch (err) {
        if (!cerrando) console.error("[Motor] Error al suscribirse a eventos:", err.message);
    }
    if (cerrando) return;

    function aplicarEvento(channel, message) {
        if (channel === "canal:eventos:spawn") {
            try {
                const { cantidad } = JSON.parse(message);
                const count = Math.max(1, Number(cantidad) || 0);
                for (let i = 0; i < count; i++) {
                    agentes.push({
                        id: siguienteId++,
                        x: CENTRO_X + Math.floor(azar() * 40) - 20,
                        y: CENTRO_Y + Math.floor(azar() * 40) - 20,
                        est: ESTADOS.EXPLORANDO,
                        e: 100,
                        c: false,
                    });
                }
                console.log(`[Motor] Spawn procesado: +${count} agentes. Total: ${agentes.length}`);
            } catch (e) {
                console.error("[Motor] Error al parsear spawn:", e.message);
            }
        } else if (channel === "canal:eventos:purge") {
            try {
                const { cantidad } = JSON.parse(message);
                const count = Math.max(1, Number(cantidad) || 0);
                agentes.splice(0, count);
                console.log(`[Motor] Purga procesada: -${count} agentes. Total: ${agentes.length}`);
            } catch (e) {
                console.error("[Motor] Error al parsear purge:", e.message);
            }
        } else if (channel === canalSequia) {
            // HU15: Sequia en zona aleatoria cerca de la colonia, para que afecte a la comida
            try {
                const { duracionSegundos } = JSON.parse(message);
                const zona = {
                    x: CENTRO_X + Math.round((azar() * 2 - 1) * 150),
                    y: CENTRO_Y + Math.round((azar() * 2 - 1) * 150),
                    radio: 150,
                };
                const antes = recursos.length;
                recursos = recursos.filter((r) => distancia(r, zona) > zona.radio);
                console.log(`[Motor] Sequia en (${zona.x}, ${zona.y}): ${antes - recursos.length} recursos eliminados`);
                eventosActivos.push({ id: `sequia-${siguienteSequiaId++}`, tipo: 'sequia', ...zona, ticksRestantes: segundosATicks(duracionSegundos) });
            } catch (e) {
                console.error("[Motor] Error al procesar sequia:", e.message);
            }
        } else if (channel === canalDepredador) {
            // HU16: 1, 3 o 5 depredadores cerca de la colonia; con 5 activos sale el mas antiguo
            try {
                const { duracionSegundos, cantidad = 1 } = JSON.parse(message);
                for (let i = 0; i < cantidad; i++) {
                    if (depredadores.length >= MAX_DEPREDADORES) {
                        const viejo = depredadores.shift();
                        eventosActivos = eventosActivos.filter((ev) => ev.id !== viejo.id);
                    }
                    const angulo = azar() * Math.PI * 2;
                    const dist = NIDO.radio + 20 + azar() * 60;
                    const dep = {
                        id: `dep-${siguienteDepredadorId++}`,
                        x: Math.round(CENTRO_X + Math.cos(angulo) * dist),
                        y: Math.round(CENTRO_Y + Math.sin(angulo) * dist),
                        ticksRestantes: segundosATicks(duracionSegundos),
                        radioAmenaza: RADIO_PANICO,
                    };
                    depredadores.push(dep);
                    eventosActivos.push({ id: dep.id, tipo: 'depredador', x: dep.x, y: dep.y, radio: RADIO_PANICO, ticksRestantes: dep.ticksRestantes });
                }
                console.log(`[Motor] +${cantidad} depredador(es). Activos: ${depredadores.length}`);
            } catch (e) {
                console.error("[Motor] Error al procesar depredador:", e.message);
            }
        } else if (channel === canalAbundancia) {
            // HU17: Parches cerca del centro; la FSM atrae a las hormigas que los ven
            try {
                const { duracionSegundos } = JSON.parse(message);
                const zona = { x: CENTRO_X, y: CENTRO_Y, radio: 180 };
                const nuevos = [];
                for (let i = 0; i < PARCHES_ABUNDANCIA; i++) {
                    nuevos.push({
                        x: Math.round(zona.x + (azar() * 2 - 1) * zona.radio),
                        y: Math.round(zona.y + (azar() * 2 - 1) * zona.radio),
                        unidades: UNIDADES_POR_PARCHE,
                    });
                }
                const angulo = azar() * Math.PI * 2;
                nuevos.push({
                    x: CENTRO_X + Math.round(Math.cos(angulo) * 45),
                    y: CENTRO_Y + Math.round(Math.sin(angulo) * 45),
                    tipo: "ave",
                    unidades: UNIDADES_POR_AVE,
                });
                // En una sequia activa no brota comida
                const sequias = eventosActivos.filter((ev) => ev.tipo === "sequia");
                for (const r of nuevos) {
                    if (!sequias.some((s) => distancia(r, s) <= s.radio)) recursos.push({ id: siguienteRecursoId++, ...r });
                }
                console.log(`[Motor] Abundancia: ${recursos.length} recursos en el mapa`);
                eventosActivos.push({ tipo: 'abundancia', ...zona, ticksRestantes: segundosATicks(duracionSegundos) });
            } catch (e) {
                console.error("[Motor] Error al procesar abundancia:", e.message);
            }
        }
    }

    let tick = 0;
    let comidaNido = 0;
    const inicioMs = Date.now();

    // Reparte los agentes en lotes (scatter) y espera las respuestas (gather)
    async function repartirYRecoger() {
        const lotes = [];
        const fuentesActivas = new Set(recursos.map(({ id }) => id));
        const rastro = {};
        for (const [celda, { id, x, y, vence }] of feromonas) {
            if (vence <= tick || !fuentesActivas.has(id)) feromonas.delete(celda);
            else rastro[celda] = { id, x, y };
        }
        const sequias = eventosActivos.filter(({ tipo }) => tipo === "sequia");
        const alertas = {};
        for (const [celda, id] of avisosSequia) {
            if (sequias.some((zona) => zona.id === id)) alertas[celda] = id;
            else avisosSequia.delete(celda);
        }
        const percepcion = {
            depredadores: depredadores.map(({ x, y }) => ({ x, y })),
            recursos: recursos.map(({ id, x, y }) => ({ id, x, y })),
            sequias,
            rastro: feromonas.size ? rastro : undefined,
            avisosSequia: avisosSequia.size ? alertas : undefined,
            nido: NIDO,
        };
        for (let i = 0; i < agentes.length; i += TAM_LOTE) {
            lotes.push(JSON.stringify({ tick, semilla, agentes: agentes.slice(i, i + TAM_LOTE), ...percepcion }));
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
            const { recoge, entrega, avisoSequia, ...nuevo } = decision;
            if (avisoSequia !== undefined) avisosSequia.set(`${a.x},${a.y}`, avisoSequia);
            if (recoge !== undefined) {
                const recurso = porId.get(recoge);
                if (recurso) {
                    if (--recurso.unidades <= 0) porId.delete(recoge);
                } else {
                    // Otra hormiga se llevo la ultima unidad en este mismo tick
                    nuevo.c = false;
                    nuevo.e = a.e;
                    nuevo.est = ESTADOS.EXPLORANDO;
                    delete nuevo.fuenteId;
                }
            }
            if (a.c && (nuevo.est === ESTADOS.VOLVIENDO || entrega)) {
                const fuente = porId.get(a.fuenteId);
                // Solo se marca un paso que regresa hacia la fuente, para que el rastro no tenga ciclos.
                if (fuente && distancia(a, fuente) < distancia(nuevo, fuente)) {
                    feromonas.set(`${nuevo.x},${nuevo.y}`, {
                        id: fuente.id, x: a.x, y: a.y, vence: tick + DURACION_RASTRO_TICKS,
                    });
                }
            }
            if (entrega) comidaNido++;
            if (nuevo.fuenteId === undefined) delete a.fuenteId;
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

        depredadores = depredadores.filter((dep) => --dep.ticksRestantes > 0);
        // Los eventos se aplican entre ticks, con el mundo y las colas en un estado consistente.
        for (const [channel, message] of mensajes.splice(0)) aplicarEvento(channel, message);
        const { capturados, derrotados } = moverYCapturar(depredadores, agentes, NIDO);
        if (capturados.size) {
            let vivos = 0;
            for (const a of agentes) {
                if (!capturados.has(a.id)) agentes[vivos++] = a;
            }
            agentes.length = vivos;
        }
        for (const dep of derrotados) {
            depredadores = depredadores.filter(({ id }) => id !== dep.id);
            eventosActivos = eventosActivos.filter(({ id }) => id !== dep.id);
            recursos.push({ id: siguienteRecursoId++, x: dep.x, y: dep.y, unidades: 30 });
        }

        aplicarDecisiones(await repartirYRecoger());

        const duracionTickMs = Math.round(performance.now() - tInicio);
        const payload = JSON.stringify({
            tick,
            agentes: agentes.map(({ id, x, y, est }) => ({ id, x, y, est })),
            recursos,
            comidaNido,
            segundos: Math.floor((Date.now() - inicioMs) / 1000),
            depredadores,
            eventosActivos,
            duracionTickMs,
            emitidoEnMs: Date.now(),
        });
        // Cada tick, para que la metrica del HPA vuelva sola si Redis se reinicia
        await Promise.all([
            redis.set("simulacion:agentes_activos", agentes.length),
            redis.set("simulacion:duracion_tick_ms", duracionTickMs, "EX", 5),
            redis.publish(CANALES_REDIS.MUNDO_ESTADO, payload),
        ]);
        return performance.now() - tInicio;
    }

    // Un tick no arranca hasta que termina el anterior: si se satura, baja la cadencia
    async function bucleTicks() {
        let duracion = 0;
        try {
            duracion = await ejecutarTick();
        } catch (err) {
            if (!cerrando) console.error("[Motor] Error en el tick:", err.message);
        }
        if (!cerrando) temporizador = setTimeout(bucleTicks, Math.max(0, TICK_MS - duracion));
    }
    bucleTicks();
}

start();
