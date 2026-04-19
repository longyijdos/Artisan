# 代码约定

[English](code-conventions.md) | [简体中文](code-conventions.zh-CN.md)

## 前端

- 在 `src/` 中使用 `@/*` 导入
- 组件、hooks 和工具函数优先使用命名导出
- 共享 API contract 放在 `src/lib/*/contracts.ts`
- BFF 逻辑放在 `src/app/api/*`
- 前端 props 和 contracts 使用 `camelCase`

工具链：

- TypeScript，`strict = true`
- ESLint，使用 Next.js 核心规则
- 禁止显式 `any`

## 后端

- HTTP 路由放在 `agent/routers/`
- 业务逻辑放在 `agent/services/`
- Graph 编排放在 `agent/graph/`
- Agent 可调用工具放在 `agent/tools/`
- 主后端环境变量从 `agent/config.py` 读取
- Python 侧 schema 和 payload 使用 `snake_case`

工具链：

- Ruff
- mypy
- pytest

## 类型

- HTTP 边界使用 Pydantic
- 轻量级后端 contract 适合用 `TypedDict`
- 与动态 SDK 或弱类型外部 payload 交互时谨慎使用 `Any`

## 错误处理

- 对预期中的请求和业务错误抛出或保留 `HTTPException`
- 对未预期错误记录日志
- 错误响应使用 `detail`

## 校验命令

前端：

```bash
yarn lint:ui
yarn typecheck:ui
```

后端：

```bash
yarn lint:agent
yarn typecheck:agent
yarn test:agent
```

仓库级：

```bash
yarn verify
```
