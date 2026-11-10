const { setTimeout: esperar } = require("node:timers/promises");
const { configurar, solicitar, leerMetricas, registrarEscalones } = require("./mediciones");

async function ejecutar() {
  const config = configurar("agentes", "500,1000,2500,5000,10000");
  const { url, signal } = config;
  const poblacion = async () => {
    const { anthill_agentes_activos: cantidad } = await leerMetricas(url);
    if (!Number.isSafeInteger(cantidad)) throw new Error("La metrica de agentes no esta disponible");
    return cantidad;
  };
  const inicial = await poblacion();
  if (config.niveles.some((nivel) => nivel < inicial)) {
    throw new Error(`Cada escalon debe ser igual o superior a la poblacion inicial (${inicial})`);
  }
  async function ajustar(objetivo, cancelacion) {
    const cantidad = objetivo - await poblacion();
    if (cantidad === 0) return;
    await solicitar(url, cantidad > 0 ? "/api/admin/spawn" : "/api/admin/purge", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cantidad: Math.abs(cantidad) }),
    });
    const limite = performance.now() + 45000;
    while (await poblacion() !== objetivo) {
      if (performance.now() >= limite) throw new Error(`El motor no llego a ${objetivo} agentes`);
      await esperar(500, undefined, { signal: cancelacion });
    }
  }

  try {
    await registrarEscalones(config, (objetivo) => ajustar(objetivo, signal));
  } catch (error) {
    if (!signal.aborted) throw error;
  } finally {
    await ajustar(inicial);
  }
}

ejecutar().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
