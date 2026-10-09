FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    bash \
    build-essential \
    ca-certificates \
    curl \
    git \
    passwd \
    procps \
    python3 \
    tar \
    util-linux \
    && rm -rf /var/lib/apt/lists/*

COPY services/runner/package.json ./package.json
RUN npm install --omit=dev

COPY services/runner/src ./src

ENV NODE_ENV=production
ENV PORT=10001

CMD ["node", "src/server.js"]
