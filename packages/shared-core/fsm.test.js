// Ejecutar con: node packages/shared-core/fsm.test.js
const assert = require("node:assert");
const { ESTADOS: E, decidir } = require("./fsm");

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

// Mismo azar, mismo resultado: base de la semilla de la HU19
const azar = () => { let s = 0; return () => (s = (s * 7 + 3) % 11) / 11; };
assert.deepEqual(decidir(base, { nido }, azar()), decidir(base, { nido }, azar()));

// Nunca sale del mapa
assert.equal(decidir({ ...base, x: 0, y: 0, vx: -1, vy: -1 }, { nido }, () => 0).x, 0);

console.log("FSM OK");
