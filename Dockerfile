FROM node:16-alpine

ENV NODE_ENV=production

WORKDIR /app
RUN mkdir -p out

COPY package*.json ./
COPY patches/ ./patches

RUN npm install --production

COPY build/ ./

CMD [ "node", "index.js" ]
