FROM node:20-alpine
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/ ./packages/
COPY services/eventos/package.json ./services/eventos/

RUN npm install --omit=dev

COPY services/eventos/src ./services/eventos/src

EXPOSE 3000
CMD ["node", "services/eventos/src/index.js"]
