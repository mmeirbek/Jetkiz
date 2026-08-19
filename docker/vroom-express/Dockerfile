# syntax=docker/dockerfile:1

# Build stage: compile VROOM v1.15.0 from source.
FROM ubuntu:24.04 AS vroom-builder
RUN apt-get update \
  && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
       ca-certificates git make g++ pkg-config \
       libasio-dev libssl-dev libglpk-dev \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /opt
RUN for i in 1 2 3 4 5; do \
      git clone --depth 1 --branch v1.15.0 --recurse-submodules \
        https://github.com/VROOM-Project/vroom.git vroom && break || sleep 5; \
    done
WORKDIR /opt/vroom/src
RUN make -j"$(nproc)"
RUN mkdir -p /opt/vroom-out/bin && cp /opt/vroom/bin/vroom /opt/vroom-out/bin/vroom

# Runtime stage: VROOM binary + vroom-express (HTTP API on :3000).
# Ubuntu 24.04 runtime matches the glibc/libstdc++ (GCC 13) the vroom binary was built with.
FROM ubuntu:24.04 AS vroom-express
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl git libglpk40 \
  && rm -rf /var/lib/apt/lists/* \
  && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
  && apt-get install -y --no-install-recommends nodejs \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
RUN for i in 1 2 3 4 5; do \
      git clone --depth 1 --branch v0.12.0 \
        https://github.com/VROOM-Project/vroom-express.git . && break || sleep 5; \
    done \
  && mkdir -p /app/logs \
  && npm install --omit=dev --ignore-scripts
COPY --from=vroom-builder /opt/vroom-out/bin/vroom /usr/local/bin/vroom
COPY docker/vroom-express/config.yml /app/config.yml
ENV VROOM_ROUTER=ors
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "src/index.js"]