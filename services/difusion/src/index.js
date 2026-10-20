const http = require("http");
const { Server } = require("socket.io");

console.log("=========================================");
console.log("📡 INICIANDO SERVICIO DE DIFUSIÓN EN VIVO");
console.log("=========================================");

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

io.on("connection", (socket) => {
  console.log(`[Difusión] Cliente conectado: ${socket.id}`);
  socket.on("disconnect", () => {
    console.log(`[Difusión] Cliente desconectado: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🚀 [Difusión] Servidor WebSocket escuchando en el puerto ${PORT}`);
});
