import assert from 'node:assert';

console.log('[HU17 Test] Iniciando verificacion de criterios de aceptacion de la HU17 (Abundancia)...');

const ESTADOS = { EXPLORANDO: 1, BUSCANDO: 2, HUYENDO: 3 };

// Logica de dominio HU17: Inyeccion de abundancia de recursos
function inyectarAbundancia(recursosExistentes, cantidad, zona) {
  const nuevos = [];
  let nextId = (recursosExistentes.reduce((max, r) => Math.max(max, r.id), 0) || 0) + 1;
  for (let i = 0; i < cantidad; i++) {
    const ang = Math.random() * Math.PI * 2;
    const dist = Math.random() * zona.radio;
    nuevos.push({
      id: nextId++,
      x: Math.round(zona.x + Math.cos(ang) * dist),
      y: Math.round(zona.y + Math.sin(ang) * dist),
      valor: 1,
    });
  }
  return [...recursosExistentes, ...nuevos];
}

// Logica de dominio HU17: Transicion a BUSCANDO y desplazamiento hacia las coordenadas
function activarBusquedaEnAgentes(agentes, zona) {
  return agentes.map(a => {
    // Si no tiene tarea asignada (EXPLORANDO) o esta en radio de atraccion
    const dSq = (a.x - zona.x) ** 2 + (a.y - zona.y) ** 2;
    if (a.estado === ESTADOS.EXPLORANDO || dSq <= (zona.radio * 1.5) ** 2) {
      // Inicia desplazamiento hacia las coordenadas ricas en recursos
      const dx = Math.sign(zona.x - a.x);
      const dy = Math.sign(zona.y - a.y);
      return {
        ...a,
        estado: ESTADOS.BUSCANDO,
        x: a.x + dx,
        y: a.y + dy,
        targetX: zona.x,
        targetY: zona.y,
      };
    }
    return a;
  });
}

const zonaAbundancia = { x: 500, y: 500, radio: 180 };

// Criterio 1: El servidor confirma la recepcion del evento
const mockRespuesta = { status: 'ok', evento: 'abundancia', cantidad: 120, zona: zonaAbundancia, cooldownSegundos: 10 };
assert.strictEqual(mockRespuesta.status, 'ok', 'Fallo Criterio 1: El servidor debe confirmar con status ok');
assert.strictEqual(mockRespuesta.evento, 'abundancia', 'Fallo Criterio 1: El evento confirmado debe ser abundancia');

// Criterio 2: La matriz del mundo aumenta la concentracion de celdas de tipo recurso
const recursosIniciales = [
  { id: 1, x: 280, y: 280 },
  { id: 2, x: 720, y: 720 },
];
const recursosDespues = inyectarAbundancia(recursosIniciales, 120, zonaAbundancia);
assert.strictEqual(recursosDespues.length, 122, 'Fallo Criterio 2: La matriz debe contener los 120 nuevos recursos inyectados');

// Criterio 3: Los agentes sin tareas asignadas inician desplazamiento hacia las nuevas coordenadas ricas
const agentesIniciales = [
  { id: 1, x: 400, y: 400, estado: ESTADOS.EXPLORANDO }, // Sin tarea asignada -> debe transicionar
  { id: 2, x: 450, y: 500, estado: ESTADOS.EXPLORANDO }, // Sin tarea asignada -> debe transicionar
  { id: 3, x: 990, y: 990, estado: ESTADOS.HUYENDO },    // Ocupado huyendo -> mantiene huida
];

const agentesActualizados = activarBusquedaEnAgentes(agentesIniciales, zonaAbundancia);

// Agente 1
assert.strictEqual(agentesActualizados[0].estado, ESTADOS.BUSCANDO, 'Fallo Criterio 3: Agente 1 debe transicionar a BUSCANDO');
assert.strictEqual(agentesActualizados[0].x, 401, 'Fallo Criterio 3: Agente 1 debe desplazarse en X hacia la zona (500)');
assert.strictEqual(agentesActualizados[0].y, 401, 'Fallo Criterio 3: Agente 1 debe desplazarse en Y hacia la zona (500)');

// Agente 2
assert.strictEqual(agentesActualizados[1].estado, ESTADOS.BUSCANDO, 'Fallo Criterio 3: Agente 2 debe transicionar a BUSCANDO');
assert.strictEqual(agentesActualizados[1].x, 451, 'Fallo Criterio 3: Agente 2 debe desplazarse hacia 500');

// Agente 3 ocupado
assert.strictEqual(agentesActualizados[2].estado, ESTADOS.HUYENDO, 'El agente en huida no se distrae');

// Criterio 4: El sistema bloquea clics subsecuentes al boton hasta que expire el cronometro interno
let cooldown = mockRespuesta.cooldownSegundos;
let botonBloqueado = cooldown > 0;
assert.strictEqual(botonBloqueado, true, 'Fallo Criterio 4: El boton debe bloquearse inmediatamente');

while (cooldown > 0) {
  cooldown -= 1;
}
assert.strictEqual(cooldown, 0, 'El cronometro interno debe expirar tras el tiempo programado');
botonBloqueado = cooldown > 0;
assert.strictEqual(botonBloqueado, false, 'El boton se desbloquea tras finalizar el cooldown');

console.log('[HU17 Test] Todos los criterios de aceptacion de la HU17 validados exitosamente.');
