# Code Conventions

[English](code-conventions.md) | [简体中文](code-conventions.zh-CN.md)

## Frontend

- Use `@/*` imports inside `src/`
- Prefer named exports for components, hooks, and utilities
- Keep shared API contracts in `src/lib/*/contracts.ts`
- Keep BFF logic in `src/app/api/*`
- Use `camelCase` for frontend props and contracts

Tooling:

- TypeScript with `strict = true`
- ESLint with Next.js core rules
- Explicit `any` is disallowed

## Backend

- Keep HTTP routes in `agent/routers/`
- Keep business logic in `agent/services/`
- Keep graph orchestration in `agent/graph/`
- Keep agent-callable tools in `agent/tools/`
- Read main backend environment variables from `agent/config.py`
- Use `snake_case` for Python-facing schemas and payloads

Tooling:

- Ruff
- mypy
- pytest

## Typing

- Use Pydantic at HTTP boundaries
- Use `TypedDict` for lightweight backend contracts where it fits
- Use `Any` sparingly when dealing with dynamic SDKs or loose external payloads

## Error Handling

- Raise or preserve `HTTPException` for expected request and domain errors
- Log unexpected failures
- Return error payloads with `detail`

## Validation

Frontend:

```bash
yarn lint:ui
yarn typecheck:ui
```

Backend:

```bash
yarn lint:agent
yarn typecheck:agent
yarn test:agent
```

Repository-wide:

```bash
yarn verify
```
