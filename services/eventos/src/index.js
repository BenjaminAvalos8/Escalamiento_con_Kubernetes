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

// HU15, HU16, HU17: cooldown en Redis (SET NX) para que valga para todos los usuarios
const EVENTOS = {
  sequia: { canal: CANALES_REDIS.EVENTO_SEQUIA, cooldown: 10 },
  depredador: { canal: CANALES_REDIS.EVENTO_DEPREDADOR, cooldown: 8 },
  abundancia: { canal: CANALES_REDIS.EVENTO_ABUNDANCIA, cooldown: 6 },
};

app.post("/api/eventos/:tipo", async (req, res) => {
  const { tipo } = req.params;
  if (!Object.hasOwn(EVENTOS, tipo)) return res.status(404).json({ error: "Evento desconocido" });
  const { canal, cooldown } = EVENTOS[tipo];
  try {
    const clave = `cooldown:${tipo}`;
    if (!(await redis.set(clave, "1", "EX", cooldown, "NX"))) {
      return res.status(429).json({ error: "Evento en enfriamiento", cooldownSegundos: Math.max(1, await redis.ttl(clave)) });
    }
    await redis.publish(canal, JSON.stringify({ tipo, duracionSegundos: cooldown }));
    console.log(`[Eventos] Evento ${tipo} publicado`);
    res.json({ status: "ok", evento: tipo, cooldownSegundos: cooldown });
  } catch (err) {
    console.error(`[Eventos] Error publicando ${tipo}:`, err.message);
    res.status(500).json({ error: `Error al publicar evento ${tipo}` });
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
