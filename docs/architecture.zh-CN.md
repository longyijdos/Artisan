# 架构说明

[English](architecture.md) | [简体中文](architecture.zh-CN.md)

## Monorepo

```text
src/      Next.js UI 与 BFF 路由
agent/    FastAPI agent、LangGraph graph、tools 与 services
docker/   本地 PostgreSQL 与 Daytona 基础设施
docs/     项目文档
```

## 系统视图

```text
Browser
  -> Next.js UI
  -> Next.js Route Handlers
  -> FastAPI Agent
  -> LangGraph / services / tools
  -> Daytona Sandbox + PostgreSQL + external APIs
```

## 主要部分

### UI 与 BFF

- `src/app/`
- `src/components/`
- `src/hooks/`
- `src/lib/`

职责：

- 工作台界面
- 聊天界面
- 终端、文件、知识库和技能面板
- 浏览器到 agent 的 BFF 路由
- SSE 转发

### Agent

- `agent/routers/`
- `agent/services/`
- `agent/graph/`
- `agent/tools/`
- `agent/sandbox/`
- `agent/models/`
- `agent/utils/`

职责：

- FastAPI 接口
- LangGraph 编排
- Tool 执行
- Sandbox 协调
- 会话与知识库操作

### Sandbox

- `agent/sandbox/`
- `docker/daytona/`

职责：

- 隔离文件访问
- 命令执行
- 技能运行环境

### 持久化层

- PostgreSQL 用于会话元数据
- PostgreSQL + pgvector 用于知识库存储与检索

主要实现位置：

- `agent/utils/db.py`
- `agent/services/sessions/`
- `agent/services/knowledge/`

## 请求链路

### 聊天

```text
Browser
  -> src/app/api/chat/*
  -> agent/routers/chat.py
  -> agent/services/chat/*
  -> agent/graph/*
```

### 工作区与终端

```text
Browser
  -> src/app/api/workspace/* 或 src/app/api/terminal/route.ts
  -> agent routers
  -> sandbox + workspace services
```

### 技能

```text
Browser
  -> src/app/api/skills/*
  -> agent/routers/skills.py
  -> agent/services/skills/*
  -> agent/sandbox/_skills.py
```

### 知识库

```text
Browser
  -> src/app/api/knowledge/*
  -> agent knowledge routes
  -> chunking + remote embeddings
  -> PostgreSQL / pgvector
```

## 命名边界

- 前端 contracts 和 props 使用 `camelCase`
- 后端 schemas 和 payloads 使用 `snake_case`
- 大部分字段转换在 BFF 路由层完成
