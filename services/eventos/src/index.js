const express = require("express");
const { crearClienteRedis } = require("@anthill/redis-config");

const app = express();
app.use(express.json());

const redis = crearClienteRedis();
redis.connect().catch((err) => {
  console.error("[Eventos] Error al conectar a Redis:", err.message);
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/metricas/infraestructura", async (req, res) => {
  try {
    const keys = await redis.keys("heartbeat:decision:*");
    res.json({ replicasDecision: Math.max(1, keys.length) });
  } catch (err) {
    res.json({ replicasDecision: 1 });
  }
});

app.post("/api/eventos/sequia", (req, res) => {
  console.log("[Eventos] Recibido evento de sequia");
  res.json({ status: "ok", evento: "sequia" });
});

app.post("/api/eventos/depredador", (req, res) => {
  console.log("[Eventos] Recibido evento de depredador:", req.body);
  res.json({ status: "ok", evento: "depredador" });
});

app.post("/api/admin/spawn", (req, res) => {
  const { cantidad } = req.body;
  console.log(`[Eventos] Spawn masivo de agentes: ${cantidad}`);
  res.json({ status: "ok", cantidad });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[Eventos] Servidor API escuchando en el puerto ${PORT}`);
});
