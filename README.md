# Artisan

Artisan 是一个自主 AI 工匠，能在隔离沙盒中完成文件操作、命令执行、网络搜索和专业技能调用——用户只需描述任务即可得到结果。

## 技术栈

| 层 | 技术 |
|----|------|
| 前端 | Next.js 16, React 19, TailwindCSS 4 |
| BFF | Next.js Route Handlers（SSE 转发） |
| Agent | Python 3.12, FastAPI, LangGraph |
| 沙盒 | Daytona（远程容器执行） |
| 数据库 | PostgreSQL 16 + pgvector |
| 搜索 | Tavily |
| LLM | OpenAI 兼容接口（默认 DeepSeek） |

## 项目结构

```
src/                           # Next.js 前端
├── app/
│   ├── api/                   #   BFF 路由（chat, sessions, skills, knowledge, workspace, terminal）
│   └── [[...sessionId]]/      #   主页面
├── components/
│   ├── ChatPanel/             #   聊天面板（消息流、输入框）
│   ├── ToolRenderers/         #   工具调用渲染（后端工具 + 前端交互）
│   ├── FileTree/              #   沙盒文件树
│   ├── FilePreview/           #   文件预览
│   ├── WorkspacePanel/        #   工作区面板
│   ├── TerminalView/          #   终端视图
│   ├── SkillsLibrary/         #   技能库
│   ├── KnowledgePanel/        #   知识库面板
│   ├── Layout/                #   布局组件
│   ├── SessionSidebar/        #   会话侧边栏
│   └── ...
├── hooks/                     #   React Hooks（useSession 等）
└── lib/                       #   工具函数（api, chat, skills, workspace 等）

agent/                         # Python Agent 后端
├── main.py                    #   入口
├── app.py                     #   FastAPI 应用
├── prompts.py                 #   系统 Prompt
├── graph/                     #   LangGraph 图定义（builder, nodes, tools）
├── routers/                   #   API 路由（chat, sessions, skills, knowledge, workspace, terminal, health）
├── services/                  #   业务逻辑
├── tools/                     #   Agent 工具
│   ├── file_tools/            #     文件操作（read, write, edit, ls, glob, grep）
│   ├── shell_tools/           #     命令执行
│   ├── search_tools/          #     网络搜索 + 网页抓取
│   ├── skill_tools/           #     技能激活
│   └── frontend_tools/        #     前端交互（ask_user, update_plan）
├── skills/                    #   技能定义（60+ 技能，各含 SKILL.md + 脚本）
├── sandbox/                   #   Daytona 沙盒客户端
├── models/                    #   LLM 适配（OpenAI 兼容 + DeepSeek 推理）
├── schemas/                   #   数据模型
└── utils/                     #   工具函数

docker/                        # 基础设施
├── docker-compose.yaml        #   总入口（include artisan + daytona）
├── artisan/
│   └── docker-compose.yaml    #   PostgreSQL (pgvector)
└── daytona/
    ├── docker-compose.yaml    #   Daytona 全套服务
    ├── Dockerfile.sandbox     #   沙盒镜像定义
    ├── setup_snapshot.sh      #   镜像推送脚本
    └── dex/                   #   OIDC 认证配置
```

## 快速开始

### 前置条件

- Node.js 20+, Yarn
- [uv](https://docs.astral.sh/uv/)（Python 环境由 uv 自动管理，无需手动安装 Python）
- Docker & Docker Compose

### 1. 安装依赖

```bash
yarn install
```

> `yarn install` 会通过 `postinstall` 钩子自动执行 `cd agent && uv sync`，前后端依赖一次性装好。

### 2. 启动基础设施

```bash
cd docker && docker compose up -d
```

启动 PostgreSQL 和 Daytona 全套服务。

### 3. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`，填入必要配置：

| 变量 | 说明 |
|------|------|
| `OPENAI_API_KEY` | LLM API 密钥 |
| `OPENAI_API_BASE` | API 地址（如 OpenRouter、自建代理） |
| `LLM_MODEL` | 主模型（默认 `deepseek-reasoner`） |
| `LLM_LITE_MODEL` | 轻量模型（默认 `deepseek-chat`） |
| `TAVILY_API_KEY` | Tavily 搜索 API Key |
| `DATABASE_URL` | PostgreSQL 连接串（默认值见 .env.example） |
| `daytona_apikey` | Daytona API Key（下一步获取） |
| `organizationID` | Daytona 组织 ID（下一步获取） |

### 4. 配置 Daytona

1. 访问 http://localhost:18000（默认账号 `dev@daytona.io` / `password`）
2. 在设置中创建 API Key，记录组织 ID
3. 将获取到的 `daytona_apikey` 和 `organizationID` 填入 `.env`
4. 推送沙盒镜像：

```bash
cd docker/daytona && ./setup_snapshot.sh
```

> 脚本会读取 `.env` 中的 Daytona 配置，通过 API 将 `Dockerfile.sandbox` 构建为沙盒快照。
>
> 同时请确保部署机上的 `proxy.localhost` 能解析到回环地址（`127.0.0.1`）。至少应满足：
>
> ```bash
> getent hosts proxy.localhost
> ```
>
> 返回 `127.0.0.1 proxy.localhost`。如果要使用 Daytona 终端预览，`*.proxy.localhost` 也必须能正确指向本机。

### 5. 启动开发服务器

```bash
yarn dev
```

UI 运行在 http://localhost:8665，Agent 运行在 http://localhost:8664。

## 开发脚本

| 脚本 | 说明 |
|------|------|
| `yarn dev` | 启动 UI + Agent |
| `yarn dev:ui` | 仅启动前端 |
| `yarn dev:agent` | 仅启动 Agent |
| `yarn build` | 构建生产版本 |
| `yarn lint` | 前后端 lint（ESLint + Ruff） |
| `yarn check:agent` | Agent 全量检查（Ruff + mypy + pytest） |
| `yarn verify` | 仓库级检查（lint + typecheck + test + build） |

## Docker 服务端口

| 服务 | 端口 | 说明 |
|------|------|------|
| PostgreSQL | 5432 | 数据库 |
| Daytona API | 18000 | 沙盒管理控制台 |
| Daytona Proxy | 14000 | Toolbox 代理 |
| Daytona Runner | 18003 | 沙箱运行器 |
| Daytona SSH | 12222 | SSH 网关 |
| Dex | 15556 | OIDC 认证 |

## License

MIT
