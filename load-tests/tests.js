// ==============================================================================
// Scripts de carga y pruebas de estrés
// ==============================================================================
// 1. stress-difusion.js (HU11):
//    Inyección de espectadores WebSocket concurrentes para probar el
//    autoescalado del microservicio de difusión con HPA.
//    Uso: node load-tests/stress-difusion.js [URL] [CONCURRENCIA]
//
// 2. stress-agentes.js (HU20):
//    Inyección masiva de agentes simulados para saturar el hilo serial
//    del motor del mundo (Ley de Amdahl).
//    Uso: node load-tests/stress-agentes.js [URL] [BATCH_SIZE] [TARGET_TOTAL]
// ==============================================================================

module.exports = {
  stressDifusion: "./stress-difusion.js",
  stressAgentes: "./stress-agentes.js",
};

