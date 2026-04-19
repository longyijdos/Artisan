# 安装与启动

[English](getting-started.md) | [简体中文](getting-started.zh-CN.md)

## 前置条件

- Node.js 20+
- Yarn 4
- `uv`
- Docker 与 Docker Compose

## 安装依赖

在仓库根目录执行：

```bash
yarn install
```

如果需要手动同步 Python 环境：

```bash
yarn install:agent
```

## 启动本地基础设施

```bash
cd docker
docker compose up -d
```

会启动：

- PostgreSQL
- Daytona

常用本地端口：

- `5432`：PostgreSQL
- `18000`：Daytona dashboard / API
- `14000`：Daytona proxy
- `18003`：Daytona runner
- `12222`：Daytona SSH gateway
- `15556`：Dex

## 创建本地环境配置

```bash
cp .env.example .env
```

填写这些变量：

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

## 配置 Daytona

打开：

```text
http://localhost:18000
```

`docker/daytona/dex/config.yaml` 中定义的本地默认登录信息：

- Email：`dev@daytona.io`
- Password：`password`

然后：

1. 创建 Daytona API key
2. 复制 organization ID
3. 把两者写入 `.env`

## 创建 Sandbox Snapshot

```bash
cd docker/daytona
./setup_snapshot.sh
```

## 运行 Artisan

在仓库根目录执行：

```bash
yarn dev
```

默认本地地址：

- UI：`http://localhost:8665`
- Agent：`http://localhost:8664`

如果只想单独运行某一侧：

```bash
yarn dev:ui
yarn dev:agent
```

## 验证环境

Agent 健康检查：

```bash
curl http://localhost:8664/health
```

UI：

```text
http://localhost:8665
```

PostgreSQL：

```bash
docker ps --filter name=artisan-postgres
```

Daytona：

- `daytona-api`
- `daytona-runner`
- `daytona-proxy`
- `daytona-db`
- `daytona-redis`

## 常用命令

```bash
yarn dev
yarn lint
yarn typecheck:ui
yarn check:agent
yarn verify
```

## 常见问题

### `proxy.localhost` 无法解析

```bash
getent hosts proxy.localhost
```

期望结果：

```text
127.0.0.1 proxy.localhost
```

### Agent 依赖需要重新安装

```bash
yarn install:agent
```

### 知识库检索没有结果

检查：

- `EMBEDDING_API_KEY`
- `EMBEDDING_API_BASE`
- `EMBEDDING_MODEL_NAME`
