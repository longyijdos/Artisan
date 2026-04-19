<h1><img src="src/app/icon.svg" alt="Artisan icon" width="28" /> Artisan</h1>

[English](README.md) | [简体中文](README.zh-CN.md)

> Beyond chat, built for real work.

Artisan is an open-source AI workspace for work that does not end at the prompt. It brings together conversation, project files, sandboxed commands, installable skills, and grounded knowledge retrieval, so tasks can move from context to execution inside one environment.

## Why Artisan

- Keep conversation, files, commands, and reference material inside the same task.
- Let users work directly in the sandbox while the agent acts through tools.
- Extend the system with skills and indexed knowledge instead of hard-coding everything into prompts.

## Core Capabilities

![Artisan Showcase](.github/assets/readme/showcase.gif)

### Workspace

Browse the project, inspect files, and work against real artifacts instead of detached prompt snippets.

### Terminal

Open a sandbox terminal whenever you want direct control over the environment. Manual command-line work lives alongside the agent's own execution path.

### Skills

Install skills to add reusable workflows, tool integrations, and domain-specific behaviors.

### Knowledge Base

Index reference material and retrieve grounded context during a task. The knowledge base is suitable for documentation, product information, policies, FAQs, and similar sources.

## Architecture at a Glance

```text
src/      Next.js workspace UI and BFF routes
agent/    FastAPI + LangGraph agent runtime
docker/   PostgreSQL and Daytona local infrastructure
docs/     Project documentation
```

## Quick Start

1. Install dependencies.

```bash
yarn install
```

2. Start local infrastructure.

```bash
cd docker
docker compose up -d
```

3. Create local environment config and fill in the required credentials.

```bash
cp .env.example .env
```

4. Create the Daytona snapshot.

```bash
cd docker/daytona
./setup_snapshot.sh
```

5. Start Artisan.

```bash
yarn dev
```

Local endpoints:

- UI: `http://localhost:8665`
- Agent: `http://localhost:8664`

For full setup, local credentials, and troubleshooting, see [Getting Started](docs/getting-started.md).

## Documentation

- [Getting Started](docs/getting-started.md)
- [Architecture](docs/architecture.md)
- [Code Conventions](docs/code-conventions.md)

## License

MIT
