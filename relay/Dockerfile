FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --production

COPY relay-server.js .

EXPOSE 9090 8080

CMD ["node", "relay-server.js"]
