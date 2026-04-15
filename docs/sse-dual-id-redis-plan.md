# SSE 双 ID 与 Redis 映射改造计划（明日执行版）

## 1. 结论（先说结论）

你现在这个项目 **不是“必须立刻”上双 ID + Redis**，因为当前架构里：

- 前端 `sessionId` 实际上就是后端 `thread_id`
- 会话元数据在 Postgres（`session_metadata`）里
- 目前 SSE 运行态主要是进程内内存（前端 `runtime-store`、后端 `ACTIVE_RUNS`）

如果还是单实例/开发环境，这套能跑。  
但如果目标是稳定线上、多实例、断线续传、可回放，建议做这次改造。

## 2. 是否需要“双 ID”

### 推荐做（建议）

- 前端/业务层：`session_id`（给用户和前端用）
- 模型/执行层：`thread_id`（给 LangGraph/LLM Provider 用）

这样做的价值：

- 业务 ID 与模型上下文解耦
- 后续切换模型供应商不影响前端会话
- 安全性更好（前端不直接暴露模型侧 ID）

### 不必做（可暂缓）

- 仅本地单实例、短会话、无断线恢复诉求

## 3. Redis 是否必须

### 必须用 Redis 的场景

- 多实例部署
- 需要跨实例 stop/reconnect
- 需要 SSE `Last-Event-ID` 重放

### 你们项目建议

- **映射主存储放 Postgres**（持久、可审计）
- **Redis 做缓存与运行态**（快、可过期）

> 不建议只放 Redis 做唯一映射（重启/淘汰后会丢）

## 4. 目标架构

1. 前端只传 `session_id`
2. 后端解析 `session_id -> thread_id`
3. 运行态（active run / event buffer）放 Redis
4. SSE 事件带 `id`，支持 `Last-Event-ID`

## 5. 分阶段执行计划

## 阶段 A：语义解耦（低风险）

- 统一命名：对外 `session_id`，内部 `thread_id`
- API 兼容旧字段：`threadId` 继续可用一段时间
- 文档与类型声明统一

交付标准：

- 前端只依赖 `sessionId` 概念
- 后端路由仍兼容旧入参，不影响现有功能

## 阶段 B：数据库补齐映射

对 `session_metadata` 增加列（迁移脚本）：

- `session_id`（如你想显式拆分，可与现有主键策略二选一）
- `model_thread_id`（或 `thread_id` 保留并改语义）
- `provider`（可选）
- `updated_at`（已有则复用）

策略：

- 先回填：`model_thread_id = thread_id`（零行为变化）
- 新会话创建时可生成独立 `model_thread_id`

交付标准：

- 读取会话时可拿到业务 ID + 模型 ID
- 老数据无损迁移

## 阶段 C：Redis 运行态接管

新增 Redis key 设计：

- `chat:session:{session_id}:thread` -> `{thread_id}`（TTL 7d，缓存）
- `chat:run:{session_id}` -> `{run_id, status, started_at}`（TTL 1h）
- `chat:sse:{session_id}:events`（列表/stream，保留最近 N 条）
- `chat:sse:{session_id}:last_id`（数字）

写策略：

- 先查 Redis，miss 再查 Postgres，并回填 Redis
- 映射变更时 DB + Redis 双写（以 DB 为准）

交付标准：

- 停止生成、运行状态可跨实例生效
- 重启后不影响会话映射（因 DB 持久）

## 阶段 D：SSE 可恢复

改造 SSE 输出：

- 每条事件增加 `id: <event_id>`
- 事件体保留 `run_id/session_id/type/payload`

改造 SSE 输入：

- 支持 `Last-Event-ID`
- 若存在断档，从 Redis 事件缓冲补发

交付标准：

- 手动断网重连可续流（至少最近 N 条）
- 不再出现“断线后只能整段重来”

## 阶段 E：清理与收口

- 下线旧 `threadId` 入参（先打日志观察后再删）
- 删除前端进程内 run store 的跨请求关键职责
- 增加监控：重连率、补发命中率、stop 成功率

## 6. 具体到你们当前代码的改造点

后端：

- `agent/routers/chat.py`：入参从 `thread_id` 过渡为 `session_id` + 映射解析
- `agent/routers/sessions.py`：创建会话时同时生成/维护模型 thread
- `agent/utils/db.py`：增加映射查询与回填逻辑

前端：

- `src/app/api/chat/run/route.ts`：请求体统一 `sessionId`
- `src/app/api/chat/history/route.ts`：按 `sessionId` 拉取，后端解映射
- `src/components/ChatPanel/ChatPanel.tsx`：只感知 `sessionId`

## 7. 风险与回滚

风险：

- ID 语义切换期，前后端字段混用导致 400/422
- Redis 过期策略过短导致重连失败

回滚策略：

- 保留旧接口兼容开关（feature flag）
- DB schema 前向兼容（新增列不删老列）

## 8. 明日建议执行顺序（半天可落地 A+B）

1. 先做阶段 A（命名与兼容）
2. 再做阶段 B（DB 字段与回填）
3. 阶段 C/D 放到下一迭代（需联调和压测）

