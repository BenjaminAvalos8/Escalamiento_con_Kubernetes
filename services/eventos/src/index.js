const express = require("express");
const { crearClienteRedis } = require("@anthill/redis-config");
const { CANALES_REDIS } = require("@anthill/shared-core");

const app = express();
app.use(express.json());

const redis = crearClienteRedis();

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Lo mismo que lee Prometheus y lo que guarda el historico de HU22
async function leerTelemetria() {
  const [[agentes, latencia], clavesEsp, decision, difusion] = await Promise.all([
    redis.mget("simulacion:agentes_activos", "simulacion:duracion_tick_ms"),
    redis.keys("espectadores:*"),
    redis.keys("heartbeat:decision:*"),
    redis.keys("heartbeat:difusion:*"),
  ]);
  const valoresEsp = clavesEsp.length ? await redis.mget(clavesEsp) : [];
  return {
    agentes: Number(agentes) || 0,
    espectadores: valoresEsp.reduce((suma, v) => suma + (parseInt(v, 10) || 0), 0),
    replicasDecision: decision.length,
    replicasDifusion: difusion.length,
    // Sin motor no hay latencia: queda vacia en vez de 0
    latencia: latencia === null ? null : Number(latencia),
  };
}

app.get("/metrics", async (req, res) => {
  try {
    const { agentes, espectadores, replicasDecision, replicasDifusion, latencia } = await leerTelemetria();
    res.setHeader("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
    res.send(
      "# HELP anthill_agentes_activos Cantidad de agentes simulados activos\n" +
      "# TYPE anthill_agentes_activos gauge\n" +
      `anthill_agentes_activos ${agentes}\n` +
      "# HELP anthill_espectadores_activos Cantidad de espectadores websocket conectados\n" +
      "# TYPE anthill_espectadores_activos gauge\n" +
      `anthill_espectadores_activos ${espectadores}\n` +
      "# TYPE anthill_replicas_decision gauge\n" +
      `anthill_replicas_decision ${replicasDecision}\n` +
      "# TYPE anthill_replicas_difusion gauge\n" +
      `anthill_replicas_difusion ${replicasDifusion}\n` +
      "# TYPE anthill_duracion_tick_ms gauge\n" +
      (latencia === null ? "" : `anthill_duracion_tick_ms ${latencia}\n`)
    );
  } catch (err) {
    res.status(500).send("# ERROR\n");
  }
});

app.get("/api/metricas/infraestructura", async (req, res) => {
  try {
    const [keysDecision, keysDifusion, clavesEsp] = await Promise.all([
      redis.keys("heartbeat:decision:*"),
      redis.keys("heartbeat:difusion:*"),
      redis.keys("espectadores:*"),
    ]);
    const valoresEsp = clavesEsp.length ? await redis.mget(clavesEsp) : [];
    const espectadoresPorReplica = clavesEsp.map((clave, i) => ({
      replica: clave.slice("espectadores:".length),
      espectadores: Number(valoresEsp[i]),
    })).sort((a, b) => a.replica.localeCompare(b.replica));
    res.json({
      replicasDecision: keysDecision.length,
      replicasDifusion: keysDifusion.length,
      espectadoresPorReplica,
    });
  } catch (err) {
    res.status(503).json({ error: "Metricas no disponibles" });
  }
});

// HU22: Historico de telemetria en Redis para exportacion tabular (ejes X e Y)
const CLAVE_HISTORICO = "simulacion:historico_metricas";
const MAX_HISTORICO = 3600; // Mantiene hasta 2 horas de muestras (1 c/2s)

setInterval(async () => {
  try {
    const t = await leerTelemetria();
    const muestra = {
      fecha_utc: new Date().toISOString(),
      agentes_activos: t.agentes,
      espectadores_activos: t.espectadores,
      replicas_decision: t.replicasDecision,
      replicas_difusion: t.replicasDifusion,
      latencia_tick_ms: t.latencia,
    };

    await redis.rpush(CLAVE_HISTORICO, JSON.stringify(muestra));
    await redis.ltrim(CLAVE_HISTORICO, -MAX_HISTORICO, -1);
  } catch (_) {}
}, 2000).unref();

// HU22: Endpoint para descargar historicos en formato CSV o JSON (vía terminal o navegador)
app.get("/api/metricas/reporte", async (req, res) => {
  const formato = (req.query.formato || "csv").toLowerCase();
  try {
    const raw = await redis.lrange(CLAVE_HISTORICO, 0, -1);
    const muestras = raw.map((r) => {
      try { return JSON.parse(r); } catch (_) { return null; }
    }).filter(Boolean);

    if (formato === "json") {
      res.setHeader("Content-Disposition", 'attachment; filename="reporte_escalamiento.json"');
      return res.type("json").send(JSON.stringify(muestras, null, 2));
    }

    // CSV por defecto
    const columnas = [
      "fecha_utc",
      "agentes_activos",
      "espectadores_activos",
      "replicas_decision",
      "replicas_difusion",
      "latencia_tick_ms",
    ];
    const filas = [columnas.join(",")];
    for (const m of muestras) {
      filas.push([
        m.fecha_utc,
        m.agentes_activos,
        m.espectadores_activos,
        m.replicas_decision,
        m.replicas_difusion,
        m.latencia_tick_ms ?? "",
      ].join(","));
    }

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="reporte_escalamiento.csv"');
    res.send(filas.join("\n") + "\n");
  } catch (err) {
    console.error("[Eventos] Error generando reporte de metricas:", err.message);
    res.status(500).json({ error: "Error al generar reporte de metricas" });
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
    // Solo el depredador usa la cantidad (1, 3 o 5); el tope protege al motor
    const cantidad = Math.min(5, Math.max(1, Math.floor(Number(req.body?.cantidad)) || 1));
    await redis.publish(canal, JSON.stringify({ tipo, duracionSegundos: cooldown, cantidad }));
    console.log(`[Eventos] Evento ${tipo} publicado`);
    res.json({ status: "ok", evento: tipo, cooldownSegundos: cooldown });
  } catch (err) {
    console.error(`[Eventos] Error publicando ${tipo}:`, err.message);
    res.status(500).json({ error: `Error al publicar evento ${tipo}` });
  }
});

// Tope por pedido: con el tunel publico cualquiera podria pedir millones y tumbar el motor
const MAX_SPAWN = 10000;

app.post("/api/admin/spawn", (req, res) => {
  const count = Math.min(MAX_SPAWN, Math.max(1, Number(req.body?.cantidad) || 50));
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
const server = app.listen(PORT, () => {
  console.log(`[Eventos] Servidor API escuchando en el puerto ${PORT}`);
});

let cerrando = false;
function cerrar() {
  if (cerrando) return;
  cerrando = true;
  server.close();
  redis.disconnect();
  setTimeout(() => server.closeAllConnections(), 2000).unref();
}
process.once("SIGTERM", cerrar);
process.once("SIGINT", cerrar);
