#!/bin/bash
# Daytona 自定义 Snapshot 设置脚本
# 使用 agent 目录下的 uv 环境运行 Python 脚本

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${SCRIPT_DIR}/../.."

echo "▶ 切换到项目目录: ${PROJECT_ROOT}/agent"
cd "${PROJECT_ROOT}/agent"

# 使用 uv 运行 setup_snapshot.py
# uv run 会自动处理环境变量和虚拟环境
echo "▶ 启动 Snapshot 设置程序..."
uv run python "${SCRIPT_DIR}/setup_snapshot.py" "$@"
