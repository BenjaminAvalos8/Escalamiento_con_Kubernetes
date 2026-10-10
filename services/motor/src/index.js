console.log("=========================================");
console.log("🤖 INICIANDO EL MOTOR DEL MUNDO (HOLA MUNDO)");
console.log("=========================================");

// Un bucle tonto simulando el tick del mundo cada 1 segundo (1000 ms)
let tick = 0;
setInterval(() => {
    tick++;
    console.log(`[Motor] Calculando Tick ${tick}... listo. Publicando a Redis (simulado)`);
}, 1000);
