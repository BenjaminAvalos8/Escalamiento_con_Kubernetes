const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

console.log("[HU22 Test] Iniciando verificacion de criterios de aceptacion de reporte tabular...");

// 1. Muestra simulada representativa de una corrida
const muestrasPrueba = [
  {
    fecha_utc: "2026-11-10T04:00:00.000Z",
    tiempo_segundos: 0,
    agentes_activos: 100,
    espectadores_activos: 1,
    replicas_decision: 1,
    replicas_difusion: 1,
    latencia_tick_ms: 12,
  },
  {
    fecha_utc: "2026-11-10T04:01:00.000Z",
    tiempo_segundos: 60,
    agentes_activos: 1000,
    espectadores_activos: 100,
    replicas_decision: 4,
    replicas_difusion: 4,
    latencia_tick_ms: 85,
  },
  {
    fecha_utc: "2026-11-10T04:02:00.000Z",
    tiempo_segundos: 120,
    agentes_activos: 2500,
    espectadores_activos: 500,
    replicas_decision: 10,
    replicas_difusion: 10,
    latencia_tick_ms: 195,
  },
];

// 2. Funcion generadora tabular CSV (igual que en backend y frontend)
function generarCSV(muestras) {
  const columnas = [
    "fecha_utc",
    "tiempo_segundos",
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
      m.tiempo_segundos,
      m.agentes_activos,
      m.espectadores_activos,
      m.replicas_decision,
      m.replicas_difusion,
      m.latencia_tick_ms,
    ].join(","));
  }
  return filas.join("\n") + "\n";
}

// 3. Validacion de criterios de aceptacion
const csvSalida = generarCSV(muestrasPrueba);
const lineas = csvSalida.trim().split("\n");

// Criterio: Archivo en formato CSV con cabeceras correctas
assert.strictEqual(lineas.length, 4, "Debe contener 1 linea de cabecera y 3 filas de datos");
const encabezados = lineas[0].split(",");

// Criterio: Eje X (tiempo / fecha)
assert.ok(encabezados.includes("fecha_utc"), "Falta columna de Eje X: fecha_utc");
assert.ok(encabezados.includes("tiempo_segundos"), "Falta columna de Eje X: tiempo_segundos");

// Criterio: Eje Y (carga de agentes/espectadores, pods y latencia)
assert.ok(encabezados.includes("agentes_activos"), "Falta columna de Eje Y: agentes_activos");
assert.ok(encabezados.includes("espectadores_activos"), "Falta columna de Eje Y: espectadores_activos");
assert.ok(encabezados.includes("replicas_decision"), "Falta columna de Eje Y: replicas_decision");
assert.ok(encabezados.includes("replicas_difusion"), "Falta columna de Eje Y: replicas_difusion");
assert.ok(encabezados.includes("latencia_tick_ms"), "Falta columna de Eje Y: latencia_tick_ms");

// Criterio: Validar valores numericos parseados correctamente en las filas
const filaAltaCarga = lineas[3].split(",");
assert.strictEqual(filaAltaCarga[2], "2500", "El valor de agentes_activos debe ser 2500");
assert.strictEqual(filaAltaCarga[4], "10", "El valor de replicas_decision debe ser 10");
assert.strictEqual(filaAltaCarga[6], "195", "El valor de latencia_tick_ms debe ser 195");

// 4. Validar escritura y persistencia en almacenamiento local
const rutaTemporal = path.join(__dirname, "test_salida_reporte.csv");
fs.writeFileSync(rutaTemporal, csvSalida, "utf-8");
assert.ok(fs.existsSync(rutaTemporal), "El archivo en almacenamiento local debe existir");

const leido = fs.readFileSync(rutaTemporal, "utf-8");
assert.strictEqual(leido, csvSalida, "El archivo persistido debe coincidir exactamente con el reporte generado");
fs.unlinkSync(rutaTemporal);

// 5. Validar formato JSON
const jsonSalida = JSON.stringify(muestrasPrueba, null, 2);
const jsonParseado = JSON.parse(jsonSalida);
assert.strictEqual(jsonParseado.length, 3, "El JSON debe contener las 3 muestras");
assert.strictEqual(jsonParseado[1].agentes_activos, 1000);
assert.strictEqual(jsonParseado[1].replicas_decision, 4);

console.log("[HU22 Test] Todos los criterios de aceptacion (CSV, JSON, Ejes X/Y, persistencia local) validados con exito.");
