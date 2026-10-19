FROM node:20-alpine
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/ ./packages/
COPY services/decision/package.json ./services/decision/

RUN npm install --omit=dev

COPY services/decision/src ./services/decision/src

CMD ["node", "services/decision/src/index.js"]
