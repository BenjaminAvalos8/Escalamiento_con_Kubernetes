const { writeFile } = require("node:fs/promises");

/**
 * HU22: Exportar un reporte de los resultados de cada prueba de escalamiento
 * 
 * Uso desde terminal:
 *   1) Modo directo (API clúster / Gateway):
 *      node load-tests/exportar-metricas.js [reporte.csv|reporte.json]
 * 
 *   2) Modo Prometheus (rango temporal ISO):
 *      node load-tests/exportar-metricas.js <inicio ISO> <fin ISO> [reporte.csv]
 */

const METRICAS = [
  "anthill_agentes_activos",
  "anthill_espectadores_activos",
  "anthill_duracion_tick_ms",
  "anthill_replicas_decision",
  "anthill_replicas_difusion",
];

async function exportarDesdePrometheus(start, end, archivo) {
  const url = new URL("/api/v1/query_range", process.env.PROMETHEUS_URL || "http://localhost:9090");
  url.search = new URLSearchParams({
    query: `{__name__=~"${METRICAS.join("|")}",job="anthill"}`,
    start,
    end,
    step: Math.max(5, Math.ceil((end - start) / 10000)),
  });

  const respuesta = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!respuesta.ok) throw new Error(`Prometheus respondio HTTP ${respuesta.status}`);

  const { status, data, error } = await respuesta.json();
  if (status !== "success" || data?.resultType !== "matrix") {
    throw new Error(error || "Prometheus no devolvio un historial valido");
  }

  const porTiempo = new Map();
  for (const { metric, values } of data.result) {
    for (const [tiempo, valor] of values) {
      if (!porTiempo.has(tiempo)) porTiempo.set(tiempo, {});
      porTiempo.get(tiempo)[metric.__name__] = Number.isFinite(Number(valor)) ? valor : "";
    }
  }

  if (!porTiempo.size) throw new Error("No hay muestras en el intervalo seleccionado");

  const esJson = archivo.endsWith(".json");
  let contenido = "";

  if (esJson) {
    const lista = [];
    for (const [tiempo, datos] of [...porTiempo].sort(([a], [b]) => a - b)) {
      lista.push({
        fecha_utc: new Date(tiempo * 1000).toISOString(),
        ...datos,
      });
    }
    contenido = JSON.stringify(lista, null, 2);
  } else {
    const filas = ["fecha_utc," + METRICAS.join(",")];
    for (const [tiempo, datos] of [...porTiempo].sort(([a], [b]) => a - b)) {
      filas.push([new Date(tiempo * 1000).toISOString(), ...METRICAS.map((m) => datos[m] ?? "")].join(","));
    }
    contenido = filas.join("\n") + "\n";
  }

  await writeFile(archivo, contenido, { flag: "w" });
  console.log(`[HU22] Exportadas ${porTiempo.size} muestras desde Prometheus a ${archivo}`);
}

async function exportarDesdeCluster(archivo) {
  const candidatos = process.env.TARGET_URL
    ? [process.env.TARGET_URL]
    : ["http://localhost:8080", "http://localhost:3000", "http://localhost:30080"];
  const esJson = archivo.endsWith(".json");
  const formato = esJson ? "json" : "csv";

  let respuesta;
  let exitoUrl = null;

  for (const base of candidatos) {
    try {
      const url = new URL(`/api/metricas/reporte?formato=${formato}`, base);
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        respuesta = res;
        exitoUrl = url;
        break;
      }
    } catch (_) {
      // probar siguiente candidato
    }
  }

  if (!respuesta || !exitoUrl) {
    throw new Error(
      `No se pudo conectar al endpoint de métricas en ninguno de los destinos: ${candidatos.join(", ")}. Verifique que el servicio esté corriendo o defina TARGET_URL.`
    );
  }

  console.log(`[HU22] Obteniendo reporte histórico desde: ${exitoUrl.toString()}...`);
  const contenido = await respuesta.text();
  await writeFile(archivo, contenido, { flag: "w" });

  const lineas = contenido.trim().split("\n");
  const total = esJson ? JSON.parse(contenido).length : Math.max(0, lineas.length - 1);
  console.log(`[HU22] Archivo guardado localmente: ${archivo}`);
  console.log(`[HU22] Total de muestras tabulares exportadas: ${total}`);
  console.log(`[HU22] Ejes incluidos para graficar: Eje X (fecha_utc / tiempo) | Eje Y (agentes, espectadores, réplicas, latencia)`);
}

async function exportar() {
  const args = process.argv.slice(2);

  // Si se pasaron dos fechas ISO al inicio
  if (args.length >= 2 && !Number.isNaN(Date.parse(args[0])) && !Number.isNaN(Date.parse(args[1]))) {
    const start = Date.parse(args[0]) / 1000;
    const end = Date.parse(args[1]) / 1000;
    const archivo = args[2] || "metricas.csv";
    if (start > end) throw new Error("La fecha de inicio debe ser anterior a la de fin");
    return exportarDesdePrometheus(start, end, archivo);
  }

  // Modo directo / sesión actual: exportar el archivo especificado o "reporte_escalamiento.csv"
  const archivo = args[0] || "reporte_escalamiento.csv";
  return exportarDesdeCluster(archivo);
}

exportar().catch((error) => {
  console.error(`[HU22 Error] ${error.message}`);
  process.exitCode = 1;
});
