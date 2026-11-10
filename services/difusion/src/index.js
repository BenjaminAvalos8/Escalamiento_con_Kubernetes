const http = require("http");
const { Server } = require("socket.io");
const { crearClienteRedis } = require("@anthill/redis-config");
const { CANALES_REDIS } = require("@anthill/shared-core");

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ status: "ok" }));
  }
  res.writeHead(404);
  res.end();
});

const io = new Server(server, {
  cors: { origin: "*" },
});

const redis = crearClienteRedis();
const redisSub = crearClienteRedis();
const workerId = process.env.HOSTNAME || `difusion-${Math.random().toString(36).substring(2, 9)}`;
let heartbeat;
let cerrando = false;

function actualizarEspectadores() {
  if (cerrando) return;
  // Cada replica publica su propia cuenta; eventos suma todas. El TTL borra la de un pod caido.
  const count = io.engine ? io.engine.clientsCount : 0;
  redis.set(`espectadores:${workerId}`, count, "EX", 5).catch(() => {});
}

io.on("connection", (socket) => {
  console.log(`[Difusion] Cliente conectado: ${socket.id}`);
  actualizarEspectadores();

  socket.on("disconnect", () => {
    console.log(`[Difusion] Cliente desconectado: ${socket.id}`);
    actualizarEspectadores();
  });
});

async function start() {
  try {
    console.log(`[Difusion] Conectado a Redis como worker ${workerId}`);

    redisSub.on("message", (channel, message) => {
      if (channel === CANALES_REDIS.MUNDO_ESTADO) {
        try {
          const data = JSON.parse(message);
          io.emit("mundo:estado", data);
        } catch (e) {
          console.error("[Difusion] Error al parsear mensaje de mundo:", e.message);
        }
      }
    });
    await redisSub.subscribe(CANALES_REDIS.MUNDO_ESTADO);
  } catch (err) {
    if (!cerrando) console.error("[Difusion] Error al conectar con Redis:", err.message);
  }

  if (cerrando) return;
  const PORT = process.env.PORT || 4000;
  server.listen(PORT, () => {
    if (cerrando) return;
    console.log(`[Difusion] Servidor escuchando en el puerto ${PORT}`);
    function publicarHeartbeat() {
      redis.set(`heartbeat:difusion:${workerId}`, "1", "EX", 5).catch(() => {});
      actualizarEspectadores();
    }
    publicarHeartbeat();
    heartbeat = setInterval(publicarHeartbeat, 2000);
  });
}

function cerrar() {
  if (cerrando) return;
  cerrando = true;
  clearInterval(heartbeat);
  redisSub.disconnect();
  redis.disconnect();
  io.close();
  setTimeout(() => server.closeAllConnections(), 2000).unref();
}
process.once("SIGTERM", cerrar);
process.once("SIGINT", cerrar);

start();
