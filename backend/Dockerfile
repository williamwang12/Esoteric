FROM node:lts-alpine

WORKDIR /app

COPY package.json ./

RUN npm install --omit=dev

COPY . .

RUN mkdir -p uploads

RUN addgroup -g 1001 -S nodejs
RUN adduser -S backend -u 1001
RUN chown -R backend:nodejs /app

USER backend

EXPOSE 5002

CMD ["node", "server-2fa.js"]