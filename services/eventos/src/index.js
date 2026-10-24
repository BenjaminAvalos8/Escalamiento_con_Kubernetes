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

app.get("/metrics", async (req, res) => {
  try {
    const val = await redis.get("simulacion:agentes_activos");
    const total = parseInt(val, 10) || 0;
    const valEsp = await redis.get("simulacion:espectadores_activos");
    const totalEsp = parseInt(valEsp, 10) || 0;
    res.setHeader("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
    res.send(
      "# HELP anthill_agentes_activos Cantidad de agentes simulados activos\n" +
      "# TYPE anthill_agentes_activos gauge\n" +
      `anthill_agentes_activos ${total}\n` +
      "# HELP anthill_espectadores_activos Cantidad de espectadores websocket conectados\n" +
      "# TYPE anthill_espectadores_activos gauge\n" +
      `anthill_espectadores_activos ${totalEsp}\n`
    );
  } catch (err) {
    res.status(500).send("# ERROR\n");
  }
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
  const count = Math.max(1, Number(req.body?.cantidad) || 50);
  redis.publish("canal:eventos:spawn", JSON.stringify({ cantidad: count })).catch((err) => {
    console.error("[Eventos] Error publicando spawn a Redis:", err.message);
  });
  console.log(`[Eventos] Spawn de agentes solicitado: ${count}`);
  res.json({ status: "ok", cantidad: count });
});

app.post("/api/admin/purge", (req, res) => {
  const count = Math.max(1, Number(req.body?.cantidad) || 50);
  redis.publish("canal:eventos:purge", JSON.stringify({ cantidad: count })).catch((err) => {
    console.error("[Eventos] Error publicando purge a Redis:", err.message);
  });
  console.log(`[Eventos] Purga de agentes solicitada: ${count}`);
  res.json({ status: "ok", cantidad: count });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[Eventos] Servidor API escuchando en el puerto ${PORT}`);
});
