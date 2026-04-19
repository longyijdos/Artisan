<h1><img src="src/app/icon.svg" alt="Artisan icon" width="28" /> Artisan</h1>

[English](README.md) | [简体中文](README.zh-CN.md)

> 不止于对话，为真实工作而建。

Artisan 是一个面向执行型任务的开源 AI 工作台，服务于那些不止于对话的工作流。它把对话、项目文件、沙箱命令、可安装技能和知识检索放进同一套环境中，让任务可以从理解问题一路推进到真正落地。

## 为什么是 Artisan

- 让对话、文件、命令和参考资料处在同一条任务链路里。
- 你可以直接操作沙箱，agent 也可以通过工具执行动作。
- 技能和知识库让能力可以持续扩展，而不是写死在提示词里。

## 核心能力

![Artisan 展示](.github/assets/readme/showcase.gif)

### 工作区

直接浏览项目、查看文件，并围绕真实产物推进任务，而不是停留在脱离上下文的对话片段里。

### 控制台

需要直接掌控环境时，可以打开沙箱终端手动执行命令。它和 agent 自己的执行链路并行存在，适合放进同一个工作流里协作使用。

### 技能库

通过安装技能为 agent 增加可复用的流程、工具集成和面向特定领域的处理能力。

### 知识库

把参考资料索引进系统，在任务过程中提供基于资料的检索上下文。它适合承载文档、产品信息、规则说明、FAQ 等信息源。

## 架构一览

```text
src/      Next.js 工作台 UI 与 BFF 路由
agent/    FastAPI + LangGraph agent 运行时
docker/   PostgreSQL 与 Daytona 本地基础设施
docs/     项目文档
```

## 快速开始

1. 安装依赖。

```bash
yarn install
```

2. 启动本地基础设施。

```bash
cd docker
docker compose up -d
```

3. 创建本地环境配置并填写所需凭据。

```bash
cp .env.example .env
```

4. 创建 Daytona snapshot。

```bash
cd docker/daytona
./setup_snapshot.sh
```

5. 启动 Artisan。

```bash
yarn dev
```

本地默认地址：

- UI：`http://localhost:8665`
- Agent：`http://localhost:8664`

完整安装步骤、本地登录信息和排障说明见 [安装与启动](docs/getting-started.zh-CN.md)。

## 文档

- [安装与启动](docs/getting-started.zh-CN.md)
- [架构说明](docs/architecture.zh-CN.md)
- [代码约定](docs/code-conventions.zh-CN.md)

## 许可证

MIT
