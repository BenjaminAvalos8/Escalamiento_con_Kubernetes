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

function actualizarEspectadores() {
  const count = io.engine ? io.engine.clientsCount : 0;
  redis.set("simulacion:espectadores_activos", count).catch(() => {});
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
    await redis.connect().catch(() => {});
    await redis.set("simulacion:espectadores_activos", 0).catch(() => {});
    await redisSub.connect();
    console.log(`[Difusion] Conectado a Redis como worker ${workerId}`);

    setInterval(async () => {
      try {
        await redis.set(`heartbeat:difusion:${workerId}`, "1", "EX", 5);
      } catch (err) {
        // Manejo silencioso en reconexion
      }
    }, 2000);

    await redisSub.subscribe(CANALES_REDIS.MUNDO_ESTADO, (err) => {
      if (err) {
        console.error("[Difusion] Error al suscribirse al canal:", err.message);
      }
    });

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
  } catch (err) {
    console.error("[Difusion] Error al conectar con Redis:", err.message);
  }

  const PORT = process.env.PORT || 4000;
  server.listen(PORT, () => {
    console.log(`[Difusion] Servidor escuchando en el puerto ${PORT}`);
  });
}

start();
