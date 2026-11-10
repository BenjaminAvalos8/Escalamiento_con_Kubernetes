// Ejecutar con: node packages/shared-core/fsm.test.js
const assert = require("node:assert");
const { ESTADOS: E, decidir } = require("./fsm");
const { crearAzar } = require("./azar");
const { moverYCapturar } = require("../../services/motor/src/depredadores");

const nido = { x: 500, y: 500, radio: 20 };
const base = { id: 1, x: 100, y: 100, est: E.EXPLORANDO, e: 100, c: false };

// Depredador a <= 5 celdas: huye alejandose, a > 5 lo ignora
let a = decidir(base, { depredadores: [{ x: 103, y: 100 }], nido });
assert.equal(a.est, E.HUYENDO);
assert.equal(a.x, 99);
assert.notEqual(decidir(base, { depredadores: [{ x: 106, y: 100 }], nido }).est, E.HUYENDO);

// Huyendo ignora la comida aunque la pise
a = decidir(base, { depredadores: [{ x: 101, y: 100 }], recursos: [{ id: 7, x: 99, y: 101 }], nido });
assert.equal(a.recoge, undefined);

// Ve comida: va hacia ella, al pisarla recoge, +25 de energia y vuelve al nido
a = decidir(base, { recursos: [{ id: 7, x: 110, y: 100 }], nido });
assert.equal(a.est, E.BUSCANDO);
assert.equal(a.x, 101);
a = decidir({ ...base, x: 109, e: 50 }, { recursos: [{ id: 7, x: 110, y: 100 }], nido });
assert.equal(a.recoge, 7);
assert.equal(a.est, E.VOLVIENDO);
assert.equal(a.e, 74.9);

// Energia baja sin comida: busca; critica ve 3 celdas mas; en 0 no muere
assert.equal(decidir({ ...base, e: 60 }, { nido }).est, E.BUSCANDO);
assert.equal(decidir({ ...base, e: 70 }, { recursos: [{ id: 7, x: 118, y: 100 }], nido }).est, E.EXPLORANDO);
assert.equal(decidir({ ...base, e: 20 }, { recursos: [{ id: 7, x: 118, y: 100 }], nido }).x, 101);
assert.equal(decidir({ ...base, e: 0 }, { nido }).e, 0);

// Vuelve al nido, entrega y recarga al 100 %
a = decidir({ ...base, x: 485, y: 500, est: E.VOLVIENDO, e: 40, c: true }, { nido });
assert.equal(a.entrega, true);
assert.equal(a.e, 100);
assert.equal(a.est, E.EXPLORANDO);
assert.equal(a.c, false);

// Si huia cargando comida, retoma el regreso; sin carga, explora
assert.equal(decidir({ ...base, est: E.HUYENDO, c: true }, { nido }).est, E.VOLVIENDO);
assert.equal(decidir({ ...base, est: E.HUYENDO }, { nido }).est, E.EXPLORANDO);

// Mismo azar, mismo resultado en la FSM, incluida la semilla cero.
const muestra = (seed) => Array.from({ length: 16 }, crearAzar(seed));
assert.deepEqual(muestra(42), muestra(42));
assert.notDeepEqual(muestra(0), muestra(42));
assert.deepEqual(decidir(base, { nido }, crearAzar(42)), decidir(base, { nido }, crearAzar(42)));

// Feromona y memoria llevan a una fuente fuera de la vista; al agotarse se olvida.
const fuente = { id: 7, x: 130, y: 100 };
const rastro = { "100,101": { id: fuente.id, x: 101, y: 101 } };
a = decidir(base, { nido, recursos: [fuente], rastro });
assert.equal(a.fuenteId, fuente.id);
assert.equal(a.y, 101);
assert.equal(decidir(a, { nido, recursos: [fuente], rastro }).y, 101);
assert.equal(decidir(a, { nido }).fuenteId, undefined);
assert.equal(decidir({ ...base, x: 485, y: 500, est: E.VOLVIENDO, fuenteId: 7 }, { nido }).fuenteId, 7);

// La exploradora detecta la sequia; otra hormiga sigue el aviso al llegar a esa celda.
const zona = { id: "sequia-1", x: 110, y: 100, radio: 9 };
a = decidir(base, { nido, sequias: [zona] });
assert.equal(a.avisoSequia, zona.id);
assert.equal(a.x, 99);
const advertida = decidir({ ...base, est: E.BUSCANDO }, { nido, sequias: [zona], avisosSequia: { "100,100": zona.id } });
assert.equal(advertida.est, E.HUYENDO);
assert.equal(advertida.x, 99);

// El depredador da un paso, captura a una celda y respeta el nido.
const dep = { x: 103, y: 100 };
assert.equal(moverYCapturar([dep], [base], nido).capturados.size, 0);
assert.equal(dep.x, 102);
assert.ok(moverYCapturar([dep], [base], nido).capturados.has(base.id));
assert.equal(moverYCapturar([{ x: 479, y: 500 }], [{ ...base, x: 480, y: 500 }], nido).capturados.size, 0);
const defensoras = Array.from({ length: 6 }, (_, id) => ({ ...base, id }));
assert.equal(moverYCapturar([{ x: 102, y: 100 }], defensoras, nido).derrotados.length, 1);

// En un tick sin paso no se mueve, pero la energia sigue bajando
a = decidir(base, { recursos: [{ id: 7, x: 110, y: 100 }], nido }, Math.random, false);
assert.equal(a.x, 100);
assert.equal(a.e, 99.9);

// Nunca sale del mapa
assert.equal(decidir({ ...base, x: 0, y: 0, vx: -1, vy: -1 }, { nido }, () => 0).x, 0);

console.log("FSM OK");
