// Maquina de estados de la hormiga segun la matriz de interacciones.
// Funcion pura: el azar entra por `rand` para que la corrida sea reproducible.
const ESTADOS = { EXPLORANDO: 1, BUSCANDO: 2, HUYENDO: 3, VOLVIENDO: 4 };

const ANCHO = 1000, ALTO = 1000;
const RADIO_PANICO = 5;
const RADIO_VISION = 15;
const EXTRA_VISION_CRITICA = 3;
const ENERGIA_BUSCAR = 60;
const ENERGIA_CRITICA = 20;
const DESGASTE_POR_TICK = 0.1;
const ENERGIA_POR_COMIDA = 25;
const INERCIA = 0.8;

const limitar = (v, max) => Math.max(0, Math.min(max - 1, v));
const azarPaso = (rand) => Math.floor(rand() * 3) - 1;

// percepcion: { depredadores: [{x,y}], recursos: [{id,x,y}], nido: {x,y,radio} }
// Devuelve el agente nuevo. `recoge` y `entrega` avisan al motor, que es la autoridad del mundo.
function decidir(agente, { depredadores = [], recursos = [], nido }, rand = Math.random) {
  const a = { ...agente, e: Math.max(0, Math.round((agente.e - DESGASTE_POR_TICK) * 10) / 10) };
  delete a.recoge;
  delete a.entrega;

  const mover = (dx, dy) => {
    a.x = limitar(a.x + dx, ANCHO);
    a.y = limitar(a.y + dy, ALTO);
    return a;
  };

  const amenaza = depredadores.find((d) => Math.hypot(a.x - d.x, a.y - d.y) <= RADIO_PANICO);
  if (amenaza) {
    a.est = ESTADOS.HUYENDO;
    return mover(a.x >= amenaza.x ? 1 : -1, a.y >= amenaza.y ? 1 : -1);
  }
  if (a.est === ESTADOS.HUYENDO) a.est = a.c ? ESTADOS.VOLVIENDO : ESTADOS.EXPLORANDO;

  if (a.est === ESTADOS.VOLVIENDO) {
    mover(Math.sign(nido.x - a.x), Math.sign(nido.y - a.y));
    if (Math.hypot(a.x - nido.x, a.y - nido.y) <= nido.radio) {
      a.c = false;
      a.e = 100;
      a.entrega = true;
      a.est = ESTADOS.EXPLORANDO;
    }
    return a;
  }

  const vision = RADIO_VISION + (a.e <= ENERGIA_CRITICA ? EXTRA_VISION_CRITICA : 0);
  let comida = null;
  let mejor = Infinity;
  for (const r of recursos) {
    const d = Math.abs(a.x - r.x) + Math.abs(a.y - r.y);
    if (d <= vision && d < mejor) {
      mejor = d;
      comida = r;
    }
  }

  if (comida) {
    a.est = ESTADOS.BUSCANDO;
    mover(Math.sign(comida.x - a.x), Math.sign(comida.y - a.y));
    if (a.x === comida.x && a.y === comida.y) {
      a.recoge = comida.id;
      a.c = true;
      a.e = Math.min(100, a.e + ENERGIA_POR_COMIDA);
      a.est = ESTADOS.VOLVIENDO;
    }
    return a;
  }

  // Sin comida a la vista: la energia manda. Con 0 % no muere, sigue buscando.
  a.est = a.e <= ENERGIA_BUSCAR ? ESTADOS.BUSCANDO : ESTADOS.EXPLORANDO;
  if (!(a.vx || a.vy) || rand() > INERCIA) {
    a.vx = azarPaso(rand);
    a.vy = azarPaso(rand);
  }
  return mover(a.vx, a.vy);
}

module.exports = { ESTADOS, decidir };
