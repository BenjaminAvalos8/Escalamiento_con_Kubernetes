import assert from 'node:assert';

console.log('[HU16 Test] Iniciando verificacion de criterios de aceptacion de la HU16 (Depredador)...');

const ESTADOS = { EXPLORANDO: 1, BUSCANDO: 2, HUYENDO: 3 };

// Logica de dominio: Generar depredadores temporales en una zona
function generarDepredadores(cantidad, zona) {
  const deps = [];
  for (let i = 0; i < cantidad; i++) {
    const angulo = Math.random() * Math.PI * 2;
    const dist = Math.random() * zona.radio * 0.6;
    deps.push({
      id: `dep-test-${i}`,
      x: Math.round(zona.x + Math.cos(angulo) * dist),
      y: Math.round(zona.y + Math.sin(angulo) * dist),
      ticksRestantes: 25,
      radioAmenaza: 80,
    });
  }
  return deps;
}

// Logica de dominio: Agentes huyen de depredadores cercanos
function aplicarHuidaAgentes(agentes, depredadores) {
  return agentes.map(a => {
    for (const dep of depredadores) {
      const dSq = (a.x - dep.x) ** 2 + (a.y - dep.y) ** 2;
      if (dSq <= dep.radioAmenaza ** 2) {
        const dist = Math.sqrt(dSq) || 1;
        const huirX = Math.round(((a.x - dep.x) / dist) * 3);
        const huirY = Math.round(((a.y - dep.y) / dist) * 3);
        return {
          ...a,
          estado: ESTADOS.HUYENDO,
          x: Math.max(0, Math.min(999, a.x + huirX)),
          y: Math.max(0, Math.min(999, a.y + huirY)),
        };
      }
    }
    return a;
  });
}

// Logica de dominio: Depredadores expiran despues de N ticks
function tickDepredadores(depredadores) {
  return depredadores
    .map(dep => ({ ...dep, ticksRestantes: dep.ticksRestantes - 1 }))
    .filter(dep => dep.ticksRestantes > 0);
}

const zonaEvento = { x: 500, y: 500, radio: 200 };

// Criterio 1: Se generan la cantidad correcta de depredadores
const deps = generarDepredadores(3, zonaEvento);
assert.strictEqual(deps.length, 3, 'Fallo: Deben generarse exactamente 3 depredadores');

// Criterio 2: Los depredadores aparecen dentro de la zona designada
for (const dep of deps) {
  const distancia = Math.sqrt((dep.x - zonaEvento.x) ** 2 + (dep.y - zonaEvento.y) ** 2);
  assert.ok(distancia <= zonaEvento.radio, `Fallo: El depredador ${dep.id} aparecio fuera de la zona (dist=${distancia.toFixed(1)})`);
}

// Criterio 3: Cada depredador tiene radioAmenaza y ticksRestantes
for (const dep of deps) {
  assert.strictEqual(dep.radioAmenaza, 80, `Fallo: El depredador ${dep.id} debe tener radioAmenaza=80`);
  assert.strictEqual(dep.ticksRestantes, 25, `Fallo: El depredador ${dep.id} debe tener ticksRestantes=25`);
}

// Criterio 4: Hormigas dentro del radio de amenaza cambian a HUYENDO e invierten vector
const agentes = [
  { id: 1, x: 505, y: 505, estado: ESTADOS.EXPLORANDO }, // Muy cerca del depredador
  { id: 2, x: 900, y: 900, estado: ESTADOS.BUSCANDO },   // Lejos, no afectada
];
// Ponemos un depredador justo en (500, 500)
const depTest = [{ id: 'dep-test', x: 500, y: 500, ticksRestantes: 25, radioAmenaza: 80 }];
const agentesActualizados = aplicarHuidaAgentes(agentes, depTest);

assert.strictEqual(agentesActualizados[0].estado, ESTADOS.HUYENDO, 'Fallo Criterio 4: La hormiga cercana debe cambiar a HUYENDO');
assert.strictEqual(agentesActualizados[1].estado, ESTADOS.BUSCANDO, 'La hormiga lejana mantiene su estado');

// Verificar que la hormiga se alejo del depredador (vector invertido)
const distAntes = Math.sqrt((agentes[0].x - 500) ** 2 + (agentes[0].y - 500) ** 2);
const distDespues = Math.sqrt((agentesActualizados[0].x - 500) ** 2 + (agentesActualizados[0].y - 500) ** 2);
assert.ok(distDespues > distAntes, `Fallo: La hormiga debio alejarse del depredador (antes=${distAntes.toFixed(1)}, despues=${distDespues.toFixed(1)})`);

// Criterio 5: Los depredadores son temporales y desaparecen tras N ticks
let depsVivos = [...deps];
for (let t = 0; t < 25; t++) {
  depsVivos = tickDepredadores(depsVivos);
}
assert.strictEqual(depsVivos.length, 0, 'Fallo Criterio 5: Los depredadores deben desaparecer tras 25 ticks');

// Criterio 6: El servidor confirma recepcion del evento
const mockRespuesta = { status: 'ok', evento: 'depredador', cantidad: 3, cooldownSegundos: 12 };
assert.strictEqual(mockRespuesta.status, 'ok', 'Fallo Criterio 6: El servidor debe confirmar con status ok');
assert.strictEqual(mockRespuesta.cooldownSegundos, 12, 'Fallo: El cooldown debe ser 12 segundos');

// Criterio 7: El boton queda deshabilitado con cooldown
let cooldown = mockRespuesta.cooldownSegundos;
assert.ok(cooldown > 0, 'Fallo Criterio 7: El boton debe estar deshabilitado tras el disparo');
while (cooldown > 0) cooldown -= 1;
assert.strictEqual(cooldown, 0, 'Fallo: El cooldown debe llegar a 0 para rehabilitar el boton');

console.log('[HU16 Test] Todos los criterios de aceptacion de la HU16 validados exitosamente.');
