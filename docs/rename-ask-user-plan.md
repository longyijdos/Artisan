# collect_user_info → ask_user 重命名方案

> 状态：✅ 已完成
> 创建：2026-03-19
> 完成：2026-03-20

## 背景

`collect_user_info` 语义模糊——看名字像是"收集用户资料"，但实际用途是 **AI 遇到缺少信息时停下来向用户提问**。重命名为 `ask_user`，语义更准确。

同时精简字段类型，去掉 AI 不需要关心的前端细节。

## 改动内容

### 1. 工具名重命名

`collect_user_info` → `ask_user`

所有相关命名一并更新：

| 原命名 | 新命名 |
|---|---|
| `collect_user_info`（工具名字符串） | `ask_user` |
| `CollectUserInfoFieldType` | `AskUserFieldType` |
| `CollectUserInfoField` | `AskUserField` |
| `CollectUserInfoInput` | `AskUserInput` |
| `collect_user_info()` 函数 | `ask_user()` |
| `onCollectUserInfoSubmit` 回调 | `onAskUserSubmit` |
| `CollectUserInfoCall` 组件 | `AskUserCall` |
| `CollectUserInfoCall.tsx` 文件 | `AskUserCall.tsx` |

### 2. 字段类型精简

从 6 种砍到 2 种：

| 保留 | 删除 |
|---|---|
| `text` | ~~textarea~~ |
| `select` | ~~number~~ |
| | ~~email~~ |
| | ~~password~~ |

- `text`：所有文本输入。前端统一用 `<textarea>` 渲染（支持多行），但对 AI 来说只需要知道"text = 让用户输入文字"。
- `select`：下拉选项（需提供 options 数组）。

### 3. 前端清理

- 删除 `getFieldIcon()` 函数（不再有 email/password/number 图标）
- 简化 `getPlaceholder()`（只剩 text 一种文本类型）
- 删除 `HTML_INPUT_TYPES` 常量和相关逻辑
- `<input type="...">` 分支统一改为 `<textarea>`
- `FieldType` 类型简化为 `"text" | "select"`

### 4. 系统提示词更新

`agent/prompts.py` 中的工具说明和示例代码同步更新。

## 涉及文件

### Agent 端（Python）

| 文件 | 改动 |
|---|---|
| `agent/tools/frontend_tools/prompts.py` | 类名、类型、工具函数全部重命名；字段类型精简 |
| `agent/tools/frontend_tools/__init__.py` | 导入名和 `__all__` 更新 |
| `agent/services/chat/worker/_constants.py` | `STREAMABLE_TOOL_NAMES` 和 `FRONTEND_TOOL_NAMES` 中的字符串 |
| `agent/prompts.py` | 系统提示词中的工具名和示例 |
| `agent/tests/test_graph_helpers.py` | 测试用例中的工具名字符串 |

### 前端（TypeScript/React）

| 文件 | 改动 |
|---|---|
| `src/components/ChatPanel/types.ts` | `FRONTEND_TOOL_NAMES` 中的字符串 |
| `src/components/ChatPanel/ChatPanel.tsx` | 回调名 `onCollectUserInfoSubmit` → `onAskUserSubmit`，toolName 字符串 |
| `src/components/ChatPanel/ChatTimeline.tsx` | prop 名和类型定义中的回调名 |
| `src/components/ChatPanel/FrontendToolCall.tsx` | prop 名、switch case 字符串、组件导入名 |
| `src/components/ToolRenderers/frontend/CollectUserInfoCall.tsx` | **重命名文件**为 `AskUserCall.tsx`，组件名、接口名全部更新，清理字段类型相关代码 |
| `src/components/ToolRenderers/frontend/index.ts` | 导出名更新 |
| `src/components/ToolRenderers/FrontendToolComponents.tsx` | 导入名更新 |
| `src/components/ToolRenderers/types.ts` | `HTML_INPUT_TYPES` 删除，`FieldType` 简化 |
