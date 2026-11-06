const { io } = require("socket.io-client");

const TARGET_URL = process.env.TARGET_URL || process.argv[2] || "http://localhost:30080";
const CONCURRENCIA = Math.max(1, parseInt(process.env.CONCURRENCIA || process.argv[3] || "150", 10));

console.log("===============================================================================");
console.log(`[HU11] Iniciando prueba de carga de espectadores concurrentes WebSocket`);
console.log(`Destino:      ${TARGET_URL}`);
console.log(`Espectadores: ${CONCURRENCIA}`);
console.log(`Presiona Ctrl + C para detener la carga y observar el scale-down del HPA.`);
console.log("===============================================================================\n");

const sockets = [];
let conectados = 0;
let errores = 0;
let mensajesRecibidos = 0;

function conectarEspectador(index) {
  const socket = io(TARGET_URL, {
    path: "/socket.io",
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 5000,
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
    mensajesRecibidos++;
  });

  sockets.push(socket);
}

// Iniciar conexiones escalonadas para evitar saturar el loop local de sockets
const BATCH_SIZE = 10;
const INTERVALO_MS = 80;
let iniciados = 0;

const launchInterval = setInterval(() => {
  const limite = Math.min(CONCURRENCIA, iniciados + BATCH_SIZE);
  for (let i = iniciados; i < limite; i++) {
    conectarEspectador(i);
  }
  iniciados = limite;

  if (iniciados >= CONCURRENCIA) {
    clearInterval(launchInterval);
  }
}, INTERVALO_MS);

// Reporte de telemetria en consola cada 2 segundos
const reporterInterval = setInterval(() => {
  const porcentaje = Math.round((conectados / CONCURRENCIA) * 100);
  console.log(
    `[Telemetria] Conectados: ${conectados}/${CONCURRENCIA} (${porcentaje}%) | Errores: ${errores} | Ticks recibidos: ${mensajesRecibidos}`
  );
}, 2000);

// Cierre ordenado para evaluar el periodo de enfriamiento (scaleDown)
function detenerPrueba() {
  console.log("\n[HU11] Deteniendo simulacion de carga...");
  clearInterval(launchInterval);
  clearInterval(reporterInterval);

  for (const socket of sockets) {
    try {
      socket.disconnect();
    } catch (_) {}
  }

  console.log("[HU11] Todos los espectadores desconectados.");
  console.log("[HU11] Observa el dashboard o 'kubectl get hpa hpa-difusion' para verificar el scaleDown (aprox 15-30s).");
  process.exit(0);
}

process.on("SIGINT", detenerPrueba);
process.on("SIGTERM", detenerPrueba);
