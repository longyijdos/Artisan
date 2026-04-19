# Architecture

[English](architecture.md) | [简体中文](architecture.zh-CN.md)

## Monorepo

```text
src/      Next.js UI and BFF routes
agent/    FastAPI agent, LangGraph graph, tools, services
docker/   Local PostgreSQL and Daytona infrastructure
docs/     Project documentation
```

## System View

```text
Browser
  -> Next.js UI
  -> Next.js Route Handlers
  -> FastAPI Agent
  -> LangGraph / services / tools
  -> Daytona Sandbox + PostgreSQL + external APIs
```

## Main Parts

### UI and BFF

- `src/app/`
- `src/components/`
- `src/hooks/`
- `src/lib/`

Responsibilities:

- Workspace UI
- Chat UI
- Terminal, files, knowledge, and skills panels
- BFF routes for browser-to-agent communication
- SSE forwarding

### Agent

- `agent/routers/`
- `agent/services/`
- `agent/graph/`
- `agent/tools/`
- `agent/sandbox/`
- `agent/models/`
- `agent/utils/`

Responsibilities:

- FastAPI endpoints
- LangGraph orchestration
- Tool execution
- Sandbox coordination
- Session and knowledge operations

### Sandbox

- `agent/sandbox/`
- `docker/daytona/`

Responsibilities:

- Isolated file access
- Command execution
- Skill runtime environment

### Persistence

- PostgreSQL for session metadata
- PostgreSQL + pgvector for knowledge storage and retrieval

Main implementation:

- `agent/utils/db.py`
- `agent/services/sessions/`
- `agent/services/knowledge/`

## Request Flows

### Chat

```text
Browser
  -> src/app/api/chat/*
  -> agent/routers/chat.py
  -> agent/services/chat/*
  -> agent/graph/*
```

### Workspace and Terminal

```text
Browser
  -> src/app/api/workspace/* or src/app/api/terminal/route.ts
  -> agent routers
  -> sandbox + workspace services
```

### Skills

```text
Browser
  -> src/app/api/skills/*
  -> agent/routers/skills.py
  -> agent/services/skills/*
  -> agent/sandbox/_skills.py
```

### Knowledge Base

```text
Browser
  -> src/app/api/knowledge/*
  -> agent knowledge routes
  -> chunking + remote embeddings
  -> PostgreSQL / pgvector
```

## Naming Boundary

- Frontend contracts and props use `camelCase`
- Backend schemas and payloads use `snake_case`
- BFF routes handle most of the conversion
