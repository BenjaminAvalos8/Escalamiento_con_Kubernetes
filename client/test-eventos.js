// Ejecutar contra Compose o Kubernetes recien iniciado, sin otra carga.
import assert from 'node:assert/strict';
import process from 'node:process';
import { io } from 'socket.io-client';

const destino = process.argv[2] || 'http://localhost:8080';
const socket = io(destino, { transports: ['websocket'], reconnection: false });

function esperarEstado(coincide) {
  return new Promise((resolve, reject) => {
    const recibir = (estado) => {
      if (!coincide(estado)) return;
      clearTimeout(limite);
      socket.off('mundo:estado', recibir);
      resolve(estado);
    };
    const limite = setTimeout(() => {
      socket.off('mundo:estado', recibir);
      reject(new Error('No llego el estado esperado del motor'));
    }, 10000);
    socket.on('mundo:estado', recibir);
  });
}

async function evento(tipo, coincide) {
  const estado = esperarEstado(coincide);
  // El estado puede llegar antes de que se reciba la respuesta HTTP.
  const confirmar = async () => {
    const disparar = () => fetch(new URL(`/api/eventos/${tipo}`, destino), {
      method: 'POST', signal: AbortSignal.timeout(5000),
    });
    const primera = await disparar();
    assert.equal(primera.status, 200);
    assert.equal((await disparar()).status, 429);
  };
  const [resultado] = await Promise.all([estado, confirmar()]);
  return resultado;
}

try {
  await esperarEstado(({ tick }) => tick > 0);
  const abundancia = await evento('abundancia', ({ recursos }) => recursos.some((r) => r.tipo === 'ave'));
  assert.ok(abundancia.recursos.find((r) => r.tipo === 'ave').unidades > 100);

  const sequia = await evento('sequia', ({ eventosActivos }) => eventosActivos.some((e) => e.tipo === 'sequia'));
  const zona = sequia.eventosActivos.find((e) => e.tipo === 'sequia');
  assert.ok(sequia.recursos.every((r) => Math.max(Math.abs(r.x - zona.x), Math.abs(r.y - zona.y)) > zona.radio));

  const ataque = await evento('depredador', ({ depredadores }) => depredadores.length > 0);
  assert.ok(ataque.depredadores[0].ticksRestantes > 0);
  console.log('HU15/HU16/HU17 OK: REST, cooldown y estados del motor recibidos por Socket.IO');
} finally {
  socket.disconnect();
}
