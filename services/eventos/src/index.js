const express = require("express");
const { crearClienteRedis } = require("@anthill/redis-config");
const { CANALES_REDIS } = require("@anthill/shared-core");

const app = express();
app.use(express.json());

const redis = crearClienteRedis();

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/metrics", async (req, res) => {
  try {
    const val = await redis.get("simulacion:agentes_activos");
    const total = parseInt(val, 10) || 0;
    const clavesEsp = await redis.keys("espectadores:*");
    const valoresEsp = clavesEsp.length ? await redis.mget(clavesEsp) : [];
    const totalEsp = valoresEsp.reduce((suma, v) => suma + (parseInt(v, 10) || 0), 0);
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
    const keysDecision = await redis.keys("heartbeat:decision:*");
    const keysDifusion = await redis.keys("heartbeat:difusion:*");
    res.json({
      replicasDecision: Math.max(1, keysDecision.length),
      replicasDifusion: Math.max(1, keysDifusion.length),
    });
  } catch (err) {
    res.json({ replicasDecision: 1, replicasDifusion: 1 });
  }
});

// HU15: Endpoint para disparar sequia
app.post("/api/eventos/sequia", async (req, res) => {
  const zona = req.body?.zona || { x: 500, y: 500, radio: 150 };
  const payload = {
    tipo: "sequia",
    timestamp: Date.now(),
    zona,
    duracionTicks: req.body?.duracionTicks || 30,
  };
  try {
    const canal = CANALES_REDIS.EVENTO_SEQUIA || "canal:eventos:sequia";
    await redis.publish(canal, JSON.stringify(payload));
    console.log(`[Eventos] Evento de sequia publicado a Redis (${zona.x}, ${zona.y}, r=${zona.radio})`);
    res.json({ status: "ok", evento: "sequia", zona, cooldownSegundos: 10 });
  } catch (err) {
    console.error("[Eventos] Error publicando sequia a Redis:", err.message);
    res.status(500).json({ error: "Error al publicar evento sequia" });
  }
});

// HU16: Endpoint para disparar la aparicion de depredadores
app.post("/api/eventos/depredador", async (req, res) => {
  const cantidad = Math.max(1, Math.min(5, Number(req.body?.cantidad) || 3));
  const zona = req.body?.zona || { x: 500, y: 500, radio: 200 };
  const payload = {
    tipo: "depredador",
    timestamp: Date.now(),
    cantidad,
    zona,
    duracionTicks: req.body?.duracionTicks || 25,
  };
  try {
    const canal = CANALES_REDIS.EVENTO_DEPREDADOR || "canal:eventos:depredador";
    await redis.publish(canal, JSON.stringify(payload));
    console.log(`[Eventos] Evento de depredador publicado: ${cantidad} depredadores en (${zona.x}, ${zona.y})`);
    res.json({ status: "ok", evento: "depredador", cantidad, cooldownSegundos: 12 });
  } catch (err) {
    console.error("[Eventos] Error publicando depredador a Redis:", err.message);
    res.status(500).json({ error: "Error al publicar evento depredador" });
  }
});

// HU17: Endpoint para disparar abundancia de recursos
app.post("/api/eventos/abundancia", async (req, res) => {
  const cantidad = Math.max(20, Math.min(300, Number(req.body?.cantidad) || 120));
  const zona = req.body?.zona || { x: 500, y: 500, radio: 180 };
  const payload = {
    tipo: "abundancia",
    timestamp: Date.now(),
    cantidad,
    zona,
    duracionTicks: req.body?.duracionTicks || 30,
  };
  try {
    const canal = CANALES_REDIS.EVENTO_ABUNDANCIA || "canal:eventos:abundancia";
    await redis.publish(canal, JSON.stringify(payload));
    console.log(`[Eventos] Evento de abundancia publicado: +${cantidad} recursos en zona (${zona.x}, ${zona.y})`);
    res.json({ status: "ok", evento: "abundancia", cantidad, zona, cooldownSegundos: 10 });
  } catch (err) {
    console.error("[Eventos] Error publicando abundancia a Redis:", err.message);
    res.status(500).json({ error: "Error al publicar evento abundancia" });
  }
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
