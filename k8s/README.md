# Despliegue en Kubernetes

Clúster local de Docker Desktop. Desde la raíz del repo:

```
docker build -t anthill-motor:latest -f services/motor/Dockerfile .
docker build -t anthill-decision:latest -f services/decision/Dockerfile .
docker build -t anthill-difusion:latest -f services/difusion/Dockerfile .
docker build -t anthill-eventos:latest -f services/eventos/Dockerfile .
docker build -t anthill-client:v3 -f client/Dockerfile .
kubectl apply -f k8s/
```

En clústeres con almacén de imágenes separado, como kind o k3d, importa
las cinco imágenes `anthill-*` al nodo antes de aplicar los manifiestos.

## Acceso al dashboard (HU18)

- **Misma máquina:** http://localhost:30080
- **Internet, sin instalar nada en el dispositivo del espectador:** abrir un túnel inverso.
  El comando imprime una URL pública `https://....trycloudflare.com`.

  ```
  docker run --rm cloudflare/cloudflared tunnel --url http://host.docker.internal:30080
  ```

  Con el túnel abierto, cualquiera con la URL puede disparar eventos e inyectar carga,
  porque el proyecto no incluye autenticación. Cerrarlo al terminar la demo.

`ingress.yaml` solo funciona si el clúster tiene un Ingress Controller; Docker Desktop no trae uno.

## Semilla y pruebas (Sprint 3)

El motor usa `SEMILLA_SIMULACION=42` en el manifiesto. Reinicia el motor con
la misma semilla y cantidad inicial para repetir las posiciones de arranque.
En Compose puedes definir la variable antes de levantar el motor. Sin ella,
el arranque sigue siendo aleatorio. Para comparar una corrida con eventos,
aplica los mismos eventos en el mismo orden y tick.

Para medir CPU en el clúster local, instala Metrics Server v0.8.0 (Kubernetes
1.31 o superior) y comprueba que responde antes de iniciar una prueba. El
manifiesto original viene de
[Metrics Server](https://github.com/kubernetes-sigs/metrics-server/releases/tag/v0.8.0).
El overlay local admite certificados de kubelet autofirmados. El límite del
motor es 1 CPU, así que 900m equivale al 90 % de su límite.

```powershell
kubectl apply -k k8s/metrics-server
kubectl rollout status -n kube-system deployment/metrics-server
kubectl top pods
```

Instala las dependencias desde la raíz con `npm ci`. En una corrida recién
iniciada y sin otros usuarios, prueba los eventos con
`node client/test-eventos.js http://localhost:30080`. Luego reinicia el motor
antes de cada prueba de carga. Ejecuta un eje por vez y deja que el HPA
vuelva a su mínimo antes de repetir. Cada script guarda muestras en JSONL.

```powershell
$env:MEDIR_CPU = '1'
node load-tests/stress-agentes.js http://localhost:30080 500,1000,2500,5000,10000 180
node load-tests/stress-difusion.js http://localhost:30080 10,50,100,500,1000 180
```

El retardo WebSocket de la prueba usa el reloj del motor y el del cliente.
Ejecuta ambos en la misma máquina para compararlos. La latencia de tick
proviene de `/metrics`; la CPU se registra en las muestras de la prueba.

Abre el acceso a Prometheus en otra terminal y exporta con las fechas ISO
de inicio y fin de la corrida. Conserva un CSV y un JSONL por repetición.

```powershell
kubectl port-forward svc/prometheus 9090:9090
node load-tests/exportar-metricas.js <inicio-ISO> <fin-ISO> load-tests/resultados/corrida.csv
```
