const { setTimeout: esperar } = require("node:timers/promises");
const { io } = require("socket.io-client");
const { configurar, registrarEscalones } = require("./mediciones");

async function ejecutar() {
  const config = configurar("espectadores", process.env.CONCURRENCIA || "150");
  if (config.niveles.length === 1 && process.argv[4] === undefined) config.segundos = Infinity;
  const { url, signal } = config;
  const sockets = [];
  let errores = 0;
  let retardoWsMs;
  const contar = () => sockets.filter((socket) => socket.connected).length;

  function conectar() {
    const esObservador = sockets.length === 0;
    const socket = io(url.origin, {
      path: "/socket.io",
      transports: ["websocket"],
      forceNew: true,
      reconnectionDelay: 1000,
      timeout: 5000,
    });
    socket.on("connect_error", () => { errores++; });
    if (esObservador) {
      socket.on("disconnect", () => { retardoWsMs = undefined; });
      socket.on("mundo:estado", ({ emitidoEnMs }) => {
        if (Number.isFinite(emitidoEnMs)) retardoWsMs = Date.now() - emitidoEnMs;
      });
    }
    sockets.push(socket);
  }

  async function ajustar(objetivo) {
    for (const socket of sockets.splice(objetivo)) socket.disconnect();
    while (sockets.length < objetivo) {
      const finLote = Math.min(objetivo, sockets.length + 20);
      while (sockets.length < finLote) conectar();
      if (sockets.length < objetivo) await esperar(100, undefined, { signal });
    }
    const limite = performance.now() + 45000;
    while (contar() !== objetivo) {
      if (performance.now() >= limite) {
        throw new Error(`Se conectaron ${contar()} de ${objetivo} espectadores (${errores} errores)`);
      }
      await esperar(250, undefined, { signal });
    }
  }

  try {
    await registrarEscalones(config, ajustar, () => ({
      sockets_conectados: contar(),
      errores_de_conexion: errores,
      retardo_ws_ms: retardoWsMs ?? null,
    }));
  } catch (error) {
    if (!signal.aborted) throw error;
  } finally {
    for (const socket of sockets) socket.disconnect();
  }
}

ejecutar().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
