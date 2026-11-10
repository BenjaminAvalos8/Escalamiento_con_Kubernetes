const { writeFile } = require("node:fs/promises");

const METRICAS = [
  "anthill_agentes_activos",
  "anthill_espectadores_activos",
  "anthill_duracion_tick_ms",
  "anthill_replicas_decision",
  "anthill_replicas_difusion",
];

async function exportar() {
  const [desde, hasta, archivo = "metricas.csv"] = process.argv.slice(2);
  const start = Date.parse(desde) / 1000;
  const end = Date.parse(hasta) / 1000;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) {
    throw new Error("Uso: node load-tests/exportar-metricas.js <inicio ISO> <fin ISO> [archivo.csv]");
  }
  const url = new URL("/api/v1/query_range", process.env.PROMETHEUS_URL || "http://localhost:9090");
  url.search = new URLSearchParams({
    query: `{__name__=~"${METRICAS.join("|")}",job="anthill"}`,
    start, end, step: Math.max(5, Math.ceil((end - start) / 10000)),
  });
  const respuesta = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!respuesta.ok) throw new Error(`Prometheus respondio HTTP ${respuesta.status}`);
  const { status, data, error } = await respuesta.json();
  if (status !== "success" || data?.resultType !== "matrix") {
    throw new Error(error || "Prometheus no devolvio un historial");
  }
  const porTiempo = new Map();
  for (const { metric, values } of data.result) {
    for (const [tiempo, valor] of values) {
      if (!porTiempo.has(tiempo)) porTiempo.set(tiempo, {});
      porTiempo.get(tiempo)[metric.__name__] = Number.isFinite(Number(valor)) ? valor : "";
    }
  }
  if (!porTiempo.size) throw new Error("No hay muestras en el intervalo seleccionado");

  const filas = ["fecha_utc," + METRICAS.join(",")];
  for (const [tiempo, datos] of [...porTiempo].sort(([a], [b]) => a - b)) {
    filas.push([new Date(tiempo * 1000).toISOString(), ...METRICAS.map((m) => datos[m] ?? "")].join(","));
  }
  await writeFile(archivo, filas.join("\n") + "\n", { flag: "wx" });
  console.log(`Exportadas ${porTiempo.size} muestras a ${archivo}`);
}

exportar().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
