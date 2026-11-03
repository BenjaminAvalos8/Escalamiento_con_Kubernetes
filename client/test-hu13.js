import assert from 'node:assert';

// Logica pura de decision y agregacion de HU13
function determinarModoRenderizado(cantidadAgentes, umbral) {
  return cantidadAgentes > umbral ? 'AGREGADO_CALOR' : 'DETALLADO_SPRITES';
}

function calcularDensidadCeldas(agentes, rangoVisible) {
  const celdas = new Map();
  for (const a of agentes) {
    const cx = Math.round(a.x);
    const cy = Math.round(a.y);
    if (
      cx >= rangoVisible.minX &&
      cx <= rangoVisible.maxX &&
      cy >= rangoVisible.minY &&
      cy <= rangoVisible.maxY
    ) {
      const key = `${cx},${cy}`;
      celdas.set(key, (celdas.get(key) || 0) + 1);
    }
  }
  return celdas;
}

function obtenerColorTermico(densidad) {
  if (densidad >= 10) return 'rgba(217, 70, 239, 0.90)'; // Magenta / punto critico
  if (densidad >= 5)  return 'rgba(239, 68, 68, 0.85)';  // Rojo
  if (densidad >= 2)  return 'rgba(249, 115, 22, 0.80)'; // Naranja
  return 'rgba(234, 179, 8, 0.75)';                   // Amarillo
}

console.log('[HU13 Test] Iniciando verificacion de criterios de aceptacion...');

const UMBRAL = 300;

// Criterio 1: Por debajo del umbral -> modo detallado
assert.strictEqual(
  determinarModoRenderizado(100, UMBRAL),
  'DETALLADO_SPRITES',
  'Fallo: 100 agentes debe estar en DETALLADO_SPRITES'
);

// Criterio 2: Supera el umbral -> modo agregado (mapa de calor)
assert.strictEqual(
  determinarModoRenderizado(301, UMBRAL),
  'AGREGADO_CALOR',
  'Fallo: 301 agentes debe pasar a AGREGADO_CALOR'
);

assert.strictEqual(
  determinarModoRenderizado(500, UMBRAL),
  'AGREGADO_CALOR',
  'Fallo: 500 agentes debe permanecer en AGREGADO_CALOR'
);

// Criterio 3: Vuelve a caer por debajo del umbral -> recupera detallado
assert.strictEqual(
  determinarModoRenderizado(250, UMBRAL),
  'DETALLADO_SPRITES',
  'Fallo: al purgar a 250 agentes debe regresar a DETALLADO_SPRITES'
);

// Criterio 4: Agregacion de bloques y mapas de calor
const agentesMuestra = [
  { x: 50, y: 50 },
  { x: 50, y: 50 },
  { x: 50, y: 50 },
  { x: 50, y: 50 },
  { x: 50, y: 50 }, // 5 agentes en (50,50)
  { x: 60, y: 60 }, // 1 agente en (60,60)
  { x: 999, y: 999 } // Fuera de viewport
];

const celdas = calcularDensidadCeldas(agentesMuestra, { minX: 0, maxX: 100, minY: 0, maxY: 100 });
assert.strictEqual(celdas.get('50,50'), 5, 'Fallo en conteo de celda concentrada');
assert.strictEqual(celdas.get('60,60'), 1, 'Fallo en conteo de celda unitaria');
assert.strictEqual(celdas.has('999,999'), false, 'Culling fallido: celda fuera del viewport');

assert.strictEqual(obtenerColorTermico(celdas.get('50,50')), 'rgba(239, 68, 68, 0.85)');
assert.strictEqual(obtenerColorTermico(celdas.get('60,60')), 'rgba(234, 179, 8, 0.75)');

console.log('[HU13 Test] Todos los criterios de aceptacion validados exitosamente.');
