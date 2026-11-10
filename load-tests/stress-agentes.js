/**
 * ==============================================================================
 * HU20: Inyección Masiva de Agentes Simulados (Prueba de Estrés del Motor)
 * ==============================================================================
 * Objetivo:
 *   Llevar al motor de la simulación hasta su cuello de botella serial monohilo
 *   (Ley de Amdahl), demostrando la saturación de CPU del pod de motor (>90%)
 *   y la degradación de TPS/latencia, mientras los workers de decisión escalan
 *   sin colapsar.
 *
 * Uso:
 *   node load-tests/stress-agentes.js [URL] [BATCH_SIZE] [TARGET_TOTAL] [INTERVALO_MS]
 *
 * Ejemplos:
 *   node load-tests/stress-agentes.js
 *   node load-tests/stress-agentes.js http://localhost:30080 500 5000 3000
 *   node load-tests/stress-agentes.js http://localhost:8080 200 2000 2000
 * ==============================================================================
 */

const TARGET_URL = (process.env.TARGET_URL || process.argv[2] || "http://localhost:30080").replace(/\/$/, "");
const BATCH_SIZE = Math.max(1, parseInt(process.env.BATCH_SIZE || process.argv[3] || "500", 10));
const TARGET_TOTAL = Math.max(BATCH_SIZE, parseInt(process.env.TARGET_TOTAL || process.argv[4] || "6000", 10));
const INTERVALO_MS = Math.max(500, parseInt(process.env.INTERVALO_MS || process.argv[5] || "3000", 10));

let agentesInyectadosTotal = 0;
let ejecucionActiva = true;

console.log("===============================================================================");
console.log(" [HU20] EXPERIMENTO DE ESTRÉS: INYECCIÓN MASIVA DE AGENTES (LEY DE AMDAHL)");
console.log("===============================================================================");
console.log(` Destino objetivo:       ${TARGET_URL}`);
console.log(` Agentes por tanda:      +${BATCH_SIZE}`);
console.log(` Meta de agentes:        ${TARGET_TOTAL}`);
console.log(` Cadencia de inyección:  cada ${INTERVALO_MS / 1000}s`);
console.log("-------------------------------------------------------------------------------");
console.log(" Hipótesis de Amdahl a verificar:");
console.log("  1. El pod 'motor-deployment' saturará su CPU (>90%) por su ciclo monohilo.");
console.log("  2. La cadencia (TPS) caerá en el cliente y la latencia del tick subirá (>150ms).");
console.log("  3. Los pods 'decision-deployment' se mantendrán estables gracias al HPA.");
console.log("-------------------------------------------------------------------------------");
console.log(" Comandos útiles de monitoreo durante esta prueba (en otra terminal):");
console.log("   kubectl top pods -l app=motor");
console.log("   kubectl top pods -l app=decision");
console.log("   kubectl get hpa");
console.log("===============================================================================\n");

async function consultarMetricas() {
  try {
    const res = await fetch(`${TARGET_URL}/metrics`);
    if (!res.ok) return { agentesActivos: null };
    const texto = await res.text();
    const match = texto.match(/anthill_agentes_activos\s+(\d+)/);
    return {
      agentesActivos: match ? parseInt(match[1], 10) : null,
    };
  } catch (_) {
    return { agentesActivos: null };
  }
}

async function inyectarLote(cantidad) {
  const t0 = performance.now();
  try {
    const res = await fetch(`${TARGET_URL}/api/admin/spawn`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cantidad }),
    });

    const latenciaApiMs = Math.round(performance.now() - t0);

    if (!res.ok) {
      console.warn(`[WARN] Endpoint de spawn respondió HTTP ${res.status}`);
      return false;
    }

    agentesInyectadosTotal += cantidad;
    return { ok: true, latenciaApiMs };
  } catch (err) {
    console.error(`[ERROR] Falla al conectar con ${TARGET_URL}/api/admin/spawn:`, err.message);
    return false;
  }
}

async function purgarLote(cantidad) {
  try {
    await fetch(`${TARGET_URL}/api/admin/purge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cantidad }),
    });
  } catch (_) {}
}

async function cicloPrueba() {
  const inicial = await consultarMetricas();
  const baseAgentes = inicial.agentesActivos ?? 100;
  console.log(`[Inicio] Agentes activos detectados actualmente: ${baseAgentes}\n`);

  let loteNumero = 1;

  const timer = setInterval(async () => {
    if (!ejecucionActiva) {
      clearInterval(timer);
      return;
    }

    const { agentesActivos } = await consultarMetricas();
    const totalActual = agentesActivos ?? (baseAgentes + agentesInyectadosTotal);

    if (totalActual >= TARGET_TOTAL) {
      console.log("\n===============================================================================");
      console.log(`[HU20] Meta alcanzada: ${totalActual} agentes activos en el ecosistema.`);
      console.log("El motor debe estar operando en su punto de máxima saturación.");
      console.log("Observa en tu dashboard web (alerta visual HU12) y ejecuta:");
      console.log("   kubectl top pods");
      console.log("Presiona Ctrl + C cuando desees finalizar la prueba.");
      console.log("===============================================================================\n");
      clearInterval(timer);
      return;
    }

    const res = await inyectarLote(BATCH_SIZE);
    if (res && res.ok) {
      const timestamp = new Date().toLocaleTimeString();
      const indicadorSaturacion = totalActual > 1500 ? " [POSIBLE ESTRANGULAMIENTO]" : "";
      console.log(
        `[${timestamp}] Lote #${loteNumero++}: Inyectados +${BATCH_SIZE} | Total en mundo: ~${totalActual + BATCH_SIZE} agentes | Latencia API: ${res.latenciaApiMs}ms${indicadorSaturacion}`
      );
    }
  }, INTERVALO_MS);
}

async function detenerPrueba() {
  if (!ejecucionActiva) return;
  ejecucionActiva = false;

  console.log("\n\n[HU20] Deteniendo experimento de carga...");
  console.log(`Total acumulado inyectado por este script: +${agentesInyectadosTotal} agentes.`);

  if (agentesInyectadosTotal > 0) {
    console.log("Purgando agentes inyectados para restaurar el estado del motor...");
    await purgarLote(agentesInyectadosTotal);
    console.log("Se envió solicitud de purga al motor.");
  }

  console.log("[HU20] Prueba finalizada exitosamente.");
  process.exit(0);
}

process.on("SIGINT", detenerPrueba);
process.on("SIGTERM", detenerPrueba);

cicloPrueba();

