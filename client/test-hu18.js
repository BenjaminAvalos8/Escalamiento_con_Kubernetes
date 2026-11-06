import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

console.log('[HU18 Test] Iniciando verificacion de criterios de aceptacion de la HU18 (Acceso sin instalacion previa)...');

const rootDir = path.resolve(import.meta.dirname, '..');

// Criterio 1: Obtencion de URL publica / exposicion estandar sin configuracion manual de puertos
const ingressPath = path.resolve(rootDir, 'k8s', 'ingress.yaml');
const deploymentsPath = path.resolve(rootDir, 'k8s', 'deployments.yaml');

assert.ok(fs.existsSync(deploymentsPath), 'Fallo Criterio 1: k8s/deployments.yaml debe existir');
const deploymentsContent = fs.readFileSync(deploymentsPath, 'utf8');

assert.ok(
  deploymentsContent.includes('client-service') && deploymentsContent.includes('NodePort'),
  'Fallo Criterio 1: client-service debe estar configurado como NodePort para acceso externo'
);

assert.ok(fs.existsSync(ingressPath), 'Fallo Criterio 1: k8s/ingress.yaml debe existir para enrutamiento HTTP en puerto estandar 80');

// Criterio 2: Carga desde dispositivo externo completamente virgen (sin entorno de desarrollo)
const nginxConfPath = path.resolve(rootDir, 'client', 'nginx.conf');
assert.ok(fs.existsSync(nginxConfPath), 'Fallo Criterio 2: client/nginx.conf debe existir para servir el frontend estatico');
const nginxContent = fs.readFileSync(nginxConfPath, 'utf8');
assert.ok(
  nginxContent.includes('location / {') && nginxContent.includes('try_files'),
  'Fallo Criterio 2: Nginx debe servir la SPA en el root sin requerir software adicional'
);

// Criterio 3: El navegador ejecuta el motor WebGL / Canvas nativo
const mapaCodePath = path.resolve(rootDir, 'client', 'src', 'components', 'MapaEcosistema.jsx');
const mapaCode = fs.readFileSync(mapaCodePath, 'utf8');

assert.ok(
  mapaCode.includes("canvas.getContext('2d')") || mapaCode.includes("getContext('webgl')"),
  'Fallo Criterio 3: El cliente debe ejecutar el motor grafico nativo sin plugins'
);
assert.ok(
  mapaCode.includes('requestAnimationFrame'),
  'Fallo Criterio 3: El motor debe usar requestAnimationFrame nativo a 60 FPS'
);

// Criterio 4: Recepcion de datos en vivo sin requerir autenticacion ni configuracion manual de puertos
const appCodePath = path.resolve(rootDir, 'client', 'src', 'App.jsx');
const appCode = fs.readFileSync(appCodePath, 'utf8');

assert.ok(
  appCode.includes("io({") && !appCode.includes("auth:"),
  'Fallo Criterio 4: La conexion WebSocket debe ser abierta y transparente para cualquier espectador'
);

const difusionCodePath = path.resolve(rootDir, 'services', 'difusion', 'src', 'index.js');
const difusionCode = fs.readFileSync(difusionCodePath, 'utf8');
assert.ok(
  difusionCode.includes('cors: { origin: "*" }'),
  'Fallo Criterio 4: El microservicio de difusion debe permitir conexiones libres (CORS *)'
);

console.log('[HU18 Test] Todos los criterios de aceptacion de la HU18 validados exitosamente.');
