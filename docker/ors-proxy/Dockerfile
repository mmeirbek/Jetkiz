FROM node:20-bookworm-slim
WORKDIR /app
COPY docker/ors-proxy/server.js /app/server.js
EXPOSE 8090
CMD ["node", "server.js"]