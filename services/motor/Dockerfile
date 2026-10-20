FROM node:20-alpine
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/ ./packages/
COPY services/motor/package.json ./services/motor/

RUN npm install --omit=dev

COPY services/motor/src ./services/motor/src

CMD ["node", "services/motor/src/index.js"]
