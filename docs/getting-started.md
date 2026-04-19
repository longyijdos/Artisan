# Getting Started

[English](getting-started.md) | [简体中文](getting-started.zh-CN.md)

## Prerequisites

- Node.js 20+
- Yarn 4
- `uv`
- Docker and Docker Compose

## Install Dependencies

From the repository root:

```bash
yarn install
```

If you need to sync the Python environment manually:

```bash
yarn install:agent
```

## Start Local Infrastructure

```bash
cd docker
docker compose up -d
```

This starts:

- PostgreSQL
- Daytona

Common local ports:

- `5432`: PostgreSQL
- `18000`: Daytona dashboard and API
- `14000`: Daytona proxy
- `18003`: Daytona runner
- `12222`: Daytona SSH gateway
- `15556`: Dex

## Create Local Environment Config

```bash
cp .env.example .env
```

Fill in:

- `OPENAI_API_KEY`
- `OPENAI_API_BASE`
- `LLM_MODEL`
- `LLM_LITE_MODEL`
- `EMBEDDING_API_KEY`
- `EMBEDDING_API_BASE`
- `EMBEDDING_MODEL_NAME`
- `TAVILY_API_KEY`
- `daytona_apikey`
- `organizationID`

## Set Up Daytona

Open:

```text
http://localhost:18000
```

Default local login from `docker/daytona/dex/config.yaml`:

- Email: `dev@daytona.io`
- Password: `password`

Then:

1. Create a Daytona API key
2. Copy the organization ID
3. Add both values to `.env`

## Create the Sandbox Snapshot

```bash
cd docker/daytona
./setup_snapshot.sh
```

## Run Artisan

From the repository root:

```bash
yarn dev
```

Default local endpoints:

- UI: `http://localhost:8665`
- Agent: `http://localhost:8664`

Run either side independently if needed:

```bash
yarn dev:ui
yarn dev:agent
```

## Verify the Setup

Agent health:

```bash
curl http://localhost:8664/health
```

UI:

```text
http://localhost:8665
```

PostgreSQL:

```bash
docker ps --filter name=artisan-postgres
```

Daytona:

- `daytona-api`
- `daytona-runner`
- `daytona-proxy`
- `daytona-db`
- `daytona-redis`

## Useful Commands

```bash
yarn dev
yarn lint
yarn typecheck:ui
yarn check:agent
yarn verify
```

## Troubleshooting

### `proxy.localhost` does not resolve

```bash
getent hosts proxy.localhost
```

Expected result:

```text
127.0.0.1 proxy.localhost
```

### Agent dependencies need to be reinstalled

```bash
yarn install:agent
```

### Knowledge retrieval returns no results

Check:

- `EMBEDDING_API_KEY`
- `EMBEDDING_API_BASE`
- `EMBEDDING_MODEL_NAME`
