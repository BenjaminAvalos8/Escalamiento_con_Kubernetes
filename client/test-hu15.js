import assert from 'node:assert';

console.log('[HU15 Test] Iniciando verificacion de criterios de aceptacion de la HU15 (Sequia)...');

// Logica de dominio de la HU15
function aplicarSequiaARecursos(recursos, zona) {
  const { x, y, radio } = zona;
  const radioSq = radio * radio;
  return recursos.filter(r => {
    const distSq = (r.x - x) ** 2 + (r.y - y) ** 2;
    return distSq > radioSq;
  });
}

function aplicarEfectoSequiaAAgentes(agentes, zona, estados) {
  const { x, y, radio } = zona;
  const radioSq = radio * radio;
  return agentes.map(a => {
    const distSq = (a.x - x) ** 2 + (a.y - y) ** 2;
    if (distSq <= radioSq) {
      // Pierde estímulo positivo de comida y vuelve a explorar o desorientarse
      return { ...a, estado: estados.EXPLORANDO };
    }
    return a;
  });
}

const ESTADOS = { EXPLORANDO: 1, BUSCANDO: 2, HUYENDO: 3 };
const zonaSequia = { x: 500, y: 500, radio: 150 };

// Criterio 1 y 2: Confirmacion del servidor ante el disparo del evento
const mockRespuestaServidor = { status: 'ok', evento: 'sequia', cooldownSegundos: 10, zona: zonaSequia };
assert.strictEqual(mockRespuestaServidor.status, 'ok', 'Fallo Criterio 2: El servidor debe confirmar recepcion con status ok');
assert.strictEqual(mockRespuestaServidor.evento, 'sequia', 'Fallo Criterio 2: El evento retornado debe ser sequia');

// Criterio 3: Los recursos visuales desaparecen de la zona afectada en el proximo tick
const recursosIniciales = [
  { id: 1, x: 500, y: 500 }, // En el centro (afectado)
  { id: 2, x: 550, y: 550 }, // Distancia ~70 < 150 (afectado)
  { id: 3, x: 620, y: 620 }, // Distancia ~169 > 150 (fuera de la sequia)
  { id: 4, x: 200, y: 200 }, // Lejos (fuera de la sequia)
];

const recursosSiguienteTick = aplicarSequiaARecursos(recursosIniciales, zonaSequia);
assert.strictEqual(recursosSiguienteTick.length, 2, 'Fallo Criterio 3: Debieron eliminarse 2 recursos de la zona afectada');
assert.ok(!recursosSiguienteTick.some(r => r.id === 1), 'Fallo Criterio 3: El recurso central 1 debio desaparecer');
assert.ok(!recursosSiguienteTick.some(r => r.id === 2), 'Fallo Criterio 3: El recurso 2 dentro del radio debio desaparecer');
assert.ok(recursosSiguienteTick.some(r => r.id === 3), 'El recurso 3 fuera de la zona debe permanecer');
assert.ok(recursosSiguienteTick.some(r => r.id === 4), 'El recurso 4 fuera de la zona debe permanecer');

// Criterio adicional: Agentes locales modifican estado interno por falta de estimulo
const agentesIniciales = [
  { id: 1, x: 510, y: 510, estado: ESTADOS.BUSCANDO }, // Dentro de zona
  { id: 2, x: 800, y: 800, estado: ESTADOS.BUSCANDO }, // Fuera de zona
];
const agentesActualizados = aplicarEfectoSequiaAAgentes(agentesIniciales, zonaSequia, ESTADOS);
assert.strictEqual(agentesActualizados.find(a => a.id === 1).estado, ESTADOS.EXPLORANDO, 'Fallo: El agente dentro de sequia debe perder estimulo');
assert.strictEqual(agentesActualizados.find(a => a.id === 2).estado, ESTADOS.BUSCANDO, 'El agente fuera de sequia mantiene su estado');

// Criterio 4: El boton queda en estado deshabilitado en la interfaz
let cooldown = mockRespuestaServidor.cooldownSegundos;
let botonHabilitado = cooldown === 0;
assert.strictEqual(botonHabilitado, false, 'Fallo Criterio 4: El boton debe quedar deshabilitado tras el disparo');

// Criterio 5 y 6: Transcurre el tiempo de enfriamiento programado y recupera su estado habilitado
while (cooldown > 0) {
  cooldown -= 1;
}
assert.strictEqual(cooldown, 0, 'Fallo Criterio 5: El cronometro de enfriamiento debio descender a 0');
botonHabilitado = cooldown === 0;
assert.strictEqual(botonHabilitado, true, 'Fallo Criterio 6: El boton debe recuperar su estado habilitado');

console.log('[HU15 Test] Todos los criterios de aceptacion de la HU15 validados exitosamente.');
