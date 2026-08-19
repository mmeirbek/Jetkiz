# CaspX

Backend for a cargo & delivery logistics platform. Built with **NestJS**, **Prisma** and **PostgreSQL**.

## Features

- **Auth & users** — registration, JWT access/refresh tokens, role-based access, superadmin bootstrap.
- **Route calculation** — `POST /routes/calculate` via VROOM vehicle-routing optimization backed by OpenRouteService (distance, duration, GeoJSON geometry).
- **Checkpoint load scraping** — `POST /checkpoint-loads/sync` scrapes public Qoldau pages; `GET /checkpoint-loads/current` returns the normalized snapshot.
- **Orders & tracking** — mock orders seeded from real DHL eCommerce tracking data (`npm run seed:dhl`).
- **Predictions** — ML-backed order/delivery predictions.
- **Uploads** — avatar, cargo and product photo uploads served from `/uploads/*`.
- **Swagger UI** at `/docs`, OpenAPI JSON at `/docs-json`.
- **E2E tests** — `npm run test:e2e`, smoke tests for auth (`npm run smoke:auth`).

## Tech Stack

NestJS · TypeScript · Prisma · PostgreSQL · OpenRouteService · DHL eCommerce API · JWT

## Project setup

```bash
$ npm install
```

## CaspX local configuration

Swagger UI is available at `/docs`, and the OpenAPI JSON is available at `/docs-json`.

The route calculation endpoint is available at `POST /routes/calculate`. It uses OpenRouteService and returns distance, duration, and GeoJSON line geometry.

Checkpoint load scraping is available through:

- `POST /checkpoint-loads/sync` for a fresh scrape from public Qoldau pages
- `GET /checkpoint-loads/current` for the latest normalized snapshot

This version builds checkpoint load from the public waiting area registry and checkpoint catalog, because the public booking pages are prefiltered to a single checkpoint in their HTML.

Uploaded media is served from `/uploads/*`. The backend stores files on the server filesystem and persists public URLs in the database:

- `POST /uploads/avatar` updates `user.avatarUrl`
- `POST /uploads/cargo` updates `order.cargoPhotoUrl`
- `POST /uploads/product` appends to `order.productPhotoUrls`

For deployed environments behind a proxy, set:

```bash
PUBLIC_BASE_URL="https://api-angels.byapex.dev"
```

This makes upload responses return stable public URLs like:

```text
https://api-angels.byapex.dev/uploads/avatars/...
```

The first `SUPERADMIN` account is bootstrapped on application startup when these environment variables are set:

```bash
SUPERADMIN_EMAIL="superadmin@caspex.local"
SUPERADMIN_PASSWORD="CaspXSuperAdmin_123"
SUPERADMIN_FIRST_NAME="CaspX"
SUPERADMIN_LAST_NAME="Superadmin"
SUPERADMIN_PHONE="+77010000000"
```

## DHL seed import

The backend can seed mock `Order` rows from real DHL eCommerce tracking data:

```bash
npm run seed:dhl
```

Required `.env` variables:

```bash
DHL_API_KEY="your-dhl-api-key"
DHL_API_SECRET="your-dhl-api-secret"
DHL_PICKUP_ACCOUNT="5119000"
DATABASE_URL="postgresql://..."
```

Optional variables:

```bash
DHL_TARGET_COUNT="24"
DHL_START_DATE="20260601"
DHL_END_DATE="20260607"
DHL_LOOKBACK_WINDOWS="8"
DHL_FILTER_CITY="Austin"
DHL_FILTER_STATE="TX"
DHL_FILTER_COUNTRY="US"
DHL_FILTER_POSTAL_CODE="73301"
DHL_FILTER_ORDERED_PRODUCT_ID="ParcelPlus"
```

The script uses `GET /tracking/v4/package/open`, paginates with `offset` and `limit=10`, skips already imported DHL identifiers, and writes tracking history into `OrderTracking`.

For local development `JWT_ACCESS_TTL` can be long-lived, for example `2d`, to simplify Swagger debugging. Production should use a short access token TTL, for example `15m`.

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Full-stack with Docker

The whole platform runs with a single command via `docker-compose.yml`:

```bash
$ docker compose up --build
```

Services and ports:

| Service            | Container         | Port (host) | Notes                                              |
| ------------------ | ----------------- | ----------- | -------------------------------------------------- |
| `app`              | `caspex-app`      | `3000`      | NestJS API, Swagger at `/docs`, `/health`          |
| `postgres`         | `caspex-postgres` | `5432`      | PostgreSQL 16, migrations applied on startup       |
| `mosquitto`        | `caspex-mosquitto`| `1883`      | MQTT broker for device telemetry                   |
| `vroom-express`    | `caspex-vroom-express` | `3003`  | VROOM vehicle-routing optimization                 |
| `ors-proxy`        | `caspex-ors-proxy`| internal    | Adds `Authorization` header and proxies to ORS     |

Environment (`.env`):

```bash
# required for route optimization
OPENROUTESERVICE_API_KEY="your-openrouteservice-key"

# defaults below are fine for local docker
POSTGRES_DB="caspex_db"
POSTGRES_USER="caspex_user"
POSTGRES_PASSWORD="change_me"
```

The compose file overrides the `localhost` values of `.env` with Docker-network hosts
(`DATABASE_URL` → `postgres:5432`, `MQTT_URL` → `mosquitto:1883`, `VROOM_URL` →
`vroom-express:3000`). Do not change these in `.env` — the override lives in
`docker-compose.yml` under `app.environment`.

On a fresh database volume, migrations run automatically on startup
(`prisma migrate deploy`). Seed demo data if needed:

```bash
$ docker compose exec app npm run seed:demo
```

Verify the stack:

```bash
$ curl http://localhost:3000/health          # {"status":"ok"}
$ curl http://localhost:3003/health          # vroom-express up
$ API_URL=http://localhost:3000 npm run smoke:auth
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
