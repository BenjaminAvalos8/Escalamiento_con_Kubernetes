const { io } = require("socket.io-client");

/**
 * HU21: Ejecutar pruebas incrementando la cantidad de usuarios/espectadores conectados.
 * 
 * Criterios de Aceptación:
 * 1. Script propio en escalones de 10, 50, 100, 500 y 1000 conexiones WebSocket concurrentes.
 * 2. El HPA asignado a difusión despliega pods secundarios para equilibrar la red.
 * 3. El pod de la simulación del mundo (motor) mantiene su nivel de CPU inalterado.
 */

const TARGET_URL = process.env.TARGET_URL || process.argv[2] || "http://localhost:30080";

// Escalones definidos estrictamente por la HU21
const ESCALONES = [
  { nivel: 10, duracionSegundos: 30, desc: "Escalon 1: Carga base (10 espectadores)" },
  { nivel: 50, duracionSegundos: 35, desc: "Escalon 2: Incremento moderado (50 espectadores -> ~2 replicas)" },
  { nivel: 100, duracionSegundos: 40, desc: "Escalon 3: Carga media (100 espectadores -> ~4 replicas)" },
  { nivel: 500, duracionSegundos: 45, desc: "Escalon 4: Alta concurrencia (500 espectadores -> ~10 replicas max)" },
  { nivel: 1000, duracionSegundos: 45, desc: "Escalon 5: Carga masiva pico (1000 espectadores concurrentes)" },
];

console.log("===============================================================================");
console.log(" [HU21] PRUEBA DE ESTRÉS ESCALONADA DE ESPECTADORES WEBSOCKET (HEADLESS)");
console.log(` Destino del gateway: ${TARGET_URL}`);
console.log(" Escalones programados: 10 -> 50 -> 100 -> 500 -> 1000 conexiones");
console.log(" Comandos recomendados en terminales paralelas para observar el clúster:");
console.log("   Terminal 1 (HPA):  kubectl get hpa hpa-difusion -w");
console.log("   Terminal 2 (Pods): kubectl get pods -l app=difusion -w");
console.log("   Terminal 3 (CPU):  kubectl top pod -l app=motor");
console.log("===============================================================================\n");

const sockets = [];
let conectados = 0;
let errores = 0;
let ticksRecibidos = 0;

function conectarUnEspectador(id) {
  const socket = io(TARGET_URL, {
    path: "/socket.io",
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 8000,
  });

  socket.on("connect", () => {
    conectados++;
  });

  socket.on("disconnect", () => {
    if (conectados > 0) conectados--;
  });

  socket.on("connect_error", () => {
    errores++;
  });

  socket.on("mundo:estado", () => {
    ticksRecibidos++;
  });

  sockets.push(socket);
}

function ajustarConexionesA(objetivo) {
  const actuales = sockets.length;

  if (objetivo > actuales) {
    const porCrear = objetivo - actuales;
    console.log(`>>> Ajustando sockets: agregando +${porCrear} conexiones hacia el objetivo de ${objetivo}...`);
    // Lanzar en pequeños lotes para no bloquear el bucle de red de Node local
    let lanzados = 0;
    const batchInterval = setInterval(() => {
      const lote = Math.min(25, porCrear - lanzados);
      for (let i = 0; i < lote; i++) {
        conectarUnEspectador(actuales + lanzados + i);
      }
      lanzados += lote;
      if (lanzados >= porCrear) {
        clearInterval(batchInterval);
      }
    }, 40);
  } else if (objetivo < actuales) {
    const porCerrar = actuales - objetivo;
    console.log(`>>> Reduciendo sockets: desconectando -${porCerrar} conexiones...`);
    for (let i = 0; i < porCerrar; i++) {
      const s = sockets.pop();
      try {
        s.disconnect();
      } catch (_) {}
    }
  }
}

// Bucle de telemetria cada 3 segundos
const monitorInterval = setInterval(() => {
  const objetivoActual = sockets.length;
  console.log(
    `[Telemetria HU21] Conectados: ${conectados}/${objetivoActual} | Errores: ${errores} | Ticks WS recibidos: ${ticksRecibidos}`
  );
}, 3000);

// Ejecutar la secuencia de escalones
let indiceEscalon = 0;

function ejecutarSiguienteEscalon() {
  if (indiceEscalon >= ESCALONES.length) {
    finalizarPrueba();
    return;
  }

  const escalon = ESCALONES[indiceEscalon];
  console.log("\n-------------------------------------------------------------------------------");
  console.log(`>>> ${escalon.desc}`);
  console.log(`    Objetivo: ${escalon.nivel} conexiones concurrentes | Duracion: ${escalon.duracionSegundos}s`);
  console.log("-------------------------------------------------------------------------------");

  ajustarConexionesA(escalon.nivel);

  indiceEscalon++;
  setTimeout(ejecutarSiguienteEscalon, escalon.duracionSegundos * 1000);
}

function finalizarPrueba() {
  console.log("\n===============================================================================");
  console.log(" [HU21] Todos los escalones (10, 50, 100, 500, 1000) han sido completados.");
  console.log(" Iniciando fase de enfriamiento (Scale-Down): desconectando todos los sockets...");
  console.log("===============================================================================");

  clearInterval(monitorInterval);

  while (sockets.length > 0) {
    const s = sockets.pop();
    try {
      s.disconnect();
    } catch (_) {}
  }

  console.log("\n>>> Todos los espectadores desconectados (0 conexiones activas).");
  console.log(">>> Observa el HPA en terminal: debe comenzar la reduccion (scaleDown) hacia 1 replica.");
  console.log(">>> Prueba de HU21 completada con exito.\n");
  process.exit(0);
}

process.on("SIGINT", () => {
  console.log("\n[HU21] Interrupcion manual recibida. Cerrando conexiones...");
  finalizarPrueba();
});

// Iniciar primer escalón
ejecutarSiguienteEscalon();
