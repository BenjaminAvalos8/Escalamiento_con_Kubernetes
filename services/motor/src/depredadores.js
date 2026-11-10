const distancia = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const HORMIGAS_PARA_DEFENDERSE = 6;

function moverYCapturar(depredadores, agentes, nido) {
  const capturados = new Set();
  const derrotados = [];
  for (const dep of depredadores) {
    let presa;
    let cerca = Infinity;
    // ponytail: hasta 4 depredadores recorren la lista; indexar por celdas si domina el tick.
    for (const a of agentes) {
      const d = distancia(dep, a);
      if (d < cerca && !capturados.has(a.id) && distancia(a, nido) > nido.radio) {
        presa = a;
        cerca = d;
      }
    }
    if (!presa) continue;

    const dx = Math.sign(presa.x - dep.x);
    const dy = Math.sign(presa.y - dep.y);
    const rodeo = Math.abs(dep.x - nido.x) > nido.radio
      ? [dep.x, dep.y + (presa.y >= nido.y ? 1 : -1)]
      : [dep.x + (presa.x >= nido.x ? 1 : -1), dep.y];
    // Cada tick avanza una celda; la hormiga se mueve cada dos.
    const pasos = cerca === 0 ? [] : [[dep.x + dx, dep.y + dy], [dep.x + dx, dep.y], [dep.x, dep.y + dy], rodeo];
    for (const [x, y] of pasos) {
      if ((x !== dep.x || y !== dep.y) && distancia({ x, y }, nido) > nido.radio) {
        Object.assign(dep, { x, y });
        break;
      }
    }
    let defensoras = 0;
    for (const a of agentes) {
      if (!a.c && !capturados.has(a.id) && distancia(a, dep) <= 1 && distancia(a, nido) > nido.radio) {
        defensoras++;
        if (defensoras >= HORMIGAS_PARA_DEFENDERSE) break;
      }
    }
    if (defensoras >= HORMIGAS_PARA_DEFENDERSE) derrotados.push(dep);
    else if (distancia(dep, presa) <= 1) capturados.add(presa.id);
  }
  return { capturados, derrotados };
}

module.exports = { moverYCapturar, distancia };
