FROM node:20-alpine
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/ ./packages/
COPY services/difusion/package.json ./services/difusion/

RUN npm install --omit=dev

COPY services/difusion/src ./services/difusion/src

EXPOSE 4000
CMD ["node", "services/difusion/src/index.js"]
