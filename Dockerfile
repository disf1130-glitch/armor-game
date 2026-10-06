# RelaxDev / любой Docker-хостинг. В панели выбрать тип сборки «Docker».
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install --omit=dev
COPY armor-simulation-3.html workshop-server.js workshop-db.json ./
ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "workshop-server.js"]
