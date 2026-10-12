const N = Number(process.env.AGENTES_INICIALES ?? 100);
if (!Number.isInteger(N) || N < 0) {
    console.error(`[Motor] AGENTES_INICIALES inválido: "${process.env.AGENTES_INICIALES}"`);
    process.exit(1);
}

// ponytail: mundo fijo de 100x100; moverlo a configuración cuando exista la HU del mundo
const ANCHO = 100, ALTO = 100;
const agentes = Array.from({ length: N }, (_, id) => ({
    id,
    x: Math.floor(Math.random() * ANCHO),
    y: Math.floor(Math.random() * ALTO),
}));
console.log(`[Motor] Mundo creado con ${agentes.length} agentes`);

let tick = 0;
setInterval(() => {
    tick++;
    console.log(`[Motor] Calculando Tick ${tick}... listo. Publicando a Redis (simulado)`);
}, 1000);