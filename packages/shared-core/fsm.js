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
const TICKS_POR_PASO = 2; // Una celda cada 2 ticks (hasta 5 celdas/s a 10 TPS).

// Nido y panico son cuadrados: distancia de Chebyshev
const distancia = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const limitar = (v, max) => Math.max(0, Math.min(max - 1, v));
const DIRECCIONES = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];

// Devuelve el agente nuevo. `recoge` y `entrega` avisan al motor, que es la autoridad del mundo.
function decidir(agente, { depredadores = [], recursos = [], nido, sequias = [], rastro, avisosSequia }, rand = Math.random, seMueve = true) {
  const a = { ...agente, e: Math.max(0, Math.round((agente.e - DESGASTE_POR_TICK) * 10) / 10) };
  delete a.recoge;
  delete a.entrega;
  delete a.avisoSequia;

  const mover = (dx, dy) => {
    if (!seMueve) return a;
    a.x = limitar(a.x + dx, ANCHO);
    a.y = limitar(a.y + dy, ALTO);
    return a;
  };

  const amenaza = depredadores.find((d) => distancia(a, d) <= RADIO_PANICO);
  if (amenaza) {
    a.est = ESTADOS.HUYENDO;
    return mover(a.x >= amenaza.x ? 1 : -1, a.y >= amenaza.y ? 1 : -1);
  }
  const aviso = avisosSequia?.[`${a.x},${a.y}`];
  const explorando = a.est === ESTADOS.EXPLORANDO;
  const zonaDetectada = sequias.find((zona) => distancia(a, zona) <= zona.radio + Number(explorando));
  const sequia = zonaDetectada ?? (aviso === undefined ? undefined : sequias.find((zona) => zona.id === aviso));
  if (sequia) {
    if (explorando && zonaDetectada) a.avisoSequia = zonaDetectada.id;
    a.est = ESTADOS.HUYENDO;
    const dx = a.x - sequia.x;
    const dy = a.y - sequia.y;
    // Sale por el borde mas cercano de la zona cuadrada.
    return Math.abs(dx) >= Math.abs(dy) ? mover(Math.sign(dx) || 1, 0) : mover(0, Math.sign(dy));
  }
  if (a.est === ESTADOS.HUYENDO) a.est = a.c ? ESTADOS.VOLVIENDO : ESTADOS.EXPLORANDO;

  if (a.est === ESTADOS.VOLVIENDO) {
    mover(Math.sign(nido.x - a.x), Math.sign(nido.y - a.y));
    if (distancia(a, nido) <= nido.radio) {
      a.c = false;
      a.e = 100;
      a.entrega = true;
      a.est = ESTADOS.EXPLORANDO;
    }
    return a;
  }

  const vision = RADIO_VISION + (a.e <= ENERGIA_CRITICA ? EXTRA_VISION_CRITICA : 0);
  let comida = a.fuenteId === undefined ? undefined : recursos.find((r) => r.id === a.fuenteId);
  if (!comida) delete a.fuenteId;
  const marcaActual = rastro?.[`${a.x},${a.y}`];
  let pasoRastro = comida && marcaActual?.id === comida.id ? marcaActual : undefined;
  let mejor = Infinity;
  if (!comida) {
    for (const r of recursos) {
      const d = Math.abs(a.x - r.x) + Math.abs(a.y - r.y);
      if (d <= vision && d < mejor) {
        mejor = d;
        comida = r;
      }
    }
  }

  if (!comida && rastro) {
    let marca = marcaActual;
    pasoRastro = marcaActual;
    for (const [dx, dy] of DIRECCIONES) {
      if (marca) break;
      const x = a.x + dx, y = a.y + dy;
      marca = rastro[`${x},${y}`];
      if (marca) pasoRastro = { x, y };
    }
    if (marca) comida = recursos.find((r) => r.id === marca.id);
    if (comida) a.fuenteId = comida.id;
  }

  if (comida) {
    a.est = ESTADOS.BUSCANDO;
    const destino = pasoRastro ?? comida;
    mover(Math.sign(destino.x - a.x), Math.sign(destino.y - a.y));
    if (a.x === comida.x && a.y === comida.y) {
      a.recoge = comida.id;
      a.fuenteId = comida.id;
      a.c = true;
      a.e = Math.min(100, a.e + ENERGIA_POR_COMIDA);
      a.est = ESTADOS.VOLVIENDO;
    }
    return a;
  }

  // Sin comida a la vista: la energia manda. Con 0 % no muere, sigue buscando.
  a.est = a.e <= ENERGIA_BUSCAR ? ESTADOS.BUSCANDO : ESTADOS.EXPLORANDO;
  if (seMueve) {
    const rumbo = DIRECCIONES.findIndex(([dx, dy]) => dx === a.vx && dy === a.vy);
    if (rumbo === -1 || rand() > INERCIA) {
      const siguiente = rumbo === -1 ? Math.floor(rand() * 8) : (rumbo + (rand() < 0.5 ? 7 : 1)) % 8;
      [a.vx, a.vy] = DIRECCIONES[siguiente];
    }
    if (limitar(a.x + a.vx, ANCHO) === a.x && limitar(a.y + a.vy, ALTO) === a.y) {
      [a.vx, a.vy] = [-a.vx, -a.vy];
      return a;
    }
  }
  return mover(a.vx, a.vy);
}

module.exports = { ESTADOS, RADIO_PANICO, TICKS_POR_PASO, decidir };
