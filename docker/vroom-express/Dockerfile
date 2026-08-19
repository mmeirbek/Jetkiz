# syntax=docker/dockerfile:1

# Build stage: compile VROOM v1.15.0 from source.
FROM debian:bookworm-slim AS vroom-builder
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
       ca-certificates git make g++ pkg-config \
       libasio-dev libssl-dev libglpk-dev \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /opt
RUN git clone --depth 1 --branch v1.15.0 --recurse-submodules \
      https://github.com/VROOM-Project/vroom.git vroom
WORKDIR /opt/vroom/src
RUN make -j"$(nproc)"
RUN mkdir -p /opt/vroom-out/bin && cp /opt/vroom/bin/vroom /opt/vroom-out/bin/vroom

# Runtime stage: VROOM binary + vroom-express (HTTP API on :3000).
FROM node:20-bookworm-slim AS vroom-express
RUN apt-get update \
  && apt-get install -y --no-install-recommends libssl3 curl \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /app/logs
COPY --from=vroom-builder /opt/vroom-out/bin/vroom /usr/local/bin/vroom
WORKDIR /app
RUN git clone --depth 1 --branch v0.12.0 \
      https://github.com/VROOM-Project/vroom-express.git . \
  && npm install --omit=dev
COPY docker/vroom-express/config.yml /app/config.yml
ENV VROOM_ROUTER=ors
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "src/index.js"]