const { appendFile, mkdir, writeFile } = require("node:fs/promises");
const { dirname } = require("node:path");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const { setTimeout: esperar } = require("node:timers/promises");

function configurar(nombre, nivelesBase) {
  const [destino, nivelesTexto, segundosTexto, archivo] = process.argv.slice(2);
  const url = new URL(destino || process.env.TARGET_URL || "http://localhost:30080");
  const niveles = (nivelesTexto ?? nivelesBase).split(",").map(Number);
  const segundos = Number(segundosTexto ?? 180);
  if (niveles.some((n) => !Number.isSafeInteger(n) || n < 1) ||
      !Number.isSafeInteger(segundos) || segundos < 1) {
    throw new Error("Indica niveles de carga y una duracion en segundos con enteros positivos");
  }
  const cancelacion = new AbortController();
  for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => cancelacion.abort());
  return {
    url, niveles, segundos,
    archivo: archivo ?? `load-tests/resultados/${nombre}-${Date.now()}.jsonl`,
    signal: cancelacion.signal,
  };
}

async function solicitar(url, ruta, opciones) {
  let respuesta;
  try {
    respuesta = await fetch(new URL(ruta, url), {
      signal: AbortSignal.timeout(15000),
      ...opciones,
    });
  } catch (error) {
    throw new Error(`${ruta}: ${error.message}`, { cause: error });
  }
  if (!respuesta.ok) throw new Error(`${ruta} devolvio HTTP ${respuesta.status}`);
  return respuesta;
}

async function leerMetricas(url) {
  const respuesta = await solicitar(url, "/metrics");
  const lineas = (await respuesta.text()).split("\n");
  return Object.fromEntries(lineas.filter((l) => l.startsWith("anthill_")).map((l) => {
    const [nombre, valor] = l.trim().split(/\s+/);
    return [nombre, Number(valor)];
  }));
}

async function registrarEscalones(config, preparar, telemetria = () => ({})) {
  const { url, niveles, segundos, archivo, signal } = config;
  await mkdir(dirname(archivo), { recursive: true });
  await writeFile(archivo, "", { flag: "wx" });
  console.log(`Resultados en ${archivo}`);

  for (const objetivo of niveles) {
    signal.throwIfAborted();
    await preparar(objetivo);
    const fin = performance.now() + segundos * 1000;
    do {
      const datos = { fecha_utc: new Date().toISOString(), objetivo, ...await leerMetricas(url), ...telemetria() };
      if (process.env.MEDIR_CPU === "1") {
        const { stdout } = await promisify(execFile)("kubectl", ["top", "pods", "--no-headers"], { timeout: 5000 });
        datos.cpu_y_memoria_pods = stdout.trim().split(/\r?\n/);
      }
      await appendFile(archivo, JSON.stringify(datos) + "\n");
      console.log(JSON.stringify(datos));
      const restante = Math.min(15000, fin - performance.now());
      if (restante > 0) await esperar(restante, undefined, { signal });
    } while (performance.now() < fin);
  }
}

module.exports = { configurar, solicitar, leerMetricas, registrarEscalones };
