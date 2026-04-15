# 代码规范

本文档记录仓库当前实际采用的代码约定，只写两类内容：

- 已有工具链约束
- 代码中已经广泛采用、继续沿用成本较低的模式

如果未来要提高标准，先补 lint / typecheck / 测试，再升级本文档，不要反过来。

## 总则

- 新代码优先贴近现有结构和写法，不为了“更完美”的抽象打破已有模式。
- 文档中的“必须”只用于当前仓库已经稳定执行的规则。
- 文档中的“优先”表示推荐方向，不代表仓库已经完全统一。

## 工具链现状

### 前端

当前前端主要由 ESLint 约束：

- 禁止显式 `any`
- 允许使用 `as` 做类型断言
- 使用 Next.js 默认规则集

对应配置见 `eslint.config.mjs`。

### 后端

当前后端主要由 Ruff、mypy 和 pytest 约束：

- Ruff 负责 import 排序和基础错误检查
- Python 行宽为 100
- mypy 开启，但整体策略偏保守，`ignore_missing_imports = true`
- 测试主要覆盖 agent 侧关键路由和部分核心逻辑

对应配置见 `agent/pyproject.toml`。

## 目录与模块

### 仓库结构

当前仓库按前后端混合单仓组织：

- `src/`：Next.js UI、BFF API、前端状态与组件
- `agent/`：FastAPI、LangGraph、sandbox、工具和服务
- `docs/`：项目文档
- `docker/`：本地和远程运行环境

这是当前既成事实，新增代码应继续沿用，不在本阶段引入 monorepo 或 package split。

### 模块划分

后端当前主要按以下层次组织：

- `routers/`：HTTP 入口
- `services/`：业务逻辑
- `schemas/`：请求 / 响应模型与部分归一化逻辑
- `sandbox/`：Daytona 与文件系统相关能力
- `tools/`：供 agent 调用的工具
- `utils/`：跨模块复用的辅助函数

前端当前主要按以下层次组织：

- `src/app/`：页面与 Next.js API Route
- `src/components/`：UI 组件
- `src/lib/`：跨组件共享的 contract、API 工具和纯函数
- `src/hooks/`：少量跨域 hook

### Barrel 导出

当前项目存在 `index.ts` / `__init__.py` barrel，但没有做到全仓强制统一。

实际约定是：

- 组件目录、router 包这类对外边界清晰的目录，优先保留 barrel
- 业务代码允许直接导入具体模块，不要求为 barrel 规则强行改动已有代码
- 是否通过 barrel 导入，以可读性和现有目录习惯为准

换句话说，barrel 在本仓库是常用模式，不是强制铁律。

## Import 约定

- import 放在文件顶部
- Python 没有禁止包内直接模块导入；`from sandbox.daytona_client import ...` 这类写法在现有代码中是正常模式
- `TYPE_CHECKING` 守卫导入可以继续使用
- 如果只是为了避免循环依赖而写函数内延迟导入，优先先检查是否能通过拆模块解决；但当前文档不把它定义成绝对禁令

## 类型与 Contract

### TypeScript

当前前端类型约定比较明确：

- HTTP / SSE / 跨组件共享的数据结构，优先放在 `src/lib/<domain>/contracts.ts`
- 组件、hook、BFF route 优先复用这些 contract
- 可以使用 `as SomeContract` 断言响应数据，这也是当前仓库的主要写法
- 禁止显式 `any`

这里的重点是“优先复用已有 contract”，不是要求所有动态数据都先做运行时校验。

### Python

当前后端类型约定是：

- API 边界优先使用 `TypedDict` 或 Pydantic schema
- agent tool 返回值优先在 `agent/tools/_types.py` 中集中定义
- 服务层和工具层允许在现阶段保持较轻量的类型约束，不追求处处严格建模
- 当前代码基本不使用 `Any`，这点继续保持

这里的现实标准是“边界尽量有类型”，不是“所有动态入口都必须完成严格收窄”。

## 配置管理

后端环境变量当前统一收口在 `agent/config.py`，新增后端配置继续放这里。

实际约定：

- 涉及环境变量的后端配置统一在 `agent/config.py` 读取
- 业务代码优先从 `config.py` 导入配置值
- 少量硬编码常量可以保留在对应模块内，尤其是局部业务常量

这里的重点是避免把 `os.getenv()` 散落到各个业务文件，而不是要求所有常量都必须集中到一个文件。

## 错误处理

### 后端 FastAPI

当前后端主流模式是：

- router 作为 HTTP 边界
- 已知业务错误尽量映射为 `HTTPException`
- 未知异常记录日志后返回 500

常见写法：

```python
try:
    return await some_service()
except HTTPException:
    raise
except ValueError as e:
    raise HTTPException(status_code=400, detail=str(e))
except Exception as e:
    logger.exception("Some router failed")
    raise HTTPException(status_code=500, detail="Some router failed") from e
```

这表示当前仓库接受一部分 `ValueError -> HTTPException` 转换，也接受在 4xx 场景下返回具体 `detail`。

### Next.js API Route

当前 BFF 的主流模式是：

- 调用 `fetchAgent`
- 尽量透传 agent 的状态码和 JSON body
- catch 中返回一个带 `detail` 的 500 响应

这层目前允许存在少量按路由定制的 fallback body，不要求所有 route 完全抽象成同一模板。

### 前端调用方

前端消费 BFF / agent 数据时：

- 优先通过 `response.ok` 判断成功失败
- 错误提示优先读取 `detail`
- 对成功响应允许直接按 contract 使用数据

## 测试与校验

提交前至少建议执行：

```bash
yarn lint
yarn typecheck:agent
yarn test:agent
```

如果改动了前端 BFF 或 Next.js 页面，最好额外执行：

```bash
yarn build
```

当前仓库没有单独的前端 `tsc --noEmit` 脚本，因此前端类型问题很多时候依赖 ESLint 和 Next.js build 暴露。

## 当前不写进规范的内容

以下内容暂时不再作为仓库规范写入本文档：

- “外部只能从 barrel 导入，禁止直接导入内部文件”
- “所有动态边界都必须先用 `object` 接住并显式收窄”
- “错误响应只能有一种绝对统一格式”
- “任何情况下都不能返回 `str(e)`”

这些方向未必错，但当前代码和工具链都没有完全落实，把它们写成硬规则只会继续制造文档与现实脱节。
