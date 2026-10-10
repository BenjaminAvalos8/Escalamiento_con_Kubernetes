FROM node:20-alpine

# Carpeta principal de la "máquina virtual"
WORKDIR /app

# 1. Copiar los archivos que definen las dependencias
COPY package.json package-lock.json ./
COPY services/motor/package.json ./services/motor/

# (Más adelante aquí copiaremos la carpeta packages/ compartida)

# 2. Instalar librerías
RUN npm install

# 3. Copiar el código real del motor
COPY services/motor/src ./services/motor/src

# 4. El comando que se ejecuta cuando enciendes la imagen
CMD ["node", "services/motor/src/index.js"]
