FROM node:22-bookworm-slim

WORKDIR /app

COPY services/runner/package.json ./package.json
COPY services/runner/src ./src

ENV NODE_ENV=production
ENV PORT=10001

CMD ["node", "src/server.js"]
