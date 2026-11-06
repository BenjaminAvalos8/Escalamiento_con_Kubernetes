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
